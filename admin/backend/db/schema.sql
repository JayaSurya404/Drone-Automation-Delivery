-- ══════════════════════════════════════════════════════════════════════════════
-- SKYNAV DRONE ADMIN - RELATIONAL DATABASE SCHEMA (SQLITE)
-- ══════════════════════════════════════════════════════════════════════════════

PRAGMA foreign_keys = ON;

-- 1. ADMIN USERS & OPERATORS
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'ops_admin', 'fleet_manager', 'dispatch_manager', 'support_admin', 'analytics_admin', 'analyst')),
  phone TEXT,
  avatar TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- 2. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image TEXT,
  icon TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. PRODUCTS (Admin is Source of Truth)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  brand TEXT,
  category_id TEXT NOT NULL,
  sub_category TEXT,
  description TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  stock_count INTEGER NOT NULL DEFAULT 50 CHECK (stock_count >= 0),
  weight_grams INTEGER NOT NULL DEFAULT 250 CHECK (weight_grams >= 0),
  is_drone_eligible INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  image TEXT NOT NULL,
  badge TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_admin_products_category ON products(category_id);

-- 4. DRONES FLEET
CREATE TABLE IF NOT EXISTS drones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT UNIQUE NOT NULL,
  registration TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'in_flight', 'returning', 'charging', 'maintenance', 'offline', 'emergency')),
  battery INTEGER NOT NULL DEFAULT 100 CHECK (battery BETWEEN 0 AND 100),
  battery_health INTEGER NOT NULL DEFAULT 95 CHECK (battery_health BETWEEN 0 AND 100),
  battery_cycles INTEGER NOT NULL DEFAULT 50,
  payload_capacity REAL NOT NULL DEFAULT 4.5,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  altitude REAL NOT NULL DEFAULT 0,
  heading REAL NOT NULL DEFAULT 0,
  speed REAL NOT NULL DEFAULT 0,
  current_mission_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_drones_status ON drones(status);

-- 5. OPERATIONAL ORDERS (Dispatch Queue)
CREATE TABLE IF NOT EXISTS operational_orders (
  id TEXT PRIMARY KEY,
  customer_order_id TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  package_name TEXT NOT NULL,
  package_weight_kg REAL NOT NULL,
  items_json TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  pickup_lat REAL NOT NULL,
  pickup_lng REAL NOT NULL,
  destination_address TEXT NOT NULL,
  destination_lat REAL NOT NULL,
  destination_lng REAL NOT NULL,
  delivery_speed TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'pending_dispatch', 'accepted', 'packing', 'packed', 'ready_for_dispatch',
    'drone_assigned', 'in_flight', 'arriving', 'delivered', 'cancelled', 'failed'
  )),
  drone_id TEXT,
  mission_id TEXT,
  handover_otp TEXT NOT NULL,
  total_amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_operational_orders_status ON operational_orders(status);
CREATE INDEX IF NOT EXISTS idx_operational_orders_customer_id ON operational_orders(customer_order_id);

-- 6. MISSIONS
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  operational_order_id TEXT UNIQUE NOT NULL,
  customer_order_id TEXT NOT NULL,
  drone_id TEXT NOT NULL,
  planned_route_json TEXT NOT NULL,
  actual_route_json TEXT NOT NULL,
  distance_km REAL NOT NULL,
  estimated_duration_minutes INTEGER NOT NULL,
  current_status TEXT NOT NULL DEFAULT 'created' CHECK (current_status IN (
    'created', 'assigned', 'in_flight', 'approaching', 'delivered', 'returning', 'completed', 'failed', 'cancelled', 'emergency'
  )),
  current_latitude REAL NOT NULL,
  current_longitude REAL NOT NULL,
  current_altitude REAL NOT NULL DEFAULT 0,
  current_speed REAL NOT NULL DEFAULT 0,
  current_bearing REAL NOT NULL DEFAULT 0,
  remaining_distance_km REAL NOT NULL DEFAULT 0,
  eta_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  start_time TEXT,
  completion_time TEXT,
  FOREIGN KEY (operational_order_id) REFERENCES operational_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_missions_drone ON missions(drone_id);
CREATE INDEX IF NOT EXISTS idx_missions_order ON missions(operational_order_id);

-- 7. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_name TEXT NOT NULL,
  admin_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('Info', 'Warning', 'Critical')),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- 8. EMERGENCY ALERTS
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id TEXT PRIMARY KEY,
  drone_id TEXT NOT NULL,
  mission_id TEXT,
  issue_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Critical',
  battery_level INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  message TEXT NOT NULL
);
