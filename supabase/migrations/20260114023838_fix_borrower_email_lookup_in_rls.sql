/*
  # Fix Borrower Email Lookup in RLS Policy

  1. Changes
    - Replace the auth.users subquery with auth.email() function
    - This is more reliable and has proper permissions in RLS context
    - Maintains all existing access patterns

  2. Security
    - Same security level as before
    - More reliable email matching for borrowers
*/

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view relevant loans" ON loans;

-- Create updated SELECT policy using auth.email()
CREATE POLICY "Authenticated users can view relevant loans"
  ON loans
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can see all loans
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Lender can see loans they created
    lender_id = auth.uid()
    OR
    -- Borrower can see loans by user ID
    borrower_id = auth.uid()
    OR
    -- Borrower can see loans by email (using auth.email() which is more reliable)
    borrower_email = auth.email()
  );
