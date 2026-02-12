// Unified API: /api/news  (collection)
// GET  → list articles  (public: published only | admin: all statuses)
// POST → create article  (admin only)
//
// Auth: Cloudflare Access (Zero Trust) — trusts cf-access-authenticated-user-email header.
// Admin identity verified against env.ADMIN_EMAIL (set in Cloudflare dashboard, never hardcoded).
// Both the public site and admin dashboard consume this same endpoint.

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding missing' });

  const claims = verifyAdmin(request, env);
  const isAdmin = !!claims;
  const actor = claims?.email || 'anonymous';

  // ── CORS for admin cross-origin (if admin is on a different subdomain) ──
  if (request.method === 'OPTIONS') return handleCors(request);

  // ── GET: list ──
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const p = Object.fromEntries(url.searchParams);
    const SUPPORTED = ['en', 'mrh', 'my'];
    const reqLang = (p.lang || '').toLowerCase();
    const lang = SUPPORTED.includes(reqLang) ? reqLang : null;

    // Build WHERE clause
    let where = '1=1';
    const vals = [];

    if (isAdmin) {
      // Admin can filter by status; default shows all
      if (p.status) { where += ` AND status = ?`; vals.push(p.status); }
    } else {
      // Public only sees published
      where += ` AND status = 'published'`;
    }

    if (p.category) { where += ' AND category = ?'; vals.push(p.category); }

    // Year filter
    const year = (p.year || '').trim();
    if (year) { where += ' AND substr(publish_date,1,4) = ?'; vals.push(year); }

    // Text search
    const q = (p.q || p.search || '').trim();
    if (q) {
      const like = '%' + q + '%';
      where += ' AND (title LIKE ? OR summary LIKE ? OR body LIKE ? OR author LIKE ?)';
      vals.push(like, like, like, like);
    }

    const limit = Math.min(parseInt(p.limit || (isAdmin ? '20' : '6')) || 6, 100);
    const offset = parseInt(p.offset || '0') || 0;

    try {
      const cntRow = await db.prepare(`SELECT COUNT(*) AS c FROM news WHERE ${where}`).bind(...vals).first();
      const total = cntRow?.c || 0;

      // Admin gets all columns; public gets a subset
      const cols = isAdmin
        ? '*'
        : 'id, slug, publish_date AS date, title, summary, body, category, featured_image, tags';

      const rows = await db.prepare(
        `SELECT ${cols} FROM news WHERE ${where} ORDER BY publish_date DESC LIMIT ? OFFSET ?`
      ).bind(...vals, limit, offset).all();

      const items = (rows.results || []).map(r => {
        const it = isAdmin ? rowToAdminItem(r) : rowToPublicItem(r);
        return (!isAdmin && lang) ? localize(it, lang) : it;
      });

      const headers = isAdmin
        ? {}
        : { 'Cache-Control': 'public, max-age=30' };

      return json(200, { items, total }, headers);
    } catch (e) {
      console.error('GET /api/news error:', e);
      return json(500, { error: 'DB query failed', detail: e?.message || String(e) });
    }
  }

  // ── POST: create (admin only) ──
  if (request.method === 'POST') {
    if (!isAdmin) return json(403, { error: 'Forbidden' });

    const body = await request.json().catch(() => null);
    if (!body) return json(400, { error: 'Invalid JSON' });
    const errs = validate(body);
    if (Object.keys(errs).length) return json(422, { errors: errs });

    const etag = crypto.randomUUID();
    try {
      const res = await db.prepare(
        `INSERT INTO news (slug,title,summary,body,category,content_html,author,publish_date,status,featured_image,tags,created_by,updated_by,etag)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        body.slug,
        sanitizeI18n(parseI18n(body.title)),
        sanitizeI18n(parseI18n(body.summary)),
        sanitizeI18n(parseI18n(body.body), true),
        body.category || null,
        '', // legacy column
        body.author,
        body.publish_date,
        body.status,
        body.featured_image || null,
        body.tags ? JSON.stringify(body.tags) : null,
        actor, actor, etag
      ).run();
      return json(201, { id: res.meta.last_row_id, etag }, { ETag: `"${etag}"` });
    } catch (e) {
      if (e?.message?.includes('UNIQUE')) return json(409, { error: 'Slug already exists' });
      throw e;
    }
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
  // Local dev bypass — Wrangler doesn't inject Cloudflare Access headers.
  // DEV_MODE must NEVER be "true" in production.
  if (env.DEV_MODE === 'true') {
    return { email: env.ADMIN_EMAIL || 'dev@localhost' };
  }

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

function handleCors(req) {
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
  // Only allow YouTube iframes — strip all other iframes
  s = s.replace(/<iframe[\s\S]*?<\/iframe>/gi, (match) => {
    return /src\s*=\s*["']https:\/\/www\.youtube\.com\/embed\//i.test(match) ? match : '';
  });
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
  if (!t.en || t.en.length > 200) err.title = 'English title required (≤200 chars)';
  if (!body.slug || !/^[-a-z0-9]+$/.test(body.slug)) err.slug = 'Slug: lowercase, numbers, hyphens';
  if (!body.author) err.author = 'Author required';
  if (!body.publish_date || !isoDateValid(body.publish_date)) err.publish_date = 'Date: YYYY-MM-DD';
  if (!['draft', 'published', 'archived'].includes(body.status)) err.status = 'Invalid status';
  const b = parseI18n(body.body);
  if (!b.en) err.body = 'English content required';
  if (body.tags && !Array.isArray(body.tags)) err.tags = 'Tags must be array';
  return err;
}

/* ── Row mappers ── */

function rowToAdminItem(r) {
  const it = { ...r };
  // Expose date alias so consumers don't need to know about publish_date
  if (!it.date && it.publish_date) it.date = it.publish_date;
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
  // Normalize lang keys
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
