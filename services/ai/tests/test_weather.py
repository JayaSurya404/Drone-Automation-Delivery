import unittest
from skynav_ai.weather import WeatherIntelligenceEngine
from skynav_ai.models import WeatherConditions, RiskLevel


class TestWeatherIntelligence(unittest.TestCase):
    def setUp(self):
        self.engine = WeatherIntelligenceEngine()

    def test_optimal_weather(self):
        w = WeatherConditions(windSpeedMps=3.0, windGustMps=4.5, precipitationMmPerHour=0.0, visibilityMeters=10000.0)
        res = self.engine.assess_weather_risk(w)
        self.assertEqual(res.riskLevel, RiskLevel.NORMAL)
        self.assertTrue(res.isFlightPermitted)
        self.assertEqual(res.maxSafeAltitudeMeters, 120.0)

    def test_severe_weather_grounding(self):
        w = WeatherConditions(windSpeedMps=18.0, windGustMps=24.0, thunderstormRisk=True)
        res = self.engine.assess_weather_risk(w)
        self.assertEqual(res.riskLevel, RiskLevel.CRITICAL)
        self.assertFalse(res.isFlightPermitted)
        self.assertEqual(res.maxSafeAltitudeMeters, 0.0)
        self.assertTrue(len(res.activeHazards) > 0)


if __name__ == "__main__":
    unittest.main()
