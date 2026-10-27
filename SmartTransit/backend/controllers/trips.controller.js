
"use strict";

const dbModule = require("../../database/db");

const db =
  typeof dbModule?.prepare === "function"
    ? dbModule
    : dbModule?.db || dbModule?.database;

if (!db || typeof db.prepare !== "function") {
  throw new TypeError("ไม่พบ SQLite database instance");
}

// แสดงชื่อสถานที่ภาษาไทยในหน้า Search
const CITY_NAMES = {
  Bangkok: "กรุงเทพฯ",
  "Hua Hin": "หัวหิน",
  Pattaya: "พัทยา",
  Ayutthaya: "อยุธยา"
};

function getTrips(req, res) {
  try {
    const date = String(req.query.date || "").trim();

    // ตรวจสอบรูปแบบวันที่ หากส่งมา
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "รูปแบบวันที่ไม่ถูกต้อง"
      });
    }

    const trips = db.prepare(`
      SELECT
        t.trip_id AS tripId,
        t.origin AS origin,
        t.destination AS destination,
        t.departure_time AS departureTime,
        t.arrival_time AS arrivalTime,
        t.price_per_passenger AS price,
        t.capacity AS capacity,
        COALESCE((
          SELECT SUM(b.passengers)
          FROM bookings b
          WHERE b.trip_id = t.trip_id
            AND b.travel_date = ?
            AND LOWER(COALESCE(b.status, 'pending'))
                IN ('pending', 'confirmed')
        ), 0) AS bookedSeats
      FROM trips t
      WHERE t.is_active = 1
      ORDER BY t.departure_time ASC
    `).all(date);

    const result = trips.map((trip) => {
      const capacity = Number(trip.capacity) || 0;
      const bookedSeats = Number(trip.bookedSeats) || 0;

      return {
        tripId: String(trip.tripId),
        origin: CITY_NAMES[trip.origin] || trip.origin,
        destination: CITY_NAMES[trip.destination] || trip.destination,
        departure: String(trip.departureTime).slice(0, 5),
        arrival: String(trip.arrivalTime).slice(0, 5),
        price: Number(trip.price),
        capacity,
        bookedSeats,
        availableSeats: Math.max(0, capacity - bookedSeats)
      };
    });

    return res.json({
      success: true,
      date: date || null,
      trips: result
    });
  } catch (error) {
    console.error("Get trips error:", error);

    return res.status(500).json({
      success: false,
      message: "ไม่สามารถดึงข้อมูลเที่ยวรถได้"
    });
  }
}

module.exports = { getTrips };
