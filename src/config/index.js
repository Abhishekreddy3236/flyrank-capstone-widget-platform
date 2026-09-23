'use strict';

require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://flyrank:flyrank_secret@localhost:5432/flyrank_capstone',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'flyrank_dev_jwt_secret_minimum_32_chars_long_abc123',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10),
  },
  
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean),
  },
  
  geo: {
    providerAUrl: process.env.GEO_PROVIDER_A_URL || 'http://ip-api.com/json',
    providerBUrl: process.env.GEO_PROVIDER_B_URL || 'https://ipapi.co',
  },
  
  sideEffect: {
    mode: process.env.SIDE_EFFECT_MODE || 'console',
  },
  
  worker: {
    pollIntervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '2000', 10),
    maxRetries: parseInt(process.env.WORKER_MAX_RETRIES || '3', 10),
  },
  
  widgetConfigCacheTtl: parseInt(process.env.WIDGET_CONFIG_CACHE_TTL || '300', 10),
  
  isTest: process.env.NODE_ENV === 'test',
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
};

module.exports = config;
