// GET/PUT/DELETE /api/auth/users/:id — admin only.
//
// Self-lockout guards: you can't change your own role/disabled or delete
// yourself, and you can't take the last remaining enabled Admin below one
// (via role change, disable, or delete). Password changes go through
// /api/auth/change-password (requires current password), not this route.

import { requireAdmin, destroyAllSessionsForUser, json } from '../../../../_lib/auth.js';

async function remainingAdminCount(db, excludeId) {
  const row = await db.prepare(
    `SELECT COUNT(*) AS c FROM admin_users WHERE role = 'admin' AND disabled = 0 AND id != ?`
  ).bind(excludeId).first();
  return row?.c || 0;
}

export async function onRequest({ request, env, params }) {
  const db = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding missing' });

  const { user: actor, response } = await requireAdmin(request, env);
  if (response) return response;

  const id = Number(params.id);
  if (!id) return json(400, { error: 'Invalid id' });

  if (request.method === 'GET') {
    const row = await db.prepare(
      `SELECT id, name, email, role, disabled, must_change_password, created_at, updated_at, last_login_at FROM admin_users WHERE id = ?`
    ).bind(id).first();
    if (!row) return json(404, { error: 'Not found' });
    return json(200, row);
  }

  if (request.method === 'PUT') {
    const existing = await db.prepare(`SELECT id, role, disabled FROM admin_users WHERE id = ?`).bind(id).first();
    if (!existing) return json(404, { error: 'Not found' });

    const body = await request.json().catch(() => null);
    if (!body) return json(400, { error: 'Invalid JSON' });

    const isSelf = id === actor.id;
    const nextRole = body.role !== undefined ? body.role : existing.role;
    const nextDisabled = body.disabled !== undefined ? (body.disabled ? 1 : 0) : existing.disabled;

    if (body.role !== undefined && !['admin', 'editor'].includes(body.role)) {
      return json(422, { errors: { role: 'Role must be admin or editor' } });
    }

    const changingRole = body.role !== undefined && nextRole !== existing.role;
    const changingDisabled = body.disabled !== undefined && nextDisabled !== existing.disabled;

    if (isSelf && (changingRole || changingDisabled)) {
      return json(403, { error: 'You cannot change your own role or disabled status' });
    }

    // Would this change drop the enabled-Admin count to zero?
    const losingAdminStatus = existing.role === 'admin' && existing.disabled === 0 &&
      (nextRole !== 'admin' || nextDisabled === 1);
    if (losingAdminStatus) {
      const remaining = await remainingAdminCount(db, id);
      if (remaining < 1) return json(409, { error: 'Cannot remove the last remaining Admin' });
    }

    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;

    const fields = [];
    const vals = [];
    if (name !== undefined) { fields.push('name = ?'); vals.push(name); }
    if (email !== undefined) { fields.push('email = ?'); vals.push(email); }
    if (body.role !== undefined) { fields.push('role = ?'); vals.push(nextRole); }
    if (body.disabled !== undefined) { fields.push('disabled = ?'); vals.push(nextDisabled); }
    fields.push(`updated_at = datetime('now')`);

    if (!fields.length) return json(400, { error: 'No fields to update' });

    try {
      await db.prepare(`UPDATE admin_users SET ${fields.join(', ')} WHERE id = ?`).bind(...vals, id).run();
    } catch (e) {
      if (e?.message?.includes('UNIQUE')) return json(409, { error: 'A user with that email already exists' });
      throw e;
    }

    if (changingDisabled && nextDisabled === 1) await destroyAllSessionsForUser(db, id);

    return json(200, { ok: true });
  }

  if (request.method === 'DELETE') {
    if (id === actor.id) return json(403, { error: 'You cannot delete your own account' });

    const existing = await db.prepare(`SELECT id, role, disabled FROM admin_users WHERE id = ?`).bind(id).first();
    if (!existing) return json(404, { error: 'Not found' });

    if (existing.role === 'admin' && existing.disabled === 0) {
      const remaining = await remainingAdminCount(db, id);
      if (remaining < 1) return json(409, { error: 'Cannot delete the last remaining Admin' });
    }

    await db.batch([
      db.prepare(`DELETE FROM admin_sessions WHERE user_id = ?`).bind(id),
      db.prepare(`DELETE FROM admin_users WHERE id = ?`).bind(id),
    ]);
    return json(200, { ok: true });
  }

  return json(405, { error: 'method not allowed' });
}
