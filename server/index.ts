import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  clearSession,
  consumeResetToken,
  createResetToken,
  hashPassword,
  loadUser,
  newId,
  requireAuth,
  requireRole,
  setSession,
  verifyPassword,
  type AuthRequest,
} from './auth.js';
import { db, loanRow, publicUser, repaymentRow } from './db.js';
import { sendEmail } from './email.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const appUrl =
  process.env.APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${port}`);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(loadUser);
app.use((req, res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.header('origin');
    if (origin) {
      try {
        const requestHost = req.header('host');
        if (new URL(origin).host !== requestHost) {
          res.status(403).json({ error: 'Cross-origin request rejected' });
          return;
        }
      } catch {
        res.status(403).json({ error: 'Invalid request origin' });
        return;
      }
    }
  }
  next();
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });
const asyncRoute = (
  handler: (req: AuthRequest, res: express.Response) => Promise<void>,
) => (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  handler(req, res).catch(next);
};

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const now = () => new Date().toISOString();
const cents = (value: unknown) => Math.round(Number(value) * 100);

async function accessibleLoanRows(user: NonNullable<AuthRequest['authUser']>) {
  if (user.role === 'master_admin') {
    return db.prepare('SELECT * FROM loans ORDER BY created_at DESC').all();
  }
  if (user.role === 'admin') {
    return db.prepare('SELECT * FROM loans WHERE lender_user_id = ? ORDER BY created_at DESC').all(user.id);
  }
  return db.prepare(`
    SELECT * FROM loans
    WHERE borrower_user_id = ? OR lower(borrower_email) = lower(?)
    ORDER BY created_at DESC
  `).all(user.id, user.email);
}

function canManageLoan(user: NonNullable<AuthRequest['authUser']>, loan: Record<string, unknown>) {
  return user.role === 'master_admin' ||
    (user.role === 'admin' && loan.lender_user_id === user.id);
}

async function getLoan(id: string) {
  return db.prepare('SELECT * FROM loans WHERE id = ?').get(id) as Promise<Record<string, unknown> | undefined>;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    database: process.env.TURSO_DATABASE_URL ? 'turso' : 'local',
    databaseAuthConfigured: Boolean(process.env.TURSO_AUTH_TOKEN),
  });
});

app.get('/api/auth/me', (req: AuthRequest, res) => {
  res.json({ user: req.authUser || null, profile: req.authUser || null });
});

app.post('/api/auth/login', authLimiter, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const row = await db.prepare('SELECT * FROM users WHERE email = ? AND registered = 1').get(email) as
    | Record<string, unknown>
    | undefined;
  if (!row?.password_hash || !(await verifyPassword(String(row.password_hash), password))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  await clearSession(req, res);
  await setSession(res, String(row.id));
  const user = publicUser(row);
  res.json({ user, profile: user });
}));

app.post('/api/auth/signup', authLimiter, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const fullName = String(req.body.fullName || '').trim();
  if (!email || !fullName || password.length < 8) {
    res.status(400).json({ error: 'Name, valid email, and an 8-character password are required' });
    return;
  }

  const existing = await db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
    | Record<string, unknown>
    | undefined;
  if (existing?.registered) {
    res.status(409).json({ error: 'An account already exists for this email' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const userId = existing ? String(existing.id) : newId();
  await db.batch([
    existing ? {
      sql: `UPDATE users SET full_name = ?, registered = 1, password_hash = ?, updated_at = ? WHERE id = ?`,
      args: [fullName, passwordHash, now(), userId],
    } : {
      sql: `INSERT INTO users (id, email, full_name, role, registered, password_hash, created_at)
            VALUES (?, ?, ?, 'borrower', 1, ?, ?)`,
      args: [userId, email, fullName, passwordHash, now()],
    },
    {
      sql: `UPDATE loans SET borrower_user_id = ? WHERE lower(borrower_email) = lower(?)`,
      args: [userId, email],
    },
  ]);
  const user = publicUser(await db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>);
  await setSession(res, userId);
  res.status(201).json({ user, profile: user });
}));

app.post('/api/auth/logout', asyncRoute(async (req, res) => {
  await clearSession(req, res);
  res.json({ success: true });
}));

app.post('/api/auth/forgot-password', authLimiter, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await db.prepare('SELECT * FROM users WHERE email = ? AND registered = 1').get(email) as
    | Record<string, unknown>
    | undefined;
  if (user) {
    const token = await createResetToken(String(user.id));
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    await sendEmail({
      type: 'password_reset',
      to: email,
      name: String(user.full_name),
      subject: 'Reset your FFLTracker password',
      html: `<p>Use the link below to reset your password. It expires in one hour.</p><p><a href="${resetUrl}">Reset password</a></p>`,
    });
    if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
      res.json({ success: true, resetUrl });
      return;
    }
  }
  res.json({ success: true });
}));

app.post('/api/auth/reset-password', authLimiter, asyncRoute(async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  const userId = await consumeResetToken(token);
  if (!userId) {
    res.status(400).json({ error: 'Reset link is invalid or expired' });
    return;
  }
  await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(await hashPassword(password), now(), userId);
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  res.json({ success: true });
}));

app.get('/api/loans', requireAuth, asyncRoute(async (req, res) => {
  res.json((await accessibleLoanRows(req.authUser!)).map((row) => loanRow(row as Record<string, unknown>)));
}));

app.post('/api/loans', requireRole('admin', 'master_admin'), asyncRoute(async (req, res) => {
  const borrowerEmail = normalizeEmail(req.body.borrower_email);
  const borrowerName = String(req.body.borrower_name || '').trim();
  const amountCents = cents(req.body.amount);
  if (!borrowerEmail || !borrowerName || !Number.isSafeInteger(amountCents) || amountCents < 0) {
    res.status(400).json({ error: 'Borrower, email, and a valid amount are required' });
    return;
  }
  let borrower = await db.prepare('SELECT id FROM users WHERE email = ?').get(borrowerEmail) as { id: string } | undefined;
  if (!borrower) {
    const id = newId();
    await db.prepare(`
      INSERT INTO users (id, email, full_name, role, registered, created_at)
      VALUES (?, ?, ?, 'borrower', 0, ?)
    `).run(id, borrowerEmail, borrowerName, now());
    borrower = { id };
  }
  const id = newId();
  await db.prepare(`
    INSERT INTO loans (
      id, borrower_user_id, lender_user_id, borrower_name, borrower_email,
      amount_cents, interest_rate, frequency, status, approved_at, start_date, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    borrower.id,
    req.authUser!.id,
    borrowerName,
    borrowerEmail,
    amountCents,
    Number(req.body.interest_rate || 0),
    req.body.frequency || 'monthly',
    req.body.status || 'active',
    req.body.approved_at || null,
    req.body.start_date || null,
    String(req.body.notes || ''),
    now(),
  );
  res.status(201).json(loanRow((await getLoan(id))!));
}));

app.patch('/api/loans/:id', requireRole('admin', 'master_admin'), asyncRoute(async (req, res) => {
  const loanId = String(req.params.id);
  const loan = await getLoan(loanId);
  if (!loan) {
    res.status(404).json({ error: 'Loan not found' });
    return;
  }
  if (!canManageLoan(req.authUser!, loan)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const allowed = ['status', 'notes', 'start_date', 'approved_at', 'frequency', 'interest_rate'] as const;
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in req.body) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if ('amount' in req.body) {
    updates.push('amount_cents = ?');
    values.push(cents(req.body.amount));
  }
  if (!updates.length) {
    res.json(loanRow(loan));
    return;
  }
  values.push(loanId);
  await db.prepare(`UPDATE loans SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(loanRow((await getLoan(loanId))!));
}));

app.delete('/api/loans/:id', requireRole('admin', 'master_admin'), asyncRoute(async (req, res) => {
  const loanId = String(req.params.id);
  const loan = await getLoan(loanId);
  if (!loan) {
    res.status(404).json({ error: 'Loan not found' });
    return;
  }
  if (!canManageLoan(req.authUser!, loan)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  await db.prepare('DELETE FROM loans WHERE id = ?').run(loanId);
  res.json({ success: true });
}));

app.get('/api/repayments', requireAuth, asyncRoute(async (req, res) => {
  const permittedIds = new Set(
    (await accessibleLoanRows(req.authUser!)).map((row) => String((row as Record<string, unknown>).id)),
  );
  const requested = String(req.query.loanIds || '')
    .split(',')
    .filter(Boolean)
    .filter((id) => permittedIds.has(id));
  const ids = requested.length ? requested : [...permittedIds];
  if (!ids.length) {
    res.json([]);
    return;
  }
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.prepare(
    `SELECT * FROM repayments WHERE loan_id IN (${placeholders}) ORDER BY due_date DESC`,
  ).all(...ids);
  res.json(rows.map((row) => repaymentRow(row as Record<string, unknown>)));
}));

app.post('/api/repayments', requireRole('admin', 'master_admin'), asyncRoute(async (req, res) => {
  const loan = await getLoan(String(req.body.loan_id));
  if (!loan || !canManageLoan(req.authUser!, loan)) {
    res.status(404).json({ error: 'Loan not found' });
    return;
  }
  const id = newId();
  await db.prepare(`
    INSERT INTO repayments (id, loan_id, due_date, amount_cents, paid, paid_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    loan.id,
    req.body.due_date,
    cents(req.body.amount),
    req.body.paid === false ? 0 : 1,
    req.body.paid_at || now(),
    now(),
  );
  const row = await db.prepare('SELECT * FROM repayments WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(repaymentRow(row));
}));

app.delete('/api/repayments/:id', requireRole('admin', 'master_admin'), asyncRoute(async (req, res) => {
  const row = await db.prepare(`
    SELECT r.*, l.lender_user_id FROM repayments r
    JOIN loans l ON l.id = r.loan_id WHERE r.id = ?
  `).get(req.params.id) as Record<string, unknown> | undefined;
  if (!row || (req.authUser!.role !== 'master_admin' && row.lender_user_id !== req.authUser!.id)) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }
  await db.prepare('DELETE FROM repayments WHERE id = ?').run(String(req.params.id));
  res.json({ success: true });
}));

app.get('/api/users', requireRole('admin', 'master_admin'), asyncRoute(async (_req, res) => {
  const rows = await db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as Record<string, unknown>[];
  res.json(rows.map(publicUser).map((user) => ({
    ...user,
    created_at: (rows.find((row) => row.id === user.id)?.created_at),
  })));
}));

app.delete('/api/users/:id', requireRole('master_admin'), asyncRoute(async (req, res) => {
  if (req.params.id === req.authUser!.id) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }
  const userId = String(req.params.id);
  const user = await db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  await db.batch([
    {
      sql: `DELETE FROM loans WHERE borrower_user_id = ? OR lender_user_id = ? OR lower(borrower_email) = lower(?)`,
      args: [userId, userId, user.email],
    },
    { sql: 'DELETE FROM users WHERE id = ?', args: [userId] },
  ]);
  res.json({ success: true });
}));

app.post('/api/users/:id/resend-invite', requireRole('admin', 'master_admin'), asyncRoute(async (req, res) => {
  const borrower = await db.prepare('SELECT * FROM users WHERE id = ?').get(String(req.params.id)) as
    | Record<string, unknown>
    | undefined;
  if (!borrower) {
    res.status(404).json({ error: 'Borrower not found' });
    return;
  }
  const signupUrl = `${appUrl}/signup?email=${encodeURIComponent(String(borrower.email))}`;
  const result = await sendEmail({
    type: 'loan_invitation',
    to: String(borrower.email),
    name: String(borrower.full_name),
    subject: 'You have been invited to FFLTracker',
    html: `<p>Hello ${borrower.full_name},</p><p>You have loans available to view.</p><p><a href="${signupUrl}">Create your account</a></p>`,
  });
  res.json(result);
}));

app.get('/api/email-logs', requireRole('admin', 'master_admin'), asyncRoute(async (_req, res) => {
  res.json(await db.prepare('SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 200').all());
}));

app.post('/api/feedback', requireAuth, asyncRoute(async (req, res) => {
  const id = newId();
  const createdAt = now();
  await db.prepare(`
    INSERT INTO feedback (id, user_id, user_email, user_name, message, type, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'new', ?)
  `).run(
    id,
    req.authUser!.id,
    req.authUser!.email,
    req.authUser!.full_name,
    String(req.body.message || '').trim(),
    req.body.type,
    createdAt,
  );
  if (process.env.FEEDBACK_EMAIL) {
    await sendEmail({
      type: 'feedback',
      to: process.env.FEEDBACK_EMAIL,
      name: 'FFLTracker Admin',
      subject: `FFLTracker ${req.body.type === 'problem_report' ? 'problem report' : 'feature request'}`,
      html: `<p>From ${req.authUser!.full_name} (${req.authUser!.email})</p><p>${String(req.body.message || '')}</p>`,
    });
  }
  res.status(201).json({ id, created_at: createdAt });
}));

app.post('/api/emails/invite', requireRole('admin', 'master_admin'), asyncRoute(async (req, res) => {
  const signupUrl = `${appUrl}/signup?email=${encodeURIComponent(normalizeEmail(req.body.borrowerEmail))}`;
  const result = await sendEmail({
    type: 'loan_invitation',
    to: normalizeEmail(req.body.borrowerEmail),
    name: String(req.body.borrowerName || ''),
    subject: 'A loan has been added for you',
    html: `<p>Hello ${req.body.borrowerName},</p><p>${req.authUser!.full_name} added a loan for you.</p><p><a href="${signupUrl}">View your account</a></p>`,
  });
  res.json(result);
}));

app.post('/api/emails/status', requireRole('admin', 'master_admin'), asyncRoute(async (req, res) => {
  const result = await sendEmail({
    type: 'status_notification',
    to: normalizeEmail(req.body.borrowerEmail),
    name: String(req.body.borrowerName || ''),
    subject: `Loan ${String(req.body.status || 'status').replace('_', ' ')}`,
    html: `<p>Hello ${req.body.borrowerName},</p><p>Your loan status is now <strong>${req.body.status}</strong>.</p>`,
    loanId: req.body.loanId || null,
  });
  res.json(result);
}));

app.post('/api/jobs/monthly-statements', asyncRoute(async (req, res) => {
  const secret = req.header('x-cron-secret');
  const isAdmin = req.authUser?.role === 'master_admin';
  if (!isAdmin && (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const loans = await db.prepare(`
    SELECT * FROM loans WHERE status IN ('active', 'approved') ORDER BY borrower_email
  `).all() as Record<string, unknown>[];
  const byBorrower = new Map<string, Record<string, unknown>[]>();
  for (const loan of loans) {
    const email = String(loan.borrower_email).toLowerCase();
    byBorrower.set(email, [...(byBorrower.get(email) || []), loan]);
  }
  const statementMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const subject = `Monthly Loan Statement - ${statementMonth}`;
  let sent = 0;
  let skipped = 0;
  for (const [email, borrowerLoans] of byBorrower) {
    const alreadySent = await db.prepare(`
      SELECT id FROM email_logs
      WHERE email_type = 'payment_reminder' AND lower(recipient_email) = lower(?)
        AND subject = ? AND status = 'sent'
      LIMIT 1
    `).get(email, subject);
    if (alreadySent && req.body?.force !== true) {
      skipped += 1;
      continue;
    }
    const totalCents = borrowerLoans.reduce((sum, loan) => sum + Number(loan.amount_cents), 0);
    const borrowerName = String(borrowerLoans[0].borrower_name);
    await sendEmail({
      type: 'payment_reminder',
      to: email,
      name: borrowerName,
      subject,
      html: `<p>Hello ${borrowerName},</p><p>You have ${borrowerLoans.length} active loan${borrowerLoans.length === 1 ? '' : 's'} with $${(totalCents / 100).toFixed(2)} in original principal.</p><p><a href="${appUrl}/login">View your account</a></p>`,
      loanId: null,
    });
    sent += 1;
  }
  res.json({ success: true, processed: sent, skipped });
}));

const distPath = resolve('dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*splat}', (_req, res) => res.sendFile(resolve(distPath, 'index.html')));
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  void _next;
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
});

await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());

export default app;
