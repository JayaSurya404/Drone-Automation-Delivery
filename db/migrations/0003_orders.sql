-- Migration 0003: Orders Domain and Delivery Locations Extension

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'STANDARD';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_latitude double precision NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_longitude double precision NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_altitude_meters double precision DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_address text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_latitude double precision NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_longitude double precision NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_altitude_meters double precision DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_weight_grams integer NOT NULL DEFAULT 100 CHECK (package_weight_grams > 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_length_cm integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_width_cm integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_height_cm integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_description text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS failure_reason text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS failed_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_org_created ON orders(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_org_status ON orders(organization_id, status);
