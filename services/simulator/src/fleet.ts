import { SimulatedDrone } from "./drone.js";
import type {
  GeoCoordinate,
  MissionPlan,
  SimulatedTelemetry,
  DroneEvent,
  DroneSimState
} from "./types.js";
import { type SimulatorConfig, DEFAULT_SIMULATOR_CONFIG } from "./config.js";

export class FleetSimulator {
  private _drones: Map<string, SimulatedDrone> = new Map();
  private _config: SimulatorConfig;
  private _isPaused = false;
  private _realtimeIntervalId: NodeJS.Timeout | null = null;

  private _fleetTelemetryListeners: Array<(telemetry: SimulatedTelemetry) => void> = [];
  private _fleetEventListeners: Array<(event: DroneEvent) => void> = [];

  constructor(config: Partial<SimulatorConfig> = {}) {
    this._config = { ...DEFAULT_SIMULATOR_CONFIG, ...config };
  }

  public get config(): Readonly<SimulatorConfig> {
    return this._config;
  }

  public get isPaused(): boolean {
    return this._isPaused;
  }

  public get isRealtimeRunning(): boolean {
    return this._realtimeIntervalId !== null;
  }

  /**
   * Registers a new drone with the simulator.
   */
  public registerDrone(
    droneOrId: SimulatedDrone | string,
    organizationId = "00000000-0000-0000-0000-000000000001",
    initialLocation?: GeoCoordinate
  ): SimulatedDrone {
    if (typeof droneOrId === "string") {
      if (this._drones.has(droneOrId)) {
        return this._drones.get(droneOrId)!;
      }
      const drone = new SimulatedDrone(droneOrId, organizationId, initialLocation, this._config);
      this.attachDroneListeners(drone);
      this._drones.set(droneOrId, drone);
      return drone;
    } else {
      if (!this._drones.has(droneOrId.id)) {
        this.attachDroneListeners(droneOrId);
        this._drones.set(droneOrId.id, droneOrId);
      }
      return droneOrId;
    }
  }

  /**
   * Retrieves a simulated drone by identifier.
   */
  public getDrone(droneId: string): SimulatedDrone | undefined {
    return this._drones.get(droneId);
  }

  /**
   * Returns all active simulated drones.
   */
  public getAllDrones(): SimulatedDrone[] {
    return Array.from(this._drones.values());
  }

  /**
   * Removes a drone from the fleet.
   */
  public removeDrone(droneId: string): boolean {
    return this._drones.delete(droneId);
  }

  // ==========================================================================
  // Mission Operations
  // ==========================================================================

  /**
   * Assigns a mission to the specified drone.
   */
  public assignMission(mission: MissionPlan): void {
    const drone = this.registerDrone(mission.droneId, mission.organizationId, mission.origin);
    drone.assignMission(mission);
  }

  /**
   * Starts mission execution on a drone.
   */
  public startMission(droneId: string): void {
    const drone = this._drones.get(droneId);
    if (!drone) {
      throw new Error(`Cannot start mission: drone '${droneId}' is not registered.`);
    }
    drone.startMission();
  }

  /**
   * Commands Return-To-Home on a specific drone.
   */
  public returnToHome(droneId: string, reason?: string): void {
    const drone = this._drones.get(droneId);
    if (drone) {
      drone.returnToHome(reason);
    }
  }

  /**
   * Triggers emergency state on a specific drone.
   */
  public triggerEmergency(droneId: string, reason: string): void {
    const drone = this._drones.get(droneId);
    if (drone) {
      drone.triggerEmergency(reason);
    }
  }

  /**
   * Clears active emergency state on a specific drone.
   */
  public clearEmergency(droneId: string): void {
    const drone = this._drones.get(droneId);
    if (drone) {
      drone.clearEmergency();
    }
  }

  // ==========================================================================
  // Simulation Clock Progression
  // ==========================================================================

  /**
   * Advances all simulated drones in lockstep by `deltaSeconds`.
   */
  public tick(deltaSeconds: number): void {
    if (this._isPaused || deltaSeconds <= 0) return;

    for (const drone of this._drones.values()) {
      drone.tick(deltaSeconds);
    }
  }

  /**
   * Pauses simulation progression.
   */
  public pause(): void {
    this._isPaused = true;
  }

  /**
   * Resumes simulation progression.
   */
  public resume(): void {
    this._isPaused = false;
  }

  /**
   * Resets all drones to their base state.
   */
  public reset(): void {
    this.stopRealtimeLoop();
    this._isPaused = false;
    for (const drone of this._drones.values()) {
      drone.reset();
    }
  }

  // ==========================================================================
  // Optional Real-time Simulation Loop
  // ==========================================================================

  /**
   * Starts a real-time interval timer for local execution or live interactive demonstrations.
   */
  public startRealtimeLoop(tickRateHz: number = this._config.tickRateHz): void {
    if (this._realtimeIntervalId) {
      return; // Already running
    }

    const intervalMs = Math.max(10, Math.floor(1000 / tickRateHz));
    const deltaSeconds = 1 / tickRateHz;

    this._realtimeIntervalId = setInterval(() => {
      this.tick(deltaSeconds);
    }, intervalMs);
  }

  /**
   * Stops the real-time timer loop.
   */
  public stopRealtimeLoop(): void {
    if (this._realtimeIntervalId) {
      clearInterval(this._realtimeIntervalId);
      this._realtimeIntervalId = null;
    }
  }

  // ==========================================================================
  // Event & Telemetry Propagation
  // ==========================================================================

  private attachDroneListeners(drone: SimulatedDrone): void {
    drone.onTelemetry((telemetry) => {
      for (const listener of this._fleetTelemetryListeners) {
        try {
          listener(telemetry);
        } catch (err) {
          console.error("[fleet:telemetry:error]", err);
        }
      }
    });

    drone.onEvent((event) => {
      for (const listener of this._fleetEventListeners) {
        try {
          listener(event);
        } catch (err) {
          console.error("[fleet:event:error]", err);
        }
      }
    });
  }

  public onTelemetry(callback: (telemetry: SimulatedTelemetry) => void): () => void {
    this._fleetTelemetryListeners.push(callback);
    return () => {
      this._fleetTelemetryListeners = this._fleetTelemetryListeners.filter((cb) => cb !== callback);
    };
  }

  public onEvent(callback: (event: DroneEvent) => void): () => void {
    this._fleetEventListeners.push(callback);
    return () => {
      this._fleetEventListeners = this._fleetEventListeners.filter((cb) => cb !== callback);
    };
  }
}
