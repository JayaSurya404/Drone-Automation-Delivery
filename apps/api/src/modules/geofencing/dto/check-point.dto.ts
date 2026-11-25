import { IsLatitude, IsLongitude } from "class-validator";

export class CheckPointDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}
