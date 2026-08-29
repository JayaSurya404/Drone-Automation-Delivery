import { Redis } from "ioredis";
import { notificationResponseSchema, type NotificationResponse } from "@skynav/contracts";

export interface NotificationPublisher {
  publish(notification: NotificationResponse): Promise<void>;
  close?(): Promise<void>;
}

export interface RedisNotificationPublisherOptions {
  redisUrl?: string;
  redisClient?: Redis;
  onError?: (error: Error, notification?: unknown) => void;
}

export class RedisNotificationPublisher implements NotificationPublisher {
  private readonly redis: Redis;
  private readonly ownsClient: boolean;
  private readonly onError?: (error: Error, notification?: unknown) => void;

  constructor(options: RedisNotificationPublisherOptions = {}) {
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
   * Publishes notification to tenant and recipient-scoped Redis channels:
   * 1. Organization stream: `notifications:org:${organizationId}`
   * 2. User stream: `notifications:user:${userId}` (if user-targeted)
   */
  async publish(notification: NotificationResponse): Promise<void> {
    try {
      const validated = notificationResponseSchema.parse(notification);
      const payload = JSON.stringify(validated);

      const orgChannel = `notifications:org:${validated.organizationId}`;
      const pipeline = this.redis.pipeline();
      pipeline.publish(orgChannel, payload);

      if (validated.userId) {
        const userChannel = `notifications:user:${validated.userId}`;
        pipeline.publish(userChannel, payload);
      }

      await pipeline.exec();
    } catch (err) {
      if (this.onError) {
        this.onError(err as Error, notification);
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
 * In-memory notification publisher for unit testing and local simulation.
 */
export class InMemoryNotificationPublisher implements NotificationPublisher {
  public published: NotificationResponse[] = [];
  public listeners: Array<(notification: NotificationResponse) => void> = [];

  async publish(notification: NotificationResponse): Promise<void> {
    const validated = notificationResponseSchema.parse(notification);
    this.published.push(validated);
    for (const listener of this.listeners) {
      listener(validated);
    }
  }

  subscribe(listener: (notification: NotificationResponse) => void): () => void {
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
