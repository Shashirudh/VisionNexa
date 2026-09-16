"""Grad-CAM (Gradient-weighted Class Activation Mapping) explainability module.

Generates visual heatmaps overlaying retinal fundus images to highlight
regions contributing to Diabetic Retinopathy severity predictions in EfficientNet-B0.
"""
import base64
from io import BytesIO
from typing import Any, Dict, Optional, Tuple
import numpy as np
from PIL import Image
import torch
import torchvision.transforms as transforms

from app.core.config import DR_CLASSES, IMAGE_MEAN, IMAGE_SIZE, IMAGE_STD


def apply_jet_colormap(normalized_cam: np.ndarray) -> np.ndarray:
    """
    Applies standard Jet colormap to a 2D float array in [0, 1].
    Returns an RGB uint8 array of shape (H, W, 3).
    """
    v = np.clip(normalized_cam, 0.0, 1.0)
    r = np.clip(1.5 - np.abs(4.0 * v - 3.0), 0.0, 1.0)
    g = np.clip(1.5 - np.abs(4.0 * v - 2.0), 0.0, 1.0)
    b = np.clip(1.5 - np.abs(4.0 * v - 1.0), 0.0, 1.0)
    rgb = np.stack([r, g, b], axis=-1)
    return (rgb * 255.0).astype(np.uint8)


def pil_to_base64_data_uri(img: Image.Image, format: str = "PNG") -> str:
    """Encodes a PIL Image into a base64 Data URI string."""
    buffered = BytesIO()
    img.save(buffered, format=format)
    encoded = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/{format.lower()};base64,{encoded}"


class GradCAMExplainer:
    """
    Real Grad-CAM implementation for PyTorch EfficientNet-B0.
    Target layer: Final convolutional block `model.features[-1]`.
    """

    def __init__(self, model: torch.nn.Module, target_layer: Optional[torch.nn.Module] = None):
        self.model = model
        # Default to the final convolutional block of EfficientNet-B0 (features[-1])
        if target_layer is not None:
            self.target_layer = target_layer
        else:
            self.target_layer = self.model.features[-1]

        self.target_layer_name = "model.features[-1] (Conv2dNormActivation)"
        self.activations: Optional[torch.Tensor] = None
        self.gradients: Optional[torch.Tensor] = None

        # Preprocessing pipeline identical to training & inference
        self.transform = transforms.Compose([
            transforms.Resize(IMAGE_SIZE),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGE_MEAN, std=IMAGE_STD),
        ])

    def _save_activations(self, module, input, output):
        self.activations = output

    def _save_gradients(self, module, grad_input, grad_output):
        # grad_output is a tuple; first element contains gradients w.r.t layer output
        self.gradients = grad_output[0]

    def explain(
        self,
        image: Image.Image,
        target_class: Optional[int] = None,
        alpha: float = 0.4,
    ) -> Dict[str, Any]:
        """
        Executes real Grad-CAM computation on an input retinal image.

        Returns:
            - predicted_class_id (int)
            - predicted_class_name (str)
            - confidence (float)
            - probabilities (dict)
            - target_layer (str)
            - heatmap_base64 (str, base64 data URI)
            - overlay_base64 (str, base64 data URI)
        """
        # Ensure image is RGB
        orig_image = image.convert("RGB")
        orig_size = orig_image.size  # (width, height)

        # Device detection from model parameters
        device = next(self.model.parameters()).device

        # Preprocess image into tensor [1, 3, 224, 224]
        input_tensor = self.transform(orig_image).unsqueeze(0).to(device)
        input_tensor.requires_grad = True

        # Register forward and backward hooks
        h_forward = self.target_layer.register_forward_hook(self._save_activations)
        h_backward = self.target_layer.register_full_backward_hook(self._save_gradients)

        try:
            # Forward pass
            self.model.eval()
            self.model.zero_grad()
            logits = self.model(input_tensor)
            probabilities = torch.softmax(logits, dim=1)[0]

            # Determine prediction and target class
            pred_class_id = int(torch.argmax(probabilities).item())
            confidence = float(probabilities[pred_class_id].item())
            chosen_class = target_class if target_class is not None else pred_class_id

            # Backward pass for target class score
            score = logits[0, chosen_class]
            score.backward(retain_graph=False)

            if self.activations is None or self.gradients is None:
                raise RuntimeError("Failed to capture activations or gradients during Grad-CAM.")

            # Global average pooling of gradients: weights alpha_k
            pooled_gradients = torch.mean(self.gradients, dim=(2, 3), keepdim=True)

            # Weighted sum of feature maps
            cam = torch.sum(pooled_gradients * self.activations, dim=1, keepdim=True)
            # Apply ReLU to keep only positive contributions
            cam = torch.relu(cam)

            # Convert to 2D numpy array
            cam_np = cam.squeeze().detach().cpu().numpy()

            # Normalize CAM to [0, 1]
            cam_min = float(cam_np.min())
            cam_max = float(cam_np.max())
            if cam_max > cam_min:
                normalized_cam = (cam_np - cam_min) / (cam_max - cam_min)
            else:
                normalized_cam = np.zeros_like(cam_np)

            # Resize CAM to original image resolution (or 224x224 if preferred)
            cam_pil = Image.fromarray((normalized_cam * 255.0).astype(np.uint8))
            cam_resized = cam_pil.resize(orig_size, resample=Image.Resampling.BILINEAR)
            cam_resized_np = np.array(cam_resized, dtype=np.float32) / 255.0

            # Generate Jet colormap heatmap (RGB uint8)
            heatmap_rgb = apply_jet_colormap(cam_resized_np)
            heatmap_pil = Image.fromarray(heatmap_rgb)

            # Create alpha blended overlay on original retinal image
            orig_np = np.array(orig_image, dtype=np.float32)
            overlay_np = (1.0 - alpha) * orig_np + alpha * heatmap_rgb.astype(np.float32)
            overlay_np = np.clip(overlay_np, 0, 255).astype(np.uint8)
            overlay_pil = Image.fromarray(overlay_np)

            # Encode images to base64 Data URIs
            heatmap_uri = pil_to_base64_data_uri(heatmap_pil, format="PNG")
            overlay_uri = pil_to_base64_data_uri(overlay_pil, format="PNG")

            return {
                "predicted_class_id": pred_class_id,
                "predicted_class_name": DR_CLASSES.get(pred_class_id, f"Class {pred_class_id}"),
                "confidence": round(confidence, 4),
                "probabilities": {
                    DR_CLASSES[i]: round(float(probabilities[i].item()), 4)
                    for i in range(len(DR_CLASSES))
                },
                "target_layer": self.target_layer_name,
                "heatmap_base64": heatmap_uri,
                "overlay_base64": overlay_uri,
                "device": str(device),
            }

        finally:
            # Clean up hooks
            h_forward.remove()
            h_backward.remove()
            self.activations = None
            self.gradients = None
