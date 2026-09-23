'use strict';

/**
 * Test database helper — sets up a test DB connection.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://flyrank:flyrank_secret@localhost:5432/flyrank_capstone';
process.env.JWT_SECRET = 'test_jwt_secret_minimum_32_chars_long_abc';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '10';
process.env.CORS_ORIGINS = 'http://localhost:5500,http://127.0.0.1:5500';
process.env.WIDGET_CONFIG_CACHE_TTL = '300';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

/**
 * Create a test user and return token + IDs.
 */
async function createTestUser(suffix = '') {
  const email = `test${suffix}${Date.now()}@flyrank-test.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'TestPass123!', tenantName: `Test Tenant ${Date.now()}` });
  
  if (res.status !== 201) {
    throw new Error(`Failed to create test user: ${JSON.stringify(res.body)}`);
  }
  
  return {
    token: res.body.token,
    userId: res.body.user.id,
    tenantId: res.body.user.tenantId,
    email,
  };
}

/**
 * Create a test widget for a user.
 */
async function createTestWidget(token, overrides = {}) {
  const res = await request(app)
    .post('/api/widgets')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Test Widget',
      type: 'signup',
      config: {
        title: 'Test Form',
        fields: [
          { name: 'email', label: 'Email', type: 'email', required: true },
        ],
        buttonText: 'Subscribe',
      },
      ...overrides,
    });
  
  if (res.status !== 201) {
    throw new Error(`Failed to create test widget: ${JSON.stringify(res.body)}`);
  }
  
  return res.body.widget;
}

/**
 * Clean up test data from the database.
 */
async function cleanTestData() {
  // Clean test emails
  await db.query(`
    DELETE FROM users WHERE email LIKE '%flyrank-test.com%'
  `).catch(() => {});
}

module.exports = { createTestUser, createTestWidget, cleanTestData, app, db };
