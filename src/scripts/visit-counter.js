let display = '统计中…';

function renderVisits() {
  const value = document.getElementById('site-visit-value');
  if (value) value.textContent = display;
}

async function loadCount(method, token) {
  const response = await fetch('/api/visits', {
    method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(8000),
    ...(token ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) } : {}),
  });
  if (!response.ok) throw new Error('Counter unavailable');
  const data = await response.json();
  if (!Number.isSafeInteger(data?.total) || data.total < 0) throw new Error('Invalid counter');
  display = `${new Intl.NumberFormat('zh-CN').format(data.total)} 次`;
  renderVisits();
  return data;
}

function verifyVisit(sitekey) {
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  let widget, submitted = false;
  const removeWidget = () => {
    submitted = true;
    if (widget !== undefined) { window.turnstile.remove(widget); widget = undefined; }
    return true;
  };
  script.onerror = removeWidget;
  script.onload = () => {
    try {
      widget = window.turnstile.render('#site-visit-widget', {
        sitekey, action: 'site_visit', appearance: 'interaction-only', size: 'compact',
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        retry: 'never', 'refresh-expired': 'never', 'refresh-timeout': 'never', 'response-field': false,
        callback: (token) => {
          if (submitted) return;
          submitted = true;
          loadCount('POST', token).catch(renderVisits).finally(removeWidget);
        },
        'error-callback': removeWidget, 'expired-callback': removeWidget, 'timeout-callback': removeWidget,
      });
    } catch { removeWidget(); }
  };
  document.getElementById('site-visit-verification')?.appendChild(script);
}

// Astro's processed module runs once per full document; the challenge container persists across navigation.
loadCount('GET').then(({ canCount, sitekey }) => {
  if (canCount && sitekey) verifyVisit(sitekey);
}).catch(() => {
  display = '暂不可用';
}).finally(renderVisits);

document.addEventListener('astro:page-load', renderVisits);
renderVisits();
