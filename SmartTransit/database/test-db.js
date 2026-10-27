
"use strict";

const path = require("node:path");
const db = require("./db");

try {
  // ตรวจสอบว่าเชื่อมต่อ SQLite ได้
  const version = db
    .prepare("SELECT sqlite_version() AS version")
    .get();

  // ตรวจสอบตารางที่สร้างไว้
  const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  // ตรวจสอบคอลัมน์ของแต่ละตาราง
  const userColumns = db
    .prepare("PRAGMA table_info(users)")
    .all();

  const bookingColumns = db
    .prepare("PRAGMA table_info(bookings)")
    .all();

  console.log("\n=== SmartTransit Database Test ===");
  console.log("Connection: SUCCESS");
  console.log(`SQLite version: ${version.version}`);
  console.log(
    `Database file: ${path.join(__dirname, "smarttransit.db")}`
  );

  console.log("\nTables:");

  for (const table of tables) {
    console.log(`- ${table.name}`);
  }

  console.log("\nUsers columns:");
  console.log(userColumns.map((column) => column.name).join(", "));

  console.log("\nBookings columns:");
  console.log(bookingColumns.map((column) => column.name).join(", "));

  if (
    tables.some((table) => table.name === "users") &&
    tables.some((table) => table.name === "bookings")
  ) {
    console.log("\nRESULT: Database setup successful.");
  } else {
    throw new Error("ไม่พบตาราง users หรือ bookings");
  }
} catch (error) {
  console.error("\nDatabase test failed:");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
