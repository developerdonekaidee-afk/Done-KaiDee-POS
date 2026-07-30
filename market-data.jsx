// market-data.jsx — โปรแกรมตลาด (Market OS) · window.MK
// มาตรฐานเช่าพื้นที่ (ห้าง/ตลาด) + บัญชี · multi-market (marketId) · เก็บ localStorage kd_market_v3
(function(){
  const B  = (n)=> '฿'+Math.round(Number(n)||0).toLocaleString('en-US');
  const B1 = (n)=> '฿'+(Number(n)||0).toLocaleString('en-US',{maximumFractionDigits:1});
  const TH_MON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const monthTH=(p)=>{ if(!p)return '—'; const [y,m]=p.split('-'); return TH_MON[+m-1]+' '+String(+y+543).slice(-2); };
  const thDate=(d)=>{ if(!d)return '—'; const [y,m,dd]=String(d).split('-'); return dd+'/'+m+'/'+String(+y+543).slice(-2); };
  const thDateTime=(ts)=>{ if(!ts)return '—'; const x=new Date(ts); if(isNaN(x.getTime()))return '—'; return thDate(x.toISOString().slice(0,10))+' '+x.toTimeString().slice(0,5); };
  const pad=(n)=>String(n).padStart(2,'0');
  const mkTs=(per,day,rf)=>new Date(per+'-'+pad(day)+'T'+pad(9+Math.floor(rf()*8))+':'+pad(Math.floor(rf()*60))+':00').getTime();
  const periodKey=(off)=>{ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-(off||0)); return d.toISOString().slice(0,7); };
  const addMonths=(p,n)=>{ const [y,m]=p.split('-').map(Number); const d=new Date(y,m-1+n,1); return d.toISOString().slice(0,7); };
  const todayISO=()=> new Date().toISOString().slice(0,10);
  function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const ph=(r)=>'08'+(2+Math.floor(r()*7))+'-'+String(100+Math.floor(r()*900))+'-'+String(1000+Math.floor(r()*9000));

  const UNIT_TYPES={ wet_stall:'แผงสด', dry_lock:'ล็อกของแห้ง', kiosk:'คีออส', shop:'ร้าน/ยูนิต', space:'พื้นที่เช่า' };
  const MARKET_TYPES={ wet:'ตลาดสด', flea:'ตลาดนัด', community:'คอมมูนิตี้มอลล์', mall:'ศูนย์การค้า' };
  const RENT_MODELS={ fixed:'เหมาจ่าย/เดือน', per_sqm:'฿/ตร.ม./เดือน', gp:'GP จากยอดขาย' };

  // ── จำนวนเงินเป็นตัวอักษร (บาท) ──
  function bahtText(n){
    n=Math.round((Number(n)||0)*100)/100; const bt=Math.floor(n), st=Math.round((n-bt)*100);
    const T=['','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'], P=['','สิบ','ร้อย','พัน','หมื่น','แสน'];
    const grp=(g)=>{ g=String(+g); if(g==='0')return ''; let s=''; const L=g.length;
      for(let i=0;i<L;i++){ const d=+g[i], p=L-1-i; if(!d)continue;
        if(p===0){ s+=(d===1&&L>1)?'เอ็ด':T[d]; }
        else if(p===1){ s+=(d===1?'':(d===2?'ยี่':T[d]))+'สิบ'; }
        else s+=T[d]+P[p]; } return s; };
    let w=''; if(bt===0) w='ศูนย์'; else { const gs=[]; let s=String(bt); while(s.length){ gs.unshift(s.slice(-6)); s=s.slice(0,-6);} w=gs.map(grp).join('ล้าน'); }
    let r=w+'บาท'; r+= st===0?'ถ้วน':(grp(String(st))+'สตางค์'); return r;
  }

  // ── คำนวณค่าเช่า/ค่าส่วนกลาง ──
  function calcRent(u, sales){ if(u.rentModel==='per_sqm') return Math.round((u.rentPerSqm||0)*(u.area||0));
    if(u.rentModel==='gp') return Math.max(u.minG||0, Math.round((sales||0)*(u.gpRate||0)/100)); return u.rent||0; }
  function calcService(u){ return Math.round((u.camPerSqm||0)*(u.area||0)); }

  // spec object: {code,zone,type,area,cat,vendor,rentModel, rent|rentPerSqm|{gpRate,minG,base}, cam, deposit} | {code,zone,type,area,vacant:true}
  const M4=[
    {code:'A-01',zone:'A',type:'wet_stall',area:6,cat:'ผักสวนครัว',vendor:'ร้านป้าสมจิตร',rentModel:'fixed',rent:4200},
    {code:'A-02',zone:'A',type:'wet_stall',area:6,cat:'ผักปลอดสาร',vendor:'สวนผักลุงมี',rentModel:'fixed',rent:4500},
    {code:'A-03',zone:'A',type:'wet_stall',area:8,cat:'ผลไม้รวม',vendor:'ผลไม้เจ๊หงษ์',rentModel:'gp',gpRate:10,minG:5000,base:86000},
    {code:'A-04',zone:'A',type:'wet_stall',area:6,cat:'พริก/หอม/กระเทียม',vendor:'เครื่องแกงแม่ประนอม',rentModel:'fixed',rent:3800},
    {code:'A-05',zone:'A',type:'wet_stall',area:7,cat:'เห็ด/ผักสลัด',vendor:'ฟาร์มเห็ดบ้านสวน',rentModel:'fixed',rent:4000},
    {code:'A-06',zone:'A',type:'wet_stall',area:6,vacant:true},
    {code:'A-07',zone:'A',type:'wet_stall',area:8,cat:'ผลไม้ตามฤดู',vendor:'ร้านลุงชัย',rentModel:'fixed',rent:4200},
    {code:'B-01',zone:'B',type:'wet_stall',area:9,cat:'หมูสด',vendor:'เขียงหมูเฮียตี๋',rentModel:'fixed',rent:6500},
    {code:'B-02',zone:'B',type:'wet_stall',area:10,cat:'ไก่สด',vendor:'ฟาร์มไก่รุ่งเรือง',rentModel:'gp',gpRate:9,minG:6000,base:112000},
    {code:'B-03',zone:'B',type:'wet_stall',area:10,cat:'ปลา/อาหารทะเล',vendor:'ทะเลสดเจ๊แดง',rentModel:'fixed',rent:6800},
    {code:'B-04',zone:'B',type:'wet_stall',area:9,cat:'เนื้อวัว',vendor:'เขียงเนื้อโคขุน',rentModel:'fixed',rent:6200},
    {code:'B-05',zone:'B',type:'wet_stall',area:9,vacant:true},
    {code:'B-06',zone:'B',type:'wet_stall',area:9,cat:'กุ้ง/หอย',vendor:'ซีฟู้ดน้องเมย์',rentModel:'fixed',rent:6600},
    {code:'C-01',zone:'C',type:'shop',area:14,cat:'ข้าวแกงตามสั่ง',vendor:'ครัวแม่ศรี',rentModel:'gp',gpRate:12,minG:4500,base:74000},
    {code:'C-02',zone:'C',type:'dry_lock',area:9,cat:'ของแห้ง/เครื่องปรุง',vendor:'ร้านชำเจ๊กิม',rentModel:'fixed',rent:3600},
    {code:'C-03',zone:'C',type:'shop',area:12,cat:'ก๋วยเตี๋ยว',vendor:'ก๋วยเตี๋ยวเรือลุงหนวด',rentModel:'gp',gpRate:11,minG:4000,base:68000},
    {code:'C-04',zone:'C',type:'dry_lock',area:8,cat:'ขนมไทย',vendor:'ขนมหวานป้าละมัย',rentModel:'fixed',rent:3400},
    {code:'C-05',zone:'C',type:'dry_lock',area:8,cat:'น้ำพริก/อาหารพื้นบ้าน',vendor:'ครัวอีสานแซ่บ',rentModel:'fixed',rent:3500},
    {code:'C-06',zone:'C',type:'dry_lock',area:7,cat:'ผลไม้ดอง/ของทานเล่น',vendor:'ร้านจุกจิก',rentModel:'fixed',rent:3200},
    {code:'C-07',zone:'C',type:'dry_lock',area:7,vacant:true},
    {code:'C-08',zone:'C',type:'dry_lock',area:7,vacant:true},
  ];
  const MRK=[
    {code:'A-01',zone:'A',type:'wet_stall',area:6,cat:'ผักสด',vendor:'ร้านลุงพร',rentModel:'fixed',rent:3200},
    {code:'A-02',zone:'A',type:'wet_stall',area:6,cat:'ผลไม้',vendor:'เจ๊ปุ๊กผลไม้',rentModel:'fixed',rent:3400},
    {code:'A-03',zone:'A',type:'wet_stall',area:6,cat:'เห็ด/ผักสลัด',vendor:'สวนเห็ดริมคลอง',rentModel:'fixed',rent:3200},
    {code:'A-04',zone:'A',type:'wet_stall',area:6,vacant:true},
    {code:'B-01',zone:'B',type:'wet_stall',area:8,cat:'หมู/ไก่',vendor:'เขียงพี่นก',rentModel:'fixed',rent:5200},
    {code:'B-02',zone:'B',type:'wet_stall',area:8,cat:'ปลาสด',vendor:'ร้านปลาเช้า',rentModel:'fixed',rent:5000},
    {code:'B-03',zone:'B',type:'wet_stall',area:8,cat:'กุ้ง/หอย',vendor:'ทะเลสดริมคลอง',rentModel:'fixed',rent:5400},
    {code:'C-01',zone:'C',type:'shop',area:12,cat:'ข้าวแกง',vendor:'ครัวป้าน้อย',rentModel:'gp',gpRate:10,minG:3800,base:52000},
    {code:'C-02',zone:'C',type:'dry_lock',area:7,cat:'กาแฟ/ชา',vendor:'คอฟฟี่คลอง',rentModel:'fixed',rent:2800},
    {code:'C-03',zone:'C',type:'dry_lock',area:7,cat:'ของแห้ง/ชำ',vendor:'ร้านชำริมคลอง',rentModel:'fixed',rent:3000},
    {code:'C-04',zone:'C',type:'dry_lock',area:6,vacant:true},
    {code:'C-05',zone:'C',type:'dry_lock',area:6,cat:'ขนมไทย',vendor:'ป้าหวานขนม',rentModel:'fixed',rent:2600},
  ];
  // คอมมูนิตี้มอลล์ — per_sqm + ค่าส่วนกลาง (CAM) + GP anchor
  const MML=[
    {code:'G-01',zone:'G',type:'shop',area:85,cat:'ซูเปอร์มาร์เก็ต',vendor:'เฟรชมาร์ท',rentModel:'gp',gpRate:6,minG:52000,base:920000,cam:120},
    {code:'G-02',zone:'G',type:'shop',area:42,cat:'ร้านกาแฟ',vendor:'บราวน์ คอฟฟี่',rentModel:'per_sqm',rentPerSqm:820,cam:120},
    {code:'G-03',zone:'G',type:'shop',area:60,cat:'ร้านอาหารญี่ปุ่น',vendor:'ซากุระ ราเมน',rentModel:'gp',gpRate:12,minG:48000,base:560000,cam:120},
    {code:'G-04',zone:'G',type:'kiosk',area:6,cat:'ชานมไข่มุก',vendor:'ชาบาร์',rentModel:'fixed',rent:18000,cam:120},
    {code:'G-05',zone:'G',type:'kiosk',area:6,vacant:true},
    {code:'F1-01',zone:'F1',type:'shop',area:55,cat:'แฟชั่นสตรี',vendor:'ลาแมสง์ บูทีค',rentModel:'per_sqm',rentPerSqm:760,cam:110},
    {code:'F1-02',zone:'F1',type:'shop',area:38,cat:'รองเท้า/กระเป๋า',vendor:'สเต็ปส์',rentModel:'per_sqm',rentPerSqm:760,cam:110},
    {code:'F1-03',zone:'F1',type:'shop',area:30,cat:'เครื่องสำอาง',vendor:'กลอสซี่',rentModel:'per_sqm',rentPerSqm:790,cam:110},
    {code:'F1-04',zone:'F1',type:'kiosk',area:5,cat:'เคสมือถือ',vendor:'ม็อบสไตล์',rentModel:'fixed',rent:16000,cam:110},
    {code:'F1-05',zone:'F1',type:'shop',area:44,vacant:true},
    {code:'F2-01',zone:'F2',type:'shop',area:70,cat:'ฟิตเนส',vendor:'ฟิตโซน',rentModel:'per_sqm',rentPerSqm:680,cam:100},
    {code:'F2-02',zone:'F2',type:'shop',area:48,cat:'คลินิกความงาม',vendor:'กลาสสกิน คลินิก',rentModel:'per_sqm',rentPerSqm:720,cam:100},
    {code:'F2-03',zone:'F2',type:'shop',area:35,cat:'ร้านทำผม',vendor:'เดอะ บาร์เบอร์',rentModel:'per_sqm',rentPerSqm:700,cam:100},
    {code:'F2-04',zone:'F2',type:'shop',area:40,vacant:true},
  ];

  const MARKETS=[
    {id:'mkt-4mm',name:'ตลาดกลางลาดสวาย',mtype:'wet',account:'บจก. ตลาดกลางลาดสวาย',registered:true,vat:true,vatRate:7,taxId:'0-1355-48000-12-3',
     address:'เลขที่ 99 ถ.เลียบคลองสอง ต.ลาดสวาย อ.ลำลูกกา จ.ปทุมธานี 12150',phone:'02-995-1234',email:'billing@ladsawai-market.co.th',promptpay:'0-9455-00123-4',
     owner:'คุณสมชาย วัฒนกิจ',ownerLine:true,elecRate:7,waterRate:18,seed:42,
     zones:{A:'โซน A · ผักสด & ผลไม้',B:'โซน B · เนื้อสัตว์ & อาหารทะเล',C:'โซน C · อาหารปรุง/ของแห้ง'},specs:M4},
    {id:'mkt-rk',name:'ตลาดเช้าริมคลอง',mtype:'wet',account:'ตลาดเช้าริมคลอง (เจ้าของคนเดียว)',registered:false,vat:false,vatRate:0,taxId:'',
     address:'88 ริมคลองประปา เขตหลักสี่ กรุงเทพฯ 10210',phone:'02-573-4567',email:'admin@rimkhlong.market',promptpay:'0-9455-00876-1',
     owner:'คุณมาลี ศรีสุข',ownerLine:true,elecRate:7,waterRate:18,seed:77,
     zones:{A:'โซน A · ผักสด & ผลไม้',B:'โซน B · เนื้อ & อาหารทะเล',C:'โซน C · ของแห้ง/ปรุง'},specs:MRK},
    {id:'mkt-ml',name:'เดอะพลาซ่า คอมมูนิตี้มอลล์',mtype:'community',account:'บจก. เดอะพลาซ่า รีเทล',registered:true,vat:true,vatRate:7,taxId:'0-1055-60077-88-1',
     address:'199 ถ.นิมิตใหม่ เขตคลองสามวา กรุงเทพฯ 10510',phone:'02-914-7788',email:'leasing@theplaza.co.th',promptpay:'0-9455-00532-9',
     owner:'คุณเอกชัย ธนโชติ',ownerLine:true,elecRate:8,waterRate:22,seed:99,
     zones:{G:'ชั้น G · Food & Grocery',F1:'ชั้น 1 · Fashion & Lifestyle',F2:'ชั้น 2 · Services & Wellness'},specs:MML},
  ];

  function genStalls(m){
    const r=rng(m.seed); const P=[periodKey(2),periodKey(1),periodKey(0)]; const stalls=[],bills=[]; let occIdx=0;
    m.specs.forEach(sp=>{
      const st={ id:m.id+'|'+sp.code, marketId:m.id, code:sp.code, zone:sp.zone, zoneName:m.zones[sp.zone]||sp.zone,
        unitType:sp.type, area:sp.area, cat:sp.cat||UNIT_TYPES[sp.type], camPerSqm:sp.cam||0, status:sp.vacant?'vacant':'occupied', locked:false };
      if(!sp.vacant){
        st.vendor=sp.vendor; st.phone=ph(r); st.line=r()<0.72;
        st.rentModel=sp.rentModel; st.rent=sp.rent||0; st.rentPerSqm=sp.rentPerSqm||0;
        st.gpRate=sp.gpRate||0; st.minG=sp.minG||0; st.baseSales=sp.base||0;
        st.deposit=sp.deposit|| (sp.rentModel==='gp'?sp.minG*2:Math.round(calcRent(st)*2));
        const start=addMonths(P[0],-(2+Math.floor(r()*22))); st.contractStart=start+'-01'; st.contractEnd=addMonths(start,12+Math.floor(r()*24))+'-28';
        st.elecRead=1200+Math.floor(r()*3000); st.waterRead=200+Math.floor(r()*600); occIdx++;
        let eR=st.elecRead-Math.floor(r()*260)-360, wR=st.waterRead-Math.floor(r()*40)-58;
        P.forEach((per,pi)=>{
          const eU=90+Math.floor(r()*180), wU=8+Math.floor(r()*22);
          const gpSales=sp.rentModel==='gp'? Math.round(st.baseSales*(0.82+r()*0.4)) : 0;
          const rent=calcRent(st,gpSales), service=calcService(st);
          const elecAmt=eU*m.elecRate, waterAmt=wU*m.waterRate, total=rent+service+elecAmt+waterAmt;
          const bill={ id:'bill_'+m.id+'_'+sp.code+'_'+per, marketId:m.id, stallId:st.id, period:per, rentModel:sp.rentModel,
            rent, service, gpSales, gpRate:st.gpRate, minG:st.minG,
            elecPrev:eR,elecCur:eR+eU,elecUnits:eU,elecAmt, waterPrev:wR,waterCur:wR+wU,waterUnits:wU,waterAmt,
            total, due:per+'-10', ref:'PP'+per.replace('-','')+sp.code.replace('-','') };
          eR+=eU; wR+=wU;
          if(pi<2){ bill.status='paid'; bill.method=r()<0.85?'promptpay':'transfer'; bill.paidAt=mkTs(per,3+Math.floor(r()*6),r); }
          else { const b=occIdx%7;
            if(b<=3){ bill.status='paid'; bill.method=r()<0.8?'promptpay':'transfer'; bill.paidAt=mkTs(per,6+Math.floor(r()*12),r); }
            else if(b===4){ bill.status='pending'; bill.due=per+'-28'; }
            else if(b===5){ bill.status='overdue'; bill.due=per+'-10'; st.locked=true; }
            else bill._skip=true; }
          if(!bill._skip) bills.push(bill);
        });
      }
      stalls.push(st);
    });
    return {stalls,bills};
  }
  function blankStalls(mid, zones){ const out=[]; Object.entries(zones||{A:6,B:4,C:6}).forEach(([z,n])=>{
    for(let i=1;i<=n;i++){ const code=z+'-'+pad(i); out.push({id:mid+'|'+code,marketId:mid,code,zone:z,zoneName:'โซน '+z,unitType:'wet_stall',area:6,cat:'แผงค้า',camPerSqm:0,status:'vacant',locked:false}); } }); return out; }

  function makeSeed(){
    const markets=[],stalls=[],bills=[];
    MARKETS.forEach(m=>{ const {specs,seed,zones,...meta}=m; markets.push({...meta,zones,curPeriod:periodKey(0)});
      const g=genStalls(m); stalls.push(...g.stalls); bills.push(...g.bills); });
    const applications=[
      {id:'app1',marketId:'mkt-4mm',name:'ร้านน้ำพริกแม่ทองดี',contact:'ทองดี ใจงาม',phone:'081-445-2298',cat:'น้ำพริก/ของฝาก',model:'fixed',line:true,note:'อยากได้แผงโซน C ใกล้ทางเข้า',status:'pending',createdAt:Date.now()-2*864e5},
      {id:'app2',marketId:'mkt-4mm',name:'สวนผักอินทรีย์ลุงคำ',contact:'คำ อินทวงศ์',phone:'089-112-7746',cat:'ผักอินทรีย์',model:'fixed',line:false,note:'มีผักส่งทุกเช้า',status:'pending',createdAt:Date.now()-1*864e5},
      {id:'app3',marketId:'mkt-ml',name:'ร้านไอศกรีมโฮมเมด',contact:'พิมพ์ชนก ว.',phone:'062-778-1120',cat:'ไอศกรีม/ของหวาน',model:'gp',line:true,note:'สนใจคีออสชั้น G',status:'pending',createdAt:Date.now()-3*864e5},
    ];
    const expenses=[]; const EXP=[['ค่าไฟฟ้าส่วนกลาง (การไฟฟ้าฯ)',28000],['ค่าน้ำประปา',9500],['บริการทำความสะอาด',18000],['รปภ.รักษาความปลอดภัย',22000],['กำจัดขยะ/สิ่งปฏิกูล',12000]];
    const supTax=['0-1055-33001-22-1','0-1055-33002-19-7','0-1055-33003-45-2','0-9945-00112-33-8','0-1055-33004-77-0'];
    MARKETS.filter(m=>m.vat).forEach(m=>{ [periodKey(2),periodKey(1),periodKey(0)].forEach((per,pi)=>{ const rr=rng(m.seed+pi*13);
      EXP.forEach((e,ei)=>{ if(pi<2||rr()<0.8){ const g=Math.round(e[1]*(0.9+rr()*0.25)); const base=Math.round(g/1.07*100)/100;
        expenses.push({id:'exp_'+m.id+'_'+per+'_'+ei,marketId:m.id,date:per+'-0'+(2+ei),note:e[0],supplierTaxId:supTax[ei],hasVat:true,vatBase:base,vat:Math.round((g-base)*100)/100,total:g}); } }); }); });
    const users=[];
    MARKETS.forEach(m=>{ users.push(
      {id:'u_'+m.id+'_1',marketId:m.id,name:m.owner,role:'owner',phone:'—',active:true},
      {id:'u_'+m.id+'_2',marketId:m.id,name:'ผู้จัดการตลาด',role:'manager',phone:'08x-xxx-1111',active:true},
      {id:'u_'+m.id+'_3',marketId:m.id,name:'ฝ่ายการเงิน/บัญชี',role:'finance',phone:'08x-xxx-2222',active:true},
      {id:'u_'+m.id+'_4',marketId:m.id,name:'เจ้าหน้าที่เก็บค่าเช่า',role:'collector',phone:'08x-xxx-3333',active:true}
    ); });
    // ── ขายฝาก (ร้านของฝากกลาง/ชั้นวางฝากขาย) — seed เฉพาะตลาดชุมชน/มอลล์ ──
    const cVendors=[], cStock=[];
    const CV=[['กลุ่มแม่บ้านสวนผัก','081-234-9001','กสิกรไทย','012-3-45678-9'],['วิสาหกิจชุมชน OTOP','089-556-9002','กรุงไทย','012-3-45679-0'],['ฟาร์มอินทรีย์บ้านนา','062-778-9003','ออมสิน','012-3-45680-6']];
    const CS=[['น้ำพริกเผาสูตรย่า','CS.001',0,55,'per_sale',25,42,'กระปุก'],['น้ำผึ้งสด','CS.002',0,120,'per_sale',20,18,'ขวด'],['ข้าวกล้องหอมมะลิ','CS.003',1,45,'wholesale',0,60,'ถุง',30],['ผ้าทอมือชุมชน','CS.010',1,350,'per_sale',30,12,'ผืน'],['ชั้นวางของฝากหน้าตลาด','CS.011',1,0,'rental',0,0,'-',0,3000],['น้ำผู้งสด (ขวด)','CS.004',0,25,'per_sale',20,0,'ขวด']];
    MARKETS.forEach((m,mi)=>{ if(mi>1) return; const vids=CV.map((v,i)=>{ const id='cv_'+m.id+'_'+i; cVendors.push({id,marketId:m.id,name:v[0],phone:v[1],province:v[2],taxId:v[3],bank:'กสิกรไทย',acctNo:'xxx-x-'+(10000+i*137)}); return id; });
      CS.forEach((c,i)=>{ const r2=rng(m.seed+i*7); cStock.push({id:'cst_'+m.id+'_'+i,marketId:m.id,vendorId:vids[i%vids.length],name:c[0],sku:c[1],direction:'inbound',price:c[3],settleModel:c[4],sharePct:c[5],stock:c[2],unit:c[7],low:5,rentalFee:c[8]||0,_sold:c[6]}); }); });
    return { markets, stalls, bills, applications, expenses, users, cVendors, cStock, consignOn:{}, ver:10 };
  }
  const LS='kd_market_v3';
  function load(){ try{ const j=JSON.parse(localStorage.getItem(LS)); const cur=periodKey(0);
    if(j&&j.ver===10&&j.markets&&j.bills&&j.bills.some(b=>b.period===cur)) return j; }catch(e){} const s=makeSeed(); save(s); return s; }
  function save(d){ try{ d.updatedAt=Date.now(); localStorage.setItem(LS,JSON.stringify(d)); }catch(e){} }
  function reset(){ const s=makeSeed(); save(s); return s; }

  function qrSVG(seed){ const N=21; let h=0; for(let i=0;i<seed.length;i++){ h=(h*31+seed.charCodeAt(i))>>>0; }
    const rnd=rng(h); const cells=[]; for(let y=0;y<N;y++)for(let x=0;x<N;x++){ if(rnd()>0.5) cells.push([x,y]); }
    const fin=(ox,oy)=>`<rect x="${ox}" y="${oy}" width="7" height="7" fill="#0E2A2A"/><rect x="${ox+1}" y="${oy+1}" width="5" height="5" fill="#fff"/><rect x="${ox+2}" y="${oy+2}" width="3" height="3" fill="#0E2A2A"/>`;
    let body=''; cells.forEach(([x,y])=>{ if((x<8&&y<8)||(x>N-9&&y<8)||(x<8&&y>N-9))return; body+=`<rect x="${x}" y="${y}" width="1" height="1" fill="#0E2A2A"/>`; });
    return `<svg viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="${N}" height="${N}" fill="#fff"/>${body}${fin(0,0)}${fin(N-7,0)}${fin(0,N-7)}</svg>`; }

  // VAT breakdown จากยอดรวม (ราคารวม VAT แล้ว) ตามตลาด
  function vatBreak(total, market){ if(!market||!market.vat){ return {vat:false,base:total,vatAmt:0,grand:total,rate:0}; }
    const rate=market.vatRate||7; const base=Math.round(total/(1+rate/100)*100)/100; return {vat:true,base,vatAmt:Math.round((total-base)*100)/100,grand:total,rate}; }

  // ── แม่แบบสัญญาเช่า (ตลาดแก้/วางเองได้ · เติมตัวแปรอัตโนมัติ) ──
  const CONTRACT_VARS=[['{{ตลาด}}','ชื่อ/นิติบุคคลตลาด'],['{{เลขผู้เสียภาษีตลาด}}','เลขภาษีตลาด'],['{{ที่อยู่ตลาด}}','ที่อยู่ตลาด'],['{{ผู้เช่า}}','ชื่อ-นามสกุลผู้เช่า'],['{{ร้าน}}','ชื่อร้าน'],['{{เบอร์}}','เบอร์ผู้เช่า'],['{{ยูนิต}}','รหัสยูนิต/แผง'],['{{ประเภทยูนิต}}','ประเภทยูนิต'],['{{พื้นที่}}','ขนาด ตร.ม.'],['{{ค่าเช่า}}','อัตราค่าเช่า'],['{{ค่าส่วนกลาง}}','ค่าส่วนกลาง'],['{{ประกัน}}','เงินประกัน'],['{{เริ่ม}}','วันเริ่มสัญญา'],['{{หมด}}','วันหมดสัญญา'],['{{วันที่}}','วันที่ทำสัญญา'],['{{พร้อมเพย์}}','บัญชี PromptPay']];
  const DEFAULT_CLAUSES='๑. ผู้เช่าตกลงชำระค่าเช่า ค่าบริการส่วนกลาง และค่าสาธารณูปโภคตามอัตราข้างต้นภายในวันที่ ๑๐ ของทุกเดือน ผ่าน PromptPay บัญชีกลาง {{พร้อมเพย์}}\n๒. กรณีค้างชำระเกินกำหนด ผู้ให้เช่ามีสิทธิ์ระงับการใช้พื้นที่/สิทธิ์การขายชั่วคราวจนกว่าจะชำระครบ\n๓. เงินประกัน {{ประกัน}} จะคืนเมื่อสิ้นสุดสัญญาและส่งมอบพื้นที่ในสภาพเรียบร้อย หักค่าเสียหาย (ถ้ามี)\n๔. ผู้เช่าต้องใช้พื้นที่ตามประเภทกิจการที่ระบุ และปฏิบัติตามระเบียบของตลาดโดยเคร่งครัด\n๕. หากผู้เช่าประสงค์จะเลิกสัญญาก่อนกำหนด ต้องแจ้งล่วงหน้าไม่น้อยกว่า ๓๐ วัน';
  function fillDoc(text, vars){ let s=String(text||''); Object.keys(vars||{}).forEach(k=>{ s=s.split('{{'+k+'}}').join(vars[k]==null?'':String(vars[k])); }); return s; }

  // คำนวณบัญชีขายฝากต่อรายการ (ตรงกับ KaiDee POS settleLine)
  function consignLine(cs){ const sold=Number(cs._sold)||0; const price=Number(cs.price)||0; const gross=sold*price;
    if(cs.settleModel==='wholesale'){ return {gross,shopCut:gross,payout:0,gp:(price-(Number(cs.costWholesale)||price*0.6))*sold}; }
    if(cs.settleModel==='rental'){ return {gross,shopCut:Number(cs.rentalFee)||0,payout:gross,rental:Number(cs.rentalFee)||0}; }
    const pct=Number(cs.sharePct)||0; const cut=Math.round(gross*pct/100); return {gross,shopCut:cut,payout:gross-cut}; }

  // ── หมวดหมู่สินค้า (จัดกลุ่ม+สี — ใช้ลงสีผังตลาด/เตือนสินค้าซ้ำ) ──
  const CATEGORIES=[
    {id:'veg',th:'ผัก/ผลไม้',icon:'🥬',color:'#4CAF50',kw:['ผัก','ผลไม้','เห็ด','สลัด','พริก','หอม','กระเทียม','สวน','อินทรีย์']},
    {id:'meat',th:'เนื้อสัตว์/ทะเล',icon:'🥩',color:'#E0533D',kw:['หมู','ไก่','เนื้อ','ปลา','กุ้ง','หอย','ทะเล','เขียง','ซีฟู้ด']},
    {id:'cooked',th:'อาหารปรุง',icon:'🍲',color:'#E8992F',kw:['ข้าวแกง','ตามสั่ง','ก๋วยเตี๋ยว','อาหาร','ครัว','ราเมน','ญี่ปุ่น','อีสาน','น้ำพริก']},
    {id:'dessert',th:'ของหวาน/เบเกอรี่',icon:'🍰',color:'#C77DBB',kw:['ขนม','ของหวาน','ไอศกรีม','เบเกอ','เค้ก','ดอง']},
    {id:'drink',th:'เครื่องดื่ม/กาแฟ',icon:'☕',color:'#8D6E63',kw:['กาแฟ','ชา','ชานม','ไข่มุก','เครื่องดื่ม','คอฟฟี่','น้ำผลไม้']},
    {id:'dry',th:'ของแห้ง/ของชำ',icon:'🛍️',color:'#7A8C8C',kw:['ของแห้ง','ชำ','เครื่องปรุง','ข้าวสาร','ของฝาก','น้ำผึ้ง']},
    {id:'fashion',th:'แฟชั่น/เครื่องแต่งกาย',icon:'👕',color:'#1E73B0',kw:['เสื้อ','แฟชั่น','รองเท้า','กระเป๋า','ผ้า','บูทีก']},
    {id:'beauty',th:'ความงาม/สุขภาพ',icon:'💄',color:'#7a4a8c',kw:['เครื่องสำอาง','ความงาม','คลินิก','ผม','สปา','ฟิตเนส','สกิน']},
    {id:'gadget',th:'มือถือ/แกดเจ็ต',icon:'📱',color:'#455A64',kw:['เคส','มือถือ','แกดเจ็ต']},
    {id:'other',th:'อื่นๆ',icon:'🏷️',color:'#9E9E9E',kw:[]},
  ];
  function catGroup(cat){ const s=String(cat||''); for(const g of CATEGORIES){ if(g.kw.some(k=>s.indexOf(k)>=0)) return g; } return CATEGORIES[CATEGORIES.length-1]; }
  function daysTo(d){ if(!d)return null; return Math.round((new Date(d)-new Date())/864e5); }
  // ── เงื่อนไขการจอง/การเช่า (ตลาดตั้งค่าเอง · เก็บ market.booking) ──
  function bookingCfg(market){ const b=(market&&market.booking)||{}; return Object.assign({
    priceMode:'range', zoneMode:{}, paths:Object.assign({appt:true,deposit:true,full:true},b.paths||{}),
    apptDepositOn:b.apptDepositOn!==false, apptDeposit:b.apptDeposit!=null?b.apptDeposit:300, idVerifyAppt:!!b.idVerifyAppt,
    depositRule:b.depositRule||'onemonth', depositFixed:b.depositFixed!=null?b.depositFixed:5000,
    holdDays:b.holdDays!=null?b.holdDays:7, showLeaseEnd:b.showLeaseEnd!==false,
    dailyOn:!!b.dailyOn, dailyRate:b.dailyRate!=null?b.dailyRate:150, dailyUtil:b.dailyUtil!=null?b.dailyUtil:20, dailyEquip:b.dailyEquip||'',
    openDays:b.openDays||[0,1,2,3,4,5,6], openTime:b.openTime||'06:00', closeTime:b.closeTime||'18:00',
    fullTerms:b.fullTerms||'ค่าเช่าเดือนแรก + เงินประกัน 1 เดือน',
    promptpay:(market&&market.promptpay)||'' }, b, {paths:Object.assign({appt:true,deposit:true,full:true},b.paths||{}), zoneMode:b.zoneMode||{}, openDays:b.openDays||[0,1,2,3,4,5,6]}); }
  function zonePriceMode(market,zone){ const c=bookingCfg(market); return c.zoneMode[zone]||c.priceMode; }
  // เรตค่าเช่าตามประเภทสินค้า (฿/ตร.ม./เดือน) — แนะนำค่าเช่าตอนตั้งแผง/จัดลง
  function catRateFor(market, cat, area){ const cr=(market&&market.catRates)||{}; const g=catGroup(cat); const ps=cr[g.id]; if(!ps) return 0; return Math.round(ps*(area||1)/100)*100; }
  // ── การออกบิล & แจ้งเตือน (ตลาดกำหนด · เก็บ market.billing) ──
  function billCfg(market){ const b=(market&&market.billing)||{}; return Object.assign({
    dueDay:10, autoFixed:true, remindBefore:2, remindOverdue:true }, b); }
  // โหมดรับเงินระดับตลาด: 'promptpay' (สแกนเข้าบัญชีกลาง+จับคู่) | 'wallet' (กระเป๋าเงินตลาด) | 'both' (ช่วงเปลี่ยนผ่าน)
  function payMode(market){ const m=(market&&market.payMode); return m==='wallet'||m==='both'?m:'promptpay'; }
  // ค่าเช่าโดยประมาณของแผงว่าง (เฉลี่ย ฿/ตร.ม. ของร้านที่เช่าอยู่ในโซนเดียวกัน × ขนาด)
  function typicalRent(allStalls, stall){ if(!stall)return 0;
    const per=(list)=>{ const f=list.filter(s=>s.status==='occupied'&&s.rentModel!=='gp'&&s.area>0); return f.length? f.reduce((a,s)=>a+calcRent(s)/s.area,0)/f.length : 0; };
    const same=allStalls.filter(s=>s.marketId===stall.marketId&&s.zone===stall.zone);
    let ps=per(same); if(!ps) ps=per(allStalls.filter(s=>s.marketId===stall.marketId)); if(!ps) ps=600;
    return Math.round(ps*(stall.area||6)/50)*50; }

  window.MK={ B,B1,monthTH,thDate,thDateTime,periodKey,addMonths,todayISO,UNIT_TYPES,MARKET_TYPES,RENT_MODELS,
    bahtText,calcRent,calcService,vatBreak,makeSeed,load,save,reset,qrSVG,blankStalls,CONTRACT_VARS,DEFAULT_CLAUSES,fillDoc,consignLine,
    CATEGORIES,catGroup,daysTo,bookingCfg,zonePriceMode,typicalRent,billCfg,catRateFor,payMode };
})();
