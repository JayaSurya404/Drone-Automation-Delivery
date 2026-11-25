import { z } from "zod";

export const droneAdapterTypeSchema = z.enum(["SIMULATED", "MAVLINK"]);
export type DroneAdapterType = z.infer<typeof droneAdapterTypeSchema>;

export const droneStatusSchema = z.enum([
  "IDLE",
  "ASSIGNED",
  "ARMED",
  "IN_FLIGHT",
  "RETURNING",
  "LANDED",
  "CHARGING",
  "MAINTENANCE",
  "EMERGENCY",
  "OFFLINE",
]);
export type DroneStatus = z.infer<typeof droneStatusSchema>;

export const droneSchema = z.object({
  id: z.string(),
  serialNumber: z.string(),
  name: z.string(),
  model: z.string(),
  adapterType: droneAdapterTypeSchema,
  status: droneStatusSchema,
  homeHubId: z.string().nullable(),
  batteryPercent: z.number(),
  batteryHealthPercent: z.number(),
  batteryCycles: z.number(),
  currentLat: z.number().nullable(),
  currentLng: z.number().nullable(),
  altitudeMeters: z.number().nullable(),
  speedMps: z.number().nullable(),
  headingDegrees: z.number().nullable(),
  signalStrengthPercent: z.number().nullable(),
  maxPayloadKg: z.number(),
  maxRangeKm: z.number(),
  maxSpeedMps: z.number(),
  maxAltitudeMeters: z.number(),
  isMaintenanceMode: z.boolean(),
  maintenanceNote: z.string().nullable(),
  lastTelemetryAt: z.string().nullable(),
  totalFlightHours: z.number(),
  totalMissionsCompleted: z.number(),
  createdAt: z.string(),
});
export type Drone = z.infer<typeof droneSchema>;

export const paginatedDronesSchema = z.object({
  drones: z.array(droneSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type PaginatedDrones = z.infer<typeof paginatedDronesSchema>;

export const fleetOverviewSchema = z.object({
  totalDrones: z.number(),
  byStatus: z.record(z.string(), z.number()),
  averageBatteryPercent: z.number(),
});
export type FleetOverview = z.infer<typeof fleetOverviewSchema>;

export const createDroneRequestSchema = z.object({
  serialNumber: z.string(),
  name: z.string(),
  model: z.string(),
  adapterType: droneAdapterTypeSchema.optional(),
  homeHubId: z.string().optional(),
  batteryPercent: z.number().min(0).max(100).optional(),
  maxPayloadKg: z.number().min(0).optional(),
  maxRangeKm: z.number().min(0).optional(),
  maxSpeedMps: z.number().min(0).optional(),
  maxAltitudeMeters: z.number().min(0).optional(),
});
export type CreateDroneRequest = z.infer<typeof createDroneRequestSchema>;

export const updateDroneRequestSchema = z.object({
  name: z.string().optional(),
  model: z.string().optional(),
  homeHubId: z.string().optional(),
  maxPayloadKg: z.number().min(0).optional(),
  maxRangeKm: z.number().min(0).optional(),
  maxSpeedMps: z.number().min(0).optional(),
  maxAltitudeMeters: z.number().min(0).optional(),
});
export type UpdateDroneRequest = z.infer<typeof updateDroneRequestSchema>;

export const setMaintenanceRequestSchema = z.object({
  enabled: z.boolean(),
  note: z.string().optional(),
});
export type SetMaintenanceRequest = z.infer<typeof setMaintenanceRequestSchema>;
