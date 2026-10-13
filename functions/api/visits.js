export async function onRequest({ request, env }) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!['GET', 'POST'].includes(request.method)) {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: { ...headers, Allow: 'GET, POST' } });
  }
  if (request.method === 'POST' && request.headers.get('Origin') !== new URL(request.url).origin) {
    return Response.json({ error: 'forbidden' }, { status: 403, headers });
  }
  try {
    const sql = request.method === 'POST'
      ? 'UPDATE site_visits SET total = total + 1 WHERE id = 1 AND total < 9007199254740991 RETURNING total'
      : 'SELECT total FROM site_visits WHERE id = 1';
    const row = await env.VISITS_DB.prepare(sql).first();
    if (!row || !Number.isSafeInteger(row.total) || row.total < 0) throw new Error('Invalid counter');
    return Response.json({ total: row.total }, { headers });
  } catch {
    return Response.json({ error: 'counter_unavailable' }, { status: 503, headers });
  }
}
