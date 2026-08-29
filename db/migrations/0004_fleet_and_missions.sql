-- Migration 0004: Fleet and Mission Dispatch Schema Extensions

-- Drones table extensions
ALTER TABLE drones ADD COLUMN IF NOT EXISTS call_sign text;
ALTER TABLE drones ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'SkyNav Hexacopter Alpha';
ALTER TABLE drones ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE drones ADD COLUMN IF NOT EXISTS max_payload_grams integer NOT NULL DEFAULT 5000 CHECK (max_payload_grams >= 0);
ALTER TABLE drones ADD COLUMN IF NOT EXISTS battery_percent double precision NOT NULL DEFAULT 100 CHECK (battery_percent >= 0 AND battery_percent <= 100);
ALTER TABLE drones ADD COLUMN IF NOT EXISTS current_latitude double precision NOT NULL DEFAULT 37.7749;
ALTER TABLE drones ADD COLUMN IF NOT EXISTS current_longitude double precision NOT NULL DEFAULT -122.4194;
ALTER TABLE drones ADD COLUMN IF NOT EXISTS current_altitude_meters double precision NOT NULL DEFAULT 0;
ALTER TABLE drones ADD COLUMN IF NOT EXISTS home_latitude double precision NOT NULL DEFAULT 37.7749;
ALTER TABLE drones ADD COLUMN IF NOT EXISTS home_longitude double precision NOT NULL DEFAULT -122.4194;
ALTER TABLE drones ADD COLUMN IF NOT EXISTS home_altitude_meters double precision NOT NULL DEFAULT 0;
ALTER TABLE drones ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE drones ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Ensure call_sign is unique per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_drones_org_call_sign ON drones (organization_id, call_sign);
CREATE INDEX IF NOT EXISTS idx_drones_org_status ON drones (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_drones_org_created ON drones (organization_id, created_at DESC);

-- Missions table extensions
ALTER TABLE missions ADD COLUMN IF NOT EXISTS mission_number text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS origin_latitude double precision NOT NULL DEFAULT 37.7749;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS origin_longitude double precision NOT NULL DEFAULT -122.4194;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS origin_altitude_meters double precision DEFAULT 0;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS origin_address text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS destination_latitude double precision NOT NULL DEFAULT 37.7833;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS destination_longitude double precision NOT NULL DEFAULT -122.4167;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS destination_altitude_meters double precision DEFAULT 15;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS destination_address text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS launched_at timestamptz;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS failed_at timestamptz;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS failure_reason text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS emergency_at timestamptz;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS emergency_reason text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Unique tracking index for mission_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_missions_mission_number ON missions (mission_number);

-- Partial index preventing duplicate active missions for the same order
CREATE UNIQUE INDEX IF NOT EXISTS idx_missions_order_active ON missions (order_id)
  WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'FAILED', 'ABORTED');

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_missions_org_created ON missions (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missions_org_status ON missions (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_missions_drone_id ON missions (drone_id);
CREATE INDEX IF NOT EXISTS idx_missions_order_id ON missions (order_id);
