// Cloudflare Pages Function (basic stub)
// Place this under `updates/functions/updates.js`.
// For a production Pages Function you may need to adapt import patterns
// depending on your build setup. This example returns the JSON data.

export async function onRequest(context) {
  try {
    // Attempt to load bundled JSON (may require build support)
    // If your environment doesn't support importing JSON, fetch the file by URL instead.
    let data;
    try {
      // ESM json import (may work with your bundler):
      // import updates from '../data/updates.json' assert { type: 'json' };
      // data = updates;
      // Fallback: fetch relative path from the site root
      const url = new URL('assets/documents/reports/updates.json', context.env.URL || 'https://example.com');
      const res = await fetch(url.toString());
      data = await res.json();
    } catch (e) {
      data = { error: 'Could not load updates data', details: e.message };
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}


