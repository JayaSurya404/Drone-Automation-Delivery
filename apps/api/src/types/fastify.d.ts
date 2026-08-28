import "@fastify/jwt";
import type { AuthenticatedUser, UserRole, Permission } from "@skynav/contracts";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      email: string;
      name: string;
      orgId: string;
      orgName: string;
      role: UserRole;
      permissions: Permission[];
    };
    user: AuthenticatedUser;
  }
}
