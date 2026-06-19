import { createClient, type InStatement, type ResultSet } from '@libsql/client';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: ['.env.development.local', '.env.local', '.env'] });

const databaseUrl = process.env.TURSO_DATABASE_URL || `file:${resolve(process.env.DATABASE_PATH || 'data/ffltracker.sqlite')}`;

export const client = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function normalizeRows(result: ResultSet) {
  return result.rows.map((row) => ({ ...row }) as Record<string, unknown>);
}

class Statement {
  constructor(private readonly sql: string) {}

  async all(...args: unknown[]) {
    const result = await client.execute({ sql: this.sql, args: args as never[] });
    return normalizeRows(result);
  }

  async get(...args: unknown[]) {
    const rows = await this.all(...args);
    return rows[0];
  }

  async run(...args: unknown[]) {
    return client.execute({ sql: this.sql, args: args as never[] });
  }
}

export const db = {
  prepare(sql: string) {
    return new Statement(sql);
  },
  exec(sql: string) {
    return client.executeMultiple(sql);
  },
  batch(statements: InStatement[]) {
    return client.batch(statements, 'write');
  },
};

await db.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('borrower', 'admin', 'master_admin')),
  registered INTEGER NOT NULL DEFAULT 1 CHECK (registered IN (0, 1)),
  password_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  borrower_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  lender_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  borrower_name TEXT NOT NULL,
  borrower_email TEXT NOT NULL COLLATE NOCASE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  interest_rate REAL NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'active', 'completed', 'rejected')),
  approved_at TEXT,
  start_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repayments (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  due_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  paid INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1)),
  paid_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('feature_request', 'problem_report')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT '',
  loan_id TEXT REFERENCES loans(id) ON DELETE SET NULL,
  subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loans_borrower_email ON loans(borrower_email);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_user ON loans(borrower_user_id);
CREATE INDEX IF NOT EXISTS idx_loans_lender_user ON loans(lender_user_id);
CREATE INDEX IF NOT EXISTS idx_repayments_loan ON repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

export type UserRole = 'borrower' | 'admin' | 'master_admin';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  registered: boolean;
}

export function publicUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    email: String(row.email),
    full_name: String(row.full_name),
    role: row.role as UserRole,
    registered: Boolean(row.registered),
  };
}

export function loanRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    borrower_id: row.borrower_user_id,
    lender_id: row.lender_user_id,
    borrower_name: row.borrower_name,
    borrower_email: row.borrower_email,
    amount: Number(row.amount_cents) / 100,
    interest_rate: Number(row.interest_rate),
    frequency: row.frequency,
    status: row.status,
    approved_at: row.approved_at,
    start_date: row.start_date,
    notes: row.notes,
    created_at: row.created_at,
  };
}

export function repaymentRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    loan_id: row.loan_id,
    due_date: row.due_date,
    amount: Number(row.amount_cents) / 100,
    paid: Boolean(row.paid),
    paid_at: row.paid_at,
    created_at: row.created_at,
  };
}
