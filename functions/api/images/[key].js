/**
 * GET /api/images/:key  — Serve an image from R2
 *
 * Returns the image with proper Content-Type, cache headers.
 * Public — no auth required (images are referenced in published articles).
 */

export async function onRequestGet(ctx) {
  const { params, env } = ctx;
  const key = params.key;

  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  const obj = await env.IMAGES.get(key);
  if (!obj) {
    return new Response('Image not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year — keys are unique
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(obj.body, { status: 200, headers });
}
