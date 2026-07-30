// kaidee-quote.jsx — Quotation builder (ใบเสนอราคา): pick items, VAT/no-VAT, print / save PDF
const { useState:qState } = React;

const qMoney = (n)=> '฿'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2});
function Lbl({ children }){ return <div style={{ fontSize:13, fontWeight:600, color:'var(--ink-2)', margin:'0 2px 6px' }}>{children}</div>; }

function QuotationScreen({ menu, shop, pay, raw, costMode, purchases, addPurchase, addRaw, quotes, addQuote, updateQuote, deleteQuote, onClose }){
  const { lang } = useT(); const TH = lang==='th';
  const toast = useToast();
  const today = new Date();
  const [cust,setCust]   = qState('');
  const [caddr,setCaddr] = qState('');
  const [date,setDate]   = qState(today.toISOString().slice(0,10));
  const [validDays,setValidDays] = qState(7);
  const [vat,setVat]     = qState(false);
  const [note,setNote]   = qState('');
  const [shopName,setShopName] = qState((shop&&shop.name)||'ร้านของฉัน');
  const [shopAddr,setShopAddr] = qState((shop&&shop.address)||'');
  const [issuer,setIssuer] = qState((shop&&shop.name)||'');
  const [phone,setPhone]   = qState((shop&&shop.phone)||'');
  const [bankInfo,setBankInfo] = qState(()=>{ const p=pay||{}; const parts=[]; if(p.bank||p.acct) parts.push([p.bank,p.acct].filter(Boolean).join(' ')); if(p.promptpay) parts.push((TH?'พร้อมเพย์ ':'PromptPay ')+p.promptpay); return parts.join(' · '); });
  const [lines,setLines] = qState([]);
  const [pickOpen,setPickOpen] = qState(false);
  const [status,setStatus] = qState('pending');
  const [histOpen,setHistOpen] = qState(false);
  const [buyPre,setBuyPre] = qState(null);
  const qno = 'QT'+today.getFullYear()+String(today.getMonth()+1).padStart(2,'0')+String(today.getDate()).padStart(2,'0')+'-'+String(today.getHours())+String(today.getMinutes()).padStart(2,'0');

  const addLine=(l)=>setLines(prev=>[...prev, l||{ name:'', qty:1, price:'' }]);
  const setLine=(i,k,v)=>setLines(prev=>prev.map((l,j)=>j===i?{...l,[k]:v}:l));
  const delLine=(i)=>setLines(prev=>prev.filter((_,j)=>j!==i));
  const subtotal = lines.reduce((a,l)=>a+(Number(l.qty)||0)*(Number(l.price)||0),0);
  const vatAmt = vat ? subtotal*0.07 : 0;
  const total = subtotal + vatAmt;
  // internal: cost & profit (menu-linked lines carry a cost)
  const costTotal = lines.reduce((a,l)=>a+(Number(l.qty)||0)*(Number(l.cost)||0),0);
  const profit = subtotal - costTotal;
  const margin = subtotal? Math.round(profit/subtotal*100):0;
  // materials needed for this job (aggregate recipes, stock mode)
  const needMap = {};
  if(costMode==='stock'){ lines.forEach(l=>{ if(!l.menuId) return; const m=(menu||[]).find(x=>x.id===l.menuId); ((m&&m.recipe)||[]).forEach(([rmId,q])=>{ needMap[rmId]=(needMap[rmId]||0)+(Number(q)||0)*(Number(l.qty)||0); }); }); }
  const needList = Object.keys(needMap).map(id=>{ const r=(raw||[]).find(x=>x.id===id)||{}; const need=needMap[id]; const have=Number(r.stock)||0; return { id, th:r.th||id, unit:r.unit||'', avgCost:Number(r.avgCost)||0, need, have, short:Math.max(0,need-have) }; });
  const matCost = needList.reduce((a,n)=>a+n.need*n.avgCost,0);
  const shortCost = needList.reduce((a,n)=>a+n.short*n.avgCost,0);
  const uLbl = (u)=> (window.unitLabel?window.unitLabel(u,lang):u);
  const save=()=>{ if(addQuote){ addQuote({ qno, cust, date, validDays, vat, subtotal, vatAmt, total, costTotal, profit, status, matCost, lines: lines.filter(l=>l.name) }); toast.show(TH?'บันทึกใบเสนอราคาแล้ว':'Quote saved'); } };

  const doPrint = ()=>{
    const esc=(s)=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const rows = lines.filter(l=>l.name).map((l,i)=>{
      const amt=(Number(l.qty)||0)*(Number(l.price)||0);
      return '<tr><td class="c">'+(i+1)+'</td><td>'+esc(l.name)+'</td><td class="c">'+(Number(l.qty)||0)+'</td><td class="r">'+qMoney(l.price).slice(1)+'</td><td class="r">'+qMoney(amt).slice(1)+'</td></tr>';
    }).join('');
    const validTxt = new Date(new Date(date).getTime()+ (Number(validDays)||0)*86400000).toLocaleDateString(TH?'th-TH':'en-US',{day:'numeric',month:'short',year:'numeric'});
    const dTxt = new Date(date).toLocaleDateString(TH?'th-TH':'en-US',{day:'numeric',month:'long',year:'numeric'});
    const payBlock = bankInfo ? '<div style="margin-top:16px;background:#F1FAF5;border-radius:8px;padding:10px 14px;font-size:12px"><b style="color:#0B7A50">'+(TH?'ชำระเงินโดยโอนเข้า':'Payment / transfer to')+':</b> '+esc(bankInfo)+'</div>' : '';
    const css="*{margin:0;padding:0;box-sizing:border-box}@page{size:A4;margin:16mm}body{font-family:'IBM Plex Sans Thai',sans-serif;color:#1a1a1a;font-size:13px;line-height:1.5}"
      +".head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #12A56E;padding-bottom:14px;margin-bottom:18px}"
      +".shop{font-size:20px;font-weight:700;color:#0B7A50}.sub{color:#666;font-size:12px;margin-top:3px}"
      +".doct{font-size:26px;font-weight:800;color:#12A56E;letter-spacing:1px}.meta{font-size:12px;color:#444;margin-top:6px;text-align:right}"
      +".to{background:#F1FAF5;border-radius:8px;padding:12px 14px;margin-bottom:16px}.lbl{font-size:11px;color:#12A56E;font-weight:700;text-transform:uppercase;letter-spacing:.5px}"
      +"table{width:100%;border-collapse:collapse;margin-bottom:14px}th{background:#0B7A50;color:#fff;font-size:12px;padding:9px 10px;text-align:left}"
      +"td{padding:9px 10px;border-bottom:1px solid #e5eae7}.c{text-align:center}.r{text-align:right}"
      +".tot{width:280px;margin-left:auto}.tot .row{display:flex;justify-content:space-between;padding:6px 2px}.tot .g{border-top:2px solid #12A56E;font-size:17px;font-weight:800;color:#0B7A50;padding-top:9px;margin-top:4px}"
      +".note{margin-top:20px;font-size:12px;color:#555;white-space:pre-wrap}.sign{display:flex;justify-content:space-between;margin-top:46px;font-size:12px;color:#444}.sign div{width:44%;text-align:center;border-top:1px solid #999;padding-top:6px}";
    const body='<div class="head"><div><div class="shop">'+esc(shopName||'ร้านของฉัน')+'</div>'
      +'<div class="sub">'+esc(shopAddr||'')+'</div><div class="sub">'+(TH?'โทร ':'Tel ')+esc(phone||(shop&&shop.phone)||'')+'</div></div>'
      +'<div style="text-align:right"><div class="doct">'+(TH?'ใบเสนอราคา':'QUOTATION')+'</div><div class="meta"><b>'+(TH?'เลขที่':'No.')+'</b> '+qno+'<br><b>'+(TH?'วันที่':'Date')+'</b> '+dTxt+'<br><b>'+(TH?'ยืนราคาถึง':'Valid until')+'</b> '+validTxt+'</div></div></div>'
      +'<div class="to"><div class="lbl">'+(TH?'เสนอราคาให้':'Quotation for')+'</div><div style="font-size:15px;font-weight:700;margin-top:2px">'+esc(cust||'-')+'</div>'+(caddr?'<div class="sub" style="margin-top:2px">'+esc(caddr)+'</div>':'')+'</div>'
      +'<table><thead><tr><th class="c" style="width:36px">#</th><th>'+(TH?'รายการ':'Description')+'</th><th class="c" style="width:52px">'+(TH?'จำนวน':'Qty')+'</th><th class="r" style="width:90px">'+(TH?'ราคา/หน่วย':'Unit')+'</th><th class="r" style="width:100px">'+(TH?'จำนวนเงิน':'Amount')+'</th></tr></thead><tbody>'+rows+'</tbody></table>'
      +'<div class="tot"><div class="row"><span>'+(TH?'รวมเป็นเงิน':'Subtotal')+'</span><span>'+qMoney(subtotal)+'</span></div>'
      +(vat?'<div class="row"><span>'+(TH?'ภาษีมูลค่าเพิ่ม 7%':'VAT 7%')+'</span><span>'+qMoney(vatAmt)+'</span></div>':'')
      +'<div class="row g"><span>'+(TH?'ยอดรวมทั้งสิ้น':'Total')+'</span><span>'+qMoney(total)+'</span></div>'
      +(vat?'':'<div style="font-size:11px;color:#888;text-align:right;margin-top:4px">'+(TH?'* ราคานี้ยังไม่รวมภาษีมูลค่าเพิ่ม':'* Prices exclude VAT')+'</div>')+'</div>'
      +(note?'<div class="note"><b>'+(TH?'หมายเหตุ':'Note')+':</b> '+esc(note)+'</div>':'')
      +payBlock
      +'<div class="sign"><div>'+esc(issuer||'')+(phone?'<br>'+(TH?'โทร ':'Tel ')+esc(phone):'')+'<br><span style="color:#888;font-size:11px">'+(TH?'ผู้เสนอราคา':'Issued by')+'</span></div><div><br><br><span style="color:#888;font-size:11px">'+(TH?'ผู้อนุมัติ / ลูกค้า':'Approved by')+'</span></div></div>';
    const doc='<!DOCTYPE html><ht'+'ml><he'+'ad><meta charset="utf-8"><ti'+'tle>'+qno+'</ti'+'tle><li'+'nk href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;700;800&display=swap" rel="stylesheet"><sty'+'le>'+css+'</sty'+'le></he'+'ad><bo'+'dy>'+body+'</bo'+'dy></ht'+'ml>';
    try{
      const ifr=document.createElement('iframe'); ifr.setAttribute('aria-hidden','true');
      ifr.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      ifr.onload=()=>{ setTimeout(()=>{ try{ ifr.contentWindow.focus(); ifr.contentWindow.print(); }catch(e){ try{ window.print(); }catch(_){} }
        setTimeout(()=>{ try{ document.body.removeChild(ifr); }catch(e){} }, 900); }, 400); };
      document.body.appendChild(ifr);
      const d=ifr.contentWindow.document; d.open(); d.write(doc); d.close();
    }catch(e){}
  };

  const cats = useCats();
  const grouped = cats.map(c=>({ cat:c, items:menu.filter(m=>m.cat===c.id) })).filter(g=>g.items.length);

  return (
    <div style={{ position:'absolute', inset:0, zIndex:60, background:'var(--bg)', display:'flex', flexDirection:'column', animation:'kdFade .25s' }}>
      <div style={{ paddingTop:56, background:'var(--brand)', color:'#fff' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 18px 16px' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:21, fontWeight:700 }}>{TH?'ใบเสนอราคา':'Quotation'}</div>
            <div style={{ fontSize:12.5, opacity:.85, marginTop:2 }} className="num">{qno}</div>
          </div>
          <button onClick={()=>setHistOpen(true)} style={{ border:'none', background:'rgba(255,255,255,.22)', color:'#fff', height:38, padding:'0 14px', borderRadius:999, cursor:'pointer', fontFamily:'var(--font)', fontWeight:700, fontSize:13, marginRight:8 }}>{TH?'ประวัติ':'History'}{quotes&&quotes.length?' '+quotes.length:''}</button>
          <button onClick={onClose} style={{ border:'none', background:'rgba(255,255,255,.22)', color:'#fff', width:38, height:38, borderRadius:999, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>{IC.x}</button>
        </div>
      </div>

      <div className="kd-body" style={{ padding:'16px 16px 30px' }}>
        {/* customer */}
        <div className="kd-card" style={{ padding:15, marginBottom:12 }}>
          <Lbl>{TH?'เสนอราคาให้ (ชื่อลูกค้า/บริษัท)':'Customer'}</Lbl>
          <input className="kd-input" value={cust} onChange={e=>setCust(e.target.value)} placeholder={TH?'เช่น คุณสมชาย / บริษัท ABC':'e.g. Mr. A / ABC Co.'}/>
          <div style={{ height:10 }}/>
          <input className="kd-input" value={caddr} onChange={e=>setCaddr(e.target.value)} placeholder={TH?'ที่อยู่/เบอร์ติดต่อ (ไม่บังคับ)':'address/contact (optional)'}/>
          <div style={{ display:'flex', gap:10, marginTop:10 }}>
            <div style={{ flex:1 }}><Lbl>{TH?'วันที่':'Date'}</Lbl><input className="kd-input num" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
            <div style={{ width:110 }}><Lbl>{TH?'ยืนราคา (วัน)':'Valid (days)'}</Lbl><input className="kd-input num" type="number" value={validDays} onChange={e=>setValidDays(e.target.value)}/></div>
          </div>
        </div>

        {/* issuer & payment */}
        <div className="kd-card" style={{ padding:15, marginBottom:12 }}>
          <Lbl>{TH?'ชื่อร้าน (หัวเอกสาร)':'Shop name (header)'}</Lbl>
          <input className="kd-input" value={shopName} onChange={e=>setShopName(e.target.value)} placeholder={TH?'ชื่อร้าน':'shop name'}/>
          <div style={{ height:10 }}/>
          <Lbl>{TH?'ที่อยู่ร้าน':'Shop address'}</Lbl>
          <textarea className="kd-input" rows={2} style={{ resize:'none' }} value={shopAddr} onChange={e=>setShopAddr(e.target.value)} placeholder={TH?'ที่อยู่ร้านสำหรับหัวใบเสนอราคา':'shop address on the quote header'}/>
          <div style={{ height:12, borderBottom:'1px solid var(--hair)', marginBottom:12 }}/>
          <Lbl>{TH?'ชื่อผู้เสนอราคา':'Issued by (name)'}</Lbl>
          <input className="kd-input" value={issuer} onChange={e=>setIssuer(e.target.value)} placeholder={TH?'เช่น ชื่อร้าน/ชื่อคุณ':'e.g. shop or your name'}/>
          <div style={{ height:10 }}/>
          <Lbl>{TH?'เบอร์ติดต่อ':'Contact phone'}</Lbl>
          <input className="kd-input num" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="08x-xxx-xxxx"/>
          <div style={{ height:10 }}/>
          <Lbl>{TH?'บัญชี/พร้อมเพย์สำหรับโอนเงิน':'Bank / PromptPay for transfer'}</Lbl>
          <input className="kd-input" value={bankInfo} onChange={e=>setBankInfo(e.target.value)} placeholder={TH?'เช่น กสิกร 123-4-56789-0 · พร้อมเพย์ 08x':'e.g. KBank 123-4-… · PromptPay 08x'}/>
        </div>

        {/* items */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'0 4px 8px' }}>
          <span style={{ fontSize:14, fontWeight:700 }}>{TH?'รายการ':'Items'}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setPickOpen(true)} style={{ border:'none', cursor:'pointer', background:'var(--brand-soft)', color:'var(--brand-ink)', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, padding:'6px 11px', borderRadius:999 }}>{React.cloneElement(IC.plus,{size:14})} {TH?'จากเมนู':'From menu'}</button>
            <button onClick={()=>addLine()} style={{ border:'none', cursor:'pointer', background:'var(--bg)', color:'var(--ink-2)', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, padding:'6px 11px', borderRadius:999, boxShadow:'inset 0 0 0 1.5px var(--hair-2)' }}>{TH?'รายการเอง':'Custom'}</button>
          </div>
        </div>
        {lines.length===0 && <div style={{ fontSize:13, color:'var(--ink-3)', textAlign:'center', padding:'18px 0' }}>{TH?'ยังไม่มีรายการ · แตะ “จากเมนู” หรือ “รายการเอง”':'No items yet · tap “From menu” or “Custom”'}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
          {lines.map((l,i)=>{ const amt=(Number(l.qty)||0)*(Number(l.price)||0); return (
            <div key={i} className="kd-card" style={{ padding:'11px 12px' }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                <input className="kd-input" style={{ flex:1, padding:'9px 11px' }} value={l.name} onChange={e=>setLine(i,'name',e.target.value)} placeholder={TH?'ชื่อรายการ':'Item name'}/>
                <button onClick={()=>delLine(i)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-3)', padding:4 }}>{React.cloneElement(IC.x,{size:16})}</button>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <input className="kd-input num" style={{ width:52, padding:'8px 6px', textAlign:'center' }} type="number" value={l.qty} onChange={e=>setLine(i,'qty',e.target.value)} placeholder="1"/>
                <span style={{ color:'var(--ink-3)', fontSize:12.5 }}>×</span>
                <div style={{ position:'relative', flex:1 }}>
                  <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontSize:13 }}>฿</span>
                  <input className="kd-input num" style={{ padding:'8px 8px 8px 21px' }} type="number" value={l.price} onChange={e=>setLine(i,'price',e.target.value)} placeholder="0"/>
                </div>
                <span className="num" style={{ minWidth:76, textAlign:'right', fontWeight:700, fontSize:14 }}>{qMoney(amt)}</span>
              </div>
            </div>
          );})}
        </div>

        {/* VAT toggle */}
        <div className="kd-card" style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 15px', boxShadow:'none', background:'var(--bg)', marginBottom:12, cursor:'pointer' }} onClick={()=>setVat(v=>!v)}>
          <span style={{ color: vat?'var(--brand)':'var(--ink-3)' }}>{React.cloneElement(IC.receipt,{size:20})}</span>
          <div style={{ flex:1 }}><div style={{ fontSize:14.5, fontWeight:600 }}>{TH?'คิดภาษีมูลค่าเพิ่ม (VAT 7%)':'Add VAT 7%'}</div>
            <div style={{ fontSize:12, color:'var(--ink-3)' }}>{vat?(TH?'บวก VAT 7% บนยอดรวม':'VAT added on subtotal'):(TH?'ไม่คิด VAT (ราคาสุทธิ)':'No VAT')}</div></div>
          <Toggle on={vat}/>
        </div>

        {/* totals */}
        <div className="kd-card" style={{ padding:'14px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, padding:'3px 0', color:'var(--ink-2)' }}><span>{TH?'รวมเป็นเงิน':'Subtotal'}</span><span className="num">{qMoney(subtotal)}</span></div>
          {vat && <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, padding:'3px 0', color:'var(--ink-2)' }}><span>{TH?'VAT 7%':'VAT 7%'}</span><span className="num">{qMoney(vatAmt)}</span></div>}
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:18, fontWeight:800, paddingTop:8, marginTop:4, borderTop:'2px solid var(--brand)', color:'var(--brand-ink)' }}><span>{TH?'ยอดรวมทั้งสิ้น':'Total'}</span><span className="num">{qMoney(total)}</span></div>
        </div>

        {/* internal: cost & profit (not printed) */}
        <div className="kd-card" style={{ padding:'14px 16px', marginBottom:12, background:'var(--brand-softer)', boxShadow:'none' }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:'var(--brand-ink)', marginBottom:8 }}>{TH?'สำหรับร้าน (ไม่โชว์บนใบเสนอราคา)':'Internal (not printed)'}</div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, padding:'3px 0', color:'var(--ink-2)' }}><span>{TH?'ต้นทุนรวม':'Cost'}</span><span className="num">{qMoney(costTotal)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700, padding:'3px 0' }}><span>{TH?'กำไรคาดการณ์':'Est. profit'}</span><span className="num" style={{ color: profit>=0?'var(--brand-ink)':'var(--danger)' }}>{qMoney(profit)} · {margin}%</span></div>
          <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:4 }}>{TH?'* คิดจากรายการที่ผูกกับเมนู':'* from menu-linked items only'}</div>
        </div>
        {needList.length>0 && <div className="kd-card" style={{ padding:'14px 16px', marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>{React.cloneElement(IC.cartIn,{size:16, style:{verticalAlign:'-3px', marginRight:5}})}{TH?'วัตถุดิบที่ต้องใช้สำหรับงานนี้':'Materials needed for this job'}</div>
          {needList.map(n=>(
            <div key={n.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--hair)', fontSize:13 }}>
              <span style={{ flex:1 }}>{n.th}</span>
              <span className="num" style={{ color:'var(--ink-3)' }}>{TH?'ใช้':'need'} {n.need.toLocaleString()} {uLbl(n.unit)}</span>
              <span className="num" style={{ width:80, textAlign:'right', fontWeight:700, color: n.short>0?'var(--danger)':'var(--brand-ink)' }}>{n.short>0?(TH?'ขาด '+n.short.toLocaleString():'short '+n.short.toLocaleString()):(TH?'พอ':'ok')}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', paddingTop:9, marginTop:4, fontWeight:700, fontSize:14 }}><span>{TH?'ต้นทุนวัตถุดิบรวม (ลงทุนงานนี้)':'Total material cost'}</span><span className="num">{qMoney(matCost)}</span></div>
          {shortCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--danger)', marginTop:3 }}><span>{TH?'ต้องซื้อเพิ่ม (ของขาด)':'Need to buy'}</span><span className="num">{qMoney(shortCost)}</span></div>}
          {addPurchase && needList.some(n=>n.short>0) && <button onClick={()=>setBuyPre(needList.filter(n=>n.short>0).map(n=>({ rmId:n.id })))} className="kd-btn" style={{ width:'100%', marginTop:10, background:'var(--brand-soft)', color:'var(--brand-ink)', padding:12 }}>{React.cloneElement(IC.cartIn,{size:16})} {TH?'สร้างรายการซื้อของที่ขาด':'Buy the shortfall'}</button>}
        </div>}

        <Lbl>{TH?'หมายเหตุ (เงื่อนไข/การชำระ)':'Note'}</Lbl>
        <textarea className="kd-input" rows={2} style={{ resize:'none' }} value={note} onChange={e=>setNote(e.target.value)} placeholder={TH?'เช่น ชำระมัดจำ 50% · ราคานี้รวมค่าจัดส่ง':'e.g. 50% deposit · delivery included'}/>
      </div>

      <div style={{ padding:'10px 20px calc(12px + 8px)', borderTop:'1px solid var(--hair)', background:'#fff' }}>
        <div style={{ display:'flex', gap:6, marginBottom:10 }}>
          {[['pending',TH?'รอเสนอ':'Pending','var(--ink-3)'],['won',TH?'ได้งาน':'Won','var(--brand)'],['lost',TH?'ไม่ได้งาน':'Lost','var(--danger)']].map(([k,l,c])=>(
            <button key={k} onClick={()=>setStatus(k)} style={{ flex:1, border:'none', cursor:'pointer', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, padding:'8px', borderRadius:10, background: status===k?c:'var(--bg)', color: status===k?'#fff':'var(--ink-3)' }}>{l}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={save} disabled={!lines.some(l=>l.name)} className="kd-btn" style={{ flex:1, background:'var(--brand-soft)', color:'var(--brand-ink)', padding:16, opacity: lines.some(l=>l.name)?1:.5 }}>{React.cloneElement(IC.check,{size:18})} {TH?'บันทึก':'Save'}</button>
          <button onClick={doPrint} disabled={!lines.some(l=>l.name)} className="kd-btn kd-btn-primary" style={{ flex:1.4, padding:16, opacity: lines.some(l=>l.name)?1:.5 }}>{React.cloneElement(IC.receipt,{size:18})} {TH?'พิมพ์ / PDF':'Print / PDF'}</button>
        </div>
      </div>

      {pickOpen && <Sheet open={true} onClose={()=>setPickOpen(false)} height="80%">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 10px' }}>
          <div style={{ fontSize:18, fontWeight:700 }}>{TH?'เลือกจากเมนู':'Pick from menu'}</div>
          <button onClick={()=>setPickOpen(false)} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
        </div>
        <div style={{ overflowY:'auto', padding:'0 16px 16px', flex:1 }}>
          {grouped.map(g=>(
            <div key={g.cat.id} style={{ marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:700, margin:'0 4px 7px' }}>{g.cat.emoji} {g.cat[lang]||g.cat.th}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {g.items.map(m=>(
                  <button key={m.id} onClick={()=>{ addLine({ name:(m[lang]||m.th), qty:1, price:m.price, cost:(window.effItemCost?window.effItemCost(m, raw, costMode):(m.cost||0)), menuId:m.id }); }} className="kd-card" style={{ border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:11, padding:'10px 12px', fontFamily:'var(--font)', textAlign:'left' }}>
                    <FoodTile item={m} size={40} radius={10}/>
                    <span style={{ flex:1, fontSize:14, fontWeight:600 }}>{m[lang]||m.th}</span>
                    <span className="num" style={{ fontWeight:700 }}>{qMoney(m.price)}</span>
                    <span style={{ color:'var(--brand)' }}>{React.cloneElement(IC.plus,{size:18})}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:'10px 20px 0' }}><button onClick={()=>setPickOpen(false)} className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:14 }}>{TH?'เสร็จ':'Done'}</button></div>
      </Sheet>}

      {buyPre && <PurchaseSheet raw={raw} addRaw={addRaw||(()=>{})} preItems={buyPre} onSave={(p)=>{ addPurchase&&addPurchase(p); setBuyPre(null); toast.show(TH?'บันทึกซื้อของแล้ว':'Saved'); }} onClose={()=>setBuyPre(null)} />}

      {histOpen && <Sheet open={true} onClose={()=>setHistOpen(false)} height="86%">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 10px' }}>
          <div style={{ fontSize:18, fontWeight:700 }}>{TH?'ประวัติใบเสนอราคา':'Quotation history'}</div>
          <button onClick={()=>setHistOpen(false)} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
        </div>
        <div style={{ overflowY:'auto', padding:'0 16px 16px', flex:1 }}>
          {(!quotes||!quotes.length) && <div style={{ fontSize:13, color:'var(--ink-3)', textAlign:'center', padding:'30px 0' }}>{TH?'ยังไม่มีใบเสนอราคาที่บันทึก · กด “บันทึก” เพื่อเก็บไว้ติดตามผล':'No saved quotes · tap “Save” to track them'}</div>}
          {(quotes||[]).map(q=>{ const st={pending:{th:'รอเสนอ',en:'Pending',c:'var(--ink-3)',bg:'var(--bg)'},won:{th:'ได้งาน',en:'Won',c:'#fff',bg:'var(--brand)'},lost:{th:'ไม่ได้งาน',en:'Lost',c:'#fff',bg:'var(--danger)'}}[q.status||'pending']; return (
            <div key={q.id} className="kd-card" style={{ padding:'12px 14px', marginBottom:9 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14.5, fontWeight:700 }}>{q.cust||(TH?'(ไม่ระบุลูกค้า)':'(no customer)')}</div>
                  <div style={{ fontSize:11.5, color:'var(--ink-3)' }} className="num">{q.qno} · {q.date}</div>
                </div>
                <div className="num" style={{ fontWeight:700, fontSize:15 }}>{qMoney(q.total)}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10 }}>
                {['pending','won','lost'].map(k=>{ const s={pending:{th:'รอเสนอ',en:'Pending',c:'var(--ink-3)'},won:{th:'ได้งาน',en:'Won',c:'var(--brand)'},lost:{th:'ไม่ได้งาน',en:'Lost',c:'var(--danger)'}}[k]; const on=(q.status||'pending')===k; return (
                  <button key={k} onClick={()=>updateQuote&&updateQuote(q.id,{status:k})} style={{ flex:1, border:'none', cursor:'pointer', fontFamily:'var(--font)', fontWeight:700, fontSize:12, padding:'7px', borderRadius:9, background: on?s.c:'var(--bg)', color: on?'#fff':'var(--ink-3)' }}>{TH?s.th:s.en}</button>
                );})}
                <button onClick={()=>deleteQuote&&deleteQuote(q.id)} style={{ border:'none', background:'#FCECE8', color:'var(--danger)', cursor:'pointer', padding:'7px 10px', borderRadius:9 }}>{React.cloneElement(IC.x,{size:15})}</button>
              </div>
            </div>
          );})}
        </div>
      </Sheet>}
      {toast.node}
    </div>
  );
}

Object.assign(window, { QuotationScreen });
