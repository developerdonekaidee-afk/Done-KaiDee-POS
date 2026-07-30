/* laborwin2-data.jsx — Labor Win v2 data model + helpers + shared UI atoms
   โมเดล market-optional / actor-first · win_queue แยก open_pool (server boundary จำลองใน client) */
const LW2_LS='kd_laborwin_v2';
const B=(n)=>'฿'+Number(n||0).toLocaleString('en-US');
const uid=(p)=>p+Math.random().toString(36).slice(2,7);
const HHMM=(d)=>{d=d||new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};

/* ── ค่าคอมหัวหน้าวิน (งานนอก): default 2% · ปรับ 1–5% · เพดาน 5% · ขั้นต่ำ ฿3/บิล ── */
const COMM_DEFAULT=0.02, COMM_MIN=0.01, COMM_MAX=0.05, COMM_FLOOR=3;
const clampRate=(r)=>Math.max(COMM_MIN,Math.min(COMM_MAX,r));
const winComm=(price,rate)=>Math.max(COMM_FLOOR,Math.round(price*(rate==null?COMM_DEFAULT:clampRate(rate))));

const JOBS_DEF=[
  {id:'lift',e:'📦',th:'ยกของ',my:'ကုန်ချ',kh:'លើកទំនិញ',price:120},
  {id:'carry',e:'🛒',th:'แบกของ',my:'သယ်ပို့',kh:'សែងទំនិញ',price:100},
  {id:'pack',e:'🧺',th:'แพ็กสินค้า',my:'ထုပ်ပိုး',kh:'ខ្ចប់',price:90},
  {id:'clean',e:'🧹',th:'ทำความสะอาด',my:'သန့်ရှင်း',kh:'សម្អាត',price:80},
];
const jobDef=(id)=>JOBS_DEF.find(j=>j.id===id)||JOBS_DEF[0];

/* 3 สถานะแรงงานตอนสมัคร */
const WK_STATUS={
  both:{th:'สังกัดวิน + รับงานนอก',s:'งานตลาดผ่านหัวคิว + งานนอกกดรับเอง (หัก '+(COMM_DEFAULT*100)+'% เข้าหัวคิว)',badge:'แนะนำ',cls:'both'},
  win:{th:'สังกัดวินอย่างเดียว',s:'รับเฉพาะงานตลาดผ่านหัวคิว · ไม่หักค่าคอม',badge:'',cls:'win'},
  free:{th:'ฟรีแลนซ์ล้วน',s:'ไม่สังกัดวิน · ไม่หักค่าคอม · ไม่มีวินคุ้มครอง',badge:'',cls:'free'},
};

const WORKER_T={
  th:{market:'งานในตลาด',outside:'งานนอก/รับเอง',ready:'พร้อม',notready:'ไม่พร้อม',wage:'ค่าแรง',comm:'ค่าคอมหัวหน้าวิน',net:'รับสุทธิ',accept:'รับงาน',reject:'ไม่รับ',answer:'ตอบใน 60 วิ',waiting:'รองานเข้า…',take:'รับงานนี้',going:'ไปที่ล็อก',working:'กำลังทำงาน',getcash:'รับเงินสด',lock:'ล็อก',timeauto:'ออโต้ตามตาราง',timeman:'แมนนวล'},
  my:{market:'ဈေးအလုပ်',outside:'ပြင်ပအလုပ်',ready:'အသင့်',notready:'မအသင့်',wage:'လုပ်ခ',comm:'ကော်မရှင်',net:'အသားတင်',accept:'လက်ခံ',reject:'ငြင်း',answer:'၆၀ စက္ကန့်',waiting:'စောင့်…',take:'လက်ခံ',going:'သွားပါ',working:'လုပ်နေ',getcash:'ငွေယူ',lock:'နေရာ',timeauto:'အလိုအလျောက်',timeman:'ကိုယ်တိုင်'},
  kh:{market:'ការងារផ្សារ',outside:'ការងារក្រៅ',ready:'រួចរាល់',notready:'មិនទាន់',wage:'ឈ្នួល',comm:'កម្រៃ',net:'សុទ្ធ',accept:'ទទួល',reject:'បដិសេធ',answer:'៦០វិ',waiting:'រង់ចាំ…',take:'ទទួល',going:'ទៅ',working:'កំពុងធ្វើ',getcash:'ទទួលប្រាក់',lock:'ទីតាំង',timeauto:'ស្វ័យ',timeman:'ដោយដៃ'},
};

/* actor identities สำหรับเดโม (สลับบทบาทในเครื่องเดียว) */
const MEW='wk-maung';   // แรงงาน = หม่อง (วินแดง · ตลาดลาดสวาย)
const MEWIN='w-red';    // หัวหน้าวิน = วินแดง
const MESHOP={id:'sh-a12',name:'เจ๊แดง · แผง A-12',market_id:'m-ladsawai'};

function lw2seed(){
  return {
    markets:[
      {id:'m-ladsawai',name:'ตลาดกลางลาดสวาย',code:'LADSAWAI',lat:13.9846,lng:100.6540,claimed:false,owner:null},
      {id:'m-simum',name:'ตลาดสี่มุมเมือง',code:'SIMUM',lat:13.9560,lng:100.5920,claimed:true,owner:'บจก.ดอนเมืองพัฒนา'},
      {id:'m-talaadthai',name:'ตลาดไท',code:'TALAADTHAI',lat:14.0790,lng:100.6180,claimed:false,owner:null},
    ],
    wins:[
      {id:'w-red',name:'วินแดง',market_id:'m-ladsawai',cls:'red',dot:'🔴',commRate:COMM_DEFAULT,gp:840,wallet:760,headCut:0.10,settings:{...DEF_SET}},
      {id:'w-blue',name:'วินน้ำเงิน',market_id:'m-ladsawai',cls:'blue',dot:'🔵',commRate:0.03,gp:0,wallet:0,headCut:0.10,settings:{...DEF_SET,wageMode:'direct'}},
    ],
    workers:[
      {id:'wk-maung',name:'หม่อง',win_id:'w-red',market_id:'m-ladsawai',status:'both',marketOn:true,outsideOn:false,timeMode:'auto',schedFrom:'04:00',schedTo:'08:00',lockOverlap:true,acceptedTerms:false,available:true,lang:'th',pending:380,debt:200,advanceReq:0,paidTotal:1240,ratings:[{stars:5,note:'ตรงเวลา ขยัน',by:'เจ๊แดง · แผง A-12',at:0},{stars:4,note:'',by:'ร้านผักป้านิด · C-04',at:0}]},
      {id:'wk-jor',name:'จอ',win_id:'w-red',market_id:'m-ladsawai',status:'win',marketOn:true,outsideOn:false,timeMode:'manual',lockOverlap:true,acceptedTerms:false,available:true,lang:'my',pending:0,debt:0,advanceReq:0,paidTotal:900,ratings:[{stars:5,note:'',by:'เจ๊แดง · แผง A-12',at:0}]},
      {id:'wk-athit',name:'อาทิตย์',win_id:'w-red',market_id:'m-ladsawai',status:'both',marketOn:false,outsideOn:true,timeMode:'manual',lockOverlap:true,acceptedTerms:true,available:true,lang:'th',pending:0,debt:0,advanceReq:0,paidTotal:1580,ratings:[]},
    ],
    winQueue:[],  // งานในตลาด/วิน — หัวคิว dispatch · ผูก win_id
    openPool:[],  // งานนอก/open pool — กดรับเอง · ⚠️ ไม่ผูก win_id (server boundary)
    rosterInstances:[],  // งานประจำที่ถูกสร้างล่วงหน้าเป็นวันจริง (จาก roster template)
    roster:[      // ตารางงานประจำต่อร้าน (recurring)
      {id:'r-1',shop:'เจ๊แดง · แผง A-12',market_id:'m-ladsawai',type:'carry',time:'05:00',days:[1,2,3,4,5,6],win_id:'w-red',assigned:null},
      {id:'r-2',shop:'ร้านผักป้านิด · C-04',market_id:'m-ladsawai',type:'lift',time:'04:30',days:[1,3,5],win_id:'w-red',assigned:'wk-jor'},
    ],
    lock:'A-12',
    shopPrefs:{'sh-a12':{preferredWin:'w-red'}},  // ทีมประจำ (Preferred Team) ต่อร้าน
  };
}
/* โมเดลการรับเงิน (เลือกได้ต่อวิน/ตลาด · แต่ละตลาดฐานต่างกัน) */
const WAGE_MODES={
  leader:{th:'หัวคิวรับเงินตรง',s:'ร้านจ่ายค่าแรงเต็มให้หัวหน้าวิน → หักหัวคิว → ทยอยจ่ายลูกทีม (Leader Wallet)',badge:'แบบเดิม · ค่าเริ่มต้น'},
  direct:{th:'รับจากแรงงาน',s:'ร้านจ่ายแรงงานตรง → แรงงานจ่ายหัวคิวคืนวิน (หัก % อัตโนมัติ)',badge:''},
};
const REPAY_RATE=0.5; // หักคืนเงินเบิกล่วงหน้า 50% ต่อรอบจ่าย (ไม่ให้ขาดรายได้จนอยู่ไม่ได้)
const DEF_SET={wageMode:'leader',dispatch:'auto',payTouch:'cash',advanceOn:true,advanceCap:900,preferredOn:true,outsideOn:true};
const winSet=(w)=>({...DEF_SET,...((w&&w.settings)||{})});
const headCutOf=(w)=>(w&&w.headCut!=null)?w.headCut:0.10;

/* migrate: ให้ข้อมูลเก่าที่ค้าง localStorage มี field ครบ */
function lw2norm(d){
  (d.wins||[]).forEach(w=>{ if(w.wallet==null)w.wallet=0; if(w.headCut==null)w.headCut=0.10; w.settings={...DEF_SET,...(w.settings||{})}; });
  (d.workers||[]).forEach(w=>{ ['pending','debt','advanceReq','paidTotal'].forEach(k=>{ if(w[k]==null)w[k]=0; }); if(!Array.isArray(w.ratings))w.ratings=[]; });
  if(!Array.isArray(d.rosterInstances))d.rosterInstances=[];
  return d;
}

/* ── รีวิว/ดาว (ระดับคน) ── */
function avgStars(w){ const r=(w&&w.ratings)||[]; return r.length? r.reduce((a,x)=>a+(x.stars||0),0)/r.length : 0; }
function StarRow({v}){ const f=Math.round(v); return <span style={{color:'#f5a623',fontSize:12,letterSpacing:.5}}>{'★★★★★'.slice(0,f)}<span style={{color:'#d4d8dd'}}>{'☆☆☆☆☆'.slice(0,5-f)}</span></span>; }

/* ── recurring roster → สร้าง instance ล่วงหน้าเป็นวันจริง ── */
function ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function instLabel(s){ const d=new Date(s+'T00:00'); return DOW[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1); }
function genRoster(st,days){ days=days||7; st.rosterInstances=st.rosterInstances||[]; const today=new Date(); let made=0;
  for(let i=0;i<days;i++){ const dt=new Date(today); dt.setDate(today.getDate()+i); const dow=dt.getDay(); const date=ymd(dt);
    (st.roster||[]).forEach(r=>{ if(!(r.days||[]).includes(dow))return; if(st.rosterInstances.some(x=>x.rosterId===r.id&&x.date===date))return;
      st.rosterInstances.push({id:uid('ri'),rosterId:r.id,shop:r.shop,market_id:r.market_id,type:r.type,time:r.time,date,win_id:r.win_id,assigned:r.assigned||null,status:'planned'}); made++; }); }
  return made;
}
function lw2load(){ try{const d=JSON.parse(localStorage.getItem(LW2_LS));return (d&&d.markets)?lw2norm(d):lw2seed();}catch(e){return lw2seed();} }

const DOW=['อา','จ','อ','พ','พฤ','ศ','ส'];

/* ── เวลา: auto mode คำนวณสถานะจากตาราง ── */
function inWindow(hhmmNow,from,to){ if(!from||!to)return false; return hhmmNow>=from&&hhmmNow<to; }
/* คืน {market,outside} ที่ "มีผลจริง" หลังคิดโหมดเวลา + กันซ้อน */
function effSwitches(w,nowStr){
  let market=!!w.marketOn, outside=!!w.outsideOn;
  if(w.timeMode==='auto'){ const on=inWindow(nowStr||HHMM(),w.schedFrom,w.schedTo); market=on; outside=!on; }
  if(w.lockOverlap&&market&&outside) outside=false; // กันซ้อน: งานตลาดชนะ
  if(w.status==='free'){ market=false; outside=true; }   // ฟรีแลนซ์ = งานนอกเท่านั้น
  if(w.status==='win') outside=false;                    // สังกัดวินอย่างเดียว = ปิดงานนอก
  return {market,outside};
}

/* GPS */
const DEMO_LOC={lat:13.9846,lng:100.6540};
function lw2geo(){ return new Promise(res=>{ if(!navigator.geolocation)return res(DEMO_LOC); navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lng:p.coords.longitude}),()=>res(DEMO_LOC),{timeout:6000,maximumAge:60000}); }); }

/* ── shared UI atoms ── */
function Hd({bg,s1,s2,children}){return <div className="hd" style={{background:bg}}><div className="s1">{s1}</div><div className="s2">{s2}</div>{children}</div>;}
function Empty({children}){return <div className="empty">{children}</div>;}
function Seg({items,val,set}){return <div className="seg">{items.map(([k,l])=><button key={k} className={val===k?'on':''} onClick={()=>set(k)}>{l}</button>)}</div>;}

Object.assign(window,{LW2_LS,B,uid,HHMM,COMM_DEFAULT,COMM_MIN,COMM_MAX,COMM_FLOOR,clampRate,winComm,JOBS_DEF,jobDef,WK_STATUS,WORKER_T,MEW,MEWIN,MESHOP,lw2seed,lw2load,DOW,inWindow,effSwitches,DEMO_LOC,lw2geo,Hd,Empty,Seg,WAGE_MODES,REPAY_RATE,DEF_SET,winSet,headCutOf,avgStars,StarRow,genRoster,instLabel,ymd});
