import { Logger, type INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import type { ServerOptions } from "socket.io";

const logger = new Logger("RedisIoAdapter");

/**
 * Attaches Socket.IO's Redis adapter so both namespaces are scale-out ready
 * from v1 even though this deployment runs a single API instance
 * (`PROJECT_CONTEXT.md` #7 / blueprint Section R: "Redis adapter so multiple
 * API instances share subscriptions... horizontal scale-ready from v1 even
 * if v1 runs one instance"). Reuses the same `REDIS_URL` the rest of the app
 * already connects to — a second pair of clients (pub/sub) is required
 * because a client in subscriber mode can't issue other Redis commands.
 * Applied once in `main.ts`; integration tests skip it (the default
 * in-memory adapter is correct for a single test process).
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  // Phase 13 — these two clients are created here with plain `new Redis()`,
  // entirely outside Nest's DI container (unlike `RedisModule`'s own client,
  // see `redis.module.ts`'s `onApplicationShutdown`), so nothing calls
  // `.quit()` on them automatically. An open ioredis connection keeps
  // Node's event loop non-empty indefinitely — `app.close()` alone (even
  // with `enableShutdownHooks()`) never returns while these are still
  // open, so the process just hangs on SIGTERM until the container
  // orchestrator's kill timeout forces a SIGKILL. `main.ts` calls `close()`
  // below explicitly during shutdown to prevent exactly that.
  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(redisUrl: string): Promise<void> {
    // ioredis emits 'error' on every connection hiccup (including transient
    // ones it will retry past on its own); Node throws an uncaught exception
    // for an 'error' event with zero listeners, which would otherwise crash
    // the whole API process the moment Redis blips — not just the realtime
    // cross-instance fan-out that actually depends on it (Phase 12 hardening:
    // a Redis outage must degrade WebSocket scale-out, not the whole API).
    const pubClient = new Redis(redisUrl, { lazyConnect: true });
    const subClient = pubClient.duplicate();
    pubClient.on("error", (error) => logger.warn(`Redis pub client error: ${error.message}`));
    subClient.on("error", (error) => logger.warn(`Redis sub client error: ${error.message}`));
    this.pubClient = pubClient;
    this.subClient = subClient;

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.adapterConstructor = createAdapter(pubClient, subClient);
    } catch (error) {
      logger.warn(
        `Redis unavailable at startup — WebSocket gateways will run without cross-instance fan-out (fine for a single API instance): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  /** Called explicitly by `main.ts`'s shutdown handler — see the field comment above for why this can't just be left to `app.close()`. */
  async close(): Promise<void> {
    const quiet = async (client: Redis | undefined, label: string) => {
      if (!client) return;
      try {
        await client.quit();
      } catch (error) {
        // Already disconnected (e.g. Redis was never reachable, or dropped
        // the connection first) — not a shutdown failure, the goal (no open
        // handle left behind) is already satisfied either way.
        logger.debug(`${label} quit() during shutdown: ${error instanceof Error ? error.message : error}`);
      }
    };
    await Promise.all([quiet(this.pubClient, "pubClient"), quiet(this.subClient, "subClient")]);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options) as { adapter: (ctor: ReturnType<typeof createAdapter>) => void };
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
