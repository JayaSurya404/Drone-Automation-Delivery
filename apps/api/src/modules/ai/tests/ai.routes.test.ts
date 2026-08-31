import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { buildApp } from "../../../app.js";
import { DeterministicSafetyGate } from "../safety-gate.js";
import { AiClient } from "../ai.client.js";
import { createAiService } from "../ai.service.js";

const TEST_SECRET = "skynav-super-secure-jwt-signing-secret-key-32chars!";
const ORG_A_ID = "00000000-0000-0000-0000-000000000001";
const ORG_B_ID = "00000000-0000-0000-0000-000000000002";
const OPERATOR_USER_ID = "00000000-0000-0000-0000-000000000010";
const CUSTOMER_USER_ID = "00000000-0000-0000-0000-000000000020";

describe("AI Advisory & Safety Gate / Route & Domain Logic Tests", () => {
  let app: FastifyInstance;
  let operatorToken: string;
  let customerToken: string;
  let orgBOperatorToken: string;

  before(async () => {
    process.env.JWT_SECRET = TEST_SECRET;

    const safetyGate = new DeterministicSafetyGate();
    const aiClient = new AiClient();
    const aiService = createAiService({ aiClient, safetyGate });

    app = buildApp({
      aiService,
      aiClient,
      safetyGate,
      logger: false
    });
    await app.ready();

    operatorToken = app.jwt.sign({
      sub: OPERATOR_USER_ID,
      email: "operator@skynav.test",
      name: "Operator User",
      orgId: ORG_A_ID,
      orgName: "SkyNav Org A",
      role: "OPERATOR",
      permissions: ["missions:create", "missions:read", "fleet:read", "fleet:manage"]
    });

    customerToken = app.jwt.sign({
      sub: CUSTOMER_USER_ID,
      email: "customer@skynav.test",
      name: "Customer User",
      orgId: ORG_A_ID,
      orgName: "SkyNav Org A",
      role: "CUSTOMER",
      permissions: ["orders:create", "orders:read"]
    });

    orgBOperatorToken = app.jwt.sign({
      sub: "00000000-0000-0000-0000-000000000099",
      email: "orgb@skynav.test",
      name: "Org B Operator",
      orgId: ORG_B_ID,
      orgName: "SkyNav Org B",
      role: "OPERATOR",
      permissions: ["missions:create", "missions:read", "fleet:read"]
    });
  });

  it("scores candidate routes and ranks them explainably with advisory disclaimer", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/routes/score",
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: {
        packageWeightGrams: 1500,
        droneMaxPayloadGrams: 5000,
        droneBatteryPercent: 95,
        candidates: [
          {
            id: "route-direct",
            name: "Direct Route A",
            waypoints: [
              { latitude: 37.7749, longitude: -122.4194 },
              { latitude: 37.7845, longitude: -122.4082 }
            ],
            cruiseAltitudeMeters: 60,
            targetSpeedMps: 15
          },
          {
            id: "route-detour",
            name: "Detour Corridor B",
            waypoints: [
              { latitude: 37.7749, longitude: -122.4194 },
              { latitude: 37.795, longitude: -122.43 },
              { latitude: 37.7845, longitude: -122.4082 }
            ],
            cruiseAltitudeMeters: 60,
            targetSpeedMps: 15
          }
        ]
      }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.candidates.length, 2);
    assert.equal(body.recommendedRouteId, "route-direct");
    assert.ok(body.candidates[0].score > body.candidates[1].score);
    assert.ok(body.advisoryDisclaimer.includes("advisory recommendations only"));
  });

  it("predicts dynamic kinematic ETA with confidence intervals", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/eta/predict",
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: {
        currentPosition: { latitude: 37.7749, longitude: -122.4194 },
        destination: { latitude: 37.7845, longitude: -122.4082 },
        currentSpeedMps: 12.0
      }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.remainingDistanceMeters > 1000);
    assert.ok(body.estimatedDurationSeconds > 0);
    assert.ok(body.confidenceInterval.p90DurationSeconds >= body.confidenceInterval.p50DurationSeconds);
  });

  it("predicts battery consumption and feasibility reserve limits", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/battery/predict",
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: {
        droneId: "00000000-0000-0000-0000-000000000011",
        currentBatteryPercent: 85,
        routeDistanceMeters: 4000,
        packageWeightGrams: 2000
      }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.feasibility, "SAFE");
    assert.ok(body.isReserveCompliant);
    assert.ok(body.estimatedReturnReservePercent > 20.0);
  });

  it("evaluates predictive maintenance health and component wear", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/maintenance/predict",
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: {
        droneId: "00000000-0000-0000-0000-000000000011",
        callSign: "SKY-001",
        model: "AeroHex V4",
        flightHours: 45.5,
        batteryCycles: 30,
        batteryHealthPercent: 96
      }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.overallRiskLevel, "NORMAL");
    assert.equal(body.maintenancePriority, "LOW");
    assert.ok(body.components.length >= 2);
  });

  it("assesses weather risk against physical UAV operational boundaries", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/weather/risk",
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: {
        latitude: 37.7749,
        longitude: -122.4194,
        windSpeedMps: 4.0,
        windDirectionDegrees: 180,
        windGustMps: 5.5
      }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.riskLevel, "NORMAL");
    assert.ok(body.isFlightPermitted);
  });

  it("forecasts delivery demand curve and recommended active fleet size", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/forecasting/demand",
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: {
        forecastHorizonHours: 24,
        baseHourlyOrders: 15,
        activeFleetSize: 6
      }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.forecastHorizonHours, 24);
    assert.ok(body.totalPredictedOrders > 0);
    assert.ok(body.recommendedFleetSize >= 1);
  });

  it("runs composite Mission Plan Evaluation through Authoritative Deterministic Safety Gate", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/missions/evaluate-plan",
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: {
        orderId: "00000000-0000-0000-0000-000000000101",
        packageWeightGrams: 1500,
        origin: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 10 },
        destination: { latitude: 37.7845, longitude: -122.4082, altitudeMeters: 10 }
      }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.isMissionAuthorized);
    assert.ok(body.deterministicSafetyGate.passed);
    assert.ok(body.aiRecommendation !== undefined);
  });

  it("strictly enforces RBAC and rejects Customer from evaluating operator AI routes", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/routes/score",
      headers: { authorization: `Bearer ${customerToken}` },
      payload: {
        packageWeightGrams: 1500,
        candidates: [
          {
            id: "c1",
            waypoints: [
              { latitude: 37.7749, longitude: -122.4194 },
              { latitude: 37.7845, longitude: -122.4082 }
            ]
          }
        ]
      }
    });

    assert.equal(res.statusCode, 403);
  });

  it("deterministic safety gate overrules AI if candidate violates mandatory constraints", () => {
    const gate = new DeterministicSafetyGate();
    const unsafeCandidate = {
      id: "unsafe-corridor",
      name: "Unsafe Corridor",
      waypoints: [
        { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 60 },
        { latitude: 37.7845, longitude: -122.4082, altitudeMeters: 60 }
      ],
      cruiseAltitudeMeters: 180.0, // Illegal ceiling > 120m
      targetSpeedMps: 15.0
    };

    const evaluation = gate.evaluateCandidate({
      candidate: unsafeCandidate,
      packageWeightGrams: 6000, // Exceeds 5000g limit
      droneMaxPayloadGrams: 5000,
      droneBatteryPercent: 20.0,
      estimatedConsumptionPercent: 15.0 // Leaves 5%, below 20% reserve
    });

    assert.equal(evaluation.passed, false);
    assert.ok(evaluation.rejectionReasons.length >= 3);
    assert.equal(evaluation.payloadCheck.passed, false);
    assert.equal(evaluation.batteryReserveCheck.passed, false);
    assert.equal(evaluation.altitudeEnvelopeCheck.passed, false);
  });
});
