import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

const PAYMENT_METHOD_TYPES = ["SIMULATED", "COD", "STRIPE"] as const;

export class PaymentMethodDto {
  @IsIn(PAYMENT_METHOD_TYPES)
  type!: (typeof PAYMENT_METHOD_TYPES)[number];

  /** SIMULATED only — a Stripe-style test card number used to force a deterministic outcome (e.g. "4000000000000002" = decline). */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  testCardNumber?: string;
}

export class CheckoutDto {
  @IsString()
  addressId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliverySlot?: string;

  @ValidateNested()
  @Type(() => PaymentMethodDto)
  paymentMethod!: PaymentMethodDto;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(50)
  clearanceRadiusMeters?: number;
}
