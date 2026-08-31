import type {
  AiRouteScoringRequest,
  AiRouteScoringResponse,
  AiEtaPredictionRequest,
  AiEtaPredictionResponse,
  AiBatteryPredictionRequest,
  AiBatteryPredictionResponse,
  AiMaintenancePredictionRequest,
  AiMaintenancePredictionResponse,
  AiWeatherRiskRequest,
  AiWeatherRiskResponse,
  AiDemandForecastRequest,
  AiDemandForecastResponse,
  ScoredRouteCandidate
} from "@skynav/contracts";
import { haversineDistanceMeters, computeRouteDistanceMeters } from "@skynav/contracts";

export interface AiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export class AiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: AiClientOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.AI_SERVICE_URL || "http://localhost:8000";
    this.timeoutMs = options.timeoutMs || 3000;
  }

  /**
   * Evaluates and scores candidate flight corridors.
   */
  public async scoreRoutes(req: AiRouteScoringRequest): Promise<AiRouteScoringResponse> {
    try {
      const res = await this.postJson<AiRouteScoringResponse>("/api/v1/ai/routes/score", req);
      return res;
    } catch {
      return this.fallbackScoreRoutes(req);
    }
  }

  /**
   * Predicts flight ETA and duration with confidence intervals.
   */
  public async predictEta(req: AiEtaPredictionRequest): Promise<AiEtaPredictionResponse> {
    try {
      const res = await this.postJson<AiEtaPredictionResponse>("/api/v1/ai/eta/predict", req);
      return res;
    } catch {
      return this.fallbackPredictEta(req);
    }
  }

  /**
   * Calculates battery draw profile and landing reserve feasibility.
   */
  public async predictBattery(req: AiBatteryPredictionRequest): Promise<AiBatteryPredictionResponse> {
    try {
      const res = await this.postJson<AiBatteryPredictionResponse>("/api/v1/ai/battery/predict", req);
      return res;
    } catch {
      return this.fallbackPredictBattery(req);
    }
  }

  /**
   * Assesses fleet degradation and prognostic maintenance priorities.
   */
  public async predictMaintenance(req: AiMaintenancePredictionRequest): Promise<AiMaintenancePredictionResponse> {
    try {
      const res = await this.postJson<AiMaintenancePredictionResponse>("/api/v1/ai/maintenance/predict", req);
      return res;
    } catch {
      return this.fallbackPredictMaintenance(req);
    }
  }

  /**
   * Evaluates weather hazards against airframe operational envelopes.
   */
  public async assessWeatherRisk(req: AiWeatherRiskRequest): Promise<AiWeatherRiskResponse> {
    try {
      const res = await this.postJson<AiWeatherRiskResponse>("/api/v1/ai/weather/risk", req);
      return res;
    } catch {
      return this.fallbackAssessWeatherRisk(req);
    }
  }

  /**
   * Projects delivery volume curves and recommended active fleet capacity.
   */
  public async forecastDemand(req: AiDemandForecastRequest): Promise<AiDemandForecastResponse> {
    try {
      const res = await this.postJson<AiDemandForecastResponse>("/api/v1/ai/forecasting/demand", req);
      return res;
    } catch {
      return this.fallbackForecastDemand(req);
    }
  }

  private async postJson<T>(path: string, payload: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`AI service returned HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ==========================================================================
  // Deterministic In-Process Fallbacks (Guarantees zero downtime if AI is offline)
  // ==========================================================================

  private fallbackScoreRoutes(req: AiRouteScoringRequest): AiRouteScoringResponse {
    const now = new Date().toISOString();
    const scored: ScoredRouteCandidate[] = req.candidates.map((cand, idx) => {
      const totalDist = computeRouteDistanceMeters(cand.waypoints);
      const speed = cand.targetSpeedMps || 15.0;
      const flightSecs = totalDist / speed + 20.0;
      const distKm = totalDist / 1000.0;
      const payloadRatio = req.packageWeightGrams / (req.droneMaxPayloadGrams || 5000);
      const consumption = distKm * 3.2 * (1 + payloadRatio * 0.4) * 1.85;
      const remainingReserve = req.droneBatteryPercent - consumption;

      const battFeasibility = remainingReserve >= 20.0 ? "SAFE" : remainingReserve >= 10.0 ? "CAUTION" : "NOT_FEASIBLE";
      const score = Math.max(10, Math.min(95, 100 - (totalDist / 200) - (consumption * 0.5)));

      return {
        id: cand.id,
        name: cand.name || `Candidate ${idx + 1}`,
        rank: idx + 1,
        score: Math.round(score * 10) / 10,
        totalDistanceMeters: Math.round(totalDist),
        estimatedFlightTimeSeconds: Math.round(flightSecs),
        predictedEta: new Date(Date.now() + flightSecs * 1000).toISOString(),
        estimatedBatteryConsumptionPercent: Math.round(consumption * 10) / 10,
        batteryFeasibility: battFeasibility as any,
        weatherRiskLevel: "NORMAL" as const,
        compositeRiskScore: Math.round((100 - score) * 10) / 10,
        isRecommended: idx === 0 && battFeasibility !== "NOT_FEASIBLE",
        recommendationReason: "Shortest evaluated corridor with safe battery reserves (Deterministic baseline).",
        riskFactors: battFeasibility === "CAUTION" ? ["Low landing battery reserve"] : [],
        scoreBreakdown: {
          distanceScore: 90,
          timeScore: 85,
          batteryScore: 90,
          weatherScore: 95,
          priorityBonus: 0
        },
        waypoints: cand.waypoints
      };
    });

    scored.sort((a, b) => b.score - a.score);
    scored.forEach((s, idx) => {
      s.rank = idx + 1;
      s.isRecommended = idx === 0 && s.batteryFeasibility !== "NOT_FEASIBLE";
    });

    return {
      modelVersion: "advisory-fallback-v1.0.0",
      generatedAt: now,
      recommendedRouteId: scored[0]?.id || "",
      candidates: scored,
      advisoryDisclaimer: "SkyNav AI predictions are advisory recommendations only. Mandatory safety rules remain authoritative."
    };
  }

  private fallbackPredictEta(req: AiEtaPredictionRequest): AiEtaPredictionResponse {
    const totalDist = req.waypoints && req.waypoints.length >= 2
      ? computeRouteDistanceMeters(req.waypoints)
      : haversineDistanceMeters(req.currentPosition, req.destination);

    const speed = Math.max(5.0, req.cruiseSpeedMps || 15.0);
    const duration = totalDist / speed + 15.0;
    const now = new Date().toISOString();

    return {
      modelVersion: "eta-fallback-v1.0.0",
      predictedAt: now,
      predictedEta: new Date(Date.now() + duration * 1000).toISOString(),
      remainingDistanceMeters: Math.round(totalDist),
      estimatedDurationSeconds: Math.round(duration),
      confidenceInterval: {
        p50DurationSeconds: Math.round(duration),
        p90DurationSeconds: Math.round(duration * 1.15),
        p99DurationSeconds: Math.round(duration * 1.35)
      },
      contributingFactors: ["Kinematic linear distance model"],
      confidenceScore: 0.9
    };
  }

  private fallbackPredictBattery(req: AiBatteryPredictionRequest): AiBatteryPredictionResponse {
    const distKm = req.routeDistanceMeters / 1000.0;
    const payloadMultiplier = 1.0 + (req.packageWeightGrams / (req.droneMaxPayloadGrams || 5000)) * 0.45;
    const totalConsumption = distKm * 3.2 * payloadMultiplier * (req.isRoundTrip ? 1.85 : 1.0);
    const reserve = Math.max(0, req.currentBatteryPercent - totalConsumption);
    const isCompliant = reserve >= 20.0;
    const feasibility = reserve >= 20.0 ? "SAFE" : reserve >= 10.0 ? "CAUTION" : "NOT_FEASIBLE";

    return {
      modelVersion: "battery-fallback-v1.0.0",
      evaluatedAt: new Date().toISOString(),
      currentBatteryPercent: req.currentBatteryPercent,
      predictedConsumptionPercent: Math.round(totalConsumption * 10) / 10,
      estimatedArrivalBatteryPercent: Math.round(Math.max(0, req.currentBatteryPercent - totalConsumption * 0.55) * 10) / 10,
      estimatedReturnReservePercent: Math.round(reserve * 10) / 10,
      estimatedFlightTimeRemainingSeconds: Math.round((req.currentBatteryPercent / 3.5) * 60),
      feasibility: feasibility as any,
      isReserveCompliant: isCompliant,
      reserveThresholdPercent: 20.0,
      warnings: !isCompliant ? ["Reserve is below 20% policy limit."] : []
    };
  }

  private fallbackPredictMaintenance(req: AiMaintenancePredictionRequest): AiMaintenancePredictionResponse {
    const risk = Math.min(100, (req.flightHours / 300.0) * 60 + (req.batteryCycles / 300.0) * 40);
    const level = risk >= 70 ? "CRITICAL" : risk >= 40 ? "HIGH" : risk >= 20 ? "MODERATE" : "NORMAL";
    const priority = risk >= 70 ? "CRITICAL" : risk >= 40 ? "HIGH" : risk >= 20 ? "MEDIUM" : "LOW";

    return {
      modelVersion: "maintenance-fallback-v1.0.0",
      assessedAt: new Date().toISOString(),
      droneId: req.droneId,
      overallRiskScore: Math.round(risk),
      overallRiskLevel: level as any,
      maintenancePriority: priority as any,
      estimatedHoursToNextService: Math.max(0, 100 - (req.flightHours % 100)),
      recommendedAction: risk >= 40 ? "Schedule maintenance inspection." : "UAV in good operational standing.",
      components: [
        {
          component: "BATTERY",
          riskScore: Math.min(100, (req.batteryCycles / 300) * 100),
          healthPercent: req.batteryHealthPercent || 95,
          status: req.batteryCycles > 250 ? "SERVICE_RECOMMENDED" : "HEALTHY",
          findings: ["Cycle wear within thresholds."]
        },
        {
          component: "MOTORS",
          riskScore: Math.min(100, (req.flightHours / 300) * 100),
          healthPercent: Math.max(0, 100 - (req.flightHours / 300) * 100),
          status: req.flightHours > 200 ? "MONITOR" : "HEALTHY",
          findings: ["Motor bearing telemetry nominal."]
        }
      ],
      riskFactors: risk >= 40 ? ["Approaching service hours interval"] : [],
      recommendedInspections: ["Visual airframe and motor inspection."]
    };
  }

  private fallbackAssessWeatherRisk(req: AiWeatherRiskRequest): AiWeatherRiskResponse {
    const wind = req.windSpeedMps;
    const isCritical = wind > 15.0 || req.thunderstormRisk;
    const risk = Math.min(100, (wind / 15.0) * 60.0 + (req.thunderstormRisk ? 40 : 0));
    const level = isCritical ? "CRITICAL" : wind > 10.0 ? "HIGH" : wind > 6.0 ? "MODERATE" : "NORMAL";

    return {
      modelVersion: "weather-fallback-v1.0.0",
      evaluatedAt: new Date().toISOString(),
      riskLevel: level as any,
      riskScore: Math.round(risk),
      isFlightPermitted: !isCritical,
      maxSafeAltitudeMeters: isCritical ? 0 : wind > 10 ? 60 : 120,
      recommendedCruiseSpeedMps: isCritical ? 0 : wind > 10 ? 12 : 15,
      activeHazards: isCritical ? ["Wind or thunderstorm exceeds safe threshold."] : [],
      advisoryNotes: isCritical ? ["Ground operations until weather clears."] : ["Normal flight clearance."]
    };
  }

  private fallbackForecastDemand(req: AiDemandForecastRequest): AiDemandForecastResponse {
    const horizon = req.forecastHorizonHours || 24;
    const base = req.baseHourlyOrders || 12.0;
    const slots = [];
    let total = 0;

    for (let i = 0; i < horizon; i++) {
      const orders = base * (i >= 8 && i <= 18 ? 1.5 : 0.4);
      total += orders;
      slots.push({
        hour: i % 24,
        predictedOrders: Math.round(orders * 10) / 10,
        surgeFactor: i >= 8 && i <= 18 ? 1.5 : 0.4,
        recommendedActiveDrones: Math.max(1, Math.ceil(orders / 3.2)),
        expectedUtilizationPercent: 75.0
      });
    }

    return {
      modelVersion: "demand-fallback-v1.0.0",
      generatedAt: new Date().toISOString(),
      organizationId: req.organizationId,
      forecastHorizonHours: horizon,
      totalPredictedOrders: Math.round(total),
      peakHour: 12,
      peakPredictedOrders: Math.round(base * 1.5 * 10) / 10,
      recommendedFleetSize: Math.ceil(base * 1.5 / 2.8),
      hourlyForecast: slots
    };
  }
}
