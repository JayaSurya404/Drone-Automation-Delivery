import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { HealthCheckResponse } from "@skynav/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { StorageService } from "../storage/storage.service";

interface ReadinessResponse extends HealthCheckResponse {
  postgres: "ok";
  redis: "ok";
  /** Reported, not gated on: object storage backs only image uploads, not baseline traffic (see `StorageService.onModuleInit`). */
  objectStorage: "ok" | "degraded";
}

@ApiExcludeController()
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  check(): HealthCheckResponse {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  async ready(): Promise<ReadinessResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const probeKey = "health:ready:probe";
      await this.redis.setAndGet(probeKey, "1", 5);
      const objectStorageOk = await this.storage.checkConnection();

      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        postgres: "ok",
        redis: "ok",
        objectStorage: objectStorageOk ? "ok" : "degraded",
      };
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : "Dependency check failed",
      );
    }
  }
}
