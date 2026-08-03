// kaidee-market-shop.jsx — หน้าร้านฝั่งลูกค้า "แพลตฟอร์ม" (?via=market) สไตล์ LINE MAN / Grab
// ใช้แทน CustMenu เฉพาะตอนลูกค้าเข้ามาจากหน้า "ร้านทั้งหมด/ตลาด" เท่านั้น — flow เดิมทาง LINE OA ไม่กระทบ
// สั่ง → ตะกร้า → ชำระเงิน → ติดตามสถานะ ใช้ของเดิมทั้งหมด (Checkout / TrackSheet) ไม่แตะโค้ดจ่ายเงิน
const { useState:msState, useEffect:msEffect } = React;

function MsChip({ on, children, onClick }){
  return <button onClick={onClick} style={{ border:'none', cursor:'pointer', fontFamily:'var(--font)', whiteSpace:'nowrap',
    fontSize:13.5, fontWeight:700, padding:'9px 15px', borderRadius:999, transition:'.15s',
    background: on?'var(--brand)':'#fff', color: on?'#fff':'var(--ink-2)', boxShadow: on?'none':'0 1px 4px rgba(20,40,32,.10)' }}>{children}</button>;
}

function MarketShopMenu({ menu, cart, addItem, shop = {}, hotIds, onCart }){
  const { lang } = useT();
  const TH = lang !== 'en';
  const cats = useCats();
  const [q, setQ] = msState('');
  const [cat, setCat] = msState('all');
  const [detail, setDetail] = msState(null);
  // โปรที่ร้านเปิดอยู่ตอนนี้ (เฉพาะที่ลดอัตโนมัติ) — โชว์ก่อนลูกค้าเลือกของ จะได้รู้ว่าคุ้มตรงไหน
  const [promos, setPromos] = msState([]);
  msEffect(()=>{
    let dead = false;
    (async()=>{
      try{ const r = await window.KD_API.listPromos({ live:1 }); if(!dead) setPromos(r||[]); }
      catch(e){ if(!dead) setPromos([]); }
    })();
    return ()=>{ dead = true; };
  }, [shop && shop.shopId]);
  // เมนูที่เข้าโปร → ติดป้ายบนการ์ดเมนูให้ตรงใบ
  const promoByItem = (()=>{
    const map = {};
    promos.forEach(p=>{
      if(p.scope==='item') (p.scopeIds||[]).forEach(id=>{ if(!map[id]) map[id]=p; });
      else if(p.scope==='cat') (menu||[]).forEach(m=>{ if((p.scopeIds||[]).includes(m.cat) && !map[m.id]) map[m.id]=p; });
    });
    return map;
  })();

  const isHot = (m)=> !!(m && ((hotIds && hotIds.has && hotIds.has(m.id)) || m.hot));
  const openNow = (window.kdShopOpen ? window.kdShopOpen(shop) : shop.isOpen !== false) && shop.marketOpen !== false;
  const paused = shop.marketOpen === false;

  const lines = Object.values(cart||{});
  const count = lines.reduce((a,e)=>a+((e&&e.qty)||0),0);
  const total = lines.reduce((a,e)=>{ const m=menuById(e.id); return a + (((m&&m.price)||0)+(e.add||0))*((e&&e.qty)||0); }, 0);

  const qlc = q.trim().toLowerCase();
  const shown = (menu||[]).filter(m=>{
    if (m.off) return true;   // ของหมดยังโชว์ (ติดป้าย) เหมือน LINE MAN
    return true;
  }).filter(m=> !qlc || String(m[lang]||m.th||'').toLowerCase().includes(qlc));
  const catsWithItems = cats.filter(c=> shown.some(m=>m.cat===c.id));
  const sections = (cat==='all' ? catsWithItems : catsWithItems.filter(c=>c.id===cat))
    .map(c=>({ cat:c, items: shown.filter(m=>m.cat===c.id) }));

  const back = ()=>{ try{
    const u = new URL(location.href);
    ['shop','via'].forEach(k=>u.searchParams.delete(k));
    u.searchParams.set('role','market');
    location.href = u.toString();
  }catch(e){ history.back(); } };

  return (
    <div className="kd-screen" style={{ background:'var(--bg)' }}>
      {/* hero — ปกร้าน + ปุ่มกลับไปหน้าร้านทั้งหมด (ไม่ใช่แถบ LINE OA) */}
      <div style={{ position:'relative', flexShrink:0, height:168,
        background: shop.cover ? '#333' : 'linear-gradient(140deg,var(--brand),var(--brand-2,#1F4F86))',
        backgroundImage: shop.cover?`url(${shop.cover})`:'none', backgroundSize:'cover', backgroundPosition:'center' }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,rgba(0,0,0,.34),rgba(0,0,0,.06) 45%,rgba(0,0,0,.42))' }}/>
        <button onClick={back} aria-label="back" style={{ position:'absolute', top:'calc(12px + env(safe-area-inset-top))', left:12, width:38, height:38, borderRadius:999,
          border:'none', cursor:'pointer', background:'rgba(255,255,255,.94)', color:'var(--ink)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,.18)' }}>
          {React.cloneElement(IC.back,{ size:21 })}</button>
        <div style={{ position:'absolute', left:16, right:16, bottom:14, display:'flex', gap:12, alignItems:'flex-end' }}>
          <div style={{ width:60, height:60, borderRadius:16, background:'#fff', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:31,
            overflow:'hidden', boxShadow:'0 3px 12px rgba(0,0,0,.22)',
            backgroundImage: shop.logo?`url(${shop.logo})`:'none', backgroundSize:'cover', backgroundPosition:'center' }}>{!shop.logo && (shop.emoji||'🍽️')}</div>
          <div style={{ flex:1, minWidth:0, color:'#fff' }}>
            <div style={{ fontSize:20, fontWeight:800, textShadow:'0 1px 6px rgba(0,0,0,.35)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{shop.name||'ร้านค้า'}</div>
            <div style={{ fontSize:12.5, opacity:.95, marginTop:3, display:'flex', gap:9, flexWrap:'wrap' }}>
              {shop.rating > 0 && <span style={{ fontWeight:700 }}>⭐ {shop.rating} ({shop.reviewCount})</span>}
              {shop.cat && <span>{shop.rating>0?'· ':''}{shop.cat}</span>}
              {shop.open && shop.close && <span>· {shop.open}–{shop.close}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* แถบข้อมูลร้าน — ตลาด/สถานะ/วิธีรับ */}
      <div style={{ flexShrink:0, background:'#fff', padding:'11px 16px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', borderBottom:'1px solid var(--hair)' }}>
        {shop.market && <span style={{ fontSize:11.5, fontWeight:700, color:'var(--brand-ink)', background:'var(--brand-soft)', padding:'5px 10px', borderRadius:999 }}>📍 {shop.market}</span>}
        <span style={{ fontSize:11.5, fontWeight:700, padding:'5px 10px', borderRadius:999,
          background: openNow?'#E6F6EC':'#F1EEEE', color: openNow?'#12945C':'var(--ink-3)' }}>
          {openNow ? (TH?'🟢 เปิดรับออเดอร์':'🟢 Open') : paused ? (TH?'⏸️ พักรับออเดอร์':'⏸️ Paused') : (TH?'🔴 ปิดอยู่':'🔴 Closed')}</span>
        <span style={{ fontSize:11.5, fontWeight:700, color:'var(--ink-2)', background:'var(--bg)', padding:'5px 10px', borderRadius:999 }}>{TH?'🛍️ สั่งแล้วไปรับที่ร้าน':'🛍️ Pick up'}</span>
        <span style={{ fontSize:11.5, fontWeight:700, color:'var(--ink-2)', background:'var(--bg)', padding:'5px 10px', borderRadius:999 }}>{TH?'ราคาเท่าหน้าร้าน':'Same price as in-store'}</span>
      </div>

      {/* แถบโปรของร้าน — เลื่อนแนวนอนแบบ LINE MAN · ลดให้อัตโนมัติตอนจ่ายเงิน ไม่ต้องกดอะไร */}
      {promos.length > 0 && <div style={{ flexShrink:0, background:'#fff', padding:'11px 0 13px', borderBottom:'1px solid var(--hair)' }}>
        <div style={{ fontSize:12.5, fontWeight:800, color:'var(--ink-2)', padding:'0 16px 8px' }}>
          {TH?'🎟️ โปรของร้านนี้':'🎟️ Deals here'}</div>
        <div style={{ display:'flex', gap:9, overflowX:'auto', padding:'0 16px' }} className="kd-chiprow">
          {promos.map(p=>(
            <div key={p.id} style={{ flexShrink:0, minWidth:158, maxWidth:230, borderRadius:14, padding:'11px 13px',
              background:'linear-gradient(135deg,#FFF1E8,#FFE3D0)', border:'1px solid #FFD3B5' }}>
              <div style={{ fontSize:14, fontWeight:800, color:'#B4531A' }}>{promoText(p, TH)}</div>
              <div style={{ fontSize:11.5, color:'var(--ink-2)', marginTop:3, lineHeight:1.4 }}>{p.name}</div>
              {promoSubText(p, TH) && <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{promoSubText(p, TH)}</div>}
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:'var(--ink-3)', padding:'9px 16px 0' }}>
          {TH?'ระบบหักให้อัตโนมัติตอนจ่ายเงิน ไม่ต้องกดรับสิทธิ์':'Applied automatically at checkout'}</div>
      </div>}

      {/* ค้นหา + หมวด (เกาะบนเวลาเลื่อน) */}
      <div style={{ flexShrink:0, background:'#fff', padding:'10px 16px 12px', borderBottom:'1px solid var(--hair)' }}>
        <div style={{ position:'relative', marginBottom:10 }}>
          <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:.6 }}>🔍</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder={TH?'ค้นหาเมนูในร้านนี้':'Search this menu'}
            style={{ width:'100%', border:'none', background:'var(--bg)', borderRadius:12, padding:'12px 14px 12px 38px', fontFamily:'var(--font)', fontSize:14.5 }}/>
        </div>
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:2 }} className="kd-chiprow">
          <MsChip on={cat==='all'} onClick={()=>setCat('all')}>{TH?'ทั้งหมด':'All'}</MsChip>
          {catsWithItems.map(c=> <MsChip key={c.id} on={cat===c.id} onClick={()=>setCat(c.id)}>{c.emoji} {c[lang]||c.th}</MsChip>)}
        </div>
      </div>

      {!openNow && <div style={{ margin:'12px 16px 0', flexShrink:0, background:'#FBEAD7', color:'#B26A00', borderRadius:12, padding:'11px 14px', fontSize:13, fontWeight:600, textAlign:'center', lineHeight:1.5 }}>
        {paused ? (TH?'ร้านพักรับออเดอร์บนแพลตฟอร์มชั่วคราว — ดูเมนูได้ แต่ยังสั่งไม่ได้':'Paused — browsing only')
                : (TH?'ร้านปิดอยู่ตอนนี้ — ดูเมนูไว้ก่อนได้ กลับมาสั่งตอนร้านเปิดนะคะ':'Closed right now — check back later')}
      </div>}

      <div className="kd-body" style={{ padding:`10px 16px ${count>0?116:96}px` }}>
        {sections.length===0 ? (
          <div style={{ textAlign:'center', padding:'56px 26px', color:'var(--ink-3)' }}>
            <div style={{ fontSize:42 }}>{qlc?'🔎':'🍽️'}</div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--ink)', marginTop:10 }}>{qlc?(TH?'ไม่เจอเมนูที่ค้นหา':'No results'):(TH?'ร้านกำลังจัดเมนู':'Menu coming soon')}</div>
            <div style={{ fontSize:13, marginTop:6, lineHeight:1.5 }}>{qlc?(TH?'ลองพิมพ์คำสั้นลง':'Try a shorter word'):(TH?'เปิดขายเร็ว ๆ นี้ กลับมาดูใหม่นะคะ 🙏':'Please check back 🙏')}</div>
          </div>
        ) : sections.map(sec=>(
          <div key={sec.cat.id} style={{ marginBottom:20 }}>
            <div style={{ fontSize:16, fontWeight:800, margin:'2px 2px 10px', display:'flex', alignItems:'center', gap:7 }}>
              <span>{sec.cat.emoji}</span>{sec.cat[lang]||sec.cat.th}
              <span style={{ fontSize:12.5, fontWeight:600, color:'var(--ink-3)' }}>· {sec.items.length}</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {sec.items.map(m=>{ const soldout = !!m.off;
                return (
                  <button key={m.id} disabled={soldout||!openNow} onClick={()=>setDetail(m)} style={{ border:'none', cursor:(soldout||!openNow)?'default':'pointer',
                    width:'100%', display:'flex', gap:12, padding:12, textAlign:'left', fontFamily:'var(--font)',
                    background:'#fff', borderRadius:16, boxShadow:'0 1px 6px rgba(20,40,32,.07)', opacity:(soldout||!openNow)?.55:1 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                        {m[lang]||m.th}
                        {isHot(m) && <span style={{ fontSize:10.5, fontWeight:800, color:'#B45309', background:'#FEF3C7', padding:'2px 7px', borderRadius:999 }}>🔥 {TH?'ขายดี':'Popular'}</span>}
                      </div>
                      {(m.options && m.options.length>0) &&
                        <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:4 }}>{TH?`เลือกได้ ${m.options.length} แบบ`:`${m.options.length} options`}</div>}
                      <div className="num" style={{ fontSize:16, fontWeight:800, marginTop:6 }}>{money(m.price)}</div>
                      {promoByItem[m.id] && <div style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:5,
                        fontSize:11, fontWeight:800, color:'#B4531A', background:'#FFF1E8', padding:'3px 8px', borderRadius:999 }}>
                        🎟️ {promoText(promoByItem[m.id], TH)}</div>}
                      {soldout && <div style={{ fontSize:11.5, fontWeight:700, color:'var(--danger)', marginTop:4 }}>{TH?'สินค้าหมด':'Sold out'}</div>}
                    </div>
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <FoodTile item={m} size={84} radius={14}/>
                      {!soldout && openNow && <div style={{ position:'absolute', bottom:-6, right:-6, width:30, height:30, borderRadius:999,
                        background:'var(--brand)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,.2)' }}>
                        {React.cloneElement(IC.plus,{ size:17, stroke:2.6 })}</div>}
                    </div>
                  </button>
                );})}
            </div>
          </div>
        ))}
      </div>

      {/* แถบตะกร้าลอย — ลายเซ็นของ LINE MAN/Grab */}
      {count>0 && <button onClick={onCart} style={{ position:'absolute', left:14, right:14, bottom:84, zIndex:20,
        border:'none', cursor:'pointer', fontFamily:'var(--font)', borderRadius:16, padding:'14px 16px',
        background:'var(--brand)', color:'#fff', display:'flex', alignItems:'center', gap:12, boxShadow:'0 6px 20px rgba(38,97,156,.38)' }}>
        <span style={{ background:'rgba(255,255,255,.24)', minWidth:26, height:26, borderRadius:999, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, padding:'0 7px' }}>{count}</span>
        <span style={{ flex:1, textAlign:'left', fontSize:15.5, fontWeight:800 }}>{TH?'ดูตะกร้า':'View cart'}</span>
        <span className="num" style={{ fontSize:16, fontWeight:800 }}>{money(total)}</span>
      </button>}

      {detail && <ItemDetail item={detail} hot={isHot(detail)} onClose={()=>setDetail(null)}
        onAdd={(qty,opts,add)=>{ addItem(detail.id, qty, opts, add); setDetail(null); }}/>}
    </div>
  );
}

Object.assign(window, { MarketShopMenu });
