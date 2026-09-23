'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_minimum_32_chars_long_abc';

const request = require('supertest');
const { app, db, createTestUser } = require('../helpers');

afterAll(async () => {
  await db.end();
});

describe('Authentication', () => {
  describe('POST /api/auth/register', () => {
    test('registers a new user and returns a JWT', async () => {
      const email = `reg-${Date.now()}@flyrank-test.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'SecurePass123!', tenantName: 'Test Corp' });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.tenantId).toBeTruthy();
    });

    test('rejects duplicate email', async () => {
      const email = `dup-${Date.now()}@flyrank-test.com`;
      await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'Pass123!', tenantName: 'Corp A' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'Pass123!', tenantName: 'Corp B' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeTruthy();
    });

    test('rejects invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'Pass123!', tenantName: 'Corp' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    test('rejects short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: `short-${Date.now()}@flyrank-test.com`, password: 'abc', tenantName: 'Corp' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    test('rejects missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    let testEmail;
    
    beforeAll(async () => {
      testEmail = `login-${Date.now()}@flyrank-test.com`;
      await request(app)
        .post('/api/auth/register')
        .send({ email: testEmail, password: 'LoginPass123!', tenantName: 'Login Corp' });
    });

    test('logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'LoginPass123!' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.email).toBe(testEmail);
    });

    test('rejects wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    test('rejects non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@flyrank-test.com', password: 'Pass123!' });

      expect(res.status).toBe(401);
    });

    test('rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-email', password: 'Pass123!' });

      expect(res.status).toBe(400);
    });
  });

  describe('Protected routes', () => {
    test('rejects request without token', async () => {
      const res = await request(app).get('/api/widgets');
      expect(res.status).toBe(401);
    });

    test('rejects invalid token', async () => {
      const res = await request(app)
        .get('/api/widgets')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });

    test('rejects malformed authorization header', async () => {
      const res = await request(app)
        .get('/api/widgets')
        .set('Authorization', 'NotBearer token123');
      expect(res.status).toBe(401);
    });

    test('accepts valid token', async () => {
      const { token } = await createTestUser('auth');
      const res = await request(app)
        .get('/api/widgets')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
