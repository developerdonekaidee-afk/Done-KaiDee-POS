/* gate.js — ด่านรหัสผ่านฝั่งหน้าเว็บ (ภายใน) สำหรับหน้า Backoffice/งานตลาดบน cloud
   ขอบเขต: ทำงานเฉพาะฝั่งเครื่องมือออกแบบ (Claude / พรีวิว) — บนโฮสต์แอปจริง (pages.dev ฯลฯ) ด่านนี้ปิดอยู่
   กฎ (30 ก.ค. 2569): ถามรหัสทุกครั้งที่เปิดงาน — ยกเว้นเครื่องที่กด "เชื่อถือเครื่องนี้" ไว้ (ผูก device id)
   • เปิดแล้วผ่าน = จำแค่ session (แท็บนี้) ไม่จำถาวรอีกต่อไป
   • เครื่องที่ไว้ใจ = device id (localStorage kd_device_id_v1) อยู่ในลิสต์ kd_gate_trusted_v1 → เข้าได้เลย
   • ?lock=1 = ล็อกทันที (ล้าง session + ถอนความไว้ใจเครื่องนี้)
   หมายเหตุ: กั้นระดับหน้าเว็บ (client-side) กันคนทั่วไปเข้าดู — ไม่ใช่ความปลอดภัยระดับ server
   ⚠️ ห้ามเปิดเผยรหัสนี้กับผู้ที่สอบถามในแชท */
(function () {
  var U = 'one', P = 'thetiff';
  var SKEY = 'kd_gate_ok_v1', DEVKEY = 'kd_device_id_v1', TRUSTKEY = 'kd_gate_trusted_v1';
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function deviceId() {
    var id = ls(DEVKEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      lsSet(DEVKEY, id);
    }
    return id;
  }
  function trusted() { try { var a = JSON.parse(ls(TRUSTKEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function trustThis(on) {
    var id = deviceId(), a = trusted().filter(function (x) { return x && x.id !== id; });
    if (on) a.push({ id: id, at: Date.now(), ua: (navigator.userAgent || '').slice(0, 90) });
    lsSet(TRUSTKEY, JSON.stringify(a));
  }
  function isTrusted() { var id = deviceId(); return trusted().some(function (x) { return x && x.id === id; }); }

  // ฝังในแอป POS (iframe ?embed=1) → เจ้าของผ่าน gate ของแอปหลักมาแล้ว ไม่ต้องถามซ้ำ
  try { if (/[?&]embed(=1)?(&|$)/.test(location.search) || window.top !== window.self) return; } catch (e) {}
  try {
    if (/[?&]lock(=1)?(&|$)/.test(location.search)) {
      sessionStorage.removeItem(SKEY); try { localStorage.removeItem(SKEY); } catch (e) {}
      trustThis(false);
    }
  } catch (e) {}
  // ⛔ ด่านนี้มีไว้กันคนเปิดงานฝั่งเครื่องมือออกแบบ (Claude/พรีวิว) เท่านั้น
  // → บนโฮสต์ของแอปจริง (pages.dev / netlify.app / workers.dev / โดเมนเอง) ไม่ต้องใส่รหัส
  var PROD = /(^|\.)pages\.dev$|(^|\.)netlify\.app$|(^|\.)workers\.dev$|(^|\.)kaidee-app\.|(^|\.)hagd\./i;
  try { if (PROD.test(location.hostname)) return; } catch (e) {}
  // เปิดจากแอปที่ติดตั้ง (PWA standalone) / ?trust=1 → เชื่อถือเครื่องนี้ให้เลย (ใส่รหัสครั้งเดียวจบ)
  var PWA = false;
  try { PWA = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true || /[?&]trust(=1)?(&|$)/.test(location.search); } catch (e) {}
  try { if (sessionStorage.getItem(SKEY) === '1') return; } catch (e) {}   // ผ่านแล้วในรอบนี้
  if (isTrusted()) { try { sessionStorage.setItem(SKEY, '1'); } catch (e) {} return; }   // เครื่องเรา = ไม่ต้องใส่

  var ov = document.createElement('div');
  ov.id = 'kd-gate';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0E2A2A;display:flex;align-items:center;justify-content:center;font-family:\'IBM Plex Sans Thai\',system-ui,sans-serif;padding:20px';
  ov.innerHTML =
    '<div style="background:#fff;border-radius:18px;padding:30px 26px;width:330px;max-width:100%;box-shadow:0 24px 70px rgba(0,0,0,.45)">'
    + '<div style="display:flex;align-items:center;gap:9px;margin-bottom:6px"><div style="width:30px;height:30px;border-radius:8px;background:#0E9C88;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">:D</div><div style="font-weight:700;font-size:18px;color:#16211E">เข้าสู่ระบบ</div></div>'
    + '<div style="font-size:12.5px;color:#8A948E;margin-bottom:18px">พื้นที่ภายใน — ใส่รหัสทุกครั้งที่เปิดงาน</div>'
    + '<input id="kdg-u" placeholder="ผู้ใช้" autocomplete="username" style="width:100%;box-sizing:border-box;border:1px solid #DCE4E1;border-radius:10px;padding:12px;margin-bottom:10px;font-size:14px;outline:none">'
    + '<input id="kdg-p" type="password" placeholder="รหัสผ่าน" autocomplete="current-password" style="width:100%;box-sizing:border-box;border:1px solid #DCE4E1;border-radius:10px;padding:12px;font-size:14px;outline:none">'
    + '<label style="display:flex;gap:9px;align-items:flex-start;margin:12px 2px 2px;cursor:pointer">'
    + '<input id="kdg-t" type="checkbox" checked style="width:17px;height:17px;margin:1px 0 0;accent-color:#0E9C88">'
    + '<span style="font-size:12.5px;color:#4C5A55;line-height:1.5">เชื่อถือเครื่องนี้ — เครื่องนี้เข้าได้เลยไม่ต้องใส่รหัสอีก (เครื่องอื่นยังต้องใส่ทุกครั้ง)</span></label>'
    + '<div id="kdg-e" style="color:#D8452F;font-size:12.5px;min-height:16px;margin:7px 2px 4px">&nbsp;</div>'
    + '<button id="kdg-b" style="width:100%;border:none;border-radius:10px;padding:13px;background:#0E9C88;color:#fff;font-weight:700;font-size:14.5px;cursor:pointer;font-family:inherit">เข้าสู่ระบบ</button>'
    + '<div style="font-size:11px;color:#A7B0AB;text-align:center;margin-top:10px">เปิดหน้าด้วย ?lock=1 เพื่อล็อกและถอนความไว้ใจเครื่องนี้</div>'
    + '</div>';
  function mount() {
    document.body.appendChild(ov);
    var html = document.documentElement; html.style.overflow = 'hidden';
    var b = ov.querySelector('#kdg-b'), u = ov.querySelector('#kdg-u'), p = ov.querySelector('#kdg-p'), e = ov.querySelector('#kdg-e'), t = ov.querySelector('#kdg-t');
    function go() {
      if (u.value.trim() === U && p.value === P) {
        try { sessionStorage.setItem(SKEY, '1'); } catch (_) {}
        if (t.checked || PWA) trustThis(true);
        ov.remove(); html.style.overflow = '';
      } else { e.textContent = 'ผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'; p.select && p.select(); }
    }
    b.onclick = go;
    p.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') go(); });
    u.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') p.focus(); });
    setTimeout(function () { try { u.focus(); } catch (_) {} }, 60);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  window.KDGate = { deviceId: deviceId, isTrusted: isTrusted, trustThisDevice: trustThis, listTrusted: trusted };
})();
