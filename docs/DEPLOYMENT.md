# SkyNav Autonomous Drone Delivery — Deployment Guide

> **Note on Deployment Status:**
> In accordance with project rules, **no live services or cloud resources are claimed to be deployed**. All configurations below are prepared, verified locally in containerized and local builds, and ready for deployment when cloud credentials are provided.

---

## 1. Free-First Cloud Deployment Architecture

SkyNav is designed to run seamlessly on modern free-tier developer platforms without architectural compromises:

```
                           ┌──────────────────────────┐
                           │   Vercel (Free Tier)     │
                           │   apps/customer-web      │
                           └────────────┬─────────────┘
                                        │
                                        │ HTTPS / WSS
                                        ▼
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│   Vercel (Free Tier)     │──▶│   Render (Free Tier)     │◀──│  Gazebo Simulation      │
│   apps/admin-web         │   │   apps/api (Port 10000)  │   │  Bridge (Port 8085)      │
└──────────────────────────┘   └────────────┬─────────────┘   └──────────────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
     ┌────────────────────────┐  ┌───────────────────────┐  ┌────────────────────────┐
     │ Supabase / Render DB   │  │ Upstash (Free Tier)   │  │ AWS S3 / Cloudflare R2 │
     │ PostgreSQL 16+ PostGIS │  │ Serverless Redis      │  │ Object Storage         │
     └────────────────────────┘  └───────────────────────┘  └────────────────────────┘
```

---

## 2. Platform Breakdown & Setup

### A. Backend API: Render Free Web Service
- **Platform:** [Render](https://render.com) (Free Tier)
- **Configuration:** `render.yaml`
- **Build Command:** `pnpm install --frozen-lockfile && pnpm --filter @skynav/api exec prisma generate && pnpm --filter @skynav/api build`
- **Start Command:** `node apps/api/dist/main.js`
- **Region:** Singapore (`singapore`), optimized for lowest latency to South India / Coimbatore.

### B. Frontends: Vercel Free Tier
- **Customer Web:** [Vercel](https://vercel.com) — Root Directory: `apps/customer-web`
  - Build Command: `pnpm --filter @skynav/customer-web build`
  - Output Directory: `dist`
  - SPA Rewrites: Configured via `apps/customer-web/vercel.json`
- **Admin Web:** [Vercel](https://vercel.com) — Root Directory: `apps/admin-web`
  - Build Command: `pnpm --filter @skynav/admin-web build`
  - Output Directory: `dist`
  - SPA Rewrites: Configured via `apps/admin-web/vercel.json`

### C. Managed Database: Supabase Free Tier
- **PostgreSQL 16 with PostGIS Extension**
- Connect via Prisma using `DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"`
- Execute schema migrations: `pnpm db:migrate:deploy`
- Seed Indian catalogue & fleet: `pnpm db:seed`

### D. Distributed Cache & Socket Fan-out: Upstash Serverless Redis
- **Free Tier:** 10,000 commands/day
- Connect via `REDIS_URL="rediss://default:[PASSWORD]@[HOST].upstash.io:6379"`

---

## 3. Local Production-Mode Verification (Docker Compose)

To verify the production container artifacts and security constraints locally:

1. Create a production environment file:
   ```bash
   cp .env.example .env.prod.local
   ```
2. Populate required variables (Postgres credentials, MinIO keys, JWT secret). Note that `docker-compose.prod.yml` strictly enforces **NO DEFAULT PASSWORDS** and will fail fast if any secret is unset.
3. Build and launch all containers:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod.local up --build
   ```
4. Access endpoints:
   - Unified API: `http://localhost:4010` (Health: `http://localhost:4010/health`)
   - Customer Portal: `http://localhost:3000`
   - Admin Operations Console: `http://localhost:3001`
