import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { SwarmMemberRole, SwarmStatus } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { DronesService } from "../drones/drones.service";
import type { AddSwarmMemberDto } from "./dto/add-swarm-member.dto";
import type { CreateSwarmDto } from "./dto/create-swarm.dto";

export interface SwarmMemberView {
  id: string;
  droneId: string;
  droneName: string;
  role: SwarmMemberRole;
  joinedAt: string;
}

export interface SwarmView {
  id: string;
  name: string;
  status: SwarmStatus;
  memberCount: number;
  createdAt: string;
}

export interface SwarmDetailView extends SwarmView {
  members: SwarmMemberView[];
}

/**
 * Part 4 — swarm/group definitions and membership. A deliberately simple
 * CRUD layer: `Swarm`/`SwarmMember` are planning constructs (a named list of
 * drones), never a claim that multiple physical UAVs are actually flying a
 * coordinated formation (Part 4's explicit instruction). `SwarmPlanningService`
 * is the layer that actually reasons about tasks/routes/battery for these
 * members.
 */
@Injectable()
export class SwarmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dronesService: DronesService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateSwarmDto, actor: AuthenticatedUser): Promise<SwarmDetailView> {
    const swarm = await this.prisma.swarm.create({ data: { name: dto.name, createdById: actor.sub } });
    await this.auditService.log({ actorId: actor.sub, action: "swarm.created", targetType: "Swarm", targetId: swarm.id, metadata: { name: dto.name } });
    return this.getById(swarm.id);
  }

  async list(): Promise<SwarmView[]> {
    // Phase 12 fix: previously unbounded.
    const swarms = await this.prisma.swarm.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
      take: 200,
    });
    return swarms.map((s) => ({ id: s.id, name: s.name, status: s.status, memberCount: s._count.members, createdAt: s.createdAt.toISOString() }));
  }

  async getById(id: string): Promise<SwarmDetailView> {
    const swarm = await this.prisma.swarm.findUnique({
      where: { id },
      include: { members: { include: { drone: { select: { id: true, name: true } } }, orderBy: { joinedAt: "asc" } } },
    });
    if (!swarm) {
      throw new NotFoundException(`Swarm ${id} not found`);
    }
    return {
      id: swarm.id,
      name: swarm.name,
      status: swarm.status,
      memberCount: swarm.members.length,
      createdAt: swarm.createdAt.toISOString(),
      members: swarm.members.map((m) => ({ id: m.id, droneId: m.droneId, droneName: m.drone.name, role: m.role, joinedAt: m.joinedAt.toISOString() })),
    };
  }

  async addMember(swarmId: string, dto: AddSwarmMemberDto, actor: AuthenticatedUser): Promise<SwarmDetailView> {
    const swarm = await this.assertActiveSwarm(swarmId);
    await this.dronesService.getById(dto.droneId);

    const existing = await this.prisma.swarmMember.findUnique({ where: { swarmId_droneId: { swarmId, droneId: dto.droneId } } });
    if (existing) {
      throw new ConflictException("This drone is already a member of the swarm");
    }

    const memberCount = await this.prisma.swarmMember.count({ where: { swarmId: swarm.id } });
    const role = dto.role ?? (memberCount === 0 ? "LEADER" : "FOLLOWER");
    await this.prisma.swarmMember.create({ data: { swarmId: swarm.id, droneId: dto.droneId, role } });
    await this.auditService.log({ actorId: actor.sub, action: "swarm.member_added", targetType: "Swarm", targetId: swarmId, metadata: { droneId: dto.droneId, role } });
    return this.getById(swarmId);
  }

  async removeMember(swarmId: string, droneId: string, actor: AuthenticatedUser): Promise<SwarmDetailView> {
    await this.assertActiveSwarm(swarmId);
    const existing = await this.prisma.swarmMember.findUnique({ where: { swarmId_droneId: { swarmId, droneId } } });
    if (!existing) {
      throw new NotFoundException("This drone is not a member of the swarm");
    }
    await this.prisma.swarmMember.delete({ where: { id: existing.id } });
    await this.auditService.log({ actorId: actor.sub, action: "swarm.member_removed", targetType: "Swarm", targetId: swarmId, metadata: { droneId } });
    return this.getById(swarmId);
  }

  async disband(swarmId: string, actor: AuthenticatedUser): Promise<void> {
    await this.assertActiveSwarm(swarmId);
    await this.prisma.swarm.update({ where: { id: swarmId }, data: { status: "DISBANDED" } });
    await this.auditService.log({ actorId: actor.sub, action: "swarm.disbanded", targetType: "Swarm", targetId: swarmId });
    this.eventEmitter.emit("swarm.disbanded", { swarmId });
  }

  private async assertActiveSwarm(swarmId: string): Promise<{ id: string; status: SwarmStatus }> {
    const swarm = await this.prisma.swarm.findUnique({ where: { id: swarmId }, select: { id: true, status: true } });
    if (!swarm) {
      throw new NotFoundException(`Swarm ${swarmId} not found`);
    }
    if (swarm.status === "DISBANDED") {
      throw new BadRequestException("This swarm has been disbanded");
    }
    return swarm;
  }
}
