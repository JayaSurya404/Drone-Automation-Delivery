"""
Battery Consumption & Degradation Prediction Engine for SkyNav.
Calculates power draw profiles, round-trip return reserves, and feasibility states.
"""

from __future__ import annotations
import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from .models import BatteryPredictionResult, BatteryFeasibility


class BatteryPredictionEngine:
    """
    Physical-statistical battery consumption and reserve feasibility estimator.
    """

    MODEL_VERSION = "battery-kinematic-discharge-v1.2.0"

    def __init__(
        self,
        base_discharge_pct_per_km: float = 3.2,
        hover_discharge_pct_per_min: float = 1.2,
        mandatory_reserve_threshold_pct: float = 20.0,
        battery_capacity_mah: float = 10000.0
    ):
        self.base_discharge_pct_per_km = base_discharge_pct_per_km
        self.hover_discharge_pct_per_min = hover_discharge_pct_per_min
        self.mandatory_reserve_threshold_pct = mandatory_reserve_threshold_pct
        self.battery_capacity_mah = battery_capacity_mah

    def predict_battery(
        self,
        current_battery_percent: float,
        route_distance_meters: float,
        package_weight_grams: float = 0.0,
        drone_max_payload_grams: float = 5000.0,
        headwind_mps: float = 0.0,
        is_round_trip: bool = True
    ) -> BatteryPredictionResult:
        """
        Evaluates battery consumption, expected arrival level, and landing reserves.
        """
        now = datetime.now(timezone.utc)
        warnings: List[str] = []

        dist_km = max(0.0, route_distance_meters / 1000.0)

        # 1. Payload impact factor (up to +50% higher consumption at full payload)
        payload_ratio = min(1.5, max(0.0, package_weight_grams / max(1.0, drone_max_payload_grams)))
        payload_multiplier = 1.0 + (payload_ratio * 0.50)

        # 2. Environmental headwind penalty
        headwind_penalty = 1.0 + (max(0.0, headwind_mps) * 0.04)

        # 3. Forward leg consumption
        forward_consumption = dist_km * self.base_discharge_pct_per_km * payload_multiplier * headwind_penalty
        # Add hover / delivery maneuver overhead (2 minutes hover at drop zone)
        drop_overhead_pct = self.hover_discharge_pct_per_min * 2.0
        total_forward_consumption = forward_consumption + drop_overhead_pct

        # 4. Return leg consumption (unladen payload, zero cargo weight)
        if is_round_trip:
            # Return leg carries no payload weight -> multiplier 1.0
            return_consumption = dist_km * self.base_discharge_pct_per_km * 1.0 * (1.0 + max(0.0, -headwind_mps) * 0.04)
            total_mission_consumption = total_forward_consumption + return_consumption
        else:
            total_mission_consumption = total_forward_consumption

        # Calculate battery levels
        estimated_arrival_battery = max(0.0, current_battery_percent - total_forward_consumption)
        estimated_return_reserve = max(0.0, current_battery_percent - total_mission_consumption)

        # Estimate remaining flight time at average cruise discharge (e.g. 3.5% per minute)
        avg_burn_per_sec = (self.base_discharge_pct_per_km * 15.0 / 1000.0) / 60.0  # % per sec at 15 m/s
        avg_burn_per_sec = max(0.005, avg_burn_per_sec)
        flight_time_remaining = (current_battery_percent / avg_burn_per_sec)

        # Reserve compliance and feasibility classification
        is_compliant = estimated_return_reserve >= self.mandatory_reserve_threshold_pct

        if estimated_return_reserve >= self.mandatory_reserve_threshold_pct:
            feasibility = BatteryFeasibility.SAFE
        elif estimated_return_reserve >= 12.0:
            feasibility = BatteryFeasibility.CAUTION
            warnings.append(
                f"Landing reserve ({estimated_return_reserve:.1f}%) is below mandatory policy threshold ({self.mandatory_reserve_threshold_pct:.0f}%)."
            )
        elif estimated_return_reserve > 0.0:
            feasibility = BatteryFeasibility.HIGH_RISK
            warnings.append(
                f"Critical battery depletion risk! Return reserve ({estimated_return_reserve:.1f}%) is near exhaustion."
            )
        else:
            feasibility = BatteryFeasibility.NOT_FEASIBLE
            deficit = total_mission_consumption - current_battery_percent
            warnings.append(
                f"Flight plan is physically infeasible. Battery deficit of {deficit:.1f}%."
            )

        if current_battery_percent < 30.0:
            warnings.append(f"Drone starting battery is low ({current_battery_percent:.1f}%). Pre-flight recharge advised.")

        return BatteryPredictionResult(
            modelVersion=self.MODEL_VERSION,
            evaluatedAt=now.isoformat(),
            currentBatteryPercent=current_battery_percent,
            predictedConsumptionPercent=total_mission_consumption,
            estimatedArrivalBatteryPercent=estimated_arrival_battery,
            estimatedReturnReservePercent=estimated_return_reserve,
            estimatedFlightTimeRemainingSeconds=flight_time_remaining,
            feasibility=feasibility,
            isReserveCompliant=is_compliant,
            reserveThresholdPercent=self.mandatory_reserve_threshold_pct,
            warnings=warnings
        )
