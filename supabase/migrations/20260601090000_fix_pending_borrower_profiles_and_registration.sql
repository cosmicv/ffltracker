/*
  # Fix pending borrower profiles and registration

  Pending borrower profiles are created before the borrower has an auth.users row.
  The original profiles.id -> auth.users(id) foreign key prevented that model from
  working. This migration allows pending profiles, lets a signup claim the pending
  row, and restores the boolean registration lookup expected by the UI.
*/

ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_borrower_id_fkey;
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_lender_id_fkey;

ALTER TABLE loans
  ADD CONSTRAINT loans_borrower_id_fkey
  FOREIGN KEY (borrower_id) REFERENCES profiles(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE loans
  ADD CONSTRAINT loans_lender_id_fkey
  FOREIGN KEY (lender_id) REFERENCES profiles(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

DROP FUNCTION IF EXISTS check_borrower_registered(text);
CREATE OR REPLACE FUNCTION check_borrower_registered(borrower_email_param text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT registered
      FROM profiles
      WHERE lower(email) = lower(borrower_email_param)
      ORDER BY registered DESC, created_at DESC
      LIMIT 1
    ),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION check_borrower_registered(text) TO authenticated;

CREATE OR REPLACE FUNCTION upsert_borrower_profile(
  p_email text,
  p_full_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'master_admin')
  ) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT id INTO v_id
  FROM profiles
  WHERE lower(email) = lower(p_email)
  ORDER BY registered DESC, created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO profiles (id, email, full_name, role, registered)
    VALUES (v_id, lower(p_email), p_full_name, 'borrower', false);
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_borrower_profile(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION claim_registered_profile(p_full_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := lower(auth.email());
  v_pending_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'authenticated user required';
  END IF;

  SELECT id INTO v_pending_id
  FROM profiles
  WHERE lower(email) = v_email
  ORDER BY (id = v_user_id) DESC, registered DESC, created_at DESC
  LIMIT 1;

  IF v_pending_id IS NULL THEN
    INSERT INTO profiles (id, email, full_name, role, registered)
    VALUES (v_user_id, v_email, p_full_name, 'borrower', true);
  ELSIF v_pending_id = v_user_id THEN
    UPDATE profiles
    SET full_name = COALESCE(NULLIF(p_full_name, ''), full_name),
        email = v_email,
        registered = true
    WHERE id = v_user_id;
  ELSE
    UPDATE profiles
    SET id = v_user_id,
        full_name = COALESCE(NULLIF(p_full_name, ''), full_name),
        email = v_email,
        registered = true
    WHERE id = v_pending_id;
  END IF;

  UPDATE loans
  SET borrower_id = v_user_id
  WHERE lower(borrower_email) = v_email;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_registered_profile(text) TO authenticated;
