"""
Explainable Route Candidate Ranking & Advisory Scoring Engine for SkyNav.
Evaluates candidate flight corridors across kinematics, battery, weather, and operational priority.
"""

from __future__ import annotations
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple

from .models import (
    Coordinate,
    RouteCandidate,
    ScoredRouteCandidate,
    ScoreBreakdown,
    WeatherConditions,
    BatteryFeasibility,
    RiskLevel
)


def haversine_distance_meters(coord1: Coordinate, coord2: Coordinate) -> float:
    """Computes great-circle surface distance between two coordinates in meters."""
    R = 6371000.0  # Earth radius in meters
    lat1_rad = math.radians(coord1.latitude)
    lat2_rad = math.radians(coord2.latitude)
    dlat_rad = math.radians(coord2.latitude - coord1.latitude)
    dlon_rad = math.radians(coord2.longitude - coord1.longitude)

    a = math.sin(dlat_rad / 2.0) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon_rad / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def compute_3d_route_distance(waypoints: List[Coordinate]) -> float:
    """Computes total 3D cumulative distance along a list of waypoints."""
    if len(waypoints) < 2:
        return 0.0

    total = 0.0
    for i in range(len(waypoints) - 1):
        p1 = waypoints[i]
        p2 = waypoints[i + 1]
        h_dist = haversine_distance_meters(p1, p2)
        v_dist = abs((p2.altitudeMeters or 0.0) - (p1.altitudeMeters or 0.0))
        dist_3d = math.sqrt(h_dist ** 2 + v_dist ** 2)
        total += dist_3d
    return total


def initial_bearing_degrees(from_coord: Coordinate, to_coord: Coordinate) -> float:
    """Computes initial forward azimuth in degrees [0, 360)."""
    lat1 = math.radians(from_coord.latitude)
    lat2 = math.radians(to_coord.latitude)
    dlon = math.radians(to_coord.longitude - from_coord.longitude)

    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing_rad = math.atan2(y, x)
    bearing_deg = (math.degrees(bearing_rad) + 360.0) % 360.0
    return bearing_deg


class RouteScoringEngine:
    """
    Production-grade explainable route candidate ranking and scoring engine.
    """

    MODEL_VERSION = "advisory-route-scorer-v1.2.0"

    def __init__(
        self,
        base_cruise_speed_mps: float = 15.0,
        nominal_discharge_rate_pct_per_km: float = 3.2,
        max_acceptable_distance_meters: float = 25000.0,
        min_reserve_battery_percent: float = 20.0
    ):
        self.base_cruise_speed_mps = base_cruise_speed_mps
        self.nominal_discharge_rate_pct_per_km = nominal_discharge_rate_pct_per_km
        self.max_acceptable_distance_meters = max_acceptable_distance_meters
        self.min_reserve_battery_percent = min_reserve_battery_percent

    def score_candidates(
        self,
        candidates: List[RouteCandidate],
        package_weight_grams: float,
        drone_max_payload_grams: float = 5000.0,
        drone_battery_percent: float = 100.0,
        weather: Optional[WeatherConditions] = None,
        priority: str = "STANDARD"
    ) -> List[ScoredRouteCandidate]:
        """
        Ranks and scores all candidate routes with full explainability.
        """
        if not candidates:
            return []

        w = weather or WeatherConditions()
        now = datetime.now(timezone.utc)
        scored: List[ScoredRouteCandidate] = []

        # Find min and max distances across candidates for relative normalization
        distances = [compute_3d_route_distance(c.waypoints) for c in candidates]
        min_dist = min(distances) if distances else 1.0

        for candidate, total_dist in zip(candidates, distances):
            risk_factors: List[str] = []

            # 1. Kinematic flight time estimation
            target_speed = candidate.targetSpeedMps or self.base_cruise_speed_mps
            
            # Wind vector adjustment along primary route vector
            if len(candidate.waypoints) >= 2:
                primary_bearing = initial_bearing_degrees(candidate.waypoints[0], candidate.waypoints[-1])
                wind_angle_diff = math.radians(abs(w.windDirectionDegrees - primary_bearing))
                # Headwind / tailwind component
                wind_component = w.windSpeedMps * math.cos(wind_angle_diff)
                effective_speed = max(3.0, target_speed - wind_component * 0.7)
            else:
                effective_speed = target_speed

            # Add turn & vertical climb transition penalties (e.g. 5s per waypoint fix)
            fix_overhead_seconds = max(0, len(candidate.waypoints) - 2) * 4.0
            flight_time_seconds = (total_dist / effective_speed) + fix_overhead_seconds + 20.0  # +20s takeoff/landing
            predicted_eta = (now + timedelta(seconds=flight_time_seconds)).isoformat()

            # 2. Battery consumption estimation
            payload_ratio = min(1.5, max(0.0, package_weight_grams / max(1.0, drone_max_payload_grams)))
            weight_penalty = 1.0 + (payload_ratio * 0.45)
            wind_penalty = 1.0 + (max(0.0, w.windSpeedMps - 5.0) * 0.03)

            dist_km = total_dist / 1000.0
            est_consumption_pct = dist_km * self.nominal_discharge_rate_pct_per_km * weight_penalty * wind_penalty
            # Account for round-trip return to depot
            round_trip_consumption = est_consumption_pct * 1.85
            remaining_reserve = drone_battery_percent - round_trip_consumption

            if remaining_reserve >= self.min_reserve_battery_percent:
                batt_feasibility = BatteryFeasibility.SAFE
            elif remaining_reserve >= 10.0:
                batt_feasibility = BatteryFeasibility.CAUTION
                risk_factors.append(f"Low battery reserve margin: {remaining_reserve:.1f}% estimated at landing.")
            elif remaining_reserve >= 0.0:
                batt_feasibility = BatteryFeasibility.HIGH_RISK
                risk_factors.append(f"Critical battery reserve: {remaining_reserve:.1f}% barely reaches depot.")
            else:
                batt_feasibility = BatteryFeasibility.NOT_FEASIBLE
                risk_factors.append(f"Insufficient battery: deficit of {-remaining_reserve:.1f}%.")

            # 3. Weather risk classification
            weather_risk_score = 0.0
            if w.thunderstormRisk:
                w_risk_level = RiskLevel.CRITICAL
                weather_risk_score += 60.0
                risk_factors.append("Thunderstorm / convective activity detected along corridor.")
            elif w.windSpeedMps > 15.0 or w.windGustMps > 20.0:
                w_risk_level = RiskLevel.CRITICAL
                weather_risk_score += 50.0
                risk_factors.append(f"Excessive wind conditions: {w.windSpeedMps:.1f} m/s, gusts {w.windGustMps:.1f} m/s.")
            elif w.windSpeedMps > 10.0 or w.precipitationMmPerHour > 5.0:
                w_risk_level = RiskLevel.HIGH
                weather_risk_score += 35.0
                risk_factors.append(f"Elevated wind or precipitation: {w.windSpeedMps:.1f} m/s, {w.precipitationMmPerHour:.1f} mm/h.")
            elif w.windSpeedMps > 6.0 or w.visibilityMeters < 5000:
                w_risk_level = RiskLevel.MODERATE
                weather_risk_score += 15.0
                risk_factors.append(f"Moderate wind / reduced visibility ({w.visibilityMeters:.0f}m).")
            else:
                w_risk_level = RiskLevel.NORMAL
                weather_risk_score += 5.0

            # 4. Multi-factor Component Scoring (0-100 scales)
            # Distance Score: 100 for shortest route, decays for longer routes
            dist_ratio = total_dist / max(1.0, min_dist)
            distance_score = max(10.0, 100.0 - (dist_ratio - 1.0) * 50.0)

            # Time Score: 100 for fast, decays
            time_score = max(10.0, 100.0 - (flight_time_seconds / 60.0) * 3.5)

            # Battery Score
            if batt_feasibility == BatteryFeasibility.SAFE:
                battery_score = max(50.0, 100.0 - (round_trip_consumption * 0.8))
            elif batt_feasibility == BatteryFeasibility.CAUTION:
                battery_score = 45.0
            elif batt_feasibility == BatteryFeasibility.HIGH_RISK:
                battery_score = 20.0
            else:
                battery_score = 0.0

            # Weather Score
            weather_score = max(0.0, 100.0 - weather_risk_score)

            # Priority Bonus
            priority_bonus = 0.0
            if priority == "RUSH":
                priority_bonus = 5.0
            elif priority == "EMERGENCY":
                priority_bonus = 10.0

            # Composite Weighted Score
            composite_score = (
                distance_score * 0.30 +
                time_score * 0.25 +
                battery_score * 0.25 +
                weather_score * 0.20 +
                priority_bonus
            )
            composite_score = max(0.0, min(100.0, composite_score))
            composite_risk = max(0.0, min(100.0, 100.0 - composite_score))

            breakdown = ScoreBreakdown(
                distanceScore=round(distance_score, 1),
                timeScore=round(time_score, 1),
                batteryScore=round(battery_score, 1),
                weatherScore=round(weather_score, 1),
                priorityBonus=round(priority_bonus, 1)
            )

            # Recommendation reason formulation
            if batt_feasibility == BatteryFeasibility.NOT_FEASIBLE:
                rec_reason = "Not recommended due to insufficient battery reserve for round-trip return."
            elif w_risk_level == RiskLevel.CRITICAL:
                rec_reason = "High operational risk due to severe wind / convective weather conditions."
            elif dist_ratio <= 1.05:
                rec_reason = "Optimal flight corridor with shortest flight distance and safe battery margins."
            else:
                rec_reason = f"Alternative corridor (+{(total_dist - min_dist):.0f}m) with acceptable flight margins."

            scored.append(
                ScoredRouteCandidate(
                    id=candidate.id,
                    name=candidate.name or candidate.id,
                    rank=0,
                    score=composite_score,
                    totalDistanceMeters=total_dist,
                    estimatedFlightTimeSeconds=flight_time_seconds,
                    predictedEta=predicted_eta,
                    estimatedBatteryConsumptionPercent=round_trip_consumption,
                    batteryFeasibility=batt_feasibility,
                    weatherRiskLevel=w_risk_level,
                    compositeRiskScore=composite_risk,
                    isRecommended=False,
                    recommendationReason=rec_reason,
                    riskFactors=risk_factors,
                    scoreBreakdown=breakdown,
                    waypoints=candidate.waypoints
                )
            )

        # Sort candidates descending by score
        scored.sort(key=lambda x: x.score, reverse=True)

        # Assign ranks and mark top as recommended
        for idx, item in enumerate(scored):
            item.rank = idx + 1
            if idx == 0 and item.batteryFeasibility != BatteryFeasibility.NOT_FEASIBLE and item.weatherRiskLevel != RiskLevel.CRITICAL:
                item.isRecommended = True
            elif idx == 0:
                # Top candidate is unsafe; will still be top ranked advisory but clearly marked
                item.isRecommended = False

        return scored
