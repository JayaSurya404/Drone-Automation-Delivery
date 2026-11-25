import { Injectable } from "@nestjs/common";
import type { AiDecisionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface AiDecisionLogView {
  id: string;
  type: AiDecisionType;
  deliveryId: string | null;
  missionId: string | null;
  summary: string;
  inputs: unknown;
  outputs: unknown;
  score: number | null;
  createdAt: string;
}

export interface RecordDecisionInput {
  type: AiDecisionType;
  deliveryId?: string | null;
  missionId?: string | null;
  summary: string;
  inputs: object;
  outputs: object;
  score?: number | null;
}

/**
 * The single write path for `AiDecisionLog` — one row per *final* AI
 * decision (never every candidate/scoring pass considered internally), per
 * the phase-09 "don't store every transient calculation" instruction. Every
 * other AI service in this module calls through here rather than writing
 * to the table directly, so the shape stays consistent and callers never
 * need to know the schema.
 */
@Injectable()
export class AiDecisionLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordDecisionInput): Promise<AiDecisionLogView> {
    const row = await this.prisma.aiDecisionLog.create({
      data: {
        type: input.type,
        deliveryId: input.deliveryId ?? null,
        missionId: input.missionId ?? null,
        summary: input.summary,
        inputs: input.inputs as never,
        outputs: input.outputs as never,
        score: input.score ?? null,
      },
    });
    return this.toView(row);
  }

  async listForMission(missionId: string, limit = 50): Promise<AiDecisionLogView[]> {
    const rows = await this.prisma.aiDecisionLog.findMany({
      where: { missionId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((r) => this.toView(r));
  }

  async listForDelivery(deliveryId: string, limit = 50): Promise<AiDecisionLogView[]> {
    const rows = await this.prisma.aiDecisionLog.findMany({
      where: { deliveryId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((r) => this.toView(r));
  }

  private toView(row: { id: string; type: AiDecisionType; deliveryId: string | null; missionId: string | null; summary: string; inputs: unknown; outputs: unknown; score: number | null; createdAt: Date }): AiDecisionLogView {
    return {
      id: row.id,
      type: row.type,
      deliveryId: row.deliveryId,
      missionId: row.missionId,
      summary: row.summary,
      inputs: row.inputs,
      outputs: row.outputs,
      score: row.score,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
