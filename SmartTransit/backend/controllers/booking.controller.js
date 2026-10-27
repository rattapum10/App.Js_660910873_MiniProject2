
"use strict";

const { randomUUID } = require("node:crypto");
const dbModule = require("../../database/db");

// รองรับทั้ง module.exports = db และ module.exports = { db }
const db =
  dbModule && typeof dbModule.prepare === "function"
    ? dbModule
    : dbModule?.db || dbModule?.database;

if (!db || typeof db.prepare !== "function") {
  throw new TypeError(
    "database/db.js must export a SQLite DatabaseSync instance"
  );
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function getTableColumns(tableName) {
  const allowedTables = ["users", "bookings", "trips"];

  if (!allowedTables.includes(tableName)) {
    throw new Error("ชื่อตารางไม่ถูกต้อง");
  }

  return db.prepare(`PRAGMA table_info(${tableName})`).all();
}

function getColumnMap(columns) {
  return new Map(
    columns.map((column) => [
      String(column.name).toLowerCase(),
      column.name
    ])
  );
}

function getBookingIdentityColumn(lowerToActual) {
  return (
    lowerToActual.get("booking_id") ||
    lowerToActual.get("id") ||
    lowerToActual.get("booking_code") ||
    null
  );
}

function isAutoIncrementPrimaryKey(column) {
  return (
    ["id", "booking_id"].includes(
      String(column.name).toLowerCase()
    ) &&
    Number(column.pk) > 0
  );
}

function isValidDate(value) {
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getTodayInThailand() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getUserId(req) {
  const currentUser = req.user;

  const rawId =
    currentUser?.id ??
    currentUser?.userId ??
    currentUser?.user_id ??
    currentUser?.sub ??
    currentUser?.user?.id ??
    currentUser?.user?.userId ??
    currentUser?.user?.user_id;

  const parsedId = Number(rawId);

  if (
    rawId !== undefined &&
    rawId !== null &&
    String(rawId).trim() !== "" &&
    Number.isSafeInteger(parsedId) &&
    parsedId > 0
  ) {
    return parsedId;
  }

  // รองรับ JWT ที่มี email แต่ไม่มี user ID
  const email = currentUser?.email ?? currentUser?.user?.email;

  if (typeof email !== "string" || !email.trim()) {
    return null;
  }

  try {
    const columns = getTableColumns("users");
    const map = getColumnMap(columns);

    const idColumn =
      map.get("user_id") ||
      map.get("id") ||
      map.get("userid");

    const emailColumn =
      map.get("email") ||
      map.get("user_email");

    if (!idColumn || !emailColumn) {
      return null;
    }

    const row = db.prepare(`
      SELECT ${quoteIdentifier(idColumn)} AS resolved_id
      FROM users
      WHERE LOWER(${quoteIdentifier(emailColumn)}) = LOWER(?)
      LIMIT 1
    `).get(email.trim());

    const id = Number(row?.resolved_id);

    return Number.isSafeInteger(id) && id > 0
      ? id
      : null;
  } catch (error) {
    console.error("Resolve user error:", error.message);
    return null;
  }
}

function getErrorMessage(error) {
  return process.env.NODE_ENV === "production"
    ? "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์"
    : error.message;
}

// ========================================
// CREATE BOOKING
// POST /api/bookings
// ========================================

function createBooking(req, res) {
  let transactionStarted = false;

  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่"
      });
    }

    const body = req.body || {};

    const tripId = String(
      body.tripId ?? body.trip_id ?? ""
    ).trim();

    const travelDate = String(
      body.date ?? body.travel_date ?? ""
    ).trim();

    const passengers = Number(
      body.passengers ?? body.passenger_count
    );

    const fullName = String(
      body.fullName ?? body.full_name ?? body.name ?? ""
    ).trim();

    const phone = String(
      body.phone ?? body.contact_phone ?? ""
    ).trim();

    const email = String(
      body.email ?? body.contact_email ?? ""
    ).trim().toLowerCase();

    const notes = String(body.notes ?? "").trim();

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!tripId || !travelDate) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุเที่ยวรถและวันที่เดินทาง"
      });
    }

    if (!isValidDate(travelDate)) {
      return res.status(400).json({
        success: false,
        message: "วันที่เดินทางไม่ถูกต้อง"
      });
    }

    if (travelDate < getTodayInThailand()) {
      return res.status(400).json({
        success: false,
        message: "ไม่สามารถจองเที่ยวรถย้อนหลังได้"
      });
    }

    if (
      !Number.isSafeInteger(passengers) ||
      passengers < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "จำนวนผู้โดยสารต้องเป็นจำนวนเต็มตั้งแต่ 1 คนขึ้นไป"
      });
    }

    if (!fullName || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกชื่อ โทรศัพท์ และอีเมล"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "รูปแบบอีเมลไม่ถูกต้อง"
      });
    }

    // BEGIN IMMEDIATE ล็อกการเขียนก่อนตรวจที่นั่ง
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;

    // อ่านข้อมูลเที่ยวรถจากฐานข้อมูลเท่านั้น
    const trip = db.prepare(`
      SELECT
        trip_id,
        origin,
        destination,
        departure_time,
        arrival_time,
        price_per_passenger,
        capacity
      FROM trips
      WHERE trip_id = ?
        AND is_active = 1
    `).get(tripId);

    if (!trip) {
      db.exec("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "ไม่พบเที่ยวรถ หรือเที่ยวรถปิดรับจองแล้ว"
      });
    }

    const capacity = Number(trip.capacity);
    const unitPrice = Number(trip.price_per_passenger);

    if (
      !Number.isSafeInteger(capacity) ||
      capacity < 1 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      throw new Error("ข้อมูลความจุหรือราคาเที่ยวรถไม่ถูกต้อง");
    }

    // นับที่นั่งที่ถูกจองแล้วในเที่ยวและวันที่เดียวกัน
    // รายการที่ยกเลิกแล้วจะไม่ถูกนับ
    const reservation = db.prepare(`
      SELECT COALESCE(SUM(passengers), 0) AS reserved_seats
      FROM bookings
      WHERE trip_id = ?
      AND travel_date = ?
      AND LOWER(COALESCE(status, 'pending'))
      IN ('pending', 'confirmed')
    `).get(tripId, travelDate);

    const reservedSeats = Number(
      reservation?.reserved_seats ?? 0
    );

    const remainingSeats = Math.max(
      0,
      capacity - reservedSeats
    );

    if (passengers > remainingSeats) {
      db.exec("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: `ที่นั่งไม่เพียงพอ เหลือ ${remainingSeats} ที่นั่ง`,
        availableSeats: remainingSeats,
        requestedSeats: passengers
      });
    }

    const totalPrice = unitPrice * passengers;

    if (!Number.isFinite(totalPrice)) {
      throw new Error("คำนวณราคารวมไม่สำเร็จ");
    }

    const bookingCode =
      `ST-${getTodayInThailand().replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const columns = getTableColumns("bookings");
    const map = getColumnMap(columns);
    const identityColumn = getBookingIdentityColumn(map);

    if (!map.has("user_id") || !identityColumn) {
      throw new Error(
        "โครงสร้างตาราง bookings ไม่ตรงกับที่ Controller ต้องการ"
      );
    }

    // ข้อมูลจาก Frontend ใช้เฉพาะข้อมูลผู้ติดต่อและจำนวนผู้โดยสาร
    // เส้นทาง เวลา และราคามาจากตาราง trips
    const valuesByColumn = {
      user_id: userId,
      booking_code: bookingCode,

      trip_id: trip.trip_id,
      tripid: trip.trip_id,

      origin: trip.origin,
      from_location: trip.origin,
      from: trip.origin,

      destination: trip.destination,
      to_location: trip.destination,
      to: trip.destination,

      date: travelDate,
      travel_date: travelDate,
      booking_date: travelDate,
      journey_date: travelDate,
      departure_date: travelDate,

      departure_time: trip.departure_time,
      arrival_time: trip.arrival_time,

      passengers,
      passenger_count: passengers,

      price_per_passenger: unitPrice,
      unit_price: unitPrice,
      fare: unitPrice,

      total_price: totalPrice,
      totalprice: totalPrice,
      total_amount: totalPrice,
      totalamount: totalPrice,
      price: totalPrice,

      full_name: fullName,
      fullname: fullName,
      name: fullName,
      contact_name: fullName,

      phone,
      contact_phone: phone,

      email,
      contact_email: email,

      notes,
      status: "confirmed"
    };

    const omittedRequired = columns.filter((column) => {
      const name = String(column.name).toLowerCase();

      return (
        Number(column.notnull) === 1 &&
        !isAutoIncrementPrimaryKey(column) &&
        column.dflt_value == null &&
        !Object.prototype.hasOwnProperty.call(
          valuesByColumn,
          name
        )
      );
    });

    if (omittedRequired.length > 0) {
      throw new Error(
        "ยังไม่ได้กำหนดค่าคอลัมน์บังคับ: " +
        omittedRequired.map((column) => column.name).join(", ")
      );
    }

    const insertColumns = columns
      .filter((column) => {
        const name = String(column.name).toLowerCase();

        return (
          !isAutoIncrementPrimaryKey(column) &&
          Object.prototype.hasOwnProperty.call(
            valuesByColumn,
            name
          )
        );
      })
      .map((column) => column.name);

    if (insertColumns.length === 0) {
      throw new Error("ไม่พบคอลัมน์สำหรับบันทึกการจอง");
    }

    const insertSql = `
      INSERT INTO bookings (
        ${insertColumns.map(quoteIdentifier).join(", ")}
      )
      VALUES (
        ${insertColumns.map(() => "?").join(", ")}
      )
    `;

    const values = insertColumns.map(
      (name) => valuesByColumn[String(name).toLowerCase()]
    );

    const insertResult = db.prepare(insertSql).run(...values);

    const numericId = ["booking_id", "id"].includes(
      String(identityColumn).toLowerCase()
    );

    const bookingId = numericId
      ? Number(insertResult.lastInsertRowid)
      : bookingCode;

    const booking = db.prepare(`
      SELECT *
      FROM bookings
      WHERE ${quoteIdentifier(identityColumn)} = ?
        AND user_id = ?
    `).get(bookingId, userId);

    // Commit หลังบันทึกและอ่านข้อมูลสำเร็จ
    db.exec("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "บันทึกการจองเรียบร้อยแล้ว",
      availableSeats: remainingSeats - passengers,
      booking: booking
        ? {
            ...booking,
            deleteId: booking[identityColumn]
          }
        : {
            [identityColumn]: bookingId,
            booking_code: bookingCode,
            trip_id: trip.trip_id,
            origin: trip.origin,
            destination: trip.destination,
            travel_date: travelDate,
            departure_time: trip.departure_time,
            arrival_time: trip.arrival_time,
            passengers,
            price_per_passenger: unitPrice,
            total_price: totalPrice,
            full_name: fullName,
            contact_phone: phone,
            contact_email: email,
            status: "confirmed",
            deleteId: bookingId
          }
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        db.exec("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError.message);
      }
    }

    console.error("Create booking error:", error.stack || error);

    return res.status(500).json({
      success: false,
      message: getErrorMessage(error),
      ...(process.env.NODE_ENV === "production"
        ? {}
        : { details: error.message })
    });
  }
}

// ========================================
// GET MY BOOKINGS
// GET /api/bookings
// ========================================

function getMyBookings(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่"
      });
    }

    const columns = getTableColumns("bookings");
    const map = getColumnMap(columns);

    const identityColumn = getBookingIdentityColumn(map);
    const orderColumn = map.get("created_at") || identityColumn;

    if (!map.has("user_id") || !identityColumn || !orderColumn) {
      throw new Error("โครงสร้างตาราง bookings ไม่ถูกต้อง");
    }

    const rows = db.prepare(`
      SELECT *
      FROM bookings
      WHERE user_id = ?
      ORDER BY ${quoteIdentifier(orderColumn)} DESC
    `).all(userId);

    const bookings = rows.map((row) => ({
      ...row,
      deleteId: row[identityColumn]
    }));

    return res.status(200).json({
      success: true,
      bookings
    });
  } catch (error) {
    console.error("Get bookings error:", error.stack || error);

    return res.status(500).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
}

// ========================================
// DELETE BOOKING
// DELETE /api/bookings/:id
// ========================================

function deleteBooking(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่"
      });
    }

    const rawId = String(req.params.id ?? "").trim();

    if (!rawId) {
      return res.status(400).json({
        success: false,
        message: "รหัสการจองไม่ถูกต้อง"
      });
    }

    const columns = getTableColumns("bookings");
    const map = getColumnMap(columns);
    const identityColumn = getBookingIdentityColumn(map);

    if (!identityColumn || !map.has("user_id")) {
      throw new Error("โครงสร้างตาราง bookings ไม่ถูกต้อง");
    }

    const usesNumericId = ["booking_id", "id"].includes(
      String(identityColumn).toLowerCase()
    );

    let bookingId = rawId;

    if (usesNumericId) {
      bookingId = Number(rawId);

      if (
        !Number.isSafeInteger(bookingId) ||
        bookingId < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "รหัสการจองไม่ถูกต้อง"
        });
      }
    }

    const result = db.prepare(`
      DELETE FROM bookings
      WHERE ${quoteIdentifier(identityColumn)} = ?
        AND user_id = ?
    `).run(bookingId, userId);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบรายการจอง หรือคุณไม่มีสิทธิ์ลบรายการนี้"
      });
    }

    return res.status(200).json({
      success: true,
      message: "ลบรายการจองเรียบร้อยแล้ว",
      bookingId
    });
  } catch (error) {
    console.error("Delete booking error:", error.stack || error);

    return res.status(500).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  createBooking,
  getMyBookings,
  deleteBooking
};
