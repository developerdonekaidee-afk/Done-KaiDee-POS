-- kaidee-pos — D1 migration สำหรับ ISOLATION (รันครั้งเดียว)
-- วิธีรัน (จากเครื่องที่ติดตั้ง wrangler):
--   npx wrangler d1 execute kaidee --remote --file=kaidee-pos-worker/schema.sql
-- หรือ Cloudflare dashboard → D1 → kaidee → Console → วางทีละบรรทัด
--
-- หมายเหตุ: ตาราง shops ต้องมีคอลัมน์ owner_line อยู่แล้ว (worker INSERT/SELECT ใช้)
-- ถ้ายังไม่มี ให้รันบรรทัด ALTER ก่อน (ถ้ามีอยู่แล้วจะ error "duplicate column" — ข้ามได้)

-- ALTER TABLE shops ADD COLUMN owner_line TEXT;   -- (uncomment ถ้ายังไม่มีคอลัมน์นี้)

-- index: เร่ง GET /shops/by-owner?line=  (หาร้านของเจ้าของ / กันสมัครซ้ำ)
CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_line);

-- extended shop fields (lat/lng/map/week/hoursMode/pause/delivery/features) เก็บเป็น JSON
-- ถ้ามีคอลัมน์แล้วจะ error "duplicate column" — ข้ามได้
ALTER TABLE shops ADD COLUMN extra TEXT;

-- ── SALES (บิลหน้าขาย POS · แยกจากตาราง orders ที่เป็นคิวออเดอร์ลูกค้า) ──
CREATE TABLE IF NOT EXISTS sales (
  shop_id    TEXT NOT NULL,
  id         TEXT NOT NULL,
  no         INTEGER,
  date       TEXT,
  channel    TEXT,
  pay        TEXT,
  total      INTEGER,
  qnum       TEXT,          -- เลขออเดอร์/คิว ที่กรอกตอนจบบิล
  data       TEXT,          -- บิลเต็ม (items/cost/fee/platNo/verified ฯลฯ) เป็น JSON
  created_at INTEGER,
  PRIMARY KEY (shop_id, id)
);
CREATE INDEX IF NOT EXISTS idx_sales_shop ON sales(shop_id, created_at);

-- ออเดอร์: เก็บ "เรียกเก็บเงินสด" (callCash) ให้ sync ข้ามเครื่อง (ลูกค้ากด → ร้านได้เสียง/ป้าย)
-- ถ้ามีคอลัมน์แล้วจะ error "duplicate column" — ข้ามได้
ALTER TABLE orders ADD COLUMN call_cash INTEGER;
ALTER TABLE orders ADD COLUMN call_cash_at INTEGER;
