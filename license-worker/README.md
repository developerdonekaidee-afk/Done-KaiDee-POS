# KaiDee POS — ระบบกันแก้วันหมดอายุ (Cloudflare Worker) — คู่มือติดตั้ง

เป้าหมาย: ย้าย "วันหมดอายุ/สถานะร้าน" ไปเก็บที่ **เซิร์ฟเวอร์** เพื่อกันลูกค้าแก้ localStorage ใช้ฟรี
โดย **ไม่ต้องมี payment gateway** — เก็บเงินด้วยโอน+สลิป แล้วแอดมินกดอนุมัติเอง

## 1) Deploy Worker (ฟรี บน Cloudflare ที่คุณมีอยู่)
1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Worker**
2. วางโค้ดจาก `license-worker/worker.js` แล้ว **Deploy**
3. สร้าง **KV namespace**: Workers & Pages → KV → Create → ชื่อ `KAIDEE_LICENSE`
4. ผูก KV เข้า Worker: Worker → **Settings → Variables → KV Namespace Bindings**
   - Variable name: `LIC`  →  Namespace: `KAIDEE_LICENSE`
5. เพิ่ม **Environment Variable** (Settings → Variables):
   - `ADMIN_TOKEN` = สุ่มรหัสยาว ๆ (เก็บลับ ใช้ตอนอนุมัติสลิป)
6. คัดลอก URL ที่ได้ เช่น `https://kaidee-license.<subdomain>.workers.dev`

## 2) เปิดใช้ในแอป
- เปิด `kaidee-license.jsx` → ใส่ URL ที่ช่อง `LICENSE_ENDPOINT`
- โหลดไฟล์นี้ในหน้าแอป (เพิ่ม 1 บรรทัดใน `KaiDee POS.html` ก่อน `kaidee-app.jsx`):
  ```html
  <script type="text/babel" src="kaidee-license.jsx"></script>
  ```
- ตอนแอปเปิด/เข้าสู่ระบบ ให้เรียก:
  ```js
  const lic = await window.KD_LICENSE.check(shopId);
  // lic.active === false → เด้งหน้าต่ออายุ (soft-lock: ปิดการขาย)
  // lic.daysLeft → โชว์ "เหลือ N วัน" (มาจากเซิร์ฟเวอร์ แก้ในเครื่องไม่ได้)
  ```
- ถ้า `LICENSE_ENDPOINT` ว่าง → คืน `null` → แอปใช้ localStorage demo เหมือนเดิม (ไม่พัง)

## 3) Flow เก็บเงินจริง (โอน+สลิป)
1. ลูกค้าในแอป กด "ต่ออายุ" → แนบสลิป → `KD_LICENSE.submitPayReq(shopId,{slipUrl,plan,months,amount})`
2. แอดมินเปิด Back Office → เห็นคำขอรออนุมัติ (ดึงจาก `GET /admin/pending` พร้อม header `x-admin-token`)
3. แอดมินกด **อนุมัติ** → `POST /admin/approve {shopId,reqId}` → Worker เขียนวันหมดอายุใหม่ที่เซิร์ฟเวอร์
4. แอปลูกค้าเช็ครอบถัดไป → ได้วันหมดอายุใหม่อัตโนมัติ

## 4) กันเน็ตหลุด (grace) & หลายเครื่อง
- แอป cache ผลล่าสุด ใช้ต่อได้ **5 วัน** ถ้าเน็ตล่ม (แก้ค่าที่ `GRACE_DAYS`)
- 1 ร้านเปิดได้หลายเครื่อง (เจ้าของ/แคชเชียร์/ครัว) จำกัด `maxDevices` (ค่าเริ่ม 5) — รีเซ็ตได้ที่ `POST /admin/set {shopId,resetDevices:true}`

## Endpoints สรุป
| Method | Path | ใคร | ทำอะไร |
|---|---|---|---|
| GET | `/shop/:id/status?device=..` | แอป | เช็คสถานะ/วันหมดอายุ (ร้านใหม่ = trial 30 วันอัตโนมัติ) |
| POST | `/shop/:id/payreq` | แอป | ส่งสลิปขอต่ออายุ |
| GET | `/admin/pending` | แอดมิน | รวมคำขอรออนุมัติ |
| POST | `/admin/approve` | แอดมิน | อนุมัติ → ต่ออายุ |
| POST | `/admin/set` | แอดมิน | แก้มือ (วันหมดอายุ/แพ็กเกจ/สถานะ/รีเซ็ตเครื่อง) |

> ⚠️ ตัวตัดบัตรอัตโนมัติ (payment gateway) ยังไม่ต้องทำ — ใช้โอน+สลิป+อนุมัติมือ พอสำหรับช่วงเริ่มขาย
