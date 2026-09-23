'use strict';

const db = require('../db');

async function create({ tenantId, name, type, config = {}, active = true }) {
  const result = await db.query(
    `INSERT INTO widgets (tenant_id, name, type, config, active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, tenant_id, name, type, config, active, version, created_at, updated_at`,
    [tenantId, name, type, JSON.stringify(config), active]
  );
  return result.rows[0];
}

/**
 * Find all widgets belonging to a tenant.
 * Tenant isolation: WHERE tenant_id = $1
 */
async function findByTenantId(tenantId) {
  const result = await db.query(
    `SELECT id, tenant_id, name, type, config, active, version, created_at, updated_at
     FROM widgets WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return result.rows;
}

/**
 * Find a widget by ID, scoped to a tenant (prevents cross-tenant access).
 */
async function findByIdAndTenantId(id, tenantId) {
  const result = await db.query(
    `SELECT id, tenant_id, name, type, config, active, version, created_at, updated_at
     FROM widgets WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  return result.rows[0] || null;
}

/**
 * Find a widget by ID only — for public config endpoint (no auth required).
 * Returns only active widgets.
 */
async function findByIdPublic(id) {
  const result = await db.query(
    `SELECT id, tenant_id, name, type, config, version
     FROM widgets WHERE id = $1 AND active = TRUE`,
    [id]
  );
  return result.rows[0] || null;
}

async function update(id, tenantId, updates) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(updates.name);
  }
  if (updates.type !== undefined) {
    fields.push(`type = $${idx++}`);
    values.push(updates.type);
  }
  if (updates.config !== undefined) {
    fields.push(`config = $${idx++}`);
    values.push(JSON.stringify(updates.config));
    // Bump version on config change
    fields.push(`version = version + 1`);
  }
  if (updates.active !== undefined) {
    fields.push(`active = $${idx++}`);
    values.push(updates.active);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = NOW()`);
  values.push(id, tenantId);

  const result = await db.query(
    `UPDATE widgets SET ${fields.join(', ')}
     WHERE id = $${idx} AND tenant_id = $${idx + 1}
     RETURNING id, tenant_id, name, type, config, active, version, created_at, updated_at`,
    values
  );
  return result.rows[0] || null;
}

async function remove(id, tenantId) {
  const result = await db.query(
    'DELETE FROM widgets WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [id, tenantId]
  );
  return result.rows[0] || null;
}

module.exports = { create, findByTenantId, findByIdAndTenantId, findByIdPublic, update, remove };
