/*
  # Create Email Logs Table

  ## Summary
  Adds a persistent log of all emails sent by the system (loan invitations, payment
  reminders, status notifications). Each row records the recipient, the type of email,
  whether it succeeded, the external provider message ID, and any error message when
  delivery fails.

  ## New Tables
  - `email_logs`
    - `id` (uuid, pk) — unique row identifier
    - `email_type` (text) — category: 'loan_invitation' | 'payment_reminder' | 'status_notification' | 'account_statement'
    - `recipient_email` (text) — who the email was sent to
    - `recipient_name` (text) — display name of recipient
    - `loan_id` (uuid, nullable) — associated loan if applicable
    - `subject` (text) — email subject line
    - `status` (text) — 'sent' | 'failed'
    - `provider_message_id` (text, nullable) — ID returned by Resend on success
    - `error_message` (text, nullable) — error detail on failure
    - `sent_at` (timestamptz) — when the send was attempted

  ## Security
  - RLS enabled
  - Master admins and admins can read all logs (via service role in edge functions)
  - No direct user insert/update/delete (only the service role writes logs)
*/

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  loan_id uuid REFERENCES loans(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'sent',
  provider_message_id text,
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs (recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_loan_id ON email_logs (loan_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs (status);

CREATE POLICY "Admins can view email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'master_admin')
    )
  );
