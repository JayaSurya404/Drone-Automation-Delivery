import crypto from "node:crypto";
import type {
  DroneSimState,
  GeoCoordinate,
  Waypoint,
  MissionPlan,
  DroneKinematics,
  DroneBattery,
  SimulatedTelemetry,
  DroneEvent
} from "./types.js";
import { type SimulatorConfig, DEFAULT_SIMULATOR_CONFIG } from "./config.js";
import {
  haversineDistanceMeters,
  initialBearingDegrees,
  projectPosition
} from "./geo.js";
import { assertValidStateTransition } from "./state-machine.js";

type DeliveryPhase = "DESCENDING" | "WAITING_VERIFICATION" | "ASCENDING" | "COMPLETED";

export class SimulatedDrone {
  public readonly id: string;
  public organizationId: string;

  private _state: DroneSimState = "IDLE";
  private _homeLocation: GeoCoordinate;
  private _kinematics: DroneKinematics;
  private _battery: DroneBattery;
  private _config: SimulatorConfig;

  private _currentMission: MissionPlan | null = null;
  private _activeWaypoints: Waypoint[] = [];
  private _currentWaypointIndex = 0;
  private _isReturning = false;

  private _deliveryPhase: DeliveryPhase = "DESCENDING";
  private _deliveryHoldTimerSeconds = 0;
  private _emergencyReason: string | null = null;
  private _lowBatteryWarned = false;
  private _criticalBatteryWarned = false;

  private _totalFlightTimeSeconds = 0;
  private _totalDistanceFlownMeters = 0;
  private _simulationTimestamp: number = Date.now();

  private _eventListeners: Array<(event: DroneEvent) => void> = [];
  private _telemetryListeners: Array<(telemetry: SimulatedTelemetry) => void> = [];

  constructor(
    id: string,
    organizationId: string = "00000000-0000-0000-0000-000000000001",
    initialLocation?: GeoCoordinate,
    config: Partial<SimulatorConfig> = {}
  ) {
    this.id = id;
    this.organizationId = organizationId;
    this._config = { ...DEFAULT_SIMULATOR_CONFIG, ...config };
    this._homeLocation = initialLocation ? { ...initialLocation } : { ...this._config.defaultHomeLocation };

    this._kinematics = {
      position: { ...this._homeLocation },
      speedMetersPerSecond: 0,
      headingDegrees: 0,
      verticalSpeedMetersPerSecond: 0
    };

    this._battery = {
      percent: 100.0,
      voltageVolts: 24.0,
      temperatureCelsius: 25.0
    };
  }

  // ==========================================================================
  // Public Accessors
  // ==========================================================================

  public get state(): DroneSimState {
    return this._state;
  }

  public get kinematics(): Readonly<DroneKinematics> {
    return this._kinematics;
  }

  public get battery(): Readonly<DroneBattery> {
    return this._battery;
  }

  public get currentMission(): Readonly<MissionPlan> | null {
    return this._currentMission;
  }

  public get homeLocation(): Readonly<GeoCoordinate> {
    return this._homeLocation;
  }

  public get totalFlightTimeSeconds(): number {
    return this._totalFlightTimeSeconds;
  }

  public get totalDistanceFlownMeters(): number {
    return this._totalDistanceFlownMeters;
  }

  public get emergencyReason(): string | null {
    return this._emergencyReason;
  }

  // ==========================================================================
  // Mission Control & Lifecycle
  // ==========================================================================

  /**
   * Assigns a validated mission plan to the drone.
   */
  public assignMission(mission: MissionPlan): void {
    assertValidStateTransition(this._state, "ASSIGNED");

    this._currentMission = mission;
    this.organizationId = mission.organizationId;
    this._homeLocation = { ...mission.origin };
    this._activeWaypoints = [...mission.waypoints];
    this._currentWaypointIndex = 0;
    this._isReturning = false;
    this._deliveryPhase = "DESCENDING";
    this._deliveryHoldTimerSeconds = 0;
    this._emergencyReason = null;

    // If starting fresh from origin
    if (this._state === "IDLE" || this._state === "LANDED") {
      this._kinematics.position = { ...mission.origin, altitudeMeters: 0 };
    }

    this.transitionState("ASSIGNED", { missionId: mission.missionId });
  }

  /**
   * Initiates mission takeoff.
   */
  public startMission(): void {
    if (!this._currentMission) {
      throw new Error(`Cannot start mission on drone ${this.id}: no mission assigned.`);
    }
    assertValidStateTransition(this._state, "TAKEOFF");
    this.transitionState("TAKEOFF", { missionId: this._currentMission.missionId });
  }

  /**
   * Commands the drone to abort or conclude current task and return to home base.
   */
  public returnToHome(reason = "MANUAL_RTH_COMMAND"): void {
    if (this._state === "IDLE" || this._state === "LANDED" || this._state === "OFFLINE") {
      return; // Already stationary on ground
    }

    this._isReturning = true;
    if (!this._emergencyReason) {
      this._emergencyReason = reason === "MANUAL_RTH_COMMAND" ? null : reason;
    }

    // Build return flight path back to home base
    const returnWaypoint: Waypoint = {
      id: `rth-home-${Date.now()}`,
      sequence: 1,
      position: { ...this._homeLocation, altitudeMeters: this._config.defaultCruiseAltitudeMeters },
      targetAltitudeMeters: this._config.defaultCruiseAltitudeMeters,
      targetSpeedMetersPerSecond: this._config.defaultCruiseSpeedMetersPerSecond
    };

    this._activeWaypoints = [returnWaypoint];
    this._currentWaypointIndex = 0;

    this.emitEvent({
      type: "RTH_TRIGGERED",
      droneId: this.id,
      timestamp: new Date(this._simulationTimestamp).toISOString(),
      payload: { reason }
    });

    this.transitionState("RETURNING", { reason });
  }

  /**
   * Triggers an emergency state and initiates immediate fail-safe Return-To-Home.
   */
  public triggerEmergency(reason: string): void {
    this._emergencyReason = reason;

    this.emitEvent({
      type: "EMERGENCY_TRIGGERED",
      droneId: this.id,
      timestamp: new Date(this._simulationTimestamp).toISOString(),
      payload: { reason }
    });

    if (this._state !== "IDLE" && this._state !== "LANDED" && this._state !== "OFFLINE") {
      this.returnToHome(reason);
    } else {
      this.transitionState("EMERGENCY", { reason });
    }
  }

  /**
   * Clears active emergency condition.
   */
  public clearEmergency(): void {
    if (this._state === "EMERGENCY" || this._emergencyReason !== null) {
      this._emergencyReason = null;
      if (this._kinematics.position.altitudeMeters > 0) {
        this.returnToHome("EMERGENCY_CLEARED_RETURNING");
      } else {
        this.transitionState("IDLE");
      }
    }
  }

  /**
   * Resets drone state, position, and battery to initial home state.
   */
  public reset(newHomeLocation?: GeoCoordinate): void {
    if (newHomeLocation) {
      this._homeLocation = { ...newHomeLocation };
    }
    this._state = "IDLE";
    this._kinematics = {
      position: { ...this._homeLocation, altitudeMeters: 0 },
      speedMetersPerSecond: 0,
      headingDegrees: 0,
      verticalSpeedMetersPerSecond: 0
    };
    this._battery = {
      percent: 100.0,
      voltageVolts: 24.0,
      temperatureCelsius: 25.0
    };
    this._currentMission = null;
    this._activeWaypoints = [];
    this._currentWaypointIndex = 0;
    this._isReturning = false;
    this._emergencyReason = null;
    this._lowBatteryWarned = false;
    this._criticalBatteryWarned = false;
    this._totalFlightTimeSeconds = 0;
    this._totalDistanceFlownMeters = 0;
  }

  // ==========================================================================
  // Deterministic Simulation Tick Engine
  // ==========================================================================

  /**
   * Advances the simulation deterministically by `deltaSeconds`.
   */
  public tick(deltaSeconds: number): void {
    if (deltaSeconds <= 0) return;

    const effectiveDelta = deltaSeconds * this._config.speedMultiplier;
    this._simulationTimestamp += effectiveDelta * 1000;

    switch (this._state) {
      case "IDLE":
      case "ASSIGNED":
      case "OFFLINE":
        this.tickStationary(effectiveDelta);
        break;

      case "TAKEOFF":
        this.tickTakeoff(effectiveDelta);
        break;

      case "EN_ROUTE":
      case "RETURNING":
        this.tickEnRoute(effectiveDelta);
        break;

      case "ARRIVED":
        this.tickArrived(effectiveDelta);
        break;

      case "DELIVERING":
        this.tickDelivering(effectiveDelta);
        break;

      case "LANDED":
        this.tickLanded(effectiveDelta);
        break;

      case "EMERGENCY":
        this.tickEmergency(effectiveDelta);
        break;
    }

    this.checkBatterySafety();
    this.broadcastTelemetry();
  }

  // ==========================================================================
  // Flight Phase Kinematic Handlers
  // ==========================================================================

  private tickStationary(dt: number): void {
    this._kinematics.speedMetersPerSecond = 0;
    this._kinematics.verticalSpeedMetersPerSecond = 0;
    this.drainBattery(this._config.batteryDischargeRateIdle * dt);
  }

  private tickTakeoff(dt: number): void {
    this._kinematics.speedMetersPerSecond = 0;
    this._kinematics.verticalSpeedMetersPerSecond = this._config.climbRateMetersPerSecond;

    const targetAltitude =
      this._activeWaypoints[0]?.targetAltitudeMeters ?? this._config.defaultCruiseAltitudeMeters;

    const altitudeGain = this._config.climbRateMetersPerSecond * dt;
    this._kinematics.position.altitudeMeters += altitudeGain;
    this._totalFlightTimeSeconds += dt;
    this.drainBattery(this._config.batteryDischargeRateClimb * dt);

    if (this._kinematics.position.altitudeMeters >= targetAltitude) {
      this._kinematics.position.altitudeMeters = targetAltitude;
      this._kinematics.verticalSpeedMetersPerSecond = 0;
      this.transitionState("EN_ROUTE");
    }
  }

  private tickEnRoute(dt: number): void {
    this._totalFlightTimeSeconds += dt;

    if (this._currentWaypointIndex >= this._activeWaypoints.length) {
      // Final waypoint of this leg reached
      if (this._isReturning) {
        this.startLandingDescent(dt);
      } else {
        this.transitionState("ARRIVED");
        this.emitEvent({
          type: "DESTINATION_ARRIVED",
          droneId: this.id,
          timestamp: new Date(this._simulationTimestamp).toISOString()
        });
      }
      return;
    }

    const targetWaypoint = this._activeWaypoints[this._currentWaypointIndex]!;
    const distanceToTarget = haversineDistanceMeters(this._kinematics.position, targetWaypoint.position);

    // Compute heading toward waypoint
    const targetHeading = initialBearingDegrees(this._kinematics.position, targetWaypoint.position);
    this._kinematics.headingDegrees = targetHeading;

    const targetSpeed = targetWaypoint.targetSpeedMetersPerSecond ?? this._config.defaultCruiseSpeedMetersPerSecond;
    this._kinematics.speedMetersPerSecond = targetSpeed;

    const distanceStep = targetSpeed * dt;

    if (distanceStep >= distanceToTarget || distanceToTarget <= this._config.arrivalToleranceMeters) {
      // Arrived at current waypoint
      this._kinematics.position.latitude = targetWaypoint.position.latitude;
      this._kinematics.position.longitude = targetWaypoint.position.longitude;
      this._totalDistanceFlownMeters += distanceToTarget;

      this.emitEvent({
        type: "WAYPOINT_REACHED",
        droneId: this.id,
        timestamp: new Date(this._simulationTimestamp).toISOString(),
        payload: {
          waypointIndex: this._currentWaypointIndex,
          waypointId: targetWaypoint.id
        }
      });

      this._currentWaypointIndex++;

      // If that was the final waypoint, transition immediately
      if (this._currentWaypointIndex >= this._activeWaypoints.length) {
        if (this._isReturning) {
          this.startLandingDescent(dt);
        } else {
          this.transitionState("ARRIVED");
          this.emitEvent({
            type: "DESTINATION_ARRIVED",
            droneId: this.id,
            timestamp: new Date(this._simulationTimestamp).toISOString()
          });
        }
      }
    } else {
      // Advance position along bearing
      const newPos = projectPosition(this._kinematics.position, targetHeading, distanceStep);
      this._kinematics.position.latitude = newPos.latitude;
      this._kinematics.position.longitude = newPos.longitude;
      this._totalDistanceFlownMeters += distanceStep;
    }

    this.drainBattery(this._config.batteryDischargeRateCruise * dt);
  }

  private tickArrived(dt: number): void {
    this._kinematics.speedMetersPerSecond = 0;
    this._kinematics.verticalSpeedMetersPerSecond = 0;
    this._totalFlightTimeSeconds += dt;
    this.drainBattery(this._config.batteryDischargeRateCruise * dt);

    // Transition immediately to DELIVERING sequence
    this._deliveryPhase = "DESCENDING";
    this._deliveryHoldTimerSeconds = 0;
    this.transitionState("DELIVERING");
    this.emitEvent({
      type: "DELIVERY_STARTED",
      droneId: this.id,
      timestamp: new Date(this._simulationTimestamp).toISOString()
    });
  }

  private tickDelivering(dt: number): void {
    this._totalFlightTimeSeconds += dt;

    switch (this._deliveryPhase) {
      case "DESCENDING": {
        this._kinematics.speedMetersPerSecond = 0;
        this._kinematics.verticalSpeedMetersPerSecond = -this._config.descentRateMetersPerSecond;

        const descentStep = this._config.descentRateMetersPerSecond * dt;
        this._kinematics.position.altitudeMeters -= descentStep;
        this.drainBattery(this._config.batteryDischargeRateDescent * dt);

        if (this._kinematics.position.altitudeMeters <= this._config.defaultDeliveryAltitudeMeters) {
          this._kinematics.position.altitudeMeters = this._config.defaultDeliveryAltitudeMeters;
          this._kinematics.verticalSpeedMetersPerSecond = 0;
          this._deliveryPhase = "WAITING_VERIFICATION";
          this._deliveryHoldTimerSeconds = 0;
        }
        break;
      }

      case "WAITING_VERIFICATION": {
        this._kinematics.speedMetersPerSecond = 0;
        this._kinematics.verticalSpeedMetersPerSecond = 0;
        this._deliveryHoldTimerSeconds += dt;
        this.drainBattery(this._config.batteryDischargeRateIdle * dt);

        const requiredHold =
          this._currentMission?.deliveryHoldDurationSeconds ?? this._config.defaultDeliveryHoldDurationSeconds;

        if (this._deliveryHoldTimerSeconds >= requiredHold) {
          this._deliveryPhase = "ASCENDING";
        }
        break;
      }

      case "ASCENDING": {
        this._kinematics.speedMetersPerSecond = 0;
        this._kinematics.verticalSpeedMetersPerSecond = this._config.climbRateMetersPerSecond;

        const climbStep = this._config.climbRateMetersPerSecond * dt;
        this._kinematics.position.altitudeMeters += climbStep;
        this.drainBattery(this._config.batteryDischargeRateClimb * dt);

        if (this._kinematics.position.altitudeMeters >= this._config.defaultCruiseAltitudeMeters) {
          this._kinematics.position.altitudeMeters = this._config.defaultCruiseAltitudeMeters;
          this._kinematics.verticalSpeedMetersPerSecond = 0;
          this._deliveryPhase = "COMPLETED";

          this.emitEvent({
            type: "DELIVERY_COMPLETED",
            droneId: this.id,
            timestamp: new Date(this._simulationTimestamp).toISOString()
          });

          // Setup return path to warehouse
          this.returnToHome("DELIVERY_COMPLETED_RETURN");
        }
        break;
      }

      case "COMPLETED":
        break;
    }
  }

  private startLandingDescent(dt: number): void {
    this._kinematics.speedMetersPerSecond = 0;
    this._kinematics.verticalSpeedMetersPerSecond = -this._config.descentRateMetersPerSecond;

    const descentStep = this._config.descentRateMetersPerSecond * dt;
    this._kinematics.position.altitudeMeters -= descentStep;
    this.drainBattery(this._config.batteryDischargeRateDescent * dt);

    if (this._kinematics.position.altitudeMeters <= 0) {
      this._kinematics.position.altitudeMeters = 0;
      this._kinematics.verticalSpeedMetersPerSecond = 0;
      this.transitionState("LANDED");

      this.emitEvent({
        type: "LANDED",
        droneId: this.id,
        timestamp: new Date(this._simulationTimestamp).toISOString()
      });
    }
  }

  private tickLanded(dt: number): void {
    this._kinematics.speedMetersPerSecond = 0;
    this._kinematics.verticalSpeedMetersPerSecond = 0;
    this.drainBattery(this._config.batteryDischargeRateIdle * dt);
  }

  private tickEmergency(dt: number): void {
    if (this._kinematics.position.altitudeMeters > 0) {
      this.startLandingDescent(dt);
    } else {
      this.tickStationary(dt);
    }
  }

  // ==========================================================================
  // Battery & Telemetry
  // ==========================================================================

  private drainBattery(percent: number): void {
    this._battery.percent = Math.max(0, Math.min(100, this._battery.percent - percent));
    this._battery.voltageVolts = 20.0 + (this._battery.percent / 100) * 5.2; // 20V to 25.2V curve
  }

  private checkBatterySafety(): void {
    if (this._battery.percent <= this._config.batteryCriticalThreshold && !this._criticalBatteryWarned) {
      this._criticalBatteryWarned = true;
      this.emitEvent({
        type: "CRITICAL_BATTERY_ALERT",
        droneId: this.id,
        timestamp: new Date(this._simulationTimestamp).toISOString(),
        payload: { batteryPercent: this._battery.percent }
      });

      if (this._state !== "RETURNING" && this._state !== "LANDED" && this._state !== "IDLE") {
        this.returnToHome("CRITICAL_BATTERY_FAILSAFE");
      }
    } else if (this._battery.percent <= this._config.batteryLowThreshold && !this._lowBatteryWarned) {
      this._lowBatteryWarned = true;
      this.emitEvent({
        type: "LOW_BATTERY_WARNING",
        droneId: this.id,
        timestamp: new Date(this._simulationTimestamp).toISOString(),
        payload: { batteryPercent: this._battery.percent }
      });
    }
  }

  public getTelemetry(): SimulatedTelemetry {
    let distanceToTarget = 0;
    if (this._activeWaypoints.length > 0 && this._currentWaypointIndex < this._activeWaypoints.length) {
      distanceToTarget = haversineDistanceMeters(
        this._kinematics.position,
        this._activeWaypoints[this._currentWaypointIndex]!.position
      );
    }

    return {
      version: "v1",
      organizationId: this.organizationId,
      droneId: this.id,
      observedAt: new Date(this._simulationTimestamp).toISOString(),
      position: {
        latitude: Number(this._kinematics.position.latitude.toFixed(6)),
        longitude: Number(this._kinematics.position.longitude.toFixed(6)),
        altitudeMeters: Number(this._kinematics.position.altitudeMeters.toFixed(1))
      },
      speedMetersPerSecond: Number(this._kinematics.speedMetersPerSecond.toFixed(1)),
      headingDegrees: Number(this._kinematics.headingDegrees.toFixed(1)),
      batteryPercent: Number(this._battery.percent.toFixed(2)),
      state: this._state,
      missionId: this._currentMission?.missionId,
      currentWaypointIndex: this._currentWaypointIndex,
      totalWaypoints: this._activeWaypoints.length,
      distanceToTargetMeters: Number(distanceToTarget.toFixed(1)),
      totalDistanceFlownMeters: Number(this._totalDistanceFlownMeters.toFixed(1)),
      emergencyReason: this._emergencyReason ?? undefined,
      flightTimeSeconds: Number(this._totalFlightTimeSeconds.toFixed(1))
    };
  }

  private broadcastTelemetry(): void {
    const frame = this.getTelemetry();
    for (const listener of this._telemetryListeners) {
      try {
        listener(frame);
      } catch (err) {
        console.error(`[simulator:drone:${this.id}] Error in telemetry listener:`, err);
      }
    }
  }

  // ==========================================================================
  // Event & State Transitions
  // ==========================================================================

  private transitionState(toState: DroneSimState, payload?: Record<string, unknown>): void {
    const fromState = this._state;
    if (fromState === toState) return;

    assertValidStateTransition(fromState, toState);
    this._state = toState;

    this.emitEvent({
      type: "STATE_CHANGED",
      droneId: this.id,
      timestamp: new Date(this._simulationTimestamp).toISOString(),
      fromState,
      toState,
      payload
    });
  }

  private emitEvent(event: DroneEvent): void {
    for (const listener of this._eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[simulator:drone:${this.id}] Error in event listener:`, err);
      }
    }
  }

  public onEvent(callback: (event: DroneEvent) => void): () => void {
    this._eventListeners.push(callback);
    return () => {
      this._eventListeners = this._eventListeners.filter((cb) => cb !== callback);
    };
  }

  public onTelemetry(callback: (telemetry: SimulatedTelemetry) => void): () => void {
    this._telemetryListeners.push(callback);
    return () => {
      this._telemetryListeners = this._telemetryListeners.filter((cb) => cb !== callback);
    };
  }
}
