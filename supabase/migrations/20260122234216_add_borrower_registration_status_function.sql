/*
  # Add Borrower Registration Status Function

  1. New Functions
    - `check_borrower_registered(email)` - Returns boolean indicating if borrower has registered
      - Takes borrower email as parameter
      - Checks if email exists in auth.users table
      - Returns true if user exists, false otherwise
  
  2. Security
    - Function is SECURITY DEFINER to allow checking auth.users
    - Only accessible to authenticated users
    - Safe for admin use to check borrower registration status

  3. Purpose
    - Allows admins to see which borrowers have completed registration
    - Helps track user onboarding status
*/

-- Create function to check if borrower has registered
CREATE OR REPLACE FUNCTION check_borrower_registered(borrower_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE email = borrower_email
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_borrower_registered(text) TO authenticated;