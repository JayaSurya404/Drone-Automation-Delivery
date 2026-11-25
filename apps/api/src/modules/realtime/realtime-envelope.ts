import type { RealtimeEventType } from "@skynav/shared-types";

/** Builds the versioned envelope every gateway emits — see `packages/shared-types/src/realtime.ts` for the shared shape both frontends parse against. */
export function buildEnvelope<T extends object>(type: RealtimeEventType, data: T): { v: 1; type: RealtimeEventType; ts: string; data: T } {
  return { v: 1, type, ts: new Date().toISOString(), data };
}
