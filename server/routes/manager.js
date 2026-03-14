const express = require('express');
const db = require('../db');

const router = express.Router();
const MANAGER_SECRET = process.env.MANAGER_SECRET || 'SecretShkolkovo';

function managerSecretMiddleware(req, res, next) {
  const secret = req.headers['x-manager-secret'];
  if (secret !== MANAGER_SECRET) {
    return res.status(403).json({ message: 'Access denied.' });
  }
  next();
}

router.use(managerSecretMiddleware);

// GET /manager/employees — список всех пользователей с текущим статусом и задачей
router.get('/employees', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.first_name, u.last_name, t.status, t.task, t.created_at AS last_seen_at
       FROM users u
       LEFT JOIN LATERAL (
         SELECT status, task, created_at FROM tracker
         WHERE tracker.user_id = u.id
         ORDER BY tracker.created_at DESC
         LIMIT 1
       ) t ON true
       ORDER BY u.last_name, u.first_name`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Error in GET /manager/employees:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
