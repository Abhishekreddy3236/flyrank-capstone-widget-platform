'use strict';

const app = require('./app');
const config = require('./config');
const db = require('./db');

async function start() {
  try {
    // Verify DB connection before starting
    const dbTime = await db.testConnection();
    console.log('[server] Database connected:', dbTime);
  } catch (err) {
    console.error('[server] Database connection failed:', err.message);
    console.error('[server] Make sure PostgreSQL is running: docker compose up -d');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`[server] FlyRank Widget Platform running on http://localhost:${config.port}`);
    console.log(`[server] Environment: ${config.nodeEnv}`);
    console.log(`[server] Health: http://localhost:${config.port}/health`);
    console.log(`[server] Widget bundle: http://localhost:${config.port}/widget.v1.js`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[server] SIGTERM received, shutting down gracefully...');
    server.close(async () => {
      await db.end();
      console.log('[server] Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[server] SIGINT received, shutting down gracefully...');
    server.close(async () => {
      await db.end();
      console.log('[server] Server closed');
      process.exit(0);
    });
  });
}

start();
