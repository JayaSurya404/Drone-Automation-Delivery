# SkyNav Project State

## Current milestone

Milestone 1 — Foundation

## Foundation status

Bootstrap implementation complete; verification pending dependency installation.

## Completed

- pnpm workspace and Turbo task graph
- Next.js web shell with customer/admin/tracking feature boundaries
- Fastify API health and module-discovery skeleton
- runtime-safe shared contracts for mission state, telemetry, coordinates, and event envelopes
- PostGIS migration foundation with tenant-owned core entities
- Redis/PostGIS local Docker Compose stack
- simulator, telemetry, notification, and Python AI service interfaces
- repository, deployment, security, operations, test, ML, and edge directory foundations

## Remaining

- choose and implement the database migration runner/adapter
- implement identity, RBAC, and server-side authorization middleware
- implement the first order-to-simulated-delivery vertical slice
- add module tests, integration tests, E2E tests, CI quality gates, and deployment configuration
- choose realtime transport and telemetry time-series persistence strategy

## Recommended next step

Implement the identity and organization foundation in `apps/api`, including tenant-scoped request context, RBAC, audit logging, and integration tests before adding order or mission endpoints.

## Important decisions

- simulation-first
- PostgreSQL/PostGIS and Redis locally
- contracts-first integration
- AI is advisory; deterministic safety policy authorizes missions
