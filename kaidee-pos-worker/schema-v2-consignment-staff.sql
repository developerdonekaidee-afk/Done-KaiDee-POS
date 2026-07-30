-- ═══════════════════════════════════════════════════════════════════════════
-- kaidee-pos — SCHEMA v2 (PROPOSED · ยังไม่ deploy)
-- ออกแบบตามสเปก 22 ก.ค. 2026: พนักงาน PIN · inventory log · ขายฝาก · แต้ม · คืนเงิน · GP/settlement · discrepancy
-- ทุกตารางผูก shop_id (multi-tenant) · เงิน/แต้มเก็บ integer (สตางค์/แต้ม) กันทศนิยมเพี้ยน
-- ล้อ D1/SQLite (Cloudflare Worker) — ใช้ ALTER idempotent (ensureXcols) กับตารางที่มีอยู่แล้ว
-- ═══════════════════════════════════════════════════════════════════════════

-- ── (ข้อ4) ทะเบียนสิทธิ์พนักงาน — รองรับ 2 ทาง: LINE LIFF (สมัครรออนุมัติ) + เว็บ (PIN ตั้งล่วงหน้า) ──
CREATE TABLE IF NOT EXISTS staff (
  shop_id     TEXT NOT NULL,
  id          TEXT NOT NULL,               -- 'st'+ts (เว็บ) หรือ LINE userId
  name        TEXT NOT NULL,               -- ชื่อ/ชื่อเล่นที่ใช้ทำงาน (ไม่ใช่ชื่อโปรไฟล์ LINE)
  phone       TEXT,
  pin_hash    TEXT,                        -- sha256(PIN 4-6 หลัก) · เว็บล็อกอินด้วย PIN · null=สมัครผ่าน LINE
  line_user   TEXT,                        -- ผูก LINE userId (ทางสมัครผ่าน LIFF)
  role        TEXT DEFAULT 'staff',        -- 'staff' | 'manager' (owner แยก = owner_line บน shops)
  status      TEXT DEFAULT 'pending',      -- 'active' | 'pending' (LINE สมัครเองรออนุมัติ) | 'disabled'
  created_at  INTEGER, updated_at INTEGER,
  PRIMARY KEY (shop_id, id)
);
CREATE INDEX IF NOT EXISTS idx_staff_line ON staff(shop_id, line_user);
-- หมายเหตุ: audit ชื่อคนทำรายการห้ามส่งผ่าน frontend — worker resolve staff จาก PIN/LINE token แล้วเขียน
-- orders.accepted_by / verified_by (มีคอลัมน์แล้ว) ควร FK อ้าง staff.id · ใบเสร็จลูกค้าโชว์ staff.name เท่านั้น

-- ── (ข้อ5-stock, pasted#4) ประวัติธุรกรรมสต๊อก — แหล่งความจริงเดียวของ movement + Running Balance ──
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id            TEXT PRIMARY KEY,          -- 'it'+ts
  shop_id       TEXT NOT NULL,
  location_id   TEXT DEFAULT 'main',       -- คลังหลัก / สาขา / จุดขายฝาก (FK locations)
  rm_id         TEXT NOT NULL,             -- FK raw.id (วัตถุดิบ/แพ็ค)
  movement_type TEXT NOT NULL,             -- GOODS_RECEIPT | SALE_USED | WASTAGE | ADJUST | TRANSFER | CONSIGN_SALE
  qty           REAL NOT NULL,             -- + รับเข้า · − ตัดออก (หน่วย tracking ของ rm)
  ref_type      TEXT,                      -- 'purchase' | 'sale' | 'manual' | 'consignment'
  ref_id        TEXT,                      -- เลขเอกสาร/ออเดอร์อ้างอิง (กดดูบิลต้นทางได้)
  reason        TEXT,                      -- เหตุผลสั้นๆ (Quick Adjust: "ของเสีย" ฯลฯ)
  handled_by    TEXT,                      -- staff.id ('system' = อัตโนมัติ)
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invtx ON inventory_transactions(shop_id, rm_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invtx_type ON inventory_transactions(shop_id, movement_type, created_at);
-- Running Balance (SQL window fn) — ไล่ยอดคงเหลือสะสมตามเวลาจริง:
--   SELECT *, SUM(qty) OVER (PARTITION BY rm_id ORDER BY created_at
--            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
--   FROM inventory_transactions WHERE shop_id=? AND created_at BETWEEN ? AND ? ORDER BY created_at DESC;
-- (opening balance = ตั้งด้วย movement_type='OPENING' 1 แถวตอน migrate จาก raw.stock ปัจจุบัน)

-- ── (ข้อ5, pasted#1) ซัพพลายเออร์ (รับฝากขาย inbound) ──
CREATE TABLE IF NOT EXISTS vendors (
  shop_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT,
  bank TEXT, acct_no TEXT, acct_name TEXT, note TEXT,
  created_at INTEGER, PRIMARY KEY (shop_id, id)
);

-- ── (ข้อ5, pasted#4-location) พิกัดคลัง/สาขา/จุดฝากขาย (ส่งฝากขาย outbound) ──
CREATE TABLE IF NOT EXISTS locations (
  shop_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL,
  kind TEXT DEFAULT 'store',               -- 'store'(หลัก) | 'branch' | 'consign_out'(ที่ไปฝากขาย)
  address TEXT, lat REAL, lng REAL, partner_name TEXT, partner_phone TEXT,
  created_at INTEGER, PRIMARY KEY (shop_id, id)
);

-- ── (ข้อ5) คลังสินค้าขายฝาก — แยกขาดจาก raw/menu หลัก (ตัดยอดจากคลังนี้เท่านั้น ห้ามปน) ──
CREATE TABLE IF NOT EXISTS consignment_stock (
  shop_id     TEXT NOT NULL, id TEXT NOT NULL,
  direction   TEXT NOT NULL,               -- 'inbound'(รับฝาก) | 'outbound'(ส่งไปฝาก)
  name        TEXT NOT NULL, sku TEXT,
  vendor_id   TEXT,                        -- inbound → FK vendors
  location_id TEXT,                        -- outbound → FK locations
  price       INTEGER,                     -- ราคาขายหน้าร้าน (สตางค์)
  -- โมเดลจ่ายเงิน (Payment & Settlement Configuration) — เลือกได้ต่อรายสินค้า:
  settle_model TEXT DEFAULT 'per_sale',    -- 'per_sale' | 'wholesale' | 'rental'
  share_pct    REAL,                       -- per_sale: % ที่ร้านหักไว้ (เช่น 20 = ร้านเก็บ 20% คืน vendor 80%)
  cost_wholesale INTEGER,                  -- wholesale: ราคาทุนซื้อขาด (สตางค์) → คิด GP
  rental_fee   INTEGER,                    -- rental: ค่าเช่าพื้นที่/เดือน (สตางค์) = Fixed Income
  stock        REAL DEFAULT 0, unit TEXT DEFAULT 'pcs', low REAL DEFAULT 0,
  active        INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER,
  PRIMARY KEY (shop_id, id)
);
-- ขายสินค้าฝาก → inventory_transactions.movement_type='CONSIGN_SALE' (location_id ชี้จุดฝาก) กันปนคลังหลัก

-- ── (ข้อ5) เอกสารใบสำคัญขายฝาก + การเคลียร์เงิน ──
CREATE TABLE IF NOT EXISTS consignment_documents (
  id TEXT PRIMARY KEY, shop_id TEXT NOT NULL,
  doc_type TEXT,                           -- 'receive'(รับฝาก) | 'return'(คืน) | 'settlement'(เคลียร์เงิน)
  direction TEXT, vendor_id TEXT, location_id TEXT,
  period_from TEXT, period_to TEXT,        -- รอบเคลียร์
  lines TEXT,                              -- JSON [{stockId, qtySold, gross, shopCut, payout}]
  gross_total INTEGER, payout_total INTEGER, status TEXT DEFAULT 'open',
  slip TEXT, note TEXT, created_at INTEGER, settled_at INTEGER
);

-- ── (pasted-CRM) ประวัติแต้มสมาชิก — ได้/ตัด/ปรับมือ (แทนการ derive จากบิล) ──
CREATE TABLE IF NOT EXISTS point_transactions (
  id TEXT PRIMARY KEY, shop_id TEXT NOT NULL,
  member_id TEXT NOT NULL,                 -- FK members.id (line_user_id หรือ m<เบอร์>)
  kind TEXT,                               -- 'earn' | 'redeem' | 'manual' | 'expire'
  points INTEGER NOT NULL,                 -- + ได้ · − ตัด
  ref_type TEXT, ref_id TEXT,              -- 'order'/'sale' + id อ้างอิง
  reason TEXT, handled_by TEXT,            -- staff.id (manual adjust)
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pttx ON point_transactions(shop_id, member_id, created_at);

-- ── (ข้อ2) บัญชีรับเงินคืนของลูกค้า (PDPA — ลบได้) ──
CREATE TABLE IF NOT EXISTS refund_accounts (
  shop_id TEXT NOT NULL, member_id TEXT NOT NULL,  -- LINE userId หรือ guest key
  bank TEXT, acct_no TEXT, acct_name TEXT, phone TEXT,
  saved INTEGER DEFAULT 1, updated_at INTEGER,
  PRIMARY KEY (shop_id, member_id)
);

-- ═══ ALTER ตารางเดิม (idempotent · ทำใน ensureXcols) ═══
-- orders: audit + discrepancy + confirm-first (บางส่วนมีแล้ว: accepted_by/verified_by/pay_after_confirm)
--   ALTER orders ADD COLUMN pay_status TEXT;          -- 'paid'|'paid_discrepancy'|'payment_not_found'
--   ALTER orders ADD COLUMN verified_amount INTEGER;  -- ยอดจริงที่ได้รับ (สตางค์)
--   ALTER orders ADD COLUMN verify_diff INTEGER;      -- ส่วนต่าง (+/-)
--   ALTER orders ADD COLUMN transaction_date TEXT;    -- ⭐ date-lock: วันเกิดบิลจริง (ล็อกรายได้)
--   ALTER orders ADD COLUMN settlement_date TEXT;     -- ⭐ วันเงินเข้าจริง (cash flow / bank recon)
-- sales: เช่นเดียวกัน (pay_status, verified_amount, transaction_date, settlement_date, gp_pct, platform)
-- shops: GP ต่อแพลตฟอร์ม → extra JSON { gp:{ grab:30, linemn:32, shopee:30 } } (มี extra อยู่แล้ว)
-- settings blob: { staffCanOpen, ownerPinHash, preorderOn, preorderNote, ridersComingSoon, payWorkflow, payMode }

-- ═══ ENDPOINTS ที่ต้องเพิ่ม (owner/role-gated) ═══
--  POST /staff (owner เพิ่ม) · PATCH /staff/:id (อนุมัติ/สิทธิ์) · POST /staff/login {name?,pin} | {line}
--  POST /inv-tx (บันทึก movement) · GET /reports/inv-tx?from&to&type&location (owner · window fn)
--  vendors/locations CRUD · consignment-stock CRUD · POST /consignment/settle
--  GET /reports/hourly?date= (แดชบอร์ดรายชั่วโมง stacked ตามช่องทาง)
