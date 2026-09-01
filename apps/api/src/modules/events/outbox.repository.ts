import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../infrastructure/db/schema.js";
import {
  domainEventEnvelopeSchema,
  type DomainEventEnvelope,
  type DomainEventType
} from "@skynav/contracts";

export interface OutboxEventRecord {
  id: string;
  organizationId: string;
  eventType: DomainEventType;
  aggregateType: string;
  aggregateId: string;
  actorId: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
  processedAt: string | null;
  attempts: number;
  lastError: string | null;
}

export interface OutboxRepository {
  insert(event: DomainEventEnvelope, executor?: Kysely<Database> | Transaction<Database>): Promise<void>;
  fetchUnprocessed(limit?: number): Promise<OutboxEventRecord[]>;
  markProcessed(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}

export function createOutboxRepository(db: Kysely<Database>): OutboxRepository {
  return {
    async insert(event: DomainEventEnvelope, executor: Kysely<Database> | Transaction<Database> = db): Promise<void> {
      const validated = domainEventEnvelopeSchema.parse(event);

      await executor
        .insertInto("outbox_events")
        .values({
          id: validated.id,
          organization_id: validated.organizationId,
          event_type: validated.eventType,
          aggregate_type: validated.aggregateType,
          aggregate_id: validated.aggregateId,
          actor_id: validated.actorId ?? null,
          payload: JSON.stringify(validated.payload),
          occurred_at: new Date(validated.occurredAt),
          attempts: 0,
          last_error: null
        })
        .execute();
    },

    async fetchUnprocessed(limit = 50): Promise<OutboxEventRecord[]> {
      const rows = await db
        .selectFrom("outbox_events")
        .selectAll()
        .where("processed_at", "is", null)
        .orderBy("occurred_at", "asc")
        .limit(limit)
        .execute();

      return rows.map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        eventType: row.event_type as DomainEventType,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        actorId: row.actor_id,
        payload: typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload as Record<string, unknown>),
        occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at),
        processedAt: row.processed_at instanceof Date ? row.processed_at.toISOString() : (row.processed_at ? String(row.processed_at) : null),
        attempts: row.attempts,
        lastError: row.last_error
      }));
    },

    async markProcessed(id: string): Promise<void> {
      await db
        .updateTable("outbox_events")
        .set({
          processed_at: new Date()
        })
        .where("id", "=", id)
        .execute();
    },

    async markFailed(id: string, error: string): Promise<void> {
      const existing = await db
        .selectFrom("outbox_events")
        .select(["attempts"])
        .where("id", "=", id)
        .executeTakeFirst();

      const nextAttempts = (existing?.attempts ?? 0) + 1;

      await db
        .updateTable("outbox_events")
        .set({
          attempts: nextAttempts,
          last_error: error.slice(0, 1000)
        })
        .where("id", "=", id)
        .execute();
    }
  };
}
