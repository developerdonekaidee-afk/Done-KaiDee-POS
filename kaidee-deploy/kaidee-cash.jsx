// kaidee-cash.jsx — cash register (open/close day, cash in-out) + income/expense report
const { useState:cashState } = React;

const _todayISO = ()=> new Date().toISOString().slice(0,10);
const dispDate = (iso, lang)=>{ try{ return new Date((iso||_todayISO())+'T00:00:00').toLocaleDateString(lang==='th'?'th-TH':'en-US',{day:'numeric',month:'short'}); }catch(e){ return iso; } };
const EXP_CATS = [
  { id:'material', th:'ค่าวัตถุดิบ',  en:'Materials' },
  { id:'utility',  th:'ค่าน้ำ/ไฟ',    en:'Utilities' },
  { id:'wage',     th:'ค่าจ้าง',       en:'Wages' },
  { id:'rent',     th:'ค่าเช่า',       en:'Rent' },
  { id:'waste',    th:'ของเสีย/ทิ้ง',   en:'Waste' },
  { id:'other',    th:'อื่นๆ',         en:'Other' },
];
const expCat = (id, lang)=>{ const c=EXP_CATS.find(x=>x.id===id); return c?(c[lang]||c.th):(id||''); };

/* ══════════════ REPORTS SHELL — [ยอดขาย] + [รายรับ-รายจ่าย] ══════════════ */
function ReportsScreen({ store }){
  const { lang } = useT(); const TH = lang==='th';
  const [seg,setSeg] = cashState('sales');
  return (
    <div className="kd-screen">
      <div style={{ paddingTop:56 }}/>
      <div style={{ display:'flex', gap:8, padding:'0 16px 10px' }}>
        {[['sales',TH?'ยอดขาย':'Sales'],['finance',TH?'รายรับ-รายจ่าย':'Income/Expense']].map(([k,l])=>(
          <button key={k} onClick={()=>setSeg(k)} style={{ border:'none', cursor:'pointer', flex:1, padding:'11px', borderRadius:12,
            fontWeight:700, fontSize:14, fontFamily:'var(--font)', background: seg===k?'var(--ink)':'#fff', color: seg===k?'#fff':'var(--ink-2)', boxShadow:'var(--shadow)' }}>{l}</button>
        ))}
      </div>
      <div style={{ position:'absolute', inset:0, top:104 }}>
        {seg==='sales'
          ? <DashboardScreen sales={store.sales} menu={store.menu} raw={store.raw} costMode={store.costMode} store={store} embedded/>
          : <FinanceScreen store={store}/>}
      </div>
    </div>
  );
}

/* ══════════════ FINANCE — income vs expense ══════════════ */
function FinanceScreen({ store }){
  const { lang } = useT(); const TH = lang==='th';
  const { sales, purchases, cashDays, register, menu, raw, costMode, shop, wastes } = store;
  const [period,setPeriod] = cashState('today');
  const today = _todayISO();
  const inRange = (iso)=> period==='all' ? true : (!iso || iso===today);

  const saleRows = sales.filter(s=>!s.void && inRange(s.date));
  const income = saleRows.reduce((a,s)=>a+saleTotal(s),0);
  const cogs = saleRows.reduce((a,s)=>a+effSaleCost(s, menu, raw, costMode),0);

  // expenses: purchases (materials) + cash-out moves (current register + closed days)
  const buyRows = purchases.filter(p=>inRange(p.date)).map(p=>({ date:p.date, cat:'material', note:p.note||(TH?'ซื้อวัตถุดิบ':'Purchase'), amount:p.lines.reduce((a,l)=>a+(Number(l.price)||0),0) }));
  const moveRows = [];
  (register.moves||[]).forEach(m=>{ if(m.type==='out' && inRange(today)) moveRows.push({ date:today, cat:m.cat||'other', note:m.note||'', amount:Number(m.amount)||0 }); });
  (cashDays||[]).forEach(d=>{ (d.moves||[]).forEach(m=>{ if(m.type==='out' && inRange(d.date)) moveRows.push({ date:d.date, cat:m.cat||'other', note:m.note||'', amount:Number(m.amount)||0 }); }); });
  // waste (ของเสีย) → นับเป็นรายจ่ายหมวด waste
  const wasteRows = (wastes||[]).filter(w=>inRange(w.date)).map(w=>{ const r=rawById(raw,w.rmId); return { date:w.date, cat:'waste', note:(TH?'ของเสีย: ':'Waste: ')+((r&&r.th)||w.rmId)+(w.reason?' · '+w.reason:''), amount:Number(w.cost)||0 }; });
  const expenses = [...buyRows, ...moveRows, ...wasteRows].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const expTotal = expenses.reduce((a,e)=>a+e.amount,0);
  const byCat = {}; expenses.forEach(e=>{ byCat[e.cat]=(byCat[e.cat]||0)+e.amount; });
  const net = income - expTotal;

  const doPrint = ()=>{
    const esc=(s)=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const M=(n)=>'฿'+Math.round(Number(n)||0).toLocaleString('en-US');
    const shopName=(shop&&shop.name)||'ร้านของฉัน';
    const periodTxt = period==='today' ? new Date().toLocaleDateString(TH?'th-TH':'en-US',{day:'numeric',month:'long',year:'numeric'}) : (TH?'ทั้งหมด (ทุกวัน)':'All time');
    const printedTxt = new Date().toLocaleString(TH?'th-TH':'en-US',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const expRows = expenses.length ? expenses.map((e,i)=>'<tr><td class="c">'+(i+1)+'</td><td>'+esc(expCat(e.cat,lang))+'</td><td>'+esc(e.note||'-')+'</td><td class="c">'+esc(dispDate(e.date,lang))+'</td><td class="r">'+M(e.amount)+'</td></tr>').join('') : '<tr><td colspan="5" class="c" style="color:#888;padding:14px">'+(TH?'ไม่มีรายจ่าย':'No expenses')+'</td></tr>';
    const catRows = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([c,v])=>'<tr><td>'+esc(expCat(c,lang))+'</td><td class="r">'+M(v)+'</td></tr>').join('');
    const box=(lbl,val,col)=>'<div class="box"><div class="bl">'+lbl+'</div><div class="bv" style="color:'+(col||'#1a1a1a')+'">'+val+'</div></div>';
    const css="*{margin:0;padding:0;box-sizing:border-box}@page{size:A4;margin:16mm}body{font-family:'IBM Plex Sans Thai',sans-serif;color:#1a1a1a;font-size:13px;line-height:1.5}"
      +".head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #12A56E;padding-bottom:14px;margin-bottom:18px}"
      +".shop{font-size:20px;font-weight:700;color:#0B7A50}.doct{font-size:24px;font-weight:800;color:#12A56E}.meta{font-size:12px;color:#444;margin-top:6px;text-align:right}"
      +".grid{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}.box{flex:1;min-width:150px;background:#F1FAF5;border-radius:8px;padding:11px 14px}.bl{font-size:11px;color:#12A56E;font-weight:700}.bv{font-size:19px;font-weight:800;margin-top:3px}"
      +".net{background:#0B7A50;color:#fff}.net .bl{color:#bff0da}.net .bv{color:#fff}"
      +"h3{font-size:14px;color:#0B7A50;margin:16px 0 8px}table{width:100%;border-collapse:collapse;margin-bottom:8px}th{background:#0B7A50;color:#fff;font-size:12px;padding:8px 10px;text-align:left}"
      +"td{padding:8px 10px;border-bottom:1px solid #e5eae7}.c{text-align:center}.r{text-align:right}tfoot td{font-weight:800;border-top:2px solid #12A56E;color:#0B7A50}";
    const body='<div class="head"><div><div class="shop">'+esc(shopName)+'</div><div style="color:#666;font-size:12px;margin-top:3px">'+esc((shop&&shop.address)||'')+'</div></div>'
      +'<div style="text-align:right"><div class="doct">'+(TH?'สรุปรายรับ–รายจ่าย':'INCOME – EXPENSE')+'</div><div class="meta"><b>'+(TH?'ช่วง':'Period')+'</b> '+periodTxt+'<br><b>'+(TH?'พิมพ์เมื่อ':'Printed')+'</b> '+printedTxt+'</div></div></div>'
      +'<div class="grid">'+box(TH?'รายรับ':'Income',M(income),'#0B7A50')+box(TH?'ต้นทุนขาย':'COGS',M(cogs),'#B26A00')+box(TH?'กำไรขั้นต้น':'Gross',M(income-cogs))+'</div>'
      +'<div class="grid">'+box(TH?'รายจ่ายรวม':'Expense',M(expTotal),'#C0392B')+'<div class="box net"><div class="bl">'+(TH?'กำไรสุทธิ (รายรับ − รายจ่าย)':'Net (income − expense)')+'</div><div class="bv">'+M(net)+'</div></div></div>'
      +(catRows?'<h3>'+(TH?'รายจ่ายตามหมวด':'Expense by category')+'</h3><table><tbody>'+catRows+'</tbody></table>':'')
      +'<h3>'+(TH?'รายการรายจ่าย':'Expense log')+'</h3><table><thead><tr><th class="c" style="width:34px">#</th><th>'+(TH?'หมวด':'Category')+'</th><th>'+(TH?'รายละเอียด':'Note')+'</th><th class="c" style="width:80px">'+(TH?'วันที่':'Date')+'</th><th class="r" style="width:100px">'+(TH?'จำนวน':'Amount')+'</th></tr></thead><tbody>'+expRows+'</tbody><tfoot><tr><td colspan="4" class="r">'+(TH?'รวมรายจ่าย':'Total expense')+'</td><td class="r">'+M(expTotal)+'</td></tr></tfoot></table>'
      +'<div style="margin-top:14px;font-size:12px;color:#666">'+(TH?'รายรับจากการขาย '+saleRows.length+' บิล · ต้นทุนขาย '+M(cogs)+' · กำไรสุทธิ '+M(net):'From '+saleRows.length+' sales · net '+M(net))+'</div>';
    const doc='<!DOCTYPE html><ht'+'ml><he'+'ad><meta charset="utf-8"><ti'+'tle>'+(TH?'สรุปรายรับรายจ่าย':'Income-Expense')+'</ti'+'tle><li'+'nk href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;700;800&display=swap" rel="stylesheet"><sty'+'le>'+css+'</sty'+'le></he'+'ad><bo'+'dy>'+body+'</bo'+'dy></ht'+'ml>';
    try{
      const ifr=document.createElement('iframe'); ifr.setAttribute('aria-hidden','true');
      ifr.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      ifr.onload=()=>{ setTimeout(()=>{ try{ ifr.contentWindow.focus(); ifr.contentWindow.print(); }catch(e){ try{ window.print(); }catch(_){} }
        setTimeout(()=>{ try{ document.body.removeChild(ifr); }catch(e){} }, 900); }, 400); };
      document.body.appendChild(ifr);
      const d=ifr.contentWindow.document; d.open(); d.write(doc); d.close();
    }catch(e){}
  };

  return (
    <div className="kd-screen" style={{ background:'transparent' }}>
      <div style={{ display:'flex', gap:8, padding:'0 16px 12px' }}>
        {[['today',TH?'วันนี้':'Today'],['all',TH?'ทั้งหมด':'All time']].map(([k,l])=>(
          <button key={k} onClick={()=>setPeriod(k)} className={'kd-chip-btn'+(period===k?' on':'')} style={{ flex:1, justifyContent:'center' }}>{l}</button>
        ))}
      </div>
      <div className="kd-body" style={{ padding:'0 16px 24px' }}>
        {/* net card */}
        <div className="kd-card kd-fadein" style={{ padding:'18px', marginBottom:12, background:'linear-gradient(135deg,var(--brand),#0E9463)', color:'#fff' }}>
          <div style={{ fontSize:13, opacity:.85, fontWeight:600 }}>{TH?'กำไรสุทธิ (รายรับ − รายจ่าย)':'Net (income − expense)'}</div>
          <div className="num" style={{ fontSize:34, fontWeight:700, margin:'2px 0 8px' }}>{money(Math.round(net))}</div>
          <div style={{ display:'flex', gap:10, fontSize:12.5 }}>
            <span style={{ background:'rgba(255,255,255,.2)', padding:'3px 10px', borderRadius:999 }}>{TH?'ต้นทุนขาย':'COGS'} {money(Math.round(cogs))}</span>
            <span style={{ background:'rgba(255,255,255,.2)', padding:'3px 10px', borderRadius:999 }}>{TH?'กำไรขั้นต้น':'Gross'} {money(Math.round(income-cogs))}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:11, marginBottom:14 }}>
          <Stat label={TH?'รายรับ':'Income'} value={money(Math.round(income))} tone="var(--brand-ink)" sub={TH?`${saleRows.length} บิล`:`${saleRows.length} sales`}/>
          <Stat label={TH?'รายจ่าย':'Expense'} value={money(Math.round(expTotal))} tone="var(--danger)" sub={TH?`${expenses.length} รายการ`:`${expenses.length} items`}/>
        </div>
        <button onClick={doPrint} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:14, marginBottom:14 }}>{React.cloneElement(IC.receipt,{size:18})} {TH?'พิมพ์ / บันทึก PDF สรุปนี้':'Print / Save PDF'}</button>
        {/* expense by category */}
        {expTotal>0 && <div className="kd-card" style={{ padding:'16px', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>{TH?'รายจ่ายตามหมวด':'Expense by category'}</div>
          {Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([c,v])=>(
            <div key={c} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, marginBottom:5 }}>
                <span style={{ fontWeight:600 }}>{expCat(c,lang)}</span><span className="num" style={{ fontWeight:700 }}>{money(Math.round(v))}</span></div>
              <div style={{ height:8, background:'var(--bg)', borderRadius:999, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${v/expTotal*100}%`, background:'var(--danger)', borderRadius:999 }}/></div>
            </div>
          ))}
        </div>}
        {/* expense log */}
        <div className="kd-card" style={{ padding:'16px' }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:10 }}>{TH?'รายการรายจ่าย':'Expense log'}</div>
          {expenses.length===0 && <div style={{ fontSize:13, color:'var(--ink-3)', padding:'8px 0' }}>{TH?'ยังไม่มีรายจ่าย':'No expenses yet'}</div>}
          {expenses.map((e,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom: i<expenses.length-1?'1px solid var(--hair)':'none' }}>
              <span className="kd-chip" style={{ background:'var(--bg)', color:'var(--ink-2)' }}>{expCat(e.cat,lang)}</span>
              <div style={{ flex:1, minWidth:0, fontSize:13.5 }}>{e.note||'-'}<span style={{ color:'var(--ink-3)', fontSize:12 }}> · {dispDate(e.date,lang)}</span></div>
              <span className="num" style={{ fontWeight:700, color:'var(--danger)' }}>-{money(Math.round(e.amount))}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:12, lineHeight:1.55 }}>{TH?'รายจ่าย "ค่าวัตถุดิบ" ดึงจากบันทึกซื้อของเข้าอัตโนมัติ · รายจ่ายอื่นมาจากการนำเงินออกในแท็บเงินสด':'Material costs come from stock purchases; other expenses from cash-out entries.'}</div>
      </div>
    </div>
  );
}

/* ══════════════ CASH REGISTER ══════════════ */
function CashScreen({ store, onGoHours, manager }){
  const { lang } = useT(); const TH = lang==='th';
  const { sales, register, openRegister, addCashMove, closeRegister, cashDays } = store;
  const hoursSet = !!(store.shop && store.shop.hoursSet);
  const [floatIn,setFloatIn] = cashState('');
  const [moveSheet,setMoveSheet] = cashState(null);   // 'in' | 'out'
  const [closeSheet,setCloseSheet] = cashState(false);
  const toast = useToast();

  const today = _todayISO();
  // กรองตาม "กะ" (sid) ก่อน — รองรับร้านขายข้ามวัน (เปิด 4 โมง ปิดตี 5) · บิลเก่าที่ไม่มี sid ใช้วันนาฬิกา
  const sid = register.sid;
  const todays = sales.filter(s=> !s.void && (sid ? (s.sid===sid || (!s.sid && (!s.date||s.date===today))) : (!s.date||s.date===today)));
  // สรุปปิดวันใช้ "ยอดลงบัญชีได้จริง" (bookable): ดิจิทัลที่ไม่พบยอด=0 · ยังไม่ตรวจ=ค้าง(ไม่รวม) — กันยอดพร้อมเพย์เพี้ยน
  const dayChk = (typeof validateDayClose==='function') ? validateDayClose(todays) : { pending:[], notFound:[], discrepancy:[], variance:0 };
  const revenue = todays.reduce((a,s)=>{ const b=saleBookable(s); return a+(b==null?0:b); },0);
  const byPay = {}; todays.forEach(s=>{ const b=saleBookable(s); if(b!=null && s.pay!=='platform') byPay[s.pay]=(byPay[s.pay]||0)+b; });
  // ยอดขายรายแพลตฟอร์ม (บิลที่จ่ายผ่านแพลตฟอร์มเดลิเวอรี) → ให้วิ่งเข้าหน้าปิดวัน
  const chLabel=(k)=>{ try{ const m=(store.chanCfg&&typeof chMeta==='function'&&chMeta(store.chanCfg,k))||(typeof CHANNELS!=='undefined'&&CHANNELS[k])||{th:k,en:k}; return m[lang]||m.th||k; }catch(e){ return k; } };
  const byPlatform={}; todays.forEach(s=>{ if(s.pay==='platform'){ const c=s.channel||'platform'; byPlatform[c]=(byPlatform[c]||0)+saleTotal(s); } });
  const platforms = Object.keys(byPlatform).map(k=>({ key:k, label:chLabel(k), exp:byPlatform[k] }));
  const cashSales = byPay.cash||0;
  // cross-channel consistency: Σ byPay (ไม่รวม platform) + Σ platforms(bookable) ต้อง = revenue — จับ double-count/ยอดหาย
  const _sumPay = Object.values(byPay).reduce((a,v)=>a+v,0);
  const _platBookable = todays.reduce((a,s)=>{ if(s.pay!=='platform') return a; const b=saleBookable(s); return a+(b==null?0:b); },0);
  const consChk = { ok: Math.abs((_sumPay+_platBookable)-revenue)<0.01, decomposed:+(_sumPay+_platBookable).toFixed(2), revenue:+revenue.toFixed(2) };
  const moves = register.moves||[];
  const cashIn = moves.filter(m=>m.type==='in').reduce((a,m)=>a+(Number(m.amount)||0),0);
  const cashOut = moves.filter(m=>m.type==='out').reduce((a,m)=>a+(Number(m.amount)||0),0);
  const expectedCash = (Number(register.openFloat)||0) + cashSales + cashIn - cashOut;
  // ออเดอร์ค้าง: ยังทำไม่เสร็จ (new/cooking/ready) หรือยังไม่เก็บเงิน (payLater ค้างจ่าย) — ควรเคลียร์ก่อนปิดวัน
  const orders = store.orders||[];
  const pendingOrders = orders.filter(o=> o.status!=='void' && (['new','cooking','ready'].includes(o.status) || (o.payLater && !o.paid)));
  // กะค้างข้ามวัน: เปิดค้างจากวันก่อน (businessDate ≠ วันนี้) → ต้องปิดกะเก่าก่อนจึงขายวันนี้ได้
  const stale = !!(typeof kdShiftExpired==='function' ? kdShiftExpired(register, store.shop) : (register.businessDate && register.businessDate !== today));
  // ปิดวันของวันนี้ไปแล้ว → บล็อกเปิดกะใหม่ในวันเดิม (เปิดได้เฉพาะ "เปิดวันย้อนหลัง" ด้วยรหัส Office)
  const closedToday = (cashDays||[]).some(d=> d.date===today && !d.auto);
  // ตรวจรหัส Office (ในแอป · ไม่ใช้ window.prompt) → เปิดวันย้อนหลัง · คืน true/false ให้ modal จัดการ UI
  const doReopenDay = async (day, pass)=>{
    if(!pass) return false;
    let ok=false;
    try{ const base=window.KD_API_BASE; if(base){ const r=await fetch(base+'/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pass})}); if(r.ok){ const j=await r.json(); ok=!!(j&&j.ok); } } }catch(e){}
    if(!ok){ try{ ok=(localStorage.getItem('kd_office_pass')||'')===pass; }catch(e){} }
    // รหัสที่ Back Office ออกให้ (code_requests · ใช้ครั้งเดียว)
    if(!ok){ try{ const sid=(store.shop&&store.shop.shopId)||''; if(sid && window.KD_API && window.KD_API.verifyOfficeCode){ const r=await window.KD_API.verifyOfficeCode(sid, pass); ok=!!(r&&r.ok); } }catch(e){} }
    if(!ok){ toast.show(TH?'รหัส Office ไม่ถูกต้อง':'Wrong Office password'); return false; }
    if(store.reopenDay) store.reopenDay(day);
    toast.show(TH?'เปิดวันนี้ใหม่แล้ว':'Reopened today');
    return true;
  };

  if(!register.open){
    // ล็อก: ต้องตั้งเวลาเปิด-ปิดร้านก่อน ถึงจะเปิดกะขายได้ (ระบบจึงรู้ขอบเขตวันขาย — รองรับร้านข้ามวัน)
    if(!hoursSet){
      return (
        <div className="kd-screen">
          <TopBar title={TH?'เงินสด · เปิดร้าน':'Cash · Open shop'} sub={TH?'ตั้งเวลาเปิด-ปิดร้านก่อน':'Set store hours first'}/>
          <div className="kd-body" style={{ padding:'0 18px 24px' }}>
            <div className="kd-card" style={{ padding:'22px 18px', textAlign:'center', marginBottom:14 }}>
              <div style={{ width:64, height:64, borderRadius:999, background:'#FDF0E2', color:'#B26A00', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>{React.cloneElement(IC.clock||IC.store,{size:32})}</div>
              <div style={{ fontSize:17, fontWeight:700, marginBottom:4 }}>{TH?'ยังไม่ได้ตั้งเวลาเปิด-ปิดร้าน':'Store hours not set'}</div>
              <div style={{ fontSize:13.5, color:'var(--ink-3)', marginBottom:18, lineHeight:1.55 }}>{TH?'ก่อนเปิดร้านขาย ต้องตั้งเวลาเปิด-ปิดร้านก่อน — ระบบใช้กำหนดขอบ“วันขาย” (ร้านขายข้ามวันก็นับยอดถูก)':'Set open–close times before starting a shift — this defines the business day (needed for shops open past midnight).'}</div>
              <button onClick={()=>{ if(onGoHours) onGoHours(); }} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15 }}>{React.cloneElement(IC.clock||IC.store,{size:18})} {TH?'ตั้งเวลาเปิด-ปิดร้าน':'Set store hours'}</button>
            </div>
            {!manager && cashDays.length>0 && <ClosedDays cashDays={cashDays} lang={lang} onReopen={doReopenDay} today={today} canReopen={true} shop={store.shop}/>}
          </div>
        </div>
      );
    }
    if(closedToday){
      return (
        <div className="kd-screen">
          <TopBar title={TH?'เงินสด · ปิดวันแล้ว':'Cash · Day closed'} sub={TH?'ปิดวันของวันนี้เรียบร้อยแล้ว':'Today already closed'}/>
          <div className="kd-body" style={{ padding:'0 18px 24px' }}>
            <div className="kd-card" style={{ padding:'22px 18px', textAlign:'center', marginBottom:14 }}>
              <div style={{ width:64, height:64, borderRadius:999, background:'var(--brand-soft)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>{React.cloneElement(IC.receipt,{size:32})}</div>
              <div style={{ fontSize:17, fontWeight:700, marginBottom:4 }}>{TH?'วันนี้ปิดวันแล้ว':'Day already closed'}</div>
              <div style={{ fontSize:13.5, color:'var(--ink-3)', marginBottom:6, lineHeight:1.55 }}>{TH?'ปิดวันของวันนี้เรียบร้อยแล้ว เปิดร้านใหม่ในวันเดิมไม่ได้':'Today has been closed. You can’t open a new shift on the same day.'}</div>
              <div style={{ fontSize:12.5, color:'var(--ink-3)', lineHeight:1.55 }}>{TH?'ถ้าเผลอปิด — กด “เปิดวันนี้ใหม่” ที่ประวัติด้านล่าง (ต้องใช้รหัส Office)':'Closed by mistake? Use “Reopen today” below (requires Office password).'}</div>
            </div>
            {!manager && cashDays.length>0 && <ClosedDays cashDays={cashDays} lang={lang} onReopen={doReopenDay} today={today} canReopen={true} shop={store.shop}/>}
          </div>
        </div>
      );
    }
    return (
      <div className="kd-screen">
        <TopBar title={TH?'เงินสด · เปิดร้าน':'Cash · Open shop'} sub={TH?'ตั้งเงินทอนเริ่มต้นก่อนเริ่มขาย':'Set starting change float'}/>
        <div className="kd-body" style={{ padding:'0 18px 24px' }}>
          <div className="kd-card" style={{ padding:'22px 18px', textAlign:'center', marginBottom:14 }}>
            <div style={{ width:64, height:64, borderRadius:999, background:'var(--brand-soft)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>{React.cloneElement(IC.store,{size:32})}</div>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:4 }}>{TH?'ร้านยังไม่เปิด':'Register closed'}</div>
            <div style={{ fontSize:13.5, color:'var(--ink-3)', marginBottom:18, lineHeight:1.5 }}>{TH?'ใส่จำนวนเงินสดตั้งต้น (เงินทอน) ในลิ้นชัก แล้วกดเปิดร้าน':'Enter the starting cash (change) in the drawer, then open.'}</div>
            <Lbl>{TH?'เงินทอนตั้งต้น':'Starting float'}</Lbl>
            <div style={{ position:'relative', marginBottom:16 }}>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontWeight:600, fontSize:18 }}>฿</span>
              <input className="kd-input num" style={{ paddingLeft:30, fontSize:22, fontWeight:700, textAlign:'center' }} type="number" value={floatIn} onChange={e=>setFloatIn(e.target.value)} placeholder="0"/>
            </div>
            <button onClick={()=>openRegister(floatIn)} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15 }}>{TH?'เปิดร้าน':'Open shop'}</button>
          </div>
          {!manager && cashDays.length>0 && <ClosedDays cashDays={cashDays} lang={lang} onReopen={doReopenDay} today={today} canReopen={true} shop={store.shop}/>}
        </div>
      </div>
    );
  }

  return (
    <div className="kd-screen">
      <TopBar title={TH?'เงินสดวันนี้':'Cash today'} sub={TH?`เปิดร้าน ${new Date(register.openedAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} น. · เงินทอน ${money(register.openFloat)}`:`Since ${new Date(register.openedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}`}/>
      <div className="kd-body" style={{ padding:'0 16px 24px' }}>
        {stale && <div className="kd-card kd-fadein" style={{ padding:'13px 15px', marginBottom:12, background:'#FDF0E2', border:'1px solid #F3D9B0' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#8a5a12', marginBottom:3 }}>{TH?`⚠️ ร้านค้างข้ามวัน (เปิดค้างตั้งแต่วันที่ ${dispDate(register.businessDate,lang)})`:`⚠️ Shift left open (since ${dispDate(register.businessDate,lang)})`}</div>
          <div style={{ fontSize:12.5, color:'#8a5a12', lineHeight:1.5 }}>{TH?'ต้องปิดวันเก่า (ระบุเหตุผล) ก่อน จึงจะเปิดขายวันนี้ได้':'Close this shift (with a reason) before you can sell today.'}</div>
        </div>}
        {/* drawer expected */}
        <div className="kd-card kd-fadein" style={{ padding:'18px', marginBottom:12, background:'linear-gradient(135deg,var(--brand),#0E9463)', color:'#fff' }}>
          <div style={{ fontSize:13, opacity:.85, fontWeight:600 }}>{TH?'เงินสดในลิ้นชัก (คาดว่า)':'Cash in drawer (expected)'}</div>
          <div className="num" style={{ fontSize:34, fontWeight:700, margin:'2px 0 8px' }}>{money(Math.round(expectedCash))}</div>
          <div style={{ fontSize:12.5, opacity:.9 }}>{TH?`เงินทอน ${money(register.openFloat)} + ขายเงินสด ${money(cashSales)} + เข้า ${money(cashIn)} − ออก ${money(cashOut)}`:`float + cash sales + in − out`}</div>
        </div>
        {/* revenue + orders */}
        <div style={{ display:'flex', gap:11, marginBottom:14 }}>
          <Stat label={TH?'ยอดขายวันนี้':'Sales today'} value={money(Math.round(revenue))} tone="var(--brand-ink)" sub={TH?`${todays.length} บิล`:`${todays.length} bills`}/>
          <Stat label={TH?'ขายเงินสด':'Cash sales'} value={money(Math.round(cashSales))} tone="var(--ink)" sub={TH?'เข้าลิ้นชัก':'in drawer'}/>
        </div>
        {/* by payment channel */}
        <div className="kd-card" style={{ padding:'16px', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>{TH?'รับเงินตามช่องทาง':'By payment method'}</div>
          {Object.keys(PAYS).map(k=>{ const v=byPay[k]||0; return (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0' }}>
              <span style={{ color:'var(--ink-3)' }}>{React.cloneElement(PAYS[k].ic,{size:18})}</span>
              <span style={{ flex:1, fontSize:14, fontWeight:600 }}>{PAYS[k][lang]||PAYS[k].th}</span>
              <span className="num" style={{ fontWeight:700, color: v>0?'var(--ink)':'var(--ink-3)' }}>{money(Math.round(v))}</span>
            </div>
          );})}
          {platforms.map(p=>(
            <div key={p.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderTop:'1px solid var(--hair)' }}>
              <span style={{ color:'var(--ink-3)' }}>{React.cloneElement(IC.moto,{size:18})}</span>
              <span style={{ flex:1, fontSize:14, fontWeight:600 }}>{p.label}<span style={{ fontSize:11, color:'var(--ink-3)', fontWeight:500 }}> · {TH?'แพลตฟอร์ม':'platform'}</span></span>
              <span className="num" style={{ fontWeight:700, color:'var(--accent-ink)' }}>{money(Math.round(p.exp))}</span>
            </div>
          ))}
        </div>
        {/* cash in/out buttons */}
        <div style={{ display:'flex', gap:10, marginBottom:14 }}>
          <button onClick={()=>setMoveSheet('in')} className="kd-btn" style={{ flex:1, background:'var(--brand-soft)', color:'var(--brand-ink)', padding:14 }}>{React.cloneElement(IC.plus,{size:17})} {TH?'นำเงินเข้า':'Cash in'}</button>
          <button onClick={()=>setMoveSheet('out')} className="kd-btn" style={{ flex:1, background:'#FCECE8', color:'var(--danger)', padding:14 }}>{React.cloneElement(IC.minus,{size:17})} {TH?'เบิก / จ่าย':'Pay out'}</button>
        </div>
        {/* moves log */}
        {moves.length>0 && <div className="kd-card" style={{ padding:'16px', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>{TH?'เงินเข้า–ออกวันนี้':'Cash movements'}</div>
          {moves.map((m,i)=>(
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom: i<moves.length-1?'1px solid var(--hair)':'none' }}>
              <span style={{ width:30, height:30, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center',
                background: m.type==='in'?'var(--brand-soft)':'#FCECE8', color: m.type==='in'?'var(--brand)':'var(--danger)' }}>{React.cloneElement(m.type==='in'?IC.plus:IC.minus,{size:15})}</span>
              <div style={{ flex:1, minWidth:0, fontSize:13.5 }}>{m.note||(m.type==='in'?(TH?'เงินเข้า':'In'):(TH?'เงินออก':'Out'))}{m.by?<span style={{ color:'var(--ink-3)', fontWeight:400 }}> · {m.by}</span>:null}{m.cat&&m.type==='out'?<span style={{ color:'var(--ink-3)', fontSize:12 }}> · {expCat(m.cat,lang)}</span>:''}<span style={{ color:'var(--ink-3)', fontSize:12 }}> · {m.t}</span></div>
              <span className="num" style={{ fontWeight:700, color: m.type==='in'?'var(--brand-ink)':'var(--danger)' }}>{m.type==='in'?'+':'-'}{money(Math.round(m.amount))}</span>
            </div>
          ))}
        </div>}
        {!consChk.ok && <div style={{ display:'flex', gap:9, alignItems:'flex-start', background:'#FCECE8', color:'var(--danger)', borderRadius:12, padding:'11px 13px', marginBottom:10, fontSize:12.5, lineHeight:1.55, fontWeight:600 }}>
          <span style={{ fontSize:16, lineHeight:1 }}>⚠️</span>
          <div>{TH?<>ยอดตามช่องทางไม่ตรงกับยอดรวม (ช่องทาง {money(Math.round(consChk.decomposed))} · รวม {money(Math.round(consChk.revenue))}) — อาจมีบิลนับซ้ำ/ยอดหาย โปรดตรวจก่อนปิดวัน</>:<>Channel breakdown ≠ total ({money(Math.round(consChk.decomposed))} vs {money(Math.round(consChk.revenue))}) — possible double-count/missing bill</>}</div>
        </div>}
        {(dayChk.pending.length>0 || dayChk.notFound.length>0 || dayChk.discrepancy.length>0) && <div style={{ display:'flex', gap:9, alignItems:'flex-start', background:'#FFF4D6', color:'#8A6100', borderRadius:12, padding:'11px 13px', marginBottom:10, fontSize:12.5, lineHeight:1.55 }}>
          <span style={{ fontSize:16, lineHeight:1 }}>🧾</span>
          <div>{TH?<>ยอดพร้อมเพย์/โอน: {dayChk.pending.length>0 && <><b>{dayChk.pending.length}</b> บิลยัง<b>ไม่ได้ตรวจยอด</b> (ไม่รวมในยอดปิดวันนี้) · </>}{dayChk.notFound.length>0 && <><b>{dayChk.notFound.length}</b> บิล<b>ไม่พบยอดเงิน</b> (นับเป็น 0) · </>}{dayChk.discrepancy.length>0 && <><b>{dayChk.discrepancy.length}</b> บิลยอดขาด/เกิน (รวม {dayChk.variance>0?'+':''}{money(Math.round(dayChk.variance))}) · </>}ตรวจให้ครบที่หน้า <b>สรุป → ตรวจสลิป</b> ก่อนปิดวัน</>:<>PromptPay/transfer: {dayChk.pending.length>0 && <><b>{dayChk.pending.length}</b> unverified (excluded today) · </>}{dayChk.notFound.length>0 && <><b>{dayChk.notFound.length}</b> not found (counted 0) · </>}{dayChk.discrepancy.length>0 && <><b>{dayChk.discrepancy.length}</b> short/over ({dayChk.variance>0?'+':''}{money(Math.round(dayChk.variance))}) · </>}verify on <b>Summary</b> first</>}</div>
        </div>}
        {pendingOrders.length>0 && <div style={{ display:'flex', gap:9, alignItems:'flex-start', background:'#FFF4D6', color:'#8A6100', borderRadius:12, padding:'11px 13px', marginBottom:10, fontSize:12.5, lineHeight:1.55 }}>
          <span style={{ fontSize:16, lineHeight:1 }}>⚠️</span>
          <div>{TH?<>ยังมีออเดอร์ค้างอยู่ <b>{pendingOrders.length}</b> รายการ (ยังทำไม่เสร็จ หรือยังไม่เก็บเงิน) — ควรกด “ปิดออเดอร์” หรือ “ยกเลิกออเดอร์” ที่หน้า <b>ออเดอร์</b> ให้เรียบร้อยก่อนปิดวัน</>:<><b>{pendingOrders.length}</b> order(s) still open (unfinished or unpaid) — complete or cancel them on the <b>Orders</b> tab before closing.</>}</div>
        </div>}
        <button onClick={()=>{ if(pendingOrders.length>0 && !window.confirm(TH?`ยังมีออเดอร์ค้างอยู่ ${pendingOrders.length} รายการ (ยังทำไม่เสร็จ / ยังไม่เก็บเงิน)\n\nควรปิดออเดอร์หรือยกเลิกที่หน้า “ออเดอร์” ก่อน\n\nยืนยันปิดวันเลยหรือไม่?`:`${pendingOrders.length} order(s) still open (unfinished / unpaid).\n\nComplete or cancel them on the Orders tab first.\n\nClose day anyway?`)) return;
          const _cg=(store.pay&&store.pay.closeGate)||'warn'; const _unv=dayChk.pending.length;
          if(_cg!=='off' && _unv>0){ const _msg=TH?`ยังมีบิลพร้อมเพย์/โอน ${_unv} บิลที่ยังไม่ได้ตรวจยอด — จะไม่ถูกรวมในยอดปิดวัน\n\nควรตรวจสลิปให้ครบที่หน้า “สรุป” ก่อน`:`${_unv} PromptPay/transfer bill(s) not verified — they will be excluded from today's close.\n\nVerify slips on the “Summary” tab first.`;
            if(_cg==='block'){ window.alert(_msg); return; }
            if(!window.confirm(_msg+(TH?`\n\nยืนยันปิดวันเลยหรือไม่?`:`\n\nClose day anyway?`))) return; }
          setCloseSheet(true); }} className="kd-btn kd-btn-block" style={{ padding:15, background: stale?'#B26A00':'var(--ink)', color:'#fff' }}>{React.cloneElement(IC.receipt,{size:18})} {stale?(TH?`ปิดวันเก่า (${dispDate(register.businessDate,lang)})`:`Close old shift`):(TH?'ปิดวัน / สรุปยอด':'Close day')}</button>
        {cashDays.length>0 && <div style={{ height:16 }}/>}
        {cashDays.length>0 && <ClosedDays cashDays={cashDays} lang={lang}/>}
      </div>

      {moveSheet && <CashMoveSheet type={moveSheet} maxOut={expectedCash} onSave={(mv)=>{ addCashMove(mv); setMoveSheet(null); toast.show(TH?'บันทึกแล้ว':'Saved'); }} onClose={()=>setMoveSheet(null)} />}
      {closeSheet && <CloseDaySheet expected={expectedCash} requireReason={stale} bizDate={register.businessDate} data={{ openFloat:register.openFloat, revenue, byPay, platforms, cashSales, cashIn, cashOut, orders:todays.length, moves, businessDate:register.businessDate, openedAt:register.openedAt }}
        onConfirm={(rec)=>{ closeRegister(rec); setCloseSheet(false); toast.show(TH?'ปิดวันเรียบร้อย':'Day closed'); }} onClose={()=>setCloseSheet(false)} />}
      {toast.node}
    </div>
  );
}

function ClosedDays({ cashDays, lang, onReopen, today, canReopen, shop }){
  const TH = lang==='th';
  const [openId,setOpenId] = cashState(null);
  const [codeFor,setCodeFor] = cashState(null);
  return (
    <div className="kd-card" style={{ padding:'16px' }}>
      <div style={{ fontWeight:700, fontSize:15, marginBottom:10 }}>{TH?'ประวัติปิดวัน':'Closed days'}</div>
      {cashDays.map((d,i)=>{ const mv=d.moves||[]; const open=openId===d.id; return (
        <div key={d.id} style={{ borderBottom: i<cashDays.length-1?'1px solid var(--hair)':'none' }}>
        <div onClick={()=>setOpenId(open?null:d.id)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', cursor:'pointer' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>{dispDate(d.date,lang)}
              {d.kind==='holiday' && <span style={{ fontSize:10.5, fontWeight:700, color:'var(--ink-3)', background:'var(--bg)', padding:'2px 7px', borderRadius:999 }}>{TH?'หยุดตามกำหนด':'Scheduled off'}</span>}
              {d.kind==='noopen' && <span style={{ fontSize:10.5, fontWeight:700, color:'var(--ink-3)', background:'var(--bg)', padding:'2px 7px', borderRadius:999 }}>{TH?'ไม่ได้เปิดร้าน':'Not opened'}</span>}
              {d.backdated && <span style={{ fontSize:10.5, fontWeight:700, color:'#8a5a12', background:'#FDF0E2', padding:'2px 7px', borderRadius:999 }}>{TH?'ปิดย้อนหลัง':'Backdated'}</span>}
            </div>
            {d.reason && <div style={{ fontSize:11.5, color:'#8a5a12' }}>{TH?'เหตุผล: ':'Reason: '}{d.reason}</div>}
            <div style={{ fontSize:12, color:'var(--ink-3)' }} className="num">{TH?'ยอดขาย':'Sales'} {money(Math.round(d.revenue))} · {d.orders} {TH?'บิล':'bills'}{d.withdrawn!=null?` · ${TH?'นำออก':'out'} ${money(Math.round(d.withdrawn))}`:''}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div className="num" style={{ fontWeight:700, fontSize:14 }}>{money(Math.round(d.countedCash))}</div>
            <div style={{ fontSize:11, fontWeight:700, color: Math.round(d.diff)===0?'var(--brand)':(d.diff>0?'var(--accent)':'var(--danger)') }}>{d.diff>0?'+':''}{money(Math.round(d.diff))} {Math.round(d.diff)===0?(TH?'ตรง':'exact'):(d.diff>0?(TH?'เกิน':'over'):(TH?'ขาด':'short'))}</div>
          </div>
          <span style={{ color:'var(--ink-3)', transform:open?'rotate(180deg)':'none', transition:'.15s' }}>{React.cloneElement(IC.chevDown,{size:16})}</span>
        </div>
        {open && <div className="kd-fadein" style={{ padding:'2px 0 12px' }}>
          {onReopen && canReopen && today && d.date===today && !d.auto && <button onClick={()=>setCodeFor(d)} className="kd-btn kd-btn-block" style={{ padding:'11px', marginBottom:10, background:'#FDF0E2', color:'#8a5a12', fontSize:13 }}>{React.cloneElement(IC.receipt,{size:16})} {TH?'เปิดวันนี้ใหม่ (ต้องรหัส Office · กรณีเผลอปิด)':'Reopen today (Office password)'}</button>}
          <div style={{ background:'var(--bg)', borderRadius:12, padding:'10px 13px' }}>
            {[[TH?'เงินทอนตั้งต้น':'Starting float', d.openFloat],[TH?'ขายเงินสด':'Cash sales', d.cashSales],[TH?'นำเงินเข้า':'Cash in', d.cashIn],[TH?'เบิก / จ่ายระหว่างวัน':'Paid out (day)', d.cashOut!=null?-d.cashOut:null],[TH?'เก็บเงินเข้าเซฟ / ธนาคาร':'Deposit', d.withdrawn!=null?-d.withdrawn:null],[TH?'เหลือยกไปวันถัดไป':'Left as float', d.leftFloat]].filter(r=>r[1]!=null).map(([l,v],j)=>(
              <div key={j} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0' }}><span style={{ color:'var(--ink-2)' }}>{l}</span><span className="num" style={{ fontWeight:600, color: v<0?'var(--danger)':'var(--ink)' }}>{v<0?'-':''}{money(Math.abs(Math.round(v)))}</span></div>
            ))}
          </div>
          {mv.length>0 && <div style={{ marginTop:10 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:'var(--ink-2)', marginBottom:5 }}>{TH?'รายการเงินเข้า–ออก':'Cash movements'}</div>
            {mv.map((m,k)=>(
              <div key={m.id||k} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom: k<mv.length-1?'1px solid var(--hair)':'none' }}>
                <span style={{ width:22, height:22, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', background: m.type==='in'?'var(--brand-soft)':'#FCECE8', color: m.type==='in'?'var(--brand)':'var(--danger)' }}>{React.cloneElement(m.type==='in'?IC.plus:IC.minus,{size:12})}</span>
                <span style={{ flex:1, minWidth:0, fontSize:12.5 }}>{m.note||(m.type==='in'?(TH?'เงินเข้า':'In'):(TH?'เงินออก':'Out'))}{m.cat&&m.type==='out'?<span style={{ color:'var(--ink-3)' }}> · {expCat(m.cat,lang)}</span>:''}</span>
                <span style={{ fontSize:11, color:'var(--ink-3)' }} className="num">{m.t}</span>
                <span className="num" style={{ fontWeight:700, fontSize:12.5, color: m.type==='in'?'var(--brand-ink)':'var(--danger)' }}>{m.type==='in'?'+':'-'}{money(Math.round(m.amount))}</span>
              </div>
            ))}
          </div>}
        </div>}
        </div>
      ); })}
      {codeFor && <OfficeCodeSheet day={codeFor} shop={shop} lang={lang} onClose={()=>setCodeFor(null)} onSubmit={(pass)=>onReopen(codeFor, pass)} />}
    </div>
  );
}

/* ใส่รหัส Office (ในแอป) — เปิดวันย้อนหลัง + ติดต่อขอรหัสทาง LINE OA (Back Office ออกรหัสให้) */
function OfficeCodeSheet({ day, shop, lang, onClose, onSubmit }){
  const TH = lang==='th';
  const [pin,setPin] = cashState('');
  const [busy,setBusy] = cashState(false);
  const [reqState,setReqState] = cashState('idle');   // idle | sending | sent | issued
  const OA = 'https://line.me/R/ti/p/@188dfiog';
  const requestInApp = async ()=>{ const sid=(shop&&shop.shopId)||''; if(!sid || !(window.KD_API&&window.KD_API.createCodeRequest)){ contact(); return; } setReqState('sending'); try{ await window.KD_API.createCodeRequest({ shopId:sid, shopName:(shop&&shop.name)||'', kind:'reopen' }); setReqState('sent'); }catch(e){ setReqState('idle'); } };
  React.useEffect(()=>{ const sid=(shop&&shop.shopId)||''; if(reqState!=='sent'||!sid||!(window.KD_API&&window.KD_API.listCodeRequests)) return; let alive=true; const t=setInterval(async()=>{ try{ const rows=await window.KD_API.listCodeRequests({ shopId:sid, status:'issued' }); if(alive && rows && rows.length) setReqState('issued'); }catch(e){} },5000); return ()=>{ alive=false; clearInterval(t); }; },[reqState]);
  const submit = async ()=>{ if(!pin.trim()||busy) return; setBusy(true); let ok=false; try{ ok=await onSubmit(pin.trim()); }catch(e){} setBusy(false); if(ok) onClose(); };
  const contact = ()=>{
    const sName=(shop&&shop.name)||''; const sid=(shop&&shop.shopId)||'';
    const msg = TH?`ขอรหัส Office เปิดวันย้อนหลัง\nร้าน: ${sName||'-'}\nรหัสร้าน: ${sid||'-'}`:`Requesting Office code (reopen day)\nShop: ${sName||'-'}\nID: ${sid||'-'}`;
    try{ navigator.clipboard.writeText(msg); }catch(e){}
    const w=window.open(OA,'_blank','noopener'); if(!w){ try{ location.href=OA; }catch(e){} }
  };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:120, background:'rgba(11,30,24,.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} className="kd-pop" style={{ background:'#fff', width:'100%', maxWidth:360, borderRadius:20, padding:'22px 20px' }}>
        <div style={{ width:52,height:52,borderRadius:999,background:'#FDF0E2',color:'#B26A00',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px' }}>{React.cloneElement(IC.receipt,{size:26})}</div>
        <div style={{ fontSize:17, fontWeight:800, textAlign:'center', marginBottom:4 }}>{TH?'ใส่รหัส Office':'Office code'}</div>
        <div style={{ fontSize:12.5, color:'var(--ink-3)', textAlign:'center', marginBottom:16, lineHeight:1.5 }}>{TH?'เปิดวันนี้ใหม่ กรณีเผลอปิดกลางวัน — ขอรหัสจากทีม Back Office':'Reopen today if closed by mistake — get the code from Back Office'}</div>
        <input className="kd-input num" autoFocus type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') submit(); }} placeholder={TH?'รหัส Office':'Office code'} style={{ textAlign:'center', letterSpacing:'3px', fontSize:18, fontWeight:700, marginBottom:12 }}/>
        <button onClick={submit} disabled={!pin.trim()||busy} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:14, opacity:(!pin.trim()||busy)?.6:1 }}>{busy?(TH?'กำลังตรวจ…':'Checking…'):(TH?'ยืนยัน':'Confirm')}</button>
        <div style={{ display:'flex', alignItems:'center', gap:10, margin:'16px 0 12px' }}><div style={{ flex:1, height:1, background:'var(--hair)' }}/><span style={{ fontSize:11.5, color:'var(--ink-3)' }}>{TH?'ยังไม่มีรหัส?':'No code?'}</span><div style={{ flex:1, height:1, background:'var(--hair)' }}/></div>
        {reqState==='issued'
          ? <div style={{ background:'var(--brand-soft)', color:'var(--brand-ink)', borderRadius:12, padding:'11px 13px', fontSize:12.5, fontWeight:700, textAlign:'center', lineHeight:1.5 }}>{TH?'✓ Back Office ออกรหัสแล้ว — เจ้าของร้านได้รับรหัสทาง LINE · นำมากรอกด้านบน':'✓ Code issued — owner got it on LINE · enter it above'}</div>
          : reqState==='sent'
          ? <div style={{ background:'#FFF7E6', color:'#8a5a12', borderRadius:12, padding:'11px 13px', fontSize:12.5, fontWeight:700, textAlign:'center', lineHeight:1.5 }}>{TH?'⏳ ส่งคำขอแล้ว — รอ Back Office ออกรหัส (แจ้งเตือนทีมแล้ว)':'⏳ Request sent — waiting for Back Office'}</div>
          : <button onClick={requestInApp} disabled={reqState==='sending'} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:13, opacity:reqState==='sending'?.6:1 }}>{reqState==='sending'?(TH?'กำลังส่งคำขอ…':'Sending…'):(TH?'ขอรหัสในแอป (แจ้ง Back Office)':'Request code in-app')}</button>}
        <button onClick={contact} className="kd-btn kd-btn-block" style={{ padding:12, marginTop:8, background:'#06C755', color:'#fff', fontWeight:700 }}>{TH?'หรือติดต่อทาง LINE':'Or contact via LINE'}</button>
        <button onClick={onClose} style={{ border:'none', background:'transparent', color:'var(--ink-3)', fontFamily:'var(--font)', fontSize:13, width:'100%', padding:'11px 0 0', cursor:'pointer' }}>{TH?'ยกเลิก':'Cancel'}</button>
      </div>
    </div>
  );
}

/* cash in/out entry */
function CashMoveSheet({ type, onSave, onClose, maxOut }){
  const { lang } = useT(); const TH = lang==='th';
  const isIn = type==='in';
  const [amount,setAmount] = cashState('');
  const [note,setNote] = cashState('');
  const [cat,setCat] = cashState('other');
  return (
    <Sheet open={true} onClose={onClose} height="72%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{isIn?(TH?'นำเงินเข้าลิ้นชัก':'Cash in'):(TH?'เบิก / จ่ายระหว่างวัน':'Pay out (during day)')}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        <Lbl>{TH?'จำนวนเงิน':'Amount'}</Lbl>
        <div style={{ position:'relative', marginBottom:16 }}>
          <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontWeight:600, fontSize:18 }}>฿</span>
          <input className="kd-input num" style={{ paddingLeft:30, fontSize:22, fontWeight:700 }} type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" autoFocus/>
        </div>
        {!isIn && maxOut!=null && Number(amount)>maxOut && <div style={{ fontSize:12.5, color:'var(--danger)', margin:'-8px 0 14px', fontWeight:600 }}>{TH?`นำเงินออกเกินเงินสดในลิ้นชัก (มี ${money(Math.round(maxOut))})`:`Exceeds drawer cash (${money(Math.round(maxOut))})`}</div>}
        {!isIn && <div style={{ background:'#FCECE8', color:'#9a3412', borderRadius:10, padding:'9px 12px', fontSize:12, lineHeight:1.5, margin:'-4px 0 14px' }}>{TH?'ใช้บันทึกเงินที่หยิบไปใช้จ่ายระหว่างวัน เช่น ซื้อของ จ่ายค่าส่ง — ไม่ใช่การเก็บเงินเข้าเซฟตอนปิดวัน':'For cash spent during the day (buying supplies, delivery, etc.) — not the end-of-day deposit.'}</div>}
        {!isIn && <>
          <Lbl>{TH?'หมวดรายจ่าย':'Category'}</Lbl>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:16 }}>
            {EXP_CATS.map(c=>(<button key={c.id} onClick={()=>setCat(c.id)} style={{ border:'none', cursor:'pointer', padding:'8px 13px', borderRadius:999,
              fontFamily:'var(--font)', fontWeight:600, fontSize:13, background: cat===c.id?'var(--brand)':'var(--bg)', color: cat===c.id?'#fff':'var(--ink-2)' }}>{c[lang]||c.th}</button>))}
          </div>
        </>}
        <Field label={TH?'หมายเหตุ':'Note'}><input className="kd-input" value={note} onChange={e=>setNote(e.target.value)} placeholder={isIn?(TH?'เช่น เติมเงินทอน':'e.g. add change'):(TH?'เช่น จ่ายค่าผัก':'e.g. pay for veg')}/></Field>
      </div>
      <div style={{ padding:'12px 20px 0' }}>
        <button onClick={()=>onSave({ type, amount:Number(amount)||0, note, cat: isIn?null:cat })} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15 }} disabled={!(Number(amount)>0) || (!isIn && maxOut!=null && Number(amount)>maxOut)}>{TH?'บันทึก':'Save'}</button>
      </div>
    </Sheet>
  );
}

/* close day: count actual cash + reconcile each payment channel vs expected */
const CLOSE_REASONS = [['forgot','ลืมปิดวัน','Forgot to close'],['multiday','ร้านปิดหลายวัน','Store closed several days'],['keying','คีย์บิลยังไม่ครบ','Bills not fully keyed'],['other','อื่นๆ','Other']];
function CloseDaySheet({ expected, data, onConfirm, onClose, requireReason, bizDate }){
  const { lang } = useT(); const TH = lang==='th';
  const [counted,setCounted] = cashState('');
  const [withdraw,setWithdraw] = cashState('');
  const [actuals,setActuals] = cashState({});
  const [reason,setReason] = cashState('');
  const [reasonNote,setReasonNote] = cashState('');
  const byPay = data.byPay||{};
  const _nonCash = Object.keys(PAYS).filter(k=>k!=='cash' && (byPay[k]||0)>0);
  let items = _nonCash.map(k=>({ key:k, label:(PAYS[k][lang]||PAYS[k].th), exp:byPay[k]||0 }));
  const setA=(k,v)=>setActuals(o=>({ ...o, [k]:v }));
  const sysRows=[ ...Object.keys(PAYS).filter(k=>(byPay[k]||0)>0).map(k=>({ label:(PAYS[k][lang]||PAYS[k].th), v:byPay[k]||0 })), ...(data.platforms||[]).map(p=>({ label:p.label+(TH?' · แพลตฟอร์ม':' · platform'), v:p.exp||0 })) ];
  const diff = (Number(counted)||0) - expected;
  const wd = Number(withdraw)||0;
  const leftFloat = (Number(counted)||0) - wd;
  const has = counted!=='' && withdraw!=='' && wd>=0 && wd<=(Number(counted)||0);
  const reasonOk = !requireReason || (reason && (reason!=='other' || reasonNote.trim()));
  const reasonText = requireReason ? (reason==='other' ? reasonNote.trim() : ((CLOSE_REASONS.find(r=>r[0]===reason)||[])[TH?1:2]||'')) : '';
  return (
    <Sheet open={true} onClose={onClose} height="92%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{TH?'ปิดวัน / สรุปยอด':'Close day'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        <div className="kd-card" style={{ padding:'14px 16px', marginBottom:14, boxShadow:'none', background:'var(--bg)' }}>
          {[[TH?'เงินทอนตั้งต้น':'Starting float', data.openFloat],[TH?'ขายเงินสด':'Cash sales', data.cashSales],[TH?'นำเงินเข้า':'Cash in', data.cashIn],[TH?'เบิก / จ่ายระหว่างวัน':'Paid out (day)', -data.cashOut]].map(([l,v],i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:14, padding:'5px 0' }}><span style={{ color:'var(--ink-2)' }}>{l}</span><span className="num" style={{ fontWeight:600 }}>{v<0?'-':''}{money(Math.abs(Math.round(v)))}</span></div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700, paddingTop:8, marginTop:4, borderTop:'1px solid var(--hair)' }}>
            <span>{TH?'เงินสดที่ควรมี':'Expected cash'}</span><span className="num">{money(Math.round(expected))}</span></div>
        </div>
        <Lbl>{TH?'นับเงินสดจริงในลิ้นชัก':'Counted cash in drawer'}</Lbl>
        <div style={{ position:'relative', marginBottom:10 }}>
          <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontWeight:600, fontSize:18 }}>฿</span>
          <input className="kd-input num" style={{ paddingLeft:30, fontSize:22, fontWeight:700, textAlign:'center' }} type="number" value={counted} onChange={e=>setCounted(e.target.value)} placeholder="0" autoFocus/>
        </div>
        {has && <div className="kd-card" style={{ padding:'12px 16px', boxShadow:'none', textAlign:'center', marginBottom:14,
          background: Math.round(diff)===0?'var(--brand-softer)':(diff>0?'var(--accent-soft)':'#FCECE8') }}>
          <div style={{ fontSize:12.5, color:'var(--ink-2)', fontWeight:600 }}>{TH?'ผลต่างเงินสด (จริง − ควรมี)':'Cash difference'}</div>
          <div className="num" style={{ fontSize:24, fontWeight:700, marginTop:2, color: Math.round(diff)===0?'var(--brand-ink)':(diff>0?'var(--accent-ink)':'var(--danger)') }}>{diff>0?'+':''}{money(Math.round(diff))}</div>
          <div style={{ fontSize:12.5, fontWeight:700, color: Math.round(diff)===0?'var(--brand)':(diff>0?'var(--accent-ink)':'var(--danger)') }}>{Math.round(diff)===0?(TH?'เงินตรงพอดี ✓':'Exact ✓'):(diff>0?(TH?'เงินเกิน':'Over'):(TH?'เงินขาด':'Short'))}</div>
        </div>}
        <div style={{ height:6 }}/>
        <Lbl>{TH?'เก็บเงินเข้าเซฟ / ธนาคาร (นำออกจากลิ้นชัก)':'Deposit to safe / bank (remove from drawer)'}</Lbl>
        <div style={{ fontSize:12, color:'var(--ink-3)', margin:'-4px 0 10px', lineHeight:1.5 }}>{TH?'ยอดเงินสดที่หยิบออกจากลิ้นชักตอนนี้เพื่อเก็บเข้าเซฟ/ฝากธนาคาร — คนละอย่างกับ “เบิก/จ่ายระหว่างวัน” ที่หน้าเงินสด':'Cash you take out now to bank / keep in the safe — different from “pay out during the day.”'}</div>
        <div style={{ position:'relative', marginBottom:6 }}>
          <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontWeight:600, fontSize:18 }}>฿</span>
          <input className="kd-input num" style={{ paddingLeft:30, fontSize:20, fontWeight:700, textAlign:'center' }} type="number" value={withdraw} onChange={e=>setWithdraw(e.target.value)} placeholder="0" disabled={!counted}/>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom: has?8:2 }}>
          <button onClick={()=>setWithdraw(String(Math.max(0,Math.round((Number(counted)||0)-(Number(data.openFloat)||0)))))} disabled={!counted} className="kd-btn" style={{ flex:1, background:'var(--brand-soft)', color:'var(--brand-ink)', padding:'9px', fontSize:12.5, opacity:counted?1:.5 }}>{TH?'นำออกเฉพาะยอดขาย (เหลือเงินทอน)':'Keep float'}</button>
          <button onClick={()=>setWithdraw(String(Math.round(Number(counted)||0)))} disabled={!counted} className="kd-btn" style={{ flex:1, background:'var(--brand-soft)', color:'var(--brand-ink)', padding:'9px', fontSize:12.5, opacity:counted?1:.5 }}>{TH?'นำออกทั้งหมด':'Withdraw all'}</button>
        </div>
        {has && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--ink-2)', padding:'2px 4px 12px' }}><span>{TH?'เงินสดเหลือในลิ้นชัก (ยกไปวันถัดไป)':'Left in drawer (next float)'}</span><span className="num" style={{ fontWeight:700, color:'var(--brand-ink)' }}>{money(Math.round(leftFloat))}</span></div>}
        {counted && withdraw==='' && <div style={{ fontSize:12, color:'var(--danger)', fontWeight:600, padding:'0 4px 10px' }}>{TH?'* ต้องระบุยอดนำเงินสดออกก่อนปิดร้าน':'* Withdraw amount required to close'}</div>}
        <Lbl>{TH?'รับเงินตามช่องทาง (ระบบ)':'By channel (system)'}</Lbl>
        <div className="kd-card" style={{ padding:'6px 14px', boxShadow:'none', background:'var(--bg)', marginBottom:14 }}>
          {sysRows.length===0 && <div style={{ fontSize:13, color:'var(--ink-3)', padding:'8px 0' }}>{TH?'ยังไม่มียอดขาย':'No sales'}</div>}
          {sysRows.map((r,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom: i<sysRows.length-1?'1px solid var(--hair)':'none' }}>
              <span style={{ fontSize:14, fontWeight:600 }}>{r.label}</span>
              <span className="num" style={{ fontWeight:700 }}>{money(Math.round(r.v))}</span>
            </div>
          ))}
        </div>
        {requireReason && <div style={{ marginBottom:14 }}>
          <div style={{ background:'#FDF0E2', color:'#8a5a12', borderRadius:10, padding:'9px 12px', fontSize:12.5, lineHeight:1.5, marginBottom:10 }}>{TH?`กำลังปิดวันย้อนหลังของวันที่ ${dispDate(bizDate,lang)} — โปรดระบุเหตุผล`:`Backdated close for ${dispDate(bizDate,lang)} — reason required`}</div>
          <Lbl>{TH?'เหตุผลที่ปิดย้อนหลัง':'Reason for backdated close'}</Lbl>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {CLOSE_REASONS.map(([k,th,en])=>(
              <button key={k} onClick={()=>setReason(k)} className="kd-btn" style={{ justifyContent:'flex-start', padding:'11px 14px', fontSize:14, background: reason===k?'var(--brand-soft)':'var(--bg)', color: reason===k?'var(--brand-ink)':'var(--ink-2)', border: reason===k?'1.5px solid var(--brand)':'1.5px solid var(--hair-2)' }}>{TH?th:en}</button>
            ))}
          </div>
          {reason==='other' && <input className="kd-input" style={{ marginTop:8 }} value={reasonNote} onChange={e=>setReasonNote(e.target.value)} placeholder={TH?'พิมพ์เหตุผล':'Type reason'}/>}
        </div>}
        <div style={{ fontSize:12, color:'var(--ink-3)', marginBottom:12, lineHeight:1.55 }}>{TH?'ยอดพร้อมเพย์/โอน ตรวจสลิปทีละบิลได้ที่หน้า “สรุป” · เมื่อปิดวัน ระบบจะบันทึกสรุปยอด (เงินสด + ทุกช่องทาง) แล้วรีเซ็ตลิ้นชักสำหรับวันถัดไป':'Verify PromptPay slips per-bill on the “Reports” tab · closing saves the summary (cash + all channels) and resets the drawer.'}</div>
      </div>
      <div style={{ padding:'12px 20px 0' }}>
        <button onClick={()=>{ const actualByPay={}; items.forEach(ch=>{ if(actuals[ch.key]!==''&&actuals[ch.key]!=null) actualByPay[ch.key]=Number(actuals[ch.key])||0; });
          if(wd===0 && (Number(counted)||0)>0 && !window.confirm(TH?`ยังไม่ได้เก็บเงินเข้าเซฟ/ธนาคาร — เงินสดทั้งหมด ${money(Number(counted)||0)} จะเหลือเป็นเงินทอนวันถัดไป\n\nยืนยันปิดวันโดยไม่เก็บเงินออก?`:`No cash deposited — all ${money(Number(counted)||0)} will carry to tomorrow as float.\n\nClose day without depositing?`)) return;
          onConfirm({ date:(data.businessDate||_todayISO()), openedAt:(data.openedAt||null), reason:reasonText, reasonKey:(requireReason?reason:''), backdated:!!requireReason, openFloat:data.openFloat, revenue:data.revenue, byPay:data.byPay, platforms:data.platforms, actualByPay, cashSales:data.cashSales, cashIn:data.cashIn, cashOut:data.cashOut, orders:data.orders, moves:data.moves, expectedCash:expected, countedCash:Number(counted)||0, withdrawn:wd, leftFloat, diff, closedAt:Date.now() }); }}
          className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15 }} disabled={!(has && reasonOk)}>{TH?'ยืนยันปิดวัน':'Confirm close'}</button>
      </div>
    </Sheet>
  );
}

Object.assign(window, { ReportsScreen, FinanceScreen, CashScreen, CashMoveSheet, CloseDaySheet, ClosedDays });
