/*
  # Initial Schema

  ## Summary
  Creates the core application tables required before any subsequent migrations run.
  Stripe tables are intentionally excluded — they are created in a later migration
  (empty_jungle.sql) with the correct schema including soft-delete columns.

  ## Tables Created
  - `profiles` — one row per auth user; stores role and registration state
  - `loans` — loan records created by admins for borrowers
  - `repayments` — individual payment schedule rows for each loan

  ## Notes
  - RLS is enabled on all tables; policies are added in subsequent migrations
  - `profiles.role` starts with only 'admin' and 'borrower'; 'master_admin' added later
  - `loans.status` starts with full set; 'pending' removed in a later migration
*/

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'borrower' CHECK (role IN ('admin', 'borrower')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);

-- loans
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  lender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  borrower_name text NOT NULL DEFAULT '',
  borrower_email text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  interest_rate numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'approved', 'active', 'completed', 'rejected')),
  approved_at timestamptz,
  start_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans (borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_email ON loans (borrower_email);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans (status);

-- repayments
CREATE TABLE IF NOT EXISTS repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE repayments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_repayments_loan_id ON repayments (loan_id);
CREATE INDEX IF NOT EXISTS idx_repayments_due_date ON repayments (due_date);
