/* KaiDee POS — client license check (talks to the Cloudflare Worker)
 * - ถ้ายังไม่ตั้ง LICENSE_ENDPOINT → คืน null (แอปใช้ localStorage demo เหมือนเดิม ไม่พัง)
 * - ถ้าตั้งแล้ว → ถามเซิร์ฟเวอร์ตอนเปิดแอป, cache ผลไว้กัน internet หลุด (grace)
 * window.KD_LICENSE.check(shopId) → Promise<{active,daysLeft,expiry,plan,source}>
 */
(function () {
  // ⬇️ ใส่ URL Worker ของคุณตรงนี้ (จาก license-worker/worker.js) — เว้นว่าง = ใช้ demo localStorage
  const LICENSE_ENDPOINT = 'https://kaidee-license.oneday-pos.workers.dev'; // เช่น 'https://kaidee-license.xxx.workers.dev'
  const GRACE_DAYS = 5;        // internet หลุด → ใช้ผลล่าสุดต่อได้กี่วัน
  const CACHE_KEY = 'kd_license_cache_v1';
  const DEVICE_KEY = 'kd_device_id_v1';

  function deviceId() {
    try {
      let id = localStorage.getItem(DEVICE_KEY);
      if (!id) { id = 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(DEVICE_KEY, id); }
      return id;
    } catch (e) { return 'd0'; }
  }
  function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
  function writeCache(shopId, status) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ shopId, status, ts: Date.now() })); } catch (e) {} }

  async function check(shopId) {
    if (!LICENSE_ENDPOINT) return null; // demo mode
    const url = `${LICENSE_ENDPOINT}/shop/${encodeURIComponent(shopId)}/status?device=${encodeURIComponent(deviceId())}`;
    try {
      const r = await fetch(url, { method: 'GET' });
      const s = await r.json();
      writeCache(shopId, s);
      return { ...s, source: 'server' };
      // note: server may return graceDays (ตั้งได้จาก Back Office) — ใช้แทนค่าคงที่
    } catch (e) {
      // offline → ใช้ cache ล่าสุดภายใน grace
      const c = readCache();
      if (c && c.shopId === shopId) {
        const grace = (c.status && c.status.graceDays != null) ? c.status.graceDays : GRACE_DAYS;
        const ageDays = (Date.now() - c.ts) / 86400000;
        if (ageDays <= grace) return { ...c.status, source: 'cache', graceLeft: Math.ceil(grace - ageDays) };
        return { active: false, reason: 'offline_expired_grace', source: 'cache' };
      }
      return { active: true, reason: 'no_cache_allow', source: 'none' }; // ครั้งแรก offline → ปล่อยผ่านกันร้านสะดุด
    }
  }

  async function submitPayReq(shopId, payload) {
    if (!LICENSE_ENDPOINT) return { ok: false, demo: true };
    try {
      const r = await fetch(`${LICENSE_ENDPOINT}/shop/${encodeURIComponent(shopId)}/payreq`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload || {})
      });
      return await r.json();
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  window.KD_LICENSE = { check, submitPayReq, deviceId, configured: () => !!LICENSE_ENDPOINT, endpoint: () => LICENSE_ENDPOINT, GRACE_DAYS };
})();
