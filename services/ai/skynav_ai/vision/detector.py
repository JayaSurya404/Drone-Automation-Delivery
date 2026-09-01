"""
Replaceable Obstacle & Hazard Detection Subsystem for SkyNav Computer Vision.
Detects obstacles, pedestrians, vehicles, wires, and evaluates hazard severity levels.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional

from .models import (
    VisionDetection,
    VisionBoundingBox,
    DetectionCategory,
    HazardSeverity,
    CameraSource
)


class ObstacleDetector:
    """
    Modular obstacle and environmental hazard detector.
    """

    MODEL_VERSION = "obstacle-detector-baseline-v1.1.0"

    def detect_hazards(
        self,
        drone_id: str,
        telemetry: Dict[str, Any],
        camera_source: CameraSource = CameraSource.FORWARD_OBSTACLE_CAM,
        synthetic_scene_description: Optional[str] = None,
        minimum_confidence: float = 0.5
    ) -> List[VisionDetection]:
        """Detects objects and filters by confidence threshold."""
        desc = (synthetic_scene_description or "").lower()
        alt = float(telemetry.get("altitudeMeters", 15.0))
        detections: List[VisionDetection] = []

        if "crane" in desc or "tower" in desc or "highrise" in desc:
            detections.append(
                VisionDetection(
                    id=f"haz-struct-{drone_id}",
                    label="Construction Crane / Tall Structure",
                    category=DetectionCategory.STRUCTURE,
                    confidence=0.92,
                    boundingBox=VisionBoundingBox(xMin=0.35, yMin=0.10, xMax=0.65, yMax=0.90),
                    severity=HazardSeverity.CRITICAL,
                    approximateDistanceMeters=18.5,
                    details="Vertical structural obstruction in forward flight path."
                )
            )

        if "bird" in desc or "avian" in desc or "flock" in desc:
            detections.append(
                VisionDetection(
                    id=f"haz-avian-{drone_id}",
                    label="Bird Flock / Wildlife",
                    category=DetectionCategory.UNKNOWN_HAZARD,
                    confidence=0.78,
                    boundingBox=VisionBoundingBox(xMin=0.20, yMin=0.30, xMax=0.45, yMax=0.45),
                    severity=HazardSeverity.HIGH,
                    approximateDistanceMeters=12.0,
                    details="Dynamic airborne wildlife crossing corridor."
                )
            )

        if "tree" in desc or "branch" in desc:
            detections.append(
                VisionDetection(
                    id=f"haz-veg-{drone_id}",
                    label="Tree Canopy",
                    category=DetectionCategory.VEGETATION,
                    confidence=0.85,
                    boundingBox=VisionBoundingBox(xMin=0.60, yMin=0.20, xMax=0.90, yMax=0.70),
                    severity=HazardSeverity.MEDIUM,
                    approximateDistanceMeters=15.0,
                    details="Vegetation encroaching on lateral safety buffer."
                )
            )

        # Filter by minimum confidence
        return [d for d in detections if d.confidence >= minimum_confidence]
