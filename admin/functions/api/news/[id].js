// Admin News API: /api/news/:id  (single item)
// GET    → read article (any status)
// PUT    → update article (Admin or Editor, ETag concurrency; Editors cannot
//          transition an article's status to 'published')
// DELETE → delete article (Admin only)
//
// The :id param can be a numeric ID or a slug string.
// Auth: session cookie, verified via admin/_lib/auth.js. Same-origin only — no CORS.

import { requireAuth, json } from '../../../_lib/auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding missing' });

  const id = params.id;
  if (!id) return json(400, { error: 'Missing id' });

  const { user, response } = await requireAuth(request, env);
  if (response) return response;
  const actor = user.email;

  // ── GET ──
  if (request.method === 'GET') {
    const row = /^\d+$/.test(id)
      ? await db.prepare('SELECT * FROM news WHERE id = ?').bind(id).first()
      : await db.prepare('SELECT * FROM news WHERE slug = ?').bind(id).first();

    if (!row) return json(404, { error: 'not found' });
    return json(200, rowToAdminItem(row), { ETag: `"${row.etag || ''}"` });
  }

  // ── PUT: update ──
  if (request.method === 'PUT') {
    const body = await request.json().catch(() => null);
    if (!body) return json(400, { error: 'Invalid JSON' });

    const existing = await db.prepare('SELECT etag, status FROM news WHERE id = ?').bind(id).first();
    if (!existing) return json(404, { error: 'not found' });

    if (user.role === 'editor' && body.status === 'published' && existing.status !== 'published') {
      return json(403, { error: 'Editors cannot publish articles — save as draft for an Admin to publish.' });
    }

    const errs = validate(body);
    if (Object.keys(errs).length) return json(422, { errors: errs });

    const etag = normalizeEtag(request.headers.get('if-match') || body._etag || '');
    const currentEtag = normalizeEtag(existing.etag || '');
    if (currentEtag && etag && currentEtag !== etag) {
      return json(409, { error: 'Version conflict — reload and retry' });
    }

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
    return json(200, { ok: true }, { ETag: `"${nextEtag}"` });
  }

  // ── DELETE (Admin only) ──
  if (request.method === 'DELETE') {
    if (user.role !== 'admin') return json(403, { error: 'Only Admins can delete articles.' });

    let deleteBody = null;
    try { deleteBody = await request.json(); } catch {}
    const etag = normalizeEtag(request.headers.get('if-match') || deleteBody?._etag || '');
    const existing = await db.prepare('SELECT etag FROM news WHERE id = ?').bind(id).first();
    if (!existing) return json(404, { error: 'not found' });
    const currentEtag = normalizeEtag(existing.etag || '');
    if (currentEtag && etag && currentEtag !== etag) return json(409, { error: 'Version conflict' });
    await db.prepare('DELETE FROM news WHERE id = ?').bind(id).run();
    return json(200, { ok: true });
  }

  return json(405, { error: 'method not allowed' });
}

/* ══════════════════════════════════════
   Helpers
   ══════════════════════════════════════ */

function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/\son\w+\s*=\s*("[\s\S]*?"|'[^']*?')/gi, '');
  s = s.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '$1="#"');
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

function normalizeEtag(val) {
  return String(val || '').trim().replace(/^W\//i, '').replace(/^"|"$/g, '');
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

function rowToAdminItem(r) {
  const it = { ...r };
  for (const f of ['title', 'summary', 'body']) it[f] = parseI18n(it[f]);
  if (typeof it.tags === 'string') {
    try { it.tags = JSON.parse(it.tags); } catch { it.tags = []; }
  }
  return it;
}
