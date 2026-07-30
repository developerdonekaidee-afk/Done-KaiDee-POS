// fitness-data.jsx — Market OS · Vertical ฟิตเนส (window.FIT)
// ใช้เอนจินเดียวกับโปรแกรมตลาด "เปลี่ยนเลนส์": บิล→ค่าสมาชิก · Overdue lock→ตัดสิทธิ์เข้า · LINE OA→เตือนต่ออายุ
// เก็บ localStorage kd_fitness_v1
(function(){
  const B  = (n)=> '฿'+Math.round(Number(n)||0).toLocaleString('en-US');
  const pad=(n)=>String(n).padStart(2,'0');
  const iso=(d)=> d.toISOString().slice(0,10);
  const todayISO=()=> iso(new Date());
  const addDays=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const isoAdd=(base,n)=> iso(addDays(new Date(base),n));
  const daysTo=(d)=>{ if(!d)return null; return Math.round((new Date(d+'T00:00:00')-new Date(todayISO()+'T00:00:00'))/864e5); };
  const TH_MON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const thDate=(d)=>{ if(!d)return '—'; const [y,m,dd]=String(d).split('-'); return +dd+' '+TH_MON[+m-1]+' '+String(+y+543).slice(-2); };
  const thTime=(ts)=>{ const x=new Date(ts); return pad(x.getHours())+':'+pad(x.getMinutes()); };
  const thDateTime=(ts)=>{ const x=new Date(ts); return thDate(iso(x))+' '+pad(x.getHours())+':'+pad(x.getMinutes()); };
  const DOW=['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
  const DOW_FULL=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

  // ── สถานะสมาชิกจากวันหมดอายุ ──
  function memberStatus(m){ const d=daysTo(m.expiry);
    if(m.frozen) return {key:'frozen',th:'พักชั่วคราว',cls:'p-b',d};
    if(d==null) return {key:'none',th:'ยังไม่มีแพ็ก',cls:'p-n',d};
    if(d<0) return {key:'expired',th:'หมดอายุ',cls:'p-r',d};
    if(d<=7) return {key:'expiring',th:'ใกล้หมด',cls:'p-y',d};
    return {key:'active',th:'ใช้งานได้',cls:'p-g',d}; }
  const canEnter=(m)=>{ const s=memberStatus(m); return s.key==='active'||s.key==='expiring'; };

  // ── บัตรสมาชิกกันแคปหน้าจอ: โค้ดหมุน (rotating token) — แหล่งความจริงเดียว ใช้ทั้งบัตรสมาชิกและจอสแกนประตู ──
  const CARD_WIN=30; // วินาทีต่อรอบ
  function fitHash(str){ let h=0; for(let i=0;i<str.length;i++){ h=(Math.imul(h,31)+str.charCodeAt(i))>>>0; } return h.toString(36); }
  function cardToken(mid,secret,win){ return 'FMB.'+mid+'.'+win+'.'+fitHash(mid+'|'+win+'|'+secret).slice(0,5); }
  // ตรวจโค้ดที่สแกน — สดเฉพาะรอบปัจจุบัน/ก่อนหน้า (กันแคปหน้าจอเก่า)
  function fitVerifyToken(d,code){
    if(!code||String(code).indexOf('FMB.')!==0) return {ok:false,reason:'bad'};
    const p=String(code).split('.'); const mid=p[1], win=+p[2], sig=p[3];
    const secret=(d.gym&&d.gym.cardSecret)||'';
    const nowWin=Math.floor(Date.now()/(CARD_WIN*1000));
    if(win!==nowWin && win!==nowWin-1) return {ok:false,reason:'stale',memberId:mid};
    if(fitHash(mid+'|'+win+'|'+secret).slice(0,5)!==sig) return {ok:false,reason:'forged',memberId:mid};
    return {ok:true,memberId:mid};
  }

  // ── ราคา 3 แบบ ──
  const PRICING={
    A:{th:'แพ็กคงที่',desc:'จ่ายรายเดือน/รายปีตามแพ็ก ฿1,990–9,990 · ระบบฟรี ตลาดคิดค่าแพ็กเอง',rangeTh:'฿1,990–9,990/เดือน'},
    B:{th:'% ผ่านแอป',desc:'ฟิตเนสใช้ฟรี เก็บ 2–3% เฉพาะยอดที่จ่ายผ่านแอป (ต่ออายุ/PT/ขายของ)',rangeTh:'2–3% ต่อธุรกรรม'},
    C:{th:'ไฮบริด',desc:'ค่าระบบ ฿990/เดือน + 1% ของยอดผ่านแอป',rangeTh:'฿990 + 1%'},
  };
  // ค่าธรรมเนียมแพลตฟอร์มต่อธุรกรรมผ่านแอป
  function appFee(gym, amount){ if(!amount) return 0;
    if(gym.pricingModel==='B') return Math.round(amount*(gym.appFeePct||2.5)/100);
    if(gym.pricingModel==='C') return Math.round(amount*1/100); return 0; }

  function makeSeed(){
    const r=rng(2026); const today=new Date();
    const gym={ id:'fit-1', name:'ฟิตโซน', account:'บจก. ฟิตโซน เวลเนส', phone:'02-914-7788',
      promptpay:'0-9455-00778-2', address:'199 ถ.นิมิตใหม่ ชั้น 2 เดอะพลาซ่า คอมมูนิตี้มอลล์ กรุงเทพฯ',
      lineOA:true, hasNFC:true, pricingModel:'C', appFeePct:2.5, openHour:'06:00–22:00' };

    const packages=[
      {id:'pk-day',name:'Day Pass',kind:'daypass',price:120,months:0,sessions:0,desc:'เข้าใช้ 1 วัน'},
      {id:'pk-m1', name:'รายเดือน',  kind:'monthly',price:1990,months:1,sessions:0,desc:'ฟิตเนส + คลาสกรุ๊ปไม่จำกัด',pop:true},
      {id:'pk-m3', name:'3 เดือน',   kind:'monthly',price:4990,months:3,sessions:0,desc:'ประหยัด 17% · ฟรีบอดี้สแกน'},
      {id:'pk-y1', name:'รายปี',     kind:'yearly', price:14990,months:12,sessions:0,desc:'คุ้มสุด · แช่แข็งได้ 30 วัน'},
      {id:'pk-pt10',name:'PT 10 ครั้ง',kind:'sessions',price:6900,months:0,sessions:10,desc:'เทรนเนอร์ส่วนตัว 10 เซสชัน'},
    ];

    const trainers=[
      {id:'tr-1',name:'โค้ชเบิร์ด',specialty:'Weight Training · ลดไขมัน',rate:650,rating:4.9,reviews:64,active:true,bio:'ประสบการณ์ 8 ปี · NASM-CPT',avail:'จ–ศ 09:00–18:00'},
      {id:'tr-2',name:'โค้ชแนน',specialty:'Functional · Yoga',rate:600,rating:4.8,reviews:41,active:true,bio:'RYT-200 · เวชศาสตร์การกีฬา',avail:'อ–ส 10:00–20:00'},
      {id:'tr-3',name:'โค้ชโอ๊ต',specialty:'Boxing · HIIT',rate:700,rating:4.7,reviews:38,active:true,bio:'อดีตนักมวยสมัครเล่น',avail:'จ–ศ 16:00–21:00'},
      {id:'tr-4',name:'โค้ชมิ้น',specialty:'Pilates · ฟื้นฟูร่างกาย',rate:680,rating:5.0,reviews:22,active:true,bio:'กายภาพบำบัด · Pilates Mat',avail:'พ–อา 08:00–16:00'},
    ];

    const NAMES=[['กิตติพงษ์ ส.','ก'],['ณัฐชา พ.','ณ'],['ปวีณา ท.','ป'],['ธนกร ว.','ธ'],['สุชานันท์ ร.','ส'],['อภิสิทธิ์ ล.','อ'],
      ['พิมพ์มาดา ค.','พ'],['ชนากานต์ ม.','ช'],['ภูริช อ.','ภ'],['วรรณิดา ต.','ว'],['เตชินท์ ห.','ต'],['ญาดา บ.','ญ'],
      ['กันตพงศ์ ด.','ก'],['รมิดา ศ.','ร'],['นภสร จ.','น'],['ธีรเดช ป.','ธ']];
    const members=NAMES.map((nm,i)=>{
      const pk = i<2?'pk-y1' : i<9?'pk-m1' : i<12?'pk-m3' : (i<14?'pk-pt10':'pk-day');
      // กระจายวันหมดอายุ: บางคนหมดแล้ว / ใกล้หมด / ยังเหลือเยอะ
      const offs=[42,90,5,2,-3,18,-12,3,25,60,120,7,1,-1,150,33];
      const p=packages.find(x=>x.id===pk);
      const start = p.months? isoAdd(todayISO(), -(p.months*30 - offs[i])) : isoAdd(todayISO(),-offs[i]-1);
      const expiry = pk==='pk-pt10'?null : isoAdd(todayISO(), offs[i]);
      const spend = Math.round((p.price||0) + (r()<0.5? Math.floor(r()*4000):0));
      return { id:'mb-'+(i+1), code:'M'+pad(i+1), name:nm[0], phone:'08'+(1+Math.floor(r()*8))+'-'+String(100+Math.floor(r()*900))+'-'+String(1000+Math.floor(r()*9000)),
        line:r()<0.7, packageId:pk, start, expiry, joinedAt: isoAdd(start,0), frozen:(i===10),
        parq:i<12, consent:i<13, ptLeft: pk==='pk-pt10'?(i%2?7:4):0, spend,
        bodyBefore:i<8?{w:(66+Math.floor(r()*22)),fat:(20+Math.floor(r()*12)),date:isoAdd(start,2)}:null,
        bodyAfter:i<5?{w:(60+Math.floor(r()*18)),fat:(15+Math.floor(r()*9)),date:isoAdd(todayISO(),-10)}:null };
    });

    // คลาสกรุ๊ป — ตารางรายสัปดาห์
    const classes=[
      {id:'cl-1',name:'Yoga Flow',trainerId:'tr-2',day:1,time:'18:00',dur:60,cap:18,fee:0},
      {id:'cl-2',name:'HIIT Burn',trainerId:'tr-3',day:1,time:'19:30',dur:45,cap:16,fee:0},
      {id:'cl-3',name:'Boxing Basic',trainerId:'tr-3',day:3,time:'18:30',dur:60,cap:14,fee:150},
      {id:'cl-4',name:'Pilates Mat',trainerId:'tr-4',day:4,time:'10:00',dur:55,cap:12,fee:100},
      {id:'cl-5',name:'Strength 101',trainerId:'tr-1',day:5,time:'18:00',dur:60,cap:16,fee:0},
      {id:'cl-6',name:'Weekend Yoga',trainerId:'tr-2',day:6,time:'09:00',dur:75,cap:20,fee:0},
    ];
    classes.forEach((c,i)=>{ const n=Math.floor(c.cap*(0.4+r()*0.55)); c.booked=members.slice(i,i+n).map(m=>m.id); });

    const products=[
      {id:'pr-1',name:'อเมริกาโน่ (ร้อน/เย็น)',cat:'กาแฟ',price:60,stock:999,sold:64},
      {id:'pr-2',name:'ลาเต้',cat:'กาแฟ',price:70,stock:999,sold:52},
      {id:'pr-3',name:'โปรตีนเชค (ปั่นสด)',cat:'เครื่องดื่ม',price:120,stock:80,sold:37},
      {id:'pr-4',name:'น้ำเกลือแร่',cat:'เครื่องดื่ม',price:35,stock:120,sold:88},
      {id:'pr-5',name:'น้ำเปล่า',cat:'เครื่องดื่ม',price:15,stock:240,sold:150},
      {id:'pr-6',name:'สลัดอกไก่ / คลีนบ็อกซ์',cat:'อาหาร',price:110,stock:18,sold:22},
      {id:'pr-7',name:'โปรตีนบาร์',cat:'อาหาร',price:65,stock:44,sold:31},
      {id:'pr-8',name:'เวย์โปรตีน 2lb',cat:'อาหารเสริม',price:1290,stock:14,sold:8},
      {id:'pr-9',name:'ขวดน้ำ Shaker',cat:'อุปกรณ์',price:250,stock:32,sold:21},
      {id:'pr-10',name:'ถุงมือยกเวท',cat:'อุปกรณ์',price:490,stock:18,sold:6},
    ];

    // เช็คอินวันนี้ — mix ผ่านประตู
    const checkins=[]; const now=Date.now();
    [ [0,'nfc',9], [1,'nfc',8], [2,'qr',7], [3,'nfc',6], [7,'nfc',5], [12,'qr',4], [5,'nfc',3], [4,'denied',2.5], [8,'nfc',2], [11,'qr',1.2], [3,'nfc',0.5] ]
      .forEach((c,i)=>{ const m=members[c[0]]; const denied=c[1]==='denied';
        checkins.push({ id:'ck-'+i, memberId:m.id, at: now-Math.round(c[2]*36e5), method: denied?'nfc':c[1], result: denied?'denied':'ok' }); });

    // PT bookings — คิวเทรนเนอร์
    const ptBookings=[
      {id:'pt-1',memberId:'mb-13',trainerId:'tr-1',date:isoAdd(todayISO(),0),time:'17:00',kind:'package',paid:true,status:'confirmed',amount:0},
      {id:'pt-2',memberId:'mb-3', trainerId:'tr-3',date:isoAdd(todayISO(),0),time:'19:00',kind:'single',paid:true,status:'confirmed',amount:700},
      {id:'pt-3',memberId:'mb-6', trainerId:'tr-2',date:isoAdd(todayISO(),1),time:'11:00',kind:'single',paid:false,status:'pending',amount:600},
      {id:'pt-4',memberId:'mb-14',trainerId:'tr-1',date:isoAdd(todayISO(),1),time:'10:00',kind:'package',paid:true,status:'confirmed',amount:0},
      {id:'pt-5',memberId:'mb-9', trainerId:'tr-4',date:isoAdd(todayISO(),2),time:'09:00',kind:'single',paid:true,status:'confirmed',amount:680},
    ];

    // revenue log (ต่ออายุ/ขาย ผ่านแอป vs หน้าเคาน์เตอร์) — 30 วันล่าสุด
    const renewals=[];
    members.forEach((m,i)=>{ const p=packages.find(x=>x.id===m.packageId); if(!p||!p.price) return;
      const via = m.line? (r()<0.6?'app':'counter') : 'counter';
      renewals.push({ id:'rv-'+i, memberId:m.id, packageId:m.packageId, at: now-Math.round(r()*28*864e5), amount:p.price, via, kind:'renew' }); });
    // ขายของบางรายการผ่านแอป
    [['mb-3','pr-1',1290,'app'],['mb-9','pr-3',250,'app'],['mb-1','pr-2',290,'counter'],['mb-6','pr-1',1290,'app'],['mb-13','pr-4',490,'app']]
      .forEach((s,i)=>renewals.push({id:'sv-'+i,memberId:s[0],productId:s[1],amount:s[2],via:s[3],kind:'shop',at:now-Math.round(r()*20*864e5)}));

    return { gym, packages, trainers, members, classes, products, checkins, ptBookings, renewals, ver:2, demo:true, addons:{kds:false,board:false,memberOrder:false} };
  }

  const LS='kd_fitness_v1';
  // add-on entitlement (KDS จอครัว · จอคิวหน้าร้าน · สมาชิกสั่งอาหาร)
  const ADDONS={kds:{name:'KDS จอครัว',price:290,icon:'👨‍🍳'},board:{name:'จอคิวหน้าร้าน',price:190,icon:'📺'},memberOrder:{name:'สมาชิกสั่งอาหารในแอป',price:290,icon:'🍱'}};
  function fitHasAddon(d,key){ return !!((d&&d.addons||{})[key]); }
  function load(){ try{ const j=JSON.parse(localStorage.getItem(LS)); if(j&&j.ver===2&&j.members){ if(!j.addons) j.addons={kds:false,board:false,memberOrder:false}; return j; } }catch(e){} const s=makeSeed(); save(s); return s; }
  function save(d){ try{ d.updatedAt=Date.now(); localStorage.setItem(LS,JSON.stringify(d)); }catch(e){} }
  function reset(){ const s=makeSeed(); save(s); return s; }
  // เริ่มใช้จริง — ล้างข้อมูลตัวอย่าง คงไว้แค่ตั้งค่าร้าน + บัญชีเจ้าของ
  function startFresh(cur){ cur=cur||{}; const owner=(cur.staff||[]).filter(s=>s.role==='owner');
    const s={ gym: cur.gym||makeSeed().gym, plan: cur.plan||{tier:'free'}, addons: cur.addons||{kds:false,board:false,memberOrder:false},
      staff: owner.length?owner:undefined, currentStaffId: owner.length?owner[0].id:undefined,
      packages:[], trainers:[], members:[], classes:[], products:[], raws:[],
      checkins:[], ptBookings:[], renewals:[], orders:[], offers:[], purchases:[],
      vouchers:[], voucherDefs:[], promos:[], dayCloses:[], staffShifts:[],
      fitDay:{open:true,openedAt:Date.now()}, demo:false, startedAt:Date.now(), ver:2 };
    save(s); return s; }
  // ลบฟิตเนสเดิมทั้งหมด → สร้างฟิตเนสใหม่จากศูนย์ (กรอกชื่อ/เจ้าของ/PIN เอง)
  function newGym(info){ info=info||{};
    const gym={ id:'fit-'+Date.now().toString(36), name:(info.name||'ฟิตเนสใหม่').trim(), account:info.account||'', phone:info.phone||'',
      promptpay:info.promptpay||'', address:info.address||'', lineOA:false, hasNFC:false, pricingModel:'C', appFeePct:2.5, openHour:info.openHour||'06:00–22:00' };
    const s={ gym, plan:{tier:'free'}, addons:{kds:false,board:false,memberOrder:false},
      staff:[{id:'st-own',name:(info.owner||'เจ้าของร้าน').trim(),role:'owner',pin:String(info.pin||'0000'),active:true,onShift:true,shiftAt:Date.now()}],
      currentStaffId:'st-own',
      packages:[], trainers:[], members:[], classes:[], products:[], raws:[],
      checkins:[], ptBookings:[], renewals:[], orders:[], offers:[], purchases:[],
      vouchers:[], voucherDefs:[], promos:[], dayCloses:[], staffShifts:[],
      fitDay:{open:true,openedAt:Date.now()}, demo:false, startedAt:Date.now(), ver:2 };
    save(s); return s; }

  window.FIT={ B, pad, todayISO, isoAdd, daysTo, thDate, thTime, thDateTime, DOW, DOW_FULL,
    memberStatus, canEnter, PRICING, appFee, makeSeed, load, save, reset, startFresh, newGym,
    CARD_WIN, cardToken, fitVerifyToken, ADDONS, fitHasAddon };
})();
