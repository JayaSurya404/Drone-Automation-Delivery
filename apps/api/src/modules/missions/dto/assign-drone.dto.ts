import { IsOptional, IsString } from "class-validator";

export class AssignDroneDto {
  @IsString()
  droneId!: string;

  @IsOptional()
  @IsString()
  operatorId?: string;
}
