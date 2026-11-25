/** Domain events `MissionsModule` emits on the shared bus — consumed by `DeliveryModule`'s `DeliveryMissionEventsListener` (and, per the phase-06 instructions, prepared groundwork for Phase 7's realtime layer). A plain type-only file with no NestJS module of its own, so importing it never creates a circular module dependency. */

export interface MissionLifecycleEvent {
  missionId: string;
  deliveryId: string;
}

export interface MissionAbortedEvent extends MissionLifecycleEvent {
  reason: string;
}
