import unittest
from skynav_ai.models import Coordinate, WeatherConditions
from skynav_ai.eta import EtaPredictionEngine


class TestEtaPrediction(unittest.TestCase):
    def setUp(self):
        self.engine = EtaPredictionEngine()
        self.origin = Coordinate(latitude=37.7749, longitude=-122.4194)
        self.dest = Coordinate(latitude=37.7845, longitude=-122.4082)

    def test_nominal_eta_prediction(self):
        res = self.engine.predict_eta(
            current_position=self.origin,
            destination=self.dest,
            current_speed_mps=15.0,
            cruise_speed_mps=15.0
        )
        self.assertGreater(res.remainingDistanceMeters, 1400)
        self.assertGreater(res.estimatedDurationSeconds, 60)
        self.assertGreater(res.confidenceInterval.p90DurationSeconds, res.confidenceInterval.p50DurationSeconds)
        self.assertGreater(res.confidenceInterval.p99DurationSeconds, res.confidenceInterval.p90DurationSeconds)
        self.assertGreaterEqual(res.confidenceScore, 0.9)

    def test_headwind_speed_penalty(self):
        w_headwind = WeatherConditions(windSpeedMps=12.0, windDirectionDegrees=45.0)
        res_wind = self.engine.predict_eta(
            current_position=self.origin,
            destination=self.dest,
            weather=w_headwind
        )
        res_calm = self.engine.predict_eta(
            current_position=self.origin,
            destination=self.dest,
            weather=WeatherConditions()
        )
        self.assertGreater(res_wind.estimatedDurationSeconds, res_calm.estimatedDurationSeconds)
        self.assertTrue(any("Headwind" in f for f in res_wind.contributingFactors))


if __name__ == "__main__":
    unittest.main()
