import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMockOutboxRepository } from "./mock.repository.js";
import { InMemoryEventPublisher } from "../event.publisher.js";
import { OutboxService } from "../outbox.service.js";
import type { DomainEventEnvelope } from "@skynav/contracts";

describe("Events Domain / OutboxService & Transactional Outbox Pattern Tests", () => {
  let mockOutboxRepo: ReturnType<typeof createMockOutboxRepository>;
  let mockPublisher: InMemoryEventPublisher;
  let outboxService: OutboxService;

  const orgId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  beforeEach(() => {
    mockOutboxRepo = createMockOutboxRepository();
    mockPublisher = new InMemoryEventPublisher();
    outboxService = new OutboxService({
      outboxRepo: mockOutboxRepo,
      eventPublisher: mockPublisher,
      maxRetries: 3
    });
  });

  it("processes pending outbox batch, publishes to event bus, and marks records processed (17, 18)", async () => {
    const event1: DomainEventEnvelope = {
      id: crypto.randomUUID(),
      version: "v1",
      eventType: "ORDER_CREATED",
      occurredAt: new Date().toISOString(),
      organizationId: orgId,
      aggregateType: "ORDER",
      aggregateId: crypto.randomUUID(),
      payload: { orderNumber: "ORD-001" }
    };

    const event2: DomainEventEnvelope = {
      id: crypto.randomUUID(),
      version: "v1",
      eventType: "DRONE_TAKEOFF",
      occurredAt: new Date().toISOString(),
      organizationId: orgId,
      aggregateType: "DRONE",
      aggregateId: crypto.randomUUID(),
      payload: { callSign: "SKYD-01" }
    };

    await mockOutboxRepo.insert(event1);
    await mockOutboxRepo.insert(event2);

    assert.equal(mockOutboxRepo.events.length, 2);
    assert.equal(mockOutboxRepo.events.filter((e) => e.processedAt === null).length, 2);

    const count = await outboxService.processBatch(10);
    assert.equal(count, 2);
    assert.equal(mockPublisher.published.length, 2);
    assert.equal(mockOutboxRepo.events.filter((e) => e.processedAt !== null).length, 2);
  });

  it("increments attempt count and records last_error on publisher failure without crashing (18)", async () => {
    const faultyPublisher = {
      async publish() {
        throw new Error("Redis connection dropped");
      }
    };

    const serviceWithFault = new OutboxService({
      outboxRepo: mockOutboxRepo,
      eventPublisher: faultyPublisher,
      maxRetries: 3
    });

    const event: DomainEventEnvelope = {
      id: crypto.randomUUID(),
      version: "v1",
      eventType: "MISSION_CREATED",
      occurredAt: new Date().toISOString(),
      organizationId: orgId,
      aggregateType: "MISSION",
      aggregateId: crypto.randomUUID(),
      payload: { missionNumber: "MSN-101" }
    };

    await mockOutboxRepo.insert(event);

    const count = await serviceWithFault.processBatch(10);
    assert.equal(count, 0);

    const record = mockOutboxRepo.events[0];
    assert.equal(record.attempts, 1);
    assert.ok(record.lastError?.includes("Redis connection dropped"));
    assert.equal(record.processedAt, null);
  });
});
