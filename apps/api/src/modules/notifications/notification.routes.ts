import type { FastifyPluginAsync } from "fastify";
import {
  notificationListQuerySchema,
  notificationListResponseSchema,
  notificationResponseSchema,
  uuidSchema
} from "@skynav/contracts";
import {
  requireAuthenticated,
  requirePermission
} from "../auth/rbac.js";
import {
  type NotificationService,
  NotificationNotFoundError,
  NotificationForbiddenError
} from "./notification.service.js";

export function createNotificationRoutes(notificationService: NotificationService): FastifyPluginAsync {
  return async function notificationRoutes(app) {
    // ------------------------------------------------------------------------
    // GET /api/v1/notifications
    // ------------------------------------------------------------------------
    app.get(
      "/api/v1/notifications",
      {
        preHandler: [requireAuthenticated, requirePermission("notifications:read")]
      },
      async (request, reply) => {
        const query = notificationListQuerySchema.parse(request.query);
        const result = await notificationService.listNotifications(request.user!, query);
        return reply.status(200).send(notificationListResponseSchema.parse(result));
      }
    );

    // ------------------------------------------------------------------------
    // GET /api/v1/notifications/:notificationId
    // ------------------------------------------------------------------------
    app.get<{ Params: { notificationId: string } }>(
      "/api/v1/notifications/:notificationId",
      {
        preHandler: [requireAuthenticated, requirePermission("notifications:read")]
      },
      async (request, reply) => {
        const notificationId = uuidSchema.parse(request.params.notificationId);

        try {
          const notification = await notificationService.getNotification(notificationId, request.user!);
          return reply.status(200).send(notificationResponseSchema.parse(notification));
        } catch (err) {
          if (err instanceof NotificationNotFoundError) {
            return reply.status(404).send({
              type: "https://api.skynav.io/errors/not-found",
              title: "Notification Not Found",
              status: 404,
              detail: err.message,
              instance: request.url
            });
          }
          if (err instanceof NotificationForbiddenError) {
            return reply.status(403).send({
              type: "https://api.skynav.io/errors/forbidden",
              title: "Forbidden",
              status: 403,
              detail: err.message,
              instance: request.url
            });
          }
          throw err;
        }
      }
    );

    // ------------------------------------------------------------------------
    // PATCH /api/v1/notifications/:notificationId/read
    // ------------------------------------------------------------------------
    app.patch<{ Params: { notificationId: string } }>(
      "/api/v1/notifications/:notificationId/read",
      {
        preHandler: [requireAuthenticated, requirePermission("notifications:read")]
      },
      async (request, reply) => {
        const notificationId = uuidSchema.parse(request.params.notificationId);

        try {
          const updated = await notificationService.markNotificationRead(notificationId, request.user!);
          return reply.status(200).send(notificationResponseSchema.parse(updated));
        } catch (err) {
          if (err instanceof NotificationNotFoundError) {
            return reply.status(404).send({
              type: "https://api.skynav.io/errors/not-found",
              title: "Notification Not Found",
              status: 404,
              detail: err.message,
              instance: request.url
            });
          }
          throw err;
        }
      }
    );

    // ------------------------------------------------------------------------
    // PATCH /api/v1/notifications/read-all
    // ------------------------------------------------------------------------
    app.patch(
      "/api/v1/notifications/read-all",
      {
        preHandler: [requireAuthenticated, requirePermission("notifications:read")]
      },
      async (request, reply) => {
        const result = await notificationService.markAllRead(request.user!);
        return reply.status(200).send({
          success: true,
          updatedCount: result.updatedCount,
          timestamp: new Date().toISOString()
        });
      }
    );
  };
}
