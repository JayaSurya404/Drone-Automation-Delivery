import { Redis } from "ioredis";
import type { NotificationProcessor } from "./processor.js";

export interface NotificationWorkerOptions {
  redisUrl?: string;
  redisSubscriber?: Redis;
  processor: NotificationProcessor;
  patterns?: string[];
  onError?: (error: Error, rawMessage?: string) => void;
}

export interface NotificationWorkerMetrics {
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  lastProcessedAt: string | null;
}

export class NotificationWorker {
  private readonly redis: Redis;
  private readonly ownsClient: boolean;
  private readonly processor: NotificationProcessor;
  private readonly patterns: string[];
  private readonly onError?: (error: Error, rawMessage?: string) => void;
  private isRunning = false;

  public readonly metrics: NotificationWorkerMetrics = {
    messagesReceived: 0,
    messagesProcessed: 0,
    messagesFailed: 0,
    lastProcessedAt: null
  };

  constructor(options: NotificationWorkerOptions) {
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

    this.processor = options.processor;
    this.patterns = options.patterns || ["events:org:*", "events:domain"];
    this.onError = options.onError;

    if (typeof this.redis?.on === "function") {
      this.redis.on("pmessage", (_pattern, _channel, message) => {
        this.handleIncomingMessage(message);
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

  async handleIncomingMessage(rawMessage: string): Promise<void> {
    this.metrics.messagesReceived++;
    this.metrics.lastProcessedAt = new Date().toISOString();

    try {
      await this.processor.processEvent(rawMessage);
      this.metrics.messagesProcessed++;
    } catch (err) {
      this.metrics.messagesFailed++;
      if (this.onError) {
        this.onError(err as Error, rawMessage);
      }
    }
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
      // Ignore errors on shutdown
    }
  }
}
