const Database = require('better-sqlite3');
const path = require('path');

const custDbPath = path.resolve('customer/backend/data/skynav.db');
const custDb = new Database(custDbPath);
custDb.prepare("UPDATE orders SET status = 'Out for Delivery', completed_at = NULL WHERE id = 'ORD-1002'").run();
custDb.prepare("UPDATE deliveries SET status = 'IN_FLIGHT', current_latitude = 11.1132, current_longitude = 77.0277, current_altitude = 0, current_speed = 0, current_bearing = 185, completed_at = NULL WHERE order_id = 'ORD-1002'").run();
console.log('Customer DB reset:', custDb.prepare('SELECT id, status, completed_at FROM orders WHERE id = ?').get('ORD-1002'));
console.log('Customer Delivery reset:', custDb.prepare('SELECT order_id, status, current_latitude, current_longitude FROM deliveries WHERE order_id = ?').get('ORD-1002'));
custDb.close();

const adminDbPath = path.resolve('admin/backend/data/admin.db');
const adminDb = new Database(adminDbPath);
adminDb.prepare("UPDATE operational_orders SET status = 'pending_dispatch', drone_id = NULL, mission_id = NULL WHERE id = 'ORD-1002'").run();
adminDb.prepare("UPDATE drones SET status = 'available', current_mission_id = NULL WHERE id = 'D-001'").run();
adminDb.prepare("DELETE FROM missions WHERE operational_order_id = 'ORD-1002'").run();
console.log('Admin DB reset:', adminDb.prepare('SELECT id, status FROM operational_orders WHERE id = ?').get('ORD-1002'));
adminDb.close();
