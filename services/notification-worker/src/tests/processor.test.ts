import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NotificationProcessor } from "../processor.js";
import { InMemoryNotificationPublisher } from "../publisher.js";
import type { DomainEventEnvelope, NotificationResponse } from "@skynav/contracts";

describe("Notification Worker / Event Processing & Idempotency", () => {
  it("processes valid domain events and creates targeted notifications (19, 20)", async () => {
    const publisher = new InMemoryNotificationPublisher();
    const createdList: NotificationResponse[] = [];

    const mockCreator = {
      async createFromDomainEvent(event: DomainEventEnvelope): Promise<NotificationResponse[]> {
        const notif: NotificationResponse = {
          id: "55555555-5555-5555-5555-555555555555",
          organizationId: event.organizationId,
          userId: (event.payload?.customerId as string) || null,
          type: "ORDER_UPDATE",
          severity: "INFO",
          title: "Order Placed",
          message: "Order placed successfully",
          isRead: false,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          eventId: event.id,
          createdAt: new Date().toISOString()
        };
        createdList.push(notif);
        return [notif];
      }
    };

    const processor = new NotificationProcessor({
      creator: mockCreator,
      publisher
    });

    const event: DomainEventEnvelope = {
      id: "11111111-1111-1111-1111-111111111111",
      version: "v1",
      eventType: "ORDER_CREATED",
      occurredAt: new Date().toISOString(),
      organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      aggregateType: "ORDER",
      aggregateId: "22222222-2222-2222-2222-222222222222",
      actorId: "33333333-3333-3333-3333-333333333333",
      payload: {
        orderNumber: "ORD-001",
        customerId: "33333333-3333-3333-3333-333333333333"
      }
    };

    const result = await processor.processEvent(event);
    assert.equal(result.length, 1);
    assert.equal(result[0].userId, "33333333-3333-3333-3333-333333333333");
    assert.equal(publisher.published.length, 1);
    assert.equal(processor.metrics.eventsProcessed, 1);
    assert.equal(processor.metrics.notificationsCreated, 1);
  });

  it("handles malformed JSON or schema violations safely without throwing (20)", async () => {
    let errorHandled = false;
    const processor = new NotificationProcessor({
      creator: { async createFromDomainEvent() { return []; } },
      onError: () => {
        errorHandled = true;
      }
    });

    const result1 = await processor.processEvent("INVALID_JSON{");
    assert.deepEqual(result1, []);
    assert.equal(processor.metrics.eventsInvalid, 1);
    assert.equal(errorHandled, true);

    const result2 = await processor.processEvent({ bad: "schema" });
    assert.deepEqual(result2, []);
    assert.equal(processor.metrics.eventsInvalid, 2);
  });
});
