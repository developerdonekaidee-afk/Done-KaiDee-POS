# เคสเทส — โมดูล 6: ไฟล์ร่วม (⚠️shared — แก้แล้วต้องเทสทุกโมดูลที่โหลด)
ไฟล์: `kd-wallet.jsx` · `platform-api.jsx` · `gate.js` · `market-data.jsx`
คีย์: `kd_biz_wallet_v1` · `kd_biz_sales_v1` · `kd_platform_wallet_v1`
สถานะ: ⬜ ยังไม่เทส

## กระเป๋าเงิน (กฎห้ามผิด)
- [ ] `KDW.withdraw()` **คืน error เสมอ** ทุกกรณี (closed-loop ไม่มีใบอนุญาต e-money)
- [ ] ไม่มี UI ที่ไหนเสนอ "ถอนเงิน/โอนออก" · โน้ตกฎหมายแสดงในหน้าที่เกี่ยวกับเงิน
- [ ] `KDW.biz(mod,id)` แยกกระเป๋าต่อโมดูล+ต่อร้าน ไม่ปนกัน (สร้าง 2 ร้านแล้วเทียบ)
- [ ] `charge()`: ยอดพอ → หัก + ledger · ยอดไม่พอ → error ไม่หักครึ่ง ๆ · ยอด 0/ติดลบ → กัน
- [ ] `topup()` → เขียน ledger + ยอดตรง · เติมซ้ำเร็ว ๆ ไม่คิดสองเท่า
- [ ] ยอดคงเหลือหลังทำ 10 รายการ = ผลรวม ledger เป๊ะ (ตรวจด้วยการบวกเอง)

## รับเงิน 2 แบบ
- [ ] `setRecvMode('legacy'|'auto')` · `setRecvAcct()` บันทึกต่อร้าน
- [ ] `receive(biz,amt,{who,ref,method,auto})` → `gross` เพิ่ม + ledger รับเงินขึ้น
- [ ] `refund()` ลดยอดถูก · refund เกินยอดเดิมต้องกัน
- [ ] `KDReceivePanel` แสดงเดินบัญชีรับเงินตรงกับ ledger
- [ ] ⚠️ ยังไม่มีตัวเรียก `receive()` จากจุดขายจริง (POS checkout · ฟิตเนส sell · บิลตลาด · งานวิน) = งานค้างที่ทราบแล้ว — ระบุว่าจุดไหนยังไม่ต่อ

## Back Office กระเป๋า
- [ ] แอดมินเติม/ปรับลด → ledger ระบุ "ปรับโดยแอดมิน · Back Office"
- [ ] KPI คงเหลือรวม / รายได้ 30 วัน / สะสม / auto ตรงกับตาราง (สุ่มเช็ค 2 แถว)

## ด่านรหัส (`gate.js`)
- [ ] โดเมนจริง (`pages.dev`/`netlify.app`/`workers.dev`/`kaidee-app.*`/`hagd.*`) → **ไม่ถามรหัส**
- [ ] ฝั่งพรีวิว → ถามทุกครั้ง · ช่อง "เชื่อถือเครื่องนี้" ติ๊กมาให้ · PWA/`?trust=1` ผ่านอัตโนมัติ
- [ ] `?lock=1` → ล็อก + ถอนความไว้ใจ
- [ ] `KDGate.deviceId/isTrusted/trustThisDevice/listTrusted` ทำงาน
- [ ] ⚠️ ห้ามเขียนรหัสลงรายงาน

## platform-api / market-data
- [ ] `PLAT_API` ไม่มี endpoint จริง → ต้อง fallback เงียบ ไม่ throw ทั้งหน้า
- [ ] `MK` helper: format เงิน/วันที่ไทย/gen id — id ไม่ซ้ำเมื่อสร้างรัว ๆ 100 ตัว

## เวอร์ชัน / โหลดไฟล์
- [ ] ทุก `<script src="...jsx|js">` ในหน้า root มี `?v=` และ `<meta name="build">` ตรงกัน
- [ ] เปิดทุกหน้า root ของ Kaidee → console ไม่มี 404 ไฟล์ที่หายไป
- [ ] guard timestamp: ข้อมูลเก่าที่ field วันที่เป็น undefined/สตริงเปล่า → ไม่เกิด RangeError
