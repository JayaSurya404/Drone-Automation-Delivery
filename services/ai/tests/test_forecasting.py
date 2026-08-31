import unittest
from skynav_ai.forecasting import DemandForecastingEngine


class TestDemandForecasting(unittest.TestCase):
    def setUp(self):
        self.engine = DemandForecastingEngine()

    def test_24hr_demand_forecast(self):
        res = self.engine.forecast_demand(
            organization_id="org-1",
            forecast_horizon_hours=24,
            base_hourly_orders=15.0,
            active_fleet_size=6
        )
        self.assertEqual(res.forecastHorizonHours, 24)
        self.assertEqual(len(res.hourlyForecast), 24)
        self.assertGreater(res.totalPredictedOrders, 100.0)
        self.assertGreater(res.recommendedFleetSize, 1)


if __name__ == "__main__":
    unittest.main()
