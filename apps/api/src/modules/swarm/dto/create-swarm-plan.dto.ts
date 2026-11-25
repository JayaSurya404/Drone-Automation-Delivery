import { Type } from "class-transformer";
import { ArrayMinSize, IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsPositive, IsString, MaxLength, ValidateNested } from "class-validator";

const PRIORITIES = ["STANDARD", "EXPRESS"] as const;

export class SwarmPlanTargetDto {
  @IsOptional()
  @IsString()
  deliveryId?: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsNumber()
  @IsPositive()
  payloadKg!: number;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];
}

export class CreateSwarmPlanDto {
  @IsString()
  @MaxLength(200)
  objective!: string;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SwarmPlanTargetDto)
  targets!: SwarmPlanTargetDto[];
}
