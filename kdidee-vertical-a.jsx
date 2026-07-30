/* Vertical 9:16 promo scenes (720×1280) — phone-forward, captions + Thai narration.
   Reuses atoms from kdidee-common. Each scene: kdSpeakScene(id,line) + <Caption/>. */

const VW = 720, VH = 1280;

// shared vertical shell: soft bg + scene dots + caption + sound toggle
function VShell({ from, to, children, p, cap, idx, total, accent }) {
  return (
    <SoftBg from={from} to={to}>
      {children}
      <SceneDots index={idx} total={total} />
      <Caption progress={p} text={cap} accent={accent} />
    </SoftBg>
  );
}

// ── 1 · HOOK — for shops with/without POS ──
function HookV({ progress: p }) {
  kdSpeakScene('hook', 'ร้านอาหารยุคนี้ จะเพิ่งเปิด หรือขายมานาน ก็อยากให้ทุกอย่างง่ายขึ้น จริงไหม');
  const head = iv(p, [0.05, 0.2], [0, 1], Easing.easeOutCubic);
  const headY = iv(p, [0.05, 0.2], [30, 0], Easing.easeOutCubic);
  const pains = [
    { t: 'สต็อกหมดไม่รู้ตัว', r: -3 },
    { t: 'ออเดอร์เดลิเวอรีตกหล่น', r: 2.5 },
    { t: 'ปิดร้านนับเงินไม่ตรง', r: -2 },
  ];
  return (
    <VShell from="#EEF1F0" to="#E8EDEC" p={p} idx={0} total={7} cap="เปิดร้านง่ายกว่าเดิม — ร้านใหม่หรือร้านเก่าก็ใช้ได้">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 60px' }}>
        <div style={{ opacity: head, transform: `translateY(${headY}px)`, textAlign: 'center', marginBottom: 54 }}>
          <div style={{ fontFamily: TH, fontSize: 24, fontWeight: 600, letterSpacing: 3, color: PC.green, marginBottom: 16 }}>ร้านใหม่ · ยังไม่มีระบบจัดการ?</div>
          <div style={{ fontFamily: DP, fontSize: 72, fontWeight: 700, color: PC.ink, lineHeight: 1.12 }}>ลองเปลี่ยนให้<br />ร้านง่ายขึ้น ดีไหม?</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 520 }}>
          {pains.map((it, i) => {
            const st = 0.28 + i * 0.15;
            const a = iv(p, [st, st + 0.13], [0, 1], Easing.easeOutBack);
            const x = iv(p, [st, st + 0.13], [40, 0], Easing.easeOutBack);
            return (
              <div key={i} style={{ opacity: a, transform: `translateX(${x}px) rotate(${it.r}deg)`, background: '#fff', borderRadius: 18, padding: '22px 28px', display: 'flex', alignItems: 'center', gap: 18, boxShadow: '0 20px 38px -22px rgba(20,50,40,0.4)' }}>
                <span style={{ width: 38, height: 38, borderRadius: '50%', background: '#FBE7E3', color: PC.red, display: 'grid', placeItems: 'center', fontWeight: 800, fontFamily: TH, fontSize: 20, flexShrink: 0 }}>✕</span>
                <span style={{ fontFamily: TH, fontSize: 27, fontWeight: 600, color: PC.ink }}>{it.t}</span>
              </div>
            );
          })}
        </div>
      </div>
    </VShell>
  );
}

// ── 2 · BRAND ──
function BrandV({ progress: p }) {
  kdSpeakScene('brand', 'ขอแนะนำ ดัน ระบบพีโอเอส ที่เปิดในไลน์ ไม่ต้องโหลดแอป และรวมเดลิเวอรีทุกเจ้าไว้จอเดียว');
  const fade = iv(p, [0, 0.16], [0, 1], Easing.easeOutCubic);
  const logoS = iv(p, [0, 0.34], [0.8, 1], Easing.easeOutBack);
  const drift = Math.sin(p * Math.PI * 2) * 5;
  const ring = iv(p, [0.05, 0.6], [0.2, 1], Easing.easeOutCubic);
  const ringO = iv(p, [0.05, 0.55], [0.5, 0], Easing.linear);
  const tag = iv(p, [0.24, 0.44], [0, 1], Easing.easeOutCubic);
  const tagY = iv(p, [0.24, 0.44], [26, 0], Easing.easeOutCubic);
  const feats = ['เปิดในไลน์', 'ไม่ต้องโหลดแอป', 'รวมเดลิเวอรีทุกเจ้า', 'ใช้ฟรี'];
  return (
    <VShell from="#EAF6F0" to="#E5EFF7" p={p} idx={1} total={7} cap="เปิดในไลน์ · ไม่ต้องโหลดแอป · รวมเดลิเวอรีทุกเจ้า">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 60px' }}>
        <div style={{ position: 'relative', transform: `scale(${logoS}) translateY(${drift}px)`, opacity: fade, marginBottom: 40 }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 420, height: 420, marginLeft: -210, marginTop: -210, borderRadius: '50%', border: '2px solid rgba(30,158,110,0.4)', transform: `scale(${ring})`, opacity: ringO }} />
          <Logo h={190} />
        </div>
        <div style={{ opacity: tag, transform: `translateY(${tagY}px)`, textAlign: 'center' }}>
          <div style={{ fontFamily: DP, fontSize: 50, fontWeight: 700, color: PC.ink, lineHeight: 1.2 }}>POS ที่<span style={{ color: PC.green }}>เปิดในไลน์</span><br />ไม่ต้องโหลดแอป</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 40, justifyContent: 'center', maxWidth: 560 }}>
          {feats.map((f, i) => {
            const st = 0.5 + i * 0.08;
            const a = iv(p, [st, st + 0.12], [0, 1], Easing.easeOutBack);
            const y = iv(p, [st, st + 0.12], [20, 0], Easing.easeOutBack);
            return <div key={i} style={{ opacity: a, transform: `translateY(${y}px)` }}><Pill bg="#fff" color={PC.ink} style={{ boxShadow: '0 12px 26px -16px rgba(20,50,40,0.4)', fontSize: 21, padding: '13px 26px' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: PC.grad }} />{f}</Pill></div>;
          })}
        </div>
      </div>
    </VShell>
  );
}

// ── 3 · POS demo (usage) ──
const POSV_ITEMS = [
  { n: 'เฟรนช์ฟรายส์', p: 45, c: '#F2C14E' },
  { n: 'ชีสบอล', p: 39, c: '#E8A13A' },
  { n: 'ไก่ป๊อป', p: 59, c: '#D98A3D' },
  { n: 'น้ำอัดลม', p: 25, c: '#4C9BD6' },
];
function PosV({ progress: p }) {
  kdSpeakScene('pos', 'แตะเลือกเมนู คิดเงินไว รับเงินสด โอน หรือ คิวอาร์ พร้อมเพย์ จบบิลในไม่กี่วินาที');
  const enter = iv(p, [0, 0.1], [0, 1], Easing.easeOutCubic);
  const phoneY = iv(p, [0, 0.1], [50, 0], Easing.easeOutCubic);
  const taps = [0.24, 0.38, 0.52];
  const added = taps.map((t) => p >= t);
  const cart = POSV_ITEMS.filter((_, i) => i < 3 && added[i]);
  const total = cart.reduce((s, it) => s + it.p, 0);
  const pressPay = p > 0.66 && p < 0.74 ? ping(p, 0.66, 0.74) : 0;
  const paid = p > 0.74;
  const chk = iv(p, [0.74, 0.84], [0, 1], Easing.easeOutBack);
  const W = 384;
  const slots = [{ x: 72, y: 358 }, { x: 212, y: 358 }, { x: 72, y: 480 }];
  const payPos = { x: 196, y: 700 };
  let cx = 300, cy = 300, press = 0;
  const seg = (a, b, from, to) => iv(p, [a, b], [from, to], Easing.easeInOutCubic);
  if (p < taps[0]) { cx = seg(0.12, taps[0], 300, slots[0].x); cy = seg(0.12, taps[0], 300, slots[0].y); }
  else if (p < taps[1]) { cx = seg(taps[0], taps[1], slots[0].x, slots[1].x); cy = seg(taps[0], taps[1], slots[0].y, slots[1].y); }
  else if (p < taps[2]) { cx = seg(taps[1], taps[2], slots[1].x, slots[2].x); cy = seg(taps[1], taps[2], slots[1].y, slots[2].y); }
  else { cx = seg(taps[2], 0.64, slots[2].x, payPos.x); cy = seg(taps[2], 0.64, slots[2].y, payPos.y); }
  taps.forEach((t) => { if (p > t - 0.04 && p < t + 0.05) press = ping(p, t - 0.04, t + 0.05); });
  press = Math.max(press, pressPay);
  return (
    <VShell from="#EAF3EF" to="#E6EEF6" p={p} idx={2} total={7} cap="แตะ. ขาย. จบบิล — เงินสด / โอน / QR พร้อมเพย์">
      <div style={{ position: 'absolute', top: 84, left: 0, right: 0, textAlign: 'center', opacity: iv(p, [0.08, 0.2], [0, 1], Easing.easeOutCubic) }}>
        <Pill bg={PC.green} style={{ fontSize: 20, padding: '11px 24px' }}>ขายหน้าร้าน</Pill>
        <div style={{ fontFamily: DP, fontSize: 44, fontWeight: 700, color: PC.ink, marginTop: 14 }}>แตะ. ขาย. จบบิล.</div>
      </div>
      <div style={{ position: 'absolute', top: 232, left: '50%', transform: `translateX(-50%) translateY(${phoneY}px)`, opacity: enter }}>
        <Phone w={W}>
          <StatusBar label="เปิดร้าน 09:41" />
          <div style={{ padding: '6px 20px 0' }}>
            <div style={{ fontFamily: DP, fontSize: 23, fontWeight: 700, color: PC.ink }}>หน้าขาย</div>
            <div style={{ fontFamily: TH, fontSize: 15, color: PC.muted, marginBottom: 12 }}>รับกลับบ้าน · บิล #A-102</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {['ยอดนิยม', 'ทอด', 'เครื่องดื่ม'].map((c, i) => <span key={i} style={{ fontFamily: TH, fontSize: 14, fontWeight: 600, padding: '6px 14px', borderRadius: 999, background: i === 0 ? PC.green : '#EEF2F0', color: i === 0 ? '#fff' : PC.muted }}>{c}</span>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {POSV_ITEMS.map((it, i) => {
                const bump = added[i] ? iv(p, [taps[i] || 1, (taps[i] || 1) + 0.08], [1.06, 1], Easing.easeOutCubic) : 1;
                return (
                  <div key={i} style={{ background: '#fff', borderRadius: 15, padding: 12, boxShadow: '0 7px 16px -9px rgba(20,50,40,0.25)', transform: `scale(${added[i] ? bump : 1})`, border: added[i] ? `2px solid ${PC.green}` : '2px solid transparent' }}>
                    <div style={{ height: 58, borderRadius: 11, background: `linear-gradient(135deg,${it.c},${it.c}cc)`, marginBottom: 10 }} />
                    <div style={{ fontFamily: TH, fontSize: 16, fontWeight: 600, color: PC.ink }}>{it.n}</div>
                    <div style={{ fontFamily: MO, fontSize: 16, color: PC.green, fontWeight: 600 }}>฿{it.p}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: `1px solid ${PC.line}`, padding: '16px 20px 24px', boxShadow: '0 -8px 22px -14px rgba(20,50,40,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <span style={{ fontFamily: TH, fontSize: 16, color: PC.muted }}>{cart.length} รายการ</span>
              <span style={{ fontFamily: MO, fontSize: 28, fontWeight: 700, color: PC.ink }}>฿{total}</span>
            </div>
            <div style={{ height: 54, borderRadius: 14, background: paid ? PC.greenDk : PC.grad, display: 'grid', placeItems: 'center', fontFamily: TH, fontWeight: 700, color: '#fff', fontSize: 19 }}>{paid ? 'ชำระเงินสำเร็จ' : 'ชำระเงิน'}</div>
          </div>
          {paid && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,36,28,0.5)', display: 'grid', placeItems: 'center' }}>
              <div style={{ transform: `scale(${chk})`, width: 120, height: 120, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.4)' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4 10-11" stroke={PC.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
          )}
          {!paid && <Cursor x={cx} y={cy} press={press} />}
        </Phone>
      </div>
    </VShell>
  );
}

Object.assign(window, { VW, VH, VShell, HookV, BrandV, PosV });
