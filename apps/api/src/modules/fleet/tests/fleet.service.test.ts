import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  createFleetService,
  DroneNotFoundError,
  DuplicateDroneCallSignError
} from "../fleet.service.js";
import { createMockFleetRepository } from "./mock.repository.js";
import type { AuditService } from "../../audit/audit.service.js";
import type { AuthenticatedUser, CreateDroneRequest } from "@skynav/contracts";

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

const adminUser: AuthenticatedUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@skynav.test",
  name: "Admin User",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "ADMIN",
  permissions: ["drones:create", "drones:read", "drones:command", "fleet:manage"]
};

const otherOrgAdmin: AuthenticatedUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "other@beta.test",
  name: "Beta Admin",
  organizationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  organizationName: "Beta Logistics",
  role: "ADMIN",
  permissions: ["drones:create", "drones:read", "drones:command", "fleet:manage"]
};

const sampleDroneInput: CreateDroneRequest = {
  callSign: "SKY-001",
  model: "SkyNav Hexacopter Alpha",
  maxPayloadGrams: 5000,
  batteryPercent: 100,
  currentLocation: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 },
  homeLocation: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 }
};

describe("Fleet / Service Logic & Tenant Scoping", () => {
  it("registers a new drone with server-side organization scoping", async () => {
    const repo = createMockFleetRepository();
    const auditService = createMockAuditService();
    const service = createFleetService(repo, auditService);

    const drone = await service.createDrone(adminUser, sampleDroneInput);

    assert.ok(drone.id);
    assert.equal(drone.callSign, "SKY-001");
    assert.equal(drone.organizationId, adminUser.organizationId);
    assert.equal(drone.status, "IDLE");
    assert.equal(drone.batteryPercent, 100);

    // Audit log check
    assert.equal(auditService.logs.length, 1);
    assert.equal(auditService.logs[0].action, "DRONE_REGISTERED");
  });

  it("prevents duplicate call signs within the same organization", async () => {
    const repo = createMockFleetRepository();
    const auditService = createMockAuditService();
    const service = createFleetService(repo, auditService);

    await service.createDrone(adminUser, sampleDroneInput);

    // Duplicate in same organization throws DuplicateDroneCallSignError
    await assert.rejects(
      async () => service.createDrone(adminUser, sampleDroneInput),
      (err: any) => err instanceof DuplicateDroneCallSignError && err.code === "DUPLICATE_DRONE_CALL_SIGN"
    );

    // Same callSign in DIFFERENT organization is permitted
    const otherOrgDrone = await service.createDrone(otherOrgAdmin, sampleDroneInput);
    assert.equal(otherOrgDrone.callSign, "SKY-001");
    assert.equal(otherOrgDrone.organizationId, otherOrgAdmin.organizationId);
  });

  it("enforces tenant isolation on drone retrieval and updates", async () => {
    const repo = createMockFleetRepository();
    const auditService = createMockAuditService();
    const service = createFleetService(repo, auditService);

    const drone = await service.createDrone(adminUser, sampleDroneInput);

    // Admin from same org can retrieve
    const retrieved = await service.getDrone(adminUser, drone.id);
    assert.equal(retrieved.id, drone.id);

    // Admin from other org receives DroneNotFoundError (404)
    await assert.rejects(
      async () => service.getDrone(otherOrgAdmin, drone.id),
      (err: any) => err instanceof DroneNotFoundError
    );

    // Update status
    const updated = await service.updateDrone(adminUser, drone.id, {
      status: "AVAILABLE",
      batteryPercent: 98
    });
    assert.equal(updated.status, "AVAILABLE");
    assert.equal(updated.batteryPercent, 98);
  });
});
