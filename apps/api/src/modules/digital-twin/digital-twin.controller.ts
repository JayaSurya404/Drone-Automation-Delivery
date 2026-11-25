import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { CreateSimulationScenarioDto } from "./dto/create-simulation-scenario.dto";
import { DigitalTwinService } from "./digital-twin.service";

/** Part 6/7 — digital-twin simulation. `simulation.read` for browsing scenarios/runs/risk findings; `simulation.run` for creating scenarios and executing them. Admin/ops-only (Part 11/12) — never touches real order/delivery/mission state. */
@Controller("simulations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DigitalTwinController {
  constructor(private readonly digitalTwinService: DigitalTwinService) {}

  @Post("scenarios")
  @RequirePermission("simulation.run")
  async createScenario(@Body() dto: CreateSimulationScenarioDto, @Req() req: Request) {
    return this.digitalTwinService.createScenario(dto, req.user!);
  }

  @Get("scenarios")
  @RequirePermission("simulation.read")
  async listScenarios() {
    return this.digitalTwinService.listScenarios();
  }

  @Get("scenarios/:id")
  @RequirePermission("simulation.read")
  async getScenario(@Param("id") id: string) {
    return this.digitalTwinService.getScenario(id);
  }

  @Post("scenarios/:id/run")
  @RequirePermission("simulation.run")
  async runSimulation(@Param("id") id: string, @Req() req: Request) {
    return this.digitalTwinService.runSimulation(id, req.user!);
  }

  @Get("scenarios/:id/runs")
  @RequirePermission("simulation.read")
  async listRuns(@Param("id") id: string) {
    return this.digitalTwinService.listRuns(id);
  }

  @Get("runs/:runId")
  @RequirePermission("simulation.read")
  async getRun(@Param("runId") runId: string) {
    return this.digitalTwinService.getRun(runId);
  }
}
