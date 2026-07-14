// POST /api/auth/login — { email, password } → { user } + Set-Cookie
//
// Generic "Invalid email or password" for bad creds / unknown email / disabled
// account (no account enumeration). 429 with a clear message while locked out.

import { verifyPassword, createSession, json, LOCKOUT_THRESHOLD, LOCKOUT_MINUTES } from '../../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const db = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding missing' });

  const body = await request.json().catch(() => null);
  const email = (body?.email || '').trim().toLowerCase();
  const password = body?.password || '';
  if (!email || !password) return json(400, { error: 'Email and password are required' });

  const user = await db.prepare(
    `SELECT id, name, email, password_hash, role, disabled, must_change_password, failed_attempts, locked_until
     FROM admin_users WHERE email = ?`
  ).bind(email).first();

  const INVALID = { error: 'Invalid email or password' };

  if (!user || user.disabled) return json(401, INVALID);

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    return json(429, { error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.` });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    const attempts = (user.failed_attempts || 0) + 1;
    const lockedUntil = attempts >= LOCKOUT_THRESHOLD
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      : null;
    await db.prepare(`UPDATE admin_users SET failed_attempts = ?, locked_until = ? WHERE id = ?`)
      .bind(attempts, lockedUntil, user.id).run();
    return json(401, INVALID);
  }

  await db.prepare(
    `UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?`
  ).bind(user.id).run();

  const { cookie } = await createSession(db, user.id, request);

  return json(200, {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, must_change_password: !!user.must_change_password },
  }, { 'Set-Cookie': cookie });
}
