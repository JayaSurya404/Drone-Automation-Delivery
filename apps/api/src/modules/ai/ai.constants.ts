/**
 * Fallback assumptions used only when the real value isn't known yet (no
 * drone assigned, no payload-weight field anywhere in the schema) — each
 * matches the corresponding `Drone` column's own schema default
 * (`schema.prisma`) so an early, drone-agnostic estimate and the real
 * per-drone figure computed later don't disagree for no reason.
 */
export const DEFAULT_DRONE_MAX_SPEED_MPS = 15;
export const DEFAULT_DRONE_MAX_RANGE_KM = 10;
/** This app has no package-weight field anywhere in the order/delivery schema — the same "documented deterministic placeholder" pattern as `resolveDeterministicDestination()` (Phase 6). */
export const DEFAULT_PAYLOAD_KG = 1;
