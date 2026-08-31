# Backup, Disaster Recovery & State Continuity Guide

Operational guide for state continuity, backup strategies, and recovery procedures across the SkyNav digital-twin platform.

---

## 1. Authoritative State Hierarchy

| Tier | Subsystem | Storage Mechanism | State Role | Disaster Recovery Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1 (Authoritative)** | Domain & Persistence | PostgreSQL + PostGIS | Durable source of truth for identities, orders, fleet inventory, missions, outbox records, and audit trails. | Automated WAL archiving, daily full snapshot dumps, point-in-time recovery (PITR). |
| **Tier 2 (Transient)** | Realtime Event Bus | Redis 7 | High-throughput telemetry streaming, WebSocket pub/sub fanout, transient cache. | AOF (Append-Only File) enabled; graceful fallback and automatic client reconnection. |
| **Tier 3 (Observational)** | Digital Twin & Telemetry | In-Memory / API | Analytical twin representation, discrepancy detection, health indicators. | Reconstructed automatically upon receiving live telemetry and domain state from Tier 1. |
| **Tier 4 (Advisory)** | AI & Perception | Python Microservice | Advisory route scoring, ETA prediction, CV hazard classification. | 100% Stateless; requires zero backup. |
| **Tier 5 (Simulation)** | Deterministic Simulator | In-Memory Kinematics | 3D flight kinematics and virtual battery discharge. | Pure deterministic simulator clock; non-persistent. |

---

## 2. PostgreSQL Backup & Restore Procedures

### 2.1 Automated Snapshot Dumps
To create an uncompressed logical backup of the authoritative database:
```bash
# Dump complete schema and table data
pg_dump -h localhost -p 5432 -U skynav -d skynav -F c -b -v -f /backups/skynav_$(date +%Y%m%d_%H%M%S).dump
```

### 2.2 Restoring from Snapshot
To restore a snapshot into a clean target database:
```bash
# 1. Terminate active application connections
# 2. Restore into target database
pg_restore -h localhost -p 5432 -U skynav -d skynav -v /backups/skynav_snapshot.dump
```

### 2.3 Migration Rollback Strategy
- Database migrations are versioned sequentially under `db/migrations/` and tracked in `_schema_migrations`.
- Never execute arbitrary `DROP SCHEMA` or `DROP DATABASE` scripts in production.
- If a migration must be reverted, write a forward-compensating migration file (e.g., `0005_revert_feature_x.sql`) and apply it using `pnpm db:migrate`.

---

## 3. Redis Persistence & Worker Reconnection

- **Persistence Mode**: Redis is configured with `--appendonly yes` (`AOF`), providing durability for cached states and outbox pub/sub replay without blocking high-throughput streams.
- **Worker Reconnect Resilience**:
  - `TelemetryWorker` and `NotificationWorker` employ exponential backoff reconnection strategies (`Math.min(times * 100, 3000)`).
  - When Redis restarts or network partitions heal, workers automatically re-establish subscriptions without crashing or unbounded memory accumulation.

---

## 4. Transactional Outbox & Dead-Letter Recovery

1. **Atomic Outbox Writes**: Domain operations (e.g. order creation, mission dispatch, fleet status updates) write domain events atomically within the database transaction to `outbox_events`.
2. **Idempotent Delivery**: The outbox worker polls `outbox_events`, publishes to Redis, and marks records `processed_at = now()`.
3. **Poison Message Isolation**:
   - If an event fails publication repeatedly ($> 5$ attempts), it is retained with `attempts` incremented and `last_error` recorded.
   - Operations teams can inspect dead-letter records via:
     ```sql
     SELECT id, event_type, attempts, last_error, occurred_at
     FROM outbox_events
     WHERE processed_at IS NULL AND attempts >= 5;
     ```
   - Retrying dead-letter events can be performed by resetting `attempts = 0`.

---

## 5. Emergency Recovery Verification

Before releasing any recovery procedure:
1. Validate database consistency with `SELECT count(*) FROM _schema_migrations;`.
2. Verify API readiness with `GET http://localhost:3001/ready`.
3. Verify telemetry flow on WebSocket gateway.
