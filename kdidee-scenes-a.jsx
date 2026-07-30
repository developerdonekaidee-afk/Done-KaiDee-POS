/* Scenes A: Hook · Brand · POS sales */

function Hook({ progress: p }) {
  kdSpeakScene('hook', 'ร้านอาหารยุคนี้ จะเพิ่งเปิด หรือขายมานาน ก็อยากให้ทุกอย่างง่ายขึ้น จริงไหม', 'เปิดร้านง่ายกว่าเดิม — ร้านใหม่หรือร้านเก่าก็ใช้ได้');
  const head = iv(p, [0, 0.12], [0, 1], Easing.easeOutCubic);
  const headY = iv(p, [0, 0.12], [26, 0], Easing.easeOutCubic);
  const grp = iv(p, [0.86, 1], [1, 0], Easing.easeInCubic);
  const grpS = iv(p, [0.86, 1], [1, 0.9], Easing.easeInCubic);
  const items = [
    { t: 'สต็อกหมดไม่รู้ตัว', r: -3, x: -18 },
    { t: 'ออเดอร์เดลิเวอรีตกหล่น', r: 2.5, x: 14 },
    { t: 'ยอดขายไม่รู้ว่ากำไรเท่าไร', r: -2, x: -8 },
    { t: 'ปิดร้านนับเงินไม่ตรง', r: 3, x: 10 },
  ];
  return (
    <SoftBg from="#EEF1F0" to="#E9EDEC">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ opacity: head, transform: `translateY(${headY}px)`, textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: TH, fontSize: 19, fontWeight: 600, letterSpacing: 4, color: PC.green, marginBottom: 12 }}>ร้านใหม่ · ยังไม่มีระบบจัดการ?</div>
          <div style={{ fontFamily: DP, fontSize: 58, fontWeight: 700, color: PC.ink, lineHeight: 1.1 }}>ลองเปลี่ยนให้ร้านง่ายขึ้น ดีไหม?</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, justifyContent: 'center', maxWidth: 760, opacity: grp, transform: `scale(${grpS})` }}>
          {items.map((it, i) => {
            const st = 0.2 + i * 0.13;
            const a = iv(p, [st, st + 0.12], [0, 1], Easing.easeOutBack);
            const y = iv(p, [st, st + 0.12], [30, 0], Easing.easeOutBack);
            return (
              <div key={i} style={{ opacity: a, transform: `translate(${it.x}px,${y}px) rotate(${it.r}deg)`, background: '#fff', borderRadius: 16, padding: '20px 26px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 18px 34px -20px rgba(20,50,40,0.4)', width: 320 }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#FBE7E3', color: PC.red, display: 'grid', placeItems: 'center', fontWeight: 800, fontFamily: TH, flexShrink: 0 }}>✕</span>
                <span style={{ fontFamily: TH, fontSize: 21, fontWeight: 600, color: PC.ink }}>{it.t}</span>
              </div>
            );
          })}
        </div>
      </div>
    </SoftBg>
  );
}

function Brand({ progress: p }) {
  kdSpeakScene('brand', 'ขอแนะนำ ดัน ระบบพีโอเอส ที่เปิดในไลน์ ไม่ต้องโหลดแอป และรวมเดลิเวอรีทุกเจ้าไว้จอเดียว', 'เปิดในไลน์ · ไม่ต้องโหลดแอป · รวมเดลิเวอรีทุกเจ้า');
  const fade = iv(p, [0, 0.14], [0, 1], Easing.easeOutCubic);
  const logoS = iv(p, [0, 0.32], [0.8, 1], Easing.easeOutBack);
  const drift = Math.sin(p * Math.PI * 2) * 4;
  const ring = iv(p, [0.05, 0.6], [0.2, 1], Easing.easeOutCubic);
  const ringO = iv(p, [0.05, 0.55], [0.5, 0], Easing.linear);
  const tagY = iv(p, [0.22, 0.42], [24, 0], Easing.easeOutCubic);
  const tag = iv(p, [0.22, 0.42], [0, 1], Easing.easeOutCubic);
  const feats = ['เปิดในไลน์', 'ไม่ต้องโหลดแอป', 'รวมเดลิเวอรีทุกเจ้า'];
  return (
    <SoftBg from="#EAF6F0" to="#E5EFF7">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', transform: `scale(${logoS}) translateY(${drift}px)`, opacity: fade }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 340, height: 340, marginLeft: -170, marginTop: -170, borderRadius: '50%', border: '2px solid rgba(30,158,110,0.4)', transform: `scale(${ring})`, opacity: ringO }} />
          <Logo h={140} />
        </div>
        <div style={{ opacity: tag, transform: `translateY(${tagY}px)`, textAlign: 'center', marginTop: 30 }}>
          <div style={{ fontFamily: DP, fontSize: 40, fontWeight: 700, color: PC.ink }}>POS ที่ <span style={{ color: PC.green }}>เปิดในไลน์</span> ไม่ต้องโหลดแอป</div>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 34 }}>
          {feats.map((f, i) => {
            const st = 0.5 + i * 0.09;
            const a = iv(p, [st, st + 0.12], [0, 1], Easing.easeOutBack);
            const y = iv(p, [st, st + 0.12], [18, 0], Easing.easeOutBack);
            return <div key={i} style={{ opacity: a, transform: `translateY(${y}px)` }}><Pill bg="#fff" color={PC.ink} style={{ boxShadow: '0 10px 24px -14px rgba(20,50,40,0.4)', fontSize: 18, padding: '11px 22px' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: PC.grad }} />{f}</Pill></div>;
          })}
        </div>
      </div>
    </SoftBg>
  );
}

const POS_ITEMS = [
  { n: 'เฟรนช์ฟรายส์', p: 45, c: '#F2C14E' },
  { n: 'ชีสบอล', p: 39, c: '#E8A13A' },
  { n: 'ไก่ป๊อป', p: 59, c: '#D98A3D' },
  { n: 'น้ำอัดลม', p: 25, c: '#4C9BD6' },
];

function Pos({ progress: p }) {
  kdSpeakScene('pos', 'แตะเลือกเมนู คิดเงินไว รับเงินสด โอน หรือ คิวอาร์ พร้อมเพย์ จบบิลในไม่กี่วินาที', 'แตะ. ขาย. จบบิล — เงินสด / โอน / QR พร้อมเพย์');
  const enter = iv(p, [0, 0.1], [0, 1], Easing.easeOutCubic);
  const phoneY = iv(p, [0, 0.1], [40, 0], Easing.easeOutCubic);
  // taps
  const taps = [0.22, 0.36, 0.5];
  const added = taps.map((t) => p >= t);
  const cart = POS_ITEMS.filter((_, i) => i < 3 && added[i]);
  const total = cart.reduce((s, it) => s + it.p, 0);
  const pressPay = p > 0.66 && p < 0.74 ? ping(p, 0.66, 0.74) : 0;
  const paid = p > 0.74;
  const chk = iv(p, [0.74, 0.84], [0, 1], Easing.easeOutBack);
  // cursor path: target grid slot centers, then pay button
  const slots = [{ x: 60, y: 300 }, { x: 178, y: 300 }, { x: 60, y: 402 }];
  const payPos = { x: 165, y: 585 };
  let cx = 250, cy = 250, press = 0;
  const seg = (a, b, from, to) => iv(p, [a, b], [from, to], Easing.easeInOutCubic);
  if (p < taps[0]) { cx = seg(0.12, taps[0], 250, slots[0].x); cy = seg(0.12, taps[0], 250, slots[0].y); }
  else if (p < taps[1]) { cx = seg(taps[0], taps[1], slots[0].x, slots[1].x); cy = seg(taps[0], taps[1], slots[0].y, slots[1].y); }
  else if (p < taps[2]) { cx = seg(taps[1], taps[2], slots[1].x, slots[2].x); cy = seg(taps[1], taps[2], slots[1].y, slots[2].y); }
  else { cx = seg(taps[2], 0.64, slots[2].x, payPos.x); cy = seg(taps[2], 0.64, slots[2].y, payPos.y); }
  taps.forEach((t) => { if (p > t - 0.04 && p < t + 0.05) press = ping(p, t - 0.04, t + 0.05); });
  press = Math.max(press, pressPay);

  return (
    <SoftBg from="#EAF3EF" to="#E6EEF6">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 70 }}>
        <div style={{ position: 'relative', opacity: enter, transform: `translateY(${phoneY}px)` }}>
          <Phone w={322}>
            <StatusBar label="เปิดร้าน 09:41" />
            <div style={{ padding: '4px 16px 0' }}>
              <div style={{ fontFamily: DP, fontSize: 19, fontWeight: 700, color: PC.ink }}>หน้าขาย</div>
              <div style={{ fontFamily: TH, fontSize: 12.5, color: PC.muted, marginBottom: 10 }}>รับกลับบ้าน · บิล #A-102</div>
              <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
                {['ยอดนิยม', 'ทอด', 'เครื่องดื่ม'].map((c, i) => <span key={i} style={{ fontFamily: TH, fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: i === 0 ? PC.green : '#EEF2F0', color: i === 0 ? '#fff' : PC.muted }}>{c}</span>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {POS_ITEMS.map((it, i) => {
                  const bump = added[i] ? iv(p, [taps[i] || 1, (taps[i] || 1) + 0.08], [1.06, 1], Easing.easeOutCubic) : 1;
                  return (
                    <div key={i} style={{ background: '#fff', borderRadius: 13, padding: 10, boxShadow: '0 6px 14px -8px rgba(20,50,40,0.25)', transform: `scale(${added[i] ? bump : 1})`, border: added[i] ? `1.5px solid ${PC.green}` : '1.5px solid transparent' }}>
                      <div style={{ height: 46, borderRadius: 9, background: `linear-gradient(135deg,${it.c},${it.c}cc)`, marginBottom: 8 }} />
                      <div style={{ fontFamily: TH, fontSize: 13, fontWeight: 600, color: PC.ink }}>{it.n}</div>
                      <div style={{ fontFamily: MO, fontSize: 13, color: PC.green, fontWeight: 600 }}>฿{it.p}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* cart bar */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: `1px solid ${PC.line}`, padding: '12px 16px 18px', boxShadow: '0 -8px 22px -14px rgba(20,50,40,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontFamily: TH, fontSize: 13, color: PC.muted }}>{cart.length} รายการ</span>
                <span style={{ fontFamily: MO, fontSize: 22, fontWeight: 700, color: PC.ink }}>฿{total}</span>
              </div>
              <div style={{ height: 44, borderRadius: 12, background: paid ? PC.greenDk : PC.grad, display: 'grid', placeItems: 'center', fontFamily: TH, fontWeight: 700, color: '#fff', fontSize: 16 }}>{paid ? 'ชำระเงินสำเร็จ' : 'ชำระเงิน'}</div>
            </div>
            {/* success overlay */}
            {paid && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,36,28,0.5)', display: 'grid', placeItems: 'center' }}>
                <div style={{ transform: `scale(${chk})`, width: 96, height: 96, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.4)' }}>
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4 10-11" stroke={PC.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
            )}
            {!paid && <Cursor x={cx} y={cy} press={press} />}
          </Phone>
        </div>
        <div style={{ width: 360, opacity: iv(p, [0.12, 0.26], [0, 1], Easing.easeOutCubic), transform: `translateX(${iv(p, [0.12, 0.26], [24, 0], Easing.easeOutCubic)}px)` }}>
          <Pill bg={PC.green}>ขายหน้าร้าน</Pill>
          <div style={{ fontFamily: DP, fontSize: 46, fontWeight: 700, color: PC.ink, lineHeight: 1.12, margin: '18px 0 14px' }}>แตะ. ขาย. จบบิล<br />ในไม่กี่วินาที</div>
          <div style={{ fontFamily: TH, fontSize: 20, color: PC.muted, lineHeight: 1.5 }}>เมนูจัดเป็นหมวด กดง่าย คิดเงินไว<br />รองรับเงินสด โอน และ QR พร้อมเพย์</div>
        </div>
      </div>
    </SoftBg>
  );
}

Object.assign(window, { Hook, Brand, Pos });
