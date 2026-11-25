import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { IngestTelemetryDto } from "./dto/ingest-telemetry.dto";
import { ServiceAuthGuard } from "./guards/service-auth.guard";
import { TelemetryService } from "./telemetry.service";

@Controller()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  /**
   * Service-authenticated only (`X-Service-Api-Key`) — never a user JWT.
   * See `ServiceAuthGuard`.
   *
   * Phase 12 fix — found via the k6/load-test pass (`load-tests/telemetry-ingest.js`):
   * this endpoint previously inherited the app's global 100-req/min-per-IP
   * throttle (`app.module.ts`'s default `ThrottlerGuard`, intended for
   * brute-force protection on user-facing endpoints). A realistic 50-drone
   * fleet ticking every `DRONE_SIMULATION_TICK_MS` (default 4s) needs 750
   * req/min just for telemetry — 7.5x over that limit — so real telemetry
   * was being silently 429-rejected once the default limit was exhausted,
   * which is actively dangerous for a safety-relevant data path (a dropped
   * low-battery/position sample is not a cosmetic gap). This endpoint
   * doesn't need brute-force protection the way login/password-reset do —
   * it's already gated by a service credential, not a guessable
   * user/password pair — so it gets its own much higher, still-bounded
   * limit instead of the user-facing default.
   */
  @Post("internal/telemetry")
  @UseGuards(ServiceAuthGuard)
  @Throttle({ default: { limit: 2000, ttl: 60_000 } })
  async ingest(@Body() dto: IngestTelemetryDto) {
    return this.telemetryService.ingest(dto);
  }

  @Get("telemetry/drones/:droneId/latest")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("telemetry.read")
  async latest(@Param("droneId") droneId: string) {
    return this.telemetryService.getLatest(droneId);
  }

  @Get("telemetry/drones/:droneId/history")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("telemetry.read")
  async history(@Param("droneId") droneId: string, @Query("limit") limit?: string) {
    return this.telemetryService.getHistory(droneId, limit ? Number(limit) : undefined);
  }
}
