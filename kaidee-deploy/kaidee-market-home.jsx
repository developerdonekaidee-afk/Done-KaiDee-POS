// kaidee-market-home.jsx — หน้า "ร้านในตลาดนี้" ฝั่งลูกค้า · เปิดผ่านลิงก์/QR เฉพาะของตลาด ?role=market&market=<ชื่อตลาด>
// ไม่ใช่มาร์เก็ตเพลสรวมทั้งเมืองแบบ Grab — จำกัดแค่ร้านที่ตั้ง market เดียวกันไว้ (ผ่าน PATCH /shops/:id {market})
// กดร้านไหน → navigate เต็มหน้าเข้าโฟลว์สั่งอาหารเดิม (CustomerApp) ของร้านนั้น ไม่ผสม state ข้ามร้าน
const { useState:mhState, useEffect:mhEffect } = React;

function _mhMarketParam(){
  try{
    const u = new URL(location.href);
    const dig = (sp) => { let v = sp.get('market'); if(v) return v;
      const st = sp.get('liff.state'); if(st){ try{ return new URLSearchParams(st.replace(/^[/?]+/,'')).get('market'); }catch(e){ return null; } }
      return null; };
    return dig(u.searchParams);
  }catch(e){ return null; }
}

function MarketHome({ store }){
  const lang = (store && store.lang) || 'th';
  const TH = lang !== 'en';
  const market = _mhMarketParam();
  const directory = !market;   // ไม่ระบุ market → โหมด "ร้านทั้งหมด" รวมทุกตลาดฟีดเดียว (แบบ Grab) แทนที่จะขึ้น error
  const [shops, setShops] = mhState(null);   // null = กำลังโหลด · [] = โหลดเสร็จไม่มีร้าน
  const [err, setErr] = mhState(false);
  const [q, setQ] = mhState('');           // ค้นหาชื่อร้าน/ประเภท
  const [cat, setCat] = mhState('all');    // กรองตามหมวด (ชิปด้านบน แบบ Grab/LINE MAN)
  const [loc, setLoc] = mhState(()=>custLoc());   // ตำแหน่งลูกค้า → ระยะทาง/ค่าส่ง/เวลาบนการ์ด
  const [locBusy, setLocBusy] = mhState(false);
  const [locOpen, setLocOpen] = mhState(false);
  const [sort, setSort] = mhState(()=> custLoc() ? 'near' : 'open');   // near | open | promo
  const [tab, setTab] = mhState('shops');   // shops | orders
  const [favs, setFavs] = mhState(()=>favShops());
  const [favOnly, setFavOnly] = mhState(false);

  const useGps = async ()=>{
    setLocBusy(true);
    const p = await kdAskLoc();
    setLocBusy(false);
    if(!p){ alert(TH?'ขอตำแหน่งไม่สำเร็จ — เปิดสิทธิ์ตำแหน่งให้เบราว์เซอร์ก่อน แล้วลองใหม่':'Could not get your location'); return; }
    const v = { ...p, label: TH?'ตำแหน่งปัจจุบัน':'Current location' };
    setLoc(v); setCustLoc(v); setSort('near'); setLocOpen(false);
  };

  mhEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = directory
          ? ((window.KD_API && window.KD_API.getShopsDirectory) ? await window.KD_API.getShopsDirectory() : [])
          : ((window.KD_API && window.KD_API.getShopsByMarket) ? await window.KD_API.getShopsByMarket(market) : []);
        if (alive) setShops(Array.isArray(list) ? list : []);
      } catch (e) { if (alive) { setErr(true); setShops([]); } }
    })();
    return () => { alive = false; };
  }, [market]);

  const openShop = (s) => {
    const u = new URL(location.href);
    u.searchParams.set('shop', s.id);
    u.searchParams.set('role', 'customer');
    u.searchParams.set('via', 'market');   // → เห็นเฉพาะเมนู/ราคาที่ร้านเปิดขายบนแพลตฟอร์ม
    u.searchParams.delete('liff.state');
    location.href = u.toString();
  };

  // หมวดหมู่ที่มีจริงในร้านที่โหลดมา (แบบชิปกรองของ Grab/LINE MAN) — ไม่เดา ใช้ข้อมูลจริงเท่านั้น
  const cats = shops ? Array.from(new Set(shops.map(s => s.cat).filter(Boolean))) : [];
  const qlc = q.trim().toLowerCase();
  // ติดระยะทาง/เวลา/ค่าส่งให้ทุกร้านก่อน แล้วค่อยกรอง/เรียง — ร้านที่ไม่ได้ปักหมุดไว้จะไม่มีระยะ (null)
  const withDist = shops ? shops.map(s=>{
    const km = (loc && s.lat!=null) ? kdDistKm(loc, { lat:+s.lat, lng:+s.lng }) : null;
    return { ...s, _km: km, _eta: kdEtaMin(km), _fee: km!=null ? deliveryFee(s, Math.round(km*10)/10) : null };
  }) : shops;
  const openScore = (s)=> ((window.kdShopOpen ? window.kdShopOpen(s) : s.isOpen!==false) && s.marketOpen!==false) ? 0 : 1;
  const filtered = withDist ? withDist.filter(s =>
    (!favOnly || favs.includes(s.id)) &&
    (cat === 'all' || s.cat === cat) &&
    (!qlc || (s.name || '').toLowerCase().includes(qlc) || (s.cat || '').toLowerCase().includes(qlc))
  ).sort((a,b)=>{
    if(sort==='promo'){ const d=(b.promo?1:0)-(a.promo?1:0); if(d) return d; }
    if(sort==='near' && loc){
      // ร้านที่ไม่รู้พิกัดไปท้ายสุดเสมอ ไม่ใช่ถือว่าอยู่ใกล้
      if(a._km==null && b._km!=null) return 1;
      if(b._km==null && a._km!=null) return -1;
      if(a._km!=null && b._km!=null && a._km!==b._km) return a._km-b._km;
    }
    return openScore(a)-openScore(b) || (a.name||'').localeCompare(b.name||'','th');
  }) : withDist;

  const navBtn = (k, icon, label)=>{
    const on = tab===k;
    return (
      <button key={k} onClick={()=>setTab(k)} style={{ flex:1, border:'none', background:'none', cursor:'pointer', fontFamily:'inherit',
        padding:'8px 0 4px', display:'flex', flexDirection:'column', alignItems:'center', gap:3,
        color: on?'var(--brand,#26619C)':'var(--ink-3,#8A948E)' }}>
        <span style={{ fontSize:19, lineHeight:1 }}>{icon}</span>
        <span style={{ fontSize:11, fontWeight:on?800:600 }}>{label}</span>
      </button>
    );
  };
  const bottomNav = (
    <div style={{ position:'fixed', left:0, right:0, bottom:0, zIndex:40, display:'flex',
      background:'#fff', borderTop:'1px solid var(--hair,#E6EAE7)',
      padding:'2px 8px calc(4px + env(safe-area-inset-bottom))' }}>
      {navBtn('shops', '🏪', TH?'ร้านค้า':'Shops')}
      {navBtn('orders', '🧾', TH?'ออเดอร์ของฉัน':'My orders')}
    </div>
  );

  if (tab === 'orders') return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:'var(--bg,#F5F7F5)', paddingBottom:78 }}>
      <MyOrders TH={TH}/>
      {bottomNav}
    </div>
  );

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:'var(--bg,#F5F7F5)', paddingBottom:78 }}>
      <div style={{ padding:'22px 18px 18px', background:'var(--hero,linear-gradient(152deg,#1F4F86,#26619C))', color:'#fff', borderRadius:'0 0 22px 22px' }}>
        <div style={{ fontSize:20, fontWeight:800 }}>{directory ? (TH ? 'ร้านทั้งหมด' : 'All shops') : market}</div>
        <div style={{ fontSize:12.5, opacity:.9, marginTop:4, marginBottom:14 }}>
          {directory
            ? (TH ? 'รวมร้านจากทุกตลาดในแพลตฟอร์ม — แท็กบนการ์ดบอกว่าร้านอยู่ตลาดไหน' : 'Every shop across all markets — the tag on each card shows which market it’s in')
            : (TH ? 'เลือกร้าน แล้วสั่ง/จองล่วงหน้า มารับเองได้เลย' : 'Pick a shop to order ahead and pick up')}
        </div>
        {/* search — แบบ Grab/LINE MAN */}
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', borderRadius:14, padding:'11px 14px', boxShadow:'0 4px 14px rgba(0,0,0,.12)' }}>
          <span style={{ fontSize:16, opacity:.5 }}>🔍</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder={TH?'ค้นหาร้านหรือประเภทอาหาร':'Search shop or cuisine'}
            style={{ flex:1, border:'none', outline:'none', fontSize:14, fontFamily:'inherit', color:'var(--ink,#1B2420)' }}/>
          {q && <span onClick={()=>setQ('')} style={{ cursor:'pointer', color:'var(--ink-3,#8A948E)', fontSize:13 }}>✕</span>}
        </div>
        {/* แถบตำแหน่ง — ปักหมุดแล้วการ์ดร้านจะบอกระยะทาง เวลาโดยประมาณ และค่าส่ง */}
        <button onClick={()=>setLocOpen(true)} style={{ marginTop:10, width:'100%', display:'flex', alignItems:'center', gap:8,
          border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left', color:'#fff',
          background:'rgba(255,255,255,.16)', borderRadius:12, padding:'10px 13px' }}>
          <span style={{ fontSize:15 }}>📍</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10.5, opacity:.85, fontWeight:700 }}>{TH?'ส่งไปที่':'Deliver to'}</div>
            <div style={{ fontSize:13.5, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {loc ? (loc.label || (TH?'ตำแหน่งที่ปักไว้':'Pinned location')) : (TH?'ยังไม่ได้บอกตำแหน่ง — แตะเพื่อดูร้านใกล้คุณ':'Tap to see shops near you')}</div>
          </div>
          <span style={{ fontSize:12, opacity:.8 }}>{TH?'เปลี่ยน':'Change'}</span>
        </button>
      </div>

      {locOpen && <div onClick={()=>setLocOpen(false)} style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(10,20,15,.5)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
        <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', width:'100%', maxWidth:440, borderRadius:'20px 20px 0 0', padding:'20px 20px calc(20px + env(safe-area-inset-bottom))' }}>
          <div style={{ fontSize:18, fontWeight:800, marginBottom:5 }}>{TH?'ส่งไปที่ไหน':'Where to?'}</div>
          <div style={{ fontSize:12.5, color:'var(--ink-3,#8A948E)', lineHeight:1.55, marginBottom:16 }}>
            {TH?'บอกตำแหน่งแล้วจะเห็นระยะทาง ค่าส่ง และเวลาโดยประมาณของแต่ละร้าน · เก็บไว้ในเครื่องคุณเท่านั้น'
               :'We’ll show distance, delivery fee and ETA per shop. Kept on your device only.'}</div>
          <button onClick={useGps} disabled={locBusy} style={{ width:'100%', border:'none', cursor:'pointer', fontFamily:'inherit',
            background:'var(--brand,#26619C)', color:'#fff', borderRadius:14, padding:'14px', fontSize:15, fontWeight:700, opacity:locBusy?.6:1 }}>
            {locBusy ? (TH?'กำลังหาตำแหน่ง…':'Locating…') : (TH?'📍 ใช้ตำแหน่งปัจจุบัน':'📍 Use current location')}</button>
          {loc && <button onClick={()=>{ setLoc(null); setCustLoc(null); setSort('open'); setLocOpen(false); }}
            style={{ width:'100%', marginTop:9, border:'none', cursor:'pointer', fontFamily:'inherit',
              background:'var(--bg,#F5F7F5)', color:'var(--ink-2,#57635C)', borderRadius:14, padding:'13px', fontSize:14, fontWeight:700 }}>
            {TH?'ล้างตำแหน่งที่บันทึกไว้':'Clear saved location'}</button>}
        </div>
      </div>}

      {/* เรียงลำดับ — "ใกล้ฉัน" ใช้ได้ต่อเมื่อบอกตำแหน่งแล้ว */}
      {shops && shops.length > 1 && (
        <div style={{ display:'flex', gap:8, overflowX:'auto', padding:'14px 16px 0', scrollbarWidth:'none' }}>
          {[['near', TH?'ใกล้ฉัน':'Nearest'], ['open', TH?'เปิดอยู่ก่อน':'Open first'], ['promo', TH?'มีโปร':'Deals']].map(([k,l])=>{
            const on = sort===k, off = k==='near' && !loc;
            return <button key={k} onClick={()=>{ if(off) return setLocOpen(true); setSort(k); }} style={{
              flexShrink:0, border:'none', cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit',
              padding:'7px 14px', borderRadius:999, fontWeight:700, fontSize:12.5,
              background: on ? 'var(--ink,#1B2420)' : 'var(--card,#fff)',
              color: on ? '#fff' : (off ? 'var(--ink-3,#8A948E)' : 'var(--ink-2,#57635C)'),
              boxShadow: on ? 'none' : '0 1px 3px rgba(20,40,32,.08)',
            }}>{k==='near' && !loc ? '📍 ' : ''}{l}</button>;
          })}
          {favs.length > 0 && <button onClick={()=>setFavOnly(v=>!v)} style={{
            flexShrink:0, border:'none', cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit',
            padding:'7px 14px', borderRadius:999, fontWeight:700, fontSize:12.5,
            background: favOnly ? 'var(--ink,#1B2420)' : 'var(--card,#fff)',
            color: favOnly ? '#fff' : 'var(--ink-2,#57635C)',
            boxShadow: favOnly ? 'none' : '0 1px 3px rgba(20,40,32,.08)',
          }}>❤️ {TH?'ร้านโปรด':'Favourites'} {favs.length}</button>}
        </div>
      )}
      {favOnly && filtered && filtered.length===0 && <div style={{ textAlign:'center', color:'var(--ink-3,#8A948E)', padding:'30px 20px 0', fontSize:13 }}>
        {TH?'ร้านโปรดของคุณไม่มีร้านไหนตรงกับตัวกรองที่เลือกอยู่':'No favourites match the current filters'}</div>}

      {/* category chips */}
      {cats.length > 0 && (
        <div style={{ display:'flex', gap:8, overflowX:'auto', padding:'14px 16px 2px', scrollbarWidth:'none' }}>
          {['all', ...cats].map(c => {
            const on = c === cat;
            return (
              <button key={c} onClick={() => setCat(c)} style={{
                flexShrink:0, border:'none', cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit',
                padding:'8px 15px', borderRadius:999, fontWeight:700, fontSize:13,
                background: on ? 'var(--brand,#26619C)' : 'var(--card,#fff)',
                color: on ? '#fff' : 'var(--ink-2,#57635C)',
                boxShadow: on ? 'none' : '0 1px 3px rgba(20,40,32,.08)',
              }}>{c === 'all' ? (TH ? 'ทั้งหมด' : 'All') : c}</button>
            );
          })}
        </div>
      )}

      <div style={{ padding:16, display:'flex', flexDirection:'column', gap:12 }}>
        {shops === null && (
          <div style={{ textAlign:'center', color:'var(--ink-3,#8A948E)', padding:'40px 20px', fontSize:13.5 }}>
            {TH ? 'กำลังโหลดร้านค้า…' : 'Loading shops…'}
          </div>
        )}

        {shops && shops.length === 0 && !err && (
          <div style={{ textAlign:'center', color:'var(--ink-3,#8A948E)', padding:'40px 20px', fontSize:13.5 }}>
            {directory
              ? (TH ? 'ยังไม่มีร้านเปิดในแพลตฟอร์ม' : 'No shops yet')
              : (TH ? `ยังไม่มีร้านในตลาด "${market}"` : `No shops in "${market}" yet`)}
          </div>
        )}

        {shops && shops.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign:'center', color:'var(--ink-3,#8A948E)', padding:'40px 20px', fontSize:13.5 }}>
            {TH ? `ไม่พบร้านที่ตรงกับ "${q}"` : `No shops matching "${q}"`}
          </div>
        )}

        {err && (
          <div style={{ textAlign:'center', color:'var(--danger,#E0533D)', padding:'20px', fontSize:13.5 }}>
            {TH ? 'โหลดรายชื่อร้านไม่สำเร็จ ลองใหม่อีกครั้ง' : 'Failed to load shops — try again'}
          </div>
        )}

        {filtered && cat === 'all' && !q && cats.length > 1 ? (
          // จัดเป็นหมวดหมู่ (แบบ Grab/LINE MAN) — เฉพาะตอนไม่ได้ค้นหา/กรองอยู่ ไม่งั้นแสดงลิสต์แบบเรียบ
          cats.map(c => {
            const inCat = filtered.filter(s => s.cat === c);
            if (!inCat.length) return null;
            return (
              <div key={c} style={{ marginBottom:4 }}>
                <div style={{ fontWeight:800, fontSize:15.5, color:'var(--ink,#1B2420)', margin:'2px 0 10px' }}>{c}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {inCat.map(s => <ShopCard key={s.id} s={s} directory={directory} TH={TH} onOpen={openShop} fav={favs.includes(s.id)} onFav={()=>setFavs(toggleFav(s.id))}/>)}
                </div>
              </div>
            );
          })
        ) : (filtered && filtered.map(s => <ShopCard key={s.id} s={s} directory={directory} TH={TH} onOpen={openShop} fav={favs.includes(s.id)} onFav={()=>setFavs(toggleFav(s.id))}/>))}
      </div>
      {bottomNav}
    </div>
  );
}

/* ── ออเดอร์ของฉัน (รวมทุกร้าน) ──────────────────────────────────
   ค้นด้วย LINE userId เท่านั้น — คนที่สั่งแบบไม่ล็อกอินจะไม่มีอะไรให้ดูตรงนี้
   ต้องบอกเขาตรง ๆ ไม่ใช่โชว์หน้าว่างแล้วปล่อยให้งง                    */
const MO_STATUS = {
  new:        { th:'ร้านรับออเดอร์แล้ว', en:'Accepted',  c:'#2E6FB0' },
  cooking:    { th:'กำลังทำ',            en:'Cooking',   c:'#B4531A' },
  ready:      { th:'พร้อมรับ/พร้อมส่ง',  en:'Ready',     c:'#12945C' },
  delivering: { th:'ไรเดอร์กำลังไปส่ง',  en:'On the way',c:'#B4531A' },
  done:       { th:'เสร็จแล้ว',          en:'Completed', c:'#57635C' },
  cancelled:  { th:'ยกเลิกแล้ว',         en:'Cancelled', c:'#C0392B' },
  rejected:   { th:'ร้านปฏิเสธ',         en:'Rejected',  c:'#C0392B' },
};
function MyOrders({ TH }){
  const lu = (typeof window!=='undefined' && window.__lineUser) || null;
  const [list, setList] = mhState(null);
  const [err, setErr] = mhState(false);
  mhEffect(()=>{
    if(!lu || !lu.userId){ setList([]); return; }
    let alive = true;
    (async()=>{
      try{ const r = await window.KD_API.myOrders(lu.userId); if(alive) setList(Array.isArray(r)?r:[]); }
      catch(e){ if(alive){ setErr(true); setList([]); } }
    })();
    return ()=>{ alive = false; };
  }, [lu && lu.userId]);

  const openShop = (o)=>{ try{
    const u = new URL(location.href);
    ['market'].forEach(k=>u.searchParams.delete(k));
    u.searchParams.set('shop', o.shopId);
    u.searchParams.set('role', 'customer');
    u.searchParams.set('via', 'market');
    location.href = u.toString();
  }catch(e){} };

  const live = (list||[]).filter(o=>!['done','cancelled','rejected','void'].includes(o.status));
  const past = (list||[]).filter(o=>['done','cancelled','rejected','void'].includes(o.status));

  const card = (o)=>{
    const st = MO_STATUS[o.status] || { th:o.status, en:o.status, c:'var(--ink-3,#8A948E)' };
    const when = o.createdAt ? new Date(o.createdAt).toLocaleString('th-TH',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
    return (
      <button key={o.shopId+'/'+o.id} onClick={()=>openShop(o)} style={{ width:'100%', textAlign:'left', border:'none', cursor:'pointer',
        fontFamily:'inherit', background:'var(--card,#fff)', borderRadius:16, padding:'13px 15px', marginBottom:10,
        boxShadow:'0 1px 6px rgba(20,40,32,.07)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <span style={{ fontSize:20 }}>{o.shopEmoji || '🍽️'}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14.5, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{o.shopName}</div>
            <div style={{ fontSize:11.5, color:'var(--ink-3,#8A948E)', marginTop:2 }}>#{o.no} · {when}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div className="num" style={{ fontSize:15, fontWeight:800 }}>{money(o.total)}</div>
            <div style={{ fontSize:11, fontWeight:800, color:st.c, marginTop:2 }}>{TH?st.th:st.en}</div>
          </div>
        </div>
        {(o.promoDisc>0 || o.promoFeeDisc>0) && <div style={{ fontSize:11.5, color:'#B4531A', fontWeight:700, marginTop:7 }}>
          🎟️ {o.promoName || (TH?'ใช้ส่วนลด':'Discount')} · {TH?'ประหยัด':'saved'} {money((o.promoDisc|0)+(o.promoFeeDisc|0))}</div>}
      </button>
    );
  };

  return (
    <div>
      <div style={{ padding:'22px 18px 18px', background:'var(--hero,linear-gradient(152deg,#1F4F86,#26619C))', color:'#fff', borderRadius:'0 0 22px 22px' }}>
        <div style={{ fontSize:20, fontWeight:800 }}>{TH?'ออเดอร์ของฉัน':'My orders'}</div>
        <div style={{ fontSize:12.5, opacity:.9, marginTop:4 }}>{TH?'ทุกร้านที่คุณเคยสั่ง รวมไว้ที่เดียว':'Every shop you have ordered from'}</div>
      </div>
      <div style={{ padding:16 }}>
        {!lu && <div style={{ textAlign:'center', color:'var(--ink-3,#8A948E)', padding:'40px 24px', fontSize:13.5, lineHeight:1.7 }}>
          <div style={{ fontSize:38, marginBottom:10 }}>🧾</div>
          <div style={{ fontWeight:700, color:'var(--ink,#1B2420)', fontSize:15, marginBottom:6 }}>{TH?'ยังดูออเดอร์รวมไม่ได้':'Sign in with LINE to see this'}</div>
          {TH?'หน้านี้รวมออเดอร์จากทุกร้านให้ ต้องเปิดแอปผ่าน LINE ถึงจะรู้ว่าออเดอร์ไหนเป็นของคุณ · ถ้าสั่งแบบไม่ล็อกอิน ให้กดติดตามจากในหน้าร้านที่สั่งแทน'
             :'Open via LINE so we can tell which orders are yours.'}
        </div>}
        {lu && list===null && <div style={{ textAlign:'center', color:'var(--ink-3,#8A948E)', padding:'40px 20px', fontSize:13.5 }}>{TH?'กำลังโหลด…':'Loading…'}</div>}
        {err && <div style={{ textAlign:'center', color:'var(--danger,#E0533D)', padding:'20px', fontSize:13.5 }}>{TH?'โหลดออเดอร์ไม่สำเร็จ ลองใหม่อีกครั้ง':'Could not load orders'}</div>}
        {lu && list && list.length===0 && !err && <div style={{ textAlign:'center', color:'var(--ink-3,#8A948E)', padding:'40px 20px', fontSize:13.5, lineHeight:1.7 }}>
          <div style={{ fontSize:38, marginBottom:10 }}>🍽️</div>{TH?'ยังไม่เคยสั่งอะไรเลย — เลือกร้านจากแท็บ "ร้านค้า" ได้เลย':'No orders yet'}</div>}
        {!!live.length && <>
          <div style={{ fontSize:12.5, fontWeight:800, color:'var(--ink-2,#57635C)', margin:'2px 2px 9px' }}>{TH?'กำลังดำเนินการ':'In progress'}</div>
          {live.map(card)}
        </>}
        {!!past.length && <>
          <div style={{ fontSize:12.5, fontWeight:800, color:'var(--ink-2,#57635C)', margin:'16px 2px 9px' }}>{TH?'ที่ผ่านมา':'Past orders'}</div>
          {past.map(card)}
        </>}
      </div>
    </div>
  );
}

function ShopCard({ s, directory, TH, onOpen, fav, onFav }){
  return (
    <button onClick={() => onOpen(s)} style={{
      position:'relative',
      display:'flex', flexDirection:'column', textAlign:'left', cursor:'pointer', border:'none', padding:0,
      background:'var(--card,#fff)', borderRadius:18, overflow:'hidden',
      boxShadow:'0 2px 10px rgba(20,40,32,.08)', fontFamily:'inherit',
    }}>
      {/* cover — รูปร้านถ้ามี ไม่งั้นใช้พื้นไล่เฉดสีแบรนด์ + อีโมจิใหญ่ (แบบการ์ด Grab) */}
      <div style={{ width:'100%', height:104, position:'relative',
        background: s.logo ? undefined : 'linear-gradient(135deg,var(--brand-soft,#E9EFF5),var(--card,#fff))' }}>
        {s.logo ? <img src={s.logo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:40 }}>{s.emoji || '🍽️'}</div>}
        {/* ร้านกดปิดรับออเดอร์แพลตฟอร์มไว้ = ปิดสำหรับหน้านี้ แม้หน้าร้านจะยังเปิดขายอยู่ */}
        {(()=>{ const paused = s.marketOpen===false; const openNow = s.isOpen && !paused;
          return <div style={{
            position:'absolute', top:10, right:10, fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:999,
            background: openNow ? 'rgba(255,255,255,.94)' : 'rgba(30,30,30,.7)',
            color: openNow ? 'var(--brand-ink,#13304E)' : '#fff',
          }}>{openNow ? (TH ? '🟢 เปิดอยู่' : '🟢 Open') : paused ? (TH ? '⏸️ พักรับออเดอร์' : 'Paused') : (TH ? 'ปิดแล้ว' : 'Closed')}</div>;
        })()}
        {directory && s.market && <div style={{ position:'absolute', bottom:10, left:10, fontSize:10.5, fontWeight:700, padding:'3px 9px', borderRadius:999,
          background:'rgba(255,255,255,.94)', color:'var(--accent-ink,#1F5C99)' }}>📍{s.market}</div>}
        {/* ป้ายโปร — มุมซ้ายบน สีส้มแยกจากป้ายสถานะ ให้เห็นก่อนอ่านชื่อร้าน */}
        {s.promo && <div style={{ position:'absolute', top:10, left:10, display:'flex', alignItems:'center', gap:4,
          fontSize:11, fontWeight:800, padding:'4px 9px', borderRadius:999, background:'#E8590C', color:'#fff',
          boxShadow:'0 2px 6px rgba(232,89,12,.35)' }}>
          <span style={{ fontSize:10 }}>🎟️</span>{promoText(s.promo, TH)}
        </div>}
      </div>
      {/* หัวใจ — วางคร่อมขอบรูปกับเนื้อการ์ด ไม่ทับป้ายสถานะหรือป้ายโปร */}
      <span role="button" tabIndex={0} aria-label={fav?(TH?'เอาออกจากร้านโปรด':'Remove from favourites'):(TH?'เพิ่มเป็นร้านโปรด':'Add to favourites')}
        onClick={e=>{ e.stopPropagation(); onFav && onFav(); }}
        onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.stopPropagation(); e.preventDefault(); onFav && onFav(); } }}
        style={{ position:'absolute', top:88, right:12, width:34, height:34, borderRadius:999, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
          background:'#fff', boxShadow:'0 2px 8px rgba(20,40,32,.18)' }}>
        {fav ? '❤️' : '🤍'}
      </span>
      <div style={{ padding:'11px 14px 13px' }}>
        <div style={{ fontWeight:700, fontSize:15, color:'var(--ink,#1B2420)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', paddingRight:30 }}>{s.name}</div>
        <div style={{ fontSize:12, color:'var(--ink-3,#8A948E)', marginTop:3 }}>{s.cat ? s.cat + ' · ' : ''}{s.open}–{s.close}</div>
        {/* ระยะทาง/เวลา/ค่าส่ง — ขึ้นเมื่อลูกค้าบอกตำแหน่งแล้วและร้านปักหมุดไว้ */}
        {s._km != null && <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:5, fontSize:11.5, color:'var(--ink-2,#57635C)', fontWeight:600 }}>
          <span>{s._km < 1 ? `${Math.round(s._km*1000)} ม.` : `${s._km.toFixed(1)} กม.`}</span>
          <span style={{ opacity:.4 }}>·</span>
          <span>~{s._eta} {TH?'นาที':'min'}</span>
          {s._fee != null && <>
            <span style={{ opacity:.4 }}>·</span>
            <span>{customerPaysDelivery(s) ? (TH?`ค่าส่ง ${money(s._fee)}`:`${money(s._fee)} delivery`) : (TH?'ร้านออกค่าส่งให้':'Free delivery')}</span>
          </>}
        </div>}
        {/* ป้ายมุมบนบอกว่าลดเท่าไหร่แล้ว บรรทัดนี้จึงบอกแค่ชื่อโปร — ไม่ทวนเงื่อนไขซ้ำให้รก */}
        {s.promo && <div style={{ fontSize:11.5, color:'#B4531A', fontWeight:700, marginTop:4,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {s.promo.name}{s.promoCount > 1 && (TH ? ` +อีก ${s.promoCount - 1}` : ` +${s.promoCount - 1} more`)}
        </div>}
      </div>
    </button>
  );
}

Object.assign(window, { MarketHome });
