// kaidee-merchant2.jsx — Orders queue, Dashboard, Store builder, Merchant shell
const { useState:m2State } = React;

/* ── แจ้งเตือนเงินเข้า (per-device · ไม่ sync ข้ามเครื่อง) — toast auto-hide + เสียง/เสียงพูด ── */
function kdPayMode(){ try{ return localStorage.getItem('kd_pp_mode')||'toast'; }catch(e){ return 'toast'; } }
function kdPayChime(force){ try{ if(!force && kdPayMode()!=='sound') return; const AC=window.AudioContext||window.webkitAudioContext; if(AC){ const c=new AC(); const o=c.createOscillator(); const g=c.createGain(); o.connect(g); g.connect(c.destination); o.type='sine'; o.frequency.setValueAtTime(880,c.currentTime); o.frequency.setValueAtTime(1320,c.currentTime+0.12); g.gain.setValueAtTime(0.0001,c.currentTime); g.gain.exponentialRampToValueAtTime(0.25,c.currentTime+0.02); g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+0.4); o.start(); o.stop(c.currentTime+0.42); } if(window.speechSynthesis){ const u=new SpeechSynthesisUtterance('รับเงินเรียบร้อยค่ะ'); u.lang='th-TH'; setTimeout(()=>{ try{ window.speechSynthesis.speak(u); }catch(e){} },260); } }catch(e){} }
function kdPayToast(msg,force){ try{ if(!force && kdPayMode()==='off') return; let host=document.getElementById('kd-pp-toast'); if(!host){ host=document.createElement('div'); host.id='kd-pp-toast'; host.style.cssText='position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;font-family:var(--font,sans-serif)'; document.body.appendChild(host); } const t=document.createElement('div'); t.style.cssText='background:#0E9463;color:#fff;padding:11px 18px;border-radius:12px;box-shadow:0 8px 24px rgba(10,60,40,.28);font-size:14px;font-weight:700;opacity:0;transform:translateY(-8px);transition:.25s'; t.textContent=msg; host.appendChild(t); requestAnimationFrame(()=>{ t.style.opacity='1'; t.style.transform='translateY(0)'; }); setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(-8px)'; setTimeout(()=>{ try{ host.removeChild(t); }catch(e){} },300); },3000); }catch(e){} }
function kdPayIn(msg){ kdPayToast(msg||'💰 เงินเข้า · จับยอดแล้ว'); kdPayChime(); }
function PayNotifyMode({ lang }){ const TH=lang==='th';
  const [mode,setMode]=m2State(()=>kdPayMode());
  const set=(m)=>{ setMode(m); try{ localStorage.setItem('kd_pp_mode',m); }catch(e){} };
  const opts=[['off','🔕',(TH?'เงียบ':'Silent'),(TH?'ไม่เด้ง ไม่มีเสียง':'No toast, no sound')],
    ['toast','💬',(TH?'เด้งเบาๆ':'Toast'),(TH?'toast มุมบน หายเอง 3 วิ':'Auto-hide toast')],
    ['sound','🔊',(TH?'เด้ง + เสียง':'Toast + sound'),(TH?'toast + กริ้ง + พูด “รับเงินเรียบร้อยค่ะ”':'Toast + chime + voice')]];
  return (<div style={{ marginBottom:8 }}>
    <div style={{ display:'flex', gap:8, marginBottom:8 }}>
      {opts.map(([k,ic,tt,ss])=>{ const on=mode===k; return (
        <button key={k} onClick={()=>set(k)} style={{ flex:1, cursor:'pointer', textAlign:'center', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', borderRadius:12, padding:'11px 6px', fontFamily:'var(--font)' }}>
          <div style={{ fontSize:21 }}>{ic}</div>
          <div style={{ fontSize:12.5, fontWeight:700, color:on?'var(--brand-ink)':'var(--ink)', marginTop:3 }}>{tt}</div>
          <div style={{ fontSize:10, color:'var(--ink-3)', marginTop:2, lineHeight:1.35 }}>{ss}</div>
        </button>
      ); })}
    </div>
    <button onClick={()=>{ kdPayToast(TH?'💰 ทดสอบ · รับเงินเรียบร้อยค่ะ':'💰 Test · payment received', true); if(mode==='sound') kdPayChime(true); }} className="kd-btn" style={{ width:'100%', padding:'9px', fontSize:12.5, background:'var(--bg)', border:'none', color:'var(--ink-2)', margin:'0 0 4px', justifyContent:'center' }}>🔔 {TH?'ทดสอบเสียง/แจ้งเตือน':'Test'}</button>
    <div style={{ fontSize:11, color:'var(--ink-3)', margin:'2px 2px 12px', lineHeight:1.45 }}>{TH?'ตั้งแยกแต่ละเครื่อง — เครื่องเจ้าของเปิดเสียง เครื่องพนักงานที่กำลังขายตั้งเงียบได้':'Per-device — owner’s device can use sound, a busy cashier can stay silent'}</div>
  </div>);
}

/* ══════════════ ORDERS QUEUE ══════════════ */
const FLOW = ['new','cooking','ready','delivering','done'];
const STATUS_LABEL = {
  new:{th:'ใหม่',en:'New',c:'var(--accent)'}, cooking:{th:'กำลังทำ',en:'Cooking',c:'#3B82C4'},
  ready:{th:'พร้อมเสิร์ฟ',en:'Ready',c:'var(--brand)'}, delivering:{th:'กำลังส่ง',en:'Delivering',c:'#8257C4'},
  done:{th:'เสร็จ',en:'Done',c:'var(--ink-3)'},
};
function nextStatus(o){
  const i = FLOW.indexOf(o.status);
  let ni = i+1;
  if(FLOW[ni]==='delivering' && o.channel!=='delivery') ni++; // skip delivering for non-delivery
  return FLOW[Math.min(ni, FLOW.length-1)];
}
const mTmin=(t)=>{ const m=/(\d{1,2}):(\d{2})/.exec(t||''); return m?(+m[1]*60+ +m[2]):0; };
function mStParse(text){ const lines=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean); const rows=[];
  for(const ln of lines){ const nums=(ln.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|-?\d+(?:\.\d{1,2})?/g)||[]); if(!nums.length) continue;
    const dec=nums.filter(n=>/\.\d{1,2}$/.test(n)); const pool=(dec.length?dec:nums).map(n=>parseFloat(n.replace(/,/g,''))).filter(v=>v>0); if(!pool.length) continue;
    const amount=+Math.max(...pool).toFixed(2); const time=(ln.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)||[])[0]||''; if(amount>0) rows.push({ amount, time }); }
  return rows; }
function RefundFulfill({ o, onSave }){
  const { lang } = useT(); const TH = lang!=='en';
  const r=o.refund; const [big,setBig]=m2State(false); const [cp,setCp]=m2State('');
  const cap=(f)=>{ if(!f)return; const rd=new FileReader(); rd.onload=()=>onSave&&onSave({ refund:{...r, status:'refunded', slip:rd.result, refundedAt:Date.now() } }); rd.readAsDataURL(f); };
  const copy=(t,k)=>{ try{ navigator.clipboard.writeText(t); }catch(e){} setCp(k); setTimeout(()=>setCp(''),1200); };
  const amt=money(r.amount||o.total||0);
  if(r.status==='refunded') return (<div style={{ marginTop:10, padding:'10px 12px', borderRadius:11, background:'var(--brand-soft)', border:'1px solid var(--brand)' }}>
    <div style={{ fontSize:12.5, fontWeight:800, color:'var(--brand-ink)' }}>✓ {TH?'คืนเงินเรียบร้อยแล้ว':'Refunded'} · <span className="num">{amt}</span></div>
    {r.slip && <img src={r.slip} alt="slip" onClick={()=>setBig(true)} style={{ marginTop:8, maxWidth:120, borderRadius:9, border:'1px solid var(--hair)', cursor:'zoom-in' }}/>}
    {big && r.slip && <div onClick={()=>setBig(false)} style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(10,20,15,.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, cursor:'zoom-out' }}><img src={r.slip} alt="slip" style={{ maxWidth:'100%', maxHeight:'88vh', borderRadius:14 }}/></div>}
  </div>);
  if(r.status==='acct_given') return (<div style={{ marginTop:10, padding:'11px 12px', borderRadius:11, background:'#FFFAF3', border:'1px solid #F0DFB0' }}>
    <div style={{ fontSize:12.5, fontWeight:800, color:'#B45309', marginBottom:6 }}>💸 {TH?'ลูกค้าส่งบัญชีรับเงินคืนแล้ว — โอนคืน':'Customer sent refund account'} <span className="num">{amt}</span></div>
    <div style={{ background:'#fff', borderRadius:9, padding:'9px 11px', fontSize:12.5, lineHeight:1.7 }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}><span>{r.bank}</span></div>
      <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center' }}><b className="num">{r.acctNo}</b><button onClick={()=>copy(r.acctNo,'no')} className="kd-btn" style={{ padding:'3px 9px', fontSize:11, background:'var(--bg)', color:'var(--ink-2)' }}>{cp==='no'?'✓':(TH?'คัดลอก':'Copy')}</button></div>
      <div>{r.acctName}</div>{r.phone && <div className="num" style={{ color:'var(--ink-3)' }}>{r.phone}</div>}
    </div>
    <label style={{ display:'block', marginTop:9, cursor:'pointer' }}><span className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:'11px', display:'block', textAlign:'center' }}>{TH?'📷 แนบสลิปโอนคืน → ยืนยันคืนเงิน':'Attach transfer slip → confirm refund'}</span><input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>cap(e.target.files&&e.target.files[0])}/></label>
    <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:6, textAlign:'center' }}>{TH?'เมื่อแนบสลิป ระบบจะแจ้งลูกค้าอัตโนมัติ (SMS/LINE)':'Attaching the slip notifies the customer (SMS/LINE)'}</div>
  </div>);
  return (<div style={{ marginTop:10, padding:'9px 12px', borderRadius:11, background:'var(--bg)', fontSize:12, color:'var(--ink-3)', fontWeight:600 }}>⏳ {TH?'รอลูกค้ากรอกบัญชีรับเงินคืน':'Awaiting customer refund account'} · <span className="num">{amt}</span></div>);
}
function OrdersScreen({ orders, setOrders, patchOrder, patchSale, voidOrder:voidOrderProp, recordOrderSale, shopName, soundOn, onToggleSound, voidPin, payTiming, pay, voidApproval, canApproveVoid }){
  const { t, lang } = useT();
  const [filter,setFilter] = m2State('active');
  const [chan,setChan] = m2State('all');
  const [slip,setSlip] = m2State(null);
  const active = orders.filter(o=> o.status!=='void' && o.status!=='rejected' && (o.status!=='done' || (o.payLater && !o.paid)));
  const voided = orders.filter(o=>o.status==='void' || o.status==='rejected');
  let shown = filter==='active' ? active : (filter==='void' ? voided : orders.filter(o=>o.status==='done' && !(o.payLater && !o.paid)));
  if(chan!=='all') shown = shown.filter(o=>o.channel===chan);
  // ปักหมุด “ทำก่อน” (priority) → เด้งขึ้นบนสุด (คงลำดับเดิมในกลุ่ม)
  shown = shown.slice().sort((a,b)=>(b.pin?1:0)-(a.pin?1:0));
  const advance = (id)=>{ const o = orders.find(x=>x.id===id); if(!o) return; const ns = nextStatus(o);
    if(patchOrder) patchOrder(id, { status:ns }); else setOrders(prev=>prev.map(x=> x.id===id?{...x,status:ns}:x));
    // ปิดออเดอร์ลูกค้า (จากลิงก์เดลิเวอรี — ไม่ใช่บิล POS) → บันทึกยอดขายครั้งเดียว ให้ทุกช่องทางเข้ารายงาน
    if(ns==='done' && recordOrderSale && !o.fromSale && !o.saleId && !o.saleRecorded) recordOrderSale(o);
  };
  const save = (id, patch)=>{ if(patchOrder) patchOrder(id, patch); else setOrders(prev=>prev.map(x=> x.id===id?{...x,...patch}:x));
    // เก็บเงินออเดอร์ payLater → อัปเดตบิลขายที่ผูกไว้ด้วย (วิธีจ่าย/สถานะจ่าย) → รายงานตรง
    if(patch && patch.paid && patchSale){ const o=orders.find(x=>x.id===id); if(o && o.payLater && o.saleId){ patchSale(o.saleId, { paid:true, payLater:false, pay: patch.pay||o.pay, paidAt: patch.paidAt||Date.now() }); } }
  };
  const voidOrder = (id, info)=>{ if(voidOrderProp) voidOrderProp(id, info); else save(id, { status:(info&&info.reject)?'rejected':'void', voidReason:info.reason||'', voidType:info.voidType||'other', voidAt:Date.now() }); };
  const togglePin = (id)=>{ const o=orders.find(x=>x.id===id); save(id, { pin: !o.pin }); };
  // เลื่อนคิวขึ้น/ลง — สลับตำแหน่งกับเพื่อนในอาร์เรย์ orders จริง
  const moveOrder = (id, dir)=>{ setOrders(prev=>{ const arr=prev.slice(); const i=arr.findIndex(x=>x.id===id); if(i<0) return prev;
    const j=i+dir; if(j<0||j>=arr.length) return prev; [arr[i],arr[j]]=[arr[j],arr[i]]; return arr; }); };
  // channels present in active orders (for filter chips)
  const chans = [...new Set(active.map(o=>o.channel))];

  return (
    <div className="kd-screen">
      <TopBar title={t('orders')} sub={lang==='th'?`${active.length} ออเดอร์ที่ต้องจัดการ · รวมทุกช่องทาง`:`${active.length} to handle`}
        right={onToggleSound && <button onClick={onToggleSound} title={soundOn?(lang==='th'?'เสียงแจ้งออเดอร์: เปิด':'Order sound: on'):(lang==='th'?'เสียงแจ้งออเดอร์: ปิด':'Order sound: off')}
          style={{ border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderRadius:12, fontFamily:'var(--font)', fontWeight:700, fontSize:12.5,
            background: soundOn?'var(--brand-soft)':'var(--bg)', color: soundOn?'var(--brand-ink)':'var(--ink-3)' }}>
          {React.cloneElement(IC.bell,{size:17})}<span>{soundOn?(lang==='th'?'เปิดเสียง':'On'):(lang==='th'?'ปิดเสียง':'Off')}</span></button>}/>
      <div style={{ display:'flex', gap:8, padding:'0 18px 10px' }}>
        {[['active',lang==='th'?'กำลังทำ':'Active'],['done',lang==='th'?'เสร็จแล้ว':'Done'],['void',lang==='th'?'ไม่รับ/ยกเลิก':'Cancelled']].map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)} style={{ border:'none', cursor:'pointer', flex:1,
            padding:'10px', borderRadius:12, fontWeight:700, fontSize:14, fontFamily:'var(--font)',
            background: filter===k?'var(--ink)':'#fff', color: filter===k?'#fff':'var(--ink-2)', boxShadow:'var(--shadow)' }}>{l}{k==='void'&&voided.length>0?` · ${voided.length}`:''}</button>
        ))}
      </div>
      {/* channel filter */}
      <div className="kd-chiprow" style={{ padding:'0 18px 12px', flexShrink:0 }}>
        <button onClick={()=>setChan('all')} className={'kd-chip-btn'+(chan==='all'?' on':'')}>{lang==='th'?'ทุกช่องทาง':'All'}</button>
        {chans.map(c=>{ const m=CHANNELS[c]||{th:c,en:c,c:'#57635C'}; const n=active.filter(o=>o.channel===c).length; return (
          <button key={c} onClick={()=>setChan(c)} className={'kd-chip-btn'+(chan===c?' on':'')} style={chan===c?{ background:m.c, boxShadow:'none' }:{}}>
            <span style={{ width:8, height:8, borderRadius:999, background: chan===c?'#fff':m.c }}/>{m[lang]||m.th} {n>0&&`· ${n}`}</button>
        );})}
      </div>
      <div className="kd-body" style={{ padding:'0 14px 24px' }}>
        {shown.length===0 && <Empty/>}
        {shown.map((o,idx)=><OrderCard key={o.id} o={o} onAdvance={()=>advance(o.id)} onPrint={()=>setSlip(o)} payTiming={payTiming} pay={pay} voidApproval={voidApproval} canApproveVoid={canApproveVoid}
          onSave={(patch)=>save(o.id,patch)} onPin={()=>togglePin(o.id)} onVoid={(info)=>voidOrder(o.id,info)} voidPin={voidPin}
          onUp={idx>0?()=>moveOrder(o.id,-1):null} onDown={idx<shown.length-1?()=>moveOrder(o.id,1):null} />)}
      </div>
      {slip && <PrintSlip order={slip} shopName={shopName} onClose={()=>setSlip(null)} />}
    </div>
  );
}
function OrderCard({ o, onAdvance, onPrint, onSave, onPin, onUp, onDown, onVoid, voidPin, payTiming, pay, voidApproval, canApproveVoid }){
  const { t, lang } = useT();
  const TH = lang==='th';
  const st = STATUS_LABEL[o.status];
  const ch = CHANNELS[o.channel]||{};
  const isPre = o.when && o.when!=='now' && !/เลย|ASAP/.test(o.when||'');
  const qtext = qLabel(o.channel, o.qnum, o.table);
  const [ed,setEd] = m2State(false);
  const [f,setF] = m2State({ customer:o.customer||'', qnum:o.qnum||'', note:o.note||'', when:o.when||'' });
  const saveEdit = ()=>{ onSave && onSave({ customer:f.customer, qnum:f.qnum, note:f.note, when:f.when }); setEd(false); };
  const [slipBig,setSlipBig] = m2State(false);
  const [voiding,setVoiding] = m2State(false);
  const [vType,setVType] = m2State('reorder');
  const [vNote,setVNote] = m2State('');
  const [vPin,setVPin] = m2State('');
  const [vRefund,setVRefund] = m2State('');
  const [collecting,setCollecting] = m2State(false);
  const [paying,setPaying] = m2State(false);   // เปิดหน้า PaySuccess (QR/ยืนยัน/ถ่ายสลิป) ตอนเก็บเงินพร้อมเพย์
  const VR = { reorder:{th:'ลูกค้ายกเลิก — สั่งใหม่',en:'Customer cancelled — re-order'}, waste:{th:'ยกเลิก — ของเสีย (ตัดสต๊อก)',en:'Void — wasted'}, mistake:{th:'กดผิด/ทดสอบ',en:'Mistake/test'} };
  const RJ = { outofstock:{th:'ของหมด / ทำไม่ได้',en:'Out of stock'}, busy:{th:'ครัวไม่ทัน / คิวยาว',en:'Too busy'}, closing:{th:'ใกล้ปิดร้าน',en:'Near closing'}, other:{th:'อื่น ๆ',en:'Other'} };
  // ออเดอร์โอน/พร้อมเพย์ (เดลิ/LINE) ต้องตรวจสลิปก่อนรับออเดอร์
  const needsSlip = (o.pay==='promptpay'||o.pay==='transfer');
  const hasSlip = !!o.slipUrl;
  const awaitingSlip = needsSlip && !o.slipVerified;
  const lockAccept = o.status==='new' && awaitingSlip;
  const isVoid = o.status==='void' || o.status==='rejected';
  const isReject = o.status==='rejected';
  // โหมดปุ่มยกเลิก: จ่ายเงินแล้ว = ยกเลิกบิล (คืนเงิน + PIN) · ออเดอร์ใหม่จากลูกค้า = ไม่รับออเดอร์ · อื่น ๆ = ยกเลิกออเดอร์
  const moneyReceived = !!o.paid && !isVoid;
  const isIncomingNew = o.status==='new' && !o.fromSale && !o.paid;
  const cancelMode = moneyReceived ? 'void' : (isIncomingNew ? 'reject' : 'cancel');
  const RMAP = cancelMode==='reject' ? RJ : VR;
  const curType = RMAP[vType] ? vType : Object.keys(RMAP)[0];
  const canCancel = !isVoid && (moneyReceived || o.status!=='done');
  const payKey = o.pay||'cash';
  const isPlat = payKey==='platform';
  const payLabel = isPlat ? (ch[lang]||ch.th||(TH?'แพลตฟอร์ม':'Platform')) : ((PAYS[payKey]||{})[lang]||(PAYS[payKey]||{}).th||payKey);
  const refundOpts = [['cash', TH?'คืนเงินสด (จากลิ้นชัก)':'Cash refund'],['transfer', TH?'โอน / พร้อมเพย์คืน':'Transfer / PromptPay'],...(isPlat?[['platform', TH?'แพลตฟอร์มคืนให้ลูกค้า':'Platform refunds']]:[]),['none', TH?'ไม่ต้องคืน (ยังไม่ได้รับเงินจริง / ทดสอบ)':'No refund needed']];
  const curRefund = vRefund || (isPlat?'platform':(payKey==='cash'?'cash':'transfer'));
  const doVoid = ()=>{ if(cancelMode==='void' && voidPin && vPin!==voidPin){ alert(TH?'รหัสยกเลิกบิลไม่ถูกต้อง':'Wrong PIN'); return; } const refLabel=(refundOpts.find(r=>r[0]===curRefund)||[])[1]||''; const reason=(RMAP[curType][lang]||RMAP[curType].th)+((cancelMode==='void'&&refLabel)?(' · คืนเงิน: '+refLabel):'')+(vNote.trim()?(' · '+vNote.trim()):''); const info={ reason, voidType:curType, refund:(cancelMode==='void'?curRefund:undefined), noStock:(cancelMode==='reject'), reject:(cancelMode==='reject') }; if(voidApproval && !canApproveVoid){ let byName='',byId=''; try{ byName=localStorage.getItem('kd_active_staff')||''; byId=localStorage.getItem('kd_staff_id')||''; }catch(e){} onSave&&onSave({ voidReq:{ ...info, byName, byId, at:Date.now() } }); setVoiding(false); return; } onVoid&&onVoid(info); setVoiding(false); };
  const pendingVoidReq = (o.voidReq && !isVoid) ? o.voidReq : null;
  return (
    <div className="kd-card kd-fadein" style={{ padding:14, marginBottom:11, borderLeft:`4px solid ${o.pin?'var(--gold,#E8992F)':(ch.c||'var(--brand)')}`, boxShadow:o.pin?'0 0 0 1.5px var(--gold,#E8992F)':undefined }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff', background:ch.c||'var(--brand)', padding:'3px 10px', borderRadius:8, fontVariantNumeric:'tabular-nums' }}>{qtext}</span>
        <span className="kd-chip" style={{ background:'var(--bg)', color:'var(--ink-2)' }}>
          {React.cloneElement(ch.ic||IC.store,{size:13})}{ch[lang]||ch.th}</span>
        {isPre && <span className="kd-chip" style={{ background:'var(--accent-soft)', color:'var(--accent-ink)' }}>{React.cloneElement(IC.clock,{size:13})} {o.when}</span>}
        {o.pin && <span className="kd-chip" style={{ background:'#FDF0E2', color:'#B26A00' }}>📌 {TH?'ทำก่อน':'Priority'}</span>}
        {o.callCash && !o.paid && <span className="kd-chip" style={{ background:'#FDE7E7', color:'#C0392B', fontWeight:700 }}>🔔 {TH?'เรียกเก็บเงินสด':'Cash call'}</span>}
        {awaitingSlip && <span className="kd-chip" style={{ background:'#FFF4D6', color:'#8A6100', fontWeight:700 }}>🧾 {hasSlip?(TH?'รอตรวจสลิป':'Verify slip'):(TH?'รอลูกค้าแนบสลิป':'Awaiting slip')}</span>}
        {needsSlip && o.slipVerified && <span className="kd-chip" style={{ background:'var(--brand-soft)', color:'var(--brand-ink)', fontWeight:700 }}>✓ {TH?'ตรวจสลิปแล้ว':'Slip OK'}</span>}
        {isReject
          ? <span className="kd-chip" style={{ background:'#FFF1E0', color:'#B45309', fontWeight:700 }}>🚫 {TH?'ไม่รับออเดอร์':'Declined'}</span>
          : isVoid && <span className="kd-chip" style={{ background:'#FDE7E7', color:'#C0392B', fontWeight:700 }}>✕ {TH?(o.voidType==='waste'?'ยกเลิก · ของเสีย':'ยกเลิกบิลแล้ว'):'Void'}</span>}
        {o.payLater && !o.paid && !isVoid && <span className="kd-chip" style={{ background:'#FFF4D6', color:'#8A6100', fontWeight:700 }}>🍽️ {TH?'รอเก็บเงิน (จ่ายที่ร้าน)':'Pay at store'}</span>}
        {o.payLater && o.paid && <span className="kd-chip" style={{ background:'var(--brand-soft)', color:'var(--brand-ink)', fontWeight:700 }}>✓ {TH?'เก็บเงินแล้ว':'Paid'}</span>}
        {!o.payLater && o.paid && !isVoid && !(o.pay==='cash') && <span className="kd-chip" style={{ background:'var(--brand-soft)', color:'var(--brand-ink)', fontWeight:700 }}>💰 {TH?'เก็บเงินลูกค้าแล้ว':'Paid'}</span>}
        <span style={{ marginLeft:'auto', fontSize:12, fontWeight:700, color:st.c,
          background: st.c+'1A', padding:'4px 10px', borderRadius:999 }}>{st[lang]||st.th}</span>
      </div>
      <div style={{ fontSize:11, color:'var(--ink-3)', marginBottom:8 }}>#{o.no}{o.customer?` · ${o.customer}`:''}{o.addr?` · ${o.addr}`:''}</div>
      {(o.acceptedByName||o.verifiedByName) && <div style={{ fontSize:10.5, color:'var(--ink-3)', marginTop:-4, marginBottom:8, display:'flex', gap:8, flexWrap:'wrap' }}>{o.acceptedByName && <span>👤 {TH?'รับโดย':'By'}: <b style={{ color:'var(--ink-2)' }}>{o.acceptedByName}</b></span>}{o.verifiedByName && <span>💰 {TH?'เก็บเงินโดย':'Paid by'}: <b style={{ color:'var(--ink-2)' }}>{o.verifiedByName}</b></span>}</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:10 }}>
        {o.items.map(([id,q,opt],i)=>{ const m=menuById(id)||{}; return (
          <div key={i} style={{ display:'flex', fontSize:14, color:'var(--ink-2)' }}>
            <span className="num" style={{ width:26, color:'var(--brand-ink)', fontWeight:700 }}>{q}×</span>
            <span style={{ flex:1 }}>{m[lang]||m.th||(lang==='th'?'(รายการที่ถูกลบ)':'(removed item)')}{opt?<span style={{ color:'var(--ink-3)', fontSize:12.5 }}> · {opt}</span>:''}</span>
          </div>
        );})}
      </div>
      {/* kitchen ↔ counter note */}
      {o.note && !ed && <div style={{ display:'flex', gap:7, alignItems:'flex-start', background:'#FFF9EC', border:'1px solid #F3E2BE', borderRadius:10, padding:'8px 11px', marginBottom:10, fontSize:13, color:'#7A5A12' }}>
        <span style={{ flexShrink:0 }}>📝</span><span style={{ flex:1 }}>{o.note}</span></div>}
      {/* time reply — ตอบลูกค้าว่าทันเวลาที่นัดไหม (เฉพาะพรีออเดอร์/มีเวลานัด) */}
      {isPre && o.status!=='done' && !ed && <div style={{ background: o.promise?(o.promise.status==='ok'?'var(--brand-soft)':'#FDF0E2'):'var(--bg)', borderRadius:10, padding:'9px 11px', marginBottom:10 }}>
        <div style={{ fontSize:12, color:'var(--ink-2)', marginBottom:7 }}>{TH?'ลูกค้าขอเวลา':'Requested'} <b>{o.when}</b>{o.promise && (o.promise.status==='ok'
          ? <span style={{ color:'var(--brand-ink)', fontWeight:700 }}> · {TH?'ยืนยันแล้ว ✅':'confirmed ✅'}</span>
          : <span style={{ color:'#B26A00', fontWeight:700 }}> · {TH?'เสนอใหม่':'proposed'} {o.promise.time} ⏰</span>)}</div>
        <div style={{ display:'flex', gap:7 }}>
          <button onClick={()=>onSave&&onSave({ promise:{ status:'ok', time:o.when } })} className="kd-btn" style={{ flex:1, padding:'8px', fontSize:12.5, background:'var(--brand)', color:'#fff' }}>{TH?'รับได้ตามเวลา':'Confirm time'}</button>
          <button onClick={()=>{ const nt=window.prompt(TH?'เสนอเวลาใหม่ให้ลูกค้า (เช่น 12:45)':'Propose a new time', o.promise?.time||o.when); if(nt) onSave&&onSave({ promise:{ status:'new', time:nt } }); }} className="kd-btn" style={{ flex:1, padding:'8px', fontSize:12.5, background:'#fff', color:'#B26A00', boxShadow:'inset 0 0 0 1.5px #E8992F' }}>{TH?'ขอเลื่อนเวลา':'Propose new'}</button>
        </div>
      </div>}
      {/* inline editor */}
      {ed && <div style={{ background:'var(--bg)', borderRadius:12, padding:12, marginBottom:10, display:'flex', flexDirection:'column', gap:9 }}>
        <div style={{ display:'flex', gap:9 }}>
          <div style={{ flex:2 }}><div style={{ fontSize:11.5, fontWeight:700, color:'var(--ink-3)', marginBottom:4 }}>{TH?'ชื่อลูกค้า':'Customer'}</div>
            <input className="kd-input" value={f.customer} onChange={e=>setF(p=>({...p,customer:e.target.value}))} placeholder={TH?'เช่น พี่โบว์':'name'}/></div>
          <div style={{ width:88 }}><div style={{ fontSize:11.5, fontWeight:700, color:'var(--ink-3)', marginBottom:4 }}>{TH?'เลขคิว':'Queue'}</div>
            <input className="kd-input num" value={f.qnum} onChange={e=>setF(p=>({...p,qnum:e.target.value}))}/></div>
        </div>
        <div><div style={{ fontSize:11.5, fontWeight:700, color:'var(--ink-3)', marginBottom:4 }}>{TH?'โน้ตถึงครัว / คนทำ':'Note to kitchen'}</div>
          <input className="kd-input" value={f.note} onChange={e=>setF(p=>({...p,note:e.target.value}))} placeholder={TH?'เช่น ไม่เผ็ด / ห่อแยก / รอลูกค้า 5 นาที':'e.g. not spicy'}/></div>
        <div><div style={{ fontSize:11.5, fontWeight:700, color:'var(--ink-3)', marginBottom:4 }}>{TH?'เวลานัดรับ':'Pickup time'}</div>
          <input className="kd-input" value={f.when} onChange={e=>setF(p=>({...p,when:e.target.value}))} placeholder={TH?'เช่น 12:30 หรือ เร็วสุด':'e.g. 12:30'}/></div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>{ setF({ customer:o.customer||'', qnum:o.qnum||'', note:o.note||'', when:o.when||'' }); setEd(false); }} className="kd-btn" style={{ flex:1, background:'#fff', color:'var(--ink-2)' }}>{TH?'ยกเลิก':'Cancel'}</button>
          <button onClick={saveEdit} className="kd-btn kd-btn-primary" style={{ flex:1 }}>{TH?'บันทึก':'Save'}</button>
        </div>
      </div>}
      {/* ตรวจสลิปโอน — ต้องยืนยันยอดก่อนรับออเดอร์ */}
      {awaitingSlip && o.status!=='done' && <div style={{ background:'#FFFBF0', border:'1px solid #F0DFB0', borderRadius:12, padding:'11px 12px', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:hasSlip?9:2 }}>
          <span style={{ fontSize:13, fontWeight:800, color:'#8A6100' }}>🧾 {TH?'ตรวจสลิปก่อนยืนยันออเดอร์':'Verify slip before accepting'}</span>
          <span className="num" style={{ marginLeft:'auto', fontSize:15, fontWeight:800, color:'var(--brand-ink)' }}>{money(o.total)}</span>
        </div>
        {hasSlip ? <>
          <div style={{ display:'flex', gap:11, alignItems:'flex-start' }}>
            <button onClick={()=>setSlipBig(true)} style={{ border:'none', padding:0, cursor:'zoom-in', background:'none', flexShrink:0 }}>
              <img src={o.slipUrl} alt="slip" style={{ width:74, height:98, objectFit:'cover', borderRadius:9, border:'1px solid var(--hair)' }}/></button>
            <div style={{ flex:1, fontSize:12.5, color:'var(--ink-2)', lineHeight:1.5 }}>{TH?'ลูกค้าแนบสลิปแล้ว — ตรวจยอดโอนให้ตรงกับยอดออเดอร์ แล้วกดยืนยัน':'Customer sent a slip — check the amount matches, then confirm'}
              <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:3 }}>{TH?'แตะรูปเพื่อขยาย':'Tap to enlarge'}</div></div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:11 }}>
            <button onClick={()=>{ const r=window.prompt(TH?'สลิปไม่ถูกต้อง? พิมพ์เหตุผลให้ลูกค้าส่งใหม่ (เช่น ยอดไม่ตรง/อ่านไม่ออก)':'Reason for the customer to resend', TH?'ยอดโอนไม่ตรง กรุณาส่งสลิปใหม่':'Amount mismatch, please resend'); if(r!=null) onSave&&onSave({ slipUrl:null, paid:false, slipVerified:false, slipStatus:'rejected', slipReject:r }); }} className="kd-btn" style={{ flex:1, padding:'10px', fontSize:13, background:'#FDE7E7', color:'#C0392B', fontWeight:700 }}>✕ {TH?'สลิปไม่ถูก':'Reject'}</button>
            <button onClick={()=>{ onSave&&onSave({ paid:true, slipVerified:true, slipStatus:'verified' }); onAdvance&&onAdvance(); }} className="kd-btn kd-btn-primary" style={{ flex:2, padding:'10px', fontSize:13.5, fontWeight:700 }}>✓ {TH?'ยืนยันรับเงิน · รับออเดอร์':'Confirm & accept'}</button>
          </div>
        </> : <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:2 }}>{TH?'⏳ รอลูกค้าแนบสลิปโอนเงิน — ยังยืนยันออเดอร์ไม่ได้':'⏳ Waiting for the customer to upload the slip'}</div>}
      </div>}
      {pendingVoidReq && <div style={{ marginBottom:10, padding:'11px 12px', borderRadius:12, background: canApproveVoid?'#FFF7F5':'#FFFAF3', border:'1px solid '+(canApproveVoid?'#F3D6CE':'#F0DFB0') }}>
        <div style={{ fontSize:12.5, fontWeight:800, color: canApproveVoid?'var(--danger)':'#8A6100', marginBottom:4 }}>🚫 {TH?(o.paid?'คำขอยกเลิกบิล (รออนุมัติ)':'คำขอยกเลิก/ไม่รับออเดอร์ (รออนุมัติ)'):'Void request'}</div>
        <div style={{ fontSize:12, color:'var(--ink-2)', lineHeight:1.5 }}>{pendingVoidReq.byName?<b>{pendingVoidReq.byName}</b>:null}{pendingVoidReq.byName?' · ':''}{pendingVoidReq.reason}</div>
        {canApproveVoid
          ? <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <button onClick={()=>{ onSave&&onSave({ voidReq:null }); }} className="kd-btn" style={{ flex:1, padding:'9px', background:'var(--bg)', color:'var(--ink-2)', fontSize:13 }}>{TH?'ไม่อนุมัติ':'Reject'}</button>
              <button onClick={()=>{ onVoid&&onVoid({ reason:pendingVoidReq.reason, voidType:pendingVoidReq.voidType, refund:pendingVoidReq.refund, noStock:!!pendingVoidReq.reject, reject:!!pendingVoidReq.reject }); }} className="kd-btn" style={{ flex:1.4, padding:'9px', background:'var(--danger)', color:'#fff', fontWeight:700, fontSize:13 }}>{TH?'อนุมัติยกเลิก':'Approve'}</button>
            </div>
          : <div style={{ fontSize:11.5, color:'#8A6100', marginTop:7 }}>{TH?'⏳ รอเจ้าของร้าน/ผู้จัดการอนุมัติ':'⏳ Awaiting owner/manager approval'}</div>}
      </div>}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div className="num" style={{ fontWeight:700, fontSize:15 }}>{money(o.total)}</div>
          <span className="kd-chip" style={{ background:'var(--bg)', color:'var(--ink-2)' }}>{React.cloneElement((PAYS[o.pay]||{}).ic||IC.wallet,{size:13})} {(PAYS[o.pay]||{})[lang]||(PAYS[o.pay]||{}).th||(o.pay==='platform'?(TH?'แพลตฟอร์ม':'Platform'):(TH?'อื่น ๆ':'Other'))}</span>
          {o.pay==='cash' && (o.paid
            ? <span className="kd-chip" style={{ background:'var(--brand-soft)', color:'var(--brand-ink)', fontWeight:700 }}>✓ {TH?'รับเงินแล้ว':'Paid'}</span>
            : <button onClick={()=>onSave&&onSave({ paid:true, callCash:false })} className="kd-btn" style={{ padding:'8px 12px', background:'#E3F5E9', color:'var(--brand-ink)', fontSize:13, fontWeight:700 }}>💵 {TH?'รับเงินสด · จบบิล':'Cash · close'}</button>)}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', rowGap:6 }}>
          {o.status!=='done' && <div style={{ display:'flex', gap:3 }}>
            {onPin && <button onClick={onPin} title={TH?'ทำก่อน':'Priority'} className="kd-btn" style={{ padding:'8px 9px', fontSize:14, background:o.pin?'#FDF0E2':'var(--bg)', color:o.pin?'#B26A00':'var(--ink-3)' }}>📌</button>}
            {onUp && <button onClick={onUp} title={TH?'เลื่อนขึ้น':'Up'} className="kd-btn" style={{ padding:'8px 9px', background:'var(--bg)', color:'var(--ink-2)' }}>{React.cloneElement(IC.chevUp||IC.chev,{size:15})}</button>}
            {onDown && <button onClick={onDown} title={TH?'เลื่อนลง':'Down'} className="kd-btn" style={{ padding:'8px 9px', background:'var(--bg)', color:'var(--ink-2)' }}>{React.cloneElement(IC.chevDown||IC.chev,{size:15})}</button>}
            <button onClick={()=>setEd(v=>!v)} title={TH?'แก้ไข':'Edit'} className="kd-btn" style={{ padding:'8px 9px', background:'var(--bg)', color:'var(--ink-2)' }}>{React.cloneElement(IC.edit,{size:15})}</button>
          </div>}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto' }}>
            <button onClick={onPrint} title="print" className="kd-btn" style={{ padding:'9px 12px', background:'var(--brand-soft)', color:'var(--brand-ink)', fontSize:13 }}>{React.cloneElement(IC.receipt,{size:16})}</button>
            {canCancel && !pendingVoidReq && <button onClick={()=>setVoiding(v=>!v)} title={cancelMode==='void'?(TH?'ยกเลิกบิล · คืนเงิน':'Void · refund'):cancelMode==='reject'?(TH?'ไม่รับออเดอร์':'Decline'):(TH?'ยกเลิกออเดอร์':'Cancel order')} className="kd-btn" style={{ padding:'9px 13px', background: cancelMode==='void'?'#FCECE8':'#FFF3EC', color: cancelMode==='void'?'var(--danger)':'#B45309', fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}>{React.cloneElement(IC.x,{size:14})} {cancelMode==='void'?(TH?'ยกเลิกบิล':'Void'):cancelMode==='reject'?(TH?'ไม่รับออเดอร์':'Decline'):(TH?'ยกเลิก':'Cancel')}</button>}
            {o.payLater && !o.paid && !isVoid && (payTiming!=='afterDone' || o.status==='done') && <button onClick={()=>setCollecting(v=>!v)} className="kd-btn" style={{ padding:'10px 14px', fontSize:14, whiteSpace:'nowrap', background:'#8A6100', color:'#fff', fontWeight:700 }}>{React.cloneElement(IC.wallet,{size:15})} {TH?'เก็บเงิน':'Collect'}</button>}
            {o.status!=='done' && !isVoid && !lockAccept && !(payTiming!=='afterDone' && o.payLater && !o.paid && o.status==='ready') && <button onClick={onAdvance} className="kd-btn kd-btn-primary" style={{ padding:'10px 16px', fontSize:14, whiteSpace:'nowrap' }}>
              {o.status==='new'?(lang==='th'?'รับออเดอร์':'Accept')
                : o.status==='cooking'?(lang==='th'?'ทำเสร็จ':'Ready')
                : o.status==='ready'&&(o.channel==='delivery'||CHANNELS[o.channel]?.online)?(lang==='th'?'ส่ง/รับแล้ว':'Handover')
                : (lang==='th'?'ปิดออเดอร์':'Complete')}
            </button>}
          </div>
        </div>
        {collecting && !o.paid && <div className="kd-fadein" style={{ marginTop:11, padding:'12px 13px', background:'#FFFBF0', border:'1px solid #F0DFB0', borderRadius:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
            <span style={{ fontSize:13, fontWeight:800, color:'#8A6100' }}>{TH?'เก็บเงิน · ปิดบิล':'Collect · close bill'}</span>
            <span className="num" style={{ marginLeft:'auto', fontSize:15, fontWeight:800, color:'var(--brand-ink)' }}>{money(o.total)}</span>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>{ onSave&&onSave({ paid:true, payMethod:'cash', pay:'cash', paidAt:Date.now(), status:'done' }); setCollecting(false); }} className="kd-btn" style={{ flex:1, padding:'11px', background:'var(--brand)', color:'#fff', fontWeight:700, fontSize:13 }}>{React.cloneElement(IC.wallet,{size:15})} {TH?'รับเงินสด · ปิดบิล':'Cash · close'}</button>
            <button onClick={()=>setPaying(true)} className="kd-btn" style={{ flex:1, padding:'11px', background:'#fff', border:'1.5px solid var(--brand)', color:'var(--brand-ink)', fontWeight:700, fontSize:13 }}>{React.cloneElement(IC.qr||IC.scan,{size:15})} {TH?'พร้อมเพย์ · สแกน/ถ่ายสลิป':'PromptPay · scan/slip'}</button>
          </div>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:8, lineHeight:1.5 }}>{TH?'พร้อมเพย์ = ตรวจยอดเข้าบัญชี/สลิปให้ตรงก่อนกดยืนยัน · กดแล้วบิลจะถูกปิด':'PromptPay = verify the transfer/slip before confirming · this closes the bill'}</div>
        </div>}
        {paying && window.PaySuccess && <div style={{ position:'fixed', inset:0, zIndex:400, background:'#fff' }}>{React.createElement(window.PaySuccess, {
          data:{ total:o.total, qrImg:(pay&&pay.qrImg)||null },
          slipMode:(pay&&pay.slipReq)||'optional',
          ppName:(pay&&pay.shopName)||'',
          onBack:()=>setPaying(false),
          onConfirm:(extra)=>{ extra=extra||{}; onSave&&onSave({ paid:true, pay:'promptpay', payMethod:'promptpay', slipVerified:true, ...(extra.slipUrl?{ slipUrl:extra.slipUrl, slipStatus:'verified' }:{}), paidAt:Date.now(), status:'done' }); setPaying(false); setCollecting(false); }
        })}</div>}
        {voiding && <div className="kd-fadein" style={{ marginTop:11, padding:'12px 13px', background: cancelMode==='void'?'#FFF7F5':'#FFFAF3', border:'1px solid '+(cancelMode==='void'?'#F3D6CE':'#F0DFB0'), borderRadius:12 }}>
          <div style={{ fontSize:13, fontWeight:800, color: cancelMode==='void'?'var(--danger)':'#B45309', marginBottom:9 }}>{cancelMode==='void'?(TH?'ยกเลิกบิลที่รับเงินแล้ว — เลือกเหตุผล':'Void a paid bill — reason'):cancelMode==='reject'?(TH?'ไม่รับออเดอร์นี้ — เลือกเหตุผล':'Decline this order — reason'):(TH?'ยกเลิกออเดอร์นี้ — เลือกเหตุผล':'Cancel this order — reason')}</div>
          {cancelMode==='void' && <div style={{ fontSize:12, color:'var(--danger)', marginBottom:10, lineHeight:1.5 }}>{TH?'บิลนี้เก็บเงินแล้ว — การยกเลิกจะกลับรายการยอดขายและคืนสต๊อก':'This bill is paid — voiding reverses the sale and returns stock.'}</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:9 }}>
            {Object.keys(RMAP).map(k=>(
              <button key={k} onClick={()=>setVType(k)} style={{ textAlign:'left', cursor:'pointer', border:'2px solid '+(curType===k?'var(--danger)':'var(--hair-2)'), background:curType===k?'#FDE7E7':'#fff', borderRadius:10, padding:'9px 12px', fontFamily:'var(--font)', fontSize:13, fontWeight:600, color:'var(--ink)' }}>
                {RMAP[k][lang]||RMAP[k].th}
                {k==='reorder'&&<span style={{ display:'block', fontSize:11, color:'var(--ink-3)', fontWeight:500, marginTop:1 }}>{TH?'ไม่คืนสต๊อก (จะสั่งใหม่)':'Stock stays used (re-order)'}</span>}
                {k==='waste'&&<span style={{ display:'block', fontSize:11, color:'var(--ink-3)', fontWeight:500, marginTop:1 }}>{TH?'ตัดสต๊อกเป็นของเสีย ไม่คืนระบบ':'Counted as waste, stock not returned'}</span>}
              </button>
            ))}
          </div>
          {cancelMode==='void' && <>
            <div style={{ fontSize:12.5, color:'var(--ink-2)', marginBottom:7 }}>{TH?'ลูกค้าชำระผ่าน':'Paid via'}: <b>{payLabel}</b>{o.total?<> · <span className="num">{money(o.total)}</span></>:null}</div>
            <div style={{ fontSize:12.5, fontWeight:700, color:'var(--ink-2)', margin:'2px 0 7px' }}>{TH?'คืนเงินให้ลูกค้าอย่างไร?':'How is the refund given?'}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:11 }}>
              {refundOpts.map(([k,l])=>(<button key={k} onClick={()=>setVRefund(k)} style={{ cursor:'pointer', border:'2px solid '+(curRefund===k?'var(--danger)':'var(--hair-2)'), background:curRefund===k?'#FDE7E7':'#fff', borderRadius:999, padding:'8px 13px', fontFamily:'var(--font)', fontSize:12.5, fontWeight:600, color:'var(--ink)' }}>{l}</button>))}
            </div>
          </>}
          <input className="kd-input" value={vNote} onChange={e=>setVNote(e.target.value)} placeholder={TH?'หมายเหตุเพิ่มเติม (ไม่บังคับ)':'Extra note (optional)'} style={{ marginBottom:9 }}/>
          {cancelMode==='void' && voidPin && <input className="kd-input num" inputMode="numeric" maxLength={6} value={vPin} onChange={e=>setVPin(e.target.value.replace(/\D/g,''))} placeholder={TH?'ใส่รหัสยกเลิกบิล':'Enter void PIN'} style={{ letterSpacing:'3px', fontWeight:700, textAlign:'center', marginBottom:9 }}/>}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setVoiding(false)} className="kd-btn" style={{ flex:1, padding:'10px', background:'var(--bg)', color:'var(--ink-2)', fontSize:13 }}>{TH?'ปิด':'Close'}</button>
            <button onClick={doVoid} className="kd-btn" style={{ flex:2, padding:'10px', background:'var(--danger)', color:'#fff', fontWeight:700, fontSize:13.5 }}>{cancelMode==='void'?(TH?'ยืนยันยกเลิกบิล':'Confirm void'):cancelMode==='reject'?(TH?'ยืนยันไม่รับออเดอร์':'Confirm decline'):(TH?'ยืนยันยกเลิก':'Confirm cancel')}</button>
          </div>
        </div>}
        {isVoid && o.voidReason && <div style={{ marginTop:9, fontSize:12.5, color:isReject?'#B45309':'var(--danger)', fontWeight:600 }}>{TH?'เหตุผล: ':'Reason: '}{o.voidReason}</div>}
        {o.refund && <RefundFulfill o={o} onSave={onSave}/>}
      </div>
      {slipBig && o.slipUrl && <div onClick={()=>setSlipBig(false)} style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(10,20,15,.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, cursor:'zoom-out' }}>
        <img src={o.slipUrl} alt="slip" style={{ maxWidth:'100%', maxHeight:'88vh', borderRadius:14, boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}/></div>}
    </div>
  );
}
function Empty(){ const {lang}=useT(); return <div style={{ textAlign:'center', color:'var(--ink-3)', padding:'60px 20px', fontSize:14 }}>
  <div style={{ fontSize:38, marginBottom:8 }}>🌿</div>{lang==='th'?'ยังไม่มีรายการ':'Nothing here yet'}</div>; }

/* ══════════════ DASHBOARD ══════════════ */
function DashboardScreen({ sales:salesAll, menu, raw, costMode, embedded, store }){
  const TH = (typeof useT==='function' ? (useT().lang==='th') : true);
  const [dMode,setDMode]=React.useState('day');
  const [dayVal,setDayVal]=React.useState(()=>{ try{ return new Date().toISOString().slice(0,10); }catch(e){ return ''; } });
  const [monVal,setMonVal]=React.useState(()=>{ try{ return new Date().toISOString().slice(0,7); }catch(e){ return ''; } });
  const sales = dMode==='all' ? salesAll : dMode==='month' ? salesAll.filter(s=>(s.date||'').slice(0,7)===monVal) : salesAll.filter(s=>(s.date||'')===dayVal);
  const { t, lang } = useT();
  const rev = sales.filter(s=>!s.void).reduce((a,s)=>a+saleTotal(s),0);
  const cost = sales.filter(s=>!s.void).reduce((a,s)=>a+effSaleCost(s, menu, raw, costMode),0);
  const profit = rev-cost;
  const margin = rev? Math.round(profit/rev*100):0;
  const orders = sales.length;

  // by channel
  const byCh = {};
  sales.forEach(s=>{ byCh[s.channel]=(byCh[s.channel]||0)+saleTotal(s); });
  // best sellers
  const qty={}; sales.forEach(s=>s.items.forEach(([id,q])=>{ qty[id]=(qty[id]||0)+q; }));
  const best = Object.entries(qty).sort((a,b)=>b[1]-a[1]).slice(0,4);
  // hourly bars (สแต็กแยกช่องทาง)
  const hours={}; const hoursCh={};
  sales.forEach(s=>{ const h=(s.t||'12:00').slice(0,2); const v=saleTotal(s); hours[h]=(hours[h]||0)+v; (hoursCh[h]=hoursCh[h]||{})[s.channel]=((hoursCh[h]||{})[s.channel]||0)+v; });
  const hkeys = Object.keys(hours).sort();
  const hmax = Math.max(...Object.values(hours),1);
  const hourChans = [...new Set(Object.values(hoursCh).flatMap(o=>Object.keys(o)))];
  // channel name (รองรับ custom sale mode)
  const chName=(k)=>{ const m=(store&&store.chanCfg&&chMeta(store.chanCfg,k))||CHANNELS[k]||{th:k,en:k}; return m[lang]||m.th; };
  const chColor=(k)=>{ const m=(store&&store.chanCfg&&chMeta(store.chanCfg,k))||CHANNELS[k]||{}; return m.c||'var(--brand)'; };
  const [hourMode,setHourMode]=React.useState('stack');
  // by payment method
  const PAY_LABEL={ cash:{th:'เงินสด',en:'Cash'}, promptpay:{th:'พร้อมเพย์',en:'PromptPay'} };
  const byPay={}; sales.forEach(s=>{ const k=s.pay||'cash'; byPay[k]=(byPay[k]||0)+saleTotal(s); });
  // platform receivables (ยอดค้างรับ — ยังไม่ settled)
  const _today=(new Date()).toISOString().slice(0,10);
  const platformRecv={}; const settledToday={};
  sales.forEach(s=>{ if(s.pay!=='platform') return; if(s.settled){ if(s.settledDate===_today) settledToday[s.channel]=(settledToday[s.channel]||0)+(s.receivedAmount!=null?s.receivedAmount:saleTotal(s)); } else { platformRecv[s.channel]=(platformRecv[s.channel]||0)+saleTotal(s); } });
  const recvKeys=Object.keys(platformRecv); const recvTotal=recvKeys.reduce((a,k)=>a+platformRecv[k],0);
  // ── พิมพ์รายงาน (สรุปรวม / รายละเอียดกระทบยอดแพลตฟอร์ม) ──
  const [report,setReport]=React.useState(null);
  const [settleFor,setSettleFor]=React.useState(null);
  const [settleAmt,setSettleAmt]=React.useState('');
  const [settleDate,setSettleDate]=React.useState(()=>new Date().toISOString().slice(0,10));
  const [verifyFor,setVerifyFor]=React.useState(null);
  const [verifyDetailOpen,setVerifyDetailOpen]=React.useState(false);
  const [matchOpen,setMatchOpen]=React.useState(false);
  const [matchText,setMatchText]=React.useState('');
  const [verifyAmt,setVerifyAmt]=React.useState('');
  const [verifySlipUrl,setVerifySlipUrl]=React.useState(null);
  const [vatMonth,setVatMonth]=React.useState(()=>new Date().toISOString().slice(0,7));
  const [vatView,setVatView]=React.useState('detail');
  const _vatOn = !!(store && store.pay && store.pay.vatMode && store.pay.vatMode!=='off');
  const _dlCsv=(csv,name)=>{ try{ const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=(name||'report')+'.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>{ try{ document.body.removeChild(a); }catch(e){} URL.revokeObjectURL(u); },1500); }catch(e){} };
  const pickSlip=(id)=>{ try{ const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(!f||!store) return; const r=new FileReader(); r.onload=()=>store.verifySale(id, r.result); r.readAsDataURL(f); }; inp.click(); }catch(e){} };
  const pickSlipToState=()=>{ try{ const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>setVerifySlipUrl(r.result); r.readAsDataURL(f); }; inp.click(); }catch(e){} };
  const openVerify=(s)=>{ setVerifyFor(s); setVerifyAmt(String(Math.round(saleTotal(s)))); setVerifySlipUrl(s.slipUrl||null); };
  const viewSlip=(url)=>{ try{ const w=window.open(''); if(w) w.document.write('<img src="'+url+'" style="width:100%">'); }catch(e){} };
  const _shopName=(store&&store.shop&&store.shop.name)||(TH?'ร้านของฉัน':'My shop');
  const _esc=(s)=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const _M=(n)=>'฿'+Math.round(Number(n)||0).toLocaleString('en-US');
  const _dd=(iso)=>{ if(!iso) return '-'; try{ return new Date(iso).toLocaleDateString(TH?'th-TH':'en-US',{day:'2-digit',month:'short',year:'2-digit'}); }catch(e){ return iso; } };
  const _no=(s)=>s&&s.no?('#'+s.no):('#'+String((s&&s.id)||'').slice(-4));
  const _printOut=(title,inner)=>{
    const css="*{margin:0;padding:0;box-sizing:border-box}@page{size:A4;margin:15mm}body{font-family:'IBM Plex Sans Thai',sans-serif;color:#132a20;font-size:13px;line-height:1.5}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #26619C;padding-bottom:12px;margin-bottom:16px}.shop{font-size:20px;font-weight:700;color:#13304E}.doct{font-size:22px;font-weight:800;color:#26619C}.meta{font-size:11px;color:#555;margin-top:5px;text-align:right}.grid{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px}.box{flex:1;min-width:130px;background:#E9EFF5;border-radius:8px;padding:10px 13px}.bl{font-size:11px;color:#26619C;font-weight:700}.bv{font-size:18px;font-weight:800;margin-top:2px}h3{font-size:14px;color:#13304E;margin:15px 0 7px}table{width:100%;border-collapse:collapse;margin-bottom:6px}th{background:#13304E;color:#fff;font-size:11.5px;padding:7px 9px;text-align:left}td{padding:7px 9px;border-bottom:1px solid #e5eae7;font-size:12px}.c{text-align:center}.r{text-align:right}tfoot td{font-weight:800;border-top:2px solid #26619C;color:#13304E}.pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700}";
    const doc='<!DOCTYPE html><ht'+'ml><he'+'ad><meta charset="utf-8"><ti'+'tle>'+_esc(title)+'</ti'+'tle><li'+'nk href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;700;800&display=swap" rel="stylesheet"><sty'+'le>'+css+'</sty'+'le></he'+'ad><bo'+'dy><div class="head"><div><div class="shop">'+_esc(_shopName)+'</div><div style="color:#666;font-size:11px;margin-top:2px">'+_esc((store&&store.shop&&store.shop.address)||'')+'</div></div><div style="text-align:right"><div class="doct">'+_esc(title)+'</div><div class="meta"><b>'+(TH?'พิมพ์เมื่อ':'Printed')+'</b> '+_esc(new Date().toLocaleString(TH?'th-TH':'en-US',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}))+'</div></div></div>'+inner+'</bo'+'dy></ht'+'ml>';
    try{ const ifr=document.createElement('iframe'); ifr.setAttribute('aria-hidden','true'); ifr.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      ifr.onload=()=>{ setTimeout(()=>{ try{ ifr.contentWindow.focus(); ifr.contentWindow.print(); }catch(e){ try{ window.print(); }catch(_){} } setTimeout(()=>{ try{ document.body.removeChild(ifr); }catch(e){} },900); },350); };
      document.body.appendChild(ifr); const d=ifr.contentWindow.document; d.open(); d.write(doc); d.close();
    }catch(e){}
  };
  const _repCss=".kdrep{font-family:var(--font);color:#132a20;font-size:13px;line-height:1.5}.kdrep .grid{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px}.kdrep .box{flex:1;min-width:120px;background:#E9EFF5;border-radius:10px;padding:11px 13px}.kdrep .bl{font-size:11px;color:#26619C;font-weight:700}.kdrep .bv{font-size:18px;font-weight:800;margin-top:2px}.kdrep h3{font-size:14px;color:#13304E;margin:15px 0 7px}.kdrep table{width:100%;border-collapse:collapse;margin-bottom:6px}.kdrep th{background:#13304E;color:#fff;font-size:11.5px;padding:7px 9px;text-align:left}.kdrep td{padding:7px 9px;border-bottom:1px solid #e5eae7;font-size:12px}.kdrep .c{text-align:center}.kdrep .r{text-align:right}.kdrep tfoot td{font-weight:800;border-top:2px solid #26619C;color:#13304E}.kdrep .pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700}";
  const buildSummary=()=>{
    const box=(l,v,col)=>'<div class="box"><div class="bl">'+l+'</div><div class="bv" style="color:'+(col||'#132a20')+'">'+v+'</div></div>';
    const chRows=Object.entries(byCh).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<tr><td>'+_esc(chName(k))+'</td><td class="r">'+_M(v)+'</td></tr>').join('')||'<tr><td colspan="2" class="c" style="color:#888">-</td></tr>';
    const payMap={cash:TH?'เงินสด':'Cash',transfer:TH?'เงินโอน':'Transfer',promptpay:TH?'พร้อมเพย์':'PromptPay',platform:TH?'แพลตฟอร์ม (รอรับ)':'Platform'};
    const payRows=['cash','promptpay','platform'].filter(k=>byPay[k]).map(k=>'<tr><td>'+_esc(payMap[k])+'</td><td class="r">'+_M(byPay[k])+'</td></tr>').join('')||'<tr><td colspan="2" class="c" style="color:#888">-</td></tr>';
    const dueRows=recvKeys.map(k=>'<tr><td>'+_esc(chName(k))+'</td><td class="r" style="color:#B26A00">'+_M(platformRecv[k])+'</td></tr>').join('');
    const bestRows=best.map(([id,q],i)=>{ const m=menuById(id); return '<tr><td class="c">'+(i+1)+'</td><td>'+_esc((m&&(m[lang]||m.th))||id)+'</td><td class="r">'+q+'</td></tr>'; }).join('')||'<tr><td colspan="3" class="c" style="color:#888">-</td></tr>';
    const inner='<div class="grid">'+box(TH?'รายรับ':'Revenue',_M(rev),'#13304E')+box(TH?'กำไร':'Profit',_M(profit),'#13304E')+box(TH?'ต้นทุน':'Cost',_M(cost),'#B26A00')+box(TH?'บิล':'Bills',orders)+'</div>'
      +'<h3>'+(TH?'ยอดตามช่องทางขาย':'By channel')+'</h3><table><tbody>'+chRows+'</tbody></table>'
      +'<h3>'+(TH?'ช่องทางการชำระเงิน':'By payment')+'</h3><table><tbody>'+payRows+'</tbody></table>'
      +(dueRows?'<h3>'+(TH?'ยอดค้างรับจากแพลตฟอร์ม':'Platform due')+'</h3><table><tbody>'+dueRows+'<tr><td style="font-weight:800">'+(TH?'รวม':'Total')+'</td><td class="r" style="font-weight:800;color:#B26A00">'+_M(recvTotal)+'</td></tr></tbody></table>':'')
      +'<h3>'+(TH?'เมนูขายดี':'Best sellers')+'</h3><table><thead><tr><th class="c" style="width:34px">#</th><th>'+(TH?'เมนู':'Item')+'</th><th class="r" style="width:70px">'+(TH?'จาน':'Sold')+'</th></tr></thead><tbody>'+bestRows+'</tbody></table>';
    return { title:(TH?'รายงานยอดรวม':'Summary report'), inner };
  };
  const buildVatReport=(view)=>{
    const summary = view==='summary';
    const r=(Number(store.pay&&store.pay.vatRate)||7)/100;
    const list = sales.filter(s=>!s.void && String(s.date||'').slice(0,7)===vatMonth).sort((a,b)=>((a.date||'')+(a.t||'')).localeCompare((b.date||'')+(b.t||'')));
    const recs = list.map(s=>{ const g=saleTotal(s); const base=(s.vatBase!=null?Number(s.vatBase):g/(1+r)); const vat=(s.vat!=null?Number(s.vat):g-base); return { s, g, base, vat }; });
    const tb=recs.reduce((a,x)=>a+x.base,0), tv=recs.reduce((a,x)=>a+x.vat,0), tg=recs.reduce((a,x)=>a+x.g,0);
    const parts=vatMonth.split('-'); const monTxt=parts[1]+'/'+parts[0];
    const grid='<div class="grid">'
      +'<div class="box"><div class="bl">'+(TH?'มูลค่าก่อน VAT':'Before VAT')+'</div><div class="bv">'+_M(tb)+'</div></div>'
      +'<div class="box"><div class="bl">'+(TH?'ภาษีขาย':'Output VAT')+' '+Math.round(r*100)+'%</div><div class="bv" style="color:#13304E">'+_M(tv)+'</div></div>'
      +'<div class="box"><div class="bl">'+(TH?'รวม':'Total')+'</div><div class="bv">'+_M(tg)+'</div></div>'
      +'<div class="box"><div class="bl">'+(TH?'จำนวนใบ':'Invoices')+'</div><div class="bv">'+recs.length+'</div></div></div>';
    const trs = recs.map(x=>'<tr><td>'+_dd(x.s.date)+'</td><td>'+_no(x.s)+'</td><td>'+_esc(chName(x.s.channel))+'</td><td class="r">'+x.base.toFixed(2)+'</td><td class="r">'+x.vat.toFixed(2)+'</td><td class="r">'+x.g.toFixed(2)+'</td></tr>').join('')
      || '<tr><td colspan="6" class="c" style="color:#888;padding:14px">'+(TH?'ไม่มีบิลในเดือนนี้':'No bills this month')+'</td></tr>';
    const table='<table><thead><tr><th>'+(TH?'วันที่':'Date')+'</th><th>'+(TH?'เลขที่ใบกำกับ':'Invoice no')+'</th><th>'+(TH?'ช่องทาง':'Channel')+'</th><th class="r">'+(TH?'มูลค่าก่อน VAT':'Before VAT')+'</th><th class="r">VAT</th><th class="r">'+(TH?'รวม':'Total')+'</th></tr></thead><tbody>'+trs+'</tbody>'
      +'<tfoot><tr><td colspan="3">'+(TH?'รวมทั้งเดือน':'Month total')+'</td><td class="r">'+tb.toFixed(2)+'</td><td class="r">'+tv.toFixed(2)+'</td><td class="r">'+tg.toFixed(2)+'</td></tr></tfoot></table>';
    const inner='<div style="font-size:12px;color:#555;margin-bottom:10px">'+(TH?'รายงานภาษีขาย (Output Tax) ประจำเดือน ':'Output tax report ')+monTxt+((store.pay&&store.pay.taxId)?(' · '+(TH?'เลขผู้เสียภาษี ':'Tax ID ')+_esc(store.pay.taxId)):'')+'</div>'
      +grid+(summary?'':table)
      +'<div style="font-size:11px;color:#777;margin-top:8px;line-height:1.5">'+(TH?'นำยอด “ภาษีขาย” ไปกรอกแบบ ภ.พ.30 (ยื่นภายในวันที่ 15 ของเดือนถัดไป)':'Use the output-VAT total to file form P.P.30 (by the 15th of next month)')+'</div>';
    const head=[(TH?'วันที่':'Date'),(TH?'เลขที่ใบกำกับ':'Invoice no'),(TH?'ช่องทาง':'Channel'),(TH?'มูลค่าก่อน VAT':'Before VAT'),'VAT',(TH?'รวม':'Total')];
    const csv=[head].concat(recs.map(x=>[x.s.date||'', x.s.no?('#'+x.s.no):'', chName(x.s.channel), x.base.toFixed(2), x.vat.toFixed(2), x.g.toFixed(2)]))
      .concat([[TH?'รวมทั้งเดือน':'Month total','','',tb.toFixed(2),tv.toFixed(2),tg.toFixed(2)]])
      .map(row=>row.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    return { title:(TH?'ภาษีขาย ':'VAT sales ')+monTxt+(summary?(TH?' · สรุป':' · summary'):''), inner, csv, fileName:'vat-sales-'+vatMonth };
  };
  const buildVatPurchaseReport=(view)=>{
    const summary = view==='summary';
    const purch=(store&&store.purchases)||[];
    const list = purch.filter(p=>p.hasVat && String(p.date||'').slice(0,7)===vatMonth).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
    const recs = list.map(p=>{ const base=Number(p.vatBase)||0; const vat=Number(p.vat)||0; return { p, base, vat, g:base+vat }; });
    const tb=recs.reduce((a,x)=>a+x.base,0), tv=recs.reduce((a,x)=>a+x.vat,0), tg=recs.reduce((a,x)=>a+x.g,0);
    const parts=vatMonth.split('-'); const monTxt=parts[1]+'/'+parts[0];
    const grid='<div class="grid">'
      +'<div class="box"><div class="bl">'+(TH?'มูลค่าก่อน VAT':'Before VAT')+'</div><div class="bv">'+_M(tb)+'</div></div>'
      +'<div class="box"><div class="bl">'+(TH?'ภาษีซื้อ':'Input VAT')+'</div><div class="bv" style="color:#B26A00">'+_M(tv)+'</div></div>'
      +'<div class="box"><div class="bl">'+(TH?'รวม':'Total')+'</div><div class="bv">'+_M(tg)+'</div></div>'
      +'<div class="box"><div class="bl">'+(TH?'จำนวนใบ':'Invoices')+'</div><div class="bv">'+recs.length+'</div></div></div>';
    const trs = recs.map(x=>'<tr><td>'+_dd(x.p.date)+'</td><td>'+_esc(x.p.note||'-')+'</td><td>'+_esc(x.p.supplierTaxId||'-')+'</td><td class="r">'+x.base.toFixed(2)+'</td><td class="r">'+x.vat.toFixed(2)+'</td><td class="r">'+x.g.toFixed(2)+'</td></tr>').join('')
      || '<tr><td colspan="6" class="c" style="color:#888;padding:14px">'+(TH?'ไม่มีบิลซื้อที่มีใบกำกับภาษีในเดือนนี้':'No VAT purchases this month')+'</td></tr>';
    const table='<table><thead><tr><th>'+(TH?'วันที่':'Date')+'</th><th>'+(TH?'ผู้ขาย/หมายเหตุ':'Supplier/note')+'</th><th>'+(TH?'เลขผู้เสียภาษี':'Tax ID')+'</th><th class="r">'+(TH?'มูลค่าก่อน VAT':'Before VAT')+'</th><th class="r">VAT</th><th class="r">'+(TH?'รวม':'Total')+'</th></tr></thead><tbody>'+trs+'</tbody>'
      +'<tfoot><tr><td colspan="3">'+(TH?'รวมทั้งเดือน':'Month total')+'</td><td class="r">'+tb.toFixed(2)+'</td><td class="r">'+tv.toFixed(2)+'</td><td class="r">'+tg.toFixed(2)+'</td></tr></tfoot></table>';
    const inner='<div style="font-size:12px;color:#555;margin-bottom:10px">'+(TH?'รายงานภาษีซื้อ (Input Tax) ประจำเดือน ':'Input tax report ')+monTxt+'</div>'
      +grid+(summary?'':table)
      +'<div style="font-size:11px;color:#777;margin-top:8px;line-height:1.5">'+(TH?'นับเฉพาะบิลซื้อที่ติ๊ก “มีใบกำกับภาษี” · นำยอด “ภาษีซื้อ” ไปหักในแบบ ภ.พ.30':'Only purchases marked “has tax invoice” · deduct input VAT in P.P.30')+'</div>';
    const head=[(TH?'วันที่':'Date'),(TH?'ผู้ขาย/หมายเหตุ':'Supplier/note'),(TH?'เลขผู้เสียภาษี':'Tax ID'),(TH?'มูลค่าก่อน VAT':'Before VAT'),'VAT',(TH?'รวม':'Total')];
    const csv=[head].concat(recs.map(x=>[x.p.date||'', x.p.note||'', x.p.supplierTaxId||'', x.base.toFixed(2), x.vat.toFixed(2), x.g.toFixed(2)]))
      .concat([[TH?'รวมทั้งเดือน':'Month total','','',tb.toFixed(2),tv.toFixed(2),tg.toFixed(2)]])
      .map(row=>row.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    return { title:(TH?'ภาษีซื้อ ':'VAT purchases ')+monTxt+(summary?(TH?' · สรุป':' · summary'):''), inner, csv, fileName:'vat-purchases-'+vatMonth };
  };
  const buildPP30=()=>{
    const r=(Number(store.pay&&store.pay.vatRate)||7)/100;
    const outV = sales.filter(s=>!s.void && String(s.date||'').slice(0,7)===vatMonth).reduce((a,s)=>{ const g=saleTotal(s); const base=(s.vatBase!=null?Number(s.vatBase):g/(1+r)); return a+(s.vat!=null?Number(s.vat):g-base); },0);
    const outBase = sales.filter(s=>!s.void && String(s.date||'').slice(0,7)===vatMonth).reduce((a,s)=>{ const g=saleTotal(s); const base=(s.vatBase!=null?Number(s.vatBase):g/(1+r)); return a+base; },0);
    const purch=(store&&store.purchases)||[];
    const inList=purch.filter(p=>p.hasVat && String(p.date||'').slice(0,7)===vatMonth);
    const inV = inList.reduce((a,p)=>a+(Number(p.vat)||0),0);
    const inBase = inList.reduce((a,p)=>a+(Number(p.vatBase)||0),0);
    const net = outV-inV;
    const parts=vatMonth.split('-'); const monTxt=parts[1]+'/'+parts[0];
    const inner='<div style="font-size:12px;color:#555;margin-bottom:12px">'+(TH?'สรุปยื่นแบบ ภ.พ.30 ประจำเดือน ':'P.P.30 summary ')+monTxt+((store.pay&&store.pay.taxId)?(' · '+(TH?'เลขผู้เสียภาษี ':'Tax ID ')+_esc(store.pay.taxId)):'')+'</div>'
      +'<table><tbody>'
      +'<tr><td>'+(TH?'ยอดขาย (ก่อน VAT)':'Sales (before VAT)')+'</td><td class="r">'+outBase.toFixed(2)+'</td></tr>'
      +'<tr><td><b>'+(TH?'ภาษีขาย (Output Tax)':'Output tax')+'</b></td><td class="r" style="color:#13304E"><b>'+outV.toFixed(2)+'</b></td></tr>'
      +'<tr><td>'+(TH?'ยอดซื้อ (ก่อน VAT)':'Purchases (before VAT)')+'</td><td class="r">'+inBase.toFixed(2)+'</td></tr>'
      +'<tr><td><b>'+(TH?'ภาษีซื้อ (Input Tax)':'Input tax')+'</b></td><td class="r" style="color:#B26A00"><b>'+inV.toFixed(2)+'</b></td></tr>'
      +'</tbody><tfoot><tr><td>'+(net>=0?(TH?'ภาษีที่ต้องชำระ':'VAT payable'):(TH?'ภาษีชำระเกิน (ยกไปเดือนหน้า)':'VAT credit (carry forward)'))+'</td><td class="r">'+Math.abs(net).toFixed(2)+'</td></tr></tfoot></table>'
      +'<div style="font-size:11px;color:#777;margin-top:10px;line-height:1.55">'+(TH?'ภาษีขาย − ภาษีซื้อ = ยอดที่ต้องชำระต่อสรรพากร · ยื่น ภ.พ.30 ภายในวันที่ 15 ของเดือนถัดไป (ยื่นออนไลน์ถึงสิ้นเดือน)':'Output − Input = VAT payable · file P.P.30 by the 15th of next month')+'</div>';
    const csv=[[TH?'รายการ':'Item',TH?'จำนวน':'Amount'],
      [TH?'ยอดขาย (ก่อน VAT)':'Sales (before VAT)',outBase.toFixed(2)],
      [TH?'ภาษีขาย':'Output tax',outV.toFixed(2)],
      [TH?'ยอดซื้อ (ก่อน VAT)':'Purchases (before VAT)',inBase.toFixed(2)],
      [TH?'ภาษีซื้อ':'Input tax',inV.toFixed(2)],
      [net>=0?(TH?'ภาษีที่ต้องชำระ':'VAT payable'):(TH?'ภาษีชำระเกิน':'VAT credit'),Math.abs(net).toFixed(2)]]
      .map(row=>row.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    return { title:(TH?'สรุป ภ.พ.30 ':'P.P.30 ')+monTxt, inner, csv, fileName:'pp30-'+vatMonth };
  };
  const buildPlatform=()=>{
    const plats=sales.filter(s=>!s.void && s.pay==='platform');
    const byChP={}; plats.forEach(s=>{ const c=s.channel||'platform'; const g=saleTotal(s); const o=byChP[c]||(byChP[c]={bills:0,gross:0,due:0,received:0,grossSettled:0,lastDate:''});
      o.bills++; o.gross+=g; if(s.settled){ o.received+=(s.receivedAmount!=null?s.receivedAmount:g); o.grossSettled+=g; if((s.settledDate||'')>o.lastDate) o.lastDate=s.settledDate||''; } else { o.due+=g; } });
    const chs=Object.keys(byChP);
    const totGot=chs.reduce((a,c)=>a+byChP[c].received,0);
    const totDue=chs.reduce((a,c)=>a+byChP[c].due,0);
    const totFee=chs.reduce((a,c)=>a+(byChP[c].grossSettled-byChP[c].received),0);
    const rows=chs.map(c=>{ const o=byChP[c]; return '<tr><td>'+_esc(chName(c))+'</td><td class="c">'+o.bills+'</td><td class="r">'+_M(o.gross)+'</td><td class="r" style="color:#13304E">'+_M(o.received)+'</td><td class="r" style="color:#B26A00">'+_M(o.due)+'</td><td class="r" style="color:#B26A00">'+_M(o.grossSettled-o.received)+'</td><td class="c">'+(o.lastDate?_dd(o.lastDate):'-')+'</td></tr>'; }).join('')||'<tr><td colspan="7" class="c" style="color:#888;padding:14px">'+(TH?'ไม่มีบิลแพลตฟอร์ม':'No platform sales')+'</td></tr>';
    const inner='<div class="grid">'+('<div class="box"><div class="bl">'+(TH?'รับแล้ว':'Received')+'</div><div class="bv" style="color:#13304E">'+_M(totGot)+'</div></div>')+('<div class="box"><div class="bl">'+(TH?'ค้างรับ':'Due')+'</div><div class="bv" style="color:#B26A00">'+_M(totDue)+'</div></div>')+('<div class="box"><div class="bl">'+(TH?'ค่าคอม/ส่วนต่าง':'Fee/diff')+'</div><div class="bv" style="color:#B26A00">'+_M(totFee)+'</div></div>')+'</div>'
      +'<div style="font-size:12px;color:#555;margin-bottom:10px">'+(TH?'แพลตฟอร์มโอนเงินให้ทีหลัง (T+1 หรือตามรอบ) — ตารางสรุปตามแพลตฟอร์ม กด “รับยอดแล้ว” ที่หน้าสรุปเพื่อลงวันรับจริง':'Platforms pay out later (T+1) — grouped by platform')+'</div>'
      +'<h3>'+(TH?'สรุปยอดรับตามแพลตฟอร์ม':'By platform')+'</h3><table><thead><tr><th>'+(TH?'แพลตฟอร์ม':'Platform')+'</th><th class="c">'+(TH?'บิล':'Bills')+'</th><th class="r">'+(TH?'ยอดขาย':'Gross')+'</th><th class="r">'+(TH?'รับแล้ว':'Received')+'</th><th class="r">'+(TH?'ค้างรับ':'Due')+'</th><th class="r">'+(TH?'ค่าคอม':'Fee')+'</th><th class="c">'+(TH?'วันรับล่าสุด':'Last paid')+'</th></tr></thead><tbody>'+rows+'</tbody></table>';
    return { title:(TH?'สรุปยอดรับแพลตฟอร์ม':'Platform payouts'), inner };
  };
  const buildAllBills=()=>{
    const payMap={cash:TH?'เงินสด':'Cash',transfer:TH?'เงินโอน':'Transfer',promptpay:TH?'พร้อมเพย์':'PromptPay',platform:TH?'แพลตฟอร์ม':'Platform'};
    const bills=[...sales].sort((a,b)=>((a.date||'')+ (a.t||'')).localeCompare((b.date||'')+(b.t||'')));
    const rows=bills.map((s,i)=>{ const isPlat=s.pay==='platform'; const st=!isPlat?('<span class="pill" style="background:#E3F5EF;color:#0A6E60">'+(TH?'รับแล้ว':'Paid')+'</span>'):(s.settled?('<span class="pill" style="background:#E3F5EF;color:#0A6E60">'+(TH?'รับแล้ว':'Received')+'</span>'):('<span class="pill" style="background:#FBEAD7;color:#B26A00">'+(TH?'ค้างรับ':'Due')+'</span>')); return '<tr><td class="c">'+(i+1)+'</td><td class="c">'+_no(s)+'</td><td class="c">'+_esc(s.platNo||'-')+'</td><td>'+_esc(chName(s.channel))+'</td><td>'+_esc(payMap[s.pay||'cash']||s.pay)+'</td><td class="c">'+_dd(s.date)+'</td><td class="r">'+_M(saleTotal(s))+'</td><td class="c">'+st+'</td></tr>'; }).join('')||'<tr><td colspan="8" class="c" style="color:#888;padding:14px">'+(TH?'ไม่มีบิล':'No bills')+'</td></tr>';
    const totAll=bills.reduce((a,s)=>a+saleTotal(s),0);
    const byPayLocal={}; bills.forEach(s=>{ const k=s.pay||'cash'; byPayLocal[k]=(byPayLocal[k]||0)+saleTotal(s); });
    const payBoxes=['cash','promptpay','platform'].filter(k=>byPayLocal[k]).map(k=>'<div class="box"><div class="bl">'+_esc(payMap[k])+'</div><div class="bv">'+_M(byPayLocal[k])+'</div></div>').join('');
    const inner='<div class="grid">'+('<div class="box"><div class="bl">'+(TH?'จำนวนบิล':'Bills')+'</div><div class="bv">'+bills.length+'</div></div>')+('<div class="box"><div class="bl">'+(TH?'ยอดรวม':'Total')+'</div><div class="bv" style="color:#13304E">'+_M(totAll)+'</div></div>')+payBoxes+'</div>'
      +'<table><thead><tr><th class="c" style="width:30px">#</th><th class="c">'+(TH?'เลขที่บิล':'Bill#')+'</th><th class="c">'+(TH?'เลขออเดอร์':'Order#')+'</th><th>'+(TH?'ช่องทาง':'Channel')+'</th><th>'+(TH?'ชำระ':'Payment')+'</th><th class="c">'+(TH?'วันที่':'Date')+'</th><th class="r">'+(TH?'ยอด':'Amount')+'</th><th class="c">'+(TH?'สถานะ':'Status')+'</th></tr></thead><tbody>'+rows+'<tr><td colspan="6" style="font-weight:800">'+(TH?'รวมทั้งหมด':'Total')+'</td><td class="r" style="font-weight:800;color:#13304E">'+_M(totAll)+'</td><td></td></tr></tbody></table>';
    return { title:(TH?'รายงานรายบิล (ทุกช่องทาง)':'Bill-by-bill'), inner };
  };
  const buildVerify=()=>{
    const digi=sales.filter(s=>!s.void && ['promptpay'].includes(s.pay));
    const actOf=(s)=> s.verified ? (s.verifiedAmount!=null?s.verifiedAmount:saleTotal(s)) : null;
    const sysTot=digi.reduce((a,s)=>a+saleTotal(s),0);
    const verTot=digi.filter(s=>s.verified).reduce((a,s)=>a+(actOf(s)||0),0);
    const unv=digi.filter(s=>!s.verified).reduce((a,s)=>a+saleTotal(s),0);
    const sysVer=digi.filter(s=>s.verified).reduce((a,s)=>a+saleTotal(s),0);
    const mism=verTot-sysVer;
    const payMap={promptpay:TH?'พร้อมเพย์':'PromptPay',transfer:TH?'เงินโอน':'Transfer'};
    const byDay={}; digi.forEach(s=>{ const d=s.date||'-'; const o=byDay[d]||(byDay[d]={bills:0,sys:0,act:0,unv:0}); o.bills++; o.sys+=saleTotal(s); if(s.verified) o.act+=(actOf(s)||0); else o.unv+=saleTotal(s); });
    const days=Object.keys(byDay).sort();
    const dayRows=days.map(d=>{ const o=byDay[d]; return '<tr><td>'+_dd(d)+'</td><td class="c">'+o.bills+'</td><td class="r">'+_M(o.sys)+'</td><td class="r" style="color:#13304E">'+_M(o.act)+'</td><td class="r" style="color:'+(o.unv?'#B26A00':'#888')+'">'+_M(o.unv)+'</td></tr>'; }).join('')||'<tr><td colspan="5" class="c" style="color:#888;padding:14px">'+(TH?'ไม่มีบิลโอน/พร้อมเพย์':'No transfer/PromptPay bills')+'</td></tr>';
    const bills=[...digi].sort((a,b)=>((a.date||'')+(a.t||'')).localeCompare((b.date||'')+(b.t||'')));
    const billRows=bills.map((s,i)=>{ const act=actOf(s); const sys=saleTotal(s); const diff= act!=null?Math.round(act-sys):0;
       const st = !s.verified ? '<span class="pill" style="background:#FBEAD7;color:#B26A00">'+(TH?'ค้างตรวจ':'Unchecked')+'</span>' : (diff!==0 ? '<span class="pill" style="background:#FBEAD7;color:#B26A00">'+(TH?'ต่าง ':'diff ')+(diff>0?'+':'')+diff+'</span>' : '<span class="pill" style="background:#E3F5EF;color:#0A6E60">'+(TH?'ตรง ✓':'OK ✓')+'</span>');
       return '<tr><td class="c">'+(i+1)+'</td><td class="c">'+_no(s)+'</td><td>'+_esc(payMap[s.pay]||s.pay)+'</td><td class="c">'+_dd(s.date)+(s.t?' '+_esc(s.t):'')+'</td><td class="r">'+_M(sys)+'</td><td class="r" style="color:'+(act!=null?'#13304E':'#888')+'">'+(act!=null?_M(act):'-')+'</td><td class="c">'+(s.slipUrl?'📎':'-')+'</td><td class="c">'+st+'</td></tr>'; }).join('')||'<tr><td colspan="8" class="c" style="color:#888;padding:14px">'+(TH?'ไม่มีบิล':'No bills')+'</td></tr>';
    const inner='<div class="grid">'
      +'<div class="box"><div class="bl">'+(TH?'ยอดระบบ':'System')+'</div><div class="bv">'+_M(sysTot)+'</div></div>'
      +'<div class="box"><div class="bl">'+(TH?'ยืนยันแล้ว (จริง)':'Verified')+'</div><div class="bv" style="color:#13304E">'+_M(verTot)+'</div></div>'
      +'<div class="box"><div class="bl">'+(TH?'ค้างตรวจ':'Unchecked')+'</div><div class="bv" style="color:#B26A00">'+_M(unv)+'</div></div>'
      +'<div class="box"><div class="bl">'+(TH?'ยอดไม่ตรง':'Mismatch')+'</div><div class="bv" style="color:'+(mism?'#B26A00':'#888')+'">'+(mism>0?'+':'')+_M(mism)+'</div></div>'
      +'</div>'
      +'<h3>'+(TH?'สรุปรายวัน':'By day')+'</h3><table><thead><tr><th>'+(TH?'วันที่':'Date')+'</th><th class="c">'+(TH?'บิล':'Bills')+'</th><th class="r">'+(TH?'ยอดระบบ':'System')+'</th><th class="r">'+(TH?'รับจริง':'Actual')+'</th><th class="r">'+(TH?'ค้างตรวจ':'Unchecked')+'</th></tr></thead><tbody>'+dayRows+'</tbody></table>'
      +'<h3>'+(TH?'รายบิลพร้อมเพย์':'Bill detail')+'</h3><table><thead><tr><th class="c" style="width:26px">#</th><th class="c">'+(TH?'บิล':'Bill#')+'</th><th>'+(TH?'ชำระ':'Pay')+'</th><th class="c">'+(TH?'วันเวลา':'When')+'</th><th class="r">'+(TH?'ยอดระบบ':'System')+'</th><th class="r">'+(TH?'ยอดจริง':'Actual')+'</th><th class="c">'+(TH?'สลิป':'Slip')+'</th><th class="c">'+(TH?'สถานะ':'Status')+'</th></tr></thead><tbody>'+billRows+'</tbody></table>';
    return { title:(TH?'รายงานพร้อมเพย์':'PromptPay'), inner };
  };
  const buildSamples=()=>{
    const note='<div style="font-size:12px;color:#B26A00;background:#FFF3E0;border-radius:9px;padding:9px 12px;margin-bottom:14px;line-height:1.5">'+(TH?'นี่คือ<b>ตัวอย่าง</b>หน้าตารายงาน (ข้อมูลสมมติ) — เมื่อเริ่มขายจริง แต่ละปุ่มจะสรุปจากยอดขายของร้านให้อัตโนมัติ':'These are <b>sample</b> reports (demo data). Once you start selling, each button summarises your real sales.')+'</div>';
    const s1='<h3 style="font-size:15px">1 · '+(TH?'รายงานยอดรวม':'Summary')+'</h3>'
      +'<div class="grid"><div class="box"><div class="bl">'+(TH?'รายรับ':'Revenue')+'</div><div class="bv" style="color:#13304E">฿6,970</div></div><div class="box"><div class="bl">'+(TH?'กำไร':'Profit')+'</div><div class="bv" style="color:#13304E">฿4,180</div></div><div class="box"><div class="bl">'+(TH?'ต้นทุน':'Cost')+'</div><div class="bv" style="color:#B26A00">฿2,790</div></div><div class="box"><div class="bl">'+(TH?'บิล':'Bills')+'</div><div class="bv">58</div></div></div>'
      +'<table><thead><tr><th>'+(TH?'ช่องทางขาย':'Channel')+'</th><th class="r">'+(TH?'ยอด':'Total')+'</th></tr></thead><tbody><tr><td>'+(TH?'กลับบ้าน':'Take away')+'</td><td class="r">฿3,240</td></tr><tr><td>LINE MAN</td><td class="r">฿1,150</td></tr><tr><td>Grab</td><td class="r">฿980</td></tr></tbody></table>';
    const s2='<h3 style="font-size:15px">2 · '+(TH?'รายบิล (ทุกช่องทาง)':'Bills')+'</h3>'
      +'<table><thead><tr><th class="c">'+(TH?'บิล':'Bill#')+'</th><th>'+(TH?'ช่องทาง':'Channel')+'</th><th>'+(TH?'ชำระ':'Pay')+'</th><th class="r">'+(TH?'ยอด':'Amt')+'</th><th class="c">'+(TH?'สถานะ':'Status')+'</th></tr></thead><tbody>'
      +'<tr><td class="c">A-041</td><td>'+(TH?'กลับบ้าน':'Take away')+'</td><td>'+(TH?'เงินสด':'Cash')+'</td><td class="r">฿120</td><td class="c"><span class="pill" style="background:#E3F5EF;color:#0A6E60">'+(TH?'รับแล้ว':'Paid')+'</span></td></tr>'
      +'<tr><td class="c">M-007</td><td>LINE MAN</td><td>'+(TH?'แพลตฟอร์ม':'Platform')+'</td><td class="r">฿230</td><td class="c"><span class="pill" style="background:#FBEAD7;color:#B26A00">'+(TH?'ค้างรับ':'Due')+'</span></td></tr></tbody></table>';
    const s3='<h3 style="font-size:15px">3 · '+(TH?'สรุปยอดรับแพลตฟอร์ม':'Platform payouts')+'</h3>'
      +'<table><thead><tr><th>'+(TH?'แพลตฟอร์ม':'Platform')+'</th><th class="r">'+(TH?'ยอดขาย':'Gross')+'</th><th class="r">'+(TH?'รับแล้ว':'Got')+'</th><th class="r">'+(TH?'ค้างรับ':'Due')+'</th><th class="r">'+(TH?'ค่าคอม':'Fee')+'</th></tr></thead><tbody>'
      +'<tr><td>Grab</td><td class="r">฿980</td><td class="r" style="color:#13304E">฿1,153</td><td class="r" style="color:#B26A00">฿800</td><td class="r" style="color:#B26A00">฿227</td></tr>'
      +'<tr><td>LINE MAN</td><td class="r">฿1,150</td><td class="r" style="color:#13304E">฿0</td><td class="r" style="color:#B26A00">฿1,150</td><td class="r">฿0</td></tr></tbody></table>';
    const s4='<h3 style="font-size:15px">4 · '+(TH?'พร้อมเพย์':'PromptPay')+'</h3>'
      +'<table><thead><tr><th class="c">'+(TH?'บิล':'Bill#')+'</th><th>'+(TH?'ชำระ':'Pay')+'</th><th class="r">'+(TH?'ยอดระบบ':'System')+'</th><th class="r">'+(TH?'ยอดจริง':'Actual')+'</th><th class="c">'+(TH?'สถานะ':'Status')+'</th></tr></thead><tbody>'
      +'<tr><td class="c">W-018</td><td>'+(TH?'พร้อมเพย์':'PromptPay')+'</td><td class="r">฿85</td><td class="r">฿85</td><td class="c"><span class="pill" style="background:#E3F5EF;color:#0A6E60">'+(TH?'ตรง ✓':'OK ✓')+'</span></td></tr>'
      +'<tr><td class="c">W-025</td><td>'+(TH?'พร้อมเพย์':'PromptPay')+'</td><td class="r">฿240</td><td class="r" style="color:#B26A00">฿215</td><td class="c"><span class="pill" style="background:#FBEAD7;color:#B26A00">'+(TH?'ต่าง -25':'diff -25')+'</span></td></tr></tbody></table>';
    const s5='<h3 style="font-size:15px">5 · '+(TH?'รายงานภาษีขาย (VAT) — สำหรับ ภ.พ.30':'VAT sales report — for P.P.30')+'</h3>'
      +'<div class="grid"><div class="box"><div class="bl">'+(TH?'มูลค่าก่อน VAT':'Before VAT')+'</div><div class="bv">฿6,514</div></div><div class="box"><div class="bl">VAT 7%</div><div class="bv" style="color:#13304E">฿456</div></div><div class="box"><div class="bl">'+(TH?'รวม':'Total')+'</div><div class="bv">฿6,970</div></div><div class="box"><div class="bl">'+(TH?'จำนวนใบ':'Invoices')+'</div><div class="bv">58</div></div></div>'
      +'<table><thead><tr><th>'+(TH?'วันที่':'Date')+'</th><th>'+(TH?'เลขที่':'No.')+'</th><th>'+(TH?'ช่องทาง':'Channel')+'</th><th class="r">'+(TH?'ก่อน VAT':'Before')+'</th><th class="r">VAT</th><th class="r">'+(TH?'รวม':'Total')+'</th></tr></thead><tbody>'
      +'<tr><td>01/07/69</td><td>#1042</td><td>'+(TH?'กลับบ้าน':'Take away')+'</td><td class="r">112.15</td><td class="r">7.85</td><td class="r">120.00</td></tr>'
      +'<tr><td>01/07/69</td><td>#1043</td><td>Grab</td><td class="r">214.02</td><td class="r">14.98</td><td class="r">229.00</td></tr>'
      +'<tr><td>02/07/69</td><td>#1044</td><td>'+(TH?'กลับบ้าน':'Take away')+'</td><td class="r">79.44</td><td class="r">5.56</td><td class="r">85.00</td></tr></tbody>'
      +'<tfoot><tr><td colspan="3">'+(TH?'รวมทั้งเดือน':'Month total')+'</td><td class="r">6,514.02</td><td class="r">455.98</td><td class="r">6,970.00</td></tr></tfoot></table>'
      +'<div style="font-size:11px;color:#777;margin-top:8px;line-height:1.5">'+(TH?'เปิด VAT ที่ “ตั้งค่ารับเงิน” ก่อน แล้วการ์ด “รายงานภาษีขาย (VAT)” จะสรุปยอดจริงรายเดือน + พิมพ์/CSV ให้':'Turn on VAT in Payment settings, then the VAT report card summarises real monthly totals + print/CSV')+'</div>';
    const s6='<h3 style="font-size:15px">6 · '+(TH?'รายงานภาษีซื้อ (Input VAT)':'Input VAT report')+'</h3>'
      +'<div class="grid"><div class="box"><div class="bl">'+(TH?'มูลค่าก่อน VAT':'Before VAT')+'</div><div class="bv">฿2,800</div></div><div class="box"><div class="bl">'+(TH?'ภาษีซื้อ':'Input VAT')+'</div><div class="bv" style="color:#B26A00">฿196</div></div><div class="box"><div class="bl">'+(TH?'รวม':'Total')+'</div><div class="bv">฿2,996</div></div><div class="box"><div class="bl">'+(TH?'จำนวนใบ':'Invoices')+'</div><div class="bv">3</div></div></div>'
      +'<table><thead><tr><th>'+(TH?'วันที่':'Date')+'</th><th>'+(TH?'ผู้ขาย':'Supplier')+'</th><th class="r">'+(TH?'ก่อน VAT':'Before')+'</th><th class="r">VAT</th><th class="r">'+(TH?'รวม':'Total')+'</th></tr></thead><tbody>'
      +'<tr><td>03/07/69</td><td>'+(TH?'แม็คโคร':'Makro')+'</td><td class="r">1,401.87</td><td class="r">98.13</td><td class="r">1,500.00</td></tr>'
      +'<tr><td>05/07/69</td><td>'+(TH?'บ.น้ำมันพืช':'Oil Co.')+'</td><td class="r">1,121.50</td><td class="r">78.50</td><td class="r">1,200.00</td></tr></tbody>'
      +'<tfoot><tr><td colspan="2">'+(TH?'รวมทั้งเดือน':'Month total')+'</td><td class="r">2,800.00</td><td class="r">196.00</td><td class="r">2,996.00</td></tr></tfoot></table>'
      +'<div style="font-size:11px;color:#777;margin-top:8px;line-height:1.5">'+(TH?'ติ๊ก “มีใบกำกับภาษี” ตอนบันทึกซื้อของเข้า แล้วบิลนั้นจะเข้ารายงานภาษีซื้อ':'Tick “has tax invoice” when recording a purchase to include it here')+'</div>';
    const s7='<h3 style="font-size:15px">7 · '+(TH?'สรุป ภ.พ.30 (ขาย − ซื้อ)':'P.P.30 summary')+'</h3>'
      +'<table><tbody><tr><td>'+(TH?'ภาษีขาย':'Output tax')+'</td><td class="r" style="color:#13304E">฿456.00</td></tr><tr><td>'+(TH?'ภาษีซื้อ':'Input tax')+'</td><td class="r" style="color:#B26A00">฿196.00</td></tr></tbody><tfoot><tr><td>'+(TH?'ภาษีที่ต้องชำระ':'VAT payable')+'</td><td class="r">฿260.00</td></tr></tfoot></table>';
    return { title:(TH?'ตัวอย่างรายงาน':'Sample reports'), inner: note+s1+s2+s3+s4+s5+s6+s7 };
  };

  return (
    <div className="kd-screen" style={embedded?{ background:'transparent' }:undefined}>
      {!embedded && <TopBar title={t('dashboard')} sub={t('today')}/>}
      <div className="kd-body" style={{ padding:'0 16px 24px' }}>
        {embedded && <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            {[['day',lang==='th'?'รายวัน':'Day'],['month',lang==='th'?'รายเดือน':'Month'],['all',lang==='th'?'ทั้งหมด':'All']].map(([k,l])=>(
              <button key={k} onClick={()=>setDMode(k)} style={{ flex:1, border:'none', cursor:'pointer', padding:'8px', borderRadius:10, fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, background:dMode===k?'var(--brand)':'var(--bg)', color:dMode===k?'#fff':'var(--ink-2)' }}>{l}</button>
            ))}
          </div>
          {dMode==='day' && <input type="date" className="kd-input num" value={dayVal} onChange={e=>setDayVal(e.target.value)} style={{ width:'100%', padding:'9px 12px' }}/>}
          {dMode==='month' && <input type="month" className="kd-input num" value={monVal} onChange={e=>setMonVal(e.target.value)} style={{ width:'100%', padding:'9px 12px' }}/>}
        </div>}
        {/* hero revenue */}
        <div className="kd-card kd-fadein" style={{ padding:'18px 18px', background:'linear-gradient(135deg,var(--brand),#0E9463)', color:'#fff', marginBottom:12 }}>
          <div style={{ fontSize:13, opacity:.85, fontWeight:600 }}>{t('revenue')} · {t('today')}</div>
          <div className="num" style={{ fontSize:38, fontWeight:700, letterSpacing:'-.02em', margin:'2px 0 6px' }}>{money(rev)}</div>
          <div style={{ display:'flex', gap:16, fontSize:13 }}>
            <span>{React.cloneElement(IC.receipt,{size:14, style:{verticalAlign:'-2px'}})} {orders} {lang==='th'?'ออเดอร์':'orders'}</span>
            <span style={{ background:'rgba(255,255,255,.22)', padding:'2px 10px', borderRadius:999, fontWeight:700 }}>{lang==='th'?'กำไร':'Margin'} {margin}%</span>
          </div>
        </div>
        {/* profit/cost */}
        <div style={{ display:'flex', gap:11, marginBottom:14 }}>
          <Stat label={t('profit')} value={money(profit)} tone="var(--brand-ink)" sub={lang==='th'?'หลังหักต้นทุน':'after cost'}/>
          <Stat label={t('cost')} value={money(cost)} tone="var(--accent)" sub={lang==='th'?'ต้นทุนวัตถุดิบ':'ingredients'}/>
        </div>

        {/* print reports */}
        <div style={{ display:'flex', gap:10, marginBottom:10, flexWrap:'wrap' }}>
          <button onClick={()=>setReport(buildSummary())} className="kd-btn kd-btn-primary" style={{ flex:'1 1 46%', padding:'13px', fontSize:13 }}>{React.cloneElement(IC.receipt,{size:16})} {lang==='th'?'ยอดรวม':'Summary'}</button>
          <button onClick={()=>setReport(buildAllBills())} className="kd-btn" style={{ flex:'1 1 46%', padding:'13px', fontSize:13, background:'var(--bg)', color:'var(--ink-2)' }}>{React.cloneElement(IC.receipt,{size:16})} {lang==='th'?'รายบิล':'Bills'}</button>
          <button onClick={()=>setReport(buildPlatform())} className="kd-btn" style={{ flex:'1 1 46%', padding:'13px', fontSize:13, background:'var(--brand-soft)', color:'var(--brand-ink)' }}>{React.cloneElement(IC.moto,{size:16})} {lang==='th'?'แพลตฟอร์ม':'Platform'}</button>
          <button onClick={()=>setReport(buildVerify())} className="kd-btn" style={{ flex:'1 1 46%', padding:'13px', fontSize:13, background:'#EAF0FA', color:'#2B62A8' }}>{React.cloneElement(IC.wallet,{size:16})} {lang==='th'?'พร้อมเพย์':'PromptPay'}</button>
        </div>
        <button onClick={()=>setReport(buildSamples())} className="kd-btn" style={{ width:'100%', marginBottom:14, padding:'11px', fontSize:12.5, background:'#fff', color:'var(--ink-3)', border:'1.5px dashed var(--hair-2)', justifyContent:'center', display:'flex', gap:6, alignItems:'center' }}>👁 {lang==='th'?'ดูตัวอย่างรายงาน (ข้อมูลสมมติ)':'Preview sample reports'}</button>

        {_vatOn && <div className="kd-card" style={{ padding:'14px 15px', marginBottom:14, background:'#E9EFF5', boxShadow:'none' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ color:'#13304E' }}>{React.cloneElement(IC.receipt,{size:17})}</span>
            <div style={{ fontWeight:700, fontSize:14.5, color:'#13304E' }}>{lang==='th'?'รายงานภาษีมูลค่าเพิ่ม (VAT)':'VAT reports'}</div>
          </div>
          <div style={{ fontSize:12, color:'var(--ink-3)', marginBottom:10, lineHeight:1.45 }}>{lang==='th'?'รายงานภาษีขาย/ภาษีซื้อ รายเดือน สำหรับกรอก ภ.พ.30 · พิมพ์ A4 + Excel (CSV)':'Monthly output/input VAT for filing P.P.30 · print A4 + Excel (CSV)'}</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:9 }}>
            <input type="month" value={vatMonth} onChange={e=>setVatMonth(e.target.value)} className="kd-input" style={{ flex:1, appearance:'auto' }}/>
            <div style={{ display:'flex', background:'#fff', borderRadius:9, padding:3, flexShrink:0 }}>
              {[['detail',lang==='th'?'ละเอียด':'Detail'],['summary',lang==='th'?'สรุป':'Summary']].map(([k,l])=>(
                <button key={k} onClick={()=>setVatView(k)} style={{ border:'none', cursor:'pointer', borderRadius:7, padding:'8px 12px', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, background:vatView===k?'var(--brand)':'transparent', color:vatView===k?'#fff':'var(--ink-3)' }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={()=>setReport(buildVatReport(vatView))} className="kd-btn kd-btn-primary" style={{ flex:'1 1 30%', padding:'11px 8px', fontSize:12.5 }}>{lang==='th'?'ภาษีขาย':'Output'}</button>
            <button onClick={()=>setReport(buildVatPurchaseReport(vatView))} className="kd-btn" style={{ flex:'1 1 30%', padding:'11px 8px', fontSize:12.5, background:'#FBEAD7', color:'#B26A00' }}>{lang==='th'?'ภาษีซื้อ':'Input'}</button>
            <button onClick={()=>setReport(buildPP30())} className="kd-btn" style={{ flex:'1 1 30%', padding:'11px 8px', fontSize:12.5, background:'#13304E', color:'#fff' }}>{lang==='th'?'สรุป ภ.พ.30':'P.P.30'}</button>
          </div>
        </div>}

        {/* daily trend (เส้นคู่ แบบ Backoffice) */}
        <DailyTrend salesAll={salesAll} lang={lang}/>
        {/* hourly chart */}
        <div className="kd-card" style={{ padding:'16px', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontWeight:700, fontSize:15 }}>{lang==='th'?'ยอดขายรายชั่วโมง':'Sales by hour'}</div>
            <div style={{ display:'flex', gap:4, background:'var(--bg)', borderRadius:999, padding:3 }}>
              {[['stack',lang==='th'?'แยกช่องทาง':'By channel'],['total',lang==='th'?'รวม':'Total']].map(([k,l])=>(
                <button key={k} onClick={()=>setHourMode(k)} style={{ border:'none', cursor:'pointer', borderRadius:999, padding:'5px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, background:hourMode===k?'#fff':'transparent', color:hourMode===k?'var(--ink)':'var(--ink-3)', boxShadow:hourMode===k?'var(--shadow)':'none' }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:110 }}>
            {hkeys.map(h=>(
              <div key={h} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <div style={{ width:'100%', maxWidth:26, height:`${hours[h]/hmax*84}px`, minHeight:6, borderRadius:'6px 6px 3px 3px', overflow:'hidden', display:'flex', flexDirection:'column-reverse', transition:'height .4s', background: hourMode==='total'?'linear-gradient(var(--brand),#8FC1EA)':'transparent' }}>
                  {hourMode!=='total' && Object.entries(hoursCh[h]||{}).map(([ch,v])=>(<div key={ch} style={{ height:`${v/(hours[h]||1)*100}%`, background:chColor(ch) }}/>))}
                </div>
                <span className="num" style={{ fontSize:11, color:'var(--ink-3)' }}>{h}</span>
              </div>
            ))}
          </div>
          {hourMode!=='total' && hourChans.length>0 && <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 12px', marginTop:12 }}>
            {hourChans.map(ch=>(<span key={ch} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:'var(--ink-2)' }}><span style={{ width:9, height:9, borderRadius:2, background:chColor(ch) }}/>{chName(ch)}</span>))}
          </div>}
        </div>

        {/* by channel */}
        <div className="kd-card" style={{ padding:'16px', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>{lang==='th'?'ยอดตามช่องทาง':'By channel'}</div>
          {Object.entries(byCh).map(([ch,v])=>(
            <div key={ch} style={{ marginBottom:11 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, marginBottom:5 }}>
                <span style={{ fontWeight:600 }}>{chName(ch)}</span>
                <span className="num" style={{ fontWeight:700 }}>{money(v)}</span></div>
              <div style={{ height:8, background:'var(--bg)', borderRadius:999, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${v/rev*100}%`, background:'var(--brand)', borderRadius:999, transition:'width .5s' }}/></div>
            </div>
          ))}
        </div>

        {/* by payment method */}
        <div className="kd-card" style={{ padding:'16px', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>{lang==='th'?'ช่องทางการชำระเงิน':'By payment method'}</div>
          {['cash','promptpay'].map(k=>{ const v=byPay[k]||0; const pl=PAY_LABEL[k]; return (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0' }}>
              <span style={{ color:'var(--ink-3)' }}>{React.cloneElement((PAYS[k]&&PAYS[k].ic)||IC.wallet,{size:18})}</span>
              <span style={{ flex:1, fontSize:14, fontWeight:600 }}>{pl[lang]||pl.th}</span>
              <span className="num" style={{ fontWeight:700, color:v>0?'var(--ink)':'var(--ink-3)' }}>{money(Math.round(v))}</span>
            </div>
          );})}
          {byPay.platform>0 && <div style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderTop:'1px solid var(--hair)', marginTop:4 }}>
            <span style={{ color:'var(--ink-3)' }}>{React.cloneElement(IC.moto,{size:18})}</span>
            <span style={{ flex:1, fontSize:14, fontWeight:600 }}>{lang==='th'?'แพลตฟอร์มเดลิเวอรี':'Delivery platform'}</span>
            <span className="num" style={{ fontWeight:700 }}>{money(Math.round(byPay.platform))}</span>
          </div>}
        </div>

        {/* platform payouts due (ยอดค้างรับ + กดรับยอด) */}
        {store && (recvKeys.length>0 || Object.keys(settledToday).length>0) && <div className="kd-card" style={{ padding:'16px', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>{React.cloneElement(IC.wallet,{size:17,color:'var(--accent)'})} {lang==='th'?'ยอดค้างรับจากแพลตฟอร์ม':'Platform payouts due'}</div>
          <div style={{ fontSize:12, color:'var(--ink-3)', marginBottom:10, lineHeight:1.45 }}>{lang==='th'?'ยอดขายที่แพลตฟอร์มจะโอนให้ทีหลัง — กด “รับยอดแล้ว” เมื่อเงินเข้าบัญชี (บันทึกวันรับ)':'The platform pays these later — tap when the money arrives (logs the date)'}</div>
          {recvKeys.map(k=>(
            <div key={k} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--hair)' }}>
              <span style={{ width:10, height:10, borderRadius:999, background:(store.chanCfg&&chMeta(store.chanCfg,k).c)||'var(--brand)', flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:14, fontWeight:700 }}>{chName(k)}</div><div style={{ fontSize:11.5, color:'var(--ink-3)' }}>{lang==='th'?'รอรับโอน':'Due'}</div></div>
              <span className="num" style={{ fontWeight:700, color:'var(--accent-ink)' }}>{money(Math.round(platformRecv[k]))}</span>
              <button onClick={()=>{ setSettleFor(k); const gp=(store&&store.gpOf)?store.gpOf(k):0; const net=gp>0?Math.round(platformRecv[k]*(1-gp/100)):Math.round(platformRecv[k]); setSettleAmt(String(net)); setSettleDate(new Date().toISOString().slice(0,10)); }} style={{ border:'none', cursor:'pointer', background:'var(--brand)', color:'#fff', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, padding:'8px 12px', borderRadius:10, flexShrink:0 }}>{lang==='th'?'รับยอดแล้ว':'Received'}</button>
            </div>
          ))}
          {recvTotal>0 && <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, fontWeight:700, fontSize:14 }}><span>{lang==='th'?'รวมรอรับ':'Total due'}</span><span className="num" style={{ color:'var(--accent-ink)' }}>{money(Math.round(recvTotal))}</span></div>}
          {Object.keys(settledToday).length>0 && <div style={{ marginTop:10, background:'var(--brand-softer)', borderRadius:10, padding:'9px 12px', fontSize:12.5, color:'var(--brand-ink)', lineHeight:1.5 }}>{lang==='th'?'✓ รับเข้าวันนี้: ':'✓ Received today: '}{Object.entries(settledToday).map(([k,v])=>`${chName(k)} ${money(Math.round(v))}`).join(' · ')}</div>}
        </div>}

        {/* verify transfer / promptpay receipts (ตรวจรับเงินโอน/พร้อมเพย์) */}
        {store && (()=>{ const digi=sales.filter(s=>!s.void && ['promptpay'].includes(s.pay)); if(!digi.length) return null;
          const sysAmt=digi.reduce((a,s)=>a+saleTotal(s),0); const verAmt=digi.filter(s=>s.verified).reduce((a,s)=>a+saleTotal(s),0); const unv=digi.filter(s=>!s.verified);
          return (<div className="kd-card" style={{ padding:'16px', marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>{React.cloneElement(IC.wallet,{size:17,color:'var(--brand)'})} {lang==='th'?'ตรวจรับพร้อมเพย์':'Verify PromptPay'}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)', marginBottom:10, lineHeight:1.45 }}>{lang==='th'?'เทียบสลิป/ยอดเข้าบัญชี แล้วกด“ยืนยันรับ” (แนบสลิปหรือไม่ก็ได้)':'Check against slip/bank, then confirm (slip optional)'}</div>
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              <div style={{ flex:1, background:'var(--bg)', borderRadius:10, padding:'8px 10px' }}><div style={{ fontSize:11, color:'var(--ink-3)' }}>{lang==='th'?'ระบบ':'System'}</div><div className="num" style={{ fontWeight:700 }}>{money(Math.round(sysAmt))}</div></div>
              <div style={{ flex:1, background:'var(--brand-softer)', borderRadius:10, padding:'8px 10px' }}><div style={{ fontSize:11, color:'var(--brand-ink)' }}>{lang==='th'?'ยืนยันแล้ว':'Verified'}</div><div className="num" style={{ fontWeight:700, color:'var(--brand-ink)' }}>{money(Math.round(verAmt))}</div></div>
              <div style={{ flex:1, background:'#FBEAD7', borderRadius:10, padding:'8px 10px' }}><div style={{ fontSize:11, color:'#B26A00' }}>{lang==='th'?'ค้างตรวจ':'Unchecked'}</div><div className="num" style={{ fontWeight:700, color:'#B26A00' }}>{money(Math.round(sysAmt-verAmt))}</div></div>
            </div>
            <button onClick={()=>setVerifyDetailOpen(true)} className="kd-btn" style={{ width:'100%', padding:'12px', fontSize:13.5, background:'var(--brand)', color:'#fff', justifyContent:'space-between', display:'flex', alignItems:'center' }}><span style={{ display:'flex', alignItems:'center', gap:7 }}>{React.cloneElement(IC.receipt,{size:16})} {lang==='th'?'ดีเทล · ตรวจสลิปรายบิล':'Detail · check slips'}</span><span style={{ display:'flex', alignItems:'center', gap:8 }}>{unv.length>0 && <span style={{ background:'#fff', color:'var(--brand-ink)', fontSize:11.5, fontWeight:800, padding:'2px 9px', borderRadius:999 }}>{lang==='th'?`${unv.length} รอตรวจ`:`${unv.length} to do`}</span>}{React.cloneElement(IC.chev,{size:16})}</span></button>
          </div>);
        })()}
        {/* best sellers moved to Sell screen */}
      </div>
      {settleFor!=null && (()=>{ const k=settleFor; const exp=Math.round(platformRecv[k]||0); const av=Number(settleAmt)||0; const fee=exp-av;
        const done=()=>{ if(store&&store.settlePlatform) store.settlePlatform(k, settleDate||null, settleAmt); setSettleFor(null); };
        const gpPct=(store&&store.gpOf)?store.gpOf(k):0; const gpAmt=gpPct>0?Math.round(exp*gpPct/100):0;
        return (<div onClick={()=>setSettleFor(null)} style={{ position:'absolute', inset:0, background:'rgba(10,25,20,.45)', zIndex:320, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'18px 20px calc(18px + env(safe-area-inset-bottom))' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}><span style={{ width:11, height:11, borderRadius:999, background:chColor(k) }}/><div style={{ fontSize:17, fontWeight:700 }}>{lang==='th'?`รับยอดจาก ${chName(k)}`:`Payout from ${chName(k)}`}</div></div>
            <div style={{ fontSize:12.5, color:'var(--ink-3)', marginBottom:14, lineHeight:1.45 }}>{lang==='th'?`ยอดขาย ฿${exp.toLocaleString()} — ใส่ยอดเงินที่ได้รับจริง (หักค่าคอมแล้ว)`:`Gross ฿${exp.toLocaleString()} — enter the amount actually received (after fees)`}</div>
            {gpPct>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, background:'var(--accent-soft)', color:'var(--accent-ink)', borderRadius:10, padding:'9px 12px', marginBottom:12 }}><span>{lang==='th'?`หัก GP ${gpPct}%`:`GP ${gpPct}%`}</span><span className="num" style={{ fontWeight:700 }}>−฿{gpAmt.toLocaleString()}</span></div>}
            <div style={{ position:'relative', marginBottom:12 }}>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontWeight:700, fontSize:17 }}>฿</span>
              <input className="kd-input num" type="number" autoFocus value={settleAmt} onChange={e=>setSettleAmt(e.target.value)} style={{ padding:'14px 14px 14px 30px', fontSize:18, fontWeight:700, textAlign:'right' }}/>
            </div>
            {av>0 && fee!==0 && <div style={{ fontSize:12.5, color:'var(--ink-3)', textAlign:'right', marginBottom:12 }}>{lang==='th'?'ค่าคอม/ส่วนต่าง':'Fee/diff'}: <span className="num" style={{ color: fee>0?'var(--danger)':'var(--brand-ink)', fontWeight:700 }}>฿{Math.abs(fee).toLocaleString()}</span></div>}
            <div style={{ fontSize:12.5, fontWeight:700, color:'var(--ink-2)', marginBottom:6 }}>{lang==='th'?'วันที่เงินเข้าจริง':'Date money received'}</div>
            <input type="date" className="kd-input" value={settleDate} max={new Date().toISOString().slice(0,10)} onChange={e=>setSettleDate(e.target.value)} style={{ marginBottom:6 }}/>
            <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:14, lineHeight:1.5 }}>{lang==='th'?'แพลตฟอร์มโอนช้า (T+1/ตามรอบ) — เลือกวันที่เงินเข้าบัญชีจริง ระบบบันทึกรายรับลงวันนั้น (ข้ามวัน/ย้อนหลังได้)':'Platforms pay late — pick the real deposit date; income is booked on that day (back-dating allowed).'}</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setSettleFor(null)} className="kd-btn" style={{ flex:1, padding:'13px', background:'var(--bg)', color:'var(--ink-2)' }}>{lang==='th'?'ยกเลิก':'Cancel'}</button>
              <button onClick={done} className="kd-btn kd-btn-primary" style={{ flex:2, padding:'13px' }}>{lang==='th'?'ยืนยันรับยอด':'Confirm received'}</button>
            </div>
          </div>
        </div>);
      })()}
      {verifyDetailOpen && (()=>{ const digi=sales.filter(s=>!s.void && ['promptpay'].includes(s.pay)).sort((a,b)=>((a.date||'')+(a.t||'')).localeCompare((b.date||'')+(b.t||'')));
        const unvN=digi.filter(s=>!s.verified).length;
        const bm=(store&&store.pay&&store.pay.billMatch)||{slip:true,paste:true,lineBot:false};
        return (<div onClick={()=>setVerifyDetailOpen(false)} style={{ position:'absolute', inset:0, background:'rgba(10,25,20,.45)', zIndex:310, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'20px 20px 0 0', maxHeight:'93%', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px 12px', borderBottom:'1px solid var(--hair)' }}>
              <div><div style={{ fontSize:17, fontWeight:700 }}>{lang==='th'?'ตรวจสลิป · พร้อมเพย์':'Check slips · PromptPay'}</div><div style={{ fontSize:12, color:'var(--ink-3)', marginTop:1 }}>{lang==='th'?`${digi.length} บิล · รอตรวจ ${unvN}`:`${digi.length} bills · ${unvN} to do`}</div></div>
              <button onClick={()=>setVerifyDetailOpen(false)} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
            </div>
            <div className="kd-body" style={{ padding:'6px 18px 18px', flex:1, overflowY:'auto' }}>
              {(()=>{ const sysTot=digi.reduce((a,s)=>a+saleTotal(s),0); const verTot=digi.filter(s=>s.verified).reduce((a,s)=>a+(s.verifiedAmount!=null?s.verifiedAmount:saleTotal(s)),0); const sysVer=digi.filter(s=>s.verified).reduce((a,s)=>a+saleTotal(s),0); const diff=Math.round(verTot-sysVer);
                return (<div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  <div style={{ flex:1, background:'var(--bg)', borderRadius:10, padding:'9px 8px', textAlign:'center' }}><div style={{ fontSize:10.5, color:'var(--ink-3)', fontWeight:700 }}>{lang==='th'?'ยอดระบบ':'System'}</div><div className="num" style={{ fontSize:15, fontWeight:700 }}>{money(Math.round(sysTot))}</div></div>
                  <div style={{ flex:1, background:'var(--brand-soft)', borderRadius:10, padding:'9px 8px', textAlign:'center' }}><div style={{ fontSize:10.5, color:'var(--brand-ink)', fontWeight:700 }}>{lang==='th'?'ยืนยันแล้ว':'Verified'}</div><div className="num" style={{ fontSize:15, fontWeight:700, color:'var(--brand-ink)' }}>{money(Math.round(verTot))}</div></div>
                  <div style={{ flex:1, background: diff===0?'var(--bg)':(diff>0?'#E7F6EF':'#FDE7E7'), borderRadius:10, padding:'9px 8px', textAlign:'center' }}><div style={{ fontSize:10.5, color:'var(--ink-3)', fontWeight:700 }}>{lang==='th'?'ขาด/เกิน':'Short/over'}</div><div className="num" style={{ fontSize:15, fontWeight:700, color: diff===0?'var(--ink-2)':(diff>0?'var(--brand-ink)':'var(--danger)') }}>{diff>0?'+':''}{money(diff)}</div></div>
                </div>);
              })()}
              {bm.lineBot && <div style={{ marginBottom:8, padding:'11px 12px', borderRadius:12, background:'#E8F3FF', border:'1px solid #BBD9F5' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:17 }}>🤖</span><div style={{ fontSize:13, fontWeight:700, color:'#1E5A96' }}>{lang==='th'?'บอท LINE จับยอดสด — เปิดอยู่':'Live LINE bot — on'}</div></div>
                <div style={{ fontSize:11.5, color:'#3B6C99', marginTop:5, lineHeight:1.5 }}>{unvN>0?(lang==='th'?`ยอดที่ธนาคารแจ้งเข้ากลุ่ม LINE จะจับคู่ ${unvN} บิลค้างให้อัตโนมัติ · ผูกกลุ่ม LINE ที่ Backoffice`:`Bank alerts in your LINE group auto-match the ${unvN} pending bill(s) · pair the group in Backoffice`):(lang==='th'?'ไม่มีบิลค้างตรวจ ✓':'No pending bills ✓')}</div>
              </div>}
              {bm.paste!==false && unvN>0 && <button onClick={()=>setMatchOpen(v=>!v)} className="kd-btn" style={{ width:'100%', padding:'11px', fontSize:13, marginBottom:8, background:matchOpen?'var(--brand)':'var(--brand-soft)', color:matchOpen?'#fff':'var(--brand-ink)', fontWeight:700, justifyContent:'center' }}>🔎 {lang==='th'?'จับคู่ยอดจากแจ้งเตือนธนาคาร':'Match from bank alerts'}</button>}
              {matchOpen && bm.paste!==false && (()=>{ const pend=digi.filter(s=>!s.verified); const ent=mStParse(matchText); const used=new Set(); const pairs=[];
                ent.forEach(e=>{ const c=pend.filter(s=>!used.has(s.id)&&Math.abs(Math.round(saleTotal(s))-e.amount)<0.5).sort((a,b)=>Math.abs(mTmin(a.t)-mTmin(e.time))-Math.abs(mTmin(b.t)-mTmin(e.time))); if(c.length){ used.add(c[0].id); pairs.push({e,s:c[0]}); } });
                const applyM=()=>{ const today=new Date().toISOString().slice(0,10); pairs.forEach(({e,s})=>{ const sys=Math.round(saleTotal(s)); const d=+(e.amount-sys).toFixed(2); store.verifySale(s.id,null,e.amount,(Math.abs(d)<0.01?'paid':'discrepancy')); }); kdPayIn(lang==='th'?('💰 รับเงิน '+pairs.length+' บิลเรียบร้อย'):('💰 '+pairs.length+' bill(s) matched')); setMatchOpen(false); setMatchText(''); };
                return (<div style={{ marginBottom:10, padding:'11px 12px', background:'var(--bg)', borderRadius:12 }}>
                  <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:7, lineHeight:1.45 }}>{lang==='th'?'วางข้อความแจ้งเตือนเงินเข้าจาก SMS/LINE ธนาคาร (ยอด+เวลา) — ระบบจับคู่กับบิลค้างตรวจให้':'Paste bank incoming-transfer alerts (amount+time)'}</div>
                  <textarea value={matchText} onChange={e=>setMatchText(e.target.value)} placeholder={'14:05 เงินเข้า 250.00 บาท\n14:22 รับโอน 180.00'} style={{ width:'100%', minHeight:70, border:'1px solid var(--hair-2)', borderRadius:9, padding:'9px 10px', fontFamily:'var(--font-mono, monospace)', fontSize:12.5, outline:'none', resize:'vertical', boxSizing:'border-box' }}/>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                    <span style={{ fontSize:12, color:'var(--ink-2)', fontWeight:600 }}>{lang==='th'?`จับคู่ได้ ${pairs.length} บิล`:`${pairs.length} matched`}{ent.length?` · ${lang==='th'?'เงินเข้า':'in'} ${ent.length}`:''}</span>
                    <button onClick={applyM} disabled={!pairs.length} className="kd-btn kd-btn-primary" style={{ padding:'9px 14px', fontSize:13, opacity:pairs.length?1:.5 }}>{lang==='th'?`ยืนยัน ${pairs.length} บิล`:`Confirm ${pairs.length}`}</button>
                  </div>
                </div>); })()}
              {unvN>0 && <button onClick={()=>{ const n=digi.filter(s=>!s.verified).length; digi.filter(s=>!s.verified).forEach(s=>store.verifySale(s.id, null)); kdPayIn(lang==='th'?('💰 ยืนยัน '+n+' บิลเรียบร้อย'):('💰 '+n+' bill(s) confirmed')); }} className="kd-btn" style={{ width:'100%', padding:'11px', fontSize:13, marginBottom:10, background:'var(--brand-soft)', color:'var(--brand-ink)', justifyContent:'center', display:'flex', gap:6, alignItems:'center' }}>{React.cloneElement(IC.check,{size:16})} {lang==='th'?`ติ๊กว่าตรงหมด (${unvN} บิล)`:`Mark all matched (${unvN})`}</button>}
              <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:6, lineHeight:1.45 }}>{lang==='th'?'แตะช่องติ๊ก = ตรวจแล้ว (ยอดตรง) · บิลไหนไม่ตรงกด “แก้” ใส่ยอดจริง/แนบสลิป':'Tap the box = checked (matched) · tap “Edit” to enter actual/slip if it differs'}</div>
              {digi.map(s=>{ const pl={promptpay:(lang==='th'?'พร้อมเพย์':'PromptPay'),transfer:(lang==='th'?'เงินโอน':'Transfer')}[s.pay]; const mism = s.verified && s.verifiedAmount!=null && Math.round(s.verifiedAmount)!==Math.round(saleTotal(s));
                return (<div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 0', borderBottom:'1px solid var(--hair)' }}>
                  <button onClick={()=>{ if(s.verified) store.unverifySale(s.id); else store.verifySale(s.id, null); }} style={{ width:26, height:26, borderRadius:8, flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:s.verified?'var(--brand)':'#fff', border:'2px solid '+(s.verified?'var(--brand)':'var(--hair-2)') }}>{s.verified && React.cloneElement(IC.check,{size:15, color:'#fff', stroke:3})}</button>
                  {s.slipUrl
                    ? <img src={s.slipUrl} onClick={()=>viewSlip(s.slipUrl)} alt="slip" style={{ width:44, height:44, borderRadius:9, objectFit:'cover', border:'1px solid var(--hair-2)', cursor:'pointer', flexShrink:0 }}/>
                    : <span style={{ width:44, height:44, borderRadius:9, background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-3)', flexShrink:0 }}>{React.cloneElement(IC.camera||IC.scan,{size:17})}</span>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:600 }}>{s.no?('#'+s.no+' '):''}<span style={{ color:'var(--ink-3)', fontWeight:500 }}>{pl}{s.t?' · '+s.t:''}</span></div>
                    <div className="num" style={{ fontSize:12.5, color: mism?'var(--danger)':'var(--ink-3)', fontWeight: mism?700:500, marginTop:1 }}>{money(Math.round(saleTotal(s)))}{mism?` → ${lang==='th'?'จริง':'actual'} ${money(Math.round(s.verifiedAmount))} (${lang==='th'?'ต่าง':'diff'} ${money(Math.round(s.verifiedAmount-saleTotal(s)))})`:''}</div>
                    {s.payStatus==='not_found' && <span style={{ display:'inline-block', marginTop:3, fontSize:10.5, fontWeight:800, color:'var(--danger)', background:'#FCECE8', borderRadius:6, padding:'2px 7px' }}>{lang==='th'?'ไม่พบยอดเงิน':'Not found'}</span>}
                    {s.payStatus==='discrepancy' && <span style={{ display:'inline-block', marginTop:3, fontSize:10.5, fontWeight:800, color:'#B26A00', background:'#FBEAD7', borderRadius:6, padding:'2px 7px' }}>{lang==='th'?'ยอดขาด/เกิน':'Short/over'}</span>}
                  </div>
                  <button onClick={()=>openVerify(s)} style={{ border:'none', cursor:'pointer', fontFamily:'var(--font)', fontWeight:700, fontSize:12, padding:'8px 13px', borderRadius:9, flexShrink:0, background: s.verified?'var(--brand-soft)':'var(--brand)', color: s.verified?'var(--brand-ink)':'#fff', display:'flex', alignItems:'center', gap:4 }}>{s.verified?(lang==='th'?'แก้':'Edit'):(lang==='th'?'ยืนยัน':'Confirm')}{s.verified && React.cloneElement(IC.edit,{size:12})}</button>
                </div>);
              })}
            </div>
          </div>
        </div>);
      })()}
      {verifyFor!=null && (()=>{ const s=verifyFor; const sys=Math.round(saleTotal(s)); const av=Number(verifyAmt)||0; const diff=av-sys; const pl={promptpay:(lang==='th'?'พร้อมเพย์':'PromptPay'),transfer:(lang==='th'?'เงินโอน':'Transfer')}[s.pay]||'';
        const done=()=>{ if(store&&store.verifySale) store.verifySale(s.id, verifySlipUrl||null, verifyAmt); setVerifyFor(null); };
        return (<div onClick={()=>setVerifyFor(null)} style={{ position:'absolute', inset:0, background:'rgba(10,25,20,.45)', zIndex:320, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'18px 20px calc(18px + env(safe-area-inset-bottom))', maxHeight:'92%', overflowY:'auto' }}>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:2 }}>{lang==='th'?'ยืนยันรับเงินเข้า':'Confirm money received'}</div>
            <div style={{ fontSize:12.5, color:'var(--ink-3)', marginBottom:14 }}>{(s.no?('#'+s.no+' · '):'')+pl}{s.t?' · '+s.t:''} · {lang==='th'?'ยอดระบบ':'System'} ฿{sys.toLocaleString()}</div>
            <div style={{ fontSize:12.5, fontWeight:700, color:'var(--ink-2)', marginBottom:6 }}>{lang==='th'?'ยอดที่เข้าบัญชีจริง':'Amount actually received'}</div>
            <div style={{ position:'relative', marginBottom:8 }}>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontWeight:700, fontSize:17 }}>฿</span>
              <input className="kd-input num" type="number" autoFocus value={verifyAmt} onChange={e=>setVerifyAmt(e.target.value)} style={{ padding:'14px 14px 14px 30px', fontSize:18, fontWeight:700, textAlign:'right' }}/>
            </div>
            {diff!==0 && av>0 && <div style={{ fontSize:12.5, textAlign:'right', marginBottom:12, color:'var(--danger)', fontWeight:700 }}>{lang==='th'?'ยอดไม่ตรง':'Mismatch'}: {diff>0?'+':''}{diff.toLocaleString()} ฿</div>}
            {diff===0 && <div style={{ fontSize:12, color:'var(--ink-3)', marginBottom:12 }}>{lang==='th'?'ยอดตรงกับระบบ — แก้ได้ถ้าเข้าจริงไม่เท่ากัน':'Matches system — edit if the real amount differs'}</div>}
            <div style={{ fontSize:12.5, fontWeight:700, color:'var(--ink-2)', marginBottom:6 }}>{lang==='th'?'สลิป (ไม่บังคับ)':'Slip (optional)'}</div>
            {verifySlipUrl
              ? <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}><img src={verifySlipUrl} alt="slip" style={{ width:56, height:56, borderRadius:10, objectFit:'cover', border:'1px solid var(--hair-2)' }}/><button onClick={pickSlipToState} className="kd-btn" style={{ padding:'8px 12px', fontSize:12.5, background:'var(--bg)', color:'var(--ink-2)' }}>{lang==='th'?'เปลี่ยนรูป':'Change'}</button><button onClick={()=>setVerifySlipUrl(null)} className="kd-btn" style={{ padding:'8px 12px', fontSize:12.5, background:'#FCECE8', color:'var(--danger)' }}>{lang==='th'?'ลบ':'Remove'}</button></div>
              : <button onClick={pickSlipToState} className="kd-btn" style={{ width:'100%', padding:'12px', fontSize:13, background:'var(--bg)', color:'var(--ink-2)', marginBottom:14, justifyContent:'center', display:'flex', gap:6, alignItems:'center' }}>{React.cloneElement(IC.camera||IC.scan,{size:16})} {lang==='th'?'แนบรูปสลิป':'Attach slip photo'}</button>}
            <button onClick={done} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:'14px', marginBottom:8 }}>{diff===0 ? (lang==='th'?'ยืนยันรับเงิน (ยอดตรง)':'Confirm (matched)') : (lang==='th'? `แจ้งยอด${diff>0?'เกิน':'ขาด'} ${diff>0?'+':''}${diff.toLocaleString()} ฿` : `Report ${diff>0?'over':'short'} ${diff>0?'+':''}${diff.toLocaleString()}`)}</button>
            <button onClick={()=>{ if(store&&store.verifySale) store.verifySale(s.id, verifySlipUrl||null, 0, 'not_found'); setVerifyFor(null); }} className="kd-btn kd-btn-block" style={{ padding:'13px', marginBottom:6, background:'#FCECE8', color:'var(--danger)', fontWeight:700, justifyContent:'center' }}>{lang==='th'?`ไม่พบยอดเงิน · บันทึก −${sys.toLocaleString()} ฿`:`Payment not found · record −${sys.toLocaleString()}`}</button>
            <div style={{ fontSize:11, color:'var(--ink-3)', textAlign:'center', marginBottom:10, lineHeight:1.45 }}>{lang==='th'?'ไม่พบยอด = สลิปปลอม/ไม่มีเงินเข้าบัญชี → บันทึกยอดจริง 0 สถานะ “ไม่พบยอดเงิน”':'Not found = fake slip / no money in → records 0, status “not found”'}</div>
            <button onClick={()=>setVerifyFor(null)} className="kd-btn kd-btn-block" style={{ padding:'13px', background:'var(--bg)', color:'var(--ink-2)', justifyContent:'center' }}>{lang==='th'?'ยกเลิก':'Cancel'}</button>
          </div>
        </div>);
      })()}
      {report && <div onClick={()=>setReport(null)} style={{ position:'absolute', inset:0, background:'rgba(10,25,20,.45)', zIndex:300, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>        <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'20px 20px 0 0', maxHeight:'93%', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px 12px', borderBottom:'1px solid var(--hair)' }}>
            <div style={{ fontSize:17, fontWeight:700 }}>{report.title}</div>
            <button onClick={()=>setReport(null)} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
          </div>
          <div className="kd-body" style={{ padding:'14px 18px', flex:1, overflowY:'auto', overflowX:'auto' }}>
            <style>{_repCss}</style>
            <div className="kdrep" dangerouslySetInnerHTML={{ __html: report.inner }}/>
          </div>
          <div style={{ padding:'12px 18px', borderTop:'1px solid var(--hair)', display:'flex', gap:10, flexShrink:0 }}>
            {report.csv && <button onClick={()=>_dlCsv(report.csv, report.fileName)} className="kd-btn" style={{ padding:14, background:'var(--bg)', color:'var(--ink-2)', flexShrink:0 }}>{React.cloneElement(IC.download||IC.receipt,{size:17})} CSV</button>}
            <button onClick={()=>_printOut(report.title, report.inner)} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:14 }}>{React.cloneElement(IC.receipt,{size:17})} {lang==='th'?'พิมพ์ / บันทึก PDF':'Print / Save PDF'}</button>
          </div>
        </div>
      </div>}
    </div>
  );
}

/* ══════════════ STORE BUILDER ══════════════ */
function StoreScreen({ menu, setMenu, chanCfg, addSaleMode, toggleSaleMode, removeSaleMode, pay, setPay, members, shop, setShop, addCat, updateCat, deleteCat, sub, setSub, costMode, setCostMode, raw, setRaw, addRaw, startNewShop, purchases, addPurchase, quotes, addQuote, updateQuote, deleteQuote, riders, addRider, updateRider, deleteRider, register, staffList, addStaff, removeStaff, updateStaff, setChannelGp, orders, sales, onGo }){
  const { t, lang } = useT();
  const cats = useCats();
  const [editing,setEditing] = m2State(null); // item or {new:true}
  const [addonSheet,setAddonSheet] = m2State(false);
  const [paySheet,setPaySheet] = m2State(false);
  const [memSheet,setMemSheet] = m2State(false);
  const [shopSheet,setShopSheet] = m2State(false);
  const [addCatOpen,setAddCatOpen] = m2State(false);
  const [subSheet,setSubSheet] = m2State(false);
  const [modeSheet,setModeSheet] = m2State(false);
  const [editCat,setEditCat] = m2State(null);
  const [quoteOpen,setQuoteOpen] = m2State(false);
  const [riderSheet,setRiderSheet] = m2State(false);
  const [staffSheet,setStaffSheet] = m2State(false);
  const [typeSheet,setTypeSheet] = m2State(false);
  const [toolsOpen,setToolsOpen] = m2State(false);
  const [saleModeOpen,setSaleModeOpen] = m2State(false);
  const [smAddOpen,setSmAddOpen] = m2State(false);
  const [resetSheet,setResetSheet] = m2State(false);
  const [resetOk,setResetOk] = m2State(false);
  const [resetCode,setResetCode] = m2State(''); const [resetCodeIn,setResetCodeIn] = m2State('');
  const openReset=()=>{ setResetCode(String(Math.floor(1000+Math.random()*9000))); setResetCodeIn(''); setResetOk(false); setResetSheet(true); };
  const [menuMgrOpen,setMenuMgrOpen] = m2State(false);
  // มาจาก "ตั้งเวลาเปิด-ปิดร้านก่อน" (กดจากหน้าเงินสด) → เปิดชีตตั้งค่าร้านให้เลย
  React.useEffect(()=>{ try{ if(window.__kdOpenHours){ window.__kdOpenHours=false; setShopSheet(true); } }catch(e){} }, []);
  const grouped = cats.map(c=>({ cat:c, items:menu.filter(m=>m.cat===c.id) }));
  const acceptCount = Object.values(pay.accept).filter(Boolean).length;
  const subDaysLeft = sub ? Math.max(0, Math.ceil((new Date(sub.expiry)-new Date())/86400000)) : 0;
  const SUB_PLANS = { trial:{th:'ทดลองใช้ฟรี',en:'Free trial'}, monthly:{th:'รายเดือน',en:'Monthly'}, yearly:{th:'รายปี',en:'Yearly'} };

  const save = (item)=>{
    setMenu(prev=>{
      const exists = prev.some(m=>m.id===item.id);
      return exists ? prev.map(m=>m.id===item.id?item:m) : [...prev, item];
    });
    setEditing(null);
  };

  return (
    <div className="kd-screen">
      <TopBar title={t('store')} sub={lang==='th'?'ตั้งค่าร้าน · จัดการการใช้งานส่วนต่างๆ ของแอป':'Store & app settings'}
        right={<button onClick={()=>setMenuMgrOpen(true)}
          className="kd-btn kd-btn-primary" style={{ padding:'9px 13px', fontSize:14 }}>{React.cloneElement(IC.plus,{size:16})} {lang==='th'?'เมนู':'Item'}</button>}/>
      <div className="kd-body" style={{ padding:'0 16px 24px' }}>
        {typeof window!=='undefined' && window.OnboardChecklist && React.createElement(window.OnboardChecklist,{ shop, setShop, menu, orders, sales, onGo, lang })}
        {typeof window!=='undefined' && window.KD_CONSIGN===false && <button onClick={()=>setAddonSheet(true)} className="kd-card" style={{ border:'none', cursor:'pointer', width:'100%', display:'flex', gap:12, alignItems:'center', padding:'14px 16px', marginBottom:14, fontFamily:'var(--font)', textAlign:'left', background:'var(--accent-soft)', boxShadow:'inset 0 0 0 1.5px var(--accent)' }}>
          <span style={{ fontSize:24, flexShrink:0 }}>🤝</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>{lang==='th'?`เปิดระบบขายฝาก +฿${kdAddonPrice('consign').monthly}/ด.`:`Enable consignment +฿${kdAddonPrice('consign').monthly}/mo`}</div>
            <div style={{ fontSize:12, color:'var(--ink-2)', marginTop:1, lineHeight:1.4 }}>{lang==='th'?'รับ/ส่งของฝากขาย · เคลียร์เงินเจ้าของสินค้า · ใบส่งของ':'Consignment stock, vendor settlement & delivery notes'}</div>
          </div>
          <span style={{ border:'none', background:'var(--accent)', color:'#fff', borderRadius:11, padding:'9px 14px', fontFamily:'var(--font)', fontWeight:700, fontSize:13, whiteSpace:'nowrap' }}>{lang==='th'?'เปิดใช้':'Get it'}</span>
        </button>}
        {addonSheet && <AddonConsignSheet store={{ shop, pay }} lang={lang} onClose={()=>setAddonSheet(false)} />}
        {/* ยินดีต้อนรับ + แจ้งตั้งเวลาเปิด-ปิดร้าน */}
        {!shop.hoursSet && <button onClick={()=>setShopSheet(true)} className="kd-card kd-fadein" style={{ border:'none', cursor:'pointer', width:'100%', textAlign:'left', fontFamily:'var(--font)', padding:'15px 16px', marginBottom:14, background:'#FFF8E9', boxShadow:'inset 0 0 0 1.5px #EBD79B', display:'flex', gap:12, alignItems:'flex-start' }}>
          <span style={{ fontSize:24, lineHeight:1, flexShrink:0 }}>👋</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#8A6100', marginBottom:3 }}>{lang==='th'?'ยินดีต้อนรับ! ตั้งเวลาเปิด–ปิดร้านก่อนเริ่มขาย':'Welcome! Set your opening hours first'}</div>
            <div style={{ fontSize:12.5, color:'#7A5A12', lineHeight:1.5 }}>{lang==='th'?'เวลาเปิด–ปิด และวันหยุด มีผลต่อการเปิด/ปิดร้านอัตโนมัติและระบบเปิด–ปิดกะ · แตะเพื่อตั้งค่าตอนนี้':'Opening hours and days off control auto open/close and the shift system · tap to set up now'}</div>
            <div style={{ marginTop:9 }}><span className="kd-btn kd-btn-primary" style={{ display:'inline-flex', padding:'8px 14px', fontSize:13 }}>{lang==='th'?'ตั้งเวลาเปิด–ปิดร้าน':'Set opening hours'}</span></div>
          </div>
        </button>}
        {/* store profile card (editable) */}
        <button onClick={()=>setShopSheet(true)} className="kd-card" style={{ border:'none', cursor:'pointer', width:'100%',
          padding:16, marginBottom:16, display:'flex', gap:14, alignItems:'center', fontFamily:'var(--font)', textAlign:'left' }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'var(--brand-soft)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>{shop.emoji}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:16 }}>{shop.name}</div>
            <div style={{ fontSize:13, color:'var(--ink-3)', marginTop:1 }}>{lang==='th'?`เปิด ${shop.open}–${shop.close} น.`:`Open ${shop.open}–${shop.close}`}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{React.cloneElement(IC.pin,{size:12, style:{verticalAlign:'-2px', marginRight:3}})}{shop.map}</div>
          </div>
          {(()=>{ const op=window.kdShopOpen?window.kdShopOpen(shop):shop.isOpen!==false; return (
          <span style={{ fontSize:11, fontWeight:700, color: op?'var(--brand-ink)':'var(--ink-3)',
            background: op?'var(--brand-soft)':'var(--bg)', padding:'4px 10px', borderRadius:999, whiteSpace:'nowrap' }}>
            {op?(lang==='th'?'เปิดอยู่':'Open'):(lang==='th'?'ปิดอยู่':'Closed')}</span>
          ); })()}
        </button>

        {/* settings rows */}
        <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-3)', margin:'2px 4px 0' }}>{lang==='th'?'ขายออนไลน์ · ให้ลูกค้าสั่งเอง':'Online · customer ordering'}</div>
          <div style={{ fontSize:11, color:'var(--ink-3)', margin:'-2px 4px 2px', lineHeight:1.45 }}>{lang==='th'?'เปิด/ปิดการให้ลูกค้าสั่งเอง (QR/ลิงก์ — ไม่ต้องมี LINE OA · หรือผ่าน LINE OA) · เดลิเวอรี · จอคิว/จอครัวแชร์ที่หน้า “จัดการร้าน”':'Turn customer self-ordering (QR/link — no LINE OA needed, or via LINE OA), delivery & channels on/off'}</div>
          <button onClick={()=>setTypeSheet(true)} className="kd-card" style={{ border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:13, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:11, background:'#EEF0FF', color:'#4A54B8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19 }}>🏪</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14.5, fontWeight:700 }}>{lang==='th'?'เปิด/ปิดโมดูล · ประเภทร้าน':'Modules · shop type'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{(shop.typeLabel)||(lang==='th'?'ให้ลูกค้าสั่งเอง · เดลิเวอรี · ไรเดอร์':'Self-ordering · delivery · riders')}{shop.features&&shop.features.delivery===false?(lang==='th'?' · ไม่ส่ง':' · no delivery'):''}</div>
            </div>
            <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
          </button>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-3)', margin:'10px 4px 0' }}>{lang==='th'?'เมนู & สินค้าที่ขาย':'Menu & items'}</div>
          <button onClick={()=>setMenuMgrOpen(true)} className="kd-card" style={{ border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:13, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:11, background:'var(--brand-soft)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19 }}>🍽️</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14.5, fontWeight:700 }}>{lang==='th'?'จัดการเมนู · สินค้าที่โชว์หน้าขาย':'Manage menu · items on Sell'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{lang==='th'?`${menu.length} เมนู · ${cats.length} หมวด — เพิ่ม/แก้ราคา ต้นทุน แล้วโชว์หน้าขาย`:`${menu.length} items · ${cats.length} categories`}</div>
            </div>
            <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
          </button>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-3)', margin:'10px 4px 0' }}>{lang==='th'?'รับเงิน & ลูกค้า':'Payments & customers'}</div>
          <button onClick={()=>setPaySheet(true)} className="kd-card" style={{ border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:13, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:11, background:'var(--brand-soft)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.qr,{size:20})}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14.5, fontWeight:700 }}>{lang==='th'?'ตั้งค่ารับเงิน · QR พร้อมเพย์':'Payment & QR settings'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{pay.promptpay} · {lang==='th'?`รับ ${acceptCount} ช่องทาง`:`${acceptCount} methods`}</div>
            </div>
            <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
          </button>
          <button onClick={()=>setMemSheet(true)} className="kd-card" style={{ border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:13, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:11, background:'var(--accent-soft)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.star,{size:20})}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14.5, fontWeight:700 }}>{lang==='th'?'สมาชิก · สะสมแต้ม':'Members · loyalty'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{lang==='th'?`${members.length} สมาชิก · แต้มทุก ฿25 = 1 คะแนน`:`${members.length} members · 1 pt / ฿25`}</div>
            </div>
            <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
          </button>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-3)', margin:'10px 4px 0' }}>{lang==='th'?'ช่องทางการขาย':'Sale channels'}</div>
          <div style={{ fontSize:11, color:'var(--ink-3)', margin:'-2px 4px 2px', lineHeight:1.45 }}>{lang==='th'?'เลือกเปิด/ปิดช่องทางที่จะให้โชว์บนหน้า “ขาย” — หน้าร้าน · เดลิเวอรี · แพลตฟอร์มต่าง ๆ':'Toggle which channels show on the Sell screen — in-store, delivery, platforms'}</div>
          <button onClick={()=>setSaleModeOpen(true)} className="kd-card" style={{ border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:13, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:11, background:'var(--brand-soft)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.moto,{size:20})}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14.5, fontWeight:700 }}>{lang==='th'?'ช่องทางขาย · แพลตฟอร์มเดลิเวอรี':'Sale channels · platforms'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{lang==='th'?`Grab / LINE MAN / ShopeeFood / หน้าร้าน · เปิดอยู่ ${activeSaleModes(chanCfg).length} ช่องทาง`:`Add/toggle once · ${activeSaleModes(chanCfg).length} active`}</div>
            </div>
            <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
          </button>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-3)', margin:'10px 4px 0' }}>{lang==='th'?'ต้นทุน & สต๊อก':'Costs & stock'}</div>
          <button onClick={()=>setModeSheet(true)} className="kd-card" style={{ border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:13, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:11, background:'var(--brand-soft)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.box,{size:20})}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14.5, fontWeight:700 }}>{lang==='th'?'สต๊อก / วิธีคิดต้นทุน':'Stock / costing'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{lang==='th'?'คิดต่อเมนู: ต้นทุน/จาน หรือ สูตร+ตัดสต๊อก':'Per item: flat or recipe + stock'}</div>
            </div>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--brand-ink)', background:'var(--brand-soft)', padding:'4px 10px', borderRadius:999 }}>{lang==='th'?'ผสม':'Hybrid'}</span>
          </button>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-3)', margin:'10px 4px 0' }}>{lang==='th'?'ทีมงาน':'Team'}</div>
          <button onClick={()=>setRiderSheet(true)} className="kd-card" style={{ border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:13, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:11, background:'#ECEEED', color:'var(--ink)', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.moto,{size:20})}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14.5, fontWeight:700 }}>{lang==='th'?'ทีมส่ง · ไรเดอร์ร้าน':'Delivery team · riders'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{(pay&&pay.ridersComingSoon!==false)?(lang==='th'?'ระบบไรเดอร์ในตัว · กำลังจะเปิดให้ใช้':'Built-in rider system · launching soon'):(lang==='th'?`${(riders||[]).filter(r=>r.active!==false).length} คนพร้อมส่ง · แชร์ลิงก์ไรเดอร์`:`${(riders||[]).filter(r=>r.active!==false).length} active · share rider link`)}</div>
            </div>
            {(pay&&pay.ridersComingSoon!==false)
              ? <span style={{ fontSize:11, fontWeight:700, color:'#8A6100', background:'#FBEEDA', padding:'4px 10px', borderRadius:999 }}>{lang==='th'?'เร็วๆ นี้':'Soon'}</span>
              : <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>}
          </button>
          <button onClick={()=>setStaffSheet(true)} className="kd-card" style={{ border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:13, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:11, background:'#E6EEF6', color:'#2E6FB0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19 }}>🧑‍🍳</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14.5, fontWeight:700 }}>{lang==='th'?'ทะเบียนพนักงาน · ผู้ทำรายการ':'Staff registry'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{lang==='th'?`${(staffList||[]).length} คน · แชร์ลิงก์พนักงาน (ขาย/ออเดอร์)`:`${(staffList||[]).length} staff · share staff link`}</div>
            </div>
            <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
          </button>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-3)', margin:'10px 4px 0' }}>{lang==='th'?'เครื่องมือหน้าร้าน':'Shop tools'}</div>
          <button onClick={()=>setToolsOpen(true)} className="kd-card" style={{ border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:13, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:11, background:'#EEF0FF', color:'#4A54B8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19 }}>🧩</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14.5, fontWeight:700 }}>{lang==='th'?'โมดูล & เครื่องมือหน้าร้าน':'Modules & shop tools'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{lang==='th'?'Mobile Order · LINE OA · จอคิว · จอครัว — เปิด/ปิด + ลิงก์/QR':'Mobile Order · LINE OA · queue · KDS — toggle + links/QR'}</div>
            </div>
            <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
          </button>
          <div style={{ marginTop:8 }}>
            {typeof window!=='undefined' && window.HomeLinks && React.createElement(window.HomeLinks,{ shop, lang })}
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-3)', margin:'10px 4px 0' }}>{lang==='th'?'เอกสาร':'Documents'}</div>
          <button onClick={()=>setQuoteOpen(true)} className="kd-card" style={{ border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:13, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:11, background:'var(--accent-soft)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.receipt,{size:20})}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14.5, fontWeight:700 }}>{lang==='th'?'ใบเสนอราคา':'Quotation'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{lang==='th'?'สร้างใบเสนอราคาให้ลูกค้า/องค์กร (งานจัดเลี้ยง · ออเดอร์ใหญ่) · คิด/ไม่คิด VAT · พิมพ์/ส่ง PDF':'Quotes for customers/companies (catering · bulk) · VAT optional · print/PDF'}</div>
            </div>
            <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
          </button>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-3)', margin:'10px 4px 0' }}>{lang==='th'?'ตั้งค่า & ระบบ':'Settings & system'}</div>
          <button onClick={()=>setSubSheet(true)} className="kd-card" style={{ border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:13, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:11, background:'#EAF0FA', color:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.wallet,{size:20})}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14.5, fontWeight:700 }}>{lang==='th'?'แพ็กเกจ · ต่ออายุการใช้งาน':'Plan · renew app'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{(SUB_PLANS[sub?.plan]?.[lang])||''} · {lang==='th'?`เหลือ ${subDaysLeft} วัน`:`${subDaysLeft} days left`}</div>
            </div>
            <span style={{ fontSize:11, fontWeight:700, color: subDaysLeft<=7?'var(--danger)':'var(--brand-ink)', background: subDaysLeft<=7?'#FCECE8':'var(--brand-soft)', padding:'4px 10px', borderRadius:999 }}>{subDaysLeft}{lang==='th'?' วัน':'d'}</span>
          </button>
          <FabToggleCard lang={lang}/>
        </div>

        {menuMgrOpen && <Sheet open={true} onClose={()=>setMenuMgrOpen(false)} height="94%">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 18px 10px' }}>
            <div>
              <div style={{ fontSize:19, fontWeight:800 }}>{lang==='th'?'เมนู · สินค้า':'Menu · items'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:1 }}>{lang==='th'?'รายการที่โชว์บนหน้า“ขาย”':'Shown on the Sell screen'}</div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button onClick={()=>setEditing({ id:'m'+Date.now(), cat:(cats[0]&&cats[0].id)||'savory', th:'', en:'', price:0, cost:0, tone:'#EFE3CE' })} className="kd-btn kd-btn-primary" style={{ padding:'8px 12px', fontSize:13.5 }}>{React.cloneElement(IC.plus,{size:15})} {lang==='th'?'เพิ่มเมนู':'Add'}</button>
              <button onClick={()=>setMenuMgrOpen(false)} style={{ border:'none', background:'var(--bg)', width:36, height:36, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
            </div>
          </div>
          <div style={{ overflowY:'auto', padding:'0 16px', flex:1 }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start', background:'var(--brand-soft)', borderRadius:12, padding:'11px 13px', marginBottom:14 }}>
              <span style={{ fontSize:18, lineHeight:1, flexShrink:0 }}>💡</span>
              <div style={{ fontSize:12.5, color:'var(--brand-ink)', lineHeight:1.5 }}>{lang==='th'?'เมนูที่เพิ่ม/เปิดขายที่นี่ จะแสดงบนหน้า “ขาย” อัตโนมัติ ให้พนักงานและลูกค้าเลือกสั่งได้ทันที · แตะเมนูเพื่อแก้ราคา/ต้นทุน':'Items you add here appear on the “Sell” screen automatically. Tap an item to edit price & cost.'}</div>
            </div>
            <div style={{ fontSize:13, color:'var(--ink-3)', fontWeight:600, margin:'0 4px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span>{lang==='th'?`${menu.length} เมนู · ${cats.length} หมวด`:`${menu.length} items · ${cats.length} categories`}</span>
              {addCat && <button onClick={()=>setAddCatOpen(true)} style={{ border:'none', cursor:'pointer', background:'var(--brand-soft)', color:'var(--brand-ink)',
                fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, padding:'6px 11px', borderRadius:999, display:'inline-flex', alignItems:'center', gap:4 }}>
                {React.cloneElement(IC.plus,{size:14})} {lang==='th'?'หมวด':'Category'}</button>}
            </div>
            {menu.length===0 && <div style={{ textAlign:'center', color:'var(--ink-3)', padding:'28px 20px 6px', fontSize:13.5, lineHeight:1.6 }}>{lang==='th'?'ยังไม่มีเมนู — แตะ “เพิ่มเมนู” เพื่อสร้างรายการแรกที่จะโชว์บนหน้าขาย':'No items yet — tap “Add” to create your first item.'}</div>}

        {grouped.map(g=>(
          <div key={g.cat.id} style={{ marginBottom:18 }}>
            <div style={{ fontSize:14, fontWeight:700, margin:'0 4px 9px', display:'flex', alignItems:'center', gap:6 }}>
              <button onClick={()=>setEditCat(g.cat)} style={{ border:'none', background:'none', cursor:'pointer', fontFamily:'var(--font)', fontSize:14, fontWeight:700, color:'var(--ink)', display:'inline-flex', alignItems:'center', gap:6, padding:0 }}>
                <span>{g.cat.emoji}</span>{g.cat[lang]||g.cat.th}
                <span style={{ color:'var(--ink-3)', fontWeight:500 }}>· {g.items.length}</span>
                {React.cloneElement(IC.edit,{size:13, color:'var(--ink-3)'})}
              </button></div>
            <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
              {g.items.map(m=>{ const ec=effItemCost(m, raw, costMode); const pf=m.price-ec; const mg=m.price?Math.round(pf/m.price*100):0; return (
                <div key={m.id} className="kd-card" style={{ display:'flex', alignItems:'center', gap:12, padding:11, opacity: m.off?0.6:1 }}>
                  <div onClick={()=>setEditing(m)} style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
                    <FoodTile item={m} size={48} radius={12}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14.5, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>{m[lang]||m.th||(lang==='th'?'(เมนูใหม่)':'(new item)')}{m.off && <span style={{ fontSize:10.5, fontWeight:700, color:'var(--danger)', background:'#FCECE8', padding:'2px 7px', borderRadius:999 }}>{lang==='th'?'หมด':'Off'}</span>}</div>
                      <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>
                        <span className="num">{t('cost')} {money(Math.round(ec))}</span> · <span className="num" style={{ color:'var(--brand-ink)', fontWeight:700 }}>{t('profit')} {money(Math.round(pf))}</span>
                      </div>
                      {(m.recipe&&m.recipe.length) ? <div style={{ marginTop:5 }}>
                        <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:999, background:'var(--brand-soft)', color:'var(--brand-ink)' }}>{lang==='th'?'🧾 คิดจากสูตร · ตัดสต๊อก':'From recipe · auto-deduct'}</span>
                      </div> : null}
                      {(m.options&&m.options.length) ? <div style={{ marginTop:5 }}>
                        <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:999, background:'#EEF0FF', color:'#4A54B8' }}>🧩 {m.options.length} {lang==='th'?'ตัวเลือก':'options'}</span>
                      </div> : null}
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div className="num" style={{ fontWeight:700, fontSize:15 }}>{money(m.price)}</div>
                      <div style={{ fontSize:11, color:'var(--brand)', fontWeight:700 }}>{mg}%</div>
                    </div>
                  </div>
                  <button onClick={()=>setMenu(prev=>prev.map(x=>x.id===m.id?{...x, off:!x.off}:x))} title={m.off?(lang==='th'?'เปิดขาย':'Turn on'):(lang==='th'?'ปิดขาย (สินค้าหมด)':'Turn off')} style={{ border:'none', background:'none', cursor:'pointer', padding:'4px 2px', flexShrink:0 }}><Toggle on={!m.off}/></button>
                </div>
              );})}
            </div>
          </div>
        ))}
          </div>
        </Sheet>}

        <button onClick={openReset} className="kd-card" style={{ border:'none', cursor:'pointer', width:'100%', display:'flex', alignItems:'center', gap:13, padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left', marginTop:9 }}>
          <span style={{ width:38, height:38, borderRadius:11, background:'#FCECE8', color:'var(--danger)', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.x,{size:18})}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14.5, fontWeight:700, color:'var(--danger)' }}>{lang==='th'?'ลบร้าน · สมัครใหม่ด้วย LINE อื่น':'Delete shop · re-register with another LINE'}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{lang==='th'?'ล้างร้านนี้ออกจากระบบ — แพ็กเดิมถือเป็นโมฆะ ไม่มีการคืนเงิน':'Release this shop — old package is void, no refund'}</div>
          </div>
          <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
        </button>
        {typeof window!=='undefined' && window.ReferFriend && <div style={{ marginTop:16 }}>{React.createElement(window.ReferFriend,{ shop, lang })}</div>}
        {resetSheet && <div onClick={()=>setResetSheet(false)} style={{ position:'absolute', inset:0, zIndex:95, background:'rgba(10,20,15,.55)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:440, background:'#fff', borderRadius:'20px 20px 0 0', padding:'20px 20px calc(96px + env(safe-area-inset-bottom))', maxHeight:'90vh', overflowY:'auto', fontFamily:'var(--font)' }}>
            <div style={{ fontSize:19, fontWeight:800, color:'var(--danger)', marginBottom:6 }}>{lang==='th'?'ลบร้าน · สมัครใหม่ด้วย LINE อื่น':'Delete shop · re-register with another LINE'}</div>
            <div style={{ fontSize:13, color:'var(--ink-2)', lineHeight:1.55, marginBottom:12 }}>{lang==='th'?'จะลบข้อมูลทั้งหมดในเครื่องนี้อย่างถาวร กู้คืนไม่ได้ — รวมถึง':'Permanently deletes everything on this device — including'}</div>
            <div style={{ background:'#FFF7F5', border:'1px solid #F3C9C0', borderRadius:12, padding:'2px 14px', marginBottom:14 }}>
              {[['🧾', lang==='th'?'ยอดขาย · รายงาน · ประวัติปิดวันทั้งหมด':'All sales · reports · daily history'],['🍽️', lang==='th'?'เมนูสินค้า · หมวดหมู่ · สูตร':'Menu · categories · recipes'],['📦', lang==='th'?'สต๊อก · วัตถุดิบ · บันทึกการซื้อ':'Stock · ingredients · purchases'],['💵', lang==='th'?'เงินสด · ประวัติเปิด-ปิดวัน':'Cash · open/close history'],['👥', lang==='th'?'สมาชิก · ลูกค้า':'Members · customers'],['⚙️', lang==='th'?'ตั้งค่ารับเงิน · VAT · ช่องทางขาย':'Payment · VAT · sale channels']].map(([ic,tx],i,a)=>(
                <div key={i} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 0', borderBottom: i<a.length-1?'1px solid #F3D6CE':'none', fontSize:13, color:'var(--ink)' }}><span style={{ fontSize:16 }}>{ic}</span><span>{tx}</span></div>
              ))}
            </div>
            <div style={{ background:'#FFF4D6', color:'#8A6100', borderRadius:10, padding:'10px 13px', fontSize:12.5, lineHeight:1.55, marginBottom:14 }}>{lang==='th'?'❗ แพ็กเกจที่ใช้อยู่จะถือเป็นโมฆะทันที · ไม่มีการคืนเงินหรือทอนวันคงเหลือ — หลังลบ สมัครใหม่ด้วย LINE ไหนก็ได้':'❗ Your current package becomes void immediately · no refund or remaining-day credit — after delete, sign up again with any LINE.'}</div>
            <label style={{ display:'flex', gap:9, alignItems:'flex-start', cursor:'pointer', marginBottom:14, fontSize:13, color:'var(--ink)' }}>
              <input type="checkbox" checked={resetOk} onChange={e=>setResetOk(e.target.checked)} style={{ width:20, height:20, marginTop:1, accentColor:'var(--danger)' }}/>
              <span>{lang==='th'?'ฉันเข้าใจว่าข้อมูลทั้งหมด รวมยอดขาย จะถูกลบถาวร และแพ็กเดิมเป็นโมฆะ':'I understand all data will be permanently deleted and the old package is void.'}</span>
            </label>
            <div style={{ fontSize:12.5, fontWeight:700, color:'var(--ink-2)', marginBottom:6 }}>{lang==='th'?'พิมพ์รหัสยืนยันเพื่อลบ':'Type the confirmation code to delete'}</div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <div style={{ fontFamily:'var(--mono,monospace)', fontSize:22, fontWeight:800, letterSpacing:'5px', color:'var(--danger)', background:'#FCECE8', borderRadius:10, padding:'8px 16px' }}>{resetCode}</div>
              <input className="kd-input num" inputMode="numeric" maxLength={4} value={resetCodeIn} onChange={e=>setResetCodeIn(e.target.value.replace(/\D/g,''))} placeholder={lang==='th'?'ใส่รหัส':'code'} style={{ flex:1, textAlign:'center', letterSpacing:'4px', fontWeight:700 }}/>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setResetSheet(false)} className="kd-btn" style={{ flex:1, padding:13, background:'var(--bg)', color:'var(--ink-2)' }}>{lang==='th'?'ยกเลิก':'Cancel'}</button>
              <button disabled={!resetOk || resetCodeIn!==resetCode} onClick={()=>{ setResetSheet(false); startNewShop({ acceptedAt:Date.now(), code:resetCode, packageVoidAck:true, shopName:(shop&&shop.name)||'', ownerName:(shop&&shop.owner&&shop.owner.name)||'' }); }} className="kd-btn" style={{ flex:1.4, padding:13, background:'var(--danger)', color:'#fff', fontWeight:700, opacity:(resetOk && resetCodeIn===resetCode)?1:.5 }}>{lang==='th'?'ลบร้าน · สมัครใหม่':'Delete shop'}</button>
            </div>
          </div>
        </div>}
      </div>

      {editing && <ItemEditor item={editing} onSave={save} onClose={()=>setEditing(null)} costMode={costMode} raw={raw} addRaw={addRaw} chanCfg={chanCfg} addSaleMode={addSaleMode} toggleSaleMode={toggleSaleMode} removeSaleMode={removeSaleMode}
        onDelete={()=>{ const delId=editing.id; setMenu(prev=>prev.filter(m=>m.id!==delId)); setEditing(null);
          // ลบบนเซิร์ฟเวอร์ด้วย (push เมนูเป็น upsert อย่างเดียว — ไม่ลบให้) ไม่งั้นเมนูที่ลบจะกลับมาตอนโหลดใหม่/เปิดอีกเครื่อง
          try{ if(window.KD_LIVE && window.KD_API && window.KD_API.deleteMenuItem) window.KD_API.deleteMenuItem(delId).catch(()=>{}); }catch(e){} }} />}
      {paySheet && <PaySettingsSheet pay={pay} setPay={setPay} onClose={()=>setPaySheet(false)} />}
      {memSheet && <MembersSheet members={members} pay={pay} setPay={setPay} onClose={()=>setMemSheet(false)} />}
      {shopSheet && <ShopProfileSheet shop={shop} setShop={setShop} regOpen={register&&register.open} onClose={()=>setShopSheet(false)} />}
      {addCatOpen && <AddCatSheet onClose={()=>setAddCatOpen(false)} onAdd={(c)=>{ addCat(c); setAddCatOpen(false); }}/>}
      {editCat && <AddCatSheet initial={editCat} onClose={()=>setEditCat(null)} onAdd={(c)=>{ updateCat(editCat.id, c); setEditCat(null); }}
        onDelete={cats.length>1?()=>{ if(window.confirm(lang==='th'?`ลบหมวด “${editCat.th}”? เมนูในหมวดนี้จะย้ายไปหมวดอื่น`:`Delete “${editCat.th}”? Items move to another category.`)){ deleteCat(editCat.id); setEditCat(null); } }:null}/>}
      {subSheet && <SubscriptionSheet sub={sub} setSub={setSub} onClose={()=>setSubSheet(false)} />}
      {modeSheet && <CostModeSheet costMode={costMode} setCostMode={setCostMode} onClose={()=>setModeSheet(false)} />}
      {quoteOpen && <QuotationScreen menu={menu} shop={shop} pay={pay} raw={raw} costMode={costMode} purchases={purchases} addPurchase={addPurchase} quotes={quotes} addQuote={addQuote} updateQuote={updateQuote} deleteQuote={deleteQuote} onClose={()=>setQuoteOpen(false)} />}
      {riderSheet && <RiderTeamSheet shop={shop} setShop={setShop} riders={riders||[]} addRider={addRider} updateRider={updateRider} deleteRider={deleteRider} onClose={()=>setRiderSheet(false)} />}
      {staffSheet && <StaffRosterSheet shop={shop} staffList={staffList||[]} addStaff={addStaff} removeStaff={removeStaff} updateStaff={updateStaff} pay={pay} setPay={setPay} onClose={()=>setStaffSheet(false)} />}
      {typeSheet && <ShopTypeSheet shop={shop} setShop={setShop} onClose={()=>setTypeSheet(false)} />}
      {toolsOpen && typeof window!=='undefined' && window.ModuleToolsSheet && React.createElement(window.ModuleToolsSheet,{ shop, setShop, lang, onClose:()=>setToolsOpen(false) })}
      {saleModeOpen && <ManageSaleModesSheet chanCfg={chanCfg} toggleSaleMode={toggleSaleMode} removeSaleMode={removeSaleMode} setChannelGp={setChannelGp} onAdd={()=>{ setSaleModeOpen(false); setSmAddOpen(true); }} onClose={()=>setSaleModeOpen(false)} />}
      {smAddOpen && <AddSaleModeSheet onClose={()=>{ setSmAddOpen(false); setSaleModeOpen(true); }} onAdd={(def)=>{ addSaleMode&&addSaleMode(def); setSmAddOpen(false); setSaleModeOpen(true); }} />}
    </div>
  );
}

/* ══════════════ RIDER TEAM (ทีมส่งของร้าน) ══════════════ */
function RiderTeamSheet({ shop, setShop, riders, addRider, updateRider, deleteRider, onClose }){
  const { lang } = useT();
  const TH = lang!=='en';
  const [f,setF] = m2State({ name:'', phone:'', plate:'' });
  const [copied,setCopied] = m2State(false);
  const sid = (shop && shop.shopId) || (typeof window!=='undefined' && window.KD_SHOP) || '';
  const origin = (typeof location!=='undefined') ? location.origin+location.pathname.replace(/[^/]*$/,'') : '';
  const riderUrl = `${origin}?shop=${sid}&role=rider`;
  const cp=()=>{ try{ navigator.clipboard.writeText(riderUrl); }catch(e){} setCopied(true); setTimeout(()=>setCopied(false),1400); };
  const add=()=>{ if(!f.name.trim()) return; addRider(f); setF({ name:'', phone:'', plate:'' }); };
  return (
    <Sheet open={true} onClose={onClose} height="92%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{TH?'ทีมส่ง · ไรเดอร์ร้าน':'Delivery team'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        {/* rider link to share */}
        <div className="kd-card" style={{ padding:'14px 15px', marginBottom:16, background:'linear-gradient(135deg,#1B2420,#2E3B34)', color:'#fff', boxShadow:'none' }}>
          <div style={{ fontSize:13.5, fontWeight:700, display:'flex', alignItems:'center', gap:7 }}>{React.cloneElement(IC.moto,{size:16})} {TH?'ลิงก์สำหรับไรเดอร์':'Rider link'}</div>
          <div style={{ fontSize:12, opacity:.8, margin:'4px 0 9px' }}>{TH?'ส่งให้คนขับของร้าน — เปิดแล้วเห็นเฉพาะงานส่ง':'Share with your riders — they see delivery jobs only'}</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.14)', borderRadius:10, padding:'7px 7px 7px 11px' }}>
            <code style={{ flex:1, fontFamily:'var(--mono)', fontSize:11, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{riderUrl}</code>
            <button onClick={cp} style={{ border:'none', background:'#fff', color:'var(--ink)', borderRadius:8, padding:'6px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap' }}>{copied?(TH?'คัดลอกแล้ว':'Copied'):(TH?'คัดลอก':'Copy')}</button>
          </div>
        </div>

        {/* delivery fee policy */}
        <div className="kd-card" style={{ padding:'15px 16px', marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:3 }}>{TH?'ค่าส่งเดลิเวอรี':'Delivery fee'}</div>
          <div style={{ fontSize:12, color:'var(--ink-3)', marginBottom:12, lineHeight:1.45 }}>{TH?'เลือกวิธีคิดค่าส่งของร้าน':'How the delivery fee is charged'}</div>
          {(()=>{ const feats=(shop&&shop.features)||{}; const setFeat=(k,v)=>setShop(p=>({...p, features:{ ...(p.features||{}), [k]:v }})); return (
            <div style={{ marginBottom:14 }}>
              {[['delivery',TH?'รับออเดอร์เดลิเวอรี (มีคนส่ง)':'Delivery'],['pickup',TH?'ให้ลูกค้ารับที่ร้าน (Pickup)':'Pickup']].map(([k,l])=>{ const on=feats[k]!==false; return (
                <div key={k} onClick={()=>setFeat(k,!on)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', cursor:'pointer', borderBottom:'1px solid var(--hair)' }}>
                  <span style={{ color:on?'var(--brand)':'var(--ink-3)' }}>{React.cloneElement(k==='delivery'?IC.moto:IC.store,{size:19})}</span>
                  <div style={{ flex:1, fontSize:14, fontWeight:600 }}>{l}</div>
                  <Toggle on={on}/>
                </div>
              );})}
              <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:8, lineHeight:1.4 }}>{TH?'ปิดเดลิเวอรีได้ถ้ายังไม่มีไรเดอร์ — ลูกค้าจะเห็นเฉพาะช่องที่เปิด':'Turn off delivery if you have no rider yet — customers see only enabled options'}</div>
            </div>
          ); })()}
          {(()=>{ const d=(shop&&shop.delivery)||{}; const mode=d.mode||'customer'; const setD=(patch)=>setShop(p=>({...p, delivery:{ ...(p.delivery||{}), ...patch }}));
            const OPTS=[['customer',TH?'ลูกค้าจ่ายค่าส่ง (เหมาจ่าย)':'Customer pays (flat)'],['shop',TH?'ร้านออกค่าส่งให้ (ฟรีลูกค้า)':'Shop pays (free for customer)'],['distance',TH?'คิดตามระยะทางจริง (จากหมุด)':'By real distance (map pin)']];
            return (<React.Fragment>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {OPTS.map(([k,l])=>(
                  <button key={k} onClick={()=>setD({mode:k})} style={{ border:'2px solid '+(mode===k?'var(--brand)':'var(--hair-2)'), background:mode===k?'var(--brand-soft)':'#fff', cursor:'pointer', borderRadius:12, padding:'11px 13px', display:'flex', alignItems:'center', gap:10, fontFamily:'var(--font)', textAlign:'left' }}>
                    <span style={{ width:20, height:20, borderRadius:999, border:'2px solid '+(mode===k?'var(--brand)':'var(--hair-2)'), background:mode===k?'var(--brand)':'#fff', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>{mode===k && <span style={{ width:8, height:8, borderRadius:999, background:'#fff' }}/>}</span>
                    <span style={{ fontSize:14, fontWeight:600 }}>{l}</span></button>
                ))}
              </div>
              {mode!=='distance'
                ? <div style={{ marginTop:12 }}><Lbl>{TH?'ค่าส่งเหมาจ่าย (บาท)':'Flat fee (฿)'}</Lbl><NumInput value={d.flat!=null?d.flat:20} onChange={v=>setD({flat:v})}/></div>
                : <div style={{ marginTop:12, display:'flex', gap:10 }}>
                    <div style={{ flex:1 }}><Lbl>{TH?'ค่าเริ่มต้น (บาท)':'Base (฿)'}</Lbl><NumInput value={d.base!=null?d.base:10} onChange={v=>setD({base:v})}/></div>
                    <div style={{ flex:1 }}><Lbl>{TH?'บาท/กม.':'฿/km'}</Lbl><NumInput value={d.perKm!=null?d.perKm:6.5} onChange={v=>setD({perKm:v})}/></div>
                  </div>}
              <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--hair)' }}>
                <div style={{ fontSize:13.5, fontWeight:700, marginBottom:8 }}>{TH?'การจ่ายเงินไรเดอร์':'Rider payout'}</div>
                {[['endday',TH?'โอนจ่ายสิ้นวัน (รวมรอบ)':'End of day (batched)'],['pertrip',TH?'จ่ายต่อรอบ (ทันทีที่ส่งเสร็จ)':'Per trip']].map(([k,l])=>{ const pon=(d.payout||'endday')===k; return (
                  <button key={k} onClick={()=>setD({payout:k})} style={{ width:'100%', border:'2px solid '+(pon?'var(--brand)':'var(--hair-2)'), background:pon?'var(--brand-soft)':'#fff', cursor:'pointer', borderRadius:12, padding:'10px 13px', marginBottom:8, display:'flex', alignItems:'center', gap:10, fontFamily:'var(--font)', textAlign:'left' }}>
                    <span style={{ width:18, height:18, borderRadius:999, border:'2px solid '+(pon?'var(--brand)':'var(--hair-2)'), background:pon?'var(--brand)':'#fff', flexShrink:0 }}/>
                    <span style={{ fontSize:13.5, fontWeight:600 }}>{l}</span></button>
                );})}
              </div>
            </React.Fragment>);
          })()}
        </div>

        {/* rider list */}
        <div style={{ fontSize:13.5, fontWeight:700, margin:'0 2px 10px' }}>{TH?`ไรเดอร์ของร้าน (${riders.length})`:`Riders (${riders.length})`}</div>
        {riders.length===0 && <div style={{ fontSize:13, color:'var(--ink-3)', background:'var(--bg)', borderRadius:12, padding:'16px', textAlign:'center', marginBottom:14 }}>{TH?'ยังไม่มีไรเดอร์ — เพิ่มคนส่งด้านล่าง':'No riders yet — add one below'}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:16 }}>
          {riders.map(r=>(
            <div key={r.id} className="kd-card" style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:12, boxShadow:'none', background:'var(--bg)', opacity: r.active===false?.55:1 }}>
              <div style={{ width:40, height:40, borderRadius:999, background:'var(--ink)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{React.cloneElement(IC.moto,{size:19})}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14.5, fontWeight:700 }}>{r.name||(TH?'(ไม่มีชื่อ)':'(no name)')}</div>
                <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:1 }} className="num">{[r.phone, r.plate].filter(Boolean).join(' · ')||'—'}</div>
              </div>
              <button onClick={()=>updateRider(r.id,{ active: r.active===false })} title={r.active===false?(TH?'เปิดงาน':'Activate'):(TH?'พักงาน':'Pause')} style={{ border:'none', background:'none', cursor:'pointer', padding:'4px 2px', flexShrink:0 }}><Toggle on={r.active!==false}/></button>
              <button onClick={()=>{ if(window.confirm(TH?`ลบไรเดอร์ “${r.name}”?`:`Remove “${r.name}”?`)) deleteRider(r.id); }} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-3)', padding:4, flexShrink:0 }}>{React.cloneElement(IC.x,{size:16})}</button>
            </div>
          ))}
        </div>

        {/* add rider */}
        <div className="kd-card" style={{ padding:'14px 15px', boxShadow:'none', background:'var(--brand-softer)' }}>
          <div style={{ fontSize:13.5, fontWeight:700, marginBottom:10 }}>{TH?'เพิ่มไรเดอร์':'Add rider'}</div>
          <input className="kd-input" style={{ marginBottom:9 }} value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder={TH?'ชื่อไรเดอร์':'Rider name'}/>
          <div style={{ display:'flex', gap:9 }}>
            <input className="kd-input num" value={f.phone} onChange={e=>setF(p=>({...p,phone:e.target.value}))} placeholder={TH?'เบอร์โทร':'Phone'}/>
            <input className="kd-input" value={f.plate} onChange={e=>setF(p=>({...p,plate:e.target.value}))} placeholder={TH?'ทะเบียนรถ':'Plate'}/>
          </div>
          <button onClick={add} disabled={!f.name.trim()} className="kd-btn kd-btn-primary kd-btn-block" style={{ marginTop:11, opacity:f.name.trim()?1:.5 }}>{React.cloneElement(IC.plus,{size:16})} {TH?'เพิ่มไรเดอร์':'Add rider'}</button>
        </div>
      </div>
    </Sheet>
  );
}

/* ══════════════ STAFF ROSTER (ทะเบียนพนักงาน · ผู้ทำรายการ) ══════════════ */
function StaffRosterSheet({ shop, staffList, addStaff, removeStaff, updateStaff, onClose, pay, setPay, managerView }){
  const { lang } = useT();
  const TH = lang!=='en';
  const [nn,setNn] = m2State('');
  const [nph,setNph] = m2State('');
  const [npin,setNpin] = m2State('');
  const [nrole,setNrole] = m2State('staff');
  const [copied,setCopied] = m2State(false);
  const sid = (shop && shop.shopId) || (typeof window!=='undefined' && window.KD_SHOP) || '';
  const origin = (typeof location!=='undefined') ? location.origin+location.pathname.replace(/[^/]*$/,'') : '';
  const staffUrl = `${origin}?shop=${sid}&role=staff`;
  const cp=()=>{ try{ navigator.clipboard.writeText(staffUrl); }catch(e){} setCopied(true); setTimeout(()=>setCopied(false),1400); };
  const sh=()=>{ const data={ title:(shop&&shop.name)||'KaiDee POS', text:TH?'ลิงก์พนักงาน':'Staff link', url:staffUrl };
    if(typeof navigator!=='undefined' && navigator.share){ navigator.share(data).catch(()=>{}); } else { cp(); } };
  const canShare = typeof navigator!=='undefined' && !!navigator.share;
  const add=()=>{ const v=nn.trim(); if(!v||!addStaff) return; addStaff({ name:v, phone:nph.trim(), pin:npin.trim(), role:nrole }); setNn(''); setNph(''); setNpin(''); setNrole('staff'); };
  const list = staffList||[];
  return (
    <Sheet open={true} onClose={onClose} height="92%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{TH?'ทะเบียนพนักงาน':'Staff registry'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        {/* staff link to share */}
        <div className="kd-card" style={{ padding:'14px 15px', marginBottom:16, background:'linear-gradient(135deg,#22415F,#2E6FB0)', color:'#fff', boxShadow:'none' }}>
          <div style={{ fontSize:13.5, fontWeight:700, display:'flex', alignItems:'center', gap:7 }}>🧑‍🍳 {TH?'ลิงก์พนักงาน (เครื่องหน้าร้าน)':'Staff link'}</div>
          <div style={{ fontSize:12, opacity:.85, margin:'4px 0 9px', lineHeight:1.5 }}>{TH?'แชร์ให้พนักงานหน้าร้าน — เห็นแค่ ขาย/ออเดอร์ · เปิด-ปิดร้าน/รายงานถูกล็อก':'Share with counter staff — sell/orders only'}</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.16)', borderRadius:10, padding:'7px 7px 7px 11px' }}>
            <code style={{ flex:1, fontFamily:'var(--mono)', fontSize:11, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{staffUrl}</code>
            <button onClick={cp} style={{ border:'none', background:'#fff', color:'var(--ink)', borderRadius:8, padding:'6px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap' }}>{copied?(TH?'คัดลอกแล้ว':'Copied'):(TH?'คัดลอก':'Copy')}</button>
            {canShare && <button onClick={sh} style={{ border:'1px solid #fff', background:'transparent', color:'#fff', borderRadius:8, padding:'6px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap' }}>↗ {TH?'แชร์':'Share'}</button>}
          </div>
        </div>

        <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.55, background:'var(--bg)', borderRadius:10, padding:'10px 12px', marginBottom:16 }}>💡 {TH?'พนักงานที่เปิดในไลน์ตัวเอง ชื่อจะขึ้นอัตโนมัติ · ถ้าเป็นเครื่องกลางหน้าร้าน ให้เลือกชื่อจากทะเบียนนี้ก่อนขาย (ชื่อจะแสดงเป็นผู้ทำรายการในบิล/นำเงินเข้า-ออก)':'Staff on their own LINE are auto-named. On a shared counter device they pick a name from this registry.'}</div>

        {setPay && !managerView && <div className="kd-card" style={{ padding:'13px 15px', marginBottom:16, boxShadow:'none', background:'var(--brand-softer)', cursor:'pointer' }} onClick={()=>setPay(p=>({ ...p, mgrManageStaff:!(p&&p.mgrManageStaff) }))}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:700 }}>{TH?'ให้ผู้จัดการร้านเพิ่ม/แก้พนักงานได้':'Let managers manage staff'}</div>
              <div style={{ fontSize:11.5, color:'var(--ink-3)', lineHeight:1.45, marginTop:2 }}>{TH?'เปิด = ผู้จัดการเห็นแท็บ “พนักงาน” เพิ่ม/อนุมัติ/แก้บทบาทได้เหมือนเจ้าของบัญชีหลัก':'On = managers get a Staff tab to add/approve/edit roles like the owner'}</div></div>
            <Toggle on={!!(pay&&pay.mgrManageStaff)}/>
          </div>
        </div>}

        {/* staff list */}
        <div style={{ fontSize:13.5, fontWeight:700, margin:'0 2px 10px' }}>{TH?`รายชื่อพนักงาน (${list.length})`:`Staff (${list.length})`}</div>
        {list.length===0 && <div style={{ fontSize:13, color:'var(--ink-3)', background:'var(--bg)', borderRadius:12, padding:'16px', textAlign:'center', marginBottom:14 }}>{TH?'ยังไม่มีพนักงาน — เพิ่มชื่อด้านล่าง':'No staff yet — add one below'}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:16 }}>
          {list.map(s=>{ const pend=s.status==='pending'; const rl=s.role||'staff'; return (
            <div key={s.id} className="kd-card" style={{ padding:'12px 14px', boxShadow:'none', background: pend?'#FFF7EC':'var(--bg)', border: pend?'1px solid #F0D9B0':'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:999, background: rl==='manager'?'#B8860B':'#2E6FB0', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18 }}>{rl==='manager'?'👑':'🧑‍🍳'}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14.5, fontWeight:700 }}>{s.name||(TH?'(ไม่มีชื่อ)':'(no name)')}</div>
                  <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:1 }}>{s.line?(TH?'เข้าผ่าน LINE':'via LINE'):(s.pin?`PIN ${s.pin}`:(TH?'ยังไม่ตั้ง PIN':'no PIN'))}{s.phone?` · ${s.phone}`:''}</div>
                </div>
                <button onClick={()=>{ if(removeStaff && window.confirm(TH?`ลบ “${s.name}”?`:`Remove “${s.name}”?`)) removeStaff(s.id); }} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-3)', padding:4, flexShrink:0 }}>{React.cloneElement(IC.x,{size:16})}</button>
              </div>
              {pend && <div style={{ fontSize:12, color:'#B26A00', fontWeight:700, margin:'8px 0 2px' }}>⏳ {TH?'รออนุมัติ — เลือกสิทธิ์แล้วกดอนุมัติ':'Pending — pick role & approve'}</div>}
              <div style={{ display:'flex', gap:7, marginTop:9 }}>
                {[['staff',TH?'พนักงานทั่วไป':'Staff'],['manager',TH?'ผู้จัดการร้าน':'Manager']].map(([rk,rlbl])=>(
                  <button key={rk} onClick={()=>updateStaff&&updateStaff(s.id,{role:rk})} style={{ flex:1, cursor:'pointer', border:'1.5px solid '+(rl===rk?'var(--brand)':'var(--hair-2)'), background:rl===rk?'var(--brand-soft)':'#fff', color:rl===rk?'var(--brand-ink)':'var(--ink-2)', borderRadius:10, padding:'8px 6px', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5 }}>{rl===rk?'● ':'○ '}{rlbl}</button>
                ))}
                {pend && <button onClick={()=>updateStaff&&updateStaff(s.id,{status:'active'})} className="kd-btn kd-btn-primary" style={{ padding:'8px 14px', fontSize:12.5 }}>{TH?'อนุมัติ':'Approve'}</button>}
              </div>
            </div>
          );})}
        </div>

        {/* add staff */}
        <div className="kd-card" style={{ padding:'14px 15px', boxShadow:'none', background:'var(--brand-softer)' }}>
          <div style={{ fontSize:13.5, fontWeight:700, marginBottom:4 }}>{TH?'เพิ่มพนักงาน (ตั้ง PIN สำหรับเข้าผ่านเว็บ)':'Add staff (set PIN for web login)'}</div>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', lineHeight:1.5, marginBottom:10 }}>{TH?'พนักงานที่ไม่มี LINE เข้าผ่านลิงก์เว็บ → เลือกชื่อตัวเอง + ใส่ PIN นี้':'Non-LINE staff sign in on web by picking their name + this PIN.'}</div>
          <input className="kd-input" style={{ marginBottom:8 }} value={nn} onChange={e=>setNn(e.target.value)} placeholder={TH?'ชื่อ/ชื่อเล่นในร้าน':'Work name'}/>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <input className="kd-input num" style={{ flex:1.4 }} type="tel" value={nph} onChange={e=>setNph(e.target.value)} placeholder={TH?'เบอร์โทร':'Phone'}/>
            <input className="kd-input num" style={{ flex:1 }} inputMode="numeric" value={npin} onChange={e=>setNpin(e.target.value.replace(/[^0-9]/g,'').slice(0,6))} placeholder={TH?'PIN 4-6 หลัก':'PIN'}/>
          </div>
          <div style={{ display:'flex', gap:7, marginBottom:10 }}>
            {[['staff',TH?'พนักงานทั่วไป':'Staff'],['manager',TH?'ผู้จัดการร้าน':'Manager']].map(([rk,rlbl])=>(
              <button key={rk} onClick={()=>setNrole(rk)} style={{ flex:1, cursor:'pointer', border:'1.5px solid '+(nrole===rk?'var(--brand)':'var(--hair-2)'), background:nrole===rk?'var(--brand-soft)':'#fff', color:nrole===rk?'var(--brand-ink)':'var(--ink-2)', borderRadius:10, padding:'9px 6px', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5 }}>{nrole===rk?'● ':'○ '}{rlbl}</button>
            ))}
          </div>
          <button onClick={add} disabled={!nn.trim()} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:12, opacity:nn.trim()?1:.5 }}>{React.cloneElement(IC.plus,{size:16})} {TH?'เพิ่มพนักงาน':'Add staff'}</button>
        </div>
      </div>
    </Sheet>
  );
}

/* shop type + feature flags */
const SHOP_TYPES = [
  { id:'restaurant', emoji:'🍜', th:'ร้านอาหาร / ตามสั่ง', en:'Restaurant', delivery:true, mods:{ orders:true, delivery:true, reports:true, stock:true, dinein:true } },
  { id:'cafe', emoji:'☕', th:'คาเฟ่ / เครื่องดื่ม', en:'Cafe / drinks', delivery:true, mods:{ orders:true, delivery:true, reports:true, stock:true, dinein:true } },
  { id:'grocery', emoji:'🛒', th:'ของชำ / มินิมาร์ท', en:'Grocery', delivery:false, mods:{ orders:false, delivery:false, reports:true, stock:true, dinein:false } },
  { id:'retail', emoji:'👕', th:'เสื้อผ้า / รีเทล', en:'Retail / fashion', delivery:false, mods:{ orders:false, delivery:false, reports:true, stock:true, dinein:false } },
  { id:'online', emoji:'📦', th:'ขายออนไลน์ / พรีออเดอร์', en:'Online / pre-order', delivery:true, mods:{ orders:true, delivery:true, reports:true, stock:true, dinein:false } },
  { id:'service', emoji:'💇', th:'บริการ / ร้านนัด', en:'Service', delivery:false, mods:{ orders:false, delivery:false, reports:true, stock:false, dinein:false } },
  { id:'fitness', emoji:'🏋️', th:'ฟิตเนส / สตูดิโอ', en:'Fitness / studio', delivery:false, vertical:'fitness', mods:{ orders:false, delivery:false, reports:true, stock:true, dinein:false } },
];
// แพ็กเกจ/ราคาเฉพาะฟิตเนส (โชว์ในหน้าแอปเมื่อเลือกประเภทฟิตเนส)
const FIT_MEMBER_PKGS = [
  { th:'รายเดือน', price:'฿1,990', ds:'ฟิตเนส + คลาสกรุ๊ปไม่จำกัด' },
  { th:'3 เดือน', price:'฿4,990', ds:'ประหยัด 17% · ฟรีบอดี้สแกน' },
  { th:'รายปี', price:'฿14,990', ds:'คุ้มสุด · แช่แข็งได้ 30 วัน' },
  { th:'PT 10 ครั้ง', price:'฿6,900', ds:'เทรนเนอร์ส่วนตัว 10 เซสชัน' },
];
const FIT_SYS_PRICING = [
  { k:'A', th:'แพ็กคงที่', r:'฿1,990–9,990/เดือน' },
  { k:'B', th:'% ผ่านแอป', r:'2–3% ต่อธุรกรรม' },
  { k:'C', th:'ไฮบริด', r:'฿990 + 1%' },
];
function ShopTypeSheet({ shop, setShop, onClose }){
  const { lang } = useT(); const TH = lang!=='en';
  const feats = shop.features||{};
  const selType = SHOP_TYPES.find(t=>t.id===shop.shopType); const isFit = !!(selType&&selType.vertical==='fitness');
  const fitBase = (typeof location!=='undefined') ? location.pathname.replace(/[^/]*$/,'') : '';
  const isSpon = !!(selType&&selType.vertical==='sponsor') || !!feats.sponsor;
  const [hideSpon,setHideSpon] = React.useState(()=>{ try{ return localStorage.getItem('kd_hide_sponsor_v1')==='1'; }catch(e){ return false; } });
  const dismissSpon = ()=>{ try{ localStorage.setItem('kd_hide_sponsor_v1','1'); }catch(e){} setHideSpon(true); };
  const setType = (ty)=> setShop(p=>({ ...p, shopType:ty.id, typeLabel: TH?ty.th:ty.en, features:{ ...(p.features||{}), ...(ty.mods||{ delivery:ty.delivery }) } }));
  const setDelivery = (v)=> setShop(p=>({ ...p, features:{ ...(p.features||{}), delivery:v } }));
  const setFeat = (k,v)=> setShop(p=>({ ...p, features:{ ...(p.features||{}), [k]:v } }));
  return (
    <Sheet open={true} onClose={onClose} height="82%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{TH?'ประเภทร้าน · ฟีเจอร์':'Shop type · features'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        <div style={{ fontSize:13, color:'var(--ink-3)', marginBottom:12, lineHeight:1.5 }}>{TH?'เลือกประเภทร้าน — ระบบจะตั้งค่าเริ่มต้นให้เหมาะ (เช่น ร้านบริการไม่ต้องมีเดลิเวอรี)':'Pick your type — we set sensible defaults (e.g. service shops skip delivery)'}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:18 }}>
          {SHOP_TYPES.map(ty=>{ const on=shop.shopType===ty.id; return (
            <button key={ty.id} onClick={()=>setType(ty)} className="kd-card" style={{ border: on?'2px solid var(--brand)':'2px solid transparent', cursor:'pointer', display:'flex', alignItems:'center', gap:13, padding:'13px 15px', fontFamily:'var(--font)', textAlign:'left' }}>
              <span style={{ fontSize:24 }}>{ty.emoji}</span>
              <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:700 }}>{TH?ty.th:ty.en}</div>
                <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:1 }}>{ty.delivery?(TH?'มีเดลิเวอรี':'delivery on'):(TH?'รับที่ร้านอย่างเดียว':'pickup only')}</div></div>
              {on && <span style={{ color:'var(--brand)' }}>{React.cloneElement(IC.check,{size:20,stroke:2.6})}</span>}
            </button>
          );})}
        </div>
        {isFit && <div className="kd-card" style={{ padding:'14px 16px', marginBottom:16, border:'2px solid var(--brand)' }}>
          <div style={{ fontSize:14.5, fontWeight:700, display:'flex', alignItems:'center', gap:7 }}>🏋️ {TH?'โหมดฟิตเนส (Vertical)':'Fitness vertical'}</div>
          <div style={{ fontSize:12.5, color:'var(--ink-3)', margin:'6px 0 12px', lineHeight:1.55 }}>{TH?'🔒 ล็อกให้ใช้เฉพาะโมดูลฟิตเนส (สมาชิก · เช็คอินหน้าประตู · คลาส · เทรนเนอร์ PT) — เปิดโมดูลร้านอาหาร/เดลิเวอรีพร้อมกันไม่ได้ · หน้าขาย + สต๊อกคาเฟ่ยังใช้ได้':'🔒 Locked to the fitness module only (members · check-in · classes · PT) — can’t run restaurant/delivery at once · POS + café stock stay on'}</div>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-2)', margin:'0 0 7px' }}>{TH?'แพ็กเกจสมาชิก (ร้านตั้งเอง)':'Membership packages'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:12 }}>
            {FIT_MEMBER_PKGS.map((p,i)=>(<div key={i} style={{ background:'var(--bg)', borderRadius:10, padding:'8px 11px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}><b style={{ fontSize:13 }}>{p.th}</b><b style={{ fontSize:13, color:'var(--brand)' }}>{p.price}</b></div>
              <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{p.ds}</div></div>))}
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-2)', margin:'0 0 7px' }}>{TH?'ค่าระบบฟิตเนส (เลือกโมเดล)':'System pricing'}</div>
          <div style={{ display:'flex', gap:7, marginBottom:12, flexWrap:'wrap' }}>
            {FIT_SYS_PRICING.map(p=>(<div key={p.k} style={{ flex:'1 1 30%', minWidth:88, background:'var(--brand-softer)', borderRadius:10, padding:'8px 10px', textAlign:'center' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ink-3)' }}>แบบ {p.k} · {p.th}</div><div style={{ fontSize:12, fontWeight:700, color:'var(--brand-ink)', marginTop:2 }}>{p.r}</div></div>))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>window.open(fitBase+'Fitness POS.html','_blank')} className="kd-card" style={{ flex:1, border:'none', background:'var(--brand)', color:'#fff', fontWeight:700, fontSize:13.5, padding:'11px', cursor:'pointer', fontFamily:'var(--font)' }}>{TH?'เปิดโมดูลฟิตเนส (POS ในแอป) →':'Open Fitness POS →'}</button>
            <button onClick={()=>window.open(fitBase+'Fitness Backoffice.html','_blank')} className="kd-card" style={{ flex:'0 0 auto', border:'1px solid var(--brand)', background:'#fff', color:'var(--brand-ink)', fontWeight:700, fontSize:13.5, padding:'11px 13px', cursor:'pointer', fontFamily:'var(--font)' }}>{TH?'จอคอม':'Desktop'}</button>
          </div>
          <button onClick={()=>window.open(fitBase+'Fitness NFC Card.html?name='+encodeURIComponent(shop.name||''),'_blank')} className="kd-card" style={{ width:'100%', marginTop:8, border:'1px dashed var(--hair-2)', background:'var(--bg)', color:'var(--ink-2)', fontWeight:600, fontSize:12.5, padding:'9px', cursor:'pointer', fontFamily:'var(--font)' }}>{TH?'🪧 ทำป้าย NFC เช็คอิน (ปริ้นท์/ดาวน์โหลด)':'🪧 NFC check-in card'}</button>
        </div>}
        {!isFit && !isSpon && !hideSpon && <div className="kd-card" style={{ padding:'14px 16px', marginBottom:16, border:'1.5px dashed var(--brand)', background:'var(--brand-softer)' }}>
          <div style={{ fontSize:14.5, fontWeight:700, display:'flex', alignItems:'center', gap:7 }}>📣 {TH?'อยากให้ร้านโต? เปิดเป็นสปอนเซอร์':'Grow with Sponsor'}</div>
          <div style={{ fontSize:12.5, color:'var(--ink-2)', margin:'6px 0 12px', lineHeight:1.55 }}>{TH?'เปิด“หน้าร้านออนไลน์ + ลงโฆษณา” ให้คนทั้งระบบเห็นร้านคุณ — ซื้อแพ็กในแอป ปลดล็อกศูนย์จัดการตามแพ็ก (เสริมจาก POS เดิม ไม่กระทบหน้าขาย)':'Open your own online storefront + ads across the whole platform. Add-on on top of POS.'}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>window.open(fitBase+'Sponsor Packages.html','_blank')} className="kd-card" style={{ flex:1, border:'none', background:'var(--brand)', color:'#fff', fontWeight:700, fontSize:13.5, padding:'11px', cursor:'pointer', fontFamily:'var(--font)' }}>{TH?'ดูแพ็ก · เป็นสปอนเซอร์ →':'See packages →'}</button>
            <button onClick={()=>window.open(fitBase+'Sponsor Console.html','_blank')} className="kd-card" style={{ flex:'0 0 auto', border:'1px solid var(--brand)', background:'#fff', color:'var(--brand-ink)', fontWeight:700, fontSize:13.5, padding:'11px 13px', cursor:'pointer', fontFamily:'var(--font)' }}>{TH?'ศูนย์จัดการ':'Console'}</button>
          </div>
          <button onClick={dismissSpon} style={{ width:'100%', marginTop:9, border:'none', background:'none', color:'var(--ink-3)', fontWeight:600, fontSize:12.5, padding:'4px', cursor:'pointer', fontFamily:'var(--font)', textDecoration:'underline' }}>{TH?'ข้าม · ไม่สนใจ':'Skip'}</button>
        </div>}
        <div style={{ fontSize:13.5, fontWeight:700, margin:'0 2px 9px' }}>{TH?'โมดูลที่เปิดใช้':'Modules'}</div>
        <div style={{ fontSize:12, color:'var(--ink-3)', margin:'0 2px 9px', lineHeight:1.5 }}>{TH?'ปิดโมดูลที่ไม่ใช้ → แท็บนั้นจะหายไปจากแอป (เช่น ร้านบันทึกการขายอย่างเดียว ปิด “รับออเดอร์ลูกค้า”)':'Turn off modules you don’t use → the tab disappears (e.g. a sales-only shop turns off “Customer orders”)'}</div>
        <div className="kd-card" style={{ padding:'2px 15px', boxShadow:'none', background:'var(--bg)' }}>
          {[
            {k:'orders',  emoji:'🧾', th:'รับออเดอร์ลูกค้า (LINE OA / เดลิเวอรี)', en:'Customer orders (LINE OA / delivery)', ds:TH?'แท็บ “ออเดอร์” + หน้าสั่งของลูกค้า':'Orders tab + customer ordering'},
            {k:'delivery',emoji:'🛵', th:'รับส่งเดลิเวอรี', en:'Accept delivery', ds:TH?'ลูกค้าเลือก “ส่ง” ได้ (ปิด=รับที่ร้าน)':'Customers can pick delivery', dep:'orders'},
            {k:'reports', emoji:'📊', th:'รายงาน / สรุปยอด', en:'Reports', ds:TH?'แท็บ “สรุป” · ยอดขาย/กำไร/ตรวจรับเงิน':'Reports tab'},
            {k:'stock',   emoji:'📦', th:'สต๊อกวัตถุดิบ', en:'Ingredient stock', ds:TH?'แท็บ “สต๊อก” · ตัดสต๊อกตามสูตร':'Stock tab'},
          ].map((m,idx,arr)=>{ const pkgLock=(typeof window!=='undefined'&&window.KD_MODULES&&window.KD_MODULES[m.k]===false); const fitLock=(isFit&&(m.k==='orders'||m.k==='delivery')); const on=feats[m.k]!==false && !pkgLock && !fitLock; const disabled=(m.dep&&feats[m.dep]===false)||pkgLock||fitLock; return (
            <div key={m.k} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom: idx<arr.length-1?'1px solid var(--hair)':'none', opacity:disabled?.45:1, paddingLeft:m.dep?14:0 }}>
              <span style={{ fontSize:19 }}>{m.emoji}</span>
              <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:14.5, fontWeight:600 }}>{TH?m.th:m.en}</div>
                <div style={{ fontSize:12, color:'var(--ink-3)' }}>{fitLock?(TH?'🔒 ปิดในโหมดฟิตเนส':'🔒 Off in fitness mode'):pkgLock?(TH?'🔒 ไม่รวมในแพ็กเกจนี้':'🔒 Not in your package'):m.ds}</div></div>
              <button disabled={disabled} onClick={()=>setFeat(m.k, feats[m.k]===false)} style={{ border:'none', background:'none', cursor:disabled?'default':'pointer', padding:0 }}><Toggle on={on&&!disabled}/></button>
            </div>
          );})}
        </div>
        {/* การ์ดดีลสปอนเซอร์ในหน้า "สั่งสำเร็จ" ของลูกค้า — ค่าเริ่มต้น = ปิด */}
        <div style={{ fontSize:13.5, fontWeight:700, margin:'18px 2px 9px' }}>{TH?'ดีลสปอนเซอร์ในหน้าลูกค้า':'Sponsor deals for customers'}</div>
        <div className="kd-card" style={{ padding:'13px 15px', boxShadow:'none', background:'var(--bg)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:19 }}>🎁</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14.5, fontWeight:600 }}>{TH?'โชว์ดีลร้านสปอนเซอร์ (แลกส่วนลดค่าบริการ)':'Show sponsor deals (earn a service-fee discount)'}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2, lineHeight:1.45 }}>{TH?'โชว์ 1–2 การ์ดที่หน้า “สั่งสำเร็จ” เท่านั้น ไม่แทรกกลางเมนู':'1–2 cards on the order-success screen only — never inside the menu'}</div>
            </div>
            <button onClick={()=>setFeat('sponsorDeals', feats.sponsorDeals!==true)} style={{ border:'none', background:'none', cursor:'pointer', padding:0 }}><Toggle on={feats.sponsorDeals===true}/></button>
          </div>
          {feats.sponsorDeals===true && <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:10, paddingTop:10, borderTop:'1px solid var(--hair)', lineHeight:1.5 }}>
            {TH?'ระบบซ่อนดีลหมวดที่ชนกับร้านคุณให้อัตโนมัติ':'Deals in your own category are hidden automatically'}
            {(()=>{ const cs=(typeof window!=='undefined'&&window.kdSponsorCatsOfShop)?window.kdSponsorCatsOfShop(shop):[]; return cs.length?(' · '+(TH?'หมวดที่กันไว้: ':'excluded: ')+cs.join(', ')):''; })()}
          </div>}
        </div>
        <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:12, lineHeight:1.5, background:'var(--brand-softer)', borderRadius:10, padding:'10px 13px' }}>{TH?'💡 หน้าขาย · เปิด/ปิดร้าน · ร้านค้า เปิดใช้เสมอทุกร้าน':'💡 Sell · Open/Close · Store are always on'}</div>
      </div>
    </Sheet>
  );
}

/* subscription / app renewal */
const PLANS = [
  { id:'trial',   days:30,  price:0,    th:'ทดลองใช้ฟรี', en:'Free trial',  note:{th:'30 วันแรก ใช้ครบทุกฟีเจอร์',en:'30 days, all features'} },
  { id:'monthly', days:30,  price:199,  th:'ร้านค้า · รายเดือน', en:'Shop · Monthly', note:{th:'฿199 / เดือน · 1 เครื่อง',en:'฿199 / mo · 1 device'} },
  { id:'plus',    days:30,  price:299,  th:'ร้านค้า พลัส · รายเดือน', en:'Shop Plus · Monthly', note:{th:'฿299 / เดือน · 3 เครื่อง',en:'฿299 / mo · 3 devices'} },
  { id:'yearly',  days:365, price:1990, th:'ร้านค้า · รายปี', en:'Shop · Yearly', note:{th:'฿1,990 / ปี · ประหยัด 2 เดือน',en:'฿1,990 / yr · save 2 mo'}, best:true },
];
// ราคาแพ็กแก้ได้จาก Back Office (ตั้งค่า → แพ็กเกจ) เก็บบน backend · แอปร้านดึงมาสร้างตัวเลือก
let KD_PKG_CACHE=null;
async function kdLoadPackages(){ try{ if(window.KD_API&&window.KD_API.getPackages){ const b=await window.KD_API.getPackages(); if(b&&(b.packages||b.shop)){ KD_PKG_CACHE=b; return b; } } }catch(e){} return null; }
function _kdPkgList(b){
  if(b&&Array.isArray(b.packages)&&b.packages.length) return b.packages;
  if(b&&b.shop) return [ {id:'shop',name:b.shop.name||'ร้านค้า',seats:b.shop.seats||1,monthly:b.shop.price||199,yearly:b.shop.yearly||1990},
                         {id:'pro', name:b.pro?.name||'ร้านค้า พลัส',seats:b.pro?.seats||3,monthly:b.pro?.price||299,yearly:b.pro?.yearly||2990} ];
  return null;
}
function kdPlans(){ const list=_kdPkgList(KD_PKG_CACHE); const n=v=>Number(v)||0;
  if(list&&list.length){ const out=[PLANS[0]];
    list.forEach((pk,i)=>{ const nm=pk.name||('แพ็ก '+(i+1)), seats=n(pk.seats)||1;
      if(n(pk.monthly)>0) out.push({ id:(pk.id||'p'+i)+'_m', days:30, price:n(pk.monthly), th:nm+' · รายเดือน', en:nm+' · Monthly', note:{th:`฿${n(pk.monthly).toLocaleString()} / เดือน · ${seats} เครื่อง`,en:`฿${n(pk.monthly)} / mo · ${seats} device(s)`} });
      if(n(pk.yearly)>0)  out.push({ id:(pk.id||'p'+i)+'_y', days:365, price:n(pk.yearly), th:nm+' · รายปี', en:nm+' · Yearly', note:{th:`฿${n(pk.yearly).toLocaleString()} / ปี · ประหยัด`,en:`฿${n(pk.yearly).toLocaleString()} / yr · save`}, best:i===0 });
    });
    return out;
  }
  return PLANS.map(p=>({...p}));
}
function FabToggleCard({ lang }){
  const TH=lang!=='en';
  const [on,setOn]=m2State(()=>{ try{ return localStorage.getItem('kd_fab_on')!=='0'; }catch(e){ return true; } });
  const toggle=()=>{ const nv=!on; setOn(nv); try{ localStorage.setItem('kd_fab_on', nv?'1':'0'); }catch(e){} try{ window.dispatchEvent(new Event('kd-fab')); }catch(e){} };
  return (<div className="kd-card" style={{ border:'none', display:'flex', alignItems:'center', gap:13, padding:'14px 16px' }}>
    <span style={{ width:38, height:38, borderRadius:11, background:'#F0ECFF', color:'#6A54C8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19 }}>🔘</span>
    <div style={{ flex:1 }}>
      <div style={{ fontSize:14.5, fontWeight:700 }}>{TH?'ปุ่มลัดลอย (เมนูด่วน)':'Floating shortcut'}</div>
      <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2, lineHeight:1.4 }}>{TH?'ปุ่มกลมลากได้ · แตะเปิดเมนูลัด/คู่มือ · ปิดได้ถ้าไม่ชอบ':'Draggable quick menu · turn off if you prefer'}</div>
    </div>
    <button onClick={toggle} aria-label="toggle" style={{ border:'none', background:'none', cursor:'pointer', padding:0, flexShrink:0 }}><Toggle on={on}/></button>
  </div>);
}
function kdDeviceAddon(){ try{ const b=(typeof KD_PKG_CACHE!=='undefined'&&KD_PKG_CACHE)||JSON.parse(localStorage.getItem('kaidee_pkg_v1')||'{}'); const list=_kdPkgList(b)||[]; const maxSeats=Math.max(3,...list.map(p=>Number(p.seats)||1)); return { monthly:Number(b.deviceAddon)||0, maxSeats, freeDays:b.addonFreeDays==null?30:Number(b.addonFreeDays) }; }catch(e){ return { monthly:0, maxSeats:3, freeDays:30 }; } }
/* ══ กระเป๋าเงินร้าน — ใช้ตัวกลาง window.KDW (ยอด+ประวัติอยู่ที่ backend) ══
   เดิมป๊อตกระเป๋าแยกคีย์ kd_shop_wallet_v1 → ย้ายยอดเก่าเข้า KDW ครั้งเดียว (FX-022) */
const KD_SHOP_WALLET_KEY='kd_shop_wallet_v1';
function kdWalletBiz(){ const id=(typeof window!=='undefined'&&window.KD_SHOP)||'shop1';
  return window.KDW?window.KDW.biz('pos',id):('pos:'+id); }
let _kdWalMigrated=false;
async function kdWalletMigrate(){
  if(_kdWalMigrated||!window.KDW) return; _kdWalMigrated=true;
  try{ const old=JSON.parse(localStorage.getItem(KD_SHOP_WALLET_KEY)||'{}');
    const bal=Number(old.balance)||0;
    if(bal>0&&!old.migratedAt){
      const r=await window.KDW.adjust(kdWalletBiz(),bal,'ย้ายยอดกระเป๋าเก่าเข้ากระเป๋ากลาง (ระบบทำให้อัตโนมัติ)','migration');
      if(r&&!r.__err){ old.migratedAt=Date.now(); old.balance=0; localStorage.setItem(KD_SHOP_WALLET_KEY,JSON.stringify(old)); }
    }
  }catch(e){}
}
const KD_TOPUP_QUICK=[500,1000,2000,5000];
function SubscriptionSheet({ sub, setSub, onClose }){
  const { t, lang } = useT();
  const TH = lang==='th';
  const da = kdDeviceAddon(); const extra = Number(sub.extraSeats)||0;
  const [pick,setPick] = m2State(null);
  const [method,setMethod] = m2State('wallet');  // wallet | promptpay | card(auto · ยังไม่เปิด)
  const [okMsg,setOkMsg] = m2State(null);
  const [wal,setWal] = m2State(()=>window.KDW?window.KDW.get(kdWalletBiz()):{balance:0,ledger:[],pendingAmount:0});
  const [topAmt,setTopAmt] = m2State(1000);
  const [topSlip,setTopSlip] = m2State(null);
  const [busy,setBusy] = m2State(false);
  const [topMsg,setTopMsg] = m2State('');
  const [walLog,setWalLog] = m2State(false);
  const [plans,setPlans] = m2State(kdPlans());
  /* บัญชีรับเงินของระบบ (ตั้งที่ Back Office) — ใช้ออก QR พร้อมเพย์ + ปุ่มคัดลอกเลขบัญชี */
  const [sysAcct,setSysAcct] = m2State(()=>(window.KDW&&window.KDW.acctCached)?window.KDW.acctCached():null);
  const [copied,setCopied] = m2State('');
  React.useEffect(()=>{ if(window.KDW&&window.KDW.account) window.KDW.account().then(a=>a&&setSysAcct(a)).catch(()=>{}); },[]);
  // ยอดที่ต้องโอน = ยอดเต็ม + เศษสตางค์อ้างอิง (ล็อกไว้ต่อจำนวนเงิน ไม่สุ่มใหม่ทุก render)
  const payAmt = React.useMemo(()=>{ const a=Math.max(0,Math.round(Number(topAmt)||0));
    return (a>0&&window.KDW&&window.KDW.payAmount)?window.KDW.payAmount(a):a; },[topAmt]);
  // แถวตัวเลข (เบอร์/เลขบัญชี/ยอด) คัดลอกเฉพาะตัวเลข · ชื่อบัญชีคัดลอกทั้งข้อความ
  const copyVal = (k,v)=>{ const s=String(v); const out=/^[\d\s.\-]+$/.test(s)?s.replace(/[^\d.]/g,''):s;
    try{ navigator.clipboard.writeText(out); setCopied(k); setTimeout(()=>setCopied(''),1600); }catch(e){} };
  const AcctRows = ({ amount })=>{ const pa=sysAcct||{};
    if(!pa.promptpay && !pa.acctNo) return <div style={{ marginTop:12, background:'#FDEDEA', borderRadius:12, padding:'10px 12px', fontSize:12, color:'var(--accent)', lineHeight:1.55, textAlign:'left' }}>{TH?'ยังไม่ได้ตั้งบัญชีรับเงินของระบบ — ตั้งที่ Back Office → กระเป๋าเงิน → บัญชีรับเงินของระบบ':'System receiving account not set yet'}</div>;
    const rows=[[pa.promptpay?(TH?'พร้อมเพย์':'PromptPay'):'',pa.promptpay],[pa.acctNo?(pa.bank||(TH?'เลขบัญชี':'Account')):'',pa.acctNo],[pa.acctName?(TH?'ชื่อบัญชี':'Name'):'',pa.acctName],[amount>0?(TH?'ยอดที่ต้องโอน':'Amount'):'',amount>0?money(amount):'']].filter(x=>x[0]&&x[1]);
    if(!rows.length) return null;
    return (<div style={{ marginTop:12, background:'#fff', borderRadius:13, padding:'12px 14px', textAlign:'left' }}>
      <div style={{ fontSize:12.5, fontWeight:700, color:'var(--ink-2)', marginBottom:6 }}>{TH?'โอนเข้าบัญชีระบบ':'Transfer to'}</div>
      {rows.map(([k,v])=>(<div key={k} style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'space-between', padding:'6px 0' }}>
        <span style={{ fontSize:12, color:'var(--ink-3)' }}>{k}</span>
        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
          <b className="num" style={{ fontSize:13.5 }}>{v}</b>
          <button onClick={()=>copyVal(k,v)} style={{ border:'1.2px solid var(--hair-2)', background:'#fff', borderRadius:8, padding:'4px 9px', fontSize:11, fontWeight:700, color:'var(--brand-ink)', cursor:'pointer', fontFamily:'var(--font)' }}>{copied===k?(TH?'คัดลอกแล้ว':'Copied'):(TH?'คัดลอก':'Copy')}</button>
        </span></div>))}
    </div>); };
  React.useEffect(()=>{ kdLoadPackages().then(b=>{ if(b) setPlans(kdPlans()); }); },[]);
  const wBiz = kdWalletBiz();
  const pullWal = ()=>{ if(window.KDW) window.KDW.pull(wBiz).then(setWal); };
  React.useEffect(()=>{ kdWalletMigrate().then(pullWal); const h=()=>{ if(window.KDW) setWal(window.KDW.get(wBiz)); };
    window.addEventListener('kdw-change',h); return ()=>window.removeEventListener('kdw-change',h); },[]);
  const daysLeft = Math.max(0, Math.ceil((new Date(sub.expiry)-new Date())/86400000));
  const paid = plans.filter(p=>p.id!=='trial');
  const curPick = (pick && paid.some(p=>p.id===pick)) ? pick : (paid.find(p=>p.best)||paid[0]||{}).id;
  const plan = plans.find(p=>p.id===curPick) || plans[0];
  // ตัดบัตรอัตโนมัติ — โชว์เฉพาะเมื่อ Back Office เปิด (autoDebit) เพราะต้องต่อ API Gateway
  const cardOn = (()=>{ try{ if(typeof KD_PKG_CACHE!=='undefined' && KD_PKG_CACHE && KD_PKG_CACHE.autoDebit!=null) return !!KD_PKG_CACHE.autoDebit; const pc=JSON.parse(localStorage.getItem('kaidee_pkg_v1')||'{}'); return !!pc.autoDebit; }catch(e){ return false; } })();
  React.useEffect(()=>{ if(!cardOn && method==='card') setMethod('promptpay'); },[cardOn]);

  const short = Math.max(0, (plan.price||0) - wal.balance);
  const pickTopSlip = (e)=>{ const f=e.target.files&&e.target.files[0]; if(!f) return;
    kdSlipResize(f).then(d=>setTopSlip(d)).catch(()=>{}); };
  // เติมเงิน = ยื่นคำขอ · ยอดขึ้นเมื่อระบบตรวจสลิปกับธนาคารผ่าน/ยอดเข้าบัญชี/แอดมินยืนยัน (กันเติมเงินฟรี)
  const topup = async ()=>{ const a=Math.max(0,Math.round(Number(topAmt)||0)); if(a<=0) return;
    if(!window.KDW){ setTopMsg(TH?'กระเป๋าเงินยังไม่พร้อม · โหลดหน้าใหม่':'Wallet not ready'); return; }
    setBusy(true);
    const res=await window.KDW.topupRequest(wBiz,payAmt||a,{slip:topSlip,who:sub.shopName||'ร้าน',method:'promptpay'});
    setBusy(false);
    if(!res.ok){ setTopMsg(res.error||(TH?'ส่งคำขอไม่สำเร็จ':'Failed')); return; }
    setTopSlip(null); pullWal();
    setTopMsg(res.status==='done'
      ? (TH?`ตรวจยอดกับธนาคารผ่าน · เงินเข้ากระเป๋า ${money(a)}`:`Verified · ${money(a)} credited`)
      : (TH?`ส่งคำขอเติมเงิน ${money(a)} แล้ว · รอตรวจยอด เข้ากระเป๋าอัตโนมัติ${res.ref?' (อ้างอิง '+res.ref+')':''}`:`Top-up request sent`)); };
  const renew = async ()=>{
    if(method==='wallet'){
      if(!window.KDW){ setTopMsg(TH?'กระเป๋าเงินยังไม่พร้อม':'Wallet not ready'); return; }
      setBusy(true);
      const res=await window.KDW.charge(wBiz,plan.price,{ who:sub.shopName||'ร้าน',
        sub:(TH?'ค่าบริการระบบ · ':'Subscription · ')+((plan[lang]||plan.th)||''), type:'renew',
        idem:'posrenew:'+curPick+':'+new Date(sub.expiry).toISOString().slice(0,10) });
      setBusy(false); pullWal();
      if(!res.ok){ setTopMsg(res.short>0?(TH?`ยอดกระเป๋าไม่พอ — ขาดอีก ${money(res.short)} กรุณาเติมเงินก่อน`:`Not enough balance — short ${money(res.short)}`):(res.error||'')); return; }
    }
    const base = new Date(sub.expiry) > new Date() ? new Date(sub.expiry) : new Date();
    base.setDate(base.getDate() + plan.days);
    // แจ้ง admin ให้รู้: ทุกการต่ออายุผ่านพร้อมเพย์ → สร้างคำขอเข้า Back Office
    if(method==='promptpay'){ try{ kdSubmitPayRequest({ shopId:(typeof window!=='undefined'&&window.KD_SHOP)||'', shopName:sub.shopName||'', plan:curPick, months:Math.max(1,Math.round(plan.days/30)), amount:plan.price, slip:null, note:TH?'ต่ออายุในแอป':'In-app renewal' }); }catch(e){} }
    setSub({ ...sub, plan: curPick, expiry: base.toISOString(), auto: method==='card', card: method==='card'?'•••• 4242':sub.card });
    setOkMsg(TH?`ต่ออายุแล้ว +${plan.days} วัน`:`Renewed +${plan.days} days`);
  };

  if(okMsg) return (
    <Sheet open={true} onClose={onClose} height="60%">
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:26, gap:12, textAlign:'center' }}>
        <div className="kd-pop" style={{ width:80, height:80, borderRadius:999, background:'var(--brand-soft)', display:'flex', alignItems:'center', justifyContent:'center' }}>{React.cloneElement(IC.check,{size:42, color:'var(--brand)', stroke:2.6})}</div>
        <div style={{ fontSize:20, fontWeight:700 }}>{okMsg}</div>
        <div style={{ color:'var(--ink-2)', fontSize:14 }}>{TH?'โปรแกรมใช้งานได้ถึง':'Active until'} {new Date(sub.expiry).toLocaleDateString(TH?'th-TH':'en-US',{day:'numeric',month:'short',year:'numeric'})}</div>
        {method==='card' && <div className="kd-chip" style={{ background:'#EAF0FA', color:'var(--blue)' }}>{React.cloneElement(IC.check,{size:12})} {TH?'ตัดเงินอัตโนมัติเปิดอยู่':'Auto-renew on'}</div>}
      </div>
      <div style={{ padding:'0 20px' }}><button onClick={onClose} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15 }}>{TH?'เสร็จสิ้น':'Done'}</button></div>
    </Sheet>
  );

  return (
    <Sheet open={true} onClose={onClose} height="94%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{TH?'แพ็กเกจการใช้งาน':'Subscription'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        {/* current status */}
        <div className="kd-card" style={{ padding:'15px 16px', marginBottom:16, background:'linear-gradient(135deg,#13304E,#26619C)', color:'#fff' }}>
          <div style={{ fontSize:13, opacity:.85, fontWeight:600 }}>{TH?'สถานะปัจจุบัน':'Current plan'}</div>
          <div style={{ fontSize:20, fontWeight:700, marginTop:2 }}>{plans.find(p=>p.id===sub.plan)?.[lang] || sub.plan}</div>
          <div style={{ fontSize:13, marginTop:4 }}>{TH?`เหลือ ${daysLeft} วัน · หมดอายุ `:`${daysLeft} days left · expires `}{new Date(sub.expiry).toLocaleDateString(TH?'th-TH':'en-US',{day:'numeric',month:'short'})}</div>
          {sub.auto && <div style={{ marginTop:8, fontSize:12, fontWeight:700, background:'rgba(255,255,255,.2)', display:'inline-block', padding:'3px 10px', borderRadius:999 }}>{TH?'ต่ออายุอัตโนมัติ':'Auto-renew'} · {sub.card}</div>}
        </div>

        {/* plans */}
        <div style={{ fontSize:13.5, fontWeight:700, margin:'0 2px 10px' }}>{TH?'เลือกแพ็กเกจ':'Choose a plan'}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
          {paid.map(p=>{ const on=curPick===p.id; return (
            <button key={p.id} onClick={()=>setPick(p.id)} className="kd-card" style={{ border: on?'2px solid var(--brand)':'2px solid transparent',
              cursor:'pointer', display:'flex', alignItems:'center', gap:13, padding:'15px 16px', fontFamily:'var(--font)', textAlign:'left', position:'relative' }}>
              <span style={{ width:22, height:22, borderRadius:999, border: on?'6px solid var(--brand)':'2px solid var(--hair-2)', flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15.5, fontWeight:700 }}>{p[lang]||p.th}{p.best && <span style={{ fontSize:11, color:'#fff', background:'var(--accent)', padding:'2px 8px', borderRadius:999, marginLeft:8 }}>{TH?'คุ้มสุด':'Best'}</span>}</div>
                <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:2 }}>{p.note[lang]||p.note.th}</div>
              </div>
              <div className="num" style={{ fontWeight:700, fontSize:17 }}>{money(p.price)}</div>
            </button>
          );})}
        </div>

        {da.monthly>0 && <div className="kd-card" style={{ padding:'14px 16px', marginBottom:16, boxShadow:'none', background:'var(--bg)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20 }}>🖥️</span>
            <div style={{ flex:1 }}><div style={{ fontSize:14.5, fontWeight:700 }}>{TH?`เครื่องเพิ่ม (แพ็กสูงสุด ${da.maxSeats} เครื่อง)`:`Extra devices (max ${da.maxSeats})`}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{TH?`เกิน ${da.maxSeats} เครื่อง = +${money(da.monthly)}/เครื่อง/เดือน`:`beyond ${da.maxSeats} = +${money(da.monthly)}/device/mo`}</div></div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginTop:12 }}>
            <button onClick={()=>setSub({...sub,extraSeats:Math.max(0,extra-1)})} style={{ width:38, height:38, borderRadius:11, border:'1.5px solid var(--hair-2)', background:'#fff', fontSize:20, cursor:'pointer', flexShrink:0 }}>−</button>
            <div style={{ textAlign:'center', minWidth:58 }}><div className="num" style={{ fontSize:20, fontWeight:800 }}>{da.maxSeats+extra}</div><div style={{ fontSize:11, color:'var(--ink-3)' }}>{TH?'เครื่องรวม':'total'}</div></div>
            <button onClick={()=>setSub({...sub,extraSeats:extra+1})} style={{ width:38, height:38, borderRadius:11, border:'1.5px solid var(--brand)', background:'var(--brand-soft)', color:'var(--brand-ink)', fontSize:20, cursor:'pointer', flexShrink:0 }}>+</button>
            <div style={{ flex:1, textAlign:'right' }}>{extra>0 ? <span className="num" style={{ fontSize:15, fontWeight:800, color:'var(--brand-ink)' }}>+{money(extra*da.monthly)}<span style={{ fontSize:11, color:'var(--ink-3)', fontWeight:600 }}>/{TH?'ด.':'mo'}</span></span> : <span style={{ fontSize:12.5, color:'var(--ink-3)' }}>{TH?`+${extra} เครื่อง`:''}</span>}</div>
          </div>
          {extra>0 && sub.comp && <div style={{ marginTop:10, fontSize:12, color:'#8A6100', background:'#FFF7E6', borderRadius:10, padding:'9px 12px', lineHeight:1.5 }}>♾️ {TH?`บัญชีฟรีตลอดชีพ: เครื่องเพิ่มฟรี ${da.freeDays} วันแรก · จากนั้นเก็บ ${money(extra*da.monthly)}/เดือน`:`Lifetime-free: extra devices free ${da.freeDays} days, then ${money(extra*da.monthly)}/mo`}</div>}
        </div>}
        <div style={{ fontSize:11.5, color:'var(--ink-3)', lineHeight:1.65, background:'var(--bg)', borderRadius:12, padding:'11px 13px', marginBottom:16 }}>
          <div style={{ fontWeight:700, color:'var(--ink-2)', marginBottom:4 }}>{TH?'เงื่อนไข':'Terms'}</div>
          {TH?<>• แพ็กมาตรฐานใช้ได้สูงสุด {da.maxSeats} เครื่อง · เกินนั้นคิดเครื่องละ {da.monthly>0?money(da.monthly):'—'}/เดือน<br/>• ฟรีตลอดชีพ (UAT) = เฉพาะค่าระบบหลัก <b>ไม่รวม add-on เครื่องเพิ่ม</b> · เครื่องเพิ่มฟรี {da.freeDays} วันแรก จากนั้นเริ่มเก็บเงิน<br/>• add-on อื่น (ขายฝาก ฯลฯ) คิดแยกตามรอบ</>:<>• Up to {da.maxSeats} devices · extra {da.monthly>0?money(da.monthly):'—'}/mo each<br/>• Lifetime-free covers base only, not device add-ons (free {da.freeDays} days then charged)</>}
        </div>

        {/* payment method */}
        <div style={{ fontSize:13.5, fontWeight:700, margin:'0 2px 10px' }}>{TH?'วิธีชำระ / ต่ออายุ':'Payment method'}</div>
        <button onClick={()=>setMethod('wallet')} className="kd-card" style={{ border: method==='wallet'?'2px solid var(--brand)':'2px solid transparent', cursor:'pointer', width:'100%', display:'flex', alignItems:'center', gap:13, padding:'14px 15px', fontFamily:'var(--font)', textAlign:'left', marginBottom:10 }}>
          <span style={{ color: method==='wallet'?'var(--brand)':'var(--ink-3)' }}>{React.cloneElement(IC.wallet,{size:22})}</span>
          <div style={{ flex:1 }}><div style={{ fontSize:14.5, fontWeight:600 }}>{TH?'กระเป๋าเงินร้าน (Wallet)':'Shop wallet'}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)' }}>{TH?'เติมเงินไว้ แล้วหักค่าบริการจากกระเป๋า':'Top up, then pay from balance'}</div></div>
          <div className="num" style={{ fontSize:14.5, fontWeight:800, color:'var(--brand-ink)', flexShrink:0 }}>{money(wal.balance)}</div>
        </button>
        <button onClick={()=>setMethod('promptpay')} className="kd-card" style={{ border: method==='promptpay'?'2px solid var(--brand)':'2px solid transparent', cursor:'pointer', width:'100%', display:'flex', alignItems:'center', gap:13, padding:'14px 15px', fontFamily:'var(--font)', textAlign:'left', marginBottom:10 }}>
          <span style={{ color: method==='promptpay'?'var(--brand)':'var(--ink-3)' }}>{React.cloneElement(IC.qr,{size:22})}</span>
          <div style={{ flex:1 }}><div style={{ fontSize:14.5, fontWeight:600 }}>{TH?'เติมเอง · โอน / พร้อมเพย์':'Manual · transfer / QR'}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)' }}>{TH?'สแกนจ่ายแล้วต่ออายุทันที':'Scan to pay & renew instantly'}</div></div>
        </button>
        {cardOn ? <button onClick={()=>setMethod('card')} className="kd-card" style={{ border: method==='card'?'2px solid var(--brand)':'2px solid transparent', cursor:'pointer', width:'100%', display:'flex', alignItems:'center', gap:13, padding:'14px 15px', fontFamily:'var(--font)', textAlign:'left', marginBottom:16 }}>
          <span style={{ color: method==='card'?'var(--brand)':'var(--ink-3)' }}>{React.cloneElement(IC.wallet,{size:22})}</span>
          <div style={{ flex:1 }}><div style={{ fontSize:14.5, fontWeight:600 }}>{TH?'ตัดบัตรอัตโนมัติ (ออนไลน์)':'Auto-debit card (online)'}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)' }}>{TH?'ผูกบัตร ต่ออายุเองทุกงวด ไม่ต้องกดซ้ำ':'Card on file, renews automatically'}</div></div>
        </button>
        : <div className="kd-card" style={{ border:'2px solid transparent', width:'100%', display:'flex', alignItems:'center', gap:13, padding:'14px 15px', textAlign:'left', marginBottom:16, opacity:.55, boxShadow:'none', background:'var(--bg)' }}>
          <span style={{ color:'var(--ink-3)' }}>{React.cloneElement(IC.wallet,{size:22})}</span>
          <div style={{ flex:1 }}><div style={{ fontSize:14.5, fontWeight:600 }}>{TH?'บัตรเครดิต / เดบิต (ตัดอัตโนมัติ)':'Credit / debit card (auto-debit)'}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)' }}>{TH?'รองรับแล้ว · ยังไม่เปิดใช้':'Supported · not enabled yet'}</div></div>
          <span className="kd-chip" style={{ background:'var(--hair)', color:'var(--ink-3)', flexShrink:0 }}>{TH?'เร็ว ๆ นี้':'Soon'}</span>
        </div>}

        {method==='wallet' && <div className="kd-card" style={{ padding:16, marginBottom:8, background:'var(--brand-softer)', boxShadow:'none' }}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:10 }}>
            <div><div style={{ fontSize:12, color:'var(--ink-3)', fontWeight:600 }}>{TH?'ยอดคงเหลือในกระเป๋า':'Wallet balance'}</div>
              <div className="num" style={{ fontSize:26, fontWeight:800, color: short>0?'var(--ink)':'var(--brand-ink)' }}>{money(wal.balance)}</div>
              {wal.pendingAmount>0?<div style={{ fontSize:11.5, fontWeight:700, color:'#8A6D0B', marginTop:2 }}>{TH?`รอตรวจยอด ${money(wal.pendingAmount)}`:`Pending ${money(wal.pendingAmount)}`}</div>:null}</div>
            <div style={{ textAlign:'right', fontSize:12.5, color: short>0?'var(--accent)':'var(--brand-ink)', fontWeight:700 }}>{short>0?(TH?`ขาดอีก ${money(short)}`:`Short ${money(short)}`):(TH?'พอสำหรับรอบนี้':'Enough for this cycle')}</div>
          </div>
          <div style={{ height:1, background:'var(--hair)', margin:'13px 0' }}/>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>{TH?'เติมเงินเข้ากระเป๋า':'Top up'}</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
            {KD_TOPUP_QUICK.map(a=>(<button key={a} onClick={()=>{setTopAmt(a);setTopMsg('');}} style={{ flex:'1 1 70px', padding:'10px 6px', borderRadius:11, border:'1.6px solid '+(Number(topAmt)===a?'var(--brand)':'var(--hair-2)'), background:Number(topAmt)===a?'var(--brand-soft)':'#fff', color:Number(topAmt)===a?'var(--brand-ink)':'var(--ink-2)', fontWeight:700, fontSize:13.5, cursor:'pointer', fontFamily:'var(--font)' }}>{money(a)}</button>))}
          </div>
          <input className="kd-input num" inputMode="numeric" value={topAmt} onChange={e=>{ setTopAmt(e.target.value.replace(/\D/g,'')); setTopMsg(''); }} placeholder={TH?'ระบุจำนวนเงิน':'Custom amount'}/>
          <div style={{ textAlign:'center', marginTop:12 }}>
            {(sysAcct&&sysAcct.promptpay&&payAmt>0) ? <div style={{ display:'inline-block', padding:12, background:'#fff', borderRadius:16 }}><QRBlock payload={window.KDW.promptpayPayload(sysAcct.promptpay,payAmt)} size={186}/></div> : null}
            <div className="num" style={{ fontWeight:700, marginTop:6 }}>{money(payAmt||Number(topAmt)||0)}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.55 }}>{TH?'สแกนพร้อมเพย์เพื่อโอนเข้าบัญชีระบบ · ยอดถูกใส่มาให้แล้ว':'Scan PromptPay to top up'}</div>
            <AcctRows amount={payAmt}/>
            <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:6, lineHeight:1.55, textAlign:'left' }}>{TH?<>โอน <b>{money(payAmt)}</b> เป๊ะ — เศษสตางค์ท้ายคือเลขอ้างอิงของคำขอนี้ ระบบใช้จับคู่ยอดที่เข้าบัญชีให้อัตโนมัติ</>:'Transfer the exact amount — the cents are this request\u2019s reference'}</div></div>
          <label style={{ display:'block', marginTop:11, padding:'12px 13px', borderRadius:12, border:'1.5px dashed var(--hair)', cursor:'pointer', background:'#fff' }}>
            <input type="file" accept="image/*" onChange={pickTopSlip} style={{ display:'none' }}/>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--brand-ink)' }}>{topSlip?(TH?'✓ แนบสลิปแล้ว · แตะเพื่อเปลี่ยน':'✓ Slip attached'):(TH?'แนบสลิปโอนเงิน (ระบบตรวจยอดกับธนาคารให้ทันที)':'Attach transfer slip')}</span>
            <span style={{ display:'block', fontSize:12, color:'var(--ink-3)', marginTop:3, lineHeight:1.5 }}>{TH?'ไม่แนบก็ได้ · ระบบจะจับยอดที่เข้าบัญชี หรือรอผู้ดูแลยืนยัน':'Optional'}</span>
          </label>
          {topSlip?<img src={topSlip} alt="slip" style={{ width:'100%', maxHeight:190, objectFit:'contain', marginTop:9, borderRadius:11, background:'#fff' }}/>:null}
          <button onClick={topup} disabled={busy} className="kd-btn kd-btn-block" style={{ marginTop:12, background:'#fff', border:'1.6px solid var(--brand)', color:'var(--brand-ink)', padding:13, fontWeight:700, opacity:busy?.6:1 }}>{busy?(TH?'กำลังส่งคำขอ…':'Sending…'):(TH?`แจ้งเติมเงิน ${money(payAmt||Number(topAmt)||0)}`:`Request top-up ${money(payAmt||Number(topAmt)||0)}`)}</button>
          {topMsg && <div style={{ marginTop:10, fontSize:12.5, fontWeight:600, color:'var(--ink-2)', background:'#fff', borderRadius:11, padding:'10px 12px', lineHeight:1.5 }}>{topMsg}</div>}
          <button onClick={()=>setWalLog(v=>!v)} style={{ border:'none', background:'none', color:'var(--brand-ink)', fontWeight:700, fontSize:12.5, cursor:'pointer', marginTop:10, padding:0 }}>{walLog?(TH?'ซ่อนประวัติการทำรายการ':'Hide history'):(TH?'ดูประวัติการทำรายการ':'Transaction history')}</button>
          {walLog && window.KDWalletHistory && <div style={{ marginTop:10 }}><window.KDWalletHistory biz={wBiz} embedded/></div>}
        </div>}

        {method==='promptpay' && <div className="kd-card" style={{ padding:16, textAlign:'center', marginBottom:8, background:'var(--brand-softer)', boxShadow:'none' }}>
          {(sysAcct&&sysAcct.promptpay) ? <div style={{ display:'inline-block', padding:12, background:'#fff', borderRadius:16 }}><QRBlock payload={window.KDW.promptpayPayload(sysAcct.promptpay,plan.price)} size={186}/></div> : null}
          <div className="num" style={{ fontWeight:700, marginTop:6 }}>{money(plan.price)}</div>
          <div style={{ fontSize:12, color:'var(--ink-3)' }}>{TH?'สแกนพร้อมเพย์จ่ายค่าบริการระบบ':'PromptPay'}</div>
          <AcctRows amount={plan.price}/></div>}
      </div>
      <div style={{ padding:'12px 20px 0' }}>
        <button onClick={renew} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15, opacity:(method==='wallet'&&short>0)?.55:1 }}>
          {method==='card'?(TH?'ผูกบัตร & เปิดต่ออายุอัตโนมัติ':'Link card & enable auto-renew')
            :method==='wallet'?(short>0?(TH?`เติมเงินอีก ${money(short)} ก่อนต่ออายุ`:`Top up ${money(short)} first`):(TH?`หักจากกระเป๋า ${money(plan.price)}`:`Pay ${money(plan.price)} from wallet`))
            :(TH?`ยืนยันชำระ ${money(plan.price)}`:`Pay ${money(plan.price)}`)}</button>
      </div>
    </Sheet>
  );
}

/* store profile: name, map, hours */
const EMOJIS = ['🍳','🍜','☕','🍔','🍦','🥗','🍱','🧋'];
const WEEK_DAYS = [['mon','จ','Mon'],['tue','อ','Tue'],['wed','พ','Wed'],['thu','พฤ','Thu'],['fri','ศ','Fri'],['sat','ส','Sat'],['sun','อา','Sun']];
function ShopProfileSheet({ shop, setShop, onClose, regOpen }){
  const { t, lang } = useT();
  const TH = lang==='th';
  const [f,setF] = m2State({ ...shop });
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const defWeek=()=> Object.fromEntries(WEEK_DAYS.map(([k])=>[k,{ closed:false, open:f.open||'08:00', close:f.close||'20:00' }]));
  const week = f.week || defWeek();
  const setDay=(k,patch)=>setF(p=>{ const w={...(p.week||defWeek())}; w[k]={...w[k],...patch}; return {...p,week:w}; });
  const applyAll=()=>setF(p=>{ const w={...(p.week||defWeek())}; WEEK_DAYS.forEach(([k])=>{ w[k]={...w[k], open:p.open, close:p.close }; }); return {...p,week:w}; });
  return (
    <Sheet open={true} onClose={onClose} height="94%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{lang==='th'?'ข้อมูลร้าน':'Store profile'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        {/* emoji + name */}
        <Lbl>{lang==='th'?'โลโก้ร้าน':'Store icon'}</Lbl>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          {EMOJIS.map(e=>(<button key={e} onClick={()=>upd('emoji',e)} style={{ width:44, height:44, borderRadius:13, fontSize:22, cursor:'pointer',
            border: f.emoji===e?'2.5px solid var(--brand)':'2px solid var(--hair)', background: f.emoji===e?'var(--brand-soft)':'#fff' }}>{e}</button>))}
        </div>
        {/* logo photo */}
        <Lbl>{TH?'โลโก้ (อัปรูปจริง)':'Logo photo'}</Lbl>
        <div style={{ fontSize:11, color:'var(--ink-3)', margin:'-2px 0 8px', lineHeight:1.4 }}>{TH?'แนะนำ 512×512 px · สี่เหลี่ยมจัตุรัส · PNG/JPG ไม่เกิน ~2MB':'512×512 px · square · PNG/JPG'}</div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:60, height:60, borderRadius:16, flex:'0 0 auto', background:'var(--brand-soft)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, overflow:'hidden', backgroundImage:f.logo?`url(${f.logo})`:'none', backgroundSize:'cover', backgroundPosition:'center' }}>{!f.logo && f.emoji}</div>
          <label className="kd-btn kd-btn-ghost" style={{ cursor:'pointer', padding:'11px 14px', fontSize:14, width:'auto' }}>{TH?'เลือกรูป':'Choose'}<input type="file" accept="image/*" style={{ display:'none' }} onChange={async e=>{ const file=e.target.files&&e.target.files[0]; if(file){ try{ upd('logo', await kdSlipResize(file)); }catch(_){}}}}/></label>
          {f.logo && <button onClick={()=>upd('logo',null)} style={{ border:'none', background:'none', color:'var(--ink-3)', fontWeight:700, fontSize:13, cursor:'pointer' }}>{TH?'ลบรูป':'Remove'}</button>}
        </div>
        {/* cover banner */}
        <Lbl>{TH?'รูปหน้าปกร้าน (แบนเนอร์บนหน้าลูกค้า)':'Cover banner'}</Lbl>
        <div style={{ fontSize:11, color:'var(--ink-3)', margin:'-2px 0 8px', lineHeight:1.4 }}>{TH?'แนะนำ 1200×675 px · แนวนอน 16:9 · PNG/JPG ไม่เกิน ~2MB':'1200×675 px · 16:9 landscape'}</div>
        <div style={{ marginBottom:16 }}>
          {f.cover
            ? <div style={{ position:'relative', borderRadius:14, overflow:'hidden', height:110 }}>
                <img src={f.cover} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                <button onClick={()=>upd('cover',null)} style={{ position:'absolute', top:8, right:8, border:'none', background:'rgba(0,0,0,.6)', color:'#fff', borderRadius:8, padding:'5px 10px', fontFamily:'var(--font)', fontSize:12, cursor:'pointer' }}>{TH?'ลบ':'Remove'}</button>
              </div>
            : <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, border:'1.6px dashed var(--hair-2)', borderRadius:14, height:110, color:'var(--ink-3)', background:'#fff', cursor:'pointer', fontSize:13 }}>
                📷 {TH?'แตะเพื่อใส่รูปหน้าร้าน':'Add cover photo'}
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={async e=>{ const file=e.target.files&&e.target.files[0]; if(file){ try{ upd('cover', await kdSlipResize(file)); }catch(_){}}}}/>
              </label>}
        </div>
        <div style={{ display:'flex', gap:12, marginBottom:14 }}>
          <div style={{ flex:2 }}><Field label={lang==='th'?'ชื่อร้าน':'Store name'}><input className="kd-input" value={f.name} onChange={e=>upd('name',e.target.value)}/></Field></div>
          <div style={{ flex:1 }}><Field label={lang==='th'?'สาขา':'Branch'}><input className="kd-input" value={f.branch} onChange={e=>upd('branch',e.target.value)}/></Field></div>
        </div>

        {/* map — แผนที่จริง (ฟรี · OpenStreetMap) ลากหมุดตั้งพิกัดร้าน */}
        <Lbl>{React.cloneElement(IC.pin,{size:14, style:{verticalAlign:'-2px', marginRight:4}})}{lang==='th'?'ที่ตั้งร้าน (แผนที่)':'Location (map)'}</Lbl>
        {window.MapPicker
          ? <div style={{ marginBottom:10 }}>
              <MapPicker value={{ lat:+f.lat||13.7563, lng:+f.lng||100.5018 }} height={150}
                onPick={p=>setF(prev=>({ ...prev, lat:String(p.lat), lng:String(p.lng) }))}/>
              <div className="num" style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:4 }}>📍 {f.lat}, {f.lng}</div>
            </div>
          : <div style={{ height:130, borderRadius:14, position:'relative', overflow:'hidden', background:'linear-gradient(160deg,#E7F6EF,#DCEFE5)', marginBottom:10 }}>
              <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(18,165,110,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(18,165,110,.1) 1px,transparent 1px)', backgroundSize:'22px 22px' }}/>
              <div style={{ position:'absolute', left:'50%', top:'46%', transform:'translate(-50%,-50%)', color:'var(--danger)' }}>{React.cloneElement(IC.pin,{size:34})}</div>
              <div style={{ position:'absolute', left:10, bottom:10, fontSize:11, fontWeight:700, color:'var(--ink-2)', background:'#fff', padding:'4px 9px', borderRadius:999, boxShadow:'var(--shadow)' }} className="num">📍 {f.lat}, {f.lng}</div>
            </div>}
        <input className="kd-input" style={{ marginBottom:12 }} value={f.map} onChange={e=>upd('map',e.target.value)} placeholder={lang==='th'?'ชื่อย่าน/จุดสังเกต':'Area / landmark'}/>
        <Field label={lang==='th'?'ที่อยู่เต็ม':'Full address'}><textarea className="kd-input" rows={2} style={{ resize:'none' }} value={f.address} onChange={e=>upd('address',e.target.value)}/></Field>

        {/* weekly hours */}
        <div style={{ height:16 }}/>
        {regOpen && <div style={{ background:'#FDF0E2', color:'#8a5a12', borderRadius:10, padding:'9px 12px', fontSize:12.5, lineHeight:1.5, marginBottom:8 }}>{TH?'ร้านกำลังเปิดอยู่ — แก้เวลาทำการ/วันหยุดได้หลังปิดวัน':'Store open — edit hours after closing the day'}</div>}
        <div style={{ opacity:regOpen?0.55:1, pointerEvents:regOpen?'none':'auto' }}>
        <Lbl>{React.cloneElement(IC.clock,{size:14, style:{verticalAlign:'-2px', marginRight:4}})}{TH?'เวลาทำการรายวัน':'Weekly hours'}</Lbl>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
          <div style={{ flex:1 }}><input className="kd-input num" type="time" value={f.open} onChange={e=>upd('open',e.target.value)}/></div>
          <span style={{ color:'var(--ink-3)', fontWeight:700 }}>–</span>
          <div style={{ flex:1 }}><input className="kd-input num" type="time" value={f.close} onChange={e=>upd('close',e.target.value)}/></div>
          <button onClick={applyAll} style={{ border:'none', cursor:'pointer', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, padding:'10px 12px', borderRadius:11, background:'var(--brand-soft)', color:'var(--brand-ink)', whiteSpace:'nowrap' }}>{TH?'ทุกวัน':'All days'}</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:14 }}>
          {WEEK_DAYS.map(([k,th,en])=>{ const d=week[k]; return (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg)', borderRadius:12, padding:'9px 12px' }}>
              <span style={{ width:30, fontSize:13.5, fontWeight:700, color: d.closed?'var(--ink-3)':'var(--ink)' }}>{TH?th:en}</span>
              {d.closed
                ? <span style={{ flex:1, fontSize:13, color:'var(--danger)', fontWeight:700 }}>{TH?'ร้านหยุด':'Closed'}</span>
                : <div style={{ flex:1, display:'flex', gap:6, alignItems:'center' }}>
                    <input className="kd-input num" style={{ padding:'7px 8px' }} type="time" value={d.open} onChange={e=>setDay(k,{open:e.target.value})}/>
                    <span style={{ color:'var(--ink-3)' }}>–</span>
                    <input className="kd-input num" style={{ padding:'7px 8px' }} type="time" value={d.close} onChange={e=>setDay(k,{close:e.target.value})}/>
                  </div>}
              <button onClick={()=>setDay(k,{closed:!d.closed})} style={{ border:'none', cursor:'pointer', fontFamily:'var(--font)', fontWeight:700, fontSize:12, padding:'7px 12px', borderRadius:999, background: d.closed?'var(--brand-soft)':'#FCECE8', color: d.closed?'var(--brand-ink)':'var(--danger)', flexShrink:0 }}>{d.closed?(TH?'เปิด':'Open'):(TH?'หยุด':'Off')}</button>
            </div>
          );})}
        </div>
        <Lbl>{TH?'หมายเหตุวันหยุด / เทศกาล':'Holiday / festival note'}</Lbl>
        <textarea className="kd-input" rows={2} style={{ resize:'none', marginBottom:14 }} value={f.holidayNote||''} onChange={e=>upd('holidayNote',e.target.value)} placeholder={TH?'เช่น หยุดสงกรานต์ 13–15 เม.ย. · ปีใหม่ 31 ธ.ค.–1 ม.ค.':'e.g. closed Songkran Apr 13–15'}/>
        </div>
        {/* open toggle */}
        {/* open mode: auto (ตามเวลา) / manual (กำหนดเอง) */}
        {(()=>{ const mode=f.hoursMode||'auto'; const liveOpen=window.kdShopOpen?window.kdShopOpen(f):(f.isOpen!==false); return (
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            {[['auto',TH?'อัตโนมัติตามเวลาทำการ':'Auto by hours'],['manual',TH?'กำหนดเอง':'Manual']].map(([k,l])=>(
              <button key={k} onClick={()=>upd('hoursMode',k)} style={{ flex:1, cursor:'pointer', border:'2px solid '+(mode===k?'var(--brand)':'var(--hair-2)'), background:mode===k?'var(--brand-soft)':'#fff', color:mode===k?'var(--brand-ink)':'var(--ink-2)', borderRadius:11, padding:'10px', fontFamily:'var(--font)', fontWeight:700, fontSize:13 }}>{l}</button>
            ))}
          </div>
          <div className="kd-card" style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 15px', boxShadow:'none', background:'var(--bg)' }}
            onClick={()=> mode==='manual' ? upd('isOpen',!f.isOpen) : upd('pause',!f.pause)}>
            <span style={{ color: liveOpen?'var(--brand)':'var(--ink-3)' }}>{React.cloneElement(IC.store,{size:20})}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14.5, fontWeight:600 }}>{mode==='manual'?(TH?'เปิดรับออเดอร์ตอนนี้':'Accepting orders now'):(TH?'ปิดชั่วคราว (ของหมด/พักร้าน)':'Pause temporarily')}</div>
              <div style={{ fontSize:12, color: liveOpen?'var(--brand-ink)':'var(--danger)', fontWeight:600, marginTop:1 }}>{TH?'สถานะตอนนี้: ':'Now: '}{liveOpen?(TH?'เปิดอยู่':'Open'):(TH?'ปิดอยู่':'Closed')}{mode==='auto'&&!f.pause?(TH?' (ตามเวลาทำการ)':' (by hours)'):''}</div>
            </div>
            <Toggle on={mode==='manual'? f.isOpen!==false : !f.pause}/>
          </div>
          {mode==='auto' && <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:7, lineHeight:1.5 }}>{TH?'ร้านจะเปิด/ปิดเองตามเวลาทำการรายวันด้านบน · สวิตช์นี้ไว้ “ปิดชั่วคราว” นอกเหนือเวลา (เช่น ของหมด)':'Opens/closes automatically by daily hours; use this to pause outside hours'}</div>}
        </div>
        ); })()}
        <Lbl>{React.cloneElement(IC.phone,{size:13, style:{verticalAlign:'-2px', marginRight:4}})}{lang==='th'?'เบอร์โทรร้าน':'Store phone'}</Lbl>
        <input className="kd-input num" value={f.phone} onChange={e=>upd('phone',e.target.value)}/>
      </div>
      <div style={{ padding:'12px 20px 0' }}>
        <button onClick={()=>{ setShop({ ...f, week: f.week||defWeek(), hoursSet:true }); onClose(); }} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15 }}>{t('save')}</button>
      </div>
    </Sheet>
  );
}

/* payment / QR settings */
const PAY_META = {
  promptpay:{th:'พร้อมเพย์ QR',en:'PromptPay QR',ic:IC.qr},
  cash     :{th:'เงินสด',en:'Cash',ic:IC.cash},
  cod      :{th:'เก็บเงินปลายทาง',en:'Cash on delivery',ic:IC.truck},
};
function PaySettingsSheet({ pay, setPay, onClose }){
  const { t, lang } = useT();
  const [f,setF] = m2State({ ...pay, accept:{...pay.accept} });
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const toggle=(k)=>setF(p=>({...p, accept:{...p.accept, [k]:!p.accept[k]}}));
  const previewItem={ cat:'drink', tone:'#fff' };
  const qrCardRef = React.useRef(null);
  const canShare = typeof navigator!=='undefined' && !!navigator.share;
  const [cp,setCp] = m2State('');
  const cpVal = (k,v)=>{ try{ navigator.clipboard.writeText(String(v).replace(/[^\d.-]/g,'')); setCp(k); setTimeout(()=>setCp(''),1600); }catch(e){} };
  const shareQR = async ()=>{
    const TH = lang==='th'; const cap=(f.shopName||'')+(f.promptpay?(' · '+(TH?'พร้อมเพย์ ':'PromptPay ')+f.promptpay):'');
    try{
      let dataUrl = f.qrImg||'';
      if((!dataUrl||dataUrl.slice(0,5)!=='data:') && qrCardRef.current){ const cv=qrCardRef.current.querySelector('canvas'); const im=qrCardRef.current.querySelector('img');
        try{ dataUrl = cv?cv.toDataURL('image/png'):(im?im.src:dataUrl); }catch(e){ dataUrl = im?im.src:dataUrl; } }
      if(dataUrl && dataUrl.slice(0,5)==='data:' && navigator.share && navigator.canShare){
        const b64=dataUrl.split(',')[1]; const bin=atob(b64); const arr=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
        const file=new File([new Blob([arr],{type:'image/png'})], 'promptpay-qr.png', { type:'image/png' });
        if(navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], title:f.shopName||'PromptPay', text:cap }); return; } }
      if(navigator.share){ await navigator.share({ title:f.shopName||'PromptPay', text:cap }); return; }
    }catch(e){ if(e && e.name==='AbortError') return; }
    try{ navigator.clipboard.writeText(cap); }catch(e){}
  };
  return (
    <Sheet open={true} onClose={onClose} height="94%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{lang==='th'?'ตั้งค่ารับเงิน':'Payment settings'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        {/* วิธีรับเงินจากลูกค้า — 2 โหมด (ไฟล์ร่วม kd-wallet.jsx) */}
        {window.KDReceivePanel && window.KDW && <div style={{ marginBottom:14 }}>
          <window.KDReceivePanel biz={window.KDW.biz('pos',(f.shopId||f.shopName||'shop1'))} who={f.shopName||'ร้านของฉัน'} acctLabel="ร้าน"/>
        </div>}
        {/* QR preview */}
        <div className="kd-card" style={{ padding:16, textAlign:'center', marginBottom:14, background:'var(--brand-softer)', boxShadow:'none' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--brand-ink)', marginBottom:8 }}>{lang==='th'?'ตัวอย่าง QR ที่ลูกค้าจะเห็น':'Customer QR preview'}</div>
          <div ref={qrCardRef} style={{ display:'inline-block', padding:12, background:'#fff', borderRadius:16, boxShadow:'var(--shadow)' }}>
            <QRBlock src={f.qrImg} payload={(!f.qrImg && f.promptpay && window.KDW)?window.KDW.promptpayPayload(f.promptpay,0):null}/>
            <div style={{ fontWeight:700, marginTop:6, fontSize:13 }}>{f.shopName||'ร้านของฉัน'}</div>
            <div className="num" style={{ fontSize:12, color:'var(--ink-3)' }}>{f.promptpay}</div>
          </div>
          {/* คัดลอกเลขพร้อมเพย์/เลขบัญชีของร้าน — ลูกค้าที่สแกนไม่ได้จะพิมพ์เอง */}
          {[[lang==='th'?'พร้อมเพย์':'PromptPay',f.promptpay],[f.acct?(f.bank||(lang==='th'?'เลขบัญชี':'Account')):'',f.acct]].filter(x=>x[0]&&x[1]).map(([k,v])=>(
            <div key={k} style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'space-between', background:'#fff', borderRadius:11, padding:'9px 12px', marginTop:9, textAlign:'left' }}>
              <span style={{ fontSize:12, color:'var(--ink-3)' }}>{k}</span>
              <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                <b className="num" style={{ fontSize:13.5 }}>{v}</b>
                <button onClick={()=>cpVal(k,v)} style={{ border:'1.2px solid var(--hair-2)', background:'#fff', borderRadius:8, padding:'4px 9px', fontSize:11, fontWeight:700, color:'var(--brand-ink)', cursor:'pointer', fontFamily:'var(--font)' }}>{cp===k?(lang==='th'?'คัดลอกแล้ว':'Copied'):(lang==='th'?'คัดลอก':'Copy')}</button>
              </span>
            </div>))}
          {canShare && <div style={{ marginTop:12 }}>
            <button onClick={shareQR} className="kd-btn kd-btn-primary" style={{ padding:'10px 18px', fontWeight:700 }}>↗ {lang==='th'?'แชร์ QR ร้าน':'Share shop QR'}</button>
          </div>}
        </div>
        {/* upload real bank QR */}
        <label style={{ display:'block', cursor:'pointer', marginBottom:16 }}>
          <div className="kd-card" style={{ padding:'13px 15px', display:'flex', alignItems:'center', gap:12, boxShadow:'none',
            background: f.qrImg?'var(--brand-soft)':'#fff', border: f.qrImg?'1.5px solid var(--brand)':'1.5px dashed var(--hair-2)' }}>
            <span style={{ width:40, height:40, borderRadius:10, background:'var(--bg)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{React.cloneElement(IC.qr,{size:20})}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600 }}>{lang==='th'?'แนบรูป QR ของร้าน':'Upload your shop QR'}</div>
              <div style={{ fontSize:12, color: f.qrImg?'var(--brand-ink)':'var(--ink-3)', marginTop:2 }}>{f.qrImg?(lang==='th'?'แนบแล้ว · ลูกค้าจะเห็นรูปนี้':'Attached · shown to customers'):(lang==='th'?'เซฟ QR พร้อมเพย์จากแอปธนาคารมาแนบได้':'Save PromptPay QR from your bank app')}</div>
            </div>
            {f.qrImg
              ? <button onClick={e=>{ e.preventDefault(); upd('qrImg',null); }} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--danger)', fontFamily:'var(--font)', fontSize:12.5, fontWeight:700 }}>{lang==='th'?'ลบ':'Remove'}</button>
              : <span style={{ color:'var(--ink-3)' }}>{React.cloneElement(IC.plus,{size:18})}</span>}
          </div>
          <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ const file=e.target.files&&e.target.files[0]; if(!file)return; const r=new FileReader(); r.onload=ev=>upd('qrImg',ev.target.result); r.readAsDataURL(file); }}/>
        </label>
        <Field label={lang==='th'?'ชื่อร้าน':'Shop name'}><input className="kd-input" value={f.shopName} onChange={e=>upd('shopName',e.target.value)}/></Field>
        <div style={{ height:12 }}/>
        <Field label={lang==='th'?'เบอร์พร้อมเพย์ / เลขบัตรประชาชน':'PromptPay number'}><input className="kd-input num" value={f.promptpay} onChange={e=>upd('promptpay',e.target.value)}/></Field>
        <div style={{ display:'flex', gap:12, margin:'12px 0 18px' }}>
          <div style={{ flex:1 }}><Field label={lang==='th'?'ธนาคาร':'Bank'}><input className="kd-input" value={f.bank} onChange={e=>upd('bank',e.target.value)}/></Field></div>
          <div style={{ flex:1 }}><Field label={lang==='th'?'เลขบัญชี':'Account no.'}><input className="kd-input num" value={f.acct} onChange={e=>upd('acct',e.target.value)}/></Field></div>
        </div>
        {/* accepted methods */}
        <Lbl>{lang==='th'?'ช่องทางที่รับเงิน':'Accepted methods'}</Lbl>
        <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:16 }}>
          {Object.keys(PAY_META).map(k=>(
            <button key={k} onClick={()=>toggle(k)} className="kd-card" style={{ border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', gap:13, padding:'13px 15px', fontFamily:'var(--font)', textAlign:'left', boxShadow:'none', background:'var(--bg)' }}>
              <span style={{ color: f.accept[k]?'var(--brand)':'var(--ink-3)' }}>{React.cloneElement(PAY_META[k].ic,{size:22})}</span>
              <span style={{ flex:1, fontSize:15, fontWeight:600 }}>{PAY_META[k][lang]||PAY_META[k].th}</span>
              <Toggle on={f.accept[k]}/>
            </button>
          ))}
        </div>
        <Lbl>{lang==='th'?'จังหวะเก็บเงินหน้าขาย · แยกตามช่องทาง':'Checkout timing · per channel'}</Lbl>
        <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'-2px 0 10px', lineHeight:1.5 }}>{lang==='th'?'เลือกปุ่มหลักตอนจบบิลของแต่ละช่องทางหน้าร้าน — “เก็บเงินก่อน” (คิดเงินเลย) หรือ “ส่งออเดอร์ก่อน” (เข้าครัว เก็บเงินทีหลัง) · สลับได้เสมอที่หน้าขาย':'Pick the default checkout button per in-store channel — charge first, or send order first (pay later). Either is always available on Sell.'}</div>
        {(()=>{ const pt=(f.payTiming&&typeof f.payTiming==='object')?f.payTiming:{}; const val=(k)=>pt[k]||(f.instantPay?'first':'later');
          const setT=(k,v)=>upd('payTiming',{ ...(f.payTiming&&typeof f.payTiming==='object'?f.payTiming:{ dinein:val('dinein'), walkin:val('walkin'), takeaway:val('takeaway') }), [k]:v });
          const CH=[['dinein',lang==='th'?'🍽️ ทานที่ร้าน':'🍽️ Dine-in'],['walkin',lang==='th'?'🏪 หน้าร้าน':'🏪 Walk-in'],['takeaway',lang==='th'?'🥡 กลับบ้าน':'🥡 Takeaway']];
          return CH.map(([k,l])=>(<div key={k} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{ flex:1, fontSize:13.5, fontWeight:700, color:'var(--ink-2)' }}>{l}</div>
            <div style={{ display:'flex', gap:6 }}>
              {[['later',lang==='th'?'เก็บทีหลัง':'Pay later'],['first',lang==='th'?'เก็บเงินก่อน':'Charge first']].map(([o,ol])=>{ const on=val(k)===o; return (
                <button key={o} onClick={()=>setT(k,o)} style={{ cursor:'pointer', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', color:on?'var(--brand-ink)':'var(--ink-3)', borderRadius:10, padding:'8px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, whiteSpace:'nowrap' }}>{ol}</button>
              ); })}
            </div>
          </div>)); })()}
        <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'2px 0 16px', lineHeight:1.5, background:'var(--brand-softer)', borderRadius:10, padding:'9px 12px' }}>💡 {lang==='th'?'คนละส่วนกับ “ลิงก์ให้ลูกค้าสั่งเอง” — อันนั้นตั้งที่โมดูล Mobile Order (จ่ายก่อน/ยืนยันก่อน) ส่วนนี้คุมเฉพาะการคิดเงินหน้าร้านของแคชเชียร์':'Separate from the customer self-order link — that is set in the Mobile Order module. This controls only the cashier’s in-store checkout.'}</div>
        <Lbl>{lang==='th'?'ถ่ายสลิปหลักฐานหลังจบบิลพร้อมเพย์':'Slip photo after PromptPay checkout'}</Lbl>
        <div style={{ display:'flex', gap:8, marginBottom:6 }}>
          {[['required',lang==='th'?'บังคับ':'Required'],['optional',lang==='th'?'ไม่บังคับ':'Optional'],['off',lang==='th'?'ปิด':'Off']].map(([k,l])=>{ const on=(f.slipReq||'optional')===k; return (
            <button key={k} onClick={()=>upd('slipReq',k)} style={{ flex:1, cursor:'pointer', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', color:on?'var(--brand-ink)':'var(--ink-2)', borderRadius:11, padding:'11px 8px', fontFamily:'var(--font)', fontWeight:700, fontSize:13 }}>{l}</button>
          ); })}
        </div>
        <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:16, lineHeight:1.5 }}>{lang==='th'?'บังคับ = ต้องถ่ายสลิปก่อนจบบิล · ไม่บังคับ = ถ่ายหรือข้ามก็ได้ (ค้างไว้ตรวจทีหลังได้) · ปิด = ไม่ถามถ่ายสลิป':'Required = must capture before closing · Optional = capture or skip · Off = never ask'}</div>
        <Lbl>{lang==='th'?'เก็บเงินก่อนทำอาหารเสร็จ?':'Collect before the order is ready?'}</Lbl>
        <div style={{ display:'flex', gap:8, marginBottom:6 }}>
          {[['anytime',lang==='th'?'เก็บได้ทุกเมื่อ':'Anytime'],['afterDone',lang==='th'?'ต้องทำเสร็จก่อน':'After ready']].map(([k,l])=>{ const on=(f.collectGate||(typeof f.payTiming==='string'?f.payTiming:'anytime'))===k; return (
            <button key={k} onClick={()=>upd('collectGate',k)} style={{ flex:1, cursor:'pointer', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', color:on?'var(--brand-ink)':'var(--ink-2)', borderRadius:11, padding:'11px 8px', fontFamily:'var(--font)', fontWeight:700, fontSize:13 }}>{l}</button>
          ); })}
        </div>
        <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:16, lineHeight:1.5 }}>{lang==='th'?'เก็บได้ทุกเมื่อ = กดปุ่ม “เก็บเงิน” ปิดบิลก่อนทำเสร็จได้ · ต้องทำเสร็จก่อน = ล็อกให้กด “ทำเสร็จ” ก่อน ถึงจะเก็บเงิน/จบบิลได้ (กันจบบิลก่อนอาหารเสร็จ)':'Anytime = staff can close the bill before the food is ready · After ready = the order must be marked ready before payment can close the bill'}</div>
        <Lbl>{lang==='th'?'รหัสยกเลิกบิล (Void PIN)':'Void PIN'}</Lbl>
        <input className="kd-input num" inputMode="numeric" maxLength={6} value={f.voidPin||''} onChange={e=>upd('voidPin',e.target.value.replace(/\D/g,''))} placeholder={lang==='th'?'ตั้งรหัส 4–6 หลัก (เว้นว่าง = ไม่ต้องใช้รหัส)':'4–6 digits (blank = no PIN)'} style={{ letterSpacing:'3px', fontWeight:700, textAlign:'center' }}/>
        <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'6px 2px 16px', lineHeight:1.5 }}>{lang==='th'?'ใช้ยืนยันก่อนยกเลิกบิลในหน้าคิวออเดอร์ — กันพนักงานกดยกเลิกเอง (ผู้จัดการถือรหัส)':'Required to void a bill in the orders queue — only staff who know the PIN can cancel.'}</div>

        <Lbl>{lang==='th'?'ต้องขออนุมัติก่อนยกเลิก/ไม่รับบิล':'Require approval to void a bill'}</Lbl>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          {[['off',lang==='th'?'ไม่ต้อง':'No'],['on',lang==='th'?'ต้องอนุมัติ':'Required']].map(([k,l])=>{ const on=((f.voidApproval?'on':'off'))===k; return (
            <button key={k} onClick={()=>upd('voidApproval',k==='on')} style={{ flex:1, cursor:'pointer', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', color:on?'var(--brand-ink)':'var(--ink-2)', borderRadius:11, padding:'11px', fontFamily:'var(--font)', fontWeight:700, fontSize:14 }}>{l}</button>
          ); })}
        </div>
        {f.voidApproval && <>
          <Lbl>{lang==='th'?'ใครเป็นผู้อนุมัติ':'Who approves'}</Lbl>
          <div style={{ display:'flex', gap:8, marginBottom:6 }}>
            {[['owner',lang==='th'?'เฉพาะเจ้าของร้าน':'Owner only'],['manager',lang==='th'?'ผู้จัดการ + เจ้าของ':'Manager + Owner']].map(([k,l])=>{ const on=((f.voidApprover||'owner'))===k; return (
              <button key={k} onClick={()=>upd('voidApprover',k)} style={{ flex:1, cursor:'pointer', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', color:on?'var(--brand-ink)':'var(--ink-2)', borderRadius:11, padding:'11px 8px', fontFamily:'var(--font)', fontWeight:700, fontSize:13 }}>{l}</button>
            ); })}
          </div>
        </>}
        <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'6px 2px 16px', lineHeight:1.5 }}>{lang==='th'?'เปิด = พนักงานกดยกเลิก/ไม่รับบิล จะกลายเป็น “คำขอ” ส่งให้ผู้อนุมัติกดยืนยันก่อน ถึงจะยกเลิกจริง (คำขอค้างที่การ์ดออเดอร์)':'On = when staff void/decline a bill it becomes a request the approver must confirm before it actually voids.'}</div>

        {/* ── สั่งจองล่วงหน้า (Pre-order) เมื่อร้านปิด ── */}
        <Lbl>{lang==='th'?'ให้ลูกค้าสั่งจองล่วงหน้าตอนร้านปิด':'Let customers pre-order while closed'}</Lbl>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          {[['on',lang==='th'?'เปิด':'On'],['off',lang==='th'?'ปิด':'Off']].map(([k,l])=>{ const on=((f.preorderOn!==false)?'on':'off')===k; return (
            <button key={k} onClick={()=>upd('preorderOn',k==='on')} style={{ flex:1, cursor:'pointer', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', color:on?'var(--brand-ink)':'var(--ink-2)', borderRadius:11, padding:'11px', fontFamily:'var(--font)', fontWeight:700, fontSize:14 }}>{l}</button>
          ); })}
        </div>
        <textarea className="kd-input" rows={2} value={f.preorderNote||''} onChange={e=>upd('preorderNote',e.target.value)} placeholder={lang==='th'?'เงื่อนไขสั่งจอง (แสดงเป็น pop-up ก่อนลูกค้ายืนยัน) — เช่น รับของ 09:00–11:00 เท่านั้น':'Pre-order note shown as a pop-up before the customer confirms'} style={{ resize:'vertical', lineHeight:1.5 }}/>
        <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'6px 2px 16px', lineHeight:1.5 }}>{lang==='th'?'ปิด = ร้านปิดแล้วลูกค้าสั่งไม่ได้เลย · เปิด = สั่งล่วงหน้าได้ ร้านเริ่มทำตามเวลาที่เลือก':'Off = no orders while closed · On = customers can pre-order for a chosen time.'}</div>

        {/* ── สิทธิ์พนักงาน/ผู้จัดการเปิด-ปิดร้าน ── */}
        <Lbl>{lang==='th'?'อนุญาตให้พนักงาน/ผู้จัดการเปิด-ปิดร้านเองได้':'Let staff/manager open & close the shop'}</Lbl>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          {[['on',lang==='th'?'อนุญาต':'Allow'],['off',lang==='th'?'ไม่อนุญาต':'No']].map(([k,l])=>{ const on=((f.staffCanOpen)?'on':'off')===k; return (
            <button key={k} onClick={()=>upd('staffCanOpen',k==='on')} style={{ flex:1, cursor:'pointer', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', color:on?'var(--brand-ink)':'var(--ink-2)', borderRadius:11, padding:'11px', fontFamily:'var(--font)', fontWeight:700, fontSize:14 }}>{l}</button>
          ); })}
        </div>
        <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'6px 2px 16px', lineHeight:1.5 }}>{lang==='th'?'เครื่องพนักงานจะเปิด-ปิดร้าน + เห็นสรุปยอด“วันปัจจุบัน”ตอนปิดวัน (นับเงินในลิ้นชัก) — แต่ดูรายงานย้อนหลัง/ภาพรวมเจ้าของไม่ได้':'Staff device can open/close and see the current-day summary at close — but not history or owner reports.'}</div>

        {/* ── ขั้นตอนชำระเงิน (Payment Workflow) — ลิงก์สั่งลูกค้า ── */}
        <Lbl>{lang==='th'?'ขั้นตอนชำระเงิน (ลิงก์สั่งลูกค้า)':'Payment workflow (customer link)'}</Lbl>
        {[['payFirst', lang==='th'?'จ่ายก่อนส่งออเดอร์':'Pay first', lang==='th'?'ลูกค้าจ่าย+แนบสลิปก่อน ออเดอร์จึงเข้าร้าน · ถ้าร้านปฏิเสธ = คืนเงินให้ลูกค้า':'Customer pays & attaches slip first; declined = refund'],
          ['confirmFirst', lang==='th'?'ร้านยืนยันก่อนค่อยจ่าย':'Confirm first', lang==='th'?'ลูกค้าส่งออเดอร์ → ร้านกดยืนยันรับ → ลูกค้าจึงสแกนจ่าย → เข้าคิวทำ':'Order → shop confirms → customer pays → enters kitchen']].map(([k,tt,ss])=>{ const on=(f.payWorkflow||'payFirst')===k; return (
          <button key={k} onClick={()=>upd('payWorkflow',k)} style={{ width:'100%', textAlign:'left', cursor:'pointer', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', borderRadius:12, padding:'11px 13px', marginBottom:8, fontFamily:'var(--font)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <span style={{ width:20, height:20, borderRadius:999, flexShrink:0, border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand)':'#fff', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:800 }}>{on?'✓':''}</span>
              <span style={{ fontSize:14, fontWeight:700, color:on?'var(--brand-ink)':'var(--ink)' }}>{tt}</span>
            </div>
            <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:5, marginLeft:29, lineHeight:1.45 }}>{ss}</div>
          </button>
        ); })}

        {/* ── การปิดวันเมื่อมีบิลพร้อมเพย์ค้างตรวจ ── */}
        <Lbl>{lang==='th'?'ปิดวันเมื่อมีบิลพร้อมเพย์ค้างตรวจ':'Closing with unverified PromptPay bills'}</Lbl>
        <div style={{ display:'flex', gap:8, marginBottom:6 }}>
          {[['off',lang==='th'?'ปิดได้เลย':'Allow'],['warn',lang==='th'?'เตือนก่อน':'Warn'],['block',lang==='th'?'บล็อกไว้':'Block']].map(([k,l])=>{ const on=(f.closeGate||'warn')===k; return (
            <button key={k} onClick={()=>upd('closeGate',k)} style={{ flex:1, cursor:'pointer', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', color:on?'var(--brand-ink)':'var(--ink-2)', borderRadius:11, padding:'11px 8px', fontFamily:'var(--font)', fontWeight:700, fontSize:13 }}>{l}</button>
          ); })}
        </div>
        <div style={{ fontSize:11.5, color:'var(--ink-3)', marginBottom:8, lineHeight:1.45 }}>{lang==='th'?'“เตือน” = ยืนยันก่อนปิด · “บล็อก” = ต้องตรวจสลิปให้ครบก่อนถึงปิดวันได้ (บิลค้างตรวจไม่ถูกรวมในยอดปิดวันทุกกรณี)':'“Warn” = confirm before close · “Block” = must verify all slips first (unverified bills are always excluded from the close)'}</div>

        {/* ── โหมดรับชำระ (Manual / Gateway) ── */}
        <Lbl>{lang==='th'?'โหมดรับชำระพร้อมเพย์':'PromptPay handling'}</Lbl>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          {[['manual',lang==='th'?'แนบสลิปเอง (Manual)':'Manual slip'],['gateway',lang==='th'?'Payment Gateway (API)':'Gateway (API)']].map(([k,l])=>{ const on=(f.payMode||'manual')===k; return (
            <button key={k} onClick={()=>upd('payMode',k)} style={{ flex:1, cursor:'pointer', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', color:on?'var(--brand-ink)':'var(--ink-2)', borderRadius:11, padding:'11px 8px', fontFamily:'var(--font)', fontWeight:700, fontSize:13 }}>{l}</button>
          ); })}
        </div>
        <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'6px 2px 16px', lineHeight:1.5 }}>{(f.payMode==='gateway')?(lang==='th'?'⚙️ โหมด Gateway ยังไม่เชื่อม API — ตั้งค่าคีย์/ผู้ให้บริการได้ใน Backoffice ภายหลัง (ตอนนี้ยังทำงานแบบแนบสลิป)':'⚙️ Gateway not connected yet — configure API in Backoffice later (falls back to manual slip)'):(lang==='th'?'ลูกค้าโอนแล้วแนบสลิป ร้านกดยืนยันเอง (ไม่ต้องมี API) — ค่าเริ่มต้น':'Customer transfers & attaches slip; shop confirms manually (no API needed).')}</div>

        {/* ── วิธีจับยอดพร้อมเพย์ (ร้านเลือกเปิด/ปิดได้) ── */}
        {(()=>{ const bm=(f.billMatch&&typeof f.billMatch==='object')?f.billMatch:{slip:true,paste:true,lineBot:false}; const on=(k)=>k==='lineBot'?!!bm.lineBot:bm[k]!==false; const updBm=(k)=>upd('billMatch',{slip:bm.slip!==false,paste:bm.paste!==false,lineBot:!!bm.lineBot,[k]:!on(k)});
          const rows=[['slip','📷',(lang==='th'?'แนบสลิป / ยืนยันเอง':'Slip / manual confirm'),(lang==='th'?'เปิดบิลทีละใบ ใส่ยอดจริง/แนบสลิป กดยืนยันเอง':'Open each bill, enter amount/slip, confirm')],
            ['paste','📋',(lang==='th'?'วางข้อความแจ้งเตือนธนาคาร':'Paste bank alert text'),(lang==='th'?'ก็อปข้อความเงินเข้าจาก SMS/LINE ธนาคารมาวาง → จับคู่บิลค้างให้อัตโนมัติ':'Paste incoming-transfer text → auto-match pending bills')],
            ['lineBot','🤖',(lang==='th'?'บอท LINE จับยอดสด (อัตโนมัติ)':'Live LINE bot (auto)'),(lang==='th'?'ผูกกลุ่ม LINE กับบัญชีร้าน → ยอดที่ธนาคารแจ้งเข้ากลุ่มจับคู่บิลเองแบบเรียลไทม์ (ตั้งค่าผูกกลุ่มที่ Backoffice)':'Pair a LINE group with the shop → bank alerts auto-match bills in real time (pair in Backoffice)')]];
          return (<>
          <Lbl>{lang==='th'?'วิธีจับยอดพร้อมเพย์ (เลือกเปิด/ปิด)':'How to match PromptPay (toggle)'}</Lbl>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:6 }}>
            {rows.map(([k,ic,tt,ss])=>(
              <div key={k} style={{ display:'flex', alignItems:'center', gap:11, border:'1.5px solid '+(on(k)?'var(--brand)':'var(--hair-2)'), background:on(k)?'var(--brand-soft)':'#fff', borderRadius:12, padding:'11px 13px' }}>
                <span style={{ fontSize:20, flexShrink:0 }}>{ic}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:on(k)?'var(--brand-ink)':'var(--ink)' }}>{tt}</div>
                  <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:2, lineHeight:1.45 }}>{ss}</div>
                </div>
                <button onClick={()=>updBm(k)} aria-label="toggle" style={{ border:'none', background:'none', cursor:'pointer', padding:0, flexShrink:0 }}><Toggle on={on(k)}/></button>
              </div>
            ))}
          </div>
          <PayNotifyMode lang={lang}/>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'0 2px 16px', lineHeight:1.5 }}>💡 {lang==='th'?'เปิดได้หลายวิธีพร้อมกัน — หน้าสรุปวัน/ตรวจสลิปจะโชว์เฉพาะวิธีที่เปิดไว้ · ปิดหมด = ใช้ยืนยันเองอย่างเดียว':'Enable several at once — the day-summary shows only the methods you turn on · all off = manual confirm only'}</div>
          </>); })()}

        {/* ── เครื่องพิมพ์ / ใบเสร็จ ── */}
        {(()=>{ const pr=(f.print&&typeof f.print==='object')?f.print:{}; const updPr=(k,v)=>upd('print',{ mode:pr.mode||'ask', paper:pr.paper||'80', kitchenAuto:!!pr.kitchenAuto, [k]:v }); return (<>
        <Lbl>{lang==='th'?'ใบเสร็จเมื่อจบบิล':'Receipt when a bill is done'}</Lbl>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
          {[['ask', lang==='th'?'ถามทุกครั้ง':'Ask each time', lang==='th'?'จบบิลแล้วเปิดหน้าพิมพ์ให้กดพิมพ์เอง (ค่าเริ่มต้น)':'Opens the print sheet after each bill'],
            ['auto', lang==='th'?'พิมพ์อัตโนมัติ':'Auto-print', lang==='th'?'จบบิลแล้วส่งใบเสร็จไปเครื่องพิมพ์ทันที':'Sends the receipt to the printer automatically'],
            ['off', lang==='th'?'ไม่ออกใบเสร็จ':'No receipt', lang==='th'?'จบบิลแล้วไม่เปิดหน้าพิมพ์ (กดพิมพ์ย้อนหลังในหน้าออเดอร์ได้)':'Skips printing (you can still print later from the orders queue)']].map(([k,tt,ss])=>{ const on=(pr.mode||'ask')===k; return (
            <button key={k} onClick={()=>updPr('mode',k)} style={{ width:'100%', textAlign:'left', cursor:'pointer', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', borderRadius:12, padding:'11px 13px', fontFamily:'var(--font)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <span style={{ width:20, height:20, borderRadius:999, flexShrink:0, border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand)':'#fff', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:800 }}>{on?'✓':''}</span>
                <span style={{ fontSize:14, fontWeight:700, color:on?'var(--brand-ink)':'var(--ink)' }}>{tt}</span>
              </div>
              <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:5, marginLeft:29, lineHeight:1.45 }}>{ss}</div>
            </button>
          ); })}
        </div>
        <Lbl>{lang==='th'?'ขนาดกระดาษเริ่มต้น':'Default paper size'}</Lbl>
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          {[['58','58mm',lang==='th'?'ใบเล็ก':'Compact'],['80','80mm',lang==='th'?'ใบใหญ่':'Standard']].map(([k,l,d])=>{ const on=(pr.paper||'80')===k; return (
            <button key={k} onClick={()=>updPr('paper',k)} style={{ flex:1, cursor:'pointer', border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', color:on?'var(--brand-ink)':'var(--ink-2)', borderRadius:11, padding:'10px 8px', fontFamily:'var(--font)', fontWeight:700, fontSize:14 }}>{l}<div style={{ fontSize:11, fontWeight:500, opacity:.8, marginTop:1 }}>{d}</div></button>
          ); })}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700 }}>{lang==='th'?'พิมพ์บิลครัวอัตโนมัติ':'Auto-print kitchen bill'}</div>
            <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:2, lineHeight:1.45 }}>{lang==='th'?'จบบิลแล้วส่งบิลครัวไปเครื่องพิมพ์ทันที (แยกจากใบเสร็จ)':'Sends the kitchen ticket to the printer as soon as a bill is done'}</div>
          </div>
          <button onClick={()=>updPr('kitchenAuto',!pr.kitchenAuto)} aria-label="toggle" style={{ border:'none', background:'none', cursor:'pointer', padding:0, flexShrink:0 }}><Toggle on={!!pr.kitchenAuto}/></button>
        </div>
        <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'0 2px 18px', lineHeight:1.5 }}>💡 {lang==='th'?'ตั้งเครื่องพิมพ์ Bluetooth/USB ที่ระบบเครื่องก่อน แล้วเลือกเครื่องในหน้าต่างพิมพ์':'Pair your Bluetooth/USB printer in the device settings first, then pick it in the print dialog.'}</div>
        </>); })()}

        {/* ── VAT / ภาษีมูลค่าเพิ่ม ── */}
        <Lbl>{lang==='th'?'ภาษีมูลค่าเพิ่ม (VAT)':'VAT'}</Lbl>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:10 }}>
          {[['off', lang==='th'?'ไม่คิด VAT':'No VAT', lang==='th'?'ร้านไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม':'Shop not VAT-registered'],
            ['inclusive', lang==='th'?'ราคารวม VAT แล้ว':'VAT included', lang==='th'?'ราคาสินค้ารวมภาษีแล้ว · แสดงยอด VAT แยกในใบเสร็จ':'Prices include VAT · shown separately on receipt'],
            ['exclusive', lang==='th'?'บวก VAT เพิ่ม':'VAT added on top', lang==='th'?'บวก VAT ท้ายบิล (ราคายังไม่รวมภาษี)':'Adds VAT at the end of the bill']].map(([k,l,d])=>{ const on=(f.vatMode||'off')===k; return (
            <button key={k} onClick={()=>upd('vatMode',k)} className="kd-card" style={{ border:'2px solid '+(on?'var(--brand)':'transparent'), cursor:'pointer', textAlign:'left', padding:'12px 14px', boxShadow:'none', background:on?'var(--brand-soft)':'var(--bg)', fontFamily:'var(--font)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <span style={{ width:18, height:18, borderRadius:999, flexShrink:0, border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand)':'#fff', boxShadow:on?'inset 0 0 0 3px #fff':'none' }}/>
                <span style={{ fontSize:14.5, fontWeight:700, color:on?'var(--brand-ink)':'var(--ink)' }}>{l}</span>
              </div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:4, marginLeft:27, lineHeight:1.45 }}>{d}</div>
            </button>
          ); })}
        </div>
        {(f.vatMode && f.vatMode!=='off') ? (
          <div className="kd-card" style={{ padding:'14px 15px', marginBottom:16, background:'var(--bg)', boxShadow:'none' }}>
            <div style={{ fontSize:12, color:'var(--ink-3)', marginBottom:12, lineHeight:1.5 }}>{lang==='th'?'ข้อมูลตามกฎสรรพากร — จะพิมพ์บนใบกำกับภาษีอย่างย่อทุกใบ':'Per Revenue Dept. — printed on every abbreviated tax invoice'}</div>
            <div style={{ display:'flex', gap:12, marginBottom:12 }}>
              <div style={{ width:96 }}><Field label={lang==='th'?'อัตรา %':'Rate %'}><input className="kd-input num" type="number" value={f.vatRate==null?7:f.vatRate} onChange={e=>upd('vatRate', Number(e.target.value)||0)}/></Field></div>
              <div style={{ flex:1 }}><Field label={lang==='th'?'เลขประจำตัวผู้เสียภาษี (13 หลัก)':'Tax ID (13 digits)'}><input className="kd-input num" inputMode="numeric" maxLength={13} value={f.taxId||''} onChange={e=>upd('taxId', e.target.value.replace(/\D/g,''))} placeholder="0000000000000"/></Field></div>
            </div>
            <Field label={lang==='th'?'ที่อยู่ร้าน (ตามที่จดทะเบียน)':'Registered address'}><textarea className="kd-input" rows={2} value={f.taxAddr||''} onChange={e=>upd('taxAddr', e.target.value)} placeholder={lang==='th'?'บ้านเลขที่ / ถนน / ตำบล / อำเภอ / จังหวัด / รหัสไปรษณีย์':'Full address'} style={{ resize:'vertical', lineHeight:1.5 }}/></Field>
            <div style={{ height:12 }}/>
            <Field label={lang==='th'?'สำนักงานใหญ่ / สาขา':'Head office / branch'}><input className="kd-input" value={f.taxBranch||''} onChange={e=>upd('taxBranch', e.target.value)} placeholder={lang==='th'?'สำนักงานใหญ่ หรือ สาขาที่ 00001':'Head office / Branch 00001'}/></Field>
            <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:8, lineHeight:1.5 }}>{lang==='th'?'ระบุ “สำนักงานใหญ่” หรือ “สาขาที่ ...” ตามที่จดกับสรรพากร':'State “Head office” or “Branch …” as registered'}</div>
          </div>
        ) : null}
      </div>
      <div style={{ padding:'12px 20px 0' }}>
        <button onClick={()=>{ setPay(f); onClose(); }} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15 }}>{t('save')}</button>
      </div>
    </Sheet>
  );
}
function Toggle({ on }){
  return <span style={{ width:50, height:30, borderRadius:999, background: on?'var(--brand)':'#d2dad6', position:'relative', transition:'background .22s ease', flexShrink:0, display:'inline-block', boxShadow: on?'0 1px 4px rgba(31,138,78,.35)':'inset 0 0 0 1.5px rgba(0,0,0,.06)' }}>
    <span style={{ position:'absolute', top:3, left: on?23:3, width:24, height:24, borderRadius:999, background:'#fff', transition:'left .22s cubic-bezier(.4,1.3,.6,1)', boxShadow:'0 1px 3px rgba(0,0,0,.28), 0 0 1px rgba(0,0,0,.2)' }}/></span>;
}

/* members list */
const TIER = { gold:{th:'ทอง',en:'Gold',c:'#C79A2E',bg:'#FBF3DC'}, silver:{th:'เงิน',en:'Silver',c:'#8A949E',bg:'#EEF1F3'}, member:{th:'ทั่วไป',en:'Member',c:'var(--brand-ink)',bg:'var(--brand-soft)'} };
function MembersSheet({ members, pay, setPay, onClose }){
  const { t, lang } = useT(); const TH = lang!=='en';
  const sorted = members.slice().sort((a,b)=>b.points-a.points);
  const L = (pay && pay.loyalty) || {};
  const perBaht   = L.perBaht!=null   ? L.perBaht   : 25;
  const earnOn    = L.earnOn    || 'paid';
  const stampGoal = L.stampGoal!=null ? L.stampGoal : 10;
  const stampReward = L.stampReward || (TH?'ฟรี 1 เมนู':'Free item');
  const rewardAt  = L.rewardAt!=null  ? L.rewardAt  : 100;
  const rewardBaht = L.rewardBaht!=null ? L.rewardBaht : 20;
  const rewardText  = L.rewardText  || (TH?'ส่วนลด ฿20':'฿20 off');
  const tierSilver = L.tierSilver!=null ? L.tierSilver : 120;
  const tierGold = L.tierGold!=null ? L.tierGold : 300;
  const setL = (patch)=> setPay && setPay(p=>({ ...p, loyalty:{ ...(p.loyalty||{}), ...patch } }));
  const [cfg,setCfg] = m2State(false);
  const numInput = { width:64, border:'1.5px solid var(--hair-2)', borderRadius:9, padding:'7px 9px', fontFamily:'var(--font)', fontWeight:700, fontSize:14, textAlign:'center' };
  const txtInput = { flex:1, minWidth:0, border:'1.5px solid var(--hair-2)', borderRadius:9, padding:'7px 10px', fontFamily:'var(--font)', fontSize:13.5 };
  const EARN = [['paid',TH?'จ่ายเงิน':'Paid'],['accept',TH?'รับออเดอร์':'Accepted'],['delivered',TH?'ส่งสำเร็จ':'Delivered']];
  return (
    <Sheet open={true} onClose={onClose} height="90%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{TH?'สมาชิก · สะสมแต้ม':'Members · loyalty'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ padding:'0 20px 8px' }}>
        <button onClick={()=>setCfg(v=>!v)} className="kd-card" style={{ width:'100%', border:'none', cursor:'pointer', textAlign:'left', padding:'13px 15px', background:'var(--accent-soft)', boxShadow:'none', display:'flex', alignItems:'center', gap:9, fontFamily:'var(--font)' }}>
          <span style={{ color:'var(--accent)' }}>{React.cloneElement(IC.star,{size:16})}</span>
          <span style={{ flex:1, fontSize:13, color:'var(--accent-ink)', fontWeight:600 }}>{TH?`ได้แต้มตอน${(EARN.find(e=>e[0]===earnOn)||EARN[0])[1]} · ฿${perBaht}=1 แต้ม · สะสม ${stampGoal} ครั้ง`:`Earn on ${earnOn} · ฿${perBaht}/pt · ${stampGoal}× stamp`}</span>
          <span style={{ color:'var(--accent-ink)', fontWeight:700, fontSize:12.5 }}>{cfg?(TH?'ปิด':'Close'):(TH?'ตั้งเงื่อนไข':'Edit')}</span>
        </button>
        {cfg && <div className="kd-card" style={{ padding:'15px 16px', marginTop:9 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:7 }}>{TH?'ได้แต้ม/แสตมป์ตอนไหน':'Earn when'}</div>
          <div style={{ display:'flex', gap:7, marginBottom:14 }}>{EARN.map(([k,l])=>(
            <button key={k} onClick={()=>setL({ earnOn:k })} style={{ flex:1, border:'2px solid '+(earnOn===k?'var(--brand)':'var(--hair-2)'), background:earnOn===k?'var(--brand-soft)':'#fff', color:earnOn===k?'var(--brand-ink)':'var(--ink-2)', borderRadius:11, padding:'9px 4px', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>{l}</button>
          ))}</div>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:12 }}>
            <span style={{ fontSize:13.5 }}>{TH?'ทุกยอด ฿':'Every ฿'}</span>
            <input type="number" style={numInput} value={perBaht} onChange={e=>setL({ perBaht:Math.max(1,+e.target.value||1) })}/>
            <span style={{ fontSize:13.5 }}>{TH?'= 1 แต้ม':'= 1 pt'}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:9 }}>
            <span style={{ fontSize:13.5 }}>{TH?'สั่งครบ':'Every'}</span>
            <input type="number" style={numInput} value={stampGoal} onChange={e=>setL({ stampGoal:Math.max(1,+e.target.value||1) })}/>
            <span style={{ fontSize:13.5, whiteSpace:'nowrap' }}>{TH?'ครั้ง รับ':'× reward'}</span>
          </div>
          <input style={{ ...txtInput, width:'100%', marginBottom:12 }} value={stampReward} onChange={e=>setL({ stampReward:e.target.value })} placeholder={TH?'เช่น รับฟรี 1 เมนู':'e.g. Free item'}/>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:9 }}>
            <input type="number" style={numInput} value={rewardAt} onChange={e=>setL({ rewardAt:Math.max(1,+e.target.value||1) })}/>
            <span style={{ fontSize:13.5, whiteSpace:'nowrap' }}>{TH?'แต้ม → ส่วนลด ฿':'pts → ฿'}</span>
            <input type="number" style={numInput} value={rewardBaht} onChange={e=>setL({ rewardBaht:Math.max(0,+e.target.value||0) })}/>
          </div>
          <input style={{ ...txtInput, width:'100%', marginBottom:4 }} value={rewardText} onChange={e=>setL({ rewardText:e.target.value })} placeholder={TH?'คำอธิบายรางวัล เช่น ส่วนลด ฿20':'e.g. ฿20 off'}/>
          <div style={{ display:'flex', alignItems:'center', gap:9, margin:'12px 0 4px' }}>
            <span style={{ fontSize:13.5, whiteSpace:'nowrap' }}>{TH?'ระดับ เงิน ≥':'Silver ≥'}</span>
            <input type="number" style={numInput} value={tierSilver} onChange={e=>setL({ tierSilver:Math.max(0,+e.target.value||0) })}/>
            <span style={{ fontSize:13.5, whiteSpace:'nowrap' }}>{TH?'· ทอง ≥':'· Gold ≥'}</span>
            <input type="number" style={numInput} value={tierGold} onChange={e=>setL({ tierGold:Math.max(0,+e.target.value||0) })}/>
            <span style={{ fontSize:12.5, color:'var(--ink-3)' }}>{TH?'แต้ม':'pts'}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:9, margin:'14px 0 4px', flexWrap:'wrap' }}>
            <span style={{ fontSize:13.5, whiteSpace:'nowrap', fontWeight:700 }}>{TH?'ส่วนลดตามระดับ · เงิน':'Tier discount · Silver'}</span>
            <input type="number" style={numInput} value={(L.tierDisc&&L.tierDisc.silver)!=null?L.tierDisc.silver:5} onChange={e=>setL({ tierDisc:{ ...(L.tierDisc||{}), silver:Math.max(0,Math.min(100,+e.target.value||0)) } })}/>
            <span style={{ fontSize:13.5 }}>% · {TH?'ทอง':'Gold'}</span>
            <input type="number" style={numInput} value={(L.tierDisc&&L.tierDisc.gold)!=null?L.tierDisc.gold:10} onChange={e=>setL({ tierDisc:{ ...(L.tierDisc||{}), gold:Math.max(0,Math.min(100,+e.target.value||0)) } })}/>
            <span style={{ fontSize:13.5 }}>%</span>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:9, marginTop:8, cursor:'pointer' }}>
            <input type="checkbox" checked={L.discStack!==false} onChange={e=>setL({ discStack:e.target.checked })} style={{ width:17, height:17, accentColor:'var(--brand)' }}/>
            <span style={{ fontSize:12.5, color:'var(--ink-2)' }}>{TH?'ใช้ส่วนลดระดับ + แลกแต้ม พร้อมกันได้':'Allow tier discount + points redeem together'}</span>
          </label>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', lineHeight:1.5, marginTop:4 }}>{TH?'ส่วนลดตามระดับหักอัตโนมัติเมื่อผูกสมาชิกที่จบบิล — ใช้ได้ทั้งหน้าขายและลิงก์ลูกค้า · เงื่อนไขนี้แสดงบนบัตรสมาชิกฝั่งลูกค้า':'Tier discount auto-applies when a member is attached — on Sell and the customer link.'}</div>
        </div>}
      </div>
      <div style={{ overflowY:'auto', padding:'10px 20px 0', flex:1 }}>
        {sorted.length===0 && <div style={{ fontSize:13, color:'var(--ink-3)', background:'var(--bg)', borderRadius:12, padding:'18px', textAlign:'center' }}>{TH?'ยังไม่มีสมาชิก — ลูกค้าที่สั่งผ่าน LINE จะถูกเพิ่มอัตโนมัติ':'No members yet — LINE customers are added automatically'}</div>}
        {sorted.map(m=>{ const ti=TIER[m.tier]||TIER.member; return (
          <div key={m.id} className="kd-card" style={{ padding:'13px 14px', marginBottom:9, display:'flex', alignItems:'center', gap:12, boxShadow:'none', background:'var(--bg)' }}>
            <div style={{ width:42, height:42, borderRadius:999, background:ti.bg, color:ti.c, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16 }}>{(m.name||'?').charAt(0)}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14.5, fontWeight:600 }}>{m.name}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)' }}><span style={{ color:ti.c, fontWeight:700 }}>{ti[lang]||ti.th}</span> · {TH?`ซื้อ ${m.visits} ครั้ง`:`${m.visits} visits`}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div className="num" style={{ fontWeight:700, fontSize:16, color:'var(--accent)' }}>{m.points}</div>
              <div style={{ fontSize:11, color:'var(--ink-3)' }}>{TH?'แต้ม':'pts'}</div>
            </div>
          </div>
        );})}
      </div>
    </Sheet>
  );
}

/* ── ingredient costing: buy in bulk, use a little per dish ── */
const ING_UNITS = [
  { id:'kg',  th:'กก.',  en:'kg',  base:1000, fam:'w' },
  { id:'g',   th:'กรัม', en:'g',   base:1,    fam:'w' },
  { id:'l',   th:'ลิตร', en:'L',   base:1000, fam:'v' },
  { id:'ml',  th:'มล.',  en:'ml',  base:1,    fam:'v' },
  { id:'pcs', th:'ชิ้น', en:'pcs', base:1,    fam:'c' },
];
const ING_FAMS = [
  { id:'w', use:'g'   },
  { id:'v', use:'ml'  },
  { id:'c', use:'pcs' },
];
const ingUnit = (id)=> ING_UNITS.find(u=>u.id===id) || ING_UNITS[0];
function bulkCost(ing){
  const bu = ingUnit(ing.buyUnit), uu = ingUnit(ing.useUnit);
  const buyBase = (Number(ing.buyQty)||0) * bu.base;
  const useBase = (Number(ing.useQty)||0) * uu.base;
  if(buyBase<=0) return 0;
  return (Number(ing.buyPrice)||0) / buyBase * useBase;
}
const ingCost = (ing)=> ing && ing.mode==='bulk' ? bulkCost(ing) : (Number(ing && ing.cost)||0);
function IngModePill({ on, onClick, children }){
  return <button onClick={onClick} style={{ border:'none', cursor:'pointer', fontFamily:'var(--font)',
    fontWeight:700, fontSize:12, padding:'6px 11px', borderRadius:999,
    background: on?'var(--brand)':'#fff', color: on?'#fff':'var(--ink-3)',
    boxShadow: on?'none':'inset 0 0 0 1.5px var(--hair-2)' }}>{children}</button>;
}
const ING_SEL = { fontFamily:'var(--font)', border:'1.5px solid var(--hair-2)', borderRadius:10, padding:'8px 5px', fontSize:13, background:'#fff', color:'var(--ink)', fontWeight:600, cursor:'pointer' };

/* per-item modifiers preset */
const MOD_PRESETS = [
  { name:'ความเผ็ด', nameEn:'Spice', multi:false, choices:[['ไม่เผ็ด','No spice'],['เผ็ดน้อย','Mild'],['เผ็ดกลาง','Medium'],['เผ็ดมาก','Hot']] },
  { name:'ความหวาน', nameEn:'Sweetness', multi:false, choices:[['หวานน้อย','Less'],['หวานปกติ','Normal'],['หวานมาก','Extra']] },
  { name:'ร้อน / เย็น', nameEn:'Temp', multi:false, choices:[['ร้อน','Hot'],['เย็น','Iced'],['ปั่น','Blended']] },
  { name:'ขนาด', nameEn:'Size', multi:false, choices:[['ธรรมดา','Regular',0],['พิเศษ','Large',10]] },
  { name:'ท็อปปิ้ง', nameEn:'Topping', multi:true, choices:[['เพิ่มไข่ดาว','Fried egg',10],['ชีส','Cheese',15],['ไข่เค็ม','Salted egg',10]] },
];
function ModifiersEditor({ options, onChange, lang }){
  const TH = lang==='th';
  const groups = options||[];
  const addGroup = (preset)=>{ const g = preset
    ? { id:'g'+Date.now(), name: TH?preset.name:preset.nameEn, multi:!!preset.multi, choices:preset.choices.map(c=>({ label: TH?c[0]:(c[1]||c[0]), price: c[2]||0 })) }
    : { id:'g'+Date.now(), name:'', multi:false, choices:[{ label:'', price:0 }] };
    onChange([...groups, g]); };
  const updGroup = (gi, patch)=> onChange(groups.map((g,i)=>i===gi?{...g,...patch}:g));
  const delGroup = (gi)=> onChange(groups.filter((_,i)=>i!==gi));
  const addChoice = (gi)=> updGroup(gi, { choices:[...groups[gi].choices, { label:'', price:0 }] });
  const updChoice = (gi, ci, patch)=> updGroup(gi, { choices:groups[gi].choices.map((c,i)=>i===ci?{...c,...patch}:c) });
  const delChoice = (gi, ci)=> updGroup(gi, { choices:groups[gi].choices.filter((_,i)=>i!==ci) });
  const usedNames = groups.map(g=>g.name);
  return (
    <div className="kd-card" style={{ padding:'13px 15px', boxShadow:'none', background:'var(--bg)', marginBottom:14 }}>
      <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>🧩 {TH?'ตัวเลือกสินค้า':'Options'}</div>
      <div style={{ fontSize:12, color:'var(--ink-3)', marginBottom:11, lineHeight:1.5 }}>{TH?'เช่น ความเผ็ด · หวาน · ไซซ์ · ท็อปปิ้ง (ใส่ราคาเพิ่มได้) — ลูกค้าเลือกตอนสั่ง':'e.g. spice · sweetness · size · toppings (with extra price) — chosen at order time'}</div>
      {groups.map((g,gi)=>(
        <div key={g.id||gi} style={{ background:'#fff', borderRadius:12, padding:'11px 12px', marginBottom:9, boxShadow:'var(--shadow)' }}>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:9 }}>
            <input className="kd-input" style={{ flex:1, padding:'8px 11px', fontWeight:700 }} value={g.name} onChange={e=>updGroup(gi,{name:e.target.value})} placeholder={TH?'ชื่อกลุ่ม เช่น ความเผ็ด':'Group e.g. Spice'}/>
            <button onClick={()=>updGroup(gi,{multi:!g.multi})} title={TH?'เลือกหลายอย่าง':'Multi-select'} style={{ border:'none', cursor:'pointer', borderRadius:9, padding:'7px 10px', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, background:g.multi?'var(--brand-soft)':'var(--bg)', color:g.multi?'var(--brand-ink)':'var(--ink-3)' }}>{g.multi?(TH?'เลือกได้หลาย':'Multi'):(TH?'เลือก 1':'Single')}</button>
            <button onClick={()=>delGroup(gi)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-3)', padding:4 }}>{React.cloneElement(IC.x,{size:16})}</button>
          </div>
          {g.choices.map((c,ci)=>(
            <div key={ci} style={{ display:'flex', gap:7, alignItems:'center', marginBottom:6 }}>
              <input className="kd-input" style={{ flex:1, padding:'7px 10px' }} value={c.label} onChange={e=>updChoice(gi,ci,{label:e.target.value})} placeholder={TH?'ตัวเลือก':'Choice'}/>
              <div style={{ position:'relative', width:92 }}>
                <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontSize:12 }}>+฿</span>
                <input className="kd-input num" style={{ padding:'7px 8px 7px 26px' }} type="number" value={c.price||''} onChange={e=>updChoice(gi,ci,{price:Number(e.target.value)||0})} placeholder="0"/>
              </div>
              <button onClick={()=>delChoice(gi,ci)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-3)', padding:3 }}>{React.cloneElement(IC.x,{size:14})}</button>
            </div>
          ))}
          <button onClick={()=>addChoice(gi)} style={{ border:'none', cursor:'pointer', background:'var(--brand-soft)', color:'var(--brand-ink)', fontFamily:'var(--font)', fontWeight:700, fontSize:12, padding:'5px 10px', borderRadius:999, marginTop:2 }}>+ {TH?'ตัวเลือก':'Choice'}</button>
        </div>
      ))}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
        {MOD_PRESETS.filter(p=>!usedNames.includes(TH?p.name:p.nameEn)).map((p,i)=>(
          <button key={i} onClick={()=>addGroup(p)} style={{ border:'1.5px dashed var(--hair-2)', cursor:'pointer', background:'#fff', color:'var(--ink-2)', fontFamily:'var(--font)', fontWeight:600, fontSize:12.5, padding:'7px 12px', borderRadius:999 }}>+ {TH?p.name:p.nameEn}</button>
        ))}
        <button onClick={()=>addGroup(null)} style={{ border:'none', cursor:'pointer', background:'var(--ink)', color:'#fff', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, padding:'7px 12px', borderRadius:999 }}>+ {TH?'กลุ่มเอง':'Custom'}</button>
      </div>
    </div>
  );
}

/* ══════════════ SALE MODE MASTER (แหล่งเดียว — ใช้ทุกเมนู/หน้าขาย/สรุป) ══════════════ */
/* ── แนวโน้มยอดขายรายวัน · เส้นคู่ (ยอดขาย/เงินเข้าจริง) — แบบเดียวกับ Backoffice (date-lock) ── */
function DailyTrend({ salesAll, lang }){
  const TH = lang==='th';
  const N=14; const today=new Date();
  const days=[]; for(let i=N-1;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); days.push(d.toISOString().slice(0,10)); }
  const rev={}, cash={};
  (salesAll||[]).forEach(s=>{ if(s.void) return; const tt=saleTotal(s); if(s.date!=null) rev[s.date]=(rev[s.date]||0)+tt;
    const b=(typeof saleBookable==='function')?saleBookable(s):tt; if(b!=null){ const cd=s.settleDate||s.date; if(cd!=null) cash[cd]=(cash[cd]||0)+b; } });
  const rv=days.map(d=>Math.round(rev[d]||0)); const cv=days.map(d=>Math.round(cash[d]||0));
  const max=Math.max(1,...rv,...cv);
  const W=300,H=118,PB=16,PT=8,PL=4,PR=4; const iw=W-PL-PR, ih=H-PT-PB;
  const x=i=>PL+(days.length<=1?iw/2:i/(days.length-1)*iw);
  const y=v=>PT+ih-(v/max*ih);
  const path=(arr)=>arr.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
  const area=path(rv)+` L${x(days.length-1).toFixed(1)} ${(PT+ih).toFixed(1)} L${x(0).toFixed(1)} ${(PT+ih).toFixed(1)} Z`;
  const fmt=(d)=>{ const p=(d||'').split('-'); return p.length===3?(p[2]+'/'+p[1]):d; };
  const ticks=[0, Math.floor((days.length-1)/2), days.length-1];
  const hasData = rv.some(v=>v>0) || cv.some(v=>v>0);
  return (<div className="kd-card" style={{ padding:'16px', marginBottom:14 }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, flexWrap:'wrap', gap:8 }}>
      <div style={{ fontWeight:700, fontSize:15 }}>{TH?'แนวโน้มยอดขายรายวัน':'Daily sales trend'} <span style={{ fontSize:11.5, fontWeight:600, color:'var(--ink-3)' }}>· {N} {TH?'วัน':'days'}</span></div>
      <div style={{ display:'flex', gap:12, fontSize:11 }}>
        <span style={{ display:'flex', alignItems:'center', gap:5, color:'var(--ink-3)' }}><span style={{ width:15, height:3, borderRadius:2, background:'#0E9463', display:'inline-block' }}/>{TH?'ยอดขาย':'Sales'}</span>
        <span style={{ display:'flex', alignItems:'center', gap:5, color:'var(--ink-3)' }}><span style={{ width:15, height:0, borderTop:'2px dashed #1E73B0', display:'inline-block' }}/>{TH?'เงินเข้าจริง':'Cash-in'}</span>
      </div>
    </div>
    {hasData ? <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block' }}>
      <path d={area} fill="rgba(14,148,99,.12)" stroke="none"/>
      <path d={path(rv)} fill="none" stroke="#0E9463" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      <path d={path(cv)} fill="none" stroke="#1E73B0" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round"/>
      {ticks.map(i=><text key={i} x={x(i)} y={H-3} fontSize="9" fill="#9aa1aa" textAnchor="middle" fontFamily="var(--font)">{fmt(days[i])}</text>)}
    </svg> : <div style={{ padding:'26px 0', textAlign:'center', color:'var(--ink-3)', fontSize:12.5 }}>{TH?'ยังไม่มียอดขายใน 14 วันล่าสุด':'No sales in the last 14 days'}</div>}
    <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:6, lineHeight:1.5 }}>{TH?'เส้นทึบ = ยอดขาย (วันลูกค้าสั่ง) · เส้นประ = เงินเข้าบัญชีจริง (แพลตฟอร์มโอนทีหลัง)':'Solid = sales (order date) · dashed = actual cash-in'}</div>
  </div>);
}
function GpEditor({ k, chanCfg, setChannelGp, TH }){
  const cur=(chanCfg&&chanCfg.gp&&chanCfg.gp[k])||(chanCfg&&chanCfg.custom&&chanCfg.custom[k])||{};
  const [gp,setGp]=m2State(cur.gp!=null&&Number(cur.gp)>0?String(cur.gp):'');
  const [vat,setVat]=m2State(!!cur.vatOnGp);
  const commit=(g,v)=> setChannelGp(k,{ gp:Number(g)||0, vatOnGp:v });
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 0 12px 22px', flexWrap:'wrap' }}>
      <span style={{ fontSize:12, color:'var(--ink-3)', fontWeight:600 }}>{TH?'ค่า GP':'GP'}</span>
      <div style={{ position:'relative', width:86 }}>
        <input className="kd-input num" inputMode="decimal" value={gp} onChange={e=>{ const v=e.target.value.replace(/[^0-9.]/g,''); setGp(v); commit(v,vat); }} placeholder="0" style={{ padding:'7px 22px 7px 10px', fontSize:13 }}/>
        <span style={{ position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontSize:12, fontWeight:700 }}>%</span>
      </div>
      <button onClick={()=>{ const nv=!vat; setVat(nv); commit(gp,nv); }} style={{ border:'1.5px solid '+(vat?'var(--brand)':'var(--hair-2)'), background:vat?'var(--brand-soft)':'#fff', color:vat?'var(--brand-ink)':'var(--ink-3)', borderRadius:9, padding:'6px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>{vat?'✓ ':''}VAT 7% {TH?'ของ GP':'on GP'}</button>
    </div>
  );
}
function ManageSaleModesSheet({ chanCfg, toggleSaleMode, removeSaleMode, setChannelGp, onAdd, onClose }){
  const { lang } = useT(); const TH = lang!=='en';
  const all = allSaleModes(chanCfg);
  const isOn = (k)=> !(chanCfg && chanCfg.off && chanCfg.off[k]);
  const isCustom = (k)=> !!(chanCfg && chanCfg.custom && chanCfg.custom[k]);
  const inStore = all.filter(k=> !chMeta(chanCfg,k).online);
  const online  = all.filter(k=> chMeta(chanCfg,k).online);
  const Row = ({k})=>{ const m=chMeta(chanCfg,k); const on=isOn(k); return (
    <div style={{ borderBottom:'1px solid var(--hair)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 0' }}>
        <span style={{ width:11, height:11, borderRadius:999, background:m.c||'var(--brand)', flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:14.5, fontWeight:600, color:on?'var(--ink)':'var(--ink-3)' }}>{m[lang]||m.th}</div>{m.online && <div style={{ fontSize:11, color:'var(--ink-3)' }}>{TH?'รับเงินทีหลัง (แพลตฟอร์ม)':'Paid later (platform)'}</div>}</div>
        {isCustom(k) && <button onClick={()=>{ if(window.confirm(TH?`ลบช่องทาง “${m.th}”?`:`Delete “${m.en||m.th}”?`)) removeSaleMode&&removeSaleMode(k); }} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-3)', padding:4 }}>{React.cloneElement(IC.x,{size:16})}</button>}
        <button onClick={()=>toggleSaleMode&&toggleSaleMode(k, !on)} style={{ border:'none', background:'none', cursor:'pointer', padding:0 }}><Toggle on={on}/></button>
      </div>
      {m.online && on && setChannelGp && <GpEditor k={k} chanCfg={chanCfg} setChannelGp={setChannelGp} TH={TH}/>}
    </div>
  ); };
  return (
    <Sheet open={true} onClose={onClose} height="88%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 8px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{TH?'ช่องทางขาย':'Sale channels'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        <div style={{ fontSize:12.5, color:'var(--ink-3)', marginBottom:12, lineHeight:1.5 }}>{TH?'เพิ่ม/เปิด-ปิดที่นี่ครั้งเดียว → ใช้กับทุกเมนู หน้าขาย สรุป และปิดวัน · ปิด = ไม่โผล่ในหน้าขาย':'Add/toggle once here → applies to every item, the sell screen, reports and close-day · off = hidden on the sell screen'}</div>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-2)', margin:'4px 2px 2px' }}>{TH?'ในร้าน (รับเงินทันที)':'In-store (paid now)'}</div>
        {inStore.map(k=><Row key={k} k={k}/>)}
        <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-2)', margin:'16px 2px 2px' }}>{TH?'แพลตฟอร์ม / เดลิเวอรี (รับเงินทีหลัง)':'Platforms / delivery (paid later)'}</div>
        {setChannelGp && <div style={{ fontSize:11, color:'var(--ink-3)', margin:'2px 2px 4px', lineHeight:1.45 }}>{TH?'ตั้ง GP% + VAT ต่อช่องทาง — ระบบใช้คิดยอดที่ควรได้รับในหน้ากระทบยอด/ยืนยันยอด':'Set GP% + VAT per channel — used to compute the expected net on the reconcile screen'}</div>}
        {online.length? online.map(k=><Row key={k} k={k}/>) : <div style={{ fontSize:12.5, color:'var(--ink-3)', padding:'10px 0' }}>{TH?'ยังไม่มี — กด “เพิ่มช่องทาง”':'None yet — tap “Add channel”'}</div>}
      </div>
      <div style={{ padding:'12px 20px 0' }}>
        <button onClick={onAdd} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15 }}>{React.cloneElement(IC.plus,{size:16})} {TH?'เพิ่มช่องทางขาย':'Add channel'}</button>
      </div>
    </Sheet>
  );
}
function AddSaleModeSheet({ onClose, onAdd }){
  const { lang } = useT(); const TH = lang!=='en';
  const [th,setTh] = m2State(''); const [en,setEn] = m2State('');
  const [online,setOnline] = m2State(false);
  const [gp,setGp] = m2State('');
  const [vatGp,setVatGp] = m2State(false);
  const SW = ['#0E9463','#3B82C4','#8257C4','#D70F64','#EE4D2D','#00B14F','#E0A400','#57635C'];
  const [c,setC] = m2State(SW[0]);
  const save=()=>{ const name=th.trim(); if(!name) return; const key='c'+Date.now().toString(36); const pfSrc=(en.trim()||name); onAdd&&onAdd({ key, th:name, en:(en.trim()||name), c, prefix:(pfSrc[0]||'Q').toUpperCase(), online, gp: online?(Number(gp)||0):0, vatOnGp: online?vatGp:false }); };
  return (
    <Sheet open={true} onClose={onClose} height="82%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{TH?'เพิ่มช่องทางขาย':'Add sale channel'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        <Lbl>{TH?'ชื่อช่องทาง (ไทย)':'Name (Thai)'}</Lbl>
        <input className="kd-input" value={th} onChange={e=>setTh(e.target.value)} placeholder={TH?'เช่น Robinhood, TrueMoney, หน้าบูธ':'e.g. Robinhood, booth'} autoFocus style={{ marginBottom:12 }}/>
        <Lbl>{TH?'ชื่อภาษาอังกฤษ (ไม่บังคับ)':'Name (English, optional)'}</Lbl>
        <input className="kd-input" value={en} onChange={e=>setEn(e.target.value)} placeholder="e.g. Robinhood" style={{ marginBottom:14 }}/>
        <Lbl>{TH?'สี':'Colour'}</Lbl>
        <div style={{ display:'flex', flexWrap:'wrap', gap:9, marginBottom:16 }}>
          {SW.map(x=>(<button key={x} onClick={()=>setC(x)} style={{ width:34, height:34, borderRadius:999, background:x, cursor:'pointer', border: c===x?'3px solid var(--ink)':'3px solid transparent' }}/>))}
        </div>
        <div className="kd-card" style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 15px', boxShadow:'none', background:'var(--bg)' }} onClick={()=>setOnline(!online)}>
          <span style={{ color:'var(--brand)' }}>{React.cloneElement(IC.moto,{size:20})}</span>
          <div style={{ flex:1 }}><div style={{ fontSize:14.5, fontWeight:600 }}>{TH?'รับเงินทีหลัง (แพลตฟอร์ม)':'Paid later (platform)'}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.45 }}>{TH?'เปิด = ลงเป็นยอดค้างรับ (โอนทีหลัง) เช่น Grab/LINE MAN · ปิด = รับเงินทันที เช่น หน้าร้าน':'On = payout later (Grab/LINE MAN) · Off = paid immediately'}</div></div>
          <Toggle on={online}/>
        </div>
        {online && <div style={{ marginTop:14 }}>
          <Lbl>{TH?'ค่า GP / คอมมิชชัน (%)':'GP / commission (%)'}</Lbl>
          <div style={{ position:'relative' }}>
            <input className="kd-input num" inputMode="decimal" value={gp} onChange={e=>setGp(e.target.value.replace(/[^0-9.]/g,''))} placeholder={TH?'เช่น 30':'e.g. 30'} style={{ paddingRight:32 }}/>
            <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontWeight:700 }}>%</span>
          </div>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'6px 2px 0', lineHeight:1.5 }}>{TH?'ระบบจะหักออกจากยอดขายอัตโนมัติตอนรับยอด (เช่น Grab 30% · LINE MAN 32%) — ยอดค้างรับจะโชว์ยอดหลังหัก GP ให้ ตรวจกับที่แพลตฟอร์มโอนจริงได้':'Deducted automatically at settlement — receivable shows the net-of-GP amount.'}</div>
          <div className="kd-card" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', boxShadow:'none', background:'var(--bg)', marginTop:12 }} onClick={()=>setVatGp(!vatGp)}>
            <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:600 }}>{TH?'คิด VAT 7% ของค่า GP':'Add 7% VAT on GP'}</div>
              <div style={{ fontSize:11.5, color:'var(--ink-3)', lineHeight:1.45 }}>{TH?'แพลตฟอร์มส่วนใหญ่คิด VAT 7% บนค่าคอมมิชชัน — เปิดเพื่อคำนวณยอดโอนสุทธิให้แม่นขึ้น':'Most platforms add 7% VAT on the commission'}</div></div>
            <Toggle on={vatGp}/>
          </div>
        </div>}
      </div>
      <div style={{ padding:'12px 20px 0' }}>
        <button onClick={save} disabled={!th.trim()} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15, opacity:th.trim()?1:.5 }}>{TH?'เพิ่มช่องทาง':'Add channel'}</button>
      </div>
    </Sheet>
  );
}

function ItemEditor({ item, onSave, onClose, onDelete, costMode, raw, addRaw, chanCfg, addSaleMode, toggleSaleMode, removeSaleMode }){
  const { t, lang } = useT();
  const TH = lang==='th';
  const [addModeOpen,setAddModeOpen] = m2State(false);
  const [manageOpen,setManageOpen] = m2State(false);
  const cats = useCats();
  const [f,setF] = m2State({ ...item });
  const [perCh,setPerCh] = m2State(!!(item.priceByCh && Object.keys(item.priceByCh).length));
  const [consignList,setConsignList] = m2State([]);
  React.useEffect(()=>{ if(typeof window!=='undefined' && window.KD_API && window.KD_API.listConsignStock){ window.KD_API.listConsignStock().then(r=>{ if(Array.isArray(r)) setConsignList(r); }).catch(()=>{}); } },[]);
  const isNew = !MENU.some(m=>m.id===item.id) && !item.th;
  const bom = f.bom||[];
  const bomTotal = bom.reduce((a,i)=>a+ingCost(i),0);
  const recipe = f.recipe||[];
  const recipeTotal = recipe.reduce((a,ln)=>{ const r=rawById(raw,ln[0]); return a+(r?(Number(r.avgCost)||0)*(Number(ln[1])||0):0); },0);
  // per-item costing method (hybrid): 'flat' = ต้นทุน/จาน (BOM) · 'recipe' = คิดจากสูตร+ตัดสต๊อก
  const method = f.costMethod || (recipe.length?'recipe':'flat');
  const setMethod=(m)=>setF(p=>({...p, costMethod:m }));
  const stock = method==='recipe';
  const hasBd = stock ? recipe.length : bom.length;
  const bdTotal = stock ? recipeTotal : bomTotal;
  const effCost = hasBd ? bdTotal : (f.cost||0);
  const pf = (f.price||0)-effCost;
  const mg = f.price? Math.round(pf/f.price*100):0;
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const recost=(arr)=>arr.reduce((a,i)=>a+ingCost(i),0);
  const setBom=(arr)=>setF(p=>({...p, bom:arr, cost: arr.length?recost(arr):p.cost }));
  const addIng=()=>setBom([...bom,{ name:'', cost:0 }]);
  const updIng=(i,k,v)=>setBom(bom.map((x,j)=>j===i?{...x,[k]:v}:x));
  const setMode=(i,mode)=>setBom(bom.map((x,j)=>j!==i?x:(mode==='bulk'
    ? { ...x, mode:'bulk', buyQty:x.buyQty||1, buyUnit:x.buyUnit||'kg', buyPrice:x.buyPrice||'', useQty:x.useQty||'', useUnit:x.useUnit||'g' }
    : { ...x, mode:'flat' })));
  const changeBuyUnit=(i,uid)=>setBom(bom.map((x,j)=>{ if(j!==i) return x;
    const nf=ingUnit(uid).fam, of=ingUnit(x.buyUnit||'kg').fam;
    const nu = nf!==of ? (ING_FAMS.find(fm=>fm.id===nf)||{}).use : x.useUnit;
    return {...x, buyUnit:uid, useUnit:nu||x.useUnit }; }));
  const delIng=(i)=>setBom(bom.filter((_,j)=>j!==i));
  const TONES=['#F4E7D2','#F6DED4','#FBF0C9','#E6F2D9','#F7E3EC','#E3D3C4'];
  return (
    <React.Fragment>
    <Sheet open={true} onClose={onClose} height="92%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{isNew?(lang==='th'?'สร้างปุ่มเมนู':'New item'):(lang==='th'?'แก้ไขเมนู':'Edit item')}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:16 }}>
          <label style={{ position:'relative', cursor:'pointer', flexShrink:0 }}>
            <FoodTile item={f} size={70} radius={16}/>
            <span style={{ position:'absolute', right:-4, bottom:-4, width:26, height:26, borderRadius:999, background:'var(--brand)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--shadow)', border:'2px solid #fff' }}>{React.cloneElement(IC.scan,{size:13})}</span>
            <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ const file=e.target.files&&e.target.files[0]; if(!file)return; const r=new FileReader(); r.onload=ev=>upd('img',ev.target.result); r.readAsDataURL(file); }}/>
          </label>
          <div style={{ flex:1 }}>
            <Field label={lang==='th'?'ชื่อเมนู':'Name'}><input className="kd-input" value={f.th} onChange={e=>upd('th',e.target.value)} placeholder={lang==='th'?'เช่น ข้าวกะเพรา':'e.g. Basil rice'}/></Field>
            {f.img
              ? <button onClick={()=>upd('img',null)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--danger)', fontFamily:'var(--font)', fontSize:12.5, fontWeight:600, marginTop:6, padding:0 }}>{lang==='th'?'ลบรูป':'Remove photo'}</button>
              : <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:6 }}>{lang==='th'?'แตะรูปเพื่ออัปโหลดภาพสินค้า':'Tap image to upload a photo'}</div>}
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <Lbl>{lang==='th'?'หมวดหมู่':'Category'}</Lbl>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
            {cats.map(c=>(<button key={c.id} onClick={()=>upd('cat',c.id)} style={{ border:'none', cursor:'pointer',
              padding:'8px 13px', borderRadius:999, fontFamily:'var(--font)', fontWeight:600, fontSize:13,
              background: f.cat===c.id?'var(--brand)':'var(--bg)', color: f.cat===c.id?'#fff':'var(--ink-2)' }}>{c.emoji} {c[lang]||c.th}</button>))}
          </div>
        </div>
        <div style={{ display:'flex', gap:12, marginBottom:14 }}>
          <div style={{ flex:1 }}><Field label={t('price')}><NumInput value={f.price} onChange={v=>upd('price',v)}/></Field></div>
          <div style={{ flex:1 }}><Field label={hasBd?(stock?(lang==='th'?'ต้นทุน (จากสูตร)':'Cost (from recipe)'):(lang==='th'?'ต้นทุน (รวมวัตถุดิบ)':'Cost (from BOM)')):t('cost')}>
            {hasBd
              ? <div className="kd-input num" style={{ background:'var(--bg)', color:'var(--ink-2)', display:'flex', alignItems:'center' }}>฿{bdTotal.toLocaleString('en-US',{maximumFractionDigits:2})}</div>
              : <NumInput value={f.cost} onChange={v=>upd('cost',v)}/>}
          </Field></div>
        </div>

        {/* channels this item sells on (+ optional per-channel price) */}
        <div style={{ marginBottom:14 }}>
          <Lbl>{TH?'ช่องทางที่ขายเมนูนี้ · ราคาต่อช่องทาง':'Channels & price'}</Lbl>
          <div style={{ fontSize:12, color:'var(--ink-3)', margin:'-2px 2px 8px', lineHeight:1.45 }}>{TH?'ติ๊กช่องทางที่ขายเมนูนี้ — ไม่ติ๊กเลย = ขายทุกช่องทาง':'Tick channels to sell on — none = all'}</div>
          {/* price mode: one price for all channels (default) vs per-channel */}
          <div style={{ padding:'12px', marginBottom:8, borderRadius:12, background:'var(--bg)' }}>
            <div style={{ fontSize:13.5, fontWeight:700, marginBottom:8 }}>{TH?'ราคาขายแต่ละช่องทาง':'Channel pricing'}</div>
            <div style={{ display:'flex', gap:6, background:'#fff', borderRadius:10, padding:4, border:'1px solid var(--hair-2)' }}>
              {[[false, TH?'ราคาเดียวทุกช่องทาง':'One price'],[true, TH?'แยกแต่ละช่องทาง':'Per channel']].map(([v,l])=>(
                <button key={String(v)} onClick={()=>{ if(v) setPerCh(true); else { upd('priceByCh',{}); setPerCh(false); } }}
                  style={{ flex:1, cursor:'pointer', border:'none', borderRadius:8, padding:'10px 6px', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5,
                    background: perCh===v?'var(--brand)':'transparent', color: perCh===v?'#fff':'var(--ink-2)', transition:'background .15s' }}>{l}</button>
              ))}
            </div>
            <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:7, lineHeight:1.4 }}>{perCh?(TH?'กรอกราคาแยกแต่ละช่องทางด้านล่าง · เว้นว่าง = ใช้ราคาหลัก ฿'+(f.price||0):'Set price per channel below · blank = ฿'+(f.price||0)):(TH?'ทุกช่องทางใช้ราคาหลักเดียวกัน ฿'+(f.price||0):'All channels use ฿'+(f.price||0))}</div>
          </div>
          {activeSaleModes(chanCfg).map(k=>{ const m=chMeta(chanCfg,k); const chs=f.channels||[]; const on = chs.length? chs.indexOf(k)>=0 : true; const explicit=chs.length>0;
            const toggle=()=>{ let cur = explicit ? chs.slice() : activeSaleModes(chanCfg).slice(); const i=cur.indexOf(k); if(i>=0) cur.splice(i,1); else cur.push(k); upd('channels', cur); };
            const pv = (f.priceByCh && f.priceByCh[k]!=null) ? f.priceByCh[k] : '';
            return (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 2px', borderBottom:'1px solid var(--hair)' }}>
                <button onClick={toggle} style={{ width:24, height:24, borderRadius:7, flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:on?m.c:'#fff', border:'2px solid '+(on?m.c:'var(--hair-2)') }}>{on && React.cloneElement(IC.check,{size:14, color:'#fff', stroke:3})}</button>
                <span style={{ width:9, height:9, borderRadius:999, background:m.c, flexShrink:0 }}/>
                <span style={{ flex:1, minWidth:0, fontSize:14, fontWeight:600, color:on?'var(--ink)':'var(--ink-3)' }}>{m[lang]||m.th}</span>
                {perCh ? <div style={{ position:'relative', width:94, opacity:on?1:0.4 }}>
                  <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontWeight:600, fontSize:13 }}>฿</span>
                  <input className="kd-input num" disabled={!on} type="number" value={pv} onChange={e=>{ const pb={...(f.priceByCh||{})}; const val=e.target.value; if(val==='') delete pb[k]; else pb[k]=Number(val)||0; upd('priceByCh', pb); }} placeholder={String(f.price||0)} style={{ padding:'8px 8px 8px 22px', textAlign:'right' }}/>
                </div> : <span className="num" style={{ fontSize:13, fontWeight:600, color:'var(--ink-3)', opacity:on?1:0.4 }}>{'฿'+(f.price||0)}</span>}
              </div>
            );
          })}
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button onClick={()=>setAddModeOpen(true)} className="kd-btn kd-btn-ghost" style={{ flex:1, padding:'10px', fontSize:13, justifyContent:'center' }}>{React.cloneElement(IC.plus,{size:14})} {TH?'เพิ่มช่องทาง':'Add channel'}</button>
            <button onClick={()=>setManageOpen(true)} className="kd-btn" style={{ padding:'10px 14px', fontSize:13, background:'var(--bg)', color:'var(--ink-2)' }}>{TH?'จัดการ':'Manage'}</button>
          </div>
        </div>

        {/* costing method chooser (per item) */}
        <div style={{ marginBottom:14 }}>
          <Lbl>{TH?'วิธีคิดต้นทุนของเมนูนี้':'How to cost this item'}</Lbl>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setMethod('flat')} style={{ flex:1, cursor:'pointer', border:'2px solid '+(method==='flat'?'var(--brand)':'var(--hair-2)'), background:method==='flat'?'var(--brand-soft)':'#fff', color:method==='flat'?'var(--brand-ink)':'var(--ink-2)', borderRadius:12, padding:'10px 8px', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, lineHeight:1.3 }}>{TH?'💵 ต้นทุน/จาน':'💵 Per-dish'}<div style={{ fontSize:10.5, fontWeight:500, opacity:.8, marginTop:1 }}>{TH?'ซื้อมาขาย / กรอกตรง':'buy-and-sell'}</div></button>
            <button onClick={()=>setMethod('recipe')} style={{ flex:1, cursor:'pointer', border:'2px solid '+(method==='recipe'?'var(--brand)':'var(--hair-2)'), background:method==='recipe'?'var(--brand-soft)':'#fff', color:method==='recipe'?'var(--brand-ink)':'var(--ink-2)', borderRadius:12, padding:'10px 8px', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, lineHeight:1.3 }}>{TH?'🧾 คิดจากสูตร':'🧾 From recipe'}<div style={{ fontSize:10.5, fontWeight:500, opacity:.8, marginTop:1 }}>{TH?'ตัดสต๊อกอัตโนมัติ':'auto-deduct stock'}</div></button>
          </div>
        </div>

        {/* cost breakdown: recipe or free-text BOM (per-item method) */}
        {/* ── สินค้าขายฝาก: ตัดจากคลังฝากขาย (ไม่แตะคลังหลัก) · gate ตาม add-on ── */}
        {(()=>{ const consignOk=(typeof window==='undefined')||window.KD_CONSIGN!==false||!!f.consign; return (
        <div className="kd-card" style={{ padding:'13px 15px', boxShadow:'none', background:'var(--bg)', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700 }}>🤝 {TH?'เป็นสินค้าขายฝาก':'Consignment item'}</div>
              <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:2, lineHeight:1.4 }}>{consignOk?(TH?'ขายแล้วตัดจากคลังขายฝาก ไม่แตะคลังหลัก · คงเหลือ 0 = สินค้าหมด':'Sells deduct from the consignment warehouse, not main stock'):(TH?'เสริมแพ็กขายฝาก (+฿129/ด.) เพื่อเปิดใช้งาน':'Add the consignment add-on to enable')}</div>
            </div>
            {consignOk ? <button onClick={()=>setF(p=>({...p, consign:!p.consign }))} aria-label="consign" style={{ border:'none', cursor:'pointer', padding:0, background:'none', flexShrink:0 }}>
              <span style={{ display:'block', width:50, height:30, borderRadius:999, background: f.consign?'var(--brand)':'#d2dad6', position:'relative', transition:'background .2s' }}>
                <span style={{ position:'absolute', top:3, left: f.consign?23:3, width:24, height:24, borderRadius:999, background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.25)' }}/>
              </span>
            </button> : <span style={{ fontSize:20, flexShrink:0, opacity:.5 }}>🔒</span>}
          </div>
          {consignOk && f.consign && <div style={{ marginTop:11 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--ink-2)', marginBottom:5 }}>{TH?'ผูกกับสินค้าในคลังขายฝาก':'Link to consignment stock item'}</div>
            {consignList.length ? <select className="kd-input" value={f.consignId||''} onChange={e=>{ const cs=consignList.find(x=>x.id===e.target.value); setF(p=>({...p, consignId:e.target.value, consignName:cs?cs.name:'' })); }} style={{ appearance:'auto' }}>
                <option value="">{TH?'— เลือกสินค้าฝากขาย —':'— select —'}</option>
                {consignList.map(cs=><option key={cs.id} value={cs.id}>{cs.name} · {TH?'คงเหลือ':'stock'} {cs.stock}{cs.direction==='inbound'?' (รับฝาก)':' (ส่งฝาก)'}</option>)}
              </select>
              : <div style={{ fontSize:12, color:'var(--ink-3)', padding:'9px 11px', background:'#fff', borderRadius:10, lineHeight:1.5 }}>{TH?'ยังไม่มีสินค้าในคลังขายฝาก — เพิ่มได้ที่ Backoffice → สินค้าขายฝาก แล้วกลับมาผูกเมนู':'No consignment items yet — add them in Backoffice → Consignment.'}</div>}
          </div>}
        </div>); })()}
        {stock ? <RecipeEditor recipe={f.recipe||[]} onChange={(r)=>setF(p=>({...p, recipe:r}))} recipeByCh={f.recipeByCh||{}} onChangeCh={(ch,r)=>setF(p=>{ const rb={...(p.recipeByCh||{})}; if(r==null) delete rb[ch]; else rb[ch]=r; return {...p, recipeByCh:rb}; })} chanCfg={chanCfg} raw={raw} addRaw={addRaw}/> : (
        <div className="kd-card" style={{ padding:'13px 15px', boxShadow:'none', background:'var(--bg)', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: bom.length?10:0 }}>
            <div style={{ fontSize:14, fontWeight:700 }}>{React.cloneElement(IC.receipt,{size:15, style:{verticalAlign:'-3px', marginRight:5}})}{lang==='th'?'ต้นทุนวัตถุดิบ':'Ingredient cost'}</div>
            <button onClick={addIng} style={{ border:'none', cursor:'pointer', background:'var(--brand-soft)', color:'var(--brand-ink)',
              fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, padding:'6px 11px', borderRadius:999, display:'inline-flex', alignItems:'center', gap:4 }}>
              {React.cloneElement(IC.plus,{size:14})} {lang==='th'?'วัตถุดิบ':'Item'}</button>
          </div>
          {bom.length===0 && <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:6, lineHeight:1.55 }}>{TH?'ใส่วัตถุดิบทีละอย่าง แล้วเลือกวิธีคิด — กรอกต้นทุนต่อจานตรงๆ หรือ “คิดจากที่ซื้อมา” (เช่น ผักกาด 1 กก. ฿40 · ใช้ 50 กรัม → ฿2/จาน) ระบบรวมให้อัตโนมัติ':'Add ingredients, then pick how to cost each — a flat per-dish baht amount, or from a bulk buy (e.g. lettuce 1 kg ฿40 · use 50 g → ฿2/dish). Auto-totalled.'}</div>}
          {bom.map((ing,i)=>{
            const isBulk = ing.mode==='bulk';
            const fam = ingUnit(ing.buyUnit||'kg').fam;
            const famUnits = ING_UNITS.filter(u=>u.fam===fam);
            const c = ingCost(ing);
            return (
            <div key={i} style={{ background:'#fff', borderRadius:13, padding:'11px 12px', marginBottom:9, boxShadow:'var(--shadow)' }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:9 }}>
                <input className="kd-input" style={{ flex:1, padding:'9px 12px' }} value={ing.name} onChange={e=>updIng(i,'name',e.target.value)} placeholder={TH?'ชื่อวัตถุดิบ เช่น ผักกาด':'Ingredient e.g. lettuce'}/>
                <button onClick={()=>delIng(i)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-3)', padding:4 }}>{React.cloneElement(IC.x,{size:16})}</button>
              </div>
              <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                <IngModePill on={!isBulk} onClick={()=>setMode(i,'flat')}>{TH?'ต้นทุน/จาน':'Per dish'}</IngModePill>
                <IngModePill on={isBulk}  onClick={()=>setMode(i,'bulk')}>{TH?'คิดจากที่ซื้อมา':'From bulk buy'}</IngModePill>
              </div>
              {!isBulk ? (
                <div style={{ position:'relative', maxWidth:150 }}>
                  <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontSize:13 }}>฿</span>
                  <input className="kd-input num" style={{ padding:'9px 12px 9px 23px' }} type="number" value={ing.cost||''} onChange={e=>updIng(i,'cost',Number(e.target.value))} placeholder={TH?'ต้นทุนต่อจาน':'per dish'}/>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ width:48, flexShrink:0, fontSize:12.5, fontWeight:700, color:'var(--ink-2)' }}>{TH?'ซื้อมา':'Bought'}</span>
                    <input className="kd-input num" style={{ width:52, padding:'8px 8px', textAlign:'center' }} type="number" value={ing.buyQty} onChange={e=>updIng(i,'buyQty',e.target.value)}/>
                    <select style={ING_SEL} value={ing.buyUnit} onChange={e=>changeBuyUnit(i,e.target.value)}>
                      {ING_UNITS.map(u=><option key={u.id} value={u.id}>{u[lang]||u.th}</option>)}
                    </select>
                    <span style={{ color:'var(--ink-3)', fontSize:12.5 }}>{TH?'ราคา':'@'}</span>
                    <div style={{ position:'relative', flex:1, minWidth:60 }}>
                      <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontSize:13 }}>฿</span>
                      <input className="kd-input num" style={{ padding:'8px 8px 8px 21px' }} type="number" value={ing.buyPrice} onChange={e=>updIng(i,'buyPrice',e.target.value)} placeholder="0"/>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ width:48, flexShrink:0, fontSize:12.5, fontWeight:700, color:'var(--ink-2)' }}>{TH?'ใช้/จาน':'Per dish'}</span>
                    <input className="kd-input num" style={{ width:52, padding:'8px 8px', textAlign:'center' }} type="number" value={ing.useQty} onChange={e=>updIng(i,'useQty',e.target.value)}/>
                    <select style={ING_SEL} value={ing.useUnit} onChange={e=>updIng(i,'useUnit',e.target.value)}>
                      {famUnits.map(u=><option key={u.id} value={u.id}>{u[lang]||u.th}</option>)}
                    </select>
                    <span className="num" style={{ marginLeft:'auto', fontSize:14, fontWeight:700, color: c>0?'var(--brand-ink)':'var(--ink-3)', whiteSpace:'nowrap' }}>= ฿{c.toFixed(2)}<span style={{ fontSize:11, color:'var(--ink-3)', fontWeight:600 }}>/{TH?'จาน':'ea'}</span></span>
                  </div>
                </div>
              )}
            </div>
          );})}
          {bom.length>0 && <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, borderTop:'1px solid var(--hair)', fontWeight:700, fontSize:14 }}>
            <span>{TH?'รวมต้นทุน/จาน':'Total / dish'}</span><span className="num">฿{bomTotal.toLocaleString('en-US',{maximumFractionDigits:2})}</span></div>}
        </div>)}

        {/* live profit */}
        <div className="kd-card" style={{ padding:'13px 16px', background:'var(--brand-softer)', boxShadow:'none', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--ink-2)' }}>{lang==='th'?'กำไรต่อจาน':'Profit / item'}</div>
          <div style={{ textAlign:'right' }}>
            <span className="num" style={{ fontSize:22, fontWeight:700, color: pf>=0?'var(--brand-ink)':'var(--danger)' }}>{money(pf)}</span>
            <span style={{ fontSize:13, color:'var(--brand)', fontWeight:700, marginLeft:8 }}>{mg}%</span>
          </div>
        </div>
        {/* per-item modifiers (spice/sweet/size/topping) */}
        <ModifiersEditor options={f.options||[]} onChange={(o)=>setF(p=>({...p, options:o}))} lang={lang}/>

        <div className="kd-card" style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 15px', boxShadow:'none', background:'var(--bg)', marginBottom:14, cursor:'pointer' }}
          onClick={()=>upd('off',!f.off)}>
          <span style={{ color: f.off?'var(--danger)':'var(--brand)' }}>{React.cloneElement(IC.store,{size:20})}</span>
          <div style={{ flex:1 }}><div style={{ fontSize:14.5, fontWeight:600 }}>{lang==='th'?'เปิดขายเมนูนี้':'Available for sale'}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)' }}>{f.off?(lang==='th'?'ปิดอยู่ · ลูกค้าสั่งไม่ได้ (สินค้าหมด)':'Off · hidden from ordering'):(lang==='th'?'เปิดอยู่ · ขายได้ปกติ':'On · orderable')}</div></div>
          <Toggle on={!f.off}/>
        </div>
        <div style={{ marginBottom:20 }}>
          <Lbl>{lang==='th'?'สีปุ่ม':'Tile color'}</Lbl>
          <div style={{ display:'flex', gap:9 }}>
            {TONES.map(c=>(<button key={c} onClick={()=>upd('tone',c)} style={{ width:38, height:38, borderRadius:12,
              background:c, border: f.tone===c?'3px solid var(--brand)':'3px solid transparent', cursor:'pointer' }}/>))}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:10, padding:'12px 20px 0' }}>
        {!isNew && <button onClick={onDelete} className="kd-btn" style={{ background:'#FCECE8', color:'var(--danger)', padding:'15px 18px' }}>{React.cloneElement(IC.x,{size:18})}</button>}
        <button onClick={()=>onSave(stock&&recipe.length?{...f,cost:recipeTotal}:f)} className="kd-btn kd-btn-primary" style={{ flex:1, padding:15 }} disabled={!f.th}>{t('save')}</button>
      </div>
    </Sheet>
    {addModeOpen && <AddSaleModeSheet onClose={()=>setAddModeOpen(false)} onAdd={(def)=>{ addSaleMode&&addSaleMode(def); setF(p=>(p.channels&&p.channels.length)?{...p, channels:[...p.channels, def.key]}:p); setAddModeOpen(false); }}/>}
    {manageOpen && <ManageSaleModesSheet chanCfg={chanCfg} toggleSaleMode={toggleSaleMode} removeSaleMode={removeSaleMode} onAdd={()=>{ setManageOpen(false); setAddModeOpen(true); }} onClose={()=>setManageOpen(false)}/>}
    </React.Fragment>
  );
}
function Field({ label, children }){ return <div><Lbl>{label}</Lbl>{children}</div>; }
function Lbl({ children }){ return <div style={{ fontSize:13, fontWeight:600, color:'var(--ink-2)', margin:'0 2px 6px' }}>{children}</div>; }
function NumInput({ value, onChange }){
  return <div style={{ position:'relative' }}>
    <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontWeight:600 }}>฿</span>
    <input className="kd-input num" style={{ paddingLeft:26 }} type="number" value={value||''} onChange={e=>onChange(Number(e.target.value))} placeholder="0"/>
  </div>;
}

/* costing-mode picker: simple (cost per dish) vs stock (inventory + auto deduct) */
function CostModeSheet({ costMode, setCostMode, onClose }){
  const { lang } = useT(); const TH = lang==='th';
  const opts = [
    { id:'simple', ic:IC.receipt, th:'โหมดง่าย', en:'Simple', descTh:'กรอกต้นทุนต่อจานที่เมนู ไม่ต้องทำสต๊อก เหมาะร้านเล็ก', descEn:'Enter cost per dish. No inventory. Best for small shops.' },
    { id:'stock',  ic:IC.box,     th:'โหมดสต๊อก', en:'Stock', descTh:'จัดการวัตถุดิบ ซื้อเข้าตามวัน ตัดสต๊อกอัตโนมัติตามสูตร ต้นทุนเฉลี่ยจากราคาซื้อ', descEn:'Track raw materials, buy in, auto-deduct on sale, avg cost.' },
  ];
  return (
    <Sheet open={true} onClose={onClose} height="72%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{TH?'โหมดต้นทุน':'Costing mode'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        <div style={{ fontSize:13, color:'var(--ink-3)', marginBottom:14, lineHeight:1.55 }}>{TH?'เลือกวิธีคิดต้นทุนที่เหมาะกับร้าน — สลับภายหลังได้ตลอด':'Pick the costing that fits your shop — switch anytime.'}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
          {opts.map(o=>{ const on=costMode===o.id; return (
            <button key={o.id} onClick={()=>setCostMode(o.id)} className="kd-card" style={{ border: on?'2px solid var(--brand)':'2px solid transparent',
              cursor:'pointer', display:'flex', alignItems:'flex-start', gap:13, padding:'15px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
              <span style={{ width:44, height:44, borderRadius:12, background: on?'var(--brand)':'var(--bg)', color: on?'#fff':'var(--ink-3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{React.cloneElement(o.ic,{size:22})}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:16, fontWeight:700 }}>{o[lang]||o.th}{on && <span style={{ fontSize:11, color:'#fff', background:'var(--brand)', padding:'2px 8px', borderRadius:999, marginLeft:8 }}>{TH?'ใช้อยู่':'Active'}</span>}</div>
                <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:3, lineHeight:1.5 }}>{TH?o.descTh:o.descEn}</div>
              </div>
            </button>
          );})}
        </div>
      </div>
      <div style={{ padding:'12px 20px 0' }}>
        <button onClick={onClose} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15 }}>{TH?'เสร็จสิ้น':'Done'}</button>
      </div>
    </Sheet>
  );
}

/* ══════════════ LOCKED FEATURE (Free tier) ══════════════ */
// ส่งคำขอชำระเงิน: มิเรอร์ลง localStorage ร่วม (เดโมข้ามแอป) + ยิง API เมื่อ live
const PAYREQ_LS = 'kaidee_pay_requests_v1';
function kdSubmitPayRequest(payload){
  try{ const a=JSON.parse(localStorage.getItem(PAYREQ_LS)||'[]');
    a.unshift({ ...payload, id:'pr'+Date.now(), status:'pending', created_at:Date.now() });
    localStorage.setItem(PAYREQ_LS, JSON.stringify(a.slice(0,200))); }catch(e){}
  if(window.KD_LIVE && window.KD_API && window.KD_API.createPayRequest) window.KD_API.createPayRequest(payload).catch(()=>{});
}
function kdSlipResize(file){
  return new Promise((res,rej)=>{ const rd=new FileReader(); rd.onerror=()=>rej();
    rd.onload=()=>{ const img=new Image(); img.onerror=()=>rej();
      img.onload=()=>{ const W=640, sc=Math.min(1,W/img.width), c=document.createElement('canvas');
        c.width=img.width*sc; c.height=img.height*sc; c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        res(c.toDataURL('image/jpeg',.7)); }; img.src=rd.result; };
    rd.readAsDataURL(file); });
}
// ราคา add-on จากแพ็ก (แอดมินตั้งได้) — fallback ฿129/ด. · ฿1,290/ปี
function kdAddonPrice(id){ try{ const p=JSON.parse(localStorage.getItem('kaidee_pkg_v1')||'{}'); const a=p.addon&&p.addon[id]; if(a) return { monthly:(+a.monthly||129), yearly:(+a.yearly||1290), name:a.name||'ขายฝาก' }; }catch(e){} return { monthly:129, yearly:1290, name:'ขายฝาก' }; }
/* ── ซื้อ add-on ขายฝากเอง (โอนพร้อมเพย์ + แนบสลิป → แอดมินอนุมัติเปิดให้) ── */
function AddonConsignSheet({ store, lang, onClose }){
  const TH = lang!=='en';
  const pr = kdAddonPrice('consign');
  const [period,setPeriod] = m2State('monthly');
  const [slip,setSlip] = m2State(null);
  const [note,setNote] = m2State('');
  const [sent,setSent] = m2State(false);
  const amount = period==='yearly' ? (pr.yearly || pr.monthly*10) : pr.monthly;
  const months = period==='yearly' ? 12 : 1;
  const submit = ()=>{ kdSubmitPayRequest({ shopId: store.shop.shopId || store.shop.name || 'shop',
    shopName: store.shop.name, amount, months, kind:'addon', addon:'consign', plan:'addon-consign', slip, note }); setSent(true); };
  return (
    <div onClick={onClose} style={{ position:'absolute', inset:0, zIndex:120, background:'rgba(10,20,15,.55)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} className="kd-slideup" style={{ width:'100%', maxWidth:440, background:'#fff', borderRadius:'20px 20px 0 0', padding:'20px 20px calc(20px + env(safe-area-inset-bottom))', maxHeight:'92%', overflowY:'auto' }}>
        {sent ? <div style={{ padding:'26px 6px 12px', textAlign:'center' }}>
          <div className="kd-pop" style={{ width:70, height:70, borderRadius:999, background:'var(--brand)', color:'#fff', fontSize:32, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>✓</div>
          <div style={{ fontSize:19, fontWeight:700 }}>{TH?'ส่งแจ้งชำระแล้ว':'Payment submitted'}</div>
          <div style={{ fontSize:13.5, color:'var(--ink-2)', marginTop:8, lineHeight:1.55 }}>{TH?'ทีมงานกำลังตรวจสลิป เมื่อยืนยันแล้ว ระบบขายฝากจะเปิดให้อัตโนมัติ':'We are verifying your slip. Consignment unlocks once confirmed.'}</div>
          <button className="kd-btn kd-btn-primary kd-btn-block" style={{ marginTop:22 }} onClick={onClose}>{TH?'เสร็จ':'Done'}</button>
        </div> : <>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:26 }}>🤝</span>
            <div style={{ flex:1 }}><div style={{ fontSize:18, fontWeight:700 }}>{TH?'เปิดระบบขายฝาก':'Enable consignment'}</div>
            <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:1 }}>{TH?'ส่วนเสริม (Add-on) แยกจากแพ็กหลัก':'Add-on, billed on top of your plan'}</div></div>
          </div>
          <div style={{ fontSize:13, color:'var(--ink-2)', marginTop:12, lineHeight:1.5 }}>{TH?'จัดการสินค้าฝากขาย · เจ้าของสินค้า · เคลียร์เงิน · ใบส่งของ — โอนพร้อมเพย์แล้วแนบสลิป ทีมงานยืนยันให้':'Manage consignment stock, vendors, settlements & delivery notes. Transfer and attach your slip.'}</div>
          <div style={{ display:'flex', gap:9, marginTop:16 }}>
            {[['monthly',TH?'รายเดือน':'Monthly',pr.monthly],['yearly',TH?'รายปี':'Yearly',(pr.yearly||pr.monthly*10)]].map(([k,l,p])=>(
              <button key={k} onClick={()=>setPeriod(k)} style={{ flex:1, border:'2px solid '+(period===k?'var(--brand)':'var(--hair-2)'), background:period===k?'var(--brand-soft)':'#fff', borderRadius:14, padding:'12px 6px', cursor:'pointer', fontFamily:'var(--font)' }}>
                <div style={{ fontWeight:700, fontSize:13.5, color:period===k?'var(--brand-ink)':'var(--ink)' }}>{l}</div>
                <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:3 }}>฿{Number(p).toLocaleString()}{k==='yearly'?(TH?'/ปี':'/yr'):(TH?'/ด.':'/mo')}</div></button>))}
          </div>
          <div className="kd-card" style={{ padding:'14px 16px', marginTop:14 }}>
            <div style={{ fontSize:12.5, color:'var(--ink-3)' }}>{TH?'โอนมาที่พร้อมเพย์':'Transfer to PromptPay'}</div>
            <div style={{ fontWeight:700, fontSize:17, marginTop:3 }} className="num">{store.pay.promptpay || '—'}</div>
            <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:2 }}>{store.pay.shopName||store.shop.name} · {TH?'ยอด':'Amount'} ฿{amount.toLocaleString()}</div>
          </div>
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-2)', marginBottom:7 }}>{TH?'แนบสลิปโอนเงิน':'Attach slip'}</div>
            {slip ? <div style={{ position:'relative' }}><img src={slip} style={{ width:'100%', maxHeight:200, objectFit:'contain', borderRadius:12, border:'1px solid var(--hair-2)', background:'#fff' }}/>
              <button onClick={()=>setSlip(null)} style={{ position:'absolute', top:8, right:8, border:'none', background:'rgba(0,0,0,.6)', color:'#fff', borderRadius:8, padding:'5px 10px', fontFamily:'var(--font)', fontSize:12, cursor:'pointer' }}>{TH?'เปลี่ยน':'Change'}</button></div>
            : <label style={{ display:'block', border:'1.6px dashed var(--hair-2)', borderRadius:12, padding:'26px', textAlign:'center', color:'var(--ink-3)', background:'#fff', cursor:'pointer', position:'relative' }}>
                📷 {TH?'แตะเพื่อเลือก/ถ่ายรูปสลิป':'Tap to add slip'}
                <input type="file" accept="image/*" onChange={async e=>{ const f=e.target.files&&e.target.files[0]; if(f){ try{ setSlip(await kdSlipResize(f)); }catch(_){}}}} style={{ position:'absolute', opacity:0, width:0, height:0 }}/></label>}
          </div>
          <input className="kd-input" placeholder={TH?'หมายเหตุ (ไม่บังคับ)':'Note (optional)'} value={note} onChange={e=>setNote(e.target.value)} style={{ marginTop:12 }}/>
          <button className="kd-btn kd-btn-primary kd-btn-block" style={{ marginTop:18, opacity:slip?1:.5 }} disabled={!slip} onClick={submit}>{TH?'ส่งแจ้งชำระ':'Submit'}</button>
          <button className="kd-btn kd-btn-block" style={{ marginTop:9, background:'none', color:'var(--ink-3)' }} onClick={onClose}>{TH?'ยกเลิก':'Cancel'}</button>
        </>}
      </div>
    </div>
  );
}
function LockedFeature({ tabKey, store, lang, onStore }){
  const TH = lang!=='en';
  const [view,setView] = m2State('lock');   // lock | notify | sent
  const [months,setMonths] = m2State(1);
  const [slip,setSlip] = m2State(null);
  const [note,setNote] = m2State('');
  const info = {
    sell:    { ic:'🛒', t:TH?'ทดลองใช้หมดอายุ':'Trial expired', s:TH?'ต่ออายุ/อัปเกรดก่อน ถึงจะเปิดขายหน้าร้านได้อีกครั้ง':'Renew to resume selling.' },
    orders:  { ic:'🧾', t:TH?'รับออเดอร์ LINE & เดลิเวอรี':'LINE & delivery orders', s:TH?'รับออเดอร์จากลูกค้าผ่าน LINE, Grab, LINE MAN และส่งเอง — เปิดใช้เมื่ออัปเกรด':'Accept LINE/Grab/LINE MAN orders — paid plan.' },
    reports: { ic:'📊', t:TH?'รายงานกำไร-ต้นทุน':'Profit reports', s:TH?'ดูยอดขาย ต้นทุน กำไรย้อนหลัง และสรุปรายวัน — เปิดใช้เมื่ออัปเกรด':'Full sales/cost/profit reports — paid plan.' },
    stock:   { ic:'📦', t:TH?'สต๊อกวัตถุดิบ':'Ingredient stock', s:TH?'ตัดสต๊อกอัตโนมัติตามสูตร เตือนของใกล้หมด — เปิดใช้เมื่ออัปเกรด':'Auto stock deduction — paid plan.' },
  }[tabKey] || { ic:'🔒', t:TH?'ฟีเจอร์นี้ต้องอัปเกรด':'Upgrade required', s:'' };
  const price = { 1:199, 3:597, 12:1990 }[months];
  const submit = ()=>{ kdSubmitPayRequest({ shopId: store.shop.shopId || store.shop.name || 'shop',
    shopName: store.shop.name, amount: price, months, slip, note }); setView('sent'); };

  if(view==='sent') return (
    <div className="kd-screen" style={{ background:'var(--bg)' }}><div className="kd-body"><div style={{ padding:'70px 26px', textAlign:'center' }}>
      <div className="kd-pop" style={{ width:74, height:74, borderRadius:999, background:'var(--brand)', color:'#fff', fontSize:34, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>✓</div>
      <div style={{ fontSize:20, fontWeight:700 }}>{TH?'ส่งแจ้งชำระแล้ว':'Payment submitted'}</div>
      <div style={{ fontSize:13.5, color:'var(--ink-2)', marginTop:8, lineHeight:1.55 }}>{TH?'ทีมงานกำลังตรวจสลิป เมื่อยืนยันแล้วร้านจะปลดล็อกอัตโนมัติ (ปกติภายในไม่กี่ชั่วโมง)':'We are verifying your slip. Your shop unlocks once confirmed.'}</div>
      <button className="kd-btn kd-btn-ghost kd-btn-block" style={{ marginTop:24 }} onClick={()=>setView('lock')}>{TH?'กลับ':'Back'}</button>
    </div></div></div>
  );
  if(view==='notify') return (
    <div className="kd-screen" style={{ background:'var(--bg)' }}><div className="kd-body"><div style={{ padding:'46px 22px 30px' }}>
      <div style={{ fontSize:19, fontWeight:700 }}>{TH?'แจ้งชำระเงิน':'Notify payment'}</div>
      <div style={{ fontSize:13, color:'var(--ink-2)', marginTop:6, lineHeight:1.5 }}>{TH?'เลือกระยะเวลา → โอนพร้อมเพย์ → แนบสลิป ทีมงานยืนยันให้':'Pick a period, transfer, attach the slip.'}</div>
      <div style={{ display:'flex', gap:9, marginTop:16 }}>
        {[[1,'1 เดือน','฿199'],[3,'3 เดือน','฿597'],[12,'1 ปี','฿1,990']].map(([m,l,p])=>(
          <button key={m} onClick={()=>setMonths(m)} style={{ flex:1, border:'2px solid '+(months===m?'var(--brand)':'var(--hair-2)'), background:months===m?'var(--brand-soft)':'#fff', borderRadius:14, padding:'12px 6px', cursor:'pointer', fontFamily:'var(--font)' }}>
            <div style={{ fontWeight:700, fontSize:13.5, color:months===m?'var(--brand-ink)':'var(--ink)' }}>{l}</div>
            <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:3 }}>{p}</div></button>))}
      </div>
      <div className="kd-card" style={{ padding:'14px 16px', marginTop:16 }}>
        <div style={{ fontSize:12.5, color:'var(--ink-3)' }}>{TH?'โอนมาที่พร้อมเพย์':'Transfer to PromptPay'}</div>
        <div style={{ fontWeight:700, fontSize:17, marginTop:3 }} className="num">{store.pay.promptpay || '—'}</div>
        <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:2 }}>{store.pay.shopName||store.shop.name} · {TH?'ยอด':'Amount'} ฿{price.toLocaleString()}</div>
      </div>
      <label style={{ display:'block', marginTop:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-2)', marginBottom:7 }}>{TH?'แนบสลิปโอนเงิน':'Attach slip'}</div>
        {slip ? <div style={{ position:'relative' }}><img src={slip} style={{ width:'100%', maxHeight:200, objectFit:'contain', borderRadius:12, border:'1px solid var(--hair-2)', background:'#fff' }}/>
          <button onClick={()=>setSlip(null)} style={{ position:'absolute', top:8, right:8, border:'none', background:'rgba(0,0,0,.6)', color:'#fff', borderRadius:8, padding:'5px 10px', fontFamily:'var(--font)', fontSize:12, cursor:'pointer' }}>{TH?'เปลี่ยน':'Change'}</button></div>
        : <div style={{ border:'1.6px dashed var(--hair-2)', borderRadius:12, padding:'26px', textAlign:'center', color:'var(--ink-3)', background:'#fff', cursor:'pointer' }}>
            📷 {TH?'แตะเพื่อเลือก/ถ่ายรูปสลิป':'Tap to add slip'}
            <input type="file" accept="image/*" onChange={async e=>{ const f=e.target.files&&e.target.files[0]; if(f){ try{ setSlip(await kdSlipResize(f)); }catch(_){}}}} style={{ position:'absolute', opacity:0, width:0, height:0 }}/></div>}
      </label>
      <input className="kd-input" placeholder={TH?'หมายเหตุ (ไม่บังคับ)':'Note (optional)'} value={note} onChange={e=>setNote(e.target.value)} style={{ marginTop:12 }}/>
      <button className="kd-btn kd-btn-primary kd-btn-block" style={{ marginTop:18, opacity:slip?1:.5 }} disabled={!slip} onClick={submit}>{TH?'ส่งแจ้งชำระ':'Submit'}</button>
      <button className="kd-btn kd-btn-block" style={{ marginTop:9, background:'none', color:'var(--ink-3)' }} onClick={()=>setView('lock')}>{TH?'ยกเลิก':'Cancel'}</button>
    </div></div></div>
  );
  return (
    <div className="kd-screen" style={{ background:'var(--bg)' }}>
      <div className="kd-body"><div style={{ padding:'52px 24px 30px', display:'flex', flexDirection:'column', minHeight:'100%', textAlign:'center' }}>
        <div style={{ width:76, height:76, borderRadius:20, background:'var(--brand-soft)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, margin:'0 auto 16px', position:'relative' }}>{info.ic}
          <div style={{ position:'absolute', right:-4, bottom:-4, width:30, height:30, borderRadius:'50%', background:'var(--ink)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>🔒</div></div>
        <div style={{ fontSize:20, fontWeight:700 }}>{info.t}</div>
        <div style={{ fontSize:13.5, color:'var(--ink-2)', marginTop:8, lineHeight:1.55 }}>{info.s}</div>

        <div className="kd-card" style={{ padding:'18px 20px', marginTop:22, border:'2px solid var(--brand)', textAlign:'left' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <div style={{ fontWeight:700, fontSize:16 }}>{TH?'แพ็กเกจร้านค้า':'Shop plan'}</div>
            <div style={{ fontSize:22, fontWeight:700 }}>฿199<span style={{ fontSize:13, color:'var(--ink-3)', fontWeight:500 }}>{TH?'/เดือน':'/mo'}</span></div>
          </div>
          <div style={{ fontSize:13, color:'var(--ink-2)', marginTop:8, lineHeight:1.7 }}>
            {(TH?['ออเดอร์ LINE + เดลิเวอรี ไม่จำกัด','รายงานกำไร-ต้นทุน-เงินสด','สต๊อกวัตถุดิบ + ใบเสนอราคา']:['Unlimited LINE + delivery','Full reports','Stock + quotations']).map((f,i)=>(<div key={i}>✓ {f}</div>))}
          </div>
        </div>
        <button className="kd-btn kd-btn-primary kd-btn-block" style={{ marginTop:18 }} onClick={()=>setView('notify')}>{TH?'📤 แจ้งว่าโอนแล้ว + แนบสลิป':'📤 I paid — attach slip'}</button>
        <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:12, lineHeight:1.6 }}>{TH?'โอนพร้อมเพย์ → แนบสลิป → ทีมงานยืนยัน แล้วปลดล็อกอัตโนมัติ · ยังใช้ ขาย & เงินสด ฟรีได้':'Transfer, attach slip, we confirm. Sell & cash stay free.'}</div>
      </div></div>
    </div>
  );
}

/* ══════════════ DEVICE LIMIT (เกินจำนวนเครื่องตามแพ็กเกจ) ══════════════ */
function DeviceLimitScreen({ lang, info }){
  const TH = lang!=='en';
  return (
    <div className="kd-screen" style={{ background:'var(--bg)' }}>
      <div className="kd-body"><div style={{ padding:'70px 26px', textAlign:'center' }}>
        <div style={{ width:76, height:76, borderRadius:20, background:'#FDF0E2', color:'#E8992F', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, margin:'0 auto 16px' }}>📱</div>
        <div style={{ fontSize:20, fontWeight:700 }}>{TH?'เกินจำนวนเครื่องของแพ็กเกจ':'Device limit reached'}</div>
        <div style={{ fontSize:13.5, color:'var(--ink-2)', marginTop:8, lineHeight:1.55 }}>{TH?`แพ็กเกจนี้ใช้ได้ ${info.limit} เครื่อง (กำลังเปิด ${info.count} เครื่อง) — ปิดแอปในเครื่องอื่น หรืออัปเกรดเป็น ฿299 ใช้ได้ 3 เครื่อง`:`Your plan allows ${info.limit} device(s) (now ${info.count}). Close others or upgrade to ฿299 (3 devices).`}</div>
        <button className="kd-btn kd-btn-primary kd-btn-block" style={{ marginTop:20 }} onClick={()=>location.reload()}>{TH?'ใช้เครื่องนี้ (ปิดเครื่องอื่นแล้ว)':'Use this device'}</button>
        <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:12 }}>{TH?'อยากได้ 3 เครื่อง? แจ้งทีมงาน KaiDee ผ่าน LINE เพื่ออัปเกรด ฿299':'Upgrade to ฿299 (3 devices) via LINE support'}</div>
      </div></div>
    </div>
  );
}

/* ══════════════ OWNER BLOCKED (ไม่ใช่เจ้าของร้าน) ══════════════ */
function OwnerBlocked({ lang }){
  const TH = lang!=='en';
  return (
    <div className="kd-screen" style={{ background:'var(--bg)' }}>
      <div className="kd-body"><div style={{ padding:'80px 28px', textAlign:'center' }}>
        <div style={{ width:76, height:76, borderRadius:20, background:'#FCEEEA', color:'var(--danger)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, margin:'0 auto 16px' }}>🔒</div>
        <div style={{ fontSize:20, fontWeight:700 }}>{TH?'เข้าหลังบ้านไม่ได้':'Access denied'}</div>
        <div style={{ fontSize:13.5, color:'var(--ink-2)', marginTop:8, lineHeight:1.55 }}>{TH?'บัญชี LINE นี้ไม่ใช่เจ้าของร้าน — เฉพาะเจ้าของร้านเท่านั้นที่เปิดหน้าจัดการได้ หากเป็นเจ้าของ กรุณาเปิดด้วย LINE ที่ใช้สมัคร':'This LINE account is not the shop owner. Open with the account used to sign up.'}</div>
      </div></div>
    </div>
  );
}

/* ══════════════ SHOP ACCOUNT (บัญชีร้าน · ลิงก์ + แพ็กเกจ สไตล์ CRM) ══════════════ */
function ShopAccount({ shop, sub }){
  const { lang } = useT();
  const [c,setC] = m2State('');
  const sid = (shop && shop.shopId) || (typeof window!=='undefined' && window.KD_SHOP) || '';
  const origin = (typeof location!=='undefined') ? location.origin+location.pathname.replace(/[^/]*$/,'') : '';
  const custUrl = `https://liff.line.me/2010720123-HXe3iZJD?shop=${sid}`;
  const posUrl = `${origin}?shop=${sid}&role=merchant`;
  const cp=(u,k)=>{ try{ navigator.clipboard.writeText(u); }catch(e){} setC(k); setTimeout(()=>setC(''),1400); };
  const days = (sub&&sub.expiry) ? Math.max(0,Math.ceil((new Date(sub.expiry)-Date.now())/864e5)) : null;
  const paid = sub&&sub.plan==='paid';
  const Row=({u,k,label})=>(<div style={{marginTop:9}}><div style={{fontSize:11.5,fontWeight:700,color:'rgba(255,255,255,.9)',marginBottom:5}}>{label}</div>
    <div style={{display:'flex',alignItems:'center',gap:7,background:'rgba(255,255,255,.15)',borderRadius:10,padding:'7px 7px 7px 11px'}}>
      <code style={{flex:1,fontFamily:'var(--mono)',fontSize:11,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u}</code>
      <button onClick={()=>cp(u,k)} style={{border:'none',background:'#fff',color:'var(--brand-ink)',borderRadius:8,padding:'6px 10px',fontFamily:'var(--font)',fontWeight:700,fontSize:11.5,cursor:'pointer'}}>{c===k?'✓':(lang==='th'?'คัดลอก':'Copy')}</button>
    </div></div>);
  if(!sid) return null;
  return (<div style={{borderRadius:18,padding:'16px 17px',marginBottom:16,background:'var(--hero)',color:'#fff'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div style={{fontWeight:700,fontSize:15}}>🏪 {lang==='th'?'บัญชีร้าน':'Shop account'}</div>
      <span style={{fontSize:12,fontWeight:700,background:'rgba(255,255,255,.2)',padding:'3px 10px',borderRadius:999}}>{paid?(lang==='th'?'จ่ายแล้ว':'Paid'):(lang==='th'?'ทดลอง':'Trial')}{days!=null?` · ${lang==='th'?'เหลือ':''} ${days} ${lang==='th'?'ว.':'d'}`:''}</span>
    </div>
    <Row u={custUrl} k="c" label={lang==='th'?'ลิงก์ลูกค้าสั่งอาหาร (ใส่ใน Rich menu)':'Customer link'}/>
    <Row u={posUrl} k="p" label={lang==='th'?'ลิงก์หลังบ้าน (แชร์ให้พนักงาน)':'Backend link'}/>
    <button onClick={()=>window.open('https://line.me/R/ti/p/@188dfiog','_blank')} style={{width:'100%',marginTop:12,border:'none',background:'#fff',color:'var(--brand-ink)',borderRadius:12,padding:'11px',fontFamily:'var(--font)',fontWeight:700,fontSize:14,cursor:'pointer'}}>⭐ {lang==='th'?'อัปเกรดแพ็กเกจ / แจ้งชำระ':'Upgrade / contact'}</button>
  </div>);
}

/* ══════════════ MERCHANT SHELL ══════════════ */
function MerchantApp({ store }){
  const { t, lang } = useT();
  const [tab,setTab] = m2State(()=>{ try{ if(sessionStorage.getItem('kd_fresh_signup')==='1'){ sessionStorage.removeItem('kd_fresh_signup'); return 'store'; } }catch(e){} return 'sell'; });
  // เปิดครั้งแรกอ่าน tab จาก URL (เช่น tab=store หลังสมัคร) แล้วลบทิ้ง → เปิดครั้งต่อไปกลับมาหน้าหลัก (ยินดีต้อนรับ) เสมอ
  React.useEffect(()=>{ try{ const u=new URL(location.href); if(u.searchParams.has('tab')){ u.searchParams.delete('tab'); history.replaceState(null,'',u.pathname+(u.search||'')+u.hash); } }catch(e){} },[]);
  const [devOk,setDevOk] = m2State(true);
  const [devInfo,setDevInfo] = m2State({count:1,limit:1});
  const [staffName,setStaffName] = m2State(()=>{ try{ return localStorage.getItem('kd_active_staff')||''; }catch(e){ return ''; } });
  const [staffId,setStaffId] = m2State(()=>{ try{ return localStorage.getItem('kd_staff_id')||''; }catch(e){ return ''; } });
  React.useEffect(()=>{ try{ if(localStorage.getItem('kd_staff')!=='1') return; const lu=(typeof window!=='undefined'&&window.__lineUser)||null; const list=(store.staffList)||[]; const mine=lu&&lu.userId?list.find(s=>s.line===lu.userId):list.find(s=>s.id===(localStorage.getItem('kd_staff_id')||'')); if(mine&&mine.status!=='pending'&&mine.name){ if(localStorage.getItem('kd_active_staff')!==mine.name) localStorage.setItem('kd_active_staff',mine.name); setStaffName(mine.name); } }catch(e){} }, [store.staffList, staffId]);
  const [upgrade,setUpgrade] = m2State(false);
  const [soundOn,setSoundOn] = m2State(()=>{ try{ return localStorage.getItem('kd_order_sound')!=='0'; }catch(e){ return true; } });
  const toggleSound = ()=> setSoundOn(v=>{ const nv=!v; try{ localStorage.setItem('kd_order_sound', nv?'1':'0'); }catch(e){} if(nv) kdPlayChime(); return nv; });
  useOrderChime(store.orders, soundOn);
  useCashCallChime(store.orders, soundOn);   // เสียง+alert เมื่อลูกค้ากด "เรียกเก็บเงินสด"
  // ―― ครบทดลอง (ไม่ใช่ paid) → ลดเป็น Free tier: ขาย/เงินสด/ร้านค้า ใช้ได้ · ล็อก ออเดอร์·รายงาน·สต๊อก ――
  const sub = store.sub || {};
  const expDays = sub.expiry ? Math.ceil((new Date(sub.expiry)-Date.now())/864e5) : 99;
  // ―― device-limit: นับเครื่องต่อร้านที่ backend → เกินโควตา seats → ล็อกเครื่องที่เกิน ――
  React.useEffect(()=>{
    if(!(window.KD_LIVE && window.KD_API && window.KD_API.registerDevice)) return;
    const sid = (store.shop && store.shop.shopId) || (typeof window!=='undefined' && window.KD_SHOP);
    if(!sid) return;
    let dev; try{ dev=localStorage.getItem('kd_device'); if(!dev){ dev='d'+Date.now()+Math.random().toString(36).slice(2,8); localStorage.setItem('kd_device',dev); } }catch(e){ return; }
    const ping=()=>window.KD_API.registerDevice(sid,dev).then(r=>{ if(r&&typeof r.allowed==='boolean'){ setDevOk(r.allowed); setDevInfo({count:r.count,limit:r.limit}); } }).catch(()=>{});
    ping(); const iv=setInterval(ping,60000); return ()=>clearInterval(iv);
  },[]);
  // ―― owner-gate: เฉพาะเจ้าของร้าน (LINE) เข้าหลังบ้านได้ · ทำงานจริงเมื่อเปิดใน LINE + มี backend ――
  const _owner = store.shop && store.shop.owner;
  const _lu = (typeof window!=='undefined' && window.__lineUser) || null;
  const _inLine = typeof window!=='undefined' && window.KD_LIFF && window.KD_LIFF.mode==='line';
  if(_owner && _owner.line && _inLine && _lu && _lu.userId !== _owner.line) return <OwnerBlocked lang={lang}/>;
  if(!devOk) return <DeviceLimitScreen lang={lang} info={devInfo} store={store}/>;
  // เชื่อผลจากเซิร์ฟเวอร์ (_licActive) ก่อนเสมอถ้าเคยเช็คสำเร็จแล้ว — กันแก้ sub.plan/expiry ใน localStorage เพื่อปลดล็อกเอง
  // ยังไม่เคยเช็ค (_licActive undefined) → fallback วันหมดอายุจาก local ไปก่อน กันแอปสะดุดตอนโหลดครั้งแรก/ออฟไลน์
  const freeTier = sub._licActive === true ? false : sub._licActive === false ? true : (sub.plan!=='paid' && expDays < 0);
  const LOCKED = freeTier ? ['sell','orders','reports','stock'] : [];
  const isLocked = (k)=> LOCKED.includes(k);
  const TH = lang!=='en';
  const lk = (label,k)=> isLocked(k) ? label+' 🔒' : label;
  const newCount = store.orders.filter(o=>o.status==='new').length;
  const bestList = (()=>{ const q={}; [...(store.sales||[]), ...(store.orders||[])].forEach(s=>(s.items||[]).forEach(([id,n])=>{ q[id]=(q[id]||0)+(Number(n)||0); })); return Object.entries(q).sort((a,b)=>b[1]-a[1]).filter(e=>e[1]>0); })();
  const [lowAlert,setLowAlert] = m2State(null);
  const lowRef = React.useRef(null);
  React.useEffect(()=>{
    const lows=((store.raw)||[]).filter(r=>(Number(r.stock)||0)<=(Number(r.low)||0)).map(r=>r.id);
    const prev=lowRef.current;
    if(prev!==null){ const fresh=lows.filter(id=>!prev.includes(id)); if(fresh.length){
      const names=fresh.map(id=>((store.raw.find(r=>r.id===id)||{}).th)||'').filter(Boolean);
      setLowAlert(names); try{ navigator.vibrate && navigator.vibrate([80,40,80]); }catch(e){}
      try{ window.KD_API && window.KD_API.notifyLine && window.KD_API.notifyLine('วัตถุดิบใกล้หมด: '+names.join(', ')); }catch(e){}
    }}
    lowRef.current=lows;
  }, [store.raw]);
  const feats = (store.shop && store.shop.features) || {};
  const featOn = (k)=> feats[k]!==false;
  const stockOn = featOn('stock');
  const isStaff = (()=>{ try{ return localStorage.getItem('kd_staff')==='1'; }catch(e){ return false; } })();
  const hasLine = !!(typeof window!=='undefined' && window.__lineUser && window.__lineUser.name);
  // เครื่องพนักงาน (แชร์ลิงก์) + ไม่มีชื่อไลน์ + ยังไม่เลือกชื่อ → บังคับเลือกก่อนทำรายการ
  const needStaffPick = isStaff && !hasLine && !staffName;
  const allTabs = [
    { key:'sell',   label:TH?'หน้าขาย':'Sell',       icon:IC.sell },
    ...(featOn('orders') ? [{ key:'orders', label:lk(t('orders'),'orders'),  icon:IC.bag, badge:isLocked('orders')?0:newCount }] : []),
    ...(featOn('reports') ? [{ key:'reports',label:lk(t('dashboard'),'reports'), icon:IC.chart }] : []),
    { key:'cash',   label:TH?'เปิด/ปิดร้าน':'Open/Close', icon:IC.wallet },
    ...(stockOn ? [{ key:'stock', label:lk(t('stock'),'stock'), icon:IC.box, badge:((store.raw)||[]).filter(r=>(Number(r.stock)||0)<=(Number(r.low)||0)).length }] : []),
    { key:'store',  label:TH?'ตั้งค่าร้าน':'Settings', icon:IC.store },
  ];
  // เครื่องพนักงาน (role=staff) → สิทธิ์ตามทะเบียน (LINE=ผูก userId · เว็บ=เลือกชื่อ+PIN)
  const lineUser = (typeof window!=='undefined' && window.__lineUser) || null;
  const lineUid = lineUser && lineUser.userId;
  const roster = store.staffList||[];
  const myStaff = isStaff ? (lineUid ? roster.find(s=>s.line===lineUid) : roster.find(s=>s.id===staffId)) : null;
  const needLineRegister = isStaff && !!lineUid && !myStaff;
  const pendingApproval = isStaff && !!myStaff && myStaff.status==='pending';
  const needWebPin = isStaff && !lineUid && !(myStaff && myStaff.status!=='pending');
  const isManager = !!(myStaff && myStaff.status!=='pending' && myStaff.role==='manager');
  const canStaffOpen = !!(store.pay && store.pay.staffCanOpen) && isManager;
  const canMgrStaff = isManager && !!(store.pay && store.pay.mgrManageStaff);
  const _mgrStaffTab = { key:'staff', label:TH?'พนักงาน':'Staff', icon:IC.store };
  const tabs = isStaff ? [...allTabs.filter(tb=>(canStaffOpen?['sell','orders','cash']:['sell','orders']).includes(tb.key)), ...(canMgrStaff?[_mgrStaffTab]:[])] : allTabs;
  const active = tabs.some(tb=>tb.key===tab) ? tab : 'sell';
  const lockedNow = isLocked(active);
  return (
    <>
      {lowAlert && <div onClick={()=>{ setLowAlert(null); setTab('stock'); }} style={{ position:'absolute', top:'calc(12px + env(safe-area-inset-top))', left:14, right:14, zIndex:9000, background:'#fff', border:'1.5px solid var(--danger)', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:11, boxShadow:'var(--shadow-lg)', cursor:'pointer' }} className="kd-pop">
        <span style={{ color:'var(--danger)' }}>{React.cloneElement(IC.bell,{size:20})}</span>
        <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13.5, fontWeight:700 }}>{TH?'วัตถุดิบใกล้หมด':'Low stock'}</div><div style={{ fontSize:12, color:'var(--ink-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lowAlert.slice(0,3).join(', ')}{lowAlert.length>3?` +${lowAlert.length-3}`:''}</div></div>
        <button onClick={(e)=>{ e.stopPropagation(); setLowAlert(null); }} style={{ border:'none', background:'var(--bg)', width:28, height:28, borderRadius:999, cursor:'pointer', flexShrink:0 }}>✕</button>
      </div>}
      <div style={{ position:'absolute', inset:0, bottom:74, display:'flex', flexDirection:'column' }}>
        {freeTier && <div style={{ flex:'0 0 auto', background:'var(--gold-soft,#FDF0E2)', color:'#8a5a12', display:'flex', alignItems:'center', gap:9, padding:'9px 14px', fontSize:12.5, fontWeight:600, borderBottom:'1px solid #f0dcc0' }}>
          <span>🔓</span><span style={{ flex:1 }}>{TH?'โหมดฟรี — ขาย/เงินสด ใช้ได้ปกติ':'Free mode — sell & cash only'}</span>
          <button onClick={()=>setTab('store')} style={{ border:'none', background:'var(--brand)', color:'#fff', borderRadius:8, padding:'5px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:12, cursor:'pointer' }}>{TH?'อัปเกรด':'Upgrade'}</button>
        </div>}
        <div style={{ position:'relative', flex:1, minHeight:0 }}>
        {!hasLine && <StaffIdentityBar store={store} onPick={setStaffName}/>}
        {needLineRegister ? <StaffRegisterGate lineUser={lineUser} lang={lang} onSubmit={(name,phone)=>store.registerStaff({line:lineUid,name,phone})}/> : pendingApproval ? <StaffPendingGate myStaff={myStaff} lang={lang}/> : needWebPin ? <StaffPinGate roster={roster} lang={lang} onPicked={(s)=>{ try{ localStorage.setItem('kd_staff_id',s.id); localStorage.setItem('kd_active_staff',s.name); }catch(e){} setStaffId(s.id); setStaffName(s.name); }}/> : lockedNow ? <LockedFeature tabKey={active} store={store} lang={lang} onStore={()=>setTab('store')}/> : <>
        {active==='home'  && <HomeScreen shop={store.shop} setShop={store.setShop} sub={store.sub} setSub={store.setSub} menu={store.menu} orders={store.orders} sales={store.sales} onGo={setTab} onUpgrade={()=>setUpgrade(true)} />}
        {active==='sell'  && (store.register && store.register.open
          ? ((typeof kdShiftExpired==='function' && kdShiftExpired(store.register, store.shop))
            ? ((isStaff && !canStaffOpen) ? <StaffWaitingGate lang={lang}/> : <StaleShiftGate store={store} onClose={()=>setTab('cash')} />)
            : <SellScreen menu={store.menu} addSale={store.addSale} addCat={store.addCat} nextQueue={store.nextQueue} shopName={store.shop.name} pay={store.pay} setPay={store.setPay} qrImg={store.pay.qrImg} slipMode={store.pay.slipReq||'optional'} chanCfg={store.chanCfg} addSaleMode={store.addSaleMode} toggleSaleMode={store.toggleSaleMode} removeSaleMode={store.removeSaleMode} addKitchenTicket={store.addKitchenTicket} bestSellers={bestList} register={store.register} shop={store.shop} onExpired={()=>setTab('cash')} members={store.members} findMemberByPhone={store.findMemberByPhone} findMemberById={store.findMemberById} addMember={store.addMember} earnMember={store.earnMember} redeemMember={store.redeemMember} />)
          : ((isStaff && !canStaffOpen) ? <StaffWaitingGate lang={lang}/> : <ShopClosedGate store={store} onOpen={()=>setTab('cash')} />))}
        {active==='orders'&& <OrdersScreen orders={store.orders} setOrders={store.setOrders} patchOrder={store.patchOrder} patchSale={store.patchSale} voidOrder={store.voidOrder} voidApproval={store.pay&&store.pay.voidApproval} canApproveVoid={!isStaff || (isManager && ((store.pay&&store.pay.voidApprover)||'owner')==='manager')} recordOrderSale={store.recordOrderSale} shopName={store.shop.name} voidPin={store.pay.voidPin} payTiming={store.pay.collectGate || (typeof store.pay.payTiming==='string'?store.pay.payTiming:'anytime')} pay={store.pay} soundOn={soundOn} onToggleSound={toggleSound} />}
        {active==='reports' && <ReportsScreen store={store} />}
        {active==='cash'  && <CashScreen store={store} manager={isStaff} onGoHours={()=>{ try{ window.__kdOpenHours=true; }catch(e){} setTab('store'); }} />}
        {active==='stock' && stockOn && <StockScreen raw={store.raw} addRaw={store.addRaw} updateRaw={store.updateRaw} deleteRaw={store.deleteRaw} purchases={store.purchases} addPurchase={store.addPurchase} wastes={store.wastes} addWaste={store.addWaste} deleteWaste={store.deleteWaste} />}
        {active==='store' && <StoreScreen menu={store.menu} setMenu={store.setMenu} chanCfg={store.chanCfg} addSaleMode={store.addSaleMode} toggleSaleMode={store.toggleSaleMode} removeSaleMode={store.removeSaleMode} setChannelGp={store.setChannelGp} pay={store.pay} setPay={store.setPay} members={store.members} shop={store.shop} setShop={store.setShop} register={store.register} orders={store.orders} sales={store.sales} onGo={setTab} addCat={store.addCat} updateCat={store.updateCat} deleteCat={store.deleteCat} sub={store.sub} setSub={store.setSub} costMode={store.costMode} setCostMode={store.setCostMode} raw={store.raw} setRaw={store.setRaw} addRaw={store.addRaw} startNewShop={store.startNewShop} purchases={store.purchases} addPurchase={store.addPurchase} quotes={store.quotes} addQuote={store.addQuote} updateQuote={store.updateQuote} deleteQuote={store.deleteQuote} riders={store.riders} addRider={store.addRider} updateRider={store.updateRider} deleteRider={store.deleteRider} staffList={store.staffList} addStaff={store.addStaff} removeStaff={store.removeStaff} updateStaff={store.updateStaff} />}
        {active==='staff' && <StaffRosterSheet shop={store.shop} staffList={store.staffList||[]} addStaff={store.addStaff} removeStaff={store.removeStaff} updateStaff={store.updateStaff} onClose={()=>setTab('sell')} managerView />}
        </>}
        </div>
      </div>
      <div style={{ position:'absolute', left:0, right:0, bottom:0 }}>
        <TabBar tabs={tabs} active={active} onChange={setTab} />
      </div>
      {upgrade && <SubscriptionSheet sub={store.sub} setSub={store.setSub} onClose={()=>setUpgrade(false)} />}
      <ExpiryReminder sub={store.sub} lang={lang} onUpgrade={()=>{ setTab('store'); setUpgrade(true); }} />
    </>
  );
}

function StaffWaitingGate({ lang }){
  const TH=lang!=='en';
  return (
    <div className="kd-screen"><div className="kd-body" style={{ padding:'0 18px 24px', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div className="kd-card" style={{ padding:'28px 20px', textAlign:'center', maxWidth:320 }}>
        <div style={{ width:64, height:64, borderRadius:999, background:'var(--brand-soft)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>{React.cloneElement(IC.clock||IC.store,{size:30})}</div>
        <div style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>{TH?'ยังไม่เปิดร้าน':'Shop not open'}</div>
        <div style={{ fontSize:13.5, color:'var(--ink-3)', lineHeight:1.55 }}>{TH?'รอให้เจ้าของร้านเปิดร้านก่อน จึงจะเริ่มขายได้ — เครื่องพนักงานเปิด/ปิดร้านเองไม่ได้':'Waiting for the owner to open the shop. Staff devices can’t open/close.'}</div>
      </div>
    </div></div>
  );
}

function StaffIdentityBar({ store, onPick }){
  const { lang } = useT(); const TH=lang!=='en';
  const [name,setName] = m2State(()=>{ try{ return localStorage.getItem('kd_active_staff')||''; }catch(e){ return ''; } });
  const [open,setOpen] = m2State(false);
  const [nn,setNn] = m2State('');
  const roster = store.staffList||[];
  const pick=(n)=>{ try{ localStorage.setItem('kd_active_staff', n); }catch(e){} setName(n); setOpen(false); if(onPick) onPick(n); };
  return (<>
    <div onClick={()=>setOpen(true)} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', background: name?'var(--brand-softer)':'#FDF0E2', cursor:'pointer', fontSize:12.5, borderBottom:'1px solid var(--hair)' }}>
      <span style={{ color: name?'var(--brand-ink)':'#8a5a12', fontWeight:700 }}>{name?(TH?'ผู้ทำรายการ: ':'Cashier: ')+name:(TH?'⚠️ ยังไม่ระบุผู้ทำรายการ — แตะเพื่อเลือก':'⚠️ Set cashier — tap')}</span>
      <span style={{ marginLeft:'auto', color:'var(--ink-3)' }}>{TH?'เปลี่ยน':'Change'}</span>
    </div>
    {open && <div onClick={()=>setOpen(false)} style={{ position:'absolute', inset:0, background:'rgba(10,20,16,.4)', zIndex:9500, display:'flex', alignItems:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', width:'100%', borderRadius:'22px 22px 0 0', padding:18, maxHeight:'80%', overflowY:'auto' }}>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>{TH?'เลือกผู้ทำรายการ':'Select cashier'}</div>
        <div style={{ fontSize:12.5, color:'var(--ink-3)', marginBottom:12 }}>{TH?'บิล/เงินเข้า-ออก จะบันทึกชื่อนี้':'Transactions will record this name'}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
          {roster.length===0 && <div style={{ fontSize:13, color:'var(--ink-3)' }}>{TH?'ยังไม่มีรายชื่อ — เพิ่มด้านล่าง':'No names yet — add below'}</div>}
          {roster.map(s=>(
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={()=>pick(s.name)} style={{ flex:1, textAlign:'left', border:'none', background: name===s.name?'var(--brand-soft)':'var(--bg)', color:'var(--ink)', borderRadius:12, padding:'12px 14px', fontFamily:'var(--font)', fontSize:15, fontWeight:600, cursor:'pointer' }}>{s.name}{name===s.name?' ✓':''}</button>
              <button onClick={()=>{ if(store.removeStaff && window.confirm(TH?`ลบ “${s.name}”?`:`Remove “${s.name}”?`)) store.removeStaff(s.id); }} style={{ border:'none', background:'none', color:'var(--ink-3)', cursor:'pointer', padding:6 }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={nn} onChange={e=>setNn(e.target.value)} placeholder={TH?'เพิ่มชื่อพนักงาน':'Add staff name'} style={{ flex:1, border:'1.5px solid var(--hair-2)', borderRadius:12, padding:'11px 13px', fontFamily:'var(--font)', fontSize:15 }}/>
          <button onClick={()=>{ const v=nn.trim(); if(!v) return; if(store.addStaff) store.addStaff(v); pick(v); setNn(''); }} style={{ border:'none', background:'var(--brand)', color:'#fff', borderRadius:12, padding:'0 18px', fontFamily:'var(--font)', fontWeight:700, cursor:'pointer' }}>{TH?'เพิ่ม':'Add'}</button>
        </div>
      </div>
    </div>}
  </>);
}

/* ── staff gates: LINE สมัครใหม่/รออนุมัติ · เว็บเลือกชื่อ+PIN ── */
function StaffRegisterGate({ lineUser, lang, onSubmit }){
  const TH=lang!=='en'; const [nm,setNm]=m2State(''); const [ph,setPh]=m2State('');
  return (<div className="kd-screen"><div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'34px 26px', textAlign:'center' }}>
    <div style={{ width:72,height:72,borderRadius:999,overflow:'hidden',background:'#E6EEF6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:34,marginBottom:14 }}>{lineUser&&lineUser.avatar?<img alt="" src={lineUser.avatar} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:'🧑‍🍳'}</div>
    <div style={{ fontSize:19,fontWeight:700,marginBottom:5 }}>{TH?'ลงทะเบียนพนักงานใหม่':'Register as staff'}</div>
    <div style={{ fontSize:13,color:'var(--ink-3)',lineHeight:1.55,marginBottom:18,maxWidth:300 }}>{TH?`LINE: ${(lineUser&&lineUser.name)||''} · กรอกชื่อที่ใช้ทำงาน + เบอร์ ส่งให้เจ้าของอนุมัติ`:'Enter your work name & phone for the owner to approve.'}</div>
    <div style={{ width:'100%',maxWidth:330,display:'flex',flexDirection:'column',gap:10,textAlign:'left' }}>
      <div><div style={{fontSize:12,fontWeight:700,color:'var(--ink-2)',marginBottom:5}}>{TH?'ชื่อ/ชื่อเล่นที่ใช้ในร้าน':'Work name'}</div><input className="kd-input" value={nm} onChange={e=>setNm(e.target.value)} placeholder={TH?'เช่น สมชาย':'e.g. Somchai'}/></div>
      <div><div style={{fontSize:12,fontWeight:700,color:'var(--ink-2)',marginBottom:5}}>{TH?'เบอร์โทรศัพท์':'Phone'}</div><input className="kd-input num" type="tel" value={ph} onChange={e=>setPh(e.target.value)} placeholder="08x-xxx-xxxx"/></div>
      <button onClick={()=>nm.trim()&&onSubmit(nm.trim(),ph.trim())} disabled={!nm.trim()} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:14, marginTop:4, opacity:nm.trim()?1:.5 }}>{TH?'ส่งให้เจ้าของอนุมัติ':'Send for approval'}</button>
    </div>
  </div></div>);
}
function StaffPendingGate({ myStaff, lang }){
  const TH=lang!=='en';
  return (<div className="kd-screen"><div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 30px',textAlign:'center',gap:14 }}>
    <div style={{ width:72,height:72,borderRadius:999,background:'#FDF0E2',color:'#B26A00',display:'flex',alignItems:'center',justifyContent:'center',fontSize:34 }}>⏳</div>
    <div style={{ fontSize:19,fontWeight:700 }}>{TH?'รอเจ้าของร้านอนุมัติ':'Waiting for approval'}</div>
    <div style={{ fontSize:13.5,color:'var(--ink-3)',lineHeight:1.6,maxWidth:300 }}>{TH?`ส่งคำขอในชื่อ “${(myStaff&&myStaff.name)||''}” แล้ว · เมื่อเจ้าของกดอนุมัติและกำหนดสิทธิ์ คุณจะเข้าใช้งานได้ทันที`:'Your request was sent. You can start once the owner approves.'}</div>
  </div></div>);
}
function StaffPinGate({ roster, lang, onPicked }){
  const TH=lang!=='en';
  const list=(roster||[]).filter(s=>s.status!=='pending' && s.name);
  const [sel,setSel]=m2State(null); const [pin,setPin]=m2State(''); const [err,setErr]=m2State('');
  const needPin=!!(sel&&sel.pin);
  const submit=()=>{ if(!sel) return; if(sel.pin && sel.pin!==pin.trim()){ setErr(TH?'รหัส PIN ไม่ถูกต้อง':'Wrong PIN'); return; } onPicked(sel); };
  return (<div className="kd-screen"><div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'34px 26px',textAlign:'center' }}>
    <div style={{ width:72,height:72,borderRadius:999,background:'#E6EEF6',color:'#2E6FB0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:34,marginBottom:14 }}>🔐</div>
    <div style={{ fontSize:19,fontWeight:700,marginBottom:6 }}>{TH?'เข้าสู่ระบบพนักงาน':'Staff sign-in'}</div>
    <div style={{ fontSize:13.5,color:'var(--ink-3)',lineHeight:1.55,marginBottom:20,maxWidth:300 }}>{TH?'เลือกชื่อของคุณจากทะเบียน แล้วกรอก PIN ที่เจ้าของร้านตั้งให้':'Pick your name and enter the PIN set by the owner.'}</div>
    {list.length===0
      ? <div style={{ fontSize:13, color:'var(--ink-3)', background:'var(--bg)', borderRadius:12, padding:'16px', maxWidth:320, lineHeight:1.6 }}>{TH?'ยังไม่มีรายชื่อในทะเบียน — ให้เจ้าของร้านเพิ่มพนักงาน + ตั้ง PIN ก่อน':'No staff registered — ask the owner to add staff & set a PIN first.'}</div>
      : !sel ? <div style={{ width:'100%', maxWidth:340, display:'flex', flexDirection:'column', gap:9 }}>
          {list.map(s=>(<button key={s.id} onClick={()=>{ setSel(s); setPin(''); setErr(''); }} style={{ border:'1.5px solid var(--hair-2)', background:'#fff', color:'var(--ink)', borderRadius:14, padding:'14px 16px', fontFamily:'var(--font)', fontSize:15.5, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:11 }}>
            <span style={{ width:34,height:34,borderRadius:999,background:(s.role==='manager')?'#B8860B':'#2E6FB0',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0 }}>{s.role==='manager'?'👑':'🧑‍🍳'}</span>
            <span style={{ flex:1, textAlign:'left' }}>{s.name}{s.role==='manager'?(TH?' · ผู้จัดการ':' · Manager'):''}</span></button>))}
        </div>
      : <div style={{ width:'100%', maxWidth:320 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>{TH?'สวัสดี':'Hi'} {sel.name} 👋</div>
          {needPin && <input className="kd-input num" style={{ textAlign:'center', fontSize:22, letterSpacing:6, marginBottom:10 }} type="password" inputMode="numeric" value={pin} onChange={e=>{ setPin(e.target.value.replace(/[^0-9]/g,'').slice(0,6)); setErr(''); }} placeholder="••••" autoFocus/>}
          {err && <div style={{ fontSize:12.5, color:'var(--danger)', fontWeight:600, marginBottom:10 }}>{err}</div>}
          <button onClick={submit} disabled={needPin&&!pin} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:14, opacity:(needPin&&!pin)?.5:1 }}>{TH?'เข้าสู่ระบบ':'Sign in'}</button>
          <button onClick={()=>{ setSel(null); setPin(''); setErr(''); }} style={{ border:'none', background:'none', color:'var(--ink-3)', cursor:'pointer', fontFamily:'var(--font)', fontSize:13, marginTop:10 }}>‹ {TH?'เลือกชื่ออื่น':'Pick another'}</button>
        </div>}
  </div></div>);
}

/* บังคับพนักงานเลือกชื่อก่อนทำรายการ (เครื่องกลางหน้าร้าน · ไม่ล็อกอิน LINE) */
function StaffPickGate({ store, lang, onPicked }){
  const TH=lang!=='en';
  const [nn,setNn] = m2State('');
  const roster = store.staffList||[];
  const pick=(n)=>{ try{ localStorage.setItem('kd_active_staff', n); }catch(e){} if(onPicked) onPicked(n); };
  const add=()=>{ const v=nn.trim(); if(!v) return; if(store.addStaff) store.addStaff(v); pick(v); setNn(''); };
  return (
    <div className="kd-screen" style={{ background:'transparent' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'34px 26px', textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:999, background:'#E6EEF6', color:'#2E6FB0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, marginBottom:14 }}>🧑‍🍳</div>
        <div style={{ fontSize:19, fontWeight:700, marginBottom:6 }}>{TH?'คุณเป็นใคร?':'Who are you?'}</div>
        <div style={{ fontSize:13.5, color:'var(--ink-3)', lineHeight:1.55, marginBottom:20, maxWidth:300 }}>{TH?'เลือกชื่อของคุณก่อนเริ่มขาย — ทุกบิลและการนำเงินเข้า-ออกจะบันทึกว่าใครเป็นคนทำ':'Pick your name before selling — every bill and cash move records who did it.'}</div>
        <div style={{ width:'100%', maxWidth:340, display:'flex', flexDirection:'column', gap:9, marginBottom:16 }}>
          {roster.length===0 && <div style={{ fontSize:13, color:'var(--ink-3)', background:'var(--bg)', borderRadius:12, padding:'14px' }}>{TH?'ยังไม่มีรายชื่อ — พิมพ์ชื่อคุณด้านล่างแล้วกดเพิ่ม':'No names yet — type yours below and add'}</div>}
          {roster.map(s=>(
            <button key={s.id} onClick={()=>pick(s.name)} style={{ border:'1.5px solid var(--hair-2)', background:'#fff', color:'var(--ink)', borderRadius:14, padding:'14px 16px', fontFamily:'var(--font)', fontSize:15.5, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:11 }}>
              <span style={{ width:34, height:34, borderRadius:999, background:'#2E6FB0', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🧑‍🍳</span>{s.name}</button>
          ))}
        </div>
        <div style={{ width:'100%', maxWidth:340, display:'flex', gap:8 }}>
          <input value={nn} onChange={e=>setNn(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') add(); }} placeholder={TH?'พิมพ์ชื่อของคุณ':'Type your name'} style={{ flex:1, border:'1.5px solid var(--hair-2)', borderRadius:12, padding:'12px 14px', fontFamily:'var(--font)', fontSize:15 }}/>
          <button onClick={add} disabled={!nn.trim()} style={{ border:'none', background:'var(--brand)', color:'#fff', borderRadius:12, padding:'0 20px', fontFamily:'var(--font)', fontWeight:700, fontSize:15, cursor:'pointer', opacity:nn.trim()?1:.5 }}>{TH?'เข้าใช้งาน':'Start'}</button>
        </div>
      </div>
    </div>
  );
}

function StaleShiftGate({ store, onClose }){
  const { lang } = useT(); const TH=lang==='th';
  const bd=store.register&&store.register.businessDate;
  const disp=(()=>{ try{ return new Date(bd+'T00:00:00').toLocaleDateString(TH?'th-TH':'en-US',{day:'numeric',month:'short'}); }catch(e){ return bd; } })();
  return (
    <div className="kd-screen" style={{ background:'transparent' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 30px', textAlign:'center', gap:16 }}>
        <div style={{ width:80, height:80, borderRadius:999, background:'#FDF0E2', display:'flex', alignItems:'center', justifyContent:'center', color:'#B26A00' }}>{React.cloneElement(IC.clock||IC.store,{size:38})}</div>
        <div style={{ fontSize:20, fontWeight:700 }}>{TH?'มีการเปิดร้านค้างข้ามวัน':'Store left open'}</div>
        <div style={{ fontSize:14, color:'var(--ink-2)', lineHeight:1.6, maxWidth:300 }}>{TH?`ยังเปิดร้านค้างตั้งแต่วันที่ ${disp} — ต้องปิดวันเก่าให้เรียบร้อยก่อน จึงจะเริ่มขายของวันนี้ได้`:`The store from ${disp} is still open. Close that day before selling today.`}</div>
        <button onClick={onClose} className="kd-btn kd-btn-primary" style={{ padding:'14px 24px', background:'#B26A00' }}>{React.cloneElement(IC.receipt,{size:18})} {TH?'ไปปิดวันเก่า':'Close old day'}</button>
      </div>
    </div>
  );
}

function ShopClosedGate({ store, onOpen }){
  const { lang } = useT(); const TH=lang==='th';
  return (
    <div className="kd-screen" style={{ background:'transparent' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 30px', textAlign:'center', gap:16 }}>
        <div style={{ width:80, height:80, borderRadius:999, background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-3)' }}>{React.cloneElement(IC.store,{size:38})}</div>
        <div style={{ fontSize:20, fontWeight:700 }}>{TH?'ยังไม่ได้เปิดร้านวันนี้':'Shop not opened yet'}</div>
        <div style={{ fontSize:14, color:'var(--ink-2)', lineHeight:1.6, maxWidth:290 }}>{TH?'เปิดร้าน (ใส่เงินทอนตั้งต้น) ก่อนถึงจะขายได้ — การปิดร้านต้องกระทบยอดสิ้นวันก่อนเปิดใหม่':'Open the cash day before selling. Close & reconcile before reopening.'}</div>
        <button onClick={onOpen} className="kd-btn kd-btn-primary" style={{ padding:'14px 24px' }}>{React.cloneElement(IC.wallet,{size:18})} {TH?'ไปเปิดร้าน (เปิด/ปิดร้าน)':'Open shop'}</button>
      </div>
    </div>
  );
}

Object.assign(window, { OrdersScreen, OrderCard, DashboardScreen, StoreScreen, ItemEditor, MerchantApp, LockedFeature, OwnerBlocked, DeviceLimitScreen, Empty, STATUS_LABEL, nextStatus, PaySettingsSheet, MembersSheet, Toggle, PAY_META, TIER, ShopProfileSheet, SubscriptionSheet, CostModeSheet, RiderTeamSheet, ShopTypeSheet, ModifiersEditor, StaleShiftGate });
