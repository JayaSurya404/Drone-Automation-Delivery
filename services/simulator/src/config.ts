import type { GeoCoordinate } from "./types.js";

export interface SimulatorConfig {
  /** Default ground speed in meters/second while cruising between waypoints. Default: 15.0 m/s (~54 km/h). */
  defaultCruiseSpeedMetersPerSecond: number;

  /** Standard flight corridor cruise altitude above ground in meters. Default: 60.0 m. */
  defaultCruiseAltitudeMeters: number;

  /** Altitude reached during package release / delivery hover in meters. Default: 2.0 m. */
  defaultDeliveryAltitudeMeters: number;

  /** Vertical ascent rate in meters/second. Default: 3.0 m/s. */
  climbRateMetersPerSecond: number;

  /** Vertical descent rate in meters/second. Default: 2.0 m/s. */
  descentRateMetersPerSecond: number;

  /** Horizontal arrival threshold distance to a waypoint in meters. Default: 5.0 m. */
  arrivalToleranceMeters: number;

  /** Standard duration the drone holds at destination for package handoff/verification in seconds. Default: 5.0 s. */
  defaultDeliveryHoldDurationSeconds: number;

  /** Battery discharge rate while stationary / idle (% per second). Default: 0.005 (0.3% per minute). */
  batteryDischargeRateIdle: number;

  /** Battery discharge rate during horizontal cruise flight (% per second). Default: 0.05 (3% per minute ≈ 33 min endurance). */
  batteryDischargeRateCruise: number;

  /** Battery discharge rate during vertical climb (% per second). Default: 0.08 (4.8% per minute). */
  batteryDischargeRateClimb: number;

  /** Battery discharge rate during descent (% per second). Default: 0.03 (1.8% per minute). */
  batteryDischargeRateDescent: number;

  /** Battery percentage that triggers an advisory low battery event. Default: 25.0%. */
  batteryLowThreshold: number;

  /** Battery percentage that triggers mandatory automatic Return-To-Home. Default: 15.0%. */
  batteryCriticalThreshold: number;

  /** Default home warehouse location if none specified on mission. */
  defaultHomeLocation: GeoCoordinate;

  /** Simulation loop tick rate in Hertz (ticks per second) when running realtime loop. Default: 2 Hz. */
  tickRateHz: number;

  /** Simulation clock time accelerator factor (1.0 = real-time, 10.0 = 10x speed). Default: 1.0. */
  speedMultiplier: number;
}

export const DEFAULT_SIMULATOR_CONFIG: SimulatorConfig = {
  defaultCruiseSpeedMetersPerSecond: 15.0,
  defaultCruiseAltitudeMeters: 60.0,
  defaultDeliveryAltitudeMeters: 2.0,
  climbRateMetersPerSecond: 3.0,
  descentRateMetersPerSecond: 2.0,
  arrivalToleranceMeters: 5.0,
  defaultDeliveryHoldDurationSeconds: 5.0,
  batteryDischargeRateIdle: 0.005,
  batteryDischargeRateCruise: 0.05,
  batteryDischargeRateClimb: 0.08,
  batteryDischargeRateDescent: 0.03,
  batteryLowThreshold: 25.0,
  batteryCriticalThreshold: 15.0,
  defaultHomeLocation: {
    latitude: 37.7749,
    longitude: -122.4194,
    altitudeMeters: 0
  },
  tickRateHz: 2,
  speedMultiplier: 1.0
};
