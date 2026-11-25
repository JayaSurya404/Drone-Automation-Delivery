import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WeatherCondition, WeatherSnapshot } from "@prisma/client";
import type { EnvConfig } from "../../config/env.validation";
import { PrismaService } from "../../prisma/prisma.service";
import { WEATHER_PROVIDER, type WeatherProvider } from "./weather-provider.interface";
import { evaluateWeatherSafety, type WeatherSafetyResult, type WeatherThresholds } from "./weather-safety.util";

export interface WeatherSnapshotView {
  zoneKey: string;
  lat: number;
  lng: number;
  windSpeedMps: number;
  windDirectionDegrees: number | null;
  precipitationMm: number;
  temperatureCelsius: number;
  condition: WeatherCondition;
  source: string;
  fetchedAt: string;
}

/**
 * Wraps the `WeatherProvider` adapter with per-zone caching (append-only —
 * see `WeatherSnapshot`'s schema doc) and the safety evaluation callers
 * actually need. `MissionsService` and `WeatherController` are the only
 * consumers; neither talks to a `WeatherProvider` directly.
 */
@Injectable()
export class WeatherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig, true>,
    @Inject(WEATHER_PROVIDER) private readonly provider: WeatherProvider,
  ) {}

  /** A coarse (~1.1km) grid key so nearby points (e.g. a drone's telemetry ticks along a short route) share one cached reading instead of each minting its own. */
  zoneKeyFor(lat: number, lng: number): string {
    return `geo:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  }

  /**
   * `forceRefresh` bypasses the cache TTL entirely — used only by an
   * explicit operator "recheck" action (`MissionsService.recheckSafety`).
   * Without it, a recheck immediately after clearing an unsafe condition
   * could still read back the stale cached unsafe snapshot for up to
   * `WEATHER_CACHE_TTL_MINUTES`, defeating the point of asking "is it safe
   * right now" — every other caller (mission creation, `start()`'s gate,
   * in-flight ticks) intentionally keeps using the cache to avoid hammering
   * the provider on a normal polling cadence.
   */
  async getCurrentWeather(lat: number, lng: number, zoneKey: string, options?: { forceRefresh?: boolean }): Promise<WeatherSnapshotView> {
    const ttlMinutes = this.configService.get("WEATHER_CACHE_TTL_MINUTES", { infer: true });
    if (!options?.forceRefresh) {
      const cached = await this.prisma.weatherSnapshot.findFirst({ where: { zoneKey }, orderBy: { fetchedAt: "desc" } });
      if (cached && cached.fetchedAt.getTime() > Date.now() - ttlMinutes * 60_000) {
        return this.toView(cached);
      }
    }

    const reading = await this.provider.getCurrentWeather(lat, lng, zoneKey);
    const source = this.configService.get("WEATHER_PROVIDER", { infer: true }) === "open-meteo" ? "OPEN_METEO" : "LOCAL";
    const saved = await this.prisma.weatherSnapshot.create({
      data: {
        zoneKey,
        lat,
        lng,
        windSpeedMps: reading.windSpeedMps,
        windDirectionDegrees: reading.windDirectionDegrees,
        precipitationMm: reading.precipitationMm,
        temperatureCelsius: reading.temperatureCelsius,
        condition: reading.condition,
        source,
      },
    });
    return this.toView(saved);
  }

  evaluateSafety(weather: { windSpeedMps: number; precipitationMm: number; condition: WeatherCondition }): WeatherSafetyResult {
    return evaluateWeatherSafety(weather, this.getThresholds());
  }

  getThresholds(): WeatherThresholds {
    return {
      cautionWindMps: this.configService.get("WEATHER_CAUTION_WIND_MPS", { infer: true }),
      unsafeWindMps: this.configService.get("WEATHER_UNSAFE_WIND_MPS", { infer: true }),
      cautionPrecipitationMm: this.configService.get("WEATHER_CAUTION_PRECIPITATION_MM", { infer: true }),
      unsafePrecipitationMm: this.configService.get("WEATHER_UNSAFE_PRECIPITATION_MM", { infer: true }),
      unsafeConditions: ["STORM", "SNOW"],
      cautionConditions: ["FOG", "RAIN"],
    };
  }

  private toView(row: WeatherSnapshot): WeatherSnapshotView {
    return {
      zoneKey: row.zoneKey,
      lat: row.lat,
      lng: row.lng,
      windSpeedMps: row.windSpeedMps,
      windDirectionDegrees: row.windDirectionDegrees,
      precipitationMm: row.precipitationMm,
      temperatureCelsius: row.temperatureCelsius,
      condition: row.condition,
      source: row.source,
      fetchedAt: row.fetchedAt.toISOString(),
    };
  }
}
