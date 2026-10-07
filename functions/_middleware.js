/**
 * Gate on the scorecard.
 *
 * The code on the sign carries a token this file signed. Only the entry point
 * `/` is guarded: everything else (the sign generator, the icon, the manifest)
 * is either protected by Cloudflare Access or harmless on its own.
 *
 * The signing key lives in a Cloudflare environment variable, never in the
 * repository and never in anything sent to the browser, so a token cannot be
 * forged by reading the site's source.
 *
 * Until QR_SIGNING_KEY is set the gate stays open, so the site keeps working
 * while it is being configured. Minting fails closed instead: see api/token.js.
 */

const COOKIE = 'pp_ok';
const SESSION_SECONDS = 12 * 60 * 60;

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  if (url.pathname !== '/') { return next(); }
  if (!env.QR_SIGNING_KEY) { return next(); }
  if (hasSession(request)) { return next(); }

  const result = await check(url.searchParams.get('k'), env.QR_SIGNING_KEY);
  if (!result.ok) { return refuse(result.reason); }

  /* Scanning once covers the round: a reopened tab does not need the sign
     again. The pass dies with the token, never outliving it. */
  const res = await next();
  const out = new Response(res.body, res);
  const life = Math.min(SESSION_SECONDS, result.secondsLeft);
  out.headers.append(
    'Set-Cookie',
    COOKIE + '=1; Path=/; Max-Age=' + life + '; Secure; HttpOnly; SameSite=Lax'
  );
  return out;
}

function hasSession(request) {
  const raw = request.headers.get('Cookie') || '';
  return raw.split(';').some((part) => part.trim() === COOKIE + '=1');
}

async function check(token, secret) {
  if (!token) { return { ok: false, reason: 'missing' }; }

  const parts = token.split('.');
  if (parts.length !== 2) { return { ok: false, reason: 'invalid' }; }

  const exp = parseInt(parts[0], 36);
  if (!Number.isFinite(exp) || exp <= 0) { return { ok: false, reason: 'invalid' }; }

  const expected = await sign(parts[0], secret);
  if (!same(expected, parts[1])) { return { ok: false, reason: 'invalid' }; }

  const secondsLeft = exp - Math.floor(Date.now() / 1000);
  if (secondsLeft <= 0) { return { ok: false, reason: 'expired' }; }

  return { ok: true, secondsLeft };
}

/* Kept in step with api/token.js by hand. Two dozen lines duplicated beats a
   shared module that Pages might serve as a static file. */
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
  if (a.length !== b.length) { return false; }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) { diff |= a.charCodeAt(i) ^ b.charCodeAt(i); }
  return diff === 0;
}

function refuse(reason) {
  const expired = reason === 'expired';
  const heading = expired ? 'This code has expired' : 'Scan the sign to score';
  const line = expired
    ? 'Ask at the kiosk for the current code and scan that one.'
    : 'The scorecard opens from the QR code on the sign at the first tee.';

  const body = '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<title>Scorecard unavailable</title>' +
    '<link rel="icon" href="/icon.svg" type="image/svg+xml">' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bowlby+One+SC&family=Hanken+Grotesk:wght@400;600;700&display=swap">' +
    '<style>' +
    ':root{color-scheme:light}' +
    '*{box-sizing:border-box}' +
    'html,body{height:100%}' +
    "body{margin:0;background:#0F3D2E;color:#FFFFFF;font-family:'Hanken Grotesk','Avenir Next',system-ui,sans-serif;" +
    'display:flex;align-items:center;justify-content:center;padding:28px 20px;text-align:center}' +
    '.box{max-width:360px;display:flex;flex-direction:column;align-items:center;gap:16px}' +
    "h1{font-family:'Bowlby One SC',Impact,system-ui,sans-serif;font-size:27px;line-height:1.05;margin:0;text-wrap:balance}" +
    'p{margin:0;font-size:15px;line-height:1.5;color:#A8C4B3}' +
    '</style></head><body><div class="box">' +
    '<svg width="54" height="54" viewBox="0 0 30 30" aria-hidden="true">' +
    '<ellipse cx="15" cy="24" rx="9.5" ry="3.4" fill="#06221A" stroke="#F4C13D" stroke-width="1.4"></ellipse>' +
    '<path d="M13.5 23.5 V5.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"></path>' +
    '<path d="M14.4 5.8 L24 9 L14.4 12.4 Z" fill="#E2562B"></path>' +
    '<circle cx="22.6" cy="22.2" r="3.1" fill="#FFFFFF"></circle></svg>' +
    '<h1>' + heading + '</h1><p>' + line + '</p>' +
    '</div></body></html>';

  return new Response(body, {
    status: 403,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
