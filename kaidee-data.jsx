// kaidee-data.jsx — i18n, mock stores, icons, shared UI primitives
const { useState, useEffect, useRef, useContext, createContext } = React;

/* ─────────────────────────── i18n ─────────────────────────── */
const DICT = {
  appName:      { th:'Have a Good Day',         en:'Have a Good Day' },
  tagline:      { th:'ขายง่าย ได้กำไร รู้ทุกบาท', en:'Sell easy. Know every baht.' },
  chooseView:   { th:'เลือกมุมมองที่จะลองใช้',  en:'Choose a view to explore' },
  demoNote:     { th:'ตัวต้นแบบสาธิต · สลับมุมมองได้ตลอด', en:'Interactive demo · switch views anytime' },
  merchant:     { th:'แม่ค้า / ร้านค้า',        en:'Merchant' },
  merchantSub:  { th:'กดขาย · ดูกำไร · ตั้งเมนู', en:'Sell · profit · menu' },
  customer:     { th:'ลูกค้า (ผ่านไลน์)',       en:'Customer (LINE)' },
  customerSub:  { th:'สั่งอาหาร · จ่ายเงิน · จองล่วงหน้า', en:'Order · pay · pre-order' },
  rider:        { th:'ไรเดอร์ / คนขับ',         en:'Rider' },
  riderSub:     { th:'รับงานส่ง · ดูรายได้',    en:'Grab jobs · earnings' },
  // merchant nav
  sell:         { th:'ขาย',      en:'Sell' },
  orders:       { th:'ออเดอร์',  en:'Orders' },
  dashboard:    { th:'สรุป',     en:'Reports' },
  stock:        { th:'สต๊อก',    en:'Stock' },
  store:        { th:'ตั้งค่า',  en:'Settings' },
  cash:         { th:'เงินสด',   en:'Cash' },
  // customer nav
  menu:         { th:'เมนู',     en:'Menu' },
  cart:         { th:'ตะกร้า',   en:'Cart' },
  myOrders:     { th:'ออเดอร์',  en:'Orders' },
  profile:      { th:'ฉัน',      en:'Me' },
  // rider nav
  newJobs:      { th:'งานใหม่',  en:'New jobs' },
  myJobs:       { th:'งานของฉัน', en:'My jobs' },
  earnings:     { th:'รายได้',   en:'Earnings' },
  // common
  total:        { th:'รวม',      en:'Total' },
  subtotal:     { th:'ยอดสินค้า', en:'Subtotal' },
  baht:         { th:'บาท',      en:'THB' },
  add:          { th:'เพิ่ม',    en:'Add' },
  addToCart:    { th:'ใส่ตะกร้า', en:'Add to cart' },
  checkout:     { th:'ชำระเงิน', en:'Checkout' },
  confirm:      { th:'ยืนยัน',   en:'Confirm' },
  cancel:       { th:'ยกเลิก',   en:'Cancel' },
  save:         { th:'บันทึก',   en:'Save' },
  done:         { th:'เสร็จสิ้น', en:'Done' },
  back:         { th:'ย้อนกลับ', en:'Back' },
  qty:          { th:'จำนวน',    en:'Qty' },
  each:         { th:'/ชิ้น',    en:'ea' },
  cost:         { th:'ต้นทุน',   en:'Cost' },
  price:        { th:'ราคาขาย', en:'Price' },
  profit:       { th:'กำไร',     en:'Profit' },
  revenue:      { th:'รายรับ',   en:'Revenue' },
  today:        { th:'วันนี้',   en:'Today' },
  charge:       { th:'เก็บเงิน', en:'Charge' },
  clear:        { th:'ล้าง',     en:'Clear' },
  empty:        { th:'ยังไม่มีรายการ', en:'Nothing here yet' },
};
function tr(lang, key){ const e = DICT[key]; return e ? (e[lang]||e.th) : key; }

const LangCtx = createContext({ lang:'th', t:(k)=>k, setLang:()=>{} });
function useT(){ return useContext(LangCtx); }

// live data context (editable categories etc.)
const DataCtx = createContext({ cats:null });
function useCats(){ const d = useContext(DataCtx); return (d && d.cats) || CATS; }

/* ─────────────────────────── money ─────────────────────────── */
const money = (n)=> '฿'+Number(n||0).toLocaleString('en-US');
const money2 = (n)=> '฿'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:0});

/* ── สถานะเปิด/ปิดร้าน ── โหมด auto = ตามเวลาทำการ (+override ปิดชั่วคราว) · manual = ตามสวิตช์ ── */
function kdShopOpen(shop){
  if(!shop) return true;
  if((shop.hoursMode||'auto')==='manual') return shop.isOpen!==false;   // กำหนดเอง
  if(shop.pause) return false;                                          // override: ปิดชั่วคราว (ของหมด ฯลฯ)
  const now=new Date();
  const dk=['sun','mon','tue','wed','thu','fri','sat'][now.getDay()];
  const wk=(shop.week&&shop.week[dk])||null;
  let open=shop.open||'08:00', close=shop.close||'20:00';
  if(wk){ if(wk.closed) return false; open=wk.open||open; close=wk.close||close; }
  const toM=(s)=>{ const p=String(s||'').split(':'); return (+p[0]||0)*60+(+p[1]||0); };
  const cur=now.getHours()*60+now.getMinutes(), o=toM(open), c=toM(close);
  return c<=o ? (cur>=o || cur<c) : (cur>=o && cur<c);   // c<=o = ข้ามเที่ยงคืน
}

/* ── กะหมดอายุ? ── ใช้ตัดสินว่า "คีย์ขายข้ามวัน" ได้หรือไม่
   - วันเดียวกับ businessDate → ขายได้เสมอ (แม้เลยเวลาปิดร้านนิดหน่อย)
   - ข้ามวันแล้ว → หมดอายุ ยกเว้นร้านขายข้ามคืน (ปิด < เปิด) ยังอยู่ในช่วงก่อนเวลาปิดกะ */
function kdShiftExpired(register, shop){
  if(!register || !register.open || !register.businessDate) return false;
  const bd = register.businessDate;
  const todayStr = new Date().toISOString().slice(0,10);
  if(todayStr===bd) return false;
  const dk=['sun','mon','tue','wed','thu','fri','sat'][new Date(bd+'T00:00:00').getDay()];
  const wk=(shop&&shop.week&&shop.week[dk])||null;
  let open=(wk&&!wk.closed&&wk.open)||(shop&&shop.open)||'08:00';
  let close=(wk&&!wk.closed&&wk.close)||(shop&&shop.close)||'20:00';
  const om=String(open).split(':'), cm=String(close).split(':');
  const openMin=(+om[0]||0)*60+(+om[1]||0), closeMin=(+cm[0]||0)*60+(+cm[1]||0);
  const closeDt=new Date(bd+'T00:00:00'); closeDt.setHours(+cm[0]||0, +cm[1]||0, 0, 0);
  if(closeMin<=openMin) closeDt.setDate(closeDt.getDate()+1);   // ปิดข้ามคืน → เลื่อนไปวันถัดไป
  return Date.now() > closeDt.getTime();
}

/* ── delivery fare (Grab-style): base + per-km, min floor ── */
const FARE = { base:10, baseKm:1, perKm:6.5, min:15 };
function calcFare(dist){
  const extra = Math.max(0, (dist||0) - FARE.baseKm);
  return Math.max(FARE.min, Math.ceil(FARE.base + extra*FARE.perKm));
}

/* ─────────────────────────── icons ─────────────────────────── */
const Icon = ({d, size=24, stroke=2, fill='none', color='currentColor', style}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>{d}</svg>
);
const IC = {
  sell:   <Icon d={<><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h6"/></>}/>,
  bag:    <Icon d={<><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></>}/>,
  chart:  <Icon d={<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>}/>,
  store:  <Icon d={<><path d="M4 9l1-5h14l1 5"/><path d="M4 9v11h16V9"/><path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0"/></>}/>,
  menu:   <Icon d={<><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></>}/>,
  cart:   <Icon d={<><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h11l2-8H6"/></>}/>,
  user:   <Icon d={<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></>}/>,
  moto:   <Icon d={<><circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M8.5 17h6l3-6h-4l-2-3H8"/><path d="M14 8h3"/></>}/>,
  wallet: <Icon d={<><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12h2"/><path d="M3 9h14a2 2 0 0 1 2 2"/></>}/>,
  clock:  <Icon d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}/>,
  pin:    <Icon d={<><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></>}/>,
  plus:   <Icon d={<><path d="M12 5v14M5 12h14"/></>}/>,
  minus:  <Icon d={<><path d="M5 12h14"/></>}/>,
  check:  <Icon d={<><path d="M4 12l5 5L20 6"/></>}/>,
  x:      <Icon d={<><path d="M6 6l12 12M18 6L6 18"/></>}/>,
  qr:     <Icon d={<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M20 14v7M14 20h3"/></>}/>,
  cash:   <Icon d={<><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></>}/>,
  bank:   <Icon d={<><path d="M4 10h16M4 10l8-5 8 5M6 10v7M10 10v7M14 10v7M18 10v7M4 20h16"/></>}/>,
  truck:  <Icon d={<><rect x="2" y="7" width="12" height="9" rx="1"/><path d="M14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></>}/>,
  calendar:<Icon d={<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 9h18M8 3v4M16 3v4"/></>}/>,
  edit:   <Icon d={<><path d="M4 20h4L18 10l-4-4L4 16v4z"/><path d="M13 5l4 4"/></>}/>,
  chev:   <Icon d={<><path d="M9 6l6 6-6 6"/></>}/>,
  chevUp: <Icon d={<><path d="M6 15l6-6 6 6"/></>}/>,
  chevDown: <Icon d={<><path d="M6 9l6 6 6-6"/></>}/>,
  back:   <Icon d={<><path d="M15 6l-6 6 6 6"/></>}/>,
  bell:   <Icon d={<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M10.5 21a2 2 0 0 0 3 0"/></>}/>,
  fire:   <Icon d={<><path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c1.5 0 1-3-1-5 2 0 3 2 3 2s0-4 0-4z"/></>}/>,
  star:   <Icon d={<><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.5l1.1-6L3.4 9.3l6-.8L12 3z"/></>}/>,
  phone:  <Icon d={<><path d="M5 3h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/></>}/>,
  globe:  <Icon d={<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></>}/>,
  receipt:<Icon d={<><path d="M6 3h12v18l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21V3z"/><path d="M9 8h6M9 12h6"/></>}/>,
  scan:   <Icon d={<><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/></>}/>,
  box:    <Icon d={<><path d="M3 8l9-5 9 5v8l-9 5-9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/></>}/>,
  cartIn: <Icon d={<><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h11l1.2-5"/><path d="M17 3v6M14 6h6"/></>}/>,
  alert:  <Icon d={<><path d="M12 3l9 16H3L12 3z"/><path d="M12 10v4M12 17h.01"/></>}/>,
  layers: <Icon d={<><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></>}/>,
};

/* ─────────────────────────── mock data ─────────────────────────── */
const CATS = [
  { id:'savory', th:'อาหารจานหลัก', en:'Mains',   emoji:'🍚' },
  { id:'noodle', th:'เส้น',         en:'Noodles', emoji:'🍜' },
  { id:'sweet',  th:'ของหวาน',      en:'Sweets',  emoji:'🍧' },
  { id:'drink',  th:'เครื่องดื่ม',  en:'Drinks',  emoji:'🥤' },
];
const MENU = [
  { id:'m1', cat:'savory', th:'ข้าวกะเพราหมูสับ ไข่ดาว', en:'Basil Pork & Fried Egg', price:60, cost:29, tone:'#F4E7D2', hot:true, costMethod:'recipe',
    recipe:[['r_pork',80],['r_rice',100],['r_egg',1],['r_basil',12],['r_oil',12],['r_sauce',8],['r_box',1],['r_bag',1]],
    recipeByCh:{ delivery:[['r_pork',80],['r_rice',100],['r_egg',1],['r_basil',12],['r_oil',12],['r_sauce',8],['r_box',1],['r_bag',2]] } },
  { id:'m2', cat:'savory', th:'ข้าวผัดกุ้งสด',          en:'Shrimp Fried Rice',      price:70, cost:38, tone:'#EFE3CE',
    recipe:[['r_shrimp',70],['r_rice',120],['r_egg',1],['r_oil',15],['r_sauce',10],['r_box',1],['r_bag',1]] },
  { id:'m3', cat:'savory', th:'ข้าวมันไก่',             en:'Hainanese Chicken Rice', price:55, cost:26, tone:'#F1E9D6',
    recipe:[['r_chicken',110],['r_rice',130],['r_oil',8],['r_sauce',8],['r_box',1],['r_bag',1]] },
  { id:'m4', cat:'savory', th:'ข้าวหมูกรอบ',           en:'Crispy Pork Rice',       price:65, cost:33, tone:'#F3E4CE',
    recipe:[['r_crispypork',100],['r_rice',120],['r_oil',5],['r_sauce',8],['r_box',1],['r_bag',1]] },
  { id:'m5', cat:'noodle', th:'ก๋วยเตี๋ยวต้มยำ',        en:'Tom Yum Noodles',        price:60, cost:28, tone:'#F6DED4', hot:true,
    recipe:[['r_noodle',120],['r_pork',40],['r_beansprout',30],['r_lime',0.5],['r_sauce',12],['r_box',1],['r_bag',1]] },
  { id:'m6', cat:'noodle', th:'ผัดไทยกุ้งสด',          en:'Pad Thai with Shrimp',   price:65, cost:32, tone:'#F5E2CE',
    recipe:[['r_padthai',120],['r_shrimp',50],['r_egg',1],['r_beansprout',40],['r_sauce',12],['r_oil',10],['r_box',1],['r_bag',1]] },
  { id:'m7', cat:'noodle', th:'ก๋วยเตี๋ยวเรือหมู',      en:'Boat Noodles',           price:50, cost:22, tone:'#EEDBCF',
    recipe:[['r_noodle',110],['r_pork',50],['r_beansprout',30],['r_sauce',12],['r_box',1],['r_bag',1]] },
  { id:'m8', cat:'sweet',  th:'ข้าวเหนียวมะม่วง',       en:'Mango Sticky Rice',      price:60, cost:34, tone:'#FBF0C9', hot:true,
    recipe:[['r_stickyrice',150],['r_mango',0.5],['r_coconut',60],['r_sugar',15],['r_box',1],['r_bag',1]] },
  { id:'m9', cat:'sweet',  th:'บัวลอยไข่หวาน',          en:'Bua Loy',                price:35, cost:15, tone:'#F7E3EC',
    recipe:[['r_coconut',120],['r_sugar',20],['r_egg',1],['r_box',1]] },
  { id:'m10',cat:'drink',  th:'ชาไทยเย็น',              en:'Thai Iced Tea',          price:35, cost:12, tone:'#F5DFC6', hot:true,
    recipe:[['r_tea',18],['r_milk',60],['r_sugar',15],['r_cup',1]] },
  { id:'m11',cat:'drink',  th:'อเมริกาโน่เย็น',         en:'Iced Americano',         price:45, cost:15, tone:'#E3D3C4',
    recipe:[['r_coffee',18],['r_cup',1]] },
  { id:'m12',cat:'drink',  th:'น้ำมะนาวโซดา',          en:'Lime Soda',              price:40, cost:14, tone:'#E6F2D9',
    recipe:[['r_lime',1],['r_soda',200],['r_sugar',12],['r_cup',1]] },
];
// resolve the LIVE store menu first (server-synced / edited prices / custom items),
// fall back to the seed MENU. Fixes cart/receipt totals showing ฿0 for non-seed items.
const menuById = (id)=> (typeof window!=='undefined' && Array.isArray(window.__kdMenu) && window.__kdMenu.find(m=>m.id===id)) || MENU.find(m=>m.id===id);

// seed sales for dashboard (today)
const SEED_SALES = [
  { id:'s1', items:[['m1',2],['m10',2]], channel:'walkin', pay:'cash',      t:'08:12' },
  { id:'s2', items:[['m5',1],['m8',1]],  channel:'line',   pay:'promptpay', t:'09:40' },
  { id:'s3', items:[['m3',3]],           channel:'walkin', pay:'promptpay', t:'10:05' },
  { id:'s4', items:[['m6',2],['m12',2]], channel:'delivery',pay:'promptpay',  t:'11:22' },
  { id:'s5', items:[['m2',1],['m11',1]], channel:'line',   pay:'cod',       t:'11:48' },
  { id:'s6', items:[['m4',2],['m10',3]], channel:'walkin', pay:'cash',      t:'12:15' },
  { id:'s7', items:[['m8',2]],           channel:'line',   pay:'promptpay', t:'12:39' },
];
// ใช้ยอดที่บันทึกไว้จริง (รวม VAT บวกเพิ่มแล้ว ถ้ามี) ถ้าไม่มีค่อยคิดจากรายการ
const saleTotal = (s)=> (s && s.total!=null && s.total!=='') ? Number(s.total) : s.items.reduce((a,[id,q])=> a + (menuById(id)?.price||0)*q, 0);
// ยอดที่ลงบัญชีได้จริงตอนสรุปปิดวัน (Bookable):
//  · เงินสด/แพลตฟอร์ม = ยอดระบบ (รับที่จุดขาย/ยอดค้างรับ)
//  · ดิจิทัล (พร้อมเพย์/โอน): ตรวจแล้ว → verifiedAmount (Actual) · ไม่พบยอด → 0 · ยังไม่ตรวจ → null (ค้าง ไม่รวมยอดปิดวัน)
const saleBookable = (s)=>{ const sys=saleTotal(s); const digital=(s.pay==='promptpay'||s.pay==='transfer'); if(!digital) return sys; if(s.payStatus==='not_found') return 0; if(s.verified) return (s.verifiedAmount!=null&&s.verifiedAmount!==''?Number(s.verifiedAmount):sys); return null; };
// re-check ยอดก่อนปิดวัน (Validation) — คืนรายการค้าง/ส่วนต่าง เพื่อเตือนก่อน lock
const validateDayClose = (rows)=>{ let bookable=0, expected=0, variance=0; const pending=[], notFound=[], discrepancy=[];
  (rows||[]).forEach(s=>{ const sys=saleTotal(s); expected+=sys; const b=saleBookable(s);
    if(b==null){ pending.push(s); return; } bookable+=b; const d=+(b-sys).toFixed(2);
    if(s.payStatus==='not_found') notFound.push(s); else if(d!==0) { discrepancy.push(s); variance+=d; } });
  return { bookable:+bookable.toFixed(2), expected:+expected.toFixed(2), variance:+variance.toFixed(2), pending, notFound, discrepancy, ok: pending.length===0 }; };
const saleCost  = (s)=> s.items.reduce((a,[id,q])=> a + (menuById(id)?.cost||0)*q, 0);

// ─── VAT (ภาษีมูลค่าเพิ่ม) ───
// mode: 'off' ไม่คิด · 'inclusive' ราคารวม VAT แล้ว · 'exclusive' บวก VAT เพิ่มท้ายบิล
function kdVat(sub, pay){
  sub = Number(sub)||0;
  const mode = (pay && pay.vatMode) || 'off';
  const rate = Number(pay && pay.vatRate); const r = (rate>0?rate:7)/100;
  if(mode==='inclusive'){ const base = sub/(1+r); return { mode, rate:r*100, base, vat: sub-base, gross: sub }; }
  if(mode==='exclusive'){ const vat = sub*r;    return { mode, rate:r*100, base: sub, vat, gross: sub+vat }; }
  return { mode:'off', rate:r*100, base: sub, vat:0, gross: sub };
}

/* ─────────────────── raw materials / inventory (stock mode) ─────────────────── */
// units grouped by family: weight(w)→base g, volume(v)→base ml, count(c)→base pcs
const RUNITS = [
  { id:'g',  th:'กรัม', en:'g',   fam:'w', base:1 },
  { id:'kg', th:'กก.',  en:'kg',  fam:'w', base:1000 },
  { id:'ml', th:'มล.',  en:'ml',  fam:'v', base:1 },
  { id:'l',  th:'ลิตร', en:'L',   fam:'v', base:1000 },
  { id:'pcs',th:'ชิ้น', en:'pcs', fam:'c', base:1 },
];
const runit = (id)=> RUNITS.find(u=>u.id===id) || RUNITS[0];
const TRACK_UNIT = { w:'g', v:'ml', c:'pcs' };            // stock is tracked in the base unit of each family
const buyUnitsFor = (trackId)=> RUNITS.filter(u=>u.fam===runit(trackId).fam);
// convert a purchased qty (in fromId) into the raw material's tracking unit (toId)
const convQty = (qty, fromId, toId)=>{ const f=runit(fromId), t=runit(toId); const n=Number(qty)||0; return f.fam!==t.fam ? n : n*f.base/t.base; };
const rawValue = (r)=> (Number(r.stock)||0) * (Number(r.avgCost)||0);

const RAW_CATS = [
  { id:'meat',  th:'เนื้อสัตว์',       en:'Meat',      emoji:'🥩' },
  { id:'grain', th:'ข้าว / เส้น',     en:'Rice/Noodle', emoji:'🍚' },
  { id:'veg',   th:'ผัก / ผลไม้',      en:'Produce',   emoji:'🥬' },
  { id:'dry',   th:'เครื่องปรุง',       en:'Seasoning', emoji:'🧂' },
  { id:'drink', th:'วัตถุเครื่องดื่ม', en:'Drinks',  emoji:'☕' },
  { id:'sweet', th:'ของหวาน',        en:'Dessert',   emoji:'🥭' },
  { id:'pack',  th:'บรรจุภัณฑ์',     en:'Packaging', emoji:'📦' },
  { id:'other', th:'อื่นๆ',          en:'Other',     emoji:'🥚' },
];
// stock in tracking unit; avgCost in ฿ per tracking unit; low = low-stock threshold (tracking unit)
const RAW = [
  { id:'r_pork',       cat:'meat',  th:'หมูสับ',        unit:'g',   stock:4200,  avgCost:0.18, low:1000 },
  { id:'r_shrimp',     cat:'meat',  th:'กุ้งสด',        unit:'g',   stock:1800,  avgCost:0.38, low:600 },
  { id:'r_chicken',    cat:'meat',  th:'เนื้อไก่',       unit:'g',   stock:3500,  avgCost:0.09, low:800 },
  { id:'r_crispypork', cat:'meat',  th:'หมูกรอบ',       unit:'g',   stock:1500,  avgCost:0.28, low:500 },
  { id:'r_rice',       cat:'grain', th:'ข้าวสาร',        unit:'g',   stock:12000, avgCost:0.03, low:3000 },
  { id:'r_noodle',     cat:'grain', th:'เส้นก๋วยเตี๋ยว', unit:'g', stock:3000, avgCost:0.05, low:800 },
  { id:'r_padthai',    cat:'grain', th:'เส้นจันท์',      unit:'g',   stock:1500,  avgCost:0.06, low:500 },
  { id:'r_egg',        cat:'other', th:'ไข่ไก่',         unit:'pcs', stock:60,    avgCost:4,    low:24 },
  { id:'r_basil',      cat:'veg',   th:'ใบกะเพรา',      unit:'g',   stock:500,   avgCost:0.08, low:150 },
  { id:'r_beansprout', cat:'veg',   th:'ถั่วงอก',       unit:'g',   stock:900,   avgCost:0.03, low:300 },
  { id:'r_lime',       cat:'veg',   th:'มะนาว',         unit:'pcs', stock:40,    avgCost:3,    low:15 },
  { id:'r_oil',        cat:'dry',   th:'น้ำมันพืช',      unit:'ml',  stock:5000,  avgCost:0.06, low:1500 },
  { id:'r_sauce',      cat:'dry',   th:'ซอสปรุงรส',     unit:'ml',  stock:3000,  avgCost:0.04, low:800 },
  { id:'r_sugar',      cat:'dry',   th:'น้ำตาล',        unit:'g',   stock:4000,  avgCost:0.03, low:1000 },
  { id:'r_tea',        cat:'drink', th:'ผงชาไทย',       unit:'g',   stock:900,   avgCost:0.12, low:300 },
  { id:'r_coffee',     cat:'drink', th:'เมล็ดกาแฟ',     unit:'g',   stock:700,   avgCost:0.50, low:200 },
  { id:'r_milk',       cat:'drink', th:'นมข้น',         unit:'ml',  stock:4000,  avgCost:0.05, low:1000 },
  { id:'r_soda',       cat:'drink', th:'โซดา',           unit:'ml',  stock:6000,  avgCost:0.02, low:1500 },
  { id:'r_mango',      cat:'sweet', th:'มะม่วงสุก',      unit:'pcs', stock:30,    avgCost:12,   low:12 },
  { id:'r_stickyrice', cat:'sweet', th:'ข้าวเหนียว',     unit:'g',   stock:3000,  avgCost:0.04, low:800 },
  { id:'r_coconut',    cat:'sweet', th:'กะทิ',           unit:'ml',  stock:2500,  avgCost:0.06, low:700 },
  { id:'r_box',        cat:'pack',  th:'กล่องอาหาร',     unit:'pcs', stock:400,   avgCost:1.2,  low:100 },
  { id:'r_cup',        cat:'pack',  th:'แก้วน้ำ',        unit:'pcs', stock:500,   avgCost:0.9,  low:120 },
  { id:'r_bag',        cat:'pack',  th:'ถุงหิ้ว',        unit:'pcs', stock:800,   avgCost:0.3,  low:200 },
];
const rawById = (list, id)=> (list||RAW).find(r=>r.id===id);

// purchase log: one shopping trip on a date, many lines. { id, date, note, lines:[{rmId, qty, unit, price}] }
const _today = new Date();
const _d = (off)=>{ const x=new Date(_today); x.setDate(x.getDate()-off); return x.toISOString().slice(0,10); };
const SEED_PURCHASES = [
  { id:'pc1', date:_d(6), note:'ตลาดสดเช้า', lines:[
    ['r_pork',5,'kg',900],['r_chicken',4,'kg',320],['r_rice',10,'kg',300],['r_egg',30,'pcs',120],['r_basil',0.5,'kg',40] ] },
  { id:'pc2', date:_d(3), note:'ส่งของแห้ง', lines:[
    ['r_oil',5,'l',300],['r_sauce',3,'l',120],['r_sugar',4,'kg',120],['r_box',200,'pcs',240],['r_cup',300,'pcs',270],['r_bag',500,'pcs',150] ] },
  { id:'pc3', date:_d(1), note:'ตลาดเช้า', lines:[
    ['r_shrimp',2,'kg',760],['r_beansprout',1,'kg',30],['r_lime',30,'pcs',90],['r_mango',12,'pcs',144],['r_milk',2,'l',100] ] },
].map(p=>({ ...p, lines: p.lines.map(([rmId,qty,unit,price])=>({ rmId, qty, unit, price })) }));

// effective per-item cost — HYBRID per item (ไม่ขึ้นกับโหมดร้าน):
//   มีสูตร (recipe) → คิดจาก qty × avgCost ของวัตถุดิบ (+ ตัดสต๊อก) · ไม่มี → ต้นทุน/จาน (bom/flat)
// mode ยังรับไว้เพื่อความเข้ากันได้ย้อนหลัง แต่ไม่ใช้ตัดสินใจแล้ว
function effItemCost(item, rawList, mode){
  if(!item) return 0;
  const useRecipe = item.costMethod ? item.costMethod==='recipe' : !!(item.recipe && item.recipe.length);
  if(useRecipe && item.recipe && item.recipe.length){
    return item.recipe.reduce((a,[rmId,qty])=>{ const r=rawById(rawList,rmId); return a + (r? (Number(r.avgCost)||0)*(Number(qty)||0) : 0); }, 0);
  }
  if(item.bom && item.bom.length) return item.bom.reduce((a,i)=>a+(i&&i.mode==='bulk'?0:(Number(i&&i.cost)||0)),0) || (Number(item.cost)||0);
  return Number(item.cost)||0;
}
function effSaleCost(sale, menu, rawList, mode){
  return sale.items.reduce((a,[id,q])=>{ const m=(menu||MENU).find(x=>x.id===id)||menuById(id); return a + effItemCost(m, rawList, mode)*q; }, 0);
}

const CHANNELS = {
  walkin:  { th:'หน้าร้าน',      en:'Walk-in',      c:'#57635C', prefix:'W', ic:IC.store, online:false },
  takeaway:{ th:'กลับบ้าน',      en:'Take away',    c:'#0E9463', prefix:'A', ic:IC.bag,   online:false },
  dinein:  { th:'ทานที่ร้าน',    en:'Dine-in',      c:'#3B82C4', prefix:'T', ic:IC.receipt, online:false },
  line:    { th:'LINE OA',       en:'LINE OA',      c:'#06C755', prefix:'L', ic:IC.bag,   online:true },
  grab:    { th:'Grab',          en:'Grab',         c:'#00B14F', prefix:'G', ic:IC.moto,  online:true },
  linemn:  { th:'LINE MAN',      en:'LINE MAN',     c:'#12B981', prefix:'M', ic:IC.moto,  online:true },
  shopee:  { th:'ShopeeFood',    en:'ShopeeFood',   c:'#EE4D2D', prefix:'S', ic:IC.moto,  online:true },
  panda:   { th:'foodpanda',     en:'foodpanda',    c:'#D70F64', prefix:'P', ic:IC.moto,  online:true },
  delivery:{ th:'เดลิเวอรีร้าน', en:'Own delivery', c:'#8257C4', prefix:'D', ic:IC.moto,  online:true },
};

/* ── sale-mode config (ช่องทางสำหรับ "คีย์บันทึกการขายเอง" — ไม่ใช่รับออเดอร์อัตโนมัติ) ── */
const DEFAULT_SALEMODES = ['takeaway','dinein','walkin','grab','linemn','shopee'];
function chMeta(cfg, k){
  return (cfg && cfg.custom && cfg.custom[k]) || CHANNELS[k] || { th:k, en:k, c:'#57635C', prefix:(String(k)[0]||'Q').toUpperCase(), online:false };
}
function allSaleModes(cfg){
  cfg = cfg||{};
  const base = (cfg.order && cfg.order.length) ? cfg.order.slice() : DEFAULT_SALEMODES.slice();
  Object.keys(cfg.custom||{}).forEach(k=>{ if(base.indexOf(k)<0) base.push(k); });
  return base;
}
function activeSaleModes(cfg){ cfg=cfg||{}; return allSaleModes(cfg).filter(k=> !(cfg.off && cfg.off[k])); }
// delivery platform → ร้านยังไม่ได้รับเงิน (แพลตฟอร์มโอนให้ทีหลัง) → ปิดบิลเป็น tender ตามชื่อแพลตฟอร์ม ไม่รับเงินสด
function isPlatform(cfg, k){ return !!chMeta(cfg,k).online; }
// เมนูขายช่องทางนี้ไหม (ไม่กำหนด = ขายได้ทุกช่องทาง)
function menuSellsOn(item, k){ const ch=item&&item.channels; return (!ch||!ch.length) ? true : ch.indexOf(k)>=0; }
// ราคาต่อช่องทาง (ไม่ตั้ง = ใช้ราคาปกติ)
function priceFor(item, k){ const pc=item&&item.priceByCh; const v=pc?pc[k]:null; return (v!=null && v!=='') ? (Number(v)||0) : Number((item&&item.price)||0); }
// สูตรตัดสต๊อกต่อช่องทาง (แพ็กเกจต่างกัน) — ไม่ตั้ง = ใช้สูตรเริ่มต้น
function recipeFor(item, ch){ const rb=item&&item.recipeByCh; if(rb && ch && Array.isArray(rb[ch]) && rb[ch].length) return rb[ch]; return (item&&item.recipe)||[]; }
// ── ค่าส่ง (นโยบายต่อร้าน): mode customer=ลูกค้าจ่าย · shop=ร้านออกให้ · distance=คิดตามระยะ
function deliveryCfg(shop){ const d=(shop&&shop.delivery)||{}; return { mode:d.mode||'customer', flat:(d.flat!=null?Number(d.flat):20), base:(d.base!=null?Number(d.base):FARE.base), perKm:(d.perKm!=null?Number(d.perKm):FARE.perKm) }; }
function deliveryFee(shop, distKm){ const c=deliveryCfg(shop); if(c.mode==='distance'){ const extra=Math.max(0,(Number(distKm)||0)-FARE.baseKm); return Math.max(FARE.min, Math.ceil(c.base+extra*c.perKm)); } return Math.round(c.flat)||0; }
function customerPaysDelivery(shop){ return deliveryCfg(shop).mode!=='shop'; }

// queue label: dine-in uses table number; others use prefix + running no.
function qLabel(ch, n, table){
  if(ch==='dinein') return table!=null ? 'โต๊ะ '+table : '—';
  const p = (CHANNELS[ch]||{}).prefix || 'Q';
  return p + String(n||0).padStart(3,'0');
}
const PAYS = {
  promptpay:{th:'พร้อมเพย์ QR',en:'PromptPay',ic:IC.qr},
  transfer :{th:'โอน + สลิป',  en:'Transfer', ic:IC.bank},
  cash     :{th:'เงินสด',      en:'Cash',     ic:IC.cash},
  cod      :{th:'เก็บปลายทาง', en:'Cash on delivery', ic:IC.truck},
};

// rider jobs
const RIDER_JOBS = [
  { id:'j1', shop:'ครัวขายดี', from:'ซ.ลาดพร้าว 71', to:'คอนโด The Nest ลาดพร้าว', dist:2.3, mins:12, items:3, pay:'cod', total:190 },
  { id:'j2', shop:'ครัวขายดี', from:'ซ.ลาดพร้าว 71', to:'ม.เสนานิเวศน์ 1', dist:3.8, mins:18, items:2, pay:'promptpay', total:120 },
  { id:'j3', shop:'ครัวขายดี', from:'ซ.ลาดพร้าว 71', to:'ออฟฟิศ Rich Park', dist:1.4, mins:8, items:5, pay:'promptpay', total:310 },
].map(j=>({ ...j, fee:calcFare(j.dist) }));

/* ─────────────────────────── shared UI ─────────────────────────── */
// top bar (title + optional left/right)
function TopBar({ title, sub, left, right, tone='light' }){
  const dark = tone==='brand';
  return (
    <div style={{ paddingTop:56, background: dark?'var(--brand)':'transparent',
      color: dark?'#fff':'var(--ink)', position:'relative', zIndex:3 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 18px 14px' }}>
        {left}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:22, fontWeight:700, lineHeight:1.15, letterSpacing:'-.01em' }}>{title}</div>
          {sub && <div style={{ fontSize:13, opacity:.72, marginTop:2 }}>{sub}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}

// bottom tab bar
function TabBar({ tabs, active, onChange }){
  return (
    <div style={{ display:'flex', background:'#fff', borderTop:'1px solid var(--hair)',
      padding:'8px 6px calc(8px + 20px)', position:'relative', zIndex:5,
      boxShadow:'0 -6px 20px rgba(20,40,30,.05)' }}>
      {tabs.map(tb=>{
        const on = tb.key===active;
        return (
          <button key={tb.key} onClick={()=>onChange(tb.key)} style={{
            flex:1, border:'none', background:'none', cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            color: on?'var(--brand)':'var(--ink-3)', padding:'4px 2px', position:'relative' }}>
            <div style={{ transform: on?'translateY(-1px)':'none', transition:'transform .15s' }}>
              {React.cloneElement(tb.icon,{ size:23, color:'currentColor', stroke: on?2.3:1.9 })}
            </div>
            <span style={{ fontSize:11, fontWeight: on?700:500 }}>{tb.label}</span>
            {tb.badge>0 && <span style={{ position:'absolute', top:-2, right:'50%', marginRight:-22,
              background:'var(--danger)', color:'#fff', fontSize:10, fontWeight:700,
              minWidth:17, height:17, borderRadius:9, display:'flex', alignItems:'center',
              justifyContent:'center', padding:'0 4px' }}>{tb.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

// bottom sheet
// ยึด max-height ตาม visualViewport แทน % ตายตัว — กันคีย์บอร์ดมือถือเด้งมาทับปุ่มด้านล่างชีต (เช่นปุ่มบันทึกเมนู/หมวดหมู่)
function useViewportH(){
  const [h,setH] = useState(()=> (typeof window!=='undefined' && window.visualViewport) ? window.visualViewport.height : (typeof window!=='undefined' ? window.innerHeight : 800));
  useEffect(()=>{
    if(typeof window==='undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = ()=> setH(vv.height);
    vv.addEventListener('resize', onResize);
    onResize();
    return ()=> vv.removeEventListener('resize', onResize);
  },[]);
  return h;
}
function Sheet({ open, onClose, children, height }){
  const vh = useViewportH();
  if(!open) return null;
  const pct = (parseFloat(height)||86)/100;
  return (
    <div onClick={onClose} style={{ position:'absolute', inset:0, zIndex:40,
      background:'rgba(15,25,20,.42)', display:'flex', alignItems:'flex-end',
      animation:'kdFade .2s ease' }}>
      <div className="kd-slideup" onClick={e=>e.stopPropagation()} style={{ width:'100%',
        background:'#fff', borderRadius:'26px 26px 0 0', maxHeight:Math.round(vh*pct),
        display:'flex', flexDirection:'column', overflow:'hidden', paddingBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px' }}>
          <div style={{ width:40, height:5, borderRadius:3, background:'var(--hair-2)' }}/>
        </div>
        {children}
      </div>
    </div>
  );
}

// toast
function useToast(){
  const [msg,setMsg] = useState(null);
  const show = (m)=>{ setMsg(m); setTimeout(()=>setMsg(null), 1900); };
  const node = msg && (
    <div style={{ position:'absolute', left:'50%', bottom:96, transform:'translateX(-50%)',
      zIndex:60, background:'var(--ink)', color:'#fff', padding:'11px 20px', borderRadius:999,
      fontSize:14, fontWeight:600, boxShadow:'var(--shadow-lg)', whiteSpace:'nowrap',
      animation:'kdPop .25s ease both' }}>{msg}</div>
  );
  return { show, node };
}

// stat pill
function Stat({ label, value, tone, sub }){
  return (
    <div className="kd-card" style={{ padding:'14px 15px', flex:1, minWidth:0 }}>
      <div style={{ fontSize:12, color:'var(--ink-2)', fontWeight:600 }}>{label}</div>
      <div className="num" style={{ fontSize:22, fontWeight:700, marginTop:3, color: tone||'var(--ink)', letterSpacing:'-.02em' }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

// image placeholder tile
function FoodTile({ item, size=64, radius=14 }){
  const cats = useCats();
  const fs = typeof size==='number' ? size*0.42 : '2.6rem';
  return (
    <div style={{ width:size, height:size, borderRadius:radius, background:item.tone||'#EEE',
      flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:fs, position:'relative', overflow:'hidden',
      backgroundImage: item.img?`url(${item.img})`:'none', backgroundSize:'cover', backgroundPosition:'center' }}>
      {!item.img && <span>{item.emoji || cats.find(c=>c.id===item.cat)?.emoji || '🍽️'}</span>}
    </div>
  );
}

Object.assign(window, {
  DICT, tr, LangCtx, useT, DataCtx, useCats, money, money2, Icon, IC, FARE, calcFare, kdShopOpen, kdShiftExpired,
  CATS, MENU, menuById, SEED_SALES, saleTotal, saleCost, kdVat, CHANNELS, qLabel, PAYS, RIDER_JOBS,
  DEFAULT_SALEMODES, chMeta, allSaleModes, activeSaleModes, isPlatform, menuSellsOn, priceFor, recipeFor,
  deliveryCfg, deliveryFee, customerPaysDelivery,
  RUNITS, runit, TRACK_UNIT, buyUnitsFor, convQty, rawValue, RAW_CATS, RAW, rawById, SEED_PURCHASES, effItemCost, effSaleCost,
  TopBar, TabBar, Sheet, useToast, Stat, FoodTile,
  useState, useEffect, useRef, useContext, createContext,
});
