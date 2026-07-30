# Platform Backend — Cloudflare Worker + D1 · คู่มือ deploy

Backend เดียวรองรับทุก vertical: **ตลาด · ฟิตเนส · สปอนเซอร์ · Labor Win · แพลตฟอร์ม**
ทำงานแบบ *document-sync*: ทุกแอปเก็บ state เป็น JSON blob ก้อนเดียวอยู่แล้ว → backend เก็บก้อนนั้นราย tenant แล้ว sync ข้ามเครื่อง + push สดผ่าน WebSocket โดยไม่ต้องรื้อ data model เดิม

ไฟล์: `platform-worker/worker.js` · `platform-worker/schema.sql` · `platform-worker/wrangler.toml` · client `platform-api.jsx`

---

## 1) Deploy worker (ครั้งแรก)

ต้องมี Node + wrangler (`npm i -g wrangler`) แล้ว `wrangler login` ก่อน

```bash
cd platform-worker

# (1) สร้างฐานข้อมูล D1 — คัดลอก database_id ที่ได้ ไปวางใน wrangler.toml (บรรทัด database_id)
npx wrangler d1 create platform

# (2) สร้างตาราง (ไม่จำเป็น — worker สร้างเองตอนเรียกครั้งแรก แต่รันไว้ก็ได้)
npx wrangler d1 execute platform --remote --file=schema.sql

# (3) ตั้งรหัสแอดมิน + กุญแจเซ็น token (แนะนำ)
npx wrangler secret put ADMIN_SECRET   # พิมพ์สตริงสุ่มยาว ๆ
npx wrangler secret put ADMIN_PASS     # รหัสเข้า Back Office (ไม่ตั้ง = platform2026)

# (4) deploy
npx wrangler deploy
```

ได้ URL มา เช่น `https://platform.<subdomain>.workers.dev`
ตรวจ: เปิด `https://.../health` → ต้องได้ `{ ok:true, realtime:true }`
(ถ้า `realtime:false` = ยังไม่ผูก Durable Object — ระบบไม่พัง, client จะ fallback ไป poll ทุก 4 วิ)

---

## 2) Realtime (WebSocket) — ผูก Durable Object

`wrangler.toml` ประกาศ `BizHub` ให้แล้ว → แค่ `wrangler deploy` ก็ผูกอัตโนมัติ
ถ้า deploy ผ่าน **Dashboard**: Workers → worker → Settings → Bindings → Add → Durable Object
- Variable name: `BIZ_HUB`  ·  Class: `BizHub`  ·  เลือก **SQLite-backed** (รองรับ Free plan)

> ไม่ผูกก็ทำงานได้: `/ws` คืน 501 → client (`connectRealtime`) fallback poll เอง

---

## 3) ต่อ client เข้ากับ backend

โหลด `platform-api.jsx` ในหน้า (หลัง React) แล้วตั้ง URL worker ครั้งเดียว:

```html
<script src="platform-api.jsx"></script>
<script>PLAT_API.setEndpoint('https://platform.<subdomain>.workers.dev');</script>
```
(หรือแก้ค่า `PLAT_API_DEFAULT` บนหัวไฟล์ `platform-api.jsx` ให้เป็น URL จริง แล้วไม่ต้อง setEndpoint)

### ท่าที่ง่ายสุด — `PLAT_API.attach` (sync ทั้งก้อน)
ในโมดูลข้อมูลเดิม (`fitness-data.jsx`, `market-data.jsx`, ฯลฯ) มี `load()/save()` อยู่แล้ว เพิ่ม:

```js
// ตัวอย่าง: ฟิตเนส (window.FIT · localStorage kd_fitness_v1)
const gymId = new URLSearchParams(location.search).get('shop') || 'demo-gym';
const sync = PLAT_API.attach({
  biz:  gymId,
  type: 'fitness',
  key:  'fitness',
  name: FIT.load().gym.name,
  read:  () => FIT.load(),                 // อ่าน blob ปัจจุบัน
  write: (blob) => FIT.save(blob),         // เขียน blob ที่ได้จากเครื่องอื่น (ไม่ push กลับ)
  onRemote: (blob) => window.__rerender && window.__rerender(),  // สั่ง UI วาดใหม่
  stamp: (b) => b.updatedAt || 0,          // (ถ้ามี timestamp ใน blob) ใช้เทียบ local vs remote
});
// ทุกครั้งหลัง save local ให้เรียก:  sync.push()
```
mapping ที่แนะนำ:

| แอป | biz (tenant) | type | doc key |
|---|---|---|---|
| ฟิตเนส | shopId ของยิม | `fitness` | `fitness` |
| ตลาด | marketId | `market` | `market` |
| Labor Win | รหัสตลาด/ผู้ให้บริการ | `laborwin` | `laborwin` |
| สปอนเซอร์ | sponsorId | `sponsor` | `sponsor_entitlement`, `sponsor_coupons` |
| แพลตฟอร์ม (เรา) | `platform` | `platform` | `wallet`, `stats`, `control` |

> ต้องการเก็บ timestamp ให้เทียบแม่นขึ้น: เพิ่ม `d.updatedAt = Date.now()` ทุกครั้งใน `save()` ของ data module แล้วใส่ `stamp: b => b.updatedAt`. ไม่มีก็ได้ — ตอน load จะยึด remote เป็นหลัก

---

## 4) API สรุป (ทดสอบด้วย `Backend Console.html`)

| method | path | ใช้ทำอะไร |
|---|---|---|
| GET | `/health` | เช็คสถานะ + realtime |
| POST | `/biz` | ลงทะเบียน/อัปเดต tenant `{bizId,type,name,ownerLine}` |
| GET | `/biz/:id` · PATCH `/biz/:id` | ดู/แก้ tenant |
| GET | `/biz?type=&token=` | (แอดมิน) รายชื่อ tenant |
| GET | `/doc/:key?biz=` | ดึง JSON blob (rev+updatedAt) |
| PUT | `/doc/:key` `{data,baseRev?}` | เขียนทั้งก้อน (baseRev เพี้ยน → 409 conflict) |
| PATCH | `/doc/:key` `{patch}` | merge top-level |
| GET | `/docs?biz=` | ดึงทุก doc ของ tenant ทีเดียว |
| GET/POST/PATCH/DELETE | `/coll/:name[/:id]` | เก็บ record แบบ list (ledger, jobs, bookings) |
| GET | `/pay/qr?id=&amount=` | payload PromptPay QR |
| WS | `/ws?biz=` | realtime push |
| POST | `/admin/login` `{pass}` | รับ token แอดมิน (12 ชม.) |

- ทุก endpoint ข้อมูลระบุ tenant ผ่าน `?biz=` / header `X-Biz` / `body.biz`
- Conflict: ส่ง `baseRev` = rev ที่ถืออยู่ → ถ้ามีคนเขียนแซง server คืน 409 พร้อม `{rev,data}` ล่าสุด (ไม่ส่ง baseRev = last-write-wins)
- soft delete บน `records` (`deleted=1`) → การลบ sync ข้ามเครื่องได้

---

## 5) ทุกครั้งที่แก้ backend
`cd platform-worker && npx wrangler deploy` — ตารางเป็น idempotent (worker สร้าง/มีอยู่แล้วข้าม) ไม่ต้องรัน SQL ซ้ำ
```
