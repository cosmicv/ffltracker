/*
  # Fix borrower loan update permission by email

  1. Changes
    - Update UPDATE policy for loans to match by email address
    - This allows borrowers to approve/reject loans even if borrower_id is null
    - Borrowers can update pending loans that match their email
  
  2. Security
    - Maintains admin access to update all loans
    - Adds email-based matching for borrowers
    - Borrowers can only update status from pending state (non-admins)
*/

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update relevant loans" ON loans;

-- Create updated UPDATE policy that matches by email as well
CREATE POLICY "Authenticated users can update relevant loans"
  ON loans
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can update all loans
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Borrower can update their pending loans by user ID
    (borrower_id = auth.uid() AND status = 'pending')
    OR
    -- Borrower can update pending loans by email (for loans created before they signed up)
    (borrower_email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND status = 'pending')
  )
  WITH CHECK (
    -- Admin can update loans to any state
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Borrower can update their loans (matched by user ID or email)
    borrower_id = auth.uid()
    OR
    borrower_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );