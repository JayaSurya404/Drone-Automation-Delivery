import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Pre-handler hook to ensure that any client request targeting a specific organizationId
 * matches the authenticated user's server-side verified organizationId context.
 *
 * Checks in order:
 * 1. request.params.orgId or request.params.organizationId
 * 2. request.query.organizationId
 * 3. request.headers['x-organization-id']
 */
export async function requireTenantIsolation(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    return reply.status(401).send({
      type: "https://skynav.io/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "Authentication required for tenant operations.",
      code: "UNAUTHENTICATED",
      timestamp: new Date().toISOString()
    });
  }

  const params = request.params as Record<string, string | undefined> | undefined;
  const query = request.query as Record<string, string | undefined> | undefined;

  const requestedOrgId =
    params?.orgId ||
    params?.organizationId ||
    query?.organizationId ||
    (request.headers["x-organization-id"] as string | undefined);

  if (requestedOrgId && requestedOrgId !== request.user.organizationId) {
    return reply.status(403).send({
      type: "https://skynav.io/errors/cross-tenant-forbidden",
      title: "Cross-Tenant Access Denied",
      status: 403,
      detail: "Access to another organization's resources is strictly prohibited.",
      code: "CROSS_TENANT_ACCESS_DENIED",
      timestamp: new Date().toISOString()
    });
  }
}
