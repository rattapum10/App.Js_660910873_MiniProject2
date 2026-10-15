# Mini Project #2: Workout Log System

เว็บแอปพลิเคชันขนาดเล็กสำหรับบันทึกและจัดการรายการออกกำลังกาย พัฒนาด้วย Node.js, Express, SQLite และ Vanilla JavaScript

## 📝 รายละเอียดแอปพลิเคชัน (Application Overview)
ระบบบันทึกการออกกำลังกาย (Workout Log) ที่ช่วยให้ผู้ใช้สามารถ:
- บันทึกกิจกรรมการออกกำลังกาย (เช่น ชื่อกิจกรรม, ประเภท, ระยะเวลา และวันที่)
- แสดงรายการออกกำลังกายทั้งหมดที่ดึงมาจากฐานข้อมูล SQLite
- กรองรายการออกกำลังกายตามประเภทกิจกรรม
- ลบรายการออกกำลังกายที่ไม่ต้องการออกได้

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)
- `/server` : โค้ดส่วน Backend (Express.js) และการจัดการฐานข้อมูล (SQLite)
- `/public` : โค้ดส่วน Frontend (HTML, CSS, JavaScript)

---

## 🛠️ วิธีการติดตั้งและการใช้งาน (Getting Started)

### 1. ติดตั้ง Dependencies
```bash
cd server
npm install

Members
660911041 Suphawich khamwong 
660910873 Ratthaphum Laokum