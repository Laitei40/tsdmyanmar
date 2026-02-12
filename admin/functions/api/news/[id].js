// Unified API: /api/news/:id  (single item)
// GET    → read article  (public: published only | admin: any status)
// PUT    → update article  (admin only, ETag concurrency)
// DELETE → delete article  (admin only, ETag concurrency)
//
// The :id param can be a numeric ID or a slug string.

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding missing' });

  const id = params.id;
  if (!id) return json(400, { error: 'Missing id' });

  const claims = verifyAdmin(request, env);
  const isAdmin = !!claims;
  const actor = claims?.email || 'anonymous';

  // ── CORS ──
  if (request.method === 'OPTIONS') return handleCors();

  // ── GET ──
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const SUPPORTED = ['en', 'mrh', 'my'];
    const reqLang = (url.searchParams.get('lang') || '').toLowerCase();
    const lang = SUPPORTED.includes(reqLang) ? reqLang : null;

    let row = null;

    if (isAdmin) {
      // Admin can see any status; try by ID first, then slug
      row = /^\d+$/.test(id)
        ? await db.prepare('SELECT * FROM news WHERE id = ?').bind(id).first()
        : await db.prepare('SELECT * FROM news WHERE slug = ?').bind(id).first();
    } else {
      // Public: published only
      const cols = 'id, slug, publish_date AS date, title, summary, body, category, featured_image, tags';
      if (/^\d+$/.test(id)) {
        row = await db.prepare(
          `SELECT ${cols} FROM news WHERE id = ? AND status = 'published' LIMIT 1`
        ).bind(id).first();
      } else {
        row = await db.prepare(
          `SELECT ${cols} FROM news WHERE slug = ? AND status = 'published' LIMIT 1`
        ).bind(id).first();
      }
      // Fallback: try numeric ID if slug didn't match
      if (!row && /^\d+$/.test(id) === false) {
        // no fallback for non-numeric slugs
      }
    }

    if (!row) return json(404, { error: 'not found' });

    if (isAdmin) {
      return json(200, rowToAdminItem(row), { ETag: row.etag || '' });
    } else {
      const item = rowToPublicItem(row);
      return json(200, lang ? localize(item, lang) : item, { 'Cache-Control': 'public, max-age=30' });
    }
  }

  // ── PUT: update (admin only) ──
  if (request.method === 'PUT') {
    if (!isAdmin) return json(403, { error: 'Forbidden' });

    const body = await request.json().catch(() => null);
    if (!body) return json(400, { error: 'Invalid JSON' });
    const errs = validate(body);
    if (Object.keys(errs).length) return json(422, { errors: errs });

    const etag = request.headers.get('if-match') || '';
    const existing = await db.prepare('SELECT etag FROM news WHERE id = ?').bind(id).first();
    if (!existing) return json(404, { error: 'not found' });
    if (existing.etag !== etag) return json(409, { error: 'Version conflict — reload and retry' });

    const nextEtag = crypto.randomUUID();
    await db.prepare(
      `UPDATE news SET slug=?,title=?,summary=?,body=?,category=?,author=?,publish_date=?,status=?,featured_image=?,tags=?,updated_at=datetime('now'),updated_by=?,etag=? WHERE id=?`
    ).bind(
      body.slug,
      sanitizeI18n(parseI18n(body.title)),
      sanitizeI18n(parseI18n(body.summary)),
      sanitizeI18n(parseI18n(body.body), true),
      body.category || null,
      body.author, body.publish_date, body.status,
      body.featured_image || null,
      body.tags ? JSON.stringify(body.tags) : null,
      actor, nextEtag, id
    ).run();
    return json(200, { ok: true }, { ETag: nextEtag });
  }

  // ── DELETE (admin only) ──
  if (request.method === 'DELETE') {
    if (!isAdmin) return json(403, { error: 'Forbidden' });

    const etag = request.headers.get('if-match') || '';
    const existing = await db.prepare('SELECT etag FROM news WHERE id = ?').bind(id).first();
    if (!existing) return json(404, { error: 'not found' });
    if (existing.etag !== etag) return json(409, { error: 'Version conflict' });
    await db.prepare('DELETE FROM news WHERE id = ?').bind(id).run();
    return json(200, { ok: true });
  }

  return json(405, { error: 'method not allowed' });
}

/* ══════════════════════════════════════
   Auth — Cloudflare Access (Zero Trust)
   ══════════════════════════════════════ */

/**
 * Verify the request comes from an allowed admin.
 * Cloudflare Access injects `cf-access-authenticated-user-email` on authenticated requests.
 * The allowed admin email is stored in env.ADMIN_EMAIL (set via Cloudflare dashboard).
 * Returns { email } on success, or null for non-admin / public requests.
 */
function verifyAdmin(request, env) {
  const email = request.headers
    .get('cf-access-authenticated-user-email')
    ?.toLowerCase();

  const allowedAdmin = env.ADMIN_EMAIL?.toLowerCase();

  if (!email || !allowedAdmin || email !== allowedAdmin) return null;

  return { email };
}

/* ══════════════════════════════════════
   Helpers
   ══════════════════════════════════════ */

function json(status, data, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'ETag', ...extra },
  });
}

function handleCors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, If-Match',
      'Access-Control-Expose-Headers': 'ETag',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/\son\w+\s*=\s*("[\s\S]*?"|'[^']*?')/gi, '');
  s = s.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '$1="#"');
  return s;
}

function isoDateValid(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

function parseI18n(val) {
  if (!val) return {};
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); return typeof p === 'object' && p !== null ? p : { en: val }; }
    catch { return { en: val }; }
  }
  return typeof val === 'object' && val !== null ? val : {};
}

function sanitizeI18n(obj, html = false) {
  const o = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.trim()) o[k] = html ? sanitizeHtml(v) : v.trim();
  }
  return JSON.stringify(o);
}

function validate(body) {
  const err = {};
  const t = parseI18n(body.title);
  const hasTitle = Object.values(t).some(v => typeof v === 'string' && v.trim());
  if (!hasTitle) err.title = 'Title required in at least one language';
  const titleLen = Object.values(t).filter(v => typeof v === 'string').some(v => v.length > 200);
  if (titleLen) err.title = 'Title must be ≤200 chars';
  if (!body.slug || !/^[-a-z0-9]+$/.test(body.slug)) err.slug = 'Slug: lowercase, numbers, hyphens';
  if (!body.author) err.author = 'Author required';
  if (!body.publish_date || !isoDateValid(body.publish_date)) err.publish_date = 'Date: YYYY-MM-DD';
  if (!['draft', 'published', 'archived'].includes(body.status)) err.status = 'Invalid status';
  const b = parseI18n(body.body);
  const hasBody = Object.values(b).some(v => typeof v === 'string' && v.trim());
  if (!hasBody) err.body = 'Content required in at least one language';
  return err;
}

/* ── Row mappers ── */

function rowToAdminItem(r) {
  const it = { ...r };
  for (const f of ['title', 'summary', 'body']) it[f] = parseI18n(it[f]);
  if (typeof it.tags === 'string') {
    try { it.tags = JSON.parse(it.tags); } catch { it.tags = []; }
  }
  return it;
}

function rowToPublicItem(r) {
  const it = {
    id: r.id,
    slug: r.slug,
    date: r.date || r.publish_date,
    category: r.category || undefined,
    image: r.featured_image || undefined,
  };
  it.title = parseI18n(r.title);
  it.summary = parseI18n(r.summary);
  it.body = parseI18n(r.body);
  if (typeof r.tags === 'string') {
    try { it.tags = JSON.parse(r.tags); } catch { it.tags = []; }
  }
  ['title', 'summary', 'body'].forEach(f => {
    const obj = it[f];
    if (!obj || typeof obj !== 'object') return;
    if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
    Object.keys(obj).forEach(k => {
      const m = k.match(/^([a-z]{2,3})[-_]/i);
      if (m) { const b = m[1].toLowerCase(); if (!obj[b]) obj[b] = obj[k]; }
    });
  });
  return it;
}

function localize(item, lang) {
  const loc = { ...item };
  for (const f of ['title', 'summary', 'body']) {
    if (loc[f] && typeof loc[f] === 'object') {
      loc[f] = loc[f][lang] || loc[f].en || Object.values(loc[f])[0] || '';
    }
  }
  return loc;
}
