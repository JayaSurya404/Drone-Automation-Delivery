# SkyNav — Local Development Setup & Operations Guide

This guide details the complete local development environment setup, prerequisites, database provisioning, service startup, and verification procedures for both **Windows** and **Linux** environments.

---

## 1. Prerequisites

Ensure the following tools are installed and accessible in your system path:

| Tool | Recommended Version | Minimum Version | Installation Command |
|---|---|---|---|
| **Node.js** | `v22.14.0` LTS | `v22.13.0` | [nodejs.org](https://nodejs.org/) |
| **pnpm** | `v11.9.0` | `v11.9.0` | `npm install -g pnpm@11.9.0` or `corepack enable` |
| **Docker Desktop** | `v28.0+` (Compose v2) | Compose `v2.20+`| [docker.com](https://www.docker.com/) |
| **Git** | `v2.40+` | `v2.30+` | [git-scm.com](https://git-scm.com/) |
| **Python** *(Optional)* | `v3.10+` | `v3.8+` | Required only for Gazebo bridge |

> **Windows Note**: Docker Desktop must be running with the WSL 2 backend active before running `docker compose up`. If you encounter pipe errors, start the Docker Desktop service from the Windows Start menu.

---

## 2. Environment Configuration

1. **Clone the repository and checkout the working branch**:
   ```bash
   git clone <repo-url>
   cd Drone-Automation-Delivery
   git checkout feature/claude-stack-upgrade
   ```

2. **Copy the root environment template**:
   ```bash
   cp .env.example .env
   ```
   *Windows (PowerShell)*:
   ```powershell
   Copy-Item .env.example .env
   ```

3. **Verify `.env` configuration**:
   Inspect `.env` and verify key parameters:
   - `DATABASE_URL`: `postgresql://skynav_admin:your_strong_postgres_password_here@localhost:5432/skynav_delivery?schema=public`
   - `REDIS_URL`: `redis://localhost:6379`
   - `STORAGE_PORT`: `9000`
   - `PORT`: `4000`
   - `CUSTOMER_REFRESH_COOKIE_NAME`: `skynav_customer_refresh_token`
   - `ADMIN_REFRESH_COOKIE_NAME`: `skynav_admin_refresh_token`

---

## 3. Infrastructure Startup

Launch the local PostgreSQL + PostGIS, Redis 7, MinIO, and Mailhog containers:

```bash
docker compose up -d
```

Verify that all containers are healthy:
```bash
docker compose ps
```

Expected running containers:
- `skynav-postgres` (PostgreSQL 16 with PostGIS on port `5432`)
- `skynav-redis` (Redis 7 on port `6379`)
- `skynav-minio` (MinIO S3 storage on ports `9000` and `9001`)
- `skynav-mailhog` (SMTP inbox on port `1025`, web UI on port `8025`)

---

## 4. Install Dependencies & Seed Database

1. **Install workspace dependencies**:
   ```bash
   pnpm install
   ```

2. **Apply database migrations**:
   ```bash
   pnpm db:migrate:deploy
   ```

3. **Seed database with initial data**:
   ```bash
   pnpm db:seed
   ```
   The seed script populates:
   - **Super Admin**: `admin@skynav.local` / `ChangeMe123!`
   - **Customer User**: `customer@skynav.local` / `ChangeMe123!`
   - **SkyHub Kurumbapalayam Base** (`11.1132°N, 77.0277°E`)
   - **40 Autonomous UAVs** (`D-001` through `D-040`)
   - **Coimbatore DGCA No-Fly Zones** (Sulur Air Force Station, Airport, Prison, INS Agrani)
   - **Indian Product Catalog** (5 categories, 8 products, 10 inventory variants)

---

## 5. Starting Development Servers

Launch all applications concurrently via Turborepo:

```bash
pnpm dev
```

Alternatively, launch services individually in separate terminals:
- **Unified API (`apps/api`)**:
  ```bash
  pnpm --filter @skynav/api dev
  ```
  API available at [http://localhost:4000](http://localhost:4000) (Swagger: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)).
- **Customer Web (`apps/customer-web`)**:
  ```bash
  pnpm --filter @skynav/customer-web dev
  ```
  Customer Portal available at [http://localhost:5173](http://localhost:5173).
- **Admin Console (`apps/admin-web`)**:
  ```bash
  pnpm --filter @skynav/admin-web dev
  ```
  Admin Console available at [http://localhost:5174](http://localhost:5174).

---

## 6. Connecting the Gazebo Simulation Bridge

If running Gazebo 3D simulation with ROS 2:
1. Navigate to `simulation/gazebo/`:
   ```bash
   cd simulation/gazebo
   ```
2. Start the telemetry bridge server:
   ```bash
   python telemetry_bridge.py --port 8085 --target http://localhost:4000/api/v1/internal/telemetry
   ```
   The bridge connects to the Gazebo physics simulation and streams pose, altitude, battery, and speed packets authenticated via `x-service-key`.

---

## 7. Verification & Testing

Execute the test suites to confirm full system readiness:

```bash
# 1. Monorepo TypeScript check across all 7 packages
pnpm typecheck

# 2. Monorepo ESLint check
pnpm lint

# 3. Monorepo unit tests (61 suites, 430 tests)
pnpm test

# 4. Session isolation integration test
pnpm test:integration

# 5. Full 16-step end-to-end mission workflow test
npx tsx test_full_workflow.ts

# 6. Production build verification
pnpm build
```

---

## 8. Running with Production Docker Compose

To verify the full production container stack locally:

1. Ensure required production environment variables are exported:
   ```bash
   export POSTGRES_PASSWORD=your_strong_postgres_password_here
   export REDIS_PASSWORD=your_strong_redis_password_here
   export MINIO_ROOT_PASSWORD=your_strong_minio_password_here
   export STORAGE_SECRET_KEY=your_strong_minio_password_here
   export JWT_ACCESS_SECRET=your_32_character_jwt_access_secret_key_here
   export SKYNAV_INTERNAL_SERVICE_KEY=your_32_character_hmac_service_key_here
   ```
2. Start the production containers:
   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```
3. Access production endpoints:
   - **Customer Portal**: [http://localhost:3000](http://localhost:3000)
   - **Admin Operations**: [http://localhost:3001](http://localhost:3001)
   - **Unified API**: [http://localhost:4000](http://localhost:4000)
