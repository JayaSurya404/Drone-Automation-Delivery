import Database from 'better-sqlite3';

const db = new Database('customer/backend/data/skynav.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Customer DB Tables:', tables.map((t: any) => t.name));

const orders = db.prepare('SELECT id, status, delivery_address_json FROM orders').all();
console.log('Orders:', orders);

try {
  const drones = db.prepare('SELECT id, identifier, latitude, longitude, altitude, status FROM drones').all();
  console.log('Drones:', drones);
} catch (e: any) {
  console.log('Drones table error:', e.message);
}
