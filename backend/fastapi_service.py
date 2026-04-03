import base64
import os
import re
from io import BytesIO
import json
from pathlib import Path
import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from torchvision import transforms
from transformers import (
    AutoFeatureExtractor,
    AutoImageProcessor,
    AutoModelForImageClassification,
    AutoProcessor,
    CLIPModel,
)
try:
    # Supports launching from repo root:
    #   python -m uvicorn backend.fastapi_service:app ...
    from backend.db_operations import (
        store_prediction,
        store_image,
        flag_prediction_for_retraining,
        get_retraining_queue,
        update_retraining_request,
        get_prediction_with_details,
        get_user_history,
        get_low_confidence_predictions,
    )
except ModuleNotFoundError:
    # Supports launching from backend directory:
    #   python -m uvicorn fastapi_service:app ...
    from db_operations import (
        store_prediction,
        store_image,
        flag_prediction_for_retraining,
        get_retraining_queue,
        update_retraining_request,
        get_prediction_with_details,
        get_user_history,
        get_low_confidence_predictions,
    )

app = FastAPI(title="VisionQC Predictor (Vision + Grad-CAM)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


def read_env_float(name: str, default: float, min_value: float | None = None, max_value: float | None = None) -> float:
    raw = os.getenv(name, "")
    if raw == "":
        value = float(default)
    else:
        try:
            value = float(raw)
        except Exception:
            value = float(default)

    if min_value is not None:
        value = max(float(min_value), value)
    if max_value is not None:
        value = min(float(max_value), value)
    return value


def read_env_int(name: str, default: int, min_value: int | None = None, max_value: int | None = None) -> int:
    raw = os.getenv(name, "")
    if raw == "":
        value = int(default)
    else:
        try:
            value = int(raw)
        except Exception:
            value = int(default)

    if min_value is not None:
        value = max(int(min_value), value)
    if max_value is not None:
        value = min(int(max_value), value)
    return value


def read_env_bool(name: str, default: bool) -> bool:
    raw = str(os.getenv(name, "")).strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    return bool(default)


def read_env_csv(name: str, default_values: list[str]) -> list[str]:
    raw = str(os.getenv(name, "")).strip()
    if not raw:
        return [str(value).strip() for value in default_values if str(value).strip()]

    values = []
    for item in raw.split(","):
        normalized = str(item).strip()
        if normalized:
            values.append(normalized)
    return values


def load_model_tuning(model_id: str) -> dict:
    model_path = Path(str(model_id or "").strip())
    if not model_path.exists() or not model_path.is_dir():
        return {}

    candidates = [
        model_path / "inference_tuning.json",
        model_path / "training_report.json",
    ]
    for candidate in candidates:
        try:
            if not candidate.exists():
                continue

            payload = json.loads(candidate.read_text(encoding="utf-8"))
            if candidate.name == "training_report.json":
                tuning = payload.get("recommended_thresholds") or payload.get("threshold_recommendations") or {}
                if isinstance(tuning, dict):
                    return tuning
            elif isinstance(payload, dict):
                return payload
        except Exception:
            continue
    return {}


# -------------------------
# Model + processor config
# -------------------------
MODEL_ID = (
    os.getenv("MODEL_ID", "backend/models/plantdoc-52").strip()
    or "backend/models/plantdoc-52"
)
MODEL_TUNING = load_model_tuning(MODEL_ID)
# Optional dedicated crop classifier model.
# If empty/unavailable, fallback crop gating is derived from disease-model probabilities.
CROP_MODEL_ID = os.getenv("CROP_MODEL_ID", "").strip()

LOW_CONFIDENCE_THRESHOLD = read_env_float(
    "LOW_CONFIDENCE_THRESHOLD",
    float(MODEL_TUNING.get("low_confidence_threshold", 0.65)),
    0.0,
    1.0,
)
LOW_MARGIN_THRESHOLD = read_env_float(
    "LOW_MARGIN_THRESHOLD",
    float(MODEL_TUNING.get("low_margin_threshold", 0.10)),
    0.0,
    1.0,
)
CROP_CONFIDENCE_THRESHOLD = read_env_float("CROP_CONFIDENCE_THRESHOLD", 0.45, 0.0, 1.0)
TOP_K = read_env_int("TOP_K", 3, 1, 10)
QUALITY_GATE_THRESHOLD = read_env_float("QUALITY_GATE_THRESHOLD", 0.65, 0.0, 1.0)
STRICT_CROP_GATE = read_env_bool("STRICT_CROP_GATE", False)
ENABLE_HARD_CROP_GATE = read_env_bool("ENABLE_HARD_CROP_GATE", False)
HARD_CROP_GATE_MIN_CONF = read_env_float("HARD_CROP_GATE_MIN_CONF", 0.90, 0.0, 1.0)
CROP_PRIOR_MIN_CONF = read_env_float("CROP_PRIOR_MIN_CONF", 0.35, 0.0, 1.0)
CROP_PRIOR_STRENGTH = read_env_float("CROP_PRIOR_STRENGTH", 0.55, 0.0, 1.0)
CROP_PRIOR_FLOOR = read_env_float("CROP_PRIOR_FLOOR", 0.08, 0.0, 1.0)
ENABLE_OPEN_WORLD_CROP_CHECK = read_env_bool("ENABLE_OPEN_WORLD_CROP_CHECK", True)
OPEN_WORLD_MODEL_ID = os.getenv("OPEN_WORLD_MODEL_ID", "openai/clip-vit-base-patch32").strip()
OPEN_WORLD_LOCAL_FILES_ONLY = read_env_bool("OPEN_WORLD_LOCAL_FILES_ONLY", True)
OPEN_WORLD_USE_AS_HINT_CONF = read_env_float("OPEN_WORLD_USE_AS_HINT_CONF", 0.40, 0.0, 1.0)
OPEN_WORLD_MIN_UNSUPPORTED_CONF = read_env_float("OPEN_WORLD_MIN_UNSUPPORTED_CONF", 0.45, 0.0, 1.0)
OPEN_WORLD_TOP_K = read_env_int("OPEN_WORLD_TOP_K", 5, 1, 10)
OPEN_WORLD_HINT_BLEND_WEIGHT = read_env_float("OPEN_WORLD_HINT_BLEND_WEIGHT", 0.35, 0.0, 1.0)
OPEN_WORLD_UNSUPPORTED_MARGIN = read_env_float("OPEN_WORLD_UNSUPPORTED_MARGIN", 0.20, 0.0, 1.0)

DEFAULT_IMAGE_MEAN = [0.485, 0.456, 0.406]
DEFAULT_IMAGE_STD = [0.229, 0.224, 0.225]
PREPROCESS_LOG_LIMIT = 3

_preprocess_stats_logged = set()


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


def load_image_processor(model_id: str):
    try:
        return AutoImageProcessor.from_pretrained(model_id, use_fast=False), "AutoImageProcessor"
    except Exception:
        try:
            return AutoFeatureExtractor.from_pretrained(model_id), "AutoFeatureExtractor"
        except Exception:
            return SimpleImageProcessor(), "SimpleImageProcessor"


def build_id2label(model: AutoModelForImageClassification) -> dict[int, str]:
    raw = dict(getattr(model.config, "id2label", {}) or {})
    if not raw:
        return {i: str(i) for i in range(int(model.config.num_labels))}

    converted = {}
    for key, value in raw.items():
        try:
            converted[int(key)] = str(value)
        except Exception:
            continue

    if not converted:
        return {i: str(i) for i in range(int(model.config.num_labels))}
    return converted


def processor_summary(processor) -> dict:
    return {
        "type": processor.__class__.__name__,
        "do_resize": bool(getattr(processor, "do_resize", True)),
        "size": getattr(processor, "size", None),
        "do_center_crop": bool(getattr(processor, "do_center_crop", True)),
        "crop_size": getattr(processor, "crop_size", None),
        "do_normalize": bool(getattr(processor, "do_normalize", True)),
        "image_mean": list(getattr(processor, "image_mean", DEFAULT_IMAGE_MEAN)),
        "image_std": list(getattr(processor, "image_std", DEFAULT_IMAGE_STD)),
        "resample": getattr(processor, "resample", None),
        "channel_order": "RGB (PIL)",
    }


def log_processor_summary(model_name: str, processor, source: str):
    summary = processor_summary(processor)
    print(f"[VisionQC] {model_name} processor source={source}, settings={summary}")
    print(
        f"[VisionQC] {model_name} training/inference normalization check: "
        f"mean={summary['image_mean']} std={summary['image_std']}"
    )


def normalize_text(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(text or "").lower()).strip()


def compact_key(text: str) -> str:
    return normalize_text(text).replace(" ", "_")


CROP_ALIASES = {
    "apple": {"apple"},
    "apricot": {"apricot"},
    "bean": {"bean", "beans"},
    "blueberry": {"blueberry"},
    "cherry": {"cherry"},
    "corn": {"corn", "maize"},
    "fig": {"fig"},
    "grape": {"grape"},
    "loquat": {"loquat", "lokat"},
    "orange": {"orange"},
    "pear": {"pear"},
    "peach": {"peach"},
    "pepper": {"pepper", "bell pepper"},
    "persimmon": {"persimmon", "persimmons"},
    "potato": {"potato"},
    "raspberry": {"raspberry"},
    "soybean": {"soybean", "soy"},
    "squash": {"squash"},
    "strawberry": {"strawberry"},
    "tomato": {"tomato"},
    "cucumber": {"cucumber"},
    "walnut": {"walnut"},
}

ALIAS_TO_CANONICAL = {}
for canonical, aliases in CROP_ALIASES.items():
    for alias in aliases:
        ALIAS_TO_CANONICAL[normalize_text(alias)] = canonical


def canonicalize_crop_name(raw_label: str) -> str | None:
    normalized = normalize_text(raw_label)
    if not normalized:
        return None

    if normalized in ALIAS_TO_CANONICAL:
        return ALIAS_TO_CANONICAL[normalized]

    for alias, canonical in sorted(ALIAS_TO_CANONICAL.items(), key=lambda item: len(item[0]), reverse=True):
        if re.search(rf"\b{re.escape(alias)}\b", normalized):
            return canonical

    return None


def infer_crop_name_from_label_tokens(raw_label: str) -> str | None:
    normalized = normalize_text(str(raw_label or "").replace("_", " "))
    if not normalized:
        return None

    tokens = normalized.split()
    if not tokens:
        return None

    for span in (3, 2, 1):
        if len(tokens) < span:
            continue
        candidate = " ".join(tokens[:span])
        canonical = canonicalize_crop_name(candidate)
        if canonical:
            return canonical

    first_token = tokens[0]
    if first_token in {"healthy", "normal", "leaf", "disease"}:
        return None
    return first_token


def extract_crop_from_disease_label(label: str) -> str | None:
    return canonicalize_crop_name(label.replace("_", " ")) or infer_crop_name_from_label_tokens(label)


device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[VisionQC] Using device: {device}")

disease_processor, disease_processor_source = load_image_processor(MODEL_ID)
disease_model = AutoModelForImageClassification.from_pretrained(MODEL_ID)
disease_model.to(device)
disease_model.eval()
DISEASE_ID2LABEL = build_id2label(disease_model)

log_processor_summary("Disease model", disease_processor, disease_processor_source)


def build_disease_crop_index():
    class_to_crop = {}
    for idx in range(int(disease_model.config.num_labels)):
        label = DISEASE_ID2LABEL.get(idx, str(idx))
        crop = extract_crop_from_disease_label(label)
        if crop:
            class_to_crop[idx] = crop

    crop_to_class_indices = {}
    for class_idx, crop_name in class_to_crop.items():
        crop_to_class_indices.setdefault(crop_name, []).append(class_idx)

    return class_to_crop, crop_to_class_indices


DISEASE_CLASS_TO_CROP, CROP_TO_DISEASE_CLASS_INDICES = build_disease_crop_index()
print(f"[VisionQC] Crop map built from disease labels: {sorted(CROP_TO_DISEASE_CLASS_INDICES.keys())}")
SUPPORTED_CROPS = sorted(CROP_TO_DISEASE_CLASS_INDICES.keys())
DEFAULT_OPEN_WORLD_EXTRA_CROPS = [
    "cucumber",
    "onion",
    "garlic",
    "banana",
    "mango",
    "papaya",
    "guava",
    "watermelon",
    "melon",
    "cabbage",
    "cauliflower",
    "broccoli",
    "lettuce",
    "spinach",
    "eggplant",
    "okra",
    "chili",
    "carrot",
    "beetroot",
    "wheat",
    "rice",
    "cotton",
    "sunflower",
    "rose",
    "jasmine",
    "orchid",
    "hibiscus",
    "mint",
    "basil",
    "other plant",
]
OPEN_WORLD_EXTRA_CROPS = read_env_csv("OPEN_WORLD_EXTRA_CROPS", DEFAULT_OPEN_WORLD_EXTRA_CROPS)
OPEN_WORLD_CROP_LABELS = sorted({*SUPPORTED_CROPS, *OPEN_WORLD_EXTRA_CROPS})

open_world_crop_model = None
open_world_crop_processor = None

if ENABLE_OPEN_WORLD_CROP_CHECK:
    try:
        open_world_crop_processor = AutoProcessor.from_pretrained(
            OPEN_WORLD_MODEL_ID, local_files_only=OPEN_WORLD_LOCAL_FILES_ONLY
        )
        open_world_crop_model = CLIPModel.from_pretrained(
            OPEN_WORLD_MODEL_ID, local_files_only=OPEN_WORLD_LOCAL_FILES_ONLY
        )
        open_world_crop_model.to(device)
        open_world_crop_model.eval()
        print(
            f"[VisionQC] Open-world crop check enabled: model={OPEN_WORLD_MODEL_ID}, "
            f"labels={len(OPEN_WORLD_CROP_LABELS)}, local_files_only={OPEN_WORLD_LOCAL_FILES_ONLY}"
        )
    except Exception as error:
        open_world_crop_model = None
        open_world_crop_processor = None
        print(f"[VisionQC] Open-world crop check disabled due to load error: {error}")

crop_model = None
crop_processor = None
CROP_ID2LABEL = {}
CROP_STAGE_SOURCE = "disease_derived"

if CROP_MODEL_ID:
    try:
        crop_processor, crop_processor_source = load_image_processor(CROP_MODEL_ID)
        crop_model = AutoModelForImageClassification.from_pretrained(CROP_MODEL_ID)
        crop_model.to(device)
        crop_model.eval()
        CROP_ID2LABEL = build_id2label(crop_model)
        CROP_STAGE_SOURCE = f"dedicated_model:{CROP_MODEL_ID}"
        log_processor_summary("Crop model", crop_processor, crop_processor_source)
    except Exception as error:
        crop_model = None
        crop_processor = None
        CROP_STAGE_SOURCE = "disease_derived"
        print(
            f"[VisionQC] Failed to load CROP_MODEL_ID={CROP_MODEL_ID}. "
            f"Falling back to disease-derived crop gate. Error: {error}"
        )
else:
    print("[VisionQC] CROP_MODEL_ID not set. Using disease-derived crop gate.")

print(
    "[VisionQC] Inference config: "
    f"model={MODEL_ID}, top_k={TOP_K}, quality_gate_threshold={QUALITY_GATE_THRESHOLD}, "
    f"strict_crop_gate={STRICT_CROP_GATE}, hard_crop_gate={ENABLE_HARD_CROP_GATE}, "
    f"hard_crop_gate_min_conf={HARD_CROP_GATE_MIN_CONF}, "
    f"crop_prior_min_conf={CROP_PRIOR_MIN_CONF}, crop_prior_strength={CROP_PRIOR_STRENGTH}, "
    f"crop_prior_floor={CROP_PRIOR_FLOOR}, "
    f"low_conf_threshold={LOW_CONFIDENCE_THRESHOLD}, low_margin_threshold={LOW_MARGIN_THRESHOLD}, "
    f"open_world_crop_check={ENABLE_OPEN_WORLD_CROP_CHECK}, open_world_model={OPEN_WORLD_MODEL_ID}, "
    f"open_world_local_files_only={OPEN_WORLD_LOCAL_FILES_ONLY}, "
    f"open_world_hint_conf={OPEN_WORLD_USE_AS_HINT_CONF}, "
    f"open_world_unsupported_conf={OPEN_WORLD_MIN_UNSUPPORTED_CONF}, "
    f"open_world_top_k={OPEN_WORLD_TOP_K}, "
    f"open_world_hint_blend_weight={OPEN_WORLD_HINT_BLEND_WEIGHT}, "
    f"open_world_unsupported_margin={OPEN_WORLD_UNSUPPORTED_MARGIN}, "
    f"model_tuning_loaded={bool(MODEL_TUNING)}"
)
print(f"[VisionQC] Supported disease crops: {SUPPORTED_CROPS}")


def preprocess_image(pil_img: Image.Image, processor, stage_name: str) -> torch.Tensor:
    inputs = processor(images=pil_img, return_tensors="pt")
    pixel_values = inputs["pixel_values"]

    if stage_name not in _preprocess_stats_logged and len(_preprocess_stats_logged) < PREPROCESS_LOG_LIMIT:
        tensor = pixel_values.detach().cpu()
        print(
            f"[VisionQC] preprocess stats ({stage_name}) "
            f"shape={tuple(tensor.shape)} "
            f"min={float(tensor.min()):.4f} "
            f"max={float(tensor.max()):.4f} "
            f"mean={float(tensor.mean()):.4f} "
            f"std={float(tensor.std()):.4f}"
        )
        _preprocess_stats_logged.add(stage_name)

    return pixel_values


def infer_logits_with_tta(
    pil_img: Image.Image,
    model: AutoModelForImageClassification,
    processor,
    stage_name: str,
) -> torch.Tensor:
    views = [pil_img, pil_img.transpose(Image.FLIP_LEFT_RIGHT)]
    logits_sum = None

    with torch.no_grad():
        for idx, view in enumerate(views):
            pixel_values = preprocess_image(view, processor, f"{stage_name}_view_{idx}")
            out = model(pixel_values=pixel_values.to(device)).logits[0]
            logits_sum = out if logits_sum is None else logits_sum + out

    return logits_sum / len(views)


def build_top_predictions_from_probs(
    probs: torch.Tensor,
    class_indices: list[int],
    id2label: dict[int, str],
    k: int = TOP_K,
) -> list[dict]:
    if probs.numel() == 0:
        return []

    top_values, top_local_indices = torch.topk(probs, k=min(k, probs.shape[0]))
    result = []
    for score, local_idx in zip(top_values.tolist(), top_local_indices.tolist()):
        class_idx = class_indices[int(local_idx)]
        result.append(
            {
                "label": id2label.get(class_idx, str(class_idx)),
                "confidence": round(float(score), 3),
            }
        )
    return result


def rank_crop_scores(score_map: dict[str, float], k: int = TOP_K) -> tuple[list[dict], float]:
    ranked = sorted(score_map.items(), key=lambda item: item[1], reverse=True)
    top_confidence = float(ranked[0][1]) if ranked else 0.0
    preview = ranked[:k]
    predictions = [{"label": label, "confidence": round(float(score), 3)} for label, score in preview]
    return predictions, top_confidence


def normalize_score_map(score_map: dict[str, float]) -> dict[str, float]:
    positive_items = {key: float(value) for key, value in score_map.items() if float(value) > 0.0}
    total = sum(positive_items.values())
    if total <= 0.0:
        return {}
    return {key: value / total for key, value in positive_items.items()}


def infer_crop_scores_from_disease_logits(disease_logits: torch.Tensor) -> dict[str, float]:
    disease_probs = torch.softmax(disease_logits, dim=-1)
    crop_scores = {}
    for class_idx, prob in enumerate(disease_probs.tolist()):
        crop = DISEASE_CLASS_TO_CROP.get(class_idx)
        if crop:
            crop_scores[crop] = crop_scores.get(crop, 0.0) + float(prob)
    return crop_scores


def infer_crop_scores_from_crop_model(pil_img: Image.Image) -> dict[str, float]:
    if not crop_model or not crop_processor:
        return {}

    crop_logits = infer_logits_with_tta(pil_img, crop_model, crop_processor, "crop")
    crop_probs = torch.softmax(crop_logits, dim=-1)
    crop_scores = {}

    for class_idx, prob in enumerate(crop_probs.tolist()):
        label = CROP_ID2LABEL.get(class_idx, str(class_idx))
        crop = canonicalize_crop_name(label.replace("_", " "))
        if crop:
            crop_scores[crop] = crop_scores.get(crop, 0.0) + float(prob)

    return crop_scores


def infer_crop_predictions(
    pil_img: Image.Image, disease_logits: torch.Tensor
) -> tuple[list[dict], dict[str, float], str]:
    if crop_model and crop_processor:
        crop_scores = normalize_score_map(infer_crop_scores_from_crop_model(pil_img))
        if crop_scores:
            predictions, _ = rank_crop_scores(crop_scores, TOP_K)
            return predictions, crop_scores, CROP_STAGE_SOURCE

    fallback_scores = normalize_score_map(infer_crop_scores_from_disease_logits(disease_logits))
    predictions, _ = rank_crop_scores(fallback_scores, TOP_K)
    return predictions, fallback_scores, "disease_derived"


def infer_open_world_crop_predictions(pil_img: Image.Image) -> tuple[list[dict], dict | None]:
    if not open_world_crop_model or not open_world_crop_processor:
        return [], None

    text_prompts = [f"a photo of a {label} plant" for label in OPEN_WORLD_CROP_LABELS]
    inputs = open_world_crop_processor(text=text_prompts, images=pil_img, return_tensors="pt", padding=True)
    inputs = {key: value.to(device) for key, value in inputs.items()}

    with torch.no_grad():
        outputs = open_world_crop_model(**inputs)
        logits = outputs.logits_per_image[0]
        probs = torch.softmax(logits, dim=-1)

    top_values, top_indices = torch.topk(probs, k=min(OPEN_WORLD_TOP_K, probs.shape[0]))
    predictions = []
    for score, idx in zip(top_values.tolist(), top_indices.tolist()):
        label = OPEN_WORLD_CROP_LABELS[int(idx)]
        predictions.append({"label": label, "confidence": round(float(score), 3)})

    return predictions, (predictions[0] if predictions else None)


def blend_crop_scores_with_open_world_hint(
    crop_scores: dict[str, float],
    inferred_crop_hint: str | None,
    inferred_crop_confidence: float,
) -> dict[str, float]:
    if not inferred_crop_hint:
        return crop_scores

    blended = dict(crop_scores)
    hint_score = max(0.0, min(1.0, float(inferred_crop_confidence) * OPEN_WORLD_HINT_BLEND_WEIGHT))
    blended[inferred_crop_hint] = max(float(blended.get(inferred_crop_hint, 0.0)), hint_score)
    return normalize_score_map(blended)


# Grad-CAM works best if the model forward returns logits tensor
class LogitsWrapper(torch.nn.Module):
    def __init__(self, m: torch.nn.Module):
        super().__init__()
        self.m = m

    def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
        return self.m(pixel_values=pixel_values).logits  # [B, num_classes]


cam_model = LogitsWrapper(disease_model)
cam_model.eval()


def pick_target_layer(m: torch.nn.Module) -> torch.nn.Module:
    conv_layers = [layer for layer in m.modules() if isinstance(layer, torch.nn.Conv2d)]
    if not conv_layers:
        raise RuntimeError("No Conv2d layers found for Grad-CAM.")
    return conv_layers[-1]


TARGET_LAYER = pick_target_layer(cam_model)


def build_treatment_advice(model_label: str, confidence: float) -> str:
    normalized = compact_key(model_label)
    confidence_text = f"Model confidence: {round(confidence * 100)}%."

    if any(k in normalized for k in ["healthy", "normal"]):
        return (
            f"Plant appears healthy. {confidence_text} "
            "Maintain regular watering, good airflow, and weekly monitoring. "
            "Avoid overhead watering at night to reduce fungal risk."
        )

    disease_guidance = [
        (
            ["powdery_mildew", "mildew"],
            "Remove infected leaves, improve airflow, avoid wet foliage, and apply a sulfur or potassium-bicarbonate fungicide.",
        ),
        (
            ["leaf_mold", "mold"],
            "Prune dense foliage, keep humidity lower, water at soil level, and apply a labeled fungicide if spread continues.",
        ),
        (
            ["early_blight", "late_blight", "blight"],
            "Remove affected leaves, rotate crops, avoid leaf wetness, and apply a copper/chlorothalonil fungicide as directed.",
        ),
        (
            ["rust"],
            "Remove infected leaves, increase spacing and airflow, and use a fungicide labeled for rust if symptoms progress.",
        ),
        (
            ["septoria", "leaf_spot", "spot"],
            "Discard heavily spotted leaves, avoid overhead irrigation, sanitize tools, and use a suitable protectant fungicide.",
        ),
        (
            ["bacterial_spot", "bacterial"],
            "Remove infected tissue, disinfect tools, avoid splash irrigation, and use copper-based bactericide where permitted.",
        ),
        (
            ["scab"],
            "Prune and remove infected parts, clean fallen debris, improve airflow, and apply preventive fungicide during high-risk periods.",
        ),
        (
            ["mosaic_virus", "yellow_leaf_curl_virus", "virus"],
            "No curative treatment for viral infection. Isolate and remove infected plants, control vectors (aphids/whiteflies), and sanitize tools.",
        ),
    ]

    for keywords, guidance in disease_guidance:
        if any(keyword in normalized for keyword in keywords):
            return f"{guidance} {confidence_text}"

    return (
        "Remove severely affected tissue, keep foliage dry, improve airflow, and monitor daily. "
        "Use a crop-appropriate fungicide/bactericide only according to local label instructions. "
        f"{confidence_text}"
    )


def make_gradcam(pil_img: Image.Image, class_idx: int) -> str:
    pixel_values = preprocess_image(pil_img, disease_processor, "disease_gradcam").to(device)

    cam = GradCAM(model=cam_model, target_layers=[TARGET_LAYER])
    targets = [ClassifierOutputTarget(class_idx)]
    grayscale_cam = cam(input_tensor=pixel_values, targets=targets)[0]  # HxW

    height = pixel_values.shape[-2]
    width = pixel_values.shape[-1]
    rgb = np.array(pil_img.resize((width, height)))
    rgb_float = rgb.astype(np.float32) / 255.0

    heatmap = show_cam_on_image(rgb_float, grayscale_cam, use_rgb=True)

    heatmap_bgr = cv2.cvtColor(heatmap, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".png", heatmap_bgr)
    if not ok:
        return ""
    return base64.b64encode(buf.tobytes()).decode("utf-8")


# -------------------------
# Image quality gate
# -------------------------
def image_quality_score(bgr: np.ndarray) -> tuple[float, dict]:
    h, w = bgr.shape[:2]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    blur_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(np.mean(gray))
    min_side = min(h, w)

    score = 1.0
    if min_side < 256:
        score *= 0.6
    if brightness < 40 or brightness > 220:
        score *= 0.65
    if blur_var < 80:
        score *= 0.55
    elif blur_var < 150:
        score *= 0.75

    details = {
        "width": w,
        "height": h,
        "brightness": round(brightness, 2),
        "blur_var": round(blur_var, 2),
        "quality_score": round(score, 3),
    }
    return score, details


def retake_response(reason: str, quality: dict):
    return {
        "label": "retake_photo",
        "confidence": 0.0,
        "suggested_sc": (
            f"Low image quality ({reason}). Retake the photo with good lighting and sharp focus. "
            "Keep the leaf centered and close."
        ),
        "quality": quality,
        "mode": "quality_gate",
    }


def unknown_crop_response(crop_predictions: list[dict], quality: dict, crop_confidence: float | None = None):
    top_crop_text = ", ".join(
        f"{item['label']} ({int(item['confidence'] * 100)}%)" for item in crop_predictions
    )
    if not top_crop_text:
        top_crop_text = "no reliable crop match"

    return {
        "label": "unknown_crop",
        "confidence": round(float(crop_confidence), 3) if crop_confidence is not None else 0.0,
        "suggested_sc": (
            "Unknown crop / retake photo. "
            "Capture a single leaf in daylight, fill most of the frame, and avoid clutter. "
            f"Crop candidates: {top_crop_text}."
        ),
        "crop_predictions": crop_predictions,
        "quality": quality,
        "mode": "crop_gate_unknown",
    }


def normalize_crop_hint(crop_hint: str | None) -> str | None:
    if crop_hint is None:
        return None
    normalized = canonicalize_crop_name(str(crop_hint))
    return normalized


def unsupported_crop_response(crop_name: str, quality: dict, open_world_predictions: list[dict] | None = None):
    response = {
        "label": "unsupported_crop",
        "confidence": 0.0,
        "suggested_sc": (
            f"Crop '{crop_name}' is not supported by the current disease model. "
            "Use a supported crop model or retrain with this crop."
        ),
        "crop": crop_name,
        "supported_crops": SUPPORTED_CROPS,
        "quality": quality,
        "mode": "unsupported_crop",
    }
    if open_world_predictions:
        response["open_world_crop_predictions"] = open_world_predictions
    return response


def invalid_crop_hint_response(crop_hint: str, quality: dict):
    return {
        "label": "invalid_crop_hint",
        "confidence": 0.0,
        "suggested_sc": (
            f"Crop hint '{crop_hint}' is not recognized. "
            "Use a supported crop name."
        ),
        "supported_crops": SUPPORTED_CROPS,
        "quality": quality,
        "mode": "crop_hint_invalid",
    }


def crop_filter_disease_probs(disease_logits: torch.Tensor, crop_name: str) -> tuple[torch.Tensor | None, list[int]]:
    allowed_class_indices = CROP_TO_DISEASE_CLASS_INDICES.get(crop_name, [])
    if not allowed_class_indices:
        return None, []

    index_tensor = torch.tensor(allowed_class_indices, device=disease_logits.device, dtype=torch.long)
    cropped_logits = disease_logits.index_select(0, index_tensor)
    cropped_probs = torch.softmax(cropped_logits, dim=-1)
    return cropped_probs, allowed_class_indices


def blend_disease_probs_with_crop_prior(
    disease_logits: torch.Tensor, crop_scores: dict[str, float]
) -> tuple[torch.Tensor, list[int], dict]:
    disease_probs = torch.softmax(disease_logits, dim=-1)
    class_indices = list(range(int(disease_probs.shape[0])))

    if not crop_scores:
        return disease_probs, class_indices, {
            "method": "raw_disease_probs",
            "applied": False,
            "reason": "no_crop_scores",
            "strength": 0.0,
        }

    top_crop, top_crop_confidence = max(crop_scores.items(), key=lambda item: item[1])
    top_crop_confidence = float(top_crop_confidence)
    if top_crop_confidence < CROP_PRIOR_MIN_CONF:
        return disease_probs, class_indices, {
            "method": "raw_disease_probs",
            "applied": False,
            "reason": "crop_confidence_too_low",
            "strength": 0.0,
            "top_crop": top_crop,
            "top_crop_confidence": round(top_crop_confidence, 3),
        }

    strength = max(0.0, min(1.0, CROP_PRIOR_STRENGTH * top_crop_confidence))
    if strength <= 0.0:
        return disease_probs, class_indices, {
            "method": "raw_disease_probs",
            "applied": False,
            "reason": "zero_strength",
            "strength": 0.0,
        }

    prior = torch.ones_like(disease_probs)
    for class_idx in class_indices:
        crop_name = DISEASE_CLASS_TO_CROP.get(class_idx)
        if not crop_name:
            continue
        crop_prob = float(crop_scores.get(crop_name, 0.0))
        prior[class_idx] = max(CROP_PRIOR_FLOOR, crop_prob)

    blended = disease_probs * torch.pow(prior, strength)
    normalization = float(blended.sum().item())
    if normalization <= 0.0:
        return disease_probs, class_indices, {
            "method": "raw_disease_probs",
            "applied": False,
            "reason": "invalid_normalization",
            "strength": round(strength, 3),
        }

    blended = blended / blended.sum()
    return blended, class_indices, {
        "method": "soft_crop_prior",
        "applied": True,
        "strength": round(strength, 3),
        "top_crop": top_crop,
        "top_crop_confidence": round(top_crop_confidence, 3),
    }


# -------------------------
# Predict endpoint
# -------------------------
@app.post("/predict")
async def predict(image: UploadFile = File(...), crop_hint: str | None = Form(None)):
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        return {
            "label": "invalid_image",
            "confidence": 0.0,
            "suggested_sc": "Upload a JPG/PNG/WEBP image.",
            "mode": "reject",
        }

    contents = await image.read()
    if not contents:
        return {
            "label": "invalid_image",
            "confidence": 0.0,
            "suggested_sc": "Empty file. Please upload a valid image.",
            "mode": "reject",
        }

    # Validate and load image as RGB to avoid BGR/RGB mismatch.
    try:
        pil = Image.open(BytesIO(contents))
        pil.verify()
        pil = Image.open(BytesIO(contents)).convert("RGB")
    except Exception:
        return {
            "label": "invalid_image",
            "confidence": 0.0,
            "suggested_sc": "Invalid image file. Try another photo.",
            "mode": "reject",
        }

    # Quality gate.
    rgb = np.array(pil)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    q_score, q_details = image_quality_score(bgr)
    if q_score < QUALITY_GATE_THRESHOLD:
        return retake_response("blurry/dark/low-resolution", q_details)

    # Optional explicit crop hint and open-world crop sanity check.
    user_crop_hint = normalize_crop_hint(crop_hint)
    if crop_hint and not user_crop_hint:
        return invalid_crop_hint_response(crop_hint, q_details)

    inferred_crop_hint = None
    inferred_crop_confidence = 0.0
    open_world_unsupported_candidate = None
    open_world_predictions = []
    if open_world_crop_model and open_world_crop_processor:
        open_world_predictions, open_world_top = infer_open_world_crop_predictions(pil)
        if not user_crop_hint and open_world_top:
            top_label = str(open_world_top.get("label", "")).strip()
            top_confidence = float(open_world_top.get("confidence", 0.0))
            top_canonical = canonicalize_crop_name(top_label)
            second_confidence = (
                float(open_world_predictions[1].get("confidence", 0.0)) if len(open_world_predictions) > 1 else 0.0
            )
            top_margin = max(0.0, top_confidence - second_confidence)

            if top_canonical and top_canonical in CROP_TO_DISEASE_CLASS_INDICES:
                if top_confidence >= OPEN_WORLD_USE_AS_HINT_CONF:
                    inferred_crop_hint = top_canonical
                    inferred_crop_confidence = top_confidence
            elif top_confidence >= OPEN_WORLD_MIN_UNSUPPORTED_CONF and top_margin >= OPEN_WORLD_UNSUPPORTED_MARGIN:
                open_world_unsupported_candidate = top_canonical or top_label

    if user_crop_hint and user_crop_hint not in CROP_TO_DISEASE_CLASS_INDICES:
        return unsupported_crop_response(user_crop_hint, q_details, open_world_predictions)

    # Stage 1: disease logits.
    disease_logits = infer_logits_with_tta(pil, disease_model, disease_processor, "disease")
    raw_disease_probs = torch.softmax(disease_logits, dim=-1)
    raw_class_indices = list(range(int(raw_disease_probs.shape[0])))

    # Stage 2: crop prediction + optional user/open-world hint.
    crop_predictions, crop_scores, crop_source = infer_crop_predictions(pil, disease_logits)
    if inferred_crop_hint:
        crop_scores = blend_crop_scores_with_open_world_hint(crop_scores, inferred_crop_hint, inferred_crop_confidence)
        crop_predictions, _ = rank_crop_scores(crop_scores, TOP_K)
        crop_source = f"{crop_source}+open_world_hint"

    if STRICT_CROP_GATE and not crop_predictions:
        return unknown_crop_response(crop_predictions, q_details)

    crop_name = user_crop_hint or inferred_crop_hint or (crop_predictions[0]["label"] if crop_predictions else "")
    crop_confidence = (
        float(crop_scores.get(user_crop_hint, 0.0))
        if user_crop_hint
        else (
            float(crop_scores.get(inferred_crop_hint, inferred_crop_confidence))
            if inferred_crop_hint
            else (float(crop_predictions[0]["confidence"]) if crop_predictions else 0.0)
        )
    )
    if (
        not user_crop_hint
        and open_world_unsupported_candidate
        and not inferred_crop_hint
        and crop_confidence < CROP_CONFIDENCE_THRESHOLD
    ):
        return unsupported_crop_response(open_world_unsupported_candidate, q_details, open_world_predictions)

    if crop_name and crop_name not in CROP_TO_DISEASE_CLASS_INDICES:
        return unsupported_crop_response(crop_name, q_details, open_world_predictions)

    if STRICT_CROP_GATE and crop_confidence < CROP_CONFIDENCE_THRESHOLD:
        return unknown_crop_response(crop_predictions, q_details, crop_confidence)

    # Stage 3: disease decision with robust crop integration.
    selected_probs = raw_disease_probs
    selected_class_indices = raw_class_indices
    inference_strategy = {
        "method": "raw_disease_probs",
        "applied": False,
        "reason": "default",
    }

    if user_crop_hint:
        gated_probs, gated_class_indices = crop_filter_disease_probs(disease_logits, user_crop_hint)
        if gated_probs is not None:
            selected_probs = gated_probs
            selected_class_indices = gated_class_indices
            inference_strategy = {
                "method": "user_crop_hint_gate",
                "applied": True,
                "top_crop": user_crop_hint,
                "top_crop_confidence": round(crop_confidence, 3),
            }
        else:
            return unsupported_crop_response(user_crop_hint, q_details, open_world_predictions)
    elif ENABLE_HARD_CROP_GATE and not inferred_crop_hint and crop_name and crop_confidence >= HARD_CROP_GATE_MIN_CONF:
        gated_probs, gated_class_indices = crop_filter_disease_probs(disease_logits, crop_name)
        if gated_probs is not None:
            selected_probs = gated_probs
            selected_class_indices = gated_class_indices
            inference_strategy = {
                "method": "hard_crop_gate",
                "applied": True,
                "top_crop": crop_name,
                "top_crop_confidence": round(crop_confidence, 3),
            }
        elif STRICT_CROP_GATE:
            return unknown_crop_response(crop_predictions, q_details, crop_confidence)
    else:
        selected_probs, selected_class_indices, inference_strategy = blend_disease_probs_with_crop_prior(
            disease_logits, crop_scores
        )
        if inferred_crop_hint:
            inference_strategy = {
                **inference_strategy,
                "open_world_hint": inferred_crop_hint,
                "open_world_hint_confidence": round(inferred_crop_confidence, 3),
            }

    best_local_idx = int(torch.argmax(selected_probs))
    class_idx = int(selected_class_indices[best_local_idx])
    confidence = float(selected_probs[best_local_idx])
    model_label = DISEASE_ID2LABEL.get(class_idx, str(class_idx))

    top_predictions = build_top_predictions_from_probs(
        selected_probs,
        selected_class_indices,
        DISEASE_ID2LABEL,
        TOP_K,
    )
    raw_top_predictions = build_top_predictions_from_probs(
        raw_disease_probs,
        raw_class_indices,
        DISEASE_ID2LABEL,
        TOP_K,
    )

    top_values, _ = torch.topk(selected_probs, k=min(2, selected_probs.shape[0]))
    top2_margin = float(top_values[0] - top_values[1]) if top_values.shape[0] > 1 else float(top_values[0])

    gradcam_b64 = make_gradcam(pil, class_idx)

    if confidence < LOW_CONFIDENCE_THRESHOLD or top2_margin < LOW_MARGIN_THRESHOLD:
        top_summary = ", ".join(f"{item['label']} ({int(item['confidence'] * 100)}%)" for item in top_predictions)
        if not top_summary:
            top_summary = "no reliable class"
        return {
            "label": "uncertain_prediction",
            "confidence": round(confidence, 3),
            "suggested_sc": (
                "The model is not confident enough to give a reliable diagnosis. "
                f"Top candidates: {top_summary}. "
                "Upload a closer image of a single affected leaf in good daylight, and avoid blur."
            ),
            "crop": crop_name or None,
            "crop_confidence": round(crop_confidence, 3),
            "crop_gate_source": crop_source,
            "crop_hint": user_crop_hint,
            "inferred_crop_hint": inferred_crop_hint,
            "inferred_crop_confidence": round(inferred_crop_confidence, 3) if inferred_crop_hint else None,
            "open_world_crop_predictions": open_world_predictions,
            "crop_predictions": crop_predictions,
            "raw_top_predictions": raw_top_predictions,
            "top_predictions": top_predictions,
            "inference_strategy": inference_strategy,
            "gradcam_png_base64": gradcam_b64,
            "quality": q_details,
            "mode": "vision_gradcam_uncertain",
        }

    return {
        "label": model_label,
        "confidence": round(confidence, 3),
        "suggested_sc": build_treatment_advice(model_label, confidence),
        "crop": crop_name or None,
        "crop_confidence": round(crop_confidence, 3),
        "crop_gate_source": crop_source,
        "crop_hint": user_crop_hint,
        "inferred_crop_hint": inferred_crop_hint,
        "inferred_crop_confidence": round(inferred_crop_confidence, 3) if inferred_crop_hint else None,
        "open_world_crop_predictions": open_world_predictions,
        "crop_predictions": crop_predictions,
        "raw_top_predictions": raw_top_predictions,
        "top_predictions": top_predictions,
        "inference_strategy": inference_strategy,
        "gradcam_png_base64": gradcam_b64,
        "quality": q_details,
        "mode": "vision_gradcam",
    }


# -------------------------
# Additional Endpoints for Predictions & Retraining Queue
# -------------------------

@app.post("/api/analyze")
async def analyze_image(
    image: UploadFile = File(...),
    crop_hint: str | None = Form(None),
    user_id: int | None = Form(None)
):
    """
    Analyze image and store prediction to database.
    This is the main endpoint called by the frontend.
    """
    # First, run the prediction using the existing logic
    prediction_response = await predict(image, crop_hint)
    
    # If user_id is provided, store to database
    if user_id is not None and user_id > 0:
        try:
            # Store image first (in a real scenario, this would be the actual uploaded file)
            image_path = f"uploads/{user_id}/{image.filename}"
            image_id = store_image(user_id, image_path)
            
            if image_id:
                # Store the prediction
                confidence = prediction_response.get("confidence", 0.0)
                label = prediction_response.get("label", "unknown")
                suggested_sc = prediction_response.get("suggested_sc")
                heatmap_url = prediction_response.get("heatmap_url")
                
                prediction_id = store_prediction(
                    user_id=user_id,
                    image_id=image_id,
                    label=label,
                    confidence=float(confidence),
                    heatmap_url=heatmap_url,
                    suggested_sc=suggested_sc,
                )
                
                if prediction_id:
                    prediction_response["prediction_id"] = prediction_id
                    prediction_response["image_id"] = image_id
                    
                    # Auto-flag if confidence < 70%
                    if float(confidence) < 0.7:
                        queue_id = flag_prediction_for_retraining(
                            prediction_id=prediction_id,
                            user_id=user_id,
                            confidence_score=float(confidence),
                            reason="Low confidence prediction - auto-flagged"
                        )
                        if queue_id:
                            prediction_response["flagged_for_retraining"] = True
                            prediction_response["queue_id"] = queue_id
        except Exception as e:
            print(f"Error storing prediction: {e}")
            # Still return the prediction even if storage fails
    
    return prediction_response


@app.post("/api/predictions/{prediction_id}/flag-for-retraining")
async def flag_for_retraining(
    prediction_id: int,
    user_id: int = Form(...),
    reason: str | None = Form(None)
):
    """
    Flag a prediction for admin retraining.
    User must have score < 70% to flag.
    """
    # Get prediction details
    pred_details = get_prediction_with_details(prediction_id)
    if not pred_details:
        raise HTTPException(status_code=404, detail="Prediction not found")
    
    confidence = float(pred_details.get("confidence", 0.0))
    
    # Only allow flagging of low-confidence predictions
    if confidence >= 0.7:
        raise HTTPException(
            status_code=400,
            detail="Only predictions with confidence < 70% can be flagged for retraining"
        )
    
    queue_id = flag_prediction_for_retraining(
        prediction_id=prediction_id,
        user_id=user_id,
        confidence_score=confidence,
        reason=reason or "User flagged for retraining"
    )
    
    if not queue_id:
        raise HTTPException(status_code=500, detail="Failed to flag prediction")
    
    return {
        "success": True,
        "queue_id": queue_id,
        "message": "Prediction flagged for retraining"
    }


@app.get("/api/admin/retraining-queue")
async def get_retraining_queue_admin(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str = Query("PENDING", regex="^(PENDING|APPROVED|REJECTED)$")
):
    """
    Get retraining queue for admin review.
    Requires admin authentication in production.
    """
    queue_data = get_retraining_queue(page=page, per_page=per_page, status=status)
    return queue_data


@app.patch("/api/admin/retraining-queue/{queue_id}")
async def update_retraining_queue_item(
    queue_id: int,
    status: str = Form(..., regex="^(APPROVED|REJECTED|CANCELLED)$"),
    admin_id: int | None = Form(None),
    admin_notes: str | None = Form(None)
):
    """
    Update retraining queue item status.
    Admin approves or rejects retraining requests.
    """
    success = update_retraining_request(
        queue_id=queue_id,
        status=status,
        admin_id=admin_id,
        admin_notes=admin_notes
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Retraining request not found")
    
    return {
        "success": True,
        "message": f"Retraining request {status.lower()}"
    }


@app.get("/api/predictions/{prediction_id}")
async def get_prediction_details_endpoint(prediction_id: int):
    """
    Get full prediction details including image and user info.
    """
    pred_details = get_prediction_with_details(prediction_id)
    if not pred_details:
        raise HTTPException(status_code=404, detail="Prediction not found")
    
    return pred_details


@app.get("/api/users/{user_id}/history")
async def get_user_prediction_history(
    user_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
):
    """
    Get user's prediction history.
    """
    history = get_user_history(user_id=user_id, page=page, per_page=per_page)
    return history


@app.get("/api/admin/low-confidence-predictions")
async def get_low_confidence(
    threshold: float = Query(0.7, ge=0.0, le=1.0),
    limit: int = Query(100, ge=1, le=500)
):
    """
    Get predictions below confidence threshold for admin review.
    Useful for identifying patterns in model performance.
    """
    predictions = get_low_confidence_predictions(threshold=threshold, limit=limit)
    return {
        "threshold": threshold,
        "count": len(predictions),
        "predictions": predictions
    }
