/* 정도 줄넘기 시합 서비스워커 - 한 번 받은 파일을 폰에 저장해두고 다음부터는 데이터 없이 엽니다.
   화면 파일(index.html)은 열 때마다 "바뀌었는지"만 조용히 확인하고, 바뀌었으면 다음번 실행부터 새 버전이 보입니다. */
const CACHE = 'jump-v2';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('jump-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (/firebaseio\.com|firebasedatabase\.app/.test(url.hostname)) return; // 실시간 대전은 항상 인터넷으로
  e.respondWith(url.origin === location.origin ? sameSite(e, req) : cdn(req));
});

async function sameSite(e, req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req.url, { cache: 'no-cache' }).then(async r => {
    if (r && r.ok) {
      const old = hit && hit.headers.get('etag');
      const cur = r.headers.get('etag');
      if (!hit || !old || !cur || old !== cur) await cache.put(req.url, r.clone());
    }
    return r;
  }).catch(() => null);
  if (hit) { e.waitUntil(net); return hit; }
  const r = await net;
  if (r) return r;
  return (await cache.match('./index.html')) || Response.error();
}

async function cdn(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    let r;
    try { r = await fetch(new Request(req.url, { mode: 'cors', credentials: 'omit' })); }
    catch (_) { r = await fetch(req); }
    if (r && (r.ok || r.type === 'opaque')) await cache.put(req, r.clone());
    return r;
  } catch (_) {
    return Response.error();
  }
}
