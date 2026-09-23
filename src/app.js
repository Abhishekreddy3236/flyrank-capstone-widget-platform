'use strict';

require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const path = require('path');

const { errorHandler } = require('./middleware/errorHandler');
const { privateCors } = require('./middleware/cors');
const { apiRateLimiter } = require('./middleware/rateLimiter');
const config = require('./config');

// Routes
const authRoutes = require('./routes/auth');
const widgetRoutes = require('./routes/widgets');
const publicRoutes = require('./routes/public');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// ── Request size limit (413 for oversized payloads) ──────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ── Logging ────────────────────────────────────────────────────────────────
if (!config.isTest) {
  app.use(morgan('dev'));
}

// ── Trust proxy (for correct IP detection behind reverse proxy) ───────────
app.set('trust proxy', 1);

// ── Serve static widget bundle ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1y', // widget.v1.js has long-lived cache
}));

// ── Health check ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── CORS for private API ──────────────────────────────────────────────────
app.use('/api', privateCors);

// ── API Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', apiRateLimiter, authRoutes);
app.use('/api/widgets', widgetRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler (must be last) ──────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
