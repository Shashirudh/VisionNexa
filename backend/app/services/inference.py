"""Inference and explainability service for retinal fundus screening using PyTorch EfficientNet-B0."""
from io import BytesIO
from typing import Any, Dict, Optional
from PIL import Image
import torch
import torchvision.transforms as transforms

from app.core.config import DEVICE, DR_CLASSES, IMAGE_MEAN, IMAGE_SIZE, IMAGE_STD
from app.models.model_loader import load_model
from app.explainability.gradcam import GradCAMExplainer


class ScreeningService:
    """
    Service coordinating 224x224 retinal fundus image preprocessing,
    real PyTorch model forward pass inference, and Grad-CAM explainability.
    """

    def __init__(self, model: Optional[torch.nn.Module] = None, device: Optional[torch.device] = None):
        self.device = device if device is not None else DEVICE
        self.model = model
        self.is_loaded = model is not None
        self.explainer: Optional[GradCAMExplainer] = (
            GradCAMExplainer(self.model) if self.model is not None else None
        )

        # Preprocessing pipeline: 224x224 resize, ToTensor, ImageNet normalization
        self.transform = transforms.Compose([
            transforms.Resize(IMAGE_SIZE),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGE_MEAN, std=IMAGE_STD),
        ])

    def load_weights(self, weights_path: Optional[str] = None):
        """Loads or reloads the trained model weights and initializes Grad-CAM explainer."""
        self.model = load_model(weights_path=weights_path, device=self.device)
        self.explainer = GradCAMExplainer(self.model)
        self.is_loaded = True

    def preprocess_image(self, image_bytes: bytes) -> torch.Tensor:
        """
        Loads image bytes as RGB and applies the 224x224 preprocessing transform.
        Returns a batch tensor [1, 3, 224, 224] on the designated device.
        """
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        tensor = self.transform(image).unsqueeze(0).to(self.device)
        return tensor

    def predict(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Executes real forward pass through the trained EfficientNet-B0 model.
        Returns real predicted class, confidence, and class-wise probabilities.
        """
        if not self.is_loaded or self.model is None:
            raise RuntimeError(
                "Model is not loaded. Please call load_weights() before running inference."
            )

        tensor = self.preprocess_image(image_bytes)

        with torch.no_grad():
            logits = self.model(tensor)
            probabilities = torch.softmax(logits, dim=1)[0]
            pred_class_id = int(torch.argmax(probabilities).item())
            confidence = float(probabilities[pred_class_id].item())

        return {
            "predicted_class_id": pred_class_id,
            "predicted_class_name": DR_CLASSES.get(pred_class_id, f"Class {pred_class_id}"),
            "confidence": round(confidence, 4),
            "probabilities": {
                DR_CLASSES[i]: round(float(probabilities[i].item()), 4)
                for i in range(len(DR_CLASSES))
            },
            "device": str(self.device),
        }

    def explain(
        self,
        image_bytes: bytes,
        target_class: Optional[int] = None,
        alpha: float = 0.4,
    ) -> Dict[str, Any]:
        """
        Executes real Grad-CAM explainability and inference on the uploaded image.
        Returns prediction details, Grad-CAM heatmap, and overlay images.
        """
        if not self.is_loaded or self.explainer is None:
            raise RuntimeError(
                "Model/Explainer is not loaded. Please call load_weights() before requesting explanations."
            )

        image = Image.open(BytesIO(image_bytes))
        result = self.explainer.explain(image=image, target_class=target_class, alpha=alpha)
        return result
