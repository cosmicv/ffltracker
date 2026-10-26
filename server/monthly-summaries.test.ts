import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

test('monthly cron authenticates, includes every user, supports dry runs and retries only failed sends', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  process.env.TURSO_AUTH_TOKEN = '';
  process.env.RESEND_API_KEY = 're_test';
  process.env.CRON_SECRET = 'test-cron-secret';
  const { default: app } = await import('./index.js');
  const { db, client } = await import('./db.js');
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.crons, [{ path: '/api/jobs/monthly-statements', schedule: '0 14 1 * *' }]);
  for (const [id, role, registered] of [['1', 'master_admin', 1], ['2', 'admin', 1], ['3', 'borrower', 0]] as const) {
    await db.prepare('INSERT INTO users (id,email,full_name,role,registered,created_at) VALUES (?,?,?,?,?,?)')
      .run(id, `${id}@example.com`, id, role, registered, new Date().toISOString());
  }
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const nativeFetch = globalThis.fetch;
  const call = (secret?: string, suffix = '') => nativeFetch(`http://127.0.0.1:${address.port}/api/jobs/monthly-statements${suffix}`, {
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  const recipients: string[] = [];
  let rejectOne = true;
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(String(options?.body));
    recipients.push(payload.to[0]);
    assert.match((options?.headers as Record<string, string>)['Idempotency-Key'], /^monthly-summary\/\d{4}-\d{2}\//);
    assert.match(payload.html, /no loans on your account/);
    const rejected = rejectOne && payload.to[0] === '2@example.com';
    return new Response(JSON.stringify(rejected ? { message: 'Provider unavailable' } : { id: 'mock' }), { status: rejected ? 500 : 200 });
  };
  try {
    assert.equal((await call()).status, 403);
    assert.equal((await call('wrong')).status, 403);
    const preview = await (await call('test-cron-secret', '?dryRun=1')).json() as { total: number; pending: number };
    assert.equal(preview.total, 3);
    assert.equal(preview.pending, 3);
    assert.equal(recipients.length, 0);
    const first = await call('test-cron-secret');
    assert.equal(first.status, 502);
    const firstResult = await first.json() as { sent: number; failed: number };
    assert.equal(firstResult.sent, 2);
    assert.equal(firstResult.failed, 1);
    rejectOne = false;
    const retry = await (await call('test-cron-secret')).json() as { sent: number; skipped: number };
    assert.equal(retry.sent, 1);
    assert.equal(retry.skipped, 2);
    assert.deepEqual(recipients, ['1@example.com', '2@example.com', '3@example.com', '2@example.com']);
    const repeat = await (await call('test-cron-secret')).json() as { sent: number; skipped: number };
    assert.equal(repeat.sent, 0);
    assert.equal(repeat.skipped, 3);
    const logs = await db.prepare("SELECT * FROM email_logs WHERE email_type = 'monthly_account_summary' AND status = 'sent'").all();
    assert.equal(logs.length, 3);
  } finally {
    globalThis.fetch = nativeFetch;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    client.close();
  }
});
