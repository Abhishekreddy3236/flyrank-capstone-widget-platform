'use strict';

const cors = require('cors');
const config = require('../config');

const allowedOrigins = new Set(config.cors.origins);

/**
 * CORS configuration for public endpoints (config + submissions).
 * Allows the configured customer-site origins with credentials support.
 */
const publicCorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, same-origin) in dev/test
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin ${origin} not allowed`), false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Idempotency-Key'],
  exposedHeaders: ['X-Request-Id'],
  credentials: false,
  maxAge: 86400, // 24h preflight cache
};

const publicCors = cors(publicCorsOptions);

/**
 * CORS for authenticated API (same-origin or from dev tools).
 */
const privateCors = cors({
  origin: true,
  credentials: true,
});

module.exports = { publicCors, privateCors };
