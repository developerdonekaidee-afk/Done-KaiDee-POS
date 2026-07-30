// kaidee-help.jsx — in-app user guide (คู่มือ) per section
const { useState:hState } = React;

const HELP = [
  { role:'merchant', ic:IC.store, tone:'var(--brand)', bg:'var(--brand-soft)',
    title:{th:'สำหรับแม่ค้า / ร้านค้า',en:'For Merchants'},
    topics:[
      { ic:IC.sell, h:{th:'กดขายหน้าร้าน',en:'Sell at the counter'},
        s:{th:['แตะแท็บ “ขาย” เลือกหมวดแล้วแตะเมนูเพื่อใส่ตะกร้า','แตะแถบเขียวด้านล่างเพื่อดูรายการ ปรับจำนวนด้วยปุ่ม +/−','เลือกประเภท: กลับบ้าน / ทานที่ร้าน (ใส่เลขโต๊ะ) / หน้าร้าน','กด “เก็บเงิน” เลือกช่องทาง แล้วระบบออกเลขคิวให้อัตโนมัติ','เมนูที่ปิดขาย (สินค้าหมด) จะขึ้น “สินค้าหมด” กดสั่งไม่ได้'],
            en:['Tap “Sell”, pick a category and tap items to add','Tap the green bar to review, adjust with +/−','Choose type: Take away / Dine-in (table) / Walk-in','Charge, pick payment — a queue number is issued automatically','Items turned off show “Sold out” and can’t be added']} },
      { ic:IC.bag, h:{th:'รับออเดอร์ทุกแพลตฟอร์ม (เครื่องรับออเดอร์)',en:'All-platform order station'},
        s:{th:['แท็บ “ออเดอร์” รวมออเดอร์จากหน้าร้าน, LINE, Grab, LINE MAN, ShopeeFood, foodpanda','กรองดูเฉพาะช่องทางได้ และคิวแยกสีตามแต่ละช่องทาง','กดปุ่มเลื่อนสถานะ: รับออเดอร์ → ทำเสร็จ → ปิดงาน','ป้ายเลขแดงบนแท็บ = ออเดอร์ใหม่ที่ยังไม่รับ'],
            en:['“Orders” aggregates counter, LINE, Grab, LINE MAN, ShopeeFood, foodpanda','Filter by channel; queues are colour-coded per channel','Advance: Accept → Ready → Complete','Red badge = new unaccepted orders']} },
      { ic:IC.edit, h:{th:'จัดคิว · ชื่อลูกค้า · โน้ตครัว · ทำก่อน',en:'Queue, customer, kitchen note & priority'},
        s:{th:['บนการ์ดออเดอร์กดไอคอนดินสอ → แก้ ชื่อลูกค้า · เลขคิว · โน้ตถึงครัว/คนทำ · เวลานัดรับ','โน้ตถึงครัว (เช่น ไม่เผ็ด/ห่อแยก) จะเด้งเป็นแถบเหลืองให้คนทำเห็นชัด','📌 = ปักหมุด “ทำก่อน” ดันคิวขึ้นบนสุด · ปุ่ม ▲▼ เลื่อนลำดับคิวเอง','ใช้สื่อสารระหว่างคนรับออเดอร์กับคนทำในครัวได้ในตัว'],
            en:['Tap the pencil on an order → edit customer · queue no. · kitchen note · pickup time','The kitchen note (e.g. not spicy) shows as a yellow strip for the cook','📌 pins as “priority” to the top · ▲▼ reorder the queue manually','Use it to communicate between the counter and the kitchen']} },
      { ic:IC.clock, h:{th:'ตอบเวลานัดรับให้ลูกค้า (ทัน/ไม่ทัน)',en:'Reply on pickup time'},
        s:{th:['ออเดอร์ที่ลูกค้าระบุเวลามารับ จะมีแถบ “ลูกค้าขอเวลา …”','กด “รับได้ตามเวลา” เพื่อยืนยัน ✅ หรือ “ขอเลื่อนเวลา” เพื่อเสนอเวลาใหม่ ⏰','ลูกค้าจะเห็นคำตอบในหน้าติดตามออเดอร์ และได้ข้อความแจ้งกลับทาง LINE'],
            en:['Orders with a requested pickup time show a “Requested …” bar','Tap “Confirm time” ✅ or “Propose new” ⏰ to suggest another time','The customer sees your reply in tracking and gets a LINE message']} },
      { ic:IC.receipt, h:{th:'พิมพ์ใบเสร็จ & บิลครัว',en:'Print receipt & kitchen bill'},
        s:{th:['กดปุ่มใบเสร็จบนการ์ดออเดอร์ (หรือหลังเก็บเงิน)','สลับดู “ใบเสร็จลูกค้า” และ “บิลครัว” ที่มีเลขคิว/โต๊ะตัวใหญ่','กด “พิมพ์” ระบบจะเปิดหน้าต่างพิมพ์ของเครื่อง (สลิป 80 มม.) แล้วสั่งพิมพ์ออกเครื่องพิมพ์ที่เชื่อมอยู่ได้จริง'],
            en:['Tap the receipt button on an order (or after charging)','Switch between customer receipt and kitchen bill (big queue/table)','Tap “Print” — the system opens the print dialog (80 mm slip) to any connected printer']} },
      { ic:IC.box, h:{th:'วิธีคิดต้นทุน (แบบผสม · ตั้งรายเมนู)',en:'Costing (hybrid · per item)'},
        s:{th:['ไม่มีโหมดรวมทั้งร้านแล้ว — คิดต้นทุน “รายเมนู” ปนกันได้ในร้านเดียว','เปิดเมนู → เลือกวิธีคิด 2 แบบ: “💵 ต้นทุน/จาน” หรือ “🧾 คิดจากสูตร”','ต้นทุน/จาน: พิมพ์ตัวเลขต้นทุนช่องเดียว เหมาะกับของซื้อมาขาย (น้ำ ขนม ของฝาก) ไม่ต้องทำสต๊อก','คิดจากสูตร: ใส่วัตถุดิบ+ปริมาณต่อจาน → ต้นทุน/กำไรคิดให้อัตโนมัติ และ “ตัดสต๊อก” ทุกครั้งที่ขาย','ไม่ต้องทำครบทุกเมนู — เมนูไหนยังไม่กรอกต้นทุนก็ขายได้ปกติ (กำไร=ราคาขายไปก่อน)','แท็บ “สต๊อก” ใช้ได้ตลอด ไม่ต้องสลับโหมด'],
            en:['No shop-wide mode — cost each item its own way, mixed in one shop','Open an item → pick a method: “💵 Per-dish” or “🧾 From recipe”','Per-dish: type one cost number — great for resold goods (drinks/snacks), no inventory','From recipe: add materials × qty per dish → auto cost/profit + auto stock deduction on sale','You don’t have to do every item — un-costed items still sell (profit = price for now)','The “Stock” tab is always available — no switching']} },
      { ic:IC.receipt, h:{th:'ตัวเลือกสินค้า (เผ็ด/หวาน/ไซซ์/ท็อปปิ้ง)',en:'Item options (spice/sweet/size/topping)'},
        s:{th:['ในหน้าแก้เมนู เลื่อนไปหัวข้อ “🧩 ตัวเลือกสินค้า”','กดปุ่มสำเร็จรูป (ความเผ็ด · หวาน · ไซซ์ · ท็อปปิ้ง) หรือ “กลุ่มเอง”','แต่ละกลุ่มเลือก “เลือก 1” หรือ “เลือกได้หลาย” และใส่ราคาเพิ่มต่อตัวเลือกได้ (+฿)','เมนูที่มีตัวเลือกจะขึ้นป้าย 🧩 บนรายการเมนู','ลูกค้าเลือกตัวเลือกตอนสั่ง ราคาบวกเพิ่มอัตโนมัติ และครัวเห็นตัวเลือกใต้ชื่อเมนู'],
            en:['In the item editor scroll to “🧩 Options”','Tap a preset (spice · sweet · size · topping) or “Custom”','Set each group to single/multi and add an extra price per choice (+฿)','Items with options show a 🧩 badge in the menu list','Customers pick options at order time — price adds automatically and the kitchen sees them under the item']} },
      { ic:IC.layers, h:{th:'เมนู · สูตร · ต้นทุน · กำไร',en:'Menu, recipe, cost & profit'},
        s:{th:['กด “+ เมนู” สร้างเมนู · แตะรูปเพื่ออัปโหลดภาพ · ตั้งราคาขาย','เลือกวิธีคิดต้นทุนของเมนูนั้น (ต้นทุน/จาน หรือ คิดจากสูตร)','ของซื้อมาขายต่อ (ขนม/น้ำ) เลือก “ต้นทุน/จาน” กรอกต้นทุนต่อชิ้นพอ','อาหารปรุง เลือก “คิดจากสูตร” ผูกวัตถุดิบ+ปริมาณ → ตัดสต๊อกอัตโนมัติเมื่อขาย','ป้ายบนเมนูจะขึ้น “🧾 คิดจากสูตร · ตัดสต๊อก” เฉพาะเมนูที่ผูกสูตร'],
            en:['“+ Item” to create · tap image to upload · set price','Pick that item’s costing method (per-dish or from recipe)','Resold items (snacks/drinks): choose “Per-dish” and type a per-piece cost','Cooked dishes: choose “From recipe”, link materials × qty → auto stock deduction on sale','A “From recipe · auto-deduct” badge shows only on recipe items']} },
      { ic:IC.plus, h:{th:'หมวดหมู่ · เปิด/ปิดสินค้า (สินค้าหมด)',en:'Categories & item on/off'},
        s:{th:['กด “+ หมวด” เพิ่มหมวด · แตะที่ชื่อหมวด (ไอคอนดินสอ) เพื่อแก้ชื่อ/เปลี่ยนไอคอน/ลบ','ลบหมวดแล้วเมนูจะย้ายไปหมวดอื่นให้อัตโนมัติ','เปิด/ปิดขายรายเมนูด้วยสวิตช์ท้ายแถว (ปิด = สินค้าหมด) หรือในหน้าแก้เมนู'],
            en:['“+ Category” to add · tap a category name (pencil) to rename/change icon/delete','Deleting a category moves its items elsewhere','Toggle each item on/off (off = sold out) via the row switch or item editor']} },
      { ic:IC.box, h:{th:'สต๊อกวัตถุดิบ & ลงสต๊อก (ซื้อเข้า)',en:'Inventory & adding stock'},
        s:{th:['แท็บ “สต๊อก” โชว์มูลค่าคงเหลือ · ของใกล้หมด · คงเหลือรายตัว (ใช้ได้ตลอด)','ลงสต๊อกครั้งแรก: กด “+ เพิ่มวัตถุดิบใหม่” ใส่ชื่อ · หน่วยนับ (กรัม/มล./ชิ้น) · จำนวนที่มี · ต้นทุนเฉลี่ย · จุดเตือนใกล้หมด','เติมของประจำ: กด “ซื้อเข้า” บันทึกบิลตามวันที่ ใส่ได้หลายรายการพร้อมกัน','ซื้อเป็นลัง/แพ็ค/กิโล ได้ เช่น น้ำ 5 ลัง × 24 → เข้าสต๊อก 120 ขวดให้อัตโนมัติ · หมู 5 กก. ฿900 → เฉลี่ย ฿0.18/กรัม','ทุกครั้งที่ซื้อเข้า “ต้นทุนเฉลี่ย” อัปเดตแบบถ่วงน้ำหนักให้เอง (ราคาขึ้น-ลงก็เฉลี่ยถูก)','แตะวัตถุดิบเพื่อแก้ชื่อ/หน่วย/ปรับยอดคงเหลือ/ตั้งจุดเตือน','เมนูที่ผูกสูตรกับวัตถุดิบนี้ จะตัดสต๊อกให้อัตโนมัติทุกครั้งที่ขาย'],
            en:['“Stock” tab shows value, low items, per-item on-hand (always available)','First time: “+ Add raw material” — name · unit (g/ml/pcs) · qty on hand · avg cost · low-stock alert','Restock: “Buy in” records a dated bill with many lines at once','Buy by case/pack/kg — e.g. water 5×24 → 120 bottles · pork 5 kg ฿900 → ฿0.18/g','Each purchase updates the weighted-average cost automatically','Tap a material to edit name/unit/adjust on-hand/alert','Recipe-linked items auto-deduct this material on every sale']} },
      { ic:IC.receipt, h:{th:'ตัดของเสีย / ของทิ้ง',en:'Record waste / spoilage'},
        s:{th:['แท็บ “สต๊อก” → ปุ่ม “🗑️ ของเสีย” มุมขวาบน','เลือกวัตถุดิบที่เน่า/หก/หมดอายุ · ใส่จำนวน+หน่วย · เลือกเหตุผล','ระบบหักออกจากสต๊อกทันที และคิดมูลค่าที่เสีย (จำนวน × ต้นทุนเฉลี่ย)','ดูรวมของเสียได้ที่แท็บย่อย “ของเสีย” · ลบรายการที่บันทึกผิดได้','มูลค่าของเสียเข้าไปเป็นค่าใช้จ่ายหมวด “ของเสีย/ทิ้ง” ในหน้าสรุปรายรับ-รายจ่าย'],
            en:['“Stock” tab → “🗑️ Waste” button (top-right)','Pick the spoiled/dropped/expired material · qty + unit · reason','Deducted from stock instantly, valued at qty × avg cost','See the total under the “Waste” sub-tab · delete mistaken entries','Waste value appears as a “Waste” expense in the Income/Expense report']} },
      { ic:IC.cartIn, h:{th:'รายการต้องซื้อ (เช็คลิสต์ปิดวัน)',en:'Shopping list (closing checklist)'},
        s:{th:['แท็บ “สต๊อก” → “ต้องซื้อ” รวมของที่ ≤ จุดเตือนให้อัตโนมัติ','บอกว่าเหลือเท่าไร และแนะนำจำนวนที่ควรเติม','ติ๊กเลือกของที่จะซื้อ แล้วกด “สร้างบิลซื้อเข้า” → เด้งฟอร์มพร้อมรายการให้เลย','ตัวเลขแดงบนแท็บ = จำนวนของใกล้หมดที่ต้องซื้อ'],
            en:['“Stock” → “To buy” auto-lists items at/below the alert level','Shows what’s left and a suggested top-up qty','Tick items and tap “Create purchase” → the buy form opens prefilled','Red number on the tab = how many are low']} },
      { ic:IC.wallet, h:{th:'เงินสด · เปิด/ปิดร้าน · ปิดวัน',en:'Cash · open/close · daily close'},
        s:{th:['แท็บ “เงินสด” เริ่มวันด้วยการใส่เงินทอนตั้งต้น กด “เปิดร้าน”','ระหว่างวันบันทึกนำเงินเข้า/ออก (เบิกจ่ายค่าของ ค่าน้ำไฟ ฯลฯ)','ดูเงินสดในลิ้นชัก (คาดว่า) และยอดรับแยกช่องทาง','กด “ปิดวัน” นับเงินจริง ระบบเทียบว่าเงินขาด/เกิน แล้วเก็บสรุปไว้'],
            en:['“Cash” tab: enter starting float and “Open shop”','Log cash in/out during the day (paying for supplies, bills…)','See expected cash in drawer and takings by method','“Close day” — count actual cash; system shows over/short and saves the summary']} },
      { ic:IC.chart, h:{th:'สรุปยอดขาย & รายรับ-รายจ่าย',en:'Reports & income/expense'},
        s:{th:['แท็บ “สรุป” มี 2 มุมมอง: ยอดขาย และ รายรับ-รายจ่าย','ยอดขาย: รายรับ ต้นทุน กำไร % · กราฟรายชั่วโมง · ช่องทาง · เมนูขายดี','รายรับ-รายจ่าย: กำไรสุทธิ · ค่าวัตถุดิบดึงจากบิลซื้อเข้าอัตโนมัติ · ค่าใช้จ่ายอื่นจากการนำเงินออก','สลับช่วง วันนี้ / ทั้งหมด ได้','กด “พิมพ์ / บันทึก PDF สรุปนี้” ออกรายงาน A4 (รายรับ ต้นทุน กำไรสุทธิ + รายการรายจ่าย) เปิดหน้าต่างพิมพ์ หรือเซฟเป็น PDF'],
            en:['“Reports” has 2 views: Sales and Income/Expense','Sales: revenue, cost, margin · hourly chart · channels · best sellers','Income/Expense: net profit · material cost auto from purchases · other expenses from cash-out','Toggle Today / All time','Tap “Print / Save PDF” for an A4 report (income, cost, net + expense log) — print or save as PDF']} },
      { ic:IC.store, h:{th:'ข้อมูลร้าน · เวลาทำการ · วันหยุด',en:'Store profile · hours · holidays'},
        s:{th:['แท็บ “ร้านค้า” แตะการ์ดร้านเพื่อตั้งชื่อ โลโก้ สาขา ปักหมุดแผนที่ ที่อยู่','ตั้งเวลาทำการรายวัน (จ–อา) แยกแต่ละวันได้ · กด “หยุด” วันไหนก็ได้ (เช่นหยุดทุกจันทร์)','ใส่หมายเหตุวันหยุดเทศกาลได้ · สวิตช์เปิด/ปิดรับออเดอร์ตอนนี้'],
            en:['“Store” → tap the store card for name, icon, branch, map, address','Set weekly hours (Mon–Sun) per day · mark any day “Off” (e.g. every Monday)','Add a holiday/festival note · toggle accepting orders now']} },
      { ic:IC.qr, h:{th:'แชร์ลิงก์ให้ทีม (ลูกค้า · หลังบ้าน · ไรเดอร์ · พนักงาน)',en:'Share links (customer · backend · rider · staff)'},
        s:{th:['หน้า “จัดการร้าน” มีการ์ด “🔗 ลิงก์ของร้านคุณ” รวมลิงก์ 4 แบบ','ลูกค้าสั่งอาหาร = เปิดในไลน์ (เอาไปใส่ Rich menu) · หลังบ้าน = แม่ค้า/ครัว · ไรเดอร์ = คนส่ง · พนักงาน = ขาย/ออเดอร์เท่านั้น','ทุกลิงก์เป็นแอปเดียวกันและผูกกับร้านคุณ (มี ?shop=รหัสร้าน) — เครื่องอื่นเปิดก็เห็นข้อมูลร้านเดียวกัน','กด “คัดลอก” เพื่อก๊อป หรือปุ่ม “↗ แชร์” เพื่อส่งเข้าไลน์/แชตผ่านหน้าต่างแชร์ของเครื่องได้เลย','กดปุ่ม “▦ QR” ที่แต่ละลิงก์ → โชว์ QR ให้สแกน · แชร์รูป QR เข้าไลน์ หรือบันทึกเป็นรูปได้','แชร์ให้ถูกคน: พนักงานหน้าร้านใช้ลิงก์พนักงาน · คนขับใช้ลิงก์ไรเดอร์'],
            en:['“Store” has a “🔗 Your shop links” card with 4 link types','Customer = opens in LINE (for Rich menu) · Backend = owner/kitchen · Rider = drivers · Staff = sell/orders only','Every link is the same app tied to your shop (?shop=ID) — other devices see the same shop data','Tap “Copy”, or “↗ Share” to send via the device share sheet (LINE/chat)','Tap “▦ QR” on any link to show a scannable QR · share the QR image or save it','Share the right link with the right person']} },
      { ic:IC.store, h:{th:'ทะเบียนพนักงาน · ผู้ทำรายการ',en:'Staff registry · who’s selling'},
        s:{th:['หน้า “จัดการร้าน” → การ์ด “🧑‍🍳 ทะเบียนพนักงาน · ผู้ทำรายการ”','เพิ่ม/ลบรายชื่อพนักงาน และก๊อป/แชร์ “ลิงก์พนักงาน” ได้จากในนี้','พนักงานที่เปิดลิงก์ในไลน์ตัวเอง → ชื่อขึ้นอัตโนมัติ (ผูกครั้งแรก เจ้าของอนุมัติ)','เครื่องกลางหน้าร้าน → มีแถบด้านบนให้พนักงานเลือกชื่อตัวเองจากทะเบียนก่อนขาย','ชื่อที่เลือกจะเป็น “ผู้ทำรายการ” ในบิลและการนำเงินเข้า-ออก','รายชื่อ sync ข้ามเครื่องให้อัตโนมัติผ่านระบบคลาวด์'],
            en:['“Store” → “🧑‍🍳 Staff registry” card','Add/remove staff and copy/share the staff link from here','Staff on their own LINE → auto-named (first bind, owner approves)','On a shared counter device → a top bar lets staff pick their name before selling','The chosen name is stamped as the operator on bills and cash in/out','The roster syncs across devices via the cloud']} },
      { ic:IC.receipt, h:{th:'ใบเสนอราคา (คิด/ไม่คิด VAT)',en:'Quotation (VAT / no-VAT)'},
        s:{th:['แท็บ “ร้านค้า” → “ใบเสนอราคา”','ใส่ชื่อลูกค้า วันที่ และจำนวนวันยืนราคา','เพิ่มรายการ “จากเมนู” (แตะเลือกได้เลย) หรือ “รายการเอง” · แก้ชื่อ/จำนวน/ราคาได้','เปิดสวิตช์ VAT 7% ถ้าต้องการ (บวกบนยอดรวม) หรือปิดเพื่อเสนอราคาสุทธิ','กด “พิมพ์ / บันทึก PDF” → เลือกเครื่องพิมพ์ หรือ “Save as PDF” ในหน้าต่างพิมพ์'],
            en:['“Store” → “Quotation”','Enter customer, date and validity days','Add items “From menu” (tap to add) or “Custom” · edit name/qty/price','Toggle VAT 7% (added on subtotal) or leave off for a net quote','Tap “Print / Save PDF” → pick a printer or “Save as PDF” in the dialog']} },
      { ic:IC.qr, h:{th:'ตั้งค่า QR รับเงิน',en:'Payment & QR'},
        s:{th:['แท็บ “ร้านค้า” → “ตั้งค่ารับเงิน · QR พร้อมเพย์”','ใส่เบอร์พร้อมเพย์/เลขบัญชี ดูตัวอย่าง QR ได้เลย','เปิด/ปิดช่องทางที่รับ และตรวจสลิปอัตโนมัติ','กด “↗ แชร์ QR ร้าน” ใต้ตัวอย่าง QR → ส่งรูป QR พร้อมเพย์ให้ลูกค้าทางไลน์/แชต หรือบันทึกเป็นรูป'],
            en:['“Store” → “Payment & QR settings”','Enter PromptPay/account, preview the QR','Toggle accepted methods and auto slip check','Tap “Share shop QR” under the preview to send your PromptPay QR via LINE/chat or save it']} },
      { ic:IC.star, h:{th:'ระบบสมาชิก & แต้ม',en:'Members & loyalty'},
        s:{th:['แท็บ “ร้านค้า” → “สมาชิก · สะสมแต้ม”','ลูกค้าได้ 1 แต้มทุกยอด ฿25 · 100 แต้ม = ส่วนลด ฿20','ดูระดับสมาชิก (ทอง/เงิน/ทั่วไป) และแต้มสะสม'],
            en:['“Store” → “Members · loyalty”','1 point per ฿25 · 100 pts = ฿20 off','See tiers (Gold/Silver/Member) and points']} },
      { ic:IC.wallet, h:{th:'แพ็กเกจ & ต่ออายุการใช้งาน',en:'Plan & renewal'},
        s:{th:['แท็บ “ร้านค้า” → “แพ็กเกจ · ต่ออายุการใช้งาน”','ทดลองฟรี 1 เดือน แล้วเลือกรายเดือน (฿299) หรือรายปี (฿2,990)','ต่ออายุเองด้วย QR/โอน หรือผูกบัตรตัดเงินอัตโนมัติทุกงวด'],
            en:['“Store” → “Plan · renew app”','Free 30-day trial, then Monthly (฿299) or Yearly (฿2,990)','Renew manually via QR/transfer, or link a card for auto-debit']} },
      { ic:IC.receipt, h:{th:'ตรวจสลิปโอน (เฉพาะลูกค้าแนบเอง)',en:'Slip check (customer-attached only)'},
        s:{th:['ขายหน้าร้าน/คีย์เอง จบบิลด้วยพร้อมเพย์/โอน = ยืนยันรับเงินตอนจบบิลแล้ว → เข้าออเดอร์เลย ไม่ตรวจสลิปซ้ำ','บิลเงินสดหน้าร้าน = “รับเงินแล้ว” ทันที','หน้าออเดอร์จะขอ “ตรวจสลิป” เฉพาะออเดอร์ที่ลูกค้าแนบสลิปมาเอง (สั่งผ่านไลน์)','ตรวจยอดในสลิปให้ตรง แล้วกด “ยืนยันรับเงิน · รับออเดอร์” หรือกด “สลิปไม่ถูก” ให้ลูกค้าส่งใหม่'],
            en:['In-store/keyed sales paid by PromptPay/transfer are confirmed at checkout → no re-check on the orders page','In-store cash bills are marked “Paid” instantly','The orders page asks to “verify slip” only for customer-attached slips (LINE orders)','Match the amount then “Confirm & accept”, or “Reject” to ask for a new slip']} },
      { ic:IC.star, h:{th:'ชวนเพื่อนมาใช้ KaiDee POS (แนะนำเพื่อน)',en:'Invite a friend to KaiDee POS'},
        s:{th:['หน้าหลัก (แท็บ “หน้าหลัก”) เลื่อนลงล่างสุด → การ์ด “🎁 ชวนเพื่อนมาใช้ KaiDee POS”','กด “คัดลอก” ก๊อปลิงก์แอป หรือ “↗ แชร์ให้เพื่อน” ส่งเข้าไลน์/แชต','กด “▦ QR” โชว์ QR ของแอป ให้เพื่อนสแกนสมัครได้เลย','ลิงก์เปิดหน้าแรกของแอป (สมัคร/เลือกบทบาท) — เพื่อนเปิดร้านของตัวเองได้ทันที'],
            en:['Home tab → scroll to the bottom → “🎁 Invite a friend” card','“Copy” the app link or “↗ Share” via LINE/chat','“▦ QR” shows the app QR for friends to scan & sign up','The link opens the app landing (sign-up) so they can open their own shop']} },
      { ic:IC.menu, h:{th:'ปุ่มเมนูลอย · ลากย้ายได้',en:'Floating menu · drag to move'},
        s:{th:['ปุ่มกลมมุมล่างขวา = เมนูลัด (สลับบทบาท · ไทย/EN · คู่มือ)','แตะ = เปิด/ปิดเมนู · ลากค้าง = ย้ายไปวางตรงไหนก็ได้','ถ้าปุ่มบังปุ่มใช้งาน ลากไปไว้มุมอื่นได้ · ระบบจำตำแหน่งไว้ให้'],
            en:['The round button (bottom-right) is the quick menu (role · TH/EN · guide)','Tap = open/close · press & drag = move it anywhere','If it covers a button, drag it aside · the position is remembered']} },
      { ic:IC.x, h:{th:'ล้างข้อมูล · เริ่มร้านใหม่',en:'Reset · start new shop'},
        s:{th:['แท็บ “ร้านค้า” เลื่อนลงล่างสุด → “ล้างข้อมูล · เริ่มร้านใหม่”','ล้างทุกอย่าง (เมนู ยอดขาย สต๊อก เงินสด สมาชิก) กลับเป็นค่าเริ่มต้น','มีถามยืนยันก่อน · เหมาะกับตอนตั้งร้านใหม่หรือเริ่มใช้จริง'],
            en:['“Store” → scroll to the bottom → “Reset · start new shop”','Wipes everything (menu, sales, stock, cash, members) to defaults','Asks to confirm first · use when setting up a fresh shop']} },
    ] },
  { role:'customer', ic:IC.bag, tone:'var(--line-green)', bg:'#E5F7EC',
    title:{th:'สำหรับลูกค้า (ผ่านไลน์)',en:'For Customers (LINE)'},
    topics:[
      { ic:IC.menu, h:{th:'สั่งอาหาร',en:'Order food'},
        s:{th:['เปิดร้านผ่านไลน์ เลือกหมวดและแตะเมนู','กดจำนวนแล้ว “ใส่ตะกร้า” ทำซ้ำได้หลายเมนู','ไปที่แท็บ “ตะกร้า” แล้วกด “ชำระเงิน”'],
            en:['Open the shop in LINE, pick a category & item','Choose quantity and “Add to cart”','Go to “Cart” and press “Checkout”']} },
      { ic:IC.moto, h:{th:'รับที่ร้าน หรือ เดลิเวอรี',en:'Pickup or delivery'},
        s:{th:['เลือก “ส่งเดลิเวอรี” หรือ “รับที่ร้าน”','ถ้าส่ง ใส่ที่อยู่ ค่าส่งคิดตามระยะทางอัตโนมัติ'],
            en:['Choose “Delivery” or “Pick up”','For delivery, add address — fee is by distance']} },
      { ic:IC.calendar, h:{th:'สั่งจองล่วงหน้า',en:'Pre-order'},
        s:{th:['ในหน้าชำระเงิน เลือกเวลาที่ต้องการ (หรือพรุ่งนี้)','ร้านจะเริ่มทำตามเวลาที่จองไว้'],
            en:['At checkout pick a time slot (or tomorrow)','The shop starts cooking at your chosen time']} },
      { ic:IC.wallet, h:{th:'ช่องทางจ่ายเงิน',en:'Payment'},
        s:{th:['พร้อมเพย์ QR / โอน+แนบสลิป / เงินสด / เก็บปลายทาง','เลือกพร้อมเพย์จะได้ QR ให้สแกนจ่ายทันที'],
            en:['PromptPay QR / transfer / cash / COD','PromptPay gives a QR to scan right away']} },
      { ic:IC.pin, h:{th:'ติดตามออเดอร์',en:'Track your order'},
        s:{th:['แท็บ “ออเดอร์” แตะออเดอร์เพื่อดูสถานะแบบเรียลไทม์','เห็นขั้นตอน: ร้านรับ → ปรุง → ไรเดอร์ส่ง → ถึงมือ'],
            en:['“Orders” → tap an order for live status','Steps: received → cooking → on the way → delivered']} },
      { ic:IC.star, h:{th:'บัตรสมาชิก & แต้ม',en:'Membership'},
        s:{th:['แท็บ “ฉัน” ดูบัตรสมาชิกและแต้มสะสม','สะสมแต้มทุกครั้งที่สั่ง แลกส่วนลดได้'],
            en:['“Me” shows your card and points','Earn points each order, redeem for discounts']} },
    ] },
  { role:'rider', ic:IC.moto, tone:'var(--ink)', bg:'#ECEEED',
    title:{th:'สำหรับไรเดอร์ / คนขับ',en:'For Riders'},
    topics:[
      { ic:IC.edit, h:{th:'สมัครเป็นไรเดอร์ (มาตรฐาน Grab)',en:'Apply as a rider (Grab standard)'},
        s:{th:['ไปแท็บ “ฉัน” → “สมัครเป็นไรเดอร์”','กรอกข้อมูลส่วนตัว, รถ, บัญชีรับเงิน และผู้ติดต่อฉุกเฉิน','อัปโหลดเอกสาร: บัตร ปชช., ใบขับขี่, ทะเบียนรถ, พ.ร.บ., เซลฟี่คู่บัตร, หน้าบัญชี','กดส่งใบสมัคร ทีมงานตรวจสอบภายใน 1–3 วัน'],
            en:['“Me” → “Become a rider”','Fill personal, vehicle, payout & emergency info','Upload docs: ID, licence, registration, insurance, selfie, bank book','Submit — reviewed within 1–3 business days']} },
      { ic:IC.moto, h:{th:'รับงานส่ง',en:'Accept jobs'},
        s:{th:['เปิดสถานะ “ออนไลน์” มุมขวาบนเพื่อรับงาน','แท็บ “งานใหม่” โชว์งานรอบตัว พร้อมเส้นทางรับ-ส่ง','กด “รับงานนี้” งานจะย้ายไปแท็บ “งานของฉัน”'],
            en:['Switch “Online” to receive jobs','“New jobs” shows nearby jobs with route','“Accept job” moves it to “My jobs”']} },
      { ic:IC.wallet, h:{th:'ค่าเที่ยวคิดยังไง',en:'How fares work'},
        s:{th:['คิดแบบ Grab: ค่าเริ่มต้น ฿10 (รวม 1 กม.แรก)','+ ฿6.5 ต่อกิโลเมตรถัดไป · ขั้นต่ำ ฿15','เห็นค่ารอบและระยะทางบนการ์ดงานก่อนรับ'],
            en:['Grab-style: ฿10 base (incl. first 1 km)','+ ฿6.5 per extra km · minimum ฿15','Fare and distance shown before you accept']} },
      { ic:IC.check, h:{th:'ส่งงานให้สำเร็จ',en:'Complete a delivery'},
        s:{th:['ที่แท็บ “งานของฉัน” กด “ส่งสำเร็จ” เมื่อถึงมือลูกค้า','ถ้าเป็นเก็บปลายทาง อย่าลืมเก็บเงินตามยอด'],
            en:['In “My jobs”, tap “Complete” on arrival','For COD, collect the shown amount']} },
      { ic:IC.chart, h:{th:'ดูรายได้',en:'Earnings'},
        s:{th:['แท็บ “รายได้” สรุปรายได้วันนี้ จำนวนรอบ และโบนัส','ครบ 3 รอบรับโบนัสเพิ่ม'],
            en:['“Earnings” shows today’s income, trips & bonus','3+ trips unlock a bonus']} },
    ] },
];

function HelpOverlay({ onClose, scope }){
  const { t, lang } = useT();
  // scope: 'customer' | 'rider' → only that guide; 'merchant'/null → all
  const secs = (scope==='customer'||scope==='rider') ? HELP.filter(s=>s.role===scope) : HELP;
  const [open,setOpen] = hState(secs[0].role);
  const [topic,setTopic] = hState(null);
  const single = secs.length===1;

  return (
    <div style={{ position:'absolute', inset:0, zIndex:70, background:'var(--bg)', display:'flex', flexDirection:'column', animation:'kdFade .25s' }}>
      {/* header */}
      <div style={{ paddingTop:56, background:'var(--brand)', color:'#fff' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 18px 16px' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:22, fontWeight:700 }}>{lang==='th'?'คู่มือการใช้งาน':'User guide'}</div>
            <div style={{ fontSize:13, opacity:.8, marginTop:2 }}>{single ? (secs[0].title[lang]||secs[0].title.th) : (lang==='th'?'แตะหัวข้อเพื่อดูวิธีใช้ทีละส่วน':'Tap a topic for step-by-step help')}</div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'rgba(255,255,255,.22)', color:'#fff', width:38, height:38, borderRadius:999, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>{IC.x}</button>
        </div>
      </div>
      {/* role tabs (hidden when single scope) */}
      {!single && <div style={{ display:'flex', gap:8, overflowX:'auto', padding:'12px 16px', flexShrink:0 }}>
        {secs.map(sec=>{ const on=sec.role===open; return (
          <button key={sec.role} onClick={()=>{ setOpen(sec.role); setTopic(null); }} style={{ border:'none', cursor:'pointer', whiteSpace:'nowrap',
            padding:'9px 15px', borderRadius:999, fontFamily:'var(--font)', fontWeight:700, fontSize:13.5, display:'flex', alignItems:'center', gap:6,
            background: on?sec.tone:'#fff', color: on?'#fff':'var(--ink-2)', boxShadow: on?'none':'var(--shadow)' }}>
            {React.cloneElement(sec.ic,{size:16, color:'currentColor'})}{sec.title[lang]||sec.title.th}</button>
        );})}
      </div>}
      {/* topics */}
      <div className="kd-body" style={{ padding: single?'14px 16px 30px':'0 16px 30px' }}>
        {secs.filter(s=>s.role===open).map(sec=>(
          <div key={sec.role}>
            {sec.topics.map((tp,i)=>{ const isOpen=topic===i; return (
              <div key={i} className="kd-card kd-fadein" style={{ marginBottom:10, overflow:'hidden', animationDelay:`${i*0.03}s` }}>
                <button onClick={()=>setTopic(isOpen?null:i)} style={{ border:'none', background:'none', cursor:'pointer', width:'100%',
                  display:'flex', alignItems:'center', gap:13, padding:'15px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
                  <span style={{ width:38, height:38, borderRadius:11, background:sec.bg, color:sec.tone, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{React.cloneElement(tp.ic,{size:19})}</span>
                  <span style={{ flex:1, fontSize:15, fontWeight:700 }}>{tp.h[lang]||tp.h.th}</span>
                  <span style={{ color:'var(--ink-3)', transform:isOpen?'rotate(90deg)':'none', transition:'transform .2s' }}>{IC.chev}</span>
                </button>
                {isOpen && <div className="kd-fadein" style={{ padding:'0 16px 15px 67px' }}>
                  {tp.s[lang].map((step,si)=>(
                    <div key={si} style={{ display:'flex', gap:10, marginBottom:9 }}>
                      <span style={{ flexShrink:0, width:20, height:20, borderRadius:999, background:sec.bg, color:sec.tone, fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{si+1}</span>
                      <span style={{ fontSize:13.5, color:'var(--ink-2)', lineHeight:1.5 }}>{step}</span>
                    </div>
                  ))}
                </div>}
              </div>
            );})}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { HELP, HelpOverlay });
