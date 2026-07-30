// fitness-signup.jsx — หน้าสมัครใช้ฟิตเนส (first run · เปิดด้วย ?signup=1) → สร้างระบบเปล่าของร้านเอง
(function(){
const { useState } = React;
const LSK='kd_fit_signed';
const DEMOK='kd_fit_demo';   // ข้าม = ดูตัวอย่างชั่วคราว (แค่รอบนี้) · ปิดแอปแล้วเปิดใหม่ = เจอหน้าสมัครอีก
function fitSigned(){ try{ return localStorage.getItem(LSK)==='1'||sessionStorage.getItem(DEMOK)==='1'; }catch(e){ return false; } }
function fitDemoOnly(){ try{ return localStorage.getItem(LSK)!=='1'&&sessionStorage.getItem(DEMOK)==='1'; }catch(e){ return false; } }
function FitSignup({setData,toast,onDone}){
  const [f,setF]=useState({name:'',owner:'',address:'',phone:'',promptpay:'',pin:'',openHour:'06:00–22:00'});
  const [askSkip,setAskSkip]=useState(false);   // ถามในแอปเอง ไม่ใช้ window.confirm (บน PWA/LINE จะเด้ง dialog ของเบราว์เซอร์)
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const ok=f.name.trim().length>1&&/^\d{4}$/.test(f.pin);
  const create=()=>{
    if(!f.name.trim()){ toast('ใส่ชื่อฟิตเนส'); return; }
    if(!/^\d{4}$/.test(f.pin)){ toast('ตั้ง PIN เจ้าของ 4 หลัก'); return; }
    setData(()=>window.FIT.newGym({name:f.name.trim(),owner:f.owner.trim()||'เจ้าของร้าน',phone:f.phone.trim(),address:f.address.trim(),promptpay:f.promptpay.trim()||f.phone.trim(),pin:f.pin.trim(),openHour:f.openHour.trim()}));
    try{ localStorage.setItem(LSK,'1'); }catch(e){}
    toast('🎉 สร้างระบบฟิตเนสของคุณแล้ว'); onDone();
  };
  return (<div className="fade" style={{padding:'6px 0 20px'}}>
    <div className="card" style={{textAlign:'center',background:'linear-gradient(135deg,var(--brand,#0E9C88),#0a6e5e)',color:'#fff',border:'none'}}>
      <div style={{fontSize:38}}>🏋️</div>
      <div style={{fontSize:19,fontWeight:800,marginTop:4}}>สมัครใช้ระบบฟิตเนส</div>
      <div style={{fontSize:12.5,opacity:.92,marginTop:4,lineHeight:1.5}}>กรอก 2 ช่องก็เริ่มได้ — ระบบจะสร้างฟิตเนสเปล่าของคุณ<br/>ไม่มีข้อมูลตัวอย่างปนกับของจริง</div>
    </div>
    <label className="lb">ชื่อฟิตเนส *</label>
    <input className="field" value={f.name} onChange={e=>set('name',e.target.value)} placeholder="เช่น ฟิตโซน สตูดิโอ"/>
    <label className="lb">PIN เจ้าของ (4 หลัก) *</label>
    <input className="field num" inputMode="numeric" maxLength={4} value={f.pin} onChange={e=>set('pin',e.target.value.replace(/\D/g,''))} placeholder="เช่น 1234"/>
    <div className="secttl" style={{marginTop:18}}>ไม่บังคับ · ใส่ทีหลังในตั้งค่าได้</div>
    <label className="lb" style={{marginTop:0}}>ชื่อเจ้าของ</label>
    <input className="field" value={f.owner} onChange={e=>set('owner',e.target.value)} placeholder="ชื่อ-นามสกุล"/>
    <label className="lb">ที่อยู่ร้าน</label>
    <textarea className="field" rows={2} style={{resize:'none'}} value={f.address} onChange={e=>set('address',e.target.value)} placeholder="ถนน · อาคาร/ชั้น · เขต · จังหวัด"/>
    <label className="lb">เบอร์ติดต่อ</label>
    <input className="field num" inputMode="tel" value={f.phone} onChange={e=>set('phone',e.target.value)} placeholder="08X-XXX-XXXX"/>
    <label className="lb">พร้อมเพย์รับเงิน</label>
    <input className="field num" inputMode="tel" value={f.promptpay} onChange={e=>set('promptpay',e.target.value)} placeholder="เบอร์/เลขบัญชีพร้อมเพย์"/>
    <label className="lb">เวลาเปิด–ปิด</label>
    <input className="field" value={f.openHour} onChange={e=>set('openHour',e.target.value)} placeholder="06:00–22:00"/>
    <button className="btn pri blk" style={{marginTop:18,opacity:ok?1:.55}} onClick={create}>สร้างระบบฟิตเนสของฉัน →</button>
    <button className="btn gh blk" style={{marginTop:9}} onClick={()=>setAskSkip(true)}>ข้าม · ดูข้อมูลตัวอย่างก่อน</button>
    {askSkip&&<div onClick={()=>setAskSkip(false)} style={{position:'fixed',inset:0,background:'rgba(17,24,28,.46)',zIndex:70,display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',background:'#fff',borderRadius:'18px 18px 0 0',padding:'18px 16px calc(18px + env(safe-area-inset-bottom))'}}>
        <div style={{fontSize:16.5,fontWeight:800}}>ข้ามการสมัครก่อน?</div>
        <div style={{fontSize:13,color:'var(--ink-3,#8a8f98)',marginTop:6,lineHeight:1.55}}>จะเข้าไปดูด้วย<b>ข้อมูลตัวอย่าง</b> ยังไม่ใช่ของร้านคุณ — <b>รอบนี้เท่านั้น</b> ปิดแอปแล้วเปิดใหม่จะกลับมาที่หน้าสมัครอีกครั้ง</div>
        <button className="btn pri blk" style={{marginTop:14}} onClick={()=>{ try{ sessionStorage.setItem(DEMOK,'1'); }catch(e){} setAskSkip(false); onDone(); }}>ดูข้อมูลตัวอย่าง →</button>
        <button className="btn gh blk" style={{marginTop:9}} onClick={()=>setAskSkip(false)}>กลับไปกรอก</button>
      </div>
    </div>}
  </div>);
}
Object.assign(window,{ FitSignup, fitSigned, fitDemoOnly });
})();
