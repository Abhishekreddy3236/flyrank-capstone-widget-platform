'use strict';

const db = require('../db');

async function findByEmail(email) {
  const result = await db.query(
    'SELECT id, tenant_id, email, password_hash, role FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await db.query(
    'SELECT id, tenant_id, email, role FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function create({ tenantId, email, passwordHash, role = 'owner' }) {
  const result = await db.query(
    `INSERT INTO users (tenant_id, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, tenant_id, email, role, created_at`,
    [tenantId, email, passwordHash, role]
  );
  return result.rows[0];
}

module.exports = { findByEmail, findById, create };
