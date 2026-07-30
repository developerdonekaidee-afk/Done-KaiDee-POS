/* Narration (Thai TTS via SpeechSynthesis) + on-screen captions + sound toggle
   Speaks once per scene entry; captions always show (works even if audio is off). */

// ── audio state ──
window.__kdNarr = window.__kdNarr || { on: false, last: null, voice: null, ready: false };

function kdPickThaiVoice() {
  try {
    const vs = window.speechSynthesis.getVoices() || [];
    const th = vs.filter(v => /th(-|_)?/i.test(v.lang) || /thai/i.test(v.name));
    const pool = th.length ? th : vs;
    // prefer a male-sounding voice
    const male = pool.find(v => /male|ชาย|man|\b(niwat|konlawat|pattara)\b/i.test(v.name))
      || pool.find(v => !/female|หญิง|woman|kanya|\bsiri\b|premwadee/i.test(v.name));
    return male || pool[0] || null;
  } catch (e) { return null; }
}
try { window.speechSynthesis && (window.speechSynthesis.onvoiceschanged = () => { window.__kdNarr.voice = kdPickThaiVoice(); }); } catch (e) {}

// speak once when the active scene id changes
function kdSpeakScene(id, text, caption) {
  const N = window.__kdNarr;
  N.capText = (caption != null ? caption : text) || '';
  N.capId = id;
  if (N.last === id) return;
  N.last = id;
  if (!N.on || !text) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH';
    u.rate = 1.02; u.pitch = 0.82; u.volume = 1;
    const v = N.voice || kdPickThaiVoice();
    if (v) u.voice = v;
    synth.speak(u);
  } catch (e) {}
}

// Sound toggle button (top-right). Enabling primes the TTS engine with a user gesture.
function SoundToggle() {
  const [on, setOn] = React.useState(window.__kdNarr.on);
  const toggle = () => {
    const next = !on;
    window.__kdNarr.on = next;
    setOn(next);
    try {
      if (next) {
        window.__kdNarr.voice = kdPickThaiVoice();
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0; window.speechSynthesis.speak(u); // unlock on gesture
        window.__kdNarr.last = null; // let current scene re-speak
      } else {
        window.speechSynthesis.cancel();
      }
    } catch (e) {}
  };
  return (
    <button onClick={toggle} style={{
      position: 'fixed', top: 22, right: 22, zIndex: 200, cursor: 'pointer',
      border: 'none', borderRadius: 999, padding: '10px 18px', fontFamily: TH, fontWeight: 700, fontSize: 15,
      background: on ? 'rgba(30,158,110,0.95)' : 'rgba(255,255,255,0.92)', color: on ? '#fff' : '#16382A',
      boxShadow: '0 8px 20px -8px rgba(20,50,40,0.4)', display: 'flex', alignItems: 'center', gap: 8,
      backdropFilter: 'blur(6px)'
    }}>
      <span style={{ fontSize: 16 }}>{on ? '🔊' : '🔈'}</span>{on ? 'เสียง เปิด' : 'แตะเปิดเสียง'}
    </button>
  );
}

// Bottom caption bar — fades in/out with scene progress. text = current subtitle.
function Caption({ progress: p, text, accent = '#1E9E6E' }) {
  const a = iv(p, [0.04, 0.14, 0.9, 0.99], [0, 1, 1, 0]);
  if (!text) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 92, display: 'flex', justifyContent: 'center', padding: '0 46px', opacity: a, zIndex: 120 }}>
      <div style={{ maxWidth: 620, textAlign: 'center', background: 'rgba(14,36,28,0.86)', backdropFilter: 'blur(8px)', borderRadius: 18, padding: '15px 26px', boxShadow: '0 16px 40px -18px rgba(0,0,0,0.5)' }}>
        <span style={{ fontFamily: TH, fontSize: 26, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>{text}</span>
        <span style={{ display: 'block', height: 3, width: 46, margin: '11px auto 0', borderRadius: 999, background: accent }} />
      </div>
    </div>
  );
}

// Progress dots for the whole video (which scene we're on)
function SceneDots({ index, total }) {
  return (
    <div style={{ position: 'absolute', top: 26, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 7, zIndex: 120 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{ width: i === index ? 26 : 7, height: 7, borderRadius: 999, background: i === index ? PC.green : 'rgba(20,50,40,0.22)', transition: 'width .3s' }} />
      ))}
    </div>
  );
}

// Global caption bar — reads window.__kdNarr.capText (works for scenes without their own <Caption>)
function CaptionBar({ accent = '#1E9E6E' }) {
  const [st, setSt] = React.useState({ text: '', id: null });
  React.useEffect(() => {
    let raf;
    const tick = () => { const N = window.__kdNarr; if (N.capId !== st.id) setSt({ text: N.capText || '', id: N.capId }); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [st.id]);
  if (!st.text) return null;
  return (
    <div key={st.id} style={{ position: 'fixed', left: 0, right: 0, bottom: 54, display: 'flex', justifyContent: 'center', padding: '0 46px', zIndex: 150, animation: 'kdCapIn .5s ease' }}>
      <div style={{ maxWidth: 760, textAlign: 'center', background: 'rgba(14,36,28,0.86)', backdropFilter: 'blur(8px)', borderRadius: 16, padding: '13px 26px', boxShadow: '0 16px 40px -18px rgba(0,0,0,0.5)' }}>
        <span style={{ fontFamily: TH, fontSize: 24, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>{st.text}</span>
        <span style={{ display: 'block', height: 3, width: 46, margin: '10px auto 0', borderRadius: 999, background: accent }} />
      </div>
    </div>
  );
}
try { if (!document.getElementById('kd-cap-kf')) { const s = document.createElement('style'); s.id = 'kd-cap-kf'; s.textContent = '@keyframes kdCapIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'; document.head.appendChild(s); } } catch (e) {}

Object.assign(window, { kdSpeakScene, SoundToggle, Caption, SceneDots, CaptionBar });
