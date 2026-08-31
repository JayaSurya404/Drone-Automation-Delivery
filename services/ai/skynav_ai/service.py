"""
SkyNav Centralized AI Advisory Service Orchestrator.
Exposes high-level methods for Route Scoring, ETA, Battery, Maintenance, Weather, and Demand Forecasting.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from .models import (
    Coordinate,
    RouteCandidate,
    ScoredRouteCandidate,
    WeatherConditions,
    EtaPredictionResult,
    BatteryPredictionResult,
    MaintenancePredictionResult,
    WeatherRiskResult,
    DemandForecastResult
)
from .routing import RouteScoringEngine
from .eta import EtaPredictionEngine
from .battery import BatteryPredictionEngine
from .maintenance import PredictiveMaintenanceEngine
from .weather import WeatherIntelligenceEngine
from .forecasting import DemandForecastingEngine
from .safety import ADVISORY_DISCLAIMER


class SkyNavAiService:
    """
    Main entry point for all SkyNav advisory intelligence capabilities.
    """

    def __init__(self):
        self.routing_engine = RouteScoringEngine()
        self.eta_engine = EtaPredictionEngine()
        self.battery_engine = BatteryPredictionEngine()
        self.maintenance_engine = PredictiveMaintenanceEngine()
        self.weather_engine = WeatherIntelligenceEngine()
        self.forecasting_engine = DemandForecastingEngine()

    def score_routes(
        self,
        organization_id: str,
        candidates: List[RouteCandidate],
        package_weight_grams: float,
        drone_max_payload_grams: float = 5000.0,
        drone_battery_percent: float = 100.0,
        weather: Optional[WeatherConditions] = None,
        priority: str = "STANDARD"
    ) -> Dict[str, Any]:
        """Scores and ranks route candidates."""
        scored = self.routing_engine.score_candidates(
            candidates=candidates,
            package_weight_grams=package_weight_grams,
            drone_max_payload_grams=drone_max_payload_grams,
            drone_battery_percent=drone_battery_percent,
            weather=weather,
            priority=priority
        )

        recommended_id = scored[0].id if scored else ""

        return {
            "modelVersion": self.routing_engine.MODEL_VERSION,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "recommendedRouteId": recommended_id,
            "candidates": [s.to_dict() for s in scored],
            "advisoryDisclaimer": ADVISORY_DISCLAIMER
        }

    def predict_eta(
        self,
        organization_id: str,
        current_position: Coordinate,
        destination: Coordinate,
        current_speed_mps: float = 0.0,
        waypoints: Optional[List[Coordinate]] = None,
        package_weight_grams: float = 0.0,
        cruise_speed_mps: float = 15.0,
        weather: Optional[WeatherConditions] = None
    ) -> Dict[str, Any]:
        """Predicts remaining flight duration and confidence bounds."""
        res = self.eta_engine.predict_eta(
            current_position=current_position,
            destination=destination,
            current_speed_mps=current_speed_mps,
            waypoints=waypoints,
            package_weight_grams=package_weight_grams,
            cruise_speed_mps=cruise_speed_mps,
            weather=weather
        )
        data = res.to_dict()
        data["advisoryDisclaimer"] = ADVISORY_DISCLAIMER
        return data

    def predict_battery(
        self,
        organization_id: str,
        drone_id: str,
        current_battery_percent: float,
        route_distance_meters: float,
        package_weight_grams: float = 0.0,
        drone_max_payload_grams: float = 5000.0,
        headwind_mps: float = 0.0,
        is_round_trip: bool = True
    ) -> Dict[str, Any]:
        """Calculates expected power consumption, return reserve, and feasibility."""
        res = self.battery_engine.predict_battery(
            current_battery_percent=current_battery_percent,
            route_distance_meters=route_distance_meters,
            package_weight_grams=package_weight_grams,
            drone_max_payload_grams=drone_max_payload_grams,
            headwind_mps=headwind_mps,
            is_round_trip=is_round_trip
        )
        data = res.to_dict()
        data["advisoryDisclaimer"] = ADVISORY_DISCLAIMER
        return data

    def predict_maintenance(
        self,
        organization_id: str,
        drone_id: str,
        call_sign: str,
        model: str,
        flight_hours: float,
        battery_cycles: int = 0,
        battery_health_percent: float = 100.0,
        emergency_events_count: int = 0,
        last_maintenance_at: Optional[str] = None,
        recent_max_motor_temp_celsius: Optional[float] = None,
        recent_vibration_rms: Optional[float] = None
    ) -> Dict[str, Any]:
        """Assesses component wear, risks, and recommended actions."""
        res = self.maintenance_engine.assess_maintenance_risk(
            drone_id=drone_id,
            call_sign=call_sign,
            model=model,
            flight_hours=flight_hours,
            battery_cycles=battery_cycles,
            battery_health_percent=battery_health_percent,
            emergency_events_count=emergency_events_count,
            last_maintenance_at=last_maintenance_at,
            recent_max_motor_temp_celsius=recent_max_motor_temp_celsius,
            recent_vibration_rms=recent_vibration_rms
        )
        data = res.to_dict()
        data["advisoryDisclaimer"] = ADVISORY_DISCLAIMER
        return data

    def assess_weather_risk(
        self,
        latitude: float,
        longitude: float,
        wind_speed_mps: float,
        wind_direction_degrees: float,
        wind_gust_mps: float = 0.0,
        precipitation_mm_per_hour: float = 0.0,
        visibility_meters: float = 10000.0,
        temperature_celsius: float = 20.0,
        thunderstorm_risk: bool = False
    ) -> Dict[str, Any]:
        """Evaluates environmental risk against airframe operational envelopes."""
        w = WeatherConditions(
            windSpeedMps=wind_speed_mps,
            windDirectionDegrees=wind_direction_degrees,
            windGustMps=wind_gust_mps,
            precipitationMmPerHour=precipitation_mm_per_hour,
            visibilityMeters=visibility_meters,
            temperatureCelsius=temperature_celsius,
            thunderstormRisk=thunderstorm_risk
        )
        res = self.weather_engine.assess_weather_risk(w)
        data = res.to_dict()
        data["advisoryDisclaimer"] = ADVISORY_DISCLAIMER
        return data

    def forecast_demand(
        self,
        organization_id: str,
        forecast_horizon_hours: int = 24,
        base_hourly_orders: float = 12.0,
        active_fleet_size: int = 5,
        target_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Projects delivery volume curves and recommended fleet capacity."""
        res = self.forecasting_engine.forecast_demand(
            organization_id=organization_id,
            forecast_horizon_hours=forecast_horizon_hours,
            base_hourly_orders=base_hourly_orders,
            active_fleet_size=active_fleet_size,
            target_date=target_date
        )
        data = res.to_dict()
        data["advisoryDisclaimer"] = ADVISORY_DISCLAIMER
        return data


# Default singleton instance
ai_service = SkyNavAiService()
