"""API endpoints for VisionNexa."""
from fastapi import APIRouter, HTTPException, UploadFile, File
from app.core.config import (
    DEFAULT_WEIGHTS_PATH,
    DEVICE,
    DR_CLASSES,
    NUM_CLASSES,
    PROJECT_NAME,
    PROJECT_VERSION,
)
from app.services import screening_service

router = APIRouter()


@router.get("/status")
def get_status():
    """General operational health check."""
    return {
        "project": PROJECT_NAME,
        "version": PROJECT_VERSION,
        "status": "online",
        "model_loaded": screening_service.is_loaded,
        "device": str(screening_service.device),
    }


@router.get("/model-status")
def get_model_status():
    """Confirms whether the trained EfficientNet-B0 model is loaded and ready."""
    from app.core.config import MODEL_WEIGHTS_URL
    return {
        "model_loaded": screening_service.is_loaded,
        "model_architecture": "EfficientNet-B0",
        "device": str(screening_service.device),
        "num_classes": NUM_CLASSES,
        "classes": DR_CLASSES,
        "weights_path": str(DEFAULT_WEIGHTS_PATH),
        "weights_exist": DEFAULT_WEIGHTS_PATH.exists(),
        "weights_url_configured": bool(MODEL_WEIGHTS_URL),
    }


@router.post("/reload-model")
def reload_model():
    """Attempts to download weights (if configured) and reload the PyTorch model."""
    from app.core.config import ensure_weights_available
    try:
        ensure_weights_available()
        screening_service.load_weights()
        return {
            "status": "success",
            "message": "Model reloaded successfully.",
            "model_loaded": screening_service.is_loaded,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reload model: {str(exc)}",
        )


@router.post("/screen")
async def screen_retina(file: UploadFile = File(...)):
    """
    Executes real inference on an uploaded retinal fundus image using the
    trained EfficientNet-B0 PyTorch model.
    """
    if not screening_service.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model is not loaded. Please ensure weights exist and are loaded.",
        )

    # Validate image MIME type or extension
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Uploaded file '{file.filename}' is not a valid image format.",
        )

    try:
        contents = await file.read()
        result = screening_service.predict(contents)
        result["filename"] = file.filename
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Inference error: {str(exc)}",
        )


@router.post("/explain")
async def explain_retina(file: UploadFile = File(...)):
    """
    Executes real inference and Grad-CAM explainability on an uploaded retinal fundus image
    using the trained EfficientNet-B0 PyTorch model and its final convolutional layer.
    """
    if not screening_service.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model is not loaded. Please ensure weights exist and are loaded.",
        )

    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Uploaded file '{file.filename}' is not a valid image format.",
        )

    try:
        contents = await file.read()
        result = screening_service.explain(contents)
        result["filename"] = file.filename
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Grad-CAM explanation error: {str(exc)}",
        )
