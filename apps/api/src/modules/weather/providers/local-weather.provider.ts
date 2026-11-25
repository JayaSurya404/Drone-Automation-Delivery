import { Injectable } from "@nestjs/common";
import type { WeatherCondition } from "@prisma/client";
import type { WeatherProvider, WeatherProviderReading } from "../weather-provider.interface";

/**
 * Deterministic, hash-seeded per zone — the same `zoneKey` always produces
 * the same baseline reading (never wall-clock/random), so tests are
 * reproducible without a fault-injection call, the same "deterministic
 * pull-based simulation" philosophy `SimulatedDroneAdapter` established in
 * Phase 6. The baseline is always calm/clear (light wind, no precipitation)
 * so the default demo mission flow is never randomly blocked — only an
 * explicit `setOverride()` (dev/test-only, mirrors
 * `SimulatedDroneAdapter.injectFault()`) or a future real provider produces
 * unsafe conditions.
 */
@Injectable()
export class LocalWeatherProvider implements WeatherProvider {
  private readonly overrides = new Map<string, Partial<WeatherProviderReading>>();

  async getCurrentWeather(_lat: number, _lng: number, zoneKey: string): Promise<WeatherProviderReading> {
    const baseline = deterministicBaseline(zoneKey);
    const override = this.overrides.get(zoneKey);
    return { ...baseline, ...override };
  }

  /** Dev/test-only fault injection — forces this zone's next reads to include these fields until `clearOverride()`. */
  setOverride(zoneKey: string, override: Partial<WeatherProviderReading>): void {
    this.overrides.set(zoneKey, override);
  }

  clearOverride(zoneKey: string): void {
    this.overrides.delete(zoneKey);
  }
}

function deterministicBaseline(zoneKey: string): WeatherProviderReading {
  const hash = hashString(zoneKey);
  return {
    windSpeedMps: 2 + (hash % 400) / 100, // 2.00 - 5.99 m/s — comfortably calm
    windDirectionDegrees: hash % 360,
    precipitationMm: 0,
    temperatureCelsius: 15 + (hash % 1000) / 100, // 15.00 - 24.99 C
    condition: "CLEAR" as WeatherCondition,
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}
