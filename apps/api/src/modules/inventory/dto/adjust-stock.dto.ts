import { IsIn, IsInt, IsOptional, IsString, MaxLength, NotEquals } from "class-validator";

const REASON_TYPES = ["RECEIPT", "SALE", "ADJUSTMENT", "RETURN"] as const;

export class AdjustStockDto {
  @IsInt()
  @NotEquals(0)
  quantityDelta!: number;

  @IsIn(REASON_TYPES)
  type!: (typeof REASON_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
