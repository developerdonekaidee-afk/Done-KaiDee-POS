// platform-api.jsx — client เชื่อม backend เดียว (Cloudflare Worker) สำหรับ
//   ตลาด · ฟิตเนส · สปอนเซอร์ · Labor Win · แพลตฟอร์ม
// ┌────────────────────────────────────────────────────────────────────┐
// │ URL backend แก้ได้จาก localStorage 'plat_api_base' (ไม่ต้อง deploy ใหม่)  │
// │ ไม่ตั้งค่า = ใช้ default ด้านล่าง                                            │
// └────────────────────────────────────────────────────────────────────┘
(function () {
  const PLAT_API_DEFAULT = 'https://platform.oneday-pos.workers.dev'; // ← URL worker จริง
  function base() { try { const o = (localStorage.getItem('plat_api_base') || '').trim().replace(/\/$/, ''); return o || PLAT_API_DEFAULT; } catch (e) { return PLAT_API_DEFAULT; } }
  function key() { try { return localStorage.getItem('plat_api_key') || ''; } catch (e) { return ''; } }

  async function _req(method, path, bodyObj, biz) {
    const url = base() + path;
    const headers = {};
    if (biz) headers['X-Biz'] = biz;
    const k = key(); if (k) headers['Authorization'] = 'Bearer ' + k;
    let bodyStr;
    if (bodyObj) { headers['content-type'] = 'application/json'; bodyStr = JSON.stringify(biz ? { biz, ...bodyObj } : bodyObj); }
    const r = await fetch(url, { method, headers, body: bodyStr });
    const t = await r.text();
    const j = t ? JSON.parse(t) : null;
    if (!r.ok && r.status !== 409) throw Object.assign(new Error(method + ' ' + path + ' → ' + r.status), { status: r.status, body: j });
    return { status: r.status, ...(j || {}) };
  }
  const q = (o) => { const p = Object.entries(o || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => k + '=' + encodeURIComponent(v)); return p.length ? '?' + p.join('&') : ''; };

  const PLAT_API = {
    get base() { return base(); },
    get isDefault() { try { return !(localStorage.getItem('plat_api_base') || '').trim(); } catch (e) { return true; } },
    setEndpoint(url, apiKey) { try { if (url != null) localStorage.setItem('plat_api_base', (url || '').trim().replace(/\/$/, '')); if (apiKey != null) localStorage.setItem('plat_api_key', apiKey || ''); } catch (e) {} },
    async health() { const r = await fetch(base() + '/health'); return r.ok ? r.json() : { ok: false, status: r.status }; },

    // ── admin ──
    adminLogin: (pass) => _req('POST', '/admin/login', { pass }),
    adminVerify: (token) => _req('POST', '/admin/verify', { token }),

    // ── tenant registry ──
    registerBiz: (info) => _req('POST', '/biz', info),                 // {bizId, type, name, ownerLine}
    getBiz: (id) => _req('GET', '/biz/' + encodeURIComponent(id)),
    patchBiz: (id, p) => _req('PATCH', '/biz/' + encodeURIComponent(id), p),
    listBizes: (type, token) => _req('GET', '/biz' + q({ type, token })),

    // ── document store (sync JSON blob ทั้งก้อน) ──
    getDoc: (biz, docKey) => _req('GET', '/doc/' + docKey + q({ biz }), null, null),
    putDoc: (biz, docKey, data, opts) => _req('PUT', '/doc/' + docKey, { data, ...(opts || {}) }, biz),   // opts: {baseRev,type,name,ownerLine,by}
    patchDoc: (biz, docKey, patch, by) => _req('PATCH', '/doc/' + docKey, { patch, by }, biz),
    delDoc: (biz, docKey) => _req('DELETE', '/doc/' + docKey + q({ biz })),
    getDocs: (biz) => _req('GET', '/docs' + q({ biz })),

    // ── collection store (append/list) ──
    listColl: (biz, coll, opts) => _req('GET', '/coll/' + coll + q({ biz, ...(opts || {}) })),
    addRecord: (biz, coll, record) => _req('POST', '/coll/' + coll, { record }, biz),
    patchRecord: (biz, coll, id, patch) => _req('PATCH', '/coll/' + coll + '/' + encodeURIComponent(id), { patch }, biz),
    delRecord: (biz, coll, id) => _req('DELETE', '/coll/' + coll + '/' + encodeURIComponent(id) + q({ biz })),

    // ── PromptPay QR (คำนวณฝั่ง server) ──
    payQR: (id, amount) => _req('GET', '/pay/qr' + q({ id, amount })),

    // ── market_id linking (ตลาด ↔ แม่ค้า/แรงงาน · สมัคร 2 ทาง) ──
    marketResolve: (code) => _req('GET', '/market/resolve' + q({ code })),                                    // หา market จากโค้ด/ไอดี
    marketJoin: (mid, info) => _req('POST', '/market/' + encodeURIComponent(mid) + '/join', info),            // {role,name,phone,line,skills,lat,lng,autoApprove}
    marketRoster: (mid, role, since) => _req('GET', '/market/' + encodeURIComponent(mid) + '/roster' + q({ role, since })),
    marketSetCode: (mid, code) => _req('POST', '/market/' + encodeURIComponent(mid) + '/code', { code }),      // ตลาดออกโค้ดเชิญ
    marketPatchMember: (mid, id, patch) => _req('PATCH', '/market/' + encodeURIComponent(mid) + '/member/' + encodeURIComponent(id), { patch }),

    // ── worker pool + GPS (งานใกล้ฉัน) ──
    poolWorker: (info, region) => _req('POST', '/pool/worker' + q({ region }), info),                          // {id,name,line,skills,lat,lng,available,marketId,lang}
    poolPostJob: (job, region) => _req('POST', '/pool/job' + q({ region }), job),                              // {title,type,marketId,shopName,lat,lng,pay,win}
    poolPatchJob: (id, patch, region) => _req('PATCH', '/pool/job/' + encodeURIComponent(id) + q({ region }), { patch }),
    jobsNear: (lat, lng, opts) => _req('GET', '/pool/jobs/near' + q({ lat, lng, ...(opts || {}) })),           // opts: {radius,status,win,limit,region}
    workersNear: (lat, lng, opts) => _req('GET', '/pool/workers/near' + q({ lat, lng, ...(opts || {}) })),     // opts: {radius,available,skill,region}

    // ── tier ราคาต่อสาย ──
    pricing: (vertical) => _req('GET', '/pricing' + q({ vertical })),
    resolveTier: (vertical, tier) => _req('GET', '/pricing/resolve' + q({ vertical, tier })),

    // ── REALTIME (WebSocket) · auto-reconnect · fallback poll ถ้า /ws ไม่พร้อม · คืน fn ปิด ──
    connectRealtime(biz, onMsg, opts) {
      const pollMs = (opts && opts.pollMs) || 4000;
      let ws = null, closed = false, tries = 0, pingT = null, reT = null, pollT = null, usedPoll = false;
      const wsUrl = () => base().replace(/^http/i, 'ws') + '/ws' + q({ biz });
      const clearPing = () => { if (pingT) { clearInterval(pingT); pingT = null; } };
      const startPoll = () => { if (pollT || closed) return; usedPoll = true; let since = Date.now(); pollT = setInterval(async () => { try { const r = await PLAT_API.getDocs(biz); onMsg({ type: 'poll', docs: r.docs, since }); since = Date.now(); } catch (e) {} }, pollMs); };
      const open = () => { if (closed) return;
        try { ws = new WebSocket(wsUrl()); } catch (e) { startPoll(); return; }
        ws.onopen = () => { tries = 0; if (pollT) { clearInterval(pollT); pollT = null; usedPoll = false; } clearPing(); pingT = setInterval(() => { try { if (ws.readyState === 1) ws.send('ping'); } catch (_) {} }, 25000); };
        ws.onmessage = (e) => { if (e.data === 'pong' || e.data === 'ping') return; try { onMsg(JSON.parse(e.data)); } catch (_) {} };
        ws.onclose = (e) => { clearPing(); if (e && e.code === 1011) { startPoll(); return; } retry(); };
        ws.onerror = () => { try { ws && ws.close(); } catch (_) {} if (tries >= 2) startPoll(); };
      };
      const retry = () => { if (closed || usedPoll) return; clearPing(); tries = Math.min(tries + 1, 6); if (reT) clearTimeout(reT); reT = setTimeout(open, 700 * tries); };
      open();
      return () => { closed = true; clearPing(); if (reT) clearTimeout(reT); if (pollT) clearInterval(pollT); try { ws && ws.close(); } catch (_) {} };
    },
  };

  // ── PlatSync.attach — glue ทำให้ data module เดิม (load/save blob) sync ข้ามเครื่องด้วยโค้ดไม่กี่บรรทัด ──
  //   opts = {
  //     biz,                     // id ของ tenant (เช่น shopId ของยิม / marketId / sponsorId · 'platform' สำหรับ wallet/stats/control)
  //     type,                    // market|fitness|sponsor|laborwin|platform  (ใช้ตอน auto-register)
  //     key,                     // doc key เช่น 'fitness' | 'market' | 'laborwin' | 'wallet'
  //     name,                    // ชื่อร้าน (optional · เก็บใน tenant registry)
  //     read:  () => blob,       // อ่าน state ปัจจุบันจาก localStorage
  //     write: (blob) => {},     // เขียน state ลง localStorage (ไม่ต้อง push กลับ)
  //     onRemote: (blob) => {},  // callback ให้ UI re-render เมื่อได้ของใหม่จากเครื่องอื่น
  //     stamp: (blob) => number, // (optional) ดึง timestamp จาก blob เพื่อเทียบ local vs remote (default ใช้ rev)
  //   }
  //   คืน { push, pull, stop } — เรียก push() ทุกครั้งหลัง save local
  function attach(opts) {
    const { biz, type, key: docKey, name, read, write, onRemote, stamp } = opts;
    if (!biz || !docKey) { console.warn('[PlatSync] biz + key จำเป็น'); return { push() {}, pull() {}, stop() {} }; }
    let rev = 0, busy = false, pending = false, stop = () => {};

    async function pull() {
      try {
        const r = await PLAT_API.getDoc(biz, docKey);
        if (r && r.exists && r.data != null) {
          rev = r.rev;
          const local = read();
          const lt = stamp && local ? stamp(local) : -1;
          const rt = stamp && r.data ? stamp(r.data) : r.updatedAt;
          // remote ใหม่กว่า (หรือไม่มี stamp = เชื่อ remote ตอน load) → adopt
          if (!stamp || rt >= lt) { write(r.data); onRemote && onRemote(r.data); }
          else { await push(true); } // local ใหม่กว่า → ดันขึ้น
        } else {
          rev = 0; await push(true); // ยังไม่มีบน server → ดัน local ขึ้นเป็นก้อนแรก
        }
      } catch (e) { /* ออฟไลน์ = ใช้ local ต่อได้ */ }
    }

    async function push(force) {
      if (busy) { pending = true; return; }
      busy = true;
      try {
        const data = read(); if (data == null) return;
        const r = await PLAT_API.putDoc(biz, docKey, data, { baseRev: force ? undefined : rev, type, name });
        if (r.status === 409 && r.conflict) {           // มีคนแก้ก่อน → เอาของ server มา แล้ว UI ตัดสินใจ
          rev = r.rev; if (r.data != null) { write(r.data); onRemote && onRemote(r.data); }
        } else if (r.ok) { rev = r.rev; }
      } catch (e) { /* เก็บไว้ retry รอบหน้า */ }
      finally { busy = false; if (pending) { pending = false; setTimeout(() => push(false), 120); } }
    }
    // debounce push
    let pt = null;
    function pushDebounced() { if (pt) clearTimeout(pt); pt = setTimeout(() => push(false), 400); }

    // realtime: doc key นี้เปลี่ยนจากเครื่องอื่น → pull
    stop = PLAT_API.connectRealtime(biz, (m) => {
      if (m.type === 'doc' && m.key === docKey && m.rev !== rev) pull();
      else if (m.type === 'poll' && m.docs && m.docs[docKey] && m.docs[docKey].rev !== rev) pull();
    });
    pull();
    return { push: pushDebounced, pushNow: () => push(false), pull, stop };
  }
  PLAT_API.attach = attach;

  window.PLAT_API = PLAT_API;
})();
