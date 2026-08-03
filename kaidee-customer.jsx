// kaidee-customer.jsx — Customer LINE (LIFF) app: browse, cart, checkout, pre-order, tracking
const { useState:cState } = React;

/* LINE-style header */
function LineHeader({ title, onBack, right }){
  return (
    <div style={{ paddingTop:44, background:'#fff', borderBottom:'1px solid var(--hair)', position:'relative', zIndex:5 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', height:48 }}>
        {onBack ? <button onClick={onBack} style={hdBtn}>{React.cloneElement(IC.back,{size:24})}</button> : <div style={{width:34}}/>}
        <div style={{ flex:1, textAlign:'center', fontWeight:700, fontSize:16 }}>{title}</div>
        <div style={{ width:34, display:'flex', justifyContent:'flex-end' }}>{right}</div>
      </div>
    </div>
  );
}
const hdBtn={ border:'none', background:'none', cursor:'pointer', width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink)' };

/* ══════════════ MENU BROWSE ══════════════ */
function CustMenu({ menu, cart, addItem, shop={}, hotIds }){
  const { t, lang } = useT();
  const cats = useCats();
  const isHot=(m)=> !!(m && ((hotIds && hotIds.has && hotIds.has(m.id)) || m.hot));
  const [cat,setCat] = cState('savory');
  const [detail,setDetail] = cState(null);
  const cartCount = Object.values(cart).reduce((a,q)=>a+q,0);
  const name = shop.name||'ครัวขายดี';
  const hasCover = !!shop.cover;

  return (
    <div className="kd-screen" style={{ background:'#fff' }}>
      {/* LINE brand bar */}
      <div style={{ paddingTop:44, background:'var(--line-green)', color:'#fff', position:'relative', zIndex:5 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px' }}>
          <span style={{ fontSize:12, fontWeight:700, background:'rgba(255,255,255,.22)', padding:'3px 8px', borderRadius:6 }}>LINE</span>
          <span style={{ fontWeight:700, fontSize:15 }}>{name} · Official</span>
          <span style={{ marginLeft:'auto', fontSize:12, opacity:.9 }}>{React.cloneElement(IC.check,{size:13, style:{verticalAlign:'-2px'}})} {lang==='th'?'เพื่อน':'Friend'}</span>
        </div>
      </div>
      {/* shop hero */}
      <div style={{ position:'relative', height:120, flexShrink:0, display:'flex', alignItems:'flex-end', padding:14,
        background: hasCover?'#333':'linear-gradient(120deg,#F4E7D2,#F6DED4)',
        backgroundImage: hasCover?`url(${shop.cover})`:'none', backgroundSize:'cover', backgroundPosition:'center' }}>
        {hasCover
          ? <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,rgba(0,0,0,.04),rgba(0,0,0,.5))' }}/>
          : <div style={{ position:'absolute', inset:0, opacity:.35, backgroundImage:'repeating-linear-gradient(45deg,#0000,#0000 10px,rgba(255,255,255,.4) 10px,rgba(255,255,255,.4) 12px)' }}/>}
        <div style={{ position:'relative', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'#fff', boxShadow:'var(--shadow)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, overflow:'hidden',
            backgroundImage: shop.logo?`url(${shop.logo})`:'none', backgroundSize:'cover', backgroundPosition:'center' }}>{!shop.logo && (shop.emoji||'🍳')}</div>
          <div>
            <div style={{ fontWeight:700, fontSize:19, color: hasCover?'#fff':'var(--ink)' }}>{name}</div>
            <div style={{ fontSize:12.5, color: hasCover?'rgba(255,255,255,.92)':'var(--ink-2)', display:'flex', gap:8, marginTop:2, flexWrap:'wrap' }}>
              {/* ดาวจากรีวิวจริงเท่านั้น — ร้านที่ยังไม่มีรีวิวครบ 3 คนไม่โชว์ดาว ไม่ใช่ใส่ตัวเลขให้ทุกร้านเท่ากัน */}
              {shop.rating > 0 && <span>{React.cloneElement(IC.star,{size:13,color: hasCover?'#FFD166':'var(--accent)',fill: hasCover?'#FFD166':'var(--accent)',style:{verticalAlign:'-2px'}})} {shop.rating}{shop.reviewCount?` (${shop.reviewCount})`:''}</span>}
              <span>{shop.rating>0?'· ':''}{shop.open&&shop.close?`${shop.open}–${shop.close}`:(lang==='th'?'ส่ง 15–25 นาที':'15–25 min')}</span>
              <span style={{ color: hasCover?'#fff':((window.kdShopOpen?!window.kdShopOpen(shop):shop.isOpen===false)?'var(--ink-3)':'var(--brand-ink)'), fontWeight:700 }}>· {(window.kdShopOpen?!window.kdShopOpen(shop):shop.isOpen===false)?(lang==='th'?'ปิดอยู่':'Closed'):(lang==='th'?'เปิดอยู่':'Open')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* category chips */}
      <div className="kd-chiprow" style={{ padding:'12px 16px', flexShrink:0, borderBottom:'1px solid var(--hair)' }}>
        {cats.map(c=>{ const on=c.id===cat; return (
          <button key={c.id} onClick={()=>setCat(c.id)} className={'kd-chip-btn'+(on?' on':'')} style={{ background: on?'var(--brand)':'var(--bg)', boxShadow:'none' }}>
            <span>{c.emoji}</span>{c[lang]||c.th}</button>
        );})}
      </div>

      {/* list */}
      {(window.kdShopOpen?!window.kdShopOpen(shop):shop.isOpen===false) && <div style={{ margin:'10px 16px 0', flexShrink:0, background:'#FBEAD7', color:'#B26A00', borderRadius:12, padding:'11px 14px', fontSize:13, fontWeight:600, textAlign:'center' }}>{lang==='th'?'🔴 ร้านปิดรับออเดอร์ชั่วคราว — เปิดอีกครั้งเร็ว ๆ นี้':'🔴 Shop is closed — back soon'}</div>}
      <div className="kd-body" style={{ padding:'8px 16px 120px' }}>
        {menu.length===0 ? (
          <div style={{ textAlign:'center', padding:'64px 26px', color:'var(--ink-3)' }}>
            <div style={{ fontSize:44 }}>🍳</div>
            <div style={{ fontSize:16.5, fontWeight:700, color:'var(--ink)', marginTop:10 }}>{lang==='th'?'ร้านกำลังจัดเมนู':'Menu coming soon'}</div>
            <div style={{ fontSize:13, marginTop:6, lineHeight:1.5 }}>{lang==='th'?'เปิดขายเร็ว ๆ นี้ กลับมาดูใหม่นะคะ 🙏':'Opening soon — please check back 🙏'}</div>
          </div>
        ) : menu.filter(m=>m.cat===cat).map(m=>(
          <button key={m.id} onClick={()=>setDetail(m)} style={{ border:'none', background:'none', cursor:'pointer',
            width:'100%', display:'flex', gap:13, padding:'13px 0', borderBottom:'1px solid var(--hair)', textAlign:'left', fontFamily:'var(--font)' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                {m[lang]||m.th}{isHot(m) && <span style={{ fontSize:11 }}>🔥</span>}</div>
              <div className="num" style={{ fontSize:15, fontWeight:700, color:'var(--ink)', marginTop:5 }}>{money(m.price)}</div>
            </div>
            <div style={{ position:'relative' }}>
              <FoodTile item={m} size={78} radius={14}/>
              <div style={{ position:'absolute', bottom:-8, right:-8, width:30, height:30, borderRadius:999,
                background:'#fff', boxShadow:'var(--shadow)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--brand)' }}>{React.cloneElement(IC.plus,{size:18,stroke:2.4})}</div>
            </div>
          </button>
        ))}
      </div>

      {detail && <ItemDetail item={detail} hot={isHot(detail)} onClose={()=>setDetail(null)} onAdd={(q,opts,add)=>{ addItem(detail.id,q,opts,add); setDetail(null); }}/>}
    </div>
  );
}

function ItemDetail({ item, onClose, onAdd, hot }){
  const { t, lang } = useT();
  const TH = lang==='th';
  const [q,setQ] = cState(1);
  const groups = item.options||[];
  // sel[gid] = index (single) หรือ array ของ index (multi)
  const [sel,setSel] = cState(()=>{ const s={}; groups.forEach(g=>{ s[g.id]= g.multi?[]:(g.choices.length?0:null); }); return s; });
  const pick = (g, ci)=> setSel(prev=>{ const n={...prev}; if(g.multi){ const arr=new Set(n[g.id]||[]); arr.has(ci)?arr.delete(ci):arr.add(ci); n[g.id]=[...arr]; } else { n[g.id]=ci; } return n; });
  // สรุปตัวเลือก + ราคาเพิ่ม
  const chosen = [];
  groups.forEach(g=>{ const v=sel[g.id]; if(g.multi){ (v||[]).forEach(ci=>{ const c=g.choices[ci]; if(c) chosen.push({ g:g.name, label:c.label, price:c.price||0 }); }); }
    else if(v!=null){ const c=g.choices[v]; if(c) chosen.push({ g:g.name, label:c.label, price:c.price||0 }); } });
  const add = chosen.reduce((a,c)=>a+(c.price||0),0);
  const unit = (item.price||0)+add;
  return (
    <Sheet open={true} onClose={onClose} height="86%">
      <div style={{ padding:'0 16px', overflowY:'auto', flex:1 }}>
        <div style={{ margin:'4px 0 16px' }}><FoodTile item={item} size={'100%'} radius={20}/></div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:20, fontWeight:700, flex:1 }}>{item[lang]||item.th}</div>
          {(hot||item.hot) && <span className="kd-chip" style={{ background:'var(--accent-soft)', color:'var(--accent-ink)' }}>🔥 {lang==='th'?'ขายดี':'Popular'}</span>}
        </div>
        <div className="num" style={{ fontSize:22, fontWeight:700, color:'var(--brand-ink)', margin:'8px 0' }}>{money(item.price)}</div>
        <p style={{ fontSize:14, color:'var(--ink-2)', lineHeight:1.6 }}>
          {lang==='th'?'ปรุงสดใหม่ทุกจาน วัตถุดิบคัดคุณภาพ อร่อยได้ทุกวัน':'Freshly cooked to order with quality ingredients.'}</p>
        {/* option groups */}
        {groups.map(g=>{ const v=sel[g.id]; return (
          <div key={g.id} style={{ marginTop:18 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:7, marginBottom:9 }}>
              <div style={{ fontSize:15, fontWeight:700 }}>{g.name}</div>
              <div style={{ fontSize:12, color:'var(--ink-3)' }}>{g.multi?(TH?'เลือกได้หลาย':'choose any'):(TH?'เลือก 1':'choose one')}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {g.choices.map((c,ci)=>{ const on = g.multi ? (v||[]).includes(ci) : v===ci; return (
                <button key={ci} onClick={()=>pick(g,ci)} className="kd-card" style={{ border: on?'2px solid var(--brand)':'2px solid transparent', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:11, padding:'11px 14px', fontFamily:'var(--font)', textAlign:'left' }}>
                  <span style={{ width:22, height:22, borderRadius: g.multi?6:999, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                    background:on?'var(--brand)':'#fff', border:on?'none':'2px solid var(--hair-2)', color:'#fff' }}>{on&&React.cloneElement(IC.check,{size:14,stroke:3})}</span>
                  <span style={{ flex:1, fontSize:14.5, fontWeight:600 }}>{c.label}</span>
                  {c.price>0 && <span className="num" style={{ fontSize:13.5, color:'var(--ink-3)', fontWeight:600 }}>+{money(c.price)}</span>}
                </button>
              );})}
            </div>
          </div>
        );})}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:4, background:'var(--bg)', borderRadius:999, padding:5 }}>
          <button onClick={()=>setQ(Math.max(1,q-1))} style={{ ...sqBtn, width:34, height:34 }}>{React.cloneElement(IC.minus,{size:18})}</button>
          <span className="num" style={{ width:30, textAlign:'center', fontWeight:700, fontSize:17 }}>{q}</span>
          <button onClick={()=>setQ(q+1)} style={{ ...sqBtn, width:34, height:34 }}>{React.cloneElement(IC.plus,{size:18})}</button>
        </div>
        <button onClick={()=>onAdd(q, chosen, add)} className="kd-btn kd-btn-primary" style={{ flex:1, padding:15, justifyContent:'space-between' }}>
          <span>{t('addToCart')}</span><span className="num">{money(unit*q)}</span></button>
      </div>
    </Sheet>
  );
}

Object.assign(window, { LineHeader, CustMenu, ItemDetail });
