import type { Coordinate } from "@skynav/contracts";

export interface MissionFlightPlan {
  missionId: string;
  organizationId: string;
  droneId: string;
  origin: Coordinate;
  destination: Coordinate;
  orderId?: string;
  customerId?: string;
}

export interface SimulatorGatewayResponse {
  accepted: boolean;
  message?: string;
}

/**
 * Clean architectural boundary abstraction separating API/Database infrastructure
 * from deterministic physical drone simulation engines.
 */
export interface SimulatorGateway {
  assignMission(plan: MissionFlightPlan): Promise<SimulatorGatewayResponse>;
  triggerEmergency(droneId: string, reason: string): Promise<SimulatorGatewayResponse>;
  triggerReturnToHome(droneId: string, reason?: string): Promise<SimulatorGatewayResponse>;
  clearEmergency(droneId: string): Promise<SimulatorGatewayResponse>;
}

/**
 * Default decoupled gateway implementation for testing and operational routing.
 */
export class DefaultSimulatorGateway implements SimulatorGateway {
  private readonly assignedPlans = new Map<string, MissionFlightPlan>();

  async assignMission(plan: MissionFlightPlan): Promise<SimulatorGatewayResponse> {
    this.assignedPlans.set(plan.missionId, plan);
    return {
      accepted: true,
      message: `Flight plan accepted for drone '${plan.droneId}' on mission '${plan.missionId}'.`
    };
  }

  async triggerEmergency(droneId: string, reason: string): Promise<SimulatorGatewayResponse> {
    return {
      accepted: true,
      message: `Emergency protocol acknowledged for drone '${droneId}': ${reason}.`
    };
  }

  async triggerReturnToHome(droneId: string, reason = "Return-To-Home commanded by operator"): Promise<SimulatorGatewayResponse> {
    return {
      accepted: true,
      message: `Return-To-Home protocol acknowledged for drone '${droneId}': ${reason}.`
    };
  }

  async clearEmergency(droneId: string): Promise<SimulatorGatewayResponse> {
    return {
      accepted: true,
      message: `Emergency cleared in simulation for drone '${droneId}'.`
    };
  }

  getAssignedPlan(missionId: string): MissionFlightPlan | undefined {
    return this.assignedPlans.get(missionId);
  }
}

export function createSimulatorGateway(): SimulatorGateway {
  return new DefaultSimulatorGateway();
}
