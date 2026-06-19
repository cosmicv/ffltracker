import { hashPassword } from './auth.js';
import { db } from './db.js';

const email = String(process.argv[2] || '').trim().toLowerCase();
const password = process.env.NEW_PASSWORD;

if (!email || !password || password.length < 8) {
  throw new Error('Usage: set NEW_PASSWORD, then run npm run db:set-password -- user@example.com');
}

const result = db.prepare(`
  UPDATE users SET password_hash = ?, registered = 1, updated_at = ?
  WHERE email = ?
`).run(await hashPassword(password), new Date().toISOString(), email);

if (!result.changes) throw new Error(`No user found for ${email}`);
db.prepare('DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)').run(email);
console.log(`Password updated for ${email}`);
