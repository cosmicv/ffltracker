/*
  # Fix monthly statement cron invocation

  The previous monthly cron depended on app.settings.supabase_anon_key. If that
  setting was not configured in the database, the job failed before invoking the
  Edge Function. This version keeps the setting override but falls back to the
  public publishable key used by the deployed frontend.
*/

SELECT cron.unschedule('send-daily-payment-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-daily-payment-reminders'
);

SELECT cron.unschedule('send-monthly-payment-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-monthly-payment-reminders'
);

SELECT cron.schedule(
  'send-monthly-payment-reminders',
  '0 9 1 * *',
  $$
  SELECT
    net.http_post(
      url := 'https://favjgknkznswawrqwugb.supabase.co/functions/v1/send-payment-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          NULLIF(current_setting('app.settings.supabase_anon_key', true), ''),
          'sb_publishable_gRLLJzYHoOlleTAlMG2oSg_FRr9cRR_'
        ),
        'apikey', COALESCE(
          NULLIF(current_setting('app.settings.supabase_anon_key', true), ''),
          'sb_publishable_gRLLJzYHoOlleTAlMG2oSg_FRr9cRR_'
        )
      ),
      body := jsonb_build_object('source', 'pg_cron', 'job', 'send-monthly-payment-reminders')
    ) as request_id;
  $$
);
