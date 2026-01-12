// Cloudflare Pages Function to serve a single update from D1
// Supports: ?id= or ?slug= and optional ?lang=

export async function onRequest(context){
  const { env, request } = context;
  const db = env.UPDATES_DB;
  if (!db) return new Response(JSON.stringify({error:'D1 database binding `UPDATES_DB` not found'}), { status: 500, headers: {'Content-Type':'application/json'} });

  // Simple sanitizer reused from updates API
  function sanitizeHtml(html){
    if (!html || typeof html !== 'string') return '';
    html = html.replace(/<!--([\s\S]*?)-->/g, '');
    html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
    html = html.replace(/\s(on\w+)\s*=\s*("[\s\S]*?"|'[\s\S]*?')/gi, '');
    html = html.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '');
    html = html.replace(/<iframe[\s\S]*?src\s*=\s*("|')(.*?)\1[\s\S]*?><\/iframe>/gi, (m, q, src)=>{
      if (/^https?:\/\/(www\.)?youtube\.com\/embed\//i.test(src)){
        return `<iframe src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      }
      return '';
    });
    html = html.replace(/<img[\s\S]*?src\s*=\s*("|')(.*?)\1[\s\S]*?>/gi, (m, q, src)=>{
      if (/^(https?:|\/|data:)/i.test(src)){
        const alt = (m.match(/\salt\s*=\s*("|')(.*?)\1/i) || [])[2] || '';
        return `<img src="${src}" alt="${alt}" style="max-width:100%">`;
      }
      return '';
    });
    html = html.replace(/<a[\s\S]*?href\s*=\s*("|')(.*?)\1[\s\S]*?>/gi,(m,q,href)=>{
      if (/^(https?:|\/|mailto:)/i.test(href)) return `<a href="${href}" target="_blank" rel="noopener noreferrer">`;
      return '<a>';
    });
    html = html.replace(/\sstyle\s*=\s*("[\s\S]*?"|'[\s\S]*?')/gi, '');
    return html;
  }

  try{
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const slug = url.searchParams.get('slug');
    const reqLang = (url.searchParams.get('lang') || '').toLowerCase();
    const SUPPORTED = ['en','mrh','my'];
    const lang = SUPPORTED.indexOf(reqLang) !== -1 ? reqLang : null;

    let row = null;
    if (idParam){
      const r = await db.prepare('SELECT id, date, title, summary, body FROM updates WHERE id = ? LIMIT 1').bind(idParam).all();
      row = (r && r.results && r.results[0]) ? r.results[0] : null;
    } else if (slug){
      // Try numeric id
      if (/^[0-9]+$/.test(slug)){
        const r = await db.prepare('SELECT id, date, title, summary, body FROM updates WHERE id = ? LIMIT 1').bind(slug).all();
        row = (r && r.results && r.results[0]) ? r.results[0] : null;
      }
      // If not found, try match by english or mrh title substring (future: prefer a slug column)
      if (!row){
        const sLike = '%' + slug + '%';
        const r2 = await db.prepare('SELECT id, date, title, summary, body FROM updates WHERE json_extract(title, "$.en") LIKE ? OR json_extract(title, "$.mrh") LIKE ? LIMIT 1').bind(sLike, sLike).all();
        row = (r2 && r2.results && r2.results[0]) ? r2.results[0] : null;
      }
    }

    if (!row) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: {'Content-Type':'application/json'} });

    // Parse JSON fields
    const item = { id: row.id, date: row.date };
    try{ item.title = typeof row.title === 'string' ? JSON.parse(row.title) : row.title; }catch(e){ item.title = row.title; }
    try{ item.summary = typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary; }catch(e){ item.summary = row.summary; }
    try{ item.body = typeof row.body === 'string' ? JSON.parse(row.body) : row.body; }catch(e){ item.body = row.body; }

    // Normalize lang keys
    ['title','summary','body'].forEach(field => {
      const obj = item[field];
      if (!obj || typeof obj !== 'object') return;
      if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
      Object.keys(obj).forEach(k => { const m = k.match(/^([a-z]{2,3})(?:[-_].+)$/i); if (m){ const base = m[1].toLowerCase(); if (!obj[base]) obj[base] = obj[k]; } });
    });

    // If language requested, return localized strings
    if (lang){
      const out = { id: item.id, date: item.date };
      ['title','summary','body'].forEach(f => {
        const obj = item[f];
        let val = (!obj) ? '' : (typeof obj === 'string' ? obj : (obj[lang] || obj.mrh || obj.en || ''));
        if (f === 'body') val = sanitizeHtml(val);
        out[f] = val;
      });
      return new Response(JSON.stringify(out), { status: 200, headers: {'Content-Type':'application/json','Cache-Control':'public, max-age=30'} });
    }

    // sanitize body before returning
    if (item.body && typeof item.body === 'string') item.body = sanitizeHtml(item.body);

    return new Response(JSON.stringify(item), { status: 200, headers: {'Content-Type':'application/json','Cache-Control':'public, max-age=30'} });

  }catch(err){
    console.error('update api error', err);
    return new Response(JSON.stringify({ error: 'failed to query update' }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
}
