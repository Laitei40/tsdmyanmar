// Cloudflare Pages Function (or Workers-style) to serve Updates from a D1 database
// Bind your D1 database as `UPDATES_DB` in Pages environment variables

export async function onRequest(context){
  const { env, request } = context;
  const db = env.UPDATES_DB;
  if (!db) return new Response(JSON.stringify({error:'D1 database binding `UPDATES_DB` not found'}), { status: 500, headers: {'Content-Type':'application/json'} });

  try{
    // Basic SQL - ensure your schema matches the seed SQL
    // We expect a table `updates` with columns: id INTEGER PRIMARY KEY, date TEXT, title JSON, summary JSON, body JSON
    const q = 'SELECT id, date, title, summary, body FROM updates ORDER BY date DESC';
    const r = await db.prepare(q).all();
    const rows = (r && r.results) ? r.results : [];

    // Parse JSON fields if stored as strings
    const items = rows.map(row => {
      const item = { id: row.id, date: row.date };
      try{ item.title = typeof row.title === 'string' ? JSON.parse(row.title) : row.title; }catch(e){ item.title = row.title; }
      try{ item.summary = typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary; }catch(e){ item.summary = row.summary; }
      try{ item.body = typeof row.body === 'string' ? JSON.parse(row.body) : row.body; }catch(e){ item.body = row.body; }
      return item;
    });

    return new Response(JSON.stringify(items), {
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
