try:
    from fastapi import FastAPI, File, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
except ModuleNotFoundError as exc:
    raise ModuleNotFoundError(
        "fastapi is required. Install with `pip install fastapi uvicorn`."
    ) from exc

try:
    from PIL import Image
except ModuleNotFoundError as exc:
    raise ModuleNotFoundError(
        "Pillow is required. Install with `pip install pillow`."
    ) from exc
from io import BytesIO
import random

app = FastAPI(title="VisionQC Predictor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LABELS = [
    "healthy",
    "powdery_mildew",
    "leaf_spot",
    "rust",
    "blight"
]

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        return {"label": "invalid_image", "confidence": 0.0}

    contents = await image.read()
    if not contents:
        return {"label": "unknown", "confidence": 0.0}

    try:
        Image.open(BytesIO(contents)).verify()
    except Exception:
        return {"label": "invalid_image", "confidence": 0.0}

    label = random.choice(LABELS)
    confidence = round(random.uniform(0.6, 0.98), 3)

    return {"label": label, "confidence": confidence}
