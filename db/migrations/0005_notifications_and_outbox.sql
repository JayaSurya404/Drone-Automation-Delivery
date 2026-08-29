-- Migration 0005: Event-Driven Notifications and Transactional Outbox

CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  actor_id uuid REFERENCES users(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text
);

CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed ON outbox_events (occurred_at ASC) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_org_created ON outbox_events (organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON outbox_events (aggregate_type, aggregate_id);

-- Notifications table extensions
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Notification';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'INFO';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS aggregate_type text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS aggregate_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Idempotency constraint: Same event cannot create duplicate notification for same recipient
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_recipient ON notifications (event_id, user_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_org_user_created ON notifications (organization_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_org_created ON notifications (organization_id, created_at DESC);
