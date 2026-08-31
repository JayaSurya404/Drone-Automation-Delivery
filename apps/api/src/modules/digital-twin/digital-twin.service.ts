import type {
  DroneTwin,
  MissionTwin,
  FleetTwin,
  EnvironmentTwin,
  DigitalTwinSnapshot,
  TwinHealthReport,
  TwinDiagnosticIssue,
  TwinHealthStatus,
  PerceptionTwinState,
  AiTwinState,
  AuthenticatedUser,
  Telemetry,
  TelemetryFreshness,
  PerceptionEvent
} from "@skynav/contracts";
import type { FleetRepository } from "../fleet/fleet.repository.js";
import type { MissionRepository } from "../missions/mission.repository.js";
import type { OrderRepository } from "../orders/order.repository.js";
import type { AuditService } from "../audit/audit.service.js";
import {
  DigitalTwinForbiddenError,
  DigitalTwinNotFoundError,
  type TwinPublisher
} from "./digital-twin.types.js";

export interface DigitalTwinServiceOptions {
  fleetRepo?: FleetRepository;
  missionRepo?: MissionRepository;
  orderRepo?: OrderRepository;
  auditService?: AuditService;
  publisher?: TwinPublisher;
}

export interface DigitalTwinService {
  ingestTelemetry(telemetry: Telemetry): Promise<DroneTwin>;
  ingestPerception(event: PerceptionEvent): Promise<DroneTwin | null>;
  ingestAiAdvisory(orgId: string, droneId: string, advisory: AiTwinState): Promise<DroneTwin | null>;
  registerDroneState(orgId: string, drone: { id: string; callSign: string; model?: string; status: string; batteryPercent?: number; maxPayloadGrams?: number; homeLatitude?: number; homeLongitude?: number }): DroneTwin;
  registerMissionState(orgId: string, mission: { id: string; orderId: string; droneId?: string; status: string; origin: { latitude: number; longitude: number }; destination: { latitude: number; longitude: number } }): MissionTwin;
  getFleetTwin(user: AuthenticatedUser): Promise<FleetTwin>;
  getDroneTwin(user: AuthenticatedUser, droneId: string): Promise<DroneTwin>;
  getMissionTwin(user: AuthenticatedUser, missionId: string): Promise<MissionTwin>;
  getSnapshot(user: AuthenticatedUser): Promise<DigitalTwinSnapshot>;
  getHealthReport(user: AuthenticatedUser): Promise<TwinHealthReport>;
}

function calculateFreshness(timestampStr: string): TelemetryFreshness {
  const ageMs = Date.now() - new Date(timestampStr).getTime();
  if (ageMs <= 15_000) return "LIVE";
  if (ageMs <= 30_000) return "DEGRADED";
  if (ageMs <= 60_000) return "STALE";
  return "OFFLINE";
}

function assertOperatorOrAdmin(user: AuthenticatedUser): void {
  const allowed = ["ADMIN", "OPERATOR", "FLEET_MANAGER", "DISPATCHER"];
  if (!allowed.includes(user.role)) {
    throw new DigitalTwinForbiddenError(`Role '${user.role}' is not authorized to access Digital Twin infrastructure.`);
  }
}

export function createDigitalTwinService(options: DigitalTwinServiceOptions = {}): DigitalTwinService {
  const { fleetRepo, missionRepo, orderRepo, auditService, publisher } = options;

  // In-memory bounded tenant-isolated state store
  // Map keys: `${orgId}:${entityId}`
  const droneTwins = new Map<string, DroneTwin>();
  const missionTwins = new Map<string, MissionTwin>();
  const discrepanciesStore = new Map<string, TwinDiagnosticIssue[]>();
  const lastObservedTimestamps = new Map<string, number>(); // `${orgId}:${droneId}` -> ms timestamp

  function getDroneKey(orgId: string, droneId: string): string {
    return `${orgId}:${droneId}`;
  }

  function getMissionKey(orgId: string, missionId: string): string {
    return `${orgId}:${missionId}`;
  }

  function evaluateDroneHealth(twin: DroneTwin, warnings: string[]): TwinHealthStatus {
    if (twin.telemetryFreshness === "OFFLINE") return "OFFLINE";
    if (twin.battery.isCritical || twin.operationalState === "EMERGENCY") return "CRITICAL";
    if (warnings.length > 0) return "INCONSISTENT";
    if (twin.battery.isLow || twin.telemetryFreshness === "DEGRADED" || twin.telemetryFreshness === "STALE") {
      return "DEGRADED";
    }
    return "HEALTHY";
  }

  return {
    registerDroneState(orgId, drone) {
      const key = getDroneKey(orgId, drone.id);
      const existing = droneTwins.get(key);
      const now = new Date().toISOString();

      const newTwin: DroneTwin = {
        droneId: drone.id,
        organizationId: orgId,
        callSign: drone.callSign,
        model: drone.model || "SkyNav Pelican Standard",
        operationalState: drone.status,
        authoritativeStatus: drone.status as any,
        position: existing?.position || {
          latitude: drone.homeLatitude || 37.7749,
          longitude: drone.homeLongitude || -122.4194,
          altitudeMeters: 0.0
        },
        headingDegrees: existing?.headingDegrees || 0,
        groundSpeedMps: existing?.groundSpeedMps || 0,
        verticalSpeedMps: existing?.verticalSpeedMps || 0,
        battery: existing?.battery || {
          percent: drone.batteryPercent ?? 100,
          voltageVolts: 24.0,
          temperatureCelsius: 25.0,
          isLow: (drone.batteryPercent ?? 100) <= 25,
          isCritical: (drone.batteryPercent ?? 100) <= 15,
          healthStatus: "NORMAL"
        },
        payload: existing?.payload || {
          weightGrams: 0,
          maxCapacityGrams: drone.maxPayloadGrams || 5000,
          isLoaded: false
        },
        currentMission: existing?.currentMission,
        telemetryFreshness: existing?.telemetryFreshness || "OFFLINE",
        lastTelemetryTimestamp: existing?.lastTelemetryTimestamp,
        lastSyncTimestamp: now,
        health: existing?.health || "HEALTHY",
        reconciliationWarnings: existing?.reconciliationWarnings || [],
        revision: (existing?.revision || 0) + 1
      };

      droneTwins.set(key, newTwin);
      return newTwin;
    },

    registerMissionState(orgId, mission) {
      const key = getMissionKey(orgId, mission.id);
      const existing = missionTwins.get(key);
      const now = new Date().toISOString();

      const newTwin: MissionTwin = {
        missionId: mission.id,
        organizationId: orgId,
        orderId: mission.orderId,
        droneId: mission.droneId,
        authoritativeState: mission.status,
        twinState: existing?.twinState || mission.status,
        origin: mission.origin,
        destination: mission.destination,
        currentWaypointIndex: existing?.currentWaypointIndex || 0,
        totalWaypoints: existing?.totalWaypoints || 4,
        progressPercent: existing?.progressPercent || 0,
        distanceRemainingMeters: existing?.distanceRemainingMeters || 1000,
        etaSeconds: existing?.etaSeconds || 120,
        safetyStatus: "CLEAR",
        lastSyncTimestamp: now,
        reconciliation: existing?.reconciliation || { isConsistent: true, discrepancies: [] }
      };

      missionTwins.set(key, newTwin);
      return newTwin;
    },

    async ingestTelemetry(telemetry: Telemetry): Promise<DroneTwin> {
      const orgId = telemetry.organizationId;
      const droneId = telemetry.droneId;
      const droneKey = getDroneKey(orgId, droneId);
      const now = new Date().toISOString();
      const frameTimestampMs = new Date(telemetry.observedAt).getTime();

      // Out-of-order frame protection
      const lastObservedMs = lastObservedTimestamps.get(droneKey) || 0;
      if (frameTimestampMs < lastObservedMs) {
        // Discard older frame from mutating twin state
        const existing = droneTwins.get(droneKey);
        if (existing) return existing;
      }
      lastObservedTimestamps.set(droneKey, frameTimestampMs);

      const freshness = calculateFreshness(telemetry.observedAt);
      const existing = droneTwins.get(droneKey);
      const warnings: string[] = [];
      const operationalState = telemetry.state || "IN_FLIGHT";

      // Reconciliation Checks:
      // 1. Authoritative Domain state vs Telemetry state
      if (existing?.authoritativeStatus && existing.authoritativeStatus !== operationalState) {
        // Allow standard simulation forward synonyms (e.g. IN_FLIGHT vs EN_ROUTE)
        const isCompatible =
          (existing.authoritativeStatus === "IN_FLIGHT" && ["EN_ROUTE", "TAKEOFF", "ARRIVED", "DELIVERING", "RETURNING"].includes(operationalState)) ||
          (existing.authoritativeStatus === "IDLE" && ["IDLE", "TAKEOFF", "EN_ROUTE", "AVAILABLE", "ASSIGNED"].includes(operationalState)) ||
          (existing.authoritativeStatus === "AVAILABLE" && ["AVAILABLE", "ASSIGNED", "TAKEOFF", "EN_ROUTE"].includes(operationalState)) ||
          (existing.authoritativeStatus === "ASSIGNED" && ["ASSIGNED", "TAKEOFF", "EN_ROUTE", "IN_FLIGHT"].includes(operationalState)) ||
          (existing.authoritativeStatus === operationalState);

        if (!isCompatible) {
          warnings.push(`State Discrepancy: Authoritative state is '${existing.authoritativeStatus}' but live telemetry reports '${operationalState}'`);
        }
      }

      // 2. Altitude Anomaly Check during delivery
      const altitude = telemetry.position.altitudeMeters ?? 0;
      if (operationalState === "DELIVERING" && altitude > 20.0) {
        warnings.push(`Descent Altitude Anomaly: Status is 'DELIVERING' but drone altitude is ${altitude.toFixed(1)}m (>20m limit)`);
      }

      // 3. Low / Critical Battery Reserve Check
      const isCriticalBattery = telemetry.batteryPercent <= 15.0;
      const isLowBattery = telemetry.batteryPercent <= 25.0;
      if (isCriticalBattery) {
        warnings.push(`Critical Battery Reserve: UAV at ${telemetry.batteryPercent.toFixed(1)}% battery (<15% critical reserve)`);
      }

      // 4. Stale Telemetry Check
      if (freshness === "STALE" || freshness === "OFFLINE") {
        warnings.push(`Telemetry Freshness Warning: Signal is ${freshness}`);
      }

      const updatedTwin: DroneTwin = {
        droneId,
        organizationId: orgId,
        callSign: existing?.callSign || `DRONE-${droneId.slice(0, 6)}`,
        model: existing?.model || "SkyNav Pelican Heavy",
        operationalState,
        authoritativeStatus: existing?.authoritativeStatus,
        position: {
          latitude: telemetry.position.latitude,
          longitude: telemetry.position.longitude,
          altitudeMeters: telemetry.position.altitudeMeters ?? 0
        },
        headingDegrees: telemetry.headingDegrees,
        groundSpeedMps: telemetry.speedMetersPerSecond,
        verticalSpeedMps: 0,
        battery: {
          percent: telemetry.batteryPercent,
          voltageVolts: 24.0,
          temperatureCelsius: 28.0,
          isLow: isLowBattery,
          isCritical: isCriticalBattery,
          healthStatus: isCriticalBattery ? "CRITICAL" : isLowBattery ? "DEGRADED" : "NORMAL"
        },
        payload: existing?.payload || {
          weightGrams: 0,
          maxCapacityGrams: 5000,
          isLoaded: false
        },
        currentMission: existing?.currentMission,
        telemetryFreshness: freshness,
        lastTelemetryTimestamp: telemetry.observedAt,
        lastSyncTimestamp: now,
        perceptionState: existing?.perceptionState,
        aiAdvisoryState: existing?.aiAdvisoryState,
        health: "HEALTHY", // will be computed below
        reconciliationWarnings: warnings,
        revision: (existing?.revision || 0) + 1
      };

      updatedTwin.health = evaluateDroneHealth(updatedTwin, warnings);
      droneTwins.set(droneKey, updatedTwin);

      // Reconcile Mission Twin if associated
      if (existing?.currentMission?.missionId) {
        const missionKey = getMissionKey(orgId, existing.currentMission.missionId);
        const missionTwin = missionTwins.get(missionKey);
        if (missionTwin) {
          const missionDiscrepancies: string[] = [];
          if (missionTwin.authoritativeState === "COMPLETED" && operationalState !== "LANDED" && operationalState !== "IDLE") {
            missionDiscrepancies.push(`Mission '${missionTwin.missionId}' marked COMPLETED but UAV remains in active state '${operationalState}'`);
          }

          missionTwins.set(missionKey, {
            ...missionTwin,
            twinState: operationalState,
            lastTelemetryTimestamp: telemetry.observedAt,
            lastSyncTimestamp: now,
            reconciliation: {
              isConsistent: missionDiscrepancies.length === 0,
              discrepancies: missionDiscrepancies
            }
          });
        }
      }

      // Record audit event on new significant reconciliation issues
      if (warnings.length > 0 && auditService && (!existing || existing.reconciliationWarnings.length === 0)) {
        await auditService.log({
          organizationId: orgId,
          action: "TWIN_RECONCILIATION_DETECTED",
          resourceType: "drone",
          resourceId: droneId,
          metadata: {
            telemetryTimestamp: telemetry.observedAt,
            operationalState,
            warnings
          }
        });
      }

      // Publish Realtime Twin Update via WebSocket / Redis
      if (publisher) {
        await publisher.publishTwinUpdate(orgId, "DRONE", {
          droneId,
          operationalState: updatedTwin.operationalState,
          position: updatedTwin.position,
          battery: updatedTwin.battery,
          health: updatedTwin.health,
          freshness: updatedTwin.telemetryFreshness,
          reconciliationWarnings: warnings
        });
      }

      return updatedTwin;
    },

    async ingestPerception(event: PerceptionEvent): Promise<DroneTwin | null> {
      const droneKey = getDroneKey(event.organizationId, event.droneId);
      const existing = droneTwins.get(droneKey);
      if (!existing) return null;

      const perceptionState: PerceptionTwinState = {
        lastVisionTimestamp: event.timestamp,
        cameraSource: event.cameraSource,
        sceneType: "SUBURBAN",
        landingSuitability: event.landingSuitability,
        isTargetVerified: event.isTargetVerified,
        hazardsDetectedCount: event.hazardsDetectedCount,
        detectionsSummary: event.summary ? [event.summary] : [],
        advisorySafetyStatus: event.advisorySafetyStatus,
        modelVersion: "vision-foundation-v1.0.0"
      };

      const updatedTwin: DroneTwin = {
        ...existing,
        perceptionState,
        lastSyncTimestamp: new Date().toISOString(),
        revision: existing.revision + 1
      };

      droneTwins.set(droneKey, updatedTwin);

      if (publisher) {
        await publisher.publishTwinUpdate(event.organizationId, "DRONE", {
          droneId: event.droneId,
          perceptionState
        });
      }

      return updatedTwin;
    },

    async ingestAiAdvisory(orgId: string, droneId: string, advisory: AiTwinState): Promise<DroneTwin | null> {
      const droneKey = getDroneKey(orgId, droneId);
      const existing = droneTwins.get(droneKey);
      if (!existing) return null;

      const updatedTwin: DroneTwin = {
        ...existing,
        aiAdvisoryState: advisory,
        lastSyncTimestamp: new Date().toISOString(),
        revision: existing.revision + 1
      };

      droneTwins.set(droneKey, updatedTwin);
      return updatedTwin;
    },

    async getFleetTwin(user: AuthenticatedUser): Promise<FleetTwin> {
      assertOperatorOrAdmin(user);
      const orgId = user.organizationId;

      const orgDrones: DroneTwin[] = [];
      for (const [key, twin] of droneTwins.entries()) {
        if (key.startsWith(`${orgId}:`)) {
          // Re-evaluate freshness dynamically on query
          const currentFreshness = twin.lastTelemetryTimestamp
            ? calculateFreshness(twin.lastTelemetryTimestamp)
            : "OFFLINE";
          orgDrones.push({ ...twin, telemetryFreshness: currentFreshness });
        }
      }

      const totalDrones = orgDrones.length;
      let availableDrones = 0;
      let activeDrones = 0;
      let returningDrones = 0;
      let emergencyDrones = 0;
      let offlineDrones = 0;
      let maintenanceDrones = 0;
      let batterySum = 0;
      let lowBatteryCount = 0;
      let criticalBatteryCount = 0;
      let liveCount = 0;
      let degradedCount = 0;
      let staleCount = 0;
      let offlineCount = 0;
      let totalDiscrepancies = 0;

      for (const d of orgDrones) {
        batterySum += d.battery.percent;
        if (d.battery.isCritical) criticalBatteryCount++;
        else if (d.battery.isLow) lowBatteryCount++;

        if (d.telemetryFreshness === "LIVE") liveCount++;
        else if (d.telemetryFreshness === "DEGRADED") degradedCount++;
        else if (d.telemetryFreshness === "STALE") staleCount++;
        else offlineCount++;

        totalDiscrepancies += d.reconciliationWarnings.length;

        switch (d.operationalState) {
          case "IDLE":
          case "AVAILABLE":
            availableDrones++;
            break;
          case "EN_ROUTE":
          case "TAKEOFF":
          case "ARRIVED":
          case "DELIVERING":
          case "IN_FLIGHT":
            activeDrones++;
            break;
          case "RETURNING":
            returningDrones++;
            break;
          case "EMERGENCY":
            emergencyDrones++;
            break;
          case "MAINTENANCE":
            maintenanceDrones++;
            break;
          case "OFFLINE":
          default:
            offlineDrones++;
            break;
        }
      }

      let activeMissionsCount = 0;
      for (const [key, m] of missionTwins.entries()) {
        if (key.startsWith(`${orgId}:`) && !["COMPLETED", "CANCELLED", "FAILED"].includes(m.authoritativeState)) {
          activeMissionsCount++;
        }
      }

      const avgBattery = totalDrones > 0 ? Math.round((batterySum / totalDrones) * 10) / 10 : 100;

      return {
        organizationId: orgId,
        totalDrones,
        availableDrones,
        activeDrones,
        returningDrones,
        emergencyDrones,
        offlineDrones,
        maintenanceDrones,
        activeMissionsCount,
        batteryHealthSummary: {
          averagePercent: avgBattery,
          lowBatteryCount,
          criticalBatteryCount
        },
        telemetryFreshnessSummary: {
          liveCount,
          degradedCount,
          staleCount,
          offlineCount
        },
        maintenanceRiskSummary: {
          healthyCount: Math.max(0, totalDrones - (lowBatteryCount + criticalBatteryCount)),
          warningCount: lowBatteryCount,
          urgentCount: criticalBatteryCount
        },
        reconciliationDiscrepanciesCount: totalDiscrepancies,
        lastSyncTimestamp: new Date().toISOString()
      };
    },

    async getDroneTwin(user: AuthenticatedUser, droneId: string): Promise<DroneTwin> {
      assertOperatorOrAdmin(user);
      const droneKey = getDroneKey(user.organizationId, droneId);
      const twin = droneTwins.get(droneKey);

      if (!twin) {
        // Fallback: check if drone exists in repository
        if (fleetRepo) {
          const record = await fleetRepo.findById(droneId, user.organizationId);
          if (record) {
            return this.registerDroneState(user.organizationId, {
              id: record.id,
              callSign: record.call_sign,
              model: record.model,
              status: record.status,
              batteryPercent: record.battery_percent,
              maxPayloadGrams: record.max_payload_grams,
              homeLatitude: record.home_latitude,
              homeLongitude: record.home_longitude
            });
          }
        }
        throw new DigitalTwinNotFoundError(`Drone Twin '${droneId}' was not found in your organization.`);
      }

      const freshness = twin.lastTelemetryTimestamp ? calculateFreshness(twin.lastTelemetryTimestamp) : "OFFLINE";
      return { ...twin, telemetryFreshness: freshness };
    },

    async getMissionTwin(user: AuthenticatedUser, missionId: string): Promise<MissionTwin> {
      assertOperatorOrAdmin(user);
      const missionKey = getMissionKey(user.organizationId, missionId);
      const twin = missionTwins.get(missionKey);

      if (!twin) {
        if (missionRepo) {
          const record = await missionRepo.findById(missionId, user.organizationId);
          if (record) {
            return this.registerMissionState(user.organizationId, {
              id: record.id,
              orderId: record.order_id,
              droneId: record.drone_id || undefined,
              status: record.status,
              origin: { latitude: record.origin_latitude, longitude: record.origin_longitude },
              destination: { latitude: record.destination_latitude, longitude: record.destination_longitude }
            });
          }
        }
        throw new DigitalTwinNotFoundError(`Mission Twin '${missionId}' was not found in your organization.`);
      }

      return twin;
    },

    async getSnapshot(user: AuthenticatedUser): Promise<DigitalTwinSnapshot> {
      assertOperatorOrAdmin(user);
      const orgId = user.organizationId;
      const fleet = await this.getFleetTwin(user);

      const drones: DroneTwin[] = [];
      for (const [key, d] of droneTwins.entries()) {
        if (key.startsWith(`${orgId}:`)) {
          const freshness = d.lastTelemetryTimestamp ? calculateFreshness(d.lastTelemetryTimestamp) : "OFFLINE";
          drones.push({ ...d, telemetryFreshness: freshness });
        }
      }

      const missions: MissionTwin[] = [];
      for (const [key, m] of missionTwins.entries()) {
        if (key.startsWith(`${orgId}:`)) {
          missions.push(m);
        }
      }

      const environment: EnvironmentTwin = {
        organizationId: orgId,
        activeGeofencesCount: 2,
        noFlyZonesCount: 0,
        airspaceRiskLevel: "LOW",
        lastUpdated: new Date().toISOString()
      };

      return {
        organizationId: orgId,
        fleet,
        drones,
        missions,
        environment,
        snapshotTimestamp: new Date().toISOString(),
        version: "digital-twin-v1.0.0"
      };
    },

    async getHealthReport(user: AuthenticatedUser): Promise<TwinHealthReport> {
      assertOperatorOrAdmin(user);
      const orgId = user.organizationId;
      const issues: TwinDiagnosticIssue[] = [];
      let activeDiscrepancies = 0;
      let totalDrones = 0;
      let hasCritical = false;
      let hasDegraded = false;

      for (const [key, d] of droneTwins.entries()) {
        if (key.startsWith(`${orgId}:`)) {
          totalDrones++;
          if (d.reconciliationWarnings.length > 0) {
            activeDiscrepancies += d.reconciliationWarnings.length;
            for (const warn of d.reconciliationWarnings) {
              issues.push({
                code: "DRONE_RECONCILIATION_WARNING",
                message: `[${d.callSign}] ${warn}`,
                severity: warn.includes("Critical") ? "CRITICAL" : "WARNING",
                timestamp: d.lastSyncTimestamp,
                details: { droneId: d.droneId, operationalState: d.operationalState }
              });
            }
          }

          if (d.health === "CRITICAL") hasCritical = true;
          else if (d.health === "DEGRADED" || d.health === "INCONSISTENT") hasDegraded = true;
        }
      }

      let overallStatus: TwinHealthStatus = "HEALTHY";
      if (hasCritical) overallStatus = "CRITICAL";
      else if (activeDiscrepancies > 0) overallStatus = "INCONSISTENT";
      else if (hasDegraded) overallStatus = "DEGRADED";

      return {
        organizationId: orgId,
        overallStatus,
        totalDronesTracked: totalDrones,
        totalMissionsTracked: missionTwins.size,
        activeDiscrepanciesCount: activeDiscrepancies,
        issues,
        evaluatedAt: new Date().toISOString()
      };
    }
  };
}
