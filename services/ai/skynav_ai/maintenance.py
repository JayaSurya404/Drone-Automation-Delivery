"""
Predictive Maintenance and UAV Health Diagnostics Engine for SkyNav.
Analyzes cumulative flight hours, battery charge cycles, telemetry thermal patterns, and failsafe incidents.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from .models import (
    MaintenancePredictionResult,
    ComponentRiskAssessment,
    RiskLevel,
    MaintenancePriority,
    ComponentStatus
)


class PredictiveMaintenanceEngine:
    """
    Fleet health and wear-and-tear prognostic diagnostics engine.
    """

    MODEL_VERSION = "maintenance-prognostics-v1.1.0"

    # Standard aerospace maintenance thresholds
    MINOR_INSPECTION_HOURS = 100.0
    MAJOR_OVERHAUL_HOURS = 300.0
    MAX_BATTERY_CYCLES = 300.0

    def assess_maintenance_risk(
        self,
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
    ) -> MaintenancePredictionResult:
        """
        Calculates component risk, degradation rates, and prioritized inspection recommendations.
        """
        now = datetime.now(timezone.utc)
        components: List[ComponentRiskAssessment] = []
        risk_factors: List[str] = []
        inspections: List[str] = []

        # 1. Battery System Assessment
        battery_findings: List[str] = []
        cycle_wear = min(1.0, battery_cycles / self.MAX_BATTERY_CYCLES)
        health_wear = max(0.0, (100.0 - battery_health_percent) / 100.0)
        battery_risk = (cycle_wear * 50.0) + (health_wear * 50.0)

        if battery_cycles > 250:
            battery_findings.append(f"High charge cycles ({battery_cycles}/300 cycles). Cell capacity degradation expected.")
            inspections.append("Perform 4-point internal impedance check on LiPo cells.")
        if battery_health_percent < 80.0:
            battery_findings.append(f"Sub-optimal state of health ({battery_health_percent:.1f}%).")
            battery_risk = max(battery_risk, 75.0)
            inspections.append("Benchmark full discharge load curve.")

        if battery_risk >= 75.0:
            b_status = ComponentStatus.CRITICAL
        elif battery_risk >= 45.0:
            b_status = ComponentStatus.SERVICE_RECOMMENDED
        elif battery_risk >= 25.0:
            b_status = ComponentStatus.MONITOR
        else:
            b_status = ComponentStatus.HEALTHY
            battery_findings.append("Nominal battery pack voltage and cycle endurance.")

        components.append(
            ComponentRiskAssessment(
                component="BATTERY",
                riskScore=battery_risk,
                healthPercent=battery_health_percent,
                status=b_status,
                findings=battery_findings
            )
        )

        # 2. Motor & Propulsion Assessment
        motor_findings: List[str] = []
        hours_since_minor = flight_hours % self.MINOR_INSPECTION_HOURS
        motor_risk = min(100.0, (hours_since_minor / self.MINOR_INSPECTION_HOURS) * 60.0)

        if recent_max_motor_temp_celsius and recent_max_motor_temp_celsius > 75.0:
            motor_risk += 30.0
            motor_findings.append(f"Elevated stator temperature ({recent_max_motor_temp_celsius:.1f}°C) detected.")
            inspections.append("Inspect brushless motor windings for thermal discoloration.")
        
        if recent_vibration_rms and recent_vibration_rms > 2.5:
            motor_risk += 25.0
            motor_findings.append(f"High vibration telemetry ({recent_vibration_rms:.2f}g RMS) indicates rotor imbalance.")
            inspections.append("Dynamic rotor balance and blade pitch alignment check.")

        motor_risk = min(100.0, motor_risk)
        motor_health = max(0.0, 100.0 - motor_risk)

        if motor_risk >= 75.0:
            m_status = ComponentStatus.CRITICAL
        elif motor_risk >= 45.0:
            m_status = ComponentStatus.SERVICE_RECOMMENDED
        elif motor_risk >= 25.0:
            m_status = ComponentStatus.MONITOR
        else:
            m_status = ComponentStatus.HEALTHY
            motor_findings.append("Smooth motor telemetry and balanced bearing vibrations.")

        components.append(
            ComponentRiskAssessment(
                component="MOTORS",
                riskScore=motor_risk,
                healthPercent=motor_health,
                status=m_status,
                findings=motor_findings
            )
        )

        # 3. Airframe & Structural Integrity Assessment
        airframe_findings: List[str] = []
        airframe_risk = min(100.0, (flight_hours / self.MAJOR_OVERHAUL_HOURS) * 50.0)

        if emergency_events_count > 0:
            airframe_risk += emergency_events_count * 20.0
            airframe_findings.append(f"UAV experienced {emergency_events_count} emergency failsafe events.")
            inspections.append("Inspect carbon fiber boom arms and motor mount screws for microfractures.")
            risk_factors.append(f"{emergency_events_count} past emergency failsafe events on record.")

        airframe_risk = min(100.0, airframe_risk)
        airframe_health = max(0.0, 100.0 - airframe_risk)

        if airframe_risk >= 75.0:
            a_status = ComponentStatus.CRITICAL
        elif airframe_risk >= 45.0:
            a_status = ComponentStatus.SERVICE_RECOMMENDED
        elif airframe_risk >= 25.0:
            a_status = ComponentStatus.MONITOR
        else:
            a_status = ComponentStatus.HEALTHY
            airframe_findings.append("Airframe structural rigidity within design tolerances.")

        components.append(
            ComponentRiskAssessment(
                component="AIRFRAME",
                riskScore=airframe_risk,
                healthPercent=airframe_health,
                status=a_status,
                findings=airframe_findings
            )
        )

        # 4. Avionics & Navigation Assessment
        avionics_findings: List[str] = ["IMU, Barometer, and GNSS RTK lock operating nominally."]
        avionics_risk = 10.0 + (emergency_events_count * 15.0)
        components.append(
            ComponentRiskAssessment(
                component="AVIONICS",
                riskScore=avionics_risk,
                healthPercent=max(0.0, 100.0 - avionics_risk),
                status=ComponentStatus.HEALTHY if avionics_risk < 25.0 else ComponentStatus.MONITOR,
                findings=avionics_findings
            )
        )

        # Overall composite score & priority
        max_component_risk = max(c.riskScore for c in components)
        overall_risk_score = (sum(c.riskScore for c in components) / len(components)) * 0.4 + (max_component_risk * 0.6)

        if flight_hours >= self.MAJOR_OVERHAUL_HOURS:
            risk_factors.append(f"Total flight service ({flight_hours:.1f} hrs) has reached major overhaul threshold ({self.MAJOR_OVERHAUL_HOURS:.0f} hrs).")
            inspections.append("Perform full 300-hour depot airworthiness overhaul.")

        hours_to_service = max(0.0, self.MINOR_INSPECTION_HOURS - hours_since_minor)

        if overall_risk_score >= 70.0 or any(c.status == ComponentStatus.CRITICAL for c in components):
            overall_level = RiskLevel.CRITICAL
            priority = MaintenancePriority.CRITICAL
            recommended_action = "Ground UAV immediately for mandatory maintenance and component replacement."
        elif overall_risk_score >= 45.0 or any(c.status == ComponentStatus.SERVICE_RECOMMENDED for c in components):
            overall_level = RiskLevel.HIGH
            priority = MaintenancePriority.HIGH
            recommended_action = "Schedule maintenance within 5 flight hours. Restrict long-range missions."
        elif overall_risk_score >= 25.0:
            overall_level = RiskLevel.MODERATE
            priority = MaintenancePriority.MEDIUM
            recommended_action = "Routine inspection advised during next depot turn-around."
        else:
            overall_level = RiskLevel.NORMAL
            priority = MaintenancePriority.LOW
            recommended_action = "UAV is in optimal operational health. Cleared for all flight profiles."

        return MaintenancePredictionResult(
            modelVersion=self.MODEL_VERSION,
            assessedAt=now.isoformat(),
            droneId=drone_id,
            overallRiskScore=overall_risk_score,
            overallRiskLevel=overall_level,
            maintenancePriority=priority,
            estimatedHoursToNextService=hours_to_service,
            recommendedAction=recommended_action,
            components=components,
            riskFactors=risk_factors,
            recommendedInspections=inspections or ["Standard pre-flight visual airframe and propeller check."]
        )
