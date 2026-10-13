import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

async function endpoint() {
  assert.ok(existsSync('functions/api/visits.js'), '缺少 Cloudflare 计数接口');
  return (await import('../functions/api/visits.js')).onRequest;
}

function database() {
  assert.ok(existsSync('migrations/0001_visits.sql'), '缺少计数数据库初始化');
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync('migrations/0001_visits.sql', 'utf8'));
  return {
    db,
    env: { VISITS_DB: { prepare: (sql) => ({ first: async () => db.prepare(sql).get() ?? null }) } },
  };
}

function request(method = 'POST', origin = 'https://yzaziy.cn') {
  return new Request('https://yzaziy.cn/api/visits', {
    method, headers: origin ? { Origin: origin } : {},
  });
}

test('打开一次原子加一，读取不会增加，重复初始化不会清零', async () => {
  const onRequest = await endpoint();
  const { db, env } = database();
  try {
    const first = await onRequest({ request: request(), env });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { total: 1 });
    assert.equal(first.headers.get('Cache-Control'), 'no-store');
    const results = await Promise.all(Array.from({ length: 30 }, () => onRequest({ request: request(), env })));
    const totals = await Promise.all(results.map((response) => response.json().then((body) => body.total)));
    assert.equal(new Set(totals).size, 30);
    db.exec(readFileSync('migrations/0001_visits.sql', 'utf8'));
    const read = await onRequest({ request: request('GET', null), env });
    assert.deepEqual(await read.json(), { total: 31 });
    assert.deepEqual(db.prepare('PRAGMA table_info(site_visits)').all().map((column) => column.name), ['id', 'total']);
  } finally { db.close(); }
});

test('拒绝站外或无来源写入，其他 HTTP 方法也不会增加', async () => {
  const onRequest = await endpoint();
  const { db, env } = database();
  try {
    for (const origin of ['https://other.example', null]) {
      const response = await onRequest({ request: request('POST', origin), env });
      assert.equal(response.status, 403);
    }
    const response = await onRequest({ request: request('PUT'), env });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, POST');
    assert.equal(db.prepare('SELECT total FROM site_visits').get().total, 0);
  } finally { db.close(); }
});

test('数据库缺失、错误或数字上限返回不可用，而不是伪造零', async () => {
  const onRequest = await endpoint();
  const { db, env } = database();
  try {
    db.exec('UPDATE site_visits SET total = 9007199254740991');
    const atLimit = await onRequest({ request: request(), env });
    assert.equal(atLimit.status, 503);
    assert.deepEqual(await atLimit.json(), { error: 'counter_unavailable' });
    assert.equal(db.prepare('SELECT total FROM site_visits').get().total, 9007199254740991);
    for (const unavailable of [{}, { VISITS_DB: { prepare() { throw new Error('private database details'); } } }]) {
      const response = await onRequest({ request: request(), env: unavailable });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: 'counter_unavailable' });
    }
  } finally { db.close(); }
});

function client(fetch) {
  assert.ok(existsSync('src/scripts/visit-counter.js'), '缺少顶部计数显示脚本');
  let value = { textContent: '统计中…' };
  const events = new EventTarget();
  const document = {
    getElementById: () => value,
    addEventListener: events.addEventListener.bind(events),
  };
  runInNewContext(readFileSync('src/scripts/visit-counter.js', 'utf8'), { document, fetch, AbortSignal, Intl });
  return {
    value: () => value.textContent,
    navigate() {
      value = { textContent: '统计中…' };
      events.dispatchEvent(new Event('astro:page-load'));
    },
  };
}

test('初次打开只请求一次，站内切换重绘缓存值，刷新再记一次', async () => {
  let calls = 0;
  const fetch = async (url, options) => {
    assert.equal(url, '/api/visits');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    calls++;
    return Response.json({ total: 1234 });
  };
  const page = client(fetch);
  await new Promise(setImmediate);
  assert.equal(page.value(), '1,234 次');
  page.navigate();
  page.navigate();
  await new Promise(setImmediate);
  assert.equal(page.value(), '1,234 次');
  assert.equal(calls, 1);
  client(fetch);
  await new Promise(setImmediate);
  assert.equal(calls, 2);
});

test('计数请求未完成时切换页面，结果仍显示到当前页', async () => {
  let finish;
  const page = client(() => new Promise((resolve) => { finish = resolve; }));
  page.navigate();
  finish(Response.json({ total: 8 }));
  await new Promise(setImmediate);
  assert.equal(page.value(), '8 次');
});

test('断网、接口失败和非法计数显示暂不可用且不自动重试', async () => {
  for (const result of [new Error('offline'), new Response('', { status: 503 }), Response.json({ total: -1 }), Response.json({ total: '10' }), Response.json({ total: 0 }), Response.json({ total: 1.5 })]) {
    let calls = 0;
    const page = client(async () => {
      calls++;
      if (result instanceof Error) throw result;
      return result;
    });
    await new Promise(setImmediate);
    assert.equal(page.value(), '暂不可用');
    page.navigate();
    assert.equal(page.value(), '暂不可用');
    assert.equal(calls, 1);
  }
});
