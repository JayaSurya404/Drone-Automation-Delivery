import type {
  DroneTwin,
  MissionTwin,
  FleetTwin,
  EnvironmentTwin,
  DigitalTwinSnapshot,
  TwinHealthReport,
  TwinDiagnosticIssue,
  TwinHealthStatus,
  AuthenticatedUser,
  Telemetry
} from "@skynav/contracts";

export class DigitalTwinForbiddenError extends Error {
  public readonly code = "DIGITAL_TWIN_FORBIDDEN";
  constructor(message = "You are not authorized to perform this Digital Twin operation.") {
    super(message);
    this.name = "DigitalTwinForbiddenError";
  }
}

export class DigitalTwinNotFoundError extends Error {
  public readonly code = "DIGITAL_TWIN_NOT_FOUND";
  constructor(message = "Requested Digital Twin entity was not found in your organization.") {
    super(message);
    this.name = "DigitalTwinNotFoundError";
  }
}

export interface TwinPublisher {
  publishTwinUpdate(orgId: string, subType: "DRONE" | "MISSION" | "FLEET" | "HEALTH_ALERT" | "RECONCILIATION_WARNING", payload: Record<string, unknown>): Promise<void>;
}
