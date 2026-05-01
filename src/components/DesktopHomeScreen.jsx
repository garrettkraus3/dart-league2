import { useEffect, useState } from "react";
import { Zap, Trophy, BarChart2 } from "lucide-react";

const APP_VERSION = "V2.2026.03.29.21.34.29";

const CARDS = [
  { id: "new",     target: "new",     label: "NEW MATCH", sub: "Start a fresh game",        icon: Zap,       color: "#e64100" },
  { id: "seasons", target: "seasons", label: "SEASONS",   sub: "League play & schedules",   icon: Trophy,    color: "#e8a020" },
  { id: "stats",   target: "stats",   label: "STATS",     sub: "Player & season analytics", icon: BarChart2, color: "#3ddc84" },
];

// Crater eruption epicenter (matches volcano peak in SVG coords)
const CRATER_X = 1010;
const CRATER_Y = 312;
const EMBER_COUNT = 22;

export default function DesktopHomeScreen({ navigate }) {
  const [erupting, setErupting] = useState(false);

  // Ambient eruption: random burst every 3–10s
  useEffect(() => {
    let id;
    const trigger = () => {
      setErupting(true);
      // Reset class after burst so it can replay
      setTimeout(() => setErupting(false), 1900);
      const nextMs = 3000 + Math.random() * 7000;
      id = setTimeout(trigger, nextMs);
    };
    id = setTimeout(trigger, 1500);
    return () => clearTimeout(id);
  }, []);

  // Pre-compute ember particle props (deterministic so React reuses nodes)
  const embers = Array.from({ length: EMBER_COUNT }, (_, i) => {
    const driftX = Math.sin(i * 1.7) * 70;          // -70..+70 px sideways drift
    const startX = CRATER_X + Math.sin(i * 2.3) * 14;
    const r      = 1.6 + (i % 3) * 0.9;
    const delay  = (i * 0.04).toFixed(2);
    const dur    = (1.4 + (i % 5) * 0.18).toFixed(2);
    const fill   = i % 3 === 0 ? "#ffd460" : i % 3 === 1 ? "#ff8a3a" : "#ff5520";
    return { i, driftX, startX, r, delay, dur, fill };
  });

  // Pre-compute grass blades
  const blades = Array.from({ length: 110 }, (_, i) => {
    const x      = i * 18 + (i % 2 ? 6 : 0) - 10;
    const h      = 60 + (i % 7) * 14;
    const sway   = (i % 5) * 0.18;
    const dur    = (3 + (i % 6) * 0.35).toFixed(2);
    const delay  = (-i * 0.13).toFixed(2);
    const tilt   = (Math.sin(i * 1.1) * 6).toFixed(1);
    const color  = i % 3 === 0 ? "#1c3a1c" : i % 3 === 1 ? "#2d5a2a" : "#3d6e3a";
    return { i, x, h, sway, dur, delay, tilt, color };
  });

  // Distant tree line
  const trees = Array.from({ length: 60 }, (_, i) => {
    const x = i * 32 + 8;
    const h = 18 + (i % 6) * 5;
    return { i, x, h };
  });

  return (
    <div className="dh-root">
      <svg
        className="dh-scene"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="dh-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#5fb1e8" />
            <stop offset="55%"  stopColor="#a4d4ee" />
            <stop offset="92%"  stopColor="#e6efe6" />
            <stop offset="100%" stopColor="#dfe9d6" />
          </linearGradient>
          <radialGradient id="dh-sun" cx="55%" cy="22%" r="38%">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="40%"  stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="dh-volcano" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3f4d3a" />
            <stop offset="55%"  stopColor="#2c3727" />
            <stop offset="100%" stopColor="#1e261c" />
          </linearGradient>
          <linearGradient id="dh-volcano-light" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%"  stopColor="#ffffff" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="dh-hills-near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4d7338" />
            <stop offset="100%" stopColor="#2c4a22" />
          </linearGradient>
          <linearGradient id="dh-hills-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#6c8a52" />
            <stop offset="100%" stopColor="#3e5e30" />
          </linearGradient>
          <linearGradient id="dh-field" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#5f8e3a" />
            <stop offset="60%"  stopColor="#3e6c20" />
            <stop offset="100%" stopColor="#244a14" />
          </linearGradient>
          <radialGradient id="dh-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#ff8a3a" stopOpacity="0.85" />
            <stop offset="60%"  stopColor="#ff5520" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff5520" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── Sky ── */}
        <rect width="1920" height="1080" fill="url(#dh-sky)" />

        {/* Sun glow */}
        <ellipse cx="1080" cy="200" rx="640" ry="320" fill="url(#dh-sun)" />

        {/* ── Drifting clouds ── */}
        <g className="dh-clouds">
          <ellipse cx="200"  cy="180" rx="170" ry="22" fill="#ffffff" opacity="0.55" className="dh-cloud dh-cloud-1" />
          <ellipse cx="700"  cy="120" rx="240" ry="28" fill="#ffffff" opacity="0.45" className="dh-cloud dh-cloud-2" />
          <ellipse cx="1500" cy="200" rx="200" ry="22" fill="#ffffff" opacity="0.5"  className="dh-cloud dh-cloud-3" />
          <ellipse cx="1100" cy="260" rx="140" ry="16" fill="#ffffff" opacity="0.35" className="dh-cloud dh-cloud-4" />
        </g>

        {/* ── Distant snowy mountain range (back layer) ── */}
        <path
          d="M -50 620 L 180 440 L 320 520 L 460 410 L 600 500 L 780 420
             L 900 480 L 1050 400 L 1200 470 L 1380 430 L 1560 490
             L 1750 440 L 1970 510 L 1970 720 L -50 720 Z"
          fill="#a4bdc4" opacity="0.55"
        />
        <path
          d="M -50 670 L 220 540 L 420 600 L 600 510 L 780 580
             L 1000 520 L 1240 590 L 1500 540 L 1750 590 L 1970 560
             L 1970 760 L -50 760 Z"
          fill="#7a96a0" opacity="0.45"
        />

        {/* ── Volcano ── */}
        <g className="dh-volcano-grp">
          {/* main mass */}
          <path
            d="M 720 760 L 870 470 L 940 360 L 985 305 L 1010 290
               L 1035 305 L 1080 360 L 1150 470 L 1300 760 Z"
            fill="url(#dh-volcano)"
          />
          {/* faint vertical light streak */}
          <path
            d="M 720 760 L 870 470 L 940 360 L 985 305 L 1010 290
               L 1035 305 L 1080 360 L 1150 470 L 1300 760 Z"
            fill="url(#dh-volcano-light)"
          />
          {/* snow cap */}
          <path
            d="M 905 380 L 940 360 L 985 305 L 1010 290 L 1035 305 L 1080 360 L 1115 380
               L 1095 396 L 1078 388 L 1058 400 L 1035 388 L 1010 402
               L 985 388 L 962 400 L 942 388 L 925 396 Z"
            fill="#f6faf6"
          />
          {/* crater rim shadow */}
          <ellipse cx={CRATER_X} cy={CRATER_Y - 20} rx="22" ry="6" fill="#1a1208" opacity="0.85" />

          {/* crater glow (always pulsing) */}
          <ellipse
            className="dh-crater-glow"
            cx={CRATER_X} cy={CRATER_Y - 20}
            rx="42" ry="16"
            fill="url(#dh-glow)"
          />

          {/* smoke plume — looped */}
          <g className="dh-smoke">
            <circle className="dh-puff dh-puff-1" cx={CRATER_X - 4}  cy={CRATER_Y - 50}  r="22" fill="#e8e1d8" opacity="0.55" />
            <circle className="dh-puff dh-puff-2" cx={CRATER_X + 6}  cy={CRATER_Y - 90}  r="30" fill="#e8e1d8" opacity="0.45" />
            <circle className="dh-puff dh-puff-3" cx={CRATER_X - 10} cy={CRATER_Y - 140} r="42" fill="#e8e1d8" opacity="0.34" />
            <circle className="dh-puff dh-puff-4" cx={CRATER_X + 14} cy={CRATER_Y - 200} r="58" fill="#e8e1d8" opacity="0.22" />
          </g>

          {/* embers — animate only when .erupting */}
          <g className={`dh-embers ${erupting ? "erupting" : ""}`}>
            {embers.map(e => (
              <circle
                key={e.i}
                className="dh-ember"
                cx={e.startX}
                cy={CRATER_Y - 18}
                r={e.r}
                fill={e.fill}
                style={{
                  animationDelay: `${e.delay}s`,
                  animationDuration: `${e.dur}s`,
                  "--drift": `${e.driftX}px`,
                }}
              />
            ))}
          </g>
        </g>

        {/* ── Distant tree line ── */}
        <g opacity="0.78">
          {trees.map(t => (
            <ellipse key={t.i} cx={t.x} cy={760 - t.h / 2} rx={12} ry={t.h} fill="#28401e" />
          ))}
        </g>

        {/* ── Mid hills ── */}
        <path
          d="M 0 760 Q 480 700 960 750 T 1920 740 L 1920 870 L 0 870 Z"
          fill="url(#dh-hills-mid)"
        />
        <path
          d="M 0 830 Q 360 780 760 820 Q 1200 870 1500 810 Q 1750 770 1920 800 L 1920 920 L 0 920 Z"
          fill="url(#dh-hills-near)"
        />

        {/* ── Field ── */}
        <rect x="0" y="900" width="1920" height="180" fill="url(#dh-field)" />

        {/* ── Dartboard on stand (clickable → admin) ── */}
        <g
          className="dh-dartboard"
          transform="translate(720, 900)"
          onClick={() => navigate("admin")}
          role="button"
          tabIndex="0"
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate("admin")}
        >
          {/* shadow */}
          <ellipse cx="0" cy="92" rx="34" ry="6" fill="#000" opacity="0.45" />
          {/* base */}
          <rect x="-22" y="76" width="44" height="14" rx="3" fill="#1a1208" />
          {/* post */}
          <rect x="-5" y="-10" width="10" height="92" fill="#3d2a1a" />
          {/* board outer */}
          <circle cx="0" cy="-50" r="44" fill="#0e0a06" />
          {/* face */}
          <circle cx="0" cy="-50" r="40" fill="#f4e7c8" />
          {/* radial wedge segments */}
          {Array.from({ length: 20 }).map((_, i) => {
            const a = (i * 18 - 90) * Math.PI / 180;
            return (
              <path
                key={i}
                d={`M 0 -50 L ${Math.cos(a) * 40} ${Math.sin(a) * 40 - 50} A 40 40 0 0 1 ${Math.cos(a + Math.PI/10) * 40} ${Math.sin(a + Math.PI/10) * 40 - 50} Z`}
                fill={i % 2 === 0 ? "#1a1208" : "#f4e7c8"}
                opacity={i % 2 === 0 ? 0.85 : 0}
              />
            );
          })}
          {/* doubles ring */}
          <circle cx="0" cy="-50" r="40" fill="none" stroke="#9a2a1a" strokeWidth="5" />
          <circle cx="0" cy="-50" r="36" fill="none" stroke="#1a4a2a" strokeWidth="2" opacity="0.6" />
          {/* triples ring */}
          <circle cx="0" cy="-50" r="24" fill="none" stroke="#9a2a1a" strokeWidth="3.5" />
          <circle cx="0" cy="-50" r="20.5" fill="none" stroke="#1a4a2a" strokeWidth="1.5" opacity="0.6" />
          {/* bull */}
          <circle cx="0" cy="-50" r="6" fill="#1a4a2a" />
          <circle cx="0" cy="-50" r="2.6" fill="#9a2a1a" />
          {/* hover glow */}
          <circle className="dh-dartboard-glow" cx="0" cy="-50" r="48" fill="none" stroke="#ff9a3a" strokeWidth="2" opacity="0" />
        </g>

        {/* ── Wooden state-style sign ── */}
        <g className="dh-sign" transform="translate(1190, 920)">
          {/* shadow */}
          <ellipse cx="60" cy="98" rx="68" ry="6" fill="#000" opacity="0.4" />
          {/* posts */}
          <rect x="6"   y="0" width="9" height="100" fill="#4a3018" />
          <rect x="105" y="0" width="9" height="100" fill="#4a3018" />
          {/* plank — outer wood frame */}
          <path
            d="M -8 -22 Q -8 -34 4 -34 L 116 -34 Q 128 -34 128 -22 L 128 38 Q 128 50 116 50 L 4 50 Q -8 50 -8 38 Z"
            fill="#4a2e16"
          />
          {/* inner wood face */}
          <path
            d="M -2 -16 Q -2 -26 8 -26 L 112 -26 Q 122 -26 122 -16 L 122 32 Q 122 42 112 42 L 8 42 Q -2 42 -2 32 Z"
            fill="#7a4f2a"
          />
          {/* highlight strip */}
          <rect x="2" y="-22" width="116" height="3" rx="1" fill="#9a6a3c" opacity="0.7" />
          {/* text */}
          <text x="60" y="-2"  textAnchor="middle" fontSize="13" fontWeight="900" fill="#f4e2c2" letterSpacing="2"
                style={{ fontFamily: "'Bebas Neue','Impact',sans-serif" }}>SWEET</text>
          <text x="60" y="14"  textAnchor="middle" fontSize="13" fontWeight="900" fill="#f4e2c2" letterSpacing="2"
                style={{ fontFamily: "'Bebas Neue','Impact',sans-serif" }}>RELEASE</text>
          <line x1="14" y1="22" x2="106" y2="22" stroke="#f4e2c2" strokeWidth="0.8" opacity="0.55" />
          <text x="60" y="34"  textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#f4e2c2" letterSpacing="3"
                style={{ fontFamily: "'Bebas Neue','Impact',sans-serif" }}>DART LEAGUE</text>
        </g>

        {/* ── Player silhouette (back view, fists at sides, 3 darts in right hand) ── */}
        <g transform="translate(1480, 720)">
          <g className="dh-player">
            {/* ground shadow */}
            <ellipse cx="0" cy="232" rx="46" ry="7" fill="#000" opacity="0.5" />
            {/* legs */}
            <path d="M -16 110 L -19 232 L -8 232 L -6 122 Z" fill="#15211a" />
            <path d="M  16 110 L  19 232 L  8 232 L  6 122 Z" fill="#15211a" />
            {/* belt */}
            <rect x="-26" y="105" width="52" height="9" fill="#0e1612" />
            {/* torso (kimono drape) */}
            <path
              d="M -32 32 Q -38 80 -28 110 L 28 110 Q 38 80 32 32 Q 0 24 -32 32 Z"
              fill="#28392b"
            />
            {/* sash diagonal */}
            <path d="M -28 60 L 28 78 L 28 84 L -28 66 Z" fill="#1a2820" opacity="0.85" />
            {/* shoulder yoke */}
            <path d="M -36 34 Q 0 22 36 34 L 30 28 Q 0 16 -30 28 Z" fill="#1a2820" />
            {/* left arm (viewer-left = his right shoulder) */}
            <path d="M -32 36 L -39 96 L -30 100 L -23 38 Z" fill="#28392b" />
            <circle cx="-34" cy="104" r="7.5" fill="#3e2a1d" />
            {/* right arm (viewer-right = his left shoulder, holds darts) */}
            <path d="M 32 36 L 39 96 L 30 100 L 23 38 Z" fill="#28392b" />
            <circle cx="34" cy="104" r="7.5" fill="#3e2a1d" />
            {/* 3 darts in right fist, pointing up */}
            <g className="dh-darts">
              <line x1="30" y1="100" x2="27" y2="74" stroke="#dadada" strokeWidth="1.6" />
              <polygon points="27,70 25,76 29,76" fill="#9a2a1a" />
              <line x1="34" y1="100" x2="34" y2="72" stroke="#dadada" strokeWidth="1.6" />
              <polygon points="34,68 32,74 36,74" fill="#9a2a1a" />
              <line x1="38" y1="100" x2="41" y2="74" stroke="#dadada" strokeWidth="1.6" />
              <polygon points="41,70 39,76 43,76" fill="#9a2a1a" />
              {/* flights */}
              <path d="M 25 76 L 27 80 L 29 76 Z" fill="#e64100" />
              <path d="M 32 74 L 34 78 L 36 74 Z" fill="#e64100" />
              <path d="M 39 76 L 41 80 L 43 76 Z" fill="#e64100" />
            </g>
            {/* neck */}
            <rect x="-7" y="22" width="14" height="10" fill="#3e2a1d" />
            {/* head */}
            <circle cx="0" cy="12" r="17" fill="#3e2a1d" />
            {/* hair cap */}
            <path d="M -17 14 Q -16 -4 0 -6 Q 16 -4 17 14 Q 12 0 0 0 Q -12 0 -17 14 Z" fill="#0e0806" />
            {/* tied topknot hint */}
            <circle cx="0" cy="-4" r="3" fill="#0e0806" />
          </g>
        </g>

        {/* ── Foreground swaying grass ── */}
        <g className="dh-grass">
          {blades.map(b => (
            <path
              key={b.i}
              className="dh-blade"
              d={`M ${b.x} 1080 Q ${b.x + parseFloat(b.tilt)} ${1080 - b.h / 2} ${b.x + parseFloat(b.tilt) * 1.2} ${1080 - b.h}`}
              stroke={b.color}
              strokeWidth={2.2}
              strokeLinecap="round"
              fill="none"
              style={{
                animationDuration: `${b.dur}s`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
        </g>

        {/* subtle vignette */}
        <radialGradient id="dh-vignette" cx="50%" cy="55%" r="75%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <rect width="1920" height="1080" fill="url(#dh-vignette)" pointerEvents="none" />
      </svg>

      {/* ── Card stack (left) ── */}
      <div className="dh-cards">
        <div className="dh-wordmark">SWEET RELEASE</div>
        <div className="dh-tagline">TRACK · COMPETE · DOMINATE</div>
        {CARDS.map(c => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              className="dh-card"
              style={{ "--card-accent": c.color }}
              onClick={() => navigate(c.target)}
            >
              <span className="dh-card-icon" style={{ background: c.color }}>
                <Icon size={22} strokeWidth={2.2} />
              </span>
              <span className="dh-card-text">
                <span className="dh-card-label">{c.label}</span>
                <span className="dh-card-sub">{c.sub}</span>
              </span>
              <span className="dh-card-arrow">→</span>
            </button>
          );
        })}
      </div>

      <div className="dh-version">{APP_VERSION}</div>
    </div>
  );
}
