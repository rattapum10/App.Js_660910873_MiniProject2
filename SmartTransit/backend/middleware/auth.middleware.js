"use strict";

const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";

  // ตรวจสอบว่าได้รับ Bearer Token หรือไม่
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "ไม่พบ Token กรุณาเข้าสู่ระบบใหม่"
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token ว่าง กรุณาเข้าสู่ระบบใหม่"
    });
  }

  // ตรวจสอบ Token ด้วย Secret ของ Backend
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing");

    return res.status(500).json({
      success: false,
      message: "เซิร์ฟเวอร์ยังไม่ได้กำหนด JWT_SECRET"
    });
  }

  try {

const decoded = jwt.verify(
  token,
  process.env.JWT_SECRET,
  {
    issuer: "smarttransit-api",
    audience: "smarttransit-web"
  }
);


    if (!decoded || typeof decoded !== "object") {
      return res.status(401).json({
        success: false,
        message: "ข้อมูล Token ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่"
      });
    }

    // รองรับชื่อรหัสผู้ใช้หลายรูปแบบ
    const userId =
      decoded.id ??
      decoded.userId ??
      decoded.user_id ??
      decoded.sub ??
      decoded.user?.id ??
      decoded.user?.userId ??
      decoded.user?.user_id;

    if (
      userId === undefined ||
      userId === null ||
      String(userId).trim() === ""
    ) {
      console.error(
        "JWT verified, but user ID is missing from its payload"
      );

      return res.status(401).json({
        success: false,
        message:
          "Token ไม่มีรหัสผู้ใช้ กรุณาเข้าสู่ระบบใหม่"
      });
    }

    // กำหนดรูปแบบกลางให้ Controller ใช้งาน
    req.user = {
      ...decoded,
      id: userId
    };

    return next();

  } catch (error) {
    console.error(
      "JWT authentication error:",
      error.name
    );

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token หมดอายุ กรุณาเข้าสู่ระบบใหม่"
      });
    }

    return res.status(401).json({
      success: false,
      message: "Token ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่"
    });
  }
}

module.exports = {
  requireAuth
};
