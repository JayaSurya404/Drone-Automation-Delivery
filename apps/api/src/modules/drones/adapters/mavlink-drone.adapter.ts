import { Injectable, NotImplementedException } from "@nestjs/common";
import type { DroneAdapter, DroneTelemetrySnapshot, DroneWaypoint, TelemetryUnsubscribe } from "./drone-adapter.interface";

/**
 * `MavlinkDroneAdapter` — the future adapter blueprint Section S describes
 * ("built against MAVSDK/pymavlink talking to PX4/ArduPilot SITL first, then
 * real drones"). Per the phase-06 prompt's explicit instruction, the
 * `DRONE_ADAPTER=mavlink` config switch must exist now even though the
 * implementation doesn't — every method here deliberately throws instead of
 * silently no-op'ing, so selecting it fails loudly and immediately rather
 * than pretending to fly a drone that was never connected. Parameters are
 * kept, unused, matching the `DroneAdapter` signature exactly so call sites
 * typecheck identically to `SimulatedDroneAdapter`.
 */
@Injectable()
export class MavlinkDroneAdapter implements DroneAdapter {
  async connect(_droneId: string): Promise<void> {
    throw this.notImplemented();
  }
  async arm(_droneId: string): Promise<void> {
    throw this.notImplemented();
  }
  async takeoff(_droneId: string, _altitudeMeters: number): Promise<void> {
    throw this.notImplemented();
  }
  async gotoWaypoint(_droneId: string, _waypoint: DroneWaypoint): Promise<void> {
    throw this.notImplemented();
  }
  async returnToHome(_droneId: string): Promise<void> {
    throw this.notImplemented();
  }
  async land(_droneId: string): Promise<void> {
    throw this.notImplemented();
  }
  async emergencyStop(_droneId: string): Promise<void> {
    throw this.notImplemented();
  }
  async getTelemetry(_droneId: string): Promise<DroneTelemetrySnapshot> {
    throw this.notImplemented();
  }
  subscribeTelemetry(_droneId: string, _callback: (telemetry: DroneTelemetrySnapshot) => void): TelemetryUnsubscribe {
    throw this.notImplemented();
  }

  private notImplemented(): NotImplementedException {
    return new NotImplementedException(
      "MavlinkDroneAdapter is not implemented yet — DRONE_ADAPTER=mavlink is a reserved config value for a future phase (PX4/ArduPilot SITL, then real hardware). Use DRONE_ADAPTER=simulated.",
    );
  }
}
