// Public News API: /api/news  (collection)
// GET → list published articles.
//
// Read-only, public. Article management (create/edit/delete) happens
// exclusively through the admin dashboard's own API (admin/functions/api/news),
// which is session-authenticated against admin_users/admin_sessions.

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding missing' });

  const url = new URL(request.url);
  const p = Object.fromEntries(url.searchParams);
  const SUPPORTED = ['en', 'mrh', 'my'];
  const reqLang = (p.lang || '').toLowerCase();
  const lang = SUPPORTED.includes(reqLang) ? reqLang : null;

  let where = `1=1 AND status = 'published'`;
  const vals = [];

  if (p.category) { where += ' AND category = ?'; vals.push(p.category); }

  const year = (p.year || '').trim();
  if (year) { where += ' AND substr(publish_date,1,4) = ?'; vals.push(year); }

  const q = (p.q || p.search || '').trim();
  if (q) {
    const like = '%' + q + '%';
    where += ' AND (title LIKE ? OR summary LIKE ? OR body LIKE ? OR author LIKE ?)';
    vals.push(like, like, like, like);
  }

  const limit = Math.min(parseInt(p.limit || '6') || 6, 100);
  const offset = parseInt(p.offset || '0') || 0;

  const cntRow = await db.prepare(`SELECT COUNT(*) AS c FROM news WHERE ${where}`).bind(...vals).first();
  const total = cntRow?.c || 0;

  const cols = 'id, slug, publish_date AS date, title, summary, body, category, featured_image, tags';
  const rows = await db.prepare(
    `SELECT ${cols} FROM news WHERE ${where} ORDER BY publish_date DESC LIMIT ? OFFSET ?`
  ).bind(...vals, limit, offset).all();

  const items = (rows.results || []).map(r => {
    const it = rowToPublicItem(r);
    return lang ? localize(it, lang) : it;
  });

  return json(200, { items, total }, { 'Cache-Control': 'public, max-age=30' });
}

/* ══════════════════════════════════════
   Helpers
   ══════════════════════════════════════ */

function json(status, data, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...extra },
  });
}

function parseI18n(val) {
  if (!val) return {};
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); return typeof p === 'object' && p !== null ? p : { en: val }; }
    catch { return { en: val }; }
  }
  return typeof val === 'object' && val !== null ? val : {};
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
