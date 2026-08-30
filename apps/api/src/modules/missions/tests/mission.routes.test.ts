import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildApp } from "../../../app.js";
import { createMockAuthRepository } from "../../auth/tests/mock.repository.js";
import { createMockOrderRepository } from "../../orders/tests/mock.repository.js";
import { createMockFleetRepository } from "../../fleet/tests/mock.repository.js";
import { createMockMissionRepository } from "./mock.repository.js";
import { createSimulatorGateway } from "../simulator.adapter.js";
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
  const orderRepo = createMockOrderRepository();
  const fleetRepo = createMockFleetRepository();
  const missionRepo = createMockMissionRepository(fleetRepo, orderRepo);
  const simulatorGateway = createSimulatorGateway();
  const auditService = createMockAuditService();

  const app = buildApp({
    authRepo,
    orderRepo,
    fleetRepo,
    missionRepo,
    simulatorGateway,
    auditService
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

  return { app, authRepo, orderRepo, fleetRepo, missionRepo, simulatorGateway, auditService, signToken };
}

const operatorUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "operator@alpha.test",
  name: "Dan Operator",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "OPERATOR" as UserRole,
  permissions: ["orders:read", "orders:update", "missions:create", "missions:read", "missions:authorize", "missions:command", "drones:read", "drones:command"] as Permission[]
};

const customerUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "customer@alpha.test",
  name: "Alice Customer",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "CUSTOMER" as UserRole,
  permissions: ["orders:create", "orders:read", "orders:cancel"] as Permission[]
};

const tenant2Operator = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "operator@beta.test",
  name: "Bob Operator",
  organizationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  organizationName: "Beta Logistics",
  role: "OPERATOR" as UserRole,
  permissions: ["orders:read", "orders:update", "missions:create", "missions:read", "missions:authorize", "missions:command", "drones:read", "drones:command"] as Permission[]
};

describe("Missions / HTTP API Behavioral Integration", () => {
  it("8 & 9. enforces RBAC on mission creation (8, 9, 21)", async () => {
    const { app, orderRepo, signToken } = await setupTestApp();
    const opToken = signToken(operatorUser);
    const custToken = signToken(customerUser);

    // Create an order
    const order = await orderRepo.create({
      id: crypto.randomUUID(),
      order_number: "ORD-101",
      organization_id: operatorUser.organizationId,
      customer_id: customerUser.id,
      status: "CONFIRMED",
      priority: "STANDARD",
      pickup_latitude: 37.7749,
      pickup_longitude: -122.4194,
      pickup_altitude_meters: 10,
      pickup_address: "Hub Alpha",
      delivery_latitude: 37.7833,
      delivery_longitude: -122.4167,
      delivery_altitude_meters: 15,
      delivery_address: "Pad A",
      package_weight_grams: 500,
      package_length_cm: null,
      package_width_cm: null,
      package_height_cm: null,
      package_description: null,
      delivery_notes: null,
      cancellation_reason: null,
      cancelled_at: null,
      cancelled_by_user_id: null,
      failure_reason: null,
      failed_at: null,
      confirmed_at: new Date(),
      assigned_at: null,
      delivered_at: null
    });

    // 8. Customer cannot create mission (403 INSUFFICIENT_PERMISSIONS)
    const custCreate = await app.inject({
      method: "POST",
      url: "/api/v1/missions",
      headers: { Authorization: `Bearer ${custToken}` },
      payload: { orderId: order.id }
    });
    assert.equal(custCreate.statusCode, 403);

    // 9. Operator creates mission (201)
    const opCreate = await app.inject({
      method: "POST",
      url: "/api/v1/missions",
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { orderId: order.id }
    });
    assert.equal(opCreate.statusCode, 201);
    const body = JSON.parse(opCreate.body);
    assert.ok(body.data.id);
    assert.ok(body.data.missionNumber.startsWith("MSN-"));
    assert.equal(body.data.status, "PENDING");
  });

  it("10 & 11. rejects invalid or cross-tenant order references (10, 11)", async () => {
    const { app, orderRepo, signToken } = await setupTestApp();
    const opToken = signToken(operatorUser);
    const tenant2OpToken = signToken(tenant2Operator);

    // Create an order in Org Alpha
    const order = await orderRepo.create({
      id: crypto.randomUUID(),
      order_number: "ORD-102",
      organization_id: operatorUser.organizationId,
      customer_id: customerUser.id,
      status: "CONFIRMED",
      priority: "STANDARD",
      pickup_latitude: 37.7749,
      pickup_longitude: -122.4194,
      pickup_altitude_meters: 10,
      pickup_address: "Hub Alpha",
      delivery_latitude: 37.7833,
      delivery_longitude: -122.4167,
      delivery_altitude_meters: 15,
      delivery_address: "Pad A",
      package_weight_grams: 500,
      package_length_cm: null,
      package_width_cm: null,
      package_height_cm: null,
      package_description: null,
      delivery_notes: null,
      cancellation_reason: null,
      cancelled_at: null,
      cancelled_by_user_id: null,
      failure_reason: null,
      failed_at: null,
      confirmed_at: new Date(),
      assigned_at: null,
      delivered_at: null
    });

    // 10. Non-existent order reference (404)
    const nonExistentRes = await app.inject({
      method: "POST",
      url: "/api/v1/missions",
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { orderId: crypto.randomUUID() }
    });
    assert.equal(nonExistentRes.statusCode, 404);

    // 11. Cross-tenant operator referencing Org Alpha order (404)
    const crossTenantRes = await app.inject({
      method: "POST",
      url: "/api/v1/missions",
      headers: { Authorization: `Bearer ${tenant2OpToken}` },
      payload: { orderId: order.id }
    });
    assert.equal(crossTenantRes.statusCode, 404);
  });

  it("15, 16, 17, 18, 22. handles drone assignment rules, unavailability, cross-tenant rejection, and RBAC", async () => {
    const { app, orderRepo, fleetRepo, signToken } = await setupTestApp();
    const opToken = signToken(operatorUser);
    const custToken = signToken(customerUser);
    const tenant2OpToken = signToken(tenant2Operator);

    // Create order 1
    const order1 = await orderRepo.create({
      id: crypto.randomUUID(),
      order_number: "ORD-201",
      organization_id: operatorUser.organizationId,
      customer_id: customerUser.id,
      status: "CONFIRMED",
      priority: "STANDARD",
      pickup_latitude: 37.7749,
      pickup_longitude: -122.4194,
      pickup_altitude_meters: 10,
      pickup_address: "Hub Alpha",
      delivery_latitude: 37.7833,
      delivery_longitude: -122.4167,
      delivery_altitude_meters: 15,
      delivery_address: "Pad A",
      package_weight_grams: 500,
      package_length_cm: null,
      package_width_cm: null,
      package_height_cm: null,
      package_description: null,
      delivery_notes: null,
      cancellation_reason: null,
      cancelled_at: null,
      cancelled_by_user_id: null,
      failure_reason: null,
      failed_at: null,
      confirmed_at: new Date(),
      assigned_at: null,
      delivered_at: null
    });

    // Create drone 1 (Org Alpha)
    const drone1 = await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: operatorUser.organizationId,
      model_id: null,
      call_sign: "SKY-A1",
      model: "SkyNav Alpha",
      serial_number: null,
      status: "IDLE",
      battery_percent: 100,
      max_payload_grams: 5000,
      current_latitude: 37.7749,
      current_longitude: -122.4194,
      current_altitude_meters: 0,
      home_latitude: 37.7749,
      home_longitude: -122.4194,
      home_altitude_meters: 0,
      is_active: true
    });

    // Create drone 2 in Org Beta (Tenant 2)
    const droneBeta = await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: tenant2Operator.organizationId,
      model_id: null,
      call_sign: "SKY-B1",
      model: "SkyNav Alpha",
      serial_number: null,
      status: "IDLE",
      battery_percent: 100,
      max_payload_grams: 5000,
      current_latitude: 37.7749,
      current_longitude: -122.4194,
      current_altitude_meters: 0,
      home_latitude: 37.7749,
      home_longitude: -122.4194,
      home_altitude_meters: 0,
      is_active: true
    });

    // Create mission 1
    const createMissionRes = await app.inject({
      method: "POST",
      url: "/api/v1/missions",
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { orderId: order1.id }
    });
    const mission1Id = JSON.parse(createMissionRes.body).data.id;

    // 22. Customer cannot assign drone (403)
    const custAssign = await app.inject({
      method: "POST",
      url: `/api/v1/missions/${mission1Id}/assign`,
      headers: { Authorization: `Bearer ${custToken}` },
      payload: { droneId: drone1.id }
    });
    assert.equal(custAssign.statusCode, 403);

    // 17. Cross-tenant drone cannot be assigned (404)
    const crossDroneAssign = await app.inject({
      method: "POST",
      url: `/api/v1/missions/${mission1Id}/assign`,
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { droneId: droneBeta.id }
    });
    assert.equal(crossDroneAssign.statusCode, 404);

    // 15. Valid drone assignment succeeds (200)
    const validAssign = await app.inject({
      method: "POST",
      url: `/api/v1/missions/${mission1Id}/assign`,
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { droneId: drone1.id }
    });
    assert.equal(validAssign.statusCode, 200);
    assert.equal(JSON.parse(validAssign.body).data.status, "ASSIGNED");
    assert.equal(JSON.parse(validAssign.body).data.droneId, drone1.id);

    // 18. Attempting to assign the SAME already-assigned drone to a new mission fails (422)
    const order2 = await orderRepo.create({
      id: crypto.randomUUID(),
      order_number: "ORD-202",
      organization_id: operatorUser.organizationId,
      customer_id: customerUser.id,
      status: "CONFIRMED",
      priority: "STANDARD",
      pickup_latitude: 37.7749,
      pickup_longitude: -122.4194,
      pickup_altitude_meters: 10,
      pickup_address: "Hub Alpha",
      delivery_latitude: 37.7833,
      delivery_longitude: -122.4167,
      delivery_altitude_meters: 15,
      delivery_address: "Pad B",
      package_weight_grams: 500,
      package_length_cm: null,
      package_width_cm: null,
      package_height_cm: null,
      package_description: null,
      delivery_notes: null,
      cancellation_reason: null,
      cancelled_at: null,
      cancelled_by_user_id: null,
      failure_reason: null,
      failed_at: null,
      confirmed_at: new Date(),
      assigned_at: null,
      delivered_at: null
    });

    const createMission2Res = await app.inject({
      method: "POST",
      url: "/api/v1/missions",
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { orderId: order2.id }
    });
    const mission2Id = JSON.parse(createMission2Res.body).data.id;

    // 16 & 18. Assign busy drone1 to mission2 -> rejected with 422
    const duplicateDroneAssign = await app.inject({
      method: "POST",
      url: `/api/v1/missions/${mission2Id}/assign`,
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { droneId: drone1.id }
    });
    assert.equal(duplicateDroneAssign.statusCode, 422);
    assert.equal(JSON.parse(duplicateDroneAssign.body).code, "DRONE_NOT_AVAILABLE");
  });

  it("12 & 13. enforces valid and invalid mission state transitions on PATCH /status", async () => {
    const { app, orderRepo, fleetRepo, signToken } = await setupTestApp();
    const opToken = signToken(operatorUser);

    const order = await orderRepo.create({
      id: crypto.randomUUID(),
      order_number: "ORD-301",
      organization_id: operatorUser.organizationId,
      customer_id: customerUser.id,
      status: "CONFIRMED",
      priority: "STANDARD",
      pickup_latitude: 37.7749,
      pickup_longitude: -122.4194,
      pickup_altitude_meters: 10,
      pickup_address: "Hub Alpha",
      delivery_latitude: 37.7833,
      delivery_longitude: -122.4167,
      delivery_altitude_meters: 15,
      delivery_address: "Pad A",
      package_weight_grams: 500,
      package_length_cm: null,
      package_width_cm: null,
      package_height_cm: null,
      package_description: null,
      delivery_notes: null,
      cancellation_reason: null,
      cancelled_at: null,
      cancelled_by_user_id: null,
      failure_reason: null,
      failed_at: null,
      confirmed_at: new Date(),
      assigned_at: null,
      delivered_at: null
    });

    const drone = await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: operatorUser.organizationId,
      model_id: null,
      call_sign: "SKY-301",
      model: "SkyNav Alpha",
      serial_number: null,
      status: "IDLE",
      battery_percent: 100,
      max_payload_grams: 5000,
      current_latitude: 37.7749,
      current_longitude: -122.4194,
      current_altitude_meters: 0,
      home_latitude: 37.7749,
      home_longitude: -122.4194,
      home_altitude_meters: 0,
      is_active: true
    });

    // Create and assign mission
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/missions",
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { orderId: order.id }
    });
    const missionId = JSON.parse(createRes.body).data.id;

    await app.inject({
      method: "POST",
      url: `/api/v1/missions/${missionId}/assign`,
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { droneId: drone.id }
    });

    // 12. Valid transition: ASSIGNED -> LAUNCHING -> IN_PROGRESS -> DELIVERING -> RETURNING -> COMPLETED
    const launchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/missions/${missionId}/status`,
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { status: "LAUNCHING" }
    });
    assert.equal(launchRes.statusCode, 200);
    assert.equal(JSON.parse(launchRes.body).data.status, "LAUNCHING");

    const inProgRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/missions/${missionId}/status`,
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { status: "IN_PROGRESS" }
    });
    assert.equal(inProgRes.statusCode, 200);

    // 13. Invalid backward transition: IN_PROGRESS -> PENDING fails with 422
    const badTransition = await app.inject({
      method: "PATCH",
      url: `/api/v1/missions/${missionId}/status`,
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { status: "PENDING" }
    });
    assert.equal(badTransition.statusCode, 422);
    assert.equal(JSON.parse(badTransition.body).code, "INVALID_MISSION_STATE_TRANSITION");
  });

  it("14. GET /api/v1/missions/:missionId/detail returns detailed mission, order, drone, and 3D flight waypoints", async () => {
    const { app, orderRepo, fleetRepo, missionRepo, signToken } = await setupTestApp();
    const opToken = signToken(operatorUser);

    const order = await orderRepo.create({
      id: crypto.randomUUID(),
      order_number: "ORD-DET-101",
      organization_id: operatorUser.organizationId,
      customer_id: customerUser.id,
      status: "ASSIGNED",
      priority: "STANDARD",
      pickup_latitude: 37.7749,
      pickup_longitude: -122.4194,
      pickup_altitude_meters: 0,
      delivery_latitude: 37.7850,
      delivery_longitude: -122.4100,
      delivery_altitude_meters: 0,
      package_weight_grams: 800,
      package_length_cm: 10,
      package_width_cm: 10,
      package_height_cm: 10,
      package_description: "Medical Vaccine Cooler"
    });

    const drone = await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: operatorUser.organizationId,
      model_id: null,
      call_sign: "SKY-MSN-DET",
      model: "AeroHex V4",
      serial_number: "SN-999",
      status: "ASSIGNED",
      battery_percent: 92,
      max_payload_grams: 5000,
      current_latitude: 37.7749,
      current_longitude: -122.4194,
      current_altitude_meters: 0,
      home_latitude: 37.7749,
      home_longitude: -122.4194,
      home_altitude_meters: 0,
      is_active: true
    });

    const mission = await missionRepo.create({
      id: crypto.randomUUID(),
      mission_number: "MSN-DETAIL-TEST",
      organization_id: operatorUser.organizationId,
      order_id: order.id,
      drone_id: drone.id,
      status: "ASSIGNED",
      origin_latitude: 37.7749,
      origin_longitude: -122.4194,
      destination_latitude: 37.7850,
      destination_longitude: -122.4100
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/missions/${mission.id}/detail`,
      headers: { Authorization: `Bearer ${opToken}` }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.id, mission.id);
    assert.equal(body.data.order.orderNumber, "ORD-DET-101");
    assert.equal(body.data.drone.callSign, "SKY-MSN-DET");
    assert.ok(body.data.waypoints.length >= 3);
    assert.equal(body.data.canCancel, true);
  });

  it("15. POST /api/v1/missions/:missionId/cancel safely cancels active mission and commands drone RTH", async () => {
    const { app, orderRepo, fleetRepo, missionRepo, signToken, auditService } = await setupTestApp();
    const opToken = signToken(operatorUser);

    const order = await orderRepo.create({
      id: crypto.randomUUID(),
      order_number: "ORD-CANCEL-1",
      organization_id: operatorUser.organizationId,
      customer_id: customerUser.id,
      status: "IN_TRANSIT",
      priority: "STANDARD",
      pickup_latitude: 37.7749,
      pickup_longitude: -122.4194,
      pickup_altitude_meters: 0,
      delivery_latitude: 37.7850,
      delivery_longitude: -122.4100,
      delivery_altitude_meters: 0,
      package_weight_grams: 800,
      package_length_cm: 10,
      package_width_cm: 10,
      package_height_cm: 10,
      package_description: "Documents"
    });

    const drone = await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: operatorUser.organizationId,
      model_id: null,
      call_sign: "SKY-CAN-1",
      model: "AeroHex V4",
      serial_number: "SN-CAN-1",
      status: "EN_ROUTE",
      battery_percent: 88,
      max_payload_grams: 5000,
      current_latitude: 37.7780,
      current_longitude: -122.4150,
      current_altitude_meters: 60,
      home_latitude: 37.7749,
      home_longitude: -122.4194,
      home_altitude_meters: 0,
      is_active: true
    });

    const mission = await missionRepo.create({
      id: crypto.randomUUID(),
      mission_number: "MSN-CANCEL-TEST",
      organization_id: operatorUser.organizationId,
      order_id: order.id,
      drone_id: drone.id,
      status: "IN_PROGRESS",
      origin_latitude: 37.7749,
      origin_longitude: -122.4194,
      destination_latitude: 37.7850,
      destination_longitude: -122.4100
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/missions/${mission.id}/cancel`,
      headers: { Authorization: `Bearer ${opToken}` },
      payload: { reason: "Airspace closed due to sudden VIP flight corridor restrictions" }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.success, true);
    assert.equal(body.data.command, "CANCEL_MISSION");
    assert.equal(body.data.status, "CANCELLED");

    // Mission and Order should be cancelled
    const updatedMission = await missionRepo.findById(mission.id, operatorUser.organizationId);
    assert.equal(updatedMission?.status, "CANCELLED");

    const updatedOrder = await orderRepo.findById(order.id, operatorUser.organizationId);
    assert.equal(updatedOrder?.status, "CANCELLED");

    // Airborne drone should be commanded to RETURNING
    const updatedDrone = await fleetRepo.findById(drone.id, operatorUser.organizationId);
    assert.equal(updatedDrone?.status, "RETURNING");

    // Audit record logged
    assert.ok(auditService.logs.some((l) => l.action === "MISSION_CANCELLED"));
  });
});
