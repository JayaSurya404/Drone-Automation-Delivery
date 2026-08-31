import { NotificationWorker } from "./worker.js";
import { NotificationProcessor, type NotificationCreator } from "./processor.js";
import { RedisNotificationPublisher } from "./publisher.js";
import type { DomainEventEnvelope, NotificationResponse } from "@skynav/contracts";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

console.log("[skynav-notification-worker] Initializing Notification Worker...");
console.log(`[skynav-notification-worker] Redis target: ${redisUrl.replace(/:[^:@]+@/, ":****@")}`);

const defaultCreator: NotificationCreator = {
  async createFromDomainEvent(event: DomainEventEnvelope): Promise<NotificationResponse[]> {
    const timestamp = new Date().toISOString();
    return [
      {
        id: event.id,
        organizationId: event.organizationId,
        userId: event.actorId || null,
        type: "SYSTEM",
        severity: "INFO",
        title: `Event: ${event.eventType}`,
        message: `Processed aggregate ${event.aggregateType} (${event.aggregateId})`,
        isRead: false,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventId: event.id,
        createdAt: timestamp
      }
    ];
  }
};

const publisher = new RedisNotificationPublisher({ redisUrl });
const processor = new NotificationProcessor({
  creator: defaultCreator,
  publisher,
  onError: (err, raw) => {
    console.error("[skynav-notification-worker] Error in event processor:", err.message, raw);
  }
});

const worker = new NotificationWorker({
  redisUrl,
  processor,
  onError: (err, raw) => {
    console.error("[skynav-notification-worker] Error in worker subscription:", err.message, raw);
  }
});

async function start() {
  try {
    await worker.start();
    console.log("[skynav-notification-worker] Notification Worker is active and listening on domain event channels.");

    // Periodic heartbeat log (every 60s)
    const metricsTimer = setInterval(() => {
      console.log("[skynav-notification-worker] Metrics:", JSON.stringify({
        worker: worker.metrics,
        processor: processor.metrics
      }));
    }, 60_000);
    metricsTimer.unref();
  } catch (err) {
    console.error("[skynav-notification-worker] Fatal startup error:", err);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  console.log(`[skynav-notification-worker] Received ${signal}. Shutting down worker gracefully...`);
  try {
    await worker.stop();
    if (typeof publisher.close === "function") {
      await publisher.close();
    }
    console.log("[skynav-notification-worker] Notification Worker shutdown complete.");
    process.exit(0);
  } catch (err) {
    console.error("[skynav-notification-worker] Error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
