import type { FastifyRequest, FastifyReply } from "fastify";
import {
  type UserRole,
  type Permission,
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  roleHasPermission
} from "@skynav/contracts";

export { type UserRole, type Permission, ROLE_PERMISSIONS, getPermissionsForRole, roleHasPermission };

/**
 * Pre-handler hook requiring a valid authenticated user on the request context.
 */
export async function requireAuthenticated(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    return reply.status(401).send({
      type: "https://skynav.io/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "Authentication credentials are required to access this resource.",
      code: "UNAUTHENTICATED",
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Pre-handler hook factory requiring one or more specific roles.
 */
export function requireRole(roles: UserRole | UserRole[]) {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return async function checkRoleHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        type: "https://skynav.io/errors/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: "Authentication is required.",
        code: "UNAUTHENTICATED",
        timestamp: new Date().toISOString()
      });
    }

    if (!allowed.includes(request.user.role as UserRole)) {
      return reply.status(403).send({
        type: "https://skynav.io/errors/forbidden",
        title: "Forbidden",
        status: 403,
        detail: `Role '${request.user.role}' does not have sufficient privileges for this operation. Required: [${allowed.join(", ")}].`,
        code: "INSUFFICIENT_ROLE",
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Pre-handler hook factory requiring one or more specific permissions.
 */
export function requirePermission(permissions: Permission | Permission[]) {
  const required = Array.isArray(permissions) ? permissions : [permissions];

  return async function checkPermissionHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        type: "https://skynav.io/errors/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: "Authentication is required.",
        code: "UNAUTHENTICATED",
        timestamp: new Date().toISOString()
      });
    }

    const userPerms = request.user.permissions ?? [];
    const missing = required.filter((p) => !userPerms.includes(p));

    if (missing.length > 0) {
      return reply.status(403).send({
        type: "https://skynav.io/errors/forbidden",
        title: "Forbidden",
        status: 403,
        detail: `Missing required permission(s): [${missing.join(", ")}].`,
        code: "INSUFFICIENT_PERMISSIONS",
        timestamp: new Date().toISOString()
      });
    }
  };
}
