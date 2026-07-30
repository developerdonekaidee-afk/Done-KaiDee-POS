// kaidee-home.jsx — Merchant "จัดการร้าน" home dashboard (first tab), styled like CRM Home
const { useState:hState } = React;

const LIFF_ID = '2010720123-HXe3iZJD';
const OA_LINK = 'https://line.me/R/ti/p/@188dfiog';

const SUB_PLAN_LABEL = {
  trial:{th:'ทดลองใช้',en:'Trial'}, monthly:{th:'รายเดือน',en:'Monthly'},
  yearly:{th:'รายปี',en:'Yearly'}, paid:{th:'จ่ายแล้ว',en:'Paid'},
};

/* ── QR sheet — โชว์ QR ของลิงก์ + แชร์รูป/บันทึก ── */
function QrSheet({ row, shopName, lang, onClose }){
  const TH = lang!=='en';
  const box = React.useRef(null);
  const [dataUrl,setDataUrl] = hState('');
  const [copied,setCopied] = hState(false);
  React.useEffect(()=>{
    if(!box.current || typeof window==='undefined' || !window.QRCode) return;
    box.current.innerHTML='';
    try{ new window.QRCode(box.current, { text:row.url, width:236, height:236, colorDark:'#0B3B2E', colorLight:'#ffffff', correctLevel:window.QRCode.CorrectLevel.M }); }catch(e){}
    const tid = setTimeout(()=>{ const cv=box.current&&box.current.querySelector('canvas'); const im=box.current&&box.current.querySelector('img');
      let u=''; try{ u = cv?cv.toDataURL('image/png'):(im?im.src:''); }catch(e){ u = im?im.src:''; } setDataUrl(u); }, 140);
    return ()=>clearTimeout(tid);
  },[row.url]);
  const toBlob = ()=>{ try{ const b64=dataUrl.split(',')[1]; const bin=atob(b64); const arr=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i); return new Blob([arr],{type:'image/png'}); }catch(e){ return null; } };
  const shareImg = async ()=>{
    try{
      const blob = dataUrl && toBlob();
      if(blob && navigator.share && navigator.canShare){ const file=new File([blob], 'kaidee-qr.png', { type:'image/png' });
        if(navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], title:shopName||'KaiDee POS', text:row.label }); return; } }
      if(navigator.share){ await navigator.share({ title:shopName||'KaiDee POS', text:row.label, url:row.url }); return; }
    }catch(e){ if(e && e.name==='AbortError') return; }
    try{ navigator.clipboard.writeText(row.url); setCopied(true); setTimeout(()=>setCopied(false),1400); }catch(e){}
  };
  const save = ()=>{ if(!dataUrl) return; const a=document.createElement('a'); a.href=dataUrl; a.download=((row.label||'qr')+'.png').replace(/[\\/:*?"<>|]+/g,''); document.body.appendChild(a); a.click(); a.remove(); };
  const canShare = typeof navigator!=='undefined' && !!navigator.share;
  return (
    <div onClick={onClose} style={{ position:'absolute', inset:0, zIndex:60, background:'rgba(11,30,24,.55)', display:'flex', alignItems:'flex-end', justifyContent:'center', animation:'kdFade .2s ease' }}>
      <div onClick={e=>e.stopPropagation()} className="kd-pop" style={{ background:'#fff', width:'100%', maxWidth:440, borderRadius:'22px 22px 0 0', padding:'20px 20px calc(20px + 12px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <span style={{ width:8, height:8, borderRadius:999, background:row.tone }}/>
          <div style={{ fontSize:16.5, fontWeight:700, flex:1 }}>{row.label}</div>
          <button onClick={onClose} style={{ border:'none', background:'var(--bg)', color:'var(--ink-2)', borderRadius:10, width:34, height:34, fontSize:17, cursor:'pointer', fontFamily:'var(--font)' }}>✕</button>
        </div>
        <div style={{ fontSize:12.5, color:'var(--ink-3)', marginBottom:14 }}>{TH?'ให้ลูกค้า/ทีม สแกนเพื่อเปิดลิงก์ได้เลย':'Scan to open this link'}</div>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
          <div ref={box} style={{ width:236, height:236, padding:14, background:'#fff', borderRadius:18, boxShadow:'0 2px 14px rgba(11,59,46,.12)', border:'1px solid var(--hair-2)', display:'flex', alignItems:'center', justifyContent:'center' }}/>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {canShare && <button onClick={shareImg} className="kd-btn kd-btn-primary" style={{ flex:2, padding:14, fontWeight:700 }}>↗ {copied?(TH?'คัดลอกลิงก์แล้ว':'Link copied'):(TH?'แชร์ QR':'Share QR')}</button>}
          <button onClick={save} className="kd-btn" style={{ flex:canShare?1:2, padding:14, background:'var(--brand-soft)', color:'var(--brand-ink)', fontWeight:700 }}>⤓ {TH?'บันทึกรูป':'Save'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── in-app document viewer (iframe — อยู่ในกรอบมือถือ ไม่เด้งเบราว์เซอร์อื่น) ── */
function InAppDoc({ url, title, lang, onClose }){
  const TH = lang!=='en';
  return (
    <div style={{ position:'absolute', inset:0, zIndex:140, background:'#fff', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderBottom:'1px solid var(--hair)', flex:'0 0 auto' }}>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer', fontSize:17, fontFamily:'var(--font)' }}>‹</button>
        <div style={{ flex:1, fontWeight:700, fontSize:15 }}>{title}</div>
        <a href={url} target="_blank" rel="noopener" style={{ fontSize:12, fontWeight:700, color:'var(--brand-ink)', textDecoration:'none' }}>{TH?'เปิดเต็มจอ':'Full'} ↗</a>
      </div>
      <iframe src={url} title={title} style={{ flex:1, width:'100%', border:'none' }}/>
    </div>
  );
}

/* ── shop links block (customer / backend / rider) ── */
function HomeLinks({ shop, lang }){
  const TH = lang!=='en';
  const [c,setC] = hState('');
  const [qr,setQr] = hState(null);
  const sid = (shop && shop.shopId) || (typeof window!=='undefined' && (window.KD_SHOP||window.kd_shop)) || '';
  const origin = (typeof location!=='undefined') ? location.origin+location.pathname.replace(/[^/]*$/,'') : '';
  const rows = [
    { k:'c', label:TH?'ลิงก์ลูกค้าสั่งอาหาร':'Customer order link', hint:TH?'ใส่ใน Rich menu LINE':'For LINE Rich menu',
      url:`https://liff.line.me/${LIFF_ID}?shop=${sid}`, tone:'var(--line-green)' },
    { k:'p', label:TH?'ลิงก์หลังบ้าน':'Backend link', hint:TH?'แม่ค้า/ครัว เก็บส่วนตัว':'Owner / kitchen only',
      url:`${origin}?shop=${sid}&role=merchant`, tone:'var(--brand)' },
    { k:'b', label:TH?'ลิงก์ Backoffice (จอคอม)':'Backoffice (desktop)', hint:TH?'ดูยอด/สต๊อก/สมาชิกบนคอม':'Reports on desktop',
      url:`${origin}Shop%20Backoffice.html?shop=${sid}`, tone:'var(--accent)' },
    { k:'r', label:TH?'ลิงก์ทีมส่ง (ไรเดอร์)':'Rider link', hint:TH?'ส่งให้คนขับ':'Share with riders',
      url:`${origin}?shop=${sid}&role=rider`, tone:'var(--ink)' },
  ];
  const cp=(u,k)=>{ try{ navigator.clipboard.writeText(u); }catch(e){} setC(k); setTimeout(()=>setC(''),1400); };
  const sh=(r)=>{ const data={ title:(shop&&shop.name)||'KaiDee POS', text:r.label, url:r.url };
    if(typeof navigator!=='undefined' && navigator.share){ navigator.share(data).catch(()=>{}); }
    else { cp(r.url,r.k); } };
  const canShare = typeof navigator!=='undefined' && !!navigator.share;
  const [open,setOpen] = hState(false);
  const [viewer,setViewer] = hState(null);
  if(!sid) return null;
  return (
    <div className="kd-card" style={{ padding:'16px 17px', marginBottom:15 }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ border:'none', background:'none', cursor:'pointer', fontFamily:'var(--font)', width:'100%', display:'flex', alignItems:'center', gap:10, padding:0, textAlign:'left' }}>
        <span style={{ flex:1, textAlign:'left' }}><span style={{ display:'block', fontWeight:700, fontSize:15.5, color:'var(--ink)' }}>🔗 {TH?'ลิงก์ของร้านคุณ':'Your shop links'}</span><span style={{ display:'block', fontSize:12, color:'var(--ink-3)', fontWeight:500, marginTop:3, lineHeight:1.45 }}>{TH?'ลิงก์แชร์ให้ทีมงาน · ปุ่มลัด/เมนูเข้าร้านสำหรับลูกค้าประจำ':'Team share links · shortcut buttons/menu for regular customers'}</span></span>
        <span style={{ fontSize:15, color:'var(--ink-3)', transform:open?'rotate(90deg)':'none', transition:'transform .2s' }}>›</span>
      </button>
      {open && <>
      <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'8px 0 0', lineHeight:1.5 }}>{TH?'ถ้าร้านใช้ LINE OA — วางลิงก์ลูกค้าใน Rich menu · หรือส่งลิงก์ให้ทีมงาน/ไรเดอร์':'Using LINE OA? Put the customer link in your Rich menu · or share role links with your team/riders.'}</div>
      {rows.map(r=>(
        <div key={r.k} style={{ marginTop:12 }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:'var(--ink-2)', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:7, height:7, borderRadius:999, background:r.tone }}/>{r.label}
            <span style={{ fontWeight:500, color:'var(--ink-3)' }}>· {r.hint}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--brand-softer)', border:'1px solid var(--hair-2)', borderRadius:12, padding:'8px 8px 8px 12px' }}>
            <code style={{ flex:1, fontFamily:'var(--mono)', fontSize:11, color:'var(--brand-ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.url}</code>
            <button onClick={()=>cp(r.url,r.k)} style={{ border:'none', background: c===r.k?'var(--brand-ink)':'var(--brand)', color:'#fff', borderRadius:9, padding:'7px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap' }}>{c===r.k?(TH?'คัดลอกแล้ว':'Copied'):(TH?'คัดลอก':'Copy')}</button>
            <button onClick={()=>setQr(r)} title={TH?'QR โค้ด':'QR code'} style={{ border:'1px solid var(--brand)', background:'transparent', color:'var(--brand)', borderRadius:9, padding:'7px 10px', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap' }}>▦ QR</button>
            {canShare && <button onClick={()=>sh(r)} title={TH?'แชร์':'Share'} style={{ border:'1px solid var(--brand)', background:'transparent', color:'var(--brand)', borderRadius:9, padding:'7px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap' }}>↗ {TH?'แชร์':'Share'}</button>}
          </div>
        </div>
      ))}
      <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:11, lineHeight:1.5, background:'var(--bg)', borderRadius:10, padding:'9px 12px' }}>💡 {TH?'แต่ละคนเห็นเฉพาะมุมของตัวเอง — ส่งลิงก์ให้ถูกคนได้เลย':'Each role sees only its own view — share the right link with the right person.'}</div>
      <button onClick={()=>setViewer({ url:`richmenu-template.html?shop=${encodeURIComponent(sid)}&name=${encodeURIComponent(shop.name||'')}&phone=${encodeURIComponent(shop.phone||'')}&emoji=${encodeURIComponent(shop.emoji||'🍽️')}`, title:TH?'เทมเพลต Rich Menu':'Rich menu template' })} style={{ display:'flex', alignItems:'center', gap:10, marginTop:11, width:'100%', border:'none', cursor:'pointer', fontFamily:'var(--font)', background:'var(--brand-soft)', color:'var(--brand-ink)', borderRadius:12, padding:'12px 14px', fontWeight:700, fontSize:13.5 }}>
        <span style={{ fontSize:19 }}>🎨</span><span style={{ flex:1, textAlign:'left' }}>{TH?'เทมเพลต Rich Menu ร้านสำเร็จรูป (สำหรับ LINE OA)':'Ready-made Rich menu (LINE OA)'}</span><span>›</span></button>
      </>}
      {viewer && <InAppDoc url={viewer.url} title={viewer.title} lang={lang} onClose={()=>setViewer(null)} />}
      {qr && <QrSheet row={qr} shopName={(shop&&shop.name)||''} lang={lang} onClose={()=>setQr(null)} />}
    </div>
  );
}

/* ── สื่อ & เครื่องมือหน้าร้าน (Rich menu · QR · จอคิว) — วางท้ายสุดของจัดการร้าน ── */
function ShopMediaLinks({ shop, lang }){
  const TH = lang!=='en';
  const [c,setC] = hState('');
  const [qr,setQr] = hState(null);
  const [open,setOpen] = hState(false);
  const [viewer,setViewer] = hState(null);
  const sid = (shop && shop.shopId) || (typeof window!=='undefined' && (window.KD_SHOP||window.kd_shop)) || '';
  const origin = (typeof location!=='undefined') ? location.origin+location.pathname.replace(/[^/]*$/,'') : '';
  // ⭐ ลิงก์จอคิวใช้ผ่าน LIFF → เปิดได้ทุกอุปกรณ์ (แท็บเล็ต/จอหน้าร้าน/ในแอป LINE) · ไม่พึ่ง location.origin ที่เพี้ยนตอนอยู่ใน LINE
  const boardUrl = sid ? `https://liff.line.me/${LIFF_ID}?shop=${encodeURIComponent(sid)}&role=board` : '';
  const kdsUrl = sid ? `https://liff.line.me/${LIFF_ID}?shop=${encodeURIComponent(sid)}&role=kds` : '';
  const canShare = typeof navigator!=='undefined' && !!navigator.share;
  const cp=(u,k)=>{ try{ navigator.clipboard.writeText(u); }catch(e){} setC(k); setTimeout(()=>setC(''),1500); };
  const sh=(u,label)=>{ const data={ title:(shop&&shop.name)||'KaiDee POS', text:label, url:u };
    if(typeof navigator!=='undefined' && navigator.share){ navigator.share(data).catch(()=>{}); } else { cp(u,'board'); } };
  const row = { display:'flex', alignItems:'center', gap:10, marginTop:9, textDecoration:'none', background:'var(--brand-soft)', color:'var(--brand-ink)', borderRadius:12, padding:'12px 14px', fontWeight:700, fontSize:13.5 };
  const boardLabel = TH?'จอแสดงคิว':'Queue board';
  const kdsLabel = TH?'จอครัว (KDS)':'Kitchen display';
  return (
    <div className="kd-card" style={{ padding:'16px 17px', marginBottom:15 }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ border:'none', background:'none', cursor:'pointer', fontFamily:'var(--font)', width:'100%', display:'flex', alignItems:'center', gap:10, padding:0, textAlign:'left' }}>
        <span style={{ flex:1, textAlign:'left' }}><span style={{ display:'block', fontWeight:700, fontSize:15.5, color:'var(--ink)' }}>🛠️ {TH?'สื่อ & เครื่องมือหน้าร้าน':'Shop media & tools'}</span><span style={{ display:'block', fontSize:12, color:'var(--ink-3)', fontWeight:500, marginTop:3, lineHeight:1.45 }}>{TH?'QR/ลิงก์ให้ลูกค้าสั่งเองจากมือถือ · จอแสดงคิว · โปสเตอร์ตั้งโต๊ะ':'QR/link for customers to self-order on their phone · queue board · table poster'}</span></span>
        <span style={{ fontSize:15, color:'var(--ink-3)', transform:open?'rotate(90deg)':'none', transition:'transform .2s' }}>›</span>
      </button>
      {open && <>

      {/* จอแสดงคิว — ลิงก์เปิดบนอุปกรณ์อื่น (คัดลอก/แชร์/QR) */}
      <div style={{ marginTop:12, background:'var(--brand-softer)', border:'1px solid var(--hair-2)', borderRadius:14, padding:'13px 13px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <span style={{ fontSize:19 }}>📺</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>{boardLabel}</div>
            <div style={{ fontSize:11.5, color:'var(--ink-3)' }}>{TH?'เปิดลิงก์นี้บนจอ/แท็บเล็ตหน้าร้านคนละเครื่อง':'Open this link on a front-of-house screen/tablet'}</div>
          </div>
        </div>
        {sid ? <>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid var(--hair-2)', borderRadius:11, padding:'8px 8px 8px 12px', marginTop:9 }}>
            <code style={{ flex:1, fontFamily:'var(--mono)', fontSize:11, color:'var(--brand-ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{boardUrl}</code>
            <button onClick={()=>cp(boardUrl,'board')} style={{ border:'none', background: c==='board'?'var(--brand-ink)':'var(--brand)', color:'#fff', borderRadius:9, padding:'7px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap' }}>{c==='board'?(TH?'คัดลอกแล้ว':'Copied'):(TH?'คัดลอก':'Copy')}</button>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            {canShare && <button onClick={()=>sh(boardUrl,boardLabel)} className="kd-btn kd-btn-primary" style={{ flex:2, padding:'10px', fontWeight:700, fontSize:13 }}>↗ {TH?'แชร์ลิงก์จอคิว':'Share board link'}</button>}
            <button onClick={()=>setQr({ url:boardUrl, label:boardLabel, tone:'var(--brand)' })} className="kd-btn" style={{ flex:1, padding:'10px', background:'var(--brand-soft)', color:'var(--brand-ink)', fontWeight:700, fontSize:13 }}>▦ QR</button>
            <a href={boardUrl} target="_blank" rel="noopener" className="kd-btn" style={{ flex:1, padding:'10px', background:'var(--brand-soft)', color:'var(--brand-ink)', fontWeight:700, fontSize:13, textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center' }}>{TH?'เปิด':'Open'} ›</a>
          </div>
        </> : <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:8 }}>{TH?'ยังไม่มีรหัสร้าน — เปิดหลังบ้านผ่านลิงก์ร้านก่อน':'No shop id yet'}</div>}
      </div>

      {/* จอครัว KDS — ลิงก์เปิดบนจอ/แท็บเล็ตในครัว (คัดลอก/แชร์/QR) */}
      <div style={{ marginTop:12, background:'#FFF8EE', border:'1px solid #EBD9B8', borderRadius:14, padding:'13px 13px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <span style={{ fontSize:19 }}>👨‍🍳</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>{kdsLabel}</div>
            <div style={{ fontSize:11.5, color:'var(--ink-3)' }}>{TH?'เปิดบนจอ/แท็บเล็ตในครัว — เห็นรายการ กดเริ่มทำ/ทำเสร็จ':'Open on a kitchen screen — tickets with items & bump buttons'}</div>
          </div>
        </div>
        {sid ? <>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid #EBD9B8', borderRadius:11, padding:'8px 8px 8px 12px', marginTop:9 }}>
            <code style={{ flex:1, fontFamily:'var(--mono)', fontSize:11, color:'#8A6100', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{kdsUrl}</code>
            <button onClick={()=>cp(kdsUrl,'kds')} style={{ border:'none', background: c==='kds'?'#8A6100':'#B26A00', color:'#fff', borderRadius:9, padding:'7px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap' }}>{c==='kds'?(TH?'คัดลอกแล้ว':'Copied'):(TH?'คัดลอก':'Copy')}</button>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            {canShare && <button onClick={()=>sh(kdsUrl,kdsLabel)} className="kd-btn" style={{ flex:2, padding:'10px', background:'#B26A00', color:'#fff', fontWeight:700, fontSize:13 }}>↗ {TH?'แชร์ลิงก์จอครัว':'Share KDS link'}</button>}
            <button onClick={()=>setQr({ url:kdsUrl, label:kdsLabel, tone:'#B26A00' })} className="kd-btn" style={{ flex:1, padding:'10px', background:'#FBEEDA', color:'#8A6100', fontWeight:700, fontSize:13 }}>▦ QR</button>
            <a href={kdsUrl} target="_blank" rel="noopener" className="kd-btn" style={{ flex:1, padding:'10px', background:'#FBEEDA', color:'#8A6100', fontWeight:700, fontSize:13, textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center' }}>{TH?'เปิด':'Open'} ›</a>
          </div>
        </> : <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:8 }}>{TH?'ยังไม่มีรหัสร้าน':'No shop id yet'}</div>}
      </div>

      <button onClick={()=>setViewer({ url:`qr-poster.html?shop=${encodeURIComponent(sid)}&name=${encodeURIComponent(shop.name||'')}`, title:TH?'QR โปสเตอร์':'QR poster' })} style={{ ...row, border:'none', width:'100%', cursor:'pointer', fontFamily:'var(--font)' }}>
        <span style={{ fontSize:19 }}>📱</span><span style={{ flex:1, textAlign:'left' }}>{TH?'QR โปสเตอร์ (ปริ้นท์ติดหน้าร้าน / ไรเดอร์)':'QR poster (print)'}</span><span>›</span></button>
      </>}
      {viewer && <InAppDoc url={viewer.url} title={viewer.title} lang={lang} onClose={()=>setViewer(null)} />}
      {qr && <QrSheet row={qr} shopName={(shop&&shop.name)||''} lang={lang} onClose={()=>setQr(null)} />}
    </div>
  );
}

/* ── โมดูล & เครื่องมือหน้าร้าน (hub เดียว) — เปิด-ปิดโมดูล + อธิบาย LINE OA vs Mobile Order + กดเข้าใช้เครื่องมือ ── */
const MODULE_DEFAULTS = { mobileOrder:true, lineOA:false, queue:true, kds:false };
function moduleOn(shop, k){ const m=(shop&&shop.modules)||{}; return m[k]!=null ? !!m[k] : !!MODULE_DEFAULTS[k]; }
// ปุ่มลิงก์ (คัดลอก/แชร์/QR) ใช้ซ้ำในแผงเครื่องมือของแต่ละโมดูล
function ToolLinkBox({ url, label, tone, lang, onQr }){
  const TH = lang!=='en'; const [c,setC]=hState(false);
  const cp=()=>{ try{ navigator.clipboard.writeText(url); }catch(e){} setC(true); setTimeout(()=>setC(false),1400); };
  const sh=()=>{ const d={ title:label, text:label, url }; if(typeof navigator!=='undefined'&&navigator.share) navigator.share(d).catch(()=>{}); else cp(); };
  const canShare = typeof navigator!=='undefined' && !!navigator.share;
  return (<div>
    <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--brand-softer)', border:'1px solid var(--hair-2)', borderRadius:12, padding:'8px 8px 8px 12px' }}>
      <code style={{ flex:1, fontFamily:'var(--mono)', fontSize:11, color:'var(--brand-ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{url}</code>
      <button onClick={cp} style={{ border:'none', background:c?'var(--brand-ink)':'var(--brand)', color:'#fff', borderRadius:9, padding:'7px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap' }}>{c?(TH?'คัดลอกแล้ว':'Copied'):(TH?'คัดลอก':'Copy')}</button>
    </div>
    <div style={{ display:'flex', gap:8, marginTop:8 }}>
      {canShare && <button onClick={sh} className="kd-btn kd-btn-primary" style={{ flex:2, padding:'10px', fontWeight:700, fontSize:13 }}>↗ {TH?'แชร์ลิงก์':'Share'}</button>}
      <button onClick={onQr} className="kd-btn" style={{ flex:1, padding:'10px', background:'var(--brand-soft)', color:'var(--brand-ink)', fontWeight:700, fontSize:13 }}>▦ QR</button>
      <a href={url} target="_blank" rel="noopener" className="kd-btn" style={{ flex:1, padding:'10px', background:'var(--brand-soft)', color:'var(--brand-ink)', fontWeight:700, fontSize:13, textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center' }}>{TH?'เปิด':'Open'} ›</a>
    </div>
  </div>);
}
function ModuleToolsSheet({ shop, setShop, lang, onClose }){
  const TH = lang!=='en';
  const [view,setView] = hState('hub');   // 'hub' | 'explain' | 'mobileOrder' | 'lineOA' | 'queue' | 'kds'
  const [qr,setQr] = hState(null);
  const [viewer,setViewer] = hState(null);
  const sid = (shop && shop.shopId) || (typeof window!=='undefined' && (window.KD_SHOP||window.kd_shop)) || '';
  const origin = (typeof location!=='undefined') ? location.origin+location.pathname.replace(/[^/]*$/,'') : '';
  const custUrl = `https://liff.line.me/${LIFF_ID}?shop=${sid}`;
  const boardUrl = `https://liff.line.me/${LIFF_ID}?shop=${encodeURIComponent(sid)}&role=board`;
  const kdsUrl = `https://liff.line.me/${LIFF_ID}?shop=${encodeURIComponent(sid)}&role=kds`;
  const setMod = (k,v)=> setShop(p=>({ ...p, modules:{ ...MODULE_DEFAULTS, ...(p.modules||{}), [k]:v } }));
  const nav = (title,sub)=>(<div className="nav" style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderBottom:'1px solid var(--hair)', flex:'0 0 auto', background:'#fff' }}>
    <button onClick={()=> view==='hub'?onClose():setView('hub')} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer', fontSize:17, fontFamily:'var(--font)' }}>‹</button>
    <div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:15 }}>{title}</div><div style={{ fontSize:11, color:'var(--ink-3)', marginTop:1 }}>{sub}</div></div>
  </div>);
  const MODS = [
    { k:'mobileOrder', gh:TH?'ช่องทางให้ลูกค้าสั่ง':'Customer ordering', ic:'📱', tint:'var(--brand-soft)', tag:TH?'หัวใจการสั่งซื้อ':'Core', tagCol:'var(--brand-ink)', b:'Mobile Order', s:TH?'ลูกค้าสั่งเองจากลิงก์/QR':'Self-order via link/QR', tog:true },
    { k:'lineOA', ic:'💬', tint:'var(--line-soft,#E4F9EC)', tag:TH?'ทางเลือก':'Optional', tagCol:'#B26A00', b:'LINE OA', s:TH?'ประตูเข้าผ่าน Rich Menu':'Entry via Rich Menu', tog:true },
    { k:'queue', gh:TH?'จอหน้าร้าน / ครัว':'Front / kitchen screens', ic:'📺', tint:'var(--bg)', b:TH?'จอแสดงคิว':'Queue board', s:TH?'โชว์เลขคิวให้ลูกค้า':'Show queue numbers', tog:true },
    { k:'kds', ic:'👨‍🍳', tint:'#FBEEDA', b:TH?'จอครัว (KDS)':'Kitchen display', s:TH?'ตั๋วออเดอร์ในครัว':'Kitchen tickets', tog:true },
  ];
  return (
    <div style={{ position:'absolute', inset:0, zIndex:140, background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      {view==='hub' && <>
        {nav(TH?'โมดูล & เครื่องมือ':'Modules & tools', TH?'เปิดเฉพาะที่ร้านใช้':'Turn on only what you use')}
        <div style={{ flex:1, overflow:'auto', padding:'15px 15px 24px' }}>
          <button onClick={()=>setView('explain')} style={{ width:'100%', border:'none', cursor:'pointer', fontFamily:'var(--font)', textAlign:'left', background:'linear-gradient(152deg,#14A886 0%,#1E73B0 100%)', color:'#fff', borderRadius:15, padding:'14px 15px', display:'flex', alignItems:'center', gap:12, marginBottom:15, boxShadow:'0 8px 20px -8px rgba(20,110,96,.5)' }}>
            <span style={{ fontSize:24 }}>❓</span><div style={{ flex:1 }}><b style={{ fontSize:13.5, display:'block' }}>{TH?'LINE OA กับ Mobile Order ต่างกันยังไง?':'LINE OA vs Mobile Order?'}</b><span style={{ fontSize:11.5, opacity:.9 }}>{TH?'งงอยู่ใช่ไหม — แตะอ่านสั้น ๆ 1 นาที':'Confused? Tap for a 1-min read'}</span></div><span style={{ fontSize:18, opacity:.85 }}>›</span>
          </button>
          {MODS.map(m=>(<React.Fragment key={m.k}>
            {m.gh && <div style={{ fontSize:11.5, fontWeight:700, color:'var(--ink-3)', letterSpacing:'.03em', margin:'14px 3px 9px', textTransform:'uppercase' }}>{m.gh}</div>}
            <div className="kd-card" style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 14px', marginBottom:9, opacity: moduleOn(shop,m.k)?1:.62 }}>
              <button onClick={()=>setView(m.k)} style={{ border:'none', background:'none', cursor:'pointer', fontFamily:'var(--font)', flex:1, display:'flex', alignItems:'center', gap:12, padding:0, textAlign:'left', minWidth:0 }}>
                <span style={{ width:40, height:40, borderRadius:12, flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, background:m.tint }}>{m.ic}</span>
                <span style={{ flex:1, minWidth:0 }}>{m.tag && <span style={{ fontFamily:'var(--mono)', fontSize:9.5, letterSpacing:'.05em', textTransform:'uppercase', color:m.tagCol, display:'block' }}>{m.tag}</span>}<b style={{ fontSize:14, fontWeight:700, display:'block' }}>{m.b}</b><span style={{ fontSize:11, color:'var(--ink-3)', display:'block', marginTop:1 }}>{m.s}</span></span>
              </button>
              <button onClick={()=>setMod(m.k, !moduleOn(shop,m.k))} aria-label="toggle" style={{ border:'none', cursor:'pointer', padding:0, background:'none' }}>
                <span style={{ display:'block', width:46, height:27, borderRadius:999, position:'relative', transition:'background .2s', background: moduleOn(shop,m.k)?(m.k==='lineOA'?'#06C755':'var(--brand)'):'var(--hair-2)' }}>
                  <span style={{ position:'absolute', top:3, left:3, width:21, height:21, borderRadius:999, background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,.25)', transition:'transform .2s', transform: moduleOn(shop,m.k)?'translateX(19px)':'none' }}/>
                </span>
              </button>
            </div>
          </React.Fragment>))}
          <div style={{ fontSize:11.5, fontWeight:700, color:'var(--ink-3)', letterSpacing:'.03em', margin:'14px 3px 9px', textTransform:'uppercase' }}>{TH?'สื่อประชาสัมพันธ์':'Promotion'}</div>
          <button onClick={()=>setViewer({ url:`qr-poster.html?shop=${encodeURIComponent(sid)}&name=${encodeURIComponent(shop.name||'')}`, title:TH?'QR โปสเตอร์':'QR poster' })} className="kd-card" style={{ width:'100%', border:'none', cursor:'pointer', fontFamily:'var(--font)', textAlign:'left', display:'flex', alignItems:'center', gap:12, padding:'13px 14px' }}>
            <span style={{ width:40, height:40, borderRadius:12, flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, background:'var(--bg)' }}>🖨️</span>
            <span style={{ flex:1 }}><b style={{ fontSize:14, fontWeight:700, display:'block' }}>{TH?'QR โปสเตอร์':'QR poster'}</b><span style={{ fontSize:11, color:'var(--ink-3)' }}>{TH?'ปริ้นท์ติดหน้าร้าน':'Print for the shopfront'}</span></span>
            <span style={{ color:'var(--ink-3)', fontSize:16 }}>›</span>
          </button>
          <button onClick={()=>setViewer({ url:`label-print.html?shop=${encodeURIComponent(sid)}&name=${encodeURIComponent(shop.name||'')}`, title:TH?'พิมพ์ป้ายสินค้า':'Product labels' })} className="kd-card" style={{ width:'100%', border:'none', cursor:'pointer', fontFamily:'var(--font)', textAlign:'left', display:'flex', alignItems:'center', gap:12, padding:'13px 14px', marginTop:9 }}>
            <span style={{ width:40, height:40, borderRadius:12, flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, background:'var(--bg)' }}>🏷️</span>
            <span style={{ flex:1 }}><b style={{ fontSize:14, fontWeight:700, display:'block' }}>{TH?'พิมพ์ป้ายสินค้า':'Product labels'}</b><span style={{ fontSize:11, color:'var(--ink-3)' }}>{TH?'ป้ายราคา · บาร์โค้ด · ขายฝาก (40×30/50×30mm)':'Price · barcode · consignment'}</span></span>
            <span style={{ color:'var(--ink-3)', fontSize:16 }}>›</span>
          </button>
        </div>
      </>}

      {view==='explain' && <>
        {nav(TH?'LINE OA & Mobile Order':'LINE OA & Mobile Order', TH?'2 อย่างนี้ต่างกันยังไง':'How they differ')}
        <div style={{ flex:1, overflow:'auto', padding:'15px 15px 24px' }}>
          <div style={{ background:'linear-gradient(152deg,#14A886 0%,#1E73B0 100%)', color:'#fff', borderRadius:18, padding:'18px 17px', marginBottom:13 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:11 }}><span style={{ background:'rgba(255,255,255,.2)', borderRadius:10, padding:'7px 11px', fontWeight:700, fontSize:12 }}>💬 LINE OA</span><span style={{ fontSize:18, fontWeight:700 }}>≠</span><span style={{ background:'rgba(255,255,255,.2)', borderRadius:10, padding:'7px 11px', fontWeight:700, fontSize:12 }}>📱 Mobile Order</span></div>
            <div style={{ fontSize:17, fontWeight:700, lineHeight:1.3 }}>{TH?'คนละเครื่องมือ คนละหน้าที่':'Two different tools'}</div>
            <div style={{ fontSize:12, opacity:.92, lineHeight:1.55, marginTop:7 }}>{TH?'หลายร้านคิดว่าเป็นอันเดียว — จริง ๆ แยกกันชัดเจน':'Many think they are the same — they are not.'}</div>
          </div>
          {[['📱','var(--brand-soft)','var(--brand-ink)',TH?'หัวใจของการสั่งซื้อ':'Core',TH?'Mobile Order = ร้านออนไลน์':'Mobile Order = your online shop',TH?'ลูกค้าเปิดจาก ลิงก์/QR ได้เลย ไม่ต้องมี LINE ก็สั่งได้ — นี่คือระบบรับออเดอร์ตัวจริง':'Customers open a link/QR — no LINE needed. This is the real ordering system.'],
            ['💬','var(--line-soft,#E4F9EC)','#04833A',TH?'ช่องทางเสริม (ทางเลือก)':'Optional channel',TH?'LINE OA = ประตูอีกบาน':'LINE OA = another door',TH?'พาลูกค้าเข้าหน้า Mobile Order ผ่าน Rich Menu — มีก็ดี ไม่มีก็ขายได้':'Leads customers to Mobile Order via Rich Menu — nice to have, not required.']].map((x,i)=>(
            <div key={i} className="kd-card" style={{ padding:'14px 15px', marginBottom:11 }}>
              <div style={{ display:'flex', gap:11, alignItems:'center' }}><div style={{ width:40, height:40, borderRadius:12, flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, background:x[1] }}>{x[0]}</div><div><div style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.05em', textTransform:'uppercase', color:x[2] }}>{x[3]}</div><b style={{ fontSize:14.5, fontWeight:700, display:'block', marginTop:2 }}>{x[4]}</b></div></div>
              <div style={{ fontSize:12, color:'var(--ink-2)', lineHeight:1.55, marginTop:10 }}>{x[5]}</div>
            </div>))}
          <div style={{ background:'#0F1A16', color:'#fff', borderRadius:16, padding:'15px 14px' }}>
            <div style={{ fontSize:13, fontWeight:700, textAlign:'center', marginBottom:11 }}>{TH?'มาทางไหนก็ปลายทางเดียวกัน':'All roads lead to one page'}</div>
            {[['🔳',TH?'QR โต๊ะ/โปสเตอร์':'Table/poster QR',TH?'ไม่ต้องมี LINE':'no LINE'],['🔗',TH?'ลิงก์เว็บ/โซเชียล':'Web/social link',TH?'ไม่ต้องมี LINE':'no LINE'],['💬','LINE OA · Rich Menu','']].map((s,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:9, background:'rgba(255,255,255,.07)', borderRadius:10, padding:'9px 11px', marginBottom:7, fontSize:11.5, fontWeight:600 }}><span style={{ fontSize:16 }}>{s[0]}</span>{s[1]}{s[2]&&<span style={{ marginLeft:'auto', fontSize:9, fontFamily:'var(--mono)', padding:'2px 7px', borderRadius:999, background:'rgba(6,199,85,.2)', color:'#5EE89A' }}>{s[2]}</span>}</div>))}
            <div style={{ textAlign:'center', color:'rgba(255,255,255,.35)', fontSize:14, padding:'3px 0' }}>↓ ↓ ↓</div>
            <div style={{ background:'linear-gradient(152deg,#14A886 0%,#1E73B0 100%)', borderRadius:11, padding:'12px 13px', display:'flex', alignItems:'center', gap:10 }}><span style={{ fontSize:20 }}>📱</span><div><b style={{ fontSize:13, fontWeight:700 }}>{TH?'หน้า Mobile Order':'Mobile Order page'}</b><span style={{ fontSize:10.5, opacity:.85, display:'block' }}>{TH?'เมนู · ตะกร้า · ชำระเงิน':'Menu · cart · checkout'}</span></div></div>
          </div>
        </div>
      </>}

      {view==='mobileOrder' && <>
        {nav('Mobile Order', TH?'ให้ลูกค้าสั่งเองจากมือถือ':'Customers self-order')}
        <div style={{ flex:1, overflow:'auto', padding:'15px 15px 24px' }}>
          {!moduleOn(shop,'mobileOrder') && <div style={{ background:'#FBEEDA', color:'#8A6100', borderRadius:12, padding:'11px 13px', fontSize:12, marginBottom:13, lineHeight:1.5 }}>⚠️ {TH?'โมดูลนี้ปิดอยู่ — เปิดสวิตช์ในหน้าโมดูลเพื่อให้ลูกค้าสั่งได้':'This module is off — turn it on so customers can order.'}</div>}
          <div className="kd-card" style={{ padding:'15px', marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:700 }}>🔗 {TH?'ลิงก์ลูกค้าสั่งอาหาร':'Customer order link'}</div>
            <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'4px 0 11px', lineHeight:1.5 }}>{TH?'แชร์ทางไหนก็ได้ — FB, IG, ไลน์กลุ่ม หรือวางใน Rich Menu':'Share anywhere — FB, IG, group chat, or Rich Menu'}</div>
            <ToolLinkBox url={custUrl} label={TH?'ลิงก์ลูกค้าสั่งอาหาร':'Customer order link'} lang={lang} onQr={()=>setQr({ url:custUrl, label:TH?'ลิงก์ลูกค้าสั่งอาหาร':'Customer order link', tone:'var(--brand)' })}/>
          </div>
          <button onClick={()=>setViewer({ url:`qr-poster.html?shop=${encodeURIComponent(sid)}&name=${encodeURIComponent(shop.name||'')}`, title:TH?'QR โปสเตอร์':'QR poster' })} className="kd-card" style={{ width:'100%', border:'none', cursor:'pointer', fontFamily:'var(--font)', textAlign:'left', display:'flex', alignItems:'center', gap:12, padding:'14px 15px' }}>
            <span style={{ fontSize:20 }}>🖨️</span><span style={{ flex:1 }}><b style={{ fontSize:14, display:'block' }}>{TH?'QR โปสเตอร์ตั้งโต๊ะ':'Table QR poster'}</b><span style={{ fontSize:11.5, color:'var(--ink-3)' }}>{TH?'ปริ้นท์ติดโต๊ะ/หน้าร้าน':'Print for tables/shopfront'}</span></span><span style={{ color:'var(--ink-3)' }}>›</span>
          </button>
        </div>
      </>}

      {view==='lineOA' && <>
        {nav('LINE OA', TH?'ประตูเข้าผ่าน LINE (ทางเลือก)':'Entry via LINE (optional)')}
        <div style={{ flex:1, overflow:'auto', padding:'15px 15px 24px' }}>
          <div style={{ background:'var(--brand-softer)', border:'1px solid var(--brand-soft)', borderRadius:12, padding:'11px 13px', fontSize:11.5, color:'var(--ink-2)', lineHeight:1.5, marginBottom:12 }}>💡 <b style={{ color:'var(--brand-ink)' }}>{TH?'เปิดโมดูลนี้เมื่อร้านมีบัญชี LINE OA แล้ว':'Turn on when you have a LINE OA'}</b> — {TH?'ลิงก์ที่ใช้ยังเป็นหน้า Mobile Order เดิม':'the link is still your Mobile Order page.'}</div>
          <button onClick={()=>setViewer({ url:`richmenu-template.html?shop=${encodeURIComponent(sid)}&name=${encodeURIComponent(shop.name||'')}&phone=${encodeURIComponent(shop.phone||'')}&emoji=${encodeURIComponent(shop.emoji||'🍽️')}`, title:TH?'เทมเพลต Rich Menu':'Rich menu template' })} className="kd-card" style={{ width:'100%', border:'none', cursor:'pointer', fontFamily:'var(--font)', textAlign:'left', display:'flex', alignItems:'center', gap:12, padding:'14px 15px', marginBottom:12 }}>
            <span style={{ fontSize:20 }}>🎨</span><span style={{ flex:1 }}><b style={{ fontSize:14, display:'block' }}>{TH?'เทมเพลต Rich Menu สำเร็จรูป':'Ready-made Rich Menu'}</b><span style={{ fontSize:11.5, color:'var(--ink-3)' }}>{TH?'ก๊อปไปวางใน LINE OA Manager ได้เลย':'Copy into LINE OA Manager'}</span></span><span style={{ color:'var(--ink-3)' }}>›</span>
          </button>
          <div className="kd-card" style={{ padding:'15px' }}>
            <div style={{ fontSize:14, fontWeight:700 }}>💬 {TH?'ลิงก์แอด LINE OA ร้าน':'Add-LINE-OA link'}</div>
            <div style={{ fontSize:11.5, color:'var(--ink-3)', margin:'4px 0 11px' }}>{TH?'ให้ลูกค้าแอดเป็นเพื่อน':'For customers to add you'}</div>
            <ToolLinkBox url={OA_LINK} label={TH?'ลิงก์ LINE OA':'LINE OA link'} lang={lang} onQr={()=>setQr({ url:OA_LINK, label:TH?'LINE OA ร้าน':'Shop LINE OA', tone:'#06C755' })}/>
          </div>
          <div style={{ background:'var(--brand-softer)', border:'1px solid var(--brand-soft)', borderRadius:12, padding:'11px 13px', fontSize:11.5, color:'var(--ink-2)', lineHeight:1.5, marginTop:12 }}>🔗 <b style={{ color:'var(--brand-ink)' }}>{TH?'ปุ่มในเมนูทั้งหมดชี้ไปที่ลิงก์ Mobile Order':'All menu buttons point to Mobile Order'}</b> — {TH?'จึงไม่ต้องสร้างระบบสั่งซื้อใหม่':'no new ordering system needed.'}</div>
        </div>
      </>}

      {(view==='queue'||view==='kds') && (()=>{ const isK=view==='kds'; const url=isK?kdsUrl:boardUrl; const label=isK?(TH?'จอครัว (KDS)':'Kitchen display'):(TH?'จอแสดงคิว':'Queue board');
        return (<>
        {nav(label, isK?(TH?'ตั๋วออเดอร์ในครัว':'Kitchen tickets'):(TH?'โชว์เลขคิวให้ลูกค้า':'Show queue numbers'))}
        <div style={{ flex:1, overflow:'auto', padding:'15px 15px 24px' }}>
          {!moduleOn(shop,view) && <div style={{ background:'#FBEEDA', color:'#8A6100', borderRadius:12, padding:'11px 13px', fontSize:12, marginBottom:13, lineHeight:1.5 }}>⚠️ {TH?'โมดูลนี้ปิดอยู่ — เปิดสวิตช์ในหน้าโมดูลก่อนใช้':'This module is off — turn it on first.'}</div>}
          <div className="kd-card" style={{ padding:'15px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}><span style={{ fontSize:20 }}>{isK?'👨‍🍳':'📺'}</span><div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:700 }}>{label}</div><div style={{ fontSize:11.5, color:'var(--ink-3)' }}>{isK?(TH?'เปิดบนจอ/แท็บเล็ตในครัว':'Open on a kitchen screen/tablet'):(TH?'เปิดบนจอ/แท็บเล็ตหน้าร้าน':'Open on a front screen/tablet')}</div></div></div>
            <div style={{ marginTop:11 }}><ToolLinkBox url={url} label={label} lang={lang} onQr={()=>setQr({ url, label, tone:isK?'#B26A00':'var(--brand)' })}/></div>
          </div>
        </div>
        </>); })()}

      {viewer && <InAppDoc url={viewer.url} title={viewer.title} lang={lang} onClose={()=>setViewer(null)} />}
      {qr && <QrSheet row={qr} shopName={(shop&&shop.name)||''} lang={lang} onClose={()=>setQr(null)} />}
    </div>
  );
}

/* ── ชวนเพื่อน / แชร์แอป (refer a friend) ── */
function ReferFriend({ shop, lang }){
  const TH = lang!=='en';
  const [c,setC] = hState(false);
  const [qr,setQr] = hState(false);
  // ชวนเพื่อน = แอดไลน์ทางการ KaiDee POS แล้วเริ่มสมัคร (เพื่อนกดจากแชท → แอดเพื่อน → สมัคร)
  const url = 'https://line.me/R/ti/p/@188dfiog';
  const shopName = (shop&&shop.name)||'';
  const msg = TH ? `ร้าน${shopName?` ${shopName}`:''} ใช้ KaiDee POS ขายของ · รับออเดอร์ · ดูยอด ได้ในแอปเดียว ลองใช้ดูสิ` : `I run my shop with KaiDee POS — sell, take orders, track sales in one app. Give it a try`;
  const cp=()=>{ try{ navigator.clipboard.writeText(url); }catch(e){} setC(true); setTimeout(()=>setC(false),1400); };
  // แชร์เป็นข้อความล้วน (ไม่แนบ url) — กันการ์ดพรีวิว LINE โชว์ชื่อ OA
  const sh=()=>{ const data={ title:'KaiDee POS', text:msg }; if(typeof navigator!=='undefined' && navigator.share){ navigator.share(data).catch(()=>{}); } else cp(); };
  const canShare = typeof navigator!=='undefined' && !!navigator.share;
  const row = { k:'app', label:TH?'แอป KaiDee POS':'KaiDee POS app', url, tone:'var(--brand)' };
  return (
    <div className="kd-card" style={{ padding:'16px 17px', marginBottom:15, background:'linear-gradient(152deg,#14A886 0%,#1E73B0 100%)', color:'#fff', boxShadow:'none' }}>
      <div style={{ fontWeight:700, fontSize:15.5, display:'flex', alignItems:'center', gap:7 }}>🎁 {TH?'ชวนเพื่อนมาใช้ KaiDee POS':'Invite a friend to KaiDee POS'}</div>
      <div style={{ fontSize:12.5, opacity:.9, margin:'5px 0 12px', lineHeight:1.5 }}>{TH?'แชร์ให้ร้านเพื่อน — เปิดร้าน รับออเดอร์ ดูยอดขายได้ในแอปเดียว':'Share with fellow shop owners — sell, take orders, track sales in one app'}</div>
      <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.16)', borderRadius:12, padding:'8px 8px 8px 12px' }}>
        <code style={{ flex:1, fontFamily:'var(--mono)', fontSize:11, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{url}</code>
        <button onClick={cp} style={{ border:'none', background:'#fff', color:'var(--brand-ink)', borderRadius:9, padding:'7px 11px', fontWeight:700, fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'var(--font)' }}>{c?(TH?'คัดลอกแล้ว':'Copied'):(TH?'คัดลอก':'Copy')}</button>
      </div>
      <div style={{ display:'flex', gap:8, marginTop:10 }}>
        {canShare && <button onClick={sh} style={{ flex:2, border:'none', background:'rgba(255,255,255,.22)', color:'#fff', borderRadius:11, padding:'11px', fontWeight:700, fontSize:13.5, cursor:'pointer', fontFamily:'var(--font)' }}>↗ {TH?'แชร์ให้เพื่อน':'Share'}</button>}
        <button onClick={()=>setQr(true)} style={{ flex:1, border:'none', background:'rgba(255,255,255,.22)', color:'#fff', borderRadius:11, padding:'11px', fontWeight:700, fontSize:13.5, cursor:'pointer', fontFamily:'var(--font)' }}>▦ QR</button>
      </div>
      {qr && <QrSheet row={row} shopName="KaiDee POS" lang={lang} onClose={()=>setQr(false)} />}
    </div>
  );
}

/* ── main home dashboard ── */
function HomeScreen({ shop, setShop, sub, setSub, menu, orders, sales, onGo, onUpgrade }){
  const { t, lang } = useT();
  const TH = lang!=='en';
  const daysLeft = (sub&&sub.expiry) ? Math.max(0, Math.ceil((new Date(sub.expiry)-Date.now())/864e5)) : null;
  const paid = sub && (sub.plan==='paid' || sub.plan==='monthly' || sub.plan==='yearly');
  const planLabel = (SUB_PLAN_LABEL[sub&&sub.plan]||SUB_PLAN_LABEL.trial)[TH?'th':'en'];
  const lowTrial = !paid && daysLeft!=null && daysLeft<=7;

  // onboarding checklist — menu & test auto-derived from real data, LINE step is a manual toggle
  const menuDone = (menu||[]).length>0;
  const testDone = (orders||[]).length>0 || (sales||[]).length>0;
  const lineDone = !!(shop && shop.tasks && shop.tasks.line);
  const setLineDone = (v)=> setShop(p=>({ ...p, tasks:{ ...(p.tasks||{}), line:v } }));
  const steps = [
    { k:'menu', done:menuDone, auto:true, go:()=>onGo('store'),
      t:TH?'เพิ่มเมนูอาหาร':'Add menu items', s:TH?'ใส่ชื่อ ราคา รูป อย่างน้อย 1 รายการ':'Add at least one item with price' },
    { k:'line', done:lineDone, auto:false, toggle:()=>setLineDone(!lineDone),
      t:TH?'ผูก Rich menu LINE':'Link LINE Rich menu', s:TH?'วางลิงก์ลูกค้าในเมนู LINE OA ของร้าน':'Paste customer link into your LINE OA menu' },
    { k:'test', done:testDone, auto:true, go:()=>onGo('sell'),
      t:TH?'ลองขาย/สั่งทดสอบ 1 ครั้ง':'Make one test sale', s:TH?'กดขายเองดูว่ายอด/ออเดอร์เข้าระบบ':'Ring up a sale to see it flow in' },
  ];
  const doneN = steps.filter(s=>s.done).length;
  const allDone = doneN===steps.length;

  return (
    <div className="kd-screen" style={{ background:'var(--bg)' }}>
      {/* brand header */}
      <div style={{ background:'var(--hero)', color:'#fff', paddingTop:52, position:'relative', zIndex:2 }}>
        <div style={{ padding:'8px 18px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:54, height:54, borderRadius:16, flex:'0 0 auto', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:27, overflow:'hidden', backgroundImage:shop.logo?`url(${shop.logo})`:'none', backgroundSize:'cover', backgroundPosition:'center' }}>{!shop.logo && (shop.emoji||'🍽️')}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:19, lineHeight:1.15 }}>{shop.name}</div>
              <div style={{ fontSize:12.5, color:'rgba(255,255,255,.85)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {shop.branch?`${shop.branch} · `:''}{shop.shopId?`${TH?'รหัส':'ID'} ${shop.shopId}`:(shop.cat||'')}</div>
            </div>
            <button onClick={()=>onGo('store')} title={TH?'ตั้งค่าร้าน':'Settings'} style={{ border:'none', cursor:'pointer', width:38, height:38, borderRadius:12, background:'rgba(255,255,255,.18)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{React.cloneElement(IC.edit,{size:19})}</button>
          </div>
          <div style={{ display:'flex', gap:9, marginTop:15 }}>
            {[[TH?'แพ็กเกจ':'Plan', planLabel],
              [TH?'เหลืออีก':'Days left', daysLeft!=null?`${daysLeft} ${TH?'วัน':'d'}`:'—'],
              [TH?'สถานะ':'Status', (shop.isOpen?(TH?'● พร้อมขาย':'● Open'):(TH?'○ ปิดอยู่':'○ Closed'))]
            ].map(([k,v],i)=>(
              <div key={i} style={{ flex:1, background:'rgba(255,255,255,.14)', borderRadius:13, padding:'10px 12px' }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.8)' }}>{k}</div>
                <div className="num" style={{ fontSize:14.5, fontWeight:700, marginTop:3 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="kd-body" style={{ padding:'16px 16px 24px' }}>
        {/* onboarding checklist */}
        <div className="kd-card kd-fadein" style={{ padding:'16px 17px', marginBottom:15 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:700, fontSize:15.5 }}>{allDone?(TH?'ร้านพร้อมขายแล้ว 🎉':'You are all set 🎉'):(TH?'เริ่มเปิดร้าน':'Get your shop live')}</div>
            <span className="kd-chip">{doneN}/{steps.length}</span>
          </div>
          <div style={{ height:6, background:'var(--hair)', borderRadius:999, margin:'11px 0 6px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${doneN/steps.length*100}%`, background:'var(--brand)', borderRadius:999, transition:'width .35s' }}/>
          </div>
          {steps.map((st,i)=>(
            <div key={st.k} onClick={st.toggle||st.go} style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 0', borderBottom: i<steps.length-1?'1px solid var(--hair)':'none', cursor:'pointer' }}>
              <div style={{ width:27, height:27, borderRadius:999, flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13,
                background: st.done?'var(--brand)':'var(--bg)', color: st.done?'#fff':'var(--ink-3)', border: st.done?'none':'1.5px solid var(--hair-2)' }}>
                {st.done?React.cloneElement(IC.check,{size:15,stroke:2.6}):i+1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14.5, textDecoration: st.done?'line-through':'none', color: st.done?'var(--ink-3)':'var(--ink)' }}>{st.t}</div>
                <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:1 }}>{st.s}</div>
              </div>
              {st.auto
                ? (st.done ? null : <span style={{ color:'var(--brand-ink)', fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>{TH?'ไปทำ':'Do it'} ›</span>)
                : <Toggle on={st.done}/>}
            </div>
          ))}
        </div>

        {/* shop links */}
        <HomeLinks shop={shop} lang={lang}/>

        {/* ดีลจากร้านสปอนเซอร์ (ค้าส่ง/ของใช้/ของกิน) — ไฟล์ร่วม kd-sponsor-feed.jsx */}
        {window.KDSponsorFeed && <div style={{ marginBottom:15 }}>
          <window.KDSponsorFeed mod="pos" limit={4} title={TH?'🎁 ดีลใกล้ร้านคุณ':'🎁 Deals near you'}/>
        </div>}

        {/* plan / trial banner */}
        <button onClick={onUpgrade} className="kd-card" style={{ border:'none', cursor:'pointer', width:'100%', display:'flex', gap:12, alignItems:'center', padding:'14px 16px', fontFamily:'var(--font)', textAlign:'left',
          background: lowTrial?'#FDF0E2':(paid?'var(--brand-soft)':'#FDF7EC'), boxShadow:'none' }}>
          <div style={{ fontSize:24, flexShrink:0 }}>{paid?'⭐':(lowTrial?'⏳':'🚀')}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>
              {paid ? (TH?`แพ็กเกจ${planLabel} · เหลือ ${daysLeft} วัน`:`${planLabel} · ${daysLeft}d left`)
                    : (TH?`ทดลองใช้เหลือ ${daysLeft} วัน`:`${daysLeft} trial days left`)}</div>
            <div style={{ fontSize:12, color:'var(--ink-2)', marginTop:1 }}>{paid?(TH?'แตะเพื่อต่ออายุ / เปลี่ยนแพ็กเกจ':'Tap to renew / change plan'):(TH?'อัปเกรดก่อนหมดเพื่อขายต่อเนื่อง':'Upgrade to keep selling')}</div>
          </div>
          <span style={{ border:'none', background: lowTrial?'var(--danger)':'var(--brand)', color:'#fff', borderRadius:11, padding:'9px 14px', fontFamily:'var(--font)', fontWeight:700, fontSize:13, whiteSpace:'nowrap' }}>{paid?(TH?'ต่ออายุ':'Renew'):(TH?'อัปเกรด':'Upgrade')}</span>
        </button>

        {/* สื่อ & เครื่องมือร้าน (Rich menu / QR / จอคิว) — ท้ายสุด */}
        <ShopMediaLinks shop={shop} lang={lang}/>

        {/* ชวนเพื่อนมาใช้แอป */}
        <ReferFriend shop={shop} lang={lang}/>
      </div>
    </div>
  );
}

/* ── standalone onboarding checklist (แสดงบนหน้าตั้งค่าร้านจนกว่าจะครบ) ── */
function OnboardChecklist({ shop, setShop, menu, orders, sales, onGo, lang }){
  const TH = lang!=='en';
  const menuDone = (menu||[]).length>0;
  const billDone = (orders||[]).length>0 || (sales||[]).length>0;
  const shareDone = !!(shop && shop.tasks && shop.tasks.share);
  const setShareDone = (v)=> setShop && setShop(p=>({ ...p, tasks:{ ...(p.tasks||{}), share:v } }));
  const steps = [
    { k:'menu', done:menuDone, auto:true, go:()=>onGo&&onGo('store'),
      t:TH?'เพิ่มเมนู/สินค้า':'Add menu items', s:TH?'ใส่ชื่อ ราคา อย่างน้อย 1 รายการ (ด้านล่างหน้านี้)':'Add at least one item with price (below)' },
    { k:'bill', done:billDone, auto:true, go:()=>onGo&&onGo('sell'),
      t:TH?'เปิดบิลแรก':'Open your first bill', s:TH?'ลองคิดเงิน/ขาย 1 ครั้ง ให้ยอดเข้าระบบ':'Ring up one sale to see it flow in' },
    { k:'share', done:shareDone, auto:false, toggle:()=>setShareDone(!shareDone),
      t:TH?'แชร์ลิงก์ให้ลูกค้า':'Share your customer link', s:TH?'คัดลอกลิงก์ลูกค้า (การ์ดลิงก์ของร้านด้านล่าง) ส่งให้ลูกค้าสั่งเอง':'Copy the customer link below and send it to customers' },
  ];
  const doneN = steps.filter(s=>s.done).length;
  const allDone = doneN===steps.length;
  // ครบทุกขั้น + มีบิลจริงแล้ว → ร้านตั้งต้นเสร็จ ซ่อนถาวร (ไม่รกหน้าตั้งค่า)
  const [hidden,setHidden] = hState(()=>{ try{ return localStorage.getItem('kd_onboard_hide')==='1'; }catch(e){ return false; } });
  if(hidden) return null;
  return (
    <div className="kd-card kd-fadein" style={{ padding:'16px 17px', marginBottom:15 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontWeight:700, fontSize:15.5 }}>{allDone?(TH?'ร้านพร้อมขายแล้ว 🎉':'You are all set 🎉'):(TH?'เริ่มเปิดร้านใน 3 ขั้น':'Get your shop live in 3 steps')}</div>
        {allDone ? <button onClick={()=>{ try{ localStorage.setItem('kd_onboard_hide','1'); }catch(e){} setHidden(true); }} style={{ border:'none', background:'var(--bg)', color:'var(--ink-3)', borderRadius:999, padding:'4px 11px', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, cursor:'pointer' }}>{TH?'ซ่อน':'Dismiss'}</button>
          : <span className="kd-chip">{doneN}/{steps.length}</span>}
      </div>
      <div style={{ height:6, background:'var(--hair)', borderRadius:999, margin:'11px 0 6px', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${doneN/steps.length*100}%`, background:'var(--brand)', borderRadius:999, transition:'width .35s' }}/>
      </div>
      {steps.map((st,i)=>(
        <div key={st.k} onClick={st.toggle||st.go} style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 0', borderBottom: i<steps.length-1?'1px solid var(--hair)':'none', cursor:'pointer' }}>
          <div style={{ width:27, height:27, borderRadius:999, flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13,
            background: st.done?'var(--brand)':'var(--bg)', color: st.done?'#fff':'var(--ink-3)', border: st.done?'none':'1.5px solid var(--hair-2)' }}>
            {st.done?React.cloneElement(IC.check,{size:15,stroke:2.6}):i+1}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14.5, textDecoration: st.done?'line-through':'none', color: st.done?'var(--ink-3)':'var(--ink)' }}>{st.t}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:1, lineHeight:1.4 }}>{st.s}</div>
          </div>
          {st.auto
            ? (st.done ? null : <span style={{ color:'var(--brand-ink)', fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>{TH?'ไปทำ':'Do it'} ›</span>)
            : <Toggle on={st.done}/>}
        </div>
      ))}
    </div>
  );
}

/* ── advance expiry reminder — shows once/day when ≤3 days left (urgent at ≤1) ── */
function ExpiryReminder({ sub, lang, onUpgrade }){
  const TH = lang!=='en';
  const daysLeft = (sub&&sub.expiry) ? Math.ceil((new Date(sub.expiry)-Date.now())/864e5) : null;
  const active = daysLeft!=null && daysLeft<=5;
  const today = new Date().toISOString().slice(0,10);
  const KEY = 'kd_exp_warn_'+today;
  const [open,setOpen] = hState(()=>{ if(!active) return false; try{ return !localStorage.getItem(KEY); }catch(e){ return true; } });
  if(!open || !active) return null;
  const close=()=>{ try{ localStorage.setItem(KEY,'1'); }catch(e){} setOpen(false); };
  const urgent = daysLeft<=1;
  const title = daysLeft<0 ? (TH?'แพ็กเกจหมดอายุแล้ว':'Your plan has expired')
    : daysLeft===0 ? (TH?'แพ็กเกจหมดอายุวันนี้':'Your plan expires today')
    : (TH?`แพ็กเกจเหลืออีก ${daysLeft} วัน`:`${daysLeft} days left on your plan`);
  const body = daysLeft<0
    ? (TH?'ต่ออายุเพื่อกลับมาใช้ออเดอร์ รายงาน และสต๊อกได้เต็มรูปแบบ':'Renew to unlock orders, reports and stock again.')
    : (TH?'ต่ออายุก่อนหมดเพื่อขายต่อเนื่อง ไม่สะดุด':'Renew before it ends so selling never stops.');
  return (
    <div onClick={close} style={{ position:'absolute', inset:0, zIndex:9500, background:'rgba(15,30,25,.5)', display:'flex', alignItems:'flex-end' }}>
      <div className="kd-slideup kd-card" onClick={e=>e.stopPropagation()} style={{ width:'100%', borderRadius:'22px 22px 0 0', padding:'24px 22px calc(20px + env(safe-area-inset-bottom))' }}>
        <div style={{ width:64, height:64, borderRadius:18, margin:'0 auto 14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32,
          background: urgent?'#FDECE7':'#FDF7EC' }}>{urgent?'⏰':'⏳'}</div>
        <div style={{ textAlign:'center', fontSize:19, fontWeight:700 }}>{title}</div>
        <div style={{ textAlign:'center', fontSize:13.5, color:'var(--ink-2)', marginTop:8, lineHeight:1.55 }}>{body}</div>
        <div style={{ background:'var(--brand-soft)', color:'var(--brand-ink)', borderRadius:12, padding:'11px 13px', marginTop:14, fontSize:12.5, fontWeight:600, lineHeight:1.5, textAlign:'center' }}>🎁 {TH?'ต่อตอนนี้ ลด 50% เดือนแรก · หรือจ่ายรายปี จ่าย 10 เดือน ใช้ครบ 12 เดือน':'Renew now: 50% off your first month · or pay yearly, get 12 months for the price of 10'}</div>
        <button className="kd-btn kd-btn-primary kd-btn-block" style={{ marginTop:20 }} onClick={()=>{ close(); onUpgrade&&onUpgrade(); }}>{TH?'ต่ออายุ / เลือกแพ็กเกจ':'Renew / choose a plan'}</button>
        <button className="kd-btn kd-btn-block" style={{ marginTop:9, background:'none', color:'var(--ink-3)' }} onClick={close}>{TH?'ไว้ทีหลัง':'Later'}</button>
      </div>
    </div>
  );
}

/* ── order-arrival chime (WebAudio, no asset) + on/off, persisted ── */
let _kdAC = null;
function kdAudioCtx(){ try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null; if(!_kdAC) _kdAC=new AC(); if(_kdAC.state==='suspended') _kdAC.resume(); return _kdAC; }catch(e){ return null; } }
function kdUnlockAudio(){ kdAudioCtx(); }
function kdPlayChime(){
  const ac = kdAudioCtx(); if(!ac) return;
  const now = ac.currentTime;
  [[880,0],[1174.7,0.14],[1567.98,0.28]].forEach(([f,t])=>{
    const o=ac.createOscillator(), g=ac.createGain();
    o.type='sine'; o.frequency.value=f; o.connect(g); g.connect(ac.destination);
    const s=now+t; g.gain.setValueAtTime(0.0001,s); g.gain.linearRampToValueAtTime(0.3,s+0.02); g.gain.exponentialRampToValueAtTime(0.0001,s+0.38);
    o.start(s); o.stop(s+0.42);
  });
}
// เสียง "เรียกเก็บเงินสด" — ต่างจากเสียงออเดอร์ (ดับเบิ้ลบี๊ปต่ำซ้ำ 3 ครั้ง)
function kdPlayCashChime(){
  const ac = kdAudioCtx(); if(!ac) return; const now = ac.currentTime;
  [0,0.22,0.44].forEach(t=>{ const o=ac.createOscillator(), g=ac.createGain(); o.type='square'; o.frequency.value=523.25; o.connect(g); g.connect(ac.destination);
    const s=now+t; g.gain.setValueAtTime(0.0001,s); g.gain.linearRampToValueAtTime(0.25,s+0.02); g.gain.exponentialRampToValueAtTime(0.0001,s+0.18); o.start(s); o.stop(s+0.2); });
}
// ดังเมื่อมีออเดอร์กด “เรียกเก็บเงินสด” ใหม่ (ติด callCashAt) → เด้ง callback + เสียง
function useCashCallChime(orders, enabled, onCall){
  const seenC = React.useRef(null);
  React.useEffect(()=>{
    const calls = (orders||[]).filter(o=>o.callCash && !o.paid).map(o=>o.id+':'+(o.callCashAt||1));
    if(seenC.current===null){ seenC.current=new Set(calls); return; }
    let fresh=null; calls.forEach(c=>{ if(!seenC.current.has(c)) fresh=c; });
    seenC.current=new Set(calls);
    if(fresh){ if(enabled) kdPlayCashChime(); if(onCall) onCall(fresh.split(':')[0]); }
  }, [orders, enabled]);
}
// beep when a NEW order id appears (skips the first mount so seed orders stay silent)
function useOrderChime(orders, enabled){
  const seen = React.useRef(null);
  React.useEffect(()=>{
    const ids = (orders||[]).filter(o=>o.status==='new').map(o=>o.id);
    if(seen.current===null){ seen.current=new Set(ids); return; }
    let fresh=false; ids.forEach(id=>{ if(!seen.current.has(id)) fresh=true; });
    seen.current=new Set(ids);
    if(fresh && enabled) kdPlayChime();
  }, [orders, enabled]);
}

Object.assign(window, { HomeScreen, HomeLinks, ShopMediaLinks, ModuleToolsSheet, QrSheet, InAppDoc, ReferFriend, OnboardChecklist, ExpiryReminder, kdPlayChime, kdPlayCashChime, kdUnlockAudio, useOrderChime, useCashCallChime });
