import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { EnvConfig } from "../../config/env.validation";
import { resolveCorsOrigins } from "../../config/cors.util";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { DeliveryService } from "../delivery/delivery.service";
import { authenticateSocket, scheduleTokenExpiryDisconnect } from "./socket-auth.util";
import { WsRateLimiter } from "./ws-rate-limiter";

/**
 * `/tracking` — the customer-facing namespace (blueprint Section R). A
 * connection is only authenticated (any valid access token); authorization
 * happens per-subscription, not per-connection, because a customer's
 * deliveries change over the life of the connection (a page could
 * legitimately track more than one active order). Every `subscribe:delivery`
 * call re-checks ownership through `DeliveryService.getDeliveryForViewer` —
 * the exact same ownership logic every REST delivery endpoint already uses —
 * so a customer can never join another customer's `delivery:<id>` room, and
 * staff join it too only via their own `delivery.read` permission, same as
 * the REST API.
 */
@WebSocketGateway({
  namespace: "/tracking",
  cors: { origin: resolveCorsOrigins(), credentials: true },
  maxHttpBufferSize: 8 * 1024,
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);
  private readonly rateLimiter: WsRateLimiter;
  private readonly connectRateLimiter: WsRateLimiter;
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly deliveryService: DeliveryService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {
    this.rateLimiter = new WsRateLimiter(
      this.configService.get("WS_SUBSCRIBE_RATE_LIMIT", { infer: true }),
      this.configService.get("WS_SUBSCRIBE_RATE_WINDOW_MS", { infer: true }),
    );
    // Phase 12 fix: connection attempts themselves were previously unbounded
    // — only post-connect subscribe/unsubscribe messages were rate-limited.
    // Keyed by remote address (not socket id, which doesn't exist yet at
    // this point) so repeated reconnect attempts from one source are bounded
    // before a JWT verification is even attempted.
    this.connectRateLimiter = new WsRateLimiter(
      this.configService.get("WS_CONNECT_RATE_LIMIT", { infer: true }),
      this.configService.get("WS_CONNECT_RATE_WINDOW_MS", { infer: true }),
    );
  }

  async handleConnection(socket: Socket): Promise<void> {
    if (!this.connectRateLimiter.allow(socket.handshake.address)) {
      socket.disconnect(true);
      return;
    }
    const user = await authenticateSocket(this.jwtService, socket);
    if (!user) {
      socket.emit("error", { code: "UNAUTHENTICATED", message: "A valid access token is required" });
      socket.disconnect(true);
      return;
    }
    socket.data.user = user;
    const timer = scheduleTokenExpiryDisconnect(socket, user);
    if (timer) {
      this.expiryTimers.set(socket.id, timer);
    }
    this.logger.debug(`tracking: ${socket.id} connected as ${user.sub}`);
  }

  handleDisconnect(socket: Socket): void {
    this.rateLimiter.clear(socket.id);
    const timer = this.expiryTimers.get(socket.id);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(socket.id);
    }
  }

  @SubscribeMessage("subscribe:delivery")
  async onSubscribeDelivery(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<{ ok: boolean; error?: string; room?: string }> {
    const user = socket.data.user as AuthenticatedUser | undefined;
    if (!user) {
      return { ok: false, error: "unauthenticated" };
    }
    if (!this.rateLimiter.allow(socket.id)) {
      return { ok: false, error: "rate_limited" };
    }
    const deliveryId = extractDeliveryId(body);
    if (!deliveryId) {
      return { ok: false, error: "invalid_payload" };
    }

    try {
      await this.deliveryService.getDeliveryForViewer(deliveryId, user);
    } catch {
      // Not found *or* not owned — identical response either way so a
      // socket can never distinguish "doesn't exist" from "not yours."
      return { ok: false, error: "not_found" };
    }

    const room = `delivery:${deliveryId}`;
    await socket.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage("unsubscribe:delivery")
  async onUnsubscribeDelivery(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<{ ok: boolean }> {
    const deliveryId = extractDeliveryId(body);
    if (deliveryId) {
      await socket.leave(`delivery:${deliveryId}`);
    }
    return { ok: true };
  }
}

function extractDeliveryId(body: unknown): string | null {
  if (typeof body === "object" && body !== null && "deliveryId" in body) {
    const value = (body as { deliveryId: unknown }).deliveryId;
    return typeof value === "string" && value.length > 0 ? value : null;
  }
  return null;
}
