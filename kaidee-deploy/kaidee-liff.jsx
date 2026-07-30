// kaidee-liff.jsx — LINE LIFF bootstrap, profile binding, push receipt back to chat
// ┌─────────────────────────────────────────────────────────────────┐
// │  ⬇︎ ใส่ LIFF ID จริงของคุณตรงนี้ (จาก LINE Developers → LIFF)      │
// │     รูปแบบ: '1234567890-abcXYZ'  — ปล่อยว่างไว้ = โหมดเดโม/เว็บ    │
// └─────────────────────────────────────────────────────────────────┘
const KD_LIFF_ID = '2010720123-HXe3iZJD';

window.__lineUser = null;                 // { userId, name, avatar } เมื่อ login ผ่าน LINE
window.KD_LIFF = { ready:false, mode:'demo', inClient:false, id:KD_LIFF_ID };

// เรียกครั้งเดียวก่อน render — init LIFF, ดึงโปรไฟล์, fallback เว็บถ้าไม่ได้อยู่ใน LINE
async function kdInitLiff(){
  const liff = window.liff;
  if(!liff || !KD_LIFF_ID){
    // ยังไม่ใส่ LIFF ID หรือ SDK โหลดไม่ได้ → รันเป็นเดโม/ทดสอบในเบราว์เซอร์ได้ปกติ
    window.KD_LIFF.ready = true; window.KD_LIFF.mode = 'demo';
    return window.KD_LIFF;
  }
  try{
    await liff.init({ liffId: KD_LIFF_ID });
    window.KD_LIFF.inClient = liff.isInClient();
    // จอแสดงคิว (role=board) = จอแสดงผลเฉยๆ ไม่ต้องรู้ตัวตน LINE → ข้าม forced-login (กันแชร์ไปเปิดเครื่องอื่นแล้วเด้งหน้าสมัคร)
    const _isBoard = (()=>{ try{ const u=new URL(location.href); let g=u.searchParams.get('role'); if(!g){ const st=u.searchParams.get('liff.state'); if(st){ g=new URLSearchParams(st.replace(/^[/?]+/,'')).get('role'); } } if(g==='board'||g==='kds') return true; }catch(e){} try{ if(sessionStorage.getItem('kd_dl_board')==='1'||sessionStorage.getItem('kd_dl_kds')==='1') return true; }catch(e){} return false; })();
    if(!liff.isLoggedIn() && !_isBoard){
      if(liff.isInClient()){ liff.login(); return window.KD_LIFF; }  // ในแอป LINE → login เงียบ แล้ว redirect กลับ
    }
    if(liff.isLoggedIn()){
      const p = await liff.getProfile();
      window.__lineUser = { userId:p.userId, name:p.displayName, avatar:p.pictureUrl };
    }
    window.KD_LIFF.ready = true; window.KD_LIFF.mode = 'line';
  }catch(e){
    console.warn('[LIFF] init failed → fallback web/demo mode', e);
    window.KD_LIFF.ready = true; window.KD_LIFF.mode = 'demo';
  }
  return window.KD_LIFF;
}

// สร้างข้อความใบยืนยันออเดอร์ (ส่งกลับเข้าแชท)
function kdReceiptText(o){
  const mb = window.menuById;
  const lines = (o.items||[]).map(([id,q])=>{ const m = mb?mb(id):null; return `• ${m?(m.th):id} ×${q}`; });
  const parts = [
    `🧾 ยืนยันออเดอร์ #${o.no}`,
    ...lines,
    `รวม ฿${Number(o.total||0).toLocaleString('en-US')}`,
  ];
  if(o.when && !/เลย|ASAP/.test(o.when)) parts.push(`⏰ จองล่วงหน้า: ${o.when}`);
  if(o.addr) parts.push(`📍 ${o.addr}`);
  parts.push('สถานะ: ร้านกำลังรับออเดอร์');
  return parts.join('\n');
}

// ส่งใบยืนยันกลับแชท LINE (ทำงานเฉพาะตอนเปิดจริงในแอป LINE)
async function kdSendReceipt(o){
  const liff = window.liff;
  if(!liff || window.KD_LIFF.mode!=='line' || !liff.isInClient()) return false;
  try{ await liff.sendMessages([{ type:'text', text: kdReceiptText(o) }]); return true; }
  catch(e){ console.warn('[LIFF] sendMessages failed', e); return false; }
}

// เข้าสู่ระบบด้วย LINE ตามคำสั่ง (ใช้ได้ทั้งในแอป LINE และนอก LINE/เบราว์เซอร์/สแกน QR)
// นอก LINE → liff.login() จะพาไปหน้าให้สิทธิ์ LINE แล้ว redirect กลับมาที่ redirectUri (default = หน้าปัจจุบัน)
async function kdLoginLine(redirectUri){
  const liff = window.liff;
  if(!liff || !KD_LIFF_ID) return false;   // เดโม/ไม่มี LIFF ID → เข้าระบบ LINE ไม่ได้
  try{
    if(!liff.isLoggedIn()){ liff.login({ redirectUri: redirectUri || location.href }); return true; }
    if(!window.__lineUser){ const p = await liff.getProfile(); window.__lineUser = { userId:p.userId, name:p.displayName, avatar:p.pictureUrl }; }
    return true;
  }catch(e){ console.warn('[LIFF] login failed', e); return false; }
}
// พร้อมเข้าสู่ระบบ LINE ได้ไหม (มี SDK + LIFF ID) — ใช้ตัดสินใจโชว์ปุ่ม "เข้าสู่ระบบด้วย LINE"
function kdCanLineLogin(){ return !!(window.liff && KD_LIFF_ID); }

Object.assign(window, { KD_LIFF_ID, kdInitLiff, kdSendReceipt, kdReceiptText, kdLoginLine, kdCanLineLogin });
