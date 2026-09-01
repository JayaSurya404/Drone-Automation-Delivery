import crypto from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../../infrastructure/db/schema.js";

export interface LogAuditParams {
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  correlationId?: string | null;
}

export interface AuditService {
  log(params: LogAuditParams): Promise<void>;
  list(organizationId: string, limit?: number, offset?: number): Promise<Array<{
    id: string;
    organization_id: string;
    actor_user_id: string | null;
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    metadata: unknown;
    correlation_id: string | null;
    created_at: Date;
  }>>;
}

export function createAuditService(db: Kysely<Database>): AuditService {
  return {
    async log(params: LogAuditParams): Promise<void> {
      try {
        await db
          .insertInto("audit_logs")
          .values({
            id: crypto.randomUUID(),
            organization_id: params.organizationId,
            actor_user_id: params.actorUserId ?? null,
            action: params.action,
            resource_type: params.resourceType ?? null,
            resource_id: params.resourceId ?? null,
            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
            correlation_id: params.correlationId ?? null
          })
          .execute();
      } catch (err) {
        // Audit logging should never crash a primary business flow, but must log errors.
        console.error("[audit:error] Failed to persist audit log entry:", err);
      }
    },

    async list(organizationId: string, limit = 50, offset = 0) {
      return await db
        .selectFrom("audit_logs")
        .selectAll()
        .where("organization_id", "=", organizationId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute();
    }
  };
}
