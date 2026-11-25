import { z } from "zod";

export const deliveryStatusSchema = z.enum([
  "PENDING_ASSIGNMENT",
  "HUB_ASSIGNED",
  "MISSION_PLANNED",
  "DRONE_DISPATCHED",
  "IN_TRANSIT",
  "ARRIVED_AT_DESTINATION",
  "DELIVERED_PENDING_VERIFICATION",
  "COMPLETED",
  "VERIFICATION_FAILED",
  "REDELIVERY_SCHEDULED",
  "CANCELLED",
  "RETURNED_TO_HUB",
]);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export const deliveryPrioritySchema = z.enum(["STANDARD", "EXPRESS"]);
export type DeliveryPriority = z.infer<typeof deliveryPrioritySchema>;

export const deliveryVerificationMethodSchema = z.enum(["OTP", "QR"]);
export type DeliveryVerificationMethod = z.infer<typeof deliveryVerificationMethodSchema>;

export const deliveryEventSchema = z.object({
  id: z.string(),
  fromStatus: deliveryStatusSchema.nullable(),
  toStatus: deliveryStatusSchema,
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type DeliveryEvent = z.infer<typeof deliveryEventSchema>;

export const deliverySummarySchema = z.object({
  id: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  status: deliveryStatusSchema,
  priority: deliveryPrioritySchema,
  hubId: z.string().nullable(),
  hubName: z.string().nullable(),
  estimatedDeliveryAt: z.string().nullable(),
  createdAt: z.string(),
});
export type DeliverySummary = z.infer<typeof deliverySummarySchema>;

export const proofOfDeliverySchema = z.object({
  method: deliveryVerificationMethodSchema,
  verifiedAt: z.string(),
  recipientNote: z.string().nullable(),
  imageUrl: z.string().nullable(),
});

export const deliveryDetailSchema = deliverySummarySchema.extend({
  deliveryAddress: z.unknown(),
  specialInstructions: z.string().nullable(),
  scheduledWindowStart: z.string().nullable(),
  scheduledWindowEnd: z.string().nullable(),
  verificationExpiresAt: z.string().nullable(),
  verificationAttempts: z.number(),
  verifiedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  itemSummary: z.string(),
  missionId: z.string().nullable(),
  missionStatus: z.string().nullable(),
  missionSafetyState: z.string().nullable(),
  events: z.array(deliveryEventSchema),
  proofOfDelivery: proofOfDeliverySchema.nullable(),
});
export type DeliveryDetail = z.infer<typeof deliveryDetailSchema>;

export const paginatedDeliveriesSchema = z.object({
  deliveries: z.array(deliverySummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type PaginatedDeliveries = z.infer<typeof paginatedDeliveriesSchema>;

export const assignHubRequestSchema = z.object({
  hubId: z.string(),
  priority: deliveryPrioritySchema.optional(),
  scheduledWindowStart: z.string().optional(),
  scheduledWindowEnd: z.string().optional(),
});
export type AssignHubRequest = z.infer<typeof assignHubRequestSchema>;

export const advanceStatusRequestSchema = z.object({
  note: z.string().max(500).optional(),
});
export type AdvanceStatusRequest = z.infer<typeof advanceStatusRequestSchema>;

export const cancelDeliveryRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type CancelDeliveryRequest = z.infer<typeof cancelDeliveryRequestSchema>;

export const redeliverRequestSchema = z.object({
  scheduledWindowStart: z.string().optional(),
  scheduledWindowEnd: z.string().optional(),
});
export type RedeliverRequest = z.infer<typeof redeliverRequestSchema>;

export const verifyDeliveryRequestSchema = z.object({
  code: z.string().length(6),
  method: deliveryVerificationMethodSchema,
});
export type VerifyDeliveryRequest = z.infer<typeof verifyDeliveryRequestSchema>;

export const deliveryTrackingDroneSchema = z.object({
  id: z.string(),
  name: z.string(),
  batteryPercent: z.number(),
  currentLat: z.number().nullable(),
  currentLng: z.number().nullable(),
  altitudeMeters: z.number().nullable(),
  speedMps: z.number().nullable(),
  headingDegrees: z.number().nullable(),
  signalStrengthPercent: z.number().nullable(),
  lastTelemetryAt: z.string().nullable(),
});
export type DeliveryTrackingDrone = z.infer<typeof deliveryTrackingDroneSchema>;

export const deliveryTrackingWaypointSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  lat: z.number(),
  lng: z.number(),
  status: z.string(),
});

/** Phase 7 — a customer-safe subset of mission/drone state, never the full staff `MissionDetail`/`Drone` shapes. See `DeliveryService.getTrackingSnapshot`. */
export const deliveryTrackingSchema = z.object({
  deliveryId: z.string(),
  deliveryStatus: deliveryStatusSchema,
  estimatedDeliveryAt: z.string().nullable(),
  mission: z
    .object({
      id: z.string(),
      status: z.string(),
      safetyState: z.string(),
      originLat: z.number(),
      originLng: z.number(),
      destinationLat: z.number(),
      destinationLng: z.number(),
      waypoints: z.array(deliveryTrackingWaypointSchema),
      drone: deliveryTrackingDroneSchema.nullable(),
    })
    .nullable(),
});
export type DeliveryTracking = z.infer<typeof deliveryTrackingSchema>;

export const verificationCodeResponseSchema = z.object({
  code: z.string(),
  qrPayload: z.string(),
  expiresAt: z.string(),
});
export type VerificationCodeResponse = z.infer<typeof verificationCodeResponseSchema>;
