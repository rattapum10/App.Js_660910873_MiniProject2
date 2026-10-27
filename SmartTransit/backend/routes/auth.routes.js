
"use strict";

const express = require("express");

const {
  register,
  login
} = require("../controllers/auth.controller");

const {
  getCurrentUser
} = require("../controllers/user.controller");

const {
  requireAuth
} = require("../middleware/auth.middleware");

const router = express.Router();

// สมัครสมาชิก: ไม่ต้อง Login ก่อน
router.post("/register", register);

// เข้าสู่ระบบ: ไม่ต้อง Login ก่อน
router.post("/login", login);

// ข้อมูลสมาชิกปัจจุบัน: ต้องมี Token ที่ถูกต้อง
router.get("/me", requireAuth, getCurrentUser);

module.exports = router;
