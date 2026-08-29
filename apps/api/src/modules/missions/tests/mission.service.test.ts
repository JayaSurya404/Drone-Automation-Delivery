import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  createMissionService,
  DuplicateActiveMissionError
} from "../mission.service.js";
import { createMockMissionRepository } from "./mock.repository.js";
import { createMockOrderRepository } from "../../orders/tests/mock.repository.js";
import { createMockFleetRepository } from "../../fleet/tests/mock.repository.js";
import { createSimulatorGateway } from "../simulator.adapter.js";
import type { AuditService } from "../../audit/audit.service.js";
import type { AuthenticatedUser } from "@skynav/contracts";

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

const operatorUser: AuthenticatedUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "operator@alpha.test",
  name: "Dan Operator",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "OPERATOR",
  permissions: ["missions:create", "missions:read", "missions:authorize", "missions:command"]
};

describe("Missions / Service Logic & Drone Assignment", () => {
  it("creates a mission for an order and prevents duplicate active missions (14)", async () => {
    const orderRepo = createMockOrderRepository();
    const fleetRepo = createMockFleetRepository();
    const missionRepo = createMockMissionRepository(fleetRepo, orderRepo);
    const simulatorGateway = createSimulatorGateway();
    const auditService = createMockAuditService();
    const service = createMissionService(missionRepo, orderRepo, fleetRepo, simulatorGateway, auditService);

    // Create an order
    const order = await orderRepo.create({
      id: crypto.randomUUID(),
      order_number: "ORD-001",
      organization_id: operatorUser.organizationId,
      customer_id: crypto.randomUUID(),
      status: "CONFIRMED",
      priority: "STANDARD",
      pickup_latitude: 37.7749,
      pickup_longitude: -122.4194,
      pickup_altitude_meters: 10,
      pickup_address: "Hub Alpha",
      delivery_latitude: 37.7833,
      delivery_longitude: -122.4167,
      delivery_altitude_meters: 15,
      delivery_address: "Customer Pad",
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

    // Create mission
    const mission = await service.createMission(operatorUser, { orderId: order.id });
    assert.ok(mission.id);
    assert.ok(mission.missionNumber.startsWith("MSN-"));
    assert.equal(mission.status, "PENDING");
    assert.equal(mission.orderId, order.id);

    // Duplicate mission for same active order throws DuplicateActiveMissionError
    await assert.rejects(
      async () => service.createMission(operatorUser, { orderId: order.id }),
      (err: any) => err instanceof DuplicateActiveMissionError && err.code === "DUPLICATE_ACTIVE_MISSION"
    );
  });

  it("assigns drone atomically, updates states, notifies simulator, and emits audit events (15, 24)", async () => {
    const orderRepo = createMockOrderRepository();
    const fleetRepo = createMockFleetRepository();
    const missionRepo = createMockMissionRepository(fleetRepo, orderRepo);
    const simulatorGateway = createSimulatorGateway();
    const auditService = createMockAuditService();
    const service = createMissionService(missionRepo, orderRepo, fleetRepo, simulatorGateway, auditService);

    // Create order
    const order = await orderRepo.create({
      id: crypto.randomUUID(),
      order_number: "ORD-002",
      organization_id: operatorUser.organizationId,
      customer_id: crypto.randomUUID(),
      status: "CONFIRMED",
      priority: "EXPRESS",
      pickup_latitude: 37.7749,
      pickup_longitude: -122.4194,
      pickup_altitude_meters: 10,
      pickup_address: "Hub Alpha",
      delivery_latitude: 37.7833,
      delivery_longitude: -122.4167,
      delivery_altitude_meters: 15,
      delivery_address: "Customer Pad",
      package_weight_grams: 800,
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

    // Create drone
    const drone = await fleetRepo.create({
      id: crypto.randomUUID(),
      organization_id: operatorUser.organizationId,
      model_id: null,
      call_sign: "SKY-ALPHA",
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

    // Create mission
    const mission = await service.createMission(operatorUser, { orderId: order.id });

    // Assign drone
    const assignedMission = await service.assignDrone(operatorUser, mission.id, drone.id);
    assert.equal(assignedMission.status, "ASSIGNED");
    assert.equal(assignedMission.droneId, drone.id);
    assert.ok(assignedMission.assignedAt);

    // Verify drone state is now ASSIGNED
    const updatedDrone = await fleetRepo.findById(drone.id, operatorUser.organizationId);
    assert.equal(updatedDrone?.status, "ASSIGNED");

    // Verify order state is now ASSIGNED
    const updatedOrder = await orderRepo.findById(order.id, operatorUser.organizationId);
    assert.equal(updatedOrder?.status, "ASSIGNED");

    // Verify simulator gateway was notified
    const simPlan = (simulatorGateway as any).getAssignedPlan(mission.id);
    assert.ok(simPlan);
    assert.equal(simPlan.droneId, drone.id);

    // Verify audit logs
    const missionLogs = auditService.logs.filter((l) => l.action === "MISSION_ASSIGNED");
    assert.equal(missionLogs.length, 1);
  });
});
