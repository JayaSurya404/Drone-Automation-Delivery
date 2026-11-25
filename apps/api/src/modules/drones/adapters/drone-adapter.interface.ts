/**
 * The Drone Adapter interface — blueprint Section S: "the core abstraction —
 * everything else in the platform talks to this, never to a protocol
 * directly." Implemented exactly as specified so a future `MavlinkDroneAdapter`
 * (PX4/ArduPilot SITL, then real hardware) can be swapped in via the
 * `DRONE_ADAPTER` config switch with zero changes to callers. `MissionsService`
 * (the mission engine) is the only consumer — it depends on this interface,
 * never on `SimulatedDroneAdapter` directly.
 */

export interface DroneWaypoint {
  lat: number;
  lng: number;
  altitudeMeters: number;
}

export interface DroneTelemetrySnapshot {
  droneId: string;
  lat: number;
  lng: number;
  altitudeMeters: number;
  speedMps: number;
  headingDegrees: number;
  batteryPercent: number;
  signalStrengthPercent: number;
  /** True once the drone has entered an unrecoverable emergency state (e.g. a simulated crash) — distinct from a merely low/zero signal reading. */
  emergency: boolean;
  timestamp: Date;
}

export type TelemetryUnsubscribe = () => void;

export interface DroneAdapter {
  connect(droneId: string): Promise<void>;
  arm(droneId: string): Promise<void>;
  takeoff(droneId: string, altitudeMeters: number): Promise<void>;
  gotoWaypoint(droneId: string, waypoint: DroneWaypoint): Promise<void>;
  returnToHome(droneId: string): Promise<void>;
  land(droneId: string): Promise<void>;
  emergencyStop(droneId: string): Promise<void>;
  getTelemetry(droneId: string): Promise<DroneTelemetrySnapshot>;
  subscribeTelemetry(droneId: string, callback: (telemetry: DroneTelemetrySnapshot) => void): TelemetryUnsubscribe;
}

/** DI token — `drones.module.ts` binds this to `SimulatedDroneAdapter` or `MavlinkDroneAdapter` based on `DRONE_ADAPTER`. */
export const DRONE_ADAPTER = Symbol("DRONE_ADAPTER");
