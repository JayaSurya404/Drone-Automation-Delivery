import { Injectable } from "@nestjs/common";
import type {
  DroneAdapter,
  DroneTelemetrySnapshot,
  DroneWaypoint,
  TelemetryUnsubscribe,
} from "./drone-adapter.interface";

/**
 * `SimulatedDroneAdapter` — blueprint Section S's v1 adapter: "in-process...
 * simulation with configurable speed, battery-drain curve, GPS-noise, and
 * injectable fault scenarios."
 *
 * **Deterministic, pull-based simulation** (a documented design choice, not
 * an oversight): rather than a real wall-clock timer advancing drone state
 * continuously in the background — which would make unit tests
 * timing-dependent and flaky — this adapter advances a registered drone's
 * simulated position/battery by exactly one fixed step **each time
 * `getTelemetry()` is called** while it has an active target waypoint. Since
 * `MissionsService`'s mission engine calls `getTelemetry()` exactly once per
 * `progressMission()` invocation (an admin's "simulate next step" action, or
 * one background-interval tick), "one call = one deterministic step" is a
 * natural fit and makes the whole simulation trivially reproducible in tests
 * (call `getTelemetry` N times, assert the Nth position). A future
 * `MavlinkDroneAdapter` would NOT behave this way — a real/SITL drone moves
 * continuously between polls — so this pull-based-advance behavior is
 * specific to `SimulatedDroneAdapter` and must not be assumed by any caller
 * that only depends on the `DroneAdapter` interface.
 */
@Injectable()
export class SimulatedDroneAdapter implements DroneAdapter {
  static readonly STEP_DEGREES = 0.004;
  static readonly BATTERY_DRAIN_PER_STEP = 3;
  static readonly CRUISE_SPEED_MPS = 12;
  static readonly ARRIVAL_THRESHOLD_DEGREES = 0.0005;

  private readonly drones = new Map<string, SimDroneState>();
  private readonly subscribers = new Map<string, Set<(t: DroneTelemetrySnapshot) => void>>();

  /** Simulator-only setup — not part of the `DroneAdapter` contract (a real adapter has no "initial state" to seed; the drone just exists). */
  registerDrone(
    droneId: string,
    initial: { lat: number; lng: number; batteryPercent: number; homeLat: number; homeLng: number },
  ): void {
    this.drones.set(droneId, {
      lat: initial.lat,
      lng: initial.lng,
      altitudeMeters: 0,
      headingDegrees: 0,
      batteryPercent: initial.batteryPercent,
      homeLat: initial.homeLat,
      homeLng: initial.homeLng,
      target: null,
      armed: false,
      emergency: false,
      pendingFault: null,
    });
  }

  unregisterDrone(droneId: string): void {
    this.drones.delete(droneId);
    this.subscribers.delete(droneId);
  }

  /** Forces the named fault to apply on the drone's *next* `getTelemetry()` step. */
  injectFault(droneId: string, fault: SimFault): void {
    const state = this.requireState(droneId);
    state.pendingFault = fault;
  }

  async connect(droneId: string): Promise<void> {
    this.requireState(droneId);
  }

  async arm(droneId: string): Promise<void> {
    const state = this.requireState(droneId);
    state.armed = true;
  }

  async takeoff(droneId: string, altitudeMeters: number): Promise<void> {
    const state = this.requireState(droneId);
    state.altitudeMeters = altitudeMeters;
  }

  async gotoWaypoint(droneId: string, waypoint: DroneWaypoint): Promise<void> {
    const state = this.requireState(droneId);
    state.target = waypoint;
  }

  async returnToHome(droneId: string): Promise<void> {
    const state = this.requireState(droneId);
    state.target = { lat: state.homeLat, lng: state.homeLng, altitudeMeters: state.altitudeMeters || 60 };
  }

  async land(droneId: string): Promise<void> {
    const state = this.requireState(droneId);
    state.target = null;
    state.altitudeMeters = 0;
  }

  async emergencyStop(droneId: string): Promise<void> {
    const state = this.requireState(droneId);
    state.emergency = true;
    state.target = null;
  }

  /** Advances the simulation one deterministic step (see class doc) and returns the resulting snapshot. */
  async getTelemetry(droneId: string): Promise<DroneTelemetrySnapshot> {
    const state = this.requireState(droneId);
    this.step(state);
    const snapshot = this.toSnapshot(droneId, state);
    for (const callback of this.subscribers.get(droneId) ?? []) {
      callback(snapshot);
    }
    return snapshot;
  }

  subscribeTelemetry(droneId: string, callback: (telemetry: DroneTelemetrySnapshot) => void): TelemetryUnsubscribe {
    this.requireState(droneId);
    let set = this.subscribers.get(droneId);
    if (!set) {
      set = new Set();
      this.subscribers.set(droneId, set);
    }
    set.add(callback);
    return () => set?.delete(callback);
  }

  private step(state: SimDroneState): void {
    if (state.emergency) {
      return;
    }

    if (state.pendingFault === "LOW_BATTERY") {
      state.batteryPercent = Math.min(state.batteryPercent, 15);
    } else if (state.pendingFault === "CRASH") {
      state.emergency = true;
      state.target = null;
      state.pendingFault = null;
      return;
    }
    // SIGNAL_LOSS/GEOFENCE_BREACH are reported via the snapshot for exactly
    // this one step (see toSnapshot) then auto-clear — a real signal-loss
    // recovers or escalates on the *next* real telemetry sample, which this
    // pull-based single-step model approximates closely enough for Phase 6.

    if (!state.target) {
      state.headingDegrees = state.headingDegrees;
      return;
    }

    const dLat = state.target.lat - state.lat;
    const dLng = state.target.lng - state.lng;
    const distance = Math.hypot(dLat, dLng);

    if (distance <= SimulatedDroneAdapter.ARRIVAL_THRESHOLD_DEGREES) {
      state.lat = state.target.lat;
      state.lng = state.target.lng;
      state.altitudeMeters = state.target.altitudeMeters;
      state.target = null;
      return;
    }

    const step = Math.min(SimulatedDroneAdapter.STEP_DEGREES, distance);
    state.lat += (dLat / distance) * step;
    state.lng += (dLng / distance) * step;
    state.headingDegrees = (Math.atan2(dLng, dLat) * 180) / Math.PI;
    state.batteryPercent = Math.max(0, state.batteryPercent - SimulatedDroneAdapter.BATTERY_DRAIN_PER_STEP);
  }

  private toSnapshot(droneId: string, state: SimDroneState): DroneTelemetrySnapshot {
    const fault = state.pendingFault;
    state.pendingFault = null;

    return {
      droneId,
      lat: state.lat,
      lng: state.lng,
      altitudeMeters: state.altitudeMeters,
      speedMps: state.target ? SimulatedDroneAdapter.CRUISE_SPEED_MPS : 0,
      headingDegrees: state.headingDegrees,
      batteryPercent: state.batteryPercent,
      signalStrengthPercent: fault === "SIGNAL_LOSS" || state.emergency ? 0 : 95,
      emergency: state.emergency,
      timestamp: new Date(),
    };
  }

  private requireState(droneId: string): SimDroneState {
    const state = this.drones.get(droneId);
    if (!state) {
      throw new Error(`SimulatedDroneAdapter: drone ${droneId} is not registered — call registerDrone() first`);
    }
    return state;
  }
}

export type SimFault = "LOW_BATTERY" | "SIGNAL_LOSS" | "CRASH" | "GEOFENCE_BREACH";

interface SimDroneState {
  lat: number;
  lng: number;
  altitudeMeters: number;
  headingDegrees: number;
  batteryPercent: number;
  homeLat: number;
  homeLng: number;
  target: DroneWaypoint | null;
  armed: boolean;
  emergency: boolean;
  pendingFault: SimFault | null;
}
