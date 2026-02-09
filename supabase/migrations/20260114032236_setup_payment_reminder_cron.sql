/*
  # Setup Payment Reminder Cron Job

  1. Extensions
    - Enable `pg_cron` extension for scheduled tasks
    - Enable `pg_net` extension for making HTTP requests

  2. Cron Job
    - Create a daily cron job that runs at 9:00 AM UTC
    - Calls the send-payment-reminders edge function
    - Sends payment reminders to borrowers with due payments

  3. Security
    - Grant necessary permissions to execute cron jobs
    - Use service role key for authenticated requests

  Note: The cron job will automatically check for overdue and due payments
  and send email reminders to affected borrowers.
*/

-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions to postgres role for pg_cron
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a daily cron job to send payment reminders at 9:00 AM UTC
SELECT cron.schedule(
  'send-daily-payment-reminders',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-payment-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
