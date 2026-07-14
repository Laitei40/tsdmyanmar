// Public News API: /api/news/:id  (single item)
// GET → read a published article by numeric ID or slug.
//
// Read-only, public. Article management happens exclusively through the
// admin dashboard's own API (admin/functions/api/news).

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const db = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding missing' });

  const id = params.id;
  if (!id) return json(400, { error: 'Missing id' });

  const url = new URL(request.url);
  const SUPPORTED = ['en', 'mrh', 'my'];
  const reqLang = (url.searchParams.get('lang') || '').toLowerCase();
  const lang = SUPPORTED.includes(reqLang) ? reqLang : null;

  const cols = 'id, slug, publish_date AS date, title, summary, body, category, featured_image, tags';
  const row = /^\d+$/.test(id)
    ? await db.prepare(`SELECT ${cols} FROM news WHERE id = ? AND status = 'published' LIMIT 1`).bind(id).first()
    : await db.prepare(`SELECT ${cols} FROM news WHERE slug = ? AND status = 'published' LIMIT 1`).bind(id).first();

  if (!row) return json(404, { error: 'not found' });

  const item = rowToPublicItem(row);
  return json(200, lang ? localize(item, lang) : item, { 'Cache-Control': 'public, max-age=30' });
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
