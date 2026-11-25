/**
 * Pure, deterministic drone-flight simulation for the standalone
 * `drone-simulator` process. This is a second, independent implementation of
 * "a simulated drone flies and drains battery" — the mission engine inside
 * `apps/api` (`SimulatedDroneAdapter`) has its own, separate copy of similar
 * math. The duplication is deliberate, not an oversight: this process
 * demonstrates the telemetry-ingest pipeline and fault-injection scenarios
 * completely independently of any real `Mission` row (an "ambient" patrol
 * around the hub, not tied to a delivery), while `SimulatedDroneAdapter`
 * drives actual mission waypoint-by-waypoint progress transactionally inside
 * Postgres. Forcing them to share code would mean this out-of-process script
 * importing from `apps/api`'s source tree, which the monorepo's module
 * boundaries don't support without extra bundler config — see
 * `docs/ARCHITECTURE.md` "Drone & Fleet Management" for the full rationale.
 */

export type Fault = "LOW_BATTERY" | "SIGNAL_LOSS" | "CRASH";

export interface SimDroneState {
  droneId: string;
  lat: number;
  lng: number;
  altitudeMeters: number;
  headingDegrees: number;
  speedMps: number;
  batteryPercent: number;
  signalStrengthPercent: number;
  homeLat: number;
  homeLng: number;
  targetLat: number;
  targetLng: number;
  crashed: boolean;
  pendingFault: Fault | null;
}

const STEP_DEGREES = 0.003;
const BATTERY_DRAIN_PER_TICK = 1;
const PATROL_RADIUS_DEGREES = 0.01;
const CRUISE_SPEED_MPS = 11;

export function createInitialState(droneId: string, homeLat: number, homeLng: number): SimDroneState {
  return {
    droneId,
    lat: homeLat,
    lng: homeLng,
    altitudeMeters: 60,
    headingDegrees: 0,
    speedMps: CRUISE_SPEED_MPS,
    batteryPercent: 100,
    signalStrengthPercent: 95,
    homeLat,
    homeLng,
    targetLat: homeLat + PATROL_RADIUS_DEGREES,
    targetLng: homeLng,
    crashed: false,
    pendingFault: null,
  };
}

export function injectFault(state: SimDroneState, fault: Fault): SimDroneState {
  return { ...state, pendingFault: fault };
}

/** One deterministic simulation step: patrol back and forth around the home coordinate, draining and recharging battery, subject to whatever fault was injected since the last tick. */
export function tick(state: SimDroneState): SimDroneState {
  if (state.crashed) {
    return state;
  }
  if (state.pendingFault === "CRASH") {
    return { ...state, crashed: true, speedMps: 0, signalStrengthPercent: 0, pendingFault: null };
  }

  const next: SimDroneState = { ...state, pendingFault: null };

  if (state.pendingFault === "LOW_BATTERY") {
    next.batteryPercent = Math.min(next.batteryPercent, 15);
  }
  next.batteryPercent = next.batteryPercent <= 10 ? 100 : Math.max(0, next.batteryPercent - BATTERY_DRAIN_PER_TICK);

  const dLat = next.targetLat - next.lat;
  const dLng = next.targetLng - next.lng;
  const distance = Math.hypot(dLat, dLng);

  if (distance <= STEP_DEGREES) {
    next.lat = next.targetLat;
    next.lng = next.targetLng;
    const atOutboundLeg = Math.abs(next.targetLat - (state.homeLat + PATROL_RADIUS_DEGREES)) < 1e-9;
    next.targetLat = atOutboundLeg ? state.homeLat - PATROL_RADIUS_DEGREES : state.homeLat + PATROL_RADIUS_DEGREES;
  } else {
    next.lat += (dLat / distance) * STEP_DEGREES;
    next.lng += (dLng / distance) * STEP_DEGREES;
    next.headingDegrees = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  }

  next.speedMps = CRUISE_SPEED_MPS;
  next.signalStrengthPercent = state.pendingFault === "SIGNAL_LOSS" ? 0 : 95;

  return next;
}
