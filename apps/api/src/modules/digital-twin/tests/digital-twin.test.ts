import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { buildApp } from "../../../app.js";
import { createDigitalTwinService } from "../digital-twin.service.js";
import type { Telemetry, PerceptionEvent } from "@skynav/contracts";

const TEST_SECRET = "skynav-super-secure-jwt-signing-secret-key-32chars!";
const ORG_A_ID = "00000000-0000-0000-0000-000000000001";
const ORG_B_ID = "00000000-0000-0000-0000-000000000002";
const OPERATOR_USER_ID = "00000000-0000-0000-0000-000000000010";
const CUSTOMER_USER_ID = "00000000-0000-0000-0000-000000000020";

describe("Digital Twin Foundation / Domain Logic, Synchronization & Reconciliation Tests", () => {
  let app: FastifyInstance;
  let operatorToken: string;
  let customerToken: string;
  let orgBOperatorToken: string;
  let twinService: ReturnType<typeof createDigitalTwinService>;

  before(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    twinService = createDigitalTwinService();

    app = buildApp({
      digitalTwinService: twinService,
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
      permissions: ["digital-twin:read", "digital-twin:manage", "fleet:read", "missions:read"]
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
      permissions: ["digital-twin:read", "digital-twin:manage"]
    });
  });

  it("registers and initializes a drone twin in the domain state", () => {
    const drone = twinService.registerDroneState(ORG_A_ID, {
      id: "00000000-0000-0000-0000-000000000011",
      callSign: "SKY-101",
      model: "SkyNav Pelican Heavy",
      status: "IDLE",
      batteryPercent: 100,
      maxPayloadGrams: 5000,
      homeLatitude: 37.7749,
      homeLongitude: -122.4194
    });

    assert.equal(drone.callSign, "SKY-101");
    assert.equal(drone.operationalState, "IDLE");
    assert.equal(drone.battery.percent, 100);
    assert.equal(drone.health, "HEALTHY");
    assert.equal(drone.telemetryFreshness, "OFFLINE");
  });

  it("synchronizes telemetry into the drone twin and updates kinematics, battery, and freshness", async () => {
    const now = new Date().toISOString();
    const telemetry: Telemetry = {
      version: "v1",
      droneId: "00000000-0000-0000-0000-000000000011",
      organizationId: ORG_A_ID,
      observedAt: now,
      position: {
        latitude: 37.7780,
        longitude: -122.4150,
        altitudeMeters: 62.5
      },
      speedMetersPerSecond: 15.2,
      headingDegrees: 45.0,
      state: "EN_ROUTE",
      batteryPercent: 88.0
    };

    const updated = await twinService.ingestTelemetry(telemetry);
    assert.equal(updated.operationalState, "EN_ROUTE");
    assert.equal(updated.position.latitude, 37.7780);
    assert.equal(updated.position.altitudeMeters, 62.5);
    assert.equal(updated.groundSpeedMps, 15.2);
    assert.equal(updated.telemetryFreshness, "LIVE");
    assert.equal(updated.health, "HEALTHY");
  });

  it("protects against out-of-order delayed telemetry frames", async () => {
    const pastTimestamp = new Date(Date.now() - 100_000).toISOString();
    const staleTelem: Telemetry = {
      version: "v1",
      droneId: "00000000-0000-0000-0000-000000000011",
      organizationId: ORG_A_ID,
      observedAt: pastTimestamp,
      position: {
        latitude: 0,
        longitude: 0,
        altitudeMeters: 0
      },
      speedMetersPerSecond: 0,
      headingDegrees: 0,
      state: "IDLE",
      batteryPercent: 10
    };

    const res = await twinService.ingestTelemetry(staleTelem);
    // Should NOT overwrite with (0,0) or IDLE
    assert.equal(res.position.latitude, 37.7780);
    assert.equal(res.operationalState, "EN_ROUTE");
  });

  it("detects reconciliation discrepancies (altitude anomaly, low battery, state mismatch)", async () => {
    const anomalyTelem: Telemetry = {
      version: "v1",
      droneId: "00000000-0000-0000-0000-000000000011",
      organizationId: ORG_A_ID,
      observedAt: new Date().toISOString(),
      position: {
        latitude: 37.7790,
        longitude: -122.4140,
        altitudeMeters: 85.0 // Illegal altitude for DELIVERING (> 20m)
      },
      speedMetersPerSecond: 1.0,
      headingDegrees: 45.0,
      state: "DELIVERING",
      batteryPercent: 12.0 // Critical battery (< 15%)
    };

    const res = await twinService.ingestTelemetry(anomalyTelem);
    assert.ok(res.reconciliationWarnings.length >= 2);
    assert.ok(res.reconciliationWarnings.some(w => w.includes("Descent Altitude Anomaly")));
    assert.ok(res.reconciliationWarnings.some(w => w.includes("Critical Battery Reserve")));
    assert.equal(res.health, "CRITICAL");
  });

  it("ingests perception events and attaches optical analysis to Drone Twin", async () => {
    const perceptionEvt: PerceptionEvent = {
      type: "PERCEPTION_UPDATE",
      organizationId: ORG_A_ID,
      droneId: "00000000-0000-0000-0000-000000000011",
      timestamp: new Date().toISOString(),
      cameraSource: "DOWNWARD_NAV_CAM",
      landingSuitability: "SAFE",
      hazardsDetectedCount: 0,
      isTargetVerified: true,
      advisorySafetyStatus: "CLEAR",
      summary: "Landing zone clear."
    };

    const updated = await twinService.ingestPerception(perceptionEvt);
    assert.ok(updated);
    assert.equal(updated.perceptionState?.landingSuitability, "SAFE");
    assert.equal(updated.perceptionState?.isTargetVerified, true);
  });

  it("aggregates fleet twin metrics and generates health reports", async () => {
    const user = {
      id: OPERATOR_USER_ID,
      email: "operator@skynav.test",
      name: "Operator",
      organizationId: ORG_A_ID,
      organizationName: "Org A",
      role: "OPERATOR" as const,
      permissions: ["digital-twin:read" as const]
    };

    const fleet = await twinService.getFleetTwin(user);
    assert.equal(fleet.totalDrones, 1);
    assert.equal(fleet.batteryHealthSummary.criticalBatteryCount, 1);
    assert.ok(fleet.reconciliationDiscrepanciesCount > 0);

    const health = await twinService.getHealthReport(user);
    assert.equal(health.organizationId, ORG_A_ID);
    assert.equal(health.overallStatus, "CRITICAL");
    assert.ok(health.issues.length >= 2);
  });

  it("exposes REST endpoints with RBAC and valid payload responses", async () => {
    // 1. GET /api/v1/digital-twin/fleet
    const fleetRes = await app.inject({
      method: "GET",
      url: "/api/v1/digital-twin/fleet",
      headers: { authorization: `Bearer ${operatorToken}` }
    });
    assert.equal(fleetRes.statusCode, 200);
    assert.equal(fleetRes.json().organizationId, ORG_A_ID);

    // 2. GET /api/v1/digital-twin/drones/:droneId
    const droneRes = await app.inject({
      method: "GET",
      url: "/api/v1/digital-twin/drones/00000000-0000-0000-0000-000000000011",
      headers: { authorization: `Bearer ${operatorToken}` }
    });
    assert.equal(droneRes.statusCode, 200);
    assert.equal(droneRes.json().callSign, "SKY-101");

    // 3. GET /api/v1/digital-twin/health
    const healthRes = await app.inject({
      method: "GET",
      url: "/api/v1/digital-twin/health",
      headers: { authorization: `Bearer ${operatorToken}` }
    });
    assert.equal(healthRes.statusCode, 200);
    assert.ok(healthRes.json().issues.length > 0);

    // 4. GET /api/v1/digital-twin/snapshot
    const snapRes = await app.inject({
      method: "GET",
      url: "/api/v1/digital-twin/snapshot",
      headers: { authorization: `Bearer ${operatorToken}` }
    });
    assert.equal(snapRes.statusCode, 200);
    assert.equal(snapRes.json().version, "digital-twin-v1.0.0");
  });

  it("strictly prohibits Customer access and cross-tenant access", async () => {
    // Customer query -> 403 Forbidden
    const custRes = await app.inject({
      method: "GET",
      url: "/api/v1/digital-twin/fleet",
      headers: { authorization: `Bearer ${customerToken}` }
    });
    assert.equal(custRes.statusCode, 403);

    // Cross-tenant access: Org B attempts to query Org A's drone
    const crossRes = await app.inject({
      method: "GET",
      url: "/api/v1/digital-twin/drones/00000000-0000-0000-0000-000000000011",
      headers: { authorization: `Bearer ${orgBOperatorToken}` }
    });
    assert.equal(crossRes.statusCode, 404);
  });
});
