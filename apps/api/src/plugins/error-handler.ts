import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthError } from "../modules/auth/auth.service.js";
import {
  OrderNotFoundError,
  OrderForbiddenError,
  OrderCancellationProhibitedError
} from "../modules/orders/order.service.js";
import { InvalidOrderStateTransitionError } from "../modules/orders/order.state-machine.js";

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

  // Handle domain OrderNotFoundError
  if (error instanceof OrderNotFoundError) {
    return reply.status(404).send({
      type: "https://skynav.io/errors/order-not-found",
      title: "Order Not Found",
      status: 404,
      detail: error.message,
      instance,
      code: error.code,
      timestamp
    });
  }

  // Handle domain OrderForbiddenError
  if (error instanceof OrderForbiddenError) {
    return reply.status(403).send({
      type: "https://skynav.io/errors/forbidden",
      title: "Order Access Forbidden",
      status: 403,
      detail: error.message,
      instance,
      code: error.code,
      timestamp
    });
  }

  // Handle domain InvalidOrderStateTransitionError
  if (error instanceof InvalidOrderStateTransitionError) {
    return reply.status(422).send({
      type: "https://skynav.io/errors/invalid-order-state-transition",
      title: "Invalid Order State Transition",
      status: 422,
      detail: error.message,
      instance,
      code: error.code,
      timestamp,
      currentStatus: error.currentStatus,
      targetStatus: error.targetStatus
    });
  }

  // Handle domain OrderCancellationProhibitedError
  if (error instanceof OrderCancellationProhibitedError) {
    return reply.status(422).send({
      type: "https://skynav.io/errors/order-cancellation-prohibited",
      title: "Order Cancellation Prohibited",
      status: 422,
      detail: error.message,
      instance,
      code: error.code,
      timestamp
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
