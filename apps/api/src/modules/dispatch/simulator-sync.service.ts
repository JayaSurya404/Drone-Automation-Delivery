import { FleetSimulator } from "@skynav/simulator";
import type {
  SimulatedTelemetry,
  DroneEvent,
  MissionPlan,
  GeoCoordinate,
  Waypoint
} from "@skynav/simulator";
import type { OrderRepository } from "../orders/order.repository.js";
import type { MissionRepository } from "../missions/mission.repository.js";
import type { FleetRepository } from "../fleet/fleet.repository.js";
import type { OutboxRepository } from "../events/outbox.repository.js";
import type { SimulatorGateway, MissionFlightPlan, SimulatorGatewayResponse } from "../missions/simulator.adapter.js";
import type { Telemetry } from "@skynav/contracts";
import crypto from "node:crypto";

export interface TelemetryPublisher {
  publish(telemetry: Telemetry): Promise<void>;
}

export interface SimulatorSyncServiceOptions {
  fleetSimulator?: FleetSimulator;
  orderRepo?: OrderRepository;
  missionRepo?: MissionRepository;
  fleetRepo?: FleetRepository;
  outboxRepo?: OutboxRepository;
  telemetryPublisher?: TelemetryPublisher;
  onError?: (error: Error) => void;
}

export class SimulatorSyncService implements SimulatorGateway {
  private readonly simulator: FleetSimulator;
  private readonly orderRepo?: OrderRepository;
  private readonly missionRepo?: MissionRepository;
  private readonly fleetRepo?: FleetRepository;
  private readonly outboxRepo?: OutboxRepository;
  private readonly telemetryPublisher?: TelemetryPublisher;
  private readonly onError?: (error: Error) => void;

  // Track mission mapping: droneId -> { missionId, orderId, customerId, organizationId }
  private readonly activeMissionsByDrone = new Map<
    string,
    { missionId: string; orderId?: string; customerId?: string; organizationId: string }
  >();

  constructor(options: SimulatorSyncServiceOptions = {}) {
    this.simulator = options.fleetSimulator ?? new FleetSimulator();
    this.orderRepo = options.orderRepo;
    this.missionRepo = options.missionRepo;
    this.fleetRepo = options.fleetRepo;
    this.outboxRepo = options.outboxRepo;
    this.telemetryPublisher = options.telemetryPublisher;
    this.onError = options.onError;

    this.setupListeners();
  }

  public get fleetSimulator(): FleetSimulator {
    return this.simulator;
  }

  private setupListeners(): void {
    // 1. Forward all simulator telemetry frames to telemetry transport
    this.simulator.onTelemetry((simTelemetry: SimulatedTelemetry) => {
      if (this.telemetryPublisher) {
        this.telemetryPublisher.publish(simTelemetry).catch((err) => {
          if (this.onError) this.onError(err);
        });
      }
    });

    // 2. Handle discrete drone state transitions and sync with DB / Outbox
    this.simulator.onEvent((event: DroneEvent) => {
      this.handleSimulatorEvent(event).catch((err) => {
        if (this.onError) this.onError(err);
      });
    });
  }

  private async handleSimulatorEvent(event: DroneEvent): Promise<void> {
    const missionInfo = this.activeMissionsByDrone.get(event.droneId);
    const orgId = missionInfo?.organizationId ?? "00000000-0000-0000-0000-000000000001";

    if (event.type === "STATE_CHANGED" && event.toState) {
      const state = event.toState;

      // Update fleet repository status
      if (this.fleetRepo) {
        const droneStatus = state === "IDLE" ? "IDLE" : (state as any);
        await this.fleetRepo.update(event.droneId, orgId, {
          status: droneStatus
        }).catch(() => {});
      }

      if (missionInfo?.missionId && this.missionRepo) {
        if (state === "TAKEOFF") {
          await this.missionRepo.update(missionInfo.missionId, orgId, {
            status: "IN_PROGRESS",
            launched_at: new Date()
          }).catch(() => {});

          if (missionInfo.orderId && this.orderRepo) {
            await this.orderRepo.update(missionInfo.orderId, orgId, {
              status: "IN_TRANSIT"
            }).catch(() => {});
          }

          if (this.outboxRepo) {
            await this.outboxRepo.insert({
              id: crypto.randomUUID(),
              version: "v1",
              eventType: "DRONE_TAKEOFF",
              occurredAt: new Date().toISOString(),
              organizationId: orgId,
              aggregateType: "DRONE",
              aggregateId: event.droneId,
              payload: {
                missionId: missionInfo.missionId,
                orderId: missionInfo.orderId,
                customerId: missionInfo.customerId
              }
            }).catch(() => {});
          }
        } else if (state === "DELIVERING") {
          await this.missionRepo.update(missionInfo.missionId, orgId, {
            status: "DELIVERING"
          }).catch(() => {});

          if (this.outboxRepo) {
            await this.outboxRepo.insert({
              id: crypto.randomUUID(),
              version: "v1",
              eventType: "DRONE_ARRIVED",
              occurredAt: new Date().toISOString(),
              organizationId: orgId,
              aggregateType: "DRONE",
              aggregateId: event.droneId,
              payload: {
                missionId: missionInfo.missionId,
                orderId: missionInfo.orderId,
                customerId: missionInfo.customerId
              }
            }).catch(() => {});
          }
        } else if (state === "RETURNING") {
          await this.missionRepo.update(missionInfo.missionId, orgId, {
            status: "RETURNING"
          }).catch(() => {});
        } else if (state === "LANDED") {
          // Mission completed & Order delivered
          await this.missionRepo.update(missionInfo.missionId, orgId, {
            status: "COMPLETED",
            completed_at: new Date()
          }).catch(() => {});

          if (missionInfo.orderId && this.orderRepo) {
            await this.orderRepo.update(missionInfo.orderId, orgId, {
              status: "DELIVERED",
              delivered_at: new Date()
            }).catch(() => {});
          }

          if (this.fleetRepo) {
            await this.fleetRepo.update(event.droneId, orgId, {
              status: "IDLE"
            }).catch(() => {});
          }

          if (this.outboxRepo) {
            // Emits ORDER_DELIVERED to trigger delivery confirmation notification
            if (missionInfo.orderId) {
              await this.outboxRepo.insert({
                id: crypto.randomUUID(),
                version: "v1",
                eventType: "ORDER_DELIVERED",
                occurredAt: new Date().toISOString(),
                organizationId: orgId,
                aggregateType: "ORDER",
                aggregateId: missionInfo.orderId,
                payload: {
                  missionId: missionInfo.missionId,
                  customerId: missionInfo.customerId
                }
              }).catch(() => {});
            }

            await this.outboxRepo.insert({
              id: crypto.randomUUID(),
              version: "v1",
              eventType: "MISSION_COMPLETED",
              occurredAt: new Date().toISOString(),
              organizationId: orgId,
              aggregateType: "MISSION",
              aggregateId: missionInfo.missionId,
              payload: {
                droneId: event.droneId,
                orderId: missionInfo.orderId,
                customerId: missionInfo.customerId
              }
            }).catch(() => {});
          }

          this.activeMissionsByDrone.delete(event.droneId);
        } else if (state === "EMERGENCY") {
          await this.missionRepo.update(missionInfo.missionId, orgId, {
            status: "EMERGENCY",
            emergency_at: new Date(),
            emergency_reason: (event.payload?.reason as string) ?? "Simulator emergency declared"
          }).catch(() => {});

          if (this.outboxRepo) {
            await this.outboxRepo.insert({
              id: crypto.randomUUID(),
              version: "v1",
              eventType: "EMERGENCY_TRIGGERED",
              occurredAt: new Date().toISOString(),
              organizationId: orgId,
              aggregateType: "ALERT",
              aggregateId: event.droneId,
              payload: {
                missionId: missionInfo.missionId,
                orderId: missionInfo.orderId,
                reason: event.payload?.reason ?? "Emergency failsafe"
              }
            }).catch(() => {});
          }
        }
      }
    }
  }

  // ==========================================================================
  // SimulatorGateway Implementation
  // ==========================================================================

  async assignMission(plan: MissionFlightPlan): Promise<SimulatorGatewayResponse> {
    const origin: GeoCoordinate = {
      latitude: plan.origin.latitude,
      longitude: plan.origin.longitude,
      altitudeMeters: plan.origin.altitudeMeters ?? 0
    };

    const destination: GeoCoordinate = {
      latitude: plan.destination.latitude,
      longitude: plan.destination.longitude,
      altitudeMeters: plan.destination.altitudeMeters ?? 0
    };

    // Construct 3D waypoints for takeoff, cruise, delivery hold, and return
    const waypoints: Waypoint[] = [
      {
        id: `wp-${plan.missionId}-1-climb`,
        sequence: 0,
        position: {
          latitude: origin.latitude,
          longitude: origin.longitude,
          altitudeMeters: 60
        },
        targetSpeedMetersPerSecond: 12,
        targetAltitudeMeters: 60
      },
      {
        id: `wp-${plan.missionId}-2-mid`,
        sequence: 1,
        position: {
          latitude: (origin.latitude + destination.latitude) / 2,
          longitude: (origin.longitude + destination.longitude) / 2,
          altitudeMeters: 60
        },
        targetSpeedMetersPerSecond: 18,
        targetAltitudeMeters: 60
      },
      {
        id: `wp-${plan.missionId}-3-approach`,
        sequence: 2,
        position: {
          latitude: destination.latitude,
          longitude: destination.longitude,
          altitudeMeters: 60
        },
        targetSpeedMetersPerSecond: 10,
        targetAltitudeMeters: 60
      },
      {
        id: `wp-${plan.missionId}-4-drop`,
        sequence: 3,
        position: {
          latitude: destination.latitude,
          longitude: destination.longitude,
          altitudeMeters: 2
        },
        targetSpeedMetersPerSecond: 2,
        targetAltitudeMeters: 2,
        holdDurationSeconds: 3,
        isDeliveryPoint: true
      }
    ];

    const missionPlan: MissionPlan = {
      missionId: plan.missionId,
      organizationId: plan.organizationId,
      droneId: plan.droneId,
      origin,
      destination,
      waypoints,
      deliveryHoldDurationSeconds: 3
    };

    // Store mission context mapping
    this.activeMissionsByDrone.set(plan.droneId, {
      missionId: plan.missionId,
      organizationId: plan.organizationId,
      orderId: plan.orderId,
      customerId: plan.customerId
    });

    // Assign & arm mission in deterministic simulator
    this.simulator.assignMission(missionPlan);

    // Automatically trigger mission takeoff
    this.simulator.startMission(plan.droneId);

    return {
      accepted: true,
      message: `Flight plan accepted and mission armed for UAV '${plan.droneId}'.`
    };
  }

  async triggerEmergency(droneId: string, reason: string): Promise<SimulatorGatewayResponse> {
    this.simulator.triggerEmergency(droneId, reason);
    return {
      accepted: true,
      message: `Emergency acknowledged in simulation for UAV '${droneId}': ${reason}`
    };
  }

  async triggerReturnToHome(droneId: string): Promise<SimulatorGatewayResponse> {
    this.simulator.returnToHome(droneId, "Return to Home commanded by operator");
    return {
      accepted: true,
      message: `Return-To-Home commanded in simulation for UAV '${droneId}'.`
    };
  }

  /**
   * Advances the simulation clock by deltaSeconds.
   */
  public advanceSimulation(deltaSeconds: number): void {
    this.simulator.tick(deltaSeconds);
  }

  /**
   * Links order details to the active drone mission mapping.
   */
  public registerMissionOrderLink(droneId: string, orderId: string, customerId?: string): void {
    const existing = this.activeMissionsByDrone.get(droneId);
    if (existing) {
      existing.orderId = orderId;
      existing.customerId = customerId;
    }
  }
}
