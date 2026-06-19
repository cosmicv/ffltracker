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
- SQLite database at `data/ffltracker.sqlite`
- Argon2id password hashes
- Server-side sessions stored in SQLite and sent through HTTP-only cookies
- Resend for optional transactional email

The Vite development server proxies `/api` to the Express server on port 3001.
In production, the Express server serves the built `dist/` frontend.

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

- `DATABASE_PATH`: optional SQLite path; defaults to `data/ffltracker.sqlite`
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
