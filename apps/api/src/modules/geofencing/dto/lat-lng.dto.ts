import { IsLatitude, IsLongitude } from "class-validator";

/** Rigorous geospatial input validation (Phase 8 security requirement) — `class-validator`'s built-in range checks, not a bare `IsNumber()`. */
export class LatLngDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}
