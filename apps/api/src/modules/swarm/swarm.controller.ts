import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { AddSwarmMemberDto } from "./dto/add-swarm-member.dto";
import { CreateSwarmDto } from "./dto/create-swarm.dto";
import { CreateSwarmPlanDto } from "./dto/create-swarm-plan.dto";
import { ReassignSwarmTaskDto } from "./dto/reassign-swarm-task.dto";
import { SwarmPlanningService } from "./swarm-planning.service";
import { SwarmService } from "./swarm.service";

/** Part 4/5 — swarm coordination and cooperative task allocation/load balancing. Read routes require `swarm.read`; membership management requires `swarm.manage`; planning/reassignment requires `swarm.plan`. Admin/ops-only — no customer route exists here (Part 11/12). */
@Controller("swarms")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SwarmController {
  constructor(
    private readonly swarmService: SwarmService,
    private readonly planningService: SwarmPlanningService,
  ) {}

  @Post()
  @RequirePermission("swarm.manage")
  async create(@Body() dto: CreateSwarmDto, @Req() req: Request) {
    return this.swarmService.create(dto, req.user!);
  }

  @Get()
  @RequirePermission("swarm.read")
  async list() {
    return this.swarmService.list();
  }

  @Get(":id")
  @RequirePermission("swarm.read")
  async getById(@Param("id") id: string) {
    return this.swarmService.getById(id);
  }

  @Post(":id/members")
  @RequirePermission("swarm.manage")
  async addMember(@Param("id") id: string, @Body() dto: AddSwarmMemberDto, @Req() req: Request) {
    return this.swarmService.addMember(id, dto, req.user!);
  }

  @Delete(":id/members/:droneId")
  @RequirePermission("swarm.manage")
  async removeMember(@Param("id") id: string, @Param("droneId") droneId: string, @Req() req: Request) {
    return this.swarmService.removeMember(id, droneId, req.user!);
  }

  @Post(":id/disband")
  @RequirePermission("swarm.manage")
  async disband(@Param("id") id: string, @Req() req: Request) {
    await this.swarmService.disband(id, req.user!);
    return { ok: true };
  }

  @Post(":id/plans")
  @RequirePermission("swarm.plan")
  async createPlan(@Param("id") id: string, @Body() dto: CreateSwarmPlanDto, @Req() req: Request) {
    return this.planningService.createPlan(id, dto, req.user!);
  }

  @Get(":id/plans")
  @RequirePermission("swarm.read")
  async listPlans(@Param("id") id: string) {
    return this.planningService.listForSwarm(id);
  }

  @Get("plans/:planId")
  @RequirePermission("swarm.read")
  async getPlan(@Param("planId") planId: string) {
    return this.planningService.getById(planId);
  }

  @Post("plans/:planId/assignments/:assignmentId/reassign")
  @RequirePermission("swarm.plan")
  async reassign(@Param("planId") planId: string, @Param("assignmentId") assignmentId: string, @Body() dto: ReassignSwarmTaskDto, @Req() req: Request) {
    return this.planningService.reassign(planId, assignmentId, dto, req.user!);
  }
}
