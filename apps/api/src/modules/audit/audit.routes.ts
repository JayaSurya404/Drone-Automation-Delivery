import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "./audit.service.js";
import { requireAuthenticated, requirePermission } from "../auth/rbac.js";

export function createAuditRoutes(auditService: AuditService): FastifyPluginAsync {
  return async function auditRoutes(fastify) {
    fastify.get(
      "/api/v1/audit-logs",
      {
        preHandler: [requireAuthenticated, requirePermission("audit:read")]
      },
      async (request, reply) => {
        const organizationId = request.user.organizationId;
        const query = request.query as { limit?: string; offset?: string };
        const limit = Math.min(Number(query.limit ?? 50), 100);
        const offset = Math.max(Number(query.offset ?? 0), 0);

        const logs = await auditService.list(organizationId, limit, offset);
        return reply.send({
          data: logs,
          meta: {
            limit,
            offset,
            count: logs.length
          }
        });
      }
    );
  };
}
