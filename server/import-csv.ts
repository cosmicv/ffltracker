import { parse } from 'csv-parse/sync';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hashPassword } from './auth.js';
import { db } from './db.js';

const exportDirectory = resolve(process.argv[2] || '../Exports/6-19-26');
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

function readCsv(name: string) {
  const path = resolve(exportDirectory, name);
  if (!existsSync(path)) return [] as Record<string, string>[];
  return parse(readFileSync(path, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as Record<string, string>[];
}

const profiles = readCsv('profiles_rows.csv');
const loans = readCsv('loans_rows.csv');
const repayments = readCsv('repayments_rows.csv');
const feedback = readCsv('feedback_rows.csv');
const emailLogs = readCsv('email_logs_rows.csv');

if (!profiles.length) throw new Error('profiles_rows.csv does not contain any profiles');
if (!loans.length) throw new Error('loans_rows.csv does not contain any loans');

const passwordHashes = new Map<string, string | null>();
for (const profile of profiles) {
  passwordHashes.set(
    profile.id,
    adminPassword && profile.role === 'master_admin' ? await hashPassword(adminPassword) : null,
  );
}

for (const profile of profiles) {
    await db.prepare(`
      INSERT INTO users (id, email, full_name, role, registered, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        registered = excluded.registered,
        password_hash = COALESCE(excluded.password_hash, users.password_hash)
    `).run(
      profile.id,
      profile.email.trim().toLowerCase(),
      profile.full_name,
      profile.role,
      profile.registered === 'true' ? 1 : 0,
      passwordHashes.get(profile.id),
      profile.created_at,
    );
}

const pendingByEmail = new Map<string, string>();
for (const loan of loans) {
    const email = loan.borrower_email.trim().toLowerCase();
    let borrowerId = loan.borrower_id || pendingByEmail.get(email);
    if (!borrowerId) {
      const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
      borrowerId = existing?.id || crypto.randomUUID();
      pendingByEmail.set(email, borrowerId);
      await db.prepare(`
        INSERT OR IGNORE INTO users (id, email, full_name, role, registered, created_at)
        VALUES (?, ?, ?, 'borrower', 0, ?)
      `).run(borrowerId, email, loan.borrower_name, loan.created_at);
    }
    await db.prepare(`
      INSERT INTO loans (
        id, borrower_user_id, lender_user_id, borrower_name, borrower_email,
        amount_cents, interest_rate, frequency, status, approved_at, start_date, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(
      loan.id,
      borrowerId,
      loan.lender_id || null,
      loan.borrower_name,
      email,
      Math.round(Number(loan.amount) * 100),
      Number(loan.interest_rate || 0),
      loan.frequency,
      loan.status,
      loan.approved_at || null,
      loan.start_date || null,
      loan.notes || '',
      loan.created_at,
    );
}

for (const repayment of repayments) {
    await db.prepare(`
      INSERT OR IGNORE INTO repayments
      (id, loan_id, due_date, amount_cents, paid, paid_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      repayment.id,
      repayment.loan_id,
      repayment.due_date,
      Math.round(Number(repayment.amount) * 100),
      repayment.paid === 'true' ? 1 : 0,
      repayment.paid_at || null,
      repayment.created_at,
    );
}

for (const item of feedback) {
    await db.prepare(`
      INSERT OR IGNORE INTO feedback
      (id, user_id, user_email, user_name, message, type, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id, item.user_id, item.user_email, item.user_name, item.message,
      item.type, item.status, item.created_at,
    );
}

for (const log of emailLogs) {
    await db.prepare(`
      INSERT OR IGNORE INTO email_logs
      (id, email_type, recipient_email, recipient_name, loan_id, subject, status,
       provider_message_id, error_message, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      log.id, log.email_type, log.recipient_email, log.recipient_name,
      log.loan_id || null, log.subject, log.status, log.provider_message_id || null,
      log.error_message || null, log.sent_at,
    );
}

const report = await db.prepare(`
  SELECT
    (SELECT count(*) FROM users) AS users,
    (SELECT count(*) FROM users WHERE registered = 0) AS pending_borrowers,
    (SELECT count(*) FROM loans) AS loans,
    (SELECT coalesce(sum(amount_cents), 0) FROM loans) AS loan_cents,
    (SELECT count(*) FROM repayments) AS repayments,
    (SELECT count(*) FROM email_logs) AS email_logs
`).get() as Record<string, number>;

console.log(JSON.stringify({
  ...report,
  loan_total: `$${(report.loan_cents / 100).toFixed(2)}`,
  admin_password_set: Boolean(adminPassword),
}, null, 2));
