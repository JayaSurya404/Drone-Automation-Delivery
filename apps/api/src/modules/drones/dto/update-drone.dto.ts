import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdateDroneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  homeHubId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPayloadKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxRangeKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSpeedMps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAltitudeMeters?: number;
}
