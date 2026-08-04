// kaidee-customer2.jsx — Cart, Checkout (pre-order + payment), My orders + tracking, Customer shell
const { useState:c2State, useEffect:c2Effect } = React;

/* ══════════════ CART ══════════════ */
function CustCart({ cart, menu, setQty, onCheckout }){
  const { t, lang } = useT();
  const lines = Object.entries(cart).filter(([,e])=>e&&e.qty>0);
  const subtotal = lines.reduce((a,[,e])=>a+((menuById(e.id)?.price||0)+(e.add||0))*e.qty,0);
  if(lines.length===0) return (
    <div className="kd-screen" style={{ background:'#fff' }}>
      <LineHeader title={t('cart')}/>
      <div className="kd-body" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--ink-3)', gap:8 }}>
        <div style={{ fontSize:48 }}>🛒</div><div>{lang==='th'?'ตะกร้ายังว่างอยู่':'Your cart is empty'}</div>
      </div>
    </div>
  );
  return (
    <div className="kd-screen" style={{ background:'#fff' }}>
      <LineHeader title={t('cart')}/>
      <div className="kd-body" style={{ padding:'8px 16px 150px' }}>
        {lines.map(([key,e])=>{ const m=menuById(e.id); const unit=(m?.price||0)+(e.add||0); const optTxt=(e.opts||[]).map(o=>o.label).join(', '); return (
          <div key={key} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid var(--hair)' }}>
            <FoodTile item={m} size={54} radius={12}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14.5, fontWeight:600 }}>{m[lang]||m.th}</div>
              {optTxt && <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:1 }}>{optTxt}</div>}
              <div className="num" style={{ fontSize:14, fontWeight:700, color:'var(--brand-ink)', marginTop:3 }}>{money(unit*e.qty)}</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:2, background:'var(--bg)', borderRadius:999, padding:3 }}>
              <button onClick={()=>setQty(key,e.qty-1)} style={sqBtn}>{React.cloneElement(IC.minus,{size:16})}</button>
              <span className="num" style={{ width:22, textAlign:'center', fontWeight:700 }}>{e.qty}</span>
              <button onClick={()=>setQty(key,e.qty+1)} style={sqBtn}>{React.cloneElement(IC.plus,{size:16})}</button>
            </div>
          </div>
        );})}
      </div>
      <div style={{ position:'absolute', left:0, right:0, bottom:0, background:'#fff', borderTop:'1px solid var(--hair)', padding:'14px 16px calc(14px + 8px)', boxShadow:'0 -6px 20px rgba(20,40,30,.06)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontWeight:600, color:'var(--ink-2)' }}>{t('subtotal')}</span>
          <span className="num" style={{ fontWeight:700, fontSize:17 }}>{money(subtotal)}</span></div>
        <button onClick={onCheckout} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:16 }}>{lang==='th'?'ส่งออเดอร์':'Send order'}</button>
      </div>
    </div>
  );
}

/* ══════════════ CHECKOUT ══════════════ */
const SLOTS = ['เลย (15–25 นาที)','11:30','12:00','12:30','13:00','พรุ่งนี้ 09:00'];
function Checkout({ cart, onBack, onPlace, shop, payCfg, store }){
  const { t, lang } = useT();
  const feats = (shop&&shop.features)||{};
  const canDeliver = feats.delivery!==false;
  const NONFOOD = ['grocery','retail','online','service'];
  const canDine = feats.dinein!==false && !NONFOOD.includes(shop&&shop.shopType);   // ร้านของชำ/เสื้อผ้า/ออนไลน์/บริการ = ไม่มีโต๊ะ
  const [ful,setFul] = c2State(canDine?'dinein':(canDeliver?'delivery':'takeaway'));   // dinein | takeaway | delivery
  const [table,setTable] = c2State('');
  const [when,setWhen] = c2State(0);          // index into SLOTS
  const [preOpen,setPreOpen] = c2State(false); // โชว์ช่องเวลาเฉพาะตอนกดสั่งจอง
  const [pay,setPay] = c2State('promptpay');
  // ที่อยู่ล่าสุดที่เคยสั่งจริงเท่านั้น — ห้ามใส่ที่อยู่ตัวอย่างไว้ล่วงหน้า ลูกค้าที่กดผ่านเร็วจะสั่งไปผิดที่
  const [book,setBook] = c2State(()=>addrBook());
  const [addr,setAddr] = c2State(()=>{ const b = addrBook(); return (b[0] && b[0].addr) || ''; });
  const shopClosed = !!(shop && shop.isOpen===false);
  const preorderOn = payCfg ? payCfg.preorderOn!==false : true;   // ร้านตั้งใน Backoffice (default เปิด)
  const preNote = (payCfg&&payCfg.preorderNote)||'';
  const confirmFirst = (payCfg&&payCfg.payWorkflow)==='confirmFirst';
  const lu = (typeof window!=='undefined' && window.__lineUser) || null;
  const isGuest = !lu;
  const [custName,setCustName] = c2State(()=>{ try{ return localStorage.getItem('kd_guest_name')||''; }catch(e){ return ''; } });
  const [confirmPre,setConfirmPre] = c2State(false);
  const [formErr,setFormErr] = c2State('');   // FX-003: เตือนในหน้า (alert เด้งไม่ได้บน LINE/PWA)
  // หมุดตั้งต้น: จากที่อยู่ล่าสุด ถ้าไม่มีก็ใช้ตำแหน่งที่ปักไว้ตอนดูหน้ารวมร้าน
  const [pin,setPin] = c2State(()=>{
    const b = addrBook()[0];
    if(b && b.lat!=null) return { lat:b.lat, lng:b.lng };
    const l = custLoc();
    return (l && l.lat!=null) ? { lat:l.lat, lng:l.lng } : null;
  });
  const [mapOpen,setMapOpen] = c2State(false);
  const [phone,setPhone] = c2State(()=>{ try{ return localStorage.getItem('kd_guest_phone')||''; }catch(e){ return ''; } });
  const shopLoc = (shop && shop.lat) ? { lat:+shop.lat, lng:+shop.lng } : null;
  const lines = Object.values(cart).filter(e=>e&&e.qty>0);
  const subtotal = lines.reduce((a,e)=>a+((menuById(e.id)?.price||0)+(e.add||0))*e.qty,0);
  const dist = (pin && shopLoc) ? Math.round(Math.max(0.3, haversineKm(shopLoc, pin))*10)/10 : 2.5;
  const rawFee = ful==='delivery' ? deliveryFee(shop, dist) : 0;
  const custPays = customerPaysDelivery(shop);
  const billFee = custPays ? rawFee : 0;
  const fee = rawFee;
  // ส่วนลดตามระดับสมาชิก (LINE member) — หักอัตโนมัติตอนจบบิล
  const _L = (payCfg&&payCfg.loyalty)||{};
  const _mem = (lu && store) ? ((store.members||[]).find(m=>m.id===lu.userId)||null) : null;
  const _tierPct = _mem ? (Number((_L.tierDisc||{})[_mem.tier])||0) : 0;
  const memberDiscRaw = _tierPct>0 ? Math.round(subtotal*_tierPct/100) : 0;
  /* ── โปร/คูปองของร้าน ──
     เซิร์ฟเวอร์เป็นคนบอกว่าใบไหนใช้ได้และลดเท่าไหร่ · ที่คิดตรงนี้มีไว้โชว์เฉย ๆ
     ตอนกดสั่งเซิร์ฟเวอร์คิดใหม่อีกรอบจากราคาในฐานข้อมูล                        */
  const [promoList,setPromoList] = c2State([]);
  const [promoId,setPromoId]     = c2State('');
  const [promoCode,setPromoCode] = c2State('');
  const [promoOpen,setPromoOpen] = c2State(false);
  const orderChannel = ful==='delivery'?'delivery':(ful==='dinein'?'dinein':'line');
  const cartKey = lines.map(e=>e.id+'x'+e.qty).join(',');
  c2Effect(()=>{
    let dead = false;
    if(!lines.length){ setPromoList([]); return; }
    (async()=>{
      try{
        const r = await window.KD_API.quotePromos({
          items: lines.map(e=>[e.id, e.qty]), channel: orderChannel, fee: rawFee,
          lineUserId: lu?lu.userId:null, code: promoCode });
        if(!dead) setPromoList((r&&r.promos)||[]);
      }catch(e){ if(!dead) setPromoList([]); }   // ออฟไลน์/เซิร์ฟเวอร์ล่ม = ไม่มีโปร ไม่ใช่บล็อกการสั่ง
    })();
    return ()=>{ dead = true; };
  }, [cartKey, orderChannel, rawFee, promoCode]);
  /* บัตรกำนัล/คูปอง — โค้ดที่ลูกค้ากรอกอาจเป็นโปรหรือเป็นบัตรก็ได้
     ลองทางโปรก่อน ไม่เจอค่อยถามเซิร์ฟเวอร์ว่าเป็นบัตรไหม (ยอดจริงเซิร์ฟเวอร์คิดซ้ำตอนสั่ง) */
  const [voucher,setVoucher] = c2State(null);
  const chosen = promoList.find(p=>p.id===promoId && !p.blocked) || null;
  const promoDisc    = chosen ? (chosen.disc|0) : 0;
  const promoFeeDisc = chosen ? Math.min(chosen.feeDisc|0, billFee) : 0;
  // โปรที่ไม่ได้ตั้งให้ใช้ร่วมกับส่วนลดสมาชิก → ลูกค้าได้ทางเดียว (เลือกทางที่ลดเยอะกว่าให้อัตโนมัติไม่ได้ เพราะร้านตั้งใจกันไว้)
  const memberDisc = (chosen && !chosen.stackable) ? 0 : memberDiscRaw;
  // บัตรกำนัลทำหน้าที่เหมือนเงิน — หักจากยอดที่เหลือหลังส่วนลดอื่นแล้ว (ตรงกับที่เซิร์ฟเวอร์คิด)
  const afterOthers = Math.max(0, subtotal - memberDisc - promoDisc);
  const vcDisc = voucher ? Math.min(voucher.disc|0, afterOthers) : 0;
  const saved = memberDisc + promoDisc + promoFeeDisc + vcDisc;
  const total = Math.max(0, subtotal+billFee-memberDisc-promoDisc-promoFeeDisc-vcDisc);
  const cost = lines.reduce((a,e)=>a+(menuById(e.id)?.cost||0)*e.qty,0);
  const _acc=(payCfg&&payCfg.accept)||{promptpay:true,transfer:true,cash:true,cod:true};
  const payOpts = (((when>0) || ful==='delivery' ? ['promptpay'] : ['promptpay','cash']).filter(k=>_acc[k]!==false)) ;
  const payOptsSafe = payOpts.length?payOpts:['promptpay'];
  const isPre = when>0;
  // ร้านปิด: ถ้าเปิด pre-order → สั่งจองล่วงหน้าได้เท่านั้น (ห้าม ASAP) · ถ้าปิด pre-order → สั่งไม่ได้เลย
  const blocked = shopClosed && !preorderOn;
  const forcePre = shopClosed && preorderOn;

  const doPlace = ()=>{
    try{ if(isGuest){ if(custName.trim()) localStorage.setItem('kd_guest_name', custName.trim()); if(phone.trim()) localStorage.setItem('kd_guest_phone', phone.trim()); } }catch(e){}
    // จำที่อยู่ที่ "สั่งจริง" เท่านั้น — ครั้งหน้าไม่ต้องพิมพ์ใหม่
    if(ful==='delivery' && addr.trim()) saveAddr({ addr: addr.trim(), lat: pin?pin.lat:null, lng: pin?pin.lng:null });
    onPlace({
    items:lines.map(e=>[e.id, e.qty, (e.opts||[]).map(o=>o.label).join(', '), e.add||0]), channel: ful==='delivery'?'delivery':(ful==='dinein'?'dinein':'line'),
    pay: ful==='dinein'?'later':(payOptsSafe.includes(pay)?pay:payOptsSafe[0]), payLater: ful==='dinein', total, cost, fee, memberId: _mem?_mem.id:null, memberDisc: memberDisc||0, deliveryMode: deliveryCfg(shop).mode,
    promoId: chosen?chosen.id:null, promoName: chosen?chosen.name:'', promoDisc, promoFeeDisc,
    voucherCode: voucher?voucher.code:null,
    payAfterConfirm: (confirmFirst && ful!=='dinein' && (payOptsSafe.includes(pay)?pay:payOptsSafe[0])==='promptpay'),
    phone, customer: isGuest ? (custName.trim()|| (lang==='th'?'ลูกค้า':'Guest')) : undefined, preorder: forcePre||isPre,
    addr: ful==='delivery'?addr:(ful==='dinein'?('ทานที่ร้าน · โต๊ะ '+(table||'-')):'รับกลับบ้าน'), when: SLOTS[when],
    lat: pin?pin.lat:null, lng: pin?pin.lng:null,
    fulfil: ful, table: ful==='dinein'?(table||''):null,
  }); };

  const submit = ()=>{
    if(blocked) return;
    setFormErr('');
    const bad=(m)=>{ setFormErr(m); try{ const el=document.getElementById('kd-form-err'); if(el&&el.focus) el.focus({preventScroll:true}); }catch(e){} };
    if(isGuest && !custName.trim()){ bad(lang==='th'?'กรุณากรอกชื่อผู้สั่ง':'Please enter your name'); return; }
    if(isGuest && phone.trim().replace(/\D/g,'').length<9){ bad(lang==='th'?'กรุณากรอกเบอร์โทรให้ถูกต้อง':'Please enter a valid phone'); return; }
    if(ful==='delivery'){
      if(!addr.trim()){ bad(lang==='th'?'กรุณากรอกที่อยู่จัดส่ง':'Please enter delivery address'); return; }
      if(!pin){ bad(lang==='th'?'กรุณาปักหมุดตำแหน่งจัดส่งบนแผนที่':'Please pin the delivery location'); return; }
    }
    if(forcePre && !isPre){ bad(lang==='th'?'ร้านปิดอยู่ — กรุณาเลือกเวลารับแบบสั่งจองล่วงหน้า':'Shop is closed — pick a pre-order time'); return; }
    // ร้านปิด (pre-order) หรือมีเงื่อนไขร้าน → เด้ง popup แจ้งก่อนสั่ง
    if((forcePre || (isPre && preNote.trim()))){ setConfirmPre(true); return; }
    doPlace();
  };

  const place = submit;

  return (
    <div className="kd-screen" style={{ background:'var(--bg)' }}>
      <LineHeader title={t('checkout')} onBack={onBack}/>
      <div className="kd-body" style={{ padding:'14px 16px 130px' }}>
        {shopClosed && <div className="kd-card" style={{ padding:'12px 14px', marginBottom:14, background: preorderOn?'var(--accent-soft)':'#FDE7E7', boxShadow:'none', fontSize:13, fontWeight:600, color: preorderOn?'var(--accent-ink)':'#C0392B', lineHeight:1.5 }}>
          {preorderOn ? (lang==='th'?'🌙 ตอนนี้ร้านปิดอยู่ — สั่งจองล่วงหน้าได้ ร้านจะเริ่มทำตามเวลาที่เลือก':'🌙 Shop is closed — pre-order accepted, prepared at your chosen time') : (lang==='th'?'🌙 ร้านปิดรับออเดอร์ชั่วคราว':'🌙 Shop is closed')}
        </div>}
        {isGuest && <div style={{ marginBottom:16 }}>
          <SectTitle>{React.cloneElement(IC.user,{size:15,style:{verticalAlign:'-3px',marginRight:4}})}{lang==='th'?'ชื่อผู้สั่ง':'Your name'}</SectTitle>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'-4px 2px 8px', lineHeight:1.5 }}>{lang==='th'?'ร้านใช้ระบุตัวตนเวลาเรียกคิว/ติดต่อ · ใช้สะสมแต้มด้วย':'Used to identify your order & earn points'}</div>
          <input className="kd-input" value={custName} onChange={e=>setCustName(e.target.value)} placeholder={lang==='th'?'ชื่อสำหรับเรียกคิว':'Name for the order'}/>
          <input className="kd-input num" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder={lang==='th'?'เบอร์โทรติดต่อ':'Phone number'} style={{ marginTop:9 }}/>
        </div>}
        {/* fulfilment */}
        <SectTitle>{lang==='th'?'รับอาหารแบบไหน':'How to receive'}</SectTitle>
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          {[['dinein',IC.store,lang==='th'?'ทานที่ร้าน':'Dine-in'],['takeaway',IC.bag,lang==='th'?'กลับบ้าน':'Takeaway'],['delivery',IC.moto,lang==='th'?'เดลิเวอรี':'Delivery']].filter(([k])=>(k!=='delivery'||canDeliver)&&(k!=='dinein'||canDine)).map(([k,ic,l])=>(
            <button key={k} onClick={()=>setFul(k)} className="kd-card" style={{ flex:1, border: ful===k?'2px solid var(--brand)':'2px solid transparent',
              cursor:'pointer', padding:'14px 10px', display:'flex', flexDirection:'column', alignItems:'center', gap:6, fontFamily:'var(--font)' }}>
              {React.cloneElement(ic,{size:26, color: ful===k?'var(--brand)':'var(--ink-3)'})}
              <span style={{ fontSize:14, fontWeight:700, color: ful===k?'var(--brand-ink)':'var(--ink-2)' }}>{l}</span>
            </button>
          ))}
        </div>

        {/* table number (dine-in) */}
        {ful==='dinein' && <div style={{ marginBottom:16 }}>
          <SectTitle>{lang==='th'?'หมายเลขโต๊ะ':'Table number'}</SectTitle>
          <input className="kd-input num" inputMode="numeric" value={table} onChange={e=>setTable(e.target.value)} placeholder={lang==='th'?'เช่น 5':'e.g. 5'}/>
        </div>}

        {/* address */}
        {ful==='delivery' && <div style={{ marginBottom:16 }}>
          <SectTitle>{React.cloneElement(IC.pin,{size:15,style:{verticalAlign:'-3px',marginRight:4}})}{lang==='th'?'ที่อยู่จัดส่ง':'Delivery address'}</SectTitle>
          {/* ที่อยู่ที่เคยสั่งจริง — แตะเลือกแทนการพิมพ์ใหม่ทุกครั้ง */}
          {book.length > 0 && <div style={{ display:'flex', gap:7, overflowX:'auto', marginBottom:9, paddingBottom:2 }} className="kd-chiprow">
            {book.map(a=>{ const on = a.addr===addr;
              return (
                <button key={a.addr} onClick={()=>{ setAddr(a.addr); if(a.lat!=null) setPin({ lat:a.lat, lng:a.lng }); }}
                  style={{ flexShrink:0, maxWidth:210, border:'1.5px solid '+(on?'var(--brand)':'var(--hair)'), cursor:'pointer',
                    background: on?'var(--brand-soft)':'#fff', color: on?'var(--brand-ink)':'var(--ink-2)', fontFamily:'var(--font)',
                    borderRadius:999, padding:'7px 13px', fontSize:12.5, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  📍 {a.addr}
                </button>
              ); })}
          </div>}
          <textarea className="kd-input" rows={2} value={addr} onChange={e=>setAddr(e.target.value)} style={{ resize:'none' }}
            placeholder={lang==='th'?'บ้านเลขที่ ซอย ถนน จุดสังเกต — ยิ่งละเอียด ไรเดอร์ยิ่งหาเจอเร็ว':'House no., soi, road, landmark'}/>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:9 }}>
            <button onClick={()=>setMapOpen(o=>!o)} className="kd-btn" style={{ padding:'9px 13px', fontSize:12.5, background: pin?'var(--brand)':'var(--brand-soft)', color: pin?'#fff':'var(--brand-ink)' }}>{React.cloneElement(IC.pin,{size:14})} {pin?(lang==='th'?'ปักหมุดแล้ว · แก้ไข':'Pinned · edit'):(lang==='th'?'ปักหมุดตำแหน่งบนแผนที่':'Pin on map')}</button>
            {pin && <span style={{ fontSize:11.5, color:'var(--brand-ink)', fontWeight:600 }}>{lang==='th'?`~${dist} กม. จากร้าน`:`~${dist} km`}</span>}
          </div>
          {mapOpen && window.MapPicker && <MapPicker value={pin} center={shopLoc} onPick={setPin} />}
          <input className="kd-input num" inputMode="tel" placeholder={lang==='th'?'เบอร์โทรผู้รับ (ให้ไรเดอร์ติดต่อ)':'Recipient phone'} value={phone} onChange={e=>setPhone(e.target.value)} style={{ marginTop:9 }}/>
        </div>}

        {/* timing (pre-order) */}
        <SectTitle>{React.cloneElement(IC.clock,{size:15,style:{verticalAlign:'-3px',marginRight:4}})}{lang==='th'?'เวลารับอาหาร':'When'}</SectTitle>
        <div style={{ display:'flex', gap:8, marginBottom: (preOpen||isPre)?10:16 }}>
          <button onClick={()=>{ setPreOpen(false); setWhen(0); }} className="kd-card" style={{ flex:1, border: !isPre?'2px solid var(--brand)':'2px solid transparent', cursor:'pointer', padding:'12px 10px', display:'flex', flexDirection:'column', alignItems:'center', gap:3, fontFamily:'var(--font)' }}>
            {React.cloneElement(IC.clock,{size:20, color: !isPre?'var(--brand)':'var(--ink-3)'})}
            <span style={{ fontSize:13.5, fontWeight:700, color: !isPre?'var(--brand-ink)':'var(--ink-2)' }}>{lang==='th'?'รับเลย':'ASAP'}</span>
            <span style={{ fontSize:11, color:'var(--ink-3)' }}>{lang==='th'?'15–25 นาที':'15–25 min'}</span></button>
          <button onClick={()=>{ setPreOpen(true); if(!isPre) setWhen(1); }} className="kd-card" style={{ flex:1, border: isPre?'2px solid var(--brand)':'2px solid transparent', cursor:'pointer', padding:'12px 10px', display:'flex', flexDirection:'column', alignItems:'center', gap:3, fontFamily:'var(--font)' }}>
            {React.cloneElement(IC.calendar,{size:20, color: isPre?'var(--brand)':'var(--ink-3)'})}
            <span style={{ fontSize:13.5, fontWeight:700, color: isPre?'var(--brand-ink)':'var(--ink-2)' }}>{lang==='th'?'สั่งจองล่วงหน้า':'Pre-order'}</span>
            <span style={{ fontSize:11, color:'var(--ink-3)' }}>{lang==='th'?'เลือกเวลา':'pick a time'}</span></button>
        </div>
        {(preOpen||isPre) && <div className="kd-fadein" style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4, marginBottom: isPre?10:16 }}>
          {SLOTS.slice(1).map((s,idx)=>{ const i=idx+1; return (<button key={i} onClick={()=>setWhen(i)} style={{ border:'none', cursor:'pointer', whiteSpace:'nowrap',
            padding:'10px 14px', borderRadius:12, fontFamily:'var(--font)', fontWeight:600, fontSize:13.5,
            background: when===i?'var(--brand)':'#fff', color: when===i?'#fff':'var(--ink-2)', boxShadow: when===i?'none':'var(--shadow)' }}>{s}</button>); })}
        </div>}
        {isPre && <div className="kd-card kd-fadein" style={{ padding:'11px 14px', background:'var(--accent-soft)', boxShadow:'none', marginBottom:16, fontSize:13, color:'var(--accent-ink)', fontWeight:600 }}>
          {React.cloneElement(IC.calendar,{size:15,style:{verticalAlign:'-3px',marginRight:6}})}{lang==='th'?`จองล่วงหน้าไว้ ${SLOTS[when]} — ร้านจะเริ่มทำตามเวลา`:`Pre-ordered for ${SLOTS[when]}`}</div>}

        {/* payment */}
        {ful==='dinein'
          ? <div className="kd-card" style={{ padding:'13px 15px', background:'var(--brand-soft)', boxShadow:'none', fontSize:13, color:'var(--brand-ink)', fontWeight:600, lineHeight:1.5 }}>
              {React.cloneElement(IC.store,{size:15,style:{verticalAlign:'-3px',marginRight:6}})}{lang==='th'?'นั่งทานที่ร้าน — สั่งอาหารก่อน ร้านยืนยันโต๊ะแล้วเริ่มทำ · จ่ายเงินตอนจบที่เคาน์เตอร์/โต๊ะ':'Dine-in — order now, pay at the counter when you finish'}</div>
          : <>
        <SectTitle>{lang==='th'?'ช่องทางชำระเงิน':'Payment'}</SectTitle>
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {payOpts.map(p=>(
            <button key={p} onClick={()=>setPay(p)} className="kd-card" style={{ border: pay===p?'2px solid var(--brand)':'2px solid transparent',
              cursor:'pointer', display:'flex', alignItems:'center', gap:13, padding:'13px 15px', fontFamily:'var(--font)', textAlign:'left' }}>
              <span style={{ color: pay===p?'var(--brand)':'var(--ink-3)' }}>{React.cloneElement(PAYS[p].ic,{size:23})}</span>
              <span style={{ flex:1, fontSize:15, fontWeight:600 }}>{PAYS[p][lang]||PAYS[p].th}</span>
              <span style={{ width:20, height:20, borderRadius:999, border: pay===p?'6px solid var(--brand)':'2px solid var(--hair-2)' }}/>
            </button>
          ))}
        </div>
          </>}

        {/* ── ส่วนลดของร้าน ── */}
        <div style={{ marginTop:18 }}>
          <SectTitle>{lang==='th'?'ส่วนลด':'Discounts'}</SectTitle>
          <button onClick={()=>setPromoOpen(true)} className="kd-card" style={{ width:'100%', border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:12, padding:'14px 15px', fontFamily:'var(--font)', textAlign:'left' }}>
            <span style={{ fontSize:20 }}>🎟️</span>
            <div style={{ flex:1 }}>
              {(chosen||voucher)
                ? <>
                    <div style={{ fontSize:14.5, fontWeight:700, color:'var(--brand-ink)' }}>{chosen?chosen.name:voucher.name}{chosen&&voucher?' + '+voucher.name:''}</div>
                    <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:2 }}>{lang==='th'?`ลด ${money(promoDisc+promoFeeDisc+vcDisc)}`:`Saves ${money(promoDisc+promoFeeDisc+vcDisc)}`}</div>
                  </>
                : <>
                    <div style={{ fontSize:14.5, fontWeight:600 }}>{lang==='th'?'ใช้ส่วนลด / ใส่โค้ด':'Use a discount or code'}</div>
                    <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:2 }}>
                      {promoList.filter(p=>!p.blocked).length
                        ? (lang==='th'?`มี ${promoList.filter(p=>!p.blocked).length} รายการที่ใช้ได้กับบิลนี้`:`${promoList.filter(p=>!p.blocked).length} available for this order`)
                        : (lang==='th'?'ยังไม่มีส่วนลดที่ใช้ได้ตอนนี้':'None available right now')}
                    </div>
                  </>}
            </div>
            {(chosen||voucher)
              ? <span onClick={e=>{ e.stopPropagation(); setPromoId(''); setVoucher(null); }} style={{ fontSize:12.5, fontWeight:700, color:'var(--ink-3)', padding:'6px 10px' }}>{lang==='th'?'เอาออก':'Remove'}</span>
              : <span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>}
          </button>
        </div>
      </div>

      {promoOpen && <PromoPicker list={promoList} chosen={promoId} code={promoCode} setCode={setPromoCode}
        voucher={voucher} setVoucher={setVoucher} subtotal={afterOthers}
        onPick={id=>{ setPromoId(id); setPromoOpen(false); }} onClose={()=>setPromoOpen(false)} />}

      {/* summary bar */}
      <div style={{ position:'absolute', left:0, right:0, bottom:0, background:'#fff', borderTop:'1px solid var(--hair)', padding:'12px 16px calc(12px + 8px)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--ink-2)', marginBottom:3 }}><span>{t('subtotal')}</span><span className="num">{money(subtotal)}</span></div>
        {memberDisc>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:3, color:'var(--brand-ink)', fontWeight:700 }}><span>{lang==='th'?`ส่วนลดสมาชิก${_mem&&_mem.tier==='gold'?'ทอง':_mem&&_mem.tier==='silver'?'เงิน':''} ${_tierPct}%`:`Member ${_tierPct}%`}</span><span className="num">−{money(memberDisc)}</span></div>}
        {promoDisc>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:3, color:'var(--brand-ink)', fontWeight:700 }}><span>{chosen?chosen.name:(lang==='th'?'ส่วนลดร้าน':'Shop discount')}</span><span className="num">−{money(promoDisc)}</span></div>}
        {vcDisc>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:3, color:'var(--brand-ink)', fontWeight:700 }}><span>💳 {voucher.name||(lang==='th'?'บัตรกำนัล':'Voucher')}</span><span className="num">−{money(vcDisc)}</span></div>}
        {fee>0 && (custPays
          ? <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--ink-2)', marginBottom:3 }}><span>{lang==='th'?(deliveryCfg(shop).mode==='distance'?`ค่าส่ง · ${dist} กม.`:'ค่าส่ง'):`Delivery${deliveryCfg(shop).mode==='distance'?' · '+dist+' km':''}`}</span><span className="num">{money(billFee)}</span></div>
          : <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--ink-2)', marginBottom:3 }}><span>{lang==='th'?'ค่าส่ง':'Delivery'}</span><span style={{ color:'var(--brand-ink)', fontWeight:700 }}>{lang==='th'?'ร้านออกให้ (ฟรี)':'Free'}</span></div>)}
        {promoFeeDisc>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:3, color:'var(--brand-ink)', fontWeight:700 }}><span>{lang==='th'?'ส่วนลดค่าส่ง':'Delivery discount'}</span><span className="num">−{money(promoFeeDisc)}</span></div>}
        <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:17, marginBottom: saved>0?4:10 }}><span>{t('total')}</span><span className="num">{money(total)}</span></div>
        {saved>0 && <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
          <span style={{ fontSize:12, fontWeight:800, color:'var(--brand-ink)', background:'var(--brand-soft)', borderRadius:999, padding:'3px 11px' }}>
            {lang==='th'?`ประหยัดไป ${money(saved)}`:`You saved ${money(saved)}`}</span>
        </div>}
        {formErr && <div id="kd-form-err" tabIndex={-1} role="alert" style={{ background:'var(--danger-soft,#FDECEC)', color:'var(--danger,#C0392B)', borderRadius:12, padding:'11px 13px', fontSize:13.5, fontWeight:700, lineHeight:1.5, marginBottom:10 }}>{formErr}</div>}
        <button onClick={place} disabled={blocked} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:16, opacity:blocked?0.5:1 }}>
          {blocked?(lang==='th'?'ร้านปิดรับออเดอร์ชั่วคราว':'Shop closed'):((forcePre?(lang==='th'?'ยืนยันสั่งจองล่วงหน้า':'Confirm pre-order'):(ful==='dinein'?(lang==='th'?'ส่งออเดอร์ · จ่ายที่ร้าน':'Send order · pay at store'):(isPre?(lang==='th'?'ยืนยันจองล่วงหน้า':'Confirm pre-order'):(lang==='th'?'สั่งเลย':'Place order'))))+' · '+money(total))}</button>
      </div>

      {confirmPre && <div onClick={()=>setConfirmPre(false)} style={{ position:'fixed', inset:0, zIndex:90, background:'rgba(10,20,15,.5)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
        <div onClick={e=>e.stopPropagation()} className="kd-fadein" style={{ background:'#fff', width:'100%', maxWidth:440, borderRadius:'20px 20px 0 0', padding:'22px 20px calc(22px + env(safe-area-inset-bottom))' }}>
          <div style={{ fontSize:18, fontWeight:800, marginBottom:6 }}>{React.cloneElement(IC.calendar,{size:19,style:{verticalAlign:'-3px',marginRight:7}})}{lang==='th'?'ยืนยันสั่งจองล่วงหน้า':'Confirm pre-order'}</div>
          <div style={{ fontSize:13.5, color:'var(--ink-2)', lineHeight:1.55, marginBottom: preNote.trim()?12:16 }}>{lang==='th'?`รับอาหารเวลา ${SLOTS[when]} — ร้านจะเริ่มทำตามเวลาที่นัดหมาย`:`For ${SLOTS[when]} — the shop prepares it at your chosen time`}</div>
          {preNote.trim() && <div style={{ background:'var(--accent-soft)', borderRadius:12, padding:'12px 14px', fontSize:13, color:'var(--accent-ink)', lineHeight:1.55, marginBottom:16, whiteSpace:'pre-wrap' }}>{React.cloneElement(IC.bell,{size:15,style:{verticalAlign:'-3px',marginRight:6}})}{preNote}</div>}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setConfirmPre(false)} className="kd-btn" style={{ flex:1, padding:14, background:'var(--bg)', color:'var(--ink-2)' }}>{lang==='th'?'ย้อนกลับ':'Back'}</button>
            <button onClick={()=>{ setConfirmPre(false); doPlace(); }} className="kd-btn kd-btn-primary" style={{ flex:2, padding:14 }}>{lang==='th'?'เข้าใจแล้ว · สั่งเลย':'Got it · order'}</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
function SectTitle({ children }){ return <div style={{ fontSize:13.5, fontWeight:700, color:'var(--ink)', margin:'0 2px 9px' }}>{children}</div>; }

/* ── เลือกส่วนลด — แบ่ง "ใช้ได้ตอนนี้" / "ยังไม่ถึงเงื่อนไข" ให้ลูกค้าเห็นว่าต้องซื้ออีกเท่าไหร่ ── */
const VC_WHY = {
  notFound: { th:'ไม่พบโค้ดนี้ในร้านนี้',            en:'Code not found' },
  used:     { th:'โค้ดนี้ถูกใช้ไปแล้ว',              en:'Already used' },
  void:     { th:'โค้ดนี้ถูกยกเลิกแล้ว',             en:'Cancelled' },
  expired:  { th:'โค้ดหมดอายุแล้ว',                  en:'Expired' },
  minSpend: { th:'ยอดยังไม่ถึงขั้นต่ำของโค้ดนี้',    en:'Below minimum spend' },
  noEffect: { th:'ใช้กับบิลนี้ไม่ได้',                en:'Cannot apply to this order' },
};
const PROMO_WHY = {
  minSpend:  { th:'ยอดยังไม่ถึงขั้นต่ำ',       en:'Below minimum spend' },
  channelOff:{ th:'ใช้กับช่องทางนี้ไม่ได้',    en:'Not for this channel' },
  timeOff:   { th:'ยังไม่ถึงช่วงเวลาที่ใช้ได้', en:'Outside the time window' },
  dayOff:    { th:'ใช้ไม่ได้ในวันนี้',          en:'Not valid today' },
  expired:   { th:'หมดอายุแล้ว',                en:'Expired' },
  notStarted:{ th:'ยังไม่เริ่ม',                en:'Not started yet' },
  soldOut:   { th:'สิทธิ์หมดแล้ว',              en:'Fully claimed' },
  userLimit: { th:'คุณใช้สิทธิ์นี้ครบแล้ว',     en:'You have used this already' },
  inactive:  { th:'ปิดใช้งานอยู่',              en:'Inactive' },
  noEffect:  { th:'ยังไม่มีเมนูที่เข้าโปรนี้ในตะกร้า', en:'No qualifying items in your cart' },
};
function PromoPicker({ list, chosen, code, setCode, onPick, onClose, voucher, setVoucher, subtotal }){
  const { lang } = useT(); const TH = lang!=='en';
  const [typed,setTyped] = c2State(code||'');
  const [vcErr,setVcErr] = c2State('');
  const [vcBusy,setVcBusy] = c2State(false);
  /* โค้ดที่พิมพ์อาจเป็นโปรของร้าน หรือบัตรกำนัลก็ได้ — ลองทางโปรก่อน (setCode ไปให้ตัวแม่ค้นหา)
     ถ้าไม่มีโปรไหนตรง ค่อยถามเซิร์ฟเวอร์ว่าเป็นบัตรไหม ลูกค้าจะได้ไม่ต้องรู้ว่าโค้ดเป็นชนิดไหน */
  const applyCode = async ()=>{
    const c = (typed||'').trim().toUpperCase();
    if(!c) return;
    setVcErr(''); setCode(c);
    if(list.some(p=>p.code===c)) return;          // เป็นโปร — ตัวแม่จัดการต่อเอง
    setVcBusy(true);
    try{
      const r = await window.KD_API.checkVoucher({ code:c, subtotal: subtotal|0 });
      if(r && r.ok && r.voucher){ setVoucher({ ...r.voucher, disc: r.disc|0 }); setVcErr(''); }
      else setVcErr(VC_WHY[(r&&r.blocked)||'notFound'] ? VC_WHY[r.blocked||'notFound'][TH?'th':'en'] : (TH?'ใช้โค้ดนี้ไม่ได้':'Cannot use this code'));
    }catch(e){ setVcErr(TH?'ตรวจโค้ดไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองใหม่':'Could not check the code'); }
    setVcBusy(false);
  };
  const usable = list.filter(p=>!p.blocked);
  const locked = list.filter(p=>p.blocked && p.blocked!=='inactive');
  const row = (p)=>{
    const save = (p.disc|0)+(p.feeDisc|0);
    const why  = p.blocked ? (PROMO_WHY[p.blocked]||{})[TH?'th':'en'] : '';
    return (
      <button key={p.id} disabled={!!p.blocked} onClick={()=>onPick(p.id)} className="kd-card"
        style={{ width:'100%', textAlign:'left', fontFamily:'var(--font)', cursor:p.blocked?'default':'pointer', marginBottom:9,
          padding:'13px 15px', opacity:p.blocked?.55:1, border: chosen===p.id?'2px solid var(--brand)':'2px solid transparent' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:11 }}>
          <span style={{ fontSize:19, lineHeight:'22px' }}>🎟️</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14.5, fontWeight:700 }}>{p.name}</div>
            {p.code && <div style={{ display:'inline-block', fontSize:11, fontWeight:800, letterSpacing:'.5px', color:'var(--brand-ink)',
              background:'var(--brand-soft)', borderRadius:6, padding:'2px 7px', marginTop:4 }}>{p.code}</div>}
            {!p.blocked && save>0 && <div style={{ fontSize:12.5, color:'var(--brand-ink)', fontWeight:700, marginTop:3 }}>
              {TH?`ลด ${money(save)}`:`Saves ${money(save)}`}</div>}
            {p.blocked==='minSpend' && p.short>0 && <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:3 }}>
              {TH?`สั่งเพิ่มอีก ${money(p.short)} ถึงจะใช้ได้`:`Add ${money(p.short)} more to use this`}</div>}
            {p.blocked && p.blocked!=='minSpend' && <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:3 }}>{why}</div>}
            {!p.stackable && !p.blocked && <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:3 }}>
              {TH?'ใช้แล้วส่วนลดสมาชิกจะไม่ถูกหักในบิลนี้':'Member discount does not apply with this'}</div>}
          </div>
          {!p.blocked && <span style={{ width:20, height:20, borderRadius:999, flexShrink:0, marginTop:2,
            border: chosen===p.id?'6px solid var(--brand)':'2px solid var(--hair-2)' }}/>}
        </div>
      </button>
    );
  };
  return (
    <Sheet open={true} onClose={onClose} height="82%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{TH?'ส่วนลด':'Discounts'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px 20px', flex:1 }}>
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <input className="kd-input" value={typed} onChange={e=>setTyped(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,''))}
            placeholder={TH?'มีโค้ดส่วนลด / บัตรกำนัล?':'Discount or gift card code?'} style={{ flex:1, letterSpacing:'1px', fontWeight:700 }}/>
          <button onClick={applyCode} disabled={vcBusy} className="kd-btn kd-btn-primary" style={{ padding:'0 18px', opacity:vcBusy?.6:1 }}>{vcBusy?'…':(TH?'ใช้':'Apply')}</button>
        </div>
        {voucher && <div className="kd-card" style={{ padding:'12px 14px', marginBottom:14, background:'var(--brand-soft)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:19 }}>💳</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--brand-ink)' }}>{voucher.name}</div>
              <div style={{ fontSize:12, color:'var(--ink-2)', marginTop:2 }}>{TH?`ลด ${money(voucher.disc)}`:`Saves ${money(voucher.disc)}`}
                {voucher.type==='gift' && voucher.balance!=null && (TH?` · บัตรเหลือ ${money(voucher.balance)}`:` · ${money(voucher.balance)} on card`)}</div>
            </div>
            <button onClick={()=>{ setVoucher(null); setVcErr(''); }} className="kd-btn" style={{ padding:'6px 11px', fontSize:12, background:'#fff', color:'var(--ink-2)' }}>{TH?'เอาออก':'Remove'}</button>
          </div>
        </div>}
        {vcErr && <div style={{ fontSize:12.5, color:'var(--danger)', fontWeight:700, marginBottom:14 }}>{vcErr}</div>}

        {!!usable.length && <div style={{ fontSize:12.5, fontWeight:700, color:'var(--ink-3)', margin:'0 2px 8px' }}>{TH?'ใช้ได้กับบิลนี้':'Available now'}</div>}
        {usable.map(row)}
        {!usable.length && <div style={{ textAlign:'center', color:'var(--ink-3)', fontSize:13, padding:'20px 10px', lineHeight:1.6 }}>
          {TH?'ยังไม่มีส่วนลดที่ใช้ได้กับบิลนี้':'No discounts available for this order'}</div>}

        {!!locked.length && <>
          <div style={{ fontSize:12.5, fontWeight:700, color:'var(--ink-3)', margin:'16px 2px 8px' }}>{TH?'ยังใช้ไม่ได้':'Not yet available'}</div>
          {locked.map(row)}
        </>}
      </div>
      <div style={{ flex:'0 0 auto', padding:'11px 20px calc(11px + env(safe-area-inset-bottom))', borderTop:'1px solid var(--hair)' }}>
        <button onClick={()=>onPick('')} className="kd-btn kd-btn-block" style={{ padding:14, background:'var(--bg)', color:'var(--ink-2)' }}>
          {TH?'ไม่ใช้ส่วนลด':'No discount'}</button>
      </div>
    </Sheet>
  );
}

/* ══════════════ MY ORDERS + TRACKING ══════════════ */
const TRACK_STEPS = [
  { key:'new',       th:'ร้านรับออเดอร์',  en:'Order received',  ic:IC.check },
  { key:'cooking',   th:'กำลังปรุงอาหาร',  en:'Cooking',         ic:IC.fire },
  { key:'delivering',th:'ไรเดอร์กำลังส่ง', en:'On the way',      ic:IC.moto },
  { key:'done',      th:'ส่งสำเร็จ',       en:'Delivered',       ic:IC.pin },
];
function CustOrders({ orders, patchOrder }){
  const { t, lang } = useT();
  const mine = orders.filter(o=>o.mine);
  const [open,setOpen] = c2State(null);
  if(mine.length===0) return (
    <div className="kd-screen" style={{ background:'#fff' }}>
      <LineHeader title={t('myOrders')}/>
      <div className="kd-body" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--ink-3)', gap:8 }}>
        <div style={{ fontSize:48 }}>🧾</div><div>{lang==='th'?'ยังไม่มีออเดอร์':'No orders yet'}</div>
      </div>
    </div>
  );
  const cur = open && mine.find(o=>o.id===open);
  return (
    <div className="kd-screen" style={{ background:'var(--bg)' }}>
      <LineHeader title={t('myOrders')}/>
      <div className="kd-body" style={{ padding:'12px 16px 24px' }}>
        {mine.slice().reverse().map(o=>{ const st=STATUS_LABEL[o.status]; const isPre=o.when && !/เลย|ASAP/.test(o.when); return (
          <button key={o.id} onClick={()=>setOpen(o.id)} className="kd-card kd-fadein" style={{ border:'none', cursor:'pointer',
            width:'100%', textAlign:'left', padding:14, marginBottom:11, fontFamily:'var(--font)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontWeight:700 }}>#{o.no}</span>
              {isPre && <span className="kd-chip" style={{ background:'var(--accent-soft)', color:'var(--accent-ink)' }}>{React.cloneElement(IC.clock,{size:12})} {o.when}</span>}
              <span style={{ marginLeft:'auto', fontSize:12, fontWeight:700, color:st.c, background:st.c+'1A', padding:'4px 10px', borderRadius:999 }}>{st[lang]||st.th}</span>
            </div>
            <div style={{ fontSize:13.5, color:'var(--ink-2)' }}>{o.items.map(([id,q])=>`${q}× ${menuById(id)[lang]||menuById(id).th}`).join(' · ')}</div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:9, alignItems:'center' }}>
              <span className="num" style={{ fontWeight:700, fontSize:15 }}>{money(o.total)}</span>
              <span style={{ fontSize:13, color:'var(--brand-ink)', fontWeight:700 }}>{lang==='th'?'ติดตาม':'Track'} {React.cloneElement(IC.chev,{size:14,style:{verticalAlign:'-2px'}})}</span>
            </div>
          </button>
        );})}
      </div>
      {cur && <TrackSheet o={cur} patchOrder={patchOrder} onClose={()=>setOpen(null)}/>}
    </div>
  );
}
const THAI_BANKS = ['ธนาคารกสิกรไทย (KBANK)','ธนาคารไทยพาณิชย์ (SCB)','ธนาคารกรุงเทพ (BBL)','ธนาคารกรุงไทย (KTB)','ธนาคารกรุงศรีอยุธยา (BAY)','ธนาคารทหารไทยธนชาต (ttb)','ธนาคารออมสิน (GSB)','ธนาคารเกียรตินาคินภัทร (KKP)','ธ.ก.ส. (BAAC)','ธนาคารซีไอเอ็มบี ไทย (CIMB)','ธนาคารยูโอบี (UOB)','พร้อมเพย์ (เบอร์/บัตรประชาชน)'];
function RefundBlock({ o, patchOrder }){
  const { lang } = useT(); const TH = lang!=='en';
  const r = o.refund; if(!r) return null;
  const saved = (()=>{ try{ return JSON.parse(localStorage.getItem('kd_refund_acct')||'{}'); }catch(e){ return {}; } })();
  const [bank,setBank] = c2State(r.bank||saved.bank||'');
  const [acctNo,setAcctNo] = c2State(r.acctNo||saved.acctNo||'');
  const [acctName,setAcctName] = c2State(r.acctName||saved.acctName||'');
  const [phone,setPhone] = c2State(r.phone||saved.phone||'');
  const [remember,setRemember] = c2State(true);
  const [big,setBig] = c2State(false);
  const amt = money(r.amount||o.total||0);
  const okForm = bank && acctNo.trim() && acctName.trim();
  const submit = ()=>{ if(!okForm || !patchOrder) return;
    if(remember){ try{ localStorage.setItem('kd_refund_acct', JSON.stringify({bank,acctNo:acctNo.trim(),acctName:acctName.trim(),phone:phone.trim()})); }catch(e){} }
    patchOrder(o.id, { refund:{ ...r, status:'acct_given', bank, acctNo:acctNo.trim(), acctName:acctName.trim(), phone:phone.trim(), savedForNext:remember, submittedAt:Date.now() } }); };
  const inp = { width:'100%', border:'1px solid var(--hair-2)', borderRadius:10, padding:'11px 12px', fontSize:14, fontFamily:'inherit', outline:'none', background:'#fff', boxSizing:'border-box' };
  // ── คืนเงินสำเร็จ ──
  if(r.status==='refunded'){
    const tm = r.refundedAt ? new Date(r.refundedAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})+(TH?' น.':''):'';
    return (<div style={{ margin:'0 20px 16px', borderRadius:16, border:'1px solid var(--brand)', overflow:'hidden' }}>
      <div style={{ background:'var(--brand-soft)', padding:'14px 16px', display:'flex', gap:10, alignItems:'center' }}>
        <span style={{ fontSize:24 }}>✅</span>
        <div style={{ fontWeight:800, color:'var(--brand-ink)', fontSize:15 }}>{TH?'ดำเนินการคืนเงินเรียบร้อยแล้ว':'Refund completed'}</div>
      </div>
      <div style={{ padding:'14px 16px', fontSize:13.5, lineHeight:1.6, color:'var(--ink-2)' }}>
        {TH?<>ร้านได้โอนเงินคืนจำนวน <b className="num" style={{color:'var(--ink)'}}>{amt}</b> เข้าบัญชี <b>{r.bank}</b> ของคุณแล้ว{tm?<> เมื่อ <b>{tm}</b></>:''}</>
           :<>The shop refunded <b className="num">{amt}</b> to your <b>{r.bank}</b> account{tm?<> at <b>{tm}</b></>:''}.</>}
        {r.slip && <div style={{ marginTop:12 }}>
          <img src={r.slip} alt="refund slip" onClick={()=>setBig(true)} style={{ width:'100%', maxHeight:220, objectFit:'cover', borderRadius:12, border:'1px solid var(--hair)', cursor:'zoom-in', display:'block' }}/>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', textAlign:'center', marginTop:5 }}>{TH?'แตะที่สลิปเพื่อขยายดูรูปใหญ่':'Tap slip to enlarge'}</div>
        </div>}
        <div style={{ marginTop:12, color:'var(--ink-3)', fontSize:12.5 }}>{TH?'ขอบคุณที่ใช้บริการ และต้องขออภัยในความไม่สะดวกค่ะ':'Thank you and sorry for the inconvenience.'}</div>
      </div>
      {big && r.slip && <div onClick={()=>setBig(false)} style={{ position:'fixed', inset:0, zIndex:90, background:'rgba(10,20,15,.9)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}><img src={r.slip} alt="slip" style={{ maxWidth:'100%', maxHeight:'100%', borderRadius:12 }}/></div>}
    </div>);
  }
  // ── ส่งบัญชีแล้ว รอร้านโอน ──
  if(r.status==='acct_given'){
    return (<div style={{ margin:'0 20px 16px', borderRadius:16, background:'#FFFAF3', border:'1px solid #F0DFB0', padding:'14px 16px' }}>
      <div style={{ fontWeight:800, color:'#B45309', fontSize:14.5, display:'flex', alignItems:'center', gap:8 }}>⏳ {TH?'ส่งข้อมูลบัญชีแล้ว รอร้านโอนเงินคืน':'Account sent — awaiting refund'}</div>
      <div style={{ fontSize:13, color:'var(--ink-2)', marginTop:8, lineHeight:1.6, background:'#fff', borderRadius:10, padding:'10px 12px' }}>
        <div>{TH?'ยอดคืน':'Amount'}: <b className="num">{amt}</b></div>
        <div>{r.bank}</div><div className="num">{r.acctNo}</div><div>{r.acctName}</div>
      </div>
      <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:8 }}>{TH?'ร้านจะโอนเงินคืนและแนบสลิปให้ — คุณจะได้รับการแจ้งเตือนทาง SMS/LINE':'The shop will transfer and attach a slip — you\u2019ll be notified by SMS/LINE.'}</div>
    </div>);
  }
  // ── รอกรอกบัญชี (pending) ──
  return (<div style={{ margin:'0 20px 16px', borderRadius:16, border:'1px solid #F3D6CE', overflow:'hidden' }}>
    <div style={{ background:'#FDECEA', padding:'13px 16px' }}>
      <div style={{ fontWeight:800, color:'var(--danger)', fontSize:14.5 }}>🚨 {TH?'ขออภัยในความไม่สะดวกค่ะ':'Sorry for the inconvenience'}</div>
      <div style={{ fontSize:13, color:'var(--ink-2)', marginTop:3 }}>{TH?'ร้านค้าไม่สามารถรับออเดอร์ของคุณได้ในขณะนี้':'The shop can\u2019t accept your order right now.'}</div>
    </div>
    <div style={{ padding:'14px 16px' }}>
      {(r.reason||o.voidReason) && <div style={{ fontSize:13, color:'var(--ink-2)', marginBottom:10 }}>❌ {TH?'เหตุผล':'Reason'}: <b>{r.reason||o.voidReason}</b></div>}
      <div style={{ fontSize:14, fontWeight:700, marginBottom:12, paddingBottom:12, borderBottom:'1px dashed var(--hair-2)' }}>💰 {TH?'ระบบจะทำการคืนเงินจำนวน':'Refund amount'} <span className="num" style={{ color:'var(--brand-ink)' }}>{amt}</span> {TH?'ให้คุณ':''}</div>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-2)', marginBottom:8 }}>{TH?'กรุณาเลือกช่องทางรับเงินคืน':'Choose your refund account'}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
        <select value={bank} onChange={e=>setBank(e.target.value)} style={inp}><option value="">{TH?'— เลือกธนาคาร —':'— Select bank —'}</option>{THAI_BANKS.map(b=><option key={b} value={b}>{b}</option>)}</select>
        <input value={acctNo} onChange={e=>setAcctNo(e.target.value)} inputMode="numeric" placeholder={TH?'เลขที่บัญชี':'Account number'} style={inp} className="num"/>
        <input value={acctName} onChange={e=>setAcctName(e.target.value)} placeholder={TH?'ชื่อบัญชี':'Account name'} style={inp}/>
        <input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" placeholder={TH?'เบอร์โทร (รับ SMS แจ้งเตือน)':'Phone (for SMS)'} style={inp} className="num"/>
      </div>
      <label style={{ display:'flex', alignItems:'center', gap:9, margin:'12px 0 14px', fontSize:13, color:'var(--ink-2)', cursor:'pointer' }}>
        <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{ width:17, height:17 }}/>{TH?'บันทึกบัญชีนี้ไว้สำหรับใช้ในครั้งต่อไป':'Save this account for next time'}</label>
      <button onClick={submit} disabled={!okForm} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:14, opacity:okForm?1:.5 }}>{TH?'ส่งข้อมูลรับเงินคืน':'Submit refund details'}</button>
    </div>
  </div>);
}
function ConfirmPayBlock({ o }){
  const { lang } = useT();
  const [pp,setPp] = c2State(o.promptpay||null);
  const [slip,setSlip] = c2State(o.slipUrl||null);
  React.useEffect(()=>{
    if(!pp && typeof window!=='undefined' && window.KD_LIVE && window.KD_API && window.KD_API.payQR){
      window.KD_API.payQR(o.total).then(r=>{ if(r&&r.payload) setPp(r.payload); }).catch(()=>{});
    }
  },[]);
  const attach = (e)=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ const url=rd.result; setSlip(url);
    if(window.KD_API && window.KD_API.patchOrder) window.KD_API.patchOrder(o.id,{ slipUrl:url, slipAt:Date.now(), paid:false, slipVerified:false }); }; rd.readAsDataURL(f); };
  return (
    <div className="kd-card" style={{ margin:'0 20px 16px', padding:'16px', boxShadow:'none', border:'1.5px solid var(--brand)', background:'var(--brand-soft)' }}>
      <div style={{ fontWeight:700, color:'var(--brand-ink)', marginBottom:4 }}>{lang==='th'?'✅ ร้านยืนยันแล้ว · ชำระเงินได้เลย':'✅ Confirmed · pay now'}</div>
      <div style={{ fontSize:12.5, color:'var(--brand-ink)', marginBottom:12 }}>{lang==='th'?`สแกน QR พร้อมเพย์ ฿${(o.total||0).toLocaleString('en-US')} แล้วแนบสลิป`:`Scan PromptPay ฿${(o.total||0).toLocaleString('en-US')} then attach slip`}</div>
      {pp
        ? <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}><QRBlock payload={pp} size={190}/></div>
        : <div style={{ textAlign:'center', color:'var(--ink-3)', fontSize:13, padding:'20px 0' }}>{lang==='th'?'กำลังสร้าง QR…':'Generating QR…'}</div>}
      {slip
        ? <div style={{ textAlign:'center' }}><img src={slip} alt="slip" style={{ maxWidth:150, borderRadius:10, border:'1px solid var(--hair)' }}/><div style={{ fontSize:12.5, color:'var(--brand-ink)', fontWeight:700, marginTop:6 }}>{lang==='th'?'📎 แนบสลิปแล้ว · รอร้านตรวจสอบ':'📎 Slip sent · awaiting review'}</div></div>
        : <label className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:13, cursor:'pointer', display:'block', textAlign:'center' }}>
            {lang==='th'?'📎 แนบสลิปการโอน':'📎 Attach transfer slip'}
            <input type="file" accept="image/*" onChange={attach} style={{ display:'none' }}/>
          </label>}
    </div>
  );
}
/* ── ติดตามไรเดอร์ ─────────────────────────────────────────────
   งานไรเดอร์อยู่คนละเซิร์ฟเวอร์ — worker ของร้านยิงไปถามให้ (GET /orders/:id/rider)
   ทุกอย่างในนี้เป็นข้อมูลจริง ถ้ายังไม่รู้ก็บอกว่ายังไม่รู้ ไม่วาดภาพหลอก      */
const RIDER_STEP = {
  open:     { th:'ประกาศหาไรเดอร์แล้ว · รอมีคนรับงาน', en:'Looking for a rider', ic:'📣' },
  accepted: { th:'ไรเดอร์รับงานแล้ว · กำลังไปที่ร้าน',  en:'Rider heading to the shop', ic:'🛵' },
  picked:   { th:'รับอาหารแล้ว · กำลังไปหาคุณ',         en:'Picked up · on the way to you', ic:'🛵' },
  done:     { th:'ส่งถึงแล้ว',                          en:'Delivered', ic:'✅' },
};
function RiderTrack({ o }){
  const { lang } = useT(); const TH = lang!=='en';
  const [d, setD] = c2State(null);      // null = ยังไม่รู้ · {called,job,rider}
  c2Effect(()=>{
    if(!o || !o.id) return;
    let alive = true;
    const pull = async ()=>{
      try{ const r = await window.KD_API.orderRider(o.id); if(alive) setD(r||{ called:false }); }
      catch(e){ if(alive) setD({ called:false, offline:true }); }
    };
    pull();
    // ระหว่างของกำลังมา ขอสถานะใหม่ทุก 15 วิ — พอส่งถึงแล้วหยุดยิง
    const t = setInterval(()=>{ if(o.status!=='done') pull(); }, 15000);
    return ()=>{ alive = false; clearInterval(t); };
  }, [o && o.id, o && o.status]);

  if(!d) return null;
  if(!d.called) return (
    <div style={{ margin:'0 20px 16px', borderRadius:14, padding:'12px 14px', background:'var(--bg)', fontSize:12.5, color:'var(--ink-2)', lineHeight:1.55 }}>
      🛵 {TH?'ร้านยังไม่ได้เรียกไรเดอร์ — ปกติจะเรียกตอนอาหารใกล้เสร็จ':'The shop has not called a rider yet'}
    </div>
  );
  if(!d.job) return (
    <div style={{ margin:'0 20px 16px', borderRadius:14, padding:'12px 14px', background:'var(--bg)', fontSize:12.5, color:'var(--ink-2)', lineHeight:1.55 }}>
      🛵 {TH?'เรียกไรเดอร์แล้ว — ตอนนี้เช็คสถานะไม่ได้ชั่วคราว ลองใหม่อีกครั้ง':'Rider requested — status unavailable right now'}
    </div>
  );

  const st = RIDER_STEP[d.job.status] || RIDER_STEP.open;
  const r = d.rider;
  // พิกัดในใบงาน = ปลายทางที่ลูกค้าปักไว้ (ถ้าไม่ได้ปัก จะเป็นพิกัดร้าน)
  // โชว์ระยะเฉพาะช่วงที่ไรเดอร์กำลังมาหาลูกค้าจริง ๆ — ช่วงขาไปรับของที่ร้านเขาวิ่งออกห่าง บอกไปก็สับสน
  const riderAt = (r && r.lat!=null) ? { lat:+r.lat, lng:+r.lng } : null;
  const destAt  = (d.job.lat!=null)  ? { lat:+d.job.lat, lng:+d.job.lng } : null;
  const showDist = d.job.status==='picked';
  const km  = (showDist && riderAt && destAt) ? kdDistKm(riderAt, destAt) : null;
  const eta = km!=null ? Math.max(2, Math.round(km*1.3*3)) : null;
  const fresh = r && r.seenAt ? (Date.now() - r.seenAt) < 5*60*1000 : false;

  return (
    <div style={{ margin:'0 20px 16px' }}>
      <div style={{ borderRadius:16, padding:'13px 15px', background:'var(--brand-soft)', color:'var(--brand-ink)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <span style={{ fontSize:20 }}>{st.ic}</span>
          <div style={{ flex:1, fontSize:14, fontWeight:700 }}>{TH?st.th:st.en}</div>
        </div>
        {km!=null && <div style={{ fontSize:12.5, marginTop:6, fontWeight:600 }}>
          {TH?`ห่างจากคุณอีก ${km<1?Math.round(km*1000)+' ม.':km.toFixed(1)+' กม.'} · ประมาณ ${eta} นาที`
             :`${km<1?Math.round(km*1000)+' m':km.toFixed(1)+' km'} away · ~${eta} min`}
          {!fresh && <span style={{ fontWeight:400, opacity:.75 }}>{TH?' (ตำแหน่งล่าสุด อาจไม่อัปเดตนาทีนี้)':' (last known position)'}</span>}
        </div>}
      </div>
      {r && (r.name || r.phone) && <div className="kd-card" style={{ marginTop:9, padding:'12px 14px', display:'flex', alignItems:'center', gap:11 }}>
        <span style={{ width:38, height:38, borderRadius:999, background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19 }}>🛵</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700 }}>{r.name || (TH?'ไรเดอร์':'Rider')}</div>
          {r.plate && <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{TH?'ทะเบียน ':'Plate '}{r.plate}</div>}
        </div>
        {r.phone && <a href={'tel:'+r.phone} className="kd-btn kd-btn-primary" style={{ padding:'10px 15px', fontSize:13, textDecoration:'none' }}>
          {TH?'โทรหาไรเดอร์':'Call'}</a>}
      </div>}
    </div>
  );
}
/* ── ให้ดาวหลังได้รับของ — ขอเฉพาะตอนบิลปิดแล้วและยังไม่เคยรีวิว ── */
function RateBox({ o }){
  const { lang } = useT(); const TH = lang!=='en';
  const [done, setDone] = c2State(null);   // null = ยังไม่รู้ว่าเคยรีวิวไหม
  const [stars, setStars] = c2State(0);
  const [text, setText] = c2State('');
  const [busy, setBusy] = c2State(false);
  const [err, setErr] = c2State('');
  c2Effect(()=>{
    let alive = true;
    (async()=>{
      try{ const r = await window.KD_API.myReview(o.id); if(alive) setDone(!!(r && r.reviewed)); }
      catch(e){ if(alive) setDone(false); }
    })();
    return ()=>{ alive = false; };
  }, [o && o.id]);

  if(done === null) return null;
  if(done) return (
    <div style={{ margin:'0 20px 16px', borderRadius:14, padding:'12px 14px', background:'var(--brand-soft)', color:'var(--brand-ink)', fontSize:12.5, fontWeight:700 }}>
      ⭐ {TH?'ขอบคุณสำหรับรีวิวนะคะ':'Thanks for your review'}
    </div>
  );

  const send = async ()=>{
    if(!stars) return setErr(TH?'เลือกจำนวนดาวก่อน':'Pick a star rating');
    setBusy(true); setErr('');
    try{
      const lu = (typeof window!=='undefined' && window.__lineUser) || null;
      const r = await window.KD_API.postReview({ orderId:o.id, stars, text: text.trim(), lineUserId: lu?lu.userId:null });
      if(r && r.ok) setDone(true); else setErr((r&&r.error)||(TH?'ส่งรีวิวไม่สำเร็จ':'Could not send'));
    }catch(e){ setErr(TH?'ส่งรีวิวไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองใหม่':'Could not send — check your connection'); }
    setBusy(false);
  };

  return (
    <div style={{ margin:'0 20px 16px', borderRadius:16, padding:'14px 15px', background:'#fff', border:'1px solid var(--hair)' }}>
      <div style={{ fontSize:14.5, fontWeight:700 }}>{TH?'อาหารเป็นยังไงบ้าง':'How was it?'}</div>
      <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{TH?'ให้ดาวร้านนี้ — คนอื่นจะได้ตัดสินใจง่ายขึ้น':'Your rating helps other customers'}</div>
      <div style={{ display:'flex', gap:6, margin:'11px 0 4px' }}>
        {[1,2,3,4,5].map(n=>(
          <button key={n} aria-label={`${n} ${TH?'ดาว':'stars'}`} onClick={()=>{ setStars(n); setErr(''); }}
            style={{ border:'none', background:'none', cursor:'pointer', fontSize:29, lineHeight:1, padding:'2px 1px',
              filter: n<=stars ? 'none' : 'grayscale(1)', opacity: n<=stars ? 1 : .35 }}>⭐</button>
        ))}
      </div>
      {stars>0 && <textarea className="kd-input" rows={2} value={text} onChange={e=>setText(e.target.value)}
        placeholder={TH?'อยากบอกอะไรร้านเพิ่มไหม (ไม่บังคับ)':'Anything to add? (optional)'} style={{ resize:'none', marginTop:8 }}/>}
      {err && <div style={{ color:'var(--danger)', fontSize:12.5, fontWeight:700, marginTop:8 }}>{err}</div>}
      {stars>0 && <button onClick={send} disabled={busy} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:12, marginTop:9, opacity:busy?.5:1 }}>
        {busy?(TH?'กำลังส่ง…':'Sending…'):(TH?'ส่งรีวิว':'Send review')}</button>}
    </div>
  );
}
function TrackSheet({ o, patchOrder, onClose }){
  const { t, lang } = useT();
  const steps = TRACK_STEPS.filter(s=> s.key!=='delivering' || o.channel==='delivery');
  const curIdx = steps.findIndex(s=>s.key===o.status);
  const activeIdx = o.status==='ready'? steps.findIndex(s=>s.key==='cooking') : curIdx;
  return (
    <Sheet open={true} onClose={onClose} height="80%">
      <div style={{ padding:'2px 20px 16px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{lang==='th'?'ติดตามออเดอร์':'Track order'} #{o.no}</div>
        <div style={{ fontSize:13, color:'var(--ink-3)', marginTop:2 }}>{o.channel==='delivery'?(lang==='th'?'จัดส่งถึง ':'To ')+o.addr:(lang==='th'?'รับที่ร้าน':'Pick up at store')}</div>
      </div>
      {/* shop reply on requested time */}
      {o.promise && <div style={{ margin:'0 20px 16px', borderRadius:12, padding:'12px 14px', display:'flex', gap:10, alignItems:'center',
        background: o.promise.status==='ok'?'var(--brand-soft)':'#FDF0E2' }}>
        <span style={{ fontSize:22 }}>{o.promise.status==='ok'?'✅':'⏰'}</span>
        <div style={{ flex:1, fontSize:13.5 }}>
          {o.promise.status==='ok'
            ? <span style={{ color:'var(--brand-ink)', fontWeight:700 }}>{lang==='th'?`ร้านยืนยันรับได้ตามเวลา ${o.promise.time||o.when}`:`Store confirmed pickup at ${o.promise.time||o.when}`}</span>
            : <span style={{ color:'#B26A00', fontWeight:700 }}>{lang==='th'?`ร้านขอเลื่อนเป็น ${o.promise.time}`:`Store proposes ${o.promise.time}`}</span>}
          <div style={{ fontSize:12, color:'var(--ink-3)', fontWeight:400, marginTop:2 }}>{lang==='th'?`เวลาที่คุณขอ: ${o.when}`:`You asked: ${o.when}`}</div>
        </div>
      </div>}
      {/* payFirst: ร้านไม่รับออเดอร์ → คืนเงิน (กรอกบัญชี / รอโอน / สลิปคืนเงิน) */}
      {o.status==='rejected' && o.refund && <RefundBlock o={o} patchOrder={patchOrder}/>}
      {/* ได้รับของแล้ว → ขอดาว (โผล่ครั้งเดียว รีวิวแล้วเปลี่ยนเป็นคำขอบคุณ) */}
      {o.status==='done' && <RateBox o={o}/>}
      {/* Confirm-First: ร้านยืนยันแล้ว แต่ยังไม่จ่าย → โชว์ QR ให้จ่ายในหน้าติดตาม */}
      {o.payAfterConfirm && o.status!=='new' && o.status!=='void' && o.status!=='rejected' && !o.paid && o.pay==='promptpay' &&
        <ConfirmPayBlock o={o}/>}
      {/* ไรเดอร์จริง — สถานะ ชื่อ ทะเบียน ปุ่มโทร และระยะที่เหลือจริง (เดิมตรงนี้เป็นภาพวาดปลอม) */}
      {o.channel==='delivery' && <RiderTrack o={o}/>}
      {/* timeline */}
      <div style={{ padding:'0 24px', overflowY:'auto', flex:1 }}>
        {steps.map((s,i)=>{ const done=i<=activeIdx; const active=i===activeIdx; return (
          <div key={s.key} style={{ display:'flex', gap:14, position:'relative' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div style={{ width:34, height:34, borderRadius:999, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                background: done?'var(--brand)':'var(--bg)', color: done?'#fff':'var(--ink-3)',
                boxShadow: active?'0 0 0 5px var(--brand-soft)':'none', transition:'all .3s' }}>{React.cloneElement(s.ic,{size:17})}</div>
              {i<steps.length-1 && <div style={{ width:2, flex:1, minHeight:26, background: i<activeIdx?'var(--brand)':'var(--hair-2)' }}/>}
            </div>
            <div style={{ paddingBottom:20, paddingTop:5 }}>
              <div style={{ fontSize:15, fontWeight: active?700:600, color: done?'var(--ink)':'var(--ink-3)' }}>{s[lang]||s.th}</div>
              {active && <div style={{ fontSize:13, color:'var(--brand-ink)', fontWeight:600, marginTop:2 }}>{lang==='th'?'กำลังดำเนินการ…':'In progress…'}</div>}
            </div>
          </div>
        );})}
      </div>
      {o.proof && <div style={{ padding:'0 20px 8px' }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>{lang==='th'?'📷 หลักฐานการส่ง (จากไรเดอร์)':'📷 Delivery proof'}</div>
        <img src={o.proof} alt="proof" style={{ width:'100%', borderRadius:14, maxHeight:200, objectFit:'cover', display:'block' }}/>
      </div>}
      <div style={{ padding:'8px 20px 0' }}>
        <div className="kd-card" style={{ padding:'12px 15px', background:'var(--brand-softer)', boxShadow:'none', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontWeight:600, color:'var(--ink-2)' }}>{t('total')} · {PAYS[o.pay][lang]||PAYS[o.pay].th}</span>
          <span className="num" style={{ fontWeight:700, fontSize:16 }}>{money(o.total)}</span>
        </div>
      </div>
    </Sheet>
  );
}

/* ══════════════ CUSTOMER SHELL ══════════════ */
function CustomerApp({ store }){
  const { t } = useT();
  const [tab,setTab] = c2State('menu');
  const hotIds = React.useMemo(()=>{ const q={}; (store.sales||[]).forEach(s=>(s.items||[]).forEach(([id,n])=>{ q[id]=(q[id]||0)+(Number(n)||0); })); const top=Object.entries(q).sort((a,b)=>b[1]-a[1]).filter(e=>e[1]>0).slice(0,3).map(e=>e[0]); return new Set(top); }, [store.sales]);
  const [checkout,setCheckout] = c2State(false);
  const [cart,setCart] = c2State({});
  // สินค้าขายฝากที่คงเหลือ 0 → โชว์ "สินค้าหมด" real-time (รีเฟรชตามรอบ poll ออเดอร์)
  const [csStock,setCsStock] = c2State({});
  React.useEffect(()=>{ if(typeof window!=='undefined' && window.KD_LIVE && window.KD_API && window.KD_API.listConsignStock){ window.KD_API.listConsignStock().then(r=>{ if(Array.isArray(r)){ const m={}; r.forEach(c=>{ m[c.id]=c.stock; }); setCsStock(m); } }).catch(()=>{}); } },[store.orders]);
  // เปิดจากหน้า "ร้านทั้งหมด / ตลาด" ของแพลตฟอร์ม (?via=market) → เห็นเฉพาะเมนูที่ร้านติ๊กช่องทาง
  // "ขายบน :Done KaiDee" ไว้ และใช้ราคาของช่องทางนั้น (ร้านตั้งราคาแยกต่อช่องทางได้ในหน้าแก้เมนู)
  const viaMarket = React.useMemo(()=> (typeof kdViaMarket==='function' ? kdViaMarket() : false), []);
  const menuView = React.useMemo(()=>{
    const list = (viaMarket && typeof marketMenuView==='function') ? marketMenuView(store.menu) : (store.menu||[]);
    return list.map(m=> (m.consign && m.consignId && csStock[m.consignId]!=null && csStock[m.consignId]<=0) ? {...m, off:true} : m);
  }, [store.menu, csStock, viaMarket]);
  const [placed,setPlaced] = c2State(null);
  const cartCount = Object.values(cart).reduce((a,e)=>a+((e&&e.qty)||0),0);
  const myActive = store.orders.filter(o=>o.mine && o.status!=='done').length;
  const lineOrderOff = !!(store.shop && store.shop.features && store.shop.features.orders===false);

  const lineKey = (id,opts)=> id+'|'+((opts||[]).map(o=>o.g+':'+o.label).join('|'));
  const addItem = (id,q,opts,add)=> setCart(p=>{ const k=lineKey(id,opts); const cur=p[k]; return { ...p, [k]: { id, qty:((cur&&cur.qty)||0)+q, opts:opts||[], add:add||0 } }; });
  const setQty = (key,q)=> setCart(p=>{ const n={...p}; if(q<=0) delete n[key]; else if(n[key]) n[key]={ ...n[key], qty:q }; return n; });

  const place = (payload)=>{
    const lu = (typeof window!=='undefined' && window.__lineUser) || null;
    const custName = payload.customer || (lu ? lu.name : (typeof window!=='undefined' && window.__lang==='en' ? 'Guest' : 'ลูกค้า'));
    const o = store.addOrder({ ...payload, mine:true, customer:custName });
    setCart({}); setCheckout(false); setPlaced(o);
    // สัญญาณเบาสำหรับจับคู่ดีล (เก็บในเครื่องนี้เท่านั้น · ไม่มีชื่อ/เบอร์) — PDPA
    try{ if(window.KDTaste) window.KDTaste.note({ cats:(window.kdSponsorCatsOfShop?window.kdSponsorCatsOfShop(store.shop):[]), amount:o.total }); }catch(e){}
    // ส่งใบยืนยันกลับเข้าแชท LINE (ทำงานเฉพาะตอนเปิดจริงในแอป LINE)
    if(window.kdSendReceipt) window.kdSendReceipt(o);
  };

  return (
    <>
      {lineOrderOff && <div style={{ position:'absolute', inset:0, zIndex:60, background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:30, textAlign:'center', gap:12 }}>
        <div style={{ fontSize:44 }}>🌙</div>
        <div style={{ fontSize:19, fontWeight:700 }}>{store.shop&&store.shop.name}</div>
        <div style={{ fontSize:14.5, color:'var(--ink-2)', lineHeight:1.6, maxWidth:280 }}>ขออภัย ร้านนี้ยังไม่เปิดรับออเดอร์ออนไลน์ผ่าน LINE<br/>กรุณาสั่งที่ร้านโดยตรง</div>
      </div>}
      <div style={{ position:'absolute', inset:0, bottom:74 }}>
        {checkout ? <Checkout cart={cart} shop={store.shop} payCfg={store.pay} store={store} onBack={()=>setCheckout(false)} onPlace={place}/> :
         tab==='menu'   ? ((viaMarket && window.MarketShopMenu)
             ? <MarketShopMenu menu={menuView} cart={cart} addItem={addItem} shop={store.shop} hotIds={hotIds} onCart={()=>setTab('cart')}/>
             : <CustMenu menu={menuView} cart={cart} addItem={addItem} shop={store.shop} hotIds={hotIds}/>) :
         tab==='cart'   ? <CustCart cart={cart} menu={store.menu} setQty={setQty} onCheckout={()=>setCheckout(true)}/> :
         tab==='orders' ? <CustOrders orders={store.orders} patchOrder={store.patchOrder}/> :
                          <CustProfile store={store}/>}
      </div>
      {!checkout && <div style={{ position:'absolute', left:0, right:0, bottom:0 }}>
        <TabBar active={tab} onChange={setTab} tabs={[
          { key:'menu',   label:t('menu'),     icon:IC.menu },
          { key:'cart',   label:t('cart'),     icon:IC.cart, badge:cartCount },
          { key:'orders', label:t('myOrders'), icon:IC.receipt, badge:myActive },
          { key:'profile',label:t('profile'),  icon:IC.user },
        ]}/>
      </div>}
      {placed && <PlacedScreen o={(store.orders.find(x=>x.id===placed.id)||placed)} shop={store.shop} qrImg={store.pay.qrImg} patchOrder={store.patchOrder} onTrack={()=>{ setPlaced(null); setTab('orders'); }} onClose={()=>setPlaced(null)}/>}
    </>
  );
}

function PlacedScreen({ o, onTrack, onClose, qrImg, patchOrder, shop }){
  const { t, lang } = useT();
  // การ์ดดีลสปอนเซอร์ — เจ้าของร้านเปิดเอง (ค่าเริ่มต้น = ปิด) · โชว์เฉพาะหมวดที่ไม่ชนกับร้านนี้ · จำกัด 2 การ์ด
  const SF = (typeof window!=='undefined') && (shop&&shop.features&&shop.features.sponsorDeals===true) && window.KDSponsorFeed;
  const isPre = o.when && !/เลย|ASAP/.test(o.when);
  const awaitConfirm = !!o.payAfterConfirm && o.status==='new';   // confirm-first: รอร้านยืนยันก่อนจึงจ่าย
  const needQR = o.pay==='promptpay' && !awaitConfirm;
  const [slip,setSlip] = c2State(o.slipUrl||null);
  const [called,setCalled] = c2State(!!o.callCash);
  const cap = (file)=>{ if(!file) return; const r=new FileReader(); r.onload=()=>{ setSlip(r.result); if(patchOrder) patchOrder(o.id,{ slipUrl:r.result, slipAt:Date.now(), paid:false, slipVerified:false, slipStatus:'pending' }); }; r.readAsDataURL(file); };
  // โหมด live → ขอ PromptPay payload จริงจาก server มาเรนเดอร์ QR สแกนจ่ายได้จริง
  const [ppPayload,setPpPayload] = c2State(o.promptpay||null);
  React.useEffect(()=>{
    if(needQR && !ppPayload && window.KD_LIVE && window.KD_API){
      window.KD_API.payQR(o.total).then(r=>{ if(r&&r.payload) setPpPayload(r.payload); }).catch(()=>{});
    }
  }, []);
  return (
    <div style={{ position:'absolute', inset:0, zIndex:55, background:'#fff', display:'flex', flexDirection:'column', animation:'kdFade .25s' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:14 }}>
        <div className="kd-pop" style={{ width:84, height:84, borderRadius:999, background:'var(--brand-soft)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {React.cloneElement(isPre?IC.calendar:IC.check,{size:44, color:'var(--brand)', stroke:2.4})}</div>
        <div style={{ fontSize:22, fontWeight:700 }}>{isPre?(lang==='th'?'จองล่วงหน้าสำเร็จ':'Pre-order confirmed'):(lang==='th'?'สั่งอาหารสำเร็จ':'Order placed')}</div>
        <div style={{ color:'var(--ink-3)', textAlign:'center' }}>#{o.no} · {awaitConfirm?(lang==='th'?'ส่งให้ร้านยืนยัน':'Sent to store'):(isPre?o.when:(lang==='th'?'ร้านกำลังรับออเดอร์':'Sending to store'))}</div>
        {o.status==='rejected' && o.refund && <div style={{ alignSelf:'stretch', margin:'4px -4px 0' }}><RefundBlock o={o} patchOrder={patchOrder}/></div>}
        {awaitConfirm && <div className="kd-card" style={{ padding:'14px 16px', textAlign:'center', marginTop:4, background:'var(--accent-soft)', boxShadow:'none' }}>
          <div style={{ fontWeight:700, color:'var(--accent-ink)' }}>{lang==='th'?'⏳ รอร้านยืนยันรับออเดอร์':'⏳ Waiting for the shop to confirm'}</div>
          <div style={{ fontSize:12.5, color:'var(--accent-ink)', marginTop:4, lineHeight:1.5 }}>{lang==='th'?'เมื่อร้านยืนยัน ระบบจะขึ้น QR ให้สแกนจ่ายที่หน้านี้':'Once confirmed, the PromptPay QR appears here to pay'}</div>
        </div>}
        {needQR && <div className="kd-card" style={{ padding:16, textAlign:'center', marginTop:4 }}>
          <QRBlock src={ppPayload?null:qrImg} payload={ppPayload}/><div style={{ fontWeight:700, marginTop:8 }} className="num">{money(o.total)}</div>
          <div style={{ fontSize:12, color:'var(--ink-3)' }}>{lang==='th'?'สแกนพร้อมเพย์เพื่อจ่าย':'Scan PromptPay to pay'}</div>
          {slip ? <div style={{ marginTop:10 }}><img src={slip} alt="slip" style={{ maxWidth:160, borderRadius:10, border:'1px solid var(--hair)' }}/><div style={{ fontSize:12.5, color:'var(--brand-ink)', fontWeight:700, marginTop:6 }}>{lang==='th'?'✓ ส่งสลิปแล้ว รอร้านตรวจ':'✓ Slip sent'}</div></div>
            : <label style={{ display:'inline-block', marginTop:10, cursor:'pointer', background:'var(--brand-soft)', color:'var(--brand-ink)', fontWeight:700, fontSize:13, padding:'9px 14px', borderRadius:10 }}>{lang==='th'?'📷 ถ่าย/แนบสลิปโอน':'Attach slip'}<input type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e=>cap(e.target.files&&e.target.files[0])}/></label>}</div>}
        {o.pay==='cash' && <div className="kd-card" style={{ padding:14, textAlign:'center', marginTop:4, background:'var(--accent-soft)', boxShadow:'none' }}>
          <div style={{ fontWeight:700, color:'var(--accent-ink)' }}>{lang==='th'?'💵 จ่ายเงินสดที่ร้าน':'Pay cash at shop'}</div>
          <div style={{ fontSize:12.5, color:'var(--accent-ink)', marginTop:3, marginBottom:10 }}>{lang==='th'?'กดเรียกพนักงานมาเก็บเงิน · ร้านจะจบบิลให้':'Call staff to collect & close the bill'}</div>
          {called ? <div style={{ fontWeight:700, color:'var(--brand-ink)', fontSize:14 }}>{lang==='th'?'✓ เรียกพนักงานแล้ว รอสักครู่':'✓ Staff notified'}</div>
            : <button onClick={()=>{ setCalled(true); if(patchOrder) patchOrder(o.id,{ callCash:true, callCashAt:Date.now() }); }} className="kd-btn kd-btn-primary" style={{ padding:'11px 18px', fontWeight:700 }}>{lang==='th'?'🔔 เรียกพนักงานเก็บเงิน':'Call staff for cash'}</button>}</div>}
      </div>
      <div style={{ padding:'0 20px calc(20px + 8px)', display:'flex', flexDirection:'column', gap:10 }}>
        {SF && <SF mod="pos-success" limit={2} compact shop={shop} avg={o.total}
          title={lang==='th'?'🎁 ดีลจากร้านใกล้เคียง':'🎁 Deals nearby'}/>}
        <button onClick={onTrack} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:16 }}>{lang==='th'?'ติดตามออเดอร์':'Track order'}</button>
        <button onClick={onClose} className="kd-btn kd-btn-ghost kd-btn-block" style={{ padding:14 }}>{lang==='th'?'สั่งเพิ่ม':'Order more'}</button>
      </div>
    </div>
  );
}

function CustProfile({ store }){
  const { t, lang } = useT();
  const TH = lang!=='en';
  const lu = (typeof window!=='undefined' && window.__lineUser) || null;
  const canLogin = typeof window!=='undefined' && window.kdCanLineLogin && window.kdCanLineLogin();
  const shopName = (store && store.shop && store.shop.name) || '';
  // เงื่อนไขสะสมที่ร้านตั้ง (pay.loyalty · sync จากแอปร้าน) + ค่า default
  const L = (store && store.pay && store.pay.loyalty) || {};
  const perBaht   = Number(L.perBaht)>0   ? Number(L.perBaht)   : 25;
  const stampGoal = Number(L.stampGoal)>0 ? Number(L.stampGoal) : 10;
  const rewardAt  = Number(L.rewardAt)>0  ? Number(L.rewardAt)  : 100;
  const stampReward = L.stampReward || (TH?'ฟรี 1 เมนู':'Free item');
  const rewardText  = L.rewardText  || (TH?'ส่วนลด ฿20':'฿20 off');

  // ── ดึงแต้ม/จำนวนครั้งจริงจากฐานข้อมูลกลาง (คีย์ด้วย Line_ID) ──
  const [mem,setMem] = c2State(()=> lu ? ((store&&store.members||[]).find(m=>m.id===lu.userId)||null) : null);
  React.useEffect(()=>{
    if(lu && lu.userId && typeof window!=='undefined' && window.KD_LIVE && window.KD_API && window.KD_API.getMember){
      window.KD_API.getMember(lu.userId).then(r=>{ if(r && (r.points!=null || r.visits!=null)) setMem(r); }).catch(()=>{});
    }
  }, [lu && lu.userId]);

  // ── ยังไม่ล็อกอิน → หน้าเชิญเข้าสู่ระบบด้วย LINE (ใช้ได้แม้เปิดนอก LINE ผ่าน QR/เบราว์เซอร์) ──
  if(!lu){
    return (
      <div className="kd-screen" style={{ background:'var(--bg)' }}>
        <LineHeader title={t('profile')}/>
        <div className="kd-body" style={{ padding:16 }}>
          <div className="kd-card" style={{ padding:'26px 20px', textAlign:'center' }}>
            <div style={{ width:66, height:66, borderRadius:999, background:'var(--brand-soft)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>{React.cloneElement(IC.star,{size:32, color:'var(--brand)'})}</div>
            <div style={{ fontSize:18.5, fontWeight:700 }}>{TH?'สะสมดวงสแตมป์ & แต้ม':'Collect stamps & points'}</div>
            <div style={{ fontSize:13.5, color:'var(--ink-2)', lineHeight:1.6, margin:'8px 0 3px' }}>{TH?`เข้าสู่ระบบด้วย LINE เพื่อสะสมแต้ม${shopName?`ที่ ${shopName}`:''} — สั่งครบตามเงื่อนไขรับรางวัล`:'Sign in with LINE to earn stamps & rewards'}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)', marginBottom:18 }}>{TH?'ใช้ LINE ส่วนตัวของคุณ · ร้านไม่ต้องมี LINE OA':'Use your own LINE · no shop LINE OA needed'}</div>
            {canLogin
              ? <button onClick={()=>window.kdLoginLine && window.kdLoginLine()} className="kd-btn kd-btn-block" style={{ background:'var(--line-green)', color:'#fff', padding:14, fontWeight:700, fontSize:15 }}>{TH?'เข้าสู่ระบบด้วย LINE':'Sign in with LINE'}</button>
              : <div style={{ fontSize:12.5, color:'var(--ink-3)', background:'var(--bg)', borderRadius:10, padding:'13px 14px', lineHeight:1.5 }}>{TH?'เปิดหน้านี้ผ่านลิงก์ร้าน (สแกน QR หรือปุ่มใน LINE) เพื่อเข้าสู่ระบบสมาชิก':'Open via the shop link (QR or LINE) to sign in'}</div>}
          </div>
        </div>
      </div>
    );
  }

  const dispName = lu.name || (TH?'ลูกค้า':'Guest');
  const initial = (dispName||'?').trim().charAt(0);
  const points = mem && mem.points!=null ? mem.points : 0;
  const visits = mem && mem.visits!=null ? mem.visits : 0;
  const tier = (mem && mem.tier) || 'member';
  const tierLabel = tier==='gold'?(TH?'สมาชิกทอง':'Gold'):tier==='silver'?(TH?'สมาชิกเงิน':'Silver'):(TH?'สมาชิก':'Member');
  // ดวงสแตมป์: สั่งครบ stampGoal ครั้ง = 1 ใบ (รับรางวัล) · โชว์ใบปัจจุบัน
  const cardDone = Math.floor(visits / stampGoal);
  const inCard = visits - cardDone*stampGoal;   // 0..stampGoal-1
  // ความคืบหน้าแต้ม → รางวัลถัดไป
  const towardReward = rewardAt>0 ? points % rewardAt : 0;
  const remainPts = Math.max(0, rewardAt - towardReward);
  const dot = (fill)=>({ width:26, height:26, borderRadius:999, flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center',
    background: fill?'var(--line-green)':'#fff', border: fill?'none':'2px dashed var(--hair-2)', color:'#fff', fontSize:13, fontWeight:700 });

  return (
    <div className="kd-screen" style={{ background:'var(--bg)' }}>
      <LineHeader title={t('profile')}/>
      <div className="kd-body" style={{ padding:16 }}>
        <div className="kd-card" style={{ padding:18, display:'flex', gap:14, alignItems:'center', marginBottom:14 }}>
          <div style={{ width:56, height:56, borderRadius:999, background:'var(--line-green)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:700, overflow:'hidden',
            backgroundImage: lu.avatar?`url(${lu.avatar})`:'none', backgroundSize:'cover', backgroundPosition:'center' }}>{lu.avatar?'':initial}</div>
          <div><div style={{ fontWeight:700, fontSize:17 }}>{dispName}</div>
            <div style={{ fontSize:13, color:'var(--ink-3)' }}>{TH?'เข้าสู่ระบบด้วย LINE แล้ว':'Signed in with LINE'}</div></div>
        </div>

        {/* ── บัตรสะสมดวงสแตมป์ (ตามเงื่อนไขร้าน) ── */}
        <div className="kd-card" style={{ padding:'17px 18px', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
            <div style={{ fontWeight:700, fontSize:15.5, display:'flex', alignItems:'center', gap:7 }}>{React.cloneElement(IC.star,{size:16, color:'var(--brand)'})} {TH?'บัตรสะสมแสตมป์':'Stamp card'}{shopName?` · ${shopName}`:''}</div>
            {cardDone>0 && <span className="kd-chip">{TH?`ครบแล้ว ${cardDone} ใบ`:`${cardDone} filled`}</span>}
          </div>
          <div style={{ fontSize:12.5, color:'var(--ink-2)', marginBottom:12 }}>{TH?`สั่งครบ ${stampGoal} ครั้ง รับ${stampReward}`:`Order ${stampGoal}× to get ${stampReward}`}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:9 }}>
            {Array.from({length:stampGoal}).map((_,i)=>(
              <div key={i} style={dot(i<inCard)}>{i<inCard?React.cloneElement(IC.check,{size:14,stroke:2.6}):''}</div>
            ))}
          </div>
          <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:11 }}>{TH?`สั่งแล้ว ${visits} ครั้ง · อีก ${Math.max(0,stampGoal-inCard)} ครั้งได้รางวัล`:`${visits} orders · ${Math.max(0,stampGoal-inCard)} to reward`}</div>
        </div>

        {/* ── QR สมาชิก (ให้ร้านสแกนตอนสั่งหน้าร้าน) ── */}
        <div className="kd-card" style={{ padding:'16px 18px', marginBottom:14, textAlign:'center' }}>
          <div style={{ fontWeight:700, fontSize:14.5 }}>{TH?'QR สมาชิกของฉัน':'My member QR'}</div>
          <div style={{ fontSize:12, color:'var(--ink-3)', margin:'3px 0 12px' }}>{TH?'ยื่นให้ร้านสแกนตอนสั่งหน้าร้าน เพื่อสะสมแต้ม/สแตมป์':'Show at the counter to earn points'}</div>
          <div style={{ display:'inline-block' }}><QRBlock payload={`KDMEMBER:${lu.userId}`}/></div>
        </div>

        {/* ── แต้มสะสม (฿-based) ── */}
        <div className="kd-card" style={{ padding:'18px 18px', marginBottom:16, position:'relative', overflow:'hidden',
          background:'linear-gradient(135deg,#C79A2E,#E7C15A)', color:'#3A2C05' }}>
          <div style={{ position:'absolute', right:-20, top:-20, width:120, height:120, borderRadius:999, background:'rgba(255,255,255,.18)' }}/>
          <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, fontWeight:700 }}>{React.cloneElement(IC.star,{size:15, fill:'#3A2C05'})} {tierLabel}{shopName?` · ${shopName}`:''}</div>
          <div className="num" style={{ fontSize:34, fontWeight:700, margin:'8px 0 2px' }}>{points} <span style={{ fontSize:15, fontWeight:600 }}>{TH?'แต้ม':'pts'}</span></div>
          <div style={{ fontSize:12.5, fontWeight:600, opacity:.85 }}>{TH?`อีก ${remainPts} แต้ม แลก${rewardText} · สะสม 1 แต้ม/฿${perBaht}`:`${remainPts} pts to ${rewardText} · 1 pt/฿${perBaht}`}</div>
          <div style={{ marginTop:12, height:7, background:'rgba(58,44,5,.2)', borderRadius:999, overflow:'hidden' }}>
            <div style={{ width:`${rewardAt>0?Math.round(towardReward/rewardAt*100):0}%`, height:'100%', background:'#3A2C05', borderRadius:999 }}/></div>
        </div>

        {[[IC.pin,TH?'ที่อยู่ของฉัน':'My addresses'],[IC.wallet,TH?'ช่องทางชำระเงิน':'Payment methods'],[IC.bell,TH?'การแจ้งเตือน':'Notifications'],[IC.star,TH?'ร้านโปรด':'Favourite shops']].map(([ic,l],i)=>(
          <div key={i} className="kd-card" style={{ padding:'15px 16px', display:'flex', alignItems:'center', gap:13, marginBottom:9 }}>
            <span style={{ color:'var(--brand)' }}>{ic}</span><span style={{ flex:1, fontWeight:600 }}>{l}</span><span style={{ color:'var(--ink-3)' }}>{IC.chev}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { CustCart, Checkout, CustOrders, TrackSheet, CustomerApp, PlacedScreen, ConfirmPayBlock, CustProfile, TRACK_STEPS });
