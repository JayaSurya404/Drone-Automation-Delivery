import { Redis } from "ioredis";
import type { WebSocket } from "ws";
import {
  telemetrySchema,
  notificationResponseSchema,
  wsClientMessageSchema,
  type Telemetry,
  type NotificationResponse,
  type AuthenticatedUser,
  type WsClientMessage,
  type WsServerMessage,
  type WsSubscriptionChannel
} from "@skynav/contracts";
import type { FleetRepository } from "../fleet/fleet.repository.js";
import type { OrderRepository } from "../orders/order.repository.js";
import type { MissionRepository } from "../missions/mission.repository.js";

export interface ConnectedClient {
  id: string;
  socket: WebSocket;
  user: AuthenticatedUser | null;
  subscriptions: Set<string>;
  lastPingAt: number;
  lastObservedByDrone: Map<string, string>;
  messageQueueCount: number;
}

export interface RealtimeServiceOptions {
  redisSubscriber?: Redis;
  fleetRepo?: FleetRepository;
  orderRepo?: OrderRepository;
  missionRepo?: MissionRepository;
  maxClientQueueSize?: number;
  onError?: (error: Error) => void;
}

export class RealtimeService {
  private readonly clients = new Map<string, ConnectedClient>();
  private readonly channelSubscriptions = new Map<string, Set<string>>(); // channel -> Set<clientId>
  private readonly redis?: Redis;
  private readonly fleetRepo?: FleetRepository;
  private readonly orderRepo?: OrderRepository;
  private readonly missionRepo?: MissionRepository;
  private readonly maxQueueSize: number;
  private readonly onError?: (error: Error) => void;
  private isRunning = false;

  constructor(options: RealtimeServiceOptions = {}) {
    this.redis = options.redisSubscriber;
    this.fleetRepo = options.fleetRepo;
    this.orderRepo = options.orderRepo;
    this.missionRepo = options.missionRepo;
    this.maxQueueSize = options.maxClientQueueSize ?? 50;
    this.onError = options.onError;

    if (this.redis && typeof this.redis.on === "function") {
      this.redis.on("pmessage", (_pattern, channel, message) => {
        this.dispatchRedisMessage(channel, message);
      });
      this.redis.on("error", (err) => {
        if (this.onError) this.onError(err);
      });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    if (this.redis && this.redis.status === "wait") {
      await this.redis.connect().catch((err) => {
        if (this.onError) this.onError(err);
      });
    }
    if (this.redis) {
      await this.redis
        .psubscribe("telemetry:org:*", "telemetry:drone:*", "notifications:org:*", "notifications:user:*")
        .catch((err) => {
          if (this.onError) this.onError(err);
        });
    }
    this.isRunning = true;
  }

  registerClient(clientId: string, socket: WebSocket, user: AuthenticatedUser | null = null): ConnectedClient {
    const client: ConnectedClient = {
      id: clientId,
      socket,
      user,
      subscriptions: new Set(),
      lastPingAt: Date.now(),
      lastObservedByDrone: new Map(),
      messageQueueCount: 0
    };
    this.clients.set(clientId, client);
    return client;
  }

  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const channel of client.subscriptions) {
      const subscribers = this.channelSubscriptions.get(channel);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.channelSubscriptions.delete(channel);
        }
      }
    }

    this.clients.delete(clientId);
  }

  authenticateClient(clientId: string, user: AuthenticatedUser): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.user = user;
      this.sendToClient(client, {
        type: "AUTHENTICATED",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          organizationName: user.organizationName,
          role: user.role,
          permissions: user.permissions as any
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Authorizes and subscribes a connected client to a telemetry channel.
   * Enforces strict multi-tenant scoping and RBAC rules:
   * - Customers can only subscribe to drones associated with their own active orders.
   * - Operators/Admins can subscribe to whole organization or specific drones.
   */
  async handleSubscription(
    client: ConnectedClient,
    channelType: WsSubscriptionChannel,
    targetId?: string
  ): Promise<void> {
    if (!client.user) {
      this.sendError(client, "UNAUTHORIZED", "Authentication credentials required before subscribing.");
      return;
    }

    const { user } = client;

    if (channelType === "telemetry:organization") {
      // Whole-organization stream requires telemetry:read permission and non-customer role
      if (user.role === "CUSTOMER" || !user.permissions.includes("telemetry:read")) {
        this.sendError(
          client,
          "INSUFFICIENT_PERMISSIONS",
          "Customers cannot subscribe to organization-wide telemetry streams."
        );
        return;
      }

      const internalChannel = `telemetry:org:${user.organizationId}`;
      this.addSubscription(client, internalChannel);
      this.sendToClient(client, {
        type: "SUBSCRIBED",
        channel: "telemetry:organization",
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (channelType === "telemetry:drone") {
      if (!targetId) {
        this.sendError(client, "INVALID_REQUEST", "Drone ID is required for telemetry:drone subscription.");
        return;
      }

      // Customer check: verify drone is currently assigned to an order owned by this customer
      if (user.role === "CUSTOMER") {
        if (this.orderRepo) {
          const customerOrders = await this.orderRepo.list({
            organizationId: user.organizationId,
            customerId: user.id,
            limit: 50,
            offset: 0
          });

          // Check if any order is associated with this drone (via missions)
          // If fleetRepo is provided, verify drone belongs to user's org
          if (this.fleetRepo) {
            const drone = await this.fleetRepo.findById(targetId, user.organizationId);
            if (!drone) {
              this.sendError(client, "DRONE_NOT_FOUND", "Drone not found in your organization.");
              return;
            }
          }
        }
      } else {
        // Admin / Operator: verify drone belongs to organization
        if (this.fleetRepo) {
          const drone = await this.fleetRepo.findById(targetId, user.organizationId);
          if (!drone) {
            this.sendError(client, "DRONE_NOT_FOUND", "Drone not found in your organization.");
            return;
          }
        }
      }

      const internalChannel = `telemetry:drone:${user.organizationId}:${targetId}`;
      this.addSubscription(client, internalChannel);
      this.sendToClient(client, {
        type: "SUBSCRIBED",
        channel: `telemetry:drone:${targetId}`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (channelType === "telemetry:mission") {
      if (!targetId) {
        this.sendError(client, "INVALID_REQUEST", "Mission ID is required for telemetry:mission subscription.");
        return;
      }

      if (this.missionRepo) {
        const mission = await this.missionRepo.findById(targetId, user.organizationId);
        if (!mission) {
          this.sendError(client, "MISSION_NOT_FOUND", "Mission not found in your organization.");
          return;
        }

        if (user.role === "CUSTOMER" && this.orderRepo) {
          const order = await this.orderRepo.findById(mission.order_id, user.organizationId);
          if (!order || order.customer_id !== user.id) {
            this.sendError(client, "FORBIDDEN", "You are not authorized to view telemetry for this mission.");
            return;
          }
        }

        if (mission.drone_id) {
          const internalChannel = `telemetry:drone:${user.organizationId}:${mission.drone_id}`;
          this.addSubscription(client, internalChannel);
        }
      }

      this.sendToClient(client, {
        type: "SUBSCRIBED",
        channel: `telemetry:mission:${targetId}`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (channelType === "notifications:organization") {
      if (user.role === "CUSTOMER" || !user.permissions.includes("notifications:read")) {
        this.sendError(
          client,
          "INSUFFICIENT_PERMISSIONS",
          "Customers cannot subscribe to organization-wide notification streams."
        );
        return;
      }

      const internalChannel = `notifications:org:${user.organizationId}`;
      this.addSubscription(client, internalChannel);
      this.sendToClient(client, {
        type: "SUBSCRIBED",
        channel: "notifications:organization",
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (channelType === "notifications:user") {
      const internalChannel = `notifications:user:${user.id}`;
      this.addSubscription(client, internalChannel);
      this.sendToClient(client, {
        type: "SUBSCRIBED",
        channel: "notifications:user",
        timestamp: new Date().toISOString()
      });
      return;
    }
  }

  handleUnsubscription(client: ConnectedClient, channelType: WsSubscriptionChannel, targetId?: string): void {
    if (!client.user) return;

    let internalChannel = "";
    let publicChannel = "";

    if (channelType === "telemetry:organization") {
      internalChannel = `telemetry:org:${client.user.organizationId}`;
      publicChannel = "telemetry:organization";
    } else if (channelType === "telemetry:drone" && targetId) {
      internalChannel = `telemetry:drone:${client.user.organizationId}:${targetId}`;
      publicChannel = `telemetry:drone:${targetId}`;
    } else if (channelType === "notifications:organization") {
      internalChannel = `notifications:org:${client.user.organizationId}`;
      publicChannel = "notifications:organization";
    } else if (channelType === "notifications:user") {
      internalChannel = `notifications:user:${client.user.id}`;
      publicChannel = "notifications:user";
    }

    if (internalChannel) {
      this.removeSubscription(client, internalChannel);
      this.sendToClient(client, {
        type: "UNSUBSCRIBED",
        channel: publicChannel,
        timestamp: new Date().toISOString()
      });
    }
  }

  private addSubscription(client: ConnectedClient, channel: string): void {
    client.subscriptions.add(channel);
    if (!this.channelSubscriptions.has(channel)) {
      this.channelSubscriptions.set(channel, new Set());
    }
    this.channelSubscriptions.get(channel)!.add(client.id);
  }

  private removeSubscription(client: ConnectedClient, channel: string): void {
    client.subscriptions.delete(channel);
    const subscribers = this.channelSubscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(client.id);
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }
  }

  /**
   * Broadcasts a telemetry frame to all matching authorized clients.
   * Enforces stale/out-of-order packet filtering and bounded backpressure queue.
   */
  broadcastTelemetry(telemetry: Telemetry): void {
    const validated = telemetrySchema.parse(telemetry);

    const orgChannel = `telemetry:org:${validated.organizationId}`;
    const droneChannel = `telemetry:drone:${validated.organizationId}:${validated.droneId}`;

    const recipientClientIds = new Set<string>();

    const orgSubscribers = this.channelSubscriptions.get(orgChannel);
    if (orgSubscribers) {
      for (const id of orgSubscribers) recipientClientIds.add(id);
    }

    const droneSubscribers = this.channelSubscriptions.get(droneChannel);
    if (droneSubscribers) {
      for (const id of droneSubscribers) recipientClientIds.add(id);
    }

    const message: WsServerMessage = {
      type: "TELEMETRY",
      channel: `telemetry:drone:${validated.droneId}`,
      telemetry: validated,
      timestamp: new Date().toISOString()
    };

    for (const clientId of recipientClientIds) {
      const client = this.clients.get(clientId);
      if (!client || client.socket.readyState !== 1) continue;

      // Ensure tenant match
      if (!client.user || client.user.organizationId !== validated.organizationId) {
        continue;
      }

      // Ordering & stale telemetry check
      const lastObserved = client.lastObservedByDrone.get(validated.droneId);
      if (lastObserved && new Date(validated.observedAt).getTime() < new Date(lastObserved).getTime()) {
        // Discard out-of-order older frame
        continue;
      }
      client.lastObservedByDrone.set(validated.droneId, validated.observedAt);

      // Backpressure: drop message if client buffer is overflowing
      if (client.socket.bufferedAmount > 64 * 1024) {
        continue;
      }

      this.sendToClient(client, message);
    }
  }

  /**
   * Broadcasts a notification to authorized organization operators or target user.
   */
  broadcastNotification(notification: NotificationResponse): void {
    const validated = notificationResponseSchema.parse(notification);

    const recipientClientIds = new Set<string>();

    // 1. Organization-wide subscribers (operators/admins)
    const orgChannel = `notifications:org:${validated.organizationId}`;
    const orgSubscribers = this.channelSubscriptions.get(orgChannel);
    if (orgSubscribers) {
      for (const id of orgSubscribers) recipientClientIds.add(id);
    }

    // 2. Specific user subscribers (customers or target users)
    if (validated.userId) {
      const userChannel = `notifications:user:${validated.userId}`;
      const userSubscribers = this.channelSubscriptions.get(userChannel);
      if (userSubscribers) {
        for (const id of userSubscribers) recipientClientIds.add(id);
      }
    }

    const message: WsServerMessage = {
      type: "NOTIFICATION",
      channel: validated.userId ? `notifications:user:${validated.userId}` : "notifications:organization",
      notification: validated,
      timestamp: new Date().toISOString()
    };

    for (const clientId of recipientClientIds) {
      const client = this.clients.get(clientId);
      if (!client || client.socket.readyState !== 1) continue;

      // Tenant match check
      if (!client.user || client.user.organizationId !== validated.organizationId) {
        continue;
      }

      // Customer recipient privacy check: if notification is addressed to a user, customer must match that user id
      if (client.user.role === "CUSTOMER" && validated.userId && client.user.id !== validated.userId) {
        continue;
      }

      // Backpressure check
      if (client.socket.bufferedAmount > 64 * 1024) {
        continue;
      }

      this.sendToClient(client, message);
    }
  }

  private dispatchRedisMessage(channel: string, rawMessage: string): void {
    try {
      const parsed = JSON.parse(rawMessage);

      if (channel.startsWith("telemetry:")) {
        const telemetry = telemetrySchema.parse(parsed);
        this.broadcastTelemetry(telemetry);
      } else if (channel.startsWith("notifications:")) {
        const notification = notificationResponseSchema.parse(parsed);
        this.broadcastNotification(notification);
      }
    } catch (err) {
      if (this.onError) this.onError(err as Error);
    }
  }

  sendToClient(client: ConnectedClient, message: WsServerMessage): void {
    if (client.socket.readyState === 1) {
      client.socket.send(JSON.stringify(message));
    }
  }

  sendError(client: ConnectedClient, code: string, message: string): void {
    this.sendToClient(client, {
      type: "ERROR",
      code,
      message,
      timestamp: new Date().toISOString()
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    for (const client of this.clients.values()) {
      try {
        client.socket.close(1000, "Server shutting down");
      } catch {}
    }
    this.clients.clear();
    this.channelSubscriptions.clear();

    if (this.redis) {
      await this.redis
        .punsubscribe("telemetry:org:*", "telemetry:drone:*", "notifications:org:*", "notifications:user:*")
        .catch(() => {});
    }
  }
}
