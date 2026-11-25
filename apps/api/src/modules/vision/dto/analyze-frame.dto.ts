import { IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class AnalyzeFrameDto {
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
}
