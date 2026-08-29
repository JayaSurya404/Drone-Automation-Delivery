import type {
  AuthenticatedUser,
  OrderResponse,
  MissionResponse,
  DroneResponse
} from "@skynav/contracts";
import type { OrderRepository } from "../orders/order.repository.js";
import type { OrderService, OrderNotFoundError, OrderForbiddenError } from "../orders/order.service.js";
import { mapOrderRecordToResponse } from "../orders/order.service.js";
import type { MissionRepository } from "../missions/mission.repository.js";
import type { MissionService } from "../missions/mission.service.js";
import type { FleetRepository } from "../fleet/fleet.repository.js";
import type { DroneSelector } from "./drone-selector.js";
import type { SimulatorGateway } from "../missions/simulator.adapter.js";
import type { SimulatorSyncService } from "./simulator-sync.service.js";
import type { AuditService } from "../audit/audit.service.js";
import type { OutboxRepository } from "../events/outbox.repository.js";
import crypto from "node:crypto";

export interface DispatchResult {
  order: OrderResponse;
  mission: MissionResponse;
  drone: DroneResponse;
}

export class OrderNotDispatchableError extends Error {
  public readonly code = "ORDER_NOT_DISPATCHABLE";
  constructor(status: string) {
    super(`Orders in status '${status}' cannot be dispatched. Only 'CREATED' or 'CONFIRMED' orders can be dispatched.`);
    this.name = "OrderNotDispatchableError";
  }
}

export interface DeliveryOrchestrator {
  dispatchOrder(user: AuthenticatedUser, orderId: string): Promise<DispatchResult>;
}

export function createDeliveryOrchestrator(params: {
  orderRepo: OrderRepository;
  missionRepo: MissionRepository;
  fleetRepo: FleetRepository;
  droneSelector: DroneSelector;
  missionService: MissionService;
  simulatorGateway: SimulatorGateway;
  simulatorSyncService?: SimulatorSyncService;
  auditService: AuditService;
  outboxRepo?: OutboxRepository;
}): DeliveryOrchestrator {
  const {
    orderRepo,
    missionRepo,
    fleetRepo,
    droneSelector,
    missionService,
    simulatorGateway,
    simulatorSyncService,
    auditService,
    outboxRepo
  } = params;

  return {
    async dispatchOrder(user: AuthenticatedUser, orderId: string): Promise<DispatchResult> {
      // 1. Fetch and validate order
      const order = await orderRepo.findById(orderId, user.organizationId);
      if (!order) {
        throw new Error(`Order '${orderId}' not found in organization.`);
      }

      if (user.role === "CUSTOMER" && order.customer_id !== user.id) {
        throw new Error("You are not authorized to dispatch this order.");
      }

      if (order.status !== "CREATED" && order.status !== "CONFIRMED") {
        throw new OrderNotDispatchableError(order.status);
      }

      // 2. Select optimal drone
      const optimalDrone = await droneSelector.selectOptimalDrone({
        organizationId: user.organizationId,
        packageWeightGrams: Number(order.package_weight_grams),
        origin: {
          latitude: Number(order.pickup_latitude),
          longitude: Number(order.pickup_longitude),
          altitudeMeters: Number(order.pickup_altitude_meters ?? 0)
        }
      });

      // 3. Check for existing active mission or create a new mission
      let mission = await missionRepo.findActiveByOrderId(orderId, user.organizationId);
      if (!mission) {
        const createdMission = await missionService.createMission(user, {
          orderId,
          origin: {
            latitude: Number(order.pickup_latitude),
            longitude: Number(order.pickup_longitude),
            altitudeMeters: Number(order.pickup_altitude_meters ?? 0),
            address: order.pickup_address ?? undefined
          },
          destination: {
            latitude: Number(order.delivery_latitude),
            longitude: Number(order.delivery_longitude),
            altitudeMeters: Number(order.delivery_altitude_meters ?? 0),
            address: order.delivery_address ?? undefined
          }
        });

        // 4. Atomically assign drone to mission and update order status to ASSIGNED
        const assignedMission = await missionService.assignDrone(user, createdMission.id, optimalDrone.id);

        if (simulatorSyncService) {
          simulatorSyncService.registerMissionOrderLink(optimalDrone.id, order.id, order.customer_id);
        }

        // Fetch updated order & drone
        const updatedOrder = await orderRepo.findById(orderId, user.organizationId);
        const updatedDrone = await fleetRepo.findById(optimalDrone.id, user.organizationId);

        await auditService.log({
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: "ORDER_DISPATCHED",
          resourceType: "order",
          resourceId: orderId,
          metadata: {
            droneId: optimalDrone.id,
            droneCallSign: optimalDrone.call_sign,
            missionId: assignedMission.id
          }
        });

        return {
          order: mapOrderRecordToResponse(updatedOrder!),
          mission: assignedMission,
          drone: {
            id: updatedDrone!.id,
            organizationId: updatedDrone!.organization_id,
            callSign: updatedDrone!.call_sign,
            model: updatedDrone!.model,
            serialNumber: updatedDrone!.serial_number,
            status: updatedDrone!.status as any,
            batteryPercent: updatedDrone!.battery_percent,
            maxPayloadGrams: updatedDrone!.max_payload_grams,
            currentLocation: {
              latitude: updatedDrone!.current_latitude,
              longitude: updatedDrone!.current_longitude,
              altitudeMeters: updatedDrone!.current_altitude_meters
            },
            homeLocation: {
              latitude: updatedDrone!.home_latitude,
              longitude: updatedDrone!.home_longitude,
              altitudeMeters: updatedDrone!.home_altitude_meters
            },
            isActive: updatedDrone!.is_active,
            createdAt: new Date(updatedDrone!.created_at).toISOString(),
            updatedAt: new Date(updatedDrone!.updated_at).toISOString()
          }
        };
      } else {
        // Mission already existed
        const assignedMission = await missionService.assignDrone(user, mission.id, optimalDrone.id);

        if (simulatorSyncService) {
          simulatorSyncService.registerMissionOrderLink(optimalDrone.id, order.id, order.customer_id);
        }

        const updatedOrder = await orderRepo.findById(orderId, user.organizationId);
        const updatedDrone = await fleetRepo.findById(optimalDrone.id, user.organizationId);

        return {
          order: mapOrderRecordToResponse(updatedOrder!),
          mission: assignedMission,
          drone: {
            id: updatedDrone!.id,
            organizationId: updatedDrone!.organization_id,
            callSign: updatedDrone!.call_sign,
            model: updatedDrone!.model,
            serialNumber: updatedDrone!.serial_number,
            status: updatedDrone!.status as any,
            batteryPercent: updatedDrone!.battery_percent,
            maxPayloadGrams: updatedDrone!.max_payload_grams,
            currentLocation: {
              latitude: updatedDrone!.current_latitude,
              longitude: updatedDrone!.current_longitude,
              altitudeMeters: updatedDrone!.current_altitude_meters
            },
            homeLocation: {
              latitude: updatedDrone!.home_latitude,
              longitude: updatedDrone!.home_longitude,
              altitudeMeters: updatedDrone!.home_altitude_meters
            },
            isActive: updatedDrone!.is_active,
            createdAt: new Date(updatedDrone!.created_at).toISOString(),
            updatedAt: new Date(updatedDrone!.updated_at).toISOString()
          }
        };
      }
    }
  };
}
