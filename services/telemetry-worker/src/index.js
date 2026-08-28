import { telemetrySchema } from "@skynav/contracts";
/** The worker validates and normalizes telemetry before selective downstream fanout. */
export const parseTelemetry = (input) => telemetrySchema.parse(input);
//# sourceMappingURL=index.js.map