import type { OutboxRepository, OutboxEventRecord } from "./outbox.repository.js";
import type { EventPublisher } from "./event.publisher.js";
import type { DomainEventEnvelope } from "@skynav/contracts";

export interface OutboxServiceOptions {
  outboxRepo: OutboxRepository;
  eventPublisher: EventPublisher;
  maxRetries?: number;
  onError?: (error: Error, eventRecord?: OutboxEventRecord) => void;
}

export class OutboxService {
  private readonly outboxRepo: OutboxRepository;
  private readonly eventPublisher: EventPublisher;
  private readonly maxRetries: number;
  private readonly onError?: (error: Error, eventRecord?: OutboxEventRecord) => void;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(options: OutboxServiceOptions) {
    this.outboxRepo = options.outboxRepo;
    this.eventPublisher = options.eventPublisher;
    this.maxRetries = options.maxRetries ?? 5;
    this.onError = options.onError;
  }

  /**
   * Processes a batch of pending outbox events.
   * Returns the count of successfully published events.
   */
  async processBatch(limit = 50): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    let processedCount = 0;

    try {
      const pendingEvents = await this.outboxRepo.fetchUnprocessed(limit);

      for (const record of pendingEvents) {
        if (record.attempts >= this.maxRetries) {
          // Exceeded max retries, keep in outbox for operational dead-letter visibility
          continue;
        }

        try {
          const envelope: DomainEventEnvelope = {
            id: record.id,
            version: "v1",
            eventType: record.eventType,
            occurredAt: record.occurredAt,
            organizationId: record.organizationId,
            aggregateType: record.aggregateType as any,
            aggregateId: record.aggregateId,
            actorId: record.actorId,
            payload: record.payload
          };

          await this.eventPublisher.publish(envelope);
          await this.outboxRepo.markProcessed(record.id);
          processedCount++;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          await this.outboxRepo.markFailed(record.id, errorMessage);
          if (this.onError) {
            this.onError(err instanceof Error ? err : new Error(errorMessage), record);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }

  start(intervalMs = 1000): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.processBatch().catch((err) => {
        if (this.onError) this.onError(err);
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
