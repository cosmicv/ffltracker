/*
  # Fix Security and Performance Issues

  ## Changes

  ### 1. Add Missing Index
  - Add index for `loans.lender_id` foreign key to improve query performance

  ### 2. Optimize RLS Policies
  Update all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
  to prevent re-evaluation on each row, significantly improving query performance.

  ### Tables Updated
  - `profiles`: 3 policies optimized
  - `loans`: 5 policies optimized
  - `repayments`: 3 policies optimized

  ### Performance Impact
  These changes prevent the auth.uid() function from being called for every row
  in query results, which can dramatically improve performance at scale.
*/

-- Add missing index for lender_id foreign key
CREATE INDEX IF NOT EXISTS idx_loans_lender_id ON loans(lender_id);

-- Drop existing RLS policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Recreate profiles policies with optimized auth calls
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- Drop existing RLS policies for loans
DROP POLICY IF EXISTS "Admins can view all loans" ON loans;
DROP POLICY IF EXISTS "Borrowers can view their own loans" ON loans;
DROP POLICY IF EXISTS "Admins can create loans" ON loans;
DROP POLICY IF EXISTS "Admins can update loans" ON loans;
DROP POLICY IF EXISTS "Borrowers can approve their pending loans" ON loans;

-- Recreate loans policies with optimized auth calls
CREATE POLICY "Admins can view all loans"
  ON loans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Borrowers can view their own loans"
  ON loans FOR SELECT
  TO authenticated
  USING (borrower_id = (select auth.uid()));

CREATE POLICY "Admins can create loans"
  ON loans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update loans"
  ON loans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Borrowers can approve their pending loans"
  ON loans FOR UPDATE
  TO authenticated
  USING (borrower_id = (select auth.uid()) AND status = 'pending')
  WITH CHECK (borrower_id = (select auth.uid()));

-- Drop existing RLS policies for repayments
DROP POLICY IF EXISTS "Admins can view all repayments" ON repayments;
DROP POLICY IF EXISTS "Borrowers can view their loan repayments" ON repayments;
DROP POLICY IF EXISTS "Admins can manage repayments" ON repayments;

-- Recreate repayments policies with optimized auth calls
CREATE POLICY "Admins can view all repayments"
  ON repayments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Borrowers can view their loan repayments"
  ON repayments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = repayments.loan_id
      AND loans.borrower_id = (select auth.uid())
    )
  );

CREATE POLICY "Admins can manage repayments"
  ON repayments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );
