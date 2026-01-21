// Dynamic route handler for /admin/api/news/:id
// Handles GET (single item), PUT (update), DELETE operations

function sanitizeHtml(html: string): string {
  if (!html) return '';
  let safe = html.replace(/<!--([\s\S]*?)-->/g, '');
  safe = safe.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  safe = safe.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  safe = safe.replace(/\son\w+\s*=\s*"[\s\S]*?"/gi, '');
  safe = safe.replace(/\son\w+\s*=\s*'[^']*?'/gi, '');
  safe = safe.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '$1="#"');
  return safe;
}

function isoDateValid(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function validatePayload(body: any) {
  const errors: Record<string, string> = {};
  if (!body.title || body.title.length > 200) errors.title = 'Title required, <=200 chars';
  if (!body.slug || !/^[-a-z0-9]+$/.test(body.slug)) errors.slug = 'Slug required, lowercase letters/numbers/hyphens only';
  if (!body.author) errors.author = 'Author required';
  if (!body.publish_date || !isoDateValid(body.publish_date)) errors.publish_date = 'Publish date must be ISO (YYYY-MM-DD)';
  if (!body.status || !['draft', 'published', 'archived'].includes(body.status)) errors.status = 'Invalid status';
  if (!body.content_html) errors.content_html = 'Content required';
  if (body.content_html && body.content_html.length > 200000) errors.content_html = 'Content too long';
  if (body.tags && !Array.isArray(body.tags)) errors.tags = 'Tags must be array of strings';
  if (Array.isArray(body.tags) && body.tags.some((t: string) => typeof t !== 'string')) errors.tags = 'Tags must be strings';
  return errors;
}

async function getAccessClaims(request: Request, env: any) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion') ||
    request.headers.get('CF_Authorization') ||
    (request.headers.get('cookie') || '').match(/CF_Authorization=([^;]+)/)?.[1];
  if (!token) {
    if (env && env.ADMIN_BYPASS_ACCESS === '1') {
      return { email: 'dev@localhost' };
    }
    return null;
  }
  return { email: request.headers.get('cf-access-verified-email') || 'unknown' };
}

function json(status: number, data: any, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

function requireAccess(claims: any) {
  return claims && claims.email;
}

async function getOne(db: D1Database, id: string) {
  const row = await db.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
  if (!row) return null;
  if (typeof (row as any).tags === 'string') {
    try { (row as any).tags = JSON.parse((row as any).tags); } catch { (row as any).tags = []; }
  }
  return row as any;
}

async function updateOne(db: D1Database, id: string, body: any, actor: string, etag: string) {
  const existing = await getOne(db, id);
  if (!existing) return { status: 404 };
  if (existing.etag !== etag) return { status: 409 };

  const nextEtag = crypto.randomUUID();
  const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : null;
  const safeHtml = sanitizeHtml(body.content_html);
  await db.prepare(`UPDATE news SET slug=?, title=?, category=?, content_html=?, author=?, publish_date=?, status=?, featured_image=?, tags=?, updated_at=datetime('now'), updated_by=?, etag=? WHERE id=?`)
    .bind(body.slug, body.title, body.category || null, safeHtml, body.author, body.publish_date, body.status, body.featured_image || null, tags, actor, nextEtag, id)
    .run();
  return { status: 200, etag: nextEtag };
}

async function deleteOne(db: D1Database, id: string, etag: string) {
  const existing = await getOne(db, id);
  if (!existing) return { status: 404 };
  if (existing.etag !== etag) return { status: 409 };
  await db.prepare('DELETE FROM news WHERE id = ?').bind(id).run();
  return { status: 200 };
}

export async function onRequest(context: any) {
  const { request, env, params } = context;
  const db: D1Database = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding UPDATES_DB missing' });

  const id = params.id;
  if (!id) return json(400, { error: 'Missing id parameter' });

  const claims = await getAccessClaims(request, env);
  if (!requireAccess(claims)) return json(401, { error: 'unauthorized' });
  const actor = claims?.email || 'unknown';

  // GET /admin/api/news/:id - Get single item
  if (request.method === 'GET') {
    const row = await getOne(db, id);
    if (!row) return json(404, { error: 'not found' });
    return json(200, row, { ETag: row.etag });
  }

  // PUT /admin/api/news/:id - Update item
  if (request.method === 'PUT') {
    const body = await request.json().catch(() => null);
    const errors = validatePayload(body);
    if (Object.keys(errors).length) return json(422, { errors });
    const etag = request.headers.get('if-match') || '';
    const res = await updateOne(db, id, body, actor, etag);
    if (res.status === 404) return json(404, { error: 'not found' });
    if (res.status === 409) return json(409, { error: 'etag mismatch' });
    return json(200, { ok: true }, { ETag: res.etag || '' });
  }

  // DELETE /admin/api/news/:id - Delete item
  if (request.method === 'DELETE') {
    const etag = request.headers.get('if-match') || '';
    const res = await deleteOne(db, id, etag);
    if (res.status === 404) return json(404, { error: 'not found' });
    if (res.status === 409) return json(409, { error: 'etag mismatch' });
    return json(200, { ok: true });
  }

  return json(405, { error: 'method not allowed' });
}
