import { Injectable, NotImplementedException } from "@nestjs/common";
import type { WeatherProvider, WeatherProviderReading } from "../weather-provider.interface";

/**
 * A deliberate, fully-typed stub — every call throws rather than silently
 * returning fake data, exactly the `MavlinkDroneAdapter` precedent from
 * Phase 6: selecting `WEATHER_PROVIDER=open-meteo` fails loudly instead of
 * pretending to call a real weather service that was never integrated. The
 * phase-08 prompt names Open-Meteo specifically (free, no API key,
 * blueprint Section V) as the intended real implementation — this class is
 * that documented seam, not the implementation itself, per this session's
 * explicit "do not fabricate real external weather data as production data"
 * instruction.
 */
@Injectable()
export class OpenMeteoProvider implements WeatherProvider {
  async getCurrentWeather(_lat: number, _lng: number, _zoneKey: string): Promise<WeatherProviderReading> {
    throw new NotImplementedException(
      "OpenMeteoProvider is a documented future seam, not yet implemented — set WEATHER_PROVIDER=local for this environment.",
    );
  }
}
