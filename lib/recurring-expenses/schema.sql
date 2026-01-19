-- Recurring Expenses Detection System Schema

-- Table 1: Stores detected recurring expense patterns
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Merchant identification
  merchant_normalized TEXT NOT NULL UNIQUE,
  merchant_display_name TEXT NOT NULL,
  category TEXT NOT NULL,

  -- Classification
  expense_type TEXT NOT NULL CHECK (expense_type IN ('fixed', 'variable_recurring', 'seasonal', 'subscription')),
  priority TEXT NOT NULL CHECK (priority IN ('essential', 'important', 'discretionary')),

  -- Timing patterns
  frequency_days REAL NOT NULL,
  frequency_variance_days REAL,
  typical_day_of_month INTEGER,

  -- Amount patterns
  typical_amount REAL NOT NULL,
  amount_variance_pct REAL NOT NULL,
  min_amount REAL NOT NULL,
  max_amount REAL NOT NULL,
  trend TEXT CHECK (trend IN ('increasing', 'stable', 'decreasing')),

  -- Historical tracking
  occurrence_count INTEGER NOT NULL,
  first_occurrence_date DATE NOT NULL,
  last_occurrence_date DATE NOT NULL,
  last_amount REAL NOT NULL,

  -- Predictions
  next_predicted_date DATE,
  next_predicted_amount REAL,
  prediction_confidence TEXT CHECK (prediction_confidence IN ('high', 'medium', 'low')),

  -- Detection metadata
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  sample_transaction_ids TEXT,
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- User overrides
  user_confirmed BOOLEAN DEFAULT 0,
  user_excluded BOOLEAN DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON recurring_expenses(next_predicted_date)
  WHERE user_excluded = 0;
CREATE INDEX IF NOT EXISTS idx_recurring_confidence ON recurring_expenses(confidence);
CREATE INDEX IF NOT EXISTS idx_recurring_type ON recurring_expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_recurring_merchant ON recurring_expenses(merchant_normalized);

-- Table 2: User feedback for learning system
CREATE TABLE IF NOT EXISTS expense_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_normalized TEXT NOT NULL UNIQUE,
  is_recurring BOOLEAN NOT NULL,
  user_note TEXT,
  user_marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  applied_to_detection BOOLEAN DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_corrections_pending ON expense_corrections(applied_to_detection)
  WHERE applied_to_detection = 0;

-- Table 3: Detected anomalies
CREATE TABLE IF NOT EXISTS recurring_anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recurring_expense_id INTEGER NOT NULL,
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('amount_high', 'amount_low', 'missed', 'early', 'late', 'duplicate_suspected')),
  detected_date DATE NOT NULL,
  transaction_id INTEGER,
  expected_value REAL,
  actual_value REAL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  user_acknowledged BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (recurring_expense_id) REFERENCES recurring_expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_anomalies_unack ON recurring_anomalies(user_acknowledged, severity)
  WHERE user_acknowledged = 0;
CREATE INDEX IF NOT EXISTS idx_anomalies_by_expense ON recurring_anomalies(recurring_expense_id);
