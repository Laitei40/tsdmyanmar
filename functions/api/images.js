/**
 * POST /api/images  — Upload an image to R2
 *
 * Accepts multipart/form-data with a "file" field.
 * Returns { url: "/api/images/<key>" }
 *
 * Only authenticated admins may upload (same auth as news CRUD).
 */

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  /* ── Auth ── */
  if (!isAdmin(request, env)) {
    return json(401, { error: 'Unauthorized' });
  }

  /* ── Parse multipart body ── */
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json(400, { error: 'Expected multipart/form-data' });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return json(400, { error: 'Missing "file" field' });
  }

  /* ── Validate MIME type ── */
  const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (!ALLOWED.includes(file.type)) {
    return json(400, { error: `Unsupported image type: ${file.type}. Allowed: JPEG, PNG, GIF, WebP, SVG` });
  }

  /* ── Size guard (5 MB) ── */
  const MAX = 5 * 1024 * 1024;
  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX) {
    return json(400, { error: 'Image must be under 5 MB' });
  }

  /* ── Generate a unique key ── */
  const ext = extFromMime(file.type);
  const key = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;

  /* ── Store in R2 ── */
  await env.IMAGES.put(key, buf, {
    httpMetadata: { contentType: file.type },
  });

  return json(201, { url: `/api/images/${key}` });
}

/* ══════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════ */

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function extFromMime(mime) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  };
  return map[mime] || '';
}

function isAdmin(request, env) {
  // Dev bypass
  if (env.ADMIN_BYPASS_ACCESS === '1') return true;

  // Cloudflare Access JWT
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion') ||
              getCookie(request, 'CF_Authorization');
  return !!jwt;
}

function getCookie(request, name) {
  const hdr = request.headers.get('Cookie') || '';
  const match = hdr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}
