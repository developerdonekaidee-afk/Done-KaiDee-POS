// backoffice-app.jsx — Backoffice ร้านค้า (จอคอม): ยอดขาย · สต๊อก · สมาชิก
// © 2569 (2026) KaiDee POS — สงวนลิขสิทธิ์ · All rights reserved. ห้ามคัดลอก/ดัดแปลงโดยไม่ได้รับอนุญาต · [KDPOS-WM-2026-oneday]
// ใช้ logic เดียวกับแอป (saleTotal/saleBookable/effSaleCost/kdVat) + KD_API · เจ้าของร้านเท่านั้น (owner token)
const { useState, useEffect, useRef, useMemo } = React;

/* ─────────── helpers ─────────── */
const B = (n)=> '฿'+Math.round(Number(n)||0).toLocaleString('en-US');
const B1 = (n)=> '฿'+(Number(n)||0).toLocaleString('en-US',{maximumFractionDigits:1});
const isoDay = (off)=>{ const x=new Date(); x.setDate(x.getDate()-(off||0)); return x.toISOString().slice(0,10); };
const tmin = (t)=>{ const m=/(\d{1,2}):(\d{2})/.exec(t||''); return m?(+m[1]*60+ +m[2]):0; };
const thDate = (d)=>{ if(!d) return '—'; const [y,m,dd]=String(d).split('-'); return dd+'/'+m+'/'+(String(+y+543).slice(-2)); };
const thDateTime = (ts)=>{ if(!ts) return '—'; const x=new Date(ts); return thDate(x.toISOString().slice(0,10))+' '+x.toTimeString().slice(0,5); };
const shopFromUrl = ()=>{ try{ const u=new URL(location.href); return u.searchParams.get('shop')||localStorage.getItem('kd_shop')||'kaidee'; }catch(e){ return 'kaidee'; } };
const lineFromEnv = ()=>{ try{ return (window.__lineUser&&window.__lineUser.userId)||localStorage.getItem('kd_line_uid')||localStorage.getItem('kd_owner_line')||''; }catch(e){ return ''; } };
function downloadCSV(name, rows){
  const csv = rows.map(r=>r.map(c=>{ c=String(c==null?'':c); return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c; }).join(',')).join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
}
const chName = (k)=>{ const m=CHANNELS[k]; return m?m.th:(k||'—'); };
const payName = (k)=>({cash:'เงินสด',promptpay:'พร้อมเพย์',transfer:'เงินโอน',cod:'ปลายทาง',platform:'แพลตฟอร์ม'}[k]||k||'—');
const nonVoid = (s)=> !s.void && s.status!=='void' && s.status!=='rejected';

/* ─────────── DEMO seed (ใช้เมื่อไม่มี owner token / offline — ให้ UI ทำงานได้เสมอ) ─────────── */
function makeSeedData(){
  window.__kdMenu = MENU;
  const CH=['walkin','takeaway','dinein','grab','linemn','line'], PY=['cash','promptpay','transfer','cod'];
  const members=[
    {id:'U01',name:'คุณแนน ใจดี',phone:'081-234-5678',tier:'gold',points:340,visits:24,created_at:Date.now()-70*864e5},
    {id:'U02',name:'คุณโอ๊ต',phone:'089-111-2233',tier:'silver',points:150,visits:12,created_at:Date.now()-40*864e5},
    {id:'m1699',name:'คุณกิ่ง',phone:'062-555-8899',tier:'member',points:60,visits:5,created_at:Date.now()-12*864e5},
    {id:'U04',name:'คุณเบสท์',phone:'090-777-1212',tier:'gold',points:410,visits:31,created_at:Date.now()-95*864e5},
    {id:'m1720',name:'คุณฝ้าย',phone:'', tier:'member',points:20,visits:2,created_at:Date.now()-5*864e5},
    {id:'U06',name:'คุณต้น',phone:'084-330-9090',tier:'silver',points:190,visits:15,created_at:Date.now()-3*864e5},
  ];
  const mids=members.map(m=>m.id);
  const sales=[]; let no=1042;
  for(let d=13; d>=0; d--){ const day=isoDay(d); const n=4+Math.floor(Math.random()*8);
    for(let k=0;k<n;k++){ const nItems=1+Math.floor(Math.random()*3), items=[];
      for(let j=0;j<nItems;j++){ const m=MENU[Math.floor(Math.random()*MENU.length)]; items.push([m.id,1+Math.floor(Math.random()*2)]); }
      const channel=CH[Math.floor(Math.random()*CH.length)], pay=PY[Math.floor(Math.random()*PY.length)];
      const hh=String(8+Math.floor(Math.random()*12)).padStart(2,'0'), mm=String(Math.floor(Math.random()*60)).padStart(2,'0');
      const total=items.reduce((a,[id,q])=>a+(menuById(id).price||0)*q,0);
      const s={ id:'s'+no+'_'+d, no:no++, date:day, t:hh+':'+mm, items, channel, pay, total, paid:true, status:'done' };
      if(pay==='promptpay'||pay==='transfer'){ if(Math.random()<0.86){ s.verified=true; s.verifiedAmount=total; } else if(Math.random()<0.4){ s.payStatus='not_found'; } }
      if(channel==='grab'||channel==='linemn'||channel==='line'){ s.settleDate=isoDay(Math.max(0,d-2)); s.pay='platform'; }
      if(Math.random()<0.45) s.memberId=mids[Math.floor(Math.random()*mids.length)];
      if(Math.random()<0.035) s.void=true;
      sales.push(s);
    }
  }
  return { sales, orders:[], members, raw:RAW.map(r=>({...r})), purchases:SEED_PURCHASES.map(p=>({...p})), menu:MENU,
    settings:{ pay:{ vatMode:'inclusive', vatRate:7, loyalty:{ perBaht:25, stampGoal:10, rewardAt:100 } } } };
}

/* ─────────── data loading ─────────── */
async function loadReportData(shop, token){
  if(token){ try{ const d=await KD_API.reportData(shop, token, {}); if(d&&(d.sales||d.menu)){ window.__kdMenu=d.menu||[]; return d; } }catch(e){ console.warn('report fetch failed, fallback', e); } }
  try{
    const [sales,orders,members,raw,purchases,menu,settings]=await Promise.all([
      KD_API.listSales().catch(()=>null), KD_API.listOrders().catch(()=>[]),
      KD_API.listMembers().catch(()=>[]), KD_API.getRaw().catch(()=>[]),
      KD_API.listPurchases().catch(()=>[]), KD_API.getMenu().catch(()=>[]), KD_API.getSettings().catch(()=>({})) ]);
    if(sales && (sales.length || (menu&&menu.length))){ window.__kdMenu=menu||[]; return { sales:sales||[], orders:orders||[], members:members||[], raw:raw||[], purchases:purchases||[], menu:menu||[], settings:settings||{} }; }
  }catch(e){}
  return makeSeedData();
}

/* ─────────── Chart.js wrapper ─────────── */
function ChartBox({ type, labels, datasets, height=260, stacked }){
  const ref=useRef(), chart=useRef();
  useEffect(()=>{
    if(!window.Chart||!ref.current) return;
    if(chart.current) chart.current.destroy();
    chart.current=new window.Chart(ref.current,{ type, data:{ labels, datasets },
      options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
        plugins:{ legend:{ display:datasets.length>1, labels:{ font:{ family:'IBM Plex Sans Thai', size:12 }, usePointStyle:true, boxWidth:8 } },
          tooltip:{ titleFont:{family:'IBM Plex Sans Thai'}, bodyFont:{family:'IBM Plex Sans Thai'}, callbacks:{ label:(c)=>' '+c.dataset.label+': '+B(c.parsed.y) } } },
        scales:{ x:{ stacked:!!stacked, grid:{display:false}, ticks:{ font:{family:'IBM Plex Sans Thai',size:11}, color:'#8A948E' } },
          y:{ stacked:!!stacked, grid:{color:'#EEF1F0'}, ticks:{ font:{family:'IBM Plex Mono',size:11}, color:'#8A948E', callback:(v)=>'฿'+(v>=1000?(v/1000)+'k':v) } } } } });
    return ()=>{ if(chart.current){ chart.current.destroy(); chart.current=null; } };
  },[type,JSON.stringify(labels),JSON.stringify(datasets),stacked]);
  return <div style={{position:'relative',height}}><canvas ref={ref}/></div>;
}

/* ─────────── KPI + bars ─────────── */
function Kpi({ label, value, foot, tone }){
  return <div className="card kpi"><div className="lbl">{label}</div>
    <div className="val" style={{color:tone||'var(--ink)'}}>{value}</div>{foot && <div className="foot">{foot}</div>}</div>;
}
function BarList({ rows, color }){
  const max=Math.max(1,...rows.map(r=>r.v));
  if(!rows.length) return <div className="empty" style={{padding:'20px'}}>ไม่มีข้อมูล</div>;
  return rows.map((r,i)=>(<div className="barrow" key={i}>
    <span className="bl">{r.k}</span>
    <span className="bartrack"><span className="barfill" style={{width:(r.v/max*100)+'%',background:color||'var(--brand)'}}/></span>
    <span className="bv num">{B(r.v)}</span></div>));
}

/* ═════════════ SALES DASHBOARD ═════════════ */
function SalesView({ data, range }){
  const pay=(data.settings&&data.settings.pay)||{vatMode:'off'};
  const inR=(s)=> s.date && s.date>=range.from && s.date<=range.to;
  const rows=data.sales.filter(inR);
  const valid=rows.filter(nonVoid);
  const revenue=valid.reduce((a,s)=>a+saleTotal(s),0);
  const cost=valid.reduce((a,s)=>a+effSaleCost(s,data.menu,data.raw,'auto'),0);
  const profit=revenue-cost, margin=revenue?Math.round(profit/revenue*100):0;
  const orders=valid.length, avg=orders?revenue/orders:0;
  const vat=kdVat(revenue, pay);
  const vc=validateDayClose(valid);   // saleBookable vs expected + variance + pending

  // trend by transaction date (date-lock: ผูกวันขายจริง)
  const days=[]; { let a=new Date(range.from), b=new Date(range.to); for(let x=new Date(a); x<=b; x.setDate(x.getDate()+1)) days.push(x.toISOString().slice(0,10)); }
  const revByDay={}, ordByDay={}; valid.forEach(s=>{ revByDay[s.date]=(revByDay[s.date]||0)+saleTotal(s); ordByDay[s.date]=(ordByDay[s.date]||0)+1; });
  const trimDays = days.length>31 ? days.slice(-31) : days;

  // settlement (date-lock: เงินเข้าจริงวันไหน) — bookable ผูก settleDate/verified
  const setlByDay={}; valid.forEach(s=>{ const b=saleBookable(s); if(b==null) return; const d=s.settleDate||s.date; setlByDay[d]=(setlByDay[d]||0)+b; });

  const byPay={}; valid.forEach(s=>{ const k=(s.channel&&isPlatform(data.settings&&data.settings.chan,s.channel))?'platform':(s.pay||'cash'); byPay[k]=(byPay[k]||0)+saleTotal(s); });
  const byCh={}; valid.forEach(s=>{ byCh[s.channel||'walkin']=(byCh[s.channel||'walkin']||0)+saleTotal(s); });
  const qtyById={}, revById={}; valid.forEach(s=>s.items.forEach(([id,q])=>{ qtyById[id]=(qtyById[id]||0)+q; revById[id]=(revById[id]||0)+(menuById(id)?.price||0)*q; }));
  const top=Object.entries(qtyById).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const L=(pay.loyalty)||{}; const totalMembers=data.members.length;
  const monthKey=new Date().toISOString().slice(0,7);
  const newM=data.members.filter(m=>m.created_at&&new Date(m.created_at).toISOString().slice(0,7)===monthKey).length;
  const totalPoints=data.members.reduce((a,m)=>a+(m.points||0),0);
  const stampsIssued=data.members.reduce((a,m)=>a+(m.visits||0),0);

  const exportSales=()=>{ downloadCSV('ยอดขาย_'+range.from+'_'+range.to+'.csv',
    [['เลขบิล','วันที่ขาย','เวลา','ช่องทาง','ชำระ','ยอดขาย','ลงบัญชีได้(bookable)','วันเงินเข้า','สถานะ']]
    .concat(rows.map(s=>{ const b=saleBookable(s); return ['#'+(s.no||''),s.date||'',s.t||'',chName(s.channel),payName(s.pay),saleTotal(s),(b==null?'ค้างตรวจ':b),s.settleDate||s.date||'',s.void?'ยกเลิก':(s.payStatus==='not_found'?'ไม่พบยอด':'ปกติ')]; }))); };

  return (<div className="fade">
    <div className="toolbar" style={{justifyContent:'flex-end'}}>
      <button className="btn gh" onClick={exportSales}>⬇ ส่งออก CSV</button>
    </div>
    <div className="kpis">
      <Kpi label="ยอดขายรวม (Gross)" value={B(revenue)} foot={orders+' บิล'} tone="var(--brand-ink)"/>
      <Kpi label="กำไรขั้นต้น" value={B(profit)} foot={'มาร์จิ้น '+margin+'%'} tone="var(--blue-ink)"/>
      <Kpi label="ยอดเฉลี่ย/บิล" value={B1(avg)} foot="Average ticket"/>
      <Kpi label={'VAT ('+Math.round(vat.rate)+'%)'} value={B(vat.vat)} foot={pay.vatMode==='off'?'ปิดคิด VAT':'ก่อน VAT '+B(vat.base)}/>
      <Kpi label="ลงบัญชีได้จริง" value={B(vc.bookable)} foot={vc.pending.length?('ค้างตรวจ '+vc.pending.length+' บิล'):'ตรวจครบ ✓'} tone={vc.pending.length?'var(--gold)':'var(--green)'}/>
    </div>

    <div className="grid2">
      <div className="card panel">
        <h3>แนวโน้มยอดขายรายวัน · ผูกวันขายจริง (Transaction date)</h3>
        <ChartBox type="line" labels={trimDays.map(d=>thDate(d).slice(0,5))} datasets={[
          { label:'ยอดขาย', data:trimDays.map(d=>Math.round(revByDay[d]||0)), borderColor:'#26619C', backgroundColor:'rgba(38,97,156,.12)', fill:true, tension:.32, pointRadius:2, borderWidth:2.5 },
          { label:'เงินเข้าจริง', data:trimDays.map(d=>Math.round(setlByDay[d]||0)), borderColor:'#1E73B0', backgroundColor:'transparent', borderDash:[5,4], tension:.32, pointRadius:0, borderWidth:2 } ]}/>
        <div className="sub" style={{marginTop:8}}>เส้นทึบ = ยอดขาย (ผูกวันที่ลูกค้าสั่ง/โอนจริง) · เส้นประ = เงินเข้าบัญชีจริง (Grab/แพลตฟอร์มโอนทีหลัง) — ยอดขายไม่ย้ายวันตามวันเงินเข้า</div>
      </div>
      <div className="card panel">
        <h3>ช่องทางการชำระเงิน</h3>
        <BarList rows={Object.entries(byPay).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({k:payName(k),v}))}/>
        <h3 style={{marginTop:18}}>ยอดขายตามช่องทาง</h3>
        <BarList rows={Object.entries(byCh).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({k:chName(k),v}))} color="var(--blue)"/>
      </div>
    </div>

    <div className="grid2b">
      <div className="card panel">
        <h3>5 อันดับเมนูขายดี</h3>
        <table><thead><tr><th style={{width:30}} className="c">#</th><th>เมนู</th><th className="r">จำนวน</th><th className="r">ยอดขาย</th></tr></thead>
          <tbody>{top.length?top.map(([id,q],i)=>{ const m=menuById(id); return <tr key={id}><td className="c num" style={{fontWeight:700,color:'var(--brand)'}}>{i+1}</td><td>{(m&&m.th)||id}</td><td className="r num">{q}</td><td className="r num" style={{fontWeight:700}}>{B(revById[id])}</td></tr>; }):<tr><td colSpan="4" className="empty">ไม่มีข้อมูล</td></tr>}</tbody></table>
      </div>
      <div className="card panel">
        <h3>ระบบสมาชิก · สะสมแต้ม</h3>
        <div className="kpis" style={{marginBottom:0,gridTemplateColumns:'1fr 1fr'}}>
          <div style={{padding:'6px 2px'}}><div className="lbl" style={{fontSize:12,color:'var(--ink-3)',fontWeight:600}}>สมาชิกทั้งหมด</div><div style={{fontSize:24,fontWeight:700,marginTop:4}}>{totalMembers}</div></div>
          <div style={{padding:'6px 2px'}}><div className="lbl" style={{fontSize:12,color:'var(--ink-3)',fontWeight:600}}>สมัครใหม่เดือนนี้</div><div style={{fontSize:24,fontWeight:700,marginTop:4,color:'var(--brand-ink)'}}>+{newM}</div></div>
          <div style={{padding:'6px 2px'}}><div className="lbl" style={{fontSize:12,color:'var(--ink-3)',fontWeight:600}}>แต้มคงค้างในระบบ</div><div style={{fontSize:24,fontWeight:700,marginTop:4}} className="num">{totalPoints.toLocaleString()}</div></div>
          <div style={{padding:'6px 2px'}}><div className="lbl" style={{fontSize:12,color:'var(--ink-3)',fontWeight:600}}>สแตมป์ที่แจก (visits)</div><div style={{fontSize:24,fontWeight:700,marginTop:4}} className="num">{stampsIssued.toLocaleString()}</div></div>
        </div>
        <div className="sub" style={{marginTop:12}}>ได้แต้ม ฿{L.perBaht||25}/แต้ม · สแตมป์ครบ {L.stampGoal||10} ครั้ง · แลกได้ที่ {L.rewardAt||100} แต้ม</div>
      </div>
    </div>
  </div>);
}

/* ═════════════ STOCK MOVEMENT ═════════════ */
// SKU: ระบบรันเลขอัตโนมัติ แยกตามหมวด (cat) — MT เนื้อสัตว์ · GR ข้าว/เส้น · VG ผัก · SE เครื่องปรุง · DK เครื่องดื่ม · DS ของหวาน · PK บรรจุภัณฑ์ · OT อื่นๆ
const SKU_PREFIX={ meat:'MT', grain:'GR', veg:'VG', dry:'SE', drink:'DK', sweet:'DS', pack:'PK', other:'OT' };
let _skuSrc=null, _skuMap=null;
function skuMap(raw){ if(_skuSrc===raw&&_skuMap) return _skuMap; const m={}, c={}; (raw||[]).forEach(r=>{ const p=SKU_PREFIX[r.cat]||'OT'; c[p]=(c[p]||0)+1; m[r.id]=p+'.'+String(c[p]).padStart(3,'0'); }); _skuSrc=raw; _skuMap=m; return m; }
function stockStatus(r){ const s=Number(r.stock)||0; if(s<=0) return {cls:'p-r',th:'หมด (Out)'}; if(s<=(Number(r.low)||0)) return {cls:'p-y',th:'ต่ำ (Low)'}; return {cls:'p-g',th:'พร้อม (Normal)'}; }
function buildMovements(data){
  const sku=skuMap(data.raw);
  const byRm={}; data.raw.forEach(r=>{ byRm[r.id]={ rm:r, mv:[] }; });
  (data.purchases||[]).forEach(p=>{ (p.lines||[]).forEach(l=>{ const b=byRm[l.rmId]; if(!b) return; const q=convQty(l.qty,l.unit,b.rm.unit); b.mv.push({ t:(p.date||isoDay(0))+'T08:00', type:'GOODS_RECEIPT', qty:+q, ref:p.id, refLabel:'ซื้อเข้า'+(p.note?' · '+p.note:''), by:'System อัตโนมัติ' }); }); });
  data.sales.filter(nonVoid).forEach(s=>{ s.items.forEach(([mid,mq])=>{ const m=menuById(mid); if(!m) return; recipeFor(m,s.channel).forEach(([rid,rq])=>{ const b=byRm[rid]; if(!b) return; b.mv.push({ t:(s.date||isoDay(0))+'T'+(s.t||'12:00'), type:'SALE_USED', qty:-(rq*mq), ref:(s.no||s.id), refLabel:'บิลขาย #'+(s.no||''), by:'ระบบขาย (POS)' }); }); }); });
  const all=[];
  Object.values(byRm).forEach(b=>{ b.mv.sort((x,y)=>x.t<y.t?-1:1); const sum=b.mv.reduce((a,m)=>a+m.qty,0); let run=(Number(b.rm.stock)||0)-sum; b.mv.forEach(m=>{ run+=m.qty; m.balance=run; m.rmId=b.rm.id; m.sku=sku[b.rm.id]; m.rmName=b.rm.th; m.unit=b.rm.unit; all.push(m); }); });
  all.sort((x,y)=>x.t<y.t?1:-1);
  return all;
}
const MV_META={ GOODS_RECEIPT:{th:'ซื้อของเข้า',cls:'mv-in'}, SALE_USED:{th:'ตัดจากการขาย',cls:'mv-out'}, WASTAGE:{th:'ของเสีย',cls:'mv-out'}, ADJUST:{th:'ปรับมือ',cls:'mv-adj'}, TRANSFER:{th:'ย้ายคลัง',cls:'mv-adj'}, STOCK_TAKE:{th:'ตรวจนับ',cls:'mv-adj'}, CONSIGN_SALE:{th:'ขายฝาก (ตัด)',cls:'mv-out'}, CONSIGN_RETURN:{th:'คืน Vendor',cls:'mv-out'}, OPENING:{th:'ยอดยกมา',cls:'mv-in'} };
// แปลงแถว inv-tx จาก server → รูปแบบตาราง movement (ชื่อ/SKU จาก raw หลัก · ถ้าไม่พบ = สินค้าฝากขาย)
function mapServerMoves(rows, data){
  const sku=skuMap(data.raw); const byId={}; (data.raw||[]).forEach(r=>byId[r.id]=r);
  return rows.map(m=>{ const r=byId[m.rmId]; return {
    t:new Date(m.createdAt).toISOString(), type:m.movementType, qty:m.qty, balance:(m.runningBalance!=null?m.runningBalance:null),
    rmId:m.rmId, sku:r?sku[m.rmId]:(m.rmId||'').toString().slice(0,12), rmName:r?r.th:(m.rmId&&m.rmId.startsWith('cs')?'สินค้าฝากขาย':m.rmId), unit:r?r.unit:'pcs',
    location:m.locationId||'main', refLabel:m.reason||m.refId||'', by:m.handledBy==='system'?'ระบบอัตโนมัติ':(m.handledBy||'—') }; });
}
function StockView({ data }){
  const [q,setQ]=useState(''); const [type,setType]=useState('ALL'); const [loc,setLoc]=useState('ALL');
  const [from,setFrom]=useState(isoDay(30)); const [to,setTo]=useState(isoDay(0));
  const [srv,setSrv]=useState(null);   // แถว inv-tx จริงจาก server (null = ยังไม่โหลด/ล้มเหลว → fallback คำนวณ)
  const sku=useMemo(()=>skuMap(data.raw),[data.raw]);
  useEffect(()=>{ let ok=true; if(window.KD_API&&KD_API.listInvTx&&window.KD_LIVE){ KD_API.listInvTx({from,to,type,location:loc}).then(r=>{ if(ok&&Array.isArray(r)) setSrv(r); }).catch(()=>{ if(ok) setSrv(null); }); } },[from,to,type,loc]);
  const usingServer = Array.isArray(srv) && srv.length>0;
  const moves=useMemo(()=> usingServer ? mapServerMoves(srv,data) : buildMovements(data),[srv,data,usingServer]);
  const locs=(data.locations||[]); const hasLoc=locs.length>0 || moves.some(m=>m.location&&m.location!=='main');
  const ql=q.trim().toLowerCase();
  const filtered=moves.filter(m=>{ const d=m.t.slice(0,10); if(d<from||d>to) return false; if(type!=='ALL'&&m.type!==type) return false;
    if(loc!=='ALL' && (m.location||'main')!==loc) return false;
    if(ql && !((m.rmName||'').toLowerCase().includes(ql)||(m.rmId||'').toLowerCase().includes(ql)||(m.sku||'').toLowerCase().includes(ql))) return false; return true; });
  const low=data.raw.filter(r=>{ const s=Number(r.stock)||0; return s<=(Number(r.low)||0); }).length;
  const totVal=data.raw.reduce((a,r)=>a+rawValue(r),0);
  const locName=(id)=>{ if(!id||id==='main') return 'คลังหลัก'; const l=locs.find(x=>x.id===id); return l?l.name:id; };
  const exportMv=()=>downloadCSV('stock_movement_'+from+'_'+to+'.csv',
    [['วันเวลา','SKU','รายการ','ประเภท','คลัง','จำนวน','ยอดคงเหลือ','อ้างอิง','ผู้ทำรายการ']]
    .concat(filtered.map(m=>[thDateTime(new Date(m.t).getTime()),m.sku,m.rmName,(MV_META[m.type]||{}).th||m.type,locName(m.location),(m.qty>0?'+':'')+(+m.qty).toFixed(2),(m.balance!=null?m.balance.toFixed(2):'—'),m.refLabel,m.by])));

  return (<div className="fade">
    <div className="kpis">
      <Kpi label="รายการวัตถุดิบ/แพ็ค" value={data.raw.length} foot="SKU ทั้งหมด"/>
      <Kpi label="มูลค่าสต๊อกคงเหลือ" value={B(totVal)} foot="ตามต้นทุนเฉลี่ย" tone="var(--brand-ink)"/>
      <Kpi label="ใกล้หมด / หมด" value={low} foot="ต่ำกว่าเกณฑ์ขั้นต่ำ" tone={low?'var(--yellow)':'var(--green)'}/>
      <Kpi label="รายการเคลื่อนไหว" value={filtered.length} foot={usingServer?'จากตารางจริง (inventory_transactions)':'ตามตัวกรอง'}/>
    </div>

    <div className="grid2">
      <div className="card panel" style={{padding:0,overflow:'hidden'}}>
        <div className="panel" style={{paddingBottom:0}}><h3>สต๊อกคงเหลือปัจจุบัน</h3></div>
        <div style={{maxHeight:520,overflow:'auto'}}>
        <table><thead><tr><th>SKU · รายการ</th><th className="r">คงเหลือ</th><th className="c">สถานะ</th><th className="r">มูลค่า</th></tr></thead>
          <tbody>{data.raw.map(r=>{ const st=stockStatus(r); return (<tr key={r.id}>
            <td><div style={{fontWeight:600}}>{r.th}</div><div className="mono" style={{fontSize:11,color:'var(--ink-3)'}}>{sku[r.id]}</div></td>
            <td className="r num" style={{fontWeight:700}}>{(Number(r.stock)||0).toLocaleString()} <span style={{fontSize:11,color:'var(--ink-3)'}}>{runit(r.unit).th}</span></td>
            <td className="c"><span className={'pill '+st.cls}>{st.th}</span></td>
            <td className="r num">{B(rawValue(r))}</td></tr>); })}</tbody></table>
        </div>
      </div>

      <div className="card panel">
        <h3>สรุปมูลค่าตามหมวด</h3>
        <BarList rows={RAW_CATS.map(c=>({k:c.th,v:data.raw.filter(r=>r.cat===c.id).reduce((a,r)=>a+rawValue(r),0)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v)} color="var(--blue)"/>
        <div className="sub" style={{marginTop:14,padding:'11px 12px',background:'var(--brand-softer)',borderRadius:10}}>{usingServer
          ? <>✅ ประวัติเคลื่อนไหวอ่านจาก <b>ตารางจริง (inventory_transactions)</b> · ยอดคงเหลือสะสม (Running Balance) คำนวณด้วย SQL window function ฝั่งเซิร์ฟเวอร์ · รวมการปรับมือ · ของเสีย · ย้ายคลัง · ขายฝาก</>
          : <>💡 ยังไม่มีข้อมูลใน <b>inventory_transactions</b> — แสดงประวัติที่คำนวณจากใบซื้อเข้า + สูตรตัดสต๊อก (fallback) · เมื่อแอปเริ่มบันทึก inv-tx (ซื้อเข้า/ขาย/ของเสีย/ปรับมือ) หน้านี้จะอ่านจากตารางจริงอัตโนมัติ</>}</div>
      </div>
    </div>

    <div className="card panel">
      <h3>ประวัติความเคลื่อนไหว (Stock Movement){usingServer&&<span className="pill p-g" style={{marginLeft:8,fontSize:11}}>ตารางจริง</span>}</h3>
      <div className="toolbar">
        <input className="field grow" placeholder="ค้นหา ชื่อวัตถุดิบ หรือ SKU…" value={q} onChange={e=>setQ(e.target.value)}/>
        <select className="field" value={type} onChange={e=>setType(e.target.value)}>
          <option value="ALL">ทุกประเภท</option>{Object.entries(MV_META).map(([k,v])=><option key={k} value={k}>{v.th}</option>)}</select>
        {hasLoc && <select className="field" value={loc} onChange={e=>setLoc(e.target.value)}>
          <option value="ALL">ทุกคลัง</option><option value="main">คลังหลัก</option>{locs.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>}
        <input type="date" className="field" value={from} max={to} onChange={e=>setFrom(e.target.value)}/>
        <span style={{color:'var(--ink-3)'}}>–</span>
        <input type="date" className="field" value={to} min={from} max={isoDay(0)} onChange={e=>setTo(e.target.value)}/>
        <button className="btn gh" onClick={exportMv}>⬇ Excel/CSV</button>
      </div>
      <div style={{maxHeight:560,overflow:'auto'}}>
      <table><thead><tr><th>วันเวลา</th><th>SKU</th><th>รายการ</th><th>ประเภท</th>{hasLoc&&<th>คลัง</th>}<th className="r">จำนวน</th><th className="r">คงเหลือ</th><th>อ้างอิง</th><th>ผู้ทำรายการ</th></tr></thead>
        <tbody>{filtered.length?filtered.slice(0,400).map((m,i)=>{ const meta=MV_META[m.type]||{th:m.type,cls:''}; return (<tr key={i}>
          <td className="num" style={{whiteSpace:'nowrap'}}>{thDateTime(new Date(m.t).getTime())}</td>
          <td className="mono" style={{fontSize:12}}>{m.sku}</td>
          <td>{m.rmName}</td>
          <td><span className={meta.cls} style={{fontSize:12,fontWeight:700}}>{meta.th}</span></td>
          {hasLoc&&<td style={{fontSize:12.5,color:'var(--ink-2)'}}>{locName(m.location)}</td>}
          <td className={'r num '+(m.qty>0?'mv-in':'mv-out')}>{(m.qty>0?'+':'')+(+m.qty).toFixed(2)}</td>
          <td className="r num" style={{fontWeight:700}}>{m.balance!=null?(+m.balance).toFixed(2):'—'}</td>
          <td style={{color:'var(--ink-2)'}}>{m.refLabel}</td>
          <td style={{color:'var(--ink-3)',fontSize:12.5}}>{m.by}</td></tr>); }):<tr><td colSpan={hasLoc?9:8} className="empty">ไม่มีรายการในช่วงที่เลือก</td></tr>}</tbody></table>
      </div>
      {filtered.length>400 && <div className="sub" style={{marginTop:10}}>แสดง 400 แถวแรก · ใช้ตัวกรองหรือส่งออก CSV เพื่อดูทั้งหมด ({filtered.length} รายการ)</div>}
    </div>
  </div>);
}

/* ═════════════ MEMBERS / CRM ═════════════ */
function memberStats(data){
  const spend={}, count={};
  data.sales.filter(s=>nonVoid(s)&&s.memberId).forEach(s=>{ spend[s.memberId]=(spend[s.memberId]||0)+saleTotal(s); count[s.memberId]=(count[s.memberId]||0)+1; });
  return { spend, count };
}
function MembersView({ data }){
  const [q,setQ]=useState(''); const [sort,setSort]=useState('recent'); const [sel,setSel]=useState(null);
  const { spend, count }=useMemo(()=>memberStats(data),[data]);
  const ql=q.trim().toLowerCase();
  let list=data.members.filter(m=> !ql || (m.name||'').toLowerCase().includes(ql) || (m.phone||'').includes(ql) || (m.id||'').toLowerCase().includes(ql));
  list=list.slice().sort((a,b)=> sort==='spend'?((spend[b.id]||0)-(spend[a.id]||0)) : sort==='points'?((b.points||0)-(a.points||0)) : ((b.created_at||0)-(a.created_at||0)));
  const monthKey=new Date().toISOString().slice(0,7);
  const newM=data.members.filter(m=>m.created_at&&new Date(m.created_at).toISOString().slice(0,7)===monthKey).length;
  const totalPoints=data.members.reduce((a,m)=>a+(m.points||0),0);
  const tierPill=(t)=>({gold:'p-y',silver:'p-b',member:'p-n'}[t]||'p-n');
  const tierTh=(t)=>({gold:'ทอง',silver:'เงิน',member:'ทั่วไป'}[t]||t);
  const exportM=()=>downloadCSV('members.csv',[['รหัสสมาชิก','ชื่อ','เบอร์','ระดับ','แต้ม','จำนวนครั้ง','ยอดซื้อรวม','สมัครเมื่อ']]
    .concat(list.map(m=>[m.id,m.name||'',m.phone||'',tierTh(m.tier),m.points||0,count[m.id]||0,Math.round(spend[m.id]||0),m.created_at?new Date(m.created_at).toISOString().slice(0,10):''])));

  return (<div className="fade">
    <div className="kpis">
      <Kpi label="สมาชิกทั้งหมด" value={data.members.length} foot="Total members" tone="var(--brand-ink)"/>
      <Kpi label="สมัครใหม่เดือนนี้" value={'+'+newM} foot="New this month"/>
      <Kpi label="แต้มคงค้างในระบบ" value={totalPoints.toLocaleString()} foot="มูลค่าหนี้สินแต้ม (loyalty liability)"/>
      <Kpi label="ยอดซื้อผ่านสมาชิก" value={B(Object.values(spend).reduce((a,v)=>a+v,0))} foot="ผูกกับบิลที่มี memberId"/>
    </div>
    <div className="card panel" style={{padding:0,overflow:'hidden'}}>
      <div className="panel" style={{paddingBottom:12}}>
        <div className="toolbar" style={{marginBottom:0}}>
          <input className="field grow" placeholder="ค้นหา ชื่อ · เบอร์ · รหัสสมาชิก…" value={q} onChange={e=>setQ(e.target.value)}/>
          <div className="seg">
            {[['recent','สมัครล่าสุด'],['spend','ยอดซื้อสูงสุด'],['points','แต้มมากสุด']].map(([k,l])=>
              <button key={k} className={sort===k?'on':''} onClick={()=>setSort(k)}>{l}</button>)}
          </div>
          <button className="btn gh" onClick={exportM}>⬇ CSV</button>
        </div>
      </div>
      <div style={{maxHeight:600,overflow:'auto'}}>
      <table><thead><tr><th>สมาชิก</th><th>เบอร์โทร</th><th>ระดับ</th><th className="c">สมัครเมื่อ</th><th className="r">ยอดซื้อรวม</th><th className="r">ครั้ง</th><th className="r">แต้ม</th><th></th></tr></thead>
        <tbody>{list.length?list.map(m=>(<tr className="row" key={m.id} onClick={()=>setSel(m)}>
          <td><div style={{display:'flex',alignItems:'center',gap:11}}><span className="avatar">{m.avatar?<img src={m.avatar} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:(m.name||'?').replace(/^คุณ\s*/,'').slice(0,1)}</span>
            <div><div style={{fontWeight:600}}>{m.name||'ลูกค้า'}</div><div className="mono" style={{fontSize:11,color:'var(--ink-3)'}}>{m.id.length>14?m.id.slice(0,8)+'…':m.id}</div></div></div></td>
          <td className="num">{m.phone||<span style={{color:'var(--ink-3)'}}>— (Guest)</span>}</td>
          <td><span className={'pill '+tierPill(m.tier)}>{tierTh(m.tier)}</span></td>
          <td className="c num" style={{fontSize:12.5}}>{m.created_at?thDate(new Date(m.created_at).toISOString().slice(0,10)):'—'}</td>
          <td className="r num" style={{fontWeight:700}}>{B(spend[m.id]||0)}</td>
          <td className="r num">{count[m.id]||0}</td>
          <td className="r num" style={{fontWeight:700,color:'var(--brand-ink)'}}>{(m.points||0).toLocaleString()}</td>
          <td className="r"><span className="btn gh" style={{padding:'5px 10px',fontSize:12.5}}>ดูรายละเอียด</span></td></tr>)):<tr><td colSpan="8" className="empty">ยังไม่มีสมาชิก</td></tr>}</tbody></table>
      </div>
    </div>
    {sel && <MemberModal m={sel} data={data} spend={spend[sel.id]||0} count={count[sel.id]||0} onClose={()=>setSel(null)}/>}
  </div>);
}
function MemberModal({ m, data, spend, count, onClose }){
  const bills=data.sales.filter(s=>s.memberId===m.id).sort((a,b)=>(b.date||'')<(a.date||'')?-1:1);
  const per=(data.settings&&data.settings.pay&&data.settings.pay.loyalty&&data.settings.pay.loyalty.perBaht)||25;
  const log=bills.filter(nonVoid).map(s=>({ date:s.date, txt:'บิล #'+(s.no||''), pts:Math.floor(saleTotal(s)/per) }));
  const tierTh=(t)=>({gold:'ทอง',silver:'เงิน',member:'ทั่วไป'}[t]||t);
  return (<div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div style={{padding:'22px 24px',borderBottom:'1px solid var(--hair)',display:'flex',alignItems:'center',gap:14}}>
      <span className="avatar" style={{width:48,height:48,fontSize:20}}>{(m.name||'?').replace(/^คุณ\s*/,'').slice(0,1)}</span>
      <div style={{flex:1}}><div style={{fontSize:19,fontWeight:700}}>{m.name||'ลูกค้า'}</div>
        <div className="sub">{m.phone||'ไม่มีเบอร์ (Guest)'} · ระดับ {tierTh(m.tier)} · <span className="mono" style={{fontSize:11}}>{m.id}</span></div></div>
      <button className="btn gh" onClick={onClose}>✕ ปิด</button>
    </div>
    <div style={{padding:'18px 24px'}}>
      <div className="kpis" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <Kpi label="ยอดซื้อสะสม (Net)" value={B(spend)} tone="var(--brand-ink)"/>
        <Kpi label="จำนวนบิล" value={count}/>
        <Kpi label="แต้มปัจจุบัน" value={(m.points||0).toLocaleString()}/>
      </div>
      <h3 style={{margin:'18px 0 10px',fontSize:15}}>ประวัติการสั่งซื้อ</h3>
      <div className="card" style={{maxHeight:210,overflow:'auto'}}>
        <table><thead><tr><th>บิล</th><th>วันที่</th><th>เมนู</th><th>ช่องทาง</th><th className="r">ยอด</th></tr></thead>
          <tbody>{bills.length?bills.map(s=>(<tr key={s.id}><td className="mono" style={{fontSize:12}}>#{s.no||''}</td><td className="num">{thDate(s.date)}</td>
            <td style={{fontSize:12.5,color:'var(--ink-2)'}}>{s.items.map(([id,q])=>(menuById(id)?.th||id)+'×'+q).join(', ')}</td>
            <td><span className="pill p-n">{chName(s.channel)}</span></td>
            <td className="r num" style={{fontWeight:700,textDecoration:s.void?'line-through':'none',color:s.void?'var(--ink-3)':'inherit'}}>{B(saleTotal(s))}</td></tr>)):<tr><td colSpan="5" className="empty">ยังไม่เคยสั่ง</td></tr>}</tbody></table>
      </div>
      <h3 style={{margin:'18px 0 10px',fontSize:15}}>ประวัติแต้ม (Points log)</h3>
      <div className="card" style={{maxHeight:170,overflow:'auto'}}>
        <table><tbody>{log.length?log.map((l,i)=>(<tr key={i}><td className="num">{thDate(l.date)}</td><td>{l.txt}</td><td className="r num mv-in">+{l.pts}</td></tr>)):<tr><td className="empty">ยังไม่มีการได้แต้ม</td></tr>}</tbody></table>
      </div>
      <div className="sub" style={{marginTop:12}}>บันทึกการแลกแต้ม/ปรับมือ และบัญชีรับเงินคืน (PDPA) จะเชื่อมเมื่อเพิ่มตาราง <span className="mono">point_transactions</span> · ตอนนี้ประวัติแต้มคำนวณจากบิล (฿{per}/แต้ม)</div>
    </div>
  </div></div>);
}

/* ═════════════ PRODUCTS / MENU ═════════════ */
function MenuView({ data }){
  const [q,setQ]=useState(''); const [sort,setSort]=useState('sold'); const [sel,setSel]=useState(null);
  const cats=(typeof CATS!=='undefined'&&CATS)||[];
  const catTh=(id)=>{ const c=cats.find(x=>x.id===id); return c?c.th:(id||'—'); };
  const sold={}, rev={};
  data.sales.filter(nonVoid).forEach(s=>s.items.forEach(([id,qn])=>{ sold[id]=(sold[id]||0)+qn; rev[id]=(rev[id]||0)+(menuById(id)?.price||0)*qn; }));
  const ql=q.trim().toLowerCase();
  const rows=(data.menu||[]).map(m=>{ const cost=effItemCost(m,data.raw,'auto'); const price=Number(m.price)||0;
    return { m, price, cost, gp:price-cost, margin:price?Math.round((price-cost)/price*100):0, sold:sold[m.id]||0, rev:rev[m.id]||0 }; })
    .filter(r=> !ql || ((r.m.th||'').toLowerCase().includes(ql)||(r.m.en||'').toLowerCase().includes(ql)));
  rows.sort((a,b)=> sort==='margin'?b.margin-a.margin : sort==='profit'?(b.gp*b.sold)-(a.gp*a.sold) : sort==='price'?b.price-a.price : b.sold-a.sold);
  const active=(data.menu||[]).filter(m=>!m.off).length;
  const avgMargin=rows.length?Math.round(rows.reduce((a,r)=>a+r.margin,0)/rows.length):0;
  const bestId=Object.entries(sold).sort((a,b)=>b[1]-a[1])[0];
  const exportMenu=()=>downloadCSV('menu_products.csv',[['เมนู','หมวด','ราคาขาย','ต้นทุน','กำไร/จาน','margin%','ขายแล้ว(จาน)','ยอดขายรวม']]
    .concat(rows.map(r=>[r.m.th||r.m.id,catTh(r.m.cat),r.price,Math.round(r.cost),Math.round(r.gp),r.margin,r.sold,Math.round(r.rev)])));
  return (<div className="fade">
    <div className="kpis">
      <Kpi label="เมนูทั้งหมด" value={(data.menu||[]).length} foot={'เปิดขาย '+active+' รายการ'} tone="var(--brand-ink)"/>
      <Kpi label="กำไรเฉลี่ยต่อเมนู" value={avgMargin+'%'} foot="Average margin"/>
      <Kpi label="เมนูขายดีสุด" value={bestId?(menuById(bestId[0])?.th||bestId[0]):'—'} foot={bestId?(bestId[1]+' จาน'):''}/>
      <Kpi label="จำนวนที่ขายรวม" value={Object.values(sold).reduce((a,v)=>a+v,0).toLocaleString()} foot="ทุกเมนู (จาน)"/>
    </div>
    <div className="card panel" style={{padding:0,overflow:'hidden'}}>
      <div className="panel" style={{paddingBottom:12}}>
        <div className="toolbar" style={{marginBottom:0}}>
          <input className="field grow" placeholder="ค้นหาเมนู…" value={q} onChange={e=>setQ(e.target.value)}/>
          <div className="seg">{[['sold','ขายดี'],['margin','มาร์จิ้น'],['profit','กำไรรวม'],['price','ราคา']].map(([k,l])=><button key={k} className={sort===k?'on':''} onClick={()=>setSort(k)}>{l}</button>)}</div>
          <button className="btn gh" onClick={exportMenu}>⬇ CSV</button>
        </div>
      </div>
      <div style={{maxHeight:600,overflow:'auto'}}>
      <table><thead><tr><th>เมนู</th><th>หมวด</th><th className="r">ราคาขาย</th><th className="r">ต้นทุน</th><th className="r">กำไร/จาน</th><th className="r">margin</th><th className="r">ขายแล้ว</th><th className="r">ยอดขาย</th></tr></thead>
        <tbody>{rows.length?rows.map(r=>(<tr className="row" key={r.m.id} onClick={()=>setSel(r)}>
          <td><div style={{display:'flex',alignItems:'center',gap:8}}><span>{r.m.emoji||(cats.find(c=>c.id===r.m.cat)||{}).emoji||'🍽️'}</span><span style={{fontWeight:600}}>{r.m.th||r.m.id}</span>{r.m.off&&<span className="pill p-n">ปิดขาย</span>}</div></td>
          <td><span className="pill p-n">{catTh(r.m.cat)}</span></td>
          <td className="r num" style={{fontWeight:700}}>{B(r.price)}</td>
          <td className="r num" style={{color:'var(--ink-2)'}}>{B(r.cost)}</td>
          <td className="r num" style={{fontWeight:700,color:'var(--green)'}}>{B(r.gp)}</td>
          <td className="r num" style={{fontWeight:700,color:r.margin>=50?'var(--green)':r.margin>=30?'var(--gold)':'var(--red)'}}>{r.margin}%</td>
          <td className="r num">{r.sold.toLocaleString()}</td>
          <td className="r num" style={{fontWeight:700}}>{B(r.rev)}</td></tr>)):<tr><td colSpan="8" className="empty">ยังไม่มีเมนู</td></tr>}</tbody></table>
      </div>
    </div>
    {sel && <MenuModal r={sel} data={data} onClose={()=>setSel(null)}/>}
  </div>);
}
function MenuModal({ r, data, onClose }){
  const m=r.m; const rec=(m.recipe||[]); const skuOf=skuMap(data.raw);
  return (<div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
    <div style={{padding:'20px 24px',borderBottom:'1px solid var(--hair)',display:'flex',alignItems:'center',gap:12}}>
      <span style={{fontSize:30}}>{m.emoji||'🍽️'}</span>
      <div style={{flex:1}}><div style={{fontSize:19,fontWeight:700}}>{m.th||m.id}</div><div className="sub">ราคาขาย {B(r.price)} · ต้นทุน {B(r.cost)} · กำไร {B(r.gp)} ({r.margin}%)</div></div>
      <button className="btn gh" onClick={onClose}>✕ ปิด</button>
    </div>
    <div style={{padding:'18px 24px'}}>
      <h3 style={{margin:'0 0 10px',fontSize:15}}>สูตรตัดสต๊อก (recipe) — {rec.length} วัตถุดิบ</h3>
      {rec.length?<div className="card"><table><thead><tr><th>SKU</th><th>วัตถุดิบ</th><th className="r">ใช้/จาน</th><th className="r">ต้นทุน</th></tr></thead>
        <tbody>{rec.map(([rid,qn],i)=>{ const raw=rawById(data.raw,rid); return (<tr key={i}><td className="mono" style={{fontSize:12}}>{skuOf[rid]||'—'}</td><td>{raw?raw.th:rid}</td><td className="r num">{qn} {raw?runit(raw.unit).th:''}</td><td className="r num">{raw?B((Number(raw.avgCost)||0)*qn):'—'}</td></tr>); })}</tbody></table></div>
        :<div className="empty">เมนูนี้ยังไม่ผูกสูตร (คิดต้นทุนแบบต่อจาน)</div>}
      <div className="sub" style={{marginTop:12}}>ขายแล้ว {r.sold.toLocaleString()} จาน · ยอดขายรวม {B(r.rev)} · กำไรรวมโดยประมาณ {B(r.gp*r.sold)}</div>
    </div>
  </div></div>);
}

/* ═════════════ DELIVERY RECONCILIATION (กระทบยอดเดลิเวอรี) ═════════════ */
function isoAdd(iso,n){ try{ const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }catch(e){ return iso; } }
function ReconRow({ g, gp, vat, log, onSave }){
  const gpAmt=g.gross*gp/100, vatAmt=vat?gpAmt*0.07:0, exp=g.gross-gpAmt-vatAmt;
  const [actual,setActual]=useState(log&&log.actualReceived!=null?String(log.actualReceived):'');
  const [sdate,setSdate]=useState((log&&log.settlementDate)||isoAdd(g.date,1));
  const [busy,setBusy]=useState(false);
  const av=actual!==''?Number(actual):null; const varc=av!=null?av-exp:(log&&log.variance!=null?log.variance:null);
  return (<tr>
    <td className="num" style={{whiteSpace:'nowrap'}}>{thDate(g.date)}</td>
    <td><span className="pill p-n">{chName(g.channel)}</span></td>
    <td className="r num">{B(g.gross)}</td>
    <td className="c num" style={{fontSize:12}}>{gp?gp+'%':'—'}{vat?' +VAT':''}</td>
    <td className="r num" style={{fontWeight:700}}>{B(exp)}</td>
    <td className="r"><input className="field" style={{width:104,textAlign:'right'}} inputMode="decimal" value={actual} onChange={e=>setActual(e.target.value.replace(/[^0-9.]/g,''))} placeholder="฿ จริง"/></td>
    <td className="c"><input type="date" className="field" style={{width:138}} value={sdate} max={isoDay(0)} onChange={e=>setSdate(e.target.value)}/></td>
    <td className="r num" style={{fontWeight:700,color:varc==null?'var(--ink-3)':varc<0?'var(--red)':varc>0?'var(--green)':'var(--ink)'}}>{varc==null?'—':(varc>0?'+':'')+B(varc)}</td>
    <td className="c"><button className="btn gh" disabled={busy} onClick={async()=>{ setBusy(true); await onSave({actual,sdate}); setBusy(false); }} style={{padding:'5px 12px',fontSize:12.5,opacity:busy?.6:1}}>{log?'อัปเดต':'ยืนยัน'}</button></td>
  </tr>);
}
function txnRecv(s){
  const g=Math.round(saleTotal(s));
  if(s.pay==='cash') return { amt:g, date:s.date, st:'รับแล้ว', cls:'p-g' };
  if(s.pay==='platform'){ if(s.settled) return { amt:Math.round(s.receivedAmount!=null?s.receivedAmount:g), date:s.settledDate||s.date, st:'รับโอนแล้ว', cls:'p-g' }; return { amt:null, date:null, st:'รอแพลตฟอร์มโอน', cls:'p-n' }; }
  if(s.verified){ if(s.payStatus==='not_found') return { amt:0, date:s.verifiedDate, st:'ไม่พบยอด', cls:'p-r' }; return { amt:Math.round(s.verifiedAmount!=null?s.verifiedAmount:g), date:s.verifiedDate, st:(s.payStatus==='discrepancy'?'ขาด/เกิน':'ตรงยอด'), cls:(s.payStatus==='discrepancy'?'p-y':'p-g') }; }
  return { amt:null, date:null, st:'รอตรวจ', cls:'p-n' };
}
function CopyrightView(){ return (<div style={{height:'calc(100vh - 160px)',minHeight:540}}><iframe title="copyright" src="copyright-guide.html" style={{width:'100%',height:'100%',border:'1px solid var(--hair)',borderRadius:16,background:'#fff'}}/></div>); }
function TxnView({ data, range }){
  const [pf,setPf]=useState('all');
  const inR=(s)=> s.date && s.date>=range.from && s.date<=range.to;
  const rows=data.sales.filter(s=> nonVoid(s) && inR(s)).sort((a,b)=>((b.date||'')+(b.t||'')).localeCompare((a.date||'')+(a.t||'')));
  const shown=rows.filter(s=> pf==='all'?true: pf==='pending'?(txnRecv(s).amt==null): s.pay===pf);
  const recvTot=rows.reduce((a,s)=>{ const r=txnRecv(s); return a+(r.amt||0); },0);
  const pendCount=rows.filter(s=>txnRecv(s).amt==null).length;
  const sysTot=rows.reduce((a,s)=>a+saleTotal(s),0);
  const byPay={}; rows.forEach(s=>{ const r=txnRecv(s); byPay[s.pay]=(byPay[s.pay]||0)+(r.amt||0); });
  const exportCsv=()=>{ const out=[['วันขาย','เวลา','เลขบิล','เลขออเดอร์แพลตฟอร์ม','ช่องทาง','วิธีจ่าย','ยอดระบบ','เงินเข้าจริง','วันเงินเข้า','สถานะ']];
    rows.forEach(s=>{ const r=txnRecv(s); out.push([s.date,s.t||'',s.no||'',s.platNo||'',chName(s.channel),payName(s.pay),Math.round(saleTotal(s)),r.amt==null?'':r.amt,r.date||'',r.st]); });
    downloadCSV('money-in-'+range.from+'_'+range.to+'.csv',out); };
  const PF=[['all','ทั้งหมด',rows.length],['cash','เงินสด',rows.filter(s=>s.pay==='cash').length],['promptpay','พร้อมเพย์',rows.filter(s=>s.pay==='promptpay'||s.pay==='transfer').length],['platform','แพลตฟอร์ม',rows.filter(s=>s.pay==='platform').length],['pending','รอเข้า',pendCount]];
  return (<div>
    <div className="card panel" style={{marginBottom:16}}>
      <h3>รายงานเงินเข้า (Transaction) — ทุกช่องทางรวมกัน</h3>
      <p className="sub">รายการเงินเข้าจริงต่อบิล ทุกวิธีจ่าย (เงินสด/พร้อมเพย์/โอน/แพลตฟอร์ม) — ชุดข้อมูลเดียวกับหน้าแอปและตรวจยอดพร้อมเพย์ · เงินสด=รับที่จุดขาย · ดิจิทัล=ยอดที่ยืนยันแล้ว · แพลตฟอร์ม=ยอดที่กดรับโอน (วันเงินเข้าจริง)</p>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14,marginBottom:16}}>
      <Kpi label="เงินเข้าจริงรวม" value={B(recvTot)} tone="var(--brand-ink)" foot={rows.length+' บิล'}/>
      <Kpi label="ยอดขายระบบ" value={B(sysTot)} foot="ก่อนหัก/ก่อนตรวจ"/>
      <Kpi label="รอเข้า/รอตรวจ" value={pendCount} tone={pendCount?'#9A6410':'var(--ink)'} foot="ยังไม่รวมยอดจริง"/>
      {['cash','promptpay','platform'].filter(k=>byPay[k]).map(k=><Kpi key={k} label={'เข้าแล้ว · '+payName(k)} value={B(byPay[k])}/>)}
    </div>
    <div className="card">
      <div className="panel" style={{paddingBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
        <div className="seg">{PF.map(([k,l,n])=><button key={k} className={pf===k?'on':''} onClick={()=>setPf(k)}>{l} ({n})</button>)}</div>
        <button className="btn gh" onClick={exportCsv}>⬇ CSV</button>
      </div>
      <div style={{maxHeight:600,overflow:'auto'}}>
      <table><thead><tr><th>วันขาย</th><th>เลขบิล</th><th>ออเดอร์แพลตฟอร์ม</th><th>ช่องทาง</th><th>วิธีจ่าย</th><th className="r">ยอดระบบ</th><th className="r">เงินเข้าจริง</th><th className="c">วันเงินเข้า</th><th className="c">สถานะ</th></tr></thead>
        <tbody>{shown.length?shown.map(s=>{ const r=txnRecv(s); return (<tr key={s.id}>
          <td>{thDate(s.date)}<div style={{fontSize:11.5,color:'var(--ink-3)'}}>{s.t||''}</div></td>
          <td>#{s.no||'—'}</td>
          <td className="num" style={{color:s.platNo?'var(--ink)':'var(--ink-3)'}}>{s.platNo||'—'}</td>
          <td>{chName(s.channel)}</td>
          <td>{payName(s.pay)}</td>
          <td className="r num">{B(saleTotal(s))}</td>
          <td className="r num" style={{fontWeight:700}}>{r.amt==null?'—':B(r.amt)}</td>
          <td className="c" style={{fontSize:12}}>{r.date?thDate(r.date):'—'}</td>
          <td className="c"><span className={'pill '+r.cls}>{r.st}</span></td>
        </tr>); }):<tr><td colSpan="9" className="empty">ไม่มีบิลในช่วงที่เลือก</td></tr>}</tbody></table>
      </div>
    </div>
  </div>);
}
function ReconcileView({ data, range }){
  const cfg=(data.settings&&data.settings.chanCfg)||{}; const custom=cfg.custom||{};
  const gpOf=(ch)=>{ const o=(cfg.gp&&cfg.gp[ch])||null; if(o&&Number(o.gp)>0) return Number(o.gp); const d=custom[ch]; return d&&Number(d.gp)>0?Number(d.gp):0; };
  const vatOf=(ch)=>{ const o=(cfg.gp&&cfg.gp[ch])||null; if(o) return !!o.vatOnGp; const d=custom[ch]; return !!(d&&d.vatOnGp); };
  const inR=(s)=> s.date && s.date>=range.from && s.date<=range.to;
  const plat=data.sales.filter(s=>nonVoid(s) && s.pay==='platform' && inR(s));
  const groups={}; plat.forEach(s=>{ const k=s.channel+'|'+s.date; (groups[k]=groups[k]||{channel:s.channel,date:s.date,gross:0,count:0}); groups[k].gross+=saleTotal(s); groups[k].count++; });
  const rows=Object.values(groups).sort((a,b)=> (b.date+b.channel).localeCompare(a.date+a.channel));
  const [logs,setLogs]=useState({}); const [msg,setMsg]=useState('');
  useEffect(()=>{ let ok=true; if(KD_API.listDeliverySettlement) KD_API.listDeliverySettlement({from:range.from,to:range.to}).then(r=>{ if(!ok||!Array.isArray(r))return; const m={}; r.forEach(x=>{ m[x.channel+'|'+x.businessDate]=x; }); setLogs(m); }).catch(()=>{}); return ()=>{ok=false;}; },[range.from,range.to,data]);
  const expNet=(g)=>{ const gp=gpOf(g.channel); const gpAmt=g.gross*gp/100; const vat=vatOf(g.channel)?gpAmt*0.07:0; return g.gross-gpAmt-vat; };
  const save=async(g,d)=>{ d=d||{}; const exp=expNet(g); const actual=(d.actual!=null&&d.actual!=='')?Number(d.actual):null;
    const body={channel:g.channel,businessDate:g.date,gross:Math.round(g.gross),gpPct:gpOf(g.channel),vatOnGp:vatOf(g.channel),expectedNet:Math.round(exp),actualReceived:actual!=null?Math.round(actual):null,settlementDate:d.sdate||null};
    try{ const r=await KD_API.saveDeliverySettlement(body); setLogs(p=>({...p,[g.channel+'|'+g.date]:{...body,actualReceived:body.actualReceived,variance:(r&&r.variance!=null)?r.variance:(actual!=null?actual-exp:null)}})); setMsg('บันทึกยอดเข้าจริงแล้ว · รายงานยอดขายยังล็อกยอดไว้ที่วันลูกค้าสั่ง'); }
    catch(e){ setMsg('บันทึกไม่ได้ (โหมดสาธิต/ออฟไลน์)'); } };
  const accum={}; Object.values(logs).forEach(l=>{ if(l.variance!=null) accum[l.channel]=(accum[l.channel]||0)+l.variance; });
  const totGross=rows.reduce((a,g)=>a+g.gross,0), totExp=rows.reduce((a,g)=>a+expNet(g),0);
  return (<div>
    <div className="card panel" style={{marginBottom:16}}>
      <h3>วิธีคิด “ยอดคาดการณ์เงินเข้า”</h3>
      <p className="sub">ยอดคาดการณ์เงินเข้า = ยอดขายดิบ − (ยอดขายดิบ × %GP) − (VAT 7% ของค่า GP ถ้าเปิด) · ตั้ง %GP และ VAT ต่อช่องทางในแอป → ร้านค้า → ช่องทางขาย · <b>รายงานยอดขายยังล็อกยอด/จำนวนบิลไว้ที่วันที่ลูกค้าสั่ง</b> — หน้านี้บันทึกเฉพาะ “วันเงินเข้าบัญชีจริง” (ย้อนหลังได้)</p>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:14,marginBottom:16}}>
      <Kpi label="ยอดขายดิบ (แพลตฟอร์ม)" value={B(totGross)} foot={rows.length+' รายการวัน×ช่องทาง'}/>
      <Kpi label="คาดว่าจะเข้าธนาคาร" value={B(totExp)} tone="var(--brand-ink)" foot="หลังหัก GP/VAT"/>
      {Object.entries(accum).map(([ch,v])=><Kpi key={ch} label={'ส่วนต่างสะสม · '+chName(ch)} value={(v>0?'+':'')+B(v)} tone={v<0?'var(--red)':v>0?'var(--green)':'var(--ink)'} foot={v<0?'ได้น้อยกว่าคาด':v>0?'ได้มากกว่าคาด':'ตรงพอดี'}/>)}
    </div>
    <div className="card">
      <div className="panel" style={{paddingBottom:0}}><h3>กระทบยอดรายวัน × ช่องทาง</h3></div>
      <div style={{maxHeight:560,overflow:'auto'}}>
      <table><thead><tr><th>วันขาย</th><th>ช่องทาง</th><th className="r">ยอดขายดิบ</th><th className="c">GP</th><th className="r">คาดว่าเข้า</th><th className="r">ยอดเข้าจริง</th><th className="c">วันเงินเข้า</th><th className="r">ส่วนต่าง</th><th></th></tr></thead>
        <tbody>{rows.length?rows.map(g=>{ const key=g.channel+'|'+g.date; return <ReconRow key={key} g={g} gp={gpOf(g.channel)} vat={vatOf(g.channel)} log={logs[key]} onSave={(d)=>save(g,d)}/>; }):<tr><td colSpan="9" className="empty">ยังไม่มีออเดอร์ผ่านแพลตฟอร์ม (รับเงินทีหลัง) ในช่วงที่เลือก</td></tr>}</tbody></table>
      </div>
    </div>
    {msg && <div style={{marginTop:12,fontSize:12.5,fontWeight:700,color:msg.includes('ไม่ได้')?'var(--red)':'var(--green)'}}>{msg}</div>}
  </div>);
}

/* ═════════════ ตรวจยอดพร้อมเพย์ (PromptPay / โอน — เทียบสลิปกับยอดเข้าบัญชีจริง) ═════════════ */
function VerifyStatus({ s }){
  if(!s.verified) return <span className="pill" style={{background:'#F1F3F2',color:'#6C756F'}}>ค้างตรวจ</span>;
  if(s.payStatus==='not_found') return <span className="pill" style={{background:'#FCECE8',color:'var(--red)'}}>ไม่พบยอด</span>;
  if(s.payStatus==='discrepancy'||(s.verifyDiff&&Math.abs(s.verifyDiff)>=0.01)) return <span className="pill" style={{background:'#FBEAD7',color:'#9A6410'}}>{s.verifyDiff>0?'ยอดเกิน':'ยอดขาด'}</span>;
  return <span className="pill" style={{background:'#DCF3E6',color:'#0E7A4E'}}>ตรงยอด</span>;
}
function VerifyRow({ s, onPatch }){
  const sys=Math.round(saleTotal(s));
  const [edit,setEdit]=useState(!s.verified);
  const [amt,setAmt]=useState(String(s.verifiedAmount!=null?Math.round(s.verifiedAmount):sys));
  useEffect(()=>{ if(!s.verified){ setEdit(true); setAmt(String(sys)); } },[s.id]);
  const av=Number(amt)||0, diff=av-sys, today=isoDay(0);
  const doVerify=()=>{ onPatch(s.id,{ verified:true, verifiedAmount:av, verifyDiff:+diff.toFixed(2), payStatus:(diff===0?'paid':'discrepancy'), verifiedDate:today }); setEdit(false); };
  const doNotFound=()=>{ if(!confirm('ยืนยันว่า “ไม่พบยอดเงินเข้า” สำหรับบิลนี้? ระบบจะบันทึกยอดรับจริง = 0 และหักออกจากยอดลงบัญชี')) return; onPatch(s.id,{ verified:true, verifiedAmount:0, verifyDiff:-sys, payStatus:'not_found', verifiedDate:today }); setEdit(false); };
  const undo=()=>{ onPatch(s.id,{ verified:false, payStatus:null, verifiedAmount:null, verifyDiff:null, verifiedDate:null }); setAmt(String(sys)); setEdit(true); };
  const shownDiff = s.verified && !edit ? (s.verifyDiff||0) : diff;
  const diffColor = shownDiff<0?'var(--red)':shownDiff>0?'#9A6410':'var(--ink-3)';
  return (<tr>
    <td>{thDate(s.date)}<div style={{fontSize:11.5,color:'var(--ink-3)'}}>{s.t||''}</div></td>
    <td>#{s.no||'—'}</td>
    <td>{payName(s.pay)}{s.slipUrl && <button className="btn gh" style={{padding:'2px 8px',marginLeft:6,fontSize:11.5}} onClick={()=>{ const w=window.open(''); if(w) w.document.write('<img src="'+s.slipUrl+'" style="width:100%">'); }}>สลิป</button>}</td>
    <td className="r num">{B(sys)}</td>
    <td className="r">{edit
      ? <input className="field num" style={{width:110,textAlign:'right',padding:'6px 9px'}} inputMode="decimal" value={amt} onChange={e=>setAmt(e.target.value)}/>
      : <span className="num" style={{fontWeight:600}}>{s.payStatus==='not_found'?B(0):B(s.verifiedAmount!=null?s.verifiedAmount:sys)}</span>}</td>
    <td className="r num" style={{fontWeight:700,color:diffColor}}>{Math.abs(shownDiff)<0.01?'—':(shownDiff>0?'+':'')+B(shownDiff)}</td>
    <td className="c"><VerifyStatus s={s}/></td>
    <td className="c" style={{whiteSpace:'nowrap'}}>{edit
      ? <><button className="btn pri" style={{padding:'5px 12px',fontSize:12.5}} onClick={doVerify}>{diff===0?'ยืนยันรับเงิน':(diff>0?'แจ้งเกิน +'+B(diff):'แจ้งขาด '+B(diff))}</button>
          <button className="btn gh" style={{padding:'5px 10px',fontSize:12,color:'var(--red)',marginLeft:6}} onClick={doNotFound}>ไม่พบยอด</button></>
      : <><button className="btn gh" style={{padding:'5px 12px',fontSize:12.5}} onClick={()=>{ setEdit(true); setAmt(String(s.verifiedAmount!=null?Math.round(s.verifiedAmount):sys)); }}>แก้ไข</button>
          <button className="btn gh" style={{padding:'5px 10px',fontSize:12,color:'var(--ink-3)',marginLeft:6}} onClick={undo}>ยกเลิก</button></>}</td>
  </tr>);
}
function ensurePdfJs(){ return new Promise((res,rej)=>{ if(window.pdfjsLib) return res(window.pdfjsLib); const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; s.onload=()=>{ try{ window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; }catch(e){} res(window.pdfjsLib); }; s.onerror=rej; document.head.appendChild(s); }); }
async function pdfToText(file){ const lib=await ensurePdfJs(); const buf=await file.arrayBuffer(); const pdf=await lib.getDocument({data:buf}).promise; let out='';
  for(let i=1;i<=pdf.numPages;i++){ const pg=await pdf.getPage(i); const tc=await pg.getTextContent(); const byY={}; tc.items.forEach(t=>{ const y=Math.round(t.transform[5]); (byY[y]=byY[y]||[]).push(t.str); }); const ys=Object.keys(byY).map(Number).sort((a,b)=>b-a); out+=ys.map(y=>byY[y].join(' ')).join('\n')+'\n'; }
  return out; }
function parseStatement(text){
  const lines=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const rows=[];
  for(const ln of lines){
    if(/ยอดยกมา|balance b\/f|วันที่.*เวลา.*จำนวน/i.test(ln) && !/\d/.test(ln.replace(/[^\d]/g,'').slice(0,1))) {}
    const nums=(ln.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|-?\d+(?:\.\d{1,2})?/g)||[]);
    if(!nums.length) continue;
    const dec=nums.filter(n=>/\.\d{1,2}$/.test(n));
    const pool=(dec.length?dec:nums).map(n=>parseFloat(n.replace(/,/g,''))).filter(v=>v>0);
    if(!pool.length) continue;
    const amount=+Math.max(...pool).toFixed(2);
    const time=(ln.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)||[])[0]||'';
    let date=(ln.match(/\b\d{4}-\d{2}-\d{2}\b/)||[])[0]||'';
    if(!date){ const m=ln.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/); if(m){ let y=+m[3]; if(y>2400)y-=543; if(y<100)y+=2000; date=y+'-'+String(+m[2]).padStart(2,'0')+'-'+String(+m[1]).padStart(2,'0'); } }
    if(amount>0) rows.push({ raw:ln, amount, time, date });
  }
  return rows;
}
const p2=(n)=>String(+n||0).padStart(2,'0');
function normDate(v){ if(!v) return ''; v=String(v).trim(); let m=v.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return m[1]+'-'+p2(m[2])+'-'+p2(m[3]); m=v.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/); if(m){ let y=+m[3]; if(y>2400)y-=543; if(y<100)y+=2000; return y+'-'+p2(m[2])+'-'+p2(m[1]); } return ''; }
function splitDelim(line,d){ const out=[]; let cur='',q=false; for(let i=0;i<line.length;i++){ const c=line[i]; if(q){ if(c==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; } else { if(c==='"') q=true; else if(c===d){ out.push(cur); cur=''; } else cur+=c; } } out.push(cur); return out.map(s=>s.trim()); }
function parseTable(text){ const lines=String(text||'').split(/\r?\n/).filter(l=>l.trim()); if(lines.length<2) return null;
  const d=lines[0].includes('\t')?'\t':(lines[0].includes(',')?',':(lines[0].includes(';')?';':null)); if(!d) return null;
  const rows=lines.map(l=>splitDelim(l,d)); const ncol=Math.max(...rows.map(r=>r.length)); if(ncol<2) return null;
  const first=rows[0]; const firstNum=first.filter(c=>/^-?[\d,]+(\.\d+)?$/.test(c.replace(/\s/g,''))&&c.trim()).length; const hasHead=firstNum<Math.ceil(ncol/2);
  const headers=(hasHead?first:first.map((_,i)=>'คอลัมน໅ '+(i+1))).map((h,i)=>h||('คอลัมน໅ '+(i+1)));
  const body=(hasHead?rows.slice(1):rows).filter(r=>r.some(c=>c)); return { headers, rows:body }; }
function guessMap(t){ const low=t.headers.map(h=>String(h).toLowerCase()); const find=(re)=>low.findIndex(h=>re.test(h));
  const decCount=(ci)=>t.rows.reduce((a,r)=>a+(/\.\d{1,2}$/.test(String(r[ci]||'').replace(/,/g,''))?1:0),0);
  let amount=find(/จำนวน|amount|เงินเข้า|เครดิต|credit|deposit|รับ|ฝาก/); if(amount<0){ let best=-1,bi=-1; t.headers.forEach((_,i)=>{ const c=decCount(i); if(c>best){best=c;bi=i;} }); amount=bi; }
  return { amount, date:find(/วันที่|date|วัน/), time:find(/เวลา|time/), type:find(/ประเภท|debit|dr.?cr|type|เข้า.?ออก/), desc:find(/รายการ|รายละเอียด|desc|memo|note|ช่องทาง/) }; }
function StatementModal({ bills, onPatch, onClose }){
  const [text,setText]=useState('');
  const [busy,setBusy]=useState('');
  const [bankName,setBankName]=useState('');
  const [map,setMap]=useState(null);
  const [onlyCredit,setOnlyCredit]=useState(true);
  const table=useMemo(()=>parseTable(text),[text]);
  const autoMap=useMemo(()=>table?guessMap(table):null,[table]);
  const eff=map||autoMap||{amount:-1,date:-1,time:-1,type:-1,desc:-1};
  const presets=(()=>{ try{ return JSON.parse(localStorage.getItem('kd_stmt_presets')||'{}'); }catch(e){ return {}; } })();
  const savePreset=()=>{ if(!bankName.trim()||!table) return; try{ localStorage.setItem('kd_stmt_presets',JSON.stringify({...presets,[bankName.trim()]:{amount:eff.amount,date:eff.date,time:eff.time,type:eff.type,desc:eff.desc}})); }catch(e){} setBusy('✓ จำรูปแบบ '+bankName.trim()+' แล้ว'); setTimeout(()=>setBusy(''),1800); };
  const entries=useMemo(()=>{
    if(table && eff.amount>=0){ return table.rows.map(r=>{ let a=parseFloat(String(r[eff.amount]||'').replace(/,/g,''))||0; const neg=a<0; a=+Math.abs(a).toFixed(2);
        const cr = eff.type>=0 ? !/ออก|debit|dr|withdraw|ถอน|จ่าย/i.test(String(r[eff.type]||'')) : true;
        return { amount:a, time:(String(r[eff.time]||'').match(/([01]?\d|2[0-3]):[0-5]\d/)||[''])[0], date:normDate(r[eff.date]), _cr:cr, _neg:neg }; })
        .filter(e=> e.amount>0 && (!onlyCredit || (e._cr && !e._neg))); }
    return parseStatement(text);
  },[table,eff.amount,eff.date,eff.time,eff.type,onlyCredit,text]);
  const match=useMemo(()=>{
    const used=new Set(), matches=[], extra=[]; const pend=bills.slice();
    entries.forEach(e=>{ const cands=pend.filter(s=>!used.has(s.id)&&Math.abs(Math.round(saleTotal(s))-e.amount)<0.5);
      cands.sort((a,b)=>{ const da=(a.date===e.date?0:1)-(b.date===e.date?0:1); if(da)return da; const ta=Math.abs(tmin(a.t)-tmin(e.time)), tb=Math.abs(tmin(b.t)-tmin(e.time)); return ta-tb; });
      if(cands.length){ used.add(cands[0].id); matches.push({e,s:cands[0]}); } else extra.push(e); });
    return { matches, extra, unmatched:pend.filter(s=>!used.has(s.id)) };
  },[entries,bills]);
  const onFile=(f)=>{ if(!f)return; if(/pdf$/i.test(f.name)||f.type==='application/pdf'){ setBusy('กำลังอ่าน PDF…'); pdfToText(f).then(t=>{ setText(t); setBusy(''); }).catch(()=>{ setBusy(''); alert('อ่าน PDF ไม่สำเร็จ — อาจเป็นไฟล์ภาพสแกน/มีรหัสผ่าน ลองคัดลอกข้อความมาวางแทน'); }); return; } const r=new FileReader(); r.onload=()=>setText(String(r.result||'')); r.readAsText(f); };
  const apply=()=>{ const today=isoDay(0); match.matches.forEach(({e,s})=>{ const sys=Math.round(saleTotal(s)); const diff=+(e.amount-sys).toFixed(2); onPatch(s.id,{ verified:true, verifiedAmount:e.amount, verifyDiff:diff, payStatus:(Math.abs(diff)<0.01?'paid':'discrepancy'), verifiedDate:today }); }); onClose(); };
  return (<div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:680}}>
    <div style={{padding:'18px 24px',borderBottom:'1px solid var(--hair)',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontSize:18,fontWeight:700}}>นำเข้าสเตทเมนท์ธนาคาร → จับคู่อัตโนมัติ</div><div className="sub" style={{marginTop:2}}>วางรายการเงินเข้าจากแอปธนาคาร/CSV — ระบบจับคู่กับบิลที่ค้างตรวจด้วยยอดเงิน (+เวลาใกล้เคียง)</div></div><button className="btn gh" onClick={onClose}>✕</button></div>
    <div style={{padding:'18px 24px'}}>
      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={'วางข้อความแจ้งเงินเข้าจาก SMS/LINE ธนาคาร เช่น\n23/07/2026 14:05  เงินเข้า 250.00 บาท จาก PromptPay\n14:22  รับโอน 180.00 x1234\n— หรืออัปโหลด PDF สเตทเมนท์ด้านล่าง'} style={{width:'100%',minHeight:120,border:'1px solid var(--hair-2)',borderRadius:10,padding:'11px 13px',fontFamily:'IBM Plex Mono,monospace',fontSize:12.5,outline:'none',resize:'vertical',boxSizing:'border-box'}}/>
      <div style={{display:'flex',gap:10,alignItems:'center',margin:'10px 0 4px',flexWrap:'wrap'}}>
        <label className="btn gh" style={{cursor:'pointer'}}>⬆ อัปโหลด PDF / CSV / TXT<input type="file" accept=".pdf,.csv,.txt,application/pdf,text/*" style={{display:'none'}} onChange={e=>onFile(e.target.files&&e.target.files[0])}/></label>
        <span className="sub">{busy || ('อ่านได้ '+entries.length+' รายการเงินเข้า')}</span>
      </div>
      <div className="sub" style={{fontSize:12,color:'var(--ink-3)',marginTop:2,marginBottom:6}}>✅ รองรับ 3 วิธี: (1) วางข้อความแจ้งเงินเข้า SMS/LINE (2) PDF สเตทเมนท์ (ตัวหนังสือ) (3) CSV — ระบบตรวจจับคอลัมน์ให้จับคู่เอง ปรับได้</div>
      {table && <div style={{margin:'12px 0',padding:'12px 14px',background:'var(--brand-softer)',borderRadius:12}}>
        <div style={{fontWeight:700,fontSize:13.5}}>จับคู่คอลัมน์ในไฟล์ → ฟิลด์ระบบ</div>
        <div className="sub" style={{marginBottom:10}}>พบ {table.headers.length} คอลัมน์ · {table.rows.length} แถว — เลือกให้ตรง แล้วระบบจะจับคู่ให้</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10}}>
          {[['amount','เงินเข้า (ยอด) *'],['date','วันที่'],['time','เวลา'],['type','ประเภท เข้า/ออก'],['desc','รายละเอียด']].map(([k,l])=>(
            <label key={k} style={{fontSize:12}}><div style={{color:'var(--ink-2)',fontWeight:600,marginBottom:3}}>{l}</div>
              <select className="field" style={{width:'100%'}} value={eff[k]} onChange={e=>setMap({...eff,[k]:+e.target.value})}>
                <option value={-1}>— ไม่มี —</option>{table.headers.map((h,i)=><option key={i} value={i}>{h}</option>)}</select></label>))}
        </div>
        <label style={{display:'flex',alignItems:'center',gap:8,marginTop:10,fontSize:12.5,cursor:'pointer'}}><input type="checkbox" checked={onlyCredit} onChange={e=>setOnlyCredit(e.target.checked)}/>นับเฉพาะรายการเงินเข้า (ตัดยอดถอน/จ่ายออก)</label>
        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:10,flexWrap:'wrap'}}>
          {Object.keys(presets).length>0 && <select className="field" defaultValue="" onChange={e=>{ if(presets[e.target.value]) setMap({...presets[e.target.value]}); }}><option value="">โหลด preset ธนาคาร…</option>{Object.keys(presets).map(n=><option key={n} value={n}>{n}</option>)}</select>}
          <input className="field" placeholder="ชื่อธนาคาร (จำรูปแบบ)" value={bankName} onChange={e=>setBankName(e.target.value)} style={{flex:1,minWidth:120}}/>
          <button className="btn gh" disabled={!bankName.trim()} onClick={savePreset}>💾 จำรูปแบบนี้</button>
        </div>
      </div>}
      {entries.length>0 && <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,margin:'14px 0'}}>
        <Kpi label="จับคู่บิลได้" value={match.matches.length} tone="var(--brand-ink)" foot="กดยืนยันรวดเดียว"/>
        <Kpi label="เงินเข้าเกิน/ไม่มีบิล" value={match.extra.length} tone={match.extra.length?'#9A6410':'var(--ink)'} foot="โอนผิด/ยอดเกิน"/>
        <Kpi label="บิลไม่พบเงินเข้า" value={match.unmatched.length} tone={match.unmatched.length?'var(--red)':'var(--ink)'} foot="ค้าง/สลิปไม่จริง"/>
      </div>}
      {match.matches.length>0 && <div className="card" style={{maxHeight:220,overflow:'auto',marginBottom:12}}>
        <table><thead><tr><th>เงินเข้า (statement)</th><th className="r">ยอด</th><th>จับคู่บิล</th><th className="c">สถานะ</th></tr></thead>
        <tbody>{match.matches.map(({e,s},i)=>{ const sys=Math.round(saleTotal(s)); const diff=e.amount-sys; return <tr key={i}><td style={{fontSize:12}}>{(e.date?thDate(e.date):'')+' '+(e.time||'')}</td><td className="r num">{B(e.amount)}</td><td>#{s.no||'—'} · <span className="num">{B(sys)}</span></td><td className="c">{Math.abs(diff)<0.01?<span className="pill p-g">ตรง</span>:<span className="pill p-y">{diff>0?'+':''}{B(diff)}</span>}</td></tr>; })}</tbody></table>
      </div>}
      {match.extra.length>0 && <div className="sub" style={{marginBottom:12,padding:'10px 12px',background:'var(--gold-soft)',borderRadius:10,color:'#9A6410'}}>เงินเข้าที่ไม่มีบิลตรงกัน: {match.extra.map(e=>B(e.amount)).join(' · ')} — ตรวจว่าเป็นโอนผิด/รายรับอื่น หรือบิลยังไม่ถูกบันทึก</div>}
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <button className="btn gh" onClick={onClose}>ปิด</button>
        <button className="btn pri" disabled={!match.matches.length} onClick={apply} style={{opacity:match.matches.length?1:.5}}>✓ ยืนยันจับคู่ {match.matches.length} บิล (บันทึกยอดเข้าบัญชี)</button>
      </div>
    </div>
  </div></div>);
}
function LinePairModal({ onClose }){
  const [info,setInfo]=useState(null); const [st,setSt]=useState(null); const [cp,setCp]=useState(false);
  useEffect(()=>{ let ok=true; KD_API.linePairCode().then(r=>{ if(ok) setInfo(r); }).catch(()=>{ if(ok) setInfo({ demo:true, code:'—', addFriend:'', bot:'' }); }); return ()=>{ok=false;}; },[]);
  useEffect(()=>{ let t, ok=true; const poll=()=>{ KD_API.linePairStatus().then(r=>{ if(!ok) return; setSt(r); if(r&&r.status==='linked'){ return; } t=setTimeout(poll,4000); }).catch(()=>{ if(ok) t=setTimeout(poll,6000); }); }; poll(); return ()=>{ ok=false; clearTimeout(t); }; },[]);
  const linked = st && st.status==='linked';
  const code = (st&&st.code)||(info&&info.code)||'—';
  const addFriend = (info&&info.addFriend)||'';
  const copy=()=>{ try{ navigator.clipboard.writeText(String(code)); }catch(e){} setCp(true); setTimeout(()=>setCp(false),1300); };
  return (<div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:460}}>
    <div style={{padding:'18px 24px',borderBottom:'1px solid var(--hair)',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:18,fontWeight:700}}>เชื่อมต่อแจ้งเตือนอัตโนมัติ (LINE)</div><button className="btn gh" onClick={onClose}>✕</button></div>
    <div style={{padding:'20px 24px'}}>
      {linked
        ? <div style={{textAlign:'center',padding:'20px 0'}}><div style={{fontSize:40}}>✅</div><div style={{fontWeight:700,fontSize:17,color:'var(--brand-ink)',marginTop:8}}>เชื่อมต่อกลุ่ม LINE แล้ว</div><div className="sub" style={{marginTop:6}}>เงินเข้าในกลุ่มนี้จะถูกจับคู่บิลให้อัตโนมัติ · ปิดหน้านี้ได้เลย</div></div>
        : <>
          <ol style={{margin:'0 0 16px 18px',padding:0,color:'var(--ink-2)',fontSize:13.5,lineHeight:1.9}}>
            <li>เพิ่ม <b>บอท KaiDee</b> เป็นเพื่อน (สแกน QR ด้านล่าง)</li>
            <li>สร้าง <b>กลุ่ม LINE</b> ของร้าน แล้วเชิญบอท + LINE ธนาคารเข้ากลุ่ม</li>
            <li>พิมพ์ <b>รหัสจับคู่</b> ด้านล่างในกลุ่ม 1 ครั้ง</li>
          </ol>
          <div style={{display:'flex',gap:18,alignItems:'center',justifyContent:'center',flexWrap:'wrap'}}>
            {addFriend
              ? <img alt="QR เพิ่มบอท" src={'https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data='+encodeURIComponent(addFriend)} style={{width:150,height:150,borderRadius:12,border:'1px solid var(--hair)'}}/>
              : <div style={{width:150,height:150,borderRadius:12,border:'1px dashed var(--hair-2)',display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',fontSize:12,color:'var(--ink-3)',padding:10}}>ยังไม่ได้ตั้งบอท LINE (แอดมินตั้ง LINE_BOT_ID)</div>}
            <div style={{textAlign:'center'}}>
              <div className="sub" style={{marginBottom:4}}>รหัสจับคู่ของร้าน</div>
              <div className="num" style={{fontSize:38,fontWeight:700,letterSpacing:4,color:'var(--brand-ink)'}}>{code}</div>
              <button className="btn gh" style={{marginTop:8}} onClick={copy}>{cp?'✓ คัดลอกแล้ว':'คัดลอกรหัส'}</button>
            </div>
          </div>
          <div className="sub" style={{marginTop:16,fontSize:12,padding:'10px 12px',background:'var(--brand-softer)',borderRadius:10}}>⏳ กำลังรอการจับคู่จากกลุ่ม… พอพิมพ์รหัสในกลุ่มแล้วหน้านี้จะขึ้น “เชื่อมต่อแล้ว” เอง{info&&info.demo?' · (โหมดสาธิต — ต้องเข้าสู่ระบบเจ้าของร้านจริงเพื่อเชื่อมต่อ)':''}</div>
        </>}
    </div>
  </div></div>);
}
function PromptPayView({ data, range, onPatch }){
  const [filter,setFilter]=useState('all');
  const [imp,setImp]=useState(false);
  const [guide,setGuide]=useState(false);
  const [pair,setPair]=useState(false);
  const inR=(s)=> s.date && s.date>=range.from && s.date<=range.to;
  const digi=data.sales.filter(s=> nonVoid(s) && (s.pay==='promptpay'||s.pay==='transfer') && inR(s))
    .sort((a,b)=> ((b.date||'')+(b.t||'')).localeCompare((a.date||'')+(a.t||'')));
  const sysTot=digi.reduce((a,s)=>a+saleTotal(s),0);
  const verified=digi.filter(s=>s.verified);
  const vArr=verified.map(s=> s.payStatus==='not_found'?0:(s.verifiedAmount!=null?s.verifiedAmount:saleTotal(s)));
  const verifiedAmt=vArr.reduce((a,v)=>a+v,0);
  const diffNet=verified.reduce((a,s)=>a+(s.verifyDiff||0),0);
  const pending=digi.filter(s=>!s.verified);
  const notFound=digi.filter(s=>s.verified&&s.payStatus==='not_found');
  const disc=digi.filter(s=>s.verified&&s.payStatus==='discrepancy');
  const shown=digi.filter(s=> filter==='all' ? true : filter==='pending' ? !s.verified : filter==='disc' ? (s.verified&&s.payStatus==='discrepancy') : filter==='nf' ? (s.verified&&s.payStatus==='not_found') : true);
  const verifyAllOk=()=>{ if(!confirm('ยืนยันบิลที่ค้างตรวจทั้งหมด ('+pending.length+' บิล) ว่ายอดเข้าตรงตามระบบ?')) return; const today=isoDay(0); pending.forEach(s=>{ const sys=Math.round(saleTotal(s)); onPatch(s.id,{ verified:true, verifiedAmount:sys, verifyDiff:0, payStatus:'paid', verifiedDate:today }); }); };
  const exportCsv=()=>{ const rows=[['วันขาย','เวลา','เลขบิล','ช่องทาง','ยอดระบบ','ยอดรับจริง','ส่วนต่าง','สถานะ','วันที่ตรวจ']];
    digi.forEach(s=>{ const sys=Math.round(saleTotal(s)); const av=s.verified?(s.payStatus==='not_found'?0:(s.verifiedAmount!=null?s.verifiedAmount:sys)):''; const st=!s.verified?'ค้างตรวจ':s.payStatus==='not_found'?'ไม่พบยอด':s.payStatus==='discrepancy'?'ขาด/เกิน':'ตรงยอด';
      rows.push([s.date,s.t||'',s.no||'',payName(s.pay),sys,av,s.verified?(s.verifyDiff||0):'',st,s.verifiedDate||'']); });
    downloadCSV('promptpay-verify-'+range.from+'_'+range.to+'.csv',rows); };
  const FILT=[['all','ทั้งหมด',digi.length],['pending','ค้างตรวจ',pending.length],['disc','ขาด/เกิน',disc.length],['nf','ไม่พบยอด',notFound.length]];
  return (<div>
    <div className="card panel" style={{marginBottom:16}}>
      <h3>ตรวจยอดพร้อมเพย์ / เงินโอน — เทียบกับยอดเข้าบัญชีจริง</h3>
      <p className="sub">เทียบยอดในระบบกับเงินที่เข้าบัญชีจริง หากไม่ตรง กรอก “ยอดรับจริง” ระบบจะคำนวณส่วนต่าง (+/−) และบันทึกเข้ายอดลงบัญชีทันที · <b>ยืนยันย้อนหลัง/ข้ามวันได้</b> — รายได้ผูกไว้ที่วันที่เกิดรายการจริง (transaction date) ไม่ย้ายวัน · เลือกช่วงวันด้านบนเพื่อไล่เช็คย้อนหลัง</p>
      <button className="btn gh" style={{marginTop:10}} onClick={()=>setGuide(g=>!g)}>{guide?'▲ ซ่อนคู่มือ':'📲 คู่มือ: จับคู่อัตโนมัติจากแจ้งเตือน LINE ธนาคาร'}</button>
      {guide && (()=>{ const base=(()=>{ try{ return (localStorage.getItem('kd_api_base')||'https://kaidee-pos.oneday-pos.workers.dev').replace(/\/$/,''); }catch(e){ return 'https://kaidee-pos.oneday-pos.workers.dev'; } })(); const sh=shopFromUrl(); const hook=base+'/bank-alert?shop='+encodeURIComponent(sh);
        return (<div style={{marginTop:12,padding:'14px 16px',background:'var(--brand-softer)',borderRadius:12,fontSize:13,lineHeight:1.6}}>
          <div style={{fontWeight:700,marginBottom:6}}>ตั้งค่าจับคู่ยอดพร้อมเพย์อัตโนมัติ (ผ่าน LINE)</div>
          <div style={{color:'var(--ink-2)'}}>หลักการ: ธนาคารส่งข้อความ “เงินเข้า” → เข้ากลุ่ม LINE → บอทส่งต่อมาที่ระบบ → ระบบจับคู่กับบิลที่ค้างตรวจด้วยยอด+เวลา แล้วยืนยันให้อัตโนมัติ (เครื่อง POS ไม่ต้องมีแอปธนาคาร)</div>
          <ol style={{margin:'10px 0 10px 18px',padding:0,color:'var(--ink-2)'}}>
            <li>สร้าง <b>กลุ่ม LINE</b> ของร้าน (เช่น “เงินเข้าร้าน”)</li>
            <li>เชิญ <b>LINE OA ของธนาคาร</b> (เปิดบริการแจ้งเตือนเงินเข้า เช่น SCB Connect) เข้ากลุ่ม — ถ้าแบงก์ไม่รองรับกลุ่ม ใช้ “วางข้อความ/CSV” แทน</li>
            <li>เชิญ <b>บอท KaiDee</b> เข้ากลุ่มเดียวกัน (แอดมินตั้งค่าฝั่งระบบให้)</li>
            <li>เงินเข้าปุ๊บ → ระบบยืนยันบิลที่ตรงให้อัตโนมัติ · ที่ไม่ตรงจะขึ้น “ค้างตรวจ/เกิน” ให้ตรวจเอง</li>
          </ol>
          <div style={{fontWeight:700,fontSize:12,margin:'8px 0 3px'}}>Webhook ของร้านนี้ (ตั้งในบอท/relay):</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <code style={{flex:1,background:'#fff',border:'1px solid var(--hair-2)',borderRadius:8,padding:'8px 10px',fontSize:11.5,wordBreak:'break-all'}}>{hook}</code>
            <button className="btn gh" onClick={()=>{ try{ navigator.clipboard.writeText(hook); }catch(e){} }} style={{whiteSpace:'nowrap'}}>คัดลอก</button>
          </div>
          <div className="sub" style={{fontSize:11.5,marginTop:8}}>POST {`{ text: "<ข้อความแจ้งเตือน>" }`} มาที่ URL นี้ · ระบบตอบกลับจำนวนที่จับคู่ได้ · ต้องมี relay/บอทเชื่อม LINE→URL (งานตั้งค่าฝั่งแอดมิน) — ระหว่างนี้ทดสอบได้ที่ปุ่ม “นำเข้าสเตทเมนท์”</div>
          <div style={{fontSize:12,lineHeight:1.55,background:'#E9EFF5',borderRadius:8,padding:'9px 11px',marginTop:8,color:'var(--brand-ink)'}}>📱 <b>ใช้ได้ทุกเครื่อง (iPhone/iPad/Android/คอม)</b> เพราะทำงานบน cloud ไม่ต้องเปิดเครื่องค้าง · <b>iOS ใช้ได้ปกติ</b> (ทาง A ไม่พึ่ง OS)<br/>ทางเลือกข้ามเครื่อง: ถ้าธนาคารส่งแค่ SMS/แจ้งเตือนในแอป (ไม่เข้ากลุ่ม LINE) ให้ใช้ <b>เครื่อง Android เก่าอีกเครื่อง</b>วางไว้เป็น “ตัวส่งต่อ” (อ่าน noti ธนาคาร→ยิงเข้า Webhook เดียวกันนี้) ส่วน POS จะเป็น iPhone/iPad ก็ได้ · iPhone ทำตัวส่งต่อไม่ได้ (iOS ห้ามอ่าน noti แอปอื่น) จึงต้องเป็น Android</div>
          <a href="auto-verify-guide.html" target="_blank" className="btn pri" style={{display:'inline-block',marginTop:12,textDecoration:'none'}}>📖 เปิดคู่มือฉบับเต็ม (สำหรับร้านค้า)</a>
          <button className="btn gh" style={{marginTop:12,marginLeft:8}} onClick={()=>setPair(true)}>🔗 เชื่อมต่อแจ้งเตือน (จับคู่กลุ่ม LINE)</button>
        </div>); })()}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14,marginBottom:16}}>
      <Kpi label="ยอดในระบบ (พร้อมเพย์/โอน)" value={B(sysTot)} foot={digi.length+' บิล'}/>
      <Kpi label="ยืนยันเข้าบัญชีแล้ว" value={B(verifiedAmt)} tone="var(--brand-ink)" foot={verified.length+' บิล'}/>
      <Kpi label="ขาด/เกินสุทธิ" value={(diffNet>0?'+':'')+B(diffNet)} tone={diffNet<0?'var(--red)':diffNet>0?'#9A6410':'var(--ink)'} foot={disc.length+' บิลไม่ตรง'}/>
      <Kpi label="ค้างตรวจ" value={pending.length} tone={pending.length?'#9A6410':'var(--ink)'} foot="ยังไม่รวมยอดปิดวัน"/>
      <Kpi label="ไม่พบยอดเงิน" value={notFound.length} tone={notFound.length?'var(--red)':'var(--ink)'} foot="สลิปปลอม/ไม่มีเงินเข้า"/>
    </div>
    <div className="card">
      <div className="panel" style={{paddingBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
        <div className="seg">{FILT.map(([k,l,n])=><button key={k} className={filter===k?'on':''} onClick={()=>setFilter(k)}>{l} ({n})</button>)}</div>
        <div style={{display:'flex',gap:8}}>
          {pending.length>0 && <button className="btn gh" onClick={verifyAllOk}>✓ ยืนยันค้างตรวจทั้งหมด (ยอดตรง)</button>}
          <button className="btn gh" onClick={()=>setImp(true)}>📄 นำเข้าสเตทเมนท์</button>
          <button className="btn gh" onClick={exportCsv}>⬇ CSV</button>
        </div>
      </div>
      <div style={{maxHeight:600,overflow:'auto'}}>
      <table><thead><tr><th>วันขาย</th><th>เลขบิล</th><th>ช่องทาง</th><th className="r">ยอดระบบ</th><th className="r">ยอดรับจริง</th><th className="r">ส่วนต่าง</th><th className="c">สถานะ</th><th className="c">จัดการ</th></tr></thead>
        <tbody>{shown.length?shown.map(s=><VerifyRow key={s.id} s={s} onPatch={onPatch}/>):<tr><td colSpan="8" className="empty">ไม่มีบิลพร้อมเพย์/โอนในเงื่อนไขที่เลือก</td></tr>}</tbody></table>
      </div>
    </div>
    {imp && <StatementModal bills={pending} onPatch={onPatch} onClose={()=>setImp(false)}/>}
    {pair && <LinePairModal onClose={()=>setPair(false)}/>}
  </div>);
}
const SETTLE_MODELS={ per_sale:{th:'แบ่ง % ต่อการขาย',cls:'p-b'}, wholesale:{th:'ซื้อขาด',cls:'p-g'}, rental:{th:'เช่าพื้นที่/เดือน',cls:'p-y'} };
// สูตรคำนวณบัญชีต่อรายการ (ตรงกับ worker /consignment/settle)
function settleLine(cs, soldQty){
  const price=Number(cs.price)||0, gross=soldQty*price; let shopCut=0, payout=0, gp=0, rental=0;
  if(cs.settleModel==='wholesale'){ shopCut=gross; payout=0; gp=(price-(Number(cs.costWholesale)||0))*soldQty; }
  else if(cs.settleModel==='rental'){ shopCut=Number(cs.rentalFee)||0; payout=gross; rental=Number(cs.rentalFee)||0; }
  else { const pct=Number(cs.sharePct)||0; shopCut=Math.round(gross*pct/100); payout=gross-shopCut; }
  return { gross, shopCut, payout, gp, rental, storeRevenue:(cs.settleModel==='wholesale'?gp:shopCut) };
}
function makeConsignSeed(){
  const vendors=[{id:'vd1',name:'เบเกอรี่บ้านคุณเมย์',phone:'081-222-3344',bank:'กสิกรไทย',acctNo:'123-4-56789-0',acctName:'เมธาวี ใจดี'},
    {id:'vd2',name:'สวนผลไม้ลุงมา',phone:'089-555-1212',bank:'ไทยพาณิชย์',acctNo:'404-1-22222-3',acctName:'สมมา รักสวน'}];
  const locations=[{id:'lc1',name:'สาขาตลาดนัดจตุจักร',kind:'consign_out',partnerName:'ร้านกาแฟ Corner',partnerPhone:'062-888-1000'},
    {id:'lc2',name:'ล็อบบี้คอนโด The Line',kind:'consign_out',partnerName:'นิติบุคคล The Line',partnerPhone:'02-100-2000'}];
  const consignStock=[
    {id:'cs1',direction:'inbound',name:'ครัวซองต์เนย',sku:'CS.001',vendorId:'vd1',price:55,settleModel:'per_sale',sharePct:25,stock:18,unit:'ชิ้น',low:5,active:true,_sold:42},
    {id:'cs2',direction:'inbound',name:'พายสับปะรด',sku:'CS.002',vendorId:'vd1',price:40,settleModel:'per_sale',sharePct:25,stock:0,unit:'ชิ้น',low:6,active:true,_sold:60},
    {id:'cs3',direction:'inbound',name:'มะม่วงน้ำดอกไม้ (กก.)',sku:'CS.003',vendorId:'vd2',price:120,settleModel:'wholesale',costWholesale:80,stock:12,unit:'กก.',low:3,active:true,_sold:25},
    {id:'cs4',direction:'outbound',name:'มันฝรั่งทอดโรยผง (ถุง)',sku:'CS.010',locationId:'lc1',price:35,settleModel:'per_sale',sharePct:70,stock:24,unit:'ถุง',low:10,active:true,_sold:88},
    {id:'cs5',direction:'outbound',name:'ตู้ขนมหน้าล็อบบี้',sku:'CS.011',locationId:'lc2',price:0,settleModel:'rental',rentalFee:3000,stock:0,unit:'-',low:0,active:true,_sold:0},
  ];
  const consignDocs=[
    {id:'d1',docRef:'CSD-2607'+'0001',docType:'delivery_note',direction:'outbound',locationId:'lc1',status:'received',handledByName:'พนักงาน เอ',lines:[{name:'มันฝรั่งทอดโรยผง (ถุง)',sku:'CS.010',qty:50,price:35,unit:'ถุง',settleModel:'per_sale',sharePct:70}],grossTotal:1750,createdAt:Date.now()-6*864e5,receivedAt:Date.now()-6*864e5+7200e3},
    {id:'d2',docRef:'CSD-2607'+'0002',docType:'delivery_note',direction:'outbound',locationId:'lc1',status:'in_transit',handledByName:'พนักงาน บี',lines:[{name:'มันฝรั่งทอดโรยผง (ถุง)',sku:'CS.010',qty:30,price:35,unit:'ถุง',settleModel:'per_sale',sharePct:70}],grossTotal:1050,createdAt:Date.now()-3600e3},
  ];
  return { vendors, locations, consignStock, consignDocs };
}
function printConsignDoc(shopName, doc, locName, statusTh){
  const w=window.open('','_blank','width=560,height=760'); if(!w) return;
  const rows=(doc.lines||[]).map((l,i)=>`<tr><td>${i+1}</td><td>${l.name}${l.sku?' <span style="color:#888">('+l.sku+')</span>':''}</td><td style="text-align:right">${l.qty} ${l.unit||''}</td><td style="text-align:right">฿${(l.price||0).toLocaleString()}</td><td style="text-align:right">฿${((l.price||0)*(l.qty||0)).toLocaleString()}</td></tr>`).join('');
  const totQty=(doc.lines||[]).reduce((a,l)=>a+(l.qty||0),0);
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${doc.docRef||'ใบส่งของฝากขาย'}</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap');
  *{font-family:'IBM Plex Sans Thai',sans-serif;box-sizing:border-box}body{margin:0;padding:32px;color:#1a1f1c}
  h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}
  th,td{border:1px solid #d8ded9;padding:8px 10px;text-align:left}th{background:#f1f5f2}
  .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0E9463;padding-bottom:12px}
  .meta{font-size:13px;color:#555;line-height:1.8;margin-top:10px}.badge{display:inline-block;padding:3px 12px;border-radius:999px;font-size:12px;font-weight:700;background:${doc.status==='received'?'#DCF3E6;color:#0E7A4E':'#FFF1D6;color:#9A6410'}}
  .sign{display:flex;gap:40px;margin-top:56px;font-size:13px}.sign div{flex:1;border-top:1px dashed #999;padding-top:8px;text-align:center;color:#555}
  @media print{body{padding:16px}.no-print{display:none}}</style></head><body>
  <div class="hd"><div><h1>ใบส่งของฝากขาย</h1><div style="color:#0E9463;font-weight:700;font-size:13px;margin-top:2px">Consignment Delivery Note</div></div>
  <div style="text-align:right"><div style="font-weight:700;font-size:16px">${shopName||''}</div><div class="meta" style="margin-top:2px">เลขที่ <b>${doc.docRef||'-'}</b></div></div></div>
  <div class="meta">วันที่: ${thDateTime(doc.createdAt)} · ผู้ทำรายการ: ${doc.handledByName||'-'} · สถานะ: <span class="badge">${statusTh}</span><br>ส่งไปยัง: <b>${locName||'-'}</b></div>
  <table><thead><tr><th>#</th><th>รายการสินค้า</th><th style="text-align:right">จำนวนส่งออก</th><th style="text-align:right">ราคา/ชิ้น</th><th style="text-align:right">รวม</th></tr></thead>
  <tbody>${rows}</tbody><tfoot><tr><th colspan="2">รวมทั้งสิ้น</th><th style="text-align:right">${totQty} ชิ้น</th><th></th><th style="text-align:right">฿${(doc.grossTotal||0).toLocaleString()}</th></tr></tfoot></table>
  <div class="sign"><div>ผู้ส่งสินค้า</div><div>ผู้รับสินค้า (พาร์ทเนอร์)</div></div>
  <div class="no-print" style="margin-top:32px;text-align:center"><button onclick="window.print()" style="padding:11px 24px;border:none;border-radius:10px;background:#0E9463;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit">🖨️ พิมพ์ / เซฟเป็น PDF</button></div>
  </body></html>`); w.document.close();
}
// เอกสารบัญชีคู่ค้าขายฝาก: ใบสรุปเคลียร์เงิน/จ่ายคืน + หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)
function printVendorDoc(kind, ctx){
  // ctx: { shop, vendor, period, lines:[{name,sku,qty,price,gross,shopCut,payout}], gross, shopCut, payout, whtPct }
  const w=window.open('','_blank','width=620,height=820'); if(!w) return;
  const v=ctx.vendor||{}; const shop=ctx.shop||{}; const today=new Date().toISOString().slice(0,10);
  const ref=(kind==='wht'?'WHT-':'CSS-')+today.replace(/-/g,'').slice(2)+'-'+String(Math.floor(Math.random()*900+100));
  const money=(n)=>'฿'+Math.round(Number(n)||0).toLocaleString('en-US');
  const wht=ctx.whtPct? Math.round(ctx.shopCut*ctx.whtPct/100*100)/100 : 0; // หัก ณ ที่จ่ายจากค่าคอม/บริการ
  const netPay=Math.round((ctx.payout - (kind==='wht'?0:0))*100)/100;
  const css=`*{font-family:'IBM Plex Sans Thai',sans-serif;box-sizing:border-box}body{margin:0;padding:32px;color:#1a1f1c;font-size:13px}
  h1{font-size:20px;margin:0}h2{font-size:15px;margin:20px 0 6px}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
  th,td{border:1px solid #d8ded9;padding:8px 10px;text-align:left}th{background:#f1f5f2}.r{text-align:right}
  .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0E9463;padding-bottom:12px}
  .meta{font-size:12.5px;color:#555;line-height:1.7;margin-top:8px}
  .box{background:#f1f5f2;border-radius:9px;padding:12px 14px;margin-top:14px}
  .kv{display:flex;justify-content:space-between;padding:5px 0}.kv.tot{border-top:2px solid #1a1f1c;margin-top:6px;padding-top:10px;font-weight:700;font-size:15px}
  .sign{display:flex;gap:40px;margin-top:52px}.sign div{flex:1;border-top:1px dashed #999;padding-top:8px;text-align:center;color:#555;font-size:12.5px}
  @media print{body{padding:16px}.no-print{display:none}}`;
  const issuer=`<div style="text-align:right"><div style="font-weight:700;font-size:16px">${shop.account||shop.name||''}</div><div class="meta" style="margin-top:2px">${shop.address||''}<br>${shop.taxId?('เลขผู้เสียภาษี '+shop.taxId):''} · เลขที่ <b>${ref}</b><br>วันที่ ${thDate(today)}</div></div>`;
  let body='';
  if(kind==='settle'){
    const rows=(ctx.lines||[]).map((l,i)=>`<tr><td>${i+1}</td><td>${l.name}${l.sku?' <span style="color:#888">('+l.sku+')</span>':''}</td><td class="r">${l.qty}</td><td class="r">${money(l.price)}</td><td class="r">${money(l.gross)}</td><td class="r">${money(l.shopCut)}</td><td class="r">${money(l.payout)}</td></tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:#888">ไม่มีรายการ</td></tr>';
    body=`<h1>ใบสรุปเคลียร์เงินฝากขาย</h1><div style="color:#0E9463;font-weight:700;font-size:13px">Consignment Settlement Statement</div>
    <div class="meta">คู่ค้า/ผู้ฝากขาย: <b>${v.name||'-'}</b>${v.phone?(' · โทร '+v.phone):''}<br>รอบ: ${ctx.period||'-'}${v.bank?('<br>โอนเข้าบัญชี: '+v.bank+' '+(v.acctNo||'')):''}</div>
    <table><thead><tr><th>#</th><th>สินค้า</th><th class="r">ขายได้</th><th class="r">ราคา</th><th class="r">ยอดขาย</th><th class="r">ส่วนแบ่งร้าน</th><th class="r">คืนคู่ค้า</th></tr></thead>
    <tbody>${rows}</tbody><tfoot><tr><th colspan="4" class="r">รวม</th><th class="r">${money(ctx.gross)}</th><th class="r">${money(ctx.shopCut)}</th><th class="r">${money(ctx.payout)}</th></tr></tfoot></table>
    <div class="box"><div class="kv"><span>ยอดขายรวม</span><span>${money(ctx.gross)}</span></div>
      <div class="kv"><span>หัก ส่วนแบ่ง/ค่าบริการร้าน</span><span>(${money(ctx.shopCut)})</span></div>
      ${wht?`<div class="kv"><span>หัก ภาษี ณ ที่จ่าย ${ctx.whtPct}% (จากค่าบริการ)</span><span>(${money(wht)})</span></div>`:''}
      <div class="kv tot"><span>ยอดโอนคืนคู่ค้าสุทธิ</span><span style="color:#0E7A4E">${money(ctx.payout - wht)}</span></div></div>
    <div class="meta" style="margin-top:10px">* ยอดขายที่เก็บแทนคู่ค้าไม่ถือเป็นรายได้ของร้าน — ร้านรับรู้เฉพาะส่วนแบ่ง/ค่าบริการเป็นรายได้ · เอกสารนี้ใช้ประกอบบัญชีทั้งสองฝ่าย</div>
    <div class="sign"><div>ผู้จ่ายเงิน (ร้าน)</div><div>ผู้รับเงิน (คู่ค้า)</div></div>`;
  } else if(kind==='wht'){
    body=`<h1>หนังสือรับรองการหักภาษี ณ ที่จ่าย</h1><div style="color:#0E9463;font-weight:700;font-size:13px">(ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร)</div>
    <table style="margin-top:16px"><tbody>
      <tr><th style="width:38%">ผู้มีหน้าที่หักภาษี (ผู้จ่าย)</th><td>${shop.account||shop.name||'-'} · เลขผู้เสียภาษี ${shop.taxId||'-'}</td></tr>
      <tr><th>ผู้ถูกหักภาษี (คู่ค้า)</th><td>${v.name||'-'}${v.taxId?(' · เลขผู้เสียภาษี '+v.taxId):''}</td></tr>
      <tr><th>ประเภทเงินได้</th><td>ค่าบริการ/ค่านายหน้าจากการฝากขาย</td></tr>
      <tr><th>จำนวนเงินที่จ่าย (ฐานหัก)</th><td class="r">${money(ctx.shopCut)}</td></tr>
      <tr><th>อัตราภาษีที่หัก</th><td class="r">${ctx.whtPct||3}%</td></tr>
      <tr><th>ภาษีที่หักและนำส่ง</th><td class="r" style="font-weight:700;color:#B26A00">${money(wht)}</td></tr>
    </tbody></table>
    <div class="meta" style="margin-top:12px">ผู้จ่ายเงินได้นำส่งภาษีที่หักไว้ต่อกรมสรรพากร (ภ.ง.ด.53/3) · คู่ค้านำหนังสือนี้ไปเป็นเครดิตภาษีได้</div>
    <div class="sign"><div>ผู้จ่ายเงิน / ผู้หักภาษี</div><div>ผู้รับเงิน</div></div>`;
  }
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${ref}</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap');${css}</style></head><body>
  <div class="hd"><div style="font-weight:700;font-size:14px;color:#0E9463">KAIDEE POS<br><span style="color:#888;font-weight:500;font-size:12px">เอกสารบัญชีขายฝาก</span></div>${issuer}</div>
  ${body}
  <div class="no-print" style="margin-top:30px;text-align:center"><button onclick="window.print()" style="padding:11px 24px;border:none;border-radius:10px;background:#0E9463;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit">🖨️ พิมพ์ / เซฟ PDF</button></div>
  </body></html>`); w.document.close();
}
function EntityManager({ title, items, fields, onSave, onDelete, onClose }){
  const [draft,setDraft]=useState({});
  return (<div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
    <div style={{padding:'18px 24px',borderBottom:'1px solid var(--hair)',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:18,fontWeight:700}}>{title}</div><button className="btn gh" onClick={onClose}>✕ ปิด</button></div>
    <div style={{padding:'18px 24px'}}>
      <div className="card" style={{maxHeight:280,overflow:'auto',marginBottom:16}}>
        <table><tbody>{items.length?items.map(it=>(<tr key={it.id}><td style={{fontWeight:600}}>{it.name}</td><td style={{color:'var(--ink-3)',fontSize:12.5}}>{fields.filter(f=>f.k!=='name').map(f=>it[f.k]).filter(Boolean).join(' · ')}</td><td className="r"><button className="btn gh" style={{padding:'3px 9px',fontSize:12,color:'var(--red)'}} onClick={()=>onDelete(it.id)}>ลบ</button></td></tr>)):<tr><td className="empty">ยังไม่มีข้อมูล</td></tr>}</tbody></table>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {fields.map(f=><input key={f.k} className="field" placeholder={f.ph} value={draft[f.k]||''} onChange={e=>setDraft(d=>({...d,[f.k]:e.target.value}))} style={f.wide?{gridColumn:'1/3'}:{}}/>)}
      </div>
      <button className="btn pri" style={{marginTop:12,width:'100%',justifyContent:'center'}} disabled={!draft.name} onClick={()=>{ onSave(draft); setDraft({}); }}>+ เพิ่ม</button>
    </div>
  </div></div>);
}
function ConsignEditor({ item, vendors, locations, onSave, onClose }){
  const [f,setF]=useState({ direction:'inbound',settleModel:'per_sale',unit:'ชิ้น',price:0,stock:0,low:0,sharePct:20, ...item });
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return (<div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
    <div style={{padding:'18px 24px',borderBottom:'1px solid var(--hair)',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:18,fontWeight:700}}>{item&&item.id?'แก้ไขสินค้าฝากขาย':'เพิ่มสินค้าฝากขาย'}</div><button className="btn gh" onClick={onClose}>✕</button></div>
    <div style={{padding:'18px 24px',display:'grid',gap:12}}>
      <div className="seg">{[['inbound','รับฝากขาย (ของคนอื่น)'],['outbound','ส่งฝากขาย (ของเรา)']].map(([k,l])=><button key={k} className={f.direction===k?'on':''} onClick={()=>set('direction',k)}>{l}</button>)}</div>
      <input className="field" placeholder="ชื่อสินค้า" value={f.name||''} onChange={e=>set('name',e.target.value)}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {f.direction==='inbound'
          ? <select className="field" value={f.vendorId||''} onChange={e=>set('vendorId',e.target.value)}><option value="">— เลือก Vendor —</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>
          : <select className="field" value={f.locationId||''} onChange={e=>set('locationId',e.target.value)}><option value="">— เลือกสถานที่ —</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>}
        <input className="field" placeholder="ราคาขาย (฿)" inputMode="decimal" value={f.price||''} onChange={e=>set('price',+e.target.value||0)}/>
        <input className="field" placeholder="คงเหลือ" inputMode="decimal" value={f.stock||''} onChange={e=>set('stock',+e.target.value||0)}/>
        <input className="field" placeholder="หน่วย" value={f.unit||''} onChange={e=>set('unit',e.target.value)}/>
      </div>
      <div><div className="sub" style={{marginBottom:6,fontWeight:700}}>โมเดลการจ่ายเงิน</div>
        <div className="seg">{Object.entries(SETTLE_MODELS).map(([k,v])=><button key={k} className={f.settleModel===k?'on':''} onClick={()=>set('settleModel',k)}>{v.th}</button>)}</div></div>
      {f.settleModel==='per_sale' && <input className="field" placeholder="ร้านหัก % (ที่เหลือคืน Vendor)" inputMode="decimal" value={f.sharePct||''} onChange={e=>set('sharePct',+e.target.value||0)}/>}
      {f.settleModel==='wholesale' && <input className="field" placeholder="ราคาทุนซื้อขาด (฿/ชิ้น)" inputMode="decimal" value={f.costWholesale||''} onChange={e=>set('costWholesale',+e.target.value||0)}/>}
      {f.settleModel==='rental' && <input className="field" placeholder="ค่าเช่าพื้นที่คงที่ (฿/เดือน)" inputMode="decimal" value={f.rentalFee||''} onChange={e=>set('rentalFee',+e.target.value||0)}/>}
      <button className="btn pri" style={{justifyContent:'center'}} disabled={!f.name} onClick={()=>onSave(f)}>บันทึก</button>
    </div>
  </div></div>);
}
function DeliveryNoteModal({ locations, stock, onSave, onClose }){
  const outbound=stock.filter(s=>s.direction==='outbound');
  const [locId,setLocId]=useState(locations[0]?locations[0].id:''); const [by,setBy]=useState('');
  const [lines,setLines]=useState([{ name:'',qty:1,price:0,unit:'ชิ้น' }]);
  const setLine=(i,k,v)=>setLines(p=>p.map((l,j)=>j===i?{...l,[k]:v}:l));
  const ok=locId && lines.some(l=>l.name&&l.qty>0);
  return (<div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:600}}>
    <div style={{padding:'18px 24px',borderBottom:'1px solid var(--hair)',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:18,fontWeight:700}}>สร้างใบส่งของฝากขาย</div><button className="btn gh" onClick={onClose}>✕</button></div>
    <div style={{padding:'18px 24px',display:'grid',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <select className="field" value={locId} onChange={e=>setLocId(e.target.value)}><option value="">— สถานที่ปลายทาง —</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <input className="field" placeholder="ชื่อพนักงานผู้ส่ง" value={by} onChange={e=>setBy(e.target.value)}/>
      </div>
      <div style={{fontWeight:700,fontSize:13}}>รายการสินค้าที่ส่งออก</div>
      {lines.map((l,i)=>(<div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto',gap:8,alignItems:'center'}}>
        <input className="field" list="cs-out" placeholder="ชื่อสินค้า" value={l.name} onChange={e=>{ const m=outbound.find(x=>x.name===e.target.value); setLine(i,'name',e.target.value); if(m){ setLine(i,'price',m.price); setLine(i,'unit',m.unit); } }}/>
        <input className="field" placeholder="จำนวน" inputMode="decimal" value={l.qty} onChange={e=>setLine(i,'qty',+e.target.value||0)}/>
        <input className="field" placeholder="฿/ชิ้น" inputMode="decimal" value={l.price} onChange={e=>setLine(i,'price',+e.target.value||0)}/>
        <button className="btn gh" style={{padding:'6px 10px',color:'var(--red)'}} onClick={()=>setLines(p=>p.filter((_,j)=>j!==i))}>✕</button>
      </div>))}
      <datalist id="cs-out">{outbound.map(s=><option key={s.id} value={s.name}/>)}</datalist>
      <button className="btn gh" style={{alignSelf:'start'}} onClick={()=>setLines(p=>[...p,{name:'',qty:1,price:0,unit:'ชิ้น'}])}>+ เพิ่มรายการ</button>
      <div className="sub" style={{padding:'10px 12px',background:'var(--brand-softer)',borderRadius:10}}>เมื่อสร้าง: หักสต๊อกคลังหลักทันที · สถานะ <b>อยู่ระหว่างขนส่ง (In Transit)</b> จนกว่าปลายทางกด “ยืนยันรับของ” ยอดจึงเข้าคลังสาขา</div>
      <button className="btn pri" style={{justifyContent:'center'}} disabled={!ok} onClick={()=>onSave({ locationId:locId, handledByName:by, lines:lines.filter(l=>l.name&&l.qty>0) })}>ออกเอกสาร + หักสต๊อกคลังหลัก</button>
    </div>
  </div></div>);
}
function ConsignmentView({ data, demo }){
  const [sub,setSub]=useState('stock');
  const [vendors,setVendors]=useState(null); const [locations,setLocations]=useState([]); const [stock,setStock]=useState([]); const [docs,setDocs]=useState([]);
  const [sold,setSold]=useState({});   // rmId → qty sold (จาก inv-tx CONSIGN_SALE)
  const [dir,setDir]=useState('inbound'); const [vFilter,setVFilter]=useState(''); const [lFilter,setLFilter]=useState('');
  const [manageV,setManageV]=useState(false); const [manageL,setManageL]=useState(false); const [editItem,setEditItem]=useState(null); const [dnOpen,setDnOpen]=useState(false); const [msg,setMsg]=useState('');
  const shopName=(data.settings&&data.settings.pay&&data.settings.pay.shopName)||'ร้านของคุณ';
  const reload=()=>{ if(demo||!window.KD_LIVE){ const s=makeConsignSeed(); setVendors(s.vendors); setLocations(s.locations); setStock(s.consignStock); setDocs(s.consignDocs); const so={}; s.consignStock.forEach(c=>{ if(c._sold) so[c.id]=c._sold; }); setSold(so); return; }
    Promise.all([KD_API.listVendors().catch(()=>[]),KD_API.listLocations().catch(()=>[]),KD_API.listConsignStock().catch(()=>[]),KD_API.listConsignDocs().catch(()=>[]),KD_API.listInvTx({type:'CONSIGN_SALE'}).catch(()=>[])])
      .then(([v,l,s,d,tx])=>{ setVendors(v||[]); setLocations(l||[]); setStock(s||[]); setDocs(d||[]); const so={}; (tx||[]).forEach(t=>{ so[t.rmId]=(so[t.rmId]||0)+Math.abs(t.qty||0); }); setSold(so); }); };
  useEffect(()=>{ reload(); },[demo]);
  if(vendors===null) return <div className="empty" style={{padding:40}}>กำลังโหลดข้อมูลขายฝาก…</div>;
  const vName=(id)=>{ const v=vendors.find(x=>x.id===id); return v?v.name:'—'; };
  const lName=(id)=>{ const l=locations.find(x=>x.id===id); return l?l.name:(id||'—'); };
  const flash=(t)=>{ setMsg(t); setTimeout(()=>setMsg(''),2600); };
  const saveStock=(f)=>{ if(demo||!window.KD_LIVE){ setStock(p=>{ const i=p.findIndex(x=>x.id===f.id); if(i>=0){ const n=p.slice(); n[i]={...n[i],...f}; return n; } return [...p,{...f,id:'cs'+Date.now(),active:true}]; }); setEditItem(null); return; }
    KD_API.saveConsignStock(f).then(()=>{ reload(); setEditItem(null); }).catch(()=>flash('บันทึกไม่ได้')); };
  const saveVendor=(d)=>{ const v={ name:d.name,phone:d.phone,bank:d.bank,acctNo:d.acctNo }; if(demo||!window.KD_LIVE){ setVendors(p=>[...p,{...v,id:'vd'+Date.now()}]); return; } KD_API.saveVendor(v).then(reload).catch(()=>{}); };
  const delVendor=(id)=>{ if(demo||!window.KD_LIVE){ setVendors(p=>p.filter(x=>x.id!==id)); return; } KD_API.deleteVendor(id).then(reload).catch(()=>{}); };
  const saveLoc=(d)=>{ const l={ name:d.name,partnerName:d.partnerName,partnerPhone:d.partnerPhone,kind:'consign_out' }; if(demo||!window.KD_LIVE){ setLocations(p=>[...p,{...l,id:'lc'+Date.now()}]); return; } KD_API.saveLocation(l).then(reload).catch(()=>{}); };
  const delLoc=(id)=>{ if(demo||!window.KD_LIVE){ setLocations(p=>p.filter(x=>x.id!==id)); return; } KD_API.deleteLocation(id).then(reload).catch(()=>{}); };
  const createDN=(b)=>{ if(demo||!window.KD_LIVE){ const ref='CSD-'+new Date().toISOString().slice(0,7).replace('-','')+String(docs.length+1).padStart(4,'0'); setDocs(p=>[{ id:'d'+Date.now(),docRef:ref,docType:'delivery_note',direction:'outbound',locationId:b.locationId,handledByName:b.handledByName,status:'in_transit',lines:b.lines,grossTotal:b.lines.reduce((a,l)=>a+l.price*l.qty,0),createdAt:Date.now() },...p]); setDnOpen(false); flash('ออกใบส่งของ '+ref+' แล้ว · หักสต๊อกคลังหลัก'); return; }
    KD_API.createDeliveryNote(b).then(r=>{ reload(); setDnOpen(false); flash('ออกใบส่งของ '+(r&&r.docRef||'')+' แล้ว'); }).catch(()=>flash('ออกเอกสารไม่ได้')); };
  const confirmDN=(doc)=>{ if(demo||!window.KD_LIVE){ setDocs(p=>p.map(d=>d.id===doc.id?{...d,status:'received',receivedAt:Date.now()}:d)); flash('ยืนยันรับของ '+doc.docRef+' · ยอดเข้าคลังสาขาแล้ว'); return; }
    KD_API.confirmDeliveryNote(doc.id).then(()=>{ reload(); flash('ยืนยันรับของ '+doc.docRef+' แล้ว'); }).catch(()=>flash('ยืนยันไม่ได้')); };

  const list=stock.filter(s=>s.direction===dir && (!vFilter||s.vendorId===vFilter) && (!lFilter||s.locationId===lFilter));
  // รายงานเคลียร์เงินต่อ Vendor (inbound · pay-per-sale) + wholesale GP + rental income
  const inbound=stock.filter(s=>s.direction==='inbound');
  const byVendor={}; inbound.forEach(cs=>{ const sq=sold[cs.id]||0; const r=settleLine(cs,sq); const v=cs.vendorId||'—'; (byVendor[v]=byVendor[v]||{gross:0,payout:0,storeRev:0,gp:0,items:0}); byVendor[v].gross+=r.gross; byVendor[v].payout+=r.payout; byVendor[v].storeRev+=r.storeRevenue; byVendor[v].gp+=r.gp; byVendor[v].items++; });
  const rentalIncome=stock.filter(s=>s.settleModel==='rental').reduce((a,s)=>a+(Number(s.rentalFee)||0),0);
  const totPayout=Object.values(byVendor).reduce((a,v)=>a+v.payout,0);

  return (<div className="fade">
    <div className="seg" style={{marginBottom:16}}>{[['stock','คลังสินค้าขายฝาก'],['docs','ใบส่งของ / รับของ'],['settle','เคลียร์เงิน & รายงาน']].map(([k,l])=><button key={k} className={sub===k?'on':''} onClick={()=>setSub(k)}>{l}</button>)}</div>

    {sub==='stock' && <>
      <div className="kpis">
        <Kpi label="สินค้าฝากขายทั้งหมด" value={stock.length} foot={inbound.length+' รับฝาก · '+(stock.length-inbound.length)+' ส่งฝาก'} tone="var(--brand-ink)"/>
        <Kpi label="มูลค่าคงเหลือในคลังฝาก" value={B(stock.reduce((a,s)=>a+(Number(s.price)||0)*(Number(s.stock)||0),0))} foot="ตามราคาขาย"/>
        <Kpi label="ค้างจ่ายคืน Vendor" value={B(totPayout)} foot="Pending payout (pay-per-sale)" tone="var(--red)"/>
        <Kpi label="รายได้ค่าเช่าพื้นที่/เดือน" value={B(rentalIncome)} foot="Fixed rental income" tone="var(--green)"/>
      </div>
      <div className="card panel" style={{padding:0,overflow:'hidden'}}>
        <div className="panel" style={{paddingBottom:12}}>
          <div className="toolbar" style={{marginBottom:0}}>
            <div className="seg">{[['inbound','รับฝากขาย'],['outbound','ส่งฝากขาย']].map(([k,l])=><button key={k} className={dir===k?'on':''} onClick={()=>setDir(k)}>{l}</button>)}</div>
            {dir==='inbound' && <select className="field" value={vFilter} onChange={e=>setVFilter(e.target.value)}><option value="">ทุก Vendor</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>}
            {dir==='outbound' && <select className="field" value={lFilter} onChange={e=>setLFilter(e.target.value)}><option value="">ทุกสถานที่</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>}
            <div style={{flex:1}}/>
            {dir==='inbound'?<button className="btn gh" onClick={()=>setManageV(true)}>จัดการ Vendor</button>:<button className="btn gh" onClick={()=>setManageL(true)}>จัดการสถานที่</button>}
            <button className="btn pri" onClick={()=>setEditItem({direction:dir})}>+ เพิ่มสินค้า</button>
          </div>
        </div>
        <div style={{maxHeight:520,overflow:'auto'}}>
        <table><thead><tr><th>SKU · สินค้า</th><th>{dir==='inbound'?'Vendor':'สถานที่'}</th><th>โมเดล</th><th className="r">ราคา</th><th className="r">คงเหลือ</th><th className="r">ขายแล้ว</th><th className="r">{dir==='inbound'?'ค้างคืน Vendor':'บัญชีร้าน'}</th></tr></thead>
          <tbody>{list.length?list.map(cs=>{ const sq=sold[cs.id]||0; const r=settleLine(cs,sq); const out=(Number(cs.stock)||0)<=0; const m=SETTLE_MODELS[cs.settleModel]||{th:cs.settleModel,cls:'p-n'};
            return (<tr className="row" key={cs.id} onClick={()=>setEditItem(cs)}>
              <td><div style={{fontWeight:600}}>{cs.name}</div><div className="mono" style={{fontSize:11,color:'var(--ink-3)'}}>{cs.sku||cs.id}</div></td>
              <td style={{fontSize:12.5}}>{dir==='inbound'?vName(cs.vendorId):lName(cs.locationId)}</td>
              <td><span className={'pill '+m.cls}>{m.th}{cs.settleModel==='per_sale'?' '+(cs.sharePct||0)+'%':''}</span></td>
              <td className="r num">{cs.settleModel==='rental'?'—':B(cs.price)}</td>
              <td className="r num" style={{fontWeight:700,color:out?'var(--red)':'inherit'}}>{cs.settleModel==='rental'?'—':(Number(cs.stock)||0)+(out?' · หมด':'')}</td>
              <td className="r num">{sq||'—'}</td>
              <td className="r num" style={{fontWeight:700,color:dir==='inbound'?'var(--red)':'var(--green)'}}>{dir==='inbound'?B(r.payout):(cs.settleModel==='wholesale'?'GP '+B(r.gp):cs.settleModel==='rental'?B(r.rental)+'/ด':B(r.shopCut))}</td>
            </tr>); }):<tr><td colSpan="7" className="empty">ยังไม่มีสินค้าฝากขายในหมวดนี้</td></tr>}</tbody></table>
        </div>
      </div>
      <div className="sub" style={{marginTop:12,padding:'11px 13px',background:'var(--brand-softer)',borderRadius:10}}>🔒 คลังขายฝากแยกขาดจากคลังหลัก — สินค้าที่ผูก <b>is_consignment</b> เมื่อขายจะตัดจากคลังนี้เท่านั้น · คงเหลือ 0 = หน้าลูกค้าขึ้น “สินค้าหมด” ทันที · การคืน/หมดอายุบันทึกเป็น “คืน Vendor” (ไม่ปนของเสียคลังหลัก)</div>
    </>}

    {sub==='docs' && <>
      <div className="toolbar" style={{justifyContent:'space-between'}}>
        <div style={{fontWeight:700,fontSize:15}}>ใบส่งของฝากขาย (Outbound Delivery Notes)</div>
        <button className="btn pri" onClick={()=>setDnOpen(true)}>+ สร้างใบส่งของ</button>
      </div>
      <div className="card"><table><thead><tr><th>เลขที่เอกสาร</th><th>วันที่</th><th>ปลายทาง</th><th>ผู้ทำรายการ</th><th className="r">จำนวน</th><th className="r">มูลค่า</th><th className="c">สถานะ</th><th></th></tr></thead>
        <tbody>{docs.filter(d=>d.docType==='delivery_note').length?docs.filter(d=>d.docType==='delivery_note').map(d=>{ const rec=d.status==='received'; const totQ=(d.lines||[]).reduce((a,l)=>a+(l.qty||0),0);
          return (<tr key={d.id}><td className="mono" style={{fontSize:12.5,fontWeight:700}}>{d.docRef}</td><td className="num">{thDate(new Date(d.createdAt).toISOString().slice(0,10))}</td><td>{lName(d.locationId)}</td><td style={{fontSize:12.5}}>{d.handledByName||'—'}</td><td className="r num">{totQ}</td><td className="r num">{B(d.grossTotal)}</td>
            <td className="c"><span className={'pill '+(rec?'p-g':'p-y')}>{rec?'รับของแล้ว':'อยู่ระหว่างขนส่ง'}</span></td>
            <td className="r" style={{whiteSpace:'nowrap'}}><button className="btn gh" style={{padding:'4px 10px',fontSize:12}} onClick={()=>printConsignDoc(shopName,d,lName(d.locationId),rec?'รับของแล้ว (Received)':'อยู่ระหว่างขนส่ง (In Transit)')}>🖨️ พิมพ์</button>{!rec&&<button className="btn pri" style={{padding:'4px 10px',fontSize:12,marginLeft:6}} onClick={()=>confirmDN(d)}>ยืนยันรับของ</button>}</td>
          </tr>); }):<tr><td colSpan="8" className="empty">ยังไม่มีใบส่งของ — กด “สร้างใบส่งของ” เพื่อส่งสินค้าไปฝากขาย</td></tr>}</tbody></table></div>
      <div className="sub" style={{marginTop:12,padding:'11px 13px',background:'var(--brand-softer)',borderRadius:10}}>ออกเอกสาร → หักคลังหลัก + สถานะ <b>อยู่ระหว่างขนส่ง</b> · ปลายทางกด <b>ยืนยันรับของ</b> → ยอดเข้าคลังฝากขายสาขาอย่างเป็นทางการ พร้อมตัดยอดขายรายชิ้น · กด “พิมพ์” เพื่อเซฟ PDF/รูป แชร์เข้า LINE ให้พาร์ทเนอร์</div>
    </>}

    {sub==='settle' && <>
      <div className="kpis">
        <Kpi label="ยอดขายฝากรวม (Gross)" value={B(inbound.reduce((a,cs)=>a+(sold[cs.id]||0)*(Number(cs.price)||0),0))} foot="เฉพาะรับฝากขาย"/>
        <Kpi label="ยอดค้างจ่ายคืน Vendor" value={B(totPayout)} tone="var(--red)" foot="Pending vendor payout"/>
        <Kpi label="รายได้ร้าน (ส่วนแบ่ง+GP)" value={B(Object.values(byVendor).reduce((a,v)=>a+v.storeRev,0))} tone="var(--brand-ink)" foot="หลังหักส่วนแบ่ง/ทุนซื้อขาด"/>
        <Kpi label="ค่าเช่าพื้นที่ (Fixed)" value={B(rentalIncome)} tone="var(--green)" foot="รายได้ขาอื่น/เดือน"/>
      </div>
      <div className="card panel">
        <h3>รายงานเคลียร์เงินคืนซัพพลายเออร์ (Pay-per-sale)</h3>
        <table><thead><tr><th>Vendor</th><th className="r">รายการ</th><th className="r">ยอดขายรวม</th><th className="r">ส่วนแบ่งร้าน</th><th className="r">ต้องโอนคืน</th><th>เอกสารคู่ค้า</th></tr></thead>
          <tbody>{Object.entries(byVendor).length?Object.entries(byVendor).map(([vid,v])=>{ const vObj=(vendors||[]).find(x=>x.id===vid)||{name:vName(vid)};
            const vLines=inbound.filter(cs=>(cs.vendorId||'—')===vid).map(cs=>{ const sq=sold[cs.id]||0; const r=settleLine(cs,sq); return {name:cs.name,sku:cs.sku,qty:sq,price:cs.price,gross:r.gross,shopCut:r.shopCut,payout:r.payout}; }).filter(l=>l.qty>0);
            const ctx={shop:{account:shopName,name:shopName,taxId:(data.settings&&data.settings.pay&&data.settings.pay.taxId)||'',address:(data.settings&&data.settings.pay&&data.settings.pay.address)||''},vendor:vObj,period:isoDay(30)+' – '+isoDay(0),lines:vLines,gross:v.gross,shopCut:v.storeRev,payout:v.payout,whtPct:3};
            return (<tr key={vid}><td style={{fontWeight:600}}>{vName(vid)}</td><td className="r num">{v.items}</td><td className="r num">{B(v.gross)}</td><td className="r num" style={{color:'var(--green)',fontWeight:700}}>{B(v.storeRev)}</td><td className="r num" style={{color:'var(--red)',fontWeight:700}}>{B(v.payout)}</td>
            <td className="r" style={{whiteSpace:'nowrap'}}>
              <button className="btn pri" style={{padding:'4px 10px',fontSize:12}} onClick={()=>printVendorDoc('settle',ctx)}>🧾 ใบเคลียร์เงิน</button>
              <button className="btn gh" style={{padding:'4px 10px',fontSize:12,marginLeft:6}} onClick={()=>printVendorDoc('wht',ctx)}>หัก ณ ที่จ่าย</button>
              <button className="btn gh" style={{padding:'4px 10px',fontSize:12,marginLeft:6}} onClick={()=>{ if(demo||!window.KD_LIVE){ flash('บันทึกใบเคลียร์เงินให้ '+vName(vid)+' (สาธิต)'); return; } KD_API.consignSettle({vendorId:vid,periodFrom:isoDay(30),periodTo:isoDay(0)}).then(r=>flash('บันทึกเคลียร์เงิน · โอน '+B(r&&r.payoutTotal||0))).catch(()=>flash('ทำรายการไม่ได้')); }}>บันทึก</button>
            </td></tr>); }):<tr><td colSpan="6" className="empty">ยังไม่มียอดขายฝากแบบแบ่ง %</td></tr>}</tbody></table>
        <div className="sub" style={{marginTop:12}}>สูตร: ส่วนแบ่งร้าน = ยอดขาย × %ร้าน · ต้องโอนคืน = ยอดขาย − ส่วนแบ่งร้าน · <b>ซื้อขาด</b> = รายได้ร้าน 100% (กำไร = ราคาขาย − ทุนขายส่ง) · <b>เช่าพื้นที่</b> = ยอดขายคืนคู่ค้าเต็ม + ร้านรับค่าเช่าคงที่แยกหมวด · เอกสารคู่ค้าพิมพ์/เซฟ PDF ส่งบัญชีได้</div>
      </div>
    </>}

    {manageV && <EntityManager title="จัดการ Vendor (เจ้าของสินค้าฝากขาย)" items={vendors} fields={[{k:'name',ph:'ชื่อ/ร้าน',wide:true},{k:'phone',ph:'เบอร์โทร'},{k:'bank',ph:'ธนาคาร'},{k:'acctNo',ph:'เลขบัญชี',wide:true}]} onSave={saveVendor} onDelete={delVendor} onClose={()=>setManageV(false)}/>}
    {manageL && <EntityManager title="จัดการสถานที่ฝากขาย (Locations)" items={locations} fields={[{k:'name',ph:'ชื่อสถานที่/สาขา',wide:true},{k:'partnerName',ph:'ชื่อพาร์ทเนอร์'},{k:'partnerPhone',ph:'เบอร์โทร'}]} onSave={saveLoc} onDelete={delLoc} onClose={()=>setManageL(false)}/>}
    {editItem && <ConsignEditor item={editItem} vendors={vendors} locations={locations} onSave={saveStock} onClose={()=>setEditItem(null)}/>}
    {dnOpen && <DeliveryNoteModal locations={locations} stock={stock} onSave={createDN} onClose={()=>setDnOpen(false)}/>}
    {msg && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'var(--ink)',color:'#fff',padding:'11px 20px',borderRadius:12,fontWeight:700,fontSize:13.5,zIndex:100,boxShadow:'0 8px 24px rgba(0,0,0,.2)'}}>{msg}</div>}
  </div>);
}

/* ═════════════ SETTINGS (สิทธิ์เปิด-ปิดร้าน / ยืนยันยอด) ═════════════ */
function SettingsView({ data }){
  const st=data.settings||{};
  const [sco,setSco]=useState(st.staffCanOpen!=null?!!st.staffCanOpen:!!(st.pay&&st.pay.staffCanOpen));
  const [vdd,setVdd]=useState(st.verifyDuringDay!=null?!!st.verifyDuringDay:((st.pay&&st.pay.verifyDuringDay)!=null?!!st.pay.verifyDuringDay:true));
  const [msg,setMsg]=useState(''); const roster=(st.staffList||[]);
  const put=async(patch)=>{ setMsg('');
    try{ await KD_API.putSettings(patch); if(data.settings) Object.assign(data.settings,patch); setMsg('บันทึกแล้ว · อัปเดตไปยังลิงก์พนักงานแบบเรียลไทม์ทันที'); }
    catch(e){ setMsg('บันทึกไม่ได้ (โหมดสาธิต/ออฟไลน์)'); } };
  const Toggle=({on,onCh,yes,no,yDesc,nDesc})=>(<div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
    {[[true,yes,yDesc],[false,no,nDesc]].map(([v,lbl,desc])=>{ const act=on===v; return (
      <button key={String(v)} onClick={()=>onCh(v)} style={{flex:'1 1 240px',textAlign:'left',cursor:'pointer',border:'2px solid '+(act?'var(--brand)':'var(--hair-2)'),background:act?'var(--brand-soft)':'#fff',borderRadius:14,padding:'14px 16px'}}>
        <div style={{fontWeight:800,fontSize:14,color:act?'var(--brand-ink)':'var(--ink)'}}>{lbl}</div>
        <div style={{fontSize:12,color:'var(--ink-3)',marginTop:4,lineHeight:1.5}}>{desc}</div>
      </button>); })}
  </div>);
  return (<div style={{maxWidth:820}}>
    <div className="card panel">
      <h3>สิทธิ์เปิด-ปิดร้านของพนักงาน / ผู้จัดการ</h3>
      <p className="sub" style={{margin:'2px 0 14px'}}>เปิด = <b>ผู้จัดการร้าน</b> เห็นปุ่ม “เปิด-ปิดร้าน” บนลิงก์พนักงาน · กดแล้วสถานะอัปเดตแบบเรียลไทม์ถึงพนักงานคนอื่นและลูกค้าทันที (ไม่ต้องรีเฟรช)</p>
      <Toggle on={sco} onCh={v=>{ setSco(v); put({staffCanOpen:v}); }} yes="อนุญาต" no="ไม่อนุญาต"
        yDesc="ผู้จัดการเปิด-ปิดร้านเองได้ + ตอนปิดร้านเห็นสรุปยอด “วันปัจจุบัน” เพื่อนับเงิน (ไม่เห็นรายงานย้อนหลัง/ภาพรวมเจ้าของ)"
        nDesc="เฉพาะเจ้าของร้านเปิด-ปิดร้าน · พนักงานเห็นแต่หน้าขาย/ออเดอร์"/>
    </div>
    <div className="card panel" style={{marginTop:16}}>
      <h3>ยืนยันยอดรับเงิน (ตรวจสลิป/พร้อมเพย์)</h3>
      <p className="sub" style={{margin:'2px 0 14px'}}>คุมว่าพนักงานยืนยันยอดเงินเข้าได้ตอนไหน — ให้ยอดในระบบตรงกับเงินจริง</p>
      <Toggle on={vdd} onCh={v=>{ setVdd(v); put({verifyDuringDay:v}); }} yes="ยืนยันได้ระหว่างวัน" no="ต้องปิดร้านก่อน"
        yDesc="ยืนยันยอดทีละบิลได้ตลอดเวลา — เหมาะกับร้านที่มีบิลโอน/พร้อมเพย์เยอะ ทยอยเช็ก (ค่าเริ่มต้น)"
        nDesc="ยืนยันยอดได้เฉพาะตอนกดปิดร้าน (นับเงินรอบเดียว) — กันพนักงานแก้ยอดระหว่างวัน"/>
    </div>
    <div className="card panel" style={{marginTop:16}}>
      <h3>ทะเบียนพนักงาน — สิทธิ์ปัจจุบัน</h3>
      <p className="sub" style={{marginTop:2}}>LINE MINI App ผูกสิทธิ์กับ LINE User ID · Web App ยืนยันด้วยชื่อ + PIN (4-6 หลัก) ที่เจ้าของตั้งไว้ · แก้ทะเบียน/PIN/สิทธิ์ ในแอปมือถือ → ร้านค้า → พนักงาน</p>
      <table style={{marginTop:8}}><thead><tr><th>ชื่อพนักงาน</th><th className="c">ช่องทาง</th><th className="c">สิทธิ์</th><th className="c">สถานะ</th></tr></thead>
        <tbody>{roster.length?roster.map(s=>(<tr key={s.id}>
          <td style={{fontWeight:600}}>{s.name}{s.phone?<span style={{color:'var(--ink-3)',fontWeight:400}}> · {s.phone}</span>:''}</td>
          <td className="c">{s.line?'LINE':'Web + PIN'}</td>
          <td className="c"><span className={'pill '+(s.role==='manager'?'p-g':'p-n')}>{s.role==='manager'?'ผู้จัดการ':'พนักงาน'}</span></td>
          <td className="c"><span className={'pill '+(s.status==='pending'?'p-y':'p-g')}>{s.status==='pending'?'รออนุมัติ':'ใช้งาน'}</span></td>
        </tr>)):<tr><td colSpan="4" className="empty">ยังไม่มีพนักงานในทะเบียน — เพิ่มได้ในแอปมือถือ</td></tr>}</tbody></table>
    </div>
    {msg && <div style={{marginTop:14,fontSize:12.5,fontWeight:700,color:msg.includes('ไม่ได้')?'var(--red)':'var(--green)'}}>{msg}</div>}
  </div>);
}

/* ═════════════ LOGIN ═════════════ */
function Login({ onDone }){
  const [shop,setShop]=useState(shopFromUrl());
  const [pin,setPin]=useState(''); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
  const lineUid=lineFromEnv();
  const adminTok=(()=>{ try{ return sessionStorage.getItem('kd_admin_tok')||''; }catch(e){ return ''; } })();
  const goAdmin=async ()=>{ setErr(''); setBusy(true);
    try{ const r=await KD_API.adminAccessShop(shop, adminTok); if(r&&r.ok&&r.token){ try{ sessionStorage.setItem('kd_ot_'+shop, r.token); localStorage.setItem('kd_shop',shop); }catch(e){} onDone(shop, r.token, r.shop); } else setErr((r&&r.error)||'เข้าด้วยสิทธิ์แอดมินไม่สำเร็จ'); }
    catch(e){ setErr('เข้าด้วยสิทธิ์แอดมินไม่สำเร็จ'); } finally{ setBusy(false); } };
  React.useEffect(()=>{ try{ const u=new URL(location.href); if(u.searchParams.get('adminAccess')==='1' && adminTok && shop){ goAdmin(); } }catch(e){} },[]);
  const go=async (body)=>{ setErr(''); setBusy(true);
    try{ const r=await KD_API.ownerLogin(shop, body); if(r&&r.ok&&r.token){ try{ sessionStorage.setItem('kd_ot_'+shop, r.token); localStorage.setItem('kd_shop',shop); }catch(e){} onDone(shop, r.token, r.shop); } else setErr((r&&r.error)||'เข้าสู่ระบบไม่สำเร็จ'); }
    catch(e){ setErr('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ลองโหมดตัวอย่างด้านล่าง'); }
    finally{ setBusy(false); } };
  return (<div className="login-wrap"><div className="login-card fade">
    <div className="logo-mk" style={{width:46,height:46,fontSize:24,overflow:'hidden',background:'#fff'}}><img src="assets/kaidee-logo.png" alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
    <h2>ระบบหลังบ้านร้านค้า</h2>
    <div className="lg-sub">รายงานยอดขาย · สต๊อก · สมาชิก — เฉพาะเจ้าของร้าน</div>
    <label>รหัสร้าน (Shop code)</label>
    <input className="field" value={shop} onChange={e=>setShop(e.target.value.trim())} placeholder="เช่น potato-corner"/>
    <label>PIN เจ้าของร้าน</label>
    <input className="field" type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} placeholder="4–8 หลัก" onKeyDown={e=>e.key==='Enter'&&pin&&go({pin})}/>
    <button className="btn pri" style={{width:'100%',marginTop:16,justifyContent:'center',padding:'12px'}} disabled={busy||!pin||!shop} onClick={()=>go({pin})}>{busy?'กำลังตรวจสอบ…':'เข้าสู่ระบบด้วย PIN'}</button>
    {lineUid && <><div className="divider">หรือ</div>
      <button className="btn gh" style={{width:'100%',justifyContent:'center',padding:'11px',borderColor:'#06C755',color:'#048a3d'}} disabled={busy} onClick={()=>go({line:lineUid})}>เข้าด้วย LINE ของเจ้าของ (บัญชีนี้)</button></>}
    {err && <div className="login-err">{err}</div>}
    {adminTok && <><div className="divider">สิทธิ์แอดมินแอป</div>
      <button className="btn gh" style={{width:'100%',justifyContent:'center',padding:'11px',borderColor:'var(--blue,#1E73B0)',color:'var(--blue-ink,#1E73B0)'}} disabled={busy||!shop} onClick={goAdmin}>🔑 เข้าดู Backoffice ร้านนี้ (แอดมิน)</button>
      <div className="sub" style={{marginTop:6,textAlign:'center',fontSize:11}}>เข้าในฐานะเจ้าของแอป · บันทึกประวัติการเข้าถึง (PDPA)</div></>}
    <div className="divider">โหมดสาธิต</div>
    <button className="btn gh" style={{width:'100%',justifyContent:'center'}} onClick={()=>onDone(shop,null,null)}>ดูตัวอย่างด้วยข้อมูลจำลอง →</button>
    <div className="sub" style={{marginTop:14,textAlign:'center',fontSize:11.5}}>ตั้ง PIN ได้จากในแอปมือถือ (ตั้งค่าร้าน) หรือเข้าด้วย LINE เจ้าของครั้งแรกแล้วตั้ง PIN</div>
  </div></div>);
}

/* ═════════════ APP SHELL ═════════════ */
function DocCard({ tpl, shop, emoji }){
  const [partner,setPartner]=useState('');
  const KD=window.KD_DOC; if(!KD) return null;
  const v=KD.vars({ ...shop, partner });
  const preview=KD.fill(tpl.body,v).split('\n').filter(Boolean).slice(0,3).join(' ');
  const origin=(location.origin+location.pathname).replace(/[^/]*$/,'');
  const url=origin+'doc-view.html?doc='+encodeURIComponent(tpl.id)
    +'&name='+encodeURIComponent(v['ชื่อร้าน']||'')
    +'&addr='+encodeURIComponent((shop.address||shop.pay&&shop.pay.taxAddr)||'')
    +'&tax='+encodeURIComponent((shop.pay&&shop.pay.taxId)||'')
    +'&phone='+encodeURIComponent(v['เบอร์']||'')
    +'&emoji='+encodeURIComponent(emoji||'🏪')
    +(partner.trim()?('&partner='+encodeURIComponent(partner.trim())):'');
  const [copied,setCopied]=useState('');
  const copy=()=>{ try{ navigator.clipboard.writeText(url); }catch(e){} setCopied('link'); setTimeout(()=>setCopied(''),1500); };
  const lineText=(v['ชื่อร้าน']||'ร้าน')+' ส่งเอกสาร: '+KD.fill(tpl.title,v)+'\n'+url;
  const sendLine=()=>window.open('https://line.me/R/msg/text/?'+encodeURIComponent(lineText),'_blank');
  const share=async()=>{ try{ if(navigator.share){ await navigator.share({ title:KD.fill(tpl.title,v), text:(v['ชื่อร้าน']||'')+' — '+KD.fill(tpl.title,v), url }); return; } }catch(e){ if(e&&e.name==='AbortError') return; } copy(); };
  return (<div className="card" style={{padding:'16px 18px',display:'flex',flexDirection:'column',gap:10}}>
    <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
      <div style={{width:44,height:44,borderRadius:11,background:'var(--brand-soft,#E9EFF5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flex:'0 0 auto'}}>{tpl.icon||'📄'}</div>
      <div style={{flex:1,minWidth:0}}>
        <span style={{fontSize:11,fontWeight:700,color:'var(--brand-ink,#13304E)',background:'var(--brand-soft,#E9EFF5)',borderRadius:999,padding:'2px 9px'}}>{tpl.cat}</span>
        <div style={{fontSize:15,fontWeight:700,marginTop:6,lineHeight:1.35}}>{KD.fill(tpl.title,v)}</div>
        <div style={{fontSize:12.5,color:'var(--ink-3)',marginTop:4,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{preview}</div>
      </div>
    </div>
    <input className="field" value={partner} onChange={e=>setPartner(e.target.value)} placeholder="ชื่อคู่ค้า/ลูกค้า (ไม่บังคับ — เติมลงในเอกสารให้)" style={{width:'100%',padding:'9px 12px',fontSize:13.5}}/>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <a className="btn pri" href={url} target="_blank" rel="noopener" style={{textDecoration:'none',whiteSpace:'nowrap'}}>👁 ดู / ดาวน์โหลด</a>
      <button className="btn gh" onClick={sendLine} style={{whiteSpace:'nowrap'}}>💬 ส่งผ่าน LINE OA</button>
      <button className="btn gh" onClick={copy} style={{whiteSpace:'nowrap'}}>{copied==='link'?'✓ คัดลอกแล้ว':'🔗 คัดลอกลิงก์'}</button>
      {typeof navigator!=='undefined'&&navigator.share&&<button className="btn gh" onClick={share} style={{whiteSpace:'nowrap'}}>↗ แชร์คู่ค้า</button>}
    </div>
  </div>);
}
/* ═════════════ กระเป๋าเงินร้าน (Wallet) ═════════════ */
const WMONEY=(n)=>'฿'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});
function WalletView({ data }){
  const cfg0=(()=>{ try{ return JSON.parse(localStorage.getItem('kd_bo_wallet_v1'))||{}; }catch(e){ return {}; } })();
  const [mode,setMode]=useState(cfg0.mode||'A');
  const [gpPct,setGpPct]=useState(cfg0.gpPct!=null?cfg0.gpPct:10);
  const [ledger,setLedger]=useState(cfg0.ledger||[]);
  const persist=(m,g,l)=>{ try{ localStorage.setItem('kd_bo_wallet_v1',JSON.stringify({mode:m,gpPct:g,ledger:l})); }catch(e){} };
  const setModeP=(m)=>{ setMode(m); persist(m,gpPct,ledger); };
  const setGpP=(g)=>{ const v=Math.max(0,Number(g)||0); setGpPct(v); persist(mode,v,ledger); };
  const push=(e)=>{ const l=[{id:'w'+Date.now(),at:Date.now(),...e},...ledger]; setLedger(l); persist(mode,gpPct,l); };
  const del=(id)=>{ const l=ledger.filter(x=>x.id!==id); setLedger(l); persist(mode,gpPct,l); };
  const sales=(data&&data.sales)||[];
  const digital=sales.filter(s=>!s.void && ['promptpay','platform'].includes(s.pay) && (s.verified||s.settled||s.paid));
  const grossIn=digital.reduce((a,s)=>a+(Number(s.total)||0),0);
  const cashIn=sales.filter(s=>!s.void && (s.pay==='cash')).reduce((a,s)=>a+(Number(s.total)||0),0);
  const gpAll=Math.round(grossIn*gpPct/100);
  const netIn=grossIn-gpAll;
  const outSum=ledger.reduce((a,e)=>a+(e.amount<0?-e.amount:0),0);
  const remitSum=ledger.filter(e=>e.type==='gp_remit').reduce((a,e)=>a+(-e.amount),0);
  const balanceB=netIn-outSum;              // โมเดล B: เงินสุทธิของร้านที่ถอนได้
  const gpOwed=Math.max(0,gpAll-remitSum);  // โมเดล A: GP ที่ยังต้องนำส่งตลาด
  const ask=(label,type,max)=>{ const v=window.prompt(label+(max!=null?(' (สูงสุด '+WMONEY(max)+')'):'')+' — ใส่จำนวนเงิน (บาท)'); if(v==null)return; const n=Math.round(Number(v)||0); if(n<=0)return; push({type,label,amount:-n}); };
  const TYPE={withdraw:['ถอนเข้าบัญชี','#D8452F'],gp_remit:['นำส่ง GP ให้ตลาด','#0B7A50'],labor:['จ่ายค่าจ้างคนรับจ้าง','#7a4a8c'],topup:['เติมเงินเข้ากระเป๋า','#2C6ECB']};
  const inp={border:'1px solid var(--hair-2)',borderRadius:10,padding:'8px 11px',background:'#fff',outline:'none',fontFamily:'inherit',fontSize:14,width:90};
  return (<div>
    <div className="card" style={{padding:'16px 20px',marginBottom:18,display:'flex',alignItems:'center',gap:18,flexWrap:'wrap'}}>
      <div><div style={{fontSize:12.5,fontWeight:700,color:'var(--ink-2)',marginBottom:6}}>โหมดการเก็บเงิน (เจ้าของตลาดเลือก)</div>
        <div className="seg">
          <button className={mode==='A'?'on':''} onClick={()=>setModeP('A')}>A · ร้านเก็บเอง → นำส่ง GP</button>
          <button className={mode==='B'?'on':''} onClick={()=>setModeP('B')}>B · ระบบเก็บก่อน → โอนคืน T+1</button>
        </div>
      </div>
      <div><div style={{fontSize:12.5,fontWeight:700,color:'var(--ink-2)',marginBottom:6}}>GP %</div>
        <input type="number" style={inp} value={gpPct} onChange={e=>setGpP(e.target.value)}/></div>
      <div style={{flex:1}}/>
      <div style={{fontSize:12.5,color:'var(--ink-3)',maxWidth:280,lineHeight:1.5}}>{mode==='A'?'ร้านรับเงินเอง · ระบบคำนวณ GP ที่ต้องนำส่งตลาด':'เงินเข้าระบบก่อน · ตลาดหัก GP แล้วโอนสุทธิคืนร้าน (T+1)'}</div>
    </div>

    <div className="kpis">
      {mode==='B'
        ? <div className="card kpi"><div style={{fontSize:12.5,color:'var(--ink-3)',fontWeight:700}}>ยอดคงเหลือถอนได้</div><div style={{fontSize:30,fontWeight:800,color:'var(--brand-ink)'}}>{WMONEY(balanceB)}</div><div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:4}}>สุทธิหลังหัก GP + รายการจ่าย</div></div>
        : <div className="card kpi"><div style={{fontSize:12.5,color:'var(--ink-3)',fontWeight:700}}>GP ค้างนำส่งตลาด</div><div style={{fontSize:30,fontWeight:800,color:gpOwed>0?'#B26A00':'var(--brand-ink)'}}>{WMONEY(gpOwed)}</div><div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:4}}>จากยอดขายดิจิทัลสะสม</div></div>}
      <div className="card kpi"><div style={{fontSize:12.5,color:'var(--ink-3)',fontWeight:700}}>ยอดขายผ่านระบบ (ดิจิทัล)</div><div style={{fontSize:30,fontWeight:800}}>{WMONEY(grossIn)}</div><div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:4}}>{digital.length} บิล (ยืนยันแล้ว)</div></div>
      <div className="card kpi"><div style={{fontSize:12.5,color:'var(--ink-3)',fontWeight:700}}>GP {gpPct}% ({mode==='A'?'ต้องนำส่ง':'ตลาดหักแล้ว'})</div><div style={{fontSize:30,fontWeight:800,color:'#B26A00'}}>{WMONEY(gpAll)}</div></div>
      <div className="card kpi"><div style={{fontSize:12.5,color:'var(--ink-3)',fontWeight:700}}>เงินสด (ร้านถือเอง)</div><div style={{fontSize:30,fontWeight:800}}>{WMONEY(cashIn)}</div><div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:4}}>ไม่ผ่านกระเป๋าเงิน</div></div>
    </div>

    <div style={{display:'flex',gap:10,margin:'18px 0',flexWrap:'wrap'}}>
      {mode==='B'
        ? <button className="btn pri" onClick={()=>ask('ถอนเข้าบัญชีธนาคาร','withdraw',balanceB)}>🏦 ถอนเข้าบัญชี</button>
        : <button className="btn pri" onClick={()=>ask('แจ้งโอน GP ให้ตลาด','gp_remit',gpOwed)}>📤 แจ้งโอน GP ให้ตลาด</button>}
      <button className="btn gh" onClick={()=>ask('จ่ายค่าจ้างคนรับจ้าง/ไรเดอร์','labor')}>🧑‍🔧 จ่ายค่าจ้าง (คนรับจ้าง)</button>
      {mode==='B'&&<button className="btn gh" onClick={()=>{ const v=window.prompt('เติมเงินเข้ากระเป๋า — จำนวน (บาท)'); if(v==null)return; const n=Math.round(Number(v)||0); if(n>0)push({type:'topup',label:TYPE.topup[0],amount:n}); }}>➕ เติมเงิน</button>}
    </div>

    <div className="card" style={{padding:'16px 20px'}}>
      <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>ประวัติเงินเข้า-ออก (Ledger)</div>
      <div style={{fontSize:12,color:'var(--ink-3)',marginBottom:10}}>บันทึกทุกรายการแบบเพิ่มต่อท้าย — ตรวจย้อนได้ · เงินจริงอยู่ในบัญชีธนาคาร/ตลาด</div>
      {ledger.length===0&&<div style={{color:'var(--ink-3)',fontSize:13.5,textAlign:'center',padding:'20px 0'}}>ยังไม่มีรายการ — กดปุ่มถอน/นำส่ง/จ่ายค่าจ้างด้านบน</div>}
      {ledger.map(e=>{ const t=TYPE[e.type]||['รายการ','var(--ink-2)']; return (<div key={e.id} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 0',borderBottom:'1px solid var(--hair)'}}>
        <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:14}}>{e.label||t[0]}</div><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{new Date(e.at).toLocaleString('th-TH',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div>
        <div style={{fontWeight:800,fontVariantNumeric:'tabular-nums',color:e.amount<0?'#D8452F':'#0B7A50'}}>{e.amount<0?'-':'+'}{WMONEY(Math.abs(e.amount))}</div>
        <button onClick={()=>del(e.id)} style={{border:'none',cursor:'pointer',background:'#FCECE8',color:'#D8452F',borderRadius:8,padding:'6px 9px'}}>✕</button>
      </div>); })}
    </div>
  </div>);
}

/* ═════════════ ใบเสนอราคา (Quotation) ═════════════ */
const QMONEY=(n)=>'฿'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const BO_QUOTE_PRESETS=[
  ['โปรแกรม POS ร้านค้า',[
    ['โปรแกรม KaiDee POS · รายปี (1 เครื่อง)',1990],
    ['โปรแกรม KaiDee POS · รายปี (3 เครื่อง)',2990],
    ['ค่าติดตั้ง + อบรมใช้งาน (ครั้งเดียว)',1500],
  ]],
  ['โปรแกรมบริหารตลาด',[
    ['โปรแกรมตลาด · S (≤50 แผง) / ปี',9900],
    ['โปรแกรมตลาด · M (≤150 แผง) / ปี',19900],
    ['โปรแกรมตลาด · L (>150 แผง) / ปี',39900],
    ['โมดูลขายฝาก (add-on) / ปี',1490],
  ]],
  ['Vertical ฟิตเนส',[
    ['โปรแกรมฟิตเนส · เริ่มต้น / ปี',1990],
    ['โปรแกรมฟิตเนส · โปร / ปี',4990],
    ['โปรแกรมฟิตเนส · พรีเมียม / ปี',9990],
  ]],
  ['คลาวด์ & SLA',[
    ['คลาวด์ส่วนตัว (Private Cloud) · ตั้งค่าครั้งแรก',9900],
    ['ค่า SLA ดูแลระบบ · รายปี',12000],
    ['ค่า Data/Egress ส่วนเกิน (ตามใช้จริง)',0],
  ]],
  ['ฮาร์ดแวร์ & อื่นๆ',[
    ['เครื่องพิมพ์ใบเสร็จความร้อน 80mm',1290],
    ['ป้าย NFC เช็คอิน (ต่อจุด)',150],
    ['ลิ้นชักเก็บเงิน',990],
  ]],
];
function QuoteView({ data }){
  const st=(data&&data.settings)||{}; const paySet=st.pay||{};
  const [cust,setCust]=useState(''); const [caddr,setCaddr]=useState('');
  const [date,setDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [valid,setValid]=useState(7);
  const [vat,setVat]=useState(false); const [wht,setWht]=useState(false);
  const [discType,setDiscType]=useState('none'); const [discVal,setDiscVal]=useState(0);
  const [note,setNote]=useState('');
  const [sName,setSName]=useState(st.shopName||(st.shopInfo&&st.shopInfo.name)||'ร้านของฉัน');
  const [sAddr,setSAddr]=useState(paySet.addr||(st.shopInfo&&st.shopInfo.address)||'');
  const [sTax,setSTax]=useState(paySet.taxId||'');
  const [sPhone,setSPhone]=useState(paySet.phone||(st.shopInfo&&st.shopInfo.phone)||'');
  const [sBank,setSBank]=useState(()=>{ const p=[]; if(paySet.bank||paySet.acct)p.push([paySet.bank,paySet.acct].filter(Boolean).join(' ')); if(paySet.promptpay)p.push('พร้อมเพย์ '+paySet.promptpay); return p.join(' · '); });
  const [lines,setLines]=useState([]);
  const [quotes,setQuotes]=useState(()=>{ try{ return JSON.parse(localStorage.getItem('kd_bo_quotes_v1'))||[]; }catch(e){ return []; } });
  const saveQuotes=(qs)=>{ setQuotes(qs); try{ localStorage.setItem('kd_bo_quotes_v1',JSON.stringify(qs)); }catch(e){} };
  const qno='QT'+date.replace(/-/g,'')+'-'+String(new Date().getHours())+String(new Date().getMinutes()).padStart(2,'0');
  const addLine=(l)=>setLines(p=>[...p,l||{name:'',qty:1,price:''}]);
  const setLine=(i,k,v)=>setLines(p=>p.map((l,j)=>j===i?{...l,[k]:v}:l));
  const delLine=(i)=>setLines(p=>p.filter((_,j)=>j!==i));
  const subtotal=lines.reduce((a,l)=>a+(Number(l.qty)||0)*(Number(l.price)||0),0);
  const discAmt=discType==='pct'?subtotal*(Number(discVal)||0)/100:discType==='baht'?(Number(discVal)||0):0;
  const afterDisc=Math.max(0,subtotal-discAmt);
  const vatAmt=vat?afterDisc*0.07:0;
  const whtAmt=wht?afterDisc*0.03:0;
  const total=afterDisc+vatAmt-whtAmt;
  const hasItems=lines.some(l=>l.name);
  const reset=()=>{ setLines([]); setCust(''); setCaddr(''); setDiscType('none'); setDiscVal(0); setNote(''); };
  const save=()=>{ if(!hasItems)return; const q={id:'q'+Date.now(),qno,cust,date,total,status:'pending',lines:lines.filter(l=>l.name)}; saveQuotes([q,...quotes]); };
  const setQStatus=(id,s)=>saveQuotes(quotes.map(q=>q.id===id?{...q,status:s}:q));
  const delQ=(id)=>saveQuotes(quotes.filter(q=>q.id!==id));

  const doPrint=()=>{
    const esc=(s)=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const rows=lines.filter(l=>l.name).map((l,i)=>{ const amt=(Number(l.qty)||0)*(Number(l.price)||0);
      return '<tr><td class="c">'+(i+1)+'</td><td>'+esc(l.name)+'</td><td class="c">'+(Number(l.qty)||0)+'</td><td class="r">'+QMONEY(l.price).slice(1)+'</td><td class="r">'+QMONEY(amt).slice(1)+'</td></tr>'; }).join('');
    const dTxt=new Date(date).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});
    const vTxt=new Date(new Date(date).getTime()+(Number(valid)||0)*864e5).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
    const css="*{margin:0;padding:0;box-sizing:border-box}@page{size:A4;margin:16mm}body{font-family:'IBM Plex Sans Thai',sans-serif;color:#1a1a1a;font-size:13px;line-height:1.5}.head{display:flex;justify-content:space-between;border-bottom:2.5px solid #26619C;padding-bottom:14px;margin-bottom:18px}.shop{font-size:20px;font-weight:700;color:#13304E}.sub{color:#666;font-size:12px;margin-top:3px}.doct{font-size:26px;font-weight:800;color:#26619C}.meta{font-size:12px;color:#444;margin-top:6px;text-align:right}.to{background:#EAF0F7;border-radius:8px;padding:12px 14px;margin-bottom:16px}.lbl{font-size:11px;color:#26619C;font-weight:700}table{width:100%;border-collapse:collapse;margin-bottom:14px}th{background:#13304E;color:#fff;font-size:12px;padding:9px 10px;text-align:left}td{padding:9px 10px;border-bottom:1px solid #e5eae7}.c{text-align:center}.r{text-align:right}.tot{width:300px;margin-left:auto}.tot .row{display:flex;justify-content:space-between;padding:5px 2px}.tot .g{border-top:2px solid #26619C;font-size:17px;font-weight:800;color:#13304E;padding-top:9px;margin-top:4px}.note{margin-top:20px;font-size:12px;color:#555;white-space:pre-wrap}.sign{display:flex;justify-content:space-between;margin-top:46px;font-size:12px}.sign div{width:44%;text-align:center;border-top:1px solid #999;padding-top:6px}";
    const body='<div class="head"><div><div class="shop">'+esc(sName)+'</div><div class="sub">'+esc(sAddr)+'</div>'+(sTax?'<div class="sub">เลขภาษี '+esc(sTax)+'</div>':'')+'<div class="sub">โทร '+esc(sPhone)+'</div></div>'
      +'<div style="text-align:right"><div class="doct">ใบเสนอราคา</div><div class="meta"><b>เลขที่</b> '+qno+'<br><b>วันที่</b> '+dTxt+'<br><b>ยืนราคาถึง</b> '+vTxt+'</div></div></div>'
      +'<div class="to"><div class="lbl">เสนอราคาให้</div><div style="font-size:15px;font-weight:700;margin-top:2px">'+esc(cust||'-')+'</div>'+(caddr?'<div class="sub">'+esc(caddr)+'</div>':'')+'</div>'
      +'<table><thead><tr><th class="c" style="width:36px">#</th><th>รายการ</th><th class="c" style="width:52px">จำนวน</th><th class="r" style="width:100px">ราคา/หน่วย</th><th class="r" style="width:110px">จำนวนเงิน</th></tr></thead><tbody>'+rows+'</tbody></table>'
      +'<div class="tot"><div class="row"><span>รวมเป็นเงิน</span><span>'+QMONEY(subtotal)+'</span></div>'
      +(discAmt>0?'<div class="row"><span>ส่วนลด'+(discType==='pct'?' '+discVal+'%':'')+'</span><span>-'+QMONEY(discAmt)+'</span></div>':'')
      +(vat?'<div class="row"><span>ภาษีมูลค่าเพิ่ม 7%</span><span>'+QMONEY(vatAmt)+'</span></div>':'')
      +(wht?'<div class="row"><span>หัก ณ ที่จ่าย 3%</span><span>-'+QMONEY(whtAmt)+'</span></div>':'')
      +'<div class="row g"><span>ยอดชำระสุทธิ</span><span>'+QMONEY(total)+'</span></div>'
      +(vat?'':'<div style="font-size:11px;color:#888;text-align:right;margin-top:4px">* ราคานี้ยังไม่รวมภาษีมูลค่าเพิ่ม</div>')+'</div>'
      +(note?'<div class="note"><b>หมายเหตุ:</b> '+esc(note)+'</div>':'')
      +(sBank?'<div style="margin-top:16px;background:#EAF0F7;border-radius:8px;padding:10px 14px;font-size:12px"><b style="color:#13304E">ชำระเงินโดยโอนเข้า:</b> '+esc(sBank)+'</div>':'')
      +'<div class="sign"><div>'+esc(sName)+'<br><span style="color:#888;font-size:11px">ผู้เสนอราคา</span></div><div><br><br><span style="color:#888;font-size:11px">ผู้อนุมัติ / ลูกค้า</span></div></div>';
    const doc='<!DOCTYPE html><ht'+'ml><he'+'ad><meta charset="utf-8"><ti'+'tle>'+qno+'</ti'+'tle><li'+'nk href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;700;800&display=swap" rel="stylesheet"><sty'+'le>'+css+'</sty'+'le></he'+'ad><bo'+'dy>'+body+'</bo'+'dy></ht'+'ml>';
    try{ const ifr=document.createElement('iframe'); ifr.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      ifr.onload=()=>{ setTimeout(()=>{ try{ ifr.contentWindow.focus(); ifr.contentWindow.print(); }catch(e){} setTimeout(()=>{ try{ document.body.removeChild(ifr); }catch(e){} },900); },400); };
      document.body.appendChild(ifr); const d=ifr.contentWindow.document; d.open(); d.write(doc); d.close(); }catch(e){}
  };

  const inp={border:'1px solid var(--hair-2)',borderRadius:10,padding:'9px 12px',background:'#fff',outline:'none',fontFamily:'inherit',fontSize:14,width:'100%'};
  const lbl={fontSize:12.5,fontWeight:700,color:'var(--ink-2)',margin:'0 0 6px'};
  const stC={pending:['รอเสนอ','var(--ink-2)','#EEF1F0'],won:['ได้งาน','#fff','var(--brand)'],lost:['ไม่ได้','#fff','var(--red,#D8452F)']};
  return (<div style={{display:'flex',gap:20,alignItems:'flex-start'}}>
    <div style={{flex:'1 1 62%',minWidth:0,display:'flex',flexDirection:'column',gap:16}}>
      <div className="card" style={{padding:'18px 20px'}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>ลูกค้า</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><div style={lbl}>ชื่อลูกค้า / บริษัท</div><input style={inp} value={cust} onChange={e=>setCust(e.target.value)} placeholder="เช่น บริษัท ABC จำกัด"/></div>
          <div><div style={lbl}>ที่อยู่ / ผู้ติดต่อ</div><input style={inp} value={caddr} onChange={e=>setCaddr(e.target.value)} placeholder="ที่อยู่ / เบอร์ (ไม่บังคับ)"/></div>
          <div><div style={lbl}>วันที่</div><input type="date" style={inp} value={date} onChange={e=>setDate(e.target.value)}/></div>
          <div><div style={lbl}>ยืนราคา (วัน)</div><input type="number" style={inp} value={valid} onChange={e=>setValid(e.target.value)}/></div>
        </div>
      </div>
      <div className="card" style={{padding:'18px 20px'}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>ผู้เสนอราคา (หัวเอกสาร)</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><div style={lbl}>ชื่อร้าน/บริษัท</div><input style={inp} value={sName} onChange={e=>setSName(e.target.value)}/></div>
          <div><div style={lbl}>เลขผู้เสียภาษี</div><input style={inp} value={sTax} onChange={e=>setSTax(e.target.value)}/></div>
          <div style={{gridColumn:'1 / -1'}}><div style={lbl}>ที่อยู่</div><input style={inp} value={sAddr} onChange={e=>setSAddr(e.target.value)}/></div>
          <div><div style={lbl}>เบอร์ติดต่อ</div><input style={inp} value={sPhone} onChange={e=>setSPhone(e.target.value)}/></div>
          <div><div style={lbl}>บัญชี/พร้อมเพย์รับเงิน</div><input style={inp} value={sBank} onChange={e=>setSBank(e.target.value)}/></div>
        </div>
      </div>
      <div className="card" style={{padding:'18px 20px'}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:10}}>เลือกแพ็กเกจสำเร็จ (กดเพื่อเพิ่มลงใบเสนอราคา)</div>
        {BO_QUOTE_PRESETS.map(([g,items])=>(<div key={g} style={{marginBottom:10}}>
          <div style={{fontSize:12.5,fontWeight:700,color:'var(--brand-ink)',margin:'6px 0'}}>{g}</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {items.map(([nm,pr])=>(<button key={nm} className="btn gh" style={{fontSize:12.5,padding:'7px 12px'}} onClick={()=>addLine({name:nm,qty:1,price:pr})}>+ {nm} {pr>0?'· '+QMONEY(pr).slice(0,-3):''}</button>))}
          </div>
        </div>))}
        <button className="btn gh" style={{marginTop:8}} onClick={()=>addLine()}>+ รายการกำหนดเอง</button>
      </div>
      <div className="card" style={{padding:'18px 20px'}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>รายการ</div>
        {lines.length===0&&<div style={{color:'var(--ink-3)',fontSize:13.5,textAlign:'center',padding:'16px 0'}}>ยังไม่มีรายการ — เลือกแพ็กเกจด้านบน หรือกด “รายการกำหนดเอง”</div>}
        <div style={{display:'flex',flexDirection:'column',gap:9}}>
          {lines.map((l,i)=>{ const amt=(Number(l.qty)||0)*(Number(l.price)||0); return (
            <div key={i} style={{display:'flex',gap:8,alignItems:'center'}}>
              <input style={{...inp,flex:1}} value={l.name} onChange={e=>setLine(i,'name',e.target.value)} placeholder="ชื่อรายการ"/>
              <input type="number" style={{...inp,width:64,textAlign:'center'}} value={l.qty} onChange={e=>setLine(i,'qty',e.target.value)}/>
              <input type="number" style={{...inp,width:110}} value={l.price} onChange={e=>setLine(i,'price',e.target.value)} placeholder="ราคา"/>
              <span style={{width:110,textAlign:'right',fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{QMONEY(amt)}</span>
              <button className="btn gh" style={{padding:'8px 10px'}} onClick={()=>delLine(i)}>✕</button>
            </div>); })}
        </div>
        <div style={{display:'flex',gap:10,marginTop:14,alignItems:'center',flexWrap:'wrap'}}>
          <div style={lbl}>ส่วนลด:</div>
          <div className="seg">{[['none','ไม่มี'],['pct','%'],['baht','บาท']].map(([k,l])=><button key={k} className={discType===k?'on':''} onClick={()=>setDiscType(k)}>{l}</button>)}</div>
          {discType!=='none'&&<input type="number" style={{...inp,width:120}} value={discVal} onChange={e=>setDiscVal(e.target.value)} placeholder="0"/>}
        </div>
        <div style={{display:'flex',gap:20,marginTop:12}}>
          <label style={{display:'flex',gap:7,alignItems:'center',fontSize:13.5,fontWeight:600,cursor:'pointer'}}><input type="checkbox" checked={vat} onChange={e=>setVat(e.target.checked)}/> คิด VAT 7%</label>
          <label style={{display:'flex',gap:7,alignItems:'center',fontSize:13.5,fontWeight:600,cursor:'pointer'}}><input type="checkbox" checked={wht} onChange={e=>setWht(e.target.checked)}/> หัก ณ ที่จ่าย 3%</label>
        </div>
        <div style={{marginTop:14}}><div style={lbl}>หมายเหตุ (เงื่อนไข/การชำระ)</div><textarea rows={2} style={{...inp,resize:'none'}} value={note} onChange={e=>setNote(e.target.value)} placeholder="เช่น มัดจำ 50% · ยืนราคา 7 วัน"/></div>
      </div>
    </div>

    <div style={{flex:'1 1 38%',minWidth:280,position:'sticky',top:12,display:'flex',flexDirection:'column',gap:16}}>
      <div className="card" style={{padding:'20px 22px'}}>
        <div style={{fontSize:12.5,color:'var(--ink-3)',fontWeight:700}}>เลขที่ {qno}</div>
        {[['รวมเป็นเงิน',subtotal],...(discAmt>0?[['ส่วนลด',-discAmt]]:[]),...(vat?[['VAT 7%',vatAmt]]:[]),...(wht?[['หัก ณ ที่จ่าย 3%',-whtAmt]]:[])].map(([k,v],i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:14,color:'var(--ink-2)'}}><span>{k}</span><span style={{fontVariantNumeric:'tabular-nums'}}>{QMONEY(v)}</span></div>))}
        <div style={{display:'flex',justifyContent:'space-between',paddingTop:10,marginTop:6,borderTop:'2px solid var(--brand)',fontSize:20,fontWeight:800,color:'var(--brand-ink)'}}><span>ยอดสุทธิ</span><span style={{fontVariantNumeric:'tabular-nums'}}>{QMONEY(total)}</span></div>
        <div style={{display:'flex',gap:10,marginTop:16}}>
          <button className="btn gh" style={{flex:1,justifyContent:'center'}} disabled={!hasItems} onClick={save}>💾 บันทึก</button>
          <button className="btn pri" style={{flex:1.3,justifyContent:'center'}} disabled={!hasItems} onClick={doPrint}>🧾 พิมพ์ / PDF</button>
        </div>
        <button className="btn gh" style={{width:'100%',justifyContent:'center',marginTop:8}} onClick={reset}>เริ่มใบใหม่</button>
      </div>
      <div className="card" style={{padding:'18px 20px'}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:10}}>ใบเสนอราคาที่บันทึก {quotes.length?'· '+quotes.length:''}</div>
        {quotes.length===0&&<div style={{color:'var(--ink-3)',fontSize:13,textAlign:'center',padding:'14px 0'}}>ยังไม่มี — กด “บันทึก” เพื่อเก็บติดตามผล</div>}
        {quotes.map(q=>{ const s=stC[q.status||'pending']; return (<div key={q.id} style={{padding:'10px 0',borderBottom:'1px solid var(--hair)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:14}}>{q.cust||'(ไม่ระบุลูกค้า)'}</div><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{q.qno} · {q.date}</div></div>
            <div style={{fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{QMONEY(q.total)}</div>
          </div>
          <div style={{display:'flex',gap:6,marginTop:8,alignItems:'center'}}>
            {['pending','won','lost'].map(k=>{ const c=stC[k]; const on=(q.status||'pending')===k; return <button key={k} onClick={()=>setQStatus(q.id,k)} style={{flex:1,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:11.5,padding:'6px',borderRadius:8,background:on?c[2]:'#EEF1F0',color:on?c[1]:'var(--ink-3)'}}>{c[0]}</button>; })}
            <button onClick={()=>delQ(q.id)} style={{border:'none',cursor:'pointer',background:'#FCECE8',color:'var(--red,#D8452F)',borderRadius:8,padding:'6px 9px'}}>✕</button>
          </div>
        </div>); })}
      </div>
    </div>
  </div>);
}

function DocsView({ data, auth }){
  const KD=window.KD_DOC;
  const st=data.settings||{}; const pay=st.pay||{};
  const info=(auth&&auth.shopInfo)||{};
  const shop={ name:info.name||pay.shopName||(auth&&auth.shop)||'ร้านของคุณ', address:pay.taxAddr||info.address||'', phone:info.phone||pay.phone||'', pay };
  const emoji=info.emoji||'🏪';
  const tpls=KD?KD.load().filter(t=>t.enabled!==false):[];
  return (<div>
    <div className="card" style={{padding:'15px 18px',marginBottom:16,background:'var(--brand-softer,#F1F5F9)',border:'none',display:'flex',gap:12,alignItems:'flex-start'}}>
      <span style={{fontSize:22}}>💡</span>
      <div style={{fontSize:13.5,color:'var(--ink-2)',lineHeight:1.6}}>เอกสารเติม <b>ชื่อร้าน/ที่อยู่/เลขภาษี/เบอร์ ของ “{shop.name}”</b> ให้อัตโนมัติ — กด <b>ส่ง LINE OA</b> ให้ลูกค้า/คู่ค้า หรือ <b>ดาวน์โหลด/แชร์ลิงก์</b> ได้ทันที · ต้นแบบกลางดูแลโดยทีม KaiDee — ร้านควรตรวจทานเนื้อหาก่อนใช้จริง</div>
    </div>
    {!KD && <div className="card" style={{padding:20,color:'var(--ink-3)'}}>โหลดคลังเอกสารไม่สำเร็จ (doc-templates.js)</div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:16}}>
      {tpls.map(t=><DocCard key={t.id} tpl={t} shop={shop} emoji={emoji}/>)}
    </div>
    {KD&&tpls.length===0 && <div className="card" style={{padding:30,textAlign:'center',color:'var(--ink-3)'}}>ยังไม่มีเอกสารที่เปิดใช้ — แอดมินแอปจะเปิดเอกสารให้</div>}
  </div>);
}
/* ═════════════ VAT / TAX REPORTS (ภาษีขาย · ภาษีซื้อ · ภ.พ.30) ═════════════ */
function VatView({ data }){
  const pay=(data.settings&&data.settings.pay)||{};
  const rate=(Number(pay.vatRate)||7)/100;
  const vatOn = pay.vatMode && pay.vatMode!=='off';
  const [mon,setMon]=useState(()=>isoDay(0).slice(0,7));
  const [view,setView]=useState('out'); // out | in | pp30
  const inMon=(d)=> String(d||'').slice(0,7)===mon;
  // ภาษีขาย (output)
  const outRecs=data.sales.filter(s=>nonVoid(s)&&inMon(s.date)).sort((a,b)=>((a.date||'')+(a.t||'')).localeCompare((b.date||'')+(b.t||'')))
    .map(s=>{ const g=saleTotal(s); const base=(s.vatBase!=null?Number(s.vatBase):g/(1+rate)); const vat=(s.vat!=null?Number(s.vat):g-base); return {s,g,base,vat}; });
  const oB=outRecs.reduce((a,x)=>a+x.base,0), oV=outRecs.reduce((a,x)=>a+x.vat,0), oG=outRecs.reduce((a,x)=>a+x.g,0);
  // ภาษีซื้อ (input)
  const inRecs=(data.purchases||[]).filter(p=>p.hasVat&&inMon(p.date)).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')))
    .map(p=>{ const base=Number(p.vatBase)||0, vat=Number(p.vat)||0; return {p,base,vat,g:base+vat}; });
  const iB=inRecs.reduce((a,x)=>a+x.base,0), iV=inRecs.reduce((a,x)=>a+x.vat,0), iG=inRecs.reduce((a,x)=>a+x.g,0);
  const net=oV-iV;
  const monTxt=mon.split('-')[1]+'/'+mon.split('-')[0];
  const exOut=()=>downloadCSV('vat-sales-'+mon+'.csv',[['วันที่','เลขที่ใบกำกับ','ช่องทาง','มูลค่าก่อน VAT','VAT','รวม']]
    .concat(outRecs.map(x=>[x.s.date||'',x.s.no?('#'+x.s.no):'',chName(x.s.channel),x.base.toFixed(2),x.vat.toFixed(2),x.g.toFixed(2)]))
    .concat([['รวมทั้งเดือน','','',oB.toFixed(2),oV.toFixed(2),oG.toFixed(2)]]));
  const exIn=()=>downloadCSV('vat-purchases-'+mon+'.csv',[['วันที่','ผู้ขาย/หมายเหตุ','เลขผู้เสียภาษี','มูลค่าก่อน VAT','VAT','รวม']]
    .concat(inRecs.map(x=>[x.p.date||'',x.p.note||'',x.p.supplierTaxId||'',x.base.toFixed(2),x.vat.toFixed(2),x.g.toFixed(2)]))
    .concat([['รวมทั้งเดือน','','',iB.toFixed(2),iV.toFixed(2),iG.toFixed(2)]]));
  const exPP=()=>downloadCSV('pp30-'+mon+'.csv',[['รายการ','จำนวน'],['ยอดขาย (ก่อน VAT)',oB.toFixed(2)],['ภาษีขาย',oV.toFixed(2)],['ยอดซื้อ (ก่อน VAT)',iB.toFixed(2)],['ภาษีซื้อ',iV.toFixed(2)],[net>=0?'ภาษีที่ต้องชำระ':'ภาษีชำระเกิน',Math.abs(net).toFixed(2)]]);
  return (<div className="fade">
    {!vatOn && <div style={{background:'var(--gold-soft)',color:'#9A6410',padding:'11px 15px',borderRadius:12,marginBottom:16,fontSize:13.5,fontWeight:600}}>ร้านนี้ยังไม่เปิดคิด VAT (ตั้งค่ารับเงินในแอป) — รายงานคำนวณจากเรต {Math.round(rate*100)}% เพื่อดูตัวอย่าง</div>}
    <div className="toolbar" style={{gap:12}}>
      <div className="seg">{[['out','ภาษีขาย (Output)'],['in','ภาษีซื้อ (Input)'],['pp30','สรุป ภ.พ.30']].map(([k,l])=><button key={k} className={view===k?'on':''} onClick={()=>setView(k)}>{l}</button>)}</div>
      <div className="grow"/>
      <input type="month" className="field" style={{maxWidth:170}} value={mon} max={isoDay(0).slice(0,7)} onChange={e=>setMon(e.target.value||mon)}/>
      <button className="btn gh" onClick={view==='out'?exOut:view==='in'?exIn:exPP}>⬇ CSV</button>
    </div>
    {view==='out' && <>
      <div className="kpis">
        <Kpi label="มูลค่าก่อน VAT" value={B(oB)} foot={monTxt}/>
        <Kpi label={'ภาษีขาย (Output '+Math.round(rate*100)+'%)'} value={B(oV)} tone="var(--brand-ink)" foot="ยอดยื่น ภ.พ.30"/>
        <Kpi label="รวมทั้งสิ้น" value={B(oG)} foot={outRecs.length+' ใบ'}/>
      </div>
      <div className="card" style={{overflow:'hidden'}}>
        <table><thead><tr><th>วันที่</th><th>เลขที่ใบกำกับ</th><th>ช่องทาง</th><th className="r">ก่อน VAT</th><th className="r">VAT</th><th className="r">รวม</th></tr></thead>
          <tbody>{outRecs.length?outRecs.map((x,i)=><tr key={i}><td>{x.s.date}</td><td>{x.s.no?('#'+x.s.no):'—'}</td><td>{chName(x.s.channel)}</td><td className="r num">{x.base.toFixed(2)}</td><td className="r num">{x.vat.toFixed(2)}</td><td className="r num">{x.g.toFixed(2)}</td></tr>)
            :<tr><td colSpan="6" className="empty">ไม่มีบิลในเดือนนี้</td></tr>}</tbody>
          {outRecs.length>0 && <tfoot><tr style={{fontWeight:700,background:'var(--brand-softer)'}}><td colSpan="3">รวมทั้งเดือน</td><td className="r num">{oB.toFixed(2)}</td><td className="r num">{oV.toFixed(2)}</td><td className="r num">{oG.toFixed(2)}</td></tr></tfoot>}
        </table>
      </div>
      <div className="sub" style={{marginTop:10}}>นำยอด “ภาษีขาย” ไปกรอกแบบ ภ.พ.30 (ยื่นภายในวันที่ 15 ของเดือนถัดไป){pay.taxId?(' · เลขผู้เสียภาษี '+pay.taxId):''}</div>
    </>}
    {view==='in' && <>
      <div className="kpis">
        <Kpi label="มูลค่าก่อน VAT" value={B(iB)} foot={monTxt}/>
        <Kpi label="ภาษีซื้อ (Input)" value={B(iV)} tone="var(--gold)" foot="หักในแบบ ภ.พ.30"/>
        <Kpi label="รวมทั้งสิ้น" value={B(iG)} foot={inRecs.length+' ใบ'}/>
      </div>
      <div className="card" style={{overflow:'hidden'}}>
        <table><thead><tr><th>วันที่</th><th>ผู้ขาย/หมายเหตุ</th><th>เลขผู้เสียภาษี</th><th className="r">ก่อน VAT</th><th className="r">VAT</th><th className="r">รวม</th></tr></thead>
          <tbody>{inRecs.length?inRecs.map((x,i)=><tr key={i}><td>{x.p.date}</td><td>{x.p.note||'—'}</td><td className="mono" style={{fontSize:12}}>{x.p.supplierTaxId||'—'}</td><td className="r num">{x.base.toFixed(2)}</td><td className="r num">{x.vat.toFixed(2)}</td><td className="r num">{x.g.toFixed(2)}</td></tr>)
            :<tr><td colSpan="6" className="empty">ไม่มีบิลซื้อที่มีใบกำกับภาษีในเดือนนี้</td></tr>}</tbody>
          {inRecs.length>0 && <tfoot><tr style={{fontWeight:700,background:'var(--brand-softer)'}}><td colSpan="3">รวมทั้งเดือน</td><td className="r num">{iB.toFixed(2)}</td><td className="r num">{iV.toFixed(2)}</td><td className="r num">{iG.toFixed(2)}</td></tr></tfoot>}
        </table>
      </div>
      <div className="sub" style={{marginTop:10}}>นับเฉพาะบิลซื้อที่ติ๊ก “มีใบกำกับภาษี” ตอนบันทึกซื้อของในแอป · นำยอด “ภาษีซื้อ” ไปหักในแบบ ภ.พ.30</div>
    </>}
    {view==='pp30' && <>
      <div className="kpis">
        <Kpi label="ภาษีขาย (Output)" value={B(oV)} tone="var(--brand-ink)"/>
        <Kpi label="ภาษีซื้อ (Input)" value={B(iV)} tone="var(--gold)"/>
        <Kpi label={net>=0?'ภาษีที่ต้องชำระ':'ภาษีชำระเกิน (ยกไป)'} value={B(Math.abs(net))} tone={net>=0?'var(--red)':'var(--green)'} foot="ขาย − ซื้อ"/>
      </div>
      <div className="card panel" style={{maxWidth:560}}>
        <h3 style={{marginTop:0}}>สรุปยื่นแบบ ภ.พ.30 · {monTxt}{pay.taxId?(' · เลขผู้เสียภาษี '+pay.taxId):''}</h3>
        <div style={{fontSize:14}}>
          <div className="barrow" style={{justifyContent:'space-between'}}><span>ยอดขาย (ก่อน VAT)</span><b className="num">{oB.toFixed(2)}</b></div>
          <div className="barrow" style={{justifyContent:'space-between',color:'var(--brand-ink)'}}><span><b>ภาษีขาย (Output Tax)</b></span><b className="num">{oV.toFixed(2)}</b></div>
          <div className="barrow" style={{justifyContent:'space-between'}}><span>ยอดซื้อ (ก่อน VAT)</span><b className="num">{iB.toFixed(2)}</b></div>
          <div className="barrow" style={{justifyContent:'space-between',color:'var(--gold)'}}><span><b>ภาษีซื้อ (Input Tax)</b></span><b className="num">{iV.toFixed(2)}</b></div>
          <div className="barrow" style={{justifyContent:'space-between',borderTop:'2px solid var(--ink)',marginTop:6,paddingTop:12,fontSize:16}}><span><b>{net>=0?'ภาษีที่ต้องชำระ':'ภาษีชำระเกิน (ยกไปเดือนหน้า)'}</b></span><b className="num" style={{color:net>=0?'var(--red)':'var(--green)'}}>{Math.abs(net).toFixed(2)}</b></div>
        </div>
        <div className="sub" style={{marginTop:14}}>ภาษีขาย − ภาษีซื้อ = ยอดที่ต้องชำระต่อสรรพากร · ยื่น ภ.พ.30 ภายในวันที่ 15 ของเดือนถัดไป (ยื่นออนไลน์ถึงสิ้นเดือน)</div>
      </div>
    </>}
  </div>);
}

const RANGES=[['today','วันนี้',0],['7','7 วัน',6],['30','30 วัน',29]];

/* ═══ สถิติผู้ใช้แอป + แนะราคาแพ็กสปอนเซอร์ (ดันนามิกตามฐานผู้ใช้) ═══ */
const SP_TIERS=[
  {max:300,  name:'เปิดตัว (Early)',  tone:'var(--brand)', p:[490,1490,2900],  note:'ฐานผู้ใช้ยังน้อย — ตั้งราคาถูกจับต้องได้ ดึงสปอนเจ้าแรกๆ มาลองก่อน'},
  {max:1000, name:'เติบโต (Growth)', tone:'var(--blue)',  p:[990,2900,5900],  note:'คนใช้แอปเริ่มเยอะ — ขยับราคาขึ้นได้ ยังถูกกว่าค่า GP มาก'},
  {max:3000, name:'ขยาย (Scale)',   tone:'var(--gold)',  p:[1900,4900,9900], note:'reach สูง สปอนเห็นผลชัด — ราคาสะท้อนช่องทางขายจริง'},
  {max:Infinity, name:'ตลาดโต (Mature)', tone:'var(--purple)', p:[2900,7900,14900], note:'ฐานใหญ่ · ตั้งราคาเชิงมูลค่า + แพ็ก Enterprise'},
];
const PKG_NAMES=['Starter','Growth','Premium'];
function SponsorStatsView({ data }){
  const st0=(()=>{ try{ return JSON.parse(localStorage.getItem('kd_platform_stats_v1'))||{}; }catch(e){ return {}; } })();
  const [users,setUsers]=useState(st0.users||420);
  React.useEffect(()=>{ if(!window.PLAT_API) return;
    const sync=window.PLAT_API.attach({ biz:'platform', type:'platform', key:'stats',
      read:()=>{try{return JSON.parse(localStorage.getItem('kd_platform_stats_v1'))||{users:420}}catch(e){return {users:420}}},
      write:(b)=>{try{if(b)localStorage.setItem('kd_platform_stats_v1',JSON.stringify(b))}catch(e){}},
      onRemote:(b)=>{ if(b&&b.users!=null) setUsers(b.users); }, stamp:(b)=>(b&&b.updatedAt)||0 });
    window.__platStatsSync=sync; return ()=>{ try{sync.stop();}catch(e){} window.__platStatsSync=null; };
  },[]);
  const save=(u)=>{ setUsers(u); try{ localStorage.setItem('kd_platform_stats_v1',JSON.stringify({users:u,updatedAt:Date.now()})); }catch(e){} if(window.__platStatsSync)window.__platStatsSync.push(); };
  const tierIdx=SP_TIERS.findIndex(t=>users<=t.max); const tier=SP_TIERS[tierIdx]; const next=SP_TIERS[tierIdx+1];
  // reach & ROI (ประมาณการ)
  const opensMo=Math.round(users*8);              // เปิดแอป/เดือน (เห็นสปอน)
  const estOrders=Math.round(opensMo*0.02);        // คลิก→สั่ง 2%
  const avgBasket=150; const estSales=estOrders*avgBasket;
  const gpCost=Math.round(estSales*0.30);          // ถ้าขายผ่าน Grab/LINE MAN GP 30%
  const growthPrice=tier.p[1];
  const save30=gpCost-growthPrice;
  // นับจริงจาก data (ร้านเดียว) — โชว์เป็นตัวอย่างฐานจริง
  const myMembers=(data&&data.members&&data.members.length)||0;
  return (<div className="fade">
    <div className="card" style={{background:'linear-gradient(135deg,#16302B,#0E5C4A)',color:'#fff',marginBottom:16}}>
      <div style={{fontSize:13,opacity:.85}}>ช่วงราคาตอนนี้ (ตามฐานผู้ใช้)</div>
      <div style={{fontSize:26,fontWeight:800,margin:'4px 0'}}>{tier.name}</div>
      <div style={{fontSize:13,opacity:.9,lineHeight:1.5}}>{tier.note}</div>
    </div>
    <div className="kpis">
      <Kpi label="ผู้ใช้แอปทั้งหมด" value={users.toLocaleString()} foot="ร้าน+ลูกค้า+สมาชิก+วิน"/>
      <Kpi label="เปิดแอป/เดือน (reach)" value={opensMo.toLocaleString()} tone="var(--blue)" foot="โอกาสเห็นโฆษณาสปอน"/>
      <Kpi label="คาดออเดอร์สปอน/เดือน" value={estOrders.toLocaleString()} tone="var(--brand)" foot={'≈ '+B(estSales)+' ยอดขาย'}/>
      <Kpi label="สมาชิกร้านนี้" value={myMembers.toLocaleString()} foot="ฐานลูกค้าของคุณ"/>
    </div>
    <div className="card" style={{marginTop:16}}>
      <h3 style={{margin:'0 0 4px'}}>จำลองฐานผู้ใช้ → ดูราคาที่ควรตั้ง</h3>
      <div className="sub" style={{marginBottom:12}}>เลื่อนดูว่าถ้าคนใช้แอปเยอะขึ้น ระบบแนะราคาแพ็กสปอนควรเป็นเท่าไหร่</div>
      <input type="range" min="100" max="5000" step="50" value={users} onChange={e=>save(Number(e.target.value))} style={{width:'100%',accentColor:tier.tone}}/>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--ink-3)'}}><span>100</span><span style={{fontWeight:700,color:tier.tone}}>{users.toLocaleString()} คน</span><span>5,000</span></div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginTop:16}}>
      {SP_TIERS.map((t,i)=>{ const on=i===tierIdx; return (
        <div key={i} className="card" style={{border:on?('2px solid '+t.tone):'1px solid var(--hair)',opacity:on?1:.72,padding:'13px'}}>
          <div style={{fontSize:12,fontWeight:800,color:t.tone}}>{t.name}{on&&' ← ตอนนี้'}</div>
          <div style={{fontSize:11,color:'var(--ink-3)',margin:'2px 0 9px'}}>≤ {t.max===Infinity?'3,000+':t.max.toLocaleString()} คน</div>
          {t.p.map((pr,j)=><div key={j} style={{display:'flex',justifyContent:'space-between',fontSize:12.5,padding:'3px 0'}}><span style={{color:'var(--ink-3)'}}>{PKG_NAMES[j]}</span><b>{B(pr)}</b></div>)}
        </div>);})}
    </div>
    {next&&<div className="card" style={{marginTop:14,background:'var(--gold-soft)',color:'#9A6410'}}>💡 <b>ปรับราคาขึ้นเมื่อถึง {(tier.max+1).toLocaleString()} คน</b> (อีก {Math.max(0,tier.max+1-users).toLocaleString()} คน) → ขยับไปทีเออร์ “{next.name}”</div>}
    <div className="card" style={{marginTop:16}}>
      <h3 style={{margin:'0 0 8px'}}>ทำไมสปอนเซอร์ถึงคุ้ม — เทียบ GP เดลิเวอรี</h3>
      <div className="sub" style={{marginBottom:12}}>สปอนมอง“ช่องทางขายเพิ่ม” — จ่ายค่าสปอนคงที่ ไม่โดน GP 30% ต่อบิลเหมือน Grab/LINE MAN</div>
      <div className="kpis">
        <Kpi label="ถ้าขายผ่านแอป โดน GP 30%" value={B(gpCost)} tone="var(--red)" foot={'จากยอดขายประมาณ '+B(estSales)+'/เดือน'}/>
        <Kpi label="ค่าสปอน Growth (คงที่)" value={B(growthPrice)} tone="var(--brand)" foot="จ่ายเท่าเดิมทุกเดือน"/>
        <Kpi label="ประหยัดกว่า GP" value={save30>0?B(save30):'—'} tone="var(--green)" foot={save30>0?'ต่อเดือน ถ้าขายได้ตามคาด':'ขายเยอะขึ้นจะคุ้มกว่า'}/>
      </div>
      <div style={{background:'var(--brand-soft)',color:'var(--brand-ink)',borderRadius:12,padding:'12px 14px',marginTop:12,fontSize:13,lineHeight:1.55}}>✅ จุดขายของแอป: สปอนเสียแค่ <b>ค่าแพ็กคงที่</b> — ขายได้ไม่จำกัด ไม่โดนหัก GP ต่อบิลแบบเดลิเวอรีเจ้าอื่น · เหมาะเป็น <b>ช่องทางขายเสริม</b> ไม่ใช่ช่องทางหลักที่ต้องจ่ายแพง</div>
    </div>
  </div>);
}

function App(){
  const [auth,setAuth]=useState(null);   // { shop, token, shopInfo } | null
  const [data,setData]=useState(null);
  const [tab,setTab]=useState('sales');
  const [rk,setRk]=useState('30'); const [cf,setCf]=useState(''); const [ct,setCt]=useState('');
  const [demo,setDemo]=useState(false);
  const [pkg,setPkg]=useState(null);
  useEffect(()=>{ if(KD_API.getPackages) KD_API.getPackages().then(p=>setPkg(p)).catch(()=>{}); },[]);
  const consignOn = demo || !(auth&&auth.token) || (window.kdConsignEnabled ? window.kdConsignEnabled((auth&&auth.shopInfo)||{}, pkg) : true);
  useEffect(()=>{ if(tab==='consign' && !consignOn) setTab('sales'); },[consignOn,tab]);

  useEffect(()=>{ // auto-resume owner token
    const sh=shopFromUrl(); let tok=null; try{ tok=sessionStorage.getItem('kd_ot_'+sh); }catch(e){}
    if(tok){ KD_API.ownerVerify(sh,tok).then(r=>{ if(r&&r.ok) setAuth({shop:sh,token:tok}); }).catch(()=>{}); }
  },[]);

  useEffect(()=>{ if(!auth) return; try{ KD_API.setShop&&KD_API.setShop(auth.shop); }catch(e){}
    setData(null); loadReportData(auth.shop, auth.token).then(d=>{ setDemo(!auth.token); setData(d); }); },[auth]);

  if(!auth) return <Login onDone={(shop,token,shopInfo)=>setAuth({shop,token,shopInfo})}/>;
  if(!data) return <div className="login-wrap" style={{background:'var(--bg)'}}><div style={{color:'var(--ink-3)',fontWeight:600}}>กำลังโหลดข้อมูลร้าน…</div></div>;

  const range = rk==='custom' ? {from:cf||isoDay(30),to:ct||isoDay(0)} : (()=>{ const r=RANGES.find(x=>x[0]===rk)||RANGES[2]; return {from:isoDay(r[2]),to:isoDay(0)}; })();
  const patchSale=(id,patch)=>{ setData(d=> d?{...d, sales:d.sales.map(s=> s.id===id?{...s,...patch}:s)}:d); if(!demo){ try{ KD_API.patchSale&&KD_API.patchSale(id,patch).catch(()=>{}); }catch(e){} } };
  const platSales=(()=>{ try{ return (JSON.parse(localStorage.getItem('kd_platform_control_v1')||'{}').sales)||{}; }catch(e){ return {}; } })();
  const NAV=[['sales','📊','ยอดขาย & กำไร'],['sponsor','📣','สปอนเซอร์ & ราคาแพ็ก'],['quote','🧾','ใบเสนอราคา'],['wallet','👛','กระเป๋าเงินร้าน'],['menu','🍽️','สินค้า / เมนู'],['stock','📦','สต๊อกสินค้า'],['consign','🤝','สินค้าขายฝาก'],['members','👥','สมาชิก (CRM)'],['verify','✅','ตรวจยอดพร้อมเพย์'],['txn','🧾','รายงานเงินเข้า'],['reconcile','💰','กระทบยอดเดลิเวอรี'],['docs','📄','เอกสารร้านค้า'],['settings','⚙️','ตั้งค่า & สิทธิ์'],['copyright','©️','คู่มือลิขสิทธิ์']].filter(([k])=> (k!=='consign' || consignOn) && platSales[k]!==false);  const shopName=(auth.shopInfo&&auth.shopInfo.name)||(data.settings&&data.settings.pay&&data.settings.pay.shopName)||auth.shop;
  const logout=()=>{ try{ sessionStorage.removeItem('kd_ot_'+auth.shop); }catch(e){} setAuth(null); setData(null); };

  return (<div className="app">
    <div className="side">
      <div className="logo"><div className="logo-mk" style={{overflow:'hidden',background:'#fff'}}><img src="assets/kaidee-logo.png" alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div><div className="logo-tx">ระบบหลังบ้าน<small>{shopName}</small></div></div>
      {NAV.map(([k,ic,l])=><button key={k} className={'nav'+(tab===k?' on':'')} onClick={()=>setTab(k)}><span className="ic">{ic}</span>{l}</button>)}
      <div className="side-foot">{demo?'⚠️ โหมดสาธิต (ข้อมูลจำลอง)':'🔒 เข้าถึงระดับเจ้าของร้าน'}<br/>ล็อกสิทธิ์ฝั่ง server<br/><span style={{opacity:.7}}>© 2026 KaiDee POS · สงวนลิขสิทธิ์</span></div>
    </div>
    <div className="main">
      <div className="topbar">
        <div><h1>{tab==='sponsor'?'สปอนเซอร์ & ราคาแพ็ก':tab==='wallet'?'กระเป๋าเงินร้าน (Wallet)':tab==='quote'?'ใบเสนอราคา':tab==='sales'?'รายงานยอดขาย':tab==='menu'?'สินค้า / เมนู':tab==='stock'?'รายงานคลังสินค้า':tab==='consign'?'สินค้าขายฝาก (Consignment)':tab==='members'?'จัดการสมาชิก':tab==='verify'?'ตรวจยอดพร้อมเพย์':tab==='txn'?'รายงานเงินเข้า':tab==='reconcile'?'กระทบยอดเดลิเวอรี':tab==='docs'?'เอกสารร้านค้า':tab==='copyright'?'คู่มือจดลิขสิทธิ์':'ตั้งค่า & สิทธิ์'}</h1>
          <div className="sub">{tab==='sponsor'?'สถิติผู้ใช้แอป → ระบบแนะราคาแพ็กสปอนเซอร์ตามฐานผู้ใช้ + ROI เทียบ GP':tab==='wallet'?'ยอดคงเหลือ · GP · ถอน/นำส่ง · เลือกโหมด A/B':tab==='quote'?'สร้างใบเสนอราคา · เลือกแพ็กเกจสำเร็จ · VAT/หัก ณ ที่จ่าย · พิมพ์/PDF':tab==='sales'?'สรุปยอด กำไร VAT และแนวโน้มการขาย':tab==='menu'?'ต้นทุน-กำไรต่อเมนู และยอดขายรายเมนู':tab==='stock'?'สต๊อกคงเหลือ + ประวัติความเคลื่อนไหว':tab==='consign'?'คลังขายฝากแยกส่วน · ใบส่งของ · เคลียร์เงินคืน Vendor':tab==='members'?'ฐานลูกค้าสมาชิกและแต้มสะสม':tab==='verify'?'เทียบยอดในระบบกับเงินเข้าบัญชีจริง · แจ้งขาด/เกิน · ยืนยันย้อนหลังได้':tab==='txn'?'รายการเงินเข้าจริงต่อบิล ทุกช่องทาง — ชุดข้อมูลเดียวกับหน้าแอป':tab==='reconcile'?'ยอดคาดการณ์ vs ยอดเข้าจริง แยกช่องทาง (Grab/LINE MAN/ShopeeFood)':tab==='docs'?'สัญญา/PDPA/ขายฝาก เติมชื่อร้านอัตโนมัติ — ส่ง LINE · ดาวน์โหลด · แชร์คู่ค้า':'สิทธิ์เปิด-ปิดร้าน & ทะเบียนพนักงาน'}</div></div>
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          {(tab==='sales'||tab==='reconcile'||tab==='verify'||tab==='txn') && <div className="seg">{RANGES.map(([k,l])=><button key={k} className={rk===k?'on':''} onClick={()=>setRk(k)}>{l}</button>)}
            <button className={rk==='custom'?'on':''} onClick={()=>setRk('custom')}>กำหนดเอง</button></div>}
          {(tab==='sales'||tab==='reconcile'||tab==='verify'||tab==='txn')&&rk==='custom'&&<><input type="date" className="field" value={cf||isoDay(30)} max={ct||isoDay(0)} onChange={e=>setCf(e.target.value)}/><span style={{color:'var(--ink-3)'}}>–</span><input type="date" className="field" value={ct||isoDay(0)} min={cf} max={isoDay(0)} onChange={e=>setCt(e.target.value)}/></>}
          <button className="btn gh" onClick={logout}>ออกจากระบบ</button>
        </div>
      </div>
      <div className="content">
        {demo && <div style={{background:'var(--gold-soft)',color:'#9A6410',padding:'11px 15px',borderRadius:12,marginBottom:18,fontSize:13.5,fontWeight:600}}>โหมดสาธิต — แสดงข้อมูลจำลอง เข้าสู่ระบบด้วย PIN/LINE เจ้าของเพื่อดูข้อมูลจริงของร้าน</div>}
        {tab==='sales' && <SalesView data={data} range={range}/>}
        {tab==='sponsor' && <SponsorStatsView data={data}/>}
        {tab==='quote' && <QuoteView data={data}/>}
        {tab==='wallet' && <WalletView data={data}/>}
        {tab==='menu' && <MenuView data={data}/>}
        {tab==='stock' && <StockView data={data}/>}
        {tab==='consign' && <ConsignmentView data={data} demo={demo}/>}
        {tab==='members' && <MembersView data={data}/>}
        {tab==='verify' && <PromptPayView data={data} range={range} onPatch={patchSale}/>}
        {tab==='txn' && <TxnView data={data} range={range}/>}
        {tab==='reconcile' && <ReconcileView data={data} range={range}/>}
        {tab==='docs' && <DocsView data={data} auth={auth}/>}
        {tab==='settings' && <SettingsView data={data}/>}
        {tab==='copyright' && <CopyrightView/>}
      </div>
    </div>
  </div>);
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
