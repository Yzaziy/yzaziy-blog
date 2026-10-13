import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { onRequest } from '../functions/api/visits.js';

function database(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync('migrations/0001_visits.sql', 'utf8'));
  t.after(() => db.close());
  const env = {
    TURNSTILE_SITE_KEY: 'public-sitekey', TURNSTILE_SECRET_KEY: 'private-test-secret',
    VISITS_DB: { prepare: (sql) => ({ first: async () => db.prepare(sql).get() ?? null }) },
  };
  return { db, env };
}

function request(method = 'POST', { origin = 'https://yzaziy.cn', cookie, token = 'valid-token', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  return new Request('https://yzaziy.cn/api/visits', {
    method, headers, body: method === 'GET' ? undefined : body ?? JSON.stringify({ token }),
  });
}

function verifier(t, result = { success: true, hostname: 'yzaziy.cn', action: 'site_visit' }) {
  const seen = [];
  const used = new Set();
  const stub = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(options.method, 'POST');
    const data = JSON.parse(options.body);
    assert.deepEqual(Object.keys(data).sort(), ['response', 'secret']);
    assert.equal(data.secret, 'private-test-secret');
    assert.ok(options.signal instanceof AbortSignal);
    seen.push(data.response);
    if (result instanceof Error) throw result;
    if (result instanceof Response) return result.clone();
    if (used.has(data.response)) return Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    used.add(data.response);
    return Response.json(result);
  });
  return { seen, restore: () => stub.mock.restore() };
}

test('无效 token、非法 JSON 和超长请求不写入也不调用校验服务', async (t) => {
  const { db, env } = database(t);
  const { seen } = verifier(t);
  for (const token of ['', null, 123, 'x'.repeat(2049)]) {
    assert.equal((await onRequest({ request: request('POST', { token }), env })).status, 400);
  }
  for (const body of ['not json', '{}', ' '.repeat(4097)]) {
    assert.equal((await onRequest({ request: request('POST', { body }), env })).status, 400);
  }
  assert.equal(seen.length, 0);
  assert.equal(db.prepare('SELECT total FROM site_visits').get().total, 0);
});

test('token 必须通过服务端验证，匹配本站和计数用途，不能重复使用', async (t) => {
  const { db, env } = database(t);
  for (const result of [
    { success: false }, { success: 'true', hostname: 'yzaziy.cn', action: 'site_visit' },
    { success: true, hostname: 'other.example', action: 'site_visit' },
    { success: true, hostname: 'yzaziy.cn', action: 'login' },
  ]) {
    const check = verifier(t, result);
    assert.equal((await onRequest({ request: request(), env })).status, 403);
    check.restore();
  }
  assert.equal(db.prepare('SELECT total FROM site_visits').get().total, 0);
  verifier(t);
  assert.equal((await onRequest({ request: request(), env })).status, 200);
  assert.equal((await onRequest({ request: request(), env })).status, 403);
  assert.equal(db.prepare('SELECT total FROM site_visits').get().total, 1);
});

test('有效访问原子增加，GET 不增加，重复初始化不清零', async (t) => {
  const { db, env } = database(t);
  verifier(t);
  const responses = await Promise.all(Array.from({ length: 30 }, (_, i) => onRequest({ request: request('POST', { token: `token-${i}` }), env })));
  const totals = await Promise.all(responses.map(async (response) => {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(response.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Lax/);
    return (await response.json()).total;
  }));
  assert.equal(new Set(totals).size, 30);
  db.exec(readFileSync('migrations/0001_visits.sql', 'utf8'));
  const read = await onRequest({ request: request('GET'), env });
  assert.deepEqual(await read.json(), { total: 30, canCount: true, sitekey: 'public-sitekey' });
  assert.deepEqual(db.prepare('PRAGMA table_info(site_visits)').all().map((column) => column.name), ['id', 'total']);
});

test('签名 Cookie 在 60 秒内拒绝重复计数，60 秒后恢复', async (t) => {
  const { db, env } = database(t);
  const { seen } = verifier(t);
  let now = 1800000000000;
  t.mock.method(Date, 'now', () => now);
  const first = await onRequest({ request: request(), env });
  const cookie = first.headers.get('Set-Cookie')?.split(';')[0];
  assert.ok(cookie);
  assert.match(first.headers.get('Set-Cookie'), /Max-Age=60; Path=\/api\/visits/);
  now += 59999;
  const read = await onRequest({ request: request('GET', { cookie }), env });
  assert.equal((await read.json()).canCount, false);
  assert.deepEqual(await (await onRequest({ request: request('POST', { cookie, token: '' }), env })).json(), { total: 1 });
  assert.equal(seen.length, 1);
  now += 1;
  assert.equal((await (await onRequest({ request: request('GET', { cookie }), env })).json()).canCount, true);
  assert.deepEqual(await (await onRequest({ request: request('POST', { cookie, token: 'later-token' }), env })).json(), { total: 2 });
});

test('伪造、损坏或未来 Cookie 不能跳过 Turnstile 校验', async (t) => {
  const { db, env } = database(t);
  verifier(t);
  let now = 1800000000000;
  t.mock.method(Date, 'now', () => now);
  const first = await onRequest({ request: request(), env });
  const cookie = first.headers.get('Set-Cookie')?.split(';')[0];
  assert.ok(cookie);
  for (const fake of ['__Secure-yzaziy_visit=invalid', cookie.replace('1800000000000', '1800000060000'), cookie.slice(0, -2) + 'zz']) {
    assert.equal((await onRequest({ request: request('POST', { cookie: fake, token: '' }), env })).status, 400);
  }
  now -= 1;
  assert.equal((await onRequest({ request: request('POST', { cookie, token: '' }), env })).status, 400);
  assert.equal(db.prepare('SELECT total FROM site_visits').get().total, 1);
});

test('站外、无来源写入和其他 HTTP 方法都不会增加', async (t) => {
  const { db, env } = database(t);
  const { seen } = verifier(t);
  for (const origin of ['https://other.example', null]) {
    assert.equal((await onRequest({ request: request('POST', { origin }), env })).status, 403);
  }
  const response = await onRequest({ request: request('PUT'), env });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET, POST');
  assert.equal(seen.length, 0);
  assert.equal(db.prepare('SELECT total FROM site_visits').get().total, 0);
});

test('校验服务故障或配置缺失时不放行，GET 仍可显示已有总数', async (t) => {
  const { db, env } = database(t);
  db.exec('UPDATE site_visits SET total=9');
  for (const failure of [new Error('offline'), new Response('', { status: 503 }), new Response('bad json')]) {
    const check = verifier(t, failure);
    assert.equal((await onRequest({ request: request(), env })).status, 503);
    check.restore();
  }
  for (const config of [{ ...env, TURNSTILE_SECRET_KEY: undefined }, { ...env, TURNSTILE_SITE_KEY: undefined }]) {
    assert.equal((await onRequest({ request: request(), env: config })).status, 503);
    const data = await (await onRequest({ request: request('GET'), env: config })).json();
    assert.equal(data.total, 9);
    assert.equal(data.canCount, false);
    assert.ok(!JSON.stringify(data).includes('private-test-secret'));
  }
  assert.equal(db.prepare('SELECT total FROM site_visits').get().total, 9);
});

test('数据库缺失、错误或数字上限返回不可用，不伪造零', async (t) => {
  const { db, env } = database(t);
  verifier(t);
  db.exec('UPDATE site_visits SET total=9007199254740991');
  const atLimit = await onRequest({ request: request(), env });
  assert.equal(atLimit.status, 503);
  assert.equal(atLimit.headers.get('Set-Cookie'), null);
  for (const unavailable of [{}, { VISITS_DB: { prepare() { throw new Error('private database details'); } } }]) {
    const response = await onRequest({ request: request('GET'), env: unavailable });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'counter_unavailable' });
  }
});

function client(fetch) {
  let value = { textContent: '统计中…' }, apiScript, widgetOptions, removed = 0;
  const events = new EventTarget();
  const document = {
    getElementById: (id) => id === 'site-visit-value' ? value : { appendChild(script) { apiScript = script; } },
    addEventListener: events.addEventListener.bind(events), createElement: () => ({}),
    documentElement: { classList: { contains: () => true } },
  };
  const window = { turnstile: { render(_target, options) { widgetOptions = options; return 'widget-1'; }, remove() { removed++; } } };
  runInNewContext(readFileSync('src/scripts/visit-counter.js', 'utf8'), { document, window, fetch, AbortSignal, Intl });
  return {
    value: () => value.textContent, script: () => apiScript, widget: () => widgetOptions, removed: () => removed,
    navigate() { value = { textContent: '统计中…' }; events.dispatchEvent(new Event('astro:page-load')); },
  };
}
const settle = () => new Promise(setImmediate);

test('先读总数，验证后只写一次，站内切换不重复计数', async () => {
  const calls = [];
  const page = client(async (url, options) => {
    assert.equal(url, '/api/visits');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    calls.push(options.method);
    if (options.method === 'GET') return Response.json({ total: 1234, canCount: true, sitekey: 'public-sitekey' });
    assert.equal(options.body, '{"token":"test-token"}');
    return Response.json({ total: 1235 });
  });
  await settle();
  assert.equal(page.value(), '1,234 次');
  assert.deepEqual(calls, ['GET']);
  assert.equal(page.script().src, 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
  page.navigate();
  page.script().onload();
  assert.equal(page.widget().action, 'site_visit');
  assert.equal(page.widget().appearance, 'interaction-only');
  assert.equal(page.widget().size, 'compact');
  assert.equal(page.widget().theme, 'dark');
  page.widget().callback('test-token');
  page.widget().callback('test-token');
  await settle();
  assert.equal(page.value(), '1,235 次');
  assert.equal(page.removed(), 1);
  page.navigate();
  assert.equal(page.value(), '1,235 次');
  assert.deepEqual(calls, ['GET', 'POST']);
});

test('冷却或未配置时只读，不加载验证脚本，不写入', async () => {
  let calls = 0;
  const page = client(async () => { calls++; return Response.json({ total: 0, canCount: false, sitekey: null }); });
  await settle();
  assert.equal(page.value(), '0 次');
  assert.equal(page.script(), undefined);
  page.navigate();
  assert.equal(page.value(), '0 次');
  assert.equal(calls, 1);
});

test('脚本、验证或写入失败保留已读总数，不重试', async () => {
  for (const failure of ['script', 'challenge', 'post']) {
    const calls = [];
    const page = client(async (_url, options) => {
      calls.push(options.method);
      if (options.method === 'POST') throw new Error('offline');
      return Response.json({ total: 5, canCount: true, sitekey: 'public-sitekey' });
    });
    await settle();
    if (failure === 'script') page.script().onerror();
    else { page.script().onload(); if (failure === 'challenge') page.widget()['error-callback'](); else page.widget().callback('test-token'); }
    await settle();
    page.navigate();
    assert.equal(page.value(), '5 次');
    assert.deepEqual(calls, failure === 'post' ? ['GET', 'POST'] : ['GET']);
  }
});

test('读数断网、失败或非法数字显示暂不可用且不重试', async () => {
  for (const result of [new Error('offline'), new Response('', { status: 503 }), Response.json({ total: -1 }), Response.json({ total: '10' }), Response.json({ total: 1.5 })]) {
    let calls = 0;
    const page = client(async () => { calls++; if (result instanceof Error) throw result; return result; });
    await settle();
    assert.equal(page.value(), '暂不可用');
    page.navigate();
    assert.equal(page.value(), '暂不可用');
    assert.equal(calls, 1);
    assert.equal(page.script(), undefined);
  }
});

test('验证取消后到达的迟到 callback 不会写入', async () => {
  const calls = [];
  const page = client(async (_url, options) => {
    calls.push(options.method);
    return Response.json({ total: 5, canCount: true, sitekey: 'public-sitekey' });
  });
  await settle();
  page.script().onload();
  page.widget()['expired-callback']();
  page.widget().callback('late-token');
  await settle();
  assert.deepEqual(calls, ['GET']);
  assert.equal(page.value(), '5 次');
});
