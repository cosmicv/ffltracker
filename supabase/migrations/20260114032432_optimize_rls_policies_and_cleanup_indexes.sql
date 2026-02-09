/*
  # Optimize RLS Policies and Clean Up Unused Indexes

  1. RLS Policy Optimization
    - Drop and recreate three policies on loans table
    - Wrap auth function calls with (select auth.function()) for better performance
    - This prevents re-evaluation of auth functions for each row
    
  2. Index Cleanup
    - Remove unused indexes that are not being utilized
    - Reduces database maintenance overhead
    
  3. Schema Optimization
    - Move pg_net extension from public schema to extensions schema
    
  ## Changes Made:
  
  ### RLS Policies Updated:
  - "Admins can delete loans" - optimized auth.uid() calls
  - "Authenticated users can view relevant loans" - optimized auth.uid() and auth.email() calls
  - "Authenticated users can update relevant loans" - optimized auth.uid() and auth.email() calls
  
  ### Indexes Removed:
  - idx_loans_borrower_id (unused)
  - idx_loans_lender_id (unused)
  - idx_repayments_due_date (unused)
  
  ### Extension Migration:
  - Moved pg_net from public to extensions schema
*/

-- Drop and recreate the three problematic policies with optimized auth function calls

-- 1. Admins can delete loans
DROP POLICY IF EXISTS "Admins can delete loans" ON loans;
CREATE POLICY "Admins can delete loans"
  ON loans
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- 2. Authenticated users can view relevant loans
DROP POLICY IF EXISTS "Authenticated users can view relevant loans" ON loans;
CREATE POLICY "Authenticated users can view relevant loans"
  ON loans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
    OR lender_id = (SELECT auth.uid())
    OR borrower_id = (SELECT auth.uid())
    OR borrower_email = (SELECT auth.email())
  );

-- 3. Authenticated users can update relevant loans
DROP POLICY IF EXISTS "Authenticated users can update relevant loans" ON loans;
CREATE POLICY "Authenticated users can update relevant loans"
  ON loans
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
    OR (borrower_id = (SELECT auth.uid()) AND status = 'pending')
    OR (borrower_email = (SELECT auth.email()) AND status = 'pending')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
    OR borrower_id = (SELECT auth.uid())
    OR borrower_email = (SELECT auth.email())
  );

-- Remove unused indexes
DROP INDEX IF EXISTS idx_loans_borrower_id;
DROP INDEX IF EXISTS idx_loans_lender_id;
DROP INDEX IF EXISTS idx_repayments_due_date;

-- Move pg_net extension from public schema to extensions schema
-- First, create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop pg_net from public and recreate in extensions schema
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA extensions TO postgres;
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
