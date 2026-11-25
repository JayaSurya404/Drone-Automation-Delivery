import { IsString } from "class-validator";

export class CreateMissionDto {
  @IsString()
  deliveryId!: string;
}
