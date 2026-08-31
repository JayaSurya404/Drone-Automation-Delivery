"""
Unit tests for SkyNav Computer Vision & Perception Engine.
"""

import unittest
from skynav_ai.vision.models import (
    VisionBoundingBox,
    VisionDetection,
    DetectionCategory,
    HazardSeverity,
    SceneType,
    LandingZoneSuitability,
    DestinationVerificationStatus,
    CameraSource,
    AdvisorySafetyStatus
)
from skynav_ai.vision.provider import DevelopmentVisionProvider, SimulatorVisionProvider
from skynav_ai.vision.detector import ObstacleDetector
from skynav_ai.vision.classifier import SceneClassifier
from skynav_ai.vision.landing import LandingZoneAssessor
from skynav_ai.vision.verification import DestinationVerifier
from skynav_ai.vision.service import ComputerVisionService


class TestComputerVision(unittest.TestCase):

    def setUp(self):
        self.dev_provider = DevelopmentVisionProvider()
        self.sim_provider = SimulatorVisionProvider()
        self.detector = ObstacleDetector()
        self.classifier = SceneClassifier()
        self.landing_assessor = LandingZoneAssessor()
        self.verifier = DestinationVerifier()
        self.service = ComputerVisionService()

    def test_safe_landing_zone_frame_analysis(self):
        telemetry = {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "altitudeMeters": 12.0,
            "headingDegrees": 180.0
        }
        res = self.dev_provider.analyze_frame(
            frame_id="frame-001",
            drone_id="drone-001",
            telemetry=telemetry,
            camera_source=CameraSource.DOWNWARD_NAV_CAM,
            synthetic_scene_description="suburban residential driveway with clear landing pad"
        )

        self.assertEqual(res.frameId, "frame-001")
        self.assertEqual(res.sceneClassification.sceneType, SceneType.SUBURBAN)
        self.assertEqual(res.landingZoneAssessment.suitability, LandingZoneSuitability.SAFE)
        self.assertEqual(res.destinationVerification.status, DestinationVerificationStatus.VERIFIED)
        self.assertEqual(res.advisorySafetyStatus, AdvisorySafetyStatus.CLEAR)
        self.assertGreaterEqual(res.landingZoneAssessment.usableAreaSquareMeters, 15.0)

    def test_obstructed_landing_zone_with_pedestrian(self):
        telemetry = {"latitude": 37.7749, "longitude": -122.4194, "altitudeMeters": 10.0}
        res = self.dev_provider.analyze_frame(
            frame_id="frame-hazard-01",
            drone_id="drone-001",
            telemetry=telemetry,
            camera_source=CameraSource.DOWNWARD_NAV_CAM,
            synthetic_scene_description="pedestrian walking directly under drone drop zone"
        )

        self.assertEqual(res.landingZoneAssessment.suitability, LandingZoneSuitability.UNSAFE)
        self.assertEqual(res.destinationVerification.status, DestinationVerificationStatus.OBSTRUCTED)
        self.assertEqual(res.advisorySafetyStatus, AdvisorySafetyStatus.ADVISORY_ABORT_RECOMMENDED)
        self.assertGreaterEqual(res.landingZoneAssessment.peopleDetectedCount, 1)
        self.assertIn("Abort descent", res.landingZoneAssessment.recommendations[0])

    def test_water_surface_rejection(self):
        telemetry = {"latitude": 37.7749, "longitude": -122.4194, "altitudeMeters": 8.0}
        res = self.dev_provider.analyze_frame(
            frame_id="frame-water-01",
            drone_id="drone-001",
            telemetry=telemetry,
            camera_source=CameraSource.DOWNWARD_NAV_CAM,
            synthetic_scene_description="swimming pool and standing water in target zone"
        )

        self.assertEqual(res.landingZoneAssessment.suitability, LandingZoneSuitability.UNSAFE)
        self.assertEqual(res.landingZoneAssessment.surfaceType, "WATER")

    def test_obstacle_hazard_detector_filtering(self):
        telemetry = {"altitudeMeters": 25.0}
        hazards = self.detector.detect_hazards(
            drone_id="drone-001",
            telemetry=telemetry,
            camera_source=CameraSource.FORWARD_OBSTACLE_CAM,
            synthetic_scene_description="construction crane tower and tree canopy",
            minimum_confidence=0.8
        )

        self.assertGreaterEqual(len(hazards), 1)
        crane = next((h for h in hazards if h.category == DetectionCategory.STRUCTURE), None)
        self.assertIsNotNone(crane)
        self.assertEqual(crane.severity, HazardSeverity.CRITICAL)

    def test_scene_classifier_contexts(self):
        res_ind = self.classifier.classify_scene({}, "amazon logistics warehouse depot")
        self.assertEqual(res_ind.sceneType, SceneType.INDUSTRIAL)

        res_urb = self.classifier.classify_scene({}, "downtown skyscraper urban canyon")
        self.assertEqual(res_urb.sceneType, SceneType.URBAN)

        res_field = self.classifier.classify_scene({}, "open grassy park meadow")
        self.assertEqual(res_field.sceneType, SceneType.OPEN_FIELD)

    def test_service_orchestration_endpoints(self):
        telemetry = {"latitude": 37.7749, "longitude": -122.4194, "altitudeMeters": 15.0}
        
        lza = self.service.assess_landing_zone(
            drone_id="drone-001",
            telemetry=telemetry,
            synthetic_scene_description="clear concrete landing pad"
        )
        self.assertEqual(lza["assessment"]["suitability"], "SAFE")

        dest = self.service.verify_destination(
            drone_id="drone-001",
            destination={"latitude": 37.7749, "longitude": -122.4194},
            telemetry=telemetry
        )
        self.assertEqual(dest["verification"]["status"], "VERIFIED")

        haz = self.service.detect_hazards(
            drone_id="drone-001",
            telemetry=telemetry,
            synthetic_scene_description="tall crane in path"
        )
        self.assertGreaterEqual(haz["hazardsCount"], 1)


if __name__ == "__main__":
    unittest.main()
