/* kd-wallet.jsx — กระเป๋าเงินค่าบริการระบบ (ใช้ร่วมทุกโมดูล: ร้านค้า POS · ฟิตเนส · ตลาด · วิน)
   สถาปัตยกรรม (ตั้งแต่ 30 ก.ค. รอบ 10):
   • ยอดคงเหลือจริง + ประวัติการทำรายการ อยู่ที่ backend (D1: wallets / wallet_txns) — localStorage เป็นแค่สำเนาไว้โชว์
   • เติมเงิน = ยื่นคำขอ (status pending) → เข้ายอดเมื่อ (ก) ระบบตรวจสลิปกับธนาคารผ่าน หรือ (ข) webhook ยอดเข้าบัญชี หรือ (ค) แอดมินยืนยัน
   • หักค่าบริการ = ฝั่งเซิร์ฟตัดยอดแบบ atomic + กันกดซ้ำด้วย idem + บันทึกรายได้แพลตฟอร์ม
   ⚖️ closed-loop: ยอดในกระเป๋าใช้จ่ายค่าบริการระบบเท่านั้น — ถอนเป็นเงินสด/โอนออกไม่ได้ (ห้ามเปิด ยังไม่มีใบอนุญาตเงินอิเล็กทรอนิกส์)
   API: window.KDW · UI: <KDWalletPanel/> <KDWalletHistory/> <KDReceivePanel/> */
(function(){
  const BIZ_KEY='kd_biz_wallet_v1';        // สำเนาในเครื่อง { "<biz>": {balance, ledger:[], auto, updatedAt, pendingAmount} }
  const PLAT_KEY='kd_platform_wallet_v1';  // ledger รายได้ผู้ให้บริการระบบ (สำเนาโชว์ในหน้าแอดมิน)
  const r2=(n)=>Math.round((Number(n)||0)*100)/100;
  const B=(n)=>'฿'+Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const nowISO=()=>new Date().toISOString();

  function readAll(){ try{ return JSON.parse(localStorage.getItem(BIZ_KEY))||{}; }catch(e){ return {}; } }
  function writeAll(all){ try{ localStorage.setItem(BIZ_KEY,JSON.stringify(all)); }catch(e){} try{ window.dispatchEvent(new CustomEvent('kdw-change')); }catch(e){} }
  function acc(biz){ const all=readAll(); const a=all[biz]||{};
    return { balance:Number(a.balance)||0, ledger:Array.isArray(a.ledger)?a.ledger:[], auto:a.auto!==false,
      updatedAt:a.updatedAt||0, pendingAmount:Number(a.pendingAmount)||0, pendingCount:Number(a.pendingCount)||0, live:!!a.live }; }
  function put(biz,patch){ const all=readAll(); const a=acc(biz); all[biz]={...a,...patch,updatedAt:Date.now()}; writeAll(all); return all[biz]; }

  /* ── ต่อ backend ── */
  function base(){ try{ return (window.KD_API_BASE||localStorage.getItem('kd_api_base')||'').replace(/\/+$/,''); }catch(e){ return ''; } }
  function tok(){ try{ return sessionStorage.getItem('kd_admin_tok')||localStorage.getItem('kd_admin_tok')||''; }catch(e){ return ''; } }
  async function api(path,opt){
    const b=base(); if(!b) return {__offline:true};
    const o=opt||{}; const h={'Content-Type':'application/json'}; if(tok()) h['X-Admin-Token']=tok();
    const r=await fetch(b+path,{method:o.method||'GET',headers:h,body:o.body?JSON.stringify(o.body):undefined});
    let j=null; try{ j=await r.json(); }catch(e){}
    if(!r.ok) return {__err:true,status:r.status,...(j||{})};
    return j||{};
  }
  const enc=(biz)=>encodeURIComponent(biz);

  /* บันทึกรายได้แพลตฟอร์ม (สำเนาในเครื่องสำหรับหน้าแอดมิน — ของจริงอยู่ตาราง platform_revenue) */
  function platRevenue(e){
    try{ const w=JSON.parse(localStorage.getItem(PLAT_KEY))||{ledger:[]}; w.ledger=w.ledger||[];
      w.ledger.unshift({ id:'t'+Date.now()+Math.random().toString(36).slice(2,5), date:nowISO().slice(0,10),
        type:e.type||'saas', who:e.who||'ผู้ใช้ระบบ', sub:e.sub||'ค่าบริการระบบ', amt:r2(e.amt), method:e.method||'กระเป๋าเงิน (Wallet)', ref:e.ref||'' });
      w.updatedAt=Date.now(); localStorage.setItem(PLAT_KEY,JSON.stringify(w));
      if(window.__platWalletSync) window.__platWalletSync.push();
    }catch(e){}
  }

  const KDW={
    BIZ_KEY, PLAT_KEY, fmt:B, r2,
    biz(mod,id){ return String(mod||'app')+':'+String(id||'main'); },
    live(){ return !!base(); },
    get:acc,
    balance(biz){ return acc(biz).balance; },
    ledger(biz){ return acc(biz).ledger; },
    auto(biz){ return acc(biz).auto; },

    /* ดึงยอด + ประวัติจากเซิร์ฟเวอร์ (เรียกตอนเปิดหน้ากระเป๋า) */
    async pull(biz,limit){
      if(!base()) return acc(biz);
      const [w,tx]=await Promise.all([ api('/wallet/'+enc(biz)), api('/wallet/'+enc(biz)+'/txns?limit='+(limit||60)) ]);
      if(w&&!w.__err&&!w.__offline){
        put(biz,{ balance:r2(w.balance), auto:w.auto!==false, live:true,
          pendingAmount:r2(w.pendingAmount), pendingCount:Number(w.pendingCount)||0,
          ledger:Array.isArray(tx)?tx.map(t=>({ ts:t.ts, ref:t.ref, type:t.type, amount:Number(t.amount),
            bal:t.balance_after===null?null:Number(t.balance_after), note:t.note, method:t.method, status:t.status })):acc(biz).ledger });
      }
      return acc(biz);
    },
    async txns(biz,limit){ const r=await api('/wallet/'+enc(biz)+'/txns?limit='+(limit||60)); return Array.isArray(r)?r:acc(biz).ledger; },

    async setAuto(biz,on){ put(biz,{auto:!!on}); if(base()) await api('/wallet/'+enc(biz)+'/auto',{method:'POST',body:{on:!!on}}); return !!on; },

    /* ยื่นคำขอเติมเงิน — ยอดยังไม่ขึ้นจนกว่าจะตรวจผ่าน/แอดมินยืนยัน
       opt={slip(dataURL) · qrPayload(ข้อความใน QR สลิป) · method · who · note} */
    async topupRequest(biz,amount,opt){
      const a=r2(amount); const o=opt||{};
      if(!(a>0)) return {ok:false,error:'จำนวนเงินไม่ถูกต้อง'};
      if(!base()){   // โหมดเดโม/ออฟไลน์ — ไม่มี backend: บันทึกเป็นรายการรอตรวจในเครื่อง (ไม่เพิ่มยอด)
        const cur=acc(biz);
        const led=[{ts:nowISO(),ref:'DEMO'+Date.now().toString().slice(-8),type:'topup',amount:a,bal:null,status:'pending',
          note:(o.note||'เติมเงินเข้ากระเป๋า')+' · เดโม (ไม่มีเซิร์ฟเวอร์)',method:o.method||'promptpay'},...cur.ledger];
        put(biz,{ledger:led,pendingAmount:r2(cur.pendingAmount+a),pendingCount:cur.pendingCount+1});
        return {ok:true,status:'pending',demo:true};
      }
      const r=await api('/wallet/'+enc(biz)+'/topup',{method:'POST',body:{amount:a,slip:o.slip||null,qrPayload:o.qrPayload||'',method:o.method||'promptpay',who:o.who||'',note:o.note||''}});
      if(r.__err) return {ok:false,error:r.error||'ส่งคำขอเติมเงินไม่สำเร็จ'};
      await this.pull(biz);
      return {ok:true,status:r.status||'pending',auto:!!r.auto,ref:r.ref,balance:r.balance};
    },

    /* หักค่าบริการระบบจากกระเป๋า (async · เซิร์ฟตัดยอดจริง) → {ok,balance,short,ref,error}
       opt={who,sub,ref,type,idem} — ใส่ idem ทุกครั้งที่เป็นการจ่ายบิลเดียวกัน เพื่อกันกดซ้ำ */
    async charge(biz,amount,opt){
      const a=r2(amount); const o=opt||{}; const note=o.sub||'ค่าบริการระบบ';
      if(!(a>0)) return {ok:false,error:'จำนวนเงินไม่ถูกต้อง',balance:acc(biz).balance,short:0};
      if(base()){
        const r=await api('/wallet/'+enc(biz)+'/charge',{method:'POST',body:{amount:a,note,who:o.who||'',ref:o.ref||'',type:o.type||'fee',idem:o.idem||''}});
        if(r.__err||r.ok===false){
          await this.pull(biz);
          return {ok:false,error:r.error||'หักเงินไม่สำเร็จ',balance:r.balance!==undefined?r.balance:acc(biz).balance,short:r2(r.short)};
        }
        await this.pull(biz);
        platRevenue({who:o.who||biz,sub:note,amt:a,type:o.platType||'saas',ref:r.ref});
        return {ok:true,balance:r2(r.balance),short:0,ref:r.ref,dedup:!!r.dedup};
      }
      const cur=acc(biz);   // ออฟไลน์/เดโม
      if(cur.balance<a) return {ok:false,error:'ยอดกระเป๋าไม่พอ',balance:cur.balance,short:r2(a-cur.balance)};
      const bal=r2(cur.balance-a);
      const led=[{ts:nowISO(),ref:'DEMO'+Date.now().toString().slice(-8),type:o.type||'fee',amount:-a,bal,note,status:'done',method:'wallet'},...cur.ledger];
      put(biz,{balance:bal,ledger:led});
      platRevenue({who:o.who||biz,sub:note,amt:a,type:o.platType||'saas'});
      return {ok:true,balance:bal,short:0};
    },

    /* ตัดค่าบริการอัตโนมัติเมื่อครบรอบ — เรียกตอนเปิดแอป/เปิดหน้าแพ็กเกจ (ไม่ต้องผูกบัตร)
       opt={amount,expiry,days=30,leadDays=0,who,sub,ref} → {charged,expiry,balance,short,skipped} */
    async autoRenew(biz,opt){
      const o=opt||{}; await this.pull(biz); const cur=acc(biz); const amount=r2(o.amount);
      if(!cur.auto) return {charged:false,skipped:'auto-off',balance:cur.balance};
      if(!(amount>0)) return {charged:false,skipped:'free',balance:cur.balance};
      const exp=o.expiry?new Date(o.expiry):null; const lead=Number(o.leadDays)||0;
      if(exp && (exp-Date.now())/86400000 > lead) return {charged:false,skipped:'not-due',balance:cur.balance};
      const cycle=exp?String(new Date(exp).toISOString().slice(0,10)):String(new Date().toISOString().slice(0,7));
      const res=await this.charge(biz,amount,{who:o.who,sub:o.sub||'ต่ออายุอัตโนมัติ (หักจากกระเป๋า)',ref:o.ref,type:'renew',idem:'auto:'+cycle+':'+amount});
      if(!res.ok) return {charged:false,skipped:'insufficient',balance:res.balance,short:res.short};
      const b0=exp&&exp>new Date()?exp:new Date(); b0.setDate(b0.getDate()+(Number(o.days)||30));
      return {charged:true,expiry:b0.toISOString(),balance:res.balance,short:0,ref:res.ref};
    },

    /* คิวคำขอเติมเงิน (แอดมิน) */
    async topupQueue(status){ const r=await api('/wallet-topups?status='+(status||'pending')); return Array.isArray(r)?r:[]; },
    async approveTopup(id,by){ return await api('/wallet-txns/'+id,{method:'PATCH',body:{status:'confirmed',by:by||'admin'}}); },
    async rejectTopup(id,by,reason){ return await api('/wallet-txns/'+id,{method:'PATCH',body:{status:'rejected',by:by||'admin',reason:reason||''}}); },
    async adjust(biz,amount,note,by){ const r=await api('/wallet/'+enc(biz)+'/adjust',{method:'POST',body:{amount:r2(amount),note:note||'',by:by||'admin'}});
      if(!r.__err) await this.pull(biz); return r; },
    async listWallets(){ const r=await api('/wallet'); return Array.isArray(r)?r:[]; },

    /* ── บัญชีรับเงิน ── */
    // (ก) บัญชีของ "ระบบ" = ปลายทางที่ร้านโอนมาเติมกระเป๋า (แอดมินตั้งครั้งเดียวใน Back Office)
    acctCached(){ try{ return JSON.parse(localStorage.getItem('kd_wallet_acct_v1'))||{}; }catch(e){ return {}; } },
    async account(){ const r=await api('/wallet-account');
      if(r&&!r.__err&&!r.__offline){ try{ localStorage.setItem('kd_wallet_acct_v1',JSON.stringify(r)); }catch(e){} return r; }
      return this.acctCached(); },
    async setAccount(a){ const r=await api('/wallet-account',{method:'PUT',body:a});
      if(!r.__err){ try{ localStorage.setItem('kd_wallet_acct_v1',JSON.stringify(a)); }catch(e){} } return r; },
    // (ข) บัญชีของ "ร้านนี้เอง" = ปลายทางที่ลูกค้าจ่ายค่าสินค้า (ร้านตั้งเอง · เก็บรายร้านที่เซิร์ฟ)
    async bizAccount(biz){ const r=await api('/wallet/'+enc(biz)+'/account');
      if(r&&!r.__err&&!r.__offline) return r; return this.recvAcct(biz)||{}; },
    async setBizAccount(biz,a){ const r=await api('/wallet/'+enc(biz)+'/account',{method:'POST',body:a});
      this.setRecvAcct(biz,a);   // สำเนาในเครื่องไว้ออก QR ตอนออฟไลน์
      return r.__err?{ok:false,error:r.error||'บันทึกบัญชีไม่สำเร็จ'}:{ok:true,...r}; },

    /* ยอดโอนที่ไม่ซ้ำกัน — เติม "เศษสตางค์อ้างอิง" ให้จับคู่รายการได้แม้ไม่มี VA (1,000 → 1,000.47) */
    payAmount(amount){ const a=r2(amount); const cents=(Math.floor(Math.random()*89)+10)/100; return r2(Math.floor(a)+cents); },

    /* QR พร้อมเพย์ (EMVCo) — ออกจากเบอร์/เลขบัญชีที่ตั้งไว้ พร้อมยอดที่ต้องโอน */
    promptpayPayload(target,amount){
      const id=String(target||'').replace(/\D/g,''); if(!id) return '';
      const f=(t,v)=>t+String(v.length).padStart(2,'0')+v;
      let acc;
      if(id.length===13) acc=f('00','A000000677010111')+f('03',id);                       // เลขบัตรประชาชน/ทะเบียนนิติบุคคล
      else if(id.length===10) acc=f('00','A000000677010111')+f('01','0066'+id.slice(1));   // เบอร์มือถือ
      else acc=f('00','A000000677010111')+f('03',id.padStart(13,'0'));
      let s=f('00','01')+f('01', amount>0?'12':'11')+f('29',acc)+f('53','764')+f('58','TH');
      if(amount>0) s+=f('54',r2(amount).toFixed(2));
      s+='6304';
      let crc=0xFFFF; for(let i=0;i<s.length;i++){ crc^=s.charCodeAt(i)<<8;
        for(let j=0;j<8;j++) crc=(crc&0x8000)?((crc<<1)^0x1021)&0xFFFF:(crc<<1)&0xFFFF; }
      return s+crc.toString(16).toUpperCase().padStart(4,'0');
    },
  };

  /* ══ ฝั่ง "รับเงินจากลูกค้า" — 2 โหมด ใช้ร่วมทุกโมดูล ══
     • legacy = เงินสด / QR พร้อมเพย์บัญชีร้าน · พนักงานกดยืนยันเอง
     • auto   = QR/VA ในชื่อบัญชีร้านเอง → เงินเข้าบัญชีร้านตรง ระบบจับคู่ยอด↔บิลให้
     ⚖️ ยอดขายลูกค้าไม่ผ่านกระเป๋าแพลตฟอร์ม — แพลตฟอร์มไม่ถือเงินของร้าน */
  const SALES_KEY='kd_biz_sales_v1';
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
    receive(biz,amount,opt){ const a=r2(amount); if(!(a>0)) return {ok:false,error:'จำนวนเงินไม่ถูกต้อง'};
      const cur=salesGet(biz); const gross=r2(cur.gross+a);
      const led=[...cur.ledger,{ts:nowISO(),type:'sale',amount:a,gross,
        note:(opt&&opt.note)||('รับเงินลูกค้า'+((opt&&opt.who)?' · '+opt.who:'')),
        method:(opt&&opt.method)||'promptpay', ref:(opt&&opt.ref)||'', auto:!!(opt&&opt.auto)}];
      salesPut(biz,{gross,ledger:led}); return {ok:true,gross};
    },
    refund(biz,amount,opt){ const a=r2(amount); if(!(a>0)) return {ok:false,error:'จำนวนเงินไม่ถูกต้อง'};
      const cur=salesGet(biz); const gross=r2(cur.gross-a);
      const led=[...cur.ledger,{ts:nowISO(),type:'refund',amount:-a,gross,note:(opt&&opt.note)||'คืนเงินลูกค้า',ref:(opt&&opt.ref)||''}];
      salesPut(biz,{gross,ledger:led}); return {ok:true,gross};
    },
    /* ⛔ ถอนเป็นเงินสด/โอนออก = ทำไม่ได้ตลอดกาล (closed-loop) — ฝั่งเซิร์ฟก็ปิดไว้ */
    withdraw(){ return {ok:false,code:'WITHDRAW_NOT_ALLOWED',error:'กระเป๋าในระบบใช้จ่ายค่าบริการเท่านั้น · ถอนเป็นเงินสด/โอนออกไม่ได้ (ยังไม่มีใบอนุญาตเงินอิเล็กทรอนิกส์) — ยอดขายของร้านเข้าบัญชีร้านโดยตรงอยู่แล้ว'}; },
  });
  window.KDW=KDW;

  /* ══ UI ร่วม ══ */
  const CO={brand:'var(--brand,#16A97A)',ink:'var(--brand-ink,#12805A)',soft:'var(--brand-soft,#E9F7F1)',softer:'var(--brand-softer,#F4FBF8)',
    hair:'var(--hair,#E7E7E4)',t3:'var(--ink-3,#8A8A85)',t2:'var(--ink-2,#4A4A46)',t1:'var(--ink,#22221F)',bg:'var(--bg,#F7F7F5)',red:'var(--red,#C0392B)'};
  const TYPE_LABEL={topup:'เติมเงินเข้ากระเป๋า',fee:'ค่าบริการระบบ',renew:'ต่ออายุแพ็กเกจ','adjust-in':'ปรับยอดโดยผู้ดูแลระบบ','adjust-out':'ปรับลดโดยผู้ดูแลระบบ'};
  const dayKey=(ts)=>{ try{ return new Date(ts).toISOString().slice(0,10); }catch(e){ return '-'; } };
  const dayLabel=(k)=>{ const d=new Date(k+'T00:00:00'); const t=new Date(); const y=new Date(Date.now()-864e5);
    if(dayKey(t)===k) return 'วันนี้'; if(dayKey(y)===k) return 'เมื่อวาน';
    return d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}); };
  const hhmm=(ts)=>{ try{ return new Date(ts).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } };

  /* ── ประวัติการทำรายการ (สเตทเมนต์แบบแอปธนาคาร) ──
     props: biz · limit · onNeedTopup · embedded(ไม่มีหัวการ์ด) */
  function KDWalletHistory({ biz, limit, embedded }){
    const R=window.React; const {useState,useEffect}=R;
    const [rows,setRows]=useState(()=>acc(biz).ledger);
    const [filter,setFilter]=useState('all');
    const [open,setOpen]=useState(null);
    const [busy,setBusy]=useState(false);
    const load=()=>{ setBusy(true); KDW.pull(biz,limit||60).then(a=>{ setRows(a.ledger); setBusy(false); }).catch(()=>setBusy(false)); };
    useEffect(()=>{ load(); const h=()=>setRows(acc(biz).ledger); window.addEventListener('kdw-change',h); return ()=>window.removeEventListener('kdw-change',h); },[biz]);
    const list=rows.filter(t=> filter==='all'?true : filter==='in'?t.amount>0 : filter==='out'?t.amount<0 : t.status==='pending');
    const groups=[]; list.forEach(t=>{ const k=dayKey(t.ts); const g=groups[groups.length-1];
      if(g&&g.k===k) g.items.push(t); else groups.push({k,items:[t]}); });
    const FILTERS=[['all','ทั้งหมด'],['in','เงินเข้า'],['out','เงินออก'],['pending','รอตรวจสอบ']];
    const chip=(on)=>({padding:'7px 13px',borderRadius:999,fontSize:12.5,fontWeight:700,cursor:'pointer',fontFamily:'inherit',
      border:'1.4px solid '+(on?CO.brand:CO.hair),background:on?CO.soft:'#fff',color:on?CO.ink:CO.t2});
    const st=(s)=>s==='pending'?{t:'รอตรวจสอบ',c:'#8A6D0B',b:'#FFF6E2'}:s==='rejected'?{t:'ไม่ผ่าน',c:CO.red,b:'#FDEDEA'}:null;
    return (
      <div style={embedded?{}:{background:'#fff',border:'1px solid '+CO.hair,borderRadius:16,padding:16}} data-kdw-hist={biz}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:11}}>
          <div style={{fontSize:14,fontWeight:800}}>ประวัติการทำรายการ</div>
          <button onClick={load} style={{border:'none',background:'none',color:CO.ink,fontWeight:700,fontSize:12.5,cursor:'pointer',fontFamily:'inherit',padding:0}}>{busy?'กำลังโหลด…':'รีเฟรช'}</button>
        </div>
        <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:12}}>
          {FILTERS.map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={chip(filter===k)}>{l}</button>)}
        </div>
        {groups.length?groups.map(g=>(
          <div key={g.k} style={{marginBottom:14}}>
            <div style={{fontSize:11.5,fontWeight:700,color:CO.t3,margin:'0 2px 7px',letterSpacing:.2}}>{dayLabel(g.k)}</div>
            <div style={{display:'flex',flexDirection:'column',gap:1,background:CO.bg,borderRadius:13,overflow:'hidden'}}>
              {g.items.map((t,i)=>{ const S=st(t.status); const inn=t.amount>0;
                return (
                <button key={t.ref||i} onClick={()=>setOpen(t)} style={{display:'flex',gap:11,alignItems:'center',background:'#fff',border:'none',
                  padding:'12px 13px',cursor:'pointer',textAlign:'left',fontFamily:'inherit',width:'100%'}}>
                  <span style={{width:34,height:34,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:15,background:inn?CO.soft:'#F1F1EE',color:inn?CO.ink:CO.t2}}>{inn?'↓':'↑'}</span>
                  <span style={{flex:1,minWidth:0}}>
                    <span style={{display:'block',fontSize:13.5,fontWeight:600,color:CO.t1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.note||TYPE_LABEL[t.type]||'รายการ'}</span>
                    <span style={{display:'block',fontSize:11,color:CO.t3,marginTop:2}}>{hhmm(t.ts)} · {t.ref||'—'}</span>
                  </span>
                  <span style={{textAlign:'right',flexShrink:0}}>
                    <span style={{display:'block',fontSize:14,fontWeight:800,color:S?CO.t3:(inn?CO.ink:CO.t1)}}>{inn?'+':'−'}{B(Math.abs(t.amount))}</span>
                    {S?<span style={{display:'inline-block',marginTop:3,fontSize:10.5,fontWeight:700,color:S.c,background:S.b,borderRadius:6,padding:'2px 6px'}}>{S.t}</span>
                      :<span style={{display:'block',fontSize:10.5,color:CO.t3,marginTop:2}}>คงเหลือ {t.bal===null||t.bal===undefined?'—':B(t.bal)}</span>}
                  </span>
                </button>);})}
            </div>
          </div>)):<div style={{fontSize:12.5,color:CO.t3,padding:'14px 2px'}}>{busy?'กำลังโหลด…':'ยังไม่มีรายการในกระเป๋า'}</div>}
        {open&&<div onClick={()=>setOpen(null)} style={{position:'fixed',inset:0,background:'rgba(20,20,18,.45)',zIndex:9000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',width:'100%',maxWidth:460,borderRadius:'20px 20px 0 0',padding:'20px 20px 24px',maxHeight:'86vh',overflowY:'auto'}}>
            <div style={{width:38,height:4,borderRadius:99,background:CO.hair,margin:'0 auto 16px'}}/>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:12.5,color:CO.t3,fontWeight:600}}>{TYPE_LABEL[open.type]||'รายการ'}</div>
              <div style={{fontSize:31,fontWeight:800,color:open.amount>0?CO.ink:CO.t1,margin:'3px 0 2px'}}>{open.amount>0?'+':'−'}{B(Math.abs(open.amount))}</div>
              {(()=>{ const S=st(open.status); return S?<div style={{display:'inline-block',fontSize:11.5,fontWeight:700,color:S.c,background:S.b,borderRadius:8,padding:'4px 10px'}}>{S.t}</div>
                :<div style={{display:'inline-block',fontSize:11.5,fontWeight:700,color:CO.ink,background:CO.soft,borderRadius:8,padding:'4px 10px'}}>สำเร็จ</div>; })()}
            </div>
            <div style={{height:1,background:CO.hair,margin:'17px 0 3px'}}/>
            {[['รายละเอียด',open.note||'—'],['วันเวลา',(()=>{try{return new Date(open.ts).toLocaleString('th-TH',{dateStyle:'long',timeStyle:'short'})}catch(e){return '—'}})()],
              ['เลขอ้างอิง',open.ref||'—'],['ช่องทาง',open.method==='wallet'?'หักจากกระเป๋า':open.method==='promptpay'?'พร้อมเพย์':open.method==='admin'?'ผู้ดูแลระบบ':(open.method||'—')],
              ['ยอดคงเหลือหลังรายการ',open.bal===null||open.bal===undefined?(open.status==='pending'?'ยังไม่เข้ายอด':'—'):B(open.bal)]].map(([k,v])=>(
              <div key={k} style={{display:'flex',gap:12,justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid '+CO.bg}}>
                <span style={{fontSize:12.5,color:CO.t3,flexShrink:0}}>{k}</span>
                <span style={{fontSize:13,fontWeight:600,color:CO.t1,textAlign:'right',wordBreak:'break-word'}}>{v}</span>
              </div>))}
            <div style={{marginTop:14,background:'#FFF6E2',borderRadius:11,padding:'10px 12px',fontSize:11.5,color:'#7A5B08',lineHeight:1.55}}>
              ยอดในกระเป๋าใช้จ่ายค่าบริการระบบเท่านั้น · ถอนเป็นเงินสด/โอนออกไม่ได้
            </div>
            <button onClick={()=>setOpen(null)} style={{width:'100%',marginTop:14,padding:13,borderRadius:12,border:'none',cursor:'pointer',
              background:CO.brand,color:'#fff',fontWeight:700,fontSize:14.5,fontFamily:'inherit'}}>ปิด</button>
          </div>
        </div>}
      </div>
    );
  }
  window.KDWalletHistory=KDWalletHistory;

  /* ── QR พร้อมเพย์ (โหลดไลบรารีเองครั้งเดียว · ใช้ได้ทุกหน้า) ── */
  let qrLoad=null;
  function loadQRLib(){ if(window.QRCode) return Promise.resolve(true);
    if(!qrLoad) qrLoad=new Promise(res=>{ const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      s.onload=()=>res(!!window.QRCode); s.onerror=()=>res(false); document.head.appendChild(s); });
    return qrLoad; }
  function KDQR({ target, amount, size, label, note }){
    const R=window.React; const {useState,useEffect,useRef}=R;
    const box=useRef(null); const [err,setErr]=useState(''); const [saved,setSaved]=useState('');
    const S=size||186;
    const payload=KDW.promptpayPayload(target,amount||0);
    useEffect(()=>{ let dead=false;
      if(!payload){ setErr('ยังไม่ได้ตั้งพร้อมเพย์'); return; }
      setErr('');
      loadQRLib().then(ok=>{ if(dead||!box.current) return;
        if(!ok){ setErr('โหลดตัวสร้าง QR ไม่สำเร็จ · ใช้เลขบัญชีด้านล่างโอนแทนได้'); return; }
        box.current.innerHTML='';
        try{ new window.QRCode(box.current,{text:payload,width:S,height:S,colorDark:'#0B3B2E',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M}); }
        catch(e){ setErr('สร้าง QR ไม่สำเร็จ'); } });
      return ()=>{ dead=true; };
    },[payload,S]);
    const png=()=>{ const el=box.current; if(!el) return '';
      const cv=el.querySelector('canvas'), im=el.querySelector('img');
      try{ return cv?cv.toDataURL('image/png'):(im?im.src:''); }catch(e){ return im?im.src:''; } };
    const save=()=>{ const u=png(); if(!u) return;
      const a=document.createElement('a'); a.href=u; a.download='promptpay-qr.png'; a.click();
      setSaved('บันทึกรูปแล้ว'); setTimeout(()=>setSaved(''),1600); };
    const hint={fontSize:12,color:CO.t3};
    if(err) return <div style={{...hint,background:CO.bg,borderRadius:11,padding:'10px 12px',lineHeight:1.55}}>{err}</div>;
    return (<div style={{textAlign:'center'}}>
      <div style={{display:'inline-block',background:'#fff',border:'1px solid '+CO.hair,borderRadius:14,padding:12}}>
        <div ref={box} style={{width:S,height:S,lineHeight:0}}/>
        {amount>0?<div style={{fontSize:13.5,fontWeight:800,color:CO.ink,marginTop:8}}>{B(amount)}</div>:null}
      </div>
      {label?<div style={{...hint,marginTop:6,lineHeight:1.5}}>{label}</div>:null}
      {note?<div style={{...hint,marginTop:2,lineHeight:1.5}}>{note}</div>:null}
      <button onClick={save} style={{marginTop:8,border:'1.2px solid '+CO.hair,background:'#fff',borderRadius:9,padding:'6px 12px',fontSize:12,fontWeight:700,color:CO.ink,cursor:'pointer',fontFamily:'inherit'}}>{saved||'บันทึกรูป QR'}</button>
    </div>);
  }
  window.KDQR=KDQR;

  /* ── แผงกระเป๋าเงิน (ยอด + ตัดอัตโนมัติ + เติมเงิน + ประวัติ) ── */
  const QUICK=[500,1000,2000,5000];
  function KDWalletPanel({ biz, who, due, dueLabel, qr, compact, onChange }){
    const R=window.React; const {useState,useEffect}=R;
    const [a,setA]=useState(()=>acc(biz));
    const [amt,setAmt]=useState(1000);
    const [msg,setMsg]=useState(null);      // {ok,text}
    const [slip,setSlip]=useState(null);
    const [busy,setBusy]=useState(false);
    const [log,setLog]=useState(false);
    const [pa,setPa]=useState(()=>KDW.acctCached());
    const [payAmt,setPayAmt]=useState(null);
    const [copied,setCopied]=useState('');
    useEffect(()=>{ KDW.account().then(setPa).catch(()=>{}); },[]);
    useEffect(()=>{ const v=r2(amt); setPayAmt(v>0?KDW.payAmount(v):null); },[amt]);
    const refresh=()=>KDW.pull(biz).then(x=>{ setA(x); onChange&&onChange(x); });
    useEffect(()=>{ refresh(); const h=()=>setA(acc(biz)); window.addEventListener('kdw-change',h); return ()=>window.removeEventListener('kdw-change',h); },[biz]);
    const short=due?Math.max(0,r2(due-a.balance)):0;
    const pickSlip=(e)=>{ const f=e.target.files&&e.target.files[0]; if(!f) return;
      const rd=new FileReader(); rd.onload=()=>{ const img=new Image(); img.onload=()=>{ const W=800,sc=Math.min(1,W/img.width),c=document.createElement('canvas');
        c.width=img.width*sc; c.height=img.height*sc; c.getContext('2d').drawImage(img,0,0,c.width,c.height); setSlip(c.toDataURL('image/jpeg',.72)); };
        img.src=rd.result; }; rd.readAsDataURL(f); };
    const send=async()=>{ const v=r2(payAmt||amt); if(!(v>0)){ setMsg({ok:false,text:'ระบุจำนวนเงินก่อน'}); return; }
      setBusy(true); const res=await KDW.topupRequest(biz,v,{slip,who,method:'promptpay'}); setBusy(false);
      if(!res.ok){ setMsg({ok:false,text:res.error}); return; }
      setSlip(null);
      setMsg({ok:true,text: res.status==='done'
        ? 'ตรวจยอดกับธนาคารผ่านแล้ว · เงินเข้ากระเป๋า '+B(v)+' (อ้างอิง '+(res.ref||'—')+')'
        : 'ส่งคำขอเติมเงิน '+B(v)+' แล้ว · รอระบบ/ผู้ดูแลตรวจยอด แล้วจะขึ้นในกระเป๋าอัตโนมัติ'+(res.ref?' (อ้างอิง '+res.ref+')':'')});
      refresh(); setLog(true);
    };
    const card={background:'#fff',border:'1px solid '+CO.hair,borderRadius:16,padding:16};
    const hint={fontSize:12,color:CO.t3};
    return (
      <div style={card} data-kdw={biz}>
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:10}}>
          <div><div style={{...hint,fontWeight:600}}>👛 กระเป๋าเงินของคุณ (ใช้จ่ายค่าบริการระบบ)</div>
            <div style={{fontSize:28,fontWeight:800,color:CO.ink,lineHeight:1.2}}>{B(a.balance)}</div>
            {a.pendingAmount>0?<div style={{fontSize:11.5,color:'#8A6D0B',fontWeight:700,marginTop:2}}>รอตรวจยอด {B(a.pendingAmount)} ({a.pendingCount} รายการ)</div>:null}
            {!KDW.live()?<div style={{fontSize:11,color:CO.t3,marginTop:2}}>โหมดเดโม · ยังไม่ต่อเซิร์ฟเวอร์</div>:null}</div>
          {due?<div style={{textAlign:'right',fontSize:12.5,fontWeight:700,color:short>0?CO.red:CO.ink}}>
            {short>0?('ขาดอีก '+B(short)):'พอสำหรับรอบถัดไป'}<div style={{...hint,fontWeight:500}}>{dueLabel||('ยอดที่ต้องชำระ '+B(due))}</div></div>:null}
        </div>
        <label style={{display:'flex',gap:9,alignItems:'center',marginTop:12,cursor:'pointer'}}>
          <input type="checkbox" checked={a.auto} onChange={e=>{ KDW.setAuto(biz,e.target.checked).then(refresh); }} style={{width:19,height:19,accentColor:CO.brand}}/>
          <span style={{fontSize:12.5,color:CO.t2,lineHeight:1.5}}>ครบรอบแล้วตัดค่าบริการจากกระเป๋าให้อัตโนมัติ · ไม่ต้องผูกบัตรเครดิต</span>
        </label>
        {!compact && <React.Fragment>
          <div style={{marginTop:10,background:'#FFF6E2',borderRadius:11,padding:'9px 11px',fontSize:11.5,color:'#7A5B08',lineHeight:1.55}}>ยอดในกระเป๋าใช้จ่ายค่าบริการในระบบเท่านั้น · <b>ถอนเป็นเงินสด/โอนออกไม่ได้</b> (closed-loop)</div>
          <div style={{height:1,background:CO.hair,margin:'13px 0'}}/>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>เติมเงินเข้ากระเป๋า</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:9}}>
            {QUICK.map(q=>(<button key={q} onClick={()=>{setAmt(q);setMsg(null);}} style={{flex:'1 1 70px',padding:'10px 6px',borderRadius:11,cursor:'pointer',fontWeight:700,fontSize:13.5,fontFamily:'inherit',
              border:'1.6px solid '+(r2(amt)===q?CO.brand:CO.hair),background:r2(amt)===q?CO.soft:'#fff',color:r2(amt)===q?CO.ink:CO.t2}}>{B(q).replace('.00','')}</button>))}
          </div>
          <input value={amt} inputMode="numeric" onChange={e=>{setAmt(e.target.value.replace(/\D/g,''));setMsg(null);}} placeholder="ระบุจำนวนเงิน"
            style={{width:'100%',boxSizing:'border-box',padding:'12px 13px',borderRadius:12,border:'1.5px solid '+CO.hair,fontSize:15,fontFamily:'inherit',background:'#fff'}}/>
          {qr?<div style={{textAlign:'center',marginTop:12}}>{qr}<div style={hint}>สแกนพร้อมเพย์เพื่อโอนตามจำนวน</div></div>
            :((pa&&pa.promptpay&&payAmt>0)?<div style={{marginTop:12}}>
              <KDQR target={pa.promptpay} amount={payAmt} label="สแกนพร้อมเพย์ · ยอดถูกใส่มาให้แล้ว ไม่ต้องพิมพ์เอง" note={pa.acctName?('ปลายทาง: '+pa.acctName):''}/></div>:null)}
          {/* บัญชีปลายทางของระบบ + ยอดที่ต้องโอน (เศษสตางค์ไว้จับคู่รายการอัตโนมัติ) */}
          {(pa&&(pa.promptpay||pa.acctNo))?<div style={{marginTop:12,background:CO.bg,borderRadius:13,padding:'13px 14px'}}>
            <div style={{fontSize:12.5,fontWeight:700,color:CO.t2,marginBottom:8}}>โอนเข้าบัญชีระบบ</div>
            {[[pa.promptpay?'พร้อมเพย์':'',pa.promptpay],[pa.acctNo?(pa.bank||'เลขบัญชี'):'',pa.acctNo],[pa.acctName?'ชื่อบัญชี':'',pa.acctName],
              ['ยอดที่ต้องโอน',payAmt?B(payAmt):'']].filter(x=>x[0]&&x[1]).map(([k,v])=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:10,justifyContent:'space-between',padding:'6px 0'}}>
                <span style={{fontSize:12,color:CO.t3}}>{k}</span>
                <span style={{display:'flex',alignItems:'center',gap:8}}>
                  <b style={{fontSize:13.5,color:CO.t1}}>{v}</b>
                  <button onClick={()=>{ const s=String(v); const out=/^[\d\s.\-]+$/.test(s)?s.replace(/[^\d.]/g,''):s;
                    try{ navigator.clipboard.writeText(out); setCopied(k); setTimeout(()=>setCopied(''),1500); }catch(e){} }}
                    style={{border:'1.2px solid '+CO.hair,background:'#fff',borderRadius:8,padding:'3px 8px',fontSize:11,fontWeight:700,color:CO.ink,cursor:'pointer',fontFamily:'inherit'}}>{copied===k?'คัดลอกแล้ว':'คัดลอก'}</button>
                </span>
              </div>))}
            <div style={{...hint,marginTop:6,lineHeight:1.55}}>โอน <b>{payAmt?B(payAmt):'—'}</b> เป๊ะ — เศษสตางค์ท้ายคือเลขอ้างอิงของคำขอนี้ ระบบจะเอาไปจับคู่กับยอดที่เข้าบัญชีให้เอง</div>
          </div>:<div style={{marginTop:12,background:'#FDEDEA',borderRadius:12,padding:'10px 12px',fontSize:12,color:CO.red,lineHeight:1.55}}>ยังไม่ได้ตั้งบัญชีรับเงินกลางของระบบ — ตั้งที่ Back Office → กระเป๋าเงิน → บัญชีรับเงิน</div>}
          <label style={{display:'block',marginTop:11,padding:'12px 13px',borderRadius:12,border:'1.5px dashed '+CO.hair,cursor:'pointer',background:CO.bg}}>
            <input type="file" accept="image/*" onChange={pickSlip} style={{display:'none'}}/>
            <span style={{fontSize:13,fontWeight:700,color:CO.ink}}>{slip?'✓ แนบสลิปแล้ว · แตะเพื่อเปลี่ยน':'แนบสลิปโอนเงิน (ถ้ามี)'}</span>
            <span style={{...hint,display:'block',marginTop:3,lineHeight:1.5}}>แนบสลิป = ระบบตรวจยอดกับธนาคารให้ทันที · ไม่แนบก็ได้ ระบบจะจับยอดที่เข้าบัญชีหรือรอผู้ดูแลยืนยัน</span>
          </label>
          {slip?<img src={slip} alt="สลิป" style={{width:'100%',maxHeight:200,objectFit:'contain',marginTop:9,borderRadius:11,background:CO.bg}}/>:null}
          <button onClick={send} disabled={busy} style={{width:'100%',marginTop:12,padding:13,borderRadius:12,cursor:busy?'default':'pointer',fontWeight:700,fontSize:14.5,fontFamily:'inherit',
            border:'1.6px solid '+CO.brand,background:busy?CO.bg:CO.soft,color:CO.ink,opacity:busy?.7:1}}>{busy?'กำลังส่งคำขอ…':'แจ้งเติมเงิน '+B(r2(payAmt||amt))}</button>
          {msg?<div style={{marginTop:10,fontSize:12.5,fontWeight:600,lineHeight:1.55,color:msg.ok?CO.ink:CO.red,background:msg.ok?CO.softer:'#FDEDEA',borderRadius:11,padding:'10px 12px'}}>{msg.text}</div>:null}
          <button onClick={()=>setLog(v=>!v)} style={{border:'none',background:'none',color:CO.ink,fontWeight:700,fontSize:12.5,cursor:'pointer',marginTop:12,padding:0,fontFamily:'inherit'}}>{log?'ซ่อนประวัติการทำรายการ':'ดูประวัติการทำรายการ'}</button>
          {log?<div style={{marginTop:10}}><KDWalletHistory biz={biz} embedded/></div>:null}
        </React.Fragment>}
      </div>
    );
  }
  window.KDWalletPanel=KDWalletPanel;

  /* ── ตั้งค่ารับเงินจากลูกค้า (2 โหมด) ── */
  function KDReceivePanel({ biz, who, qr, acctLabel, compact, onChange }){
    const R=window.React; const {useState,useEffect}=R;
    const [tick,setTick]=useState(0);
    const s=KDW.sales(biz);
    const [log,setLog]=useState(false);
    const [ac,setAc]=useState({promptpay:'',bank:'',acctNo:'',acctName:''});
    const [acMsg,setAcMsg]=useState(null);
    const [acBusy,setAcBusy]=useState(false);
    useEffect(()=>{ KDW.bizAccount(biz).then(a=>setAc({promptpay:(a&&a.promptpay)||'',bank:(a&&a.bank)||'',acctNo:(a&&a.acctNo)||'',acctName:(a&&a.acctName)||''})).catch(()=>{}); },[biz]);
    const saveAc=async()=>{ setAcBusy(true); const r=await KDW.setBizAccount(biz,ac); setAcBusy(false);
      setAcMsg(r.ok?{ok:true,text:'บันทึกบัญชีร้านแล้ว · QR รับเงินจะออกเข้าบัญชีนี้'}:{ok:false,text:r.error||'บันทึกไม่สำเร็จ'}); };
    const bump=()=>{ setTick(t=>t+1); onChange&&onChange(KDW.sales(biz)); };
    const pick=(m)=>{ KDW.setRecvMode(biz,m); bump(); };
    const card={background:'#fff',border:'1px solid '+CO.hair,borderRadius:16,padding:16};
    const hint={fontSize:12,color:CO.t3};
    const MODES=[
      ['legacy','💵 รับเงินแบบเดิม','เงินสด · QR พร้อมเพย์บัญชีร้าน · พนักงานกดยืนยัน/แนบสลิปเอง'],
      ['auto','👛 กระเป๋าร้าน · จับยอดอัตโนมัติ','QR ออกต่อบิล (บัญชีร้านเอง) → เงินเข้าบัญชีร้านตรง ระบบจับคู่ยอดกับบิลให้เอง ไม่ต้องใช้ไลน์บอท'],
    ];
    return (
      <div style={card} data-kdrecv={biz}>
        <div style={{...hint,fontWeight:600,marginBottom:2}}>วิธีรับเงินจากลูกค้า</div>
        <div style={{fontSize:13,color:CO.t2,marginBottom:11}}>เลือกได้ 2 แบบ · เปลี่ยนเมื่อไรก็ได้ ยอดเก่ายังอยู่</div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {MODES.map(([k,t,d])=>(
            <label key={k} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'11px 12px',cursor:'pointer',borderRadius:12,
              border:'1.6px solid '+(s.mode===k?CO.brand:CO.hair),background:s.mode===k?CO.softer:'#fff'}}>
              <input type="radio" checked={s.mode===k} onChange={()=>pick(k)} style={{marginTop:2,width:17,height:17,accentColor:CO.brand}}/>
              <span style={{flex:1,minWidth:0}}><span style={{display:'block',fontSize:13.5,fontWeight:700}}>{t}</span>
                <span style={{...hint,display:'block',lineHeight:1.5,marginTop:2}}>{d}</span></span>
            </label>))}
        </div>
        {s.mode==='auto'&&<div style={{marginTop:12}}>
          {qr?<div style={{textAlign:'center'}}>{qr}</div>
            :(ac.promptpay?<KDQR target={ac.promptpay} label="QR พร้อมเพย์รับเงินเข้าบัญชีร้านนี้" note="ลูกค้าสแกนแล้วกรอกยอดเอง · QR ต่อบิลจะออกยอดให้อัตโนมัติ"/>:null)}
          {/* บัญชีรับเงินของร้านนี้เอง — เก็บที่เซิร์ฟเวอร์รายร้าน · ใช้ออก QR ต่อบิล + ตรวจสลิปว่าปลายทางตรง */}
          <div style={{background:'#fff',border:'1px solid '+CO.hair,borderRadius:13,padding:'13px 14px',marginTop:10}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:3}}>บัญชีรับเงินของร้านนี้</div>
            <div style={{...hint,lineHeight:1.55,marginBottom:10}}>เงินลูกค้าเข้าบัญชีนี้โดยตรง · ระบบใช้ออก QR ต่อบิลและตรวจสลิปว่าปลายทางตรงกัน</div>
            {[['promptpay','พร้อมเพย์ (เบอร์มือถือ/เลขบัตร 13 หลัก)','tel'],['bank','ธนาคาร','text'],['acctNo','เลขที่บัญชี','tel'],['acctName','ชื่อบัญชี','text']].map(([k,l,tp])=>(
              <label key={k} style={{display:'block',marginBottom:8}}>
                <span style={{...hint,display:'block',marginBottom:4}}>{l}</span>
                <input value={ac[k]} type={tp} onChange={e=>{ setAc({...ac,[k]:e.target.value}); setAcMsg(null); }}
                  style={{width:'100%',boxSizing:'border-box',padding:'11px 12px',borderRadius:11,border:'1.5px solid '+CO.hair,fontSize:14,fontFamily:'inherit',background:'#fff'}}/>
              </label>))}
            <button onClick={saveAc} disabled={acBusy} style={{width:'100%',padding:12,borderRadius:11,cursor:acBusy?'default':'pointer',fontWeight:700,fontSize:14,fontFamily:'inherit',
              border:'1.6px solid '+CO.brand,background:CO.soft,color:CO.ink,opacity:acBusy?.7:1}}>{acBusy?'กำลังบันทึก…':'บันทึกบัญชีรับเงิน'}</button>
            {acMsg?<div style={{marginTop:9,fontSize:12.5,fontWeight:600,lineHeight:1.5,color:acMsg.ok?CO.ink:CO.red,background:acMsg.ok?CO.softer:'#FDEDEA',borderRadius:10,padding:'9px 11px'}}>{acMsg.text}</div>:null}
          </div>
          <div style={{background:CO.bg,borderRadius:12,padding:'11px 12px',marginTop:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}><span>ยอดรับจากลูกค้า (สะสม)</span><b>{B(s.gross)}</b></div>
            <div style={{...hint,marginTop:4,lineHeight:1.55}}>เข้าบัญชี{acctLabel?' '+acctLabel:'ร้าน'}โดยตรง · ระบบบันทึก/จับคู่บิลให้ ไม่ได้ถือเงินแทนร้าน</div>
          </div>
        </div>}
        {!compact&&<React.Fragment>
          <div style={{marginTop:11,background:'#FFF6E2',borderRadius:12,padding:'10px 12px',fontSize:12,color:'#7A5B08',lineHeight:1.6}}>
            ⚖️ กระเป๋าในระบบใช้ <b>จ่ายค่าบริการระบบ</b> เท่านั้น · <b>ถอนเป็นเงินสดไม่ได้</b> (ยังไม่มีใบอนุญาตเงินอิเล็กทรอนิกส์) — ยอดขายของร้านเข้าบัญชีร้านเองทุกบาท
          </div>
          <button onClick={()=>setLog(v=>!v)} style={{border:'none',background:'none',color:CO.ink,fontWeight:700,fontSize:12.5,cursor:'pointer',marginTop:10,padding:0,fontFamily:'inherit'}}>{log?'ซ่อนเดินบัญชีรับเงิน':'ดูเดินบัญชีรับเงินลูกค้า'}</button>
          {log?<div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
            {s.ledger.length?[...s.ledger].reverse().slice(0,25).map((l,i)=>(
              <div key={i} style={{display:'flex',gap:10,alignItems:'center',background:CO.bg,borderRadius:10,padding:'9px 11px'}}>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.note}</div>
                  <div style={{fontSize:11,color:CO.t3}}>{new Date(l.ts).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · {l.method||'—'}{l.auto?' · จับยอดอัตโนมัติ':''}</div></div>
                <div style={{fontSize:13.5,fontWeight:800,color:l.amount>0?CO.ink:CO.red}}>{l.amount>0?'+':''}{B(l.amount)}</div>
              </div>)):<div style={{...hint,padding:'8px 2px'}}>ยังไม่มีรายการรับเงิน</div>}
          </div>:null}
        </React.Fragment>}
      </div>
    );
  }
  window.KDReceivePanel=KDReceivePanel;
})();
