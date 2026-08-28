import { z } from "zod";

// ============================================================================
// Core Identifiers & Value Types
// ============================================================================

export const uuidSchema = z.string().uuid();
export const organizationIdSchema = uuidSchema;
export const userIdSchema = uuidSchema;

// ============================================================================
// Role-Based Access Control & Permissions
// ============================================================================

export const userRoleSchema = z.enum([
  "ADMIN",
  "OPERATOR",
  "CUSTOMER",
  "FLEET_MANAGER",
  "DISPATCHER"
]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const permissionSchema = z.enum([
  "orders:read",
  "orders:create",
  "orders:cancel",
  "missions:read",
  "missions:create",
  "missions:authorize",
  "missions:command",
  "drones:read",
  "drones:create",
  "drones:command",
  "fleet:read",
  "fleet:manage",
  "geofences:read",
  "geofences:modify",
  "telemetry:read",
  "telemetry:ingest",
  "audit:read",
  "users:manage",
  "org:manage"
]);
export type Permission = z.infer<typeof permissionSchema>;

// Role to default permissions mapping
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  ADMIN: [
    "orders:read",
    "orders:create",
    "orders:cancel",
    "missions:read",
    "missions:create",
    "missions:authorize",
    "missions:command",
    "drones:read",
    "drones:create",
    "drones:command",
    "fleet:read",
    "fleet:manage",
    "geofences:read",
    "geofences:modify",
    "telemetry:read",
    "telemetry:ingest",
    "audit:read",
    "users:manage",
    "org:manage"
  ],
  OPERATOR: [
    "orders:read",
    "missions:read",
    "missions:create",
    "missions:authorize",
    "missions:command",
    "drones:read",
    "drones:command",
    "fleet:read",
    "geofences:read",
    "geofences:modify",
    "telemetry:read",
    "telemetry:ingest",
    "audit:read"
  ],
  FLEET_MANAGER: [
    "drones:read",
    "drones:create",
    "drones:command",
    "fleet:read",
    "fleet:manage",
    "telemetry:read",
    "audit:read"
  ],
  DISPATCHER: [
    "orders:read",
    "orders:create",
    "orders:cancel",
    "missions:read",
    "missions:create",
    "drones:read",
    "fleet:read",
    "telemetry:read"
  ],
  CUSTOMER: [
    "orders:read",
    "orders:create",
    "orders:cancel",
    "telemetry:read"
  ]
} as const;

export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

// ============================================================================
// Authentication & Identity Contracts
// ============================================================================

export const registerRequestSchema = z.object({
  email: z.string().trim().email("Must be a valid email address").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().trim().min(1).max(100).optional(),
  organizationName: z.string().trim().min(2).max(100).optional()
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().trim().email("Must be a valid email address"),
  password: z.string().min(1, "Password is required"),
  organizationId: uuidSchema.optional()
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required").optional()
});
export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

export const authUserSummarySchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  name: z.string()
});
export type AuthUserSummary = z.infer<typeof authUserSummarySchema>;

export const authOrgSummarySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  role: userRoleSchema
});
export type AuthOrgSummary = z.infer<typeof authOrgSummarySchema>;

export const authResponseSchema = z.object({
  user: authUserSummarySchema,
  organization: authOrgSummarySchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().positive(),
  permissions: z.array(permissionSchema)
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const authenticatedUserSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  name: z.string(),
  organizationId: uuidSchema,
  organizationName: z.string(),
  role: userRoleSchema,
  permissions: z.array(permissionSchema)
});
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;

// ============================================================================
// Audit Logging Contracts
// ============================================================================

export const auditActionSchema = z.enum([
  "USER_REGISTERED",
  "USER_LOGGED_IN",
  "USER_LOGGED_OUT",
  "TOKEN_REFRESHED",
  "ROLE_ASSIGNED",
  "ORGANIZATION_CREATED",
  "ORGANIZATION_UPDATED",
  "ORDER_CREATED",
  "ORDER_CANCELLED",
  "MISSION_CREATED",
  "MISSION_AUTHORIZED",
  "MISSION_DISPATCHED",
  "EMERGENCY_COMMAND_ISSUED",
  "RETURN_TO_HOME_TRIGGERED",
  "GEOFENCE_CREATED",
  "GEOFENCE_MODIFIED"
]);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const auditLogEntrySchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  actorUserId: uuidSchema.nullable(),
  action: z.string(),
  resourceType: z.string().nullable().optional(),
  resourceId: uuidSchema.nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  correlationId: uuidSchema.nullable().optional(),
  createdAt: z.string().datetime()
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

// ============================================================================
// Standardized Problem Details (RFC 7807) Error Envelope
// ============================================================================

export const problemFieldViolationSchema = z.object({
  field: z.string(),
  message: z.string()
});
export type ProblemFieldViolation = z.infer<typeof problemFieldViolationSchema>;

export const problemDetailsSchema = z.object({
  type: z.string().url().or(z.string()),
  title: z.string(),
  status: z.number().int().gte(100).lte(599),
  detail: z.string(),
  instance: z.string().optional(),
  code: z.string().optional(),
  timestamp: z.string().datetime(),
  errors: z.array(problemFieldViolationSchema).optional()
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

// ============================================================================
// Existing Domain Statuses & Models
// ============================================================================

export const missionStatusSchema = z.enum([
  "PLANNED",
  "VALIDATING",
  "READY",
  "AUTHORIZED",
  "DISPATCHED",
  "IN_PROGRESS",
  "DELIVERED",
  "RETURNING",
  "COMPLETED",
  "ABORTED"
]);
export const orderStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "ASSIGNED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED"
]);
export const droneStatusSchema = z.enum([
  "AVAILABLE",
  "ASSIGNED",
  "IN_FLIGHT",
  "MAINTENANCE",
  "OFFLINE"
]);
export const coordinateSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  altitudeMeters: z.number().nonnegative().optional()
});
export const telemetrySchema = z.object({
  version: z.literal("v1"),
  organizationId: organizationIdSchema,
  droneId: uuidSchema,
  observedAt: z.string().datetime(),
  position: coordinateSchema,
  speedMetersPerSecond: z.number().nonnegative(),
  headingDegrees: z.number().gte(0).lt(360),
  batteryPercent: z.number().gte(0).lte(100)
});
export const eventEnvelopeSchema = z.object({
  version: z.literal("v1"),
  id: uuidSchema,
  occurredAt: z.string().datetime(),
  organizationId: organizationIdSchema,
  correlationId: uuidSchema,
  type: z.string().min(1),
  payload: z.unknown()
});

export type MissionStatus = z.infer<typeof missionStatusSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type DroneStatus = z.infer<typeof droneStatusSchema>;
export type Coordinate = z.infer<typeof coordinateSchema>;
export type Telemetry = z.infer<typeof telemetrySchema>;
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
