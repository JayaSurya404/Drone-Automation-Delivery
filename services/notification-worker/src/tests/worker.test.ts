import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NotificationWorker } from "../worker.js";
import { NotificationProcessor } from "../processor.js";
import type { DomainEventEnvelope } from "@skynav/contracts";

describe("Notification Worker / Redis Lifecycle & Channel Subscription", () => {
  it("subscribes to channels and dispatches incoming messages (19, 23)", async () => {
    let receivedEventId: string | null = null;

    const mockProcessor = new NotificationProcessor({
      creator: {
        async createFromDomainEvent(event: DomainEventEnvelope) {
          receivedEventId = event.id;
          return [];
        }
      }
    });

    const mockRedis: any = {
      status: "ready",
      on() {},
      async psubscribe() {},
      async punsubscribe() {},
      async quit() {}
    };

    const worker = new NotificationWorker({
      redisSubscriber: mockRedis,
      processor: mockProcessor
    });

    await worker.start();

    const validEvent: DomainEventEnvelope = {
      id: "11111111-1111-1111-1111-111111111111",
      version: "v1",
      eventType: "ORDER_CREATED",
      occurredAt: new Date().toISOString(),
      organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      aggregateType: "ORDER",
      aggregateId: "22222222-2222-2222-2222-222222222222",
      payload: { customerId: "33333333-3333-3333-3333-333333333333" }
    };

    await worker.handleIncomingMessage(JSON.stringify(validEvent));
    assert.equal(receivedEventId, validEvent.id);

    await worker.stop();
  });
});
