import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMockNotificationRepository } from "./mock.repository.js";
import {
  createNotificationService,
  NotificationNotFoundError,
  type NotificationService
} from "../notification.service.js";
import type { AuthenticatedUser, DomainEventEnvelope } from "@skynav/contracts";

describe("Notification Domain / NotificationService Unit Tests", () => {
  let mockRepo: ReturnType<typeof createMockNotificationRepository>;
  let service: NotificationService;

  const orgId1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const orgId2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const customerId1 = "11111111-1111-1111-1111-111111111111";
  const customerId2 = "22222222-2222-2222-2222-222222222222";
  const operatorId1 = "33333333-3333-3333-3333-333333333333";

  const customerUser1: AuthenticatedUser = {
    id: customerId1,
    email: "customer1@skynav.test",
    name: "Customer One",
    organizationId: orgId1,
    organizationName: "SkyNav Org 1",
    role: "CUSTOMER",
    permissions: ["orders:read", "orders:create", "notifications:read"]
  };

  const customerUser2: AuthenticatedUser = {
    id: customerId2,
    email: "customer2@skynav.test",
    name: "Customer Two",
    organizationId: orgId1,
    organizationName: "SkyNav Org 1",
    role: "CUSTOMER",
    permissions: ["orders:read", "orders:create", "notifications:read"]
  };

  const operatorUser1: AuthenticatedUser = {
    id: operatorId1,
    email: "operator1@skynav.test",
    name: "Operator One",
    organizationId: orgId1,
    organizationName: "SkyNav Org 1",
    role: "OPERATOR",
    permissions: ["orders:read", "missions:read", "notifications:read", "notifications:manage"]
  };

  beforeEach(() => {
    mockRepo = createMockNotificationRepository();
    service = createNotificationService(mockRepo);
  });

  it("lists notifications for customer strictly scoped to customer identity and broadcast alerts (5, 6, 7)", async () => {
    // Seed notifications
    await mockRepo.create({
      id: crypto.randomUUID(),
      organizationId: orgId1,
      userId: customerId1,
      type: "ORDER_UPDATE",
      severity: "INFO",
      title: "Order 1 Update",
      message: "Order in flight"
    });

    await mockRepo.create({
      id: crypto.randomUUID(),
      organizationId: orgId1,
      userId: customerId2, // Belongs to customer 2
      type: "ORDER_UPDATE",
      severity: "INFO",
      title: "Order 2 Update",
      message: "Order in flight for customer 2"
    });

    await mockRepo.create({
      id: crypto.randomUUID(),
      organizationId: orgId1,
      userId: null, // Org-wide broadcast
      type: "SYSTEM",
      severity: "WARNING",
      title: "Weather Advisory",
      message: "High winds in sector 4"
    });

    // Customer 1 listing
    const cust1List = await service.listNotifications(customerUser1, { limit: 10, offset: 0 });
    assert.equal(cust1List.data.length, 2); // Customer 1's notification + org broadcast
    assert.ok(cust1List.data.some((n) => n.userId === customerId1));
    assert.ok(cust1List.data.some((n) => n.userId === null));
    assert.ok(!cust1List.data.some((n) => n.userId === customerId2)); // Never sees customer 2

    // Operator listing
    const opList = await service.listNotifications(operatorUser1, { limit: 10, offset: 0 });
    assert.equal(opList.data.length, 3); // Operator sees all in tenant
  });

  it("marks individual notification read and marks all notifications read (8, 9)", async () => {
    const notif1 = await mockRepo.create({
      id: crypto.randomUUID(),
      organizationId: orgId1,
      userId: customerId1,
      type: "ORDER_UPDATE",
      severity: "INFO",
      title: "Order 1",
      message: "Order placed"
    });

    const notif2 = await mockRepo.create({
      id: crypto.randomUUID(),
      organizationId: orgId1,
      userId: customerId1,
      type: "DELIVERY_UPDATE",
      severity: "SUCCESS",
      title: "Delivery Touchdown",
      message: "Package arrived"
    });

    assert.equal(notif1.isRead, false);
    assert.equal(notif2.isRead, false);

    // Mark single notification read
    const updated = await service.markNotificationRead(notif1.id, customerUser1);
    assert.equal(updated.isRead, true);
    assert.ok(updated.readAt);

    // List unread count
    const listBefore = await service.listNotifications(customerUser1, { limit: 10, offset: 0 });
    assert.equal(listBefore.unreadCount, 1);

    // Mark all read
    const result = await service.markAllRead(customerUser1);
    assert.equal(result.updatedCount, 1);

    const listAfter = await service.listNotifications(customerUser1, { limit: 10, offset: 0 });
    assert.equal(listAfter.unreadCount, 0);
  });

  it("translates domain events to structured notifications and enforces idempotency (10, 11, 12)", async () => {
    const eventId = crypto.randomUUID();
    const event: DomainEventEnvelope = {
      id: eventId,
      version: "v1",
      eventType: "ORDER_DELIVERED",
      occurredAt: new Date().toISOString(),
      organizationId: orgId1,
      aggregateType: "ORDER",
      aggregateId: crypto.randomUUID(),
      payload: {
        orderNumber: "ORD-999",
        customerId: customerId1
      }
    };

    const notifs = await service.createFromDomainEvent(event);
    assert.ok(notifs.length >= 1);
    assert.equal(notifs[0].severity, "SUCCESS");
    assert.equal(notifs[0].title, "Delivery Completed");
    assert.equal(notifs[0].eventId, eventId);

    // Second processing with same eventId must be idempotent (no duplicate notification)
    const duplicateNotifs = await service.createFromDomainEvent(event);
    assert.equal(mockRepo.notifications.filter((n) => n.eventId === eventId).length, notifs.length);
  });

  it("translates battery alerts and emergency events with correct severity (13, 14, 15)", async () => {
    const batteryEvent: DomainEventEnvelope = {
      id: crypto.randomUUID(),
      version: "v1",
      eventType: "DRONE_LOW_BATTERY",
      occurredAt: new Date().toISOString(),
      organizationId: orgId1,
      aggregateType: "DRONE",
      aggregateId: crypto.randomUUID(),
      payload: {
        callSign: "SKYD-101",
        batteryPercent: 22
      }
    };

    const batteryNotifs = await service.createFromDomainEvent(batteryEvent);
    assert.equal(batteryNotifs[0].severity, "WARNING");
    assert.ok(batteryNotifs[0].title.includes("Low Battery"));

    const emergencyEvent: DomainEventEnvelope = {
      id: crypto.randomUUID(),
      version: "v1",
      eventType: "EMERGENCY_TRIGGERED",
      occurredAt: new Date().toISOString(),
      organizationId: orgId1,
      aggregateType: "ALERT",
      aggregateId: crypto.randomUUID(),
      payload: {
        reason: "Motor RPM deviation"
      }
    };

    const emergNotifs = await service.createFromDomainEvent(emergencyEvent);
    assert.equal(emergNotifs[0].severity, "CRITICAL");
    assert.ok(emergNotifs[0].title.includes("Emergency"));
  });

  it("throws NotificationNotFoundError on non-existent ID or access attempt across tenant boundaries (16)", async () => {
    const alienNotifId = crypto.randomUUID();

    // Notification in org2
    await mockRepo.create({
      id: alienNotifId,
      organizationId: orgId2,
      userId: customerId1,
      type: "ORDER_UPDATE",
      severity: "INFO",
      title: "Alien Notification",
      message: "Belongs to Tenant 2"
    });

    // Customer in org1 should get NotFoundError
    await assert.rejects(
      async () => service.getNotification(alienNotifId, customerUser1),
      NotificationNotFoundError
    );

    // Mark read across tenant boundaries should also fail
    await assert.rejects(
      async () => service.markNotificationRead(alienNotifId, customerUser1),
      NotificationNotFoundError
    );
  });
});
