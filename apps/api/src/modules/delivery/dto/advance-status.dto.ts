import { IsOptional, IsString, MaxLength } from "class-validator";

export class AdvanceStatusDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
