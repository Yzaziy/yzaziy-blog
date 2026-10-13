const COOKIE_NAME = '__Secure-yzaziy_visit';
const encoder = new TextEncoder();

function cookieKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function coolingDown(request, secret) {
  if (!secret) return false;
  const cookie = request.headers.get('Cookie')?.match(/(?:^|;\s*)__Secure-yzaziy_visit=(\d{1,16})\.([0-9a-f]{64})(?:;|$)/);
  if (!cookie) return false;
  const age = Date.now() - Number(cookie[1]);
  if (age < 0 || age >= 60000) return false;
  const signature = Uint8Array.from(cookie[2].match(/../g), (hex) => parseInt(hex, 16));
  return crypto.subtle.verify('HMAC', await cookieKey(secret), signature, encoder.encode(`site-visit-cooldown:${cookie[1]}`));
}

async function cooldownCookie(secret) {
  const stamp = String(Date.now());
  const signature = await crypto.subtle.sign('HMAC', await cookieKey(secret), encoder.encode(`site-visit-cooldown:${stamp}`));
  const hex = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
  // shortcut: clearing cookies bypasses cooldown; add edge rate limiting if deliberate abuse appears.
  return `${COOKIE_NAME}=${stamp}.${hex}; Max-Age=60; Path=/api/visits; HttpOnly; Secure; SameSite=Lax`;
}

async function readToken(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json' || !request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = '', size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return null; }
      body += decoder.decode(value, { stream: true });
    }
    const { token } = JSON.parse(body + decoder.decode());
    return typeof token === 'string' && token.trim() && token.length <= 2048 ? token : null;
  } catch { return null; }
}

export async function onRequest({ request, env }) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!['GET', 'POST'].includes(request.method)) {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: { ...headers, Allow: 'GET, POST' } });
  }
  if (request.method === 'POST' && request.headers.get('Origin') !== new URL(request.url).origin) {
    return Response.json({ error: 'forbidden' }, { status: 403, headers });
  }
  try {
    const configured = Boolean(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY);
    const cooling = await coolingDown(request, env.TURNSTILE_SECRET_KEY);
    let cookie;
    if (request.method === 'POST' && !cooling) {
      if (!configured) throw new Error('Missing verification configuration');
      const token = await readToken(request);
      if (!token) return Response.json({ error: 'invalid_token' }, { status: 400, headers });
      const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
        signal: AbortSignal.timeout(5000),
      });
      if (!check.ok) throw new Error('Verification unavailable');
      const validation = await check.json();
      if (validation.success !== true || validation.hostname !== new URL(request.url).hostname || validation.action !== 'site_visit') {
        return Response.json({ error: 'verification_failed' }, { status: 403, headers });
      }
      cookie = await cooldownCookie(env.TURNSTILE_SECRET_KEY);
    }
    const sql = cookie
      ? 'UPDATE site_visits SET total = total + 1 WHERE id = 1 AND total < 9007199254740991 RETURNING total'
      : 'SELECT total FROM site_visits WHERE id = 1';
    const row = await env.VISITS_DB.prepare(sql).first();
    if (!row || !Number.isSafeInteger(row.total) || row.total < 0) throw new Error('Invalid counter');
    if (cookie) headers['Set-Cookie'] = cookie;
    const data = request.method === 'GET'
      ? { total: row.total, canCount: configured && !cooling, sitekey: env.TURNSTILE_SITE_KEY || null }
      : { total: row.total };
    return Response.json(data, { headers });
  } catch {
    return Response.json({ error: 'counter_unavailable' }, { status: 503, headers });
  }
}
