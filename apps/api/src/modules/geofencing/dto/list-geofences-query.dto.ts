import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsOptional } from "class-validator";

const GEOFENCE_TYPES = ["SERVICE_AREA", "NO_FLY", "RESTRICTED"] as const;

export class ListGeofencesQueryDto {
  @IsOptional()
  @IsIn(GEOFENCE_TYPES)
  type?: (typeof GEOFENCE_TYPES)[number];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
