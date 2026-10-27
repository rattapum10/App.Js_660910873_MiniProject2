
"use strict";

const db = require("../../database/db");

function getCurrentUser(req, res) {
  try {
    const user = db.prepare(`
      SELECT user_id, full_name, email, created_at
      FROM users
      WHERE user_id = ?
    `).get(req.auth.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลสมาชิก"
      });
    }

    return res.json({
      success: true,
      user: {
        id: Number(user.user_id),
        fullName: user.full_name,
        email: user.email,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error("Get profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "ไม่สามารถอ่านข้อมูลสมาชิกได้"
    });
  }
}

module.exports = {
  getCurrentUser
};
