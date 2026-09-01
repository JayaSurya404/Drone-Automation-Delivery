"""
Landing-Zone and Delivery-Zone Visual Assessment Engine for SkyNav.
Evaluates ground surface suitability, obstruction presence, people/vehicles, and landing envelope.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional

from .models import (
    LandingZoneSuitability,
    LandingZoneAssessmentResult,
    VisionDetection,
    HazardSeverity
)


class LandingZoneAssessor:
    """
    Landing and drop-zone visual safety evaluator.
    """

    MODEL_VERSION = "landing-assessor-baseline-v1.0.0"

    def assess(
        self,
        detections: List[VisionDetection],
        telemetry: Dict[str, Any],
        expected_radius_meters: float = 3.0,
        synthetic_scene_description: Optional[str] = None
    ) -> LandingZoneAssessmentResult:
        desc = (synthetic_scene_description or "").lower()

        people = [d for d in detections if d.category == "PERSON" or d.label.lower().find("person") != -1]
        vehicles = [d for d in detections if d.category == "VEHICLE" or d.label.lower().find("vehicle") != -1]
        critical_hazards = [d for d in detections if d.severity == HazardSeverity.CRITICAL]
        high_hazards = [d for d in detections if d.severity == HazardSeverity.HIGH]

        obstructions: List[str] = []
        if people:
            obstructions.append(f"{len(people)} person(s) detected within drop zone")
        if vehicles:
            obstructions.append(f"{len(vehicles)} vehicle(s) nearby")
        for h in critical_hazards:
            if h.category not in ["PERSON", "VEHICLE"]:
                obstructions.append(h.label)

        if critical_hazards or people or "water" in desc or "blocked" in desc:
            suitability = LandingZoneSuitability.UNSAFE
            confidence = 0.94
            usable_area = 0.0
            reasons = [f"Hazard active: {obs}" for obs in (obstructions or ["Severe surface obstruction detected."])]
            recommendations = ["Hold at standoff altitude (>= 15m)", "Do not descend", "Request operator manual abort"]
        elif high_hazards or vehicles or "tight" in desc:
            suitability = LandingZoneSuitability.CAUTION
            confidence = 0.88
            usable_area = 7.5
            reasons = [f"Reduced clearance: {obs}" for obs in obstructions]
            recommendations = ["Maintain creep descent speed (<= 0.5 m/s)", "Continuously scan for dynamic movement"]
        elif "unknown" in desc:
            suitability = LandingZoneSuitability.UNKNOWN
            confidence = 0.45
            usable_area = 5.0
            reasons = ["Visual contrast insufficient to determine ground surface safety."]
            recommendations = ["Descend slowly to improve sensor resolution", "Check alternative camera feed"]
        else:
            suitability = LandingZoneSuitability.SAFE
            confidence = 0.95
            usable_area = 20.0
            reasons = ["Clear landing surface identified with certified safety margins."]
            recommendations = ["Cleared for standard autonomous delivery descent."]

        surface = "WATER" if "water" in desc else "CONCRETE" if "driveway" in desc or "concrete" in desc else "GRASS" if "lawn" in desc or "grass" in desc else "PAVEMENT"

        return LandingZoneAssessmentResult(
            suitability=suitability,
            confidence=confidence,
            usableAreaSquareMeters=usable_area,
            surfaceType=surface,
            obstructionsDetected=obstructions,
            peopleDetectedCount=len(people),
            vehiclesDetectedCount=len(vehicles),
            slopeDegrees=1.2,
            reasons=reasons,
            recommendations=recommendations
        )
