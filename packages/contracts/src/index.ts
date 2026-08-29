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
  "orders:update",
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
    "orders:update",
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
    "orders:update",
    "orders:cancel",
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
    "orders:update",
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
  "ORDER_STATUS_UPDATED",
  "ORDER_CANCELLED",
  "ORDER_MODIFIED",
  "DRONE_REGISTERED",
  "DRONE_UPDATED",
  "DRONE_STATUS_UPDATED",
  "MISSION_CREATED",
  "MISSION_AUTHORIZED",
  "MISSION_DISPATCHED",
  "MISSION_ASSIGNED",
  "MISSION_STATUS_UPDATED",
  "MISSION_CANCELLED",
  "MISSION_COMPLETED",
  "MISSION_FAILED",
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
// Domain Enums & Value Objects
// ============================================================================

export const missionStatusSchema = z.enum([
  "PENDING",
  "PLANNED",
  "VALIDATING",
  "READY",
  "AUTHORIZED",
  "ASSIGNED",
  "LAUNCHING",
  "DISPATCHED",
  "IN_PROGRESS",
  "DELIVERING",
  "RETURNING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "EMERGENCY",
  "ABORTED"
]);
export type MissionStatus = z.infer<typeof missionStatusSchema>;

export const orderStatusSchema = z.enum([
  "CREATED",
  "CONFIRMED",
  "ASSIGNED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
  "DRAFT",
  "SUBMITTED"
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderPrioritySchema = z.enum([
  "STANDARD",
  "EXPRESS",
  "URGENT"
]);
export type OrderPriority = z.infer<typeof orderPrioritySchema>;

export const droneStatusSchema = z.enum([
  "IDLE",
  "AVAILABLE",
  "ASSIGNED",
  "TAKEOFF",
  "EN_ROUTE",
  "ARRIVED",
  "DELIVERING",
  "RETURNING",
  "LANDED",
  "MAINTENANCE",
  "EMERGENCY",
  "OFFLINE",
  "IN_FLIGHT"
]);
export type DroneStatus = z.infer<typeof droneStatusSchema>;

export const coordinateSchema = z.object({
  latitude: z.number().gte(-90, "Latitude must be between -90 and 90").lte(90, "Latitude must be between -90 and 90"),
  longitude: z.number().gte(-180, "Longitude must be between -180 and 180").lte(180, "Longitude must be between -180 and 180"),
  altitudeMeters: z.number().nonnegative("Altitude must be non-negative").optional().default(0)
});
export type Coordinate = z.infer<typeof coordinateSchema>;

export const orderLocationSchema = coordinateSchema.extend({
  address: z.string().trim().max(255).optional()
});
export type OrderLocation = z.infer<typeof orderLocationSchema>;

export const packageDetailsSchema = z.object({
  weightGrams: z
    .number()
    .int("Weight must be an integer in grams")
    .positive("Package weight must be greater than 0 grams")
    .max(50000, "Maximum package weight is 50,000 grams (50kg)"),
  lengthCm: z.number().positive("Length must be greater than 0").max(200, "Maximum length is 200cm").optional(),
  widthCm: z.number().positive("Width must be greater than 0").max(200, "Maximum width is 200cm").optional(),
  heightCm: z.number().positive("Height must be greater than 0").max(200, "Maximum height is 200cm").optional(),
  description: z.string().trim().max(500).optional()
});
export type PackageDetails = z.infer<typeof packageDetailsSchema>;

// ============================================================================
// Order Requests & Responses
// ============================================================================

export const createOrderRequestSchema = z.object({
  pickup: orderLocationSchema,
  delivery: orderLocationSchema,
  package: packageDetailsSchema,
  priority: orderPrioritySchema.default("STANDARD"),
  deliveryNotes: z.string().trim().max(1000).optional()
});
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const updateOrderStatusRequestSchema = z.object({
  status: orderStatusSchema,
  reason: z.string().trim().max(500).optional()
});
export type UpdateOrderStatusRequest = z.infer<typeof updateOrderStatusRequestSchema>;

export const cancelOrderRequestSchema = z.object({
  reason: z.string().trim().max(500).optional()
});
export type CancelOrderRequest = z.infer<typeof cancelOrderRequestSchema>;

export const orderResponseSchema = z.object({
  id: uuidSchema,
  orderNumber: z.string(),
  organizationId: uuidSchema,
  customerId: uuidSchema,
  status: orderStatusSchema,
  priority: orderPrioritySchema,
  pickup: orderLocationSchema,
  delivery: orderLocationSchema,
  package: packageDetailsSchema,
  deliveryNotes: z.string().nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
  cancelledAt: z.string().datetime().nullable().optional(),
  cancelledByUserId: uuidSchema.nullable().optional(),
  failureReason: z.string().nullable().optional(),
  failedAt: z.string().datetime().nullable().optional(),
  confirmedAt: z.string().datetime().nullable().optional(),
  assignedAt: z.string().datetime().nullable().optional(),
  deliveredAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type OrderResponse = z.infer<typeof orderResponseSchema>;

export const orderListQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  priority: orderPrioritySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

export const orderListResponseSchema = z.object({
  data: z.array(orderResponseSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative()
  })
});
export type OrderListResponse = z.infer<typeof orderListResponseSchema>;

// ============================================================================
// Fleet & Drone Requests & Responses
// ============================================================================

export const createDroneRequestSchema = z.object({
  callSign: z
    .string()
    .trim()
    .min(2, "Call sign must be at least 2 characters")
    .max(32, "Call sign cannot exceed 32 characters")
    .regex(/^[A-Za-z0-9-_]+$/, "Call sign may only contain letters, numbers, hyphens, and underscores"),
  model: z.string().trim().min(2).max(100).default("SkyNav Hexacopter Alpha"),
  serialNumber: z.string().trim().max(100).optional(),
  maxPayloadGrams: z.number().int().positive().max(50000).default(5000),
  batteryPercent: z.number().gte(0).lte(100).default(100),
  currentLocation: coordinateSchema.default({ latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 }),
  homeLocation: coordinateSchema.default({ latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 })
});
export type CreateDroneRequest = z.infer<typeof createDroneRequestSchema>;

export const updateDroneRequestSchema = z.object({
  callSign: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9-_]+$/)
    .optional(),
  model: z.string().trim().min(2).max(100).optional(),
  serialNumber: z.string().trim().max(100).nullable().optional(),
  maxPayloadGrams: z.number().int().positive().max(50000).optional(),
  status: droneStatusSchema.optional(),
  batteryPercent: z.number().gte(0).lte(100).optional(),
  currentLocation: coordinateSchema.optional(),
  homeLocation: coordinateSchema.optional(),
  isActive: z.boolean().optional()
});
export type UpdateDroneRequest = z.infer<typeof updateDroneRequestSchema>;

export const droneResponseSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  callSign: z.string(),
  model: z.string(),
  serialNumber: z.string().nullable().optional(),
  status: droneStatusSchema,
  batteryPercent: z.number(),
  maxPayloadGrams: z.number(),
  currentLocation: coordinateSchema,
  homeLocation: coordinateSchema,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type DroneResponse = z.infer<typeof droneResponseSchema>;

export const droneListQuerySchema = z.object({
  status: droneStatusSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
export type DroneListQuery = z.infer<typeof droneListQuerySchema>;

export const droneListResponseSchema = z.object({
  data: z.array(droneResponseSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative()
  })
});
export type DroneListResponse = z.infer<typeof droneListResponseSchema>;

// ============================================================================
// Mission Requests & Responses
// ============================================================================

export const createMissionRequestSchema = z.object({
  orderId: uuidSchema,
  origin: orderLocationSchema.optional(),
  destination: orderLocationSchema.optional()
});
export type CreateMissionRequest = z.infer<typeof createMissionRequestSchema>;

export const assignMissionRequestSchema = z.object({
  droneId: uuidSchema
});
export type AssignMissionRequest = z.infer<typeof assignMissionRequestSchema>;

export const updateMissionStatusRequestSchema = z.object({
  status: missionStatusSchema,
  reason: z.string().trim().max(500).optional()
});
export type UpdateMissionStatusRequest = z.infer<typeof updateMissionStatusRequestSchema>;

export const missionResponseSchema = z.object({
  id: uuidSchema,
  missionNumber: z.string(),
  organizationId: uuidSchema,
  orderId: uuidSchema,
  droneId: uuidSchema.nullable().optional(),
  status: missionStatusSchema,
  origin: orderLocationSchema,
  destination: orderLocationSchema,
  assignedAt: z.string().datetime().nullable().optional(),
  launchedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  cancelledAt: z.string().datetime().nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
  failedAt: z.string().datetime().nullable().optional(),
  failureReason: z.string().nullable().optional(),
  emergencyAt: z.string().datetime().nullable().optional(),
  emergencyReason: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type MissionResponse = z.infer<typeof missionResponseSchema>;

export const missionListQuerySchema = z.object({
  status: missionStatusSchema.optional(),
  orderId: uuidSchema.optional(),
  droneId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
export type MissionListQuery = z.infer<typeof missionListQuerySchema>;

export const missionListResponseSchema = z.object({
  data: z.array(missionResponseSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative()
  })
});
export type MissionListResponse = z.infer<typeof missionListResponseSchema>;

// ============================================================================
// Telemetry & Event Contracts
// ============================================================================

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
export type Telemetry = z.infer<typeof telemetrySchema>;

export const eventEnvelopeSchema = z.object({
  version: z.literal("v1"),
  id: uuidSchema,
  occurredAt: z.string().datetime(),
  organizationId: organizationIdSchema,
  correlationId: uuidSchema,
  type: z.string().min(1),
  payload: z.unknown()
});
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
