"""
Data models and serializable structures for SkyNav Computer Vision & Perception.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone


class DetectionCategory(str, Enum):
    LANDING_ZONE = "LANDING_ZONE"
    LANDING_PAD = "LANDING_PAD"
    OBSTACLE = "OBSTACLE"
    PERSON = "PERSON"
    VEHICLE = "VEHICLE"
    STRUCTURE = "STRUCTURE"
    WATER = "WATER"
    VEGETATION = "VEGETATION"
    UNKNOWN_HAZARD = "UNKNOWN_HAZARD"


class HazardSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SceneType(str, Enum):
    URBAN = "URBAN"
    SUBURBAN = "SUBURBAN"
    INDUSTRIAL = "INDUSTRIAL"
    RURAL = "RURAL"
    OPEN_FIELD = "OPEN_FIELD"
    UNKNOWN = "UNKNOWN"


class LandingZoneSuitability(str, Enum):
    SAFE = "SAFE"
    CAUTION = "CAUTION"
    UNSAFE = "UNSAFE"
    UNKNOWN = "UNKNOWN"


class DestinationVerificationStatus(str, Enum):
    VERIFIED = "VERIFIED"
    UNVERIFIED = "UNVERIFIED"
    OBSTRUCTED = "OBSTRUCTED"
    NOT_FOUND = "NOT_FOUND"


class CameraSource(str, Enum):
    DOWNWARD_NAV_CAM = "DOWNWARD_NAV_CAM"
    FORWARD_OBSTACLE_CAM = "FORWARD_OBSTACLE_CAM"
    PERCEPTION_PAYLOAD_CAM = "PERCEPTION_PAYLOAD_CAM"
    SYNTHETIC_SIMULATOR_FEED = "SYNTHETIC_SIMULATOR_FEED"


class AdvisorySafetyStatus(str, Enum):
    CLEAR = "CLEAR"
    ADVISORY_CAUTION = "ADVISORY_CAUTION"
    ADVISORY_ABORT_RECOMMENDED = "ADVISORY_ABORT_RECOMMENDED"


@dataclass
class VisionBoundingBox:
    xMin: float
    yMin: float
    xMax: float
    yMax: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "xMin": round(self.xMin, 4),
            "yMin": round(self.yMin, 4),
            "xMax": round(self.xMax, 4),
            "yMax": round(self.yMax, 4)
        }


@dataclass
class VisionDetection:
    id: str
    label: str
    category: DetectionCategory
    confidence: float
    boundingBox: Optional[VisionBoundingBox] = None
    severity: HazardSeverity = HazardSeverity.LOW
    approximateDistanceMeters: Optional[float] = None
    details: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        res: Dict[str, Any] = {
            "id": self.id,
            "label": self.label,
            "category": self.category.value if isinstance(self.category, DetectionCategory) else str(self.category),
            "confidence": round(self.confidence, 3),
            "severity": self.severity.value if isinstance(self.severity, HazardSeverity) else str(self.severity)
        }
        if self.boundingBox:
            res["boundingBox"] = self.boundingBox.to_dict()
        if self.approximateDistanceMeters is not None:
            res["approximateDistanceMeters"] = round(self.approximateDistanceMeters, 2)
        if self.details:
            res["details"] = self.details
        return res


@dataclass
class SceneClassificationResult:
    sceneType: SceneType
    confidence: float
    secondaryScenes: List[SceneType] = field(default_factory=list)
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sceneType": self.sceneType.value if isinstance(self.sceneType, SceneType) else str(self.sceneType),
            "confidence": round(self.confidence, 3),
            "secondaryScenes": [s.value if isinstance(s, SceneType) else str(s) for s in self.secondaryScenes],
            "description": self.description
        }


@dataclass
class LandingZoneAssessmentResult:
    suitability: LandingZoneSuitability
    confidence: float
    usableAreaSquareMeters: float
    surfaceType: str
    obstructionsDetected: List[str] = field(default_factory=list)
    peopleDetectedCount: int = 0
    vehiclesDetectedCount: int = 0
    slopeDegrees: float = 0.0
    reasons: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "suitability": self.suitability.value if isinstance(self.suitability, LandingZoneSuitability) else str(self.suitability),
            "confidence": round(self.confidence, 3),
            "usableAreaSquareMeters": round(self.usableAreaSquareMeters, 1),
            "surfaceType": self.surfaceType,
            "obstructionsDetected": self.obstructionsDetected,
            "peopleDetectedCount": self.peopleDetectedCount,
            "vehiclesDetectedCount": self.vehiclesDetectedCount,
            "slopeDegrees": round(self.slopeDegrees, 1),
            "reasons": self.reasons,
            "recommendations": self.recommendations
        }


@dataclass
class DestinationVerificationResult:
    status: DestinationVerificationStatus
    isTargetVisible: bool
    targetPadDetected: bool
    confidence: float
    dxMeters: float = 0.0
    dyMeters: float = 0.0
    reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status.value if isinstance(self.status, DestinationVerificationStatus) else str(self.status),
            "isTargetVisible": self.isTargetVisible,
            "targetPadDetected": self.targetPadDetected,
            "confidence": round(self.confidence, 3),
            "offsetMeters": {
                "dxMeters": round(self.dxMeters, 3),
                "dyMeters": round(self.dyMeters, 3)
            },
            "reasons": self.reasons
        }


@dataclass
class VisionFrameAnalysisResult:
    frameId: str
    droneId: str
    timestamp: str
    processedAt: str
    modelVersion: str
    inferenceLatencyMs: float
    cameraSource: CameraSource
    sceneClassification: SceneClassificationResult
    detections: List[VisionDetection]
    landingZoneAssessment: LandingZoneAssessmentResult
    destinationVerification: DestinationVerificationResult
    advisorySafetyStatus: AdvisorySafetyStatus
    advisoryDisclaimer: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "frameId": self.frameId,
            "droneId": self.droneId,
            "timestamp": self.timestamp,
            "processedAt": self.processedAt,
            "modelVersion": self.modelVersion,
            "inferenceLatencyMs": round(self.inferenceLatencyMs, 1),
            "cameraSource": self.cameraSource.value if isinstance(self.cameraSource, CameraSource) else str(self.cameraSource),
            "sceneClassification": self.sceneClassification.to_dict(),
            "detections": [d.to_dict() for d in self.detections],
            "landingZoneAssessment": self.landingZoneAssessment.to_dict(),
            "destinationVerification": self.destinationVerification.to_dict(),
            "advisorySafetyStatus": self.advisorySafetyStatus.value if isinstance(self.advisorySafetyStatus, AdvisorySafetyStatus) else str(self.advisorySafetyStatus),
            "advisoryDisclaimer": self.advisoryDisclaimer
        }
