# Build Log: FlyRank Lead-Capture Platform

## Development Process & AI Usage

This project was built with the assistance of an autonomous AI agent (Google Gemini via Antigravity).

### Step-by-Step Implementation

1.  **Project Initialization**:
    *   Set up the Node.js project structure (`src`, `migrations`, `tests`, etc.).
    *   Configured `package.json` with dependencies (Express, pg, jsonwebtoken, zod, etc.) and `docker-compose.yml` for PostgreSQL.

2.  **Database & Migrations**:
    *   Created raw SQL migrations for `tenants`, `users`, `widgets`, `submissions`, and `jobs`.
    *   Implemented a custom migration runner (`src/db/migrate.js`) to apply migrations in order.
    *   Created seed data (`src/db/seed.js`) to set up Acme Corp (Tenant A) and Beta Corp (Tenant B).

3.  **Core Application Logic**:
    *   Built centralized configuration (`src/config/index.js`), robust error handling middleware, and rate limiting (using `express-rate-limit`).
    *   Created data repositories (`src/repositories/`) with strict tenant isolation enforced at the database query level (`tenant_id = $1`).
    *   Built Zod schemas (`src/validators/index.js`) for data validation.

4.  **Service Layer & Probes**:
    *   **Submissions**: Implemented `submissionService.js` to handle honeypot checks, idempotency, geo-enrichment, and background job enqueuing.
    *   **Geo-fallback (Probe 4)**: Built `geoService.js` to attempt IP-API, fallback to ipapi.co on failure, and handle total failure gracefully.
    *   **Honeypot (Probe 6)**: Added hidden fields to the widget. If filled by bots, the API silently drops the submission (returning 200/201 but not storing it) so bots aren't alerted.
    *   **Idempotency**: Utilized an `Idempotency-Key` header and a unique constraint on the database to prevent duplicate submissions from client retries.

5.  **Background Worker (Probe 5)**:
    *   Implemented `src/worker/index.js` using PostgreSQL `FOR UPDATE SKIP LOCKED` for robust background job processing.
    *   Included exponential backoff and terminal failure logging.

6.  **Widget & Embed**:
    *   Created `public/widget.v1.js`, a vanilla JS bundle that loads configuration dynamically, renders the form UI, and submits data handling CORS and rate-limits natively.
    *   Created a mock customer site (`customer-site/index.html`) running on port 5500 to demonstrate full CORS capability against the API on port 3000.

7.  **Testing & Refinement**:
    *   Built 71 automated tests across 5 suites (`auth`, `widgets`, `public`, `dashboard`, `services`) using Jest and Supertest.
    *   Fixed a bug in Zod validation where the honeypot field strictness prevented the service layer from processing it correctly.
    *   Fixed rate limit testing issues due to Jest's concurrent request firing by allocating unique mock IPs per test block.
    *   Validated all 6 Capstone acceptance probes manually via `curl` and automated tests.

### Challenges Encountered
*   Testing rate limiting properly required mocking `X-Forwarded-For` IPs due to Supertest's nature in firing requests from loopback.
*   Making sure the JSON SyntaxError thrown by `body-parser` didn't leak internal class names required specific checks in the custom error handler.

### Final Status
All requirements from the capstone brief have been fulfilled. The system operates efficiently, correctly isolates tenants, prevents abuse, and provides a polished embeddable widget.
