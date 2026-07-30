// fitness-app.jsx — Market OS · Vertical ฟิตเนส
// เอนจินเดียวกับโปรแกรมตลาด "เปลี่ยนเลนส์": เจ้าของฟิตเนส / เทรนเนอร์ / สมาชิก
const { useState, useEffect } = React;
const F = window.FIT;
const { B, pad, todayISO, isoAdd, daysTo, thDate, thTime, thDateTime, DOW, DOW_FULL, memberStatus, canEnter, PRICING, appFee } = F;
const qrSVG = window.MK.qrSVG;
const nfmt=(n)=>(Number(n)||0).toLocaleString('en-US');

/* ── shared ── */
function Kpi({label,value,foot,tone}){ return (<div className="card kpi"><div className="lbl">{label}</div>
  <div className="val" style={{color:tone||'var(--ink)'}}>{value}</div>{foot&&<div className="foot" style={{color:tone||'var(--ink-3)'}}>{foot}</div>}</div>); }
function Modal({title,tag,onClose,children,max}){ return (<div className="modal-bg" onClick={onClose}>
  <div className="modal" style={max?{maxWidth:max}:null} onClick={e=>e.stopPropagation()}>
    <div className="modal-h"><div><h3>{title}</h3>{tag&&<div style={{marginTop:6}}><span className="modtag">{tag}</span></div>}</div>
    <button className="x" onClick={onClose}>✕</button></div><div className="modal-b">{children}</div></div></div>); }
function BarList({rows,color,fmt}){ const max=Math.max(1,...rows.map(r=>r.v)); if(!rows.length)return <div className="empty" style={{padding:18}}>ไม่มีข้อมูล</div>;
  return rows.map((r,i)=>(<div className="barrow" key={i}><span className="bl">{r.k}</span>
    <span className="bartrack"><span className="barfill" style={{width:(r.v/max*100)+'%',background:color||'var(--brand)'}}/></span>
    <span className="bv num">{(fmt||B)(r.v)}</span></div>)); }
function Avatar({name,color}){ return <div className="fit-av" style={{background:color||'var(--brand-soft)',color:color?'#fff':'var(--brand-ink)'}}>{(name||'?').trim()[0]}</div>; }
function csv(name,rows){ const s=rows.map(r=>r.map(c=>{c=String(c==null?'':c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;}).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+s],{type:'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();a.remove(); }
const pkgOf=(data,id)=>data.packages.find(p=>p.id===id);
const trOf=(data,id)=>data.trainers.find(t=>t.id===id);
const mbOf=(data,id)=>data.members.find(m=>m.id===id);
const stPill=(m)=>{ const s=memberStatus(m); const extra = s.d!=null && s.key!=='none' ? (s.key==='expired'?(' '+Math.abs(s.d)+' วัน'):(s.d+' วัน')) : ''; return <span className={'pill '+s.cls}>{s.th}{extra&&' · '+extra.trim()}</span>; };
// รายได้เดือนนี้ (ต่ออายุ + PT + ขายของ)
function revThisMonth(data){ const m=todayISO().slice(0,7);
  const inMon=(ts)=> new Date(ts).toISOString().slice(0,7)===m;
  const ren=(data.renewals||[]).filter(x=>inMon(x.at));
  const pt=(data.ptBookings||[]).filter(x=>x.paid&&!x.voided&&(x.date||'').slice(0,7)===m);
  return { renew:ren.filter(x=>x.kind==='renew').reduce((a,b)=>a+b.amount,0),
    shop:ren.filter(x=>x.kind==='shop').reduce((a,b)=>a+b.amount,0),
    cls:ren.filter(x=>x.kind==='class').reduce((a,b)=>a+b.amount,0),
    pt:pt.reduce((a,b)=>a+b.amount,0) }; }

// วิเคราะห์แดชบอร์ด (ชั่วโมงพีค / retention-churn / เทรนเนอร์ / คลาส / ยอดค้างต่ออายุ)
function fitAnalytics(data){
  const {members,checkins,trainers,classes,ptBookings}=data;
  // peak check-in hours — เฉพาะเข้าได้ (ok) ทุกวันในข้อมูล
  const hrs={}; checkins.filter(c=>c.result==='ok').forEach(c=>{ const h=new Date(c.at).getHours(); hrs[h]=(hrs[h]||0)+1; });
  const openFrom=6, openTo=22; const hourRows=[]; for(let h=openFrom;h<=openTo;h++) hourRows.push({h,v:hrs[h]||0});
  const peak=hourRows.reduce((a,b)=>b.v>a.v?b:a,{h:openFrom,v:0});
  // retention / churn
  const cats={active:0,expiring:0,expired:0,frozen:0,none:0};
  members.forEach(m=>{ cats[memberStatus(m).key]=(cats[memberStatus(m).key]||0)+1; });
  const paying=cats.active+cats.expiring+cats.expired; // เคยมีแพ็ก/ยังผูกพัน
  const churnRate = paying? Math.round(cats.expired/paying*100) : 0;
  const retention = 100-churnRate;
  // เทรนเนอร์ทำเงินสูงสุด (PT เดือนนี้)
  const mon=todayISO().slice(0,7);
  const trRev=trainers.map(t=>({k:t.name.replace('โค้ช',''),id:t.id,
    v:ptBookings.filter(b=>b.trainerId===t.id&&b.paid&&b.date.slice(0,7)===mon).reduce((a,b)=>a+b.amount,0)}))
    .sort((a,b)=>b.v-a.v);
  // คลาสยอดนิยม (อัตราจอง)
  const clRows=classes.map(c=>({k:c.name,booked:c.booked.length,cap:c.cap,v:c.cap?Math.round(c.booked.length/c.cap*100):0}))
    .sort((a,b)=>b.v-a.v);
  // ยอดค้างต่ออายุ — มูลค่าแพ็กของสมาชิกที่หมด/ใกล้หมด (โอกาสรายได้ที่รอเก็บ)
  const dueMembers=members.filter(m=>['expiring','expired'].includes(memberStatus(m).key))
    .map(m=>({m,pk:pkgOf(data,m.packageId),s:memberStatus(m)}))
    .sort((a,b)=>(a.s.d??0)-(b.s.d??0));
  const dueValue=dueMembers.reduce((a,x)=>a+((x.pk&&x.pk.price)||0),0);
  const overdueValue=dueMembers.filter(x=>x.s.key==='expired').reduce((a,x)=>a+((x.pk&&x.pk.price)||0),0);
  return { hourRows,peak, cats,paying,churnRate,retention, trRev, clRows, dueMembers,dueValue,overdueValue };
}
function HourChart({rows,peak}){ const max=Math.max(1,...rows.map(r=>r.v));
  return (<div className="hourchart">{rows.map(r=>(<div key={r.h} className="hc-col" title={pad(r.h)+':00 · '+r.v+' ครั้ง'}>
    <div className="hc-barwrap"><div className={'hc-bar'+(r.h===peak.h&&peak.v>0?' pk':'')} style={{height:Math.max(3,r.v/max*100)+'%'}}/></div>
    <div className="hc-lb">{r.h%2===0?pad(r.h):''}</div></div>))}</div>); }

/* ════ OWNER · ภาพรวม ════ */
function FitDash({data,go}){
  const {gym,members,classes,checkins}=data;
  const an=fitAnalytics(data);
  const active=members.filter(m=>['active','expiring'].includes(memberStatus(m).key));
  const expiring=members.filter(m=>memberStatus(m).key==='expiring').sort((a,b)=>daysTo(a.expiry)-daysTo(b.expiry));
  const expired=members.filter(m=>memberStatus(m).key==='expired');
  const todayCk=checkins.filter(c=>new Date(c.at).toDateString()===new Date().toDateString());
  const rev=revThisMonth(data); const total=rev.renew+rev.pt+rev.shop+(rev.cls||0);
  const capSum=classes.reduce((a,c)=>a+c.cap,0), bookSum=classes.reduce((a,c)=>a+c.booked.length,0);
  const feed=[...checkins].sort((a,b)=>b.at-a.at).slice(0,7);
  const newThis=members.filter(m=>m.joinedAt&&m.joinedAt.slice(0,7)===todayISO().slice(0,7)).length;
  return (<div className="fade">
    <div className="kpis">
      <Kpi label="สมาชิกใช้งานได้" value={active.length+'/'+members.length} foot={'สมัครใหม่เดือนนี้ '+newThis+' คน'} tone="var(--brand-ink)"/>
      <Kpi label="ใกล้หมดอายุ (≤7 วัน)" value={expiring.length+' คน'} foot={expired.length+' คนหมดอายุแล้ว'} tone={expiring.length?'var(--yellow)':'var(--ink)'}/>
      <Kpi label="เช็คอินวันนี้" value={todayCk.filter(c=>c.result==='ok').length+' ครั้ง'} foot={'ปฏิเสธ '+todayCk.filter(c=>c.result==='denied').length+' · ผ่านประตู NFC/QR'} tone="var(--blue-ink)"/>
      <Kpi label="รายได้เดือนนี้" value={B(total)} foot={'ต่ออายุ '+B(rev.renew)+' · PT '+B(rev.pt)+' · ขายของ '+B(rev.shop)+(rev.cls?' · คลาส '+B(rev.cls):'')} tone="var(--green)"/>
      <Kpi label="อัตราจองคลาส" value={(capSum?Math.round(bookSum/capSum*100):0)+'%'} foot={bookSum+'/'+capSum+' ที่นั่ง · '+classes.length+' คลาส/สัปดาห์'}/>
      <Kpi label="ยอดค้างต่ออายุ" value={B(an.dueValue)} foot={an.dueMembers.length+' คนรอต่อ · เกินกำหนด '+B(an.overdueValue)} tone={an.overdueValue?'var(--danger)':'var(--gold)'}/>
    </div>
    <div className="grid2">
      <div className="card panel">
        <h3>ใกล้หมดอายุ — ส่งเตือนต่ออายุ<span className="r-lnk" style={{cursor:'pointer'}} onClick={()=>go('members')}>ดูสมาชิกทั้งหมด →</span></h3>
        {expiring.length||expired.length? <div className="feed">
          {[...expiring,...expired].slice(0,7).map(m=>{ const pk=pkgOf(data,m.packageId); const s=memberStatus(m); return (
            <div className="feeditem" key={m.id}><Avatar name={m.name}/>
              <div className="fi-b"><div className="fi-t">{m.name} <span style={{color:'var(--ink-3)',fontWeight:500}}>· {m.code}</span></div>
                <div className="fi-s">{pk?pk.name:'—'} · {s.key==='expired'?('หมดอายุ '+Math.abs(s.d)+' วันแล้ว'):('เหลือ '+s.d+' วัน')} · {m.line?'LINE OA':'SMS'}</div></div>
              {stPill(m)}</div>); })}
        </div> : <div className="empty">ไม่มีสมาชิกใกล้หมดอายุ 🎉</div>}
      </div>
      <div className="card panel">
        <h3>เช็คอินล่าสุด <span className="sub" style={{fontWeight:500}}>ผ่านประตู</span></h3>
        <div className="feed">{feed.map(c=>{ const m=mbOf(data,c.memberId); const ok=c.result==='ok'; return (
          <div className="feeditem" key={c.id}><div className="fi-ic" style={{background:ok?'var(--green-soft)':'var(--red-soft)',color:ok?'var(--green)':'var(--red)'}}>{ok?'✓':'✕'}</div>
            <div className="fi-b"><div className="fi-t">{m?m.name:'—'}</div><div className="fi-s">{c.method==='nfc'?'แตะ NFC':'สแกน QR'} · {thTime(c.at)}{!ok&&' · แพ็กหมดอายุ'}</div></div>
            <div className="fi-v" style={{color:ok?'var(--green)':'var(--red)'}}>{ok?'เข้าได้':'ปฏิเสธ'}</div></div>); })}</div>
      </div>
    </div>
    <div className="card panel">
      <h3>สรุปแพ็กเกจสมาชิก</h3>
      <BarList fmt={nfmt} rows={data.packages.filter(p=>p.kind!=='daypass').map(p=>({k:p.name,v:members.filter(m=>m.packageId===p.id).length})).filter(r=>r.v)}/>
      <div className="note g" style={{marginTop:14}}>🔁 <b>Backoffice ฟิตเนส = เอนจินเดียวกับร้านค้า/ตลาด</b> — บิลค่าเช่า→ค่าสมาชิก · Overdue lock→ตัดสิทธิ์เข้าประตู · LINE OA→เตือนต่ออายุ · ใช้ซ้ำ ~80% ของระบบตลาด</div>
    </div>

    <div className="secttl">วิเคราะห์เชิงลึก <span>สำหรับเจ้าของ</span></div>
    <div className="grid2">
      <div className="card panel">
        <h3>ช่วงเวลาคนเข้าพีค <span className="sub" style={{fontWeight:500}}>· พีค {pad(an.peak.h)}:00{an.peak.v?' ('+an.peak.v+' ครั้ง)':''}</span></h3>
        <HourChart rows={an.hourRows} peak={an.peak}/>
        <div className="sub" style={{marginTop:10}}>จัดคนเทรนเนอร์/คลาสให้ตรงช่วงคนแน่น · เสริมโปรช่วงนอกพีค</div>
      </div>
      <div className="card panel">
        <h3>Retention / Churn <span className="sub" style={{fontWeight:500}}>· ฐานสมาชิกที่เคยมีแพ็ก</span></h3>
        <div className="retain-hero">
          <div className="rt-ring" style={{background:'conic-gradient(var(--green) '+an.retention*3.6+'deg,var(--red-soft) 0)'}}><div className="rt-in"><b>{an.retention}%</b><span>คงอยู่</span></div></div>
          <div className="rt-stats">
            <div className="rt-row"><span className="dot" style={{background:'var(--green)'}}/>ยังใช้งาน <b>{an.cats.active+an.cats.expiring} คน</b></div>
            <div className="rt-row"><span className="dot" style={{background:'var(--red)'}}/>หมดไม่ต่อ (churn) <b>{an.cats.expired} คน</b></div>
            <div className="rt-row"><span className="dot" style={{background:'var(--blue)'}}/>พักชั่วคราว (freeze) <b>{an.cats.frozen} คน</b></div>
            <div className="rt-churn">Churn rate <b style={{color:an.churnRate>25?'var(--red)':'var(--gold)'}}>{an.churnRate}%</b> · โอกาสดึงกลับ {B(an.dueValue)}</div>
          </div>
        </div>
      </div>
    </div>
    <div className="grid2">
      <div className="card panel">
        <h3>เทรนเนอร์ทำเงินสูงสุด <span className="sub" style={{fontWeight:500}}>· PT เดือนนี้<span className="r-lnk" style={{cursor:'pointer'}} onClick={()=>go('trainers')}>ดูเทรนเนอร์ →</span></span></h3>
        {an.trRev.some(r=>r.v)? <BarList rows={an.trRev.filter(r=>r.v)}/> : <div className="empty">ยังไม่มีรายได้ PT เดือนนี้</div>}
      </div>
      <div className="card panel">
        <h3>คลาสยอดนิยม <span className="sub" style={{fontWeight:500}}>· อัตราการจอง<span className="r-lnk" style={{cursor:'pointer'}} onClick={()=>go('classes')}>จัดคลาส →</span></span></h3>
        {an.clRows.map((c,i)=>(<div className="barrow" key={i}><span className="bl">{c.k}</span>
          <span className="bartrack"><span className="barfill" style={{width:c.v+'%',background:c.v>=85?'var(--danger)':'var(--brand)'}}/></span>
          <span className="bv num">{c.booked}/{c.cap}</span></div>))}
      </div>
    </div>
    <div className="card panel">
      <h3>ยอดค้างต่ออายุ — โอกาสรายได้ที่รอเก็บ <span className="sub" style={{fontWeight:500}}>· รวม {B(an.dueValue)} · {an.dueMembers.length} คน</span><span className="r-lnk" style={{cursor:'pointer'}} onClick={()=>go('members')}>ส่งเตือนต่ออายุ →</span></h3>
      {an.dueMembers.length? <div className="card" style={{overflow:'hidden',border:'none'}}>
        <table><thead><tr><th>สมาชิก</th><th>แพ็กที่รอต่อ</th><th className="c">สถานะ</th><th className="r">มูลค่าแพ็ก</th><th className="c">ช่องเตือน</th></tr></thead>
          <tbody>{an.dueMembers.slice(0,8).map(({m,pk,s})=>(<tr key={m.id}>
            <td><div style={{display:'flex',alignItems:'center',gap:10}}><Avatar name={m.name}/><div><div style={{fontWeight:600}}>{m.name}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>{m.code}</div></div></div></td>
            <td>{pk?pk.name:'—'}</td><td className="c">{stPill(m)}</td>
            <td className="r num" style={{fontWeight:700}}>{B((pk&&pk.price)||0)}</td>
            <td className="c"><span className="pill p-n">{m.line?'LINE OA':'SMS'}</span></td></tr>))}</tbody></table>
      </div> : <div className="empty">ไม่มียอดค้างต่ออายุ 🎉</div>}
    </div>
  </div>);
}

/* ════ OWNER · สมาชิก & ต่ออายุ ════ */
function MembersView({data,setData}){
  const {members}=data; const [sel,setSel]=useState(null); const [f,setF]=useState('all'); const [q,setQ]=useState(''); const [add,setAdd]=useState(false);
  const counts={ all:members.length, active:0, expiring:0, expired:0, frozen:0 };
  members.forEach(m=>{ counts[memberStatus(m).key]=(counts[memberStatus(m).key]||0)+1; });
  let rows=members.filter(m=> f==='all'||memberStatus(m).key===f);
  if(q) rows=rows.filter(m=>(m.name+m.code+m.phone).toLowerCase().includes(q.toLowerCase()));
  return (<div className="fade">
    <div className="toolbar">
      <div className="seg">{[['all','ทั้งหมด'],['active','ใช้งานได้'],['expiring','ใกล้หมด'],['expired','หมดอายุ'],['frozen','พัก']].map(([k,l])=>
        <button key={k} className={f===k?'on':''} onClick={()=>setF(k)}>{l}{counts[k]?' '+counts[k]:''}</button>)}</div>
      <input className="field grow" style={{maxWidth:240}} placeholder="ค้นหาชื่อ/รหัส/เบอร์" value={q} onChange={e=>setQ(e.target.value)}/>
      <button className="btn gh sm" onClick={()=>csv('members.csv',[['รหัส','ชื่อ','เบอร์','แพ็ก','เริ่ม','หมดอายุ','สถานะ','ยอดสะสม'],...members.map(m=>[m.code,m.name,m.phone,(pkgOf(data,m.packageId)||{}).name||'',m.start,m.expiry||'',memberStatus(m).th,m.spend])])}>CSV</button>
      <button className="btn pri" onClick={()=>setAdd(true)}>+ เพิ่มสมาชิก</button>
    </div>
    <div className="card" style={{overflow:'hidden'}}>
      <table><thead><tr><th>สมาชิก</th><th>แพ็กเกจ</th><th>เริ่ม → หมดอายุ</th><th className="c">สถานะ</th><th className="r">ยอดสะสม</th><th></th></tr></thead>
        <tbody>{rows.map(m=>{ const pk=pkgOf(data,m.packageId); return (<tr className="row" key={m.id} onClick={()=>setSel(m.id)}>
          <td><div style={{display:'flex',alignItems:'center',gap:10}}><Avatar name={m.name}/><div><div style={{fontWeight:600}}>{m.name}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>{m.code} · {m.phone} {m.line&&<span className="pill p-g" style={{padding:'1px 6px',fontSize:10}}>LINE</span>}</div></div></div></td>
          <td>{pk?pk.name:'—'}</td>
          <td style={{fontSize:12.5}}>{thDate(m.start)} <span style={{color:'var(--ink-3)'}}>→</span> {m.expiry?thDate(m.expiry):'ตามเซสชัน'}</td>
          <td className="c">{stPill(m)}</td>
          <td className="r num" style={{fontWeight:600}}>{B(m.spend)}</td>
          <td className="r"><button className="btn gh sm" onClick={e=>{e.stopPropagation();setSel(m.id);}}>จัดการ</button></td>
        </tr>); })}</tbody></table>
      {!rows.length&&<div className="empty">ไม่พบสมาชิก</div>}
    </div>
    {sel&&<MemberModal data={data} setData={setData} id={sel} onClose={()=>setSel(null)}/>}
    {add&&<AddMemberModal data={data} setData={setData} onClose={()=>setAdd(false)}/>}
  </div>);
}
function AddMemberModal({data,setData,onClose}){
  const [f,setF]=useState({name:'',phone:'',packageId:'pk-m1',line:true}); const set=(k,v)=>setF({...f,[k]:v});
  const save=()=>{ setData(d=>{ const pk=pkgOf(d,f.packageId); const n=d.members.length+1; const nid='mb-'+Date.now().toString(36);
    d.members.push({ id:nid, code:'M'+pad(n), name:f.name, phone:f.phone, line:f.line,
      packageId:f.packageId, start:todayISO(), expiry: pk.months?isoAdd(todayISO(),pk.months*30):null, joinedAt:todayISO(),
      frozen:false, parq:false, consent:false, ptLeft:pk.kind==='sessions'?pk.sessions:0, spend:pk.price||0, bodyBefore:null, bodyAfter:null });
    if(pk.price) d.renewals.push({id:'rv-'+Date.now().toString(36),memberId:nid,packageId:f.packageId,at:Date.now(),amount:pk.price,via:'counter',kind:'renew'});
    return {...d}; }); onClose(); };
  return (<Modal title="เพิ่มสมาชิกใหม่" tag="ทะเบียนสมาชิก" onClose={onClose} max={480}>
    <label className="lb">ชื่อ-นามสกุล</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)}/>
    <label className="lb">เบอร์โทร (ใช้ผูกตัวตน ไม่ต้องมี LINE ก็ได้)</label><input className="field" value={f.phone} onChange={e=>set('phone',e.target.value)}/>
    <label className="lb">แพ็กเกจ</label>
    <div style={{display:'grid',gap:8}}>{data.packages.filter(p=>p.kind!=='daypass').map(p=>(<button key={p.id} onClick={()=>set('packageId',p.id)} style={{textAlign:'left',cursor:'pointer',border:'2px solid '+(f.packageId===p.id?'var(--brand)':'var(--hair-2)'),background:f.packageId===p.id?'var(--brand-softer)':'#fff',borderRadius:12,padding:'11px 14px'}}>
      <div style={{display:'flex',justifyContent:'space-between'}}><b>{p.name}</b><b className="num">{B(p.price)}</b></div><div style={{fontSize:12,color:'var(--ink-3)',marginTop:2}}>{p.desc}</div></button>))}</div>
    <label className="chkline" style={{marginTop:14}}><input type="checkbox" checked={f.line} onChange={e=>set('line',e.target.checked)}/> เชื่อม LINE OA (เตือนต่ออายุอัตโนมัติ)</label>
    <button className="btn pri" style={{marginTop:18,width:'100%'}} disabled={!f.name} onClick={save}>บันทึก + เปิดใช้งาน</button>
  </Modal>);
}
function MemberModal({data,setData,id,onClose}){
  const m=mbOf(data,id); const pk=pkgOf(data,m.packageId); const s=memberStatus(m); const [tab,setTab]=useState('info'); const [renewPk,setRenewPk]=useState(m.packageId);
  const myPt=(data.ptBookings||[]).filter(b=>b.memberId===id);
  const doRenew=()=>{ setData(d=>{ const mm=mbOf(d,id); const p=pkgOf(d,renewPk); const from = (mm.expiry&&daysTo(mm.expiry)>0)?mm.expiry:todayISO();
    mm.packageId=renewPk; if(p.months){ mm.expiry=isoAdd(from,p.months*30); } if(p.kind==='sessions'){ mm.ptLeft=(mm.ptLeft||0)+p.sessions; }
    mm.frozen=false; mm.spend+=p.price||0; d.renewals.push({id:'rv-'+Date.now().toString(36),memberId:id,packageId:renewPk,at:Date.now(),amount:p.price,via:'counter',kind:'renew'}); return {...d}; }); onClose(); };
  const freeze=()=>setData(d=>{ mbOf(d,id).frozen=!mbOf(d,id).frozen; return {...d}; });
  const remind=()=> alert((m.line?'ส่ง LINE OA ':'ส่ง SMS ')+'เตือนต่ออายุถึง '+m.name+' ('+m.phone+')\n\n"แพ็ก'+(pk?pk.name:'')+'ของคุณ'+(s.key==='expired'?'หมดอายุแล้ว':'ใกล้หมดใน '+s.d+' วัน')+' — ต่ออายุในแอปได้เลย"');
  return (<Modal title={m.name} tag={m.code+' · '+(m.line?'LINE OA':'ผูกเบอร์ '+m.phone)} onClose={onClose} max={620}>
    <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:8,flexWrap:'wrap'}}>{stPill(m)}<span className="pill p-n">{pk?pk.name:'—'}</span>
      {m.expiry&&<span className="sub">หมดอายุ {thDate(m.expiry)}{s.key!=='expired'&&s.d!=null?' · เหลือ '+s.d+' วัน':''}</span>}</div>
    <div className="seg" style={{marginBottom:16}}>{[['info','ต่ออายุ'],['pt','PT & จอง'],['health','ฟอร์มสุขภาพ']].map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}</div>
    {tab==='info'&&<div>
      <label className="lb">เลือกแพ็ก/ต่ออายุ (ซื้อ/ต่อผ่านแอปได้เอง — mobile order)</label>
      <div style={{display:'grid',gap:8}}>{data.packages.map(p=>(<button key={p.id} onClick={()=>setRenewPk(p.id)} style={{textAlign:'left',cursor:'pointer',border:'2px solid '+(renewPk===p.id?'var(--brand)':'var(--hair-2)'),background:renewPk===p.id?'var(--brand-softer)':'#fff',borderRadius:12,padding:'10px 13px'}}>
        <div style={{display:'flex',justifyContent:'space-between'}}><b>{p.name}{p.pop&&<span className="pill p-y" style={{marginLeft:8,fontSize:10,padding:'1px 7px'}}>ยอดนิยม</span>}</b><b className="num">{B(p.price)}</b></div><div style={{fontSize:12,color:'var(--ink-3)',marginTop:2}}>{p.desc}</div></button>))}</div>
      <div style={{display:'flex',gap:8,marginTop:16,flexWrap:'wrap'}}>
        <button className="btn pri" onClick={doRenew}>ต่ออายุ / เปลี่ยนแพ็ก</button>
        <button className="btn gh" onClick={remind}>{m.line?'ส่งเตือน LINE OA':'ส่งเตือน SMS'}</button>
        <button className="btn gh" onClick={freeze}>{m.frozen?'ยกเลิกพัก':'พักชั่วคราว (freeze)'}</button>
      </div>
      {pk&&pk.kind==='sessions'&&<div className="note blue" style={{marginTop:14}}>🏋️ PT คงเหลือ <b>{m.ptLeft} เซสชัน</b> — ซื้อแพ็กไว้ก่อนแล้วนัดวันทีหลังได้</div>}
    </div>}
    {tab==='pt'&&<div>
      <div className="note blue" style={{marginBottom:12}}>จองคิวเทรนเนอร์ + จ่ายในแอปได้เลย (ต่อครั้ง) หรือใช้เซสชันจากแพ็ก PT ที่ซื้อไว้</div>
      {myPt.length? myPt.map(b=>{ const t=trOf(data,b.trainerId); return (<div key={b.id} className="fit-line">
        <div><b>{t?t.name:'—'}</b><div className="sub">{thDate(b.date)} · {b.time} · {b.kind==='package'?'ใช้เซสชันแพ็ก':'จ่ายต่อครั้ง '+B(b.amount)}</div></div>
        <span className={'pill '+(b.status==='confirmed'?'p-g':'p-y')}>{b.status==='confirmed'?'ยืนยันแล้ว':'รอชำระ'}</span></div>); })
        : <div className="empty">ยังไม่มีนัดกับเทรนเนอร์</div>}
      <div className="sub" style={{marginTop:12}}>* สมาชิก↔เทรนเนอร์นัด/ปรับตารางร่วมกันได้ในแอป</div>
    </div>}
    {tab==='health'&&<HealthPanel data={data} setData={setData} id={id}/>}
  </Modal>);
}

/* ════ OWNER · เช็คอินหน้าประตู ════ */
function CheckinView({data,setData}){
  const {members,checkins,gym}=data; const [pick,setPick]=useState(''); const [result,setResult]=useState(null); const [method,setMethod]=useState('nfc');
  const today=checkins.filter(c=>new Date(c.at).toDateString()===new Date().toDateString()).sort((a,b)=>b.at-a.at);
  const doCheck=(mid)=>{ const m=mbOf(data,mid); if(!m)return; const ok=canEnter(m); const res={m,ok,method,s:memberStatus(m)}; setResult(res);
    setData(d=>{ d.checkins.push({id:'ck-'+Date.now().toString(36),memberId:mid,at:Date.now(),method,result:ok?'ok':'denied'}); return {...d}; }); };
  const active=members.filter(m=>['active','expiring'].includes(memberStatus(m).key)).slice(0,6);
  const expired=members.filter(m=>memberStatus(m).key==='expired')[0];
  return (<div className="fade"><div className="grid2">
    <div className="card panel">
      <h3>จำลองเช็คอินหน้าประตู</h3>
      <div className="seg" style={{marginBottom:14}}>{[['nfc','แตะ NFC'],['qr','สแกน QR']].map(([k,l])=><button key={k} className={method===k?'on':''} onClick={()=>setMethod(k)}>{l}</button>)}</div>
      {result? <div className={'checkres '+(result.ok?'ok':'no')}>
        <div className="cr-ic">{result.ok?'✓':'✕'}</div>
        <div className="cr-nm">{result.m.name}</div>
        <div className="cr-st">{result.ok? 'เข้าได้ · '+(pkgOf(data,result.m.packageId)||{}).name : 'ปฏิเสธ · แพ็กหมดอายุ '+Math.abs(result.s.d)+' วัน'}</div>
        {!result.ok&&<div className="cr-cta">แจ้งสมาชิก: ต่ออายุจ่ายในแอปได้เลย →</div>}
        <button className="btn gh sm" style={{marginTop:14}} onClick={()=>{setResult(null);setPick('');}}>แตะคนถัดไป</button>
      </div> : <div style={{textAlign:'center',padding:'10px 0 4px'}}>
        <div className="nfc-badge">{method==='nfc'?'📶':'▦'}</div>
        <div className="sub" style={{marginBottom:14}}>{method==='nfc'?'สติกเกอร์ NFC แปะที่หน้าประตูฟิตเนส (ไม่ใช่มือถือลูกค้า) — แตะเพื่อจำลอง':'ลูกค้าสแกน QR ที่ประตู — เลือกเพื่อจำลอง'}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {active.map(m=><button key={m.id} className="btn gh sm" onClick={()=>doCheck(m.id)}>🟢 {m.name.split(' ')[0]} ({m.code})</button>)}
          {expired&&<button className="btn dngh sm" onClick={()=>doCheck(expired.id)}>🔴 {expired.name.split(' ')[0]} (หมดอายุ)</button>}
        </div>
        <select className="field" style={{marginTop:12}} value={pick} onChange={e=>{ setPick(e.target.value); if(e.target.value)doCheck(e.target.value); }}>
          <option value="">— หรือค้นสมาชิกโดยพนักงาน —</option>{members.map(m=><option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select>
      </div>}
    </div>
    <div className="card panel">
      <h3>บันทึกเข้าวันนี้ <span className="sub" style={{fontWeight:500}}>· {today.length} ครั้ง</span></h3>
      <div className="feed" style={{maxHeight:340,overflow:'auto'}}>{today.map(c=>{ const m=mbOf(data,c.memberId); const ok=c.result==='ok'; return (
        <div className="feeditem" key={c.id}><div className="fi-ic" style={{background:ok?'var(--green-soft)':'var(--red-soft)',color:ok?'var(--green)':'var(--red)'}}>{ok?'✓':'✕'}</div>
          <div className="fi-b"><div className="fi-t">{m?m.name:'—'}</div><div className="fi-s">{c.method==='nfc'?'แตะ NFC':'สแกน QR'} · {thTime(c.at)}</div></div>
          <div className="fi-v" style={{color:ok?'var(--green)':'var(--red)'}}>{ok?'เข้าได้':'ปฏิเสธ'}</div></div>); })}
        {!today.length&&<div className="empty">ยังไม่มีการเข้าวันนี้</div>}</div>
    </div>
  </div>
  <div className="grid2b">
    <div className="card panel"><h3>อุปกรณ์ที่ใช้</h3>
      <div className="kv"><span className="k">สติกเกอร์ NFC</span><span className="v">แปะที่ประตูฟิตเนส (ไม่ใช่มือถือลูกค้า)</span></div>
      <div className="kv"><span className="k">ไม่ต้องซื้อเครื่องสแกน</span><span className="v">ลูกค้าใช้มือถือตัวเองแตะ</span></div>
      <div className="kv"><span className="k">ถ้าไม่มี NFC</span><span className="v">QR ที่ประตู · พนักงานค้นชื่อ · GPS</span></div>
      <div className="kv"><span className="k">รองรับ</span><span className="v">{gym.lineOA?'มี LINE OA + ':''}ลิงก์เว็บ + SMS ผูกเบอร์</span></div>
    </div>
    <div className="card panel" style={{background:'var(--sidebar)',border:'none'}}>
      <h3 style={{color:'#fff'}}>4 ขั้นตอนหน้าประตู</h3>
      {[['1','แตะ NFC / สแกน QR'],['2','ดึงสถานะสมาชิกอัตโนมัติ'],['3','เขียว = เข้าได้ · แดง = ต่ออายุจ่ายในแอป'],['4','บันทึก + นับเข้า Backoffice']].map(s=>
        <div key={s[0]} style={{display:'flex',gap:12,alignItems:'center',padding:'8px 0',color:'#cfe6df',fontSize:14}}><span className="stepn">{s[0]}</span>{s[1]}</div>)}
    </div>
  </div></div>);
}

/* ════ OWNER · คลาส & ตาราง ════ */
function ClassPoster({data}){
  const {classes,gym}=data; const byDay={}; classes.forEach(c=>{ (byDay[c.day]=byDay[c.day]||[]).push(c); });
  return (<div className="fit-poster">
    <div className="fit-poster-top"><div className="pt-k">Class Schedule</div><div className="pt-t">{gym.name}</div><div className="pt-s">ตารางคลาสกรุ๊ป · เปิด {gym.openHour}</div></div>
    <div className="fit-poster-grid">{[1,2,3,4,5,6,0].map(dw=>(<div key={dw} className="fit-poster-day">
      <div className="pd-d">{DOW_FULL[dw]}</div>
      <div className="fit-poster-chips">{(byDay[dw]||[]).sort((a,b)=>a.time.localeCompare(b.time)).map(c=>{ const t=trOf(data,c.trainerId); return (
        <div key={c.id} className="fit-poster-chip"><span className="pc-tm">{c.time}</span><span style={{flex:1}}><b>{c.name}</b> · {t?t.name:''}</span><span className="pc-fee">{c.fee?B(c.fee):'ฟรี'}</span></div>); })}
        {!(byDay[dw]||[]).length&&<div className="fit-poster-empty">— พัก —</div>}</div>
    </div>))}</div>
    <div className="fit-poster-foot">จองคลาสในแอปสมาชิก · {gym.name} · {gym.phone}</div>
  </div>);
}
function ClassesView({data,setData}){
  const {classes,members}=data; const [sel,setSel]=useState(null);
  const [mode,setMode]=useState('edit'); const [psrc,setPsrc]=useState('auto');
  const byDay={}; classes.forEach(c=>{ (byDay[c.day]=byDay[c.day]||[]).push(c); });
  return (<div className="fade">
    <div className="toolbar">
      <div className="seg">{[['edit','คีย์ข้อมูล (จองได้)'],['poster','รูปโชว์ / โปสเตอร์']].map(([k,l])=><button key={k} className={mode===k?'on':''} onClick={()=>setMode(k)}>{l}</button>)}</div>
      <div className="grow"/>
      {mode==='poster'&&<div className="seg">{[['auto','โปสเตอร์อัตโนมัติ'],['upload','อัปโหลดรูปเอง']].map(([k,l])=><button key={k} className={psrc===k?'on':''} onClick={()=>setPsrc(k)}>{l}</button>)}</div>}
    </div>
    {mode==='edit'? <>
      <div className="note g" style={{marginBottom:16}}>คลาสกรุ๊ป (ไม่บังคับ) — ฟรีหรือมีค่าธรรมเนียม · <b>สมาชิกจองในแอป → ชื่อเข้าคลาสนี้ทันที</b> · โผล่ในตารางเทรนเนอร์ผู้สอน · แยกจากคิว PT ตัวต่อตัว</div>
      <div className="fit-week">{[1,2,3,4,5,6,0].map(dw=>(<div key={dw} className="fit-day">
        <div className="fit-day-h">{DOW_FULL[dw]}</div>
        {(byDay[dw]||[]).sort((a,b)=>a.time.localeCompare(b.time)).map(c=>{ const t=trOf(data,c.trainerId); const full=c.booked.length>=c.cap; return (
          <button key={c.id} className="fit-cls" onClick={()=>setSel(c.id)}>
            <div className="fc-t">{c.time} · {c.name}</div>
            <div className="fc-s">{t?t.name:'—'} · {c.dur}น. {c.fee?'· '+B(c.fee):'· ฟรี'}</div>
            <div className="fc-bar"><span style={{width:Math.min(100,c.booked.length/c.cap*100)+'%',background:full?'var(--red)':'var(--brand)'}}/></div>
            <div className="fc-cap">{c.booked.length}/{c.cap} {full&&<b style={{color:'var(--red)'}}>เต็ม</b>}</div>
          </button>); })}
        {!(byDay[dw]||[]).length&&<div className="fit-noclass">—</div>}
      </div>))}</div>
    </> : <>
      <div className="note g" style={{marginBottom:16}}>{psrc==='auto'?'โปสเตอร์สร้างจากตารางคลาสอัตโนมัติ — โชว์บนจอ/แชร์ให้สมาชิก':'ร้านที่มีโปสเตอร์ตารางเองอยู่แล้ว วาง/อัปโหลดรูปมาโชว์ได้เลย (ลากรูปวาง หรือคลิกเลือกไฟล์)'}</div>
      {psrc==='auto'? <ClassPoster data={data}/> : <div className="fit-slotwrap"><image-slot id="fit-class-poster" shape="rect" placeholder="วางรูปตารางคลาสที่ร้านทำไว้ที่นี่"></image-slot></div>}
    </>}
    {sel&&(()=>{ const c=classes.find(x=>x.id===sel); const t=trOf(data,c.trainerId);
      const toggle=(mid)=>setData(d=>{ const cc=d.classes.find(x=>x.id===sel); cc.booked=cc.booked.includes(mid)?cc.booked.filter(x=>x!==mid):(cc.booked.length<cc.cap?[...cc.booked,mid]:cc.booked); return {...d}; });
      return (<Modal title={c.name} tag={DOW_FULL[c.day]+' '+c.time+' · '+(t?t.name:'')} onClose={()=>setSel(null)} max={560}>
        <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}><span className="pill p-b">{c.dur} นาที</span><span className="pill p-n">{c.fee?'ค่าธรรมเนียม '+B(c.fee):'ฟรี (รวมในแพ็ก)'}</span><span className={'pill '+(c.booked.length>=c.cap?'p-r':'p-g')}>{c.booked.length}/{c.cap} ที่นั่ง</span></div>
        <label className="lb">ผู้จองคลาส (แตะเพื่อเพิ่ม/ถอด)</label>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,maxHeight:320,overflow:'auto'}}>
          {members.filter(m=>canEnter(m)).map(m=>{ const on=c.booked.includes(m.id); return (
            <button key={m.id} onClick={()=>toggle(m.id)} style={{textAlign:'left',cursor:'pointer',border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'),background:on?'var(--brand-softer)':'#fff',borderRadius:10,padding:'8px 11px',fontSize:13,fontWeight:600}}>
              {on?'✓ ':''}{m.name} <span style={{color:'var(--ink-3)',fontWeight:500}}>· {m.code}</span></button>); })}
        </div>
      </Modal>); })()}
  </div>);
}

/* ════ OWNER · เทรนเนอร์ PT ════ */
function TrainersView({data,setData}){
  const {trainers,ptBookings}=data; const [sel,setSel]=useState(null);
  const revOf=(tid)=>ptBookings.filter(b=>b.trainerId===tid&&b.paid).reduce((a,b)=>a+b.amount,0);
  const cntOf=(tid)=>ptBookings.filter(b=>b.trainerId===tid).length;
  return (<div className="fade">
    <div className="note g" style={{marginBottom:16}}>โปรไฟล์ + ตาราง + เรต + รีวิว + รายได้ · สมาชิกจองคิว+จ่ายในแอป (ต่อครั้ง หรือใช้เซสชันจากแพ็ก PT)</div>
    <div className="fit-trgrid">{trainers.map(t=>(
      <div key={t.id} className="card fit-trcard" onClick={()=>setSel(t.id)}>
        <div style={{display:'flex',gap:12,alignItems:'center'}}><Avatar name={t.name} color="var(--brand)"/>
          <div><div style={{fontWeight:700,fontSize:15}}>{t.name}</div><div className="sub">{t.specialty}</div></div></div>
        <div className="fit-trstat"><div><b>⭐ {t.rating}</b><span>{t.reviews} รีวิว</span></div><div><b>{B(t.rate)}</b><span>ต่อเซสชัน</span></div><div><b>{cntOf(t.id)}</b><span>คิว</span></div></div>
        <div className="fit-trrev">รายได้เดือนนี้ <b>{B(revOf(t.id))}</b></div>
      </div>))}</div>
    <div className="card panel" style={{marginTop:18}}>
      <h3>คิวจองเทรนเนอร์ (PT) — เร็ว ๆ นี้</h3>
      <div className="card" style={{overflow:'hidden',border:'none'}}><table><thead><tr><th>สมาชิก</th><th>เทรนเนอร์</th><th>วัน/เวลา</th><th>รูปแบบ</th><th className="c">สถานะ</th></tr></thead>
        <tbody>{[...ptBookings].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(b=>{ const m=mbOf(data,b.memberId),t=trOf(data,b.trainerId); return (<tr key={b.id}>
          <td style={{fontWeight:600}}>{m?m.name:'—'}</td><td>{t?t.name:'—'}</td><td>{thDate(b.date)} · {b.time}</td>
          <td>{b.kind==='package'?'เซสชันแพ็ก':'จ่ายต่อครั้ง '+B(b.amount)}</td>
          <td className="c">{b.status==='confirmed'?<span className="pill p-g">ยืนยัน</span>:<span className="pill p-y">รอชำระ</span>}</td></tr>); })}</tbody></table></div>
    </div>
    {sel&&(()=>{ const t=trOf(data,sel); const qs=ptBookings.filter(b=>b.trainerId===sel);
      return (<Modal title={t.name} tag={t.specialty} onClose={()=>setSel(null)} max={560}>
        <div className="note g" style={{marginBottom:14}}>{t.bio} · ตารางว่าง {t.avail}</div>
        <div className="kpis" style={{gridTemplateColumns:'1fr 1fr 1fr',marginBottom:16}}>
          <Kpi label="เรตต่อเซสชัน" value={B(t.rate)}/><Kpi label="คะแนนรีวิว" value={'⭐ '+t.rating} foot={t.reviews+' รีวิว'} tone="var(--gold)"/>
          <Kpi label="รายได้เดือนนี้" value={B(revOf(sel))} foot={qs.length+' คิว'} tone="var(--green)"/></div>
        <label className="lb">คิวที่จอง</label>
        {qs.length? qs.map(b=>{ const m=mbOf(data,b.memberId); return (<div key={b.id} className="fit-line">
          <div><b>{m?m.name:'—'}</b><div className="sub">{thDate(b.date)} · {b.time} · {b.kind==='package'?'เซสชันแพ็ก':B(b.amount)}</div></div>
          <span className={'pill '+(b.status==='confirmed'?'p-g':'p-y')}>{b.status==='confirmed'?'ยืนยัน':'รอชำระ'}</span></div>); }) : <div className="empty">ยังไม่มีคิว</div>}
      </Modal>); })()}
  </div>);
}

/* ════ OWNER · ขายของ ════ */
function ShopView({data,setData}){
  const {products}=data; const [sell,setSell]=useState(null);
  const soldRev=(data.renewals||[]).filter(r=>r.kind==='shop').reduce((a,b)=>a+b.amount,0);
  return (<div className="fade">
    <div className="kpis"><Kpi label="สินค้าในร้าน" value={products.length+' รายการ'}/><Kpi label="ยอดขายเดือนนี้" value={B(soldRev)} tone="var(--green)"/>
      <Kpi label="ขายผ่านแอป" value={(data.renewals||[]).filter(r=>r.kind==='shop'&&r.via==='app').length+' รายการ'} foot="mobile order · จ่ายในแอป" tone="var(--blue-ink)"/></div>
    <div className="card" style={{overflow:'hidden'}}>
      <table><thead><tr><th>สินค้า</th><th className="r">ราคา</th><th className="c">คงเหลือ</th><th className="c">ขายแล้ว</th><th></th></tr></thead>
        <tbody>{products.map(p=>(<tr key={p.id}><td><b>{p.name}</b>{p.cat&&<div className="sub">{p.cat}</div>}</td><td className="r num">{B(p.price)}</td>
          <td className="c">{p.stock>=999?<span className="pill p-b">ชงสด</span>:<span className={'pill '+(p.stock<=5?'p-r':p.stock<=12?'p-y':'p-g')}>{p.stock}</span>}</td>
          <td className="c num">{p.sold}</td><td className="r"><button className="btn gh sm" onClick={()=>setSell(p.id)}>ขาย</button></td></tr>))}</tbody></table>
    </div>
    {sell&&(()=>{ const p=products.find(x=>x.id===sell); const [mid,setMid]=[null,null];
      return <SellModal data={data} setData={setData} product={p} onClose={()=>setSell(null)}/>; })()}
  </div>);
}
function SellModal({data,setData,product,onClose}){
  const [mid,setMid]=useState(''); const [via,setVia]=useState('app');
  const fee=appFee(data.gym,product.price);
  const doSell=()=>{ setData(d=>{ const pr=d.products.find(x=>x.id===product.id); pr.stock=Math.max(0,pr.stock-1); pr.sold++;
    d.renewals.push({id:'sv-'+Date.now().toString(36),memberId:mid,productId:product.id,amount:product.price,via,kind:'shop',at:Date.now()});
    const mm=mbOf(d,mid); if(mm) mm.spend+=product.price; return {...d}; }); onClose(); };
  return (<Modal title={'ขาย · '+product.name} tag={B(product.price)} onClose={onClose} max={440}>
    <label className="lb">สมาชิก (ไม่ระบุก็ได้)</label>
    <select className="field" value={mid} onChange={e=>setMid(e.target.value)}><option value="">— ลูกค้าทั่วไป —</option>{data.members.map(m=><option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select>
    <label className="lb">ช่องทาง</label>
    <div className="seg" style={{width:'100%'}}>{[['app','จ่ายในแอป (mobile order)'],['counter','เคาน์เตอร์']].map(([k,l])=><button key={k} className={via===k?'on':''} style={{flex:1}} onClick={()=>setVia(k)}>{l}</button>)}</div>
    {via==='app'&&fee>0&&<div className="note gold" style={{marginTop:12}}>ค่าธรรมเนียมแพลตฟอร์ม ({PRICING[data.gym.pricingModel].th}) ≈ {B(fee)}</div>}
    <button className="btn pri" style={{marginTop:18,width:'100%'}} onClick={doSell}>บันทึกการขาย</button>
  </Modal>);
}

/* ════ OWNER · ฟอร์มสุขภาพ (PDPA) ════ */
function HealthPanel({data,setData,id}){
  const m=mbOf(data,id);
  const setBody=(which,k,v)=>setData(d=>{ const mm=mbOf(d,id); mm[which]=mm[which]||{date:todayISO()}; mm[which][k]=Number(v)||0; mm[which].date=todayISO(); return {...d}; });
  const toggle=(k)=>setData(d=>{ const mm=mbOf(d,id); mm[k]=!mm[k]; return {...d}; });
  const b=m.bodyBefore, a=m.bodyAfter;
  return (<div>
    <div className="note gold" style={{marginBottom:14}}>🔒 ข้อมูลสุขภาพเก็บตาม PDPA — ขอความยินยอมก่อนบันทึก · ใช้ประเมินโปรแกรมเทรน</div>
    <label className="chkline"><input type="checkbox" checked={!!m.consent} onChange={()=>toggle('consent')}/> สมาชิกยินยอมให้เก็บข้อมูลสุขภาพ (PDPA)</label>
    <label className="chkline" style={{marginTop:10}}><input type="checkbox" checked={!!m.parq} onChange={()=>toggle('parq')}/> ผ่านแบบสอบถามความพร้อม PAR-Q แล้ว</label>
    <label className="lb" style={{marginTop:16}}>ผลตรวจร่างกาย ก่อน–หลัง</label>
    <div className="fit-bodygrid">
      <div className="card panel" style={{padding:14}}><div className="sub" style={{marginBottom:8}}>ก่อนเริ่ม {b?'· '+thDate(b.date):''}</div>
        <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
          <div><label className="lb" style={{margin:'0 0 4px'}}>น้ำหนัก (กก.)</label><input className="field num" value={b?b.w:''} onChange={e=>setBody('bodyBefore','w',e.target.value)}/></div>
          <div><label className="lb" style={{margin:'0 0 4px'}}>ไขมัน (%)</label><input className="field num" value={b?b.fat:''} onChange={e=>setBody('bodyBefore','fat',e.target.value)}/></div></div></div>
      <div className="card panel" style={{padding:14}}><div className="sub" style={{marginBottom:8}}>ล่าสุด {a?'· '+thDate(a.date):''}</div>
        <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr'}}>
          <div><label className="lb" style={{margin:'0 0 4px'}}>น้ำหนัก (กก.)</label><input className="field num" value={a?a.w:''} onChange={e=>setBody('bodyAfter','w',e.target.value)}/></div>
          <div><label className="lb" style={{margin:'0 0 4px'}}>ไขมัน (%)</label><input className="field num" value={a?a.fat:''} onChange={e=>setBody('bodyAfter','fat',e.target.value)}/></div></div></div>
    </div>
    {b&&a&&<div className="note g" style={{marginTop:12}}>ผลลัพธ์: น้ำหนัก {a.w-b.w>0?'+':''}{(a.w-b.w).toFixed(1)} กก. · ไขมัน {a.fat-b.fat>0?'+':''}{(a.fat-b.fat).toFixed(1)}%</div>}
  </div>);
}

/* ════ OWNER · แพ็กเกจ & ราคา ════ */
function PackagesView({data,setData}){
  const {gym,packages}=data; const [edit,setEdit]=useState(null);
  const setModel=(k)=>setData(d=>{ d.gym.pricingModel=k; return {...d}; });
  const save=(p)=>{ setData(d=>{ if(p.id){ Object.assign(d.packages.find(x=>x.id===p.id),p); } else { d.packages.push({...p,id:'pk-'+Date.now().toString(36)}); } return {...d}; }); setEdit(null); };
  const del=(id)=>setData(d=>{ d.packages=d.packages.filter(x=>x.id!==id); return {...d}; });
  return (<div className="fade">
    <div className="card panel" style={{marginBottom:18}}>
      <h3>รูปแบบราคาระบบ (เลือกได้ 3 แบบ)</h3>
      <div className="fit-price3">{Object.entries(PRICING).map(([k,v])=>(
        <button key={k} onClick={()=>setModel(k)} className={'fit-pricecard'+(gym.pricingModel===k?' on':'')}>
          <div className="fp-tag">แบบ {k}</div><div className="fp-th">{v.th}</div><div className="fp-range">{v.rangeTh}</div><div className="fp-desc">{v.desc}</div>
          {gym.pricingModel===k&&<div className="fp-on">✓ ใช้อยู่</div>}</button>))}</div>
    </div>
    <div className="toolbar"><h3 style={{margin:0,fontSize:16}}>แพ็กเกจสมาชิก</h3><div className="grow"/><button className="btn pri" onClick={()=>setEdit({name:'',kind:'monthly',price:1990,months:1,sessions:0,desc:''})}>+ เพิ่มแพ็ก</button></div>
    <div className="card" style={{overflow:'hidden'}}>
      <table><thead><tr><th>แพ็กเกจ</th><th>ประเภท</th><th className="r">ราคา</th><th className="c">สมาชิก</th><th></th></tr></thead>
        <tbody>{packages.map(p=>(<tr key={p.id}><td><b>{p.name}</b><div className="sub">{p.desc}</div></td>
          <td>{p.kind==='monthly'?p.months+' เดือน':p.kind==='yearly'?'รายปี':p.kind==='sessions'?p.sessions+' เซสชัน':'รายวัน'}</td>
          <td className="r num" style={{fontWeight:700}}>{B(p.price)}</td>
          <td className="c num">{data.members.filter(m=>m.packageId===p.id).length}</td>
          <td className="r" style={{whiteSpace:'nowrap'}}><button className="btn gh sm" onClick={()=>setEdit(p)}>แก้</button> <button className="btn dngh sm" onClick={()=>del(p.id)}>ลบ</button></td></tr>))}</tbody></table>
    </div>
    {edit&&<PkgForm pkg={edit} onSave={save} onClose={()=>setEdit(null)}/>}
  </div>);
}
function PkgForm({pkg,onSave,onClose}){
  const [f,setF]=useState({...pkg}); const set=(k,v)=>setF({...f,[k]:v});
  return (<Modal title={pkg.id?'แก้ไขแพ็ก':'เพิ่มแพ็ก'} onClose={onClose} max={460}>
    <label className="lb">ชื่อแพ็ก</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)}/>
    <label className="lb">ประเภท</label>
    <div className="seg" style={{width:'100%'}}>{[['monthly','รายเดือน'],['yearly','รายปี'],['sessions','เซสชัน'],['daypass','รายวัน']].map(([k,l])=><button key={k} className={f.kind===k?'on':''} style={{flex:1}} onClick={()=>set('kind',k)}>{l}</button>)}</div>
    <div className="meterrow" style={{gridTemplateColumns:'1fr 1fr',marginTop:12}}>
      <div><label className="lb" style={{margin:'0 0 4px'}}>ราคา (฿)</label><input className="field num" value={f.price} onChange={e=>set('price',Number(e.target.value)||0)}/></div>
      <div><label className="lb" style={{margin:'0 0 4px'}}>{f.kind==='sessions'?'จำนวนเซสชัน':'จำนวนเดือน'}</label><input className="field num" value={f.kind==='sessions'?f.sessions:f.months} onChange={e=>set(f.kind==='sessions'?'sessions':'months',Number(e.target.value)||0)}/></div>
    </div>
    <label className="lb">คำอธิบาย</label><input className="field" value={f.desc} onChange={e=>set('desc',e.target.value)}/>
    <button className="btn pri" style={{marginTop:18,width:'100%'}} disabled={!f.name} onClick={()=>onSave(f)}>บันทึก</button>
  </Modal>);
}

/* ════ TRAINER lens ════ */
function TrainerHome({data,trainerId}){
  const t=trOf(data,trainerId); const {ptBookings}=data;
  const my=ptBookings.filter(b=>b.trainerId===trainerId).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const rev=my.filter(b=>b.paid).reduce((a,b)=>a+b.amount,0);
  const myClasses=data.classes.filter(c=>c.trainerId===trainerId);
  return (<div className="fade">
    <div className="kpis"><Kpi label="เรตต่อเซสชัน" value={B(t.rate)}/><Kpi label="คะแนนรีวิว" value={'⭐ '+t.rating} foot={t.reviews+' รีวิว'} tone="var(--gold)"/>
      <Kpi label="รายได้เดือนนี้ (PT)" value={B(rev)} tone="var(--green)"/><Kpi label="คลาสกรุ๊ปที่สอน" value={myClasses.length+' คลาส/สัปดาห์'}/></div>
    <div className="grid2">
      <div className="card panel"><h3>ตารางของฉัน (PT)</h3>
        {my.length? my.map(b=>{ const m=mbOf(data,b.memberId); return (<div key={b.id} className="fit-line">
          <div><b>{m?m.name:'—'}</b><div className="sub">{thDate(b.date)} · {b.time} · {b.kind==='package'?'เซสชันแพ็ก':B(b.amount)}</div></div>
          <span className={'pill '+(b.status==='confirmed'?'p-g':'p-y')}>{b.status==='confirmed'?'ยืนยัน':'รอชำระ'}</span></div>); }) : <div className="empty">ยังไม่มีนัด</div>}
      </div>
      <div className="card panel"><h3>คลาสกรุ๊ปของฉัน</h3>
        {myClasses.map(c=>(<div key={c.id} className="fit-line"><div><b>{c.name}</b><div className="sub">{DOW_FULL[c.day]} · {c.time} · {c.dur}น.</div></div>
          <span className="pill p-b">{c.booked.length}/{c.cap}</span></div>))}
        {!myClasses.length&&<div className="empty">ยังไม่มีคลาส</div>}
      </div>
    </div>
  </div>);
}

/* ════ MEMBER lens (มุมมองในแอปสมาชิก) ════ */
function MemberApp({data,setData,memberId}){
  const m=mbOf(data,memberId); if(!m) return <div className="empty">เลือกสมาชิก</div>;
  const pk=pkgOf(data,m.packageId); const s=memberStatus(m); const [tab,setTab]=useState('card');
  const myCk=data.checkins.filter(c=>c.memberId===memberId).sort((a,b)=>b.at-a.at).slice(0,5);
  const myCls=data.classes.filter(c=>c.booked.includes(memberId));
  const myPt=data.ptBookings.filter(b=>b.memberId===memberId);
  const renew=(pid)=>setData(d=>{ const mm=mbOf(d,memberId); const p=pkgOf(d,pid); const from=(mm.expiry&&daysTo(mm.expiry)>0)?mm.expiry:todayISO();
    mm.packageId=pid; if(p.months)mm.expiry=isoAdd(from,p.months*30); if(p.kind==='sessions')mm.ptLeft=(mm.ptLeft||0)+p.sessions; mm.frozen=false; mm.spend+=p.price||0;
    d.renewals.push({id:'rv-'+Date.now().toString(36),memberId,packageId:pid,at:Date.now(),amount:p.price,via:'app',kind:'renew'}); return {...d}; });
  return (<div className="fade fit-phonewrap"><div className="fit-phone">
    <div className={'fit-memcard '+s.key}>
      <div className="fmc-top"><span>{data.gym.name}</span><span className="fmc-code">{m.code}</span></div>
      <div className="fmc-name">{m.name}</div>
      <div className="fmc-pk">{pk?pk.name:'ยังไม่มีแพ็ก'}</div>
      <div className="fmc-st">{s.key==='expired'?('หมดอายุแล้ว '+Math.abs(s.d)+' วัน'):s.key==='active'||s.key==='expiring'?('ใช้ได้ถึง '+thDate(m.expiry)+' · เหลือ '+s.d+' วัน'):s.th}</div>
      <div className="fmc-qr" dangerouslySetInnerHTML={{__html:qrSVG('member'+m.id)}}/>
      <div className="fmc-hint">แตะ NFC / สแกน QR นี้ที่ประตู</div>
    </div>
    <div className="fit-mtab">{[['card','แพ็ก'],['class','คลาส'],['pt','เทรนเนอร์'],['history','เข้าออก']].map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}</div>
    <div className="fit-mbody">
      {tab==='card'&&<div>
        {(s.key==='expired'||s.key==='expiring')&&<div className="note gold" style={{marginBottom:12}}>{s.key==='expired'?'แพ็กหมดอายุ':'แพ็กใกล้หมด'} — ต่ออายุจ่ายในแอปได้เลย</div>}
        <div className="lb" style={{marginTop:0}}>ซื้อ / ต่อแพ็ก (mobile order)</div>
        {data.packages.map(p=>(<button key={p.id} className="fit-pkbtn" onClick={()=>renew(p.id)}>
          <div><b>{p.name}</b>{p.pop&&<span className="pill p-y" style={{marginLeft:6,fontSize:10,padding:'1px 6px'}}>ยอดนิยม</span>}<div className="sub">{p.desc}</div></div><b className="num">{B(p.price)}</b></button>))}
        {pk&&pk.kind==='sessions'&&<div className="note blue" style={{marginTop:10}}>PT คงเหลือ {m.ptLeft} เซสชัน</div>}
      </div>}
      {tab==='class'&&<div>
        <div className="lb" style={{marginTop:0}}>คลาสที่จองไว้</div>
        {myCls.length?myCls.map(c=><div key={c.id} className="fit-line"><div><b>{c.name}</b><div className="sub">{DOW_FULL[c.day]} · {c.time}</div></div><span className={'pill '+(c.fee?'p-y':'p-g')}>{c.fee?B(c.fee):'ฟรี'}</span></div>):<div className="empty">ยังไม่ได้จองคลาส</div>}
        <div className="lb">คลาสที่เปิดรับ</div>
        {data.classes.filter(c=>!c.booked.includes(memberId)&&c.booked.length<c.cap).map(c=>(<button key={c.id} className="fit-pkbtn" onClick={()=>setData(d=>{ const cc=d.classes.find(x=>x.id===c.id); if(cc.booked.length<cc.cap)cc.booked.push(memberId); return {...d}; })}>
          <div><b>{c.name}</b><div className="sub">{DOW_FULL[c.day]} · {c.time} · {c.booked.length}/{c.cap}</div></div><span className="pill p-b">จอง</span></button>))}
      </div>}
      {tab==='pt'&&<div>
        <div className="lb" style={{marginTop:0}}>นัดเทรนเนอร์ของฉัน</div>
        {myPt.length?myPt.map(b=>{ const t=trOf(data,b.trainerId); return <div key={b.id} className="fit-line"><div><b>{t?t.name:'—'}</b><div className="sub">{thDate(b.date)} · {b.time}</div></div><span className={'pill '+(b.status==='confirmed'?'p-g':'p-y')}>{b.status==='confirmed'?'ยืนยัน':'รอชำระ'}</span></div>; }):<div className="empty">ยังไม่มีนัด</div>}
        <div className="lb">จองเทรนเนอร์ (จ่ายในแอป หรือใช้เซสชันแพ็ก)</div>
        {data.trainers.filter(t=>t.active).map(t=>(<button key={t.id} className="fit-pkbtn" onClick={()=>setData(d=>{ d.ptBookings.push({id:'pt-'+Date.now().toString(36),memberId,trainerId:t.id,date:isoAdd(todayISO(),2),time:'18:00',kind:(m.ptLeft>0?'package':'single'),paid:m.ptLeft>0,status:m.ptLeft>0?'confirmed':'pending',amount:m.ptLeft>0?0:t.rate}); if(m.ptLeft>0)mbOf(d,memberId).ptLeft--; return {...d}; })}>
          <div><b>{t.name}</b><div className="sub">{t.specialty} · ⭐{t.rating}</div></div><b className="num">{B(t.rate)}</b></button>))}
      </div>}
      {tab==='history'&&<div><div className="lb" style={{marginTop:0}}>ประวัติเข้าออก</div>
        {myCk.length?myCk.map(c=><div key={c.id} className="fit-line"><div><b>{c.method==='nfc'?'แตะ NFC':'สแกน QR'}</b><div className="sub">{thDateTime(c.at)}</div></div><span className={'pill '+(c.result==='ok'?'p-g':'p-r')}>{c.result==='ok'?'เข้าได้':'ปฏิเสธ'}</span></div>):<div className="empty">ยังไม่มีประวัติ</div>}
      </div>}
    </div>
  </div></div>);
}

/* ════ OWNER · หน้าขาย (POS) ════ */
function SellView({data,setData}){
  const {packages,products,trainers,gym}=data;
  const [cat,setCat]=useState('pkg'); const [cart,setCart]=useState([]); const [mid,setMid]=useState(''); const [method,setMethod]=useState('promptpay'); const [done,setDone]=useState(null);
  const add=(line)=>setCart(c=>{ const i=c.findIndex(x=>x.key===line.key); if(i>=0){ const n=[...c]; n[i]={...n[i],qty:n[i].qty+1}; return n; } return [...c,{...line,qty:1}]; });
  const chg=(key,d)=>setCart(c=>c.map(x=>x.key===key?{...x,qty:Math.max(0,x.qty+d)}:x).filter(x=>x.qty>0));
  const total=cart.reduce((a,l)=>a+l.price*l.qty,0);
  const fee=appFee(gym,method==='promptpay'?total:0);
  const checkout=()=>{ setData(d=>{ const now=Date.now();
    cart.forEach(l=>{ for(let i=0;i<l.qty;i++){
      if(l.kind==='pkg'){ const p=pkgOf(d,l.id); if(mid){ const mm=mbOf(d,mid); const from=(mm.expiry&&daysTo(mm.expiry)>0)?mm.expiry:todayISO(); mm.packageId=l.id; if(p.months)mm.expiry=isoAdd(from,p.months*30); if(p.kind==='sessions')mm.ptLeft=(mm.ptLeft||0)+p.sessions; mm.frozen=false; mm.spend+=p.price; }
        d.renewals.push({id:'rv-'+now+Math.random().toString(36).slice(2,6),memberId:mid,packageId:l.id,at:now,amount:p.price,via:method==='promptpay'?'counter':'counter',kind:'renew'}); }
      else if(l.kind==='product'){ const pr=d.products.find(x=>x.id===l.id); if(pr){pr.stock=Math.max(0,pr.stock-1);pr.sold++;} if(mid){const mm=mbOf(d,mid);if(mm)mm.spend+=l.price;}
        d.renewals.push({id:'sv-'+now+Math.random().toString(36).slice(2,6),memberId:mid,productId:l.id,amount:l.price,via:'counter',kind:'shop',at:now}); }
      else if(l.kind==='pt'){ d.ptBookings.push({id:'pt-'+now+Math.random().toString(36).slice(2,6),memberId:mid,trainerId:l.id,date:isoAdd(todayISO(),1),time:'18:00',kind:'single',paid:true,status:'confirmed',amount:l.price}); }
    }}); return {...d}; });
    setDone({total,method,n:cart.reduce((a,l)=>a+l.qty,0)}); };
  const reset=()=>{ setCart([]); setMid(''); setDone(null); };
  if(done) return (<div className="fade"><div className="card panel" style={{maxWidth:440,margin:'20px auto',textAlign:'center'}}>
    <div className="checkres ok" style={{marginBottom:8}}><div className="cr-ic">✓</div><div className="cr-nm">รับเงินแล้ว {B(done.total)}</div><div className="cr-st">{done.n} รายการ · {done.method==='promptpay'?'PromptPay':'เงินสด'}{mid?' · '+(mbOf(data,mid)||{}).name:''}</div></div>
    <button className="btn pri" style={{width:'100%',marginTop:6}} onClick={reset}>ขายรายการใหม่</button></div></div>);
  const cats={ pkg:packages.map(p=>({key:'pkg-'+p.id,kind:'pkg',id:p.id,name:p.name,sub:p.desc,price:p.price})),
    product:products.map(p=>({key:'pr-'+p.id,kind:'product',id:p.id,name:p.name,sub:p.stock>=999?'ชงสด':'คงเหลือ '+p.stock,price:p.price})),
    pt:trainers.filter(t=>t.active).map(t=>({key:'pt-'+t.id,kind:'pt',id:t.id,name:'PT · '+t.name,sub:t.specialty,price:t.rate})) };
  return (<div className="fade">
    <div className="note g" style={{marginBottom:16}}>พนักงานถือ iPad/มือถือปิดการขายได้ทุกที่ (แพ็ก/สินค้า/PT) → บันทึกเข้าระบบเดียวกับที่ลูกค้าซื้อเองในแอป · เลือกสมาชิกเพื่อผูกยอด+ต่ออายุอัตโนมัติ</div>
    <div className="pos-grid">
      <div>
        <div className="seg" style={{marginBottom:14}}>{[['pkg','แพ็กสมาชิก'],['product','สินค้า'],['pt','เทรนเนอร์ PT']].map(([k,l])=><button key={k} className={cat===k?'on':''} onClick={()=>setCat(k)}>{l}</button>)}</div>
        <div className="pos-cat">{cats[cat].map(it=>(<button key={it.key} className="pos-item" onClick={()=>add(it)}>
          <div className="pi-n">{it.name}</div><div className="pi-s">{it.sub||''}</div><div className="pi-p">{B(it.price)}</div></button>))}</div>
      </div>
      <div className="card panel pos-cart">
        <h3>บิลปัจจุบัน</h3>
        <label className="lb" style={{marginTop:0}}>สมาชิก (ผูกยอด · ไม่ระบุก็ได้)</label>
        <select className="field" value={mid} onChange={e=>setMid(e.target.value)}><option value="">— ลูกค้าทั่วไป —</option>{data.members.map(m=><option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select>
        <div className="cart-lines" style={{marginTop:12}}>{cart.length?cart.map(l=>(<div key={l.key} className="cart-line">
          <div className="cl-n"><b>{l.name}</b><span>{B(l.price)} × {l.qty}</span></div>
          <div className="cart-qty"><button onClick={()=>chg(l.key,-1)}>−</button><span className="num" style={{minWidth:18,textAlign:'center'}}>{l.qty}</span><button onClick={()=>chg(l.key,1)}>+</button></div>
          <div className="num" style={{fontWeight:700,minWidth:64,textAlign:'right'}}>{B(l.price*l.qty)}</div></div>)):<div className="empty" style={{padding:'24px 10px'}}>แตะสินค้าทางซ้ายเพื่อเพิ่ม</div>}</div>
        {cart.length>0&&<>
          <div className="cart-total"><span>รวมทั้งสิ้น</span><span className="ct-v num">{B(total)}</span></div>
          <label className="lb">ช่องทางรับเงิน</label>
          <div className="seg" style={{width:'100%'}}>{[['promptpay','PromptPay'],['cash','เงินสด']].map(([k,l])=><button key={k} className={method===k?'on':''} style={{flex:1}} onClick={()=>setMethod(k)}>{l}</button>)}</div>
          {method==='promptpay'&&<div className="pos-pay"><div className="qr" dangerouslySetInnerHTML={{__html:qrSVG('possell'+total)}}/>
            <div className="sub">พร้อมเพย์ {gym.promptpay} · {B(total)}{fee>0?' · ค่าธรรมเนียมระบบ ≈ '+B(fee):''}</div></div>}
          <button className="btn pri" style={{width:'100%',marginTop:12}} onClick={checkout}>{method==='promptpay'?'ยืนยันรับเงิน (เช็คยอดโอนแล้ว)':'รับเงินสด '+B(total)}</button>
        </>}
      </div>
    </div>
  </div>);
}

/* ════ ROOT ════ */
const ROLES={
  owner:{label:'เจ้าของฟิตเนส',color:'#0E9C88',groups:[['ดำเนินงาน',['dash','sell','members','checkin','classes','trainers']],['ร้านค้า & ข้อมูล',['shop','packages']]],
    tabs:[['dash','ภาพรวม','📊'],['sell','หน้าขาย (POS)','🧾'],['members','สมาชิก & ต่ออายุ','🎫'],['checkin','เช็คอินหน้าประตู','🚪'],['classes','คลาส & ตาราง','🗓️'],['trainers','เทรนเนอร์ PT','🏋️'],['shop','ขายของ','🛍️'],['packages','แพ็กเกจ & ราคา','💳']]},
  trainer:{label:'เทรนเนอร์ (PT)',color:'#1E73B0',tabs:[['me','หน้าเทรนเนอร์','🏋️']]},
  member:{label:'สมาชิก (แอป)',color:'#7a4a8c',tabs:[['app','แอปสมาชิก','📱']]},
};
function App(){
  const [data,setData0]=useState(()=>F.load());
  const [role,setRole]=useState('owner'); const [tab,setTab]=useState('dash');
  const [trainerId,setTrainerId]=useState(()=>F.load().trainers[0].id);
  const [memberId,setMemberId]=useState(()=>{ const d=F.load(); return (d.members.find(m=>memberStatus(m).key==='expiring')||d.members[0]).id; });
  const setData=(fn)=>setData0(d=>{ const nd=typeof fn==='function'?fn(d):fn; F.save(nd); return nd; });
  useEffect(()=>{ setTab(ROLES[role].tabs[0][0]); },[role]);
  const expN=data.members.filter(m=>['expiring','expired'].includes(memberStatus(m).key)).length;
  const R=ROLES[role]; const tb={}; R.tabs.forEach(t=>tb[t[0]]=t);
  const doReset=()=>{ if(confirm('รีเซ็ตข้อมูลสาธิตฟิตเนสทั้งหมด?')){ const s=F.reset(); setData0(s); } };
  const navBtn=([k,l,ic])=>(<button key={k} className={'nav'+(tab===k?' on':'')} onClick={()=>setTab(k)}><span className="ic">{ic}</span>{l}
    {k==='members'&&expN>0&&<span className="badge" style={{background:'var(--gold)'}}>{expN}</span>}</button>);
  return (<div className="app">
    <div className="side">
      <div className="logo"><div className="logo-mk"><img src="assets/kaidee-logo.png" alt="KaiDee"/></div><div className="logo-tx">KaiDee Platform<small>Vertical ฟิตเนส · Market OS</small></div></div>
      <div className="roleswitch"><div className="rl-h">มุมมอง (แยกสิทธิ์)</div>
        {Object.entries(ROLES).map(([k,v])=><button key={k} className={role===k?'on':''} onClick={()=>setRole(k)} style={role===k?{color:'#fff'}:null}><span className="rc" style={{color:v.color}}/><span>{v.label}</span></button>)}</div>
      {R.groups ? R.groups.map(([gl,ks])=><div key={gl}><div className="navgrp">{gl}</div>{ks.map(k=>tb[k]&&navBtn(tb[k]))}</div>) : R.tabs.map(navBtn)}
      <div className="side-foot">{data.gym.name}<br/>PromptPay {data.gym.promptpay} · {PRICING[data.gym.pricingModel].th}<br/><a onClick={doReset} style={{cursor:'pointer',color:'#7ea299'}}>↺ รีเซ็ตข้อมูลสาธิต</a></div>
    </div>
    <div className="main">
      <div className="topbar">
        <div><h1>{(R.tabs.find(t=>t[0]===tab)||R.tabs[0])[1]}</h1><div className="sub">{data.gym.name} · <span style={{color:R.color,fontWeight:600}}>{R.label}</span></div></div>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          {role==='trainer'&&<select className="field" style={{maxWidth:220}} value={trainerId} onChange={e=>setTrainerId(e.target.value)}>{data.trainers.map(t=><option key={t.id} value={t.id}>🏋️ {t.name}</option>)}</select>}
          {role==='member'&&<select className="field" style={{maxWidth:240}} value={memberId} onChange={e=>setMemberId(e.target.value)}>{data.members.map(m=><option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select>}
        </div>
      </div>
      <div className="content">
        {role==='owner'&&tab==='dash'&&<FitDash data={data} go={setTab}/>}
        {role==='owner'&&tab==='sell'&&<SellView data={data} setData={setData}/>}
        {role==='owner'&&tab==='members'&&<MembersView data={data} setData={setData}/>}
        {role==='owner'&&tab==='checkin'&&<CheckinView data={data} setData={setData}/>}
        {role==='owner'&&tab==='classes'&&<ClassesView data={data} setData={setData}/>}
        {role==='owner'&&tab==='trainers'&&<TrainersView data={data} setData={setData}/>}
        {role==='owner'&&tab==='shop'&&<ShopView data={data} setData={setData}/>}
        {role==='owner'&&tab==='packages'&&<PackagesView data={data} setData={setData}/>}
        {role==='trainer'&&<TrainerHome data={data} trainerId={trainerId}/>}
        {role==='member'&&<MemberApp data={data} setData={setData} memberId={memberId}/>}
      </div>
    </div>
  </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
