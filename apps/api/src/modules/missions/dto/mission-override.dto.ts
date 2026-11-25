import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

const OVERRIDE_ACTIONS = ["RETURN_TO_HOME", "ABORT", "LAND"] as const;

/** Dangerous operator commands, per the phase-06 security requirement that "abort/RTH/operator override must be explicitly authorized" — `reason` is required, never optional, and every use is audit-logged with the operator's identity. */
export class MissionOverrideDto {
  @IsIn(OVERRIDE_ACTIONS)
  action!: (typeof OVERRIDE_ACTIONS)[number];

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
