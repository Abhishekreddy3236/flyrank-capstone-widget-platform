-- Migration 003: Create widgets table
CREATE TABLE IF NOT EXISTS widgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(50) NOT NULL DEFAULT 'signup',
  config      JSONB NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint: type must be one of the supported types
ALTER TABLE widgets ADD CONSTRAINT widgets_type_check
  CHECK (type IN ('signup', 'contact', 'cta', 'popover'));

CREATE INDEX IF NOT EXISTS idx_widgets_tenant_id ON widgets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_widgets_type ON widgets(type);
CREATE INDEX IF NOT EXISTS idx_widgets_active ON widgets(active);
