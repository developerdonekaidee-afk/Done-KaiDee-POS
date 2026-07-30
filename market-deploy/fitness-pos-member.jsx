// fitness-pos-member.jsx — ฝั่งสมาชิก (mobile order ผ่าน LINE OA) · ต่ออายุ/ซื้อแพ็ก/จองคลาส/จองเทรนเนอร์/นัดตาราง
const { useState:useStateM } = React;
const useEffectM = React.useEffect;
/* ── บัตรสมาชิกกันแคปหน้าจอ: โค้ดหมุน (rotating token) ── */
const CARD_WIN = 30; // วินาทีต่อรอบ
function fitHash(str){ let h=0; for(let i=0;i<str.length;i++){ h=(Math.imul(h,31)+str.charCodeAt(i))>>>0; } return h.toString(36); }
function cardToken(mid,secret,win){ return 'FMB.'+mid+'.'+win+'.'+fitHash(mid+'|'+win+'|'+secret).slice(0,5); }
/* ตรวจโค้ดที่สแกน — สดเฉพาะรอบปัจจุบัน/รอบก่อนหน้า (กันแคปหน้าจอเก่า) */
function fitVerifyToken(d,code){
  if(!code||code.indexOf('FMB.')!==0) return {ok:false,reason:'bad'};
  const p=code.split('.'); const mid=p[1], win=+p[2], sig=p[3];
  const secret=(d.gym&&d.gym.cardSecret)||'';
  const nowWin=Math.floor(Date.now()/(CARD_WIN*1000));
  if(win!==nowWin && win!==nowWin-1) return {ok:false,reason:'stale',memberId:mid};
  if(fitHash(mid+'|'+win+'|'+secret).slice(0,5)!==sig) return {ok:false,reason:'forged',memberId:mid};
  return {ok:true,memberId:mid};
}
window.fitVerifyToken=fitVerifyToken; window.fitCardToken=cardToken; window.FIT_CARD_WIN=CARD_WIN;
/* ตัวตนของเครื่อง/บัญชีที่เปิดบัตร — ผูก LINE userId ถ้ามี (ย้ายเครื่องได้ตราบใช้ LINE เดิม) · ไม่งั้น fallback รหัสเครื่อง */
function fitDeviceId(){ try{ const lp=window.KD_LIFF&&window.KD_LIFF.profile; if(lp&&lp.userId) return 'L:'+lp.userId; let id=localStorage.getItem('kd_fit_device'); if(!id){ id='D:'+Math.random().toString(36).slice(2,12); localStorage.setItem('kd_fit_device',id); } return id; }catch(e){ return 'D:anon'; } }

function MemberApp({d,setData,memberId,toast}){
  const H=window.fitHelpers; const {B,pkgOf,trOf,mbOf,firstName,qrSVG}=H; const F=window.FIT;
  const {todayISO,isoAdd,daysTo,thDate,thDateTime,DOW_FULL,memberStatus}=F;
  const m=mbOf(d,memberId); if(!m) return <div className="empty">เลือกสมาชิก</div>;
  const pk=pkgOf(d,m.packageId); const s=memberStatus(m); const [tab,setTab]=useStateM('card'); const [chgReq,setChgReq]=useStateM(false); const [bk,setBk]=useStateM(null); const [pay,setPay]=useStateM(null); const [clsView,setClsView]=useStateM('grid'); const [cart,setCart]=useStateM([]);
  const myCk=d.checkins.filter(c=>c.memberId===memberId).sort((a,b)=>b.at-a.at).slice(0,8);
  const lastOk=d.checkins.filter(c=>c.memberId===memberId&&c.result==='ok').sort((a,b)=>b.at-a.at)[0];
  const present=!!(lastOk&&(Date.now()-lastOk.at)<3*3600*1000);
  const myCls=d.classes.filter(c=>c.booked.includes(memberId));
  const myPt=d.ptBookings.filter(b=>b.memberId===memberId);
  const promo=(d.promos||[]).find(p=>p.active&&(window.fitHelpers.promoMatch?window.fitHelpers.promoMatch(d,p,m):true));
  if(promo){ const gk='pv_'+promo.id+'_'+memberId; try{ if(!sessionStorage.getItem(gk)){ sessionStorage.setItem(gk,'1'); setTimeout(()=>setData(dd=>{ const p=(dd.promos||[]).find(x=>x.id===promo.id); if(p)p.views=(p.views||0)+1; return {...dd}; }),0); } }catch(e){} }
  const promoClick=()=>{ setData(dd=>{ const p=(dd.promos||[]).find(x=>x.id===promo.id); if(p)p.clicks=(p.clicks||0)+1; return {...dd}; }); const pk=promo.pkgId&&pkgOf(d,promo.pkgId); if(pk)askRenew(pk); else toast('รับโปรที่เคาน์เตอร์ได้เลย'); };
  const myOffers=(d.offers||[]).filter(o=>o.pushed&&o.status!=='won'&&(o.targets==='all'||(Array.isArray(o.targets)&&o.targets.includes(memberId)))&&!(o.acceptedBy||[]).includes(memberId)&&(!o.deadline||o.deadline>=todayISO()));
  const applyOfferItems=(offer,slip)=>setData(dd=>{ const mm=mbOf(dd,memberId); const now=Date.now(); const R=()=>Math.random().toString(36).slice(2,6);
    offer.items.forEach(it=>{ for(let q=0;q<it.qty;q++){
      if(it.kind==='pkg'){ const p=pkgOf(dd,it.id); if(!p)continue; const from=(mm.expiry&&daysTo(mm.expiry)>0)?mm.expiry:todayISO(); mm.packageId=it.id; if(p.months)mm.expiry=isoAdd(from,p.months*30); if(p.kind==='sessions')mm.ptLeft=(mm.ptLeft||0)+(p.sessions||0); mm.frozen=false; mm.spend=(mm.spend||0)+(p.price||0); dd.renewals.push({id:'rv-'+now+R(),memberId,packageId:it.id,at:now,amount:p.price,via:'app',kind:'renew',verified:false,slip:slip||null}); }
      else { const pr=dd.products.find(x=>x.id===it.id); mm.spend=(mm.spend||0)+it.price; dd.renewals.push({id:'sv-'+now+R(),memberId,productId:it.id,amount:it.price,via:'app',kind:'shop',prepaid:true,verified:false,at:now,slip:slip||null}); }
    }});
    if(window.fitAddBundles)window.fitAddBundles(dd,memberId,offer.items,offer.id);
    const dv=offer.discType==='pct'?Math.round(offer.items.reduce((a,it)=>a+it.price*it.qty,0)*offer.discVal/100):offer.discType==='baht'?offer.discVal:0; if(dv>0) dd.renewals.push({id:'vd-'+now+R(),memberId,amount:-dv,kind:'shop',discount:true,via:'app',verified:false,at:now});
    const o=(dd.offers||[]).find(x=>x.id===offer.id); if(o)o.acceptedBy=[...(o.acceptedBy||[]),memberId]; return {...dd}; });
  const acceptOffer=(offer)=>setPay({name:offer.banner||'ข้อเสนอพิเศษ',amount:offer.total,apply:(slip)=>{ applyOfferItems(offer,slip); setPay(null); toast('รับข้อเสนอแล้ว · รอร้านยืนยันการชำระ'); }});
  const useBundle=(b)=>{ if(b.per>0){ const cut=Date.now()-7*864e5; const wk=(b.log||[]).filter(t=>t>cut).length; if(wk>=b.per){ toast('ใช้ครบโควต้าสัปดาห์นี้แล้ว ('+b.per+'/สัปดาห์)'); return; } } setData(dd=>{ if(window.fitRedeem)window.fitRedeem(dd,memberId,b.id,'app'); return {...dd}; }); toast('🍽️ ส่งเข้าออเดอร์แล้ว · '+b.name+' (ฟรี · ใช้สิทธิ์แพ็ก)'); };
  const myBundles=(m.bundles||[]).filter(b=>(b.used||0)<b.total);
  const renew=(pid,slip)=>setData(dd=>{ const mm=mbOf(dd,memberId); const p=pkgOf(dd,pid); const from=(mm.expiry&&daysTo(mm.expiry)>0)?mm.expiry:todayISO();
    mm.packageId=pid; if(p.months)mm.expiry=isoAdd(from,p.months*30); if(p.kind==='sessions')mm.ptLeft=(mm.ptLeft||0)+p.sessions; mm.frozen=false; mm.spend+=p.price||0; if(window.fitAddBundles)window.fitAddBundles(dd,memberId,[{kind:'pkg',id:pid,qty:1}]);
    dd.renewals.push({id:'rv-'+Date.now().toString(36),memberId,packageId:pid,at:Date.now(),amount:p.price,via:'app',kind:'renew',verified:false,slip:slip||null}); return {...dd}; });
  const askRenew=(p)=>setPay({name:p.name,amount:p.price,apply:(slip)=>{renew(p.id,slip);setPay(null);toast('ส่งคำสั่งซื้อแล้ว · รอร้านยืนยันการชำระ');}});
  const bookClass=(cid,fee,slip)=>setData(dd=>{ const cc=dd.classes.find(x=>x.id===cid); if(cc.booked.length<cc.cap&&!cc.booked.includes(memberId))cc.booked.push(memberId);
    if(fee>0){ const mm=mbOf(dd,memberId); if(mm)mm.spend=(mm.spend||0)+fee; dd.renewals.push({id:'cl-'+Date.now().toString(36),memberId,classId:cid,at:Date.now(),amount:fee,via:'app',kind:'class',verified:false,slip:slip||null}); } return {...dd}; });
  const askClass=(c)=>{ if(c.fee>0) setPay({name:c.name,amount:c.fee,apply:(slip)=>{bookClass(c.id,c.fee,slip);setPay(null);toast('จองคลาส '+c.name+' · รอยืนยันชำระ');}}); else { bookClass(c.id); toast('จองคลาส '+c.name); } };
  const bookPt=(t,date,time)=>{ setBk(null); const useS=(mbOf(d,memberId).ptLeft||0)>0;
    const commit=(slip)=>setData(dd=>{ const mm=mbOf(dd,memberId); const uS=(mm.ptLeft||0)>0;
      dd.ptBookings.push({id:'pt-'+Date.now().toString(36),memberId,trainerId:t.id,date,time,kind:uS?'package':'single',paid:uS,status:uS?'confirmed':'pending',amount:uS?0:t.rate,via:'app',at:Date.now(),verified:uS,slip:slip||null}); if(uS)mm.ptLeft--; return {...dd}; });
    if(useS){ commit(); toast('จองเทรนเนอร์ '+t.name+' (ใช้เซสชันแพ็ก)'); }
    else setPay({name:'PT · '+t.name,amount:t.rate,apply:(slip)=>{commit(slip);setPay(null);toast('จองแล้ว · รอยืนยันการชำระ');}}); };
  const myOrders=(d.orders||[]).filter(o=>o.memberId===memberId).sort((a,b)=>(b.at||0)-(a.at||0));
  const activeOrders=myOrders.filter(o=>['new','cooking','ready'].includes(o.status||'new'));
  const addCart=(p)=>setCart(c=>{ const i=c.findIndex(x=>x.id===p.id); if(i>=0){ const n=[...c]; n[i]={...n[i],qty:n[i].qty+1}; return n; } return [...c,{id:p.id,name:p.name,price:p.price,qty:1}]; });
  const chgCart=(id,delta)=>setCart(c=>c.map(x=>x.id===id?{...x,qty:x.qty+delta}:x).filter(x=>x.qty>0));
  const cartTotal=cart.reduce((a,c)=>a+c.price*c.qty,0);
  const placeOrder=(slip)=>setData(dd=>{ const mm=mbOf(dd,memberId); const now=Date.now(); const R=()=>Math.random().toString(36).slice(2,6);
    const items=cart.map(c=>({productId:c.id,name:c.name,qty:c.qty}));
    cart.forEach(c=>{ const pr=dd.products.find(x=>x.id===c.id); if(pr){ if(pr.stock<999)pr.stock=Math.max(0,pr.stock-c.qty); pr.sold=(pr.sold||0)+c.qty; } if(mm)mm.spend=(mm.spend||0)+c.price*c.qty;
      dd.renewals.push({id:'sv-'+now+R(),memberId,productId:c.id,amount:c.price*c.qty,kind:'shop',via:'app',verified:false,at:now,slip:slip||null}); });
    dd.orders=dd.orders||[]; dd.orders.unshift({id:'od-'+now.toString(36)+R(),memberId,memberName:mm?mm.name:'',items,amount:cart.reduce((a,c)=>a+c.price*c.qty,0),kind:'order',via:'app',status:'new',at:now});
    return {...dd}; });
  const checkoutFood=()=>{ if(!cart.length)return; setPay({name:'สั่งอาหาร/เครื่องดื่ม',amount:cartTotal,apply:(slip)=>{ placeOrder(slip); setCart([]); setPay(null); setTab('order'); toast('🍽️ ส่งออเดอร์เข้าครัวแล้ว · ติดตามสถานะได้'); }}); };
  const [ocat,setOcat]=useStateM('all');
  const [nowTk,setNowTk]=useStateM(Date.now());
  useEffectM(()=>{ const t=setInterval(()=>setNowTk(Date.now()),1000); return ()=>clearInterval(t); },[]);
  useEffectM(()=>{ if(!(d.gym&&d.gym.cardSecret)) setData(dd=>{ dd.gym={...dd.gym,cardSecret:Math.random().toString(36).slice(2,10)+Date.now().toString(36)}; return {...dd}; }); },[]);
  useEffectM(()=>{ try{ const lp=(window.KD_LIFF&&window.KD_LIFF.profile)||null; const pic=lp&&(lp.pictureUrl||lp.picture); if(pic&&m.photo!==pic) setData(dd=>{ const mm=mbOf(dd,memberId); if(mm){mm.photo=pic;mm.photoFromLine=true;} return {...dd}; }); }catch(e){} },[]);
  const cardWin=Math.floor(nowTk/(CARD_WIN*1000));
  const token=cardToken(m.id,(d.gym&&d.gym.cardSecret)||'seed',cardWin);
  const remain=CARD_WIN-Math.floor((nowTk/1000)%CARD_WIN);
  const clock=new Date(nowTk).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const initials=(firstName(m.name)||'?').slice(0,1);
  const me=fitDeviceId();
  useEffectM(()=>{ if(!m.boundTo) setData(dd=>{ const mm=mbOf(dd,memberId); if(mm&&!mm.boundTo) mm.boundTo=me; return {...dd}; }); },[]);
  const locked = m.boundTo && m.boundTo!==me;
  if(locked) return (<div className="fade"><div className="memcard expired" style={{textAlign:'center'}}>
    <div className="mc-top"><span>{d.gym.name}</span><span className="mc-code">{m.code}</span></div>
    <div style={{fontSize:42,margin:'16px 0 4px'}}>🔒</div>
    <div className="mc-name">{m.name}</div>
    <div className="mc-st" style={{marginTop:6}}>บัตรนี้ผูกกับเครื่อง/LINE ของเจ้าของ · เปิดจากเครื่อง/บัญชี LINE ตัวเองเท่านั้น</div>
    <div className="mc-hint" style={{marginTop:14}}>ลืมเอาเครื่องมา? แจ้งพนักงานเช็คอินที่เคาน์เตอร์ให้ได้เลย</div>
  </div></div>);
  return (<div className="fade">
    <div className={'memcard '+s.key}>
      <style>{'@keyframes mcSheen{0%{transform:translateX(-130%)}100%{transform:translateX(240%)}}@keyframes mcPulse{0%,100%{opacity:1}50%{opacity:.3}}'}</style>
      <div className="mc-top"><span>{d.gym.name}</span><span className="mc-code">{m.code}</span></div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginTop:10}}>
        <div style={{width:56,height:56,borderRadius:'50%',flex:'0 0 auto',overflow:'hidden',background:'rgba(255,255,255,.18)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:22,color:'#fff',border:'2px solid rgba(255,255,255,.55)'}}>
          {m.photo?<img src={m.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:initials}</div>
        <div style={{textAlign:'left',flex:1,minWidth:0}}>
          <div className="mc-name" style={{margin:0}}>{m.name}</div>
          <div className="mc-pk">{pk?pk.name:'ยังไม่มีแพ็ก'}</div>
          <div style={{fontSize:10.5,color:'rgba(255,255,255,.75)',marginTop:2}}>{m.photoFromLine?'🔒 รูปจาก LINE · เปลี่ยนเองไม่ได้':'🔒 รูปยืนยันตัวตน'}</div>
        </div>
        <div style={{display:'inline-flex',alignItems:'center',gap:6,borderRadius:999,padding:'5px 10px',fontSize:11.5,fontWeight:700,background:present?'rgba(62,224,143,.22)':'rgba(255,120,102,.22)',color:present?'#d8ffe9':'#ffe1db'}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:present?'#37e08b':'#ff6f5a'}}></span>{present?'อยู่ในฟิต':'ไม่อยู่'}</div>
      </div>
      <div className="mc-st" style={{marginTop:8}}>{s.key==='expired'?('หมดอายุแล้ว '+Math.abs(s.d)+' วัน'):(s.key==='active'||s.key==='expiring')?('ใช้ได้ถึง '+thDate(m.expiry)+' · เหลือ '+s.d+' วัน'):s.th}</div>
      <div style={{position:'relative',display:'inline-block',margin:'0 auto'}}>
        <div className="mc-qr" dangerouslySetInnerHTML={{__html:qrSVG(token)}}/>
        <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',borderRadius:12}}><div style={{position:'absolute',top:0,bottom:0,width:'38%',background:'linear-gradient(105deg,transparent,rgba(255,255,255,.55),transparent)',animation:'mcSheen 2.4s linear infinite'}}></div></div>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginTop:6}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:'#37e08b',animation:'mcPulse 1s infinite'}}></span>
        <b style={{fontSize:12.5,color:'#fff'}}>รหัสสด · {clock}</b>
        <span style={{fontSize:11.5,color:'rgba(255,255,255,.8)'}}>รีเฟรชใน {remain}s</span>
      </div>
      <div style={{height:4,borderRadius:99,background:'rgba(255,255,255,.25)',overflow:'hidden',margin:'7px auto 0',maxWidth:190}}><div style={{height:'100%',width:(remain/CARD_WIN*100)+'%',background:'#fff',transition:'width 1s linear'}}></div></div>
      <div className="mc-hint">โค้ดหมุนทุก {CARD_WIN} วิ · แคปหน้าจอส่งต่อใช้ไม่ได้</div>
    </div>
    <button className="btn gh sm" style={{width:'100%',margin:'10px 0 0'}} onClick={()=>setChgReq(true)}>🪩 ขอแก้ไขข้อมูลส่วนตัว (แนบบัตร ปชช.)</button>
    {chgReq&&<window.ChangeRequestSheet d={d} setData={setData} memberId={memberId} toast={toast} onClose={()=>setChgReq(false)}/>}
    <div className="seg" style={{margin:'12px 0'}}>{[['card','แพ็ก'],['order','สั่งอาหาร'],['class','คลาส'],['pt','เทรนเนอร์'],['body','ร่างกาย'],['deals','🎁 ดีล'],['history','เข้าออก']].filter(([k])=>k!=='order'||!(window.FIT&&window.FIT.fitHasAddon)||window.FIT.fitHasAddon(d,'memberOrder')).map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}</div>
    {tab==='deals'&&(window.KDSponsorFeed?<window.KDSponsorFeed mod="fitness" limit={6} title="🎁 ดีลใกล้คุณ (ร้านสปอนเสอร์)"/>:<div className="note">ยังไม่มีดีลตอนนี้</div>)}
    {tab==='body'&&window.MemberBody&&<window.MemberBody d={d} setData={setData} memberId={memberId} toast={toast}/>}
    {tab==='card'&&<div>
      {(s.key==='expired'||s.key==='expiring')&&<div className="note gold" style={{marginBottom:12}}>{s.key==='expired'?'แพ็กหมดอายุ':'แพ็กใกล้หมด'} — ต่ออายุจ่ายในแอปได้เลย</div>}
      {myOffers.map(o=>(<button key={o.id} className="pkbtn" style={{background:'linear-gradient(135deg,#F0821E,#d76a06)',color:'#fff',border:'none',marginBottom:12,alignItems:'flex-start'}} onClick={()=>acceptOffer(o)}>
        <div style={{textAlign:'left',flex:1}}><div style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:11,fontWeight:800,background:'rgba(255,255,255,.25)',padding:'1px 7px',borderRadius:100}}>ข้อเสนอพิเศษ</span>{o.deadline&&<span style={{fontSize:10.5,opacity:.95}}>ก่อน {thDate(o.deadline)}</span>}</div>
          <b style={{fontSize:14.5,display:'block',marginTop:4,lineHeight:1.25}}>{o.banner||'ข้อเสนอสำหรับคุณ'}</b>
          <div style={{fontSize:11,opacity:.92,marginTop:2}}>{o.items.map(it=>it.name+(it.qty>1?'×'+it.qty:'')).join(' + ')}</div></div>
        <div style={{textAlign:'right',whiteSpace:'nowrap'}}><b style={{fontSize:17}}>{B(o.total)}</b><div style={{fontSize:11,fontWeight:800}}>รับสิทธิ์ ›</div></div></button>))}
      {promo&&<button className="pkbtn" style={{background:'linear-gradient(135deg,var(--brand),#0a6e4e)',color:'#fff',border:'none',marginBottom:12}} onClick={promoClick}><div style={{textAlign:'left'}}><b style={{fontSize:15}}>{promo.emoji} {promo.title}</b>{promo.desc&&<div style={{fontSize:11.5,opacity:.92,marginTop:2}}>{promo.desc}</div>}</div><span style={{fontWeight:800,whiteSpace:'nowrap'}}>รับโปร ›</span></button>}
      {myBundles.length>0&&<div style={{marginBottom:12}}>
        <div className="secttl">สิทธิ์ในแพ็ก (โควต้า) — กดใช้ตัดสต๊อก</div>
        {myBundles.map(b=>{ const left=b.total-(b.used||0); return (
          <div key={b.id} className="card" style={{padding:'12px 14px',marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,minWidth:0}}><b style={{fontSize:14.5}}>{b.name}</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>ใช้ไป {b.used||0} / {b.total} · เหลือ <b style={{color:'var(--brand-ink)'}}>{left}</b> · มูลค่า/ครั้ง {B(b.price)}</div></div>
              <button className="btn plum sm" style={{flex:'0 0 auto'}} onClick={()=>useBundle(b)}>กดใช้ 1</button>
            </div>
            {b.log&&b.log.length>0&&<div style={{fontSize:11,color:'var(--ink-3)',marginTop:7,lineHeight:1.5}}>ใช้เมื่อ: {b.log.slice(-4).map(t=>thDate(new Date(t).toISOString().slice(0,10))).join(' · ')}{b.log.length>4?' …':''}</div>}
          </div>); })}
      </div>}
      <div className="secttl">ซื้อ / ต่อแพ็ก (mobile order)</div>
      {d.packages.filter(p=>!p.hidden).map(p=>{ const meta=p.kind==='sessions'?(p.sessions+' ครั้ง'+(p.hours?' · '+p.hours+' ชม./ครั้ง':'')):p.kind==='daypass'?'รายวัน':p.months?(p.months>=12?'รายปี':p.months+' เดือน'):''; return (<button key={p.id} className="pkbtn" onClick={()=>askRenew(p)}><div><b>{p.name}</b>{p.pop&&<span className="pill py" style={{marginLeft:6,fontSize:9,padding:'0 5px'}}>ยอดนิยม</span>}<div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:1}}>{meta}{meta&&p.desc?' · ':''}{p.desc}</div></div><b className="num">{B(p.price)}</b></button>); })}
      {pk&&pk.kind==='sessions'&&<div className="note blue" style={{marginTop:8}}>PT คงเหลือ {m.ptLeft} เซสชัน</div>}
      <BusyHours d={d}/>
    </div>}
    {tab==='order'&&<div>
      {activeOrders.length>0&&<div style={{marginBottom:14}}>
        <div className="secttl">ออเดอร์ของฉัน · ติดตามสถานะ</div>
        {activeOrders.map(o=>{ const st=o.status||'new'; const steps=[['new','รับออเดอร์'],['cooking','กำลังทำ'],['ready','พร้อมรับ']]; const ci=steps.findIndex(s=>s[0]===st); return (
          <div key={o.id} className="card" style={{padding:'13px 15px',marginBottom:9,border:st==='ready'?'2px solid var(--green)':'1px solid var(--hair)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,marginBottom:10}}>
              <b style={{fontSize:13.5,lineHeight:1.3}}>{o.items.map(it=>it.name+(it.qty>1?' ×'+it.qty:'')).join(' · ')}</b>
              <span style={{fontSize:11,color:'var(--ink-3)',whiteSpace:'nowrap'}}>{F.thTime(o.at)}</span></div>
            <div style={{display:'flex',alignItems:'flex-start',gap:2}}>{steps.map((sp,i)=>(<React.Fragment key={sp[0]}>
              <div style={{flex:'0 0 auto',width:64,textAlign:'center'}}>
                <div style={{width:27,height:27,margin:'0 auto',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:i<=ci?'#fff':'var(--ink-3)',background:i<=ci?(st==='ready'&&i===2?'var(--green)':'var(--brand)'):'var(--hair-2)'}}>{i<ci?'✓':i+1}</div>
                <div style={{fontSize:10.5,marginTop:4,fontWeight:i===ci?800:600,color:i<=ci?'var(--ink)':'var(--ink-3)'}}>{sp[1]}</div></div>
              {i<2&&<div style={{flex:1,height:2.5,background:i<ci?'var(--brand)':'var(--hair-2)',marginTop:13,borderRadius:2}}/>}
            </React.Fragment>))}</div>
            {st==='ready'&&<div className="note g" style={{marginTop:11,marginBottom:0,textAlign:'center',fontWeight:700}}>🎉 พร้อมรับแล้ว — มารับที่เคาน์เตอร์/บาร์ได้เลย</div>}
          </div>); })}
      </div>}
      {cart.length>0&&<div className="card" style={{padding:'13px 15px',marginBottom:12,border:'1.5px solid var(--brand)'}}>
        <div className="secttl" style={{marginTop:0}}>ตะกร้า</div>
        {cart.map(c=>(<div key={c.id} className="row" style={{padding:'6px 0'}}>
          <div className="b"><div className="t">{c.name}</div><div className="s">{B(c.price)} × {c.qty}</div></div>
          <div style={{display:'flex',alignItems:'center',gap:9}}><button className="btn gh sm" onClick={()=>chgCart(c.id,-1)}>−</button><b className="num">{c.qty}</b><button className="btn gh sm" onClick={()=>chgCart(c.id,1)}>＋</button></div></div>))}
        <div className="total-row" style={{marginTop:6}}><span>รวม</span><span className="tv num">{B(cartTotal)}</span></div>
        <button className="btn plum blk" style={{marginTop:10}} onClick={checkoutFood}>สั่ง & จ่ายในแอป {B(cartTotal)}</button>
      </div>}
      <div className="secttl">สั่งอาหาร & เครื่องดื่ม</div>
      {(()=>{ const cats=[...new Set((d.products||[]).map(p=>p.cat||'อื่นๆ'))]; if(cats.length<2)return null; return <div style={{display:'flex',gap:7,overflowX:'auto',paddingBottom:4,marginBottom:9}}>
        {[['all','ทั้งหมด'],...cats.map(c=>[c,c])].map(([k,lb])=>(<button key={k} className={'btn sm '+(ocat===k?'pri':'gh')} style={{whiteSpace:'nowrap',flex:'0 0 auto'}} onClick={()=>setOcat(k)}>{lb}</button>))}
      </div>; })()}
      {(d.products||[]).filter(p=>ocat==='all'||(p.cat||'อื่นๆ')===ocat).map(p=>(<button key={p.id} className="pkbtn" onClick={()=>addCart(p)} disabled={p.stock<=0} style={p.stock<=0?{opacity:.5}:null}>
        <div><b>{p.name}</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{p.cat}{p.stock<=0?' · หมด':(p.stock<999?' · เหลือ '+p.stock:'')}</div></div>
        <div style={{display:'flex',alignItems:'center',gap:9}}><b className="num">{B(p.price)}</b><span className="go-ch">＋</span></div></button>))}
    </div>}
    {tab==='class'&&(()=>{
      const WclsEmoji=window.clsEmoji, WclsColor=window.clsColor, WDOW_ORDER=window.DOW_ORDER, WDOW_SHORT=window.DOW_SHORT;
      const times=[...new Set(d.classes.map(c=>c.time))].sort();
      const cellOf=(t,dw)=>d.classes.find(c=>c.time===t&&c.day===dw);
      const posterStyle=(c)=>c.poster?{backgroundImage:`url(${c.poster})`}:{'--pc':WclsColor(c)};
      const tapClass=(c)=>{ if(c.booked.includes(memberId)){ toast('จองคลาสนี้แล้ว'); return; } if(c.booked.length>=c.cap){ toast('คลาสเต็มแล้ว'); return; } askClass(c); };
      return (<div>
        {window.MemberTrainPlan&&<window.MemberTrainPlan d={d} setData={setData} memberId={memberId} toast={toast}/>}
        <div className="secttl">คลาสที่จองไว้</div>
        {myCls.length?myCls.map(c=>{ const t=trOf(d,c.trainerId); return <div className="row" key={c.id}><div className="b"><div className="t">{c.name}</div><div className="s">{DOW_FULL[c.day]} · {c.time}{t?' · '+t.name:''}</div></div><span className={'pill '+(c.fee?'py':'pg')}>{c.fee?B(c.fee):'ฟรี'}</span></div>; }):<div className="empty" style={{padding:'18px'}}>ยังไม่ได้จองคลาส</div>}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:16,marginBottom:8}}>
          <div className="secttl" style={{margin:0}}>คลาสที่เปิดรับ</div>
          <div className="seg" style={{width:'auto',flex:'0 0 auto'}}>{[['grid','🗓️ ตาราง'],['list','☰ ลิสต์']].map(([k,l])=><button key={k} className={clsView===k?'on':''} onClick={()=>setClsView(k)} style={{padding:'6px 11px',fontSize:12}}>{l}</button>)}</div>
        </div>
        <div className="note blue" style={{marginBottom:10,fontSize:11.5}}>แตะคลาส — <b>ฟรี</b> กดเข้าร่วมได้เลย · <b>เสียเงิน</b> กดซื้อ/ใช้สิทธิ์ · นัดคิวกับผู้สอนตัวต่อตัวได้ที่แท็บ “เทรนเนอร์”</div>
        {!d.classes.length&&<div className="empty" style={{padding:'18px'}}>ยังไม่มีคลาสในตาราง</div>}
        {clsView==='grid'&&!!d.classes.length&&(
          <div className="pgrid"><div className="pgrid-inner" style={{gridTemplateColumns:'46px repeat(7,104px)'}}>
            <div className="pg-corner">เวลา</div>
            {WDOW_ORDER.map(dw=><div key={dw} className="pg-dh">{WDOW_SHORT[dw]}</div>)}
            {times.map(t=>(<React.Fragment key={t}>
              <div className="pg-time">{t}</div>
              {WDOW_ORDER.map(dw=>{ const c=cellOf(t,dw); if(!c)return <div key={dw} className="pempty" style={{cursor:'default'}}></div>;
                const tr=trOf(d,c.trainerId); const booked=c.booked.includes(memberId); const full=c.booked.length>=c.cap;
                return (<button key={dw} className={'pcard'+(c.poster?' hasimg':'')} style={{...posterStyle(c),opacity:full&&!booked?.55:1}} onClick={()=>tapClass(c)}>
                  {booked?<span className="pnew" style={{background:'#0CA678'}}>จองแล้ว ✓</span>:c.isNew&&<span className="pnew">NEW</span>}
                  {!c.poster&&<span className="pcemo">{WclsEmoji(c.name)}</span>}
                  <span className="pcname">{c.name}</span>
                  <span className="pctr">{c.fee?B(c.fee):'ฟรี'}{full&&!booked?' · เต็ม':' · '+c.booked.length+'/'+c.cap}</span>
                </button>);
              })}
            </React.Fragment>))}
          </div></div>
        )}
        {clsView==='list'&&d.classes.filter(c=>!c.booked.includes(memberId)&&c.booked.length<c.cap).map(c=>{ const t=trOf(d,c.trainerId); return (<button key={c.id} className="pkbtn" onClick={()=>askClass(c)}><div><b>{c.name}</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{DOW_FULL[c.day]} · {c.time} · {t?t.name:''} · {c.booked.length}/{c.cap}</div></div><span className={'pill '+(c.fee?'py':'pg')}>{c.fee?B(c.fee)+' · ซื้อ':'ฟรี · เข้าร่วม'}</span></button>); })}
      </div>);
    })()}
    {tab==='pt'&&<div>
      <div className="secttl">นัดเทรนเนอร์ของฉัน</div>
      {myPt.length?myPt.map(b=>{ const t=trOf(d,b.trainerId); return <div className="row" key={b.id}><div className="b"><div className="t">{t?t.name:'—'}</div><div className="s">{thDate(b.date)} · {b.time} · {b.kind==='package'?'เซสชันแพ็ก':B(b.amount)}</div></div><span className={'pill '+(b.status==='confirmed'?'pg':'py')}>{b.status==='confirmed'?'ยืนยัน':'รอชำระ'}</span></div>; }):<div className="empty" style={{padding:'18px'}}>ยังไม่มีนัด</div>}
      <div className="secttl" style={{marginTop:14}}>จองเทรนเนอร์ (จ่ายในแอป / ใช้เซสชันแพ็ก)</div>
      {d.trainers.filter(t=>t.active).map(t=>(<button key={t.id} className="pkbtn" onClick={()=>setBk(t.id)}><div><b>{t.name}</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{t.specialty} · ⭐{t.rating} · ว่าง {t.avail}</div></div><b className="num">{B(t.rate)}</b></button>))}
    </div>}
    {tab==='history'&&<div><div className="secttl">ประวัติเข้าออก</div>
      {myCk.length?myCk.map(c=><div className="row" key={c.id}><div className="b"><div className="t">{c.method==='nfc'?'แตะ NFC':'สแกน QR'}</div><div className="s">{thDateTime(c.at)}</div></div><span className={'pill '+(c.result==='ok'?'pg':'pr')}>{c.result==='ok'?'เข้าได้':'ปฏิเสธ'}</span></div>):<div className="empty" style={{padding:'18px'}}>ยังไม่มีประวัติ</div>}
    </div>}
    {bk&&(()=>{ const t=trOf(d,bk); const [date,setDate]=[null,null]; return <BookPt d={d} m={m} t={t} onBook={bookPt} onClose={()=>setBk(null)}/>; })()}
    {pay&&<MemberPay pay={pay} onClose={()=>setPay(null)}/>}
  </div>);
}
function BookPt({d,m,t,onBook,onClose}){
  const F=window.FIT; const {todayISO,isoAdd,thDate,DOW_FULL}=F; const {B}=window.fitHelpers;
  const [date,setDate]=useStateM(isoAdd(todayISO(),1)); const [time,setTime]=useStateM('18:00');
  const days=[]; for(let i=1;i<=7;i++){ const dt=isoAdd(todayISO(),i); days.push(dt); }
  const times=['09:00','10:00','11:00','16:00','17:00','18:00','19:00','20:00'];
  const useS=m.ptLeft>0;
  return (<window.fitSheet title={'จอง '+t.name} tag={t.specialty+' · ว่าง '+t.avail} onClose={onClose}>
    <div className="note g" style={{marginBottom:12}}>{useS?('ใช้เซสชันจากแพ็ก PT (เหลือ '+m.ptLeft+') — ยืนยันทันที'):('จ่ายต่อครั้ง '+B(t.rate)+' ในแอป · นัด/ปรับตารางร่วมกับเทรนเนอร์ได้')}</div>
    <label className="lb" style={{marginTop:0}}>เลือกวัน</label>
    <div style={{display:'flex',gap:7,overflowX:'auto',paddingBottom:4}}>{days.map(dt=>{ const wd=new Date(dt+'T00:00:00').getDay(); return <button key={dt} className="btn gh sm" style={{flex:'0 0 auto',...(date===dt?{borderColor:'var(--brand)',background:'var(--brand-softer)',color:'var(--brand-ink)'}:null)}} onClick={()=>setDate(dt)}>{DOW_FULL[wd].slice(0,2)} {thDate(dt).split(' ').slice(0,2).join(' ')}</button>; })}</div>
    <label className="lb">เลือกเวลา</label>
    <div className="grid2" style={{gridTemplateColumns:'repeat(4,1fr)'}}>{times.map(tm=><button key={tm} className="btn gh sm" style={time===tm?{borderColor:'var(--brand)',background:'var(--brand-softer)',color:'var(--brand-ink)'}:null} onClick={()=>setTime(tm)}>{tm}</button>)}</div>
    <button className="btn plum blk" style={{marginTop:16}} onClick={()=>onBook(t,date,time)}>{useS?'ยืนยันนัด (ใช้เซสชันแพ็ก)':'จอง + จ่ายในแอป '+B(t.rate)}</button>
  </window.fitSheet>);
}
Object.assign(window,{ MemberApp });
function ChangeRequestSheet({d,setData,memberId,toast,onClose}){
  const {mbOf}=window.fitHelpers; const m=mbOf(d,memberId)||{};
  const FIELDS=[['name','ชื่อ'],['birth','วันเกิด'],['phone','เบอร์'],['other','อื่นๆ']];
  const [field,setField]=useStateM('name'); const [val,setVal]=useStateM(''); const [idPhoto,setIdPhoto]=useStateM(null); const [note,setNote]=useStateM('');
  const cur={name:m.name,birth:m.birth,phone:m.phone,other:''}[field]||'';
  const pick=()=>{ const i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=e=>{const f=e.target.files&&e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>setIdPhoto(r.result); r.readAsDataURL(f);}; i.click(); };
  const submit=()=>{ if(!idPhoto){toast('แนบรูปบัตรประชาชนก่อน');return;} if(field!=='other'&&!val.trim()){toast('กรอกข้อมูลใหม่');return;} setData(dd=>{ const mm=mbOf(dd,memberId); (dd.changeRequests=dd.changeRequests||[]).unshift({id:'cr-'+Date.now().toString(36),memberId,memberName:mm?mm.name:'',field,oldValue:cur,newValue:val.trim(),note:note.trim(),idPhoto,status:'pending',at:Date.now()}); return {...dd}; }); toast('ส่งคำขอแล้ว · รอพนักงานตรวจสอบ'); onClose(); };
  return (<window.fitSheet title="ขอแก้ไขข้อมูลส่วนตัว" tag="แนบบัตร ปชช. · พนักงานตรวจก่อนแก้" onClose={onClose}>
    <div className="note gold" style={{marginBottom:12}}>ข้อมูลตัวตน (ชื่อ/วันเกิด/เบอร์) แก้เองไม่ได้ — ส่งคำขอ + แนบบัตรประชาชน พนักงานตรวจสอบแล้วแก้ให้ (กันสวมตัวตน)</div>
    <label className="lb" style={{marginTop:0}}>ข้อมูลที่ต้องการแก้</label>
    <div className="seg" style={{marginBottom:10}}>{FIELDS.map(([k,l])=><button key={k} className={field===k?'on':''} onClick={()=>{setField(k);setVal('');}}>{l}</button>)}</div>
    {field!=='other'&&<><label className="lb">ค่าปัจจุบัน</label><input className="field" value={cur} disabled/></>}
    <label className="lb">{field==='other'?'สิ่งที่อยากแก้ (อธิบาย)':'ข้อมูลใหม่ที่ถูกต้อง'}</label>
    {field==='other'?<textarea className="field" rows="2" value={val} onChange={e=>setVal(e.target.value)}/>:<input className="field" type={field==='birth'?'date':'text'} value={val} onChange={e=>setVal(e.target.value)}/>}
    <label className="lb">รูปบัตรประชาชน (ยืนยันตัวตน)</label>
    {idPhoto?<div style={{display:'flex',alignItems:'center',gap:10}}><img src={idPhoto} alt="" style={{width:64,height:42,objectFit:'cover',borderRadius:8}}/><button className="btn gh sm" onClick={pick}>เปลี่ยนรูป</button></div>:<button className="btn gh blk" onClick={pick}>📷 ถ่าย/แนบรูปบัตรประชาชน</button>}
    <label className="lb">หมายเหตุ (ถ้ามี)</label>
    <textarea className="field" rows="2" value={note} onChange={e=>setNote(e.target.value)} placeholder="เช่น เหตุผลที่ขอแก้"/>
    <button className="btn pri blk" style={{marginTop:14}} onClick={submit}>ส่งคำขอให้พนักงานตรวจ</button>
  </window.fitSheet>);
}
window.ChangeRequestSheet=ChangeRequestSheet;

function MemberClaim({d,setData,toast,onClaimed}){
  const {mbOf,firstName,pkgOf,B}=window.fitHelpers; const F=window.FIT; const {thDate,memberStatus}=F;
  const [step,setStep]=useStateM('phone'); const [phone,setPhone]=useStateM(''); const [found,setFound]=useStateM(null); const [birth,setBirth]=useStateM(''); const [ok,setOk]=useStateM(false);
  const norm=(p)=>String(p||'').replace(/\D/g,'');
  const search=()=>{ const ph=norm(phone); if(ph.length<8){toast&&toast('กรอกเบอร์ให้ครบ');return;} const m=(d.members||[]).find(x=>norm(x.phone)===ph); if(m){ setFound(m); setBirth(m.birth||''); setOk(false); setStep('confirm'); } else setStep('notfound'); };
  const confirm=()=>{ if(!found||!ok)return; setData(dd=>{ const mm=mbOf(dd,found.id); if(mm){ if(!mm.birthLocked){ mm.birth=birth||mm.birth||''; mm.birthLocked=true; } mm.line=true; mm.boundTo=fitDeviceId(); try{ const lp=window.KD_LIFF&&window.KD_LIFF.profile; const pic=lp&&(lp.pictureUrl||lp.picture); if(pic){mm.photo=pic;mm.photoFromLine=true;} }catch(e){} } return {...dd}; }); onClaimed(found.id); };
  const joinUrl=location.href.replace(/[^/]*$/,'')+'Fitness Join.html?shop='+encodeURIComponent(d.gym.id)+'&name='+encodeURIComponent(d.gym.name);
  const wrap={maxWidth:400,margin:'0 auto',padding:'22px 18px'};
  return (<div className="fade" style={wrap}>
    <div style={{textAlign:'center',marginBottom:18}}>
      <div style={{fontSize:34}}>💪</div>
      <div style={{fontWeight:800,fontSize:19,marginTop:4}}>{d.gym.name}</div>
      <div style={{fontSize:13,color:'var(--ink-3,#889)',marginTop:2}}>เข้าบัตรสมาชิก · ผูกบัญชี LINE</div>
    </div>
    {step==='phone'&&<>
      <div className="note g" style={{marginBottom:12}}>กรอกเบอร์ที่ลงทะเบียนไว้กับยิม — ระบบจะจับคู่บัตรสมาชิกของคุณให้อัตโนมัติ</div>
      <label className="lb" style={{marginTop:0}}>เบอร์มือถือ</label>
      <input className="field num" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="08X-XXX-XXXX" onKeyDown={e=>{if(e.key==='Enter')search();}}/>
      <button className="btn pri blk" style={{marginTop:16}} disabled={!phone} onClick={search}>ค้นหาบัตรของฉัน</button>
      <div style={{textAlign:'center',marginTop:14,fontSize:12.5,color:'var(--ink-3,#889)'}}>ยังไม่เคยเป็นสมาชิก? <a href={joinUrl} style={{fontWeight:700}}>สมัครใหม่</a></div>
    </>}
    {step==='confirm'&&found&&(()=>{ const pk=pkgOf(d,found.packageId); const s=memberStatus(found); const locked=!!found.birthLocked; return <>
      <div className="note g" style={{marginBottom:12}}>ตรวจสอบข้อมูลให้ถูกต้องก่อนยืนยัน — เบอร์+LINE ผูกแล้ว · วันเกิดแก้ได้ครั้งเดียว</div>
      <div className="card" style={{padding:'16px 16px',textAlign:'center'}}>
        <div style={{width:60,height:60,borderRadius:'50%',margin:'0 auto 8px',background:'var(--brand-soft,#e3efe9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:800,color:'var(--brand-ink,#1e7a52)'}}>{firstName(found.name)[0]}</div>
        <div style={{fontWeight:800,fontSize:17}}>{found.name}</div>
        <div style={{fontSize:13,color:'var(--ink-3,#889)',marginTop:3}}>{found.code} · {pk?pk.name:'ยังไม่มีแพ็ก'}</div>
        <div style={{fontSize:12.5,color:'var(--ink-3,#889)',marginTop:2}}>{s.key==='expired'?'หมดอายุแล้ว':(s.key==='active'||s.key==='expiring')?('ใช้ได้ถึง '+thDate(found.expiry)):s.th}</div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,margin:'10px 2px',fontSize:12.5,color:'var(--ink-3,#889)'}}>🔒 เบอร์ {found.phone||'—'} · ผูกกับ LINE แล้ว (แก้เองไม่ได้)</div>
      <label className="lb" style={{marginTop:0}}>วัน/เดือน/ปีเกิด {locked?'(ยืนยันแล้ว · แก้ไม่ได้)':'(ตั้งครั้งเดียว · ยืนยันแล้วแก้ไม่ได้)'}</label>
      <input className="field" type="date" value={birth} disabled={locked} onChange={e=>setBirth(e.target.value)}/>
      <label className="chk" style={{marginTop:12,display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={ok} onChange={e=>setOk(e.target.checked)}/> ข้อมูลข้างต้นถูกต้อง — ยืนยันเข้าบัตรของฉัน</label>
      <button className="btn pri blk" style={{marginTop:14}} disabled={!ok} onClick={confirm}>✅ ยืนยันข้อมูล & เข้าบัตร</button>
      <button className="btn gh blk" style={{marginTop:8}} onClick={()=>{setStep('phone');setFound(null);setOk(false);}}>ไม่ใช่ฉัน · กรอกเบอร์ใหม่</button>
    </>; })()}
    {step==='notfound'&&<>
      <div className="note gold" style={{marginBottom:14}}>ไม่พบเบอร์นี้ในระบบ — อาจลงทะเบียนด้วยเบอร์อื่น หรือยังไม่เคยเป็นสมาชิก</div>
      <a className="btn pri blk" href={joinUrl} style={{display:'block',textAlign:'center',textDecoration:'none'}}>สมัครสมาชิกใหม่</a>
      <button className="btn gh blk" style={{marginTop:8}} onClick={()=>setStep('phone')}>ลองกรอกเบอร์อีกครั้ง</button>
      <div style={{textAlign:'center',marginTop:12,fontSize:12.5,color:'var(--ink-3,#889)'}}>หรือแจ้งพนักงานที่เคาน์เตอร์เพื่อผูกบัตรให้</div>
    </>}
  </div>);
}
window.MemberClaim=MemberClaim;

function MemberPay({pay,onClose}){
  const {B,qrSVG}=window.fitHelpers; const [slip,setSlip]=useStateM(null); const [agree,setAgree]=useStateM(false);
  const pick=()=>{ const i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=e=>{const f=e.target.files&&e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>setSlip(r.result); r.readAsDataURL(f);}; i.click(); };
  return (<window.fitSheet title={'ชำระเงิน · '+pay.name} tag={'พร้อมเพย์ '+B(pay.amount)} onClose={onClose}>
    <div style={{textAlign:'center'}}>
      <div className="qr" dangerouslySetInnerHTML={{__html:qrSVG('fitpay'+pay.amount)}}/>
      <div style={{fontSize:22,fontWeight:800,color:'var(--brand-ink)',marginTop:6}}>{B(pay.amount)}</div>
      <div style={{fontSize:12,color:'var(--ink-3)',marginTop:2}}>สแกนจ่ายพร้อมเพย์ยิม แล้วแนบสลิปเพื่อยืนยัน</div>
      {slip?<div style={{display:'flex',alignItems:'center',gap:10,justifyContent:'center',marginTop:12}}><img src={slip} alt="slip" style={{width:46,height:46,borderRadius:9,objectFit:'cover',border:'1px solid var(--hair)'}}/><button className="btn gh sm" onClick={()=>setSlip(null)}>เอาออก</button></div>
        :<button className="btn gh sm" style={{marginTop:12}} onClick={pick}>📷 แนบสลิปโอน</button>}
    </div>
    <div style={{background:'#FFF7F5',border:'1px solid #F3C9C0',borderRadius:12,padding:'11px 13px',marginTop:16,fontSize:12.5,lineHeight:1.6,color:'#A4292B'}}>
      <b>เงื่อนไขการซื้อ · โปรดอ่านก่อนชำระ</b>
      <div style={{color:'var(--ink-2,#556)',marginTop:5}}>• การซื้อแพ็กเกจ/คลาส/คอร์ส PT เมื่อ<b>ชำระเงินแล้วถือว่าสมบูรณ์ ไม่สามารถขอคืนเงินได้ทุกกรณี</b><br/>• สิทธิ์มีอายุตามที่ระบุ · ไม่คืน/ไม่ทอนวันคงเหลือเมื่อยกเลิก<br/>• กรุณาตรวจแพ็ก ราคา และวันหมดอายุให้ถูกต้องก่อนกดยืนยัน</div>
    </div>
    <label style={{display:'flex',gap:9,alignItems:'flex-start',cursor:'pointer',margin:'12px 2px',fontSize:12.5,color:'var(--ink,#223)'}}>
      <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} style={{width:19,height:19,marginTop:1,accentColor:'var(--brand-ink)'}}/>
      <span>ฉันได้อ่านและยอมรับเงื่อนไข — เข้าใจว่า<b>ชำระแล้วไม่สามารถขอคืนเงินได้</b></span></label>
    <button className="btn plum blk" disabled={!agree} style={{opacity:agree?1:.5}} onClick={()=>{ if(!agree)return; pay.apply(slip); }}>ยืนยันการชำระ</button>
    <div className="note g" style={{marginTop:8}}>สิทธิ์เปิดใช้หลังร้านยืนยันยอด (จับยอดพร้อมเพย์) · แนบสลิปช่วยยืนยันไวขึ้น</div>
  </window.fitSheet>);
}
function BusyHours({d}){
  const hrs={}; d.checkins.filter(c=>c.result==='ok').forEach(c=>{const h=new Date(c.at).getHours();hrs[h]=(hrs[h]||0)+1;});
  const rows=[]; for(let h=6;h<=22;h++)rows.push({h,v:hrs[h]||0}); const mx=Math.max(1,...rows.map(r=>r.v));
  const now=new Date().getHours(); const cur=(hrs[now]||0);
  const lv = cur>=mx*0.75?{t:'หนาแน่น',c:'var(--red)'}:cur>=mx*0.4?{t:'ปานกลาง',c:'var(--gold)'}:{t:'คนไม่เยอะ',c:'var(--green)'};
  const peak=rows.reduce((a,b)=>b.v>a.v?b:a,{h:6,v:0}); const quiet=rows.filter(r=>r.h>=now).sort((a,b)=>a.v-b.v)[0]||rows.sort((a,b)=>a.v-b.v)[0];
  return (<div className="card"><h3>ช่วงเวลาคนเยอะ <span className="lnk" style={{color:lv.c}}>ตอนนี้ {String(now).padStart(2,'0')}:00 · {lv.t}</span></h3>
    <div className="hours">{rows.map(r=><div key={r.h} className={'hc'+(r.h===peak.h?' pk':'')} style={{height:Math.max(4,r.v/mx*100)+'%',...(r.h===now?{outline:'2px solid var(--brand)',outlineOffset:'1px'}:null)}}/>)}</div>
    <div className="hlbl"><span>06</span><span>10</span><span>14</span><span>18</span><span>22</span></div>
    <div style={{fontSize:12,color:'var(--ink-3)',marginTop:8,lineHeight:1.5}}>🔴 พีคสุด ~{String(peak.h).padStart(2,'0')}:00 · แนะนำมาช่วงคนน้อย{quiet?(' ~'+String(quiet.h).padStart(2,'0')+':00'):''} จะได้เครื่องไม่ต้องรอ</div>
  </div>);
}
