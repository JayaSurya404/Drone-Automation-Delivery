import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../../app.js";
import { createMockOrderRepository } from "../../orders/tests/mock.repository.js";
import { createMockFleetRepository } from "../../fleet/tests/mock.repository.js";
import { createMockMissionRepository } from "../../missions/tests/mock.repository.js";
import { createMockOutboxRepository } from "../../events/tests/mock.repository.js";
import { createMockAuthRepository } from "../../auth/tests/mock.repository.js";
import { createOrderService } from "../../orders/order.service.js";
import { createMissionService } from "../../missions/mission.service.js";
import { createFleetService } from "../../fleet/fleet.service.js";
import { createDroneSelector } from "../drone-selector.js";
import { SimulatorSyncService } from "../simulator-sync.service.js";
import { createDeliveryOrchestrator } from "../delivery-orchestrator.js";
import { createNotificationRepository } from "../../notifications/notification.repository.js";
import { createMockNotificationRepository } from "../../notifications/tests/mock.repository.js";
import { createNotificationService } from "../../notifications/notification.service.js";
import type { AuthenticatedUser } from "@skynav/contracts";

const orgId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const customerUser: AuthenticatedUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "customer@alpha.test",
  name: "Alice Customer",
  organizationId: orgId,
  organizationName: "Alpha Logistics",
  role: "CUSTOMER",
  permissions: ["orders:create", "orders:read", "fleet:read"]
};

const adminUser: AuthenticatedUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "admin@alpha.test",
  name: "Admin Alice",
  organizationId: orgId,
  organizationName: "Alpha Logistics",
  role: "ADMIN",
  permissions: ["orders:create", "orders:read", "orders:update", "orders:cancel", "fleet:read", "missions:read", "missions:create", "missions:authorize"]
};

function createMockAuditService() {
  const logs: any[] = [];
  return {
    logs,
    log: async (entry: any) => {
      logs.push(entry);
    },
    list: async () => ({ logs, total: logs.length })
  };
}

async function setupTestApp() {
  const authRepo = createMockAuthRepository();
  const orderRepo = createMockOrderRepository();
  const fleetRepo = createMockFleetRepository();
  const missionRepo = createMockMissionRepository(fleetRepo, orderRepo);
  const outboxRepo = createMockOutboxRepository();
  const notificationRepo = createMockNotificationRepository();
  const auditService = createMockAuditService();

  const simulatorSyncService = new SimulatorSyncService({
    orderRepo,
    missionRepo,
    fleetRepo,
    outboxRepo
  });

  const missionService = createMissionService(
    missionRepo,
    orderRepo,
    fleetRepo,
    simulatorSyncService,
    auditService as any,
    outboxRepo
  );

  const droneSelector = createDroneSelector(fleetRepo);
  const deliveryOrchestrator = createDeliveryOrchestrator({
    orderRepo,
    missionRepo,
    fleetRepo,
    droneSelector,
    missionService,
    simulatorGateway: simulatorSyncService,
    simulatorSyncService,
    auditService: auditService as any,
    outboxRepo
  });

  const app = buildApp({
    authRepo,
    orderRepo,
    fleetRepo,
    missionRepo,
    outboxRepo,
    notificationRepo: notificationRepo as any,
    auditService: auditService as any,
    simulatorSyncService,
    deliveryOrchestrator,
    logger: false
  });

  await app.ready();

  const getCustomerToken = () => {
    return app.jwt.sign({
      sub: customerUser.id,
      email: customerUser.email,
      name: customerUser.name,
      orgId: customerUser.organizationId,
      orgName: customerUser.organizationName,
      role: customerUser.role,
      permissions: customerUser.permissions
    });
  };

  const getAdminToken = () => {
    return app.jwt.sign({
      sub: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      orgId: adminUser.organizationId,
      orgName: adminUser.organizationName,
      role: adminUser.role,
      permissions: adminUser.permissions
    });
  };

  return {
    app,
    orderRepo,
    fleetRepo,
    missionRepo,
    outboxRepo,
    simulatorSyncService,
    getCustomerToken,
    getAdminToken
  };
}

describe("Dispatch & Simulation HTTP API Routes", () => {
  it("POST /api/v1/orders/:orderId/dispatch requires authentication", async () => {
    const { app } = await setupTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/orders/11111111-1111-1111-1111-111111111111/dispatch"
    });

    assert.equal(response.statusCode, 401);
  });

  it("POST /api/v1/orders/:orderId/dispatch allows customer to dispatch valid order", async () => {
    const { app, orderRepo, fleetRepo, getCustomerToken } = await setupTestApp();

    // 1. Seed drone in fleet
    await fleetRepo.create({
      id: "drone-001",
      organization_id: orgId,
      model_id: "model-1",
      call_sign: "SKY-001",
      model: "AeroHex",
      serial_number: "SN-001",
      status: "IDLE",
      battery_percent: 90,
      max_payload_grams: 5000,
      current_latitude: 37.77,
      current_longitude: -122.41,
      current_altitude_meters: 0,
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: true
    });

    // 2. Seed order belonging to customer
    const order = await orderRepo.create({
      id: "33333333-3333-3333-3333-333333333333",
      organization_id: orgId,
      customer_id: customerUser.id,
      order_number: "ORD-TEST-001",
      status: "CREATED",
      package_weight_grams: 1000,
      package_length_cm: 10,
      package_width_cm: 10,
      package_height_cm: 10,
      package_description: "Important Parcel",
      priority: "STANDARD",
      pickup_latitude: 37.77,
      pickup_longitude: -122.41,
      pickup_altitude_meters: 0,
      pickup_address: "Alpha Depot",
      delivery_latitude: 37.78,
      delivery_longitude: -122.40,
      delivery_altitude_meters: 0,
      delivery_address: "Customer Dropzone",
      delivery_notes: "Test Recipient +15551234"
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${order.id}/dispatch`,
      headers: {
        authorization: `Bearer ${getCustomerToken()}`
      }
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.order.id, order.id);
    assert.equal(body.drone.id, "drone-001");
    assert.equal(body.mission.droneId, "drone-001");
  });

  it("POST /api/v1/simulation/tick advances simulation and returns drone states", async () => {
    const { app, fleetRepo, getAdminToken, simulatorSyncService } = await setupTestApp();

    simulatorSyncService.fleetSimulator.registerDrone("drone-tick-test", orgId, {
      latitude: 37.77,
      longitude: -122.41,
      altitudeMeters: 0
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/simulation/tick",
      headers: {
        authorization: `Bearer ${getAdminToken()}`
      },
      payload: {
        deltaSeconds: 5
      }
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.deltaSeconds, 5);
    assert.ok(Array.isArray(body.drones));
  });

  it("GET /api/v1/simulation/state returns live simulation state", async () => {
    const { app, getAdminToken } = await setupTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/simulation/state",
      headers: {
        authorization: `Bearer ${getAdminToken()}`
      }
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.running, true);
    assert.ok(Array.isArray(body.drones));
  });
});
