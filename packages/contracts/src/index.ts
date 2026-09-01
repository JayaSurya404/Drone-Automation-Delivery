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
  "notifications:read",
  "notifications:manage",
  "audit:read",
  "users:manage",
  "org:manage",
  "digital-twin:read",
  "digital-twin:manage"
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
    "notifications:read",
    "notifications:manage",
    "audit:read",
    "users:manage",
    "org:manage",
    "digital-twin:read",
    "digital-twin:manage"
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
    "notifications:read",
    "notifications:manage",
    "audit:read",
    "digital-twin:read",
    "digital-twin:manage"
  ],
  FLEET_MANAGER: [
    "drones:read",
    "drones:create",
    "drones:command",
    "fleet:read",
    "fleet:manage",
    "telemetry:read",
    "notifications:read",
    "audit:read",
    "digital-twin:read",
    "digital-twin:manage"
  ],
  DISPATCHER: [
    "orders:read",
    "orders:create",
    "orders:update",
    "orders:cancel",
    "missions:read",
    "missions:create",
    "missions:authorize",
    "missions:command",
    "drones:read",
    "fleet:read",
    "geofences:read",
    "telemetry:read",
    "notifications:read",
    "audit:read",
    "digital-twin:read"
  ],
  CUSTOMER: [
    "orders:read",
    "orders:create",
    "orders:cancel",
    "notifications:read"
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
  email: z.string().trim().min(1, "Email or username is required"),
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
  "DRONE_EMERGENCY_TRIGGERED",
  "DRONE_EMERGENCY_CLEARED",
  "DRONE_RTH_REQUESTED",
  "MISSION_CANCEL_REQUESTED",
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
// Fleet Operations & Emergency Control Contracts
// ============================================================================

export const rthCommandRequestSchema = z.object({
  reason: z.string().trim().min(3, "RTH reason must be at least 3 characters").max(500).default("Operator commanded Return-To-Home")
});
export type RTHCommandRequest = z.infer<typeof rthCommandRequestSchema>;

export const emergencyCommandRequestSchema = z.object({
  reason: z.string().trim().min(3, "Emergency reason is required and must be at least 3 characters").max(500)
});
export type EmergencyCommandRequest = z.infer<typeof emergencyCommandRequestSchema>;

export const emergencyClearRequestSchema = z.object({
  reason: z.string().trim().max(500).optional()
});
export type EmergencyClearRequest = z.infer<typeof emergencyClearRequestSchema>;

export const cancelMissionRequestSchema = z.object({
  reason: z.string().trim().min(3, "Cancellation reason is required and must be at least 3 characters").max(500)
});
export type CancelMissionRequest = z.infer<typeof cancelMissionRequestSchema>;

export const operationalCommandResponseSchema = z.object({
  success: z.boolean(),
  command: z.enum(["RTH", "EMERGENCY", "EMERGENCY_CLEAR", "CANCEL_MISSION"]),
  targetId: uuidSchema,
  status: z.string(),
  message: z.string(),
  timestamp: z.string().datetime()
});
export type OperationalCommandResponse = z.infer<typeof operationalCommandResponseSchema>;

export const fleetSummaryResponseSchema = z.object({
  organizationId: uuidSchema,
  totalDrones: z.number().int().nonnegative(),
  availableDrones: z.number().int().nonnegative(),
  assignedDrones: z.number().int().nonnegative(),
  inFlightDrones: z.number().int().nonnegative(),
  deliveringDrones: z.number().int().nonnegative(),
  returningDrones: z.number().int().nonnegative(),
  emergencyDrones: z.number().int().nonnegative(),
  offlineDrones: z.number().int().nonnegative(),
  lowBatteryDrones: z.number().int().nonnegative(),
  criticalBatteryDrones: z.number().int().nonnegative(),
  timestamp: z.string().datetime()
});
export type FleetSummaryResponse = z.infer<typeof fleetSummaryResponseSchema>;

export const telemetryFreshnessSchema = z.enum(["LIVE", "DEGRADED", "STALE", "OFFLINE"]);
export type TelemetryFreshness = z.infer<typeof telemetryFreshnessSchema>;

export const droneDetailResponseSchema = droneResponseSchema.extend({
  freshness: telemetryFreshnessSchema,
  speedMetersPerSecond: z.number().nonnegative().optional(),
  headingDegrees: z.number().gte(0).lt(360).optional(),
  altitudeMeters: z.number().optional(),
  voltageVolts: z.number().optional(),
  activeMission: missionResponseSchema.nullable().optional(),
  activeOrder: orderResponseSchema.nullable().optional(),
  canRTH: z.boolean(),
  canEmergency: z.boolean(),
  canClearEmergency: z.boolean(),
  emergencyReason: z.string().nullable().optional()
});
export type DroneDetailResponse = z.infer<typeof droneDetailResponseSchema>;

export const waypointSchema = z.object({
  id: z.string(),
  sequence: z.number().int().nonnegative(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  altitudeMeters: z.number().nonnegative(),
  targetSpeedMps: z.number().nonnegative().optional(),
  isDeliveryPoint: z.boolean().optional()
});
export type WaypointDto = z.infer<typeof waypointSchema>;

export const missionDetailResponseSchema = missionResponseSchema.extend({
  order: orderResponseSchema.nullable().optional(),
  drone: droneResponseSchema.nullable().optional(),
  waypoints: z.array(waypointSchema),
  currentWaypointIndex: z.number().int().nonnegative().optional(),
  progressPercent: z.number().gte(0).lte(100),
  canCancel: z.boolean(),
  canRTH: z.boolean()
});
export type MissionDetailResponse = z.infer<typeof missionDetailResponseSchema>;

// ============================================================================
// Telemetry & Event Contracts
// ============================================================================

export const telemetrySchema = z.object({
  version: z.literal("v1").default("v1"),
  organizationId: organizationIdSchema,
  droneId: uuidSchema,
  missionId: uuidSchema.optional(),
  observedAt: z.string().datetime(),
  position: coordinateSchema,
  speedMetersPerSecond: z.number().nonnegative(),
  headingDegrees: z.number().gte(0).lt(360),
  batteryPercent: z.number().gte(0).lte(100),
  state: droneStatusSchema.optional(),
  currentWaypointIndex: z.number().int().nonnegative().optional(),
  totalWaypoints: z.number().int().nonnegative().optional(),
  distanceToTargetMeters: z.number().nonnegative().optional(),
  totalDistanceFlownMeters: z.number().nonnegative().optional(),
  emergencyReason: z.string().optional(),
  flightTimeSeconds: z.number().nonnegative().optional()
});
export type Telemetry = z.infer<typeof telemetrySchema>;

export const eventEnvelopeSchema = z.object({
  version: z.literal("v1").default("v1"),
  id: uuidSchema,
  occurredAt: z.string().datetime(),
  organizationId: organizationIdSchema,
  correlationId: uuidSchema,
  type: z.string().min(1),
  payload: z.unknown()
});
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

// ============================================================================
// Domain Events & Outbox Contracts
// ============================================================================

export const domainEventTypeSchema = z.enum([
  // Orders
  "ORDER_CREATED",
  "ORDER_CONFIRMED",
  "ORDER_ASSIGNED",
  "ORDER_IN_TRANSIT",
  "ORDER_DELIVERED",
  "ORDER_CANCELLED",
  "ORDER_FAILED",
  // Missions
  "MISSION_CREATED",
  "MISSION_ASSIGNED",
  "MISSION_LAUNCHED",
  "MISSION_IN_PROGRESS",
  "MISSION_DELIVERING",
  "MISSION_RETURNING",
  "MISSION_COMPLETED",
  "MISSION_CANCELLED",
  "MISSION_FAILED",
  "MISSION_EMERGENCY",
  // Drones
  "DRONE_REGISTERED",
  "DRONE_ASSIGNED",
  "DRONE_TAKEOFF",
  "DRONE_EN_ROUTE",
  "DRONE_ARRIVED",
  "DRONE_DELIVERING",
  "DRONE_RETURNING",
  "DRONE_LANDED",
  "DRONE_LOW_BATTERY",
  "DRONE_CRITICAL_BATTERY",
  "DRONE_EMERGENCY",
  "DRONE_MAINTENANCE",
  // System & Alerts
  "ALERT_TRIGGERED",
  "EMERGENCY_TRIGGERED",
  "EMERGENCY_CLEARED"
]);
export type DomainEventType = z.infer<typeof domainEventTypeSchema>;

export const domainEventEnvelopeSchema = z.object({
  id: uuidSchema,
  version: z.literal("v1").default("v1"),
  eventType: domainEventTypeSchema,
  occurredAt: z.string().datetime(),
  organizationId: organizationIdSchema,
  aggregateType: z.enum(["ORDER", "MISSION", "DRONE", "DELIVERY", "ALERT", "SYSTEM"]),
  aggregateId: uuidSchema,
  actorId: uuidSchema.nullable().optional(),
  payload: z.record(z.unknown()).default({})
});
export type DomainEventEnvelope = z.infer<typeof domainEventEnvelopeSchema>;

// ============================================================================
// Notification Contracts
// ============================================================================

export const notificationTypeSchema = z.enum([
  "ORDER_UPDATE",
  "MISSION_UPDATE",
  "DRONE_UPDATE",
  "DELIVERY_UPDATE",
  "EMERGENCY",
  "SYSTEM"
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSeveritySchema = z.enum([
  "INFO",
  "SUCCESS",
  "WARNING",
  "CRITICAL"
]);
export type NotificationSeverity = z.infer<typeof notificationSeveritySchema>;

export const notificationResponseSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  userId: uuidSchema.nullable().optional(),
  type: notificationTypeSchema,
  severity: notificationSeveritySchema,
  title: z.string(),
  message: z.string(),
  isRead: z.boolean(),
  readAt: z.string().datetime().nullable().optional(),
  aggregateType: z.string().nullable().optional(),
  aggregateId: uuidSchema.nullable().optional(),
  eventId: uuidSchema.nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.string().datetime()
});
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;

export const notificationListQuerySchema = z.object({
  isRead: z.preprocess((val) => {
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return val;
  }, z.boolean().optional()),
  type: notificationTypeSchema.optional(),
  severity: notificationSeveritySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export const notificationListResponseSchema = z.object({
  data: z.array(notificationResponseSchema),
  unreadCount: z.number().int().nonnegative(),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative()
  })
});
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;

// ============================================================================
// Realtime WebSocket Protocol Contracts
// ============================================================================

export const wsSubscriptionChannelSchema = z.enum([
  "telemetry:organization",
  "telemetry:drone",
  "telemetry:mission",
  "notifications:organization",
  "notifications:user"
]);
export type WsSubscriptionChannel = z.infer<typeof wsSubscriptionChannelSchema>;

export const wsClientAuthMessageSchema = z.object({
  type: z.literal("AUTH"),
  token: z.string().min(1)
});
export type WsClientAuthMessage = z.infer<typeof wsClientAuthMessageSchema>;

export const wsClientSubscribeMessageSchema = z.object({
  type: z.literal("SUBSCRIBE"),
  channel: wsSubscriptionChannelSchema,
  id: uuidSchema.optional()
});
export type WsClientSubscribeMessage = z.infer<typeof wsClientSubscribeMessageSchema>;

export const wsClientUnsubscribeMessageSchema = z.object({
  type: z.literal("UNSUBSCRIBE"),
  channel: wsSubscriptionChannelSchema,
  id: uuidSchema.optional()
});
export type WsClientUnsubscribeMessage = z.infer<typeof wsClientUnsubscribeMessageSchema>;

export const wsClientPingMessageSchema = z.object({
  type: z.literal("PING"),
  timestamp: z.string().optional()
});
export type WsClientPingMessage = z.infer<typeof wsClientPingMessageSchema>;

export const wsClientMessageSchema = z.discriminatedUnion("type", [
  wsClientAuthMessageSchema,
  wsClientSubscribeMessageSchema,
  wsClientUnsubscribeMessageSchema,
  wsClientPingMessageSchema
]);
export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

export const wsServerAuthenticatedMessageSchema = z.object({
  type: z.literal("AUTHENTICATED"),
  user: z.object({
    id: uuidSchema,
    email: z.string().email(),
    name: z.string(),
    organizationId: uuidSchema,
    organizationName: z.string(),
    role: userRoleSchema,
    permissions: z.array(permissionSchema)
  }),
  timestamp: z.string().datetime()
});

export const wsServerSubscribedMessageSchema = z.object({
  type: z.literal("SUBSCRIBED"),
  channel: z.string(),
  timestamp: z.string().datetime()
});

export const wsServerUnsubscribedMessageSchema = z.object({
  type: z.literal("UNSUBSCRIBED"),
  channel: z.string(),
  timestamp: z.string().datetime()
});

export const wsServerTelemetryMessageSchema = z.object({
  type: z.literal("TELEMETRY"),
  channel: z.string(),
  telemetry: telemetrySchema,
  timestamp: z.string().datetime()
});

export const wsServerNotificationMessageSchema = z.object({
  type: z.literal("NOTIFICATION"),
  channel: z.string(),
  notification: notificationResponseSchema,
  timestamp: z.string().datetime()
});

export const wsServerErrorMessageSchema = z.object({
  type: z.literal("ERROR"),
  code: z.string(),
  message: z.string(),
  timestamp: z.string().datetime()
});

export const wsServerPongMessageSchema = z.object({
  type: z.literal("PONG"),
  timestamp: z.string().datetime()
});

export const wsTwinUpdateMessageSchema = z.object({
  type: z.literal("TWIN_UPDATE"),
  channel: z.string(),
  subType: z.enum(["DRONE", "MISSION", "FLEET", "HEALTH_ALERT", "RECONCILIATION_WARNING"]),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime()
});

export const wsServerMessageSchema = z.discriminatedUnion("type", [
  wsServerAuthenticatedMessageSchema,
  wsServerSubscribedMessageSchema,
  wsServerUnsubscribedMessageSchema,
  wsServerTelemetryMessageSchema,
  wsServerNotificationMessageSchema,
  wsServerErrorMessageSchema,
  wsServerPongMessageSchema,
  wsTwinUpdateMessageSchema
]);
export type WsServerMessage = z.infer<typeof wsServerMessageSchema>;

// ============================================================================
// Geospatial Utilities & Helper Types
// ============================================================================
export * from "./geo.js";

// ============================================================================
// AI Advisory & Safety Gate Schemas
// ============================================================================
export * from "./ai.js";

// ============================================================================
// Computer Vision & Perception Schemas
// ============================================================================
export * from "./vision.js";

// ============================================================================
// Digital Twin Schemas & Types
// ============================================================================
export * from "./digital-twin.js";

