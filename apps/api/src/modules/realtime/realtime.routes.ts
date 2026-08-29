import type { FastifyPluginAsync } from "fastify";
import crypto from "node:crypto";
import {
  wsClientMessageSchema,
  type AuthenticatedUser,
  type UserRole,
  type Permission
} from "@skynav/contracts";
import type { RealtimeService } from "./realtime.service.js";

export function createRealtimeRoutes(realtimeService: RealtimeService): FastifyPluginAsync {
  return async function realtimeRoutes(app) {
    // ------------------------------------------------------------------------
    // WebSocket Gateway: /api/v1/ws/telemetry
    // ------------------------------------------------------------------------
    app.get<{ Querystring: { token?: string } }>(
      "/api/v1/ws/telemetry",
      { websocket: true },
      async (socket, request) => {
        const clientId = crypto.randomUUID();
        let authenticatedUser: AuthenticatedUser | null = null;

        // 1. Check if token was provided in query or Authorization header
        const queryToken = (request.query as any)?.token;
        const authHeader = request.headers.authorization;
        const token = queryToken || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

        if (token) {
          try {
            const decoded = app.jwt.verify<{
              sub: string;
              email: string;
              name: string;
              orgId: string;
              orgName: string;
              role: UserRole;
              permissions: Permission[];
            }>(token);

            if (decoded) {
              authenticatedUser = {
                id: decoded.sub,
                email: decoded.email,
                name: decoded.name,
                organizationId: decoded.orgId,
                organizationName: decoded.orgName,
                role: decoded.role,
                permissions: decoded.permissions
              };
            }
          } catch {
            // Invalid initial token
          }
        }

        const client = realtimeService.registerClient(clientId, socket as any, authenticatedUser);

        if (authenticatedUser) {
          realtimeService.authenticateClient(clientId, authenticatedUser);
        }

        // Set up connection timeout for unauthenticated clients (10 seconds)
        const authTimeout = setTimeout(() => {
          if (!client.user && socket.readyState === 1) {
            realtimeService.sendError(client, "AUTH_TIMEOUT", "Authentication timeout expired.");
            socket.close(4401, "Authentication timeout");
          }
        }, 10000);

        socket.on("message", async (data: any) => {
          try {
            const rawStr = data.toString();
            const parsedJson = JSON.parse(rawStr);
            const msg = wsClientMessageSchema.parse(parsedJson);

            if (msg.type === "AUTH") {
              clearTimeout(authTimeout);
              try {
                const decoded = app.jwt.verify<{
                  sub: string;
                  email: string;
                  name: string;
                  orgId: string;
                  orgName: string;
                  role: UserRole;
                  permissions: Permission[];
                }>(msg.token);

                const user: AuthenticatedUser = {
                  id: decoded.sub,
                  email: decoded.email,
                  name: decoded.name,
                  organizationId: decoded.orgId,
                  organizationName: decoded.orgName,
                  role: decoded.role,
                  permissions: decoded.permissions
                };

                realtimeService.authenticateClient(clientId, user);
              } catch {
                realtimeService.sendError(client, "INVALID_TOKEN", "JWT verification failed.");
                socket.close(4401, "Invalid token");
              }
              return;
            }

            if (msg.type === "SUBSCRIBE") {
              await realtimeService.handleSubscription(client, msg.channel, msg.id);
              return;
            }

            if (msg.type === "UNSUBSCRIBE") {
              realtimeService.handleUnsubscription(client, msg.channel, msg.id);
              return;
            }

            if (msg.type === "PING") {
              realtimeService.sendToClient(client, {
                type: "PONG",
                timestamp: new Date().toISOString()
              });
              return;
            }
          } catch (err: any) {
            realtimeService.sendError(client, "MALFORMED_MESSAGE", err.message || "Invalid message format.");
          }
        });

        socket.on("close", () => {
          clearTimeout(authTimeout);
          realtimeService.unregisterClient(clientId);
        });

        socket.on("error", () => {
          clearTimeout(authTimeout);
          realtimeService.unregisterClient(clientId);
        });
      }
    );
  };
}
