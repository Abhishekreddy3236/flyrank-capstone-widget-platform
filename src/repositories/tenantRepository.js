'use strict';

const db = require('../db');

async function create({ name, slug }) {
  const result = await db.query(
    `INSERT INTO tenants (name, slug) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, slug, created_at`,
    [name, slug]
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await db.query(
    'SELECT id, name, slug FROM tenants WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { create, findById };
