// kaidee-merchant.jsx — Merchant app: POS sell, orders, dashboard, store builder
const { useState:mUseState } = React;

/* ══════════════ POS SELL ══════════════ */
function SellScreen({ menu, addSale, addCat, nextQueue, shopName, pay, setPay, qrImg, slipMode, chanCfg, addKitchenTicket, register, shop, onExpired, members, findMemberByPhone, findMemberById, addMember, earnMember, redeemMember }){
  const { t, lang } = useT();
  const cats = useCats();
  const [cat,setCat] = mUseState('all');
  const [ticket,setTicket] = mUseState({});   // {lineKey:{id,qty,opts,add}}
  const [pick,setPick] = mUseState(null);     // menu item awaiting option choice
  const [openTicket,setOpenTicket] = mUseState(false);
  const [payStep,setPayStep] = mUseState(false);
  const [okScreen,setOkScreen] = mUseState(null);
  const [addCatOpen,setAddCatOpen] = mUseState(false);
  const [otype,setOtype] = mUseState('takeaway'); // takeaway | dinein | walkin
  const [table,setTable] = mUseState('');
  const [platNo,setPlatNo] = mUseState('');
  const [custName,setCustName] = mUseState('');
  const [note,setNote] = mUseState('');
  const [khun,setKhun] = mUseState(false);
  const custReq = (pay&&pay.custNameReq)||'optional';   // off | optional | required (ร้านตั้งที่หน้าขายได้)
  const instantPay = !!(pay&&pay.instantPay);   // (เดิม) fallback ถ้ายังไม่ตั้งจังหวะรายช่องทาง
  // ⭐ จังหวะเก็บเงินต่อช่องทางหน้าร้าน (dinein/walkin/takeaway): 'first'=เก็บก่อน · 'later'=ส่งออเดอร์ก่อน
  const _payTiming = (pay&&pay.payTiming&&typeof pay.payTiming==='object') ? pay.payTiming : null;
  const timingOf = (k)=> (_payTiming && _payTiming[k]) ? _payTiming[k] : (instantPay ? 'first' : 'later');
  const chargeFirst = timingOf(otype)==='first';
  const custFinal = ()=> member ? member.name : (custName.trim() ? (khun?'คุณ '+custName.trim():custName.trim()) : '');
  const platPick = (pay&&pay.platPick)||'dropdown';   // dropdown | buttons (ร้านเลือกวิธีแสดงแพลตฟอร์ม)
  const _modes = activeSaleModes(chanCfg||{});
  const inStoreModes = _modes.filter(k=> !isPlatform(chanCfg,k));
  const dlvModes = _modes.filter(k=> isPlatform(chanCfg,k));
  const isPlat = (k)=> isPlatform(chanCfg, k);
  const [slip,setSlip] = mUseState(null);
  const [pending,setPending] = mUseState(null);
  const toast = useToast();

  const list = menu.filter(m=> cat==='all' || m.cat===cat);
  const lines = Object.entries(ticket).filter(([,e])=>e&&e.qty>0);
  const count = lines.reduce((a,[,e])=>a+e.qty,0);
  const sub0  = lines.reduce((a,[,e])=> a + ((menuById(e.id)?.price||0)+(e.add||0))*e.qty, 0);
  const _vat  = (typeof kdVat==='function') ? kdVat(sub0, pay) : { gross:sub0, vat:0, base:sub0, mode:'off' };
  const total = _vat.gross;   // exclusive → บวก VAT เพิ่ม · อื่น ๆ = ยอดสินค้าเดิม
  const cost  = lines.reduce((a,[,e])=> a + (menuById(e.id)?.cost||0)*e.qty, 0);

  // ── สมาชิก (POS): ผูกสมาชิกกับบิล → คิดแต้ม/สแตมป์ + แลกส่วนลดตามเงื่อนไขร้าน ──
  const [member,setMember] = mUseState(null);
  const [memberSheet,setMemberSheet] = mUseState(false);
  const [redeemOn,setRedeemOn] = mUseState(false);
  const _L = (pay&&pay.loyalty)||{};
  const _rewardAt = Number(_L.rewardAt)>0?Number(_L.rewardAt):100;
  const _rewardBaht = Number(_L.rewardBaht)>0?Number(_L.rewardBaht):20;
  const canRedeem = !!(member && (Number(member.points)||0)>=_rewardAt);
  // ส่วนลดตามระดับสมาชิก (tier) — เงิน/ทอง เป็น % ของยอด · ใช้ร่วมแลกแต้มได้ตามตั้งค่า
  const _tierDisc = _L.tierDisc||{};
  const _tierPct = member ? (Number(_tierDisc[member.tier])||0) : 0;
  const _stack = _L.discStack!==false;
  const tierAmt = (member && _tierPct>0) ? Math.round(total*_tierPct/100) : 0;
  const redeemAmt = (redeemOn && canRedeem) ? Math.min(_rewardBaht, total) : 0;
  const redeemUsed = redeemAmt>0 && (_stack || tierAmt<=0 || redeemAmt>=tierAmt);
  const rawDisc = _stack ? (tierAmt + redeemAmt) : Math.max(tierAmt, redeemAmt);
  const discount = Math.min(rawDisc, total);
  const net = Math.max(0, total - discount);
  React.useEffect(()=>{ if(!canRedeem && redeemOn) setRedeemOn(false); }, [canRedeem, redeemOn]);

  const lineKey = (id,opts)=> id+'|'+((opts||[]).map(o=>o.g+':'+o.label).join('|'));
  const addLine = (id,d,opts,add)=> setTicket(prev=>{ const k=lineKey(id,opts); const cur=prev[k]; const nq=Math.max(0,((cur&&cur.qty)||0)+d); const n={...prev}; if(!nq) delete n[k]; else n[k]={ id, qty:nq, opts:opts||[], add:add||0 }; return n; });
  const bump = (key,d)=> setTicket(prev=>{ const cur=prev[key]; if(!cur) return prev; const nq=Math.max(0,cur.qty+d); const n={...prev}; if(!nq) delete n[key]; else n[key]={ ...cur, qty:nq }; return n; });
  const tapItem = (m)=>{ if(m.options&&m.options.length) setPick(m); else addLine(m.id,1,[],0); };
  const clear = ()=>{ setTicket({}); setOpenTicket(false); };

  const commit = (order, extra)=>{
    extra = extra || {};
    const later = !!order.payLater;
    const _sale = addSale({ items:order.items, channel:order.channel, pay:order.pay, platNo: order.platNo||'', customer:order.customer||'', note:order.note||'', memberId: order.memberId||null, total:order.total,
      cost:order.cost, fee:order.fee||0, qnum:order.qnum, table:order.table||null,
      payLater: later, paid: later?false:true,
      t:new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}), ...extra });
    // ส่งออเดอร์ก่อน เก็บเงินทีหลัง (payLater) → ตั๋วเข้าคิวแบบยังไม่ชำระ · เก็บเงินที่หน้าออเดอร์ตอนลูกค้ากินเสร็จ
    // ไม่ payLater = พนักงานยืนยันรับเงินตอนจบบิลแล้ว → เข้าคิวแบบ "ชำระ + ตรวจสลิปแล้ว"
    const confirmed = later
      ? { payLater:true, paid:false }
      : { paid:true, slipVerified:true, ...(extra.slipUrl?{ slipStatus:'verified' }:{}) };
    // เด้งตั๋วเข้าคิวออเดอร์ / จอครัว — แยกตามช่องทางขาย (order.channel) · ผูก saleId เพื่อ void ย้อนกันได้
    if(addKitchenTicket) addKitchenTicket({ no:order.no, items:order.items, channel:order.channel, pay:order.pay, platNo:order.platNo||'', total:order.total, cost:order.cost, qnum:order.qnum, table:order.table||null, customer:order.customer||'', note:order.note||'', when:'เลย', saleId:(_sale&&_sale.id)||null, ...extra, ...confirmed });
    // คิดแต้ม/สแตมป์ + หักแต้มที่แลกส่วนลด ให้สมาชิกที่ผูกกับบิล
    if(order.memberId && earnMember){ earnMember(order.memberId, order.total||0); if(order._redeem && redeemMember) redeemMember(order.memberId, order._redeem); }
    setOpenTicket(false); setTicket({}); setPlatNo(''); setCustName(''); setNote(''); setKhun(false); setMember(null); setRedeemOn(false); setOtype(inStoreModes[0]||'takeaway'); setTable('');
    const _pr=(pay&&pay.print&&typeof pay.print==='object')?pay.print:{}; const _rmode=_pr.mode||'ask';
    if(_rmode==='off' && !_pr.kitchenAuto){ /* ไม่ออกใบเสร็จ + ไม่พิมพ์ครัวอัตโนมัติ = ไม่เปิดหน้าพิมพ์ */ }
    else setSlip(order);
  };
  const finish = (pay)=>{
    // กันคีย์ขายข้ามวัน: เกินเวลาปิดกะแล้ว → แจ้งเตือน ให้ปิดวันแล้วเปิดทำการขายใหม่
    if(register && shop && typeof window!=='undefined' && window.kdShiftExpired && window.kdShiftExpired(register, shop)){
      try{ window.alert(lang==='th'?'เกินเวลาปิดร้าน — คีย์ขายข้ามวันไม่ได้ กรุณาปิดวันแล้วเปิดทำการขายใหม่':'Store past close — cannot key sales across days. Close the day and reopen.'); }catch(e){}
      if(onExpired) onExpired();
      return;
    }
    const platform=isPlat(otype);
    if(!platform && custReq==='required' && !custName.trim()){ try{ window.alert(lang==='th'?'กรุณาใส่ชื่อลูกค้าก่อน':'Enter customer name first'); }catch(e){} return; }
    const q = otype==='dinein' ? null : (nextQueue? nextQueue(otype) : Math.floor(Math.random()*90+10));
    const its = lines.map(([,e])=>[e.id, e.qty, (e.opts||[]).map(o=>o.label).join(', '), e.add||0]);
    const payFinal = platform ? 'platform' : pay;
    const order = { no: Math.floor(Math.random()*400+600), items:its,
      channel:otype, pay:payFinal, platNo: platNo||'', customer: platform?'':custFinal(), note: note.trim(), memberId: member?member.id:null, _redeem: redeemUsed?_rewardAt:0, memberDisc: tierAmt||0, total:net, cost, table: otype==='dinein'?(table||'-'):null, qnum:q, when:'เลย' };
    if(!platform && pay==='promptpay'){
      // ยังไม่ชำระ — โชว์ QR/ยืนยันก่อน ค่อยบันทึกตอนกดยืนยัน (กดย้อนเปลี่ยนวิธีจ่ายได้)
      setPayStep(false);
      setOkScreen({ total:net, pay, count, qrImg, order });
      return;
    }
    commit(order);
    setPayStep(false);
  };
  // ส่งออเดอร์เข้าครัวก่อน — ยังไม่เก็บเงิน (payLater) · เก็บที่หน้าออเดอร์ตอนลูกค้ากินเสร็จ
  const finishLater = ()=>{
    if(register && shop && typeof window!=='undefined' && window.kdShiftExpired && window.kdShiftExpired(register, shop)){
      try{ window.alert(lang==='th'?'เกินเวลาปิดร้าน — คีย์ขายข้ามวันไม่ได้ กรุณาปิดวันแล้วเปิดทำการขายใหม่':'Store past close — cannot key sales across days.'); }catch(e){}
      if(onExpired) onExpired();
      return;
    }
    if(!isPlat(otype) && custReq==='required' && !custName.trim()){ try{ window.alert(lang==='th'?'กรุณาใส่ชื่อลูกค้าก่อน':'Enter customer name first'); }catch(e){} return; }
    const q = otype==='dinein' ? null : (nextQueue? nextQueue(otype) : Math.floor(Math.random()*90+10));
    const its = lines.map(([,e])=>[e.id, e.qty, (e.opts||[]).map(o=>o.label).join(', '), e.add||0]);
    const order = { no: Math.floor(Math.random()*400+600), items:its, channel:otype, pay:'later', payLater:true,
      platNo: platNo||'', customer: isPlat(otype)?'':custFinal(), note: note.trim(), memberId: member?member.id:null, _redeem: redeemUsed?_rewardAt:0, memberDisc: tierAmt||0, total:net, cost, table: otype==='dinein'?(table||'-'):null, qnum:q, when:'เลย' };
    commit(order);
    setPayStep(false);
  };

  return (
    <div className="kd-screen">
      <TopBar title={t('sell')} sub={new Date().toLocaleDateString(lang==='th'?'th-TH':'en-US',{weekday:'long', day:'numeric', month:'short'})}
        right={<div style={{ width:42, height:42, borderRadius:12, background:'#fff', boxShadow:'var(--shadow)',
          display:'flex', alignItems:'center', justifyContent:'center', color:'var(--brand)' }}>{IC.scan}</div>} />

      {/* category chips */}
      <div className="kd-chiprow" style={{ padding:'2px 18px 12px', flexShrink:0 }}>
        {[{id:'all',th:'ทั้งหมด',en:'All',emoji:'🍽️'},...cats].map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} className={'kd-chip-btn'+(c.id===cat?' on':'')}>
            <span>{c.emoji}</span>{c[lang]||c.th}</button>
        ))}
        {addCat && <button className="kd-chip-add" onClick={()=>setAddCatOpen(true)} title={lang==='th'?'เพิ่มหมวด':'Add category'}>{React.cloneElement(IC.plus,{size:18})}</button>}
      </div>

      {/* menu grid */}
      <div className="kd-body" style={{ padding:'0 14px 120px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 }}>
          {list.map(m=>(
            <button key={m.id} onClick={()=>!m.off&&tapItem(m)} disabled={m.off} className="kd-card kd-fadein" style={{ border:'none',
              cursor: m.off?'not-allowed':'pointer', textAlign:'left', padding:10, display:'flex', flexDirection:'column', gap:8,
              position:'relative', fontFamily:'var(--font)', opacity: m.off?0.6:1 }}>
              <div style={{ position:'relative' }}>
                <FoodTile item={m} size={'100%'} radius={13} />
                {m.off && <div style={{ position:'absolute', inset:0, borderRadius:13, background:'rgba(255,255,255,.35)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ background:'var(--ink)', color:'#fff', fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:999 }}>{lang==='th'?'สินค้าหมด':'Sold out'}</span></div>}
              </div>
              <div>
                <div style={{ fontSize:13.5, fontWeight:600, lineHeight:1.2, color:'var(--ink)',
                  display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', minHeight:33 }}>{m[lang]||m.th}</div>
                <div className="num" style={{ fontSize:16, fontWeight:700, color:'var(--brand-ink)', marginTop:3 }}>{money(m.price)}</div>
              </div>
              {ticket[m.id]>0 && <span className="kd-pop" style={{ position:'absolute', top:6, right:6,
                background:'var(--brand)', color:'#fff', width:24, height:24, borderRadius:999, fontSize:13,
                fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{ticket[m.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* floating ticket bar */}
      {count>0 && (
        <div className="kd-pop" style={{ position:'absolute', left:14, right:14, bottom:22, zIndex:20 }}>
          <button onClick={()=>setOpenTicket(true)} className="kd-btn kd-btn-primary kd-btn-block"
            style={{ justifyContent:'space-between', padding:'16px 20px', boxShadow:'var(--shadow-lg)' }}>
            <span style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ background:'rgba(255,255,255,.25)', width:26, height:26, borderRadius:999,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>{count}</span>
              {t('cart')}
            </span>
            <span className="num" style={{ fontSize:18 }}>{money(total)}</span>
          </button>
        </div>
      )}

      {/* ticket sheet */}
      <Sheet open={openTicket && !payStep} onClose={()=>setOpenTicket(false)}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 20px 10px' }}>
          <div style={{ fontSize:19, fontWeight:700 }}>{t('cart')}</div>
          <button onClick={clear} className="kd-btn" style={{ padding:'6px 12px', fontSize:13, background:'var(--brand-soft)', color:'var(--brand-ink)' }}>{t('clear')}</button>
        </div>
        <div style={{ overflowY:'auto', padding:'0 20px 28px', flex:1, WebkitOverflowScrolling:'touch' }}>
          {lines.map(([key,e])=>{ const m=menuById(e.id)||{}; const unit=(m?.price||0)+(e.add||0); const optTxt=(e.opts||[]).map(o=>o.label).join(', '); return (
            <div key={key} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:'1px solid var(--hair)' }}>
              <FoodTile item={m} size={46} radius={11}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14.5, fontWeight:600 }}>{m[lang]||m.th||''}</div>
                {optTxt && <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:1 }}>{optTxt}</div>}
                <div className="num" style={{ fontSize:13, color:'var(--ink-3)' }}>{money(unit)} {t('each')}</div>
              </div>
              <Stepper q={e.qty} onDec={()=>bump(key,-1)} onInc={()=>bump(key,1)}/>
              <div className="num" style={{ width:56, textAlign:'right', fontWeight:700, fontSize:15 }}>{money(unit*e.qty)}</div>
            </div>
          );})}
          {!isPlat(otype) && <MemberBar member={member} canRedeem={canRedeem} redeemOn={redeemOn} setRedeemOn={setRedeemOn} rewardBaht={_rewardBaht} rewardAt={_rewardAt} lang={lang} onOpen={()=>setMemberSheet(true)} onClear={()=>{ setMember(null); setRedeemOn(false); }} />}
          {/* order type / sale channel (manual key-in) */}
          <div style={{ fontSize:12, fontWeight:600, color:'var(--ink-3)', margin:'0 2px 7px' }}>{lang==='th'?'ประเภท / ช่องทางขาย':'Type / sale channel'}</div>
          <div className="kd-chiprow" style={{ marginBottom:10 }}>
            {inStoreModes.map(k=>{ const m=chMeta(chanCfg,k); const ic=(CHANNELS[k]&&CHANNELS[k].ic)||IC.store; return (
              <button key={k} onClick={()=>setOtype(k)} className={'kd-chip-btn'+(otype===k?' on':'')}>{React.cloneElement(ic,{size:15,color:'currentColor'})}{m[lang]||m.th}</button>
            ); })}
          </div>
          {dlvModes.length>0 && <>
          <div style={{ display:'flex', alignItems:'center', gap:6, margin:'0 2px 7px', flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--ink-3)' }}>{lang==='th'?'แพลตฟอร์มภายนอก · คีย์มือบันทึกยอด':'External platforms · key in manually'}</span>
            {setPay && <div style={{ display:'flex', gap:3, marginLeft:'auto' }}>
              {[['buttons',lang==='th'?'ปุ่ม':'Buttons'],['dropdown',lang==='th'?'เมนู':'Dropdown']].map(([v,lb])=>(
                <button key={v} onClick={()=>setPay(p=>({ ...p, platPick:v }))} style={{ border:'none', cursor:'pointer', borderRadius:999, padding:'3px 10px', fontFamily:'var(--font)', fontSize:11, fontWeight:700, background: platPick===v?'var(--brand)':'var(--brand-soft)', color: platPick===v?'#fff':'var(--brand-ink)' }}>{lb}</button>
              ))}
            </div>}
          </div>
          {platPick==='buttons'
            ? <div className="kd-chiprow" style={{ marginBottom:12 }}>
                {dlvModes.map(k=>{ const m=chMeta(chanCfg,k); const ic=(CHANNELS[k]&&CHANNELS[k].ic)||IC.store; return (
                  <button key={k} onClick={()=>setOtype(k)} className={'kd-chip-btn'+(otype===k?' on':'')}>{React.cloneElement(ic,{size:15,color:'currentColor'})}{m[lang]||m.th}</button>
                ); })}
              </div>
            : <select className="kd-input" value={isPlat(otype)?otype:''} onChange={e=>{ if(e.target.value) setOtype(e.target.value); }} style={{ marginBottom:12, appearance:'auto' }}>
                <option value="">{lang==='th'?'— เลือกแพลตฟอร์มเดลิเวอรี —':'— Select delivery platform —'}</option>
                {dlvModes.map(k=>{ const m=chMeta(chanCfg,k); return <option key={k} value={k}>{m[lang]||m.th}</option>; })}
              </select>}
          </>}
          {otype==='dinein' && <input className="kd-input num" value={table} onChange={e=>setTable(e.target.value)} placeholder={lang==='th'?'หมายเลขโต๊ะ เช่น 5':'Table no.'} style={{ marginBottom:12 }}/>}
          {isPlat(otype) && <input className="kd-input" value={platNo} onChange={e=>setPlatNo(e.target.value)} placeholder={lang==='th'?'เลขออเดอร์ฝั่งแพลตฟอร์ม (อ้างอิงเวลามีปัญหา)':'Platform order no.'} style={{ marginBottom:12 }}/>}
          {!isPlat(otype) && <>
            {custReq!=='off' && <input className="kd-input" value={custName} onChange={e=>setCustName(e.target.value)} placeholder={lang==='th'?(custReq==='required'?'ชื่อลูกค้า (จำเป็น · โชว์บนจอคิว)':'ชื่อลูกค้า (ไม่บังคับ · โชว์บนจอคิว)'):'Customer name'} style={{ marginBottom:8 }}/>}
            {custReq!=='off' && <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, fontSize:12.5, color:'var(--ink-2)', cursor:'pointer' }}>
              <input type="checkbox" checked={khun} onChange={e=>setKhun(e.target.checked)} style={{ width:17, height:17, accentColor:'var(--brand)' }}/>
              {lang==='th'?'นำหน้าชื่อด้วย “คุณ” อัตโนมัติ':'Auto-prefix name with “คุณ”'}</label>}
            {setPay && <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, flexWrap:'wrap' }}>
              <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:600 }}>{lang==='th'?'ชื่อลูกค้าบนคิว:':'Name on queue:'}</span>
              {[['off',lang==='th'?'ปิด':'Off'],['optional',lang==='th'?'ไม่บังคับ':'Optional'],['required',lang==='th'?'บังคับใส่':'Required']].map(([v,lb])=>(
                <button key={v} onClick={()=>setPay(p=>({ ...p, custNameReq:v }))} style={{ border:'none', cursor:'pointer', borderRadius:999, padding:'4px 11px', fontFamily:'var(--font)', fontSize:11.5, fontWeight:700,
                  background: custReq===v?'var(--brand)':'var(--brand-soft)', color: custReq===v?'#fff':'var(--brand-ink)' }}>{lb}</button>
              ))}
            </div>}
          </>}
          <input className="kd-input" value={note} onChange={e=>setNote(e.target.value)} placeholder={lang==='th'?'หมายเหตุถึงครัว (ไม่บังคับ · โชว์บนออเดอร์/จอคิว)':'Note to kitchen (optional)'} style={{ marginBottom:12 }}/>
          <Row k={t('subtotal')} v={money(total)} />
          {tierAmt>0 && (_stack || tierAmt>=redeemAmt) && <Row k={<span style={{color:'var(--brand-ink)'}}>{lang==='th'?`ส่วนลดสมาชิก${member&&member.tier==='gold'?'ทอง':member&&member.tier==='silver'?'เงิน':''} ${_tierPct}%`:`Tier discount ${_tierPct}%`}</span>} v={<span style={{color:'var(--brand-ink)',fontWeight:700}}>−{money(tierAmt)}</span>} />}
          {redeemUsed && <Row k={<span style={{color:'var(--brand-ink)'}}>{lang==='th'?`แลกส่วนลด (หัก ${_rewardAt} แต้ม)`:`Redeem (−${_rewardAt} pts)`}</span>} v={<span style={{color:'var(--brand-ink)',fontWeight:700}}>−{money(redeemAmt)}</span>} />}
          {discount>0 && <Row k={<b>{lang==='th'?'ยอดสุทธิ':'Net'}</b>} v={<b className="num">{money(net)}</b>} />}
          <Row k={<span style={{color:'var(--ink-3)'}}>{t('cost')} · {t('profit')}</span>}
               v={<span style={{color:'var(--ink-3)', fontWeight:600}}>{money(cost)} · <span style={{color:'var(--brand-ink)'}}>{money(net-cost)}</span></span>} small/>
          {isPlat(otype)
            ? <button onClick={()=>finish('platform')} className="kd-btn kd-btn-primary kd-btn-block" style={{ marginTop:12, padding:'16px' }}>
                {lang==='th'?'บันทึกยอดแพลตฟอร์ม':'Record platform sale'} · {money(total)}</button>
            : (chargeFirst)
              ? <>
                  <button onClick={()=>setPayStep(true)} className="kd-btn kd-btn-primary kd-btn-block" style={{ marginTop:12, padding:'16px' }}>
                    💰 {lang==='th'?'เก็บเงินทันที':'Charge now'} · {money(net)}</button>
                  <button onClick={finishLater} className="kd-btn kd-btn-block" style={{ marginTop:8, padding:'13px', background:'var(--brand-soft)', color:'var(--brand-ink)', fontWeight:700 }}>
                    🍽️ {lang==='th'?'หรือส่งออเดอร์ เก็บเงินทีหลัง':'Or send order · pay later'} · {money(net)}</button>
                </>
              : <>
                  <button onClick={finishLater} className="kd-btn kd-btn-primary kd-btn-block" style={{ marginTop:12, padding:'16px' }}>
                    🍽️ {lang==='th'?'ส่งออเดอร์ · เก็บเงินทีหลัง':'Send order · pay later'} · {money(net)}</button>
                  <button onClick={()=>setPayStep(true)} className="kd-btn kd-btn-block" style={{ marginTop:8, padding:'13px', background:'var(--brand-soft)', color:'var(--brand-ink)', fontWeight:700 }}>
                    {lang==='th'?'หรือเก็บเงินเลย':'Or charge now'} · {money(net)}</button>
                </>}
        </div>
      </Sheet>

      {/* payment sheet */}
      <Sheet open={payStep} onClose={()=>setPayStep(false)}>
        <div style={{ padding:'6px 20px 4px', fontSize:19, fontWeight:700 }}>{t('charge')} {money(net)}</div>
        <div style={{ fontSize:13, color:'var(--ink-3)', padding:'0 20px 12px' }}>{lang==='th'?'เลือกช่องทางรับเงิน':'Select payment method'}</div>
        <div style={{ padding:'0 20px 8px', display:'flex', flexDirection:'column', gap:10 }}>
          {['promptpay','cash'].map(p=>(
            <button key={p} onClick={()=>finish(p)} className="kd-card" style={{ border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', gap:14, padding:'15px 16px', fontFamily:'var(--font)', textAlign:'left' }}>
              <span style={{ color:'var(--brand)' }}>{React.cloneElement(PAYS[p].ic,{size:26})}</span>
              <span style={{ flex:1, fontSize:16, fontWeight:600 }}>{PAYS[p][lang]||PAYS[p].th}</span>
              <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
            </button>
          ))}
        </div>
      </Sheet>

      {/* success overlay */}
      {okScreen && <PaySuccess data={okScreen} slipMode={slipMode||'optional'} ppName={shopName}
        onBack={()=>{ setOkScreen(null); setPayStep(true); }}
        onConfirm={(extra)=>{ const o=okScreen.order; setOkScreen(null); commit(o, extra||{}); }} />}
      {pick && <PosOptionSheet item={pick} onClose={()=>setPick(null)} onAdd={(opts,add)=>{ addLine(pick.id,1,opts,add); setPick(null); }}/>}
      {slip && <PrintSlip order={slip} shopName={shopName} onClose={()=>setSlip(null)}
        receiptMode={((pay&&pay.print&&pay.print.mode)||'ask')} kitchenAuto={!!(pay&&pay.print&&pay.print.kitchenAuto)} paperDefault={(pay&&pay.print&&pay.print.paper)||'80'} />}
      {addCatOpen && <AddCatSheet onClose={()=>setAddCatOpen(false)} onAdd={(c)=>{ const id=addCat(c); setCat(id); setAddCatOpen(false); toast.show(lang==='th'?'เพิ่มหมวดแล้ว':'Category added'); }}/>}
      {memberSheet && <MemberPickSheet members={members||[]} findMemberByPhone={findMemberByPhone} findMemberById={findMemberById} addMember={addMember} lang={lang} onClose={()=>setMemberSheet(false)} onPick={(m)=>{ setMember(m); setMemberSheet(false); }}/>}
      {toast.node}
    </div>
  );
}

function PosOptionSheet({ item, onClose, onAdd }){
  const { t, lang } = useT(); const TH = lang==='th';
  const groups = item.options||[];
  const [sel,setSel] = mUseState(()=>{ const s={}; groups.forEach(g=>{ s[g.id]= g.multi?[]:(g.choices.length?0:null); }); return s; });
  const pickChoice = (g, ci)=> setSel(prev=>{ const n={...prev}; if(g.multi){ const arr=new Set(n[g.id]||[]); arr.has(ci)?arr.delete(ci):arr.add(ci); n[g.id]=[...arr]; } else { n[g.id]=ci; } return n; });
  const chosen = [];
  groups.forEach(g=>{ const v=sel[g.id]; if(g.multi){ (v||[]).forEach(ci=>{ const c=g.choices[ci]; if(c) chosen.push({ g:g.name, label:c.label, price:c.price||0 }); }); } else if(v!=null){ const c=g.choices[v]; if(c) chosen.push({ g:g.name, label:c.label, price:c.price||0 }); } });
  const add = chosen.reduce((a,c)=>a+(c.price||0),0);
  const unit = (item.price||0)+add;
  return (
    <Sheet open={true} onClose={onClose} height="78%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 10px' }}>
        <div style={{ fontSize:18, fontWeight:700 }}>{item[lang]||item.th}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        {groups.map(g=>{ const v=sel[g.id]; return (
          <div key={g.id} style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:7, marginBottom:9 }}>
              <div style={{ fontSize:15, fontWeight:700 }}>{g.name}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)' }}>{g.multi?(TH?'เลือกได้หลาย':'any'):(TH?'เลือก 1':'one')}</div>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {g.choices.map((c,ci)=>{ const on = g.multi ? (v||[]).includes(ci) : v===ci; return (
                <button key={ci} onClick={()=>pickChoice(g,ci)} style={{ border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'), background:on?'var(--brand-soft)':'#fff', color:on?'var(--brand-ink)':'var(--ink-2)', cursor:'pointer', borderRadius:11, padding:'9px 13px', fontFamily:'var(--font)', fontWeight:600, fontSize:13.5 }}>{c.label}{c.price>0?` +${money(c.price)}`:''}</button>
              );})}
            </div>
          </div>
        );})}
      </div>
      <div style={{ padding:'12px 20px 0' }}>
        <button onClick={()=>onAdd(chosen, add)} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15, justifyContent:'space-between' }}>
          <span>{TH?'ใส่ตะกร้า':'Add'}</span><span className="num">{money(unit)}</span></button>
      </div>
    </Sheet>
  );
}

function Stepper({ q, onDec, onInc }){
  return (
    <div style={{ display:'flex', alignItems:'center', gap:2, background:'var(--brand-softer)', borderRadius:999, padding:3 }}>
      <button onClick={onDec} style={sqBtn}>{React.cloneElement(IC.minus,{size:16, color:'var(--brand-ink)'})}</button>
      <span className="num" style={{ width:22, textAlign:'center', fontWeight:700, fontSize:15 }}>{q}</span>
      <button onClick={onInc} style={sqBtn}>{React.cloneElement(IC.plus,{size:16, color:'#fff'})}</button>
    </div>
  );
}
const sqBtn = { width:28, height:28, borderRadius:999, border:'none', cursor:'pointer', background:'transparent',
  display:'flex', alignItems:'center', justifyContent:'center' };
const sqBtnFill = { ...sqBtn, background:'var(--brand)' };

function Row({ k, v, small }){
  return <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'3px 0',
    fontSize: small?13:16, fontWeight: small?500:700 }}><span>{k}</span><span className="num">{v}</span></div>;
}

function PaySuccess({ data, slipMode, ppName, onConfirm, onBack }){
  const { t, lang } = useT(); const TH = lang==='th';
  const [scanMode,setScanMode] = mUseState('show'); // show = ลูกค้าสแกน QR ร้าน · scan = ร้านเปิดกล้องสแกนลูกค้า
  const [stage,setStage] = mUseState('pay'); // pay | slip
  const [slipImg,setSlipImg] = mUseState(null);
  const videoRef = React.useRef(null);
  React.useEffect(()=>{
    let stream;
    if(stage==='pay' && scanMode==='scan' && navigator.mediaDevices){
      navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } }).then(st=>{ stream=st; if(videoRef.current){ videoRef.current.srcObject=st; try{ videoRef.current.play(); }catch(e){} } }).catch(()=>{});
    }
    return ()=>{ if(stream) stream.getTracks().forEach(tr=>tr.stop()); };
  },[stage,scanMode]);
  const cap = (file)=>{ if(!file) return; const r=new FileReader(); r.onload=()=>setSlipImg(r.result); r.readAsDataURL(file); };
  const proceed = ()=>{ if((slipMode||'optional')==='off') onConfirm({}); else setStage('slip'); };
  const done = ()=>{ onConfirm(slipImg?{ slipUrl:slipImg, verified:true }:{}); };
  return (
    <div style={{ position:'fixed', inset:0, zIndex:600, background:'#fff', display:'flex', flexDirection:'column', animation:'kdFade .25s ease' }}>
      {stage==='pay' ? (<>
        <div style={{ padding:'18px 20px 6px', display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={onBack} style={{ border:'none', background:'var(--bg)', borderRadius:999, padding:'8px 14px', cursor:'pointer', fontFamily:'var(--font)', fontWeight:700, fontSize:13, color:'var(--ink-2)', display:'flex', alignItems:'center', gap:5 }}>← {TH?'เปลี่ยนวิธีจ่าย':'Change method'}</button>
          <div style={{ marginLeft:'auto', fontSize:12.5, color:'var(--ink-3)', fontWeight:600 }}>{TH?'ยังไม่ชำระ':'Awaiting payment'}</div>
        </div>
        <div style={{ padding:'0 20px 8px' }}>
          <div style={{ display:'flex', gap:6, background:'var(--bg)', borderRadius:12, padding:4 }}>
            {[['show',TH?'ลูกค้าสแกน QR ร้าน':'Customer scans'],['scan',TH?'ร้านสแกนลูกค้า':'Shop scans']].map(([k,l])=>(
              <button key={k} onClick={()=>setScanMode(k)} style={{ flex:1, border:'none', cursor:'pointer', padding:'9px', borderRadius:9, fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, background:scanMode===k?'#fff':'transparent', color:scanMode===k?'var(--brand-ink)':'var(--ink-3)', boxShadow:scanMode===k?'var(--shadow)':'none' }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'8px 24px 0', gap:14 }}>
          {scanMode==='show' ? (<>
            <div style={{ fontSize:14.5, color:'var(--ink-2)', fontWeight:600 }}>{TH?'ให้ลูกค้าสแกนจ่าย':'Let the customer scan'}</div>
            <div className="kd-pop" style={{ padding:18, borderRadius:22, background:'#fff', boxShadow:'var(--shadow-lg)', border:'1px solid var(--hair)' }}>
              <QRBlock src={data.qrImg}/>
              <div style={{ textAlign:'center', marginTop:10, fontWeight:700 }}>{TH?'พร้อมเพย์':'PromptPay'}{ppName?' · '+ppName:''}</div>
            </div>
          </>) : (<>
            <div style={{ fontSize:14.5, color:'var(--ink-2)', fontWeight:600 }}>{TH?'เล็งกล้องไปที่ QR ของลูกค้า':'Point at the customer’s QR'}</div>
            <div style={{ width:'100%', maxWidth:300, aspectRatio:'1', borderRadius:18, overflow:'hidden', background:'#111', position:'relative', border:'1px solid var(--hair)' }}>
              <video ref={videoRef} playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              <div style={{ position:'absolute', inset:'18%', border:'3px solid rgba(255,255,255,.85)', borderRadius:14 }}/>
            </div>
            <div style={{ fontSize:11.5, color:'var(--ink-3)', textAlign:'center', lineHeight:1.5 }}>{TH?'ถ้ากล้องไม่ขึ้น อนุญาตการใช้กล้อง แล้วสแกนด้วยแอปธนาคาร':'Allow camera access, then scan with your banking app'}</div>
          </>)}
          <div className="num" style={{ fontSize:30, fontWeight:700, color:'var(--brand-ink)' }}>{money(data.total)}</div>
        </div>
        <div style={{ padding:'0 20px calc(20px + 20px)' }}>
          <button onClick={proceed} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:16 }}>{TH?'ยืนยันรับเงินแล้ว':'Confirm received'}</button>
        </div>
      </>) : (<>
        <div style={{ padding:'20px 20px 6px', fontSize:19, fontWeight:700 }}>{TH?'ถ่ายสลิปเป็นหลักฐาน':'Slip photo'}</div>
        <div style={{ padding:'0 20px 4px', fontSize:13, color:'var(--ink-3)', lineHeight:1.5 }}>{(slipMode==='required')?(TH?'ร้านตั้งให้ถ่ายสลิปก่อนจบบิล':'This shop requires a slip photo'):(TH?'ถ่ายสลิปไว้เป็นหลักฐาน หรือข้ามก็ได้':'Capture a slip, or skip')}</div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'8px 24px 0', gap:14 }}>
          {slipImg
            ? <img src={slipImg} alt="slip" style={{ maxWidth:'100%', maxHeight:'46vh', borderRadius:16, border:'1px solid var(--hair)' }}/>
            : <label style={{ width:'100%', maxWidth:300, aspectRatio:'3/4', borderRadius:18, border:'1.8px dashed var(--hair-2)', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer', color:'var(--ink-3)' }}>{React.cloneElement(IC.scan,{size:34})}<span style={{ fontSize:14, fontWeight:700 }}>{TH?'แตะเพื่อถ่าย / แนบสลิป':'Tap to take or attach a slip'}</span><input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>cap(e.target.files&&e.target.files[0])}/></label>}
          <div className="num" style={{ fontSize:26, fontWeight:700, color:'var(--brand-ink)' }}>{money(data.total)}</div>
          {slipImg && <label style={{ fontSize:13, fontWeight:700, color:'var(--brand-ink)', cursor:'pointer' }}>{TH?'ถ่าย/แนบใหม่':'Change'}<input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>cap(e.target.files&&e.target.files[0])}/></label>}
        </div>
        <div style={{ display:'flex', gap:10, padding:'0 20px calc(20px + 20px)' }}>
          {slipMode!=='required' && <button onClick={()=>onConfirm({})} className="kd-btn" style={{ flex:1, padding:16, background:'var(--bg)', color:'var(--ink-2)' }}>{TH?'ข้ามไปก่อน':'Skip'}</button>}
          <button onClick={done} disabled={slipMode==='required'&&!slipImg} className="kd-btn kd-btn-primary" style={{ flex:2, padding:16, opacity:(slipMode==='required'&&!slipImg)?.5:1 }}>{TH?'จบบิล':'Done'}</button>
        </div>
      </>)}
    </div>
  );
}
/* ══════════════ NEW CATEGORY SHEET ══════════════ */
const CAT_EMOJIS = ['🍚','🍜','🍧','🥤','🍔','🍗','🍕','🥗','🍰','☕','🧋','🍦','🌶️','🍱','🥟','🍢'];
function AddCatSheet({ onClose, onAdd, initial, onDelete }){
  const { t, lang } = useT();
  const [th,setTh] = mUseState(initial?.th||'');
  const [emoji,setEmoji] = mUseState(initial?.emoji||'🍽️');
  return (
    <Sheet open={true} onClose={onClose} height="70%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{initial?(lang==='th'?'แก้ไขหมวดหมู่':'Edit category'):(lang==='th'?'เพิ่มหมวดหมู่':'New category')}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:16 }}>
          <div style={{ width:64, height:64, borderRadius:16, background:'var(--brand-soft)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32 }}>{emoji}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--ink-2)', margin:'0 2px 6px' }}>{lang==='th'?'ชื่อหมวด':'Category name'}</div>
            <input className="kd-input" value={th} onChange={e=>setTh(e.target.value)} placeholder={lang==='th'?'เช่น อาหารเช้า, เซ็ตสุดคุ้ม':'e.g. Breakfast, Combo'}/>
          </div>
        </div>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--ink-2)', margin:'0 2px 8px' }}>{lang==='th'?'เลือกไอคอน':'Pick an icon'}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:8 }}>
          {CAT_EMOJIS.map(e=>(<button key={e} onClick={()=>setEmoji(e)} style={{ aspectRatio:'1', borderRadius:12, fontSize:22, cursor:'pointer',
            border: emoji===e?'2.5px solid var(--brand)':'2px solid var(--hair)', background: emoji===e?'var(--brand-soft)':'#fff' }}>{e}</button>))}
        </div>
      </div>
      <div style={{ display:'flex', gap:10, padding:'12px 20px 0' }}>
        {onDelete && <button onClick={onDelete} className="kd-btn" style={{ background:'#FCECE8', color:'var(--danger)', padding:'15px 18px' }}>{React.cloneElement(IC.x,{size:18})}</button>}
        <button onClick={()=>th.trim()&&onAdd({ th:th.trim(), en:th.trim(), emoji })} disabled={!th.trim()}
          className="kd-btn kd-btn-primary" style={{ flex:1, padding:15, opacity:th.trim()?1:.5 }}>{t('save')}</button>
      </div>
    </Sheet>
  );
}

function QRBlock({ src, payload, size=150 }){
  // PromptPay payload จริง → เรนเดอร์เป็น QR สแกนจ่ายได้ (lib: davidshimjs/qrcodejs)
  const boxRef = React.useRef(null);
  const hasLib = typeof window!=='undefined' && window.QRCode;
  React.useEffect(()=>{
    if(payload && boxRef.current && window.QRCode){
      boxRef.current.innerHTML = '';
      try{
        new window.QRCode(boxRef.current, { text:payload, width:size, height:size,
          colorDark:'#0B7A50', colorLight:'#ffffff', correctLevel:window.QRCode.CorrectLevel.M });
      }catch(e){ console.warn('QR render failed', e); }
    }
  }, [payload, size]);
  if(payload && hasLib) return <div ref={boxRef} style={{ width:size, height:size, display:'inline-block' }}/>;
  if(src) return <img src={src} alt="QR" style={{ width:size, height:size, objectFit:'contain', borderRadius:8, display:'block' }}/>;
  // decorative deterministic QR (เดโม / ยังไม่มี payload หรือ lib โหลดไม่ได้)
  const cells=[];
  const seed=[1,0,1,1,0,1,0,1,1,0,0,1,0,1,1,0,1,0,1,1,0,1,1,0,1];
  for(let r=0;r<11;r++)for(let c=0;c<11;c++){ const on=(seed[(r*3+c)%25]+r*c)%3===0; if(on)cells.push(<rect key={r+'-'+c} x={c*10+3} y={r*10+3} width="8" height="8" rx="1.5" fill="#0B7A50"/>); }
  const finder=(x,y)=>(<g key={x+'f'+y}><rect x={x} y={y} width="28" height="28" rx="6" fill="none" stroke="#0B7A50" strokeWidth="4"/><rect x={x+9} y={y+9} width="10" height="10" rx="2" fill="#0B7A50"/></g>);
  return <svg width={size} height={size} viewBox="0 0 122 122">{cells}{finder(3,3)}{finder(91,3)}{finder(3,91)}</svg>;
}

/* ══════════════ PRINT SLIP (receipt + kitchen bill) ══════════════ */
function PrintSlip({ order, shopName='ครัวขายดี', onClose, receiptMode='ask', kitchenAuto=false, paperDefault='80' }){
  const { t, lang } = useT();
  const TH = lang==='th';
  const [tab,setTab] = mUseState('receipt');
  const [paperW,setPaperW] = mUseState(()=>{ try{ return Number(localStorage.getItem('kd_paperW'))||Number(paperDefault)||80; }catch(e){ return Number(paperDefault)||80; } });
  const setPaper=(w)=>{ setPaperW(w); try{ localStorage.setItem('kd_paperW', String(w)); }catch(e){} };
  const [printing,setPrinting] = mUseState(false);
  const [printed,setPrinted] = mUseState(false);
  const [full,setFull] = mUseState(false);
  const [buyer,setBuyer] = mUseState({ name:'', taxId:'', addr:'', branch:'' });
  const ch = CHANNELS[order.channel]||{};
  const qtext = qLabel(order.channel, order.qnum, order.table);
  const sub = order.items.reduce((a,[id,q])=>a+(menuById(id)?.price||0)*q,0);
  const _pay = (typeof window!=='undefined' && window.__kdPay) || {};
  const vat = (typeof kdVat==='function') ? kdVat(sub, _pay) : { mode:'off', vat:0, base:sub, rate:7, gross:sub };
  const hasVat = vat.mode && vat.mode!=='off' && vat.vat>0;
  const vatRateTxt = String(Math.round(vat.rate||7));
  const isFull = hasVat && full;
  const docTitle = hasVat ? (isFull ? (TH?'ใบกำกับภาษี / TAX INVOICE':'TAX INVOICE') : (TH?'ใบกำกับภาษีอย่างย่อ / TAX INVOICE (ABB)':'TAX INVOICE (ABB)')) : (TH?'ใบเสร็จรับเงิน / RECEIPT':'RECEIPT');
  const now = new Date().toLocaleString(TH?'th-TH':'en-US',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
  const doPrint = (whichTab)=>{
    const curTab = whichTab||tab;
    const esc=(s)=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const rows=order.items.map(([id,q])=>{ const m=menuById(id)||{}; return { q, name:(m[lang]||m.th||''), price:(m.price||0)*q }; });
    const buyerHtml = isFull ? ('<div class="b name" style="font-size:10px">'+(TH?'ลูกค้า / Customer':'Customer')+'</div>'
      +(buyer.name?'<div class="name" style="font-size:10px">'+esc(buyer.name)+'</div>':'')
      +(buyer.taxId?'<div style="font-size:10px">'+(TH?'เลขผู้เสียภาษี ':'Tax ID ')+esc(buyer.taxId)+(buyer.branch?(' · '+esc(buyer.branch)):'')+'</div>':'')
      +(buyer.addr?'<div class="name" style="font-size:9px;color:#333">'+esc(buyer.addr)+'</div>':'')
      +'<div class="dash"></div>') : '';
    const css=`*{margin:0;padding:0;box-sizing:border-box}@page{size:${paperW}mm auto;margin:0}body{width:${paperW}mm;padding:${paperW===58?'2.5mm 3mm':'3mm 4mm'};font-family:'IBM Plex Mono',monospace;color:#000;font-size:12px}.c{text-align:center}.b{font-weight:700}.name{font-family:'IBM Plex Sans Thai',sans-serif}.dash{border-top:1px dashed #000;margin:7px 0}.row{display:flex;justify-content:space-between;margin-bottom:3px}.tot{display:flex;justify-content:space-between;font-size:16px;font-weight:700;margin-top:6px}.qbox{border:2px solid #000;border-radius:6px;text-align:center;padding:6px;margin:8px 0}.qbig{font-size:30px;font-weight:800;font-family:'IBM Plex Sans Thai',sans-serif}.kit{font-size:15px;font-weight:700;margin-bottom:6px;font-family:'IBM Plex Sans Thai',sans-serif}`;
    let body;
    if(curTab==='receipt'){
      body='<div class="c name b" style="font-size:15px">'+esc(shopName)+'</div>'
        +(hasVat?((_pay.taxId?'<div class="c" style="font-size:9.5px">'+(TH?'เลขผู้เสียภาษี ':'Tax ID ')+esc(_pay.taxId)+(_pay.taxBranch?(' · '+esc(_pay.taxBranch)):'')+'</div>':'')+(_pay.taxAddr?'<div class="c" style="font-size:9px;color:#333">'+esc(_pay.taxAddr)+'</div>':'')):'')
        +'<div class="c" style="font-size:10px">'+esc(docTitle)+'</div><div class="dash"></div>'
        +'<div class="row"><span>#'+order.no+'</span><span>'+now+'</span></div>'
        +'<div class="row"><span>'+esc(ch[lang]||ch.th||'')+'</span><span class="b">'+esc(qtext)+'</span></div><div class="dash"></div>'
        +buyerHtml
        +rows.map(r=>'<div class="row"><span class="name">'+r.q+' × '+esc(r.name)+'</span><span>'+r.price.toLocaleString()+'</span></div>').join('')
        +'<div class="dash"></div>'
        +(hasVat
          ? '<div class="row"><span>'+(TH?'มูลค่าก่อนภาษี':'Before VAT')+'</span><span>'+vat.base.toFixed(2)+'</span></div>'
            +'<div class="row"><span>'+(TH?'ภาษีมูลค่าเพิ่ม':'VAT')+' '+vatRateTxt+'%</span><span>'+vat.vat.toFixed(2)+'</span></div>'
          : '<div class="row"><span>'+(TH?'ยอดสินค้า':'Subtotal')+'</span><span>'+sub.toLocaleString()+'</span></div>')
        +(order.fee>0?'<div class="row"><span>'+(TH?'ค่าส่ง':'Delivery')+'</span><span>'+order.fee.toLocaleString()+'</span></div>':'')
        +'<div class="tot name"><span>'+(TH?'รวมทั้งสิ้น':'TOTAL')+'</span><span>฿'+(order.total||vat.gross).toLocaleString()+'</span></div>'
        +'<div style="font-size:11px;margin-top:6px">'+(TH?'ชำระโดย':'Paid by')+' '+esc((PAYS[order.pay]||{})[lang]||(PAYS[order.pay]||{}).th||'')+'</div>'
        +'<div class="dash"></div><div class="c name" style="font-size:11px;color:#333">'+(TH?'ขอบคุณที่ใช้บริการ':'Thank you')+'</div>';
    } else {
      body='<div class="row name b"><span>'+(TH?'บิลครัว KITCHEN':'KITCHEN')+'</span><span>'+esc(ch[lang]||ch.th||'')+'</span></div>'
        +'<div class="qbox"><div style="font-size:10px">'+(order.channel==='dinein'?(TH?'โต๊ะ':'TABLE'):(TH?'คิว':'QUEUE'))+'</div><div class="qbig">'+esc(qtext)+'</div></div>'
        +'<div class="row" style="font-size:11px"><span>#'+order.no+'</span><span>'+now+'</span></div><div class="dash"></div>'
        +rows.map(r=>'<div class="kit">'+r.q+'× '+esc(r.name)+'</div>').join('')
        +'<div class="dash"></div><div style="font-size:11px">'+((order.when && !/เลย|ASAP/.test(order.when))?(TH?('นัดรับ '+esc(order.when)):('Pickup '+esc(order.when))):(TH?'ทำทันที':'Cook now'))+'</div>';
    }
    const doc='<!DOCTYPE html><ht'+'ml><he'+'ad><meta charset="utf-8"><li'+'nk href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;700&family=IBM+Plex+Mono&display=swap" rel="stylesheet"><sty'+'le>'+css+'</sty'+'le></he'+'ad><bo'+'dy>'+body+'</bo'+'dy></ht'+'ml>';
    setPrinting(true);
    try{
      const ifr=document.createElement('iframe');
      ifr.setAttribute('aria-hidden','true');
      ifr.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      ifr.onload=()=>{ setTimeout(()=>{ try{ ifr.contentWindow.focus(); ifr.contentWindow.print(); }catch(e){ try{ window.print(); }catch(_){} }
        setPrinting(false); setPrinted(true); setTimeout(()=>setPrinted(false),1600);
        setTimeout(()=>{ try{ document.body.removeChild(ifr); }catch(e){} }, 900); }, 400); };
      document.body.appendChild(ifr);
      const d=ifr.contentWindow.document; d.open(); d.write(doc); d.close();
    }catch(e){ setPrinting(false); }
  };
  const dash = { borderTop:'1.5px dashed #bbb', margin:'9px 0' };
  // — auto-print ตามตั้งค่า: บิลครัวอัตโนมัติ / ใบเสร็จอัตโนมัติ —
  React.useEffect(()=>{
    if(receiptMode!=='auto' && !kitchenAuto) return;
    let alive=true; const nap=(ms)=>new Promise(r=>setTimeout(r,ms));
    (async()=>{
      if(kitchenAuto){ doPrint('kitchen'); await nap(1300); if(!alive) return; }
      if(receiptMode==='auto'){ doPrint('receipt'); await nap(900); if(!alive) return; }
      if(receiptMode!=='ask'){ try{ onClose(); }catch(e){} }  // ask = ค้างหน้าไว้ให้กดพิมพ์ใบเสร็จเอง
    })();
    return ()=>{ alive=false; };
  }, []);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:600, background:'rgba(15,25,20,.5)', display:'flex', flexDirection:'column', animation:'kdFade .2s' }}>
      {/* top bar */}
      <div style={{ paddingTop:52, display:'flex', alignItems:'center', gap:10, padding:'52px 16px 12px', color:'#fff' }}>
        <div style={{ flex:1, fontSize:17, fontWeight:700 }}>{TH?'พิมพ์เอกสาร':'Print'}</div>
        <button onClick={onClose} style={{ border:'none', background:'rgba(255,255,255,.22)', color:'#fff', width:36, height:36, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      {/* tabs */}
      <div style={{ display:'flex', gap:8, padding:'0 16px 12px' }}>
        {[['receipt',TH?'ใบเสร็จลูกค้า':'Receipt'],['kitchen',TH?'บิลครัว':'Kitchen bill']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ flex:1, border:'none', cursor:'pointer', padding:'10px', borderRadius:12, fontFamily:'var(--font)', fontWeight:700, fontSize:14,
            background: tab===k?'#fff':'rgba(255,255,255,.18)', color: tab===k?'var(--ink)':'#fff' }}>{l}</button>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px 12px' }}>
        <span style={{ fontSize:12.5, color:'#fff', opacity:.85 }}>{TH?'ขนาดกระดาษ':'Paper'}</span>
        {[58,80].map(w=>(
          <button key={w} onClick={()=>setPaper(w)} style={{ border:'none', cursor:'pointer', padding:'7px 14px', borderRadius:10, fontFamily:'var(--font)', fontWeight:700, fontSize:13, background:paperW===w?'#fff':'rgba(255,255,255,.18)', color:paperW===w?'var(--ink)':'#fff' }}>{w}mm</button>
        ))}
      </div>
      {hasVat && tab==='receipt' && <div style={{ padding:'0 16px 12px' }}>
        <button onClick={()=>setFull(v=>!v)} style={{ width:'100%', border:'none', cursor:'pointer', padding:'10px 12px', borderRadius:11, fontFamily:'var(--font)', fontWeight:700, fontSize:13,
          background: isFull?'#fff':'rgba(255,255,255,.18)', color: isFull?'var(--ink)':'#fff', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>{TH?'ออกใบกำกับภาษีเต็มรูป (ระบุผู้ซื้อ)':'Full tax invoice (buyer info)'}</span>
          <span style={{ fontSize:12, opacity:.8 }}>{isFull?(TH?'เปิด':'On'):(TH?'ปิด':'Off')}</span>
        </button>
        {isFull && <div style={{ background:'#fff', borderRadius:12, padding:'12px 13px', marginTop:8, display:'flex', flexDirection:'column', gap:8 }}>
          {[['name', TH?'ชื่อผู้ซื้อ / บริษัท':'Buyer / company name'],['taxId', TH?'เลขประจำตัวผู้เสียภาษี':'Tax ID'],['branch', TH?'สำนักงานใหญ่ / สาขา':'Head office / branch'],['addr', TH?'ที่อยู่':'Address']].map(([k,ph])=> k==='addr'
            ? <textarea key={k} rows={2} value={buyer[k]} onChange={e=>setBuyer(b=>({...b,[k]:e.target.value}))} placeholder={ph}
                style={{ width:'100%', border:'1.5px solid var(--hair-2)', borderRadius:9, padding:'9px 10px', fontFamily:'var(--font)', fontSize:13, resize:'vertical', lineHeight:1.4, outline:'none' }}/>
            : <input key={k} value={buyer[k]} onChange={e=>setBuyer(b=>({...b, [k]: k==='taxId'? e.target.value.replace(/\D/g,'').slice(0,13) : e.target.value }))} placeholder={ph}
                inputMode={k==='taxId'?'numeric':'text'} style={{ width:'100%', border:'1.5px solid var(--hair-2)', borderRadius:9, padding:'9px 10px', fontFamily:'var(--font)', fontSize:13, outline:'none' }}/>
          )}
        </div>}
      </div>}
      {/* slip */}
      <div className="kd-body" style={{ padding:'0 16px 16px', display:'flex', justifyContent:'center' }}>
        <div className="kd-pop" style={{ width: paperW===58?232:300, background:'#fff', borderRadius:10, padding:'18px 18px 22px', fontFamily:'var(--mono)', color:'#1a1a1a',
          boxShadow:'var(--shadow-lg)', position:'relative' }}>
          {tab==='receipt' ? (
            <>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:16, fontWeight:700, fontFamily:'var(--font)' }}>{shopName}</div>
                {hasVat && (_pay.taxId||_pay.taxBranch) && <div style={{ fontSize:10.5, color:'#555', fontFamily:'var(--font)' }}>{_pay.taxId?((TH?'เลขผู้เสียภาษี ':'Tax ID ')+_pay.taxId):''}{_pay.taxBranch?(' · '+_pay.taxBranch):''}</div>}
                {hasVat && _pay.taxAddr && <div style={{ fontSize:10, color:'#777', fontFamily:'var(--font)', marginTop:1, lineHeight:1.35 }}>{_pay.taxAddr}</div>}
                <div style={{ fontSize:11, color:'#666' }}>{docTitle}</div>
              </div>
              <div style={dash}/>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}><span>{TH?'ออเดอร์':'Order'} #{order.no}</span><span>{now}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:3 }}><span>{ch[lang]||ch.th}</span><span style={{ fontWeight:700 }}>{qtext}</span></div>
              <div style={dash}/>
              {isFull && <><div style={{ fontSize:11.5, marginBottom:6 }}>
                <div style={{ fontWeight:700 }}>{TH?'ลูกค้า':'Customer'}</div>
                {buyer.name && <div>{buyer.name}</div>}
                {buyer.taxId && <div style={{ color:'#555' }}>{(TH?'เลขผู้เสียภาษี ':'Tax ID ')+buyer.taxId}{buyer.branch?(' · '+buyer.branch):''}</div>}
                {buyer.addr && <div style={{ color:'#777', lineHeight:1.35 }}>{buyer.addr}</div>}
              </div><div style={dash}/></>}
              {order.items.map(([id,q],i)=>{ const m=menuById(id)||{}; return (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, marginBottom:4 }}>
                  <span style={{ flex:1 }}>{q} × {m[lang]||m.th||''}</span><span>{((m.price||0)*q).toLocaleString()}</span></div>
              );})}
              <div style={dash}/>
              {hasVat ? (<>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#555' }}><span>{TH?'มูลค่าก่อนภาษี':'Before VAT'}</span><span>{vat.base.toFixed(2)}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#555', marginTop:2 }}><span>{TH?'ภาษีมูลค่าเพิ่ม':'VAT'} {vatRateTxt}%</span><span>{vat.vat.toFixed(2)}</span></div>
              </>) : (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#555' }}><span>{TH?'ยอดสินค้า':'Subtotal'}</span><span>{sub.toLocaleString()}</span></div>
              )}
              {order.fee>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#555', marginTop:2 }}><span>{TH?'ค่าส่ง':'Delivery'}</span><span>{order.fee.toLocaleString()}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:700, marginTop:6, fontFamily:'var(--font)' }}><span>{TH?'รวมทั้งสิ้น':'TOTAL'}</span><span>฿{(order.total||vat.gross).toLocaleString()}</span></div>
              <div style={{ fontSize:11.5, color:'#666', marginTop:6 }}>{TH?'ชำระโดย':'Paid by'} {(PAYS[order.pay]?.[lang])||PAYS[order.pay]?.th}</div>
              <div style={dash}/>
              <div style={{ textAlign:'center', fontSize:11, color:'#888', fontFamily:'var(--font)' }}>{TH?'ขอบคุณที่ใช้บริการ 🙏':'Thank you 🙏'}</div>
            </>
          ) : (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:13, fontWeight:700, fontFamily:'var(--font)' }}>{TH?'บิลครัว KITCHEN':'KITCHEN'}</div>
                <span style={{ fontSize:12, fontWeight:700, color:'#fff', background:ch.c, padding:'2px 9px', borderRadius:6, fontFamily:'var(--font)' }}>{ch[lang]||ch.th}</span>
              </div>
              <div style={{ textAlign:'center', margin:'8px 0', padding:'8px', border:'2px solid #1a1a1a', borderRadius:8 }}>
                <div style={{ fontSize:11, color:'#666' }}>{order.channel==='dinein'?(TH?'โต๊ะ':'TABLE'):(TH?'คิว':'QUEUE')}</div>
                <div style={{ fontSize:34, fontWeight:800, fontFamily:'var(--font)', lineHeight:1 }}>{qtext}</div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, color:'#555' }}><span>#{order.no}</span><span>{now}</span></div>
              <div style={dash}/>
              {order.items.map(([id,q],i)=>{ const m=menuById(id)||{}; return (
                <div key={i} style={{ display:'flex', gap:8, fontSize:15, fontWeight:700, marginBottom:7, fontFamily:'var(--font)' }}>
                  <span style={{ minWidth:28 }}>{q}×</span><span>{m[lang]||m.th||''}</span></div>
              );})}
              <div style={dash}/>
              <div style={{ fontSize:11, color:'#888', fontFamily:'var(--font)' }}>{order.when && !/เลย|ASAP/.test(order.when) ? (TH?`นัดรับ ${order.when}`:`Pickup ${order.when}`) : (TH?'ทำทันที':'Cook now')}</div>
            </>
          )}
        </div>
      </div>
      {/* print button */}
      <div style={{ padding:'0 20px calc(20px + 8px)' }}>
        <button onClick={doPrint} disabled={printing} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:16 }}>
          {printing ? (TH?'กำลังส่งไปเครื่องพิมพ์…':'Sending to printer…') : printed ? (TH?'พิมพ์แล้ว ✓':'Printed ✓') : <>{React.cloneElement(IC.receipt,{size:18})} {TH?`พิมพ์${tab==='receipt'?'ใบเสร็จ':'บิลครัว'}ผ่านมือถือ`:'Print via mobile'}</>}
        </button>
      </div>
    </div>
  );
}

/* ══ POS MEMBER: แถบในตะกร้า + ชีตระบุสมาชิก (เบอร์/เพิ่มใหม่/สแกน QR) ══ */
function MemberBar({ member, canRedeem, redeemOn, setRedeemOn, rewardBaht, rewardAt, lang, onOpen, onClear }){
  const TH = lang!=='en';
  if(!member) return (
    <button onClick={onOpen} className="kd-card" style={{ width:'100%', border:'1.5px dashed var(--hair-2)', background:'var(--brand-softer)', cursor:'pointer', display:'flex', alignItems:'center', gap:10, padding:'11px 13px', marginBottom:12, fontFamily:'var(--font)', textAlign:'left' }}>
      <span style={{ fontSize:18 }}>⭐</span>
      <span style={{ flex:1, fontSize:13.5, fontWeight:700, color:'var(--brand-ink)' }}>{TH?'เพิ่มสมาชิก / สะสมแต้ม':'Add member / earn points'}</span>
      <span style={{ color:'var(--brand-ink)', fontWeight:700, fontSize:13 }}>{TH?'ระบุ ›':'Add ›'}</span>
    </button>
  );
  return (
    <div className="kd-card" style={{ marginBottom:12, padding:'11px 13px', background:'var(--brand-soft)', boxShadow:'none' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:34, height:34, borderRadius:999, background:'var(--brand)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{(member.name||'?').charAt(0)}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700 }}>{member.name||(TH?'สมาชิก':'Member')}</div>
          <div style={{ fontSize:11.5, color:'var(--brand-ink)' }} className="num">{member.phone?member.phone+' · ':''}{Number(member.points)||0} {TH?'แต้ม':'pts'}</div>
        </div>
        <button onClick={onClear} style={{ border:'none', background:'#fff', color:'var(--ink-3)', borderRadius:8, padding:'6px 10px', fontFamily:'var(--font)', fontSize:12, fontWeight:700, cursor:'pointer' }}>{TH?'เอาออก':'Remove'}</button>
      </div>
      {canRedeem
        ? <label style={{ display:'flex', alignItems:'center', gap:9, marginTop:10, cursor:'pointer' }}>
            <input type="checkbox" checked={redeemOn} onChange={e=>setRedeemOn(e.target.checked)} style={{ width:18, height:18, accentColor:'var(--brand)' }}/>
            <span style={{ fontSize:13, fontWeight:600 }}>{TH?`แลกส่วนลด ฿${rewardBaht} (หัก ${rewardAt} แต้ม)`:`Redeem ฿${rewardBaht} (−${rewardAt} pts)`}</span>
          </label>
        : <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:8 }}>{TH?`สะสมครบ ${rewardAt} แต้ม แลกส่วนลด ฿${rewardBaht}`:`${rewardAt} pts to redeem ฿${rewardBaht}`}</div>}
    </div>
  );
}

function MemberPickSheet({ members, findMemberByPhone, findMemberById, addMember, onPick, onClose, lang }){
  const TH = lang!=='en';
  const [mode,setMode] = mUseState('phone');   // phone | add | scan
  const [phone,setPhone] = mUseState('');
  const [name,setName] = mUseState('');
  const [birth,setBirth] = mUseState('');
  const [scanMsg,setScanMsg] = mUseState('');
  const videoRef = React.useRef(null);
  const digits = (s)=> String(s||'').replace(/\D/g,'');
  const found = (mode==='phone' && digits(phone).length>=4 && findMemberByPhone) ? findMemberByPhone(phone) : null;
  const resolveId = (txt)=>{ if(!txt) return ''; const s=String(txt).trim(); const mu=s.match(/[?&]member=([^&]+)/); if(mu) return decodeURIComponent(mu[1]); const mk=s.match(/(?:kdmember|member)[:=]([A-Za-z0-9_-]+)/i); if(mk) return mk[1]; return s.replace(/[^A-Za-z0-9_-]/g,''); };
  const pickById = async (rawId)=>{ const id=resolveId(rawId); if(!id) return; let m = findMemberById?findMemberById(id):null;
    if(!m && typeof window!=='undefined' && window.KD_LIVE && window.KD_API && window.KD_API.getMember){ try{ const r=await window.KD_API.getMember(id); if(r&&r.id) m=r; }catch(e){} }
    if(!m){ const nid=addMember({ id }); m={ id:nid, name:'', phone:'', points:0, visits:0 }; }
    onPick(m); };
  const doAdd = ()=>{ if(digits(phone).length<4 && !name.trim()) return; const dp=digits(phone); const dup=dp.length>=4?(members||[]).find(x=>digits(x.phone)===dp):null; if(dup){ try{ window.alert(TH?('เบอร์นี้มีสมาชิกอยู่แล้ว: '+(dup.name||dup.phone)+' — เลือกคนเดิมให้แล้ว'):('Phone already exists: '+(dup.name||dup.phone))); }catch(e){} onPick(dup); return; } const id=addMember({ name:name.trim(), phone:phone.trim(), birth }); const m=(members||[]).find(x=>x.id===id)||{ id, name:name.trim(), phone:phone.trim(), birth, points:0, visits:0 }; onPick(m); };
  React.useEffect(()=>{
    if(mode!=='scan') return; let stream=null, timer=null, stop=false;
    if(!('BarcodeDetector' in window)){ setScanMsg(TH?'อุปกรณ์นี้สแกนในแอปไม่ได้ — ใช้ค้นเบอร์แทน':'Scanning not supported here — use phone search'); return; }
    const det = new window.BarcodeDetector({ formats:['qr_code'] });
    (async()=>{ try{ stream=await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } }); if(stop){ stream.getTracks().forEach(t=>t.stop()); return; } if(videoRef.current){ videoRef.current.srcObject=stream; await videoRef.current.play(); }
        timer=setInterval(async()=>{ try{ if(!videoRef.current) return; const codes=await det.detect(videoRef.current); if(codes&&codes[0]&&codes[0].rawValue){ clearInterval(timer); pickById(codes[0].rawValue); } }catch(e){} }, 500);
      }catch(e){ setScanMsg(TH?'เปิดกล้องไม่ได้ — ใช้ค้นเบอร์แทน':'Camera unavailable — use phone search'); } })();
    return ()=>{ stop=true; if(timer) clearInterval(timer); if(stream) stream.getTracks().forEach(t=>t.stop()); };
  }, [mode]);
  const tab = (k,l)=>(<button onClick={()=>setMode(k)} style={{ flex:1, border:'none', cursor:'pointer', borderRadius:11, padding:'10px 4px', fontFamily:'var(--font)', fontWeight:700, fontSize:13, background: mode===k?'var(--brand)':'var(--brand-soft)', color: mode===k?'#fff':'var(--brand-ink)' }}>{l}</button>);
  return (
    <Sheet open={true} onClose={onClose} height="80%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{TH?'สมาชิก':'Member'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ padding:'0 20px', display:'flex', gap:8, marginBottom:14 }}>{tab('phone',TH?'ค้นเบอร์':'Phone')}{tab('add',TH?'เพิ่มใหม่':'New')}{tab('scan',TH?'สแกน QR':'Scan QR')}</div>
      <div style={{ overflowY:'auto', padding:'0 20px 8px', flex:1 }}>
        {mode==='phone' && <>
          <input className="kd-input num" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder={TH?'เบอร์โทรลูกค้า':'Customer phone'} autoFocus/>
          {digits(phone).length>=4 && (found
            ? <div className="kd-card" style={{ marginTop:12, padding:'13px 14px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:999, background:'var(--brand-soft)', color:'var(--brand-ink)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{(found.name||'?').charAt(0)}</div>
                <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:14.5, fontWeight:700 }}>{found.name||(TH?'สมาชิก':'Member')}</div><div className="num" style={{ fontSize:12, color:'var(--ink-3)' }}>{found.phone} · {Number(found.points)||0} {TH?'แต้ม':'pts'}</div></div>
                <button onClick={()=>onPick(found)} className="kd-btn kd-btn-primary" style={{ padding:'9px 14px', fontWeight:700 }}>{TH?'เลือก':'Pick'}</button>
              </div>
            : <div className="kd-card" style={{ marginTop:12, padding:'14px', textAlign:'center', background:'var(--bg)', boxShadow:'none' }}>
                <div style={{ fontSize:13, color:'var(--ink-2)', marginBottom:10 }}>{TH?'ไม่พบสมาชิกเบอร์นี้':'No member with this phone'}</div>
                <button onClick={()=>{ setMode('add'); }} className="kd-btn kd-btn-ghost" style={{ padding:'10px 16px', fontWeight:700 }}>{TH?'+ เพิ่มเป็นสมาชิกใหม่':'+ Add new member'}</button>
              </div>)}
        </>}
        {mode==='add' && <>
          <label style={{ fontSize:13, fontWeight:700, color:'var(--ink-2)', display:'block', margin:'2px 0 6px' }}>{TH?'ชื่อลูกค้า':'Name'}</label>
          <input className="kd-input" value={name} onChange={e=>setName(e.target.value)} placeholder={TH?'เช่น คุณเอ':'Customer name'} autoFocus/>
          <label style={{ fontSize:13, fontWeight:700, color:'var(--ink-2)', display:'block', margin:'12px 0 6px' }}>{TH?'เบอร์โทร':'Phone'}</label>
          <input className="kd-input num" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="0812345678"/>
          <label style={{ fontSize:13, fontWeight:700, color:'var(--ink-2)', display:'block', margin:'12px 0 6px' }}>{TH?'วันเดือนปีเกิด':'Date of birth'} <span style={{fontWeight:500,color:'var(--ink-3)'}}>· {TH?'ไม่บังคับ':'optional'}</span></label>
          <input className="kd-input" type="date" value={birth} onChange={e=>setBirth(e.target.value)}/>
          <button onClick={doAdd} disabled={digits(phone).length<4 && !name.trim()} className="kd-btn kd-btn-primary kd-btn-block" style={{ marginTop:16, padding:15, opacity:(digits(phone).length<4 && !name.trim())?.5:1 }}>{TH?'เพิ่มสมาชิก + ผูกบิลนี้':'Add member + attach'}</button>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', textAlign:'center', marginTop:9, lineHeight:1.5 }}>{TH?'สมาชิกแบบเบอร์โทร (ไม่ต้องผูก LINE) · สะสมแต้ม/สแตมป์ได้เหมือนกัน':'Phone member (no LINE needed)'}</div>
        </>}
        {mode==='scan' && <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:13, color:'var(--ink-2)', marginBottom:10 }}>{TH?'ให้ลูกค้าเปิด QR สมาชิกจากหน้าโปรไฟล์ในแอป แล้วสแกน':'Scan the customer’s member QR'}</div>
          <div style={{ width:'100%', maxWidth:280, aspectRatio:'1', margin:'0 auto', borderRadius:16, overflow:'hidden', background:'#000', position:'relative' }}>
            <video ref={videoRef} playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover' }}></video>
            <div style={{ position:'absolute', inset:'18%', border:'3px solid rgba(255,255,255,.85)', borderRadius:14 }}/>
          </div>
          {scanMsg && <div style={{ fontSize:12.5, color:'var(--danger)', marginTop:12, lineHeight:1.5 }}>{scanMsg}</div>}
        </div>}
      </div>
    </Sheet>
  );
}

Object.assign(window, { SellScreen, Stepper, Row, PaySuccess, QRBlock, AddCatSheet, PrintSlip, MemberBar, MemberPickSheet });
