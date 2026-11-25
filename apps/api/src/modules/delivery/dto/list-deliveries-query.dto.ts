import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const DELIVERY_STATUSES = [
  "PENDING_ASSIGNMENT",
  "HUB_ASSIGNED",
  "MISSION_PLANNED",
  "DRONE_DISPATCHED",
  "IN_TRANSIT",
  "ARRIVED_AT_DESTINATION",
  "DELIVERED_PENDING_VERIFICATION",
  "COMPLETED",
  "VERIFICATION_FAILED",
  "REDELIVERY_SCHEDULED",
  "CANCELLED",
  "RETURNED_TO_HUB",
] as const;

export class ListDeliveriesQueryDto {
  @IsOptional()
  @IsIn(DELIVERY_STATUSES)
  status?: (typeof DELIVERY_STATUSES)[number];

  @IsOptional()
  @IsString()
  hubId?: string;

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
