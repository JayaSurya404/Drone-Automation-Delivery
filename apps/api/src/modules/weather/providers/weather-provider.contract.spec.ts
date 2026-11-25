import type { WeatherProvider } from "../weather-provider.interface";
import { LocalWeatherProvider } from "./local-weather.provider";

/**
 * Shared contract test suite for any `WeatherProvider` implementation —
 * would pass unchanged against a future real implementation, the same
 * `drone-adapter.contract.spec.ts` precedent from Phase 6. `OpenMeteoProvider`
 * is a deliberate always-throws stub (see its own file) and is intentionally
 * NOT run through this suite — a contract suite proves an implementation
 * behaves like a real provider, which a stub that throws on every call
 * cannot; its own spec file proves the opposite (every call rejects).
 */
function runWeatherProviderContractTests(name: string, createProvider: () => WeatherProvider) {
  describe(`WeatherProvider contract — ${name}`, () => {
    it("resolves a reading with all interface fields present", async () => {
      const provider = createProvider();
      const reading = await provider.getCurrentWeather(44.9778, -93.265, "contract-zone-1");

      expect(typeof reading.windSpeedMps).toBe("number");
      expect(typeof reading.precipitationMm).toBe("number");
      expect(typeof reading.temperatureCelsius).toBe("number");
      expect(["CLEAR", "CLOUDY", "RAIN", "STORM", "SNOW", "FOG"]).toContain(reading.condition);
    });

    it("returns non-negative wind speed and precipitation", async () => {
      const provider = createProvider();
      const reading = await provider.getCurrentWeather(0, 0, "contract-zone-2");

      expect(reading.windSpeedMps).toBeGreaterThanOrEqual(0);
      expect(reading.precipitationMm).toBeGreaterThanOrEqual(0);
    });

    it("keeps wind direction within a valid compass range when present", async () => {
      const provider = createProvider();
      const reading = await provider.getCurrentWeather(10, 10, "contract-zone-3");

      if (reading.windDirectionDegrees !== null) {
        expect(reading.windDirectionDegrees).toBeGreaterThanOrEqual(0);
        expect(reading.windDirectionDegrees).toBeLessThan(360);
      }
    });

    it("is deterministic for a fixed zone key across repeated calls", async () => {
      const provider = createProvider();
      const first = await provider.getCurrentWeather(44.9778, -93.265, "contract-zone-stable");
      const second = await provider.getCurrentWeather(44.9778, -93.265, "contract-zone-stable");

      expect(second).toEqual(first);
    });

    it("varies between distinct zone keys (not a single constant reading)", async () => {
      const provider = createProvider();
      const a = await provider.getCurrentWeather(0, 0, "contract-zone-a");
      const b = await provider.getCurrentWeather(0, 0, "contract-zone-b");

      expect(a).not.toEqual(b);
    });
  });
}

runWeatherProviderContractTests("LocalWeatherProvider", () => new LocalWeatherProvider());
