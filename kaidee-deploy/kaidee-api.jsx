// kaidee-api.jsx — client เชื่อม backend จริง (Cloudflare Worker) — MULTI-TENANT
// ┌──────────────────────────────────────────────────────────────────┐
// │  URL ของ backend — แก้ได้จากหน้า ตั้งค่า → API/เซิร์ฟเวอร์ (ไม่ต้อง deploy)  │
// │  ไม่ตั้งค่า = ใช้ค่า default ด้านล่าง (Worker ปัจจุบัน)                        │
// └──────────────────────────────────────────────────────────────────┘
const KD_API_DEFAULT = 'https://kaidee-pos.oneday-pos.workers.dev';
function kdApiBase(){ try{ const o=(localStorage.getItem('kd_api_base')||'').trim().replace(/\/$/,''); return o || KD_API_DEFAULT; }catch(e){ return KD_API_DEFAULT; } }
function kdApiKey(){ try{ return localStorage.getItem('kd_api_key')||''; }catch(e){ return ''; } }
let KD_API_BASE = kdApiBase();
const KD_LIVE = !!KD_API_BASE;

// ร้าน (tenant): อ่านจาก ?shop=<id> บน URL — Rich menu ของแต่ละร้านจะใส่ ?shop=<id> มา
// ค่าเริ่มต้น 'kaidee' (ร้านตัวอย่าง) เมื่อเปิดตรง ๆ ไม่มีพารามิเตอร์
function kdShopId() {
  try {
    const u = new URL(location.href);
    // รองรับ ?shop= และ liff.state ที่ LINE ห่อมา (?liff.state=%3Fshop%3Dxxx)
    let s = u.searchParams.get('shop');
    if (!s) {
      const st = u.searchParams.get('liff.state');
      if (st) { try { s = new URLSearchParams(st.replace(/^\?/, '')).get('shop'); } catch (e) {} }
    }
    return s || localStorage.getItem('kd_shop') || 'kaidee';
  } catch (e) { return 'kaidee'; }
}
let KD_SHOP = kdShopId();
// เขียนลงเครื่องเฉพาะเมื่อรู้ร้านจริง — ห้ามเขียนค่า fallback 'kaidee' ลงไปเอง
// (ไม่งั้นเครื่องใหม่จะถูกนับว่า "มีร้านแล้ว" แล้วข้ามหน้า "สมัครใช้งาน · เลือกระบบ" ไปเลย)
try { if (KD_SHOP !== 'kaidee' || localStorage.getItem('kd_shop')) localStorage.setItem('kd_shop', KD_SHOP); } catch (e) {}

function _withShop(path, method) {
  // แนบ ?shop= ให้ GET/DELETE (body จะแนบ shopId แทนใน POST/PATCH)
  if (method === 'GET' || method === 'DELETE') {
    return path + (path.includes('?') ? '&' : '?') + 'shop=' + encodeURIComponent(KD_SHOP);
  }
  return path;
}
async function _req(method, path, bodyObj, scoped = true) {
  const url = kdApiBase() + (scoped ? _withShop(path, method) : path);
  const body = bodyObj ? { ...bodyObj, ...(scoped ? { shopId: KD_SHOP } : {}) } : null;
  const key = kdApiKey();
  const headers = { 'X-Shop': KD_SHOP };
  if (body) headers['content-type'] = 'application/json';
  if (key) { headers['x-api-key'] = key; headers['Authorization'] = 'Bearer ' + key; }
  const r = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
function qs(o) {
  const p = Object.entries(o).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => k + '=' + encodeURIComponent(v));
  return p.length ? '?' + p.join('&') : '';
}

const KD_API = {
  base: KD_API_BASE,
  live: KD_LIVE,
  get shopId() { return KD_SHOP; },
  setShop(id) { KD_SHOP = id; try { localStorage.setItem('kd_shop', id); } catch (e) {} },
  // ── config endpoint (API Gateway/Worker) — แก้จากหน้าตั้งค่า ──
  getConfig() { let hasOv=false; try{ hasOv=!!(localStorage.getItem('kd_api_base')||'').trim(); }catch(e){} return { base: kdApiBase(), key: kdApiKey(), isDefault: !hasOv, default: KD_API_DEFAULT }; },
  setEndpoint(url, key) { try { if (url != null) localStorage.setItem('kd_api_base', (url || '').trim().replace(/\/$/, '')); if (key != null) localStorage.setItem('kd_api_key', key || ''); } catch (e) {} KD_API_BASE = kdApiBase(); this.base = KD_API_BASE; },
  async ping() { const r = await fetch(kdApiBase() + '/brand', { headers: kdApiKey() ? { 'x-api-key': kdApiKey(), 'Authorization': 'Bearer ' + kdApiKey() } : {} }); return { ok: r.ok, status: r.status }; },

  // ── tenant (ร้าน) — ไม่ผูก shop scope ── 
  registerShop: (info)   => _req('POST', '/shops', info, false),
  welcomeShop:  (info)   => _req('POST', '/shops/welcome', info, false),
  getShop:      (id)     => _req('GET', '/shops/' + (id || KD_SHOP), null, false),
  // มีร้านนี้อยู่ไหม → true=มี · false=ถูกลบ (404) · null=ไม่แน่ใจ/ออฟไลน์ (แยก 404 ออกจาก network error ให้ชัด)
  shopExists: async (id) => { try{ const r = await fetch(kdApiBase()+'/shops/'+encodeURIComponent(id||KD_SHOP)); if(r.status===404) return false; if(!r.ok) return null; const t=await r.text(); const j=t?JSON.parse(t):null; return !!(j&&(j.id||j.shopId)); }catch(e){ return null; } },
  updateShop:   (id, p)  => _req('PATCH', '/shops/' + (id || KD_SHOP), p, false),
  // ล้างข้อมูลร้าน (เจ้าของร้านล้างเองจากในแอป — ยืนยันด้วย ownerLine) · {wipeMenu, ownerLine}
  resetShop:    (id, b)  => _req('POST', '/shops/' + (id || KD_SHOP) + '/reset', b || {}, false),
  // โควตาทดลองข้ามเครื่อง (กันลบร้าน+ล้างเบราว์เซอร์แล้วสมัครฟรีวน) · หลักฐานการลบถาวร
  trialCheck:   (phone, line) => _req('GET', '/trial-check?phone=' + encodeURIComponent(phone || '') + '&line=' + encodeURIComponent(line || ''), null, false),
  trialConsume: (phone, line) => _req('POST', '/trial-consume', { phone, line }, false),
  listDeletionLog: ()    => _req('GET', '/deletion-log', null, false),
  listShops:    ()       => _req('GET', '/shops', null, false),
  // หา "ร้านของฉัน" จาก LINE userId ของเจ้าของ (กันเคสข้ามเครื่อง — localStorage ว่าง)
  getMyShop:    (lineId) => _req('GET', '/shops/by-owner?line=' + encodeURIComponent(lineId || ''), null, false),
  // ร้านทั้งหมดในตลาด/พื้นที่เดียวกัน (หน้า "ร้านในตลาดนี้" ฝั่งลูกค้า)
  getShopsByMarket: (market) => _req('GET', '/shops/by-market?market=' + encodeURIComponent(market || ''), null, false),
  getShopsDirectory: () => _req('GET', '/shops/directory', null, false),
  // จัดการแพ็กเกจ (แอดมิน): {plan, status, addDays} หรือ {expiry}
  setShopPlan:  (id, p)  => _req('PATCH', '/shops/' + id + '/plan', p, false),
  registerDevice: (id, deviceId) => _req('POST', '/shops/' + id + '/device', { deviceId }, false),
  getBrand:  ()  => _req('GET', '/brand', null, false),
  putBrand:  (b) => _req('PUT', '/brand', b, false),
  getPackages: () => _req('GET', '/packages', null, false),
  // คำขอชำระเงิน (manual billing)
  createPayRequest:  (info)      => _req('POST', '/pay-requests', info, false),
  listPayRequests:   (status)    => _req('GET', '/pay-requests' + (status ? '?status=' + status : ''), null, false),
  handlePayRequest:  (id, patch) => _req('PATCH', '/pay-requests/' + id, patch, false),
  // คำขอรหัส Office (เปิดวันย้อนหลัง) — ร้านขอ · Back Office ออกรหัส
  createCodeRequest: (info)      => _req('POST', '/code-requests', info, false),
  listCodeRequests:  (q)         => _req('GET', '/code-requests' + (q ? '?' + Object.entries(q).filter(e=>e[1]!=null&&e[1]!=='').map(e=>e[0]+'='+encodeURIComponent(e[1])).join('&') : ''), null, false),
  issueCodeRequest:  (id, patch) => _req('PATCH', '/code-requests/' + id, patch, false),
  verifyOfficeCode:  (shopId, code) => _req('POST', '/code-requests/verify', { shopId, code }, false),

  // ── ข้อมูลร้าน (ผูก shopId อัตโนมัติ) ──
  getMenu:        ()        => _req('GET', '/menu'),
  saveMenuItem:   (item)    => _req('POST', '/menu', item),
  deleteMenuItem: (id)      => _req('DELETE', '/menu/' + id),
  // ── โปร/คูปองที่ร้านสร้างเอง ──
  listPromos:     ()        => _req('GET', '/promos'),
  savePromo:      (p)       => _req('POST', '/promos', p),
  deletePromo:    (id)      => _req('DELETE', '/promos/' + id),
  // ถามเซิร์ฟเวอร์ว่าตะกร้านี้ใช้โปรอะไรได้บ้าง ลดเท่าไหร่ (ยอดจริงคิดซ้ำอีกครั้งตอนสร้างออเดอร์)
  quotePromos:    (cart)    => _req('POST', '/promos/quote', cart),
  listOrders:     (q = {})  => _req('GET', '/orders' + qs(q)),
  getOrder:       (id)      => _req('GET', '/orders/' + id),
  createOrder:    (payload) => _req('POST', '/orders', payload),
  patchOrder:     (id, p)   => _req('PATCH', '/orders/' + id, p),
  uploadSlip:     (id, img) => _req('POST', '/orders/' + id + '/slip', { image: img }),
  // จับคู่ยอดเงินเข้าอัตโนมัติ + ผูกกลุ่ม LINE
  bankAlert:      (text)    => _req('POST', '/bank-alert', { text }),
  linePairCode:   ()        => _req('POST', '/line-pair/code', {}),
  linePairStatus: ()        => _req('GET', '/line-pair'),
  // บิลหน้าขาย POS (แยกตาราง sales บน D1)
  createSale:     (s)       => _req('POST', '/sales', s),
  listSales:      (q = {})  => _req('GET', '/sales' + qs(q)),
  patchSale:      (id, p)   => _req('PATCH', '/sales/' + id, p),
  deleteSale:     (id)      => _req('DELETE', '/sales/' + id),
  getMember:      (id)      => _req('GET', '/members/' + id),
  listMembers:    ()        => _req('GET', '/members'),
  putMember:      (m)       => _req('POST', '/members', m),
  patchMember:    (id, p)   => _req('PATCH', '/members/' + id, p),
  payQR:          (amount)  => _req('GET', '/pay/qr' + qs({ amount })),
  createRefund:   (r)       => _req('POST', '/refunds', r),
  listRefunds:    (status)  => _req('GET', '/refunds' + (status?qs({ status }):'')),
  patchRefund:    (id, p)   => _req('PATCH', '/refunds/' + id, p),
  // ── REALTIME (WebSocket) — push สดเปิด-ปิดร้าน/สิทธิ์/ออเดอร์ · auto-reconnect · คืน fn ปิด ──
  connectRealtime(onMsg){
    let ws=null, closed=false, tries=0, pingT=null, reT=null;
    const wsUrl=()=> kdApiBase().replace(/^http/i,'ws') + '/ws?shop=' + encodeURIComponent(KD_SHOP);
    const clearPing=()=>{ if(pingT){ clearInterval(pingT); pingT=null; } };
    const open=()=>{ if(closed) return;
      try{ ws=new WebSocket(wsUrl()); }catch(e){ retry(); return; }
      ws.onopen=()=>{ tries=0; clearPing(); pingT=setInterval(()=>{ try{ if(ws.readyState===1) ws.send('ping'); }catch(_){} },25000); };
      ws.onmessage=(e)=>{ if(e.data==='pong'||e.data==='ping') return; try{ onMsg(JSON.parse(e.data)); }catch(_){} };
      ws.onclose=()=>{ clearPing(); retry(); };
      ws.onerror=()=>{ try{ ws&&ws.close(); }catch(_){} };
    };
    const retry=()=>{ if(closed) return; clearPing(); tries=Math.min(tries+1,6); if(reT) clearTimeout(reT); reT=setTimeout(open, 700*tries); };
    open();
    return ()=>{ closed=true; clearPing(); if(reT) clearTimeout(reT); try{ ws&&ws.close(); }catch(_){} };
  },
  // ── DELIVERY SETTLEMENT (กระทบยอดเดลิเวอรี · Expected vs Actual) ──
  listDeliverySettlement:   (q={}) => _req('GET', '/delivery-settlement' + qs(q)),
  deliverySettlementSummary:(q={}) => _req('GET', '/delivery-settlement/summary' + qs(q)),
  saveDeliverySettlement:   (b)    => _req('POST', '/delivery-settlement', b),

  // ── สต๊อก / เงินสด / ใบเสนอราคา / ตั้งค่า (ของใหม่) ──
  getRaw:         ()        => _req('GET', '/raw'),
  putRaw:         (list)    => _req('PUT', '/raw', { raw: list }),
  listPurchases:  ()        => _req('GET', '/purchases'),
  addPurchaseRow: (p)       => _req('POST', '/purchases', p),
  deletePurchase: (id)      => _req('DELETE', '/purchases/' + id),
  listCashDays:   ()        => _req('GET', '/cash-days'),
  addCashDay:     (d)       => _req('POST', '/cash-days', d),
  listQuotes:     ()        => _req('GET', '/quotes'),
  saveQuote:      (q)       => _req('POST', '/quotes', q),
  deleteQuote:    (id)      => _req('DELETE', '/quotes/' + id),
  getSettings:    ()        => _req('GET', '/settings'),
  putSettings:    (s)       => _req('PUT', '/settings', s),
  // ── INVENTORY TRANSACTIONS (movement + Running Balance) ──
  listInvTx:      (q={})    => _req('GET', '/inv-tx' + qs(q)),
  recordInvTx:    (t)       => _req('POST', '/inv-tx', t),   // t เดี่ยว หรือ { batch:[...] }
  // ── CONSIGNMENT (ขายฝาก): vendors · locations · stock · ops · documents ──
  listVendors:    ()        => _req('GET', '/vendors'),
  saveVendor:     (v)       => _req('POST', '/vendors', v),
  deleteVendor:   (id)      => _req('DELETE', '/vendors/' + id),
  listLocations:  ()        => _req('GET', '/locations'),
  saveLocation:   (l)       => _req('POST', '/locations', l),
  deleteLocation: (id)      => _req('DELETE', '/locations/' + id),
  listConsignStock:(q={})   => _req('GET', '/consignment-stock' + qs(q)),
  saveConsignStock:(c)      => _req('POST', '/consignment-stock', c),
  deleteConsignStock:(id)   => _req('DELETE', '/consignment-stock/' + id),
  consignSale:    (b)       => _req('POST', '/consignment/sale', b),
  consignReceive: (b)       => _req('POST', '/consignment/receive', b),
  consignReturn:  (b)       => _req('POST', '/consignment/return', b),
  consignTransfer:(b)       => _req('POST', '/consignment/transfer', b),
  consignStocktake:(b)      => _req('POST', '/consignment/stocktake', b),
  consignSettle:  (b)       => _req('POST', '/consignment/settle', b),
  createDeliveryNote:(b)    => _req('POST', '/consignment/delivery-note', b),
  confirmDeliveryNote:(id)  => _req('POST', '/consignment/delivery-note/' + id + '/confirm', {}),
  listConsignDocs:(q={})    => _req('GET', '/consignment/documents' + qs(q)),
  patchConsignDoc:(id,p)    => _req('PATCH', '/consignment/documents/' + id, p),
  // ── OWNER (Backoffice) — ยืนยันตัวตนเจ้าของร้าน + ดึงข้อมูลรายงาน (ล็อกฝั่ง server) ──
  ownerLogin:  (id, body)   => _req('POST', '/shops/' + (id || KD_SHOP) + '/owner-login', body, false),
  ownerVerify: (id, token)  => _req('POST', '/shops/' + (id || KD_SHOP) + '/owner-verify', { token }, false),
  ownerSetPin: (id, body)   => _req('POST', '/shops/' + (id || KD_SHOP) + '/owner-pin', body, false),
  // แอดมินแอป (app owner) สวมเข้า Backoffice ร้านใดก็ได้ + เก็บ access log (PDPA)
  adminAccessShop: (id, adminToken) => _req('POST', '/shops/' + id + '/admin-access', { token: adminToken, by: 'admin' }, false),
  adminAccessLog:  (id, adminToken) => _req('GET', '/shops/' + id + '/admin-access-log?token=' + encodeURIComponent(adminToken||''), null, false),
  async reportData(id, token, range) {
    const sh = id || KD_SHOP;
    const p = Object.entries(range || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => k + '=' + encodeURIComponent(v));
    p.push('shop=' + encodeURIComponent(sh));
    const r = await fetch(kdApiBase() + '/reports/data?' + p.join('&'), { headers: { 'X-Owner-Token': token, 'X-Shop': sh } });
    if (!r.ok) throw new Error('reports ' + r.status);
    return r.json();
  },
};

Object.assign(window, { KD_API, KD_API_BASE, KD_LIVE, KD_SHOP, kdShopId });

// ── โมดูลของร้านตามแพ็กเกจ ── (ทดลอง/ไม่จ่าย = เปิดครบ · จ่ายแล้ว = จับแพ็กจาก seats → modules)
function kdShopModules(shop, pkgCache){
  const ALL = { lineOrder:true, delivery:true, reports:true, stock:true };
  if(!shop) return ALL;
  const paid = shop.plan && shop.plan !== 'trial';
  if(!paid) return ALL;                                  // ทดลองฟรี = เปิดครบทุกโมดูล
  const list = (pkgCache && Array.isArray(pkgCache.packages)) ? pkgCache.packages : null;
  if(!list || !list.length) return ALL;
  const seats = Number(shop.seats) || 1;
  const pk = list.find(p => Number(p.seats) === seats) || list[0];
  const m = (pk && pk.modules) || {};
  return { orders:m.orders!==false, delivery:m.delivery!==false, reports:m.reports!==false, stock:m.stock!==false };
}
// ── ขายฝากเป็น add-on แยก ── (ทดลอง=เปิด · จ่ายแล้ว=เปิดเมื่อซื้อ add-on หรือแพ็กบันเดิลไว้)
function kdConsignEnabled(shop, pkgCache){
  try{ if(localStorage.getItem('kd_consign_open')==='0') return false; }catch(e){}
  if(!shop) return true;
  const paid = shop.plan && shop.plan !== 'trial';
  if(!paid) return true;                                 // ทดลองฟรี = เปิดให้ลอง
  if(shop.addons && shop.addons.consign) return true;    // ซื้อ add-on แล้ว
  const list = (pkgCache && Array.isArray(pkgCache.packages)) ? pkgCache.packages : null;
  if(list && list.length){ const seats=Number(shop.seats)||1; const pk=list.find(p=>Number(p.seats)===seats)||list[0]; if(pk&&pk.consign) return true; }
  return true;   // ⭐ เปิดเต็ม (demo/รุ่นเปิดใช้) — เปลี่ยนเป็น false เพื่อ gate ขายฝากตามแพ็กจริง · ปิดเฉพาะเครื่องได้ด้วย localStorage kd_consign_open='0'
}
Object.assign(window, { kdShopModules, kdConsignEnabled });
