import { Redis } from "ioredis";
import { domainEventEnvelopeSchema, type DomainEventEnvelope } from "@skynav/contracts";

export interface EventPublisher {
  publish(event: DomainEventEnvelope): Promise<void>;
  close?(): Promise<void>;
}

export interface RedisEventPublisherOptions {
  redisUrl?: string;
  redisClient?: Redis;
  onError?: (error: Error, event?: unknown) => void;
}

export class RedisEventPublisher implements EventPublisher {
  private readonly redis: Redis;
  private readonly ownsClient: boolean;
  private readonly onError?: (error: Error, event?: unknown) => void;

  constructor(options: RedisEventPublisherOptions = {}) {
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
   * Publishes domain event to tenant-scoped Redis channels:
   * 1. Organization events: `events:org:${organizationId}`
   * 2. Global domain events: `events:domain`
   */
  async publish(event: DomainEventEnvelope): Promise<void> {
    try {
      const validated = domainEventEnvelopeSchema.parse(event);
      const payload = JSON.stringify(validated);

      const orgChannel = `events:org:${validated.organizationId}`;
      const domainChannel = "events:domain";

      const pipeline = this.redis.pipeline();
      pipeline.publish(orgChannel, payload);
      pipeline.publish(domainChannel, payload);
      await pipeline.exec();
    } catch (err) {
      if (this.onError) {
        this.onError(err as Error, event);
      }
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.ownsClient) {
      await this.redis.quit().catch(() => {});
    }
  }
}

/**
 * In-memory domain event publisher for unit testing and local simulation.
 */
export class InMemoryEventPublisher implements EventPublisher {
  public published: DomainEventEnvelope[] = [];
  public listeners: Array<(event: DomainEventEnvelope) => Promise<void> | void> = [];

  async publish(event: DomainEventEnvelope): Promise<void> {
    const validated = domainEventEnvelopeSchema.parse(event);
    this.published.push(validated);
    for (const listener of this.listeners) {
      await listener(validated);
    }
  }

  subscribe(listener: (event: DomainEventEnvelope) => Promise<void> | void): () => void {
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
