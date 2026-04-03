import argparse
import json
import math
import os
import random
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import datasets, transforms
from transformers import AutoFeatureExtractor, AutoImageProcessor, AutoModelForImageClassification


DEFAULT_IMAGE_MEAN = [0.485, 0.456, 0.406]
DEFAULT_IMAGE_STD = [0.229, 0.224, 0.225]


def _read_json_if_exists(path: Path) -> dict | None:
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return None


def default_data_dir() -> Path:
    env_path = str(os.getenv("TRAIN_DATA_DIR", "")).strip()
    if env_path:
        return Path(env_path)

    last_report = _read_json_if_exists(Path("backend/models/plantdoc-52/training_report.json"))
    if last_report and str(last_report.get("data_root", "")).strip():
        return Path(str(last_report["data_root"]).strip())

    candidates = [
        Path("backend/data/plantdoc/train"),
        Path("backend/data/train"),
        Path("backend/data/plantdisease/PlantVillage/PlantVillage"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[-1]


def default_output_dir() -> Path:
    env_path = str(os.getenv("TRAIN_OUTPUT_DIR", "")).strip()
    if env_path:
        return Path(env_path)

    last_report = _read_json_if_exists(Path("backend/models/plantdoc-52/training_report.json"))
    if last_report and str(last_report.get("output_dir", "")).strip():
        return Path(str(last_report["output_dir"]).strip())

    return Path("backend/models/plantdoc-52")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fine-tune or evaluate an image classifier on a folder dataset.")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=default_data_dir(),
        help="Directory containing class subfolders.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=default_output_dir(),
        help="Directory to save trained model, processor, and reports.",
    )
    parser.add_argument(
        "--base-model",
        type=str,
        default="linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification",
        help="Base Hugging Face image classification model ID or local path.",
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=None,
        help="Existing fine-tuned model directory to evaluate or continue training.",
    )
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--finetune-lr-factor", type=float, default=0.35)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--val-split", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--num-workers", type=int, default=0)
    parser.add_argument("--head-epochs", type=int, default=1)
    parser.add_argument(
        "--freeze-backbone",
        dest="freeze_backbone",
        action="store_true",
        help="Train the classifier head only for the entire run.",
    )
    parser.add_argument("--label-smoothing", type=float, default=0.05)
    parser.add_argument("--grad-clip", type=float, default=1.0)
    parser.add_argument("--early-stop-patience", type=int, default=3)
    parser.add_argument("--min-epochs", type=int, default=3)
    parser.add_argument("--target-accuracy", type=float, default=0.8)
    parser.add_argument(
        "--disable-class-weights",
        action="store_true",
        help="Disable inverse-frequency class weighting in the loss.",
    )
    parser.add_argument(
        "--eval-only",
        action="store_true",
        help="Skip training and only evaluate the selected model on the validation split.",
    )
    return parser.parse_args()


def set_seed(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


class SimpleImageProcessor:
    def __init__(self, size: int = 224):
        self.size = size
        self.image_mean = DEFAULT_IMAGE_MEAN
        self.image_std = DEFAULT_IMAGE_STD
        self.do_resize = True
        self.do_center_crop = True
        self.do_normalize = True
        self.tfm = transforms.Compose(
            [
                transforms.Resize(256),
                transforms.CenterCrop(size),
                transforms.ToTensor(),
                transforms.Normalize(mean=self.image_mean, std=self.image_std),
            ]
        )

    def __call__(self, images, return_tensors="pt"):
        if isinstance(images, list):
            tensors = [self.tfm(img) for img in images]
            pixel_values = torch.stack(tensors, dim=0)
        else:
            pixel_values = self.tfm(images).unsqueeze(0)
        return {"pixel_values": pixel_values}


def load_processor(model_id: str):
    try:
        return AutoImageProcessor.from_pretrained(model_id, use_fast=False), "AutoImageProcessor"
    except Exception:
        try:
            return AutoFeatureExtractor.from_pretrained(model_id), "AutoFeatureExtractor"
        except Exception:
            return SimpleImageProcessor(), "SimpleImageProcessor"


def resolve_data_root(data_dir: Path) -> Path:
    if data_dir.exists() and any(child.is_dir() for child in data_dir.iterdir()):
        return data_dir

    fallback = data_dir.parent / "PlantVillage"
    if fallback.exists() and any(child.is_dir() for child in fallback.iterdir()):
        return fallback

    raise FileNotFoundError(f"Could not find class folders under: {data_dir}")


def stratified_split_indices(image_folder: datasets.ImageFolder, val_split: float, seed: int) -> tuple[list[int], list[int]]:
    rng = random.Random(seed)
    by_class: dict[int, list[int]] = defaultdict(list)
    for idx, (_, class_idx) in enumerate(image_folder.samples):
        by_class[class_idx].append(idx)

    train_indices: list[int] = []
    val_indices: list[int] = []

    for _, indices in by_class.items():
        rng.shuffle(indices)
        n_val = max(1, int(len(indices) * val_split))
        if len(indices) <= 2:
            n_val = 1
        val_indices.extend(indices[:n_val])
        train_indices.extend(indices[n_val:])

    rng.shuffle(train_indices)
    rng.shuffle(val_indices)
    return train_indices, val_indices


def count_labels(base: datasets.ImageFolder, indices: list[int]) -> list[int]:
    counts = [0 for _ in base.classes]
    for idx in indices:
        _, class_idx = base.samples[idx]
        counts[int(class_idx)] += 1
    return counts


@dataclass
class FolderSubset(Dataset):
    base: datasets.ImageFolder
    indices: list[int]
    transform: transforms.Compose | None = None

    def __len__(self) -> int:
        return len(self.indices)

    def __getitem__(self, idx: int) -> tuple[Image.Image, int]:
        image_path, class_idx = self.base.samples[self.indices[idx]]
        img = self.base.loader(image_path)
        if not isinstance(img, Image.Image):
            img = Image.fromarray(img)
        img = img.convert("RGB")
        if self.transform is not None:
            img = self.transform(img)
        return img, class_idx


def build_dataloaders(
    data_root: Path,
    processor,
    batch_size: int,
    val_split: float,
    seed: int,
    num_workers: int,
) -> tuple[DataLoader, DataLoader, list[str], int, int, list[int], list[int]]:
    base = datasets.ImageFolder(root=str(data_root))
    class_names = list(base.classes)
    train_indices, val_indices = stratified_split_indices(base, val_split=val_split, seed=seed)

    train_transform = transforms.Compose(
        [
            transforms.RandomResizedCrop(size=224, scale=(0.8, 1.0)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomRotation(degrees=15),
            transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.1, hue=0.02),
        ]
    )
    val_transform = transforms.Compose(
        [
            transforms.Resize(256),
            transforms.CenterCrop(224),
        ]
    )

    train_ds = FolderSubset(base=base, indices=train_indices, transform=train_transform)
    val_ds = FolderSubset(base=base, indices=val_indices, transform=val_transform)

    def collate_fn(batch):
        images = [item[0] for item in batch]
        labels = torch.tensor([item[1] for item in batch], dtype=torch.long)
        inputs = processor(images=images, return_tensors="pt")
        inputs["labels"] = labels
        return inputs

    train_loader = DataLoader(
        train_ds,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
        collate_fn=collate_fn,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
        collate_fn=collate_fn,
    )

    return (
        train_loader,
        val_loader,
        class_names,
        len(train_indices),
        len(val_indices),
        count_labels(base, train_indices),
        count_labels(base, val_indices),
    )


def set_backbone_trainable(model, trainable: bool) -> None:
    for name, param in model.named_parameters():
        if name.startswith("classifier"):
            param.requires_grad = True
        else:
            param.requires_grad = bool(trainable)


def build_optimizer(model, lr: float, weight_decay: float):
    trainable_params = [param for param in model.parameters() if param.requires_grad]
    return torch.optim.AdamW(trainable_params, lr=lr, weight_decay=weight_decay)


def build_scheduler(optimizer, epochs: int):
    return torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer,
        T_max=max(int(epochs), 1),
        eta_min=max(1e-6, optimizer.param_groups[0]["lr"] * 0.05),
    )


def build_loss_function(
    train_class_counts: list[int],
    device: torch.device,
    label_smoothing: float,
    enable_class_weights: bool,
) -> nn.Module:
    weights = None
    if enable_class_weights and train_class_counts:
        counts = torch.tensor(train_class_counts, dtype=torch.float32)
        nonzero = counts > 0
        safe_counts = counts.clone()
        safe_counts[~nonzero] = 1.0
        weights = counts.sum() / (len(train_class_counts) * safe_counts)
        weights = weights / weights.mean()
        weights = weights.to(device)

    return nn.CrossEntropyLoss(
        weight=weights,
        label_smoothing=max(0.0, float(label_smoothing)),
    )


@dataclass
class EvalArtifacts:
    labels: list[int]
    predictions: list[int]
    confidences: list[float]
    margins: list[float]


@dataclass
class EvalSummary:
    loss: float
    acc: float
    balanced_acc: float
    macro_f1: float
    per_class: list[dict]
    confusion_matrix: list[list[int]]
    mean_confidence: float
    mean_margin: float
    correct_mean_confidence: float
    incorrect_mean_confidence: float


def summarize_confusion(confusion: torch.Tensor, class_names: list[str]) -> tuple[float, float, list[dict]]:
    per_class = []
    recalls = []
    f1s = []

    for class_idx, class_name in enumerate(class_names):
        tp = int(confusion[class_idx, class_idx].item())
        support = int(confusion[class_idx, :].sum().item())
        predicted = int(confusion[:, class_idx].sum().item())

        recall = tp / support if support else 0.0
        precision = tp / predicted if predicted else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

        if support:
            recalls.append(recall)
            f1s.append(f1)

        per_class.append(
            {
                "label": class_name,
                "support": support,
                "precision": round(precision, 6),
                "recall": round(recall, 6),
                "f1": round(f1, 6),
            }
        )

    balanced_acc = sum(recalls) / max(len(recalls), 1)
    macro_f1 = sum(f1s) / max(len(f1s), 1)
    return balanced_acc, macro_f1, per_class


def evaluate(
    model,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    class_names: list[str],
) -> tuple[EvalSummary, EvalArtifacts]:
    model.eval()
    total_loss = 0.0
    total = 0
    correct = 0
    confusion = torch.zeros((len(class_names), len(class_names)), dtype=torch.int64)

    labels_all: list[int] = []
    preds_all: list[int] = []
    confidences_all: list[float] = []
    margins_all: list[float] = []

    with torch.no_grad():
        for batch in loader:
            pixel_values = batch["pixel_values"].to(device)
            labels = batch["labels"].to(device)

            logits = model(pixel_values=pixel_values).logits
            loss = criterion(logits, labels)
            probs = torch.softmax(logits, dim=-1)
            preds = torch.argmax(probs, dim=-1)
            topk = torch.topk(probs, k=min(2, probs.shape[-1]), dim=-1).values
            confidences = topk[:, 0]
            margins = topk[:, 0] - topk[:, 1] if topk.shape[-1] > 1 else topk[:, 0]

            total_loss += float(loss.item()) * labels.size(0)
            total += int(labels.size(0))
            correct += int((preds == labels).sum().item())

            for label, pred in zip(labels.detach().cpu().tolist(), preds.detach().cpu().tolist()):
                confusion[int(label), int(pred)] += 1

            labels_all.extend(labels.detach().cpu().tolist())
            preds_all.extend(preds.detach().cpu().tolist())
            confidences_all.extend(float(value) for value in confidences.detach().cpu().tolist())
            margins_all.extend(float(value) for value in margins.detach().cpu().tolist())

    balanced_acc, macro_f1, per_class = summarize_confusion(confusion, class_names)
    incorrect_confidences = [
        conf for conf, label, pred in zip(confidences_all, labels_all, preds_all) if int(label) != int(pred)
    ]
    correct_confidences = [
        conf for conf, label, pred in zip(confidences_all, labels_all, preds_all) if int(label) == int(pred)
    ]

    summary = EvalSummary(
        loss=total_loss / max(total, 1),
        acc=correct / max(total, 1),
        balanced_acc=balanced_acc,
        macro_f1=macro_f1,
        per_class=per_class,
        confusion_matrix=confusion.tolist(),
        mean_confidence=sum(confidences_all) / max(len(confidences_all), 1),
        mean_margin=sum(margins_all) / max(len(margins_all), 1),
        correct_mean_confidence=sum(correct_confidences) / max(len(correct_confidences), 1),
        incorrect_mean_confidence=sum(incorrect_confidences) / max(len(incorrect_confidences), 1),
    )
    artifacts = EvalArtifacts(
        labels=labels_all,
        predictions=preds_all,
        confidences=confidences_all,
        margins=margins_all,
    )
    return summary, artifacts


def recommend_thresholds(artifacts: EvalArtifacts, target_accuracy: float) -> dict:
    conf_grid = [round(value, 2) for value in torch.arange(0.35, 0.91, 0.05).tolist()]
    margin_grid = [round(value, 2) for value in torch.arange(0.02, 0.31, 0.02).tolist()]

    best_target = None
    best_fallback = None
    total = max(len(artifacts.labels), 1)

    for conf_threshold in conf_grid:
        for margin_threshold in margin_grid:
            selected = [
                idx
                for idx, (confidence, margin) in enumerate(zip(artifacts.confidences, artifacts.margins))
                if confidence >= conf_threshold and margin >= margin_threshold
            ]
            if not selected:
                continue

            correct = sum(
                1
                for idx in selected
                if int(artifacts.labels[idx]) == int(artifacts.predictions[idx])
            )
            selected_count = len(selected)
            accuracy = correct / selected_count
            coverage = selected_count / total
            candidate = {
                "low_confidence_threshold": round(conf_threshold, 3),
                "low_margin_threshold": round(margin_threshold, 3),
                "selected_count": int(selected_count),
                "coverage": round(coverage, 6),
                "expected_accuracy": round(accuracy, 6),
                "target_accuracy": round(float(target_accuracy), 6),
                "target_met": bool(accuracy >= target_accuracy),
            }

            if accuracy >= target_accuracy:
                if (
                    best_target is None
                    or coverage > best_target["coverage"]
                    or (math.isclose(coverage, best_target["coverage"]) and accuracy > best_target["expected_accuracy"])
                ):
                    best_target = candidate

            score = accuracy * math.sqrt(max(coverage, 1e-9))
            if best_fallback is None or score > best_fallback["score"]:
                best_fallback = {**candidate, "score": score}

    if best_target is not None:
        best_target["selection_strategy"] = "max_coverage_at_target_accuracy"
        return best_target

    if best_fallback is not None:
        best_fallback.pop("score", None)
        best_fallback["selection_strategy"] = "best_accuracy_coverage_tradeoff"
        return best_fallback

    return {
        "low_confidence_threshold": 0.65,
        "low_margin_threshold": 0.1,
        "selected_count": 0,
        "coverage": 0.0,
        "expected_accuracy": 0.0,
        "target_accuracy": round(float(target_accuracy), 6),
        "target_met": False,
        "selection_strategy": "default_fallback",
    }


def build_training_log_item(epoch: int, phase: str, train_loss: float, train_acc: float, summary: EvalSummary, elapsed: float) -> dict:
    return {
        "epoch": epoch,
        "phase": phase,
        "train_loss": round(train_loss, 6),
        "train_acc": round(train_acc, 6),
        "val_loss": round(summary.loss, 6),
        "val_acc": round(summary.acc, 6),
        "val_balanced_acc": round(summary.balanced_acc, 6),
        "val_macro_f1": round(summary.macro_f1, 6),
        "seconds": round(elapsed, 2),
    }


def choose_model_source(args: argparse.Namespace) -> str:
    if args.model_dir:
        return str(args.model_dir)
    if args.eval_only and (args.output_dir / "model.safetensors").exists():
        return str(args.output_dir)
    return str(args.base_model)


def load_model(model_source: str, class_names: list[str], continue_from_finetuned: bool):
    if continue_from_finetuned:
        model = AutoModelForImageClassification.from_pretrained(model_source)
        current_labels = [str(model.config.id2label.get(i, i)) for i in range(int(model.config.num_labels))]
        if current_labels != class_names:
            raise ValueError("Model labels do not match dataset class folders.")
        return model

    id2label = {idx: name for idx, name in enumerate(class_names)}
    label2id = {name: idx for idx, name in id2label.items()}
    return AutoModelForImageClassification.from_pretrained(
        model_source,
        num_labels=len(class_names),
        id2label=id2label,
        label2id=label2id,
        ignore_mismatched_sizes=True,
    )


def main() -> None:
    args = parse_args()
    set_seed(args.seed)

    data_root = resolve_data_root(args.data_dir)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[train] device={device}")
    print(f"[train] data_root={data_root}")

    temp_base = datasets.ImageFolder(root=str(data_root))
    class_names = list(temp_base.classes)
    model_source = choose_model_source(args)
    continue_from_finetuned = bool(args.model_dir)

    processor, processor_source = load_processor(model_source)
    print(f"[train] processor_source={processor_source}")
    print(f"[train] model_source={model_source}")

    model = load_model(model_source, class_names, continue_from_finetuned)
    model.to(device)

    (
        train_loader,
        val_loader,
        class_names,
        train_count,
        val_count,
        train_class_counts,
        val_class_counts,
    ) = build_dataloaders(
        data_root=data_root,
        processor=processor,
        batch_size=args.batch_size,
        val_split=args.val_split,
        seed=args.seed,
        num_workers=args.num_workers,
    )
    print(f"[train] classes={len(class_names)} train={train_count} val={val_count}")

    criterion = build_loss_function(
        train_class_counts=train_class_counts,
        device=device,
        label_smoothing=args.label_smoothing,
        enable_class_weights=not args.disable_class_weights,
    )

    history: list[dict] = []
    best_score = float("-inf")
    best_epoch = 0
    best_metrics: dict | None = None
    epochs_without_improvement = 0

    if args.eval_only:
        summary, artifacts = evaluate(model, val_loader, criterion, device, class_names)
        thresholds = recommend_thresholds(artifacts, args.target_accuracy)
        best_metrics = {
            "val_loss": round(summary.loss, 6),
            "val_acc": round(summary.acc, 6),
            "val_balanced_acc": round(summary.balanced_acc, 6),
            "val_macro_f1": round(summary.macro_f1, 6),
            "mean_confidence": round(summary.mean_confidence, 6),
            "mean_margin": round(summary.mean_margin, 6),
            "correct_mean_confidence": round(summary.correct_mean_confidence, 6),
            "incorrect_mean_confidence": round(summary.incorrect_mean_confidence, 6),
        }
    else:
        warmup_epochs = 0 if args.freeze_backbone else max(0, min(int(args.head_epochs), int(args.epochs)))
        if warmup_epochs > 0:
            set_backbone_trainable(model, False)
            current_phase = "head_only"
            current_lr = args.lr
            scheduler_span = warmup_epochs
            print(f"[train] Warmup phase: {warmup_epochs} epoch(s) with frozen backbone.")
        elif args.freeze_backbone:
            set_backbone_trainable(model, False)
            current_phase = "head_only"
            current_lr = args.lr
            scheduler_span = args.epochs
            print("[train] Backbone frozen for the entire run.")
        else:
            set_backbone_trainable(model, True)
            current_phase = "full_finetune"
            current_lr = args.lr
            scheduler_span = args.epochs

        optimizer = build_optimizer(model, current_lr, args.weight_decay)
        scheduler = build_scheduler(optimizer, scheduler_span)

        for epoch in range(1, args.epochs + 1):
            if (
                not args.freeze_backbone
                and warmup_epochs > 0
                and epoch == warmup_epochs + 1
            ):
                set_backbone_trainable(model, True)
                current_phase = "full_finetune"
                current_lr = max(1e-6, args.lr * args.finetune_lr_factor)
                optimizer = build_optimizer(model, current_lr, args.weight_decay)
                scheduler = build_scheduler(optimizer, args.epochs - warmup_epochs)
                print(f"[train] Switching to full fine-tuning at epoch={epoch} lr={current_lr:.6f}")

            start = time.time()
            model.train()
            running_loss = 0.0
            running_total = 0
            running_correct = 0

            for step, batch in enumerate(train_loader, start=1):
                pixel_values = batch["pixel_values"].to(device)
                labels = batch["labels"].to(device)

                optimizer.zero_grad(set_to_none=True)
                logits = model(pixel_values=pixel_values).logits
                loss = criterion(logits, labels)
                loss.backward()

                if args.grad_clip and args.grad_clip > 0:
                    torch.nn.utils.clip_grad_norm_(model.parameters(), args.grad_clip)

                optimizer.step()

                preds = torch.argmax(logits, dim=-1)
                batch_size = labels.size(0)
                running_loss += float(loss.item()) * batch_size
                running_correct += int((preds == labels).sum().item())
                running_total += int(batch_size)

                if step % 50 == 0:
                    print(
                        f"[train] epoch={epoch} phase={current_phase} step={step}/{len(train_loader)} "
                        f"loss={running_loss / max(running_total, 1):.4f} "
                        f"acc={running_correct / max(running_total, 1):.4f}"
                    )

            train_loss = running_loss / max(running_total, 1)
            train_acc = running_correct / max(running_total, 1)
            summary, _ = evaluate(model, val_loader, criterion, device, class_names)
            scheduler.step()
            elapsed = time.time() - start

            log_item = build_training_log_item(epoch, current_phase, train_loss, train_acc, summary, elapsed)
            history.append(log_item)
            print(
                f"[train] epoch={epoch} phase={current_phase} done in {elapsed:.1f}s "
                f"train_loss={train_loss:.4f} train_acc={train_acc:.4f} "
                f"val_loss={summary.loss:.4f} val_acc={summary.acc:.4f} "
                f"val_bal_acc={summary.balanced_acc:.4f} val_macro_f1={summary.macro_f1:.4f}"
            )

            score = summary.macro_f1 + summary.balanced_acc
            if score > best_score:
                best_score = score
                best_epoch = epoch
                epochs_without_improvement = 0
                model.save_pretrained(args.output_dir)
                if hasattr(processor, "save_pretrained"):
                    processor.save_pretrained(args.output_dir)
                best_metrics = {
                    "val_loss": round(summary.loss, 6),
                    "val_acc": round(summary.acc, 6),
                    "val_balanced_acc": round(summary.balanced_acc, 6),
                    "val_macro_f1": round(summary.macro_f1, 6),
                    "mean_confidence": round(summary.mean_confidence, 6),
                    "mean_margin": round(summary.mean_margin, 6),
                    "correct_mean_confidence": round(summary.correct_mean_confidence, 6),
                    "incorrect_mean_confidence": round(summary.incorrect_mean_confidence, 6),
                }
                print(f"[train] New best checkpoint saved to {args.output_dir}")
            else:
                epochs_without_improvement += 1

            if epoch >= max(args.min_epochs, warmup_epochs + 1) and epochs_without_improvement >= args.early_stop_patience:
                print(f"[train] Early stopping triggered at epoch={epoch}")
                break

        if not (args.output_dir / "model.safetensors").exists():
            model.save_pretrained(args.output_dir)
            if hasattr(processor, "save_pretrained"):
                processor.save_pretrained(args.output_dir)

        best_model = AutoModelForImageClassification.from_pretrained(args.output_dir)
        best_model.to(device)
        summary, artifacts = evaluate(best_model, val_loader, criterion, device, class_names)
        thresholds = recommend_thresholds(artifacts, args.target_accuracy)

    tuning_payload = {
        "model_id": str(args.output_dir),
        "low_confidence_threshold": thresholds["low_confidence_threshold"],
        "low_margin_threshold": thresholds["low_margin_threshold"],
        "expected_accuracy": thresholds["expected_accuracy"],
        "coverage": thresholds["coverage"],
        "selected_count": thresholds["selected_count"],
        "target_accuracy": thresholds["target_accuracy"],
        "target_met": thresholds["target_met"],
        "selection_strategy": thresholds["selection_strategy"],
    }
    tuning_path = args.output_dir / "inference_tuning.json"
    tuning_path.write_text(json.dumps(tuning_payload, indent=2), encoding="utf-8")

    report = {
        "data_root": str(data_root),
        "base_model": args.base_model,
        "model_source": model_source,
        "output_dir": str(args.output_dir),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "lr": args.lr,
        "finetune_lr_factor": args.finetune_lr_factor,
        "weight_decay": args.weight_decay,
        "val_split": args.val_split,
        "seed": args.seed,
        "num_workers": args.num_workers,
        "head_epochs": args.head_epochs,
        "freeze_backbone": args.freeze_backbone,
        "label_smoothing": args.label_smoothing,
        "grad_clip": args.grad_clip,
        "early_stop_patience": args.early_stop_patience,
        "min_epochs": args.min_epochs,
        "eval_only": args.eval_only,
        "class_weights_enabled": not args.disable_class_weights,
        "target_accuracy": args.target_accuracy,
        "train_count": train_count,
        "val_count": val_count,
        "train_class_counts": dict(Counter({class_names[idx]: count for idx, count in enumerate(train_class_counts)})),
        "val_class_counts": dict(Counter({class_names[idx]: count for idx, count in enumerate(val_class_counts)})),
        "classes": class_names,
        "best_epoch": best_epoch,
        "best_metrics": best_metrics,
        "history": history,
        "evaluation": {
            "val_loss": round(summary.loss, 6),
            "val_acc": round(summary.acc, 6),
            "val_balanced_acc": round(summary.balanced_acc, 6),
            "val_macro_f1": round(summary.macro_f1, 6),
            "mean_confidence": round(summary.mean_confidence, 6),
            "mean_margin": round(summary.mean_margin, 6),
            "correct_mean_confidence": round(summary.correct_mean_confidence, 6),
            "incorrect_mean_confidence": round(summary.incorrect_mean_confidence, 6),
            "per_class": summary.per_class,
            "confusion_matrix": summary.confusion_matrix,
        },
        "recommended_thresholds": tuning_payload,
    }
    report_path = args.output_dir / "training_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"[train] Inference tuning written: {tuning_path}")
    print(f"[train] Training report written: {report_path}")
    print(
        "[train] Recommended inference gate: "
        f"LOW_CONFIDENCE_THRESHOLD={tuning_payload['low_confidence_threshold']} "
        f"LOW_MARGIN_THRESHOLD={tuning_payload['low_margin_threshold']} "
        f"(expected_accuracy={tuning_payload['expected_accuracy']}, coverage={tuning_payload['coverage']})"
    )


if __name__ == "__main__":
    main()
