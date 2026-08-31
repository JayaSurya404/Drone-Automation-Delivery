"""
Data models and typed structures for SkyNav AI Advisory Service.
Supports pure Python dataclasses with JSON serialization / dict conversion.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import List, Dict, Any, Optional
import math
from datetime import datetime, timezone


class RiskLevel(str, Enum):
    NORMAL = "NORMAL"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class BatteryFeasibility(str, Enum):
    SAFE = "SAFE"
    CAUTION = "CAUTION"
    HIGH_RISK = "HIGH_RISK"
    NOT_FEASIBLE = "NOT_FEASIBLE"


class MaintenancePriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ComponentStatus(str, Enum):
    HEALTHY = "HEALTHY"
    MONITOR = "MONITOR"
    SERVICE_RECOMMENDED = "SERVICE_RECOMMENDED"
    CRITICAL = "CRITICAL"


@dataclass
class Coordinate:
    latitude: float
    longitude: float
    altitudeMeters: Optional[float] = 0.0
    address: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "altitudeMeters": self.altitudeMeters,
            "address": self.address
        }


@dataclass
class WeatherConditions:
    windSpeedMps: float = 0.0
    windDirectionDegrees: float = 0.0
    windGustMps: float = 0.0
    precipitationMmPerHour: float = 0.0
    visibilityMeters: float = 10000.0
    temperatureCelsius: float = 20.0
    thunderstormRisk: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RouteCandidate:
    id: str
    name: Optional[str] = None
    waypoints: List[Coordinate] = field(default_factory=list)
    cruiseAltitudeMeters: float = 60.0
    targetSpeedMps: float = 15.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "waypoints": [w.to_dict() for w in self.waypoints],
            "cruiseAltitudeMeters": self.cruiseAltitudeMeters,
            "targetSpeedMps": self.targetSpeedMps
        }


@dataclass
class ScoreBreakdown:
    distanceScore: float
    timeScore: float
    batteryScore: float
    weatherScore: float
    priorityBonus: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ScoredRouteCandidate:
    id: str
    rank: int
    score: float
    totalDistanceMeters: float
    estimatedFlightTimeSeconds: float
    predictedEta: str
    estimatedBatteryConsumptionPercent: float
    batteryFeasibility: BatteryFeasibility
    weatherRiskLevel: RiskLevel
    compositeRiskScore: float
    isRecommended: bool
    recommendationReason: str
    riskFactors: List[str]
    scoreBreakdown: ScoreBreakdown
    waypoints: List[Coordinate]
    name: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "rank": self.rank,
            "score": round(self.score, 1),
            "totalDistanceMeters": round(self.totalDistanceMeters, 1),
            "estimatedFlightTimeSeconds": round(self.estimatedFlightTimeSeconds, 1),
            "predictedEta": self.predictedEta,
            "estimatedBatteryConsumptionPercent": round(self.estimatedBatteryConsumptionPercent, 1),
            "batteryFeasibility": self.batteryFeasibility.value if isinstance(self.batteryFeasibility, BatteryFeasibility) else str(self.batteryFeasibility),
            "weatherRiskLevel": self.weatherRiskLevel.value if isinstance(self.weatherRiskLevel, RiskLevel) else str(self.weatherRiskLevel),
            "compositeRiskScore": round(self.compositeRiskScore, 1),
            "isRecommended": self.isRecommended,
            "recommendationReason": self.recommendationReason,
            "riskFactors": self.riskFactors,
            "scoreBreakdown": self.scoreBreakdown.to_dict(),
            "waypoints": [w.to_dict() for w in self.waypoints]
        }


@dataclass
class ConfidenceInterval:
    p50DurationSeconds: float
    p90DurationSeconds: float
    p99DurationSeconds: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EtaPredictionResult:
    modelVersion: str
    predictedAt: str
    predictedEta: str
    remainingDistanceMeters: float
    estimatedDurationSeconds: float
    confidenceInterval: ConfidenceInterval
    contributingFactors: List[str]
    confidenceScore: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "modelVersion": self.modelVersion,
            "predictedAt": self.predictedAt,
            "predictedEta": self.predictedEta,
            "remainingDistanceMeters": round(self.remainingDistanceMeters, 1),
            "estimatedDurationSeconds": round(self.estimatedDurationSeconds, 1),
            "confidenceInterval": self.confidenceInterval.to_dict(),
            "contributingFactors": self.contributingFactors,
            "confidenceScore": round(self.confidenceScore, 2)
        }


@dataclass
class BatteryPredictionResult:
    modelVersion: str
    evaluatedAt: str
    currentBatteryPercent: float
    predictedConsumptionPercent: float
    estimatedArrivalBatteryPercent: float
    estimatedReturnReservePercent: float
    estimatedFlightTimeRemainingSeconds: float
    feasibility: BatteryFeasibility
    isReserveCompliant: bool
    reserveThresholdPercent: float
    warnings: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "modelVersion": self.modelVersion,
            "evaluatedAt": self.evaluatedAt,
            "currentBatteryPercent": round(self.currentBatteryPercent, 1),
            "predictedConsumptionPercent": round(self.predictedConsumptionPercent, 1),
            "estimatedArrivalBatteryPercent": round(self.estimatedArrivalBatteryPercent, 1),
            "estimatedReturnReservePercent": round(self.estimatedReturnReservePercent, 1),
            "estimatedFlightTimeRemainingSeconds": round(self.estimatedFlightTimeRemainingSeconds, 1),
            "feasibility": self.feasibility.value if isinstance(self.feasibility, BatteryFeasibility) else str(self.feasibility),
            "isReserveCompliant": self.isReserveCompliant,
            "reserveThresholdPercent": self.reserveThresholdPercent,
            "warnings": self.warnings
        }


@dataclass
class ComponentRiskAssessment:
    component: str
    riskScore: float
    healthPercent: float
    status: ComponentStatus
    findings: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "component": self.component,
            "riskScore": round(self.riskScore, 1),
            "healthPercent": round(self.healthPercent, 1),
            "status": self.status.value if isinstance(self.status, ComponentStatus) else str(self.status),
            "findings": self.findings
        }


@dataclass
class MaintenancePredictionResult:
    modelVersion: str
    assessedAt: str
    droneId: str
    overallRiskScore: float
    overallRiskLevel: RiskLevel
    maintenancePriority: MaintenancePriority
    estimatedHoursToNextService: float
    recommendedAction: str
    components: List[ComponentRiskAssessment]
    riskFactors: List[str]
    recommendedInspections: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "modelVersion": self.modelVersion,
            "assessedAt": self.assessedAt,
            "droneId": self.droneId,
            "overallRiskScore": round(self.overallRiskScore, 1),
            "overallRiskLevel": self.overallRiskLevel.value if isinstance(self.overallRiskLevel, RiskLevel) else str(self.overallRiskLevel),
            "maintenancePriority": self.maintenancePriority.value if isinstance(self.maintenancePriority, MaintenancePriority) else str(self.maintenancePriority),
            "estimatedHoursToNextService": round(self.estimatedHoursToNextService, 1),
            "recommendedAction": self.recommendedAction,
            "components": [c.to_dict() for c in self.components],
            "riskFactors": self.riskFactors,
            "recommendedInspections": self.recommendedInspections
        }


@dataclass
class WeatherRiskResult:
    modelVersion: str
    evaluatedAt: str
    riskLevel: RiskLevel
    riskScore: float
    isFlightPermitted: bool
    maxSafeAltitudeMeters: float
    recommendedCruiseSpeedMps: float
    activeHazards: List[str]
    advisoryNotes: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "modelVersion": self.modelVersion,
            "evaluatedAt": self.evaluatedAt,
            "riskLevel": self.riskLevel.value if isinstance(self.riskLevel, RiskLevel) else str(self.riskLevel),
            "riskScore": round(self.riskScore, 1),
            "isFlightPermitted": self.isFlightPermitted,
            "maxSafeAltitudeMeters": round(self.maxSafeAltitudeMeters, 1),
            "recommendedCruiseSpeedMps": round(self.recommendedCruiseSpeedMps, 1),
            "activeHazards": self.activeHazards,
            "advisoryNotes": self.advisoryNotes
        }


@dataclass
class HourlyDemandSlot:
    hour: int
    predictedOrders: float
    surgeFactor: float
    recommendedActiveDrones: int
    expectedUtilizationPercent: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hour": self.hour,
            "predictedOrders": round(self.predictedOrders, 1),
            "surgeFactor": round(self.surgeFactor, 2),
            "recommendedActiveDrones": self.recommendedActiveDrones,
            "expectedUtilizationPercent": round(self.expectedUtilizationPercent, 1)
        }


@dataclass
class DemandForecastResult:
    modelVersion: str
    generatedAt: str
    organizationId: str
    forecastHorizonHours: int
    totalPredictedOrders: float
    peakHour: int
    peakPredictedOrders: float
    recommendedFleetSize: int
    hourlyForecast: List[HourlyDemandSlot]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "modelVersion": self.modelVersion,
            "generatedAt": self.generatedAt,
            "organizationId": self.organizationId,
            "forecastHorizonHours": self.forecastHorizonHours,
            "totalPredictedOrders": round(self.totalPredictedOrders, 1),
            "peakHour": self.peakHour,
            "peakPredictedOrders": round(self.peakPredictedOrders, 1),
            "recommendedFleetSize": self.recommendedFleetSize,
            "hourlyForecast": [s.to_dict() for s in self.hourlyForecast]
        }
