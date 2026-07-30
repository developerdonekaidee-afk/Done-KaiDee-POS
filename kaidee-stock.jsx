// kaidee-stock.jsx — raw-material inventory (stock mode): stock summary, purchases, raw editor, recipe picker
const { useState:stState } = React;

const unitLabel = (id, lang)=> { const u=runit(id); return u[lang]||u.th; };
const fmtQty = (n)=> Number(n||0).toLocaleString('en-US',{maximumFractionDigits:1});
const bahtDec = (n)=> '฿'+Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2});

/* ══════════════ STOCK SCREEN ══════════════ */
function StockScreen({ raw, addRaw, updateRaw, deleteRaw, purchases, addPurchase, wastes, addWaste, deleteWaste }){
  const { lang } = useT();
  const TH = lang==='th';
  const [view,setView] = stState('stock');   // stock | history | waste
  const [buy,setBuy]   = stState(false);
  const [edit,setEdit] = stState(null);
  const [wasteOpen,setWasteOpen] = stState(false);
  const wasteList = wastes||[];

  const totalValue = raw.reduce((a,r)=>a+rawValue(r),0);
  const lowItems = raw.filter(r=> (Number(r.stock)||0) <= (Number(r.low)||0));
  const grouped = RAW_CATS.map(c=>({ cat:c, items:raw.filter(r=>r.cat===c.id) })).filter(g=>g.items.length);

  return (
    <div className="kd-screen">
      <TopBar title={TH?'สต๊อกวัตถุดิบ':'Inventory'} sub={TH?`${raw.length} รายการ · ตัดสต๊อกอัตโนมัติเมื่อขาย`:`${raw.length} items · auto-deducted on sale`}
        right={<div style={{ display:'flex', gap:7 }}>
          <button onClick={()=>setWasteOpen(true)} className="kd-btn" style={{ padding:'9px 12px', fontSize:13.5, background:'#FCECE8', color:'var(--danger)' }} title={TH?'ตัดของเสีย':'Waste'}>🗑️ {TH?'ของเสีย':'Waste'}</button>
          <button onClick={()=>setBuy(true)} className="kd-btn kd-btn-primary" style={{ padding:'9px 13px', fontSize:14 }}>{React.cloneElement(IC.cartIn,{size:16})} {TH?'ซื้อเข้า':'Buy in'}</button>
        </div>}/>

      {/* summary cards */}
      <div style={{ display:'flex', gap:11, padding:'0 16px 12px' }}>
        <Stat label={TH?'มูลค่าสต๊อกคงเหลือ':'Stock value'} value={money(Math.round(totalValue))} tone="var(--brand-ink)" sub={TH?`${raw.length} วัตถุดิบ`:`${raw.length} items`}/>
        <Stat label={TH?'ใกล้หมด':'Low stock'} value={String(lowItems.length)} tone={lowItems.length?'var(--danger)':'var(--ink)'} sub={TH?'ควรสั่งเพิ่ม':'reorder soon'}/>
      </div>

      {/* segmented */}
      <div style={{ display:'flex', gap:8, padding:'0 16px 12px' }}>
        {[['stock',TH?'คงเหลือ':'On hand',0],['buy',TH?'ต้องซื้อ':'To buy',lowItems.length],['history',TH?'ซื้อเข้า':'Purchases',0],['waste',TH?'ของเสีย':'Waste',0]].map(([k,l,n])=>(
          <button key={k} onClick={()=>setView(k)} style={{ border:'none', cursor:'pointer', flex:1, padding:'10px', borderRadius:12, position:'relative',
            fontWeight:700, fontSize:13.5, fontFamily:'var(--font)', background: view===k?'var(--ink)':'#fff', color: view===k?'#fff':'var(--ink-2)', boxShadow:'var(--shadow)' }}>{l}{n>0&&<span style={{ marginLeft:5, fontSize:11, fontWeight:800, color:'#fff', background:'var(--danger)', padding:'1px 6px', borderRadius:999 }}>{n}</span>}</button>
        ))}
      </div>

      <div className="kd-body" style={{ padding:'0 16px 24px' }}>
        {view==='stock' ? (
          <>
            {lowItems.length>0 && <div className="kd-card" style={{ padding:'11px 14px', marginBottom:12, background:'#FCECE8', boxShadow:'none',
              display:'flex', alignItems:'center', gap:9, color:'var(--danger)', fontSize:13, fontWeight:600 }}>
              {React.cloneElement(IC.alert,{size:17})}<span>{TH?`${lowItems.length} วัตถุดิบใกล้หมด: `:`${lowItems.length} low: `}{lowItems.map(r=>r.th).slice(0,4).join(', ')}{lowItems.length>4?'…':''}</span></div>}
            {grouped.map(g=>(
              <div key={g.cat.id} style={{ marginBottom:16 }}>
                <div style={{ fontSize:13.5, fontWeight:700, margin:'0 4px 8px', display:'flex', alignItems:'center', gap:6 }}>
                  <span>{g.cat.emoji}</span>{g.cat[lang]||g.cat.th}<span style={{ color:'var(--ink-3)', fontWeight:500 }}>· {g.items.length}</span></div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {g.items.map(r=>{ const low=(Number(r.stock)||0)<=(Number(r.low)||0); return (
                    <button key={r.id} onClick={()=>setEdit(r)} className="kd-card" style={{ border:'none', cursor:'pointer',
                      display:'flex', alignItems:'center', gap:12, padding:'12px 14px', fontFamily:'var(--font)', textAlign:'left' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14.5, fontWeight:600 }}>{r.th}</div>
                        <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }} className="num">{TH?'ต้นทุนเฉลี่ย':'avg'} {bahtDec(r.avgCost)}/{unitLabel(r.unit,lang)} · {TH?'มูลค่า':'value'} {money(Math.round(rawValue(r)))}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div className="num" style={{ fontWeight:700, fontSize:15, color: low?'var(--danger)':'var(--ink)' }}>{fmtQty(r.stock)} <span style={{ fontSize:12, color:'var(--ink-3)', fontWeight:600 }}>{unitLabel(r.unit,lang)}</span></div>
                        {low ? <div style={{ fontSize:11, color:'var(--danger)', fontWeight:700 }}>{TH?'ใกล้หมด':'low'}</div>
                             : <div style={{ fontSize:11, color:'var(--brand)', fontWeight:700 }}>{TH?'พอ':'ok'}</div>}
                      </div>
                    </button>
                  );})}
                </div>
              </div>
            ))}
            <button onClick={()=>setEdit({ id:'r'+Date.now(), cat:'other', th:'', unit:'g', stock:0, avgCost:0, low:0, __new:true })}
              className="kd-btn" style={{ width:'100%', background:'var(--brand-soft)', color:'var(--brand-ink)', padding:14, marginTop:4 }}>
              {React.cloneElement(IC.plus,{size:17})} {TH?'เพิ่มวัตถุดิบใหม่':'Add raw material'}</button>
          </>
        ) : view==='history' ? (
          <>
            {purchases.length===0 && <Empty/>}
            {purchases.map(p=>{ const tot=p.lines.reduce((a,l)=>a+(Number(l.price)||0),0); return (
              <div key={p.id} className="kd-card" style={{ padding:'13px 15px', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ width:34, height:34, borderRadius:10, background:'var(--brand-soft)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{React.cloneElement(IC.cartIn,{size:17})}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700 }}>{fmtDate(p.date, lang)}{p.note?<span style={{ color:'var(--ink-3)', fontWeight:500 }}> · {p.note}</span>:''}</div>
                    <div style={{ fontSize:12, color:'var(--ink-3)' }}>{p.lines.length} {TH?'รายการ':'items'}</div>
                  </div>
                  <div className="num" style={{ fontWeight:700, fontSize:15 }}>{money(tot)}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  {p.lines.map((l,i)=>{ const r=rawById(raw,l.rmId); return (
                    <div key={i} style={{ display:'flex', fontSize:12.5, color:'var(--ink-2)' }}>
                      <span style={{ flex:1 }}>{r?r.th:l.rmId}</span>
                      <span className="num" style={{ color:'var(--ink-3)' }}>{fmtQty(l.qty)} {unitLabel(l.unit,lang)}</span>
                      <span className="num" style={{ width:70, textAlign:'right', fontWeight:600 }}>{money(l.price)}</span>
                    </div>
                  );})}
                </div>
              </div>
            );})}
          </>
        ) : view==='waste' ? (
          <>
            {wasteList.length===0 && <div style={{ fontSize:13, color:'var(--ink-3)', background:'var(--bg)', borderRadius:12, padding:'18px 16px', textAlign:'center' }}>{TH?'ยังไม่มีรายการของเสีย — กด “ของเสีย” มุมขวาบนเพื่อตัดสต๊อกทิ้ง':'No waste yet — tap Waste (top-right) to record spoilage'}</div>}
            {wasteList.length>0 && <div className="kd-card" style={{ padding:'12px 15px', marginBottom:12, background:'#FCECE8', boxShadow:'none' }}>
              <div style={{ fontSize:12.5, color:'var(--danger)', fontWeight:600 }}>{TH?'มูลค่าของเสียทั้งหมด':'Total waste value'}</div>
              <div className="num" style={{ fontSize:22, fontWeight:800, color:'var(--danger)' }}>{money(Math.round(wasteList.reduce((a,w)=>a+(Number(w.cost)||0),0)))}</div>
            </div>}
            {wasteList.map(w=>{ const r=rawById(raw,w.rmId); return (
              <div key={w.id} className="kd-card" style={{ padding:'12px 14px', marginBottom:9, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>{r?r.th:w.rmId} <span style={{ fontSize:11.5, color:'var(--ink-3)', fontWeight:500 }}>· {fmtDate(w.date,lang)}</span></div>
                  <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }} className="num">{fmtQty(w.qty)} {unitLabel(w.unit,lang)}{w.reason?<span> · {w.reason}</span>:''}</div>
                </div>
                <div className="num" style={{ fontWeight:700, fontSize:14, color:'var(--danger)' }}>-{money(Math.round(w.cost))}</div>
                {deleteWaste && <button onClick={()=>deleteWaste(w.id)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-3)', padding:4 }}>{React.cloneElement(IC.x,{size:15})}</button>}
              </div>
            );})}
          </>
        ) : (
          <ShoppingList raw={raw} onBuy={(pre)=>setBuy({ pre })} />
        )}
      </div>

      {buy && <PurchaseSheet raw={raw} addRaw={addRaw} preItems={buy&&buy.pre} onSave={(p)=>{ addPurchase(p); setBuy(false); }} onClose={()=>setBuy(false)} />}
      {wasteOpen && <WasteSheet raw={raw} onSave={(w)=>{ addWaste&&addWaste(w); setWasteOpen(false); setView('waste'); }} onClose={()=>setWasteOpen(false)} />}
      {edit && <RawEditor item={edit} raw={raw} onSave={(r)=>{ if(edit.__new) addRaw(r); else updateRaw(edit.id, r); setEdit(null); }}
        onDelete={edit.__new?null:()=>{ deleteRaw(edit.id); setEdit(null); }} onClose={()=>setEdit(null)} />}
    </div>
  );
}
function fmtDate(iso, lang){ try{ const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString(lang==='th'?'th-TH':'en-US',{day:'numeric',month:'short'}); }catch(e){ return iso; } }

/* ══════════════ SHOPPING LIST (reorder checklist) ══════════════ */
function ShoppingList({ raw, onBuy }){
  const { lang } = useT(); const TH = lang==='th';
  const low = raw.filter(r=>(Number(r.stock)||0)<=(Number(r.low)||0));
  const [sel,setSel] = stState(()=>new Set(low.map(r=>r.id)));
  const toggle=(id)=>setSel(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const grouped = RAW_CATS.map(c=>({ cat:c, items:low.filter(r=>r.cat===c.id) })).filter(g=>g.items.length);
  const chosen = low.filter(r=>sel.has(r.id));
  if(low.length===0) return (
    <div style={{ textAlign:'center', color:'var(--ink-3)', padding:'50px 24px' }}>
      <div style={{ width:64, height:64, borderRadius:999, background:'var(--brand-soft)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>{React.cloneElement(IC.check,{size:32, stroke:2.6})}</div>
      <div style={{ fontSize:16, fontWeight:700, color:'var(--ink)' }}>{TH?'สต๊อกเพียงพอ':'Stock is healthy'}</div>
      <div style={{ fontSize:13.5, marginTop:4 }}>{TH?'ยังไม่มีวัตถุดิบที่ต้องซื้อเพิ่ม':'Nothing to reorder yet'}</div>
    </div>
  );
  return (
    <>
      <div className="kd-card" style={{ padding:'11px 14px', marginBottom:12, background:'#FFF7ED', boxShadow:'none', display:'flex', alignItems:'center', gap:9, color:'#B45309', fontSize:13, fontWeight:600 }}>
        {React.cloneElement(IC.cartIn,{size:17})}<span>{TH?`${low.length} รายการใกล้หมด · ติ๊กของที่จะซื้อ แล้วกดสร้างบิลซื้อเข้า`:`${low.length} items low · tick what to buy`}</span></div>
      {grouped.map(g=>(
        <div key={g.cat.id} style={{ marginBottom:14 }}>
          <div style={{ fontSize:13.5, fontWeight:700, margin:'0 4px 8px' }}>{g.cat.emoji} {g.cat[lang]||g.cat.th}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {g.items.map(r=>{ const on=sel.has(r.id); const target=Math.max((Number(r.low)||0)*2-(Number(r.stock)||0), (Number(r.low)||0)); return (
              <button key={r.id} onClick={()=>toggle(r.id)} className="kd-card" style={{ border:on?'2px solid var(--brand)':'2px solid transparent', cursor:'pointer',
                display:'flex', alignItems:'center', gap:12, padding:'11px 13px', fontFamily:'var(--font)', textAlign:'left' }}>
                <span style={{ width:24, height:24, borderRadius:7, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  background:on?'var(--brand)':'#fff', border:on?'none':'2px solid var(--hair-2)', color:'#fff' }}>{on&&React.cloneElement(IC.check,{size:15, stroke:3})}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14.5, fontWeight:600 }}>{r.th}</div>
                  <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }} className="num">{TH?'เหลือ':'left'} {fmtQty(r.stock)} {unitLabel(r.unit,lang)} · {TH?'แนะนำเติม ~':'suggest ~'}{fmtQty(target)} {unitLabel(r.unit,lang)}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--danger)', background:'#FCECE8', padding:'3px 9px', borderRadius:999, flexShrink:0 }}>{TH?'ใกล้หมด':'low'}</span>
              </button>
            );})}
          </div>
        </div>
      ))}
      <button onClick={()=>chosen.length&&onBuy(chosen.map(r=>({ rmId:r.id })))} disabled={!chosen.length}
        className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15, marginTop:4, opacity:chosen.length?1:.5 }}>
        {React.cloneElement(IC.cartIn,{size:18})} {TH?`สร้างบิลซื้อเข้า (${chosen.length})`:`Create purchase (${chosen.length})`}</button>
    </>
  );
}

/* ══════════════ PURCHASE SHEET (buy in on a date) ══════════════ */
function PurchaseSheet({ raw, addRaw, onSave, onClose, preItems }){
  const { lang } = useT(); const TH = lang==='th';
  const [date,setDate] = stState(new Date().toISOString().slice(0,10));
  const [note,setNote] = stState('');
  const defUnit = (rmId)=>{ const r=rawById(raw,rmId); const bu=r?buyUnitsFor(r.unit):RUNITS; return (bu.find(u=>u.base>1)||bu[0]).id; };
  const [lines,setLines] = stState(()=> (preItems&&preItems.length)
    ? preItems.map(p=>({ rmId:p.rmId, qty:'', unit:defUnit(p.rmId), price:'', pack:false, packs:'' }))
    : [{ rmId:'', qty:'', unit:'kg', price:'', pack:false, packs:'' }]);
  const total = lines.reduce((a,l)=>a+(Number(l.price)||0),0);
  const effQty = (l)=> (l.pack?(Number(l.packs)||0):1)*(Number(l.qty)||0);
  const setLine=(i,k,v)=>setLines(prev=>prev.map((l,j)=>{ if(j!==i) return l;
    const nl={...l,[k]:v};
    if(k==='rmId'){ const r=rawById(raw,v); if(r){ const bu=buyUnitsFor(r.unit); nl.unit = (bu.find(u=>u.base>1)||bu[0]).id; } }
    return nl; }));
  const addLine=()=>setLines(prev=>[...prev,{ rmId:'', qty:'', unit:'kg', price:'', pack:false, packs:'' }]);
  const delLine=(i)=>setLines(prev=>prev.filter((_,j)=>j!==i));
  const valid = lines.some(l=>l.rmId && effQty(l)>0);
  const [pVat,setPVat] = stState(false);
  const [supTax,setSupTax] = stState('');
  const VR = 7;
  const vBase = pVat ? total/(1+VR/100) : total;
  const vAmt  = pVat ? total-vBase : 0;
  return (
    <Sheet open={true} onClose={onClose} height="94%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 10px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{TH?'บันทึกซื้อของเข้า':'Record purchase'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        <div style={{ display:'flex', gap:12, marginBottom:14 }}>
          <div style={{ flex:1 }}><Lbl>{TH?'วันที่ซื้อ':'Date'}</Lbl><input className="kd-input num" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
          <div style={{ flex:1.4 }}><Lbl>{TH?'ร้าน/หมายเหตุ':'Note'}</Lbl><input className="kd-input" value={note} onChange={e=>setNote(e.target.value)} placeholder={TH?'เช่น ตลาดสด':'e.g. market'}/></div>
        </div>
        <Lbl>{TH?'รายการที่ซื้อ':'Items bought'}</Lbl>
        <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:12 }}>
          {lines.map((l,i)=>{ const r=rawById(raw,l.rmId); const units=r?buyUnitsFor(r.unit):RUNITS; return (
            <div key={i} style={{ background:'var(--bg)', borderRadius:13, padding:'11px 12px' }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:9 }}>
                <select style={{ ...ING_SEL, flex:1, padding:'9px 8px' }} value={l.rmId} onChange={e=>{ if(e.target.value==='__new'){ const nm=prompt(TH?'ชื่อวัตถุดิบใหม่':'New material name'); if(nm){ const id=addRaw({ th:nm, cat:'other', unit:'g' }); setLine(i,'rmId',id); } return; } setLine(i,'rmId',e.target.value); }}>
                  <option value="">{TH?'เลือกวัตถุดิบ…':'Pick material…'}</option>
                  {RAW_CATS.map(c=>{ const its=raw.filter(x=>x.cat===c.id); if(!its.length) return null; return (
                    <optgroup key={c.id} label={c[lang]||c.th}>{its.map(x=><option key={x.id} value={x.id}>{x.th}</option>)}</optgroup>
                  );})}
                  <option value="__new">＋ {TH?'สร้างวัตถุดิบใหม่':'New material'}</option>
                </select>
                <button onClick={()=>delLine(i)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-3)', padding:4 }}>{React.cloneElement(IC.x,{size:16})}</button>
              </div>
              <div style={{ display:'flex', gap:6, marginBottom:9 }}>
                <button onClick={()=>setLine(i,'pack',false)} style={{ border:'none', cursor:'pointer', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, padding:'6px 11px', borderRadius:999, background: !l.pack?'var(--brand)':'#fff', color: !l.pack?'#fff':'var(--ink-3)', boxShadow: !l.pack?'none':'inset 0 0 0 1.5px var(--hair-2)' }}>{TH?'ต่อหน่วย':'By unit'}</button>
                <button onClick={()=>setLine(i,'pack',true)} style={{ border:'none', cursor:'pointer', fontFamily:'var(--font)', fontWeight:700, fontSize:11.5, padding:'6px 11px', borderRadius:999, background: l.pack?'var(--brand)':'#fff', color: l.pack?'#fff':'var(--ink-3)', boxShadow: l.pack?'none':'inset 0 0 0 1.5px var(--hair-2)' }}>{TH?'เป็นลัง/แพ็ค':'By case/pack'}</button>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                {l.pack && <>
                  <input className="kd-input num" style={{ width:52, padding:'9px 6px', textAlign:'center' }} type="number" value={l.packs} onChange={e=>setLine(i,'packs',e.target.value)} placeholder={TH?'ลัง':'packs'}/>
                  <span style={{ color:'var(--ink-3)', fontSize:12.5 }}>{TH?'ลัง ×':'× '}</span>
                </>}
                <input className="kd-input num" style={{ width:56, padding:'9px 6px', textAlign:'center' }} type="number" value={l.qty} onChange={e=>setLine(i,'qty',e.target.value)} placeholder={l.pack?(TH?'ต่อลัง':'per pack'):(TH?'จำนวน':'qty')}/>
                <select style={ING_SEL} value={l.unit} onChange={e=>setLine(i,'unit',e.target.value)}>
                  {units.map(u=><option key={u.id} value={u.id}>{u[lang]||u.th}</option>)}
                </select>
                <span style={{ color:'var(--ink-3)', fontSize:12.5 }}>{TH?'ราคารวม':'total'}</span>
                <div style={{ position:'relative', flex:1, minWidth:60 }}>
                  <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)', fontSize:13 }}>฿</span>
                  <input className="kd-input num" style={{ padding:'9px 8px 9px 21px' }} type="number" value={l.price} onChange={e=>setLine(i,'price',e.target.value)} placeholder="0"/>
                </div>
              </div>
              {r && effQty(l)>0 && Number(l.price)>0 && <div style={{ marginTop:7, fontSize:11.5, color:'var(--ink-3)' }} className="num">
                = {bahtDec((Number(l.price)||0)/convQty(effQty(l),l.unit,r.unit))}/{unitLabel(r.unit,lang)} · {TH?'เข้าสต๊อก':'stock +'}{fmtQty(convQty(effQty(l),l.unit,r.unit))} {unitLabel(r.unit,lang)}{l.pack?` (${fmtQty(l.packs)}×${fmtQty(l.qty)})`:''}</div>}
            </div>
          );})}
        </div>
        <button onClick={addLine} className="kd-btn" style={{ width:'100%', background:'var(--brand-soft)', color:'var(--brand-ink)', padding:12 }}>{React.cloneElement(IC.plus,{size:16})} {TH?'เพิ่มรายการ':'Add line'}</button>

        {/* ภาษีซื้อ (input VAT) — สำหรับใบกำกับภาษีจากซัพพลายเออร์ */}
        <div className="kd-card" style={{ padding:'12px 14px', marginTop:14, background:'var(--bg)', boxShadow:'none' }}>
          <button onClick={()=>setPVat(v=>!v)} style={{ width:'100%', border:'none', background:'none', cursor:'pointer', fontFamily:'var(--font)', display:'flex', alignItems:'center', gap:10, padding:0, textAlign:'left' }}>
            <span style={{ width:44, height:26, borderRadius:999, background:pVat?'var(--brand)':'#d2dad6', position:'relative', flexShrink:0, transition:'background .2s' }}><span style={{ position:'absolute', top:3, left:pVat?21:3, width:20, height:20, borderRadius:999, background:'#fff', transition:'left .2s' }}/></span>
            <span style={{ flex:1 }}><span style={{ fontSize:14, fontWeight:700 }}>{TH?'มีใบกำกับภาษี (VAT ซื้อ)':'Has tax invoice (input VAT)'}</span><div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:1 }}>{TH?'บิลนี้มีใบกำกับภาษีจากผู้ขาย — นับเป็นภาษีซื้อ':'Supplier issued a tax invoice — counts as input VAT'}</div></span>
          </button>
          {pVat && <div style={{ marginTop:11 }}>
            <Lbl>{TH?'เลขผู้เสียภาษีผู้ขาย (ถ้ามี)':'Supplier tax ID (optional)'}</Lbl>
            <input className="kd-input num" inputMode="numeric" maxLength={13} value={supTax} onChange={e=>setSupTax(e.target.value.replace(/\D/g,''))} placeholder="0000000000000"/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, color:'var(--ink-3)', marginTop:10 }} className="num"><span>{TH?'มูลค่าก่อน VAT':'Before VAT'}</span><span>{money(vBase)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, color:'var(--brand-ink)', fontWeight:700, marginTop:3 }} className="num"><span>VAT {VR}%</span><span>{money(vAmt)}</span></div>
          </div>}
        </div>
      </div>
      <div style={{ padding:'12px 20px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:15, marginBottom:10, padding:'0 2px' }}>
          <span>{TH?'รวมจ่ายทั้งบิล':'Total spent'}</span><span className="num">{money(total)}</span></div>
        <button onClick={()=>onSave({ date, note, hasVat:pVat, vat: pVat?+vAmt.toFixed(2):0, vatBase: pVat?+vBase.toFixed(2):total, vatRate: pVat?VR:0, supplierTaxId: supTax||'', lines: lines.filter(l=>l.rmId&&effQty(l)>0).map(l=>({ rmId:l.rmId, qty:effQty(l), unit:l.unit, price:Number(l.price)||0 })) })}
          className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15 }} disabled={!valid}>{TH?'บันทึกเข้าสต๊อก':'Save to stock'}</button>
      </div>
    </Sheet>
  );
}

/* ══════════════ RAW EDITOR ══════════════ */
function RawEditor({ item, raw, onSave, onDelete, onClose }){
  const { lang } = useT(); const TH = lang==='th';
  const [f,setF] = stState({ ...item });
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  return (
    <Sheet open={true} onClose={onClose} height="86%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>{item.__new?(TH?'วัตถุดิบใหม่':'New material'):(TH?'แก้ไขวัตถุดิบ':'Edit material')}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        <Field label={TH?'ชื่อวัตถุดิบ':'Name'}><input className="kd-input" value={f.th} onChange={e=>upd('th',e.target.value)} placeholder={TH?'เช่น หมูสับ':'e.g. minced pork'}/></Field>
        <div style={{ height:14 }}/>
        <Lbl>{TH?'หมวดหมู่':'Category'}</Lbl>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:14 }}>
          {RAW_CATS.map(c=>(<button key={c.id} onClick={()=>upd('cat',c.id)} style={{ border:'none', cursor:'pointer', padding:'8px 12px', borderRadius:999,
            fontFamily:'var(--font)', fontWeight:600, fontSize:13, background: f.cat===c.id?'var(--brand)':'var(--bg)', color: f.cat===c.id?'#fff':'var(--ink-2)' }}>{c.emoji} {c[lang]||c.th}</button>))}
        </div>
        <div style={{ display:'flex', gap:12, marginBottom:14 }}>
          <div style={{ flex:1 }}><Lbl>{TH?'หน่วยนับสต๊อก':'Stock unit'}</Lbl>
            <select style={{ ...ING_SEL, width:'100%', padding:'12px 10px' }} value={f.unit} onChange={e=>upd('unit',e.target.value)}>
              {RUNITS.map(u=><option key={u.id} value={u.id}>{u[lang]||u.th}</option>)}</select></div>
          <div style={{ flex:1 }}><Field label={TH?'คงเหลือ':'On hand'}><input className="kd-input num" type="number" value={f.stock} onChange={e=>upd('stock',Number(e.target.value))}/></Field></div>
        </div>
        <div style={{ display:'flex', gap:12, marginBottom:14 }}>
          <div style={{ flex:1 }}><Field label={TH?`ต้นทุนเฉลี่ย/${unitLabel(f.unit,lang)}`:`Avg cost/${unitLabel(f.unit,lang)}`}>
            <div style={{ position:'relative' }}><span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--ink-3)' }}>฿</span>
            <input className="kd-input num" style={{ paddingLeft:25 }} type="number" value={f.avgCost} onChange={e=>upd('avgCost',Number(e.target.value))}/></div></Field></div>
          <div style={{ flex:1 }}><Field label={TH?'เตือนเมื่อเหลือต่ำกว่า':'Low-stock alert'}><input className="kd-input num" type="number" value={f.low} onChange={e=>upd('low',Number(e.target.value))}/></Field></div>
        </div>
        <div className="kd-card" style={{ padding:'12px 15px', background:'var(--brand-softer)', boxShadow:'none', display:'flex', justifyContent:'space-between', fontSize:14 }}>
          <span style={{ fontWeight:600, color:'var(--ink-2)' }}>{TH?'มูลค่าคงเหลือ':'Stock value'}</span>
          <span className="num" style={{ fontWeight:700, color:'var(--brand-ink)' }}>{money(Math.round(rawValue(f)))}</span></div>
        <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:10, lineHeight:1.55 }}>{TH?'ต้นทุนเฉลี่ยจะอัปเดตอัตโนมัติทุกครั้งที่บันทึกซื้อของเข้า (เฉลี่ยถ่วงน้ำหนักตามราคาที่ซื้อ)':'Average cost updates automatically on each purchase (weighted by buy price).'}</div>
      </div>
      <div style={{ display:'flex', gap:10, padding:'12px 20px 0' }}>
        {onDelete && <button onClick={onDelete} className="kd-btn" style={{ background:'#FCECE8', color:'var(--danger)', padding:'15px 18px' }}>{React.cloneElement(IC.x,{size:18})}</button>}
        <button onClick={()=>onSave(f)} className="kd-btn kd-btn-primary" style={{ flex:1, padding:15 }} disabled={!f.th}>{TH?'บันทึก':'Save'}</button>
      </div>
    </Sheet>
  );
}

/* ══════════════ RECIPE EDITOR (used inside menu ItemEditor, stock mode) ══════════════ */
function RecipeEditor({ recipe, onChange, recipeByCh, onChangeCh, raw, addRaw, chanCfg }){
  const { lang } = useT(); const TH = lang==='th';
  const [activeCh,setActiveCh] = stState('__base');
  const rbc = recipeByCh||{};
  const modes = (chanCfg && typeof activeSaleModes==='function') ? activeSaleModes(chanCfg) : [];
  const hasCh = activeCh!=='__base' && modes.indexOf(activeCh)>=0;
  const override = hasCh && Array.isArray(rbc[activeCh]);
  const baseList = recipe||[];
  const editable = !hasCh || override;
  const list = override ? rbc[activeCh] : baseList;
  const total = list.reduce((a,[rmId,qty])=>{ const r=rawById(raw,rmId); return a+(r?(Number(r.avgCost)||0)*(Number(qty)||0):0); },0);
  const setList=(nl)=>{ if(hasCh){ onChangeCh && onChangeCh(activeCh, nl); } else onChange(nl); };
  const add=()=>setList([...list, ['','']]);
  const setLn=(i,idx,v)=>setList(list.map((ln,j)=>j===i?(idx===0?[v,ln[1]]:[ln[0],v]):ln));
  const del=(i)=>setList(list.filter((_,j)=>j!==i));
  const chLabel=(k)=> k==='__base' ? (TH?'ทุกช่องทาง':'Default') : (function(){ const m=chMeta(chanCfg,k); return m[lang]||m.th; })();
  return (
    <div className="kd-card" style={{ padding:'13px 15px', boxShadow:'none', background:'var(--bg)', marginBottom:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: list.length?10:0 }}>
        <div style={{ fontSize:14, fontWeight:700 }}>{React.cloneElement(IC.layers,{size:15, style:{verticalAlign:'-3px', marginRight:5}})}{TH?'สูตร · ตัดสต๊อกอัตโนมัติ':'Recipe · auto-deduct'}</div>
        {editable && <button onClick={add} style={{ border:'none', cursor:'pointer', background:'var(--brand-soft)', color:'var(--brand-ink)', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, padding:'6px 11px', borderRadius:999, display:'inline-flex', alignItems:'center', gap:4 }}>{React.cloneElement(IC.plus,{size:14})} {TH?'วัตถุดิบ':'Item'}</button>}
      </div>
      {/* channel tabs — สูตรแยกช่องทาง (แพ็กเกจต่างกัน) */}
      {modes.length>0 && <div className="kd-chiprow" style={{ marginBottom:10 }}>
        {['__base',...modes].map(k=>{ const on=(k==='__base'&&!hasCh)||k===activeCh; const cust=k!=='__base'&&Array.isArray(rbc[k]); return (
          <button key={k} onClick={()=>setActiveCh(k)} className={'kd-chip-btn'+(on?' on':'')} style={{ fontSize:12.5 }}>{cust && <span style={{ width:7, height:7, borderRadius:999, background:on?'#fff':'var(--brand)' }}/>}{chLabel(k)}</button>
        );})}
      </div>}
      {hasCh && !override && <div style={{ background:'#fff', borderRadius:11, padding:'11px 13px', marginBottom:10, boxShadow:'var(--shadow)' }}>
        <div style={{ fontSize:12.5, color:'var(--ink-2)', lineHeight:1.5, marginBottom:9 }}>{TH?'ช่องทางนี้ใช้ “สูตรทุกช่องทาง” อยู่ — ปรับเฉพาะช่องนี้ได้ถ้าแพ็กเกจต่าง (เช่น เพิ่มกล่อง/ถุงเดลิเวอรี)':'Uses the default recipe — customize if the packaging differs (e.g. add a delivery box/bag)'}</div>
        <button onClick={()=>onChangeCh && onChangeCh(activeCh, baseList.map(x=>x.slice()))} className="kd-btn kd-btn-primary" style={{ padding:'9px 13px', fontSize:13 }}>{TH?'คัดลอกสูตรเริ่มต้นมาแก้':'Copy default recipe & edit'}</button>
      </div>}
      {override && <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:8 }}>
        <select value="" onChange={e=>{ const src=e.target.value; if(!src) return; const list = src==='__base'?baseList:(rbc[src]||[]); onChangeCh && onChangeCh(activeCh, list.map(x=>x.slice())); e.target.value=''; }} style={{ ...ING_SEL, padding:'7px 8px', fontSize:12.5, maxWidth:'62%' }}>
          <option value="">{TH?'📋 คัดลอกสูตรจาก…':'📋 Copy from…'}</option>
          <option value="__base">{TH?'ทุกช่องทาง (เริ่มต้น)':'Default'}</option>
          {modes.filter(k=>k!==activeCh && Array.isArray(rbc[k])).map(k=><option key={k} value={k}>{chLabel(k)}</option>)}
        </select>
        <button onClick={()=>onChangeCh && onChangeCh(activeCh, null)} style={{ border:'none', cursor:'pointer', background:'none', color:'var(--danger)', fontFamily:'var(--font)', fontWeight:700, fontSize:12.5, whiteSpace:'nowrap' }}>↺ {TH?'ใช้สูตรเริ่มต้น':'Reset'}</button>
      </div>}
      {editable && <>
      {list.length===0 && <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:6, lineHeight:1.55 }}>{TH?'เลือกวัตถุดิบที่ใช้ต่อ 1 จาน ระบบจะคิดต้นทุนจากราคาเฉลี่ยและตัดสต๊อกให้อัตโนมัติเมื่อขาย — หรือปล่อยว่างไว้ แล้วกรอก “ต้นทุน” ต่อชิ้นด้านบนเองก็ได้ (สำหรับของซื้อมาขายต่อ เช่น ขนม/น้ำ)':'Pick materials used per dish — cost is computed from avg price and stock auto-deducts on sale. Or leave empty and type a per-piece cost above (for resold items like snacks).'}</div>}
      {list.length>0 && <div style={{ display:'flex', gap:6, alignItems:'center', padding:'2px 8px 5px', fontSize:10.5, fontWeight:700, color:'var(--ink-3)' }}>
        <span style={{ flex:1, minWidth:0 }}>{TH?'วัตถุดิบ':'Material'}</span>
        <span style={{ width:46, textAlign:'center', flexShrink:0 }}>{TH?'ใช้/จาน':'Per dish'}</span>
        <span style={{ width:26, flexShrink:0 }}></span>
        <span style={{ width:54, textAlign:'right', flexShrink:0 }}>{TH?'ต้นทุน':'Cost'}</span>
        <span style={{ width:18, flexShrink:0 }}></span>
      </div>}
      {list.map(([rmId,qty],i)=>{ const r=rawById(raw,rmId); const c=r?(Number(r.avgCost)||0)*(Number(qty)||0):0; return (
        <div key={i} style={{ display:'flex', gap:6, alignItems:'center', background:'#fff', borderRadius:11, padding:'6px 9px', marginBottom:6, boxShadow:'var(--shadow)' }}>
          <select style={{ ...ING_SEL, flex:1, minWidth:0, padding:'8px 6px' }} value={rmId} onChange={e=>setLn(i,0,e.target.value)}>
            <option value="">{TH?'เลือกวัตถุดิบ…':'Pick material…'}</option>
            {RAW_CATS.map(c2=>{ const its=raw.filter(x=>x.cat===c2.id); if(!its.length) return null; return (
              <optgroup key={c2.id} label={c2[lang]||c2.th}>{its.map(x=><option key={x.id} value={x.id}>{x.th}</option>)}</optgroup>
            );})}
          </select>
          <input className="kd-input num" style={{ width:46, padding:'8px 4px', textAlign:'center', flexShrink:0 }} type="number" value={qty} onChange={e=>setLn(i,1,e.target.value===''?'':Number(e.target.value))} placeholder="0"/>
          <span style={{ fontSize:12, color:'var(--ink-3)', width:26, flexShrink:0, textAlign:'left' }}>{r?unitLabel(r.unit,lang):''}</span>
          <span className="num" style={{ width:54, textAlign:'right', flexShrink:0, fontSize:13, fontWeight:700, color: c>0?'var(--brand-ink)':'var(--ink-3)' }}>{bahtDec(c)}</span>
          <button onClick={()=>del(i)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--ink-3)', padding:0, width:18, flexShrink:0, display:'flex', justifyContent:'center' }}>{React.cloneElement(IC.x,{size:15})}</button>
        </div>
      );})}
      {list.length>0 && <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, borderTop:'1px solid var(--hair)', fontWeight:700, fontSize:14 }}>
        <span>{TH?'รวมต้นทุน/จาน':'Total / dish'}</span><span className="num">{bahtDec(total)}</span></div>}
      </>}
    </div>
  );
}

/* ══════════════ WASTE SHEET (ตัดของเสีย/ทิ้ง) ══════════════ */
function WasteSheet({ raw, onSave, onClose }){
  const { lang } = useT(); const TH = lang==='th';
  const [rmId,setRmId] = stState((raw[0]&&raw[0].id)||'');
  const [qty,setQty]   = stState('');
  const [unit,setUnit] = stState('');
  const [reason,setReason] = stState('');
  const r = rawById(raw, rmId);
  const units = r ? buyUnitsFor(r.unit) : RUNITS;
  const u = unit || (r? r.unit : 'g');
  const dq = r ? convQty(Number(qty)||0, u, r.unit) : 0;
  const cost = dq * ((r&&Number(r.avgCost))||0);
  const REASONS = TH ? ['เน่า/หมดอายุ','ทำหก/ตก','เผาไหม้','ลูกค้าคืน','อื่นๆ'] : ['Spoiled','Dropped','Burnt','Returned','Other'];
  const ok = rmId && (Number(qty)||0)>0;
  return (
    <Sheet open={true} onClose={onClose} height="82%">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 20px 12px' }}>
        <div style={{ fontSize:19, fontWeight:700 }}>🗑️ {TH?'ตัดของเสีย':'Record waste'}</div>
        <button onClick={onClose} style={{ border:'none', background:'var(--bg)', width:34, height:34, borderRadius:999, cursor:'pointer' }}>{IC.x}</button>
      </div>
      <div style={{ overflowY:'auto', padding:'0 20px', flex:1 }}>
        <div style={{ fontSize:13, color:'var(--ink-3)', marginBottom:14, lineHeight:1.5 }}>{TH?'เลือกวัตถุดิบที่เสีย/ทิ้ง ระบบจะหักออกจากสต๊อกและบันทึกมูลค่าที่เสียไว้ในรายงาน':'Pick what spoiled — deducted from stock and logged as waste cost.'}</div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-2)', marginBottom:6 }}>{TH?'วัตถุดิบ':'Raw material'}</div>
          <select className="kd-input" value={rmId} onChange={e=>{ setRmId(e.target.value); setUnit(''); }} style={{ width:'100%' }}>
            {raw.map(x=>(<option key={x.id} value={x.id}>{x.th} · {TH?'เหลือ':'left'} {fmtQty(x.stock)} {unitLabel(x.unit,lang)}</option>))}
          </select>
        </div>
        <div style={{ display:'flex', gap:10, marginBottom:14 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-2)', marginBottom:6 }}>{TH?'จำนวนที่เสีย':'Quantity'}</div>
            <input className="kd-input num" type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0"/>
          </div>
          <div style={{ width:120 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-2)', marginBottom:6 }}>{TH?'หน่วย':'Unit'}</div>
            <select className="kd-input" value={u} onChange={e=>setUnit(e.target.value)} style={{ width:'100%' }}>
              {units.map(x=>(<option key={x.id} value={x.id}>{unitLabel(x.id,lang)}</option>))}
            </select>
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-2)', marginBottom:6 }}>{TH?'เหตุผล':'Reason'}</div>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
            {REASONS.map(rs=>(<button key={rs} onClick={()=>setReason(rs)} style={{ border:'none', cursor:'pointer', padding:'8px 13px', borderRadius:999, fontFamily:'var(--font)', fontWeight:600, fontSize:13, background: reason===rs?'var(--brand)':'var(--bg)', color: reason===rs?'#fff':'var(--ink-2)' }}>{rs}</button>))}
          </div>
        </div>
        {ok && <div className="kd-card" style={{ padding:'12px 15px', background:'#FCECE8', boxShadow:'none' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13.5 }}>
            <span style={{ color:'var(--danger)', fontWeight:600 }}>{TH?'มูลค่าที่เสีย':'Waste value'}</span>
            <span className="num" style={{ fontWeight:800, color:'var(--danger)' }}>-{money(Math.round(cost))}</span>
          </div>
          <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:4 }} className="num">{TH?'หักสต๊อก':'deduct'} {fmtQty(dq)} {unitLabel(r.unit,lang)}</div>
        </div>}
      </div>
      <div style={{ padding:'12px 20px 0' }}>
        <button onClick={()=>ok&&onSave({ rmId, qty, unit:u, reason })} disabled={!ok}
          className="kd-btn kd-btn-primary kd-btn-block" style={{ padding:15, opacity:ok?1:.5, background: ok?'var(--danger)':'var(--hair-2)' }}>
          {TH?'ยืนยันตัดของเสีย':'Confirm waste'}</button>
      </div>
    </Sheet>
  );
}

Object.assign(window, { StockScreen, ShoppingList, PurchaseSheet, RawEditor, RecipeEditor, WasteSheet, unitLabel });
