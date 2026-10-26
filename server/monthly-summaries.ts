import { setTimeout } from 'node:timers/promises';
import { db } from './db.js';
import { sendAccountSummary } from './account-summary.js';

export async function sendMonthlySummaries(appUrl: string, dryRun = false) {
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  const period = `${month.find(part => part.type === 'year')!.value}-${month.find(part => part.type === 'month')!.value}`;
  const users = await db.prepare('SELECT * FROM users ORDER BY id').all();
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let pending = 0;
  for (const user of users) {
    if (dryRun) {
      const delivery = await db.prepare('SELECT status FROM monthly_summary_deliveries WHERE month = ? AND user_id = ?').get(period, user.id);
      if (delivery?.status === 'sent') skipped++;
      else pending++;
      continue;
    }
    const claim = await db.prepare(`
      INSERT INTO monthly_summary_deliveries (month, user_id, status, claimed_at) VALUES (?, ?, 'processing', ?)
      ON CONFLICT(month, user_id) DO UPDATE SET status = 'processing', claimed_at = excluded.claimed_at
      WHERE monthly_summary_deliveries.status = 'failed'
        OR (monthly_summary_deliveries.status = 'processing' AND monthly_summary_deliveries.claimed_at < ?)
    `).run(period, user.id, new Date().toISOString(), new Date(Date.now() - 10 * 60_000).toISOString());
    if (!claim.rowsAffected) {
      skipped++;
      continue;
    }
    let delivered = false;
    try {
      delivered = (await sendAccountSummary(user, appUrl, period)).success;
    } catch (error) {
      console.error('Monthly account summary failed for user', user.id, error);
    }
    await db.prepare('UPDATE monthly_summary_deliveries SET status = ? WHERE month = ? AND user_id = ?')
      .run(delivered ? 'sent' : 'failed', period, user.id);
    if (delivered) sent++;
    else failed++;
    // Keep sequential requests below Resend's default rate limit.
    await setTimeout(600);
  }
  return { success: failed === 0, month: period, total: users.length, sent, skipped, failed, ...(dryRun ? { dryRun: true, pending } : {}) };
}
