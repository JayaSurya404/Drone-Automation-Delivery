import { IsIn, IsISO8601, IsOptional, IsString } from "class-validator";

const PRIORITIES = ["STANDARD", "EXPRESS"] as const;

export class AssignHubDto {
  @IsString()
  hubId!: string;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];

  @IsOptional()
  @IsISO8601()
  scheduledWindowStart?: string;

  @IsOptional()
  @IsISO8601()
  scheduledWindowEnd?: string;
}
