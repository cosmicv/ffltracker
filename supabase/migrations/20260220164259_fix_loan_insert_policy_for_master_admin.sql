/*
  # Fix loan insertion policy for master admins

  1. Changes
    - Drop the existing "Admins can create loans" policy
    - Create a new policy that allows both admins AND master_admins to insert loans
  
  2. Security
    - Maintains RLS protection
    - Ensures both admin and master_admin roles can create loans
*/

DROP POLICY IF EXISTS "Admins can create loans" ON loans;

CREATE POLICY "Admins and master admins can create loans"
  ON loans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'master_admin')
    )
  );
