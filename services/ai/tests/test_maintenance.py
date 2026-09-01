import unittest
from skynav_ai.maintenance import PredictiveMaintenanceEngine
from skynav_ai.models import RiskLevel, MaintenancePriority, ComponentStatus


class TestPredictiveMaintenance(unittest.TestCase):
    def setUp(self):
        self.engine = PredictiveMaintenanceEngine()

    def test_healthy_drone_assessment(self):
        res = self.engine.assess_maintenance_risk(
            drone_id="drone-001",
            call_sign="SKY-001",
            model="AeroHex V4",
            flight_hours=15.0,
            battery_cycles=20,
            battery_health_percent=98.0
        )
        self.assertEqual(res.overallRiskLevel, RiskLevel.NORMAL)
        self.assertEqual(res.maintenancePriority, MaintenancePriority.LOW)
        self.assertGreater(res.estimatedHoursToNextService, 50.0)

    def test_critical_degradation_assessment(self):
        res = self.engine.assess_maintenance_risk(
            drone_id="drone-005",
            call_sign="SKY-005",
            model="AeroHex V4",
            flight_hours=320.0,
            battery_cycles=290,
            battery_health_percent=72.0,
            emergency_events_count=2,
            recent_max_motor_temp_celsius=82.0,
            recent_vibration_rms=3.1
        )
        self.assertEqual(res.overallRiskLevel, RiskLevel.CRITICAL)
        self.assertEqual(res.maintenancePriority, MaintenancePriority.CRITICAL)
        self.assertTrue(any(c.status == ComponentStatus.CRITICAL for c in res.components))
        self.assertTrue(len(res.recommendedInspections) > 0)


if __name__ == "__main__":
    unittest.main()
