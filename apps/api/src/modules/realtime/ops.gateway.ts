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
import { authenticateSocket, scheduleTokenExpiryDisconnect } from "./socket-auth.util";
import { WsRateLimiter } from "./ws-rate-limiter";

/** Any one of these grants the fleet-wide `/ops` connection — the same permissions Phase 6 already seeded for Delivery Coordinator/Fleet Manager/Drone Operator (see `docs/ARCHITECTURE.md`). A plain Customer has none of them, so they are refused at `handleConnection`, before ever reaching a room. */
const OPS_PERMISSIONS = ["missions.read", "drones.read", "telemetry.read"];

/**
 * `/ops` — the admin/operator fleet-wide namespace. Unlike `/tracking`,
 * authorization *is* checked at connection time (not per-room) because this
 * namespace has no per-entity ownership concept — any authorized staff
 * member sees the whole fleet, exactly like the existing `/fleet`/`/missions`
 * REST list endpoints. Every authorized connection auto-joins `ops:fleet`;
 * `subscribe:mission`/`subscribe:drone` additionally join a scoped room for
 * a detail page, without a second permission check (the connection-time
 * check already covers it, same as REST's list vs. detail endpoints sharing
 * one `@RequirePermission`).
 */
@WebSocketGateway({
  namespace: "/ops",
  cors: { origin: resolveCorsOrigins(), credentials: true },
  maxHttpBufferSize: 8 * 1024,
})
export class OpsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(OpsGateway.name);
  private readonly rateLimiter: WsRateLimiter;
  private readonly connectRateLimiter: WsRateLimiter;
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {
    this.rateLimiter = new WsRateLimiter(
      this.configService.get("WS_SUBSCRIBE_RATE_LIMIT", { infer: true }),
      this.configService.get("WS_SUBSCRIBE_RATE_WINDOW_MS", { infer: true }),
    );
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
    if (!user || !OPS_PERMISSIONS.some((permission) => user.permissions.includes(permission))) {
      socket.emit("error", { code: "FORBIDDEN", message: "Operations access requires a fleet/mission/telemetry permission" });
      socket.disconnect(true);
      return;
    }
    socket.data.user = user;
    await socket.join("ops:fleet");
    const timer = scheduleTokenExpiryDisconnect(socket, user);
    if (timer) {
      this.expiryTimers.set(socket.id, timer);
    }
    this.logger.debug(`ops: ${socket.id} connected as ${user.sub}`);
  }

  handleDisconnect(socket: Socket): void {
    this.rateLimiter.clear(socket.id);
    const timer = this.expiryTimers.get(socket.id);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(socket.id);
    }
  }

  @SubscribeMessage("subscribe:mission")
  async onSubscribeMission(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<{ ok: boolean; error?: string; room?: string }> {
    return this.joinScoped(socket, body, "missionId", "mission");
  }

  @SubscribeMessage("unsubscribe:mission")
  async onUnsubscribeMission(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<{ ok: boolean }> {
    return this.leaveScoped(socket, body, "missionId", "mission");
  }

  @SubscribeMessage("subscribe:drone")
  async onSubscribeDrone(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<{ ok: boolean; error?: string; room?: string }> {
    return this.joinScoped(socket, body, "droneId", "drone");
  }

  @SubscribeMessage("unsubscribe:drone")
  async onUnsubscribeDrone(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<{ ok: boolean }> {
    return this.leaveScoped(socket, body, "droneId", "drone");
  }

  private async joinScoped(
    socket: Socket,
    body: unknown,
    field: string,
    roomPrefix: string,
  ): Promise<{ ok: boolean; error?: string; room?: string }> {
    const user = socket.data.user as AuthenticatedUser | undefined;
    if (!user) {
      return { ok: false, error: "unauthenticated" };
    }
    if (!this.rateLimiter.allow(socket.id)) {
      return { ok: false, error: "rate_limited" };
    }
    const id = extractId(body, field);
    if (!id) {
      return { ok: false, error: "invalid_payload" };
    }
    const room = `${roomPrefix}:${id}`;
    await socket.join(room);
    return { ok: true, room };
  }

  private async leaveScoped(socket: Socket, body: unknown, field: string, roomPrefix: string): Promise<{ ok: boolean }> {
    const id = extractId(body, field);
    if (id) {
      await socket.leave(`${roomPrefix}:${id}`);
    }
    return { ok: true };
  }
}

function extractId(body: unknown, field: string): string | null {
  if (typeof body === "object" && body !== null && field in body) {
    const value = (body as Record<string, unknown>)[field];
    return typeof value === "string" && value.length > 0 ? value : null;
  }
  return null;
}
