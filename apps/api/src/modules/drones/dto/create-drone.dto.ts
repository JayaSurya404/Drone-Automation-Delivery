import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

const ADAPTER_TYPES = ["SIMULATED", "MAVLINK"] as const;

export class CreateDroneDto {
  @IsString()
  serialNumber!: string;

  @IsString()
  name!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsIn(ADAPTER_TYPES)
  adapterType?: (typeof ADAPTER_TYPES)[number];

  @IsOptional()
  @IsString()
  homeHubId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  batteryPercent?: number;

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
