import { telemetrySchema, type Telemetry } from "@skynav/contracts";

export * from "./publisher.js";
export * from "./worker.js";

/** The worker validates and normalizes telemetry before selective downstream fanout. */
export const parseTelemetry = (input: unknown): Telemetry => telemetrySchema.parse(input);
