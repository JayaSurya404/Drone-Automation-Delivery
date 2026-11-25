import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../config/env.validation";
import { DronesModule } from "../drones/drones.module";
import { UsersModule } from "../users/users.module";
import { LocalWeatherProvider } from "./providers/local-weather.provider";
import { OpenMeteoProvider } from "./providers/open-meteo.provider";
import { WEATHER_PROVIDER } from "./weather-provider.interface";
import { WeatherController } from "./weather.controller";
import { WeatherService } from "./weather.service";

@Module({
  imports: [UsersModule, DronesModule, ConfigModule],
  controllers: [WeatherController],
  providers: [
    WeatherService,
    LocalWeatherProvider,
    OpenMeteoProvider,
    {
      provide: WEATHER_PROVIDER,
      inject: [ConfigService, LocalWeatherProvider, OpenMeteoProvider],
      useFactory: (configService: ConfigService<EnvConfig, true>, local: LocalWeatherProvider, openMeteo: OpenMeteoProvider) =>
        configService.get("WEATHER_PROVIDER", { infer: true }) === "open-meteo" ? openMeteo : local,
    },
  ],
  exports: [WeatherService, LocalWeatherProvider],
})
export class WeatherModule {}
