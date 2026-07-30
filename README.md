# Done-KaiDee-POS — แพลตฟอร์ม Kaidee (ทุกโมดูล)

repo นี้เก็บ **ทุกอย่างของแพลตฟอร์ม Kaidee** · **ไม่รวมงาน Potato Corner Promotion** (แยก repo)

## โครงโฟลเดอร์
| ที่อยู่ | คืออะไร |
|---|---|
| root `*.jsx` `*.js` `*.html` | **ไฟล์ต้นฉบับ (source)** ที่แก้จริง |
| `kaidee-deploy/` | **build ที่ขึ้น pages.dev** (แอป POS/ฟิตเนส/วิน/สปอนเซอร์) · `index.html` = แอป POS · มี `sw.js` |
| `market-deploy/` | build ฝั่งตลาด |
| `kaidee-pos-worker/` `platform-worker/` `license-worker/` | Cloudflare Worker (backend) |
| `labor-win/` | ของฝั่ง Labor Win เพิ่มเติม |
| `agents/` | เอกสารเอเจนต์เทส + เคสรายโมดูล + fixlist |

## โมดูลในระบบ
1. **ร้านค้า KaiDee POS** — `KaiDee POS.html` · `kaidee-app.jsx` `kaidee-home.jsx` `kaidee-merchant2.jsx` `kaidee-customer2.jsx` `kaidee-crm.jsx` `kaidee-board.jsx` · `KaiDee Back Office.html`
2. **ฟิตเนส** — `Fitness POS.html` · `fitness-*.jsx`
3. **ตลาด** — `Market Mobile.html` `Market Vendor.html` `Market Backoffice.html` · `market-*.jsx`
4. **วิน (Labor Win)** — `Labor Win App v2.html` · `laborwin2-*.jsx`
5. **สปอนเซอร์** — `Sponsor Console.html` `Sponsor Packages.html` `Sponsor Shop.html` · `kd-sponsor-feed.jsx`
6. **ไฟล์ร่วม (⚠️ แก้แล้วกระทบทุกโมดูล)** — `kd-wallet.jsx` · `platform-api.jsx` · `gate.js` · `market-data.jsx`
7. **หน้าแรก** — `Signup Chooser.html` (เลือกระบบ/บทบาท)

## กติกาที่ห้ามผิด
- **กระเป๋าเงิน = closed-loop** จ่ายค่าบริการระบบเท่านั้น · `KDW.withdraw()` คืน error เสมอ (ไม่มีใบอนุญาต e-money) · ยอดขายลูกค้าเข้าบัญชีเจ้าของร้านตรง แพลตฟอร์มไม่ถือเงิน
- **แพ็กสปอนเซอร์ = ค่าเช่าพื้นที่รายเดือน ไม่มี GP**
- **การ์ดดีลสปอนเซอร์ในหน้าลูกค้า = ค่าเริ่มต้นปิด** (เจ้าของร้านเปิดเอง)
- ข้อมูลพฤติกรรม (`kd_taste_v1`) ประมวลผลในเครื่อง **ไม่เก็บชื่อ/เบอร์** · มีปุ่มปิดรับโฆษณา
- ฟีเจอร์ใหม่ทุกตัว **ต้องเพิ่ม key ใน `PERM_PAGES`**
- แปลง timestamp ของข้อมูลเก่าต้อง guard เสมอ (เคยพังด้วย RangeError)
- ห้ามใช้ `window.confirm` (PWA/LINE เด้ง dialog เบราว์เซอร์) → ใช้ชีตในแอป

## ขั้นตอน deploy (ทำครบ ห้ามข้าม)
1. แก้ไฟล์ที่ root
2. sync ไฟล์ที่แก้ → `kaidee-deploy/` + `market-deploy/`
3. เปลี่ยน `?v=` ทุก `<script src>` + `<meta name="build">` ในทุก html ทั้ง 3 ที่
4. bump `kaidee-deploy/sw.js` `hagd-pos-vN` → `v{N+1}`
5. `git add . && git commit -m "..." && git push` → **Cloudflare Pages build เอง** (ไม่ต้องอัป zip แล้ว)

### Cloudflare Pages (เชื่อม Git)
| ตั้งค่า | ค่า |
|---|---|
| Repository | `developerdonekaidee-afk/Done-KaiDee-POS` · branch `main` |
| Framework preset | None |
| Build command | (เว้นว่าง — static ล้วน ไม่มี build step) |
| Build output directory | `kaidee-deploy` |
| ฝั่งตลาด | สร้างโปรเจกต์ Pages อีกตัว output = `market-deploy` |

- `_headers` ในแต่ละ output = สั่งไม่ให้ cache `sw.js` / `.html` / `.jsx` / `.js` (กันอาการ deploy แล้วยังเห็นของเก่า) — **ห้ามลบ**
- ⚠️ โปรเจกต์ Pages ที่เคยสร้างแบบ Direct Upload **เชื่อม Git ทีหลังไม่ได้** ต้องสร้างโปรเจกต์ใหม่แบบ Git (ถ้าอยากได้ชื่อโดเมนเดิม ต้องลบตัวเก่าก่อนแล้วตั้งชื่อเดิม)
- ยังต้อง bump `?v=` + `sw.js` ทุกครั้งเหมือนเดิม — Pages แค่แทนขั้นตอนอัปไฟล์

## เวอร์ชันล่าสุด
- sw: `hagd-pos-v59` · build: `?v=p2-20260730j`
- ตัวเช็คในแอป: ฟิตเนส → หน้า "เพิ่มเติม" ท้ายสุดโชว์เวอร์ชันระบบ (อ่านจาก meta build)

## เก็บข้อมูลตอนนี้
ทุกโมดูลเก็บ **localStorage บนเครื่อง** (ยังไม่มีฐานข้อมูลกลาง) — ถ้าต้องการเห็นข้อมูลข้ามเครื่อง ต้องต่อ Worker + D1 ผ่าน `platform-api.jsx` (`PLAT_API`)
