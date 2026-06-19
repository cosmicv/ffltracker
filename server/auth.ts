import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db, publicUser, type AuthUser, type UserRole } from './db.js';

const SESSION_COOKIE = 'ffl_session';
const SESSION_DAYS = 14;

export interface AuthRequest extends Request {
  authUser?: AuthUser;
}

export async function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export async function setSession(res: Response, userId: string) {
  const id = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
    id,
    userId,
    expires.toISOString(),
  );
  res.cookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
  });
}

export async function clearSession(req: Request, res: Response) {
  const id = req.cookies?.[SESSION_COOKIE];
  if (id) await db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function clearOtherSessions(req: Request, userId: string) {
  const currentSessionId = req.cookies?.[SESSION_COOKIE];
  if (currentSessionId) {
    await db.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').run(userId, currentSessionId);
    return;
  }
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export async function loadUser(req: AuthRequest, _res: Response, next: NextFunction) {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (sessionId) {
    const row = await db.prepare(`
      SELECT u.* FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?
    `).get(sessionId, new Date().toISOString()) as Record<string, unknown> | undefined;
    if (row) req.authUser = publicUser(row);
  }
  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: 'You do not have permission to perform this action' });
      return;
    }
    next();
  };
}

export async function createResetToken(userId: string) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(userId);
  await db.prepare(
    'INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
  ).run(tokenHash, userId, expires);
  return token;
}

export async function consumeResetToken(token: string) {
  const hash = createHash('sha256').update(token).digest('hex');
  const row = await db.prepare(`
    SELECT * FROM password_reset_tokens
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
  `).get(hash, new Date().toISOString()) as { user_id: string } | undefined;
  if (!row) return null;
  await db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?')
    .run(new Date().toISOString(), hash);
  return row.user_id;
}

export function newId() {
  return randomUUID();
}
