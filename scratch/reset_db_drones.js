import Database from 'better-sqlite3';
const db = new Database('./admin/backend/data/admin.db');
db.prepare("UPDATE drones SET status = 'available', latitude = 11.1132, longitude = 77.0277, altitude = 0, speed = 0, battery = 100, current_mission_id = NULL WHERE id = 'D-001'").run();
console.log('Drone D-001 successfully reset to available at SkyHub Kurumbapalayam (11.1132, 77.0277)');
