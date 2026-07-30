// kaidee-crm.jsx — หน้า CRM ร้านค้า: แลนดิ้ง → สมัคร → สำเร็จ (ต่อเข้า merchant)
const { useState:cState } = React;
const CRM_EMOJIS = ['🍳','🍜','🍚','🍔','☕','🍰','🍕','🥤','🍗','🧋','🍤','🥗'];
const CRM_CATS = ['อาหารตามสั่ง','เครื่องดื่ม/คาเฟ่','ก๋วยเตี๋ยว','ของหวาน','ตามสั่ง+เดลิเวอรี','อื่น ๆ'];
// ประเภทธุรกิจ (vertical) — เลือกก่อนสมัคร · ล็อกในหน้าสมัคร (ย้อนกลับมาเปลี่ยนได้) · food types ใช้เป็นหมวดเมนูตั้งต้นเลย
const CRM_VERTICALS = [
  { id:'food',    emoji:'🍜', th:'ร้านอาหาร / ตามสั่ง', s:'ข้าว กับข้าว ตามสั่ง', catKey:'อาหารตามสั่ง' },
  { id:'cafe',    emoji:'☕', th:'คาเฟ่ / เครื่องดื่ม', s:'กาแฟ ชา น้ำปั่น เบเกอรี', catKey:'เครื่องดื่ม/คาเฟ่' },
  { id:'noodle',  emoji:'🍲', th:'ก๋วยเตี๋ยว / เส้น', s:'ก๋วยเตี๋ยว บะหมี่ เย็นตาโฟ', catKey:'ก๋วยเตี๋ยว' },
  { id:'sweet',   emoji:'🍰', th:'ของหวาน / เบเกอรี', s:'ขนม ไอศกรีม น้ำแข็งไส', catKey:'ของหวาน' },
  { id:'fitness', emoji:'🏋️', th:'ฟิตเนส / สตูดิโอ', s:'สมาชิก · เช็คอิน · คลาส · PT', catKey:'fitness' },
  { id:'laborwin', emoji:'🎚️', th:'วินแรงงาน (Labor Win)', s:'เรียกงาน · คิว · แรงงานต่างด้าว', catKey:'วินแรงงาน' },
  { id:'sponsor',  emoji:'📣', th:'แบรนด์ / สปอนเซอร์', s:'ลงโฆษณา + เปิดร้านขายของในระบบ', catKey:'สปอนเซอร์' },
  { id:'other',   emoji:'➕', th:'อื่น ๆ / พิมพ์เอง', s:'ร้านบริการ ขายของ หรือธุรกิจอื่น', catKey:'อื่น ๆ' },
];
// โมดูลฟิตเนส — ล็อกตายตัว (ปิดเดลิเวอรี/ไรเดอร์อัตโนมัติ · เปลี่ยนประเภทไม่ได้)
const FIT_FEATURES = { orders:false, delivery:false, riders:false, members:true, checkin:true, classes:true, pt:true, stock:true, reports:true, fitness:true };
// โมดูล Labor Win — ล็อกเหลือ 4 เมนู: หน้าขาย(เรียกงาน)=orders · รายรับรายจ่าย=reports · หน้าสมาชิก(ทะเบียนแรงงาน)=members · หน้าที่เพิ่ม=settings
const LABOR_FEATURES = { orders:true, delivery:false, riders:false, members:true, checkin:false, classes:false, pt:false, stock:false, reports:true, laborwin:true };
// โมดูลสปอนเซอร์ — ฝังศูนย์จัดการสปอนเซอร์ (ร้านออนไลน์ + โฆษณา) — ไม่ใช้เอนจิน POS อาหาร
const SPONSOR_FEATURES = { orders:false, delivery:false, riders:false, members:false, checkin:false, classes:false, pt:false, stock:false, reports:false, sponsor:true };
// อ่านลิสต์ประเภทที่แอดมินตั้งใน Back Office (localStorage ร่วม origin) · ต่อท้าย "อื่น ๆ" เสมอ
function loadShopCats(){ try{ const a=JSON.parse(localStorage.getItem('kaidee_shop_cats_v1')); if(Array.isArray(a)&&a.length) return [...a.filter(x=>x!=='อื่น ๆ'),'อื่น ๆ']; }catch(e){} return CRM_CATS; }

// เมนูตั้งต้นตามประเภทร้าน (ร้านแก้ราคา/ชื่อ/ลบได้) — cat ตรงกับ CATS: savory/noodle/sweet/drink
const CRM_STARTER = {
  'อาหารตามสั่ง':[['savory','ข้าวกะเพราไก่ไข่ดาว','Basil Chicken & Egg',60,28],['savory','ข้าวผัดหมู','Pork Fried Rice',55,25],['savory','ข้าวไข่เจียว','Omelette Rice',45,18],['savory','ข้าวหมูกระเทียม','Garlic Pork Rice',60,27]],
  'เครื่องดื่ม/คาเฟ่':[['drink','อเมริกาโน่ (ร้อน/เย็น)','Americano',45,15],['drink','ลาเต้','Latte',55,20],['drink','ชาไทยเย็น','Thai Iced Tea',40,14],['drink','ชานมไข่มุก','Bubble Milk Tea',55,22]],
  'ก๋วยเตี๋ยว':[['noodle','ก๋วยเตี๋ยวต้มยำ','Tom Yum Noodles',55,25],['noodle','ก๋วยเตี๋ยวน้ำใส','Clear Soup Noodles',50,22],['noodle','เย็นตาโฟ','Yen Ta Fo',60,28],['noodle','บะหมี่แห้ง','Dry Egg Noodles',55,24]],
  'ของหวาน':[['sweet','ข้าวเหนียวมะม่วง','Mango Sticky Rice',60,30],['sweet','บัวลอยไข่หวาน','Bua Loy',40,16],['sweet','น้ำแข็งไสนมสด','Shaved Ice',45,15],['sweet','ทับทิมกรอบ','Tub Tim Krob',45,18]],
  'ตามสั่ง+เดลิเวอรี':[['savory','ข้าวกะเพราไก่ไข่ดาว','Basil Chicken & Egg',60,28],['savory','ข้าวผัดหมู','Pork Fried Rice',55,25],['noodle','ผัดไทย','Pad Thai',60,28],['drink','ชาไทยเย็น','Thai Iced Tea',40,14]],
  'อื่น ๆ':[['savory','เมนูแนะนำ 1','Signature 1',50,20],['savory','เมนูแนะนำ 2','Signature 2',50,20],['drink','เครื่องดื่ม','Drink',35,12]],
};
const CRM_TONES = ['#F4E7D2','#EFE3CE','#F1E9D6','#F6DED4','#E3D3C4','#E6F2D9','#FBF0C9','#F7E3EC'];
function starterMenu(cat){
  const rows = CRM_STARTER[cat] || CRM_STARTER['อื่น ๆ'];
  return rows.map((r,i)=>({ id:'m'+Date.now()+i, cat:r[0], th:r[1], en:r[2], price:r[3], cost:r[4], tone:CRM_TONES[i%CRM_TONES.length], _starter:true }));
}

// อ่านรูป → crop กลางเป็นสี่เหลี่ยม ~256px → data URL เล็ก ๆ
function crmFileToLogo(file){
  return new Promise((res,rej)=>{ const rd=new FileReader();
    rd.onerror=()=>rej(new Error('อ่านไฟล์ไม่ได้'));
    rd.onload=()=>{ const img=new Image(); img.onerror=()=>rej(new Error('ไฟล์ไม่ใช่รูป'));
      img.onload=()=>{ const S=256,c=document.createElement('canvas'); c.width=S;c.height=S;
        const x=c.getContext('2d'),m=Math.min(img.width,img.height);
        x.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,S,S); res(c.toDataURL('image/jpeg',.82)); };
      img.src=rd.result; };
    rd.readAsDataURL(file); });
}

/* ══ แพ็กเกจ: จุดขายต่อ tier (เติมให้ข้อมูลจาก backend ที่อาจไม่มี tagline/feats) ══ */
const PKG_TIER_FEATS = {
  starter: { tagline:'ขายหน้าร้าน + ลูกค้าสั่งเอง', feats:['คิดเงิน + เปิดบิลหน้าร้าน','ลูกค้าสั่งเองผ่านมือถือ','สต๊อก + สรุปยอด–กำไร'] },
  shop:    { tagline:'หลายเครื่อง + เดลิเวอรี', feats:['ทุกอย่างในแพ็กเริ่มต้น','เดลิเวอรี Grab / LINE MAN / Shopee','กระทบยอดเดลิเวอรีอัตโนมัติ'] },
  pro:     { tagline:'Backoffice + หลายสาขา', feats:['ทุกอย่างในแพ็กร้านค้า','Backoffice บนจอคอม','รองรับหลายสาขา'] },
};
const PKG_FALLBACK = { trialDays:30, earlyBird:true,
  addon:{ consign:{ name:'ขายฝาก', monthly:129 } },
  packages:[
    {id:'starter',name:'เริ่มต้น',seats:1,monthly:99},
    {id:'shop',   name:'ร้านค้า', seats:3,monthly:299},
    {id:'pro',    name:'โปร',    seats:10,monthly:599},
  ] };
function _crmNormPkg(p){
  if(!p||typeof p!=='object') return PKG_FALLBACK;
  let packages = Array.isArray(p.packages) ? p.packages : null;
  if(!packages && p.shop){ packages=[   // legacy 2-tier → เติม starter ให้ครบ 3
    {id:'starter',name:'เริ่มต้น',seats:1,monthly:99},
    {id:'shop',name:p.shop.name||'ร้านค้า',seats:p.shop.seats||3,monthly:p.shop.price||p.shop.monthly||299},
    {id:'pro', name:(p.pro&&p.pro.name)||'โปร',seats:(p.pro&&p.pro.seats)||10,monthly:(p.pro&&(p.pro.price||p.pro.monthly))||599},
  ]; }
  if(!packages||!packages.length) packages=PKG_FALLBACK.packages;
  return { trialDays:p.trialDays||30, earlyBird:p.earlyBird!==false,
    addon:(p.addon&&p.addon.consign)?p.addon:PKG_FALLBACK.addon, packages };
}

/* ══ โควตาทดลอง + card-before-trial (กันลบร้านแล้วสมัครใหม่ใช้ฟรีวน · เก็บถาวรต่อเครื่อง · ไม่โดนลบตอนลบร้าน) ══ */
const TRIAL_LEDGER_KEY='kaidee_trial_ledger_v1';
function _trialLedger(){ try{ return JSON.parse(localStorage.getItem(TRIAL_LEDGER_KEY))||{}; }catch(e){ return {}; } }
function _trialKeys(phone,line){ const ks=[]; const p=String(phone||'').replace(/\D/g,''); if(p.length>=9)ks.push('p:'+p.slice(-10)); if(line)ks.push('l:'+line); return ks; }
function trialUsed(phone,line){ const L=_trialLedger(); return _trialKeys(phone,line).reduce((m,k)=>Math.max(m,(L[k]&&L[k].used)||0),0); }
function trialConsume(phone,line){ const L=_trialLedger(),now=Date.now(); _trialKeys(phone,line).forEach(k=>{ const e=L[k]||{used:0,firstAt:now}; e.used=(e.used||0)+1; e.lastAt=now; L[k]=e; }); try{ localStorage.setItem(TRIAL_LEDGER_KEY,JSON.stringify(L)); }catch(e){} }
function _pkgCfg(){ try{ return _crmNormPkg(JSON.parse(localStorage.getItem('kaidee_pkg_v1'))||{}); }catch(e){ return _crmNormPkg({}); } }
function trialQuota(){ try{ const pk=JSON.parse(localStorage.getItem('kaidee_pkg_v1')); if(pk&&pk.trialQuota!=null) return Math.max(0,pk.trialQuota); }catch(e){} return 1; }
function trialDaysCfg(){ return _pkgCfg().trialDays||30; }
function trialComp(phone,line){ const L=_trialLedger(); return _trialKeys(phone,line).some(k=>L[k]&&L[k].comp); }
function uatCodes(){ try{ const pk=JSON.parse(localStorage.getItem('kaidee_pkg_v1')); const a=pk&&pk.uatCodes; return Array.isArray(a)?a.map(x=>String(x).trim().toUpperCase()).filter(Boolean):[]; }catch(e){} return []; }

/* ══ PLAN GATE: เลือกแพ็ก + ผูกบัตรก่อนทดลอง (โควตาเหลือ=ทดลองฟรี · หมด=ต้องจ่าย) ══ */
function CrmPlanGate({ phone, line, vertical, onBack, onConfirm }){
  const cfg=_pkgCfg(); const pkgs=cfg.packages; const consign=cfg.addon&&cfg.addon.consign;
  const days=cfg.trialDays||30;
  const [srv,setSrv]=cState(null);   // โควตาจาก worker (ข้ามเครื่อง — กันลบร้านแล้วสมัครใหม่ฟรี)
  React.useEffect(()=>{ let ok=true; try{ if(window.KD_LIVE && window.KD_API && window.KD_API.trialCheck){ window.KD_API.trialCheck(phone,line).then(r=>{ if(ok&&r&&r.used!=null) setSrv(r); }).catch(()=>{}); } }catch(e){} return ()=>{ok=false;}; },[phone,line]);
  const quota=(srv&&srv.quota!=null)?srv.quota:trialQuota();
  const used=Math.max(trialUsed(phone,line),(srv&&srv.used)||0);
  const baseComp=trialComp(phone,line)||!!(srv&&srv.comp);
  const [pid,setPid]=cState(pkgs[1]?pkgs[1].id:pkgs[0].id);
  const [addC,setAddC]=cState(false);
  const [ok,setOk]=cState(false),[busy,setBusy]=cState(false),[err,setErr]=cState('');
  const [uat,setUat]=cState(''),[uatOn,setUatOn]=cState(false),[uatOk,setUatOk]=cState(false);
  const comp=baseComp||uatOk; const left=Math.max(0,quota-used); const freeOk=comp||left>0;
  const applyUat=()=>{ const codes=uatCodes(); if(uat.trim()&&codes.includes(uat.trim().toUpperCase())){ setUatOk(true); setErr(''); } else { setUatOk(false); setErr('รหัสทดสอบ (UAT) ไม่ถูกต้อง'); } };
  const pk=pkgs.find(p=>p.id===pid)||pkgs[0];
  const consignFee=(addC&&consign)?Number(consign.monthly||129):0;
  const monthly=Number(pk.monthly||0)+consignFee;
  const B=n=>'฿'+Number(n||0).toLocaleString('th-TH');
  const go=()=>{ if(!ok){ setErr('กรุณายอมรับข้อตกลง'); return; } setBusy(true);
    onConfirm({ id:pk.id, name:pk.name, monthly, addConsign:addC, trial:freeOk, comp, cardMasked:null }); };
  const flLabel={ display:'block', fontSize:13, fontWeight:700, color:'var(--ink-2)', margin:'16px 0 7px' };
  return (
    <div className="kd-screen">
      <div style={{flex:'0 0 auto',padding:'50px 16px 12px',display:'flex',alignItems:'center',gap:10}}>
        <button onClick={onBack} style={{background:'var(--brand-soft)',border:'none',color:'var(--brand-ink)',width:38,height:38,borderRadius:12,fontSize:18,cursor:'pointer'}}>←</button>
        <div><div style={{fontWeight:700,fontSize:18}}>เลือกแพ็กเกจ</div><div style={{fontSize:12,color:'var(--ink-3)'}}>{freeOk?`ทดลองฟรี ${days} วัน ก่อนเริ่มเก็บเงิน`:'เริ่มใช้งานแบบชำระเงิน'}</div></div>
      </div>
      <div className="kd-body"><div style={{padding:'6px 18px 30px'}}>
        {comp
          ? <div style={{background:'#E6F4EA',border:'1px solid #7FC59B',borderRadius:14,padding:'13px 15px',display:'flex',gap:11,alignItems:'flex-start'}}>
              <span style={{fontSize:22}}>♾️</span><div style={{flex:1}}><div style={{fontWeight:700,fontSize:14.5,color:'#1E7A46'}}>บัญชีทดสอบ (UAT) · ใช้ฟรีตลอดอายุการใช้งาน</div>
              <div style={{fontSize:12,color:'var(--ink-2)',marginTop:3,lineHeight:1.5}}>ไม่มีการเรียกเก็บเงิน ไม่ต้องผูกบัตร — สำหรับร้านที่ทดสอบระบบให้เรา</div></div>
            </div>
          : freeOk
          ? <div style={{background:'var(--brand-softer)',border:'1px solid var(--brand)',borderRadius:14,padding:'13px 15px',display:'flex',gap:11,alignItems:'flex-start'}}>
              <span style={{fontSize:22}}>🎁</span><div style={{flex:1}}><div style={{fontWeight:700,fontSize:14.5,color:'var(--brand-ink)'}}>ทดลองฟรี {days} วัน</div>
              <div style={{fontSize:12,color:'var(--ink-2)',marginTop:3,lineHeight:1.5}}><b>ไม่ต้องผูกบัตร</b> · เริ่มใช้ได้เลย ครบ {days} วันแล้วเติมเงินกระเป๋าที่เมนู “แพ็กเกจ” ในแอป · ยกเลิกได้ ไม่มีค่าใช้จ่าย{quota>1?` · เหลือสิทธิ์ทดลอง ${left}/${quota} ครั้ง`:''}</div></div>
            </div>
          : <div style={{background:'#FCEEEA',border:'1px solid #F3C6BB',borderRadius:14,padding:'13px 15px',display:'flex',gap:11,alignItems:'flex-start'}}>
              <span style={{fontSize:22}}>⛔</span><div style={{flex:1}}><div style={{fontWeight:700,fontSize:14.5,color:'var(--danger)'}}>บัญชีนี้ใช้สิทธิ์ทดลองครบแล้ว</div>
              <div style={{fontSize:12,color:'var(--ink-2)',marginTop:3,lineHeight:1.5}}>เบอร์/บัญชีนี้เคยทดลองครบ {used}/{quota} ครั้งแล้ว — เริ่มใช้งานต่อได้โดย <b>เลือกแพ็กแล้วเติมเงินกระเป๋า</b> ที่เมนู “แพ็กเกจ” ในแอป</div></div>
            </div>}
        <label style={flLabel}>เลือกแพ็กเกจ</label>
        <div style={{display:'flex',flexDirection:'column',gap:9}}>
          {pkgs.map(p=>{ const on=p.id===pid; return (
            <button key={p.id} onClick={()=>setPid(p.id)} style={{textAlign:'left',border:'1.8px solid '+(on?'var(--brand)':'var(--hair-2)'),background:on?'var(--brand-soft)':'#fff',borderRadius:14,padding:'13px 15px',cursor:'pointer',fontFamily:'var(--font)',display:'flex',alignItems:'center',gap:11}}>
              <span style={{width:22,height:22,borderRadius:999,flex:'0 0 auto',border:'2px solid '+(on?'var(--brand)':'var(--hair-2)'),background:on?'var(--brand)':'#fff',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:13,fontWeight:800}}>{on?'✓':''}</span>
              <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:15}}>{p.name} <span style={{fontWeight:500,fontSize:12,color:'var(--ink-3)'}}>· {p.seats||1} เครื่อง</span></div></div>
              <div style={{fontWeight:800,fontSize:15,color:'var(--brand-ink)',flex:'0 0 auto'}}>{B(p.monthly)}<span style={{fontSize:11,fontWeight:600,color:'var(--ink-3)'}}>/ด.</span></div>
            </button>); })}
        </div>
        {consign && <button onClick={()=>setAddC(v=>!v)} style={{width:'100%',textAlign:'left',marginTop:11,border:'1.6px solid '+(addC?'#9A6B2F':'var(--hair-2)'),background:addC?'#F6ECDD':'#fff',borderRadius:14,padding:'13px 15px',cursor:'pointer',fontFamily:'var(--font)',display:'flex',gap:11,alignItems:'center'}}>
          <span style={{fontSize:20}}>🤝</span>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>เสริม: ระบบขายฝาก</div><div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:2}}>รับ/ส่งของฝากขาย · เจ้าของสินค้า · เคลียร์เงิน</div></div>
          <div style={{fontWeight:700,fontSize:13.5,color:'#9A6B2F'}}>+{B(consign.monthly||129)}/ด.</div>
          <span style={{width:22,height:22,borderRadius:6,flex:'0 0 auto',border:'2px solid '+(addC?'#9A6B2F':'var(--hair-2)'),background:addC?'#9A6B2F':'#fff',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800}}>{addC?'✓':''}</span>
        </button>}
        {!uatOn ? <button onClick={()=>setUatOn(true)} style={{border:'none',background:'none',color:'var(--brand-ink)',fontWeight:700,fontSize:12.5,cursor:'pointer',marginTop:14,padding:0}}>มีรหัสทดสอบ (UAT)?</button>
          : <div style={{marginTop:14}}><label style={flLabel}>รหัสทดสอบ (UAT)</label><div style={{display:'flex',gap:8}}><input className="kd-input" value={uat} onChange={e=>{setUat(e.target.value);setUatOk(false);}} placeholder="เช่น UAT-2026"/><button className="kd-btn" style={{flex:'0 0 auto',padding:'0 16px',background:'var(--brand-soft)',color:'var(--brand-ink)'}} onClick={applyUat}>ใช้</button></div>{uatOk&&<div style={{fontSize:12,color:'#1E7A46',fontWeight:600,marginTop:6}}>✓ ยืนยันบัญชีทดสอบแล้ว — ใช้ฟรีตลอดอายุ</div>}</div>}
        {!comp && <div style={{marginTop:16,background:'var(--bg,#F6F7F6)',border:'1px solid var(--hair)',borderRadius:14,padding:'13px 15px'}}>
          <div style={{fontWeight:700,fontSize:13.5,display:'flex',alignItems:'center',gap:7}}><span>👛</span>การชำระเงิน</div>
          <div style={{fontSize:12,color:'var(--ink-2)',marginTop:5,lineHeight:1.6}}>• <b>ไม่ต้องผูกบัตรตอนสมัคร</b><br/>• ค่าบริการจ่ายด้วย <b>กระเป๋าเงินร้าน</b> — เติมเงินพร้อมเพย์ที่เมนู “แพ็กเกจ” ในแอป แล้วระบบหักจากกระเป๋าตามรอบ<br/>• บัตรเครดิต/เดบิต (ตัดอัตโนมัติ) <b>รองรับแล้ว · ยังไม่เปิดใช้</b></div>
        </div>}
        <label style={{display:'flex',gap:9,alignItems:'flex-start',marginTop:16,cursor:'pointer'}}>
          <input type="checkbox" checked={ok} onChange={e=>{setOk(e.target.checked);setErr('');}} style={{width:20,height:20,marginTop:1,flex:'0 0 auto',accentColor:'var(--brand)'}}/>
          <span style={{fontSize:12,color:'var(--ink-2)',lineHeight:1.5}}>{comp?`ฉันยืนยันเป็นบัญชีทดสอบ (UAT) — ใช้งานฟรีตลอดอายุการใช้งาน ไม่มีการเรียกเก็บเงิน`:(freeOk?`ฉันยอมรับข้อตกลงและเริ่มทดลองฟรี ${days} วัน · เมื่อครบกำหนด ค่าบริการ ${B(monthly)}/เดือน หักจากกระเป๋าเงินร้าน (เติมเงินที่เมนูแพ็กเกจ)`:`ฉันยอมรับข้อตกลง · ค่าบริการ ${B(monthly)}/เดือน ชำระโดยเติมเงินกระเป๋าร้านที่เมนูแพ็กเกจ`)} · ยกเลิกได้ทุกเมื่อในระบบหลังบ้าน</span>
        </label>
        {err&&<div style={{background:'#FCEEEA',color:'var(--danger)',borderRadius:12,padding:'11px 14px',fontSize:13.5,fontWeight:600,marginTop:14}}>{err}</div>}
      </div></div>
      <div style={{flex:'0 0 auto',padding:'11px 18px calc(11px + env(safe-area-inset-bottom))',background:'#fff',borderTop:'1px solid var(--hair)'}}>
        <button className="kd-btn kd-btn-primary kd-btn-block" disabled={busy} onClick={go}>{busy?'กำลังดำเนินการ…':(comp?'เริ่มใช้งาน (UAT · ฟรีตลอดชีพ)':(freeOk?`เริ่มทดลองฟรี ${days} วัน`:`เริ่มใช้งาน · ${B(monthly)}/เดือน`))}</button>
      </div>
    </div>
  );
}

/* ══ CRM LANDING (ยังไม่สมัคร) ══ */
function CrmLanding({ onSignup, onCancel, onEnter }){
  const [pkg,setPkg] = cState(PKG_FALLBACK);
  const [existing,setExisting] = cState(null);
  React.useEffect(()=>{ if(window.KD_API && window.KD_API.getPackages) window.KD_API.getPackages().then(p=>{ if(p) setPkg(_crmNormPkg(p)); }).catch(()=>{}); },[]);
  React.useEffect(()=>{
    let goSignup=false; try{ goSignup=new URLSearchParams(location.search).get('go')==='signup'; }catch(e){}
    if(!goSignup){ try{ const st=JSON.parse(localStorage.getItem('kaidee_pos_v1')||'{}'); if(st.shop&&st.shop.shopId){ setExisting(st.shop); return; } }catch(e){} }
    const lu=(typeof window!=='undefined'&&window.__lineUser)||null;
    if(lu&&lu.userId&&window.KD_API&&window.KD_API.getMyShop){ window.KD_API.getMyShop(lu.userId).then(sh=>{ const o=sh&&(sh.ownerLine||(sh.owner&&sh.owner.line)); if(sh&&sh.shopId&&o===lu.userId) setExisting(sh); }).catch(()=>{}); }
  },[]);
  const enterShop=()=>{ try{ if(existing&&existing.shopId) localStorage.setItem('kd_shop',existing.shopId); }catch(e){} onEnter&&onEnter('merchant'); };
  const feats = [
    {ic:'📲',bg:'var(--brand-soft)',c:'var(--brand)',t:'ระบบ LINE OA ครบชุด',s:'ร้านมีหน้าร้านบน LINE ลูกค้าแอดเพื่อน กดสั่ง จ่ายพร้อมเพย์ เงินเข้าบัญชีร้านตรง'},
    {ic:'📱',bg:'var(--accent-soft)',c:'var(--accent)',t:'สั่งออเดอร์ผ่านมือถือ',s:'ลูกค้าเปิดเมนู สั่งเอง จ่ายเอง จากมือถือ ไม่ต้องต่อคิว'},
    {ic:'🖥️',bg:'#EAF3EE',c:'var(--brand)',t:'หน้าจอแสดงคิว',s:'โชว์คิวแยกแต่ละช่องทางบนจอหน้าร้าน ลูกค้ารู้ว่าถึงคิวไหนแล้ว'},
    {ic:'🛵',bg:'#ECEEED',c:'var(--ink)',t:'ระบบไรเดอร์ร้านค้า',s:'มอบงานส่งให้ไรเดอร์ร้าน ติดตามสถานะ คิดค่าส่งอัตโนมัติ'},
    {ic:'🧾',bg:'#FDF0E2',c:'var(--gold)',t:'บันทึกขายได้หลายช่องทาง',s:'คีย์ยอด Grab / LINE MAN / ShopeeFood / หน้าร้าน รวมอยู่ในที่เดียว'},
    {ic:'📊',bg:'var(--accent-soft)',c:'var(--accent)',t:'รู้กำไร + คุมสต๊อก',s:'สรุปยอดขาย–ต้นทุน–กำไรรายวัน ตัดสต๊อกอัตโนมัติตามสูตร'},
  ];
  return (
    <div className="kd-screen">
      <div style={{flex:'0 0 auto',background:'var(--hero)',color:'#fff',padding:'54px 20px 26px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <div style={{width:34,height:34,borderRadius:10,background:'rgba(255,255,255,.22)',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="21" height="21" viewBox="0 0 100 100"><line x1="52" y1="26" x2="52" y2="74" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round"/><path d="M52 26 A25 24 0 0 1 52 74" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round"/><circle cx="32" cy="42" r="6" fill="#fff"/><circle cx="32" cy="58" r="6" fill="#fff"/></svg></div>
            <b style={{fontSize:15}}>KaiDee POS</b>
          </div>
          <button onClick={onCancel} style={{background:'rgba(255,255,255,.18)',border:'none',color:'#fff',borderRadius:999,padding:'6px 12px',fontFamily:'var(--font)',fontWeight:600,fontSize:12.5,cursor:'pointer'}}>← หน้าหลัก</button>
        </div>
        <div style={{fontSize:25,fontWeight:700,lineHeight:1.25,letterSpacing:'-.01em'}}>{existing?<>ยินดีต้อนรับกลับ<br/>{existing.name||'ร้านของคุณ'}</>:<>เปิดร้านขายของ<br/>บน LINE ใน 1 นาที</>}</div>
        <div style={{fontSize:14,opacity:.92,marginTop:10,lineHeight:1.5}}>{existing?'ร้านของคุณพร้อมใช้งานแล้ว แตะเข้าสู่ระบบเพื่อจัดการร้านและเปิดขาย':`ขายง่าย ได้กำไร รู้ทุกบาท — ไม่มีค่าแรกเข้า ทดลองฟรี ${pkg.trialDays} วัน`}</div>
        {!existing && <div style={{display:'flex',gap:8,marginTop:16}}>
          <span style={{background:'rgba(255,255,255,.16)',borderRadius:999,padding:'5px 12px',fontSize:12.5,fontWeight:600}}>✓ ไม่ต้องติดตั้ง</span>
          <span style={{background:'rgba(255,255,255,.16)',borderRadius:999,padding:'5px 12px',fontSize:12.5,fontWeight:600}}>✓ เริ่มขายวันนี้</span>
        </div>}
      </div>
      <div className="kd-body"><div style={{padding:'16px 18px 26px'}}>
        <div style={{textAlign:'center',fontSize:12.5,color:'var(--ink-3)',marginBottom:4}}>{existing?'ร้านของคุณ — แตะปุ่มด้านล่างเพื่อเข้าสู่ระบบ':'สมัครด้วย LINE ของคุณ · ไม่ต้องกรอกบัตร'}</div>

        <div className="kd-card" style={{padding:'6px 18px',marginTop:20}}>
          {feats.map((f,i)=>(<div key={i} style={{display:'flex',gap:13,alignItems:'flex-start',padding:'13px 0',borderBottom:i<feats.length-1?'1px solid var(--hair)':'none'}}>
            <div style={{width:42,height:42,borderRadius:12,flex:'0 0 auto',display:'flex',alignItems:'center',justifyContent:'center',fontSize:21,background:f.bg,color:f.c}}>{f.ic}</div>
            <div><div style={{fontWeight:700,fontSize:15}}>{f.t}</div><div style={{fontSize:13,color:'var(--ink-2)',marginTop:2,lineHeight:1.45}}>{f.s}</div></div>
          </div>))}
        </div>

        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',margin:'24px 0 4px'}}>
          <div style={{fontWeight:700,fontSize:16}}>แพ็กเกจ</div>
          <div style={{fontSize:12,color:'var(--ink-3)'}}>ยกเลิกได้ทุกเมื่อ · ไม่มีค่าแรกเข้า</div>
        </div>
        {pkg.earlyBird && <div style={{background:'var(--brand-soft)',color:'var(--brand-ink)',borderRadius:10,padding:'9px 12px',fontSize:12.5,fontWeight:600,lineHeight:1.45,margin:'8px 0 12px'}}>🔒 ราคายุคแรก — สมัครช่วงนี้ล็อกราคานี้ไว้ ใช้ต่อในราคาเดิมแม้ราคาปกติจะขึ้น</div>}
        <div style={{display:'flex',flexDirection:'column',gap:11}}>
          {pkg.packages.map((pk,i)=>{ const meta=PKG_TIER_FEATS[pk.id]||{}; const best = pk.id==='shop' || (i===1);
            return (<div key={pk.id||i} className="kd-card" style={{padding:'15px 16px',position:'relative',border:best?'2px solid var(--brand)':'1px solid var(--hair)'}}>
              {best && <span className="kd-chip" style={{position:'absolute',top:-10,right:14}}>แนะนำ</span>}
              <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:8}}>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:best?'var(--brand-ink)':'var(--ink)'}}>{pk.name}</div>
                  <div style={{fontSize:12,color:'var(--ink-3)',marginTop:1}}>{meta.tagline||''}</div>
                </div>
                <div style={{textAlign:'right',flex:'0 0 auto'}}>
                  <div style={{fontSize:22,fontWeight:700,lineHeight:1}}>฿{Number(pk.monthly||0).toLocaleString('th-TH')}<span style={{fontSize:12,color:'var(--ink-3)',fontWeight:500}}>/ด.</span></div>
                  <div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:2}}>{pk.seats} เครื่อง</div>
                </div>
              </div>
              {meta.feats && <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:5}}>
                {meta.feats.map((ft,j)=>(<div key={j} style={{display:'flex',gap:7,alignItems:'flex-start',fontSize:12.5,color:'var(--ink-2)'}}><span style={{color:'var(--brand)',fontWeight:700,flex:'0 0 auto'}}>✓</span><span style={{lineHeight:1.4}}>{ft}</span></div>))}
              </div>}
            </div>); })}
        </div>
        {pkg.addon && pkg.addon.consign && <div className="kd-card" style={{padding:'14px 16px',marginTop:12,display:'flex',gap:12,alignItems:'flex-start',background:'var(--accent-soft)',border:'1px dashed var(--accent)'}}>
          <div style={{width:40,height:40,borderRadius:11,flex:'0 0 auto',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,background:'#fff'}}>🤝</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:8}}>
              <div style={{fontWeight:700,fontSize:14}}>เสริม: ระบบขายฝาก</div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--accent)',flex:'0 0 auto'}}>+฿{Number(pkg.addon.consign.monthly||129).toLocaleString('th-TH')}/ด.</div>
            </div>
            <div style={{fontSize:12,color:'var(--ink-2)',marginTop:3,lineHeight:1.45}}>จัดการสินค้าฝากขาย · เจ้าของสินค้า · เคลียร์เงิน · ใบส่งของ — เปิดเสริมเมื่อไหร่ก็ได้ทุกแพ็ก</div>
          </div>
        </div>}
        <a href="https://line.me/R/ti/p/@188dfiog" target="_blank" rel="noopener" style={{textDecoration:'none',color:'inherit'}}>
          <div className="kd-card" style={{padding:'15px 16px',marginTop:20,display:'flex',gap:11,alignItems:'center'}}>
            <div style={{width:42,height:42,borderRadius:12,background:'#E5F7EC',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>💬</div>
            <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>มีคำถาม? คุยกับทีมงาน</div><div style={{fontSize:12.5,color:'var(--ink-3)'}}>ทักแชท LINE ตอบไว 9:00–20:00</div></div>
            <span style={{fontSize:13,fontWeight:700,color:'var(--line-green)'}}>แชท ›</span>
          </div>
        </a>
      </div></div>
      <div style={{flex:'0 0 auto',padding:'11px 18px calc(11px + env(safe-area-inset-bottom))',background:'#fff',borderTop:'1px solid var(--hair)'}}>
        <button className="kd-btn kd-btn-primary kd-btn-block" onClick={existing?enterShop:onSignup}>{existing?'เข้าสู่ระบบ · เข้าร้านของฉัน →':'สมัครทดลองฟรี →'}</button>
      </div>
    </div>
  );
}

/* ══ SIGNUP FORM ══ */
function CrmSignup({ onDone, onBack, vertical }){
  const vt = vertical || CRM_VERTICALS[0];
  const [f,setF] = cState(()=>({ name:'', emoji:'🍳', logo:null, promptpay:'', phone:'', open:'08:00', close:'20:00', cat: vt.catKey, catCustom:'' }));
  const [err,setErr] = cState('');
  const [busy,setBusy] = cState(false);
  const [accepted,setAccepted] = cState(false);
  const [gate,setGate] = cState(false);
  const set = (k,v)=> setF(s=>({ ...s, [k]:v }));
  const onLogo = async(e)=>{ const file=e.target.files&&e.target.files[0]; if(!file) return;
    try{ set('logo', await crmFileToLogo(file)); }catch(er){ setErr(er.message); } };
  const submit = async()=>{
    if(!f.name.trim()){ setErr('กรุณาใส่ชื่อร้าน'); return; }
    if(f.promptpay.replace(/\D/g,'').length<10){ setErr('กรุณาใส่เบอร์พร้อมเพย์ให้ครบ'); return; }
    if(!accepted){ setErr('กรุณาติ๊กยอมรับเงื่อนไขและนโยบายความเป็นส่วนตัวก่อนสมัคร'); return; }
    setErr(''); setBusy(true);
    const lu = (typeof window!=='undefined' && window.__lineUser) || null;
    const owner = lu ? { line:lu.userId, name:lu.name, avatar:lu.avatar } : null;
    // เปิดในแอป LINE แต่ยังไม่ล็อกอิน → ล็อกอินก่อน (กันสร้างร้านแบบไม่ผูกเจ้าของ = ภายหลังวนสมัครใหม่)
    try{ const lf=window.liff; if(!owner && lf && window.KD_LIFF && window.KD_LIFF.mode==='line' && lf.isInClient && lf.isInClient() && !lf.isLoggedIn()){ setBusy(false); lf.login(); return; } }catch(e){}
    // กันสมัครซ้ำ: ถ้า LINE นี้มีร้านอยู่แล้ว → เข้าร้านเดิม ไม่สร้างซ้ำ (ไม่กินโควตาทดลอง)
    if(owner && window.KD_API && window.KD_API.getMyShop){
      try{ const ex = await window.KD_API.getMyShop(owner.line);
        const exOwner = ex && (ex.ownerLine || (ex.owner&&ex.owner.line));
        if(ex && ex.shopId && exOwner && exOwner===owner.line){
          const tdx = trialDaysCfg(); const dx = new Date(); dx.setDate(dx.getDate()+tdx);
          setBusy(false);
          onDone({ shopId:ex.shopId, name:ex.name||f.name.trim(), emoji:ex.emoji||f.emoji, logo:f.logo, promptpay:ex.promptpay||f.promptpay,
            phone:ex.phone||f.phone, open:f.open, close:f.close, cat:(f.cat==='อื่น ๆ' && f.catCustom.trim())?f.catCustom.trim():f.cat, catKey:f.cat,
            expiry:ex.expiry||dx.toISOString(), owner, _existing:true, trial:true, plan:'trial', consent:{ acceptedAt:Date.now(), version:'2026-07-18' } });
          return;
        }
      }catch(e){}
    }
    setBusy(false); setGate(true);   // → เลือกแพ็ก & ผูกบัตร (card-before-trial · เช็คโควตาทดลอง)
  };
  // สร้างร้านจริงหลังผ่าน PlanGate (เลือกแพ็ก+บัตรแล้ว)
  const doCreate = async(plan)=>{
    setBusy(true);
    let shopId = 'S'+String(Math.floor(Math.random()*9000)+1000);
    const lu = (typeof window!=='undefined' && window.__lineUser) || null;
    const owner = lu ? { line:lu.userId, name:lu.name, avatar:lu.avatar } : null;
    try{
      if(window.KD_LIVE && window.KD_API && window.KD_API.registerShop){
        const r = await window.KD_API.registerShop({ name:f.name.trim(), emoji:f.emoji, logo:f.logo||null,
          phone:f.phone.trim(), promptpayId:f.promptpay.replace(/\D/g,''), open:f.open, close:f.close,
          ownerLine: owner?owner.line:null, ownerName: owner?owner.name:null });
        if(r && r.shopId) shopId = r.shopId;
        if(owner && owner.line && window.KD_API.welcomeShop){
          // ข้อความต้อนรับเข้าไลน์เจ้าของ = ข้อความล้วน ไม่แนบลิงก์ (กันติดชื่อ OA / ลิงก์สั่งอาหาร)
          window.KD_API.welcomeShop({ shopId, ownerLine:owner.line, name:f.name.trim() }).catch(()=>{});
        }
      }
    }catch(er){ /* ออฟไลน์/เดโม → ใช้ id สุ่มต่อไปได้ */ }
    const td = trialDaysCfg(); const d = new Date(); d.setDate(d.getDate()+(plan.comp?3650:(plan.trial?td:30)));
    if(plan.trial && !plan.comp){ trialConsume(f.promptpay, owner?owner.line:null); try{ if(window.KD_LIVE && window.KD_API && window.KD_API.trialConsume) window.KD_API.trialConsume(f.promptpay, owner?owner.line:null).catch(()=>{}); }catch(e){} }   // ตัดโควตาทดลอง (local + worker ข้ามเครื่อง · UAT/comp ไม่ตัด)
    const catFinal = (f.cat==='อื่น ๆ' && f.catCustom.trim()) ? f.catCustom.trim() : f.cat;
    onDone({ shopId, name:f.name.trim(), emoji:f.emoji, logo:f.logo, promptpay:f.promptpay,
      phone:f.phone, open:f.open, close:f.close, cat:catFinal, catKey:f.cat, expiry:d.toISOString(), owner,
      plan:plan.comp?'uat':plan.id, planName:plan.comp?'UAT · ตลอดชีพ':plan.name, monthly:plan.comp?0:plan.monthly, trial:plan.trial, comp:!!plan.comp, paid:!plan.trial&&!plan.comp, card:plan.cardMasked, addons:{ consign:!!plan.addConsign },
      consent:{ acceptedAt:Date.now(), version:'2026-07-18', billing:true } });
    setBusy(false);
  };
  const flLabel = { display:'block', fontSize:13, fontWeight:700, color:'var(--ink-2)', margin:'14px 0 6px' };
  if(gate) return <CrmPlanGate phone={f.promptpay} line={(typeof window!=='undefined'&&window.__lineUser&&window.__lineUser.userId)||null} vertical={vt} onBack={()=>setGate(false)} onConfirm={doCreate}/>;
  return (
    <div className="kd-screen">
      <div style={{flex:'0 0 auto',padding:'50px 16px 12px',display:'flex',alignItems:'center',gap:10}}>
        <button onClick={onBack} style={{background:'var(--brand-soft)',border:'none',color:'var(--brand-ink)',width:38,height:38,borderRadius:12,fontSize:18,cursor:'pointer'}}>←</button>
        <div><div style={{fontWeight:700,fontSize:18}}>สมัครร้านค้า</div><div style={{fontSize:12,color:'var(--ink-3)'}}>ใช้เวลา ~1 นาที</div></div>
      </div>
      <div className="kd-body"><div style={{padding:'6px 18px 30px'}}>
        <label style={flLabel}>ชื่อร้าน</label>
        <input className="kd-input" placeholder="เช่น ครัวขายดี" maxLength={22} value={f.name} onChange={e=>set('name',e.target.value)}/>

        <label style={flLabel}>โลโก้ร้าน <span style={{fontWeight:500,color:'var(--ink-3)'}}>· อัปโหลดรูป หรือเลือกไอคอน</span></label>
        <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:11}}>
          <div style={{width:60,height:60,borderRadius:16,flex:'0 0 auto',background:'var(--brand-soft)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,overflow:'hidden',backgroundImage:f.logo?`url(${f.logo})`:'none',backgroundSize:'cover',backgroundPosition:'center'}}>{!f.logo&&f.emoji}</div>
          <label className="kd-btn kd-btn-ghost" style={{cursor:'pointer',padding:'11px 14px',fontSize:14,width:'auto'}}>เลือกรูป<input type="file" accept="image/*" onChange={onLogo} style={{display:'none'}}/></label>
          {f.logo&&<button onClick={()=>set('logo',null)} style={{border:'none',background:'none',color:'var(--ink-3)',fontWeight:700,fontSize:13,cursor:'pointer'}}>ลบรูป</button>}
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:7}}>{CRM_EMOJIS.map(e=>(
          <button key={e} onClick={()=>{set('emoji',e);set('logo',null);}} style={{width:44,height:44,borderRadius:12,border:'1.6px solid '+(f.emoji===e&&!f.logo?'var(--brand)':'var(--hair-2)'),background:f.emoji===e&&!f.logo?'var(--brand-soft)':'#fff',fontSize:22,cursor:'pointer'}}>{e}</button>))}</div>

        <label style={flLabel}>ประเภทธุรกิจ</label>
        <div style={{display:'flex',alignItems:'center',gap:11,border:'1.6px solid var(--brand)',background:'var(--brand-soft)',borderRadius:13,padding:'12px 14px'}}>
          <span style={{fontSize:22}}>{vt.emoji}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14.5,color:'var(--brand-ink)'}}>{vt.th}</div>
            <div style={{fontSize:11.5,color:'var(--brand-ink)',opacity:.85,marginTop:1}}>{vt.id==='fitness'?'🔒 โมดูลฟิตเนส · เปลี่ยนประเภทไม่ได้หลังสมัคร':'แตะ “เปลี่ยน” เพื่อเลือกประเภทอื่น'}</div>
          </div>
          <button onClick={onBack} style={{border:'none',background:'#fff',color:'var(--brand-ink)',borderRadius:9,padding:'7px 12px',fontFamily:'var(--font)',fontWeight:700,fontSize:12.5,cursor:'pointer',flex:'0 0 auto'}}>เปลี่ยน</button>
        </div>
        {vt.id==='other' && <input className="kd-input" style={{marginTop:9}} placeholder="พิมพ์ประเภท/ชื่อธุรกิจของคุณ เช่น หมูกระทะ, ร้านขนมจีน" maxLength={30} value={f.catCustom} onChange={e=>set('catCustom',e.target.value)}/>}

        <label style={flLabel}>เบอร์พร้อมเพย์ <span style={{fontWeight:500,color:'var(--ink-3)'}}>· เงินลูกค้าโอนเข้าตรงนี้</span></label>
        <input className="kd-input num" inputMode="numeric" placeholder="0812345678" value={f.promptpay} onChange={e=>set('promptpay',e.target.value)}/>

        <label style={flLabel}>เบอร์โทรร้าน <span style={{fontWeight:500,color:'var(--ink-3)'}}>· ไม่บังคับ</span></label>
        <input className="kd-input num" inputMode="numeric" placeholder="0812345678" value={f.phone} onChange={e=>set('phone',e.target.value)}/>

        <div style={{display:'flex',gap:12}}>
          <div style={{flex:1}}><label style={flLabel}>เวลาเปิด</label><input className="kd-input" type="time" value={f.open} onChange={e=>set('open',e.target.value)}/></div>
          <div style={{flex:1}}><label style={flLabel}>เวลาปิด</label><input className="kd-input" type="time" value={f.close} onChange={e=>set('close',e.target.value)}/></div>
        </div>

        <label style={{display:'flex',gap:9,alignItems:'flex-start',marginTop:18,cursor:'pointer'}}>
          <input type="checkbox" checked={accepted} onChange={e=>{setAccepted(e.target.checked);setErr('');}} style={{width:20,height:20,marginTop:1,flex:'0 0 auto',accentColor:'var(--brand)'}}/>
          <span style={{fontSize:12.5,color:'var(--ink-2)',lineHeight:1.5}}>ฉันยอมรับ <a href="terms.html" target="_blank" rel="noopener" style={{color:'var(--brand-ink)',fontWeight:600}}>เงื่อนไขการใช้งาน</a> และ <a href="privacy.html" target="_blank" rel="noopener" style={{color:'var(--brand-ink)',fontWeight:600}}>นโยบายความเป็นส่วนตัว (PDPA)</a></span>
        </label>
        {err&&<div style={{background:'#FCEEEA',color:'var(--danger)',borderRadius:12,padding:'11px 14px',fontSize:13.5,fontWeight:600,marginTop:14}}>{err}</div>}
        <button className="kd-btn kd-btn-primary kd-btn-block" style={{marginTop:18}} onClick={submit} disabled={busy}>{busy?'กำลังสมัคร…':'ถัดไป — เลือกแพ็ก & ผูกบัตร'}</button>
        <div style={{textAlign:'center',fontSize:12,color:'var(--ink-3)',marginTop:10}}>เมนู/ราคาเพิ่มทีหลังในระบบหลังบ้านได้</div>
      </div></div>
    </div>
  );
}

/* ══ SUCCESS → เข้า merchant ══ */
function CrmSuccess({ shop, onEnter }){
  const [copied,setCopied] = cState('');
  const origin = location.origin + location.pathname.replace(/[^/]*$/, '');
  const custUrl = `https://liff.line.me/2010720123-HXe3iZJD?shop=${shop.shopId}`;
  const posUrl = `${origin}?shop=${shop.shopId}`;
  const riderUrl = `${origin}?shop=${shop.shopId}&role=rider`;
  const copy = (u,k)=>{ navigator.clipboard?.writeText(u); setCopied(k); setTimeout(()=>setCopied(''),1400); };
  const UrlRow = ({url,k,label,hint})=>(
    <div><div style={{fontSize:13,fontWeight:700,color:'var(--ink-2)',margin:'12px 0 6px'}}>{label} <span style={{fontWeight:500,color:'var(--ink-3)'}}>{hint}</span></div>
      <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--brand-softer)',border:'1px solid var(--hair-2)',borderRadius:12,padding:'9px 10px 9px 13px'}}>
        <code style={{flex:1,fontFamily:'var(--mono)',fontSize:11.5,color:'var(--brand-ink)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{url}</code>
        <button onClick={()=>copy(url,k)} style={{border:'none',background:'var(--brand)',color:'#fff',borderRadius:9,padding:'7px 11px',fontFamily:'var(--font)',fontWeight:700,fontSize:12,cursor:'pointer'}}>{copied===k?'คัดลอกแล้ว':'คัดลอก'}</button>
      </div></div>
  );
  const step = (n,txt)=>(<div style={{display:'flex',gap:12,alignItems:'flex-start',padding:'9px 0'}}>
    <div style={{width:26,height:26,borderRadius:999,background:'var(--brand)',color:'#fff',fontWeight:700,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flex:'0 0 auto'}}>{n}</div>
    <div style={{flex:1,fontSize:13.5,color:'var(--ink-2)',lineHeight:1.5}}>{txt}</div></div>);
  return (
    <div className="kd-screen">
      <div className="kd-body"><div style={{padding:'56px 20px 26px'}}>
        <div className="kd-pop" style={{width:70,height:70,borderRadius:999,background:'var(--brand)',color:'#fff',fontSize:34,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>✓</div>
        <div style={{textAlign:'center',fontSize:22,fontWeight:700}}>สมัครสำเร็จ!</div>
        <div style={{textAlign:'center',fontSize:13.5,color:'var(--ink-2)',marginTop:6}}>ร้าน <b style={{color:'var(--ink)'}}>{shop.name}</b> พร้อมใช้งานแล้ว · รหัส <code style={{fontFamily:'var(--mono)'}}>{shop.shopId}</code></div>

        <div className="kd-card" style={{padding:'16px 18px',marginTop:20}}>
          <div style={{fontWeight:700,fontSize:15.5}}>🔗 ลิงก์ของร้านคุณ</div>
          <UrlRow url={custUrl} k="c" label="ลิงก์ให้ลูกค้าสั่งอาหาร" hint="(ใส่ใน Rich menu / ส่งให้ลูกค้า)"/>
          <UrlRow url={posUrl} k="p" label="ลิงก์หลังบ้าน" hint="(แม่ค้า/ครัว เก็บส่วนตัว)"/>
          <UrlRow url={riderUrl} k="r" label="ลิงก์ทีมส่ง (ไรเดอร์)" hint="(ส่งให้คนส่ง)"/>
          <div style={{fontSize:12,color:'var(--ink-3)',marginTop:10,lineHeight:1.5,background:'var(--brand-softer)',borderRadius:10,padding:'9px 12px'}}>💡 แต่ละคนเห็นเฉพาะมุมของตัวเอง — ลูกค้าไม่เห็นหลังบ้าน/ไรเดอร์ · ส่งลิงก์ให้ถูกคนได้เลย</div>
        </div>

        {[['🎨','สร้าง Rich menu สำเร็จรูป (โหลดรูปใส่ LINE OA)',()=>window.open('richmenu-template.html?'+new URLSearchParams({name:shop.name||'',shop:shop.shopId||'',cust:custUrl}).toString(),'_blank','noopener')],['📱','QR โปสเตอร์ (ปริ้นท์ติดหน้าร้าน / ไรเดอร์)',()=>window.open('qr-poster.html?'+new URLSearchParams({name:shop.name||'',shop:shop.shopId||'',cust:custUrl,rider:riderUrl}).toString(),'_blank','noopener')]].map(([ic,l,fn],i)=>(
          <button key={i} onClick={fn} className="kd-card" style={{border:'none',cursor:'pointer',width:'100%',textAlign:'left',display:'flex',alignItems:'center',gap:12,padding:'15px 16px',marginTop:12,fontFamily:'var(--font)'}}>
            <span style={{fontSize:20}}>{ic}</span><span style={{flex:1,fontSize:15,fontWeight:700}}>{l}</span><span style={{color:'var(--ink-3)'}}>{IC.chev}</span>
          </button>
        ))}

        <div className="kd-card" style={{padding:'16px 18px',marginTop:16}}>
          <div style={{fontWeight:700,fontSize:15.5,marginBottom:4}}>📱 เปิดร้านบน LINE (~5 นาที)</div>
          {step(1,<span>สร้าง <b>LINE Official Account</b> ของร้าน (ฟรี) ที่ manager.line.biz</span>)}
          {step(2,<span>เมนู <b>Rich menus</b> → สร้าง → action <b>Link</b> → วางลิงก์ลูกค้าด้านบน</span>)}
          {step(3,<span>บันทึก + เปิดใช้งาน → ลูกค้ากดสั่งได้ทันที 🎉</span>)}
        </div>
      </div></div>
      <div style={{flex:'0 0 auto',padding:'11px 18px calc(11px + env(safe-area-inset-bottom))',background:'#fff',borderTop:'1px solid var(--hair)'}}>
        <button className="kd-btn kd-btn-primary kd-btn-block" onClick={onEnter}>เข้าจัดการร้าน →</button>
      </div>
    </div>
  );
}

/* ══ onboarding เฟรม 4 · เลือกเป้าหมายการขาย → ตั้ง shop.features (ซ่อน/โชว์แท็บตามที่เลือก) ══ */
function CrmChooser({ onDone, onBack }){
  const [sel,setSel] = cState({ orders:true, delivery:false, riders:false });
  const toggle=(k)=>setSel(s=>({ ...s, [k]:!s[k] }));
  const MODS = [
    { k:'orders', ic:'🛒', bg:'var(--brand-soft)', t:'ให้ลูกค้าสั่งเอง (มือถือ)', s:'ลูกค้าสแกน QR ที่โต๊ะ/โปสเตอร์ หรือเปิดลิงก์ — ไม่ต้องมี LINE OA ก็สั่งได้ · มี LINE OA ก็กดสั่งจากแชทได้ · ออเดอร์เด้งเข้าแอปคุณ' },
    { k:'delivery', ic:'🛵', bg:'#FDF0E2', t:'ขายผ่านเดลิเวอรี', s:'คีย์ยอด Grab / LINE MAN / ShopeeFood รวมในรายงานเดียว' },
    { k:'riders', ic:'📦', bg:'#ECEEED', t:'มีคนส่งของร้านเอง', s:'มอบงานส่งให้ไรเดอร์ร้าน ติดตามสถานะ คิดค่าส่ง' },
  ];
  return (
    <div className="kd-screen">
      <div style={{flex:'0 0 auto',background:'var(--hero)',color:'#fff',padding:'54px 20px 24px'}}>
        <button onClick={onBack} style={{background:'rgba(255,255,255,.18)',border:'none',color:'#fff',borderRadius:999,padding:'6px 12px',fontFamily:'var(--font)',fontWeight:600,fontSize:12.5,cursor:'pointer',marginBottom:14}}>← ย้อนกลับ</button>
        <div style={{fontSize:12.5,opacity:.9,fontWeight:600}}>ขั้นสุดท้าย · เกือบเสร็จแล้ว</div>
        <div style={{fontSize:24,fontWeight:700,lineHeight:1.25,marginTop:6}}>ร้านคุณอยากขายแบบไหน?</div>
        <div style={{fontSize:13.5,opacity:.92,marginTop:9,lineHeight:1.5}}>เลือกได้หลายข้อ · เปลี่ยนทีหลังได้เสมอที่ “ร้านค้า → ประเภทร้าน · ฟีเจอร์”</div>
      </div>
      <div className="kd-body"><div style={{padding:'16px 16px 26px'}}>
        <div style={{display:'flex',gap:12,alignItems:'center',background:'var(--brand-soft)',borderRadius:15,padding:'14px 15px'}}>
          <div style={{width:42,height:42,borderRadius:12,flex:'0 0 auto',display:'flex',alignItems:'center',justifyContent:'center',fontSize:21,background:'#fff'}}>🧾</div>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:15,color:'var(--brand-ink)'}}>ขายหน้าร้าน + สต๊อก + รายงาน</div><div style={{fontSize:12.5,color:'var(--brand-ink)',opacity:.8,marginTop:1}}>เปิดให้ทุกร้านอัตโนมัติ — เริ่มขายได้เลย</div></div>
          <span style={{fontSize:11,fontWeight:700,color:'#fff',background:'var(--brand)',padding:'4px 10px',borderRadius:999}}>เปิดอยู่</span>
        </div>
        <div style={{fontSize:12.5,fontWeight:700,color:'var(--ink-3)',margin:'18px 4px 9px'}}>เปิดเพิ่มได้ (เลือกได้หลายข้อ)</div>
        {MODS.map(m=>{ const on=!!sel[m.k]; return (
          <label key={m.k} onClick={()=>toggle(m.k)} style={{display:'flex',gap:12,alignItems:'flex-start',background:'#fff',border:on?'2px solid var(--brand)':'1.5px solid var(--hair-2)',borderRadius:15,padding:'14px 15px',cursor:'pointer',marginBottom:11,boxShadow:on?'0 4px 16px rgba(14,156,136,.12)':'none'}}>
            <div style={{width:42,height:42,borderRadius:12,flex:'0 0 auto',display:'flex',alignItems:'center',justifyContent:'center',fontSize:21,background:m.bg}}>{m.ic}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:15}}>{m.t}</div><div style={{fontSize:12.5,color:'var(--ink-2)',marginTop:2,lineHeight:1.45}}>{m.s}</div></div>
            <div style={{width:26,height:26,borderRadius:8,flex:'0 0 auto',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:15,background:on?'var(--brand)':'transparent',border:on?'none':'2px solid var(--hair-2)'}}>{on?'✓':''}</div>
          </label>
        );})}
        <div style={{background:'var(--brand-softer,#EFFAF7)',border:'1px solid var(--hair)',borderRadius:13,padding:'12px 13px',display:'flex',gap:9,alignItems:'flex-start',marginTop:4}}>
          <span style={{fontSize:16}}>💡</span>
          <div style={{fontSize:12,color:'var(--brand-ink)',lineHeight:1.5}}>ไม่ต้องรีบตัดสินใจ — โมดูลที่ไม่ได้เปิดจะซ่อนไว้ ไม่รกหน้าจอ เปิดเพิ่มได้ทุกเมื่อที่ “ร้านค้า”</div>
        </div>
        <button onClick={()=>onDone({ orders:!!sel.orders, delivery:!!sel.delivery, riders:!!sel.riders })} className="kd-btn kd-btn-primary kd-btn-block" style={{marginTop:16,padding:15,fontSize:15}}>เข้าร้านของฉัน →</button>
      </div></div>
    </div>
  );
}

/* ══ STEP 0 · เลือกประเภทธุรกิจ (vertical) — ก่อนสมัคร ══ */
function CrmVertical({ onPick, onBack }){
  const [sel,setSel] = cState(null);
  return (
    <div className="kd-screen">
      <div style={{flex:'0 0 auto',background:'var(--hero)',color:'#fff',padding:'54px 20px 24px'}}>
        <button onClick={onBack} style={{background:'rgba(255,255,255,.18)',border:'none',color:'#fff',borderRadius:999,padding:'6px 12px',fontFamily:'var(--font)',fontWeight:600,fontSize:12.5,cursor:'pointer',marginBottom:14}}>← ย้อนกลับ</button>
        <div style={{fontSize:12.5,opacity:.9,fontWeight:600}}>ขั้นที่ 1 · เลือกประเภทธุรกิจ</div>
        <div style={{fontSize:24,fontWeight:700,lineHeight:1.25,marginTop:6}}>ร้านคุณเป็นธุรกิจแบบไหน?</div>
        <div style={{fontSize:13.5,opacity:.92,marginTop:9,lineHeight:1.5}}>ระบบจะเปิดโมดูล + เมนูตั้งต้นให้ตรงประเภท — เลือกได้ข้อเดียว</div>
      </div>
      <div className="kd-body"><div style={{padding:'16px 16px 26px'}}>
        {CRM_VERTICALS.filter(v=>v.id!=='fitness'&&v.id!=='laborwin').map(v=>{ const on=sel===v.id; const fit=v.id==='fitness'; return (
          <button key={v.id} onClick={()=>setSel(v.id)} style={{width:'100%',textAlign:'left',display:'flex',gap:13,alignItems:'center',background:'#fff',border:on?'2px solid var(--brand)':'1.5px solid var(--hair-2)',borderRadius:15,padding:'14px 15px',cursor:'pointer',marginBottom:11,fontFamily:'var(--font)',boxShadow:on?'0 4px 16px rgba(14,156,136,.12)':'none'}}>
            <div style={{width:46,height:46,borderRadius:13,flex:'0 0 auto',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,background:fit?'#EAF3F1':'var(--brand-soft)'}}>{v.emoji}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:15.5,display:'flex',alignItems:'center',gap:7}}>{v.th}{fit&&<span style={{fontSize:10,fontWeight:700,color:'#fff',background:'var(--brand)',padding:'2px 8px',borderRadius:999}}>โมดูลเฉพาะ</span>}</div>
              <div style={{fontSize:12.5,color:'var(--ink-2)',marginTop:2,lineHeight:1.4}}>{v.s}</div>
            </div>
            <div style={{width:24,height:24,borderRadius:999,flex:'0 0 auto',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14,background:on?'var(--brand)':'transparent',border:on?'none':'2px solid var(--hair-2)'}}>{on?'✓':''}</div>
          </button>
        );})}
        {sel==='fitness' && <div style={{background:'var(--brand-softer,#EFFAF7)',border:'1px solid var(--hair)',borderRadius:13,padding:'12px 13px',display:'flex',gap:9,alignItems:'flex-start',marginTop:2}}>
          <span style={{fontSize:16}}>🏋️</span>
          <div style={{fontSize:12,color:'var(--brand-ink)',lineHeight:1.5}}>โหมดฟิตเนสจะเปิดโมดูลสมาชิก/ต่ออายุ · เช็คอิน NFC · คลาส · เทรนเนอร์ PT — <b>ล็อกไว้เฉพาะชุดนี้ เปลี่ยนเป็นร้านอาหารภายหลังไม่ได้</b> (ปิดเดลิเวอรีอัตโนมัติ)</div>
        </div>}
      </div></div>
      <div style={{flex:'0 0 auto',padding:'11px 18px calc(11px + env(safe-area-inset-bottom))',background:'#fff',borderTop:'1px solid var(--hair)'}}>
        <button className="kd-btn kd-btn-primary kd-btn-block" disabled={!sel} onClick={()=>onPick(CRM_VERTICALS.find(v=>v.id===sel))}>ถัดไป · กรอกข้อมูลร้าน →</button>
      </div>
    </div>
  );
}

/* ══ สมัครวิน → เลือกบทบาท 3 ทาง (หัวหน้าวิน · ร้าน/แผง · แรงงาน) ══ */
function CrmLaborRole({ onPick, onBack }){
  const ROLES=[
    { id:'lead',   emoji:'🎽', th:'หัวหน้าวิน', s:'เปิดวิน · คุมคิว · อนุมัติแรงงาน (ผู้สมัคร/จ่ายหลัก)' },
    { id:'shop',   emoji:'🏪', th:'ร้าน / แผงตลาด', s:'แม่ค้า/ผู้จ้าง · เรียกแรงงานมาช่วยงาน' },
    { id:'worker', emoji:'👷', th:'แรงงาน', s:'รับงาน–รับเงินสด · TH/MY/KH' },
  ];
  return (
    <div className="kd-screen">
      <div style={{flex:'0 0 auto',padding:'50px 16px 12px',display:'flex',alignItems:'center',gap:10}}>
        <button onClick={onBack} style={{background:'var(--brand-soft)',border:'none',color:'var(--brand-ink)',width:38,height:38,borderRadius:12,fontSize:18,cursor:'pointer'}}>←</button>
        <div><div style={{fontWeight:700,fontSize:18}}>สมัครระบบวิน</div><div style={{fontSize:12,color:'var(--ink-3)'}}>คุณเข้าใช้ในฐานะใคร?</div></div>
      </div>
      <div className="kd-body"><div style={{padding:'16px 16px 26px'}}>
        {ROLES.map(r=>(
          <button key={r.id} onClick={()=>onPick(r.id)} style={{width:'100%',textAlign:'left',display:'flex',gap:13,alignItems:'center',background:'#fff',border:'1.5px solid var(--hair)',borderRadius:16,padding:'15px 16px',marginBottom:11,cursor:'pointer',fontFamily:'inherit'}}>
            <div style={{width:46,height:46,borderRadius:13,flex:'0 0 auto',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,background:'var(--brand-soft)'}}>{r.emoji}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:15.5}}>{r.th}</div><div style={{fontSize:12.5,color:'var(--ink-3)',marginTop:2}}>{r.s}</div></div>
            <span style={{color:'var(--ink-3)'}}>›</span>
          </button>
        ))}
        <div style={{fontSize:12,color:'var(--ink-3)',lineHeight:1.55,background:'var(--bg)',borderRadius:10,padding:'11px 13px',marginTop:4}}>💡 แรงงานจะต้องรอหัวหน้าวินอนุมัติก่อนเริ่มรับงาน · หัวหน้าวิน = ผู้สมัคร/จ่ายหลัก</div>
      </div></div>
    </div>
  );
}

/* ══ CRM FLOW (mount ในแอป) ══ */
function CrmApp({ store, onEnter, onCancel }){
  const [step,setStep] = cState('landing');   // landing | vertical | signup | chooser | success
  const [shop,setShop] = cState(null);
  const [vert,setVert] = cState(null);         // ประเภทธุรกิจที่เลือก (Step 0)
  const [laborRole,setLaborRole] = cState(null); // บทบาทที่เลือกในระบบวิน (lead/shop/worker)
  const [pending,setPending] = cState(null);   // ข้อมูลสมัครรอเลือกโมดูล (เฟรม 4) ก่อน finish
  // ร้านที่สมัครแล้ว ไม่ต้องเห็นหน้าสมัคร/ปุ่มสมัครใหม่ → เด้งเข้าร้านเลย
  React.useEffect(()=>{
    let goSignup=false; try{ goSignup=new URLSearchParams(location.search).get('go')==='signup'; }catch(e){}
    // ค้างร้านในเครื่อง (เคยเปิดลิงก์ลูกค้า/เจ้าของ) → เด้งเข้าร้าน · แต่ถ้ามาจากลิงก์สมัคร (?go=signup) ไม่เด้ง (ให้สมัครใหม่ได้)
    if(!goSignup){ try{ const st=JSON.parse(localStorage.getItem('kaidee_pos_v1')||'{}'); if(st.shop&&st.shop.shopId){ onEnter&&onEnter('merchant'); return; } }catch(e){} }
    const lu=(typeof window!=='undefined'&&window.__lineUser)||null;
    if(lu&&lu.userId&&window.KD_API&&window.KD_API.getMyShop){
      window.KD_API.getMyShop(lu.userId).then(sh=>{ const o=sh&&(sh.ownerLine||(sh.owner&&sh.owner.line));
        if(sh&&sh.shopId&&o===lu.userId){ try{ localStorage.setItem('kd_shop',sh.shopId); }catch(e){} onEnter&&onEnter('merchant'); } }).catch(()=>{});
    }
  },[]);
  const finish = (s)=>{
    const isFit = s.vertical==='fitness';
    const fMenu = isFit ? [] : starterMenu(s.catKey||s.cat);   // ฟิตเนสใช้เอนจินของตัวเอง — ไม่ต้องเมนูอาหาร
    const _trial = s.trial!==false;   // แพ็ก/บัตร/ทดลอง จาก PlanGate
    const _sub = { plan:s.plan||'trial', tier:s.plan||null, monthly:s.monthly||0, expiry:s.expiry, auto:!s.comp, trial:_trial, paid:!!s.paid, comp:!!s.comp, card:s.card||null, addons:s.addons||null };
    const _feats = { ...(s.features||{}), ...((s.addons&&s.addons.consign)?{consign:true}:{}) };
    // เขียนลง store จริง → ร้านใหม่พร้อมใช้ทันที
    store.setShop(prev=>({ ...prev, name:s.name, emoji:s.emoji, logo:s.logo||null, phone:s.phone||'',
      branch:'', isOpen:true, open:s.open, close:s.close, cat:s.cat, vertical:s.vertical||'food', owner:s.owner||null, shopId:s.shopId, consent:s.consent||null, features:_feats }));
    store.setPay(prev=>({ ...prev, shopName:s.name, promptpay:s.promptpay }));
    store.setSub(_sub);
    if(store.setCostMode) store.setCostMode('simple');
    if(store.setMenu) store.setMenu(fMenu);   // เมนูตั้งต้นตามประเภทร้าน (แก้/ลบได้) · ฟิตเนส=ว่าง
    try{ localStorage.setItem('kd_shop', s.shopId); }catch(e){}   // สลับ tenant ให้ตรงร้านใหม่ (โหลดครั้งหน้าจะเข้าร้านนี้)
    try{ sessionStorage.setItem('kd_signed_at', String(Date.now())); }catch(e){}   // กัน reset-check เด้งกลับหน้าสมัคร (loop) ช่วงเพิ่งสมัคร
    // เขียน store ลง localStorage ทันที (กัน reload เร็วกว่า React persist) → เด้งเข้าหน้าร้านค้าเลย
    try{
      const k='kaidee_pos_v1'; const c=JSON.parse(localStorage.getItem(k)||'{}');
      // สมัครใหม่ = เริ่มร้านสดทั้งหมด (ไม่ sync ของเก่า) — ล้าง raw/purchases/wastes/staffList/riders + VAT/voidPin ด้วย
      localStorage.setItem(k, JSON.stringify({ lang: c.lang||'th',
        shop:{ name:s.name, emoji:s.emoji, logo:s.logo||null, phone:s.phone||'', branch:'', isOpen:true, open:s.open, close:s.close, cat:s.cat, vertical:s.vertical||'food', owner:s.owner||null, shopId:s.shopId, consent:s.consent||null, features:_feats },
        pay:{ shopName:s.name, promptpay:s.promptpay, bank:'', acct:'', accept:{ promptpay:true, cash:true, cod:true }, autoSlip:true, vatMode:'off', vatRate:7, taxId:'', taxAddr:'', taxBranch:'สำนักงานใหญ่' },
        sub:_sub,
        costMode:'simple', menu: fMenu,
        orders:[], sales:[], members:[], cashDays:[], quotes:[], raw:[], purchases:[], wastes:[], staffList:[], riders:[],
        register:{ open:false, openFloat:0, openedAt:null, moves:[] } }));
    }catch(e){}
    // reset tenant สะอาด: reload ไปร้านใหม่ (finish เขียน localStorage ก้อนใหม่ไว้แล้ว → boot ใหม่ได้ข้อมูลสด ไม่ค้างร้านเก่า)
    try{ if(window.KD_API && window.KD_API.setShop) window.KD_API.setShop(s.shopId); }catch(e){}
    try{ sessionStorage.removeItem('kd_dl_board'); sessionStorage.removeItem('kd_dl_shop'); localStorage.removeItem('kd_staff'); }catch(e){}   // กัน flag จอคิว/ร้านเก่า/พนักงานค้าง (สมัครใหม่ = เจ้าของเต็มสิทธิ์)
    try{ localStorage.setItem('kd_shop', s.shopId); }catch(e){}
    try{ sessionStorage.setItem('kd_fresh_signup','1'); }catch(e){}   // สมัครเสร็จใหม่ → ข้ามหน้ายินดี เข้าตั้งค่าร้านเลย (ครั้งเดียว)
    const o=location.origin+location.pathname; location.replace(o+'?shop='+encodeURIComponent(s.shopId)+'&role=merchant');
  };
  return (
    <div className="kd-screen" style={{background:'var(--bg)'}}>
      {step==='landing' && <CrmLanding onSignup={()=>setStep('vertical')} onCancel={onCancel} onEnter={onEnter}/>}
      {step==='vertical' && <CrmVertical onBack={()=>setStep('landing')} onPick={(v)=>{ setVert(v); setStep(v.id==='laborwin'?'laborrole':'signup'); }}/>}
      {step==='laborrole' && <CrmLaborRole onBack={()=>setStep('vertical')} onPick={(role)=>{ if(role==='worker'){ const o=location.origin+location.pathname.replace(/[^/]*$/,''); location.href=o+'Labor%20Win%20App%20v2.html'; } else { setLaborRole(role); setStep('signup'); } }}/>}
      {step==='signup'  && vert && <CrmSignup vertical={vert} onBack={()=>setStep('vertical')} onDone={(s)=>{ if(vert.id==='fitness'){ finish({ ...s, vertical:'fitness', features:{ ...FIT_FEATURES } }); } else if(vert.id==='laborwin'){ finish({ ...s, vertical:'laborwin', laborRole, features:{ ...LABOR_FEATURES } }); } else if(vert.id==='sponsor'){ finish({ ...s, vertical:'sponsor', features:{ ...SPONSOR_FEATURES } }); } else if(vert.id==='other'){ finish({ ...s, vertical:'other', features:{ orders:true, delivery:false, riders:false } }); } else { setPending(s); setStep('chooser'); } }}/>}
      {step==='chooser' && pending && <CrmChooser onBack={()=>setStep('signup')} onDone={(features)=>finish({ ...pending, vertical:(vert&&vert.id)||'food', features })}/>}
      {step==='success' && shop && <CrmSuccess shop={shop} onEnter={()=>{ try{ const k='kaidee_pos_v1',c=JSON.parse(localStorage.getItem(k)||'{}'); localStorage.setItem(k,JSON.stringify({ ...c, orders:[], sales:[], members:[], cashDays:[], quotes:[], register:{open:false,openFloat:0,openedAt:null,moves:[]} })); }catch(e){} const o=location.origin+location.pathname; location.href = o+'?shop='+encodeURIComponent(shop.shopId)+'&role=merchant'; }}/>}
    </div>
  );
}

Object.assign(window, { CrmApp, CrmLanding, CrmVertical, CrmLaborRole, CrmSignup, CrmChooser, CrmSuccess, CrmPlanGate });