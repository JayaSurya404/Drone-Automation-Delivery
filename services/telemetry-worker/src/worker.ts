import { Redis } from "ioredis";
import { telemetrySchema, type Telemetry } from "@skynav/contracts";

export interface TelemetryWorkerOptions {
  redisUrl?: string;
  redisSubscriber?: Redis;
  onTelemetry?: (channel: string, telemetry: Telemetry) => Promise<void> | void;
  onError?: (error: Error, rawMessage?: string) => void;
  patterns?: string[];
}

export interface TelemetryWorkerMetrics {
  messagesReceived: number;
  messagesValid: number;
  messagesInvalid: number;
  messagesOutOfOrder: number;
  lastReceivedAt: string | null;
}

export class TelemetryWorker {
  private readonly redis: Redis;
  private readonly ownsClient: boolean;
  private readonly onTelemetry?: (channel: string, telemetry: Telemetry) => Promise<void> | void;
  private readonly onError?: (error: Error, rawMessage?: string) => void;
  private readonly patterns: string[];
  private isRunning = false;

  private readonly lastDroneTimestampMap = new Map<string, string>();

  public readonly metrics: TelemetryWorkerMetrics = {
    messagesReceived: 0,
    messagesValid: 0,
    messagesInvalid: 0,
    messagesOutOfOrder: 0,
    lastReceivedAt: null
  };

  constructor(options: TelemetryWorkerOptions = {}) {
    if (options.redisSubscriber) {
      this.redis = options.redisSubscriber;
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

    this.onTelemetry = options.onTelemetry;
    this.onError = options.onError;
    this.patterns = options.patterns || ["telemetry:org:*", "telemetry:drone:*"];

    if (typeof this.redis?.on === "function") {
      this.redis.on("pmessage", (_pattern, channel, message) => {
        this.handleIncomingMessage(channel, message);
      });

      this.redis.on("error", (err) => {
        if (this.onError) {
          this.onError(err);
        }
      });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    if (this.redis.status === "wait") {
      await this.redis.connect().catch((err) => {
        if (this.onError) this.onError(err);
      });
    }

    if (this.patterns.length > 0) {
      await this.redis.psubscribe(...this.patterns).catch((err) => {
        if (this.onError) this.onError(err);
      });
    }

    this.isRunning = true;
  }

  /**
   * Safely parses, validates, and processes incoming Redis messages.
   * Malformed or corrupt messages are recorded in metrics without crashing the worker.
   */
  handleIncomingMessage(channel: string, rawMessage: string): Telemetry | null {
    this.metrics.messagesReceived++;
    this.metrics.lastReceivedAt = new Date().toISOString();

    try {
      const parsed = JSON.parse(rawMessage);
      const telemetry = telemetrySchema.parse(parsed);

      // Check ordering / stale frame detection
      const lastObserved = this.lastDroneTimestampMap.get(telemetry.droneId);
      if (lastObserved && new Date(telemetry.observedAt).getTime() < new Date(lastObserved).getTime()) {
        this.metrics.messagesOutOfOrder++;
      } else {
        this.lastDroneTimestampMap.set(telemetry.droneId, telemetry.observedAt);
      }

      this.metrics.messagesValid++;

      if (this.onTelemetry) {
        Promise.resolve(this.onTelemetry(channel, telemetry)).catch((err) => {
          if (this.onError) this.onError(err, rawMessage);
        });
      }

      return telemetry;
    } catch (err) {
      this.metrics.messagesInvalid++;
      if (this.onError) {
        this.onError(err as Error, rawMessage);
      }
      return null;
    }
  }

  /**
   * Retrieves the latest observed timestamp for a drone.
   */
  getLastObservedTimestamp(droneId: string): string | undefined {
    return this.lastDroneTimestampMap.get(droneId);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    try {
      if (this.patterns.length > 0) {
        await this.redis.punsubscribe(...this.patterns).catch(() => {});
      }
      if (this.ownsClient) {
        await this.redis.quit().catch(() => {});
      }
    } catch {
      // Ignore errors during shutdown
    }
  }
}
