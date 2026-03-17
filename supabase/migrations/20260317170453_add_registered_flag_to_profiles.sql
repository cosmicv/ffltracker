/*
  # Add registered flag to profiles

  ## Summary
  Adds a `registered` boolean column to the profiles table to distinguish between:
  - Borrowers who were auto-created when a lender created a loan for them (registered = false)
  - Users who have actually signed up with an account (registered = true)

  ## Changes
  - `profiles` table: new column `registered` (boolean, default false)
  - All existing profiles are assumed to be registered users (set to true)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'registered'
  ) THEN
    ALTER TABLE profiles ADD COLUMN registered boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- All existing profiles are real registered users
UPDATE profiles SET registered = true WHERE registered = false;
