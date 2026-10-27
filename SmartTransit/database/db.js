
"use strict";

// ========================================
// SmartTransit - SQLite Database
// File: database/db.js
// ========================================

const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, "smarttransit.db");
const db = new DatabaseSync(dbPath);

db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL
      CHECK (length(trim(full_name)) > 0),
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trips (
    trip_id TEXT PRIMARY KEY,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    price_per_passenger REAL NOT NULL
      CHECK (price_per_passenger >= 0),
    capacity INTEGER NOT NULL
      CHECK (capacity >= 1),
    is_active INTEGER NOT NULL DEFAULT 1
      CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (origin <> destination)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_code TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    trip_id TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    travel_date TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    passengers INTEGER NOT NULL
      CHECK (passengers >= 1),
    price_per_passenger REAL NOT NULL
      CHECK (price_per_passenger >= 0),
    total_price REAL NOT NULL
      CHECK (total_price >= 0),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed'
      CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id)
      REFERENCES users(user_id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_user_id
    ON bookings(user_id);

  CREATE INDEX IF NOT EXISTS idx_bookings_travel_date
    ON bookings(travel_date);

  CREATE INDEX IF NOT EXISTS idx_bookings_trip_date_status
    ON bookings(trip_id, travel_date, status);
`);

// เพิ่มคอลัมน์ในฐานข้อมูลเดิมแบบไม่ลบข้อมูล
function addColumnIfMissing(tableName, columnName, definition) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all();

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
    );
  }
}

addColumnIfMissing("bookings", "contact_phone", "TEXT");
addColumnIfMissing("bookings", "contact_email", "TEXT");
addColumnIfMissing("bookings", "full_name", "TEXT");

// เพิ่มเที่ยวรถตัวอย่างเฉพาะรหัสที่ยังไม่มีในฐานข้อมูล
// ความจุเป็นค่าเริ่มต้นสำหรับทดสอบ สามารถปรับตามข้อมูลจริงได้
const seedTrips = db.prepare(`
  INSERT OR IGNORE INTO trips (
    trip_id,
    origin,
    destination,
    departure_time,
    arrival_time,
    price_per_passenger,
    capacity
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const initialTrips = [
  ["ST001", "Bangkok", "Hua Hin", "07:30", "11:00", 220, 8],
  ["ST002", "Bangkok", "Pattaya", "08:00", "10:30", 280, 5],
  ["ST003", "Bangkok", "Ayutthaya", "09:00", "10:30", 200, 11]
];

for (const trip of initialTrips) {
  seedTrips.run(...trip);
}

console.log("SmartTransit SQLite database initialized.");

module.exports = db;
