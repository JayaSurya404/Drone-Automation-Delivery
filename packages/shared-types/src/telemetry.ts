import { z } from "zod";

export const telemetrySampleSchema = z.object({
  id: z.string(),
  /** Nullable since Phase 12 — preserved history for a since-removed drone (`SetNull`, not cascade-deleted). */
  droneId: z.string().nullable(),
  missionId: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  altitudeMeters: z.number().nullable(),
  speedMps: z.number().nullable(),
  headingDegrees: z.number().nullable(),
  batteryPercent: z.number(),
  signalStrengthPercent: z.number().nullable(),
  recordedAt: z.string(),
});
export type TelemetrySample = z.infer<typeof telemetrySampleSchema>;
