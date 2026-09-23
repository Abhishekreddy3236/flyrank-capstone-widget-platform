'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const config = require('../config');

async function migrate() {
  const pool = new Pool({ connectionString: config.database.url });
  const client = await pool.connect();

  try {
    console.log('[migrate] Connected to database');

    // Ensure migrations tracking table exists first
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     VARCHAR(255) PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Read migration files sorted by name
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      // Skip the migrations table migration itself (already handled above)
      if (file.startsWith('000_')) continue;

      const { rows } = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [file]
      );

      if (rows.length > 0) {
        console.log(`[migrate] Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`[migrate] Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`[migrate] Applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] Failed ${file}:`, err.message);
        throw err;
      }
    }

    console.log('[migrate] All migrations complete');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('[migrate] Fatal error:', err.message);
  process.exit(1);
});
