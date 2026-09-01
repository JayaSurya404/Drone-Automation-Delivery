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

const orgAlphaAdmin = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@alpha.test",
  name: "Alice Alpha",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "ADMIN" as UserRole,
  permissions: ["telemetry:read", "fleet:read"] as Permission[]
};

const orgBetaAdmin = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "admin@beta.test",
  name: "Bob Beta",
  organizationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  organizationName: "Beta Logistics",
  role: "ADMIN" as UserRole,
  permissions: ["telemetry:read", "fleet:read"] as Permission[]
};

describe("Realtime / End-to-End Local Smoke Test (Publisher -> Gateway -> WS Clients)", () => {
  let app: ReturnType<typeof buildApp>;
  let realtimeService: RealtimeService;
  let serverAddress: string;
  let tokenAlpha: string;
  let tokenBeta: string;

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

    tokenAlpha = app.jwt.sign({
      sub: orgAlphaAdmin.id,
      email: orgAlphaAdmin.email,
      name: orgAlphaAdmin.name,
      orgId: orgAlphaAdmin.organizationId,
      orgName: orgAlphaAdmin.organizationName,
      role: orgAlphaAdmin.role,
      permissions: orgAlphaAdmin.permissions
    });

    tokenBeta = app.jwt.sign({
      sub: orgBetaAdmin.id,
      email: orgBetaAdmin.email,
      name: orgBetaAdmin.name,
      orgId: orgBetaAdmin.organizationId,
      orgName: orgBetaAdmin.organizationName,
      role: orgBetaAdmin.role,
      permissions: orgBetaAdmin.permissions
    });
  });

  after(async () => {
    await app.close();
  });

  it("proves end-to-end telemetry pipeline to WebSocket clients with strict tenant isolation", async () => {
    const droneAlphaId = "aaaaaaaa-1111-1111-1111-111111111111";

    // 1. Connect Client Alpha (Tenant A)
    const wsAlpha = new WebSocket(`${serverAddress}/api/v1/ws/telemetry?token=${tokenAlpha}`);
    const alphaMessages: any[] = [];
    wsAlpha.on("message", (data) => alphaMessages.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve) => wsAlpha.on("open", () => resolve()));

    wsAlpha.send(JSON.stringify({ type: "SUBSCRIBE", channel: "telemetry:organization" }));

    // 2. Connect Client Beta (Tenant B)
    const wsBeta = new WebSocket(`${serverAddress}/api/v1/ws/telemetry?token=${tokenBeta}`);
    const betaMessages: any[] = [];
    wsBeta.on("message", (data) => betaMessages.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve) => wsBeta.on("open", () => resolve()));

    wsBeta.send(JSON.stringify({ type: "SUBSCRIBE", channel: "telemetry:organization" }));

    // Wait for subscriptions to register
    await new Promise((r) => setTimeout(r, 100));

    // 3. Broadcast 3 consecutive telemetry frames for Tenant A
    for (let i = 1; i <= 3; i++) {
      const frame: Telemetry = {
        version: "v1",
        organizationId: orgAlphaAdmin.organizationId,
        droneId: droneAlphaId,
        observedAt: new Date().toISOString(),
        position: { latitude: 37.7749, longitude: -122.4194 + i * 0.001, altitudeMeters: 50 + i },
        speedMetersPerSecond: 10 + i,
        headingDegrees: 90,
        batteryPercent: 100 - i,
        state: "EN_ROUTE"
      };
      realtimeService.broadcastTelemetry(frame);
    }

    // Wait for telemetry frames to arrive
    await new Promise((r) => setTimeout(r, 200));

    // 4. Assert Client Alpha received all 3 telemetry frames
    const alphaTelemetry = alphaMessages.filter((m) => m.type === "TELEMETRY");
    assert.equal(alphaTelemetry.length, 3);
    assert.equal(alphaTelemetry[0].telemetry.droneId, droneAlphaId);
    assert.equal(alphaTelemetry[0].telemetry.organizationId, orgAlphaAdmin.organizationId);

    // 5. Assert Client Beta (Tenant B) received ZERO frames from Tenant A
    const betaTelemetry = betaMessages.filter((m) => m.type === "TELEMETRY");
    assert.equal(betaTelemetry.length, 0);

    wsAlpha.close();
    wsBeta.close();
  });
});
