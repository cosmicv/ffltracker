import assert from 'node:assert/strict';
import { test } from 'node:test';

test('manual account summaries restrict access, isolate loans, and report delivery failures', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  process.env.TURSO_AUTH_TOKEN = '';
  process.env.RESEND_API_KEY = '';
  const { default: app } = await import('./index.js');
  const { db, client } = await import('./db.js');
  for (const role of ['master_admin', 'admin', 'borrower']) {
    await db.prepare('INSERT INTO users (id,email,full_name,role,created_at) VALUES (?,?,?,?,?)')
      .run(role, `${role}@example.com`, '<Borrower & Family>', role, new Date().toISOString());
    await db.prepare('INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)').run(role, role, '2099-01-01');
  }
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const nativeFetch = globalThis.fetch;
  const call = (role?: string, id = 'borrower') => nativeFetch(`http://127.0.0.1:${address.port}/api/users/${id}/account-summary`, {
    method: 'POST', headers: role ? { Cookie: `ffl_session=${role}` } : {},
  });
  const messages: Array<{ to: string[]; html: string }> = [];
  globalThis.fetch = async (_url, options) => {
    messages.push(JSON.parse(String(options?.body)));
    return new Response(JSON.stringify({ id: 'mock-message' }), { status: 200 });
  };
  try {
    assert.equal((await call()).status, 401);
    assert.equal((await call('borrower')).status, 403);
    assert.equal((await call('admin')).status, 403);
    assert.equal((await call('master_admin', 'missing')).status, 404);
    assert.equal((await call('master_admin')).status, 502); // Missing key must not claim delivery.
    await db.prepare('INSERT INTO email_settings (id,api_key,sender) VALUES (1,?,?)').run('re_test', 'test@example.com');
    assert.equal((await call('master_admin')).status, 200);
    assert.match(messages[0].html, /no loans on your account/);
    for (const [id, email, amount] of [['own', 'borrower@example.com', 10000], ['other', 'admin@example.com', 99900]] as const) {
      await db.prepare(`INSERT INTO loans (id,borrower_name,borrower_email,amount_cents,frequency,status,created_at)
        VALUES (?,?,?,?,'monthly','active',?)`).run(id, id, email, amount, new Date().toISOString());
    }
    for (const [id, amount, paid] of [['paid', 2500, 1], ['due', 7500, 0]] as const) {
      await db.prepare('INSERT INTO repayments (id,loan_id,due_date,amount_cents,paid,created_at) VALUES (?,\'own\',?,?,?,?)')
        .run(id, '2026-11-01', amount, paid, new Date().toISOString());
    }
    assert.equal((await call('master_admin')).status, 200);
    const message = messages[1];
    assert.deepEqual(message.to, ['borrower@example.com']);
    assert.match(message.html, /&lt;Borrower &amp; Family&gt;/);
    for (const value of ['$100.00', '$25.00', '$75.00']) assert(message.html.includes(value));
    assert(!message.html.includes('$999.00'));
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Provider rejected email' }), { status: 403 });
    const failed = await call('master_admin');
    assert.equal(failed.status, 502);
    const failure = await failed.json() as { error: string };
    assert.equal(failure.error, 'Provider rejected email');
    const logs = await db.prepare("SELECT * FROM email_logs WHERE email_type = 'account_summary'").all();
    assert.equal(logs.length, 4);
    assert.equal(logs[3].status, 'failed');
  } finally {
    globalThis.fetch = nativeFetch;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    client.close();
  }
});
