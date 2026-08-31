"""
Weather-Aware Meteorological Risk Assessment Engine for SkyNav.
Evaluates environmental flight conditions against operational envelope boundaries.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Dict, Any

from .models import WeatherConditions, WeatherRiskResult, RiskLevel


class WeatherIntelligenceEngine:
    """
    Meteorological safety and operational risk evaluator for UAV flight corridors.
    """

    MODEL_VERSION = "weather-risk-evaluator-v1.0.0"

    # Operational envelope limits
    MAX_PERMISSIBLE_WIND_MPS = 15.0
    MAX_PERMISSIBLE_GUST_MPS = 20.0
    MAX_PERMISSIBLE_PRECIP_MM_H = 8.0
    MIN_PERMISSIBLE_VISIBILITY_M = 1500.0

    def assess_weather_risk(self, weather: WeatherConditions) -> WeatherRiskResult:
        """
        Evaluates weather conditions and produces operational advisory guidelines.
        """
        now = datetime.now(timezone.utc)
        hazards: List[str] = []
        advisory_notes: List[str] = []
        risk_score = 0.0

        # 1. Wind & Gust Evaluation
        if weather.windSpeedMps > self.MAX_PERMISSIBLE_WIND_MPS:
            risk_score += 45.0
            hazards.append(f"Sustained wind speed ({weather.windSpeedMps:.1f} m/s) exceeds maximum flight envelope ({self.MAX_PERMISSIBLE_WIND_MPS:.0f} m/s).")
        elif weather.windSpeedMps > 10.0:
            risk_score += 25.0
            hazards.append(f"Elevated wind speed ({weather.windSpeedMps:.1f} m/s). Expect higher battery discharge.")
        elif weather.windSpeedMps > 6.0:
            risk_score += 10.0

        if weather.windGustMps > self.MAX_PERMISSIBLE_GUST_MPS:
            risk_score += 35.0
            hazards.append(f"Wind gusts ({weather.windGustMps:.1f} m/s) exceed airframe stability limits.")
        elif weather.windGustMps > 14.0:
            risk_score += 15.0
            hazards.append(f"Moderate wind gusts ({weather.windGustMps:.1f} m/s) detected.")

        # 2. Precipitation Evaluation
        if weather.precipitationMmPerHour > self.MAX_PERMISSIBLE_PRECIP_MM_H:
            risk_score += 40.0
            hazards.append(f"Heavy precipitation ({weather.precipitationMmPerHour:.1f} mm/h) poses water ingress risk.")
        elif weather.precipitationMmPerHour > 2.0:
            risk_score += 20.0
            hazards.append(f"Light-to-moderate rain ({weather.precipitationMmPerHour:.1f} mm/h). Reduced braking efficiency.")

        # 3. Visibility Evaluation
        if weather.visibilityMeters < self.MIN_PERMISSIBLE_VISIBILITY_M:
            risk_score += 30.0
            hazards.append(f"Low visibility ({weather.visibilityMeters:.0f}m) impairs visual sensing and obstacle clearance.")
        elif weather.visibilityMeters < 4000.0:
            risk_score += 10.0

        # 4. Thunderstorm / Convective Activity
        if weather.thunderstormRisk:
            risk_score += 60.0
            hazards.append("Severe convective activity / thunderstorm warning active in airspace.")

        # 5. Temperature extremes
        if weather.temperatureCelsius < -5.0:
            risk_score += 20.0
            hazards.append(f"Sub-freezing temperature ({weather.temperatureCelsius:.1f}°C). LiPo battery efficiency degraded.")
        elif weather.temperatureCelsius > 42.0:
            risk_score += 20.0
            hazards.append(f"High ambient temperature ({weather.temperatureCelsius:.1f}°C). Elevated motor and ESC thermal risk.")

        risk_score = max(0.0, min(100.0, risk_score))

        # Risk level determination
        if risk_score >= 60.0 or weather.thunderstormRisk or weather.windSpeedMps > self.MAX_PERMISSIBLE_WIND_MPS:
            risk_level = RiskLevel.CRITICAL
            is_permitted = False
            max_alt = 0.0
            recommended_speed = 0.0
            advisory_notes.append("Ground operations recommended until weather conditions clear.")
        elif risk_score >= 35.0:
            risk_level = RiskLevel.HIGH
            is_permitted = True
            max_alt = 50.0  # limit altitude to avoid stronger high-altitude winds
            recommended_speed = 12.0
            advisory_notes.append("Flight permissible with reduced cruise speed and altitude ceiling restriction.")
        elif risk_score >= 15.0:
            risk_level = RiskLevel.MODERATE
            is_permitted = True
            max_alt = 90.0
            recommended_speed = 14.0
            advisory_notes.append("Normal operations with automated wind drift compensation.")
        else:
            risk_level = RiskLevel.NORMAL
            is_permitted = True
            max_alt = 120.0
            recommended_speed = 16.0
            advisory_notes.append("Optimal meteorological conditions across entire corridor.")

        return WeatherRiskResult(
            modelVersion=self.MODEL_VERSION,
            evaluatedAt=now.isoformat(),
            riskLevel=risk_level,
            riskScore=risk_score,
            isFlightPermitted=is_permitted,
            maxSafeAltitudeMeters=max_alt,
            recommendedCruiseSpeedMps=recommended_speed,
            activeHazards=hazards,
            advisoryNotes=advisory_notes
        )
