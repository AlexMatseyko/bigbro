const express = require('express');
const db = require('../db');

const router = express.Router();

// Календарная дата по Москве (МСК = UTC+3)
function getTodayMSK() {
  const now = new Date();
  const msk = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return msk.toISOString().slice(0, 10);
}

// POST /tracker/status
// Body: { status, task }
router.post('/status', async (req, res) => {
  const { status, task } = req.body;
  const userId = req.user && req.user.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  if (!status) {
    return res.status(400).json({ message: 'Status is required.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO tracker (user_id, status, task, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, user_id, status, task, created_at',
      [userId, status, task || null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error in POST /tracker/status:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// POST /tracker/online-time — добавить секунды к счётчику онлайн за текущий день (МСК)
// Body: { seconds }
router.post('/online-time', async (req, res) => {
  const userId = req.user && req.user.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  const seconds = Math.max(0, Math.floor(Number(req.body.seconds) || 0));
  if (seconds === 0) return res.json({ ok: true });

  const dateMsk = getTodayMSK();
  try {
    await db.query(
      `INSERT INTO user_daily_online (user_id, date_msk, seconds)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, date_msk) DO UPDATE SET seconds = user_daily_online.seconds + $3`,
      [userId, dateMsk, seconds]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error in POST /tracker/online-time:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET /tracker/status
router.get('/status', async (req, res) => {
  const userId = req.user && req.user.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const result = await db.query(
      'SELECT id, user_id, status, task, created_at FROM tracker WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No status found for user.' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in GET /tracker/status:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;

