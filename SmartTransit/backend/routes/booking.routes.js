"use strict";

const express = require("express");

const {
  createBooking,
  getMyBookings,
  deleteBooking
} = require("../controllers/booking.controller");

const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

// ทุกเส้นทางต้องผ่านการตรวจสอบ Token ก่อน
router.use(requireAuth);

router.post("/", createBooking);
router.get("/", getMyBookings);
router.delete("/:id", deleteBooking);

module.exports = router;