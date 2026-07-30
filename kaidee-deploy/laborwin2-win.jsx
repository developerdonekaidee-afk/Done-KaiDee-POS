/* laborwin2-win.jsx — จอหัวหน้าวิน:
   • หลายโมเดลรับเงิน (หัวคิวรับตรง=leader / รับจากแรงงาน=direct) เลือกได้
   • Leader Wallet + จ่ายลูกทีม + เบิกล่วงหน้า/หักคืน
   • จัดคิวเอง (manual) / ออโต้ · เห็นงานตลาด binary · GP ยอดรวม · ⚠️ ไม่เห็นงานนอก */
function Win({st,up,flash}){
  const [tab,setTab]=useState('team');
  const win=st.wins.find(v=>v.id===MEWIN);
  const set=winSet(win);
  const myWorkers=st.workers.filter(w=>w.win_id===MEWIN);
  const workingIds=new Set(st.winQueue.filter(j=>j.win_id===MEWIN&&(j.status==='accepted'||j.status==='working')).map(j=>j.worker));
  const roster=st.roster.filter(r=>r.win_id===MEWIN);
  const insts=(st.rosterInstances||[]).filter(x=>x.win_id===MEWIN).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.time<b.time?-1:1));
  const unassigned=st.winQueue.filter(j=>j.win_id===MEWIN&&j.status==='queued'&&!j.assignTo);
  const advReqs=myWorkers.filter(w=>w.advanceReq>0);
  const owed=myWorkers.reduce((a,w)=>a+(w.pending||0),0);
  const nowStr=HHMM();

  const withdraw=()=>{ up(s=>{const w=s.wins.find(v=>v.id===MEWIN);if(w)w.gp=0;}); flash('ถอน GP เข้าบัญชีแล้ว'); };
  const setRate=(r)=>up(s=>{const w=s.wins.find(v=>v.id===MEWIN);if(w)w.commRate=clampRate(r);});
  const setHead=(r)=>up(s=>{const w=s.wins.find(v=>v.id===MEWIN);if(w)w.headCut=r;});
  const setS=(patch)=>up(s=>{const w=s.wins.find(v=>v.id===MEWIN);w.settings={...winSet(w),...patch};});
  const assignRoster=(rid,wid)=>up(s=>{const r=s.roster.find(x=>x.id===rid);if(r)r.assigned=wid||null;});
  const assignInstance=(id,wid)=>up(s=>{const x=(s.rosterInstances||[]).find(i=>i.id===id);if(x)x.assigned=wid||null;});
  const makeInstances=()=>{ up(s=>{genRoster(s,7);}); flash('สร้างตารางล่วงหน้า 7 วันแล้ว · จัดคนได้เลย'); };
  const assignJob=(jid,wid)=>up(s=>{const j=s.winQueue.find(x=>x.id===jid);if(j)j.assignTo=wid||null;});
  const payWorker=(wid)=>{ let net=0; up(s=>{const w=s.wins.find(v=>v.id===MEWIN);const wk=s.workers.find(x=>x.id===wid);const pay=wk.pending;if(pay<=0)return;const repay=Math.min(wk.debt,Math.round(pay*REPAY_RATE));wk.debt-=repay;wk.pending=0;wk.paidTotal+=(pay-repay);w.wallet-=pay;net=pay-repay;}); flash('จ่ายลูกทีมแล้ว'+(net?' '+B(net):'')); };
  const approveAdv=(wid)=>{ up(s=>{const wk=s.workers.find(x=>x.id===wid);const cap=winSet(s.wins.find(v=>v.id===MEWIN)).advanceCap;const amt=Math.max(0,Math.min(wk.advanceReq,cap-wk.debt));wk.debt+=amt;wk.advanceReq=0;}); flash('อนุมัติเบิก (จ่ายสดให้แรงงาน)'); };
  const denyAdv=(wid)=>{ up(s=>{s.workers.find(x=>x.id===wid).advanceReq=0;}); flash('ปฏิเสธคำขอเบิก'); };

  const Toggle=({on,onChange})=><span className={'knob'+(on?' on':'')} style={on?{background:'var(--brand)'}:{}} onClick={onChange}></span>;

  return <><Hd bg="#1f2a24" s1={win.dot+' หัวหน้า'+win.name+' · '+(st.markets.find(m=>m.id===win.market_id)||{}).name} s2="แดชบอร์ด">
      <span style={{position:'absolute',top:16,right:15,fontSize:10.5,fontWeight:700,background:'rgba(255,255,255,.16)',color:'#fff',padding:'4px 9px',borderRadius:8}}>{WAGE_MODES[set.wageMode].th}</span></Hd>
    <div className="body">
      <div className="card" style={{background:'#1f2a24',color:'#fff'}}>
        <div className="rowb"><div><div style={{fontSize:11,opacity:.75}}>GP วิน สะสม (ยอดรวมเท่านั้น 🙈)</div><div className="big-in">{B(win.gp)}</div></div>
          {set.wageMode==='leader'&&<div style={{textAlign:'right'}}><div style={{fontSize:11,opacity:.75}}>ค้างจ่ายลูกทีม</div><div style={{fontSize:22,fontWeight:800,color:'#ffd27a'}}>{B(owed)}</div></div>}</div>
      </div>
      <Seg items={[['team','👷 คิว/คน'],['wallet','💰 เงิน'],['roster','📅 จัดคน'],['pkg','🎫 แพ็กเกจ'],['set','⚙️ ตั้งค่า']]} val={tab} set={setTab}/>

      {tab==='team'?<>
        {set.dispatch==='manual'&&<>
          <div className="lbl">จัดคิวเอง — งานรอมอบหมาย ({unassigned.length})</div>
          {unassigned.length===0&&<Empty>ไม่มีงานรอจัด · ให้ร้านกดเรียกงาน</Empty>}
          {unassigned.map(j=>{const d=jobDef(j.type);
            return <div className="jobc" key={j.id}>
              <div className="jt"><span className="e">{d.e}</span><div><b>{d.th} · {B(j.price)}</b><div className="my">{j.shopName}</div></div></div>
              <select className="sel" value="" onChange={e=>{if(e.target.value)assignJob(j.id,e.target.value);}}>
                <option value="">— มอบหมายให้ —</option>{myWorkers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select></div>;})}
        </>}
        <div className="lbl">แรงงานในวิน — เห็นแค่ “พร้อม/ไม่พร้อม” งานตลาด (งานนอกไม่แสดง)</div>
        {myWorkers.map(w=>{const eff=effSwitches(w,nowStr);const working=workingIds.has(w.id);const av=avgStars(w);
          return <div className="rowb card" key={w.id}>
            <div><b>👷 {w.name}</b> <span className="mini2">{w.status==='both'?'วิน+นอก':w.status==='win'?'วินอย่างเดียว':'ฟรีแลนซ์'}</span>{av>0&&<div style={{fontSize:11,marginTop:2}}><StarRow v={av}/> {av.toFixed(1)}</div>}</div>
            {working?<span className="tag work">ทำงาน · {st.lock}</span>:eff.market?<span className="tag free">🟢 พร้อม</span>:<span className="tag done">⚪ ไม่พร้อม</span>}
          </div>;})}
      </>:tab==='wallet'?<>
        {set.wageMode==='leader'?<>
          <div className="card"><div className="rowb"><span style={{color:'var(--ink-3)',fontSize:12.5}}>👛 Leader Wallet (ถือแทนลูกทีม)</span><b style={{fontSize:20,color:'var(--brand)'}}>{B(win.wallet)}</b></div></div>
          <div className="lbl">จ่ายค่าแรงลูกทีม (หักคืนเบิก {Math.round(REPAY_RATE*100)}%/ครั้ง)</div>
          {myWorkers.filter(w=>w.pending>0||w.debt>0).length===0&&<Empty>ยังไม่มียอดค้างจ่าย</Empty>}
          {myWorkers.filter(w=>w.pending>0||w.debt>0).map(w=>{const repay=Math.min(w.debt,Math.round(w.pending*REPAY_RATE));
            return <div className="jobc" key={w.id}>
              <div className="rowb"><b>👷 {w.name}</b><span className="tag q">ค้างจ่าย {B(w.pending)}</span></div>
              {w.debt>0&&<div className="rowb"><span style={{color:'var(--ink-3)'}}>หนี้เบิกล่วงหน้า</span><span style={{color:'var(--red)'}}>{B(w.debt)}</span></div>}
              {w.pending>0&&<button className="btn" onClick={()=>payWorker(w.id)}>จ่าย {B(w.pending-repay)}{repay>0?' (หักคืนเบิก '+B(repay)+')':''}</button>}
            </div>;})}
        </>:<div className="card" style={{fontSize:12.5,color:'var(--ink-2)'}}>โหมด <b>รับจากแรงงาน</b> — ร้านจ่ายแรงงานตรง · หัวคิวเก็บแค่ค่าคิว {Math.round(headCutOf(win)*100)}% เข้า GP · ไม่มี Leader Wallet</div>}

        {set.advanceOn&&advReqs.length>0&&<><div className="lbl" style={{marginTop:4}}>คำขอเบิกล่วงหน้า</div>
          {advReqs.map(w=><div className="jobc" key={w.id}>
            <div className="rowb"><b>👷 {w.name} ขอเบิก</b><b style={{color:'var(--gold)'}}>{B(w.advanceReq)}</b></div>
            <div style={{fontSize:11.5,color:'var(--ink-3)'}}>หนี้เดิม {B(w.debt)} · เพดาน {B(set.advanceCap)}</div>
            <div className="btn2"><div className="b" style={{background:'var(--ink-3)'}} onClick={()=>denyAdv(w.id)}>ปฏิเสธ</div><div className="b" style={{background:'var(--brand)'}} onClick={()=>approveAdv(w.id)}>อนุมัติ (จ่ายสด)</div></div>
          </div>)}</>}
        <button className="btn dark" disabled={win.gp===0} onClick={withdraw}>💳 ถอน GP {B(win.gp)} เข้าบัญชี</button>
        <div style={{fontSize:11.5,color:'var(--ink-3)',textAlign:'center'}}>Ledger โปร่งใส 2 ฝั่ง — กันหักซ้ำ/เบิกเกิน · เงินสดหัวหน้าวินเอง แอปเป็นสมุดบัญชี</div>
      </>:tab==='pkg'?<WinPlan win={win} up={up} flash={flash} nWorkers={myWorkers.length}/>
      :tab==='roster'?<>
        <div className="lbl">ตารางงานประจำในตลาด — จัดคนล่วงหน้า</div>
        {roster.length===0&&<Empty>ยังไม่มีงานประจำ<br/>(ร้านตั้งจากแท็บแม่ค้า)</Empty>}
        {roster.map(r=>{const d=jobDef(r.type);
          return <div className="jobc" key={r.id}>
            <div className="jt"><span className="e">{d.e}</span><div><b>{d.th} · {r.time} น.</b><div className="my">{r.shop} · {r.days.map(i=>DOW[i]).join(' ')}</div></div></div>
            <div className="rowb"><span style={{color:'var(--ink-3)'}}>คนประจำ (ทุก instance)</span>
              <select className="sel" value={r.assigned||''} onChange={e=>assignRoster(r.id,e.target.value)}>
                <option value="">— เลือกคน —</option>{myWorkers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select></div>
          </div>;})}
        {roster.length>0&&<button className="btn ghost" onClick={makeInstances}>🗓️ สร้างตารางล่วงหน้า 7 วัน</button>}
        {insts.length>0&&<><div className="lbl" style={{marginTop:6}}>ตารางล่วงหน้า (แต่ละวัน · กำหนดคนรายวันได้)</div>
          {insts.map(x=>{const d=jobDef(x.type);
            return <div className="rowb card" key={x.id}>
              <div><b style={{fontSize:12.5}}>{instLabel(x.date)} · {x.time}</b><div className="my">{d.e} {d.th} · {x.shop}</div></div>
              <select className="sel" style={{maxWidth:120}} value={x.assigned||''} onChange={e=>assignInstance(x.id,e.target.value)}>
                <option value="">— คน —</option>{myWorkers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select></div>;})}</>}
      </>:<>
        <div className="lbl">โมเดลรับเงินค่าแรง (แต่ละตลาดต่างกัน · เลือกได้)</div>
        <div className="paysel">{Object.entries(WAGE_MODES).map(([k,v])=><div key={k} className={'p'+(set.wageMode===k?' on':'')} onClick={()=>setS({wageMode:k})}>
          <div><b style={{fontSize:13.5}}>{v.th}{v.badge&&<span className="mini">{v.badge}</span>}</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{v.s}</div></div><span className="r"></span></div>)}</div>

        <div className="lbl" style={{marginTop:4}}>การจ่ายคิว</div>
        <Seg items={[['auto','ออโต้ 60 วิ'],['manual','หัวหน้าวินจัดเอง']]} val={set.dispatch} set={(m)=>setS({dispatch:m})}/>
        <div className="lbl" style={{marginTop:4}}>โหมดรับเงิน (แอปแตะเงินไหม)</div>
        <Seg items={[['cash','💵 เงินสด'],['promptpay','💳 PromptPay'],['wallet','👛 wallet']]} val={set.payTouch} set={(m)=>setS({payTouch:m})}/>
        {window.KDReceivePanel&&window.KDW&&<div style={{margin:'10px 0'}}><window.KDReceivePanel biz={window.KDW.biz('labor',win.id)} who={'วิน '+win.name} acctLabel="หัวหน้าวิน"/></div>}

        <div className="card">
          <div className="rowb"><span>ค่าคิวงานตลาด (หัวคิว)</span><b style={{color:'var(--brand)'}}>{Math.round(headCutOf(win)*100)}%</b></div>
          <input className="slider" type="range" min="5" max="20" step="1" value={Math.round(headCutOf(win)*100)} onChange={e=>setHead(Number(e.target.value)/100)}/>
          <div className="rowb"><span>ค่าคอมงานนอก (GP วิน)</span><b style={{color:'var(--brand)'}}>{Math.round(win.commRate*100)}%</b></div>
          <input className="slider" type="range" min={COMM_MIN*100} max={COMM_MAX*100} step="1" value={Math.round(win.commRate*100)} onChange={e=>setRate(Number(e.target.value)/100)}/>
          <div style={{fontSize:11,color:'var(--ink-3)'}}>งานนอกขั้นต่ำ {B(COMM_FLOOR)}/บิล · ตัวอย่าง {B(120)} → {B(winComm(120,win.commRate))}</div>
        </div>

        <div className="rowb card"><div><b style={{fontSize:13.5}}>เปิดให้ลูกทีมรับงานนอก</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>ปิด = สังกัดวินอย่างเดียว</div></div><Toggle on={set.outsideOn} onChange={()=>setS({outsideOn:!set.outsideOn})}/></div>
        <div className="rowb card"><div><b style={{fontSize:13.5}}>เบิกล่วงหน้า (advance)</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>เพดาน/คน {B(set.advanceCap)}</div></div><Toggle on={set.advanceOn} onChange={()=>setS({advanceOn:!set.advanceOn})}/></div>
        <div className="rowb card"><div><b style={{fontSize:13.5}}>ทีมประจำ (Preferred)</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>ร้านกดเรียกเจ้าเดิม</div></div><Toggle on={set.preferredOn} onChange={()=>setS({preferredOn:!set.preferredOn})}/></div>
      </>}
      <button className="reset" onClick={()=>{if(confirm('ล้างข้อมูล Labor Win v2 กลับค่าเริ่มต้น?')){localStorage.removeItem(LW2_LS);location.reload();}}}>↻ รีเซ็ตเดโม</button>
    </div></>;
}
/* ══ แพ็กเกจระบบของวิน — จ่ายจากกระเป๋าเงินกลาง (KDW) · ไม่ต้องผูกบัตร ══ */
const WIN_TIERS=[
  {id:'free',th:'ทดลองใช้',price:0,cap:5,sub:'ลูกทีมได้ถึง 5 คน · คิวงานพื้นฐาน'},
  {id:'start',th:'วินเริ่มต้น',price:199,cap:15,sub:'จัดตารางล่วงหน้า · เบิกล่วงหน้า · รายงาน'},
  {id:'pro',th:'วินโปร',price:499,cap:60,sub:'ครบทุกอย่าง · งานนอกตลาด · หลายหัวหน้าคิว'},
];
function WinPlan({win,up,flash,nWorkers}){
  const [cycle,setCycle]=useState((win.plan&&win.plan.cycle)||'mo');
  const [wTick,setWTick]=useState(0);
  const KDW=window.KDW, WP=window.KDWalletPanel;
  const bizId=KDW?KDW.biz('labor',win.id):'';
  const cur=(win.plan&&win.plan.tier)||'free';
  const priceOf=(t)=>cycle==='yr'?t.price*10:t.price;
  const curT=WIN_TIERS.find(t=>t.id===cur)||WIN_TIERS[0];
  const due=priceOf(curT);
  const exp=win.plan&&win.plan.expiry?new Date(win.plan.expiry):null;
  const choose=async(tid)=>{ const t=WIN_TIERS.find(x=>x.id===tid); const amt=priceOf(t);
    if(amt>0){ if(!KDW){ flash('กระเป๋าเงินยังไม่พร้อม'); return; }
      const res=await KDW.charge(bizId,amt,{who:'วิน '+win.name,sub:'ค่าบริการระบบวิน '+t.th+(cycle==='yr'?' (รายปี)':' (รายเดือน)'),type:'fee',idem:'winplan:'+tid+':'+cycle+':'+new Date().toISOString().slice(0,7)});
      setWTick(x=>x+1);
      if(!res.ok){ flash(res.short>0?('ยอดกระเป๋าไม่พอ · ขาดอีก '+B(res.short)):res.error); return; } }
    const days=cycle==='yr'?365:30;
    const base=exp&&exp>new Date()?new Date(exp):new Date(); base.setDate(base.getDate()+days);
    up(s=>{ const w=s.wins.find(v=>v.id===win.id); if(w) w.plan={tier:tid,cycle,since:Date.now(),expiry:base.toISOString()}; });
    flash(amt>0?('✅ ชำระแพ็ก '+t.th+' แล้ว · หักจากกระเป๋า'):('เปลี่ยนเป็น '+t.th+' แล้ว')); };
  return <>
    {WP?<div key={wTick} style={{marginBottom:12}}><WP biz={bizId} who={'วิน '+win.name} due={due||undefined}
      dueLabel={due?('ค่าบริการระบบ '+curT.th+(cycle==='yr'?' · รายปี':' · รายเดือน')):undefined} onChange={()=>setWTick(x=>x+1)}/></div>
      :<div className="card" style={{fontSize:12.5,color:'var(--ink-3)'}}>ยังไม่ได้โหลดกระเป๋าเงิน (kd-wallet.jsx)</div>}
    <div className="lbl">รอบชำระ</div>
    <Seg items={[['mo','รายเดือน'],['yr','รายปี · ฟรี 2 เดือน']]} val={cycle} set={setCycle}/>
    <div className="lbl" style={{marginTop:4}}>แพ็กระบบวิน · ลูกทีมตอนนี้ {nWorkers} คน{exp?' · ใช้ได้ถึง '+exp.toLocaleDateString('th-TH',{day:'numeric',month:'short'}):''}</div>
    {WIN_TIERS.map(t=>{ const on=t.id===cur; const over=nWorkers>t.cap;
      return <div className="card" key={t.id} style={on?{border:'2px solid var(--brand)'}:{}}>
        <div className="rowb"><div><b style={{fontSize:14}}>{t.th}{on&&<span className="mini">ใช้อยู่</span>}</b>
          <div style={{fontSize:11.5,color:'var(--ink-3)'}}>{t.sub}</div></div>
          <div style={{textAlign:'right'}}><b style={{fontSize:17}}>{t.price?B(priceOf(t)):'ฟรี'}</b>{t.price?<div style={{fontSize:10.5,color:'var(--ink-3)'}}>{cycle==='yr'?'/ปี':'/เดือน'}</div>:null}</div></div>
        <div style={{fontSize:12,margin:'6px 0 9px'}}>ลูกทีมได้ถึง <b>{t.cap} คน</b></div>
        <button className="btn dark" disabled={over} onClick={()=>choose(t.id)}>{over?('ลูกทีมเกินเพดานแพ็กนี้'):(on?'ต่ออายุแพ็กนี้':(t.price?'หักกระเป๋า · เริ่มใช้แพ็กนี้':'ใช้แพ็กทดลอง'))}</button>
      </div>; })}
    <div style={{fontSize:11.5,color:'var(--ink-3)',textAlign:'center',padding:'2px 6px 4px'}}>ไม่ต้องผูกบัตร · เติมเงินกระเป๋าแล้วระบบตัดค่าบริการเองเมื่อครบรอบ · บัตรเครดิตรองรับแล้วแต่ยังไม่เปิด</div>
  </>;
}
Object.assign(window,{Win,WinPlan,WIN_TIERS});
