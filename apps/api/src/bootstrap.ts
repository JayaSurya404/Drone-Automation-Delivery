import { ValidationPipe, type INestApplication, type NestApplicationOptions } from "@nestjs/common";
import cookieParser from "cookie-parser";
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
