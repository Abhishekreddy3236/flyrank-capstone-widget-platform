'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_minimum_32_chars_long_abc';

const request = require('supertest');
const { app, db, createTestUser, createTestWidget } = require('../helpers');

afterAll(async () => {
  await db.end();
});

describe('Widget CRUD', () => {
  let tokenA, tenantIdA, tokenB, tenantIdB;

  beforeAll(async () => {
    const userA = await createTestUser('widget-a');
    tokenA = userA.token;
    tenantIdA = userA.tenantId;

    const userB = await createTestUser('widget-b');
    tokenB = userB.token;
    tenantIdB = userB.tenantId;
  });

  describe('POST /api/widgets', () => {
    test('creates a signup widget', async () => {
      const res = await request(app)
        .post('/api/widgets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Newsletter Signup',
          type: 'signup',
          config: {
            title: 'Join Us',
            fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
            buttonText: 'Subscribe',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.widget.id).toBeTruthy();
      expect(res.body.widget.name).toBe('Newsletter Signup');
      expect(res.body.widget.type).toBe('signup');
      expect(res.body.widget.tenant_id).toBe(tenantIdA);
    });

    test('creates a CTA widget', async () => {
      const res = await request(app)
        .post('/api/widgets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Demo CTA', type: 'cta', config: {} });

      expect(res.status).toBe(201);
      expect(res.body.widget.type).toBe('cta');
    });

    test('rejects invalid widget type', async () => {
      const res = await request(app)
        .post('/api/widgets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Bad Widget', type: 'invalid_type' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    test('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/widgets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type: 'signup' });

      expect(res.status).toBe(400);
    });

    test('requires authentication', async () => {
      const res = await request(app)
        .post('/api/widgets')
        .send({ name: 'Widget', type: 'signup' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/widgets', () => {
    test('returns only the tenant\'s own widgets', async () => {
      // Create widget for A
      await createTestWidget(tokenA, { name: 'A Widget' });
      // Create widget for B
      await createTestWidget(tokenB, { name: 'B Widget' });

      const resA = await request(app)
        .get('/api/widgets')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.widgets).toBeDefined();
      // All returned widgets should belong to tenantA
      resA.body.widgets.forEach(w => {
        expect(w.tenant_id).toBe(tenantIdA);
      });
    });

    test('requires authentication', async () => {
      const res = await request(app).get('/api/widgets');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/widgets/:id', () => {
    let widgetId;

    beforeAll(async () => {
      const w = await createTestWidget(tokenA);
      widgetId = w.id;
    });

    test('returns widget for correct tenant', async () => {
      const res = await request(app)
        .get(`/api/widgets/${widgetId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.widget.id).toBe(widgetId);
    });

    test('TENANT ISOLATION: tenant B cannot read tenant A\'s widget', async () => {
      const res = await request(app)
        .get(`/api/widgets/${widgetId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    test('returns 404 for non-existent widget', async () => {
      const res = await request(app)
        .get('/api/widgets/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/widgets/:id', () => {
    let widgetId;

    beforeAll(async () => {
      const w = await createTestWidget(tokenA);
      widgetId = w.id;
    });

    test('updates widget name', async () => {
      const res = await request(app)
        .patch(`/api/widgets/${widgetId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.widget.name).toBe('Updated Name');
    });

    test('bumps version on config update', async () => {
      const getRes = await request(app)
        .get(`/api/widgets/${widgetId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      const prevVersion = getRes.body.widget.version;

      const res = await request(app)
        .patch(`/api/widgets/${widgetId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ config: { title: 'New Title' } });

      expect(res.status).toBe(200);
      expect(res.body.widget.version).toBe(prevVersion + 1);
    });

    test('TENANT ISOLATION: tenant B cannot update tenant A\'s widget', async () => {
      const res = await request(app)
        .patch(`/api/widgets/${widgetId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/widgets/:id', () => {
    test('deletes own widget', async () => {
      const widget = await createTestWidget(tokenA);
      
      const res = await request(app)
        .delete(`/api/widgets/${widget.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);

      // Verify deleted
      const getRes = await request(app)
        .get(`/api/widgets/${widget.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(getRes.status).toBe(404);
    });

    test('TENANT ISOLATION: tenant B cannot delete tenant A\'s widget', async () => {
      const widget = await createTestWidget(tokenA);
      
      const res = await request(app)
        .delete(`/api/widgets/${widget.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/widgets/:id/snippet', () => {
    let widgetId;

    beforeAll(async () => {
      const w = await createTestWidget(tokenA);
      widgetId = w.id;
    });

    test('returns embed snippet', async () => {
      const res = await request(app)
        .get(`/api/widgets/${widgetId}/snippet`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.snippet).toContain('widget.v1.js');
      expect(res.body.snippet).toContain(widgetId);
      expect(res.body.snippet).toContain('<script');
    });

    test('TENANT ISOLATION: tenant B cannot get tenant A\'s snippet', async () => {
      const res = await request(app)
        .get(`/api/widgets/${widgetId}/snippet`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });
  });
});
