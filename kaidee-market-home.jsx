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

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:'var(--bg,#F5F7F5)' }}>
      <div style={{ padding:'22px 18px 10px', background:'var(--hero,linear-gradient(152deg,#1F4F86,#26619C))', color:'#fff' }}>
        <div style={{ fontSize:20, fontWeight:800 }}>{directory ? (TH ? 'ร้านทั้งหมด' : 'All shops') : market}</div>
        <div style={{ fontSize:12.5, opacity:.9, marginTop:4 }}>
          {directory
            ? (TH ? 'รวมร้านจากทุกตลาดในแพลตฟอร์ม — แตะชื่อตลาดบนการ์ดเพื่อดูว่าร้านอยู่ที่ไหน' : 'Every shop across all markets — the tag on each card shows which market it’s in')
            : (TH ? 'เลือกร้าน แล้วสั่ง/จองล่วงหน้า มารับเองได้เลย' : 'Pick a shop to order ahead and pick up')}
        </div>
      </div>

      <div style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
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

        {err && (
          <div style={{ textAlign:'center', color:'var(--danger,#E0533D)', padding:'20px', fontSize:13.5 }}>
            {TH ? 'โหลดรายชื่อร้านไม่สำเร็จ ลองใหม่อีกครั้ง' : 'Failed to load shops — try again'}
          </div>
        )}

        {shops && shops.map(s => (
          <button key={s.id} onClick={() => openShop(s)} style={{
            display:'flex', alignItems:'center', gap:12, textAlign:'left', cursor:'pointer',
            background:'var(--card,#fff)', border:'1px solid var(--hair,#EAEFEA)', borderRadius:16,
            padding:'12px 14px', boxShadow:'0 1px 3px rgba(20,40,32,.06)',
          }}>
            <div style={{ width:52, height:52, borderRadius:14, background:'var(--brand-soft,#E9EFF5)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0, overflow:'hidden' }}>
              {s.logo ? <img src={s.logo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : (s.emoji || '🍽️')}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14.5, color:'var(--ink,#1B2420)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</div>
              <div style={{ fontSize:12, color:'var(--ink-3,#8A948E)', marginTop:2, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <span>{s.open}–{s.close}{s.cat ? ' · ' + s.cat : ''}</span>
                {directory && s.market && <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:999, background:'var(--accent-soft,#E6EFF9)', color:'var(--accent-ink,#1F5C99)' }}>📍{s.market}</span>}
              </div>
            </div>
            <div style={{
              fontSize:11.5, fontWeight:700, padding:'4px 10px', borderRadius:999, flexShrink:0,
              background: s.isOpen ? 'var(--brand-soft,#E9EFF5)' : '#F1F1F1',
              color: s.isOpen ? 'var(--brand-ink,#13304E)' : 'var(--ink-3,#8A948E)',
            }}>
              {s.isOpen ? (TH ? 'เปิดอยู่' : 'Open') : (TH ? 'ปิดแล้ว' : 'Closed')}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { MarketHome });
