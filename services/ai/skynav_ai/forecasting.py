"""
Delivery Demand & Fleet Sizing Forecasting Engine for SkyNav.
Predicts hourly order arrival volumes and recommended active UAV fleet capacity.
"""

from __future__ import annotations
import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from .models import DemandForecastResult, HourlyDemandSlot


class DemandForecastingEngine:
    """
    Statistical time-series baseline for delivery volume forecasting and capacity sizing.
    """

    MODEL_VERSION = "demand-diurnal-baseline-v1.0.0"

    # Typical 24-hour diurnal delivery arrival multipliers (relative to average hourly volume)
    DIURNAL_HOURLY_WEIGHTS = [
        0.15, 0.10, 0.05, 0.05, 0.10, 0.20,  # 00:00 - 05:00 (Night)
        0.40, 0.80, 1.30, 1.60, 1.40, 1.80,  # 06:00 - 11:00 (Morning Rush)
        1.90, 1.50, 1.20, 1.30, 1.50, 1.95,  # 12:00 - 17:00 (Afternoon / Evening Surge)
        1.80, 1.40, 0.90, 0.60, 0.35, 0.20   # 18:00 - 23:00 (Late Night drop)
    ]

    def forecast_demand(
        self,
        organization_id: str,
        forecast_horizon_hours: int = 24,
        base_hourly_orders: float = 12.0,
        active_fleet_size: int = 5,
        target_date: Optional[str] = None
    ) -> DemandForecastResult:
        """
        Generates hourly predicted order volumes, surge factors, and recommended fleet allocation.
        """
        now = datetime.now(timezone.utc)
        current_hour = now.hour
        horizon = min(72, max(1, forecast_horizon_hours))

        slots: List[HourlyDemandSlot] = []
        total_orders = 0.0
        peak_hour = 0
        peak_orders = 0.0

        for i in range(horizon):
            hour_of_day = (current_hour + i) % 24
            weight = self.DIURNAL_HOURLY_WEIGHTS[hour_of_day]

            # Projected orders for this hour
            predicted_orders = base_hourly_orders * weight
            total_orders += predicted_orders

            if predicted_orders > peak_orders:
                peak_orders = predicted_orders
                peak_hour = hour_of_day

            # Sizing calculation: assumes 1 drone can execute ~3.2 deliveries per hour
            drones_needed = max(1, math.ceil(predicted_orders / 3.2))
            utilization = min(100.0, (predicted_orders / max(1, active_fleet_size * 3.2)) * 100.0)

            slots.append(
                HourlyDemandSlot(
                    hour=hour_of_day,
                    predictedOrders=predicted_orders,
                    surgeFactor=weight,
                    recommendedActiveDrones=drones_needed,
                    expectedUtilizationPercent=utilization
                )
            )

        # Recommended fleet size to handle 90th percentile peak demand
        rec_fleet_size = max(1, math.ceil(peak_orders / 2.8))

        return DemandForecastResult(
            modelVersion=self.MODEL_VERSION,
            generatedAt=now.isoformat(),
            organizationId=organization_id,
            forecastHorizonHours=horizon,
            totalPredictedOrders=total_orders,
            peakHour=peak_hour,
            peakPredictedOrders=peak_orders,
            recommendedFleetSize=rec_fleet_size,
            hourlyForecast=slots
        )
