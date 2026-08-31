import unittest
import json
from skynav_ai.server import AiRequestHandler


class DummyHandler(AiRequestHandler):
    """Subclass for testing request routing without live sockets."""
    def __init__(self):
        pass


class TestAiServerRoutes(unittest.TestCase):
    def setUp(self):
        self.handler = DummyHandler()

    def test_route_scoring_endpoint(self):
        payload = {
            "organizationId": "org-test",
            "packageWeightGrams": 1200,
            "droneMaxPayloadGrams": 5000,
            "droneBatteryPercent": 90,
            "candidates": [
                {
                    "id": "c1",
                    "name": "Route 1",
                    "waypoints": [
                        {"latitude": 37.7749, "longitude": -122.4194},
                        {"latitude": 37.7845, "longitude": -122.4082}
                    ]
                }
            ]
        }
        status, res = self.handler._route_post("/api/v1/ai/routes/score", payload)
        self.assertEqual(status, 200)
        self.assertEqual(res["recommendedRouteId"], "c1")
        self.assertIn("advisoryDisclaimer", res)

    def test_eta_prediction_endpoint(self):
        payload = {
            "organizationId": "org-test",
            "currentPosition": {"latitude": 37.7749, "longitude": -122.4194},
            "destination": {"latitude": 37.7845, "longitude": -122.4082},
            "currentSpeedMps": 12.0
        }
        status, res = self.handler._route_post("/api/v1/ai/eta/predict", payload)
        self.assertEqual(status, 200)
        self.assertIn("predictedEta", res)

    def test_battery_prediction_endpoint(self):
        payload = {
            "organizationId": "org-test",
            "droneId": "drone-1",
            "currentBatteryPercent": 80,
            "routeDistanceMeters": 4000,
            "packageWeightGrams": 2000
        }
        status, res = self.handler._route_post("/api/v1/ai/battery/predict", payload)
        self.assertEqual(status, 200)
        self.assertEqual(res["feasibility"], "SAFE")

    def test_maintenance_prediction_endpoint(self):
        payload = {
            "organizationId": "org-test",
            "droneId": "drone-1",
            "callSign": "SKY-001",
            "model": "AeroHex V4",
            "flightHours": 50.0
        }
        status, res = self.handler._route_post("/api/v1/ai/maintenance/predict", payload)
        self.assertEqual(status, 200)
        self.assertEqual(res["overallRiskLevel"], "NORMAL")

    def test_weather_risk_endpoint(self):
        payload = {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "windSpeedMps": 5.0,
            "windDirectionDegrees": 180.0
        }
        status, res = self.handler._route_post("/api/v1/ai/weather/risk", payload)
        self.assertEqual(status, 200)
        self.assertTrue(res["isFlightPermitted"])

    def test_demand_forecast_endpoint(self):
        payload = {
            "organizationId": "org-test",
            "forecastHorizonHours": 12
        }
        status, res = self.handler._route_post("/api/v1/ai/forecasting/demand", payload)
        self.assertEqual(status, 200)
        self.assertEqual(res["forecastHorizonHours"], 12)

    def test_vision_frame_analysis_endpoint(self):
        payload = {
            "organizationId": "org-test",
            "frameId": "frame-101",
            "droneId": "drone-101",
            "telemetry": {"latitude": 37.7749, "longitude": -122.4194, "altitudeMeters": 15.0},
            "syntheticSceneDescription": "suburban driveway with clear landing pad"
        }
        status, res = self.handler._route_post("/api/v1/ai/vision/analyze-frame", payload)
        self.assertEqual(status, 200)
        self.assertEqual(res["landingZoneAssessment"]["suitability"], "SAFE")

    def test_vision_assess_landing_endpoint(self):
        payload = {
            "organizationId": "org-test",
            "droneId": "drone-101",
            "telemetry": {"latitude": 37.7749, "longitude": -122.4194, "altitudeMeters": 10.0}
        }
        status, res = self.handler._route_post("/api/v1/ai/vision/assess-landing", payload)
        self.assertEqual(status, 200)
        self.assertIn("assessment", res)

    def test_vision_verify_destination_endpoint(self):
        payload = {
            "organizationId": "org-test",
            "droneId": "drone-101",
            "destination": {"latitude": 37.7749, "longitude": -122.4194},
            "telemetry": {"latitude": 37.7749, "longitude": -122.4194}
        }
        status, res = self.handler._route_post("/api/v1/ai/vision/verify-destination", payload)
        self.assertEqual(status, 200)
        self.assertIn("verification", res)

    def test_vision_detect_hazards_endpoint(self):
        payload = {
            "organizationId": "org-test",
            "droneId": "drone-101",
            "telemetry": {"altitudeMeters": 20.0},
            "syntheticSceneDescription": "crane obstruction"
        }
        status, res = self.handler._route_post("/api/v1/ai/vision/detect-hazards", payload)
        self.assertEqual(status, 200)
        self.assertIn("hazardsCount", res)

    def test_unknown_endpoint_returns_404(self):
        status, res = self.handler._route_post("/api/v1/ai/nonexistent", {})
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
