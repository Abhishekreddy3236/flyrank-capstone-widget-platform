# FlyRank Embeddable Widget & Lead-Capture Platform

A multi-tenant embeddable widget platform that allows customers to create lead-capture forms (signup, CTA, popover) and embed them on external websites using a single `<script>` tag.

> **FlyRank Internship — Backend Track Capstone Project**

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  PATH 1 — Widget Owner (Authenticated)                            │
│                                                                    │
│  POST /api/auth/register | POST /api/auth/login                   │
│  JWT Bearer Token                                                  │
│  POST/GET/PATCH/DELETE /api/widgets                               │
│  GET /api/dashboard/stats                                          │
│  → Tenant-isolated PostgreSQL                                      │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  PATH 2 — Customer Website (Second Origin :5500)                   │
│                                                                    │
│  <script src="localhost:3000/widget.v1.js" data-widget-id="..."> │
│  GET /api/public/widgets/:id/config  (CORS + Cache-Control)       │
│  → Widget renders on customer page                                 │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  PATH 3 — Visitor Submission Pipeline                              │
│                                                                    │
│  POST /api/public/widgets/:id/submissions                         │
│  CORS → Rate Limit → Validation → Honeypot →                      │
│  Idempotency → Geo Enrichment → PostgreSQL →                      │
│  Background Job → Side Effect (console notification)              │
└──────────────────────────────────────────────────────────────────┘
```

```
src/
  app.js              ← Express application
  server.js           ← Entry point (DB check + listen)
  config/             ← Environment-based configuration
  db/
    index.js          ← PostgreSQL connection pool
    migrate.js        ← Migration runner
    seed.js           ← Seed data
  middleware/
    auth.js           ← JWT authentication
    cors.js           ← CORS (public vs private)
    errorHandler.js   ← Centralized error handling
    rateLimiter.js    ← Rate limiting (per IP+widget)
  routes/
    auth.js           ← Register + Login
    widgets.js        ← Authenticated widget CRUD
    public.js         ← Public config + submissions
    dashboard.js      ← Analytics (authenticated)
  services/
    authService.js    ← Registration + JWT issuance
    widgetService.js  ← Widget logic + embed snippet
    submissionService.js ← Full submission pipeline
    geoService.js     ← IP geolocation (A→B fallback)
    sideEffectService.js ← Background notification
  repositories/       ← Database access layer
  validators/         ← Zod validation schemas
  worker/
    index.js          ← Background job processor

migrations/           ← SQL migrations (001–005)
public/
  widget.v1.js        ← Versioned widget bundle
customer-site/
  index.html          ← Second-origin demo page
tests/
  integration/        ← API integration tests
  unit/               ← Service unit tests
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥ 18 |
| Framework | Express.js 4 |
| Database | PostgreSQL 16 (Docker) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | Zod |
| Rate Limiting | express-rate-limit |
| Geo Provider A | ip-api.com |
| Geo Provider B | ipapi.co |
| Side Effect | Console simulation |
| Testing | Jest + Supertest |
| Customer Site | Plain HTML on port 5500 |

---

## Prerequisites

- Node.js ≥ 18
- Docker Desktop (for PostgreSQL)
- npm

---

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://flyrank:flyrank_secret@localhost:5432/flyrank_capstone` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | — |
| `JWT_EXPIRES_IN` | Token TTL | `7d` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `10` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5500` |
| `WIDGET_CONFIG_CACHE_TTL` | Config cache TTL (seconds) | `300` |
| `GEO_PROVIDER_A_URL` | Geo provider A base URL | `http://ip-api.com/json` |
| `GEO_PROVIDER_B_URL` | Geo provider B base URL | `https://ipapi.co` |
| `WORKER_POLL_INTERVAL_MS` | Worker poll interval | `2000` |
| `WORKER_MAX_RETRIES` | Job max retry attempts | `3` |

---

## Installation & Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

Wait for healthy:
```bash
docker compose exec postgres pg_isready -U flyrank -d flyrank_capstone
```

### 3. Run migrations

```bash
npm run migrate
```

### 4. Seed database

```bash
npm run seed
```

Seed creates:
- **Tenant A**: `alice@acme.com` / `password123`
- **Tenant B**: `bob@beta.com` / `password456`
- Sample widgets for each tenant

### 5. Start API server

```bash
npm run dev
```

Server runs on: http://localhost:3000

### 6. Start background worker

```bash
npm run worker
```

### 7. Start customer demo site (second origin)

```bash
npx serve customer-site -p 5500
```

Or any static file server on port 5500.

Customer site runs on: http://localhost:5500

---

## API Documentation

### Authentication

#### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "you@company.com",
  "password": "SecurePass123!",
  "tenantName": "Your Company"
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "alice@acme.com",
  "password": "password123"
}

→ { "token": "eyJ...", "user": { "id": "...", "email": "...", "tenantId": "..." } }
```

### Widget Management (JWT Required)

All requests require: `Authorization: Bearer <token>`

#### Create widget
```
POST /api/widgets
{
  "name": "Newsletter Signup",
  "type": "signup",
  "config": {
    "title": "Join Us",
    "fields": [{"name":"email","label":"Email","type":"email","required":true}],
    "buttonText": "Subscribe"
  }
}
```

Widget types: `signup` | `contact` | `cta` | `popover`

#### List widgets
```
GET /api/widgets
```

#### Get widget
```
GET /api/widgets/:id
```

#### Update widget
```
PATCH /api/widgets/:id
{ "name": "New Name", "active": false }
```

#### Delete widget
```
DELETE /api/widgets/:id
```

#### Get embed snippet
```
GET /api/widgets/:id/snippet

→ {
    "snippet": "<script src=\"http://localhost:3000/widget.v1.js\" data-widget-id=\"...\" ...></script>"
  }
```

### Public APIs (No Auth Required)

#### Get widget config (cacheable)
```
GET /api/public/widgets/:id/config

← Cache-Control: public, max-age=300
← Access-Control-Allow-Origin: http://localhost:5500
```

#### Submit form
```
POST /api/public/widgets/:id/submissions
Origin: http://localhost:5500
Content-Type: application/json
Idempotency-Key: unique-client-key (optional)

{
  "name": "Visitor Name",
  "email": "visitor@example.com",
  "data": { "company": "Acme" },
  "website": ""  // Honeypot — must be empty
}

← 201 { "id": "...", "status": "success" }
← 400 Validation error
← 404 Widget not found
← 413 Payload too large
← 429 Rate limit exceeded
```

### Dashboard (JWT Required)

#### Aggregate stats
```
GET /api/dashboard/stats
→ { "total": 42, "byWidget": [...], "geoBreakdown": [...], "dailyCounts": [...] }
```

#### Per-widget stats
```
GET /api/dashboard/widgets/:id/stats
→ { "widgetId": "...", "total": 10, "geoBreakdown": [...] }
```

---

## Widget Embed Usage

1. Get your embed snippet:
```bash
GET /api/widgets/:id/snippet
```

2. Paste the `<script>` tag into your website's HTML (before `</body>`):
```html
<script
  src="http://localhost:3000/widget.v1.js"
  data-widget-id="YOUR_WIDGET_UUID"
  data-config-url="http://localhost:3000/api/public/widgets/YOUR_WIDGET_UUID/config"
  async>
</script>
```

The widget auto-renders a floating button. Visitors click to open the form and submit.

---

## Testing

### Run all tests
```bash
npm test
```

### Run with coverage
```bash
npm run test:coverage
```

Tests: **71 tests** across 5 suites covering:
- Authentication (registration, login, JWT)
- Widget CRUD + tenant isolation
- Public API (config, submissions, CORS)
- All 6 acceptance probes
- Dashboard + geo breakdown
- Unit tests (geo fallback, honeypot)

---

## Acceptance Probes

All 6 probes pass automatically in `npm test`. To run manually:

```bash
# Probe 1 — Valid submission from second origin
curl -X POST http://localhost:3000/api/public/widgets/:id/submissions \
  -H "Origin: http://localhost:5500" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com"}'

# Probe 2 — Malformed payload (should return 400)
curl -X POST http://localhost:3000/api/public/widgets/:id/submissions \
  -H "Content-Type: application/json" \
  -d 'not valid json'

# Probe 3 — Rate limit (run 15+ times, should see 429)
for i in {1..15}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/api/public/widgets/:id/submissions \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"t@t.com"}'
done

# Probe 6 — Honeypot (should return "dropped")
curl -X POST http://localhost:3000/api/public/widgets/:id/submissions \
  -H "Content-Type: application/json" \
  -d '{"name":"Bot","email":"bot@spam.com","website":"http://spam.com"}'
```

---

## Security Considerations

- **JWT**: HS256, configurable expiry, secret from env only
- **Passwords**: bcrypt with cost factor 10
- **Tenant isolation**: Every DB query includes `tenant_id = $N` — cross-tenant access is impossible at the database level
- **Input validation**: Zod schemas at every boundary
- **Rate limiting**: Per IP+widget ID, configurable window
- **CORS**: Explicit origin whitelist, not `*`
- **Payload limit**: 100KB maximum
- **No secrets in code**: All secrets via environment variables
- **SQL injection**: Parameterized queries throughout
- **Error responses**: Internal errors never expose stack traces or class names

---

## Failure Handling

| Failure | Behavior |
|---------|----------|
| Geo provider A fails | Tries provider B |
| Both geo providers fail | Submission succeeds, geo stored as null |
| Side effect throws | Submission returns success, job retries |
| Job exhausts retries | Marked `failed`, error logged |
| Invalid input | Clean 4xx JSON response |
| Rate limit exceeded | 429 with retryAfter |
| Honeypot triggered | Silently dropped (200 response to not alert bots) |
| Database error | 500 with non-revealing message |

---

## Known Limitations

- Rate limit uses in-memory store — resets on server restart (acceptable for single-instance capstone)
- Geo enrichment skips private/localhost IPs (by design for local testing)
- Side effect is console logging (Mailpit integration is possible with minimal changes)
- No frontend dashboard UI (API-only, per capstone specification)

---
