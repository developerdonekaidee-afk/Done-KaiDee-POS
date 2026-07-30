/* laborwin2-shop.jsx — จอแม่ค้า/ร้าน: market-optional + 2 ช่องจับงาน + recurring roster
   + จอทะเบียนตลาด (directory · เคลม bottom-up) */
function AddMarketSheet({onAdd,onClose}){
  const [name,setName]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[loc,setLoc]=useState(null);
  const pin=async()=>{ setBusy(true); const l=await lw2geo(); setLoc(l); setBusy(false); };
  return <div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mh">เพิ่มตลาดใหม่ (สมัครจากล่าง)</div>
    <p className="mp">ไม่ต้องรอตลาดสมัคร — แม่ค้าปักหมุดสถานที่เองได้ · ตลาดเจ้าของเข้ามาเคลมทีหลัง</p>
    <label className="flbl">ชื่อสถานที่/ตลาด</label>
    <input className="fin" value={name} onChange={e=>setName(e.target.value)} placeholder="เช่น ตลาดเช้าบางบัวทอง"/>
    <label className="flbl">โค้ดสถานที่ (market_id)</label>
    <input className="fin" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/\s/g,''))} placeholder="BANGBUATHONG"/>
    <button className="btn ghost" onClick={pin} disabled={busy}>{busy?'กำลังปักหมุด…':loc?'📍 ปักหมุดแล้ว '+loc.lat.toFixed(3)+', '+loc.lng.toFixed(3):'📍 ปักพิกัด GPS'}</button>
    <button className="btn" disabled={!name||!code||!loc} onClick={()=>onAdd({id:'m-'+code.toLowerCase(),name,code,lat:loc.lat,lng:loc.lng,claimed:false,owner:null})}>เพิ่มตลาด</button>
    <button className="reset" onClick={onClose}>ยกเลิก</button>
  </div></div>;
}

function RosterSheet({markets,mid,onAdd,onClose}){
  const [type,setType]=useState('carry'),[time,setTime]=useState('05:00'),[days,setDays]=useState([1,2,3,4,5,6]);
  const tg=(d)=>setDays(days.includes(d)?days.filter(x=>x!==d):[...days,d].sort());
  return <div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mh">ตั้งงานประจำ (recurring)</div>
    <p className="mp">ระบบสร้างตารางล่วงหน้า → หัวคิวจัดคนไว้ก่อน · แรงงานรู้ว่าพรุ่งนี้มีงานกี่โมง</p>
    <label className="flbl">ประเภทงาน</label>
    <div className="row" style={{flexWrap:'wrap'}}>{JOBS_DEF.map(j=><div key={j.id} className={'chip'+(type===j.id?' on':'')} style={{flex:'1 0 40%'}} onClick={()=>setType(j.id)}>{j.e} {j.th}</div>)}</div>
    <label className="flbl">เวลา</label>
    <input className="fin" type="time" value={time} onChange={e=>setTime(e.target.value)}/>
    <label className="flbl">วันที่ทำ</label>
    <div className="row">{DOW.map((d,i)=><div key={i} className={'daychip'+(days.includes(i)?' on':'')} onClick={()=>tg(i)}>{d}</div>)}</div>
    <button className="btn" disabled={days.length===0} onClick={()=>onAdd({type,time,days})}>เพิ่มงานประจำ</button>
    <button className="reset" onClick={onClose}>ยกเลิก</button>
  </div></div>;
}

function ReviewSheet({worker,onSave,onClose}){
  const [stars,setStars]=useState(5),[note,setNote]=useState(''),[bl,setBl]=useState(false);
  return <div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mh">ให้คะแนนแรงงาน</div>
    <p className="mp">👷 {worker.name} — จบงานแล้ว · รีวิวช่วยร้านอื่นเลือกคนดี</p>
    <div style={{display:'flex',gap:6,justifyContent:'center',margin:'6px 0 12px'}}>{[1,2,3,4,5].map(n=><span key={n} onClick={()=>setStars(n)} style={{fontSize:34,cursor:'pointer',color:n<=stars?'#f5a623':'#d4d8dd'}}>{n<=stars?'★':'☆'}</span>)}</div>
    <textarea className="fin" rows="2" value={note} onChange={e=>setNote(e.target.value)} placeholder="ความเห็น (ไม่บังคับ)"/>
    <label className="ckrow"><input type="checkbox" checked={bl} onChange={e=>setBl(e.target.checked)}/> 🚫 บล็อกคนนี้ (ไม่เรียกอีก · ซ่อนจากงานร้านนี้)</label>
    <button className="btn" onClick={()=>onSave({stars,note,blacklist:bl})}>บันทึกรีวิว</button>
    <button className="reset" onClick={onClose}>ข้าม</button>
  </div></div>;
}

function LogSheet({winsHere,workers,onSave,onClose}){
  const [type,setType]=useState('lift'),[price,setPrice]=useState(jobDef('lift').price),[win_id,setWin]=useState(winsHere[0]&&winsHere[0].id),[worker,setWorker]=useState(''),[credit,setCredit]=useState(false);
  const wk=workers.filter(x=>x.win_id===win_id);
  return <div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mh">บันทึกงานปากเปล่า (ย้อนหลัง)</div>
    <p className="mp">งานที่ตะโกนเรียก/ตกลงหน้างานแล้ว คีย์เข้าระบบทีหลัง เพื่อให้รีวิว/หัวคิวยังนับ · ราคาต่อรองได้</p>
    <label className="flbl">ประเภทงาน</label>
    <div className="row" style={{flexWrap:'wrap'}}>{JOBS_DEF.map(j=><div key={j.id} className={'chip'+(type===j.id?' on':'')} style={{flex:'1 0 40%'}} onClick={()=>{setType(j.id);setPrice(j.price);}}>{j.e} {j.th}</div>)}</div>
    <label className="flbl">ราคา (ต่อรองได้)</label>
    <input className="fin" type="number" value={price} onChange={e=>setPrice(Math.max(0,Math.round(Number(e.target.value))))}/>
    <label className="flbl">วิน</label>
    <select className="fin" value={win_id} onChange={e=>setWin(e.target.value)}>{winsHere.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
    <label className="flbl">แรงงาน (ถ้าระบุได้)</label>
    <select className="fin" value={worker} onChange={e=>setWorker(e.target.value)}><option value="">— ไม่ระบุ —</option>{wk.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
    <label className="ckrow"><input type="checkbox" checked={credit} onChange={e=>setCredit(e.target.checked)}/> 🧾 ลงเครดิต (ค้างจ่าย · จ่ายรวมทีหลัง)</label>
    <button className="btn" disabled={!win_id||!price} onClick={()=>onSave({type,price,win_id,worker,credit})}>บันทึกงาน</button>
    <button className="reset" onClick={onClose}>ยกเลิก</button>
  </div></div>;
}

function LogTab({st,up,settle,setAddLog}){
  const logs=(st.logs||[]).filter(g=>g.shop===MESHOP.name);
  const credit=logs.filter(g=>!g.paid);
  const owed=credit.reduce((a,g)=>a+g.price,0);
  return <>
    <div className="card" style={{background:owed>0?'var(--gold-soft)':'var(--brand-soft)'}}><div className="rowb"><span style={{fontSize:12.5,color:'var(--ink-2)'}}>🧾 ยอดค้างจ่าย (เครดิต)</span><b style={{fontSize:20,color:owed>0?'var(--gold)':'var(--brand)'}}>{B(owed)}</b></div></div>
    <button className="btn ghost" onClick={()=>setAddLog(true)}>＋ บันทึกงานปากเปล่า (ย้อนหลัง)</button>
    <div className="lbl" style={{marginTop:4}}>ประวัติงานที่บันทึก</div>
    {logs.length===0&&<Empty>ยังไม่มีบันทึก<br/>งานที่ตกลงหน้างานคีย์เข้าที่นี่</Empty>}
    {logs.map(g=>{const d=jobDef(g.type);const w=st.wins.find(v=>v.id===g.win_id);const wk=st.workers.find(x=>x.id===g.worker);
      return <div className="jobc" key={g.id}>
        <div className="jt"><span className="e">{d.e}</span><div><b>{d.th} · {B(g.price)}</b><div className="my">{w?w.dot+' '+w.name:''}{wk?' · 👷 '+wk.name:''}</div></div>
          <span style={{marginLeft:'auto'}} className={'tag '+(g.paid?'done':'q')}>{g.paid?'จ่ายแล้ว':'ค้างจ่าย'}</span></div>
        {!g.paid&&<button className="btn" onClick={()=>settle(g.id)}>เคลียร์ยอด {B(g.price)} (คิดค่าคิวเข้าวิน)</button>}
      </div>;})}
  </>;
}
window.LogTab=LogTab;

function Shop({st,up,flash}){
  const [tab,setTab]=useState('call');
  const [addLog,setAddLog]=useState(false);
  const [mid,setMid]=useState(MESHOP.market_id);
  const [chan,setChan]=useState('win');   // win = ในตลาด · pool = งานนอก
  const [job,setJob]=useState('lift');
  const [win,setWin]=useState(null);
  const [reqWorker,setReqWorker]=useState('');   // เจาะจงคน (คนโปรด/เจ้าประจำ)
  const [review,setReview]=useState(null);       // แรงงานที่รอรีวิว
  const [addMk,setAddMk]=useState(false),[addR,setAddR]=useState(false);
  const jd=jobDef(job);
  const market=st.markets.find(m=>m.id===mid);
  const winsHere=st.wins.filter(w=>w.market_id===mid);
  const myRoster=st.roster.filter(r=>r.shop===MESHOP.name);
  const myPrefs=(st.shopPrefs||{})[MESHOP.id]||{};
  const pref=myPrefs.preferredWin;
  const favW=myPrefs.favWorkers||[], blW=myPrefs.blacklist||[];
  const setPref=(wid)=>up(s=>{const p=(s.shopPrefs=s.shopPrefs||{})[MESHOP.id]=(s.shopPrefs[MESHOP.id]||{});p.preferredWin=wid;});
  const toggleFav=(id)=>up(s=>{const p=(s.shopPrefs=s.shopPrefs||{})[MESHOP.id]=(s.shopPrefs[MESHOP.id]||{});const f=p.favWorkers||[];p.favWorkers=f.includes(id)?f.filter(x=>x!==id):[...f,id];});
  const winWorkers=win?st.workers.filter(x=>x.win_id===win&&x.market_id===mid&&!blW.includes(x.id)).sort((a,b)=>(favW.includes(b.id)-favW.includes(a.id))||(avgStars(b)-avgStars(a))):[];
  useEffect(()=>{ if(chan==='win'&&!win&&pref&&winsHere.some(w=>w.id===pref))setWin(pref); },[chan,mid]);
  useEffect(()=>{ setReqWorker(''); },[win,job]);

  const callWin=()=>{ if(!win)return; const rw=reqWorker||null; up(s=>{s.winQueue.unshift({id:uid('wq'),type:job,price:jd.price,win_id:win,market_id:mid,shopName:MESHOP.name,status:'queued',assignTo:rw,t:Date.now()});}); const rwn=rw&&(st.workers.find(x=>x.id===rw)||{}).name; flash(rwn?'เรียกเจาะจง 👷 '+rwn:'เข้าคิว '+(winsHere.find(w=>w.id===win)||{}).name); setReqWorker(''); };
  const postPool=()=>{ const jid=uid('op'); up(s=>{s.openPool.unshift({id:jid,type:job,pay:jd.price,market_id:mid,shopName:MESHOP.name,status:'open',t:Date.now()});}); flash('ลงงานนอก (open pool) แล้ว · แรงงานทุกตลาดเห็น');
    if(window.PLAT_API){lw2geo().then(l=>PLAT_API.poolPostJob({id:jid,title:jd.th,type:job,pay:jd.price,shopName:MESHOP.name,marketId:mid,lat:l.lat,lng:l.lng},'pool').catch(()=>{}));} };
  const applyWage=(s,win_id,price,worker)=>{const w=s.wins.find(v=>v.id===win_id);if(!w)return;const set=winSet(w);const cut=Math.round(price*headCutOf(w));if(set.wageMode==='leader'){const share=price-cut;w.wallet+=share;w.gp+=cut;const wk=worker&&s.workers.find(x=>x.id===worker);if(wk)wk.pending+=share;}else{w.gp+=cut;}};
  const finishWin=(jid)=>{ const j0=st.winQueue.find(x=>x.id===jid); const wkId=j0&&j0.worker; up(s=>{const j=s.winQueue.find(x=>x.id===jid);if(!j)return;j.status='done';applyWage(s,j.win_id,j.price,j.worker);j.wageMode=winSet(s.wins.find(v=>v.id===j.win_id)).wageMode;}); const wn=st.wins.find(v=>v.id===(j0||{}).win_id); flash(winSet(wn).wageMode==='leader'?'จ่ายเต็มให้หัวหน้าวิน · หัวคิวจ่ายลูกทีมต่อ':'ร้านจ่ายแรงงานตรง + ค่าคิวเข้าวิน'); const wk=wkId&&st.workers.find(x=>x.id===wkId); if(wk)setTimeout(()=>setReview(wk),250); };
  const saveReview=(f)=>{ if(!review)return; up(s=>{const wk=s.workers.find(x=>x.id===review.id);if(wk){(wk.ratings=wk.ratings||[]).push({stars:f.stars,note:f.note,by:MESHOP.name,at:Date.now()});} if(f.blacklist){const p=(s.shopPrefs=s.shopPrefs||{})[MESHOP.id]=(s.shopPrefs[MESHOP.id]||{});p.blacklist=[...new Set([...(p.blacklist||[]),review.id])];}}); setReview(null); flash(f.blacklist?'บันทึกรีวิว + บล็อกแล้ว':'ขอบคุณสำหรับรีวิว'); };
  const saveLog=(f)=>{ up(s=>{(s.logs=s.logs||[]).unshift({id:uid('lg'),type:f.type,price:f.price,win_id:f.win_id,worker:f.worker||null,shop:MESHOP.name,paid:!f.credit,t:Date.now()}); if(!f.credit)applyWage(s,f.win_id,f.price,f.worker);}); setAddLog(false); flash(f.credit?'ลงเครดิต (ค้างจ่าย)':'บันทึกงาน + คิดค่าคิวแล้ว'); };
  const settle=(id)=>{ up(s=>{const g=(s.logs||[]).find(x=>x.id===id);if(g&&!g.paid){g.paid=true;applyWage(s,g.win_id,g.price,g.worker);}}); flash('เคลียร์ยอดค้างแล้ว'); };

  const activeWin=st.winQueue.filter(j=>j.shopName===MESHOP.name&&j.status!=='done');
  const activePool=st.openPool.filter(j=>j.shopName===MESHOP.name&&j.status!=='done');

  return <><Hd bg="var(--brand)" s1="หน้าร้าน · เรียกแรงงาน" s2={MESHOP.name}/>
    <div className="body">
      <Seg items={[['call','📣 เรียกงาน'],['roster','📅 งานประจำ'],['log','🧾 บันทึก/เครดิต']]} val={tab} set={setTab}/>
      {tab==='call'?<>
        <div className="lbl">ตลาดของฉัน (market_id)</div>
        <div className="row" style={{flexWrap:'wrap'}}>{st.markets.map(m=><div key={m.id} className={'chip'+(mid===m.id?' on':'')} style={{flex:'1 0 44%',fontSize:12.5}} onClick={()=>setMid(m.id)}>{m.name}{m.claimed&&' ✓'}</div>)}
          <div className="chip" style={{flex:'1 0 44%',fontSize:12.5}} onClick={()=>setAddMk(true)}>＋ เพิ่มตลาด</div></div>
        <div className="lbl" style={{marginTop:4}}>2 ช่องจับงาน</div>
        <div className="row">
          <div className={'bigchip'+(chan==='win'?' on green':'')} onClick={()=>setChan('win')}><b>🏪 ในตลาด/วิน</b><span>ผ่านหัวคิว · คิว 60 วิ · ค่าคิวเข้าวิน</span></div>
          <div className={'bigchip'+(chan==='pool'?' on blue':'')} onClick={()=>setChan('pool')}><b>🌍 งานนอก</b><span>open pool · แรงงานกดรับเอง · ไม่ผ่านหัวคิว</span></div>
        </div>
        <div className="lbl">ประเภทงาน</div>
        <div className="row" style={{flexWrap:'wrap'}}>{JOBS_DEF.map(j=><div key={j.id} className={'chip'+(job===j.id?' on':'')} style={{flex:'1 0 44%'}} onClick={()=>setJob(j.id)}>{j.e} {j.th}</div>)}</div>
        {chan==='win'&&<><div className="lbl">เลือกวิน (⭐ = ทีมประจำ · เรียกเจ้าเดิมได้ทันที)</div>
          <div className="row">{winsHere.map(w=><div key={w.id} className={'chip '+w.cls+(win===w.id?' on':'')} onClick={()=>setWin(w.id)}><span onClick={e=>{e.stopPropagation();setPref(pref===w.id?null:w.id);}} style={{cursor:'pointer'}}>{pref===w.id?'⭐':'☆'}</span> {w.dot} {w.name.replace('วิน','')}</div>)}</div></>}
        {chan==='win'&&win&&<><div className="lbl">เจาะจงคน (⭐ คนโปรด · ดาว = คะแนนรีวิว)</div>
          <div className="row" style={{flexWrap:'wrap'}}>
            <div className={'chip'+(reqWorker===''?' on':'')} style={{flex:'1 0 30%'}} onClick={()=>setReqWorker('')}>👥 ใครก็ได้</div>
            {winWorkers.map(x=>{const av=avgStars(x);const fav=favW.includes(x.id);
              return <div key={x.id} className={'chip'+(reqWorker===x.id?' on':'')} style={{flex:'1 0 44%',flexDirection:'column',alignItems:'flex-start',gap:2}} onClick={()=>setReqWorker(reqWorker===x.id?'':x.id)}>
                <span><span onClick={e=>{e.stopPropagation();toggleFav(x.id);}} style={{cursor:'pointer'}}>{fav?'⭐':'☆'}</span> 👷 {x.name}</span>
                <span style={{fontSize:11}}>{av>0?<StarRow v={av}/>:<span style={{color:'var(--ink-3)'}}>ยังไม่มีรีวิว</span>}</span>
              </div>;})}
          </div></>}
        <div className="card price"><span style={{color:'var(--ink-3)',fontSize:14}}>ราคากลาง (จ่ายสด)</span><b>{B(jd.price)}</b></div>
        {chan==='win'?<button className="btn" disabled={!win} onClick={callWin}>เรียกแรงงานในวิน →</button>
          :<button className="btn" style={{background:'var(--blue)'}} onClick={postPool}>🌍 ลงงานนอก / open pool →</button>}

        <div className="lbl" style={{marginTop:6}}>งานที่กำลังดำเนินการ</div>
        {activeWin.length+activePool.length===0&&<Empty>ยังไม่มีงานค้าง</Empty>}
        {activeWin.map(j=>{const d=jobDef(j.type);const w=st.wins.find(x=>x.id===j.win_id);const lead=winSet(w).wageMode==='leader';
          return <div className="jobc" key={j.id}>
            <div className="jt"><span className="e">{d.e}</span><b>{d.th}</b><span style={{marginLeft:'auto'}} className={'tag '+(j.status==='queued'?'q':'work')}>{j.status==='queued'?'รอแรงงานรับ':j.status==='accepted'?'กำลังมา 🛵':'ทำงานอยู่ 💪'}</span></div>
            <div className="rowb"><span style={{color:'var(--ink-3)'}}>{w.dot} {w.name} · {B(j.price)}</span></div>
            {(j.status==='accepted'||j.status==='working')&&<button className="btn" onClick={()=>finishWin(j.id)}>{lead?'จ่าย '+B(j.price)+' ให้หัวหน้าวิน':'จ่ายแรงงาน '+B(j.price)}  + จบงาน</button>}
          </div>;})}
        {activePool.map(j=>{const d=jobDef(j.type);
          return <div className="jobc" key={j.id} style={{borderLeft:'3px solid var(--blue)'}}>
            <div className="jt"><span className="e">{d.e}</span><b>{d.th}</b><span style={{marginLeft:'auto'}} className="tag" >{j.status==='open'?<span style={{color:'var(--blue)'}}>🌍 รอคนรับ</span>:<span style={{color:'var(--blue)'}}>{j.worker} รับแล้ว</span>}</span></div>
            <div className="rowb"><span style={{color:'var(--ink-3)'}}>งานนอก · {B(j.pay)}</span></div>
          </div>;})}
      </>:tab==='roster'?<>
        <div className="lbl">ตารางงานประจำของร้าน</div>
        <p style={{fontSize:12,color:'var(--ink-3)'}}>ตั้งครั้งเดียว ระบบสร้างล่วงหน้าให้หัวคิวจัดคน</p>
        {myRoster.length===0&&<Empty>ยังไม่มีงานประจำ</Empty>}
        {myRoster.map(r=>{const d=jobDef(r.type);const asg=st.workers.find(x=>x.id===r.assigned);
          return <div className="jobc" key={r.id}>
            <div className="jt"><span className="e">{d.e}</span><div><b>{d.th} · {r.time} น.</b><div className="my">{r.days.map(i=>DOW[i]).join(' ')}</div></div></div>
            <div className="rowb"><span style={{color:'var(--ink-3)'}}>หัวคิวจัดคน</span>{asg?<b style={{color:'var(--brand)'}}>👷 {asg.name}</b>:<span className="tag q">รอจัดคน</span>}</div>
          </div>;})}
        <button className="btn ghost" onClick={()=>setAddR(true)}>＋ ตั้งงานประจำใหม่</button>
      </>:tab==='log'?<LogTab st={st} up={up} settle={settle} setAddLog={setAddLog}/>:null}
      {addMk&&<AddMarketSheet onAdd={(m)=>{up(s=>s.markets.push(m));setMid(m.id);setAddMk(false);flash('เพิ่มตลาดแล้ว');}} onClose={()=>setAddMk(false)}/>}
      {review&&<ReviewSheet worker={review} onSave={saveReview} onClose={()=>setReview(null)}/>}
      {addLog&&<LogSheet winsHere={winsHere} workers={st.workers} onSave={saveLog} onClose={()=>setAddLog(false)}/>}
      {addR&&<RosterSheet markets={st.markets} mid={mid} onAdd={(r)=>{up(s=>s.roster.push({id:uid('r'),shop:MESHOP.name,market_id:mid,win_id:winsHere[0]&&winsHere[0].id,assigned:null,...r}));setAddR(false);flash('เพิ่มงานประจำแล้ว');}} onClose={()=>setAddR(false)}/>}
    </div></>;
}
window.Shop=Shop;

/* ── จอทะเบียนตลาด (directory · เคลม bottom-up → top-down) ── */
function MarketDir({st,up,flash}){
  const claim=(id)=>{ const o=prompt('ชื่อผู้ดูแล/บริษัทตลาด (เคลมความเป็นเจ้าของ)'); if(!o)return; up(s=>{const m=s.markets.find(x=>x.id===id);if(m){m.claimed=true;m.owner=o;}}); flash('เคลมตลาดแล้ว'); };
  return <><Hd bg="#1f2a24" s1="ทะเบียนตลาดกลาง" s2="Directory · ปักหมุดจากล่าง"/>
    <div className="body">
      <div className="card" style={{background:'var(--brand-soft)',fontSize:12.5}}>ตลาด <b>ไม่ต้องสมัคร</b> ก็เริ่มใช้ได้ — market_id คือ “โค้ดสถานที่” · เจ้าของตลาดเข้ามาเคลมทีหลังเพื่อดูภาพรวม (bottom-up → top-down)</div>
      {st.markets.map(m=>{const wins=st.wins.filter(w=>w.market_id===m.id).length;const wk=st.workers.filter(w=>w.market_id===m.id).length;
        return <div className="jobc" key={m.id}>
          <div className="jt"><span className="e">🏛️</span><div><b>{m.name}</b><div className="my">{m.code} · 📍 {m.lat.toFixed(3)}, {m.lng.toFixed(3)}</div></div>
            <span style={{marginLeft:'auto'}} className={'tag '+(m.claimed?'work':'free')}>{m.claimed?'เคลมแล้ว':'ยังว่าง'}</span></div>
          <div className="rowb"><span style={{color:'var(--ink-3)'}}>{wins} วิน · {wk} แรงงาน</span>{m.claimed?<b style={{fontSize:12}}>👤 {m.owner}</b>:<button className="minibtn" onClick={()=>claim(m.id)}>เคลมตลาดนี้</button>}</div>
        </div>;})}
    </div></>;
}
window.MarketDir=MarketDir;
