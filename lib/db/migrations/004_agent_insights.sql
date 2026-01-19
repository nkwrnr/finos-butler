-- Agent insights table
CREATE TABLE IF NOT EXISTS agent_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_type TEXT NOT NULL,              -- 'analyst', 'optimizer', 'predictor', 'advisor'
  insight_type TEXT NOT NULL,            -- 'spending_spike', 'spending_drop', 'merchant_frequency', 'merchant_avg_change', 'seasonal_anomaly', 'category_trend'
  title TEXT NOT NULL,                   -- Short headline (< 100 chars)
  body TEXT NOT NULL,                    -- Full insight text with data
  data_json TEXT,                        -- Supporting data for charts/details
  severity TEXT DEFAULT 'info',          -- 'info', 'warning', 'action_needed'
  category TEXT,                         -- Related spending category (if applicable)
  merchant TEXT,                         -- Related merchant (if applicable)
  period_type TEXT,                      -- 'daily', 'weekly', 'monthly'
  reference_date TEXT,                   -- YYYY-MM-DD, the date/period this insight refers to
  comparison_period TEXT,                -- What it was compared against
  amount_current REAL,                   -- Current period amount
  amount_previous REAL,                  -- Comparison period amount
  percent_change REAL,                   -- Calculated % change
  actionable INTEGER DEFAULT 0,          -- Has a recommended action?
  action_text TEXT,                      -- Suggested action
  dismissed INTEGER DEFAULT 0,           -- User dismissed this insight
  viewed INTEGER DEFAULT 0,              -- User has seen this insight
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,                       -- When insight becomes stale
  UNIQUE(agent_type, insight_type, reference_date, category, merchant)
);

-- Agent run history
CREATE TABLE IF NOT EXISTS agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_type TEXT NOT NULL,
  run_type TEXT DEFAULT 'scheduled',     -- 'scheduled', 'manual', 'triggered'
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  status TEXT DEFAULT 'running',         -- 'running', 'completed', 'failed'
  insights_generated INTEGER DEFAULT 0,
  insights_data TEXT,                    -- JSON summary of what was found
  error_message TEXT,
  run_metadata TEXT                      -- JSON with run parameters
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_insights_agent_type ON agent_insights(agent_type);
CREATE INDEX IF NOT EXISTS idx_insights_created ON agent_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_dismissed ON agent_insights(dismissed);
CREATE INDEX IF NOT EXISTS idx_insights_severity ON agent_insights(severity);
CREATE INDEX IF NOT EXISTS idx_runs_agent_type ON agent_runs(agent_type);
CREATE INDEX IF NOT EXISTS idx_runs_started ON agent_runs(started_at DESC);
