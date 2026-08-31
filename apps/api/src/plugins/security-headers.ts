import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";

/**
 * Sets up Production Security Headers globally on all HTTP responses.
 */
export function setupSecurityHeaders(app: FastifyInstance): void {
  app.addHook("onSend", async (_request: FastifyRequest, reply: FastifyReply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("x-xss-protection", "0");
    reply.header("referrer-policy", "strict-origin-when-cross-origin");

    if (env.NODE_ENV === "production") {
      reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
    }

    return payload;
  });
}
