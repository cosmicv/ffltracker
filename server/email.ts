import { randomUUID } from 'node:crypto';
import { db } from './db.js';

interface SendEmailInput {
  type: string;
  to: string;
  name?: string;
  subject: string;
  html: string;
  loanId?: string | null;
  idempotencyKey?: string;
}

export async function getEmailSettings() {
  const saved = await db.prepare('SELECT api_key, sender FROM email_settings WHERE id = 1').get();
  return {
    apiKey: String(saved?.api_key || process.env.RESEND_API_KEY || ''),
    sender: String(saved?.sender || process.env.EMAIL_FROM || 'Family & Friends Loan Tracker <noreply@ffltracker.app>'),
  };
}

export async function sendEmail(input: SendEmailInput) {
  const { apiKey, sender } = await getEmailSettings();
  let status = 'sent';
  let providerMessageId: string | null = null;
  let errorMessage: string | null = null;

  if (!apiKey) {
    status = process.env.NODE_ENV === 'production' ? 'failed' : 'skipped';
    errorMessage = 'RESEND_API_KEY is not configured';
  } else {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: sender,
          to: [input.to],
          subject: input.subject,
          html: input.html,
        }),
      });
      const result = await response.json() as { id?: string; message?: string };
      if (!response.ok) throw new Error(result.message || `Resend returned ${response.status}`);
      providerMessageId = result.id || null;
    } catch (error) {
      status = 'failed';
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  await db.prepare(`
    INSERT INTO email_logs (
      id, email_type, recipient_email, recipient_name, loan_id, subject,
      status, provider_message_id, error_message, sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.type,
    input.to.toLowerCase(),
    input.name || '',
    input.loanId || null,
    input.subject,
    status,
    providerMessageId,
    errorMessage,
    new Date().toISOString(),
  );

  return { success: status === 'sent' || status === 'skipped', status, error: errorMessage };
}
