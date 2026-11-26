import { Controller, Get } from "@nestjs/common";
import { GeofencingService } from "./geofencing.service";

@Controller("airspace")
export class AirspaceController {
  constructor(private readonly geofencingService: GeofencingService) {}

  @Get("zones")
  async getZones() {
    return this.geofencingService.getPublicAirspaceZones();
  }
}
