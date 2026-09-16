"""PyTorch model definitions and loader module for Diabetic Retinopathy classification."""
from pathlib import Path
from typing import Optional
import os
import torch
import torch.nn as nn
import torchvision.models as models

from app.core.config import DEFAULT_WEIGHTS_PATH, DEVICE, NUM_CLASSES


def build_efficientnet_b0(num_classes: int = NUM_CLASSES) -> nn.Module:
    """
    Constructs an EfficientNet-B0 model with a custom classifier head
    configured for 5-class Diabetic Retinopathy severity classification.
    """
    model = models.efficientnet_b0(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    return model


def load_model(
    weights_path: Optional[Path] = None,
    device: Optional[torch.device] = None,
) -> nn.Module:
    """
    Loads the trained EfficientNet-B0 weights from the specified path
    and transfers the model to the target device (CUDA or CPU).
    """
    path = Path(weights_path) if weights_path else DEFAULT_WEIGHTS_PATH
    dev = device if device is not None else DEVICE

    if not path.exists():
        raise FileNotFoundError(
            f"Trained model weights file not found at: {path}. "
            f"Please ensure drishtiAI_efficientnet_b0.pth exists in backend/weights/."
        )

    model = build_efficientnet_b0(num_classes=NUM_CLASSES)
    
    # Load weights with map_location
    state_dict = torch.load(path, map_location=dev)
    model.load_state_dict(state_dict)
    
    model.to(dev)
    model.eval()
    return model
