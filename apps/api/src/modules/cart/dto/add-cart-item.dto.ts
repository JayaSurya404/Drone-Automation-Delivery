import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class AddCartItemDto {
  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number = 1;
}
