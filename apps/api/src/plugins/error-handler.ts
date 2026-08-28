import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../modules/auth/auth.service.js";

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  const timestamp = new Date().toISOString();
  const instance = request.url;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const fieldViolations = error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message
    }));

    return reply.status(400).send({
      type: "https://skynav.io/errors/validation",
      title: "Validation Error",
      status: 400,
      detail: "Request payload failed schema validation.",
      instance,
      code: "SCHEMA_VALIDATION_ERROR",
      timestamp,
      errors: fieldViolations
    });
  }

  // Handle domain AuthError
  if (error instanceof AuthError) {
    return reply.status(error.statusCode).send({
      type: `https://skynav.io/errors/${error.code.toLowerCase().replace(/_/g, "-")}`,
      title: error.name,
      status: error.statusCode,
      detail: error.message,
      instance,
      code: error.code,
      timestamp,
      details: error.details
    });
  }

  // Handle JWT errors from Fastify
  if ("statusCode" in error && error.statusCode === 401) {
    return reply.status(401).send({
      type: "https://skynav.io/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: error.message || "Authentication credentials required or expired.",
      instance,
      code: "UNAUTHORIZED",
      timestamp
    });
  }

  const statusCode = (error as FastifyError).statusCode || 500;
  if (statusCode >= 500) {
    request.log.error({ err: error }, "Unhandled internal server error");
  }

  return reply.status(statusCode).send({
    type: "https://skynav.io/errors/internal",
    title: statusCode === 404 ? "Not Found" : "Internal Server Error",
    status: statusCode,
    detail: statusCode === 500 ? "An unexpected server error occurred." : error.message,
    instance,
    code: statusCode === 404 ? "NOT_FOUND" : "INTERNAL_ERROR",
    timestamp
  });
}
