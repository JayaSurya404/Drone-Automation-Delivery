import { z } from "zod";
export const organizationIdSchema = z.string().uuid();
export const missionStatusSchema = z.enum(["PLANNED", "VALIDATING", "READY", "AUTHORIZED", "DISPATCHED", "IN_PROGRESS", "DELIVERED", "RETURNING", "COMPLETED", "ABORTED"]);
export const orderStatusSchema = z.enum(["DRAFT", "SUBMITTED", "ASSIGNED", "IN_TRANSIT", "DELIVERED", "CANCELLED"]);
export const droneStatusSchema = z.enum(["AVAILABLE", "ASSIGNED", "IN_FLIGHT", "MAINTENANCE", "OFFLINE"]);
export const coordinateSchema = z.object({ latitude: z.number().gte(-90).lte(90), longitude: z.number().gte(-180).lte(180), altitudeMeters: z.number().nonnegative().optional() });
export const telemetrySchema = z.object({ version: z.literal("v1"), organizationId: organizationIdSchema, droneId: z.string().uuid(), observedAt: z.string().datetime(), position: coordinateSchema, speedMetersPerSecond: z.number().nonnegative(), headingDegrees: z.number().gte(0).lt(360), batteryPercent: z.number().gte(0).lte(100) });
export const eventEnvelopeSchema = z.object({ version: z.literal("v1"), id: z.string().uuid(), occurredAt: z.string().datetime(), organizationId: organizationIdSchema, correlationId: z.string().uuid(), type: z.string().min(1), payload: z.unknown() });
//# sourceMappingURL=index.js.map