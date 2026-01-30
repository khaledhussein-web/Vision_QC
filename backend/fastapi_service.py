from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from io import BytesIO
import numpy as np
import cv2
import base64
import torch

from transformers import AutoModelForImageClassification, AutoImageProcessor
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image

app = FastAPI(title="VisionQC Predictor (Vision + Grad-CAM)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

# -------------------------
# Model + processor (REAL)
# -------------------------
MODEL_ID = "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification"
processor = AutoImageProcessor.from_pretrained(MODEL_ID)

hf_model = AutoModelForImageClassification.from_pretrained(MODEL_ID)
hf_model.eval()


# Grad-CAM works best if the model forward returns logits tensor
class LogitsWrapper(torch.nn.Module):
    def __init__(self, m: torch.nn.Module):
        super().__init__()
        self.m = m

    def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
        return self.m(pixel_values=pixel_values).logits  # [B, num_classes]


cam_model = LogitsWrapper(hf_model)


def pick_target_layer(m: torch.nn.Module) -> torch.nn.Module:
    """Pick the last Conv2d layer (robust across different model wrappers)."""
    conv_layers = [layer for layer in m.modules() if isinstance(layer, torch.nn.Conv2d)]
    if not conv_layers:
        raise RuntimeError("No Conv2d layers found for Grad-CAM.")
    return conv_layers[-1]


TARGET_LAYER = pick_target_layer(hf_model)


def make_gradcam(pil_img: Image.Image, class_idx: int) -> str:
    """
    Returns a base64 PNG Grad-CAM overlay for the predicted class.
    """
    inputs = processor(images=pil_img, return_tensors="pt")
    pixel_values = inputs["pixel_values"]  # [1,3,H,W]

    cam = GradCAM(model=cam_model, target_layers=[TARGET_LAYER])
    targets = [ClassifierOutputTarget(class_idx)]
    grayscale_cam = cam(input_tensor=pixel_values, targets=targets)[0]  # HxW

    # Convert PIL to RGB float in [0,1] at model input size
    H = pixel_values.shape[-2]
    W = pixel_values.shape[-1]
    rgb = np.array(pil_img.resize((W, H)))
    rgb_float = rgb.astype(np.float32) / 255.0

    # Overlay heatmap on image
    heatmap = show_cam_on_image(rgb_float, grayscale_cam, use_rgb=True)

    # Encode as PNG base64
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


# -------------------------
# Predict endpoint
# -------------------------
@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    # Validate content type
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

    # Validate & load image
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

    # Quality gate
    rgb = np.array(pil)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    q_score, q_details = image_quality_score(bgr)
    if q_score < 0.7:
        return retake_response("blurry/dark/low-resolution", q_details)

    # Prediction (no gradients)
    inputs = processor(images=pil, return_tensors="pt")
    with torch.no_grad():
        out = hf_model(**inputs)
        probs = torch.softmax(out.logits, dim=-1)[0]
        class_idx = int(torch.argmax(probs))
        confidence = float(probs[class_idx])

    model_label = hf_model.config.id2label[class_idx]

    # Grad-CAM (needs gradients)
    gradcam_b64 = make_gradcam(pil, class_idx)

    return {
        "label": model_label,
        "confidence": round(confidence, 3),
        "gradcam_png_base64": gradcam_b64,
        "quality": q_details,
        "mode": "vision_gradcam",
    }
