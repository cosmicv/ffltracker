/*
  # Fix Security and Performance Issues

  1. Performance Improvements
    - Add indexes for foreign keys on `loans` table (borrower_id, lender_id)
    - Optimize RLS policies on `feedback` table to use `(select auth.uid())` pattern
  
  2. Security Fixes
    - Fix function search_path on `check_borrower_registered` function
  
  3. Important Notes
    - Foreign key indexes improve query performance when joining or filtering by these columns
    - RLS optimization prevents re-evaluation of auth functions for each row
    - Function search_path security prevents potential privilege escalation
*/

-- Add indexes for foreign keys on loans table
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_lender_id ON loans(lender_id);

-- Drop and recreate RLS policies on feedback table with optimized auth calls
DROP POLICY IF EXISTS "Users can insert own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can view own feedback" ON feedback;

CREATE POLICY "Users can insert own feedback"
  ON feedback
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own feedback"
  ON feedback
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Fix search_path issue on check_borrower_registered function
DROP FUNCTION IF EXISTS check_borrower_registered(text);

CREATE OR REPLACE FUNCTION check_borrower_registered(borrower_email_param text)
RETURNS TABLE (is_registered boolean, user_id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN p.id IS NOT NULL THEN true ELSE false END as is_registered,
    p.id as user_id,
    p.full_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  WHERE u.email = borrower_email_param;
END;
$$;