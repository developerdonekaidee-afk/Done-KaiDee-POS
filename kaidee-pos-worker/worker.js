/**
 * kaidee-worker.js — KaiDee POS backend (Cloudflare Worker + D1) — MULTI-TENANT
 *
 * ทุก endpoint ข้อมูล ต้องระบุ "ร้าน" (shopId) ผ่าน ?shop= หรือ header X-Shop หรือ body.shopId
 * Bindings:  DB (D1)   ·   SLIPS (R2, optional)
 * Secrets:   LINE_TOKEN, LINE_CHANNEL_SECRET (optional)
 *
 * ── ISOLATION (แก้ 19 ก.ค. 2026) ──
 *  A) GET /shops/by-owner?line=<id>  → หาร้านของเจ้าของ (เดิมไม่มี → getMyShop พังทุกครั้ง)
 *  B) POST /shops                    → ถ้าเจ้าของ (ownerLine) มีร้านแล้ว คืนร้านเดิม ไม่สร้าง/ทับซ้ำ
 *  C) สงวน id 'kaidee' ให้ร้านตัวอย่าง (ร้านจริงห้ามใช้ id นี้)
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
function cors(req) {
  const o = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shop, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
  };
}
const json = (data, req, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...cors(req) } });
const err = (msg, req, status = 400) => json({ error: msg }, req, status);
const now = () => Date.now();

/* ── PromptPay QR payload (EMVCo) ── */
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

/* ── LINE push ── */
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

/* ── SMS gateway (ตั้งค่าผ่าน env: SMS_ENDPOINT/SMS_KEY/SMS_SENDER · หรือ SMS_PROVIDER=twilio + SMS_SID/SMS_TOKEN/SMS_FROM) — ไม่ตั้ง = ข้าม, fallback LINE ── */
const digitsOnly = (p) => String(p || '').replace(/\D/g, '');
function e164th(p) { const s = digitsOnly(p); return s.startsWith('0') ? '+66' + s.slice(1) : (s.startsWith('66') ? '+' + s : '+' + s); }
async function sendSMS(env, phone, text) {
  if (!phone) return false;
  try {
    if (env.SMS_PROVIDER === 'twilio' && env.SMS_SID && env.SMS_TOKEN && env.SMS_FROM) {
      const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + env.SMS_SID + '/Messages.json', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(env.SMS_SID + ':' + env.SMS_TOKEN) },
        body: new URLSearchParams({ To: e164th(phone), From: env.SMS_FROM, Body: text }),
      });
      return r.ok;
    }
    if (!env.SMS_ENDPOINT) return false;
    const r = await fetch(env.SMS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(env.SMS_KEY ? { Authorization: 'Bearer ' + env.SMS_KEY } : {}) },
      body: JSON.stringify({ to: digitsOnly(phone), message: text, sender: env.SMS_SENDER || 'KaiDee' }),
    });
    return r.ok;
  } catch (e) { return false; }
}
// แจ้งเตือนลูกค้า (ลิงก์เว็บ): มีเบอร์ + ตั้งค่า SMS gateway → ส่ง SMS · ไม่งั้น fallback LINE push
async function notifyCustomer(env, { phone, lineUser }, text) {
  let ok = false;
  if (phone) ok = await sendSMS(env, phone, text);
  if (!ok && lineUser) ok = await linePush(env, lineUser, [{ type: 'text', text }]);
  return ok;
}

/* ── parse ข้อความแจ้งเงินเข้า (เฉพาะขาเข้า) — ใช้กับ webhook แจ้งเตือนธนาคารจากกลุ่ม LINE ── */
const tMinS=(t)=>{ const m=/(\d{1,2}):(\d{2})/.exec(t||''); return m?(+m[1]*60+ +m[2]):0; };
function parseCredits(text){
  const lines=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean); const out=[];
  for(const ln of lines){
    if(/ถอน|จ่ายออก|โอนออก|debit|withdraw/i.test(ln)) continue;
    const credit=/เงินเข้า|รับโอน|โอนเข้า|ฝาก|credit|received|\+/i.test(ln);
    const nums=(ln.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|-?\d+(?:\.\d{1,2})?/g)||[]);
    if(!nums.length) continue;
    const dec=nums.filter(n=>/\.\d{1,2}$/.test(n)); const pool=(dec.length?dec:nums).map(n=>parseFloat(n.replace(/,/g,''))).filter(v=>v>0);
    if(!pool.length || !credit) continue;
    const amount=+Math.max(...pool).toFixed(2); const time=(ln.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)||[])[0]||'';
    if(amount>0) out.push({ amount, time, raw:ln });
  }
  return out;
}
let _baReady=false;
async function ensureBankAlerts(env){ if(_baReady) return; _baReady=true;
  try{ await env.DB.prepare('CREATE TABLE IF NOT EXISTS bank_alerts (id TEXT PRIMARY KEY, shop_id TEXT, raw TEXT, amount INTEGER, matched_sale TEXT, matched_no INTEGER, created_at INTEGER)').run(); }catch(e){} }
async function autoMatchAlert(env, shop, text){
  await ensureBankAlerts(env);
  const entries = parseCredits(text||''); const ts = now(); const matched = [];
  if(entries.length){
    const { results: rows } = await env.DB.prepare('SELECT * FROM sales WHERE shop_id=? ORDER BY created_at DESC LIMIT 500').bind(shop).all();
    const parsed = rows.map(r=>{ let d={}; try{ d=JSON.parse(r.data||'{}'); }catch(e){} return { r, d, total:(r.total!=null?r.total:d.total)||0 }; })
      .filter(x=> (x.d.pay==='promptpay'||x.d.pay==='transfer') && !x.d.verified && !x.d.void);
    const used=new Set();
    for(const e of entries){
      const cand=parsed.filter(x=>!used.has(x.r.id)&&Math.abs(Number(x.total)-e.amount)<0.5).sort((a,bb)=>Math.abs(tMinS(a.d.t)-tMinS(e.time))-Math.abs(tMinS(bb.d.t)-tMinS(e.time)));
      const aid='ba'+ts+Math.random().toString(36).slice(2,5);
      if(cand.length){ const x=cand[0]; used.add(x.r.id); const sys=Number(x.total); const diff=+(e.amount-sys).toFixed(2);
        const nd={ ...x.d, verified:true, verifiedAmount:e.amount, verifyDiff:diff, payStatus:(Math.abs(diff)<0.01?'paid':'discrepancy'), verifiedDate:new Date().toISOString().slice(0,10), autoMatched:true, matchRef:(e.raw||'').slice(0,80) };
        await env.DB.prepare('UPDATE sales SET data=? WHERE shop_id=? AND id=?').bind(JSON.stringify(nd), shop, x.r.id).run();
        await env.DB.prepare('INSERT INTO bank_alerts (id,shop_id,raw,amount,matched_sale,matched_no,created_at) VALUES (?,?,?,?,?,?,?)').bind(aid, shop,(e.raw||'').slice(0,200),e.amount,x.r.id,x.r.no||null,ts).run();
        matched.push({ amount:e.amount, saleId:x.r.id, no:x.r.no });
      } else { await env.DB.prepare('INSERT INTO bank_alerts (id,shop_id,raw,amount,matched_sale,matched_no,created_at) VALUES (?,?,?,?,?,?,?)').bind(aid, shop,(e.raw||'').slice(0,200),e.amount,null,null,ts).run(); }
    }
  }
  return { parsed: entries.length, matched: matched.length, matches: matched };
}
let _lpReady=false;
async function ensureLinePairs(env){ if(_lpReady) return; _lpReady=true;
  try{ await env.DB.prepare('CREATE TABLE IF NOT EXISTS line_pairs (shop_id TEXT, code TEXT, group_id TEXT, status TEXT, created_at INTEGER)').run(); }catch(e){} }
async function shopByGroup(env, gid){ try{ const r=await env.DB.prepare("SELECT shop_id FROM line_pairs WHERE group_id=? AND status='linked' LIMIT 1").bind(gid).first(); return r?r.shop_id:null; }catch(e){ return null; } }

/* ── admin auth (server-side, shared across devices) ── */
const te = new TextEncoder();
async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', te.encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function hmac(env, msg) {
  const secret = env.ADMIN_SECRET || 'kaidee-admin-fallback-secret-v1';
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(msg));
  return [...new Uint8Array(sig)].map(x => x.toString(16).padStart(2, '0')).join('');
}
// อ่าน/สร้างรหัสแอดมินใน app_config (key 'admin') — ค่าเริ่มต้น kaidee2026
async function getAdminHash(env) {
  try { const r = await env.DB.prepare("SELECT v FROM app_config WHERE k='admin'").first();
    if (r) { const j = JSON.parse(r.v || '{}'); if (j.passHash) return j.passHash; } } catch (e) {}
  return await sha256hex('kaidee2026');
}
// ── rate limit เข้าสู่ระบบแอดมิน (ต่อ IP) — กัน brute-force รหัสผ่าน ──
// ผิด 5 ครั้ง → ล็อก 15 นาที · ทายถูกครั้งเดียว = เคลียร์ตัวนับ
const LOGIN_MAX_FAILS = 5, LOGIN_LOCK_MS = 15 * 60e3;
let _laReady = false;
async function ensureLoginAttempts(env) { if (_laReady) return; _laReady = true;
  try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT PRIMARY KEY, fails INTEGER DEFAULT 0, locked_until INTEGER, updated_at INTEGER)').run(); } catch (e) {} }
function clientIp(req) { return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown'; }
async function loginLockStatus(env, ip) {
  await ensureLoginAttempts(env);
  const r = await env.DB.prepare('SELECT * FROM login_attempts WHERE ip=?').bind(ip).first();
  if (r && r.locked_until && r.locked_until > now()) return { locked: true, retryAfterMs: r.locked_until - now() };
  return { locked: false };
}
async function loginRecordResult(env, ip, ok) {
  await ensureLoginAttempts(env);
  if (ok) { await env.DB.prepare('DELETE FROM login_attempts WHERE ip=?').bind(ip).run(); return; }
  const r = await env.DB.prepare('SELECT * FROM login_attempts WHERE ip=?').bind(ip).first();
  const fails = (r && r.locked_until && r.locked_until > now() ? r.fails : (r ? r.fails : 0)) + 1;
  const lockedUntil = fails >= LOGIN_MAX_FAILS ? now() + LOGIN_LOCK_MS : (r ? r.locked_until : null);
  await env.DB.prepare(`INSERT INTO login_attempts (ip,fails,locked_until,updated_at) VALUES (?,?,?,?)
    ON CONFLICT(ip) DO UPDATE SET fails=excluded.fails, locked_until=excluded.locked_until, updated_at=excluded.updated_at`)
    .bind(ip, fails, lockedUntil, now()).run();
}
/* ── รีเซ็ตรหัสแอดมินด้วย OTP (เบอร์เจ้าของระบบ = secret ADMIN_PHONE · LINE สำรอง = ADMIN_LINE_USER) ── */
async function adminCfg(env) {
  try { const r = await env.DB.prepare("SELECT v FROM app_config WHERE k='admin'").first();
    if (r) return JSON.parse(r.v || '{}'); } catch (e) {}
  return {};
}
async function adminCfgSave(env, patch) {
  const cur = await adminCfg(env);
  const v = JSON.stringify({ ...cur, ...patch, updatedAt: now() });
  await env.DB.prepare("INSERT INTO app_config (k,v) VALUES ('admin',?) ON CONFLICT(k) DO UPDATE SET v=?").bind(v, v).run();
}
function maskPhone(p) { const s = digitsOnly(p); return s.length < 8 ? '—' : s.slice(0, 3) + '-xxx-' + s.slice(-4); }
async function makeToken(env) {
  const exp = Date.now() + 12 * 3600e3;              // อายุ 12 ชม.
  const sig = await hmac(env, 'admin.' + exp);
  return exp + '.' + sig;
}
async function verifyToken(env, tok) {
  if (!tok) return false;
  const [exp, sig] = String(tok).split('.');
  if (!exp || !sig || Date.now() > +exp) return false;
  return sig === await hmac(env, 'admin.' + exp);
}
// ── OWNER auth (Backoffice · ผูกกับร้าน) — token = HMAC('owner.<shop>.<exp>') อายุ 12 ชม. ──
async function makeOwnerToken(env, shop, ttlMs) {
  const exp = Date.now() + (ttlMs || 12 * 3600e3);
  return exp + '.' + await hmac(env, 'owner.' + shop + '.' + exp);
}
async function verifyOwnerToken(env, shop, tok) {
  if (!tok || !shop) return false;
  const [exp, sig] = String(tok).split('.');
  if (!exp || !sig || Date.now() > +exp) return false;
  return sig === await hmac(env, 'owner.' + shop + '.' + exp);
}
// PIN เจ้าของร้าน เก็บ hash ใน settings blob (ownerPinHash)
async function getShopOwnerPin(env, shop) {
  try { const r = await env.DB.prepare('SELECT data FROM settings WHERE shop_id=?').bind(shop).first();
    const d = r ? JSON.parse(r.data || '{}') : {}; return d.ownerPinHash || null; } catch (e) { return null; }
}
const STATUS_TH = {
  new: 'ร้านรับออเดอร์แล้ว 👨‍🍳', cooking: 'กำลังปรุงอาหาร 🔥', ready: 'อาหารพร้อมแล้ว ✅',
  delivering: 'ไรเดอร์กำลังไปส่ง 🛵', done: 'ส่งสำเร็จ ขอบคุณครับ 🙏', cancelled: 'ออเดอร์ถูกยกเลิก',
};

/* ── row mappers ── */
/* ทุกหน้าจอฝั่งแอปอ่านรายการสินค้าเป็น tuple [id, จำนวน, ตัวเลือก, ราคาเพิ่ม] แล้ว destructure ตรง ๆ
   ถ้ามีออเดอร์รูปแบบอื่นหลุดเข้ามาแม้บิลเดียว หน้าร้านจะ crash ทั้งแอป (จอขาว) และล้างแคชก็ไม่หาย
   เพราะข้อมูลอยู่บนเซิร์ฟเวอร์ → บังคับรูปแบบทั้งตอนเขียนและตอนอ่าน */
const normItems = (raw) => {
  let a = raw;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = []; } }
  if (!Array.isArray(a)) return [];
  return a.map(it => {
    if (Array.isArray(it)) return [it[0], (it[1] | 0) || 0, it[2] || '', it[3] | 0];
    if (it && typeof it === 'object') return [it.id, (it.qty | 0) || 0, it.opt || it.opts || '', it.add | 0];
    return null;
  }).filter(it => it && it[0]);
};
const rowOrder = (r) => ({
  id: r.id, no: r.no, items: normItems(r.items), channel: r.channel, pay: r.pay,
  status: r.status, paid: !!r.paid, slipUrl: r.slip_url, total: r.total, cost: r.cost,
  fee: r.fee, qnum: r.qnum, table: r.table_no || null, customer: r.customer, addr: r.addr, when: r.when_txt,
  subtotal: r.subtotal | 0, memberDisc: r.member_disc | 0,
  promoId: r.promo_id || null, promoName: r.promo_name || '', promoDisc: r.promo_disc | 0, promoFeeDisc: r.promo_fee_disc | 0,
  riderJob: r.rider_job || null, riderJobAt: r.rider_job_at || null,
  callCash: !!r.call_cash, callCashAt: r.call_cash_at, payAfterConfirm: !!r.pay_after_confirm,
  acceptedBy: r.accepted_by || null, acceptedByName: r.accepted_by_name || null,
  verifiedBy: r.verified_by || null, verifiedByName: r.verified_by_name || null,
  voidReq: (()=>{ try{ return r.void_req ? JSON.parse(r.void_req) : null; }catch(e){ return null; } })(),
  refund: (()=>{ try{ return r.refund ? JSON.parse(r.refund) : null; }catch(e){ return null; } })(),
  lineUserId: r.line_user, lineName: r.line_name, createdAt: r.created_at, updatedAt: r.updated_at,
});
// idempotent: เพิ่มคอลัมน์ table_no (เลขโต๊ะ dine-in) ครั้งเดียวต่อ isolate — มีอยู่แล้ว = throw แล้ว swallow
let _orderColsReady = false;
async function ensureOrderCols(env){ if(_orderColsReady) return; _orderColsReady = true;
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN table_no TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN pay_after_confirm INTEGER DEFAULT 0').run(); }catch(e){}
  // audit: พนักงานที่รับออเดอร์ / ยืนยันรับเงิน (กันสวมรอย — เก็บฝั่ง server ครั้งแรกเท่านั้น)
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN accepted_by TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN accepted_by_name TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN verified_by TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN verified_by_name TEXT').run(); }catch(e){}
  // คำขออนุมัติยกเลิกบิล (พนักงานขอ → เจ้าของ/ผู้จัดการอนุมัติ) — JSON {by,byName,at,reason,voidType,refund,cancelMode}
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN void_req TEXT').run(); }catch(e){}
  // คืนเงินออเดอร์ที่ร้านปฏิเสธ (payFirst) — JSON {status:pending|acct_given|refunded, amount, reason, method, bank, acctNo, acctName, phone, slip, submittedAt, refundedAt}
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN refund TEXT').run(); }catch(e){}
  // แยกยอดในบิลให้เห็นครบ (ค่าอาหาร/ส่วนลดสมาชิก/ส่วนลดโปร/ส่วนลดค่าส่ง) — ใช้ทั้งสรุปบิลฝั่งลูกค้าและต้นทุนโปรในรายงานร้าน
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN subtotal INTEGER DEFAULT 0').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN member_disc INTEGER DEFAULT 0').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN promo_id TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN promo_name TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN promo_disc INTEGER DEFAULT 0').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN promo_fee_disc INTEGER DEFAULT 0').run(); }catch(e){}
  // งานไรเดอร์ที่ประกาศไว้ (อยู่คนละ worker) — เดิมเก็บแค่ในเครื่องร้าน ลูกค้าอีกเครื่องเลยติดตามไรเดอร์ไม่ได้
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN rider_job TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE orders ADD COLUMN rider_job_at INTEGER').run(); }catch(e){} }
// idempotent: ตาราง refunds (คืนเงินออเดอร์ที่ร้านปฏิเสธ · confirm-first) — สร้างครั้งเดียวต่อ isolate
let _refundReady = false;
async function ensureRefundTable(env){ if(_refundReady) return; _refundReady = true;
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY, shop_id TEXT, order_id TEXT, order_no INTEGER, amount INTEGER,
    line_user TEXT, phone TEXT, bank TEXT, acct_no TEXT, acct_name TEXT,
    status TEXT, slip TEXT, note TEXT,
    created_at INTEGER, updated_at INTEGER )`).run(); }catch(e){} }
// idempotent: เพิ่มคอลัมน์ phone ให้สมาชิก (สมาชิกแบบเบอร์ที่เพิ่มหน้าร้าน) — มีแล้ว = throw แล้วกลืน
let _memberColsReady = false;
async function ensureMemberCols(env){ if(_memberColsReady) return; _memberColsReady = true;
  try{ await env.DB.prepare('ALTER TABLE members ADD COLUMN phone TEXT').run(); }catch(e){} }
// idempotent: คอลัมน์เมนูที่ INSERT ด้านล่างใช้ แต่ไม่ได้อยู่ใน DDL ตั้งต้น
//   recipe/off  — ขาดไปตั้งแต่แรก ทำให้ POST /menu พัง 500 ทุกครั้ง (เมนูไม่เคย sync ขึ้นเซิร์ฟเวอร์เลย)
//   consign/consign_id — ผูกเมนูกับสินค้าขายฝาก → ตัดจากคลังฝากตอนขาย
// มีคอลัมน์อยู่แล้ว = ALTER throw แล้วกลืน
let _menuConsignReady = false;
async function ensureMenuConsignCols(env){ if(_menuConsignReady) return; _menuConsignReady = true;
  try{ await env.DB.prepare('ALTER TABLE menu ADD COLUMN recipe TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE menu ADD COLUMN off INTEGER DEFAULT 0').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE menu ADD COLUMN consign INTEGER DEFAULT 0').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE menu ADD COLUMN consign_id TEXT').run(); }catch(e){} }
// idempotent: ตารางฝั่งร้านที่ไม่เคยถูกสร้างจริงบน D1 (settings/raw/purchases/cash_days/quotes)
//   → ก่อนหน้านี้ทุก endpoint เหล่านี้ 500 เงียบๆ ข้อมูลร้านเลยอยู่แค่ในเครื่อง ย้ายเครื่อง = หาย
let _shopTablesReady = false;
async function ensureShopTables(env){ if(_shopTablesReady) return; _shopTablesReady = true;
  const ddl = [
    `CREATE TABLE IF NOT EXISTS settings ( shop_id TEXT PRIMARY KEY, data TEXT, updated_at INTEGER )`,
    `CREATE TABLE IF NOT EXISTS raw ( shop_id TEXT NOT NULL, id TEXT NOT NULL, cat TEXT, th TEXT, unit TEXT,
       stock REAL DEFAULT 0, avg_cost REAL DEFAULT 0, low REAL DEFAULT 0, updated_at INTEGER, PRIMARY KEY (shop_id,id) )`,
    `CREATE TABLE IF NOT EXISTS purchases ( shop_id TEXT NOT NULL, id TEXT NOT NULL, date TEXT, note TEXT,
       lines TEXT, total INTEGER, created_at INTEGER, PRIMARY KEY (shop_id,id) )`,
    `CREATE TABLE IF NOT EXISTS cash_days ( shop_id TEXT NOT NULL, id TEXT NOT NULL, date TEXT, data TEXT,
       created_at INTEGER, PRIMARY KEY (shop_id,id) )`,
    `CREATE TABLE IF NOT EXISTS quotes ( shop_id TEXT NOT NULL, id TEXT NOT NULL, status TEXT, data TEXT,
       created_at INTEGER, PRIMARY KEY (shop_id,id) )`,
  ];
  for (const q of ddl) { try{ await env.DB.prepare(q).run(); }catch(e){} } }
// idempotent: ตารางโปรโมชั่น/คูปองที่ร้านสร้างเอง — ร้านออกส่วนลดเอง แพลตฟอร์มไม่ร่วมจ่าย (zero-GP)
let _promoReady = false;
async function ensurePromoTables(env){ if(_promoReady) return; _promoReady = true;
  const ddl = [
    `CREATE TABLE IF NOT EXISTS promos ( shop_id TEXT NOT NULL, id TEXT NOT NULL, code TEXT, data TEXT,
       used INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER,
       PRIMARY KEY (shop_id,id) )`,
    // ใช้นับสิทธิ์ต่อคน (quotaPerUser) และคิดต้นทุนโปรในรายงานกำไร
    `CREATE TABLE IF NOT EXISTS promo_uses ( shop_id TEXT NOT NULL, promo_id TEXT NOT NULL, order_id TEXT,
       line_user TEXT, amount INTEGER, at INTEGER )`,
    `CREATE INDEX IF NOT EXISTS idx_promo_uses_user ON promo_uses (shop_id, promo_id, line_user)`,
  ];
  for (const q of ddl) { try{ await env.DB.prepare(q).run(); }catch(e){} } }

/* ── รีวิว/คะแนนดาว ─────────────────────────────────────────────
   ให้ได้เฉพาะคนที่สั่งจริงและได้รับของแล้ว 1 บิล = 1 รีวิว
   ก่อนหน้านี้หน้าร้านโชว์ ★4.8 เท่ากันทุกร้านแบบ hardcode ไม่มีที่มา   */
let _reviewReady = false;
async function ensureReviews(env){ if(_reviewReady) return; _reviewReady = true;
  const ddl = [
    `CREATE TABLE IF NOT EXISTS reviews ( shop_id TEXT NOT NULL, id TEXT NOT NULL, order_id TEXT,
       line_user TEXT, stars INTEGER, text TEXT, reply TEXT, created_at INTEGER, PRIMARY KEY (shop_id,id) )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_order ON reviews (shop_id, order_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_shop ON reviews (shop_id, created_at)`,
  ];
  for (const q of ddl) { try{ await env.DB.prepare(q).run(); }catch(e){} } }

// คะแนนเฉลี่ยของหลายร้านในทีเดียว — ใช้ติดบนการ์ดร้านในหน้ารวมร้าน
async function attachRatings(env, list) {
  if (!list.length) return list;
  await ensureReviews(env);
  const ids = list.map(s => s.id);
  const ph = ids.map(() => '?').join(',');
  let by = {};
  try {
    const { results } = await env.DB.prepare(
      `SELECT shop_id, COUNT(*) n, AVG(stars) avg FROM reviews WHERE shop_id IN (${ph}) GROUP BY shop_id`).bind(...ids).all();
    by = Object.fromEntries((results || []).map(r => [r.shop_id, r]));
  } catch (e) { return list; }
  return list.map(s => {
    const r = by[s.id];
    // ต่ำกว่า 3 รีวิวยังไม่โชว์ดาว — เลขจากคนเดียวไม่ได้บอกอะไร และร้านใหม่จะเสียเปรียบเกินจริง
    if (!r || (r.n | 0) < 3) return { ...s, reviewCount: r ? (r.n | 0) : 0 };
    return { ...s, rating: Math.round((r.avg || 0) * 10) / 10, reviewCount: r.n | 0 };
  });
}

/* ── โปรโมชั่นของร้าน: กติกา + การคิดส่วนลด ──────────────────────────────
   ทุกยอดต้องคิดที่นี่เสมอ · ฝั่งแอปคิดไว้แค่โชว์ให้ลูกค้าเห็นระหว่างเลือก
   ถ้าเชื่อยอดจากแอป = แก้ค่าในเบราว์เซอร์แล้วได้ของฟรี                        */
const BKK_MS = 7 * 3600 * 1000;   // เวลาไทย — worker รันเป็น UTC
const rowPromo = (r) => { let d = {}; try { d = JSON.parse(r.data || '{}'); } catch (e) {}
  return { ...d, id: r.id, code: r.code || '', used: r.used | 0, active: !!r.active,
           createdAt: r.created_at, updatedAt: r.updated_at }; };

// เหตุผลที่ใช้โปรใบนี้ไม่ได้ (คืน key ให้ฝั่งแอปแปลเป็นข้อความเอง) · null = ใช้ได้
function promoBlocker(p, cx) {
  if (!p.active) return 'inactive';
  const d = new Date((cx.at || Date.now()) + BKK_MS);
  const ymd = d.toISOString().slice(0, 10);
  if (p.startAt && ymd < p.startAt) return 'notStarted';
  if (p.endAt && ymd > p.endAt) return 'expired';
  if (Array.isArray(p.days) && p.days.length && !p.days.includes(d.getUTCDay())) return 'dayOff';
  if (p.timeFrom && p.timeTo) {
    const hm = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
    // ข้ามเที่ยงคืนได้ (เช่น 22:00–02:00)
    const inWin = p.timeFrom <= p.timeTo ? (hm >= p.timeFrom && hm <= p.timeTo) : (hm >= p.timeFrom || hm <= p.timeTo);
    if (!inWin) return 'timeOff';
  }
  if (Array.isArray(p.channels) && p.channels.length && !p.channels.includes(cx.channel)) return 'channelOff';
  if ((p.quota | 0) > 0 && (p.used | 0) >= p.quota) return 'soldOut';
  if ((p.quotaPerUser | 0) > 0 && (cx.userUsed | 0) >= p.quotaPerUser) return 'userLimit';
  if ((p.minSpend | 0) > 0 && cx.subtotal < p.minSpend) return 'minSpend';
  return null;
}

const promoScoped = (p, lines) =>
  p.scope === 'cat'  ? lines.filter(l => (p.scopeIds || []).includes(l.cat))
: p.scope === 'item' ? lines.filter(l => (p.scopeIds || []).includes(l.id))
: lines;

// คืน {disc, feeDisc} — disc หักจากค่าอาหาร · feeDisc หักจากค่าส่ง (แยกกันเพื่อโชว์ในบิลคนละบรรทัด)
function promoAmount(p, cx) {
  const scoped = promoScoped(p, cx.lines);
  const base = scoped.reduce((a, l) => a + l.price * l.qty, 0);
  const cap = v => ((p.maxDisc | 0) > 0 ? Math.min(v, p.maxDisc) : v);
  if (p.kind === 'percent')      return { disc: Math.min(base, cap(Math.round(base * (+p.value || 0) / 100))), feeDisc: 0 };
  if (p.kind === 'fixed')        return { disc: Math.min(base, Math.round(+p.value || 0)), feeDisc: 0 };
  if (p.kind === 'freeDelivery') return { disc: 0, feeDisc: cap(cx.fee | 0) };
  if (p.kind === 'itemPrice') {  // เมนูในโปรเหลือชิ้นละ value บาท
    const sp = Math.max(0, Math.round(+p.value || 0));
    return { disc: cap(scoped.reduce((a, l) => a + Math.max(0, l.price - sp) * l.qty, 0)), feeDisc: 0 };
  }
  if (p.kind === 'buyXgetY') {
    const buy = Math.max(1, p.buyQty | 0), get = Math.max(1, p.getQty | 0);
    const units = [];                                   // กระจายเป็นรายชิ้น แล้วแถมชิ้นที่ถูกที่สุด
    scoped.forEach(l => { for (let i = 0; i < l.qty; i++) units.push(l.price); });
    units.sort((a, b) => a - b);
    const free = Math.floor(units.length / (buy + get)) * get;
    return { disc: cap(units.slice(0, free).reduce((a, v) => a + v, 0)), feeDisc: 0 };
  }
  return { disc: 0, feeDisc: 0 };
}

// สร้างรายการสินค้าจากราคาในฐานข้อมูล — ไม่ใช้ราคาที่แอปส่งมา
async function promoLinesFromDB(env, shop, items) {
  const ids = [...new Set((items || []).map(it => (Array.isArray(it) ? it[0] : it && it.id)).filter(Boolean))];
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT id,cat,price FROM menu WHERE shop_id=? AND id IN (${ph})`)
    .bind(shop, ...ids).all();
  const by = Object.fromEntries((results || []).map(r => [r.id, r]));
  return (items || []).map(it => {
    const id = Array.isArray(it) ? it[0] : it.id;
    const qty = Math.max(0, (Array.isArray(it) ? it[1] : it.qty) | 0);
    const m = by[id];
    if (!m || !qty) return null;
    // ราคาตัวเลือกเสริม (add) ยังมาจากแอป — ไม่ได้เก็บ option ไว้ฝั่งเซิร์ฟเวอร์ จึงไม่นับเข้าฐานคิดโปร
    return { id, cat: m.cat || '', price: m.price | 0, qty };
  }).filter(Boolean);
}

/* โปรที่ "ใช้ได้ตอนนี้" โดยยังไม่ดูตะกร้า — ใช้ทำป้ายบนการ์ดร้านและแถบโปรในหน้าร้าน
   เช็คเฉพาะเงื่อนไขที่ไม่เกี่ยวกับตะกร้า (เปิดอยู่ · ช่วงวันเวลา · สิทธิ์เหลือ) */
const promoLiveNow = (p, at) => {
  const blocked = promoBlocker(p, { at, subtotal: Infinity, channel: null, lines: [], fee: 0 });
  return !blocked || blocked === 'channelOff';
};
// ป้ายโปรบนการ์ดร้าน: เอาเฉพาะโปรที่ลดให้อัตโนมัติ (โปรที่ต้องกรอกโค้ดไม่ควรโฆษณา เพราะลูกค้าไม่รู้โค้ด)
const PROMO_RANK = { percent: 0, fixed: 1, freeDelivery: 2, buyXgetY: 3, itemPrice: 4 };
async function attachShopPromos(env, list) {
  if (!list.length) return list;
  await ensurePromoTables(env);
  const ids = list.map(s => s.id);
  const ph = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT * FROM promos WHERE active=1 AND shop_id IN (${ph})`).bind(...ids).all();
  const at = now(), by = {};
  (results || []).forEach(r => {
    const p = rowPromo(r);
    if (p.code || !promoLiveNow(p, at)) return;
    (by[r.shop_id] = by[r.shop_id] || []).push(p);
  });
  return list.map(s => {
    const ps = (by[s.id] || []).sort((a, b) =>
      (PROMO_RANK[a.kind] ?? 9) - (PROMO_RANK[b.kind] ?? 9) || (+b.value || 0) - (+a.value || 0));
    if (!ps.length) return s;
    const b = ps[0];
    return { ...s, promoCount: ps.length,
      promo: { name: b.name, kind: b.kind, value: +b.value || 0, minSpend: b.minSpend | 0, buyQty: b.buyQty | 0, getQty: b.getQty | 0 } };
  });
}

// ประเมินโปรทุกใบของร้านเทียบกับตะกร้าปัจจุบัน — ใช้ทั้งหน้าเลือกคูปองและตอนสร้างออเดอร์
async function promoEvaluate(env, shop, cx) {
  await ensurePromoTables(env);
  const { results } = await env.DB.prepare('SELECT * FROM promos WHERE shop_id=?').bind(shop).all();
  const all = (results || []).map(rowPromo);
  let uses = {};
  if (cx.lineUser) {
    const u = await env.DB.prepare('SELECT promo_id, COUNT(*) n FROM promo_uses WHERE shop_id=? AND line_user=? GROUP BY promo_id')
      .bind(shop, cx.lineUser).all();
    uses = Object.fromEntries((u.results || []).map(r => [r.promo_id, r.n | 0]));
  }
  return all.map(p => {
    const c = { ...cx, userUsed: uses[p.id] || 0 };
    let blocked = promoBlocker(p, c);
    const amt = blocked ? { disc: 0, feeDisc: 0 } : promoAmount(p, c);
    // เงื่อนไขผ่านหมดแต่ลดได้ ฿0 (เช่นโปรผูกกับเมนูที่ยังไม่ได้ใส่ตะกร้า) — อย่าโชว์ว่า "ใช้ได้"
    if (!blocked && amt.disc + amt.feeDisc <= 0) blocked = 'noEffect';
    // ขาดอีกเท่าไหร่ถึงใช้ได้ — ให้ฝั่งแอปโชว์ "ซื้ออีก ฿45 ใช้ได้"
    const short = blocked === 'minSpend' ? Math.max(0, (p.minSpend | 0) - (cx.subtotal | 0)) : 0;
    return { ...p, blocked, short, disc: amt.disc, feeDisc: amt.feeDisc };
  });
}
// idempotent: log การเข้าดู Backoffice ร้านโดยแอดมินแอป (PDPA — เก็บร่องรอยการเข้าถึงข้อมูลร้าน)
let _adminLogReady = false;
async function ensureAdminLog(env){ if(_adminLogReady) return; _adminLogReady = true;
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_access_log ( id TEXT PRIMARY KEY, shop_id TEXT, shop_name TEXT, action TEXT, by TEXT, at INTEGER )`).run(); }catch(e){} }
// idempotent: ตาราง code_requests (คำขอรหัส Office · เปิดวันย้อนหลัง) — สร้างครั้งเดียวต่อ isolate
let _codeReqReady = false;
async function ensureCodeReqTable(env){ if(_codeReqReady) return; _codeReqReady = true;
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS code_requests (
    id TEXT PRIMARY KEY, shop_id TEXT, shop_name TEXT, kind TEXT, note TEXT,
    status TEXT, code TEXT, used INTEGER DEFAULT 0,
    created_at INTEGER, handled_at INTEGER, handled_by TEXT )`).run(); }catch(e){} }
// idempotent: เพิ่มคอลัมน์ kind/addon ให้ pay_requests (คำขอซื้อ add-on แยกจากต่ออายุ)
let _payReqColsReady = false;
async function ensurePayReqCols(env){ if(_payReqColsReady) return; _payReqColsReady = true;
  try{ await env.DB.prepare('ALTER TABLE pay_requests ADD COLUMN kind TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE pay_requests ADD COLUMN addon TEXT').run(); }catch(e){}
  // audit: ใครอนุมัติ/ปฏิเสธคำขอชำระ + เมื่อไหร่ — PATCH ใช้สองคอลัมน์นี้อยู่แล้วแต่ไม่เคย ALTER ให้มาก่อน (500 ทุกครั้งที่กดอนุมัติ)
  try{ await env.DB.prepare('ALTER TABLE pay_requests ADD COLUMN handled_at INTEGER').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE pay_requests ADD COLUMN handled_by TEXT').run(); }catch(e){} }
// idempotent: ตาราง wallets/wallet_txns/wallet_accounts (กระเป๋าเงินปิด — จ่ายค่าบริการระบบเท่านั้น, ยอด/ประวัติเป็นความจริงที่ฝั่งเซิร์ฟเท่านั้น)
let _walletReady = false;
async function ensureWallet(env){ if(_walletReady) return; _walletReady = true;
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS wallets (
    biz_id TEXT PRIMARY KEY, balance REAL DEFAULT 0, auto INTEGER DEFAULT 1, updated_at INTEGER )`).run(); }catch(e){}
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS wallet_txns (
    id TEXT PRIMARY KEY, biz_id TEXT NOT NULL, type TEXT, amount REAL, balance_after REAL,
    note TEXT, method TEXT, status TEXT, ref TEXT, slip TEXT, who TEXT, by TEXT, reason TEXT,
    idem TEXT, created_at INTEGER, handled_at INTEGER )`).run(); }catch(e){}
  try{ await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_wallet_txns_biz ON wallet_txns(biz_id, created_at)').run(); }catch(e){}
  try{ await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_txns_idem ON wallet_txns(biz_id, idem) WHERE idem IS NOT NULL AND idem <> ''").run(); }catch(e){}
  // idempotent ALTER: ตาราง wallet_txns มีอยู่แล้วจากความพยายามก่อนหน้า (คอลัมน์ ref/ts/ref_doc/verified_by) ขาด by/reason/handled_at — เติมให้ครบ
  try{ await env.DB.prepare('ALTER TABLE wallet_txns ADD COLUMN by TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE wallet_txns ADD COLUMN reason TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE wallet_txns ADD COLUMN handled_at INTEGER').run(); }catch(e){}
  // บัญชีรับเงินของ "ร้านนี้เอง" (ต่อ biz) — ใช้ออก QR ต่อบิลรับเงินลูกค้า (แยกจาก wallet_account กลางของระบบใน app_config)
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS wallet_accounts (
    biz_id TEXT PRIMARY KEY, promptpay TEXT, bank TEXT, acct_no TEXT, acct_name TEXT, updated_at INTEGER )`).run(); }catch(e){}
}
async function walletRow(env, biz){
  const w = await env.DB.prepare('SELECT * FROM wallets WHERE biz_id=?').bind(biz).first();
  return w || { biz_id: biz, balance: 0, auto: 1, updated_at: 0 };
}
async function walletPending(env, biz){
  const r = await env.DB.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM wallet_txns WHERE biz_id=? AND type='topup' AND status='pending'").bind(biz).first();
  return { count: (r && r.n) || 0, amount: (r && r.s) || 0 };
}
// ยืนยัน topup ที่ pending → เข้ายอด wallet จริง (ใช้ร่วมกันทั้งแอดมินกดมือ และ auto-match แจ้งเตือนธนาคาร)
// conditional UPDATE (status='pending' เท่านั้นถึงจะเปลี่ยนได้) กันยืนยันซ้ำ/แข่งกัน — คืน {ok:false} ถ้าโดนจัดการไปแล้ว
// gotAmount = ยอดที่โอนเข้าจริง (ถ้ามี) — เข้ากระเป๋าเท่ายอดที่ขอเติมเสมอ ส่วนเศษที่ต่างกันเก็บไว้ใน reason ให้ตรวจย้อนหลังได้
async function confirmWalletTopup(env, txnId, by, gotAmount){
  const cur = await env.DB.prepare('SELECT * FROM wallet_txns WHERE id=?').bind(txnId).first();
  if (!cur) return { ok: false, error: 'transaction not found' };
  if (cur.status !== 'pending') return { ok: false, error: 'รายการนี้ถูกจัดการไปแล้ว' };
  const lock = await env.DB.prepare("UPDATE wallet_txns SET status='confirmed',by=?,handled_at=? WHERE id=? AND status='pending'")
    .bind(by || 'admin', now(), txnId).run();
  if (!(lock.meta && lock.meta.changes)) return { ok: false, error: 'รายการนี้ถูกจัดการไปแล้ว' };
  if (gotAmount != null) {
    const diff = +(Number(gotAmount) - Number(cur.amount)).toFixed(2);
    if (diff) { try { await env.DB.prepare('UPDATE wallet_txns SET reason=? WHERE id=?')
      .bind('โอนจริง ' + Number(gotAmount).toFixed(2) + ' (' + (diff > 0 ? '+' : '') + diff + ')', txnId).run(); } catch (e) {} }
  }
  const w = await walletRow(env, cur.biz_id);
  const bal = Math.round((w.balance + cur.amount) * 100) / 100;
  await env.DB.prepare(`INSERT INTO wallets (biz_id,balance,auto,updated_at) VALUES (?,?,1,?)
    ON CONFLICT(biz_id) DO UPDATE SET balance=excluded.balance, updated_at=excluded.updated_at`).bind(cur.biz_id, bal, now()).run();
  await env.DB.prepare('UPDATE wallet_txns SET balance_after=? WHERE id=?').bind(bal, txnId).run();
  return { ok: true, status: 'confirmed', balance: bal, bizId: cur.biz_id, amount: cur.amount };
}
// idempotent: log การจับคู่แจ้งเตือนธนาคาร → wallet topup (แยกจาก bank_alerts ที่ใช้กับบิลขาย POS)
let _wbaReady = false;
async function ensureWalletBankAlerts(env){ if(_wbaReady) return; _wbaReady = true;
  try{ await env.DB.prepare('CREATE TABLE IF NOT EXISTS wallet_bank_alerts (id TEXT PRIMARY KEY, raw TEXT, amount INTEGER, matched_txn TEXT, matched_biz TEXT, created_at INTEGER)').run(); }catch(e){} }
// จับคู่ข้อความแจ้งเงินเข้า (บัญชีกลางของระบบ ที่ร้านโอนมาเติมกระเป๋า) → topup ที่ pending อยู่ ไม่ผูก shop เดียว (เทียบทุกร้าน)
// จับคู่ด้วยยอด "ปัดเป็นบาทเต็มทั้งสองฝั่ง" — โอน 500.25 หรือ 499.75 ก็นับเป็น 500 ตามที่ขอเติม
// ของเดิมปัดข้างเดียว (ปัดยอดที่ขอ แล้วเทียบกับยอดโอนดิบ ยอมคลาด 0.5) → ยอดลงท้าย .50 ไม่มีวันจับคู่ได้
//   เช่น ขอเติม 500.50 ปัดเป็น 501 ห่างจากยอดโอน 500.50 พอดี 0.5 → ตกเงื่อนไข "< 0.5" ทั้งที่โอนตรงเป๊ะ
// ยอดที่เข้ากระเป๋า = ยอดที่ขอเติม (500) ส่วนต่างเศษสตางค์บันทึกไว้ในรายการให้ตรวจย้อนหลังได้
// เอา pending ที่ค้างนานสุดก่อน (FIFO)
async function autoMatchWalletTopup(env, text){
  await ensureWallet(env); await ensureWalletBankAlerts(env);
  const entries = parseCredits(text || ''); const ts = now(); const matched = [];
  if (entries.length) {
    const { results: rows } = await env.DB.prepare("SELECT * FROM wallet_txns WHERE type='topup' AND status='pending' ORDER BY created_at ASC LIMIT 500").all();
    const used = new Set();
    for (const e of entries) {
      const cand = rows.filter(r => !used.has(r.id) && Math.round(Number(r.amount)) === Math.round(e.amount));
      const aid = 'wba' + ts + Math.random().toString(36).slice(2, 5);
      if (cand.length) {
        const r = cand[0]; used.add(r.id);
        const res = await confirmWalletTopup(env, r.id, 'auto-bank-match', e.amount);
        if (res.ok) {
          await env.DB.prepare('INSERT INTO wallet_bank_alerts (id,raw,amount,matched_txn,matched_biz,created_at) VALUES (?,?,?,?,?,?)')
            .bind(aid, (e.raw || '').slice(0, 200), e.amount, r.id, r.biz_id, ts).run();
          matched.push({ amount: e.amount, txnId: r.id, bizId: r.biz_id });
        }
      } else {
        await env.DB.prepare('INSERT INTO wallet_bank_alerts (id,raw,amount,matched_txn,matched_biz,created_at) VALUES (?,?,?,?,?,?)')
          .bind(aid, (e.raw || '').slice(0, 200), e.amount, null, null, ts).run();
      }
    }
  }
  return { parsed: entries.length, matched: matched.length, matches: matched };
}
// idempotent: ตาราง delivery_settlement_logs (กระทบยอดเดลิเวอรี · Expected vs Actual รายวัน แยกช่องทาง)
let _delSetReady = false;
async function ensureDeliverySettle(env){ if(_delSetReady) return; _delSetReady = true;
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS delivery_settlement_logs (
    id TEXT PRIMARY KEY, shop_id TEXT NOT NULL, channel TEXT NOT NULL, business_date TEXT,
    gross REAL, gp_pct REAL, vat_on_gp INTEGER DEFAULT 0, expected_net REAL,
    actual_received REAL, variance REAL, settlement_date TEXT, note TEXT,
    created_at INTEGER, updated_at INTEGER )`).run(); }catch(e){}
  try{ await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_delset ON delivery_settlement_logs(shop_id, channel, business_date)').run(); }catch(e){} }
const rowDelSet = (r) => ({ id:r.id, channel:r.channel, businessDate:r.business_date, gross:r.gross, gpPct:r.gp_pct, vatOnGp:!!r.vat_on_gp, expectedNet:r.expected_net, actualReceived:r.actual_received, variance:r.variance, settlementDate:r.settlement_date, note:r.note||'', updatedAt:r.updated_at });
// ── (SCHEMA v2) ประวัติธุรกรรมสต๊อก — แหล่งความจริงเดียวของ movement + Running Balance ──
let _invTxReady = false;
async function ensureInvTx(env){ if(_invTxReady) return; _invTxReady = true;
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS inventory_transactions (
    id TEXT PRIMARY KEY, shop_id TEXT NOT NULL, location_id TEXT DEFAULT 'main',
    rm_id TEXT NOT NULL, movement_type TEXT NOT NULL, qty REAL NOT NULL,
    ref_type TEXT, ref_id TEXT, reason TEXT, handled_by TEXT, created_at INTEGER NOT NULL )`).run(); }catch(e){}
  try{ await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_invtx ON inventory_transactions(shop_id, rm_id, created_at)').run(); }catch(e){}
  try{ await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_invtx_type ON inventory_transactions(shop_id, movement_type, created_at)').run(); }catch(e){} }
const rowInvTx = (r) => ({ id:r.id, locationId:r.location_id||'main', rmId:r.rm_id, movementType:r.movement_type, qty:r.qty, refType:r.ref_type||null, refId:r.ref_id||null, reason:r.reason||'', handledBy:r.handled_by||'system', createdAt:r.created_at, runningBalance:(r.running_balance!=null?r.running_balance:undefined) });
// ── (SCHEMA v2) ขายฝาก: vendors · locations · consignment_stock · consignment_documents ──
let _consignReady = false;
async function ensureConsign(env){ if(_consignReady) return; _consignReady = true;
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS vendors ( shop_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, bank TEXT, acct_no TEXT, acct_name TEXT, note TEXT, created_at INTEGER, PRIMARY KEY (shop_id, id) )`).run(); }catch(e){}
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS locations ( shop_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT DEFAULT 'store', address TEXT, lat REAL, lng REAL, partner_name TEXT, partner_phone TEXT, created_at INTEGER, PRIMARY KEY (shop_id, id) )`).run(); }catch(e){}
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS consignment_stock ( shop_id TEXT NOT NULL, id TEXT NOT NULL, direction TEXT NOT NULL, name TEXT NOT NULL, sku TEXT, vendor_id TEXT, location_id TEXT, price INTEGER, settle_model TEXT DEFAULT 'per_sale', share_pct REAL, cost_wholesale INTEGER, rental_fee INTEGER, stock REAL DEFAULT 0, unit TEXT DEFAULT 'pcs', low REAL DEFAULT 0, active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER, PRIMARY KEY (shop_id, id) )`).run(); }catch(e){}
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS consignment_documents ( id TEXT PRIMARY KEY, shop_id TEXT NOT NULL, doc_type TEXT, direction TEXT, vendor_id TEXT, location_id TEXT, period_from TEXT, period_to TEXT, lines TEXT, gross_total INTEGER, payout_total INTEGER, status TEXT DEFAULT 'open', slip TEXT, note TEXT, created_at INTEGER, settled_at INTEGER )`).run(); }catch(e){}
  // เอกสารใบส่งของฝากขาย (delivery note): เลขอ้างอิง CSD-YYYYMMXXXX + ผู้ทำรายการ (idempotent ALTER)
  try{ await env.DB.prepare('ALTER TABLE consignment_documents ADD COLUMN doc_ref TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE consignment_documents ADD COLUMN handled_by TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE consignment_documents ADD COLUMN handled_by_name TEXT').run(); }catch(e){}
  try{ await env.DB.prepare('ALTER TABLE consignment_documents ADD COLUMN received_at INTEGER').run(); }catch(e){} }
const rowVendor = (r) => ({ id:r.id, name:r.name, phone:r.phone||'', bank:r.bank||'', acctNo:r.acct_no||'', acctName:r.acct_name||'', note:r.note||'', createdAt:r.created_at });
const rowLoc = (r) => ({ id:r.id, name:r.name, kind:r.kind||'store', address:r.address||'', lat:r.lat, lng:r.lng, partnerName:r.partner_name||'', partnerPhone:r.partner_phone||'', createdAt:r.created_at });
const rowConsign = (r) => ({ id:r.id, direction:r.direction, name:r.name, sku:r.sku||'', vendorId:r.vendor_id||null, locationId:r.location_id||null, price:r.price||0, settleModel:r.settle_model||'per_sale', sharePct:r.share_pct, costWholesale:r.cost_wholesale, rentalFee:r.rental_fee, stock:r.stock||0, unit:r.unit||'pcs', low:r.low||0, active:!!r.active, createdAt:r.created_at, updatedAt:r.updated_at });
const rowConsignDoc = (r) => ({ id:r.id, docRef:r.doc_ref||null, docType:r.doc_type, direction:r.direction, vendorId:r.vendor_id||null, locationId:r.location_id||null, periodFrom:r.period_from, periodTo:r.period_to, lines:(()=>{ try{ return JSON.parse(r.lines||'[]'); }catch(e){ return []; } })(), grossTotal:r.gross_total||0, payoutTotal:r.payout_total||0, status:r.status||'open', slip:r.slip||null, note:r.note||'', handledBy:r.handled_by||null, handledByName:r.handled_by_name||'', createdAt:r.created_at, settledAt:r.settled_at, receivedAt:r.received_at||null });
// เลขที่เอกสารใบส่งของฝากขาย: CSD-YYYYMM + running 4 หลัก (ต่อร้าน · ผ่านตาราง counters)
async function nextConsignRef(env, shop) {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '');
  const nm = 'csd_' + ym;
  await env.DB.prepare(`INSERT INTO counters (shop_id,name,val) VALUES (?,?,1) ON CONFLICT(shop_id,name) DO UPDATE SET val = val + 1`).bind(shop, nm).run();
  const r = await env.DB.prepare('SELECT val FROM counters WHERE shop_id=? AND name=?').bind(shop, nm).first();
  return 'CSD-' + ym + String(r.val).padStart(4, '0');
}
const rowShop = (r) => { if (!r) return r;
  let ex = {}; try { ex = r.extra ? JSON.parse(r.extra) : {}; } catch (e) {}
  return {
  id: r.id, name: r.name, emoji: r.emoji, logo: r.logo, phone: r.phone, address: r.address,
  open: r.open, close: r.close, isOpen: !!r.is_open, hasPromptpay: !!r.promptpay_id,
  promptpayId: r.promptpay_id, lineOaId: r.line_oa_id, plan: r.plan,
  expiry: r.expiry, status: r.status || 'active', ownerLine: r.owner_line, ownerName: r.owner_name, cat: r.cat, seats: r.seats || 1,
  ...ex,   // lat, lng, map, week, hoursMode, pause, delivery, features (เก็บใน extra JSON)
  };
};

async function nextOrderNo(env, shop) {
  await env.DB.prepare(
    `INSERT INTO counters (shop_id,name,val) VALUES (?,?,1048)
     ON CONFLICT(shop_id,name) DO UPDATE SET val = val + 1`).bind(shop, 'order_no').run();
  const r = await env.DB.prepare('SELECT val FROM counters WHERE shop_id=? AND name=?')
    .bind(shop, 'order_no').first();
  return r.val;
}
async function getShop(env, id) {
  return env.DB.prepare('SELECT * FROM shops WHERE id = ?').bind(id).first();
}
// ── AUDIT: โควตาทดลองข้ามเครื่อง (trial_ledger) + หลักฐานการลบร้านถาวร (deletion_log) ──
let _auditReady = false;
async function ensureAudit(env) {
  if (_auditReady) return;
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS trial_ledger (k TEXT PRIMARY KEY, used INTEGER DEFAULT 0, comp INTEGER DEFAULT 0, first_at INTEGER, last_at INTEGER)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS deletion_log (id INTEGER PRIMARY KEY AUTOINCREMENT, shop_id TEXT, owner_line TEXT, shop_name TEXT, owner_name TEXT, code TEXT, accepted_at INTEGER, package_void INTEGER DEFAULT 0, at INTEGER)').run();
    _auditReady = true;
  } catch (e) {}
}
// สร้าง key โควตา: เบอร์ (10 หลักท้าย) + LINE userId — ตรงกับฝั่ง client (_trialKeys)
function trialKeys(phone, line) {
  const ks = []; const p = String(phone || '').replace(/\D/g, '');
  if (p.length >= 9) ks.push('p:' + p.slice(-10));
  if (line) ks.push('l:' + line);
  return ks;
}
// เลขที่บิล POS (running per ร้าน) — ให้ server เป็นเจ้าของเลข กันชนข้ามเครื่อง
async function nextSaleNo(env, shop) {
  await env.DB.prepare(
    `INSERT INTO counters (shop_id,name,val) VALUES (?,?,1000)
     ON CONFLICT(shop_id,name) DO UPDATE SET val = val + 1`).bind(shop, 'sale_no').run();
  const r = await env.DB.prepare('SELECT val FROM counters WHERE shop_id=? AND name=?')
    .bind(shop, 'sale_no').first();
  return r.val;
}
// isolation helper: หาร้านของเจ้าของ (LINE userId) — คืนแถวเก่าสุด (กันเผลอมีหลายร้าน)
async function getShopByOwner(env, line) {
  if (!line) return null;
  return env.DB.prepare('SELECT * FROM shops WHERE owner_line = ? ORDER BY created_at ASC LIMIT 1').bind(line).first();
}

/* ── Durable Object: ShopHub — 1 instance ต่อร้าน ถือ WebSocket ทุกเครื่องของร้านนั้น แล้ว fan-out ── */
export class ShopHub {
  constructor(state, env){ this.state = state; this.env = env; this.sockets = new Set(); }
  async fetch(req){
    const url = new URL(req.url);
    // ภายใน: main worker เรียก POST /broadcast เพื่อกระจายข้อความสด
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

    // shopId มาจาก query / header / body (อ่าน body ครั้งเดียวแล้ว reuse)
    let body = null;
    const readBody = async () => { if (body === null) { try { body = await req.json(); } catch { body = {}; } } return body; };
    const shopFromReq = async () => url.searchParams.get('shop') || req.headers.get('X-Shop') || (await readBody()).shopId || (await readBody()).shop;

    try {
      if (path === '/' || path === '/health') return json({ ok: true, service: 'kaidee-pos', multiTenant: true, realtime: !!env.SHOP_HUB }, req);

      /* ── REALTIME (WebSocket · Durable Object ShopHub) — เปิด-ปิดร้าน/สิทธิ์/ออเดอร์ push สดถึงทุกเครื่อง ── */
      if (seg[0] === 'ws') {
        if (!env.SHOP_HUB) return err('realtime not configured — ต้องผูก Durable Object SHOP_HUB (ดู REALTIME-DEPLOY.md)', req, 501);
        const sh = url.searchParams.get('shop') || req.headers.get('X-Shop');
        if (!sh) return err('shop required', req, 400);
        return env.SHOP_HUB.get(env.SHOP_HUB.idFromName(sh)).fetch(req);
      }

      /* ── ADMIN AUTH (Back Office) ── */
      if (seg[0] === 'admin') {
        // POST /admin/login {pass} → { ok, token } · rate-limited ต่อ IP กัน brute-force
        if (req.method === 'POST' && seg[1] === 'login') {
          const ip = clientIp(req);
          const lock = await loginLockStatus(env, ip);
          if (lock.locked) return json({ ok: false, error: `ลองผิดหลายครั้งเกินไป กรุณารอ ${Math.ceil(lock.retryAfterMs / 60e3)} นาทีแล้วลองใหม่`, retryAfterMs: lock.retryAfterMs }, req, 429);
          const b = await readBody();
          const want = await getAdminHash(env);
          const ok = await sha256hex(b.pass || '') === want;
          await loginRecordResult(env, ip, ok);
          if (ok) return json({ ok: true, token: await makeToken(env) }, req);
          return json({ ok: false, error: 'รหัสไม่ถูกต้อง' }, req, 401);
        }
        // POST /admin/verify {token} → { ok }
        if (req.method === 'POST' && seg[1] === 'verify') {
          const b = await readBody();
          return json({ ok: await verifyToken(env, b.token) }, req);
        }
        // POST /admin/password {token,current,next} → เปลี่ยนรหัส (เก็บใน app_config)
        if (req.method === 'POST' && seg[1] === 'password') {
          const b = await readBody();
          const okTok = await verifyToken(env, b.token);
          const okCur = await sha256hex(b.current || '') === await getAdminHash(env);
          if (!okTok && !okCur) return json({ ok: false, error: 'ไม่มีสิทธิ์' }, req, 403);
          if (!okCur) return json({ ok: false, error: 'รหัสเดิมไม่ถูกต้อง' }, req, 401);
          if ((b.next || '').length < 6) return json({ ok: false, error: 'รหัสใหม่ต้องอย่างน้อย 6 ตัว' }, req, 400);
          const v = JSON.stringify({ passHash: await sha256hex(b.next), updatedAt: now() });
          await env.DB.prepare("INSERT INTO app_config (k,v) VALUES ('admin',?) ON CONFLICT(k) DO UPDATE SET v=?").bind(v, v).run();
          return json({ ok: true }, req);
        }
        // POST /admin/reset/request → ส่ง OTP 6 หลักไปเบอร์เจ้าของระบบ
        if (req.method === 'POST' && seg[1] === 'reset' && seg[2] === 'request') {
          const cfg = await adminCfg(env);
          const phone = cfg.phone || env.ADMIN_PHONE || '';
          const lineUser = cfg.lineUser || env.ADMIN_LINE_USER || '';
          if (!phone && !lineUser)
            return json({ ok: false, error: 'ยังไม่ได้ตั้งเบอร์เจ้าของระบบ — ตั้ง secret ADMIN_PHONE (หรือ ADMIN_LINE_USER) ที่ Worker ก่อน' }, req, 501);
          if (cfg.rstAt && now() - cfg.rstAt < 60e3)
            return json({ ok: false, error: 'เพิ่งส่งไปเมื่อครู่ — รอ ' + Math.ceil((60e3 - (now() - cfg.rstAt)) / 1000) + ' วินาที' }, req, 429);
          const otp = String(Math.floor(100000 + Math.random() * 900000));
          const text = 'KaiDee POS: รหัสยืนยันรีเซ็ตรหัสแอดมิน ' + otp + ' (ใช้ได้ 10 นาที · ห้ามบอกใคร)';
          let via = '';
          if (phone && await sendSMS(env, phone, text)) via = 'sms';
          else if (lineUser && await linePush(env, lineUser, [{ type: 'text', text }])) via = 'line';
          if (!via) return json({ ok: false, error: 'ส่งรหัสไม่สำเร็จ — ตรวจ secret SMS_ENDPOINT/SMS_KEY (หรือ SMS_PROVIDER=twilio) และ LINE_TOKEN' }, req, 501);
          await adminCfgSave(env, { rstHash: await sha256hex(otp + '|' + (digitsOnly(phone) || lineUser)), rstExp: now() + 600e3, rstTries: 0, rstAt: now() });
          return json({ ok: true, phone: phone ? maskPhone(phone) : 'LINE', via, expiresIn: 600 }, req);
        }
        // POST /admin/reset/confirm {otp,next} → ตั้งรหัสใหม่
        if (req.method === 'POST' && seg[1] === 'reset' && seg[2] === 'confirm') {
          const b = await readBody();
          const cfg = await adminCfg(env);
          const phone = cfg.phone || env.ADMIN_PHONE || '';
          const lineUser = cfg.lineUser || env.ADMIN_LINE_USER || '';
          if (!cfg.rstHash || !cfg.rstExp) return json({ ok: false, error: 'ยังไม่ได้ขอรหัสยืนยัน' }, req, 400);
          if (now() > cfg.rstExp) { await adminCfgSave(env, { rstHash: null, rstExp: null }); return json({ ok: false, error: 'รหัสยืนยันหมดอายุ — กดส่งใหม่' }, req, 400); }
          if ((cfg.rstTries || 0) >= 5) return json({ ok: false, error: 'ใส่ผิดเกิน 5 ครั้ง — กดส่งรหัสใหม่' }, req, 429);
          if (await sha256hex(digitsOnly(b.otp) + '|' + (digitsOnly(phone) || lineUser)) !== cfg.rstHash) {
            await adminCfgSave(env, { rstTries: (cfg.rstTries || 0) + 1 });
            return json({ ok: false, error: 'รหัสยืนยันไม่ถูกต้อง (เหลือ ' + (4 - (cfg.rstTries || 0)) + ' ครั้ง)' }, req, 401);
          }
          if ((b.next || '').length < 6) return json({ ok: false, error: 'รหัสใหม่ต้องอย่างน้อย 6 ตัว' }, req, 400);
          await adminCfgSave(env, { passHash: await sha256hex(b.next), rstHash: null, rstExp: null, rstTries: 0 });
          return json({ ok: true, token: await makeToken(env) }, req);
        }
      }

      /* ── IMAGE UPLOAD → R2 (slips/logos) ── */
      if (seg[0] === 'upload' && req.method === 'POST') {
        if (!env.SLIPS) return err('image storage not configured', req, 501);
        const b = await readBody();
        const m = /^data:(image\/\w+);base64,(.+)$/.exec(b.image || '');
        if (!m) return err('bad image', req);
        const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
        if (bytes.length > 3 * 1024 * 1024) return err('image too large (max 3MB)', req, 413);
        const folder = (b.folder || 'misc').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'misc';
        const key = `${folder}/${now()}-${Math.random().toString(36).slice(2, 8)}.${m[1].split('/')[1]}`;
        await env.SLIPS.put(key, bytes, { httpMetadata: { contentType: m[1] } });
        return json({ ok: true, url: `${url.origin}/img/${key}`, key }, req, 201);
      }
      // GET /img/<key> — เสิร์ฟรูปจาก R2
      if (seg[0] === 'img' && req.method === 'GET' && env.SLIPS) {
        const obj = await env.SLIPS.get(seg.slice(1).join('/'));
        if (!obj) return err('not found', req, 404);
        return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'image/jpeg', 'cache-control': 'public, max-age=31536000', ...cors(req) } });
      }

      /* ── PAYMENT GATEWAY (scaffold) ──
       * เปิดใช้เมื่อมี merchant + secret key: ตั้ง secret PAY_PROVIDER (omise|gbprimepay|2c2p)
       * + PAY_SECRET_KEY. โครงพร้อมต่อ charge/recurring — ตอนนี้คืน 501 ถ้ายังไม่ตั้งค่า */
      if (seg[0] === 'pay') {
        const provider = env.PAY_PROVIDER;
        // GET /pay/status — ฝั่ง client เช็คว่าตัดเงินอัตโนมัติพร้อมใช้ไหม
        if (req.method === 'GET' && seg[1] === 'status')
          return json({ enabled: !!(provider && env.PAY_SECRET_KEY), provider: provider || null }, req);
        // POST /pay/charge {shopId, token/card, amount, months} — ตัดเงินจริง (ต้องมี provider)
        if (req.method === 'POST' && seg[1] === 'charge') {
          if (!provider || !env.PAY_SECRET_KEY)
            return json({ ok: false, error: 'payment gateway ยังไม่ถูกตั้งค่า — ใช้แจ้งชำระแบบพร้อมเพย์ไปก่อน', fallback: 'promptpay' }, req, 501);
          // TODO: เรียก API ผู้ให้บริการตาม provider แล้วบันทึกผลเป็น pay_request status=confirmed
          return json({ ok: false, error: 'provider ' + provider + ' ยังไม่ได้ต่อ handler' }, req, 501);
        }
        // POST /pay/webhook — ผู้ให้บริการยิงกลับเมื่อชำระสำเร็จ (ต่อภายหลัง)
        if (req.method === 'POST' && seg[1] === 'webhook') return json({ ok: true, received: true }, req);
      }

      /* ── TRIAL LEDGER (โควตาทดลองข้ามเครื่อง) + DELETION LOG (หลักฐานการลบร้าน) ── */
      // GET /trial-check?phone=&line=  → { used, comp, quota } (รวมทุกเครื่อง)
      if (seg[0] === 'trial-check' && req.method === 'GET') {
        await ensureAudit(env);
        const keys = trialKeys(url.searchParams.get('phone') || '', url.searchParams.get('line') || '');
        let used = 0, comp = false;
        for (const k of keys) { const r = await env.DB.prepare('SELECT used,comp FROM trial_ledger WHERE k=?').bind(k).first(); if (r) { used = Math.max(used, r.used || 0); if (r.comp) comp = true; } }
        let quota = 1;
        try { const pc = await env.DB.prepare("SELECT v FROM app_config WHERE k='packages'").first(); if (pc) { const pj = JSON.parse(pc.v || '{}'); if (pj.trialQuota != null) quota = Math.max(0, pj.trialQuota); } } catch (e) {}
        return json({ used, comp, quota }, req);
      }
      // POST /trial-consume {phone,line}  → บันทึกการใช้สิทธิ์ทดลอง (ข้ามเครื่อง)
      if (seg[0] === 'trial-consume' && req.method === 'POST') {
        await ensureAudit(env);
        const b = await readBody();
        const keys = trialKeys(b.phone || '', b.line || ''); const ts = now();
        for (const k of keys) { await env.DB.prepare('INSERT INTO trial_ledger (k,used,comp,first_at,last_at) VALUES (?,1,0,?,?) ON CONFLICT(k) DO UPDATE SET used=used+1,last_at=?').bind(k, ts, ts, ts).run(); }
        let used = 0; for (const k of keys) { const r = await env.DB.prepare('SELECT used FROM trial_ledger WHERE k=?').bind(k).first(); if (r) used = Math.max(used, r.used || 0); }
        return json({ ok: true, used }, req);
      }
      // POST /trial-comp {phone,line,comp} (แอดมิน) → ตั้ง/ยกเลิกสิทธิ์ใช้ฟรีตลอด (UAT)
      if (seg[0] === 'trial-comp' && req.method === 'POST') {
        const tok = req.headers.get('X-Admin-Token'); if (!(await verifyToken(env, tok))) return json({ ok:false, error:'ไม่มีสิทธิ์' }, req, 403);
        await ensureAudit(env); const b = await readBody(); const keys = trialKeys(b.phone || '', b.line || ''); const ts = now(); const c = b.comp === false ? 0 : 1;
        for (const k of keys) { await env.DB.prepare('INSERT INTO trial_ledger (k,used,comp,first_at,last_at) VALUES (?,0,?,?,?) ON CONFLICT(k) DO UPDATE SET comp=?,last_at=?').bind(k, c, ts, ts, c, ts).run(); }
        return json({ ok: true }, req);
      }
      // GET /deletion-log (แอดมิน) → รายการลบร้านทั้งหมด (หลักฐานถาวร)
      if (seg[0] === 'deletion-log' && req.method === 'GET') {
        const tok = req.headers.get('X-Admin-Token') || url.searchParams.get('token');
        if (!(await verifyToken(env, tok))) return json({ ok:false, error:'ไม่มีสิทธิ์' }, req, 403);
        await ensureAudit(env);
        const { results } = await env.DB.prepare('SELECT * FROM deletion_log ORDER BY at DESC LIMIT 500').all();
        return json({ ok: true, logs: results || [] }, req);
      }

      /* ── SHOPS (tenant registry) ── */
      if (seg[0] === 'shops') {
        // POST /shops — สมัครร้านใหม่
        if (req.method === 'POST' && !seg[1]) {
          const b = await readBody();
          if (!b.name) return err('name required', req);
          // ── ISOLATION (B): ถ้าเจ้าของ (LINE) นี้มีร้านแล้ว → คืนร้านเดิม ไม่สร้าง/ทับซ้ำ ──
          if (b.ownerLine) {
            const mine = await getShopByOwner(env, b.ownerLine);
            if (mine) return json({ ok: true, shopId: mine.id, shop: rowShop(mine), existing: true }, req, 200);
          }
          let id = (b.id || b.name).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
          if (!id) id = 's' + now();
          // ── ISOLATION (C): สงวน id 'kaidee' ให้ร้านตัวอย่าง — ร้านจริงห้ามใช้ ──
          if (id === 'kaidee') id = 'kaidee-' + now().toString(36).slice(-5);
          // กันชนกัน — ต่อท้ายเลขถ้า id ซ้ำ
          if (await getShop(env, id)) id = id + '-' + Math.random().toString(36).slice(2, 6);
          const ts = now();
          let trialDays = 30;
          try { const pc = await env.DB.prepare("SELECT v FROM app_config WHERE k='packages'").first(); if (pc) { const pj = JSON.parse(pc.v||'{}'); if (pj.trialDays) trialDays = pj.trialDays; } } catch (e) {}
          const trialExp = new Date(ts + trialDays*864e5).toISOString();   // ทดลองฟรีตามที่ตั้งใน Back Office
          await env.DB.prepare(
            `INSERT INTO shops (id,name,emoji,logo,phone,address,open,close,is_open,promptpay_id,line_oa_id,plan,expiry,status,owner_line,owner_name,cat,created_at,updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          ).bind(id, b.name, b.emoji || '🍽️', b.logo || null, b.phone || '', b.address || '',
                 b.open || '09:00', b.close || '20:00', 1, b.promptpayId || '', b.lineOaId || '', 'trial',
                 trialExp, 'active', b.ownerLine || null, b.ownerName || null, b.cat || null, ts, ts).run();
          await env.DB.prepare('INSERT OR IGNORE INTO counters (shop_id,name,val) VALUES (?,?,1000)').bind(id, 'order_no').run();
          return json({ ok: true, shopId: id, shop: rowShop(await getShop(env, id)) }, req, 201);
        }
        // POST /shops/welcome — push ข้อความต้อนรับเข้า LINE เจ้าของ หลังสมัครร้านใหม่
        if (req.method === 'POST' && seg[1] === 'welcome') {
          const b = await readBody();
          const to = b.ownerLine || b.line;
          if (!to) return json({ ok: false, error: 'ownerLine required' }, req, 400);
          const name = b.name || b.shopName || 'ร้านของคุณ';
          const cust = b.custUrl ? ('\n\n🔗 ลิงก์ให้ลูกค้าสั่งอาหาร:\n' + b.custUrl) : '';
          const ok = await linePush(env, to, [{ type: 'text',
            text: `🎉 สมัครร้าน "${name}" เรียบร้อยแล้ว!\nเริ่มขายผ่าน KaiDee POS ได้เลย${cust}` }]);
          return json({ ok, pushed: ok }, req, 200);
        }
        // GET /shops/stats — ยอดรวมต่อร้าน (orders + gmv + last) สำหรับ Overview/ตารางแอดมิน  (ต้องอยู่ก่อน /:id)
        if (req.method === 'GET' && seg[1] === 'stats') {
          const { results } = await env.DB.prepare(
            `SELECT shop_id, COUNT(*) AS orders,
                    SUM(CASE WHEN status!='cancel' THEN total ELSE 0 END) AS gmv,
                    MAX(updated_at) AS last
             FROM orders GROUP BY shop_id`).all();
          const out = {}; for (const r of results) out[r.shop_id] = { orders: r.orders || 0, gmv: r.gmv || 0, last: r.last || 0 };
          return json(out, req);
        }
        // ── ISOLATION (A): GET /shops/by-owner?line=<lineUserId> — หาร้านของเจ้าของ (ต้องอยู่ก่อน /:id) ──
        if (req.method === 'GET' && seg[1] === 'by-owner') {
          const line = url.searchParams.get('line');
          const s = await getShopByOwner(env, line);   // ไม่มี line/ไม่เจอ = null (คืน null ให้ client รู้ว่าว่าง)
          if (!s) return json(null, req);
          return json(rowShop(s), req);
        }
        // GET /shops/by-market?market=<slug> — ร้านทั้งหมดในตลาด/พื้นที่เดียวกัน (หน้า "ร้านในตลาดนี้" ฝั่งลูกค้า) · ต้องอยู่ก่อน /:id
        // market เก็บใน extra JSON เหมือน lat/lng/week ฯลฯ — ตั้งผ่าน PATCH /shops/:id {market:'...'}
        if (req.method === 'GET' && seg[1] === 'by-market') {
          const market = url.searchParams.get('market');
          if (!market) return json([], req);
          const { results } = await env.DB.prepare("SELECT * FROM shops WHERE status='active' ORDER BY is_open DESC, name").all();
          const list = results.map(rowShop).filter(s => s.market === market);
          return json(await attachRatings(env, await attachShopPromos(env, list)), req);
        }
        // GET /shops/directory — ร้านทั้งหมดทุกตลาดรวมฟีดเดียว (หน้า "ร้านทั้งหมด" ฝั่งลูกค้า แบบ Grab) · ต้องอยู่ก่อน /:id
        // เฉพาะร้านที่ตั้ง market ไว้แล้วเท่านั้น (ร้านที่ยังไม่เข้าตลาดไหนจะไม่โผล่ในฟีดรวม) · เรียงตามตลาด → เปิดก่อน → ชื่อ
        if (req.method === 'GET' && seg[1] === 'directory') {
          const { results } = await env.DB.prepare("SELECT * FROM shops WHERE status='active' ORDER BY is_open DESC, name").all();
          const list = results.map(rowShop).filter(s => s.market)
            .sort((a, b) => (a.market || '').localeCompare(b.market || '', 'th'));
          return json(await attachRatings(env, await attachShopPromos(env, list)), req);
        }
        // ── OWNER LOGIN (Backoffice) : POST /shops/:id/owner-login {line} | {pin} → owner token ──
        if (req.method === 'POST' && seg[1] && seg[2] === 'owner-login') {
          const b = await readBody();
          const cur = await getShop(env, seg[1]);
          if (!cur) return err('shop not found', req, 404);
          let ok = false;
          if (b.line && cur.owner_line && String(b.line) === String(cur.owner_line)) ok = true;         // LINE เจ้าของ
          if (!ok && b.pin) { const h = await getShopOwnerPin(env, seg[1]); if (h && await sha256hex(String(b.pin)) === h) ok = true; }  // PIN
          if (!ok) return json({ ok: false, error: 'ยืนยันตัวตนเจ้าของร้านไม่สำเร็จ' }, req, 401);
          return json({ ok: true, token: await makeOwnerToken(env, seg[1]), shop: rowShop(cur), hasPin: !!(await getShopOwnerPin(env, seg[1])) }, req);
        }
        // POST /shops/:id/owner-verify {token} → { ok }
        if (req.method === 'POST' && seg[1] && seg[2] === 'owner-verify') {
          const b = await readBody();
          return json({ ok: await verifyOwnerToken(env, seg[1], b.token) }, req);
        }
        // POST /shops/:id/admin-access {token} → แอดมินแอป (app owner) สวมเข้า Backoffice ร้าน + เก็บ access log (PDPA)
        if (req.method === 'POST' && seg[1] && seg[2] === 'admin-access') {
          const b = await readBody();
          const tok = req.headers.get('X-Admin-Token') || b.token;
          if (!(await verifyToken(env, tok))) return json({ ok: false, error: 'ต้องเป็นแอดมินแอป' }, req, 403);
          const cur = await getShop(env, seg[1]);
          if (!cur) return err('shop not found', req, 404);
          await ensureAdminLog(env);
          try { await env.DB.prepare('INSERT INTO admin_access_log (id,shop_id,shop_name,action,by,at) VALUES (?,?,?,?,?,?)')
            .bind('al' + now() + Math.random().toString(36).slice(2, 5), seg[1], cur.name || '', 'backoffice_access', b.by || 'admin', now()).run(); } catch (e) {}
          // TTL ตามที่แอดมินตั้งใน access-config (ชั่วโมง/วัน) — token หมดอายุตามนั้น
          let _ttl = 12 * 3600e3;
          try { const ac = await env.DB.prepare("SELECT v FROM app_config WHERE k='access'").first();
            if (ac) { const j = JSON.parse(ac.v || '{}'); const n = Math.max(1, parseInt(j.value,10)||12); _ttl = (j.unit==='days') ? n*864e5 : n*3600e3; } } catch (e) {}
          return json({ ok: true, token: await makeOwnerToken(env, seg[1], _ttl), shop: rowShop(cur), impersonated: true, ttlMs: _ttl }, req);
        }
        // GET /shops/:id/admin-access-log — ประวัติแอดมินเข้าดูร้าน (แอดมินเท่านั้น)
        if (req.method === 'GET' && seg[1] && seg[2] === 'admin-access-log') {
          const tok = req.headers.get('X-Admin-Token') || url.searchParams.get('token');
          if (!(await verifyToken(env, tok))) return json({ error: 'admin only' }, req, 403);
          await ensureAdminLog(env);
          const { results } = await env.DB.prepare('SELECT * FROM admin_access_log WHERE shop_id=? ORDER BY at DESC LIMIT 200').bind(seg[1]).all();
          return json(results, req);
        }
        // POST /shops/:id/owner-pin {line|token, pin} → ตั้ง/เปลี่ยน PIN (ต้องเป็นเจ้าของ: LINE ตรง หรือ owner token)
        if (req.method === 'POST' && seg[1] && seg[2] === 'owner-pin') {
          const b = await readBody();
          const cur = await getShop(env, seg[1]);
          if (!cur) return err('shop not found', req, 404);
          const okLine = b.line && cur.owner_line && String(b.line) === String(cur.owner_line);
          const okTok = b.token && await verifyOwnerToken(env, seg[1], b.token);
          if (!okLine && !okTok) return json({ ok: false, error: 'ไม่มีสิทธิ์ตั้ง PIN' }, req, 403);
          if (!/^\d{4,8}$/.test(String(b.pin || ''))) return json({ ok: false, error: 'PIN ต้อง 4-8 หลัก' }, req, 400);
          const r = await env.DB.prepare('SELECT data FROM settings WHERE shop_id=?').bind(seg[1]).first();
          const d = { ...(r ? JSON.parse(r.data || '{}') : {}), ownerPinHash: await sha256hex(String(b.pin)) };
          await env.DB.prepare('INSERT INTO settings (shop_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(shop_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at').bind(seg[1], JSON.stringify(d), now()).run();
          return json({ ok: true }, req);
        }
        // GET /shops/:id — ข้อมูลร้าน (ลูกค้าใช้แสดงหน้าร้าน)
        if (req.method === 'GET' && seg[1]) {
          const s = await getShop(env, seg[1]);
          if (!s) return err('shop not found', req, 404);
          // ติดคะแนนดาวจริงมาด้วย — หน้าร้านฝั่งลูกค้าเคยโชว์ ★4.8 เท่ากันทุกร้านแบบไม่มีที่มา
          return json((await attachRatings(env, [rowShop(s)]))[0], req);
        }
        // GET /shops — รายชื่อร้าน (สำหรับ admin/เลือกร้าน)
        if (req.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM shops ORDER BY created_at DESC LIMIT 500').all();
          return json(results.map(rowShop), req);
        }
        // POST /shops/:id/device — ลงทะเบียนเครื่อง + เช็คโควตาตามแพ็กเกจ (seats)
        if (req.method === 'POST' && seg[1] && seg[2] === 'device') {
          const b = await readBody();
          const dev = (b.deviceId || '').slice(0, 64);
          const cur = await getShop(env, seg[1]);
          if (!cur || !dev) return err('bad request', req);
          const ts = now();
          await env.DB.prepare('INSERT INTO devices (shop_id,device_id,last_seen) VALUES (?,?,?) ON CONFLICT(shop_id,device_id) DO UPDATE SET last_seen=?').bind(seg[1], dev, ts, ts).run();
          const active = ts - 2 * 864e5;   // ใช้งานภายใน 2 วัน = active
          const { results } = await env.DB.prepare('SELECT device_id FROM devices WHERE shop_id=? AND last_seen>=? ORDER BY last_seen DESC').bind(seg[1], active).all();
          const limit = cur.seats || 1;
          const ids = results.map(r => r.device_id);
          const idx = ids.indexOf(dev);
          return json({ allowed: idx >= 0 && idx < limit, count: ids.length, limit }, req);
        }
        // PATCH /shops/:id/plan — จัดการแพ็กเกจ (แอดมิน): อัปเกรด/ต่ออายุ/ระงับ
        if (req.method === 'PATCH' && seg[1] && seg[2] === 'plan') {
          const b = await readBody();
          const cur = await getShop(env, seg[1]);
          if (!cur) return err('shop not found', req, 404);
          let plan = b.plan || cur.plan;
          let status = b.status || cur.status || 'active';
          let expiry = cur.expiry;
          if (b.expiry) expiry = b.expiry;
          else if (b.addDays) {                       // ต่ออายุ N วัน จากวันหมดเดิม (หรือวันนี้ถ้าเลยมาแล้ว)
            const base = Math.max(Date.now(), cur.expiry ? new Date(cur.expiry).getTime() : 0);
            expiry = new Date(base + b.addDays*864e5).toISOString();
          }
          let seats = (b.seats!=null) ? b.seats : (cur.seats||1);
          await env.DB.prepare('UPDATE shops SET plan=?,status=?,expiry=?,seats=?,updated_at=? WHERE id=?')
            .bind(plan, status, expiry, seats, now(), seg[1]).run();
          return json({ ok: true, shop: rowShop(await getShop(env, seg[1])) }, req);
        }
        // POST /shops/:id/reset — ล้างข้อมูลร้านกลับค่าเริ่มต้น (ออเดอร์/สมาชิก/ตัวนับ) · เก็บบัญชี+เมนู+ตั้งค่า
        if (req.method === 'POST' && seg[1] && seg[2] === 'reset') {
          const b = await readBody();
          const tok = req.headers.get('X-Admin-Token') || b.token;
          const cur = await getShop(env, seg[1]);
          if (!cur) return err('shop not found', req, 404);
          // อนุญาต: แอดมิน (token) หรือ เจ้าของร้านเอง (ownerLine ตรงกับ owner_line) → ให้ร้านล้างข้อมูลตัวเองจากในแอปได้
          const okAdmin = await verifyToken(env, tok);
          const okOwner = !!(b.ownerLine && cur.owner_line && String(b.ownerLine) === String(cur.owner_line));
          if (!okAdmin && !okOwner) return json({ ok: false, error: 'ไม่มีสิทธิ์' }, req, 403);
          const wipeMenu = !!b.wipeMenu;   // เผื่ออยากล้างเมนูด้วย (default: เก็บเมนูไว้)
          const rnow = Date.now();
          const od = await env.DB.prepare('DELETE FROM orders WHERE shop_id=?').bind(seg[1]).run();
          const sl = await env.DB.prepare('DELETE FROM sales WHERE shop_id=?').bind(seg[1]).run();   // ⭐ ล้างยอดขายจริง (เดิมตกหล่น)
          await env.DB.prepare('DELETE FROM members WHERE shop_id=?').bind(seg[1]).run();
          await env.DB.prepare("UPDATE counters SET val=1048 WHERE shop_id=? AND name='order_no'").bind(seg[1]).run();
          if (wipeMenu) { for (const t of ['menu','raw','purchases','cash_days','quotes']) { try { await env.DB.prepare(`DELETE FROM ${t} WHERE shop_id=?`).bind(seg[1]).run(); } catch (e) {} } }
          // ⭐ ฝัง reset marker ลง settings blob → เครื่องร้านเห็นตอนโหลด แล้วเคลียร์ข้อมูลใน localStorage เอง
          try {
            const curS = await env.DB.prepare('SELECT data FROM settings WHERE shop_id=?').bind(seg[1]).first();
            const sd = { ...(curS ? JSON.parse(curS.data||'{}') : {}), resetAt: rnow, resetAll: wipeMenu };
            if (wipeMenu) sd.register = { open:false, openFloat:0, openedAt:null, moves:[] };
            await env.DB.prepare('INSERT INTO settings (shop_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(shop_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at').bind(seg[1], JSON.stringify(sd), now()).run();
          } catch (e) {}
          await env.DB.prepare('UPDATE shops SET updated_at=? WHERE id=?').bind(now(), seg[1]).run();
          // ⭐ หลักฐานการลบร้านถาวร (consent จากในแอป) → backoffice ตรวจได้
          try {
            if (b.consent) { await ensureAudit(env); const c = b.consent;
              await env.DB.prepare('INSERT INTO deletion_log (shop_id,owner_line,shop_name,owner_name,code,accepted_at,package_void,at) VALUES (?,?,?,?,?,?,?,?)')
                .bind(seg[1], String(b.ownerLine || c.ownerLine || cur.owner_line || ''), String(c.shopName || cur.name || ''), String(c.ownerName || ''), String(c.code || ''), c.acceptedAt || null, c.packageVoidAck ? 1 : 0, rnow).run(); }
          } catch (e) {}
          return json({ ok: true, cleared: { orders: od.meta?.changes || 0, sales: sl.meta?.changes || 0, menu: wipeMenu } }, req);
        }
        // DELETE /shops/:id — ลบร้านถาวร (แอดมิน) + cascade ทุกตารางของร้าน
        if (req.method === 'DELETE' && seg[1]) {
          const b = await readBody();
          const tok = req.headers.get('X-Admin-Token') || b.token;
          if (!(await verifyToken(env, tok))) return json({ ok: false, error: 'ไม่มีสิทธิ์' }, req, 403);
          const cur = await getShop(env, seg[1]);
          if (!cur) return err('shop not found', req, 404);
          const tbls = ['orders','sales','members','menu','raw','purchases','cash_days','quotes','settings','devices','counters',
            'pay_requests','vendors','locations','consignment_stock','consignment_documents','inventory_transactions',
            'delivery_settlement_logs','refunds','code_requests','line_pairs','admin_access_log','bank_alerts'];
          for (const t of tbls) { try { await env.DB.prepare(`DELETE FROM ${t} WHERE shop_id=?`).bind(seg[1]).run(); } catch (e) {} }
          // wallet ผูกด้วย biz_id ไม่ใช่ shop_id — ลบแยก
          for (const t of ['wallets','wallet_txns','wallet_accounts']) { try { await env.DB.prepare(`DELETE FROM ${t} WHERE biz_id=?`).bind(seg[1]).run(); } catch (e) {} }
          await env.DB.prepare('DELETE FROM shops WHERE id=?').bind(seg[1]).run();
          return json({ ok: true, deleted: seg[1] }, req);
        }
        // PATCH /shops/:id — แก้ข้อมูลร้าน/พร้อมเพย์
        if (req.method === 'PATCH' && seg[1]) {
          const b = await readBody();
          const cur = await getShop(env, seg[1]);
          if (!cur) return err('shop not found', req, 404);
          const f = (k, d) => (b[k] !== undefined ? b[k] : d);
          // extended fields → เก็บใน extra JSON (lat/lng/map/week/hoursMode/pause/delivery/features)
          let extra = {}; try { extra = cur.extra ? JSON.parse(cur.extra) : {}; } catch (e) {}
          ['lat','lng','map','week','hoursMode','pause','delivery','features','cover','addons','market','marketOpen'].forEach(k => { if (b[k] !== undefined) extra[k] = b[k]; });
          // backfill เจ้าของ: ผูก owner_line ได้เฉพาะตอนยังว่าง (กันคนอื่นแย่งสิทธิ์ร้าน)
          let ownerLine = cur.owner_line;
          if (b.ownerLine && !cur.owner_line) ownerLine = b.ownerLine;
          const ownerName = (b.ownerName && !cur.owner_name) ? b.ownerName : cur.owner_name;
          await env.DB.prepare(
            `UPDATE shops SET name=?,emoji=?,logo=?,phone=?,address=?,open=?,close=?,is_open=?,promptpay_id=?,line_oa_id=?,owner_line=?,owner_name=?,extra=?,updated_at=? WHERE id=?`
          ).bind(f('name', cur.name), f('emoji', cur.emoji), f('logo', cur.logo), f('phone', cur.phone), f('address', cur.address),
                 f('open', cur.open), f('close', cur.close), f('isOpen', cur.is_open) ? 1 : 0,
                 f('promptpayId', cur.promptpay_id), f('lineOaId', cur.line_oa_id), ownerLine || null, ownerName || null, JSON.stringify(extra), now(), seg[1]).run();
          const _upd = await getShop(env, seg[1]);
          // เปิด-ปิดร้าน/เวลาเปลี่ยน → push สดถึงทุกเครื่อง (พนักงาน+ลูกค้า) ไม่ต้องรีเฟรช
          if (b.isOpen !== undefined || b.open !== undefined || b.close !== undefined)
            ctx.waitUntil(hubBroadcast(env, seg[1], { type: 'shop', isOpen: !!_upd.is_open, open: _upd.open, close: _upd.close }));
          return json({ ok: true, shop: rowShop(_upd) }, req);
        }
      }

      /* ── PAY REQUESTS (คำขอชำระเงิน manual) — ไม่ผูก shop scope ── */
      if (seg[0] === 'pay-requests') {
        await ensurePayReqCols(env);
        // POST /pay-requests — ร้านแจ้งชำระ + แนบสลิป
        if (req.method === 'POST' && !seg[1]) {
          const b = await readBody();
          if (!b.shopId) return err('shopId required', req);
          const id = 'pr' + now() + Math.random().toString(36).slice(2, 5);
          // แนบสลิปเป็น data URL + มี R2 → อัปโหลดเก็บเป็นลิงก์ (ไม่บวมใน DB)
          let slip = b.slip || null;
          if (slip && env.SLIPS) {
            const m = /^data:(image\/\w+);base64,(.+)$/.exec(slip);
            if (m) { try {
              const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
              const key = `payslip/${b.shopId}/${id}.${m[1].split('/')[1]}`;
              await env.SLIPS.put(key, bytes, { httpMetadata: { contentType: m[1] } });
              slip = `${url.origin}/img/${key}`;
            } catch (e) {} }
          }
          await env.DB.prepare(
            `INSERT INTO pay_requests (id,shop_id,shop_name,amount,months,slip,note,kind,addon,status,created_at)
             VALUES (?,?,?,?,?,?,?,?,?, 'pending', ?)`
          ).bind(id, b.shopId, b.shopName || '', b.amount || 199, b.months || 1, slip, b.note || '', b.kind || null, b.addon || null, now()).run();
          // แจ้ง admin ให้รู้เร็ว: push LINE ไปยัง ADMIN_LINE (ตั้งเป็น secret; ไม่ตั้ง = ข้าม)
          if (env.ADMIN_LINE) {
            const mL = (b.months || 1) >= 12 ? '1 ปี' : (b.months || 1) + ' เดือน';
            const p = linePush(env, env.ADMIN_LINE, [{ type: 'text',
              text: `🧾 คำขอชำระใหม่\nร้าน: ${b.shopName || b.shopId}\nยอด: ฿${b.amount || 199} · ${mL}${b.note ? '\nหมายเหตุ: ' + b.note : ''}\n\nเปิด Back Office → คำขอชำระ เพื่อยืนยัน` }]).catch(() => {});
            if (ctx && ctx.waitUntil) ctx.waitUntil(p);
          }
          return json({ ok: true, id }, req, 201);
        }
        // GET /pay-requests?status=pending — แอดมินดูรายการ
        if (req.method === 'GET' && !seg[1]) {
          const st = url.searchParams.get('status');
          const q = st
            ? env.DB.prepare('SELECT * FROM pay_requests WHERE status=? ORDER BY created_at DESC LIMIT 300').bind(st)
            : env.DB.prepare('SELECT * FROM pay_requests ORDER BY created_at DESC LIMIT 300');
          const { results } = await q.all();
          return json(results, req);
        }
        // PATCH /pay-requests/:id — ยืนยัน/ปฏิเสธ (+ ต่ออายุร้านให้อัตโนมัติเมื่อยืนยัน)
        if (req.method === 'PATCH' && seg[1]) {
          const b = await readBody();
          const cur = await env.DB.prepare('SELECT * FROM pay_requests WHERE id=?').bind(seg[1]).first();
          if (!cur) return err('request not found', req, 404);
          const st = b.status === 'rejected' ? 'rejected' : 'confirmed';
          await env.DB.prepare('UPDATE pay_requests SET status=?,handled_at=?,handled_by=? WHERE id=?')
            .bind(st, now(), b.by || 'admin', seg[1]).run();
          if (st === 'confirmed') {
            const s = await getShop(env, cur.shop_id);
            if (s) {
              if (cur.kind === 'addon' && cur.addon) {   // ซื้อ add-on → เปิดสิทธิ์ (ไม่ต่ออายุแพ็ก)
                let extra = {}; try { extra = s.extra ? JSON.parse(s.extra) : {}; } catch (e) {}
                extra.addons = { ...(extra.addons || {}), [cur.addon]: true };
                await env.DB.prepare('UPDATE shops SET extra=?,updated_at=? WHERE id=?')
                  .bind(JSON.stringify(extra), now(), cur.shop_id).run();
              } else {   // ต่ออายุร้าน = months × 30 วัน จากวันหมดเดิม
                const base = Math.max(Date.now(), s.expiry ? new Date(s.expiry).getTime() : 0);
                const exp = new Date(base + (cur.months || 1) * 30 * 864e5).toISOString();
                await env.DB.prepare('UPDATE shops SET plan=?,status=?,expiry=?,updated_at=? WHERE id=?')
                  .bind('paid', 'active', exp, now(), cur.shop_id).run();
              }
            }
          }
          return json({ ok: true, status: st }, req);
        }
      }

      /* ── WALLET (กระเป๋าเงินปิด — ใช้จ่ายค่าบริการระบบเท่านั้น, closed-loop)
         ยืนยันยอดเติมเงินด้วยแอดมินตรวจมือเท่านั้นตอนนี้ (ยังไม่มี auto-verify สลิป/ธนาคารจริง) — topup ทุกคำขอสถานะ pending เสมอ */
      if (seg[0] === 'wallet') {
        await ensureWallet(env);
        // GET /wallet — แอดมินดูกระเป๋าทุกร้าน (join บัญชีรับเงินของร้านมาโชว์ด้วย)
        if (req.method === 'GET' && !seg[1]) {
          const tok = req.headers.get('X-Admin-Token');
          if (!(await verifyToken(env, tok))) return err('admin only', req, 403);
          const { results } = await env.DB.prepare(
            `SELECT w.biz_id, w.balance, w.auto, w.updated_at, a.promptpay as pp, a.bank as bank, a.acct_no as acct_no
             FROM wallets w LEFT JOIN wallet_accounts a ON a.biz_id = w.biz_id ORDER BY w.updated_at DESC LIMIT 500`).all();
          return json(results, req);
        }
        if (seg[1]) {
          const biz = decodeURIComponent(seg[1]);
          // GET /wallet/:biz — ยอด + สถานะตัดอัตโนมัติ + ยอดรอตรวจ
          if (req.method === 'GET' && !seg[2]) {
            const w = await walletRow(env, biz);
            const p = await walletPending(env, biz);
            return json({ balance: w.balance, auto: w.auto !== 0, pendingAmount: p.amount, pendingCount: p.count, updatedAt: w.updated_at }, req);
          }
          // GET /wallet/:biz/txns?limit=N — ประวัติ
          if (req.method === 'GET' && seg[2] === 'txns') {
            const lim = Math.min(200, +(url.searchParams.get('limit') || 60) || 60);
            const { results } = await env.DB.prepare('SELECT * FROM wallet_txns WHERE biz_id=? ORDER BY created_at DESC LIMIT ?').bind(biz, lim).all();
            return json(results.map(r => ({ ts: r.created_at, ref: r.id, type: r.type, amount: r.amount, balance_after: r.balance_after, note: r.note, method: r.method, status: r.status })), req);
          }
          // POST /wallet/:biz/topup {amount,slip,method,who,note} — ยื่นคำขอ (pending เสมอ รอแอดมินตรวจ)
          if (req.method === 'POST' && seg[2] === 'topup') {
            const b = await readBody();
            const amt = Math.round((Number(b.amount) || 0) * 100) / 100;
            if (!(amt > 0)) return err('จำนวนเงินไม่ถูกต้อง', req, 400);
            const id = 'wt' + now() + Math.random().toString(36).slice(2, 5);
            let slip = b.slip || null;
            if (slip && env.SLIPS) {
              const m = /^data:(image\/\w+);base64,(.+)$/.exec(slip);
              if (m) { try {
                const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
                const key = `walletslip/${biz}/${id}.${m[1].split('/')[1]}`;
                await env.SLIPS.put(key, bytes, { httpMetadata: { contentType: m[1] } });
                slip = `${url.origin}/img/${key}`;
              } catch (e) {} }
            }
            await env.DB.prepare(`INSERT INTO wallet_txns (id,biz_id,type,amount,note,method,status,slip,who,created_at)
              VALUES (?,?,'topup',?,?,?,'pending',?,?,?)`)
              .bind(id, biz, amt, b.note || 'เติมเงินเข้ากระเป๋า', b.method || 'promptpay', slip, b.who || '', now()).run();
            await env.DB.prepare(`INSERT INTO wallets (biz_id,balance,auto,updated_at) VALUES (?,0,1,?)
              ON CONFLICT(biz_id) DO UPDATE SET updated_at=excluded.updated_at`).bind(biz, now()).run();
            if (env.ADMIN_LINE) {
              const p = linePush(env, env.ADMIN_LINE, [{ type: 'text',
                text: `👛 คำขอเติมเงินกระเป๋า\nร้าน: ${b.who || biz}\nยอด: ฿${amt}${slip ? ' · แนบสลิปแล้ว' : ' · ไม่มีสลิป'}\n\nเปิด Back Office → กระเป๋าเงิน เพื่อตรวจ/อนุมัติ` }]).catch(() => {});
              if (ctx && ctx.waitUntil) ctx.waitUntil(p);
            }
            return json({ ok: true, status: 'pending', ref: id }, req, 201);
          }
          // POST /wallet/:biz/charge {amount,note,who,ref,type,idem} — หักยอดทันที (atomic + idempotent ด้วย idem)
          if (req.method === 'POST' && seg[2] === 'charge') {
            const b = await readBody();
            const amt = Math.round((Number(b.amount) || 0) * 100) / 100;
            if (!(amt > 0)) return json({ ok: false, error: 'จำนวนเงินไม่ถูกต้อง' }, req, 400);
            if (b.idem) {
              const dup = await env.DB.prepare('SELECT * FROM wallet_txns WHERE biz_id=? AND idem=?').bind(biz, b.idem).first();
              if (dup) { const w = await walletRow(env, biz); return json({ ok: true, balance: w.balance, ref: dup.id, dedup: true }, req); }
            }
            const w = await walletRow(env, biz);
            if (w.balance < amt) return json({ ok: false, error: 'ยอดกระเป๋าไม่พอ', balance: w.balance, short: Math.round((amt - w.balance) * 100) / 100 }, req, 402);
            const bal = Math.round((w.balance - amt) * 100) / 100;
            const id = 'wc' + now() + Math.random().toString(36).slice(2, 5);
            await env.DB.prepare(`INSERT INTO wallets (biz_id,balance,auto,updated_at) VALUES (?,?,1,?)
              ON CONFLICT(biz_id) DO UPDATE SET balance=excluded.balance, updated_at=excluded.updated_at`).bind(biz, bal, now()).run();
            await env.DB.prepare(`INSERT INTO wallet_txns (id,biz_id,type,amount,balance_after,note,method,status,who,ref,idem,created_at)
              VALUES (?,?,?,?,?,?,'wallet','done',?,?,?,?)`)
              .bind(id, biz, b.type || 'fee', -amt, bal, b.note || 'ค่าบริการระบบ', b.who || '', b.ref || '', b.idem || null, now()).run();
            return json({ ok: true, balance: bal, ref: id }, req);
          }
          // POST /wallet/:biz/auto {on} — เปิด/ปิดตัดอัตโนมัติเมื่อครบรอบ
          if (req.method === 'POST' && seg[2] === 'auto') {
            const b = await readBody();
            await env.DB.prepare(`INSERT INTO wallets (biz_id,balance,auto,updated_at) VALUES (?,0,?,?)
              ON CONFLICT(biz_id) DO UPDATE SET auto=excluded.auto, updated_at=excluded.updated_at`).bind(biz, b.on ? 1 : 0, now()).run();
            return json({ ok: true }, req);
          }
          // POST /wallet/:biz/adjust {amount,note,by} — แอดมินปรับยอดมือ (+/-)
          if (req.method === 'POST' && seg[2] === 'adjust') {
            const tok = req.headers.get('X-Admin-Token');
            if (!(await verifyToken(env, tok))) return err('admin only', req, 403);
            const b = await readBody();
            const amt = Math.round((Number(b.amount) || 0) * 100) / 100;
            if (!amt) return err('จำนวนเงินไม่ถูกต้อง', req, 400);
            const w = await walletRow(env, biz);
            const bal = Math.round((w.balance + amt) * 100) / 100;
            const id = 'wa' + now() + Math.random().toString(36).slice(2, 5);
            await env.DB.prepare(`INSERT INTO wallets (biz_id,balance,auto,updated_at) VALUES (?,?,1,?)
              ON CONFLICT(biz_id) DO UPDATE SET balance=excluded.balance, updated_at=excluded.updated_at`).bind(biz, bal, now()).run();
            await env.DB.prepare(`INSERT INTO wallet_txns (id,biz_id,type,amount,balance_after,note,method,status,by,created_at)
              VALUES (?,?,?,?,?,?,'admin','done',?,?)`)
              .bind(id, biz, amt > 0 ? 'adjust-in' : 'adjust-out', amt, bal, b.note || '', b.by || 'admin', now()).run();
            return json({ ok: true, balance: bal }, req);
          }
          // GET/POST /wallet/:biz/account — บัญชีรับเงินของร้านนี้เอง (โหมด "auto" ใน KDReceivePanel)
          if (seg[2] === 'account') {
            if (req.method === 'GET') {
              const r = await env.DB.prepare('SELECT * FROM wallet_accounts WHERE biz_id=?').bind(biz).first();
              return json(r ? { promptpay: r.promptpay || '', bank: r.bank || '', acctNo: r.acct_no || '', acctName: r.acct_name || '' } : {}, req);
            }
            if (req.method === 'POST') {
              const b = await readBody();
              await env.DB.prepare(`INSERT INTO wallet_accounts (biz_id,promptpay,bank,acct_no,acct_name,updated_at) VALUES (?,?,?,?,?,?)
                ON CONFLICT(biz_id) DO UPDATE SET promptpay=excluded.promptpay, bank=excluded.bank, acct_no=excluded.acct_no, acct_name=excluded.acct_name, updated_at=excluded.updated_at`)
                .bind(biz, b.promptpay || '', b.bank || '', b.acctNo || '', b.acctName || '', now()).run();
              return json({ ok: true }, req);
            }
          }
        }
      }

      /* ── WALLET-TOPUPS (คิวคำขอเติมเงินรอตรวจ — แอดมิน) ── */
      if (seg[0] === 'wallet-topups' && req.method === 'GET') {
        await ensureWallet(env);
        const tok = req.headers.get('X-Admin-Token');
        if (!(await verifyToken(env, tok))) return err('admin only', req, 403);
        const st = url.searchParams.get('status') || 'pending';
        const { results } = await env.DB.prepare("SELECT * FROM wallet_txns WHERE type='topup' AND status=? ORDER BY created_at ASC LIMIT 300").bind(st).all();
        // ts/ref เป็นคอลัมน์เก่าจากตารางที่มีอยู่ก่อน (ว่างเสมอ) — Back Office โชว์เวลา/เลขอ้างอิงจากสองคีย์นี้ ต้อง map จาก created_at/id
        return json(results.map(r => ({ ...r, ts: r.created_at, ref: r.id })), req);
      }

      /* ── WALLET-TXNS/:id — แอดมินอนุมัติ/ปฏิเสธคำขอเติมเงิน ── */
      if (seg[0] === 'wallet-txns' && seg[1] && req.method === 'PATCH') {
        await ensureWallet(env);
        const tok = req.headers.get('X-Admin-Token');
        if (!(await verifyToken(env, tok))) return err('admin only', req, 403);
        const b = await readBody();
        const cur = await env.DB.prepare('SELECT * FROM wallet_txns WHERE id=?').bind(seg[1]).first();
        if (!cur) return err('transaction not found', req, 404);
        if (cur.status !== 'pending') return json({ ok: false, error: 'รายการนี้ถูกจัดการไปแล้ว' }, req, 409);
        // ล็อกแถวก่อนด้วย conditional UPDATE (status='pending' เท่านั้นถึงจะเปลี่ยนได้) กันยืนยัน/ปฏิเสธซ้ำหรือแข่งกัน แล้วค่อยแตะยอดเงิน
        if (b.status === 'rejected') {
          const r = await env.DB.prepare("UPDATE wallet_txns SET status='rejected',by=?,reason=?,handled_at=? WHERE id=? AND status='pending'")
            .bind(b.by || 'admin', b.reason || '', now(), seg[1]).run();
          if (!(r.meta && r.meta.changes)) return json({ ok: false, error: 'รายการนี้ถูกจัดการไปแล้ว' }, req, 409);
          return json({ ok: true, status: 'rejected' }, req);
        }
        const res = await confirmWalletTopup(env, seg[1], b.by || 'admin');
        return json(res, req, res.ok ? 200 : 409);
      }

      /* ── WALLET-BANK-ALERT (ข้อความแจ้งเงินเข้าบัญชีกลาง → auto จับคู่กับ topup ที่ pending อยู่ ไม่ผูกร้านเดียว) ── */
      if (seg[0] === 'wallet-bank-alert' && req.method === 'POST') {
        const tok = req.headers.get('X-Admin-Token');
        if (!(await verifyToken(env, tok))) return err('admin only', req, 403);
        const b = await readBody();
        const r = await autoMatchWalletTopup(env, b.text || b.message || '');
        return json({ ok: true, ...r }, req);
      }

      /* ── WALLET-ACCOUNT — บัญชีรับเงินกลางของระบบ (ปลายทางที่ร้านโอนมาเติมกระเป๋า) ── */
      if (seg[0] === 'wallet-account') {
        if (req.method === 'GET') {
          try { const r = await env.DB.prepare("SELECT v FROM app_config WHERE k='wallet_account'").first();
            return json(r ? JSON.parse(r.v || '{}') : {}, req);
          } catch (e) { return json({}, req); }
        }
        if (req.method === 'PUT') {
          const tok = req.headers.get('X-Admin-Token');
          if (!(await verifyToken(env, tok))) return err('admin only', req, 403);
          const b = await readBody();
          const v = JSON.stringify({ promptpay: b.promptpay || '', bank: b.bank || '', acctNo: b.acctNo || '', acctName: b.acctName || '' });
          await env.DB.prepare("INSERT INTO app_config (k,v) VALUES ('wallet_account',?) ON CONFLICT(k) DO UPDATE SET v=?").bind(v, v).run();
          return json({ ok: true }, req);
        }
      }

      /* ── WALLET-VERIFY — ตั้งค่าโหมดตรวจสลิป (ปัจจุบันยังไม่มี auto-verify จริง — topup ทุกคำขอ pending รอแอดมินตรวจมือเสมอ ไม่ว่า slipAuto จะตั้งเป็นอะไร) ── */
      if (seg[0] === 'wallet-verify') {
        if (req.method === 'GET') {
          try { const r = await env.DB.prepare("SELECT v FROM app_config WHERE k='wallet_verify'").first();
            const d = r ? JSON.parse(r.v || '{}') : {};
            return json({ slipAuto: !!d.slipAuto, provider: d.provider || '', lineSlip: !!d.lineSlip, ready: {} }, req);
          } catch (e) { return json({ slipAuto: false, provider: '', lineSlip: false, ready: {} }, req); }
        }
        if (req.method === 'PUT') {
          const tok = req.headers.get('X-Admin-Token');
          if (!(await verifyToken(env, tok))) return err('admin only', req, 403);
          const b = await readBody();
          const v = JSON.stringify({ slipAuto: !!b.slipAuto, provider: b.provider || '', lineSlip: !!b.lineSlip });
          await env.DB.prepare("INSERT INTO app_config (k,v) VALUES ('wallet_verify',?) ON CONFLICT(k) DO UPDATE SET v=?").bind(v, v).run();
          return json({ ok: true }, req);
        }
      }

      /* ── CODE REQUESTS (คำขอรหัส Office · เปิดวันย้อนหลัง) — global ── */
      if (seg[0] === 'code-requests') {
        await ensureCodeReqTable(env);
        // POST /code-requests/verify {shopId, code} → ตรวจรหัสที่ออกแล้ว (ใช้ครั้งเดียว)
        if (req.method === 'POST' && seg[1] === 'verify') {
          const b = await readBody();
          if (!b.shopId || !b.code) return err('shopId & code required', req);
          const cur = await env.DB.prepare("SELECT * FROM code_requests WHERE shop_id=? AND status='issued' AND used=0 AND code=? ORDER BY created_at DESC LIMIT 1").bind(b.shopId, String(b.code)).first();
          if (!cur) return json({ ok: false }, req);
          await env.DB.prepare('UPDATE code_requests SET used=1, handled_at=? WHERE id=?').bind(now(), cur.id).run();
          return json({ ok: true }, req);
        }
        // POST /code-requests — ร้านกดขอรหัส → แจ้ง Back Office (LINE push ADMIN)
        if (req.method === 'POST' && !seg[1]) {
          const b = await readBody();
          if (!b.shopId) return err('shopId required', req);
          const id = 'cr' + now() + Math.random().toString(36).slice(2, 5);
          await env.DB.prepare("INSERT INTO code_requests (id,shop_id,shop_name,kind,note,status,created_at) VALUES (?,?,?,?,?, 'pending', ?)")
            .bind(id, b.shopId, b.shopName || '', b.kind || 'reopen', b.note || '', now()).run();
          if (env.ADMIN_LINE) {
            const p = linePush(env, env.ADMIN_LINE, [{ type: 'text',
              text: `🔑 คำขอรหัส Office\nร้าน: ${b.shopName || b.shopId}\nรหัสร้าน: ${b.shopId}${b.note ? '\nหมายเหตุ: ' + b.note : ''}\n\nเปิด Back Office → คำขอรหัส Office เพื่อออกรหัส` }]).catch(() => {});
            if (ctx && ctx.waitUntil) ctx.waitUntil(p);
          }
          return json({ ok: true, id }, req, 201);
        }
        // GET /code-requests?status=&shopId= — admin ดูรายการ / ร้าน poll คำขอตัวเอง
        if (req.method === 'GET' && !seg[1]) {
          const st = url.searchParams.get('status'); const sh = url.searchParams.get('shopId');
          let q = 'SELECT * FROM code_requests WHERE 1=1', bind = [];
          if (st) { q += ' AND status=?'; bind.push(st); }
          if (sh) { q += ' AND shop_id=?'; bind.push(sh); }
          q += ' ORDER BY created_at DESC LIMIT 300';
          const { results } = await env.DB.prepare(q).bind(...bind).all();
          return json(results, req);
        }
        // PATCH /code-requests/:id {status:'issued'|'rejected', by} → ออกรหัส (gen 6 หลัก ฝั่ง server) / ปฏิเสธ
        if (req.method === 'PATCH' && seg[1]) {
          const b = await readBody();
          const cur = await env.DB.prepare('SELECT * FROM code_requests WHERE id=?').bind(seg[1]).first();
          if (!cur) return err('request not found', req, 404);
          if (b.status === 'rejected') {
            await env.DB.prepare("UPDATE code_requests SET status='rejected', handled_at=?, handled_by=? WHERE id=?").bind(now(), b.by || 'admin', seg[1]).run();
            return json({ ok: true, status: 'rejected' }, req);
          }
          const code = String(Math.floor(100000 + Math.random() * 900000));   // รหัส 6 หลัก ใช้ครั้งเดียว
          await env.DB.prepare("UPDATE code_requests SET status='issued', code=?, used=0, handled_at=?, handled_by=? WHERE id=?").bind(code, now(), b.by || 'admin', seg[1]).run();
          // push รหัสให้เจ้าของร้าน (ถ้ามี owner_line) — ร้านไม่ต้องรับรหัสจากแอดมินด้วยปากเปล่า
          try { const s = await getShop(env, cur.shop_id); if (s && s.owner_line) { const p = linePush(env, s.owner_line, [{ type: 'text', text: `🔑 รหัส Office ของคุณ: ${code}\n(ใช้เปิดวันย้อนหลังในแอป · ใช้ได้ครั้งเดียว)` }]).catch(() => {}); if (ctx && ctx.waitUntil) ctx.waitUntil(p); } } catch (e) {}
          return json({ ok: true, status: 'issued', code }, req);
        }
      }

      /* ── BRAND (ตั้งค่าแบรนด์รวม: ชื่อแอป + โลโก้) — global ── */
      if (seg[0] === 'brand') {
        if (req.method === 'GET') {
          const r = await env.DB.prepare("SELECT v FROM app_config WHERE k='brand'").first();
          return json(r ? JSON.parse(r.v || '{}') : {}, req);
        }
        if (req.method === 'PUT' || req.method === 'POST') {
          const b = await readBody(); const v = JSON.stringify({ appName: b.appName || '', logo: b.logo || null });
          await env.DB.prepare("INSERT INTO app_config (k,v) VALUES ('brand',?) ON CONFLICT(k) DO UPDATE SET v=?").bind(v, v).run();
          return json({ ok: true }, req);
        }
      }

      /* ── PACKAGES (แพ็กเกจ/ราคา/จำนวนเครื่อง) — global ── */
      if (seg[0] === 'packages') {
        if (req.method === 'GET') {
          const r = await env.DB.prepare("SELECT v FROM app_config WHERE k='packages'").first();
          return json(r ? JSON.parse(r.v || '{}') : {}, req);
        }
        if (req.method === 'PUT' || req.method === 'POST') {
          const b = await readBody(); const v = JSON.stringify(b);
          await env.DB.prepare("INSERT INTO app_config (k,v) VALUES ('packages',?) ON CONFLICT(k) DO UPDATE SET v=?").bind(v, v).run();
          return json({ ok: true }, req);
        }
      }

      /* ── ACCESS-CONFIG (คุมการเข้าดู Backoffice ร้านโดยแอดมิน: อนุมัติ/ระยะเวลา) — global ── */
      if (seg[0] === 'access-config') {
        if (req.method === 'GET') {
          const r = await env.DB.prepare("SELECT v FROM app_config WHERE k='access'").first();
          return json(r ? JSON.parse(r.v || '{}') : { approval:false, unit:'hours', value:12 }, req);
        }
        if (req.method === 'PUT' || req.method === 'POST') {
          const b = await readBody();
          const v = JSON.stringify({ approval:!!b.approval, unit:(b.unit==='days'?'days':'hours'), value:Math.max(1, parseInt(b.value,10)||12) });
          await env.DB.prepare("INSERT INTO app_config (k,v) VALUES ('access',?) ON CONFLICT(k) DO UPDATE SET v=?").bind(v, v).run();
          return json({ ok: true }, req);
        }
      }

      /* ── LINE webhook: จับคู่รหัส→ผูกกลุ่ม / ข้อความเงินเข้า→auto match — global, ไม่มี ?shop= มาด้วย (LINE เรียก URL เดียวคงที่)
         ต้องอยู่ก่อนเกต shopId ด้านล่าง ไม่งั้นโดนบล็อก 400 ทุกครั้งที่ LINE ยิงเข้ามาจริง (หา shop เองจาก group→shop mapping) ── */
      if (seg[0] === 'line-webhook' && req.method === 'POST') {
        await ensureLinePairs(env);
        const b = await readBody(); const events = (b && b.events) || [];
        for (const ev of events) {
          if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') continue;
          const gid = ev.source && (ev.source.groupId || ev.source.roomId); if (!gid) continue;
          const text = ev.message.text || ''; const m = text.match(/\b(\d{4})\b/);
          if (m) { const pend = await env.DB.prepare("SELECT * FROM line_pairs WHERE code=? AND status='pending' LIMIT 1").bind(m[1]).first();
            if (pend) { await env.DB.prepare("UPDATE line_pairs SET group_id=?, status='linked' WHERE shop_id=? AND code=?").bind(gid, pend.shop_id, m[1]).run();
              if (env.LINE_TOKEN && ev.replyToken) { try{ await fetch('https://api.line.me/v2/bot/message/reply',{ method:'POST', headers:{ 'content-type':'application/json', Authorization:'Bearer '+env.LINE_TOKEN }, body:JSON.stringify({ replyToken:ev.replyToken, messages:[{ type:'text', text:'✅ เชื่อมต่อกับ KaiDee สำเร็จ — เงินเข้าในกลุ่มนี้จะจับคู่บิลให้อัตโนมัติ' }] }) }); }catch(e){} }
              continue; } }
          const sh = await shopByGroup(env, gid); if (sh) await autoMatchAlert(env, sh, text);
        }
        return json({ ok:true }, req);
      }

      /* ── GET /my-orders?line=U… — ออเดอร์ของลูกค้าคนเดียวข้ามทุกร้าน (หน้า "ออเดอร์ของฉัน") ──
         ต้องอยู่ก่อน gate เพราะไม่ผูกกับร้านใดร้านหนึ่ง
         ค้นด้วย LINE userId เท่านั้น — เดาไม่ได้ · ห้ามเปิดให้ค้นด้วยเบอร์ ไม่งั้นใครก็อ่านออเดอร์คนอื่นได้ */
      if (seg[0] === 'my-orders' && req.method === 'GET') {
        const line = url.searchParams.get('line') || '';
        if (!/^U[0-9a-f]{20,}$/i.test(line)) return err('line user id required', req, 400);
        await ensureOrderCols(env);
        const { results } = await env.DB.prepare(
          'SELECT * FROM orders WHERE line_user=? ORDER BY created_at DESC LIMIT 60').bind(line).all();
        const ids = [...new Set((results || []).map(r => r.shop_id))];
        let shops = {};
        if (ids.length) {
          const ph = ids.map(() => '?').join(',');
          const sr = await env.DB.prepare(`SELECT id,name,emoji,phone FROM shops WHERE id IN (${ph})`).bind(...ids).all();
          shops = Object.fromEntries((sr.results || []).map(s => [s.id, s]));
        }
        return json((results || []).map(r => {
          const s = shops[r.shop_id] || {};
          return { ...rowOrder(r), shopId: r.shop_id, shopName: s.name || r.shop_id, shopEmoji: s.emoji || '', shopPhone: s.phone || '' };
        }), req);
      }

      // ต่อจากนี้ทุก endpoint ต้องมี shopId
      const shop = await shopFromReq();
      if (!shop) return err('shop (tenant) required — ระบุ ?shop=<id>', req, 400);

      /* ── REPORTS (Backoffice · เจ้าของร้านเท่านั้น · role lock ฝั่ง server) ──
       * ต้องแนบ X-Owner-Token (จาก /owner-login) — manager/staff ที่ไม่มี token ยิงตรงมาก็โดน 403
       * คืน "แถวดิบ" ให้ client คิด KPI ด้วย logic เดียวกับแอป (saleTotal/saleBookable/effSaleCost) — ไม่ทำสูตรซ้ำที่ server
       * date-lock: sales.date = วันที่ธุรกรรมจริง (transaction date) · settleDate/verified = วันเงินเข้า (แยกในแถว) */
      if (seg[0] === 'reports') {
        const otok = req.headers.get('X-Owner-Token') || url.searchParams.get('ot');
        if (!(await verifyOwnerToken(env, shop, otok))) return json({ error: 'owner auth required — เข้าสู่ระบบเจ้าของร้านก่อน' }, req, 403);
        if (req.method === 'GET' && (seg[1] === 'data' || !seg[1])) {
          const from = url.searchParams.get('from'), to = url.searchParams.get('to');
          const [salesR, ordersR, membersR, rawR, purchR, menuR] = await Promise.all([
            env.DB.prepare('SELECT * FROM sales WHERE shop_id=? ORDER BY created_at DESC LIMIT 5000').bind(shop).all(),
            env.DB.prepare('SELECT * FROM orders WHERE shop_id=? ORDER BY created_at DESC LIMIT 5000').bind(shop).all(),
            env.DB.prepare('SELECT * FROM members WHERE shop_id=? ORDER BY points DESC LIMIT 3000').bind(shop).all(),
            env.DB.prepare('SELECT * FROM raw WHERE shop_id=? ORDER BY cat,id').bind(shop).all(),
            env.DB.prepare('SELECT * FROM purchases WHERE shop_id=? ORDER BY date DESC LIMIT 3000').bind(shop).all(),
            env.DB.prepare('SELECT * FROM menu WHERE shop_id=? AND active=1 ORDER BY sort').bind(shop).all(),
          ]);
          const sd = await env.DB.prepare('SELECT data FROM settings WHERE shop_id=?').bind(shop).first();
          const inRange = (d) => { if (!from && !to) return true; d = d || ''; if (from && d < from) return false; if (to && d > to) return false; return true; };
          return json({
            sales: salesR.results.map(r => ({ id: r.id, no: r.no, date: r.date, channel: r.channel, pay: r.pay, total: r.total, qnum: r.qnum, ...JSON.parse(r.data || '{}') })).filter(s => inRange(s.date)),
            orders: ordersR.results.map(rowOrder),
            members: membersR.results,
            raw: rawR.results.map(r => ({ id: r.id, cat: r.cat, th: r.th, unit: r.unit, stock: r.stock, avgCost: r.avg_cost, low: r.low })),
            purchases: purchR.results.map(p => ({ id: p.id, date: p.date, note: p.note, lines: JSON.parse(p.lines || '[]'), total: p.total })),
            menu: menuR.results.map(m => ({ ...m, hot: !!m.hot, active: !!m.active, off: !!m.off, consign: !!m.consign, consignId: m.consign_id || null, recipe: m.recipe ? JSON.parse(m.recipe) : undefined })),
            settings: sd ? JSON.parse(sd.data || '{}') : {},
          }, req);
        }
      }


      /* ── REFUNDS (คืนเงินออเดอร์ที่ร้านปฏิเสธ · confirm-first / จ่ายก่อน) ── */
      if (seg[0] === 'refunds') {
        await ensureRefundTable(env);
        // POST /refunds — ร้านสร้างคำขอคืนเงิน(ตอนปฏิเสธออเดอร์ที่จ่ายแล้ว) → แจ้งลูกค้าให้กรอกบัญชี
        if (req.method === 'POST' && !seg[1]) {
          const b = await readBody();
          const id = 'rf' + now() + Math.random().toString(36).slice(2, 5), ts = now();
          await env.DB.prepare(
            `INSERT INTO refunds (id,shop_id,order_id,order_no,amount,line_user,phone,status,note,created_at,updated_at)
             VALUES (?,?,?,?,?,?,?, 'pending', ?,?,?)`
          ).bind(id, shop, b.orderId || '', b.orderNo | 0, b.amount | 0, b.lineUser || null, b.phone || '', b.note || '', ts, ts).run();
          // แจ้งลูกค้าทาง LINE (ถ้ามี) ให้กรอกเลขบัญชีรับเงินคืน — SMS gateway ต่อภายหลังผ่าน env
          if (b.lineUser) await linePush(env, b.lineUser, [{ type: 'text',
            text: `↩️ ออเดอร์ #${b.orderNo || ''} ถูกยกเลิก ร้านจะคืนเงิน ฿${(b.amount||0).toLocaleString('en-US')}\nกรุณาแจ้งเลขบัญชีรับเงินคืนที่หน้า “ติดตามออเดอร์”` }]);
          return json({ ok: true, id }, req, 201);
        }
        // GET /refunds?status= — ร้านดูรายการคืนเงิน
        if (req.method === 'GET' && !seg[1]) {
          const st = url.searchParams.get('status');
          const q = st
            ? env.DB.prepare('SELECT * FROM refunds WHERE shop_id=? AND status=? ORDER BY created_at DESC LIMIT 300').bind(shop, st)
            : env.DB.prepare('SELECT * FROM refunds WHERE shop_id=? ORDER BY created_at DESC LIMIT 300').bind(shop);
          const { results } = await q.all();
          return json(results, req);
        }
        // PATCH /refunds/:id — ลูกค้ากรอกบัญชี {bank,acctNo,acctName,phone} · ร้านคืนเงิน {status:'refunded',slip}
        if (req.method === 'PATCH' && seg[1]) {
          const b = await readBody();
          const cur = await env.DB.prepare('SELECT * FROM refunds WHERE shop_id=? AND id=?').bind(shop, seg[1]).first();
          if (!cur) return err('refund not found', req, 404);
          const bank = b.bank != null ? b.bank : cur.bank, acctNo = b.acctNo != null ? b.acctNo : cur.acct_no;
          const acctName = b.acctName != null ? b.acctName : cur.acct_name, phone = b.phone != null ? b.phone : cur.phone;
          const status = b.status || (b.acctNo ? 'acct_given' : cur.status), slip = b.slip != null ? b.slip : cur.slip;
          await env.DB.prepare('UPDATE refunds SET bank=?,acct_no=?,acct_name=?,phone=?,status=?,slip=?,updated_at=? WHERE shop_id=? AND id=?')
            .bind(bank, acctNo, acctName, phone, status, slip, now(), shop, seg[1]).run();
          if (status === 'refunded' && cur.line_user) await linePush(env, cur.line_user, [{ type: 'text',
            text: `✅ ร้านคืนเงินออเดอร์ #${cur.order_no || ''} ฿${(cur.amount||0).toLocaleString('en-US')} เรียบร้อยแล้ว` }]);
          return json({ ok: true, status }, req);
        }
      }

      /* ── MENU ── */
      if (seg[0] === 'menu') {
        await ensureMenuConsignCols(env);
        if (req.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT * FROM menu WHERE shop_id=? AND active=1 ORDER BY sort').bind(shop).all();
          return json(results.map(m => ({ ...m, hot: !!m.hot, active: !!m.active, off: !!m.off, consign: !!m.consign, consignId: m.consign_id || null, recipe: m.recipe ? JSON.parse(m.recipe) : undefined })), req);
        }
        if (req.method === 'POST') {
          const b = await readBody();
          await env.DB.prepare(
            `INSERT INTO menu (shop_id,id,cat,th,en,price,cost,tone,hot,active,sort,recipe,off,consign,consign_id)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON CONFLICT(shop_id,id) DO UPDATE SET cat=excluded.cat,th=excluded.th,en=excluded.en,
               price=excluded.price,cost=excluded.cost,tone=excluded.tone,hot=excluded.hot,
               active=excluded.active,sort=excluded.sort,recipe=excluded.recipe,off=excluded.off,consign=excluded.consign,consign_id=excluded.consign_id`
          ).bind(shop, b.id || 'm' + now(), b.cat, b.th, b.en || '', b.price | 0, b.cost | 0,
                 b.tone || '', b.hot ? 1 : 0, b.active === false ? 0 : 1, b.sort | 0,
                 b.recipe ? JSON.stringify(b.recipe) : null, b.off ? 1 : 0, b.consign ? 1 : 0, b.consignId || null).run();
          return json({ ok: true }, req);
        }
        if (req.method === 'DELETE' && seg[1]) {
          await env.DB.prepare('UPDATE menu SET active=0 WHERE shop_id=? AND id=?').bind(shop, seg[1]).run();
          return json({ ok: true }, req);
        }
      }

      /* ── REVIEWS (คะแนนดาว · ให้ได้เฉพาะคนที่สั่งจริงและได้รับของแล้ว) ── */
      if (seg[0] === 'reviews') {
        await ensureReviews(env);
        // GET /reviews — สรุปคะแนน + รีวิวล่าสุด (สาธารณะ · ไม่คืน LINE id ของคนรีวิว)
        if (req.method === 'GET' && !seg[1]) {
          const { results } = await env.DB.prepare(
            'SELECT id,order_id,stars,text,reply,created_at FROM reviews WHERE shop_id=? ORDER BY created_at DESC LIMIT 50').bind(shop).all();
          const all = results || [];
          const n = all.length;
          const avg = n ? Math.round((all.reduce((a, r) => a + (r.stars | 0), 0) / n) * 10) / 10 : null;
          return json({ count: n, rating: n >= 3 ? avg : null,
            breakdown: [5,4,3,2,1].map(s => ({ stars:s, n: all.filter(r => (r.stars|0) === s).length })),
            reviews: all.map(r => ({ id:r.id, orderId:r.order_id, stars:r.stars|0, text:r.text||'', reply:r.reply||'', at:r.created_at })) }, req);
        }
        // GET /reviews/mine?order=<id> — เช็คว่าบิลนี้รีวิวไปแล้วหรือยัง (ฝั่งลูกค้าใช้ตัดสินใจว่าจะขอรีวิวไหม)
        if (req.method === 'GET' && seg[1] === 'mine') {
          const oid = url.searchParams.get('order') || '';
          const r = await env.DB.prepare('SELECT stars,text FROM reviews WHERE shop_id=? AND order_id=?').bind(shop, oid).first();
          return json({ reviewed: !!r, stars: r ? (r.stars|0) : 0, text: r ? (r.text||'') : '' }, req);
        }
        // POST /reviews {orderId, stars, text, lineUserId}
        if (req.method === 'POST' && !seg[1]) {
          const b = await readBody();
          const stars = Math.round(+b.stars || 0);
          if (stars < 1 || stars > 5) return err('stars must be 1–5', req, 400);
          if (!b.orderId) return err('orderId required', req, 400);
          const o = await env.DB.prepare('SELECT * FROM orders WHERE shop_id=? AND id=?').bind(shop, String(b.orderId)).first();
          // ต้องเป็นบิลจริงของร้านนี้ · ต้องปิดงานแล้ว · ถ้าบิลผูก LINE ไว้ ต้องเป็นเจ้าของบิลเท่านั้น
          if (!o) return err('order not found', req, 404);
          if (o.status !== 'done') return json({ ok:false, error:'รีวิวได้หลังจากได้รับของแล้ว' }, req, 400);
          if (o.line_user && String(b.lineUserId || '') !== String(o.line_user))
            return json({ ok:false, error:'รีวิวได้เฉพาะเจ้าของบิล' }, req, 403);
          const t = now();
          try {
            await env.DB.prepare(
              `INSERT INTO reviews (shop_id,id,order_id,line_user,stars,text,created_at) VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(shop_id,order_id) DO UPDATE SET stars=excluded.stars, text=excluded.text, created_at=excluded.created_at`
            ).bind(shop, 'rv' + t, String(b.orderId), o.line_user || null, stars, String(b.text || '').slice(0, 500), t).run();
          } catch (e) { return err('save failed', req, 500); }
          return json({ ok: true }, req, 201);
        }
        // PATCH /reviews/:id {reply} — ร้านตอบกลับรีวิว (ต้องเป็นเจ้าของร้าน)
        if (req.method === 'PATCH' && seg[1]) {
          const otok = req.headers.get('X-Owner-Token') || url.searchParams.get('ot');
          if (!(await verifyOwnerToken(env, shop, otok))) return err('owner auth required', req, 403);
          const b = await readBody();
          await env.DB.prepare('UPDATE reviews SET reply=? WHERE shop_id=? AND id=?')
            .bind(String(b.reply || '').slice(0, 500), shop, seg[1]).run();
          return json({ ok: true }, req);
        }
      }

      /* ── PROMOS (โปร/คูปองที่ร้านสร้างเอง) ── */
      if (seg[0] === 'promos') {
        await ensurePromoTables(env);
        // GET /promos — ร้านดูทั้งหมด (รวมที่ปิด/หมดอายุ เพื่อแก้/เปิดใหม่ได้)
        // GET /promos?live=1 — ฝั่งลูกค้า: เฉพาะใบที่ใช้ได้ตอนนี้และลดให้อัตโนมัติ (ไม่โชว์ใบที่ต้องกรอกโค้ด)
        if (req.method === 'GET' && !seg[1]) {
          const { results } = await env.DB.prepare('SELECT * FROM promos WHERE shop_id=? ORDER BY created_at DESC').bind(shop).all();
          let list = (results || []).map(rowPromo);
          if (url.searchParams.get('live')) {
            const at = now();
            list = list.filter(p => p.active && !p.code && promoLiveNow(p, at))
              .sort((a, b) => (PROMO_RANK[a.kind] ?? 9) - (PROMO_RANK[b.kind] ?? 9) || (+b.value || 0) - (+a.value || 0))
              .map(p => ({ id: p.id, name: p.name, kind: p.kind, value: +p.value || 0, minSpend: p.minSpend | 0,
                           maxDisc: p.maxDisc | 0, buyQty: p.buyQty | 0, getQty: p.getQty | 0,
                           scope: p.scope, scopeIds: p.scopeIds || [], channels: p.channels || [] }));
          }
          return json(list, req);
        }
        // POST /promos — ร้านสร้าง/แก้โปร
        if (req.method === 'POST' && !seg[1]) {
          const b = await readBody();
          if (!b.name) return err('name required', req, 400);
          const id = (b.id && /^[a-z0-9_-]{1,40}$/i.test(b.id)) ? b.id : ('pm' + now());
          const code = String(b.code || '').trim().toUpperCase();
          if (code) {   // โค้ดห้ามซ้ำในร้านเดียวกัน ไม่งั้นลูกค้ากรอกแล้วไม่รู้ว่าได้ใบไหน
            const dup = await env.DB.prepare('SELECT id FROM promos WHERE shop_id=? AND code=? AND id<>?').bind(shop, code, id).first();
            if (dup) return err('โค้ดนี้ถูกใช้กับโปรอื่นแล้ว', req, 409);
          }
          const data = {
            name: b.name, kind: b.kind || 'percent', value: +b.value || 0,
            auto: b.auto !== false && !code,              // ไม่มีโค้ด = ลดให้อัตโนมัติ
            minSpend: b.minSpend | 0, maxDisc: b.maxDisc | 0,
            scope: ['all', 'cat', 'item'].includes(b.scope) ? b.scope : 'all',
            scopeIds: Array.isArray(b.scopeIds) ? b.scopeIds.slice(0, 200) : [],
            channels: Array.isArray(b.channels) ? b.channels : [],
            startAt: b.startAt || '', endAt: b.endAt || '',
            days: Array.isArray(b.days) ? b.days.map(n => n | 0) : [],
            timeFrom: b.timeFrom || '', timeTo: b.timeTo || '',
            quota: b.quota | 0, quotaPerUser: b.quotaPerUser | 0,
            buyQty: b.buyQty | 0, getQty: b.getQty | 0,
            stackable: !!b.stackable, note: b.note || '',
          };
          const t = now();
          await env.DB.prepare(
            `INSERT INTO promos (shop_id,id,code,data,used,active,created_at,updated_at) VALUES (?,?,?,?,0,?,?,?)
             ON CONFLICT(shop_id,id) DO UPDATE SET code=excluded.code, data=excluded.data,
               active=excluded.active, updated_at=excluded.updated_at`
          ).bind(shop, id, code, JSON.stringify(data), b.active === false ? 0 : 1, t, t).run();
          return json({ ok: true, id }, req, 201);
        }
        if (req.method === 'DELETE' && seg[1]) {
          await env.DB.prepare('DELETE FROM promos WHERE shop_id=? AND id=?').bind(shop, seg[1]).run();
          return json({ ok: true }, req);
        }
        // POST /promos/quote — ฝั่งลูกค้าถามว่าตะกร้านี้ใช้โปรอะไรได้บ้าง ลดเท่าไหร่
        if (req.method === 'POST' && seg[1] === 'quote') {
          const b = await readBody();
          const lines = await promoLinesFromDB(env, shop, b.items || []);
          const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
          const cx = { lines, subtotal, fee: b.fee | 0, channel: b.channel || 'line', lineUser: b.lineUserId || null, at: now() };
          let list = await promoEvaluate(env, shop, cx);
          // โปรที่ต้องกรอกโค้ด: ซ่อนไว้จนกว่าลูกค้าจะพิมพ์โค้ดถูก
          const typed = String(b.code || '').trim().toUpperCase();
          list = list.filter(p => !p.code || p.code === typed);
          return json({ subtotal, promos: list.sort((a, b2) => (b2.disc + b2.feeDisc) - (a.disc + a.feeDisc)) }, req);
        }
      }

      /* ── ORDERS ── */
      if (seg[0] === 'orders') {
        if (req.method === 'GET' && !seg[1]) {
          const since = url.searchParams.get('since'), status = url.searchParams.get('status'), line = url.searchParams.get('line');
          let q = 'SELECT * FROM orders WHERE shop_id=?', bind = [shop];
          if (since) { q += ' AND updated_at > ?'; bind.push(+since); }
          if (status) { q += ' AND status = ?'; bind.push(status); }
          if (line) { q += ' AND line_user = ?'; bind.push(line); }
          q += ' ORDER BY created_at DESC LIMIT 300';
          const { results } = await env.DB.prepare(q).bind(...bind).all();
          return json(results.map(rowOrder), req);
        }
        /* GET /orders/:id/rider — สถานะไรเดอร์ของออเดอร์นี้
           งานไรเดอร์อยู่คนละ worker คนละฐานข้อมูล (platform-worker) — worker นี้ยิงไปถามแทนแอป
           ไม่ให้แอปยิงตรง เพราะแอปฝั่งลูกค้าไม่รู้จัก base ของ platform และจะติด CORS */
        if (req.method === 'GET' && seg[1] && seg[2] === 'rider') {
          const o = await env.DB.prepare('SELECT * FROM orders WHERE shop_id=? AND id=?').bind(shop, seg[1]).first();
          if (!o) return err('not found', req, 404);
          const row = rowOrder(o);
          const jobId = row.riderJob || (row.voidReq && null);
          if (!jobId) return json({ called: false }, req);
          const base = env.PLATFORM_URL || 'https://platform.oneday-pos.workers.dev';
          const path = `/pool/job/${encodeURIComponent(jobId)}?region=delivery`;
          try {
            // service binding ก่อนเสมอ — ยิงผ่าน URL สาธารณะ worker ต่อ worker บัญชีเดียวกันไม่ผ่าน
            const r = env.PLATFORM
              ? await env.PLATFORM.fetch(new Request(base + path, { headers: { accept: 'application/json' } }))
              : await fetch(base + path, { headers: { accept: 'application/json' } });
            if (!r.ok) return json({ called: true, job: null, rider: null }, req);
            const j = await r.json();
            return json({ called: true, ...j }, req);
          } catch (e) {
            // platform ล่ม = ยังบอกได้ว่าเรียกไรเดอร์แล้ว แค่ยังไม่รู้สถานะ ไม่ใช่พังทั้งหน้า
            return json({ called: true, job: null, rider: null, offline: true }, req);
          }
        }
        if (req.method === 'GET' && seg[1]) {
          const r = await env.DB.prepare('SELECT * FROM orders WHERE shop_id=? AND id=?').bind(shop, seg[1]).first();
          return r ? json(rowOrder(r), req) : err('not found', req, 404);
        }
        if (req.method === 'POST' && !seg[1]) {
          const b = await readBody();
          await ensureOrderCols(env);
          await ensureOrderCols(env);
          const id = (b.id && /^[a-z0-9_-]{1,40}$/i.test(b.id)) ? b.id : ('o' + now()), no = await nextOrderNo(env, shop), ts = now();

          /* ── ส่วนลด: คิดใหม่ทั้งหมดที่นี่ ไม่เชื่อยอดจากแอป ──
             แอปแก้ค่าในเบราว์เซอร์ได้ ถ้ารับ total ตรง ๆ = สั่งของฟรีได้ */
          const _lines = await promoLinesFromDB(env, shop, b.items || []);
          const _subtotal = _lines.reduce((a, l) => a + l.price * l.qty, 0);
          // ส่วนลดสมาชิกตามระดับ — เพดานคือค่าที่คิดจากราคาในฐานข้อมูล
          let _memberCap = 0;
          if (b.lineUserId) {
            const L = await loyaltyCfg(env, shop);
            const mem = await env.DB.prepare('SELECT tier FROM members WHERE shop_id=? AND id=?').bind(shop, b.lineUserId).first();
            const pct = Number(((L.tierDisc || {})[(mem && mem.tier) || 'member'])) || 0;
            _memberCap = pct > 0 ? Math.round(_subtotal * pct / 100) : 0;
          }
          // โปร/คูปองที่ลูกค้าเลือก — ตรวจเงื่อนไขและคิดยอดใหม่จากราคาจริง
          let _promo = null, _promoDisc = 0, _promoFeeDisc = 0;
          if (b.promoId) {
            const evald = await promoEvaluate(env, shop, {
              lines: _lines, subtotal: _subtotal, fee: b.fee | 0,
              channel: b.channel || 'line', lineUser: b.lineUserId || null, at: ts });
            const hit = evald.find(p => p.id === b.promoId);
            if (hit && !hit.blocked) { _promo = hit; _promoDisc = hit.disc | 0; _promoFeeDisc = hit.feeDisc | 0; }
          }
          // โปรที่ไม่ได้ตั้งให้ใช้ร่วมกับส่วนลดสมาชิก → ตัดส่วนลดสมาชิกออกจากบิลนี้
          const _memberDisc = (_promo && !_promo.stackable) ? 0 : Math.max(0, Math.min(b.memberDisc | 0, _memberCap));
          // ยอดต่ำสุดที่เป็นไปได้ = ค่าอาหารจริง − ส่วนลดที่อนุมัติแล้ว (ตัวเลือกเสริม/ค่าส่งมีแต่บวก)
          const _floor = Math.max(0, _subtotal - _memberDisc - _promoDisc - _promoFeeDisc);
          const _total = Math.max(b.total | 0, _floor);

          await env.DB.prepare(
            `INSERT INTO orders (shop_id,id,no,items,channel,pay,status,paid,total,cost,fee,qnum,
               table_no,customer,addr,when_txt,line_user,line_name,pay_after_confirm,created_at,updated_at,
               subtotal,member_disc,promo_id,promo_name,promo_disc,promo_fee_disc)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          ).bind(shop, id, no, JSON.stringify(normItems(b.items)), b.channel || 'line', b.pay || 'promptpay',
                 'new', 0, _total, b.cost | 0, b.fee | 0, b.qnum ?? null,
                 (b.table != null && b.table !== '') ? String(b.table) : null,
                 b.customer || '', b.addr || '', b.when || '', b.lineUserId || null, b.lineName || '', b.payAfterConfirm ? 1 : 0, ts, ts,
                 _subtotal, _memberDisc, _promo ? _promo.id : null, _promo ? _promo.name : '', _promoDisc, _promoFeeDisc).run();
          if (_promo) {   // ตัดสิทธิ์หลังบันทึกออเดอร์สำเร็จ — ไม่งั้นออเดอร์พังแต่โควตาหาย
            await env.DB.prepare('UPDATE promos SET used=used+1, updated_at=? WHERE shop_id=? AND id=?').bind(ts, shop, _promo.id).run();
            await env.DB.prepare('INSERT INTO promo_uses (shop_id,promo_id,order_id,line_user,amount,at) VALUES (?,?,?,?,?,?)')
              .bind(shop, _promo.id, id, b.lineUserId || null, _promoDisc + _promoFeeDisc, ts).run();
          }
          if (b.lineUserId) {
            await env.DB.prepare(
              `INSERT INTO members (shop_id,id,name,avatar,tier,points,visits,created_at,updated_at)
               VALUES (?,?,?,?,?,0,1,?,?)
               ON CONFLICT(shop_id,id) DO UPDATE SET visits=visits+1, name=excluded.name, updated_at=excluded.updated_at`
            ).bind(shop, b.lineUserId, b.lineName || 'ลูกค้า LINE', b.lineAvatar || '', 'member', ts, ts).run();
          }
          const out = rowOrder(await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first());
          if (out.pay === 'promptpay' || out.pay === 'transfer') {
            const s = await getShop(env, shop);
            if (s && s.promptpay_id) out.promptpay = promptpayPayload(s.promptpay_id, out.total);
          }
          await linePush(env, out.lineUserId, [{ type: 'text',
            text: `🧾 รับออเดอร์ #${out.no} แล้ว\nรวม ฿${out.total.toLocaleString('en-US')}\nสถานะ: ${STATUS_TH.new}` }]);
          ctx.waitUntil(hubBroadcast(env, shop, { type: 'order', id: out.id, no: out.no, status: 'new' }));
          return json(out, req, 201);
        }
        if (req.method === 'PATCH' && seg[1]) {
          const b = await readBody();
          await ensureOrderCols(env);
          const cur = await env.DB.prepare('SELECT * FROM orders WHERE shop_id=? AND id=?').bind(shop, seg[1]).first();
          if (!cur) return err('not found', req, 404);
          const status = b.status || cur.status;
          const paid = b.paid != null ? (b.paid ? 1 : 0) : cur.paid;
          const callCash = b.callCash != null ? (b.callCash ? 1 : 0) : cur.call_cash;
          const callCashAt = b.callCashAt != null ? b.callCashAt : cur.call_cash_at;
          const slipUrl = b.slipUrl != null ? b.slipUrl : cur.slip_url;
          // audit: บันทึกพนักงานที่รับออเดอร์ (new→อื่น) / ยืนยันรับเงิน (paid) — ตั้งครั้งแรกเท่านั้น ไม่เขียนทับ
          const _acptNow = cur.status === 'new' && status && status !== 'new';
          const _paidNow = paid && !cur.paid;
          const acceptedBy = (_acptNow && !cur.accepted_by) ? (b.staffId || null) : (cur.accepted_by || null);
          const acceptedByName = (_acptNow && !cur.accepted_by_name) ? (b.staffName || null) : (cur.accepted_by_name || null);
          const verifiedBy = (_paidNow && !cur.verified_by) ? (b.staffId || null) : (cur.verified_by || null);
          const verifiedByName = (_paidNow && !cur.verified_by_name) ? (b.staffName || null) : (cur.verified_by_name || null);
          const voidReq = b.voidReq !== undefined ? (b.voidReq ? JSON.stringify(b.voidReq) : null) : (cur.void_req || null);
          const curRefund = (()=>{ try{ return cur.refund ? JSON.parse(cur.refund) : null; }catch(e){ return null; } })();
          const refundJson = b.refund !== undefined ? (b.refund ? JSON.stringify(b.refund) : null) : (cur.refund || null);
          // งานไรเดอร์: ตั้งได้ครั้งเดียว เขียนทับไม่ได้ กันเรียกซ้ำแล้วงานเดิมหลุดการติดตาม
          const riderJob = cur.rider_job || (b.riderJob ? String(b.riderJob).slice(0, 60) : null);
          const riderJobAt = cur.rider_job_at || (b.riderJob ? now() : null);
          await env.DB.prepare('UPDATE orders SET status=?, paid=?, call_cash=?, call_cash_at=?, slip_url=?, accepted_by=?, accepted_by_name=?, verified_by=?, verified_by_name=?, void_req=?, refund=?, rider_job=?, rider_job_at=?, updated_at=? WHERE shop_id=? AND id=?')
            .bind(status, paid, callCash, callCashAt, slipUrl, acceptedBy, acceptedByName, verifiedBy, verifiedByName, voidReq, refundJson, riderJob, riderJobAt, now(), shop, seg[1]).run();
          if (cur.line_user) {
            // ⏱️ จังหวะการได้แต้ม ตามที่ร้านตั้ง (loyalty.earnOn): paid=ตอนจ่ายเงิน · accept=ตอนรับออเดอร์ · delivered=ตอนปิดงาน
            const L = await loyaltyCfg(env, shop);
            const earnOn = L.earnOn || 'paid';
            const trigger = (earnOn === 'paid' && paid && !cur.paid)
              || (earnOn === 'accept' && cur.status === 'new' && status && status !== 'new')
              || (earnOn === 'delivered' && cur.status !== 'done' && status === 'done');
            if (trigger) {
              const per = Number(L.perBaht) > 0 ? Number(L.perBaht) : 25;
              const pts = Math.floor((cur.total || 0) / per);
              if (pts > 0) await env.DB.prepare('UPDATE members SET points=points+?, updated_at=? WHERE shop_id=? AND id=?')
                .bind(pts, now(), shop, cur.line_user).run();
              await bumpTier(env, shop, cur.line_user);
            }
          }
          // ทุกข้อความ LINE มีค่าใช้จ่าย (โควตาฟรี 500/เดือน) — ค่าเริ่มต้นส่งเฉพาะจังหวะที่ลูกค้าต้องรู้จริง ๆ
          // คือ "พร้อมแล้ว" กับ "ส่งถึง/จบงาน" · ตั้ง NOTIFY_LINE_LEVEL=all ถ้าอยากได้ทุกสถานะ (จ่ายเพิ่ม)
          const _lvl = env.NOTIFY_LINE_LEVEL || 'key';
          const _tellStatus = _lvl === 'all' || (_lvl === 'key' && ['ready', 'delivering', 'done'].includes(status));
          if (b.status && b.status !== cur.status && cur.line_user && _lvl !== 'off' && _tellStatus)
            await linePush(env, cur.line_user, [{ type: 'text', text: `ออเดอร์ #${cur.no}: ${STATUS_TH[status] || status}` }]);
          // Confirm-First: ร้านยืนยันรับ (new → อื่น) ออเดอร์ที่ยังไม่จ่าย พร้อมเพย์ → แจ้งลูกค้าให้จ่ายได้แล้ว
          if (cur.pay_after_confirm && cur.status === 'new' && status && status !== 'new' && !cur.paid && cur.pay === 'promptpay' && cur.line_user) {
            const s = await getShop(env, shop);
            const pp = (s && s.promptpay_id) ? promptpayPayload(s.promptpay_id, cur.total) : null;
            await linePush(env, cur.line_user, [{ type: 'text',
              text: `✅ ร้านยืนยันออเดอร์ #${cur.no} แล้ว\nกรุณาชำระ ฿${(cur.total||0).toLocaleString('en-US')} — เปิดหน้า “ติดตามออเดอร์” เพื่อสแกน QR พร้อมเพย์แล้วแนบสลิป` }]);
          }
          // ร้านตอบกลับเรื่องเวลานัดรับ → แจ้งลูกค้าทาง LINE
          if (b.promise && cur.line_user) {
            const msg = b.promise.status === 'ok'
              ? `✅ ออเดอร์ #${cur.no}: ร้านยืนยันรับได้ตามเวลา ${b.promise.time || ''}`.trim()
              : `⏰ ออเดอร์ #${cur.no}: ร้านขอเลื่อนเวลารับเป็น ${b.promise.time || ''}`.trim();
            await linePush(env, cur.line_user, [{ type: 'text', text: msg }]);
          }
          // 💸 SMS/แจ้งเตือนคืนเงิน (payFirst) — เปลี่ยนสถานะ refund บนออเดอร์
          if (b.refund) {
            const nr = b.refund, or = curRefund || {};
            const sh = await getShop(env, shop);
            const shopName = (sh && sh.name) || 'ร้านค้า';
            const custBase = env.CUST_BASE || url.origin;
            const link = `${custBase}/?shop=${encodeURIComponent(shop)}`;
            const amt = '฿' + ((nr.amount || cur.total || 0)).toLocaleString('en-US');
            const to = { phone: nr.phone || null, lineUser: cur.line_user };
            if (nr.status === 'pending' && or.status !== 'pending') {
              const reason = nr.reason ? `\n❌ เหตุผล: ${nr.reason}` : '';
              ctx.waitUntil(notifyCustomer(env, to, `🚨 ขออภัยค่ะ ร้าน ${shopName} ไม่สามารถรับออเดอร์ #${cur.no} ได้${reason}\n💰 ระบบจะคืนเงิน ${amt} ให้คุณ กรุณากรอกบัญชีรับเงินคืนที่นี่: ${link}`));
            }
            if (nr.status === 'refunded' && or.status !== 'refunded') {
              ctx.waitUntil(notifyCustomer(env, to, `✅ ร้าน ${shopName} โอนเงินคืน ${amt} ให้คุณเรียบร้อยแล้ว ตรวจสอบหลักฐานได้ที่: ${link}`));
            }
          }
          const row = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(seg[1]).first();
          ctx.waitUntil(hubBroadcast(env, shop, { type: 'order', id: seg[1], status }));
          return json(rowOrder(row), req);
        }
        if (req.method === 'POST' && seg[1] && seg[2] === 'slip') {
          if (!env.SLIPS) return err('slip storage not configured', req, 501);
          const b = await readBody();
          const m = /^data:(image\/\w+);base64,(.+)$/.exec(b.image || '');
          if (!m) return err('bad image', req);
          const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
          const key = `slip/${shop}/${seg[1]}-${now()}.${m[1].split('/')[1]}`;
          await env.SLIPS.put(key, bytes, { httpMetadata: { contentType: m[1] } });
          const slipUrl = `${url.origin}/${key}`;
          await env.DB.prepare('UPDATE orders SET slip_url=?, updated_at=? WHERE shop_id=? AND id=?')
            .bind(slipUrl, now(), shop, seg[1]).run();
          return json({ ok: true, slipUrl }, req);
        }
      }

      /* ── BANK ALERT webhook: ข้อความแจ้งเงินเข้าจากกลุ่ม LINE → auto จับคู่บิลพร้อมเพย์ที่ค้างตรวจ ── */
      if (seg[0] === 'bank-alert' && req.method === 'POST') {
        const b = await readBody();
        const r = await autoMatchAlert(env, shop, b.text || b.message || '');
        return json({ ok:true, ...r }, req);
      }
      /* ── LINE pairing: ผูกกลุ่ม↔ร้านด้วยรหัสจับคู่ ── */
      if (seg[0] === 'line-pair') {
        await ensureLinePairs(env);
        if (req.method === 'POST' && seg[1] === 'code') {
          const row = await env.DB.prepare("SELECT * FROM line_pairs WHERE shop_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1").bind(shop).first();
          const code = row ? row.code : String(Math.floor(1000 + Math.random()*9000));
          if (!row) await env.DB.prepare('INSERT INTO line_pairs (shop_id,code,group_id,status,created_at) VALUES (?,?,?,?,?)').bind(shop, code, null, 'pending', now()).run();
          const botId = env.LINE_BOT_ID || '';
          return json({ ok:true, code, bot: botId, addFriend: botId ? ('https://line.me/R/ti/p/' + botId) : '' }, req);
        }
        if (req.method === 'GET') {
          const r = await env.DB.prepare('SELECT * FROM line_pairs WHERE shop_id=? ORDER BY created_at DESC LIMIT 1').bind(shop).first();
          return json({ ok:true, status: r?r.status:'none', code: r?r.code:null, groupId: r?r.group_id:null }, req);
        }
      }
      if (seg[0] === 'slip' && req.method === 'GET' && env.SLIPS) {
        const obj = await env.SLIPS.get(path.slice(1));
        if (!obj) return err('not found', req, 404);
        return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'image/jpeg', ...cors(req) } });
      }

      /* ── MEMBERS ── */
      if (seg[0] === 'members') {
        if (req.method === 'GET' && seg[1]) {
          const r = await env.DB.prepare('SELECT * FROM members WHERE shop_id=? AND id=?').bind(shop, seg[1]).first();
          return json(r || null, req);
        }
        if (req.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM members WHERE shop_id=? ORDER BY points DESC LIMIT 500').bind(shop).all();
          return json(results, req);
        }
        // เพิ่ม/แก้สมาชิก (POS: สมาชิกแบบเบอร์/สแกน QR) — upsert ด้วย id (เบอร์=m<เลข> · LINE=Line_ID)
        if (req.method === 'POST' && !seg[1]) {
          await ensureMemberCols(env);
          const b = await readBody();
          const id = (b.id && /^[a-z0-9_-]{1,60}$/i.test(b.id)) ? b.id : ('m' + now());
          await env.DB.prepare(
            `INSERT INTO members (shop_id,id,name,phone,tier,points,visits,created_at,updated_at)
             VALUES (?,?,?,?,?,0,0,?,?)
             ON CONFLICT(shop_id,id) DO UPDATE SET name=excluded.name, phone=excluded.phone, updated_at=excluded.updated_at`
          ).bind(shop, id, b.name || '', b.phone || '', 'member', now(), now()).run();
          const r = await env.DB.prepare('SELECT * FROM members WHERE shop_id=? AND id=?').bind(shop, id).first();
          return json(r, req, 201);
        }
        // คิดแต้ม/แก้ข้อมูลสมาชิก: {addPoints, addVisits, name, phone}
        if (req.method === 'PATCH' && seg[1]) {
          await ensureMemberCols(env);
          const b = await readBody();
          const cur = await env.DB.prepare('SELECT * FROM members WHERE shop_id=? AND id=?').bind(shop, seg[1]).first();
          if (!cur) return err('not found', req, 404);
          const name = b.name != null ? b.name : cur.name;
          const phone = b.phone != null ? b.phone : (cur.phone || '');
          const points = Math.max(0, (cur.points || 0) + (Number(b.addPoints) || 0));
          const visits = (cur.visits || 0) + (Number(b.addVisits) || 0);
          await env.DB.prepare('UPDATE members SET name=?, phone=?, points=?, visits=?, updated_at=? WHERE shop_id=? AND id=?')
            .bind(name, phone, points, visits, now(), shop, seg[1]).run();
          await bumpTier(env, shop, seg[1]);
          const r = await env.DB.prepare('SELECT * FROM members WHERE shop_id=? AND id=?').bind(shop, seg[1]).first();
          return json(r, req);
        }
      }

      /* ── RAW MATERIALS (สต๊อก) — client เป็นเจ้าของค่า · server เก็บอย่างเดียว ── */
      if (seg[0] === 'raw') {
        await ensureShopTables(env);
        if (req.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM raw WHERE shop_id=? ORDER BY cat,id').bind(shop).all();
          return json(results.map(r => ({ id:r.id, cat:r.cat, th:r.th, unit:r.unit, stock:r.stock, avgCost:r.avg_cost, low:r.low })), req);
        }
        if (req.method === 'PUT') { // แทนทั้งชุด
          const b = await readBody(); const list = Array.isArray(b.raw) ? b.raw : [];
          const ts = now();
          const stmts = [ env.DB.prepare('DELETE FROM raw WHERE shop_id=?').bind(shop) ];
          for (const r of list) stmts.push(env.DB.prepare(
            'INSERT INTO raw (shop_id,id,cat,th,unit,stock,avg_cost,low,updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
          ).bind(shop, r.id, r.cat||'other', r.th||'', r.unit||'g', +r.stock||0, +r.avgCost||0, +r.low||0, ts));
          await env.DB.batch(stmts);
          return json({ ok:true, count:list.length }, req);
        }
      }

      /* ── PURCHASES (ซื้อของเข้า) ── */
      if (seg[0] === 'purchases') {
        await ensureShopTables(env);
        if (req.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM purchases WHERE shop_id=? ORDER BY date DESC, created_at DESC LIMIT 500').bind(shop).all();
          return json(results.map(p => ({ id:p.id, date:p.date, note:p.note, lines:JSON.parse(p.lines||'[]'), total:p.total })), req);
        }
        if (req.method === 'POST') {
          const b = await readBody(); const id = b.id || 'pc'+now();
          const lines = b.lines||[]; const total = lines.reduce((a,l)=>a+(+l.price||0),0);
          await env.DB.prepare('INSERT OR REPLACE INTO purchases (shop_id,id,date,note,lines,total,created_at) VALUES (?,?,?,?,?,?,?)')
            .bind(shop, id, b.date||'', b.note||'', JSON.stringify(lines), total, now()).run();
          return json({ ok:true, id }, req);
        }
        if (req.method === 'DELETE' && seg[1]) {
          await env.DB.prepare('DELETE FROM purchases WHERE shop_id=? AND id=?').bind(shop, seg[1]).run();
          return json({ ok:true }, req);
        }
      }

      /* ── CASH DAYS (ปิดวัน) ── */
      if (seg[0] === 'cash-days') {
        await ensureShopTables(env);
        if (req.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM cash_days WHERE shop_id=? ORDER BY created_at DESC LIMIT 500').bind(shop).all();
          return json(results.map(d => ({ id:d.id, ...JSON.parse(d.data||'{}') })), req);
        }
        if (req.method === 'POST') {
          const b = await readBody(); const id = b.id || 'cd'+now();
          await env.DB.prepare('INSERT OR REPLACE INTO cash_days (shop_id,id,date,data,created_at) VALUES (?,?,?,?,?)')
            .bind(shop, id, b.date||'', JSON.stringify(b), now()).run();
          return json({ ok:true, id }, req);
        }
      }

      /* ── QUOTES (ใบเสนอราคา) ── */
      if (seg[0] === 'quotes') {
        await ensureShopTables(env);
        if (req.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM quotes WHERE shop_id=? ORDER BY created_at DESC LIMIT 500').bind(shop).all();
          return json(results.map(q => ({ id:q.id, ...JSON.parse(q.data||'{}') })), req);
        }
        if (req.method === 'POST') {
          const b = await readBody(); const id = b.id || 'qt'+now();
          await env.DB.prepare('INSERT OR REPLACE INTO quotes (shop_id,id,status,data,created_at) VALUES (?,?,?,?,?)')
            .bind(shop, id, b.status||'pending', JSON.stringify(b), b.savedAt||b.createdAt||now()).run();
          return json({ ok:true, id }, req);
        }
        if (req.method === 'DELETE' && seg[1]) {
          await env.DB.prepare('DELETE FROM quotes WHERE shop_id=? AND id=?').bind(shop, seg[1]).run();
          return json({ ok:true }, req);
        }
      }

      /* ── SALES (บิลที่คีย์หน้าขาย POS · แยกจากคิวออเดอร์ลูกค้า) ── */
      if (seg[0] === 'sales') {
        if (req.method === 'GET' && !seg[1]) {
          const since = url.searchParams.get('since');
          let q = 'SELECT * FROM sales WHERE shop_id=?', b = [shop];
          if (since) { q += ' AND created_at > ?'; b.push(+since); }
          q += ' ORDER BY created_at DESC LIMIT 500';
          const { results } = await env.DB.prepare(q).bind(...b).all();
          return json(results.map(r => ({ id:r.id, no:r.no, date:r.date, channel:r.channel, pay:r.pay, total:r.total, qnum:r.qnum, ...JSON.parse(r.data||'{}') })), req);
        }
        if (req.method === 'POST' && !seg[1]) {
          const b = await readBody();
          const id = b.id || 's' + now();
          const no = b.no || await nextSaleNo(env, shop);
          const ts = now();
          const { shopId, shop:_s, ...rest } = b;
          const data = { ...rest, id, no };
          await env.DB.prepare(
            'INSERT OR REPLACE INTO sales (shop_id,id,no,date,channel,pay,total,qnum,data,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
          ).bind(shop, id, no, b.date || new Date(ts).toISOString().slice(0,10), b.channel || '', b.pay || '',
                 b.total | 0, (b.qnum != null && b.qnum !== '') ? String(b.qnum) : null, JSON.stringify(data), ts).run();
          return json({ ok: true, id, no }, req, 201);
        }
        // PATCH /sales/:id — อัปเดตบางฟิลด์ (ยืนยันรับเงิน/กระทบยอด ฯลฯ) แบบ merge เข้า data
        if (req.method === 'PATCH' && seg[1]) {
          const b = await readBody();
          const cur = await env.DB.prepare('SELECT * FROM sales WHERE shop_id=? AND id=?').bind(shop, seg[1]).first();
          if (!cur) return err('not found', req, 404);
          const { shopId, shop:_s, ...patch } = b;
          const data = { ...JSON.parse(cur.data||'{}'), ...patch };
          await env.DB.prepare('UPDATE sales SET data=?, total=?, qnum=? WHERE shop_id=? AND id=?')
            .bind(JSON.stringify(data), (patch.total!=null?patch.total|0:cur.total),
                  (patch.qnum!=null && patch.qnum!=='') ? String(patch.qnum) : cur.qnum, shop, seg[1]).run();
          return json({ ok: true }, req);
        }
        if (req.method === 'DELETE' && seg[1]) {
          await env.DB.prepare('DELETE FROM sales WHERE shop_id=? AND id=?').bind(shop, seg[1]).run();
          return json({ ok: true }, req);
        }
      }

      /* ── DELIVERY SETTLEMENT (กระทบยอดเดลิเวอรี · Expected vs Actual ต่อช่องทาง/วัน · ย้อนหลังได้) ── */
      if (seg[0] === 'delivery-settlement') {
        await ensureDeliverySettle(env);
        // GET /delivery-settlement/summary?from&to — สรุปส่วนต่างสะสมต่อช่องทาง
        if (req.method === 'GET' && seg[1] === 'summary') {
          const from = url.searchParams.get('from'), to = url.searchParams.get('to');
          let q = 'SELECT channel, SUM(gross) gross, SUM(expected_net) expected, SUM(actual_received) actual, SUM(variance) variance, COUNT(*) days FROM delivery_settlement_logs WHERE shop_id=?', bind=[shop];
          if (from) { q+=' AND business_date>=?'; bind.push(from); }
          if (to)   { q+=' AND business_date<=?'; bind.push(to); }
          q+=' GROUP BY channel';
          const { results } = await env.DB.prepare(q).bind(...bind).all();
          return json(results, req);
        }
        // GET /delivery-settlement?channel&from&to — รายการ log
        if (req.method === 'GET' && !seg[1]) {
          const ch = url.searchParams.get('channel'), from = url.searchParams.get('from'), to = url.searchParams.get('to');
          let q = 'SELECT * FROM delivery_settlement_logs WHERE shop_id=?', bind=[shop];
          if (ch)   { q+=' AND channel=?'; bind.push(ch); }
          if (from) { q+=' AND business_date>=?'; bind.push(from); }
          if (to)   { q+=' AND business_date<=?'; bind.push(to); }
          q+=' ORDER BY business_date DESC, channel';
          const { results } = await env.DB.prepare(q).bind(...bind).all();
          return json(results.map(rowDelSet), req);
        }
        // POST /delivery-settlement — บันทึกยอดเข้าจริง + คำนวณส่วนต่าง (คู่กับ expected) · upsert ต่อ channel+วัน
        if (req.method === 'POST' && !seg[1]) {
          const b = await readBody();
          if (!b.channel || !b.businessDate) return err('channel & businessDate required', req);
          const gross = +b.gross||0, gpPct = +b.gpPct||0, vatOnGp = b.vatOnGp?1:0;
          const gpAmt = gross*gpPct/100, vatAmt = vatOnGp ? gpAmt*0.07 : 0;
          const expected = (b.expectedNet!=null) ? +b.expectedNet : (gross - gpAmt - vatAmt);
          const actual = (b.actualReceived!=null && b.actualReceived!=='') ? +b.actualReceived : null;
          const variance = actual!=null ? (actual - expected) : null;
          const id = shop+':'+b.channel+':'+b.businessDate, ts = now();
          await env.DB.prepare(`INSERT INTO delivery_settlement_logs
            (id,shop_id,channel,business_date,gross,gp_pct,vat_on_gp,expected_net,actual_received,variance,settlement_date,note,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET gross=excluded.gross, gp_pct=excluded.gp_pct, vat_on_gp=excluded.vat_on_gp,
              expected_net=excluded.expected_net, actual_received=excluded.actual_received, variance=excluded.variance,
              settlement_date=excluded.settlement_date, note=excluded.note, updated_at=excluded.updated_at`)
            .bind(id, shop, b.channel, b.businessDate, gross, gpPct, vatOnGp, expected, actual, variance, b.settlementDate||null, b.note||'', ts, ts).run();
          return json({ ok:true, id, expectedNet: expected, variance }, req, 201);
        }
      }

      /* ── INVENTORY TRANSACTIONS (แหล่งความจริงเดียวของ movement · Running Balance ผ่าน window fn) ── */
      if (seg[0] === 'inv-tx') {
        await ensureInvTx(env);
        // GET /inv-tx?from&to&type&location&rm — Running Balance สะสมต่อ rm (window fn เต็มประวัติ แล้วค่อยกรองช่วง)
        if (req.method === 'GET' && !seg[1]) {
          const from = url.searchParams.get('from'), to = url.searchParams.get('to');
          const type = url.searchParams.get('type'), loc = url.searchParams.get('location'), rm = url.searchParams.get('rm');
          let q = `WITH bal AS (SELECT *, SUM(qty) OVER (PARTITION BY rm_id ORDER BY created_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance FROM inventory_transactions WHERE shop_id=?) SELECT * FROM bal WHERE 1=1`;
          const bind = [shop];
          if (from) { q += ' AND created_at>=?'; bind.push(new Date(from+'T00:00:00').getTime()); }
          if (to)   { q += ' AND created_at<=?'; bind.push(new Date(to+'T23:59:59').getTime()); }
          if (type && type !== 'ALL') { q += ' AND movement_type=?'; bind.push(type); }
          if (loc && loc !== 'ALL')   { q += ' AND location_id=?'; bind.push(loc); }
          if (rm) { q += ' AND rm_id=?'; bind.push(rm); }
          q += ' ORDER BY created_at DESC LIMIT 2000';
          const { results } = await env.DB.prepare(q).bind(...bind).all();
          return json(results.map(rowInvTx), req);
        }
        // POST /inv-tx — บันทึก movement เดี่ยว/ชุด (batch) · client เรียกตอน ซื้อเข้า/ตัดขาย/ของเสีย/ปรับมือ
        if (req.method === 'POST' && !seg[1]) {
          const b = await readBody();
          const list = Array.isArray(b.batch) ? b.batch : [b];
          const ts = now(); const stmts = []; let n = 0;
          for (const t of list) {
            if (!t.rmId || !t.movementType || t.qty == null) continue;
            const id = t.id || ('it' + ts + (n++) + Math.random().toString(36).slice(2, 5));
            stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO inventory_transactions
              (id,shop_id,location_id,rm_id,movement_type,qty,ref_type,ref_id,reason,handled_by,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, shop, t.locationId || 'main', t.rmId, t.movementType,
              +t.qty || 0, t.refType || null, t.refId || null, t.reason || '', t.handledBy || 'system', t.createdAt || ts));
          }
          if (stmts.length) await env.DB.batch(stmts);
          return json({ ok: true, count: stmts.length }, req, 201);
        }
      }

      /* ── VENDORS (ซัพพลายเออร์รับฝากขาย inbound) ── */
      if (seg[0] === 'vendors') {
        await ensureConsign(env);
        if (req.method === 'GET') { const { results } = await env.DB.prepare('SELECT * FROM vendors WHERE shop_id=? ORDER BY created_at DESC').bind(shop).all(); return json(results.map(rowVendor), req); }
        if (req.method === 'POST') { const b = await readBody(); const id = b.id || ('vd' + now());
          await env.DB.prepare(`INSERT INTO vendors (shop_id,id,name,phone,bank,acct_no,acct_name,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)
            ON CONFLICT(shop_id,id) DO UPDATE SET name=excluded.name,phone=excluded.phone,bank=excluded.bank,acct_no=excluded.acct_no,acct_name=excluded.acct_name,note=excluded.note`)
            .bind(shop, id, b.name || '', b.phone || '', b.bank || '', b.acctNo || '', b.acctName || '', b.note || '', now()).run();
          return json({ ok: true, id }, req, 201); }
        if (req.method === 'DELETE' && seg[1]) { await env.DB.prepare('DELETE FROM vendors WHERE shop_id=? AND id=?').bind(shop, seg[1]).run(); return json({ ok: true }, req); }
      }

      /* ── LOCATIONS (คลัง/สาขา/จุดส่งฝากขาย outbound) ── */
      if (seg[0] === 'locations') {
        await ensureConsign(env);
        if (req.method === 'GET') { const { results } = await env.DB.prepare('SELECT * FROM locations WHERE shop_id=? ORDER BY created_at DESC').bind(shop).all(); return json(results.map(rowLoc), req); }
        if (req.method === 'POST') { const b = await readBody(); const id = b.id || ('lc' + now());
          await env.DB.prepare(`INSERT INTO locations (shop_id,id,name,kind,address,lat,lng,partner_name,partner_phone,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(shop_id,id) DO UPDATE SET name=excluded.name,kind=excluded.kind,address=excluded.address,lat=excluded.lat,lng=excluded.lng,partner_name=excluded.partner_name,partner_phone=excluded.partner_phone`)
            .bind(shop, id, b.name || '', b.kind || 'store', b.address || '', b.lat ?? null, b.lng ?? null, b.partnerName || '', b.partnerPhone || '', now()).run();
          return json({ ok: true, id }, req, 201); }
        if (req.method === 'DELETE' && seg[1]) { await env.DB.prepare('DELETE FROM locations WHERE shop_id=? AND id=?').bind(shop, seg[1]).run(); return json({ ok: true }, req); }
      }

      /* ── CONSIGNMENT STOCK (คลังขายฝาก แยกขาดจากคลังหลัก) + settlement ── */
      if (seg[0] === 'consignment-stock') {
        await ensureConsign(env); await ensureInvTx(env);
        if (req.method === 'GET') {
          const dir = url.searchParams.get('direction'), vd = url.searchParams.get('vendor'), lc = url.searchParams.get('location');
          let q = 'SELECT * FROM consignment_stock WHERE shop_id=?', bind = [shop];
          if (dir) { q += ' AND direction=?'; bind.push(dir); }
          if (vd)  { q += ' AND vendor_id=?'; bind.push(vd); }
          if (lc)  { q += ' AND location_id=?'; bind.push(lc); }
          q += ' ORDER BY created_at DESC';
          const { results } = await env.DB.prepare(q).bind(...bind).all();
          return json(results.map(rowConsign), req);
        }
        if (req.method === 'POST') { const b = await readBody(); const id = b.id || ('cs' + now()); const ts = now();
          await env.DB.prepare(`INSERT INTO consignment_stock (shop_id,id,direction,name,sku,vendor_id,location_id,price,settle_model,share_pct,cost_wholesale,rental_fee,stock,unit,low,active,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(shop_id,id) DO UPDATE SET direction=excluded.direction,name=excluded.name,sku=excluded.sku,vendor_id=excluded.vendor_id,location_id=excluded.location_id,price=excluded.price,settle_model=excluded.settle_model,share_pct=excluded.share_pct,cost_wholesale=excluded.cost_wholesale,rental_fee=excluded.rental_fee,stock=excluded.stock,unit=excluded.unit,low=excluded.low,active=excluded.active,updated_at=excluded.updated_at`)
            .bind(shop, id, b.direction || 'inbound', b.name || '', b.sku || '', b.vendorId || null, b.locationId || null,
              b.price | 0, b.settleModel || 'per_sale', b.sharePct ?? null, b.costWholesale ?? null, b.rentalFee ?? null,
              +b.stock || 0, b.unit || 'pcs', +b.low || 0, b.active === false ? 0 : 1, ts, ts).run();
          return json({ ok: true, id }, req, 201); }
        if (req.method === 'DELETE' && seg[1]) { await env.DB.prepare('DELETE FROM consignment_stock WHERE shop_id=? AND id=?').bind(shop, seg[1]).run(); return json({ ok: true }, req); }
      }

      /* ── CONSIGNMENT ops: sale / receive / return / transfer / stocktake / settle / documents ── */
      if (seg[0] === 'consignment') {
        await ensureConsign(env); await ensureInvTx(env);
        const getCs = (id) => env.DB.prepare('SELECT * FROM consignment_stock WHERE shop_id=? AND id=?').bind(shop, id).first();
        const bumpStock = async (id, delta) => { await env.DB.prepare('UPDATE consignment_stock SET stock=stock+?, updated_at=? WHERE shop_id=? AND id=?').bind(delta, now(), shop, id).run(); };
        const logTx = (cs, type, qty, reason, ref) => env.DB.prepare(`INSERT INTO inventory_transactions (id,shop_id,location_id,rm_id,movement_type,qty,ref_type,ref_id,reason,handled_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
          .bind('it' + now() + Math.random().toString(36).slice(2, 5), shop, cs.location_id || 'main', cs.id, type, qty, 'consignment', ref || null, reason || '', 'system', now()).run();
        // POST /consignment/sale {id, qty} — ตัดจากคลังขายฝากเท่านั้น (ห้ามปนคลังหลัก) → CONSIGN_SALE
        if (req.method === 'POST' && seg[1] === 'sale') {
          const b = await readBody(); const cs = await getCs(b.id); if (!cs) return err('consignment item not found', req, 404);
          const q = Math.abs(+b.qty || 1); await bumpStock(cs.id, -q); await logTx(cs, 'CONSIGN_SALE', -q, b.reason || 'ขายสินค้าฝาก', b.orderId);
          const upd = await getCs(cs.id); return json({ ok: true, stock: upd.stock, soldOut: upd.stock <= 0 }, req, 201);
        }
        // POST /consignment/receive {id, qty} — รับฝากเข้า (inbound) → GOODS_RECEIPT
        if (req.method === 'POST' && seg[1] === 'receive') {
          const b = await readBody(); const cs = await getCs(b.id); if (!cs) return err('not found', req, 404);
          const q = Math.abs(+b.qty || 0); await bumpStock(cs.id, q); await logTx(cs, 'GOODS_RECEIPT', q, b.reason || 'รับฝากเข้า', b.docId);
          return json({ ok: true }, req, 201);
        }
        // POST /consignment/return {id, qty} — คืนสินค้ากลับ Vendor (แยกจาก Wastage ปกติ) → CONSIGN_RETURN
        if (req.method === 'POST' && seg[1] === 'return') {
          const b = await readBody(); const cs = await getCs(b.id); if (!cs) return err('not found', req, 404);
          const q = Math.abs(+b.qty || 0); await bumpStock(cs.id, -q); await logTx(cs, 'CONSIGN_RETURN', -q, b.reason || 'คืน/หมดอายุ ส่งคืน Vendor', b.docId);
          return json({ ok: true }, req, 201);
        }
        // POST /consignment/transfer {id, qty, toLocation} — ย้ายสต๊อก outbound คลังหลัก→สาขาปลายทาง → TRANSFER
        if (req.method === 'POST' && seg[1] === 'transfer') {
          const b = await readBody(); const cs = await getCs(b.id); if (!cs) return err('not found', req, 404);
          const q = Math.abs(+b.qty || 0);
          if (b.toLocation) await env.DB.prepare('UPDATE consignment_stock SET location_id=?, updated_at=? WHERE shop_id=? AND id=?').bind(b.toLocation, now(), shop, cs.id).run();
          await bumpStock(cs.id, q); await logTx(cs, 'TRANSFER', q, b.reason || ('ย้ายไป ' + (b.toLocation || '')), b.docId);
          return json({ ok: true }, req, 201);
        }
        // POST /consignment/stocktake {id, counted} — ตรวจนับจริง → Shrinkage (ผลต่างระบบ−นับจริง) แยกตาม location
        if (req.method === 'POST' && seg[1] === 'stocktake') {
          const b = await readBody(); const cs = await getCs(b.id); if (!cs) return err('not found', req, 404);
          const counted = +b.counted || 0; const shrink = counted - (cs.stock || 0);   // − = ของหาย
          await env.DB.prepare('UPDATE consignment_stock SET stock=?, updated_at=? WHERE shop_id=? AND id=?').bind(counted, now(), shop, cs.id).run();
          if (shrink !== 0) await logTx(cs, 'STOCK_TAKE', shrink, b.reason || ('ตรวจนับ · ' + (shrink < 0 ? 'ของหาย (Shrinkage)' : 'ของเกิน')), b.docId);
          return json({ ok: true, shrinkage: shrink }, req, 201);
        }
        // POST /consignment/delivery-note {locationId, lines:[{name,sku,qty,price,settleModel,sharePct,costWholesale,rentalFee,unit}], handledBy, handledByName, note}
        //   → เจนเลข CSD-YYYYMMXXXX · หักสต๊อกคลังหลักทันที (TRANSFER out) · สถานะ In_Transit (ยังไม่เข้าคลังปลายทางจนกดยืนยันรับ)
        if (req.method === 'POST' && seg[1] === 'delivery-note' && !seg[2]) {
          const b = await readBody();
          const lines = (b.lines || []).filter(l => l.name && (+l.qty) > 0).map(l => ({
            name: l.name, sku: l.sku || '', qty: +l.qty || 0, price: l.price | 0, unit: l.unit || 'pcs',
            settleModel: l.settleModel || 'per_sale', sharePct: l.sharePct ?? null, costWholesale: l.costWholesale ?? null, rentalFee: l.rentalFee ?? null,
          }));
          if (!lines.length) return err('no lines', req);
          const ref = await nextConsignRef(env, shop); const id = 'cdn' + now(); const ts = now();
          // หักคลังหลักทันที (movement TRANSFER ออกจาก location 'main')
          const stmts = lines.map(l => env.DB.prepare(`INSERT INTO inventory_transactions (id,shop_id,location_id,rm_id,movement_type,qty,ref_type,ref_id,reason,handled_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
            .bind('it' + ts + Math.random().toString(36).slice(2, 6), shop, 'main', l.sku || ('csd:' + l.name), 'TRANSFER', -(l.qty), 'consignment', ref, 'ส่งฝากขาย (In_Transit) ' + ref, b.handledBy || 'system', ts));
          if (stmts.length) await env.DB.batch(stmts);
          await env.DB.prepare(`INSERT INTO consignment_documents (id,shop_id,doc_ref,doc_type,direction,location_id,lines,gross_total,payout_total,status,note,handled_by,handled_by_name,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(id, shop, ref, 'delivery_note', 'outbound', b.locationId || null, JSON.stringify(lines),
              lines.reduce((a, l) => a + l.price * l.qty, 0), 0, 'in_transit', b.note || '', b.handledBy || null, b.handledByName || '', ts).run();
          return json({ ok: true, id, docRef: ref, status: 'in_transit' }, req, 201);
        }
        // POST /consignment/delivery-note/:id/confirm — ร้านปลายทางกดยืนยันรับของ → เข้าคลังฝากขายสาขาปลายทางจริง · สถานะ Received
        if (req.method === 'POST' && seg[1] === 'delivery-note' && seg[3] === 'confirm') {
          const doc = await env.DB.prepare('SELECT * FROM consignment_documents WHERE shop_id=? AND id=?').bind(shop, seg[2]).first();
          if (!doc) return err('document not found', req, 404);
          if (doc.status === 'received') return json({ ok: true, already: true }, req);
          const lines = (() => { try { return JSON.parse(doc.lines || '[]'); } catch (e) { return []; } })();
          const ts = now();
          for (const l of lines) {
            const csId = 'cs' + ts + Math.random().toString(36).slice(2, 6);
            // เข้าคลังฝากขาย outbound ของสาขาปลายทาง (materialize) — ตัดยอดขายรายชิ้นต่อจากนี้
            await env.DB.prepare(`INSERT INTO consignment_stock (shop_id,id,direction,name,sku,location_id,price,settle_model,share_pct,cost_wholesale,rental_fee,stock,unit,active,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`)
              .bind(shop, csId, 'outbound', l.name, l.sku || '', doc.location_id || null, l.price | 0, l.settleModel || 'per_sale',
                l.sharePct ?? null, l.costWholesale ?? null, l.rentalFee ?? null, +l.qty || 0, l.unit || 'pcs', ts, ts).run();
            await env.DB.prepare(`INSERT INTO inventory_transactions (id,shop_id,location_id,rm_id,movement_type,qty,ref_type,ref_id,reason,handled_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
              .bind('it' + ts + Math.random().toString(36).slice(2, 6), shop, doc.location_id || 'branch', csId, 'GOODS_RECEIPT', +l.qty || 0, 'consignment', doc.doc_ref, 'ยืนยันรับของฝากขาย ' + (doc.doc_ref || ''), 'system', ts).run();
          }
          await env.DB.prepare("UPDATE consignment_documents SET status='received', received_at=? WHERE shop_id=? AND id=?").bind(ts, shop, seg[2]).run();
          return json({ ok: true, status: 'received' }, req);
        }
        // POST /consignment/settle {vendorId|locationId, periodFrom, periodTo, slip, note} — เคลียร์เงินตาม settle_model
        if (req.method === 'POST' && seg[1] === 'settle') {
          const b = await readBody();
          let q = 'SELECT * FROM consignment_stock WHERE shop_id=?', bind = [shop];
          if (b.vendorId) { q += ' AND vendor_id=?'; bind.push(b.vendorId); }
          if (b.locationId) { q += ' AND location_id=?'; bind.push(b.locationId); }
          const { results: items } = await env.DB.prepare(q).bind(...bind).all();
          const fromTs = b.periodFrom ? new Date(b.periodFrom + 'T00:00:00').getTime() : 0;
          const toTs = b.periodTo ? new Date(b.periodTo + 'T23:59:59').getTime() : now();
          const lines = []; let grossTotal = 0, payoutTotal = 0, storeRevTotal = 0, rentalTotal = 0;
          for (const cs of items) {
            const soldRow = await env.DB.prepare("SELECT COALESCE(SUM(-qty),0) AS q FROM inventory_transactions WHERE shop_id=? AND rm_id=? AND movement_type='CONSIGN_SALE' AND created_at>=? AND created_at<=?").bind(shop, cs.id, fromTs, toTs).first();
            const qtySold = soldRow ? (soldRow.q || 0) : 0;
            const gross = qtySold * (cs.price || 0);
            let shopCut = 0, payout = 0, gp = 0;
            if (cs.settle_model === 'wholesale') { shopCut = gross; payout = 0; gp = (( cs.price || 0) - (cs.cost_wholesale || 0)) * qtySold; }
            else if (cs.settle_model === 'rental') { shopCut = cs.rental_fee || 0; payout = gross; rentalTotal += (cs.rental_fee || 0); }
            else { const pct = cs.share_pct || 0; shopCut = Math.round(gross * pct / 100); payout = gross - shopCut; }
            grossTotal += gross; payoutTotal += payout; storeRevTotal += (cs.settle_model === 'wholesale' ? gp : shopCut);
            if (qtySold > 0 || cs.settle_model === 'rental') lines.push({ stockId: cs.id, name: cs.name, model: cs.settle_model, qtySold, price: cs.price || 0, gross, shopCut, payout, gp });
          }
          const id = 'cd' + now();
          await env.DB.prepare(`INSERT INTO consignment_documents (id,shop_id,doc_type,direction,vendor_id,location_id,period_from,period_to,lines,gross_total,payout_total,status,slip,note,created_at,settled_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(id, shop, 'settlement', b.vendorId ? 'inbound' : 'outbound', b.vendorId || null, b.locationId || null, b.periodFrom || '', b.periodTo || '',
              JSON.stringify(lines), Math.round(grossTotal), Math.round(payoutTotal), b.slip ? 'settled' : 'open', b.slip || null, b.note || '', now(), b.slip ? now() : null).run();
          return json({ ok: true, id, grossTotal: Math.round(grossTotal), payoutTotal: Math.round(payoutTotal), storeRevenue: Math.round(storeRevTotal), rentalIncome: Math.round(rentalTotal), lines }, req, 201);
        }
        // GET /consignment/documents?vendor&location&status — ประวัติเอกสารเคลียร์เงิน
        if (req.method === 'GET' && seg[1] === 'documents') {
          let q = 'SELECT * FROM consignment_documents WHERE shop_id=?', bind = [shop];
          const vd = url.searchParams.get('vendor'), lc = url.searchParams.get('location'), st = url.searchParams.get('status');
          if (vd) { q += ' AND vendor_id=?'; bind.push(vd); }
          if (lc) { q += ' AND location_id=?'; bind.push(lc); }
          if (st) { q += ' AND status=?'; bind.push(st); }
          q += ' ORDER BY created_at DESC LIMIT 300';
          const { results } = await env.DB.prepare(q).bind(...bind).all();
          return json(results.map(rowConsignDoc), req);
        }
        // PATCH /consignment/documents/:id {slip,status} — แนบสลิปโอน/ปิดเอกสาร
        if (req.method === 'PATCH' && seg[1] === 'documents' && seg[2]) {
          const b = await readBody();
          await env.DB.prepare('UPDATE consignment_documents SET slip=?, status=?, settled_at=?, note=? WHERE shop_id=? AND id=?')
            .bind(b.slip || null, b.status || 'settled', now(), b.note || '', shop, seg[2]).run();
          return json({ ok: true }, req);
        }
      }

      /* ── SETTINGS (costMode/register/week/holidayNote) ── */
      if (seg[0] === 'settings') {
        await ensureShopTables(env);
        if (req.method === 'GET') {
          const r = await env.DB.prepare('SELECT data FROM settings WHERE shop_id=?').bind(shop).first();
          return json(r ? JSON.parse(r.data||'{}') : {}, req);
        }
        if (req.method === 'PUT' || req.method === 'PATCH') {
          const b = await readBody(); delete b.shopId; delete b.shop;
          const cur = await env.DB.prepare('SELECT data FROM settings WHERE shop_id=?').bind(shop).first();
          const merged = { ...(cur?JSON.parse(cur.data||'{}'):{}), ...b };
          await env.DB.prepare('INSERT INTO settings (shop_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(shop_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at')
            .bind(shop, JSON.stringify(merged), now()).run();
          // สิทธิ์เปิด-ปิดร้านของพนักงานเปลี่ยน (ตั้งจาก Backoffice) → push สดถึงลิงก์พนักงานทุกเครื่อง
          if (b.staffCanOpen !== undefined || b.verifyDuringDay !== undefined)
            ctx.waitUntil(hubBroadcast(env, shop, { type: 'perm',
              ...(b.staffCanOpen !== undefined ? { staffCanOpen: !!b.staffCanOpen } : {}),
              ...(b.verifyDuringDay !== undefined ? { verifyDuringDay: !!b.verifyDuringDay } : {}) }));
          return json({ ok:true }, req);
        }
      }

      /* ── PromptPay QR ── */
      if (path === '/pay/qr' && req.method === 'GET') {
        const s = await getShop(env, shop);
        const amt = url.searchParams.get('amount');
        if (!s || !s.promptpay_id) return err('promptpayId not set for shop', req);
        return json({ payload: promptpayPayload(s.promptpay_id, amt) }, req);
      }

      /* ── LINE webhook ── */
      if (path === '/line/webhook' && req.method === 'POST') {
        const raw = await req.text();
        if (env.LINE_CHANNEL_SECRET) {
          const sig = req.headers.get('x-line-signature') || '';
          const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.LINE_CHANNEL_SECRET),
            { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
          const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
          const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)));
          if (b64 !== sig) return err('bad signature', req, 401);
        }
        return json({ ok: true }, req);
      }

      return err('not found: ' + path, req, 404);
    } catch (e) {
      return err('server error: ' + (e.message || e), req, 500);
    }
  },
};

// กระจายข้อความสดไปทุกเครื่องของร้าน (ผ่าน Durable Object) — no-op ถ้ายังไม่ผูก SHOP_HUB
async function hubBroadcast(env, shop, msg) {
  try { if (!env.SHOP_HUB || !shop) return;
    const stub = env.SHOP_HUB.get(env.SHOP_HUB.idFromName(shop));
    await stub.fetch('https://hub/broadcast', { method: 'POST', body: JSON.stringify(msg) });
  } catch (e) {}
}

async function bumpTier(env, shop, id) {
  const r = await env.DB.prepare('SELECT points FROM members WHERE shop_id=? AND id=?').bind(shop, id).first();
  if (!r) return;
  const L = await loyaltyCfg(env, shop);
  const g = Number(L.tierGold) > 0 ? Number(L.tierGold) : 300;
  const s = Number(L.tierSilver) > 0 ? Number(L.tierSilver) : 120;
  const tier = r.points >= g ? 'gold' : r.points >= s ? 'silver' : 'member';
  await env.DB.prepare('UPDATE members SET tier=? WHERE shop_id=? AND id=?').bind(tier, shop, id).run();
}

// อ่านค่าตั้งสะสมแต้มของร้านจาก settings blob (pay.loyalty → sync จากแอป) — default คงพฤติกรรมเดิม (฿25/แต้ม · ได้ตอนจ่ายเงิน)
async function loyaltyCfg(env, shop) {
  try {
    const r = await env.DB.prepare('SELECT data FROM settings WHERE shop_id=?').bind(shop).first();
    const d = r ? JSON.parse(r.data || '{}') : {};
    return (d.pay && d.pay.loyalty) || d.loyalty || {};
  } catch (e) { return {}; }
}
