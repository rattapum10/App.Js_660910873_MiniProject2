"use strict";

const db = require("../../database/db");

const CITY_NAMES = {
  Bangkok: "กรุงเทพฯ",
  "Hua Hin": "หัวหิน",
  Pattaya: "พัทยา",
  Ayutthaya: "อยุธยา"
};

const CITY_NAMES_REVERSE = Object.fromEntries(
  Object.entries(CITY_NAMES).map(([english, thai]) => [thai, english])
);

function isValidDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d;
}

function getTrips(req, res) {
  try {
    const date = typeof req.query.date === "string" ? req.query.date.trim() : "";
    const rawOrigin = typeof req.query.origin === "string" ? req.query.origin.trim() : "";
    const rawDestination = typeof req.query.destination === "string" ? req.query.destination.trim() : "";
    const passengersRaw = req.query.passengers;

    if (date && !isValidDate(date)) {
      return res.status(400).json({ success: false, message: "วันที่เดินทางไม่ถูกต้อง" });
    }

    if (rawOrigin.length > 100 || rawDestination.length > 100) {
      return res.status(400).json({ success: false, message: "ข้อมูลเส้นทางยาวเกินกำหนด" });
    }

    let passengers = 1;
    if (passengersRaw !== undefined) {
      passengers = Number(passengersRaw);
      if (!Number.isSafeInteger(passengers) || passengers < 1 || passengers > 20) {
        return res.status(400).json({ success: false, message: "จำนวนผู้โดยสารต้องอยู่ระหว่าง 1-20 คน" });
      }
    }

    const origin = CITY_NAMES_REVERSE[rawOrigin] || rawOrigin;
    const destination = CITY_NAMES_REVERSE[rawDestination] || rawDestination;
    if (origin && destination && origin === destination) {
      return res.status(400).json({ success: false, message: "ต้นทางและปลายทางต้องแตกต่างกัน" });
    }

    const conditions = ["t.is_active = 1"];
    const params = [date];
    if (origin) {
      conditions.push("t.origin = ?");
      params.push(origin);
    }
    if (destination) {
      conditions.push("t.destination = ?");
      params.push(destination);
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
            AND LOWER(COALESCE(b.status, 'pending')) IN ('pending', 'confirmed')
        ), 0) AS bookedSeats
      FROM trips t
      WHERE ${conditions.join(" AND ")}
      ORDER BY t.departure_time ASC
    `).all(...params);

    const result = trips.map((trip) => {
      const capacity = Number(trip.capacity) || 0;
      const bookedSeats = Number(trip.bookedSeats) || 0;
      const availableSeats = Math.max(0, capacity - bookedSeats);
      return {
        tripId: String(trip.tripId),
        origin: CITY_NAMES[trip.origin] || trip.origin,
        destination: CITY_NAMES[trip.destination] || trip.destination,
        departure: String(trip.departureTime).slice(0, 5),
        arrival: String(trip.arrivalTime).slice(0, 5),
        price: Number(trip.price),
        capacity,
        bookedSeats,
        availableSeats
      };
    }).filter((trip) => trip.availableSeats >= passengers);

    return res.status(200).json({ success: true, date: date || null, trips: result });
  } catch (error) {
    console.error("Get trips error:", error);
    return res.status(500).json({ success: false, message: "ไม่สามารถดึงข้อมูลเที่ยวรถได้" });
  }
}

module.exports = { getTrips };
