let display = '统计中…';

function renderVisits() {
  const value = document.getElementById('site-visit-value');
  if (value) value.textContent = display;
}

// Astro's processed module runs once per full document, not on internal navigation.
fetch('/api/visits', {
  method: 'POST', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(8000),
}).then(async (response) => {
  if (!response.ok) throw new Error('Counter unavailable');
  const data = await response.json();
  if (!Number.isSafeInteger(data?.total) || data.total < 1) throw new Error('Invalid counter');
  display = `${new Intl.NumberFormat('zh-CN').format(data.total)} 次`;
}).catch(() => {
  display = '暂不可用';
}).finally(renderVisits);

document.addEventListener('astro:page-load', renderVisits);
renderVisits();
