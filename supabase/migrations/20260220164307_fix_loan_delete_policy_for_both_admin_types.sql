/*
  # Fix loan deletion policy to consolidate admin permissions

  1. Changes
    - Drop the separate "Admins can delete loans" policy
    - Drop the "Master admin can delete loans" policy
    - Create a single unified policy for both admin types
  
  2. Security
    - Maintains RLS protection
    - Simplifies policy structure by using a single policy for both admin types
*/

DROP POLICY IF EXISTS "Admins can delete loans" ON loans;
DROP POLICY IF EXISTS "Master admin can delete loans" ON loans;

CREATE POLICY "Admins and master admins can delete loans"
  ON loans
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'master_admin')
    )
  );
