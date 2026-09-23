'use strict';

const db = require('../db');

async function create({ widgetId, tenantId, email, name, data, ip, geo, idempotencyKey, honeypotTriggered = false }) {
  const result = await db.query(
    `INSERT INTO submissions 
       (widget_id, tenant_id, email, name, data, ip, geo, idempotency_key, honeypot_triggered)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, widget_id, tenant_id, email, name, data, ip, geo, idempotency_key, honeypot_triggered, created_at`,
    [
      widgetId,
      tenantId,
      email || null,
      name || null,
      JSON.stringify(data || {}),
      ip || null,
      geo ? JSON.stringify(geo) : null,
      idempotencyKey || null,
      honeypotTriggered,
    ]
  );
  return result.rows[0];
}

async function findByIdempotencyKey(key) {
  const result = await db.query(
    'SELECT id FROM submissions WHERE idempotency_key = $1',
    [key]
  );
  return result.rows[0] || null;
}

/**
 * Count submissions for a tenant (with optional widget filter).
 * Tenant isolation: always filters by tenant_id.
 */
async function countByTenant(tenantId, widgetId = null) {
  if (widgetId) {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM submissions 
       WHERE tenant_id = $1 AND widget_id = $2 AND honeypot_triggered = FALSE`,
      [tenantId, widgetId]
    );
    return parseInt(result.rows[0].count, 10);
  }
  const result = await db.query(
    `SELECT COUNT(*) as count FROM submissions 
     WHERE tenant_id = $1 AND honeypot_triggered = FALSE`,
    [tenantId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get submission counts grouped by day for a tenant.
 */
async function countsByDay(tenantId, widgetId = null, days = 30) {
  const params = [tenantId, days];
  let widgetFilter = '';
  if (widgetId) {
    widgetFilter = ' AND widget_id = $3';
    params.push(widgetId);
  }

  const result = await db.query(
    `SELECT 
       DATE_TRUNC('day', created_at) AS date,
       COUNT(*) AS count
     FROM submissions
     WHERE tenant_id = $1
       AND honeypot_triggered = FALSE
       AND created_at >= NOW() - INTERVAL '1 day' * $2
       ${widgetFilter}
     GROUP BY DATE_TRUNC('day', created_at)
     ORDER BY date DESC`,
    params
  );
  return result.rows;
}

/**
 * Get geo breakdown for a tenant.
 * Tenant isolation: always filters by tenant_id.
 */
async function geoBreakdown(tenantId, widgetId = null) {
  const params = [tenantId];
  let widgetFilter = '';
  if (widgetId) {
    widgetFilter = ' AND widget_id = $2';
    params.push(widgetId);
  }

  const result = await db.query(
    `SELECT 
       geo->>'country' AS country,
       geo->>'countryCode' AS country_code,
       COUNT(*) AS count
     FROM submissions
     WHERE tenant_id = $1
       AND honeypot_triggered = FALSE
       AND geo IS NOT NULL
       ${widgetFilter}
     GROUP BY geo->>'country', geo->>'countryCode'
     ORDER BY count DESC
     LIMIT 50`,
    params
  );
  return result.rows;
}

/**
 * Per-widget submission counts for a tenant.
 */
async function countsByWidget(tenantId) {
  const result = await db.query(
    `SELECT 
       s.widget_id,
       w.name AS widget_name,
       COUNT(s.id) AS count
     FROM submissions s
     JOIN widgets w ON s.widget_id = w.id
     WHERE s.tenant_id = $1 AND s.honeypot_triggered = FALSE
     GROUP BY s.widget_id, w.name
     ORDER BY count DESC`,
    [tenantId]
  );
  return result.rows;
}

module.exports = {
  create,
  findByIdempotencyKey,
  countByTenant,
  countsByDay,
  geoBreakdown,
  countsByWidget,
};
