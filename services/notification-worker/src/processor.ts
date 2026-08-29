import {
  domainEventEnvelopeSchema,
  type DomainEventEnvelope,
  type NotificationResponse
} from "@skynav/contracts";
import type { NotificationPublisher } from "./publisher.js";

export interface NotificationCreator {
  createFromDomainEvent(event: DomainEventEnvelope): Promise<NotificationResponse[]>;
}

export interface NotificationProcessorMetrics {
  eventsReceived: number;
  eventsProcessed: number;
  eventsInvalid: number;
  notificationsCreated: number;
  lastProcessedAt: string | null;
}

export interface NotificationProcessorOptions {
  creator: NotificationCreator;
  publisher?: NotificationPublisher;
  onError?: (error: Error, rawEvent?: unknown) => void;
}

export class NotificationProcessor {
  private readonly creator: NotificationCreator;
  private readonly publisher?: NotificationPublisher;
  private readonly onError?: (error: Error, rawEvent?: unknown) => void;

  public readonly metrics: NotificationProcessorMetrics = {
    eventsReceived: 0,
    eventsProcessed: 0,
    eventsInvalid: 0,
    notificationsCreated: 0,
    lastProcessedAt: null
  };

  constructor(options: NotificationProcessorOptions) {
    this.creator = options.creator;
    this.publisher = options.publisher;
    this.onError = options.onError;
  }

  /**
   * Processes a raw domain event, validates envelope, creates notifications,
   * and publishes them for realtime WebSocket delivery.
   */
  async processEvent(rawEvent: unknown): Promise<NotificationResponse[]> {
    this.metrics.eventsReceived++;
    this.metrics.lastProcessedAt = new Date().toISOString();

    try {
      const event = typeof rawEvent === "string" ? JSON.parse(rawEvent) : rawEvent;
      const validated = domainEventEnvelopeSchema.parse(event);

      const notifications = await this.creator.createFromDomainEvent(validated);
      this.metrics.eventsProcessed++;
      this.metrics.notificationsCreated += notifications.length;

      if (this.publisher) {
        for (const notif of notifications) {
          await this.publisher.publish(notif).catch((err) => {
            if (this.onError) this.onError(err, notif);
          });
        }
      }

      return notifications;
    } catch (err) {
      this.metrics.eventsInvalid++;
      if (this.onError) {
        this.onError(err as Error, rawEvent);
      }
      return [];
    }
  }
}
