import { IsIn, IsLatitude, IsLongitude, IsNumber, IsObject, IsOptional, IsPositive, IsString, MaxLength, MinLength } from "class-validator";

const PRIORITIES = ["STANDARD", "EXPRESS"] as const;

export class CreateSimulationScenarioDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsLatitude()
  originLat!: number;

  @IsLongitude()
  originLng!: number;

  @IsLatitude()
  destinationLat!: number;

  @IsLongitude()
  destinationLng!: number;

  @IsOptional()
  @IsString()
  droneId?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  payloadKg?: number;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];

  /** A what-if override for the weather the simulation evaluates against, instead of the real current reading — e.g. "what if it were storming at dispatch time." */
  @IsOptional()
  @IsObject()
  weatherOverride?: { windSpeedMps: number; precipitationMm: number; condition: "CLEAR" | "CLOUDY" | "RAIN" | "STORM" | "SNOW" | "FOG" };

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
