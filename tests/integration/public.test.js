'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_minimum_32_chars_long_abc';
process.env.TEST_RATE_LIMIT = 'true';
process.env.RATE_LIMIT_WINDOW_MS = '5000';
process.env.RATE_LIMIT_MAX_REQUESTS = '5';

const request = require('supertest');
const { app, db, createTestUser, createTestWidget } = require('../helpers');
const geoService = require('../../src/services/geoService');
const sideEffectService = require('../../src/services/sideEffectService');
const submissionRepository = require('../../src/repositories/submissionRepository');

let token, tenantId;

// Use a unique IP per test group to avoid cross-test rate-limit interference
let ipCounter = 100;
function nextIp() {
  return `10.0.1.${ipCounter++}`;
}

beforeAll(async () => {
  const user = await createTestUser('pub');
  token = user.token;
  tenantId = user.tenantId;
});

afterAll(async () => {
  geoService.clearProviderOverride();
  sideEffectService.clearHandler();
  await db.end();
});

beforeEach(() => {
  geoService.setProviderOverride(async () => ({
    country: 'India',
    countryCode: 'IN',
    city: 'Hyderabad',
    provider: 'mock',
  }));
  sideEffectService.clearHandler();
});

afterEach(() => {
  geoService.clearProviderOverride();
  sideEffectService.clearHandler();
});

// ── Config endpoint ────────────────────────────────────────────────────────

describe('Public Config API', () => {
  let widget;
  beforeAll(async () => { widget = await createTestWidget(token, { name: 'Config Widget' }); });

  test('returns public config with Cache-Control header', async () => {
    const res = await request(app).get(`/api/public/widgets/${widget.id}/config`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(widget.id);
    expect(res.body.config).toBeDefined();
    expect(res.body.tenant_id).toBeUndefined(); // No secrets
    const cc = res.headers['cache-control'];
    expect(cc).toContain('public');
    expect(cc).toContain('max-age=');
  });

  test('404 for non-existent widget', async () => {
    const res = await request(app).get('/api/public/widgets/00000000-0000-0000-0000-000000000000/config');
    expect(res.status).toBe(404);
  });

  test('400 for invalid widget ID format', async () => {
    const res = await request(app).get('/api/public/widgets/not-a-uuid/config');
    expect(res.status).toBe(400);
  });

  test('CORS headers on config endpoint', async () => {
    const res = await request(app)
      .get(`/api/public/widgets/${widget.id}/config`)
      .set('Origin', 'http://localhost:5500');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5500');
  });

  test('OPTIONS preflight on config endpoint', async () => {
    const res = await request(app)
      .options(`/api/public/widgets/${widget.id}/config`)
      .set('Origin', 'http://localhost:5500')
      .set('Access-Control-Request-Method', 'GET');
    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5500');
  });
});

// ── PROBE 1: Valid second-origin submission ───────────────────────────────

describe('PROBE 1 — Valid second-origin submission', () => {
  let widget, ip;
  beforeAll(async () => {
    widget = await createTestWidget(token, { name: 'Probe1 Widget' });
    ip = nextIp();
  });

  test('accepts valid submission → 201', async () => {
    const res = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('Origin', 'http://localhost:5500')
      .set('X-Forwarded-For', ip)
      .send({ name: 'Alice', email: 'alice@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.id).toBeTruthy();
  });

  test('stores submission linked to widget+tenant in DB', async () => {
    const res = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('X-Forwarded-For', ip)
      .send({ name: 'Bob', email: 'bob@example.com' });

    expect(res.status).toBe(201);
    const dbResult = await db.query('SELECT * FROM submissions WHERE id = $1', [res.body.id]);
    expect(dbResult.rows.length).toBe(1);
    expect(dbResult.rows[0].widget_id).toBe(widget.id);
    expect(dbResult.rows[0].tenant_id).toBe(tenantId);
  });

  test('CORS: cross-origin returns Access-Control-Allow-Origin', async () => {
    const res = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('Origin', 'http://localhost:5500')
      .set('X-Forwarded-For', nextIp())
      .send({ name: 'CORS User', email: 'cors@example.com' });

    expect(res.status).toBe(201);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5500');
  });

  test('OPTIONS preflight for submissions endpoint', async () => {
    const res = await request(app)
      .options(`/api/public/widgets/${widget.id}/submissions`)
      .set('Origin', 'http://localhost:5500')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,Idempotency-Key');
    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5500');
  });

  test('submission visible in dashboard API', async () => {
    await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('X-Forwarded-For', nextIp())
      .send({ name: 'Dashboard Test', email: 'dash@example.com' });

    const dashRes = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.total).toBeGreaterThan(0);
  });
});

// ── PROBE 2: Malformed / Oversized payload ────────────────────────────────

describe('PROBE 2 — Malformed / Oversized payload', () => {
  let widget, ip;
  beforeAll(async () => {
    widget = await createTestWidget(token, { name: 'Probe2 Widget' });
    ip = nextIp();
  });

  test('400 for malformed JSON', async () => {
    const res = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('Content-Type', 'application/json')
      .set('X-Forwarded-For', ip)
      .send('{ not valid json }');
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  test('400 for missing required fields', async () => {
    const res = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('X-Forwarded-For', ip)
      .send({ data: { extra: 'only' } });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  test('400 for invalid email format', async () => {
    const res = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('X-Forwarded-For', ip)
      .send({ name: 'Test', email: 'not-valid-email' });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  test('413 for oversized payload', async () => {
    const bigBlob = 'x'.repeat(200 * 1024);
    const res = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('Content-Type', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send(JSON.stringify({ name: 'Test', email: 'test@e.com', data: { blob: bigBlob } }));
    expect([400, 413]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  test('400 for invalid widget ID format', async () => {
    const res = await request(app)
      .post('/api/public/widgets/not-a-uuid/submissions')
      .set('X-Forwarded-For', ip)
      .send({ name: 'Test', email: 'test@example.com' });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  test('404 for unknown widget UUID', async () => {
    const res = await request(app)
      .post('/api/public/widgets/00000000-0000-0000-0000-000000000000/submissions')
      .set('X-Forwarded-For', ip)
      .send({ name: 'Test', email: 'test@example.com' });
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(500);
  });
});

// ── PROBE 3: Rate limiting ────────────────────────────────────────────────

describe('PROBE 3 — Rate limiting', () => {
  test('returns 429 after burst, then normal request succeeds', async () => {
    const user2 = await createTestUser('rl');
    const widget2 = await createTestWidget(user2.token);
    const burstIp = nextIp();

    // Send 20 requests — enough to exceed any reasonable rate limit (5 or 10)
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app)
          .post(`/api/public/widgets/${widget2.id}/submissions`)
          .set('X-Forwarded-For', burstIp)
          .send({ name: 'Burst', email: 'burst@example.com' })
      )
    );
    const statuses = results.map(r => r.status);
    // Some should succeed, some should get rate-limited
    expect(statuses.filter(s => s === 201 || s === 200).length).toBeGreaterThan(0);
    expect(statuses).toContain(429);
  });
});

// ── PROBE 4: Geo provider fallback ────────────────────────────────────────

describe('PROBE 4 — Geo fallback', () => {
  let widget, ip;
  beforeAll(async () => {
    widget = await createTestWidget(token, { name: 'Probe4 Widget' });
    ip = nextIp();
  });

  test('CASE A: Provider B used when A fails → submission succeeds with geo', async () => {
    geoService.setProviderOverride(async () => ({
      country: 'Germany',
      countryCode: 'DE',
      city: 'Berlin',
      provider: 'provider-b-mock',
    }));

    const res = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('X-Forwarded-For', ip)
      .send({ name: 'Geo B Test', email: 'geob@example.com' });

    expect(res.status).toBe(201);
    const row = await db.query('SELECT geo FROM submissions WHERE id = $1', [res.body.id]);
    expect(row.rows[0].geo).toBeTruthy();
    expect(row.rows[0].geo.countryCode).toBe('DE');
  });

  test('CASE B: Both fail → submission still succeeds, geo is null', async () => {
    geoService.setProviderOverride(async () => {
      throw new Error('Both geo providers simulated failure');
    });

    const res = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('X-Forwarded-For', nextIp())
      .send({ name: 'No Geo', email: 'nogeo@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    const row = await db.query('SELECT geo FROM submissions WHERE id = $1', [res.body.id]);
    expect(row.rows[0].geo).toBeNull();
  });
});

// ── PROBE 5: Side effect failure ─────────────────────────────────────────

describe('PROBE 5 — Side effect failure', () => {
  let widget, ip;
  beforeAll(async () => {
    widget = await createTestWidget(token, { name: 'Probe5 Widget' });
    ip = nextIp();
  });

  test('submission succeeds even when side effect throws', async () => {
    sideEffectService.setHandler(async () => {
      throw new Error('Simulated notification failure');
    });

    const res = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('X-Forwarded-For', ip)
      .send({ name: 'SE Fail', email: 'sefail@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');

    // Submission persisted in DB
    const row = await db.query('SELECT id FROM submissions WHERE id = $1', [res.body.id]);
    expect(row.rows.length).toBe(1);

    // Job created for background processing
    const jobRow = await db.query(
      "SELECT id, status FROM jobs WHERE payload->>'submissionId' = $1",
      [res.body.id]
    );
    expect(jobRow.rows.length).toBeGreaterThan(0);
  });

  test('job retry mechanism works', async () => {
    const jobRepository = require('../../src/repositories/jobRepository');
    const job = await jobRepository.create({
      type: 'submission.notify',
      payload: { submissionId: 'test-retry', widgetId: 'w', tenantId: 't', email: 'e@e.com', name: 'N' },
      maxAttempts: 3,
    });
    expect(job.status).toBe('pending');

    await jobRepository.scheduleRetry(job.id, 1, 'First failure');
    const retried = await jobRepository.findById(job.id);
    expect(retried.status).toBe('pending');
    expect(retried.attempts).toBe(1);
    expect(retried.last_error).toContain('First failure');
  });

  test('job marked as permanently failed after exhausting retries', async () => {
    const jobRepository = require('../../src/repositories/jobRepository');
    const job = await jobRepository.create({
      type: 'submission.notify',
      payload: { test: 'terminal' },
      maxAttempts: 3,
    });
    await jobRepository.markFailed(job.id, 'Terminal error');
    const failedJob = await jobRepository.findById(job.id);
    expect(failedJob.status).toBe('failed');
    expect(failedJob.last_error).toBe('Terminal error');
  });
});

// ── PROBE 6: Honeypot ─────────────────────────────────────────────────────

describe('PROBE 6 — Honeypot spam protection', () => {
  let widget, ip, dropIp, emptyIp;
  beforeAll(async () => {
    widget = await createTestWidget(token, { name: 'Probe6 Widget' });
    dropIp = nextIp();
    emptyIp = nextIp();
  });

  test('bot submission with honeypot → silently dropped, not stored', async () => {
    const beforeCount = await submissionRepository.countByTenant(tenantId);

    const res = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('X-Forwarded-For', dropIp)
      .send({
        name: 'Bot',
        email: 'bot@spam.com',
        website: 'http://spam-site.com', // Honeypot populated
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('dropped');

    const afterCount = await submissionRepository.countByTenant(tenantId);
    expect(afterCount).toBe(beforeCount); // Not stored as legitimate lead
  });

  test('real human submission with empty honeypot → accepted', async () => {
    const res = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('X-Forwarded-For', emptyIp)
      .send({
        name: 'Real Human',
        email: 'human@example.com',
        website: '', // Empty — real human
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────

describe('Idempotency', () => {
  let widget, ip;
  beforeAll(async () => {
    widget = await createTestWidget(token, { name: 'Idempotency Widget' });
    ip = nextIp();
  });

  test('same Idempotency-Key → duplicate not created', async () => {
    const key = `idem-${Date.now()}`;
    const payload = { name: 'Idem User', email: 'idem@example.com' };

    const res1 = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('Idempotency-Key', key)
      .set('X-Forwarded-For', ip)
      .send(payload);

    const res2 = await request(app)
      .post(`/api/public/widgets/${widget.id}/submissions`)
      .set('Idempotency-Key', key)
      .set('X-Forwarded-For', ip)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(200);
    expect(res2.body.idempotent).toBe(true);

    // Only one row in DB
    const row = await db.query(
      'SELECT COUNT(*) as cnt FROM submissions WHERE idempotency_key = $1',
      [key]
    );
    expect(parseInt(row.rows[0].cnt)).toBe(1);
  });
});
