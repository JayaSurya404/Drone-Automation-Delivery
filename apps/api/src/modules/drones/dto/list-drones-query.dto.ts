import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const DRONE_STATUSES = [
  "IDLE",
  "ASSIGNED",
  "ARMED",
  "IN_FLIGHT",
  "RETURNING",
  "LANDED",
  "CHARGING",
  "MAINTENANCE",
  "EMERGENCY",
  "OFFLINE",
] as const;

export class ListDronesQueryDto {
  @IsOptional()
  @IsIn(DRONE_STATUSES)
  status?: (typeof DRONE_STATUSES)[number];

  @IsOptional()
  @IsString()
  hubId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  availableOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
