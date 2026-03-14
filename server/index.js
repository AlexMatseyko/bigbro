const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const trackerRoutes = require('./routes/tracker');
const tasksRoutes = require('./routes/tasks');
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
app.use('/manager', managerRoutes);

// Simple health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Team Tracker API is running.' });
});

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

