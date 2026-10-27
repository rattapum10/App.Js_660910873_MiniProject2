
"use strict";

const {
  randomBytes,
  scrypt,
  timingSafeEqual
} = require("node:crypto");

const { promisify } = require("node:util");
const jwt = require("jsonwebtoken");
const db = require("../../database/db");

const scryptAsync = promisify(scrypt);

// ====================================
// 1. สร้าง Password Hash
// ====================================

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");

  const derivedKey = await scryptAsync(
    password,
    salt,
    64
  );

  return `${salt}:${Buffer.from(derivedKey).toString("hex")}`;
}

// ====================================
// 2. ตรวจสอบ Password Hash
// ====================================

async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== "string") {
    return false;
  }

  const separator = storedHash.indexOf(":");

  if (separator <= 0) {
    return false;
  }

  const salt = storedHash.slice(0, separator);
  const hashHex = storedHash.slice(separator + 1);

  if (!/^[0-9a-f]{128}$/i.test(hashHex)) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");

  const actual = Buffer.from(
    await scryptAsync(password, salt, 64)
  );

  return timingSafeEqual(actual, expected);
}

// ====================================
// 3. สมัครสมาชิก
// POST /api/auth/register
// ====================================

async function register(req, res) {
  try {
    const body = req.body || {};

    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!fullName || fullName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกชื่อ-นามสกุลไม่เกิน 100 ตัวอักษร"
      });
    }

    if (!emailPattern.test(email) || email.length > 254) {
      return res.status(400).json({
        success: false,
        message: "รูปแบบอีเมลไม่ถูกต้อง"
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "รหัสผ่านต้องมีความยาว 8-128 ตัวอักษร"
      });
    }

    const passwordHash = await hashPassword(password);

    const result = db.prepare(`
      INSERT INTO users (
        full_name,
        email,
        password_hash
      )
      VALUES (?, ?, ?)
    `).run(fullName, email, passwordHash);

    return res.status(201).json({
      success: true,
      message: "สมัครสมาชิกสำเร็จ",
      user: {
        id: Number(result.lastInsertRowid),
        fullName,
        email
      }
    });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed: users.email")) {
      return res.status(409).json({
        success: false,
        message: "อีเมลนี้มีบัญชีแล้ว"
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดระหว่างสมัครสมาชิก"
    });
  }
}

// ====================================
// 4. เข้าสู่ระบบ
// POST /api/auth/login
// ====================================

async function login(req, res) {
  try {
    const body = req.body || {};

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกอีเมลและรหัสผ่านให้ถูกต้อง"
      });
    }

    // ค้นหาสมาชิกในฐานข้อมูล
    const user = db.prepare(`
      SELECT
        user_id,
        full_name,
        email,
        password_hash
      FROM users
      WHERE email = ?
    `).get(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      });
    }

    // เปรียบเทียบรหัสผ่านกับ Hash
    const passwordMatches = await verifyPassword(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing");

      return res.status(500).json({
        success: false,
        message: "ระบบยืนยันตัวตนยังตั้งค่าไม่สมบูรณ์"
      });
    }

    // ออก Token อายุ 1 ชั่วโมง
    const token = jwt.sign(
      {
        sub: String(user.user_id)
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
        issuer: "smarttransit-api",
        audience: "smarttransit-web"
      }
    );

    return res.status(200).json({
      success: true,
      message: "เข้าสู่ระบบสำเร็จ",
      token,
      expiresIn: 3600,
      user: {
        id: Number(user.user_id),
        fullName: user.full_name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดระหว่างเข้าสู่ระบบ"
    });
  }
}

// ====================================
// 5. ส่งออก Controller ให้ Routes
// ====================================

module.exports = {
  register,
  login
};
