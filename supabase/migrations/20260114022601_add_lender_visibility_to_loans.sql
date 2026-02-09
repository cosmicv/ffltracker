/*
  # Add Lender Visibility to Loans

  1. Changes
    - Update SELECT policy to include lender access
    - Lenders can now see loans they've created
    - Maintains all existing access patterns (admin, borrower by ID, borrower by email)
  
  2. Security
    - Only the loan creator (lender) can view their created loans
    - All other existing security checks remain in place
*/

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view relevant loans" ON loans;

-- Create updated SELECT policy that includes lender access
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
    -- Borrower can see loans by email (for loans created before they signed up)
    borrower_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );
