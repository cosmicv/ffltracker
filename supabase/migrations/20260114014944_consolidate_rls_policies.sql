/*
  # Consolidate RLS Policies

  ## Changes
  
  ### 1. Consolidate Multiple Permissive Policies
  Combine multiple permissive policies into single policies with OR conditions.
  This improves performance and eliminates security warnings while maintaining
  the same access control logic.

  ### Benefits
  - Eliminates "Multiple Permissive Policies" warnings
  - Potentially improves query planning performance
  - Cleaner, more maintainable security model
  - Same security guarantees as before

  ### Tables Updated
  - `loans`: Consolidate SELECT and UPDATE policies
  - `repayments`: Consolidate SELECT policies and remove redundant policy
*/

-- Drop existing loans SELECT policies
DROP POLICY IF EXISTS "Admins can view all loans" ON loans;
DROP POLICY IF EXISTS "Borrowers can view their own loans" ON loans;

-- Create consolidated loans SELECT policy
CREATE POLICY "Authenticated users can view relevant loans"
  ON loans FOR SELECT
  TO authenticated
  USING (
    -- Admins can view all loans
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
    OR
    -- Borrowers can view their own loans
    borrower_id = (select auth.uid())
  );

-- Drop existing loans UPDATE policies
DROP POLICY IF EXISTS "Admins can update loans" ON loans;
DROP POLICY IF EXISTS "Borrowers can approve their pending loans" ON loans;

-- Create consolidated loans UPDATE policy
CREATE POLICY "Authenticated users can update relevant loans"
  ON loans FOR UPDATE
  TO authenticated
  USING (
    -- Admins can update any loan
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
    OR
    -- Borrowers can update their pending loans
    (borrower_id = (select auth.uid()) AND status = 'pending')
  )
  WITH CHECK (
    -- Admins can make any updates
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
    OR
    -- Borrowers can only update their own loans
    borrower_id = (select auth.uid())
  );

-- Drop existing repayments SELECT policies
DROP POLICY IF EXISTS "Admins can view all repayments" ON repayments;
DROP POLICY IF EXISTS "Borrowers can view their loan repayments" ON repayments;
DROP POLICY IF EXISTS "Admins can manage repayments" ON repayments;

-- Create consolidated repayments SELECT policy
CREATE POLICY "Authenticated users can view relevant repayments"
  ON repayments FOR SELECT
  TO authenticated
  USING (
    -- Admins can view all repayments
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
    OR
    -- Borrowers can view repayments for their own loans
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = repayments.loan_id
      AND loans.borrower_id = (select auth.uid())
    )
  );

-- Create separate policies for INSERT, UPDATE, DELETE for admins only
CREATE POLICY "Admins can insert repayments"
  ON repayments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update repayments"
  ON repayments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete repayments"
  ON repayments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );
