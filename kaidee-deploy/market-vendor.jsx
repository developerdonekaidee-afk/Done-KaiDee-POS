/* market-vendor.jsx — แอปฝั่ง "ร้านผู้เช่าแผง" (vendor) ของระบบตลาด
   โหลดหลัง market-app.jsx → window.VendorApp (market-app เรียกใช้แทน VendorView เดิม)
   แท็บ: แผงของฉัน (VendorHome เดิม) · แนบสลิป · แจ้งซ่อม/ร้องเรียน · ประกาศจากตลาด · สัญญา · น้ำ-ไฟ
   คีย์ข้อมูล (อยู่ใน blob ตลาดเดียวกัน): d.slips · d.tickets · d.notices · d.vreqs */
(function(){
  const R=window.React, {useState}=R;
  const MKx=()=>window.MK;
  const B=(n)=>MKx().B(n);
  const nowISO=()=>new Date().toISOString();
  const th=(ts)=>ts?MKx().thDateTime(typeof ts==='number'?ts:new Date(ts).getTime()):'—';
  const uid=(p)=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  const pickImg=(cb)=>{ const i=document.createElement('input'); i.type='file'; i.accept='image/*';
    i.onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>cb(r.result); r.readAsDataURL(f); }; i.click(); };

  const TAB=[['me','🏪 แผงของฉัน'],['slip','📎 แนบสลิป'],['fix','🛠️ แจ้งซ่อม'],['news','📣 ประกาศ'],['doc','📄 สัญญา'],['meter','💧 น้ำ-ไฟ']];
  const ST_PILL={pending:['p-y','รอตรวจ'],ok:['p-g','ตรวจแล้ว'],reject:['p-r','ไม่ผ่าน'],
    open:['p-y','เปิดเรื่อง'],progress:['p-b','กำลังแก้'],done:['p-g','ปิดงาน'],
    approved:['p-g','อนุมัติ'],rejected:['p-r','ไม่อนุมัติ']};
  const Pill=({s})=>{ const p=ST_PILL[s]||['p-b',s]; return <span className={'pill '+p[0]}>{p[1]}</span>; };
  const Empty=({children})=><div className="note" style={{marginTop:10}}>{children}</div>;

  function VendorApp(props){
    const {data,setData,stallId,Home}=props;
    const [tab,setTab]=useState('me');
    const st=(data.stalls||[]).find(s=>s.id===stallId);
    if(!st) return <div className="note red">ไม่พบแผงนี้</div>;
    const market=data.market;
    const mine=(arr,key)=>(data[arr]||[]).filter(x=>x.stallId===stallId).sort((a,b)=>(b[key||'at']||0)-(a[key||'at']||0));
    const push=(arr,row)=>setData(d=>{ d[arr]=d[arr]||[]; d[arr].push(row); return {...d}; });
    const patch=(arr,id,fn)=>setData(d=>{ const x=(d[arr]||[]).find(y=>y.id===id); if(x)fn(x); return {...d}; });

    return (<div className="fade" style={{maxWidth:780}}>
      <div className="seg" style={{marginBottom:16,flexWrap:'wrap'}}>{TAB.map(([k,l])=>(
        <button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>))}</div>
      {tab==='me'&&(Home?<Home {...props}/>:null)}
      {tab==='slip'&&<SlipTab data={data} st={st} rows={mine('slips')} push={push}/>}
      {tab==='fix'&&<FixTab st={st} market={market} rows={mine('tickets')} push={push} patch={patch}/>}
      {tab==='news'&&<NewsTab data={data} market={market}/>}
      {tab==='doc'&&<DocTab data={data} st={st} rows={mine('vreqs')} push={push}/>}
      {tab==='meter'&&<MeterTab data={data} st={st}/>}
    </div>);
  }

  /* ── 1) แนบสลิปโอน → เข้าคิวตรวจของตลาด ── */
  function SlipTab({data,st,rows,push}){
    const bills=(data.bills||[]).filter(b=>b.stallId===st.id).sort((a,b)=>b.period<a.period?-1:1);
    const unpaid=bills.filter(b=>b.status!=='paid');
    const [billId,setBillId]=useState((unpaid[0]||bills[0]||{}).id||'');
    const [amt,setAmt]=useState((unpaid[0]||{}).total||'');
    const [img,setImg]=useState(null); const [note,setNote]=useState(''); const [ok,setOk]=useState(false);
    const bill=bills.find(b=>b.id===billId);
    const send=()=>{ if(!img){ alert('แนบรูปสลิปก่อน'); return; } if(!(+amt>0)){ alert('ใส่จำนวนเงินที่โอน'); return; }
      push('slips',{id:uid('sl'),marketId:st.marketId,stallId:st.id,billId,period:bill&&bill.period,amount:+amt,img,note:note.trim(),at:Date.now(),status:'pending'});
      setImg(null); setNote(''); setOk(true); };
    return (<>
      <div className="card panel">
        <h3>แนบสลิปโอนเงิน <span className="sub" style={{fontWeight:500}}>· ตลาดตรวจแล้วจะตัดบิลให้</span></h3>
        {ok&&<div className="note g" style={{marginBottom:12}}>✓ ส่งสลิปเข้าคิวตรวจแล้ว — รอเจ้าหน้าที่ตลาดยืนยัน (ปกติภายในวันทำการ)</div>}
        <label className="lb">บิลที่ต้องการชำระ</label>
        <select className="field" value={billId} onChange={e=>{ setBillId(e.target.value); const b=bills.find(x=>x.id===e.target.value); if(b)setAmt(b.total); }}>
          {bills.map(b=><option key={b.id} value={b.id}>{MKx().monthTH(b.period)} · {B(b.total)} {b.status==='paid'?'(จ่ายแล้ว)':''}</option>)}
        </select>
        <label className="lb">จำนวนเงินที่โอน</label>
        <input className="field num" type="number" value={amt} onChange={e=>setAmt(e.target.value)}/>
        <label className="lb">หมายเหตุ (ถ้ามี)</label>
        <input className="field" value={note} onChange={e=>setNote(e.target.value)} placeholder="เช่น โอนบางส่วน / โอนจากบัญชีญาติ"/>
        <div style={{display:'flex',gap:10,alignItems:'center',marginTop:12,flexWrap:'wrap'}}>
          {img?<img src={img} alt="slip" style={{width:64,height:64,objectFit:'cover',borderRadius:10,border:'1px solid var(--line)'}}/>:null}
          <button className="btn gh" onClick={()=>pickImg(setImg)}>{img?'เปลี่ยนรูปสลิป':'📷 แนบรูปสลิป'}</button>
          <div className="grow"/>
          <button className="btn pri" onClick={send}>ส่งให้ตลาดตรวจ</button>
        </div>
      </div>
      <div className="card panel" style={{marginTop:16}}><h3>สลิปที่ส่งไปแล้ว</h3>
        {rows.length?<table><thead><tr><th>ส่งเมื่อ</th><th>รอบบิล</th><th className="r">จำนวน</th><th className="c">สถานะ</th></tr></thead>
          <tbody>{rows.map(s=><tr key={s.id}><td>{th(s.at)}</td><td>{s.period?MKx().monthTH(s.period):'—'}</td>
            <td className="r num">{B(s.amount)}</td><td className="c"><Pill s={s.status}/>{s.status==='reject'&&s.reason?<div className="sub">{s.reason}</div>:null}</td></tr>)}</tbody></table>
          :<Empty>ยังไม่มีสลิปที่ส่ง</Empty>}
      </div>
    </>);
  }

  /* ── 2) แจ้งซ่อม / ร้องเรียน + ติดตามสถานะ ── */
  const FIX_CAT=[['repair','🛠️ แจ้งซ่อม'],['clean','🧹 ความสะอาด'],['complain','😠 ร้องเรียน'],['other','📌 อื่นๆ']];
  function FixTab({st,market,rows,push,patch}){
    const [cat,setCat]=useState('repair'); const [title,setTitle]=useState(''); const [detail,setDetail]=useState(''); const [img,setImg]=useState(null);
    const [open,setOpen]=useState(null);
    const send=()=>{ if(!title.trim()){ alert('ใส่หัวเรื่องสั้น ๆ'); return; }
      push('tickets',{id:uid('tk'),marketId:st.marketId,stallId:st.id,stallCode:st.code,vendor:st.vendor,cat,title:title.trim(),detail:detail.trim(),img,at:Date.now(),status:'open',
        log:[{at:Date.now(),by:'ผู้เช่า',msg:'แจ้งเรื่องเข้าระบบ',status:'open'}]});
      setTitle(''); setDetail(''); setImg(null); };
    const cancel=(id)=>{ if(!confirm('ยกเลิกเรื่องนี้?'))return; patch('tickets',id,t=>{ t.status='done'; (t.log=t.log||[]).push({at:Date.now(),by:'ผู้เช่า',msg:'ผู้เช่ายกเลิกเรื่อง',status:'done'}); }); };
    return (<>
      <div className="card panel">
        <h3>แจ้งเรื่องถึงตลาด</h3>
        <div className="sub" style={{marginBottom:10}}>ไฟดับ · น้ำรั่ว · หลังคารั่ว · เพื่อนบ้านล้ำพื้นที่ · ขยะ — แจ้งที่นี่แล้วติดตามสถานะได้</div>
        <div className="seg" style={{marginBottom:10}}>{FIX_CAT.map(([k,l])=><button key={k} className={cat===k?'on':''} onClick={()=>setCat(k)}>{l}</button>)}</div>
        <label className="lb">หัวเรื่อง</label>
        <input className="field" value={title} onChange={e=>setTitle(e.target.value)} placeholder="เช่น ปลั๊กไฟหน้าแผงใช้ไม่ได้"/>
        <label className="lb">รายละเอียด</label>
        <textarea className="field" style={{minHeight:90}} value={detail} onChange={e=>setDetail(e.target.value)} placeholder="เกิดตั้งแต่เมื่อไหร่ · จุดไหน · กระทบการขายอย่างไร"/>
        <div style={{display:'flex',gap:10,alignItems:'center',marginTop:12,flexWrap:'wrap'}}>
          {img?<img src={img} alt="ภาพ" style={{width:64,height:64,objectFit:'cover',borderRadius:10,border:'1px solid var(--line)'}}/>:null}
          <button className="btn gh" onClick={()=>pickImg(setImg)}>{img?'เปลี่ยนรูป':'📷 แนบรูป'}</button>
          <div className="grow"/><button className="btn pri" onClick={send}>ส่งเรื่อง</button>
        </div>
      </div>
      <div className="card panel" style={{marginTop:16}}><h3>เรื่องของฉัน ({rows.length})</h3>
        {rows.length?<div className="feed">{rows.map(t=>(<div key={t.id}>
          <div className="feeditem" style={{cursor:'pointer'}} onClick={()=>setOpen(open===t.id?null:t.id)}>
            <div className="fi-ic" style={{background:'var(--brand-soft)'}}>{(FIX_CAT.find(c=>c[0]===t.cat)||['','📌'])[1].slice(0,2)}</div>
            <div className="fi-b"><div className="fi-t">{t.title}</div><div className="fi-s">{th(t.at)} · {(FIX_CAT.find(c=>c[0]===t.cat)||[,'อื่นๆ'])[1]}</div></div>
            <div className="fi-v"><Pill s={t.status}/></div></div>
          {open===t.id&&<div style={{background:'var(--bg-soft)',borderRadius:10,padding:'12px 14px',margin:'2px 0 10px'}}>
            {t.detail?<div style={{fontSize:13.5,lineHeight:1.7,marginBottom:8}}>{t.detail}</div>:null}
            {t.img?<img src={t.img} alt="" style={{maxWidth:220,borderRadius:10,marginBottom:8,display:'block'}}/>:null}
            <div className="sub" style={{fontWeight:600,marginBottom:4}}>ความคืบหน้า</div>
            {(t.log||[]).map((l,i)=><div key={i} className="sub" style={{lineHeight:1.8}}>• {th(l.at)} · {l.by}: {l.msg}</div>)}
            {t.status!=='done'&&<button className="btn gh sm" style={{marginTop:10}} onClick={()=>cancel(t.id)}>ยกเลิกเรื่องนี้</button>}
          </div>}
        </div>))}</div>:<Empty>ยังไม่มีเรื่องแจ้ง</Empty>}
      </div>
    </>);
  }

  /* ── 3) ประกาศจากตลาด ── */
  function NewsTab({data,market}){
    const rows=(data.notices||[]).filter(n=>!n.marketId||n.marketId===market.id).sort((a,b)=>(b.pin?1:0)-(a.pin?1:0)||b.at-a.at);
    return (<div className="card panel"><h3>ประกาศจากตลาด</h3>
      {rows.length?<div style={{display:'flex',flexDirection:'column',gap:10,marginTop:10}}>{rows.map(n=>(
        <div key={n.id} style={{border:'1px solid var(--line)',borderLeft:'4px solid '+(n.pin?'var(--red)':'var(--brand)'),borderRadius:10,padding:'12px 14px'}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}><b style={{fontSize:14.5}}>{n.title}</b>{n.pin?<span className="pill p-r">สำคัญ</span>:null}</div>
          <div style={{fontSize:13.5,lineHeight:1.7,marginTop:6,whiteSpace:'pre-wrap'}}>{n.body}</div>
          <div className="sub" style={{marginTop:6}}>ประกาศ {th(n.at)}{n.until?' · ถึง '+MKx().thDate(n.until):''}</div>
        </div>))}</div>
        :<Empty>ยังไม่มีประกาศ — ตลาดจะแจ้งเรื่องปิดตลาด/ตัดน้ำตัดไฟ/เก็บค่าเช่ารอบใหม่ที่นี่</Empty>}
    </div>);
  }

  /* ── 4) ขอต่อสัญญา / คืนแผง ── */
  function DocTab({data,st,rows,push}){
    const end=st.contractEnd||null;
    const left=end?Math.ceil((new Date(end)-Date.now())/864e5):null;
    const [kind,setKind]=useState('renew'); const [months,setMonths]=useState(12); const [date,setDate]=useState(''); const [note,setNote]=useState('');
    const pend=rows.find(r=>r.status==='pending');
    const send=()=>{ if(kind==='return'&&!date){ alert('ระบุวันที่จะคืนแผง'); return; }
      push('vreqs',{id:uid('vr'),marketId:st.marketId,stallId:st.id,stallCode:st.code,vendor:st.vendor,kind,months:kind==='renew'?+months:null,moveOutDate:kind==='return'?date:null,note:note.trim(),at:Date.now(),status:'pending'});
      setNote(''); };
    return (<>
      <div className="card panel">
        <h3>สัญญาเช่าแผง {st.code}</h3>
        <div className="kv"><span className="k">ผู้เช่า</span><span className="v">{st.vendor}</span></div>
        <div className="kv"><span className="k">ประเภท/พื้นที่</span><span className="v">{(MKx().UNIT_TYPES||{})[st.unitType]||'—'} · {st.area} ตร.ม.</span></div>
        <div className="kv"><span className="k">สิ้นสุดสัญญา</span><span className="v">{end?MKx().thDate(end):'— ตลาดยังไม่บันทึกวันสิ้นสุด —'}</span></div>
        {left!=null&&left<=60&&<div className={'note '+(left<=15?'red':'gold')} style={{marginTop:10}}>
          {left<0?'⚠ สัญญาหมดอายุแล้ว '+Math.abs(left)+' วัน — ติดต่อตลาดโดยด่วน':'⏳ เหลืออีก '+left+' วันสัญญาจะครบกำหนด — กดขอต่อสัญญาได้เลย'}</div>}
        <button className="btn gh sm" style={{marginTop:12}} onClick={()=>window.openDoc&&window.openDoc('type=contract&stall='+encodeURIComponent(st.id))}>📄 เปิดสัญญาฉบับเต็ม</button>
      </div>
      <div className="card panel" style={{marginTop:16}}>
        <h3>ยื่นคำขอถึงตลาด</h3>
        {pend&&<div className="note gold" style={{marginBottom:12}}>มีคำขอรออนุมัติอยู่ ({pend.kind==='renew'?'ขอต่อสัญญา':'ขอคืนแผง'} · ส่ง {th(pend.at)}) — รอตลาดตอบกลับ</div>}
        <div className="seg" style={{marginBottom:10}}>{[['renew','🔁 ขอต่อสัญญา'],['return','📤 ขอคืนแผง']].map(([k,l])=><button key={k} className={kind===k?'on':''} onClick={()=>setKind(k)}>{l}</button>)}</div>
        {kind==='renew'?<><label className="lb">ต่อสัญญาอีก (เดือน)</label>
          <div className="seg" style={{width:'100%'}}>{[6,12,24].map(m=><button key={m} style={{flex:1}} className={+months===m?'on':''} onClick={()=>setMonths(m)}>{m} เดือน</button>)}</div></>
          :<><label className="lb">วันที่จะคืนแผง</label><input className="field" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          <div className="sub" style={{marginTop:6}}>ต้องแจ้งล่วงหน้าตามสัญญา · ค้างชำระต้องเคลียร์ก่อนคืนหลักประกัน</div></>}
        <label className="lb">ข้อความถึงตลาด</label>
        <textarea className="field" style={{minHeight:80}} value={note} onChange={e=>setNote(e.target.value)} placeholder="เช่น ขอต่อสัญญาเงื่อนไขเดิม / ขอย้ายไปแผงโซน C"/>
        <button className="btn pri" style={{marginTop:12,width:'100%'}} onClick={send}>ส่งคำขอ</button>
      </div>
      <div className="card panel" style={{marginTop:16}}><h3>ประวัติคำขอ</h3>
        {rows.length?<table><thead><tr><th>วันที่</th><th>เรื่อง</th><th>รายละเอียด</th><th className="c">สถานะ</th></tr></thead>
          <tbody>{rows.map(r=><tr key={r.id}><td>{th(r.at)}</td><td>{r.kind==='renew'?'ขอต่อสัญญา':'ขอคืนแผง'}</td>
            <td className="sub">{r.kind==='renew'?(r.months+' เดือน'):('คืน '+MKx().thDate(r.moveOutDate))}{r.note?' · '+r.note:''}</td>
            <td className="c"><Pill s={r.status}/></td></tr>)}</tbody></table>:<Empty>ยังไม่มีคำขอ</Empty>}
      </div>
    </>);
  }

  /* ── 6) ประวัติหน่วยน้ำ-ไฟ + เตือนผิดปกติ ── */
  function MeterTab({data,st}){
    const bills=(data.bills||[]).filter(b=>b.stallId===st.id).sort((a,b)=>a.period<b.period?-1:1);
    if(!bills.length) return <Empty>ยังไม่มีข้อมูลมิเตอร์</Empty>;
    const eAvg=Math.round(bills.reduce((a,b)=>a+(b.elecUnits||0),0)/bills.length);
    const wAvg=Math.round(bills.reduce((a,b)=>a+(b.waterUnits||0),0)/bills.length);
    const last=bills[bills.length-1];
    const spikeE=eAvg&&last.elecUnits>eAvg*1.4, spikeW=wAvg&&last.waterUnits>wAvg*1.4;
    const mx=Math.max(1,...bills.map(b=>b.elecUnits||0));
    const unpaid=bills.filter(b=>b.status!=='paid');
    return (<>
      <div className="kpis">
        <window.Kpi label="ค่าไฟรอบล่าสุด" value={(last.elecUnits||0)+' หน่วย'} foot={B(last.elecAmt)} tone={spikeE?'var(--red)':'var(--ink)'}/>
        <window.Kpi label="ค่าน้ำรอบล่าสุด" value={(last.waterUnits||0)+' หน่วย'} foot={B(last.waterAmt)} tone={spikeW?'var(--red)':'var(--ink)'}/>
        <window.Kpi label="เฉลี่ยไฟ/น้ำ" value={eAvg+' / '+wAvg} foot={'จาก '+bills.length+' รอบ'}/>
        <window.Kpi label="บิลค้างชำระ" value={unpaid.length} foot={unpaid.length?('รวม '+B(unpaid.reduce((a,b)=>a+b.total,0))):'ไม่มีค้าง'} tone={unpaid.length?'var(--red)':'var(--green)'}/>
      </div>
      {(spikeE||spikeW)&&<div className="note red" style={{marginTop:16}}>⚠ รอบนี้{spikeE?'ค่าไฟ':''}{spikeE&&spikeW?' และ ':''}{spikeW?'ค่าน้ำ':''}สูงกว่าค่าเฉลี่ยเกิน 40% — ตรวจอุปกรณ์/ท่อรั่ว หรือแจ้งตลาดให้ตรวจมิเตอร์ (แท็บแจ้งซ่อม)</div>}
      <div className="card panel" style={{marginTop:16}}><h3>ประวัติหน่วยน้ำ-ไฟรายรอบ</h3>
        <table><thead><tr><th>รอบ</th><th className="r">ไฟ (หน่วย)</th><th className="r">ค่าไฟ</th><th className="r">น้ำ (หน่วย)</th><th className="r">ค่าน้ำ</th><th className="c">บิล</th></tr></thead>
          <tbody>{[...bills].reverse().map(b=>(<tr key={b.id}>
            <td>{MKx().monthTH(b.period)}</td>
            <td className="r num"><div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
              <span style={{width:Math.max(4,Math.round((b.elecUnits||0)/mx*60)),height:6,background:'var(--gold)',borderRadius:9,display:'inline-block'}}/>{b.elecUnits||0}</div></td>
            <td className="r num">{B(b.elecAmt)}</td><td className="r num">{b.waterUnits||0}</td><td className="r num">{B(b.waterAmt)}</td>
            <td className="c">{b.status==='paid'?<span className="pill p-g">จ่ายแล้ว</span>:b.status==='overdue'?<span className="pill p-r">เกินกำหนด</span>:<span className="pill p-y">รอชำระ</span>}</td></tr>))}</tbody></table>
        <div className="sub" style={{marginTop:8}}>ตลาดจดมิเตอร์ทุกสิ้นรอบ · ถ้าตัวเลขไม่ตรงกับหน้ามิเตอร์จริง ให้แจ้งที่แท็บ “แจ้งซ่อม” พร้อมรูปหน้าปัด</div>
      </div>
    </>);
  }

  Object.assign(window,{VendorApp,VendorSlipTab:SlipTab,VendorFixTab:FixTab,VendorNewsTab:NewsTab,VendorDocTab:DocTab,VendorMeterTab:MeterTab});
})();
