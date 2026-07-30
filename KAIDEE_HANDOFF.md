# KaiDee POS (":Done KaiDee POS") — SESSION HANDOFF

แอป POS ผ่าน LINE สำหรับร้านอาหาร (คนละโปรเจกต์กับ Promotion Management System)
Deploy: **Cloudflare Pages · kaidee-app.pages.dev** (Direct Upload — Remove all → ลากไฟล์ใน `kaidee-deploy/` → Save and deploy → hard refresh)

## ไฟล์แอป (root)
- `KaiDee POS.html` — shell (title ":Done KaiDee POS", โหลด kaidee-*.jsx ทั้งหมด, ต่อ `kaidee-license.jsx` แล้ว)
- `kaidee-app.jsx` (store กลาง + license check), `kaidee-data.jsx` (helpers: activeSaleModes/priceFor/recipeFor/deliveryFee), `kaidee-merchant.jsx` (SellScreen + ChannelPicker + best-seller popup), `kaidee-merchant2.jsx` (Store/ItemEditor/Dashboard + print reports), `kaidee-stock.jsx` (RecipeEditor per-channel + copy), `kaidee-cash.jsx` (เปิด/ปิดร้าน + reconcile), `kaidee-customer.jsx`/`kaidee-customer2.jsx` (ลูกค้า LIFF + map pin), `kaidee-rider.jsx` (proof/nav), `kaidee-map.jsx` (Leaflet/OSM ฟรี), `kaidee-home.jsx`, `kaidee-crm.jsx`, `kaidee-help.jsx`, `kaidee-api.jsx`, `kaidee-liff.jsx`, `ios-frame.jsx`
- `KaiDee Back Office.html` (แอดมิน · responsive · เมนู "🔐 สิทธิ์ร้าน" → License Admin), `License Admin.html`
- `kaidee-deploy/` = ชุดพร้อมอัป (index.html = KaiDee POS.html)

## ✅ ทำเสร็จรอบนี้
1. **Sale mode หลายช่องทาง (คีย์บันทึกยอดเอง — ไม่ใช่รับออเดอร์อัตโนมัติ)**: หน้าขายเลือก/เพิ่ม/เปิด-ปิดช่องทาง (ChannelPicker แนวตั้ง + ป้ายสีแบรนด์) · เมนูกำหนดช่องทางที่ขาย + ราคาต่อช่องทาง (ItemEditor) · สูตรแยกช่องทาง + ปุ่มคัดลอกสูตร · ปิดบิลแพลตฟอร์ม = tender ตามชื่อ (ไม่รับเงินสด → ยอดค้างรับ)
2. **สต๊อกตัดตามสูตรของช่องทาง** (consumeStock รับ channel) · แจ้งเตือนใกล้หมด (badge + popup + สั่น + LINE hook)
3. **สรุป/รายงาน**: แยกช่องทางขาย + ช่องทางชำระ (เงินสด/โอน/พร้อมเพย์) + ยอดค้างรับแพลตฟอร์ม (กด "รับยอดแล้ว" ใส่ยอดรับจริง → กระทบยอด) · กราฟรายชั่วโมง toggle รวม/แยกช่องทาง · เลือกดู รายวัน/เดือน/ทั้งหมด · **พิมพ์ 3 รายงาน: สรุป · รายบิล(ทุกช่องทาง) · กระทบยอดแพลตฟอร์ม**
4. **เปิด/ปิดร้าน**: ต้องเปิดกะ (register.open) ก่อนขาย · ปิดร้าน reconcile เงินสด/โอน/QR/แพลตฟอร์ม · ปิดบิลขายเด้งเป็นตั๋วครัวหน้าออเดอร์อัตโนมัติ (fromSale, กันนับยอด/ตัดสต๊อกซ้ำ)
5. **ค่าส่งไรเดอร์ 3 โหมด** (ลูกค้าจ่าย/ร้านออก/ตามระยะจากหมุด) + payout สิ้นวัน/ต่อรอบ · ลูกค้าปักหมุด map ฟรี + เบอร์ · ไรเดอร์ โทร/นำทาง/แนบรูปหลักฐาน + เงื่อนไขตอนสมัคร · เปิด-ปิด delivery/pickup แยก
6. **ป้ายขายดีหน้าลูกค้า** ดึงจากยอดขายจริง · footer © + Privacy/Terms · โลโก้ :Done · **ล้างข้อมูลตัวอย่าง** (เริ่มสะอาด)
7. **⭐ ระบบกันแก้วันหมดอายุ (deploy จริงแล้ว)**: `license-worker/worker.js` (Cloudflare Worker + KV `KAIDEE_LICENSE` binding `LIC` + env `ADMIN_TOKEN`) — **live: `https://kaidee-license.oneday-pos.workers.dev`** · endpoints: `/shop/:id/status`, `/shop/:id/payreq`, `/admin/pending`, `/admin/approve`, `/admin/set` (graceDays/maxDevices/expiry/resetDevices) · `kaidee-license.jsx` (LICENSE_ENDPOINT ตั้งค่าแล้ว · cache+grace 5 วัน · fallback demo) · `kaidee-app.jsx` useEffect เรียก KD_LICENSE.check → set sub จากเซิร์ฟเวอร์ · `License Admin.html` (Back Office เมนู 🔐) เชื่อม Worker ด้วย token `kd_9x7Qw2Lp8vTz`
8. **วิดีโอโปรโมต 2 เวอร์ชัน** (เสียงพากย์ไทยผู้ชาย TTS + ซับ): `KaiDee POS Promo 9-16.html` (Reels/TikTok/Story) · `KaiDee POS Video.html` (YouTube/Facebook 16:9) · ไฟล์ scene: `kdidee-common.jsx`, `kdidee-narration.jsx` (kdSpeakScene/Caption/CaptionBar/SoundToggle), `kdidee-vertical-a/b.jsx` (9:16), `kdidee-scenes-a/b.jsx` (16:9) · ข้อความชู "เปิดในไลน์ ไม่ต้องโหลดแอป + คีย์บันทึกหลายช่องทาง" · CTA "สแกน QR สมัครเปิดร้านฟรี" (ไม่มี @ ที่ต้องเสียเงิน) · ⚠️ TTS เล่นสดเท่านั้น export MP4 เสียงไม่ติด → screen record

## ⏳ งานค้าง / ที่คุยไว้
- **login บัญชีร้าน** (ตอนนี้ license ผูกด้วย shopId/device — ยังไม่มีระบบล็อกอินจริง) · **soft-lock UI ตอนหมดอายุ** (Worker คืน active=false แล้ว แต่แอปยังไม่ได้เด้งหน้าปิดการขาย — มีแค่แบนเนอร์เตือน)
- **หน้าอนุมัติสลิปในแอปลูกค้า** (submitPayReq มีใน kaidee-license.jsx แล้ว แต่ UI ปุ่มต่ออายุยังไม่เรียก · Back Office ใช้ License Admin.html แยก)
- **1:1 square video** (user บอก B ไม่ต้องทำ — ข้ามไป)
- payment gateway ตัดบัตรอัตโนมัติ (ยังไม่ทำ · ใช้โอน+สลิป+อนุมัติมือพอ)
- **LINE @ Premium** (`@kaideepos`) ยังไม่ซื้อ — เริ่มด้วย Basic ID ฟรี · `@kaideepos` ในโค้ด CRM/qr-poster เป็น placeholder

## ⚠️ หมายเหตุ
- ทุก edit อยู่ root · `kaidee-deploy/` = สำเนาพร้อมอัป (sync ล่าสุดแล้ว) — ถ้าแก้ root ใหม่ ต้อง copy เข้า kaidee-deploy ก่อนแพ็ก
- ราคาแพ็กเกจ: ทดลองฟรี 30 วัน → ฿299/เดือน หรือ ฿2,990/ปี (ถูก-กลางตลาด · จุดขาย = ไม่ต้องซื้อเครื่อง + เปิดในไลน์ + รวมเดลิเวอรี)
