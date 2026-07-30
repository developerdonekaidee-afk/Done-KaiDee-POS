// fitness-pos-app.jsx — root: bottom tabs (owner) + member lens · ทำงานจริง localStorage
const { useState:useStateA } = React;
(function(){
const F=window.FIT; const H=window.fitHelpers; const {memberStatus}=F;
const OWNER_TABS=[['dash','ภาพรวม','📊'],['sell','ขาย','🧾'],['members','สมาชิก','🎫'],['sales','ทีมขาย','🎯'],['dayclose','เปิด/ปิดวัน','🔓'],['report','รายงาน','📈'],['more','เพิ่มเติม','⋯']];
// หน้างานตามตำแหน่ง — พนักงานแต่ละตำแหน่งเปิดแอปแล้วเจอแท็บของงานตัวเอง (ปรับเพิ่ม/ลดได้ที่สิทธิ์รายคน)
const ROLE_TABS={
  trainer:[['mytrain','ลูกเทรน','🏋️'],['classes','คลาส','🗓️'],['checkin','เช็คอิน','🚪'],['more','เพิ่มเติม','⋯']],
  staff:[['sell','ขาย','🧾'],['members','สมาชิก','🎫'],['checkin','เช็คอิน','🚪'],['more','เพิ่มเติม','⋯']],
  sales:[['dash','ภาพรวม','📊'],['sales','ทีมขาย','🎯'],['members','สมาชิก','🎫'],['sell','ขาย','🧾'],['more','เพิ่มเติม','⋯']],
};
const TAB_PERM={mytrain:'trainplan',classes:'classes',checkin:'checkin'};
const SUB_TITLE={classes:'คลาส & ตาราง',pt:'เทรนเนอร์ PT',checkin:'เช็คอินหน้าประตู',stock:'สินค้า & สต๊อก',packages:'แพ็กเกจสมาชิก',staff:'ทะเบียนพนักงาน',vouchers:'Voucher & บัตรกำนัล',paymatch:'จับยอดพร้อมเพย์',promos:'โปรโมชั่น & ยิงแอด'};
const TAB_TITLE={dash:'ภาพรวม',sell:'หน้าขาย (POS)',members:'สมาชิก & ต่ออายุ',dayclose:'เปิด/ปิดวัน',report:'รายงานสรุป',more:'เพิ่มเติม'};
const L_TABS={dash:['ภาพรวม','Overview'],sell:['ขาย','Sell'],members:['สมาชิก','Members'],sales:['ทีมขาย','Sales'],dayclose:['เปิด/ปิดวัน','Day'],report:['รายงาน','Reports'],more:['เพิ่มเติม','More'],mytrain:['ลูกเทรน','My clients'],classes:['คลาส','Classes'],checkin:['เช็คอิน','Check-in']};
const L_SUB={ginfo:['ข้อมูลฟิตเนส','Gym info'],classes:['คลาส & ตาราง','Classes'],pt:['เทรนเนอร์ PT','Trainers'],checkin:['เช็คอินหน้าประตู','Check-in'],newgym:['ลบฟิตเนส & เริ่มสร้างใหม่','Delete & start over'],stock:['สินค้า & สต๊อก','Stock'],packages:['แพ็กเกจสมาชิก','Packages'],staff:['ทะเบียนพนักงาน','Staff'],vouchers:['Voucher & บัตรกำนัล','Vouchers'],paymatch:['จับยอดพร้อมเพย์','Match Pay'],promos:['โปรโมชั่น & ยิงแอด','Promotions'],trainplan:['ลูกเทรน & ตารางเทรน','Training plans'],health:['ค่าร่างกาย & PAR-Q','Body & PAR-Q'],plan:['แพ็กโปรแกรม & โควต้า','Plan & Quota'],kds:['จอครัว (KDS)','Kitchen (KDS)'],board:['จอคิวหน้าร้าน','Queue Board']};
const L_TAB={dash:['ภาพรวม','Overview'],sell:['หน้าขาย (POS)','Sell (POS)'],members:['สมาชิก & ต่ออายุ','Members & Renew'],sales:['ทีมขาย · โอกาสขาย','Sales · Opportunities'],dayclose:['เปิด/ปิดวัน','Open/Close Day'],report:['รายงานสรุป','Reports'],more:['เพิ่มเติม','More'],mytrain:['ลูกเทรนของฉัน','My clients'],classes:['คลาส & ตาราง','Classes'],checkin:['เช็คอินหน้าประตู','Check-in']};
const docBase=()=>location.pathname.replace(/[^/]*$/,'');

function App(){
  const [data,setData0]=useStateA(()=>{ let dd=window.ensureStaff?window.ensureStaff(F.load()):F.load(); if(new URLSearchParams(location.search).get('sales')){ const sp=(dd.staff||[]).find(s=>s.role==='sales'); if(sp) dd={...dd,currentStaffId:sp.id}; } return dd; });
  const [lens,setLens]=useStateA(()=>{ const p=new URLSearchParams(location.search); return (p.get('claim')==='1'||p.get('member')==='1')?'member':'owner'; });
  const [tab,setTab]=useStateA(()=>{ const p=new URLSearchParams(location.search); if(p.get('sales'))return 'sales'; return p.get('checkin')?'more':'dash'; });
  const [sub,setSub]=useStateA(()=>new URLSearchParams(location.search).get('checkin')?'checkin':null);
  const [memberId,setMemberId]=useStateA(()=>{ const d=F.load(); return (d.members.find(m=>memberStatus(m).key==='expiring')||d.members[0]).id; });
  const [claimed,setClaimed]=useStateA(()=>{ try{ return localStorage.getItem('kd_fit_me_'+((F.load().gym||{}).id||''))||null; }catch(e){ return null; } });
  const claimMode=(()=>{ const p=new URLSearchParams(location.search); return p.get('claim')==='1'||(window.KD_LIFF&&window.KD_LIFF.mode==='line'); })();
  const [toastMsg,setToastMsg]=useStateA('');
  const [needSignup,setNeedSignup]=useStateA(()=>{ try{ return new URLSearchParams(location.search).get('signup')==='1' && !(window.fitSigned&&window.fitSigned()); }catch(e){ return false; } });
  const [lang,setLang]=useStateA(()=>{ try{ return localStorage.getItem('kd_fit_lang')||'th'; }catch(e){ return 'th'; } });
  const T=(a)=>Array.isArray(a)?a[lang==='en'?1:0]:a;
  React.useEffect(()=>{ try{ localStorage.setItem('kd_fit_lang',lang); }catch(e){} window.fitLang=lang; window.fitT=T; },[lang]);
  const setData=(fn)=>setData0(d=>{ const nd=typeof fn==='function'?fn(d):fn; F.save(nd); if(window.__fitSync) window.__fitSync.push(); return nd; });
  // ── sync ข้ามเครื่องผ่าน backend (platform-api) — ผูกครั้งเดียว ──
  React.useEffect(()=>{
    if(!window.PLAT_API) return;
    const p=new URLSearchParams(location.search);
    const g=(F.load().gym)||{};
    const biz=p.get('shop')||g.id||'demo-gym';
    const sync=window.PLAT_API.attach({
      biz, type:'fitness', key:'fitness', name:g.name,
      read:()=>F.load(),
      write:(blob)=>F.save(blob),
      onRemote:(blob)=>setData0(window.ensureStaff?window.ensureStaff(blob):blob),
      stamp:(b)=>(b&&b.updatedAt)||0,
    });
    window.__fitSync=sync;
    return ()=>{ try{sync.stop();}catch(e){} window.__fitSync=null; };
  },[]);
  const toast=(m)=>{ setToastMsg(m); clearTimeout(window.__ftt); window.__ftt=setTimeout(()=>setToastMsg(''),1700); };
  const go=(k)=>{ if(k==='nfccard'){ window.open(docBase()+'Fitness NFC Card.html?name='+encodeURIComponent(data.gym.name),'_blank'); return; } if(k==='kiosk'){ window.open(docBase()+'Fitness Kiosk.html?name='+encodeURIComponent(data.gym.name),'_blank'); return; } setSub(k); };
  const can=(k)=>window.fitCan?window.fitCan(data,k):true;
  const platFit=(()=>{ try{ return (JSON.parse(localStorage.getItem('kd_platform_control_v1')||'{}').fitness)||{}; }catch(e){ return {}; } })();
  const can2=(k)=> can(k) && platFit[k]!==false;
  const curRole=(((window.fitStaffOf&&window.fitStaffOf(data,data.currentStaffId))||{}).role)||'owner';
  const myTabs=(ROLE_TABS[curRole]||OWNER_TABS).filter(([k])=>k==='more'||(k==='dash'&&!ROLE_TABS[curRole])||can2(TAB_PERM[k]||k)||(k==='dash'&&curRole==='sales'));
  React.useEffect(()=>{ if(lens!=='owner')return; const ks=myTabs.map(t=>t[0]); if(!ks.includes(tab)){ setTab(ks[0]||'more'); setSub(null); } },[data.currentStaffId]);
  React.useEffect(()=>{ const h=(e)=>{ if(e.detail==='plan'){ setTab('more'); setSub('plan'); } }; window.addEventListener('fit-go',h); return ()=>window.removeEventListener('fit-go',h); },[]);
  const NoPerm=()=>(<div className="fade" style={{padding:'54px 24px',textAlign:'center',color:'var(--ink-3,#889)'}}><div style={{fontSize:44,marginBottom:10}}>🔒</div><div style={{fontWeight:700,fontSize:16,color:'var(--ink,#222)'}}>{T(['ไม่มีสิทธิ์เข้าหน้านี้','No access'])}</div><div style={{fontSize:13,marginTop:6,lineHeight:1.5}}>{T(['ขอให้เจ้าของ/ผู้จัดการเปิดสิทธิ์หน้านี้ที่ทะเบียนพนักงาน','Ask an owner/manager to grant this page in Staff settings'])}</div></div>);
  const dueN=data.members.filter(m=>['expiring','expired'].includes(memberStatus(m).key)).length;
  const dayOpen = data.fitDay ? data.fitDay.open!==false : true;
  const props={d:data,setData,toast,go};
  const gateProps={d:data,setData,toast};

  let title, body, plum=lens==='member';
  if(needSignup&&window.FitSignup){ title=T(['สมัครใช้ระบบฟิตเนส','Sign up']); body=<window.FitSignup setData={setData} toast={toast} onDone={()=>setNeedSignup(false)}/>; }
  else if(lens==='member'){ title=T(['แอปสมาชิก','Member app']); body=(claimMode&&!claimed)?<window.MemberClaim d={data} setData={setData} toast={toast} onClaimed={(id)=>{ try{ localStorage.setItem('kd_fit_me_'+data.gym.id,id); }catch(e){} setClaimed(id); setMemberId(id); }}/>:<window.MemberApp d={data} setData={setData} memberId={claimed||memberId} toast={toast}/>; }
  else if(tab==='more'&&sub){ title=T(L_SUB[sub]||[sub,sub]); const subPerm=(sub==='nfccard'||sub==='plan'||sub==='newgym'||sub==='kds'||sub==='board'||sub==='ginfo')?'settings':sub; body=(!can2(subPerm)?<NoPerm/>:sub==='classes'?<window.OwnerClasses {...props}/>:sub==='pt'?<window.OwnerPT {...props}/>:sub==='trainplan'?<window.OwnerTrainPlans {...props}/>:sub==='health'?<window.OwnerHealth {...props}/>:sub==='ginfo'?<window.OwnerGymInfo {...props}/>:sub==='newgym'?<window.OwnerNewGym {...props}/>:sub==='kds'?<window.OwnerKdsShare {...props} mode="kds"/>:sub==='board'?<window.OwnerKdsShare {...props} mode="board"/>:sub==='checkin'?(dayOpen?<window.OwnerCheckin {...props}/>:<window.DayClosedGate {...gateProps} what="เช็คอินหน้าประตู"/>):sub==='stock'?<window.OwnerStock {...props}/>:sub==='packages'?<window.OwnerPackages {...props}/>:sub==='staff'?<window.OwnerStaff {...props}/>:sub==='vouchers'?<window.OwnerVouchers {...props}/>:sub==='promos'?<window.OwnerPromos {...props}/>:sub==='plan'?<window.OwnerPlan {...props}/>:<window.OwnerPayMatch {...props}/>); }
  else { title=T(L_TAB[tab]||[tab,tab]);
    body=(tab==='dash'?<window.OwnerDash d={data} go={(k)=>{ if(k==='checkin'||k==='staff'){setTab('more');setSub(k);} else setTab(k); }}/>
      :tab==='sell'?(dayOpen?<window.OwnerSell {...props}/>:<window.DayClosedGate {...gateProps} what="ขายสินค้า/แพ็ก"/>)
      :tab==='members'?<window.OwnerMembers {...props} dayOpen={dayOpen}/>
      :tab==='dayclose'?<window.OwnerDayClose {...props}/>
      :tab==='report'?<window.OwnerReport {...props}/>
      :tab==='sales'?<window.OwnerSales {...props}/>
      :tab==='mytrain'?(can2('trainplan')?<window.TrainerMyDay {...props}/>:<NoPerm/>)
      :tab==='classes'?(can2('classes')?<window.OwnerClasses {...props}/>:<NoPerm/>)
      :tab==='checkin'?(!can2('checkin')?<NoPerm/>:dayOpen?<window.OwnerCheckin {...props}/>:<window.DayClosedGate {...gateProps} what="เช็คอินหน้าประตู"/>)
      :<window.OwnerMore go={go} d={data} setData={setData} toast={toast}/>); }

  return (<div className="device">
    <div className={'appbar'+(plum?' plum':'')}>
      <div className="ab-top">
        <div className="ab-shop">
          {lens==='owner'&&tab==='more'&&sub
            ? <><button className="ab-back" onClick={()=>setSub(null)} aria-label={T(['ย้อนกลับ','Back'])}>‹</button><span style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</span></>
            : <><span className="em">{plum?'📱':'🏋️'}</span>{plum?data.gym.name:title}</>}
        </div>
        {lens==='owner'
          ? <div style={{display:'flex',gap:6}}><button className="ab-sel" onClick={()=>setLang(lang==='en'?'th':'en')}>{lang==='en'?'TH':'EN'} 🌐</button><button className="ab-sel" onClick={()=>{setLens('member');}}>{T(['👤 มุมสมาชิก','👤 Member'])}</button></div>
          : <select className="ab-sel" value={memberId} onChange={e=>setMemberId(e.target.value)}>{data.members.map(m=><option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select>}
      </div>
      <div className="ab-sub">{plum?(T(['สมาชิก','Member'])+' · '+(H.mbOf(data,memberId)||{}).code):(data.gym.name+' · '+T(['เจ้าของ/พนักงาน','Owner/Staff']))}
        {lens==='member'&&<span onClick={()=>setLens('owner')} style={{marginLeft:8,textDecoration:'underline',cursor:'pointer'}}>{T(['← กลับหน้าเจ้าของ','← Back to owner'])}</span>}</div>
    </div>
    <div className="scroll">{lens==='owner'&&window.DemoBanner&&<window.DemoBanner d={data} setData={setData} toast={toast}/>}{body}</div>
    {lens==='owner'&&!needSignup&&<div className="tabbar">{myTabs.map(([k,l,e])=>(
      <button key={k} className={'tab'+(tab===k?' on':'')} onClick={()=>{setTab(k);setSub(null);}}>
        <div className="te">{e}</div><div className="tl">{T(L_TABS[k]||[l,l])}</div>
        {k==='members'&&dueN>0&&<span className="dot">{dueN}</span>}</button>))}</div>}
    {toastMsg&&<div className="toast">{toastMsg}</div>}
  </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
})();
