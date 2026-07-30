/* kd-wallet.jsx — กระเป๋าเงินแพลตฟอร์ม (ใช้ร่วมทุกโมดูล: ร้านค้า POS · ฟิตเนส · ตลาด · วิน)
   • ผู้ใช้เติมเงินเข้ากระเป๋าของตัวเอง (พร้อมเพย์) → ค่าบริการระบบทุกอย่างหักจากกระเป๋านี้
   • ทุกการหัก = เขียนรายได้เข้า ledger แพลตฟอร์ม (kd_platform_wallet_v1) เหมือนยืนยันว่าได้รับยอดแล้ว
   • ตัดอัตโนมัติเมื่อครบรอบ (autopay) ถ้ายอดพอ · ไม่พอ = เตือนให้เติม (ไม่ต้องผูกบัตร)
   • หน้ากระเป๋าอยู่ใน "เมนูแพ็กเกจ" ของแต่ละโมดูล — หน้าสมัคร/หน้าแรกไม่ต้องกรอกข้อมูลจ่ายเงิน
   API: window.KDW  ·  UI: <KDWalletPanel/> (window.KDWalletPanel) */
(function(){
  const BIZ_KEY='kd_biz_wallet_v1';        // { "<biz>": {balance, ledger:[], auto:bool, updatedAt} }
  const PLAT_KEY='kd_platform_wallet_v1';  // ledger รายได้ผู้ให้บริการระบบ (ของเดิม)
  const r2=(n)=>Math.round((Number(n)||0)*100)/100;
  const B=(n)=>'฿'+Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:2});
  const nowISO=()=>new Date().toISOString();

  function readAll(){ try{ return JSON.parse(localStorage.getItem(BIZ_KEY))||{}; }catch(e){ return {}; } }
  function writeAll(all){ try{ localStorage.setItem(BIZ_KEY,JSON.stringify(all)); }catch(e){} try{ window.dispatchEvent(new CustomEvent('kdw-change')); }catch(e){} }
  function acc(biz){ const all=readAll(); const a=all[biz]||{balance:0,ledger:[],auto:true};
    return { balance:Number(a.balance)||0, ledger:Array.isArray(a.ledger)?a.ledger:[], auto:a.auto!==false, updatedAt:a.updatedAt||0 }; }
  function put(biz,patch){ const all=readAll(); const a=acc(biz); all[biz]={...a,...patch,updatedAt:Date.now()}; writeAll(all); return all[biz]; }

  function platRevenue(e){ // e={who,sub,amt,method,type}
    try{ const w=JSON.parse(localStorage.getItem(PLAT_KEY))||{ledger:[]}; w.ledger=w.ledger||[];
      w.ledger.unshift({ id:'t'+Date.now()+Math.random().toString(36).slice(2,5), date:nowISO().slice(0,10),
        type:e.type||'saas', who:e.who||'ผู้ใช้ระบบ', sub:e.sub||'ค่าบริการระบบ', amt:r2(e.amt), method:e.method||'กระเป๋าเงิน (Wallet)' });
      w.updatedAt=Date.now(); localStorage.setItem(PLAT_KEY,JSON.stringify(w));
      if(window.__platWalletSync) window.__platWalletSync.push();
    }catch(e){}
  }

  const KDW={
    BIZ_KEY, PLAT_KEY, fmt:B,
    /* biz id: KDW.biz('pos','shop123') → 'pos:shop123' */
    biz(mod,id){ return String(mod||'app')+':'+String(id||'main'); },
    get:acc,
    balance(biz){ return acc(biz).balance; },
    ledger(biz){ return acc(biz).ledger; },
    auto(biz){ return acc(biz).auto; },
    setAuto(biz,on){ put(biz,{auto:!!on}); return !!on; },

    /* เติมเงิน (พร้อมเพย์/โอน) — ระบบจริงยืนยันจาก webhook/VA · เดโมยืนยันในแอป */
    topup(biz,amount,opt){ const a=r2(amount); if(!(a>0)) return {ok:false,error:'จำนวนเงินไม่ถูกต้อง',balance:acc(biz).balance};
      const cur=acc(biz); const bal=r2(cur.balance+a);
      const led=[...cur.ledger,{ts:nowISO(),type:'topup',amount:a,bal,note:(opt&&opt.note)||('เติมเงินกระเป๋า · '+((opt&&opt.method)||'พร้อมเพย์')),method:(opt&&opt.method)||'promptpay'}];
      put(biz,{balance:bal,ledger:led}); return {ok:true,balance:bal};
    },

    /* หักค่าบริการระบบจากกระเป๋า → บันทึกรายได้แพลตฟอร์ม (= ได้รับยอดแล้ว) */
    charge(biz,amount,opt){ const a=r2(amount); const cur=acc(biz);
      if(!(a>0)) return {ok:false,error:'จำนวนเงินไม่ถูกต้อง',balance:cur.balance,short:0};
      if(cur.balance<a) return {ok:false,error:'ยอดกระเป๋าไม่พอ',balance:cur.balance,short:r2(a-cur.balance)};
      const bal=r2(cur.balance-a); const note=(opt&&opt.sub)||'ค่าบริการระบบ';
      const led=[...cur.ledger,{ts:nowISO(),type:(opt&&opt.type)||'fee',amount:-a,bal,note,ref:(opt&&opt.ref)||''}];
      put(biz,{balance:bal,ledger:led});
      platRevenue({who:(opt&&opt.who)||biz,sub:note,amt:a,type:(opt&&opt.platType)||'saas'});
      return {ok:true,balance:bal,short:0};
    },

    /* ตัดอัตโนมัติเมื่อใกล้/ครบกำหนด — เรียกตอนเปิดหน้าแพ็กเกจหรือเปิดแอป
       opt={amount,expiry,days=30,leadDays=0,who,sub,ref} → {charged,expiry,balance,short,skipped} */
    autoRenew(biz,opt){ const cur=acc(biz); const amount=r2(opt&&opt.amount);
      if(!cur.auto) return {charged:false,skipped:'auto-off',balance:cur.balance};
      if(!(amount>0)) return {charged:false,skipped:'free',balance:cur.balance};
      const exp=opt&&opt.expiry?new Date(opt.expiry):null; const lead=Number(opt&&opt.leadDays)||0;
      if(exp && (exp-Date.now())/86400000 > lead) return {charged:false,skipped:'not-due',balance:cur.balance};
      const res=this.charge(biz,amount,{who:opt&&opt.who,sub:(opt&&opt.sub)||'ต่ออายุอัตโนมัติ (หักจากกระเป๋า)',ref:opt&&opt.ref,type:'renew'});
      if(!res.ok) return {charged:false,skipped:'insufficient',balance:res.balance,short:res.short};
      const base=exp&&exp>new Date()?exp:new Date(); base.setDate(base.getDate()+(Number(opt&&opt.days)||30));
      return {charged:true,expiry:base.toISOString(),balance:res.balance,short:0};
    },
  };
  /* ══ ฝั่ง "รับเงินจากลูกค้า" — 2 โหมด ใช้ร่วมทุกโมดูล ══
     • legacy  = แบบเก่า: เงินสด / QR พร้อมเพย์บัญชีร้าน · พนักงานกดยืนยันเอง (แนบสลิป)
     • auto    = กระเป๋าร้าน (จับยอดอัตโนมัติ): QR/VA ออกในชื่อ "บัญชีร้านเอง" → เงินเข้าบัญชีร้านโดยตรง
                 ระบบแค่จับคู่ยอด↔บิลให้อัตโนมัติ (ง่ายกว่าไลน์บอท) — แพลตฟอร์มไม่ถือเงินลูกค้า
     ⚖️ ข้อกฎหมาย: ยังไม่มีใบอนุญาต e-money → กระเป๋าในระบบเป็น closed-loop
        ใช้ "จ่ายค่าบริการระบบ" เท่านั้น · ถอนเป็นเงินสด/โอนออกไม่ได้ · ยอดขายของร้านไม่ผ่านกระเป๋า */
  const SALES_KEY='kd_biz_sales_v1';   // { "<biz>": {mode,gross,ledger:[],acct,updatedAt} }
  function salesAll(){ try{ return JSON.parse(localStorage.getItem(SALES_KEY))||{}; }catch(e){ return {}; } }
  function salesGet(biz){ const a=salesAll()[biz]||{}; return { mode:a.mode==='auto'?'auto':'legacy', gross:Number(a.gross)||0,
    ledger:Array.isArray(a.ledger)?a.ledger:[], acct:a.acct||null, updatedAt:a.updatedAt||0 }; }
  function salesPut(biz,patch){ const all=salesAll(); const cur=salesGet(biz); all[biz]={...cur,...patch,updatedAt:Date.now()};
    try{ localStorage.setItem(SALES_KEY,JSON.stringify(all)); }catch(e){}
    try{ window.dispatchEvent(new CustomEvent('kdw-change')); }catch(e){} return all[biz]; }
  Object.assign(KDW,{
    SALES_KEY,
    recvMode(biz){ return salesGet(biz).mode; },
    setRecvMode(biz,mode){ salesPut(biz,{mode:mode==='auto'?'auto':'legacy'}); return this.recvMode(biz); },
    recvAcct(biz){ return salesGet(biz).acct; },
    setRecvAcct(biz,acct){ salesPut(biz,{acct:acct||null}); return acct; },
    sales:salesGet,
    /* บันทึกยอดที่รับจากลูกค้า — เงินเข้า "บัญชีร้าน" ตรง ไม่เข้ากระเป๋าระบบ
       opt={who,ref,method:'cash'|'promptpay'|'transfer'|'card',auto:true|false,note} */
    receive(biz,amount,opt){ const a=r2(amount); if(!(a>0)) return {ok:false,error:'จำนวนเงินไม่ถูกต้อง'};
      const cur=salesGet(biz); const gross=r2(cur.gross+a);
      const led=[...cur.ledger,{ts:nowISO(),type:'sale',amount:a,gross,
        note:(opt&&opt.note)||('รับเงินลูกค้า'+((opt&&opt.who)?' · '+opt.who:'')),
        method:(opt&&opt.method)||'promptpay', ref:(opt&&opt.ref)||'', auto:!!(opt&&opt.auto)}];
      salesPut(biz,{gross,ledger:led}); return {ok:true,gross};
    },
    /* ยกเลิก/คืนเงินลูกค้า (บันทึกกลับในเดินบัญชีของร้าน) */
    refund(biz,amount,opt){ const a=r2(amount); if(!(a>0)) return {ok:false,error:'จำนวนเงินไม่ถูกต้อง'};
      const cur=salesGet(biz); const gross=r2(cur.gross-a);
      const led=[...cur.ledger,{ts:nowISO(),type:'refund',amount:-a,gross,note:(opt&&opt.note)||'คืนเงินลูกค้า',ref:(opt&&opt.ref)||''}];
      salesPut(biz,{gross,ledger:led}); return {ok:true,gross};
    },
    /* ถอนกระเป๋าเป็นเงินสด = ทำไม่ได้ (closed-loop) — เรียกไว้เพื่อให้ UI อธิบายเหตุผลเหมือนกันทุกที่ */
    withdraw(){ return {ok:false,error:'กระเป๋าในระบบใช้จ่ายค่าบริการเท่านั้น · ถอนเป็นเงินสดไม่ได้ (ยังไม่มีใบอนุญาตเงินอิเล็กทรอนิกส์) — ยอดขายของร้านเข้าบัญชีร้านโดยตรงอยู่แล้ว'}; },
  });
  window.KDW=KDW;

  /* ══ UI: แผงกระเป๋าเงิน (ใช้ได้ทุกโมดูล · inline style อ่านสีจากธีมของหน้านั้น) ══ */
  const QUICK=[500,1000,2000,5000];
  function KDWalletPanel({ biz, who, due, dueLabel, qr, compact, onChange }){
    const R=window.React; const {useState}=R;
    const [tick,setTick]=useState(0);
    const a=KDW.get(biz);
    const [amt,setAmt]=useState(1000);
    const [msg,setMsg]=useState('');
    const [log,setLog]=useState(false);
    const short=due?Math.max(0,r2(due-a.balance)):0;
    const bump=()=>{ setTick(t=>t+1); onChange&&onChange(KDW.get(biz)); };
    const topup=()=>{ const v=r2(amt); const res=KDW.topup(biz,v,{note:'เติมเงินกระเป๋า · พร้อมเพย์',method:'promptpay'});
      if(!res.ok){ setMsg(res.error); return; } setMsg('เติมเงินแล้ว '+B(v)+' · ยอดคงเหลือ '+B(res.balance)); bump(); };
    const card={background:'#fff',border:'1px solid var(--hair,#E7E7E4)',borderRadius:16,padding:16};
    const hint={fontSize:12,color:'var(--ink-3,#8A8A85)'};
    return (
      <div style={card} data-kdw={biz}>
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:10}}>
          <div><div style={{...hint,fontWeight:600}}>👛 กระเป๋าเงินของคุณ (ใช้จ่ายค่าบริการระบบ)</div>
            <div style={{fontSize:28,fontWeight:800,color:'var(--brand-ink,#12805A)',lineHeight:1.2}}>{B(a.balance)}</div></div>
          {due?<div style={{textAlign:'right',fontSize:12.5,fontWeight:700,color:short>0?'var(--red,#C0392B)':'var(--brand-ink,#12805A)'}}>
            {short>0?('ขาดอีก '+B(short)):'พอสำหรับรอบถัดไป'}<div style={{...hint,fontWeight:500}}>{dueLabel||('ยอดที่ต้องชำระ '+B(due))}</div></div>:null}
        </div>
        <label style={{display:'flex',gap:9,alignItems:'center',marginTop:12,cursor:'pointer'}}>
          <input type="checkbox" checked={a.auto} onChange={e=>{ KDW.setAuto(biz,e.target.checked); bump(); }} style={{width:19,height:19,accentColor:'var(--brand,#16A97A)'}}/>
          <span style={{fontSize:12.5,color:'var(--ink-2,#4A4A46)',lineHeight:1.5}}>ตัดค่าบริการอัตโนมัติจากกระเป๋าเมื่อครบรอบ · ไม่ต้องผูกบัตรเครดิต</span>
        </label>
        {!compact && <React.Fragment>
          <div style={{marginTop:10,background:'var(--gold-soft,#FFF6E2)',borderRadius:11,padding:'9px 11px',fontSize:11.5,color:'#7A5B08',lineHeight:1.55}}>ยอดในกระเป๋าใช้จ่ายค่าบริการในระบบเท่านั้น · ถอนเป็นเงินสดไม่ได้ (closed-loop)</div>
          <div style={{height:1,background:'var(--hair,#EFEFEC)',margin:'13px 0'}}/>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>เติมเงินเข้ากระเป๋า</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:9}}>
            {QUICK.map(q=>(<button key={q} onClick={()=>{setAmt(q);setMsg('');}} style={{flex:'1 1 70px',padding:'10px 6px',borderRadius:11,cursor:'pointer',fontWeight:700,fontSize:13.5,fontFamily:'inherit',
              border:'1.6px solid '+(r2(amt)===q?'var(--brand,#16A97A)':'var(--hair,#E2E2DE)'),background:r2(amt)===q?'var(--brand-soft,#E9F7F1)':'#fff',color:r2(amt)===q?'var(--brand-ink,#12805A)':'var(--ink-2,#4A4A46)'}}>{B(q)}</button>))}
          </div>
          <input value={amt} inputMode="numeric" onChange={e=>{setAmt(e.target.value.replace(/\D/g,''));setMsg('');}} placeholder="ระบุจำนวนเงิน"
            style={{width:'100%',boxSizing:'border-box',padding:'12px 13px',borderRadius:12,border:'1.5px solid var(--hair,#E2E2DE)',fontSize:15,fontFamily:'inherit',background:'#fff'}}/>
          {qr?<div style={{textAlign:'center',marginTop:12}}>{qr}<div style={hint}>สแกนพร้อมเพย์เพื่อเติมเงิน · ระบบจริงจับยอดเข้าอัตโนมัติ (VA/webhook)</div></div>:null}
          <button onClick={topup} style={{width:'100%',marginTop:12,padding:13,borderRadius:12,cursor:'pointer',fontWeight:700,fontSize:14.5,fontFamily:'inherit',
            border:'1.6px solid var(--brand,#16A97A)',background:'var(--brand-soft,#E9F7F1)',color:'var(--brand-ink,#12805A)'}}>ยืนยันเติมเงิน {B(r2(amt))}</button>
          {msg?<div style={{marginTop:10,fontSize:12.5,fontWeight:600,color:'var(--ink-2,#4A4A46)',background:'var(--brand-softer,#F4FBF8)',borderRadius:11,padding:'10px 12px'}}>{msg}</div>:null}
          <button onClick={()=>setLog(v=>!v)} style={{border:'none',background:'none',color:'var(--brand-ink,#12805A)',fontWeight:700,fontSize:12.5,cursor:'pointer',marginTop:10,padding:0,fontFamily:'inherit'}}>{log?'ซ่อนเดินบัญชี':'ดูเดินบัญชีกระเป๋า'}</button>
          {log?<div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
            {a.ledger.length?[...a.ledger].reverse().slice(0,25).map((l,i)=>(
              <div key={i} style={{display:'flex',gap:10,alignItems:'center',background:'var(--bg,#F7F7F5)',borderRadius:10,padding:'9px 11px'}}>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.note}</div>
                  <div style={{fontSize:11,color:'var(--ink-3,#8A8A85)'}}>{new Date(l.ts).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div>
                <div style={{fontSize:13.5,fontWeight:800,color:l.amount>0?'var(--brand-ink,#12805A)':'var(--ink,#22221F)'}}>{l.amount>0?'+':''}{B(l.amount)}</div>
              </div>)):<div style={{...hint,padding:'8px 2px'}}>ยังไม่มีรายการ</div>}
          </div>:null}
        </React.Fragment>}
      </div>
    );
  }
  window.KDWalletPanel=KDWalletPanel;

  /* ══ UI: ตั้งค่ารับเงินจากลูกค้า (2 โหมด) — ใช้ร่วมทุกโมดูล ══
     props: biz who qr acctLabel onChange  ·  qr = element QR พร้อมเพย์ของร้าน (ถ้ามี) */
  function KDReceivePanel({ biz, who, qr, acctLabel, compact, onChange }){
    const R=window.React; const {useState}=R;
    const [tick,setTick]=useState(0);
    const s=KDW.sales(biz);
    const [log,setLog]=useState(false);
    const bump=()=>{ setTick(t=>t+1); onChange&&onChange(KDW.sales(biz)); };
    const pick=(m)=>{ KDW.setRecvMode(biz,m); bump(); };
    const card={background:'#fff',border:'1px solid var(--hair,#E7E7E4)',borderRadius:16,padding:16};
    const hint={fontSize:12,color:'var(--ink-3,#8A8A85)'};
    const MODES=[
      ['legacy','💵 รับเงินแบบเดิม','เงินสด · QR พร้อมเพย์บัญชีร้าน · พนักงานกดยืนยัน/แนบสลิปเอง'],
      ['auto','👛 กระเป๋าร้าน · จับยอดอัตโนมัติ','QR ออกต่อบิล (บัญชีร้านเอง) → เงินเข้าบัญชีร้านตรง ระบบจับคู่ยอดกับบิลให้เอง ไม่ต้องใช้ไลน์บอท'],
    ];
    return (
      <div style={card} data-kdrecv={biz}>
        <div style={{...hint,fontWeight:600,marginBottom:2}}>วิธีรับเงินจากลูกค้า</div>
        <div style={{fontSize:13,color:'var(--ink-2,#4A4A46)',marginBottom:11}}>เลือกได้ 2 แบบ · เปลี่ยนเมื่อไรก็ได้ ยอดเก่ายังอยู่</div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {MODES.map(([k,t,d])=>(
            <label key={k} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'11px 12px',cursor:'pointer',borderRadius:12,
              border:'1.6px solid '+(s.mode===k?'var(--brand,#16A97A)':'var(--hair,#E2E2DE)'),background:s.mode===k?'var(--brand-softer,#F4FBF8)':'#fff'}}>
              <input type="radio" checked={s.mode===k} onChange={()=>pick(k)} style={{marginTop:2,width:17,height:17,accentColor:'var(--brand,#16A97A)'}}/>
              <span style={{flex:1,minWidth:0}}><span style={{display:'block',fontSize:13.5,fontWeight:700}}>{t}</span>
                <span style={{...hint,display:'block',lineHeight:1.5,marginTop:2}}>{d}</span></span>
            </label>))}
        </div>
        {s.mode==='auto'&&<div style={{marginTop:12}}>
          {qr?<div style={{textAlign:'center'}}>{qr}</div>:null}
          <div style={{background:'var(--bg,#F7F7F5)',borderRadius:12,padding:'11px 12px',marginTop:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}><span>ยอดรับจากลูกค้า (สะสม)</span><b>{B(s.gross)}</b></div>
            <div style={{...hint,marginTop:4,lineHeight:1.55}}>เข้าบัญชี{acctLabel?' '+acctLabel:'ร้าน'}โดยตรง · ระบบบันทึก/จับคู่บิลให้ ไม่ได้ถือเงินแทนร้าน</div>
          </div>
        </div>}
        {!compact&&<React.Fragment>
          <div style={{marginTop:11,background:'var(--gold-soft,#FFF6E2)',borderRadius:12,padding:'10px 12px',fontSize:12,color:'#7A5B08',lineHeight:1.6}}>
            ⚖️ กระเป๋าในระบบใช้ <b>จ่ายค่าบริการระบบ</b> เท่านั้น · <b>ถอนเป็นเงินสดไม่ได้</b> (ยังไม่มีใบอนุญาตเงินอิเล็กทรอนิกส์) — ยอดขายของร้านเข้าบัญชีร้านเองทุกบาท
          </div>
          <button onClick={()=>setLog(v=>!v)} style={{border:'none',background:'none',color:'var(--brand-ink,#12805A)',fontWeight:700,fontSize:12.5,cursor:'pointer',marginTop:10,padding:0,fontFamily:'inherit'}}>{log?'ซ่อนเดินบัญชีรับเงิน':'ดูเดินบัญชีรับเงินลูกค้า'}</button>
          {log?<div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
            {s.ledger.length?[...s.ledger].reverse().slice(0,25).map((l,i)=>(
              <div key={i} style={{display:'flex',gap:10,alignItems:'center',background:'var(--bg,#F7F7F5)',borderRadius:10,padding:'9px 11px'}}>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.note}</div>
                  <div style={{fontSize:11,color:'var(--ink-3,#8A8A85)'}}>{new Date(l.ts).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · {l.method||'—'}{l.auto?' · จับยอดอัตโนมัติ':''}</div></div>
                <div style={{fontSize:13.5,fontWeight:800,color:l.amount>0?'var(--brand-ink,#12805A)':'var(--red,#C0392B)'}}>{l.amount>0?'+':''}{B(l.amount)}</div>
              </div>)):<div style={{...hint,padding:'8px 2px'}}>ยังไม่มีรายการรับเงิน</div>}
          </div>:null}
        </React.Fragment>}
      </div>
    );
  }
  window.KDReceivePanel=KDReceivePanel;
})();
