/* rider-sw.js — service worker ของแอปไรเดอร์
   หน้าที่ 2 อย่าง:
   1) รับสัญญาณงานใหม่แล้วเด้งแจ้งเตือน แม้ปิดแอปอยู่
   2) คุมการอัปเดตเวอร์ชัน — บอกหน้าเว็บเมื่อมีของใหม่ ให้ผู้ใช้กดอัปเดตเอง

   ตั้งใจไม่แคชไฟล์แอปไว้ เพราะไรเดอร์ต้องเห็นงานล่าสุดเสมอ และการแคชผิด
   ทำให้เครื่องค้างอยู่เวอร์ชันเก่าถาวร ซึ่งแก้ยากกว่าที่ได้ประโยชน์ */
const RIDER_SW_VERSION = 'r1';
const API = 'https://platform.oneday-pos.workers.dev';

self.addEventListener('install', (e) => {
  // ของใหม่พร้อมใช้ทันทีที่ผู้ใช้กดอัปเดต ไม่ต้องรอปิดแท็บทุกแท็บก่อน
  self.skipWaiting();
});
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

/* งานใหม่: สัญญาณที่ส่งมาไม่มีเนื้อหา (การใส่เนื้อหาต้องเข้ารหัสตามสเปก ซับซ้อนกว่ามาก)
   ตัว service worker จึงไปดึงงานที่ยังว่างอยู่มาเองแล้วค่อยเด้งแจ้งเตือน */
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let title = '🛵 มีงานส่งใหม่', body = 'แตะเพื่อดูรายละเอียดและกดรับงาน';
    try {
      const r = await fetch(API + '/pool/jobs/near?region=delivery&status=open&limit=5');
      if (r.ok) {
        const j = await r.json();
        const jobs = (j && j.jobs) || [];
        const top = jobs[0];
        if (top) {
          body = [top.shopName ? 'ร้าน ' + top.shopName : 'งานส่งอาหาร',
                  top.pay ? 'ค่าส่ง ฿' + Math.round(top.pay) : '',
                  jobs.length > 1 ? '(มีอีก ' + (jobs.length - 1) + ' งาน)' : ''].filter(Boolean).join(' · ');
        }
      }
    } catch (err) {}
    await self.registration.showNotification(title, {
      body, icon: '/logo.jpg', badge: '/logo.jpg', tag: 'kd-new-job',
      renotify: true, requireInteraction: false, data: { url: '/Rider App.html' },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/Rider App.html';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // ถ้าเปิดแอปค้างอยู่แล้วให้เด้งแท็บนั้นขึ้นมา ไม่เปิดซ้ำอีกแท็บ
    for (const c of all) { if (c.url.includes('Rider') && 'focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});

// หน้าเว็บสั่งให้ข้ามคิวรออัปเดตได้ (ใช้ตอนผู้ใช้กดปุ่ม "อัปเดตเดี๋ยวนี้")
self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });
