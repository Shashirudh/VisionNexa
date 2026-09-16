"""Core configuration settings for VisionNexa."""
from pathlib import Path
import os
import torch

BASE_DIR = Path(__file__).resolve().parent.parent.parent
WEIGHTS_DIR = BASE_DIR / "weights"

# Application Settings
PROJECT_NAME = "VisionNexa"
PROJECT_VERSION = "0.1.0"
DESCRIPTION = "Explainable AI System for Diabetic Retinopathy Screening in Rural India"

# Server Settings
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

# Model & Explainability Settings
MODEL_WEIGHTS_FILE = os.getenv("MODEL_WEIGHTS_FILE", "drishtiAI_efficientnet_b0.pth")
_custom_weights_path = os.getenv("MODEL_WEIGHTS_PATH")
DEFAULT_WEIGHTS_PATH = (
    Path(_custom_weights_path) if _custom_weights_path else (WEIGHTS_DIR / MODEL_WEIGHTS_FILE)
)
MODEL_WEIGHTS_URL = os.getenv("MODEL_WEIGHTS_URL", "").strip()


def ensure_weights_available() -> bool:
    """
    Ensures model weights exist on disk at DEFAULT_WEIGHTS_PATH.
    If the file is absent and MODEL_WEIGHTS_URL is provided, downloads it.
    Returns True if weights are available on disk, False otherwise.
    """
    if DEFAULT_WEIGHTS_PATH.exists():
        return True

    if not MODEL_WEIGHTS_URL:
        return False

    import urllib.request
    DEFAULT_WEIGHTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp_dest = DEFAULT_WEIGHTS_PATH.with_suffix(".tmp")
    try:
        urllib.request.urlretrieve(MODEL_WEIGHTS_URL, temp_dest)
        if temp_dest.exists() and temp_dest.stat().st_size > 0:
            temp_dest.replace(DEFAULT_WEIGHTS_PATH)
            return True
    except Exception:
        if temp_dest.exists():
            temp_dest.unlink()
        raise
    return False

# Device Selection: CUDA if available, otherwise CPU
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Diabetic Retinopathy Classification Settings
NUM_CLASSES = 5
DR_CLASSES = {
    0: "No DR",
    1: "Mild DR",
    2: "Moderate DR",
    3: "Severe DR",
    4: "Proliferative DR",
}

# Image Preprocessing Constants (224x224)
IMAGE_SIZE = (224, 224)
IMAGE_MEAN = [0.485, 0.456, 0.406]
IMAGE_STD = [0.229, 0.224, 0.225]
