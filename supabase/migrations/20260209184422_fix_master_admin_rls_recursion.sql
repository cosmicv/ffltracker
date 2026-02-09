/*
  # Fix infinite recursion in master_admin RLS policies

  1. Changes
    - Create a SECURITY DEFINER function `is_master_admin()` that bypasses RLS
      to check if the current user has the master_admin role
    - Drop and recreate the master_admin policies on profiles, loans, and repayments
      to use the new function instead of a subquery on profiles

  2. Why
    - The previous policies queried the profiles table from within a profiles policy,
      causing PostgreSQL to detect infinite recursion (error 42P17)
    - A SECURITY DEFINER function runs with elevated privileges, bypassing RLS,
      which breaks the recursion cycle
*/

CREATE OR REPLACE FUNCTION is_master_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'master_admin'
  );
$$;

-- Recreate profiles policies using the function
DROP POLICY IF EXISTS "Master admin can read all profiles" ON profiles;
CREATE POLICY "Master admin can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_master_admin());

DROP POLICY IF EXISTS "Master admin can delete profiles" ON profiles;
CREATE POLICY "Master admin can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (is_master_admin());

-- Recreate loans policies using the function
DROP POLICY IF EXISTS "Master admin can read all loans" ON loans;
CREATE POLICY "Master admin can read all loans"
  ON loans FOR SELECT
  TO authenticated
  USING (is_master_admin());

DROP POLICY IF EXISTS "Master admin can delete loans" ON loans;
CREATE POLICY "Master admin can delete loans"
  ON loans FOR DELETE
  TO authenticated
  USING (is_master_admin());

-- Recreate repayments policy using the function
DROP POLICY IF EXISTS "Master admin can delete repayments" ON repayments;
CREATE POLICY "Master admin can delete repayments"
  ON repayments FOR DELETE
  TO authenticated
  USING (is_master_admin());
