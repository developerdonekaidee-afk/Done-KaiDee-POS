// fitness-pos.jsx — โมดูลฟิตเนสในแอป POS (ฝั่งเจ้าของ/พนักงาน) · ทำงานจริง localStorage kd_fitness_v1
const { useState } = React;
const F = window.FIT;
const { B, pad, todayISO, isoAdd, daysTo, thDate, thTime, thDateTime, DOW_FULL, memberStatus, canEnter, PRICING, appFee } = F;
const qrSVG = window.MK.qrSVG;
const nf=(n)=>(Number(n)||0).toLocaleString('en-US');
const pkgOf=(d,id)=>d.packages.find(p=>p.id===id);
const trStaffOf=(d,id)=>(d.staff||[]).find(s=>s.role==='trainer'&&(s.trainerId||('tr-'+s.id.replace(/^st-/,'')))===id);
const trOf=(d,id)=>{ const t=(d.trainers||[]).find(t=>t.id===id); if(!t) return t; const s=trStaffOf(d,id); return s?{...t,name:s.name,active:s.active}:t; };
const mbOf=(d,id)=>d.members.find(m=>m.id===id);
const firstName=(n)=>(n||'').split(' ')[0];
// ═══ แพ็กเกจโปรแกรม (คิดราคาตามจำนวนสมาชิก active · ฟรี 50 · Pro ไม่จำกัด) ═══
const FIT_TIERS=[
  {id:'free',th:'ฟรี',cap:50,price:0,sub:'เริ่มต้นใช้งานจริง'},
  {id:'starter',th:'เริ่มต้น',cap:200,price:590,sub:'ร้านกำลังโต'},
  {id:'grow',th:'เติบโต',cap:500,price:1290,sub:'หลายสาขา/สมาชิกเยอะ'},
  {id:'pro',th:'Pro · ไม่จำกัด',cap:Infinity,price:2490,sub:'ไม่จำกัดสมาชิก + ฟีเจอร์ครบ'},
];
const fitTierOf=(id)=>FIT_TIERS.find(t=>t.id===id)||FIT_TIERS[0];
const fitPlan=(d)=>fitTierOf((d.plan&&d.plan.tier)||'free');
const memberCounts=(m)=>{ const k=memberStatus(m).key; return !m.archived&&(k==='active'||k==='expiring'); };
const activeMemberCount=(d)=>(d.members||[]).filter(memberCounts).length;
const fitCapLeft=(d)=>{ const c=fitPlan(d).cap; return c===Infinity?Infinity:Math.max(0,c-activeMemberCount(d)); };
const fitOverCap=(d)=>fitCapLeft(d)<=0;
const csv=(name,rows)=>{ const s=rows.map(r=>r.map(c=>{c=String(c==null?'':c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;}).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+s],{type:'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();a.remove(); };
/* ── นำเข้า CSV/Excel: parser + parse วันที่ (รองรับ พ.ศ.) ── */
function parseCSV(text){ text=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  const nl=text.indexOf('\n'); const firstLine=nl<0?text:text.slice(0,nl);
  const delim=(firstLine.split('\t').length>firstLine.split(',').length)?'\t':',';
  const rows=[]; let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){ const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else if(c==='"')q=true; else if(c===delim){row.push(cur);cur='';} else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur='';} else cur+=c; }
  if(cur!==''||row.length){row.push(cur);rows.push(row);}
  return rows.filter(r=>r.some(c=>String(c).trim()!==''));
}
function pad2(n){return String(n).padStart(2,'0');}
function parseDate(s){ s=String(s||'').trim(); if(!s)return null;
  let m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if(m){ let y=+m[1]; if(y>2400)y-=543; return y+'-'+pad2(m[2])+'-'+pad2(m[3]); }
  m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/); if(m){ let y=+m[3]; if(y<100)y+=2000; if(y>2400)y-=543; return y+'-'+pad2(m[2])+'-'+pad2(m[1]); }
  return null; }

// ── วัตถุดิบ / สูตรอาหาร (โมเดลเดียวกับ KaiDee POS · ตัดวัตถุดิบตามสูตรเมื่อขาย) ──
const RUNITS=[{id:'g',th:'กรัม',fam:'w',base:1},{id:'kg',th:'กก.',fam:'w',base:1000},{id:'ml',th:'มล.',fam:'v',base:1},{id:'l',th:'ลิตร',fam:'v',base:1000},{id:'pcs',th:'ชิ้น',fam:'c',base:1}];
const runit=id=>RUNITS.find(u=>u.id===id)||RUNITS[0];
const buyUnitsFor=tid=>RUNITS.filter(u=>u.fam===runit(tid).fam);
const convQty=(qty,fromId,toId)=>{const f=runit(fromId),t=runit(toId),n=Number(qty)||0;return f.fam!==t.fam?n:n*f.base/t.base;};
const uLabel=id=>runit(id).th;
const RAW_CATS=[{id:'meat',th:'เนื้อสัตว์',emoji:'🥩'},{id:'veg',th:'ผัก / ผลไม้',emoji:'🥬'},{id:'grain',th:'ข้าว / เส้น',emoji:'🍚'},{id:'dry',th:'เครื่องปรุง',emoji:'🧂'},{id:'drink',th:'วัตถุเครื่องดื่ม',emoji:'☕'},{id:'pack',th:'บรรจุภัณฑ์',emoji:'📦'},{id:'other',th:'อื่นๆ',emoji:'🥚'}];
const rawCat=id=>RAW_CATS.find(c=>c.id===id)||RAW_CATS[RAW_CATS.length-1];
const rawOf=(d,id)=>(d.raws||[]).find(r=>r.id===id);
const rawValue=r=>(Number(r.stock)||0)*(Number(r.avgCost)||0);
const prIsRecipe=p=>Array.isArray(p.recipe)&&p.recipe.length>0;
const recipeCost=(d,p)=>prIsRecipe(p)?p.recipe.reduce((a,ln)=>{const r=rawOf(d,ln.rawId);return a+(r?(r.avgCost||0)*convQty(ln.qty,ln.unit,r.unit):0);},0):0;
const recipeAvail=(d,p)=>{ if(!prIsRecipe(p))return 0; let m=Infinity; p.recipe.forEach(ln=>{const r=rawOf(d,ln.rawId);const need=r?convQty(ln.qty,ln.unit,r.unit):0;if(!r||need<=0)return;m=Math.min(m,Math.floor((r.stock||0)/need));}); return m===Infinity?0:m; };
// ตัดวัตถุดิบตามสูตร (ขาย/redeem สินค้าสูตร) · n<0 = คืนวัตถุดิบ (void)
function deductRecipe(dd,pr,n){ if(!pr||!Array.isArray(pr.recipe)||!pr.recipe.length)return; const k=n||1; pr.recipe.forEach(ln=>{ const r=(dd.raws||[]).find(x=>x.id===ln.rawId); if(!r)return; const need=convQty(ln.qty,ln.unit,r.unit)*k; r.stock=Math.max(0,(r.stock||0)-need); }); }

function stPill(m){ const s=memberStatus(m); const extra = s.d!=null&&s.key!=='none'?(s.key==='expired'?(' '+Math.abs(s.d)+'ว'):(' '+s.d+'ว')):''; return <span className={'pill '+({active:'pg',expiring:'py',expired:'pr',frozen:'pb',none:'pn'})[s.key]}>{s.th}{extra}</span>; }
function Sheet({title,tag,onClose,children}){ return (<div className="sheet-bg" onClick={onClose}><div className="sheet" onClick={e=>e.stopPropagation()}>
  <div className="sheet-h"><div><h3>{title}</h3>{tag&&<div style={{fontSize:12,color:'var(--ink-3)',fontWeight:600,marginTop:2}}>{tag}</div>}</div><button className="x" onClick={onClose}>✕</button></div>
  <div className="sheet-b">{children}</div></div></div>); }
function Kpi({l,v,f,tone}){ return <div className="kpi"><div className="l">{l}</div><div className="v" style={{color:tone||'var(--ink)'}}>{v}</div>{f&&<div className="f">{f}</div>}</div>; }

// analytics (peak/retention/trainers/classes/due)
function analytics(d){
  const hrs={}; d.checkins.filter(c=>c.result==='ok').forEach(c=>{const h=new Date(c.at).getHours();hrs[h]=(hrs[h]||0)+1;});
  const hourRows=[]; for(let h=6;h<=22;h++)hourRows.push({h,v:hrs[h]||0}); const peak=hourRows.reduce((a,b)=>b.v>a.v?b:a,{h:6,v:0});
  const cats={active:0,expiring:0,expired:0,frozen:0,none:0}; d.members.forEach(m=>cats[memberStatus(m).key]++);
  const paying=cats.active+cats.expiring+cats.expired; const churn=paying?Math.round(cats.expired/paying*100):0;
  const mon=todayISO().slice(0,7);
  const trRev=d.trainers.map(t=>({k:t.name.replace('โค้ช',''),v:d.ptBookings.filter(b=>b.trainerId===t.id&&b.paid&&b.date.slice(0,7)===mon).reduce((a,b)=>a+b.amount,0)})).sort((a,b)=>b.v-a.v);
  const clRows=d.classes.map(c=>({k:c.name,booked:c.booked.length,cap:c.cap,v:c.cap?Math.round(c.booked.length/c.cap*100):0})).sort((a,b)=>b.v-a.v);
  const due=d.members.filter(m=>['expiring','expired'].includes(memberStatus(m).key)).map(m=>({m,pk:pkgOf(d,m.packageId),s:memberStatus(m)})).sort((a,b)=>(a.s.d??0)-(b.s.d??0));
  const dueVal=due.reduce((a,x)=>a+((x.pk&&x.pk.price)||0),0); const odVal=due.filter(x=>x.s.key==='expired').reduce((a,x)=>a+((x.pk&&x.pk.price)||0),0);
  return {hourRows,peak,cats,churn,retention:100-churn,trRev,clRows,due,dueVal,odVal};
}
function revMonth(d){ const m=todayISO().slice(0,7); const inMon=ts=>new Date(ts).toISOString().slice(0,7)===m;
  const ren=(d.renewals||[]).filter(x=>inMon(x.at)); const pt=(d.ptBookings||[]).filter(x=>x.paid&&x.date.slice(0,7)===m);
  return { renew:ren.filter(x=>x.kind==='renew').reduce((a,b)=>a+b.amount,0), shop:ren.filter(x=>x.kind==='shop').reduce((a,b)=>a+b.amount,0), pt:pt.reduce((a,b)=>a+b.amount,0) }; }

/* ═══ ภาพรวม ═══ */
function OwnerDash({d,go}){
  const a=analytics(d); const rev=revMonth(d); const total=rev.renew+rev.pt+rev.shop;
  const todayCk=d.checkins.filter(c=>new Date(c.at).toDateString()===new Date().toDateString());
  const active=d.members.filter(m=>['active','expiring'].includes(memberStatus(m).key));
  const feed=[...d.checkins].sort((x,y)=>y.at-x.at).slice(0,5);
  const hmax=Math.max(1,...a.hourRows.map(r=>r.v));
  const money=fitCan(d,'revenue');
  return (<div className="fade">
    <div className="kpis">
      <Kpi l="สมาชิกใช้งานได้" v={active.length+'/'+d.members.length} tone="var(--brand-ink)" f={a.cats.expiring+' ใกล้หมด'}/>
      <Kpi l="เช็คอินวันนี้" v={todayCk.filter(c=>c.result==='ok').length} tone="var(--blue)" f={'ปฏิเสธ '+todayCk.filter(c=>c.result==='denied').length+' · พีค '+pad(a.peak.h)+':00'}/>
      {money&&<Kpi l="ยอดขายเดือนนี้" v={B(total)} tone="var(--green)" f={'ต่อ '+B(rev.renew)+' · PT '+B(rev.pt)+' · รวมรอยืนยัน'}/>}
      {money&&<Kpi l="ยอดค้างต่ออายุ" v={B(a.dueVal)} tone={a.odVal?'var(--red)':'var(--gold)'} f={a.due.length+' คน · เกิน '+B(a.odVal)}/>}
    </div>
    <OnDutyCard d={d} go={go}/>
    {money&&(()=>{ const cut=Date.now()-30*864e5; const by={}; (d.renewals||[]).filter(r=>r.at>=cut&&!r.discount&&(r.amount||0)>0).forEach(r=>{ const n=r.staffBy||'ไม่ระบุคนขาย'; by[n]=by[n]||{amt:0,cnt:0}; by[n].amt+=r.amount||0; by[n].cnt++; }); const rows=Object.entries(by).sort((x,y)=>y[1].amt-x[1].amt).slice(0,6); if(!rows.length) return null; const mx=Math.max(1,...rows.map(r=>r[1].amt)); const medal=['🥇','🥈','🥉']; return (<div className="card"><h3>🏆 ท็อปพนักงานทำยอด <span className="lnk">30 วัน</span></h3>{rows.map(([n,v],i)=>(<div className="row" key={n} style={{alignItems:'center'}}><div style={{width:24,fontSize:16,textAlign:'center'}}>{medal[i]||<span style={{fontWeight:800,color:'var(--ink-3)',fontSize:13}}>{i+1}</span>}</div><div className="b" style={{minWidth:0}}><div className="t" style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{n}</div><div style={{height:6,background:'var(--brand-soft)',borderRadius:4,marginTop:5,overflow:'hidden'}}><div style={{width:(v.amt/mx*100)+'%',height:'100%',background:'var(--green,#1E7A46)',borderRadius:4}}/></div></div><div style={{textAlign:'right',minWidth:72}}><div style={{fontWeight:700,fontSize:13.5}}>{B(v.amt)}</div><div style={{fontSize:11,color:'var(--ink-3)'}}>{v.cnt} บิล</div></div></div>))}<div className="note g" style={{marginTop:10}}>ยอดขายที่บันทึกชื่อคนขาย — สร้างแรงจูงใจให้ทีม 💪</div></div>); })()}
    <div className="card"><h3>ช่วงเวลาคนเข้าพีค <span className="lnk">พีค {pad(a.peak.h)}:00</span></h3>
      <div className="hours">{a.hourRows.map(r=><div key={r.h} className={'hc'+(r.h===a.peak.h&&a.peak.v?' pk':'')} style={{height:Math.max(4,r.v/hmax*100)+'%'}}/>)}</div>
      <div className="hlbl"><span>06</span><span>10</span><span>14</span><span>18</span><span>22</span></div>
    </div>
    <div className="card"><h3>Retention / Churn</h3>
      <div className="retain">
        <div className="ring" style={{background:'conic-gradient(var(--green) '+a.retention*3.6+'deg,var(--red-soft) 0)'}}><div className="in"><b>{a.retention}%</b><span>คงอยู่</span></div></div>
        <div style={{flex:1}}>
          <div className="rl"><span className="d" style={{background:'var(--green)'}}/>ยังใช้งาน<b>{a.cats.active+a.cats.expiring}</b></div>
          <div className="rl"><span className="d" style={{background:'var(--red)'}}/>หมด (churn)<b>{a.cats.expired}</b></div>
          <div className="rl"><span className="d" style={{background:'var(--blue)'}}/>พัก<b>{a.cats.frozen}</b></div>
        </div>
      </div>
    </div>
    <div className="card"><h3>เช็คอินล่าสุด <span className="lnk" onClick={()=>go('checkin')}>เช็คอิน →</span></h3>
      {feed.map(c=>{ const m=mbOf(d,c.memberId); const ok=c.result==='ok'; return (<div className="row" key={c.id}>
        <div className="ic" style={{background:ok?'var(--green-soft)':'var(--red-soft)',color:ok?'var(--green)':'var(--red)'}}>{ok?'✓':'✕'}</div>
        <div className="b"><div className="t">{m?m.name:'—'}</div><div className="s">{c.method==='nfc'?'แตะ NFC':'สแกน QR'} · {thTime(c.at)}</div></div>
        <span className={'pill '+(ok?'pg':'pr')}>{ok?'เข้าได้':'ปฏิเสธ'}</span></div>); })}
    </div>
    {a.due.length>0&&<div className="card"><h3>ยอดค้างต่ออายุ <span className="lnk" onClick={()=>go('members')}>สมาชิก →</span></h3>
      {a.due.slice(0,4).map(({m,pk})=>(<div className="row" key={m.id}><div className="av">{firstName(m.name)[0]}</div>
        <div className="b"><div className="t">{m.name}</div><div className="s">{pk?pk.name:'—'} · {m.line?'LINE OA':'SMS'}</div></div>
        <div style={{textAlign:'right'}}><div className="val">{B((pk&&pk.price)||0)}</div>{stPill(m)}</div></div>))}
    </div>}
  </div>);
}

/* ═══ ตั้งค่ารับเงินฟิตเนส · VAT + ใบเสร็จ 58/80mm + จังหวะเก็บเงิน (พอร์ตจาก KaiDee POS) ═══ */
const FIT_PAY_DEF={ vatMode:'off', vatRate:7, taxId:'', taxAddr:'', paper:'80', receiptMode:'ask', payTiming:'first' };
function fitPayCfg(d){ return { ...FIT_PAY_DEF, ...((d.gym&&d.gym.pay)||{}) }; }
function fitVat(total,gp){ const r=(Number(gp.vatRate)||7)/100; const m=gp.vatMode||'off';
  if(m==='include'){ const base=total/(1+r); return { base, vat:total-base, gross:total, rate:r*100, on:true }; }
  if(m==='add'){ return { base:total, vat:total*r, gross:total*(1+r), rate:r*100, on:true }; }
  return { base:total, vat:0, gross:total, rate:r*100, on:false }; }
function fitReceiptHTML(snap,gym,gp){ const paper=Number(gp.paper)||80; const v=snap.vat;
  const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const now=new Date().toLocaleString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
  const rows=snap.lines.map(l=>'<div class="r"><span class="nm">'+l.qty+' × '+esc(l.name)+'</span><span>'+nf(l.price*l.qty)+'</span></div>').join('');
  const vatBlock=v.on
    ? '<div class="r"><span>มูลค่าก่อนภาษี</span><span>'+v.base.toFixed(2)+'</span></div><div class="r"><span>VAT '+Math.round(v.rate)+'%</span><span>'+v.vat.toFixed(2)+'</span></div>'
    : '<div class="r"><span>ยอดสินค้า</span><span>'+nf(snap.total)+'</span></div>';
  const taxHead=v.on&&gp.taxId?'<div class="c s">เลขผู้เสียภาษี '+esc(gp.taxId)+'</div>'+(gp.taxAddr?'<div class="c s">'+esc(gp.taxAddr)+'</div>':''):'';
  const css='*{margin:0;padding:0;box-sizing:border-box}@page{size:'+paper+'mm auto;margin:0}body{width:'+paper+'mm;padding:'+(paper===58?'2.5mm 3mm':'3mm 4mm')+';font-family:"IBM Plex Mono",monospace;font-size:'+(paper===58?'10px':'11px')+';color:#000}.c{text-align:center}.b{font-weight:600}.s{font-size:9px;color:#333}.big{font-size:14px;font-weight:600}.dash{border-top:1px dashed #000;margin:5px 0}.r{display:flex;justify-content:space-between;margin:2px 0}.r .nm{max-width:70%}.tot{display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:4px}';
  return '<html><head><meta charset="utf-8"><style>'+css+'</style></head><body>'
    +'<div class="c big">'+esc(gym.name)+'</div>'+taxHead
    +'<div class="c s">'+(v.on?'ใบกำกับภาษีอย่างย่อ':'ใบเสร็จรับเงิน')+'</div><div class="dash"></div>'
    +'<div class="r"><span>#'+snap.no+'</span><span>'+now+'</span></div>'
    +(snap.member?'<div class="r"><span>สมาชิก</span><span>'+esc(snap.member)+'</span></div>':'')+'<div class="dash"></div>'
    +rows+(snap.disc>0?'<div class="r"><span>ส่วนลด Voucher</span><span>-'+nf(snap.disc)+'</span></div>':'')+'<div class="dash"></div>'+vatBlock
    +'<div class="tot"><span>รวมทั้งสิ้น</span><span>฿'+nf(snap.gross)+'</span></div>'
    +'<div class="s" style="margin-top:5px">ชำระโดย '+(snap.method==='promptpay'?'พร้อมเพย์':'เงินสด')+'</div>'
    +'<div class="dash"></div><div class="c s">ขอบคุณที่ใช้บริการ</div></body></html>'; }
function fitPrint(snap,gym,gp){ try{ const w=window.open('','_blank','width=380,height=640'); if(!w){alert('เปิดหน้าต่างพิมพ์ไม่ได้ — อนุญาต pop-up');return;} w.document.write(fitReceiptHTML(snap,gym,gp)); w.document.close(); setTimeout(()=>{ try{w.focus();w.print();}catch(e){} },350); }catch(e){} }
function FitPayCfgSheet({d,setData,toast,onClose}){
  const [g,setG]=useState(()=>fitPayCfg(d)); const set=(k,v)=>setG(x=>({...x,[k]:v}));
  const save=()=>{ setData(dd=>{ dd.gym={...dd.gym,pay:{...g}}; return {...dd}; }); toast('บันทึกตั้งค่ารับเงินแล้ว'); onClose(); };
  const R=({v,l})=>(<button className={g.vatMode===v?'on':''} onClick={()=>set('vatMode',v)}>{l}</button>);
  return (<Sheet title="ตั้งค่ารับเงิน" tag="VAT · ใบเสร็จ · จังหวะเก็บเงิน" onClose={onClose}>
    <label className="lb" style={{marginTop:0}}>ภาษีมูลค่าเพิ่ม (VAT)</label>
    <div className="seg">{[['off','ไม่คิด VAT'],['include','รวมในราคา'],['add','บวกเพิ่ม']].map(([v,l])=><R key={v} v={v} l={l}/>)}</div>
    {g.vatMode!=='off'&&<><label className="lb">อัตรา VAT (%)</label><input className="field num" inputMode="decimal" value={g.vatRate} onChange={e=>set('vatRate',e.target.value.replace(/[^\d.]/g,''))}/>
      <label className="lb">เลขประจำตัวผู้เสียภาษี</label><input className="field num" value={g.taxId} onChange={e=>set('taxId',e.target.value)} placeholder="13 หลัก"/>
      <label className="lb">ที่อยู่บนใบกำกับ (ไม่บังคับ)</label><input className="field" value={g.taxAddr} onChange={e=>set('taxAddr',e.target.value)} placeholder={d.gym.address}/></>}
    <label className="lb">ขนาดกระดาษใบเสร็จ</label>
    <div className="seg">{[['58','58mm'],['80','80mm']].map(([v,l])=><button key={v} className={String(g.paper)===v?'on':''} onClick={()=>set('paper',v)}>{l}</button>)}</div>
    <label className="lb">การพิมพ์ใบเสร็จ</label>
    <div className="seg">{[['ask','ถามทุกครั้ง'],['auto','พิมพ์อัตโนมัติ'],['off','ไม่ออกใบเสร็จ']].map(([v,l])=><button key={v} className={g.receiptMode===v?'on':''} onClick={()=>set('receiptMode',v)}>{l}</button>)}</div>
    <label className="lb">จังหวะเก็บเงิน (ขายสินค้า/คาเฟ่)</label>
    <div className="seg">{[['first','เก็บเงินก่อน'],['later','ส่งออเดอร์ เก็บทีหลัง']].map(([v,l])=><button key={v} className={g.payTiming===v?'on':''} onClick={()=>set('payTiming',v)}>{l}</button>)}</div>
    <div className="note gold" style={{marginTop:10}}>แพ็กสมาชิก/ต่ออายุ = เก็บเงินก่อนเสมอ · จังหวะนี้ใช้กับสินค้า/เครื่องดื่มเท่านั้น</div>
    <button className="btn pri blk" style={{marginTop:16}} onClick={save}>บันทึก</button>
  </Sheet>);
}
/* ═══ Voucher · บัตรกำนัล · คูปองส่วนลด (ยืดหยุ่น ร้านตั้งเงื่อนไขเอง) ═══ */
const VC_TYPES=[['gift','💳','บัตรกำนัลเงิน','เติมมูลค่าเงิน · หักยอดได้ (เก็บยอดคงเหลือ)'],['coupon','🎟️','คูปองส่วนลด','ลด %/บาท · ตั้งขั้นต่ำ/เพดานเองได้'],['pack','🎁','Voucher แพ็ก/คอร์ส','ขายล่วงหน้า · แลกเป็นแพ็ก/คอร์ส']];
const VC_EXP=[[0,'ไม่หมด'],[30,'30ว'],[90,'90ว'],[180,'180ว'],[365,'1ปี']];
const vcTypeName=(t)=>({gift:'บัตรกำนัลเงิน',coupon:'คูปองส่วนลด',pack:'Voucher แพ็ก'}[t]||t);
const vcTypeEmoji=(t)=>({gift:'💳',coupon:'🎟️',pack:'🎁'}[t]||'🎫');
function genVcCode(type){ const p={gift:'GC',coupon:'CP',pack:'VP'}[type]||'VC'; const s=()=>Math.random().toString(36).slice(2).toUpperCase().replace(/[^A-Z0-9]/g,''); return p+'-'+(s()+s()).slice(0,6); }
function vcExpired(v){ return !!(v.expiry && daysTo(v.expiry)<0); }
function vcStatus(v){ if(v.status==='used')return 'used'; if(vcExpired(v))return 'expired'; return 'unused'; }
function vcValueLabel(v){ if(v.type==='coupon')return v.mode==='percent'?('ลด '+v.value+'%'+(v.maxDisc?' (สูงสุด '+B(v.maxDisc)+')':'')):('ลด '+B(v.value)); if(v.type==='gift')return 'มูลค่า '+B(v.balance!=null?v.balance:v.value); return 'มูลค่า '+B(v.value); }
function vcDiscount(v,sub){ if(!v||sub<=0)return 0;
  if(v.type==='gift')return Math.min(v.balance!=null?v.balance:v.value,sub);
  if(v.type==='pack')return Math.min(v.value||0,sub);
  if(v.type==='coupon'){ if(v.minSpend&&sub<v.minSpend)return 0; if(v.mode==='percent'){ let x=Math.round(sub*(v.value||0)/100); if(v.maxDisc)x=Math.min(x,v.maxDisc); return Math.min(x,sub);} return Math.min(v.value||0,sub); }
  return 0; }
function vcValidate(v,sub){ if(!v)return{ok:false,msg:'ไม่พบโค้ดนี้'}; const st=vcStatus(v);
  if(st==='used')return{ok:false,msg:'โค้ดนี้ถูกใช้แล้ว'}; if(st==='expired')return{ok:false,msg:'โค้ดหมดอายุแล้ว'};
  if(v.type==='coupon'&&v.minSpend&&sub<v.minSpend)return{ok:false,msg:'ต้องมียอดขั้นต่ำ '+B(v.minSpend)};
  const disc=vcDiscount(v,sub); if(disc<=0)return{ok:false,msg:'ใช้กับบิลนี้ไม่ได้'}; return{ok:true,disc,v}; }
function VoucherDefSheet({d,setData,toast,def,onClose}){
  const [f,setF]=useState(()=>def?{...def}:{ type:'gift', name:'', price:'', value:'', mode:'baht', minSpend:'', maxDisc:'', pkgId:(d.packages[0]||{}).id, expiryDays:180, limit:'' });
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const num=(v)=>Math.round(Number(String(v).replace(/[^\d.]/g,''))||0);
  const setType=(t)=>setF(x=>{ const n={...x,type:t}; if(t==='pack'){ const p=pkgOf(d,x.pkgId)||d.packages[0]; if(p){n.pkgId=p.id; n.value=p.price; if(!n.price)n.price=p.price;} } return n; });
  const save=()=>{ if(!f.name.trim()){toast('ใส่ชื่อ Voucher');return;} if(!num(f.price)){toast('ใส่ราคาขาย');return;}
    const rec={ id:def?def.id:'vd-'+Date.now().toString(36), name:f.name.trim(), type:f.type, active:def?def.active:true,
      price:num(f.price), value:num(f.value), mode:f.mode, minSpend:num(f.minSpend), maxDisc:num(f.maxDisc),
      pkgId:f.type==='pack'?f.pkgId:null, expiryDays:num(f.expiryDays), limit:num(f.limit), issued:def?def.issued||0:0 };
    setData(dd=>{ dd.voucherDefs=dd.voucherDefs||[]; const i=dd.voucherDefs.findIndex(v=>v.id===rec.id); if(i>=0)dd.voucherDefs[i]={...dd.voucherDefs[i],...rec}; else dd.voucherDefs.push(rec); return {...dd}; });
    toast(def?'บันทึกแล้ว':'สร้าง Voucher แล้ว'); onClose(); };
  return (<Sheet title={def?'แก้ไข Voucher':'สร้าง Voucher'} tag="ร้านตั้งเงื่อนไขเอง" onClose={onClose}>
    <label className="lb" style={{marginTop:0}}>ชนิด Voucher</label>
    <div style={{display:'grid',gap:8}}>{VC_TYPES.map(([k,e,t,s])=>(<button key={k} className="pkbtn" onClick={()=>setType(k)} style={f.type===k?{borderColor:'var(--brand)',background:'var(--brand-softer)'}:null}>
      <div style={{display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:20}}>{e}</span><div><b>{t}</b><div className="s" style={{fontSize:11.5,color:'var(--ink-3)'}}>{s}</div></div></div></button>))}</div>
    <label className="lb">ชื่อ Voucher</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)} placeholder={f.type==='gift'?'บัตรกำนัล ฿1,000':f.type==='coupon'?'ส่วนลดสมาชิกใหม่':'คอร์ส 10 ครั้ง'}/>
    {f.type==='gift'&&<><label className="lb">มูลค่าหน้าบัตร (เงินที่ใช้ได้)</label><input className="field num" inputMode="numeric" value={f.value} onChange={e=>set('value',e.target.value)} placeholder="1000"/></>}
    {f.type==='coupon'&&<><label className="lb">รูปแบบส่วนลด</label>
      <div className="seg">{[['baht','ลดเป็นบาท'],['percent','ลด %']].map(([k,l])=><button key={k} className={f.mode===k?'on':''} onClick={()=>set('mode',k)}>{l}</button>)}</div>
      <label className="lb">{f.mode==='percent'?'ส่วนลด (%)':'ส่วนลด (บาท)'}</label><input className="field num" inputMode="numeric" value={f.value} onChange={e=>set('value',e.target.value)} placeholder={f.mode==='percent'?'10':'100'}/>
      <label className="lb">ยอดขั้นต่ำ (ไม่บังคับ)</label><input className="field num" inputMode="numeric" value={f.minSpend} onChange={e=>set('minSpend',e.target.value)} placeholder="0 = ไม่กำหนด"/>
      {f.mode==='percent'&&<><label className="lb">ลดสูงสุด (ไม่บังคับ)</label><input className="field num" inputMode="numeric" value={f.maxDisc} onChange={e=>set('maxDisc',e.target.value)} placeholder="0 = ไม่จำกัด"/></>}</>}
    {f.type==='pack'&&<><label className="lb">แลกเป็นแพ็ก/คอร์ส</label>
      {d.packages.map(p=>(<button key={p.id} className="pkbtn" onClick={()=>setF(x=>({...x,pkgId:p.id,value:p.price}))} style={f.pkgId===p.id?{borderColor:'var(--brand)',background:'var(--brand-softer)'}:null}><div><b>{p.name}</b><div className="s" style={{fontSize:11.5,color:'var(--ink-3)'}}>{p.desc}</div></div><b className="num">{B(p.price)}</b></button>))}
      <label className="lb">มูลค่าแลก (หักจากบิลได้)</label><input className="field num" inputMode="numeric" value={f.value} onChange={e=>set('value',e.target.value)}/></>}
    <label className="lb">ราคาขาย (ลูกค้าจ่ายซื้อ Voucher)</label><input className="field num" inputMode="numeric" value={f.price} onChange={e=>set('price',e.target.value)} placeholder={f.type==='gift'?'เช่น 950 (จ่าย 950 ได้ 1,000)':'ราคาขาย'}/>
    <label className="lb">อายุการใช้งาน (นับจากวันออกโค้ด)</label>
    <div className="seg">{VC_EXP.map(([k,l])=><button key={k} className={num(f.expiryDays)===k?'on':''} onClick={()=>set('expiryDays',k)}>{l}</button>)}</div>
    <label className="lb">จำนวนสิทธิ์ที่ออกได้ (ไม่บังคับ)</label><input className="field num" inputMode="numeric" value={f.limit} onChange={e=>set('limit',e.target.value)} placeholder="0 = ไม่จำกัด"/>
    <button className="btn pri blk" style={{marginTop:16}} onClick={save}>{def?'บันทึก':'สร้าง Voucher'}</button>
  </Sheet>);
}
function OwnerVouchers({d,setData,toast}){
  const [tab,setTab]=useState('def'); const [edit,setEdit]=useState(null); const [f,setF]=useState('all');
  const defs=d.voucherDefs||[]; const codes=d.vouchers||[];
  const closeDef=(id)=>setData(dd=>{ const x=(dd.voucherDefs||[]).find(v=>v.id===id); if(x)x.active=!x.active; return {...dd}; });
  const cCount={all:codes.length,unused:0,used:0,expired:0}; codes.forEach(v=>cCount[vcStatus(v)]++);
  let rows=codes.filter(v=>f==='all'||vcStatus(v)===f).sort((a,b)=>b.issuedAt-a.issuedAt);
  return (<div className="fade">
    <div className="seg" style={{marginBottom:12}}>{[['def','แม่แบบ Voucher'],['codes','โค้ดที่ออก'+(codes.length?' '+codes.length:'')]].map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}</div>
    {tab==='def'?<>
      <button className="btn pri blk sm" style={{marginBottom:12}} onClick={()=>setEdit('new')}>+ สร้าง Voucher ใหม่</button>
      {defs.length?defs.map(v=>(<div className="card" key={v.id} style={{opacity:v.active?1:.55}}>
        <div style={{display:'flex',alignItems:'center',gap:11}}>
          <div className="ic" style={{background:'var(--brand-soft)',color:'var(--brand-ink)',fontSize:18,width:40,height:40}}>{vcTypeEmoji(v.type)}</div>
          <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700}}>{v.name} {!v.active&&<span className="pill pn" style={{fontSize:9,padding:'0 5px'}}>ปิดขาย</span>}</div>
            <div style={{fontSize:12,color:'var(--ink-3)'}}>{vcTypeName(v.type)} · {vcValueLabel(v)}{v.expiryDays?' · อายุ '+v.expiryDays+'ว':''}</div></div>
          <div style={{textAlign:'right'}}><div className="num" style={{fontWeight:700}}>{B(v.price)}</div><div style={{fontSize:11,color:'var(--ink-3)'}}>ออกแล้ว {v.issued||0}{v.limit?'/'+v.limit:''}</div></div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:10}}><button className="btn gh sm" style={{flex:1}} onClick={()=>setEdit(v)}>แก้ไข</button>
          <button className="btn gh sm" style={{flex:1}} onClick={()=>closeDef(v.id)}>{v.active?'ปิดขาย':'เปิดขาย'}</button></div>
      </div>)):<div className="empty">ยังไม่มีแม่แบบ Voucher — สร้างเพื่อขายในหน้าขาย</div>}
      <div className="note gold" style={{marginTop:6}}>สร้างแล้วจะโผล่ในหมวด “Voucher” หน้าขาย (POS) — ขายออกเป็นโค้ดให้ลูกค้า</div>
    </>:<>
      <div className="seg" style={{marginBottom:10}}>{[['all','ทั้งหมด'],['unused','ยังไม่ใช้'],['used','ใช้แล้ว'],['expired','หมดอายุ']].map(([k,l])=><button key={k} className={f===k?'on':''} onClick={()=>setF(k)}>{l}{cCount[k]?' '+cCount[k]:''}</button>)}</div>
      <div className="card">{rows.length?rows.map(v=>{ const st=vcStatus(v); return (<div className="row" key={v.id}>
        <div className="ic" style={{background:'var(--brand-soft)',color:'var(--brand-ink)'}}>{vcTypeEmoji(v.type)}</div>
        <div className="b"><div className="t" style={{fontFamily:'monospace',letterSpacing:.5}}>{v.code}</div><div className="s">{v.name} · {vcValueLabel(v)}{v.expiry?' · หมด '+thDate(v.expiry):''}</div></div>
        <span className={'pill '+({unused:'pg',used:'pn',expired:'pr'}[st])}>{{unused:'ยังไม่ใช้',used:'ใช้แล้ว',expired:'หมดอายุ'}[st]}</span></div>); }):<div className="empty">ยังไม่มีโค้ดในหมวดนี้</div>}</div>
    </>}
    {edit&&<VoucherDefSheet d={d} setData={setData} toast={toast} def={edit==='new'?null:edit} onClose={()=>setEdit(null)}/>}
  </div>);
}

/* ═══ หน้าขาย POS ═══ */
function OwnerSell({d,setData,toast}){
  const [cat,setCat]=useState('pkg'); const [cart,setCart]=useState([]); const [open,setOpen]=useState(false);
  const [mid,setMid]=useState(''); const [method,setMethod]=useState('promptpay'); const [done,setDone]=useState(null);
  const [otype,setOtype]=useState('dinein'); const [slip,setSlip]=useState(null); const [cfg,setCfg]=useState(false);
  const [code,setCode]=useState(''); const [redeem,setRedeem]=useState(null); const [scat,setScat]=useState('all');
  const gp=fitPayCfg(d); const opName=(staffOf(d,d.currentStaffId)||{}).name||'';
  const OTYPE={dinein:'🍽️ ทานที่ร้าน',takeaway:'🥡 กลับบ้าน'};
  const pickSlip=()=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>setSlip(r.result); r.readAsDataURL(f); }; inp.click(); };
  const add=(it)=>{ if(it.kind==='voucher'){ const def=(d.voucherDefs||[]).find(x=>x.id===it.id); if(def&&def.limit&&(def.issued||0)>=def.limit){ toast('สิทธิ์ Voucher นี้ครบแล้ว'); return; } } setCart(c=>{ const i=c.findIndex(x=>x.key===it.key); if(i>=0){const n=[...c];n[i]={...n[i],qty:n[i].qty+1};return n;} return [...c,{...it,qty:1}]; }); toast('เพิ่ม '+it.name); };
  const chg=(k,delta)=>setCart(c=>c.map(x=>x.key===k?{...x,qty:Math.max(0,x.qty+delta)}:x).filter(x=>x.qty>0));
  const total=cart.reduce((a,l)=>a+l.price*l.qty,0); const n=cart.reduce((a,l)=>a+l.qty,0);
  const saleSub=cart.filter(l=>l.kind!=='voucher').reduce((a,l)=>a+l.price*l.qty,0);
  const disc=redeem?vcDiscount(redeem,saleSub):0;
  const netTotal=Math.max(0,total-disc);
  const hasVoucher=cart.some(l=>l.kind==='voucher');
  const onlyPkg=cart.length>0&&cart.every(l=>l.kind==='pkg'||l.kind==='pt');   // แพ็ก/PT = เก็บก่อนเสมอ
  const payLater=gp.payTiming==='later'&&!onlyPkg&&!hasVoucher;
  const vat=fitVat(netTotal,gp); const payTotal=vat.gross;
  const applyCode=()=>{ const c=code.trim().toUpperCase(); if(!c)return; const v=(d.vouchers||[]).find(x=>x.code.toUpperCase()===c); const res=vcValidate(v,saleSub); if(!res.ok){ toast('⚠️ '+res.msg); return; } setRedeem(v); setCode(''); toast('ใช้โค้ด '+v.name+' · ลด '+B(res.disc)); };
  const cats={ pkg:d.packages.map(p=>({key:'pkg-'+p.id,kind:'pkg',id:p.id,name:p.name,sub:p.desc,price:p.price})),
    product:d.products.map(p=>({key:'pr-'+p.id,kind:'product',id:p.id,name:p.name,sub:p.stock>=999?'ชงสด':(p.stock<=0?'หมด':'เหลือ '+p.stock),price:p.price,off:p.stock<=0&&p.stock<999})),
    pt:d.trainers.filter(t=>t.active).map(t=>({key:'pt-'+t.id,kind:'pt',id:t.id,name:'PT · '+t.name,sub:t.specialty,price:t.rate})),
    voucher:(d.voucherDefs||[]).filter(v=>v.active).map(v=>({key:'vc-'+v.id,kind:'voucher',id:v.id,name:v.name,sub:vcTypeName(v.type)+' · '+vcValueLabel(v),price:v.price,off:!!(v.limit&&(v.issued||0)>=v.limit)})) };
  const checkout=()=>{ const now=Date.now(); const newCodes=[]; setData(dd=>{ cart.forEach(l=>{ for(let i=0;i<l.qty;i++){
      if(l.kind==='pkg'){ const p=pkgOf(dd,l.id); if(mid){ const mm=mbOf(dd,mid); const from=(mm.expiry&&daysTo(mm.expiry)>0)?mm.expiry:todayISO(); mm.packageId=l.id; if(p.months)mm.expiry=isoAdd(from,p.months*30); if(p.kind==='sessions')mm.ptLeft=(mm.ptLeft||0)+p.sessions; mm.frozen=false; mm.spend+=p.price; fitAddBundles(dd,mid,[{kind:'pkg',id:l.id,qty:1}]); }
        dd.renewals.push({id:'rv-'+now+Math.random().toString(36).slice(2,6),memberId:mid,packageId:l.id,at:now,amount:p.price,via:method==='promptpay'?'app':'counter',kind:'renew',verified:true,verifiedAt:now,staffBy:opName}); }
      else if(l.kind==='product'){ const pr=dd.products.find(x=>x.id===l.id); if(pr&&pr.stock<999){pr.stock=Math.max(0,pr.stock-1);} if(pr){pr.sold++; deductRecipe(dd,pr,1);} if(mid){const mm=mbOf(dd,mid);if(mm)mm.spend+=l.price;}
        dd.renewals.push({id:'sv-'+now+Math.random().toString(36).slice(2,6),memberId:mid,productId:l.id,amount:l.price,via:method==='promptpay'?'app':'counter',kind:'shop',at:now,verified:!payLater,verifiedAt:payLater?null:now,payLater:payLater||false,otype,slip:slip||null,staffBy:opName}); }
      else if(l.kind==='voucher'){ const def=(dd.voucherDefs||[]).find(x=>x.id===l.id); if(def){ const cd=genVcCode(def.type); const expiry=def.expiryDays?isoAdd(todayISO(),def.expiryDays):null;
        (dd.vouchers=dd.vouchers||[]).push({ id:'vc-'+now+Math.random().toString(36).slice(2,6), code:cd, defId:def.id, name:def.name, type:def.type, value:def.value||0, mode:def.mode||'baht', minSpend:def.minSpend||0, maxDisc:def.maxDisc||0, pkgId:def.pkgId||null, balance:def.type==='gift'?(def.value||0):null, status:'unused', issuedAt:now, expiry, soldAmount:def.price, memberId:mid||'', usedAt:null, usedAmount:0 });
        def.issued=(def.issued||0)+1; newCodes.push({code:cd,name:def.name,type:def.type});
        dd.renewals.push({id:'vs-'+now+Math.random().toString(36).slice(2,6),memberId:mid,voucherCode:cd,amount:def.price,via:method==='promptpay'?'app':'counter',kind:'shop',at:now,verified:true,verifiedAt:now}); } }
      else { dd.ptBookings.push({id:'pt-'+now+Math.random().toString(36).slice(2,6),memberId:mid,trainerId:l.id,date:isoAdd(todayISO(),1),time:'18:00',kind:'single',paid:true,status:'confirmed',amount:l.price,at:now,via:method==='promptpay'?'app':'counter',verified:true,staffBy:opName}); }
    }});
      if(redeem){ const vv=(dd.vouchers=dd.vouchers||[]).find(x=>x.id===redeem.id); if(vv){ const used=vcDiscount(vv,saleSub);
        if(vv.type==='gift'){ vv.balance=Math.max(0,(vv.balance!=null?vv.balance:vv.value)-used); if(vv.balance<=0)vv.status='used'; } else { vv.status='used'; }
        vv.usedAt=now; vv.usedAmount=(vv.usedAmount||0)+used; if(mid&&!vv.memberId)vv.memberId=mid;
        if(used>0) dd.renewals.push({id:'vd-'+now+Math.random().toString(36).slice(2,6),memberId:mid,amount:-used,kind:'shop',discount:true,via:method==='promptpay'?'app':'counter',at:now,verified:!payLater,verifiedAt:payLater?null:now,staffBy:opName}); } }
      return {...dd}; });
    const snap={ no:Math.floor(Math.random()*8000+1000), lines:cart.map(l=>({name:l.name,price:l.price,qty:l.qty})), disc, total:netTotal, vat, gross:payTotal, method, member:mid?(mbOf(d,mid)||{}).name:'', at:now };
    setDone({total:netTotal,gross:payTotal,method,n,otype,payLater,snap,disc,codes:newCodes,hasProduct:cart.some(l=>l.kind==='product')});
    if(gp.receiptMode==='auto'&&!payLater) setTimeout(()=>fitPrint(snap,d.gym,gp),200);
    setOpen(false); };
  const reset=()=>{ setCart([]); setMid(''); setDone(null); setSlip(null); setOtype('dinein'); setCode(''); setRedeem(null); };
  if(done) return (<div className="fade"><div className={'result '+(done.payLater?'':'ok')} style={{marginTop:20,...(done.payLater?{background:'var(--blue-soft)',color:'var(--blue)'}:{})}}><div className="ri">{done.payLater?'🧾':'✓'}</div><div className="rn">{done.payLater?'ส่งออเดอร์แล้ว':'รับเงินแล้ว '+B(done.gross)}</div>
    <div className="rs">{done.n} รายการ{done.disc>0?' · ลด '+B(done.disc):''} · {done.payLater?'เก็บเงินทีหลัง':(done.method==='promptpay'?'PromptPay':'เงินสด')}{done.hasProduct?' · '+OTYPE[done.otype]:''}{opName?' · ขายโดย '+opName:''}{mid?' · '+(mbOf(d,mid)||{}).name:''}</div></div>
    {done.codes&&done.codes.length>0&&<div className="card" style={{marginTop:12}}><h3>โค้ด Voucher ที่ออก</h3>
      {done.codes.map((c,i)=>(<div className="row" key={i}><div className="ic" style={{background:'var(--brand-soft)',color:'var(--brand-ink)'}}>{vcTypeEmoji(c.type)}</div>
        <div className="b"><div className="t" style={{fontFamily:'monospace',letterSpacing:.5}}>{c.code}</div><div className="s">{c.name}</div></div>
        <button className="btn gh sm" onClick={()=>{try{navigator.clipboard.writeText(c.code);}catch(e){} toast('คัดลอกโค้ด');}}>คัดลอก</button></div>))}
      <div className="note gold" style={{marginTop:8}}>มอบโค้ดนี้ให้ลูกค้า — ใช้หักยอดตอนซื้อครั้งถัดไป</div></div>}
    {gp.receiptMode!=='off'&&!done.payLater&&<button className="btn gh blk" style={{marginTop:12}} onClick={()=>fitPrint(done.snap,d.gym,gp)}>🖨️ พิมพ์ใบเสร็จ ({gp.paper}mm)</button>}
    <button className="btn pri blk" style={{marginTop:10}} onClick={reset}>ขายรายการใหม่</button></div>);
  return (<div className="fade">
    {(d.orders||[]).some(o=>o.status==='new')&&<div className="card" style={{marginBottom:12,padding:'12px 14px',border:'1.5px solid var(--brand)'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><b style={{fontSize:14.5}}>🍽️ คิวออเดอร์ (เคาน์เตอร์/บาร์)</b><span className="pill py" style={{marginLeft:'auto'}}>{(d.orders||[]).filter(o=>o.status==='new').length} รอทำ</span></div>
      {(d.orders||[]).filter(o=>o.status==='new').slice(0,8).map(o=>{ const who=(mbOf(d,o.memberId)||{}).name||o.memberName||'ลูกค้า'; return (
        <div key={o.id} className="row" style={{alignItems:'center'}}>
          <div className="b"><div className="t" style={{fontSize:13.5}}>{o.items.map(x=>x.name+(x.qty>1?'×'+x.qty:'')).join(' + ')}</div><div className="s" style={{fontSize:11}}>{who} · {o.kind==='redeem'?'ใช้สิทธิ์แพ็ก (ฟรี)':(o.via==='app'?'สั่งผ่านแอป':'เคาน์เตอร์')} · {thTime(o.at)}{o.value?' · มูลค่า '+B(o.value):''}</div></div>
          <button className="btn pri sm" style={{flex:'0 0 auto'}} onClick={()=>setData(dd=>{const x=(dd.orders||[]).find(z=>z.id===o.id);if(x)x.status='done';return {...dd};})}>เสร็จ ✓</button>
        </div>); })}
    </div>}
    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
      <div className="seg" style={{flex:1}}>{[['pkg','แพ็ก'],['product','สินค้า'],['pt','PT'],['voucher','Voucher']].map(([k,l])=><button key={k} className={cat===k?'on':''} onClick={()=>setCat(k)}>{l}</button>)}</div>
      {fitCan(d,'settings')&&<button className="btn gh sm" style={{flex:'0 0 auto'}} onClick={()=>setCfg(true)} title="ตั้งค่ารับเงิน">⚙️</button>}
    </div>
    {cat==='product'&&(()=>{ const pcs=[...new Set((d.products||[]).map(p=>p.cat||'อื่นๆ'))]; if(pcs.length<2)return null; return <div style={{display:'flex',gap:7,overflowX:'auto',paddingBottom:4,marginBottom:10}}>
      {[['all','ทั้งหมด'],...pcs.map(c=>[c,c])].map(([k,lb])=>(<button key={k} className={'btn sm '+(scat===k?'pri':'gh')} style={{whiteSpace:'nowrap',flex:'0 0 auto'}} onClick={()=>setScat(k)}>{lb}</button>))}
    </div>; })()}
    <div className="cat-grid">{(cat==='product'&&scat!=='all'?cats.product.filter(it=>{const pr=(d.products||[]).find(x=>x.id===it.id);return pr&&(pr.cat||'อื่นๆ')===scat;}):cats[cat]).map(it=><button key={it.key} className="cat-item" disabled={it.off} onClick={()=>!it.off&&add(it)} style={it.off?{opacity:.5}:null}>
      <div className="cn">{it.name}</div><div className="cs">{it.sub}</div><div className="cp">{B(it.price)}</div></button>)}</div>
    {n>0&&<div className="cartbar" onClick={()=>setOpen(true)}><div className="cc">{n}</div><div className="ct"><b>{B(total)}</b><span>แตะดูบิล / เก็บเงิน</span></div><div className="go">เก็บเงิน</div></div>}
    {open&&<Sheet title="บิลปัจจุบัน" tag={n+' รายการ'} onClose={()=>setOpen(false)}>
      <label className="lb" style={{marginTop:0}}>สมาชิก (ผูกยอด · ไม่ระบุก็ได้)</label>
      <select className="field" value={mid} onChange={e=>setMid(e.target.value)}><option value="">— ลูกค้าทั่วไป —</option>{d.members.map(m=><option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select>
      <div style={{marginTop:10}}>{cart.map(l=>(<div className="cart-line" key={l.key}><div className="cl-n"><b>{l.name}</b><span>{B(l.price)} × {l.qty}</span></div>
        <div className="qty"><button onClick={()=>chg(l.key,-1)}>−</button><span className="num" style={{minWidth:18,textAlign:'center'}}>{l.qty}</span><button onClick={()=>chg(l.key,1)}>+</button></div></div>))}</div>
      {saleSub>0&&<div style={{marginTop:12}}>{redeem?<div className="row" style={{background:'var(--brand-softer)',borderRadius:10,padding:'8px 11px'}}>
        <div className="b"><div className="t" style={{fontFamily:'monospace'}}>{redeem.code}</div><div className="s">{redeem.name} · ลด {B(disc)}</div></div>
        <button className="btn gh sm" onClick={()=>setRedeem(null)}>เอาออก</button></div>
        :<div style={{display:'flex',gap:8}}><input className="field" style={{flex:1,margin:0}} placeholder="🎫 ใส่โค้ด Voucher / ส่วนลด" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><button className="btn gh" onClick={applyCode}>ใช้โค้ด</button></div>}</div>}
      {vat.on
        ? <><div style={{display:'flex',justifyContent:'space-between',fontSize:12.5,color:'var(--ink-3)',marginTop:8}}><span>มูลค่าก่อน VAT</span><span className="num">{B(vat.base)}</span></div>
           <div style={{display:'flex',justifyContent:'space-between',fontSize:12.5,color:'var(--ink-3)',marginTop:2}}><span>VAT {Math.round(vat.rate)}%</span><span className="num">{B(vat.vat)}</span></div></>
        : null}
      {disc>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:12.5,color:'var(--green)',marginTop:6,fontWeight:600}}><span>ส่วนลด Voucher</span><span className="num">-{B(disc)}</span></div>}
      <div className="total-row"><span>รวมทั้งสิ้น</span><span className="tv num">{B(payTotal)}</span></div>
      {cart.some(l=>l.kind==='product')&&<><label className="lb">ประเภทออเดอร์ (คาเฟ่/อาหาร)</label>
      <div className="seg">{[['dinein','🍽️ ทานที่ร้าน'],['takeaway','🥡 กลับบ้าน']].map(([k,l])=><button key={k} className={otype===k?'on':''} onClick={()=>setOtype(k)}>{l}</button>)}</div></>}
      {!payLater&&<><label className="lb">ช่องทางรับเงิน</label>
      <div className="seg">{[['promptpay','PromptPay'],['cash','เงินสด']].map(([k,l])=><button key={k} className={method===k?'on':''} onClick={()=>setMethod(k)}>{l}</button>)}</div></>}
      {payLater&&<div className="note blue" style={{marginTop:12}}>🧾 ส่งออเดอร์ก่อน — ค่อยเก็บเงินทีหลัง (ตั้งจังหวะเก็บเงินได้ที่ ⚙️)</div>}
      {!payLater&&method==='promptpay'&&<div style={{textAlign:'center'}}><div className="qr" dangerouslySetInnerHTML={{__html:qrSVG('fitpos'+payTotal)}}/><div style={{fontSize:12,color:'var(--ink-3)'}}>พร้อมเพย์ {d.gym.promptpay} · {B(payTotal)}</div>
        {slip?<div style={{display:'flex',alignItems:'center',gap:10,justifyContent:'center',marginTop:10}}><img src={slip} alt="slip" style={{width:46,height:46,borderRadius:9,objectFit:'cover',border:'1px solid var(--hair-2)'}}/><button className="btn gh sm" onClick={pickSlip}>เปลี่ยนสลิป</button><button className="btn gh sm" onClick={()=>setSlip(null)}>ลบ</button></div>
          :<button className="btn gh sm" style={{marginTop:10}} onClick={pickSlip}>📷 ถ่าย/แนบสลิปโอน</button>}</div>}
      <button className="btn pri blk" style={{marginTop:14}} onClick={checkout}>{payLater?('🧾 ส่งออเดอร์ · เก็บเงินทีหลัง'):(method==='promptpay'?'ยืนยันรับเงิน (เช็คยอดโอนแล้ว)':'รับเงินสด '+B(payTotal))}</button>
    </Sheet>}
    {cfg&&<FitPayCfgSheet d={d} setData={setData} toast={toast} onClose={()=>setCfg(false)}/>}
  </div>);
}
function JoinLinkSheet({d,toast,onClose}){
  const base=location.href.replace(/[^/]*$/,'');
  const url=base+'Fitness Join.html?shop='+encodeURIComponent(d.gym.id)+'&name='+encodeURIComponent(d.gym.name);
  const copy=()=>{ try{navigator.clipboard.writeText(url);}catch(e){} toast('คัดลอกลิงก์แล้ว'); };
  const share=()=>{ if(navigator.share){navigator.share({title:'สมัครสมาชิก '+d.gym.name,url}).catch(()=>{});} else copy(); };
  return (<Sheet title="ลิงก์สมัครสมาชิก" tag="ลูกค้ากรอกเอง · ส่งทาง LINE OA ได้" onClose={onClose}>
    <div style={{textAlign:'center'}}><div className="qr" dangerouslySetInnerHTML={{__html:qrSVG(url)}}/><div style={{fontSize:12,color:'var(--ink-3)'}}>ให้ลูกค้าสแกน QR นี้ หรือส่งลิงก์ให้</div></div>
    <div style={{display:'flex',gap:8,marginTop:14}}><button className="btn pri" style={{flex:1}} onClick={share}>📤 ส่งลิงก์</button><button className="btn gh" style={{flex:1}} onClick={copy}>คัดลอกลิงก์</button></div>
    <div className="note g" style={{marginTop:12}}>ติด QR ที่เคาน์เตอร์ หรือส่งใน LINE OA — ลูกค้ากรอกชื่อ/เบอร์เอง ได้รหัสสมาชิก + QR ทันที ร้านไม่ต้องคีย์</div>
    <div className="note gold" style={{marginTop:10}}>สมาชิกที่สมัครเองจะยังไม่มีแพ็ก — โผล่ในรายการ เลือกขายแพ็ก/ต่ออายุได้เลย</div>
  </Sheet>);
}
/* ═══ สมาชิก ═══ */
function OwnerMembers({d,setData,toast,dayOpen=true}){
  const [q,setQ]=useState(''); const [f,setF]=useState('all'); const [sel,setSel]=useState(null); const [add,setAdd]=useState(false); const [link,setLink]=useState(false); const [imp,setImp]=useState(false); const [req,setReq]=useState(false);
  const counts={all:d.members.length}; d.members.forEach(m=>{const k=memberStatus(m).key;counts[k]=(counts[k]||0)+1;});
  let rows=d.members.filter(m=>f==='all'||memberStatus(m).key===f); if(q)rows=rows.filter(m=>(m.name+m.code+m.phone).toLowerCase().includes(q.toLowerCase()));
  return (<div className="fade">
    <PlanBanner d={d}/>
    {(d.changeRequests||[]).filter(r=>r.status==='pending').length>0&&<button className="card" onClick={()=>setReq(true)} style={{width:'100%',textAlign:'left',border:'1px solid #F3D98B',background:'#FFF7E6',marginBottom:12,cursor:'pointer'}}><b style={{color:'#8A6A00'}}>🪩 คำขอแก้ไขข้อมูล {(d.changeRequests||[]).filter(r=>r.status==='pending').length} รายการ</b><span style={{float:'right',color:'#8A6A00'}}>ตรวจ →</span></button>}
    <div className="seg" style={{marginBottom:10}}>{[['all','ทั้งหมด'],['active','ใช้ได้'],['expiring','ใกล้หมด'],['expired','หมด']].map(([k,l])=><button key={k} className={f===k?'on':''} onClick={()=>setF(k)}>{l}{counts[k]?' '+counts[k]:''}</button>)}</div>
    <input className="field" style={{marginBottom:10}} placeholder="🔍 ค้นชื่อ/รหัส/เบอร์" value={q} onChange={e=>setQ(e.target.value)}/>
    <div style={{display:'flex',gap:8,marginBottom:12}}><button className="btn pri sm" style={{flex:1}} disabled={!dayOpen} onClick={()=>dayOpen?setAdd(true):toast('เปิดวันก่อนจึงเพิ่ม/เก็บเงินได้')}>+ เพิ่มสมาชิก</button><button className="btn gh sm" style={{flex:1}} onClick={()=>setLink(true)}>📲 ลิงก์สมัคร (ลูกค้ากรอกเอง)</button></div>
    <button className="btn gh sm" style={{width:'100%',marginBottom:12}} onClick={()=>setImp(true)}>📥 นำเข้าสมาชิกจากระบบเก่า (CSV/Excel)</button>
    <div className="card">{rows.map(m=>{ const pk=pkgOf(d,m.packageId); return (<div className="row" key={m.id} onClick={()=>setSel(m.id)}>
      <div className="av">{firstName(m.name)[0]}</div><div className="b"><div className="t">{m.name} {m.line&&<span className="pill pg" style={{padding:'0 5px',fontSize:9}}>LINE</span>}</div><div className="s">{m.code} · {pk?pk.name:'—'}</div></div>
      {stPill(m)}</div>); })}{!rows.length&&<div className="empty">ไม่พบสมาชิก</div>}</div>
    {sel&&<MemberSheet d={d} setData={setData} id={sel} toast={toast} dayOpen={dayOpen} onClose={()=>setSel(null)}/>}
    {add&&<AddMemberSheet d={d} setData={setData} toast={toast} onClose={()=>setAdd(false)}/>}
    {link&&<JoinLinkSheet d={d} toast={toast} onClose={()=>setLink(false)}/>}
    {imp&&<ImportSheet d={d} setData={setData} toast={toast} onClose={()=>setImp(false)}/>}
    {req&&<ChangeReqReview d={d} setData={setData} toast={toast} onClose={()=>setReq(false)}/>}
  </div>);
}
function MemberSheet({d,setData,id,toast,onClose,dayOpen=true}){
  const m=mbOf(d,id); const pk=pkgOf(d,m.packageId); const s=memberStatus(m); const [rp,setRp]=useState(m.packageId);
  const renew=()=>{ setData(dd=>{ const mm=mbOf(dd,id); const p=pkgOf(dd,rp); const from=(mm.expiry&&daysTo(mm.expiry)>0)?mm.expiry:todayISO();
    mm.packageId=rp; if(p.months)mm.expiry=isoAdd(from,p.months*30); if(p.kind==='sessions')mm.ptLeft=(mm.ptLeft||0)+p.sessions; mm.frozen=false; mm.spend+=p.price||0; fitAddBundles(dd,id,[{kind:'pkg',id:rp,qty:1}]);
    dd.renewals.push({id:'rv-'+Date.now().toString(36),memberId:id,packageId:rp,at:Date.now(),amount:p.price,via:'counter',kind:'renew',verified:true,staffBy:(staffOf(dd,dd.currentStaffId)||{}).name}); return {...dd}; }); toast('ต่ออายุแล้ว'); onClose(); };
  const freeze=()=>{ setData(dd=>{ mbOf(dd,id).frozen=!mbOf(dd,id).frozen; return {...dd}; }); toast('อัปเดตสถานะพัก'); };
  const archive=()=>{ setData(dd=>{ mbOf(dd,id).archived=!mbOf(dd,id).archived; return {...dd}; }); toast(m.archived?'เอากลับเข้าทะเบียนแล้ว':'เก็บเข้าคลังแล้ว · ไม่นับโควต้า'); };
  const del=()=>{ if(!window.confirm('ลบสมาชิกคนนี้ถาวร? ประวัติจะหายไป (ถ้าแค่ต้องการหยุดนับโควต้า ใช้ “เก็บเข้าคลัง” แทน)'))return; setData(dd=>{ dd.members=(dd.members||[]).filter(x=>x.id!==id); return {...dd}; }); toast('ลบสมาชิกแล้ว'); onClose(); };
  const remind=()=>toast((m.line?'ส่ง LINE OA ':'ส่ง SMS ')+'เตือนต่ออายุแล้ว');
  const resetBind=()=>{ if(!window.confirm('รีเซ็ตการผูกบัตรกับเครื่อง/LINE เดิม? — ใช้เมื่อสมาชิกเปลี่ยนมือถือ/เครื่องใหม่ แล้วเปิดบัตรไม่ได้'))return; setData(dd=>{ const mm=mbOf(dd,id); if(mm){ mm.boundTo=null; } return {...dd}; }); toast('รีเซ็ตแล้ว — ให้สมาชิกเปิดบัตรจากเครื่อง/LINE ใหม่เพื่อผูกใหม่'); };
  return (<Sheet title={m.name} tag={m.code+' · '+(m.line?'LINE OA':'ผูกเบอร์ '+m.phone)} onClose={onClose}>
    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10,flexWrap:'wrap'}}>{stPill(m)}<span className="pill pn">{pk?pk.name:'—'}</span>{m.expiry&&<span style={{fontSize:12,color:'var(--ink-3)'}}>หมด {thDate(m.expiry)}</span>}</div>
    <label className="lb" style={{marginTop:0}}>เลือกแพ็ก/ต่ออายุ</label>
    {d.packages.map(p=>(<button key={p.id} className="pkbtn" onClick={()=>setRp(p.id)} style={rp===p.id?{borderColor:'var(--brand)',background:'var(--brand-softer)'}:null}>
      <div><b>{p.name}</b>{p.pop&&<span className="pill py" style={{marginLeft:6,fontSize:9,padding:'0 5px'}}>ยอดนิยม</span>}<div className="s" style={{fontSize:11.5,color:'var(--ink-3)'}}>{p.desc}</div></div><b className="num">{B(p.price)}</b></button>))}
    <div style={{display:'flex',gap:8,marginTop:12}}><button className="btn pri" style={{flex:1}} disabled={!dayOpen} onClick={()=>dayOpen?renew():toast('เปิดวันก่อนจึงต่ออายุ/เก็บเงินได้')}>ต่ออายุ / เปลี่ยนแพ็ก</button></div>
    {!dayOpen&&<div className="note gold" style={{marginTop:8}}>🔒 ปิดวันอยู่ — เปิดวันก่อนจึงต่ออายุ/เก็บเงินได้ (เตือน/พักยังทำได้)</div>}
    <div style={{display:'flex',gap:8,marginTop:8}}><button className="btn gh" style={{flex:1}} onClick={remind}>{m.line?'เตือน LINE':'เตือน SMS'}</button><button className="btn gh" style={{flex:1}} onClick={freeze}>{m.frozen?'ยกเลิกพัก':'พัก (freeze)'}</button></div>
    {pk&&pk.kind==='sessions'&&<div className="note blue" style={{marginTop:12}}>🏋️ PT คงเหลือ {m.ptLeft} เซสชัน</div>}
    {(m.bundles||[]).some(b=>(b.used||0)<b.total)&&<div style={{marginTop:14}}>
      <label className="lb" style={{marginTop:0}}>สิทธิ์ในแพ็ก (โควต้า) — คีย์ออเดอร์/สแกนตัดสต๊อก</label>
      {(m.bundles||[]).filter(b=>(b.used||0)<b.total).map(b=>{ const left=b.total-(b.used||0); return (
        <div key={b.id} className="row" style={{alignItems:'center'}}>
          <div className="b"><div className="t">{b.name}</div><div className="s">เหลือ {left}/{b.total} · {B(b.price)}/ครั้ง{b.log&&b.log.length?' · ใช้ล่าสุด '+thDate(new Date(b.log[b.log.length-1]).toISOString().slice(0,10)):''}</div></div>
          <button className="btn gh sm" style={{flex:'0 0 auto'}} disabled={!dayOpen} onClick={()=>{ if(!dayOpen){toast('เปิดวันก่อน');return;} if(b.per>0){ const cut=Date.now()-7*864e5; if((b.log||[]).filter(t=>t>cut).length>=b.per){ toast('ใช้ครบโควต้าสัปดาห์นี้ ('+b.per+'/สัปดาห์)'); return; } } setData(dd=>{ if(window.fitRedeem)window.fitRedeem(dd,id,b.id,'counter'); return {...dd}; }); toast('🍽️ ส่งเข้าออเดอร์ · '+b.name+' · สแกน '+B(b.price)); }}>ใช้ 1 · {B(b.price)}</button>
        </div>); })}
    </div>}
    {m.boundTo&&<div className="row" style={{marginTop:12,alignItems:'center'}}>
      <div className="ic" style={{background:'var(--brand-soft)',color:'var(--brand-ink)'}}>🔐</div>
      <div className="b"><div className="t">บัตรผูกกับเครื่อง/LINE แล้ว</div><div className="s" style={{lineHeight:1.4}}>กันแคปหน้าจอส่งต่อ · เคสเปลี่ยนมือถือ/ไม่ใช้ LINE = กดรีเซ็ต</div></div>
      <button className="btn gh sm" style={{flex:'0 0 auto'}} onClick={resetBind}>รีเซ็ตการผูก</button>
    </div>}
    <div style={{display:'flex',gap:8,marginTop:16}}><button className="btn gh" style={{flex:1}} onClick={archive}>{m.archived?'↩︎ เอากลับเข้าทะเบียน':'📦 เก็บเข้าคลัง (ไม่นับโควต้า)'}</button><button className="btn dngh" style={{flex:'0 0 auto'}} onClick={del}>ลบ</button></div>
  </Sheet>);
}
function AddMemberSheet({d,setData,toast,onClose}){
  const [f,setF]=useState({name:'',phone:'',birth:'',packageId:'pk-m1',line:true}); const set=(k,v)=>setF({...f,[k]:v});
  const save=()=>{ if(fitOverCap(d)){ toast('⚠️ เต็มโควต้าแพ็ก'+fitPlan(d).th+' ('+fitPlan(d).cap+' สมาชิก) — อัปแพ็กเพื่อเพิ่มสมาชิก'); return; } const ph=f.phone.trim(); if(ph&&(d.members||[]).some(m=>m.phone&&m.phone.replace(/\D/g,'')===ph.replace(/\D/g,''))){ toast('⚠️ เบอร์นี้มีสมาชิกแล้ว'); return; } setData(dd=>{ const pk=pkgOf(dd,f.packageId); const n=dd.members.length+1; const nid='mb-'+Date.now().toString(36);
    dd.members.push({id:nid,code:'M'+pad(n),name:f.name,phone:ph,birth:f.birth||'',line:f.line,packageId:f.packageId,start:todayISO(),expiry:pk.months?isoAdd(todayISO(),pk.months*30):null,joinedAt:todayISO(),frozen:false,parq:false,consent:false,ptLeft:pk.kind==='sessions'?pk.sessions:0,spend:pk.price||0,bodyBefore:null,bodyAfter:null});
    if(pk.price)dd.renewals.push({id:'rv-'+Date.now().toString(36),memberId:nid,packageId:f.packageId,at:Date.now(),amount:pk.price,via:'counter',kind:'renew',verified:true,staffBy:(staffOf(dd,dd.currentStaffId)||{}).name}); return {...dd}; }); toast('เพิ่มสมาชิกแล้ว'); onClose(); };
  return (<Sheet title="เพิ่มสมาชิกใหม่" onClose={onClose}>
    <label className="lb" style={{marginTop:0}}>ชื่อ-นามสกุล</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)}/>
    <label className="lb">เบอร์โทร (ผูกตัวตน · ห้ามซ้ำ)</label><input className="field num" value={f.phone} onChange={e=>set('phone',e.target.value)}/>
    <label className="lb">วัน/เดือน/ปีเกิด (ตั้งครั้งเดียว · แก้ภายหลังไม่ได้)</label><input className="field" type="date" value={f.birth} onChange={e=>set('birth',e.target.value)}/>
    <label className="lb">แพ็กเกจ</label>
    {d.packages.filter(p=>p.kind!=='daypass').map(p=>(<button key={p.id} className="pkbtn" onClick={()=>set('packageId',p.id)} style={f.packageId===p.id?{borderColor:'var(--brand)',background:'var(--brand-softer)'}:null}><div><b>{p.name}</b><div className="s" style={{fontSize:11.5,color:'var(--ink-3)'}}>{p.desc}</div></div><b className="num">{B(p.price)}</b></button>))}
    <label className="chk"><input type="checkbox" checked={f.line} onChange={e=>set('line',e.target.checked)}/> เชื่อม LINE OA (เตือนต่ออายุอัตโนมัติ)</label>
    <button className="btn pri blk" style={{marginTop:16}} disabled={!f.name} onClick={save}>บันทึก + เปิดใช้งาน</button>
  </Sheet>);
}
function ImportSheet({d,setData,toast,onClose}){
  const [step,setStep]=useState('up');
  const [head,setHead]=useState([]); const [body,setBody]=useState([]); const [map,setMap]=useState({});
  const HINTS={name:/ชื่อ|name|สมาชิก/i,phone:/เบอร์|โทร|phone|tel|mobile/i,pkg:/แพ็?ก|package|plan|โปรแกรม/i,expiry:/หมดอาย|expire|expiry|สิ้นสุด|วันหมด/i,pt:/pt|เทรน|เซสชั|session/i,birth:/เกิด|birth|dob/i};
  const pick=()=>{ const i=document.createElement('input'); i.type='file'; i.accept='.csv,text/csv,.txt,.tsv'; i.onchange=e=>{ const fl=e.target.files&&e.target.files[0]; if(!fl)return; const r=new FileReader(); r.onload=()=>{ const rows=parseCSV(String(r.result||'')); if(rows.length<2){toast('ไฟล์ว่าง/ไม่มีข้อมูล');return;} const h=rows[0].map(x=>String(x).trim()); const mp={}; Object.keys(HINTS).forEach(k=>{ const idx=h.findIndex(c=>HINTS[k].test(c)); if(idx>=0)mp[k]=idx; }); if(mp.name==null)mp.name=0; setHead(h); setBody(rows.slice(1)); setMap(mp); setStep('map'); }; r.readAsText(fl,'utf-8'); }; i.click(); };
  const setM=(k,v)=>setMap(x=>({...x,[k]:v===''?undefined:+v}));
  const g=(row,k)=>map[k]!=null?String(row[map[k]]||'').trim():'';
  const norm=(p)=>String(p||'').replace(/\D/g,'');
  const existPhones=new Set((d.members||[]).map(m=>norm(m.phone)).filter(Boolean));
  const cand=body.map(row=>{ const name=g(row,'name'); const pkgName=g(row,'pkg'); const pk=pkgName?(d.packages||[]).find(p=>p.name.toLowerCase().includes(pkgName.toLowerCase())||pkgName.toLowerCase().includes(p.name.toLowerCase())):null; return {name,phone:g(row,'phone'),pkgName,pk,expiry:parseDate(g(row,'expiry')),pt:Math.round(Number(g(row,'pt').replace(/[^\d.]/g,''))||0),birth:parseDate(g(row,'birth'))}; }).filter(c=>c.name);
  const seen=new Set(); const marked=cand.map(c=>{ const ph=norm(c.phone); const dup=!!(ph&&(existPhones.has(ph)||seen.has(ph))); if(ph)seen.add(ph); return {...c,dup}; });
  const good=marked.filter(c=>!c.dup); const dupN=marked.length-good.length;
  const capLeft=fitCapLeft(d); const willImport=capLeft===Infinity?good:good.slice(0,capLeft); const overflow=good.length-willImport.length;
  const doImport=()=>{ if(!willImport.length){toast('ไม่มีรายการที่นำเข้าได้');return;} setData(dd=>{ let n=dd.members.length; const now=Date.now(); willImport.forEach((c,i)=>{ n++; const nid='mb-'+now.toString(36)+i; const pk=c.pk; const expiry=c.expiry||(pk&&pk.months?isoAdd(todayISO(),pk.months*30):null); dd.members.push({id:nid,code:'M'+pad(n),name:c.name,phone:c.phone||'',birth:c.birth||'',line:false,packageId:pk?pk.id:null,start:todayISO(),expiry,joinedAt:todayISO(),frozen:false,parq:false,consent:false,ptLeft:c.pt||0,spend:0,imported:true,bodyBefore:null,bodyAfter:null}); }); return {...dd}; }); toast('✅ นำเข้า '+willImport.length+' สมาชิกแล้ว'); onClose(); };
  return (<Sheet title="นำเข้าสมาชิกจากระบบเก่า" tag="CSV / Excel (บันทึกเป็น .csv)" onClose={onClose}>
    {step==='up'?<>
      <div className="note g">รองรับ <b>.csv</b> (Excel → Save As CSV) · คอลัมน์ที่ใช้: ชื่อ · เบอร์ · แพ็ก · วันหมดอายุ · PT เหลือ · วันเกิด <br/>ระบบจับคอลัมน์ให้อัตโนมัติ · ดูตัวอย่างก่อนยืนยัน</div>
      <button className="btn pri blk" style={{marginTop:14}} onClick={pick}>📁 เลือกไฟล์ CSV</button>
    </>:<>
      <div className="note g" style={{marginBottom:10}}>จับคู่คอลัมน์ให้ตรง → ดูตัวอย่างก่อนยืนยัน</div>
      {[['name','ชื่อ *'],['phone','เบอร์ (กันซ้ำ)'],['pkg','แพ็ก'],['expiry','วันหมดอายุ'],['pt','PT เหลือ'],['birth','วันเกิด']].map(([k,l])=>(
        <div key={k} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}><span style={{width:96,fontSize:12.5,color:'var(--ink-3)'}}>{l}</span>
          <select className="field" style={{flex:1,padding:'7px 8px'}} value={map[k]==null?'':map[k]} onChange={e=>setM(k,e.target.value)}><option value="">— ไม่ใช้ —</option>{head.map((h,i)=><option key={i} value={i}>{h||('คอลัมน์ '+(i+1))}</option>)}</select></div>))}
      <div className="card" style={{marginTop:10,padding:'10px 12px',fontSize:12.5}}>พบ <b>{marked.length}</b> แถว · นำเข้าได้ <b style={{color:'var(--brand-ink)'}}>{willImport.length}</b>{dupN>0&&<> · ซ้ำ(ข้าม) <b style={{color:'var(--red)'}}>{dupN}</b></>}{overflow>0&&<> · เกินโควต้า <b style={{color:'var(--red)'}}>{overflow}</b></>}</div>
      <div className="card" style={{marginTop:8,maxHeight:190,overflowY:'auto',padding:6}}>
        {marked.slice(0,12).map((c,i)=>(<div key={i} className="row" style={{padding:'6px 6px',opacity:c.dup?0.5:1}}>
          <div className="b"><div className="t" style={{fontSize:13}}>{c.name} {c.dup&&<span className="pill" style={{background:'#FDECEC',color:'#B4232A',fontSize:9,padding:'0 5px'}}>ซ้ำ</span>}</div><div className="s" style={{fontSize:11}}>{c.phone||'—'} · {c.pk?c.pk.name:(c.pkgName||'ไม่มีแพ็ก')}{c.expiry?' · ถึง '+c.expiry:''}{c.pt?' · PT '+c.pt:''}</div></div></div>))}
        {marked.length>12&&<div style={{fontSize:11,color:'var(--ink-3)',padding:'4px 6px'}}>+ อีก {marked.length-12} แถว</div>}
      </div>
      {overflow>0&&<div className="note gold" style={{marginTop:8}}>เกินโควต้าแพ็ก{fitPlan(d).th} — นำเข้าเฉพาะ {willImport.length} คนแรก · อัปแพ็กเพื่อเพิ่ม</div>}
      <div style={{display:'flex',gap:8,marginTop:12}}><button className="btn gh" style={{flex:1}} onClick={()=>setStep('up')}>← เลือกไฟล์ใหม่</button><button className="btn pri" style={{flex:1.4}} disabled={!willImport.length} onClick={doImport}>นำเข้า {willImport.length} สมาชิก</button></div>
    </>}
  </Sheet>);
}

function ChangeReqReview({d,setData,toast,onClose}){
  const reqs=(d.changeRequests||[]).filter(r=>r.status==='pending');
  const FLBL={name:'ชื่อ',birth:'วันเกิด',phone:'เบอร์',other:'อื่นๆ'};
  const act=(id,okv)=>setData(dd=>{ const r=(dd.changeRequests||[]).find(x=>x.id===id); if(!r)return {...dd}; if(okv){ const mm=mbOf(dd,r.memberId); if(mm&&r.field!=='other'&&r.newValue){ mm[r.field]=r.newValue; if(r.field==='birth')mm.birthLocked=true; } } r.status=okv?'approved':'rejected'; r.by=(staffOf(dd,dd.currentStaffId)||{}).name; r.doneAt=Date.now(); return {...dd}; });
  return (<Sheet title="คำขอแก้ไขข้อมูล" tag="ตรวจบัตร ปชช. ก่อนอนุมัติ" onClose={onClose}>
    {reqs.length===0&&<div className="empty">ไม่มีคำขอค้าง</div>}
    {reqs.map(r=>(<div className="card" key={r.id} style={{marginBottom:10}}>
      <div style={{fontWeight:700}}>{r.memberName} · แก้{FLBL[r.field]||r.field}</div>
      <div style={{fontSize:12.5,color:'var(--ink-3)',margin:'4px 0'}}>{r.oldValue||'—'} → <b style={{color:'var(--brand-ink)'}}>{r.newValue||'(ดูหมายเหตุ)'}</b></div>
      {r.note&&<div style={{fontSize:12,color:'var(--ink-3)',marginBottom:4}}>📝 {r.note}</div>}
      {r.idPhoto&&<img src={r.idPhoto} alt="บัตรประชาชน" style={{width:'100%',maxHeight:170,objectFit:'contain',borderRadius:8,margin:'6px 0',background:'#f2f2f2'}}/>}
      <div style={{display:'flex',gap:8,marginTop:6}}><button className="btn gh sm" style={{flex:1,color:'var(--red)'}} onClick={()=>act(r.id,false)}>ปฏิเสธ</button><button className="btn pri sm" style={{flex:1.3}} onClick={()=>act(r.id,true)}>✓ อนุมัติ & แก้ให้</button></div>
    </div>))}
  </Sheet>);
}

/* ═══ แพ็กเกจโปรแกรม + แบนเนอร์โควต้าสมาชิก ═══ */
function PlanBanner({d,onUpgrade}){ const cap=fitPlan(d).cap; if(cap===Infinity)return null; const used=activeMemberCount(d); const left=cap-used; if(left>10)return null; const over=left<=0;
  return (<div className="card" style={{background:over?'#FDECEC':'#FFF7E6',border:'1px solid '+(over?'#F1AEAE':'#F3D98B'),marginBottom:12}}>
    <div style={{fontWeight:700,fontSize:13.5,color:over?'#B4232A':'#8A6A00'}}>{over?'⚠️ เต็มโควต้าสมาชิกแล้ว':'⏳ ใกล้เต็มโควต้าสมาชิก'}</div>
    <div style={{fontSize:12.5,color:'var(--ink-3)',margin:'4px 0 10px'}}>ใช้ {used}/{cap} คน (แพ็ก{fitPlan(d).th}) · {over?'เพิ่มสมาชิกใหม่ไม่ได้จนกว่าจะอัปแพ็ก':'เหลืออีก '+left+' ที่'}</div>
    <button className="btn pri sm" onClick={()=>onUpgrade?onUpgrade():window.dispatchEvent(new CustomEvent('fit-go',{detail:'plan'}))}>อัปเกรดแพ็ก →</button></div>); }
function OwnerPlan({d,setData,toast}){
  const cur=(d.plan&&d.plan.tier)||'free'; const used=activeMemberCount(d); const total=(d.members||[]).length; const cap=fitPlan(d).cap;
  const [cycle,setCycle]=useState((d.plan&&d.plan.cycle)||'mo');
  const [wTick,setWTick]=useState(0);
  const yr=(p)=>p*10; const priceOf=(t)=>cycle==='yr'?yr(t.price):t.price;
  const WP=window.KDWalletPanel; const KDW=window.KDW;
  const bizId=KDW?KDW.biz('fitness',(d.gym&&d.gym.id)||'main'):'';
  const curT=fitTierOf(cur); const dueAmt=curT&&curT.price>0?priceOf(curT):0;
  const choose=(tid)=>{ const t=fitTierOf(tid); const amt=priceOf(t);
    if(t.price>0){
      if(!KDW){ toast('กระเป๋าเงินยังไม่พร้อม · โหลดหน้าใหม่อีกครั้ง'); return; }
      const res=KDW.charge(bizId,amt,{who:(d.gym&&d.gym.name)||'ยิม (ฟิตเนส)',sub:'ค่าบริการฟิตเนส '+t.th+' '+B(t.price)+'/เดือน'+(cycle==='yr'?' (รายปี)':''),type:'fee'});
      if(!res.ok){ toast(res.short>0?('ยอดกระเป๋าไม่พอ · ขาดอีก '+B(res.short)+' → เติมเงินก่อน'):res.error); setWTick(x=>x+1); return; }
      setWTick(x=>x+1);
    }
    setData(dd=>{ dd.plan={...(dd.plan||{}),tier:tid,cycle,since:Date.now(),paid:t.price>0}; return {...dd}; });
    toast(t.price>0?('✅ สมัครแพ็ก '+t.th+' แล้ว · หักจากกระเป๋าเงินร้าน'):('เปลี่ยนเป็นแพ็ก '+t.th+' แล้ว')); };
  return (<div className="fade">
    {WP?<div style={{marginBottom:12}} key={wTick}><WP biz={bizId} who={(d.gym&&d.gym.name)||'ยิม (ฟิตเนส)'} due={dueAmt||undefined}
      dueLabel={dueAmt?('ค่าบริการแพ็ก'+curT.th+' '+(cycle==='yr'?'รายปี':'รายเดือน')):undefined} onChange={()=>setWTick(x=>x+1)}/></div>
      :<div className="note" style={{marginBottom:12}}>ยังไม่ได้โหลดกระเป๋าเงิน (kd-wallet.jsx)</div>}
    <div className="card"><h3>สมาชิกที่ใช้โควต้าตอนนี้</h3>
      <div style={{display:'flex',alignItems:'baseline',gap:8}}><div className="num" style={{fontSize:30,fontWeight:800}}>{used}</div><div style={{color:'var(--ink-3)'}}>/ {cap===Infinity?'ไม่จำกัด':cap} สมาชิก active</div></div>
      <div className="note g" style={{marginTop:8}}>นับเฉพาะสมาชิกที่ยังไม่หมดอายุ · หมดอายุ/เก็บเข้าคลัง ไม่นับ (ทะเบียนทั้งหมด {total} คน)</div>
      {cap!==Infinity&&<div style={{height:8,background:'var(--hair,#eee)',borderRadius:99,overflow:'hidden',marginTop:10}}><div style={{height:'100%',width:Math.min(100,used/cap*100)+'%',background:used>=cap?'#D64545':'var(--brand)'}}></div></div>}
    </div>
    <div className="seg" style={{marginBottom:12}}>{[['mo','รายเดือน'],['yr','รายปี · ประหยัด 2 เดือน']].map(([k,l])=><button key={k} className={cycle===k?'on':''} onClick={()=>setCycle(k)}>{l}</button>)}</div>
    {FIT_TIERS.map(t=>{ const on=t.id===cur; const disabled=t.cap!==Infinity&&used>t.cap;
      return (<div key={t.id} className="card" style={{border:on?'2px solid var(--brand)':'1px solid var(--hair,#eee)',background:on?'var(--brand-softer)':'#fff'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div><div style={{fontWeight:800,fontSize:16}}>{t.th} {on&&<span className="pill pg" style={{fontSize:9,padding:'0 5px'}}>ใช้อยู่</span>}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>{t.sub}</div></div>
          <div style={{textAlign:'right'}}><div className="num" style={{fontWeight:800,fontSize:18}}>{t.price?B(priceOf(t)):'ฟรี'}</div>{t.price?<div style={{fontSize:11,color:'var(--ink-3)'}}>{cycle==='yr'?'/ปี':'/เดือน'}</div>:null}</div>
        </div>
        <div style={{fontSize:12.5,margin:'8px 0 12px'}}>สมาชิกได้ถึง <b>{t.cap===Infinity?'ไม่จำกัด':t.cap+' คน'}</b>{t.id!=='free'&&' · เปิด add-on เสริมได้'}</div>
        {!on&&<button className="btn pri blk sm" disabled={disabled} onClick={()=>choose(t.id)}>{disabled?'สมาชิก active เกินเพดานแพ็กนี้':(t.price>0?'สมัคร / อัปเกรดแพ็กนี้':'ใช้แพ็กฟรี')}</button>}
        {on&&t.price>0&&<button className="btn gh blk sm" onClick={()=>choose(t.id)}>ต่ออายแพ็กนี้ ({cycle==='yr'?'รายปี':'รายเดือน'})</button>}
      </div>); })}
    <div className="note g" style={{marginTop:6}}>แพ็กตั้งแต่ “เริ่มต้น” ขึ้นไป เปิด add-on เสริมได้ (PT · คลาส · โควต้า · ทีมขาย · Kiosk · ขายฝาก)</div>
  </div>);
}

/* ═══ เช็คอินหน้าประตู ═══ */
function OwnerCheckin({d,setData,toast}){
  const [method,setMethod]=useState('nfc'); const [result,setResult]=useState(null); const [pick,setPick]=useState('');
  const [guide,setGuide]=useState(false);
  const [wMsg,setWMsg]=useState(d.gym.checkinWelcome||''); const [dMsg,setDMsg]=useState(d.gym.checkinDeny||''); const [gMsg,setGMsg]=useState(d.gym.checkinWellness||'');
  const [scanCode,setScanCode]=useState('');
  const saveMsg=(k,v)=>setData(dd=>{ dd.gym={...dd.gym,[k]:v}; return {...dd}; });
  const modes=d.gym.checkinModes||{phone:true,kiosk:true};
  const setMode=(k,v)=>setData(dd=>{ dd.gym={...dd.gym,checkinModes:{phone:true,kiosk:true,...(dd.gym.checkinModes||{}),[k]:v}}; return {...dd}; });
  const today=d.checkins.filter(c=>new Date(c.at).toDateString()===new Date().toDateString()).sort((a,b)=>b.at-a.at);
  const doCheck=(mid)=>{ const m=mbOf(d,mid); if(!m)return;
    const recent=d.checkins.filter(c=>c.memberId===mid&&c.result==='ok'&&Date.now()-c.at<10*60000).sort((a,b)=>b.at-a.at)[0];
    if(recent && !confirm(firstName(m.name)+' เพิ่งเช็คอินเมื่อ '+thTime(recent.at)+' น. — เช็คอินซ้ำ? (กันบัตร/แคปหน้าจอถูกใช้ซ้ำ)')) return;
    const ok=canEnter(m); setResult({m,ok,s:memberStatus(m)});
    setData(dd=>{ dd.checkins.push({id:'ck-'+Date.now().toString(36),memberId:mid,at:Date.now(),method,result:ok?'ok':'denied'}); return {...dd}; }); };
  const doScanCode=()=>{ const v=String(scanCode||'').trim(); if(!v)return;
    if(v.indexOf('FMB.')===0){ const r=F.fitVerifyToken(d,v);
      if(!r.ok){ toast(r.reason==='stale'?'✕ โค้ดหมดอายุ (ภาพแคปเก่า ใช้ไม่ได้)':'✕ บัตรไม่ถูกต้อง/ปลอม'); setScanCode(''); return; }
      setScanCode(''); return doCheck(r.memberId); }
    const m=d.members.find(x=>x.code===v||x.id===v); if(m){ setScanCode(''); return doCheck(m.id); }
    toast('ไม่พบบัตร/โค้ดนี้'); };
  const active=d.members.filter(m=>['active','expiring'].includes(memberStatus(m).key)).slice(0,6);
  const expired=d.members.filter(m=>memberStatus(m).key==='expired')[0];
  const ModeRow=({k,em,t,s})=>(<label className="row" style={{cursor:'pointer',padding:'11px 0'}}>
    <div className="ic" style={{background:'var(--brand-soft)',color:'var(--brand-ink)'}}>{em}</div>
    <div className="b"><div className="t">{t}</div><div className="s" style={{lineHeight:1.4}}>{s}</div></div>
    <input type="checkbox" style={{width:19,height:19,accentColor:'var(--brand)',flex:'0 0 auto'}} checked={modes[k]!==false} onChange={e=>setMode(k,e.target.checked)}/>
  </label>);
  return (<div className="fade">
    <div className="card">
      <h3>โหมดเช็คอิน — ร้านเลือกใช้ได้ <span className="lnk" onClick={()=>setGuide(g=>!g)}>{guide?'ซ่อนคู่มือ':'📖 คู่มือ'}</span></h3>
      <ModeRow k="phone" em="📱" t="สมาชิกแตะด้วยมือถือเอง (ผ่าน LINE)" s="แตะสติกเกอร์ NFC / สแกน QR ที่ประตู → เปิดใน LINE → รู้ตัวตนอัตโนมัติ ผลขึ้นบนมือถือสมาชิก"/>
      <ModeRow k="kiosk" em="🖥️" t="จอเช็คอินหน้าประตู (แท็บเล็ต + เครื่องอ่าน)" s="ตั้งจอ Fitness Checkin ที่ประตู สมาชิกแตะบัตร/มือถือ → ผลเขียว/แดงขึ้นบนจอประตู"/>
      {!modes.phone&&!modes.kiosk&&<div className="note gold" style={{marginTop:10}}>⚠️ ยังไม่ได้เปิดโหมดใดเลย — สมาชิกจะเช็คอินเองไม่ได้ (พนักงานยังค้นชื่อเช็คให้ได้ด้านล่าง)</div>}
      {guide&&<div style={{marginTop:12,display:'grid',gap:9}}>
        {modes.phone&&<div className="note g"><b>📱 โหมดมือถือสมาชิก</b><br/>1. เปิด LINE OA ยิม + ให้สมาชิกผูกบัตรครั้งเดียว<br/>2. แปะสติกเกอร์ NFC (หรือ QR) ที่ประตู — ทำป้ายได้ที่เมนู "ป้าย NFC เช็คอิน"<br/>3. สมาชิกเปิดจอมือถือ แตะที่ป้าย → เปิดใน LINE → ระบบรู้ว่าเป็นใคร เช็คสิทธิ์ให้เอง<br/>ℹ️ มือถือต้องเปิดจอ · สติกเกอร์แบรนด์ติดทับได้ (ห้ามฟอยล์โลหะ)</div>}
        {modes.kiosk&&<div className="note blue"><b>🖥️ โหมดจอประตู</b><br/>1. เปิดหน้า <b>Fitness Checkin.html</b> บนแท็บเล็ตที่ประตู (จอเต็ม ไม่ถามรหัส)<br/>2. ต่อเครื่องอ่าน NFC/QR ที่ส่งรหัสสมาชิกเข้าหน้าจอ (<span className="mono">?m=รหัส</span>)<br/>3. สมาชิกแตะ → จอโชว์ ✓ เขียว "ยินดีต้อนรับ" / ✕ แดง "ต่ออายุ" แล้วกลับหน้ารออัตโนมัติ<br/>ℹ️ ตั้งข้อความต้อนรับเองได้ (<span className="mono">?welcome=</span>)</div>}
        <div className="note gold"><b>บันทึกร่วมกัน</b> — ทั้ง 2 โหมดเขียนสถิติเข้าออกชุดเดียวกัน โชว์ที่ "ภาพรวม" และรายการด้านล่างนี้</div>
      </div>}
    </div>
    <div className="card">
      <h3>ข้อความบนจอเช็คอิน</h3>
      <div className="note g" style={{marginBottom:10}}>เว้นว่าง = ใช้ค่าเริ่มต้น · โชว์บนจอประตู (Fitness Checkin) — สมาชิกเห็นตอนเช็คอินสำเร็จ</div>
      <label className="lb" style={{marginTop:0}}>ข้อความ“เข้าได้” (เขียว)</label>
      <input className="field" value={wMsg} onChange={e=>setWMsg(e.target.value)} onBlur={()=>saveMsg('checkinWelcome',wMsg.trim())} placeholder="เข้าได้ ยินดีต้อนรับ" maxLength={40}/>
      <label className="lb">ข้อความอวยพร (เขียว · ต่อจากชื่อ)</label>
      <input className="field" value={gMsg} onChange={e=>setGMsg(e.target.value)} onBlur={()=>saveMsg('checkinWellness',gMsg.trim())} placeholder="ขอให้สุขภาพแข็งแรงนะครับ 💪" maxLength={40}/>
      <label className="lb">ข้อความ“ยังเข้าไม่ได้” (แดง)</label>
      <input className="field" value={dMsg} onChange={e=>setDMsg(e.target.value)} onBlur={()=>saveMsg('checkinDeny',dMsg.trim())} placeholder="ยังเข้าไม่ได้" maxLength={40}/>
    </div>
    <div className="secttl">ทดสอบ / พนักงานเช็คให้</div>
    <div className="card" style={{marginBottom:12}}>
      <h3>สแกนโค้ดบัตรสมาชิก</h3>
      <div className="note g" style={{marginBottom:10}}>เครื่องอ่าน NFC/QR ยิงโค้ดเข้าช่องนี้ · หรือวางบัตร/โค้ดสมาชิกก็ได้ — โค้ดหมุนที่แคปเก่าจะใช้ไม่ได้</div>
      <div style={{display:'flex',gap:8}}>
        <input className="field" style={{flex:1,fontFamily:'var(--mono,monospace)'}} value={scanCode} onChange={e=>setScanCode(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')doScanCode();}} placeholder="FMB.xxx... หรือรหัสบัตร"/>
        <button className="btn pri" onClick={doScanCode}>ตรวจ</button>
      </div>
    </div>
    <div className="seg" style={{marginBottom:12}}>{[['nfc','แตะ NFC'],['qr','สแกน QR']].map(([k,l])=><button key={k} className={method===k?'on':''} onClick={()=>setMethod(k)}>{l}</button>)}</div>
    {result?<div className={'result '+(result.ok?'ok':'no')}><div className="ri">{result.ok?'✓':'✕'}</div><div className="rn">{result.m.name}</div>
      <div className="rs">{result.ok?('เข้าได้ · '+(pkgOf(d,result.m.packageId)||{}).name):('ปฏิเสธ · หมดอายุ '+Math.abs(result.s.d)+' วัน')}</div>
      {!result.ok&&<div style={{marginTop:8,fontWeight:700,color:'var(--red)',fontSize:13}}>แจ้งสมาชิก: ต่ออายุจ่ายในแอปได้เลย</div>}
      <button className="btn gh sm" style={{marginTop:14}} onClick={()=>{setResult(null);setPick('');}}>แตะคนถัดไป</button></div>
    :<div className="card" style={{textAlign:'center'}}><div className="nfc-badge">{method==='nfc'?'📶':'▦'}</div>
      <div style={{fontSize:12.5,color:'var(--ink-3)',marginBottom:12,lineHeight:1.5}}>{method==='nfc'?'สติกเกอร์ NFC แปะที่ประตู — แตะเพื่อจำลอง':'ลูกค้าสแกน QR ที่ประตู — เลือกเพื่อจำลอง'}</div>
      <div className="grid2">{active.map(m=><button key={m.id} className="btn gh sm" onClick={()=>doCheck(m.id)}>🟢 {firstName(m.name)}</button>)}
        {expired&&<button className="btn dngh sm" onClick={()=>doCheck(expired.id)}>🔴 {firstName(expired.name)} (หมด)</button>}</div>
      <select className="field" style={{marginTop:10}} value={pick} onChange={e=>{setPick(e.target.value);if(e.target.value)doCheck(e.target.value);}}><option value="">— หรือค้นสมาชิกโดยพนักงาน —</option>{d.members.map(m=><option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select>
    </div>}
    <div className="card" style={{marginTop:12}}><h3>บันทึกเข้าวันนี้ <span className="lnk">{today.length} ครั้ง</span></h3>
      {today.length?today.map(c=>{ const m=mbOf(d,c.memberId); const ok=c.result==='ok'; return (<div className="row" key={c.id}>
        <div className="ic" style={{background:ok?'var(--green-soft)':'var(--red-soft)',color:ok?'var(--green)':'var(--red)'}}>{ok?'✓':'✕'}</div>
        <div className="b"><div className="t">{m?m.name:'—'}</div><div className="s">{c.method==='nfc'?'แตะ NFC':'สแกน QR'} · {thTime(c.at)}</div></div>
        <span className={'pill '+(ok?'pg':'pr')}>{ok?'เข้าได้':'ปฏิเสธ'}</span></div>); }):<div className="empty">ยังไม่มีการเข้าวันนี้</div>}</div>
  </div>);
}

/* ═══ More menu → คลาส/PT/สต๊อก/รายงาน/จับยอด ═══ */
/* ═══ ระบบพนักงาน · ทะเบียน/PIN/เข้างาน/จับคนขาย ═══ */
const STAFF_ROLES={owner:{th:'เจ้าของ',cls:'pplum'},manager:{th:'ผู้จัดการ',cls:'pb'},staff:{th:'พนักงาน',cls:'pg'},sales:{th:'ทีมขาย',cls:'pb'},trainer:{th:'เทรนเนอร์',cls:'py'}};
function ensureStaff(dd){ if(!dd.staff){ const base=[
    {id:'st-own',name:'เจ้าของร้าน',role:'owner',pin:'0000',active:true,onShift:true,shiftAt:Date.now()},
    {id:'st-mgr',name:'ผู้จัดการ (ตัวอย่าง)',role:'manager',pin:'1111',active:true,onShift:false,shiftAt:null},
    {id:'st-1',name:'พนักงาน A',role:'staff',pin:'2222',active:true,onShift:false,shiftAt:null} ];
  const trs=(dd.trainers||[]).map((t,i)=>({id:'st-'+t.id,name:t.name,role:'trainer',pin:'33'+(i+1)+(i+1),active:t.active,onShift:false,shiftAt:null,trainerId:t.id}));
  dd.staff=[...base,...trs]; }
  if(!dd.currentStaffId) dd.currentStaffId='st-own';
  if(!dd.staffShifts) dd.staffShifts=[];
  ensureSalesStaff(dd);
  fitSyncTrainers(dd);
  return dd; }
// ทะเบียนพนักงาน = แหล่งความจริงของชื่อ/สถานะ · โปรไฟล์เทรนเนอร์เก็บเฉพาะข้อมูล PT (rate/specialty/reviews) ผูกด้วย trainerId
function fitSyncTrainers(dd){ if(!dd.staff||!dd.trainers) return dd;
  dd.staff.filter(s=>s.role==='trainer'&&s.trainerId).forEach(s=>{ const t=dd.trainers.find(x=>x.id===s.trainerId);
    if(t){ t.name=s.name; t.active=s.active; }
    else dd.trainers.push({id:s.trainerId,name:s.name,specialty:'เทรนเนอร์',rate:500,rating:5,reviews:[],active:s.active,avail:'ทุกวัน'}); });
  return dd; }
function staffOf(d,id){ return (d.staff||[]).find(s=>s.id===id); }
function ensureSalesStaff(dd){ if(dd.staff && !dd.staff.some(s=>s.role==='sales')) dd.staff.push({id:'st-sales',name:'พนักงานขาย (ทีมขาย)',role:'sales',pin:'4444',active:true,onShift:false,shiftAt:null}); return dd; }
/* ═══ สิทธิ์การเข้าถึง (role-gating + permission matrix ต่อคน) ═══ */
const PERM_PAGES=[['sell','ขาย (POS)'],['members','สมาชิก'],['sales','ทีมขาย · โอกาสขาย'],['dayclose','เปิด/ปิดวัน'],['report','รายงานเชิงลึก'],['classes','คลาส & ตาราง'],['pt','เทรนเนอร์ PT'],['trainplan','ลูกเทรน & ตารางเทรน'],['health','ค่าร่างกาย & PAR-Q'],['checkin','เช็คอิน'],['stock','เมนู & สต๊อก'],['packages','แพ็กเกจ'],['vouchers','Voucher'],['paymatch','จับยอดพร้อมเพย์'],['promos','โปรโมชั่น'],['staff','จัดการพนักงาน'],['revenue','เห็นยอดเงิน/รายรับ'],['void','ยกเลิก/void บิล'],['settings','ตั้งค่าร้าน']];
// ค่าเริ่มต้นตามตำแหน่ง (เจ้าของ=ทุกอย่าง · ผู้จัดการ=เกือบเต็ม ยกเว้นรายงานเชิงลึก/ยอดเงิน · พนักงาน=ขาย+สมาชิก+เช็คอิน)
const ROLE_DEFAULTS={ manager:{sell:1,members:1,sales:1,dayclose:1,report:0,classes:1,pt:1,trainplan:1,health:1,checkin:1,stock:1,packages:1,vouchers:1,paymatch:1,promos:1,staff:1,revenue:0,void:1,settings:1}, staff:{sell:1,members:1,checkin:1,classes:1}, sales:{sell:1,members:1,sales:1,checkin:1,classes:1}, trainer:{classes:1,pt:1,trainplan:1,health:1,checkin:1} };
function staffCan(s,key){ if(!s) return true; if(s.role==='owner') return true; if(s.perms && s.perms[key]!=null) return !!s.perms[key]; const df=ROLE_DEFAULTS[s.role]||{}; return df[key]===1; }
function fitCan(d,key){ return staffCan(staffOf(d,d.currentStaffId),key); }
function onDutyList(d){ return (d.staff||[]).filter(s=>s.active&&s.onShift); }
function OnDutyCard({d,go}){ if(!d.staff) return null; const list=onDutyList(d);
  return (<div className="card"><h3>เจ้าหน้าที่เข้างานวันนี้ <span className="lnk" onClick={go?()=>go('staff'):null}>{list.length} คน{go?' →':''}</span></h3>
    {list.length?list.map(s=>(<div className="row" key={s.id}><div className="av">{s.name[0]}</div>
      <div className="b"><div className="t">{s.name}</div><div className="s">{STAFF_ROLES[s.role].th}{s.shiftAt?' · เข้างาน '+thTime(s.shiftAt):''}</div></div>
      <span className={'pill '+STAFF_ROLES[s.role].cls}>{STAFF_ROLES[s.role].th}</span></div>)):<div className="empty" style={{padding:'18px'}}>ยังไม่มีใครเข้างานวันนี้</div>}</div>); }
function OwnerStaff({d,setData,toast}){
  const [edit,setEdit]=useState(null);
  React.useEffect(()=>{ if(!d.staff||!d.currentStaffId) setData(dd=>ensureStaff({...dd})); },[]);
  const staff=d.staff||[]; const cur=staffOf(d,d.currentStaffId);
  const clock=(s)=>{ if(s.onShift){ setData(dd=>{ const x=staffOf(dd,s.id); x.onShift=false; (dd.staffShifts=dd.staffShifts||[]).push({staffId:s.id,type:'out',at:Date.now()}); if(dd.currentStaffId===s.id){ const o=(dd.staff||[]).find(z=>z.onShift); dd.currentStaffId=o?o.id:'st-own'; } return {...dd}; }); toast(s.name+' ออกงานแล้ว'); return; }
    const pin=window.prompt('ใส่ PIN ของ '+s.name+' เพื่อเข้างาน'); if(pin==null)return; if(String(pin)!==String(s.pin)){ toast('⚠️ PIN ไม่ถูกต้อง'); return; }
    setData(dd=>{ const x=staffOf(dd,s.id); x.onShift=true; x.shiftAt=Date.now(); dd.currentStaffId=s.id; (dd.staffShifts=dd.staffShifts||[]).push({staffId:s.id,type:'in',at:Date.now()}); return {...dd}; }); toast(s.name+' เข้างาน · กำลังขายในนามนี้'); };
  const setCur=(id)=>{ const tgt=staffOf(d,id); const curS=staffOf(d,d.currentStaffId); if(tgt&&curS&&tgt.id!==curS.id&&curS.role!=='owner'&&(tgt.role==='owner'||tgt.role==='manager')){ const pin=window.prompt('สลับเป็น '+tgt.name+' — ใส่ PIN ยืนยัน'); if(pin==null)return; if(String(pin)!==String(tgt.pin)){ toast('⚠️ PIN ไม่ถูกต้อง'); return; } } setData(dd=>{ dd.currentStaffId=id; return {...dd}; }); };
  const byRole=r=>staff.filter(s=>s.role===r);
  return (<div className="fade">
    <div className="card"><h3>กำลังขายในนาม</h3>
      <select className="field" value={d.currentStaffId||''} onChange={e=>setCur(e.target.value)}>{onDutyList(d).map(s=><option key={s.id} value={s.id}>{s.name} · {STAFF_ROLES[s.role].th}</option>)}{!onDutyList(d).length&&<option value="">— ยังไม่มีใครเข้างาน —</option>}</select>
      <div className="note g" style={{marginTop:10}}>ทุกบิลที่ขายจะบันทึกว่า “{cur?cur.name:'—'}” เป็นคนขาย (เปลี่ยนต่อบิลได้ที่หน้าขาย)</div>
    </div>
    <button className="btn pri blk sm" style={{marginBottom:12}} onClick={()=>setEdit('new')}>+ เพิ่มพนักงาน</button>
    {['owner','manager','staff','trainer'].map(role=>{ const rows=byRole(role); if(!rows.length)return null; return (<div key={role}>
      <div className="secttl">{STAFF_ROLES[role].th}</div>
      <div className="card">{rows.map(s=>(<div className="row" key={s.id}>
        <div className="av">{s.name[0]}</div>
        <div className="b" style={{cursor:role==='owner'?'default':'pointer'}} onClick={()=>role!=='owner'&&setEdit(s)}><div className="t">{s.name} {s.onShift&&<span className="pill pg" style={{fontSize:9,padding:'0 5px'}}>เข้างาน</span>}</div><div className="s">{s.active?'พร้อมทำงาน':'ปิดใช้งาน'}{s.onShift&&s.shiftAt?' · '+thTime(s.shiftAt):''}</div></div>
        <button className={'btn sm '+(s.onShift?'dngh':'gh')} style={{flex:'0 0 auto'}} disabled={!s.active} onClick={()=>clock(s)}>{s.onShift?'ออกงาน':'เข้างาน'}</button>
      </div>))}</div></div>); })}
    {edit&&<StaffSheet d={d} setData={setData} toast={toast} st={edit==='new'?null:edit} onClose={()=>setEdit(null)}/>}
  </div>);
}
function StaffSheet({d,setData,toast,st,onClose}){
  const [f,setF]=useState(()=>st?{name:st.name,role:st.role,pin:st.pin,active:st.active,perms:st.perms?{...st.perms}:null,comm:String(st.comm||'')}:{name:'',role:'staff',pin:'',active:true,perms:null,comm:''});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const numc=v=>Math.round(Number(String(v).replace(/[^\d.]/g,''))||0);
  const permVal=(key)=>{ if(f.perms&&f.perms[key]!=null) return !!f.perms[key]; return (ROLE_DEFAULTS[f.role]||{})[key]===1; };
  const togglePerm=(key)=>setF(x=>({...x,perms:{...(x.perms||{}),[key]:!permVal(key)}}));
  const save=()=>{ if(!f.name.trim()){toast('ใส่ชื่อพนักงาน');return;} if(!/^\d{4}$/.test(f.pin)){toast('ตั้ง PIN 4 หลัก');return;}
    if((d.staff||[]).some(s=>s.pin===f.pin&&(!st||s.id!==st.id))){toast('⚠️ PIN นี้ซ้ำกับคนอื่น');return;}
    setData(dd=>{ ensureStaff(dd); if(st){ const x=staffOf(dd,st.id); x.name=f.name.trim(); x.role=f.role; x.pin=f.pin; x.active=f.active; x.perms=f.perms||null; x.comm=numc(f.comm); if(x.role==='trainer'&&!x.trainerId)x.trainerId='tr-'+x.id.replace(/^st-/,''); }
      else { const sid='st-'+Date.now().toString(36); const ns={id:sid,name:f.name.trim(),role:f.role,pin:f.pin,active:true,onShift:false,shiftAt:null,perms:f.perms||null,comm:numc(f.comm)}; if(f.role==='trainer')ns.trainerId='tr-'+sid.replace(/^st-/,''); dd.staff.push(ns); }
      fitSyncTrainers(dd); return {...dd}; });
    toast(st?'บันทึกแล้ว':'เพิ่มพนักงานแล้ว'); onClose(); };
  const del=()=>{ if(!window.confirm('ลบพนักงานคนนี้?'))return; setData(dd=>{ dd.staff=(dd.staff||[]).filter(s=>s.id!==st.id); if(dd.currentStaffId===st.id)dd.currentStaffId='st-own'; return {...dd}; }); toast('ลบแล้ว'); onClose(); };
  return (<Sheet title={st?'แก้ไขพนักงาน':'เพิ่มพนักงาน'} tag="ตำแหน่ง + PIN เข้างาน" onClose={onClose}>
    <label className="lb" style={{marginTop:0}}>ชื่อพนักงาน</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)} placeholder="ชื่อ-นามสกุล / ชื่อเล่น"/>
    <label className="lb">ตำแหน่ง</label>
    <div className="seg">{['manager','staff','trainer'].map(r=><button key={r} className={f.role===r?'on':''} onClick={()=>setF(x=>({...x,role:r,perms:null}))}>{STAFF_ROLES[r].th}</button>)}</div>
    <div className="note gold" style={{marginTop:8}}>{f.role==='manager'?'ผู้จัดการ: เต็มสิทธิ์เหมือนเจ้าของ ยกเว้นรายงานเชิงลึก/ยอดเงินรวม (เห็นแค่สรุปวันเพื่อปิดวัน)':f.role==='trainer'?'เทรนเนอร์: เข้างาน · คลาส/PT ของตัวเอง · เช็คอิน — ชื่อ/สถานะแก้ที่นี่ที่เดียว · ค่าตัว/ความเชี่ยวชาญ/รีวิว แก้ที่หน้า “คลาส & เทรนเนอร์”':'พนักงาน: หน้าขาย + ข้อมูลสมาชิก + เช็คอิน'}</div>
    <label className="lb">สิทธิ์เข้าถึงรายหน้า (ผู้จัดการ/เจ้าของปรับให้พนักงานคนนี้ได้)</label>
    <div className="card" style={{padding:'4px 12px'}}>{PERM_PAGES.map(([key,lb])=>(<label className="row" key={key} style={{cursor:'pointer',padding:'9px 0'}}>
      <div className="b"><div className="t" style={{fontSize:13.5}}>{lb}</div></div>
      <input type="checkbox" checked={permVal(key)} onChange={()=>togglePerm(key)} style={{width:20,height:20,accentColor:'var(--grn,#1E7A46)'}}/></label>))}</div>
    <label className="lb">PIN เข้างาน (4 หลัก)</label><input className="field num" inputMode="numeric" maxLength={4} value={f.pin} onChange={e=>set('pin',e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="เช่น 2468"/>
    <label className="lb">ค่าคอมมิชชั่น (% ของยอดขายที่ปิดได้)</label><input className="field num" inputMode="numeric" value={f.comm} onChange={e=>set('comm',e.target.value)} placeholder="เช่น 5 = 5% (0 = ไม่มีคอม)"/>
    {st&&<label className="chk"><input type="checkbox" checked={f.active} onChange={e=>set('active',e.target.checked)}/> เปิดใช้งาน (ยกเลิกติ๊ก = พักงาน)</label>}
    <button className="btn pri blk" style={{marginTop:16}} onClick={save}>{st?'บันทึก':'เพิ่มพนักงาน'}</button>
    {st&&st.role!=='owner'&&<button className="btn dngh blk" style={{marginTop:8}} onClick={del}>ลบพนักงานคนนี้</button>}
  </Sheet>);
}

function OwnerPackages({d,setData,toast}){
  const [edit,setEdit]=useState(null);
  return (<div className="fade">
    <button className="btn pri blk sm" style={{marginBottom:12}} onClick={()=>setEdit('new')}>+ สร้างแพ็กเกจสมาชิก</button>
    <div className="card">{d.packages.map(p=>(<div className="row" key={p.id}>
      <div className="b" style={{cursor:'pointer'}} onClick={()=>setEdit(p)}><div className="t">{p.name} {p.pop&&<span className="pill py" style={{fontSize:9,padding:'0 5px'}}>ยอดนิยม</span>}</div><div className="s">{p.desc}</div></div>
      <div style={{textAlign:'right'}}><div className="num" style={{fontWeight:700}}>{B(p.price)}</div><div style={{fontSize:11,color:'var(--ink-3)'}}>{p.kind==='sessions'?p.sessions+' ครั้ง':p.months?p.months+' เดือน':'รายวัน'}</div></div>
      <button className="btn gh sm" style={{marginLeft:8,flex:'0 0 auto'}} onClick={()=>setEdit(p)}>แก้</button></div>))}</div>
    <div className="note gold" style={{marginTop:6}}>แพ็กที่สร้าง (รวมแพ็กโปรโมชั่น) จะโผล่ในหน้าขาย + หน้าต่ออายุ/แอปสมาชิก — ซื้อแล้วนับเข้ายอดขายอัตโนมัติ</div>
    {edit&&<PackageSheet d={d} setData={setData} toast={toast} pk={edit==='new'?null:edit} onClose={()=>setEdit(null)}/>}
  </div>);
}
function PackageSheet({d,setData,toast,pk,onClose}){
  const typeOf=(p)=>!p?'monthly':(p.kind==='sessions'?(p.course==='pt'?'pt':'course'):p.kind);
  const [f,setF]=useState(()=>pk?{type:typeOf(pk),name:pk.name,price:String(pk.price),months:String(pk.months||''),sessions:String(pk.sessions||''),hours:String(pk.hours||''),trainerId:pk.trainerId||'',includeMonthly:!!pk.includeMonthly,desc:pk.desc||'',pop:!!pk.pop,show:pk.hidden!==true,addons:pk.addons?pk.addons.map(a=>({...a})):[]}:{type:'monthly',name:'',price:'',months:'1',sessions:'10',hours:'',trainerId:(d.trainers[0]||{}).id||'',includeMonthly:false,desc:'',pop:false,show:true,addons:[]});
  const set=(k,v)=>setF(x=>({...x,[k]:v})); const num=v=>Math.round(Number(String(v).replace(/[^\d.]/g,''))||0);
  const addAddon=(pr)=>setF(x=>{ const i=x.addons.findIndex(a=>a.id===pr.id); const n=[...x.addons]; if(i>=0)n[i]={...n[i],qty:n[i].qty+1}; else n.push({id:pr.id,name:pr.name,price:pr.price,qty:1,per:0}); return {...x,addons:n}; });
  const setAddonQty=(id,q)=>setF(x=>({...x,addons:q<=0?x.addons.filter(a=>a.id!==id):x.addons.map(a=>a.id===id?{...a,qty:q}:a)}));
  const setAddonPer=(id,v)=>setF(x=>({...x,addons:x.addons.map(a=>a.id===id?{...a,per:num(v)}:a)}));
  const tr=f.trainerId?trOf(d,f.trainerId):null;
  const suggest=(f.type==='pt'&&tr&&tr.rate&&num(f.sessions))?tr.rate*num(f.sessions):0;
  const save=()=>{ if(!f.name.trim()){toast('ใส่ชื่อแพ็ก');return;} if(!num(f.price)){toast('ใส่ราคา');return;}
    const t=f.type; const kind=(t==='course'||t==='pt')?'sessions':t;
    const rec={name:f.name.trim(),price:num(f.price),kind,desc:f.desc.trim(),pop:f.pop,
      course:t==='pt'?'pt':(t==='course'?'class':''),
      months:t==='monthly'?num(f.months):t==='yearly'?num(f.months||12):(t==='pt'&&f.includeMonthly?num(f.months||1):0),
      sessions:(t==='course'||t==='pt')?num(f.sessions):0,
      hours:(t==='course'||t==='pt')?num(f.hours):0,
      trainerId:t==='pt'?f.trainerId:'',
      includeMonthly:t==='pt'?!!f.includeMonthly:false,
      hidden:!f.show,
      addons:f.addons.filter(a=>a.qty>0)};
    setData(dd=>{ if(pk){ const x=dd.packages.find(z=>z.id===pk.id); Object.assign(x,rec); } else dd.packages.push({id:'pk-'+Date.now().toString(36),...rec}); return {...dd}; });
    toast(pk?'บันทึกแล้ว':'สร้างแพ็กแล้ว'); onClose(); };
  const del=()=>{ if(!window.confirm('ลบแพ็กนี้ออก?'))return; setData(dd=>{ dd.packages=dd.packages.filter(z=>z.id!==pk.id); return {...dd}; }); toast('ลบแล้ว'); onClose(); };
  return (<Sheet title={pk?'แก้ไขแพ็กเกจ':'สร้างแพ็กเกจ / คอร์ส'} tag="เข้าหน้าขาย + ต่ออายุ ชุดเดียวกัน" onClose={onClose}>
    <label className="lb" style={{marginTop:0}}>ชื่อแพ็ก</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)} placeholder="เช่น คอร์สโยคะ 10 ครั้ง / PT โค้ชเอ 10 ครั้ง"/>
    <label className="lb">ประเภท</label>
    <div className="seg" style={{flexWrap:'wrap'}}>{[['daypass','รายวัน'],['monthly','รายเดือน'],['yearly','รายปี'],['course','คอร์สครั้ง'],['pt','คอร์สเทรนเนอร์']].map(([k,l])=><button key={k} className={f.type===k?'on':''} onClick={()=>set('type',k)}>{l}</button>)}</div>
    {f.type==='monthly'&&<><label className="lb">จำนวนเดือน</label><input className="field num" inputMode="numeric" value={f.months} onChange={e=>set('months',e.target.value)} placeholder="1"/></>}
    {f.type==='yearly'&&<><label className="lb">จำนวนเดือน (รายปี = 12)</label><input className="field num" inputMode="numeric" value={f.months} onChange={e=>set('months',e.target.value)} placeholder="12"/></>}
    {(f.type==='course'||f.type==='pt')&&<div className="grid2" style={{gridTemplateColumns:'1fr 1fr',gap:8}}>
      <div><label className="lb">จำนวนครั้ง</label><input className="field num" inputMode="numeric" value={f.sessions} onChange={e=>set('sessions',e.target.value)} placeholder="10"/></div>
      <div><label className="lb">ชั่วโมง/ครั้ง</label><input className="field num" inputMode="decimal" value={f.hours} onChange={e=>set('hours',e.target.value)} placeholder="1"/></div>
    </div>}
    {f.type==='pt'&&<>
      <label className="lb">เทรนเนอร์ (ราคาต่อคนไม่เท่ากัน)</label>
      <select className="field" value={f.trainerId} onChange={e=>set('trainerId',e.target.value)}>{d.trainers.map(t=><option key={t.id} value={t.id}>{t.name} · {t.specialty} · {B(t.rate)}/ครั้ง</option>)}</select>
      {suggest>0&&<div className="note g" style={{marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><span style={{fontSize:12.5}}>ราคาแนะนำ {tr.name} × {num(f.sessions)} ครั้ง = <b>{B(suggest)}</b></span><button className="lnk" onClick={()=>set('price',String(suggest))}>ใช้ราคานี้</button></div>}
      <label className="chk" style={{marginTop:12}}><input type="checkbox" checked={f.includeMonthly} onChange={e=>set('includeMonthly',e.target.checked)}/> รวมค่าสมาชิกรายเดือน (ต่ออายุให้ด้วย)</label>
      {f.includeMonthly&&<><label className="lb">รวมกี่เดือน</label><input className="field num" inputMode="numeric" value={f.months} onChange={e=>set('months',e.target.value)} placeholder="1"/></>}
      {!f.includeMonthly&&<div className="note gold" style={{marginTop:6,fontSize:12}}>ไม่รวมรายเดือน — ลูกค้าต้องมีสมาชิกรายเดือน/รายปีอยู่แล้ว</div>}
    </>}
    <label className="lb">อาหาร/สินค้าแถม (โควต้า) <span style={{fontWeight:500,color:'var(--ink-3)'}}>· ลูกค้ากดใช้ทีหลัง ตัดสต๊อก</span></label>
    <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:f.addons.length?8:0}}>{(d.products||[]).map(p=>(
      <button key={p.id} className="btn gh" style={{padding:'7px 10px',fontSize:12}} onClick={()=>addAddon(p)}>＋ {p.name}</button>))}</div>
    {f.addons.map(a=>(<div key={a.id} style={{borderTop:'1px solid var(--hair,#eee)',padding:'8px 0'}}>
      <div className="row" style={{alignItems:'center'}}>
        <div className="b"><div className="t" style={{fontSize:13.5}}>{a.name}</div><div className="s" style={{fontSize:11}}>{B(a.price)}/ครั้ง · โควต้ารวม {a.qty} ครั้ง</div></div>
        <div className="qty"><button onClick={()=>setAddonQty(a.id,a.qty-1)}>−</button><span style={{minWidth:26,textAlign:'center'}}>{a.qty}</span><button onClick={()=>setAddonQty(a.id,a.qty+1)}>+</button></div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:5,fontSize:12,color:'var(--ink-3)'}}>จำกัดต่อสัปดาห์<input className="field num" style={{width:60,margin:0,padding:'5px 7px',textAlign:'center'}} inputMode="numeric" value={a.per||''} onChange={e=>setAddonPer(a.id,e.target.value)} placeholder="0"/><span>ครั้ง/สัปดาห์ (0 = ไม่จำกัด)</span></div>
    </div>))}
    <label className="lb">ราคา (บาท)</label><input className="field num" inputMode="numeric" value={f.price} onChange={e=>set('price',e.target.value)} placeholder="1990"/>
    <label className="lb">รายละเอียดสั้น</label><input className="field" value={f.desc} onChange={e=>set('desc',e.target.value)} placeholder="เช่น ฟิตเนส + คลาสกรุ๊ปไม่จำกัด"/>
    <label className="chk"><input type="checkbox" checked={f.pop} onChange={e=>set('pop',e.target.checked)}/> ติดป้าย “ยอดนิยม/โปร”</label>
    <label className="chk"><input type="checkbox" checked={f.show} onChange={e=>set('show',e.target.checked)}/> โชว์หน้าสมาชิก (ปิด = ขายเฉพาะเคาน์เตอร์/ทีมขาย)</label>
    <button className="btn pri blk" style={{marginTop:16}} onClick={save}>{pk?'บันทึก':'สร้างแพ็ก'}</button>
    {pk&&<button className="btn dngh blk" style={{marginTop:8}} onClick={del}>ลบแพ็กนี้</button>}
  </Sheet>);
}

const PROMO_TARGETS=[['all','ทุกคน'],['expiring','ใกล้หมดอายุ'],['expired','หมดอายุแล้ว'],['birthday','วันเกิดเดือนนี้'],['inactive','ไม่มาเกิน 14 วัน']];
function promoMatch(d,promo,m){ const t=promo.target||'all'; if(t==='all')return true; const s=memberStatus(m).key;
  if(t==='expiring')return s==='expiring'; if(t==='expired')return s==='expired';
  if(t==='birthday'){ if(!m.birth)return false; return new Date(m.birth).getMonth()===new Date().getMonth(); }
  if(t==='inactive'){ const last=(d.checkins||[]).filter(c=>c.memberId===m.id).sort((a,b)=>b.at-a.at)[0]; return !last||(Date.now()-last.at>14*864e5); }
  return true; }
function promoAudience(d,promo){ return d.members.filter(m=>promoMatch(d,promo,m)).length; }
function OwnerPromos({d,setData,toast}){
  const [edit,setEdit]=useState(null); const promos=d.promos||[];
  const views=promos.reduce((a,p)=>a+(p.views||0),0), clicks=promos.reduce((a,p)=>a+(p.clicks||0),0); const conv=views?Math.round(clicks/views*100):0;
  const toggle=(id)=>setData(dd=>{ const p=(dd.promos||[]).find(x=>x.id===id); if(p)p.active=!p.active; return {...dd}; });
  return (<div className="fade">
    <div className="note blue" style={{marginBottom:12}}>📣 สร้างโปร → โชว์แบนเนอร์บนหน้าสมาชิก (ฟรี ไม่กินโควต้า) · นับคนเห็น/กดซื้อ = วัดผลได้</div>
    <div className="kpis"><Kpi l="โปรที่เปิดอยู่" v={promos.filter(p=>p.active).length+'/'+promos.length} tone="var(--brand-ink)"/><Kpi l="คนเห็น · กดซื้อ" v={views+' · '+clicks} tone="var(--green)" f={'conversion '+conv+'%'}/></div>
    <button className="btn pri blk sm" style={{marginBottom:12}} onClick={()=>setEdit('new')}>+ สร้างโปรโมชั่น</button>
    <div className="card">{promos.length?promos.map(p=>{ const pk=p.pkgId&&pkgOf(d,p.pkgId); const aud=promoAudience(d,p); const tg=(PROMO_TARGETS.find(x=>x[0]===p.target)||['','ทุกคน'])[1]; return (<div className="row" key={p.id}>
      <div className="ic" style={{background:'var(--brand-soft)',color:'var(--brand-ink)'}}>{p.emoji||'📣'}</div>
      <div className="b" style={{cursor:'pointer'}} onClick={()=>setEdit(p)}><div className="t">{p.title}</div><div className="s">{tg} · {aud} คน{pk?' · '+pk.name:''} · 👁 {p.views||0} · 🛒 {p.clicks||0}</div></div>
      <button className="btn gh sm" style={{flex:'0 0 auto'}} onClick={()=>toggle(p.id)}>{p.active?'🟢 เปิด':'⚪ ปิด'}</button></div>); }):<div className="empty">ยังไม่มีโปรโมชั่น</div>}</div>
    {edit&&<PromoSheet d={d} setData={setData} toast={toast} item={edit==='new'?null:edit} onClose={()=>setEdit(null)}/>}
  </div>);
}
function PromoSheet({d,setData,toast,item,onClose}){
  const EMO=['📣','🔥','🎁','💪','⭐','🏷️','🎉','❤️'];
  const [f,setF]=useState(item?{title:item.title,desc:item.desc||'',emoji:item.emoji||'📣',pkgId:item.pkgId||'',target:item.target||'all',active:item.active!==false}:{title:'',desc:'',emoji:'📣',pkgId:(d.packages[0]||{}).id||'',target:'all',active:true});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const save=()=>{ if(!f.title.trim()){toast('ใส่หัวข้อโปร');return;}
    setData(dd=>{ dd.promos=dd.promos||[]; if(item){ const p=dd.promos.find(x=>x.id===item.id); if(p)Object.assign(p,{title:f.title.trim(),desc:f.desc.trim(),emoji:f.emoji,pkgId:f.pkgId,target:f.target,active:f.active}); }
      else dd.promos.unshift({id:'pm-'+Date.now().toString(36),title:f.title.trim(),desc:f.desc.trim(),emoji:f.emoji,pkgId:f.pkgId,target:f.target,active:f.active,createdAt:Date.now(),views:0,clicks:0}); return {...dd}; });
    toast(item?'บันทึกโปรแล้ว':'สร้างโปรแล้ว'); onClose(); };
  const del=()=>{ if(!window.confirm('ลบโปรนี้?'))return; setData(dd=>{ dd.promos=(dd.promos||[]).filter(x=>x.id!==item.id); return {...dd}; }); toast('ลบแล้ว'); onClose(); };
  const aud=promoAudience(d,{target:f.target});
  return (<Sheet title={item?'แก้ไขโปรโมชั่น':'สร้างโปรโมชั่น'} tag="โชว์บนหน้าสมาชิก · ฟรี ไม่กินโควต้า" onClose={onClose}>
    <label className="lb" style={{marginTop:0}}>หัวข้อโปร</label><input className="field" value={f.title} onChange={e=>set('title',e.target.value)} placeholder="เช่น ต่ออายุวันนี้ ลด 20%"/>
    <label className="lb">รายละเอียด (ไม่บังคับ)</label><input className="field" value={f.desc} onChange={e=>set('desc',e.target.value)} placeholder="เงื่อนไข/ระยะเวลา"/>
    <label className="lb">ไอคอน</label><div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{EMO.map(e=><button key={e} className="btn gh sm" style={{...(f.emoji===e?{borderColor:'var(--brand)',background:'var(--brand-softer)'}:null),fontSize:18}} onClick={()=>set('emoji',e)}>{e}</button>)}</div>
    <label className="lb">ผูกแพ็ก (กดแล้วไปซื้อ)</label><select className="field" value={f.pkgId} onChange={e=>set('pkgId',e.target.value)}><option value="">— ไม่ผูก —</option>{d.packages.map(p=><option key={p.id} value={p.id}>{p.name} · {B(p.price)}</option>)}</select>
    <label className="lb">กลุ่มเป้าหมาย <span style={{fontWeight:500,color:'var(--ink-3)'}}>· {aud} คน</span></label>
    <div className="seg" style={{flexWrap:'wrap'}}>{PROMO_TARGETS.map(([k,l])=><button key={k} className={f.target===k?'on':''} onClick={()=>set('target',k)}>{l}</button>)}</div>
    <label className="chk" style={{marginTop:12}}><input type="checkbox" checked={f.active} onChange={e=>set('active',e.target.checked)}/> เปิดใช้ (โชว์บนหน้าสมาชิกทันที)</label>
    <button className="btn pri blk" style={{marginTop:16}} onClick={save}>{item?'บันทึก':'สร้างโปร'}</button>
    {item&&<button className="btn dngh blk" style={{marginTop:8}} onClick={del}>ลบโปรนี้</button>}
  </Sheet>);
}
const GI_WEEK=[['mon','จ'],['tue','อ'],['wed','พ'],['thu','พฤ'],['fri','ศ'],['sat','ส'],['sun','อา']];
function GiSw({on}){ return (<span style={{width:44,height:26,borderRadius:999,background:on?'var(--brand,#0E9C88)':'#D7DBE0',position:'relative',flexShrink:0,display:'inline-block',transition:'.15s'}}>
  <span style={{position:'absolute',top:3,left:on?21:3,width:20,height:20,borderRadius:999,background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.25)',transition:'.15s'}}/></span>); }
function OwnerGymInfo({d,setData,toast}){
  const g=d.gym||{};
  const EMO=['🏋️','💪','🧘','🥊','🚴','🤸','⚡','🔥','🏆','🩺'];
  const defWeek=()=>Object.fromEntries(GI_WEEK.map(([k])=>[k,{closed:false,open:'06:00',close:'22:00'}]));
  const [f,setF]=useState(()=>({ name:g.name||'', branch:g.branch||'', emoji:g.emoji||'🏋️', logo:g.logo||null, cover:g.cover||null,
    account:g.account||'', map:g.map||'', address:g.address||'', lat:g.lat||'13.7563', lng:g.lng||'100.5018',
    open:g.open||(String(g.openHour||'06:00–22:00').split('–')[0]||'06:00').trim(), close:g.close||(String(g.openHour||'06:00–22:00').split('–')[1]||'22:00').trim(),
    week:g.week||null, holidayNote:g.holidayNote||'', phone:g.phone||'',
    promptpay:g.promptpay||'', ppName:g.ppName||g.name||'', bank:g.bank||'', acct:g.acct||'', qrImg:g.qrImg||null,
    accept:{cash:true,promptpay:true,card:false,transfer:false,...(g.accept||{})} }));
  const up=(k,v)=>setF(x=>({...x,[k]:v}));
  const week=f.week||defWeek();
  const setDay=(k,patch)=>setF(x=>{ const w={...(x.week||defWeek())}; w[k]={...w[k],...patch}; return {...x,week:w}; });
  const applyAll=()=>setF(x=>{ const w={...(x.week||defWeek())}; GI_WEEK.forEach(([k])=>{ w[k]={...w[k],open:x.open,close:x.close}; }); return {...x,week:w}; });
  const tog=(k)=>setF(x=>({...x,accept:{...x.accept,[k]:!x.accept[k]}}));
  const pick=(k)=>async(e)=>{ const file=e.target.files&&e.target.files[0]; if(!file)return;
    try{ if(window.kdSlipResize){ up(k, await window.kdSlipResize(file)); return; } }catch(_){}
    const r=new FileReader(); r.onload=ev=>up(k,ev.target.result); r.readAsDataURL(file); };
  const save=()=>{ if(!f.name.trim()){ toast&&toast('ใส่ชื่อฟิตเนส'); return; }
    setData(dd=>{ dd.gym={...(dd.gym||{}), name:f.name.trim(), branch:f.branch.trim(), emoji:f.emoji, logo:f.logo, cover:f.cover,
      account:f.account.trim(), map:f.map.trim(), address:f.address.trim(), lat:f.lat, lng:f.lng,
      open:f.open, close:f.close, openHour:f.open+'–'+f.close, week:f.week||defWeek(), holidayNote:f.holidayNote,
      phone:f.phone.trim(), promptpay:f.promptpay.trim(), ppName:f.ppName.trim()||f.name.trim(), bank:f.bank.trim(), acct:f.acct.trim(), qrImg:f.qrImg, accept:f.accept }; return {...dd}; });
    toast&&toast('✅ บันทึกข้อมูลฟิตเนสแล้ว'); };
  const PAY=[['promptpay','พร้อมเพย์ QR','📱'],['cash','เงินสด','💵'],['card','บัตรเครดิต/เดบิต (EDC)','💳'],['transfer','โอนเข้าบัญชี','🏦']];
  return (<div className="fade">
    <div className="note" style={{marginBottom:13}}>ข้อมูลนี้ไปโชว์บน<b>ใบเสร็จ · แอปสมาชิก · จอคิว/ตู้สั่งเอง</b> และใช้เป็นบัญชีรับเงินของฟิตเนส</div>

    <div className="secttl">โลโก้ & ชื่อ</div>
    <label className="lb">ไอคอนฟิตเนส</label>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>{EMO.map(e=>(
      <button key={e} onClick={()=>up('emoji',e)} style={{width:44,height:44,borderRadius:13,fontSize:22,cursor:'pointer',background:f.emoji===e?'var(--brand-soft)':'#fff',border:f.emoji===e?'2.5px solid var(--brand)':'2px solid var(--hair)'}}>{e}</button>))}</div>
    <label className="lb">โลโก้ (อัปรูปจริง)</label>
    <div style={{fontSize:11,color:'var(--ink-3)',margin:'-2px 0 8px'}}>แนะนำ 512×512 px · สี่เหลี่ยมจัตุรัส</div>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
      <div style={{width:60,height:60,borderRadius:16,flex:'0 0 auto',background:'var(--brand-soft)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,overflow:'hidden',backgroundImage:f.logo?'url('+f.logo+')':'none',backgroundSize:'cover',backgroundPosition:'center'}}>{!f.logo&&f.emoji}</div>
      <label className="btn gh" style={{width:'auto',padding:'11px 14px',cursor:'pointer',margin:0}}>เลือกรูป<input type="file" accept="image/*" style={{display:'none'}} onChange={pick('logo')}/></label>
      {f.logo&&<button className="btn gh" style={{width:'auto',padding:'11px 14px'}} onClick={()=>up('logo',null)}>ลบรูป</button>}
    </div>
    <label className="lb">รูปหน้าปก (แบนเนอร์บนแอปสมาชิก)</label>
    <div style={{fontSize:11,color:'var(--ink-3)',margin:'-2px 0 8px'}}>แนะนำ 1200×675 px · แนวนอน 16:9</div>
    <div style={{marginBottom:14}}>{f.cover
      ? <div style={{position:'relative',borderRadius:14,overflow:'hidden',height:110}}><img src={f.cover} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
          <button onClick={()=>up('cover',null)} style={{position:'absolute',top:8,right:8,border:'none',background:'rgba(0,0,0,.6)',color:'#fff',borderRadius:8,padding:'5px 10px',fontSize:12,cursor:'pointer'}}>ลบ</button></div>
      : <label style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,border:'1.6px dashed var(--hair)',borderRadius:14,height:110,color:'var(--ink-3)',background:'#fff',cursor:'pointer',fontSize:13}}>📷 แตะเพื่อใส่รูปหน้าปก
          <input type="file" accept="image/*" style={{display:'none'}} onChange={pick('cover')}/></label>}</div>
    <div style={{display:'flex',gap:11}}>
      <div style={{flex:2}}><label className="lb">ชื่อฟิตเนส *</label><input className="field" value={f.name} onChange={e=>up('name',e.target.value)} placeholder="เช่น ฟิตโซน สตูดิโอ"/></div>
      <div style={{flex:1}}><label className="lb">สาขา</label><input className="field" value={f.branch} onChange={e=>up('branch',e.target.value)} placeholder="เช่น รามอินทรา"/></div>
    </div>
    <label className="lb">ชื่อนิติบุคคล / บัญชี (ออกใบเสร็จ)</label>
    <input className="field" value={f.account} onChange={e=>up('account',e.target.value)} placeholder="เช่น บจก. ฟิตโซน เวลเนส"/>

    <div className="secttl" style={{marginTop:17}}>ที่ตั้ง</div>
    {window.MapPicker
      ? <div style={{marginBottom:10}}><window.MapPicker value={{lat:+f.lat||13.7563,lng:+f.lng||100.5018}} height={150} onPick={pt=>setF(x=>({...x,lat:String(pt.lat),lng:String(pt.lng)}))}/>
          <div className="num" style={{fontSize:11.5,color:'var(--ink-3)',marginTop:4}}>📍 {f.lat}, {f.lng}</div></div>
      : <div style={{height:120,borderRadius:14,background:'linear-gradient(160deg,#E7F6EF,#DCEFE5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,marginBottom:10}}>📍</div>}
    <label className="lb">ชื่อย่าน / จุดสังเกต</label>
    <input className="field" value={f.map} onChange={e=>up('map',e.target.value)} placeholder="เช่น ในเดอะพลาซ่า ชั้น 2"/>
    <label className="lb">ที่อยู่เต็ม</label>
    <textarea className="field" rows={3} style={{resize:'none'}} value={f.address} onChange={e=>up('address',e.target.value)} placeholder="บ้านเลขที่ ถนน อาคาร/ชั้น แขวง/เขต จังหวัด รหัสไปรษณีย์"/>

    <div className="secttl" style={{marginTop:17}}>เวลาทำการ</div>
    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10}}>
      <input className="field num" type="time" style={{flex:1,marginTop:0}} value={f.open} onChange={e=>up('open',e.target.value)}/>
      <span style={{color:'var(--ink-3)',fontWeight:700}}>–</span>
      <input className="field num" type="time" style={{flex:1,marginTop:0}} value={f.close} onChange={e=>up('close',e.target.value)}/>
      <button className="btn gh" style={{width:'auto',padding:'11px 13px',whiteSpace:'nowrap'}} onClick={applyAll}>ทุกวัน</button>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:12}}>{GI_WEEK.map(([k,l])=>{ const dd=week[k]; return (
      <div key={k} style={{display:'flex',alignItems:'center',gap:9,background:'var(--bg,#F6F7F8)',borderRadius:12,padding:'9px 11px'}}>
        <span style={{width:26,fontSize:13.5,fontWeight:700,color:dd.closed?'var(--ink-3)':'var(--ink)'}}>{l}</span>
        {dd.closed
          ? <span style={{flex:1,fontSize:13,color:'var(--danger,#D64545)',fontWeight:700}}>ปิดทำการ</span>
          : <div style={{flex:1,display:'flex',gap:6,alignItems:'center'}}>
              <input className="field num" type="time" style={{padding:'7px 8px',marginTop:0}} value={dd.open} onChange={e=>setDay(k,{open:e.target.value})}/>
              <span style={{color:'var(--ink-3)'}}>–</span>
              <input className="field num" type="time" style={{padding:'7px 8px',marginTop:0}} value={dd.close} onChange={e=>setDay(k,{close:e.target.value})}/></div>}
        <button onClick={()=>setDay(k,{closed:!dd.closed})} style={{border:'none',cursor:'pointer',fontWeight:700,fontSize:12,padding:'7px 12px',borderRadius:999,flexShrink:0,background:dd.closed?'var(--brand-soft)':'#FCECE8',color:dd.closed?'var(--brand-ink)':'var(--danger,#D64545)'}}>{dd.closed?'เปิด':'หยุด'}</button>
      </div>); })}</div>
    <label className="lb">หมายเหตุวันหยุด / เทศกาล</label>
    <textarea className="field" rows={2} style={{resize:'none'}} value={f.holidayNote} onChange={e=>up('holidayNote',e.target.value)} placeholder="เช่น หยุดสงกรานต์ 13–15 เม.ย."/>
    <label className="lb">เบอร์โทรฟิตเนส</label>
    <input className="field num" value={f.phone} onChange={e=>up('phone',e.target.value)} placeholder="เช่น 02-914-7788"/>

    <div className="secttl" style={{marginTop:17}}>วิธีรับเงินจากลูกค้า</div>
    {window.KDReceivePanel&&window.KDW
      ? <window.KDReceivePanel biz={window.KDW.biz('fitness',(d.gym&&d.gym.id)||'main')} who={(d.gym&&d.gym.name)||'ฟิตเนส'} acctLabel="ฟิตเนส"/>
      : <div className="note">ยังไม่ได้โหลดกระเป๋าเงิน (kd-wallet.jsx)</div>}

    <div className="secttl" style={{marginTop:17}}>รับเงิน (เหมือนหน้าร้านค้า)</div>
    <div className="card" style={{textAlign:'center',background:'var(--brand-soft)',border:'none'}}>
      <div style={{fontSize:12,fontWeight:700,color:'var(--brand-ink)',marginBottom:8}}>ตัวอย่าง QR ที่ลูกค้าจะเห็น</div>
      <div style={{display:'inline-block',padding:12,background:'#fff',borderRadius:16}}>
        {f.qrImg?<img src={f.qrImg} style={{width:132,height:132,objectFit:'contain',display:'block'}}/>:<div style={{width:132,height:132,borderRadius:12,background:'#F1F3F5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:34}}>🔳</div>}
        <div style={{fontWeight:700,marginTop:6,fontSize:13}}>{f.ppName||f.name||'ฟิตเนสของฉัน'}</div>
        <div className="num" style={{fontSize:12,color:'var(--ink-3)'}}>{f.promptpay||'—'}</div>
      </div>
    </div>
    <label style={{display:'block',cursor:'pointer',marginBottom:6}}>
      <div className="card" style={{display:'flex',alignItems:'center',gap:12,background:f.qrImg?'var(--brand-soft)':'#fff',border:f.qrImg?'1.5px solid var(--brand)':'1.5px dashed var(--hair)'}}>
        <span style={{width:40,height:40,borderRadius:10,background:'var(--bg,#F6F7F8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,flexShrink:0}}>🔳</span>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:700}}>แนบรูป QR พร้อมเพย์ของร้าน</div>
          <div style={{fontSize:12,color:f.qrImg?'var(--brand-ink)':'var(--ink-3)',marginTop:2}}>{f.qrImg?'แนบแล้ว · ลูกค้าจะเห็นรูปนี้':'เซฟ QR จากแอปธนาคารมาแนบได้'}</div></div>
        {f.qrImg?<span onClick={e=>{e.preventDefault();up('qrImg',null);}} style={{color:'var(--danger,#D64545)',fontWeight:700,fontSize:12.5}}>ลบ</span>:<span style={{color:'var(--ink-3)',fontSize:18}}>＋</span>}
      </div>
      <input type="file" accept="image/*" style={{display:'none'}} onChange={pick('qrImg')}/>
    </label>
    <label className="lb">ชื่อบัญชี (บน QR)</label>
    <input className="field" value={f.ppName} onChange={e=>up('ppName',e.target.value)} placeholder="ชื่อที่โชว์ใต้ QR"/>
    <label className="lb">เบอร์พร้อมเพย์ / เลขบัตรประชาชน</label>
    <input className="field num" value={f.promptpay} onChange={e=>up('promptpay',e.target.value)} placeholder="08x-xxx-xxxx"/>
    <div style={{display:'flex',gap:11}}>
      <div style={{flex:1}}><label className="lb">ธนาคาร</label><input className="field" value={f.bank} onChange={e=>up('bank',e.target.value)} placeholder="เช่น กสิกรไทย"/></div>
      <div style={{flex:1}}><label className="lb">เลขบัญชี</label><input className="field num" value={f.acct} onChange={e=>up('acct',e.target.value)} placeholder="xxx-x-xxxxx-x"/></div>
    </div>
    <label className="lb">ช่องทางที่รับเงิน</label>
    <div style={{display:'flex',flexDirection:'column',gap:9,marginTop:4}}>{PAY.map(([k,l,e])=>(
      <button key={k} onClick={()=>tog(k)} className="card" style={{display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left',margin:0,background:'var(--bg,#F6F7F8)',border:'none'}}>
        <span style={{fontSize:20}}>{e}</span><span style={{flex:1,fontSize:14.5,fontWeight:600}}>{l}</span><GiSw on={!!f.accept[k]}/>
      </button>))}</div>
    <button className="btn pri blk" style={{marginTop:17}} onClick={save}>บันทึกข้อมูลฟิตเนส</button>
  </div>);
}
function OwnerMore({go,d,setData,toast}){
  const [ao,setAo]=useState(null);
  const AD=(window.FIT&&window.FIT.ADDONS)||{};
  const hasAd=(k)=>!!(window.FIT&&window.FIT.fitHasAddon&&window.FIT.fitHasAddon(d,k));
  const setAddon=(k,on)=>{ const a=AD[k]||{name:k,price:0};
    if(on&&a.price>0){ const KDW=window.KDW;
      if(!KDW){ if(toast)toast('กระเป๋าเงินยังไม่พร้อม · โหลดหน้าใหม่อีกครั้ง'); return; }
      const bizId=KDW.biz('fitness',(d.gym&&d.gym.id)||'main');
      if(!window.confirm('เปิดใช้ add-on “'+a.name+'” ฿'+a.price+'/เดือน ?\nหักจากกระเป๋าเงินร้าน (ยอดคงเหลือ '+KDW.fmt(KDW.balance(bizId))+')'))return;
      const res=KDW.charge(bizId,a.price,{who:(d.gym&&d.gym.name)||'ยิม (ฟิตเนส)',sub:'add-on ฟิตเนส '+a.name+' ฿'+a.price+'/เดือน',type:'fee'});
      if(!res.ok){ if(toast)toast(res.short>0?('ยอดกระเป๋าไม่พอ · ขาดอีก '+KDW.fmt(res.short)+' → เติมเงินที่เมนูแพ็กเกจ'):res.error); return; } }
    else if(!on){ if(!window.confirm('ปิด add-on “'+a.name+'” ?\nจอ/ฟีเจอร์นี้จะใช้ไม่ได้จนเปิดใหม่ (ไม่คืนเงินรอบที่ชำระแล้ว)'))return; }
    if(setData)setData(dd=>{ dd.addons={...(dd.addons||{}),[k]:on}; return {...dd}; });
    if(toast)toast(on?('✅ เปิดใช้ '+a.name+' แล้ว'):('ปิด '+a.name+' แล้ว')); setAo(null); };
  const groups=[
    ['สร้าง & จัดการ (แยกจากหน้าขาย)',[['stock','📦','เมนู & สินค้า','สร้าง/แก้เมนู · หมวดหมู่ · สต๊อก'],['packages','🎟️','แพ็กเกจสมาชิก','สร้าง/แก้ราคา · อายุแพ็ก · โปร'],['vouchers','🎫','Voucher & บัตรกำนัล','สร้าง/ขาย/ติดตามโค้ด']]],
    ['การตลาด (โปรโมชั่น)',[['promos','📣','โปรโมชั่น & ยิงแอด','สร้างโปร → โชว์หน้าสมาชิก · นับคนเห็น/กดซื้อ']]],
    ['พนักงาน',[['staff','🧑‍💼','ทะเบียนพนักงาน','ตำแหน่ง/PIN/เข้างาน/จับคนขาย']]],
    ['คลาส & เทรนเนอร์',[['classes','🗓️','คลาส & ตาราง','จอง/เปิดคลาสกรุ๊ป'],['pt','🏋️','เทรนเนอร์ PT','คิว/รายได้/รีวิว'],['trainplan','📋','ลูกเทรน & ตารางเทรน','โปรแกรมเทรนรายคน · นัดหมาย · ติดตามผล'],['health','🩺','ค่าร่างกาย & PAR-Q','น้ำหนัก/ไขมัน/กล้าม · กราฟความคืบหน้า · นำเข้า InBody']]],
    ['หน้าประตู & สื่อ',[['checkin','🚪','เช็คอินหน้าประตู','NFC/QR · พนักงานเช็คให้'],['kiosk','🛒','ตู้สั่งเอง (Kiosk)','ตั้งจอให้ลูกค้าสั่ง+จ่ายเอง'],['kds','👨‍🍳','จอครัว (KDS) · add-on','จอออเดอร์ในครัว/บาร์น้ำ · แท็บเล็ต · ตั๋วไหลจากหน้าขาย'],['board','📺','จอคิวหน้าร้าน','จอหันออกให้ลูกค้าดูเลขคิวเรียกรับ · เปิดบนทีวี/แท็บเล็ต'],['nfccard','🪧','ป้าย NFC เช็คอิน','ปริ้นท์การ์ดแปะสติกเกอร์']]],
    ['แพ็กเกจแพลตฟอร์ม (ค่าบริการระบบ)',[['plan','💎','แพ็กโปรแกรม & โควต้าสมาชิก','อัปเกรดตามจำนวนสมาชิก · เปิด add-on']]],
    ['ตั้งค่าระบบ',[['ginfo','🏠','ข้อมูลฟิตเนส','ชื่อร้าน · ที่อยู่ · เบอร์ · พร้อมเพย์ · เวลาเปิด-ปิด'],['newgym','🔄','ลบฟิตเนส & เริ่มสร้างใหม่','ล้างข้อมูลทั้งหมด แล้วสร้างฟิตเนสใหม่จากศูนย์']]],
  ];
  return (<div className="fade">{groups.map(([title,items])=>{ const vis=items.filter(([k])=>!d||fitCan(d,(k==='nfccard'||k==='kiosk'||k==='kds'||k==='board'||k==='plan'||k==='newgym'||k==='ginfo')?'settings':k)); if(!vis.length) return null; return (<div key={title}>
    <div className="secttl">{title}</div>
    <div style={{marginBottom:14}}>{vis.map(([k,e,t,s])=>{ const isAd=!!AD[k]; const locked=isAd&&!hasAd(k); const on=isAd&&!locked;
      return (<button key={k} className="card morecard" style={{display:'flex',alignItems:'center',gap:13,width:'100%',textAlign:'left',marginBottom:9,opacity:locked?.62:1}} onClick={()=>{ if(isAd)setAo(k); else go(k); }}>
      <div className="ic" style={{background:'var(--brand-soft)',color:'var(--brand-ink)',fontSize:19,width:42,height:42}}>{e}</div>
      <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:700}}>{t}{locked?' 🔒':''}{on?' ✅':''}</div><div style={{fontSize:12,color:locked?'var(--ink-3)':'var(--ink-3)',lineHeight:1.35}}>{locked?('add-on ฿'+(AD[k].price||0)+'/เดือน · ยังไม่เปิดใช้'):(on?('add-on เปิดใช้อยู่ · '+s):s)}</div></div><span className="go-ch">›</span></button>); })}</div>
  </div>); })}
  {ao&&AD[ao]&&(()=>{ const a=AD[ao],on=hasAd(ao); return (<Sheet title={a.name} onClose={()=>setAo(null)}>
    <div className="card" style={{textAlign:'center'}}><div style={{fontSize:44}}>{a.icon}</div>
      <div style={{fontSize:17,fontWeight:800,marginTop:4}}>{a.name}</div>
      <div style={{fontSize:13,color:'var(--ink-3)',marginTop:3}}>฿{a.price}/เดือน · เปิด/ปิดได้เอง</div>
      <div className={'note '+(on?'':'gold')} style={{marginTop:11,textAlign:'left'}}>{on?'✅ เปิดใช้อยู่ — เปิดจอ/ฟีเจอร์นี้ได้ทันที':'🔒 ยังไม่เปิดใช้ — เปิดแล้วคิดค่าบริการรายเดือนรวมกับแพ็กแพลตฟอร์ม (ชำระแล้วไม่คืนเงิน/ไม่ทอนวัน)'}</div></div>
    <div style={{display:'grid',gap:9}}>
      {on&&<button className="btn" onClick={()=>{ setAo(null); go(ao); }}>เปิดใช้งานหน้านี้ ›</button>}
      {!on&&<button className="btn" onClick={()=>setAddon(ao,true)}>เปิดใช้ add-on · ฿{a.price}/เดือน</button>}
      {on&&<button className="btn gh" onClick={()=>setAddon(ao,false)}>ปิด add-on</button>}
      <button className="btn gh" onClick={()=>setAo(null)}>ปิดหน้าต่าง</button>
    </div>
  </Sheet>); })()}
  <div style={{textAlign:'center',fontSize:11.5,color:'var(--ink-3)',padding:'8px 0 16px'}}>เวอร์ชันระบบ {(document.querySelector('meta[name="build"]')||{}).content||'dev'}</div>
  </div>);
}

/* ═══ คลาส ═══ */
/* ═══ คลาส ═══ */
const CLS_PALETTE=['#E8477B','#7A3FF2','#F0821E','#12B5A8','#2E6BE6','#D6336C','#0CA678','#7048E8','#F59F00','#1098AD'];
const clsColor=(c)=>c.color||CLS_PALETTE[[...(c.name||'')].reduce((a,ch)=>a+ch.charCodeAt(0),0)%CLS_PALETTE.length];
function clsEmoji(name){const n=(name||'').toLowerCase();
  if(/yoga|โยคะ|flow|hatha|vinyasa|ashtanga/.test(n))return '🧘';
  if(/box|มวย|มัดไท|muay/.test(n))return '🥊';
  if(/zumba|dance|แดนซ์|เต้น|party/.test(n))return '💃';
  if(/hiit|burn|เบิร์น|tabata/.test(n))return '🔥';
  if(/circuit|body ?fit|บอดี้|weight|strength/.test(n))return '🏋️';
  if(/core|abs|แกน|หน้าท้อง/.test(n))return '💪';
  if(/spin|cycle|ปั่น/.test(n))return '🚴';
  if(/run|วิ่ง|cardio|คาร์ดิโอ/.test(n))return '🏃';
  return '⭐';}
const DOW_ORDER=[1,2,3,4,5,6,0];
const DOW_SHORT={1:'จันทร์',2:'อังคาร',3:'พุธ',4:'พฤหัส',5:'ศุกร์',6:'เสาร์',0:'อาทิตย์'};
function OwnerClasses({d,setData,toast}){
  const [sel,setSel]=useState(null); const [edit,setEdit]=useState(null);
  const [view,setView]=useState(()=>{try{return localStorage.getItem('kd_fit_clsview')||'grid';}catch(e){return 'grid';}});
  const setV=(v)=>{setView(v);try{localStorage.setItem('kd_fit_clsview',v);}catch(e){}};
  const [fit,setFit]=useState(()=>{try{return localStorage.getItem('kd_fit_clsfit')==='1';}catch(e){return false;}});
  const setF=(v)=>{setFit(v);try{localStorage.setItem('kd_fit_clsfit',v?'1':'0');}catch(e){}};
  const gridRef=React.useRef(null),innerRef=React.useRef(null);
  const [zoom,setZoom]=React.useState({s:1,h:null});
  const byDay={}; d.classes.forEach(c=>{(byDay[c.day]=byDay[c.day]||[]).push(c);});
  const times=[...new Set(d.classes.map(c=>c.time))].sort();
  const cellOf=(t,dw)=>d.classes.find(c=>c.time===t&&c.day===dw);
  const posterStyle=(c)=>c.poster?{backgroundImage:`url(${c.poster})`}:{'--pc':clsColor(c)};
  React.useEffect(()=>{ if(view!=='grid')return;
    const calc=()=>{ const g=gridRef.current,i=innerRef.current; if(!g||!i)return;
      const cw=g.clientWidth, iw=i.scrollWidth;
      if(fit&&iw>cw+1){ const s=Math.max(0.4,cw/iw); setZoom({s,h:i.scrollHeight*s}); } else setZoom({s:1,h:null}); };
    let ro; try{ ro=new ResizeObserver(calc); if(gridRef.current)ro.observe(gridRef.current); }catch(e){}
    calc(); const r=requestAnimationFrame(calc); window.addEventListener('resize',calc);
    return ()=>{ if(ro)ro.disconnect(); cancelAnimationFrame(r); window.removeEventListener('resize',calc); }; },[fit,view,d.classes.length,times.length]);
  return (<div className="fade">
    <div className="seg" style={{marginBottom:12}}>
      <button className={view==='grid'?'on':''} onClick={()=>setV('grid')}>🖼️ ตารางรูปภาพ</button>
      <button className={view==='list'?'on':''} onClick={()=>setV('list')}>📋 รายการ</button>
    </div>
    <div className="note g" style={{marginBottom:12}}>{view==='grid'?'แตะการ์ดคลาสเพื่อแก้ไข/แนบรูป · แตะช่องว่างเพื่อเพิ่มคลาสในเวลานั้น · ไม่แนบรูปก็เป็นการ์ดสีสวยอัตโนมัติ':'สมาชิกจองในแอป → ชื่อเข้าคลาสทันที · แตะคลาสเพื่อจัดการผู้จอง/แก้ไข'}</div>
    <button className="btn pri blk sm" style={{marginBottom:12}} onClick={()=>setEdit('new')}>+ เพิ่มคลาส</button>
    {!d.classes.length&&<div className="empty">ยังไม่มีคลาส — แตะ “+ เพิ่มคลาส” เพื่อสร้างตาราง</div>}
    {view==='grid'&&!!d.classes.length&&(
      <div className="seg" style={{marginBottom:10}}>
        <button className={!fit?'on':''} onClick={()=>setF(false)}>↔️ เลื่อนดู</button>
        <button className={fit?'on':''} onClick={()=>setF(true)}>🔍 พอดีจอ</button>
      </div>)}
    {view==='grid'&&!!d.classes.length&&(
      <div className="pgrid" ref={gridRef} style={fit&&zoom.h?{overflowX:'hidden',height:zoom.h,marginBottom:14}:undefined}>
        <div className="pgrid-inner" ref={innerRef} style={{gridTemplateColumns:'42px repeat(7,94px)',transform:zoom.s<1?`scale(${zoom.s})`:undefined,transformOrigin:'top left'}}>
        <div className="pg-corner">เวลา</div>
        {DOW_ORDER.map(dw=><div key={dw} className="pg-dh">{DOW_SHORT[dw]}</div>)}
        {times.map(t=>(<React.Fragment key={t}>
          <div className="pg-time">{t}</div>
          {DOW_ORDER.map(dw=>{ const c=cellOf(t,dw); if(!c)return <button key={dw} className="pempty" onClick={()=>setEdit({__new:true,day:dw,time:t})}>＋</button>;
            const tr=trOf(d,c.trainerId); return (
            <button key={dw} className={'pcard'+(c.poster?' hasimg':'')} style={posterStyle(c)} onClick={()=>setSel(c.id)}>
              {c.isNew&&<span className="pnew">NEW</span>}
              {!c.poster&&<span className="pcemo">{clsEmoji(c.name)}</span>}
              <span className="pcname">{c.name}</span>
              <span className="pctr">{tr?tr.name:(c.fee?B(c.fee):'ฟรี')}</span>
            </button>); })}
        </React.Fragment>))}
      </div></div>)}
    {view==='list'&&(
    <div className="week">{DOW_ORDER.map(dw=>(byDay[dw]||[]).length?(<div key={dw} className="day"><div className="day-h">{DOW_FULL[dw]}</div>
      {byDay[dw].sort((a,b)=>a.time.localeCompare(b.time)).map(c=>{ const t=trOf(d,c.trainerId); const full=c.booked.length>=c.cap; return (
        <button key={c.id} className="cls" style={{width:'100%',textAlign:'left'}} onClick={()=>setSel(c.id)}><div className="ct">{c.time} · {c.name}{c.isNew&&<span className="pnew" style={{position:'static',marginLeft:6}}>NEW</span>}</div>
          <div className="cs">{t?t.name:'—'} · {c.dur}น. · {c.fee?B(c.fee):'ฟรี'}</div>
          <div className="cbar"><span style={{width:Math.min(100,c.booked.length/c.cap*100)+'%',background:full?'var(--red)':'var(--brand)'}}/></div>
          <div style={{fontSize:11,color:'var(--ink-3)',marginTop:4}}>{c.booked.length}/{c.cap} {full&&<b style={{color:'var(--red)'}}>เต็ม</b>}</div></button>); })}
    </div>):null)}</div>)}
    {sel&&(()=>{ const c=d.classes.find(x=>x.id===sel); const t=trOf(d,c.trainerId);
      const toggle=(mid)=>setData(dd=>{ const cc=dd.classes.find(x=>x.id===sel); cc.booked=cc.booked.includes(mid)?cc.booked.filter(x=>x!==mid):(cc.booked.length<cc.cap?[...cc.booked,mid]:cc.booked); return {...dd}; });
      const att=(mid)=>setData(dd=>{ const cc=dd.classes.find(x=>x.id===sel); cc.attended=cc.attended||[]; cc.attended=cc.attended.includes(mid)?cc.attended.filter(x=>x!==mid):[...cc.attended,mid]; return {...dd}; });
      const came=(c.attended||[]); const teachPay=(t&&t.rate)||0;
      return (<Sheet title={c.name} tag={DOW_FULL[c.day]+' '+c.time+' · '+(t?t.name:'')} onClose={()=>setSel(null)}>
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}><span className="pill pb">{c.dur} นาที</span><span className="pill pn">{c.fee?B(c.fee):'ฟรี'}</span><span className={'pill '+(c.booked.length>=c.cap?'pr':'pg')}>{c.booked.length}/{c.cap}</span></div>
        <label className="lb" style={{marginTop:0}}>ผู้จอง (แตะเพื่อเพิ่ม/ถอด)</label>
        <div className="grid2">{d.members.filter(m=>canEnter(m)).map(m=>{ const on=c.booked.includes(m.id); return <button key={m.id} className="btn gh sm" style={on?{borderColor:'var(--brand)',background:'var(--brand-softer)',color:'var(--brand-ink)'}:null} onClick={()=>toggle(m.id)}>{on?'✓ ':''}{firstName(m.name)}</button>; })}</div>
        {c.booked.length>0&&<><label className="lb">✅ เช็คชื่อเข้าเรียน (มาจริง) <span style={{fontWeight:500,color:'var(--ink-3)'}}>· ครูเช็คก่อนเริ่มคลาส</span></label>
          <div className="grid2">{c.booked.map(mid=>{ const m=mbOf(d,mid); if(!m)return null; const ok=came.includes(mid); return <button key={mid} className="btn gh sm" style={ok?{borderColor:'var(--green)',background:'#eafaf0',color:'var(--green)'}:null} onClick={()=>att(mid)}>{ok?'✓ มา · ':''}{firstName(m.name)}</button>; })}</div>
          <div className="note g" style={{marginTop:10}}>มาเรียน <b>{came.length}/{c.booked.length}</b> · ค่าสอน{t?' '+t.name:''} <b>{B(teachPay)}</b>{c.fee?(' · รายรับคลาส '+B(c.fee*came.length)):''}</div>
          <button className="btn pri blk sm" style={{marginTop:10}} onClick={()=>{ setData(dd=>{const cc=dd.classes.find(x=>x.id===sel); cc.taughtAt=todayISO(); return {...dd};}); toast('บันทึกเช็คชื่อ + ค่าสอน '+B(teachPay)); }}>ปิดคลาส · บันทึกค่าสอน {B(teachPay)}</button></>}
        <button className="btn gh blk" style={{marginTop:14}} onClick={()=>{setSel(null);setEdit(c);}}>✏️ แก้ไขคลาส (รูป/เวลา/ครู/ค่าเรียน)</button>
      </Sheet>); })()}
    {edit&&<ClassSheet d={d} setData={setData} toast={toast} item={edit==='new'?null:edit} onClose={()=>setEdit(null)}/>}
  </div>);
}

function ClassSheet({d,setData,toast,item,onClose}){
  const isNew=!item||item.__new;
  const st0=(!isNew)?item:{name:'',day:(item&&item.day)||1,time:(item&&item.time)||'18:00',dur:60,cap:12,fee:0,trainerId:'',poster:'',color:'',isNew:false};
  const [f,setF]=useState({name:st0.name,day:st0.day,time:st0.time,dur:String(st0.dur||60),cap:String(st0.cap||12),paid:(st0.fee||0)>0,fee:String(st0.fee||''),trainerId:st0.trainerId||'',poster:st0.poster||'',color:st0.color||'',isNew:!!st0.isNew,repeat:[]});
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const num=v=>Math.round(Number(String(v).replace(/[^\d.]/g,''))||0);
  const onImg=(e)=>{ const file=e.target.files&&e.target.files[0]; if(!file)return; const r=new FileReader();
    r.onload=()=>{ const img=new Image(); img.onload=()=>{ const cv=document.createElement('canvas'); const mw=900; const sc=Math.min(1,mw/img.width); cv.width=Math.round(img.width*sc); cv.height=Math.round(img.height*sc); cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height); set('poster',cv.toDataURL('image/jpeg',0.82)); }; img.src=r.result; };
    r.readAsDataURL(file); };
  const trs=(()=>{ const stf=(d.staff||[]).filter(s=>s.role==='trainer'&&s.active&&(s.trainerId||s.id)); if(stf.length) return stf.map(s=>({id:s.trainerId||s.id,name:s.name})); return (d.trainers||[]).filter(t=>t.active).map(t=>({id:t.id,name:t.name})); })();
  const addTrainer=()=>{ const nm=window.prompt('ชื่อครู/เทรนเนอร์ใหม่ (เพิ่มเข้าทะเบียนพนักงาน)'); if(!nm||!nm.trim())return; const tid='tr-'+Date.now().toString(36);
    setData(dd=>{ (dd.trainers=dd.trainers||[]).push({id:tid,name:nm.trim(),specialty:'เทรนเนอร์',rate:500,rating:5,avail:'ทุกวัน',active:true,reviews:[]});
      if(dd.staff){ let pin; do{ pin=String(1000+Math.floor(Math.random()*9000)); }while(dd.staff.some(s=>s.pin===pin)); dd.staff.push({id:'st-'+tid,name:nm.trim(),role:'trainer',pin,active:true,onShift:false,shiftAt:null,trainerId:tid}); } return {...dd}; });
    set('trainerId',tid); toast('เพิ่มครูเข้าทะเบียนแล้ว'); };
  const save=()=>{ if(!f.name.trim()){toast('ใส่ชื่อคลาส');return;} if(!f.trainerId){toast('เลือกครูผู้สอน');return;}
    const obj={name:f.name.trim(),day:Number(f.day),time:f.time,dur:num(f.dur)||60,cap:num(f.cap)||10,fee:f.paid?num(f.fee):0,trainerId:f.trainerId,poster:f.poster||'',color:f.color||'',isNew:!!f.isNew};
    let made=1;
    setData(dd=>{ dd.classes=dd.classes||[]; if(!isNew){ const c=dd.classes.find(x=>x.id===item.id); if(c)Object.assign(c,obj); } else { const days=[Number(f.day),...f.repeat.map(Number)].filter((v,i,a)=>a.indexOf(v)===i); made=days.length; days.forEach((dy,i)=>dd.classes.push({id:'cl-'+Date.now().toString(36)+'-'+dy+i,...obj,day:dy,booked:[],attended:[]})); } return {...dd}; });
    toast(isNew?(made>1?('เพิ่ม '+made+' คลาสแล้ว'):'เพิ่มคลาสแล้ว'):'บันทึกคลาสแล้ว'); onClose(); };
  const del=()=>{ if(!window.confirm('ลบคลาสนี้?'))return; setData(dd=>{ dd.classes=dd.classes.filter(x=>x.id!==item.id); return {...dd}; }); toast('ลบแล้ว'); onClose(); };
  return (<Sheet title={isNew?'เพิ่มคลาส':'แก้ไขคลาส'} tag="คลาสกลุ่ม · สมาชิกจองในแอป" onClose={onClose}>
    <label className="lb" style={{marginTop:0}}>ชื่อคลาส</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)} placeholder="เช่น Yoga Flow / Muay Thai"/>
    <label className="lb">รูปโปสเตอร์คลาส <span style={{fontWeight:500,color:'var(--ink-3)'}}>· ไม่แนบก็เป็นการ์ดสีอัตโนมัติ</span></label>
    {f.poster
      ? <div style={{position:'relative',marginBottom:2}}><img className="posthumb" src={f.poster} alt=""/><button className="btn gh sm" style={{position:'absolute',top:8,right:8,background:'rgba(255,255,255,.92)'}} onClick={()=>set('poster','')}>ลบรูป</button></div>
      : <div style={{display:'flex',gap:9,alignItems:'stretch'}}>
          <div style={{width:64,height:64,borderRadius:12,flex:'0 0 auto',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,color:'#fff',background:f.color||clsColor({name:f.name})}}>{clsEmoji(f.name)}</div>
          <label className="btn gh" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',margin:0}}>📷 แนบรูปโปสเตอร์<input type="file" accept="image/*" hidden onChange={onImg}/></label>
        </div>}
    {!f.poster&&<><label className="lb">สีการ์ด (เมื่อไม่แนบรูป)</label>
      <div className="colorrow">{['',...CLS_PALETTE].map((col,i)=>{ const c=col||clsColor({name:f.name}); const on=col===f.color; return <span key={i} className={'colordot'+(on?' on':'')} style={{background:c}} title={col?'':'อัตโนมัติ'} onClick={()=>set('color',col)}>{!col&&<span style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:15}}>🎲</span>}</span>; })}</div></>}
    <label className="lb">วัน</label>
    <div className="seg" style={{flexWrap:'wrap'}}>{[[1,'จ'],[2,'อ'],[3,'พ'],[4,'พฤ'],[5,'ศ'],[6,'ส'],[0,'อา']].map(([v,l])=><button key={v} className={Number(f.day)===v?'on':''} onClick={()=>set('day',v)}>{l}</button>)}</div>
    {isNew&&<><label className="lb">🔁 ทำซ้ำวันอื่น <span style={{fontWeight:500,color:'var(--ink-3)'}}>· สร้างคลาสเดียวกันหลายวันทีเดียว</span></label>
    <div className="seg" style={{flexWrap:'wrap'}}>{[[1,'จ'],[2,'อ'],[3,'พ'],[4,'พฤ'],[5,'ศ'],[6,'ส'],[0,'อา']].filter(([v])=>v!==Number(f.day)).map(([v,l])=>{ const on=f.repeat.includes(v); return <button key={v} className={on?'on':''} onClick={()=>setF(x=>({...x,repeat:on?x.repeat.filter(dd=>dd!==v):[...x.repeat,v]}))}>{l}</button>; })}</div></>}
    <div style={{display:'flex',gap:10}}>
      <div style={{flex:1}}><label className="lb">เวลา</label><input className="field" type="time" value={f.time} onChange={e=>set('time',e.target.value)}/></div>
      <div style={{flex:1}}><label className="lb">ระยะเวลา (นาที)</label><input className="field num" inputMode="numeric" value={f.dur} onChange={e=>set('dur',e.target.value)} placeholder="60"/></div>
    </div>
    <label className="lb">ครู / ผู้สอน <span style={{fontWeight:500,color:'var(--ink-3)'}}>· จากทะเบียนพนักงาน</span></label>
    <div style={{display:'flex',gap:8}}><select className="field" style={{flex:1}} value={f.trainerId} onChange={e=>set('trainerId',e.target.value)}><option value="">— เลือกครู —</option>{trs.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button className="btn gh sm" style={{flex:'0 0 auto'}} onClick={addTrainer}>＋ ครูใหม่</button></div>
    <div style={{display:'flex',gap:10}}>
      <div style={{flex:1}}><label className="lb">จำนวนคนรับ (ความจุ)</label><input className="field num" inputMode="numeric" value={f.cap} onChange={e=>set('cap',e.target.value)} placeholder="12"/></div>
      <div style={{flex:1}}><label className="lb">ค่าเรียน</label><div className="seg">{[['free','ฟรี'],['paid','เสียเงิน']].map(([k,l])=><button key={k} className={(f.paid?'paid':'free')===k?'on':''} onClick={()=>set('paid',k==='paid')}>{l}</button>)}</div></div>
    </div>
    {f.paid&&<><label className="lb">ราคา/คลาส (บาท)</label><input className="field num" inputMode="numeric" value={f.fee} onChange={e=>set('fee',e.target.value)} placeholder="150"/></>}
    <label className="lb" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>ป้าย “NEW CLASS” <input type="checkbox" checked={f.isNew} onChange={e=>set('isNew',e.target.checked)} style={{width:20,height:20}}/></label>
    <button className="btn pri blk" style={{marginTop:16}} onClick={save}>{isNew?'เพิ่มคลาส':'บันทึก'}</button>
    {!isNew&&<button className="btn dngh blk" style={{marginTop:8}} onClick={del}>ลบคลาสนี้</button>}
  </Sheet>);
}

/* ═══ PT ═══ */
function OwnerPT({d}){
  const [sel,setSel]=useState(null); const mon=todayISO().slice(0,7);
  const revOf=t=>d.ptBookings.filter(b=>b.trainerId===t&&b.paid).reduce((a,b)=>a+b.amount,0);
  const cntOf=t=>d.ptBookings.filter(b=>b.trainerId===t).length;
  return (<div className="fade">
    {d.trainers.map(t=>(<div className="card" key={t.id} onClick={()=>setSel(t.id)}><div style={{display:'flex',gap:12,alignItems:'center'}}>
      <div className="av" style={{background:'var(--brand)',color:'#fff',width:42,height:42,fontSize:17}}>{firstName(t.name).replace('โค้ช','')[0]||'ค'}</div>
      <div style={{flex:1}}><div style={{fontWeight:700,fontSize:15}}>{t.name}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>{t.specialty}</div></div>
      <div style={{textAlign:'right'}}><div style={{fontWeight:700,color:'var(--green)'}}>{B(revOf(t.id))}</div><div style={{fontSize:11,color:'var(--ink-3)'}}>⭐{t.rating} · {cntOf(t.id)} คิว</div></div></div></div>))}
    <div className="card"><h3>คิวจอง PT เร็ว ๆ นี้</h3>
      {[...d.ptBookings].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(b=>{ const m=mbOf(d,b.memberId),t=trOf(d,b.trainerId); return (<div className="row" key={b.id}>
        <div className="b"><div className="t">{m?m.name:'—'} → {t?t.name:'—'}</div><div className="s">{thDate(b.date)} · {b.time} · {b.kind==='package'?'เซสชันแพ็ก':B(b.amount)}</div></div>
        <span className={'pill '+(b.status==='confirmed'?'pg':'py')}>{b.status==='confirmed'?'ยืนยัน':'รอชำระ'}</span></div>); })}</div>
    {sel&&(()=>{ const t=trOf(d,sel); const qs=d.ptBookings.filter(b=>b.trainerId===sel); return (<Sheet title={t.name} tag={t.specialty} onClose={()=>setSel(null)}>
      <div className="note g" style={{marginBottom:12}}>{t.bio} · ว่าง {t.avail}</div>
      <div className="kpis"><Kpi l="เรต/เซสชัน" v={B(t.rate)}/><Kpi l="รายได้เดือนนี้" v={B(revOf(sel))} tone="var(--green)" f={qs.length+' คิว'}/></div>
      <label className="lb">คิวที่จอง</label>{qs.length?qs.map(b=>{ const m=mbOf(d,b.memberId); return <div className="row" key={b.id}><div className="b"><div className="t">{m?m.name:'—'}</div><div className="s">{thDate(b.date)} · {b.time}</div></div><span className={'pill '+(b.status==='confirmed'?'pg':'py')}>{b.status==='confirmed'?'ยืนยัน':'รอชำระ'}</span></div>; }):<div className="empty">ยังไม่มีคิว</div>}
    </Sheet>); })()}
  </div>);
}

/* ═══ สต๊อก (โมเดลเดียวกับ KaiDee POS: ซื้อเข้า/รับของ · ตัดสต๊อกอัตโนมัติเมื่อขาย · ต้นทุนเฉลี่ย · ต้องซื้อ) ═══ */
const lowOf=p=>p.low!=null?p.low:5;
function OwnerStock({d,setData,toast}){
  const [edit,setEdit]=useState(null); const [fc,setFc]=useState('all'); const [view,setView]=useState('stock'); const [buy,setBuy]=useState(false);
  const adj=(id,delta)=>setData(dd=>{ const p=dd.products.find(x=>x.id===id); if(p&&p.stock<999)p.stock=Math.max(0,p.stock+delta); return {...dd}; });
  const cats=[...new Set(d.products.map(p=>p.cat))];
  const committed={}; d.members.forEach(mm=>(mm.bundles||[]).forEach(b=>{const r=Math.max(0,(b.total||0)-(b.used||0)); if(r)committed[b.productId]=(committed[b.productId]||0)+r;}));
  const commit=(pid)=>committed[pid]||0;
  const committedTot=Object.values(committed).reduce((a,b)=>a+b,0);
  const tracked=d.products.filter(p=>p.stock<999);
  const lowItems=tracked.filter(p=>p.stock<=lowOf(p)||p.stock<commit(p.id));
  const shortTot=tracked.reduce((a,p)=>a+Math.max(0,commit(p.id)-p.stock),0);
  const stockVal=tracked.reduce((a,p)=>a+p.stock*(p.cost||0),0);
  const rows=d.products.filter(p=>fc==='all'||p.cat===fc);
  const purchases=d.purchases||[];
  const buyIn=(pp)=>setData(dd=>{ dd.purchases=dd.purchases||[]; dd.purchases.unshift({id:'fp'+Date.now(),date:pp.date,note:pp.note,hasVat:pp.hasVat,vat:pp.vat,vatBase:pp.vatBase,lines:pp.lines});
    pp.lines.forEach(l=>{ const pr=dd.products.find(x=>x.id===l.prId); if(!pr||pr.stock>=999)return; const cur=pr.stock||0,curCost=pr.cost||0,uc=l.qty?l.price/l.qty:0,ns=cur+l.qty; pr.cost=ns?Math.round(((cur*curCost)+(l.qty*uc))/ns*100)/100:uc; pr.stock=ns; }); return {...dd}; });
  return (<div className="fade">
    <div className="kpis"><Kpi l="มูลค่าสต๊อกคงเหลือ" v={B(Math.round(stockVal))} tone="var(--brand-ink)" f={tracked.length+' สินค้านับสต๊อก'}/><Kpi l="ใกล้หมด / ต้องซื้อ" v={lowItems.length} tone={lowItems.length?'var(--red)':'var(--green)'} f="ตัดสต๊อกเมื่อขาย/ใช้สิทธิ์"/><Kpi l="ผูกในแพ็ก (ค้างใช้)" v={committedTot} tone={shortTot?'var(--red)':'var(--brand-ink)'} f={shortTot?('ขาดอีก '+shortTot+' ชิ้น'):'สต๊อกพอส่ง'}/></div>
    <div style={{display:'flex',gap:8,marginBottom:12}}>
      <button className="btn pri blk sm" style={{flex:1,margin:0}} onClick={()=>setBuy({})}>🛒 ซื้อเข้า / รับของ</button>
      <button className="btn gh sm" style={{flex:'0 0 auto'}} onClick={()=>setEdit('new')}>＋ สินค้าใหม่</button>
    </div>
    <div className="seg" style={{marginBottom:12}}>{[['stock','คงเหลือ'],['buy','ต้องซื้อ'+(lowItems.length?' ('+lowItems.length+')':'')],['history','ซื้อเข้า']].map(([k,l])=><button key={k} className={view===k?'on':''} onClick={()=>setView(k)}>{l}</button>)}</div>
    {view==='stock'&&<>
      {cats.length>0&&<div style={{display:'flex',gap:7,overflowX:'auto',paddingBottom:4,marginBottom:10}}>{[['all','ทั้งหมด'],...cats.map(c=>[c,c])].map(([k,l])=><button key={k} className="btn gh sm" style={{flex:'0 0 auto',...(fc===k?{borderColor:'var(--brand)',background:'var(--brand-softer)',color:'var(--brand-ink)'}:null)}} onClick={()=>setFc(k)}>{l}</button>)}</div>}
      <div className="card">{rows.map(p=>(<div className="row" key={p.id}>
        <div className="b" style={{cursor:'pointer'}} onClick={()=>setEdit(p)}><div className="t">{p.name}</div><div className="s">{p.cat} · ขาย {B(p.price)}{p.stock<999&&p.cost?' · ทุน '+B(p.cost):''} · ขายแล้ว {p.sold}</div>{commit(p.id)>0&&<div className="s" style={{color:p.stock<commit(p.id)?'var(--red)':'var(--brand-ink)',fontWeight:600}}>🎟️ ผูกในแพ็ก {commit(p.id)}{p.stock<commit(p.id)?' · ต้องซื้ออีก '+(commit(p.id)-p.stock):' · พอส่ง'}</div>}</div>
        {p.stock>=999?<span className="pill pb">ชงสด</span>:<div className="qty"><button onClick={()=>adj(p.id,-1)}>−</button><span className={'pill '+(p.stock<=Math.ceil(lowOf(p)/2)?'pr':p.stock<=lowOf(p)?'py':'pg')} style={{minWidth:34,justifyContent:'center'}}>{p.stock}</span><button onClick={()=>adj(p.id,1)}>+</button></div>}
        <button className="btn gh sm" style={{marginLeft:8,flex:'0 0 auto'}} onClick={()=>setEdit(p)}>แก้</button></div>))}
        {!rows.length&&<div className="empty">ยังไม่มีสินค้าในหมวดนี้</div>}</div>
    </>}
    {view==='buy'&&<FitShopList lowItems={lowItems} commit={commit} onBuy={pre=>{setBuy({pre});}}/>}
    {view==='history'&&<div className="card">{purchases.length?purchases.map(pc=>{ const tot=pc.lines.reduce((a,l)=>a+(Number(l.price)||0),0); return (<div className="row" key={pc.id} style={{alignItems:'flex-start'}}>
      <div className="ic" style={{background:'var(--brand-soft)',color:'var(--brand-ink)'}}>🛒</div>
      <div className="b"><div className="t">{thDate(pc.date)}{pc.note?' · '+pc.note:''}{pc.hasVat?'  🧾':''}</div><div className="s">{pc.lines.map(l=>{const pr=d.products.find(x=>x.id===l.prId);return (pr?pr.name:'—')+' ×'+nf(l.qty);}).join(' · ')}</div></div>
      <div className="val">{B(tot)}</div></div>); }):<div className="empty">ยังไม่มีประวัติซื้อเข้า</div>}</div>}
    {edit&&<FitItemSheet d={d} setData={setData} toast={toast} item={edit==='new'?null:edit} onClose={()=>setEdit(null)}/>}
    {buy&&<FitBuySheet d={d} toast={toast} pre={buy.pre} onSave={pp=>{buyIn(pp);setBuy(false);setView('history');toast('บันทึกเข้าสต๊อกแล้ว');}} onClose={()=>setBuy(false)}/>}
  </div>);
}
function FitShopList({lowItems,onBuy,commit}){
  const [sel,setSel]=useState(()=>new Set(lowItems.map(p=>p.id)));
  const toggle=id=>setSel(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  if(!lowItems.length) return (<div className="empty" style={{padding:'40px 16px'}}>✓ สต๊อกเพียงพอ — ยังไม่มีสินค้าที่ต้องซื้อเพิ่ม</div>);
  const chosen=lowItems.filter(p=>sel.has(p.id));
  const ck=on=>({width:24,height:24,borderRadius:7,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,border:'2px solid '+(on?'var(--brand)':'var(--hair-2,#dfe4e2)'),background:on?'var(--brand)':'#fff',color:'#fff'});
  return (<>
    <div className="note gold" style={{marginBottom:10}}>{lowItems.length} รายการใกล้หมด · ติ๊กของที่จะซื้อ แล้วสร้างบิลซื้อเข้า</div>
    <div className="card">{lowItems.map(p=>{ const on=sel.has(p.id); const cm=commit?commit(p.id):0; const target=Math.max(lowOf(p)*2-p.stock,lowOf(p),cm-p.stock+lowOf(p)); return (<div className="row" key={p.id} onClick={()=>toggle(p.id)} style={{cursor:'pointer'}}>
      <span style={ck(on)}>{on?'✓':''}</span>
      <div className="b"><div className="t">{p.name}</div><div className="s">เหลือ {p.stock}{cm>0?' · ผูกในแพ็ก '+cm:''} · แนะนำเติม ~{target}</div></div>
      <span className="pill pr">ใกล้หมด</span></div>); })}</div>
    <button className="btn pri blk" disabled={!chosen.length} style={{opacity:chosen.length?1:.5}} onClick={()=>chosen.length&&onBuy(chosen.map(p=>({prId:p.id})))}>🛒 สร้างบิลซื้อเข้า ({chosen.length})</button>
  </>);
}
function FitBuySheet({d,toast,pre,onSave,onClose}){
  const buyable=d.products.filter(p=>p.stock<999);
  const cats=[...new Set(buyable.map(p=>p.cat))];
  const [date,setDate]=useState(todayISO());
  const [note,setNote]=useState('');
  const [pVat,setPVat]=useState(false);
  const num=v=>Number(String(v).replace(/[^\d.]/g,''))||0;
  const [lines,setLines]=useState(()=> (pre&&pre.length)?pre.map(x=>({prId:x.prId,qty:'',price:'',pack:false,packs:''})):[{prId:buyable[0]?buyable[0].id:'',qty:'',price:'',pack:false,packs:''}]);
  const effQty=l=>(l.pack?num(l.packs):1)*num(l.qty);
  const setLine=(i,k,v)=>setLines(prev=>prev.map((l,j)=>j===i?{...l,[k]:v}:l));
  const addLine=()=>setLines(prev=>[...prev,{prId:buyable[0]?buyable[0].id:'',qty:'',price:'',pack:false,packs:''}]);
  const delLine=i=>setLines(prev=>prev.filter((_,j)=>j!==i));
  const total=lines.reduce((a,l)=>a+num(l.price),0);
  const vBase=pVat?total/1.07:total, vAmt=pVat?total-vBase:0;
  const valid=lines.some(l=>l.prId&&effQty(l)>0);
  const prOf=id=>d.products.find(x=>x.id===id);
  const save=()=>{ if(!valid){toast('เลือกสินค้าและจำนวน');return;}
    onSave({date,note,hasVat:pVat,vat:pVat?+vAmt.toFixed(2):0,vatBase:+vBase.toFixed(2),lines:lines.filter(l=>l.prId&&effQty(l)>0).map(l=>({prId:l.prId,qty:effQty(l),price:num(l.price)}))}); };
  return (<Sheet title="ซื้อเข้า / รับของ" tag="เพิ่มสต๊อก + คำนวณต้นทุนเฉลี่ย (แบบ KaiDee POS)" onClose={onClose}>
    {!buyable.length&&<div className="note gold">ยังไม่มีสินค้าที่นับสต๊อก — เพิ่มสินค้า (ไม่ติ๊ก “ชงสด”) ก่อนซื้อเข้า</div>}
    <div style={{display:'flex',gap:10}}>
      <div style={{flex:1}}><label className="lb" style={{marginTop:0}}>วันที่ซื้อ</label><input className="field" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
      <div style={{flex:1.3}}><label className="lb" style={{marginTop:0}}>ร้าน/หมายเหตุ</label><input className="field" value={note} onChange={e=>setNote(e.target.value)} placeholder="เช่น แม็คโคร"/></div>
    </div>
    <label className="lb">รายการที่ซื้อ</label>
    {lines.map((l,i)=>{ const eq=effQty(l),uc=eq&&num(l.price)?num(l.price)/eq:0; return (<div key={i} style={{background:'var(--bg,#F5F7F6)',borderRadius:12,padding:11,marginBottom:9}}>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
        <select className="field" style={{flex:1,margin:0}} value={l.prId} onChange={e=>setLine(i,'prId',e.target.value)}>
          {cats.map(c=><optgroup key={c} label={c}>{buyable.filter(x=>x.cat===c).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}
        </select>
        {lines.length>1&&<button className="btn gh sm" style={{flex:'0 0 auto'}} onClick={()=>delLine(i)}>✕</button>}
      </div>
      <div style={{display:'flex',gap:6,marginBottom:8}}>
        {[['ต่อชิ้น',false],['เป็นลัง/แพ็ก',true]].map(([lb,v])=><button key={lb} className="btn gh sm" style={{...(l.pack===v?{borderColor:'var(--brand)',background:'var(--brand-softer)',color:'var(--brand-ink)'}:null)}} onClick={()=>setLine(i,'pack',v)}>{lb}</button>)}
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        {l.pack&&<><input className="field num" style={{width:56,margin:0,textAlign:'center'}} inputMode="numeric" value={l.packs} onChange={e=>setLine(i,'packs',e.target.value)} placeholder="ลัง"/><span style={{color:'var(--ink-3)'}}>×</span></>}
        <input className="field num" style={{width:64,margin:0,textAlign:'center'}} inputMode="numeric" value={l.qty} onChange={e=>setLine(i,'qty',e.target.value)} placeholder={l.pack?'ต่อลัง':'จำนวน'}/>
        <span style={{color:'var(--ink-3)',fontSize:13}}>ชิ้น · รวม</span>
        <input className="field num" style={{flex:1,minWidth:70,margin:0}} inputMode="numeric" value={l.price} onChange={e=>setLine(i,'price',e.target.value)} placeholder="฿"/>
      </div>
      {eq>0&&uc>0&&<div style={{marginTop:6,fontSize:12,color:'var(--ink-3)'}}>= ทุน {B(Math.round(uc*100)/100)}/ชิ้น · เข้าสต๊อก +{nf(eq)} ชิ้น{l.pack?' ('+nf(num(l.packs))+'×'+nf(num(l.qty))+')':''}</div>}
    </div>); })}
    <button className="btn gh blk sm" onClick={addLine}>＋ เพิ่มรายการ</button>
    <label className="chk" style={{marginTop:12}}><input type="checkbox" checked={pVat} onChange={e=>setPVat(e.target.checked)}/> มีใบกำกับภาษี (VAT ซื้อ 7%) — นับเป็นภาษีซื้อ</label>
    {pVat&&<div className="note g" style={{marginTop:4}}>มูลค่าก่อน VAT {B(Math.round(vBase))} · VAT {B(Math.round(vAmt))}</div>}
    <div className="total-row" style={{marginTop:14}}><span>รวมจ่ายทั้งบิล</span><span className="tv num">{B(total)}</span></div>
    <button className="btn pri blk" style={{marginTop:12}} onClick={save} disabled={!valid}>บันทึกเข้าสต๊อก</button>
  </Sheet>);
}
function FitItemSheet({d,setData,toast,item,onClose}){
  const cats=[...new Set(d.products.map(p=>p.cat))];
  const [f,setF]=useState(()=>item?{name:item.name,cat:item.cat,price:String(item.price),stock:item.stock>=999?'':String(item.stock),brew:item.stock>=999,cost:item.cost?String(item.cost):'',low:item.low!=null?String(item.low):''}:{name:'',cat:cats[0]||'',price:'',stock:'',brew:false,cost:'',low:''});
  const [nc,setNc]=useState(!cats.length); const [ncv,setNcv]=useState('');
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const num=(v)=>Math.round(Number(String(v).replace(/[^\d.]/g,''))||0);
  const numf=(v)=>Number(String(v).replace(/[^\d.]/g,''))||0;
  const save=()=>{ if(!f.name.trim()){toast('ใส่ชื่อสินค้า');return;} const cat=(nc?ncv.trim():f.cat)||'อื่นๆ'; if(!num(f.price)){toast('ใส่ราคาขาย');return;}
    setData(dd=>{ if(item){ const p=dd.products.find(x=>x.id===item.id); if(p){p.name=f.name.trim();p.cat=cat;p.price=num(f.price);p.stock=f.brew?999:num(f.stock);p.cost=f.brew?0:numf(f.cost);p.low=f.brew?undefined:num(f.low);} }
      else dd.products.push({id:'pr-'+Date.now().toString(36),name:f.name.trim(),cat,price:num(f.price),stock:f.brew?999:num(f.stock),sold:0,cost:f.brew?0:numf(f.cost),low:f.brew?undefined:num(f.low)}); return {...dd}; });
    toast(item?'บันทึกแล้ว':'เพิ่มสินค้าแล้ว'); onClose(); };
  const del=()=>{ if(!window.confirm('ลบสินค้านี้ออกจากเมนู?'))return; setData(dd=>{ dd.products=dd.products.filter(x=>x.id!==item.id); return {...dd}; }); toast('ลบแล้ว'); onClose(); };
  return (<Sheet title={item?'แก้ไขสินค้า':'เพิ่มสินค้า / เมนู'} tag="เข้าหน้าขายชุดข้อมูลเดียวกัน" onClose={onClose}>
    <label className="lb" style={{marginTop:0}}>ชื่อสินค้า / เมนู</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)} placeholder="เช่น อเมริกาโน่ (ร้อน/เย็น)"/>
    <label className="lb">หมวดหมู่</label>
    {!nc?<div style={{display:'flex',gap:8}}><select className="field" style={{flex:1}} value={f.cat} onChange={e=>set('cat',e.target.value)}>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select><button className="btn gh sm" style={{flex:'0 0 auto'}} onClick={()=>setNc(true)}>＋ หมวดใหม่</button></div>
      :<div style={{display:'flex',gap:8}}><input className="field" style={{flex:1}} value={ncv} onChange={e=>setNcv(e.target.value)} placeholder="ชื่อหมวดใหม่ เช่น เบเกอรี่"/>{cats.length>0&&<button className="btn gh sm" style={{flex:'0 0 auto'}} onClick={()=>{setNc(false);setNcv('');}}>ยกเลิก</button>}</div>}
    <label className="lb">ราคาขาย (บาท)</label><input className="field num" inputMode="numeric" value={f.price} onChange={e=>set('price',e.target.value)} placeholder="60"/>
    <label className="chk"><input type="checkbox" checked={f.brew} onChange={e=>set('brew',e.target.checked)}/> ชงสด / ไม่จำกัดสต๊อก (ไม่ตัดสต๊อก)</label>
    {!f.brew&&<><label className="lb">จำนวนคงเหลือ (สต๊อก)</label><input className="field num" inputMode="numeric" value={f.stock} onChange={e=>set('stock',e.target.value)} placeholder="0"/>
      <div style={{display:'flex',gap:10}}>
        <div style={{flex:1}}><label className="lb">ต้นทุน/ชิ้น (บาท)</label><input className="field num" inputMode="decimal" value={f.cost} onChange={e=>set('cost',e.target.value)} placeholder="0"/></div>
        <div style={{flex:1}}><label className="lb">จุดสั่งซื้อ (ใกล้หมด)</label><input className="field num" inputMode="numeric" value={f.low} onChange={e=>set('low',e.target.value)} placeholder="5"/></div>
      </div>
      <div className="note g" style={{marginTop:4}}>ต้นทุนจะอัปเดตอัตโนมัติแบบเฉลี่ยถ่วงน้ำหนักทุกครั้งที่ “ซื้อเข้า”</div></>}
    <button className="btn pri blk" style={{marginTop:16}} onClick={save}>{item?'บันทึก':'เพิ่มสินค้า'}</button>
    {item&&<button className="btn dngh blk" style={{marginTop:8}} onClick={del}>ลบสินค้านี้</button>}
  </Sheet>);
}

/* ═══ รายงานสรุป ═══ */
function OwnerReport({d,setData,toast}){
  const [range,setRange]=useState('mon'); const [pm,setPm]=useState(false); const a=analytics(d); const now=Date.now();
  if(pm) return (<div className="fade"><button className="btn gh" style={{marginBottom:12,padding:'10px 18px',fontSize:15}} onClick={()=>setPm(false)}>‹ กลับรายงาน</button><window.OwnerPayMatch d={d} setData={setData} toast={toast}/></div>);
  const cut = range==='mon'?now-30*864e5:range==='week'?now-7*864e5:0;
  const ren=(d.renewals||[]).filter(x=>x.at>=cut); const renew=ren.filter(x=>x.kind==='renew').reduce((s,b)=>s+b.amount,0); const shop=ren.filter(x=>x.kind==='shop').reduce((s,b)=>s+b.amount,0);
  const cls=ren.filter(x=>x.kind==='class').reduce((s,b)=>s+b.amount,0);
  const ptInCut=b=>b.paid&&!b.voided&&(cut===0||(b.at?b.at>=cut:new Date((b.date||todayISO())+'T00:00:00').getTime()>=cut));
  const pt=(d.ptBookings||[]).filter(ptInCut).reduce((s,b)=>s+b.amount,0); const total=renew+shop+cls+pt;
  const redeemCogs=ren.filter(r=>r.redeem).reduce((s,b)=>s+(b.value||0),0);
  const voidable=ren.filter(r=>(r.kind==='shop'||r.kind==='renew')&&!r.discount&&!r.redeem&&!r.voided&&!r.voidOf&&(r.amount||0)>0).sort((a,b)=>b.at-a.at).slice(0,14);
  const ptVoidable=(d.ptBookings||[]).filter(b=>b.paid&&!b.voided&&(cut===0||(b.at?b.at>=cut:true))).sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,12);
  const doVoid=(r)=>{ const isR=r.kind==='renew'; if(!confirm(isR?'ยกเลิกบิลต่ออายนี้? ระบบจะถอยวันหมดอายุ+เซสชัน PT กลับ+กลับเงิน':'ยกเลิกบิลนี้? ระบบจะคืนสต๊อก+กลับเงินให้'))return; setData(dd=>{ fitVoidShop(dd,r.id,(staffOf(dd,dd.currentStaffId)||{}).name); return {...dd}; }); toast('ยกเลิกบิลแล้ว'); };
  const doVoidPt=(b)=>{ if(!confirm('ยกเลิก PT นี้? คืนเซสชัน (ถ้าใช้โควต้า) + ถอนเงินออกจากรายได้'))return; setData(dd=>{ fitVoidPt(dd,b.id,(staffOf(dd,dd.currentStaffId)||{}).name); return {...dd}; }); toast('ยกเลิก PT แล้ว'); };
  const newMem=d.members.filter(m=>m.joinedAt&&new Date(m.joinedAt+'T00:00:00').getTime()>=cut).length;
  const topProd=[...d.products].sort((x,y)=>y.sold-x.sold).slice(0,5); const pmax=Math.max(1,...topProd.map(p=>p.sold));
  const exportCsv=()=>csv('fitness-report.csv',[['หมวด','ยอด'],['ต่ออายุ',renew],['ขายของ',shop],['ค่าคลาส',cls],['PT',pt],['รวม',total],['มูลค่าโควต้าที่ใช้',redeemCogs],['สมาชิกใหม่',newMem],['ยอดค้างต่ออายุ',a.dueVal],['churn %',a.churn]]);
  return (<div className="fade">
    <div className="seg" style={{marginBottom:12}}>{[['week','7 วัน'],['mon','30 วัน'],['all','ทั้งหมด']].map(([k,l])=><button key={k} className={range===k?'on':''} onClick={()=>setRange(k)}>{l}</button>)}</div>
    <button className="card" style={{display:'flex',alignItems:'center',gap:13,width:'100%',textAlign:'left'}} onClick={()=>setPm(true)}>
      <div className="ic" style={{background:'var(--brand-soft)',color:'var(--brand-ink)',fontSize:19,width:42,height:42}}>🤖</div>
      <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700}}>จับยอดพร้อมเพย์</div><div style={{fontSize:12,color:'var(--ink-3)'}}>ยืนยันเงินเข้าอัตโนมัติ</div></div><span style={{color:'var(--ink-3)',fontSize:18}}>›</span></button>
    <div className="kpis"><Kpi l="รายได้รวม" v={B(total)} tone="var(--green)"/><Kpi l="สมาชิกใหม่" v={newMem} tone="var(--brand-ink)"/>
      <Kpi l="ยอดค้างต่ออายุ" v={B(a.dueVal)} tone="var(--gold)"/><Kpi l="Churn" v={a.churn+'%'} tone={a.churn>25?'var(--red)':'var(--ink)'}/></div>
    <div className="card"><h3>รายได้แยกช่องทาง</h3>
      {[['ต่ออายุแพ็ก',renew],['ขายสินค้า',shop],['ค่าคลาส',cls],['PT',pt]].map(([k,v])=>{ const mx=Math.max(1,renew,shop,cls,pt); return (<div className="bar" key={k}><span className="bl">{k}</span><span className="bt"><span className="bf" style={{width:v/mx*100+'%'}}/></span><span className="bv">{B(v)}</span></div>); })}</div>
    <div className="card"><h3>สินค้าขายดี</h3>{topProd.map(p=>(<div className="bar" key={p.id}><span className="bl">{p.name}</span><span className="bt"><span className="bf" style={{width:p.sold/pmax*100+'%'}}/></span><span className="bv">{p.sold}</span></div>))}</div>
    <div className="card"><h3>เทรนเนอร์ทำเงินสูงสุด (PT เดือนนี้)</h3>{a.trRev.filter(r=>r.v).length?a.trRev.filter(r=>r.v).map((r,i)=>{ const mx=Math.max(1,...a.trRev.map(x=>x.v)); return (<div className="bar" key={i}><span className="bl">{r.k}</span><span className="bt"><span className="bf" style={{width:r.v/mx*100+'%'}}/></span><span className="bv">{B(r.v)}</span></div>); }):<div className="empty">ยังไม่มี</div>}</div>
    {redeemCogs>0&&<div className="note gold" style={{marginBottom:12}}>🎁 มูลค่าของที่แจกจากโควต้าในช่วงนี้ <b>{B(redeemCogs)}</b> — ตัดสต๊อกแล้ว ไม่นับเป็นเงินรับ (จ่ายตอนซื้อแพ็กแล้ว)</div>}
    {fitCan(d,'void')&&<div className="card"><h3>ยกเลิก/คืนบิล <span className="lnk">ขายสินค้า+ต่ออาย</span></h3>
      {voidable.length?voidable.map(r=>{ const isR=r.kind==='renew'; const pr=(d.products||[]).find(x=>x.id===r.productId); const pk=r.packageId&&pkgOf(d,r.packageId); const m=r.memberId&&mbOf(d,r.memberId); return (<div className="row" key={r.id} style={{alignItems:'center'}}>
        <div className="b"><div className="t">{isR?(pk?pk.name:'ต่ออาย'):(pr?pr.name:'สินค้า')}</div><div className="s">{isR?'🔁 ต่ออาย':'🛒 ขายสินค้า'} · {thTime(r.at)}{m?' · '+m.name:''} · {r.via==='counter'?'เงินสด':'พร้อมเพย์'}</div></div>
        <div className="val">{B(r.amount)}</div>
        <button className="btn gh sm" style={{flex:'0 0 auto',marginLeft:8,color:'var(--red)'}} onClick={()=>doVoid(r)}>✕ ยกเลิก</button></div>); })
      :<div className="empty">ไม่มีบิลขายในช่วงนี้</div>}</div>}
    {fitCan(d,'void')&&ptVoidable.length>0&&<div className="card"><h3>ยกเลิก/คืน <span className="lnk">PT / เทรนเนอร์</span></h3>
      {ptVoidable.map(b=>{ const tr=trOf(d,b.trainerId); const m=b.memberId&&mbOf(d,b.memberId); const usePkg=b.kind==='package'; return (<div className="row" key={b.id} style={{alignItems:'center'}}>
        <div className="b"><div className="t">PT{tr?' · '+tr.name:''}</div><div className="s">🏋️ {usePkg?'ใช้โควต้า':'จ่ายสด'} · {b.at?thTime(b.at):(b.date||'')}{m?' · '+m.name:''}</div></div>
        <div className="val">{usePkg?'โควต้า':B(b.amount)}</div>
        <button className="btn gh sm" style={{flex:'0 0 auto',marginLeft:8,color:'var(--red)'}} onClick={()=>doVoidPt(b)}>✕ ยกเลิก</button></div>); })}</div>}
    <button className="btn gh blk" onClick={exportCsv}>⬇ ส่งออก CSV</button>
  </div>);
}

/* ═══ เปิด/ปิดวัน + สรุปปิดวัน ═══ */
function DayClosedGate({d,setData,toast,what}){
  const openDay=()=>{ setData(dd=>{ dd.fitDay={open:true,openedAt:Date.now()}; return {...dd}; }); toast('เปิดวันแล้ว'); };
  const last=(d.dayCloses||[]).slice(-1)[0];
  return (<div className="fade" style={{textAlign:'center',padding:'34px 8px'}}>
    <div style={{fontSize:46,marginBottom:6}}>🔒</div>
    <div style={{fontSize:19,fontWeight:800,color:'var(--ink)'}}>ปิดวันอยู่</div>
    <div style={{fontSize:13.5,color:'var(--ink-3)',margin:'8px 20px 0',lineHeight:1.55}}>{what||'ขาย เช็คอิน และต่ออายุ'} ถูกล็อกไว้ — เปิดวันก่อนจึงจะเริ่มทำรายการได้ (กันบันทึกยอดข้ามวัน)</div>
    {last&&<div className="note gold" style={{margin:'16px 16px 0',textAlign:'left'}}>ปิดวันล่าสุด {thDate?thDate(last.date):last.date} · รับจริง {B(last.total)}</div>}
    <button className="btn pri blk" style={{margin:'20px 16px 0',maxWidth:320}} onClick={openDay}>🔓 เปิดวัน · เริ่มทำงาน</button>
  </div>);
}
function OwnerDayClose({d,setData,toast}){
  const day=d.fitDay||{open:true,openedAt:null};
  const isToday=ts=>new Date(ts).toDateString()===new Date().toDateString();
  const renR=(d.renewals||[]).filter(r=>isToday(r.at));
  const ptToday=(d.ptBookings||[]).filter(b=>b.paid&&b.at&&isToday(b.at)).map(b=>({amount:b.amount,via:b.via||'counter',verified:b.verified!==false,kind:'pt',at:b.at}));
  const ren=[...renR,...ptToday];
  const cash=ren.filter(r=>r.via==='counter').reduce((a,b)=>a+b.amount,0);
  const ppOk=ren.filter(r=>(r.via==='app'||r.via==='kiosk')&&r.verified).reduce((a,b)=>a+b.amount,0);
  const ppPend=ren.filter(r=>(r.via==='app'||r.via==='kiosk')&&!r.verified).reduce((a,b)=>a+b.amount,0);
  const byKind=k=>ren.filter(r=>r.kind===k).reduce((a,b)=>a+b.amount,0);
  const redeemCogs=renR.filter(r=>r.redeem).reduce((a,b)=>a+(b.value||0),0);
  const ckToday=(d.checkins||[]).filter(c=>isToday(c.at)); const ckOk=ckToday.filter(c=>c.result==='ok').length;
  const newMem=(d.members||[]).filter(m=>m.joinedAt&&isToday(new Date(m.joinedAt+'T12:00:00'))).length;
  const total=cash+ppOk; const grand=total+ppPend;
  const lastClose=(d.dayCloses||[]).slice(-1)[0];
  const openDay=()=>{ setData(dd=>{ dd.fitDay={open:true,openedAt:Date.now()}; return {...dd}; }); toast('เปิดวันแล้ว'); };
  const closeDay=()=>{ if(ppPend>0&&!confirm('ยังมียอดรอยืนยัน '+B(ppPend)+' — ปิดวันเลยไหม?'))return;
    setData(dd=>{ dd.dayCloses=dd.dayCloses||[]; dd.dayCloses.push({at:Date.now(),date:todayISO(),cash,ppOk,ppPend,total,pt:byKind('pt'),cls:byKind('class'),redeemCogs,txn:ren.length,checkins:ckOk,newMem}); dd.fitDay={open:false,openedAt:(dd.fitDay||{}).openedAt||null,closedAt:Date.now()}; return {...dd}; }); toast('ปิดวัน + บันทึกสรุปแล้ว'); };
  return (<div className="fade">
    <div className={'note '+(day.open?'g':'gold')} style={{marginBottom:12}}>{day.open?('🔓 เปิดวันอยู่'+(day.openedAt?(' · ตั้งแต่ '+thTime(day.openedAt)):'')):'🔒 ปิดวันแล้ว — เปิดวันใหม่เพื่อเริ่มรับเงิน'}</div>
    <div className="kpis"><Kpi l="รับจริงวันนี้" v={B(total)} tone="var(--green)" f={'เงินสด '+B(cash)+' · พร้อมเพย์ '+B(ppOk)}/><Kpi l="รอยืนยัน" v={B(ppPend)} tone={ppPend?'var(--gold)':'var(--ink-3)'} f={ren.length+' บิลวันนี้'}/></div>
    <div className="card"><h3>สรุปยอดวันนี้</h3>
      <div className="row"><div className="b"><div className="t">ต่ออายุ/แพ็กสมาชิก</div></div><div className="val">{B(byKind('renew'))}</div></div>
      <div className="row"><div className="b"><div className="t">ขายสินค้า</div></div><div className="val">{B(byKind('shop'))}</div></div>
      <div className="row"><div className="b"><div className="t">PT / เทรนเนอร์</div></div><div className="val">{B(byKind('pt'))}</div></div>
      {byKind('class')>0&&<div className="row"><div className="b"><div className="t">ค่าคลาส</div></div><div className="val">{B(byKind('class'))}</div></div>}
      <div className="row"><div className="b"><div className="t">เงินสด (เคาน์เตอร์)</div></div><div className="val">{B(cash)}</div></div>
      <div className="row"><div className="b"><div className="t">พร้อมเพย์ (ยืนยันแล้ว)</div></div><div className="val" style={{color:'var(--green)'}}>{B(ppOk)}</div></div>
      {ppPend>0&&<div className="row"><div className="b"><div className="t">พร้อมเพย์ (รอยืนยัน)</div></div><div className="val" style={{color:'var(--gold)'}}>{B(ppPend)}</div></div>}
      <div className="total-row"><span>รับจริงรวม</span><span className="tv num">{B(total)}</span></div>
      {redeemCogs>0&&<div className="row" style={{marginTop:4}}><div className="b"><div className="t">มูลค่าของที่แจกจากโควต้า</div><div className="s">ฟรี · ตัดสต๊อกแล้ว ไม่ใช่เงินรับ</div></div><div className="val" style={{color:'var(--ink-3)'}}>{B(redeemCogs)}</div></div>}
    </div>
    <div className="card"><h3>กิจกรรมวันนี้</h3>
      <div className="row"><div className="b"><div className="t">เช็คอินเข้า</div></div><div className="val">{ckOk} ครั้ง</div></div>
      <div className="row"><div className="b"><div className="t">สมาชิกใหม่</div></div><div className="val">{newMem} คน</div></div>
      <div className="row"><div className="b"><div className="t">จำนวนบิล</div></div><div className="val">{ren.length} บิล</div></div>
    </div>
    {day.open
      ? <button className="btn pri blk" onClick={closeDay}>🔒 ปิดวัน + บันทึกสรุป</button>
      : <button className="btn pri blk" onClick={openDay}>🔓 เปิดวันใหม่</button>}
    {lastClose&&<div className="card" style={{marginTop:12}}><h3>ปิดวันล่าสุด</h3>
      <div className="row"><div className="b"><div className="t">{thDate(lastClose.date)}</div><div className="s">{thTime(lastClose.at)} · {lastClose.txn} บิล · เช็คอิน {lastClose.checkins}</div></div><div className="val">{B(lastClose.total)}</div></div></div>}
  </div>);
}

/* ═══ จับยอดพร้อมเพย์ (บอท) ═══ */
function OwnerPayMatch({d,setData,toast}){
  const [text,setText]=useState('');
  const isTd=ts=>ts&&new Date(ts).toDateString()===new Date().toDateString();
  const rens=(d.renewals||[]).filter(r=>['app','kiosk'].includes(r.via)&&isTd(r.at)).map(r=>({...r,__t:'ren'}));
  const pts=(d.ptBookings||[]).filter(b=>b.via==='app'&&!b.voided&&isTd(b.at)&&(b.amount||0)>0).map(b=>({...b,__t:'pt'}));
  const today=[...rens,...pts].sort((a,b)=>b.at-a.at);
  const totalIn=today.reduce((a,r)=>a+r.amount,0); const gotN=today.filter(r=>r.verified).length; const gotSum=today.filter(r=>r.verified).reduce((a,r)=>a+r.amount,0);
  const parseAmts=(t)=>{ const out=[]; const re=/(\d[\d,]*\.?\d*)/g; let m; String(t).split('\n').forEach(line=>{ while((m=re.exec(line))){ const v=parseFloat(m[1].replace(/,/g,'')); if(v>=10&&!/\d{2}:\d{2}/.test(m[1]))out.push(v); } }); return out; };
  const setV=(item,val)=>setData(dd=>{
    if(item.__t==='pt'){ const b=(dd.ptBookings||[]).find(x=>x.id===item.id); if(b){ b.verified=val; b.paid=val; b.status=val?'confirmed':'pending'; b.verifiedAt=val?Date.now():null; } }
    else { const r=dd.renewals.find(x=>x.id===item.id); if(r){ r.verified=val; r.verifiedAt=val?Date.now():null; } }
    return {...dd}; });
  const autoMatch=()=>{ const amts=parseAmts(text); let hit=0;
    setData(dd=>{ dd.renewals.filter(r=>r.via==='app'&&isTd(r.at)).forEach(r=>{ if(r.verified)return; const i=amts.indexOf(r.amount); if(i>=0){ r.verified=true; r.verifiedAt=Date.now(); amts.splice(i,1); hit++; } });
      (dd.ptBookings||[]).filter(b=>b.via==='app'&&!b.voided&&isTd(b.at)&&(b.amount||0)>0).forEach(b=>{ if(b.verified)return; const i=amts.indexOf(b.amount); if(i>=0){ b.verified=true; b.paid=true; b.status='confirmed'; b.verifiedAt=Date.now(); amts.splice(i,1); hit++; } }); return {...dd}; });
    setTimeout(()=>toast(hit?('บอทจับคู่ '+hit+' บิล'):'ไม่พบยอดที่ตรง'),0); };
  return (<div className="fade">
    <div className="note blue" style={{marginBottom:12}}>🤖 สมาชิกจ่ายผ่าน PromptPay → วางข้อความแจ้งเงินเข้า (SMS/LINE ธนาคาร) → บอทจับคู่ยอด+ยืนยันอัตโนมัติ (บันทึกถาวร) · <b>ของจริงต่อ LINE/bank-alert ผ่าน worker แล้วจับให้เองแบบเรียลไทม์</b></div>
    <div className="kpis"><Kpi l="ยอดเข้าวันนี้ (แอป)" v={B(totalIn)} tone="var(--brand-ink)" f={today.length+' รายการ'}/><Kpi l="ยืนยันแล้ว" v={gotN+'/'+today.length} tone={gotN===today.length&&today.length?'var(--green)':'var(--gold)'} f={'รับจริง '+B(gotSum)}/></div>
    <div className="card"><h3>วางข้อความแจ้งเงินเข้า</h3>
      <textarea className="field" rows={4} style={{fontSize:13}} placeholder={'เช่น\n14:05 เงินเข้า 1,990.00 บาท\n14:22 รับโอน 6,900.00'} value={text} onChange={e=>setText(e.target.value)}/>
      <button className="btn pri blk" style={{marginTop:10}} onClick={autoMatch}>🤖 จับคู่ยอดอัตโนมัติ</button>
      <div className="note g" style={{marginTop:10,display:'flex',alignItems:'center',gap:10,justifyContent:'space-between'}}><span>เชื่อม LINE ธนาคารให้บอทจับให้เอง (ไม่ต้องวางเอง)</span><button className="btn gh sm" onClick={()=>toast('เดโม: ของจริงจับคู่บอทผ่าน worker /bank-alert')}>เชื่อม LINE</button></div></div>
    <div className="card"><h3>รายการจ่ายผ่านแอปวันนี้ <span className="lnk">แตะเพื่อยืนยัน/ยกเลิก</span></h3>
      {today.length?today.map(r=>{ const m=mbOf(d,r.memberId); const isPt=r.__t==='pt'; const tr=isPt&&trOf(d,r.trainerId); const pk=r.packageId&&pkgOf(d,r.packageId); const ok=r.verified;
        const label=isPt?('PT'+(tr?' · '+tr.name:'')):(pk?pk.name:(r.kind==='shop'?'ขายสินค้า':r.kind==='class'?'ค่าคลาส':'ต่ออายุ'));
        return (<div className="row" key={r.id} onClick={()=>setV(r,!ok)}>
        <div className="ic" style={{background:ok?'var(--green-soft)':'#EEF1F0',color:ok?'var(--green)':'var(--ink-3)'}}>{ok?'✓':(isPt?'🏋️':'฿')}</div>
        <div className="b"><div className="t">{m?m.name:'ลูกค้าทั่วไป'}</div><div className="s">{label} · {thTime(r.at)}</div></div>
        <div style={{textAlign:'right'}}><div className="val">{B(r.amount)}</div>{ok?<span className="pill pg">ยืนยันแล้ว</span>:<span className="pill py">รอเงิน</span>}</div></div>); })
      :<div className="empty">ยังไม่มียอดจ่ายผ่านแอปวันนี้</div>}</div>
  </div>);
}

/* ═══ ทีมขาย · วิเคราะห์พฤติกรรม + ทำแพคเสนอขายรายคน ═══ */
function memberSignals(d,m){
  const ck=(d.checkins||[]).filter(c=>c.memberId===m.id&&c.result!=='denied');
  const cl=(d.classes||[]).filter(c=>(c.booked||[]).includes(m.id)).length;
  const rc=(d.renewals||[]).filter(r=>r.kind==='renew'&&r.memberId===m.id).length;
  const lastCk=ck.length?Math.max(...ck.map(c=>c.at)):null;
  const tenure=m.joinedAt?Math.max(0,Math.round((Date.now()-new Date(m.joinedAt+'T00:00:00').getTime())/864e5)):0;
  return {ck:ck.length, cl, rc, lastCk, tenure, spend:m.spend||0, ptLeft:m.ptLeft||0};
}
const SALE_SEGS={
  winback:{ic:'🔁',t:'ดึงกลับ · หมดอายุแล้ว',tone:'#D6336C'},
  renew:{ic:'⏰',t:'ปิดต่ออายุ · ใกล้หมด',tone:'#F0821E'},
  upgrade:{ic:'⤴️',t:'อัปเกรดรายปี',tone:'var(--brand-ink)'},
  convert:{ic:'🎫',t:'Day Pass → รายเดือน',tone:'#2E6BE6'},
  pt:{ic:'🏋️',t:'ขายคอร์ส PT',tone:'#7048E8'},
  class:{ic:'🗓️',t:'แฟนคลาส → รายปี',tone:'#12B5A8'},
  vip:{ic:'⭐',t:'VIP ใช้จ่ายสูง',tone:'#F59F00'},
};
function salesPitch(d){
  const P=d.packages||[];
  const yearly=P.find(p=>p.kind==='yearly');
  const monthly=P.find(p=>p.kind==='monthly'&&p.months===1)||P.find(p=>p.kind==='monthly');
  const ptPack=P.find(p=>p.kind==='sessions');
  const spends=d.members.map(m=>m.spend||0).sort((a,b)=>b-a);
  const vipCut=spends.length?spends[Math.max(0,Math.floor(spends.length*0.25)-1)]:Infinity;
  const leads=[];
  d.members.forEach(m=>{
    const s=memberStatus(m); const sig=memberSignals(d,m); const pk=pkgOf(d,m.packageId); const kind=pk&&pk.kind;
    let seg=null,pkg=null,why='';
    if(s.key==='expired'&&s.d!=null&&s.d>=-30){ seg='winback'; pkg=pk||monthly; why='หมดอายุ '+Math.abs(s.d)+' วัน — ดึงกลับก่อนหลุดถาวร'; }
    else if(s.key==='expiring'){ const up=kind==='monthly'&&sig.rc>=1&&yearly; seg='renew'; pkg=up?yearly:(pk||monthly); why='เหลือ '+s.d+' วัน — ปิดต่ออายุ'+(up?' + ชวนอัปรายปี':''); }
    else if(kind==='daypass'&&monthly){ seg='convert'; pkg=monthly; why='ใช้ Day Pass '+(sig.ck||1)+' ครั้ง — เปลี่ยนเป็นรายเดือนคุ้มกว่า'; }
    else if(kind==='monthly'&&(sig.rc>=2||sig.tenure>90)&&yearly){ seg='upgrade'; pkg=yearly; const save=Math.max(0,(monthly?monthly.price*12:0)-yearly.price); why='ต่อรายเดือนต่อเนื่อง — อัปรายปีประหยัด ~'+B(save); }
    else if(sig.ptLeft>0&&sig.ptLeft<=2&&ptPack){ seg='pt'; pkg=ptPack; why='PT เหลือ '+sig.ptLeft+' ครั้ง — เติมคอร์สก่อนหมด'; }
    else if(sig.ptLeft===0&&sig.ck>=3&&ptPack){ seg='pt'; pkg=ptPack; why='มาสม่ำเสมอ '+sig.ck+' ครั้ง ยังไม่มี PT — เสนอคอร์สเทรน'; }
    else if(sig.cl>=2&&kind!=='yearly'&&yearly){ seg='class'; pkg=yearly; why='เข้าคลาส '+sig.cl+' คลาส — มาบ่อย เสนอรายปี'; }
    else if(sig.spend>=vipCut&&kind!=='yearly'&&(yearly||pk)){ seg='vip'; pkg=yearly||pk; why='ใช้จ่ายสูง '+B(sig.spend)+' — ลูกค้าตัวจริง เสนอแพ็กพรีเมียม'; }
    if(seg&&pkg) leads.push({m,s,sig,pk,seg,pkg,why});
  });
  return {leads,yearly,monthly,ptPack};
}
/* ── โควต้าสินค้าในแพ็ก (bundle) — เพิ่มตอนซื้อ · ใช้/สแกนตัดสต๊อกทีหลัง ── */
function fitAddBundles(dd,memberId,items,offerId){ const mm=mbOf(dd,memberId); if(!mm)return; mm.bundles=mm.bundles||[];
  const addOne=(pid,name,price,qty,per)=>{ if(!pid||qty<=0)return; let b=mm.bundles.find(x=>x.productId===pid&&(x.used||0)<(x.total||0)); if(b){b.total+=qty; if(per)b.per=per;} else mm.bundles.push({id:'bd-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),productId:pid,name,price,total:qty,used:0,per:per||0,log:[],from:todayISO(),offerId:offerId||null}); };
  (items||[]).forEach(it=>{
    if(it.kind==='product'&&it.qty>0) addOne(it.id,it.name,it.price,it.qty,it.per||0);
    else if(it.kind==='pkg'){ const p=pkgOf(dd,it.id); if(p&&p.addons&&p.addons.length) p.addons.forEach(a=>{ const pr=dd.products.find(x=>x.id===a.id); addOne(a.id,a.name||(pr&&pr.name)||'สินค้า',a.price!=null?a.price:(pr&&pr.price)||0,(a.qty||1)*(it.qty||1),a.per||0); }); }
  }); }
function fitRedeem(dd,memberId,bundleId,via){ const mm=mbOf(dd,memberId); if(!mm||!mm.bundles)return 'empty'; const b=mm.bundles.find(x=>x.id===bundleId); if(!b||(b.used||0)>=b.total)return 'empty';
  if(b.per>0){ const wk=7*864e5; const cut=Date.now()-wk; const usedThisWk=(b.log||[]).filter(t=>t>cut).length; if(usedThisWk>=b.per)return 'limit'; }
  b.used=(b.used||0)+1; b.log=b.log||[]; b.log.push(Date.now());
  const pr=dd.products.find(x=>x.id===b.productId); if(pr){ if(pr.stock<999)pr.stock=Math.max(0,pr.stock-1); pr.sold=(pr.sold||0)+1; deductRecipe(dd,pr,1); }
  dd.renewals=dd.renewals||[]; dd.renewals.push({id:'rd-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),memberId,productId:b.productId,amount:0,value:b.price,kind:'shop',redeem:true,via:via||'app',at:Date.now(),verified:true});
  dd.orders=dd.orders||[]; dd.orders.unshift({id:'od-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),memberId,memberName:mm.name,items:[{productId:b.productId,name:b.name,qty:1}],amount:0,value:b.price,kind:'redeem',via:via||'app',status:'new',at:Date.now()});
  return 'ok'; }
// ยกเลิก/คืนบิล (void) — ขายสินค้า: คืนสต๊อก+วัตถุดิบ · ต่ออาย: ถอยวันหมดอายุ+เซสชัน PT · ทั้งคู่ push บิลลบ
function fitVoidShop(dd,rid,op){ const r=(dd.renewals||[]).find(x=>x.id===rid); if(!r||r.voided)return; r.voided=true; r.voidAt=Date.now();
  if(r.productId){ const pr=dd.products.find(x=>x.id===r.productId); if(pr){ if(pr.stock<999)pr.stock=(pr.stock||0)+1; pr.sold=Math.max(0,(pr.sold||0)-1); deductRecipe(dd,pr,-1); } }
  if(r.voucherCode){ const vv=(dd.vouchers||[]).find(x=>x.code===r.voucherCode); if(vv){ vv.status='void'; vv.voidAt=Date.now(); const def=(dd.voucherDefs||[]).find(x=>x.id===vv.defId); if(def)def.issued=Math.max(0,(def.issued||0)-1); } }
  const mm=r.memberId&&mbOf(dd,r.memberId); if(mm){ if(r.kind==='renew'&&r.packageId){ const p=pkgOf(dd,r.packageId); if(p){ if(p.months&&mm.expiry)mm.expiry=isoAdd(mm.expiry,-p.months*30); if(p.kind==='sessions')mm.ptLeft=Math.max(0,(mm.ptLeft||0)-(p.sessions||0)); } } mm.spend=Math.max(0,(mm.spend||0)-(r.amount||0)); }
  dd.renewals.push({id:'vo-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),memberId:r.memberId||'',productId:r.productId||null,packageId:r.packageId||null,amount:-(r.amount||0),kind:r.kind||'shop',via:r.via,verified:r.verified,at:Date.now(),voidOf:rid,staffBy:op}); }
// ยกเลิก/คืน PT booking — คืนเซสชันถ้าใช้โควต้า + ถอนเงินออกจากรายได้
function fitVoidPt(dd,bid,op){ const b=(dd.ptBookings||[]).find(x=>x.id===bid); if(!b||b.voided)return; b.voided=true; b.voidAt=Date.now(); b.status='void';
  const mm=b.memberId&&mbOf(dd,b.memberId); if(mm){ if(b.kind==='package')mm.ptLeft=(mm.ptLeft||0)+1; if(b.paid)mm.spend=Math.max(0,(mm.spend||0)-(b.amount||0)); }
  b.paid=false; b.voidStaffBy=op; }
function OwnerSales({d,setData,toast}){
  const {leads,yearly,monthly}=salesPitch(d);
  const [view,setView]=useState('leads');
  const [mid,setMid]=useState(null);
  const [items,setItems]=useState([]);
  const [disc,setDisc]=useState({type:'none',val:''});
  const [sendOpen,setSendOpen]=useState(false);
  const [tMode,setTMode]=useState('this');
  const [tSel,setTSel]=useState(()=>new Set());
  const [deadline,setDeadline]=useState('');
  const [banner,setBanner]=useState('');
  const [mkPkg,setMkPkg]=useState(false);
  const [mq,setMq]=useState('');
  const mon=todayISO().slice(0,7);
  const wonMo=(d.offers||[]).filter(o=>o.status==='won'&&new Date(o.at).toISOString().slice(0,7)===mon);
  const potential=leads.reduce((a,l)=>a+((l.pkg&&l.pkg.price)||0),0);
  const bySeg={}; leads.forEach(l=>{ (bySeg[l.seg]=bySeg[l.seg]||[]).push(l); });
  const drinks=(d.products||[]).filter(p=>/กาแฟ|เครื่องดื่ม|ชง/.test(p.cat||''));
  const openBuild=(memberId,pkg)=>{ setMid(memberId); setItems(pkg?[{kind:'pkg',id:pkg.id,name:pkg.name,price:pkg.price,qty:1}]:[]); setDisc({type:'none',val:''}); setView('build'); };
  const addItem=(kind,o)=>setItems(list=>{ const i=list.findIndex(x=>x.kind===kind&&x.id===o.id); if(i>=0){ const n=[...list]; n[i]={...n[i],qty:n[i].qty+1}; return n; } return [...list,{kind,id:o.id,name:o.name,price:o.price,qty:1}]; });
  const setQty=(idx,q)=>setItems(list=> q<=0?list.filter((_,i)=>i!==idx):list.map((x,i)=>i===idx?{...x,qty:q}:x));
  const sub=items.reduce((a,it)=>a+it.price*it.qty,0);
  const discAmt=disc.type==='pct'?Math.round(sub*(Number(disc.val)||0)/100):disc.type==='baht'?Math.min(sub,Number(disc.val)||0):0;
  const total=Math.max(0,sub-discAmt);
  const mem=mid?mbOf(d,mid):null;
  const lead=mid?leads.find(l=>l.m.id===mid):null;
  const buildRows=d.members.filter(m=>!mq||(m.name+m.code+(m.phone||'')).toLowerCase().includes(mq.toLowerCase()));
  const applyItemsTo=(dd,its,dv,op)=>{ const mm=mbOf(dd,mid); if(!mm)return; const now=Date.now(); const R=()=>Math.random().toString(36).slice(2,6);
    its.forEach(it=>{ for(let q=0;q<it.qty;q++){
      if(it.kind==='pkg'){ const p=pkgOf(dd,it.id); if(!p)continue; const from=(mm.expiry&&daysTo(mm.expiry)>0)?mm.expiry:todayISO(); mm.packageId=it.id; if(p.months)mm.expiry=isoAdd(from,p.months*30); if(p.kind==='sessions')mm.ptLeft=(mm.ptLeft||0)+(p.sessions||0); mm.frozen=false; mm.spend=(mm.spend||0)+(p.price||0);
        dd.renewals.push({id:'rv-'+now+R(),memberId:mid,packageId:it.id,at:now,amount:p.price,via:'counter',kind:'renew',verified:true,staffBy:op}); }
      else { mm.spend=(mm.spend||0)+it.price;
        dd.renewals.push({id:'sv-'+now+R(),memberId:mid,productId:it.id,amount:it.price,via:'counter',kind:'shop',prepaid:true,at:now,verified:true,staffBy:op}); }
    }});
    fitAddBundles(dd,mid,its);
    if(dv>0) dd.renewals.push({id:'vd-'+now+R(),memberId:mid,amount:-dv,kind:'shop',discount:true,via:'counter',at:now,verified:true,staffBy:op});
  };
  const saveOffer=(status)=>{ if(!mid||!items.length){ toast('เลือกลูกค้า + ใส่รายการก่อน'); return; }
    setData(dd=>{ const op=(staffOf(dd,dd.currentStaffId)||{}).name; if(status==='won') applyItemsTo(dd,items,discAmt,op);
      (dd.offers=dd.offers||[]).unshift({id:'of-'+Date.now(),memberId:mid,items,discType:disc.type,discVal:Number(disc.val)||0,total,status,at:Date.now(),staffBy:op}); return {...dd}; });
    toast(status==='won'?('✅ ปิดการขาย '+B(total)+' · '+firstName(mem.name)):'💾 บันทึกข้อเสนอแล้ว'); setItems([]); setMid(null); setView(status==='won'?'offers':'offers'); };
  const closeSavedOffer=(of)=>{ setData(dd=>{ const op=(staffOf(dd,dd.currentStaffId)||{}).name; const o=(dd.offers||[]).find(x=>x.id===of.id); if(o&&o.status!=='won'){ const savedMid=mid; }
      const mm=mbOf(dd,of.memberId); if(mm){ const now=Date.now(); const R=()=>Math.random().toString(36).slice(2,6);
        of.items.forEach(it=>{ for(let q=0;q<it.qty;q++){ if(it.kind==='pkg'){ const p=pkgOf(dd,it.id); if(!p)continue; const from=(mm.expiry&&daysTo(mm.expiry)>0)?mm.expiry:todayISO(); mm.packageId=it.id; if(p.months)mm.expiry=isoAdd(from,p.months*30); if(p.kind==='sessions')mm.ptLeft=(mm.ptLeft||0)+(p.sessions||0); mm.frozen=false; mm.spend=(mm.spend||0)+(p.price||0); dd.renewals.push({id:'rv-'+now+R(),memberId:of.memberId,packageId:it.id,at:now,amount:p.price,via:'counter',kind:'renew',verified:true,staffBy:op}); } else { mm.spend=(mm.spend||0)+it.price; dd.renewals.push({id:'sv-'+now+R(),memberId:of.memberId,productId:it.id,amount:it.price,via:'counter',kind:'shop',prepaid:true,at:now,verified:true,staffBy:op}); } }});
        fitAddBundles(dd,of.memberId,of.items,of.id);
        const dv=of.discType==='pct'?Math.round(of.items.reduce((a,it)=>a+it.price*it.qty,0)*of.discVal/100):of.discType==='baht'?of.discVal:0; if(dv>0) dd.renewals.push({id:'vd-'+now+R(),memberId:of.memberId,amount:-dv,kind:'shop',discount:true,via:'counter',at:now,verified:true,staffBy:op}); }
      const o2=(dd.offers||[]).find(x=>x.id===of.id); if(o2)o2.status='won'; return {...dd}; });
    toast('✅ ปิดการขายแล้ว'); };
  const delOffer=(id)=>setData(dd=>{ dd.offers=(dd.offers||[]).filter(o=>o.id!==id); return {...dd}; });
  const itemSummary=items.map(it=>it.name+(it.qty>1?'×'+it.qty:'')).join(' + ');
  const lineMsg=()=>{ const nm=mem?firstName(mem.name):''; const g=(d.gym&&d.gym.name)||'ฟิตเนส';
    return (nm?'สวัสดีคุณ '+nm+' 🙏\n':'')+'['+g+'] ข้อเสนอพิเศษสำหรับคุณ\n'+items.map(it=>'• '+it.name+(it.qty>1?' ×'+it.qty:'')+' '+B(it.price*it.qty)).join('\n')+(discAmt>0?'\nส่วนลด −'+B(discAmt):'')+'\nราคาสุทธิ '+B(total)+'\nสนใจแจ้งกลับได้เลยครับ/ค่ะ'; };
  const sendLine=()=>{ if(!items.length){toast('ใส่รายการก่อน');return;} const msg=lineMsg();
    try{navigator.clipboard.writeText(msg);}catch(e){}
    if(navigator.share){ navigator.share({text:msg}).catch(()=>{}); toast('เปิดแชร์ LINE · คัดลอกข้อความแล้ว'); return; }
    window.open('https://line.me/R/share?text='+encodeURIComponent(msg),'_blank'); toast('เปิด LINE · คัดลอกข้อความแล้ว'); };
  const openSend=()=>{ if(!items.length){toast('ใส่รายการก่อน');return;} setTMode(mid?'this':'all'); setTSel(new Set(mid?[mid]:[])); setDeadline(''); setBanner('ข้อเสนอพิเศษ'+(mem?' สำหรับคุณ '+firstName(mem.name):'')+' · '+itemSummary+' เพียง '+B(total)); setSendOpen(true); };
  const toggleSel=(id)=>setTSel(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  const pushOffer=()=>{ const targets = tMode==='all'?'all':[...tSel]; if(tMode!=='all'&&!targets.length){toast('เลือกผู้รับก่อน');return;}
    setData(dd=>{ const op=(staffOf(dd,dd.currentStaffId)||{}).name;
      (dd.offers=dd.offers||[]).unshift({id:'of-'+Date.now(),memberId:mid||null,items,discType:disc.type,discVal:Number(disc.val)||0,total,status:'open',at:Date.now(),staffBy:op,pushed:true,targets,deadline:deadline||null,banner:banner.trim(),acceptedBy:[]}); return {...dd}; });
    toast('📲 ส่งขึ้นแอปสมาชิกแล้ว'+(tMode==='all'?' · ทั้งหมด':' · '+tSel.size+' คน')); setItems([]); setMid(null); setSendOpen(false); setView('offers'); };
  const stopPush=(id)=>setData(dd=>{ const o=(dd.offers||[]).find(x=>x.id===id); if(o)o.pushed=false; return {...dd}; });

  return (<div className="fade">
    <div className="kpis" style={{marginBottom:12}}>
      <Kpi l="ลีดพร้อมปิด" v={leads.length} f="โอกาสขายตอนนี้"/>
      <Kpi l="มูลค่าโอกาสรวม" v={B(potential)} f="ถ้าปิดได้ทั้งหมด" tone="var(--brand-ink)"/>
      <Kpi l="ปิดได้เดือนนี้" v={B(wonMo.reduce((a,o)=>a+o.total,0))} f={wonMo.length+' ดีล'} tone="#0CA678"/>
    </div>
    <div className="seg3" style={{display:'flex',gap:6,marginBottom:14}}>
      {[['leads','🎯 โอกาสขาย'],['build','🧩 ทำแพคเสนอ'],['offers','📋 ข้อเสนอ'],['team','👥 รายคน']].map(([k,l])=>(
        <button key={k} className={'btn '+(view===k?'pri':'gh')} style={{flex:1,padding:'9px 4px',fontSize:12.5}} onClick={()=>setView(k)}>{l}</button>))}
    </div>

    {view==='leads'&&<>
      {leads.length===0&&<div className="card" style={{textAlign:'center',color:'var(--ink-3)',padding:'26px 14px'}}>ยังไม่มีลีด — สมาชิกทุกคนแพ็กยังสดอยู่ 🎉</div>}
      {Object.keys(SALE_SEGS).filter(s=>bySeg[s]).map(sk=>{ const seg=SALE_SEGS[sk]; const arr=bySeg[sk]; const val=arr.reduce((a,l)=>a+((l.pkg&&l.pkg.price)||0),0);
        return (<div key={sk} className="card" style={{marginBottom:11,padding:'13px 14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:9}}>
            <div className="ic" style={{background:seg.tone,color:'#fff',width:34,height:34,fontSize:17,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center'}}>{seg.ic}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:800,fontSize:14.5}}>{seg.t}</div><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{arr.length} คน · โอกาส {B(val)}</div></div>
          </div>
          {arr.slice(0,6).map(l=>(<div key={l.m.id} style={{display:'flex',alignItems:'center',gap:9,padding:'8px 0',borderTop:'1px solid var(--hair,#eee)'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}><b style={{fontSize:13.5}}>{l.m.name}</b>{stPill(l.m)}{l.m.line&&<span style={{fontSize:11,color:'#06C755'}}>LINE</span>}</div>
              <div style={{fontSize:11.5,color:'var(--ink-3)',lineHeight:1.4}}>{l.why}</div>
            </div>
            <div style={{textAlign:'right'}}><div style={{fontSize:11,color:'var(--ink-3)'}}>เสนอ</div><div style={{fontSize:12.5,fontWeight:700}}>{l.pkg.name}</div><div style={{fontSize:12,color:'var(--brand-ink)',fontWeight:700}}>{B(l.pkg.price)}</div></div>
            <button className="btn pri" style={{padding:'8px 11px',fontSize:12.5,whiteSpace:'nowrap'}} onClick={()=>openBuild(l.m.id,l.pkg)}>ทำข้อเสนอ →</button>
          </div>))}
          {arr.length>6&&<div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:7}}>+ อีก {arr.length-6} คน</div>}
        </div>); })}
    </>}

    {view==='build'&&<>
      {!mid ? <>
        <label className="lb" style={{marginTop:0}}>เลือกลูกค้า</label>
        <input className="field" style={{marginBottom:10}} placeholder="🔍 ค้นชื่อ / รหัส / เบอร์" value={mq} onChange={e=>setMq(e.target.value)}/>
        <div className="card" style={{padding:6,maxHeight:360,overflowY:'auto'}}>
          {buildRows.map(m=>{ const pk=pkgOf(d,m.packageId); const ld=leads.find(l=>l.m.id===m.id);
            return (<div key={m.id} className="row" style={{cursor:'pointer',padding:'9px 8px',borderRadius:10}} onClick={()=>openBuild(m.id,ld?ld.pkg:null)}>
              <div className="av">{firstName(m.name)[0]}</div>
              <div className="b"><div className="t" style={{fontSize:13.5}}>{m.name} {m.line&&<span className="pill pg" style={{padding:'0 5px',fontSize:9}}>LINE</span>}</div><div className="s" style={{fontSize:11}}>{m.code} · {pk?pk.name:'ไม่มีแพ็ก'}{ld?' · 💡 '+SALE_SEGS[ld.seg].t:''}</div></div>
              {stPill(m)}<span style={{color:'var(--ink-3)',marginLeft:6,fontSize:18}}>›</span>
            </div>); })}
          {buildRows.length===0&&<div className="empty" style={{padding:'22px'}}>ไม่พบสมาชิก</div>}
        </div>
      </> : <button className="btn gh sm" style={{marginBottom:2}} onClick={()=>{setMid(null);setItems([]);setDisc({type:'none',val:''});}}>← เลือกลูกค้าคนอื่น</button>}
      {mem&&<div className="card" style={{margin:'11px 0',padding:'12px 14px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><b style={{fontSize:15}}>{mem.name}</b>{stPill(mem)}{mem.line&&<span style={{fontSize:11,color:'#06C755'}}>LINE</span>}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,fontSize:12}}>
          {[['แพ็กปัจจุบัน',(pkgOf(d,mem.packageId)||{}).name||'—'],['ใช้จ่ายสะสม',B(mem.spend||0)],['เข้ายิม',memberSignals(d,mem).ck+' ครั้ง'],['เข้าคลาส',memberSignals(d,mem).cl+' คลาส'],['PT เหลือ',(mem.ptLeft||0)+' ครั้ง'],['เป็นสมาชิกมา',memberSignals(d,mem).tenure+' วัน']].map(([k,v],i)=>(
            <div key={i}><div style={{color:'var(--ink-3)'}}>{k}</div><div style={{fontWeight:700}}>{v}</div></div>))}
        </div>
        {lead&&<div className="note" style={{marginTop:10,background:'var(--brand-soft)',color:'var(--brand-ink)',fontSize:12,borderRadius:9,padding:'8px 10px'}}>💡 {lead.why} — แนะนำเสนอ <b>{lead.pkg.name}</b>{items.some(x=>x.kind==='pkg'&&x.id===lead.pkg.id)?' (เพิ่มแล้ว)':<button className="lnk" style={{marginLeft:6}} onClick={()=>addItem('pkg',lead.pkg)}>＋ เพิ่ม</button>}</div>}
      </div>}
      {mid&&<>
        <div className="secttl">แพ็ก / คอร์ส</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:12}}>{(d.packages||[]).map(p=>(
          <button key={p.id} className="btn gh" style={{padding:'8px 11px',fontSize:12.5}} onClick={()=>addItem('pkg',p)}>＋ {p.name} · {B(p.price)}</button>))}
          <button className="btn pri" style={{padding:'8px 11px',fontSize:12.5}} onClick={()=>setMkPkg(true)}>✨ สร้างแพ็กใหม่</button></div>
        <div className="secttl">สินค้า / เครื่องดื่ม (ใส่รวมในแพ็กได้)</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:12}}>{(d.products||[]).map(p=>(
          <button key={p.id} className="btn gh" style={{padding:'8px 11px',fontSize:12.5}} onClick={()=>addItem('product',p)}>＋ {p.name} · {B(p.price)}</button>))}</div>
        <div className="card" style={{padding:'12px 14px'}}>
          <div style={{fontWeight:800,marginBottom:8}}>แพคที่จะเสนอ</div>
          {items.length===0&&<div style={{color:'var(--ink-3)',fontSize:12.5}}>ยังไม่มีรายการ — กดเพิ่มแพ็ก/สินค้าด้านบน</div>}
          {items.map((it,idx)=>(<div key={idx} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderTop:idx?'1px solid var(--hair,#eee)':'none'}}>
            <span style={{fontSize:15}}>{it.kind==='pkg'?'🎟️':'🥤'}</span>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600}}>{it.name}</div><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{B(it.price)} × {it.qty}</div></div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <button className="btn gh" style={{padding:'2px 9px',fontSize:15}} onClick={()=>setQty(idx,it.qty-1)}>−</button>
              <b style={{minWidth:16,textAlign:'center'}}>{it.qty}</b>
              <button className="btn gh" style={{padding:'2px 9px',fontSize:15}} onClick={()=>setQty(idx,it.qty+1)}>＋</button>
            </div>
            <b style={{minWidth:56,textAlign:'right'}}>{B(it.price*it.qty)}</b>
          </div>))}
          {items.length>0&&<>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:11,borderTop:'1px solid var(--hair,#eee)',paddingTop:11}}>
              <span style={{fontSize:12.5,color:'var(--ink-3)'}}>ส่วนลด</span>
              <select className="field" style={{width:90,padding:'6px 8px'}} value={disc.type} onChange={e=>setDisc({type:e.target.value,val:''})}><option value="none">ไม่ลด</option><option value="baht">฿</option><option value="pct">%</option></select>
              {disc.type!=='none'&&<input className="field" style={{width:90,padding:'6px 8px'}} type="number" value={disc.val} onChange={e=>setDisc({...disc,val:e.target.value})} placeholder={disc.type==='pct'?'%':'บาท'}/>}
              {discAmt>0&&<span style={{fontSize:12.5,color:'#D6336C'}}>−{B(discAmt)}</span>}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:11}}>
              <span style={{fontSize:13,color:'var(--ink-3)'}}>ราคาแพคสุทธิ</span><b style={{fontSize:22,color:'var(--brand-ink)'}}>{B(total)}</b>
            </div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button className="btn gh" style={{flex:1}} onClick={()=>saveOffer('open')}>💾 บันทึกข้อเสนอ</button>
              <button className="btn pri" style={{flex:1.3}} onClick={()=>saveOffer('won')}>✅ ปิดการขายเลย</button>
              <button className="btn gh" style={{flex:1}} onClick={sendLine}>📲 ส่ง LINE</button>
            </div>
            <button className="btn plum blk" style={{width:'100%',marginTop:8}} onClick={openSend}>📲 ส่งขึ้นแอปสมาชิก (เด้งป้ายข้อเสนอ)</button>
            {sendOpen&&<div className="card" style={{marginTop:10,padding:'13px 14px',border:'1.5px solid var(--brand)'}}>
              <div style={{fontWeight:800,marginBottom:9}}>📲 ส่งข้อเสนอขึ้นแอปสมาชิก</div>
              <label className="lb" style={{marginTop:0}}>ส่งถึงใคร</label>
              <div className="seg" style={{marginBottom:8}}>{[['this','เฉพาะคนนี้'],['multi','เลือกหลายคน'],['all','ทั้งหมด']].map(([k,l])=><button key={k} className={tMode===k?'on':''} disabled={k==='this'&&!mid} onClick={()=>{setTMode(k);if(k==='this'&&mid)setTSel(new Set([mid]));}}>{l}</button>)}</div>
              {tMode==='multi'&&<div style={{maxHeight:168,overflowY:'auto',border:'1px solid var(--hair,#eee)',borderRadius:10,padding:6,marginBottom:9}}>
                {d.members.map(mm=>{ const on=tSel.has(mm.id); return (<div key={mm.id} className="row" onClick={()=>toggleSel(mm.id)} style={{cursor:'pointer',padding:'6px 6px'}}>
                  <span style={{width:22,height:22,borderRadius:6,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,border:'2px solid '+(on?'var(--brand)':'var(--hair,#ccc)'),background:on?'var(--brand)':'#fff',color:'#fff'}}>{on?'✓':''}</span>
                  <div className="b" style={{marginLeft:8}}><div className="t" style={{fontSize:13.5}}>{mm.name}</div><div className="s" style={{fontSize:11}}>{mm.code}{mm.line?' · LINE':''}</div></div>{stPill(mm)}</div>); })}
              </div>}
              {tMode==='all'&&<div className="note g" style={{marginBottom:9,fontSize:12}}>เด้งป้ายข้อเสนอให้สมาชิกทุกคน ({d.members.length} คน)</div>}
              <label className="lb">ต้องสมัครก่อนวันที่ <span style={{fontWeight:500,color:'var(--ink-3)'}}>(เว้นว่าง = ไม่มีกำหนด)</span></label>
              <input className="field" type="date" value={deadline} min={todayISO()} onChange={e=>setDeadline(e.target.value)}/>
              <label className="lb">ข้อความบนป้าย (แก้ได้)</label>
              <textarea className="field" rows={2} style={{fontSize:13}} value={banner} onChange={e=>setBanner(e.target.value)} placeholder="ข้อความเชิญชวนที่จะโชว์บนแอปสมาชิก"/>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'8px 0 2px'}}><span style={{fontSize:12.5,color:'var(--ink-3)'}}>ราคาข้อเสนอ</span><b style={{fontSize:18,color:'var(--brand-ink)'}}>{B(total)}</b></div>
              <div style={{display:'flex',gap:8,marginTop:10}}>
                <button className="btn gh" style={{flex:1}} onClick={()=>setSendOpen(false)}>ยกเลิก</button>
                <button className="btn plum" style={{flex:1.4}} onClick={pushOffer}>📲 ส่งขึ้นแอปเลย</button>
              </div>
            </div>}
          </>}
        </div>
      </>}
    </>}

    {view==='offers'&&<>
      {(d.offers||[]).length===0&&<div className="card" style={{textAlign:'center',color:'var(--ink-3)',padding:'26px 14px'}}>ยังไม่มีข้อเสนอ — ไปที่ “ทำแพคเสนอ”</div>}
      {(d.offers||[]).map(o=>{ const m=mbOf(d,o.memberId)||{}; const won=o.status==='won';
        return (<div key={o.id} className="card" style={{marginBottom:9,padding:'12px 14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{flex:1,minWidth:0}}><b style={{fontSize:14}}>{o.pushed?(o.targets==='all'?'ทั้งหมด':(o.targets&&o.targets.length>1?o.targets.length+' คน':(m.name||'—'))):(m.name||'—')}</b> <span style={{fontSize:11,color:'var(--ink-3)'}}>· {o.items.reduce((a,it)=>a+it.qty,0)} รายการ · {o.staffBy||''}</span>
              <div style={{fontSize:11.5,color:'var(--ink-3)',lineHeight:1.4}}>{o.items.map(it=>it.name+(it.qty>1?'×'+it.qty:'')).join(' + ')}</div>
              {o.pushed&&<div style={{fontSize:11,color:'var(--brand-ink)',fontWeight:700,marginTop:3}}>📲 บนแอปสมาชิก{o.deadline?' · ก่อน '+thDate(o.deadline):''}{(o.acceptedBy||[]).length?' · ซื้อแล้ว '+o.acceptedBy.length:''}</div>}</div>
            <span className={'pill '+(won?'pg':'py')}>{won?'ปิดแล้ว':(o.pushed?'ส่งแล้ว':'รอปิด')}</span>
            <b>{B(o.total)}</b>
          </div>
          {!won&&<div style={{display:'flex',gap:8,marginTop:9}}>
            <button className="btn pri" style={{flex:1,padding:'8px',fontSize:13}} onClick={()=>closeSavedOffer(o)}>✅ ปิดการขาย</button>
            {o.pushed&&<button className="btn gh" style={{padding:'8px 12px',fontSize:13}} onClick={()=>stopPush(o.id)}>หยุดส่ง</button>}
            <button className="btn gh" style={{padding:'8px 12px',fontSize:13}} onClick={()=>delOffer(o.id)}>ลบ</button>
          </div>}
        </div>); })}
    </>}

    {view==='team'&&(()=>{
      const rows={};
      (d.renewals||[]).filter(r=>r.staffBy&&!r.discount&&(r.amount||0)>0).forEach(r=>{ const k=r.staffBy; (rows[k]=rows[k]||{name:k,amt:0,n:0,off:0}); rows[k].amt+=r.amount; rows[k].n++; });
      (d.offers||[]).forEach(o=>{ const k=o.staffBy||'ไม่ระบุ'; (rows[k]=rows[k]||{name:k,amt:0,n:0,off:0}); rows[k].off++; });
      const arr=Object.values(rows).sort((a,b)=>b.amt-a.amt);
      const commOf=(name)=>{ const s=(d.staff||[]).find(x=>x.name===name); return s&&s.comm?s.comm:0; };
      const medal=['🥇','🥈','🥉'];
      return (<>
        {arr.length===0&&<div className="card" style={{textAlign:'center',color:'var(--ink-3)',padding:'26px 14px'}}>ยังไม่มียอดขาย</div>}
        {arr.map((r,i)=>{ const pct=commOf(r.name); const comm=Math.round(r.amt*pct/100); return (
          <div key={r.name} className="card" style={{marginBottom:9,padding:'13px 14px'}}>
            <div style={{display:'flex',alignItems:'center',gap:9}}>
              <div style={{fontSize:20,width:26,textAlign:'center'}}>{medal[i]||'#'+(i+1)}</div>
              <div style={{flex:1,minWidth:0}}><b style={{fontSize:15}}>{r.name}</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>ปิด {r.n} ดีล · เสนอ {r.off} แพค</div></div>
              <div style={{textAlign:'right'}}><b style={{fontSize:17,color:'var(--brand-ink)'}}>{B(r.amt)}</b>{pct>0&&<div style={{fontSize:11.5,color:'#0CA678',fontWeight:700}}>คอม {pct}% = {B(comm)}</div>}</div>
            </div>
          </div>); })}
        <div className="note g" style={{marginTop:6}}>ตั้ง % ค่าคอมต่อคนได้ที่ เพิ่มเติม → ทะเบียนพนักงาน</div>
      </>);
    })()}
    {mkPkg&&<PackageSheet d={d} setData={setData} toast={toast} pk={null} onClose={()=>setMkPkg(false)}/>}
  </div>);
} 
function DemoBanner({d,setData,toast}){ if(d.demo===false) return null;
  const clear=()=>{ if(!window.confirm('ล้างข้อมูลตัวอย่างทั้งหมด แล้วเริ่มใช้จริง?\n\n• สมาชิก/บิล/แพ็ก/สินค้า/คลาส/เทรนเนอร์ ตัวอย่าง จะถูกลบ\n• การตั้งค่าร้าน + บัญชีเจ้าของ ยังอยู่\n\nกดตกลงเฉพาะเมื่อพร้อมเริ่มกรอกข้อมูลจริง'))return;
    if(!window.confirm('ยืนยันอีกครั้ง — ลบข้อมูลตัวอย่างถาวร?'))return;
    setData(dd=>{ const fresh=window.FIT.startFresh(dd); return window.ensureStaff?window.ensureStaff(fresh):fresh; }); toast&&toast('🧹 ล้างข้อมูลตัวอย่างแล้ว · เริ่มใช้จริงได้เลย'); };
  return (<div className="card" style={{background:'#FFF7E6',border:'1px solid #F3D98B',marginBottom:12}}>
    <div style={{fontWeight:800,fontSize:13.5,color:'#8A6A00'}}>🧪 ข้อมูลนี้เป็น “ตัวอย่าง”</div>
    <div style={{fontSize:12.5,color:'var(--ink-3)',margin:'5px 0 10px',lineHeight:1.5}}>ใส่ไว้ให้เห็นภาพการใช้งานแต่ละส่วน · เมื่อพร้อมเปิดร้านจริง กดล้างก่อนเริ่มกรอกข้อมูลจริง (ต้องยืนยัน 2 ครั้ง กันเผลอกด)</div>
    <button className="btn pri blk sm" onClick={clear}>🧹 ล้างข้อมูลตัวอย่าง & เริ่มใช้จริง</button></div>);
}
/* ═══ ลบฟิตเนส & สร้างใหม่จากศูนย์ ═══ */
function OwnerNewGym({d,setData,toast}){
  const [f,setF]=useState({name:'',owner:'',phone:'',promptpay:'',pin:'0000'});
  const [ack,setAck]=useState(false);
  const [code]=useState(()=>String(Math.floor(1000+Math.random()*9000)));
  const [codeIn,setCodeIn]=useState('');
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const ready=ack&&codeIn===code&&f.name.trim();
  const create=()=>{ if(!ready){ if(!f.name.trim())toast('ใส่ชื่อฟิตเนสใหม่ก่อน'); return; }
    setData(dd=>window.FIT.newGym({name:f.name.trim(),owner:f.owner.trim()||'เจ้าของร้าน',phone:f.phone.trim(),promptpay:f.promptpay.trim(),pin:(f.pin.trim()||'0000')}));
    toast('🔄 ลบร้านเดิม & สร้างฟิตเนสใหม่แล้ว'); };
  const wipeList=[['🧾','ยอดขาย · รายงาน · ประวัติปิดวันทั้งหมด'],['🎟️','แพ็กเกจ · Voucher · โปรโมชั่น'],['📦','เมนู/สินค้า · สต๊อก · วัตถุดิบ'],['👥','สมาชิก · เช็คอิน · ต่ออายุ'],['🏋️','คลาส · เทรนเนอร์ · PT · โควต้า'],['⚙️','ตั้งค่ารับเงิน · พนักงาน · แพลนแพลตฟอร์ม']];
  return (<div className="fade">
    <div style={{fontSize:19,fontWeight:800,color:'var(--red,#C0392B)',marginBottom:4}}>ลบฟิตเนส · เริ่มสร้างใหม่</div>
    <div style={{fontSize:13,color:'var(--ink-3)',lineHeight:1.55,marginBottom:12}}>จะลบข้อมูลทั้งหมดของ “{d.gym.name}” อย่างถาวร กู้คืนไม่ได้ — รวมถึง</div>
    <div className="card" style={{background:'#FFF7F5',border:'1px solid #F3C9C0',padding:'2px 14px',marginBottom:12}}>
      {wipeList.map(([ic,tx],i)=>(<div key={i} style={{display:'flex',gap:10,alignItems:'center',padding:'9px 0',borderBottom:i<wipeList.length-1?'1px solid #F3D6CE':'none',fontSize:13,color:'var(--ink)'}}><span style={{fontSize:16}}>{ic}</span><span>{tx}</span></div>))}
    </div>
    <div className="note gold" style={{marginBottom:12}}>❗ แพ็กเกจแพลตฟอร์มที่ใช้อยู่ ({fitPlan(d).th}) จะถือเป็นโมฆะทันที · ไม่มีการคืนเงินหรือทอนวันคงเหลือ — ร้านใหม่เริ่มที่แพ็กฟรี</div>
    <label style={{display:'flex',gap:9,alignItems:'flex-start',cursor:'pointer',margin:'0 2px 14px',fontSize:13,color:'var(--ink)'}}>
      <input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} style={{width:20,height:20,marginTop:1,accentColor:'var(--red,#C0392B)'}}/>
      <span>ฉันเข้าใจว่าข้อมูลทั้งหมด รวมยอดขาย จะถูกลบถาวร และแพ็กเดิมเป็นโมฆะ</span></label>
    <div style={{fontSize:12.5,fontWeight:700,color:'var(--ink-2)',marginBottom:6}}>พิมพ์รหัสยืนยันเพื่อลบ</div>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
      <div style={{fontFamily:'monospace',fontSize:22,fontWeight:800,letterSpacing:'5px',color:'var(--red,#C0392B)',background:'#FCECE8',borderRadius:10,padding:'8px 16px'}}>{code}</div>
      <input className="field" inputMode="numeric" maxLength={4} value={codeIn} onChange={e=>setCodeIn(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="ใส่รหัส" style={{flex:1,textAlign:'center',letterSpacing:'4px',fontWeight:700,margin:0}}/>
    </div>
    <div className="card"><h3>ข้อมูลฟิตเนสใหม่</h3>
      <label className="lb" style={{marginTop:0}}>ชื่อฟิตเนส *</label><input className="field" value={f.name} onChange={e=>set('name',e.target.value)} placeholder="เช่น ฟิตโซน"/>
      <label className="lb">ชื่อเจ้าของ/ผู้ดูแล</label><input className="field" value={f.owner} onChange={e=>set('owner',e.target.value)} placeholder="เจ้าของร้าน"/>
      <label className="lb">เบอร์โทรร้าน</label><input className="field" value={f.phone} onChange={e=>set('phone',e.target.value)} placeholder="08x-xxx-xxxx"/>
      <label className="lb">พร้อมเพย์ (เบอร์/เลขบัตร ปชช.)</label><input className="field" value={f.promptpay} onChange={e=>set('promptpay',e.target.value)} placeholder="0-9xxx-xxxxx-x"/>
      <label className="lb">PIN เจ้าของ (4 หลัก)</label><input className="field" value={f.pin} onChange={e=>set('pin',e.target.value.replace(/[^0-9]/g,'').slice(0,4))} placeholder="0000"/>
    </div>
    <button className="btn pri blk" disabled={!ready} style={{background:'var(--red,#C0392B)',opacity:ready?1:.5}} onClick={create}>🗑 ลบร้านเดิม & สร้างใหม่</button>
  </div>);
}
/* ═══ ลิงก์แชร์จอครัว KDS / จอคิว ═══ */
function OwnerKdsShare({d,toast,mode}){
  const isBoard=mode==='board';
  const base=location.href.replace(/[^/]*$/,'');
  const url=base+'Fitness KDS.html?shop='+encodeURIComponent(d.gym.id)+'&name='+encodeURIComponent(d.gym.name)+(isBoard?'&role=board':'');
  const copy=()=>{ try{navigator.clipboard.writeText(url);}catch(e){} toast('คัดลอกลิงก์แล้ว'); };
  const share=()=>{ const title=(isBoard?'จอคิว ':'จอครัว KDS ')+d.gym.name; if(navigator.share){navigator.share({title,url}).catch(()=>{});} else copy(); };
  const open=()=>window.open(url,'_blank');
  return (<div className="fade">
    <div className="card" style={{padding:18,textAlign:'center'}}>
      <div style={{fontSize:40,marginBottom:6}}>{isBoard?'📺':'👨‍🍳'}</div>
      <div style={{fontWeight:800,fontSize:17}}>{isBoard?'จอคิวหน้าร้าน':'จอครัว (KDS)'}</div>
      <div style={{fontSize:12.5,color:'var(--ink-3)',lineHeight:1.5,margin:'6px 14px 14px'}}>{isBoard?'จอหันออกให้ลูกค้าดูเลขคิว เรียกรับออเดอร์ · เปิดบนทีวี/แท็บเล็ตหน้าร้าน':'จอออเดอร์ในครัว/บาร์น้ำ · เปิดบนแท็บเล็ตในครัว ตั๋วไหลจากหน้าขายอัตโนมัติ'}</div>
      <div className="qr" dangerouslySetInnerHTML={{__html:qrSVG(url)}}/>
      <div style={{fontSize:11,color:'var(--ink-3)',marginTop:10,wordBreak:'break-all',fontFamily:'monospace',lineHeight:1.4}}>{url}</div>
    </div>
    <div style={{display:'flex',gap:8,marginTop:12}}>
      <button className="btn pri" style={{flex:1}} onClick={open}>🖥️ เปิดจอนี้เลย</button>
      <button className="btn gh" style={{flex:1}} onClick={share}>📤 ส่งลิงก์</button>
      <button className="btn gh" onClick={copy}>คัดลอก</button>
    </div>
    <div className="note gold" style={{marginTop:12}}>เปิดลิงก์นี้บนอุปกรณ์ที่ตั้งเป็นจอ (ทีวี/แท็บเล็ต) — ออเดอร์จากหน้าขายจะซิงค์ขึ้นจออัตโนมัติผ่านระบบ ไม่ต้องล็อกอินซ้ำ</div>
    <div className="note g" style={{marginTop:10}}>💡 ตั้งอุปกรณ์ให้เปิดค้างไว้ · แนะนำเปิดเบราว์เซอร์เต็มจอ (F11) หรือปักหมุดเป็นแอป (PWA)</div>
  </div>);
}
Object.assign(window,{ OwnerKdsShare, OwnerDash, OwnerSell, OwnerMembers, OwnerCheckin, OwnerMore, OwnerGymInfo, OwnerClasses, OwnerPT, OwnerStock, OwnerReport, OwnerPayMatch, OwnerDayClose, DayClosedGate, OwnerVouchers, OwnerStaff, OwnerPackages, OnDutyCard, ensureStaff, OwnerPromos, OwnerSales, OwnerPlan, PlanBanner, DemoBanner, OwnerNewGym,
  fitCan, staffCan, fitStaffOf:staffOf, PERM_PAGES, ROLE_DEFAULTS, STAFF_ROLES,
  FIT_TIERS, fitPlan, fitTierOf, activeMemberCount, fitOverCap, fitCapLeft,
  clsEmoji, clsColor, CLS_PALETTE, DOW_ORDER, DOW_SHORT, fitAddBundles, fitRedeem,
  fitSheet:Sheet, fitKpi:Kpi, fitStPill:stPill, fitAnalytics2:analytics, fitHelpers:{B,pkgOf,trOf,mbOf,firstName,qrSVG,promoMatch} });
