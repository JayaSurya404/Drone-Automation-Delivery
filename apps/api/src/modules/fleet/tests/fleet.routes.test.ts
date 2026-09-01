import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildApp } from "../../../app.js";
import { createMockAuthRepository } from "../../auth/tests/mock.repository.js";
import { createMockFleetRepository } from "./mock.repository.js";
import { createMockMissionRepository } from "../../missions/tests/mock.repository.js";
import { createMockOrderRepository } from "../../orders/tests/mock.repository.js";
import { createMockOutboxRepository } from "../../events/tests/mock.repository.js";
import { DefaultSimulatorGateway } from "../../missions/simulator.adapter.js";
import type { AuditService } from "../../audit/audit.service.js";
import type { UserRole, Permission } from "@skynav/contracts";

function createMockAuditService(): AuditService & { logs: any[] } {
  const logs: any[] = [];
  return {
    logs,
    async log(params) {
      logs.push({ id: crypto.randomUUID(), ...params, created_at: new Date() });
    },
    async list(orgId) {
      return logs.filter((l) => l.organizationId === orgId);
    }
  };
}

async function setupTestApp() {
  const authRepo = createMockAuthRepository();
  const fleetRepo = createMockFleetRepository();
  const orderRepo = createMockOrderRepository();
  const missionRepo = createMockMissionRepository(fleetRepo, orderRepo);
  const outboxRepo = createMockOutboxRepository();
  const auditService = createMockAuditService();
  const simulatorGateway = new DefaultSimulatorGateway();

  const app = buildApp({
    authRepo,
    fleetRepo,
    missionRepo,
    orderRepo,
    outboxRepo,
    auditService,
    simulatorGateway
  });
  await app.ready();

  const signToken = (user: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
    organizationName: string;
    role: UserRole;
    permissions: Permission[];
  }) => {
    return app.jwt.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      orgId: user.organizationId,
      orgName: user.organizationName,
      role: user.role,
      permissions: user.permissions
    });
  };

  return { app, authRepo, fleetRepo, missionRepo, orderRepo, outboxRepo, auditService, simulatorGateway, signToken };
}

const adminUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@alphanetics.test",
  name: "Alice Admin",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "ADMIN" as UserRole,
  permissions: ["drones:create", "drones:read", "drones:command", "fleet:manage", "fleet:read", "missions:read", "missions:command"] as Permission[]
};

const operatorUser = {
  id: "44444444-4444-4444-4444-444444444444",
  email: "op@alphanetics.test",
  name: "Dan Operator",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "OPERATOR" as UserRole,
  permissions: ["drones:read", "drones:command", "fleet:read", "missions:read", "missions:command"] as Permission[]
};

const customerUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "cust@alphanetics.test",
  name: "Bob Customer",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "CUSTOMER" as UserRole,
  permissions: ["orders:read", "orders:create", "orders:cancel"] as Permission[]
};

const otherOrgAdmin = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "admin@beta.test",
  name: "Charlie Admin",
  organizationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  organizationName: "Beta Logistics",
  role: "ADMIN" as UserRole,
  permissions: ["drones:create", "drones:read", "drones:command", "fleet:manage", "fleet:read", "missions:read", "missions:command"] as Permission[]
};

const validDronePayload = {
  callSign: "SKY-001",
  model: "SkyNav Hexacopter Alpha",
  maxPayloadGrams: 5000,
  batteryPercent: 100,
  currentLocation: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 },
  homeLocation: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 }
};

describe("Fleet / HTTP API Behavioral Integration", () => {
  it("1. rejects unauthenticated and unauthorized customer fleet creation (1, 21)", async () => {
    const { app, signToken } = await setupTestApp();

    // Unauthenticated -> 401
    const unauthRes = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      payload: validDronePayload
    });
    assert.equal(unauthRes.statusCode, 401);

    // Customer role without drones:create -> 403
    const customerToken = signToken(customerUser);
    const custRes = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      headers: { Authorization: `Bearer ${customerToken}` },
      payload: validDronePayload
    });
    assert.equal(custRes.statusCode, 403);
    assert.equal(JSON.parse(custRes.body).code, "INSUFFICIENT_PERMISSIONS");
  });

  it("2. allows authorized admin to create drone in fleet inventory", async () => {
    const { app, signToken, auditService } = await setupTestApp();
    const token = signToken(adminUser);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      headers: { Authorization: `Bearer ${token}` },
      payload: validDronePayload
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.data.id);
    assert.equal(body.data.callSign, "SKY-001");
    assert.equal(body.data.organizationId, adminUser.organizationId);
    assert.equal(body.data.status, "IDLE");

    // Audit log check
    assert.equal(auditService.logs.length, 1);
    assert.equal(auditService.logs[0].action, "DRONE_REGISTERED");
  });

  it("3. rejects invalid drone data (invalid coordinates, negative payload)", async () => {
    const { app, signToken } = await setupTestApp();
    const token = signToken(adminUser);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        ...validDronePayload,
        callSign: "SKY INVALID #!",
        maxPayloadGrams: -100
      }
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.code, "SCHEMA_VALIDATION_ERROR");
  });

  it("4, 5, 6. enforces organization isolation and prevents cross-tenant access and org spoofing", async () => {
    const { app, signToken } = await setupTestApp();
    const token1 = signToken(adminUser);
    const token2 = signToken(otherOrgAdmin);

    // Create drone in Org Alpha
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      headers: { Authorization: `Bearer ${token1}` },
      payload: validDronePayload
    });
    const droneId = JSON.parse(createRes.body).data.id;

    // Org Beta admin cannot retrieve Org Alpha's drone
    const crossGet = await app.inject({
      method: "GET",
      url: `/api/v1/drones/${droneId}`,
      headers: { Authorization: `Bearer ${token2}` }
    });
    assert.equal(crossGet.statusCode, 404);

    // Header org spoofing attempt is rejected with 403
    const spoofRes = await app.inject({
      method: "GET",
      url: `/api/v1/drones/${droneId}`,
      headers: {
        Authorization: `Bearer ${token1}`,
        "x-organization-id": otherOrgAdmin.organizationId
      }
    });
    assert.equal(spoofRes.statusCode, 403);
    assert.equal(JSON.parse(spoofRes.body).code, "CROSS_TENANT_ACCESS_DENIED");
  });

  it("7. handles duplicate drone call sign within same organization (409)", async () => {
    const { app, signToken } = await setupTestApp();
    const token = signToken(adminUser);

    // Create first drone
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      headers: { Authorization: `Bearer ${token}` },
      payload: validDronePayload
    });
    assert.equal(res1.statusCode, 201);

    // Attempt to register duplicate call sign
    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      headers: { Authorization: `Bearer ${token}` },
      payload: validDronePayload
    });
    assert.equal(res2.statusCode, 409);
    assert.equal(JSON.parse(res2.body).code, "DUPLICATE_DRONE_CALL_SIGN");
  });

  it("8. GET /api/v1/fleet/summary returns aggregated real-time fleet metrics scoped by tenant", async () => {
    const { app, fleetRepo, signToken } = await setupTestApp();
    const token = signToken(adminUser);

    await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: adminUser.organizationId,
      model_id: null,
      call_sign: "SKY-SUM-1",
      model: "AeroHex",
      serial_number: "SN-1",
      status: "IDLE",
      battery_percent: 95,
      max_payload_grams: 5000,
      current_latitude: 37.77,
      current_longitude: -122.41,
      current_altitude_meters: 0,
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: true
    });

    await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: adminUser.organizationId,
      model_id: null,
      call_sign: "SKY-SUM-2",
      model: "AeroHex",
      serial_number: "SN-2",
      status: "EN_ROUTE",
      battery_percent: 20, // Low battery (< 30%)
      max_payload_grams: 5000,
      current_latitude: 37.77,
      current_longitude: -122.41,
      current_altitude_meters: 60,
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: true
    });

    await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: adminUser.organizationId,
      model_id: null,
      call_sign: "SKY-SUM-3",
      model: "AeroHex",
      serial_number: "SN-3",
      status: "EMERGENCY",
      battery_percent: 10, // Critical battery (< 15%)
      max_payload_grams: 5000,
      current_latitude: 37.77,
      current_longitude: -122.41,
      current_altitude_meters: 40,
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: true
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/fleet/summary",
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.organizationId, adminUser.organizationId);
    assert.equal(body.data.totalDrones, 3);
    assert.equal(body.data.availableDrones, 1);
    assert.equal(body.data.inFlightDrones, 1);
    assert.equal(body.data.emergencyDrones, 1);
    assert.equal(body.data.lowBatteryDrones, 2); // 20% and 10%
    assert.equal(body.data.criticalBatteryDrones, 1); // 10%
  });

  it("9. GET /api/v1/drones/:droneId/detail returns full drone, active mission, order, and freshness context", async () => {
    const { app, fleetRepo, missionRepo, orderRepo, signToken } = await setupTestApp();
    const token = signToken(adminUser);

    const droneId = crypto.randomUUID();
    const orderId = crypto.randomUUID();
    const missionId = crypto.randomUUID();

    const drone = await fleetRepo.create({
      id: droneId,
      organization_id: adminUser.organizationId,
      model_id: null,
      call_sign: "SKY-DET-1",
      model: "AeroHex V4",
      serial_number: "SN-DET-1",
      status: "EN_ROUTE",
      battery_percent: 85,
      max_payload_grams: 5000,
      current_latitude: 37.775,
      current_longitude: -122.415,
      current_altitude_meters: 60,
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: true
    });

    const order = await orderRepo.create({
      id: orderId,
      organization_id: adminUser.organizationId,
      customer_id: customerUser.id,
      order_number: "ORD-DET-1",
      status: "IN_TRANSIT",
      priority: "STANDARD",
      pickup_latitude: 37.77,
      pickup_longitude: -122.41,
      pickup_altitude_meters: 0,
      delivery_latitude: 37.78,
      delivery_longitude: -122.40,
      delivery_altitude_meters: 0,
      package_weight_grams: 1200,
      package_length_cm: 15,
      package_width_cm: 15,
      package_height_cm: 10,
      package_description: "Lab Specimens"
    });

    await missionRepo.create({
      id: missionId,
      mission_number: "MSN-DET-1",
      organization_id: adminUser.organizationId,
      order_id: order.id,
      drone_id: drone.id,
      status: "IN_PROGRESS",
      origin_latitude: 37.77,
      origin_longitude: -122.41,
      destination_latitude: 37.78,
      destination_longitude: -122.40
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/drones/${drone.id}/detail`,
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.id, drone.id);
    assert.equal(body.data.callSign, "SKY-DET-1");
    assert.equal(body.data.freshness, "LIVE");
    assert.equal(body.data.activeMission.id, missionId);
    assert.equal(body.data.activeOrder.id, orderId);
    assert.equal(body.data.canRTH, true);
    assert.equal(body.data.canEmergency, true);
  });

  it("10. POST /api/v1/drones/:droneId/rth commands safe Return-To-Home", async () => {
    const { app, fleetRepo, signToken, auditService, outboxRepo } = await setupTestApp();
    const token = signToken(operatorUser);

    const drone = await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: adminUser.organizationId,
      model_id: null,
      call_sign: "SKY-RTH-1",
      model: "AeroHex V4",
      serial_number: "SN-RTH-1",
      status: "EN_ROUTE",
      battery_percent: 75,
      max_payload_grams: 5000,
      current_latitude: 37.775,
      current_longitude: -122.415,
      current_altitude_meters: 60,
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: true
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/drones/${drone.id}/rth`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { reason: "Weather deterioration along flight corridor" }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.success, true);
    assert.equal(body.data.command, "RTH");
    assert.equal(body.data.status, "RETURNING");

    // Drone state updated in repository
    const updatedDrone = await fleetRepo.findById(drone.id, adminUser.organizationId);
    assert.equal(updatedDrone?.status, "RETURNING");

    // Outbox & Audit events
    assert.ok(outboxRepo.events.some((e) => e.eventType === "DRONE_RETURNING"));
    assert.ok(auditService.logs.some((l) => l.action === "RETURN_TO_HOME_TRIGGERED"));
  });

  it("11. POST /api/v1/drones/:droneId/rth rejects idle or landed drones with 422", async () => {
    const { app, fleetRepo, signToken } = await setupTestApp();
    const token = signToken(adminUser);

    const drone = await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: adminUser.organizationId,
      model_id: null,
      call_sign: "SKY-IDLE",
      model: "AeroHex",
      serial_number: "SN-IDLE",
      status: "IDLE",
      battery_percent: 100,
      max_payload_grams: 5000,
      current_latitude: 37.77,
      current_longitude: -122.41,
      current_altitude_meters: 0,
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: true
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/drones/${drone.id}/rth`,
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 422);
    assert.equal(JSON.parse(res.body).code, "INVALID_DRONE_STATE_TRANSITION");
  });

  it("12. POST /api/v1/drones/:droneId/emergency triggers emergency halt and requires valid reason", async () => {
    const { app, fleetRepo, signToken, auditService, outboxRepo } = await setupTestApp();
    const token = signToken(operatorUser);

    const drone = await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: adminUser.organizationId,
      model_id: null,
      call_sign: "SKY-EMG-1",
      model: "AeroHex V4",
      serial_number: "SN-EMG-1",
      status: "EN_ROUTE",
      battery_percent: 60,
      max_payload_grams: 5000,
      current_latitude: 37.775,
      current_longitude: -122.415,
      current_altitude_meters: 60,
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: true
    });

    // Attempt without reason -> 400 validation error
    const noReasonRes = await app.inject({
      method: "POST",
      url: `/api/v1/drones/${drone.id}/emergency`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { reason: "  " }
    });
    assert.equal(noReasonRes.statusCode, 400);

    // Valid emergency command
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/drones/${drone.id}/emergency`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { reason: "Rotor vibration telemetry anomaly detected" }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.success, true);
    assert.equal(body.data.command, "EMERGENCY");
    assert.equal(body.data.status, "EMERGENCY");

    const updatedDrone = await fleetRepo.findById(drone.id, adminUser.organizationId);
    assert.equal(updatedDrone?.status, "EMERGENCY");

    // Outbox & Audit events
    assert.ok(outboxRepo.events.some((e) => e.eventType === "EMERGENCY_TRIGGERED"));
    assert.ok(auditService.logs.some((l) => l.action === "EMERGENCY_COMMAND_ISSUED"));
  });

  it("13. POST /api/v1/drones/:droneId/emergency/clear clears emergency state and resets status", async () => {
    const { app, fleetRepo, signToken, auditService, outboxRepo } = await setupTestApp();
    const token = signToken(adminUser);

    const drone = await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: adminUser.organizationId,
      model_id: null,
      call_sign: "SKY-EMG-CLR",
      model: "AeroHex",
      serial_number: "SN-CLR",
      status: "EMERGENCY",
      battery_percent: 80,
      max_payload_grams: 5000,
      current_latitude: 37.77,
      current_longitude: -122.41,
      current_altitude_meters: 0, // Landed on ground
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: true
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/drones/${drone.id}/emergency/clear`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { reason: "Hardware inspection cleared by maintenance team" }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.success, true);
    assert.equal(body.data.command, "EMERGENCY_CLEAR");
    assert.equal(body.data.status, "IDLE");

    const updatedDrone = await fleetRepo.findById(drone.id, adminUser.organizationId);
    assert.equal(updatedDrone?.status, "IDLE");

    // Outbox & Audit
    assert.ok(outboxRepo.events.some((e) => e.eventType === "EMERGENCY_CLEARED"));
    assert.ok(auditService.logs.some((l) => l.action === "DRONE_EMERGENCY_CLEARED"));
  });
});
