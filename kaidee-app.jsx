// kaidee-app.jsx — root: shared store, role launcher, language toggle, device frame
const { useState:aState, useMemo:aMemo } = React;

const subC = (items)=> items.reduce((a,[id,q])=>a+(menuById(id)?.price||0)*q,0);
const costC= (items)=> items.reduce((a,[id,q])=>a+(menuById(id)?.cost||0)*q,0);

const SEED_ORDERS = [
  { id:'o1041', no:1041, items:[['m8',2]],          channel:'line',    pay:'promptpay', status:'cooking', customer:'คุณแอน',  when:'12:30', fee:0, qnum:31 },
  { id:'o1042', no:1042, items:[['m1',2],['m10',1]],channel:'line',    pay:'promptpay', status:'new',     customer:'คุณฟ้า',  when:'เลย (15–25 นาที)', fee:0, qnum:32 },
  { id:'o1043', no:1043, items:[['m6',1],['m12',1]],channel:'grab',    pay:'promptpay', status:'new',     customer:'Grab · คุณโจ', addr:'ทองหล่อ 10', when:'เลย', fee:0, qnum:47, platNo:'GF-8842' },
  { id:'o1044', no:1044, items:[['m5',2],['m11',2]],channel:'linemn',  pay:'promptpay', status:'cooking', customer:'LINE MAN · Bee', addr:'อารีย์', when:'เลย', fee:0, qnum:8, platNo:'LM-1073' },
  { id:'o1045', no:1045, items:[['m3',1],['m4',1],['m10',2]],channel:'shopee', pay:'promptpay', status:'new', customer:'ShopeeFood · Mac', addr:'ลาดพร้าว 101', when:'เลย', fee:0, qnum:15, platNo:'SPF-5521' },
  { id:'o1046', no:1046, items:[['m2',1]],          channel:'takeaway',pay:'cash',      status:'ready',   customer:'พี่โบว์', when:'เลย', fee:0, qnum:12 },
  { id:'o1047', no:1047, items:[['m6',2],['m12',2]],channel:'delivery',pay:'cod',        status:'ready',   customer:'คุณต้น',  addr:'ม.เสนานิเวศน์ 1', when:'เลย', fee:calcFare(2.5), qnum:3 },
].map(o=>({ ...o, total: subC(o.items)+(o.fee||0), cost: costC(o.items) }));

/* ══════════════ PERSISTENCE (localStorage) ══════════════ */
const LS_KEY = 'kaidee_pos_v1';
const loadStore = ()=>{ try{ return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }catch(e){ return {}; } };
const _saved = loadStore();
const pick = (k, fallback)=> (_saved[k] !== undefined ? _saved[k] : fallback);
const resetStore = ()=>{ try{ localStorage.removeItem(LS_KEY); }catch(e){} location.reload(); };
// blank baseline for a brand-new shop (no demo data)
const _blankTrial = ()=>{ const d=new Date(); d.setDate(d.getDate()+30); return { plan:'trial', expiry:d.toISOString(), auto:false, card:null }; };
const BLANK_STORE = ()=>({
  lang: 'th', menu: [], cats: CATS.map(c=>({...c})), sales: [], orders: [],
  pay: { shopName:'ร้านของฉัน', promptpay:'', bank:'', acct:'', accept:{ promptpay:true, cash:true, cod:true }, autoSlip:true, slipReq:'optional', custNameReq:'optional', platPick:'dropdown', instantPay:false, payTiming:'anytime', print:{ mode:'ask', paper:'80', kitchenAuto:false }, vatMode:'off', vatRate:7, taxId:'', taxAddr:'', taxBranch:'สำนักงานใหญ่', loyalty:{ on:true, perBaht:25, earnOn:'paid', stampGoal:10, stampReward:'ฟรี 1 เมนู', rewardAt:100, rewardBaht:20, rewardText:'ส่วนลด ฿20', tierSilver:120, tierGold:300 } },
  members: [],
  shop: { name:'ร้านของฉัน', branch:'', emoji:'🍽️', address:'', map:'', lat:'13.7563', lng:'100.5018', open:'08:00', close:'20:00', isOpen:true, phone:'' },
  sub: _blankTrial(), costMode:'simple', raw: [], purchases: [], wastes: [],
  register: { open:false, openFloat:0, openedAt:null, moves:[] }, cashDays: [], quotes: [], riders: [],
});
const startNewShop = async (consent)=>{
  // โหมด LIVE: ล้างข้อมูลบน server ด้วย (ออเดอร์/ยอดขาย/เมนู/สมาชิก) ไม่งั้นโหลดใหม่แล้วดึงของเดิมกลับมา
  try{
    let ownerLine=''; try{ const st=JSON.parse(localStorage.getItem(LS_KEY)||'{}'); ownerLine=(st.shop&&st.shop.owner&&st.shop.owner.line)||''; }catch(e){}
    if(!ownerLine){ try{ ownerLine=(window.__lineUser&&window.__lineUser.userId)||''; }catch(e){} }
    const rec = consent ? { ...consent, shopId:(function(){ try{ const st=JSON.parse(localStorage.getItem(LS_KEY)||'{}'); return (st.shop&&st.shop.shopId)||''; }catch(e){ return ''; } })(), ownerLine, at:Date.now() } : null;
    if(rec){ try{ const log=JSON.parse(localStorage.getItem('kd_deletion_log')||'[]'); log.push(rec); localStorage.setItem('kd_deletion_log', JSON.stringify(log)); }catch(e){} }
    if(window.KD_LIVE && window.KD_API && window.KD_API.resetShop){
      await window.KD_API.resetShop(null, { wipeMenu:true, ownerLine, consent:rec }).catch(()=>{});
    }
  }catch(e){}
  try{ localStorage.setItem(LS_KEY, JSON.stringify(BLANK_STORE())); }catch(e){}
  location.reload();
};
class KDBoundary extends React.Component{
  constructor(p){ super(p); this.state={ err:null }; }
  static getDerivedStateFromError(err){ return { err }; }
  componentDidCatch(err,info){ try{ console.error('[KaiDee] screen crash:', err, info); }catch(e){} }
  render(){
    if(!this.state.err) return this.props.children;
    const TH = this.props.lang!=='en';
    return (
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:'30px', textAlign:'center', background:'var(--bg,#f5f7f5)' }}>
        <div style={{ fontSize:40 }}>😵‍💫</div>
        <div style={{ fontSize:18, fontWeight:700 }}>{TH?'หน้านี้มีปัญหาชั่วคราว':'This screen hit an error'}</div>
        <div style={{ fontSize:13, color:'var(--ink-3,#889)', maxWidth:280, lineHeight:1.55 }}>{TH?'ข้อมูลของคุณยังอยู่ครบ · ลองกดใหม่ หรือกลับหน้าหลัก':'Your data is safe. Try again or go home.'}</div>
        {this.state.err && <div style={{ fontSize:11, color:'#c0392b', fontFamily:'monospace', maxWidth:300, wordBreak:'break-word', background:'#fff', borderRadius:8, padding:'8px 10px', lineHeight:1.4 }}>{String((this.state.err&&this.state.err.message)||this.state.err).slice(0,200)}</div>}
        <div style={{ display:'flex', gap:10, marginTop:4 }}>
          <button onClick={()=>this.setState({ err:null })} className="kd-btn kd-btn-primary" style={{ padding:'12px 20px' }}>{TH?'ลองใหม่':'Retry'}</button>
          <button onClick={()=>{ this.setState({ err:null }); this.props.onHome&&this.props.onHome(); }} className="kd-btn" style={{ padding:'12px 20px', background:'#fff', color:'var(--ink-2,#556)', boxShadow:'var(--shadow)' }}>{TH?'หน้าหลัก':'Home'}</button>
        </div>
      </div>
    );
  }
}

/* ฟิตเนส = ฝังโมดูล Fitness POS ใน iframe ให้อยู่ในกรอบแอปเดียวกัน (ไม่เด้งออกหน้าอื่น · ไม่ชน CSS แอปหลัก) */
function FitnessFrame({ shopId, name }){
  const src = 'Fitness POS.html?embed=1'+(shopId?('&shop='+encodeURIComponent(shopId)):'')+(name?('&name='+encodeURIComponent(name)):'');
  return (
    <div className="kd-screen" style={{ background:'#DDE6E3' }}>
      <iframe src={src} title="Fitness" allow="clipboard-write"
        style={{ border:'none', width:'100%', height:'100%', flex:1, display:'block' }}/>
    </div>
  );
}

/* สปอนเซอร์ = ฝังศูนย์จัดการสปอนเซอร์ใน iframe (อยู่ในกรอบแอปเดียว · ไม่เด้งออกหน้าอื่น) */
function SponsorFrame({ shopId, name }){
  const src = 'Sponsor Console.html?embed=1'+(shopId?('&shop='+encodeURIComponent(shopId)):'')+(name?('&name='+encodeURIComponent(name)):'');
  return (
    <div className="kd-screen" style={{ background:'#E7ECEA' }}>
      <iframe src={src} title="Sponsor" allow="clipboard-write"
        style={{ border:'none', width:'100%', height:'100%', flex:1, display:'block' }}/>
    </div>
  );
}

function KaiDeeApp(){
  const [lang,setLang] = aState(()=>pick('lang','th'));
  // ถ้าเปิดจริงในแอป LINE (LIFF) → เข้ามุมมองลูกค้าทันที ไม่ต้องกดเลือก role
  const _liff = (typeof window!=='undefined' && window.KD_LIFF) || {};
  // deep-link: ?go=signup → CRM · ?role=merchant|customer|rider → มุมนั้นตรง · ?shop=ID → ลูกค้าสั่งอาหาร
  const initRole = (()=>{ try{ const u=new URL(location.href);
    const _fresh=(()=>{ try{ return sessionStorage.getItem('kd_fresh_signup')==='1'; }catch(e){ return false; } })();
    // อ่านพารามิเตอร์ + unwrap liff.state (LINE ห่อ ?shop=&role= ไว้ใน liff.state เมื่อเปิดผ่าน LIFF)
    // อ่านพารามิเตอร์ + unwrap liff.state ที่ LINE ห่อมา (รองรับซ้อนหลายชั้น = recursive)
    const qp=(()=>{ const out={}; const dig=(sp,d)=>{ if(!sp||d>6) return; sp.forEach((v,k)=>{ if(out[k]==null) out[k]=v; }); const st=sp.get('liff.state'); if(st){ try{ dig(new URLSearchParams(st.replace(/^[/?]+/,'')), d+1); }catch(e){} } };
      try{ dig(u.searchParams,0); }catch(e){} return (k)=> out[k]!=null?out[k]:null; })();
    // ⭐ จอคิว (role=board) = ชนะทุกอย่าง รวม go=signup (LIFF endpoint บาง config มี ?go=signup ติดมา) → เช็คก่อนสุด
    // เปิดผ่าน LINE → LIFF login redirect อาจล้าง liff.state → จำไว้ใน sessionStorage แล้วกู้กลับ
    try{ if(qp('role')==='board'){ sessionStorage.setItem('kd_dl_board','1'); if(qp('shop')) sessionStorage.setItem('kd_dl_shop', qp('shop')); }
      if(qp('role')==='board' || sessionStorage.getItem('kd_dl_board')==='1') return 'board'; }catch(e){}
    // ⭐ จอครัว KDS (role=kds) = จอแสดงผลเช่นเดียวกับ board — ไม่ต้องล็อกอิน LINE
    try{ if(qp('role')==='kds'){ sessionStorage.setItem('kd_dl_kds','1'); if(qp('shop')) sessionStorage.setItem('kd_dl_shop', qp('shop')); }
      if(qp('role')==='kds' || sessionStorage.getItem('kd_dl_kds')==='1') return 'kds'; }catch(e){}
    // ⭐ หน้า "ร้านในตลาดนี้" (role=market&market=<ชื่อตลาด>) — ดูรายชื่อร้านได้เลย ไม่ต้องล็อกอิน LINE ก่อน
    // ธงนี้จำไว้กู้ตอน LINE ล้าง liff.state ทิ้ง — แต่ต้องเลิกจำทันทีที่ลูกค้าเจาะเข้าร้านใดร้านหนึ่ง (?shop=)
    // ไม่งั้นกดร้านจากหน้ารวมร้าน = navigate แล้วเด้งกลับหน้ารวมทุกครั้ง เข้าสั่งอาหารไม่ได้เลย
    try{ if(qp('role')==='market'){ sessionStorage.setItem('kd_dl_market','1'); }
      if(qp('shop')) sessionStorage.removeItem('kd_dl_market');
      else if(qp('role')==='market' || sessionStorage.getItem('kd_dl_market')==='1') return 'market'; }catch(e){}
    // ⭐ หน้าแรกของเว็บ (ไม่มีพารามิเตอร์) หรือ ?go=signup → ส่งไปหน้า "สมัครใช้งาน" (Signup Chooser) ให้เลือกระบบก่อน
    // ข้าม chooser เมื่อ: มีร้านในเครื่องแล้ว · มี sys/shop/role/liff.state มาด้วย (เข้าตรงตามเดิม)
    (()=>{ try{
      // "ไม่มีพารามิเตอร์" = ไม่มีคีย์ที่แอปใช้ (พารามิเตอร์แปลกปลอมอย่าง ?t= / ?utm_ / ?fbclid ไม่นับ)
      const _noParam=!['go','shop','role','sys','liff.state','table','kds','board','pay','order','ref'].some(k=>qp(k)!=null);
      if(!(_noParam||(qp('go')==='signup'))) return;
      if(qp('shop')||qp('role')||qp('sys')||qp('liff.state')) return;
      if(_fresh) return;   // เพิ่งสมัครเสร็จ = เข้าแอปตรง
      // ⭐ FX-001: เครื่องนี้มีร้านอยู่แล้ว = เจ้าของร้านกลับมาใช้งาน → เข้าแอปตรง ไม่เด้งหน้าสมัคร
      try{ const st=JSON.parse(localStorage.getItem('kaidee_pos_v1')||'{}');
        if(st && st.shop && (st.shop.shopId || st.shop.name)) return; }catch(e){}
      // 'kaidee' = ค่า fallback ของ kaidee-api ไม่ใช่ร้านจริงของเครื่องนี้ → ยังต้องให้เลือกระบบก่อน
      try{ const _ks=localStorage.getItem('kd_shop'); if(_ks && _ks!=='kaidee') return; }catch(e){}
      location.replace('Signup Chooser.html');
    }catch(e){} })();
    if(qp('go')==='signup' && !qp('shop') && !qp('role')) return 'crm';
    const r=qp('role');
    if(r==='staff'){ try{ localStorage.setItem('kd_staff','1'); }catch(e){} return 'merchant'; }
    if(r==='merchant'){ try{ localStorage.removeItem('kd_staff'); }catch(e){} return _fresh?'merchant':'checking'; }
    if(['customer','rider','crm','board','kds'].includes(r)) return r;
    if(qp('shop')){
      // เจ้าของเปิดลิงก์ร้านตัวเอง (บุ๊กมาร์กหลังบ้าน) → หน้ายินดีก่อน แล้วเข้าหลังร้าน
      try{ const st=JSON.parse(localStorage.getItem('kaidee_pos_v1')||'{}'); if(st.shop && st.shop.shopId===qp('shop')){ try{ localStorage.removeItem('kd_staff'); }catch(e){} return _fresh?'merchant':'checking'; } }catch(e){}
      return 'customer';
    }
    // เครื่องนี้เคยสมัคร/เป็นเจ้าของร้านแล้ว → โชว์หน้ายินดี/เข้าสู่ระบบสักครู่ ก่อนเข้าหลังร้าน
    try{ const st=JSON.parse(localStorage.getItem('kaidee_pos_v1')||'{}'); if(st.shop && st.shop.shopId) return 'checking'; }catch(e){}
    // เปิดผ่านแอป LINE (LIFF) แต่ยังไม่รู้ว่าเป็นเจ้าของร้านไหม → โชว์หน้ารอเช็ค (กันหน้าสมัครเด้งซ้ำ)
    if(typeof window!=='undefined' && window.KD_LIFF && window.KD_LIFF.mode==='line') return 'checking';
  }catch(e){} return null; })();
  const [role,setRole] = aState(initRole);   // null | merchant | customer | rider | crm
  const [help,setHelp] = aState(false);
  const [brand,setBrand] = aState(()=>{ try{ return JSON.parse(localStorage.getItem('kaidee_brand_v1'))||{}; }catch(e){ return {}; } });
  React.useEffect(()=>{ if(!(window.KD_API && window.KD_API.getBrand)) return; window.KD_API.getBrand().then(b=>{ if(b&&(b.appName||b.logo)){ setBrand(b); window.KD_BRAND=b; try{localStorage.setItem('kaidee_brand_v1',JSON.stringify(b));}catch(e){} } }).catch(()=>{}); },[]);

  // ---- shared store (persisted to localStorage) ----
  const [menu,setMenu]   = aState(()=>pick('menu', MENU.map(m=>({...m}))));
  const [cats,setCats]   = aState(()=>pick('cats', CATS.map(c=>({...c}))));
  const [chanCfg,setChanCfg] = aState(()=>pick('chanCfg', { off:{}, custom:{}, order:null }));
  const [sales,setSales] = aState(()=>pick('sales', []));
  const [orders,setOrders]= aState(()=>pick('orders', []));
  const [pay,setPay] = aState(()=>pick('pay', {
    shopName:'ครัวขายดี', promptpay:'081-234-5678', bank:'กสิกรไทย', acct:'123-4-56789-0',
    accept:{ promptpay:true, cash:true, cod:true }, autoSlip:true, instantPay:false, preorderOn:true, preorderNote:'', staffCanOpen:false, ridersComingSoon:true, payWorkflow:'payFirst', closeGate:'warn', payMode:'manual', voidApproval:false, voidApprover:'owner', mgrManageStaff:false, payTiming:{ dinein:'later', walkin:'first', takeaway:'first' }, print:{ mode:'ask', paper:'80', kitchenAuto:false },
  }));
  const [members,setMembers] = aState(()=>pick('members', []));
  const [staffList,setStaffList] = aState(()=>pick('staffList', []));
  const [shop,setShop] = aState(()=>pick('shop', {
    name:'ครัวขายดี', branch:'ลาดพร้าว', emoji:'🍳',
    address:'123 ซ.ลาดพร้าว 71 แขวงคลองจั่น เขตบางกะปิ กรุงเทพฯ 10240',
    map:'ลาดพร้าว 71', lat:'13.7908', lng:'100.6013',
    open:'08:00', close:'20:00', isOpen:true, phone:'081-234-5678',
  }));
  const [sub,setSub] = aState(()=>pick('sub', (()=>{
    const d = new Date(); d.setDate(d.getDate()+23);   // trial: 23 days left
    return { plan:'trial', expiry:d.toISOString(), auto:false, card:null };
  })()));
  // costing mode: 'simple' = enter cost per dish · 'stock' = raw-material inventory + auto deduction
  const [costMode,setCostMode] = aState(()=>pick('costMode','simple'));
  const [raw,setRaw]           = aState(()=>pick('raw', RAW.map(r=>({...r}))));
  const [purchases,setPurchases]= aState(()=>pick('purchases', []));
  // waste/spoilage log: [{id,date,rmId,qty,unit,reason,cost}] — ตัดสต๊อกทิ้งของเสีย
  const [wastes,setWastes]     = aState(()=>pick('wastes', []));
  // cash register (current open day) + closed-day history
  const [register,setRegister] = aState(()=>pick('register', { open:false, openFloat:0, openedAt:null, moves:[] }));
  const [cashDays,setCashDays] = aState(()=>pick('cashDays', []));
  const [quotes,setQuotes]     = aState(()=>pick('quotes', []));
  // delivery riders belonging to this shop (name/phone/plate/active)
  const [riders,setRiders]     = aState(()=>pick('riders', []));

  // ── LICENSE: เช็ควันหมดอายุจากเซิร์ฟเวอร์ (กันแก้ localStorage) ──
  React.useEffect(()=>{
    if(!(window.KD_LICENSE && window.KD_LICENSE.configured())) return;
    const shopId = (window.KD_SHOP) || (shop && shop.shopId) || 'default';
    let alive = true;
    window.KD_LICENSE.check(shopId).then(lic=>{
      if(!alive || !lic) return;
      setSub(su=>({ ...su, plan: lic.plan||su.plan, expiry: lic.expiry||su.expiry, status: lic.status||su.status, _licSource: lic.source, _licActive: lic.active }));
    }).catch(()=>{});
    return ()=>{ alive=false; };
  }, []);

  // save the whole store whenever any slice changes
  React.useEffect(()=>{
    try{ localStorage.setItem(LS_KEY, JSON.stringify({ menu, cats, chanCfg, sales, orders, pay, members, shop, sub, lang, costMode, raw, purchases, wastes, register, cashDays, quotes, riders, staffList })); }catch(e){}
  }, [menu, cats, chanCfg, sales, orders, pay, members, shop, sub, lang, costMode, raw, purchases, wastes, register, cashDays, quotes, riders, staffList]);


  const todayISO = ()=> new Date().toISOString().slice(0,10);
  // ── inventory_transactions: บันทึก movement จริงขึ้น server (live · fire-and-forget) ──
  const _txStaff = ()=>{ try{ return localStorage.getItem('kd_active_staff')||localStorage.getItem('kd_staff_id')||'system'; }catch(e){ return 'system'; } };
  const recordInvTx = (tx)=>{ try{ if(window.KD_LIVE && window.KD_API && window.KD_API.recordInvTx) window.KD_API.recordInvTx(tx).catch(()=>{}); }catch(e){} };
  // deduct raw materials by recipe when goods go out — HYBRID: เมนูใดมีสูตรก็ตัดสต๊อก (ไม่ผูกกับโหมดร้าน)
  const consumeStock = (items, channel, ref)=>{
    const acc={}; const consignAcc=[];
    (items||[]).forEach(([id,q])=>{ const m=menu.find(x=>x.id===id);
      if(m && m.consign && m.consignId){ consignAcc.push({ id:m.consignId, qty:q }); return; }   // สินค้าขายฝาก → ตัดคลังฝากเท่านั้น ไม่แตะคลังหลัก
      if(m && m.costMethod==='flat') return; recipeFor(m, channel).forEach(([rmId,qty])=>{ acc[rmId]=(acc[rmId]||0)+(Number(qty)||0)*q; }); });
    setRaw(prev=>{
      const next = prev.map(r=>({...r})); const byId={}; next.forEach(r=>byId[r.id]=r);
      Object.entries(acc).forEach(([rmId,q])=>{ const r=byId[rmId]; if(r) r.stock=Math.max(0,(Number(r.stock)||0)-q); });
      return next;
    });
    const batch=Object.entries(acc).filter(([,q])=>q>0).map(([rmId,q])=>({ rmId, movementType:'SALE_USED', qty:-q, refType:'sale', refId:ref||null, reason:'ตัดจากการขาย', handledBy:_txStaff() }));
    if(batch.length) recordInvTx({ batch });
    // สินค้าขายฝาก → ตัดจาก consignment_stock ฝั่ง server (เขียน inv-tx CONSIGN_SALE ให้เอง)
    if(consignAcc.length && window.KD_LIVE && window.KD_API && window.KD_API.consignSale){
      consignAcc.forEach(c=>{ window.KD_API.consignSale({ id:c.id, qty:c.qty, reason:'ขายหน้าร้าน', orderId:ref||null }).catch(()=>{}); });
    }
  };
  const addRaw = (r)=>{ const id=r.id||('r'+Date.now()); setRaw(prev=>[...prev, { id, cat:r.cat||'other', th:r.th||'', unit:r.unit||'g', stock:Number(r.stock)||0, avgCost:Number(r.avgCost)||0, low:Number(r.low)||0 }]); if((Number(r.stock)||0)>0) recordInvTx({ rmId:id, movementType:'OPENING', qty:Number(r.stock)||0, refType:'manual', reason:'ยอดตั้งต้น', handledBy:_txStaff() }); return id; };
  const updateRaw = (id, patch)=>{ if(patch && patch.stock!=null){ const cur=(raw||[]).find(r=>r.id===id); if(cur){ const delta=(Number(patch.stock)||0)-(Number(cur.stock)||0); if(delta!==0) recordInvTx({ rmId:id, movementType:'ADJUST', qty:delta, refType:'manual', reason:'ปรับสต๊อกมือ (Quick Adjust)', handledBy:_txStaff() }); } } setRaw(prev=>prev.map(r=>r.id===id?{...r,...patch}:r)); };
  const deleteRaw = (id)=> setRaw(prev=>prev.filter(r=>r.id!==id));
  // record a purchase (shopping trip) → add stock + recompute moving-average cost
  const addPurchase = (p)=>{
    const entry = { id:'pc'+Date.now(), date:p.date||todayISO(), note:p.note||'', hasVat:!!p.hasVat, vat:Number(p.vat)||0, vatBase:(p.vatBase!=null?Number(p.vatBase):0), vatRate:Number(p.vatRate)||0, supplierTaxId:p.supplierTaxId||'', lines:(p.lines||[]).filter(l=>l.rmId) };
    setPurchases(prev=>[entry, ...prev]);
    if(window.KD_LIVE && window.KD_API && window.KD_API.addPurchaseRow) window.KD_API.addPurchaseRow(entry).catch(()=>{});
    const _txs=entry.lines.map(l=>{ const r=(raw||[]).find(x=>x.id===l.rmId); const add=r?convQty(l.qty,l.unit,r.unit):0; return add>0?{ rmId:l.rmId, movementType:'GOODS_RECEIPT', qty:add, refType:'purchase', refId:entry.id, reason:'ซื้อเข้า'+(entry.note?' · '+entry.note:''), handledBy:_txStaff() }:null; }).filter(Boolean);
    if(_txs.length) recordInvTx({ batch:_txs });
    setRaw(prev=>{
      const next = prev.map(r=>({...r})); const byId={}; next.forEach(r=>byId[r.id]=r);
      entry.lines.forEach(l=>{ const r=byId[l.rmId]; if(!r) return;
        const add = convQty(l.qty, l.unit, r.unit); if(add<=0) return;
        const unitCost = (Number(l.price)||0)/add; const ns=(Number(r.stock)||0)+add;
        r.avgCost = ns>0 ? ((Number(r.stock)||0)*(Number(r.avgCost)||0)+add*unitCost)/ns : unitCost;
        r.stock = ns;
      });
      return next;
    });
    return entry;
  };
  // record waste → หักสต๊อก (แปลงเป็นหน่วยติดตาม) + คิดมูลค่าที่ทิ้ง (avgCost × qty)
  const addWaste = (w)=>{
    const r0 = (raw||[]).find(x=>x.id===w.rmId); if(!r0) return null;
    const dq = convQty(w.qty, w.unit||r0.unit, r0.unit); if(dq<=0) return null;
    const cost = dq * (Number(r0.avgCost)||0);
    const entry = { id:'ws'+Date.now(), date:w.date||todayISO(), rmId:w.rmId, qty:dq, unit:r0.unit, reason:w.reason||'', cost };
    setWastes(prev=>[entry, ...prev]);
    setRaw(prev=>prev.map(r=>r.id===w.rmId?{...r, stock:Math.max(0,(Number(r.stock)||0)-dq)}:r));
    recordInvTx({ rmId:w.rmId, movementType:'WASTAGE', qty:-dq, refType:'manual', refId:entry.id, reason:w.reason||'ของเสีย', handledBy:_txStaff() });
    return entry;
  };
  const deleteWaste = (id)=> setWastes(prev=>prev.filter(w=>w.id!==id));
  // cash register actions
  // เปิดกะ → ผูก "วันขาย" (businessDate) กับวันที่ตอนเปิด + sid ประจำกะ (รองรับร้านขายข้ามวัน)
  // เปิดกะ → ผูก "วันขาย" (businessDate) กับวันที่ตอนเปิด + sid ประจำกะ (รองรับร้านขายข้ามวัน)
  // ก่อนเปิด: เติมประวัติวันเว้นช่วง (วันหยุดตามตาราง = "ปิดตามกำหนด" · วันอื่น = "ไม่ได้เปิดร้าน") อัตโนมัติ · 0 บาท เงียบๆ
  const _wkKeyOf = (iso)=>['sun','mon','tue','wed','thu','fri','sat'][new Date(iso+'T00:00:00').getDay()];
  const _isDayOff = (iso)=>{ const wk=(shop.week&&shop.week[_wkKeyOf(iso)])||null; return !!(wk&&wk.closed); };
  const backfillGapDays = ()=>{
    const t=todayISO(); let last='';
    (cashDays||[]).forEach(d=>{ if(d.date && d.date>last) last=d.date; });
    if(!last || last>=t) return;            // ไม่มีประวัติ = ไม่เติม (ไม่กุวันขึ้นมาเอง)
    const have={}; (cashDays||[]).forEach(d=>{ if(d.date) have[d.date]=true; });
    const add=[]; const cur=new Date(last+'T00:00:00'); cur.setDate(cur.getDate()+1);
    const end=new Date(t+'T00:00:00'); let g=0;
    while(cur<end && g<400){ g++; const iso=cur.toISOString().slice(0,10);
      if(!have[iso]){ const off=_isDayOff(iso);
        add.push({ id:'cd'+Date.now()+Math.floor(Math.random()*1e4)+'_'+iso, date:iso, auto:true, kind: off?'holiday':'noopen', openFloat:0, revenue:0, byPay:{}, platforms:[], cashSales:0, cashIn:0, cashOut:0, orders:0, moves:[], expectedCash:0, countedCash:0, withdrawn:0, leftFloat:0, diff:0, closedAt:Date.now() }); }
      cur.setDate(cur.getDate()+1);
    }
    if(add.length){ setCashDays(prev=>[...add.slice().reverse(), ...prev]); if(window.KD_LIVE && window.KD_API && window.KD_API.addCashDay) add.forEach(d=>window.KD_API.addCashDay(d).catch(()=>{})); }
  };
  const openRegister = (float)=>{ backfillGapDays(); setRegister({ open:true, openFloat:Number(float)||0, openedAt:Date.now(), businessDate: todayISO(), sid:'sh'+Date.now(), moves:[] }); };
  const addCashMove = (mv)=> setRegister(r=>({ ...r, moves:[{ id:'cm'+Date.now(), t:new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}), by:(typeof window!=='undefined'&&window.__lineUser&&window.__lineUser.name)||(function(){try{return localStorage.getItem('kd_active_staff')||''}catch(e){return ''}})()||'', ...mv }, ...(r.moves||[])] }));
  const closeRegister = (record)=>{ const day={ id:'cd'+Date.now(), ...record }; setCashDays(prev=>[day, ...prev]); setRegister({ open:false, openFloat:0, openedAt:null, moves:[] }); if(window.KD_LIVE && window.KD_API && window.KD_API.addCashDay) window.KD_API.addCashDay(day).catch(()=>{}); };
  // เปิดวันย้อนหลัง (เฉพาะวันปัจจุบัน · ล็อกด้วยรหัส Office) — กู้เคสเผลอปิดกลางวัน
  const reopenDay = (day)=>{ if(!day) return; setCashDays(prev=>prev.filter(d=>d.id!==day.id)); setRegister({ open:true, openFloat:Number(day.leftFloat)||0, openedAt:Date.now(), businessDate: day.date||todayISO(), sid:'sh'+Date.now(), moves:(day.moves||[]), reopenedFrom:day.id, reopenAt:Date.now() }); };
  const addQuote = (q)=>{ const id='qt'+Date.now(); const rec={ id, savedAt:Date.now(), ...q }; setQuotes(prev=>[rec, ...prev]); if(window.KD_LIVE && window.KD_API && window.KD_API.saveQuote) window.KD_API.saveQuote(rec).catch(()=>{}); return id; };
  const updateQuote = (id, patch)=> setQuotes(prev=>prev.map(q=>{ if(q.id!==id) return q; const nx={...q,...patch}; if(window.KD_LIVE && window.KD_API && window.KD_API.saveQuote) window.KD_API.saveQuote(nx).catch(()=>{}); return nx; }));
  const deleteQuote = (id)=>{ setQuotes(prev=>prev.filter(q=>q.id!==id)); if(window.KD_LIVE && window.KD_API && window.KD_API.deleteQuote) window.KD_API.deleteQuote(id).catch(()=>{}); };
  // rider team
  const addRider = (r)=>{ const id='rd'+Date.now(); setRiders(prev=>[...prev, { id, name:r.name||'', phone:r.phone||'', plate:r.plate||'', active:r.active!==false }]); return id; };
  const updateRider = (id, patch)=> setRiders(prev=>prev.map(r=>r.id===id?{...r,...patch}:r));
  const deleteRider = (id)=> setRiders(prev=>prev.filter(r=>r.id!==id));

  // ── สมาชิกร้าน (POS + LINE): เพิ่ม/แก้/ค้นด้วยเบอร์ + คิดแต้ม-สแตมป์ตาม pay.loyalty ──
  const _digits = (s)=> String(s||'').replace(/\D/g,'');
  const _tierOf = (pts)=>{ const L=(pay&&pay.loyalty)||{}; const g=Number(L.tierGold)>0?Number(L.tierGold):300; const s=Number(L.tierSilver)>0?Number(L.tierSilver):120; return pts>=g?'gold':pts>=s?'silver':'member'; };
  const findMemberByPhone = (phone)=>{ const d=_digits(phone); if(d.length<4) return null; return (members||[]).find(m=> _digits(m.phone)===d)||null; };
  const findMemberById = (id)=> id ? ((members||[]).find(m=>m.id===id)||null) : null;
  const addMember = (m)=>{ const d=_digits(m.phone); const id = m.id || (d?('m'+d):('m'+Date.now())); let ret=id;
    setMembers(prev=>{ const i=prev.findIndex(x=>x.id===id || (d && _digits(x.phone)===d)); if(i>=0){ ret=prev[i].id; const n=prev.slice(); n[i]={ ...n[i], name:m.name||n[i].name, phone:m.phone||n[i].phone, birth:m.birth||n[i].birth||'' }; return n; }
      return [...prev, { id, name:m.name||'', phone:m.phone||'', birth:m.birth||'', points:0, visits:0, tier:'member' }]; });
    if(window.KD_LIVE && window.KD_API && window.KD_API.putMember) window.KD_API.putMember({ id, name:m.name||'', phone:m.phone||'', birth:m.birth||'' }).catch(()=>{});
    return ret; };
  const updateMember = (id, patch)=>{ setMembers(prev=>prev.map(x=>x.id===id?{...x,...patch}:x)); if(window.KD_LIVE && window.KD_API && window.KD_API.putMember) window.KD_API.putMember({ id, ...patch }).catch(()=>{}); };
  // รวมสมาชิกซ้ำด้วยเบอร์: ถ้ามีสมาชิก LINE (id=Line_ID) + สมาชิกเบอร์ (id='m'+เบอร์) เบอร์เดียวกัน → ยุบเป็นใบเดียว (รวมแต้ม/visits) เก็บใบ primary
  const mergeMemberByPhone = (primaryId, phone)=>{ const d=_digits(phone); if(!primaryId || d.length<9) return primaryId;
    let winnerId=primaryId, dupId=null;
    setMembers(prev=>{ const pri=prev.find(x=>x.id===primaryId); const other=prev.find(x=> x.id!==primaryId && _digits(x.phone)===d);
      if(!pri){ // primary ยังไม่มี แต่มีใบเบอร์เดิม → ใช้ใบเบอร์เป็นตัวหลัก แล้วผูกเบอร์
        if(other){ winnerId=other.id; return prev.map(x=> x.id===other.id ? { ...x, phone:phone } : x); }
        return prev; }
      if(!other) return prev.map(x=> x.id===primaryId ? { ...x, phone:phone } : x);   // ผูกเบอร์ให้ primary
      dupId=other.id;   // รวม 2 ใบ → primary
      const np=(Number(pri.points)||0)+(Number(other.points)||0), nv=(Number(pri.visits)||0)+(Number(other.visits)||0);
      return prev.filter(x=>x.id!==other.id).map(x=> x.id===primaryId ? { ...x, phone:phone, points:np, visits:nv, tier:_tierOf(np), name:pri.name||other.name } : x);
    });
    if(dupId && window.KD_LIVE && window.KD_API){ if(window.KD_API.putMember) window.KD_API.putMember({ id:winnerId, phone }).catch(()=>{}); if(window.KD_API.mergeMember) window.KD_API.mergeMember(winnerId, dupId).catch(()=>{}); }
    else if(window.KD_LIVE && window.KD_API && window.KD_API.putMember) window.KD_API.putMember({ id:winnerId, phone }).catch(()=>{});
    return winnerId; };
  // คิดแต้ม + นับครั้งซื้อให้สมาชิกจากการขายหน้าร้าน (POS) · คืนจำนวนแต้มที่ได้
  const earnMember = (id, amount)=>{ if(!id) return 0; const L=(pay&&pay.loyalty)||{}; const per=Number(L.perBaht)>0?Number(L.perBaht):25; const pts=Math.floor((Number(amount)||0)/per);
    setMembers(prev=>prev.map(x=>{ if(x.id!==id) return x; const np=(Number(x.points)||0)+pts; return { ...x, points:np, visits:(Number(x.visits)||0)+1, tier:_tierOf(np) }; }));
    if(window.KD_LIVE && window.KD_API && window.KD_API.patchMember) window.KD_API.patchMember(id, { addPoints:pts, addVisits:1 }).catch(()=>{});
    return pts; };
  // หักแต้ม (แลกส่วนลด) — คืน true ถ้าหักได้
  const redeemMember = (id, pts)=>{ let ok=false; setMembers(prev=>prev.map(x=>{ if(x.id!==id) return x; const cur=Number(x.points)||0; if(cur<pts) return x; ok=true; const np=cur-pts; return { ...x, points:np, tier:_tierOf(np) }; })); if(ok && window.KD_LIVE && window.KD_API && window.KD_API.patchMember) window.KD_API.patchMember(id, { addPoints:-pts }).catch(()=>{}); return ok; };
  // live: โหลดรายชื่อสมาชิกจาก D1 ตอนเปิด (ค้นเบอร์/แสดงแต้มข้ามเครื่องได้)
  React.useEffect(()=>{ if(window.KD_LIVE && window.KD_API && window.KD_API.listMembers){ window.KD_API.listMembers().then(r=>{ if(Array.isArray(r)&&r.length) setMembers(r); }).catch(()=>{}); } }, []);

  const addSale = (s)=>{ consumeStock(s.items||[], s.channel); const maxNo=sales.reduce((m,x)=>Math.max(m, Number(x.no)||0),1000); const _shOpen=register&&register.open; const _vm=(pay&&pay.vatMode)||'off'; const _vr=(Number(pay&&pay.vatRate)||7)/100; const _vf=(_vm!=='off')?(()=>{ const g=Number(s.total)||0; const base=g/(1+_vr); return { vatBase:+base.toFixed(2), vat:+(g-base).toFixed(2), vatRate:_vr*100, vatMode:_vm }; })():{}; const local={ id:'s'+Date.now(), no:maxNo+1, date:todayISO(), sid:_shOpen?register.sid:null, businessDate:_shOpen?(register.businessDate||todayISO()):todayISO(), ...s, ..._vf }; setSales(prev=>[...prev, local]);
    // โหมด live → บันทึกบิลขึ้น D1 (ตาราง sales) แล้ว reconcile id/เลขที่จริงกลับ
    if(window.KD_LIVE && window.KD_API && window.KD_API.createSale){
      window.KD_API.createSale(local).then(srv=>{ if(srv&&srv.id) setSales(prev=> prev.map(x=> x.id===local.id ? { ...x, id:srv.id, no:srv.no||x.no } : x)); }).catch(e=>console.warn('[API] createSale failed', e));
    }
    return local; };
  // รับยอดจากแพลตฟอร์ม (ยอดค้างรับ) → stamp วันที่ได้รับเงินจริง
  const settleSale = (id, date)=> setSales(prev=>prev.map(s=> s.id===id ? { ...s, settled:true, settledDate: date||todayISO() } : s));
  // ค่า GP/คอมมิชชัน (%) ต่อช่องทาง — อ่านจาก chanCfg.custom[key].gp (ตั้งตอนเพิ่มช่องทาง)
  const gpOf = (channelKey)=>{ const o=(chanCfg&&chanCfg.gp&&chanCfg.gp[channelKey])||null; if(o && Number(o.gp)>0) return Number(o.gp); const d=(chanCfg&&chanCfg.custom&&chanCfg.custom[channelKey])||null; return d && Number(d.gp)>0 ? Number(d.gp) : 0; };
  const vatOnGpOf = (channelKey)=>{ const o=(chanCfg&&chanCfg.gp&&chanCfg.gp[channelKey])||null; if(o) return !!o.vatOnGp; const d=(chanCfg&&chanCfg.custom&&chanCfg.custom[channelKey])||null; return !!(d && d.vatOnGp); };
  const setChannelGp = (key, def)=> setChanCfg(prev=>{ const gp={ ...((prev&&prev.gp)||{}) }; const g=Number(def&&def.gp)||0; if(g>0||(def&&def.vatOnGp)) gp[key]={ gp:g, vatOnGp:!!(def&&def.vatOnGp) }; else delete gp[key]; return { ...prev, gp }; });
  // ยืนยันรับเงินโอน/พร้อมเพย์ (เทียบสลิป/ยอดเข้าบัญชี) — แนบสลิปหรือไม่ก็ได้
  const verifySale = (id, slip, actual, payStatus)=> setSales(prev=>prev.map(s=>{ if(s.id!==id) return s;
    const sys=Number(s.total)||0;
    const av=(actual!=null&&actual!=='')?(Number(actual)||0):(s.verifiedAmount!=null?s.verifiedAmount:sys);
    const diff=+(av-sys).toFixed(2);
    // สถานะบัญชี: paid=ยอดตรง · discrepancy=ขาด/เกิน · not_found=ไม่พบยอด(สลิปปลอม/ไม่มีเงินเข้า)
    const st = payStatus || (av===0 && sys>0 ? 'not_found' : (diff===0 ? 'paid' : 'discrepancy'));
    // รายได้ผูกวันที่เกิด transaction จริง (s.date เดิม ไม่ย้าย) · verifiedDate = วันที่กดตรวจ
    return { ...s, verified:true, verifiedDate: todayISO(), slipUrl: slip||s.slipUrl||null, verifiedAmount:av, verifyDiff:diff, payStatus:st }; }));
  const unverifySale = (id)=> setSales(prev=>prev.map(s=> s.id===id ? { ...s, verified:false } : s));
  // แก้บิลขาย (ใช้ตอนเก็บเงินออเดอร์ payLater ทีหลัง → อัปเดตวิธีจ่าย/สถานะจ่ายในบิลด้วย)
  const patchSale = (id, patch)=>{ setSales(prev=>prev.map(s=> s.id===id ? { ...s, ...patch } : s)); if(window.KD_LIVE && window.KD_API && window.KD_API.patchSale) window.KD_API.patchSale(id, patch).catch(()=>{}); };
  const settlePlatform = (channelKey, date, actual)=>{
    const batch = sales.filter(s=> !s.settled && s.pay==='platform' && s.channel===channelKey);
    const gross = batch.reduce((a,s)=>a+(Number(s.total)||0),0);
    const act = (actual!=null && actual!=='') ? (Number(actual)||0) : gross;
    // ⭐ เขียนลงแหล่งข้อมูลกลาง delivery_settlement_logs (ชุดเดียวกับ Backoffice "กระทบยอดเดลิเวอรี") — แยกตามวันขายจริง
    if(window.KD_LIVE && window.KD_API && window.KD_API.saveDeliverySettlement){
      const gp=(gpOf?gpOf(channelKey):0)||0, vat=vatOnGpOf?!!vatOnGpOf(channelKey):false;
      const dayGross={}; batch.forEach(s=>{ const d=s.date||todayISO(); dayGross[d]=(dayGross[d]||0)+(Number(s.total)||0); });
      Object.entries(dayGross).forEach(([d,g])=>{ const gpAmt=g*gp/100, exp=g-gpAmt-(vat?gpAmt*0.07:0), a=gross>0?g/gross*act:act;
        window.KD_API.saveDeliverySettlement({ channel:channelKey, businessDate:d, gross:Math.round(g), gpPct:gp, vatOnGp:vat, expectedNet:Math.round(exp), actualReceived:Math.round(a), settlementDate:date||todayISO() }).catch(()=>{}); });
    }
    setSales(prev=> prev.map(s=>{
      if(!s.settled && s.pay==='platform' && s.channel===channelKey){
        const share = gross>0 ? (Number(s.total)||0)/gross*act : act;
        return { ...s, settled:true, settledDate: date||todayISO(), receivedAmount: share };
      }
      return s;
    }));
  };
  // ── per-channel running queue numbers ── (ต่อช่องทาง · วิ่ง 1→100 แล้ววนกลับ 1 · รีเซ็ตทุกวันขายใหม่ · เก็บ localStorage กันเลขซ้ำข้ามรีโหลด)
  const queueKey = ()=>{ const sid=(typeof window!=='undefined'&&window.KD_SHOP)||(shop&&shop.shopId)||'default'; return 'kd_queue_'+sid; };
  const nextQueue = (ch)=>{
    if(!ch || ch==='dinein') return null;
    const bd = (register&&register.businessDate) || todayISO();
    let obj={ date:bd, n:{} };
    try{ const raw=localStorage.getItem(queueKey()); if(raw){ const p=JSON.parse(raw); if(p&&p.date===bd&&p.n) obj=p; } }catch(e){}
    let n=(obj.n[ch]||0)+1; if(n>100) n=1;    // วน 1–100
    obj.n[ch]=n; obj.date=bd;
    try{ localStorage.setItem(queueKey(), JSON.stringify(obj)); }catch(e){}
    return n;
  };
  // ตั๋วครัวจากบิลที่คีย์หน้าขาย (fromSale) — โชว์ในคิวหน้าออเดอร์ · ไม่ตัดสต๊อกซ้ำ (addSale ตัดไปแล้ว)
  const addKitchenTicket = (p)=>{ const qn=(p.qnum!=null?p.qnum:nextQueue(p.channel)); const o={ id:'k'+Date.now(), no:Math.floor(Math.random()*400+600), status:'new', when:'เลย', fromSale:true, qnum:qn, ...p, qnum:qn }; setOrders(prev=>[...prev, o]);
    // push ขึ้น server → จอแสดงคิว/หน้าออเดอร์คนละเครื่องเห็นบิล POS + สถานะ sync ข้ามเครื่อง (reconcile id จริง)
    if(window.KD_LIVE && window.KD_API && window.KD_API.createOrder){ window.KD_API.createOrder({ ...p, id:o.id, no:o.no, status:'new', qnum:o.qnum, fromSale:true }).then(srv=>{ if(srv&&srv.id) setOrders(prev=> prev.map(x=> x.id===o.id ? { ...x, id:srv.id, no:srv.no||x.no } : x)); }).catch(()=>{}); }
    return o; };
  const addOrder = (payload)=>{
    const no = Math.max(1043, ...orders.map(o=>o.no)) + 1;
    const qn = payload.channel==='dinein' ? null : nextQueue(payload.channel);
    // ผูกโปรไฟล์ LINE ที่ login ไว้กับออเดอร์ (รู้ว่าใครสั่ง)
    const lu = (typeof window!=='undefined' && window.__lineUser) || null;
    const luFields = lu ? { lineUserId:lu.userId, lineName:lu.name, lineAvatar:lu.avatar } : {};
    const o = { id:'o'+Date.now(), no, status:'new', qnum:qn, ...luFields, ...payload };
    setOrders(prev=>[...prev, o]);
    // ลูกค้า LINE + กรอกเบอร์ → รวมกับสมาชิกเบอร์เดิมที่ร้านเคยคีย์ไว้ (แต้มรวมใบเดียว)
    if(lu && lu.userId && payload.phone) { try{ mergeMemberByPhone(lu.userId, payload.phone); }catch(e){} }
    consumeStock(payload.items||[], payload.channel);
    // โหมด live → ส่งขึ้น server แล้ว reconcile id/เลขที่จริงกลับมา
    if(window.KD_LIVE && window.KD_API){
      window.KD_API.createOrder({ ...payload, ...luFields, id:o.id }).then(srv=>{
        if(srv&&srv.id) setOrders(prev=> prev.map(x=> x.id===o.id ? { ...srv, qnum:(srv.qnum!=null?srv.qnum:o.qnum), mine:o.mine } : x));
      }).catch(e=>console.warn('[API] createOrder failed', e));
    }
    return o;
  };
  // เปลี่ยนสถานะ/ยืนยันจ่ายเงิน — เขียนทั้ง local + server
  const patchOrder = (id, patch)=>{
    setOrders(prev=> prev.map(o=> o.id===id ? { ...o, ...patch } : o));
    // แนบพนักงานที่ทำรายการ (audit) — server บันทึก accepted_by/verified_by ครั้งแรกเท่านั้น
    let staffName='', staffId='';
    try{ staffName=localStorage.getItem('kd_active_staff')||''; staffId=localStorage.getItem('kd_staff_id')||''; }catch(e){}
    if(window.KD_LIVE && window.KD_API) window.KD_API.patchOrder(id, { ...patch, staffId, staffName }).catch(e=>console.warn('[API] patchOrder', e));
  };
  // บันทึกยอดขายจากออเดอร์ลูกค้า (ลิงก์เดลิเวอรี/หน้าลูกค้า) เมื่อปิดออเดอร์ → เข้ารายงานทุกช่องทาง
  // สต๊อกถูกตัดตอน addOrder แล้ว จึงไม่ตัดซ้ำ (ไม่เรียก consumeStock)
  const recordOrderSale = (order, extra={})=>{
    if(!order || order.fromSale || order.saleId || order.saleRecorded) return null;
    const its = order.items||[];
    const cost = order.cost!=null ? order.cost : its.reduce((a,it)=>{ const m=menu.find(x=>x.id===it[0]); return a+(((m&&m.cost)||0)*(Number(it[1])||0)); },0);
    const g = Number(order.total)||0;
    const maxNo=sales.reduce((m,x)=>Math.max(m, Number(x.no)||0),1000);
    const _shOpen=register&&register.open; const _vm=(pay&&pay.vatMode)||'off'; const _vr=(Number(pay&&pay.vatRate)||7)/100;
    const _vf=(_vm!=='off')?(()=>{ const base=g/(1+_vr); return { vatBase:+base.toFixed(2), vat:+(g-base).toFixed(2), vatRate:_vr*100, vatMode:_vm }; })():{};
    const local={ id:'s'+Date.now(), no:maxNo+1, date:todayISO(), sid:_shOpen?register.sid:null, businessDate:_shOpen?(register.businessDate||todayISO()):todayISO(),
      items:its, channel:order.channel, pay:(extra.pay||order.pay||'cash'), platNo:order.platNo||'', customer:order.customer||'', total:g, cost, paid:true, fromOrder:order.id,
      t:new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}), ..._vf };
    setSales(prev=>[...prev, local]);
    if(window.KD_LIVE && window.KD_API && window.KD_API.createSale){ window.KD_API.createSale(local).then(srv=>{ if(srv&&srv.id) setSales(prev=> prev.map(x=> x.id===local.id ? { ...x, id:srv.id, no:srv.no||x.no } : x)); }).catch(()=>{}); }
    patchOrder(order.id, { saleId:local.id, saleRecorded:true });
    return local;
  };
  // คืนสต๊อก (กลับด้าน consumeStock) — ใช้ตอนยกเลิกบิล
  const restockItems = (items, channel)=>{
    setRaw(prev=>{
      const next = prev.map(r=>({...r})); const byId={}; next.forEach(r=>byId[r.id]=r);
      (items||[]).forEach(([id,q])=>{ const m=menu.find(x=>x.id===id);
        if(m && m.costMethod==='flat') return;
        recipeFor(m, channel).forEach(([rmId,qty])=>{ const r=byId[rmId]; if(r) r.stock=(Number(r.stock)||0)+(Number(qty)||0)*q; }); });
      return next;
    });
  };
  // ยกเลิกบิลขาย (sale) → mark void + คืนสต๊อก + sync (ไม่ตัดยอด/เงินสด เพราะ void ถูกกรองออกตอนคำนวณ)
  const voidSale = (saleId, info)=>{
    if(!saleId) return;
    const sale = sales.find(s=>s.id===saleId);
    if(!sale || sale.void) return;
    restockItems(sale.items, sale.channel);
    setSales(prev=> prev.map(s=> s.id===saleId ? { ...s, void:true, voidReason:(info&&info.reason)||'', voidType:(info&&info.voidType)||'other', voidAt:Date.now() } : s));
    if(window.KD_LIVE && window.KD_API && window.KD_API.patchSale) window.KD_API.patchSale(saleId, { void:true, voidReason:(info&&info.reason)||'', voidAt:Date.now() }).catch(()=>{});
  };
  // ยกเลิกออเดอร์ (ตั๋วครัว/ออเดอร์ลูกค้า) → set void + คืนสต๊อก · บิลที่มาจากการคีย์ขาย (fromSale) คืนผ่าน sale เพื่อกันคืนซ้ำ
  const voidOrder = (id, info)=>{
    const o = orders.find(x=>x.id===id);
    // ต้องคืนเงิน = ลูกค้าจ่ายผ่านลิงก์แล้ว (ดิจิทัล ไม่ใช่เงินสด) + เลือกช่องทางคืนที่ไม่ใช่ "ไม่คืน"
    const needRefund = !!(o && o.paid && o.pay!=='cash' && info && info.refund && info.refund!=='none' && info.refund!=='cash');
    const refundObj = needRefund ? { status:'pending', amount:(o&&o.total)||0, reason:(info&&info.reason)||'', method:(info&&info.refund)||'transfer', at:Date.now() } : undefined;
    patchOrder(id, { status:(info&&info.reject)?'rejected':'void', voidReason:(info&&info.reason)||'', voidType:(info&&info.voidType)||'other', voidAt:Date.now(), ...(refundObj?{refund:refundObj}:{}) });
    if(!o) return;
    if(info && info.noStock) { /* ปฏิเสธออเดอร์ใหม่ที่ยังไม่เคยตัดสต๊อก — ไม่ต้องคืน */ }
    else if(o.saleId) voidSale(o.saleId, info);
    else restockItems(o.items||[], o.channel);
    // refund object บนออเดอร์ (sync ข้ามเครื่อง) = แหล่งข้อมูลเดียวของ flow คืนเงิน · worker จะ SMS/LINE แจ้งลูกค้าให้กรอกบัญชี
  };

  // ── LIVE SYNC: โหลด menu/orders/settings จาก server + poll ทุก 4 วิ ──
  React.useEffect(()=>{
    if(!window.KD_LIVE || !window.KD_API) return;
    let alive = true, lastTs = 0;
    (async()=>{
      try{
        const [mn, od, sh, rw, pc, stg, cd, qt, pk] = await Promise.all([
          window.KD_API.getMenu().catch(()=>null),
          window.KD_API.listOrders().catch(()=>null),
          window.KD_API.getShop().catch(()=>null),
          window.KD_API.getRaw ? window.KD_API.getRaw().catch(()=>null) : null,
          window.KD_API.listPurchases ? window.KD_API.listPurchases().catch(()=>null) : null,
          window.KD_API.getSettings ? window.KD_API.getSettings().catch(()=>null) : null,
          window.KD_API.listCashDays ? window.KD_API.listCashDays().catch(()=>null) : null,
          window.KD_API.listQuotes ? window.KD_API.listQuotes().catch(()=>null) : null,
          window.KD_API.getPackages ? window.KD_API.getPackages().catch(()=>null) : null,
        ]);
        if(!alive) return;
        if(pk){ try{ localStorage.setItem('kaidee_pkg_v1', JSON.stringify(pk)); }catch(e){} }   // ให้ทุกจุด (Launcher/เงื่อนไข/สมัคร) โชว์วันทดลองตาม Back Office
        if(mn && mn.length) setMenu(mn);
        if(od){ setOrders(od); lastTs = Math.max(0, ...od.map(o=>o.updatedAt||0)); }
        if(sh){
          // โมดูลตามแพ็กเกจ (แอดมินคุมจาก Back Office) — ทดลอง=เปิดครบ · จ่ายแล้วจับแพ็กจาก seats
          const mods = window.kdShopModules ? window.kdShopModules({ plan:sh.plan, seats:sh.seats }, pk) : null;
          if(mods) window.KD_MODULES = mods;
          if(window.kdConsignEnabled) window.KD_CONSIGN = window.kdConsignEnabled({ plan:sh.plan, seats:sh.seats, addons:sh.addons }, pk);
          setShop(s=>{ const f={ ...(s.features||{}) };
            if(mods){ ['orders','delivery','reports','stock'].forEach(k=>{ if(mods[k]===false) f[k]=false; }); }
            return { ...s, name:sh.name, emoji:sh.emoji||s.emoji, phone:sh.phone||s.phone,
              address:sh.address||s.address, open:sh.open||s.open, close:sh.close||s.close, isOpen:sh.isOpen, seats:sh.seats,
              market:(sh.market!=null?sh.market:s.market), features:f }; });
          setPay(p=>({ ...p, shopName:sh.name, promptpay: sh.promptpayId || p.promptpay }));
          if(sh.plan || sh.expiry) setSub(su=>({ ...su, plan: sh.plan||su.plan, expiry: sh.expiry||su.expiry, status: sh.status||su.status }));
        }
        if(rw && rw.length) setRaw(rw);
        if(pc && pc.length) setPurchases(pc);
        if(cd && cd.length) setCashDays(cd);
        if(qt && qt.length) setQuotes(qt);
        if(stg){
          if(stg.costMode) setCostMode(stg.costMode);
          if(stg.register) setRegister(stg.register);
          if(stg.week || stg.holidayNote) setShop(s=>({ ...s, week: stg.week||s.week, holidayNote: stg.holidayNote!=null?stg.holidayNote:s.holidayNote }));
          if(stg.voidPin!=null) setPay(p=>({ ...p, voidPin: stg.voidPin }));
          if(stg.slipReq!=null) setPay(p=>({ ...p, slipReq: stg.slipReq }));
          if(stg.custNameReq!=null) setPay(p=>({ ...p, custNameReq: stg.custNameReq }));
          if(stg.platPick!=null) setPay(p=>({ ...p, platPick: stg.platPick }));
          if(stg.preorderOn!=null) setPay(p=>({ ...p, preorderOn: stg.preorderOn }));
          if(stg.preorderNote!=null) setPay(p=>({ ...p, preorderNote: stg.preorderNote }));
          if(stg.staffCanOpen!=null) setPay(p=>({ ...p, staffCanOpen: stg.staffCanOpen }));
          if(stg.verifyDuringDay!=null) setPay(p=>({ ...p, verifyDuringDay: stg.verifyDuringDay }));
          if(stg.voidApproval!=null) setPay(p=>({ ...p, voidApproval: stg.voidApproval }));
          if(stg.voidApprover!=null) setPay(p=>({ ...p, voidApprover: stg.voidApprover }));
          if(stg.mgrManageStaff!=null) setPay(p=>({ ...p, mgrManageStaff: stg.mgrManageStaff }));
          if(stg.chanCfg && (stg.chanCfg.custom || stg.chanCfg.off || stg.chanCfg.gp)) setChanCfg(stg.chanCfg);
          if(stg.instantPay!=null) setPay(p=>({ ...p, instantPay: stg.instantPay }));
          if(stg.payWorkflow!=null) setPay(p=>({ ...p, payWorkflow: stg.payWorkflow }));
          if(stg.closeGate!=null) setPay(p=>({ ...p, closeGate: stg.closeGate }));
          if(stg.payMode!=null) setPay(p=>({ ...p, payMode: stg.payMode }));
          if(stg.payTiming!=null) setPay(p=>({ ...p, payTiming: stg.payTiming }));
          if(stg.collectGate!=null) setPay(p=>({ ...p, collectGate: stg.collectGate }));
          if(stg.print!=null) setPay(p=>({ ...p, print: { ...(p.print||{}), ...stg.print } }));
          if(stg.loyalty!=null) setPay(p=>({ ...p, loyalty: { ...(p.loyalty||{}), ...stg.loyalty } }));
          if(stg.vatMode!=null||stg.taxId!=null) setPay(p=>({ ...p, vatMode: stg.vatMode||p.vatMode||'off', vatRate: stg.vatRate!=null?stg.vatRate:(p.vatRate!=null?p.vatRate:7), taxId: stg.taxId!=null?stg.taxId:p.taxId, taxAddr: stg.taxAddr!=null?stg.taxAddr:p.taxAddr, taxBranch: stg.taxBranch!=null?stg.taxBranch:p.taxBranch }));
          if(Array.isArray(stg.staffList)) setStaffList(stg.staffList);
          // ⭐ reset marker จาก Back Office (ปุ่มล้างข้อมูลการขาย/ล้างทั้งหมด) → เคลียร์ local ครั้งเดียวต่อสัญญาณ
          if(stg.resetAt){
            const rk='kd_reset_seen_'+((shop&&shop.shopId)||'x'); let seen=0; try{ seen=+(localStorage.getItem(rk)||0); }catch(e){}
            if(stg.resetAt>seen){
              setSales([]); setOrders([]); setMembers([]);
              if(stg.resetAll){ setRaw([]); setPurchases([]); setWastes([]); setCashDays([]); setQuotes([]); setStaffList([]); if(stg.register) setRegister(stg.register); }
              try{ localStorage.setItem(rk, String(stg.resetAt)); }catch(e){}
            }
          }
        }
      }catch(e){ console.warn('[API] initial load', e); }
    })();
    const poll = setInterval(async()=>{
      try{
        const upd = await window.KD_API.listOrders({ since:lastTs });
        if(alive && upd && upd.length){
          lastTs = Math.max(lastTs, ...upd.map(o=>o.updatedAt||0));
          setOrders(prev=>{
            const map = new Map(prev.map(o=>[o.id, o]));
            upd.forEach(o=> map.set(o.id, { ...map.get(o.id), ...o }));
            return Array.from(map.values()).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
          });
        }
      }catch(e){}
      // เปิด-ปิดร้าน near real-time: ดึงสถานะร้านทุกรอบ → ลิงก์พนักงาน/ลูกค้าอัปเดตเองไม่ต้องรีเฟรช
      try{
        const sh = await window.KD_API.getShop();
        if(alive && sh) setShop(s=> (s.isOpen!==sh.isOpen || s.open!==sh.open || s.close!==sh.close) ? { ...s, isOpen:sh.isOpen, open:sh.open||s.open, close:sh.close||s.close } : s);
      }catch(e){}
    }, 4000);
    // ── REALTIME: เปิด WebSocket (ถ้ามี) → อัปเดตเปิด-ปิดร้าน/สิทธิ์/ออเดอร์ทันทีไม่ต้องรีเฟรช · poll 4 วิ เป็น fallback ──
    let closeRT=null;
    if(window.KD_API.connectRealtime){
      closeRT = window.KD_API.connectRealtime((m)=>{
        if(!alive || !m) return;
        if(m.type==='shop'){
          setShop(s=> (s.isOpen!==m.isOpen || (m.open&&s.open!==m.open) || (m.close&&s.close!==m.close))
            ? { ...s, isOpen:m.isOpen, open:m.open||s.open, close:m.close||s.close } : s);
        } else if(m.type==='perm'){
          if(m.staffCanOpen!=null) setPay(p=> p.staffCanOpen===m.staffCanOpen ? p : { ...p, staffCanOpen:m.staffCanOpen });
          if(m.verifyDuringDay!=null) setPay(p=> p.verifyDuringDay===m.verifyDuringDay ? p : { ...p, verifyDuringDay:m.verifyDuringDay });
        } else if(m.type==='order'){
          window.KD_API.listOrders({ since:lastTs }).then(upd=>{
            if(!alive || !upd || !upd.length) return;
            lastTs = Math.max(lastTs, ...upd.map(o=>o.updatedAt||0));
            setOrders(prev=>{ const map=new Map(prev.map(o=>[o.id,o])); upd.forEach(o=>map.set(o.id,{...map.get(o.id),...o})); return Array.from(map.values()).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)); });
          }).catch(()=>{});
        }
      });
    }
    return ()=>{ alive=false; clearInterval(poll); if(closeRT) closeRT(); };
  }, []);
  // ── sale-mode config (คีย์บันทึกการขายเอง · เพิ่ม/เปิด-ปิดได้จากหน้าขาย) ──
  const addSaleMode = (def)=>{ if(!def||!def.key) return; setChanCfg(c=>{ const off={...(c.off||{})}; delete off[def.key]; return { ...c, off, custom:{ ...(c.custom||{}), [def.key]:def } }; }); };
  const toggleSaleMode = (key,on)=> setChanCfg(c=>{ const off={...(c.off||{})}; if(on) delete off[key]; else off[key]=true; return { ...c, off }; });
  const removeSaleMode = (key)=> setChanCfg(c=>{ const custom={...(c.custom||{})}; delete custom[key]; const off={...(c.off||{})}; delete off[key]; return { ...c, custom, off }; });
  const addCat = (c)=>{ const id='c'+Date.now(); setCats(prev=>[...prev,{ id, th:c.th, en:c.en||c.th, emoji:c.emoji||'🍽️' }]); return id; };
  const updateCat = (id, patch)=> setCats(prev=>prev.map(c=>c.id===id?{...c,...patch}:c));
  const deleteCat = (id)=>{ setCats(prev=>{ const rest=prev.filter(c=>c.id!==id); const fb=(rest[0]&&rest[0].id)||null; setMenu(ms=>ms.map(m=>m.cat===id?{...m,cat:fb}:m)); return rest; }); };
  const addStaff=(a)=>{ const o=(a&&typeof a==='object')?a:{name:a}; const nm=String(o.name||'').trim(); if(!nm) return; setStaffList(p=>[...p,{ id:'st'+Date.now(), name:nm, phone:String(o.phone||'').trim(), pin:String(o.pin||'').trim(), line:o.line||'', role:o.role==='manager'?'manager':'staff', status:o.status||'active' }]); };
  const updateStaff=(id,patch)=>setStaffList(p=>p.map(s=>s.id===id?{...s,...patch}:s));
  const registerStaff=(o)=>{ const nm=String((o&&o.name)||'').trim(); if(!nm) return; const line=(o&&o.line)||''; setStaffList(p=>{ if(line&&p.some(s=>s.line===line)) return p; return [...p,{ id:'st'+Date.now(), name:nm, phone:String((o&&o.phone)||'').trim(), pin:'', line, role:'staff', status:'pending' }]; }); };
  const removeStaff=(id)=>setStaffList(p=>p.filter(s=>s.id!==id));
  // keep a live menu registry so menuById() resolves real shop prices (not just seed)
  // ลูกค้าที่เข้ามาจากหน้าแพลตฟอร์ม (?via=market) ต้องคิดเงินด้วยราคาช่องทาง market ทั้งตะกร้า/หน้าจ่าย
  if(typeof window!=='undefined'){
    window.__kdMenu = (typeof kdViaMarket==='function' && kdViaMarket() && typeof marketMenuView==='function') ? marketMenuView(menu) : menu;
    window.__kdPay = pay;
    window.__kdShop = shop;   // ใช้เช็คสิทธิ์ราคาช่องทาง market + ข้อมูลร้านตอนเรียกไรเดอร์
  }
  const store = { menu, setMenu, cats, setCats, addCat, updateCat, deleteCat, chanCfg, setChanCfg, addSaleMode, toggleSaleMode, removeSaleMode, sales, addSale, settleSale, verifySale, unverifySale, patchSale, settlePlatform, addKitchenTicket, orders, setOrders, addOrder, patchOrder, nextQueue, pay, setPay, members, setMembers, staffList, addStaff, removeStaff, updateStaff, registerStaff, shop, setShop, sub, setSub,
    costMode, setCostMode, raw, setRaw, addRaw, updateRaw, deleteRaw, purchases, addPurchase, wastes, addWaste, deleteWaste,
    register, openRegister, addCashMove, closeRegister, reopenDay, cashDays, startNewShop, quotes, addQuote, updateQuote, deleteQuote,
    voidSale, voidOrder, restockItems, recordOrderSale,
    riders, addRider, updateRider, deleteRider,
    findMemberByPhone, findMemberById, addMember, updateMember, earnMember, redeemMember, mergeMemberByPhone, gpOf, vatOnGpOf, setChannelGp };

  // ── ลบร้าน = ล้างเครื่องเจ้าของด้วย: ถ้าแอดมินลบร้าน (getMyShop = null ยืนยัน 2 ครั้ง) → ล้าง cache + กลับหน้าสมัคร ──
  React.useEffect(()=>{
    if(!(window.KD_LIVE && window.KD_API && window.KD_API.shopExists)) return;
    let signedAt=0; try{ signedAt=+(sessionStorage.getItem('kd_signed_at')||0); }catch(e){}
    if(Date.now()-signedAt < 120000) return;    // เพิ่งสมัคร <2 นาที → ข้าม (กัน loop ตอน server ตอบช้า)
    let localShopId=''; try{ const st=JSON.parse(localStorage.getItem('kaidee_pos_v1')||'{}'); localShopId=(st.shop&&st.shop.shopId)||''; }catch(e){}
    if(!localShopId || localShopId==='kaidee') return;   // ไม่มีร้าน / ร้านตัวอย่าง → ข้าม
    let cancelled=false;
    const wipe=()=>{ if(cancelled) return;
      try{ const k='kaidee_pos_v1'; const c=JSON.parse(localStorage.getItem(k)||'{}'); delete c.shop; localStorage.setItem(k, JSON.stringify(c)); localStorage.removeItem('kd_shop'); }catch(e){}
      try{ alert(lang!=='en'?'ร้านนี้ถูกลบออกจากระบบแล้ว กรุณาสมัครใหม่':'This shop has been removed. Please sign up again.'); }catch(e){}
      location.href = location.origin+location.pathname+'?go=signup'; };
    // ตรวจ "ร้านถูกลบจริง" = shopExists คืน false (404) 2 ครั้งห่างกัน (กัน 404 ชั่วคราว · null=ไม่แน่ใจ/เน็ตหลุด → ไม่แตะ)
    // ⚠️ ไม่พึ่ง __lineUser แล้ว → ตรวจได้ทุกเครื่อง (เบราว์เซอร์ปกติ/พนักงาน) ไม่ใช่แค่เปิดใน LINE
    window.KD_API.shopExists(localShopId).then(ex=>{
      if(cancelled || ex!==false) return;        // มีร้าน (true) / ไม่แน่ใจ (null) = ปกติ
      setTimeout(()=>{ if(cancelled) return; window.KD_API.shopExists(localShopId).then(ex2=>{ if(!cancelled && ex2===false) wipe(); }); }, 4000);
    });
    return ()=>{ cancelled=true; };
  }, []);
  // ── #2 ข้ามเครื่อง: เปิดใน LINE + เป็นเจ้าของร้าน (backend) แต่เครื่องนี้ยังไม่มีร้าน → ดึงมาเข้าหลังร้าน ──
  React.useEffect(()=>{
    if(role && role!=='checking') return;
    let cancelled=false, tries=0, done=false;
    const finishRole=(r)=>{ if(cancelled||done) return; done=true; setRole(cur=> (cur==='checking'||!cur) ? r : cur); };
    const fallback=()=>{ let hasLocal=false; try{ const st=JSON.parse(localStorage.getItem('kaidee_pos_v1')||'{}'); hasLocal=!!(st.shop&&st.shop.shopId); }catch(e){} finishRole(hasLocal?'merchant':'crm'); };
    // ⭐ ตัวจับเวลาตัดจบเด็ดขาด — ไม่ว่า LIFF login/getMyShop จะค้างแค่ไหน checking ต้องคลี่ภายใน 7 วิ (กันจอค้าง)
    const hardTimer=setTimeout(fallback, 4500);
    const attempt=()=>{
      if(cancelled||done) return;
      let hasLocal=false, localOwnerLine=''; try{ const st=JSON.parse(localStorage.getItem('kaidee_pos_v1')||'{}'); hasLocal=!!(st.shop&&st.shop.shopId); localOwnerLine=(st.shop&&st.shop.owner&&st.shop.owner.line)||''; }catch(e){}
      // ⭐ กันปนร้าน (shared device): เครื่องนี้มีร้านแคชไว้ แต่คนที่ล็อกอิน LINE ตอนนี้เป็นคนละคนกับเจ้าของร้านที่แคช → ห้ามเชื่อแคชนี้ ให้ไปเช็คร้านจริงของคนที่ล็อกอินอยู่แทน
      { const lu0=(typeof window!=='undefined'&&window.__lineUser)||null; if(hasLocal && lu0 && lu0.userId && localOwnerLine && lu0.userId!==localOwnerLine) hasLocal=false; }
      if(hasLocal){
        let lid=''; try{ const st=JSON.parse(localStorage.getItem('kaidee_pos_v1')||'{}'); lid=(st.shop&&st.shop.shopId)||''; }catch(e){}
        let sat=0; try{ sat=+(sessionStorage.getItem('kd_signed_at')||0); }catch(e){}
        // ⭐ verify ร้านยังอยู่ก่อนเข้าหน้าร้าน — ร้านถูกลบ = wipe ทันทีในหน้า checking (ไม่ต้องรอ delete-effect 2×4 วิ)
        const canVerify = window.KD_LIVE && window.KD_API && window.KD_API.shopExists && lid && lid!=='kaidee' && (Date.now()-sat>=120000);
        if(!canVerify){ setTimeout(()=>finishRole('merchant'), 350); return; }   // เพิ่งสมัคร/ออฟไลน์ → เข้าไว ไม่ verify (กัน loop)
        const wipe=()=>{ try{ const k='kaidee_pos_v1'; const c=JSON.parse(localStorage.getItem(k)||'{}'); delete c.shop; localStorage.setItem(k, JSON.stringify(c)); localStorage.removeItem('kd_shop'); }catch(e){}
          try{ alert(lang!=='en'?'ร้านนี้ถูกลบออกจากระบบแล้ว กรุณาสมัครใหม่':'This shop has been removed. Please sign up again.'); }catch(e){}
          location.href = location.origin+location.pathname+'?go=signup'; };
        let settled=false; const goMerchant=()=>{ if(settled) return; settled=true; finishRole('merchant'); };
        const guard=setTimeout(goMerchant, 2000);   // server ช้า/ไม่ตอบ → เข้าร้านไว ไม่ค้าง (delete-effect ยังเป็น backstop)
        window.KD_API.shopExists(lid).then(ex=>{
          if(cancelled||done||settled) return;
          if(ex===false){ clearTimeout(guard);   // 404 ครั้งแรก → ยืนยันซ้ำครั้งเดียว (กัน 404 ชั่วคราว)
            window.KD_API.shopExists(lid).then(ex2=>{ if(cancelled||done||settled) return; settled=true; if(ex2===false) wipe(); else finishRole('merchant'); }).catch(()=>goMerchant());
          } else { clearTimeout(guard); goMerchant(); }   // true/null = ปกติ → เข้าร้าน
        }).catch(()=>{ clearTimeout(guard); goMerchant(); });
        return;
      }
      const lu = (typeof window!=='undefined' && window.__lineUser) || null;
      const api = window.KD_API && window.KD_API.getMyShop;
      if(lu && lu.userId && api){
        try{ sessionStorage.setItem('kd_owner_checked','1'); }catch(e){}
        try{
          window.KD_API.getMyShop(lu.userId).then(sh=>{
            if(cancelled||done) return;
            const shOwner = sh && (sh.ownerLine || (sh.owner&&sh.owner.line));
            if(sh && sh.shopId && shOwner && shOwner===lu.userId){
              try{ localStorage.setItem('kd_shop', sh.shopId); }catch(e){}
              setShop(prev=>({ ...prev, name:sh.name||prev.name, emoji:sh.emoji||prev.emoji, phone:sh.phone||prev.phone, shopId:sh.shopId, owner:{ line:lu.userId, name:lu.name } }));
              if(sh.plan||sh.expiry) setSub(su=>({ ...su, plan:sh.plan||su.plan, expiry:sh.expiry||su.expiry, status:sh.status||su.status }));
              finishRole('merchant');
            } else { finishRole('crm'); }   // ยังไม่มีร้าน → หน้าสมัคร (สร้างร้าน)
          }).catch(()=>{ fallback(); });
        }catch(e){ fallback(); }   // getMyShop โยน error แบบ sync → อย่าค้าง
        return;
      }
      // lineUser / API ยังไม่พร้อม → ลองใหม่สั้นๆ แล้วค่อยตกไปหน้าสมัคร
      tries++;
      if(tries<12){ setTimeout(attempt,300); }
      else { fallback(); }
    };
    attempt();
    return ()=>{ cancelled=true; clearTimeout(hardTimer); };
  }, []);

  // ── LIVE: ร้านแก้ชื่อร้าน/เบอร์พร้อมเพย์ในแอป → บันทึกขึ้น server อัตโนมัติ ──
  const hydrated = React.useRef(false);
  React.useEffect(()=>{
    if(!window.KD_LIVE || !window.KD_API) return;
    if(!hydrated.current){ hydrated.current = true; return; }   // ข้ามรอบแรก (ค่าที่โหลดจาก server)
    const id = setTimeout(()=>{
      window.KD_API.updateShop(null, {
        name: shop.name, emoji: shop.emoji, phone: shop.phone, address: shop.address,
        open: shop.open, close: shop.close, isOpen: shop.isOpen,
        lat: shop.lat, lng: shop.lng, map: shop.map, week: shop.week,
        hoursMode: shop.hoursMode, pause: shop.pause, delivery: shop.delivery, cover: shop.cover, logo: shop.logo,
        promptpayId: (pay.promptpay||'').replace(/[^0-9]/g,''),
        // ผูกเจ้าของร้านกับ LINE id (worker เขียนเฉพาะตอน owner_line ยังว่าง) → กันหลุด/วนสมัครใหม่ตอนข้ามเครื่อง
        ...((typeof window!=='undefined' && window.__lineUser && window.__lineUser.userId) ? { ownerLine: window.__lineUser.userId, ownerName: window.__lineUser.name } : {}),
      }).catch(()=>{});
    }, 800);
    return ()=> clearTimeout(id);
  }, [shop, pay]);

  // ชื่อร้าน (pay.shopName ที่ใช้บน QR พร้อมเพย์/ใบเสร็จ) ให้ตามชื่อร้านหลักเสมอ — เปลี่ยนชื่อแล้วสะท้อนทันทีทุกจุด
  React.useEffect(()=>{
    if(shop && shop.name && pay.shopName !== shop.name) setPay(p=>({ ...p, shopName: shop.name }));
  }, [shop.name]);

  // ── LIVE: ผูกเจ้าของร้านทันทีที่เข้าหลังบ้านใน LINE (ครั้งเดียว) — ไม่รอให้ร้านแก้ข้อมูลก่อน ──
  // กันเคส: สมัครนอก LINE (owner_line ว่าง) แล้วเปิดหลังบ้านใน LINE ครั้งแรก → backfill owner ทันที → ปิดแอป/ข้ามเครื่องไม่วนสมัครใหม่
  const ownerBound = React.useRef(false);
  React.useEffect(()=>{
    if(ownerBound.current) return;
    if(!(window.KD_LIVE && window.KD_API && window.KD_API.updateShop)) return;
    const lu = (typeof window!=='undefined' && window.__lineUser) || null;
    if(!(lu && lu.userId)) return;                 // ต้องรู้ userId (เปิดใน LINE) ถึงผูกได้
    if(!(shop && shop.shopId)) return;             // ยังไม่มีร้าน
    const cur = shop.owner && shop.owner.line;
    if(cur === lu.userId) { ownerBound.current = true; return; }   // ผูกแล้ว
    ownerBound.current = true;
    window.KD_API.updateShop(null, { ownerLine: lu.userId, ownerName: lu.name }).then(()=>{
      setShop(prev=>({ ...prev, owner:{ line:lu.userId, name:lu.name } }));   // จำไว้ในเครื่องด้วย
    }).catch(()=>{ ownerBound.current = false; });   // ล้มเหลว = ลองใหม่รอบหน้า
  }, [shop.shopId, role]);

  // ── LIVE: push สต๊อก/ตั้งค่า (costMode/register/week/holiday) → D1 ──
  const pushedNew = React.useRef(false);
  React.useEffect(()=>{
    if(!window.KD_LIVE || !window.KD_API) return;
    if(!pushedNew.current){ pushedNew.current = true; return; }
    const id = setTimeout(()=>{
      if(window.KD_API.putRaw) window.KD_API.putRaw(raw).catch(()=>{});
      if(window.KD_API.putSettings) window.KD_API.putSettings({ costMode, register, chanCfg, week: shop.week, holidayNote: shop.holidayNote, voidPin: pay.voidPin||'', voidApproval: !!pay.voidApproval, voidApprover: pay.voidApprover||'owner', collectGate: pay.collectGate||'anytime', voidApprover: pay.voidApprover||'owner', mgrManageStaff: !!pay.mgrManageStaff, slipReq: pay.slipReq||'optional', custNameReq: pay.custNameReq||'optional', platPick: pay.platPick||'dropdown', instantPay: !!pay.instantPay, preorderOn: pay.preorderOn!==false, preorderNote: pay.preorderNote||'', staffCanOpen: !!pay.staffCanOpen, verifyDuringDay: pay.verifyDuringDay!==false, payWorkflow: pay.payWorkflow||'payFirst', payMode: pay.payMode||'manual', payTiming: pay.payTiming||null, print: pay.print||null, closeGate: pay.closeGate||'warn', staffList, vatMode: pay.vatMode||'off', vatRate: pay.vatRate!=null?pay.vatRate:7, taxId: pay.taxId||'', taxAddr: pay.taxAddr||'', taxBranch: pay.taxBranch||'', loyalty: pay.loyalty||null }).catch(()=>{});
    }, 800);
    return ()=> clearTimeout(id);
  }, [raw, costMode, register, chanCfg, shop.week, shop.holidayNote, pay.voidPin, pay.voidApproval, pay.voidApprover, pay.mgrManageStaff, pay.slipReq, pay.custNameReq, pay.platPick, pay.instantPay, pay.preorderOn, pay.preorderNote, pay.staffCanOpen, pay.verifyDuringDay, pay.payWorkflow, pay.payMode, pay.payTiming, pay.collectGate, pay.print, pay.closeGate, staffList, pay.vatMode, pay.vatRate, pay.taxId, pay.taxAddr, pay.taxBranch, pay.loyalty]);

  // ── LIVE: push เมนู (รวม recipe/off) → D1 ──
  const menuPushed = React.useRef(false);
  React.useEffect(()=>{
    if(!window.KD_LIVE || !window.KD_API || !window.KD_API.saveMenuItem) return;
    if(!menuPushed.current){ menuPushed.current = true; return; }
    const id = setTimeout(()=>{ menu.forEach((m,i)=> window.KD_API.saveMenuItem({ ...m, sort:i }).catch(()=>{})); }, 900);
    return ()=> clearTimeout(id);
  }, [menu]);

  const t = (k)=> tr(lang, k);
  const ctx = { lang, setLang, t };
  const isPhone = useIsPhone();

  const appInner = (
    <KDBoundary key={'kb-'+role} onHome={()=>setRole(null)} lang={lang}>
    <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
      {role==='checking' && <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'var(--bg,#fff)' }}>
        <div style={{ fontSize:34 }}>{(brand&&brand.logo)?<img src={brand.logo} alt="" style={{width:54,height:54,borderRadius:14,objectFit:'cover'}}/>:<img src="logo.jpg" alt="" style={{width:54,height:54,borderRadius:14,objectFit:'cover'}}/>}</div>
        <div style={{ width:26, height:26, borderRadius:999, border:'3px solid var(--brand-soft,#e3efe9)', borderTopColor:'var(--brand,#1e9e6a)', animation:'kdspin 0.7s linear infinite' }}/>
        <div style={{ fontSize:15.5, color:'var(--ink,#222)', fontWeight:800 }}>{(()=>{ let fs=false; try{ fs=sessionStorage.getItem('kd_fresh_signup')==='1'; }catch(e){} const signup = fs || /(?:[?&]|liff\.state)[^]*?(go%3[dD]signup|go=signup|role%3[dD]signup|role=signup)/.test(location.href); let hasReg=false, mismatch=false; try{ const st=JSON.parse(localStorage.getItem('kaidee_pos_v1')||'{}'); hasReg=!!(st.shop&&st.shop.shopId); const ownerLine=st.shop&&st.shop.owner&&st.shop.owner.line; const lu=(typeof window!=='undefined'&&window.__lineUser)||null; if(lu&&lu.userId&&ownerLine&&lu.userId!==ownerLine) mismatch=true; }catch(e){} return (hasReg && store.shop&&store.shop.name&&!signup&&!mismatch) ? ((store.lang!=='en')?('กำลังเข้าสู่ระบบ '+store.shop.name+'…'):('Signing in · '+store.shop.name+'…')) : ((store.lang!=='en')?'กำลังโหลด…':'Loading…'); })()}</div>
        <div style={{ fontSize:12, color:'var(--ink-3,#8a8f98)' }}>{(store.lang!=='en')?'ครั้งแรกอาจใช้เวลาสักครู่':'First time may take a moment'}</div>
        <style>{'@keyframes kdspin{to{transform:rotate(360deg)}}'}</style>
      </div>}
      {role===null    && <Launcher onPick={setRole} onHelp={()=>setHelp(true)} brand={brand}/>}
      {role==='crm'   && <CrmApp key="crm" store={store} onEnter={setRole} onCancel={()=>setRole(null)}/>}
      {role==='merchant' && ((shop && shop.vertical==='fitness')
        ? <FitnessFrame key="fit" shopId={shop.shopId} name={shop.name}/>
        : (shop && shop.vertical==='sponsor')
        ? <SponsorFrame key="spon" shopId={shop.shopId} name={shop.name}/>
        : <MerchantApp key="m" store={store}/>)}
      {role==='customer' && <CustomerApp key="c" store={store}/>}
      {role==='board' && <QueueBoard key="b" store={store}/>}
      {role==='kds' && <KitchenBoard key="k" store={store}/>}
      {role==='market' && <MarketHome key="mkt" store={store}/>}
      {role==='rider'    && <RiderApp    key="r" store={store}/>}
      {(role==='customer'||role==='rider') && <FirstUseTip role={role} lang={lang}/>}
      {help && <HelpOverlay onClose={()=>setHelp(false)} scope={role} />}
    </div>
    </KDBoundary>
  );

  return (
    <LangCtx.Provider value={ctx}>
      <DataCtx.Provider value={{ cats }}>
      {isPhone ? (
        <div className="kd-fill">
          {appInner}
          {/* ปุ่มลอยสลับบทบาทเป็นของเดโม/ทีมงาน — ลูกค้าจริงที่เข้ามาจากหน้าแพลตฟอร์มไม่ควรเห็น (กดแล้วหลุดเข้าจอร้าน) */}
          {!(role==='market' || (typeof kdViaMarket==='function' && kdViaMarket())) &&
            <FloatingDemo role={role} setRole={setRole} lang={lang} setLang={setLang} onHelp={()=>setHelp(true)}/>}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:18 }}>
          <IOSDevice>{appInner}</IOSDevice>
          <DemoControls role={role} setRole={setRole} lang={lang} setLang={setLang} onHelp={()=>setHelp(true)}/>
        </div>
      )}
      </DataCtx.Provider>
    </LangCtx.Provider>
  );
}

/* ══════════════ LAUNCHER ══════════════ */
function Launcher({ onPick, onHelp, brand={} }){
  const { t, lang } = useT();
  const _trialD = (()=>{ try{ const p=JSON.parse(localStorage.getItem('kaidee_pkg_v1')||'{}'); return p.trialDays||30; }catch(e){ return 30; } })();
  const cards = [
    { key:'merchant', ic:IC.store, title:t('merchant'), sub:t('merchantSub'), tone:'var(--brand)', bg:'var(--brand-soft)' },
    { key:'customer', ic:IC.bag,   title:t('customer'), sub:t('customerSub'), tone:'var(--line-green)', bg:'#E5F7EC' },
    { key:'rider',    ic:IC.moto,  title:t('rider'),    sub:t('riderSub'),    tone:'var(--ink)', bg:'#ECEEED' },
  ];
  return (
    <div className="kd-screen" style={{ background:'linear-gradient(180deg,#EAF0F7,var(--bg))' }}>
      <div className="kd-body" style={{ padding:'80px 22px 30px', display:'flex', flexDirection:'column' }}>
        {/* logo */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
          <div style={{ width:46, height:46, borderRadius:14, overflow:'hidden', boxShadow:'0 6px 16px rgba(18,165,110,.25)', flexShrink:0 }}>
            <img src={brand.logo||"logo.jpg"} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }}/></div>
          <div>
            <div style={{ fontSize:20, fontWeight:700, lineHeight:1 }}>{brand.appName || t('appName')}</div>
            <div style={{ fontSize:12, color:'var(--brand-ink)', fontWeight:600, marginTop:3 }}>POS · LINE · Delivery</div>
          </div>
        </div>
        <div style={{ fontSize:14, color:'var(--ink-2)', margin:'14px 0 20px', lineHeight:1.5 }}>{t('tagline')}</div>

        <button onClick={()=>onPick('crm')} className="kd-card kd-fadein" style={{ border:'none', cursor:'pointer', width:'100%', textAlign:'left', padding:0, overflow:'hidden', marginBottom:22, background:'var(--hero)' }}>
          <div style={{ padding:'16px 17px', display:'flex', alignItems:'center', gap:13 }}>
            <div style={{ width:46, height:46, borderRadius:13, background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>🏪</div>
            <div style={{ flex:1, minWidth:0, color:'#fff' }}>
              <div style={{ fontSize:16.5, fontWeight:700 }}>{lang==='th'?'เปิดร้านของฉัน':'Open my shop'}</div>
              <div style={{ fontSize:12.5, opacity:.92, marginTop:2 }}>{lang==='th'?`สมัครใช้งาน · ทดลองฟรี ${_trialD} วัน`:`Sign up · ${_trialD}-day free trial`}</div>
            </div>
            <span style={{ color:'#fff' }}>{IC.chev}</span>
          </div>
        </button>

        <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-3)', marginBottom:12, textTransform:'uppercase', letterSpacing:'.04em' }}>{t('chooseView')}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
          {cards.map((c,i)=>(
            <button key={c.key} onClick={()=>{ if(c.key==='merchant'){ let has=false; try{ const st=JSON.parse(localStorage.getItem('kaidee_pos_v1')||'{}'); has=!!(st.shop&&st.shop.shopId); }catch(e){} if(!has){ alert(lang!=='en'?'กรุณาทำการสมัครร้านก่อน':'Please register a shop first'); onPick('crm'); return; } } onPick(c.key); }} className="kd-card kd-fadein" style={{ border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', gap:15, padding:'17px 17px', fontFamily:'var(--font)', textAlign:'left',
              animationDelay:`${i*0.06}s` }}>
              <div style={{ width:52, height:52, borderRadius:15, background:c.bg, color:c.tone, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {React.cloneElement(c.ic,{size:27})}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:16.5, fontWeight:700 }}>{c.title}</div>
                <div style={{ fontSize:13, color:'var(--ink-3)', marginTop:2 }}>{c.sub}</div>
              </div>
              <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop:'auto', paddingTop:20 }}>
          <button onClick={onHelp} className="kd-card" style={{ border:'none', cursor:'pointer', width:'100%',
            display:'flex', alignItems:'center', gap:12, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:11, background:'var(--bg)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:18 }}>?</span>
            <span style={{ flex:1, fontSize:15, fontWeight:700 }}>{lang==='th'?'คู่มือการใช้งาน':'User guide'}</span>
            <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
          </button>
          <div style={{ paddingTop:16, textAlign:'center', fontSize:12, color:'var(--ink-3)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            {React.cloneElement(IC.check,{size:13,color:'var(--brand)'})} {t('demoNote')}
          </div>
          <div style={{ paddingTop:12, textAlign:'center', fontSize:11, color:'var(--ink-3)', lineHeight:1.7 }}>
            © 2026 Done · KaiDee POS · v1.0<br/>
            <span style={{ textDecoration:'underline', cursor:'pointer' }}>{lang==='th'?'นโยบายความเป็นส่วนตัว':'Privacy Policy'}</span> · <span style={{ textDecoration:'underline', cursor:'pointer' }}>{lang==='th'?'เงื่อนไขการใช้งาน':'Terms of Service'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════ DEMO CONTROLS (outside phone) ══════════════ */
function DemoControls({ role, setRole, lang, setLang, onHelp }){
  const t = (k)=>tr(lang,k);
  const roles = [
    { key:'merchant', label:t('merchant'), ic:IC.store },
    { key:'customer', label:t('customer'), ic:IC.bag },
    { key:'rider',    label:t('rider'),    ic:IC.moto },
  ];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', justifyContent:'center', maxWidth:420 }}>
      <button onClick={()=>setRole(null)} title="Home" style={{ ...ctlBtn, padding:'10px 12px' }}>
        {React.cloneElement(IC.menu,{size:18, color:'var(--ink-2)'})}</button>
      <div style={{ display:'flex', background:'#fff', borderRadius:999, padding:4, boxShadow:'var(--shadow)', gap:2 }}>
        {roles.map(r=>{ const on=role===r.key; return (
          <button key={r.key} onClick={()=>setRole(r.key)} style={{ border:'none', cursor:'pointer', borderRadius:999,
            padding:'9px 14px', fontFamily:'var(--font)', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:6,
            background: on?'var(--brand)':'transparent', color: on?'#fff':'var(--ink-2)', transition:'background .15s' }}>
            {React.cloneElement(r.ic,{size:16, color:'currentColor'})}
            <span style={{ display: on?'inline':'none' }}>{r.label}</span>
          </button>
        );})}
      </div>
      <button onClick={()=>setLang(lang==='th'?'en':'th')} style={{ ...ctlBtn, gap:6, fontWeight:700, fontSize:13, color:'var(--ink-2)' }}>
        {React.cloneElement(IC.globe,{size:16, color:'var(--brand)'})}{lang==='th'?'ไทย':'EN'}</button>
      <button onClick={onHelp} title="Guide" style={{ ...ctlBtn, fontWeight:700, fontSize:15, color:'var(--brand)', width:42, justifyContent:'center' }}>?</button>
    </div>
  );
}
const ctlBtn = { border:'none', cursor:'pointer', background:'#fff', borderRadius:999, padding:'11px 15px',
  boxShadow:'var(--shadow)', fontFamily:'var(--font)', display:'flex', alignItems:'center' };

/* ══════════════ RESPONSIVE: phone detection + floating demo control ══════════════ */
function useIsPhone(){
  const [p,setP] = aState(()=> typeof window!=='undefined' ? window.matchMedia('(max-width:640px)').matches : false);
  React.useEffect(()=>{
    const mq = window.matchMedia('(max-width:640px)'); const h = e=>setP(e.matches);
    mq.addEventListener ? mq.addEventListener('change',h) : mq.addListener(h);
    return ()=> mq.removeEventListener ? mq.removeEventListener('change',h) : mq.removeListener(h);
  }, []);
  return p;
}
function FloatingDemo({ role, setRole, lang, setLang, onHelp }){
  const [open,setOpen] = aState(false);
  const [on,setOn] = aState(()=>{ try{ return localStorage.getItem('kd_fab_on')!=='0'; }catch(e){ return true; } });
  React.useEffect(()=>{ const h=()=>{ try{ setOn(localStorage.getItem('kd_fab_on')!=='0'); }catch(e){} }; window.addEventListener('kd-fab',h); window.addEventListener('storage',h); return ()=>{ window.removeEventListener('kd-fab',h); window.removeEventListener('storage',h); }; },[]);
  const [pos,setPos] = aState(()=>{ try{ return JSON.parse(localStorage.getItem('kd_fab_pos')||'null'); }catch(e){ return null; } });
  const drag = React.useRef(null);
  const fab = { border:'none', cursor:'pointer', width:44, height:44, borderRadius:999, background:'#fff',
    boxShadow:'var(--shadow-lg)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font)' };
  const roles = [['merchant',IC.store],['customer',IC.bag],['rider',IC.moto]];
  const onDown = (e)=>{ const box=e.currentTarget.parentElement.getBoundingClientRect();
    drag.current={ sx:e.clientX, sy:e.clientY, ox:box.left, oy:box.top, w:box.width, h:box.height, moved:false };
    try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(_){} };
  const onMove = (e)=>{ const d=drag.current; if(!d) return; const dx=e.clientX-d.sx, dy=e.clientY-d.sy;
    if(Math.abs(dx)>4||Math.abs(dy)>4) d.moved=true;
    const maxX=window.innerWidth-d.w-8, maxY=window.innerHeight-d.h-8;
    setPos({ x:Math.max(8,Math.min(d.ox+dx,maxX)), y:Math.max(8,Math.min(d.oy+dy,maxY)) }); };
  const onUp = (e)=>{ const d=drag.current; if(!d) return; drag.current=null;
    if(d.moved){ setPos(p=>{ if(p) try{ localStorage.setItem('kd_fab_pos', JSON.stringify(p)); }catch(_){} ; return p; }); }
    else setOpen(o=>!o); };
  const anchor = pos
    ? { left:pos.x, top:pos.y }
    : { right:'max(10px,env(safe-area-inset-right))', bottom:'calc(80px + env(safe-area-inset-bottom))' };
  if(!on) return null;
  return (
    <div style={{ position:'fixed', zIndex:99999, ...anchor, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:9 }}>
      {open && <div className="kd-pop" style={{ display:'flex', flexDirection:'column', gap:9, alignItems:'flex-end' }}>
        <button onClick={()=>{ setRole(null); setOpen(false); }} style={{ ...fab, width:'auto', padding:'0 16px', fontWeight:700, fontSize:13, color:'var(--ink-2)' }}>{lang==='th'?'หน้าหลัก':'Home'}</button>
        {roles.map(([k,ic])=>(<button key={k} onClick={()=>{ setRole(k); setOpen(false); }} style={{ ...fab, background: role===k?'var(--brand)':'#fff' }}>
          {React.cloneElement(ic,{size:19,color: role===k?'#fff':'var(--ink-2)'})}</button>))}
        <button onClick={()=>setLang(lang==='th'?'en':'th')} style={{ ...fab, fontWeight:700, fontSize:12.5, color:'var(--brand-ink)' }}>{lang==='th'?'ไทย':'EN'}</button>
        <button onClick={()=>{ onHelp(); setOpen(false); }} style={{ ...fab, fontWeight:700, fontSize:18, color:'var(--brand)' }}>?</button>
        <button onClick={()=>{ try{localStorage.setItem('kd_fab_on','0');}catch(e){} try{window.dispatchEvent(new Event('kd-fab'));}catch(e){} setOpen(false); }} style={{ ...fab, width:'auto', padding:'0 14px', fontWeight:700, fontSize:12.5, color:'var(--danger)' }}>{lang==='th'?'ซ่อนปุ่ม':'Hide'}</button>
      </div>}
      <button onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        title={lang==='th'?'ลากเพื่อย้าย · แตะเพื่อเปิดเมนู':'Drag to move · tap to open'}
        style={{ ...fab, width:50, height:50, background:'var(--brand)', touchAction:'none' }}>
        {open ? React.cloneElement(IC.x,{size:22,color:'#fff'}) : React.cloneElement(IC.menu,{size:21,color:'#fff'})}</button>
    </div>
  );
}

/* ══════════════ FIRST-USE TIP (ลูกค้า/ไรเดอร์ · แสดงครั้งแรก) ══════════════ */
function FirstUseTip({ role, lang }){
  const TH = lang!=='en';
  const KEY = 'kd_seen_intro_'+role;
  const [open,setOpen] = aState(()=>{ try{ return !localStorage.getItem(KEY); }catch(e){ return true; } });
  if(!open) return null;
  const close = ()=>{ try{ localStorage.setItem(KEY,'1'); }catch(e){} setOpen(false); };
  const data = role==='customer'
    ? { ic:'🛍️', title:TH?'สั่งอาหารง่าย ๆ':'Ordering is easy', steps:[
        ['🍽️',TH?'เลือกเมนู':'Pick a dish',TH?'แตะเมนูที่อยากได้ ใส่ตะกร้า':'Tap a dish, add to cart'],
        ['🛒',TH?'ดูตะกร้า':'Review cart',TH?'ปรับจำนวน แล้วกดสั่ง':'Adjust qty, then order'],
        ['💸',TH?'จ่ายพร้อมเพย์':'Pay by PromptPay',TH?'สแกนจ่าย แนบสลิป รอร้านยืนยัน':'Scan, attach slip, done'] ] }
    : { ic:'🛵', title:TH?'รับงานส่งไว':'Deliver fast', steps:[
        ['📦',TH?'กดรับงาน':'Accept a job',TH?'ดูงานใหม่ เลือกที่รับไหว':'See new jobs, accept'],
        ['🗺️',TH?'ไปรับ-ส่ง':'Pick up & go',TH?'ไปร้าน รับของ นำส่งลูกค้า':'Get food, deliver'],
        ['✅',TH?'จบงาน':'Complete',TH?'กดจบงาน เก็บรายได้':'Finish, collect earnings'] ] };
  return (
    <div style={{ position:'absolute', inset:0, zIndex:9000, background:'rgba(15,30,25,.5)', display:'flex', alignItems:'flex-end' }} onClick={close}>
      <div className="kd-slideup kd-card" onClick={e=>e.stopPropagation()} style={{ width:'100%', borderRadius:'22px 22px 0 0', padding:'22px 22px calc(22px + env(safe-area-inset-bottom))' }}>
        <div style={{ textAlign:'center', fontSize:34 }}>{data.ic}</div>
        <div style={{ textAlign:'center', fontSize:19, fontWeight:700, marginTop:4 }}>{data.title}</div>
        <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:12 }}>
          {data.steps.map((s,i)=>(<div key={i} style={{ display:'flex', gap:13, alignItems:'center' }}>
            <div style={{ width:44, height:44, borderRadius:13, background:'var(--brand-soft)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, flexShrink:0 }}>{s[0]}</div>
            <div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:14.5 }}>{i+1}. {s[1]}</div><div style={{ fontSize:12.5, color:'var(--ink-3)' }}>{s[2]}</div></div>
          </div>))}
        </div>
        <button className="kd-btn kd-btn-primary kd-btn-block" style={{ marginTop:20 }} onClick={close}>{TH?'เริ่มใช้งาน':'Get started'}</button>
      </div>
    </div>
  );
}

Object.assign(window, { KaiDeeApp, Launcher, DemoControls, FloatingDemo, useIsPhone, FirstUseTip });
