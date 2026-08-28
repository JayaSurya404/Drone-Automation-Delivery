# SkyNav — AI-Assisted UAV Last-Mile Delivery & Fleet Intelligence Platform

> A simulation-first, safety-aware platform for managing UAV delivery orders, fleet operations, route intelligence, live telemetry, secure delivery, emergency workflows, and AI-assisted optimization.

## 1. What SkyNav is

SkyNav is not just a drone-tracking dashboard. The original project specification covers autonomous navigation, delivery management, live fleet monitoring, AI-assisted route optimization, weather intelligence, obstacle detection, secure delivery, geofencing, battery intelligence, emergency handling, analytics, computer vision, swarm coordination, and digital-twin simulation. fileciteturn0file1L6-L20 fileciteturn0file1L21-L46

The expanded architecture also defines an operational lifecycle of **plan → authorize → execute → observe → learn**, with deterministic safety controls remaining authoritative over AI recommendations. fileciteturn0file0L56-L68 fileciteturn0file0L191-L224

### The key architectural decision

SkyNav will be built in three layers:

1. **Digital platform** — web/PWA, API, database, authentication, orders, missions, fleet, analytics and notifications.
2. **Intelligence platform** — route optimization, ETA, battery prediction, weather scoring, predictive maintenance and computer vision.
3. **Simulation/edge platform** — mock telemetry first, then PX4/ArduPilot SITL, MAVLink, companion-computer integration and controlled research experiments.

Real-world flight control is **not a dependency of the core web application**. The platform must remain useful and testable with simulated drones.

---

# 2. What should be improved from the previous README

The previous README is strong as a vision document, but it is too broad as an implementation contract. It lists PostgreSQL/PostGIS, Redis, object storage, event streaming, multiple services, AI, telemetry, Kubernetes, Terraform, observability, swarm algorithms and production hardening together. fileciteturn0file0L231-L273 fileciteturn0file0L1343-L1414

For a four-person team, this creates three risks:

- **Architecture risk:** too many independently deployable services before the core domain is stable.
- **Integration risk:** multiple contributors change contracts, database models and shared components simultaneously.
- **Delivery risk:** advanced research features consume time before the end-to-end delivery workflow works.

### New implementation policy

**Build one working vertical slice first:**

`Customer Order → Validation → Drone Assignment → Mission → Route → Simulated Telemetry → Tracking → Delivery Verification → Analytics`

Then add AI, computer vision, digital twin and swarm research around this stable core.

---

# 3. Product modules

## A. Identity and Organization

- Organization/tenant management
- User accounts
- RBAC and permission matrix
- Session management
- MFA-ready architecture
- Audit logs
- API keys for integrations

Recommended roles:

- Platform Admin
- Organization Owner
- Fleet Manager
- Mission Operator
- Dispatcher
- Maintenance Operator
- Auditor
- Customer

The expanded architecture explicitly recommends tenant isolation, RBAC, resource-level authorization and mission-specific authorization. fileciteturn0file0L1029-L1066

## B. Delivery Management

- Create order
- Recipient information
- Package dimensions and weight
- Pickup and destination
- Delivery time window
- Priority
- Assignment
- Delivery state machine
- Customer tracking
- OTP/QR delivery verification
- Proof-of-delivery evidence
- Notifications

The original project specification includes order tracking, scheduling, multi-package support, ETA and OTP/QR confirmation. fileciteturn0file1L14-L20

## C. Fleet Management

Each drone record should contain:

- Identity and registration
- Model/type
- Payload capacity
- Battery pack information
- Home/base location
- Operational status
- Maintenance status
- Current mission
- Last telemetry timestamp
- Firmware metadata
- Capabilities/sensors

Fleet metrics should include utilization, mission success, energy consumption, downtime and maintenance events. fileciteturn0file0L780-L817

## D. Mission Control

Mission states:

`DRAFT → VALIDATING → READY → AUTHORIZED → DISPATCHED → EN_ROUTE → DELIVERY_ZONE → VERIFICATION → COMPLETED`

Failure/exception states:

`HELD`, `PAUSED`, `REROUTING`, `RETURNING_HOME`, `ABORTED`, `EMERGENCY`, `FAILED`

Every state transition must be recorded in the mission event history.

## E. Geospatial Safety

- Delivery zones
- Operational geofences
- No-fly zones
- Restricted zones
- Airport/heliport proximity
- Emergency landing zones
- Approved corridors
- Altitude constraints
- Pre-flight route validation

The source architecture explicitly requires pre-flight geospatial validation and rejection when a mandatory safety constraint is violated. fileciteturn0file0L759-L775

## F. Weather Intelligence

Collect:

- Wind speed/direction
- Gusts
- Rain probability
- Visibility
- Temperature
- Severe-weather indicators

Convert weather into a mission risk score. Weather must affect routing/authorization, not only appear as a dashboard card. fileciteturn0file0L720-L755

## G. Telemetry and Live Operations

Telemetry fields:

- GPS latitude/longitude
- Altitude
- Ground speed
- Heading
- Battery state
- Link quality
- Flight mode
- Health state
- GPS quality
- Timestamp

Telemetry is treated as a streaming workload, not normal CRUD. fileciteturn0file0L569-L596

## H. AI/ML

Start with deterministic algorithms and add learned models where historical data exists.

### Route engine

Candidate routes are scored using:

- distance
- estimated flight time
- battery consumption
- weather risk
- geofencing/airspace constraints
- payload
- risk
- delivery priority

The source architecture recommends AI-assisted route scoring while keeping deterministic safety validation authoritative. fileciteturn0file0L171-L185

### ML tracks

1. ETA prediction
2. Battery prediction
3. Predictive maintenance
4. Demand forecasting
5. Route scoring
6. Computer vision

The original specification explicitly calls for predictive analytics and computer vision. fileciteturn0file1L93-L128

## I. Computer Vision

Research features:

- Landing-zone detection
- Human detection
- Obstacle/object classification
- Safe landing assessment
- Visual navigation support

Cloud inference should not be placed in the flight-critical path. Edge inference is the preferred research direction for latency-sensitive tasks. fileciteturn0file0L678-L716

## J. Emergency and Incident Management

Detection examples:

- critical battery
- communication loss
- GPS degradation
- excessive wind
- obstacle risk
- motor/flight-controller fault
- geofence violation
- crash detection
- unauthorized command

Flow:

`DETECT → CLASSIFY → LOCAL FAILSAFE → ALERT OPERATOR → UPDATE MISSION → CREATE INCIDENT → POST-INCIDENT REPORT`

This matches the source safety model. fileciteturn0file0L842-L875

## K. Digital Twin

Simulation must support:

- route replay
- normal missions
- low-battery missions
- weather degradation
- communication loss
- GPS degradation
- geofence violations
- emergency landing
- RTH
- multi-drone experiments

The simulation environment is isolated from production flight control. fileciteturn0file0L879-L907

## L. Swarm research

Swarm support is **Phase 2 research**, not a Phase 1 dependency:

- task allocation
- load balancing
- cooperative planning
- shared route intelligence
- collision-aware constraints
- reassignment

The source also recommends simulation before controlled field testing. fileciteturn0file0L911-L925

---

# 4. Recommended technical architecture

```text
                           ┌────────────────────────────┐
                           │        Next.js PWA         │
                           │ Ops + Customer + Admin UI  │
                           └─────────────┬──────────────┘
                                         │ HTTPS / WebSocket
                                         ▼
                    ┌────────────────────────────────────────┐
                    │        TypeScript API / BFF             │
                    │ Auth • RBAC • Orders • Missions • Fleet │
                    │ Routes • Delivery • Alerts • Analytics │
                    └───────────────┬────────────────────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                ▼
              PostgreSQL         Redis          Object Storage
                + PostGIS       Cache/Jobs        S3/MinIO
                    │               │
                    │               ▼
                    │        Background Workers
                    │               │
                    │       ┌───────┴────────┐
                    │       ▼                ▼
                    │  Telemetry Worker   Notification Worker
                    │
                    └───────────────┬────────────────────────┐
                                    │                         │
                                    ▼                         ▼
                           Python AI Service            Simulator
                           FastAPI + ML/Geo              PX4 SITL /
                           Route/ETA/CV                  Mock UAV
                                    │
                                    ▼
                              Model Artifacts

Optional later:
Event Bus → Kafka/NATS, separate services, Kubernetes, data warehouse
```

### Why this architecture

The previous README proposes many separate services and a Kafka/NATS/event-bus layer. fileciteturn0file0L249-L268 That is suitable for a future scale target, but not necessary for the first four-person implementation.

**Initial architecture:** modular monolith + workers + Python AI service + simulator.

**Future architecture:** split telemetry, routing, notification and analytics into independently scalable services only when measurements justify it.

---

# 5. Technology stack

## Frontend

- Next.js + TypeScript
- App Router
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zustand for genuine client state
- React Hook Form
- Zod
- MapLibre GL JS
- WebSocket client
- PWA manifest + service worker

These choices preserve the strengths of the source stack while keeping the frontend cohesive. The source architecture also calls for Next.js, TypeScript, TanStack Query, selective Zustand, map rendering and PWA capabilities. fileciteturn0file0L279-L294

## Backend

- Node.js LTS
- TypeScript
- Fastify
- Zod
- PostgreSQL driver/ORM
- PostgreSQL + PostGIS
- Redis
- BullMQ
- Pino structured logging
- OpenAPI
- WebSocket

## AI/ML

- Python 3.x
- FastAPI
- Pydantic
- NumPy
- Pandas
- scikit-learn
- OR-Tools for optimization experiments
- Shapely for geospatial logic
- OpenCV
- ONNX Runtime
- PyTorch when deep-learning training is required

## UAV / Simulation

- PX4 SITL or ArduPilot SITL
- MAVLink
- MAVSDK/Pymavlink as appropriate
- Gazebo or supported simulator

The source specification identifies PX4, ArduPilot and MAVLink as the UAV foundation. fileciteturn0file1L135-L156

## Infrastructure

Development:

- Docker Compose
- PostgreSQL/PostGIS
- Redis
- MinIO

Production later:

- Managed PostgreSQL
- Managed Redis
- S3-compatible object storage
- Container registry
- Load balancer
- CDN/WAF
- Secrets manager
- Kubernetes only when required

The source architecture identifies Docker, managed databases, object storage, observability, WAF/CDN and infrastructure-as-code as production concerns. fileciteturn0file0L389-L410

---

# 6. Monorepo structure

```text
skynav/
├── apps/
│   ├── web/                         # Next.js PWA
│   └── api/                         # Fastify modular backend
│
├── services/
│   ├── ai/                          # Python FastAPI intelligence service
│   ├── telemetry-worker/            # Telemetry normalization/processing
│   ├── notification-worker/         # Email/push/in-app notifications
│   └── simulator/                   # Mock telemetry + simulation adapters
│
├── packages/
│   ├── contracts/                   # Zod API + event schemas
│   ├── ui/                          # Shared UI components
│   ├── config/                      # Shared config conventions
│   ├── eslint-config/
│   └── typescript-config/
│
├── db/
│   ├── migrations/
│   ├── seed/
│   └── README.md
│
├── ml/
│   ├── datasets/
│   ├── notebooks/
│   ├── training/
│   ├── evaluation/
│   ├── models/
│   └── README.md
│
├── edge/
│   ├── gateway/
│   ├── mavlink/
│   ├── safety/
│   └── README.md
│
├── infra/
│   ├── docker/
│   ├── terraform/
│   └── monitoring/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── security/
│   ├── operations/
│   └── research/
│
├── tests/
│   ├── e2e/
│   ├── integration/
│   ├── load/
│   └── security/
│
├── .github/
│   ├── workflows/
│   ├── CODEOWNERS
│   └── pull_request_template.md
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── .env.example
└── README.md
```

This retains the original README's monorepo idea, but consolidates business domains inside the API until scale requires service extraction. fileciteturn0file0L1343-L1414

---

# 7. API domain structure

Inside `apps/api/src/modules/`:

```text
modules/
├── auth/
├── organizations/
├── users/
├── drones/
├── batteries/
├── orders/
├── deliveries/
├── missions/
├── routes/
├── geofences/
├── weather/
├── telemetry/
├── alerts/
├── incidents/
├── notifications/
├── analytics/
├── simulations/
└── audit/
```

Every module follows:

```text
module/
├── domain/
├── application/
├── infrastructure/
├── http/
└── tests/
```

Do not leak database/ORM objects into controllers or shared API contracts.

---

# 8. Core data model

```text
Organization
 ├── OrganizationMember ── User
 ├── Role / Permission
 ├── Drone
 │    ├── Battery
 │    └── Sensor
 ├── Order
 │    └── Package
 ├── Mission
 │    ├── MissionWaypoint
 │    ├── RouteEvaluation
 │    └── TelemetryReference
 ├── Delivery
 │    └── ProofOfDelivery
 ├── Geofence
 ├── AirspaceRestriction
 ├── WeatherSnapshot
 ├── Alert
 ├── Incident
 ├── MaintenanceRecord
 ├── Notification
 └── AuditLog
```

The source architecture identifies these core entities and explicitly requires organization/tenant scoping for tenant-owned resources. fileciteturn0file0L1199-L1249

### Important database rules

1. Every tenant-owned row has `organization_id`.
2. Every protected query must include tenant scope server-side.
3. Never trust a tenant ID from the browser without authorization.
4. Use indexes for `organization_id`, mission status, drone status, timestamps and geospatial columns.
5. Store raw/high-frequency telemetry separately from transactional entities when volume increases.

---

# 9. Mission decision pipeline

```text
Order
  ↓
Order Validation
  ↓
Payload / Time-Window Check
  ↓
Available Drone Selection
  ↓
Weather Assessment
  ↓
Geospatial Safety Validation
  ↓
Candidate Route Generation
  ↓
Route Scoring
  ↓
Battery Feasibility
  ↓
Mission Risk Score
  ↓
Human/Policy Authorization
  ↓
Simulation Check (optional policy)
  ↓
Dispatch to Simulator / Edge Gateway
```

### Safety rule

AI recommends. Rules decide.

The AI route score can rank alternatives, but it cannot authorize a route that violates a mandatory geofence, payload limit, battery reserve policy or other configured safety rule. This is directly aligned with the source architecture. fileciteturn0file0L193-L224

---

# 10. Event model

Start with an internal event bus abstraction. Do not hard-code business logic to Kafka/NATS on day one.

Events:

```text
OrderCreated
OrderValidated
DroneAssigned
MissionCreated
MissionAuthorized
MissionDispatched
TelemetryReceived
WeatherRiskChanged
RouteRecalculated
BatteryRiskChanged
GeofenceViolationDetected
MissionPaused
ReturnToHomeTriggered
EmergencyDetected
DroneLanded
DeliveryVerificationStarted
DeliveryCompleted
ProofOfDeliveryCreated
MaintenanceRequired
IncidentCreated
```

These event concepts are derived from the event model in the source README. fileciteturn0file0L1305-L1339

Every event must contain:

```json
{
  "eventId": "evt_...",
  "eventType": "MissionDispatched",
  "eventVersion": 1,
  "occurredAt": "ISO-8601",
  "organizationId": "org_...",
  "missionId": "mis_...",
  "correlationId": "corr_...",
  "payload": {}
}
```

---

# 11. Four-person team split

## Member 1 — Frontend / Experience Owner

Own:

- `apps/web`
- `packages/ui`
- map UI
- operations dashboard
- customer tracking
- admin screens
- PWA shell
- frontend tests

Primary deliverable:

`Login → Dashboard → Orders → Mission Detail → Live Map → Delivery Status`

## Member 2 — Backend / Platform Owner

Own:

- `apps/api`
- authentication
- organizations / RBAC
- database migrations
- orders
- drones
- missions
- deliveries
- audit logs
- API/OpenAPI

Primary deliverable:

A complete API and domain model that Member 1 can consume without mock business logic.

## Member 3 — AI / Data Owner

Own:

- `services/ai`
- `ml/`
- route scoring
- weather scoring
- ETA model
- battery prediction
- predictive maintenance prototype
- AI evaluation notebooks/tests

Primary deliverable:

Versioned AI endpoints with deterministic fallback behaviour and evaluation metrics.

## Member 4 — UAV / Simulation / Integration Owner

Own:

- `services/telemetry-worker`
- `services/simulator`
- `edge/`
- PX4/ArduPilot SITL integration
- MAVLink adapters
- simulated telemetry
- emergency scenarios
- integration tests
- CI support / deployment documentation

Primary deliverable:

A simulator capable of driving a real mission on the dashboard without physical hardware.

### Shared responsibility

One contributor acts as **Integration Lead** for each milestone. This role rotates; it does not mean that person writes everybody's code.

---

# 12. What each member must NOT modify casually

To avoid merge conflicts:

- Member 1 should not directly edit database migrations.
- Member 2 should not redesign shared UI components without an issue/PR.
- Member 3 should not change API response shapes without updating `packages/contracts`.
- Member 4 should not change mission-state semantics without coordinating with Member 2.
- Nobody should directly push to `main`.

Shared contracts and mission states are **architecture-owned files** and should change only through a reviewed PR.

---

# 13. Git strategy for beginners

## Branches

```text
main
 ├── develop
 │    ├── feature/auth-rbac
 │    ├── feature/order-management
 │    ├── feature/web-dashboard
 │    ├── feature/route-optimizer
 │    └── feature/simulator-telemetry
 │
 └── hotfix/...
```

Recommended simpler policy for a small team:

- `main` = always releasable
- `develop` = integration branch
- `feature/*` = individual work
- `fix/*` = bug fixes
- `hotfix/*` = urgent production fixes

Do not make long-lived personal branches.

## Initial setup

```bash
git clone <repo-url>
cd skynav
git checkout -b develop
```

Push the integration branch once:

```bash
git push -u origin develop
```

Create your feature branch:

```bash
git checkout develop
git pull --rebase origin develop
git checkout -b feature/web-dashboard
```

## Daily workflow

Before work:

```bash
git checkout develop
git pull --rebase origin develop
git checkout feature/web-dashboard
git rebase develop
```

Work locally, then:

```bash
git status
git add .
git commit -m "feat(web): add fleet dashboard"
git push -u origin feature/web-dashboard
```

Open a Pull Request:

`feature/web-dashboard → develop`

After CI passes and review is approved, merge the PR.

## Never do this

```bash
git push origin main --force
```

Do not force-push shared branches.

---

# 14. Pull Request rules

Every PR must contain:

- what changed
- why it changed
- screenshots for UI changes
- API/contract changes
- database migration notes
- test evidence
- known limitations

CI must pass:

```text
Install
 ↓
Lint
 ↓
Typecheck
 ↓
Unit tests
 ↓
Integration tests
 ↓
Build
 ↓
Security checks
```

For important workflows add E2E tests.

The source architecture also recommends linting, type checking, unit/integration testing, security scanning, builds and E2E checks in CI/CD. fileciteturn0file0L1497-L1522

---

# 15. Local installation

## Required for everyone

- Git
- Node.js LTS
- Corepack/pnpm
- Docker Desktop
- VS Code/Cursor/Antigravity/etc.

## Required for frontend/backend contributors

- Node.js
- pnpm
- Docker

## Required for AI contributor

- Python
- virtual environment tooling
- optional CUDA/GPU stack

## Required for UAV/simulation contributor

- Python
- PX4 or ArduPilot SITL
- MAVLink tooling
- supported simulator

The source quick-start also separates ordinary application prerequisites from optional UAV/ML prerequisites. fileciteturn0file0L1810-L1847

---

# 16. Initial package installation

## Root

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
```

Pin the pnpm version in the repository after the team agrees on it. Do not allow four contributors to use different package managers.

## Frontend packages

```bash
pnpm --filter web add @tanstack/react-query zustand zod react-hook-form @hookform/resolvers maplibre-gl socket.io-client
```

## Backend packages

```bash
pnpm --filter api add fastify @fastify/cors @fastify/helmet @fastify/jwt @fastify/cookie @fastify/rate-limit zod pino
```

Choose one SQL access layer and keep it centralized. Do not mix ORMs.

## Background jobs

```bash
pnpm --filter api add bullmq ioredis
```

## Testing

```bash
pnpm add -Dw vitest playwright eslint prettier typescript turbo
```

Add repository-specific test adapters only inside the packages/apps that use them.

## Python AI service

Example environment:

```bash
cd services/ai
python -m venv .venv
# activate the environment for your shell
pip install fastapi uvicorn pydantic numpy pandas scikit-learn shapely ortools opencv-python onnxruntime
```

Install PyTorch only when a deep-learning workload needs it.

---

# 17. Environment variables

Commit only `.env.example`.

```env
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skynav
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=skynav

MAP_PROVIDER_KEY=
WEATHER_PROVIDER_KEY=

AI_SERVICE_URL=http://localhost:8000

OTEL_EXPORTER_OTLP_ENDPOINT=
```

Use local `.env` files ignored by Git and secrets managers outside local development. The source README explicitly warns against committing real secrets. fileciteturn0file0L1853-L1886

---

# 18. Docker Compose local stack

Development services:

```text
postgres-postgis
redis
minio
api
web
ai-service
telemetry-worker
simulator
```

The first milestone should work with **mock telemetry**, so nobody is blocked by PX4/ArduPilot installation.

---

# 19. Testing strategy

## Unit tests

Test pure logic:

- route scoring
- battery calculations
- geofence intersection
- mission state transitions
- permission checks
- validation
- ETA calculations

## Integration tests

Test:

- API + database
- Redis jobs
- authentication
- tenant isolation
- mission authorization
- telemetry ingestion
- object storage adapters

## E2E tests

At minimum:

```text
Login
 → Create order
 → Assign drone
 → Create mission
 → Authorize mission
 → Start simulator
 → Receive telemetry
 → Show live position
 → Complete delivery
 → Verify OTP/QR
 → Create proof of delivery
```

## Safety/simulation tests

The source recommends simulation tests for low battery, weather degradation, communication loss, GPS degradation, obstacle detection, emergency landing, RTH and geofence violations. fileciteturn0file0L1585-L1598

---

# 20. Telemetry architecture

Never send every raw telemetry point directly to every browser.

```text
Simulator / UAV
      ↓
Telemetry Gateway
      ↓
Validate + authenticate + normalize
      ↓
Telemetry Worker
      ├── Current drone state → Redis
      ├── Mission state updates → API/domain
      ├── Alerts → alert engine
      ├── Historical telemetry → time-series storage
      └── Live update → WebSocket gateway
```

The expanded README explicitly recommends validating, authenticating, timestamping and normalizing telemetry before publishing it to downstream consumers. fileciteturn0file0L569-L596

---

# 21. Security architecture

Minimum controls:

- short-lived access tokens
- rotating refresh tokens
- secure cookies where applicable
- MFA-ready identity model
- RBAC + resource authorization
- tenant isolation
- audit logs
- rate limiting
- input validation
- CORS policy
- CSRF protection where cookie-authenticated requests require it
- security headers
- dependency scanning
- secret scanning
- container scanning

For sensitive drone commands:

```text
Authenticate
 → Authorize
 → Validate
 → Policy Check
 → Idempotency / Replay Check
 → Execute
 → Audit
```

The source architecture requires sensitive commands to be authenticated, authorized, validated, policy-checked, logged and protected against replay. fileciteturn0file0L1053-L1066

---

# 22. Real drone integration boundary

The browser must never receive unrestricted flight-control authority.

```text
Web/PWA
  ↓
API / Mission Service
  ↓
Secure Command Channel
  ↓
Edge Gateway
  ↓
Local Safety Checks
  ↓
MAVLink
  ↓
Flight Controller
```

The source architecture explicitly states that public browser/cloud access should not expose unrestricted flight-control commands and that local failsafes must remain possible during connectivity loss. fileciteturn0file0L470-L503

---

# 23. Dashboard information architecture

## Operations dashboard

Top-level cards:

- Active missions
- Active drones
- Deliveries today
- Failed/held missions
- Current alerts
- Fleet battery overview

Main workspace:

`Live Map | Mission Queue | Alerts | Drone Health`

Secondary pages:

- Missions
- Orders
- Fleet
- Drone detail
- Routes
- Geofences
- Weather
- Incidents
- Analytics
- Audit logs

## Customer application

- Create/order
- Order status
- Live tracking
- ETA
- Delivery verification
- Delivery history
- Feedback

The source document explicitly defines these customer functions and notification stages. fileciteturn0file1L80-L92

---

# 24. Development phases

## Phase 0 — Team Foundation

Deliver:

- monorepo
- branch protection
- CI
- environment templates
- shared contracts
- database connection
- health checks
- lint/typecheck/test commands

## Phase 1 — Core Vertical Slice

Deliver:

- auth
- organization
- RBAC
- drone registry
- order creation
- mission creation
- assignment
- route preview
- simulator telemetry
- live map
- delivery completion

**Milestone:** a complete simulated delivery works end-to-end.

## Phase 2 — Safety and Operations

Deliver:

- geofences
- weather risk
- battery rules
- mission authorization
- alerts
- incidents
- RTH logic in simulation
- audit logs

## Phase 3 — AI Intelligence

Deliver:

- route scoring
- ETA model
- battery prediction
- maintenance prediction
- demand forecasting

## Phase 4 — Computer Vision

Deliver:

- obstacle/object detection
- landing zone detection
- inference benchmarks
- edge inference prototype

## Phase 5 — Digital Twin

Deliver:

- scenario builder
- mission replay
- failure injection
- route comparison
- simulation reports

## Phase 6 — Swarm Research

Deliver only after simulation is stable:

- task allocation
- multi-drone scheduling
- reassignment
- collision-aware planning

## Phase 7 — Production Hardening

Deliver:

- SLOs
- load tests
- threat model
- penetration testing
- backups
- disaster recovery
- observability
- deployment automation

This sequencing compresses the source's eight-phase roadmap into a team-executable delivery plan while preserving its major feature families. fileciteturn0file0L1725-L1805

---

# 25. Definition of Done

A feature is not finished when the code runs locally.

A feature is Done when:

- API/contract is documented
- input validation exists
- authorization exists
- tests exist
- logs are useful
- errors are handled
- frontend state is correct
- loading/empty/error states exist
- tenant isolation is preserved
- CI passes
- documentation is updated
- another teammate can run it from a clean clone

---

# 26. AI coding-agent rules

Because the team may use Cursor, Codex, Antigravity, Kiro, Trae, Devin or similar agents, every agent must obey the repository's architecture rules.

Create `/AGENTS.md` containing the project rules.

Minimum rules:

1. Never commit directly to `main`.
2. Read `README.md`, `/AGENTS.md`, relevant module documentation and existing tests before changing code.
3. Do not invent APIs or database fields when an existing contract exists.
4. Do not modify shared contracts without a migration plan and tests.
5. Do not change mission states casually.
6. Do not add a new library when an existing dependency already solves the problem.
7. Do not put business logic in React components.
8. Do not put business logic inside database models.
9. Do not bypass authorization for development convenience.
10. Every new endpoint needs validation and tests.
11. Every new event needs a versioned schema.
12. AI recommendations must not bypass deterministic safety rules.
13. Simulation code must remain separate from production flight-control code.
14. Never commit secrets.
15. Keep pull requests focused on one feature/fix.

---

# 27. Recommended branch ownership

| Area | Owner | Main paths |
|---|---|---|
| Web/PWA | Member 1 | `apps/web`, `packages/ui` |
| API/DB | Member 2 | `apps/api`, `db`, `packages/contracts` |
| AI/ML | Member 3 | `services/ai`, `ml` |
| Simulation/Telemetry | Member 4 | `services/simulator`, `services/telemetry-worker`, `edge` |
| CI/Infra | Shared, rotated | `.github`, `infra` |
| Docs | Shared, feature owner updates | `docs` |

Do not split ownership by arbitrary file count. Split by **domain boundaries**.

---

# 28. First two weeks of teamwork

## Day 1

All four:

- clone repository
- install dependencies
- verify `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- run Docker Compose
- create personal feature branch

## Days 2–3

Member 1: shell + authentication screens

Member 2: auth/org/RBAC + DB foundation

Member 3: AI service skeleton + route scorer interface

Member 4: simulator + telemetry schema + WebSocket proof of concept

## Days 4–7

Integrate:

`Login → Order → Mission → Simulator → Live Map`

## Days 8–10

Add:

- assignment
- route scoring
- battery logic
- geofence validation
- delivery verification
- audit log

At the end of the second week, there should be one complete simulated mission rather than ten disconnected demos.

---

# 29. Commands the team should standardize

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm db:migrate
pnpm db:seed
pnpm docker:up
pnpm docker:down
```

The exact script names can differ, but every contributor must use the same commands from a clean clone.

---

# 30. Architecture principles

1. **Safety before optimization.**
2. **AI assists; deterministic safety rules govern.**
3. **Simulation before physical UAV deployment.**
4. **Telemetry is a separate workload.**
5. **Tenant isolation is enforced server-side.**
6. **Every sensitive action is auditable.**
7. **Providers are accessed through adapters.**
8. **Shared contracts are versioned.**
9. **A feature must be testable without another developer's laptop.**
10. **Do not introduce microservices merely because the architecture diagram looks impressive.**

These principles preserve the core project direction in the source README while making it practical for a small development team. fileciteturn0file0L1926-L1971

---

# 31. What is MVP vs advanced research

## MVP

- auth/RBAC
- organizations
- drones
- orders
- missions
- route preview
- fleet map
- mock telemetry
- geofencing
- weather integration
- battery rules
- delivery OTP/QR
- notifications
- analytics
- audit logs
- PWA

## Advanced

- learned ETA
- battery prediction
- predictive maintenance
- computer vision
- digital twin
- swarm planning
- PX4/ArduPilot integration
- edge inference

This separation is essential. The original project asks for all of these feature classes, but they do not need to be implemented at the same time. fileciteturn0file1L101-L134

---

# 32. Success criteria for the project

The final demonstration should show a single story:

```text
Customer places order
        ↓
System validates package + destination
        ↓
Best available drone is selected
        ↓
Weather + geofence + battery are checked
        ↓
Route candidates are scored
        ↓
Operator authorizes mission
        ↓
Simulator/UAV starts mission
        ↓
Dashboard receives live telemetry
        ↓
System detects a risk and reacts
        ↓
Drone reaches delivery zone
        ↓
Recipient verifies with OTP/QR
        ↓
Proof of delivery is stored
        ↓
Analytics update
        ↓
Mission history + audit trail remain available
```

That one vertical story demonstrates most of the important architecture without requiring every research feature to be production-ready.

---

# 33. Safety and regulatory disclaimer

SkyNav is a software/research platform. Real-world UAV operation requires suitable hardware, qualified operators, approved procedures, airspace permissions and compliance with applicable aviation and privacy requirements. Experimental autonomy, swarm behaviour and AI-generated decisions must be validated in simulation and appropriately controlled before any physical deployment.

This matches the source project's explicit operational-safety disclaimer. fileciteturn0file0L1705-L1721 fileciteturn0file0L1984-L1988

---

# 34. Project mantra

> **Plan. Validate. Authorize. Simulate. Fly. Deliver. Learn.**

SkyNav is strongest when it is presented not as “a website controlling drones,” but as an **AI-assisted UAV logistics operating platform with safety-aware orchestration, fleet intelligence, simulation, real-time telemetry and secure delivery workflows**. fileciteturn0file0L1962-L1971
