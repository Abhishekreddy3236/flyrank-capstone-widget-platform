'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Rate limiter for public submission API.
 * Scoped per IP — window and max configurable via environment.
 * Returns clean JSON 429 on exhaustion.
 */
const submissionRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Scope by IP + widget ID for finer granularity
    const widgetId = req.params.widgetId || req.params.id || 'unknown';
    const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
    return `${ip}:${widgetId}`;
  },
  handler: (req, res) => {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
    });
  },
  skip: (req) => {
    // Skip rate limiting in test environment unless TEST_RATE_LIMIT=true
    if (config.isTest && process.env.TEST_RATE_LIMIT !== 'true') {
      return true;
    }
    return false;
  },
});

/**
 * General API rate limiter (more lenient).
 */
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many requests. Please slow down.',
    });
  },
  skip: () => config.isTest,
});

module.exports = { submissionRateLimiter, apiRateLimiter };
