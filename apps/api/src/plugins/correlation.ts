import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string;
    startTimeMs: number;
  }
}

/**
 * Sets up Request Correlation and Tracing hooks globally on the Fastify instance.
 */
export function setupCorrelation(app: FastifyInstance): void {
  app.decorateRequest("correlationId", "");
  app.decorateRequest("startTimeMs", 0);

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    request.startTimeMs = Date.now();

    const incomingHeader =
      request.headers["x-correlation-id"] ||
      request.headers["x-request-id"];

    let correlationId: string;
    if (typeof incomingHeader === "string" && incomingHeader.trim().length > 0) {
      correlationId = incomingHeader.trim().slice(0, 128).replace(/[^a-zA-Z0-9_-]/g, "");
      if (correlationId.length === 0) {
        correlationId = crypto.randomUUID();
      }
    } else {
      correlationId = crypto.randomUUID();
    }

    request.correlationId = correlationId;
    reply.header("x-correlation-id", correlationId);
    reply.header("x-request-id", correlationId);
  });
}
