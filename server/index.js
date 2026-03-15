const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
// .env в корне проекта (рядом с app/ и server/)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const authRoutes = require('./routes/auth');
const trackerRoutes = require('./routes/tracker');
const tasksRoutes = require('./routes/tasks');
const tablesRoutes = require('./routes/tables');
const managerRoutes = require('./routes/manager');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// JWT authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Missing token.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }

    req.user = user;
    next();
  });
}

// Routes
app.use('/auth', authRoutes);
app.use('/tracker', authenticateToken, trackerRoutes);
app.use('/tasks', authenticateToken, tasksRoutes);
app.use('/tables', authenticateToken, tablesRoutes);
app.use('/manager', managerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Team Tracker API is running.' });
});

// Production: раздаём собранный фронтенд (React build)
const buildPath = path.join(__dirname, '..', 'app', 'build');
if (process.env.NODE_ENV === 'production' && require('fs').existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get('*', (req, res) => res.sendFile(path.join(buildPath, 'index.html')));
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`Team Tracker server listening on port ${PORT}`);
});
server.on('error', (err) => {
  console.error('Server listen error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  }
});

