/*
  # Change payment reminder cron to run on the 1st of each month

  ## Summary
  Updates the payment reminder cron job to fire once per month on the 1st at 9:00 AM UTC,
  instead of running daily.

  ## Changes
  - Unschedules the existing daily cron job
  - Creates a new monthly cron job: runs at 09:00 UTC on the 1st of every month (0 9 1 * *)
*/

SELECT cron.unschedule('send-daily-payment-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-daily-payment-reminders'
);

SELECT cron.schedule(
  'send-monthly-payment-reminders',
  '0 9 1 * *',
  $$
  SELECT
    net.http_post(
      url := 'https://bfjmakwhbrnxsevqqtuo.supabase.co/functions/v1/send-payment-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmam1ha3doYnJueHNldnFxdHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNTQyNDgsImV4cCI6MjA4MzkzMDI0OH0.o5CkPJBVwt4hO1tqG2A1J6eD3bjuFWAx0H0j_xGrt1A"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);
