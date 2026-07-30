/* Shared palette, helpers, and mockup atoms for the :Done POS demo video */

const PC = {
  bg: '#EFF2F1',
  bgDeep: '#0E241C',
  ink: '#16382A',
  green: '#1E9E6E',
  greenDk: '#178A5E',
  teal: '#16A69B',
  blue: '#2E6FB0',
  blueDk: '#274E73',
  dotBlue: '#3B6FC4',
  dotTeal: '#16A69B',
  card: '#FFFFFF',
  line: '#E3E8E6',
  muted: '#6E827B',
  amber: '#E8A13A',
  red: '#DB5C4E',
  grad: 'linear-gradient(135deg,#1E9E6E 0%,#2E7B9E 55%,#274E73 100%)',
  gradSoft: 'linear-gradient(135deg,#EAF6F0 0%,#E7F0F6 100%)',
};

// interpolate shorthand: iv(t, inputStops, outputStops, ease?)
const iv = (t, inp, out, ease) => interpolate(inp, out, ease || Easing.linear)(t);
// ping: 0→1→0 across [a,b]
const ping = (t, a, b, ease) => {
  const m = (a + b) / 2;
  return t < m ? iv(t, [a, m], [0, 1], ease || Easing.easeOutCubic)
               : iv(t, [m, b], [1, 0], ease || Easing.easeInCubic);
};

const TH = "'IBM Plex Sans Thai','Anuphan',sans-serif";
const DP = "'Anuphan','IBM Plex Sans Thai',sans-serif";
const MO = "'IBM Plex Mono',monospace";

function SoftBg({ from = '#EAF6F0', to = '#E4EEF6', children, style }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(150deg,${from},${to})`, overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', width: 520, height: 520, borderRadius: '50%', top: -160, right: -120, background: 'radial-gradient(circle,rgba(30,158,110,0.16),transparent 70%)' }} />
      <div style={{ position: 'absolute', width: 460, height: 460, borderRadius: '50%', bottom: -180, left: -140, background: 'radial-gradient(circle,rgba(46,111,176,0.16),transparent 70%)' }} />
      {children}
    </div>
  );
}

// Phone bezel with screen. Pass screen content as children.
function Phone({ children, w = 330, style, screenBg = '#FFFFFF' }) {
  const h = w * 2.05;
  return (
    <div style={{ width: w, height: h, borderRadius: w * 0.13, background: 'linear-gradient(160deg,#1a2a24,#0c1712)', padding: w * 0.028, boxShadow: '0 40px 80px -30px rgba(12,30,22,0.55),0 0 0 1px rgba(0,0,0,0.3)', position: 'relative', ...style }}>
      <div style={{ width: '100%', height: '100%', borderRadius: w * 0.105, background: screenBg, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: w * 0.34, height: w * 0.055, background: '#0c1712', borderRadius: `0 0 ${w * 0.05}px ${w * 0.05}px`, zIndex: 40 }} />
        {children}
      </div>
    </div>
  );
}

function StatusBar({ dark, label = '9:41' }) {
  const c = dark ? '#fff' : PC.ink;
  return (
    <div style={{ height: 34, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 20px 4px', fontFamily: TH, fontSize: 13, fontWeight: 600, color: c }}>
      <span>{label}</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <span style={{ fontSize: 11 }}>●●●</span>
        <span style={{ width: 22, height: 11, borderRadius: 3, border: `1.5px solid ${c}`, position: 'relative', opacity: 0.9 }}>
          <span style={{ position: 'absolute', inset: 1.5, right: 6, background: c, borderRadius: 1 }} />
        </span>
      </div>
    </div>
  );
}

// Animated arrow cursor. x,y in the parent's coordinate space; scale for press.
function Cursor({ x, y, press = 0 }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 60, transform: `scale(${1 - press * 0.18})`, transformOrigin: 'top left', filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.3))', pointerEvents: 'none' }}>
      <svg width="30" height="30" viewBox="0 0 24 24">
        <path d="M4 2 L4 20 L9 15 L12.5 22 L15.5 20.5 L12 14 L19 14 Z" fill="#fff" stroke="#16382A" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      {press > 0 && <div style={{ position: 'absolute', left: 2, top: 2, width: 26, height: 26, borderRadius: '50%', border: '2px solid rgba(30,158,110,0.7)', transform: `scale(${1 + press * 1.2})`, opacity: 1 - press }} />}
    </div>
  );
}

// Brand wordmark built from image logo
function Logo({ h = 90, style }) {
  return <img src="assets/done-logo.png" alt=":Done" style={{ height: h, display: 'block', ...style }} />;
}

// Pill tag
function Pill({ children, bg = PC.green, color = '#fff', style }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 999, background: bg, color, fontFamily: TH, fontWeight: 600, fontSize: 15, ...style }}>{children}</span>;
}

Object.assign(window, { PC, iv, ping, TH, DP, MO, SoftBg, Phone, StatusBar, Cursor, Logo, Pill });
