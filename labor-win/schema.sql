-- ============================================================
--  LABOR WIN — DB Schema (SQLite / Cloudflare D1 compatible)
--  ระบบบริหารวินแรงงานต่างด้าวในตลาดค้าส่ง · รันบน LINE OA
--  ทุกตารางใช้ได้กับ D1 (SQLite) และ Postgres (แก้ AUTOINCREMENT/ชนิดเล็กน้อย)
-- ============================================================

-- (1) ร้านค้า / ผู้จ้าง  — ผูก LINE + เลขแผง --------------------
CREATE TABLE IF NOT EXISTS shops (
  shop_id        TEXT PRIMARY KEY,              -- 'SHP_xxxx'
  line_user_id   TEXT UNIQUE,                   -- LINE userId จาก LIFF
  stall_no       TEXT NOT NULL,                 -- เลขแผง/ล็อกในตลาด
  name           TEXT NOT NULL,
  phone          TEXT,
  saas_plan      TEXT NOT NULL DEFAULT 'p299',  -- p299 | p599 | p999
  plan_expires_at TEXT,                         -- ISO date; กันใช้เกินอายุแพ็ก
  status         TEXT NOT NULL DEFAULT 'active',-- active | suspended
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- (2) หัวหน้าวิน  — เจ้าของสีเสื้อ / ตั้งค่า "หน้ารับเงิน" เอง -------
CREATE TABLE IF NOT EXISTS win_leaders (
  win_id         TEXT PRIMARY KEY,              -- 'WIN_red'
  name           TEXT NOT NULL,
  vest_color     TEXT NOT NULL,                 -- 'red' | 'blue' | 'green' ...
  line_user_id   TEXT UNIQUE,
  -- ⭐ หน้ารับเงิน: หัวหน้าวินตั้งค่าเองในแอป (ไม่ต้องผูกธนาคาร/LINE bank)
  pay_mode       TEXT NOT NULL DEFAULT 'promptpay_direct', -- cash | promptpay_direct | prepaid_wallet
  promptpay_id   TEXT,                          -- เบอร์/เลขบัตร ปชช. PromptPay รับค่าหัวคิวตรง
  promptpay_name TEXT,                          -- ชื่อบัญชีโชว์บน QR
  require_slip   INTEGER NOT NULL DEFAULT 0,    -- 1 = บังคับแนบสลิปตอนยืนยันโอน
  bank_account   TEXT,                          -- (ออปชัน) บัญชีถอน กรณีใช้ prepaid_wallet
  wallet_balance INTEGER NOT NULL DEFAULT 0,    -- (ออปชัน) ยอดสะสม เฉพาะโหมด prepaid_wallet
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- (3) แรงงาน  — TH/MY/KH · prepaid wallet · ผูกวิน --------------
CREATE TABLE IF NOT EXISTS workers (
  worker_id      TEXT PRIMARY KEY,              -- 'WKR_xxxx'
  line_user_id   TEXT UNIQUE,
  name           TEXT NOT NULL,
  nationality    TEXT NOT NULL DEFAULT 'MY',    -- TH | MY | KH
  lang           TEXT NOT NULL DEFAULT 'my',    -- th | my | km  (ภาษา UI)
  work_permit_no TEXT,                           -- เลข work permit
  win_id         TEXT NOT NULL REFERENCES win_leaders(win_id),
  vest_no        TEXT,                           -- เลขวินบนเสื้อสี
  wallet_balance INTEGER NOT NULL DEFAULT 0,     -- สตางค์ · prepaid เติมก่อนรับงาน
  status         TEXT NOT NULL DEFAULT 'available', -- available | working | paused | banned
  rating_avg     REAL NOT NULL DEFAULT 5.0,
  rating_count   INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workers_win ON workers(win_id, status);

-- (4) คิว  — ลำดับหมุนเวียนของแรงงานในแต่ละวิน -------------------
--  หนึ่งแรงงาน = หนึ่งแถวคิว · position น้อย = ได้งานก่อน
CREATE TABLE IF NOT EXISTS queues (
  queue_id       TEXT PRIMARY KEY,
  win_id         TEXT NOT NULL REFERENCES win_leaders(win_id),
  worker_id      TEXT NOT NULL UNIQUE REFERENCES workers(worker_id),
  position       INTEGER NOT NULL,              -- ลำดับในคิวของวินนั้น
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_queue_order ON queues(win_id, position);

-- (5) งาน  — คำเรียกจากร้าน · จับคู่ · ปิดงาน --------------------
CREATE TABLE IF NOT EXISTS jobs (
  job_id         TEXT PRIMARY KEY,              -- 'JOB_xxxx'
  shop_id        TEXT NOT NULL REFERENCES shops(shop_id),
  win_id         TEXT REFERENCES win_leaders(win_id), -- สีวินที่ร้านเรียก
  job_type       TEXT NOT NULL,                 -- 'unload' | 'carry' | 'pack' ...
  standard_price INTEGER NOT NULL,              -- ราคากลาง (สตางค์) จ่ายสดหน้าร้าน
  commission_rate REAL NOT NULL DEFAULT 0.10,   -- % ค่าหัวคิว (ของราคากลาง)
  commission_amt INTEGER,                        -- = round(standard_price*rate) บันทึกตอนปิดงาน
  commission_status TEXT DEFAULT 'pending',      -- pending | paid  (แรงงานโอนค่าหัวคิวเข้าวินแล้วหรือยัง)
  commission_slip TEXT,                           -- URL สลิปโอน (ถ้าหัวหน้าวินตั้ง require_slip)
  commission_paid_at TEXT,
  worker_id      TEXT REFERENCES workers(worker_id),
  status         TEXT NOT NULL DEFAULT 'open',  -- open|offered|accepted|done|cancelled|expired
  offered_to     TEXT,                          -- worker_id ที่กำลังยิง offer อยู่
  offer_expires_at TEXT,                        -- +60s; เกินแล้วส่งคิวถัดไป
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at    TEXT,
  done_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, win_id);

-- (6) เดินบัญชีกระเป๋าเงิน  — polymorphic (worker | win) ---------
CREATE TABLE IF NOT EXISTS wallet_txns (
  txn_id         TEXT PRIMARY KEY,
  owner_type     TEXT NOT NULL,                 -- 'worker' | 'win'
  owner_id       TEXT NOT NULL,                 -- worker_id หรือ win_id
  type           TEXT NOT NULL,                 -- topup|commission_debit|commission_credit|withdraw|refund
  amount         INTEGER NOT NULL,              -- +เข้า / -ออก (สตางค์)
  balance_after  INTEGER NOT NULL,
  ref_job_id     TEXT REFERENCES jobs(job_id),
  note           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_txn_owner ON wallet_txns(owner_type, owner_id, created_at);

-- (7) รีวิว / favorite / blacklist  — ร้านให้คะแนนแรงงาน --------
CREATE TABLE IF NOT EXISTS reviews (
  review_id      TEXT PRIMARY KEY,
  job_id         TEXT NOT NULL REFERENCES jobs(job_id),
  shop_id        TEXT NOT NULL REFERENCES shops(shop_id),
  worker_id      TEXT NOT NULL REFERENCES workers(worker_id),
  rating         INTEGER NOT NULL,              -- 1..5
  is_favorite    INTEGER NOT NULL DEFAULT 0,    -- ร้านกดชอบ = เรียกซ้ำได้ง่าย
  is_blacklist   INTEGER NOT NULL DEFAULT 0,    -- ห้ามจับคู่ร้านนี้อีก
  comment        TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_review_worker ON reviews(worker_id);

-- (8) การจ่าย SaaS ของร้าน (เข้าผู้พัฒนา 100%) ------------------
CREATE TABLE IF NOT EXISTS saas_payments (
  pay_id         TEXT PRIMARY KEY,
  shop_id        TEXT NOT NULL REFERENCES shops(shop_id),
  plan           TEXT NOT NULL,
  amount         INTEGER NOT NULL,
  period_start   TEXT NOT NULL,
  period_end     TEXT NOT NULL,
  method         TEXT,                          -- promptpay | card
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
--  ความสัมพันธ์ (relationships) โดยสรุป
--  shops       1 ── N jobs
--  win_leaders 1 ── N workers          (สีเสื้อเดียวกัน)
--  win_leaders 1 ── N queues           (คิวหมุนเวียนของวินนั้น)
--  workers     1 ── 1 queues           (แต่ละคนมีตำแหน่งคิวเดียว)
--  jobs        N ── 1 workers          (งานถูกจับให้แรงงานคนเดียว)
--  jobs        1 ── 1 reviews          (ปิดงานแล้วรีวิวได้)
--  wallet_txns N ── 1 (worker | win)   (polymorphic owner)
-- ============================================================
