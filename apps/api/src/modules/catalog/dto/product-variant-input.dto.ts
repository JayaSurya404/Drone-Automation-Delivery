import { IsNumber, IsOptional, IsString, Min, MaxLength } from "class-validator";

export class ProductVariantInputDto {
  @IsString()
  @MaxLength(64)
  sku!: string;

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceOverride?: number;
}
