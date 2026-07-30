// kaidee-map.jsx — free map (Leaflet + OpenStreetMap) address-pin picker + helpers
// ไม่มีค่าใช้จ่าย/ไม่ต้อง API key — ใช้ OSM tiles

// ระยะทางระหว่าง 2 พิกัด (กม.)
function haversineKm(a, b){
  if(!a || !b || a.lat==null || b.lat==null) return 0;
  const R=6371, toR=(x)=>x*Math.PI/180;
  const dLat=toR(b.lat-a.lat), dLng=toR(b.lng-a.lng);
  const s=Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
  return R*2*Math.asin(Math.sqrt(s));
}
// ลิงก์นำทาง (เปิดแอปแผนที่ในมือถือ — เหมือน Grab ส่งพิกัดต่อ)
function navUrl(lat, lng){ return 'https://www.google.com/maps/dir/?api=1&destination='+lat+','+lng; }

// แผนที่ปักหมุด: ลากหมุด/แตะแผนที่เพื่อเลือกตำแหน่ง
function MapPicker({ value, center, onPick, height=230 }){
  const elRef = React.useRef(null);
  const mapObj = React.useRef(null);
  const mkObj = React.useRef(null);
  const [locating, setLocating] = React.useState(false);
  React.useEffect(()=>{
    if(!window.L || !elRef.current || mapObj.current) return;
    const start = value || center || { lat:13.7563, lng:100.5018 };
    const m = window.L.map(elRef.current, { zoomControl:true }).setView([start.lat, start.lng], 16);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap' }).addTo(m);
    const mk = window.L.marker([start.lat, start.lng], { draggable:true }).addTo(m);
    mk.on('dragend', ()=>{ const p=mk.getLatLng(); onPick && onPick({ lat:+p.lat.toFixed(6), lng:+p.lng.toFixed(6) }); });
    m.on('click', (e)=>{ mk.setLatLng(e.latlng); onPick && onPick({ lat:+e.latlng.lat.toFixed(6), lng:+e.latlng.lng.toFixed(6) }); });
    mapObj.current = m; mkObj.current = mk;
    setTimeout(()=>{ try{ m.invalidateSize(); }catch(e){} }, 250);
    return ()=>{ try{ m.remove(); }catch(e){} mapObj.current=null; };
  }, []);
  const useMyLocation = ()=>{
    if(!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition((pos)=>{
      const p={ lat:+pos.coords.latitude.toFixed(6), lng:+pos.coords.longitude.toFixed(6) };
      if(mapObj.current && mkObj.current){ mapObj.current.setView([p.lat,p.lng],17); mkObj.current.setLatLng([p.lat,p.lng]); }
      onPick && onPick(p); setLocating(false);
    }, ()=>setLocating(false), { enableHighAccuracy:true, timeout:8000 });
  };
  return (
    <div style={{ marginTop:10 }}>
      <div ref={elRef} style={{ width:'100%', height, borderRadius:14, overflow:'hidden', border:'1px solid var(--hair-2)' }}/>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
        <button onClick={useMyLocation} className="kd-btn" style={{ padding:'9px 13px', fontSize:12.5, background:'var(--brand-soft)', color:'var(--brand-ink)' }}>{React.cloneElement(IC.pin,{size:14})} {locating?'กำลังหา…':'ใช้ตำแหน่งฉัน'}</button>
        <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>ลากหมุด หรือแตะแผนที่เพื่อปักตำแหน่งให้แม่น</span>
      </div>
    </div>
  );
}

Object.assign(window, { MapPicker, haversineKm, navUrl });
