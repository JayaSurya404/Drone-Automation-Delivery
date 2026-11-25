import { Controller, Get, NotFoundException, Param, UseGuards } from "@nestjs/common";
import { DronesService } from "../drones/drones.service";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { WeatherService } from "./weather.service";

@Controller("weather")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WeatherController {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly dronesService: DronesService,
  ) {}

  /** Admin/ops "current weather" view — a fulfillment hub is the natural zone (it's every mission's origin). */
  @Get("hubs/:hubId")
  @RequirePermission("weather.read")
  async getHubWeather(@Param("hubId") hubId: string) {
    const coords = await this.dronesService.getHubCoordinates(hubId);
    if (!coords) {
      throw new NotFoundException("Fulfillment hub not found or has no known location");
    }
    const weather = await this.weatherService.getCurrentWeather(coords.lat, coords.lng, this.weatherService.zoneKeyFor(coords.lat, coords.lng));
    const safety = this.weatherService.evaluateSafety(weather);
    return { weather, safety };
  }
}
