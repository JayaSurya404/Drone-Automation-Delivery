import { IsIn, IsOptional, IsString } from "class-validator";

const SWARM_MEMBER_ROLES = ["LEADER", "FOLLOWER"] as const;

export class AddSwarmMemberDto {
  @IsString()
  droneId!: string;

  @IsOptional()
  @IsIn(SWARM_MEMBER_ROLES)
  role?: (typeof SWARM_MEMBER_ROLES)[number];
}
