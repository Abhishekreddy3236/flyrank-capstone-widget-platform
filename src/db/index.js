'use strict';

const { Pool } = require('pg');
const config = require('../config');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client:', err.message);
    });
  }
  return pool;
}

async function query(text, params) {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function transaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function end() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

async function testConnection() {
  const result = await query('SELECT NOW() as now');
  return result.rows[0].now;
}

module.exports = { query, transaction, end, testConnection, getPool };
