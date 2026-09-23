'use strict';

const widgetRepository = require('../repositories/widgetRepository');
const submissionRepository = require('../repositories/submissionRepository');
const jobRepository = require('../repositories/jobRepository');
const geoService = require('./geoService');
const { createError } = require('../middleware/errorHandler');

/**
 * Honeypot field names — should always be empty for real humans.
 */
const HONEYPOT_FIELDS = ['website', 'company_url', 'homepage', 'url'];

/**
 * Check if a submission has a honeypot field populated.
 * Returns true if spam detected.
 */
function isHoneypotTriggered(body) {
  for (const field of HONEYPOT_FIELDS) {
    if (body[field] && String(body[field]).trim().length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Main submission processing pipeline:
 * 1. Find widget (404 if not found)
 * 2. Check honeypot
 * 3. Check idempotency key
 * 4. Enrich geo (non-blocking)
 * 5. Store submission
 * 6. Enqueue background job
 * 7. Return result
 */
async function processSubmission({ widgetId, body, ip, idempotencyKey }) {
  // 1. Verify widget exists and is active
  const widget = await widgetRepository.findByIdPublic(widgetId);
  if (!widget) {
    throw createError(404, 'Not Found', 'Widget not found or inactive');
  }

  // 2. Check honeypot
  const honeypotTriggered = isHoneypotTriggered(body);
  if (honeypotTriggered) {
    console.log('[submission] Honeypot triggered — silently dropping submission');
    // Return a fake success to not alert bots
    return {
      id: null,
      status: 'dropped',
      message: 'Submission received',
      honeypot: true,
    };
  }

  // 3. Idempotency check
  if (idempotencyKey) {
    const existing = await submissionRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      console.log('[submission] Duplicate idempotency key, returning existing submission ID:', existing.id);
      return {
        id: existing.id,
        status: 'duplicate',
        message: 'Submission already received',
        idempotent: true,
      };
    }
  }

  // 4. Geo enrichment — non-blocking, never throws
  const geo = await geoService.enrichGeo(ip);

  // 5. Store submission
  const { name, email, data, ...rest } = body;
  const submission = await submissionRepository.create({
    widgetId: widget.id,
    tenantId: widget.tenant_id,
    email,
    name,
    data: data || {},
    ip,
    geo,
    idempotencyKey: idempotencyKey || null,
    honeypotTriggered: false,
  });

  // 6. Enqueue background job (fire-and-forget from request perspective)
  try {
    await jobRepository.create({
      type: 'submission.notify',
      payload: {
        submissionId: submission.id,
        widgetId: widget.id,
        tenantId: widget.tenant_id,
        email: submission.email,
        name: submission.name,
      },
      maxAttempts: 3,
    });
  } catch (jobErr) {
    // Job creation failure must NOT fail the submission
    console.error('[submission] Failed to enqueue job (non-fatal):', jobErr.message);
  }

  return {
    id: submission.id,
    status: 'success',
    message: 'Thank you for your submission!',
  };
}

module.exports = { processSubmission, isHoneypotTriggered };
