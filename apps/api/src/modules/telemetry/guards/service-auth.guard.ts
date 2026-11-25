import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { timingSafeEqual } from "node:crypto";
import type { EnvConfig } from "../../../config/env.validation";

/**
 * Authenticates the standalone `services/drone-simulator` process (and any
 * future real drone/telemetry source) to the internal telemetry-ingest
 * endpoint via a signed service credential — blueprint Section O: "separate
 * from user auth... a signed service credential (API key now, mutual
 * TLS/cert-based for real hardware later)." Deliberately independent of
 * `JwtAuthGuard`/`PermissionsGuard` — a browser-issued user JWT must never
 * satisfy this guard, no matter which permissions it carries.
 */
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided =
      (request.headers["x-service-api-key"] as string | undefined) ??
      (request.headers["x-service-key"] as string | undefined);
    const expected = this.configService.get("TELEMETRY_INGEST_API_KEY", { infer: true });
    const fallbackExpected = process.env.SKYNAV_INTERNAL_SERVICE_KEY;

    if (typeof provided !== "string") {
      throw new UnauthorizedException("Invalid or missing service credential");
    }

    const matchesExpected = expected ? this.matches(provided, expected) : false;
    const matchesFallback = fallbackExpected ? this.matches(provided, fallbackExpected) : false;

    if (!matchesExpected && !matchesFallback) {
      throw new UnauthorizedException("Invalid or missing service credential");
    }
    return true;
  }

  private matches(provided: string, expected: string): boolean {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(providedBuffer, expectedBuffer);
  }
}
