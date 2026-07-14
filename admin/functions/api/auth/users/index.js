// GET  /api/auth/users — list all accounts (admin only)
// POST /api/auth/users — create an account (admin only)
//   body { name, email, role } — no password field; server generates a temp
//   password and returns it once. 409 on duplicate email.

import { requireAdmin, hashPassword, generateTempPassword, json } from '../../../../_lib/auth.js';

export async function onRequest({ request, env }) {
  const db = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding missing' });

  const { response } = await requireAdmin(request, env);
  if (response) return response;

  if (request.method === 'GET') {
    const rows = await db.prepare(
      `SELECT id, name, email, role, disabled, must_change_password, created_at, last_login_at
       FROM admin_users ORDER BY created_at ASC`
    ).all();
    return json(200, { items: rows.results || [] });
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const name = (body?.name || '').trim();
    const email = (body?.email || '').trim().toLowerCase();
    const role = body?.role;

    const errs = {};
    if (!name) errs.name = 'Name is required';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Valid email is required';
    if (!['admin', 'editor'].includes(role)) errs.role = 'Role must be admin or editor';
    if (Object.keys(errs).length) return json(422, { errors: errs });

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    try {
      const res = await db.prepare(
        `INSERT INTO admin_users (name, email, password_hash, role, must_change_password) VALUES (?,?,?,?,1)`
      ).bind(name, email, passwordHash, role).run();
      return json(201, { id: res.meta.last_row_id, temp_password: tempPassword });
    } catch (e) {
      if (e?.message?.includes('UNIQUE')) return json(409, { error: 'A user with that email already exists' });
      throw e;
    }
  }

  return json(405, { error: 'method not allowed' });
}
