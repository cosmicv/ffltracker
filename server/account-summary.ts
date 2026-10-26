import { db } from './db.js';
import { sendEmail } from './email.js';

const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));
const money = (cents: unknown) => (Number(cents) / 100).toLocaleString('en-US', {
  style: 'currency', currency: 'USD',
});

export async function sendAccountSummary(user: Record<string, unknown>, appUrl: string, month?: string) {
  const loans = await db.prepare(`
    SELECT l.*, COALESCE(SUM(CASE WHEN r.paid = 1 THEN r.amount_cents ELSE 0 END), 0) AS paid_cents,
      COALESCE(SUM(CASE WHEN r.paid = 0 THEN r.amount_cents ELSE 0 END), 0) AS unpaid_cents
    FROM loans l LEFT JOIN repayments r ON r.loan_id = l.id
    WHERE l.borrower_user_id = ? OR lower(l.borrower_email) = lower(?)
    GROUP BY l.id ORDER BY l.created_at DESC, l.id
  `).all(user.id, user.email);
  const rows = loans.map(loan => `<tr><td>${escapeHtml(loan.status)}</td><td>${money(loan.amount_cents)}</td><td>${money(loan.paid_cents)}</td><td>${money(loan.unpaid_cents)}</td></tr>`).join('');
  const total = (field: string) => loans.reduce((sum, loan) => sum + Number(loan[field]), 0);
  const accountPath = user.registered ? '/login' : `/signup?email=${encodeURIComponent(String(user.email))}`;
  const result = await sendEmail({
    type: month ? 'monthly_account_summary' : 'account_summary',
    to: String(user.email),
    name: String(user.full_name),
    subject: month ? `Your FFLTracker Account Summary - ${month}` : 'Your FFLTracker Account Summary',
    idempotencyKey: month ? `monthly-summary/${month}/${user.id}` : undefined,
    html: `<h1>Account Summary</h1><p>Hello ${escapeHtml(user.full_name)},</p>
      ${loans.length ? `<p>You have ${loans.length} loan${loans.length === 1 ? '' : 's'} on your account.</p>
      <table border="1" cellpadding="8" cellspacing="0"><thead><tr><th>Status</th><th>Original loan amount</th><th>Recorded payments</th><th>Unpaid scheduled payments</th></tr></thead><tbody>${rows}</tbody></table>
      <p>Total original loan amounts: ${money(total('amount_cents'))}<br>Recorded payments: ${money(total('paid_cents'))}<br>Unpaid scheduled payments: ${money(total('unpaid_cents'))}</p>
      <p>Unpaid scheduled payments reflect the payment schedules currently recorded in FFLTracker. Loans without a schedule contribute $0 to that total.</p>` : '<p>There are currently no loans on your account.</p>'}
      <p><a href="${escapeHtml(appUrl + accountPath)}">View your account</a></p>`,
  });
  // Development mode can skip delivery; a manual send must only claim success when sent.
  return { ...result, success: result.status === 'sent' };
}
