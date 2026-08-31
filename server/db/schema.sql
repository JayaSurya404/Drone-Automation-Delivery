-- ══════════════════════════════════════════════════════════════════════════════
-- SKYNAV DRONE E-COMMERCE - RELATIONAL DATABASE SCHEMA (SQLITE / POSTGRES-READY)
-- ══════════════════════════════════════════════════════════════════════════════

PRAGMA foreign_keys = ON;

-- 1. USERS & PROFILES
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'pending_verification', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. NOTIFICATION PREFERENCES
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY,
  email_updates INTEGER NOT NULL DEFAULT 1,
  sms_alerts INTEGER NOT NULL DEFAULT 1,
  drone_proximity_sound INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. CATEGORIES
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

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- 4. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  brand TEXT,
  category_id TEXT NOT NULL,
  sub_category TEXT,
  description TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  original_price REAL CHECK (original_price >= price),
  discount_percent INTEGER DEFAULT 0,
  rating REAL NOT NULL DEFAULT 5.0,
  review_count INTEGER NOT NULL DEFAULT 0,
  image TEXT NOT NULL,
  images_json TEXT, -- JSON array of extra images
  is_drone_eligible INTEGER NOT NULL DEFAULT 1,
  max_payload_kg REAL NOT NULL DEFAULT 2.5,
  estimated_delivery_mins INTEGER NOT NULL DEFAULT 15,
  in_stock INTEGER NOT NULL DEFAULT 1,
  stock_count INTEGER NOT NULL DEFAULT 50,
  badge TEXT,
  features_json TEXT, -- JSON array of feature bullets
  specifications_json TEXT, -- JSON object of specs
  dimensions TEXT,
  weight_grams INTEGER NOT NULL DEFAULT 250,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating);
CREATE INDEX IF NOT EXISTS idx_products_drone_eligible ON products(is_drone_eligible);

-- 5. ADDRESSES / SAVED DROP ZONES
CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Home' CHECK (label IN ('Home', 'Office', 'Other')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  building TEXT NOT NULL,
  street TEXT NOT NULL,
  area TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  instructions TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  drop_zone_type TEXT NOT NULL DEFAULT 'Lawn' CHECK (drop_zone_type IN ('Lawn', 'Rooftop Pad', 'Balcony Landing', 'Driveway', 'Designated Station')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_addresses_customer ON addresses(customer_id);

-- 6. CARTS & CART ITEMS
CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  customer_id TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cart_id, product_id),
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);

-- 7. WISHLISTS & WISHLIST ITEMS
CREATE TABLE IF NOT EXISTS wishlists (
  id TEXT PRIMARY KEY,
  customer_id TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id TEXT PRIMARY KEY,
  wishlist_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(wishlist_id, product_id),
  FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist ON wishlist_items(wishlist_id);

-- 8. FULFILLMENT HUBS & DELIVERY ZONES
CREATE TABLE IF NOT EXISTS delivery_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hub_name TEXT NOT NULL,
  hub_latitude REAL NOT NULL,
  hub_longitude REAL NOT NULL,
  radius_km REAL NOT NULL DEFAULT 15.0,
  max_drone_weight_kg REAL NOT NULL DEFAULT 5.0,
  base_fee REAL NOT NULL DEFAULT 3.99,
  express_surcharge REAL NOT NULL DEFAULT 3.50,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'WEATHER_HOLD', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. DRONES FLEET
CREATE TABLE IF NOT EXISTS drones (
  id TEXT PRIMARY KEY,
  identifier TEXT UNIQUE NOT NULL,
  model TEXT NOT NULL DEFAULT 'SkyNav Aero-X4 Cargo',
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ASSIGNED', 'IN_FLIGHT', 'RETURNING', 'CHARGING', 'MAINTENANCE', 'OFFLINE')),
  battery_level INTEGER NOT NULL DEFAULT 100 CHECK (battery_level BETWEEN 0 AND 100),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  altitude REAL NOT NULL DEFAULT 0,
  heading REAL NOT NULL DEFAULT 0,
  speed_kmh REAL NOT NULL DEFAULT 0,
  max_payload_kg REAL NOT NULL DEFAULT 4.0,
  current_delivery_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  subtotal REAL NOT NULL,
  delivery_fee REAL NOT NULL,
  tax REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Credit Card', 'Debit Card', 'UPI', 'Wallet', 'Net Banking')),
  payment_status TEXT NOT NULL DEFAULT 'Paid' CHECK (payment_status IN ('Pending', 'Paid', 'Refunded', 'Failed')),
  status TEXT NOT NULL DEFAULT 'Order Placed' CHECK (status IN (
    'Order Placed', 'Order Confirmed', 'Preparing', 'Drone Assigned', 'Drone Preparing',
    'Drone Launched', 'Out for Delivery', 'Near Destination', 'Arriving', 'Delivered',
    'Delayed', 'Cancelled', 'Delivery Failed', 'Returning'
  )),
  delivery_speed TEXT NOT NULL DEFAULT 'standard' CHECK (delivery_speed IN ('standard', 'express', 'scheduled')),
  scheduled_time TEXT,
  delivery_address_json TEXT NOT NULL, -- Snapshot of the address at order time
  delivery_instructions TEXT,
  drop_zone_type TEXT NOT NULL DEFAULT 'Lawn',
  delivery_otp TEXT NOT NULL,
  is_cancellable INTEGER NOT NULL DEFAULT 1,
  estimated_delivery_time TEXT NOT NULL,
  estimated_arrival_timestamp TEXT,
  cancellation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- 11. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_image TEXT NOT NULL,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  total_price REAL NOT NULL,
  weight_grams INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 12. ORDER STATUS TIMELINE HISTORY
CREATE TABLE IF NOT EXISTS order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  description TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 1,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);

-- 13. ACTIVE DELIVERIES & FLIGHT TELEMETRY
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  drone_id TEXT,
  status TEXT NOT NULL DEFAULT 'PREPARING',
  pickup_latitude REAL NOT NULL,
  pickup_longitude REAL NOT NULL,
  destination_latitude REAL NOT NULL,
  destination_longitude REAL NOT NULL,
  flight_route_json TEXT NOT NULL, -- Array of [lat, lng] waypoints
  current_latitude REAL NOT NULL,
  current_longitude REAL NOT NULL,
  current_altitude REAL NOT NULL DEFAULT 0,
  current_speed REAL NOT NULL DEFAULT 0,
  current_bearing REAL NOT NULL DEFAULT 0,
  remaining_distance_km REAL NOT NULL DEFAULT 0,
  estimated_arrival_mins INTEGER NOT NULL DEFAULT 15,
  handover_otp TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);

-- 14. NOTIFICATIONS WITH EVENT DEDUPLICATION
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('order', 'delivery', 'promo', 'security', 'system')),
  is_read INTEGER NOT NULL DEFAULT 0,
  order_id TEXT,
  event_id TEXT UNIQUE, -- Ensures idempotency & deduplication
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications(event_id);

-- 15. REVIEWS & RATINGS
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  order_id TEXT,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  rating REAL NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  comment TEXT NOT NULL,
  verified_purchase INTEGER NOT NULL DEFAULT 1,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

-- 16. SUPPORT TICKETS & MESSAGES
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  order_id TEXT,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Delivery Inquiry', 'Order Issue', 'Payment Problem', 'Drone Landing Issue', 'Account & App', 'General Inquiry')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system')),
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_customer ON support_tickets(customer_id);

-- 17. FAQS
CREATE TABLE IF NOT EXISTS faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 18. VERIFICATION & PASSWORD RESET TOKENS
CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email_verification', 'password_reset')),
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  verified_at TEXT,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tokens_user_type ON verification_tokens(user_id, type);

