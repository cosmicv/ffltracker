# FFLTracker

React application for tracking friends-and-family loans. It uses local SQLite
during standalone development or Turso/libSQL when deployed to Vercel.

## Development

```bash
npm install
npm run dev
```

The web application runs at `http://localhost:5173` and the API at
`http://127.0.0.1:3001`.

See `CLAUDE.md` for database import and environment configuration.

## Email configuration

Sign in as a master admin and open **Email Settings**. Enter a Resend API key
and a sender address on your verified Resend domain, then save. Settings persist
in the server database and apply immediately to all email sending. Leave the key
blank when updating the sender to retain the existing key. The API never returns
the saved key to the browser. Database credentials and backups must be protected
because the stored key is a secret.

Existing `RESEND_API_KEY` and `EMAIL_FROM` environment settings remain the fallback
until settings are saved in the app.

## Monthly account summary emails

The production Vercel cron calls `/api/jobs/monthly-statements` on the first of
each month at 14:00 UTC (8 a.m. Central standard time / 9 a.m. Central daylight
time). Every user receives the same account summary as the manual button,
including pending users and users without loans.

In Vercel project Settings → Environment Variables, add `CRON_SECRET` for
Production using a long, randomly generated secret, then redeploy. Vercel supplies
it as a bearer token when running the cron. Configure Resend in Email Settings.
Do not use the Resend API key as the cron secret.

After deployment, check Settings → Cron Jobs for the monthly schedule. As a signed-in
master admin, visit `/api/jobs/monthly-statements?dryRun=1` on the app's domain
to check recipient counts without sending. The Cron Jobs Run button sends real
emails to everyone who has not yet received this month's automatic summary.
Check the job response and Email Logs (Monthly Account Summary) for results.

Successful sends are recorded per user and month. Repeated calls skip those users;
failed sends remain eligible when rerunning the job. Vercel does not automatically
retry failed cron invocations, so inspect failures and rerun as needed. Concurrent
runs claim recipients before sending; interrupted claims can be retried after ten
minutes. Manual summary emails do not suppress the monthly summary.

## Vercel and Turso

Connect the Turso Marketplace integration to the Vercel project. The application
automatically uses `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` when they are
available.

To pull the preview credentials locally:

```bash
vercel env pull .env.development.local --environment=preview
```

The Vercel build serves the Vite frontend from `dist/` and sends `/api/*`
requests to the Express function in `api/index.ts`.
