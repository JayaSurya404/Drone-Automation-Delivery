import { IsString } from "class-validator";

export class ReassignSwarmTaskDto {
  @IsString()
  droneId!: string;
}
