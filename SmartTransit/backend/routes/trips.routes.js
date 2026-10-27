
"use strict";

const express = require("express");
const router = express.Router();

const tripsController = require("../controllers/trips.controller");

// GET /api/trips
// GET /api/trips?date=2026-10-27
router.get("/", (req, res, next) => {
  if (typeof tripsController.getTrips !== "function") {
    return res.status(500).json({
      success: false,
      message: "ไม่พบฟังก์ชัน getTrips ใน trips.controller.js",
    });
  }

  return tripsController.getTrips(req, res, next);
});

module.exports = router;
