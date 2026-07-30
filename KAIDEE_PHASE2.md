# KaiDee POS — PHASE 2 TODO (เปิดแชทใหม่ทำต่อ)

พิมพ์เปิดแชทใหม่: `ทำ KaiDee POS เฟส 2 ต่อ — ดู KAIDEE_PHASE2.md`

## ✅ เสร็จรอบ 9 (18 ก.ค. 2026 — ข้อ A: admin แก้เมนู/สต๊อกรายร้าน + ลบร้าน + Overview ข้อมูลจริง)
- **admin แก้เมนู/สต๊อกรายร้าน (Back Office)** — `KaiDee Back Office.html`: ใน ShopDrawer เพิ่มการ์ด "เมนู & สต๊อก (แก้แทนร้าน)" → ปุ่ม "จัดการเมนู"/"จัดการสต๊อก" เปิด `ShopManage` (modal กลางจอ · แท็บ เมนู/สต๊อก)
  - `MenuManager` — fetch `GET /menu?shop=<id>` → ตารางแก้ หมวด/ชื่อ/ราคา/ต้นทุน · toggle ขายดี(🔥)/ปิดขาย(off) · เพิ่ม/ลบเมนู · "บันทึกทั้งหมด" = `POST /menu?shop=<id>` ต่อแถว dirty · ลบ = `DELETE /menu/:id?shop=<id>` (soft, active=0)
  - `StockManager` — fetch `GET /raw?shop=<id>` → ตารางแก้ วัตถุดิบ/หน่วย/คงเหลือ/ต้นทุนเฉลี่ย/จุดเตือน · เพิ่ม/ลบ · "บันทึกสต๊อก" = `PUT /raw?shop=<id>` (แทนทั้งชุด) · แถวแดง = ต่ำกว่าจุดเตือน
- **ลบร้านถาวร** — ShopDrawer danger zone เพิ่มการ์ด "ลบร้านถาวร" (double-confirm) → `delShop` ยิง `DELETE /shops/:id` (X-Admin-Token) + ลบออกจาก state · **worker เพิ่ม route `DELETE /shops/:id`** (guard ADMIN_SECRET · cascade ลบ orders/members/menu/raw/purchases/cash_days/quotes/settings/devices/counters/pay_requests แล้วลบ shops)
- **Overview ข้อมูลจริง** — เลิก hardcode: กราฟ "ร้านสมัครใหม่รายสัปดาห์" คำนวณจาก `weeklySignups(shops)` (bucket วัน `joined` เป็น 7 สัปดาห์ล่าสุด) · KPI delta จริง (ร้านใหม่เดือนนี้ / paid ใหม่เดือนนี้ / trial ใกล้หมด / MRR = N ร้านชำระ) แทนเลขปลอม (+11/+3/+฿597)
- ⚠️ **worker ต้อง deploy เอง** (route DELETE ใหม่) — `cd cloud/kaidee && npx wrangler deploy` · เว็บ: sync `netlify-upload/admin.html` แล้ว (อัป Cloudflare Pages)
- ⚠️ Shops table orders/gmv ยังเป็น 0 ใน live (mapApiShop ไม่ aggregate ต่อร้าน) — ถ้าต้องการยอดจริงต่อร้านต้องเพิ่ม aggregate endpoint หรือ fetch orders ต่อร้าน (ยังไม่ทำ)

## ✅ เสร็จรอบ 9.1 (18 ก.ค. 2026 — orders/gmv จริงต่อร้าน)
- **worker เพิ่ม `GET /shops/stats`** — GROUP BY shop_id คืน {orders, gmv (SUM total เว้น status=cancel), last (MAX updated_at)} ต่อร้าน 1 query
- **Back Office** — หลัง fetch `/shops` ยิง `/shops/stats` ต่อ แล้ว merge orders/gmv/last (relTime) เข้าแต่ละร้าน → ตารางร้าน + drawer โชว์ยอดจริง (เดิม 0) · helper `relTime(ts)` (ชั่วโมงนี้/วันนี้/เมื่อวาน/N วันก่อน)
- ⚠️ ต้อง deploy worker ใหม่ (route stats) พร้อม route DELETE รอบ 9

## ✅ เสร็จรอบ 8 (18 ก.ค. 2026 — ประเภทร้าน + feature flags)
- **ShopTypeSheet (kaidee-merchant2.jsx)** — ตั้งค่าร้าน → "🏪 ประเภทร้าน · ฟีเจอร์": 5 preset (ร้านอาหาร/คาเฟ่/ของชำ/ออนไลน์/บริการ) ตั้ง `shop.shopType`+`shop.typeLabel`+ค่าเริ่มต้น `features.delivery` · toggle "รับออเดอร์เดลิเวอรี" (เก็บ `shop.features.delivery`)
- **gate จริง**: customer Checkout (kaidee-customer2.jsx) รับ `shop` → ถ้า `features.delivery===false` ซ่อนปุ่มเดลิเวอรี + default = รับที่ร้าน · ฟีเจอร์อื่น (สมาชิก/สต๊อก/ตัวเลือก) เปิดทุกร้านตามเดิม (ไม่ hard-gate กันของหาย)
- **⏳ เหลือ (รอบหน้า)**: admin จัดการเมนู/ตัวเลือก/สต๊อกรายร้านใน Back Office (พาเนล + endpoint เขียนรายร้าน) — ข้อ A ที่ user ถาม
- sync `netlify-upload/`: kaidee-merchant2.jsx · kaidee-customer2.jsx · (cache ยัง v4/?v=b — เปลี่ยนไฟล์หลัง bump แต่ SW network-first ดึงใหม่ได้)

## ✅ เสร็จรอบ 7 (18 ก.ค. 2026 — POS หน้าร้านเลือก options ได้)
- **SellScreen (kaidee-merchant.jsx)** — ticket refactor `{itemId:qty}` → keyed lines `{lineKey:{id,qty,opts,add}}` · แตะเมนูที่มี options → เด้ง `PosOptionSheet` (เลือก single/multi + ราคาเพิ่ม) → ใส่ตะกร้าพร้อม add-price · เมนูไม่มี options แตะเข้าตะกร้าเลย (เหมือนเดิม) · ตะกร้าโชว์ตัวเลือกใต้ชื่อ+ราคารวม · finish/addSale ส่ง `items=[[id,qty,optLabel,add]]` · total/cost คิด add
- ครัว/บิลเห็นตัวเลือกใต้ชื่อเมนู (OrderCard อัปเดตแล้วรอบก่อน)
- ⚠️ รายงานยอดขาย (saleTotal/effSaleCost) คิดจาก base price ยังไม่รวม add-price ของ POS sale (revenue กับ COGS ใช้ราคาเมนูฐาน) — minor gap เหมือน topping ไม่เข้า COGS · ถ้าต้องเป๊ะค่อยเก็บ total ต่อ sale
- **⏳ เหลือ**: (A) admin จัดการเมนู/ตัวเลือก/สต๊อกรายร้านใน Back Office (พาเนล+endpoint เขียนรายร้าน) · (C) ประเภทร้าน + feature flags
- sync `netlify-upload/kaidee-merchant.jsx`

## ✅ เสร็จรอบ 6 (18 ก.ค. 2026 — ordering-side modifiers ครบ + cache-bust สำหรับ deploy)
- **ลูกค้าเลือกตัวเลือกตอนสั่ง (kaidee-customer.jsx ItemDetail)** — เมนูมี options → โชว์กลุ่มตัวเลือก (single/multi) เลือกได้ + ราคาบวกเพิ่ม (+฿) โชว์ยอดสด
- **cart refactor (kaidee-customer2.jsx)** — cart จาก `{id:qty}` → keyed lines `{lineKey:{id,qty,opts,add}}` (lineKey=id+ตัวเลือก) · addItem(id,q,opts,add)/setQty(key,q)/cartCount ตาม qty · CustCart โชว์ตัวเลือกใต้ชื่อ+ราคารวม add · Checkout subtotal/cost/total คิด add · `order.items=[[id,qty,optLabel,add]]` (backward-compatible — เดิม map [id,q] ยังใช้ได้)
- **ครัวเห็นตัวเลือก (kaidee-merchant2.jsx OrderCard)** — item row โชว์ optLabel ใต้/ข้างชื่อเมนู
- คู่มืออัปเดต (ตัวเลือกใช้ได้จริงตอนสั่งแล้ว)
- **cache-bust deploy**: bump `?v=p2-20260718b` (index.html + KaiDee POS.html ×16) + sw CACHE `hagd-pos-v4`
- ⚠️ **POS SellScreen (หน้าร้านกดขาย) ยังไม่รองรับ options** (ticket cart คนละตัว keyed by id) — พนักงานกดขายหน้าร้านยังไม่เลือกตัวเลือก (ลูกค้า LINE ได้ครบ) · consumeStock ไม่ตัดสต๊อก topping (ตัวเลือกไม่ผูก recipe)
- **⏳ เหลือ**: (1) POS SellScreen options (2) ประเภทร้าน + feature flags (ยังไม่เริ่ม)
- sync `netlify-upload/`: customer/customer2/merchant2/help.jsx + index/sw

## ✅ เสร็จรอบ 5 (18 ก.ค. 2026 — ตัวเลือกสินค้า (modifiers) ฝั่งตั้งค่า)
- **ModifiersEditor (kaidee-merchant2.jsx)** — ItemEditor เพิ่มหัวข้อ "🧩 ตัวเลือกสินค้า": preset (ความเผ็ด/หวาน/ร้อน-เย็น/ขนาด/ท็อปปิ้ง) + "กลุ่มเอง" · แต่ละกลุ่ม single/multi · แต่ละตัวเลือกมี label + ราคาเพิ่ม (+฿) · เก็บใน `item.options=[{id,name,multi,choices:[{label,price}]}]`
- เมนูลิสต์โชว์ป้าย "🧩 N ตัวเลือก" · MOD_PRESETS ปรับตามภาษา
- คู่มือเพิ่มหัวข้อ "ตัวเลือกสินค้า"
- **⏳ ค้าง (ordering-side)**: cart ปัจจุบันเป็น map `{id:qty}` — ต้อง refactor เป็น line-array (ต่อ variant + price delta) เพื่อให้ลูกค้าเลือกตัวเลือกตอนสั่ง + คิดราคาเพิ่มจริง (customer2 Checkout/SellScreen/order.items/สลิป/ตัดสต๊อก) — ยกไปทำเป็นก้อนถัดไป · authoring พร้อมแล้ว
- sync `netlify-upload/`: kaidee-merchant2.jsx · kaidee-help.jsx

## ✅ เสร็จรอบ 4 (18 ก.ค. 2026 — ชุดออเดอร์ฝั่งร้าน + ตอบเวลานัดรับ)
- **จัดคิว/แก้ออเดอร์ (kaidee-merchant2.jsx OrderCard)** — ปุ่มดินสอเปิด inline editor: ชื่อลูกค้า · เลขคิว (แก้เอง) · โน้ตถึงครัว · เวลานัดรับ · โน้ตครัวโชว์เป็นแถบเหลือง (สื่อสารคนรับ↔คนทำ)
- **priority + เลื่อนคิว** — 📌 pin (`o.pin`) ดันขึ้นบนสุด (sort pinned first) · ปุ่ม ▲▼ (`moveOrder` สลับใน orders array) · เพิ่มไอคอน chevUp/chevDown ใน IC (kaidee-data.jsx)
- **ตอบเวลานัดรับ (Phase 3)** — ออเดอร์มีเวลานัด (isPre) โชว์แถบ "ลูกค้าขอเวลา …" + ปุ่ม "รับได้ตามเวลา" (`promise.status='ok'`) / "ขอเลื่อนเวลา" (prompt→`promise.status='new'`) · ลูกค้าเห็นใน TrackSheet (kaidee-customer2.jsx แถบ ✅/⏰) + worker push LINE เมื่อ `b.promise` (kaidee-worker.js PATCH /orders) · ⚠️ live: promise ยังไม่ persist ใน D1 (ไม่มีคอลัมน์ · push ทำงาน · ค่อยเพิ่ม migration ถ้าต้องเก็บ)
- ฝั่งลูกค้าเลือกรับที่ร้าน+เวลา (Checkout `ful`/SLOTS) มีอยู่แล้ว — เพิ่มแค่การตอบกลับ
- คู่มือ (kaidee-help.jsx) เพิ่ม 2 หัวข้อ: จัดคิว/ชื่อ/โน้ต/ทำก่อน · ตอบเวลานัดรับ
- sync `netlify-upload/`: kaidee-data/merchant2/customer2/help.jsx · worker แก้แล้ว (deploy พร้อมรอบ backend)
- **⏳ ถัดไป**: modifiers ต่อเมนู (เผ็ด/หวาน/ไซซ์/ท็อปปิ้ง) · ประเภทร้าน + feature flags

## ✅ เสร็จรอบ 3 (18 ก.ค. 2026 — Hybrid costing + Waste log + คู่มือ)
- **Hybrid costing (ต้นทุนรายเมนู)** — `effItemCost` (kaidee-data.jsx) เลิกผูกโหมดร้าน: เมนูมี `recipe` → คิดจากสูตร (qty×avgCost) + ตัดสต๊อก · ไม่มี → BOM/ต้นทุนต่อจาน · เคารพ `item.costMethod` ('flat'|'recipe') · `consumeStock` (kaidee-app.jsx) ตัดสต๊อกทุกเมนูที่มีสูตร (เว้น costMethod==='flat') ไม่ผูก costMode
- **ItemEditor (kaidee-merchant2.jsx)** — เพิ่มปุ่มเลือกวิธีคิดต้นทุนต่อเมนู: "💵 ต้นทุน/จาน" หรือ "🧾 คิดจากสูตร" (setMethod→f.costMethod) · แสดง RecipeEditor หรือ BOM ตามที่เลือก · เมนูลิสต์โชว์ป้าย "🧾 คิดจากสูตร · ตัดสต๊อก" เฉพาะเมนูมีสูตร
- **Stock tab เปิดตลอด** — `stockOn=true` (เดิมโชว์เฉพาะ costMode==='stock') · settings row เปลี่ยนเป็น "สต๊อก / วิธีคิดต้นทุน · Hybrid"
- **Waste log (ตัดของเสีย)** — store slice `wastes` + `addWaste`(หักสต๊อก+คิดมูลค่า avgCost×qty)/`deleteWaste` (kaidee-app.jsx) · StockScreen (kaidee-stock.jsx): ปุ่ม "🗑️ ของเสีย" + แท็บย่อย Waste (ยอดรวม+รายการ+ลบ) + `WasteSheet` (เลือกวัตถุดิบ/จำนวน/หน่วย/เหตุผล เน่า-หก-เผา-คืน) · FinanceScreen (kaidee-cash.jsx): หมวด `waste` + wasteRows เข้ารายจ่ายอัตโนมัติ
- **คู่มือ (kaidee-help.jsx)** — เขียนใหม่ 4 หัวข้อ: วิธีคิดต้นทุน (hybrid), เมนู·สูตร·กำไร, สต๊อก & ลงสต๊อก (เพิ่มวัตถุดิบ/ซื้อเข้า/หน่วย/avgCost ละเอียด), ตัดของเสีย
- sync `netlify-upload/` ครบ: kaidee-data/app/merchant2/stock/cash/help.jsx
- **⏳ ถัดไป (ตามที่คุย)**: ชุดออเดอร์ฝั่งร้าน (สลับคิว/ชื่อลูกค้า/โน้ต/priority) → ลูกค้าเลือกรับที่ร้าน+เวลา → ร้านยืนยัน/เสนอเวลาใหม่+แจ้ง LINE · แล้วค่อย modifiers (เผ็ด/หวาน/ไซซ์/ท็อปปิ้ง) · ประเภทร้าน+feature flags

## ✅ เสร็จรอบ 2 (18 ก.ค. 2026 — งาน backend ที่ไม่ต้องรอ creds)
- **#6 admin auth จริง (server-side · แชร์ทุกเครื่อง)** — worker เพิ่ม `/admin/login` (sha256 เทียบรหัสใน app_config key `admin` · default `kaidee2026`) → คืน token (HMAC+exp 12ชม. ใช้ `env.ADMIN_SECRET`) · `/admin/verify` · `/admin/password` (เปลี่ยนรหัสเก็บใน D1) · Back Office Login ยิง `/admin/login` ก่อน (เก็บ token ใน sessionStorage) → **fallback รหัสในเครื่อง** ถ้า backend ล่ม/ยังไม่ deploy · ChangePass ยิง `/admin/password` (แชร์ทุกเครื่อง) fallback local
- **#7 ย้ายรูปไป R2** — worker เพิ่ม `POST /upload` (data URL→R2 · max 3MB · คืน `/img/<key>`) + `GET /img/<key>` (cache 1ปี) · pay-requests POST: ถ้าสลิปเป็น data URL + มี R2 → อัปโหลดเก็บเป็นลิงก์แทน base64 (DB ไม่บวม) · ต้อง bind R2 bucket ชื่อ `SLIPS` ตอน deploy
- **#8 นโยบายคืนเงิน** — `netlify-upload/terms.html` แทนที่ placeholder ด้วยหัวข้อ "4. นโยบายการคืนเงิน (Refund Policy)" เต็ม (ชำระล่วงหน้า/ไม่คืนส่วนที่ใช้แล้ว · ระบบล่มจากฝั่งเราคืน 7–14 วัน หรือ credit วัน · ช่องทางติดต่อ) + เลื่อนเลขหัวข้อ 5–9 · ⚠️ ยังต้องให้ทนายตรวจ
- **#5 payment gateway (scaffold)** — worker เพิ่ม `/pay/status` `/pay/charge` `/pay/webhook` · **inert จนกว่าตั้ง secret `PAY_PROVIDER` + `PAY_SECRET_KEY`** (คืน 501 + fallback:'promptpay') · รอเลือกผู้ให้บริการ + จดบริษัท + เสียบ key แล้วเติม handler
- **secret ที่ต้องตั้งตอน deploy worker (ถ้าจะเปิดใช้)**: `ADMIN_SECRET` (token signing · #6) · `ADMIN_LINE` (#9 push) · `PAY_PROVIDER`+`PAY_SECRET_KEY` (#5) · bind R2 `SLIPS` (#7) · ทุกตัว optional — ไม่ตั้งก็ยังทำงานโหมดปัจจุบัน (fallback/manual)

## ✅ เสร็จรอบนี้ (18 ก.ค. 2026)
- **#1 หน้า "จัดการร้าน" (Home) = แท็บแรกของ merchant** — `kaidee-home.jsx` (`HomeScreen`): header brand gradient + 3 metric · เช็คลิสต์ 3 ข้อ (เมนู/ทดสอบ auto · Rich menu toggle) · การ์ดลิงก์ (ลูกค้า/หลังบ้าน/ไรเดอร์) · ปุ่มลัด 4 · แถบแพ็กเกจ→SubscriptionSheet
- **#2 ทีมส่ง/ไรเดอร์ของร้าน** — store slice `riders` (kaidee-app.jsx) + `RiderTeamSheet` (kaidee-merchant2.jsx): ตั้งค่าร้าน → "ทีมส่ง · ไรเดอร์" → ลิงก์ไรเดอร์ (คัดลอก) + เพิ่ม/แก้/ปิด-เปิด/ลบ ไรเดอร์ (ชื่อ/เบอร์/ทะเบียน/active)
- **#3 เทมเพลต Rich menu สำเร็จรูป** — `KaiDee Rich Menu Template.html` (deploy: `richmenu-template.html`): กรอกชื่อ/รหัสร้าน → รูป 2500×1686 (6 ปุ่ม) ดาวน์โหลด PNG (html-to-image ×2) + ตาราง mapping (URI+พิกัด) + ขั้นตอนตั้งใน LINE OA + areas JSON · ลิงก์จาก Home (prefill query)
- **#4 admin จัดการรายร้าน** — ShopDrawer (Back Office) เพิ่มการ์ด "ข้อมูลร้าน (แก้แทนร้าน)": แก้ชื่อ/ไอคอน/ประเภท/เบอร์ → PATCH `/shops/:id` (patchShop ยิง 2 endpoint: /plan + profile) · ปุ่ม "เปิดหลังบ้านร้าน" เดิมยังใช้แก้เมนูรายร้านได้
- **#9 ต่อ/เลือกแพ็ก + แจ้งเตือน 3 ทาง** — (ก) Home/SubscriptionSheet เลือกแพ็ก + จ่ายพร้อมเพย์→`kdSubmitPayRequest` (ข) `ExpiryReminder` เตือนร้านก่อนหมด ≤3 วัน (ค) **admin เห็นเร็ว**: badge จำนวนคำขอค้างบน nav + แถบ 🔔 บน topbar (Back Office) + **worker push LINE ถึง `env.ADMIN_LINE`** เมื่อมีคำขอใหม่ (POST /pay-requests · ตั้ง secret ถึงจะทำงาน)
- **เสียงออเดอร์เข้า + toggle** — `kdPlayChime`/`useOrderChime` (kaidee-home.jsx) + ปุ่ม 🔔 ในหน้าออเดอร์ (kd_order_sound)
- ⚠️ **ยังไม่ deploy** — sync `netlify-upload/` ครบ: ใหม่ `kaidee-home.jsx`·`richmenu-template.html` · อัปเดต `kaidee-app.jsx`·`kaidee-merchant2.jsx`·`index.html`·`admin.html` · worker แก้ `cloud/kaidee/kaidee-worker.js` (fetch(req,env,ctx) + ADMIN_LINE push)

## ⏳ เหลือ (ต้องตัดสินใจ/creds ก่อน — deploy-gated)
- **#5 payment gateway (ตัดเงินอัตโนมัติ)** — ยังเป็น manual (แจ้งสลิป→ยืนยัน) · ต้องเลือกผู้ให้บริการ (Omise / GB Prime Pay / 2C2P) + merchant creds + จดบริษัท → ค่อยต่อ recurring charge เข้า `/pay-requests` flow
- **#6 admin auth จริง** — ตอนนี้รหัสฝั่ง client (`kaidee2026`) · แนะนำ: worker `/admin/login` เช็ค pass ใน app_config → คืน token (เก็บ httpOnly/session) แทน hardcode · หรือ Cloudflare Access/SSO
- **#7 ย้ายรูปไป R2** — worker มี binding `SLIPS` (R2) แล้ว · client ส่ง base64 · ต้องเพิ่ม route อัปโหลด→R2 + คืน URL แล้วเปลี่ยน client เก็บ URL แทน base64 (เมื่อรูปเยอะ)
- **#8 เติมนโยบายคืนเงิน** ใน `netlify-upload/terms.html` (`[ ]`) — ให้ทนายตรวจก่อนเปิดขายจริง
- **LINE Notify admin**: ตั้ง secret `ADMIN_LINE` = userId แอดมิน (จับคู่ OA) ตอน deploy worker

## สถานะปัจจุบัน (เฟส 1 เสร็จ + ใช้งานจริงแล้ว)
- เว็บ: Cloudflare Pages `kaidee-app` (`kaidee-app.pages.dev`) · Back Office = `/admin` · มี `_headers` กัน cache
- Backend: Worker `kaidee-pos` (`kaidee-pos.oneday-pos.workers.dev`) + D1 `kaidee` · migration `cloud/kaidee/migrate-billing.sql` รันแล้ว (seats/devices/app_config/pay_requests/owner/expiry)
- LIFF ID จริง: `2010720123-HXe3iZJD` · OA @188dfiog
- ผู้ให้บริการ: วันวิสาข์ จันโทวงษ์ · 0992146299 (บุคคลธรรมดา ยังไม่จดบริษัท)
- เฟส 1 ที่ทำแล้ว: CRM สมัครร้าน · owner-gate (LINE) · device-limit (฿199=1 / ฿299=3 เครื่อง) · แพ็กเกจแก้ได้ใน Back Office (ราคา/เครื่อง/วันทดลอง → เด้ง CRM+upgrade+trial) · แบรนด์แก้ได้ · จัดการประเภทร้าน · Terms/Privacy(PDPA)+checkbox ยอมรับ · manual billing (แจ้งชำระ+สลิป→Back Office ยืนยัน) · การ์ด "บัญชีร้าน" ในหน้าร้านค้า (ลิงก์+แพ็กเกจ+อัปเกรด) · Back Office ต่อ backend จริง (ล้างเดโมแล้ว)

## เฟส 2 — ทำเป็น MOCKUP ก่อน แล้วค่อย implement
1. **หน้า "จัดการร้าน" แยกเป็นหน้าเดียวเต็ม (แบบ CRM dashboard)** — อ้างอิง mockup ที่มีอยู่แล้วใน **`KaiDee CRM.html` (จอ Home)**: header ร้าน+แพ็กเกจ/วันเหลือ/สถานะ · เช็คลิสต์เริ่มเปิดร้าน 3 ข้อ · ลิงก์ร้าน · ปุ่มลัด (เปิดขาย/จัดการเมนู/คุยทีมงาน/อัปเกรด) · แถบทดลองเหลือ N วัน → ยกมาเป็น "หน้าแรก" ของ merchant (ตอนนี้ยัดอยู่ในแท็บร้านค้า)
2. **ลิงก์ทีมส่ง/ไรเดอร์** — CRM success มี riderUrl (`?shop=X&role=rider`) แล้ว แต่การ์ด "บัญชีร้าน" (ShopAccount ใน `kaidee-merchant2.jsx`) ยังโชว์แค่ลิงก์ลูกค้า+หลังบ้าน → เพิ่มลิงก์ไรเดอร์ + หน้าจัดการทีมไรเดอร์ของร้าน
3. **เทมเพลต Rich menu ร้านสำเร็จรูป** (แบบ Bar B Q "GON member") — รูปพื้น + ตำแหน่งปุ่ม (ดูเมนู/สั่ง/เดลิเวอรี/ติดต่อ/บัตรสมาชิก) + คู่มือ mapping ลิงก์ลูกค้า → ร้านโหลดไปใส่ OA ตัวเอง ไม่ต้องออกแบบเอง
4. **admin จัดการรายร้าน** จาก Back Office (แก้เมนู/ตั้งค่าให้ร้านแต่ละเจ้า) — Back Office ต่อ API รายร้านได้อยู่แล้ว
5. **ระบบตัดเงินอัตโนมัติ (payment gateway)** — ตอนนี้ manual (แจ้งสลิป→ยืนยัน)
6. **admin auth จริง** — ตอนนี้รหัสฝั่ง client (`kaidee2026` เปลี่ยนได้ในตั้งค่า) · ควรต่อ SSO/รหัสทีมงานจริง
7. **ย้ายรูปไป R2** เมื่อรูป (โลโก้/หน้าปก/สลิป/เมนู) เยอะ — ตอนนี้เก็บ base64 ใน D1 · wrangler.toml เตรียม binding IMG ไว้ (comment อยู่) + worker มี /img route ร่าง (ถ้าจะเปิด)
8. **เติมช่องว่างในเอกสาร** — นโยบายคืนเงินใน `netlify-upload/terms.html` (`[ ]`) · ให้ทนายตรวจก่อนเปิดขายจริง

9. **⭐ ปุ่ม "อัปเกรด/แจ้งชำระ" ทุกจุดต้องเปิดหน้าจอแจ้งชำระในแอป** (เลือกเดือน→โอนพร้อมเพย์→แนบสลิป→ส่ง→รอแอดมินยืนยัน) — หน้านี้มีแล้วใน `LockedFeature` (ตอนทดลองหมดอายุ) แต่ปุ่มในการ์ด "บัญชีร้าน" (ShopAccount) ตอนยังไม่หมดอายุ **ยังเด้งไป LINE** → ต้องผูกให้เปิด pay-notify ในแอปแทน (แยก PayNotifySheet ออกมาใช้ร่วมกัน)

## ไฟล์สำคัญ
- หน้าบ้าน (root): `KaiDee POS.html` + `kaidee-*.jsx` (crm/app/merchant2/customer/api ฯลฯ) · ชุด deploy = โฟลเดอร์ `netlify-upload/`
- Back Office: `KaiDee Back Office.html` → คัดลอกเป็น `netlify-upload/admin.html`
- Backend: `cloud/kaidee/kaidee-worker.js` + `migrate-billing.sql` + `wrangler.toml`
- Mockup อ้างอิง: `KaiDee CRM.html` (จอ Home = ต้นแบบหน้าจัดการร้าน)

## วิธี deploy (ทุกครั้งที่แก้)
- เว็บ: ลากโฟลเดอร์ `netlify-upload` → Cloudflare Pages `kaidee-app` → Create deployment → Save and deploy → Cmd+Shift+R
- Worker: `kaidee-pos` → Edit code → วาง `kaidee-worker.js` → Deploy (ไม่ต้องรัน SQL ซ้ำถ้าไม่มี migration ใหม่)
