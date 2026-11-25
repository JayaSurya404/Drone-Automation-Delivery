import type { WeatherCondition } from "@prisma/client";

/** The provider-supplied fields — everything `WeatherService` needs to persist a `WeatherSnapshot` row and evaluate safety, before the zone key/timestamp bookkeeping `WeatherService` itself owns. */
export interface WeatherProviderReading {
  windSpeedMps: number;
  windDirectionDegrees: number | null;
  precipitationMm: number;
  temperatureCelsius: number;
  condition: WeatherCondition;
}

/**
 * The `WeatherProvider` adapter interface (blueprint Section V) —
 * `WeatherService` (never business logic elsewhere) is the only caller,
 * exactly like `MissionsService` is the only caller of `DroneAdapter`.
 * `LocalWeatherProvider` is the real, deterministic implementation this
 * phase ships; `OpenMeteoProvider` is a deliberately unimplemented stub —
 * see its own file — selected via `WEATHER_PROVIDER=local|open-meteo`.
 */
export interface WeatherProvider {
  getCurrentWeather(lat: number, lng: number, zoneKey: string): Promise<WeatherProviderReading>;
}

/** DI token — `weather.module.ts` binds this to `LocalWeatherProvider` or `OpenMeteoProvider` based on `WEATHER_PROVIDER`. */
export const WEATHER_PROVIDER = Symbol("WEATHER_PROVIDER");
