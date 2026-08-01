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
    u.searchParams.delete('liff.state');
    location.href = u.toString();
  };

  // หมวดหมู่ที่มีจริงในร้านที่โหลดมา (แบบชิปกรองของ Grab/LINE MAN) — ไม่เดา ใช้ข้อมูลจริงเท่านั้น
  const cats = shops ? Array.from(new Set(shops.map(s => s.cat).filter(Boolean))) : [];
  const qlc = q.trim().toLowerCase();
  const filtered = shops ? shops.filter(s =>
    (cat === 'all' || s.cat === cat) &&
    (!qlc || (s.name || '').toLowerCase().includes(qlc) || (s.cat || '').toLowerCase().includes(qlc))
  ) : shops;

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:'var(--bg,#F5F7F5)' }}>
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
      </div>

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

        {filtered && filtered.map(s => (
          <button key={s.id} onClick={() => openShop(s)} style={{
            display:'flex', flexDirection:'column', textAlign:'left', cursor:'pointer', border:'none', padding:0,
            background:'var(--card,#fff)', borderRadius:18, overflow:'hidden',
            boxShadow:'0 2px 10px rgba(20,40,32,.08)', fontFamily:'inherit',
          }}>
            {/* cover — รูปร้านถ้ามี ไม่งั้นใช้พื้นไล่เฉดสีแบรนด์ + อีโมจิใหญ่ (แบบการ์ด Grab) */}
            <div style={{ width:'100%', height:104, position:'relative',
              background: s.logo ? undefined : 'linear-gradient(135deg,var(--brand-soft,#E9EFF5),var(--card,#fff))' }}>
              {s.logo ? <img src={s.logo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                      : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:40 }}>{s.emoji || '🍽️'}</div>}
              <div style={{
                position:'absolute', top:10, right:10, fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:999,
                background: s.isOpen ? 'rgba(255,255,255,.94)' : 'rgba(30,30,30,.7)',
                color: s.isOpen ? 'var(--brand-ink,#13304E)' : '#fff',
              }}>{s.isOpen ? (TH ? '🟢 เปิดอยู่' : '🟢 Open') : (TH ? 'ปิดแล้ว' : 'Closed')}</div>
              {directory && s.market && <div style={{ position:'absolute', bottom:10, left:10, fontSize:10.5, fontWeight:700, padding:'3px 9px', borderRadius:999,
                background:'rgba(255,255,255,.94)', color:'var(--accent-ink,#1F5C99)' }}>📍{s.market}</div>}
            </div>
            <div style={{ padding:'11px 14px 13px' }}>
              <div style={{ fontWeight:700, fontSize:15, color:'var(--ink,#1B2420)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</div>
              <div style={{ fontSize:12, color:'var(--ink-3,#8A948E)', marginTop:3 }}>{s.cat ? s.cat + ' · ' : ''}{s.open}–{s.close}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { MarketHome });
