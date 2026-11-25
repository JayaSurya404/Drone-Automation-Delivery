import { z } from "zod";

export const geofenceTypeSchema = z.enum(["SERVICE_AREA", "NO_FLY", "RESTRICTED"]);
export type GeofenceType = z.infer<typeof geofenceTypeSchema>;

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof latLngSchema>;

export const geofenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: geofenceTypeSchema,
  description: z.string().nullable(),
  isActive: z.boolean(),
  points: z.array(latLngSchema),
  createdById: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Geofence = z.infer<typeof geofenceSchema>;

export const createGeofenceRequestSchema = z.object({
  name: z.string().min(1).max(120),
  type: geofenceTypeSchema,
  description: z.string().max(500).optional(),
  points: z.array(latLngSchema).min(3),
});
export type CreateGeofenceRequest = z.infer<typeof createGeofenceRequestSchema>;

export const updateGeofenceRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  points: z.array(latLngSchema).min(3).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateGeofenceRequest = z.infer<typeof updateGeofenceRequestSchema>;

export const geofenceListSchema = z.array(geofenceSchema);

export const geofenceCheckPointResultSchema = z.object({
  serviceArea: z.object({ inServiceArea: z.boolean(), zoneName: z.string().nullable(), hasServiceAreaZones: z.boolean() }),
  restrictedViolations: z.array(geofenceSchema),
});
export type GeofenceCheckPointResult = z.infer<typeof geofenceCheckPointResultSchema>;
