import { Global, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";
import type { EnvConfig } from "../config/env.validation";
import { REDIS_CLIENT } from "./redis.constants";
import { RedisService } from "./redis.service";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvConfig, true>) => {
        return new Redis(configService.get("REDIS_URL", { infer: true }), {
          lazyConnect: false,
          maxRetriesPerRequest: 3,
        });
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly redisService: RedisService) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redisService.client.quit();
  }
}
