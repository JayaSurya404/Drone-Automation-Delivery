import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const MISSION_STATUSES = ["PLANNED", "DISPATCHED", "IN_PROGRESS", "RETURNING", "COMPLETED", "ABORTED"] as const;
const MISSION_SAFETY_STATES = ["NOMINAL", "LOW_BATTERY", "SIGNAL_LOSS", "EMERGENCY", "WEATHER_HOLD", "GEOFENCE_BREACH"] as const;

export class ListMissionsQueryDto {
  @IsOptional()
  @IsIn(MISSION_STATUSES)
  status?: (typeof MISSION_STATUSES)[number];

  /** Phase 8 — lets the admin "blocked missions" view filter directly to `WEATHER_HOLD`/`GEOFENCE_BREACH` without a new endpoint. */
  @IsOptional()
  @IsIn(MISSION_SAFETY_STATES)
  safetyState?: (typeof MISSION_SAFETY_STATES)[number];

  @IsOptional()
  @IsString()
  droneId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
