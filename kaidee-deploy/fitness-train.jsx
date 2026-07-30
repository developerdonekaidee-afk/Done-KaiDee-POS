// fitness-train.jsx — ตารางเทรนรายคน (เทรนเนอร์สร้าง → สมาชิกเห็นในแอป) · perm key 'trainplan'
const { useState:useStateT } = React;
(function(){
const F=window.FIT; const H=window.fitHelpers||{};
const {todayISO,thDate,DOW_FULL}=F; const B=H.B; const mbOf=H.mbOf; const trOf=H.trOf;
const uid=(p)=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const plans=(d)=>d.trainPlans||[];
const planOfMember=(d,mid,tid)=>plans(d).find(p=>p.memberId===mid&&(!tid||p.trainerId===tid)&&!p.archived);
const myTrainerId=(d)=>{ const s=(d.staff||[]).find(x=>x.id===d.currentStaffId); if(s&&s.role==='trainer') return s.trainerId||('tr-'+String(s.id).replace(/^st-/,'')); return (d.trainers&&d.trainers[0]&&d.trainers[0].id)||null; };
const sess=(p)=>(p&&p.days||[]).slice().sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
const doneN=(p)=>(p&&p.days||[]).filter(x=>x.status==='done').length;
const nextS=(p)=>sess(p).find(x=>x.status!=='done'&&x.status!=='skip'&&x.date>=todayISO());
// ลูกเทรนของเทรนเนอร์ = คนที่จอง PT กับเรา + คนที่มีโปรแกรมกับเราอยู่แล้ว
function clientsOf(d,tid){ const ids=new Set();
  (d.ptBookings||[]).filter(b=>b.trainerId===tid&&!b.voided).forEach(b=>ids.add(b.memberId));
  plans(d).filter(p=>p.trainerId===tid&&!p.archived).forEach(p=>ids.add(p.memberId));
  return [...ids].map(id=>mbOf(d,id)).filter(Boolean); }
function savePlan(setData,plan){ setData(dd=>{ dd.trainPlans=dd.trainPlans||[];
  const i=dd.trainPlans.findIndex(p=>p.id===plan.id);
  if(i<0) dd.trainPlans.push(plan); else dd.trainPlans[i]=plan; return {...dd}; }); }

/* ══ แผ่นสร้าง/แก้โปรแกรมเทรน ══ */
function PlanSheet({d,setData,toast,plan,memberId,trainerId,readOnly,onClose}){
  const Sheet=window.fitSheet;
  const m=mbOf(d,plan?plan.memberId:memberId)||{};
  const [f,setF]=useStateT(()=>plan?{...plan,days:(plan.days||[]).map(x=>({...x}))}
    :{id:uid('tp-'),memberId,trainerId,title:'โปรแกรม 4 สัปดาห์',goal:'',perWeek:3,note:'',createdAt:Date.now(),days:[]});
  const [ns,setNs]=useStateT({date:todayISO(),time:'18:00',focus:'',items:''});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const addDay=()=>{ if(!ns.focus.trim()){ toast('ใส่หัวข้อวันเทรน เช่น ขา/หลัง'); return; }
    setF(x=>({...x,days:[...x.days,{id:uid('ts-'),date:ns.date,time:ns.time,focus:ns.focus.trim(),items:ns.items.split('\n').map(s=>s.trim()).filter(Boolean),status:'plan'}]}));
    setNs(v=>({...v,focus:'',items:''})); };
  const delDay=(id)=>setF(x=>({...x,days:x.days.filter(y=>y.id!==id)}));
  const mark=(id,st)=>setF(x=>({...x,days:x.days.map(y=>y.id===id?{...y,status:st,doneAt:st==='done'?Date.now():null}:y)}));
  const save=()=>{ if(!f.days.length){ toast('เพิ่มวันเทรนอย่างน้อย 1 วัน'); return; }
    savePlan(setData,{...f,updatedAt:Date.now()}); toast('บันทึกตารางเทรนแล้ว'); onClose(); };
  return (<Sheet title={(plan?'ตารางเทรน · ':'สร้างตารางเทรน · ')+(m.name||'')} tag={m.code?(m.code+(m.ptLeft?' · PT เหลือ '+m.ptLeft+' ครั้ง':'')):''} onClose={onClose}>
    <label className="lb" style={{marginTop:0}}>ชื่อโปรแกรม</label>
    <input className="field" value={f.title} readOnly={readOnly} onChange={e=>set('title',e.target.value)} placeholder="เช่น ลดไขมัน 8 สัปดาห์"/>
    <label className="lb">เป้าหมายของลูกเทรน</label>
    <input className="field" value={f.goal} readOnly={readOnly} onChange={e=>set('goal',e.target.value)} placeholder="เช่น ลดน้ำหนัก 5 กก. · เพิ่มกล้ามหลัง"/>
    <div className="secttl" style={{marginTop:16}}>วันเทรน ({f.days.length} ครั้ง · เสร็จ {f.days.filter(x=>x.status==='done').length})</div>
    <div className="card" style={{padding:'2px 12px'}}>
      {sess(f).length?sess(f).map(x=>(<div className="row" key={x.id}>
        <div className="b"><div className="t">{thDate(x.date)} · {x.time} — {x.focus}</div>
          <div className="s">{(x.items||[]).join(' · ')||'ยังไม่ระบุท่า'}</div></div>
        {readOnly?<span className={'pill '+(x.status==='done'?'pg':x.status==='skip'?'py':'pb')}>{x.status==='done'?'เสร็จ':x.status==='skip'?'ข้าม':'นัดไว้'}</span>
        :<div style={{display:'flex',gap:6,flex:'0 0 auto'}}>
          <button className={'btn sm '+(x.status==='done'?'pri':'gh')} onClick={()=>mark(x.id,x.status==='done'?'plan':'done')}>{x.status==='done'?'เสร็จ ✓':'ทำแล้ว'}</button>
          <button className="btn dngh sm" onClick={()=>delDay(x.id)}>ลบ</button></div>}
      </div>)):<div className="empty" style={{padding:'16px'}}>ยังไม่มีวันเทรน</div>}
    </div>
    {!readOnly&&<>
      <div className="secttl" style={{marginTop:16}}>เพิ่มวันเทรน</div>
      <div className="card">
        <div style={{display:'flex',gap:8}}>
          <div style={{flex:1}}><label className="lb" style={{marginTop:0}}>วันที่</label><input type="date" className="field" value={ns.date} onChange={e=>setNs(v=>({...v,date:e.target.value}))}/></div>
          <div style={{width:120}}><label className="lb" style={{marginTop:0}}>เวลา</label><input type="time" className="field" value={ns.time} onChange={e=>setNs(v=>({...v,time:e.target.value}))}/></div>
        </div>
        <label className="lb">หัวข้อ / กล้ามมัดหลัก</label>
        <input className="field" value={ns.focus} onChange={e=>setNs(v=>({...v,focus:e.target.value}))} placeholder="เช่น ขา + แกนกลาง"/>
        <label className="lb">ท่าเทรน (บรรทัดละท่า)</label>
        <textarea className="field" rows={4} value={ns.items} onChange={e=>setNs(v=>({...v,items:e.target.value}))} placeholder={'สควอท 4x10\nลันจ์ 3x12\nแพลงก์ 3x45 วิ'}/>
        <button className="btn gh blk sm" style={{marginTop:10}} onClick={addDay}>+ เพิ่มวันนี้เข้าตาราง</button>
      </div>
      <label className="lb">โน้ตถึงลูกเทรน (สมาชิกเห็นในแอป)</label>
      <textarea className="field" rows={2} value={f.note} onChange={e=>set('note',e.target.value)} placeholder="เช่น ดื่มน้ำ 2 ลิตร/วัน · งดของทอด"/>
      <button className="btn pri blk" style={{marginTop:14}} onClick={save}>บันทึกตารางเทรน</button>
      {plan&&<button className="btn dngh blk" style={{marginTop:8}} onClick={()=>{ if(!window.confirm('ปิดโปรแกรมนี้? (เก็บประวัติไว้ · สมาชิกจะไม่เห็นในแอป)'))return; savePlan(setData,{...f,archived:true}); toast('ปิดโปรแกรมแล้ว'); onClose(); }}>ปิดโปรแกรมนี้</button>}
    </>}
  </Sheet>);
}

/* ══ หน้างานเทรนเนอร์ (ลูกเทรนของฉัน) ══ */
function TrainerMyDay({d,setData,toast}){
  const tid=myTrainerId(d); const t=tid&&trOf(d,tid);
  const [open,setOpen]=useStateT(null); const [addC,setAddC]=useStateT(false); const [q,setQ]=useStateT('');
  const cls=clientsOf(d,tid);
  const mine=plans(d).filter(p=>p.trainerId===tid&&!p.archived);
  const today=todayISO();
  const todayS=mine.flatMap(p=>(p.days||[]).filter(x=>x.date===today).map(x=>({p,x}))).sort((a,b)=>(a.x.time||'').localeCompare(b.x.time||''));
  const noPlan=cls.filter(m=>!planOfMember(d,m.id,tid));
  const mon=today.slice(0,7);
  const doneMonth=mine.reduce((a,p)=>a+(p.days||[]).filter(x=>x.status==='done'&&x.date.slice(0,7)===mon).length,0);
  const pickList=(d.members||[]).filter(m=>!q||((m.name+' '+m.code).toLowerCase().includes(q.toLowerCase())));
  const markDone=(pid,sid)=>setData(dd=>{ const p=(dd.trainPlans||[]).find(x=>x.id===pid); if(p){ const s=(p.days||[]).find(x=>x.id===sid); if(s){ s.status=s.status==='done'?'plan':'done'; s.doneAt=s.status==='done'?Date.now():null; } } return {...dd}; });
  return (<div className="fade">
    <div className="card" style={{display:'flex',alignItems:'center',gap:12}}>
      <div className="ic" style={{background:'var(--brand-soft)',color:'var(--brand-ink)',fontSize:20,width:44,height:44}}>🏋️</div>
      <div style={{flex:1,minWidth:0}}><div style={{fontWeight:800,fontSize:16}}>{t?t.name:'เทรนเนอร์'}</div>
        <div style={{fontSize:12.5,color:'var(--ink-3)'}}>ลูกเทรน {cls.length} คน · นัดวันนี้ {todayS.length} คิว · เซสชันเสร็จเดือนนี้ {doneMonth}</div></div>
    </div>
    <div className="secttl">นัดวันนี้ · {thDate(today)}</div>
    <div className="card" style={{padding:'2px 12px'}}>
      {todayS.length?todayS.map(({p,x})=>{ const m=mbOf(d,p.memberId)||{}; return (<div className="row" key={x.id}>
        <div className="av">{(m.name||'?')[0]}</div>
        <div className="b" style={{cursor:'pointer'}} onClick={()=>setOpen(p.id)}><div className="t">{x.time} · {m.name}</div><div className="s">{x.focus}{x.ack==='move'?' · ขอเลื่อน':''}</div></div>
        <button className={'btn sm '+(x.status==='done'?'pri':'gh')} style={{flex:'0 0 auto'}} onClick={()=>markDone(p.id,x.id)}>{x.status==='done'?'เสร็จ ✓':'เช็คเสร็จ'}</button>
      </div>); }):<div className="empty" style={{padding:'16px'}}>วันนี้ไม่มีนัดเทรน</div>}
    </div>
    {!!noPlan.length&&<>
      <div className="secttl">ลูกเทรนใหม่ · ยังไม่มีโปรแกรม ({noPlan.length})</div>
      <div className="card" style={{padding:'2px 12px'}}>{noPlan.map(m=>(<div className="row" key={m.id}>
        <div className="av">{m.name[0]}</div>
        <div className="b"><div className="t">{m.name}</div><div className="s">{m.code}{m.ptLeft?' · PT เหลือ '+m.ptLeft+' ครั้ง':''}</div></div>
        <button className="btn pri sm" style={{flex:'0 0 auto'}} onClick={()=>setOpen({newFor:m.id})}>สร้างตาราง</button></div>))}</div>
    </>}
    <div className="secttl">ลูกเทรนของฉัน</div>
    <div className="card" style={{padding:'2px 12px'}}>
      {mine.length?mine.map(p=>{ const m=mbOf(d,p.memberId)||{}; const nx=nextS(p); const tot=(p.days||[]).length;
        return (<div className="row" key={p.id} onClick={()=>setOpen(p.id)} style={{cursor:'pointer'}}>
          <div className="av">{(m.name||'?')[0]}</div>
          <div className="b"><div className="t">{m.name} <span style={{fontWeight:500,color:'var(--ink-3)',fontSize:12}}>· {p.title}</span>
            {(()=>{ const fl=window.fitParqFlags&&window.fitParqFlags(m.parq); if(!m.parq) return <span className="pill py" style={{fontSize:9,padding:'0 5px'}}>ยังไม่ทำ PAR-Q</span>;
              return fl&&fl.length?<span className="pill pr" style={{fontSize:9,padding:'0 5px'}}>⚠️ PAR-Q {fl.length} ข้อ</span>:null; })()}</div>
            <div className="s">{nx?('นัดถัดไป '+thDate(nx.date)+' '+nx.time+' · '+nx.focus):'ยังไม่มีนัดถัดไป'}</div></div>
          <span className="pill pb" style={{flex:'0 0 auto'}}>{doneN(p)}/{tot}</span></div>); })
        :<div className="empty" style={{padding:'16px'}}>ยังไม่มีโปรแกรมเทรน</div>}
    </div>
    <button className="btn gh blk sm" style={{marginTop:12}} onClick={()=>setAddC(true)}>+ รับลูกเทรนใหม่ (เลือกสมาชิก)</button>
    {addC&&(()=>{ const Sheet=window.fitSheet; return (<Sheet title="เลือกสมาชิกเป็นลูกเทรน" onClose={()=>setAddC(false)}>
      <input className="field" value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหาชื่อ/รหัสสมาชิก"/>
      <div className="card" style={{padding:'2px 12px',marginTop:10}}>{pickList.slice(0,30).map(m=>(<div className="row" key={m.id}>
        <div className="av">{m.name[0]}</div><div className="b"><div className="t">{m.name}</div><div className="s">{m.code}</div></div>
        <button className="btn pri sm" style={{flex:'0 0 auto'}} onClick={()=>{ setAddC(false); setOpen(planOfMember(d,m.id,tid)?planOfMember(d,m.id,tid).id:{newFor:m.id}); }}>เลือก</button></div>))}
        {!pickList.length&&<div className="empty" style={{padding:'16px'}}>ไม่พบสมาชิก</div>}</div>
    </Sheet>); })()}
    {open&&<PlanSheet d={d} setData={setData} toast={toast} trainerId={tid}
      plan={typeof open==='string'?plans(d).find(p=>p.id===open):null}
      memberId={typeof open==='string'?null:open.newFor} onClose={()=>setOpen(null)}/>}
  </div>);
}

/* ══ ฝั่งเจ้าของ/ผู้จัดการ — ดูตารางเทรนทุกคน ══ */
function OwnerTrainPlans({d,setData,toast}){
  const [open,setOpen]=useStateT(null); const [tf,setTf]=useStateT('all');
  const all=plans(d).filter(p=>!p.archived);
  const rows=all.filter(p=>tf==='all'||p.trainerId===tf);
  const trs=(d.trainers||[]).filter(t=>all.some(p=>p.trainerId===t.id));
  const sessMonth=all.reduce((a,p)=>a+(p.days||[]).filter(x=>x.date.slice(0,7)===todayISO().slice(0,7)).length,0);
  return (<div className="fade">
    <div className="card"><h3>ภาพรวมตารางเทรน</h3>
      <div style={{display:'flex',gap:18,marginTop:6}}>
        <div><div style={{fontSize:22,fontWeight:800}}>{all.length}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>โปรแกรมที่ใช้งาน</div></div>
        <div><div style={{fontSize:22,fontWeight:800}}>{sessMonth}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>เซสชันเดือนนี้</div></div>
        <div><div style={{fontSize:22,fontWeight:800}}>{all.reduce((a,p)=>a+doneN(p),0)}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>เทรนเสร็จรวม</div></div>
      </div></div>
    {trs.length>1&&<div className="seg" style={{margin:'12px 0'}}>{[['all','ทุกคน'],...trs.map(t=>[t.id,t.name])].map(([k,l])=><button key={k} className={tf===k?'on':''} onClick={()=>setTf(k)}>{l}</button>)}</div>}
    <div className="card" style={{padding:'2px 12px'}}>
      {rows.length?rows.map(p=>{ const m=mbOf(d,p.memberId)||{}; const t=trOf(d,p.trainerId); const nx=nextS(p);
        return (<div className="row" key={p.id} style={{cursor:'pointer'}} onClick={()=>setOpen(p.id)}>
          <div className="av">{(m.name||'?')[0]}</div>
          <div className="b"><div className="t">{m.name} <span style={{fontWeight:500,fontSize:12,color:'var(--ink-3)'}}>· {t?t.name:'—'}</span></div>
            <div className="s">{p.title} · {nx?('นัดถัดไป '+thDate(nx.date)+' '+nx.time):'ไม่มีนัดถัดไป'}</div></div>
          <span className="pill pb" style={{flex:'0 0 auto'}}>{doneN(p)}/{(p.days||[]).length}</span></div>); })
        :<div className="empty" style={{padding:'18px'}}>ยังไม่มีตารางเทรน — เทรนเนอร์สร้างได้จากหน้า “ลูกเทรน”</div>}
    </div>
    {open&&<PlanSheet d={d} setData={setData} toast={toast} plan={plans(d).find(p=>p.id===open)} onClose={()=>setOpen(null)}/>}
  </div>);
}

/* ══ ฝั่งสมาชิก — ตารางเทรนของฉัน (โชว์ในแท็บคลาส) ══ */
function MemberTrainPlan({d,setData,memberId,toast}){
  const m=mbOf(d,memberId)||{};
  const mine=plans(d).filter(p=>p.memberId===memberId&&!p.archived);
  const ack=(pid,sid,v)=>setData(dd=>{ const p=(dd.trainPlans||[]).find(x=>x.id===pid); if(p){ const s=(p.days||[]).find(x=>x.id===sid); if(s)s.ack=v; } return {...dd}; });
  if(!mine.length){
    if(!(m.ptLeft>0)) return null;
    return (<><div className="secttl">ตารางเทรนของฉัน</div>
      <div className="note gold" style={{marginBottom:12}}>มีสิทธิ์ PT เหลือ {m.ptLeft} ครั้ง — เทรนเนอร์กำลังจัดตารางเทรนให้ · จะขึ้นที่นี่เมื่อจัดเสร็จ</div></>);
  }
  return (<><div className="secttl">ตารางเทรนของฉัน</div>
    {mine.map(p=>{ const t=trOf(d,p.trainerId); const up=sess(p).filter(x=>x.date>=todayISO()||x.status==='plan');
      return (<div key={p.id} style={{marginBottom:14}}>
        <div className="card" style={{marginBottom:9}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div className="ic" style={{background:'var(--brand-soft)',color:'var(--brand-ink)',width:38,height:38,fontSize:17}}>🏋️</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:800,fontSize:15}}>{p.title}</div>
              <div style={{fontSize:12,color:'var(--ink-3)'}}>{t?'ผู้สอน '+t.name:''}{p.goal?' · เป้าหมาย '+p.goal:''}</div></div>
            <span className="pill pg" style={{flex:'0 0 auto'}}>{doneN(p)}/{(p.days||[]).length}</span></div>
          {p.note&&<div className="note blue" style={{marginTop:10,fontSize:12}}>📝 {p.note}</div>}
        </div>
        <div className="card" style={{padding:'2px 12px'}}>
          {up.length?up.map(x=>(<div className="row" key={x.id}>
            <div className="b"><div className="t">{thDate(x.date)} · {x.time} — {x.focus}</div>
              <div className="s">{(x.items||[]).join(' · ')||'—'}</div></div>
            <div style={{flex:'0 0 auto',display:'flex',gap:6,alignItems:'center'}}>
              {x.status==='done'?<span className="pill pg">เทรนแล้ว ✓</span>
               :x.ack==='ok'?<span className="pill pb">ยืนยันแล้ว</span>
               :x.ack==='move'?<span className="pill py">ขอเลื่อน</span>
               :<><button className="btn pri sm" onClick={()=>{ack(p.id,x.id,'ok');toast&&toast('ยืนยันเข้าเทรนแล้ว');}}>มา</button>
                  <button className="btn gh sm" onClick={()=>{ack(p.id,x.id,'move');toast&&toast('แจ้งขอเลื่อนให้เทรนเนอร์แล้ว');}}>ขอเลื่อน</button></>}
            </div></div>)):<div className="empty" style={{padding:'16px'}}>ยังไม่มีนัดถัดไป</div>}
        </div>
      </div>); })}
  </>);
}

Object.assign(window,{ TrainerMyDay, OwnerTrainPlans, MemberTrainPlan, FitPlanSheet:PlanSheet, fitTrainPlans:plans, fitMyTrainerId:myTrainerId });
})();
