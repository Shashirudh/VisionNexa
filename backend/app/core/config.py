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
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

# Model & Explainability Settings
MODEL_WEIGHTS_FILE = os.getenv("MODEL_WEIGHTS_FILE", "drishtiAI_efficientnet_b0.pth")
DEFAULT_WEIGHTS_PATH = WEIGHTS_DIR / MODEL_WEIGHTS_FILE

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
