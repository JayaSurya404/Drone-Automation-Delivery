import React from "react";
import { Badge, type BadgeVariant, type BadgeSize } from "./badge.js";
import type { OrderStatus, MissionStatus } from "@skynav/contracts";

export type DroneStatus =
  | "IDLE"
  | "ASSIGNED"
  | "TAKEOFF"
  | "EN_ROUTE"
  | "ARRIVED"
  | "DELIVERING"
  | "RETURNING"
  | "LANDED"
  | "EMERGENCY"
  | "OFFLINE";

export interface DroneStatusBadgeProps {
  status: DroneStatus | string;
  size?: BadgeSize;
  showDot?: boolean;
  className?: string;
}

export function DroneStatusBadge({
  status,
  size = "md",
  showDot = true,
  className = ""
}: DroneStatusBadgeProps) {
  const config: Record<DroneStatus | string, { label: string; variant: BadgeVariant; pulse: boolean }> = {
    IDLE: { label: "Idle / Ground", variant: "neutral", pulse: false },
    ASSIGNED: { label: "Assigned", variant: "primary", pulse: false },
    TAKEOFF: { label: "Ascending", variant: "info", pulse: true },
    EN_ROUTE: { label: "En Route", variant: "info", pulse: true },
    ARRIVED: { label: "At Destination", variant: "purple", pulse: true },
    DELIVERING: { label: "Delivering Drop", variant: "purple", pulse: true },
    RETURNING: { label: "Returning to Base", variant: "info", pulse: true },
    LANDED: { label: "Landed Complete", variant: "success", pulse: false },
    EMERGENCY: { label: "Emergency Hold", variant: "danger", pulse: true },
    OFFLINE: { label: "Offline", variant: "neutral", pulse: false }
  };

  const current = config[status] || { label: status, variant: "default" as BadgeVariant, pulse: false };

  return (
    <Badge
      variant={current.variant}
      size={size}
      dot={showDot}
      pulse={current.pulse}
      className={className}
    >
      {current.label}
    </Badge>
  );
}

export interface OrderStatusBadgeProps {
  status: OrderStatus | string;
  size?: BadgeSize;
  showDot?: boolean;
  className?: string;
}

export function OrderStatusBadge({
  status,
  size = "md",
  showDot = true,
  className = ""
}: OrderStatusBadgeProps) {
  const config: Record<OrderStatus | string, { label: string; variant: BadgeVariant; pulse: boolean }> = {
    DRAFT: { label: "Draft", variant: "neutral", pulse: false },
    SUBMITTED: { label: "Submitted", variant: "primary", pulse: false },
    ASSIGNED: { label: "Drone Assigned", variant: "info", pulse: false },
    IN_TRANSIT: { label: "In Flight", variant: "purple", pulse: true },
    DELIVERED: { label: "Delivered", variant: "success", pulse: false },
    CANCELLED: { label: "Cancelled", variant: "danger", pulse: false }
  };

  const current = config[status] || { label: status, variant: "default" as BadgeVariant, pulse: false };

  return (
    <Badge
      variant={current.variant}
      size={size}
      dot={showDot}
      pulse={current.pulse}
      className={className}
    >
      {current.label}
    </Badge>
  );
}

export interface MissionStatusBadgeProps {
  status: MissionStatus | string;
  size?: BadgeSize;
  showDot?: boolean;
  className?: string;
}

export function MissionStatusBadge({
  status,
  size = "md",
  showDot = true,
  className = ""
}: MissionStatusBadgeProps) {
  const config: Record<MissionStatus | string, { label: string; variant: BadgeVariant; pulse: boolean }> = {
    PLANNED: { label: "Planned", variant: "neutral", pulse: false },
    VALIDATING: { label: "Validating Corridor", variant: "warning", pulse: true },
    READY: { label: "Ready for Launch", variant: "primary", pulse: false },
    AUTHORIZED: { label: "Authorized", variant: "success", pulse: false },
    DISPATCHED: { label: "Dispatched", variant: "info", pulse: true },
    IN_PROGRESS: { label: "In Progress", variant: "purple", pulse: true },
    DELIVERED: { label: "Drop Completed", variant: "success", pulse: false },
    RETURNING: { label: "Returning", variant: "info", pulse: true },
    COMPLETED: { label: "Mission Complete", variant: "success", pulse: false },
    ABORTED: { label: "Aborted", variant: "danger", pulse: false }
  };

  const current = config[status] || { label: status, variant: "default" as BadgeVariant, pulse: false };

  return (
    <Badge
      variant={current.variant}
      size={size}
      dot={showDot}
      pulse={current.pulse}
      className={className}
    >
      {current.label}
    </Badge>
  );
}
