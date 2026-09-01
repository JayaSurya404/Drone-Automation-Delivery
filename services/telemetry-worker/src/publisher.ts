import { Redis } from "ioredis";
import { telemetrySchema, type Telemetry } from "@skynav/contracts";

export interface TelemetryPublisher {
  publish(telemetry: Telemetry): Promise<void>;
  close?(): Promise<void>;
}

export interface RedisTelemetryPublisherOptions {
  redisUrl?: string;
  redisClient?: Redis;
  onError?: (error: Error, telemetry?: unknown) => void;
}

export class RedisTelemetryPublisher implements TelemetryPublisher {
  private readonly redis: Redis;
  private readonly ownsClient: boolean;
  private readonly onError?: (error: Error, telemetry?: unknown) => void;

  constructor(options: RedisTelemetryPublisherOptions = {}) {
    if (options.redisClient) {
      this.redis = options.redisClient;
      this.ownsClient = false;
    } else {
      const url = options.redisUrl || process.env.REDIS_URL || "redis://localhost:6379";
      this.redis = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          return Math.min(times * 100, 3000);
        }
      });
      this.ownsClient = true;
    }
    this.onError = options.onError;

    if (typeof this.redis?.on === "function") {
      this.redis.on("error", (err) => {
        if (this.onError) {
          this.onError(err);
        }
      });
    }
  }

  /**
   * Validates and publishes telemetry to tenant-scoped Redis channels:
   * 1. Organization stream: `telemetry:org:${organizationId}`
   * 2. Targeted drone stream: `telemetry:drone:${organizationId}:${droneId}`
   */
  async publish(telemetry: Telemetry): Promise<void> {
    try {
      const validated = telemetrySchema.parse(telemetry);
      const payload = JSON.stringify(validated);

      const orgChannel = `telemetry:org:${validated.organizationId}`;
      const droneChannel = `telemetry:drone:${validated.organizationId}:${validated.droneId}`;

      // Pipeline Redis PUBLISH commands for efficiency
      const pipeline = this.redis.pipeline();
      pipeline.publish(orgChannel, payload);
      pipeline.publish(droneChannel, payload);
      await pipeline.exec();
    } catch (err) {
      if (this.onError) {
        this.onError(err as Error, telemetry);
      }
    }
  }

  async close(): Promise<void> {
    if (this.ownsClient) {
      await this.redis.quit().catch(() => {});
    }
  }
}

/**
 * In-memory telemetry publisher for deterministic simulator runs and unit tests.
 */
export class InMemoryTelemetryPublisher implements TelemetryPublisher {
  public published: Telemetry[] = [];
  public listeners: Array<(telemetry: Telemetry) => void> = [];

  async publish(telemetry: Telemetry): Promise<void> {
    const validated = telemetrySchema.parse(telemetry);
    this.published.push(validated);
    for (const listener of this.listeners) {
      listener(validated);
    }
  }

  subscribe(listener: (telemetry: Telemetry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  clear(): void {
    this.published = [];
    this.listeners = [];
  }
}
