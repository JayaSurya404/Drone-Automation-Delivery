import unittest
from skynav_ai.battery import BatteryPredictionEngine
from skynav_ai.models import BatteryFeasibility


class TestBatteryPrediction(unittest.TestCase):
    def setUp(self):
        self.engine = BatteryPredictionEngine()

    def test_safe_battery_prediction(self):
        res = self.engine.predict_battery(
            current_battery_percent=95.0,
            route_distance_meters=3000.0,
            package_weight_grams=1500.0
        )
        self.assertEqual(res.feasibility, BatteryFeasibility.SAFE)
        self.assertTrue(res.isReserveCompliant)
        self.assertGreater(res.estimatedArrivalBatteryPercent, 80.0)
        self.assertGreater(res.estimatedReturnReservePercent, 60.0)

    def test_infeasible_battery_prediction(self):
        res = self.engine.predict_battery(
            current_battery_percent=25.0,
            route_distance_meters=15000.0,
            package_weight_grams=4500.0
        )
        self.assertEqual(res.feasibility, BatteryFeasibility.NOT_FEASIBLE)
        self.assertFalse(res.isReserveCompliant)
        self.assertTrue(len(res.warnings) > 0)


if __name__ == "__main__":
    unittest.main()
