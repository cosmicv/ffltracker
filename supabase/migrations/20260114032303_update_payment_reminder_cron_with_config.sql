/*
  # Update Payment Reminder Cron Job with Configuration

  1. Cron Job
    - Remove old cron job if exists
    - Create a daily cron job that runs at 9:00 AM UTC
    - Calls the send-payment-reminders edge function with proper configuration
    - Sends payment reminders to borrowers with due payments

  Note: The cron job will automatically check for overdue and due payments
  and send email reminders to affected borrowers.
*/

-- Remove the old cron job if it exists
SELECT cron.unschedule('send-daily-payment-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-daily-payment-reminders'
);

-- Create a daily cron job to send payment reminders at 9:00 AM UTC
SELECT cron.schedule(
  'send-daily-payment-reminders',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://bfjmakwhbrnxsevqqtuo.supabase.co/functions/v1/send-payment-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmam1ha3doYnJueHNldnFxdHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNTQyNDgsImV4cCI6MjA4MzkzMDI0OH0.o5CkPJBVwt4hO1tqG2A1J6eD3bjuFWAx0H0j_xGrt1A"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);
