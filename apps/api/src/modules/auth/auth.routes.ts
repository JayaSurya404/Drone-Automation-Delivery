import type { FastifyPluginAsync } from "fastify";
import {
  registerRequestSchema,
  loginRequestSchema,
  refreshTokenRequestSchema
} from "@skynav/contracts";
import type { AuthService } from "./auth.service.js";
import { requireAuthenticated } from "./rbac.js";

export function createAuthRoutes(authService: AuthService): FastifyPluginAsync {
  return async function authRoutes(fastify) {
    // POST /api/v1/auth/register
    fastify.post("/api/v1/auth/register", async (request, reply) => {
      const body = registerRequestSchema.parse(request.body);
      const result = await authService.register(body);

      // Set HTTP-only secure cookie for refresh token if supported
      reply.setCookie?.("skynav_refresh", result.refreshToken, {
        path: "/api/v1/auth",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60
      });

      return reply.status(201).send(result);
    });

    // POST /api/v1/auth/login
    fastify.post("/api/v1/auth/login", async (request, reply) => {
      const body = loginRequestSchema.parse(request.body);
      const result = await authService.login(body);

      reply.setCookie?.("skynav_refresh", result.refreshToken, {
        path: "/api/v1/auth",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60
      });

      return reply.status(200).send(result);
    });

    // POST /api/v1/auth/refresh
    fastify.post("/api/v1/auth/refresh", async (request, reply) => {
      const parsedBody = refreshTokenRequestSchema.safeParse(request.body);
      const refreshToken =
        (parsedBody.success ? parsedBody.data.refreshToken : undefined) ||
        (request.cookies ? request.cookies["skynav_refresh"] : undefined);

      if (!refreshToken) {
        return reply.status(401).send({
          type: "https://skynav.io/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "Refresh token is missing from body and cookie.",
          code: "MISSING_REFRESH_TOKEN",
          timestamp: new Date().toISOString()
        });
      }

      const result = await authService.refresh(refreshToken);

      reply.setCookie?.("skynav_refresh", result.refreshToken, {
        path: "/api/v1/auth",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60
      });

      return reply.status(200).send(result);
    });

    // POST /api/v1/auth/logout
    fastify.post("/api/v1/auth/logout", async (request, reply) => {
      const parsedBody = refreshTokenRequestSchema.safeParse(request.body);
      const refreshToken =
        (parsedBody.success ? parsedBody.data.refreshToken : undefined) ||
        (request.cookies ? request.cookies["skynav_refresh"] : undefined);

      const actorUserId = request.user?.id;
      const orgId = request.user?.organizationId;

      await authService.logout(refreshToken, actorUserId, orgId);

      reply.clearCookie?.("skynav_refresh", { path: "/api/v1/auth" });

      return reply.status(200).send({
        status: "ok",
        message: "Successfully logged out."
      });
    });

    // GET /api/v1/auth/me
    fastify.get(
      "/api/v1/auth/me",
      {
        preHandler: [requireAuthenticated]
      },
      async (request, reply) => {
        const profile = await authService.getProfile(request.user.id, request.user.organizationId);
        return reply.status(200).send({ data: profile });
      }
    );
  };
}
