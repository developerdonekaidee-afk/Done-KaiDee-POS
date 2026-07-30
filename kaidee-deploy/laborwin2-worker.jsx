/* laborwin2-worker.jsx — จอแรงงาน: 2 สวิตช์อิสระ + โหมดเวลา + 3 สถานะ + ค่าคอมงานนอก */
function WkSwitch({on,disabled,color,emoji,title,sub,onToggle}){
  return <div className={'wsw'+(on?' on':'')+(disabled?' dis':'')} style={on?{'--c':color}:{}} onClick={()=>!disabled&&onToggle()}>
    <span className="e">{emoji}</span>
    <div className="tx"><b>{title}</b><span>{sub}</span></div>
    <span className={'knob'+(on?' on':'')} style={on?{background:color}:{}}></span>
  </div>;
}

function TermsModal({rate,onAgree,onClose}){
  const [ck,setCk]=useState(false);
  return <div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mh">เปิดรับงานนอกครั้งแรก</div>
    <p className="mp">งานนอก (open pool) = งานจากร้านทั่วทุกตลาด กดรับเอง <b>ไม่ผ่านหัวคิว</b> · หัวคิวเห็นแค่ยอดรวม ไม่เห็นรายละเอียดงาน/ร้าน/คน</p>
    <div className="tbox"><b>เงื่อนไขค่าคอมหัวหน้าวิน</b><ul>
      <li>ทุกบิลงานนอกหัก <b>{Math.round(rate*100)}%</b> เข้าหัวคิว (ขั้นต่ำ {B(COMM_FLOOR)}/บิล)</li>
      <li>เป็นค่าสังกัดวินคุ้มครอง · หัวคิวไม่เห็นว่าคุณรับงานอะไร ที่ไหน</li>
      <li>ปรับสถานะเป็น “ฟรีแลนซ์ล้วน” = ไม่หัก แต่ไม่มีวินคุ้มครอง</li>
    </ul></div>
    <label className="ckrow"><input type="checkbox" checked={ck} onChange={e=>setCk(e.target.checked)}/> ฉันอ่านและยอมรับเงื่อนไขค่าคอมหัวหน้าวิน</label>
    <button className="btn" disabled={!ck} onClick={onAgree}>ยอมรับ & เปิดงานนอก</button>
    <button className="reset" onClick={onClose}>ยกเลิก</button>
  </div></div>;
}

/* งานนอก (open pool · GPS · ผูก backend จริงถ้ามี) */
function OutsidePool({w,st,up,flash,t}){
  const [loc,setLoc]=useState(null),[busy,setBusy]=useState(false);
  const mine=st.openPool.find(j=>j.worker===MEW&&j.status!=='done');
  const share=async()=>{ setBusy(true); const l=await lw2geo(); setLoc(l);
    if(window.PLAT_API){try{await PLAT_API.poolWorker({id:MEW,name:w.name,available:true,lat:l.lat,lng:l.lng,lang:w.lang},'pool');}catch(e){}}
    setBusy(false); };
  const take=(j)=>{ up(s=>{const x=s.openPool.find(o=>o.id===j.id);if(x){x.status='accepted';x.worker=MEW;}}); flash('รับงานนอกแล้ว · หัวคิวไม่เห็นงานนี้'); };
  const cash=(j)=>{ up(s=>{const x=s.openPool.find(o=>o.id===j.id);if(x){x.status='done';x.paidAt=Date.now();
    if(w.status==='both'&&w.win_id){ const c=winComm(x.pay,(s.wins.find(v=>v.id===w.win_id)||{}).commRate); x.comm=c; const wn=s.wins.find(v=>v.id===w.win_id); if(wn)wn.gp+=c; }}}); flash('รับเงินแล้ว · หัก'+t.comm); };
  const open=st.openPool.filter(j=>j.status==='open');
  if(mine){ const d=jobDef(mine.type); const c=w.status==='both'?winComm(mine.pay,(st.wins.find(v=>v.id===w.win_id)||{}).commRate):0;
    return <div className="jobc" style={{border:'2px solid var(--blue)'}}>
      <div className="jt"><span className="e">{d.e}</span><div><b>{d.th}</b><div className="my">{mine.shopName}</div></div><span className="tag" style={{marginLeft:'auto',background:'var(--blue-soft)',color:'var(--blue)'}}>{mine.status==='accepted'?t.going:t.working}</span></div>
      <div className="rowb"><span style={{color:'var(--ink-3)'}}>{t.wage}</span><b>{B(mine.pay)}</b></div>
      {c>0&&<div className="rowb"><span style={{color:'var(--ink-3)'}}>{t.comm}</span><span style={{color:'var(--red)'}}>-{B(c)}</span></div>}
      {c>0&&<div className="rowb"><b>{t.net}</b><b style={{color:'var(--brand)'}}>{B(mine.pay-c)}</b></div>}
      <button className="btn" style={{background:'var(--blue)'}} onClick={()=>cash(mine)}>{t.getcash} · จบงาน</button>
    </div>;
  }
  return <>
    <div className="rowb card" style={{borderLeft:'3px solid var(--blue)'}}><b>🔵 {t.outside}</b><span style={{fontSize:11,color:'var(--ink-3)'}}>หัวคิวไม่เห็น 🙈</span></div>
    {!loc&&<button className="btn ghost" onClick={share} disabled={busy}>{busy?'กำลังหาพิกัด…':'📍 แชร์พิกัด · ดูงานทุกตลาดในรัศมี'}</button>}
    {open.length===0&&<Empty>ยังไม่มีงานนอกตอนนี้<br/>ให้ร้าน (แท็บแม่ค้า) กด “ลงงานนอก / open pool”</Empty>}
    {open.map(j=>{const d=jobDef(j.type);const c=w.status==='both'?winComm(j.pay,(st.wins.find(v=>v.id===w.win_id)||{}).commRate):0;const mk=st.markets.find(m=>m.id===j.market_id);
      return <div className="jobc" key={j.id} style={{border:'2px solid var(--blue)'}}>
        <div className="jt"><span className="e">{d.e}</span><div><b>{d.th}</b><div className="my">{j.shopName} · {mk?mk.name:'—'}</div></div></div>
        <div className="rowb"><span style={{color:'var(--ink-3)'}}>{t.wage}</span><b style={{fontSize:19,color:'var(--brand)'}}>{B(j.pay)}</b></div>
        {c>0&&<div className="rowb"><span style={{color:'var(--ink-3)'}}>{t.comm} ({Math.round(((st.wins.find(v=>v.id===w.win_id)||{}).commRate||COMM_DEFAULT)*100)}%)</span><span style={{color:'var(--red)'}}>-{B(c)}</span></div>}
        <button className="btn" style={{background:'var(--blue)'}} onClick={()=>take(j)}>🔵 {t.take}</button>
      </div>;})}
  </>;
}

function Worker({st,up,flash}){
  const w=st.workers.find(x=>x.id===MEW);
  const [lang,setLang]=useState(w.lang||'th');
  const [tab,setTab]=useState('jobs');
  const [terms,setTerms]=useState(false);
  const t=WORKER_T[lang];
  const nowStr=HHMM();
  const eff=effSwitches(w,nowStr);
  const win=st.wins.find(v=>v.id===w.win_id);
  const wset=win?winSet(win):DEF_SET;
  const outsideBlocked=win&&!wset.outsideOn&&w.status!=='free';
  if(outsideBlocked)eff.outside=false;
  const disp=win?wset.dispatch:'auto';
  const setW=(patch)=>up(s=>{Object.assign(s.workers.find(x=>x.id===MEW),patch);});
  const toggleMarket=()=>{ if(w.timeMode==='auto')return; setW({marketOn:!w.marketOn, ...(w.lockOverlap&&!w.marketOn?{outsideOn:false}:{})}); };
  const toggleOutside=()=>{ if(w.timeMode==='auto'||w.status==='win'||w.status==='free'||outsideBlocked)return;
    if(!w.outsideOn&&!w.acceptedTerms){ setTerms(true); return; }
    setW({outsideOn:!w.outsideOn, ...(w.lockOverlap&&!w.outsideOn?{marketOn:false}:{})}); };
  const agreeTerms=()=>{ setTerms(false); setW({acceptedTerms:true,outsideOn:true, ...(w.lockOverlap?{marketOn:false}:{})}); flash('เปิดงานนอกแล้ว'); };
  const reqAdvance=()=>{ const s=prompt('ขอเบิกล่วงหน้าเท่าไร? (เพดาน '+B(wset.advanceCap)+' · หนี้เดิม '+B(w.debt)+')'); const amt=Math.round(Number(s)); if(!amt||amt<=0)return; if(w.debt+amt>wset.advanceCap){flash('เกินเพดานเบิก');return;} setW({advanceReq:amt}); flash('ส่งคำขอเบิกให้หัวหน้าวินแล้ว'); };

  /* งานในวิน */
  const bl=Object.values(st.shopPrefs||{}).some(p=>(p.blacklist||[]).includes(MEW));
  const offers=st.winQueue.filter(j=>j.win_id===w.win_id&&j.status==='queued'&&(j.assignTo?j.assignTo===MEW:disp==='auto')&&!(bl&&j.shopName===MESHOP.name));
  const myRoster=st.roster.filter(r=>r.assigned===MEW);
  const myInst=(st.rosterInstances||[]).filter(x=>x.assigned===MEW).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.time<b.time?-1:1));
  const myStars=avgStars(w);
  const headPct=Math.round(headCutOf(win)*100);
  const mineWin=st.winQueue.find(j=>j.worker===MEW&&(j.status==='accepted'||j.status==='working'));
  const accept=(id)=>{ up(s=>{const j=s.winQueue.find(x=>x.id===id);if(j){j.status='accepted';j.worker=MEW;}}); flash('รับงานในตลาดแล้ว'); };
  const reject=(id)=>{ up(s=>{const j=s.winQueue.find(x=>x.id===id);if(j){j.status='queued';j.rejected=true;}}); flash('ส่งงานให้คิวถัดไป'); };
  const arrive=(id)=>{ up(s=>{const j=s.winQueue.find(x=>x.id===id);if(j)j.status='working';}); };

  const langBar=<div className="lang">{['th','my','kh'].map(l=><b key={l} className={lang===l?'on':''} onClick={()=>{setLang(l);setW({lang:l});}}>{l.toUpperCase()}</b>)}</div>;

  if(mineWin){ const d=jobDef(mineWin.type);
    return <><Hd bg="var(--green)" s1={(win?win.dot+' '+win.name:'')+' · '+w.name} s2={mineWin.status==='accepted'?t.going+' '+st.lock:t.working}>{langBar}</Hd>
      <div className="body"><div className="status">
        <div className="big">{mineWin.status==='accepted'?'🗺️':'💪'}</div>
        <div className="t">{d.e} {d.th} · {B(mineWin.price)}</div>
        <div className="card" style={{width:'100%'}}>{t.lock} <b>{st.lock}</b> · แผนที่จำลอง</div>
        {mineWin.status==='accepted'?<button className="btn" style={{background:'var(--green)'}} onClick={()=>arrive(mineWin.id)}>ถึงแล้ว · เริ่มงาน</button>
          :<div className="s">{t.getcash} {B(mineWin.price)} — รอแม่ค้ากดจบงาน</div>}
      </div></div></>;
  }

  return <><Hd bg="#1f2a24" s1={(win?win.dot+' '+win.name:'ฟรีแลนซ์')+' · '+w.name} s2={WK_STATUS[w.status].th}>{langBar}</Hd>
    <div className="body">
      <Seg items={[['jobs','🧾 งาน'],['sw','🎚️ สวิตช์'],['deals','🎁 ดีล'],['me','👤 ฉัน']]} val={tab} set={setTab}/>
      {tab==='deals'?(window.KDSponsorFeed?<window.KDSponsorFeed mod="labor" limit={6} title="🎁 ดีลใกล้คุณ"/>:<div className="card" style={{fontSize:12.5,color:'var(--ink-3)'}}>ยังไม่มีดีลตอนนี้</div>):tab==='sw'?<>
        <div className="lbl">2 สวิตช์อิสระ (หัวคิวเห็นแค่ “พร้อม/ไม่พร้อม” งานตลาด · งานนอกไม่เห็นเลย)</div>
        <WkSwitch on={eff.market} disabled={w.timeMode==='auto'} color="var(--green)" emoji="🟢" title={t.market} sub={eff.market?t.ready:t.notready} onToggle={toggleMarket}/>
        <WkSwitch on={eff.outside} disabled={w.timeMode==='auto'||w.status==='win'||w.status==='free'||outsideBlocked} color="var(--blue)" emoji="🔵" title={t.outside} sub={outsideBlocked?'หัวหน้าวินปิดงานนอก':w.status==='win'?'ปิด (สังกัดวินอย่างเดียว)':(eff.outside?'เปิด':'ปิด')} onToggle={toggleOutside}/>
        <div className="lbl" style={{marginTop:4}}>โหมดเวลา (ส่วนตัว · หัวคิวไม่เห็น)</div>
        <Seg items={[['auto',t.timeauto],['manual',t.timeman]]} val={w.timeMode} set={(m)=>setW({timeMode:m})}/>
        {w.timeMode==='auto'&&<div className="card" style={{fontSize:13}}>
          <div className="rowb"><span>ช่วงงานตลาด</span><span><input className="tin" type="time" value={w.schedFrom||'04:00'} onChange={e=>setW({schedFrom:e.target.value})}/> – <input className="tin" type="time" value={w.schedTo||'08:00'} onChange={e=>setW({schedTo:e.target.value})}/></span></div>
          <div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:6}}>ในช่วง = งานตลาดเปิด/งานนอกปิด · พ้นช่วง = งานนอกเปิด · ตอนนี้ {nowStr} → {eff.market?'🟢 งานตลาด':'🔵 งานนอก'}</div>
        </div>}
        <label className="ckrow"><input type="checkbox" checked={!!w.lockOverlap} onChange={e=>setW({lockOverlap:e.target.checked})}/> 🔒 ล็อกไม่ให้ซ้อน (เปิดได้ทีละงาน · แนะนำ)</label>
        <div className="lbl" style={{marginTop:4}}>สถานะแรงงาน</div>
        <div className="paysel">{Object.entries(WK_STATUS).map(([k,v])=><div key={k} className={'p'+(w.status===k?' on':'')} onClick={()=>setW({status:k})}>
          <div><b style={{fontSize:13.5}}>{v.th}{v.badge&&<span className="mini">{v.badge}</span>}</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{v.s}</div></div><span className="r"></span></div>)}</div>
      </>:tab==='me'?<>
        <div className="card"><div className="rowb"><b>👤 {w.name}</b><span className="mini2">{win?win.dot+' '+win.name:'ฟรีแลนซ์'}</span></div>
          <div className="rowb" style={{marginTop:4}}><span style={{fontSize:12,color:'var(--ink-3)'}}>สถานะ: {WK_STATUS[w.status].th}</span>{myStars>0?<span style={{fontSize:12}}><StarRow v={myStars}/> {myStars.toFixed(1)} <span style={{color:'var(--ink-3)'}}>({(w.ratings||[]).length})</span></span>:<span style={{fontSize:11.5,color:'var(--ink-3)'}}>ยังไม่มีรีวิว</span>}</div></div>
        <div className="lbl">รายได้</div>
        <div className="row">
          <div className="card" style={{flex:1,textAlign:'center'}}><div style={{fontSize:11,color:'var(--ink-3)'}}>จ่ายสะสม</div><b style={{fontSize:17,color:'var(--brand)'}}>{B(w.paidTotal)}</b></div>
          <div className="card" style={{flex:1,textAlign:'center'}}><div style={{fontSize:11,color:'var(--ink-3)'}}>รอรับ</div><b style={{fontSize:17,color:'var(--gold)'}}>{B(w.pending)}</b></div>
          <div className="card" style={{flex:1,textAlign:'center'}}><div style={{fontSize:11,color:'var(--ink-3)'}}>ค้างเบิก</div><b style={{fontSize:17,color:w.debt>0?'var(--red)':'var(--ink-3)'}}>{B(w.debt)}</b></div>
        </div>
        {wset.advanceOn&&w.status!=='free'&&(w.advanceReq>0?<div className="tag q" style={{display:'block',textAlign:'center',padding:'10px'}}>⏳ ขอเบิก {B(w.advanceReq)} — รอหัวหน้าวินอนุมัติ</div>
          :<button className="btn gold" onClick={reqAdvance} disabled={w.debt>=wset.advanceCap}>{w.debt>=wset.advanceCap?'เต็มเพดานเบิกแล้ว':'💵 ขอเบิกล่วงหน้า'}</button>)}
        <div className="lbl" style={{marginTop:4}}>งานประจำของฉัน (รู้ล่วงหน้า)</div>
        {myInst.length>0?myInst.map(r=>{const d=jobDef(r.type);return <div className="jobc" key={r.id} style={{borderLeft:'3px solid var(--green)'}}>
          <div className="jt"><span className="e">{d.e}</span><div><b>{instLabel(r.date)} · {r.time} น.</b><div className="my">{d.th} · {r.shop}</div></div><span className="tag free" style={{marginLeft:'auto'}}>📅 นัดแล้ว</span></div></div>;})
          :myRoster.length===0?<Empty>ยังไม่มีงานประจำที่ถูกมอบหมาย<br/>หัวหน้าวินจัดคนจากตารางร้าน</Empty>
          :myRoster.map(r=>{const d=jobDef(r.type);return <div className="jobc" key={r.id} style={{borderLeft:'3px solid var(--green)'}}>
            <div className="jt"><span className="e">{d.e}</span><div><b>{d.th} · {r.time} น.</b><div className="my">{r.shop} · {r.days.map(i=>DOW[i]).join(' ')}</div></div></div></div>;})}
      </>:<>
        {eff.market&&<>
          <div className="rowb card" style={{borderLeft:'3px solid var(--green)'}}><b>🟢 {t.market}</b><span className="tag free">{t.ready}</span></div>
          {offers.length===0&&<div className="status" style={{padding:'18px 0'}}><div className="big">⏳</div><div className="s">{t.waiting}<br/><span style={{fontSize:12}}>แตะแท็บ “แม่ค้า” เพื่อเรียกงานเข้าคิว</span></div></div>}
          {offers.map(j=>{const d=jobDef(j.type);const c=Math.round(j.price*headCutOf(win));
            return <div className="jobc" key={j.id} style={{border:'2px solid var(--green)'}}>
              <div className="jt"><span className="e">{d.e}</span><div><b>{d.th}</b><div className="my">{d[lang]||d.my}</div></div></div>
              <div className="rowb"><span style={{color:'var(--ink-3)'}}>{t.wage}</span><b style={{fontSize:19,color:'var(--brand)'}}>{B(j.price)}</b></div>
              <div className="rowb"><span style={{color:'var(--ink-3)'}}>ค่าคิววิน {headPct}%</span><span style={{color:'var(--red)'}}>-{B(c)}</span></div>
              <div className="timer">⏱️ {t.answer}</div>
              <div className="btn2"><div className="b" style={{background:'var(--red)'}} onClick={()=>reject(j.id)}>🔴 {t.reject}</div><div className="b" style={{background:'var(--green)'}} onClick={()=>accept(j.id)}>🟢 {t.accept}</div></div>
            </div>;})}
        </>}
        {eff.outside&&<div style={{marginTop:eff.market?6:0}}><OutsidePool w={w} st={st} up={up} flash={flash} t={t}/></div>}
        {!eff.market&&!eff.outside&&<Empty>ปิดรับงานทั้งหมด<br/>ไปแท็บ “สวิตช์/เวลา” เพื่อเปิด</Empty>}
      </>}
      {terms&&<TermsModal rate={(win&&win.commRate)||COMM_DEFAULT} onAgree={agreeTerms} onClose={()=>setTerms(false)}/>}
    </div></>;
}
window.Worker=Worker;
