import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";

@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) public readonly client: Redis) {}

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async setAndGet(key: string, value: string, ttlSeconds = 30): Promise<string | null> {
    await this.client.set(key, value, "EX", ttlSeconds);
    return this.client.get(key);
  }
}
