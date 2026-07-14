// POST /api/auth/login — { email, password } → { user } + Set-Cookie
//
// Generic "Invalid email or password" for bad creds / unknown email / disabled
// account (no account enumeration). 429 with a clear message while locked out.

// ── Inlined from admin/_lib/auth.js ──────────────────────────────
// A shared module living outside admin/functions/ was not reliably picked
// up by the Cloudflare Pages Functions build (unconfirmed convention —
// only _middleware.js/_routes.json are documented as excluded from
// routing/bundling). Every route now carries its own copy instead of
// importing across that boundary. Keep in sync by hand if this logic
// changes — see admin/_lib/auth.js for the canonical version.

const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_DAYS = 7;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

const SESSION_COOKIE_NAME = 'tsd_admin_session';
const SESSION_REFRESH_THRESHOLD_MS = 60 * 60 * 1000; // refresh sliding expiry at most once/hour

/* ══════════════════════════════════════
   Password hashing — PBKDF2-HMAC-SHA256 via Web Crypto
   Format: pbkdf2$<iterations>$<saltB64>$<hashB64>
   ══════════════════════════════════════ */

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function pbkdf2(password, saltBuf, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashBuf = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToB64(salt)}$${bufToB64(hashBuf)}`;
}

async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  if (!iterations || iterations < 1) return false;

  const salt = b64ToBuf(parts[2]);
  const expected = new Uint8Array(b64ToBuf(parts[3]));
  const actual = new Uint8Array(await pbkdf2(password, salt, iterations));
  if (actual.length !== expected.length) return false;

  // Constant-time comparison — no node:crypto.timingSafeEqual without nodejs_compat.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

const TEMP_PW_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // no 0/O/1/l/I
function generateTempPassword(length = 14) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) out += TEMP_PW_CHARS[bytes[i] % TEMP_PW_CHARS.length];
  return out;
}

/* ══════════════════════════════════════
   Session tokens & cookies
   ══════════════════════════════════════ */

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(str) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

// Secure flag is derived from the request itself (never an env var) — a forgettable
// toggle is exactly what caused the previous Access-bypass bug (DEV_MODE==='true').
function isHttps(request) {
  try { return new URL(request.url).protocol === 'https:'; } catch { return true; }
}

function buildSessionCookie(token, request, maxAgeSeconds) {
  const attrs = [`${SESSION_COOKIE_NAME}=${token}`, 'HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`];
  if (isHttps(request)) attrs.push('Secure');
  return attrs.join('; ');
}

function buildLogoutCookie(request) {
  const attrs = [`${SESSION_COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (isHttps(request)) attrs.push('Secure');
  return attrs.join('; ');
}

async function createSession(db, userId, request) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const ua = request.headers.get('User-Agent') || '';
  const ip = request.headers.get('CF-Connecting-IP') || '';
  await db.prepare(
    `INSERT INTO admin_sessions (user_id, token_hash, expires_at, ip, user_agent) VALUES (?,?,?,?,?)`
  ).bind(userId, tokenHash, expires, ip, ua).run();
  return { cookie: buildSessionCookie(token, request, SESSION_TTL_DAYS * 24 * 60 * 60) };
}

/** Returns { id, name, email, role, must_change_password } or null. */
async function getSessionUser(request, env) {
  const db = env.UPDATES_DB;
  const token = parseCookies(request)[SESSION_COOKIE_NAME];
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const row = await db.prepare(
    `SELECT s.id AS session_id, s.expires_at, s.last_seen_at,
            u.id, u.name, u.email, u.role, u.disabled, u.must_change_password
     FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
     WHERE s.token_hash = ?`
  ).bind(tokenHash).first();

  if (!row || row.disabled) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  if (Date.now() - new Date(row.last_seen_at).getTime() > SESSION_REFRESH_THRESHOLD_MS) {
    const newExpires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare(`UPDATE admin_sessions SET last_seen_at = datetime('now'), expires_at = ? WHERE id = ?`)
      .bind(newExpires, row.session_id).run();
  }

  return { id: row.id, name: row.name, email: row.email, role: row.role, must_change_password: !!row.must_change_password };
}

async function destroySession(db, request) {
  const token = parseCookies(request)[SESSION_COOKIE_NAME];
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await db.prepare(`DELETE FROM admin_sessions WHERE token_hash = ?`).bind(tokenHash).run();
}

async function destroyAllSessionsForUser(db, userId) {
  await db.prepare(`DELETE FROM admin_sessions WHERE user_id = ?`).bind(userId).run();
}

/* ══════════════════════════════════════
   Role helpers — return either { user } or a ready-to-return { response }
   ══════════════════════════════════════ */

async function requireAuth(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return { response: json(401, { error: 'Not authenticated' }) };
  return { user };
}

async function requireAdmin(request, env) {
  const result = await requireAuth(request, env);
  if (result.response) return result;
  if (result.user.role !== 'admin') return { response: json(403, { error: 'Admins only' }) };
  return result;
}

/* ══════════════════════════════════════
   Response helper (no CORS — same-origin only)
   ══════════════════════════════════════ */

function json(status, data, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}
// ── End inlined auth helpers ─────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const db = env.UPDATES_DB;
  if (!db) return json(500, { error: 'D1 binding missing' });

  const body = await request.json().catch(() => null);
  const email = (body?.email || '').trim().toLowerCase();
  const password = body?.password || '';
  if (!email || !password) return json(400, { error: 'Email and password are required' });

  const user = await db.prepare(
    `SELECT id, name, email, password_hash, role, disabled, must_change_password, failed_attempts, locked_until
     FROM admin_users WHERE email = ?`
  ).bind(email).first();

  const INVALID = { error: 'Invalid email or password' };

  if (!user || user.disabled) return json(401, INVALID);

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    return json(429, { error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.` });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    const attempts = (user.failed_attempts || 0) + 1;
    const lockedUntil = attempts >= LOCKOUT_THRESHOLD
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      : null;
    await db.prepare(`UPDATE admin_users SET failed_attempts = ?, locked_until = ? WHERE id = ?`)
      .bind(attempts, lockedUntil, user.id).run();
    return json(401, INVALID);
  }

  await db.prepare(
    `UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?`
  ).bind(user.id).run();

  const { cookie } = await createSession(db, user.id, request);

  return json(200, {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, must_change_password: !!user.must_change_password },
  }, { 'Set-Cookie': cookie });
}
