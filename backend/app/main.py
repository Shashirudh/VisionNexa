"""FastAPI Application entry point for VisionNexa."""
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGINS, DESCRIPTION, PROJECT_NAME, PROJECT_VERSION
from app.api.routes import router as api_router
from app.services import screening_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("visionNexa")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event to automatically load the PyTorch model on startup."""
    try:
        screening_service.load_weights()
        logger.info("Successfully loaded trained EfficientNet-B0 model into memory.")
    except Exception as exc:
        logger.error(f"Could not load model on startup: {exc}")
    yield


app = FastAPI(
    title=PROJECT_NAME,
    version=PROJECT_VERSION,
    description=DESCRIPTION,
    lifespan=lifespan,
)

# CORS configuration for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API endpoints
app.include_router(api_router, prefix="/api")


@app.get("/")
def root():
    return {
        "message": f"Welcome to {PROJECT_NAME} API",
        "docs": "/docs",
        "status": "/api/status",
        "model_status": "/api/model-status",
    }
