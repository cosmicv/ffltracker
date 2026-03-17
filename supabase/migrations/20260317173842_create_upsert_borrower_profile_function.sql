/*
  # Create upsert_borrower_profile function

  ## Summary
  Creates a security-definer function that allows any authenticated user to
  insert a borrower profile row. This bypasses RLS so the frontend can
  reliably create the profile when a new loan is created, without depending
  on the edge function timing.

  ## Details
  - Function: upsert_borrower_profile(email, full_name)
  - Returns the profile id (existing or newly created)
  - Uses INSERT ... ON CONFLICT DO NOTHING so it's safe to call multiple times
  - SECURITY DEFINER runs as the function owner (postgres), bypassing RLS
*/

CREATE OR REPLACE FUNCTION upsert_borrower_profile(
  p_email text,
  p_full_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM profiles WHERE email = p_email;

  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO profiles (id, email, full_name, role, registered)
    VALUES (v_id, p_email, p_full_name, 'borrower', false)
    ON CONFLICT (email) DO NOTHING;

    SELECT id INTO v_id FROM profiles WHERE email = p_email;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_borrower_profile(text, text) TO authenticated;
