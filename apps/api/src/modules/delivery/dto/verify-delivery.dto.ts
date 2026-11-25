import { IsIn, IsString, Length } from "class-validator";

const VERIFICATION_METHODS = ["OTP", "QR"] as const;

export class VerifyDeliveryDto {
  @IsString()
  @Length(6, 6)
  code!: string;

  @IsIn(VERIFICATION_METHODS)
  method!: (typeof VERIFICATION_METHODS)[number];
}
