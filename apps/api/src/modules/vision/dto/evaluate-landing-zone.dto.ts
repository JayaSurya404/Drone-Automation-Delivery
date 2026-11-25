import { IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class EvaluateLandingZoneDto {
  @IsOptional()
  @IsString()
  droneId?: string;

  @IsOptional()
  @IsString()
  missionId?: string;

  @IsOptional()
  @IsString()
  deliveryId?: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  altitudeMeters?: number;

  @IsOptional()
  @IsLatitude()
  targetLat?: number;

  @IsOptional()
  @IsLongitude()
  targetLng?: number;
}
