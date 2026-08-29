import type { OrderStatus } from "@skynav/contracts";

export class InvalidOrderStateTransitionError extends Error {
  public readonly code = "INVALID_ORDER_STATE_TRANSITION";
  public readonly currentStatus: OrderStatus;
  public readonly targetStatus: OrderStatus;

  constructor(currentStatus: OrderStatus, targetStatus: OrderStatus, reason?: string) {
    const msg = reason ?? `Cannot transition order from status '${currentStatus}' to '${targetStatus}'.`;
    super(msg);
    this.name = "InvalidOrderStateTransitionError";
    this.currentStatus = currentStatus;
    this.targetStatus = targetStatus;
  }
}

/**
 * Permitted forward state transitions for the Order lifecycle:
 *
 * CREATED → CONFIRMED → ASSIGNED → IN_TRANSIT → DELIVERED
 *    ↓          ↓          ↓           ↓
 * CANCELLED  CANCELLED  CANCELLED    FAILED
 *                           ↓
 *                         FAILED
 */
const LEGAL_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  CREATED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_TRANSIT", "CANCELLED", "FAILED"],
  IN_TRANSIT: ["DELIVERED", "FAILED"],
  DELIVERED: [], // Terminal state
  CANCELLED: [], // Terminal state
  FAILED: [],    // Terminal state
  DRAFT: ["CREATED", "SUBMITTED", "CANCELLED"], // Backward-compatibility alias
  SUBMITTED: ["CONFIRMED", "ASSIGNED", "CANCELLED"] // Backward-compatibility alias
};

/**
 * Validates that an order state transition is legal according to safety rules.
 * Throws InvalidOrderStateTransitionError if the transition is prohibited.
 */
export function validateOrderStateTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): void {
  if (currentStatus === targetStatus) {
    return; // No-op transition is permitted
  }

  const allowed = LEGAL_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    throw new InvalidOrderStateTransitionError(currentStatus, targetStatus);
  }
}

/**
 * Check whether an order status is terminal (cannot transition to any other status).
 */
export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return (LEGAL_TRANSITIONS[status] ?? []).length === 0;
}

/**
 * Customers can only cancel orders in initial non-dispatched states.
 */
export function canCustomerCancelOrder(status: OrderStatus): boolean {
  return status === "CREATED" || status === "CONFIRMED" || status === "DRAFT" || status === "SUBMITTED";
}

/**
 * Platform operators and dispatchers can cancel orders as long as they are not terminal.
 */
export function canOperatorCancelOrder(status: OrderStatus): boolean {
  return !isTerminalOrderStatus(status);
}
