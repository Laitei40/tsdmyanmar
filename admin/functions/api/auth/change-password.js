// POST /api/auth/change-password — { currentPassword, newPassword }
//
// Requires the current password even during a forced (must_change_password)
// change. On success, destroys ALL sessions for the user (including the one
// making this request) and the frontend redirects to login.html to re-auth.

import { requireAuth, verifyPassword, hashPassword, destroyAllSessionsForUser, buildLogoutCookie, json } from '../../../_lib/auth.js';

const MIN_LENGTH = 10;

export async function onRequestPost({ request, env }) {
  const db = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding missing' });

  const { user, response } = await requireAuth(request, env);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const currentPassword = body?.currentPassword || '';
  const newPassword = body?.newPassword || '';

  if (!currentPassword || !newPassword) return json(400, { error: 'Current and new password are required' });
  if (newPassword.length < MIN_LENGTH) return json(400, { error: `New password must be at least ${MIN_LENGTH} characters` });

  const row = await db.prepare(`SELECT password_hash FROM admin_users WHERE id = ?`).bind(user.id).first();
  if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
    return json(401, { error: 'Current password is incorrect' });
  }

  const newHash = await hashPassword(newPassword);
  await db.prepare(
    `UPDATE admin_users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?`
  ).bind(newHash, user.id).run();

  await destroyAllSessionsForUser(db, user.id);

  return json(200, { ok: true, reauth_required: true }, { 'Set-Cookie': buildLogoutCookie(request) });
}
