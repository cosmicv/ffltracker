/*
  # Add master_admin role

  1. Schema Changes
    - Add 'master_admin' to the allowed values for the `role` column on `profiles`
    - Update cosmicv@gmail.com profile to have 'master_admin' role

  2. Security Changes
    - Add RLS policy so master_admin users can read all profiles
    - Add RLS policy so master_admin users can delete profiles

  3. Notes
    - master_admin is a superuser role that can manage and delete other users
    - Only cosmicv@gmail.com will be assigned this role
*/

-- Update the check constraint on profiles.role to include master_admin
DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role = ANY (ARRAY['admin'::text, 'borrower'::text, 'master_admin'::text]));
END $$;

-- Set cosmicv@gmail.com as master_admin
UPDATE profiles SET role = 'master_admin' WHERE email = 'cosmicv@gmail.com';

-- Allow master_admin to read all profiles
CREATE POLICY "Master admin can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'master_admin'
    )
  );

-- Allow master_admin to delete profiles
CREATE POLICY "Master admin can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'master_admin'
    )
  );

-- Allow master_admin to read all loans (for managing users' data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Master admin can read all loans'
  ) THEN
    CREATE POLICY "Master admin can read all loans"
      ON loans FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role = 'master_admin'
        )
      );
  END IF;
END $$;

-- Allow master_admin to delete loans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Master admin can delete loans'
  ) THEN
    CREATE POLICY "Master admin can delete loans"
      ON loans FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role = 'master_admin'
        )
      );
  END IF;
END $$;

-- Allow master_admin to delete repayments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Master admin can delete repayments'
  ) THEN
    CREATE POLICY "Master admin can delete repayments"
      ON repayments FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role = 'master_admin'
        )
      );
  END IF;
END $$;
