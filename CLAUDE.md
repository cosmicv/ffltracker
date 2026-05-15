# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # Production build (run to verify no TS/compile errors)
npm run typecheck    # Type-check without emitting
npm run lint         # ESLint
npm run dev          # Local dev server (Vite, port 5173)
```

## What This App Is

**FFLTracker** — a private loan tracking platform for friends-and-family lending. Lenders (admins) create loans for borrowers, generate repayment schedules, and track payments. Borrowers log in to view their own loan details and payment history. On the 1st of each month, every borrower with an active loan receives an automated account statement email via Resend.

## Architecture

### Tech Stack
- React 18 + TypeScript + Vite
- Tailwind CSS (no component library)
- Supabase (Postgres + Auth + Edge Functions + pg_cron)
- Stripe for subscriptions ($20/year)
- Resend for transactional email

### Role System
Three roles stored in `profiles.role`:
- `borrower` — can only see their own loans
- `admin` — lender; creates and manages loans, sees all loans they created
- `master_admin` — superuser (only `cosmicv@gmail.com`); manages all users, can delete any data, sees everything

Role determines which dashboard renders at `/` (see `src/App.tsx`).

### Auth Flow
`AuthContext` (`src/contexts/AuthContext.tsx`) wraps the entire app. It fetches the user's profile from `profiles` on login and exposes `{ user, profile, loading }`. The `profile.role` field is the source of truth for access control. `useAuth()` is available via `src/hooks/useAuth.ts` (re-exports from context).

`ProtectedRoute` (`src/components/ProtectedRoute.tsx`) gates routes by role.

### Database Schema (core tables)
- `profiles` — one row per auth user; has `id` (= `auth.uid()`), `email`, `full_name`, `role`, `registered` flag
- `loans` — created by admins; `borrower_id` is nullable until the borrower registers; `lender_id` links to the admin's profile; `status` flows `active → completed`
- `repayments` — child rows of `loans`; one per payment period; `paid` + `paid_at` toggled when the admin marks payment received
- `email_logs` — append-only audit log written by edge functions; admins can read
- `feedback` — user-submitted feedback (feature requests / bug reports)
- `stripe_customers`, `stripe_subscriptions`, `stripe_user_subscriptions` (view) — Stripe billing state managed by the `stripe-webhook` edge function

RLS is enabled on all tables. Policies use `(select auth.uid())` (not `auth.uid()`) for performance — maintain this pattern in new migrations.

### Borrower Registration Flow
Admins create a loan by email. If the borrower hasn't registered yet, their profile is a shell row inserted via the `upsert_borrower_profile` DB function. The borrower receives an invitation email (`send-loan-invitation` edge function) with a signup link. When they register, `profiles.registered` flips to `true` and `loans.borrower_id` gets linked. `UserManagement` shows unregistered borrowers (have a loan but no `profiles` row or `registered = false`) alongside registered users.

### Edge Functions (`supabase/functions/`)
All functions use Deno + `npm:@supabase/supabase-js@2`. Each is self-contained (no shared code between functions).

| Function | Trigger | Purpose |
|---|---|---|
| `send-loan-invitation` | Admin creates loan | Sends borrower their signup/login link |
| `resend-invite` | Admin clicks resend | Re-sends invitation email |
| `send-loan-status-notification` | Loan status changes | Notifies borrower of status update |
| `send-payment-reminders` | pg_cron on the 1st | Monthly account statement to all active borrowers |
| `send-feedback-email` | User submits feedback | Forwards feedback to admin email |
| `delete-user` | Master admin deletes user | Deletes auth user + cascades via service role |
| `stripe-checkout` | User starts subscription | Creates Stripe Checkout session |
| `stripe-portal` | User manages billing | Opens Stripe Customer Portal |
| `stripe-webhook` | Stripe sends event | Syncs subscription state to DB |

External API calls (Resend, Stripe) must always go through edge functions — never call third-party APIs directly from the frontend.

### Stripe Integration
Product config lives in `src/stripe-config.ts`. `src/lib/stripe.ts` contains `createCheckoutSession` and `createPortalSession` which call the relevant edge functions. Subscription state is read via the `stripe_user_subscriptions` view using `useSubscription` hook.

### Migrations
All schema changes go through `supabase/migrations/`. Use the `mcp__supabase__apply_migration` tool. Each migration file must start with a detailed comment block explaining the change. Never use `DROP` or `DELETE` in migrations; never use `BEGIN`/`COMMIT`/`ROLLBACK`.

### Environment Variables
Frontend (`.env`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Edge functions (auto-provisioned by Supabase):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` — transactional email
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — billing
- `APP_URL` — base URL used in email links
