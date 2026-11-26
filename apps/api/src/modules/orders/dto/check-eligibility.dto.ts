import { IsNumber, IsOptional, Max, Min } from "class-validator";

export class CheckEligibilityDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(50)
  clearanceRadiusMeters?: number;
}
