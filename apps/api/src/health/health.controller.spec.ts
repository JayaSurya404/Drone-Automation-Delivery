import { ServiceUnavailableException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { StorageService } from "../storage/storage.service";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };
  let redis: { setAndGet: jest.Mock };
  let storage: { checkConnection: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) };
    redis = { setAndGet: jest.fn().mockResolvedValue("1") };
    storage = { checkConnection: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("returns ok status with a timestamp", () => {
    const result = controller.check();
    expect(result.status).toBe("ok");
    expect(new Date(result.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("returns ok for postgres and redis when both dependencies respond", async () => {
    const result = await controller.ready();
    expect(result).toMatchObject({ status: "ok", postgres: "ok", redis: "ok", objectStorage: "ok" });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(redis.setAndGet).toHaveBeenCalledWith("health:ready:probe", "1", 5);
  });

  it("throws ServiceUnavailableException when a dependency check fails", async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error("connection refused"));
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("reports 'degraded' object storage without failing readiness — uploads aren't on the baseline traffic path", async () => {
    storage.checkConnection.mockResolvedValueOnce(false);
    const result = await controller.ready();
    expect(result).toMatchObject({ status: "ok", objectStorage: "degraded" });
  });
});
