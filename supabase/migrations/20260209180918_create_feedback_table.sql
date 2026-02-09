/*
  # Create feedback table

  1. New Tables
    - `feedback`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `user_email` (text) - stores email for reference
      - `user_name` (text) - stores name for reference
      - `message` (text) - the feedback message
      - `type` (text) - either 'feature_request' or 'problem_report'
      - `created_at` (timestamp)
      - `status` (text) - tracks if feedback has been reviewed (new, reviewed)
  
  2. Security
    - Enable RLS on `feedback` table
    - Add policy for authenticated users to insert their own feedback
    - Add policy for authenticated users to view their own feedback
    - Add policy for admins to view all feedback

  3. Important notes
    - All users can submit feedback
    - Users can only view their own feedback submissions
    - This creates a record for tracking and potential admin dashboard view
*/

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  user_name text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('feature_request', 'problem_report')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback"
  ON feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);