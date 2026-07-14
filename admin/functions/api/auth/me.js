// GET /api/auth/me — { user } or 401. Called at bootstrap on every admin page.

import { requireAuth, json } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const { user, response } = await requireAuth(request, env);
  if (response) return response;
  return json(200, { user });
}
