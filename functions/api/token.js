/**
 * Mints the code that goes on the sign.
 *
 * Fails closed: without a signing key, and without a way to tell that the
 * caller is you, it refuses. Two ways to prove that, either or both:
 *
 *   ADMIN_KEY    a secret you type into /admin once. Works anywhere.
 *   ADMIN_EMAIL  your email, checked against the header Cloudflare Access
 *                attaches to requests it has authenticated. Only meaningful
 *                with an Access policy in front of /admin* and /api/*.
 *
 * Set them in the Cloudflare dashboard: Pages project → Settings → Variables
 * and secrets. They never enter the repository.
 */

const MAX_DAYS = 365;
const DEFAULT_DAYS = 7;

export async function onRequestGet({ request, env }) {
  if (!env.QR_SIGNING_KEY) {
    return json({ error: 'No signing key set. Add QR_SIGNING_KEY in the Cloudflare dashboard.' }, 503);
  }

  const gate = guard(request, env);
  if (gate) { return gate; }

  const url = new URL(request.url);
  const days = clampDays(url.searchParams.get('days'));
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  const payload = exp.toString(36);
  const token = payload + '.' + (await sign(payload, env.QR_SIGNING_KEY));

  return json({
    token,
    days,
    url: url.origin + '/?k=' + token,
    expires: new Date(exp * 1000).toISOString()
  }, 200);
}

export function onRequest() {
  return json({ error: 'Use GET.' }, 405);
}

function guard(request, env) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');

  if (env.ADMIN_EMAIL) {
    if (email && email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()) { return null; }
    if (!env.ADMIN_KEY) {
      return json({ error: 'Not signed in as the administrator.' }, 403);
    }
  }

  if (env.ADMIN_KEY) {
    const given = request.headers.get('X-Admin-Key') || '';
    if (same(given, env.ADMIN_KEY)) { return null; }
    return json({ error: 'Wrong admin key.' }, 401);
  }

  return json({
    error: 'No administrator check configured. Set ADMIN_KEY in the Cloudflare dashboard before codes can be issued.'
  }, 503);
}

function clampDays(raw) {
  const n = parseInt(raw || '', 10);
  if (!Number.isFinite(n)) { return DEFAULT_DAYS; }
  return Math.min(MAX_DAYS, Math.max(1, n));
}

/* Kept in step with _middleware.js by hand. */
async function sign(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode('v1.' + payload));
  const bytes = new Uint8Array(mac).slice(0, 16);
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function same(a, b) {
  if (!a || !b || a.length !== b.length) { return false; }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) { diff |= a.charCodeAt(i) ^ b.charCodeAt(i); }
  return diff === 0;
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
