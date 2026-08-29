import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { buildApp } from "../../../app.js";
import { createMockAuthRepository } from "../../auth/tests/mock.repository.js";
import { createMockFleetRepository } from "../../fleet/tests/mock.repository.js";
import { createMockOrderRepository } from "../../orders/tests/mock.repository.js";
import { createMockMissionRepository } from "../../missions/tests/mock.repository.js";
import { RealtimeService } from "../realtime.service.js";
import type { UserRole, Permission, Telemetry } from "@skynav/contracts";

const adminUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@alpha.test",
  name: "Alice Admin",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "ADMIN" as UserRole,
  permissions: ["telemetry:read", "fleet:read"] as Permission[]
};

const customerUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "customer@alpha.test",
  name: "Bob Customer",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "CUSTOMER" as UserRole,
  permissions: ["orders:read"] as Permission[]
};

describe("Realtime / WebSocket Gateway End-to-End Integration", () => {
  let app: ReturnType<typeof buildApp>;
  let realtimeService: RealtimeService;
  let serverAddress: string;
  let adminToken: string;
  let customerToken: string;

  before(async () => {
    const authRepo = createMockAuthRepository();
    const fleetRepo = createMockFleetRepository();
    const orderRepo = createMockOrderRepository();
    const missionRepo = createMockMissionRepository(fleetRepo, orderRepo);
    realtimeService = new RealtimeService({ fleetRepo, orderRepo, missionRepo });

    app = buildApp({
      authRepo,
      fleetRepo,
      orderRepo,
      missionRepo,
      realtimeService
    });

    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    serverAddress = address.replace("http://", "ws://");

    adminToken = app.jwt.sign({
      sub: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      orgId: adminUser.organizationId,
      orgName: adminUser.organizationName,
      role: adminUser.role,
      permissions: adminUser.permissions
    });

    customerToken = app.jwt.sign({
      sub: customerUser.id,
      email: customerUser.email,
      name: customerUser.name,
      orgId: customerUser.organizationId,
      orgName: customerUser.organizationName,
      role: customerUser.role,
      permissions: customerUser.permissions
    });
  });

  after(async () => {
    await app.close();
  });

  it("10 & 11. connects with token query param, authenticates, and handles PING/PONG (10, 11)", async () => {
    const ws = new WebSocket(`${serverAddress}/api/v1/ws/telemetry?token=${adminToken}`);

    const messages: any[] = [];
    ws.on("message", (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    // Wait for AUTHENTICATED message
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (messages.some((m) => m.type === "AUTHENTICATED")) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    const authMsg = messages.find((m) => m.type === "AUTHENTICATED");
    assert.ok(authMsg);
    assert.equal(authMsg.user.id, adminUser.id);

    // Send PING
    ws.send(JSON.stringify({ type: "PING" }));

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (messages.some((m) => m.type === "PONG")) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    const pongMsg = messages.find((m) => m.type === "PONG");
    assert.ok(pongMsg);

    ws.close();
  });

  it("16 & 19. subscribes to telemetry and receives live broadcast (16, 19)", async () => {
    const ws = new WebSocket(`${serverAddress}/api/v1/ws/telemetry?token=${adminToken}`);
    const messages: any[] = [];

    ws.on("message", (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    // Subscribe to organization stream
    ws.send(JSON.stringify({ type: "SUBSCRIBE", channel: "telemetry:organization" }));

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (messages.some((m) => m.type === "SUBSCRIBED")) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    const subMsg = messages.find((m) => m.type === "SUBSCRIBED");
    assert.ok(subMsg);
    assert.equal(subMsg.channel, "telemetry:organization");

    // Broadcast a live telemetry frame
    const telemetryFrame: Telemetry = {
      version: "v1",
      organizationId: adminUser.organizationId,
      droneId: "11111111-1111-1111-1111-111111111111",
      observedAt: new Date().toISOString(),
      position: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 45 },
      speedMetersPerSecond: 12,
      headingDegrees: 90,
      batteryPercent: 88,
      state: "EN_ROUTE"
    };

    realtimeService.broadcastTelemetry(telemetryFrame);

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (messages.some((m) => m.type === "TELEMETRY")) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    const telemMsg = messages.find((m) => m.type === "TELEMETRY");
    assert.ok(telemMsg);
    assert.equal(telemMsg.telemetry.droneId, telemetryFrame.droneId);
    assert.equal(telemMsg.telemetry.batteryPercent, 88);

    ws.close();
  });

  it("12. authenticates via message protocol after connection open", async () => {
    const ws = new WebSocket(`${serverAddress}/api/v1/ws/telemetry`);
    const messages: any[] = [];

    ws.on("message", (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    // Send AUTH message
    ws.send(JSON.stringify({ type: "AUTH", token: customerToken }));

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (messages.some((m) => m.type === "AUTHENTICATED")) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    const authMsg = messages.find((m) => m.type === "AUTHENTICATED");
    assert.ok(authMsg);
    assert.equal(authMsg.user.id, customerUser.id);
    assert.equal(authMsg.user.role, "CUSTOMER");

    ws.close();
  });
});
