// sw.js — Have a Good Day POS · v50
// เปลี่ยนแนวคิด: **ไม่แคชโค้ดของแอปเลย** (html/jsx/js/css/json = ปล่อยผ่านไปเครือข่ายตรง ๆ)
// → กันอาการ "deploy แล้วยังเป็นเวอร์ชันเก่า" ถาวร · แคชแค่รูป/ฟอนต์/CDN
const CACHE = 'hagd-pos-v59';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url; try { url = new URL(req.url); } catch (_) { return; }
  // โค้ดแอป + API → ไม่แตะ ปล่อยไปเครือข่าย (เบราว์เซอร์จัดการเอง)
  if (req.mode === 'navigate') return;
  if (url.origin === self.location.origin && /\.(html|jsx|js|css|json)$|\/$/.test(url.pathname)) return;
  if (url.hostname.endsWith('workers.dev') || url.pathname.startsWith('/api')) return;
  // รูป/ฟอนต์/CDN → cache-first (ไม่ใช่โค้ด เปลี่ยนไม่บ่อย)
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)).catch(() => {}); }
    return res;
  }).catch(() => undefined)));
});
