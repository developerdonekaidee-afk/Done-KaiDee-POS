// fitness-health.jsx — สายสุขภาพ: ค่าร่างกาย timeline+กราฟ · PAR-Q ในแอป · นำเข้า InBody (perm key 'health')
const { useState:useStateH } = React;
(function(){
const F=window.FIT; const H=window.fitHelpers||{};
const {todayISO,thDate}=F; const mbOf=H.mbOf;
const uid=(p)=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const num=(v)=>{ const n=Number(String(v==null?'':v).replace(/[^\d.\-]/g,'')); return isFinite(n)&&n!==0?n:(String(v).trim()==='0'?0:null); };
const bodyOf=(m)=>((m&&m.body)||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
const last=(m)=>{ const b=bodyOf(m); return b[b.length-1]||null; };
const prev=(m)=>{ const b=bodyOf(m); return b[b.length-2]||null; };
const METRICS=[['w','น้ำหนัก','กก.','#0E9C88'],['fat','ไขมัน','%','#E8477B'],['mus','กล้ามเนื้อ','กก.','#2E6BE6'],['vf','ไขมันช่องท้อง','ระดับ','#F0821E']];
const PARQ=[
  ['q1','หมอเคยบอกว่าคุณมีปัญหาหัวใจ และควรออกกำลังกายเฉพาะที่หมอแนะนำ?'],
  ['q2','เจ็บหน้าอกขณะออกกำลังกาย หรือขณะพัก?'],
  ['q3','เวียนหัว/เป็นลม หรือเสียการทรงตัวบ่อย?'],
  ['q4','มีปัญหากระดูก/ข้อ ที่อาจแย่ลงถ้าออกกำลังกาย?'],
  ['q5','กินยาความดัน/หัวใจ หรือยาประจำอื่น ๆ?'],
  ['q6','ตั้งครรภ์ หรือคลอดภายใน 6 เดือน?'],
  ['q7','มีเหตุผลอื่นที่ทำให้ไม่ควรออกกำลังกายหนัก?'] ];
const parqFlags=(p)=>!p?null:PARQ.filter(([k])=>p.ans&&p.ans[k]).map(([k])=>k);
const isoAt=(ts)=>{ const dt=new Date(ts||0); return isNaN(dt.getTime())||!ts?todayISO():dt.toISOString().slice(0,10); };
function saveBody(setData,mid,row){ setData(dd=>{ const mm=mbOf(dd,mid); if(mm){ mm.body=(mm.body||[]).filter(x=>!(x.date===row.date&&x.src===row.src)); mm.body.push(row); } return {...dd}; }); }

/* ══ กราฟเส้นมือถือ ══ */
function Spark({rows,k,color,unit}){
  const pts=rows.map(r=>({x:r.date,y:num(r[k])})).filter(p=>p.y!=null);
  if(pts.length<2) return <div className="empty" style={{padding:'14px',fontSize:12}}>บันทึกอย่างน้อย 2 ครั้งเพื่อดูกราฟ</div>;
  const W=320,Hh=110,pad=16; const ys=pts.map(p=>p.y); const mn=Math.min(...ys),mx=Math.max(...ys); const rg=(mx-mn)||1;
  const X=i=>pad+i*((W-pad*2)/(pts.length-1)); const Y=v=>Hh-pad-((v-mn)/rg)*(Hh-pad*2);
  const dpath=pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(p.y).toFixed(1)).join(' ');
  const area=dpath+' L '+X(pts.length-1).toFixed(1)+' '+(Hh-pad)+' L '+pad+' '+(Hh-pad)+' Z';
  return (<div>
    <svg viewBox={'0 0 '+W+' '+Hh} style={{width:'100%',height:118,display:'block'}}>
      <path d={area} fill={color} opacity=".10"/>
      <path d={dpath} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round"/>
      {pts.map((p,i)=><circle key={i} cx={X(i)} cy={Y(p.y)} r={i===pts.length-1?4:2.6} fill={color}/>)}
      <text x={pad} y="11" fontSize="9" fill="#889">{mx.toFixed(1)} {unit}</text>
      <text x={pad} y={Hh-3} fontSize="9" fill="#889">{mn.toFixed(1)} {unit}</text>
    </svg>
    <div style={{display:'flex',justifyContent:'space-between',fontSize:10.5,color:'var(--ink-3)',padding:'0 2px'}}>
      <span>{thDate(pts[0].x)}</span><span>{thDate(pts[pts.length-1].x)}</span></div>
  </div>);
}

/* ══ บันทึกค่าร่างกาย ══ */
function BodyEntrySheet({d,setData,toast,memberId,onClose}){
  const Sheet=window.fitSheet; const m=mbOf(d,memberId)||{}; const lt=last(m);
  const [f,setF]=useStateH(()=>({date:todayISO(),w:lt&&lt.w!=null?String(lt.w):'',fat:lt&&lt.fat!=null?String(lt.fat):'',mus:lt&&lt.mus!=null?String(lt.mus):'',vf:lt&&lt.vf!=null?String(lt.vf):'',note:''}));
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const save=()=>{ if(num(f.w)==null&&num(f.fat)==null){ toast('ใส่น้ำหนักหรือ % ไขมันอย่างน้อย 1 ค่า'); return; }
    saveBody(setData,memberId,{id:uid('bd-'),date:f.date,w:num(f.w),fat:num(f.fat),mus:num(f.mus),vf:num(f.vf),note:f.note.trim(),src:'manual',at:Date.now()});
    toast('บันทึกค่าร่างกายแล้ว'); onClose(); };
  return (<Sheet title="บันทึกค่าร่างกาย" tag={(m.name||'')+(m.code?' · '+m.code:'')} onClose={onClose}>
    <label className="lb" style={{marginTop:0}}>วันที่ชั่ง</label>
    <input type="date" className="field" value={f.date} onChange={e=>set('date',e.target.value)}/>
    <div style={{display:'flex',gap:8}}>
      <div style={{flex:1}}><label className="lb">น้ำหนัก (กก.)</label><input className="field num" inputMode="decimal" value={f.w} onChange={e=>set('w',e.target.value)}/></div>
      <div style={{flex:1}}><label className="lb">ไขมัน (%)</label><input className="field num" inputMode="decimal" value={f.fat} onChange={e=>set('fat',e.target.value)}/></div>
    </div>
    <div style={{display:'flex',gap:8}}>
      <div style={{flex:1}}><label className="lb">กล้ามเนื้อ (กก.)</label><input className="field num" inputMode="decimal" value={f.mus} onChange={e=>set('mus',e.target.value)}/></div>
      <div style={{flex:1}}><label className="lb">ไขมันช่องท้อง</label><input className="field num" inputMode="decimal" value={f.vf} onChange={e=>set('vf',e.target.value)}/></div>
    </div>
    <label className="lb">โน้ต</label>
    <input className="field" value={f.note} onChange={e=>set('note',e.target.value)} placeholder="เช่น ชั่งตอนเช้าก่อนอาหาร"/>
    <button className="btn pri blk" style={{marginTop:14}} onClick={save}>บันทึก</button>
  </Sheet>);
}

/* ══ PAR-Q ══ */
function ParqSheet({d,setData,toast,memberId,readOnly,onClose}){
  const Sheet=window.fitSheet; const m=mbOf(d,memberId)||{}; const cur=m.parq;
  const [ans,setAns]=useStateH(()=>({...((cur&&cur.ans)||{})}));
  const [note,setNote]=useStateH((cur&&cur.note)||'');
  const yes=PARQ.filter(([k])=>ans[k]).length;
  const save=()=>{ setData(dd=>{ const mm=mbOf(dd,memberId); if(mm) mm.parq={at:Date.now(),ans:{...ans},note:note.trim(),flags:PARQ.filter(([k])=>ans[k]).map(([k])=>k)}; return {...dd}; });
    toast(yes?'บันทึกแล้ว — แจ้งเทรนเนอร์ให้ระวัง':'บันทึกแบบประเมินแล้ว'); onClose(); };
  return (<Sheet title="แบบประเมินความพร้อม (PAR-Q)" tag={(m.name||'')+(cur&&cur.at?' · ทำล่าสุด '+thDate(isoAt(cur.at)):'')} onClose={onClose}>
    <div className="note blue" style={{marginBottom:12,fontSize:12}}>ตอบตามความจริง 7 ข้อ — ถ้าตอบ “ใช่” ข้อใดข้อหนึ่ง เทรนเนอร์จะปรับความหนักให้ และแนะนำให้ปรึกษาแพทย์ก่อนเริ่มโปรแกรมหนัก</div>
    <div className="card" style={{padding:'4px 12px'}}>{PARQ.map(([k,q])=>(<div className="row" key={k}>
      <div className="b"><div className="t" style={{fontSize:13,lineHeight:1.4,fontWeight:600}}>{q}</div></div>
      <div className="seg" style={{width:118,flex:'0 0 auto'}}>
        <button className={ans[k]===true?'on':''} disabled={readOnly} onClick={()=>setAns(x=>({...x,[k]:true}))}>ใช่</button>
        <button className={ans[k]===false||ans[k]==null?'on':''} disabled={readOnly} onClick={()=>setAns(x=>({...x,[k]:false}))}>ไม่</button></div>
    </div>))}</div>
    <label className="lb">อาการ/ยา/ข้อจำกัดอื่น ๆ ที่อยากให้เทรนเนอร์รู้</label>
    <textarea className="field" rows={2} value={note} readOnly={readOnly} onChange={e=>setNote(e.target.value)} placeholder="เช่น ปวดเข่าซ้าย · แพ้อากาศ"/>
    {yes>0&&<div className="note gold" style={{marginTop:11,fontSize:12}}>⚠️ ตอบ “ใช่” {yes} ข้อ — ควรปรึกษาแพทย์ก่อนออกกำลังกายหนัก · เทรนเนอร์จะเห็นธงเตือนนี้</div>}
    {!readOnly&&<button className="btn pri blk" style={{marginTop:14}} onClick={save}>บันทึกแบบประเมิน</button>}
  </Sheet>);
}

/* ══ บล็อกค่าร่างกาย (ใช้ทั้งฝั่งสมาชิกและฝั่งเทรนเนอร์) ══ */
function BodyBlock({d,setData,toast,memberId,staffView}){
  const m=mbOf(d,memberId)||{}; const rows=bodyOf(m); const lt=last(m),pv=prev(m);
  const [mk,setMk]=useStateH('w'); const [add,setAdd]=useStateH(false); const [pq,setPq]=useStateH(false);
  const met=METRICS.find(x=>x[0]===mk)||METRICS[0];
  const dlt=(k)=>{ if(!lt||!pv||lt[k]==null||pv[k]==null)return null; return Math.round((lt[k]-pv[k])*10)/10; };
  const flags=parqFlags(m.parq);
  return (<div>
    <div className="card" style={{marginBottom:10}}>
      <h3>ค่าร่างกายล่าสุด <span className="lnk">{lt?thDate(lt.date):'ยังไม่มีข้อมูล'}</span></h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {METRICS.map(([k,lb,u])=>{ const v=lt?lt[k]:null; const dv=dlt(k); const good=k==='w'||k==='fat'||k==='vf'?(dv!=null&&dv<0):(dv!=null&&dv>0);
          return (<div key={k} style={{border:'1px solid var(--hair,#eee)',borderRadius:12,padding:'9px 11px'}}>
            <div style={{fontSize:11,color:'var(--ink-3)',fontWeight:700}}>{lb}</div>
            <div style={{fontSize:19,fontWeight:800,lineHeight:1.25}}>{v!=null?v:'—'}<span style={{fontSize:11,fontWeight:600,color:'var(--ink-3)'}}> {v!=null?u:''}</span></div>
            {dv!=null&&dv!==0&&<div style={{fontSize:11,fontWeight:700,color:good?'var(--green,#0CA678)':'var(--red,#D6336C)'}}>{dv>0?'▲ +':'▼ '}{Math.abs(dv)} {u}</div>}
          </div>); })}
      </div>
      <button className="btn pri blk sm" style={{marginTop:12}} onClick={()=>setAdd(true)}>+ บันทึกค่าวันนี้</button>
    </div>
    <div className="card" style={{marginBottom:10}}>
      <h3>กราฟความเปลี่ยนแปลง</h3>
      <div className="seg" style={{marginBottom:10}}>{METRICS.map(([k,lb])=><button key={k} className={mk===k?'on':''} onClick={()=>setMk(k)}>{lb}</button>)}</div>
      <Spark rows={rows} k={met[0]} color={met[3]} unit={met[2]}/>
    </div>
    <div className="card" style={{marginBottom:10,background:flags&&flags.length?'#FFF7E6':undefined,border:flags&&flags.length?'1px solid #F3D98B':undefined}}>
      <h3>แบบประเมินความพร้อม (PAR-Q)</h3>
      <div style={{fontSize:12.5,color:'var(--ink-3)',lineHeight:1.5}}>
        {!m.parq?'ยังไม่ได้ทำ — ทำครั้งเดียว ใช้ตลอด (อัปเดตได้เมื่อมีอาการใหม่)'
          :(flags.length?('⚠️ ตอบ “ใช่” '+flags.length+' ข้อ · ทำเมื่อ '+thDate(isoAt(m.parq.at))):('✅ ผ่าน · ทำเมื่อ '+thDate(isoAt(m.parq.at))))}
        {m.parq&&m.parq.note?<div style={{marginTop:5}}>📝 {m.parq.note}</div>:null}
      </div>
      <button className={'btn blk sm '+(m.parq?'gh':'pri')} style={{marginTop:11}} onClick={()=>setPq(true)}>{m.parq?(staffView?'ดูคำตอบ':'อัปเดตคำตอบ'):'ทำแบบประเมิน'}</button>
    </div>
    <div className="secttl">ประวัติการชั่ง ({rows.length})</div>
    <div className="card" style={{padding:'2px 12px'}}>
      {rows.length?rows.slice().reverse().map(r=>(<div className="row" key={r.id||r.date+r.src}>
        <div className="b"><div className="t">{thDate(r.date)} {r.src==='inbody'&&<span className="pill pb" style={{fontSize:9,padding:'0 5px'}}>InBody</span>}</div>
          <div className="s">{[r.w!=null?r.w+' กก.':null,r.fat!=null?'ไขมัน '+r.fat+'%':null,r.mus!=null?'กล้าม '+r.mus+' กก.':null].filter(Boolean).join(' · ')}{r.note?' · '+r.note:''}</div></div>
        {staffView&&<button className="btn dngh sm" style={{flex:'0 0 auto'}} onClick={()=>{ if(!window.confirm('ลบรายการชั่งวันนี้?'))return; setData(dd=>{ const mm=mbOf(dd,memberId); if(mm)mm.body=(mm.body||[]).filter(x=>x!==r&&x.id!==r.id); return {...dd}; }); }}>ลบ</button>}
      </div>)):<div className="empty" style={{padding:'16px'}}>ยังไม่มีประวัติ</div>}
    </div>
    {add&&<BodyEntrySheet d={d} setData={setData} toast={toast} memberId={memberId} onClose={()=>setAdd(false)}/>}
    {pq&&<ParqSheet d={d} setData={setData} toast={toast} memberId={memberId} readOnly={!!staffView&&!!m.parq} onClose={()=>setPq(false)}/>}
  </div>);
}

/* ══ ฝั่งสมาชิก (แท็บ “ร่างกาย”) ══ */
function MemberBody({d,setData,memberId,toast}){
  const m=mbOf(d,memberId)||{};
  return (<div>
    {!m.parq&&<div className="note gold" style={{marginBottom:12}}>ทำแบบประเมินความพร้อม (PAR-Q) ก่อนเริ่มโปรแกรม — 7 ข้อ ใช้เวลาไม่ถึงนาที</div>}
    <BodyBlock d={d} setData={setData} toast={toast} memberId={memberId}/>
  </div>);
}

/* ══ ฝั่งเจ้าของ/เทรนเนอร์ — ค่าร่างกายสมาชิก + นำเข้า InBody ══ */
function OwnerHealth({d,setData,toast}){
  const [sel,setSel]=useStateH(null); const [q,setQ]=useStateH(''); const [imp,setImp]=useStateH(false);
  const list=(d.members||[]).filter(m=>!q||((m.name+' '+m.code).toLowerCase().includes(q.toLowerCase())));
  if(sel){ const m=mbOf(d,sel)||{}; return (<div className="fade">
    <button className="btn gh sm" style={{marginBottom:12}} onClick={()=>setSel(null)}>‹ กลับลิสต์สมาชิก</button>
    <div className="card" style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
      <div className="av">{(m.name||'?')[0]}</div>
      <div style={{flex:1,minWidth:0}}><div style={{fontWeight:800,fontSize:16}}>{m.name}</div><div style={{fontSize:12.5,color:'var(--ink-3)'}}>{m.code}{m.phone?' · '+m.phone:''}</div></div>
    </div>
    <BodyBlock d={d} setData={setData} toast={toast} memberId={sel} staffView/>
  </div>); }
  return (<div className="fade">
    <input className="field" value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหาชื่อ/รหัสสมาชิก"/>
    <button className="btn gh blk sm" style={{margin:'10px 0 12px'}} onClick={()=>setImp(true)}>📥 นำเข้าผล InBody (CSV)</button>
    <div className="card" style={{padding:'2px 12px'}}>
      {list.length?list.map(m=>{ const lt=last(m),pv=prev(m); const flags=parqFlags(m.parq); const dw=(lt&&pv&&lt.w!=null&&pv.w!=null)?Math.round((lt.w-pv.w)*10)/10:null;
        return (<div className="row" key={m.id} style={{cursor:'pointer'}} onClick={()=>setSel(m.id)}>
          <div className="av">{m.name[0]}</div>
          <div className="b"><div className="t">{m.name} {!m.parq&&<span className="pill py" style={{fontSize:9,padding:'0 5px'}}>ยังไม่ทำ PAR-Q</span>}{flags&&flags.length>0&&<span className="pill pr" style={{fontSize:9,padding:'0 5px'}}>⚠️ {flags.length} ข้อ</span>}</div>
            <div className="s">{lt?(thDate(lt.date)+' · '+(lt.w!=null?lt.w+' กก.':'')+(lt.fat!=null?' · ไขมัน '+lt.fat+'%':'')):'ยังไม่มีค่าร่างกาย'}</div></div>
          {dw!=null&&dw!==0&&<span className="pill" style={{flex:'0 0 auto',background:dw<0?'#E6F7EF':'#FDECEC',color:dw<0?'#0A7A54':'#B4232A'}}>{dw>0?'+':''}{dw} กก.</span>}
        </div>); }):<div className="empty" style={{padding:'18px'}}>ไม่พบสมาชิก</div>}
    </div>
    {imp&&<InbodySheet d={d} setData={setData} toast={toast} onClose={()=>setImp(false)}/>}
  </div>);
}

/* ══ นำเข้า InBody (CSV export จากเครื่อง) ══ */
function csvRows(text){ text=String(text||'').replace(/\r\n?/g,'\n');
  return text.split('\n').filter(l=>l.trim()).map(line=>{ const out=[]; let cur='',qt=false;
    for(let i=0;i<line.length;i++){ const c=line[i];
      if(qt){ if(c==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else qt=false; } else cur+=c; }
      else if(c==='"')qt=true; else if(c===','||c==='\t'){ out.push(cur); cur=''; } else cur+=c; }
    out.push(cur); return out.map(s=>s.trim()); }); }
const HINT={name:/ชื่อ|name|id|member/i,date:/วัน|date|test|measure/i,w:/weight|น้ำหนัก|wt/i,fat:/pbf|body ?fat|ไขมัน|fat *%/i,mus:/smm|muscle|กล้าม|lean/i,vf:/visceral|vfa|ช่องท้อง/i};
function InbodySheet({d,setData,toast,onClose}){
  const Sheet=window.fitSheet;
  const [head,setHead]=useStateH([]); const [rows,setRows]=useStateH([]); const [map,setMap]=useStateH({});
  const pick=()=>{ const i=document.createElement('input'); i.type='file'; i.accept='.csv,.txt,.tsv,text/csv';
    i.onchange=e=>{ const fl=e.target.files&&e.target.files[0]; if(!fl)return; const r=new FileReader();
      r.onload=()=>{ const rs=csvRows(r.result); if(rs.length<2){ toast('ไฟล์ไม่มีข้อมูล'); return; }
        const hd=rs[0]; setHead(hd); setRows(rs.slice(1));
        const mp={}; Object.keys(HINT).forEach(k=>{ const idx=hd.findIndex(h=>HINT[k].test(h)); if(idx>=0)mp[k]=idx; }); setMap(mp); };
      r.readAsDataURL?r.readAsText(fl):r.readAsText(fl); }; i.click(); };
  const g=(row,k)=>map[k]!=null?String(row[map[k]]||'').trim():'';
  const isoOf=(s)=>{ s=String(s||'').trim(); if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
    const m=s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/); if(!m)return todayISO();
    let y=+m[3]; if(y<100)y+=2000; if(y>2400)y-=543; return y+'-'+String(+m[2]).padStart(2,'0')+'-'+String(+m[1]).padStart(2,'0'); };
  const norm=(s)=>String(s||'').toLowerCase().replace(/\s+/g,'');
  const cand=rows.map(r=>{ const nm=g(r,'name'); const mem=(d.members||[]).find(m=>norm(m.code)===norm(nm)||norm(m.name)===norm(nm)||(nm&&norm(m.name).includes(norm(nm))));
    return { nm, member:mem||null, date:isoOf(g(r,'date')), w:num(g(r,'w')), fat:num(g(r,'fat')), mus:num(g(r,'mus')), vf:num(g(r,'vf')) }; });
  const good=cand.filter(c=>c.member&&(c.w!=null||c.fat!=null));
  const doImport=()=>{ if(!good.length){ toast('ไม่มีแถวที่จับคู่สมาชิกได้'); return; }
    setData(dd=>{ good.forEach(c=>{ const mm=mbOf(dd,c.member.id); if(!mm)return; mm.body=(mm.body||[]).filter(x=>!(x.date===c.date&&x.src==='inbody'));
      mm.body.push({id:uid('bd-'),date:c.date,w:c.w,fat:c.fat,mus:c.mus,vf:c.vf,note:'',src:'inbody',at:Date.now()}); }); return {...dd}; });
    toast('นำเข้า '+good.length+' รายการแล้ว'); onClose(); };
  return (<Sheet title="นำเข้าผล InBody" tag="ไฟล์ CSV/TSV จากเครื่องวัด" onClose={onClose}>
    {!head.length?<>
      <div className="note blue" style={{marginBottom:12,fontSize:12.5}}>เอาไฟล์ export จากเครื่อง InBody (บันทึกเป็น .csv) มาอัป — ระบบจับคู่สมาชิกจาก <b>รหัสสมาชิก</b> หรือ <b>ชื่อ</b> อัตโนมัติ แล้วเก็บเข้าไทม์ไลน์ค่าร่างกาย</div>
      <button className="btn pri blk" onClick={pick}>เลือกไฟล์ CSV</button>
    </>:<>
      <div className="secttl">จับคู่คอลัมน์</div>
      <div className="card" style={{padding:'4px 12px'}}>{[['name','รหัส/ชื่อสมาชิก'],['date','วันที่วัด'],['w','น้ำหนัก'],['fat','% ไขมัน'],['mus','กล้ามเนื้อ (SMM)'],['vf','ไขมันช่องท้อง']].map(([k,lb])=>(
        <div className="row" key={k}><div className="b"><div className="t" style={{fontSize:13}}>{lb}</div></div>
          <select className="field" style={{width:150,flex:'0 0 auto',padding:'7px 9px',fontSize:12.5}} value={map[k]==null?'':map[k]} onChange={e=>setMap(x=>({...x,[k]:e.target.value===''?undefined:+e.target.value}))}>
            <option value="">— ไม่ใช้ —</option>{head.map((h,i)=><option key={i} value={i}>{h||('คอลัมน์ '+(i+1))}</option>)}</select></div>))}</div>
      <div className="note g" style={{marginTop:12,fontSize:12.5}}>พบ {rows.length} แถว · จับคู่สมาชิกได้ <b>{good.length}</b> แถว{rows.length-good.length>0?(' · ข้าม '+(rows.length-good.length)+' แถว (ไม่พบสมาชิก/ไม่มีค่า)'):''}</div>
      <div className="card" style={{padding:'2px 12px',marginTop:10}}>{cand.slice(0,8).map((c,i)=>(<div className="row" key={i}>
        <div className="b"><div className="t" style={{fontSize:13}}>{c.member?c.member.name:(c.nm||'—')}</div>
          <div className="s">{thDate(c.date)}{c.w!=null?' · '+c.w+' กก.':''}{c.fat!=null?' · ไขมัน '+c.fat+'%':''}</div></div>
        <span className={'pill '+(c.member?'pg':'pn')} style={{flex:'0 0 auto'}}>{c.member?'จับคู่ได้':'ไม่พบ'}</span></div>))}</div>
      <button className="btn pri blk" style={{marginTop:14}} disabled={!good.length} onClick={doImport}>นำเข้า {good.length} รายการ</button>
      <button className="btn gh blk" style={{marginTop:8}} onClick={()=>{setHead([]);setRows([]);}}>เลือกไฟล์ใหม่</button>
    </>}
  </Sheet>);
}

Object.assign(window,{ MemberBody, OwnerHealth, FitBodyBlock:BodyBlock, FitParqSheet:ParqSheet, fitParqFlags:parqFlags, fitBodyLast:last });
})();
