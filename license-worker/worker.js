/*
 * KaiDee POS — License Worker (Cloudflare Workers + KV)
 * เก็บ "วันหมดอายุ/สถานะร้าน" ไว้ที่เซิร์ฟเวอร์ → ลูกค้าแก้ localStorage ในเครื่องไม่มีผล
 *
 * ── ติดตั้ง (ครั้งเดียว) ──
 * 1) Cloudflare Dashboard → Workers & Pages → Create → Worker → วางไฟล์นี้
 * 2) สร้าง KV namespace ชื่อ  KAIDEE_LICENSE  แล้ว Bind เข้า Worker ในชื่อ  LIC
 * 3) ตั้ง Environment Variables (Settings → Variables):
 *      ADMIN_TOKEN = <สุ่มรหัสยาว ๆ เก็บเป็นความลับ ใช้ตอนแอดมินอนุมัติ>
 * 4) Deploy → ได้ URL เช่น https://kaidee-license.<subdomain>.workers.dev
 *    เอา URL นี้ไปใส่ใน kaidee-license.jsx (LICENSE_ENDPOINT)
 *
 * ── โครงข้อมูลใน KV ต่อ 1 ร้าน (key = "shop:<shopId>") ──
 * { plan:"trial"|"monthly"|"yearly", expiry:"2026-08-01T00:00:00.000Z",
 *   status:"active"|"suspended", devices:["id1","id2"], maxDevices:5,
 *   payReqs:[{id,slipUrl,plan,months,amount,ts,status:"pending"|"approved"|"rejected"}] }
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function cors(resp) {
  resp.headers.set('Access-Control-Allow-Origin', '*');
  resp.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  resp.headers.set('Access-Control-Allow-Headers', 'content-type,x-admin-token');
  return resp;
}
const json = (obj, status = 200) => cors(new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS }));
const nowISO = () => new Date().toISOString();
const addDaysISO = (fromISO, days) => { const d = new Date(fromISO && new Date(fromISO) > new Date() ? fromISO : Date.now()); d.setDate(d.getDate() + days); return d.toISOString(); };

async function getShop(env, id) {
  const raw = await env.LIC.get('shop:' + id);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  // ร้านใหม่ที่ยังไม่เคยบันทึก → เริ่ม trial 30 วันอัตโนมัติ
  const fresh = { plan: 'trial', expiry: addDaysISO(null, 30), status: 'active', devices: [], maxDevices: 5, graceDays: 5, payReqs: [], features: {}, created: nowISO() };
  await env.LIC.put('shop:' + id, JSON.stringify(fresh));
  return fresh;
}
const putShop = (env, id, data) => env.LIC.put('shop:' + id, JSON.stringify(data));

function statusOf(shop) {
  const daysLeft = Math.ceil((new Date(shop.expiry) - Date.now()) / 86400000);
  const active = shop.status === 'active' && daysLeft > -1; // หมดอายุแล้วยังนับเป็น active จนถึงสิ้นวัน (gate ฝั่ง client จัดการ grace เอง)
  return { plan: shop.plan, expiry: shop.expiry, status: shop.status, daysLeft, active, maxDevices: shop.maxDevices, graceDays: (shop.graceDays != null ? shop.graceDays : 5), features: shop.features || {}, ts: nowISO() };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean); // e.g. ["shop","S123","status"]

    try {
      // ── GET /shop/:id/status  (แอปเรียกตอนเปิด) ──
      if (request.method === 'GET' && parts[0] === 'shop' && parts[2] === 'status') {
        const shop = await getShop(env, parts[1]);
        const device = url.searchParams.get('device');
        if (device && !shop.devices.includes(device)) {
          // จำกัดจำนวนเครื่อง active พร้อมกัน
          if (shop.devices.length >= (shop.maxDevices || 5)) {
            return json({ ...statusOf(shop), deviceRejected: true, reason: 'device_limit' });
          }
          shop.devices.push(device);
          await putShop(env, parts[1], shop);
        }
        return json(statusOf(shop));
      }

      // ── POST /shop/:id/payreq  (ลูกค้าส่งสลิปโอน) ──
      if (request.method === 'POST' && parts[0] === 'shop' && parts[2] === 'payreq') {
        const body = await request.json().catch(() => ({}));
        const shop = await getShop(env, parts[1]);
        const req = { id: 'pr' + Date.now(), slipUrl: body.slipUrl || '', plan: body.plan || 'monthly', months: body.months || 1, amount: body.amount || 0, note: body.note || '', ts: nowISO(), status: 'pending' };
        shop.payReqs = (shop.payReqs || []).concat(req);
        await putShop(env, parts[1], shop);
        return json({ ok: true, request: req });
      }

      // ── ADMIN endpoints (ต้องมี header x-admin-token ตรงกับ ADMIN_TOKEN) ──
      const adminTok = request.headers.get('x-admin-token');
      const isAdmin = adminTok && env.ADMIN_TOKEN && adminTok === env.ADMIN_TOKEN;

      // GET /admin/pending  → รวมคำขอที่รออนุมัติทุกร้าน (list keys)
      if (request.method === 'GET' && parts[0] === 'admin' && parts[1] === 'pending') {
        if (!isAdmin) return json({ error: 'unauthorized' }, 401);
        const list = await env.LIC.list({ prefix: 'shop:' });
        const out = [];
        for (const k of list.keys) {
          const shop = JSON.parse(await env.LIC.get(k.name) || '{}');
          (shop.payReqs || []).filter(r => r.status === 'pending').forEach(r => out.push({ shopId: k.name.slice(5), ...r }));
        }
        return json({ pending: out });
      }

      // POST /admin/approve  {shopId, reqId, addDays?, expiry?, plan?}  → ต่ออายุ (เขียนที่เซิร์ฟเวอร์)
      if (request.method === 'POST' && parts[0] === 'admin' && parts[1] === 'approve') {
        if (!isAdmin) return json({ error: 'unauthorized' }, 401);
        const b = await request.json().catch(() => ({}));
        const shop = await getShop(env, b.shopId);
        const req = (shop.payReqs || []).find(r => r.id === b.reqId);
        const days = b.addDays || (req ? req.months * 30 : 30);
        shop.expiry = b.expiry || addDaysISO(shop.expiry, days);
        shop.plan = b.plan || (req && req.plan) || (shop.plan === 'trial' ? 'monthly' : shop.plan);
        shop.status = 'active';
        if (req) req.status = 'approved';
        await putShop(env, b.shopId, shop);
        return json({ ok: true, status: statusOf(shop) });
      }

      // POST /admin/set  {shopId, expiry?, plan?, status?, maxDevices?, resetDevices?}  → แก้มือ
      if (request.method === 'POST' && parts[0] === 'admin' && parts[1] === 'set') {
        if (!isAdmin) return json({ error: 'unauthorized' }, 401);
        const b = await request.json().catch(() => ({}));
        const shop = await getShop(env, b.shopId);
        if (b.expiry) shop.expiry = b.expiry;
        if (b.plan) shop.plan = b.plan;
        if (b.status) shop.status = b.status;
        if (b.maxDevices) shop.maxDevices = b.maxDevices;
        if (b.graceDays != null) shop.graceDays = Number(b.graceDays);
        if (b.resetDevices) shop.devices = [];
        await putShop(env, b.shopId, shop);
        return json({ ok: true, status: statusOf(shop) });
      }

      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  }
};
