# drone-simulator

A standalone process implementing the ambient/demo side of blueprint Section
S's `DroneAdapter` v1 — introduced in **Phase 6 — Drone and Fleet
Management**. It patrols a configured list of already-registered `Drone`
ids back and forth around a fixed home coordinate, pushing telemetry to
`apps/api`'s service-authenticated internal ingest endpoint
(`POST /api/v1/internal/telemetry`) on an interval, and exposes a small
dev-only HTTP control surface for injecting fault scenarios.

This is deliberately independent of the `Mission`/delivery-flight engine —
that lives in-process inside `apps/api` (`SimulatedDroneAdapter`, driven by
`MissionsService`) so mission state transitions stay transactional with
Postgres. This process exists to exercise the telemetry-ingest pipeline and
fault-injection scenarios end-to-end, on demand, independent of any real
delivery. **Don't point it at a drone that's currently flying a real
mission** — both write to the same `Drone` row via the same ingest path.

See `docs/SETUP.md` "Running the drone simulator" for how to run and control
it locally, and `docs/ARCHITECTURE.md` "Drone & Fleet Management" for the
full design rationale.

## Local usage

```bash
# 1. Register a drone (admin console, or `pnpm db:seed`'s demo fleet already has two)
# 2. Set SIMULATOR_DRONE_IDS in .env to its id(s), comma-separated
# 3. Run it
pnpm --filter @skynav/drone-simulator dev
```

Control endpoints (default `http://localhost:4100`):

```bash
# Current in-memory state of every simulated drone
curl http://localhost:4100/state

# Inject a fault on the next tick (LOW_BATTERY | SIGNAL_LOSS | CRASH)
curl -X POST http://localhost:4100/faults/<droneId> \
  -H "Content-Type: application/json" \
  -d '{"fault":"LOW_BATTERY"}'
```
