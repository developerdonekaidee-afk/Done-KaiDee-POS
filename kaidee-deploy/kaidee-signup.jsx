// kaidee-signup.jsx — หน้าสมัครร้าน self-service (ร้านกรอกเอง ได้ลิงก์เอง)
const { useState:sState } = React;

const LIFF_ID = '2010720123-HXe3iZJD';   // LIFF app กลาง (หน้าสั่งอาหารของลูกค้า)
const EMOJIS = ['🍳','🍜','🍚','🍔','☕','🍰','🍕','🥤','🍗','🧋','🍤','🥗'];
const SHOP_TYPES = [
  { id:'food',    emoji:'🍜', th:'ร้านอาหาร / เครื่องดื่ม' },
  { id:'retail',  emoji:'🛍️', th:'ขายของ / หน้าร้าน' },
  { id:'online',  emoji:'📦', th:'ขายออนไลน์ / พรีออเดอร์' },
  { id:'service', emoji:'💇', th:'บริการ / ร้านนัด' },
  { id:'fitness', emoji:'🏋️', th:'ฟิตเนส / สตูดิโอ' },
];

// อ่านไฟล์รูป → ย่อเป็นสี่เหลี่ยม ~256px → คืน data URL (เก็บเล็ก ๆ ใน DB ได้)
function fileToLogo(file){
  return new Promise((resolve,reject)=>{
    const rd = new FileReader();
    rd.onerror = ()=> reject(new Error('อ่านไฟล์ไม่ได้'));
    rd.onload = ()=>{
      const img = new Image();
      img.onerror = ()=> reject(new Error('ไฟล์ไม่ใช่รูปภาพ'));
      img.onload = ()=>{
        const S = 256, c = document.createElement('canvas'); c.width=S; c.height=S;
        const ctx = c.getContext('2d');
        const m = Math.min(img.width, img.height);           // crop กลางเป็นสี่เหลี่ยม
        ctx.drawImage(img, (img.width-m)/2, (img.height-m)/2, m, m, 0, 0, S, S);
        resolve(c.toDataURL('image/jpeg', 0.82));            // ~15-30KB
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}

function Field({ label, hint, ...p }){
  return (
    <div>
      <label>{label}{hint && <span className="hint"> · {hint}</span>}</label>
      <input {...p}/>
    </div>
  );
}

function ShopSignup(){
  const [f,setF] = sState({ name:'', emoji:'🍳', logo:null, phone:'', promptpay:'', open:'08:00', close:'20:00', shopType:'food' });
  const [busy,setBusy] = sState(false);
  const [err,setErr] = sState('');
  const [done,setDone] = sState(null);   // { shopId }
  const set = (k,v)=> setF(s=>({ ...s, [k]:v }));
  const onLogo = async(e)=>{
    const file = e.target.files && e.target.files[0]; if(!file) return;
    try{ set('logo', await fileToLogo(file)); }catch(err){ setErr(err.message); }
  };

  const submit = async()=>{
    if(!f.name.trim()){ setErr('กรุณาใส่ชื่อร้าน'); return; }
    if(!f.promptpay.trim()){ setErr('กรุณาใส่เบอร์พร้อมเพย์ (เงินลูกค้าจะโอนเข้าบัญชีนี้)'); return; }
    setErr(''); setBusy(true);
    try{
      const r = await window.KD_API.registerShop({
        name:f.name.trim(), emoji:f.emoji, logo:f.logo||null, phone:f.phone.trim(), shopType:f.shopType,
        promptpayId:f.promptpay.replace(/[^0-9]/g,''), open:f.open, close:f.close,
      });
      if(r && r.shopId) setDone({ shopId:r.shopId, shopType:f.shopType });
      else setErr('สมัครไม่สำเร็จ ลองใหม่อีกครั้ง');
    }catch(e){ setErr('เชื่อมต่อไม่ได้: '+e.message); }
    setBusy(false);
  };

  if(done) return <Success shopId={done.shopId} shopType={done.shopType} shopName={f.name}/>;

  return (
    <div className="wrap">
      <div className="logo">
        <div className="logo-mark">🍽️</div>
        <div><div style={{ fontWeight:700, fontSize:17 }}>Have a Good Day POS</div>
          <div style={{ fontSize:12.5, color:'var(--brand-ink)', fontWeight:600 }}>ขายผ่าน LINE · รับเงินพร้อมเพย์</div></div>
      </div>
      <h1>สมัครร้านค้า</h1>
      <div className="sub">กรอกข้อมูลร้าน 1 นาที แล้วได้ลิงก์ + ขั้นตอนเปิดร้านบน LINE ทันที ฟรี ไม่มีค่าแรกเข้า</div>

      <div className="card">
        <Field label="ชื่อร้าน" placeholder="เช่น ครัวขายดี" value={f.name} onChange={e=>set('name',e.target.value)} maxLength={20}/>

        <label>ประเภทร้าน<span className="hint"> · เลือกให้ตรงเพื่อเปิดโมดูลที่ใช่</span></label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {SHOP_TYPES.map(t=>(
            <button key={t.id} type="button" onClick={()=>set('shopType',t.id)} style={{ display:'flex', alignItems:'center', gap:9, textAlign:'left', cursor:'pointer',
              border:'2px solid '+(f.shopType===t.id?'var(--brand)':'var(--hair-2,#e0e0e0)'), background:f.shopType===t.id?'var(--brand-soft)':'#fff',
              borderRadius:12, padding:'11px 12px', fontFamily:'var(--font)', fontSize:13.5, fontWeight:600, color:'var(--ink)' }}>
              <span style={{ fontSize:20 }}>{t.emoji}</span>{t.th}</button>
          ))}
        </div>
        {f.shopType==='fitness' && <div style={{ marginTop:8, background:'var(--brand-soft)', border:'1px solid var(--brand)', borderRadius:11, padding:'10px 12px', fontSize:12.5, color:'var(--brand-ink)', fontWeight:600, lineHeight:1.5 }}>🏋️ โหมดฟิตเนส: สมัครเสร็จได้โมดูลสมาชิก/เช็คอิน NFC/คลาส/PT ในแอปทันที (ปิดเดลิเวอรีอัตโนมัติ)</div>}

        <label>โลโก้ร้าน<span className="hint"> · อัปโหลดรูป หรือเลือก emoji · แนะนำ 512×512 px สี่เหลี่ยมจัตุรัส</span></label>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:64, height:64, borderRadius:16, flexShrink:0, overflow:'hidden',
            background:'var(--brand-soft)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32,
            backgroundImage: f.logo?`url(${f.logo})`:'none', backgroundSize:'cover', backgroundPosition:'center' }}>
            {!f.logo && f.emoji}</div>
          <label className="copy" style={{ background:'var(--brand)', padding:'10px 14px', cursor:'pointer', display:'inline-block' }}>
            เลือกรูปจากเครื่อง / ถ่ายรูป
            <input type="file" accept="image/*" onChange={onLogo} style={{ display:'none' }}/>
          </label>
          {f.logo && <button type="button" onClick={()=>set('logo',null)} style={{ border:'none', background:'none', color:'var(--ink-3)', cursor:'pointer', fontSize:13, fontWeight:600 }}>ลบรูป</button>}
        </div>

        <label>หรือเลือกไอคอน (ถ้าไม่อัปโหลดรูป)</label>
        <div className="emoji-row">
          {EMOJIS.map(e=>(
            <button key={e} type="button" className={'emoji-btn'+(f.emoji===e&&!f.logo?' on':'')} onClick={()=>{ set('emoji',e); set('logo',null); }}>{e}</button>
          ))}
        </div>

        <Field label="เบอร์พร้อมเพย์" hint="เงินลูกค้าโอนเข้าตรงนี้" placeholder="0812345678"
          value={f.promptpay} onChange={e=>set('promptpay',e.target.value)} inputMode="numeric"/>

        <Field label="เบอร์โทรร้าน" hint="ไม่บังคับ" placeholder="0812345678"
          value={f.phone} onChange={e=>set('phone',e.target.value)} inputMode="numeric"/>

        <div className="row">
          <div><label>เปิด</label><input type="time" value={f.open} onChange={e=>set('open',e.target.value)}/></div>
          <div><label>ปิด</label><input type="time" value={f.close} onChange={e=>set('close',e.target.value)}/></div>
        </div>

        {err && <div className="err">{err}</div>}
        <button className="btn" onClick={submit} disabled={busy}>{busy?'กำลังสมัคร…':'สมัครร้าน — ฟรี'}</button>
      </div>

      <div style={{ textAlign:'center', fontSize:12.5, color:'var(--ink-3)' }}>
        เมนูอาหาร ตั้งค่าเพิ่มเติมได้ภายหลังในระบบหลังบ้าน
      </div>
    </div>
  );
}

function UrlRow({ url }){
  const [copied,setCopied] = sState(false);
  const copy = ()=>{ navigator.clipboard?.writeText(url).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),1500); }); };
  return (
    <div className="urlbox"><code>{url}</code>
      <button className="copy" onClick={copy}>{copied?'คัดลอกแล้ว':'คัดลอก'}</button></div>
  );
}

function Success({ shopId, shopName, shopType }){
  const origin = location.origin + location.pathname.replace(/[^/]*$/, '');
  const customerUrl = `https://liff.line.me/${LIFF_ID}?shop=${shopId}`;
  const posUrl = `${origin}?shop=${shopId}`;
  const isFit = shopType==='fitness';
  return (
    <div className="wrap">
      <div className="ok-badge">✓</div>
      <h1 style={{ textAlign:'center' }}>สมัครสำเร็จ!</h1>
      <div className="sub" style={{ textAlign:'center' }}>ร้าน <b style={{ color:'var(--ink)' }}>{shopName}</b> พร้อมใช้งานแล้ว · รหัสร้าน <code style={{ fontFamily:'var(--mono)' }}>{shopId}</code></div>

      <div className="card">
        <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>🔗 ลิงก์ของร้านคุณ</div>
        <label style={{ marginTop:8 }}>ลิงก์ให้ลูกค้าสั่งอาหาร (ใช้ทำ Rich menu / โพสต์)</label>
        <UrlRow url={customerUrl}/>
        <label>ลิงก์หลังบ้าน (แม่ค้า/ครัว ดูออเดอร์ · เก็บไว้ส่วนตัว)</label>
        <UrlRow url={posUrl}/>
      </div>

      {isFit && <div className="card" style={{ border:'2px solid var(--brand)' }}>
        <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>🏋️ โมดูลฟิตเนสของคุณ</div>
        <div style={{ fontSize:12.5, color:'var(--ink-3)', marginBottom:12, lineHeight:1.5 }}>สมาชิก/ต่ออายุ · เช็คอิน NFC · คลาส · PT · ขายแพ็ก/สินค้า — ทำงานจริงในแอป</div>
        <a href={origin+'Fitness POS.html'}><button className="btn">เปิดโมดูลฟิตเนส (POS ในแอป) →</button></a>
        <a href={origin+'Fitness NFC Card.html?name='+encodeURIComponent(shopName||'')} style={{ display:'block', textAlign:'center', marginTop:10, fontSize:13, fontWeight:600, color:'var(--brand-ink)' }}>🪜 ทำป้าย NFC เช็คอิน (ปริ้นท์/ดาวโหลด)</a>
      </div>}

      <div className="card">
        <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>📱 เปิดร้านบน LINE (ทำครั้งเดียว ~5 นาที)</div>
        <div className="step"><div className="step-n">1</div><div className="step-b">
          สร้าง <b>LINE Official Account</b> ของร้าน (ฟรี) ที่ <a href="https://manager.line.biz" target="_blank">manager.line.biz</a></div></div>
        <div className="step"><div className="step-n">2</div><div className="step-b">
          ในเมนู <b>Rich menus</b> → สร้างใหม่ → ปุ่ม action = <b>Link</b> → วาง <b>ลิงก์ให้ลูกค้าสั่งอาหาร</b> ด้านบน</div></div>
        <div className="step"><div className="step-n">3</div><div className="step-b">
          บันทึก + เปิดใช้งาน → ลูกค้าที่แอดเพื่อนร้าน กดปุ่มสั่งอาหารได้ทันที 🎉</div></div>
        <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:6, lineHeight:1.5 }}>
          เงินลูกค้าโอนเข้าพร้อมเพย์ของร้านโดยตรง · แก้เบอร์/เมนู/ราคาได้ที่ลิงก์หลังบ้าน (แท็บ ร้านค้า)</div>
      </div>

      <a href={posUrl}><button className="btn">เข้าระบบหลังบ้านร้าน →</button></a>
    </div>
  );
}

Object.assign(window, { ShopSignup });
