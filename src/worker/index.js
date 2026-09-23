'use strict';

require('dotenv').config();

const jobRepository = require('../repositories/jobRepository');
const sideEffectService = require('../services/sideEffectService');
const config = require('../config');
const db = require('../db');

let isRunning = false;

/**
 * Process a single job by type.
 */
async function processJob(job) {
  const { type, payload } = job;

  switch (type) {
    case 'submission.notify': {
      const { submissionId, widgetId, tenantId, email, name } = payload;
      await sideEffectService.sendNotification({ submissionId, widgetId, tenantId, email, name });
      break;
    }
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

/**
 * Worker tick — claim one job, process it, update status.
 */
async function tick() {
  const job = await jobRepository.claimNext();
  
  if (!job) {
    return; // No pending jobs
  }

  console.log(`[worker] Processing job ${job.id} type=${job.type} attempt=${job.attempts + 1}/${job.max_attempts}`);

  const newAttempts = job.attempts + 1;

  try {
    await processJob(job);
    await jobRepository.markCompleted(job.id);
    console.log(`[worker] Job ${job.id} completed`);
  } catch (err) {
    console.error(`[worker] Job ${job.id} failed (attempt ${newAttempts}/${job.max_attempts}):`, err.message);

    if (newAttempts >= job.max_attempts) {
      // Terminal failure — no more retries
      await jobRepository.markFailed(job.id, err.message);
      console.error(`[worker] Job ${job.id} permanently failed after ${newAttempts} attempts`);
      console.error(`[worker] ALERT: Job ${job.id} (type=${job.type}) has exhausted all retries`);
    } else {
      // Schedule retry with exponential backoff
      await jobRepository.scheduleRetry(job.id, newAttempts, err.message);
      const delay = Math.pow(2, newAttempts) * 5;
      console.log(`[worker] Job ${job.id} scheduled for retry in ${delay}s`);
    }
  }
}

/**
 * Main worker loop.
 */
async function run() {
  // Verify DB connection
  try {
    await db.testConnection();
    console.log('[worker] Database connected');
  } catch (err) {
    console.error('[worker] Database connection failed:', err.message);
    process.exit(1);
  }

  console.log(`[worker] Starting worker (poll interval: ${config.worker.pollIntervalMs}ms)`);
  isRunning = true;

  const loop = async () => {
    if (!isRunning) return;
    
    try {
      await tick();
    } catch (err) {
      console.error('[worker] Unexpected error in tick:', err.message);
    }
    
    setTimeout(loop, config.worker.pollIntervalMs);
  };

  loop();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[worker] SIGTERM received, stopping...');
    isRunning = false;
    await db.end();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[worker] SIGINT received, stopping...');
    isRunning = false;
    await db.end();
    process.exit(0);
  });
}

run().catch(err => {
  console.error('[worker] Fatal:', err.message);
  process.exit(1);
});
