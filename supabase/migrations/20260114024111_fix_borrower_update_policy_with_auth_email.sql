/*
  # Fix Borrower Update Policy with auth.email()

  1. Changes
    - Replace auth.users subquery with auth.email() function in UPDATE policy
    - This matches the fix we did for SELECT policy
    - More reliable email matching for borrowers
    
  2. Security
    - Borrowers can update loans assigned to their email (even if borrower_id is null)
    - Only pending loans can be updated by borrowers
    - Once updated, borrower_id gets set
*/

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update relevant loans" ON loans;

-- Create updated UPDATE policy using auth.email()
CREATE POLICY "Authenticated users can update relevant loans"
  ON loans
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can update any loan
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Borrower can update loans by ID (if already set)
    (borrower_id = auth.uid() AND status = 'pending')
    OR
    -- Borrower can update loans by email (using auth.email() which is more reliable)
    (borrower_email = auth.email() AND status = 'pending')
  )
  WITH CHECK (
    -- Admin can set any values
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Borrower can only update to their own ID
    borrower_id = auth.uid()
    OR
    -- Or match their email
    borrower_email = auth.email()
  );
