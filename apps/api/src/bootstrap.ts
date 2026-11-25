import { ValidationPipe, type INestApplication, type NestApplicationOptions } from "@nestjs/common";
import cookieParser from "cookie-parser";
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { resolveCorsOrigins } from "./config/cors.util";

/**
 * `rawBody: true` makes Nest keep the unparsed request body available as
 * `req.rawBody` alongside the normal parsed `req.body` — required by the
 * Stripe webhook handler to verify the provider's HMAC signature, which is
 * computed over the exact raw bytes Stripe sent. Shared here so every place
 * that creates the app (the real server and every integration test) applies
 * it identically — see docs/ARCHITECTURE.md's `bootstrap.ts` note from Phase 2
 * for why that consistency matters.
 */
export const NEST_APP_OPTIONS: NestApplicationOptions = { rawBody: true };

/**
 * Cross-cutting HTTP setup shared by the real server (`main.ts`) and every
 * integration test that builds an app directly via `createNestApplication()`
 * — keeping this in one place means a test never silently skips config
 * (global prefix, cookies, validation) that the real server applies.
 */
export function configureApp(app: INestApplication): void {
  // Backward-compatibility rewrite middleware for legacy frontend routes (/api/... and /api/admin/...)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const url: string = req.url ?? "";
    if (url.startsWith("/api/") && !url.startsWith("/api/v1/") && !url.startsWith("/api/docs")) {
      if (url === "/api/health") {
        req.url = "/health";
      } else if (url.startsWith("/api/admin/")) {
        const sub = url.slice("/api/admin/".length);
        if (sub.startsWith("auth/login")) req.url = "/api/v1/auth/login";
        else if (sub.startsWith("auth/me")) req.url = "/api/v1/auth/me";
        else if (sub.startsWith("fleet")) req.url = "/api/v1/drones" + sub.slice(5);
        else if (sub.startsWith("orders")) req.url = "/api/v1/orders/admin" + sub.slice(6);
        else if (sub.startsWith("missions")) req.url = "/api/v1/missions" + sub.slice(8);
        else if (sub.startsWith("geofences")) req.url = "/api/v1/geofences" + sub.slice(9);
        else if (sub.startsWith("audit-logs")) req.url = "/api/v1/audit" + sub.slice(10);
        else if (sub.startsWith("notifications")) req.url = "/api/v1/notifications" + sub.slice(13);
        else if (sub.startsWith("products")) req.url = "/api/v1/products" + sub.slice(8);
        else req.url = "/api/v1/" + sub;
      } else {
        const sub = url.slice("/api/".length);
        if (sub.startsWith("health")) req.url = "/health";
        else if (sub.startsWith("checkout/orders")) req.url = "/api/v1/orders/checkout";
        else req.url = "/api/v1/" + sub;
      }
    }
    next();
  });

  app.use(cookieParser());

  // Swagger UI (served at `/api/docs`, see main.ts) needs inline scripts/styles
  // to render — carved out of the default strict CSP rather than weakening it
  // API-wide. Every other response (the actual JSON API) gets helmet's full
  // default header set (HSTS, X-Content-Type-Options, X-Frame-Options, a
  // baseline CSP, etc.).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "script-src": ["'self'", "'unsafe-inline'"],
          "style-src": ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Phase 12 fix: previously fell back to `origin: true` (reflect any
  // request origin) whenever `CORS_ORIGINS` wasn't set as a raw process env
  // var, which combined with `credentials: true` is the classic
  // reflected-origin-with-credentials misconfiguration. `resolveCorsOrigins()`
  // never returns `true` — see its doc comment for why this can't just use
  // `ConfigService` (the WebSocket gateways need the identical logic before
  // Nest's DI container exists).
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
}
