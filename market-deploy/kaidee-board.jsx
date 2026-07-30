// kaidee-board.jsx — จอแสดงคิว (queue board) · เปิดบนจอหน้าร้าน/แท็บเล็ต ?shop=<id>&role=board
// อ่านออเดอร์จาก store (โหลด+poll โดย kaidee-app) · แยกการ์ดตามช่องทาง · เลือกแนวตั้ง/แนวนอนได้
const { useState:bState } = React;

function QueueBoard({ store }){
  const { lang } = useT();
  const TH = lang!=='en';
  const CH = (typeof window!=='undefined' && window.CHANNELS) || {};
  const [, force] = bState(0);
  React.useEffect(()=>{ const t=setInterval(()=>force(x=>x+1), 15000); return ()=>clearInterval(t); },[]);   // รีเฟรชนาฬิกา

  // แนวการวางการ์ด: 'land' = แนวนอน (เรียงข้างกัน · จอทีวีแนวนอน) · 'port' = แนวตั้ง (เรียงลงล่าง · จอแนวตั้ง)
  const [orient, setOrient] = bState(()=>{ try{ return localStorage.getItem('kd_board_orient')||'auto'; }catch(e){ return 'auto'; } });
  const setOri = (o)=>{ setOrient(o); try{ localStorage.setItem('kd_board_orient', o); }catch(e){} };
  React.useEffect(()=>{ const h=()=>force(x=>x+1); window.addEventListener('resize',h); window.addEventListener('orientationchange',h); return ()=>{ window.removeEventListener('resize',h); window.removeEventListener('orientationchange',h); }; },[]);

  const orders = (store.orders||[]).filter(o=> ['new','cooking','ready'].includes(o.status));
  const chMeta = (k)=>{ const cfg=(store&&store.chanCfg)||{}; const m=(cfg.custom&&cfg.custom[k])||CH[k]||{}; return { label:(m[lang]||m.th||String(k)||(TH?'หน้าร้าน':'Store')), color:(m.c||'#1f8a4e'), prefix:(m.prefix||'') }; };
  // เลขคิวที่ระบบรัน = อักษรช่องทาง (W/A/L/G/M/S/P) + เลขวิ่งต่อช่องทาง
  const numOf = (o)=>{ const n = o.qnum!=null ? o.qnum : o.no; const pf = chMeta(o.channel||'line').prefix; return pf ? pf+n : String(n); };
  // เลขออเดอร์ฝั่งแพลตฟอร์ม (ที่ร้านกรอกตอนจับบิล) — โชว์เพิ่มใต้เลขคิว
  const platOf = (o)=>{ const p=o.platNo!=null?String(o.platNo).trim():''; return p||''; };

  // จัดกลุ่มตามช่องทาง → แต่ละช่องทางมี กำลังทำ / พร้อมรับ
  const byChan = {};
  orders.forEach(o=>{ const k=o.channel||'line'; (byChan[k]=byChan[k]||{ cooking:[], ready:[] }); (o.status==='ready'?byChan[k].ready:byChan[k].cooking).push(o); });
  // เรียงเลขคิวจากน้อย→มากในแต่ละกลุ่ม
  Object.values(byChan).forEach(g=>{ const s=(a,b)=>numOf(a)-numOf(b); g.cooking.sort(s); g.ready.sort(s); });
  const chans = Object.keys(byChan).sort((a,b)=> (byChan[b].cooking.length+byChan[b].ready.length) - (byChan[a].cooking.length+byChan[a].ready.length));

  const shopName = (store.shop && store.shop.name) || 'KaiDee';
  const cover = (store.shop && store.shop.cover) || '';
  const headBg = cover ? `linear-gradient(rgba(11,26,21,.72),rgba(11,26,21,.82)), url(${cover}) center/cover` : 'linear-gradient(120deg,#14312a,#1c4438)';
  const now = new Date().toLocaleTimeString(TH?'th-TH':'en-US',{hour:'2-digit',minute:'2-digit'});
  const totalWait = orders.filter(o=>o.status!=='ready').length;
  const totalReady = orders.filter(o=>o.status==='ready').length;
  const land = orient==='auto' ? ((typeof window!=='undefined')?window.innerWidth>=window.innerHeight:true) : orient==='land';

  // ดีลสปอนเซอร์บนจอคิว — เจ้าของร้านเปิดเอง (features.sponsorDeals) · 1 การ์ด · กันหมวดที่ชนกับร้าน
  const spDeal = React.useMemo(()=>{
    const f=(store.shop&&store.shop.features)||{}; if(f.sponsorDeals!==true||!window.kdSponsorDeals) return null;
    const excl=window.kdSponsorCatsOfShop?window.kdSponsorCatsOfShop(store.shop):[];
    const rows=window.kdSponsorDeals({ limit:1, mod:'board', exclude:excl });
    if(rows[0]&&window.kdSponsorBump) window.kdSponsorBump('board',[rows[0].id||rows[0].shopId]);
    return rows[0]||null;
  },[store.shop, orders.length]);

  const Chip = ({o, tone})=>{ const ready=tone==='ready'; const plat=platOf(o); return (
    <div style={{ minWidth:land?78:70, textAlign:'center', background: ready?'#12813f':'#fff',
      border:`2.5px solid ${ready?'#12813f':'#dbe6e0'}`, borderRadius:15, padding:land?'11px 13px':'9px 11px',
      boxShadow: ready?'0 4px 13px rgba(18,129,63,.24)':'0 1px 5px rgba(0,0,0,.05)' }}>
      <div className="num" style={{ fontSize: land?'clamp(30px,3vw,46px)':'clamp(26px,5vw,38px)', fontWeight:900, lineHeight:.95, letterSpacing:'-.02em', color: ready?'#fff':'#16302a' }}>{numOf(o)}</div>
      {plat && <div style={{ fontSize:11.5, fontWeight:800, color: ready?'rgba(255,255,255,.92)':'#B26A00', marginTop:5, whiteSpace:'nowrap' }}>#{plat}</div>}
      {o.customer && <div style={{ fontSize:12, fontWeight:800, color: ready?'rgba(255,255,255,.95)':'#16302a', marginTop:4, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.customer}</div>}
      {o.table && <div style={{ fontSize:12, fontWeight:800, color: ready?'rgba(255,255,255,.9)':'#7a8b84', marginTop:4 }}>{TH?'โต๊ะ':'T'} {o.table}</div>}
      {o.note && <div style={{ fontSize:11, fontWeight:700, color: ready?'rgba(255,255,255,.9)':'#B26A00', marginTop:4, maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📝 {o.note}</div>}
    </div>
  ); };

  const Section = ({title, dot, color, list})=> (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:9 }}>
        <span style={{ width:9, height:9, borderRadius:'50%', background:color, display:'inline-block' }}></span>
        <span style={{ fontSize:'clamp(13px,1.2vw,15px)', fontWeight:800, color, letterSpacing:'.01em' }}>{title}</span>
        <span style={{ fontSize:12, fontWeight:800, color:'#fff', background:color, borderRadius:20, padding:'1px 9px' }}>{list.length}</span>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
        {list.length ? list.map(o=><Chip key={o.id} o={o} tone={dot==='ready'?'ready':'cook'}/>) : <span style={{ color:'#b3c1ba', fontSize:14, fontWeight:700, alignSelf:'center' }}>—</span>}
      </div>
    </div>
  );

  const OriBtn = ({v, icon, label})=> (
    <button onClick={()=>setOri(v)} style={{ display:'flex', alignItems:'center', gap:7, border:'none', cursor:'pointer',
      background: orient===v?'#fff':'rgba(255,255,255,.14)', color: orient===v?'#14312a':'#fff',
      borderRadius:12, padding:'9px 15px', fontSize:15, fontWeight:800, fontFamily:'var(--font)' }}>
      <span style={{ fontSize:18, lineHeight:1 }}>{icon}</span>{label}
    </button>
  );

  return (
    <div style={{ position:'absolute', inset:0, background:'linear-gradient(165deg,#eef4f0,#e3ede7)', display:'flex', flexDirection:'column', fontFamily:'var(--font)', overflow:'hidden' }}>
      <div style={{ flexShrink:0, display:'flex', flexWrap:'wrap', alignItems:'center', gap:'12px 16px', padding:'max(16px,env(safe-area-inset-top)) 24px 16px', background:headBg, color:'#fff' }}>
        <div style={{ flex:'1 1 180px', minWidth:150 }}>
          <div style={{ fontSize:'clamp(19px,2vw,28px)', fontWeight:900, letterSpacing:'-.01em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shopName}</div>
          <div style={{ fontSize:13, opacity:.75, fontWeight:600, marginTop:2 }}>{TH?'จอแสดงคิวออเดอร์':'Order queue board'}</div>
        </div>
        <div style={{ display:'flex', gap:8, background:'rgba(0,0,0,.18)', padding:5, borderRadius:15 }}>
          <OriBtn v="auto" icon="↻" label={TH?'อัตโนมัติ':'Auto'}/>
          <OriBtn v="land" icon="▭" label={TH?'แนวนอน':'Landscape'}/>
          <OriBtn v="port" icon="▯" label={TH?'แนวตั้ง':'Portrait'}/>
        </div>
        <div style={{ textAlign:'right', minWidth:104 }}>
          <div className="num" style={{ fontSize:'clamp(20px,2vw,28px)', fontWeight:800 }}>{now}</div>
          <div style={{ fontSize:12.5, opacity:.85, fontWeight:600 }}>{TH?`รอ ${totalWait} · พร้อม ${totalReady}`:`${totalWait} waiting · ${totalReady} ready`}</div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'24px 30px' }}>
        {chans.length===0 && <div style={{ height:'100%', display:'flex', flexDirection:'column', gap:12, alignItems:'center', justifyContent:'center', color:'#9aaba3', textAlign:'center' }}>
          <div style={{ fontSize:64 }}>🍽️</div>
          <div style={{ color:'#7a8b84', fontSize:'clamp(20px,2.4vw,30px)', fontWeight:800 }}>{TH?'ยังไม่มีคิวตอนนี้':'No queue right now'}</div>
        </div>}
        <div style={ land
          ? { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:18, alignItems:'start' }
          : { display:'flex', flexDirection:'column', gap:16, maxWidth:720, margin:'0 auto' } }>
          {chans.map(k=>{ const g=byChan[k]; const cm=chMeta(k); const tot=g.cooking.length+g.ready.length; return (
            <div key={k} style={{ background:'#fff', borderRadius:18, overflow:'hidden', boxShadow:'0 4px 16px rgba(16,48,42,.07)', border:'1px solid rgba(16,48,42,.05)' }}>
              <div style={{ background:cm.color, color:'#fff', padding:'12px 17px', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ fontSize:'clamp(16px,1.5vw,21px)', fontWeight:900, flex:1, letterSpacing:'-.01em' }}>{cm.label}</div>
                <div style={{ fontSize:13, fontWeight:800, background:'rgba(255,255,255,.22)', borderRadius:20, padding:'3px 11px' }}>{tot} {TH?'คิว':'q'}</div>
              </div>
              <div style={{ padding:'15px 17px', display:'flex', flexDirection:'column', gap:15 }}>
                <Section title={TH?'กำลังทำ':'Cooking'} dot="cook" color="#c67c00" list={g.cooking}/>
                {g.ready.length>0 && <Section title={TH?'พร้อมรับแล้ว':'Ready'} dot="ready" color="#12813f" list={g.ready}/>}
              </div>
            </div>
          ); })}
        </div>
      </div>

      {spDeal && <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:14, padding:'12px 30px', background:'#fff', borderTop:'1px solid rgba(16,48,42,.08)' }}>
        <span style={{ fontSize:11.5, fontWeight:800, color:'#7a8b84', letterSpacing:'.06em', flex:'0 0 auto' }}>{TH?'ดีลใกล้ร้าน':'DEAL NEARBY'}</span>
        <span style={{ fontSize:26, flex:'0 0 auto' }}>{spDeal.shop.emoji}</span>
        <span style={{ flex:1, minWidth:0, overflow:'hidden' }}>
          <span style={{ display:'block', fontSize:'clamp(15px,1.4vw,19px)', fontWeight:900, color:'#16302a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{spDeal.shop.name}</span>
          <span style={{ display:'block', fontSize:'clamp(12.5px,1.1vw,15px)', fontWeight:600, color:'#5c6f68', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{spDeal.title}</span>
        </span>
        <span style={{ flex:'0 0 auto', fontSize:'clamp(14px,1.3vw,18px)', fontWeight:900, color:'#12813f', background:'#e9f7f1', borderRadius:12, padding:'7px 14px' }}>{spDeal.kind==='pct'?('ลด '+(spDeal.value||0)+'%'):('ลด ฿'+Number(spDeal.value||0).toLocaleString('th-TH'))}</span>
      </div>}

      <div style={{ flexShrink:0, padding:'11px 30px', background:'#14312a', color:'rgba(255,255,255,.72)', fontSize:13.5, fontWeight:600, textAlign:'center', display:'flex', justifyContent:'center', gap:22, flexWrap:'wrap' }}>
        <span>🟠 {TH?'กำลังทำ':'Cooking'}</span>
        <span>🟢 {TH?'เลขเขียว = พร้อมรับ มารับได้เลย':'Green = ready, please collect'}</span>
      </div>
    </div>
  );
}

/* ══════════════ KDS · จอครัว (Kitchen Display) ══════════════
   เปิดบนจอ/แท็บเล็ตในครัว ?shop=<id>&role=kds · โชว์ตั๋วออเดอร์พร้อมรายการ
   ครัวกดปุ่มเลื่อนสถานะ (เริ่มทำ → ทำเสร็จ → เคลียร์) sync เข้าหน้าออเดอร์/จอคิว */
function KitchenBoard({ store }){
  const { lang } = useT();
  const TH = lang!=='en';
  const CH = (typeof window!=='undefined' && window.CHANNELS) || {};
  const [, force] = bState(0);
  React.useEffect(()=>{ const t=setInterval(()=>force(x=>x+1), 20000); return ()=>clearInterval(t); },[]);   // รีเฟรชเวลา/เวลารอ
  // แนวการวาง (เหมือนจอคิว) — แนวนอน/แนวตั้ง
  const [orient, setOrient] = bState(()=>{ try{ return localStorage.getItem('kd_kds_orient')||'auto'; }catch(e){ return 'auto'; } });
  const setOri = (o)=>{ setOrient(o); try{ localStorage.setItem('kd_kds_orient', o); }catch(e){} };
  React.useEffect(()=>{ const h=()=>force(x=>x+1); window.addEventListener('resize',h); window.addEventListener('orientationchange',h); return ()=>{ window.removeEventListener('resize',h); window.removeEventListener('orientationchange',h); }; },[]);
  const land = orient==='auto' ? ((typeof window!=='undefined')?window.innerWidth>=window.innerHeight:true) : orient==='land';

  const chMeta = (k)=>{ const cfg=(store&&store.chanCfg)||{}; const m=(cfg.custom&&cfg.custom[k])||CH[k]||{}; return { label:(m[lang]||m.th||String(k)||(TH?'หน้าร้าน':'Store')), color:(m.c||'#1f8a4e'), prefix:(m.prefix||'') }; };
  const mById = (id)=> (store.menu||[]).find(m=>m.id===id) || {};
  const numOf = (o)=>{ const n = o.qnum!=null ? o.qnum : o.no; const pf = chMeta(o.channel||'line').prefix; return pf ? pf+n : String(n); };
  const tsOf = (o)=>{ if(o.createdAt) return o.createdAt; if(o.ts) return o.ts; const n=Number(String(o.id||'').replace(/\D/g,'').slice(0,13)); return n>1e12?n:0; };
  const ago = (o)=>{ const t=tsOf(o); if(!t) return ''; const m=Math.max(0,Math.floor((Date.now()-t)/60000)); return m<1?(TH?'เพิ่งเข้า':'now'):(m+(TH?' นาที':'m')); };

  // ตั๋วที่ครัวต้องเห็น = ยังไม่เสร็จ · จัดกลุ่มตามช่องทาง (เหมือนจอคิว) · ในกลุ่มเรียงเก่า→ใหม่ + ปักหมุดขึ้นบน
  const tickets = (store.orders||[]).filter(o=> ['new','cooking','ready'].includes(o.status));
  const byChan = {};
  tickets.forEach(o=>{ const k=o.channel||'line'; (byChan[k]=byChan[k]||[]).push(o); });
  Object.values(byChan).forEach(list=> list.sort((a,b)=> (b.pin?1:0)-(a.pin?1:0) || tsOf(a)-tsOf(b)));
  const chans = Object.keys(byChan).sort((a,b)=> byChan[b].length - byChan[a].length);

  const NEXT = { new:'cooking', cooking:'ready', ready:'done' };
  const bump = (o)=>{ const ns=NEXT[o.status]; if(ns && store.patchOrder) store.patchOrder(o.id, { status:ns }); };
  const OriBtn = ({v,icon,label})=>(<button onClick={()=>setOri(v)} style={{ display:'flex', alignItems:'center', gap:6, border:'none', cursor:'pointer', background: orient===v?'#fff':'rgba(255,255,255,.12)', color: orient===v?'#14312a':'#fff', borderRadius:11, padding:'8px 13px', fontSize:14, fontWeight:800, fontFamily:'var(--font)' }}><span style={{fontSize:17,lineHeight:1}}>{icon}</span>{label}</button>);
  const ST = {
    new:     { th:'ออเดอร์ใหม่', en:'New',     c:'#E0533D', btn:TH?'เริ่มทำ ▶':'Start ▶' },
    cooking: { th:'กำลังทำ',    en:'Cooking', c:'#D98A00', btn:TH?'ทำเสร็จ ✓':'Ready ✓' },
    ready:   { th:'ทำเสร็จแล้ว', en:'Ready',   c:'#16A34A', btn:TH?'เคลียร์ · ส่งแล้ว':'Clear · served' },
  };

  const shopName = (store.shop && store.shop.name) || 'KaiDee';
  const now = new Date().toLocaleTimeString(TH?'th-TH':'en-US',{hour:'2-digit',minute:'2-digit'});
  const nNew = tickets.filter(o=>o.status==='new').length;
  const nCook = tickets.filter(o=>o.status==='cooking').length;

  const Ticket = ({o})=>{ const st=ST[o.status]||ST.new; const cm=chMeta(o.channel||'line'); const items=o.items||[]; return (
    <div style={{ background:'#18211d', border:`2.5px solid ${st.c}`, borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column',
      boxShadow: o.status==='new'?`0 0 0 3px ${st.c}33, 0 8px 24px rgba(0,0,0,.35)`:'0 6px 18px rgba(0,0,0,.3)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 13px', background:st.c }}>
        <span className="num" style={{ fontSize:26, fontWeight:900, color:'#fff', lineHeight:1 }}>{numOf(o)}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(st[lang]||st.th)}{o.table?` · ${TH?'โต๊ะ':'T'} ${o.table}`:''}</div>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.85)' }}>{o.customer||cm.label}</div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          {o.pin && <div style={{ fontSize:10.5, fontWeight:800, color:'#fff', background:'rgba(0,0,0,.22)', borderRadius:999, padding:'1px 7px', marginBottom:3 }}>📌 {TH?'ทำก่อน':'Rush'}</div>}
          <div style={{ fontSize:12, fontWeight:800, color:'rgba(255,255,255,.92)' }}>⏱ {ago(o)}</div>
        </div>
      </div>
      <div style={{ padding:'11px 13px', display:'flex', flexDirection:'column', gap:7, flex:1 }}>
        {items.map(([id,q,opt],i)=>{ const m=mById(id); return (
          <div key={i} style={{ display:'flex', gap:9, alignItems:'baseline' }}>
            <span className="num" style={{ fontSize:20, fontWeight:900, color:'#fff', minWidth:34 }}>{q}×</span>
            <div style={{ flex:1 }}>
              <span style={{ fontSize:16, fontWeight:700, color:'#eaf2ee' }}>{m[lang]||m.th||(TH?'(เมนูถูกลบ)':'(removed)')}</span>
              {opt ? <span style={{ display:'block', fontSize:13, color:'#9fb3aa', marginTop:1 }}>{opt}</span> : null}
            </div>
          </div>
        );})}
        {o.note && <div style={{ marginTop:2, background:'#3a2f12', border:'1px solid #6b5416', borderRadius:9, padding:'7px 10px', fontSize:13.5, fontWeight:700, color:'#ffd98a' }}>📝 {o.note}</div>}
      </div>
      <button onClick={()=>bump(o)} style={{ border:'none', cursor:'pointer', background:st.c, color:'#fff', fontFamily:'var(--font)', fontWeight:800, fontSize:16, padding:'13px', width:'100%' }}>{st.btn}</button>
    </div>
  ); };

  return (
    <div style={{ position:'absolute', inset:0, background:'#0e1613', display:'flex', flexDirection:'column', fontFamily:'var(--font)', overflow:'hidden' }}>
      <div style={{ flexShrink:0, display:'flex', flexWrap:'wrap', alignItems:'center', gap:'10px 16px', padding:'max(14px,env(safe-area-inset-top)) 22px 14px', background:'#12211b', color:'#fff', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
        <div style={{ flex:'1 1 180px', minWidth:150 }}>
          <div style={{ fontSize:'clamp(18px,2vw,26px)', fontWeight:900, letterSpacing:'-.01em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shopName}</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.6)', fontWeight:700, marginTop:2 }}>👨‍🍳 {TH?'จอครัว · KDS':'Kitchen display · KDS'}</div>
        </div>
        <div style={{ display:'flex', gap:9 }}>
          <div style={{ textAlign:'center', background:'rgba(224,83,61,.18)', border:'1px solid #E0533D', borderRadius:12, padding:'6px 14px' }}>
            <div className="num" style={{ fontSize:22, fontWeight:900, color:'#ff8a75' }}>{nNew}</div>
            <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.7)' }}>{TH?'ใหม่':'New'}</div></div>
          <div style={{ textAlign:'center', background:'rgba(217,138,0,.16)', border:'1px solid #D98A00', borderRadius:12, padding:'6px 14px' }}>
            <div className="num" style={{ fontSize:22, fontWeight:900, color:'#ffc866' }}>{nCook}</div>
            <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.7)' }}>{TH?'กำลังทำ':'Cooking'}</div></div>
        </div>
        <div style={{ display:'flex', gap:7, background:'rgba(0,0,0,.22)', padding:5, borderRadius:13 }}>
          <OriBtn v="auto" icon="↻" label={TH?'อัตโนมัติ':'Auto'}/>
          <OriBtn v="land" icon="▭" label={TH?'แนวนอน':'Land'}/>
          <OriBtn v="port" icon="▯" label={TH?'แนวตั้ง':'Port'}/>
        </div>
        <div style={{ textAlign:'right', minWidth:88 }}>
          <div className="num" style={{ fontSize:'clamp(18px,2vw,26px)', fontWeight:800 }}>{now}</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', fontWeight:700 }}>{tickets.length} {TH?'ตั๋ว':'tickets'}</div>
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
        {tickets.length===0
          ? <div style={{ height:'100%', display:'flex', flexDirection:'column', gap:12, alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,.4)' }}>
              <div style={{ fontSize:60 }}>🍳</div>
              <div style={{ fontSize:'clamp(18px,2.2vw,26px)', fontWeight:800 }}>{TH?'ไม่มีออเดอร์ค้างในครัว':'No open tickets'}</div>
            </div>
          : <div style={ land ? { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16, alignItems:'start' } : { display:'flex', flexDirection:'column', gap:16, maxWidth:760, margin:'0 auto' }}>
              {chans.map(k=>{ const cm=chMeta(k); const list=byChan[k]; return (
                <div key={k} style={{ background:'#141d19', borderRadius:16, overflow:'hidden', border:'1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ background:cm.color, color:'#fff', padding:'10px 15px', display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ fontSize:'clamp(15px,1.4vw,19px)', fontWeight:900, flex:1, letterSpacing:'-.01em' }}>{cm.label}</div>
                    <div style={{ fontSize:12.5, fontWeight:800, background:'rgba(0,0,0,.2)', borderRadius:20, padding:'2px 10px' }}>{list.length} {TH?'ตั๋ว':'q'}</div>
                  </div>
                  <div style={{ padding:'13px', display:'flex', flexDirection:'column', gap:12 }}>
                    {list.map(o=><Ticket key={o.id} o={o}/>)}
                  </div>
                </div>
              );})}
            </div>}
      </div>
      <div style={{ flexShrink:0, padding:'10px 22px', background:'#12211b', color:'rgba(255,255,255,.6)', fontSize:13, fontWeight:600, textAlign:'center', display:'flex', justifyContent:'center', gap:20, flexWrap:'wrap', borderTop:'1px solid rgba(255,255,255,.08)' }}>
        <span>🔴 {TH?'ใหม่ = แตะ “เริ่มทำ”':'New = tap Start'}</span>
        <span>🟠 {TH?'กำลังทำ = แตะ “ทำเสร็จ”':'Cooking = tap Ready'}</span>
        <span>🟢 {TH?'เสร็จ = แตะเคลียร์ออกจากจอ':'Ready = tap to clear'}</span>
      </div>
    </div>
  );
}

Object.assign(window, { QueueBoard, KitchenBoard });
