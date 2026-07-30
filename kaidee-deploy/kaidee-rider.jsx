// kaidee-rider.jsx — Rider (Grab-style) app: available jobs, active delivery, earnings
const { useState:rState } = React;

const jobFromOrder = (o)=>({
  id:o.id, shop:'ครัวขายดี', from:'ซ.ลาดพร้าว 71', to:o.addr||'ลูกค้า',
  dist:2.5, fee:o.fee||calcFare(2.5), mins:15, items:o.items.reduce((a,[,q])=>a+q,0),
  pay:o.pay, total:o.total, storeOrder:true, no:o.no, phone:o.phone||'', lat:(o.lat!=null?o.lat:null), lng:(o.lng!=null?o.lng:null),
});

function RiderActive({ j, onComplete }){
  const { lang } = useT(); const TH=lang==='th';
  const [proof,setProof] = rState(null);
  const pick=(e)=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>setProof(r.result); r.readAsDataURL(f); };
  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        {j.phone && <a href={`tel:${j.phone}`} className="kd-btn" style={{ flex:1, padding:'11px', fontSize:13, background:'var(--brand-soft)', color:'var(--brand-ink)', textDecoration:'none', justifyContent:'center' }}>{React.cloneElement(IC.phone,{size:15})} {TH?'โทรลูกค้า':'Call'}</a>}
        {j.lat!=null && <a href={navUrl(j.lat,j.lng)} target="_blank" rel="noopener" className="kd-btn" style={{ flex:1, padding:'11px', fontSize:13, background:'var(--accent-soft)', color:'var(--accent-ink)', textDecoration:'none', justifyContent:'center' }}>{React.cloneElement(IC.pin,{size:15})} {TH?'นำทาง':'Navigate'}</a>}
      </div>
      {proof
        ? <div style={{ position:'relative', marginBottom:10 }}><img src={proof} alt="proof" style={{ width:'100%', borderRadius:12, maxHeight:160, objectFit:'cover', display:'block' }}/><button onClick={()=>setProof(null)} style={{ position:'absolute', top:6, right:6, border:'none', background:'rgba(0,0,0,.5)', color:'#fff', borderRadius:999, width:28, height:28, cursor:'pointer' }}>✕</button></div>
        : <label style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, border:'1.6px dashed var(--hair-2)', borderRadius:12, padding:'16px', color:'var(--ink-3)', cursor:'pointer', marginBottom:10, fontSize:13, textAlign:'center' }}>📷 {TH?'ถ่ายรูปหลักฐานการส่ง (ลูกค้าจะเห็น)':'Delivery photo proof'}<input type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={pick}/></label>}
      <button onClick={()=>onComplete(proof)} disabled={!proof} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:14, opacity:proof?1:0.5 }}>{React.cloneElement(IC.check,{size:18})} {TH?'ส่งสำเร็จ':'Complete delivery'}</button>
    </div>
  );
}

/* ══════════════ JOB CARD ══════════════ */
function JobCard({ j, onAccept, active, onComplete }){
  const { t, lang } = useT();
  return (
    <div className="kd-card kd-fadein" style={{ padding:15, marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <span className="kd-chip">{React.cloneElement(IC.bag,{size:13})} {j.items} {lang==='th'?'ชิ้น':'items'}</span>
        <span className="kd-chip" style={{ background:'var(--bg)', color:'var(--ink-2)' }}>{React.cloneElement(IC.clock,{size:12})} ~{j.mins} {lang==='th'?'นาที':'min'}</span>
        <span style={{ marginLeft:'auto', textAlign:'right' }}>
          <div className="num" style={{ fontSize:20, fontWeight:700, color:'var(--brand-ink)' }}>+{money(j.fee)}</div>
          <div style={{ fontSize:11, color:'var(--ink-3)' }}>{lang==='th'?`ฐาน ฿${FARE.base} + ${j.dist} กม.`:`base ฿${FARE.base} + ${j.dist} km`}</div>
        </span>
      </div>
      {/* route */}
      <div style={{ display:'flex', gap:12 }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', paddingTop:4 }}>
          <span style={{ width:11, height:11, borderRadius:999, background:'var(--brand)' }}/>
          <span style={{ width:2, flex:1, minHeight:22, background:'var(--hair-2)', margin:'3px 0' }}/>
          <span style={{ color:'var(--danger)' }}>{React.cloneElement(IC.pin,{size:15})}</span>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:12, color:'var(--ink-3)' }}>{lang==='th'?'รับที่':'Pick up'}</div>
            <div style={{ fontSize:14.5, fontWeight:600 }}>{j.shop}</div>
            <div style={{ fontSize:12.5, color:'var(--ink-2)' }}>{j.from}</div>
          </div>
          <div>
            <div style={{ fontSize:12, color:'var(--ink-3)' }}>{lang==='th'?'ส่งที่':'Drop off'} · {j.dist} กม.</div>
            <div style={{ fontSize:14.5, fontWeight:600 }}>{j.to}</div>
          </div>
        </div>
      </div>
      {/* payment note */}
      <div style={{ display:'flex', alignItems:'center', gap:8, margin:'12px 0', padding:'9px 12px', background:'var(--bg)', borderRadius:12 }}>
        {React.cloneElement(PAYS[j.pay].ic,{size:16, color:'var(--ink-2)'})}
        <span style={{ fontSize:13, fontWeight:600, color:'var(--ink-2)' }}>{PAYS[j.pay][lang]||PAYS[j.pay].th}</span>
        {j.pay==='cod' && <span style={{ marginLeft:'auto', fontSize:13, fontWeight:700, color:'var(--accent)' }} className="num">{lang==='th'?'เก็บ':'collect'} {money(j.total)}</span>}
      </div>
      {active
        ? <RiderActive j={j} onComplete={onComplete}/>
        : <button onClick={onAccept} className="kd-btn kd-btn-dark kd-btn-block" style={{ padding:14 }}>{lang==='th'?'รับงานนี้':'Accept job'}</button>}
    </div>
  );
}

/* ══════════════ RIDER SHELL ══════════════ */
function RiderApp({ store }){
  const { t, lang } = useT();
  const [tab,setTab] = rState('new');
  const [online,setOnline] = rState(true);
  const [acceptedIds,setAcc] = rState([]);
  const [done,setDone] = rState([]);   // [{fee, to, time}]
  const [signup,setSignup] = rState(false);
  const toast = useToast();

  // available = seed jobs + store delivery orders ready/delivering, minus accepted/done
  const storeJobs = store.orders.filter(o=>o.channel==='delivery' && (o.status==='ready'||o.status==='delivering') && o.status!=='done').map(jobFromOrder);
  const doneIds = done.map(d=>d.id);
  const pool = [...storeJobs, ...RIDER_JOBS].filter((j,i,arr)=> arr.findIndex(x=>x.id===j.id)===i);
  const available = pool.filter(j=> !acceptedIds.includes(j.id) && !doneIds.includes(j.id));
  const active = pool.filter(j=> acceptedIds.includes(j.id) && !doneIds.includes(j.id));

  const accept = (j)=>{
    setAcc(p=>[...p, j.id]);
    if(j.storeOrder) store.setOrders(prev=>prev.map(o=>o.id===j.id?{...o,status:'delivering'}:o));
    setTab('my'); toast.show(lang==='th'?'รับงานแล้ว! 🛵':'Job accepted! 🛵');
  };
  const complete = (j, proof)=>{
    setDone(p=>[...p,{ id:j.id, fee:j.fee, to:j.to, time:new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) }]);
    if(j.storeOrder) store.setOrders(prev=>prev.map(o=>o.id===j.id?{...o,status:'done', proof:proof||o.proof, deliveredAt:Date.now()}:o));
    toast.show(lang==='th'?`ส่งสำเร็จ +${money(j.fee)} 🎉`:`Delivered +${money(j.fee)} 🎉`);
  };

  const todayEarn = done.reduce((a,d)=>a+d.fee,0);

  return (
    <>
      <div style={{ position:'absolute', inset:0, bottom:74 }}>
        {tab==='new' && (
          <div className="kd-screen">
            <TopBar title={t('newJobs')}
              right={<button onClick={()=>setOnline(!online)} style={{ border:'none', cursor:'pointer', padding:'8px 14px', borderRadius:999,
                fontFamily:'var(--font)', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:6,
                background: online?'var(--brand-soft)':'#F1EEEE', color: online?'var(--brand-ink)':'var(--ink-3)' }}>
                <span style={{ width:9, height:9, borderRadius:999, background: online?'var(--brand)':'var(--ink-3)' }}/>{online?(lang==='th'?'ออนไลน์':'Online'):(lang==='th'?'ออฟไลน์':'Offline')}</button>}/>
            {/* mini map banner */}
            <div style={{ margin:'0 16px 14px', height:100, borderRadius:16, position:'relative', overflow:'hidden', background:'linear-gradient(160deg,#E7F6EF,#DCEFE5)' }}>
              <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(18,165,110,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(18,165,110,.08) 1px,transparent 1px)', backgroundSize:'22px 22px' }}/>
              <div style={{ position:'absolute', left:16, bottom:14, color:'var(--brand)' }}>{React.cloneElement(IC.moto,{size:26})}</div>
              <div style={{ position:'absolute', right:16, top:14, fontSize:12, fontWeight:700, color:'var(--ink-2)', background:'#fff', padding:'5px 10px', borderRadius:999, boxShadow:'var(--shadow)' }}>
                {available.length} {lang==='th'?'งานรอบตัวคุณ':'jobs near you'}</div>
            </div>
            <div className="kd-body" style={{ padding:'0 16px 24px' }}>
              {!online ? <div style={{ textAlign:'center', color:'var(--ink-3)', padding:'50px 20px' }}>{lang==='th'?'เปิดออนไลน์เพื่อรับงาน':'Go online to get jobs'}</div>
                : available.length===0 ? <Empty/>
                : available.map(j=><JobCard key={j.id} j={j} onAccept={()=>accept(j)}/>)}
            </div>
          </div>
        )}
        {tab==='my' && (
          <div className="kd-screen">
            <TopBar title={t('myJobs')} sub={active.length?`${active.length} ${lang==='th'?'งานกำลังส่ง':'in progress'}`:''}/>
            <div className="kd-body" style={{ padding:'0 16px 24px' }}>
              {active.length===0 ? <div style={{ textAlign:'center', color:'var(--ink-3)', padding:'50px 20px' }}>
                <div style={{ fontSize:38, marginBottom:8 }}>🛵</div>{lang==='th'?'ยังไม่มีงานที่รับ':'No active jobs'}</div>
                : active.map(j=><JobCard key={j.id} j={j} active onComplete={(proof)=>complete(j,proof)}/>)}
            </div>
          </div>
        )}
        {tab==='earn' && (
          <div className="kd-screen">
            <TopBar title={t('earnings')} sub={t('today')}/>
            <div className="kd-body" style={{ padding:'0 16px 24px' }}>
              <div className="kd-card" style={{ padding:'20px 18px', background:'linear-gradient(135deg,#1B2420,#2E3B34)', color:'#fff', marginBottom:14 }}>
                <div style={{ fontSize:13, opacity:.8, fontWeight:600 }}>{lang==='th'?'รายได้วันนี้':'Today\u2019s earnings'}</div>
                <div className="num" style={{ fontSize:38, fontWeight:700, margin:'3px 0 8px' }}>{money(todayEarn)}</div>
                <div style={{ display:'flex', gap:16, fontSize:13, opacity:.9 }}>
                  <span>{React.cloneElement(IC.check,{size:14,style:{verticalAlign:'-2px'}})} {done.length} {lang==='th'?'งานสำเร็จ':'trips'}</span>
                  <span>{React.cloneElement(IC.moto,{size:14,style:{verticalAlign:'-2px'}})} {(done.length*2.6).toFixed(1)} กม.</span>
                </div>
              </div>
              <div style={{ display:'flex', gap:11, marginBottom:16 }}>
                <Stat label={lang==='th'?'ต่อรอบเฉลี่ย':'Avg / trip'} value={money(done.length?Math.round(todayEarn/done.length):0)}/>
                <Stat label={lang==='th'?'โบนัส':'Bonus'} value={money(done.length>=3?50:0)} tone="var(--accent)" sub={lang==='th'?'ครบ 3 รอบ':'3+ trips'}/>
              </div>
              <div style={{ fontSize:14, fontWeight:700, margin:'0 4px 10px' }}>{lang==='th'?'ประวัติวันนี้':'Today\u2019s trips'}</div>
              {done.length===0 ? <Empty/> : done.slice().reverse().map((d,i)=>(
                <div key={i} className="kd-card" style={{ padding:'13px 15px', marginBottom:9, display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:38, height:38, borderRadius:11, background:'var(--brand-soft)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.check,{size:18})}</div>
                  <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.to}</div>
                    <div style={{ fontSize:12, color:'var(--ink-3)' }}>{d.time}</div></div>
                  <div className="num" style={{ fontWeight:700, color:'var(--brand-ink)' }}>+{money(d.fee)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab==='prof' && (
          <div className="kd-screen">
            <TopBar title={t('profile')}/>
            <div className="kd-body" style={{ padding:16 }}>
              <div className="kd-card" style={{ padding:18, display:'flex', gap:14, alignItems:'center', marginBottom:14 }}>
                <div style={{ width:56, height:56, borderRadius:999, background:'var(--ink)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.moto,{size:26})}</div>
                <div><div style={{ fontWeight:700, fontSize:17 }}>สมชาย ไรเดอร์</div>
                  <div style={{ fontSize:13, color:'var(--ink-3)' }}>{React.cloneElement(IC.star,{size:13,color:'var(--accent)',fill:'var(--accent)',style:{verticalAlign:'-2px'}})} 4.9 · {lang==='th'?'ฮอนด้า เวฟ กข 1234':'Honda Wave'}</div></div>
              </div>
              {/* apply to be a rider */}
              <button onClick={()=>setSignup(true)} className="kd-card" style={{ border:'none', cursor:'pointer', width:'100%', textAlign:'left',
                display:'flex', gap:13, alignItems:'center', padding:'15px 16px', marginBottom:14, background:'linear-gradient(135deg,#1B2420,#2E3B34)', color:'#fff' }}>
                <span style={{ width:40, height:40, borderRadius:12, background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.edit,{size:20})}</span>
                <div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:15 }}>{lang==='th'?'สมัครเป็นไรเดอร์':'Become a rider'}</div>
                  <div style={{ fontSize:12, opacity:.8, marginTop:2 }}>{lang==='th'?'กรอกข้อมูล + เอกสาร มาตรฐานเดียวกับ Grab':'Full onboarding · Grab standard'}</div></div>
                <span style={{ opacity:.7 }}>{IC.chev}</span>
              </button>
              {[[IC.wallet,lang==='th'?'กระเป๋าเงิน · ถอนเงิน':'Wallet · withdraw'],[IC.pin,lang==='th'?'โซนที่รับงาน':'Work zones'],[IC.clock,lang==='th'?'ประวัติงาน':'Trip history'],[IC.bell,lang==='th'?'การแจ้งเตือน':'Notifications']].map(([ic,l],i)=>(
                <div key={i} className="kd-card" style={{ padding:'15px 16px', display:'flex', alignItems:'center', gap:13, marginBottom:9 }}>
                  <span style={{ color:'var(--brand)' }}>{ic}</span><span style={{ flex:1, fontWeight:600 }}>{l}</span><span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{ position:'absolute', left:0, right:0, bottom:0 }}>
        <TabBar active={tab} onChange={setTab} tabs={[
          { key:'new',  label:t('newJobs'),  icon:IC.moto, badge: online?available.length:0 },
          { key:'my',   label:t('myJobs'),   icon:IC.bag, badge:active.length },
          { key:'earn', label:t('earnings'), icon:IC.wallet },
          { key:'prof', label:t('profile'),  icon:IC.user },
        ]}/>
      </div>
      {signup && <RiderSignup onClose={()=>setSignup(false)} />}
      {toast.node}
    </>
  );
}

/* ══════════════ RIDER SIGNUP (Grab-standard onboarding) ══════════════ */
function RSect({ n, title, sub }){
  return <div style={{ margin:'22px 4px 12px', display:'flex', alignItems:'center', gap:10 }}>
    <span style={{ width:24, height:24, borderRadius:999, background:'var(--brand)', color:'#fff', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{n}</span>
    <div><div style={{ fontSize:15, fontWeight:700 }}>{title}</div>{sub && <div style={{ fontSize:12, color:'var(--ink-3)' }}>{sub}</div>}</div>
  </div>;
}
function RField({ label, children, req }){
  return <div style={{ marginBottom:12 }}>
    <div style={{ fontSize:13, fontWeight:600, color:'var(--ink-2)', margin:'0 2px 6px' }}>{label}{req && <span style={{ color:'var(--danger)' }}> *</span>}</div>
    {children}</div>;
}
function DocSlot({ label, hint }){
  const [img,setImg] = rState(null);
  return (
    <label style={{ display:'block', cursor:'pointer', marginBottom:10 }}>
      <div className="kd-card" style={{ padding:'13px 15px', display:'flex', alignItems:'center', gap:12, boxShadow:'none',
        background: img?'var(--brand-soft)':'#fff', border: img?'1.5px solid var(--brand)':'1.5px dashed var(--hair-2)' }}>
        {img
          ? <div style={{ width:44, height:44, borderRadius:9, backgroundImage:`url(${img})`, backgroundSize:'cover', backgroundPosition:'center', flexShrink:0 }}/>
          : <span style={{ width:44, height:44, borderRadius:9, background:'var(--bg)', color:'var(--ink-3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{React.cloneElement(IC.scan,{size:20})}</span>}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600 }}>{label}</div>
          <div style={{ fontSize:12, color: img?'var(--brand-ink)':'var(--ink-3)', marginTop:2 }}>{img?React.cloneElement(IC.check,{size:12,style:{verticalAlign:'-2px'}}):null} {img?'อัปโหลดแล้ว':hint}</div>
        </div>
      </div>
      <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ const file=e.target.files&&e.target.files[0]; if(!file)return; const r=new FileReader(); r.onload=ev=>setImg(ev.target.result); r.readAsDataURL(file); }}/>
    </label>
  );
}
function RiderSignup({ onClose }){
  const { t, lang } = useT();
  const [f,setF] = rState({ vehicle:'moto', gender:'ชาย', zone:'ลาดพร้าว–รัชดา' });
  const [agree,setAgree] = rState(false);
  const [sent,setSent] = rState(false);
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const TH = lang==='th';

  if(sent) return (
    <div style={{ position:'absolute', inset:0, zIndex:72, background:'#fff', display:'flex', flexDirection:'column', animation:'kdFade .25s' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:26, gap:14, textAlign:'center' }}>
        <div className="kd-pop" style={{ width:88, height:88, borderRadius:999, background:'var(--brand-soft)', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.check,{size:46, color:'var(--brand)', stroke:2.6})}</div>
        <div style={{ fontSize:22, fontWeight:700 }}>{TH?'ส่งใบสมัครแล้ว':'Application submitted'}</div>
        <div style={{ color:'var(--ink-2)', fontSize:14, lineHeight:1.6, maxWidth:280 }}>{TH?'ทีมงานจะตรวจสอบเอกสารภายใน 1–3 วันทำการ และแจ้งผลผ่าน SMS/แอป จากนั้นนัดอบรมและรับกระเป๋า':'We\u2019ll verify your documents within 1–3 business days and notify you via SMS/app.'}</div>
        <div className="kd-card" style={{ padding:'12px 16px', background:'var(--brand-softer)', boxShadow:'none', fontSize:13, color:'var(--brand-ink)', fontWeight:600, marginTop:4 }}>{TH?'เลขที่ใบสมัคร':'Application no.'} · RD{Math.floor(Math.random()*90000+10000)}</div>
      </div>
      <div style={{ padding:'0 20px calc(20px + 8px)' }}><button onClick={onClose} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:16 }}>{TH?'เสร็จสิ้น':'Done'}</button></div>
    </div>
  );

  return (
    <div style={{ position:'absolute', inset:0, zIndex:72, background:'var(--bg)', display:'flex', flexDirection:'column', animation:'kdFade .25s' }}>
      <div style={{ paddingTop:56, background:'var(--brand)', color:'#fff' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 18px 16px' }}>
          <button onClick={onClose} style={{ border:'none', background:'rgba(255,255,255,.22)', color:'#fff', width:36, height:36, borderRadius:999, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.back,{size:22})}</button>
          <div style={{ flex:1 }}><div style={{ fontSize:20, fontWeight:700 }}>{TH?'สมัครเป็นไรเดอร์':'Rider application'}</div>
            <div style={{ fontSize:12.5, opacity:.85, marginTop:1 }}>{TH?'กรอกข้อมูลให้ครบตามมาตรฐาน':'Complete all required fields'}</div></div>
        </div>
      </div>
      <div className="kd-body" style={{ padding:'0 18px 26px' }}>
        <RSect n="1" title={TH?'ข้อมูลส่วนตัว':'Personal info'}/>
        <RField label={TH?'ชื่อ–นามสกุล':'Full name'} req><input className="kd-input" value={f.name||''} onChange={e=>upd('name',e.target.value)} placeholder={TH?'ตามบัตรประชาชน':'As on ID'}/></RField>
        <RField label={TH?'เลขบัตรประชาชน (13 หลัก)':'National ID (13 digits)'} req><input className="kd-input num" maxLength={13} value={f.nid||''} onChange={e=>upd('nid',e.target.value.replace(/\D/g,''))} placeholder="x-xxxx-xxxxx-xx-x"/></RField>
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ flex:1 }}><RField label={TH?'วันเกิด':'Date of birth'} req><input className="kd-input num" type="date" value={f.dob||''} onChange={e=>upd('dob',e.target.value)}/></RField></div>
          <div style={{ flex:1 }}><RField label={TH?'เพศ':'Gender'}>
            <div style={{ display:'flex', gap:6 }}>{[TH?'ชาย':'M',TH?'หญิง':'F'].map((g,i)=>{ const val=['ชาย','หญิง'][i]; return (
              <button key={g} onClick={()=>upd('gender',val)} style={{ flex:1, border:'none', cursor:'pointer', padding:'12px 0', borderRadius:12, fontFamily:'var(--font)', fontWeight:600, fontSize:14, background: f.gender===val?'var(--brand)':'#fff', color: f.gender===val?'#fff':'var(--ink-2)', boxShadow: f.gender===val?'none':'var(--shadow)' }}>{g}</button>
            );})}</div></RField></div>
        </div>
        <RField label={TH?'เบอร์โทรศัพท์':'Phone'} req><input className="kd-input num" value={f.phone||''} onChange={e=>upd('phone',e.target.value)} placeholder="08x-xxx-xxxx"/></RField>
        <RField label={TH?'อีเมล':'Email'}><input className="kd-input" value={f.email||''} onChange={e=>upd('email',e.target.value)} placeholder="you@email.com"/></RField>
        <RField label={TH?'ที่อยู่ปัจจุบัน':'Current address'}><textarea className="kd-input" rows={2} style={{ resize:'none' }} value={f.addr||''} onChange={e=>upd('addr',e.target.value)}/></RField>

        <RSect n="2" title={TH?'ยานพาหนะ':'Vehicle'}/>
        <RField label={TH?'ประเภทรถ':'Vehicle type'} req>
          <div style={{ display:'flex', gap:8 }}>{[['moto',IC.moto,TH?'มอเตอร์ไซค์':'Motorcycle'],['car',IC.truck,TH?'รถยนต์':'Car'],['bike',IC.moto,TH?'จักรยาน':'Bicycle']].map(([k,ic,l])=>(
            <button key={k} onClick={()=>upd('vehicle',k)} className="kd-card" style={{ flex:1, border: f.vehicle===k?'2px solid var(--brand)':'2px solid transparent', cursor:'pointer', padding:'12px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:5, fontFamily:'var(--font)' }}>
              {React.cloneElement(ic,{size:22, color: f.vehicle===k?'var(--brand)':'var(--ink-3)'})}<span style={{ fontSize:12, fontWeight:600, color: f.vehicle===k?'var(--brand-ink)':'var(--ink-2)' }}>{l}</span></button>
          ))}</div></RField>
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ flex:2 }}><RField label={TH?'ยี่ห้อ / รุ่น':'Brand / model'} req><input className="kd-input" value={f.model||''} onChange={e=>upd('model',e.target.value)} placeholder={TH?'เช่น Honda Wave 110':'e.g. Honda Wave'}/></RField></div>
          <div style={{ flex:1 }}><RField label={TH?'ทะเบียน':'Plate'} req><input className="kd-input" value={f.plate||''} onChange={e=>upd('plate',e.target.value)} placeholder="กข 1234"/></RField></div>
        </div>

        <RSect n="3" title={TH?'เอกสารประกอบ':'Documents'} sub={TH?'ถ่ายรูปให้ชัด อ่านออกทุกตัวอักษร':'Clear, readable photos'}/>
        <DocSlot label={TH?'บัตรประชาชน':'National ID card'} hint={TH?'แตะเพื่ออัปโหลด':'Tap to upload'}/>
        <DocSlot label={TH?'ใบขับขี่':'Driving licence'} hint={TH?'แตะเพื่ออัปโหลด':'Tap to upload'}/>
        <DocSlot label={TH?'ทะเบียนรถ':'Vehicle registration'} hint={TH?'แตะเพื่ออัปโหลด':'Tap to upload'}/>
        <DocSlot label={TH?'พ.ร.บ. / ประกันภัย':'Insurance (พ.ร.บ.)'} hint={TH?'แตะเพื่ออัปโหลด':'Tap to upload'}/>
        <DocSlot label={TH?'รูปถ่ายหน้าตรง / เซลฟี่คู่บัตร':'Selfie with ID'} hint={TH?'แตะเพื่ออัปโหลด':'Tap to upload'}/>
        <DocSlot label={TH?'หน้าสมุดบัญชีธนาคาร':'Bank book cover'} hint={TH?'แตะเพื่ออัปโหลด':'Tap to upload'}/>

        <RSect n="4" title={TH?'บัญชีรับเงิน':'Payout account'}/>
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ flex:1 }}><RField label={TH?'ธนาคาร':'Bank'} req><input className="kd-input" value={f.bank||''} onChange={e=>upd('bank',e.target.value)} placeholder={TH?'กสิกรไทย':'Bank'}/></RField></div>
          <div style={{ flex:1 }}><RField label={TH?'เลขบัญชี':'Account no.'} req><input className="kd-input num" value={f.acct||''} onChange={e=>upd('acct',e.target.value)}/></RField></div>
        </div>

        <RSect n="5" title={TH?'พื้นที่ & ผู้ติดต่อฉุกเฉิน':'Zone & emergency'}/>
        <RField label={TH?'โซนที่สะดวกรับงาน':'Preferred zone'}><input className="kd-input" value={f.zone||''} onChange={e=>upd('zone',e.target.value)}/></RField>
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ flex:1 }}><RField label={TH?'ผู้ติดต่อฉุกเฉิน':'Emergency contact'}><input className="kd-input" value={f.emg||''} onChange={e=>upd('emg',e.target.value)}/></RField></div>
          <div style={{ flex:1 }}><RField label={TH?'เบอร์ฉุกเฉิน':'Emergency phone'}><input className="kd-input num" value={f.emgPhone||''} onChange={e=>upd('emgPhone',e.target.value)}/></RField></div>
        </div>

        <div className="kd-card" style={{ padding:'13px 15px', background:'var(--brand-softer)', boxShadow:'none', marginTop:8, marginBottom:2 }}>
          <div style={{ fontSize:13.5, fontWeight:700, marginBottom:6 }}>{TH?'เงื่อนไขการรับงาน':'Job terms'}</div>
          {[TH?'รับงานแล้วต้องส่งให้เสร็จ — ยกเลิกบ่อยมีผลต่อการรับงาน':'Finish accepted jobs — frequent cancels affect access',TH?'ต้องแนบรูปหลักฐานตอนกดส่งสำเร็จทุกครั้ง':'Photo proof required on every completion',TH?'ค่ารอบจ่ายตามที่ร้านกำหนด (ต่อรอบ / โอนสิ้นวัน)':'Payout follows the shop setting (per trip / end of day)'].map((x,i)=>(
            <div key={i} style={{ fontSize:12.5, color:'var(--ink-2)', display:'flex', gap:7, marginBottom:4, lineHeight:1.45 }}><span style={{ color:'var(--brand)' }}>•</span><span>{x}</span></div>
          ))}
        </div>
        <label style={{ display:'flex', gap:10, alignItems:'flex-start', margin:'12px 2px', cursor:'pointer' }}>
          <span onClick={()=>setAgree(!agree)} style={{ width:24, height:24, borderRadius:7, flexShrink:0, border: agree?'none':'2px solid var(--hair-2)', background: agree?'var(--brand)':'#fff', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', marginTop:1 }}>{agree && React.cloneElement(IC.check,{size:16, stroke:3})}</span>
          <span style={{ fontSize:13, color:'var(--ink-2)', lineHeight:1.5 }}>{TH?'ยอมรับข้อตกลงพาร์ทเนอร์ไรเดอร์ ยินยอมให้ตรวจสอบประวัติและข้อมูลเอกสาร':'I accept the rider partner terms and consent to background & document verification.'}</span>
        </label>
      </div>
      <div style={{ padding:'10px 18px 0' }}>
        <button onClick={()=>agree&&f.name&&setSent(true)} disabled={!agree||!f.name}
          className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:16, opacity:(agree&&f.name)?1:.5 }}>{TH?'ส่งใบสมัคร':'Submit application'}</button>
      </div>
    </div>
  );
}

Object.assign(window, { RiderApp, JobCard, jobFromOrder, RiderSignup });
