// POST /api/auth/logout — deletes the session row + clears the cookie. Always 200.

import { destroySession, buildLogoutCookie, json } from '../../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const db = env.UPDATES_DB;
  if (db) await destroySession(db, request);
  return json(200, { ok: true }, { 'Set-Cookie': buildLogoutCookie(request) });
}
