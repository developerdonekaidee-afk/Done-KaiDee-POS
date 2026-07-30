/* kd-sponsor-feed.jsx — การ์ด "ดีลใกล้คุณ" (สปอนเซอร์) ใช้ร่วมทุกโมดูล + เอนจินจับคู่ดีล
   • คูปองจาก kd_sponsor_coupons_v1 · ทีเออร์จาก kd_sponsor_tiers_v1 / kd_sponsor_entitlement_v1
   • ⭐ จับคู่จากพฤติกรรม (ads targeting) — ประมวลผล "ในเครื่อง" ทั้งหมด ไม่ส่งข้อมูลรายคนออก (PDPA)
       kd_taste_v1   สัญญาณเบา: หมวดที่สั่งบ่อย · ช่วงเวลา · ยอดเฉลี่ย · ความถี่ (ไม่เก็บชื่อ/เบอร์)
       kd_sponsor_impr_v1  โชว์/กด/ใช้คูปอง → bandit ง่าย ๆ (โชว์แล้วไม่กด = ลดคะแนน · แปลงได้ = ดันขึ้น)
       ทีเออร์ = "ตัวถ่วงน้ำหนัก" ไม่ใช่ตัวตัดสินเดียว
   • ลูกค้าปิดรับโฆษณาได้: kd_ads_optout_v1 (window.KDTaste.optOut(true))
   ใช้:  const SF=window.KDSponsorFeed;  <SF mod="pos" limit={2} exclude={['food']} avg={180}/>   (React)
        window.kdSponsorFeedHTML('market')       → string HTML (หน้าที่ไม่ใช้ React)
        window.kdSponsorDeals({limit:2,exclude:['food'],avg:180,mod:'board'})
        window.KDTaste.note({cats:['food'],amount:180})      ← เรียกตอนสั่งสำเร็จ/จบบิล
        window.kdSponsorCatsOfShop(shop)         → หมวดของร้านนั้น (ใช้เป็น exclude กันดีลชนกัน) */
(function(){
  const CP_KEY='kd_sponsor_coupons_v1', TIER_KEY='kd_sponsor_tiers_v1', ENT_KEY='kd_sponsor_entitlement_v1',
        IMPR_KEY='kd_sponsor_impr_v1', TASTE_KEY='kd_taste_v1', OPTOUT_KEY='kd_ads_optout_v1';
  const B=(n)=>'฿'+Number(n||0).toLocaleString('th-TH');
  const SHOPS={
    potato:{name:'Potato Corner',emoji:'🥔',type:'ของกินเล่น',cat:'snack'},
    kruaploy:{name:'ครัวป้าพลอย ตามสั่ง',emoji:'🍜',type:'อาหารตามสั่ง',cat:'food'},
    brew:{name:'Brew คาเฟ่',emoji:'☕',type:'คาเฟ่',cat:'cafe'},
    freshveg:{name:'สวนผักลุงมี',emoji:'🥬',type:'ผักสด',cat:'fresh'},
    cpwholesale:{name:'CP ค้าส่ง',emoji:'📦',type:'ค้าส่ง',cat:'wholesale'},
    homemart:{name:'HomeMart ของใช้',emoji:'🧺',type:'ของใช้ในบ้าน',cat:'home'},
  };
  const RANK={premium:0,pro:0,growth:1,plus:1,basic:2,free:3};
  const TIER_W={premium:1,pro:1,growth:.72,plus:.72,basic:.45,free:.3};
  const SLOTS=['morning','noon','afternoon','evening','night'];
  const SLOT_TH={morning:'เช้า',noon:'กลางวัน',afternoon:'บ่าย',evening:'เย็น',night:'กลางคืน'};
  function read(k,fb){ try{ const v=JSON.parse(localStorage.getItem(k)); return v==null?fb:v; }catch(e){ return fb; } }
  function write(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  function slotOf(h){ return h>=5&&h<11?'morning':h>=11&&h<14?'noon':h>=14&&h<17?'afternoon':h>=17&&h<21?'evening':'night'; }

  /* ── สัญญาณพฤติกรรม (ในเครื่องเท่านั้น) ─────────────────────────── */
  function optOut(){ return read(OPTOUT_KEY,false)===true; }
  function taste(){ const t=read(TASTE_KEY,null); return (t&&typeof t==='object')?t:{cats:{},slots:{},n:0,sum:0}; }
  function note(sig){
    if(optOut()) return null;
    const t=taste(); const cats=[].concat((sig&&(sig.cats||sig.cat))||[]).filter(Boolean);
    t.cats=t.cats||{}; t.slots=t.slots||{};
    cats.forEach(c=>{ const k=String(c).toLowerCase(); t.cats[k]=(t.cats[k]||0)+1; });
    const at=(sig&&sig.at)||Date.now(); const s=slotOf(new Date(at).getHours());
    t.slots[s]=(t.slots[s]||0)+1;
    const amt=Number(sig&&sig.amount)||0; if(amt>0){ t.n=(t.n||0)+1; t.sum=(t.sum||0)+amt; }
    t.last=at; t.updatedAt=Date.now(); write(TASTE_KEY,t); return t;
  }
  const avgBill=(t)=> (t.n>0? t.sum/t.n : 0);
  const topSlot=(t)=>{ let b=null,bv=0; SLOTS.forEach(s=>{ const v=(t.slots||{})[s]||0; if(v>bv){ bv=v; b=s; } }); return b; };

  /* ── bandit: เรียนรู้จากผลจริง ─────────────────────────────────── */
  function stats(mod){ const all=read(IMPR_KEY,{})||{}; const k=String(mod||'app');
    return { impr:all[k]||{}, clicks:all['clicks:'+k]||{}, conv:all['conv:'+k]||{} }; }
  function banditAdj(id,st){
    const i=st.impr[id]||0, c=st.clicks[id]||0, v=st.conv[id]||0;
    if(i<4) return 0;                       // ยังโชว์น้อย = ให้โอกาสสำรวจ (explore)
    const ctr=c/i; let s=Math.min(.9, ctr*3);
    if(v>0) s+=Math.min(.7, v*.35);         // แปลงได้ = ดันขึ้น
    if(c===0&&i>=6) s-=Math.min(.6, (i-5)*.09);   // โชว์แล้วไม่กดซ้ำ ๆ = ลดคะแนน
    return s;
  }

  /* ── ทีเออร์ ───────────────────────────────────────────────────── */
  function tiers(){ const m=read(TIER_KEY,null); if(m&&typeof m==='object') return m;
    const ent=read(ENT_KEY,null); const t=ent&&(ent.tier||ent.plan); const biz=ent&&(ent.biz||ent.shopId);
    return (t&&biz)?{[biz]:t}:{}; }
  function tierOf(id,map){ return String((map[id]||'basic')).toLowerCase(); }

  /* ── หมวดของร้าน (ใช้กันดีลชนกับร้านที่ลูกค้าอยู่) ───────────────── */
  const CAT_HINT=[['cafe',/กาแฟ|คาเฟ่|ชานม|เครื่องดื่ม|coffee|cafe|tea|drink/i],
    ['snack',/ของกินเล่น|ขนม|ทอด|เฟรนช์ฟราย|ป๊อป|snack|dessert|เบเกอ|ไอศ/i],
    ['food',/อาหาร|ตามสั่ง|ข้าว|ก๋วยเตี๋ยว|ครัว|ส้มตำ|หมูกระทะ|ปิ้งย่าง|restaurant|food|noodle|rice/i],
    ['fresh',/ผัก|ผลไม้|เนื้อ|หมู|ไก่|ปลา|ทะเล|สด|fresh|veg|fruit|meat/i],
    ['wholesale',/ค้าส่ง|ขายส่ง|ยกลัง|wholesale/i],
    ['home',/ของใช้|เครื่องเขียน|ฮาร์ดแวร์|ซักรีด|home|mart|hardware/i],
    ['fitness',/ฟิตเนส|ยิม|gym|fitness/i],
    ['service',/ซ่อม|บริการ|ตัดผม|เสริมสวย|service|repair|salon/i]];
  function catsOfShop(shop){
    if(!shop) return [];
    const set=[].concat(shop.spCat||shop.cat||shop.cats||[]).filter(Boolean).map(s=>String(s).toLowerCase());
    if(set.length) return set;
    const txt=[shop.typeLabel,shop.type,shop.bizType,shop.name].filter(Boolean).join(' ');
    const out=[]; CAT_HINT.forEach(([c,re])=>{ if(re.test(txt)) out.push(c); });
    return out.length?out:[];
  }

  /* ── เอนจินจับคู่ ──────────────────────────────────────────────── */
  function deals(opts){
    if(optOut()) return [];
    const o=(typeof opts==='number'||opts==null)?{limit:opts}:opts;
    const limit=o.limit||6, mod=o.mod||'app';
    const excl=[].concat(o.exclude||[]).filter(Boolean).map(s=>String(s).toLowerCase());
    const cps=read(CP_KEY,[]); const map=tiers(); const t=taste(); const st=stats(mod);
    const avg=Number(o.avg)||avgBill(t); const nowSlot=slotOf(new Date().getHours());
    const peak=topSlot(t);
    const catTotal=Object.values(t.cats||{}).reduce((a,b)=>a+b,0)||0;
    const seen={};
    return (Array.isArray(cps)?cps:[])
      .map(c=>{ if(!c||!c.shopId||!c.title) return null;
        if(c.quota&&(c.used||0)>=c.quota) return null;
        const s=SHOPS[c.shopId]||{name:c.shopId,emoji:'🏬',type:'ร้านสปอนเซอร์',cat:''};
        const cat=String(c.cat||s.cat||'').toLowerCase();
        if(cat&&excl.indexOf(cat)>=0) return null;                       // หมวดชนกับร้านนี้ = ไม่โชว์
        const cslots=[].concat(c.slots||c.hours||[]).filter(Boolean).map(x=>String(x).toLowerCase());
        if(cslots.length&&cslots.indexOf(nowSlot)<0) return null;        // สปอนตั้งช่วงเวลาไว้ = โชว์ตามช่วง
        const tr=tierOf(c.shopId,map);
        let sc=(TIER_W[tr]!=null?TIER_W[tr]:.45);                        // ทีเออร์ = ตัวถ่วงน้ำหนัก
        const why=[];
        if(cat&&catTotal>0){ const share=((t.cats||{})[cat]||0)/catTotal;
          if(share>0){ sc+=share*2; why.push('สั่ง'+(s.type||cat)+'บ่อย'); } }
        if(avg>0&&c.minSpend>0){ const r=avg/Number(c.minSpend);
          sc += r>=1?.55 : r>=.7?.28 : -.35;                             // ยอดใกล้เคียง/ถึงขั้นต่ำ
          if(r>=1) why.push('ยอดบิลถึงขั้นต่ำ');
        } else if(avg>0&&!c.minSpend) sc+=.15;
        if(cslots.length) { sc+=.3; why.push('ช่วง'+(SLOT_TH[nowSlot]||nowSlot)); }
        if(peak&&peak===nowSlot) sc+=.2;
        sc+=banditAdj(c.id,st);
        return {...c, cat, shop:s, tier:tr, rank:(RANK[tr]!=null?RANK[tr]:2), score:sc, why:why.slice(0,2)}; })
      .filter(Boolean)
      .sort((a,b)=> b.score-a.score || a.rank-b.rank || ((b.value||0)-(a.value||0)))
      .filter(d=>{ if(seen[d.shopId]>=2) return false; seen[d.shopId]=(seen[d.shopId]||0)+1; return true; })
      .slice(0,limit);
  }

  function tick(bucket,mod,ids){ try{ const all=read(IMPR_KEY,{})||{}; const k=(bucket?bucket+':':'')+String(mod||'app');
    const m=all[k]||{}; [].concat(ids).forEach(id=>{ if(id!=null) m[id]=(m[id]||0)+1; }); all[k]=m; all.updatedAt=Date.now();
    write(IMPR_KEY,all); }catch(e){} }
  const bump=(mod,ids)=>tick('',mod,ids);
  function open(mod,id,couponId){
    tick('clicks',mod,couponId!=null?couponId:id);
    const url='Sponsor Shop.html?from='+encodeURIComponent(mod||'app')+'&shop='+encodeURIComponent(id);
    try{ window.open(url,'_blank'); }catch(e){ location.href=url; }
  }
  const conv=(mod,couponId)=>tick('conv',mod,couponId);   // ใช้คูปองสำเร็จ → ดันคะแนนขึ้น
  const badge=(t)=>t==='premium'||t==='pro'?['Premium','#8A5A00','#FFF3D6']:t==='growth'||t==='plus'?['Growth','#12805A','#E9F7F1']:null;
  const val=(d)=>d.kind==='pct'?('ลด '+(d.value||0)+'%'):('ลด '+B(d.value));

  function KDSponsorFeed({ mod, limit, title, compact, exclude, avg, shop, onOpen }){
    const R=window.React; const {useEffect,useState}=R;
    const excl=React.useMemo(()=> [].concat(exclude||[]).concat(shop?catsOfShop(shop):[]), [String(exclude), shop&&shop.name]);
    const [off,setOff]=useState(()=>optOut());
    const [rows,setRows]=useState(()=>off?[]:deals({limit,mod,exclude:excl,avg}));
    useEffect(()=>{ setRows(off?[]:deals({limit,mod,exclude:excl,avg})); },[limit,off,avg]);
    useEffect(()=>{ if(rows.length) bump(mod,rows.map(r=>r.id||r.shopId)); },[rows.length]);
    if(off||!rows.length) return null;
    const hint={fontSize:11.5,color:'var(--ink-3,#8A8A85)'};
    return (
      <div data-kd-sponsor={mod||'app'} style={{background:'#fff',border:'1px solid var(--hair,#E7E7E4)',borderRadius:16,padding:compact?12:15}}>
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:8,marginBottom:10}}>
          <div style={{fontWeight:800,fontSize:14.5}}>{title||'🎁 ดีลใกล้คุณ'}</div>
          <div style={hint}>ร้านสปอนเซอร์ในเครือขายดี</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {rows.map(d=>{ const bg=badge(d.tier); return (
            <button key={d.id} onClick={()=>{ onOpen?onOpen(d):open(mod,d.shopId,d.id); }}
              style={{display:'flex',alignItems:'center',gap:11,textAlign:'left',width:'100%',padding:'10px 11px',cursor:'pointer',fontFamily:'inherit',
                border:'1px solid var(--hair,#EFEFEC)',borderRadius:13,background:'var(--bg,#F9F9F7)'}}>
              <div style={{width:40,height:40,borderRadius:11,background:'#fff',border:'1px solid var(--hair,#EFEFEC)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flex:'0 0 auto'}}>{d.shop.emoji}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{fontSize:13.5,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.shop.name}</div>
                  {bg?<span style={{fontSize:9.5,fontWeight:800,color:bg[1],background:bg[2],borderRadius:6,padding:'2px 5px',flex:'0 0 auto'}}>{bg[0]}</span>:null}
                </div>
                <div style={{fontSize:12,color:'var(--ink-2,#4A4A46)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.title}</div>
                {!compact&&<div style={hint}>{d.why&&d.why.length?('เพราะ'+d.why.join(' · ')):(d.shop.type+(d.minSpend?(' · ขั้นต่ำ '+B(d.minSpend)):''))}{d.quota?(' · เหลือ '+Math.max(0,d.quota-(d.used||0))+' สิทธิ์'):''}</div>}
              </div>
              <div style={{textAlign:'right',flex:'0 0 auto'}}>
                <div style={{fontSize:13,fontWeight:800,color:'var(--brand-ink,#12805A)'}}>{val(d)}</div>
                <div style={hint}>รับดีล →</div>
              </div>
            </button>); })}
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginTop:9}}>
          <div style={{...hint,lineHeight:1.45}}>เลือกดีลจากพฤติกรรมการสั่งในเครื่องนี้ ไม่ส่งข้อมูลส่วนตัวออก</div>
          <button onClick={()=>{ write(OPTOUT_KEY,true); setOff(true); }}
            style={{border:'none',background:'none',padding:'2px 0',cursor:'pointer',fontFamily:'inherit',fontSize:11.5,fontWeight:700,color:'var(--ink-3,#8A8A85)',textDecoration:'underline',flex:'0 0 auto'}}>ไม่รับดีล</button>
        </div>
      </div>
    );
  }
  /* เวอร์ชัน HTML ล้วน (หน้าที่ไม่ใช้ React) — คืน string · ปุ่มเรียก window.kdSponsorOpen(mod,id,couponId) */
  function kdSponsorFeedHTML(mod,limit,title,opt){
    const rows=deals(Object.assign({limit,mod},opt||{})); if(!rows.length) return '';
    bump(mod,rows.map(r=>r.id||r.shopId));
    const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    return '<div style="background:#fff;border:1px solid #E7E7E4;border-radius:16px;padding:14px">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px"><b style="font-size:14.5px">'+esc(title||'🎁 ดีลใกล้คุณ')+'</b><span style="font-size:11.5px;color:#8A8A85">ร้านสปอนเซอร์ในเครือขายดี</span></div>'
      + rows.map(d=>{ const bg=badge(d.tier); return '<button onclick="kdSponsorOpen(\''+esc(mod||'app')+'\',\''+esc(d.shopId)+'\',\''+esc(d.id)+'\')" style="display:flex;gap:11px;align-items:center;width:100%;text-align:left;padding:10px 11px;margin-bottom:8px;border:1px solid #EFEFEC;border-radius:13px;background:#F9F9F7;cursor:pointer;font-family:inherit">'
        + '<span style="width:40px;height:40px;border-radius:11px;background:#fff;border:1px solid #EFEFEC;display:flex;align-items:center;justify-content:center;font-size:20px">'+esc(d.shop.emoji)+'</span>'
        + '<span style="flex:1;min-width:0"><span style="display:flex;gap:6px;align-items:center"><b style="font-size:13.5px">'+esc(d.shop.name)+'</b>'
        + (bg?'<span style="font-size:9.5px;font-weight:800;color:'+bg[1]+';background:'+bg[2]+';border-radius:6px;padding:2px 5px">'+bg[0]+'</span>':'')+'</span>'
        + '<span style="display:block;font-size:12px;color:#4A4A46">'+esc(d.title)+'</span></span>'
        + '<span style="text-align:right"><b style="font-size:13px;color:#12805A">'+esc(val(d))+'</b><span style="display:block;font-size:11.5px;color:#8A8A85">รับดีล →</span></span></button>'; }).join('')
      + '</div>';
  }
  Object.assign(window,{ KDSponsorFeed, kdSponsorFeedHTML, kdSponsorOpen:open, kdSponsorDeals:deals,
    kdSponsorConv:conv, kdSponsorBump:bump, kdSponsorCatsOfShop:catsOfShop, kdSponsorStats:stats,
    KDTaste:{ note, read:taste, slotOf, avg:()=>avgBill(taste()), peak:()=>topSlot(taste()),
      optOut:(v)=>{ write(OPTOUT_KEY,v!==false); return v!==false; }, isOptOut:optOut,
      reset:()=>{ try{ localStorage.removeItem(TASTE_KEY); }catch(e){} } } });
})();
