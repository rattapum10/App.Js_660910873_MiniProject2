const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// สำคัญมาก: บริการไฟล์ Static (HTML, CSS, JS) จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, '../public')));

// API: ดึงรายการทั้งหมด
app.get('/api/workouts', (req, res) => {
  db.all('SELECT * FROM workouts ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// API: บันทึกรายการใหม่
app.post('/api/workouts', (req, res) => {
  const { title, type, duration, date } = req.body;
  if (!title || !type || !duration || !date) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  const sql = 'INSERT INTO workouts (title, type, duration, date) VALUES (?, ?, ?, ?)';
  db.run(sql, [title, type, duration, date], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, title, type, duration, date });
  });
});

// API: ลบรายการ
app.delete('/api/workouts/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM workouts WHERE id = ?', id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Deleted successfully' });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});