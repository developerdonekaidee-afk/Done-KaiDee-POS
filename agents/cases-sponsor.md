# เคสเทส — โมดูล 5: สปอนเซอร์ + เอนจินจับคู่ดีล
ไฟล์: `Sponsor Console.html` · `Sponsor Packages.html` · `Sponsor Shop.html` · `kd-sponsor-feed.jsx`
คีย์: `kd_sponsor_coupons_v1` · `kd_sponsor_tiers_v1` · `kd_sponsor_entitlement_v1` · `kd_sponsor_impr_v1` · `kd_taste_v1` · `kd_ads_optout_v1`
สถานะ: ⬜ ยังไม่เทส

## ทางเข้า
- [ ] `Signup Chooser.html` view `v-sponsor` → 3 ปุ่มเปิดถูกหน้า + โน้ต "ค่าเช่าพื้นที่รายเดือน ไม่หัก GP" แสดงอยู่
- [ ] `Sponsor Shop.html?from=signup` เปิดได้โดยไม่มี shop param

## Sponsor Console
- [ ] เพิ่มคูปองใหม่ → บันทึกลง `kd_sponsor_coupons_v1` แล้วการ์ดในโมดูลดึงขึ้นทันที
- [ ] ฟอร์ม: หมวดสินค้า (`cat`) + ช่วงเวลา chip 5 ช่วง (`slots`) เขียนค่าถูก
- [ ] ไม่เลือกหมวด / ไม่เลือกช่วงเวลา → ต้องถือว่า "ทุกหมวด/ทุกช่วง" ไม่ใช่ไม่โชว์เลย
- [ ] คูปองหมดอายุ / จำนวนหมด → ไม่โชว์ในฟีด
- [ ] แก้/ลบคูปอง → ฟีดอัปเดตตาม

## ทีเออร์ / การเรียง
- [ ] ตั้ง `kd_sponsor_tiers_v1` premium/growth/basic → เรียง Premium→Growth→ปกติ
- [ ] `TIER_W` เป็นตัวถ่วงน้ำหนัก: คูปอง basic ที่ตรงหมวด+ตรงเวลา ต้องชนะ premium ที่ไม่ตรงเลยได้

## `deals()` — คะแนนจับคู่
- [ ] หมวดตรง taste ×2 · ยอดใกล้ขั้นต่ำ · `slotOf` ตรงช่วงเวลา (ลองเปลี่ยนเวลาเครื่อง/ค่า at)
- [ ] `exclude` = หมวดร้าน → ดีลหมวดเดียวกับร้านต้องไม่โชว์
- [ ] `kdSponsorCatsOfShop(shop)` เดาหมวดจาก spCat/cat/typeLabel/type/name ได้ทุกกรณี · ร้านไม่มีข้อมูลหมวด → ไม่ exclude ทั้งหมด
- [ ] `limit` ทำงาน (หน้าลูกค้า ≤2 · จอคิว 1)

## Bandit
- [ ] แสดง ≥6 ครั้งไม่กด → คะแนนลด (ดีลนั้นถอยลงล่าง)
- [ ] มีแปลง (`window.kdSponsorConv(mod,couponId)` เรียกมือ) → ดันขึ้น
- [ ] แสดง <4 ครั้ง → ยัง explore (ไม่ถูกกดตายก่อนได้ข้อมูล)
- [ ] `impr:<mod>` / `clicks:<mod>` / `conv:<mod>` แยก mod ถูก ไม่ปนกัน
- [ ] ⚠️ ยังไม่มีตัวเรียก `kdSponsorConv` จริงใน Sponsor Shop/checkout = งานค้างที่ทราบแล้ว

## PDPA / ความเป็นส่วนตัว
- [ ] `kd_taste_v1` เก็บแค่ cats/slots/n/sum/last — **ห้ามมีชื่อ/เบอร์/รายการสินค้ารายบิล**
- [ ] `KDTaste.optOut()` → ฟีดหยุดโชว์ทุกโมดูล · `isOptOut` ถูก · `reset()` ล้างเฉพาะ taste
- [ ] ไม่มี request ออกนอกเครื่องจากการโชว์/กดดีล (ดู network tab)

## KDSponsorFeed ในทุกจุดที่แปะ
- [ ] `kaidee-home.jsx` · `fitness-pos-member.jsx` · `Market Mobile.html` · `laborwin2-worker.jsx` · `kaidee-board.jsx` · `kaidee-customer2.jsx` — ทุกจุดโชว์ได้ ไม่มี console error
- [ ] ไม่มีคูปองเลย → ต้องไม่โชว์กล่องว่าง (ซ่อนทั้งบล็อก)
- [ ] `kdSponsorFeedHTML(mod)` (แบบ non-React) แสดงผลเหมือนกัน

## Sponsor Shop / Packages
- [ ] เปิดหน้าร้านสปอน จากทุก `from=<mod>` → นับ click ถูก mod
- [ ] ใช้คูปอง (flow ปัจจุบัน) ไม่ error · ⚠️ ยังเป็นเดโม localStorage เครื่องเดียว = ทราบแล้ว
