import { z } from "zod";
export declare const organizationIdSchema: z.ZodString;
export declare const missionStatusSchema: z.ZodEnum<["PLANNED", "VALIDATING", "READY", "AUTHORIZED", "DISPATCHED", "IN_PROGRESS", "DELIVERED", "RETURNING", "COMPLETED", "ABORTED"]>;
export declare const orderStatusSchema: z.ZodEnum<["DRAFT", "SUBMITTED", "ASSIGNED", "IN_TRANSIT", "DELIVERED", "CANCELLED"]>;
export declare const droneStatusSchema: z.ZodEnum<["AVAILABLE", "ASSIGNED", "IN_FLIGHT", "MAINTENANCE", "OFFLINE"]>;
export declare const coordinateSchema: z.ZodObject<{
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    altitudeMeters: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    latitude: number;
    longitude: number;
    altitudeMeters?: number | undefined;
}, {
    latitude: number;
    longitude: number;
    altitudeMeters?: number | undefined;
}>;
export declare const telemetrySchema: z.ZodObject<{
    version: z.ZodLiteral<"v1">;
    organizationId: z.ZodString;
    droneId: z.ZodString;
    observedAt: z.ZodString;
    position: z.ZodObject<{
        latitude: z.ZodNumber;
        longitude: z.ZodNumber;
        altitudeMeters: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        latitude: number;
        longitude: number;
        altitudeMeters?: number | undefined;
    }, {
        latitude: number;
        longitude: number;
        altitudeMeters?: number | undefined;
    }>;
    speedMetersPerSecond: z.ZodNumber;
    headingDegrees: z.ZodNumber;
    batteryPercent: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    version: "v1";
    organizationId: string;
    droneId: string;
    observedAt: string;
    position: {
        latitude: number;
        longitude: number;
        altitudeMeters?: number | undefined;
    };
    speedMetersPerSecond: number;
    headingDegrees: number;
    batteryPercent: number;
}, {
    version: "v1";
    organizationId: string;
    droneId: string;
    observedAt: string;
    position: {
        latitude: number;
        longitude: number;
        altitudeMeters?: number | undefined;
    };
    speedMetersPerSecond: number;
    headingDegrees: number;
    batteryPercent: number;
}>;
export declare const eventEnvelopeSchema: z.ZodObject<{
    version: z.ZodLiteral<"v1">;
    id: z.ZodString;
    occurredAt: z.ZodString;
    organizationId: z.ZodString;
    correlationId: z.ZodString;
    type: z.ZodString;
    payload: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    type: string;
    version: "v1";
    organizationId: string;
    id: string;
    occurredAt: string;
    correlationId: string;
    payload?: unknown;
}, {
    type: string;
    version: "v1";
    organizationId: string;
    id: string;
    occurredAt: string;
    correlationId: string;
    payload?: unknown;
}>;
export type MissionStatus = z.infer<typeof missionStatusSchema>;
export type Telemetry = z.infer<typeof telemetrySchema>;
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
//# sourceMappingURL=index.d.ts.map