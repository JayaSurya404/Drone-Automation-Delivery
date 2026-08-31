/**
 * SkyNav Autonomous Drone Simulator Core
 *
 * SAFETY INVARIANT:
 * This is a deterministic software simulation engine designed for development, testing,
 * and operator training. It does NOT interface with real UAV flight controllers, PX4,
 * ArduPilot, or physical hardware actuators.
 */

export * from "./types.js";
export * from "./geo.js";
export * from "./config.js";
export * from "./state-machine.js";
export * from "./drone.js";
export * from "./fleet.js";
export * from "./perception.js";

// Backward-compatibility aliases
export type SimulationState = import("./types.js").DroneSimState;
export interface SimulatorAdapter {
  registerDrone(droneId: string): Promise<void>;
  startMission(missionId: string): Promise<void>;
}
export const simulatorService = "simulator";
