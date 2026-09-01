import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RealtimeService } from "../realtime.service.js";
import { createMockFleetRepository } from "../../fleet/tests/mock.repository.js";
import { createMockOrderRepository } from "../../orders/tests/mock.repository.js";
import type { AuthenticatedUser, Telemetry } from "@skynav/contracts";

const adminUser: AuthenticatedUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@alpha.test",
  name: "Alice Admin",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "ADMIN",
  permissions: ["telemetry:read", "fleet:read", "notifications:read"]
};

const customerUser: AuthenticatedUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "customer@alpha.test",
  name: "Bob Customer",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "CUSTOMER",
  permissions: ["orders:read", "notifications:read"]
};

const tenant2Admin: AuthenticatedUser = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "admin@beta.test",
  name: "Charlie Admin",
  organizationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  organizationName: "Beta Logistics",
  role: "ADMIN",
  permissions: ["telemetry:read", "fleet:read"]
};

function createMockSocket() {
  const sentMessages: string[] = [];
  return {
    readyState: 1, // OPEN
    bufferedAmount: 0,
    sentMessages,
    send(data: string) {
      sentMessages.push(data);
    },
    close() {
      this.readyState = 3; // CLOSED
    }
  };
}

describe("Realtime / Service Subscription & Tenant Isolation", () => {
  it("authenticates client and dispatches AUTHENTICATED message", () => {
    const service = new RealtimeService();
    const mockSocket = createMockSocket();

    const client = service.registerClient("client-1", mockSocket as any);
    assert.equal(client.user, null);

    service.authenticateClient("client-1", adminUser);
    assert.equal((client.user as AuthenticatedUser | null)?.id, adminUser.id);
    assert.equal(mockSocket.sentMessages.length, 1);

    const msg = JSON.parse(mockSocket.sentMessages[0]);
    assert.equal(msg.type, "AUTHENTICATED");
    assert.equal(msg.user.email, adminUser.email);
  });

  it("permits Admin to subscribe to organization stream and rejects Customer (13, 17)", async () => {
    const service = new RealtimeService();
    const adminSocket = createMockSocket();
    const customerSocket = createMockSocket();

    const adminClient = service.registerClient("admin-1", adminSocket as any, adminUser);
    const customerClient = service.registerClient("cust-1", customerSocket as any, customerUser);

    // Admin subscribes to organization stream
    await service.handleSubscription(adminClient, "telemetry:organization");
    const adminSubMsg = JSON.parse(adminSocket.sentMessages[0]);
    assert.equal(adminSubMsg.type, "SUBSCRIBED");
    assert.equal(adminSubMsg.channel, "telemetry:organization");

    // Customer attempts to subscribe to organization stream -> rejected
    await service.handleSubscription(customerClient, "telemetry:organization");
    const custErrMsg = JSON.parse(customerSocket.sentMessages[0]);
    assert.equal(custErrMsg.type, "ERROR");
    assert.equal(custErrMsg.code, "INSUFFICIENT_PERMISSIONS");
  });

  it("strictly enforces tenant isolation: Tenant A client never receives Tenant B telemetry (10, 14, 20)", async () => {
    const fleetRepo = createMockFleetRepository();
    const service = new RealtimeService({ fleetRepo });

    const socketTenantA = createMockSocket();
    const socketTenantB = createMockSocket();

    const clientA = service.registerClient("client-a", socketTenantA as any, adminUser);
    const clientB = service.registerClient("client-b", socketTenantB as any, tenant2Admin);

    // Both subscribe to their respective org streams
    await service.handleSubscription(clientA, "telemetry:organization");
    await service.handleSubscription(clientB, "telemetry:organization");

    socketTenantA.sentMessages.length = 0;
    socketTenantB.sentMessages.length = 0;

    // Telemetry for Tenant A
    const telemA: Telemetry = {
      version: "v1",
      organizationId: adminUser.organizationId,
      droneId: "11111111-1111-1111-1111-111111111111",
      observedAt: new Date().toISOString(),
      position: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 50 },
      speedMetersPerSecond: 10,
      headingDegrees: 90,
      batteryPercent: 80
    };

    service.broadcastTelemetry(telemA);

    // Client A receives telemetry
    assert.equal(socketTenantA.sentMessages.length, 1);
    const parsedA = JSON.parse(socketTenantA.sentMessages[0]);
    assert.equal(parsedA.type, "TELEMETRY");
    assert.equal(parsedA.telemetry.droneId, telemA.droneId);

    // Client B from Tenant B MUST NOT receive anything
    assert.equal(socketTenantB.sentMessages.length, 0);
  });

  it("filters out-of-order older telemetry frames (22)", async () => {
    const service = new RealtimeService();
    const socket = createMockSocket();
    const client = service.registerClient("client-1", socket as any, adminUser);

    await service.handleSubscription(client, "telemetry:organization");
    socket.sentMessages.length = 0;

    const droneId = "11111111-1111-1111-1111-111111111111";
    const timeNewer = new Date(2026, 0, 1, 12, 0, 20).toISOString();
    const timeOlder = new Date(2026, 0, 1, 12, 0, 10).toISOString();

    // 1. Broadcast newer frame
    service.broadcastTelemetry({
      version: "v1",
      organizationId: adminUser.organizationId,
      droneId,
      observedAt: timeNewer,
      position: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 50 },
      speedMetersPerSecond: 10,
      headingDegrees: 90,
      batteryPercent: 80
    });
    assert.equal(socket.sentMessages.length, 1);

    // 2. Broadcast older delayed frame -> dropped
    service.broadcastTelemetry({
      version: "v1",
      organizationId: adminUser.organizationId,
      droneId,
      observedAt: timeOlder,
      position: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 40 },
      speedMetersPerSecond: 10,
      headingDegrees: 90,
      batteryPercent: 80
    });
    assert.equal(socket.sentMessages.length, 1); // Still 1, older frame was dropped
  });

  it("applies backpressure drop when client socket buffer is saturated (24)", async () => {
    const service = new RealtimeService();
    const socket = createMockSocket();
    socket.bufferedAmount = 100 * 1024; // 100KB buffer (exceeds 64KB threshold)

    const client = service.registerClient("client-1", socket as any, adminUser);
    await service.handleSubscription(client, "telemetry:organization");
    socket.sentMessages.length = 0;

    service.broadcastTelemetry({
      version: "v1",
      organizationId: adminUser.organizationId,
      droneId: "11111111-1111-1111-1111-111111111111",
      observedAt: new Date().toISOString(),
      position: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 50 },
      speedMetersPerSecond: 10,
      headingDegrees: 90,
      batteryPercent: 80
    });

    assert.equal(socket.sentMessages.length, 0); // Dropped due to backpressure
  });

  it("handles notification subscriptions and broadcasts with tenant & customer isolation (29, 30, 31, 32)", async () => {
    const service = new RealtimeService();
    const adminSocket = createMockSocket();
    const customerSocket = createMockSocket();
    const alienCustomerSocket = createMockSocket();

    const adminClient = service.registerClient("admin-1", adminSocket as any, adminUser);
    const customerClient = service.registerClient("cust-1", customerSocket as any, customerUser);
    const alienClient = service.registerClient("alien-1", alienCustomerSocket as any, {
      ...customerUser,
      id: "99999999-9999-9999-9999-999999999999"
    });

    // Subscriptions
    await service.handleSubscription(adminClient, "notifications:organization");
    await service.handleSubscription(customerClient, "notifications:user");
    await service.handleSubscription(alienClient, "notifications:user");

    adminSocket.sentMessages.length = 0;
    customerSocket.sentMessages.length = 0;
    alienCustomerSocket.sentMessages.length = 0;

    // 1. Broadcast customer-targeted notification
    const customerNotif = {
      id: "55555555-5555-5555-5555-555555555555",
      organizationId: customerUser.organizationId,
      userId: customerUser.id,
      type: "ORDER_UPDATE" as const,
      severity: "INFO" as const,
      title: "Order Dispatched",
      message: "Your delivery is en route.",
      isRead: false,
      createdAt: new Date().toISOString()
    };

    service.broadcastNotification(customerNotif);

    // Customer receives it
    assert.equal(customerSocket.sentMessages.length, 1);
    const custMsg = JSON.parse(customerSocket.sentMessages[0]);
    assert.equal(custMsg.type, "NOTIFICATION");
    assert.equal(custMsg.notification.title, "Order Dispatched");

    // Alien customer does NOT receive it
    assert.equal(alienCustomerSocket.sentMessages.length, 0);

    // Admin receives it (via org stream)
    assert.equal(adminSocket.sentMessages.length, 1);
  });
});
