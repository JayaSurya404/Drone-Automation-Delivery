import { Type } from "class-transformer";
import { ArrayMinSize, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { LatLngDto } from "./lat-lng.dto";

export class UpdateGeofenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => LatLngDto)
  points?: LatLngDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
