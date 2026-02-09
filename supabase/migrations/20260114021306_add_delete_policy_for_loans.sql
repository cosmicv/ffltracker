/*
  # Add DELETE policy for loans table

  1. Changes
    - Add DELETE policy for loans table to allow admins to delete loans
    - This fixes the issue where deleted loans were not being removed from the dashboard
  
  2. Security
    - Only users with 'admin' role can delete loans
    - Ensures data can only be deleted by authorized administrators
*/

-- Drop policy if it exists, then create it
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can delete loans" ON loans;
END $$;

-- Add DELETE policy for loans
CREATE POLICY "Admins can delete loans"
  ON loans
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );