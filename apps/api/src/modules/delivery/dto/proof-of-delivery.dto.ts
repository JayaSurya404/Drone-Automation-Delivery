import { IsOptional, IsString, MaxLength } from "class-validator";

export class ProofOfDeliveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  recipientNote?: string;
}
