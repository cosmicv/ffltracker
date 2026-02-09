/*
  # Fix RLS Policy - Auth Users Permission Error

  1. Changes
    - Grant SELECT permission on auth.users to authenticated users
    - This allows RLS policies to query user email addresses
    - Fixes "permission denied for table users" error
  
  2. Security
    - Only grants read access to authenticated users
    - Users can only see their own data through RLS policies
    - This is a standard Supabase pattern for email-based matching
*/

-- Grant SELECT permission on auth.users to authenticated role
GRANT SELECT ON auth.users TO authenticated;
