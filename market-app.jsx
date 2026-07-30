// market-app.jsx — โปรแกรมตลาด (Market OS) บน KaiDee Platform
// role/โมดูลบนแพลตฟอร์มเดียว · แยกสิทธิ์: แผงค้า / เจ้าของตลาด / แพลตฟอร์ม
const { useState, useEffect } = React;
const { B, B1, monthTH, thDate, thDateTime, periodKey, addMonths, todayISO, UNIT_TYPES, MARKET_TYPES, RENT_MODELS, calcRent, calcService, vatBreak, qrSVG } = MK;
const PERIODS=[periodKey(2),periodKey(1),periodKey(0)]; const P0=periodKey(0);
const nfmt=(n)=> (Number(n)||0).toLocaleString('en-US');
const daysTo=(d)=>{ if(!d)return null; return Math.round((new Date(d)-new Date())/864e5); };
// ── device binding (ผูกอุปกรณ์) — id ต่อเครื่อง เก็บ localStorage · ใช้เดียวกับ backoffice ───
const MKT_DEVICE_KEY='kd_mkt_device_v1';
function thisDevice(){ try{ const raw=localStorage.getItem(MKT_DEVICE_KEY); if(raw){ const d=JSON.parse(raw); if(d&&d.id) return d; }
  const ua=navigator.userAgent||''; const os=/Windows/.test(ua)?'Windows':/Macintosh|Mac OS/.test(ua)?'Mac':/Android/.test(ua)?'Android':/iPhone|iPad|iPod/.test(ua)?'iOS':'อุปกรณ์'; const br=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'เบราว์เซอร์';
  const d={id:'dev_'+Math.random().toString(36).slice(2,10),name:os+' · '+br}; try{ localStorage.setItem(MKT_DEVICE_KEY,JSON.stringify(d)); }catch(e){} return d; }catch(e){ return {id:'dev_local',name:'อุปกรณ์นี้'}; } }
// เห็นยอดขาย/รายได้รวมของตลาด? owner+finance เห็นเสมอ · role อื่นต้องให้เจ้าของเปิดสวิตช์ seeTotal ต่อคน
const userSeesTotal=(u)=> !u ? true : (u.role==='owner'||u.role==='finance'|| !!u.seeTotal);
// อุปกรณ์นี้ได้รับอนุญาตไหม? (ไม่ผูก/ไม่จำกัด = ทุกเครื่อง)
const deviceAllowed=(u,devId)=>{ if(!u||!u.devices||!u.devices.length) return true; return u.devices.some(d=>d.id===devId); };
const docBase=()=> location.pathname.replace(/[^/]*$/,'');
const openDoc=(q)=> window.open(docBase()+'Market Doc.html?'+q,'_blank');
// ── โมดูลของเจ้าของตลาด (แพลตฟอร์มเปิด/ปิดรายตลาด) ──
const OWNER_MODS=[['billing','บิล & เก็บเงิน'],['gp','GP & ยอดขาย'],['consign','ขายฝาก'],['settle','นำส่ง/โอนเงิน'],['acct','บัญชี'],['vat','รายงานภาษี'],['bookcfg','การจอง & เรียกเก็บ'],['sub','แพ็กเกจ & ชำระเงิน']];
const marketMods=(m)=>{ const d={}; OWNER_MODS.forEach(([k])=>d[k]=true); return Object.assign(d,(m&&m.modules)||{}); };

/* ── shared ── */
function Kpi({label,value,foot,tone}){ return (<div className="card kpi"><div className="lbl">{label}</div>
  <div className="val" style={{color:tone||'var(--ink)'}}>{value}</div>{foot&&<div className="foot" style={{color:tone||'var(--ink-3)'}}>{foot}</div>}</div>); }
function BarList({rows,color}){ const max=Math.max(1,...rows.map(r=>r.v)); if(!rows.length)return <div className="empty" style={{padding:20}}>ไม่มีข้อมูล</div>;
  return rows.map((r,i)=>(<div className="barrow" key={i}><span className="bl">{r.k}</span>
    <span className="bartrack"><span className="barfill" style={{width:(r.v/max*100)+'%',background:color||'var(--brand)'}}/></span>
    <span className="bv num">{r.fmt?r.fmt(r.v):B(r.v)}</span></div>)); }
function Modal({title,tag,onClose,children,max}){ return (<div className="modal-bg" onClick={onClose}>
  <div className="modal" style={max?{maxWidth:max}:null} onClick={e=>e.stopPropagation()}>
    <div className="modal-h"><div><h3>{title}</h3>{tag&&<div style={{marginTop:6}}><span className="modtag">{tag}</span></div>}</div>
    <button className="x" onClick={onClose}>✕</button></div><div className="modal-b">{children}</div></div></div>); }
function ChartBox({type,labels,datasets,height=250}){ const ref=React.useRef(),ch=React.useRef();
  useEffect(()=>{ if(!window.Chart||!ref.current)return; if(ch.current)ch.current.destroy();
    ch.current=new window.Chart(ref.current,{type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:datasets.length>1,labels:{font:{family:'IBM Plex Sans Thai',size:12},usePointStyle:true,boxWidth:8}},
        tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+B(c.parsed.y)}}},
      scales:{x:{grid:{display:false},ticks:{font:{family:'IBM Plex Sans Thai',size:11},color:'#8A948E'}},
        y:{grid:{color:'#EEF1F0'},ticks:{font:{family:'IBM Plex Mono',size:11},color:'#8A948E',callback:v=>'฿'+(v>=1000?(v/1000)+'k':v)}}}}});
    return ()=>{ if(ch.current){ch.current.destroy();ch.current=null;} }; },[type,JSON.stringify(labels),JSON.stringify(datasets)]);
  return <div style={{position:'relative',height}}><canvas ref={ref}/></div>; }
function csv(name,rows){ const s=rows.map(r=>r.map(c=>{c=String(c==null?'':c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;}).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+s],{type:'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();a.remove(); }
const billPill=(b)=>{ if(!b)return <span className="pill p-n">ยังไม่ออกบิล</span>;
  if(b.status==='paid')return <span className="pill p-g">✓ จ่ายแล้ว</span>;
  if(b.status==='overdue')return <span className="pill p-r">⚠ ค้างชำระ</span>; return <span className="pill p-y">● รอชำระ</span>; };
const rmPill=(m)=>{ if(m==='gp')return <span className="pill p-plum">GP</span>; if(m==='per_sqm')return <span className="pill p-b">฿/ตร.ม.</span>; return <span className="pill p-n">เหมาจ่าย</span>; };
const baseRentOf=(s)=> s.rentModel==='gp'? s.minG : calcRent(s);

/* ════ OWNER · Dashboard ════ */
function OwnerDash({data,go}){
  const {market,stalls,bills,applications}=data;
  const occ=stalls.filter(s=>s.status==='occupied'), vac=stalls.filter(s=>s.status==='vacant');
  const cur=bills.filter(b=>b.period===P0);
  const billed=cur.reduce((a,b)=>a+b.total,0), collected=cur.filter(b=>b.status==='paid').reduce((a,b)=>a+b.total,0);
  const overdue=cur.filter(b=>b.status==='overdue'), pending=cur.filter(b=>b.status==='pending');
  const notIssued=occ.filter(s=>!cur.find(b=>b.stallId===s.id));
  const rate=billed?Math.round(collected/billed*100):0;
  const gpRev=cur.filter(b=>b.rentModel==='gp').reduce((a,b)=>a+b.rent,0);
  const areaOcc=occ.reduce((a,s)=>a+(s.area||0),0), rentSum=occ.filter(s=>s.rentModel!=='gp').reduce((a,s)=>a+calcRent(s),0);
  const rentSqm=areaOcc?rentSum/occ.filter(s=>s.rentModel!=='gp').reduce((a,s)=>a+s.area,0):0;
  const byZone={}; cur.forEach(b=>{ const z=stalls.find(s=>s.id===b.stallId).zone; byZone[z]=(byZone[z]||0)+b.total; });
  const feed=[...cur.filter(b=>b.status==='paid')].sort((a,b)=>b.paidAt-a.paidAt).slice(0,7);
  const expiring=occ.filter(s=>{ const d=daysTo(s.contractEnd); return d!=null&&d<=60; }).sort((a,b)=>daysTo(a.contractEnd)-daysTo(b.contractEnd));
  const pendApps=(applications||[]).filter(a=>a.status==='pending');
  return (<div className="fade">
    <div className="kpis">
      <Kpi label="พื้นที่มีผู้เช่า" value={occ.length+'/'+stalls.length} foot={'ว่าง '+vac.length+' · เช่าเต็ม '+Math.round(occ.length/stalls.length*100)+'%'} tone="var(--brand-ink)"/>
      <Kpi label={'เรียกเก็บรอบ '+monthTH(P0)} value={B(billed)} foot={cur.length+' บิล'}/>
      <Kpi label="เก็บได้แล้ว" value={B(collected)} foot={'อัตราเก็บเงิน '+rate+'%'} tone="var(--green)"/>
      <Kpi label="ค้างชำระ" value={B(billed-collected)} foot={overdue.length+' เกินกำหนด · '+pending.length+' รอชำระ'} tone={overdue.length?'var(--red)':'var(--ink)'}/>
      <Kpi label="ค่าเช่าเฉลี่ย/ตร.ม." value={B1(rentSqm)} foot={'GP '+cur.filter(b=>b.rentModel==='gp').length+' ยูนิต = '+B(gpRev)} tone="var(--blue-ink)"/>
    </div>
    <div className="grid2">
      <div className="card panel">
        <h3>ความคืบหน้าการเก็บเงิน · {monthTH(P0)}<span className="r-lnk" style={{cursor:'pointer'}} onClick={()=>go('billing')}>ไปหน้าบิล →</span></h3>
        <div style={{height:16,borderRadius:9,background:'var(--brand-softer)',overflow:'hidden',display:'flex'}}>
          <div style={{width:(collected/Math.max(1,billed)*100)+'%',background:'var(--green)'}}/>
          <div style={{width:(pending.reduce((a,b)=>a+b.total,0)/Math.max(1,billed)*100)+'%',background:'var(--gold)'}}/></div>
        <div style={{display:'flex',gap:18,marginTop:12,fontSize:13,flexWrap:'wrap'}}>
          <span><b style={{color:'var(--green)'}}>■</b> เก็บได้ {B(collected)}</span>
          <span><b style={{color:'var(--gold)'}}>■</b> รอชำระ {B(pending.reduce((a,b)=>a+b.total,0))}</span>
          <span><b style={{color:'var(--red)'}}>■</b> ค้าง {B(overdue.reduce((a,b)=>a+b.total,0))}</span></div>
        <h3 style={{marginTop:22}}>เรียกเก็บตามโซน</h3>
        <BarList rows={Object.entries(byZone).sort((a,b)=>b[1]-a[1]).map(([z,v])=>({k:(market.zones[z]||z).split('·')[0].trim(),v}))} color="var(--blue)"/>
      </div>
      <div className="card panel">
        <h3>ยอดโอนเข้าล่าสุด <span className="sub" style={{fontWeight:500}}>บัญชีกลางตลาด</span></h3>
        <div className="feed">{feed.length?feed.map(b=>{ const st=stalls.find(s=>s.id===b.stallId); return (
          <div className="feeditem" key={b.id}><div className="fi-ic">฿</div>
            <div className="fi-b"><div className="fi-t">{st.code} · {st.vendor}</div><div className="fi-s">{b.method==='promptpay'?'PromptPay QR':'เงินโอน'} · {thDateTime(b.paidAt)}</div></div>
            <div className="fi-v">{B(b.total)}</div></div>); }):<div className="empty">ยังไม่มียอดโอน</div>}</div>
      </div>
    </div>
    {(pendApps.length||notIssued.length||overdue.length||expiring.length)>0 && <div className="card panel">
      <h3>สิ่งที่ต้องจัดการ</h3>
      {pendApps.length>0 && <div className="note blue" style={{marginBottom:10}}>📝 ใบสมัครร้านค้ารอจัดแผง <b>{pendApps.length} ราย</b> — <a onClick={()=>go('stalls')} style={{cursor:'pointer'}}>ไปจัดลงแผง</a></div>}
      {notIssued.length>0 && <div className="note gold" style={{marginBottom:10}}>🧾 ยังไม่ออกบิลรอบนี้ <b>{notIssued.length}</b> ยูนิต ({notIssued.map(s=>s.code).join(', ')}) — <a onClick={()=>go('billing')} style={{cursor:'pointer'}}>ออกบิล</a></div>}
      {overdue.length>0 && <div className="note red" style={{marginBottom:10}}>⚠ ค้างชำระเกินกำหนด <b>{overdue.length}</b> ยูนิต รวม {B(overdue.reduce((a,b)=>a+b.total,0))} · ล็อกสิทธิ์: {stalls.filter(s=>s.locked).map(s=>s.code).join(', ')||'—'}</div>}
      {expiring.length>0 && <div className="note gold">📄 สัญญาใกล้หมดอายุ (ภายใน 60 วัน): {expiring.map(s=>s.code+' ('+daysTo(s.contractEnd)+' วัน)').join(', ')}</div>}
    </div>}
  </div>);
}

/* ════ OWNER · Stalls (เช่าแผง) ════ */
function ShareBox({market}){
  const url = new URL(docBase()+'Vendor Signup.html?market='+market.id, location.href).href;
  const [copied,setCopied]=useState(false);
  const copy=()=>{ navigator.clipboard&&navigator.clipboard.writeText(url); setCopied(true); setTimeout(()=>setCopied(false),1500); };
  const lineShare=()=> window.open('https://line.me/R/msg/text/?'+encodeURIComponent('สมัครเช่าแผง '+market.name+' กรอกที่นี่: '+url),'_blank');
  return (<div className="card panel" style={{marginBottom:18}}>
    <h3>ลิงก์รับสมัครร้านค้า <span className="sub" style={{fontWeight:500}}>· แชร์ให้ร้านกรอกเอง (LINE/เบราว์เซอร์ · ไม่ต้องล็อกอิน)</span></h3>
    <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
      <div className="qrimg" style={{width:96,height:96}} dangerouslySetInnerHTML={{__html:qrSVG('signup'+market.id)}}/>
      <div style={{flex:1,minWidth:220}}>
        <input className="field mono" style={{fontSize:12}} value={url} readOnly onFocus={e=>e.target.select()}/>
        <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
          <button className="btn pri sm" onClick={copy}>{copied?'✓ คัดลอกแล้ว':'คัดลอกลิงก์'}</button>
          <button className="btn gh sm" onClick={lineShare}>ส่งผ่าน LINE</button>
          <button className="btn gh sm" onClick={()=>window.open(url,'_blank')}>เปิดหน้าสมัคร ↗</button>
        </div>
        <div className="sub" style={{marginTop:8}}>ร้านกรอกเอง → ใบสมัครเข้ามาที่ "ใบสมัครรอจัดแผง" → กดจัดลงแผง = ทะเบียน+สัญญาอัตโนมัติ</div>
      </div>
    </div>
  </div>);
}
function StallsView({data,setData}){
  const {market,stalls,applications}=data; const [sel,setSel]=useState(null); const [f,setF]=useState('all'); const [assign,setAssign]=useState(null); const [share,setShare]=useState(false); const [vmode,setVmode]=useState('zone');
  const occ=stalls.filter(s=>s.status==='occupied').length, vac=stalls.length-occ;
  const areaOcc=stalls.filter(s=>s.status==='occupied'&&s.rentModel!=='gp'); const rentSqm=areaOcc.reduce((a,s)=>a+s.area,0)?areaOcc.reduce((a,s)=>a+calcRent(s),0)/areaOcc.reduce((a,s)=>a+s.area,0):0;
  const pend=(applications||[]).filter(a=>a.status==='pending');
  const books=(applications||[]).filter(a=>a.status==='booked');
  const leads=(applications||[]).filter(a=>a.status==='lead');
  const PATHL={appt:'นัดดูพื้นที่',deposit:'จอง+มัดจำ',full:'โอนเต็มจำนวน',daily:'จองรายวัน'};
  const shown=stalls.filter(s=> f==='all'||(f==='occ'&&s.status==='occupied')||(f==='vac'&&s.status==='vacant')||(f==='gp'&&s.rentModel==='gp'));
  const byZone={}; shown.forEach(s=>{ (byZone[s.zone]=byZone[s.zone]||[]).push(s); });
  const approve=(a)=>setAssign(a); const reject=(a)=>setData(d=>{ const x=d.applications.find(y=>y.id===a.id); x.status='rejected'; if(x.stallId){ const s=d.stalls.find(st=>st.id===x.stallId); if(s){s.held=false;s.reserved=false;s.heldBy=null;s.heldUntil=null;} } return {...d}; });
  const confirmDaily=(a)=>setData(d=>{ const x=d.applications.find(y=>y.id===a.id); x.status='approved'; return {...d}; });
  return (<div className="fade">
    <div className="kpis">
      <Kpi label="พื้นที่ทั้งหมด" value={stalls.length} foot={MARKET_TYPES[market.mtype]+' · '+Object.keys(market.zones).length+' โซน/ชั้น'}/>
      <Kpi label="มีผู้เช่า" value={occ} foot={Math.round(occ/stalls.length*100)+'% ของพื้นที่'} tone="var(--brand-ink)"/>
      <Kpi label="ว่าง" value={vac} foot="พร้อมปล่อยเช่า" tone={vac?'var(--gold)':'var(--green)'}/>
      <Kpi label="ค่าเช่าเฉลี่ย/ตร.ม." value={B1(rentSqm)} foot="เทียบเรตพื้นที่" tone="var(--blue-ink)"/>
    </div>
    {!share && <div className="toolbar"><button className="btn pri" onClick={()=>setShare(true)}>+ รับสมัครร้านค้า (แชร์ลิงก์)</button><div className="grow"/></div>}
    {share && <ShareBox market={market}/>}
    {books.length>0 && <div className="card panel" style={{marginBottom:18,borderColor:'#f0d9a8'}}>
      <h3>🔔 การจองรอยืนยัน <span className="pill p-y">{books.length}</span></h3>
      <div className="sub" style={{marginBottom:12}}>ร้านจองผ่านผังในไลน์ — ตรวจมัดจำ/สลิปแล้วกดยืนยัน = จัดลงแผง/นัดหมาย</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}}>
        {books.map(a=>{ const st=stalls.find(s=>s.id===a.stallId); return (<div key={a.id} style={{border:'1px solid #f0d9a8',borderRadius:12,padding:14,background:'#fffdf6'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:8}}><b>{a.name}</b><span className="pill p-y">{PATHL[a.bookPath]||'จอง'}</span></div>
          <div className="sub" style={{marginTop:3}}>{a.phone} · {a.cat||'—'}{a.line?' · LINE':''}</div>
          <div className="sub" style={{marginTop:3}}>แผง <b>{a.stallCode||(st&&st.code)||'—'}</b>{a.dates?(' · '+a.dates.length+' วัน'):''} · ยอด {a.amount?B(a.amount):'ฟรี'}</div>
          {a.apptDate&&<div className="sub" style={{marginTop:3}}>📅 {a.bookPath==='appt'?'นัดดู':'นัดเซ็น'} {thDate(a.apptDate)}</div>}
          {a.idVerify&&<div className="sub" style={{marginTop:3,color:'var(--blue-ink)'}}>🪩 นำบัตร ปชช.มายืนยันตัวตนวันนัด</div>}
          <div style={{display:'flex',gap:8,marginTop:12}}>{a.bookPath==='daily'?<button className="btn pri sm" style={{flex:1}} onClick={()=>confirmDaily(a)}>✓ ยืนยันจองรายวัน</button>:<button className="btn pri sm" style={{flex:1}} onClick={()=>approve(a)}>ยืนยัน → จัดลงแผง</button>}<button className="btn gh sm" onClick={()=>reject(a)}>ตีกลับ</button></div>
        </div>); })}</div>
    </div>}
    {leads.length>0 && <div className="card panel" style={{marginBottom:18}}>
      <h3>👥 ผู้สนใจจากหน้าจอง (lead) <span className="pill p-b">{leads.length}</span></h3>
      <div className="sub" style={{marginBottom:12}}>กรอกข้อมูลเข้ามาแต่ยังไม่จองแผง — ติดต่อกลับได้</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
        {leads.map(a=>(<div key={a.id} style={{border:'1px solid var(--hair-2)',borderRadius:12,padding:13}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:8}}><b>{a.name}</b>{a.line?<span className="pill p-g">LINE</span>:<span className="pill p-n">SMS</span>}</div>
          <div className="sub" style={{marginTop:3}}>{a.phone} · {a.cat||'—'}{a.budget?' · งบ '+B(a.budget):''}</div>
          {a.note&&<div className="sub" style={{marginTop:5,fontStyle:'italic'}}>“{a.note}”</div>}
          <div style={{display:'flex',gap:8,marginTop:10}}><button className="btn pri sm" style={{flex:1}} onClick={()=>approve(a)}>จัดลงแผง</button><button className="btn gh sm" onClick={()=>reject(a)}>ลบ</button></div>
        </div>))}</div>
    </div>}
    {pend.length>0 && <div className="card panel" style={{marginBottom:18,borderColor:'#cfe0ef'}}>
      <h3>ใบสมัครรอจัดแผง <span className="pill p-y">{pend.length}</span></h3>
      <div className="sub" style={{marginBottom:12}}>ร้านกรอกข้อมูลเองผ่านหน้าสมัคร → ตรวจแล้วกด "จัดลงแผง" = สร้างทะเบียน + สัญญาเช่าอัตโนมัติ (ไม่ต้องพิมพ์ใหม่)</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
        {pend.map(a=>(<div key={a.id} style={{border:'1px solid var(--hair-2)',borderRadius:12,padding:14}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:8}}><b>{a.name}</b>{a.line?<span className="pill p-g">LINE</span>:<span className="pill p-n">SMS</span>}</div>
          <div className="sub" style={{marginTop:3}}>{a.contact||'—'} · {a.phone}</div>
          <div className="sub" style={{marginTop:3}}>{a.cat||'—'} · สนใจ {a.model==='gp'?'GP':'เหมาจ่าย'}</div>
          {a.note&&<div className="sub" style={{marginTop:6,fontStyle:'italic'}}>“{a.note}”</div>}
          <div style={{display:'flex',gap:8,marginTop:12}}><button className="btn pri sm" style={{flex:1}} onClick={()=>approve(a)}>จัดลงแผง + ทำสัญญา</button><button className="btn gh sm" onClick={()=>reject(a)}>ปฏิเสธ</button></div>
        </div>))}</div>
    </div>}
    <div className="toolbar">
      <div className="seg">{[['zone','รายการโซน'],['plan','ผังจริง (ปักหมุด)']].map(([k,l])=><button key={k} className={vmode===k?'on':''} onClick={()=>setVmode(k)}>{l}</button>)}</div>
      {vmode==='zone'&&<div className="seg" style={{marginLeft:10}}>{[['all','ทั้งหมด'],['occ','มีผู้เช่า'],['vac','ว่าง'],['gp','คิด GP']].map(([k,l])=><button key={k} className={f===k?'on':''} onClick={()=>setF(k)}>{l}</button>)}</div>}
      <div className="grow"/><span className="sub">{vmode==='plan'?'อัปรูปผังจริง แล้วลากหมุดร้านลงตำแหน่ง · 🟢 มีร้าน 🔴 ล็อก ⚪ ว่าง · แตะ 📄 = สัญญาเช่า':'คลิกยูนิตเพื่อดูรายละเอียด/สัญญา · ยูนิตว่าง = เพิ่มผู้เช่า'}</span>
    </div>
    {vmode==='plan'? <PlanView data={data} setData={setData} onSel={setSel}/> :
    Object.keys(market.zones).filter(z=>byZone[z]).map(z=>(<div key={z}>
      <div className="zone-h">{market.zones[z]}<span className="zt">· {byZone[z].length} ยูนิต</span></div>
      <div className="stallgrid">{byZone[z].map(s=>(
        <div key={s.id} className={'stall'+(s.status==='vacant'?' vac':'')+(s.locked?' locked':'')} onClick={()=>setSel(s)}>
          <div className="sc">{s.code}</div>
          {s.status==='vacant'? <div className="sn" style={{color:'var(--ink-3)'}}>+ ปล่อยเช่า</div> : <><div className="sn">{s.vendor}</div><div className="sm">{s.cat}</div></>}
          <div className="sm" style={{marginTop:4}}>{UNIT_TYPES[s.unitType]} · {s.area} ตร.ม.</div>
          <div className="sbadge">{s.status==='vacant'?<span className="pill p-n">ว่าง</span>:(s.locked?<span className="pill p-r">ล็อก</span>:rmPill(s.rentModel))}</div>
        </div>))}</div></div>))}
    {sel && <StallModal stall={sel} market={market} data={data} setData={setData} onClose={()=>setSel(null)}/>}
    {assign && <AssignModal app={assign} data={data} setData={setData} onClose={()=>setAssign(null)}/>}
  </div>);
}
function scaleImg(file,cb){ const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{ const mw=1400,sc=Math.min(1,mw/img.width),c=document.createElement('canvas'); c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc); c.getContext('2d').drawImage(img,0,0,c.width,c.height); cb(c.toDataURL('image/jpeg',0.82)); }; img.src=r.result; }; r.readAsDataURL(file); }
function PlanView({data,setData,onSel}){
  const {market,stalls}=data; const plan=market.floorPlan;
  const [edit,setEdit]=useState(false); const [pos,setPos]=useState({}); const [drag,setDrag]=useState(null); const wrapRef=React.useRef();
  useEffect(()=>{ const p={}; stalls.forEach(s=>{ if(s.px!=null) p[s.id]={x:s.px,y:s.py}; }); setPos(p); },[market.id,plan]);
  const upload=(e)=>{ const f=e.target.files[0]; if(!f)return; scaleImg(f,(url)=>setData(d=>{ d.markets.find(m=>m.id===market.id).floorPlan=url; return {...d}; })); e.target.value=''; };
  const removePlan=()=>{ if(!confirm('ลบรูปผังนี้? (ตำแหน่งหมุดยังอยู่)'))return; setData(d=>{ d.markets.find(m=>m.id===market.id).floorPlan=null; return {...d}; }); };
  const commit=(id,x,y)=>setData(d=>{ const s=d.stalls.find(z=>z.id===id); s.px=x; s.py=y; return {...d}; });
  const place=(s)=>{ setPos(p=>({...p,[s.id]:{x:50,y:50}})); commit(s.id,50,50); };
  const clearPin=(s)=>{ setPos(p=>{ const n={...p}; delete n[s.id]; return n; }); setData(d=>{ const z=d.stalls.find(x=>x.id===s.id); z.px=null; z.py=null; return {...d}; }); };
  const onDown=(e,s)=>{ if(!edit)return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag(s.id); };
  const onMove=(e)=>{ if(!drag||!wrapRef.current)return; const r=wrapRef.current.getBoundingClientRect(); let x=(e.clientX-r.left)/r.width*100,y=(e.clientY-r.top)/r.height*100; x=Math.max(1,Math.min(99,x)); y=Math.max(1,Math.min(99,y)); setPos(p=>({...p,[drag]:{x,y}})); };
  const onUp=()=>{ if(drag){ const p=pos[drag]; if(p) commit(drag,Math.round(p.x*10)/10,Math.round(p.y*10)/10); setDrag(null); } };
  const pinColor=(s)=> s.status==='vacant'?{bg:'#e6e9ee',fg:'#7a828c',bd:'#c7ccd4'} : s.locked?{bg:'#fbe4e4',fg:'#b42318',bd:'#f1b0b0'} : {bg:'#dff3e6',fg:'#127a3e',bd:'#a6ddba'};
  const placed=stalls.filter(s=>pos[s.id]), unplaced=stalls.filter(s=>!pos[s.id]);
  if(!plan) return (<div className="fade"><div className="card panel" style={{textAlign:'center',padding:'44px 20px'}}>
      <div style={{fontSize:42}}>🗺️</div>
      <h3 style={{marginTop:8}}>อัปโหลดรูปผังตลาดจริง</h3>
      <div className="sub" style={{maxWidth:460,margin:'6px auto 18px'}}>ถ่ายรูป/สแกนผังแผงของตลาด (.jpg/.png) แล้วลากหมุดแต่ละแผงไปวางตำแหน่งจริงบนผัง — เจ้าหน้าที่/ลูกค้าจะเห็นว่าแผงไหนอยู่ตรงไหน ว่างหรือมีร้าน</div>
      <label className="btn pri" style={{cursor:'pointer'}}>เลือกรูปผัง<input type="file" accept="image/*" onChange={upload} style={{display:'none'}}/></label></div></div>);
  return (<div className="fade">
    <div className="toolbar" style={{marginBottom:12}}>
      <button className={'btn '+(edit?'pri':'gh')} onClick={()=>setEdit(!edit)}>{edit?'✓ เสร็จ (ล็อกตำแหน่ง)':'✎ แก้ตำแหน่งหมุด'}</button>
      <label className="btn gh" style={{cursor:'pointer'}}>เปลี่ยนรูป<input type="file" accept="image/*" onChange={upload} style={{display:'none'}}/></label>
      <button className="btn gh" onClick={removePlan}>ลบรูป</button>
      <div className="grow"/><span className="sub">ปักแล้ว {placed.length}/{stalls.length} แผง</span>
    </div>
    <div ref={wrapRef} onPointerMove={onMove} onPointerUp={onUp} style={{position:'relative',borderRadius:14,overflow:'hidden',border:'1px solid var(--hair-2)',userSelect:'none',touchAction:'none',background:'#f4f6f8'}}>
      <img src={plan} alt="ผังตลาด" draggable={false} style={{display:'block',width:'100%'}}/>
      {placed.map(s=>{ const p=pos[s.id],c=pinColor(s); return (
        <div key={s.id} onPointerDown={e=>onDown(e,s)} onClick={()=>{ if(!edit) onSel(s); }} title={s.vendor||'ว่าง'}
          style={{position:'absolute',left:p.x+'%',top:p.y+'%',transform:'translate(-50%,-50%)',cursor:edit?'grab':'pointer',background:c.bg,color:c.fg,border:'2px solid '+c.bd,borderRadius:9,padding:'3px 8px',fontSize:12,fontWeight:700,boxShadow:'0 2px 6px rgba(0,0,0,.2)',whiteSpace:'nowrap',zIndex:drag===s.id?5:1,display:'flex',alignItems:'center',gap:2}}>
          {s.code}{s.status!=='vacant'&&<span style={{fontWeight:500,marginLeft:4,opacity:.85}}>{s.vendor}</span>}
          {!edit&&s.status==='occupied'&&<span onClick={e=>{e.stopPropagation();openDoc('type=contract&stall='+encodeURIComponent(s.id));}} title="เปิดสัญญาเช่า" style={{marginLeft:5,cursor:'pointer',opacity:.9,borderLeft:'1px solid '+c.bd,paddingLeft:5}}>📄</span>}
          {edit&&<span onClick={e=>{e.stopPropagation();clearPin(s);}} style={{marginLeft:6,cursor:'pointer',opacity:.55}}>✕</span>}
        </div>); })}
    </div>
    {edit&&unplaced.length>0&&<div className="card panel" style={{marginTop:14}}>
      <h3>แผงที่ยังไม่ปักหมุด <span className="pill p-y">{unplaced.length}</span></h3>
      <div className="sub" style={{marginBottom:10}}>กดแผงเพื่อวางหมุดกลางผัง แล้วลากไปตำแหน่งจริง</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8}}>{unplaced.map(s=>(
        <button key={s.id} className="btn gh sm" onClick={()=>place(s)}>{s.code}{s.status!=='vacant'?' · '+s.vendor:''}</button>))}</div></div>}
  </div>);
}
function AssignModal({app,data,setData,onClose}){
  const vac=data.stalls.filter(s=>s.marketId===app.marketId&&s.status==='vacant');
  const [sid,setSid]=useState((app.stallId&&vac.find(s=>s.id===app.stallId))?app.stallId:(vac[0]?vac[0].id:''));
  const st=vac.find(s=>s.id===sid);
  const suggestRent = st? (st.unitType==='shop'?st.area*600:(st.unitType==='kiosk'?15000:Math.max(3200,st.area*550))) : 0;
  const assign=()=>{ setData(d=>{ const s=d.stalls.find(x=>x.id===sid);
    const isGp=app.model==='gp'; const start=todayISO();
    Object.assign(s,{status:'occupied',vendor:app.name,contact:app.contact||'',phone:app.phone,line:!!app.line,cat:app.cat||s.cat,
      rentModel:isGp?'gp':'fixed', rent:isGp?0:Math.round(suggestRent/100)*100, rentPerSqm:0,
      gpRate:isGp?10:0, minG:isGp?Math.round(suggestRent*1.2/100)*100:0, baseSales:isGp?60000:0,
      deposit:Math.round((isGp?suggestRent*1.2:suggestRent)*2/100)*100, contractStart:start, contractEnd:addMonths(start.slice(0,7),12)+'-'+start.slice(8),
      elecRead:s.elecRead||1500, waterRead:s.waterRead||300, appId:app.id, signedAt:Date.now(), held:false, reserved:false, heldBy:null, heldUntil:null });
    const a=d.applications.find(x=>x.id===app.id); a.status='approved'; a.stallId=sid; return {...d}; });
    onClose();
  };
  return (<Modal title={'จัดลงแผง + ทำสัญญา · '+app.name} tag="ทะเบียน+สัญญาอัตโนมัติจากใบสมัคร" onClose={onClose} max={560}>
    <div className="note g" style={{marginBottom:14}}>ระบบดึงข้อมูลจากใบสมัครมาสร้างทะเบียนร้าน + ร่างสัญญาเช่าให้อัตโนมัติ — เลือกยูนิตว่างแล้วยืนยัน ปรับค่าเช่าจริงได้ทีหลัง</div>
    <div style={{background:'var(--brand-softer)',borderRadius:12,padding:'6px 16px',marginBottom:14}}>
      <div className="kv"><span className="k">ร้าน</span><span className="v">{app.name}</span></div>
      <div className="kv"><span className="k">ผู้เช่า</span><span className="v">{app.contact||'—'}</span></div>
      <div className="kv"><span className="k">โทร · ช่องทาง</span><span className="v">{app.phone} · {app.line?'LINE':'SMS'}</span></div>
      <div className="kv"><span className="k">สินค้า · รูปแบบ</span><span className="v">{app.cat||'—'} · {app.model==='gp'?'GP':'เหมาจ่าย'}</span></div>
    </div>
    <label className="lb">เลือกยูนิต/แผงว่าง</label>
    {vac.length? <select className="field" value={sid} onChange={e=>setSid(e.target.value)}>
      {vac.map(s=><option key={s.id} value={s.id}>{s.code} · {UNIT_TYPES[s.unitType]} {s.area} ตร.ม. · {s.zoneName}</option>)}</select>
      : <div className="note gold">ไม่มียูนิตว่างในตลาดนี้</div>}
    {st && <div className="note blue" style={{marginTop:12}}>ร่างสัญญา: {st.code} · {st.area} ตร.ม. · ค่าเช่าเริ่มต้น {B(app.model==='gp'?Math.round(suggestRent*1.2/100)*100:Math.round(suggestRent/100)*100)}{app.model==='gp'?' (การันตีขั้นต่ำ)':''} · ประกัน 2 เดือน · สัญญา 12 เดือน</div>}
    <button className="btn pri" style={{marginTop:18,width:'100%'}} onClick={assign} disabled={!sid}>ยืนยัน จัดลงแผง + สร้างสัญญา</button>
  </Modal>);
}
function StallModal({stall,market,data,setData,onClose}){
  const editing0=stall.status==='vacant'; const [ed,setEd]=useState(editing0);
  const [f,setF]=useState({vendor:stall.vendor||'',contact:stall.contact||'',phone:stall.phone||'',cat:stall.cat||'',unitType:stall.unitType||'wet_stall',area:stall.area||6,
    rentModel:stall.rentModel||'fixed',rent:stall.rent||4000,rentPerSqm:stall.rentPerSqm||600,gpRate:stall.gpRate||10,minG:stall.minG||5000,camPerSqm:stall.camPerSqm||0,
    deposit:stall.deposit||8000,contractStart:stall.contractStart||todayISO(),contractEnd:stall.contractEnd||(addMonths(P0,12)+'-28'),line:stall.line??true});
  const bills=data.bills.filter(b=>b.stallId===stall.id).sort((a,b)=>b.period<a.period?-1:1);
  const set=(k,v)=>setF({...f,[k]:v});
  const preview={...stall,rentModel:f.rentModel,rent:+f.rent,rentPerSqm:+f.rentPerSqm,area:+f.area,gpRate:+f.gpRate,minG:+f.minG,camPerSqm:+f.camPerSqm};
  const save=()=>{ setData(d=>{ const s=d.stalls.find(x=>x.id===stall.id);
    Object.assign(s,{status:'occupied',vendor:f.vendor,contact:f.contact,phone:f.phone,cat:f.cat||UNIT_TYPES[f.unitType],unitType:f.unitType,area:+f.area,
      rentModel:f.rentModel,rent:+f.rent,rentPerSqm:+f.rentPerSqm,gpRate:+f.gpRate,minG:+f.minG,camPerSqm:+f.camPerSqm,deposit:+f.deposit,
      contractStart:f.contractStart,contractEnd:f.contractEnd,line:!!f.line,elecRead:s.elecRead||1500,waterRead:s.waterRead||300,signedAt:s.signedAt||Date.now()});
    return {...d}; }); onClose(); };
  const vacate=()=>{ if(!confirm('ยืนยันเลิกสัญญา/ปล่อยยูนิตนี้ว่าง?'))return; setData(d=>{ const s=d.stalls.find(x=>x.id===stall.id); Object.assign(s,{status:'vacant',vendor:null,contact:null,phone:null,locked:false}); return {...d}; }); onClose(); };
  return (<Modal title={stall.code+' · '+stall.zoneName.split('·').slice(1).join('·').trim()} tag={editing0?'MODULE 01 · เช่าแผง':(UNIT_TYPES[stall.unitType]+' · '+stall.area+' ตร.ม.')} onClose={onClose}>
    {ed?(<>
      {editing0 && <div className="note g" style={{marginBottom:16}}>ร้านกรอกข้อมูลเองผ่านหน้าสมัคร (แชร์ลิงก์) แล้วกดจัดลงแผง — หน้านี้คือการยืนยัน/แก้ไขฝั่งตลาด</div>}
      <label className="lb">ชื่อร้าน / ผู้เช่า</label><input className="field" value={f.vendor} onChange={e=>set('vendor',e.target.value)} placeholder="ชื่อร้าน"/>
      <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
        <div><label className="lb">ชื่อ-นามสกุลจริง</label><input className="field" value={f.contact} onChange={e=>set('contact',e.target.value)}/></div>
        <div><label className="lb">เบอร์โทร</label><input className="field" value={f.phone} onChange={e=>set('phone',e.target.value)}/></div>
      </div>
      <div className="meterrow">
        <div><label className="lb">ประเภทยูนิต</label><select className="field" value={f.unitType} onChange={e=>set('unitType',e.target.value)}>{Object.entries(UNIT_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="lb">ขนาด (ตร.ม.)</label><input className="field" type="number" value={f.area} onChange={e=>set('area',e.target.value)}/></div>
        <div><label className="lb">ประเภทสินค้า</label><input className="field" value={f.cat} onChange={e=>set('cat',e.target.value)}/></div>
      </div>
      <label className="lb">รูปแบบค่าเช่า</label>
      <div className="seg" style={{width:'100%'}}>{Object.entries(RENT_MODELS).map(([k,v])=><button key={k} style={{flex:1}} className={f.rentModel===k?'on':''} onClick={()=>set('rentModel',k)}>{v}</button>)}</div>
      {f.rentModel==='fixed' && <div style={{marginTop:6}}><label className="lb">ค่าเช่า/เดือน</label><input className="field" type="number" value={f.rent} onChange={e=>set('rent',e.target.value)}/></div>}
      {(()=>{ const sug=MK.catRateFor(market,f.cat,+f.area); return (sug>0&&f.rentModel==='fixed')? <div className="note blue" style={{marginTop:8}}>💡 แนะนำตามประเภท “{MK.catGroup(f.cat).th}”: {B(sug)}/เดือน <a onClick={()=>set('rent',sug)} style={{cursor:'pointer',fontWeight:700,marginLeft:6}}>ใช้ค่านี้</a></div>:null; })()}
      {f.rentModel==='per_sqm' && <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr',marginTop:6}}>
        <div><label className="lb">฿/ตร.ม./เดือน</label><input className="field" type="number" value={f.rentPerSqm} onChange={e=>set('rentPerSqm',e.target.value)}/></div>
        <div><label className="lb">= ค่าเช่า ({f.area} ตร.ม.)</label><input className="field num" value={B(f.rentPerSqm*f.area)} disabled/></div></div>}
      {f.rentModel==='gp' && <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr',marginTop:6}}>
        <div><label className="lb">GP %</label><input className="field" type="number" value={f.gpRate} onChange={e=>set('gpRate',e.target.value)}/></div>
        <div><label className="lb">การันตีขั้นต่ำ/เดือน</label><input className="field" type="number" value={f.minG} onChange={e=>set('minG',e.target.value)}/></div></div>}
      <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
        <div><label className="lb">ค่าส่วนกลาง ฿/ตร.ม. (CAM)</label><input className="field" type="number" value={f.camPerSqm} onChange={e=>set('camPerSqm',e.target.value)}/></div>
        <div><label className="lb">เงินประกัน</label><input className="field" type="number" value={f.deposit} onChange={e=>set('deposit',e.target.value)}/></div>
      </div>
      <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
        <div><label className="lb">สัญญาเริ่ม</label><input className="field" type="date" value={f.contractStart} onChange={e=>set('contractStart',e.target.value)}/></div>
        <div><label className="lb">สัญญาหมด</label><input className="field" type="date" value={f.contractEnd} onChange={e=>set('contractEnd',e.target.value)}/></div>
      </div>
      <div className="note blue" style={{marginTop:12}}>ค่าเช่ารอบถัดไป ≈ {B(calcRent(preview))}{preview.camPerSqm>0?(' + ส่วนกลาง '+B(calcService(preview))):''} + ค่าน้ำ/ไฟตามมิเตอร์</div>
      <div style={{display:'flex',gap:10,marginTop:18}}><button className="btn pri" style={{flex:1}} onClick={save} disabled={!f.vendor}>{editing0?'เพิ่มผู้เช่า':'บันทึก'}</button>{!editing0&&<button className="btn gh" onClick={()=>setEd(false)}>ยกเลิก</button>}</div>
    </>):(<>
      <div className="kv"><span className="k">ร้านค้า</span><span className="v">{stall.vendor}</span></div>
      <div className="kv"><span className="k">ผู้เช่า (สัญญา)</span><span className="v">{stall.contact||'—'}</span></div>
      <div className="kv"><span className="k">เบอร์ · ช่องทาง</span><span className="v">{stall.phone||'—'} · {stall.line?'LINE':'SMS'}</span></div>
      <div className="kv"><span className="k">ยูนิต</span><span className="v">{UNIT_TYPES[stall.unitType]} · {stall.area} ตร.ม.</span></div>
      <div className="kv"><span className="k">รูปแบบค่าเช่า</span><span className="v">{stall.rentModel==='gp'?('GP '+stall.gpRate+'% ขั้นต่ำ '+B(stall.minG)):(stall.rentModel==='per_sqm'?(B(stall.rentPerSqm)+'/ตร.ม. = '+B(calcRent(stall))):('เหมาจ่าย '+B(stall.rent)))}</span></div>
      {stall.camPerSqm>0 && <div className="kv"><span className="k">ค่าส่วนกลาง</span><span className="v">{B(stall.camPerSqm)}/ตร.ม. = {B(calcService(stall))}</span></div>}
      <div className="kv"><span className="k">เงินประกัน</span><span className="v">{B(stall.deposit)}</span></div>
      <div className="kv"><span className="k">สัญญา</span><span className="v">{thDate(stall.contractStart)} – {thDate(stall.contractEnd)}{daysTo(stall.contractEnd)!=null&&daysTo(stall.contractEnd)<=60?<span className="pill p-y" style={{marginLeft:6}}>ใกล้หมด</span>:null}</span></div>
      <div className="kv"><span className="k">สถานะสิทธิ์</span><span className="v">{stall.locked?<span className="pill p-r">ล็อก (ค้างชำระ)</span>:<span className="pill p-g">ปกติ</span>}</span></div>
      <div style={{display:'flex',gap:10,margintop:8,marginTop:16}}>
        <button className="btn pri" style={{flex:1}} onClick={()=>openDoc('type=contract&stall='+encodeURIComponent(stall.id))}>📄 สัญญาเช่า</button>
        <button className="btn gh" onClick={()=>setEd(true)}>แก้ไข</button>
        <button className="btn dngh" onClick={vacate}>ปล่อยว่าง</button>
      </div>
      <h3 style={{margin:'18px 0 6px',fontSize:14}}>ประวัติบิล</h3>
      <table><thead><tr><th>รอบ</th><th className="r">ยอด</th><th className="c">สถานะ</th></tr></thead><tbody>
        {bills.map(b=><tr key={b.id}><td>{monthTH(b.period)}</td><td className="r num">{B(b.total)}</td><td className="c">{billPill(b)}</td></tr>)}</tbody></table>
    </>)}
  </Modal>);
}

/* ════ OWNER · Billing ════ */
function BillingView({data,setData}){
  const {market,stalls,bills}=data; const [per,setPer]=useState(P0); const [issue,setIssue]=useState(null); const [payQR,setPayQR]=useState(null);
  const bc=MK.billCfg(market); const dueOf=(p)=>p+'-'+String(bc.dueDay||10).padStart(2,'0');
  const occ=stalls.filter(s=>s.status==='occupied'); const rows=occ.map(s=>({s,b:bills.find(b=>b.stallId===s.id&&b.period===per)}));
  const cur=bills.filter(b=>b.period===per); const billed=cur.reduce((a,b)=>a+b.total,0), collected=cur.filter(b=>b.status==='paid').reduce((a,b)=>a+b.total,0);
  const notIssued=rows.filter(r=>!r.b);
  const autoTargets=notIssued.filter(r=>r.s.rentModel!=='gp');
  const autoIssue=()=>{ if(per!==P0){ alert('ออกบิลอัตโนมัติได้เฉพาะรอบปัจจุบัน'); return; }
    if(!autoTargets.length){ alert('ไม่มีร้านยอดคงที่ที่ยังไม่ออกบิล'); return; }
    if(!confirm('ออกบิลอัตโนมัติ '+autoTargets.length+' ร้าน (ค่าเช่าคงที่ + ประเมินน้ำ/ไฟจากรอบก่อน)?')) return;
    setData(d=>{ const tg=d.stalls.filter(s=>s.marketId===market.id&&s.status==='occupied'&&s.rentModel!=='gp'&&!d.bills.find(b=>b.stallId===s.id&&b.period===per));
      tg.forEach(st=>{ const pv=d.bills.filter(b=>b.stallId===st.id&&b.period<per).sort((a,b)=>b.period<a.period?-1:1)[0];
        const pe=pv?pv.elecCur:(st.elecRead||1500), pw=pv?pv.waterCur:(st.waterRead||300); const eU=pv?pv.elecUnits:120, wU=pv?pv.waterUnits:14;
        const rent=calcRent(st), service=calcService(st), elecAmt=eU*market.elecRate, waterAmt=wU*market.waterRate, total=rent+service+elecAmt+waterAmt;
        d.bills.push({id:'bill_'+st.id+'_'+per,marketId:st.marketId,stallId:st.id,period:per,rentModel:st.rentModel,rent,service,gpSales:0,gpRate:st.gpRate,minG:st.minG,elecPrev:pe,elecCur:pe+eU,elecUnits:eU,elecAmt,waterPrev:pw,waterCur:pw+wU,waterUnits:wU,waterAmt,total,status:'pending',due:dueOf(per),ref:'PP'+per.replace('-','')+st.code.replace('-',''),auto:true}); });
      return {...d}; }); };
  const remindAll=()=>{ const due=cur.filter(b=>b.status==='overdue'||b.status==='pending'); if(!due.length){ alert('ไม่มีบิลค้าง/รอชำระรอบนี้'); return; }
    const ln=due.map(b=>{ const s=stalls.find(x=>x.id===b.stallId); return '• '+s.code+' '+s.vendor+' — '+B(b.total)+(b.status==='overdue'?' (เกินกำหนด)':''); });
    const txt='🔔 แจ้งเตือนค่าเช่า '+market.name+'\nรอบ '+monthTH(per)+' · กำหนดชำระวันที่ '+bc.dueDay+'\n\n'+ln.join('\n')+'\n\nชำระผ่าน PromptPay '+market.promptpay;
    window.open('https://line.me/R/msg/text/?'+encodeURIComponent(txt),'_blank'); };
  const markPaid=(b,method)=>{ setData(d=>{ const bb=d.bills.find(x=>x.id===b.id); bb.status='paid'; bb.method=method; bb.paidAt=Date.now();
    const st=d.stalls.find(s=>s.id===bb.stallId); if(st&&!d.bills.some(x=>x.stallId===st.id&&x.status==='overdue'&&x.id!==bb.id)) st.locked=false; return {...d}; }); setPayQR(null); };
  const toggleLock=(sid)=>setData(d=>{ const s=d.stalls.find(x=>x.id===sid); s.locked=!s.locked; return {...d}; });
  const feed=[...cur.filter(b=>b.status==='paid')].sort((a,b)=>b.paidAt-a.paidAt);
  const exportBills=()=>csv('บิล_'+per+'.csv',[['ยูนิต','ร้าน','รูปแบบ','ค่าเช่า','ค่าส่วนกลาง','ไฟ','น้ำ','รวม','สถานะ','วันจ่าย']]
    .concat(cur.map(b=>{const s=stalls.find(x=>x.id===b.stallId);return [b.stallId,s.vendor,b.rentModel,b.rent,b.service||0,b.elecAmt,b.waterAmt,b.total,b.status,b.paidAt?thDate(new Date(b.paidAt).toISOString().slice(0,10)):''];})));
  return (<div className="fade">
    <div className="toolbar"><div className="seg">{PERIODS.slice().reverse().map(p=><button key={p} className={per===p?'on':''} onClick={()=>setPer(p)}>{monthTH(p)}</button>)}</div>
      <div className="grow"/>{autoTargets.length>0&&per===P0&&bc.autoFixed&&<button className="btn pri" onClick={autoIssue}>⚡ ออกบิลอัตโนมัติ ({autoTargets.length})</button>}{notIssued.length>0&&per===P0&&<button className="btn pri" onClick={()=>setIssue('bulk')}>🧾 ออกบิลที่เหลือ ({notIssued.length})</button>}<button className="btn gh" onClick={remindAll}>🔔 แจ้งเตือน</button><button className="btn gh" onClick={exportBills}>⬇ CSV</button></div>
    <div className="kpis">
      <Kpi label="เรียกเก็บรอบนี้" value={B(billed)} foot={cur.length+' บิล · ยังไม่ออก '+notIssued.length}/>
      <Kpi label="เก็บได้แล้ว" value={B(collected)} foot={billed?Math.round(collected/billed*100)+'%':'—'} tone="var(--green)"/>
      <Kpi label="ค้างชำระ" value={B(billed-collected)} foot={cur.filter(b=>b.status==='overdue').length+' เกินกำหนด'} tone={billed-collected?'var(--red)':'var(--ink)'}/>
      <Kpi label="บัญชีรับเงิน" value={<span style={{fontSize:16}}>PromptPay</span>} foot={market.promptpay}/>
    </div>
    <div className="grid2">
      <div className="card" style={{overflow:'hidden'}}>
        <table><thead><tr><th>ยูนิต / ร้าน</th><th className="c">รูปแบบ</th><th className="r">ค่าเช่า</th><th className="r">น้ำ+ไฟ{market.mtype!=='wet'?'+CAM':''}</th><th className="r">รวม</th><th className="c">สถานะ</th><th></th></tr></thead>
          <tbody>{rows.map(({s,b})=>(<tr key={s.id} className="row" onClick={()=>b&&setPayQR(b)}>
            <td><b>{s.code}</b> <span style={{color:'var(--ink-2)'}}>{s.vendor}</span>{s.locked&&<span className="pill p-r" style={{marginLeft:6}}>ล็อก</span>}</td>
            <td className="c">{rmPill(s.rentModel)}</td>
            <td className="r num">{b?B(b.rent):'—'}</td>
            <td className="r num">{b?B(b.elecAmt+b.waterAmt+(b.service||0)):'—'}</td>
            <td className="r num" style={{fontWeight:700}}>{b?B(b.total):'—'}</td>
            <td className="c">{billPill(b)}</td>
            <td className="r" onClick={e=>e.stopPropagation()}>{!b?<button className="btn pri sm" onClick={()=>setIssue(s.id)}>ออกบิล</button>
              : b.status==='paid'?<span className="sub">{thDate(new Date(b.paidAt).toISOString().slice(0,10))}</span>:<button className="btn gh sm" onClick={()=>setPayQR(b)}>QR/จับยอด</button>}</td></tr>))}</tbody></table>
      </div>
      <div className="card panel">
        <h3>{MK.payMode(market)==='wallet'?'เงินเข้าจากกระเป๋าร้าน':MK.payMode(market)==='both'?'ยอดเข้า · กระเป๋า + PromptPay':'ยอดโอนเข้าอัตโนมัติ'} <span className="sub" style={{fontWeight:500}}>· {MK.payMode(market)==='promptpay'?'จับคู่บิลจาก PromptPay':'ตัดบิลอัตโนมัติ'}</span></h3>
        <div className="note g" style={{marginBottom:12}}>{MK.payMode(market)==='promptpay'?<>ร้านสแกน QR บนบิล → เงินเข้าบัญชีกลาง → ระบบ<b>จับยอดเข้าบิลอัตโนมัติ</b> · ค้างเกินกำหนด = ล็อกสิทธิ์</>:<>ร้านเติมเงินเข้ากระเป๋า → ระบบ<b>หักค่าเช่าจากกระเป๋าอัตโนมัติ</b> รู้ทันทีว่าใครจ่าย · จัดการที่เมนู <b>“กระเป๋าเงินร้าน” 👛</b>{MK.payMode(market)==='both'?' (ช่วงเปลี่ยนผ่าน · รับ PromptPay ควบด้วย)':''}</>}</div>
        <div className="feed">{feed.length?feed.map(b=>{const s=stalls.find(x=>x.id===b.stallId);return(
          <div className="feeditem" key={b.id}><div className="fi-ic">✓</div><div className="fi-b"><div className="fi-t">{s.code} · {s.vendor}</div><div className="fi-s">{b.method==='promptpay'?'PromptPay':'โอน'} · {thDateTime(b.paidAt)}</div></div><div className="fi-v">{B(b.total)}</div></div>);}):<div className="empty">ยังไม่มียอดโอนรอบนี้</div>}</div>
      </div>
    </div>
    {issue && <IssueModal target={issue} data={data} setData={setData} per={per} onClose={()=>setIssue(null)}/>}
    {payQR && <BillQR bill={payQR} stall={stalls.find(s=>s.id===payQR.stallId)} market={market} onPaid={markPaid} onLock={toggleLock} onClose={()=>setPayQR(null)}/>}
  </div>);
}
function lastReadings(bills,stallId,per){ const prev=bills.filter(b=>b.stallId===stallId&&b.period<per).sort((a,b)=>b.period<a.period?-1:1)[0]; return prev?{e:prev.elecCur,w:prev.waterCur}:null; }
function IssueModal({target,data,setData,per,onClose}){
  const {market,stalls,bills}=data; const bc=MK.billCfg(market);
  const targets = target==='bulk'? stalls.filter(s=>s.status==='occupied'&&!bills.find(b=>b.stallId===s.id&&b.period===per)) : [stalls.find(s=>s.id===target)];
  const [i,setI]=useState(0); const st=targets[i];
  const prev=lastReadings(bills,st.id,per)||{e:st.elecRead||1500,w:st.waterRead||300};
  const [ec,setEc]=useState(prev.e+120); const [wc,setWc]=useState(prev.w+14); const [sales,setSales]=useState(st.rentModel==='gp'?(st.baseSales||60000):0);
  useEffect(()=>{ const p=lastReadings(bills,st.id,per)||{e:st.elecRead||1500,w:st.waterRead||300}; setEc(p.e+120); setWc(p.w+14); setSales(st.rentModel==='gp'?(st.baseSales||60000):0); },[i]);
  const eU=Math.max(0,ec-prev.e), wU=Math.max(0,wc-prev.w);
  const rent=calcRent(st,sales), service=calcService(st), elecAmt=eU*market.elecRate, waterAmt=wU*market.waterRate, total=rent+service+elecAmt+waterAmt;
  const commit=(next)=>{ setData(d=>{ d.bills.push({id:'bill_'+st.id+'_'+per,marketId:st.marketId,stallId:st.id,period:per,rentModel:st.rentModel,
    rent,service,gpSales:st.rentModel==='gp'?sales:0,gpRate:st.gpRate,minG:st.minG,elecPrev:prev.e,elecCur:ec,elecUnits:eU,elecAmt,waterPrev:prev.w,waterCur:wc,waterUnits:wU,waterAmt,total,status:'pending',due:per+'-'+String(bc.dueDay||10).padStart(2,'0'),ref:'PP'+per.replace('-','')+st.code.replace('-','')}); return {...d}; });
    if(next&&i<targets.length-1) setI(i+1); else onClose(); };
  return (<Modal title={'ออกบิล · '+st.code+' '+st.vendor} tag={'MODULE 02 · บิล · '+monthTH(per)} onClose={onClose}>
    {target==='bulk' && <div className="sub" style={{marginBottom:12}}>ยูนิตที่ {i+1}/{targets.length}</div>}
    <div className="note g" style={{marginBottom:16}}>{st.rentModel==='gp'?'แผงคิด GP — ยอดขายดึงจาก KaiDee POS (แก้ไขได้)':'คีย์เลขมิเตอร์รอบนี้ ระบบหักลบเลขรอบก่อนอัตโนมัติ'}</div>
    {st.rentModel==='gp' && <div style={{marginBottom:6}}><label className="lb">ยอดขายรอบนี้ (จาก POS)</label><input className="field" type="number" value={sales} onChange={e=>setSales(+e.target.value)}/></div>}
    <div className="meterrow"><div><label className="lb">ไฟ · รอบก่อน</label><input className="field num" value={prev.e} disabled/></div>
      <div><label className="lb">ไฟ · ล่าสุด</label><input className="field num" type="number" value={ec} onChange={e=>setEc(+e.target.value)}/></div>
      <div><label className="lb">หน่วย × ฿{market.elecRate}</label><input className="field num" value={eU+' หน่วย'} disabled/></div></div>
    <div className="meterrow" style={{marginTop:8}}><div><label className="lb">น้ำ · รอบก่อน</label><input className="field num" value={prev.w} disabled/></div>
      <div><label className="lb">น้ำ · ล่าสุด</label><input className="field num" type="number" value={wc} onChange={e=>setWc(+e.target.value)}/></div>
      <div><label className="lb">หน่วย × ฿{market.waterRate}</label><input className="field num" value={wU+' หน่วย'} disabled/></div></div>
    <div style={{marginTop:18,background:'var(--brand-softer)',borderRadius:12,padding:'6px 16px'}}>
      <div className="kv"><span className="k">{st.rentModel==='gp'?('ค่าเช่า GP '+st.gpRate+'% (ขั้นต่ำ '+B(st.minG)+')'):(st.rentModel==='per_sqm'?('ค่าเช่า '+B(st.rentPerSqm)+'×'+st.area+'ตร.ม.'):'ค่าเช่า')}</span><span className="v num">{B(rent)}</span></div>
      {service>0 && <div className="kv"><span className="k">ค่าส่วนกลาง {st.camPerSqm}×{st.area}ตร.ม.</span><span className="v num">{B(service)}</span></div>}
      <div className="kv"><span className="k">ค่าไฟ {eU} หน่วย</span><span className="v num">{B(elecAmt)}</span></div>
      <div className="kv"><span className="k">ค่าน้ำ {wU} หน่วย</span><span className="v num">{B(waterAmt)}</span></div>
      <div className="kv total"><span className="k">รวมเรียกเก็บ{market.vat?' (รวม VAT)':''}</span><span className="v num" style={{color:'var(--brand-ink)'}}>{B(total)}</span></div>
    </div>
    <div style={{display:'flex',gap:10,marginTop:18}}><button className="btn pri" style={{flex:1}} onClick={()=>commit(false)}>ออกบิล + ส่ง {st.line?'LINE':'SMS/ลิงก์'}</button>
      {target==='bulk'&&i<targets.length-1&&<button className="btn gh" onClick={()=>commit(true)}>ออก + ถัดไป →</button>}</div>
  </Modal>);
}
function BillQR({bill,stall,market,onPaid,onLock,onClose}){
  const vb=vatBreak(bill.total,market);
  const docType = market.vat?'tax':'receipt';
  return (<Modal title={stall.code+' · '+stall.vendor} tag={'บิล '+monthTH(bill.period)} onClose={onClose} max={560}>
    <div className="qrbox"><div className="qrimg" dangerouslySetInnerHTML={{__html:qrSVG(bill.ref)}}/>
      <div style={{flex:1}}><div className="sub">PromptPay · {market.account}</div><div className="mono" style={{fontSize:15,fontWeight:600,margin:'2px 0 8px'}}>{market.promptpay}</div>
        <div style={{fontSize:30,fontWeight:700,color:'var(--brand-ink)'}}>{B(bill.total)}</div><div className="sub">อ้างอิง {bill.ref} · ครบกำหนด {thDate(bill.due)}</div></div></div>
    <div style={{marginTop:16,background:'#fff',border:'1px solid var(--hair)',borderRadius:12,padding:'6px 16px'}}>
      <div className="kv"><span className="k">{bill.rentModel==='gp'?('ค่าเช่า GP '+bill.gpRate+'% ของ '+B(bill.gpSales)):'ค่าเช่า'}</span><span className="v num">{B(bill.rent)}</span></div>
      {bill.service>0 && <div className="kv"><span className="k">ค่าส่วนกลาง</span><span className="v num">{B(bill.service)}</span></div>}
      <div className="kv"><span className="k">ค่าไฟ {bill.elecUnits} หน่วย</span><span className="v num">{B(bill.elecAmt)}</span></div>
      <div className="kv"><span className="k">ค่าน้ำ {bill.waterUnits} หน่วย</span><span className="v num">{B(bill.waterAmt)}</span></div>
      {vb.vat && <><div className="kv"><span className="k">มูลค่าก่อน VAT</span><span className="v num">{B1(vb.base)}</span></div><div className="kv"><span className="k">VAT {vb.rate}%</span><span className="v num">{B1(vb.vatAmt)}</span></div></>}
      <div className="kv total"><span className="k">รวมทั้งสิ้น</span><span className="v num">{B(bill.total)}</span></div>
    </div>
    <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}>
      <button className="btn gh sm" onClick={()=>openDoc('type=invoice&bill='+encodeURIComponent(bill.id))}>🧾 ใบแจ้งหนี้</button>
      {bill.status==='paid' && <button className="btn gh sm" onClick={()=>openDoc('type='+docType+'&bill='+encodeURIComponent(bill.id))}>📄 {market.vat?'ใบกำกับภาษี/ใบเสร็จ':'ใบเสร็จรับเงิน'}</button>}
    </div>
    {bill.status!=='paid'?<>
      <div className="note g" style={{margin:'14px 0'}}>สาธิตการจับยอด: "ยืนยันรับเงิน" = จำลองยอดโอนเข้าตรงกับบิล → ปลดล็อกอัตโนมัติ</div>
      <div style={{display:'flex',gap:10}}><button className="btn pri" style={{flex:1}} onClick={()=>onPaid(bill,'promptpay')}>✓ ยืนยันรับเงิน (จับยอด)</button>
        <button className={'btn '+(stall.locked?'gh':'dngh')} onClick={()=>onLock(stall.id)}>{stall.locked?'ปลดล็อก':'ล็อกสิทธิ์'}</button></div></>
      :<div className="note g" style={{marginTop:14}}>✓ จ่ายแล้ว · {bill.method==='promptpay'?'PromptPay':'เงินโอน'} · {thDateTime(bill.paidAt)}</div>}
  </Modal>);
}

/* ════ OWNER · GP & ยอดขาย ════ */
function GpView({data}){
  const {stalls,bills}=data; const [per,setPer]=useState(P0);
  const gp=stalls.filter(s=>s.rentModel==='gp'&&s.status==='occupied');
  const rows=gp.map(s=>({s,b:bills.find(x=>x.stallId===s.id&&x.period===per)}));
  const totSales=rows.reduce((a,r)=>a+(r.b?r.b.gpSales:0),0), totGp=rows.reduce((a,r)=>a+(r.b?r.b.rent:0),0);
  const totArea=gp.reduce((a,s)=>a+s.area,0);
  return (<div className="fade">
    <div className="toolbar"><div className="seg">{PERIODS.slice().reverse().map(p=><button key={p} className={per===p?'on':''} onClick={()=>setPer(p)}>{monthTH(p)}</button>)}</div></div>
    <div className="kpis">
      <Kpi label="ยูนิตคิด GP" value={gp.length} foot="ต้องใช้ KaiDee POS"/>
      <Kpi label="ยอดขายรวม (จาก POS)" value={B(totSales)} foot={monthTH(per)}/>
      <Kpi label="รายได้ GP ของตลาด" value={B(totGp)} foot={totSales?('เฉลี่ย '+(totGp/totSales*100).toFixed(1)+'%'):'—'} tone="var(--brand-ink)"/>
      <Kpi label="ยอดขาย/ตร.ม." value={B1(totArea?totSales/totArea:0)} foot="KPI ประสิทธิภาพพื้นที่" tone="var(--blue-ink)"/>
    </div>
    <div className="note blue" style={{marginBottom:16}}>ค่าเช่า GP = <b>max(การันตีขั้นต่ำ, GP% × ยอดขาย)</b> — ระบบดึงยอดขายจาก KaiDee POS (integration) คิดเป็นบิลอัตโนมัติ · ตัวดันให้แผงติดตั้ง POS</div>
    <div className="card panel" style={{marginBottom:16,borderColor:'#cfe0ef'}}>
      <h3>🔌 การเชื่อม KaiDee POS → ยอดขาย (gpSales)</h3>
      <div className="sub" style={{marginBottom:8}}>เมื่อขึ้นคลาวด์จริง POS ของแต่ละร้านจะส่งยอดขายเข้ามาตามรูปแบบนี้อัตโนมัติ (ตอนนี้คีย์มือในหน้าออกบิล):</div>
      <pre className="mono" style={{background:'var(--brand-softer)',borderRadius:10,padding:'10px 12px',fontSize:12,overflowX:'auto',margin:0}}>{'{ shopId, marketId, stallCode, period: "'+per+'", gpSales: 86000, source: "kaidee-pos" }'}</pre>
      <div className="sub" style={{marginTop:8}}>สถานะ: <span className="pill p-y">mock (คีย์มือ)</span> — เชื่อมจริงเมื่อขึ้น backend (เฟสคลาวด์) · โครงข้อมูลพร้อมแล้ว</div>
    </div>
    <div className="card" style={{overflow:'hidden'}}>
      <table><thead><tr><th>ยูนิต / ร้าน</th><th className="r">ตร.ม.</th><th className="r">ยอดขาย POS</th><th className="r">ขาย/ตร.ม.</th><th className="c">GP%</th><th className="r">GP×ยอด</th><th className="r">ค่าเช่าที่คิด</th><th className="c">เก็บเงิน</th></tr></thead>
        <tbody>{rows.map(({s,b})=>{ const gpx=b?Math.round(b.gpSales*s.gpRate/100):0, useMin=b&&b.rent===s.minG&&s.minG>gpx;
          return (<tr key={s.id}><td><b>{s.code}</b> {s.vendor}</td><td className="r num">{s.area}</td><td className="r num">{b?B(b.gpSales):'—'}</td>
            <td className="r num">{b?B1(b.gpSales/s.area):'—'}</td><td className="c num">{s.gpRate}%</td>
            <td className="r num" style={{color:useMin?'var(--ink-3)':'var(--ink)'}}>{b?B(gpx):'—'}</td>
            <td className="r num" style={{fontWeight:700,color:'var(--brand-ink)'}}>{b?B(b.rent):'—'}{useMin&&<span className="pill p-b" style={{marginLeft:6}}>ขั้นต่ำ</span>}</td>
            <td className="c">{billPill(b)}</td></tr>); })}
          <tr style={{background:'var(--brand-softer)',fontWeight:700}}><td>รวม</td><td className="r num">{totArea}</td><td className="r num">{B(totSales)}</td><td></td><td></td><td></td><td className="r num" style={{color:'var(--brand-ink)'}}>{B(totGp)}</td><td></td></tr>
        </tbody></table>
    </div>
  </div>);
}

/* ════ OWNER · Reports ════ */
function ReportsView({data}){
  const {market,stalls,bills}=data;
  const billedBy=p=>bills.filter(b=>b.period===p).reduce((a,b)=>a+b.total,0);
  const collBy=p=>bills.filter(b=>b.period===p&&b.status==='paid').reduce((a,b)=>a+b.total,0);
  const occ=stalls.filter(s=>s.status==='occupied');
  const baseRent=occ.reduce((a,s)=>a+baseRentOf(s),0);
  const byModel={}; occ.forEach(s=>{ byModel[s.rentModel]=(byModel[s.rentModel]||0)+baseRentOf(s); });
  const exportAll=()=>csv('รายงานตลาด.csv',[['รอบ','เรียกเก็บ','เก็บได้','ค้าง','อัตราเก็บ%']].concat(PERIODS.map(p=>{const bd=billedBy(p),cl=collBy(p);return [monthTH(p),bd,cl,bd-cl,bd?Math.round(cl/bd*100):0];})));
  return (<div className="fade">
    <div className="toolbar" style={{justifyContent:'flex-end'}}><button className="btn gh" onClick={exportAll}>⬇ ส่งออกลงบัญชี (CSV)</button></div>
    <div className="kpis">
      <Kpi label="ค่าเช่าฐาน/เดือน" value={B(baseRent)} foot={occ.length+' ยูนิตมีผู้เช่า'} tone="var(--brand-ink)"/>
      <Kpi label="เก็บได้ 3 รอบ" value={B(PERIODS.reduce((a,p)=>a+collBy(p),0))} foot="ย้อนหลัง 3 เดือน"/>
      <Kpi label="ค้างชำระสะสม" value={B(PERIODS.reduce((a,p)=>a+billedBy(p)-collBy(p),0))} tone="var(--red)"/>
      <Kpi label="อัตราการเช่า" value={Math.round(occ.length/stalls.length*100)+'%'} foot={(stalls.length-occ.length)+' ยูนิตว่าง'}/>
    </div>
    <div className="grid2">
      <div className="card panel"><h3>เรียกเก็บ vs เก็บได้จริง · รายเดือน</h3>
        <ChartBox type="bar" labels={PERIODS.map(monthTH)} datasets={[{label:'เรียกเก็บ',data:PERIODS.map(billedBy),backgroundColor:'#CDE9E3',borderRadius:6},{label:'เก็บได้',data:PERIODS.map(collBy),backgroundColor:'#0E9C88',borderRadius:6}]}/></div>
      <div className="card panel"><h3>สัดส่วนรายได้ตามรูปแบบค่าเช่า</h3>
        <BarList rows={Object.entries(byModel).map(([k,v])=>({k:RENT_MODELS[k],v}))} color="var(--blue)"/>
        <div className="note g" style={{marginTop:16}}>ส่งออก CSV ลงระบบบัญชีได้ (แยกค่าเช่า/ส่วนกลาง/น้ำ/ไฟ/GP){market.vat?' · แยกฐานภาษี+VAT '+market.vatRate+'%':' · ไม่คิด VAT'}</div></div>
    </div>
  </div>);
}

/* ════ OWNER · บัญชี (double-entry · ส่งสำนักงานบัญชีได้) ════ */
const ACCTS={ '1010':['เงินสด/ธนาคาร','asset'],'1140':['ลูกหนี้ค่าเช่า','asset'],'1150':['ภาษีซื้อ (ภาษีมูลค่าเพิ่มขอคืน)','asset'],
  '2130':['ภาษีขาย (ภาษีมูลค่าเพิ่มที่ต้องนำส่ง)','liab'],'4100':['รายได้ค่าเช่า','rev'],'4200':['รายได้ค่าบริการส่วนกลาง','rev'],
  '4300':['รายได้ค่าสาธารณูปโภค (น้ำ/ไฟ)','rev'],'5100':['ค่าใช้จ่ายในการดำเนินงาน','exp'] };
function buildJournal(data, mon){
  const {market,stalls,bills}=data; const exp=(data.expenses||[]); const rate=(market.vatRate||7)/100; const vat=!!market.vat;
  const inMon=(d)=>String(d||'').slice(0,7)===mon; const J=[];
  const split=(g)=> vat? Math.round(g/(1+rate)*100)/100 : g;
  bills.filter(b=>b.period===mon).forEach(b=>{ const st=stalls.find(s=>s.id===b.stallId); const nm=(st?st.code+' '+st.vendor:b.stallId);
    const rB=split(b.rent), sB=split(b.service||0), uB=split(b.elecAmt+b.waterAmt), vB=Math.round((b.total-(rB+sB+uB))*100)/100;
    const li=[['1140',b.total,0]]; li.push(['4100',0,rB]); if(sB>0)li.push(['4200',0,sB]); li.push(['4300',0,uB]); if(vat&&vB>0)li.push(['2130',0,vB]);
    J.push({date:mon+'-01',ref:b.ref,desc:'ออกบิลค่าเช่า '+nm,lines:li});
    if(b.status==='paid') J.push({date:new Date(b.paidAt).toISOString().slice(0,10),ref:b.ref,desc:'รับชำระ '+nm+' ('+(b.method==='promptpay'?'PromptPay':'โอน')+')',lines:[['1010',b.total,0],['1140',0,b.total]]});
  });
  exp.filter(e=>inMon(e.date)).forEach(e=>{ const li=[['5100',e.vatBase||e.total,0]]; if(vat&&e.vat>0)li.push(['1150',e.vat,0]); li.push(['1010',0,e.total]);
    J.push({date:e.date,ref:e.supplierTaxId||'',desc:'ค่าใช้จ่าย: '+e.note,lines:li}); });
  J.sort((a,b)=>(a.date+a.ref).localeCompare(b.date+b.ref)); return J;
}
function AccountingView({data}){
  const {market}=data; const [mon,setMon]=useState(P0); const [view,setView]=useState('pl');
  const J=buildJournal({...data},mon); const monTxt=mon.split('-')[1]+'/'+mon.split('-')[0];
  const gl={}; J.forEach(j=>j.lines.forEach(([ac,dr,cr])=>{ (gl[ac]=gl[ac]||{dr:0,cr:0,rows:[]}); gl[ac].dr+=dr; gl[ac].cr+=cr; gl[ac].rows.push({date:j.date,desc:j.desc,dr,cr}); }));
  const bal=(ac)=>{ const g=gl[ac]||{dr:0,cr:0}; const t=ACCTS[ac][1]; return (t==='asset'||t==='exp')?(g.dr-g.cr):(g.cr-g.dr); };
  const rev=Object.keys(ACCTS).filter(a=>ACCTS[a][1]==='rev').reduce((s,a)=>s+bal(a),0);
  const exps=Object.keys(ACCTS).filter(a=>ACCTS[a][1]==='exp').reduce((s,a)=>s+bal(a),0);
  const totDr=J.reduce((s,j)=>s+j.lines.reduce((a,l)=>a+l[1],0),0), totCr=J.reduce((s,j)=>s+j.lines.reduce((a,l)=>a+l[2],0),0);
  const exJournal=()=>csv('สมุดรายวัน_'+mon+'.csv',[['วันที่','อ้างอิง','คำอธิบาย','รหัสบัญชี','ชื่อบัญชี','เดบิต','เครดิต']].concat(
    J.flatMap(j=>j.lines.map((l,i)=>[i===0?j.date:'',i===0?j.ref:'',i===0?j.desc:'',l[0],ACCTS[l[0]][0],l[1]?l[1].toFixed(2):'',l[2]?l[2].toFixed(2):'']))).concat([['','','รวม','','',totDr.toFixed(2),totCr.toFixed(2)]]));
  const exTB=()=>csv('งบทดลอง_'+mon+'.csv',[['รหัส','ชื่อบัญชี','เดบิต','เครดิต']].concat(Object.keys(ACCTS).filter(a=>gl[a]).map(a=>[a,ACCTS[a][0],gl[a].dr.toFixed(2),gl[a].cr.toFixed(2)])).concat([['','รวม',totDr.toFixed(2),totCr.toFixed(2)]]));
  const exPL=()=>csv('งบกำไรขาดทุน_'+mon+'.csv',[['รายการ','จำนวน'],['รายได้รวม',rev.toFixed(2)],['ค่าใช้จ่ายรวม',exps.toFixed(2)],['กำไร(ขาดทุน)สุทธิ',(rev-exps).toFixed(2)]]);
  return (<div className="fade">
    <div className="toolbar" style={{gap:12}}>
      <div className="seg">{[['pl','งบกำไรขาดทุน'],['journal','สมุดรายวัน'],['gl','แยกประเภท'],['tb','งบทดลอง']].map(([k,l])=><button key={k} className={view===k?'on':''} onClick={()=>setView(k)}>{l}</button>)}</div>
      <div className="grow"/>
      <select className="field" style={{maxWidth:150}} value={mon} onChange={e=>setMon(e.target.value)}>{PERIODS.slice().reverse().map(p=><option key={p} value={p}>{monthTH(p)}</option>)}</select>
      <button className="btn gh" onClick={view==='journal'?exJournal:view==='tb'?exTB:exPL} disabled={view==='gl'}>⬇ CSV</button>
    </div>
    <div className="note g" style={{marginBottom:16}}>ระบบลงบัญชีคู่ (เดบิต/เครดิต) อัตโนมัติจากบิลค่าเช่า+ค่าใช้จ่าย — Export ส่งสำนักงานบัญชี/ผู้สอบบัญชีได้ (สมุดรายวัน · แยกประเภท · งบทดลอง · งบกำไรขาดทุน){!market.registered?' · ตลาดนี้ไม่ได้จดนิติบุคคล ใช้เป็นบันทึกรายรับ-รายจ่าย':''}</div>
    {view==='pl' && <>
      <div className="kpis"><Kpi label="รายได้รวม" value={B(rev)} tone="var(--brand-ink)" foot={monthTH(mon)}/><Kpi label="ค่าใช้จ่ายรวม" value={B(exps)} tone="var(--gold)"/><Kpi label="กำไร(ขาดทุน)สุทธิ" value={B(rev-exps)} tone={rev-exps>=0?'var(--green)':'var(--red)'} foot="ก่อนภาษีเงินได้"/></div>
      <div className="card panel" style={{maxWidth:600}}><h3 style={{marginTop:0}}>งบกำไรขาดทุน · {monTxt}</h3>
        {['4100','4200','4300'].filter(a=>gl[a]).map(a=><div key={a} className="kv"><span className="k">{ACCTS[a][0]}</span><span className="v num">{bal(a).toFixed(2)}</span></div>)}
        <div className="kv" style={{fontWeight:700,color:'var(--brand-ink)'}}><span className="k">รวมรายได้</span><span className="v num">{rev.toFixed(2)}</span></div>
        <div className="kv" style={{marginTop:8}}><span className="k">หัก ค่าใช้จ่ายในการดำเนินงาน</span><span className="v num">({exps.toFixed(2)})</span></div>
        <div className="kv total"><span className="k">กำไร(ขาดทุน)สุทธิ</span><span className="v num" style={{color:rev-exps>=0?'var(--green)':'var(--red)'}}>{(rev-exps).toFixed(2)}</span></div>
        <div className="sub" style={{marginTop:12}}>* VAT ไม่รวมในงบกำไรขาดทุน (เป็นภาษีที่นำส่ง/ขอคืน ดูแท็บรายงานภาษี)</div>
      </div>
    </>}
    {view==='journal' && <div className="card" style={{overflow:'hidden'}}>
      <table><thead><tr><th>วันที่</th><th>คำอธิบาย</th><th>บัญชี</th><th className="r">เดบิต</th><th className="r">เครดิต</th></tr></thead>
        <tbody>{J.length?J.flatMap((j,ji)=>j.lines.map((l,i)=><tr key={ji+'-'+i} style={i===j.lines.length-1?{borderBottom:'2px solid var(--hair-2)'}:null}>
          <td>{i===0?thDate(j.date):''}</td><td>{i===0?j.desc:''}</td><td><span className="mono" style={{fontSize:12}}>{l[0]}</span> {ACCTS[l[0]][0]}</td>
          <td className="r num">{l[1]?l[1].toFixed(2):''}</td><td className="r num">{l[2]?l[2].toFixed(2):''}</td></tr>))
          :<tr><td colSpan="5" className="empty">ไม่มีรายการในเดือนนี้</td></tr>}</tbody>
        {J.length>0&&<tfoot><tr style={{fontWeight:700,background:'var(--brand-softer)'}}><td colSpan="3">รวม</td><td className="r num">{totDr.toFixed(2)}</td><td className="r num">{totCr.toFixed(2)}</td></tr></tfoot>}</table></div>}
    {view==='gl' && <div style={{display:'grid',gap:14}}>{Object.keys(ACCTS).filter(a=>gl[a]).map(a=>(<div key={a} className="card panel">
      <h3 style={{marginTop:0,fontSize:14}}><span className="mono">{a}</span> · {ACCTS[a][0]} <span className="r-lnk" style={{color:bal(a)>=0?'var(--brand-ink)':'var(--red)'}}>ยอดคงเหลือ {B(Math.abs(bal(a)))}</span></h3>
      <table><thead><tr><th>วันที่</th><th>คำอธิบาย</th><th className="r">เดบิต</th><th className="r">เครดิต</th></tr></thead>
        <tbody>{gl[a].rows.map((r,i)=><tr key={i}><td>{thDate(r.date)}</td><td>{r.desc}</td><td className="r num">{r.dr?r.dr.toFixed(2):''}</td><td className="r num">{r.cr?r.cr.toFixed(2):''}</td></tr>)}</tbody></table></div>))}</div>}
    {view==='tb' && <div className="card" style={{overflow:'hidden'}}>
      <table><thead><tr><th>รหัส</th><th>ชื่อบัญชี</th><th className="c">ประเภท</th><th className="r">เดบิต</th><th className="r">เครดิต</th></tr></thead>
        <tbody>{Object.keys(ACCTS).filter(a=>gl[a]).map(a=><tr key={a}><td className="mono">{a}</td><td>{ACCTS[a][0]}</td><td className="c"><span className="pill p-n">{({asset:'สินทรัพย์',liab:'หนี้สิน',rev:'รายได้',exp:'ค่าใช้จ่าย'})[ACCTS[a][1]]}</span></td><td className="r num">{gl[a].dr.toFixed(2)}</td><td className="r num">{gl[a].cr.toFixed(2)}</td></tr>)}</tbody>
        <tfoot><tr style={{fontWeight:700,background:'var(--brand-softer)'}}><td colSpan="3">รวม (เดบิต = เครดิต)</td><td className="r num">{totDr.toFixed(2)}</td><td className="r num">{totCr.toFixed(2)}</td></tr></tfoot></table>
      <div className="sub" style={{padding:'12px 16px'}}>เดบิตรวม = เครดิตรวม แสดงว่าบัญชีดุล ✓ พร้อมส่งสำนักงานบัญชี</div></div>}
  </div>);
}

/* ════ OWNER · แพ็กเกจ & ชำระเงิน (Subscription) ════ */
const PLANS=[
  {id:'S',name:'S · ตลาดเล็ก',price:1990,max:100,feat:['บิลค่าเช่า/น้ำไฟ','เช่าแผง + ผูกร้าน','เก็บเงิน PromptPay','รายงานพื้นฐาน','ผู้ใช้ 2 คน']},
  {id:'M',name:'M · ตลาดกลาง',price:4990,max:400,feat:['ครบชุด S','GP Settlement','บัญชี double-entry','รายงานภาษี (ภ.พ.30)','หลายผู้ใช้ + สิทธิ์']},
  {id:'L',name:'L · ตลาดใหญ่',price:9990,max:99999,feat:['ครบทุกโมดูล','Wallet / สินเชื่อร้านค้า','ขายฝาก (คลังกลาง)','จัดการหลายตลาด','ผู้ดูแลระบบเฉพาะ']},
];
const ADDONS=[{id:'acct',name:'บัญชี double-entry',price:590},{id:'consign',name:'ขายฝาก (คลังกลาง)',price:490},{id:'wallet',name:'Wallet / สินเชื่อ',price:990},{id:'vat',name:'รายงานภาษี ภ.พ.30',price:390}];
function SubscribeView({data,setData}){
  const {market,stalls}=data; const sub=market.sub||{plan:null,addons:[],paidUntil:null,cycle:'monthly'};
  const suggested=PLANS.find(p=>stalls.length<=p.max)||PLANS[PLANS.length-1];
  const [plan,setPlan]=useState(sub.plan||suggested.id);
  const [addons,setAddons]=useState(sub.addons||[]);
  const [cycle,setCycle]=useState(sub.cycle||'monthly');
  const [pay,setPay]=useState(false);
  const [method,setMethod]=useState('wallet'); const [wTick,setWTick]=useState(0);
  const KDW=window.KDW; const WP=window.KDWalletPanel;
  const bizId=KDW?KDW.biz('market',market.id):'';
  const cur=PLANS.find(p=>p.id===plan)||suggested;
  const addonSum=ADDONS.filter(a=>addons.includes(a.id)).reduce((s,a)=>s+a.price,0);
  const monthly=cur.price+addonSum;
  const yr=cycle==='yearly'; const total=yr?Math.round(monthly*10):monthly; // รายปี = จ่าย 10 เดือน (ฟรี 2)
  const ref='SUB'+market.id.toUpperCase().slice(-3)+new Date().getFullYear().toString().slice(2)+(new Date().getMonth()+1).toString().padStart(2,'0');
  const toggle=(id)=>setAddons(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);
  const active=sub.paidUntil&&new Date(sub.paidUntil)>=new Date();
  const doPay=()=>{ if(method==='wallet'){ if(!KDW){ alert('กระเป๋าเงินยังไม่พร้อม (kd-wallet.jsx)'); return; }
      const res=KDW.charge(bizId,total,{who:market.name,sub:'ค่าบริการระบบตลาด '+cur.name+(yr?' (รายปี)':' (รายเดือน)'),ref,type:'fee'});
      if(!res.ok){ setWTick(x=>x+1); alert(res.short>0?('ยอดกระเป๋าไม่พอ · ขาดอีก '+KDW.fmt(res.short)+' → เติมเงินก่อน'):res.error); return; } setWTick(x=>x+1); }
    const until=addMonths(P0+'-01',yr?12:1); setData(d=>{ const m=d.markets.find(x=>x.id===market.id); m.sub={plan,addons,cycle,paidUntil:until,paidAt:todayISO(),ref,amount:total,method:method==='wallet'?'wallet':'promptpay'}; return {...d}; }); setPay(false); };
  return (<div className="fade">
    <div className={'note '+(active?'g':'')} style={{marginBottom:16}}>{active?('✅ แพ็กเกจใช้งานอยู่ · '+(PLANS.find(p=>p.id===sub.plan)||{}).name+' · ชำระถึง '+thDate(sub.paidUntil)):'⚠️ ยังไม่ได้เปิดใช้แพ็กเกจ — เลือกแพ็กเกจแล้วชำระเงินเพื่อเปิดใช้ระบบเต็มรูปแบบ'}</div>
    <div className="kpis">
      <Kpi label="ตลาดนี้มีแผง" value={stalls.length+' แผง'} foot={'แนะนำแพ็ก '+suggested.id}/>
      <Kpi label="แพ็กเกจที่เลือก" value={cur.id} foot={cur.name} tone="var(--brand-ink)"/>
      <Kpi label="ยอดชำระ/รอบ" value={B(total)} tone="var(--green)" foot={yr?'รายปี (ฟรี 2 เดือน)':'รายเดือน'}/>
      <Kpi label="สถานะ" value={active?'ใช้งานอยู่':'ยังไม่เปิด'} tone={active?'var(--green)':'var(--red)'} foot={active?('ถึง '+thDate(sub.paidUntil)):'รอชำระ'}/>
    </div>
    {WP?<div style={{marginBottom:16,maxWidth:520}} key={wTick}><WP biz={bizId} who={market.name} due={total}
      dueLabel={'ค่าบริการระบบ '+cur.id+(yr?' · รายปี':' · รายเดือน')} onChange={()=>setWTick(x=>x+1)}/></div>
      :<div className="note" style={{marginBottom:16}}>ยังไม่ได้โหลดกระเป๋าเงิน (kd-wallet.jsx)</div>}
    <div className="seg" style={{marginBottom:16}}>{[['monthly','รายเดือน'],['yearly','รายปี · ฟรี 2 เดือน']].map(([k,l])=><button key={k} className={cycle===k?'on':''} onClick={()=>setCycle(k)}>{l}</button>)}</div>
    <div className="grid3">{PLANS.map((p,i)=>{ const on=plan===p.id; return (
      <div key={p.id} className={'card '+(on?'sel':'')} style={{cursor:'pointer',borderColor:on?'var(--brand)':'',borderWidth:on?2:1,position:'relative'}} onClick={()=>setPlan(p.id)}>
        {suggested.id===p.id && <span className="pill p-g" style={{position:'absolute',top:12,right:12}}>แนะนำ</span>}
        <div className="sub" style={{fontWeight:700,color:'var(--brand-ink)'}}>{p.name}</div>
        <div style={{fontSize:30,fontWeight:800,margin:'6px 0'}}>{B(p.price)}<span style={{fontSize:14,fontWeight:600,color:'var(--ink-3)'}}>/เดือน</span></div>
        <div className="sub" style={{marginBottom:8}}>สูงสุด {p.max>=99999?'ไม่จำกัด':p.max+' แผง'}</div>
        <ul style={{margin:0,paddingLeft:18,fontSize:13,lineHeight:1.9}}>{p.feat.map(f=><li key={f}>{f}</li>)}</ul>
        <div style={{marginTop:12,textAlign:'center',fontWeight:700,color:on?'var(--brand-ink)':'var(--ink-3)'}}>{on?'✓ เลือกแล้ว':'เลือกแพ็กนี้'}</div>
      </div>); })}</div>
    <div className="card panel" style={{marginTop:16}}>
      <h3>โมดูลเสริม (add-on)</h3>
      <div className="sub" style={{marginBottom:10}}>เปิดเฉพาะที่ใช้ — แพ็ก M/L รวมบางโมดูลให้แล้ว เลือกเพิ่มได้ตามต้องการ</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>{ADDONS.map(a=>{ const on=addons.includes(a.id); return (
        <label key={a.id} className="row" style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',border:'1px solid var(--line)',borderRadius:10,cursor:'pointer',background:on?'var(--brand-soft)':'#fff'}}>
          <input type="checkbox" checked={on} onChange={()=>toggle(a.id)}/><span style={{flex:1,fontWeight:600}}>{a.name}</span><span className="num">+{B(a.price)}/ด.</span></label>); })}</div>
    </div>
    <div className="card panel" style={{marginTop:16,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
      <div><div className="sub">รวมชำระ ({yr?'รายปี':'รายเดือน'})</div><div style={{fontSize:32,fontWeight:800,color:'var(--brand-ink)'}}>{B(total)}</div><div className="sub">{cur.name}{addonSum?(' + add-on '+B(addonSum)+'/ด.'):''} {yr?'· คิด 10 เดือน (ฟรี 2)':''}</div></div>
      <button className="btn pri" style={{fontSize:16,padding:'14px 28px'}} onClick={()=>setPay(true)}>{active?'ต่ออายุ / เปลี่ยนแพ็ก':'ชำระเงินเปิดใช้'}</button>
    </div>
    {pay && <Modal title="ชำระเงินแพ็กเกจ" tag="กระเป๋าเงิน / PromptPay · โปรแกรมตลาด" onClose={()=>setPay(false)} max={460}>
      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
        {[['wallet','กระเป๋าเงินตลาด (Wallet)',KDW?('คงเหลือ '+KDW.fmt(KDW.balance(bizId))):'ยังไม่พร้อม'],['promptpay','สแกน PromptPay จ่ายตรง','โอนแล้วกดยืนยัน']].map(([k,l,s])=>(
          <label key={k} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',border:'1.5px solid '+(method===k?'var(--brand)':'var(--line)'),borderRadius:10,cursor:'pointer',background:method===k?'var(--brand-soft)':'#fff'}}>
            <input type="radio" checked={method===k} onChange={()=>setMethod(k)}/><span style={{flex:1,fontWeight:700}}>{l}</span><span className="sub">{s}</span></label>))}
        <label style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',border:'1px dashed var(--line)',borderRadius:10,opacity:.55}}>
          <input type="radio" disabled/><span style={{flex:1,fontWeight:700}}>บัตรเครดิต / ตัดอัตโนมัติ</span><span className="sub">รองรับ · ยังไม่เปิด</span></label>
      </div>
      {method==='wallet'&&KDW?<div className="box" style={{background:'var(--bg-soft)',borderRadius:10,padding:'12px 14px',marginBottom:12,fontSize:13.5,lineHeight:1.8}}>
        <div style={{display:'flex',justifyContent:'space-between'}}><span>ยอดกระเป๋า</span><span className="num">{KDW.fmt(KDW.balance(bizId))}</span></div>
        <div style={{display:'flex',justifyContent:'space-between'}}><span>หักรอบนี้</span><span className="num">-{B(total)}</span></div>
        {KDW.balance(bizId)<total?<div style={{color:'var(--red)',fontWeight:700,marginTop:4}}>ขาดอีก {KDW.fmt(total-KDW.balance(bizId))} · เติมเงินที่การ์ดกระเป๋าเงินด้านหลัง</div>:null}
      </div>:null}
      <div className="qrbox" style={{marginBottom:12,display:method==='promptpay'?'':'none'}}><div className="qrimg" dangerouslySetInnerHTML={{__html:qrSVG(ref)}}/>
        <div style={{flex:1}}><div className="sub">PromptPay · KaiDee Platform</div><div className="mono" style={{fontSize:15,fontWeight:600,margin:'2px 0 8px'}}>0-9-XXXX-XXXX-X</div>
          <div style={{fontSize:30,fontWeight:800,color:'var(--brand-ink)'}}>{B(total)}</div><div className="sub">อ้างอิง {ref}</div></div></div>
      <div className="box" style={{background:'var(--bg-soft)',borderRadius:10,padding:'12px 14px',fontSize:13.5,lineHeight:1.9}}>
        <div style={{display:'flex',justifyContent:'space-between'}}><span>แพ็กเกจ {cur.name}</span><span>{B(yr?cur.price*10:cur.price)}</span></div>
        {ADDONS.filter(a=>addons.includes(a.id)).map(a=><div key={a.id} style={{display:'flex',justifyContent:'space-between',color:'var(--ink-3)'}}><span>+ {a.name}</span><span>{B(yr?a.price*10:a.price)}</span></div>)}
        <div style={{display:'flex',justifyContent:'space-between',borderTop:'2px solid var(--ink)',marginTop:8,paddingTop:8,fontWeight:800,fontSize:15}}><span>รวม</span><span style={{color:'var(--brand-ink)'}}>{B(total)}</span></div>
      </div>
      <button className="btn pri" style={{marginTop:16,width:'100%',fontSize:15,padding:'13px'}} disabled={method==='wallet'&&(!KDW||KDW.balance(bizId)<total)} onClick={doPay}>{method==='wallet'?('✓ หักจากกระเป๋าเงิน '+B(total)):'✓ ยืนยันชำระเงินแล้ว (จำลอง)'}</button>
      <div className="sub" style={{textAlign:'center',marginTop:8}}>* เดโม — ระบบจริงจับยอดเข้าอัตโนมัติผ่าน Virtual Account / webhook</div>
    </Modal>}
  </div>);
}

/* ════ OWNER · ขายฝาก (Consignment · โมดูลเสริม) ════ */
const CSMODEL={ per_sale:{th:'แบ่ง %',cls:'p-b'}, wholesale:{th:'ซื้อขาด',cls:'p-g'}, rental:{th:'ค่าเช่าชั้น',cls:'p-y'} };
function ConsignView({data,setData}){
  const {market}=data; const vendors=(data.cVendors||[]); const stock=(data.cStock||[]);
  const [sub,setSub]=useState('stock'); const [edit,setEdit]=useState(null); const [vend,setVend]=useState(null);
  const cl=(cs)=>MK.consignLine(cs);
  const byVendor={}; stock.forEach(cs=>{ const r=cl(cs); const v=cs.vendorId; (byVendor[v]=byVendor[v]||{gross:0,payout:0,shopCut:0,items:0}); byVendor[v].gross+=r.gross; byVendor[v].payout+=r.payout; byVendor[v].shopCut+=r.shopCut; byVendor[v].items++; });
  const totGross=stock.reduce((a,cs)=>a+cl(cs).gross,0), totPayout=Object.values(byVendor).reduce((a,v)=>a+v.payout,0), totRev=Object.values(byVendor).reduce((a,v)=>a+v.shopCut,0);
  const vName=(id)=>(vendors.find(v=>v.id===id)||{}).name||'—';
  const saveStock=(cs)=>{ setData(d=>{ d.cStock=d.cStock||[]; if(cs.id){ Object.assign(d.cStock.find(x=>x.id===cs.id),cs); } else { d.cStock.push({...cs,id:'cst'+Date.now().toString(36),marketId:market.id,_sold:0}); } return {...d}; }); setEdit(null); };
  const saveVendor=(v)=>{ setData(d=>{ d.cVendors=d.cVendors||[]; if(v.id){ Object.assign(d.cVendors.find(x=>x.id===v.id),v); } else { d.cVendors.push({...v,id:'cv'+Date.now().toString(36),marketId:market.id}); } return {...d}; }); setVend(null); };
  const docCtx=(vid)=>{ const v=byVendor[vid]||{gross:0,shopCut:0,payout:0}; const vObj=vendors.find(x=>x.id===vid)||{name:vName(vid)};
    const lines=stock.filter(cs=>cs.vendorId===vid&&(cs._sold||0)>0).map(cs=>{ const r=cl(cs); return {name:cs.name,sku:cs.sku,qty:cs._sold,price:cs.price,gross:r.gross,shopCut:r.shopCut,payout:r.payout}; });
    return {shop:{account:market.account||market.name,name:market.name,taxId:market.taxId,address:market.address},vendor:vObj,period:monthTH(P0),lines,gross:v.gross,shopCut:v.shopCut,payout:v.payout,whtPct:3}; };
  return (<div className="fade">
    <div className="note g" style={{marginBottom:16}}>โมดูลเสริม — ตลาดเปิด "ร้านของฝากกลาง/ชั้นวางฝากขาย" รับสินค้าจากชาวบ้าน/แบรนด์เล็กมาขายรวม รับรู้เฉพาะส่วนแบ่ง/ค่าเช่าเป็นรายได้ ที่เหลือเป็นเจ้าหนี้คืนคู่ค้า · เอนจินเดียวกับ KaiDee POS</div>
    <div className="seg" style={{marginBottom:16}}>{[['stock','คลังฝากกลาง'],['vendors','คู่ค้า (ผู้ฝาก)'],['settle','เคลียร์เงิน & เอกสาร']].map(([k,l])=><button key={k} className={sub===k?'on':''} onClick={()=>setSub(k)}>{l}</button>)}</div>
    <div className="kpis">
      <Kpi label="สินค้าฝากขาย" value={stock.length} foot={vendors.length+' คู่ค้า'} tone="var(--brand-ink)"/>
      <Kpi label="ยอดขายฝากรวม" value={B(totGross)} foot={monthTH(P0)}/>
      <Kpi label="รายได้ตลาด (ส่วนแบ่ง)" value={B(totRev)} tone="var(--green)" foot="หลังหักคืนคู่ค้า"/>
      <Kpi label="ค้างจ่ายคืนคู่ค้า" value={B(totPayout)} tone="var(--red)" foot="Pending payout"/>
    </div>
    {sub==='stock' && <>
      <div className="toolbar"><div className="grow"/><button className="btn pri" onClick={()=>setEdit({settleModel:'per_sale',sharePct:20,unit:'ชิ้น'})}>+ เพิ่มสินค้าฝาก</button></div>
      <div className="card" style={{overflow:'hidden'}}>
        <table><thead><tr><th>SKU · สินค้า</th><th>คู่ค้า</th><th className="c">โมเดล</th><th className="r">ราคา</th><th className="r">คงเหลือ</th><th className="r">ขายแล้ว</th><th className="r">คืนคู่ค้า</th></tr></thead>
          <tbody>{stock.length?stock.map(cs=>{ const r=cl(cs); const m=CSMODEL[cs.settleModel]||{th:cs.settleModel,cls:'p-n'}; const out=(Number(cs.stock)||0)<=0&&cs.settleModel!=='rental';
            return (<tr className="row" key={cs.id} onClick={()=>setEdit(cs)}><td><b>{cs.name}</b> <span className="mono" style={{fontSize:11,color:'var(--ink-3)'}}>{cs.sku}</span></td>
              <td style={{fontSize:12.5}}>{vName(cs.vendorId)}</td><td className="c"><span className={'pill '+m.cls}>{m.th}{cs.settleModel==='per_sale'?' '+cs.sharePct+'%':''}</span></td>
              <td className="r num">{cs.settleModel==='rental'?'—':B(cs.price)}</td><td className="r num" style={{color:out?'var(--red)':'inherit',fontWeight:700}}>{cs.settleModel==='rental'?'—':(Number(cs.stock)||0)+(out?' · หมด':'')}</td>
              <td className="r num">{cs._sold||'—'}</td><td className="r num" style={{fontWeight:700,color:'var(--red)'}}>{B(r.payout)}</td></tr>); }):<tr><td colSpan="7" className="empty">ยังไม่มีสินค้าฝากขาย</td></tr>}</tbody></table>
      </div>
    </>}
    {sub==='vendors' && <>
      <div className="toolbar"><div className="grow"/><button className="btn pri" onClick={()=>setVend({})}>+ เพิ่มคู่ค้า</button></div>
      <div className="card" style={{overflow:'hidden'}}>
        <table><thead><tr><th>คู่ค้า (ผู้ฝากขาย)</th><th>จังหวัด</th><th>เบอร์ · บัญชี</th><th className="r">รายการ</th><th className="r">ยอดขาย</th><th className="r">ต้องโอนคืน</th><th></th></tr></thead>
          <tbody>{vendors.length?vendors.map(v=>{ const b=byVendor[v.id]||{items:0,gross:0,payout:0}; return (<tr key={v.id}><td style={{fontWeight:600}}>{v.name}</td><td style={{fontSize:12.5}}>{v.province||'—'}</td><td style={{fontSize:12}}>{v.phone} · {v.bank} {v.acctNo}</td><td className="r num">{b.items}</td><td className="r num">{B(b.gross)}</td><td className="r num" style={{color:'var(--red)',fontWeight:700}}>{B(b.payout)}</td><td className="r"><button className="btn gh sm" onClick={()=>setVend(v)}>แก้ไข</button></td></tr>); }):<tr><td colSpan="7" className="empty">ยังไม่มีคู่ค้า</td></tr>}</tbody></table>
      </div>
    </>}
    {sub==='settle' && <div className="card panel">
      <h3>เคลียร์เงินคืนคู่ค้า + เอกสาร</h3>
      <table><thead><tr><th>คู่ค้า</th><th className="r">รายการ</th><th className="r">ยอดขาย</th><th className="r">ส่วนแบ่งตลาด</th><th className="r">ต้องโอนคืน</th><th>เอกสาร</th></tr></thead>
        <tbody>{Object.entries(byVendor).length?Object.entries(byVendor).map(([vid,v])=>(<tr key={vid}><td style={{fontWeight:600}}>{vName(vid)}</td><td className="r num">{v.items}</td><td className="r num">{B(v.gross)}</td><td className="r num" style={{color:'var(--green)',fontWeight:700}}>{B(v.shopCut)}</td><td className="r num" style={{color:'var(--red)',fontWeight:700}}>{B(v.payout)}</td>
          <td className="r" style={{whiteSpace:'nowrap'}}><button className="btn pri sm" onClick={()=>openConsignDoc('settle',docCtx(vid))}>🧾 ใบเคลียร์เงิน</button> <button className="btn gh sm" onClick={()=>openConsignDoc('wht',docCtx(vid))}>หัก ณ ที่จ่าย</button></td></tr>)):<tr><td colSpan="6" className="empty">ยังไม่มียอดขายฝาก</td></tr>}</tbody></table>
      <div className="sub" style={{marginTop:12}}>ส่วนแบ่งตลาด = ยอดขาย × %ตลาด · คืนคู่ค้า = ยอดขาย − ส่วนแบ่ง · ซื้อขาด = ตลาดได้ 100% (กำไร=ขาย−ทุน) · ค่าเช่าชั้น = คืนคู่ค้าเต็ม + ตลาดรับค่าเช่าคงที่</div>
    </div>}
    {edit && <ConsignItemForm item={edit} vendors={vendors} onSave={saveStock} onClose={()=>setEdit(null)}/>}
    {vend && <ConsignVendorForm vendor={vend} onSave={saveVendor} onClose={()=>setVend(null)}/>}
  </div>);
}
function ConsignItemForm({item,vendors,onSave,onClose}){
  const [f,setF]=useState({name:item.name||'',sku:item.sku||'',vendorId:item.vendorId||(vendors[0]&&vendors[0].id)||'',price:item.price||0,settleModel:item.settleModel||'per_sale',sharePct:item.sharePct||20,costWholesale:item.costWholesale||0,rentalFee:item.rentalFee||0,stock:item.stock||0,unit:item.unit||'ชิ้น',id:item.id});
  const set=(k,v)=>setF({...f,[k]:v});
  return (<Modal title={item.id?'แก้ไขสินค้าฝาก':'เพิ่มสินค้าฝาก'} tag="โมดูลขายฝาก · ตลาด" onClose={onClose} max={520}>
    <label className="lb">ชื่อสินค้า</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)}/>
    <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
      <div><label className="lb">SKU</label><input className="field" value={f.sku} onChange={e=>set('sku',e.target.value)}/></div>
      <div><label className="lb">คู่ค้า (ผู้ฝาก)</label><select className="field" value={f.vendorId} onChange={e=>set('vendorId',e.target.value)}>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
    </div>
    <label className="lb">โมเดลการจ่ายเงิน</label>
    <div className="seg" style={{width:'100%'}}>{Object.entries(CSMODEL).map(([k,v])=><button key={k} style={{flex:1}} className={f.settleModel===k?'on':''} onClick={()=>set('settleModel',k)}>{v.th}</button>)}</div>
    <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr',marginTop:6}}>
      {f.settleModel!=='rental' && <div><label className="lb">ราคาขาย</label><input className="field" type="number" value={f.price} onChange={e=>set('price',e.target.value)}/></div>}
      {f.settleModel==='per_sale' && <div><label className="lb">ตลาดหัก %</label><input className="field" type="number" value={f.sharePct} onChange={e=>set('sharePct',e.target.value)}/></div>}
      {f.settleModel==='wholesale' && <div><label className="lb">ทุนซื้อขาด/ชิ้น</label><input className="field" type="number" value={f.costWholesale} onChange={e=>set('costWholesale',e.target.value)}/></div>}
      {f.settleModel==='rental' && <div><label className="lb">ค่าเช่าชั้น/เดือน</label><input className="field" type="number" value={f.rentalFee} onChange={e=>set('rentalFee',e.target.value)}/></div>}
    </div>
    {f.settleModel!=='rental' && <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
      <div><label className="lb">คงเหลือ</label><input className="field" type="number" value={f.stock} onChange={e=>set('stock',e.target.value)}/></div>
      <div><label className="lb">หน่วย</label><input className="field" value={f.unit} onChange={e=>set('unit',e.target.value)}/></div></div>}
    <button className="btn pri" style={{marginTop:18,width:'100%'}} onClick={()=>onSave({...f,price:+f.price,sharePct:+f.sharePct,costWholesale:+f.costWholesale,rentalFee:+f.rentalFee,stock:+f.stock})} disabled={!f.name}>บันทึก</button>
  </Modal>);
}
function ConsignVendorForm({vendor,onSave,onClose}){
  const [f,setF]=useState({name:vendor.name||'',phone:vendor.phone||'',province:vendor.province||'',taxId:vendor.taxId||'',bank:vendor.bank||'',acctNo:vendor.acctNo||'',id:vendor.id});
  const set=(k,v)=>setF({...f,[k]:v});
  return (<Modal title={vendor.id?'แก้ไขคู่ค้า':'เพิ่มคู่ค้า (ผู้ฝากขาย)'} tag="โมดูลขายฝาก · ตลาด" onClose={onClose} max={480}>
    <label className="lb">ชื่อคู่ค้า / กลุ่ม</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)}/>
    <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
      <div><label className="lb">เบอร์โทร</label><input className="field" value={f.phone} onChange={e=>set('phone',e.target.value)}/></div>
      <div><label className="lb">จังหวัด</label><input className="field" value={f.province} onChange={e=>set('province',e.target.value)}/></div></div>
    <label className="lb">เลขผู้เสียภาษี (ถ้ามี)</label><input className="field mono" value={f.taxId} onChange={e=>set('taxId',e.target.value)}/>
    <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
      <div><label className="lb">ธนาคาร</label><input className="field" value={f.bank} onChange={e=>set('bank',e.target.value)}/></div>
      <div><label className="lb">เลขบัญชี</label><input className="field mono" value={f.acctNo} onChange={e=>set('acctNo',e.target.value)}/></div></div>
    <button className="btn pri" style={{marginTop:18,width:'100%'}} onClick={()=>onSave(f)} disabled={!f.name}>บันทึก</button>
  </Modal>);
}
// เอกสารคู่ค้าขายฝาก (ใบเคลียร์เงิน / หัก ณ ที่จ่าย) — เปิดหน้าต่างพิมพ์
function openConsignDoc(kind,ctx){
  const w=window.open('','_blank','width=620,height=820'); if(!w)return; const v=ctx.vendor||{}, shop=ctx.shop||{};
  const money=(n)=>'฿'+Math.round(Number(n)||0).toLocaleString('en-US'); const today=new Date().toISOString().slice(0,10);
  const ref=(kind==='wht'?'WHT-':'CSS-')+today.replace(/-/g,'').slice(2)+'-'+String(Math.floor(Math.random()*900+100));
  const wht=ctx.whtPct?Math.round(ctx.shopCut*ctx.whtPct/100*100)/100:0;
  const css="*{font-family:'IBM Plex Sans Thai',sans-serif;box-sizing:border-box}body{margin:0;padding:32px;color:#16211E;font-size:13px}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}th,td{border:1px solid #D8E0DD;padding:8px 10px;text-align:left}th{background:#F1F5F4}.r{text-align:right}.hd{display:flex;justify-content:space-between;border-bottom:2px solid #0E9C88;padding-bottom:12px}.meta{font-size:12.5px;color:#54615B;line-height:1.7;margin-top:8px}.box{background:#F1F5F4;border-radius:9px;padding:12px 14px;margin-top:14px}.kv{display:flex;justify-content:space-between;padding:5px 0}.kv.tot{border-top:2px solid #16211E;margin-top:6px;padding-top:10px;font-weight:700;font-size:15px}.sign{display:flex;gap:40px;margin-top:52px}.sign div{flex:1;border-top:1px dashed #999;padding-top:8px;text-align:center;color:#54615B;font-size:12.5px}@media print{body{padding:16px}.np{display:none}}";
  const issuer='<div style="text-align:right"><div style="font-weight:700;font-size:16px">'+(shop.account||shop.name||'')+'</div><div class="meta">'+(shop.address||'')+'<br>'+(shop.taxId?('เลขผู้เสียภาษี '+shop.taxId):'')+' · เลขที่ <b>'+ref+'</b><br>วันที่ '+MK.thDate(today)+'</div></div>';
  let body='';
  if(kind==='settle'){ const rows=(ctx.lines||[]).map((l,i)=>'<tr><td>'+(i+1)+'</td><td>'+l.name+(l.sku?' ('+l.sku+')':'')+'</td><td class="r">'+l.qty+'</td><td class="r">'+money(l.price)+'</td><td class="r">'+money(l.gross)+'</td><td class="r">'+money(l.shopCut)+'</td><td class="r">'+money(l.payout)+'</td></tr>').join('')||'<tr><td colspan="7" style="text-align:center;color:#888">ไม่มีรายการ</td></tr>';
    body='<h1>ใบสรุปเคลียร์เงินฝากขาย</h1><div style="color:#0A6E60;font-weight:700;font-size:13px">Consignment Settlement Statement</div><div class="meta">คู่ค้า/ผู้ฝากขาย: <b>'+(v.name||'-')+'</b>'+(v.phone?(' · โทร '+v.phone):'')+'<br>รอบ: '+(ctx.period||'-')+(v.bank?('<br>โอนเข้าบัญชี: '+v.bank+' '+(v.acctNo||'')):'')+'</div><table><thead><tr><th>#</th><th>สินค้า</th><th class="r">ขายได้</th><th class="r">ราคา</th><th class="r">ยอดขาย</th><th class="r">ส่วนแบ่งตลาด</th><th class="r">คืนคู่ค้า</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><th colspan="4" class="r">รวม</th><th class="r">'+money(ctx.gross)+'</th><th class="r">'+money(ctx.shopCut)+'</th><th class="r">'+money(ctx.payout)+'</th></tr></tfoot></table><div class="box"><div class="kv"><span>ยอดขายรวม</span><span>'+money(ctx.gross)+'</span></div><div class="kv"><span>หัก ส่วนแบ่ง/ค่าบริการตลาด</span><span>('+money(ctx.shopCut)+')</span></div>'+(wht?'<div class="kv"><span>หัก ภาษี ณ ที่จ่าย '+ctx.whtPct+'%</span><span>('+money(wht)+')</span></div>':'')+'<div class="kv tot"><span>ยอดโอนคืนคู่ค้าสุทธิ</span><span style="color:#1E9E6A">'+money(ctx.payout-wht)+'</span></div></div><div class="meta" style="margin-top:10px">* ยอดขายที่เก็บแทนคู่ค้าไม่ถือเป็นรายได้ตลาด — ตลาดรับรู้เฉพาะส่วนแบ่ง/ค่าบริการ</div><div class="sign"><div>ผู้จ่ายเงิน (ตลาด)</div><div>ผู้รับเงิน (คู่ค้า)</div></div>';
  } else { body='<h1>หนังสือรับรองการหักภาษี ณ ที่จ่าย</h1><div style="color:#0A6E60;font-weight:700;font-size:13px">(ตามมาตรา 50 ทวิ)</div><table style="margin-top:16px"><tbody><tr><th style="width:38%">ผู้จ่าย/ผู้หักภาษี</th><td>'+(shop.account||shop.name||'-')+' · เลขผู้เสียภาษี '+(shop.taxId||'-')+'</td></tr><tr><th>ผู้ถูกหักภาษี (คู่ค้า)</th><td>'+(v.name||'-')+(v.taxId?(' · '+v.taxId):'')+'</td></tr><tr><th>ประเภทเงินได้</th><td>ค่าบริการ/นายหน้าจากการฝากขาย</td></tr><tr><th>ฐานหัก</th><td class="r">'+money(ctx.shopCut)+'</td></tr><tr><th>อัตรา</th><td class="r">'+(ctx.whtPct||3)+'%</td></tr><tr><th>ภาษีที่หัก</th><td class="r" style="font-weight:700;color:#B26A00">'+money(wht)+'</td></tr></tbody></table><div class="sign"><div>ผู้จ่าย/ผู้หักภาษี</div><div>ผู้รับเงิน</div></div>'; }
  w.document.write('<!doctype html><html lang="th"><head><meta charset="utf-8"><title>'+ref+'</title><style>@import url(\'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap\');'+css+'</style></head><body><div class="hd"><div style="font-weight:700;font-size:14px;color:#0A6E60">'+(shop.name||'')+'<br><span style="color:#888;font-weight:500;font-size:12px">เอกสารบัญชีขายฝาก · โปรแกรมตลาด</span></div>'+issuer+'</div>'+body+'<div class="np" style="margin-top:30px;text-align:center"><button onclick="window.print()" style="padding:11px 24px;border:none;border-radius:10px;background:#0E9C88;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit">🖨 พิมพ์ / เซฟ PDF</button></div></body></html>'); w.document.close();
}

/* ════ OWNER · รายงานภาษี (VAT) ════ */
function VatView({data}){
  const {market,stalls,bills}=data; const exp=(data.expenses||[]);
  const [mon,setMon]=useState(P0); const [view,setView]=useState('out');
  const rate=(market.vatRate||7)/100;
  if(!market.vat) return (<div className="fade"><div className="note gold">ตลาดนี้ไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม (VAT) — ไม่ต้องออกภาษีขาย/ยื่น ภ.พ.30 · หากจด VAT แล้วเปิดสวิตช์ที่ "ข้อมูลตลาด"</div></div>);
  const inMon=(d)=>String(d||'').slice(0,7)===mon;
  const outRecs=bills.filter(b=>inMon(b.period)&&b.period===mon).map(b=>{ const st=stalls.find(s=>s.id===b.stallId); const base=Math.round(b.total/(1+rate)*100)/100; return {b,st,base,vat:Math.round((b.total-base)*100)/100,g:b.total}; }).sort((a,b)=>(a.st?a.st.code:'').localeCompare(b.st?b.st.code:''));
  const oB=outRecs.reduce((a,x)=>a+x.base,0), oV=outRecs.reduce((a,x)=>a+x.vat,0), oG=outRecs.reduce((a,x)=>a+x.g,0);
  const inRecs=exp.filter(e=>e.hasVat&&inMon(e.date)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const iB=inRecs.reduce((a,x)=>a+x.vatBase,0), iV=inRecs.reduce((a,x)=>a+x.vat,0), iG=inRecs.reduce((a,x)=>a+x.total,0);
  const net=oV-iV; const monTxt=mon.split('-')[1]+'/'+mon.split('-')[0];
  const exOut=()=>csv('ภาษีขาย_'+mon+'.csv',[['ยูนิต','ร้าน','มูลค่าก่อน VAT','VAT','รวม']].concat(outRecs.map(x=>[x.b.stallId.split('|')[1],x.st?x.st.vendor:'',x.base.toFixed(2),x.vat.toFixed(2),x.g.toFixed(2)])).concat([['รวม','',oB.toFixed(2),oV.toFixed(2),oG.toFixed(2)]]));
  const exIn=()=>csv('ภาษีซื้อ_'+mon+'.csv',[['วันที่','รายการ','เลขผู้เสียภาษี','มูลค่าก่อน VAT','VAT','รวม']].concat(inRecs.map(x=>[x.date,x.note,x.supplierTaxId,x.vatBase.toFixed(2),x.vat.toFixed(2),x.total.toFixed(2)])).concat([['รวม','','',iB.toFixed(2),iV.toFixed(2),iG.toFixed(2)]]));
  return (<div className="fade">
    <div className="toolbar" style={{gap:12}}>
      <div className="seg">{[['out','ภาษีขาย (Output)'],['in','ภาษีซื้อ (Input)'],['pp30','สรุป ภ.พ.30']].map(([k,l])=><button key={k} className={view===k?'on':''} onClick={()=>setView(k)}>{l}</button>)}</div>
      <div className="grow"/>
      <select className="field" style={{maxWidth:150}} value={mon} onChange={e=>setMon(e.target.value)}>{PERIODS.slice().reverse().map(p=><option key={p} value={p}>{monthTH(p)}</option>)}</select>
      <button className="btn gh" onClick={view==='in'?exIn:exOut} disabled={view==='pp30'}>⬇ CSV</button>
    </div>
    <div className="note blue" style={{marginBottom:16}}>ภาษีขาย = VAT จากบิลค่าเช่า/ส่วนกลาง/GP ที่ตลาดออกให้ร้าน · ภาษีซื้อ = VAT จากค่าใช้จ่ายดำเนินงานตลาด · ภาษีขาย − ภาษีซื้อ = ยอดยื่น ภ.พ.30</div>
    {view==='out' && <>
      <div className="kpis"><Kpi label="มูลค่าก่อน VAT" value={B(oB)} foot={monthTH(mon)}/><Kpi label={'ภาษีขาย ('+Math.round(rate*100)+'%)'} value={B(oV)} tone="var(--brand-ink)" foot="ยอดยื่น ภ.พ.30"/><Kpi label="รวมทั้งสิ้น" value={B(oG)} foot={outRecs.length+' ใบ'}/></div>
      <div className="card" style={{overflow:'hidden'}}><table><thead><tr><th>ยูนิต / ร้าน</th><th className="r">ก่อน VAT</th><th className="r">VAT</th><th className="r">รวม</th></tr></thead>
        <tbody>{outRecs.length?outRecs.map((x,i)=><tr key={i}><td><b>{x.b.stallId.split('|')[1]}</b> {x.st?x.st.vendor:''}</td><td className="r num">{x.base.toFixed(2)}</td><td className="r num">{x.vat.toFixed(2)}</td><td className="r num">{x.g.toFixed(2)}</td></tr>):<tr><td colSpan="4" className="empty">ไม่มีบิลในเดือนนี้</td></tr>}</tbody>
        {outRecs.length>0&&<tfoot><tr style={{fontWeight:700,background:'var(--brand-softer)'}}><td>รวมทั้งเดือน</td><td className="r num">{oB.toFixed(2)}</td><td className="r num">{oV.toFixed(2)}</td><td className="r num">{oG.toFixed(2)}</td></tr></tfoot>}</table></div>
    </>}
    {view==='in' && <>
      <div className="kpis"><Kpi label="มูลค่าก่อน VAT" value={B(iB)} foot={monthTH(mon)}/><Kpi label="ภาษีซื้อ (Input)" value={B(iV)} tone="var(--gold)" foot="หักในแบบ ภ.พ.30"/><Kpi label="รวมทั้งสิ้น" value={B(iG)} foot={inRecs.length+' ใบ'}/></div>
      <div className="card" style={{overflow:'hidden'}}><table><thead><tr><th>วันที่</th><th>รายการ</th><th>เลขผู้เสียภาษี</th><th className="r">ก่อน VAT</th><th className="r">VAT</th><th className="r">รวม</th></tr></thead>
        <tbody>{inRecs.length?inRecs.map((x,i)=><tr key={i}><td>{thDate(x.date)}</td><td>{x.note}</td><td className="mono" style={{fontSize:12}}>{x.supplierTaxId}</td><td className="r num">{x.vatBase.toFixed(2)}</td><td className="r num">{x.vat.toFixed(2)}</td><td className="r num">{x.total.toFixed(2)}</td></tr>):<tr><td colSpan="6" className="empty">ไม่มีค่าใช้จ่ายที่มีใบกำกับภาษีในเดือนนี้</td></tr>}</tbody>
        {inRecs.length>0&&<tfoot><tr style={{fontWeight:700,background:'var(--brand-softer)'}}><td colSpan="3">รวมทั้งเดือน</td><td className="r num">{iB.toFixed(2)}</td><td className="r num">{iV.toFixed(2)}</td><td className="r num">{iG.toFixed(2)}</td></tr></tfoot>}</table></div>
    </>}
    {view==='pp30' && <>
      <div className="kpis"><Kpi label="ภาษีขาย (Output)" value={B(oV)} tone="var(--brand-ink)"/><Kpi label="ภาษีซื้อ (Input)" value={B(iV)} tone="var(--gold)"/><Kpi label={net>=0?'ภาษีที่ต้องชำระ':'ภาษีชำระเกิน (ยกไป)'} value={B(Math.abs(net))} tone={net>=0?'var(--red)':'var(--green)'} foot="ขาย − ซื้อ"/></div>
      <div className="card panel" style={{maxWidth:560}}><h3 style={{marginTop:0}}>สรุปยื่นแบบ ภ.พ.30 · {monTxt}{market.taxId?(' · เลขผู้เสียภาษี '+market.taxId):''}</h3>
        <div className="kv"><span className="k">ยอดขาย/ค่าเช่า (ก่อน VAT)</span><span className="v num">{oB.toFixed(2)}</span></div>
        <div className="kv"><span className="k" style={{color:'var(--brand-ink)',fontWeight:700}}>ภาษีขาย (Output Tax)</span><span className="v num" style={{color:'var(--brand-ink)'}}>{oV.toFixed(2)}</span></div>
        <div className="kv"><span className="k">ยอดซื้อ/ค่าใช้จ่าย (ก่อน VAT)</span><span className="v num">{iB.toFixed(2)}</span></div>
        <div className="kv"><span className="k" style={{color:'var(--gold)',fontWeight:700}}>ภาษีซื้อ (Input Tax)</span><span className="v num" style={{color:'var(--gold)'}}>{iV.toFixed(2)}</span></div>
        <div className="kv total"><span className="k">{net>=0?'ภาษีที่ต้องชำระ':'ภาษีชำระเกิน (ยกไปเดือนหน้า)'}</span><span className="v num" style={{color:net>=0?'var(--red)':'var(--green)'}}>{Math.abs(net).toFixed(2)}</span></div>
        <div className="sub" style={{marginTop:14}}>ยื่น ภ.พ.30 ภายในวันที่ 15 ของเดือนถัดไป (ยื่นออนไลน์ถึงสิ้นเดือน)</div>
      </div>
    </>}
  </div>);
}

/* ════ OWNER · ผู้ใช้ & สิทธิ์ ════ */
const MROLES={ owner:{th:'เจ้าของตลาด',cls:'p-g',desc:'เห็นทุกอย่าง + ตั้งค่าตลาด/สิทธิ์'},
  manager:{th:'ผู้จัดการ',cls:'p-b',desc:'บริหารแผง/บิล/เก็บเงิน (ไม่เห็นบัญชี/ตั้งค่าตลาด)'},
  finance:{th:'การเงิน/บัญชี',cls:'p-plum',desc:'บัญชี/ภาษี/รายงาน (ไม่ยุ่งการจัดแผง)'},
  collector:{th:'เก็บเงินหน้างาน',cls:'p-y',desc:'ออกบิล/จับยอดชำระเท่านั้น'} };
const PERMS=[['dash','ภาพรวม'],['stalls','เช่าแผง'],['billing','บิล & เก็บเงิน'],['gp','GP & ยอดขาย'],['acct','บัญชี'],['vat','รายงานภาษี'],['reports','รายงาน'],['info','ข้อมูลตลาด & สิทธิ์']];
const ROLE_CAN={ owner:['dash','stalls','billing','gp','acct','vat','reports','info'], manager:['dash','stalls','billing','gp','reports'], finance:['dash','acct','vat','reports','gp'], collector:['dash','billing'] };
function UsersView({data,setData}){
  const {market}=data; const users=(data.users||[]); const [edit,setEdit]=useState(null);
  const save=(u)=>{ setData(d=>{ if(u.id){ const x=(d.users=d.users||[]).find(y=>y.id===u.id); Object.assign(x,u); } else { (d.users=d.users||[]).push({...u,id:'u'+Date.now().toString(36),marketId:market.id}); } return {...d}; }); setEdit(null); };
  const del=(id)=>{ if(!confirm('ลบผู้ใช้นี้?'))return; setData(d=>{ d.users=(d.users||[]).filter(y=>y.id!==id); return {...d}; }); };
  return (<div className="fade">
    <div className="note g" style={{marginBottom:16}}>สิทธิ์แยกต่อ<b>ตลาด/ออฟฟิศ</b> — ผู้ใช้เห็นเฉพาะตลาดที่ได้รับมอบหมาย · บัญชีของแต่ละตลาดแยกกันคนละชุด (marketId) ไม่ปนกัน</div>
    <div className="note blue" style={{marginBottom:16}}>👁️ <b>สิทธิ์ดูยอดรวม</b> — เจ้าของเปิดให้บัญชีรอง (ผู้จัดการ/เก็บเงิน) เห็นยอดขาย/รายได้รวมได้ทีละคน · 🔒 <b>ผูกอุปกรณ์</b> — จำกัดให้ล็อกอินได้เฉพาะเครื่องที่ผูกไว้ กันเอารหัสไปเปิดเครื่องอื่น</div>
    <div className="toolbar"><div className="grow"/><button className="btn pri" onClick={()=>setEdit({role:'collector',active:true})}>+ เพิ่มผู้ใช้</button></div>
    <div className="card" style={{overflow:'hidden',marginBottom:18}}>
      <table><thead><tr><th>ชื่อผู้ใช้</th><th>เบอร์</th><th className="c">บทบาท</th><th>เข้าถึงได้</th><th className="c">ยอดรวม</th><th className="c">อุปกรณ์</th><th className="c">สถานะ</th><th></th></tr></thead>
        <tbody>{users.map(u=>{ const R=MROLES[u.role]||{th:u.role,cls:'p-n'}; return (<tr key={u.id}>
          <td style={{fontWeight:600}}>{u.name}</td><td className="num">{u.phone||'—'}</td>
          <td className="c"><span className={'pill '+R.cls}>{R.th}</span></td>
          <td style={{fontSize:12,color:'var(--ink-2)'}}>{(ROLE_CAN[u.role]||[]).map(k=>(PERMS.find(p=>p[0]===k)||[])[1]).filter(Boolean).join(' · ')}</td>
          <td className="c">{userSeesTotal(u)?<span className="pill p-g">👁️ เห็น</span>:<span className="pill p-n">ซ่อน</span>}</td>
          <td className="c" style={{fontSize:12}}>{(u.devices&&u.devices.length)?<span className="pill p-b">🔒 {u.devices.length}{u.deviceLimit?'/'+u.deviceLimit:''}</span>:<span style={{color:'var(--ink-3)'}}>ทุกเครื่อง</span>}</td>
          <td className="c">{u.active?<span className="pill p-g">ใช้งาน</span>:<span className="pill p-n">ปิด</span>}</td>
          <td className="r" style={{whiteSpace:'nowrap'}}><button className="btn gh sm" onClick={()=>setEdit(u)}>แก้ไข</button>{u.role!=='owner'&&<button className="btn dngh sm" style={{marginLeft:6}} onClick={()=>del(u.id)}>ลบ</button>}</td>
        </tr>); })}</tbody></table>
    </div>
    <div className="card panel">
      <h3>ตารางสิทธิ์การเข้าถึง (Permission Matrix)</h3>
      <div style={{overflowX:'auto'}}><table><thead><tr><th>เมนู / บทบาท</th>{Object.keys(MROLES).map(r=><th key={r} className="c">{MROLES[r].th}</th>)}</tr></thead>
        <tbody>{PERMS.map(([k,l])=><tr key={k}><td style={{fontWeight:600}}>{l}</td>{Object.keys(MROLES).map(r=><td key={r} className="c">{(ROLE_CAN[r]||[]).includes(k)?<span style={{color:'var(--green)',fontWeight:700}}>✓</span>:<span style={{color:'var(--ink-3)'}}>—</span>}</td>)}</tr>)}</tbody></table></div>
      <div className="sub" style={{marginTop:12}}>บทบาท: {Object.values(MROLES).map(r=>r.th+' = '+r.desc).join(' · ')}</div>
    </div>
    {edit && <UserForm user={edit} onSave={save} onClose={()=>setEdit(null)}/>}
  </div>);
}
function UserForm({user,onSave,onClose}){
  const [f,setF]=useState({name:user.name||'',phone:user.phone||'',role:user.role||'collector',active:user.active!==false,
    seeTotal:!!user.seeTotal,devices:user.devices?[...user.devices]:[],deviceLimit:user.deviceLimit||0,id:user.id});
  const set=(k,v)=>setF({...f,[k]:v});
  const isOwner=f.role==='owner', autoTotal=f.role==='owner'||f.role==='finance';
  const dev=thisDevice(); const bound=f.devices.some(d=>d.id===dev.id);
  const bindThis=()=>{ if(bound)return; if(f.deviceLimit&&f.devices.length>=f.deviceLimit){ alert('ถึงขีดจำกัดอุปกรณ์ '+f.deviceLimit+' เครื่อง — ปลดเครื่องเก่าก่อน'); return; } set('devices',[...f.devices,{...dev,boundAt:Date.now()}]); };
  const unbind=(id)=>set('devices',f.devices.filter(d=>d.id!==id));
  return (<Modal title={user.id?'แก้ไขผู้ใช้':'เพิ่มผู้ใช้'} tag="กำหนดสิทธิ์ต่อตลาด" onClose={onClose} max={480}>
    <label className="lb">ชื่อผู้ใช้</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)} placeholder="ชื่อ-นามสกุล"/>
    <label className="lb">เบอร์โทร</label><input className="field" value={f.phone} onChange={e=>set('phone',e.target.value)}/>
    <label className="lb">บทบาท (Role)</label>
    <div style={{display:'grid',gap:8}}>{Object.entries(MROLES).map(([k,v])=>(<button key={k} onClick={()=>set('role',k)} style={{textAlign:'left',cursor:'pointer',border:'2px solid '+(f.role===k?'var(--brand)':'var(--hair-2)'),background:f.role===k?'var(--brand-soft)':'#fff',borderRadius:12,padding:'11px 13px'}}>
      <div style={{fontWeight:700,fontSize:13.5,color:f.role===k?'var(--brand-ink)':'var(--ink)'}}>{v.th}{k==='owner'&&' 🔒'}</div><div style={{fontSize:12,color:'var(--ink-3)',marginTop:2}}>{v.desc}</div></button>))}</div>

    <div className="card" style={{marginTop:16,padding:14,background:'var(--brand-softer)',border:'1px solid var(--hair-2)'}}>
      <div style={{fontWeight:700,fontSize:13.5,marginBottom:4}}>👁️ สิทธิ์ดูยอดขาย/รายได้รวม</div>
      {autoTotal ? <div className="sub">{isOwner?'เจ้าของตลาด':'การเงิน/บัญชี'} — เห็นยอดรวมทั้งหมดเสมอ (เปิดอัตโนมัติตามบทบาท)</div>
        : <><label className="chkline"><input type="checkbox" checked={f.seeTotal} onChange={e=>set('seeTotal',e.target.checked)}/> อนุญาตให้ดู <b>ยอดขาย/รายได้รวมของตลาด</b></label>
          <div className="sub" style={{marginTop:6}}>{f.seeTotal?'✓ บัญชีนี้เห็น KPI เงิน+กราฟยอดรวมบนแดชบอร์ด':'ปิดไว้ — บัญชีนี้ทำงานได้แต่ไม่เห็นยอดเงินรวม'}</div></>}
    </div>

    <div className="card" style={{marginTop:12,padding:14,border:'1px solid var(--hair-2)'}}>
      <div style={{fontWeight:700,fontSize:13.5,marginBottom:8}}>🔒 ผูกอุปกรณ์ (กันเข้าจากเครื่องแปลก)</div>
      <label className="lb">จำกัดจำนวนเครื่อง</label>
      <select className="field" value={f.deviceLimit} onChange={e=>set('deviceLimit',+e.target.value)}>
        <option value={0}>ไม่จำกัด (ทุกเครื่อง)</option><option value={1}>1 เครื่อง</option><option value={2}>2 เครื่อง</option><option value={3}>3 เครื่อง</option></select>
      <div style={{marginTop:10,display:'grid',gap:6}}>{f.devices.length? f.devices.map(d=>(<div key={d.id} style={{display:'flex',alignItems:'center',gap:8,fontSize:12.5,background:'var(--brand-softer)',borderRadius:9,padding:'8px 10px'}}>
        <span style={{flex:1}}>{d.id===dev.id?'🟢 ':'📱 '}{d.name}{d.id===dev.id&&' (เครื่องนี้)'}<span className="mono" style={{color:'var(--ink-3)',marginLeft:6}}>{d.id}</span></span>
        <button className="btn dngh sm" onClick={()=>unbind(d.id)}>✕</button></div>)) : <div className="sub">ยังไม่ผูกเครื่อง — เข้าได้ทุกเครื่องที่ล็อกอินถูก</div>}</div>
      {!bound && <button className="btn gh sm" style={{marginTop:8}} onClick={bindThis}>＋ ผูกอุปกรณ์นี้ให้ผู้ใช้</button>}
    </div>

    <label className="chkline" style={{marginTop:14}}><input type="checkbox" checked={f.active} onChange={e=>set('active',e.target.checked)}/> เปิดใช้งานบัญชีผู้ใช้นี้</label>
    <button className="btn pri" style={{marginTop:18,width:'100%'}} onClick={()=>onSave(f)} disabled={!f.name}>บันทึก</button>
  </Modal>);
}

/* ════ OWNER · ตั้งค่าการจอง & การเรียกเก็บ ════ */
function SettingsView({market,setData}){
  const bk=MK.bookingCfg(market), bl=MK.billCfg(market);
  const [b,setB]=useState({priceMode:bk.priceMode,zoneMode:{...bk.zoneMode},appt:bk.paths.appt,deposit:bk.paths.deposit,full:bk.paths.full,
    apptDepositOn:bk.apptDepositOn,apptDeposit:bk.apptDeposit,idVerifyAppt:bk.idVerifyAppt,depositRule:bk.depositRule,depositFixed:bk.depositFixed,holdDays:bk.holdDays,showLeaseEnd:bk.showLeaseEnd,
    dailyOn:bk.dailyOn,dailyRate:bk.dailyRate,dailyUtil:bk.dailyUtil,dailyEquip:bk.dailyEquip,openDays:[...bk.openDays],openTime:bk.openTime,closeTime:bk.closeTime,
    dueDay:bl.dueDay,autoFixed:bl.autoFixed,remindBefore:bl.remindBefore,remindOverdue:bl.remindOverdue,catRates:{...(market.catRates||{})}});
  const [saved,setSaved]=useState(false);
  const set=(k,v)=>{ setB({...b,[k]:v}); setSaved(false); };
  const setZone=(z,v)=>{ setB({...b,zoneMode:{...b.zoneMode,[z]:v}}); setSaved(false); };
  const setCatRate=(id,v)=>{ setB({...b,catRates:{...b.catRates,[id]:+v||0}}); setSaved(false); };
  const toggleDay=(d)=>{ const has=b.openDays.includes(d); setB({...b,openDays:(has?b.openDays.filter(x=>x!==d):[...b.openDays,d]).sort((x,y)=>x-y)}); setSaved(false); };
  const WEEK=['อา','จ','อ','พ','พฤ','ศ','ส'];
  const save=()=>{ setData(d=>{ const m=d.markets.find(x=>x.id===market.id);
    m.booking={priceMode:b.priceMode,zoneMode:b.zoneMode,paths:{appt:b.appt,deposit:b.deposit,full:b.full},apptDepositOn:b.apptDepositOn,apptDeposit:+b.apptDeposit||0,idVerifyAppt:b.idVerifyAppt,depositRule:b.depositRule,depositFixed:+b.depositFixed||0,holdDays:+b.holdDays||7,showLeaseEnd:b.showLeaseEnd,dailyOn:b.dailyOn,dailyRate:+b.dailyRate||0,dailyUtil:+b.dailyUtil||0,dailyEquip:b.dailyEquip||'',openDays:b.openDays,openTime:b.openTime,closeTime:b.closeTime};
    m.billing={dueDay:+b.dueDay||10,autoFixed:b.autoFixed,remindBefore:+b.remindBefore||0,remindOverdue:b.remindOverdue}; m.catRates=b.catRates; return {...d}; }); setSaved(true); };
  const PM=[['full','โชว์ราคาเต็ม'],['range','โชว์ช่วง “เริ่มต้น ฿X”'],['hidden','ซ่อนราคา (นัดดู/สอบถาม)']];
  const openCustomer=()=>window.open(docBase()+'Vendor Signup.html?market='+market.id,'_blank');
  return (<div className="fade">
    <div className="note g" style={{marginBottom:16}}>ตั้งค่าที่นี่คุมหน้า <b>จองแผงในไลน์</b> (ผังของลูกค้า) + <b>การออกบิล/แจ้งเตือน</b> — แก้ที่นี่ที่เดียว <a onClick={openCustomer} style={{cursor:'pointer',fontWeight:600,color:'var(--brand-ink)'}}>เปิดหน้าจองของลูกค้า ↗</a></div>

    <div className="card panel" style={{marginBottom:18}}>
      <h3>🕓 วัน-เวลาทำการตลาด</h3>
      <label className="lb">เปิดวันไหนบ้าง (แตะเลือก)</label>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{WEEK.map((w,i)=><button key={i} onClick={()=>toggleDay(i)} style={{width:44,height:44,borderRadius:11,border:'1.5px solid '+(b.openDays.includes(i)?'var(--brand)':'var(--hair-2)'),background:b.openDays.includes(i)?'var(--brand)':'#fff',color:b.openDays.includes(i)?'#fff':'var(--ink-2)',fontWeight:700,cursor:'pointer'}}>{w}</button>)}</div>
      <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr',marginTop:12}}>
        <div><label className="lb">เปิด</label><input className="field" type="time" value={b.openTime} onChange={e=>set('openTime',e.target.value)}/></div>
        <div><label className="lb">ปิด</label><input className="field" type="time" value={b.closeTime} onChange={e=>set('closeTime',e.target.value)}/></div></div>
      <div className="sub" style={{marginTop:8}}>จองขายรายวันจะเลือกได้เฉพาะวันที่เปิดทำการ</div>
    </div>

    <div className="card panel" style={{marginBottom:18}}>
      <h3>🏷️ การโชว์ราคาค่าเช่า</h3>
      <label className="lb">โหมดราคาเริ่มต้น (ทั้งตลาด)</label>
      <div className="seg" style={{width:'100%'}}>{PM.map(([k,l])=><button key={k} style={{flex:1}} className={b.priceMode===k?'on':''} onClick={()=>set('priceMode',k)}>{l}</button>)}</div>
      <label className="lb" style={{marginTop:14}}>กำหนดรายโซน (เว้นจากค่าตั้งต้นได้)</label>
      <div style={{display:'grid',gap:8}}>{Object.entries(market.zones).map(([z,zn])=>(<div key={z} style={{display:'flex',alignItems:'center',gap:10}}>
        <span style={{flex:1,fontSize:13}}>{zn}</span>
        <select className="field" style={{maxWidth:220}} value={b.zoneMode[z]||''} onChange={e=>setZone(z,e.target.value)}>
          <option value="">─ ตามค่ารวม ─</option>{PM.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>))}</div>
    </div>

    <div className="card panel" style={{marginBottom:18}}>
      <h3>💰 เรตค่าเช่าตามประเภทสินค้า</h3>
      <div className="sub" style={{marginBottom:10}}>ตั้ง ฿/ตร.ม./เดือน ต่อประเภท — ระบบแนะนำค่าเช่าอัตโนมัติเวลาตั้งแผง/จัดร้านลงแผง (เว้นว่าง = ไม่แนะ)</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
        {MK.CATEGORIES.filter(c=>c.id!=='other').map(c=>(<div key={c.id} style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{flex:1,fontSize:13}}>{c.icon} {c.th}</span>
          <input className="field" type="number" style={{maxWidth:110}} value={b.catRates[c.id]||''} onChange={e=>setCatRate(c.id,e.target.value)} placeholder="฿/ตร.ม."/></div>))}</div>
    </div>

    <div className="card panel" style={{marginBottom:18}}>
      <h3>📝 ช่องทางการจอง (เปิด/ปิดได้)</h3>
      <label className="chkline"><input type="checkbox" checked={b.appt} onChange={e=>set('appt',e.target.checked)}/> 🗓️ นัดดูพื้นที่ก่อน</label>
      {b.appt && <div style={{margin:'8px 0 8px 30px'}}><label className="chkline" style={{marginTop:0}}><input type="checkbox" checked={b.apptDepositOn} onChange={e=>set('apptDepositOn',e.target.checked)}/> เก็บมัดจำนัด (กันเบี้ยว)</label>
        {b.apptDepositOn && <div style={{marginTop:6}}><label className="lb">มัดจำนัด (บาท)</label><input className="field" type="number" style={{maxWidth:200}} value={b.apptDeposit} onChange={e=>set('apptDeposit',e.target.value)}/></div>}
        <label className="chkline" style={{marginTop:8}}><input type="checkbox" checked={b.idVerifyAppt} onChange={e=>set('idVerifyAppt',e.target.checked)}/> 🪩 ไม่เก็บค่าจอง — แต่นำบัตรปชช.มายืนยันตัวตนวันนัด</label></div>}
      <label className="chkline"><input type="checkbox" checked={b.deposit} onChange={e=>set('deposit',e.target.checked)}/> 🔖 จอง + วางมัดจำ (กันแผง)</label>
      {b.deposit && <div style={{margin:'8px 0 8px 30px'}}>
        <div className="seg">{[['onemonth','= 1 เดือนของค่าเช่า'],['fixed','ค่าคงที่']].map(([k,l])=><button key={k} className={b.depositRule===k?'on':''} onClick={()=>set('depositRule',k)}>{l}</button>)}</div>
        {b.depositRule==='fixed' && <div style={{marginTop:8}}><label className="lb">มัดจำคงที่ (บาท)</label><input className="field" type="number" style={{maxWidth:200}} value={b.depositFixed} onChange={e=>set('depositFixed',e.target.value)}/></div>}
        <div style={{marginTop:8}}><label className="lb">กันแผงหลังมัดจำ (วัน)</label><input className="field" type="number" style={{maxWidth:200}} value={b.holdDays} onChange={e=>set('holdDays',e.target.value)}/></div></div>}
      <label className="chkline"><input type="checkbox" checked={b.full} onChange={e=>set('full',e.target.checked)}/> ✅ โอนเต็มจำนวน → ล็อกแผงทันที (โชว์ราคาเท่านั้น)</label>
      <label className="chkline"><input type="checkbox" checked={b.showLeaseEnd} onChange={e=>set('showLeaseEnd',e.target.checked)}/> 📄 โชว์วันสิ้นสุดสัญญาให้ลูกค้าเห็น (“ว่างเร็วๆนี้” → จองล่วงหน้า)</label>
    </div>

    <div className="card panel" style={{marginBottom:18}}>
      <h3>📅 จองขายรายวัน (ตลาดนัด)</h3>
      <label className="chkline" style={{marginTop:0}}><input type="checkbox" checked={b.dailyOn} onChange={e=>set('dailyOn',e.target.checked)}/> เปิดให้จองแผงขายเป็นรายวัน (เลือกวันเอง)</label>
      {b.dailyOn && <div style={{marginTop:8}}>
        <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
          <div><label className="lb">ค่าเช่าคงที่/วัน (บาท)</label><input className="field" type="number" value={b.dailyRate} onChange={e=>set('dailyRate',e.target.value)}/></div>
          <div><label className="lb">ค่าน้ำ/ไฟ ต่อวัน (บาท)</label><input className="field" type="number" value={b.dailyUtil} onChange={e=>set('dailyUtil',e.target.value)}/></div></div>
        <label className="lb" style={{marginTop:10}}>อุปกรณ์ที่ตลาดจัดหาให้ (คั่นด้วยจุลภาค)</label>
        <input className="field" value={b.dailyEquip} onChange={e=>set('dailyEquip',e.target.value)} placeholder="เช่น โต๊ะพับ, เต็นท์, ปลั๊กไฟ, เก้าอี้"/>
        <div className="sub" style={{marginTop:6}}>รวมต่อวัน ≈ {B((+b.dailyRate||0)+(+b.dailyUtil||0))}/วัน (ค่าเช่า+น้ำไฟ)</div></div>}
    </div>

    <div className="card panel" style={{marginBottom:18}}>
      <h3>🧾 การออกบิล & แจ้งเตือน</h3>
      <label className="lb">จ่ายไม่เกินวันที่ (ของทุกเดือน)</label>
      <input className="field" type="number" min="1" max="28" style={{maxWidth:200}} value={b.dueDay} onChange={e=>set('dueDay',e.target.value)}/>
      <div className="sub" style={{marginTop:6}}>บิลที่ออกจะกำหนดครบกำหนดชำระวันที่ {b.dueDay||10} ของเดือน</div>
      <label className="chkline" style={{marginTop:14}}><input type="checkbox" checked={b.autoFixed} onChange={e=>set('autoFixed',e.target.checked)}/> ออกบิลอัตโนมัติสำหรับร้าน <b>เหมาจ่าย/ต่อ ตร.ม.</b> (ยอดคงที่)</label>
      <div className="sub" style={{margin:'2px 0 0 30px'}}>ร้าน GP ต้องใส่ยอดขายก่อนถึงออกบิลได้ — ระบบจะเตือนให้คีย์ยอด</div>
      <label className="lb" style={{marginTop:14}}>เตือนก่อนครบกำหนด (กี่วัน)</label>
      <input className="field" type="number" min="0" max="15" style={{maxWidth:200}} value={b.remindBefore} onChange={e=>set('remindBefore',e.target.value)}/>
      <label className="chkline" style={{marginTop:14}}><input type="checkbox" checked={b.remindOverdue} onChange={e=>set('remindOverdue',e.target.checked)}/> เตือนซ้ำเมื่อเลยกำหนดยังไม่จ่าย (ค้างชำระ)</label>
    </div>

    <button className="btn pri" style={{width:'100%'}} onClick={save}>{saved?'✓ บันทึกแล้ว':'บันทึกการตั้งค่า'}</button>
  </div>);
}

/* ════ OWNER · ข้อมูลตลาด ════ */
function MarketInfoView({market,setData}){
  const [f,setF]=useState({name:market.name,mtype:market.mtype||'wet',account:market.account||'',registered:!!market.registered,vat:!!market.vat,vatRate:market.vatRate||7,taxId:market.taxId||'',address:market.address||'',phone:market.phone||'',email:market.email||'',promptpay:market.promptpay||'',ownerLine:!!market.ownerLine,payMode:MK.payMode(market)});
  const [saved,setSaved]=useState(false); const set=(k,v)=>{ setF({...f,[k]:v}); setSaved(false); };
  const save=()=>{ setData(d=>{ const m=d.markets.find(x=>x.id===market.id); Object.assign(m,{...f,vatRate:+f.vatRate}); return {...d}; }); setSaved(true); };
  const docTitle = !f.registered?'ใบแจ้งหนี้ / ใบเสร็จ (ไม่จดทะเบียน)' : (f.vat?'ใบกำกับภาษี / ใบเสร็จรับเงิน':'ใบเสร็จรับเงิน (ไม่จด VAT)');
  return (<div className="fade">
    <div className="note g" style={{marginBottom:16}}>ตัวตนนิติบุคคลของตลาด — ใช้ขึ้นหัวเอกสาร (ใบแจ้งหนี้/ใบกำกับภาษี/ใบเสร็จ/สัญญา) และรายงานบัญชี · รองรับทั้งจดบริษัท+VAT, จดไม่ VAT และไม่จดทะเบียน (ใช้แค่ชื่อตลาด)</div>
    <div className="grid2b">
      <div className="card panel">
        <h3>ข้อมูลบริษัท / ตลาด</h3>
        <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
          <div><label className="lb">ชื่อตลาด</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)}/></div>
          <div><label className="lb">ประเภทตลาด</label><select className="field" value={f.mtype} onChange={e=>set('mtype',e.target.value)}>{Object.entries(MARKET_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <div className="chkrow"><label className="chkline"><input type="checkbox" checked={f.registered} onChange={e=>set('registered',e.target.checked)}/> จดทะเบียนนิติบุคคล (บริษัท/หจก.)</label>
          <label className="chkline"><input type="checkbox" checked={f.vat} onChange={e=>set('vat',e.target.checked)} disabled={!f.registered}/> จดทะเบียนภาษีมูลค่าเพิ่ม (VAT)</label></div>
        {f.registered && <><label className="lb">ชื่อนิติบุคคล (ผู้ออกเอกสาร)</label><input className="field" value={f.account} onChange={e=>set('account',e.target.value)}/></>}
        <div className="meterrow" style={{gridTemplateColumns:f.vat?'2fr 1fr':'1fr'}}>
          <div><label className="lb">เลขประจำตัวผู้เสียภาษี{!f.registered&&' (ถ้ามี)'}</label><input className="field mono" value={f.taxId} onChange={e=>set('taxId',e.target.value)} placeholder="0-0000-00000-00-0"/></div>
          {f.vat && <div><label className="lb">VAT %</label><input className="field num" type="number" value={f.vatRate} onChange={e=>set('vatRate',e.target.value)}/></div>}
        </div>
        <label className="lb">ที่อยู่จดทะเบียน</label><textarea className="field" rows="2" value={f.address} onChange={e=>set('address',e.target.value)}/>
        <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
          <div><label className="lb">เบอร์โทร</label><input className="field" value={f.phone} onChange={e=>set('phone',e.target.value)}/></div>
          <div><label className="lb">อีเมล</label><input className="field" value={f.email} onChange={e=>set('email',e.target.value)}/></div></div>
        <label className="lb">PromptPay บัญชีกลางรับเงิน</label><input className="field mono" value={f.promptpay} onChange={e=>set('promptpay',e.target.value)}/>
        <label className="lb" style={{marginTop:14}}>โหมดรับเงินของตลาด <span className="sub" style={{fontWeight:500}}>(มีผลทั้งตลาด · ทุกร้านใช้เหมือนกัน)</span></label>
        <div className="seg" style={{width:'100%'}}>{[['promptpay','PromptPay ตรง'],['wallet','กระเป๋าเงิน'],['both','ทั้งสอง (ช่วงเปลี่ยนผ่าน)']].map(([k,l])=><button key={k} style={{flex:1}} className={f.payMode===k?'on':''} onClick={()=>set('payMode',k)}>{l}</button>)}</div>
        <div className="sub" style={{marginTop:6}}>{f.payMode==='wallet'?'ร้านเติมเงินเข้ากระเป๋า → ระบบหักค่าเช่าอัตโนมัติ ไม่ต้องจับคู่สลิป':f.payMode==='both'?'ช่วงรอธนาคารอนุมัติ VA/บัญชี — รับได้ทั้ง PromptPay และกระเป๋า':'ร้านสแกน QR เข้าบัญชีกลาง → ระบบจับคู่ยอดเข้าบิลอัตโนมัติ'}{f.payMode!=='promptpay'?' · จัดการที่เมนู “กระเป๋าเงินร้าน”':''}</div>
        <div className="note gold" style={{marginTop:10,fontSize:12.5,lineHeight:1.6}}>⚖️ กระเป๋าเงินในระบบเป็น <b>closed-loop</b> — ใช้จ่ายค่าเช่า/ค่าบริการในระบบเท่านั้น <b>ถอนเป็นเงินสดไม่ได้</b> (ยังไม่มีใบอนุญาตเงินอิเล็กทรอนิกส์) · ยอดขายของร้านค้า/ผู้เช่าเข้าบัญชีเจ้าของเองโดยตรง ระบบแค่จับคู่ยอดกับบิล</div>
        <label className="chkline" style={{marginTop:14}}><input type="checkbox" checked={f.ownerLine} onChange={e=>set('ownerLine',e.target.checked)}/> ใช้ LINE OA แจ้งบิล (ไม่ติ๊ก = SMS + ลิงก์เว็บ)</label>
        <button className="btn pri" style={{marginTop:18,width:'100%'}} onClick={save}>{saved?'✓ บันทึกแล้ว':'บันทึกข้อมูลตลาด'}</button>
      </div>
      <div><div className="card panel">
        <h3>ตัวอย่างหัวเอกสาร</h3>
        <div style={{border:'1px solid var(--hair-2)',borderRadius:12,padding:'20px 22px',background:'#fff'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,borderBottom:'2px solid var(--ink)',paddingBottom:12}}>
            <div><div style={{fontSize:18,fontWeight:700}}>{f.registered?(f.account||f.name):f.name||'—'}</div>
              <div className="sub" style={{marginTop:4,lineHeight:1.5,maxWidth:300}}>{f.address||'— ที่อยู่ —'}</div>
              <div className="sub" style={{marginTop:4}}>{f.taxId?('เลขผู้เสียภาษี '+f.taxId):(f.registered?'—':'ไม่จดทะเบียน')} {f.phone&&(' · โทร '+f.phone)}</div></div>
            <div style={{textAlign:'right'}}><div style={{fontSize:14,fontWeight:700,color:'var(--brand-ink)'}}>{docTitle.split('/')[0].trim()}</div><div className="sub">{f.vat?'TAX INVOICE':'RECEIPT'}</div></div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:14,fontSize:13.5}}><div><div className="sub">เรียกเก็บจาก</div><div style={{fontWeight:600}}>[ ร้าน · ยูนิต ]</div></div><div style={{textAlign:'right'}}><div className="sub">รอบบิล</div><div style={{fontWeight:600}}>{monthTH(P0)}</div></div></div>
          {f.vat && <div style={{marginTop:12,fontSize:12.5,color:'var(--ink-3)'}}>มูลค่าก่อน VAT · VAT {f.vatRate}% · รวมทั้งสิ้น</div>}
        </div>
        <div className="note blue" style={{marginTop:14}}>เอกสารทุกใบ (ใบแจ้งหนี้/ใบกำกับภาษี/ใบเสร็จ/สัญญา) ดึงหัวจากข้อมูลนี้อัตโนมัติ</div>
      </div></div>
    </div>
    <ProgramDocsCard market={market}/>
    <ContractTemplate market={market} setData={setData}/>
  </div>);
}
function ProgramDocsCard({market}){
  const m=market||{};
  const qp=new URLSearchParams({ bname:(m.registered?(m.account||m.name):m.name)||'', baddr:m.address||'', btax:m.taxId||'', bphone:m.phone||'' }).toString();
  const open=(f)=>window.open(docBase()+f+'?'+qp,'_blank');
  return (<div className="card panel" style={{marginTop:16}}>
    <h3>เอกสารขายโปรแกรม <span className="sub" style={{fontWeight:500}}>· เสนอขาย/ทำสัญญาโปรแกรม Market OS ให้องค์กรลูกค้า</span></h3>
    <div className="note g" style={{marginBottom:12}}>เครื่องมือทำ <b>ใบเสนอราคา</b> (รายการ + คำนวณ VAT อัตโนมัติ) — <b>ดึงข้อมูลลูกค้า “{(m.registered?(m.account||m.name):m.name)||'—'}” จากตลาดนี้อัตโนมัติ</b> · แก้ไขสด บันทึกอัตโนมัติ พิมพ์/บันทึก PDF</div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      <button className="btn pri" onClick={()=>open('Market Quote.html')}>🧾 ใบเสนอราคา (Smart Quote)</button>
    </div>
  </div>);
}
function ContractTemplate({market,setData}){
  const [txt,setTxt]=useState(market.contractTemplate||MK.DEFAULT_CLAUSES);
  const [saved,setSaved]=useState(false); const taRef=React.useRef();
  const insert=(v)=>{ const ta=taRef.current; const s=ta?ta.selectionStart:txt.length; const nt=txt.slice(0,s)+v+txt.slice(ta?ta.selectionEnd:txt.length); setTxt(nt); setSaved(false); setTimeout(()=>{ if(ta){ta.focus();ta.selectionStart=ta.selectionEnd=s+v.length;} },0); };
  const save=()=>{ setData(d=>{ const m=d.markets.find(x=>x.id===market.id); m.contractTemplate=txt; return {...d}; }); setSaved(true); };
  const reset=()=>{ setTxt(MK.DEFAULT_CLAUSES); setSaved(false); };
  return (<div className="card panel" style={{marginTop:16}}>
    <h3>แม่แบบสัญญาเช่าของตลาด <span className="sub" style={{fontWeight:500}}>· แก้/วางสัญญาเองได้ — ระบบเติมข้อมูลผู้เช่า+บริษัทให้อัตโนมัติ</span></h3>
    <div className="note g" style={{marginBottom:12}}>วางเนื้อสัญญาของตลาดคุณเอง (import จากไฟล์เดิม/copy-paste) หรือแก้แม่แบบด้านล่าง แล้วแทรก “ตัวแปร” ตรงจุดที่ต้องการให้ระบบกรอกให้อัตโนมัติ — เวลาออกสัญญาจากทะเบียนร้าน ไม่ต้องพิมพ์ใหม่</div>
    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>{MK.CONTRACT_VARS.map(([v,l])=><button key={v} className="btn gh sm" title={l} onClick={()=>insert(v)}>{l}</button>)}</div>
    <textarea ref={taRef} className="field" style={{minHeight:200,fontSize:13.5,lineHeight:1.7,fontFamily:'inherit'}} value={txt} onChange={e=>{setTxt(e.target.value);setSaved(false);}}/>
    <div style={{display:'flex',gap:10,marginTop:14}}>
      <button className="btn pri" onClick={save}>{saved?'✓ บันทึกแม่แบบแล้ว':'บันทึกแม่แบบสัญญา'}</button>
      <button className="btn gh" onClick={reset}>คืนค่าเริ่มต้น</button>
      <div className="grow"/>
      <span className="sub" style={{alignSelf:'center'}}>ตัวอย่างจริงดูได้ที่ปุ่ม “สัญญาเช่า” ในหน้าเช่าแผงของแต่ละยูนิต</span>
    </div>
  </div>);
}

/* ════ VENDOR ════ (แท็บเพิ่มอยู่ใน market-vendor.jsx → window.VendorApp) */
function VendorView(props){ return window.VendorApp
  ? <window.VendorApp {...props} Home={VendorHome}/>
  : <VendorHome {...props}/>; }
function VendorHome({data,setData,stallId}){
  const {market,stalls,bills}=data; const st=stalls.find(s=>s.id===stallId); const [qr,setQr]=useState(false);
  const my=bills.filter(b=>b.stallId===stallId).sort((a,b)=>b.period<a.period?-1:1); const curBill=my.find(b=>b.period===P0)||my[0];
  const pay=(b)=>{ setData(d=>{ const bb=d.bills.find(x=>x.id===b.id); bb.status='paid'; bb.method='promptpay'; bb.paidAt=Date.now();
    const s=d.stalls.find(x=>x.id===stallId); if(!d.bills.some(x=>x.stallId===stallId&&x.status==='overdue'&&x.id!==bb.id)) s.locked=false; return {...d}; }); setQr(false); };
  const mode=MK.payMode(market); const [topup,setTopup]=useState(false);
  const myW=(data.wallets||[]).find(w=>w.stallId===stallId)||{balance:0,ledger:[]};
  const payWallet=(b)=>{ if(myW.balance<b.total){ alert('ยอดกระเป๋าไม่พอ — เติมเงินก่อน'); return; } setData(d=>{ const w=getWallet(d,st); w.balance-=b.total; (w.ledger=w.ledger||[]).push({ts:new Date().toISOString(),type:'bill',amount:-b.total,bal:w.balance,note:'จ่ายบิล '+monthTH(b.period)}); const bb=d.bills.find(x=>x.id===b.id); bb.status='paid'; bb.method='wallet'; bb.paidAt=Date.now(); const s=d.stalls.find(x=>x.id===stallId); if(!d.bills.some(x=>x.stallId===stallId&&x.status==='overdue'&&x.id!==bb.id)) s.locked=false; return {...d}; }); };
  return (<div className="fade" style={{maxWidth:780}}>
    {st.locked && <div className="note red" style={{marginBottom:16}}>⚠ แผงของคุณถูก<b>ระงับสิทธิ์ชั่วคราว</b>เนื่องจากค้างชำระ — ชำระบิลค้างเพื่อปลดล็อก</div>}
    <div className="card panel" style={{marginBottom:16}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
      <div><div className="sub">แผงของฉัน · {market.name}</div><h1 style={{marginTop:2}}>{st.code} · {st.vendor}</h1>
        <div className="sub">{UNIT_TYPES[st.unitType]} · {st.area} ตร.ม. · {st.rentModel==='gp'?('GP '+st.gpRate+'%'):(st.rentModel==='per_sqm'?(B(st.rentPerSqm)+'/ตร.ม.'):('ค่าเช่า '+B(st.rent)+'/เดือน'))}</div></div>
      {st.locked?<span className="pill p-r">ถูกล็อก</span>:<span className="pill p-g">สถานะปกติ</span>}</div>
      <div style={{marginTop:12}}><button className="btn gh sm" onClick={()=>openDoc('type=contract&stall='+encodeURIComponent(st.id))}>📄 ดูสัญญาเช่า</button></div>
    </div>
    {mode!=='promptpay' && <div className="card panel" style={{marginBottom:16}}>
      <h3>👛 กระเป๋าเงินร้าน</h3>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--brand-softer)',borderRadius:12,padding:'14px 16px',flexWrap:'wrap',gap:10}}>
        <div><div className="sub">ยอดคงเหลือ</div><div style={{fontSize:30,fontWeight:700,color:'var(--brand-ink)'}}>{B(myW.balance)}</div></div>
        <button className="btn pri" onClick={()=>setTopup(true)}>+ เติมเงิน</button></div>
      <div className="kv" style={{marginTop:10}}><span className="k">เลขบัญชีเติมเงิน (VA)</span><span className="v mono">{st.va||'— ตลาดยังไม่ผูกเลข VA —'}</span></div>
      <div className="sub" style={{marginTop:4}}>โอนเข้าเลขนี้ = เงินเข้ากระเป๋าร้านอัตโนมัติ · ระบบหักค่าเช่าจากกระเป๋าให้เอง</div>
      {(myW.ledger||[]).length>0 && <div style={{marginTop:12}}><div className="sub" style={{fontWeight:600,marginBottom:6}}>เดินบัญชีล่าสุด</div>
        <div className="feed">{[...myW.ledger].reverse().slice(0,5).map((l,i)=>(<div className="feeditem" key={i}><div className="fi-ic" style={{background:l.amount>0?'var(--green-soft)':'var(--blue-soft)'}}>{l.amount>0?'↓':'↑'}</div><div className="fi-b"><div className="fi-t">{l.note}</div><div className="fi-s">{thDateTime(new Date(l.ts).getTime())} · คงเหลือ {B(l.bal)}</div></div><div className="fi-v" style={{color:l.amount>0?'var(--green)':'var(--blue-ink)'}}>{l.amount>0?'+':''}{B(l.amount)}</div></div>))}</div></div>}
    </div>}
    {curBill && <div className="card panel" style={{marginBottom:16}}>
      <h3>บิลรอบ {monthTH(curBill.period)} {billPill(curBill)}</h3>
      <div style={{background:'var(--brand-softer)',borderRadius:12,padding:'6px 16px'}}>
        <div className="kv"><span className="k">{curBill.rentModel==='gp'?('ค่าเช่า GP '+curBill.gpRate+'% ของ '+B(curBill.gpSales)):'ค่าเช่า'}</span><span className="v num">{B(curBill.rent)}</span></div>
        {curBill.service>0 && <div className="kv"><span className="k">ค่าส่วนกลาง</span><span className="v num">{B(curBill.service)}</span></div>}
        <div className="kv"><span className="k">ค่าไฟ {curBill.elecUnits} หน่วย</span><span className="v num">{B(curBill.elecAmt)}</span></div>
        <div className="kv"><span className="k">ค่าน้ำ {curBill.waterUnits} หน่วย</span><span className="v num">{B(curBill.waterAmt)}</span></div>
        <div className="kv total"><span className="k">รวม</span><span className="v num" style={{color:'var(--brand-ink)'}}>{B(curBill.total)}</span></div></div>
      <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
        <button className="btn gh sm" onClick={()=>openDoc('type=invoice&bill='+encodeURIComponent(curBill.id))}>🧾 ใบแจ้งหนี้</button>
        {curBill.status==='paid'&&<button className="btn gh sm" onClick={()=>openDoc('type='+(market.vat?'tax':'receipt')+'&bill='+encodeURIComponent(curBill.id))}>📄 ใบเสร็จ</button>}
      </div>
      {curBill.status!=='paid'?<div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
        {mode!=='promptpay'&&<button className="btn pri" style={{flex:1,minWidth:180}} onClick={()=>payWallet(curBill)} disabled={myW.balance<curBill.total}>{myW.balance>=curBill.total?('👛 จ่ายจากกระเป๋า '+B(curBill.total)):'ยอดกระเป๋าไม่พอ — เติมก่อน'}</button>}
        {mode!=='wallet'&&<button className="btn pri" style={{flex:1,minWidth:180}} onClick={()=>setQr(true)}>สแกน QR PromptPay จ่ายบิล</button>}
      </div>
        :<div className="note g" style={{marginTop:12}}>✓ ชำระแล้ว · {thDateTime(curBill.paidAt)}{curBill.method==='wallet'?' (หักจากกระเป๋า)':''}</div>}
    </div>}
    <div className="card panel"><h3>ประวัติบิล</h3>
      <table><thead><tr><th>รอบ</th><th className="r">ค่าเช่า</th><th className="r">น้ำ+ไฟ</th><th className="r">รวม</th><th className="c">สถานะ</th></tr></thead>
        <tbody>{my.map(b=><tr key={b.id}><td>{monthTH(b.period)}</td><td className="r num">{B(b.rent)}</td><td className="r num">{B(b.elecAmt+b.waterAmt+(b.service||0))}</td><td className="r num" style={{fontWeight:700}}>{B(b.total)}</td><td className="c">{billPill(b)}</td></tr>)}</tbody></table></div>
    <div className="note blue" style={{marginTop:16}}>เปิดจาก <b>ลิงก์เว็บกลาง / LINE / SMS</b> — ไม่มี LINE ก็จ่ายได้โดยไม่ต้องล็อกอิน (ผูกตัวตนด้วยเบอร์โทร)</div>
    {qr && curBill && <BillQR bill={curBill} stall={st} market={market} onPaid={pay} onLock={()=>{}} onClose={()=>setQr(false)}/>}
    {topup && <TopUpModal stall={st} market={market} balance={myW.balance} setData={setData} onClose={()=>setTopup(false)}/>}
  </div>);
}

/* ════ PLATFORM ════ */
// คลังโฆษณา & สปอนเซอร์ — แปลง first-party data (ตลาด/ร้าน/ทราฟฟิก) เป็นพื้นที่สื่อขายได้
function AdInventoryView({data}){
  const {markets,stalls,bills}=data;
  const occ=stalls.filter(s=>s.status==='occupied');
  const txMonth=bills.filter(b=>b.status==='paid'&&b.period===P0).length;
  // ประมาณการทราฟฟิก/ผู้เข้าถึง (heuristic จากจำนวนแผง × ตัวคูณตามประเภทตลาด)
  const footMul={wet:180,fresh:150,flea:220,community:120,mall:260};
  const reach=markets.reduce((a,m)=>{ const st=stalls.filter(s=>s.marketId===m.id&&s.status==='occupied').length; return a+st*(footMul[m.mtype]||150); },0);
  const cats={}; occ.forEach(s=>{ cats[UNIT_TYPES[s.unitType]]=(cats[UNIT_TYPES[s.unitType]]||0)+1; });
  // สินค้าคลังสื่อ (ad slots) — ราคาเว้นให้ทีมขายเคาะ
  const SLOTS=[
    {ic:'🧾',name:'โฆษณาบนใบเสร็จ/บิล',desc:'โลโก้/คูปองแบรนด์ท้ายใบเสร็จ POS + บิลค่าเช่า',unit:'ต่อ 10,000 ใบ',reach:txMonth*1},
    {ic:'💬',name:'LINE Broadcast',desc:'ข้อความ/คูปองถึงร้านค้า+ลูกค้าที่เชื่อม LINE',unit:'ต่อครั้ง broadcast',reach:Math.round(reach*0.25)},
    {ic:'📺',name:'จอดิจิทัลหน้าตลาด',desc:'ป้าย LED/จอ ณ ทางเข้า-จุดชำระเงิน',unit:'ต่อจอ/เดือน',reach:reach},
    {ic:'🪧',name:'โปสเตอร์ QR ตามแผง',desc:'สื่อ ณ จุดขาย + QR โปรโมชัน สแกนวัดผลได้',unit:'ต่อ 100 จุด/เดือน',reach:Math.round(reach*0.6)},
    {ic:'🎁',name:'Sampling / บูธกิจกรรม',desc:'แจกสินค้าตัวอย่าง/ออกบูธในตลาดพันธมิตร',unit:'ต่อวัน/ตลาด',reach:Math.round(reach*0.4)},
  ];
  const TIERS=[
    {name:'Starter',color:'var(--blue)',for:'แบรนด์ท้องถิ่น / SME',feat:['ใบเสร็จ 10,000 ใบ','โปสเตอร์ QR 50 จุด','รายงานผลพื้นฐาน','1 ตลาด'],note:'ราคาเริ่มต้น — ทีมขายเคาะ'},
    {name:'Growth',color:'var(--brand-ink)',for:'แบรนด์ระดับภูมิภาค',feat:['ใบเสร็จ 50,000 ใบ','LINE broadcast 2 ครั้ง','จอดิจิทัล 3 ตลาด','Sampling 2 วัน','รายงาน + สแกนคูปอง'],note:'ยอดนิยม'},
    {name:'Flagship',color:'var(--plum)',for:'แบรนด์ระดับประเทศ (FMCG/แบงก์)',feat:['ทุก ad slot ทุกตลาด','LINE broadcast ไม่จำกัด','สิทธิ์ exclusive หมวดสินค้า','ทีมดูแลเฉพาะ + data insight','co-brand โปรตลาด'],note:'ดีลรายปี'},
  ];
  return (<div className="fade">
    <div className="note red" style={{marginBottom:16}}>🔒 <b>ชั้นแพลตฟอร์มเท่านั้น</b> — รวม first-party data ข้ามตลาดเป็น "พื้นที่สื่อ" ขายแบรนด์/สปอนเซอร์ · เจ้าของตลาดไม่เห็นชั้นนี้ (เฟส 3)</div>
    <div className="kpis">
      <Kpi label="ผู้เข้าถึงต่อเดือน (ประมาณ)" value={nfmt(reach)+'+'} foot="จากทราฟฟิกแผง×ประเภทตลาด" tone="var(--plum)"/>
      <Kpi label="ตลาดขายสื่อได้" value={markets.length} foot={nfmt(occ.length)+' แผงมีร้านจริง'}/>
      <Kpi label="ธุรกรรม/เดือน" value={nfmt(txMonth)} foot="ฐานพิมพ์โฆษณาบนใบเสร็จ"/>
      <Kpi label="หมวดสินค้าเด่น" value={Object.keys(cats).length+' หมวด'} foot="ทำ exclusive ต่อหมวดได้" tone="var(--brand-ink)"/>
    </div>
    <div className="card panel"><h3>คลังพื้นที่สื่อ (Ad Inventory)</h3>
      <div className="sub" style={{marginBottom:12}}>สินค้าที่ขายได้จาก data ที่ระบบมีอยู่แล้ว — ราคาเว้นให้ทีมขายกำหนดตามดีล</div>
      <div style={{display:'grid',gap:10}}>{SLOTS.map(s=>(<div key={s.name} className="row" style={{display:'flex',gap:14,alignItems:'center',padding:'12px 14px',border:'1px solid var(--line)',borderRadius:12}}>
        <div style={{fontSize:26}}>{s.ic}</div><div style={{flex:1}}><b>{s.name}</b><div className="sub">{s.desc}</div></div>
        <div style={{textAlign:'right'}}><div className="num" style={{fontWeight:700,color:'var(--plum)'}}>~{nfmt(s.reach)}</div><div className="sub">reach · {s.unit}</div></div></div>))}</div>
    </div>
    <div className="card panel" style={{marginTop:16}}><h3>โปรไฟล์ผู้ชม (first-party) — จุดขายให้แบรนด์</h3>
      <BarList rows={Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({k,v,fmt:v=>v+' แผง'}))} color="var(--plum)"/>
      <div className="note blue" style={{marginTop:14}}>แบรนด์ซื้อสื่อเพราะรู้ว่ากลุ่มไหนอยู่ตลาดไหน (เช่น แบรนด์เครื่องปรุงยิงตลาดสด · แบรนด์แฟชั่นยิงตลาดนัด) — data นี้คือสินทรัพย์</div>
    </div>
    <h3 style={{margin:'22px 0 12px'}}>แพ็กเกจสปอนเซอร์</h3>
    <div className="grid3">{TIERS.map(t=>(<div key={t.name} className="card" style={{borderTop:'4px solid '+t.color}}>
      <div style={{fontWeight:800,fontSize:19,color:t.color}}>{t.name}</div><div className="sub" style={{marginBottom:10}}>{t.for}</div>
      <ul style={{margin:0,paddingLeft:18,fontSize:13.5,lineHeight:2}}>{t.feat.map(f=><li key={f}>{f}</li>)}</ul>
      <div className="pill p-n" style={{marginTop:12,display:'inline-block'}}>{t.note}</div></div>))}</div>
    <div className="note plum" style={{marginTop:16,background:'var(--plum-soft)',color:'var(--plum)'}}>💡 เอาหน้านี้ไปเสนอแบรนด์/เอเจนซี — โชว์ reach + โปรไฟล์ผู้ชม + ช่องทางสื่อ แล้วปิดดีลเป็นแพ็กสปอนเซอร์ · วัดผลได้ผ่าน QR/คูปองในระบบ</div>
  </div>);
}
function PlatformView({data}){
  const {markets,stalls,bills}=data;
  const rows=markets.map(m=>{ const st=stalls.filter(s=>s.marketId===m.id), occ=st.filter(s=>s.status==='occupied'); const paid=bills.filter(b=>b.marketId===m.id&&b.period===P0&&b.status==='paid'); return {m,stalls:st.length,occ:occ.length,tx:paid.length}; });
  const totStalls=stalls.length, totOcc=stalls.filter(s=>s.status==='occupied').length;
  const cats={}; stalls.filter(s=>s.status==='occupied').forEach(s=>{ cats[UNIT_TYPES[s.unitType]]=(cats[UNIT_TYPES[s.unitType]]||0)+1; });
  const txMonth=bills.filter(b=>b.status==='paid'&&b.period===P0).length;
  return (<div className="fade">
    <div className="note red" style={{marginBottom:18}}>🔒 <b>ล็อกไว้สำหรับแพลตฟอร์มเท่านั้น</b> — เจ้าของตลาดเข้าไม่ถึงชั้นนี้ · รวม data การค้าข้ามตลาด ต่อยอดสื่อ/โฆษณา (เฟส 3)</div>
    <div className="kpis">
      <Kpi label="ตลาดในเครือข่าย" value={markets.length} foot="แพลตฟอร์มเดียว · scope ต่อ marketId" tone="var(--plum)"/>
      <Kpi label="ยูนิต/แผงรวม" value={nfmt(totStalls)} foot={'ใช้งานจริง '+nfmt(totOcc)+' ('+Math.round(totOcc/totStalls*100)+'%)'}/>
      <Kpi label="ธุรกรรมชำระ/เดือน" value={nfmt(txMonth)} foot={'จากบิล+POS ทุกตลาด · '+monthTH(P0)}/>
      <Kpi label="Audience segment" value="B2B + B2C" foot="แม่ค้า + ลูกค้าตลาด"/>
    </div>
    <div className="grid2">
      <div className="card panel"><h3>ตลาดในเครือข่าย <span className="sub" style={{fontWeight:500}}>(data รวมข้ามตลาด)</span></h3>
        <table><thead><tr><th>ตลาด</th><th className="c">ประเภท</th><th className="r">ยูนิต</th><th className="r">ใช้งาน</th><th className="r">ชำระ/ด.</th></tr></thead>
          <tbody>{rows.map(r=><tr key={r.m.id}><td>{r.m.name}</td><td className="c"><span className="pill p-n">{MARKET_TYPES[r.m.mtype]}</span></td><td className="r num">{nfmt(r.stalls)}</td><td className="r num">{nfmt(r.occ)}</td><td className="r num">{nfmt(r.tx)}</td></tr>)}</tbody></table>
        <div className="note plum" style={{marginTop:14,background:'var(--plum-soft)',color:'var(--plum)'}}>Backoffice แพลตฟอร์ม = data & media engine · เจ้าของตลาดเห็นแค่ตลาดตัวเอง</div></div>
      <div className="card panel"><h3>โปรไฟล์ยูนิตรวม (first-party data)</h3><BarList rows={Object.entries(cats).map(([k,v])=>({k,v,fmt:v=>v+' ยูนิต'}))} color="var(--plum)"/>
        <div className="note blue" style={{marginTop:14}}>เฟส 1 เก็บฐานข้อมูล + วางพื้นที่สื่อในใบเสร็จ → เฟส 3 เปิดขายสื่อ/แพ็กสปอนเซอร์</div></div>
    </div>
  </div>);
}
function MarketsAdmin({data,setData,onOpen}){
  const [form,setForm]=useState(null);
  const rows=data.markets.map(m=>{ const st=data.stalls.filter(s=>s.marketId===m.id), occ=st.filter(s=>s.status==='occupied');
    const cur=data.bills.filter(b=>b.marketId===m.id&&b.period===P0); const billed=cur.reduce((a,b)=>a+b.total,0), coll=cur.filter(b=>b.status==='paid').reduce((a,b)=>a+b.total,0); return {m,stalls:st.length,occ:occ.length,billed,coll}; });
  return (<div className="fade">
    <div className="note red" style={{marginBottom:16}}>🔒 ชั้นแพลตฟอร์ม — สร้าง/ผูกตลาด, ตั้งประเภท+VAT+บัญชีกลางต่อตลาด · เจ้าของตลาดเข้าไม่ถึง</div>
    <div className="toolbar"><div className="grow"/><button className="btn pri" onClick={()=>setForm('new')}>+ สร้างตลาดใหม่</button></div>
    <div className="card" style={{overflow:'hidden'}}>
      <table><thead><tr><th>ตลาด / เจ้าของ</th><th className="c">ประเภท</th><th className="c">ภาษี</th><th>บัญชีกลาง</th><th className="r">ยูนิต</th><th className="r">เรียกเก็บ</th><th className="r">เก็บได้</th><th></th></tr></thead>
        <tbody>{rows.map(({m,stalls,occ,billed,coll})=>(<tr key={m.id}>
          <td><b>{m.name}</b><div className="sub">{m.owner}</div></td>
          <td className="c"><span className="pill p-n">{MARKET_TYPES[m.mtype]}</span></td>
          <td className="c">{m.vat?<span className="pill p-b">VAT {m.vatRate}%</span>:(m.registered?<span className="pill p-n">ไม่ VAT</span>:<span className="pill p-y">ไม่จด</span>)}</td>
          <td><span className="mono">{m.promptpay}</span><div className="sub">{m.taxId||'—'}</div></td>
          <td className="r num">{occ}/{stalls}</td><td className="r num">{B(billed)}</td><td className="r num" style={{color:'var(--green)',fontWeight:700}}>{B(coll)}</td>
          <td className="r" style={{whiteSpace:'nowrap'}}><button className="btn gh sm" onClick={()=>setForm(m)}>แก้ไข</button> <button className="btn pri sm" onClick={()=>onOpen(m.id)}>เปิด ↗</button></td></tr>))}</tbody></table>
    </div>
    <div className="note blue" style={{marginTop:16}}>Multi-tenant: ทุก unit/bill ผูก <span className="mono">market_id</span> · owner token scope ต่อตลาด (เจ้าของ A เข้าตลาด B ไม่ได้) · เพิ่มตลาด = เพิ่มข้อมูล ไม่ใช่ deploy ใหม่</div>
    {form && <MarketForm market={form==='new'?null:form} setData={setData} onOpen={onOpen} onClose={()=>setForm(null)}/>}
  </div>);
}
function MarketForm({market,setData,onOpen,onClose}){
  const isNew=!market;
  const [f,setF]=useState({name:market?market.name:'',mtype:market?market.mtype:'wet',account:market?market.account:'',registered:market?!!market.registered:true,vat:market?!!market.vat:false,vatRate:market?market.vatRate||7:7,taxId:market?market.taxId||'':'',address:market?market.address||'':'',phone:market?market.phone||'':'',email:market?market.email||'':'',promptpay:market?market.promptpay:'0-9455-00000-0',owner:market?market.owner:'',ownerLine:market?market.ownerLine:true,elecRate:market?market.elecRate||7:7,waterRate:market?market.waterRate||18:18});
  const set=(k,v)=>setF({...f,[k]:v});
  const meta=()=>({name:f.name,mtype:f.mtype,account:f.account,registered:!!f.registered,vat:!!f.vat,vatRate:+f.vatRate,taxId:f.taxId,address:f.address,phone:f.phone,email:f.email,promptpay:f.promptpay,owner:f.owner,ownerLine:!!f.ownerLine,elecRate:+f.elecRate,waterRate:+f.waterRate,zones:{A:'โซน A',B:'โซน B',C:'โซน C'}});
  const save=()=>{ if(isNew){ const id='mkt-'+Date.now().toString(36); setData(d=>{ d.markets.push({id,curPeriod:P0,...meta()}); d.stalls.push(...MK.blankStalls(id,{A:6,B:4,C:6})); return {...d}; }); onClose(); onOpen&&onOpen(id); }
    else { setData(d=>{ const m=d.markets.find(x=>x.id===market.id); Object.assign(m,meta()); if(!m.zones)m.zones=market.zones; else m.zones=market.zones; return {...d}; }); onClose(); } };
  return (<Modal title={isNew?'สร้างตลาดใหม่':'แก้ไขตลาด'} tag="แพลตฟอร์ม · จัดการ tenant" onClose={onClose}>
    <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
      <div><label className="lb">ชื่อตลาด</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)} placeholder="เช่น ตลาดเทศบาล 3"/></div>
      <div><label className="lb">ประเภท</label><select className="field" value={f.mtype} onChange={e=>set('mtype',e.target.value)}>{Object.entries(MARKET_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    </div>
    <div className="chkrow"><label className="chkline"><input type="checkbox" checked={f.registered} onChange={e=>set('registered',e.target.checked)}/> จดทะเบียนนิติบุคคล</label>
      <label className="chkline"><input type="checkbox" checked={f.vat} onChange={e=>set('vat',e.target.checked)} disabled={!f.registered}/> จด VAT</label></div>
    <label className="lb">{f.registered?'ชื่อนิติบุคคล (ผู้ออกเอกสาร)':'ชื่อที่ใช้ในเอกสาร (ไม่จดทะเบียน)'}</label><input className="field" value={f.account} onChange={e=>set('account',e.target.value)}/>
    <div className="meterrow" style={{gridTemplateColumns:'2fr 1fr'}}>
      <div><label className="lb">เลขผู้เสียภาษี{!f.registered&&' (ถ้ามี)'}</label><input className="field mono" value={f.taxId} onChange={e=>set('taxId',e.target.value)}/></div>
      <div><label className="lb">PromptPay</label><input className="field mono" value={f.promptpay} onChange={e=>set('promptpay',e.target.value)}/></div></div>
    <label className="lb">ที่อยู่</label><textarea className="field" rows="2" value={f.address} onChange={e=>set('address',e.target.value)}/>
    <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
      <div><label className="lb">เบอร์โทร</label><input className="field" value={f.phone} onChange={e=>set('phone',e.target.value)}/></div>
      <div><label className="lb">เจ้าของตลาด</label><input className="field" value={f.owner} onChange={e=>set('owner',e.target.value)}/></div></div>
    <label className="chkline" style={{marginTop:14}}><input type="checkbox" checked={f.ownerLine} onChange={e=>set('ownerLine',e.target.checked)}/> ใช้ LINE OA แจ้งบิล</label>
    {isNew && <div className="note g" style={{marginTop:14}}>สร้างพร้อมยูนิตว่าง 16 แผง (โซน A/B/C) — เจ้าของเข้าไปเติมผู้เช่าเอง หรือแชร์ลิงก์รับสมัคร</div>}
    <button className="btn pri" style={{marginTop:18,width:'100%'}} onClick={save} disabled={!f.name}>{isNew?'สร้างตลาด + เปิด':'บันทึก'}</button>
  </Modal>);
}

/* ════ PLATFORM · ควบคุมตลาด & สิทธิ์ (KaiDee) ════ */
function MarketControlView({data,setData,onOpen}){
  const setMod=(mid,k,v)=>setData(d=>{ const m=d.markets.find(x=>x.id===mid); m.modules=Object.assign({},m.modules,{[k]:v}); return {...d}; });
  return (<div className="fade">
    <div className="note red" style={{marginBottom:16}}>🎛️ <b>ควบคุมจากแพลตฟอร์ม (KaiDee)</b> — เปิด/ปิดเมนูย่อยรายตลาด · เจ้าของตลาดเห็นเฉพาะเมนูที่เปิด · เข้าคุมสิทธิ์ผู้ใช้ของแต่ละตลาดได้</div>
    <div style={{display:'grid',gap:14}}>{data.markets.map(m=>{ const mm=marketMods(m); const onN=OWNER_MODS.filter(([k])=>mm[k]!==false).length; return (
      <div className="card panel" key={m.id}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:180}}><b>{m.name}</b><div className="sub">{MARKET_TYPES[m.mtype]} · {m.owner} · เปิด {onN}/{OWNER_MODS.length} โมดูล</div></div>
          <button className="btn gh sm" onClick={()=>onOpen(m.id)}>เปิดตลาด ↗</button>
          <button className="btn pri sm" onClick={()=>onOpen(m.id,'users')}>🔐 สิทธิ์ผู้ใช้</button>
        </div>
        <div className="sub" style={{margin:'12px 0 8px'}}>เมนูย่อยที่เปิดให้ตลาดนี้ (แตะเพื่อเปิด/ปิด · ภาพรวม/เช่าแผง/รายงาน เห็นเสมอ)</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{OWNER_MODS.map(([k,l])=>{ const on=mm[k]!==false; return (
          <button key={k} onClick={()=>setMod(m.id,k,!on)} style={{border:'1.5px solid '+(on?'var(--brand)':'var(--hair-2)'),background:on?'var(--brand-soft)':'#fff',color:on?'var(--brand-ink)':'var(--ink-3)',borderRadius:999,padding:'7px 13px',fontSize:12.5,fontWeight:600,cursor:'pointer'}}>{on?'✓ ':'✕ '}{l}</button>); })}</div>
      </div>); })}</div>
  </div>);
}

/* ════ OWNER · นำส่ง/โอนเงินร้าน (Settlement · หลังบ้านบัญชี) ════ */
function SettlementView({data}){
  const {market,stalls,bills}=data;
  const cfg0=(()=>{ try{ return JSON.parse(localStorage.getItem('kd_mkt_settle_v1'))||{}; }catch(e){ return {}; } })();
  const [schedule,setSchedule]=useState(cfg0.schedule||'t1');   // t1 | monthDay
  const [payDay,setPayDay]=useState(cfg0.payDay||1);
  const [utilDay,setUtilDay]=useState(cfg0.utilDay||5);
  const [receipt,setReceipt]=useState(cfg0.receipt||'monthly'); // daily | monthly
  const [payoutBy,setPayoutBy]=useState(cfg0.payoutBy||'both'); // finance | owner | both
  const [actor,setActor]=useState('finance');                   // มุมผู้ทำ (เดโม): finance | owner
  const [recs,setRecs]=useState(cfg0.recs||{});
  const persist=(p)=>{ const nx={schedule,payDay,utilDay,receipt,payoutBy,recs,...p}; setRecs(nx.recs); try{ localStorage.setItem('kd_mkt_settle_v1',JSON.stringify(nx)); }catch(e){} };
  const setCfg=(k,v)=>{ ({schedule:setSchedule,payDay:setPayDay,utilDay:setUtilDay,receipt:setReceipt,payoutBy:setPayoutBy}[k])(v); const nx={schedule,payDay,utilDay,receipt,payoutBy,recs,[k]:v}; try{ localStorage.setItem('kd_mkt_settle_v1',JSON.stringify(nx)); }catch(e){} };
  const rows=stalls.filter(s=>s.rentModel==='gp'&&s.status==='occupied').map(s=>{ const b=bills.find(x=>x.stallId===s.id&&x.period===P0);
    const gpSales=b?b.gpSales||0:0, gp=b?b.rent||0:0, elec=b?b.elecAmt||0:0, water=b?b.waterAmt||0:0, service=b?(b.service||0):0;
    const net=Math.max(0,gpSales-gp-elec-water-service); const key=s.id+'_'+P0; const st=(recs[key]&&recs[key].status)||'review';
    return {s,b,gpSales,gp,elec,water,service,net,key,st}; }).filter(r=>r.b);
  const setStatus=(key,status)=>{ const r={...recs,[key]:{...(recs[key]||{}),status,at:Date.now(),by:actor}}; persist({recs:r}); };
  const canPay=payoutBy==='both'||payoutBy===actor;
  const totNet=rows.reduce((a,r)=>a+r.net,0), totGp=rows.reduce((a,r)=>a+r.gp,0), totUtil=rows.reduce((a,r)=>a+r.elec+r.water+r.service,0);
  const paidN=rows.filter(r=>r.st==='paid').length, apprN=rows.filter(r=>r.st==='approved').length;
  const schedTxt=schedule==='t1'?'T+1 (วันถัดไปหลังยอดเข้า)':('ทุกวันที่ '+payDay+' ของเดือน');
  const lineOne=(r)=>{ const t='สรุปนำส่งเงิน '+r.s.code+' '+r.s.vendor+'\nยอดขาย '+B(r.gpSales)+'\n- GP '+B(r.gp)+'\n- ค่าน้ำ/ไฟ '+B(r.elec+r.water+r.service)+'\n= โอนสุทธิ '+B(r.net)+' ('+monthTH(P0)+')'; window.open('https://line.me/R/msg/text/?'+encodeURIComponent(t),'_blank'); };
  const lineBulk=()=>{ const t=market.name+' · สรุปนำส่งเงินร้านค้า '+monthTH(P0)+'\nโอนสุทธิรวม '+B(totNet)+' · '+rows.length+' ร้าน\nกำหนดโอน: '+schedTxt; window.open('https://line.me/R/msg/text/?'+encodeURIComponent(t),'_blank'); };
  const stPill=(st)=>st==='paid'?<span className="pill p-g">✓ โอนแล้ว</span>:st==='approved'?<span className="pill p-b">อนุมัติแล้ว · รอโอน</span>:<span className="pill p-y">รอบัญชีตรวจ</span>;
  const btnBox={fontSize:12.5};
  return (<div>
    <div className="card panel" style={{padding:'16px 20px',marginBottom:16}}>
      <h3 style={{marginBottom:12}}>ตั้งค่าการนำส่ง (ระบบทำงานอัตโนมัติเมื่อยอดวิ่งเข้า)</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>
        <div><label className="lb">กำหนดโอนเงินให้ร้าน</label>
          <div className="seg" style={{marginBottom:6}}><button className={schedule==='t1'?'on':''} onClick={()=>setCfg('schedule','t1')}>T+1 อัตโนมัติ</button><button className={schedule==='monthDay'?'on':''} onClick={()=>setCfg('schedule','monthDay')}>ทุกวันที่…</button></div>
          {schedule==='monthDay'&&<input className="field num" type="number" min="1" max="28" value={payDay} onChange={e=>setCfg('payDay',+e.target.value)} style={{width:90}}/>}</div>
        <div><label className="lb">หักค่าน้ำ/ค่าไฟ วันที่ (ของเดือน)</label><input className="field num" type="number" min="1" max="28" value={utilDay} onChange={e=>setCfg('utilDay',+e.target.value)} style={{width:90}}/></div>
        <div><label className="lb">ส่งใบเสร็จ/เอกสาร</label>
          <div className="seg"><button className={receipt==='daily'?'on':''} onClick={()=>setCfg('receipt','daily')}>ทุกวัน</button><button className={receipt==='monthly'?'on':''} onClick={()=>setCfg('receipt','monthly')}>สรุปเดือน</button></div></div>
        <div><label className="lb">ใครกดโอนเงินได้</label>
          <div className="seg"><button className={payoutBy==='finance'?'on':''} onClick={()=>setCfg('payoutBy','finance')}>บัญชี</button><button className={payoutBy==='owner'?'on':''} onClick={()=>setCfg('payoutBy','owner')}>หัวหน้า/เจ้าของ</button><button className={payoutBy==='both'?'on':''} onClick={()=>setCfg('payoutBy','both')}>ทั้งคู่</button></div></div>
      </div>
      <div className="note g" style={{marginTop:14}}>เงินขายวิ่งเข้าบัญชีกลาง → ระบบคำนวณ <b>ยอดขาย − GP − ค่าน้ำ/ไฟ</b> อัตโนมัติ → บัญชีตรวจแล้วส่งอนุมัติ → {payoutBy==='finance'?'บัญชี':payoutBy==='owner'?'หัวหน้า/เจ้าของ':'บัญชีหรือหัวหน้า/เจ้าของ'}กดโอนให้ร้าน · ส่งสรุปผ่าน LINE ({receipt==='daily'?'ทุกวัน':'สรุปเดือน'})</div>
    </div>

    <div className="kpis">
      <Kpi label={'ต้องโอนให้ร้าน · '+monthTH(P0)} value={B(totNet)} foot={rows.length+' ร้าน GP'} tone="var(--brand)"/>
      <Kpi label="GP ที่ตลาดได้" value={B(totGp)} foot="หักจากยอดขาย" tone="var(--blue-ink)"/>
      <Kpi label="ค่าน้ำ/ไฟ/ส่วนกลาง" value={B(totUtil)} foot={'หักวันที่ '+utilDay}/>
      <Kpi label="สถานะโอน" value={paidN+'/'+rows.length} foot={apprN+' รออนุมัติโอน · กำหนด '+(schedule==='t1'?'T+1':'วันที่ '+payDay)} tone={paidN===rows.length&&rows.length?'var(--green)':'var(--gold)'}/>
    </div>

    <div className="toolbar" style={{marginTop:16}}>
      <span className="sub">กำลังทำในนาม:</span>
      <div className="seg"><button className={actor==='finance'?'on':''} onClick={()=>setActor('finance')}>👩‍💼 บัญชี</button><button className={actor==='owner'?'on':''} onClick={()=>setActor('owner')}>👔 หัวหน้า/เจ้าของ</button></div>
      <div className="grow"/>
      <button className="btn gh" onClick={lineBulk}>📤 ส่งสรุปนำส่ง (LINE)</button>
    </div>

    <div className="card" style={{overflow:'hidden'}}>
      <table><thead><tr><th>ร้าน</th><th className="r">ยอดขาย</th><th className="r">GP</th><th className="r">น้ำ/ไฟ</th><th className="r">โอนสุทธิ</th><th className="c">สถานะ</th><th className="r">จัดการ</th></tr></thead><tbody>
        {rows.length===0&&<tr><td colSpan="7" className="c" style={{color:'var(--ink-3)',padding:'26px'}}>ไม่มีร้านคิด GP ที่ออกบิลรอบนี้ — ออกบิลในเมนู “บิล & เก็บเงิน” ก่อน</td></tr>}
        {rows.map(r=>(<tr key={r.key} className="row">
          <td><b>{r.s.code}</b> <span style={{color:'var(--ink-2)'}}>{r.s.vendor}</span></td>
          <td className="r num">{B(r.gpSales)}</td>
          <td className="r num" style={{color:'var(--blue-ink)'}}>-{B(r.gp)}</td>
          <td className="r num" style={{color:'#B26A00'}}>-{B(r.elec+r.water+r.service)}</td>
          <td className="r num" style={{fontWeight:700,color:'var(--brand-ink)'}}>{B(r.net)}</td>
          <td className="c">{stPill(r.st)}</td>
          <td className="r" style={{whiteSpace:'nowrap'}}>
            {r.st==='review'&&<button className="btn pri sm" style={btnBox} onClick={()=>setStatus(r.key,'approved')}>✓ ตรวจ · ส่งอนุมัติ</button>}
            {r.st==='approved'&&(canPay?<button className="btn pri sm" style={{...btnBox,background:'var(--green)'}} onClick={()=>{ setStatus(r.key,'paid'); }}>💸 โอนแล้ว</button>:<span className="pill p-n">รอ{payoutBy==='owner'?'หัวหน้า/เจ้าของ':'บัญชี'}โอน</span>)}
            {r.st==='approved'&&<button className="btn gh sm" style={{...btnBox,marginLeft:6}} onClick={()=>setStatus(r.key,'review')}>ตีกลับ</button>}
            {r.st==='paid'&&<button className="btn gh sm" style={btnBox} onClick={()=>lineOne(r)}>📤 ใบเสร็จ (LINE)</button>}
          </td>
        </tr>))}
      </tbody></table>
    </div>
  </div>);
}

/* ════ OWNER · กระเป๋าเงินตลาด (Wallet) ════ */
function walletsOf(data,market){ return (data.wallets||[]).filter(w=>w.marketId===market.id); }
function getWallet(d,stall){ d.wallets=d.wallets||[]; let w=d.wallets.find(x=>x.stallId===stall.id); if(!w){ w={stallId:stall.id,marketId:stall.marketId,balance:0,ledger:[]}; d.wallets.push(w); } return w; }
function WalletView({data,setData}){
  const {market,stalls,bills}=data; const mode=MK.payMode(market);
  const [topup,setTopup]=useState(null); const [ledgerOf,setLedgerOf]=useState(null);
  const setVA=(s)=>{ const v=prompt('เลขบัญชีเสมือน (Virtual Account) ของร้าน '+s.code+' — ธนาคารออกให้ต่อร้าน (ร้านโอนเข้าเลขนี้ = เข้ากระเป๋าอัตโนมัติ)', s.va||''); if(v==null)return; setData(d=>{ const x=d.stalls.find(z=>z.id===s.id); x.va=v.trim(); return {...d}; }); };
  const occ=stalls.filter(s=>s.status==='occupied');
  const wl=walletsOf(data,market); const balOf=(sid)=>{ const w=wl.find(x=>x.stallId===sid); return w?w.balance:0; };
  const nextBill=(sid)=>bills.filter(b=>b.stallId===sid&&b.period===P0&&b.status!=='paid')[0];
  const totBal=occ.reduce((a,s)=>a+balOf(s.id),0);
  const now=new Date(); const thisMon=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const flat=wl.flatMap(w=>w.ledger||[]);
  const topupMon=flat.filter(l=>l.type==='topup'&&(l.ts||'').slice(0,7)===thisMon).reduce((a,l)=>a+l.amount,0);
  const billMon=flat.filter(l=>l.type==='bill'&&(l.ts||'').slice(0,7)===thisMon).reduce((a,l)=>a+Math.abs(l.amount),0);
  const lowN=occ.filter(s=>{ const nb=nextBill(s.id); return nb&&balOf(s.id)<nb.total; }).length;
  const payBill=(stall,bill)=>{ setData(d=>{ const w=getWallet(d,stall); if(w.balance<bill.total){ return d; }
    w.balance-=bill.total; (w.ledger=w.ledger||[]).push({ts:new Date().toISOString(),type:'bill',amount:-bill.total,bal:w.balance,note:'หักบิล '+monthTH(bill.period)+' ('+bill.ref+')'});
    const bb=d.bills.find(x=>x.id===bill.id); bb.status='paid'; bb.method='wallet'; bb.paidAt=Date.now();
    const st=d.stalls.find(x=>x.id===stall.id); if(st&&!d.bills.some(x=>x.stallId===st.id&&x.status==='overdue'&&x.id!==bb.id)) st.locked=false;
    return {...d}; }); };
  const autoDeduct=()=>{ const targets=occ.filter(s=>{ const nb=nextBill(s.id); return nb&&balOf(s.id)>=nb.total; });
    if(!targets.length){ alert('ไม่มีร้านที่ยอดกระเป๋าพอหักบิลรอบนี้'); return; }
    if(!confirm('หักบิลรอบนี้จากกระเป๋าอัตโนมัติ '+targets.length+' ร้าน?'))return;
    setData(d=>{ targets.forEach(s=>{ const nb=d.bills.find(b=>b.stallId===s.id&&b.period===P0&&b.status!=='paid'); if(!nb)return; const w=getWallet(d,s); if(w.balance<nb.total)return;
      w.balance-=nb.total; (w.ledger=w.ledger||[]).push({ts:new Date().toISOString(),type:'bill',amount:-nb.total,bal:w.balance,note:'หักบิลอัตโนมัติ '+monthTH(nb.period)}); nb.status='paid'; nb.method='wallet'; nb.paidAt=Date.now();
      const st=d.stalls.find(x=>x.id===s.id); if(st&&!d.bills.some(x=>x.stallId===st.id&&x.status==='overdue'&&x.id!==nb.id)) st.locked=false; }); return {...d}; }); };
  const exportW=()=>csv('กระเป๋าเงิน_'+market.id+'.csv',[['ยูนิต','ร้าน','ยอดคงเหลือ','บิลรอบนี้','สถานะ']]
    .concat(occ.map(s=>{const nb=nextBill(s.id);return[s.code,s.vendor,balOf(s.id),nb?nb.total:0,nb?(balOf(s.id)>=nb.total?'ยอดพอ':'ยอดไม่พอ'):'ไม่มีบิลค้าง'];})));
  const wLedger=ledgerOf?(wl.find(w=>w.stallId===ledgerOf.id)||{ledger:[]}).ledger||[]:[];
  return (<div className="fade">
    <div className="note g" style={{marginBottom:16}}>โหมดรับเงินตลาดนี้: <b>{mode==='wallet'?'กระเป๋าเงินตลาด':mode==='both'?'กระเป๋าเงิน + PromptPay (ช่วงเปลี่ยนผ่าน)':'PromptPay ตรง'}</b>{mode==='promptpay'?' — เปลี่ยนเป็นกระเป๋าเงินได้ที่เมนู “ข้อมูลตลาด”':' · ร้านเติมเงินเข้ากระเป๋า → ระบบหักค่าเช่าอัตโนมัติ ไม่ต้องจับคู่สลิป'}</div>
    <div className="kpis">
      <Kpi label="เงินในกระเป๋ารวม" value={B(totBal)} foot={occ.length+' ร้าน'} tone="var(--brand-ink)"/>
      <Kpi label="เติมเข้าเดือนนี้" value={B(topupMon)} foot={monthTH(P0)} tone="var(--green)"/>
      <Kpi label="หักบิลเดือนนี้" value={B(billMon)} foot="ตัดจากกระเป๋าอัตโนมัติ" tone="var(--blue-ink)"/>
      <Kpi label="ร้านยอดไม่พอ" value={lowN} foot="เติมก่อนถึงกำหนดบิล" tone={lowN?'var(--gold)':'var(--green)'}/>
    </div>
    <div className="toolbar"><span className="sub">เก็บเงินล่วงหน้าเข้ากระเป๋า → หักบิลอัตโนมัติ · รู้ว่าใครจ่ายทันที (ผูกกระเป๋ารายร้าน)</span>
      <div className="grow"/><button className="btn pri" onClick={autoDeduct}>⚡ หักบิลจากกระเป๋า (รอบนี้)</button><button className="btn gh" onClick={exportW}>⬇ CSV</button></div>
    <div className="card" style={{overflow:'hidden'}}>
      <table><thead><tr><th>ยูนิต / ร้าน</th><th className="r">ยอดคงเหลือ</th><th className="r">บิลรอบนี้</th><th className="c">สถานะ</th><th className="r">จัดการ</th></tr></thead>
        <tbody>{occ.map(s=>{ const bal=balOf(s.id),nb=nextBill(s.id),enough=nb&&bal>=nb.total; return (<tr key={s.id} className="row">
          <td><b>{s.code}</b> <span style={{color:'var(--ink-2)'}}>{s.vendor}</span>{s.locked&&<span className="pill p-r" style={{marginLeft:6}}>ล็อก</span>}<div className="sub" style={{marginTop:2}}>VA: <span className="mono">{s.va||'— ยังไม่ผูก'}</span> <a style={{cursor:'pointer'}} onClick={()=>setVA(s)}>{s.va?'แก้':'+ ผูกเลข'}</a></div></td>
          <td className="r num" style={{fontWeight:700,color:bal>0?'var(--brand-ink)':'var(--ink-3)'}}>{B(bal)}</td>
          <td className="r num">{nb?B(nb.total):'—'}</td>
          <td className="c">{!nb?<span className="pill p-g">✓ ไม่มีบิลค้าง</span>:enough?<span className="pill p-b">ยอดพอ</span>:<span className="pill p-y">ยอดไม่พอ</span>}</td>
          <td className="r" style={{whiteSpace:'nowrap'}}>
            <button className="btn pri sm" onClick={()=>setTopup(s)}>➕ เติมเงิน</button>
            {nb&&enough&&<button className="btn gh sm" style={{marginLeft:6}} onClick={()=>payBill(s,nb)}>หักบิล</button>}
            <button className="btn gh sm" style={{marginLeft:6}} onClick={()=>setLedgerOf(s)}>เดินบัญชี</button></td></tr>); })}
          {occ.length===0&&<tr><td colSpan="5" className="c" style={{color:'var(--ink-3)',padding:'26px'}}>ยังไม่มีร้านในตลาดนี้</td></tr>}</tbody></table>
    </div>
    {topup && <TopUpModal stall={topup} market={market} balance={balOf(topup.id)} setData={setData} onClose={()=>setTopup(null)}/>}
    {ledgerOf && <Modal title={'เดินบัญชีกระเป๋า · '+ledgerOf.code+' '+ledgerOf.vendor} tag={'ยอดคงเหลือ '+B(balOf(ledgerOf.id))} onClose={()=>setLedgerOf(null)} max={560}>
      {wLedger.length?<div className="feed">{[...wLedger].reverse().map((l,i)=>(<div className="feeditem" key={i}><div className="fi-ic" style={{background:l.amount>0?'var(--green-soft)':'var(--blue-soft)'}}>{l.amount>0?'↓':'↑'}</div><div className="fi-b"><div className="fi-t">{l.note}</div><div className="fi-s">{thDateTime(new Date(l.ts).getTime())} · คงเหลือ {B(l.bal)}</div></div><div className="fi-v" style={{color:l.amount>0?'var(--green)':'var(--blue-ink)'}}>{l.amount>0?'+':''}{B(l.amount)}</div></div>))}</div>:<div className="empty">ยังไม่มีรายการเดินบัญชี</div>}
    </Modal>}
  </div>);
}
function TopUpModal({stall,market,balance,setData,onClose}){
  const [amt,setAmt]=useState(1000); const [method,setMethod]=useState('promptpay'); const [qr,setQr]=useState(false); const qrRef=React.useRef();
  const qrPng=(cb)=>{ const svg=qrRef.current&&qrRef.current.querySelector('svg'); if(!svg){cb(null);return;} const xml=new XMLSerializer().serializeToString(svg); const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); c.width=640;c.height=760; const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,640,760); g.drawImage(img,60,60,520,520); g.fillStyle='#0E2A2A'; g.textAlign='center'; g.font='700 34px sans-serif'; g.fillText('เติมเงินกระเป๋า · '+stall.code, 320, 630); g.font='500 26px sans-serif'; g.fillStyle='#54615B'; g.fillText('PromptPay '+market.promptpay+'  ·  '+B(+amt||0), 320, 675); cb(c.toDataURL('image/png')); }; img.onerror=()=>cb(null); img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(xml))); };
  const saveQR=()=>qrPng(u=>{ if(!u){alert('บันทึกไม่สำเร็จ');return;} const a=document.createElement('a'); a.href=u; a.download='เติมเงิน-'+stall.code+'.png'; document.body.appendChild(a); a.click(); a.remove(); });
  const openQR=()=>qrPng(u=>{ if(u) window.open(u,'_blank'); });
  const commit=()=>{ const a=+amt||0; if(a<=0){ alert('ใส่จำนวนเงิน'); return; }
    setData(d=>{ const w=getWallet(d,stall); w.balance+=a; (w.ledger=w.ledger||[]).push({ts:new Date().toISOString(),type:'topup',amount:a,bal:w.balance,note:'เติมเงิน ('+(method==='promptpay'?'PromptPay':'เงินสด')+')'}); return {...d}; }); onClose(); };
  return (<Modal title={'เติมเงินกระเป๋า · '+stall.code+' '+stall.vendor} tag={'ยอดคงเหลือปัจจุบัน '+B(balance)} onClose={onClose} max={480}>
    <label className="lb">จำนวนเงินที่เติม (บาท)</label><input className="field num" type="number" value={amt} onChange={e=>setAmt(e.target.value)}/>
    <div style={{display:'flex',gap:8,margin:'10px 0'}}>{[500,1000,2000,5000].map(v=><button key={v} className="btn gh sm" onClick={()=>setAmt(v)}>{B(v)}</button>)}</div>
    <label className="lb">ช่องทางรับเงิน</label>
    <div className="seg" style={{width:'100%'}}><button style={{flex:1}} className={method==='promptpay'?'on':''} onClick={()=>setMethod('promptpay')}>PromptPay</button><button style={{flex:1}} className={method==='cash'?'on':''} onClick={()=>setMethod('cash')}>เงินสด</button></div>
    {method==='promptpay'&&<div style={{textAlign:'center',marginTop:14}}>{qr?<>
      <div ref={qrRef} style={{width:200,margin:'0 auto',background:'#fff',padding:10,borderRadius:12,border:'1px solid var(--hair-2)'}} dangerouslySetInnerHTML={{__html:MK.qrSVG(market.promptpay+'|'+stall.id+'|'+(+amt||0))}}/>
      <div className="sub" style={{marginTop:6}}>PromptPay {market.promptpay} · {B(+amt||0)}</div>
      <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:10,flexWrap:'wrap'}}><button className="btn pri sm" onClick={saveQR}>⬇ บันทึก QR (รูป)</button><button className="btn gh sm" onClick={openQR}>🔍 เปิดรูปเต็มจอ</button></div>
      <div className="sub" style={{marginTop:10,color:'var(--ink-3)'}}>ร้านเปิดแอปธนาคาร → สแกน หรืออัปโหลดรูป QR นี้เพื่อเติมเงิน</div>
      <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:8,flexWrap:'wrap',opacity:.6}}>{['SCB','K PLUS','กรุงไทย','ttb','PromptPay'].map(b=><span key={b} className="pill p-n">{b}</span>)}</div>
      <div className="sub" style={{marginTop:4,color:'var(--ink-3)'}}>เปิดแอปธนาคารอัตโนมัติ (deep link) — เร็วๆนี้</div>
    </>:<button className="btn gh" onClick={()=>setQr(true)}>แสดง QR ให้ร้านสแกนเติม</button>}<div className="sub" style={{marginTop:6}}>PromptPay {market.promptpay}</div></div>}
    <button className="btn pri" style={{marginTop:16,width:'100%'}} onClick={commit}>ยืนยันเติมเงิน {B(+amt||0)}</button>
  </Modal>);
}

/* ════ OWNER · จองรายวัน (ตลาดนัด) ════ */
function DailyView({data,setData}){
  const {market,stalls,applications}=data; const bc=MK.bookingCfg(market);
  const [day,setDay]=useState(MK.todayISO()); const [add,setAdd]=useState(false);
  const daily=(applications||[]).filter(a=>a.bookPath==='daily'&&a.status!=='rejected');
  const onDay=(dd)=>daily.filter(a=>(a.dates||[]).includes(dd));
  const rows=onDay(day);
  const rateOf=(a)=>a.dayRate||bc.dailyRate||0;
  const utilOf=(a)=>a.dayUtil!=null?a.dayUtil:(bc.dailyUtil||0);
  const dueOf=(a)=>rateOf(a)+utilOf(a);
  const isPaid=(a)=>!!(a.paid&&a.paid[day]); const isIn=(a)=>!!(a.checkin&&a.checkin[day]);
  const collected=rows.filter(isPaid).reduce((s,a)=>s+dueOf(a),0);
  const due=rows.filter(a=>!isPaid(a)).reduce((s,a)=>s+dueOf(a),0);
  const inN=rows.filter(isIn).length, waitN=rows.filter(a=>a.status==='booked').length;
  const shift=(n)=>{ const d=new Date(day); d.setDate(d.getDate()+n); setDay(d.toISOString().slice(0,10)); };
  const confirm2=(a)=>setData(d=>{ const x=d.applications.find(y=>y.id===a.id); x.status='approved'; return {...d}; });
  const togglePaid=(a)=>setData(d=>{ const x=d.applications.find(y=>y.id===a.id); x.paid=Object.assign({},x.paid,{[day]:!(x.paid&&x.paid[day])}); return {...d}; });
  const toggleIn=(a)=>setData(d=>{ const x=d.applications.find(y=>y.id===a.id); x.checkin=Object.assign({},x.checkin,{[day]:!(x.checkin&&x.checkin[day])}); return {...d}; });
  const remove=(a)=>{ if(!confirm('ลบการจองรายวันนี้?'))return; setData(d=>{ d.applications=d.applications.filter(y=>y.id!==a.id); return {...d}; }); };
  const WD=['อา','จ','อ','พ','พฤ','ศ','ส']; const dd=new Date(day);
  const strip=Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()+i); return d.toISOString().slice(0,10); });
  const remind=()=>{ const wait=rows.filter(a=>!isPaid(a)); if(!wait.length){ alert('เก็บเงินครบทุกร้านแล้ว'); return; }
    const txt='🔔 ค่าแผงรายวัน '+market.name+' · '+thDate(day)+'\n\n'+wait.map(a=>'• '+a.name+' — '+B(dueOf(a))).join('\n')+'\n\nชำระ PromptPay '+market.promptpay;
    window.open('https://line.me/R/msg/text/?'+encodeURIComponent(txt),'_blank'); };
  const exportDay=()=>csv('จองรายวัน_'+day+'.csv',[['ร้าน','เบอร์','สินค้า','แผง','ค่าเช่า/วัน','น้ำ-ไฟ','รวม','ชำระ','เช็คอิน']]
    .concat(rows.map(a=>{const s=stalls.find(x=>x.id===a.stallId);return[a.name,a.phone||'',a.cat||'',(a.stallCode||(s&&s.code)||'-'),rateOf(a),utilOf(a),dueOf(a),isPaid(a)?'จ่ายแล้ว':'ค้าง',isIn(a)?'มาแล้ว':'ยังไม่มา'];})));
  if(!bc.dailyOn) return (<div className="fade"><div className="note gold">ยังไม่ได้เปิด “จองขายรายวัน” — เปิดใช้งานที่เมนู <b>การจอง &amp; เรียกเก็บ</b> ก่อน แล้วตั้งค่าเช่า/วัน</div></div>);
  return (<div className="fade">
    <div className="kpis">
      <Kpi label={'จองวันนี้ · '+WD[dd.getDay()]+' '+thDate(day)} value={rows.length} foot={waitN?('รอยืนยัน '+waitN+' ราย'):'ยืนยันครบ'} tone="var(--brand-ink)"/>
      <Kpi label="เก็บได้แล้ว" value={B(collected)} foot={rows.length?rows.filter(isPaid).length+'/'+rows.length+' ร้าน':'—'} tone="var(--green)"/>
      <Kpi label="ค้างเก็บ" value={B(due)} foot="ค่าเช่า+น้ำ/ไฟ รายวัน" tone={due?'var(--red)':'var(--ink)'}/>
      <Kpi label="เช็คอินหน้างาน" value={inN+'/'+rows.length} foot="มาจริงวันนี้" tone="var(--blue-ink)"/>
    </div>
    <div className="toolbar">
      <button className="btn gh sm" onClick={()=>shift(-1)}>← เมื่อวาน</button>
      <input className="field" type="date" style={{maxWidth:170}} value={day} onChange={e=>setDay(e.target.value)}/>
      <button className="btn gh sm" onClick={()=>shift(1)}>พรุ่งนี้ →</button>
      {day!==MK.todayISO()&&<button className="btn gh sm" onClick={()=>setDay(MK.todayISO())}>วันนี้</button>}
      <div className="grow"/>
      <button className="btn pri" onClick={()=>setAdd(true)}>+ เพิ่มจองรายวัน (walk-in)</button>
      <button className="btn gh" onClick={remind}>🔔 ทวงเก็บเงิน</button>
      <button className="btn gh" onClick={exportDay}>⬇ CSV</button>
    </div>
    <div style={{display:'flex',gap:8,margin:'2px 0 16px',overflowX:'auto'}}>{strip.map(dstr=>{ const n=onDay(dstr).length; const d2=new Date(dstr); const on=dstr===day;
      return (<button key={dstr} onClick={()=>setDay(dstr)} style={{flex:'0 0 auto',border:'1px solid '+(on?'var(--brand)':'var(--hair-2)'),background:on?'var(--brand)':'#fff',color:on?'#fff':'var(--ink-2)',borderRadius:12,padding:'8px 12px',fontFamily:'var(--font)',fontWeight:600,textAlign:'center',minWidth:64}}>
        <div style={{fontSize:11,opacity:.8}}>{WD[d2.getDay()]}</div><div style={{fontSize:17,fontWeight:700}}>{d2.getDate()}</div>
        <div style={{fontSize:10.5,marginTop:2,color:on?'#dff':(n?'var(--brand-ink)':'var(--ink-3)')}}>{n?n+' จอง':'ว่าง'}</div></button>); })}</div>
    <div className="card" style={{overflow:'hidden'}}>
      <table><thead><tr><th>ร้าน / ผู้จอง</th><th className="c">แผง</th><th className="r">ค่าเช่า/วัน</th><th className="c">ชำระ</th><th className="c">เช็คอิน</th><th></th></tr></thead>
        <tbody>{rows.length?rows.map(a=>{ const s=stalls.find(x=>x.id===a.stallId); const paid=isPaid(a),cin=isIn(a);
          return (<tr key={a.id} className="row">
            <td><b>{a.name}</b>{a.walkin&&<span className="pill p-n" style={{marginLeft:6}}>walk-in</span>}{a.status==='booked'&&<span className="pill p-y" style={{marginLeft:6}}>รอยืนยัน</span>}<div className="sub">{a.phone||'—'} · {a.cat||'สินค้าทั่วไป'}{a.line?' · LINE':''}</div></td>
            <td className="c">{a.stallCode||(s&&s.code)||<span className="sub">ไม่ระบุ</span>}</td>
            <td className="r num" style={{fontWeight:700}}>{B(dueOf(a))}<div className="sub" style={{fontWeight:400}}>เช่า {B(rateOf(a))}{utilOf(a)?' + น้ำไฟ '+B(utilOf(a)):''}</div></td>
            <td className="c">{paid?<span className="pill p-g">✓ จ่ายแล้ว</span>:<button className="btn pri sm" onClick={()=>togglePaid(a)}>💵 เก็บเงิน</button>}{paid&&<div><a className="sub" style={{cursor:'pointer'}} onClick={()=>togglePaid(a)}>ยกเลิก</a></div>}</td>
            <td className="c">{a.status==='booked'?<button className="btn gh sm" onClick={()=>confirm2(a)}>ยืนยันจอง</button>:(cin?<span className="pill p-b">🚪 มาแล้ว</span>:<button className="btn gh sm" onClick={()=>toggleIn(a)}>🚪 เช็คอิน</button>)}</td>
            <td className="r"><button className="btn dngh sm" onClick={()=>remove(a)}>ลบ</button></td></tr>); })
          :<tr><td colSpan="6" className="c" style={{color:'var(--ink-3)',padding:'26px'}}>ยังไม่มีการจองรายวันในวันนี้ — กด “+ เพิ่มจองรายวัน” เพื่อลงร้านหน้างาน</td></tr>}</tbody></table>
    </div>
    <div className="note g" style={{marginTop:14}}>ร้านจองผ่านผังในไลน์ (ทาง “จองรายวัน”) จะเด้งเข้ามาที่นี่อัตโนมัติ · เก็บเงิน/เช็คอินแยกเป็นรายวัน ไม่ปนกับบิลรายเดือน</div>
    {add && <AddDailyModal data={data} setData={setData} day={day} rate={bc.dailyRate} util={bc.dailyUtil} onClose={()=>setAdd(false)}/>}
  </div>);
}
function AddDailyModal({data,setData,day,rate,util,onClose}){
  const {market,stalls}=data; const vac=stalls.filter(s=>s.status==='vacant');
  const [f,setF]=useState({name:'',phone:'',cat:'',stallId:'',dayRate:rate||150,dayUtil:util||0,paid:true});
  const set=(k,v)=>setF({...f,[k]:v});
  const save=()=>{ if(!f.name.trim()){ alert('ใส่ชื่อร้าน/ผู้จอง'); return; }
    setData(d=>{ const s=vac.find(x=>x.id===f.stallId); (d.applications=d.applications||[]).push({
      id:'day_'+Date.now().toString(36), marketId:market.id, bookPath:'daily', status:'approved', walkin:true,
      name:f.name.trim(), phone:f.phone.trim(), cat:f.cat.trim(), stallId:f.stallId||null, stallCode:s?s.code:'',
      dates:[day], dayRate:+f.dayRate||0, dayUtil:+f.dayUtil||0, amount:(+f.dayRate||0)+(+f.dayUtil||0),
      paid:f.paid?{[day]:true}:{}, checkin:{} }); return {...d}; }); onClose(); };
  return (<Modal title="เพิ่มจองรายวัน (walk-in)" tag={'ตลาดนัด · '+thDate(day)} onClose={onClose} max={520}>
    <div className="note g" style={{marginBottom:14}}>ลงร้านที่มาจองหน้างานเอง — บันทึกเข้าวันที่เลือก เก็บเงิน/เช็คอินได้ทันที</div>
    <label className="lb">ชื่อร้าน / ผู้จอง</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)} placeholder="เช่น ป้าแดงส้มตำ"/>
    <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr',marginTop:10}}>
      <div><label className="lb">เบอร์โทร</label><input className="field" value={f.phone} onChange={e=>set('phone',e.target.value)}/></div>
      <div><label className="lb">สินค้า</label><input className="field" value={f.cat} onChange={e=>set('cat',e.target.value)} placeholder="เช่น อาหารตามสั่ง"/></div>
    </div>
    <label className="lb" style={{marginTop:10}}>แผงที่ลง (ถ้ามี)</label>
    <select className="field" value={f.stallId} onChange={e=>set('stallId',e.target.value)}><option value="">— ไม่ระบุแผง —</option>{vac.map(s=><option key={s.id} value={s.id}>{s.code} · {s.zoneName||''} {s.area} ตร.ม.</option>)}</select>
    <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr',marginTop:10}}>
      <div><label className="lb">ค่าเช่า/วัน (บาท)</label><input className="field" type="number" value={f.dayRate} onChange={e=>set('dayRate',e.target.value)}/></div>
      <div><label className="lb">ค่าน้ำ/ไฟ/วัน (บาท)</label><input className="field" type="number" value={f.dayUtil} onChange={e=>set('dayUtil',e.target.value)}/></div>
    </div>
    <label className="chkline" style={{marginTop:12}}><input type="checkbox" checked={f.paid} onChange={e=>set('paid',e.target.checked)}/> เก็บเงินแล้ว (จ่ายหน้างาน)</label>
    <button className="btn pri" style={{marginTop:16,width:'100%'}} onClick={save}>บันทึกการจองรายวัน</button>
  </Modal>);
}

/* ════ ROOT ════ */
const ROLES={
  owner:{label:'เจ้าของตลาด',color:'#0E9C88',groups:[['ดำเนินงาน',['dash','stalls','daily','billing','wallet','gp','consign']],['บัญชี & ภาษี',['settle','acct','vat','reports']],['ตั้งค่าตลาด',['bookcfg','sub','users','info']]],tabs:[['dash','ภาพรวม','📊'],['stalls','เช่าแผง','🏬'],['daily','จองรายวัน','📅'],['billing','บิล & เก็บเงิน','🧾'],['wallet','กระเป๋าเงินร้าน','👛'],['gp','GP & ยอดขาย','📈'],['consign','ขายฝาก','🤝'],['settle','นำส่ง/โอนเงินร้าน','💸'],['acct','บัญชี','📒'],['vat','รายงานภาษี','🧮'],['reports','รายงาน','📁'],['bookcfg','การจอง & เรียกเก็บ','📋'],['sub','แพ็กเกจ & ชำระเงิน','💳'],['users','ผู้ใช้ & สิทธิ์','🔐'],['info','ข้อมูลตลาด','🏛️']]},
  vendor:{label:'แผงค้า / ร้าน',color:'#1E73B0',tabs:[['me','แผงของฉัน','🛒']]},
  platform:{label:'แพลตฟอร์ม',color:'#7a4a8c',tabs:[['plat','ภาพรวมแพลตฟอร์ม','🌐'],['markets','รายการตลาด','🏢'],['control','ควบคุมตลาด & สิทธิ์','🎛️']]},
};
function App(){
  const [data,setData0]=useState(()=>MK.load());
  const [role,setRole]=useState('owner'); const [tab,setTab]=useState('dash');
  const [activeMarketId,setActiveMarketId]=useState(()=>MK.load().markets[0].id); const [vstall,setVstall]=useState(null);
  const setData=(fn)=>setData0(d=>{ const nd=typeof fn==='function'?fn(d):fn; MK.save(nd); if(window.__mktSync) window.__mktSync.push(); return nd; });
  // ── sync ข้ามเครื่องผ่าน backend (platform-api) — ผูกครั้งเดียว ──
  useEffect(()=>{
    if(!window.PLAT_API) return;
    const p=new URLSearchParams(location.search);
    const biz=p.get('market')||(MK.load().markets[0]||{}).id||'demo-market';
    const sync=window.PLAT_API.attach({
      biz, type:'market', key:'market',
      read:()=>MK.load(),
      write:(b)=>MK.save(b),
      onRemote:(b)=>setData0(b),
      stamp:(b)=>(b&&b.updatedAt)||0,
    });
    window.__mktSync=sync;
    return ()=>{ try{sync.stop();}catch(e){} window.__mktSync=null; };
  },[]);
  const activeMarket=data.markets.find(m=>m.id===activeMarketId)||data.markets[0];
  const platMkt=(()=>{ try{ return (JSON.parse(localStorage.getItem('kd_platform_control_v1')||'{}').market)||{}; }catch(e){ return {}; } })();
  const mmOwner=marketMods(activeMarket); const tabAllowed=(k)=> platMkt[k]!==false && (!OWNER_MODS.some(o=>o[0]===k) || mmOwner[k]!==false);
  const mstalls=data.stalls.filter(s=>s.marketId===activeMarket.id), mbills=data.bills.filter(b=>b.marketId===activeMarket.id);
  const mapps=(data.applications||[]).filter(a=>a.marketId===activeMarket.id);
  const mexp=(data.expenses||[]).filter(e=>e.marketId===activeMarket.id);
  const musers=(data.users||[]).filter(u=>u.marketId===activeMarket.id);
  const mcv=(data.cVendors||[]).filter(v=>v.marketId===activeMarket.id);
  const mcs=(data.cStock||[]).filter(s=>s.marketId===activeMarket.id);
  const sdata={market:activeMarket,stalls:mstalls,bills:mbills,applications:mapps,expenses:mexp,users:musers,cVendors:mcv,cStock:mcs};
  useEffect(()=>{ setTab(ROLES[role].tabs[0][0]); },[role]);
  useEffect(()=>{ if(role==='owner' && !tabAllowed(tab) && tab!=='dash') setTab('dash'); },[activeMarketId,tab,role]);
  useEffect(()=>{ if(role==='vendor'){ const occ=data.stalls.filter(s=>s.marketId===activeMarket.id&&s.status==='occupied');
    if(!occ.find(s=>s.id===vstall)){ const pref=occ.find(s=>data.bills.some(b=>b.stallId===s.id&&b.period===P0&&b.status!=='paid'))||occ[0]; setVstall(pref?pref.id:null); } } },[role,activeMarketId,data]);
  const overdueN=mbills.filter(b=>b.period===P0&&b.status==='overdue').length;
  const pendN=mapps.filter(a=>a.status==='pending'||a.status==='lead'||a.status==='booked').length;
  const R=ROLES[role];
  const doReset=()=>{ if(confirm('รีเซ็ตข้อมูลสาธิตทั้งหมด?')){ const s=MK.reset(); setData0(s); setActiveMarketId(s.markets[0].id); } };
  const showSel = role==='owner'||role==='vendor';
  return (<div className="app">
    <div className="side">
      <div className="logo"><div className="logo-mk"><img src="assets/kaidee-logo.png" alt="KaiDee"/></div><div className="logo-tx">KaiDee Platform<small>โปรแกรมตลาด · เฟส 1</small></div></div>
      <div className="roleswitch"><div className="rl-h">มุมมอง (แยกสิทธิ์)</div>
        {Object.entries(ROLES).map(([k,v])=><button key={k} className={role===k?'on':''} onClick={()=>setRole(k)} style={role===k?{color:'#fff'}:null}><span className="rc" style={{color:v.color}}/><span>{v.label}</span></button>)}</div>
      {(()=>{ const tb={}; R.tabs.forEach(t=>tb[t[0]]=t); const navBtn=([k,l,ic])=>(<button key={k} className={'nav'+(tab===k?' on':'')} onClick={()=>setTab(k)}><span className="ic">{ic}</span>{l}
        {k==='billing'&&overdueN>0&&<span className="badge">{overdueN}</span>}{k==='stalls'&&pendN>0&&<span className="badge" style={{background:'var(--blue)'}}>{pendN}</span>}</button>);
        return R.groups ? R.groups.map(([gl,ks])=><div key={gl}><div className="navgrp">{gl}</div>{ks.map(k=>tb[k]&&(role!=='owner'||tabAllowed(k))&&(k!=='daily'||MK.bookingCfg(activeMarket).dailyOn)&&(k!=='wallet'||MK.payMode(activeMarket)!=='promptpay')&&navBtn(tb[k]))}</div>) : R.tabs.map(navBtn); })()}
      <div className="side-foot">{role==='platform'?(data.markets.length+' ตลาดในเครือข่าย'):activeMarket.name}<br/>{role!=='platform'&&<>{MARKET_TYPES[activeMarket.mtype]} · PromptPay {activeMarket.promptpay}<br/></>}<a onClick={doReset} style={{cursor:'pointer',color:'#7ea299'}}>↺ รีเซ็ตข้อมูลสาธิต</a></div>
    </div>
    <div className="main">
      <div className="topbar">
        <div><h1>{(R.tabs.find(t=>t[0]===tab)||R.tabs[0])[1]}</h1><div className="sub">{role==='platform'?'ทุกตลาดในเครือข่าย':activeMarket.name} · รอบ {monthTH(P0)} · <span style={{color:R.color,fontWeight:600}}>{R.label}</span></div></div>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          {showSel && <select className="field" style={{maxWidth:230}} value={activeMarketId} onChange={e=>setActiveMarketId(e.target.value)}>{data.markets.map(m=><option key={m.id} value={m.id}>🏢 {m.name}</option>)}</select>}
          {role==='vendor' && <select className="field" style={{maxWidth:240}} value={vstall||''} onChange={e=>setVstall(e.target.value)}>{mstalls.filter(s=>s.status==='occupied').map(s=><option key={s.id} value={s.id}>{s.code} · {s.vendor}</option>)}{!mstalls.some(s=>s.status==='occupied')&&<option value="">— ยังไม่มีผู้เช่า —</option>}</select>}
        </div>
      </div>
      <div className="content">
        {role==='owner' && tab==='dash' && <OwnerDash data={sdata} go={setTab}/>}
        {role==='owner' && tab==='stalls' && <StallsView data={sdata} setData={setData}/>}
        {role==='owner' && tab==='daily' && <DailyView data={sdata} setData={setData}/>}
        {role==='owner' && tab==='billing' && <BillingView data={sdata} setData={setData}/>}
        {role==='owner' && tab==='wallet' && <WalletView data={sdata} setData={setData}/>}
        {role==='owner' && tab==='gp' && <GpView data={sdata}/>}
        {role==='owner' && tab==='settle' && <SettlementView data={sdata}/>}
        {role==='owner' && tab==='consign' && <ConsignView data={sdata} setData={setData}/>}
        {role==='owner' && tab==='sub' && <SubscribeView data={sdata} setData={setData}/>}
        {role==='owner' && tab==='acct' && <AccountingView data={sdata}/>}
        {role==='owner' && tab==='vat' && <VatView data={sdata}/>}
        {role==='owner' && tab==='reports' && <ReportsView data={sdata}/>}
        {role==='owner' && tab==='users' && <UsersView data={sdata} setData={setData}/>}
        {role==='owner' && tab==='info' && <MarketInfoView key={activeMarket.id} market={activeMarket} setData={setData}/>}
        {role==='owner' && tab==='bookcfg' && <SettingsView key={activeMarket.id} market={activeMarket} setData={setData}/>}
        {role==='vendor' && (vstall? <VendorView data={sdata} setData={setData} stallId={vstall}/> : <div className="empty">ตลาดนี้ยังไม่มีผู้เช่า — เพิ่มในมุมมองเจ้าของตลาด (โมดูลเช่าแผง)</div>)}
        {role==='platform' && tab==='plat' && <PlatformView data={data}/>}
        {role==='platform' && tab==='markets' && <MarketsAdmin data={data} setData={setData} onOpen={(mid)=>{setActiveMarketId(mid);setRole('owner');}}/>}
        {role==='platform' && tab==='control' && <MarketControlView data={data} setData={setData} onOpen={(mid,tb)=>{setActiveMarketId(mid);setRole('owner');if(tb){setTimeout(()=>setTab(tb),60);}}}/>}
      </div>
    </div>
  </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
