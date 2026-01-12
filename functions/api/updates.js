// Cloudflare Pages Function (or Workers-style) to serve Updates from a D1 database
// Bind your D1 database as `UPDATES_DB` in Pages environment variables

export async function onRequest(context){
  const { env, request } = context;
  const db = env.UPDATES_DB;
  if (!db) return new Response(JSON.stringify({error:'D1 database binding `UPDATES_DB` not found'}), { status: 500, headers: {'Content-Type':'application/json'} });

  // Basic, conservative HTML sanitizer to remove scripts and unsafe attributes
  // Note: this is intentionally restrictive. For full safety consider using a
  // well-tested sanitizer (DOMPurify) in a build step or sanitize on ingestion.
  function sanitizeHtml(html){
    if (!html || typeof html !== 'string') return '';
    // remove comments, scripts and styles
    html = html.replace(/<!--([\s\S]*?)-->/g, '');
    html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
    // remove event handlers like onclick="..."
    html = html.replace(/\s(on\w+)\s*=\s*("[\s\S]*?"|'[\s\S]*?')/gi, '');
    // remove javascript: URIs in href/src
    html = html.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '');
    // allow only YouTube iframes; remove other iframes
    html = html.replace(/<iframe[\s\S]*?src\s*=\s*("|')(.*?)\1[\s\S]*?><\/iframe>/gi, (m, q, src)=>{
      if (/^https?:\/\/(www\.)?youtube\.com\/embed\//i.test(src)){
        return `<iframe src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      }
      return '';
    });
    // sanitize images (allow http(s), data:, or root-relative)
    html = html.replace(/<img[\s\S]*?src\s*=\s*("|')(.*?)\1[\s\S]*?>/gi, (m, q, src)=>{
      if (/^(https?:|\/|data:)/i.test(src)){
        const alt = (m.match(/\salt\s*=\s*("|')(.*?)\1/i) || [])[2] || '';
        return `<img src="${src}" alt="${alt}" style="max-width:100%">`;
      }
      return '';
    });
    // sanitize anchors: allow http(s), mailto or relative
    html = html.replace(/<a[\s\S]*?href\s*=\s*("|')(.*?)\1[\s\S]*?>/gi,(m,q,href)=>{
      if (/^(https?:|\/|mailto:)/i.test(href)) return `<a href="${href}" target="_blank" rel="noopener noreferrer">`;
      return '<a>';
    });
    // strip remaining style attributes (conservative)
    html = html.replace(/\sstyle\s*=\s*("[\s\S]*?"|'[\s\S]*?')/gi, '');
    return html;
  }

  try{
    // Support single-item fetch by id (query param `id` or path `/api/updates/<id>`)
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const pathParts = url.pathname.replace(/\/+/g,'/').split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length-1];
    const idFromPath = (pathParts.length >= 2 && pathParts[pathParts.length-2] === 'updates' && /^[0-9]+$/.test(lastPart)) ? lastPart : null;
    const id = idParam || idFromPath;

    if (id){
      const qRow = 'SELECT id, date, title, summary, body FROM updates WHERE id = ? LIMIT 1';
      const rRow = await db.prepare(qRow).bind(id).all();
      const row = (rRow && rRow.results && rRow.results[0]) ? rRow.results[0] : null;
      if (!row) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: {'Content-Type':'application/json'} });

      const item = { id: row.id, date: row.date };
      try{ item.title = typeof row.title === 'string' ? JSON.parse(row.title) : row.title; }catch(e){ item.title = row.title; }
      try{ item.summary = typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary; }catch(e){ item.summary = row.summary; }
      try{ item.body = typeof row.body === 'string' ? JSON.parse(row.body) : row.body; }catch(e){ item.body = row.body; }
      ['title','summary','body'].forEach(field => {
        const obj = item[field];
        if (!obj || typeof obj !== 'object') return;
        if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
        Object.keys(obj).forEach(k => { const m = k.match(/^([a-z]{2,3})(?:[-_].+)$/i); if (m){ const base = m[1].toLowerCase(); if (!obj[base]) obj[base] = obj[k]; } });
      });

      const reqLang = (url.searchParams.get('lang') || '').toLowerCase();
      const SUPPORTED = ['en','mrh','my'];
      if (reqLang && SUPPORTED.indexOf(reqLang) !== -1){
        const out = { id: item.id, date: item.date };
        ['title','summary','body'].forEach(f => {
          const obj = item[f];
          let val = (!obj) ? '' : (typeof obj === 'string' ? obj : (obj[reqLang] || obj.mrh || obj.en || ''));
          if (f === 'body') val = sanitizeHtml(val);
          out[f] = val;
        });
        return new Response(JSON.stringify(out), { status: 200, headers: {'Content-Type':'application/json','Cache-Control':'public, max-age=30'} });
      }

      // sanitize body fields when returning the raw item object as well
      if (item.body && typeof item.body === 'string') item.body = sanitizeHtml(item.body);

      return new Response(JSON.stringify(item), { status: 200, headers: {'Content-Type':'application/json','Cache-Control':'public, max-age=30'} });
    }

    // Existing pagination/search logic follows
    const reqLang = (url.searchParams.get('lang') || '').toLowerCase();
    const SUPPORTED = ['en','mrh','my'];
    const lang = SUPPORTED.indexOf(reqLang) !== -1 ? reqLang : 'en';
    const limit = parseInt(url.searchParams.get('limit') || '6', 10) || 6;
    const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0;
    const q = (url.searchParams.get('q') || '').trim();
    const year = (url.searchParams.get('year') || '').trim();

    // Build WHERE clause safely (lang is validated, q/year are parameters)
    let where = '1=1';
    const params = [];
    if (year){ where += ' AND substr(date,1,4) = ?'; params.push(year); }
    if (q){
      // Search in localized title/summary, fall back to en
      const like = '%' + q + '%';
      // Use template literal to avoid single-quote escaping issues
      where += ` AND ( (json_extract(title, '$."' || ? || '"') LIKE ?) OR (json_extract(summary, '$."' || ? || '"') LIKE ?) OR (json_extract(title, '$.en') LIKE ?) OR (json_extract(summary, '$.en') LIKE ?) )`;
      params.push(lang, like, lang, like, like, like);
    }

    // Get total count
    const countSql = 'SELECT COUNT(*) AS cnt FROM updates WHERE ' + where;
    const countRes = await db.prepare(countSql).bind(...params).all();
    const total = (countRes && countRes.results && countRes.results[0]) ? countRes.results[0].cnt : 0;

    // Query with limit/offset
    const sql = 'SELECT id, date, title, summary, body FROM updates WHERE ' + where + ' ORDER BY date DESC LIMIT ? OFFSET ?';
    const allParams = params.slice();
    allParams.push(limit);
    allParams.push(offset);
    const r = await db.prepare(sql).bind(...allParams).all();
    const rows = (r && r.results) ? r.results : [];

    // Map rows into items with parsed JSON and optional localization
    const items = rows.map(row => {
      const it = { id: row.id, date: row.date };
      try{ it.title = typeof row.title === 'string' ? JSON.parse(row.title) : row.title; }catch(e){ it.title = row.title; }
      try{ it.summary = typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary; }catch(e){ it.summary = row.summary; }
      try{ it.body = typeof row.body === 'string' ? JSON.parse(row.body) : row.body; }catch(e){ it.body = row.body; }

      // normalize language keys
      ['title','summary','body'].forEach(field => {
        const obj = it[field];
        if (!obj || typeof obj !== 'object') return;
        if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
        Object.keys(obj).forEach(k => { const m = k.match(/^([a-z]{2,3})(?:[-_].+)$/i); if (m){ const base = m[1].toLowerCase(); if (!obj[base]) obj[base] = obj[k]; } });
      });

      if (reqLang && SUPPORTED.indexOf(reqLang) !== -1){
        const out = { id: it.id, date: it.date };
        ['title','summary','body'].forEach(f => {
          const obj = it[f];
          let val = (!obj) ? '' : (typeof obj === 'string' ? obj : (obj[reqLang] || obj.mrh || obj.en || ''));
          if (f === 'body') val = sanitizeHtml(val);
          out[f] = val;
        });
        return out;
      }

      // sanitize body if present as a string
      if (it.body && typeof it.body === 'string') it.body = sanitizeHtml(it.body);
      return it;
    });

    return new Response(JSON.stringify({ items, total }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache short on CDN, let revalidation handle freshness
        'Cache-Control': 'public, max-age=30'
      }
    });
  }catch(err){
    console.error('updates api error', err);
    return new Response(JSON.stringify({error:'failed to query updates'}), { status: 500, headers: {'Content-Type':'application/json'} });
  }
}
