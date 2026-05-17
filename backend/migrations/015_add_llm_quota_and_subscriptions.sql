CREATE TABLE IF NOT EXISTS llm_usage_daily (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  call_count INT NOT NULL DEFAULT 0 CHECK (call_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS llm_usage_daily_user_date_idx
  ON llm_usage_daily (user_id, usage_date DESC);

CREATE TABLE IF NOT EXISTS subscription_entitlements (
  supabase_user_id TEXT PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT false,
  product_identifier TEXT,
  entitlement_identifier TEXT,
  expires_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_entitlements_active_idx
  ON subscription_entitlements (is_active, expires_at);
