import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMockOrderRepository } from "../../orders/tests/mock.repository.js";
import { createMockFleetRepository } from "../../fleet/tests/mock.repository.js";
import { createMockMissionRepository } from "../../missions/tests/mock.repository.js";
import { createMockOutboxRepository } from "../../events/tests/mock.repository.js";
import { createOrderService } from "../../orders/order.service.js";
import { createMissionService } from "../../missions/mission.service.js";
import { createFleetService } from "../../fleet/fleet.service.js";
import { createDroneSelector, NoAvailableDroneError } from "../drone-selector.js";
import { SimulatorSyncService } from "../simulator-sync.service.js";
import { createDeliveryOrchestrator, OrderNotDispatchableError } from "../delivery-orchestrator.js";
import { RealtimeService } from "../../realtime/realtime.service.js";
import { FleetSimulator } from "@skynav/simulator";
import type { AuthenticatedUser, Telemetry } from "@skynav/contracts";

const orgAlphaId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const orgBetaId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const customerAlice: AuthenticatedUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "alice@alpha.test",
  name: "Alice Customer",
  organizationId: orgAlphaId,
  organizationName: "Alpha Logistics",
  role: "CUSTOMER",
  permissions: ["orders:create", "orders:read"]
};

const customerBob: AuthenticatedUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "bob@alpha.test",
  name: "Bob Customer",
  organizationId: orgAlphaId,
  organizationName: "Alpha Logistics",
  role: "CUSTOMER",
  permissions: ["orders:create", "orders:read"]
};

const adminAlice: AuthenticatedUser = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "admin@alpha.test",
  name: "Admin Alice",
  organizationId: orgAlphaId,
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

describe("Delivery Vertical Slice / End-to-End Orchestration Tests", () => {
  it("27, 28, 29, 30. completes full delivery lifecycle: Create Order -> Drone Assignment -> Mission Dispatch -> Simulation -> Delivery -> Return Home", async () => {
    const orderRepo = createMockOrderRepository();
    const fleetRepo = createMockFleetRepository();
    const missionRepo = createMockMissionRepository(fleetRepo, orderRepo);
    const outboxRepo = createMockOutboxRepository();
    const auditService = createMockAuditService();

    // 1. Seed two drones in Alpha fleet: SKY-001 (90% battery) and SKY-002 (50% battery)
    await fleetRepo.create({
      id: "drone-001",
      organization_id: orgAlphaId,
      model_id: "model-aerohex",
      call_sign: "SKY-001",
      model: "AeroHex V4",
      serial_number: "SN-001",
      status: "IDLE",
      battery_percent: 90,
      max_payload_grams: 5000,
      current_latitude: 37.7749,
      current_longitude: -122.4194,
      current_altitude_meters: 0,
      home_latitude: 37.7749,
      home_longitude: -122.4194,
      home_altitude_meters: 0,
      is_active: true
    });

    await fleetRepo.create({
      id: "drone-002",
      organization_id: orgAlphaId,
      model_id: "model-aerohex",
      call_sign: "SKY-002",
      model: "AeroHex V4",
      serial_number: "SN-002",
      status: "AVAILABLE",
      battery_percent: 50,
      max_payload_grams: 5000,
      current_latitude: 37.7749,
      current_longitude: -122.4194,
      current_altitude_meters: 0,
      home_latitude: 37.7749,
      home_longitude: -122.4194,
      home_altitude_meters: 0,
      is_active: true
    });

    // 2. Setup Realtime + Simulator Sync Service
    const emittedTelemetry: Telemetry[] = [];
    const realtimeService = new RealtimeService({
      fleetRepo,
      orderRepo,
      missionRepo
    });

    const fleetSimulator = new FleetSimulator({
      defaultCruiseSpeedMetersPerSecond: 30,
      defaultCruiseAltitudeMeters: 60,
      climbRateMetersPerSecond: 15,
      descentRateMetersPerSecond: 15
    });

    const simulatorSyncService = new SimulatorSyncService({
      fleetSimulator,
      orderRepo,
      missionRepo,
      fleetRepo,
      outboxRepo,
      telemetryPublisher: {
        publish: async (telemetry) => {
          emittedTelemetry.push(telemetry);
          realtimeService.broadcastTelemetry(telemetry);
        }
      }
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
    const orchestrator = createDeliveryOrchestrator({
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

    const orderService = createOrderService(orderRepo, auditService as any, outboxRepo);

    // Step A: Customer Alice creates an order
    const order = await orderService.createOrder(customerAlice, {
      pickup: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0, address: "Warehouse Alpha" },
      delivery: { latitude: 37.7800, longitude: -122.4100, altitudeMeters: 0, address: "Customer Dropzone" },
      package: {
        weightGrams: 1500,
        lengthCm: 20,
        widthCm: 15,
        heightCm: 10,
        description: "Medical Supplies"
      },
      priority: "EXPRESS"
    });

    assert.equal(order.status, "CREATED");
    assert.equal(order.customerId, customerAlice.id);

    // Step B: Dispatch Order
    const dispatchResult = await orchestrator.dispatchOrder(customerAlice, order.id);

    // Verify optimal drone was selected: SKY-001 (90% battery > 50% battery)
    assert.equal(dispatchResult.drone.callSign, "SKY-001");
    assert.equal(dispatchResult.mission.droneId, "drone-001");
    assert.equal(dispatchResult.order.id, order.id);

    // Step C: Advance Simulation — Drone climbs, flies to destination, delivers, and returns home
    for (let i = 0; i < 100; i++) {
      simulatorSyncService.advanceSimulation(10);
    }
    await new Promise((resolve) => setImmediate(resolve));

    // Step D: Verify final state across domains
    const finalOrder = await orderRepo.findById(order.id, orgAlphaId);
    assert.equal(finalOrder?.status, "DELIVERED");

    const finalMission = await missionRepo.findById(dispatchResult.mission.id, orgAlphaId);
    assert.equal(finalMission?.status, "COMPLETED");

    const finalDrone = await fleetRepo.findById("drone-001", orgAlphaId);
    assert.equal(finalDrone?.status, "IDLE");

    // Verify outbox events were recorded
    const outboxEvents = outboxRepo.events;
    assert.ok(outboxEvents.some((e) => e.eventType === "ORDER_DELIVERED"));
    assert.ok(outboxEvents.some((e) => e.eventType === "MISSION_COMPLETED"));

    // Verify telemetry was captured
    assert.ok(emittedTelemetry.length > 0);
  });

  it("5, 6, 7, 8. enforces Drone Selection criteria: selects optimal drone, rejects low battery, insufficient payload, offline drones", async () => {
    const fleetRepo = createMockFleetRepository();
    const droneSelector = createDroneSelector(fleetRepo);

    // 1. Drone A: Low battery (< 30%)
    await fleetRepo.create({
      id: "drone-low-bat",
      organization_id: orgAlphaId,
      model_id: "model-1",
      call_sign: "SKY-LOW",
      model: "AeroHex",
      serial_number: "SN-LOW",
      status: "IDLE",
      battery_percent: 20, // < 30%
      max_payload_grams: 5000,
      current_latitude: 37.77,
      current_longitude: -122.41,
      current_altitude_meters: 0,
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: true
    });

    // 2. Drone B: Insufficient payload capacity
    await fleetRepo.create({
      id: "drone-small",
      organization_id: orgAlphaId,
      model_id: "model-1",
      call_sign: "SKY-TINY",
      model: "AeroHex Mini",
      serial_number: "SN-TINY",
      status: "AVAILABLE",
      battery_percent: 100,
      max_payload_grams: 500, // < 2000g requested
      current_latitude: 37.77,
      current_longitude: -122.41,
      current_altitude_meters: 0,
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: true
    });

    // 3. Drone C: Inactive / Maintenance
    await fleetRepo.create({
      id: "drone-maint",
      organization_id: orgAlphaId,
      model_id: "model-1",
      call_sign: "SKY-MAINT",
      model: "AeroHex",
      serial_number: "SN-MAINT",
      status: "IDLE",
      battery_percent: 100,
      max_payload_grams: 5000,
      current_latitude: 37.77,
      current_longitude: -122.41,
      current_altitude_meters: 0,
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: false
    });

    // Attempting to select drone for 2000g package should fail with NoAvailableDroneError
    await assert.rejects(
      async () => {
        await droneSelector.selectOptimalDrone({
          organizationId: orgAlphaId,
          packageWeightGrams: 2000
        });
      },
      (err: any) => {
        assert.equal(err.code, "NO_AVAILABLE_DRONE");
        return true;
      }
    );

    // Now add an eligible drone
    await fleetRepo.create({
      id: "drone-good",
      organization_id: orgAlphaId,
      model_id: "model-1",
      call_sign: "SKY-READY",
      model: "AeroHex",
      serial_number: "SN-READY",
      status: "AVAILABLE",
      battery_percent: 85,
      max_payload_grams: 4000,
      current_latitude: 37.77,
      current_longitude: -122.41,
      current_altitude_meters: 0,
      home_latitude: 37.77,
      home_longitude: -122.41,
      home_altitude_meters: 0,
      is_active: true
    });

    const selected = await droneSelector.selectOptimalDrone({
      organizationId: orgAlphaId,
      packageWeightGrams: 2000
    });

    assert.equal(selected.id, "drone-good");
    assert.equal(selected.call_sign, "SKY-READY");
  });

  it("1, 2, 3, 4. strictly prevents Customer A from dispatching Customer B's order or cross-tenant dispatch", async () => {
    const orderRepo = createMockOrderRepository();
    const fleetRepo = createMockFleetRepository();
    const missionRepo = createMockMissionRepository(fleetRepo, orderRepo);
    const auditService = createMockAuditService();
    const simulator = new SimulatorSyncService();
    const missionService = createMissionService(
      missionRepo,
      orderRepo,
      fleetRepo,
      simulator,
      auditService as any
    );
    const droneSelector = createDroneSelector(fleetRepo);
    const orchestrator = createDeliveryOrchestrator({
      orderRepo,
      missionRepo,
      fleetRepo,
      droneSelector,
      missionService,
      simulatorGateway: simulator,
      auditService: auditService as any
    });

    // Seed order belonging to Alice in Org Alpha
    const aliceOrder = await orderRepo.create({
      id: "order-alice-123",
      organization_id: orgAlphaId,
      customer_id: customerAlice.id,
      order_number: "ORD-ALICE-1",
      status: "CREATED",
      package_weight_grams: 1000,
      package_length_cm: 10,
      package_width_cm: 10,
      package_height_cm: 10,
      package_description: "Book",
      priority: "STANDARD",
      pickup_latitude: 37.77,
      pickup_longitude: -122.41,
      pickup_altitude_meters: 0,
      pickup_address: "Alpha Depot",
      delivery_latitude: 37.78,
      delivery_longitude: -122.40,
      delivery_altitude_meters: 0,
      delivery_address: "Alice House",
      delivery_notes: "Alice Recipient +15550001"
    });

    // Bob attempts to dispatch Alice's order -> Rejected!
    await assert.rejects(
      async () => {
        await orchestrator.dispatchOrder(customerBob, aliceOrder.id);
      },
      /not authorized/
    );

    // Cross-tenant user attempts to dispatch Alice's order -> Not found in tenant
    const competitorUser: AuthenticatedUser = {
      id: "44444444-4444-4444-4444-444444444444",
      email: "charlie@beta.test",
      name: "Charlie Beta",
      organizationId: orgBetaId,
      organizationName: "Beta Logistics",
      role: "CUSTOMER",
      permissions: ["orders:create", "orders:read"]
    };

    await assert.rejects(
      async () => {
        await orchestrator.dispatchOrder(competitorUser, aliceOrder.id);
      },
      /not found/
    );
  });
});
