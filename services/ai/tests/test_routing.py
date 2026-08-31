import unittest
from skynav_ai.models import Coordinate, RouteCandidate, WeatherConditions, BatteryFeasibility, RiskLevel
from skynav_ai.routing import RouteScoringEngine, haversine_distance_meters, compute_3d_route_distance, initial_bearing_degrees


class TestRouteScoring(unittest.TestCase):
    def setUp(self):
        self.engine = RouteScoringEngine()
        self.origin = Coordinate(latitude=37.7749, longitude=-122.4194, altitudeMeters=0)
        self.dest = Coordinate(latitude=37.7845, longitude=-122.4082, altitudeMeters=0)

    def test_haversine_and_3d_distance(self):
        dist = haversine_distance_meters(self.origin, self.dest)
        self.assertTrue(1400 < dist < 1600, f"Expected ~1450m, got {dist}")

        wps = [self.origin, Coordinate(latitude=37.780, longitude=-122.414, altitudeMeters=60), self.dest]
        dist_3d = compute_3d_route_distance(wps)
        self.assertGreater(dist_3d, dist)

    def test_initial_bearing(self):
        bearing = initial_bearing_degrees(self.origin, self.dest)
        self.assertTrue(0 <= bearing < 360)
        self.assertTrue(30 < bearing < 60, f"Expected NE bearing, got {bearing}")

    def test_candidate_ranking_and_explainability(self):
        c1 = RouteCandidate(
            id="direct",
            name="Direct Route",
            waypoints=[self.origin, self.dest]
        )
        c2 = RouteCandidate(
            id="detour",
            name="Detour Corridor",
            waypoints=[
                self.origin,
                Coordinate(latitude=37.795, longitude=-122.430, altitudeMeters=60),
                self.dest
            ]
        )

        scored = self.engine.score_candidates(
            candidates=[c1, c2],
            package_weight_grams=1500,
            drone_battery_percent=95.0
        )

        self.assertEqual(len(scored), 2)
        # Direct route should rank 1st with higher score
        self.assertEqual(scored[0].id, "direct")
        self.assertEqual(scored[0].rank, 1)
        self.assertTrue(scored[0].isRecommended)
        self.assertGreater(scored[0].score, scored[1].score)
        self.assertIn("scoreBreakdown", scored[0].to_dict())

    def test_severe_weather_and_low_battery_risk_penalty(self):
        c1 = RouteCandidate(id="route-1", waypoints=[self.origin, self.dest])
        
        # Test extreme wind
        severe_weather = WeatherConditions(windSpeedMps=22.0, windGustMps=28.0)
        scored_weather = self.engine.score_candidates(
            candidates=[c1],
            package_weight_grams=1000,
            weather=severe_weather
        )
        self.assertEqual(scored_weather[0].weatherRiskLevel, RiskLevel.CRITICAL)
        self.assertFalse(scored_weather[0].isRecommended)

        # Test critically low battery
        scored_battery = self.engine.score_candidates(
            candidates=[c1],
            package_weight_grams=1000,
            drone_battery_percent=1.0  # 1% starting battery cannot make round trip
        )
        self.assertEqual(scored_battery[0].batteryFeasibility, BatteryFeasibility.NOT_FEASIBLE)
        self.assertFalse(scored_battery[0].isRecommended)


if __name__ == "__main__":
    unittest.main()
