// Collection handler for /admin/api/news
// Handles GET (list) and POST (create) operations

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

async function listNews(db: D1Database, search: string, status: string, category: string, tag: string, offset: number, limit: number) {
  let where = '1=1';
  const params: any[] = [];
  if (search) {
    where += ' AND (title LIKE ? OR content_html LIKE ? OR author LIKE ?)';
    const s = `%${search}%`; params.push(s, s, s);
  }
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (category) { where += ' AND category = ?'; params.push(category); }
  if (tag) { where += " AND json_extract(tags, '$') LIKE ?"; params.push('%' + tag + '%'); }

  const totalRow = await db.prepare(`SELECT COUNT(*) AS c FROM news WHERE ${where}`).bind(...params).first();
  const total = (totalRow && (totalRow as any).c) || 0;

  const rows = await db.prepare(`SELECT * FROM news WHERE ${where} ORDER BY publish_date DESC LIMIT ? OFFSET ?`).bind(...params, limit, offset).all();
  const items = rows.results || [];
  items.forEach((it: any) => { if (typeof it.tags === 'string') { try { it.tags = JSON.parse(it.tags); } catch { it.tags = []; } } });
  return { items, total };
}

async function createOne(db: D1Database, body: any, actor: string) {
  const etag = crypto.randomUUID();
  const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : null;
  const safeHtml = sanitizeHtml(body.content_html);
  const stmt = db.prepare(`INSERT INTO news (slug, title, category, content_html, author, publish_date, status, featured_image, tags, created_by, updated_by, etag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(body.slug, body.title, body.category || null, safeHtml, body.author, body.publish_date, body.status, body.featured_image || null, tags, actor, actor, etag);
  const res = await stmt.run();
  return { id: res.meta.last_row_id, etag };
}

export async function onRequest(context: any) {
  const { request, env } = context;
  const db: D1Database = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding UPDATES_DB missing' });

  const claims = await getAccessClaims(request, env);
  if (!requireAccess(claims)) return json(401, { error: 'unauthorized' });
  const actor = claims?.email || 'unknown';

  const url = new URL(request.url);

  // GET /admin/api/news - List news
  if (request.method === 'GET') {
    const { search = '', status = '', category = '', tag = '' } = Object.fromEntries(url.searchParams.entries());
    const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 100);
    const data = await listNews(db, search, status, category, tag, offset, limit);
    return json(200, data);
  }

  // POST /admin/api/news - Create news
  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const errors = validatePayload(body);
    if (Object.keys(errors).length) return json(422, { errors });
    const created = await createOne(db, body, actor);
    return json(201, created, { ETag: created.etag });
  }

  return json(405, { error: 'method not allowed' });
}
