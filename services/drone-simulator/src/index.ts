import { startControlServer } from "./control-server";
import { createInitialState, tick } from "./simulation";
import { pushTelemetry } from "./telemetry-client";

/**
 * Standalone simulated-fleet process (blueprint Section S / `PROJECT_CONTEXT.md`
 * #2). Runs independently of `apps/api` — it patrols a configured list of
 * already-registered drone ids around a fixed home coordinate and pushes
 * telemetry to the API's service-authenticated internal ingest endpoint on
 * an interval, demonstrating the telemetry pipeline and fault-injection
 * scenarios end-to-end. It does NOT drive real Mission progress — that's
 * `apps/api`'s in-process `SimulatedDroneAdapter`, used by the mission
 * engine (`MissionsService`) for actual delivery flights. Don't point this
 * process at a drone that's currently assigned to a real mission — both
 * write to the same Drone row via the same ingest path and would fight over
 * its live position. See docs/SETUP.md "Running the drone simulator".
 */

const API_BASE_URL = process.env.SIMULATOR_API_BASE_URL ?? "http://localhost:4000";
const API_KEY = process.env.SIMULATOR_TELEMETRY_INGEST_API_KEY ?? "local-dev-only-telemetry-key-change-me";
const DRONE_IDS = (process.env.SIMULATOR_DRONE_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter((id) => id.length > 0);
const TICK_MS = Number(process.env.SIMULATOR_TICK_MS ?? 3000);
const CONTROL_PORT = Number(process.env.SIMULATOR_CONTROL_PORT ?? 4100);
// SkyNav's seeded "Downtown Hub" coordinate (see apps/api/prisma/seed.ts) — override via env if simulating against a different hub.
const HOME_LAT = Number(process.env.SIMULATOR_HOME_LAT ?? 44.9778);
const HOME_LNG = Number(process.env.SIMULATOR_HOME_LNG ?? -93.265);

if (DRONE_IDS.length === 0) {
  console.warn(
    "[drone-simulator] SIMULATOR_DRONE_IDS is empty — nothing to simulate. Register a drone (admin console, or `pnpm db:seed`'s demo fleet) and set SIMULATOR_DRONE_IDS to its id(s) in .env. See docs/SETUP.md.",
  );
}

const states = new Map(DRONE_IDS.map((id) => [id, createInitialState(id, HOME_LAT, HOME_LNG)]));

startControlServer(CONTROL_PORT, states);

const interval = setInterval(() => {
  for (const [droneId, state] of states) {
    const next = tick(state);
    states.set(droneId, next);
    void pushTelemetry(API_BASE_URL, API_KEY, {
      droneId,
      lat: next.lat,
      lng: next.lng,
      altitudeMeters: next.altitudeMeters,
      speedMps: next.speedMps,
      headingDegrees: next.headingDegrees,
      batteryPercent: next.batteryPercent,
      signalStrengthPercent: next.signalStrengthPercent,
    });
  }
}, TICK_MS);

console.log(`[drone-simulator] simulating ${DRONE_IDS.length} drone(s), ticking every ${TICK_MS}ms, pushing telemetry to ${API_BASE_URL}`);

function shutdown(): void {
  clearInterval(interval);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
