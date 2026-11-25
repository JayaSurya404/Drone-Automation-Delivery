import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceOverride?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
