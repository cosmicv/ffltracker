# Security notes

- Passwords are hashed with Argon2id.
- Sessions are random server-side tokens stored in SQLite.
- Session cookies are HTTP-only, SameSite=Lax, and Secure in production.
- State-changing API requests reject mismatched browser origins.
- Login, signup, and password-reset endpoints are rate limited.
- API routes enforce borrower, admin, and master-admin authorization.
- SQLite foreign keys are enabled and writes use database transactions where
  multiple related records must change together.
- Production dependency audits should be run with `npm audit --omit=dev`.

Production deployments must use HTTPS, a long random `CRON_SECRET`, protected
filesystem permissions for the SQLite database, and automated database backups.
