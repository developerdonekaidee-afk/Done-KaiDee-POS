/* ============================================================
 *  LABOR WIN — Queue Dispatch + Prepaid Wallet Settlement
 *  Node.js + Express (SQLite/better-sqlite3 · ย้ายเป็น D1 ได้)
 *  ------------------------------------------------------------
 *  โฟกัส 2 เรื่องหลักตามสเปก:
 *   (A) MATCHING / QUEUE DISPATCH — ร้านเรียกงาน → ดึงคิวที่ 1
 *       ของวินสีที่ขอ ที่ "ว่าง + wallet พอ" → ยิง LINE Flex →
 *       ปฏิเสธ/ไม่ตอบใน 60 วิ = ส่งคิวถัดไป + ดันคนเดิมท้ายคิว
 *   (B) ปิดงาน → หักค่าหัวคิว (prepaid) จาก wallet แรงงาน →
 *       โอนเข้า wallet หัวหน้าวิน 100% (แอปไม่หักจากค่าหัวคิว —
 *       รายได้แอป = ค่า SaaS รายเดือนของร้านเท่านั้น)
 * ============================================================ */
const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const db = new Database('labor-win.db');
db.pragma('journal_mode = WAL');

const app = express();
app.use(express.json());

/* ---- helpers ------------------------------------------------ */
const now = () => new Date().toISOString();
const uid = (p) => p + '_' + crypto.randomBytes(6).toString('hex');
const OFFER_TTL_MS = 60 * 1000;          // 60 วิ ต่อ 1 offer
const pushLine = require('./line-push'); // ห่อ LINE Messaging API (ดู tech stack)

/* ============================================================
 *  (A) DISPATCH — เลือกแรงงานคนถัดไปในคิวของวินที่ร้านขอ
 * ============================================================ */

// ดึง "ผู้สมัครที่เหมาะสมถัดไป" = คิวตำแหน่งน้อยสุดของวินสีนั้น
// ที่ status='available' และ wallet พอจ่ายค่าหัวคิวของงานนี้
function nextCandidate(winId, commissionAmt, excludeIds = []) {
  const placeholders = excludeIds.map(() => '?').join(',') || 'NULL';
  return db.prepare(`
    SELECT w.*, q.position
    FROM queues q
    JOIN workers w ON w.worker_id = q.worker_id
    WHERE q.win_id = ?
      AND w.status = 'available'
      AND w.wallet_balance >= ?
      AND w.worker_id NOT IN (${placeholders})
    ORDER BY q.position ASC
    LIMIT 1
  `).get(winId, commissionAmt, ...excludeIds);
}

// ดันแรงงานไปท้ายคิวของวินตัวเอง (position = max+1) — หมุนเวียนเป็นธรรม
const pushToBack = db.transaction((workerId, winId) => {
  const max = db.prepare('SELECT COALESCE(MAX(position),0) m FROM queues WHERE win_id=?').get(winId).m;
  db.prepare('UPDATE queues SET position=?, updated_at=? WHERE worker_id=?')
    .run(max + 1, now(), workerId);
});

// ยิง offer ให้แรงงาน 1 คน + ตั้งเวลาหมดอายุ 60 วิ
function offerToWorker(job, worker) {
  const exp = new Date(Date.now() + OFFER_TTL_MS).toISOString();
  db.prepare(`UPDATE jobs SET status='offered', offered_to=?, offer_expires_at=? WHERE job_id=?`)
    .run(worker.worker_id, exp, job.job_id);

  // ส่ง LINE Flex (พม่าคู่ไทย + ปุ่มเขียว/แดง) — ดู line-flex-new-job.json
  const flex = require('./line-flex-new-job')(job, worker);
  pushLine(worker.line_user_id, flex);

  // ตั้ง timer: ถ้ายังไม่ตอบใน 60 วิ → หมดสิทธิ์ → คนถัดไป
  setTimeout(() => expireOffer(job.job_id, worker.worker_id), OFFER_TTL_MS + 500);
}

// เดินคิวต่อ: หา candidate ถัดไป (กันคนที่เพิ่งปฏิเสธ/หมดเวลา)
function advanceQueue(jobId, excludeIds = []) {
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job || ['accepted', 'done', 'cancelled'].includes(job.status)) return;

  const commission = Math.round(job.standard_price * job.commission_rate);
  const cand = nextCandidate(job.win_id, commission, excludeIds);

  if (!cand) {
    // ไม่มีใครในวินนั้นว่าง/wallet พอ → คืนสถานะ open ให้ร้านเลือกวินอื่น
    db.prepare(`UPDATE jobs SET status='open', offered_to=NULL, offer_expires_at=NULL WHERE job_id=?`).run(jobId);
    pushLine(job._shop_line, { type: 'text',
      text: 'ยังไม่มีแรงงานว่างในวินสีนี้ — ลองเปลี่ยนสีวิน หรือรอสักครู่' });
    return;
  }
  offerToWorker(job, cand);
}

// offer หมดเวลา → ดันคนเดิมท้ายคิว → ส่งคิวถัดไป
function expireOffer(jobId, workerId) {
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job || job.status !== 'offered' || job.offered_to !== workerId) return; // ตอบไปแล้ว
  pushToBack(workerId, job.win_id);
  advanceQueue(jobId, [workerId]);
}

/* ---- ROUTE: ร้านเรียกงาน ------------------------------------ */
app.post('/jobs', (req, res) => {
  const { shop_id, win_id, job_type, standard_price } = req.body;
  const shop = db.prepare('SELECT * FROM shops WHERE shop_id=?').get(shop_id);
  if (!shop) return res.status(404).json({ error: 'shop_not_found' });
  // กันร้านที่แพ็ก SaaS หมดอายุ
  if (shop.plan_expires_at && shop.plan_expires_at < now())
    return res.status(402).json({ error: 'saas_expired' });

  const job = {
    job_id: uid('JOB'), shop_id, win_id, job_type,
    standard_price, commission_rate: 0.10, status: 'open', created_at: now(),
  };
  db.prepare(`INSERT INTO jobs
    (job_id,shop_id,win_id,job_type,standard_price,commission_rate,status,created_at)
    VALUES (@job_id,@shop_id,@win_id,@job_type,@standard_price,@commission_rate,@status,@created_at)`).run(job);

  job._shop_line = shop.line_user_id;
  advanceQueue(job.job_id);                 // เริ่มเดินคิวทันที
  res.json({ job_id: job.job_id, status: 'dispatching' });
});

/* ---- ROUTE: แรงงานกดรับ (ปุ่มเขียว) ------------------------- */
app.post('/jobs/:id/accept', (req, res) => {
  const { worker_id } = req.body;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(req.params.id);
  if (!job || job.status !== 'offered' || job.offered_to !== worker_id)
    return res.status(409).json({ error: 'offer_expired' }); // 60 วิ ผ่านไปแล้ว/ถูกแย่ง

  const tx = db.transaction(() => {
    db.prepare(`UPDATE jobs SET status='accepted', worker_id=?, accepted_at=? WHERE job_id=?`)
      .run(worker_id, now(), job.job_id);
    db.prepare(`UPDATE workers SET status='working' WHERE worker_id=?`).run(worker_id);
  });
  tx();
  const shop = db.prepare('SELECT * FROM shops WHERE shop_id=?').get(job.shop_id);
  pushLine(shop.line_user_id, { type: 'text', text: 'แรงงานรับงานแล้ว กำลังเดินทางไป' });
  res.json({ ok: true });
});

/* ---- ROUTE: แรงงานปฏิเสธ (ปุ่มแดง) → คิวถัดไปทันที ---------- */
app.post('/jobs/:id/decline', (req, res) => {
  const { worker_id } = req.body;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(req.params.id);
  if (!job || job.offered_to !== worker_id) return res.status(409).json({ error: 'not_offered' });
  pushToBack(worker_id, job.win_id);        // ดันคนที่ปฏิเสธไปท้ายคิว
  advanceQueue(job.job_id, [worker_id]);    // ส่งคิวถัดไป (ข้ามคนเดิม)
  res.json({ ok: true, next: true });
});

/* ============================================================
 *  (B) ปิดงาน → ค่าหัวคิวเข้าหัวหน้าวิน 100% — ตามโหมดที่หัวหน้าวินตั้งเอง
 *  • promptpay_direct (ค่าเริ่มต้น): แสดง QR PromptPay ของหัวหน้าวิน → แรงงานโอนตรง +
 *    กดยืนยัน/แนบสลิป (ไม่ต้องผูกธนาคาร/LINE bank — แอปไม่ถือเงิน)
 *  • prepaid_wallet (ออปชัน): หักจากกระเป๋าเติมล่วงหน้าของแรงงาน → เข้า wallet วิน
 *  ร้านสแกน QR ของแรงงานเพื่อยืนยันจบงาน (ค่าแรงจ่ายสดแยก)
 * ============================================================ */
const closeJob = db.transaction((job, rating, favorite, blacklist) => {
  const commission = Math.round(job.standard_price * job.commission_rate);
  const worker = db.prepare('SELECT * FROM workers WHERE worker_id=?').get(job.worker_id);
  const leader = db.prepare('SELECT * FROM win_leaders WHERE win_id=?').get(job.win_id);

  if (leader.pay_mode === 'prepaid_wallet') {
    // (ออปชัน) หักจาก wallet แรงงาน → เข้า wallet วิน 100% (อัตโนมัติ)
    if (worker.wallet_balance < commission) throw new Error('wallet_insufficient');
    const wBal = worker.wallet_balance - commission;
    db.prepare('UPDATE workers SET wallet_balance=? WHERE worker_id=?').run(wBal, worker.worker_id);
    db.prepare(`INSERT INTO wallet_txns (txn_id,owner_type,owner_id,type,amount,balance_after,ref_job_id,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(uid('TX'), 'worker', worker.worker_id, 'commission_debit', -commission, wBal, job.job_id, now());
    const lBal = leader.wallet_balance + commission;
    db.prepare('UPDATE win_leaders SET wallet_balance=? WHERE win_id=?').run(lBal, leader.win_id);
    db.prepare(`INSERT INTO wallet_txns (txn_id,owner_type,owner_id,type,amount,balance_after,ref_job_id,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(uid('TX'), 'win', leader.win_id, 'commission_credit', commission, lBal, job.job_id, now());
    db.prepare(`UPDATE jobs SET commission_status='paid', commission_paid_at=? WHERE job_id=?`).run(now(), job.job_id);
  }
  // โหมด promptpay_direct: ไม่แตะ wallet — commission_status='pending' รอแรงงานโอนตรงแล้วยืนยัน

  // ปิดงาน + คืนแรงงานเข้าคิว (ท้ายแถว) + รีวิว
  db.prepare(`UPDATE jobs SET status='done', commission_amt=?, done_at=? WHERE job_id=?`)
    .run(commission, now(), job.job_id);
  db.prepare('UPDATE workers SET status=? WHERE worker_id=?').run('available', worker.worker_id);
  pushToBack(worker.worker_id, job.win_id);
  if (rating != null) {
    db.prepare(`INSERT INTO reviews (review_id,job_id,shop_id,worker_id,rating,is_favorite,is_blacklist,created_at)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(uid('RV'), job.job_id, job.shop_id, worker.worker_id, rating, favorite ? 1 : 0, blacklist ? 1 : 0, now());
    const agg = db.prepare('SELECT AVG(rating) a, COUNT(*) c FROM reviews WHERE worker_id=?').get(worker.worker_id);
    db.prepare('UPDATE workers SET rating_avg=?, rating_count=? WHERE worker_id=?')
      .run(agg.a, agg.c, worker.worker_id);
  }
  return { commission, commission_status: db.prepare('SELECT commission_status FROM jobs WHERE job_id=?').get(job.job_id).commission_status };
});

// ร้านสแกน QR ของแรงงาน → ยืนยันจบงาน
app.post('/jobs/:id/complete', (req, res) => {
  const { rating, favorite, blacklist } = req.body;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(req.params.id);
  if (!job || job.status !== 'accepted') return res.status(409).json({ error: 'bad_state' });
  try {
    const r = closeJob(job, rating, favorite, blacklist);
    const leader = db.prepare('SELECT pay_mode,promptpay_id,promptpay_name,require_slip FROM win_leaders WHERE win_id=?').get(job.win_id);
    // ส่งข้อมูลการรับเงินกลับตามโหมดที่หัวหน้าวินตั้ง
    let pay;
    if (leader.pay_mode === 'cash') {
      // เงินสด: แอปแค่โชว์ยอดที่ต้องจ่าย — ไม่บันทึก ไม่ตามยอด (commission_status คง pending ไว้เฉยๆ หัวหน้าวินเก็บเอง)
      pay = { mode: 'cash', amount: r.commission };
    } else if (leader.pay_mode === 'promptpay_direct') {
      pay = { mode: 'promptpay', promptpay_id: leader.promptpay_id, name: leader.promptpay_name, amount: r.commission, require_slip: !!leader.require_slip };
    } else {
      pay = { mode: 'wallet' };
    }
    res.json({ ok: true, ...r, pay });
  } catch (e) {
    res.status(402).json({ error: e.message });   // (โหมด wallet) ยอดไม่พอ
  }
});

/* ---- ROUTE: หัวหน้าวินตั้งค่า "หน้ารับเงิน" ของตัวเอง -------- */
app.post('/win/:id/pay-settings', (req, res) => {
  const { pay_mode, promptpay_id, promptpay_name, require_slip, bank_account } = req.body;
  db.prepare(`UPDATE win_leaders SET pay_mode=?, promptpay_id=?, promptpay_name=?, require_slip=?, bank_account=? WHERE win_id=?`)
    .run(pay_mode || 'promptpay_direct', promptpay_id, promptpay_name, require_slip ? 1 : 0, bank_account, req.params.id);
  res.json({ ok: true });
});

/* ---- ROUTE: ยืนยันรับค่าหัวคิว — promptpay (แรงงานยืนยันโอน) / cash (หัวหน้าวินกดรับเอง) - */
app.post('/jobs/:id/commission', (req, res) => {
  const { method, slip_url } = req.body;         // method: 'promptpay' | 'cash' · slip ถ้า require_slip
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'not_found' });
  const leader = db.prepare('SELECT pay_mode,require_slip FROM win_leaders WHERE win_id=?').get(job.win_id);
  // โหมดเงินสด: ไม่บังคับบันทึก — แต่ถ้าหัวหน้าวินกด "รับเงินสดแล้ว" (method='cash')
  //   จะบันทึกไว้ดูรายได้ตัวเอง (ไม่บังคับ) · โหมด promptpay ต้องมีสลิปถ้า require_slip
  if (leader.pay_mode !== 'cash' && leader.require_slip && !slip_url)
    return res.status(400).json({ error: 'slip_required' });
  db.prepare(`UPDATE jobs SET commission_status='paid', commission_slip=?, commission_paid_at=? WHERE job_id=?`)
    .run(slip_url || null, now(), job.job_id);
  res.json({ ok: true, method: method || (leader.pay_mode === 'cash' ? 'cash' : 'promptpay') });
});

/* ---- ROUTE: แรงงานเติม prepaid wallet (ก่อนรับงาน) ---------- */
app.post('/wallet/topup', (req, res) => {
  const { worker_id, amount } = req.body;   // amount = สตางค์ (ผ่าน payment gateway/PromptPay)
  const w = db.prepare('SELECT * FROM workers WHERE worker_id=?').get(worker_id);
  const bal = w.wallet_balance + amount;
  db.prepare('UPDATE workers SET wallet_balance=? WHERE worker_id=?').run(bal, worker_id);
  db.prepare(`INSERT INTO wallet_txns (txn_id,owner_type,owner_id,type,amount,balance_after,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(uid('TX'), 'worker', worker_id, 'topup', amount, bal, now());
  res.json({ balance: bal });
});

/* ---- ROUTE: หัวหน้าวินถอนค่าหัวคิวเข้าบัญชี ------------------ */
app.post('/wallet/withdraw', (req, res) => {
  const { win_id, amount } = req.body;
  const l = db.prepare('SELECT * FROM win_leaders WHERE win_id=?').get(win_id);
  if (l.wallet_balance < amount) return res.status(402).json({ error: 'insufficient' });
  const bal = l.wallet_balance - amount;
  db.prepare('UPDATE win_leaders SET wallet_balance=? WHERE win_id=?').run(bal, win_id);
  db.prepare(`INSERT INTO wallet_txns (txn_id,owner_type,owner_id,type,amount,balance_after,note,created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(uid('TX'), 'win', win_id, 'withdraw', -amount, bal, 'โอนเข้าบัญชี ' + l.bank_account, now());
  res.json({ balance: bal });
});

/* ---- หัวหน้าวิน override: สั่งพัก / Ban แรงงาน -------------- */
app.post('/workers/:id/status', (req, res) => {
  const { status } = req.body;              // 'available' | 'paused' | 'banned'
  db.prepare('UPDATE workers SET status=? WHERE worker_id=?').run(status, req.params.id);
  res.json({ ok: true });
});

app.listen(3000, () => console.log('Labor Win API on :3000'));
