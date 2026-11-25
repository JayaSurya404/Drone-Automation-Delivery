import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class IngestTelemetryDto {
  @IsString()
  droneId!: string;

  @IsOptional()
  @IsString()
  missionId?: string;

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsNumber()
  altitudeMeters?: number;

  @IsOptional()
  @IsNumber()
  speedMps?: number;

  @IsOptional()
  @IsNumber()
  headingDegrees?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  batteryPercent!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  signalStrengthPercent?: number;
}
