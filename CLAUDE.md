# FFLTracker

Private friends-and-family loan tracking application.

## Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run db:import -- "../Exports/6-19-26"
```

## Architecture

- React 18, TypeScript, Vite, and Tailwind CSS
- Express API in `server/`
- Turso/libSQL in Vercel, with local SQLite fallback
- Argon2id password hashes
- Server-side sessions stored in SQLite and sent through HTTP-only cookies
- Resend for optional transactional email

The Vite development server proxies `/api` to the Express server on port 3001.
On Vercel, `api/index.ts` exposes the Express application as a function and
`vercel.json` routes the Vite frontend separately.

## Roles

- `borrower`: sees loans associated with their account/email
- `admin`: manages loans they created
- `master_admin`: manages all loans and users

Authorization must always be enforced by the API. Frontend role checks are only
for presentation.

## Data

SQLite uses integer cents for all monetary values. API responses expose dollar
numbers to preserve the existing frontend contract.

Pending borrowers are stored as unregistered users. Signup claims the pending
user by normalized email and links matching loans to the registered account.

## Environment variables

- `DATABASE_PATH`: optional local SQLite path; defaults to `data/ffltracker.sqlite`
- `TURSO_DATABASE_URL`: remote Turso/libSQL URL
- `TURSO_AUTH_TOKEN`: remote Turso authentication token
- `PORT`: API port; defaults to `3001`
- `APP_URL`: public application URL used in emails
- `RESEND_API_KEY`: optional email provider key
- `EMAIL_FROM`: optional sender identity
- `FEEDBACK_EMAIL`: optional feedback recipient
- `CRON_SECRET`: secret for the monthly-statements job endpoint

## CSV import

Set `INITIAL_ADMIN_PASSWORD` before the first import if the exported administrator
should be able to sign in immediately:

```powershell
$env:INITIAL_ADMIN_PASSWORD = "choose-a-strong-password"
npm run db:import -- "..\Exports\6-19-26"
```

The importer preserves UUIDs and timestamps and is idempotent.
