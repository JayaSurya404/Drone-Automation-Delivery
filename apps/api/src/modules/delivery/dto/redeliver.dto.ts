import { IsISO8601, IsOptional } from "class-validator";

export class RedeliverDto {
  @IsOptional()
  @IsISO8601()
  scheduledWindowStart?: string;

  @IsOptional()
  @IsISO8601()
  scheduledWindowEnd?: string;
}
