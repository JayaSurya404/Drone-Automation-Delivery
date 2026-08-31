"""
Replaceable Model Inference Provider Interface for SkyNav Computer Vision.
Decouples perception algorithms from specific ML training backends (PyTorch, ONNX, TensorRT).
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import math
import time
from datetime import datetime, timezone

from .models import (
    VisionBoundingBox,
    VisionDetection,
    DetectionCategory,
    HazardSeverity,
    SceneType,
    LandingZoneSuitability,
    DestinationVerificationStatus,
    CameraSource,
    AdvisorySafetyStatus,
    SceneClassificationResult,
    LandingZoneAssessmentResult,
    DestinationVerificationResult,
    VisionFrameAnalysisResult
)
from ..safety import ADVISORY_DISCLAIMER


class VisionProvider(ABC):
    """
    Abstract perception provider interface for visual inference.
    """

    @abstractmethod
    def analyze_frame(
        self,
        frame_id: str,
        drone_id: str,
        telemetry: Dict[str, Any],
        camera_source: CameraSource = CameraSource.DOWNWARD_NAV_CAM,
        image_base64: Optional[str] = None,
        synthetic_scene_description: Optional[str] = None,
        target_delivery_location: Optional[Dict[str, Any]] = None
    ) -> VisionFrameAnalysisResult:
        """Processes an image frame and returns structured perception outputs."""
        pass


class DevelopmentVisionProvider(VisionProvider):
    """
    Deterministic rule-based perception provider for local development, digital-twin testing,
    and synthetic scene analysis.
    Explicitly designed to be swapped with production deep-learning vision models.
    """

    PROVIDER_NAME = "DevelopmentVisionProvider (Deterministic Baseline)"
    MODEL_VERSION = "vision-dev-baseline-v1.0.0"

    def analyze_frame(
        self,
        frame_id: str,
        drone_id: str,
        telemetry: Dict[str, Any],
        camera_source: CameraSource = CameraSource.DOWNWARD_NAV_CAM,
        image_base64: Optional[str] = None,
        synthetic_scene_description: Optional[str] = None,
        target_delivery_location: Optional[Dict[str, Any]] = None
    ) -> VisionFrameAnalysisResult:
        start_time = time.time()
        now_iso = datetime.now(timezone.utc).isoformat()

        alt = float(telemetry.get("altitudeMeters", 15.0))
        lat = float(telemetry.get("latitude", 0.0))
        lon = float(telemetry.get("longitude", 0.0))

        desc = (synthetic_scene_description or "").lower()

        # 1. Scene Classification
        if "industrial" in desc or "warehouse" in desc:
            scene_type = SceneType.INDUSTRIAL
            scene_conf = 0.92
            scene_desc = "Industrial logistics zone with wide paved aprons and loading bays."
        elif "suburban" in desc or "residential" in desc:
            scene_type = SceneType.SUBURBAN
            scene_conf = 0.91
            scene_desc = "Suburban residential area with private driveways and yards."
        elif "urban" in desc or "downtown" in desc or "highrise" in desc:
            scene_type = SceneType.URBAN
            scene_conf = 0.88
            scene_desc = "High-density urban environment with structural obstacles."
        elif "field" in desc or "park" in desc or "meadow" in desc:
            scene_type = SceneType.OPEN_FIELD
            scene_conf = 0.95
            scene_desc = "Open unobstructed grassy field with clear line-of-sight."
        elif "rural" in desc or "forest" in desc:
            scene_type = SceneType.RURAL
            scene_conf = 0.89
            scene_desc = "Rural landscape with low-density housing and tree canopy."
        else:
            scene_type = SceneType.SUBURBAN
            scene_conf = 0.91
            scene_desc = "Suburban residential area with private driveways and yards."

        scene_result = SceneClassificationResult(
            sceneType=scene_type,
            confidence=scene_conf,
            secondaryScenes=[SceneType.OPEN_FIELD] if scene_type == SceneType.SUBURBAN else [],
            description=scene_desc
        )

        # 2. Hazard & Object Detection
        detections: List[VisionDetection] = []
        people_count = 0
        vehicle_count = 0
        obstructions: List[str] = []

        # Check for dynamic hazards in description or synthetic feed
        if "person" in desc or "pedestrian" in desc or "crowd" in desc:
            people_count = 2 if "crowd" in desc else 1
            detections.append(
                VisionDetection(
                    id=f"det-person-{frame_id}",
                    label="Person in Proximity",
                    category=DetectionCategory.PERSON,
                    confidence=0.91,
                    boundingBox=VisionBoundingBox(xMin=0.45, yMin=0.48, xMax=0.55, yMax=0.68),
                    severity=HazardSeverity.CRITICAL,
                    approximateDistanceMeters=max(1.0, alt * 0.9),
                    details="Pedestrian located within 3m of designated drop point."
                )
            )
            obstructions.append("Pedestrian active in drop radius")

        if "vehicle" in desc or "car" in desc or "truck" in desc:
            vehicle_count = 1
            detections.append(
                VisionDetection(
                    id=f"det-veh-{frame_id}",
                    label="Parked Vehicle",
                    category=DetectionCategory.VEHICLE,
                    confidence=0.94,
                    boundingBox=VisionBoundingBox(xMin=0.15, yMin=0.20, xMax=0.38, yMax=0.52),
                    severity=HazardSeverity.MEDIUM,
                    approximateDistanceMeters=max(3.0, alt * 1.2),
                    details="Vehicle stationary near outer boundary of landing zone."
                )
            )
            obstructions.append("Vehicle parked near landing zone margin")

        if "wire" in desc or "powerline" in desc or "cable" in desc:
            detections.append(
                VisionDetection(
                    id=f"det-wire-{frame_id}",
                    label="Overhead Power Cable",
                    category=DetectionCategory.OBSTACLE,
                    confidence=0.88,
                    boundingBox=VisionBoundingBox(xMin=0.05, yMin=0.10, xMax=0.95, yMax=0.18),
                    severity=HazardSeverity.CRITICAL,
                    approximateDistanceMeters=max(2.0, alt * 0.6),
                    details="Transverse aerial power cable crossing flight approach path."
                )
            )
            obstructions.append("Overhead power lines in flight corridor")

        if "tree" in desc or "branch" in desc:
            detections.append(
                VisionDetection(
                    id=f"det-veg-{frame_id}",
                    label="Tree Canopy Overhang",
                    category=DetectionCategory.VEGETATION,
                    confidence=0.86,
                    boundingBox=VisionBoundingBox(xMin=0.65, yMin=0.15, xMax=0.95, yMax=0.55),
                    severity=HazardSeverity.HIGH,
                    approximateDistanceMeters=max(4.0, alt * 0.8),
                    details="Vegetation foliage protruding into descent corridor."
                )
            )
            obstructions.append("Tree branches protruding into descent path")

        if "water" in desc or "pool" in desc or "lake" in desc:
            detections.append(
                VisionDetection(
                    id=f"det-water-{frame_id}",
                    label="Standing Water Surface",
                    category=DetectionCategory.WATER,
                    confidence=0.93,
                    boundingBox=VisionBoundingBox(xMin=0.30, yMin=0.30, xMax=0.70, yMax=0.70),
                    severity=HazardSeverity.CRITICAL,
                    approximateDistanceMeters=alt,
                    details="Submerged surface unsuitable for payload drop."
                )
            )
            obstructions.append("Water surface at landing point")

        # Always detect landing pad marker if downward camera and no major water obstruction
        pad_detected = "water" not in desc and "unmarked" not in desc
        if pad_detected and camera_source == CameraSource.DOWNWARD_NAV_CAM:
            detections.append(
                VisionDetection(
                    id=f"det-pad-{frame_id}",
                    label="SkyNav Landing Target Pad",
                    category=DetectionCategory.LANDING_PAD,
                    confidence=0.96,
                    boundingBox=VisionBoundingBox(xMin=0.40, yMin=0.40, xMax=0.60, yMax=0.60),
                    severity=HazardSeverity.LOW,
                    approximateDistanceMeters=alt,
                    details="Standard high-contrast fiducial landing pattern."
                )
            )

        # 3. Landing Zone Assessment
        has_critical_hazard = any(d.severity == HazardSeverity.CRITICAL for d in detections)
        has_high_hazard = any(d.severity == HazardSeverity.HIGH for d in detections)

        if has_critical_hazard:
            suitability = LandingZoneSuitability.UNSAFE
            safety_status = AdvisorySafetyStatus.ADVISORY_ABORT_RECOMMENDED
            reasons = [f"Unsafe landing zone: {obs}" for obs in obstructions]
            recommendations = ["Abort descent", "Hold at safe standoff altitude (>= 15m)", "Request operator intervention"]
        elif has_high_hazard or vehicle_count > 0:
            suitability = LandingZoneSuitability.CAUTION
            safety_status = AdvisorySafetyStatus.ADVISORY_CAUTION
            reasons = [f"Caution advised: {obs}" for obs in obstructions]
            recommendations = ["Reduce descent speed to 0.5 m/s", "Maintain continuous optical obstacle scan"]
        else:
            suitability = LandingZoneSuitability.SAFE
            safety_status = AdvisorySafetyStatus.CLEAR
            reasons = ["Clear landing surface detected with zero dynamic hazards in drop radius."]
            recommendations = ["Cleared for standard autonomous delivery descent profile."]

        surface_type = "WATER" if "water" in desc else "CONCRETE" if scene_type in [SceneType.URBAN, SceneType.INDUSTRIAL] else "GRASS" if scene_type == SceneType.OPEN_FIELD else "PAVEMENT"
        usable_area = 0.0 if suitability == LandingZoneSuitability.UNSAFE else 20.0 if suitability == LandingZoneSuitability.SAFE else 8.5

        landing_assessment = LandingZoneAssessmentResult(
            suitability=suitability,
            confidence=0.92 if suitability != LandingZoneSuitability.UNKNOWN else 0.40,
            usableAreaSquareMeters=usable_area,
            surfaceType=surface_type,
            obstructionsDetected=obstructions,
            peopleDetectedCount=people_count,
            vehiclesDetectedCount=vehicle_count,
            slopeDegrees=0.8 if surface_type in ["CONCRETE", "PAVEMENT"] else 3.2,
            reasons=reasons,
            recommendations=recommendations
        )

        # 4. Destination / Target Verification
        if pad_detected and not has_critical_hazard:
            dest_status = DestinationVerificationStatus.VERIFIED
            dest_visible = True
            dest_reasons = ["Visual landing target verified and aligned with navigation coordinates."]
            dx = 0.12
            dy = -0.18
        elif pad_detected and has_critical_hazard:
            dest_status = DestinationVerificationStatus.OBSTRUCTED
            dest_visible = True
            dest_reasons = [f"Target visible but obstructed: {', '.join(obstructions)}."]
            dx = 0.10
            dy = 0.10
        elif "unmarked" in desc:
            dest_status = DestinationVerificationStatus.UNVERIFIED
            dest_visible = True
            dest_reasons = ["Drop area visible but no physical landing target marker detected."]
            dx = 0.0
            dy = 0.0
        else:
            dest_status = DestinationVerificationStatus.NOT_FOUND
            dest_visible = False
            dest_reasons = ["Target fiducial not acquired in camera field of view."]
            dx = 0.0
            dy = 0.0

        dest_verification = DestinationVerificationResult(
            status=dest_status,
            isTargetVisible=dest_visible,
            targetPadDetected=pad_detected,
            confidence=0.95 if dest_status == DestinationVerificationStatus.VERIFIED else 0.60,
            dxMeters=dx,
            dyMeters=dy,
            reasons=dest_reasons
        )

        latency_ms = (time.time() - start_time) * 1000.0

        return VisionFrameAnalysisResult(
            frameId=frame_id,
            droneId=drone_id,
            timestamp=now_iso,
            processedAt=now_iso,
            modelVersion=self.MODEL_VERSION,
            inferenceLatencyMs=latency_ms,
            cameraSource=camera_source,
            sceneClassification=scene_result,
            detections=detections,
            landingZoneAssessment=landing_assessment,
            destinationVerification=dest_verification,
            advisorySafetyStatus=safety_status,
            advisoryDisclaimer=ADVISORY_DISCLAIMER
        )


class SimulatorVisionProvider(VisionProvider):
    """
    Perception provider tuned for deterministic simulator digital-twin execution.
    Produces deterministic vision results based on UAV simulated altitude and waypoint tags.
    """

    PROVIDER_NAME = "SimulatorVisionProvider"
    MODEL_VERSION = "vision-simulator-v1.0.0"

    def __init__(self):
        self.dev_provider = DevelopmentVisionProvider()

    def analyze_frame(
        self,
        frame_id: str,
        drone_id: str,
        telemetry: Dict[str, Any],
        camera_source: CameraSource = CameraSource.DOWNWARD_NAV_CAM,
        image_base64: Optional[str] = None,
        synthetic_scene_description: Optional[str] = None,
        target_delivery_location: Optional[Dict[str, Any]] = None
    ) -> VisionFrameAnalysisResult:
        return self.dev_provider.analyze_frame(
            frame_id=frame_id,
            drone_id=drone_id,
            telemetry=telemetry,
            camera_source=camera_source,
            image_base64=image_base64,
            synthetic_scene_description=synthetic_scene_description or "suburban delivery waypoint with paved landing pad",
            target_delivery_location=target_delivery_location
        )
