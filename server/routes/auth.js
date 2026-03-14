const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { findAsproUserByEmail } = require('../services/asproService');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'avatars');

function ensureUploadsDir() {
  const dir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsDir();
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const userId = req.user && req.user.userId;
    const ext = (file.originalname && path.extname(file.originalname).toLowerCase()) || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `user_${userId}${safeExt}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, allowed);
  }
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Missing token.' });
  }
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    req.user = payload;
    next();
  });
}

// Calendar date in Moscow (MSK = UTC+3)
function getTodayMSK() {
  const now = new Date();
  const msk = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return msk.toISOString().slice(0, 10);
}

// Redirect URL для OAuth 2.0 в Aspro.Cloud: http://localhost:5000/auth/aspro/callback
// (для client_credentials этот URL не вызывается; для authorization code — сюда вернётся code)
router.get('/aspro/callback', (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.status(400).json({ message: 'Aspro OAuth error', error: String(error) });
  }
  if (!code) {
    return res.status(400).json({ message: 'Aspro OAuth: code missing' });
  }
  res.json({ message: 'Authorization code received. Configure authorization code flow to exchange it for access_token.' });
});

// POST /auth/register
// Body: { first_name, last_name, department, email, password }
router.post('/register', async (req, res) => {
  const { first_name, last_name, department, email, password } = req.body;

  if (!first_name || !last_name || !department || !email || !password) {
    return res.status(400).json({ message: 'first_name, last_name, department, email and password are required.' });
  }

  try {
    const existingUser = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailNorm = email.trim().toLowerCase();

    let result;
    try {
      result = await db.query(
        'INSERT INTO users (first_name, last_name, department, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, department, aspro_id',
        [first_name, last_name, department, emailNorm, hashedPassword]
      );
    } catch (insertErr) {
      if (insertErr.code === '23505') {
        return res.status(409).json({ message: 'User already exists.' });
      }
      throw insertErr;
    }

    const user = result.rows[0];

    // Match Aspro Cloud user by email and save aspro_id
    console.log('Registration: searching Aspro for email:', email);
    const asproId = await findAsproUserByEmail(email).catch((err) => {
      console.error('Aspro findAsproUserByEmail error:', err);
      return null;
    });
    console.log('Registration: matched Aspro user id (aspro_id):', asproId ?? 'null');
    if (asproId != null) {
      await db.query('UPDATE users SET aspro_id = $1 WHERE email = $2', [asproId, user.email]);
      user.aspro_id = asproId;
      console.log('Assigned aspro_id:', asproId, 'to user:', email);
      console.log('DB confirmation: aspro_id saved for email:', email);
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        department: user.department,
        aspro_id: user.aspro_id || null
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
          department: user.department,
          aspro_id: user.aspro_id || null
      }
    });
  } catch (err) {
    console.error('Error in /auth/register:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// POST /auth/login
// Body: { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, department, password, aspro_id FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        department: user.department,
        aspro_id: user.aspro_id || null
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        department: user.department,
        aspro_id: user.aspro_id || null
      }
    });
  } catch (err) {
    console.error('Error in /auth/login:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET /auth/me
router.get('/me', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Missing token.' });
  }

  try {
    const payload = await new Promise((resolve, reject) => {
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });
    return res.json({
      id: payload.userId,
      email: payload.email,
      first_name: payload.first_name,
      last_name: payload.last_name,
      department: payload.department,
      aspro_id: payload.aspro_id || null
    });
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
});

// GET /auth/profile — профиль пользователя + время онлайн за сегодня (МСК)
router.get('/profile', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
  try {
    let userResult;
    try {
      userResult = await db.query(
        'SELECT first_name, last_name, email, avatar FROM users WHERE id = $1',
        [userId]
      );
    } catch (colErr) {
      if (colErr.code === '42703' || /column.*does not exist/i.test(colErr.message)) {
        userResult = await db.query(
          'SELECT first_name, last_name, email FROM users WHERE id = $1',
          [userId]
        );
        if (userResult.rows[0]) userResult.rows[0].avatar = null;
      } else throw colErr;
    }
    if (!userResult.rows.length) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = userResult.rows[0];
    let today_online_seconds = 0;
    try {
      const dateMsk = getTodayMSK();
      const timeResult = await db.query(
        'SELECT seconds FROM user_daily_online WHERE user_id = $1 AND date_msk = $2',
        [userId, dateMsk]
      );
      today_online_seconds = timeResult.rows.length ? timeResult.rows[0].seconds : 0;
    } catch (_) {
      // Таблица user_daily_online может отсутствовать до миграции — игнорируем намеренно.
    }
    const avatarUrl = user.avatar ? '/uploads/avatars/' + path.basename(user.avatar) : null;
    return res.json({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      avatar: avatarUrl,
      today_online_seconds
    });
  } catch (err) {
    console.error('Error in GET /auth/profile:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// POST /auth/avatar — загрузка аватарки (multipart, поле avatar)
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }
  const userId = req.user.userId;
  const filename = req.file.filename;
  const dbPath = 'avatars/' + filename;
  try {
    await db.query('UPDATE users SET avatar = $1 WHERE id = $2', [dbPath, userId]);
    return res.json({ avatar: `/uploads/avatars/${filename}` });
  } catch (err) {
    if (err.code === '42703' || /column.*"avatar".*does not exist/i.test(err.message)) {
      try {
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT');
        await db.query('UPDATE users SET avatar = $1 WHERE id = $2', [dbPath, userId]);
        return res.json({ avatar: `/uploads/avatars/${filename}` });
      } catch (alterErr) {
        console.error('Error adding avatar column or updating:', alterErr);
        return res.status(500).json({ message: 'Internal server error.' });
      }
    }
    console.error('Error in POST /auth/avatar:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;

