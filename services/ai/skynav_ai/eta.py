"""
Statistical and Kinematic ETA Prediction Engine for SkyNav.
Predicts flight duration, remaining flight time, and confidence intervals.
"""

from __future__ import annotations
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from .models import (
    Coordinate,
    EtaPredictionResult,
    ConfidenceInterval,
    WeatherConditions
)
from .routing import haversine_distance_meters, compute_3d_route_distance, initial_bearing_degrees


class EtaPredictionEngine:
    """
    Statistical and kinematic model for UAV arrival time estimation.
    """

    MODEL_VERSION = "eta-statistical-kinematics-v1.1.0"

    def __init__(self, default_cruise_speed_mps: float = 15.0):
        self.default_cruise_speed_mps = default_cruise_speed_mps

    def predict_eta(
        self,
        current_position: Coordinate,
        destination: Coordinate,
        current_speed_mps: float = 0.0,
        waypoints: Optional[List[Coordinate]] = None,
        package_weight_grams: float = 0.0,
        cruise_speed_mps: float = 15.0,
        weather: Optional[WeatherConditions] = None
    ) -> EtaPredictionResult:
        """
        Calculates predicted arrival time and confidence boundaries.
        """
        now = datetime.now(timezone.utc)
        w = weather or WeatherConditions()
        contributing_factors: List[str] = []

        # Compute remaining distance along waypoints or direct
        if waypoints and len(waypoints) >= 2:
            remaining_distance_meters = compute_3d_route_distance([current_position] + waypoints[1:])
        else:
            remaining_distance_meters = haversine_distance_meters(current_position, destination)
            alt_delta = abs((destination.altitudeMeters or 0.0) - (current_position.altitudeMeters or 0.0))
            remaining_distance_meters = math.sqrt(remaining_distance_meters ** 2 + alt_delta ** 2)

        # Baseline effective cruise speed
        effective_cruise_speed = max(5.0, cruise_speed_mps or self.default_cruise_speed_mps)

        # Weight penalty on speed (heavy payload drops cruise speed slightly)
        if package_weight_grams > 3000:
            payload_drag = (package_weight_grams - 3000) / 10000.0 * 1.5
            effective_cruise_speed = max(5.0, effective_cruise_speed - payload_drag)
            contributing_factors.append(f"Payload drag adjustment: -{payload_drag:.1f} m/s")

        # Wind component along track
        bearing = initial_bearing_degrees(current_position, destination)
        wind_diff_rad = math.radians(abs(w.windDirectionDegrees - bearing))
        headwind_mps = w.windSpeedMps * math.cos(wind_diff_rad)

        if abs(headwind_mps) > 1.0:
            speed_delta = headwind_mps * 0.75
            effective_cruise_speed = max(4.0, effective_cruise_speed - speed_delta)
            if headwind_mps > 0:
                contributing_factors.append(f"Headwind component (+{headwind_mps:.1f} m/s): speed reduced to {effective_cruise_speed:.1f} m/s")
            else:
                contributing_factors.append(f"Tailwind component ({-headwind_mps:.1f} m/s): speed assisted to {effective_cruise_speed:.1f} m/s")

        # Acceleration ramp-up from current speed
        acceleration_mps2 = 2.0  # nominal drone horizontal acceleration
        if current_speed_mps < effective_cruise_speed:
            accel_time = (effective_cruise_speed - current_speed_mps) / acceleration_mps2
            accel_dist = ((current_speed_mps + effective_cruise_speed) / 2.0) * accel_time
            if remaining_distance_meters > accel_dist:
                steady_dist = remaining_distance_meters - accel_dist
                cruise_time = steady_dist / effective_cruise_speed
                nominal_duration_seconds = accel_time + cruise_time
            else:
                nominal_duration_seconds = math.sqrt(2 * remaining_distance_meters / acceleration_mps2)
        else:
            nominal_duration_seconds = remaining_distance_meters / effective_cruise_speed

        # Touchdown / descent overhead (15s for descent and landing verification)
        touchdown_overhead = 15.0
        nominal_duration_seconds += touchdown_overhead

        # Statistical confidence bounds
        # P50 (median nominal), P90 (+15% for gusts and localized turbulence), P99 (+35% for holding patterns/delays)
        p50 = nominal_duration_seconds
        p90 = nominal_duration_seconds * (1.12 + (max(0.0, w.windGustMps - w.windSpeedMps) * 0.02))
        p99 = nominal_duration_seconds * 1.35

        confidence_score = 0.95
        if w.windSpeedMps > 10.0 or w.precipitationMmPerHour > 2.0:
            confidence_score = 0.82
        if w.thunderstormRisk:
            confidence_score = 0.50

        predicted_eta = (now + timedelta(seconds=p50)).isoformat()

        return EtaPredictionResult(
            modelVersion=self.MODEL_VERSION,
            predictedAt=now.isoformat(),
            predictedEta=predicted_eta,
            remainingDistanceMeters=remaining_distance_meters,
            estimatedDurationSeconds=p50,
            confidenceInterval=ConfidenceInterval(
                p50DurationSeconds=round(p50, 1),
                p90DurationSeconds=round(p90, 1),
                p99DurationSeconds=round(p99, 1)
            ),
            contributingFactors=contributing_factors,
            confidenceScore=confidence_score
        )
