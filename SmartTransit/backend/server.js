
"use strict";

const path = require("node:path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// โหลด .env จากโฟลเดอร์หลัก SmartTransit
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// ตรวจสอบ JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 64) {
  console.error(
    "ERROR: JWT_SECRET ในไฟล์ .env ต้องมีความยาวอย่างน้อย 64 ตัวอักษร"
  );
  process.exit(1);
}

// โหลดฐานข้อมูลเดิม
require("../database/db");

// โหลด Routes
const authRoutes = require("./routes/auth.routes");
const bookingRoutes = require("./routes/booking.routes");
const tripsRoutes = require("./routes/trips.routes");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ตั้งค่า CORS
app.use(
  cors({
    origin(origin, callback) {
      // อนุญาตคำขอที่ไม่มี Origin เช่น การทดสอบ API
      if (!origin) {
        return callback(null, true);
      }

      try {
        const url = new URL(origin);

        // อนุญาต localhost สำหรับการพัฒนา
        const isLocalhost =
          url.protocol === "http:" &&
          (url.hostname === "localhost" ||
            url.hostname === "127.0.0.1");

        // อนุญาต HTTPS ของ LocalTunnel
        // เช่น https://full-snakes-clap.loca.lt
        const isLocalTunnel =
          url.protocol === "https:" &&
          /^[a-z0-9-]+\.loca\.lt$/i.test(url.hostname);
        const isRenderOrigin =
          url.protocol === "https:" &&
          process.env.RENDER_EXTERNAL_URL &&
          url.origin === process.env.RENDER_EXTERNAL_URL;  
        if (isLocalhost || isLocalTunnel || isRenderOrigin) {
          return callback(null, true);
        }
      } catch {
        // Origin ไม่ถูกต้อง
      }

      return callback(
        new Error("CORS: Origin ไม่ได้รับอนุญาต")
      );
    },
    credentials: true,
  })
);

// Middleware สำหรับอ่านข้อมูลคำขอ
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// บันทึกคำขอ API ใน Terminal
app.use("/api", (req, res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl}`);
  next();
});

// ตรวจสอบสถานะ Backend
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "SmartTransit API",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// ลงทะเบียน API Routes
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/trips", tripsRoutes);

// API ที่ไม่พบ ต้องอยู่หลัง Routes ทั้งหมด
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "ไม่พบ API ที่ร้องขอ",
    path: req.originalUrl,
  });
});

// ตำแหน่ง Frontend
const frontendPath = path.resolve(__dirname, "../frontend");

// เปิดให้เข้าถึงไฟล์ Frontend
app.use(express.static(frontendPath));

// หน้าแรกของเว็บไซต์
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// จัดการข้อผิดพลาด
app.use((err, req, res, next) => {
  console.error(
    "[Server Error]",
    err.stack || err.message || err
  );

  if (res.headersSent) {
    return next(err);
  }

  const isCorsError =
    typeof err.message === "string" &&
    err.message.startsWith("CORS:");

  res.status(isCorsError ? 403 : 500).json({
    success: false,
    message: isCorsError
      ? "คำขอมาจาก Origin ที่ไม่ได้รับอนุญาต"
      : "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์",
  });
});

// เริ่มเซิร์ฟเวอร์
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("======================================");
  console.log(" SmartTransit API is running");
  console.log(` Server:   http://127.0.0.1:${PORT}`);
  console.log(` Health:   http://127.0.0.1:${PORT}/api/health`);
  console.log(` Trips:    http://127.0.0.1:${PORT}/api/trips`);
  console.log(` Frontend: ${frontendPath}`);
  console.log("======================================");
});

server.on("error", (err) => {
  console.error("[Server Error]", err.message);
});

module.exports = app;
