/*
  # Fix borrower loan visibility by email

  1. Changes
    - Update SELECT policy for loans to match by email address
    - This allows borrowers to see loans even if they haven't been linked by user ID yet
    - Borrowers who sign up after a loan is created will now see their pending loans
  
  2. Security
    - Maintains admin access to all loans
    - Adds email-based matching for borrowers using auth.users table
    - Ensures borrowers can only see loans where they are the borrower
*/

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view relevant loans" ON loans;

-- Create updated SELECT policy that matches by email as well
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
    -- Borrower can see loans by user ID
    borrower_id = auth.uid()
    OR
    -- Borrower can see loans by email (for loans created before they signed up)
    borrower_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );