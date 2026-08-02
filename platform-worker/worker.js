/**
 * platform-worker.js — Backend เดียวสำหรับ ตลาด · ฟิตเนส · สปอนเซอร์ · Labor Win · แพลตฟอร์ม
 * (Cloudflare Worker + D1 + Durable Object) — MULTI-TENANT · ตามแพทเทิร์น KaiDee POS
 *
 * แนวคิด: ทุกแอปในระบบเก็บ state เป็น JSON blob ก้อนเดียวอยู่แล้ว (kd_fitness_v1, kd_market_v3,
 * kd_laborwin_v1, kd_sponsor_*, kd_platform_*). Backend นี้ = "document sync store" ราย tenant
 * → ดึง/ดันทั้งก้อนข้ามเครื่องได้ทันที + push สดผ่าน WebSocket โดยไม่ต้องรื้อ data model เดิม
 *
 * Bindings:  DB (D1, จำเป็น)  ·  BIZ_HUB (Durable Object, สำหรับ realtime — ไม่ผูกก็ได้ fallback poll)
 * Secrets:   ADMIN_SECRET (optional) · ADMIN_PASS (optional, default platform2026) · LINE_TOKEN (optional)
 *
 * scope tenant ผ่าน:  ?biz=<id>  ·  header X-Biz  ·  body.biz
 *   type ของ tenant: market | fitness | sponsor | laborwin | platform
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
function cors(req) {
  const o = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Biz, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
  };
}
const json = (data, req, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...cors(req) } });
const err = (msg, req, status = 400) => json({ error: msg }, req, status);
const now = () => Date.now();
const rid = (p) => (p || 'r') + now().toString(36) + Math.random().toString(36).slice(2, 7);
const safeId = (s) => String(s || '').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 64);

/* ── GPS ระยะทาง (Haversine, กม.) — สำหรับ "งานใกล้ฉัน" ── */
function distKm(a1, o1, a2, o2) {
  const R = 6371, toR = Math.PI / 180;
  const dLa = (a2 - a1) * toR, dLo = (o2 - o1) * toR;
  const s = Math.sin(dLa / 2) ** 2 + Math.cos(a1 * toR) * Math.cos(a2 * toR) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/* ── records helper (reuse ตาราง records สำหรับ market members / worker pool / jobs) ── */
async function collUpsert(env, biz, coll, rec) {
  const id = safeId(rec.id || rid(coll.slice(0, 2)));
  const t = now();
  const ex = await env.DB.prepare('SELECT created_at FROM records WHERE biz_id=? AND coll=? AND id=?').bind(biz, coll, id).first();
  const created = ex ? ex.created_at : t;
  const clean = { ...rec }; delete clean.id; delete clean.biz; delete clean.bizId;
  await env.DB.prepare(`INSERT INTO records (biz_id,coll,id,data,created_at,updated_at,deleted) VALUES (?,?,?,?,?,?,0)
    ON CONFLICT(biz_id,coll,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, deleted=0`)
    .bind(biz, coll, id, JSON.stringify(clean), created, t).run();
  return { id, createdAt: created, updatedAt: t, existed: !!ex };
}
async function collList(env, biz, coll, since = 0, limit = 2000) {
  const { results } = await env.DB.prepare('SELECT * FROM records WHERE biz_id=? AND coll=? AND updated_at>? AND deleted=0 ORDER BY updated_at DESC LIMIT ?')
    .bind(biz, coll, since, Math.min(limit, 5000)).all();
  return results.map(r => { let d = {}; try { d = JSON.parse(r.data || '{}'); } catch (e) {} return { ...d, id: r.id, _createdAt: r.created_at, _updatedAt: r.updated_at }; });
}

/* ── tier ราคาต่อสาย (default · override ได้จาก platform doc 'pricing') ── */
const PRICING_DEFAULT = {
  pos:      { name: 'ร้านค้า POS', tiers: [ { id: 'free', name: 'ทดลองใช้ฟรี', price: 0, period: 'เดือนแรก' }, { id: 'lite', name: 'Lite', price: 99, period: 'เดือน' }, { id: 'std', name: 'Standard', price: 299, period: 'เดือน' }, { id: 'pro', name: 'Pro', price: 599, period: 'เดือน' } ] },
  market:   { name: 'ตลาด', tiers: [ { id: 's', name: 'Starter', price: 990, period: 'เดือน' }, { id: 'm', name: 'Growth', price: 2900, period: 'เดือน' }, { id: 'l', name: 'Premium', price: 5900, period: 'เดือน' } ] },
  fitness:  { name: 'ฟิตเนส', tiers: [ { id: 'free', name: 'ทดลองใช้ฟรี', price: 0, period: 'เดือนแรก' }, { id: 'std', name: 'Standard', price: 590, period: 'เดือน' }, { id: 'pro', name: 'Pro', price: 1290, period: 'เดือน' } ] },
  laborwin: { name: 'Labor Win (วิน)', tiers: [ { id: 'free', name: 'ทดลองใช้ฟรี', price: 0, period: 'เดือนแรก' }, { id: 'lite', name: 'Lite', price: 99, period: 'เดือน' }, { id: 'std', name: 'Standard', price: 299, period: 'เดือน' } ] },
  sponsor:  { name: 'สปอนเซอร์', tiers: [ { id: 's', name: 'Starter', price: 990, period: 'เดือน' }, { id: 'g', name: 'Growth', price: 2900, period: 'เดือน' }, { id: 'p', name: 'Premium', price: 5900, period: 'เดือน' } ] },
};
async function pricingOverride(env) {
  try { const r = await env.DB.prepare("SELECT data FROM docs WHERE biz_id='platform' AND doc_key='pricing'").first();
    if (r && r.data) return JSON.parse(r.data) || {}; } catch (e) {}
  return {};
}

/* ── PromptPay QR payload (EMVCo) — reuse จาก KaiDee ── */
function ppField(id, val) { return id + String(val.length).padStart(2, '0') + val; }
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}
function promptpayPayload(id, amount) {
  id = String(id || '').replace(/[^0-9]/g, '');
  if (!id) return null;
  const acc = id.length === 13 ? ppField('02', id) : ppField('01', '0066' + id.replace(/^0/, ''));
  const merchant = ppField('00', 'A000000677010111') + acc;
  let p = ppField('00', '01') + ppField('01', amount ? '12' : '11') +
    ppField('29', merchant) + ppField('53', '764') + ppField('58', 'TH');
  if (amount) p += ppField('54', Number(amount).toFixed(2));
  p += '6304';
  return p + crc16(p);
}

/* ── LINE push (optional) ── */
async function linePush(env, to, messages) {
  if (!env.LINE_TOKEN || !to) return false;
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + env.LINE_TOKEN },
      body: JSON.stringify({ to, messages }),
    });
    return r.ok;
  } catch (e) { return false; }
}

/* ── admin auth (HMAC token, shared ข้ามเครื่อง) ── */
const te = new TextEncoder();
async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', te.encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function hmac(env, msg) {
  const secret = env.ADMIN_SECRET || 'platform-admin-fallback-secret-v1';
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(msg));
  return [...new Uint8Array(sig)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function getAdminHash(env) {
  try { const r = await env.DB.prepare("SELECT v FROM app_config WHERE k='admin'").first();
    if (r) { const j = JSON.parse(r.v || '{}'); if (j.passHash) return j.passHash; } } catch (e) {}
  return await sha256hex(env.ADMIN_PASS || 'platform2026');
}
async function makeToken(env) { const exp = now() + 12 * 3600e3; return exp + '.' + await hmac(env, 'admin.' + exp); }
async function verifyToken(env, tok) {
  if (!tok) return false;
  const [exp, sig] = String(tok).split('.');
  if (!exp || !sig || now() > +exp) return false;
  return sig === await hmac(env, 'admin.' + exp);
}
function adminTokenFrom(req, url) {
  return req.headers.get('X-Admin-Token') || (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || '';
}

/* ── schema (idempotent · สร้างเองตอนถูกเรียกครั้งแรก) ── */
let _ready = false;
async function ensureSchema(env) {
  if (_ready) return; _ready = true;
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bizes (
      id TEXT PRIMARY KEY, type TEXT, name TEXT, owner_line TEXT, extra TEXT,
      created_at INTEGER, updated_at INTEGER )`).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bizes_type ON bizes(type)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bizes_owner ON bizes(owner_line)').run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS docs (
      biz_id TEXT NOT NULL, doc_key TEXT NOT NULL, data TEXT, rev INTEGER DEFAULT 1,
      updated_at INTEGER, updated_by TEXT, PRIMARY KEY (biz_id, doc_key) )`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS records (
      biz_id TEXT NOT NULL, coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT,
      created_at INTEGER, updated_at INTEGER, deleted INTEGER DEFAULT 0,
      PRIMARY KEY (biz_id, coll, id) )`).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_records ON records(biz_id, coll, updated_at)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS app_config (k TEXT PRIMARY KEY, v TEXT)').run();
  } catch (e) {}
}

/* ── tenant helpers ── */
const rowBiz = (r) => { if (!r) return null; let ex = {}; try { ex = r.extra ? JSON.parse(r.extra) : {}; } catch (e) {}
  return { id: r.id, type: r.type, name: r.name, ownerLine: r.owner_line, ...ex, createdAt: r.created_at, updatedAt: r.updated_at }; };
async function getBiz(env, id) { return rowBiz(await env.DB.prepare('SELECT * FROM bizes WHERE id=?').bind(id).first()); }
// สร้าง tenant ถ้ายังไม่มี (lazy — เขียน doc ครั้งแรกก็พอ ไม่ต้อง register ก่อน)
async function ensureBiz(env, id, type, name, ownerLine) {
  const ex = await getBiz(env, id);
  if (ex) return ex;
  const t = now();
  await env.DB.prepare('INSERT OR IGNORE INTO bizes (id,type,name,owner_line,extra,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .bind(id, type || 'unknown', name || id, ownerLine || null, '{}', t, t).run();
  return await getBiz(env, id);
}

/* ── realtime broadcast (Durable Object BizHub) ── */
async function hubBroadcast(env, biz, msg) {
  if (!env.BIZ_HUB || !biz) return;
  try {
    const stub = env.BIZ_HUB.get(env.BIZ_HUB.idFromName(biz));
    await stub.fetch('https://hub/broadcast', { method: 'POST', body: JSON.stringify(msg) });
  } catch (e) {}
}

export class BizHub {
  constructor(state, env) { this.state = state; this.env = env; this.sockets = new Set(); }
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname.endsWith('/broadcast')) {
      const msg = await req.text();
      for (const ws of [...this.sockets]) { try { ws.send(msg); } catch (e) { this.sockets.delete(ws); } }
      return new Response('ok');
    }
    if ((req.headers.get('Upgrade') || '').toLowerCase() !== 'websocket')
      return new Response('expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    server.accept();
    this.sockets.add(server);
    server.addEventListener('message', (e) => { if (e.data === 'ping') { try { server.send('pong'); } catch (_) {} } });
    const drop = () => { this.sockets.delete(server); };
    server.addEventListener('close', drop);
    server.addEventListener('error', drop);
    return new Response(null, { status: 101, webSocket: client });
  }
}

/* ── router ── */
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const seg = path.split('/').filter(Boolean);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });

    let body = null;
    const readBody = async () => { if (body === null) { try { body = await req.json(); } catch { body = {}; } } return body; };
    const bizFromReq = async () => safeId(url.searchParams.get('biz') || req.headers.get('X-Biz') || (await readBody()).biz || (await readBody()).bizId || '');

    try {
      if (path === '/' || path === '/health')
        return json({ ok: true, service: 'platform', multiTenant: true, realtime: !!env.BIZ_HUB, ts: now() }, req);

      await ensureSchema(env);

      /* ── REALTIME (WebSocket) ── */
      if (seg[0] === 'ws') {
        if (!env.BIZ_HUB) return err('realtime not configured — ผูก Durable Object BIZ_HUB (ดู PLATFORM-DEPLOY.md)', req, 501);
        const biz = safeId(url.searchParams.get('biz') || req.headers.get('X-Biz') || '');
        if (!biz) return err('biz required', req, 400);
        return env.BIZ_HUB.get(env.BIZ_HUB.idFromName(biz)).fetch(req);
      }

      /* ── ADMIN AUTH ── */
      if (seg[0] === 'admin') {
        if (req.method === 'POST' && seg[1] === 'login') {
          const b = await readBody();
          if (await sha256hex(b.pass || '') === await getAdminHash(env)) return json({ ok: true, token: await makeToken(env) }, req);
          return json({ ok: false, error: 'รหัสไม่ถูกต้อง' }, req, 401);
        }
        if (req.method === 'POST' && seg[1] === 'verify')
          return json({ ok: await verifyToken(env, (await readBody()).token) }, req);
        if (req.method === 'POST' && seg[1] === 'password') {
          const b = await readBody();
          const okCur = await sha256hex(b.current || '') === await getAdminHash(env);
          if (!(await verifyToken(env, b.token)) && !okCur) return json({ ok: false, error: 'ไม่มีสิทธิ์' }, req, 403);
          if (!okCur) return json({ ok: false, error: 'รหัสเดิมไม่ถูกต้อง' }, req, 401);
          if ((b.next || '').length < 6) return json({ ok: false, error: 'รหัสใหม่อย่างน้อย 6 ตัว' }, req, 400);
          const v = JSON.stringify({ passHash: await sha256hex(b.next), updatedAt: now() });
          await env.DB.prepare("INSERT INTO app_config (k,v) VALUES ('admin',?) ON CONFLICT(k) DO UPDATE SET v=?").bind(v, v).run();
          return json({ ok: true }, req);
        }
        return err('unknown admin route', req, 404);
      }

      /* ── PromptPay QR ── */
      if (seg[0] === 'pay' && seg[1] === 'qr' && req.method === 'GET') {
        const id = url.searchParams.get('id') || '';
        const amount = url.searchParams.get('amount') || '';
        const payload = promptpayPayload(id, amount ? Number(amount) : 0);
        if (!payload) return err('bad promptpay id', req);
        return json({ payload, id, amount: amount ? Number(amount) : null }, req);
      }

      /* ── TENANT REGISTRY ── */
      if (seg[0] === 'biz') {
        // GET /biz?type=fitness  (admin — รายชื่อ tenant)
        if (req.method === 'GET' && !seg[1]) {
          if (!(await verifyToken(env, adminTokenFrom(req, url)))) return err('admin only', req, 403);
          const type = url.searchParams.get('type');
          const q = type ? env.DB.prepare('SELECT * FROM bizes WHERE type=? ORDER BY updated_at DESC LIMIT 500').bind(type)
                          : env.DB.prepare('SELECT * FROM bizes ORDER BY updated_at DESC LIMIT 500');
          const { results } = await q.all();
          return json({ bizes: results.map(rowBiz) }, req);
        }
        // POST /biz  {bizId/id, type, name, ownerLine}  → register หรือคืนตัวเดิม
        if (req.method === 'POST' && !seg[1]) {
          const b = await readBody();
          const id = safeId(b.bizId || b.id || b.biz);
          if (!id) return err('id required', req);
          const t = now();
          const ex = await getBiz(env, id);
          const extra = JSON.stringify(b.extra || {});
          if (ex) {
            await env.DB.prepare('UPDATE bizes SET type=COALESCE(?,type), name=COALESCE(?,name), owner_line=COALESCE(?,owner_line), updated_at=? WHERE id=?')
              .bind(b.type || null, b.name || null, b.ownerLine || null, t, id).run();
          } else {
            await env.DB.prepare('INSERT INTO bizes (id,type,name,owner_line,extra,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
              .bind(id, b.type || 'unknown', b.name || id, b.ownerLine || null, extra, t, t).run();
          }
          return json({ ok: true, biz: await getBiz(env, id), existed: !!ex }, req, ex ? 200 : 201);
        }
        // GET /biz/:id
        if (req.method === 'GET' && seg[1]) {
          const b = await getBiz(env, safeId(seg[1]));
          return b ? json({ biz: b }, req) : err('not found', req, 404);
        }
        // PATCH /biz/:id  {name, ownerLine, extra{}}
        if (req.method === 'PATCH' && seg[1]) {
          const id = safeId(seg[1]); const b = await readBody();
          const ex = await getBiz(env, id); if (!ex) return err('not found', req, 404);
          const merged = { ...ex, ...(b.extra || {}) };
          delete merged.id; delete merged.type; delete merged.name; delete merged.ownerLine; delete merged.createdAt; delete merged.updatedAt;
          await env.DB.prepare('UPDATE bizes SET name=COALESCE(?,name), owner_line=COALESCE(?,owner_line), extra=?, updated_at=? WHERE id=?')
            .bind(b.name || null, b.ownerLine || null, JSON.stringify(merged), now(), id).run();
          return json({ ok: true, biz: await getBiz(env, id) }, req);
        }
      }

      /* ── MARKET LINK (market_id เชื่อม ตลาด ↔ แม่ค้า/แรงงาน · สมัคร 2 ทาง) ── */
      if (seg[0] === 'market') {
        // GET /market/resolve?code=  → หา market จากโค้ดเชิญ (หรือ market_id ตรงๆ)
        if (req.method === 'GET' && seg[1] === 'resolve') {
          const code = safeId(url.searchParams.get('code'));
          if (!code) return err('code required', req);
          let mid = code;
          const map = await env.DB.prepare('SELECT v FROM app_config WHERE k=?').bind('mc:' + code.toUpperCase()).first();
          if (map && map.v) mid = map.v;
          const m = await getBiz(env, mid);
          return m ? json({ ok: true, marketId: m.id, name: m.name, type: m.type }, req) : json({ ok: false, found: false }, req, 404);
        }
        // POST /market/:mid/join {role:'vendor'|'worker', name, phone, line, skills, autoApprove, extra}
        //   ทางที่ 1: แม่ค้า/แรงงานสมัครตรง แล้วกรอก market_id/โค้ดเข้าร่วม
        if (req.method === 'POST' && seg[1] && seg[2] === 'join') {
          const mid = safeId(seg[1]);
          const m = await getBiz(env, mid);
          if (!m) return err('ไม่พบตลาดนี้ (market_id/โค้ดไม่ถูกต้อง)', req, 404);
          const b = await readBody();
          const role = b.role === 'worker' ? 'worker' : 'vendor';
          const rec = { role, name: b.name || '', phone: b.phone || '', line: b.line || '', skills: b.skills || null,
            lat: b.lat != null ? +b.lat : null, lng: b.lng != null ? +b.lng : null,
            status: b.autoApprove ? 'approved' : 'pending', joinedAt: now(), ...(b.extra || {}) };
          const r = await collUpsert(env, mid, 'members', { id: b.id || (role[0] + '_' + safeId(b.line || b.phone || rid('u'))), ...rec });
          ctx.waitUntil(hubBroadcast(env, mid, { type: 'coll', coll: 'members', id: r.id, op: r.existed ? 'update' : 'add', updatedAt: r.updatedAt }));
          return json({ ok: true, marketId: mid, marketName: m.name, memberId: r.id, status: rec.status }, req, r.existed ? 200 : 201);
        }
        // GET /market/:mid/roster?role=&since=  → ทะเบียนแม่ค้า/แรงงานในตลาด (เจ้าของตลาดเห็น)
        if (req.method === 'GET' && seg[1] && seg[2] === 'roster') {
          const mid = safeId(seg[1]);
          const role = url.searchParams.get('role');
          let items = await collList(env, mid, 'members', Number(url.searchParams.get('since') || 0));
          if (role) items = items.filter(x => x.role === role);
          return json({ marketId: mid, members: items }, req);
        }
        // POST /market/:mid/code {code?}  → ทางที่ 2: ตลาดออกโค้ดเชิญเข้าร่วม (เจ้าของตลาด)
        if (req.method === 'POST' && seg[1] && seg[2] === 'code') {
          const mid = safeId(seg[1]);
          const m = await getBiz(env, mid); if (!m) return err('ไม่พบตลาด', req, 404);
          const b = await readBody();
          const code = (b.code || (mid.slice(0, 4) + now().toString(36).slice(-3))).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
          await env.DB.prepare('INSERT INTO app_config (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=?').bind('mc:' + code, mid, mid).run();
          const merged = { ...m, joinCode: code };
          delete merged.id; delete merged.type; delete merged.name; delete merged.ownerLine; delete merged.createdAt; delete merged.updatedAt;
          await env.DB.prepare('UPDATE bizes SET extra=?, updated_at=? WHERE id=?').bind(JSON.stringify(merged), now(), mid).run();
          return json({ ok: true, marketId: mid, code }, req);
        }
        // PATCH /market/:mid/member/:id {patch}  → อนุมัติ/แก้สถานะสมาชิก
        if (req.method === 'PATCH' && seg[1] && seg[2] === 'member' && seg[3]) {
          const mid = safeId(seg[1]), id = safeId(seg[3]); const b = await readBody();
          const cur = await env.DB.prepare('SELECT * FROM records WHERE biz_id=? AND coll=? AND id=?').bind(mid, 'members', id).first();
          if (!cur) return err('not found', req, 404);
          let base = {}; try { base = JSON.parse(cur.data || '{}'); } catch (e) {}
          const merged = { ...base, ...(b.patch || b) }; delete merged.patch;
          const t = now();
          await env.DB.prepare('UPDATE records SET data=?, updated_at=?, deleted=0 WHERE biz_id=? AND coll=? AND id=?').bind(JSON.stringify(merged), t, mid, 'members', id).run();
          ctx.waitUntil(hubBroadcast(env, mid, { type: 'coll', coll: 'members', id, op: 'update', updatedAt: t }));
          return json({ ok: true, id }, req);
        }
      }

      /* ── WORKER POOL + GPS (งานใกล้ฉัน) ── pool กลาง biz='pool' · region= สำหรับแยกโซน ── */
      if (seg[0] === 'pool') {
        const pool = safeId(url.searchParams.get('region') || 'pool');
        // POST /pool/worker {id,name,line,phone,skills,lat,lng,available,marketId,lang}  → upsert แรงงาน + ปักหมุด
        if (req.method === 'POST' && seg[1] === 'worker') {
          const b = await readBody();
          const id = safeId(b.id || b.line || rid('w'));
          const rec = { id, name: b.name || '', line: b.line || '', phone: b.phone || '', skills: b.skills || [],
            lat: b.lat != null ? +b.lat : null, lng: b.lng != null ? +b.lng : null, available: b.available !== false,
            marketId: b.marketId || null, lang: b.lang || 'th', seenAt: now() };
          const r = await collUpsert(env, pool, 'workers', rec);
          ctx.waitUntil(hubBroadcast(env, pool, { type: 'coll', coll: 'workers', id, op: 'update', updatedAt: r.updatedAt }));
          return json({ ok: true, id }, req);
        }
        // POST /pool/job {id?,title,type,marketId,shopName,lat,lng,pay,note,line,win}  → ร้านโพสต์งาน
        if (req.method === 'POST' && seg[1] === 'job' && !seg[2]) {
          const b = await readBody();
          const id = safeId(b.id || rid('job'));
          const rec = { id, title: b.title || 'งาน', type: b.type || null, marketId: b.marketId || null, shopName: b.shopName || '',
            lat: b.lat != null ? +b.lat : null, lng: b.lng != null ? +b.lng : null, pay: b.pay != null ? +b.pay : null,
            note: b.note || '', line: b.line || '', win: b.win || null, worker: null, status: b.status || 'open', postedAt: now(),
            // งานส่งของแพลตฟอร์ม: ไรเดอร์ต้องรู้ที่อยู่ร้าน เบอร์ลูกค้า และยอดเก็บปลายทาง ไม่งั้นรับงานแล้วทำต่อไม่ได้
            shopAddr: b.shopAddr || '', addr: b.addr || '', custPhone: b.custPhone || '',
            cod: !!b.cod, codAmount: b.codAmount != null ? +b.codAmount : 0,
            total: b.total != null ? +b.total : 0, orderNo: b.orderNo != null ? b.orderNo : null };
          const r = await collUpsert(env, pool, 'jobs', rec);
          ctx.waitUntil(hubBroadcast(env, pool, { type: 'coll', coll: 'jobs', id, op: 'add', updatedAt: r.updatedAt }));
          return json({ ok: true, id, job: rec }, req, 201);
        }
        // PATCH /pool/job/:id {patch}  → รับงาน/ปิดงาน/เปลี่ยนสถานะ
        if (req.method === 'PATCH' && seg[1] === 'job' && seg[2]) {
          const id = safeId(seg[2]); const b = await readBody();
          const cur = await env.DB.prepare('SELECT * FROM records WHERE biz_id=? AND coll=? AND id=?').bind(pool, 'jobs', id).first();
          if (!cur) return err('not found', req, 404);
          let base = {}; try { base = JSON.parse(cur.data || '{}'); } catch (e) {}
          const merged = { ...base, ...(b.patch || b) }; delete merged.patch;
          const t = now();
          await env.DB.prepare('UPDATE records SET data=?, updated_at=?, deleted=0 WHERE biz_id=? AND coll=? AND id=?').bind(JSON.stringify(merged), t, pool, 'jobs', id).run();
          ctx.waitUntil(hubBroadcast(env, pool, { type: 'coll', coll: 'jobs', id, op: 'update', updatedAt: t }));
          return json({ ok: true, id }, req);
        }
        // GET /pool/jobs/near?lat=&lng=&radius=&status=open&limit=&win=  → งานใกล้ฉัน (เรียงระยะทาง)
        if (req.method === 'GET' && seg[1] === 'jobs' && seg[2] === 'near') {
          const latP = url.searchParams.get('lat'), lngP = url.searchParams.get('lng');
          const lat = +latP, lng = +lngP;
          const radius = +(url.searchParams.get('radius') || 10);
          const status = url.searchParams.get('status') || 'open';
          const win = url.searchParams.get('win');
          let items = await collList(env, pool, 'jobs', 0, 3000);
          if (status && status !== 'all') items = items.filter(j => (j.status || 'open') === status);
          if (win) items = items.filter(j => !j.win || j.win === win);
          // ต้องเช็คว่า lat/lng ถูกส่งมาจริง (ไม่ใช่ค่าว่าง) ก่อนกรองระยะทาง — +null=0 ทำให้ isNaN ผ่าน ทั้งที่ไม่ได้ตั้งใจกรองแถว (0,0)
          if (latP != null && lngP != null && !isNaN(lat) && !isNaN(lng)) {
            items = items.map(j => ({ ...j, distKm: (j.lat != null && j.lng != null) ? +distKm(lat, lng, j.lat, j.lng).toFixed(2) : null }))
              .filter(j => j.distKm == null || j.distKm <= radius)
              .sort((a, b) => (a.distKm == null ? 1e9 : a.distKm) - (b.distKm == null ? 1e9 : b.distKm));
          }
          return json({ jobs: items.slice(0, +(url.searchParams.get('limit') || 100)) }, req);
        }
        // GET /pool/workers/near?lat=&lng=&radius=&available=1&skill=  → แรงงานใกล้+ว่าง (ร้านกระจายงาน)
        if (req.method === 'GET' && seg[1] === 'workers') {
          const latP = url.searchParams.get('lat'), lngP = url.searchParams.get('lng');
          const lat = +latP, lng = +lngP;
          const radius = +(url.searchParams.get('radius') || 10);
          const onlyAvail = url.searchParams.get('available') === '1';
          const skill = url.searchParams.get('skill');
          let items = await collList(env, pool, 'workers', 0, 3000);
          if (onlyAvail) items = items.filter(w => w.available !== false);
          if (skill) items = items.filter(w => Array.isArray(w.skills) && w.skills.includes(skill));
          if (latP != null && lngP != null && !isNaN(lat) && !isNaN(lng)) {
            items = items.map(w => ({ ...w, distKm: (w.lat != null && w.lng != null) ? +distKm(lat, lng, w.lat, w.lng).toFixed(2) : null }))
              .filter(w => w.distKm == null || w.distKm <= radius)
              .sort((a, b) => (a.distKm == null ? 1e9 : a.distKm) - (b.distKm == null ? 1e9 : b.distKm));
          }
          return json({ workers: items }, req);
        }
      }

      /* ── RIDERS (สมัครไรเดอร์ของแพลตฟอร์ม — แยกจากระบบวิน/Labor Win คนละชุดข้อมูล) ──
         เก็บใน records coll='riders' ของ biz 'riders' · ผู้สมัครยื่นเอง แอดมินตรวจเอกสารแล้วอนุมัติ */
      if (seg[0] === 'riders') {
        const RB = 'riders';
        // POST /riders — ยื่นใบสมัคร (สาธารณะ) · เบอร์เดิม = อัปเดตใบเดิม ไม่สร้างซ้ำ
        if (req.method === 'POST' && !seg[1]) {
          const b = await readBody();
          const phone = String(b.phone || '').replace(/\D/g, '');
          if (!b.name || phone.length < 9) return err('name and phone required', req, 400);
          const existing = (await collList(env, RB, 'riders', 0, 3000))
            .find(r => String(r.phone || '').replace(/\D/g, '') === phone);
          if (existing && existing.status === 'approved') return json({ ok: true, id: existing.id, status: 'approved', already: true }, req);
          const id = existing ? existing.id : safeId(rid('rd'));
          const rec = { id, name: b.name, phone, natId: b.natId || '', vehicle: b.vehicle || 'moto',
            plate: b.plate || '', area: b.area || '', lang: b.lang || 'th',
            payout: { bank: (b.payout && b.payout.bank) || '', acct: (b.payout && b.payout.acct) || '', promptpay: (b.payout && b.payout.promptpay) || '' },
            emergency: { name: (b.emergency && b.emergency.name) || '', phone: (b.emergency && b.emergency.phone) || '' },
            docs: b.docs && typeof b.docs === 'object' ? b.docs : {},
            status: 'pending', note: '', appliedAt: now(), reviewedAt: null };
          await collUpsert(env, RB, 'riders', rec);
          return json({ ok: true, id, status: 'pending', ref: id.toUpperCase() }, req, 201);
        }
        // GET /riders/status?phone= — ผู้สมัครเช็คสถานะตัวเอง (ไม่คืนรูปเอกสาร)
        if (req.method === 'GET' && seg[1] === 'status') {
          const phone = String(url.searchParams.get('phone') || '').replace(/\D/g, '');
          if (phone.length < 9) return err('phone required', req, 400);
          const r = (await collList(env, RB, 'riders', 0, 3000))
            .find(x => String(x.phone || '').replace(/\D/g, '') === phone);
          if (!r) return json({ found: false }, req);
          return json({ found: true, id: r.id, name: r.name, status: r.status, note: r.note || '', appliedAt: r.appliedAt }, req);
        }
        // GET /riders — แอดมินดูใบสมัครทั้งหมด (มีรูปเอกสารด้วย)
        if (req.method === 'GET' && !seg[1]) {
          if (!(await verifyToken(env, adminTokenFrom(req, url)))) return err('admin only', req, 403);
          const status = url.searchParams.get('status');
          let list = await collList(env, RB, 'riders', 0, 3000);
          if (status && status !== 'all') list = list.filter(r => (r.status || 'pending') === status);
          return json({ riders: list.sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0)) }, req);
        }
        // PATCH /riders/:id {status,note} — แอดมินอนุมัติ/ปฏิเสธ
        if (req.method === 'PATCH' && seg[1]) {
          if (!(await verifyToken(env, adminTokenFrom(req, url)))) return err('admin only', req, 403);
          const b = await readBody();
          const cur = await env.DB.prepare('SELECT * FROM records WHERE biz_id=? AND coll=? AND id=?').bind(RB, 'riders', safeId(seg[1])).first();
          if (!cur) return err('not found', req, 404);
          let base = {}; try { base = JSON.parse(cur.data || '{}'); } catch (e) {}
          const merged = { ...base, status: b.status || base.status, note: b.note != null ? b.note : base.note, reviewedAt: now() };
          await env.DB.prepare('UPDATE records SET data=?, updated_at=? WHERE biz_id=? AND coll=? AND id=?')
            .bind(JSON.stringify(merged), now(), RB, 'riders', safeId(seg[1])).run();
          return json({ ok: true, status: merged.status }, req);
        }
      }

      /* ── PRICING (tier ราคาต่อสาย · ไม่มี Pro รวมข้าม vertical) ── */
      if (seg[0] === 'pricing') {
        // GET /pricing?vertical=            → รายการ tier ของสายนั้น (หรือทั้งหมด)
        // GET /pricing/resolve?vertical=&tier=  → tier object ที่ตรง
        if (req.method === 'GET') {
          const vertical = url.searchParams.get('vertical');
          const all = { ...PRICING_DEFAULT, ...(await pricingOverride(env)) };
          if (seg[1] === 'resolve') {
            const t = url.searchParams.get('tier'); const v = all[vertical];
            const tier = (v && (v.tiers || []).find(x => x.id === t)) || null;
            return json({ vertical, tier }, req);
          }
          if (vertical) return json({ vertical, pricing: all[vertical] || null }, req);
          return json({ pricing: all }, req);
        }
        // PUT /pricing {vertical, data} | {pricing}  (admin) → override
        if (req.method === 'PUT') {
          if (!(await verifyToken(env, adminTokenFrom(req, url)))) return err('admin only', req, 403);
          const b = await readBody();
          let cur = await pricingOverride(env);
          if (b.vertical && b.data) cur[b.vertical] = b.data; else if (b.pricing) cur = b.pricing;
          const t = now(), payload = JSON.stringify(cur);
          await env.DB.prepare(`INSERT INTO docs (biz_id,doc_key,data,rev,updated_at) VALUES ('platform','pricing',?,1,?)
            ON CONFLICT(biz_id,doc_key) DO UPDATE SET data=excluded.data, rev=docs.rev+1, updated_at=excluded.updated_at`).bind(payload, t).run();
          return json({ ok: true, pricing: cur }, req);
        }
      }

      /* ── ทุก endpoint ต่อจากนี้ต้องมี biz ── */
      const biz = await bizFromReq();

      /* ── DOCUMENT STORE (whole-blob sync ราย tenant) ── */
      // key เช่น: fitness · market · laborwin · sponsor_entitlement · sponsor_coupons · wallet · stats · control
      if (seg[0] === 'doc') {
        const key = safeId(seg[1]);
        if (!biz || !key) return err('biz + key required', req, 400);

        // GET /doc/:key  → {key, data, rev, updatedAt}  (404 ถ้ายังไม่เคยเขียน)
        if (req.method === 'GET') {
          const r = await env.DB.prepare('SELECT * FROM docs WHERE biz_id=? AND doc_key=?').bind(biz, key).first();
          if (!r) return json({ key, data: null, rev: 0, updatedAt: 0, exists: false }, req);
          let data = null; try { data = JSON.parse(r.data || 'null'); } catch (e) {}
          return json({ key, data, rev: r.rev, updatedAt: r.updated_at, updatedBy: r.updated_by || null, exists: true }, req);
        }
        // PUT /doc/:key  {data, baseRev?, type?, name?, ownerLine?, by?}
        //   baseRev != rev ปัจจุบัน → 409 conflict (คืน rev+data ล่าสุด ให้ client merge)
        //   ไม่ส่ง baseRev = last-write-wins (ทับเลย)
        if (req.method === 'PUT') {
          const b = await readBody();
          if (b.data === undefined) return err('data required', req);
          await ensureBiz(env, biz, b.type, b.name, b.ownerLine);
          const cur = await env.DB.prepare('SELECT rev, data FROM docs WHERE biz_id=? AND doc_key=?').bind(biz, key).first();
          const curRev = cur ? cur.rev : 0;
          if (b.baseRev != null && Number(b.baseRev) !== curRev) {
            let cd = null; try { cd = JSON.parse((cur && cur.data) || 'null'); } catch (e) {}
            return json({ ok: false, conflict: true, rev: curRev, data: cd }, req, 409);
          }
          const rev = curRev + 1, t = now(), payload = JSON.stringify(b.data);
          await env.DB.prepare(`INSERT INTO docs (biz_id,doc_key,data,rev,updated_at,updated_by) VALUES (?,?,?,?,?,?)
            ON CONFLICT(biz_id,doc_key) DO UPDATE SET data=excluded.data, rev=excluded.rev, updated_at=excluded.updated_at, updated_by=excluded.updated_by`)
            .bind(biz, key, payload, rev, t, b.by || null).run();
          ctx.waitUntil(hubBroadcast(env, biz, { type: 'doc', key, rev, updatedAt: t, by: b.by || null }));
          return json({ ok: true, key, rev, updatedAt: t }, req);
        }
        // PATCH /doc/:key  {patch{}}  → shallow-merge top-level keys
        if (req.method === 'PATCH') {
          const b = await readBody();
          await ensureBiz(env, biz, b.type, b.name, b.ownerLine);
          const cur = await env.DB.prepare('SELECT rev, data FROM docs WHERE biz_id=? AND doc_key=?').bind(biz, key).first();
          let base = {}; try { base = cur ? (JSON.parse(cur.data || '{}') || {}) : {}; } catch (e) {}
          const merged = { ...base, ...(b.patch || {}) };
          const rev = (cur ? cur.rev : 0) + 1, t = now(), payload = JSON.stringify(merged);
          await env.DB.prepare(`INSERT INTO docs (biz_id,doc_key,data,rev,updated_at,updated_by) VALUES (?,?,?,?,?,?)
            ON CONFLICT(biz_id,doc_key) DO UPDATE SET data=excluded.data, rev=excluded.rev, updated_at=excluded.updated_at, updated_by=excluded.updated_by`)
            .bind(biz, key, payload, rev, t, b.by || null).run();
          ctx.waitUntil(hubBroadcast(env, biz, { type: 'doc', key, rev, updatedAt: t }));
          return json({ ok: true, key, rev, data: merged, updatedAt: t }, req);
        }
        // DELETE /doc/:key
        if (req.method === 'DELETE') {
          await env.DB.prepare('DELETE FROM docs WHERE biz_id=? AND doc_key=?').bind(biz, key).run();
          ctx.waitUntil(hubBroadcast(env, biz, { type: 'doc', key, deleted: true }));
          return json({ ok: true }, req);
        }
      }

      // GET /docs  → ดึงทุก doc ของ tenant ทีเดียว (bulk pull ตอน load)
      if (seg[0] === 'docs' && req.method === 'GET') {
        if (!biz) return err('biz required', req, 400);
        const { results } = await env.DB.prepare('SELECT * FROM docs WHERE biz_id=?').bind(biz).all();
        const out = {};
        for (const r of results) { let d = null; try { d = JSON.parse(r.data || 'null'); } catch (e) {} out[r.doc_key] = { data: d, rev: r.rev, updatedAt: r.updated_at }; }
        return json({ biz, docs: out }, req);
      }

      /* ── COLLECTION STORE (append/list — ledger, transactions, jobs, ฯลฯ) ── */
      if (seg[0] === 'coll') {
        const coll = safeId(seg[1]);
        if (!biz || !coll) return err('biz + collection required', req, 400);

        // GET /coll/:name?since=<ts>&limit=&includeDeleted=1
        if (req.method === 'GET' && !seg[2]) {
          const since = Number(url.searchParams.get('since') || 0);
          const limit = Math.min(Number(url.searchParams.get('limit') || 1000), 5000);
          const incDel = url.searchParams.get('includeDeleted') === '1';
          const { results } = await env.DB.prepare(
            `SELECT * FROM records WHERE biz_id=? AND coll=? AND updated_at>? ${incDel ? '' : 'AND deleted=0'} ORDER BY updated_at DESC LIMIT ?`)
            .bind(biz, coll, since, limit).all();
          const items = results.map(r => { let d = {}; try { d = JSON.parse(r.data || '{}'); } catch (e) {} return { ...d, id: r.id, _createdAt: r.created_at, _updatedAt: r.updated_at, _deleted: !!r.deleted }; });
          return json({ coll, items }, req);
        }
        // POST /coll/:name  {id?, ...fields}  → upsert record
        if (req.method === 'POST' && !seg[2]) {
          const b = await readBody();
          const rec = b.record || b;
          const id = safeId(rec.id || rid(coll.slice(0, 2)));
          const t = now();
          const ex = await env.DB.prepare('SELECT created_at FROM records WHERE biz_id=? AND coll=? AND id=?').bind(biz, coll, id).first();
          const created = ex ? ex.created_at : t;
          const clean = { ...rec }; delete clean.id; delete clean.biz; delete clean.bizId; delete clean.record;
          await env.DB.prepare(`INSERT INTO records (biz_id,coll,id,data,created_at,updated_at,deleted) VALUES (?,?,?,?,?,?,0)
            ON CONFLICT(biz_id,coll,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, deleted=0`)
            .bind(biz, coll, id, JSON.stringify(clean), created, t).run();
          ctx.waitUntil(hubBroadcast(env, biz, { type: 'coll', coll, id, op: ex ? 'update' : 'add', updatedAt: t }));
          return json({ ok: true, id, coll, createdAt: created, updatedAt: t }, req, ex ? 200 : 201);
        }
        // PATCH /coll/:name/:id  {patch{}}  → merge
        if (req.method === 'PATCH' && seg[2]) {
          const id = safeId(seg[2]); const b = await readBody();
          const cur = await env.DB.prepare('SELECT * FROM records WHERE biz_id=? AND coll=? AND id=?').bind(biz, coll, id).first();
          if (!cur) return err('not found', req, 404);
          let base = {}; try { base = JSON.parse(cur.data || '{}'); } catch (e) {}
          const merged = { ...base, ...(b.patch || b) }; delete merged.id; delete merged.patch;
          const t = now();
          await env.DB.prepare('UPDATE records SET data=?, updated_at=?, deleted=0 WHERE biz_id=? AND coll=? AND id=?')
            .bind(JSON.stringify(merged), t, biz, coll, id).run();
          ctx.waitUntil(hubBroadcast(env, biz, { type: 'coll', coll, id, op: 'update', updatedAt: t }));
          return json({ ok: true, id, updatedAt: t }, req);
        }
        // DELETE /coll/:name/:id  (soft delete → sync ลบข้ามเครื่อง)
        if (req.method === 'DELETE' && seg[2]) {
          const id = safeId(seg[2]); const t = now();
          await env.DB.prepare('UPDATE records SET deleted=1, updated_at=? WHERE biz_id=? AND coll=? AND id=?').bind(t, biz, coll, id).run();
          ctx.waitUntil(hubBroadcast(env, biz, { type: 'coll', coll, id, op: 'delete', updatedAt: t }));
          return json({ ok: true, id }, req);
        }
      }

      return err('not found: ' + path, req, 404);
    } catch (e) {
      return err('server error: ' + (e && e.message || e), req, 500);
    }
  },
};
