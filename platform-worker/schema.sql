-- platform-worker — D1 schema (Market · Fitness · Sponsor · Labor Win · Platform)
-- Worker สร้างตารางเองอัตโนมัติตอนถูกเรียกครั้งแรก (ensureSchema) — ไฟล์นี้ไว้รันมือถ้าต้องการ
--
-- วิธีรัน (จากเครื่องที่ติดตั้ง wrangler):
--   npx wrangler d1 create platform            # ครั้งแรก สร้างฐานข้อมูล → เอา database_id ไปใส่ wrangler.toml
--   npx wrangler d1 execute platform --remote --file=platform-worker/schema.sql
-- หรือ Cloudflare dashboard → D1 → platform → Console → วางทั้งไฟล์

-- ── TENANT REGISTRY ── (1 แถว = 1 ร้าน/ตลาด/ยิม/สปอนเซอร์ · type = market|fitness|sponsor|laborwin|platform)
CREATE TABLE IF NOT EXISTS bizes (
  id         TEXT PRIMARY KEY,
  type       TEXT,
  name       TEXT,
  owner_line TEXT,
  extra      TEXT,          -- JSON (ข้อมูลเสริมของ tenant)
  created_at INTEGER,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_bizes_type  ON bizes(type);
CREATE INDEX IF NOT EXISTS idx_bizes_owner ON bizes(owner_line);

-- ── DOCUMENT STORE ── (JSON blob ก้อนเดียวต่อ key ต่อ tenant — sync ทั้งก้อนข้ามเครื่อง)
--   doc_key ที่ใช้จริง: fitness · market · laborwin · sponsor_entitlement · sponsor_coupons
--                       · wallet · stats · control  (สองก้อนหลังใช้ biz='platform')
CREATE TABLE IF NOT EXISTS docs (
  biz_id     TEXT NOT NULL,
  doc_key    TEXT NOT NULL,
  data       TEXT,          -- JSON blob
  rev        INTEGER DEFAULT 1,   -- เลข revision (optimistic concurrency)
  updated_at INTEGER,
  updated_by TEXT,
  PRIMARY KEY (biz_id, doc_key)
);

-- ── COLLECTION STORE ── (append/list: ledger, transactions, jobs, bookings ฯลฯ)
CREATE TABLE IF NOT EXISTS records (
  biz_id     TEXT NOT NULL,
  coll       TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       TEXT,          -- JSON
  created_at INTEGER,
  updated_at INTEGER,
  deleted    INTEGER DEFAULT 0,   -- soft delete → sync การลบข้ามเครื่อง
  PRIMARY KEY (biz_id, coll, id)
);
CREATE INDEX IF NOT EXISTS idx_records ON records(biz_id, coll, updated_at);

-- ── ADMIN CONFIG ── (รหัสแอดมิน hash ฯลฯ)
CREATE TABLE IF NOT EXISTS app_config (
  k TEXT PRIMARY KEY,
  v TEXT
);
