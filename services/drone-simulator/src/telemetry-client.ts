/** Pushes one telemetry sample to `apps/api`'s internal, service-authenticated ingest endpoint — see `apps/api/src/modules/telemetry/guards/service-auth.guard.ts`. */
export interface TelemetryPayload {
  droneId: string;
  lat: number;
  lng: number;
  altitudeMeters?: number;
  speedMps?: number;
  headingDegrees?: number;
  batteryPercent: number;
  signalStrengthPercent?: number;
}

export async function pushTelemetry(baseUrl: string, apiKey: string, payload: TelemetryPayload): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/internal/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Service-Api-Key": apiKey },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error(`[drone-simulator] telemetry push failed for ${payload.droneId}: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`[drone-simulator] telemetry push errored for ${payload.droneId}:`, error instanceof Error ? error.message : error);
  }
}
