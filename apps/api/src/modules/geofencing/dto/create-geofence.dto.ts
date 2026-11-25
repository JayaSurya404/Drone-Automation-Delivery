import { Type } from "class-transformer";
import { ArrayMinSize, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { LatLngDto } from "./lat-lng.dto";

const GEOFENCE_TYPES = ["SERVICE_AREA", "NO_FLY", "RESTRICTED"] as const;

export class CreateGeofenceDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(GEOFENCE_TYPES)
  type!: (typeof GEOFENCE_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => LatLngDto)
  points!: LatLngDto[];
}
