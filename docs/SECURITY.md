# SkyNav — Security Audit & Hardening Report

This document records the security-hardening audit for the SkyNav Autonomous Drone Delivery Platform: what was reviewed, what vulnerabilities were identified and fixed, and what remains as documented production considerations.

---

## 1. Security Baseline & Fixes Matrix

| Security Area | Baseline / Intern Project | Hardened Implementation | Status |
|---|---|---|---|
| **Admin Route Protection** | Unauthenticated Express endpoints | Global `requireAdmin` middleware & NestJS `PermissionsGuard` | **Fixed** |
| **Secrets & Keys** | Hardcoded fallback strings in code | Strict `env.validation.ts` fail-fast validation at boot | **Fixed** |
| **Dispatch Bypasses** | `force` flag and hardcoded `D-001` bypass | Completely removed; all missions must pass safety pipeline | **Fixed** |
| **CORS Policy** | Wildcard `*` or reflected any origin | Strict allow-list (`resolveCorsOrigins()`) with credentials support | **Fixed** |
| **HTTP Security Headers** | Missing HTTP headers | `helmet` middleware with Content Security Policy (CSP) | **Fixed** |
| **Rate Limiting** | Unbounded public endpoints | `@nestjs/throttler` (100 req/min user, 2000 req/min telemetry) | **Fixed** |
| **Random Codes (OTP/PIN)** | Predictable `Math.random()` | Cryptographically secure `crypto.randomInt()` | **Fixed** |
| **Password Hashing** | Plaintext or basic bcrypt | Argon2id (`argon2` package) with salt and high memory cost | **Fixed** |
| **Token Storage (Client)**| Stored in `localStorage` | **In-memory only** (zero storage in local/sessionStorage) | **Fixed** |
| **Refresh Cookie Isolation**| Shared cookie name logging out users | Separate cookies: `skynav_customer_` vs `skynav_admin_` | **Fixed** |
| **Session Revocation** | No logout-all capability | `POST /auth/logout-all` revoking all family tokens | **Fixed** |
| **Brute-Force Lockout** | Unrestricted login guessing | Redis-backed soft lockout (10 attempts / 15 minutes) | **Fixed** |
| **Airspace Safety Gates** | Advisory or bypassable | Fail-closed DGCA Coimbatore red/yellow geofence evaluation | **Fixed** |
| **Weather Safety Gates** | Ignored in mission dispatch | Deterministic weather safety checks (wind, rain, visibility) | **Fixed** |
| **Battery Safety Gates** | Simulated without reserve check | Mandatory 20% return-to-home battery reserve check | **Fixed** |
| **Proof of Delivery Images** | Unauthenticated public URLs | Access-controlled route with customer/staff ownership check | **Fixed** |
| **File Upload Validation** | Trusted browser Content-Type | Magic-number byte signature detection (JPEG, PNG, WebP) | **Fixed** |
| **Race Conditions** | TOCTOU in drone assignment | Atomic Compare-And-Swap (`status: "IDLE"`, checking count) | **Fixed** |
| **CI Security Auditing** | Ignored audit warnings | `pnpm audit --audit-level=high --prod` fails build on high severity | **Fixed** |
| **Secret Scanning in CI** | No automated secret scans | Gitleaks automated scanning on every PR and commit | **Fixed** |

---

## 2. Vulnerabilities Identified & Resolved

### 1. Cross-App Cookie Collision on Localhost (Reference Flaw A)
- **Problem**: When both customer and admin applications share the same refresh token cookie name (`skynav_refresh_token`), logging into the admin console in one browser tab overwrites the customer's refresh token cookie, immediately logging the customer out.
- **Fix**: Configured dedicated cookie names and distinct paths:
  - Customer Portal: `skynav_customer_refresh_token` (`path: /api/v1/auth`)
  - Admin Operations: `skynav_admin_refresh_token` (`path: /api/v1/auth`)
- **Verification**: Verified via dedicated integration test `apps/api/src/modules/users/session-isolation.integration.spec.ts`.

### 2. Bypassable Safety Gates & Force Flags
- **Problem**: The legacy dispatch handler allowed a `force: true` boolean parameter in the dispatch payload to override battery checks, weather constraints, and geofence intersections, while `D-001` was hardcoded to bypass safety checks.
- **Fix**: The `force` flag and `D-001` bypass were permanently removed. The mission state machine enforces the deterministic safety pipeline:
  ```
  Plan → Validate → Score → Safety Check → Authorize → Execute
  ```
  If a corridor intersects a DGCA Coimbatore restricted airspace (e.g. Sulur AFS), the dispatch fails closed.

### 3. Hardcoded Fallback Secrets
- **Problem**: Legacy code used default fallback secrets like `process.env.JWT_SECRET || "skynav@123"`.
- **Fix**: Created `env.validation.ts` backed by Zod. In development and production, the application refuses to boot if required secrets (`JWT_ACCESS_SECRET`, `SKYNAV_INTERNAL_SERVICE_KEY`, `POSTGRES_PASSWORD`) are missing or equal default placeholders.

### 4. Client-Side XSS Token Theft
- **Problem**: Storing access tokens in `localStorage` or `sessionStorage` makes them vulnerable to exfiltration by any Cross-Site Scripting (XSS) payload.
- **Fix**: Access tokens are held **strictly in memory** within the `@skynav/api-client` instance. Refresh tokens are stored exclusively in `httpOnly`, `Secure`, `SameSite=Lax` cookies inaccessible to JavaScript.

### 5. Media Upload & SVG Stored XSS
- **Problem**: Media controllers accepted uploaded images based on browser-provided MIME types and file extensions, enabling attackers to upload SVG files with embedded `<script>` tags.
- **Fix**: Implemented binary magic-number validation (`file-upload.util.ts`) verifying the initial byte signatures of JPEG, PNG, and WebP images. SVG files are strictly rejected. Upload sizes are bounded at 5 MB.

### 6. Drone Assignment Concurrency Race (TOCTOU)
- **Problem**: A Time-Of-Check to Time-Of-Use race condition existed where two concurrent requests could read a drone's status as `IDLE` and both assign it to different missions.
- **Fix**: Converted assignment to an atomic Compare-And-Swap query using Prisma:
  ```typescript
  const updated = await prisma.drone.updateMany({
    where: { id: droneId, status: DroneStatus.IDLE },
    data: { status: DroneStatus.ASSIGNED },
  });
  if (updated.count === 0) throw new ConflictException('Drone is no longer available');
  ```

### 7. Telemetry Ingest Rate Limit Starvation
- **Problem**: Applying a uniform user rate limit (e.g., 100 req/min) to `/api/v1/internal/telemetry` causes rapid request dropping when a fleet of 40 drones streams kinematic updates at 4-second intervals.
- **Fix**: Scoped a dedicated high-capacity throttle (`2000 req/min`) exclusively to the service-authenticated `/internal/telemetry` endpoint while keeping public routes at `100 req/min`.

---

## 3. Remaining Production Considerations

The following items are out of scope for local development but must be addressed when deploying to live cloud infrastructure:

1. **TLS / HTTPS Termination**:
   - In production, all incoming traffic must be encrypted via TLS 1.3 terminated at the reverse proxy or cloud load balancer (e.g., Cloudflare, AWS ALB, or Render proxy).
2. **Secrets Management**:
   - Production secrets (`JWT_ACCESS_SECRET`, database passwords, HMAC keys) must be managed using a dedicated cloud secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault, or Google Secret Manager) with automated rotation.
3. **Web Application Firewall (WAF) & DDoS Mitigation**:
   - Public-facing endpoints should sit behind an edge WAF (e.g., Cloudflare WAF or AWS WAF) with managed rules for OWASP Top 10 mitigation and Layer 7 rate limiting.
4. **Live Payment Gateway Credentials**:
   - The platform currently operates with a simulated payment provider. When connecting live Stripe or Razorpay accounts, webhooks must be verified using raw request body HMAC signatures.
