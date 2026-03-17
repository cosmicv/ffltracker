/*
  # Allow admins to insert borrower profiles

  ## Summary
  Adds an INSERT policy so that admin and master_admin users can create
  profile records for borrowers who don't yet have accounts (e.g., when
  a lender creates a loan for a new user).

  ## Security
  - Only users whose own profile has role 'admin' or 'master_admin' may insert
  - Uses a subquery to check the inserter's role, avoiding recursion
*/

CREATE POLICY "Admins can insert borrower profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'master_admin')
    )
  );
