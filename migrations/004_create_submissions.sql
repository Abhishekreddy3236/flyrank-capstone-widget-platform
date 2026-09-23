-- Migration 004: Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id         UUID NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email             VARCHAR(255),
  name              VARCHAR(255),
  data              JSONB NOT NULL DEFAULT '{}',
  ip                VARCHAR(45),
  geo               JSONB,
  idempotency_key   VARCHAR(255) UNIQUE,
  honeypot_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_widget_id ON submissions(widget_id);
CREATE INDEX IF NOT EXISTS idx_submissions_tenant_id ON submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_idempotency_key ON submissions(idempotency_key) WHERE idempotency_key IS NOT NULL;
-- GIN index for JSONB geo queries (geo breakdown dashboard)
CREATE INDEX IF NOT EXISTS idx_submissions_geo ON submissions USING GIN(geo);
