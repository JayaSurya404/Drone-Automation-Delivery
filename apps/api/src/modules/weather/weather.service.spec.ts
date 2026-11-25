import type { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../config/env.validation";
import type { PrismaService } from "../../prisma/prisma.service";
import type { WeatherProvider } from "./weather-provider.interface";
import { WeatherService } from "./weather.service";

const CONFIG_VALUES: Record<string, unknown> = {
  WEATHER_CACHE_TTL_MINUTES: 10,
  WEATHER_PROVIDER: "local",
  WEATHER_CAUTION_WIND_MPS: 8,
  WEATHER_UNSAFE_WIND_MPS: 12,
  WEATHER_CAUTION_PRECIPITATION_MM: 1.5,
  WEATHER_UNSAFE_PRECIPITATION_MM: 4,
};

function fakeSnapshotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "snap-1",
    zoneKey: "geo:44.98:-93.27",
    lat: 44.98,
    lng: -93.27,
    windSpeedMps: 3,
    windDirectionDegrees: 180,
    precipitationMm: 0,
    temperatureCelsius: 18,
    condition: "CLEAR",
    source: "LOCAL",
    fetchedAt: new Date(),
    ...overrides,
  };
}

describe("WeatherService", () => {
  let prisma: { weatherSnapshot: { findFirst: jest.Mock; create: jest.Mock } };
  let provider: { getCurrentWeather: jest.Mock };
  let service: WeatherService;

  beforeEach(() => {
    prisma = { weatherSnapshot: { findFirst: jest.fn(), create: jest.fn() } };
    provider = { getCurrentWeather: jest.fn() };
    const configService = { get: (key: string) => CONFIG_VALUES[key] } as unknown as ConfigService<EnvConfig, true>;
    service = new WeatherService(prisma as unknown as PrismaService, configService, provider as unknown as WeatherProvider);
  });

  describe("zoneKeyFor", () => {
    it("rounds coordinates into a coarse grid key", () => {
      expect(service.zoneKeyFor(44.97781, -93.26502)).toBe("geo:44.98:-93.27");
    });
  });

  describe("getCurrentWeather", () => {
    it("serves a fresh cache hit without calling the provider", async () => {
      prisma.weatherSnapshot.findFirst.mockResolvedValueOnce(fakeSnapshotRow({ fetchedAt: new Date() }));

      const result = await service.getCurrentWeather(44.98, -93.27, "geo:44.98:-93.27");

      expect(provider.getCurrentWeather).not.toHaveBeenCalled();
      expect(result.windSpeedMps).toBe(3);
    });

    it("fetches fresh and persists a new snapshot when the cache is stale", async () => {
      const stale = fakeSnapshotRow({ fetchedAt: new Date(Date.now() - 20 * 60_000) });
      prisma.weatherSnapshot.findFirst.mockResolvedValueOnce(stale);
      provider.getCurrentWeather.mockResolvedValueOnce({
        windSpeedMps: 9,
        windDirectionDegrees: 90,
        precipitationMm: 0.5,
        temperatureCelsius: 20,
        condition: "CLOUDY",
      });
      prisma.weatherSnapshot.create.mockResolvedValueOnce(fakeSnapshotRow({ windSpeedMps: 9, condition: "CLOUDY" }));

      const result = await service.getCurrentWeather(44.98, -93.27, "geo:44.98:-93.27");

      expect(provider.getCurrentWeather).toHaveBeenCalledWith(44.98, -93.27, "geo:44.98:-93.27");
      expect(prisma.weatherSnapshot.create).toHaveBeenCalledTimes(1);
      expect(result.windSpeedMps).toBe(9);
    });

    it("fetches fresh when there is no cached snapshot at all", async () => {
      prisma.weatherSnapshot.findFirst.mockResolvedValueOnce(null);
      provider.getCurrentWeather.mockResolvedValueOnce({
        windSpeedMps: 3,
        windDirectionDegrees: null,
        precipitationMm: 0,
        temperatureCelsius: 18,
        condition: "CLEAR",
      });
      prisma.weatherSnapshot.create.mockResolvedValueOnce(fakeSnapshotRow());

      await service.getCurrentWeather(44.98, -93.27, "geo:44.98:-93.27");
      expect(provider.getCurrentWeather).toHaveBeenCalledTimes(1);
    });

    it("bypasses a fresh cache entry when forceRefresh is set (explicit operator recheck)", async () => {
      prisma.weatherSnapshot.findFirst.mockResolvedValueOnce(fakeSnapshotRow({ fetchedAt: new Date() }));
      provider.getCurrentWeather.mockResolvedValueOnce({
        windSpeedMps: 1,
        windDirectionDegrees: null,
        precipitationMm: 0,
        temperatureCelsius: 20,
        condition: "CLEAR",
      });
      prisma.weatherSnapshot.create.mockResolvedValueOnce(fakeSnapshotRow({ windSpeedMps: 1 }));

      const result = await service.getCurrentWeather(44.98, -93.27, "geo:44.98:-93.27", { forceRefresh: true });

      expect(provider.getCurrentWeather).toHaveBeenCalledTimes(1);
      expect(prisma.weatherSnapshot.findFirst).not.toHaveBeenCalled();
      expect(result.windSpeedMps).toBe(1);
    });
  });

  describe("evaluateSafety", () => {
    it("delegates to evaluateWeatherSafety with the configured thresholds", () => {
      const unsafe = service.evaluateSafety({ windSpeedMps: 20, precipitationMm: 0, condition: "CLEAR" });
      expect(unsafe.level).toBe("UNSAFE");

      const safe = service.evaluateSafety({ windSpeedMps: 1, precipitationMm: 0, condition: "CLEAR" });
      expect(safe.level).toBe("SAFE");
    });
  });
});
