'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_minimum_32_chars_long_abc';

const request = require('supertest');
const { app, db, createTestUser, createTestWidget } = require('../helpers');
const geoService = require('../../src/services/geoService');

afterAll(async () => {
  geoService.clearProviderOverride();
  await db.end();
});

describe('Dashboard API', () => {
  let tokenA, tenantIdA, tokenB, tenantIdB, widgetA;

  beforeAll(async () => {
    const userA = await createTestUser('dash-a');
    tokenA = userA.token;
    tenantIdA = userA.tenantId;

    const userB = await createTestUser('dash-b');
    tokenB = userB.token;
    tenantIdB = userB.tenantId;

    widgetA = await createTestWidget(tokenA);

    // Use mock geo
    geoService.setProviderOverride(async () => ({
      country: 'United States',
      countryCode: 'US',
      city: 'New York',
      provider: 'mock',
    }));

    // Create some submissions for tenant A
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/api/public/widgets/${widgetA.id}/submissions`)
        .send({ name: `User ${i}`, email: `user${i}@example.com` });
    }

    geoService.clearProviderOverride();
  });

  describe('GET /api/dashboard/stats', () => {
    test('returns aggregate stats for tenant', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.total).toBe('number');
      expect(res.body.total).toBeGreaterThan(0);
      expect(Array.isArray(res.body.byWidget)).toBe(true);
      expect(Array.isArray(res.body.geoBreakdown)).toBe(true);
      expect(Array.isArray(res.body.dailyCounts)).toBe(true);
    });

    test('geo breakdown populated from submissions', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      // Should have geo data
      const hasGeo = res.body.geoBreakdown.some(g => g.country === 'United States');
      expect(hasGeo).toBe(true);
    });

    test('TENANT ISOLATION: tenant B only sees their own data', async () => {
      // Create widget + submission for tenant B
      const widgetB = await createTestWidget(tokenB);
      
      geoService.setProviderOverride(async () => ({
        country: 'Canada',
        countryCode: 'CA',
        provider: 'mock',
      }));
      
      await request(app)
        .post(`/api/public/widgets/${widgetB.id}/submissions`)
        .send({ name: 'B User', email: 'buser@example.com' });
      
      geoService.clearProviderOverride();

      const resA = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${tokenA}`);

      const resB = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${tokenB}`);

      // Tenant A stats should NOT include tenant B's submissions
      expect(resA.body.total).not.toBe(resB.body.total);
      
      // Tenant A should not see Canada (only tenant B has Canada submissions)
      const aHasCanada = resA.body.geoBreakdown.some(g => g.country_code === 'CA');
      expect(aHasCanada).toBe(false);
      
      // Tenant B should see Canada
      const bHasCanada = resB.body.geoBreakdown.some(g => g.country_code === 'CA');
      expect(bHasCanada).toBe(true);
    });

    test('requires authentication', async () => {
      const res = await request(app).get('/api/dashboard/stats');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/dashboard/widgets/:id/stats', () => {
    test('returns per-widget stats', async () => {
      const res = await request(app)
        .get(`/api/dashboard/widgets/${widgetA.id}/stats`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.widgetId).toBe(widgetA.id);
      expect(typeof res.body.total).toBe('number');
    });

    test('TENANT ISOLATION: cannot see another tenant\'s widget stats', async () => {
      const res = await request(app)
        .get(`/api/dashboard/widgets/${widgetA.id}/stats`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });
  });
});
