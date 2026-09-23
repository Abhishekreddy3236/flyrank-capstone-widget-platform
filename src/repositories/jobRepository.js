'use strict';

const db = require('../db');

async function create({ type, payload, maxAttempts = 3 }) {
  const result = await db.query(
    `INSERT INTO jobs (type, payload, max_attempts)
     VALUES ($1, $2, $3)
     RETURNING id, type, payload, status, attempts, max_attempts, created_at`,
    [type, JSON.stringify(payload), maxAttempts]
  );
  return result.rows[0];
}

/**
 * Claim the next available job atomically using FOR UPDATE SKIP LOCKED.
 * This prevents two workers from picking the same job.
 */
async function claimNext() {
  const result = await db.query(
    `UPDATE jobs SET status = 'processing', updated_at = NOW()
     WHERE id = (
       SELECT id FROM jobs
       WHERE status = 'pending'
         AND next_run_at <= NOW()
       ORDER BY next_run_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, type, payload, attempts, max_attempts`
  );
  return result.rows[0] || null;
}

async function markCompleted(id) {
  await db.query(
    `UPDATE jobs SET status = 'completed', updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

async function markFailed(id, error) {
  await db.query(
    `UPDATE jobs SET status = 'failed', last_error = $2, updated_at = NOW()
     WHERE id = $1`,
    [id, error]
  );
}

/**
 * Schedule a retry with exponential backoff.
 */
async function scheduleRetry(id, attempts, error) {
  // Exponential backoff: 2^attempts * 5 seconds
  const delaySeconds = Math.pow(2, attempts) * 5;
  await db.query(
    `UPDATE jobs 
     SET status = 'pending',
         attempts = $2,
         last_error = $3,
         next_run_at = NOW() + INTERVAL '1 second' * $4,
         updated_at = NOW()
     WHERE id = $1`,
    [id, attempts, error, delaySeconds]
  );
}

async function findById(id) {
  const result = await db.query(
    'SELECT id, type, payload, status, attempts, max_attempts, last_error, next_run_at FROM jobs WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { create, claimNext, markCompleted, markFailed, scheduleRetry, findById };
