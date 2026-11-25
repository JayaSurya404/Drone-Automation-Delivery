import type { PrismaService } from "../../prisma/prisma.service";
import { AiDecisionLogService } from "./ai-decision-log.service";

describe("AiDecisionLogService", () => {
  let prisma: { aiDecisionLog: { create: jest.Mock; findMany: jest.Mock } };
  let service: AiDecisionLogService;
  const createdAt = new Date("2026-09-04T12:00:00.000Z");

  beforeEach(() => {
    prisma = { aiDecisionLog: { create: jest.fn(), findMany: jest.fn() } };
    service = new AiDecisionLogService(prisma as unknown as PrismaService);
  });

  it("writes a decision row and maps timestamps to ISO strings on return", async () => {
    prisma.aiDecisionLog.create.mockResolvedValue({
      id: "log-1",
      type: "ROUTE_OPTIMIZATION",
      deliveryId: "delivery-1",
      missionId: "mission-1",
      summary: "Selected direct route",
      inputs: { a: 1 },
      outputs: { b: 2 },
      score: 1000,
      createdAt,
    });

    const result = await service.record({
      type: "ROUTE_OPTIMIZATION",
      deliveryId: "delivery-1",
      missionId: "mission-1",
      summary: "Selected direct route",
      inputs: { a: 1 },
      outputs: { b: 2 },
      score: 1000,
    });

    expect(result.createdAt).toBe(createdAt.toISOString());
    expect(prisma.aiDecisionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "ROUTE_OPTIMIZATION", deliveryId: "delivery-1", missionId: "mission-1" }) }),
    );
  });

  it("defaults deliveryId/missionId/score to null when omitted", async () => {
    prisma.aiDecisionLog.create.mockResolvedValue({
      id: "log-2",
      type: "ETA_PREDICTION",
      deliveryId: null,
      missionId: null,
      summary: "ETA predicted",
      inputs: {},
      outputs: {},
      score: null,
      createdAt,
    });

    await service.record({ type: "ETA_PREDICTION", summary: "ETA predicted", inputs: {}, outputs: {} });

    expect(prisma.aiDecisionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryId: null, missionId: null, score: null }) }),
    );
  });

  it("lists decisions for a mission, most recent first, capped at 200", async () => {
    prisma.aiDecisionLog.findMany.mockResolvedValue([]);
    await service.listForMission("mission-1", 500);
    expect(prisma.aiDecisionLog.findMany).toHaveBeenCalledWith({
      where: { missionId: "mission-1" },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });

  it("lists decisions for a delivery with the default limit of 50", async () => {
    prisma.aiDecisionLog.findMany.mockResolvedValue([]);
    await service.listForDelivery("delivery-1");
    expect(prisma.aiDecisionLog.findMany).toHaveBeenCalledWith({
      where: { deliveryId: "delivery-1" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  it("clamps a limit below 1 up to 1", async () => {
    prisma.aiDecisionLog.findMany.mockResolvedValue([]);
    await service.listForMission("mission-1", 0);
    expect(prisma.aiDecisionLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1 }));
  });
});
