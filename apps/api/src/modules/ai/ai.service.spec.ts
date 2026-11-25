import { AiDecisionLogService } from "./ai-decision-log.service";
import { AiService } from "./ai.service";
import { BatteryAwareRouterService } from "./battery-aware-router.service";
import { DeliveryRiskAnalyzerService } from "./delivery-risk-analyzer.service";
import { DroneSelectionService } from "./drone-selection.service";
import type { EtaPredictor } from "./interfaces/eta-predictor.interface";
import type { RouteOptimizationResult, RouteOptimizer, RouteOptimizerInput } from "./interfaces/route-optimizer.interface";

const SELECTED_ROUTE: RouteOptimizationResult = {
  selected: {
    id: "direct",
    isDirect: true,
    waypoints: [{ lat: 44.99, lng: -93.255, altitudeMeters: 60 }],
    distanceMeters: 1000,
    durationSeconds: 300,
    batteryFeasibility: { level: "SUFFICIENT", estimatedConsumptionPercent: 5, estimatedArrivalPercent: 95, requiredReservePercent: 25, reasons: [] },
    geofenceCleared: true,
    geofenceViolationZoneNames: [],
  },
  alternatives: [],
  reasons: ["Direct route selected"],
};

const NO_ROUTE: RouteOptimizationResult = { selected: null, alternatives: [], reasons: ["No feasible route"] };

const ROUTE_INPUT: RouteOptimizerInput = {
  origin: { lat: 44.9778, lng: -93.265 },
  destination: { lat: 44.99, lng: -93.25 },
  droneMaxSpeedMps: 15,
  droneMaxRangeKm: 10,
  weather: { windSpeedMps: 2, condition: "CLEAR", safetyLevel: "SAFE" },
};

describe("AiService", () => {
  let routeOptimizer: jest.Mocked<RouteOptimizer>;
  let etaPredictor: jest.Mocked<EtaPredictor>;
  let batteryAwareRouter: { evaluate: jest.Mock };
  let riskAnalyzer: { assess: jest.Mock };
  let droneSelection: { recommend: jest.Mock };
  let decisionLog: { record: jest.Mock; listForMission: jest.Mock; listForDelivery: jest.Mock };
  let service: AiService;

  beforeEach(() => {
    routeOptimizer = { optimize: jest.fn().mockResolvedValue(SELECTED_ROUTE) };
    etaPredictor = { predict: jest.fn().mockReturnValue({ etaAt: new Date(), durationSeconds: 300, confidence: "HIGH", factors: [], predictedAt: new Date() }) };
    batteryAwareRouter = { evaluate: jest.fn().mockReturnValue({ level: "SUFFICIENT", estimatedConsumptionPercent: 5, estimatedArrivalPercent: 95, requiredReservePercent: 25, reasons: [] }) };
    riskAnalyzer = { assess: jest.fn().mockReturnValue({ score: 10, level: "LOW", reasons: [] }) };
    droneSelection = { recommend: jest.fn().mockResolvedValue([{ droneId: "drone-1", droneName: "Falcon One", score: 90, eligible: true, reasons: [] }]) };
    decisionLog = { record: jest.fn().mockResolvedValue({}), listForMission: jest.fn().mockResolvedValue([]), listForDelivery: jest.fn().mockResolvedValue([]) };

    service = new AiService(
      routeOptimizer,
      etaPredictor,
      batteryAwareRouter as unknown as BatteryAwareRouterService,
      riskAnalyzer as unknown as DeliveryRiskAnalyzerService,
      droneSelection as unknown as DroneSelectionService,
      decisionLog as unknown as AiDecisionLogService,
    );
  });

  describe("optimizeRoute", () => {
    it("returns the optimizer's result and logs a ROUTE_OPTIMIZATION decision", async () => {
      const result = await service.optimizeRoute(ROUTE_INPUT, { deliveryId: "delivery-1" });
      expect(result).toBe(SELECTED_ROUTE);
      expect(decisionLog.record).toHaveBeenCalledWith(expect.objectContaining({ type: "ROUTE_OPTIMIZATION", deliveryId: "delivery-1", score: 1000 }));
    });

    it("logs a null score and a rejection summary when no route is feasible", async () => {
      routeOptimizer.optimize.mockResolvedValueOnce(NO_ROUTE);
      await service.optimizeRoute(ROUTE_INPUT, { deliveryId: "delivery-1" });
      expect(decisionLog.record).toHaveBeenCalledWith(expect.objectContaining({ type: "ROUTE_OPTIMIZATION", score: null, summary: expect.stringContaining("No feasible route") }));
    });
  });

  describe("rerouteAround", () => {
    it("calls the same optimizer but logs as a REROUTE decision", async () => {
      await service.rerouteAround(ROUTE_INPUT, { missionId: "mission-1" });
      expect(routeOptimizer.optimize).toHaveBeenCalledWith(ROUTE_INPUT);
      expect(decisionLog.record).toHaveBeenCalledWith(expect.objectContaining({ type: "REROUTE", missionId: "mission-1" }));
    });
  });

  describe("predictEta", () => {
    it("returns the predictor's result and logs an ETA_PREDICTION decision", async () => {
      const result = await service.predictEta(
        { distanceMeters: 1000, droneMaxSpeedMps: 15, windSpeedMps: 2, weatherCondition: "CLEAR", weatherSafetyLevel: "SAFE" },
        { deliveryId: "delivery-1", missionId: "mission-1" },
      );
      expect(result.confidence).toBe("HIGH");
      expect(decisionLog.record).toHaveBeenCalledWith(expect.objectContaining({ type: "ETA_PREDICTION", missionId: "mission-1" }));
    });
  });

  describe("assessRisk", () => {
    it("returns the analyzer's result and logs a RISK_ASSESSMENT decision", async () => {
      const result = await service.assessRisk(
        { weatherSafetyLevel: "SAFE", batteryFeasibilityLevel: "SUFFICIENT", distanceMeters: 500, droneMaxRangeKm: 10, droneBatteryHealthPercent: 100, priority: "STANDARD" },
        { missionId: "mission-1" },
      );
      expect(result.level).toBe("LOW");
      expect(decisionLog.record).toHaveBeenCalledWith(expect.objectContaining({ type: "RISK_ASSESSMENT", score: 10 }));
    });
  });

  describe("recommendDrones", () => {
    it("returns the ranked list and logs a DRONE_RECOMMENDATION decision naming the top eligible candidate", async () => {
      const result = await service.recommendDrones({ origin: { lat: 44.9778, lng: -93.265 }, distanceMeters: 1000, payloadKg: 1 }, { missionId: "mission-1" });
      expect(result).toHaveLength(1);
      expect(decisionLog.record).toHaveBeenCalledWith(expect.objectContaining({ type: "DRONE_RECOMMENDATION", score: 90, summary: expect.stringContaining("Falcon One") }));
    });

    it("logs a null score when no eligible candidate exists", async () => {
      droneSelection.recommend.mockResolvedValueOnce([]);
      await service.recommendDrones({ origin: { lat: 44.9778, lng: -93.265 }, distanceMeters: 1000, payloadKg: 1 }, { missionId: "mission-1" });
      expect(decisionLog.record).toHaveBeenCalledWith(expect.objectContaining({ type: "DRONE_RECOMMENDATION", score: null }));
    });
  });

  describe("peekDroneRecommendations", () => {
    it("returns recommendations without writing a decision log entry", async () => {
      const result = await service.peekDroneRecommendations({ origin: { lat: 44.9778, lng: -93.265 }, distanceMeters: 1000, payloadKg: 1 });
      expect(result).toHaveLength(1);
      expect(decisionLog.record).not.toHaveBeenCalled();
    });
  });

  describe("evaluateBatteryFeasibility", () => {
    it("passes through to BatteryAwareRouterService without writing a decision log entry", () => {
      const result = service.evaluateBatteryFeasibility(100, 1000);
      expect(result.level).toBe("SUFFICIENT");
      expect(decisionLog.record).not.toHaveBeenCalled();
    });
  });

  describe("decision log reads", () => {
    it("delegates getDecisionLogForMission/Delivery to AiDecisionLogService", async () => {
      await service.getDecisionLogForMission("mission-1", 10);
      await service.getDecisionLogForDelivery("delivery-1");
      expect(decisionLog.listForMission).toHaveBeenCalledWith("mission-1", 10);
      expect(decisionLog.listForDelivery).toHaveBeenCalledWith("delivery-1", undefined);
    });
  });
});
