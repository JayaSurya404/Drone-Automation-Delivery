# SkyNav Architecture

## Product boundary

SkyNav exposes Customer Portal, Admin Control Center, and Drone Simulation. The first vertical slice is order creation through simulated delivery and verification; advanced intelligence remains behind stable contracts.

## Runtime boundary

`apps/web` communicates with `apps/api` through versioned REST/realtime interfaces. The API coordinates orders, drones, missions, authorization, and audit. It owns tenant authorization and persistence. Redis is for caching, locks, rate limiting, temporary mission state, queues, and selective realtime fanout.

The telemetry worker validates, normalizes, authenticates, persists, and publishes telemetry; UIs receive only view-appropriate updates. The simulator emits simulation data and does not command real flight hardware. The AI service returns advisory scores; API safety policies remain authoritative.

## Data boundary

PostgreSQL/PostGIS is transactional and geospatial storage. Each tenant-owned table carries `organization_id`; repository queries must scope it server-side. High-frequency raw telemetry is not part of the ordinary transactional schema—only metadata is initialized here pending a time-series decision.

## API boundary

Public endpoints will live below `/api/v1`. Every external request requires boundary validation, authentication where applicable, resource authorization, tenant scoping, and audit logging for sensitive operations. Shared wire schemas are defined only in `packages/contracts`.

## Safety pipeline

`Plan → Validate → Score → Safety Check → Authorize → Execute`

AI route scores are advisory. Mandatory geofence, payload, battery, weather, operator, and emergency policies cannot be overridden by AI or the client.
