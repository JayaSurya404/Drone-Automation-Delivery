import { z } from "zod";

export const weatherConditionSchema = z.enum(["CLEAR", "CLOUDY", "RAIN", "STORM", "SNOW", "FOG"]);
export type WeatherCondition = z.infer<typeof weatherConditionSchema>;

export const weatherSnapshotSchema = z.object({
  zoneKey: z.string(),
  lat: z.number(),
  lng: z.number(),
  windSpeedMps: z.number(),
  windDirectionDegrees: z.number().nullable(),
  precipitationMm: z.number(),
  temperatureCelsius: z.number(),
  condition: weatherConditionSchema,
  source: z.string(),
  fetchedAt: z.string(),
});
export type WeatherSnapshot = z.infer<typeof weatherSnapshotSchema>;

export const hubWeatherResponseSchema = z.object({
  weather: weatherSnapshotSchema,
  safety: z.object({ level: z.enum(["SAFE", "CAUTION", "UNSAFE"]), reasons: z.array(z.string()) }),
});
export type HubWeatherResponse = z.infer<typeof hubWeatherResponseSchema>;
