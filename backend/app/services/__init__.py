"""Services package for VisionNexa."""
from .inference import ScreeningService

# Singleton service instance
screening_service = ScreeningService()

__all__ = ["ScreeningService", "screening_service"]
