import type { OutboxRepository, OutboxEventRecord } from "../outbox.repository.js";
import { domainEventEnvelopeSchema, type DomainEventEnvelope, type DomainEventType } from "@skynav/contracts";

export function createMockOutboxRepository(): OutboxRepository & { events: OutboxEventRecord[] } {
  const events: OutboxEventRecord[] = [];

  return {
    events,

    async insert(event: DomainEventEnvelope): Promise<void> {
      const validated = domainEventEnvelopeSchema.parse(event);
      events.push({
        id: validated.id,
        organizationId: validated.organizationId,
        eventType: validated.eventType as DomainEventType,
        aggregateType: validated.aggregateType,
        aggregateId: validated.aggregateId,
        actorId: validated.actorId ?? null,
        payload: validated.payload,
        occurredAt: validated.occurredAt,
        processedAt: null,
        attempts: 0,
        lastError: null
      });
    },

    async fetchUnprocessed(limit = 50): Promise<OutboxEventRecord[]> {
      return events
        .filter((e) => e.processedAt === null)
        .slice(0, limit);
    },

    async markProcessed(id: string): Promise<void> {
      const found = events.find((e) => e.id === id);
      if (found) {
        found.processedAt = new Date().toISOString();
      }
    },

    async markFailed(id: string, error: string): Promise<void> {
      const found = events.find((e) => e.id === id);
      if (found) {
        found.attempts += 1;
        found.lastError = error;
      }
    }
  };
}
