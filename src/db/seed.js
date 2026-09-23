'use strict';

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const config = require('../config');

async function seed() {
  const pool = new Pool({ connectionString: config.database.url });
  const client = await pool.connect();

  try {
    console.log('[seed] Connected to database');

    await client.query('BEGIN');

    // Create tenant A
    const tenantAResult = await client.query(`
      INSERT INTO tenants (name, slug)
      VALUES ('Acme Corp', 'acme-corp')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const tenantAId = tenantAResult.rows[0].id;

    // Create tenant B (for isolation tests)
    const tenantBResult = await client.query(`
      INSERT INTO tenants (name, slug)
      VALUES ('Beta Inc', 'beta-inc')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const tenantBId = tenantBResult.rows[0].id;

    // Hash passwords
    const passwordHashA = await bcrypt.hash('password123', 10);
    const passwordHashB = await bcrypt.hash('password456', 10);

    // Create user for tenant A
    const userAResult = await client.query(`
      INSERT INTO users (tenant_id, email, password_hash, role)
      VALUES ($1, 'alice@acme.com', $2, 'owner')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [tenantAId, passwordHashA]);
    const userAId = userAResult.rows[0].id;

    // Create user for tenant B
    const userBResult = await client.query(`
      INSERT INTO users (tenant_id, email, password_hash, role)
      VALUES ($1, 'bob@beta.com', $2, 'owner')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [tenantBId, passwordHashB]);
    const userBId = userBResult.rows[0].id;

    // Create a signup widget for tenant A
    const widgetConfig = {
      title: 'Join Our Newsletter',
      description: 'Stay updated with the latest news',
      fields: [
        { name: 'name', label: 'Full Name', type: 'text', required: true },
        { name: 'email', label: 'Email Address', type: 'email', required: true },
      ],
      buttonText: 'Subscribe',
      successMessage: 'Thanks for subscribing!',
    };

    const widgetAResult = await client.query(`
      INSERT INTO widgets (tenant_id, name, type, config)
      VALUES ($1, 'Newsletter Signup', 'signup', $2)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [tenantAId, JSON.stringify(widgetConfig)]);

    // Create a CTA widget for tenant A
    const ctaConfig = {
      title: 'Get a Free Demo',
      description: 'See how FlyRank can help your business',
      fields: [
        { name: 'name', label: 'Your Name', type: 'text', required: true },
        { name: 'email', label: 'Work Email', type: 'email', required: true },
        { name: 'company', label: 'Company', type: 'text', required: false },
      ],
      buttonText: 'Book Demo',
      successMessage: 'We will be in touch soon!',
    };

    await client.query(`
      INSERT INTO widgets (tenant_id, name, type, config)
      VALUES ($1, 'Demo Request CTA', 'cta', $2)
      ON CONFLICT DO NOTHING
    `, [tenantAId, JSON.stringify(ctaConfig)]);

    // Create a widget for tenant B (for isolation tests)
    await client.query(`
      INSERT INTO widgets (tenant_id, name, type, config)
      VALUES ($1, 'Beta Widget', 'signup', '{"title":"Beta Signup"}')
      ON CONFLICT DO NOTHING
    `, [tenantBId]);

    await client.query('COMMIT');

    console.log('[seed] Seed complete');
    console.log('[seed] Tenant A: alice@acme.com / password123');
    console.log('[seed] Tenant B: bob@beta.com / password456');

    // Print widget IDs for convenience
    const widgets = await client.query('SELECT id, name, tenant_id FROM widgets ORDER BY created_at');
    widgets.rows.forEach(w => {
      console.log(`[seed] Widget: ${w.name} — id=${w.id} tenant=${w.tenant_id}`);
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('[seed] Fatal error:', err.message);
  process.exit(1);
});
