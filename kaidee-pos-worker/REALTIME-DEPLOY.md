# KaiDee POS — Realtime (WebSocket) + งานใหม่ 22 ก.ค. 2026 · คู่มือ deploy

## สรุปสิ่งที่ต้องทำตอน deploy (3 ปลายทาง)
1. **client → pages.dev**: อัป `kaidee-deploy/` ทั้งชุด (kaidee-app.jsx · kaidee-api.jsx · kaidee-merchant.jsx · kaidee-merchant2.jsx · backoffice-app.jsx) + hard refresh
2. **worker → Cloudflare Workers**: redeploy `kaidee-pos-worker/worker.js`
3. **⚠️ ผูก Durable Object (จำเป็นสำหรับ real-time เท่านั้น)** — ดูด้านล่าง

> ถ้ายังไม่ผูก Durable Object: ระบบ **ไม่พัง** — endpoint `/ws` คืน 501 และแอปจะ **fallback ไป poll ทุก 4 วิ (near real-time)** อัตโนมัติ · ผูก DO เมื่อไรก็ได้ real-time ทันที

---

## ผูก Durable Object `ShopHub` (WebSocket fan-out)
worker.js `export class ShopHub` แล้ว — เหลือแค่ประกาศ binding + migration

### ทาง wrangler.toml
```toml
[[durable_objects.bindings]]
name = "SHOP_HUB"
class_name = "ShopHub"

# ใช้ new_sqlite_classes เพื่อรองรับ Free plan (ShopHub ไม่ใช้ storage แต่ต้องมี migration)
[[migrations]]
tag = "v1"
new_sqlite_classes = ["ShopHub"]
```
แล้ว `wrangler deploy`

### ทาง Dashboard (ถ้า deploy ผ่านเว็บ)
Workers & Pages → เลือก worker → **Settings → Bindings → Add → Durable Object**
- Variable name: `SHOP_HUB`
- Durable Object class: `ShopHub`
- บันทึก → ระบบจะสร้าง migration ให้ (เลือก SQLite-backed)

### ตรวจว่าติดหรือยัง
`GET /health` → `{ ok:true, realtime:true }` (ถ้า `realtime:false` = ยังไม่ผูก DO)

---

## กลไก real-time (สรุปสั้น)
- 1 ร้าน = 1 instance `ShopHub` (`idFromName(shopId)`) ถือ WebSocket ของทุกเครื่องในร้าน
- client เชื่อมที่ `wss://<worker>/ws?shop=<id>` (`KD_API.connectRealtime`) · auto-reconnect + ping 25 วิ
- worker `hubBroadcast()` ยิงข่าวเมื่อ:
  - **เปิด-ปิดร้าน / เวลาเปลี่ยน** (`PATCH /shops/:id` มี isOpen/open/close) → `{type:'shop',...}` → ทุกเครื่อง + ลูกค้าอัปเดตทันที
  - **สิทธิ์เปลี่ยนจาก Backoffice** (`PUT /settings` มี staffCanOpen/verifyDuringDay) → `{type:'perm',...}` → ปุ่มเปิด-ปิดร้านโผล่/หายทันทีที่ลิงก์พนักงาน
  - **ออเดอร์ใหม่/เปลี่ยนสถานะ** (`POST/PATCH /orders`) → `{type:'order'}` → หน้าออเดอร์/ครัว refresh

## ตารางใหม่ (idempotent · สร้างเองตอนถูกเรียกครั้งแรก)
- `delivery_settlement_logs` — กระทบยอดเดลิเวอรี (Expected vs Actual ต่อช่องทาง/วัน · settlement date ย้อนหลังได้)
  - POST `/delivery-settlement` (upsert ต่อ channel+วัน · คำนวณ variance ฝั่ง server)
  - GET `/delivery-settlement?channel&from&to` · GET `/delivery-settlement/summary?from&to`
  - สูตร Expected Net = gross − gross×gp% − (VAT 7% ของค่า GP ถ้าเปิด)
