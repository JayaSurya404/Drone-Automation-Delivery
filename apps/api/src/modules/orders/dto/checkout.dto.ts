import { Type } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

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
}
