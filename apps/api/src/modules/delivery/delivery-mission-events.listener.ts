import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import type { MissionAbortedEvent, MissionLifecycleEvent } from "../missions/mission-events";
import { DeliveryService } from "./delivery.service";

/**
 * The Phase 6 counterpart to `DeliveryEventsListener` — same cross-module
 * event-bus convention (`PROJECT_CONTEXT.md` #1), now driving Delivery
 * status from Mission lifecycle events instead of Order ones.
 * `MissionsModule` never calls `DeliveryService` directly for status
 * transitions; it only emits, and this listener reacts. Importing
 * `mission-events.ts` (a plain type file, no NestJS module) does not create a
 * circular dependency between `DeliveryModule` and `MissionsModule` —
 * `MissionsModule` imports `DeliveryModule` for the snapshot read
 * (`getDeliverySnapshotForMission`), never the other way around.
 */
@Injectable()
export class DeliveryMissionEventsListener {
  constructor(private readonly deliveryService: DeliveryService) {}

  @OnEvent("mission.created")
  async onMissionCreated(payload: MissionLifecycleEvent): Promise<void> {
    await this.deliveryService.markMissionPlanned(payload.deliveryId);
  }

  @OnEvent("mission.started")
  async onMissionStarted(payload: MissionLifecycleEvent): Promise<void> {
    await this.deliveryService.markDroneDispatched(payload.deliveryId);
  }

  @OnEvent("mission.progressed")
  async onMissionProgressed(payload: MissionLifecycleEvent): Promise<void> {
    await this.deliveryService.markInTransit(payload.deliveryId);
  }

  @OnEvent("mission.completed")
  async onMissionCompleted(payload: MissionLifecycleEvent): Promise<void> {
    await this.deliveryService.markDeliveredPendingVerification(payload.deliveryId);
  }

  @OnEvent("mission.aborted")
  async onMissionAborted(payload: MissionAbortedEvent): Promise<void> {
    await this.deliveryService.markReturnedToHubFromMission(payload.deliveryId, payload.reason);
  }
}
