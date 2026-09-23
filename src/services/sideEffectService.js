'use strict';

/**
 * Side effect service — simulates sending a notification after submission.
 * In production this would be an email, webhook, etc.
 * 
 * IMPORTANT: Side effects are NON-CRITICAL. Failures must not affect submission success.
 * Side effects run in background jobs, not in the request path.
 */

// Allow external injection for testing failure scenarios
let _handler = null;

function setHandler(fn) {
  _handler = fn;
}

function clearHandler() {
  _handler = null;
}

/**
 * Execute the side effect for a submission.
 * This runs inside the background worker, NOT in the HTTP request handler.
 */
async function sendNotification({ submissionId, widgetId, tenantId, email, name }) {
  if (_handler) {
    return _handler({ submissionId, widgetId, tenantId, email, name });
  }
  
  // Default: console simulation
  console.log('='.repeat(60));
  console.log('[SIDE EFFECT] New submission notification');
  console.log(`  Submission ID: ${submissionId}`);
  console.log(`  Widget ID:     ${widgetId}`);
  console.log(`  Tenant ID:     ${tenantId}`);
  console.log(`  Name:          ${name || 'N/A'}`);
  console.log(`  Email:         ${email || 'N/A'}`);
  console.log(`  Timestamp:     ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  return { delivered: true, method: 'console' };
}

module.exports = { sendNotification, setHandler, clearHandler };
