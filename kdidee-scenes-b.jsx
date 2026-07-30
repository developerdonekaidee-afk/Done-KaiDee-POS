/* Scenes B: Stock · Delivery · Reports · CTA */

function Stock({ progress: p }) {
  kdSpeakScene('stock', 'ขายปุ๊บ สต็อกตัดปั๊บ เตือนก่อนของหมด ไม่ต้องมานั่งนับเอง', 'สต็อกตัดอัตโนมัติทุกครั้งที่ขาย · เตือนก่อนของหมด');
  const enter = iv(p, [0, 0.1], [0, 1], Easing.easeOutCubic);
  const phoneY = iv(p, [0, 0.1], [40, 0], Easing.easeOutCubic);
  const rows = [
    { n: 'มันฝรั่งแช่แข็ง', unit: 'ถุง', from: 0.78, to: 0.34, low: false },
    { n: 'ผงปรุงรสชีส', unit: 'กระปุก', from: 0.62, to: 0.12, low: true },
    { n: 'ไก่ป๊อป', unit: 'แพ็ค', from: 0.7, to: 0.48, low: false },
    { n: 'แก้ว 22 oz', unit: 'ลัง', from: 0.55, to: 0.4, low: false },
  ];
  const drain = iv(p, [0.24, 0.6], [0, 1], Easing.easeInOutCubic);
  const alert = iv(p, [0.62, 0.72], [0, 1], Easing.easeOutBack);
  const alertO = iv(p, [0.62, 0.72, 0.96, 1], [0, 1, 1, 1]);
  return (
    <SoftBg from="#EAF3EF" to="#E6EEF6">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 70 }}>
        <div style={{ width: 360, textAlign: 'right', opacity: iv(p, [0.1, 0.24], [0, 1], Easing.easeOutCubic), transform: `translateX(${iv(p, [0.1, 0.24], [-24, 0], Easing.easeOutCubic)}px)` }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Pill bg={PC.blue}>จัดการสต็อก</Pill></div>
          <div style={{ fontFamily: DP, fontSize: 46, fontWeight: 700, color: PC.ink, lineHeight: 1.12, margin: '18px 0 14px' }}>สต็อกตัดอัตโนมัติ<br />ทุกครั้งที่ขาย</div>
          <div style={{ fontFamily: TH, fontSize: 20, color: PC.muted, lineHeight: 1.5 }}>รู้ของเหลือแบบเรียลไทม์<br />เตือนก่อนของหมด ไม่ต้องเดา</div>
        </div>
        <div style={{ position: 'relative', opacity: enter, transform: `translateY(${phoneY}px)` }}>
          <Phone w={322}>
            <StatusBar label="สต็อกวันนี้" />
            <div style={{ padding: '4px 16px 0' }}>
              <div style={{ fontFamily: DP, fontSize: 19, fontWeight: 700, color: PC.ink }}>คลังวัตถุดิบ</div>
              <div style={{ fontFamily: TH, fontSize: 12.5, color: PC.muted, marginBottom: 14 }}>อัปเดตล่าสุด เมื่อครู่</div>
              {rows.map((r, i) => {
                const val = r.from + (r.to - r.from) * drain;
                const pctReached = r.low && val <= 0.2;
                const barC = pctReached ? PC.red : (val < 0.3 ? PC.amber : PC.green);
                return (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: TH, fontSize: 14, fontWeight: 600, color: PC.ink }}>{r.n}</span>
                      <span style={{ fontFamily: MO, fontSize: 13, color: barC, fontWeight: 600 }}>{Math.round(val * 100)}%</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: '#EEF2F0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${val * 100}%`, background: barC, borderRadius: 999 }} />
                    </div>
                    {pctReached && <div style={{ fontFamily: TH, fontSize: 11.5, color: PC.red, marginTop: 4, fontWeight: 600, opacity: alertO }}>● ใกล้หมด ควรสั่งเพิ่ม</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ position: 'absolute', left: 14, right: 14, bottom: 20, background: '#fff', border: `1.5px solid ${PC.red}`, borderRadius: 14, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 14px 30px -14px rgba(219,92,78,0.5)', transform: `scale(${alert})`, opacity: alertO }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#FBE7E3', color: PC.red, display: 'grid', placeItems: 'center', fontWeight: 800, fontFamily: TH, flexShrink: 0 }}>!</span>
              <div>
                <div style={{ fontFamily: TH, fontSize: 13.5, fontWeight: 700, color: PC.ink }}>ผงปรุงรสชีสใกล้หมด</div>
                <div style={{ fontFamily: TH, fontSize: 12, color: PC.muted }}>แตะเพื่อสั่งซื้อเพิ่ม</div>
              </div>
            </div>
          </Phone>
        </div>
      </div>
    </SoftBg>
  );
}

const CHANNELS = [
  { n: 'Grab', bg: '#00B14F' },
  { n: 'LINE MAN', bg: '#06C755' },
  { n: 'ShopeeFood', bg: '#EE4D2D' },
  { n: 'Robinhood', bg: '#5B2E90' },
];

function Delivery({ progress: p }) {
  kdSpeakScene('delivery', 'แกร็บ ไลน์แมน ช้อปปี้ฟู้ด โรบินฮู้ด คีย์บันทึกยอดทุกช่องทางไว้ในจอเดียว ครบทุกยอดขาย', 'รองรับการบันทึกขายได้หลายช่องทาง · ครบในจอเดียว');
  const enter = iv(p, [0, 0.1], [0, 1], Easing.easeOutCubic);
  const phoneY = iv(p, [0, 0.1], [40, 0], Easing.easeOutCubic);
  const orders = [
    { ch: 0, id: '#GR-4821', items: '2 รายการ', total: 128 },
    { ch: 1, id: '#LM-9033', items: '1 รายการ', total: 84 },
    { ch: 2, id: '#SP-1177', items: '3 รายการ', total: 205 },
    { ch: 3, id: '#RH-0640', items: '2 รายการ', total: 96 },
  ];
  return (
    <SoftBg from="#EAF3EF" to="#E6EEF6">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 70 }}>
        <div style={{ position: 'relative', opacity: enter, transform: `translateY(${phoneY}px)` }}>
          <Phone w={322}>
            <StatusBar label="ออเดอร์เข้า" />
            <div style={{ padding: '4px 16px 0' }}>
              <div style={{ fontFamily: DP, fontSize: 19, fontWeight: 700, color: PC.ink }}>ออเดอร์เดลิเวอรี</div>
              <div style={{ fontFamily: TH, fontSize: 12.5, color: PC.muted, marginBottom: 12 }}>คีย์บันทึกยอดขาย · ครบทุกช่องทาง</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {CHANNELS.map((c, i) => {
                  const a = iv(p, [0.12 + i * 0.05, 0.24 + i * 0.05], [0, 1], Easing.easeOutBack);
                  return <span key={i} style={{ opacity: a, transform: `scale(${a})`, fontFamily: TH, fontSize: 11.5, fontWeight: 700, color: '#fff', background: c.bg, padding: '5px 11px', borderRadius: 999 }}>{c.n}</span>;
                })}
              </div>
              {orders.map((o, i) => {
                const st = 0.34 + i * 0.11;
                const a = iv(p, [st, st + 0.1], [0, 1], Easing.easeOutCubic);
                const y = iv(p, [st, st + 0.1], [-16, 0], Easing.easeOutCubic);
                const ch = CHANNELS[o.ch];
                return (
                  <div key={i} style={{ opacity: a, transform: `translateY(${y}px)`, background: '#fff', borderRadius: 13, padding: '11px 13px', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 11, boxShadow: '0 6px 14px -9px rgba(20,50,40,0.25)' }}>
                    <span style={{ width: 8, height: 40, borderRadius: 999, background: ch.bg, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: TH, fontSize: 11.5, fontWeight: 700, color: ch.bg }}>{ch.n}</span>
                        <span style={{ fontFamily: MO, fontSize: 11, color: PC.muted }}>{o.id}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                        <span style={{ fontFamily: TH, fontSize: 12.5, color: PC.muted }}>{o.items}</span>
                        <span style={{ fontFamily: MO, fontSize: 14, fontWeight: 700, color: PC.ink }}>฿{o.total}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Phone>
        </div>
        <div style={{ width: 370, opacity: iv(p, [0.14, 0.28], [0, 1], Easing.easeOutCubic), transform: `translateX(${iv(p, [0.14, 0.28], [24, 0], Easing.easeOutCubic)}px)` }}>
          <Pill bg={PC.teal}>เดลิเวอรี</Pill>
          <div style={{ fontFamily: DP, fontSize: 46, fontWeight: 700, color: PC.ink, lineHeight: 1.12, margin: '18px 0 14px' }}>บันทึกขาย<br />ได้หลายช่องทาง</div>
          <div style={{ fontFamily: TH, fontSize: 20, color: PC.muted, lineHeight: 1.5 }}>คีย์ยอดขายจากทุกแอปไว้ในจอเดียว<br />ครบทุกช่องทาง ไม่ตกหล่น</div>
        </div>
      </div>
    </SoftBg>
  );
}

function Reports({ progress: p }) {
  kdSpeakScene('reports', 'ยอดขาย กำไร ดูได้ทุกวัน รู้เลยว่าเมนูไหนขายดี ไม่ต้องเดา', 'เห็นทุกยอดขาย รู้กำไรทันที · รู้ว่าเมนูไหนขายดี');
  const zoom = iv(p, [0, 1], [1.04, 1], Easing.easeOutCubic);
  const enter = iv(p, [0, 0.12], [0, 1], Easing.easeOutCubic);
  const days = [42, 58, 51, 70, 64, 88, 96];
  const grow = iv(p, [0.2, 0.7], [0, 1], Easing.easeOutCubic);
  const countUp = (target) => Math.round(target * iv(p, [0.14, 0.5], [0, 1], Easing.easeOutCubic));
  const kpis = [
    { l: 'ยอดขายวันนี้', v: '฿' + countUp(12480).toLocaleString(), d: '+18%', c: PC.green },
    { l: 'จำนวนบิล', v: countUp(86), d: '+12%', c: PC.blue },
    { l: 'ยอดเฉลี่ย/บิล', v: '฿' + countUp(145), d: '+5%', c: PC.teal },
  ];
  return (
    <SoftBg from="#EAF6F0" to="#E5EFF7">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${zoom})`, opacity: enter }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <Pill bg={PC.blueDk}>รายงาน &amp; ยอดขาย</Pill>
          <div style={{ fontFamily: DP, fontSize: 44, fontWeight: 700, color: PC.ink, marginTop: 14 }}>เห็นทุกยอดขาย รู้กำไรทันที</div>
        </div>
        <div style={{ width: 880, background: '#fff', borderRadius: 24, padding: 30, boxShadow: '0 40px 80px -40px rgba(20,50,40,0.4)' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 26 }}>
            {kpis.map((k, i) => (
              <div key={i} style={{ flex: 1, background: PC.gradSoft, borderRadius: 16, padding: '18px 20px' }}>
                <div style={{ fontFamily: TH, fontSize: 15, color: PC.muted, marginBottom: 8 }}>{k.l}</div>
                <div style={{ fontFamily: MO, fontSize: 32, fontWeight: 700, color: PC.ink }}>{k.v}</div>
                <div style={{ fontFamily: TH, fontSize: 14, fontWeight: 700, color: k.c, marginTop: 4 }}>▲ {k.d} จากเมื่อวาน</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <span style={{ fontFamily: DP, fontSize: 18, fontWeight: 700, color: PC.ink }}>ยอดขาย 7 วันล่าสุด</span>
            <span style={{ fontFamily: TH, fontSize: 14, color: PC.green, fontWeight: 600 }}>▲ โตต่อเนื่อง</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 180, padding: '0 6px' }}>
            {days.map((d, i) => {
              const h = (d / 100) * 170 * (0.2 + 0.8 * clamp(iv(p, [0.2 + i * 0.05, 0.4 + i * 0.05], [0, 1], Easing.easeOutCubic), 0, 1));
              const last = i === days.length - 1;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: '100%', height: h, borderRadius: '9px 9px 3px 3px', background: last ? PC.grad : '#CFE3D8' }} />
                  <span style={{ fontFamily: TH, fontSize: 13, color: last ? PC.green : PC.muted, fontWeight: last ? 700 : 500 }}>{['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'][i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SoftBg>
  );
}

function FauxQR({ s = 150 }) {
  const N = 11, cell = s / N;
  const seed = [0, 3, 4, 7, 9, 10, 12, 15, 18, 21, 23, 26, 28, 31, 34, 37, 40, 43, 46, 49, 52, 55, 58, 60, 63, 66, 70, 73, 76, 79, 82, 85, 88, 91, 94, 97, 100, 103, 106, 109, 112, 115, 118];
  const on = (i) => seed.includes((i * 7) % 121) || seed.includes((i * 13) % 121);
  const finder = (r, c) => (r < 3 && c < 3) || (r < 3 && c > N - 4) || (r > N - 4 && c < 3);
  const cells = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (finder(r, c)) continue;
    const i = r * N + c;
    if (on(i)) cells.push(<rect key={i} x={c * cell} y={r * cell} width={cell} height={cell} fill={PC.ink} />);
  }
  const FP = ({ x, y }) => (<g transform={`translate(${x},${y})`}><rect width={cell * 3} height={cell * 3} fill={PC.ink} /><rect x={cell * 0.55} y={cell * 0.55} width={cell * 1.9} height={cell * 1.9} fill="#fff" /><rect x={cell} y={cell} width={cell} height={cell} fill={PC.green} /></g>);
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
      <rect width={s} height={s} fill="#fff" />
      {cells}
      <FP x={0} y={0} /><FP x={(N - 3) * cell} y={0} /><FP x={0} y={(N - 3) * cell} />
    </svg>
  );
}

function Cta({ progress: p }) {
  kdSpeakScene('cta', 'เริ่มใช้ฟรีวันนี้ สแกนคิวอาร์ แอดไลน์ สมัครเปิดร้านฟรี ทดลองใช้ สามสิบวัน', 'สแกน QR แอด LINE สมัครเปิดร้านฟรี');
  const enter = iv(p, [0, 0.12], [0, 1], Easing.easeOutCubic);
  const phoneY = iv(p, [0, 0.12], [40, 0], Easing.easeOutCubic);
  const steps = ['สแกน QR แอด LINE สมัครเปิดร้านฟรี', 'เริ่มขายได้ทันที ทดลองฟรี 30 วัน'];
  const pulse = 1 + Math.sin(p * Math.PI * 4) * 0.02;
  return (
    <SoftBg from="#EAF6F0" to="#E5EFF7">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 64 }}>
        <div style={{ width: 430, opacity: iv(p, [0.1, 0.24], [0, 1], Easing.easeOutCubic), transform: `translateX(${iv(p, [0.1, 0.24], [-24, 0], Easing.easeOutCubic)}px)` }}>
          <Logo h={70} style={{ marginBottom: 22 }} />
          <div style={{ fontFamily: DP, fontSize: 50, fontWeight: 700, color: PC.ink, lineHeight: 1.1, marginBottom: 22 }}>เริ่มใช้ <span style={{ color: PC.green }}>ฟรี</span> วันนี้</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {steps.map((s, i) => {
              const st = 0.28 + i * 0.12;
              const a = iv(p, [st, st + 0.12], [0, 1], Easing.easeOutCubic);
              const x = iv(p, [st, st + 0.12], [-16, 0], Easing.easeOutCubic);
              return (
                <div key={i} style={{ opacity: a, transform: `translateX(${x}px)`, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: PC.grad, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: MO, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontFamily: TH, fontSize: 20, color: PC.ink, fontWeight: 600 }}>{s}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ position: 'relative', opacity: enter, transform: `translateY(${phoneY}px)` }}>
          <Phone w={300} screenBg="#FFFFFF">
            <div style={{ position: 'absolute', inset: 0, background: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 54 }}>
              <div style={{ width: 78, height: 78, borderRadius: 22, background: PC.gradSoft, display: 'grid', placeItems: 'center', marginBottom: 16, boxShadow: '0 12px 30px -12px rgba(20,50,40,0.22)' }}>
                <Logo h={40} />
              </div>
              <div style={{ fontFamily: DP, fontSize: 22, fontWeight: 700, color: PC.ink }}>KaiDee POS</div>
              <div style={{ fontFamily: TH, fontSize: 14, color: PC.muted, marginBottom: 22 }}>LINE Official Account</div>
              <div style={{ background: '#fff', borderRadius: 22, padding: 18, transform: `scale(${pulse})`, boxShadow: '0 20px 40px -18px rgba(20,50,40,0.26)', border: `1px solid ${PC.line}` }}>
                <FauxQR s={168} />
              </div>
              <div style={{ marginTop: 20, background: PC.grad, borderRadius: 999, padding: '11px 32px', fontFamily: TH, fontSize: 17, fontWeight: 700, color: '#fff', boxShadow: '0 12px 26px -12px rgba(30,158,110,0.55)' }}>+ เพิ่มเพื่อน</div>
              <div style={{ marginTop: 16, fontFamily: TH, fontSize: 15, fontWeight: 600, color: PC.green, letterSpacing: 0.5 }}>แอดผ่าน QR · ฟรี</div>
            </div>
          </Phone>
        </div>
      </div>
    </SoftBg>
  );
}

Object.assign(window, { Stock, Delivery, Reports, Cta });
