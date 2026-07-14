// POST /api/auth/users/:id/reset-password — admin only.
// Generates a new temp password, forces a change on next login, clears any
// lockout, and destroys that user's existing sessions.

import { requireAdmin, hashPassword, generateTempPassword, destroyAllSessionsForUser, json } from '../../../../../_lib/auth.js';

export async function onRequestPost({ request, env, params }) {
  const db = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding missing' });

  const { response } = await requireAdmin(request, env);
  if (response) return response;

  const id = Number(params.id);
  if (!id) return json(400, { error: 'Invalid id' });

  const existing = await db.prepare(`SELECT id FROM admin_users WHERE id = ?`).bind(id).first();
  if (!existing) return json(404, { error: 'Not found' });

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await db.prepare(
    `UPDATE admin_users
     SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(passwordHash, id).run();

  await destroyAllSessionsForUser(db, id);

  return json(200, { ok: true, temp_password: tempPassword });
}
