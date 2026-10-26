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
