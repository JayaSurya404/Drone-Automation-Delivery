import { IsBoolean, IsOptional, IsString } from "class-validator";

export class SetMaintenanceDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
