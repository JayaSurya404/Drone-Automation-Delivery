import { Type } from "class-transformer";
import { IsLatitude, IsLongitude } from "class-validator";

export class RouteIntelligenceQueryDto {
  @Type(() => Number)
  @IsLatitude()
  originLat!: number;

  @Type(() => Number)
  @IsLongitude()
  originLng!: number;

  @Type(() => Number)
  @IsLatitude()
  destinationLat!: number;

  @Type(() => Number)
  @IsLongitude()
  destinationLng!: number;
}
