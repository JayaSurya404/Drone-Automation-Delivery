import { telemetrySchema, type Telemetry } from "@skynav/contracts";
export interface TelemetryPublisher { publish(telemetry: Telemetry): Promise<void>; }
export interface TelemetryStore { persist(telemetry: Telemetry): Promise<void>; }
/** The worker validates and normalizes telemetry before selective downstream fanout. */
export const parseTelemetry = (input: unknown): Telemetry => telemetrySchema.parse(input);
