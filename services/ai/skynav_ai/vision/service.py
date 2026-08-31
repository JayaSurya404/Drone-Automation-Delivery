"""
Computer Vision High-Level Service Orchestrator for SkyNav.
"""

from __future__ import annotations
from typing import Dict, Any, Optional

from .models import (
    CameraSource,
    VisionFrameAnalysisResult,
    LandingZoneAssessmentResult,
    DestinationVerificationResult,
    VisionDetection
)
from .provider import VisionProvider, DevelopmentVisionProvider
from .detector import ObstacleDetector
from .classifier import SceneClassifier
from .landing import LandingZoneAssessor
from .verification import DestinationVerifier
from ..safety import ADVISORY_DISCLAIMER


class ComputerVisionService:
    """
    Main entry point for computer vision and visual perception inference.
    """

    def __init__(self, provider: Optional[VisionProvider] = None):
        self.provider = provider or DevelopmentVisionProvider()
        self.detector = ObstacleDetector()
        self.classifier = SceneClassifier()
        self.landing_assessor = LandingZoneAssessor()
        self.verifier = DestinationVerifier()

    def set_provider(self, provider: VisionProvider):
        """Allows hot-swapping perception providers (e.g. from development to deep ML model)."""
        self.provider = provider

    def analyze_frame(
        self,
        frame_id: str,
        drone_id: str,
        telemetry: Dict[str, Any],
        camera_source: CameraSource = CameraSource.DOWNWARD_NAV_CAM,
        image_base64: Optional[str] = None,
        synthetic_scene_description: Optional[str] = None,
        target_delivery_location: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Analyzes a full visual frame."""
        res = self.provider.analyze_frame(
            frame_id=frame_id,
            drone_id=drone_id,
            telemetry=telemetry,
            camera_source=camera_source,
            image_base64=image_base64,
            synthetic_scene_description=synthetic_scene_description,
            target_delivery_location=target_delivery_location
        )
        return res.to_dict()

    def assess_landing_zone(
        self,
        drone_id: str,
        telemetry: Dict[str, Any],
        camera_source: CameraSource = CameraSource.DOWNWARD_NAV_CAM,
        expected_radius_meters: float = 3.0,
        synthetic_scene_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Performs focused landing zone assessment."""
        frame_res = self.provider.analyze_frame(
            frame_id=f"frame-lza-{drone_id}",
            drone_id=drone_id,
            telemetry=telemetry,
            camera_source=camera_source,
            synthetic_scene_description=synthetic_scene_description
        )

        return {
            "modelVersion": self.provider.MODEL_VERSION,
            "evaluatedAt": frame_res.processedAt,
            "droneId": drone_id,
            "assessment": frame_res.landingZoneAssessment.to_dict(),
            "advisorySafetyStatus": frame_res.advisorySafetyStatus.value,
            "advisoryDisclaimer": ADVISORY_DISCLAIMER
        }

    def verify_destination(
        self,
        drone_id: str,
        destination: Dict[str, Any],
        telemetry: Dict[str, Any],
        camera_source: CameraSource = CameraSource.DOWNWARD_NAV_CAM,
        synthetic_scene_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Verifies destination fiducial marker."""
        frame_res = self.provider.analyze_frame(
            frame_id=f"frame-dest-{drone_id}",
            drone_id=drone_id,
            telemetry=telemetry,
            camera_source=camera_source,
            synthetic_scene_description=synthetic_scene_description,
            target_delivery_location=destination
        )

        return {
            "modelVersion": self.provider.MODEL_VERSION,
            "evaluatedAt": frame_res.processedAt,
            "droneId": drone_id,
            "verification": frame_res.destinationVerification.to_dict(),
            "advisoryDisclaimer": ADVISORY_DISCLAIMER
        }

    def detect_hazards(
        self,
        drone_id: str,
        telemetry: Dict[str, Any],
        camera_source: CameraSource = CameraSource.FORWARD_OBSTACLE_CAM,
        minimum_confidence: float = 0.5,
        synthetic_scene_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Detects obstacle hazards and filters by confidence."""
        hazards = self.detector.detect_hazards(
            drone_id=drone_id,
            telemetry=telemetry,
            camera_source=camera_source,
            synthetic_scene_description=synthetic_scene_description,
            minimum_confidence=minimum_confidence
        )

        frame_res = self.provider.analyze_frame(
            frame_id=f"frame-haz-{drone_id}",
            drone_id=drone_id,
            telemetry=telemetry,
            camera_source=camera_source,
            synthetic_scene_description=synthetic_scene_description
        )

        return {
            "modelVersion": self.detector.MODEL_VERSION,
            "evaluatedAt": frame_res.processedAt,
            "droneId": drone_id,
            "hazardsCount": len(hazards),
            "detections": [h.to_dict() for h in hazards],
            "advisorySafetyStatus": frame_res.advisorySafetyStatus.value,
            "advisoryDisclaimer": ADVISORY_DISCLAIMER
        }


# Singleton instance
vision_service = ComputerVisionService()
