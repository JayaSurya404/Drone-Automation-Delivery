import type { Telemetry, Coordinate } from "@skynav/contracts";

/**
 * State machine stages for a simulated autonomous delivery UAV.
 */
export type DroneSimState =
  | "IDLE"          // Stationary at base/warehouse, ready for mission assignment
  | "ASSIGNED"      // Mission received and validated, armed for takeoff
  | "TAKEOFF"       // Ascending vertically to cruise altitude
  | "EN_ROUTE"      // Navigating waypoints toward the delivery destination
  | "ARRIVED"       // Reached target delivery location, hovering above drop point
  | "DELIVERING"    // Descending to delivery altitude, payload release/verification
  | "RETURNING"     // Navigating return waypoints back to warehouse base
  | "LANDED"        // Touchdown complete at base station
  | "EMERGENCY"     // Fail-safe triggered (critical battery, simulated fault)
  | "OFFLINE";      // Disconnected or disabled

/**
 * 3D geographic point with spherical latitude/longitude and altitude above ground.
 */
export interface GeoCoordinate {
  latitude: number;   // Degrees [-90, 90]
  longitude: number;  // Degrees [-180, 180]
  altitudeMeters: number; // Meters above ground [0, inf)
}

/**
 * Single navigation waypoint along a flight corridor.
 */
export interface Waypoint {
  id: string;
  sequence: number;
  position: GeoCoordinate;
  targetSpeedMetersPerSecond?: number;
  targetAltitudeMeters?: number;
  holdDurationSeconds?: number;
  isDeliveryPoint?: boolean;
}

/**
 * Complete mission route specification consumed by the simulator.
 */
export interface MissionPlan {
  missionId: string;
  organizationId: string;
  droneId: string;
  origin: GeoCoordinate;
  destination: GeoCoordinate;
  waypoints: Waypoint[];
  deliveryHoldDurationSeconds?: number;
  returnWaypoints?: Waypoint[];
}

/**
 * Current dynamic kinematic state of a simulated drone.
 */
export interface DroneKinematics {
  position: GeoCoordinate;
  speedMetersPerSecond: number;
  headingDegrees: number;       // [0, 360) where 0 = North, 90 = East, 180 = South, 270 = West
  verticalSpeedMetersPerSecond: number; // Positive = climb, negative = descent
}

/**
 * Real-time battery state of the simulated drone.
 */
export interface DroneBattery {
  percent: number;              // [0, 100]
  voltageVolts?: number;
  temperatureCelsius?: number;
}

/**
 * Comprehensive telemetry frame emitted by the simulator.
 */
export interface SimulatedTelemetry extends Telemetry {
  state: DroneSimState;
  missionId?: string;
  currentWaypointIndex: number;
  totalWaypoints: number;
  distanceToTargetMeters: number;
  totalDistanceFlownMeters: number;
  emergencyReason?: string;
  flightTimeSeconds: number;
}

/**
 * Discrete lifecycle events emitted during flight execution.
 */
export interface DroneEvent {
  type:
    | "STATE_CHANGED"
    | "WAYPOINT_REACHED"
    | "DESTINATION_ARRIVED"
    | "DELIVERY_STARTED"
    | "DELIVERY_COMPLETED"
    | "RTH_TRIGGERED"
    | "EMERGENCY_TRIGGERED"
    | "LOW_BATTERY_WARNING"
    | "CRITICAL_BATTERY_ALERT"
    | "LANDED";
  droneId: string;
  timestamp: string;
  fromState?: DroneSimState;
  toState?: DroneSimState;
  payload?: Record<string, unknown>;
}
