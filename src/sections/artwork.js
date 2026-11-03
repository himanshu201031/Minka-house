/**
 * Fig. 01 — Forma Pavilion, north elevation.
 *
 * An original concept drawn in code so that the outline, material, light and
 * finished layers share exactly the same geometry: the top-to-bottom reveal
 * therefore develops one building rather than cross-fading four pictures.
 */

const VB = { w: 900, h: 1100 };
const WATER = 772;

const ROOF = {
  ridge: [450, 368],
  eaveL: [118, 524],
  eaveR: [782, 524],
  cL0: [250, 500],
  cL1: [380, 432],
  cR0: [520, 432],
  cR1: [650, 500],
};

const UPPER = {
  ridge: [450, 214],
  eaveL: [316, 300],
  eaveR: [584, 300],
  cL0: [366, 286],
  cL1: [414, 250],
  cR0: [486, 250],
  cR1: [534, 286],
};

const c = (p, dy = 0) => `${p[0]} ${p[1] + dy}`;

function roofLine(r, dy = 0) {
  return `M ${c(r.eaveL, dy)} C ${c(r.cL0, dy)} ${c(r.cL1, dy)} ${c(r.ridge, dy)} C ${c(r.cR0, dy)} ${c(r.cR1, dy)} ${c(r.eaveR, dy)}`;
}

function roofLineRev(r, dy = 0) {
  return `C ${c(r.cR1, dy)} ${c(r.cR0, dy)} ${c(r.ridge, dy)} C ${c(r.cL1, dy)} ${c(r.cL0, dy)} ${c(r.eaveL, dy)}`;
}

/** snow band sitting on the roof curve */
function snowBand(r, lift) {
  return `${roofLine(r, -lift)} L ${c(r.eaveR, 0)} ${roofLineRev(r, 0)} Z`;
}

/** visible fascia thickness below the roof curve */
function fasciaBand(r, drop) {
  return `${roofLine(r, 0)} L ${c(r.eaveR, drop)} ${roofLineRev(r, drop)} Z`;
}

const COL_X = [240, 300, 360, 420, 480, 540, 600, 660];
const WALL_TOP = 526;
const WALL_BASE = 700;
const PLINTH = { x0: 206, x1: 694, y0: 700, y1: WATER };
const FOOT = { x0: 186, x1: 714, y0: 746, y1: WATER };

const LANTERN = { x0: 372, x1: 528, y0: 306, y1: 372 };

/** tiered fir silhouette */
function fir(x, base, h, w) {
  let d = '';
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers;
    const yb = base - h * t0 * 0.86;
    const yt = base - h * ((i + 1) / tiers) * 0.94 - h * 0.12;
    const ww = w * (1 - t0 * 0.58);
    d += `M ${(x - ww).toFixed(1)} ${yb.toFixed(1)} L ${x} ${yt.toFixed(1)} L ${(x + ww).toFixed(1)} ${yb.toFixed(1)} Z `;
  }
  return d;
}

const PINES = [
  { x: 92, base: WATER + 4, h: 250, w: 46 },
  { x: 158, base: WATER + 4, h: 196, w: 34 },
  { x: 44, base: WATER + 4, h: 170, w: 30 },
  { x: 812, base: WATER + 4, h: 228, w: 42 },
  { x: 862, base: WATER + 4, h: 178, w: 30 },
  { x: 758, base: WATER + 4, h: 158, w: 26 },
];

const colLines = COL_X.map((x) => `M ${x} ${WALL_TOP} V ${WALL_BASE}`).join(' ');
const mullions = COL_X.slice(0, -1)
  .map((x, i) => {
    const nx = COL_X[i + 1];
    return `M ${x + 5} ${WALL_TOP} V ${WALL_BASE} M ${nx - 5} ${WALL_TOP} V ${WALL_BASE}`;
  })
  .join(' ');

/* ── layers ─────────────────────────────────────────────── */

function layerOutline() {
  return `
<svg viewBox="0 0 ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMid slice" fill="none">
  <g stroke="#7fdcff" stroke-width="1" stroke-linecap="square" opacity="0.9">
    ${roofLine(ROOF)}
    ${roofLine(UPPER)}
    ${roofLine(ROOF, 20)}
    ${roofLine(UPPER, 15)}
    <path d="${snowBand(ROOF, 15)}" opacity="0.55"/>
    <path d="${snowBand(UPPER, 11)}" opacity="0.55"/>

    <!-- eave tips -->
    <path d="M 118 524 L 98 508 M 782 524 L 802 508"/>
    <path d="M 316 300 L 302 290 M 584 300 L 598 290"/>

    <!-- lantern -->
    <path d="M ${LANTERN.x0} ${LANTERN.y0} H ${LANTERN.x1} V ${LANTERN.y1} H ${LANTERN.x0} Z"/>
    <path d="M ${LANTERN.x0 + 26} ${LANTERN.y0} V ${LANTERN.y1} M ${LANTERN.x1 - 26} ${LANTERN.y0} V ${LANTERN.y1}"/>
    <path d="M ${LANTERN.x0} ${LANTERN.y0 + 26} H ${LANTERN.x1}"/>

    <!-- finial -->
    <path d="M 450 ${UPPER.ridge[1]} V 186"/>
    <path d="M 450 186 L 458 198 L 450 210 L 442 198 Z"/>
    <path d="M 438 206 H 462"/>
    <circle cx="450" cy="180" r="3.4"/>

    <!-- wall + openings -->
    <path d="M ${COL_X[0]} ${WALL_TOP} H ${COL_X[COL_X.length - 1]} V ${WALL_BASE} H ${COL_X[0]} Z"/>
    <path d="${mullions}"/>
    <path d="${colLines}"/>
    <path d="M ${COL_X[0]} 612 H ${COL_X[COL_X.length - 1]}"/>
    <path d="M 420 ${WALL_TOP} H 480 V ${WALL_BASE} H 420 Z"/>
    <path d="M 450 548 V ${WALL_BASE}"/>

    <!-- plinth -->
    <path d="M ${PLINTH.x0} ${PLINTH.y0} H ${PLINTH.x1} V ${PLINTH.y1} H ${PLINTH.x0} Z"/>
    <path d="M ${FOOT.x0} ${FOOT.y0} H ${FOOT.x1} V ${FOOT.y1} H ${FOOT.x0} Z"/>
    <path d="M ${PLINTH.x0} 724 H ${PLINTH.x1}"/>

    <!-- water -->
    <path d="M 0 ${WATER} H 900" opacity="0.6"/>
    <path d="M 0 ${WATER + 34} H 900 M 0 ${WATER + 82} H 900 M 0 ${WATER + 148} H 900 M 0 ${WATER + 230} H 900" opacity="0.14"/>

    <!-- pines -->
    ${PINES.map((p) => `<path d="${fir(p.x, p.base, p.h, p.w)}" opacity="0.5"/>`).join('')}

    <!-- survey marks -->
    <path d="M 60 300 V 760" stroke-dasharray="2 6" opacity="0.35"/>
    <path d="M 60 460 H 90 M 60 620 H 90" opacity="0.5"/>
    <path d="M 840 368 H 870 M 840 524 H 870" opacity="0.5"/>
  </g>
</svg>`;
}

function layerMaterial() {
  return `
<svg viewBox="0 0 ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="m-roof" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a5a76"/>
      <stop offset="1" stop-color="#16293c"/>
    </linearGradient>
    <linearGradient id="m-snow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e7f3fb"/>
      <stop offset="1" stop-color="#a9c8dc"/>
    </linearGradient>
    <linearGradient id="m-stone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b4054"/>
      <stop offset="1" stop-color="#14212f"/>
    </linearGradient>
    <linearGradient id="m-glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1d3346"/>
      <stop offset="1" stop-color="#0d1a27"/>
    </linearGradient>
    <linearGradient id="m-water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16293b"/>
      <stop offset="1" stop-color="#070e18"/>
    </linearGradient>
  </defs>

  <path d="M 0 ${WATER} H 900 V ${VB.h} H 0 Z" fill="url(#m-water)"/>

  ${PINES.map((p) => `<path d="${fir(p.x, p.base, p.h, p.w)}" fill="#0a1725"/>`).join('')}

  <!-- plinth -->
  <path d="M ${FOOT.x0} ${FOOT.y0} H ${FOOT.x1} V ${FOOT.y1} H ${FOOT.x0} Z" fill="url(#m-stone)"/>
  <path d="M ${PLINTH.x0} ${PLINTH.y0} H ${PLINTH.x1} V ${PLINTH.y1} H ${PLINTH.x0} Z" fill="#24374a"/>

  <!-- wall -->
  <path d="M ${COL_X[0]} ${WALL_TOP} H ${COL_X[COL_X.length - 1]} V ${WALL_BASE} H ${COL_X[0]} Z" fill="url(#m-glass)"/>
  <path d="M 420 ${WALL_TOP} H 480 V ${WALL_BASE} H 420 Z" fill="#0b1725"/>

  <!-- timber columns -->
  ${COL_X.map((x) => `<rect x="${x - 4}" y="${WALL_TOP}" width="8" height="${WALL_BASE - WALL_TOP}" fill="#8f3a24"/>`).join('')}
  <rect x="${COL_X[0] - 6}" y="${WALL_TOP}" width="12" height="${WALL_BASE - WALL_TOP}" fill="#a2442a"/>
  <rect x="${COL_X[COL_X.length - 1] - 6}" y="${WALL_TOP}" width="12" height="${WALL_BASE - WALL_TOP}" fill="#a2442a"/>
  <rect x="${COL_X[0]}" y="612" width="${COL_X[COL_X.length - 1] - COL_X[0]}" height="6" fill="#8a5a2c"/>
  <rect x="${COL_X[0]}" y="${WALL_TOP}" width="${COL_X[COL_X.length - 1] - COL_X[0]}" height="6" fill="#8a5a2c"/>

  <!-- lantern -->
  <path d="M ${LANTERN.x0} ${LANTERN.y0} H ${LANTERN.x1} V ${LANTERN.y1} H ${LANTERN.x0} Z" fill="url(#m-glass)"/>
  <rect x="${LANTERN.x0}" y="${LANTERN.y0 + 26}" width="${LANTERN.x1 - LANTERN.x0}" height="5" fill="#8a5a2c"/>
  <rect x="${LANTERN.x0 - 5}" y="${LANTERN.y0}" width="9" height="${LANTERN.y1 - LANTERN.y0}" fill="#a2442a"/>
  <rect x="${LANTERN.x1 - 4}" y="${LANTERN.y0}" width="9" height="${LANTERN.y1 - LANTERN.y0}" fill="#a2442a"/>

  <!-- roofs -->
  <path d="${fasciaBand(UPPER, 15)}" fill="#2a4459"/>
  <path d="${snowBand(UPPER, 11)}" fill="url(#m-snow)"/>
  <path d="${fasciaBand(ROOF, 20)}" fill="url(#m-roof)"/>
  <path d="${snowBand(ROOF, 15)}" fill="url(#m-snow)"/>

  <!-- finial -->
  <path d="M 447 ${UPPER.ridge[1]} h 6 v -46 h -6 Z" fill="#5d6f7d"/>
  <path d="M 450 186 L 458 198 L 450 210 L 442 198 Z" fill="#7d93a2"/>
  <circle cx="450" cy="180" r="3.4" fill="#8ea6b6"/>
</svg>`;
}

function layerLight() {
  return `
<svg viewBox="0 0 ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="l-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffb066" stop-opacity="0.85"/>
      <stop offset="0.45" stop-color="#f08a3c" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#f08a3c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="l-window" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffc98a"/>
      <stop offset="1" stop-color="#f08a3c"/>
    </linearGradient>
    <linearGradient id="l-ice" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#9ce8ff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#d8f6ff" stop-opacity="0.8"/>
      <stop offset="1" stop-color="#9ce8ff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- warm interiors -->
  <g opacity="0.9">
    ${[0, 1, 2, 4, 5, 6]
      .map((i) => {
        const x = COL_X[i] + 6;
        const w = COL_X[i + 1] - COL_X[i] - 12;
        return `<rect x="${x}" y="540" width="${w}" height="64" fill="url(#l-window)" opacity="0.55"/>
                <rect x="${x}" y="622" width="${w}" height="62" fill="url(#l-window)" opacity="0.32"/>`;
      })
      .join('')}
    <rect x="424" y="${WALL_TOP + 6}" width="52" height="${WALL_BASE - WALL_TOP - 10}" fill="url(#l-window)" opacity="0.42"/>
    <rect x="${LANTERN.x0 + 6}" y="${LANTERN.y0 + 6}" width="${LANTERN.x1 - LANTERN.x0 - 12}" height="${LANTERN.y1 - LANTERN.y0 - 12}" fill="url(#l-window)" opacity="0.34"/>
  </g>

  <!-- spill -->
  <ellipse cx="450" cy="700" rx="250" ry="70" fill="url(#l-glow)" opacity="0.5"/>
  <ellipse cx="450" cy="640" rx="180" ry="90" fill="url(#l-glow)" opacity="0.28"/>

  <!-- ice catching the overcast -->
  <path d="${snowBand(ROOF, 15)}" fill="#dff4ff" opacity="0.12"/>
  <path d="${roofLine(ROOF)}" stroke="url(#l-ice)" stroke-width="1.6" fill="none" opacity="0.8"/>
  <path d="${roofLine(UPPER)}" stroke="url(#l-ice)" stroke-width="1.4" fill="none" opacity="0.75"/>

  <!-- reflection light in the water -->
  <g opacity="0.42">
    <rect x="300" y="${WATER + 8}" width="60" height="3" fill="#f0a35c" opacity="0.5"/>
    <rect x="392" y="${WATER + 16}" width="120" height="3" fill="#f0a35c" opacity="0.42"/>
    <rect x="360" y="${WATER + 30}" width="80" height="2" fill="#f0a35c" opacity="0.3"/>
    <rect x="430" y="${WATER + 48}" width="140" height="2" fill="#9ce8ff" opacity="0.22"/>
    <rect x="250" y="${WATER + 70}" width="90" height="2" fill="#9ce8ff" opacity="0.16"/>
  </g>
</svg>`;
}

function layerFinish() {
  return `
<svg viewBox="0 0 ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="f-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#060d18"/>
      <stop offset="0.42" stop-color="#0d1a2a"/>
      <stop offset="0.62" stop-color="#1a2e42"/>
      <stop offset="0.7" stop-color="#22405a"/>
      <stop offset="0.72" stop-color="#122334"/>
      <stop offset="1" stop-color="#050a12"/>
    </linearGradient>
    <linearGradient id="f-haze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2c4a66" stop-opacity="0"/>
      <stop offset="0.7" stop-color="#2c4a66" stop-opacity="0.4"/>
      <stop offset="1" stop-color="#2c4a66" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="f-refl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9ce8ff" stop-opacity="0.17"/>
      <stop offset="1" stop-color="#9ce8ff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="f-vig" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#02060c" stop-opacity="0.55"/>
      <stop offset="0.3" stop-color="#02060c" stop-opacity="0"/>
      <stop offset="0.85" stop-color="#02060c" stop-opacity="0"/>
      <stop offset="1" stop-color="#02060c" stop-opacity="0.6"/>
    </linearGradient>
    <mask id="f-fade">
      <rect x="0" y="${WATER}" width="900" height="${VB.h - WATER}" fill="url(#f-refl)"/>
    </mask>
  </defs>

  <rect x="0" y="480" width="900" height="320" fill="url(#f-haze)"/>

  <!-- distant ridge line -->
  <path d="M 0 742 L 120 726 L 210 738 L 330 720 L 460 736 L 590 718 L 700 734 L 810 722 L 900 738 V ${WATER} H 0 Z" fill="#0b1929" opacity="0.85"/>

  <!-- mirrored building, faded into the water -->
  <g mask="url(#f-fade)" opacity="0.5">
    <g transform="translate(0 ${WATER * 2}) scale(1 -1)">
      ${PINES.map((p) => `<path d="${fir(p.x, p.base, p.h, p.w)}" fill="#0a1725"/>`).join('')}
      <path d="M ${FOOT.x0} ${FOOT.y0} H ${FOOT.x1} V ${FOOT.y1} H ${FOOT.x0} Z" fill="#16232f"/>
      <path d="M ${COL_X[0]} ${WALL_TOP} H ${COL_X[COL_X.length - 1]} V ${WALL_BASE} H ${COL_X[0]} Z" fill="#122b3d"/>
      ${COL_X.map((x) => `<rect x="${x - 4}" y="${WALL_TOP}" width="8" height="${WALL_BASE - WALL_TOP}" fill="#7c3320" opacity="0.8"/>`).join('')}
      <path d="${snowBand(ROOF, 15)}" fill="#b9d5e6" opacity="0.5"/>
      <path d="${fasciaBand(ROOF, 20)}" fill="#20364a" opacity="0.7"/>
      <path d="${snowBand(UPPER, 11)}" fill="#b9d5e6" opacity="0.45"/>
    </g>
  </g>

  <!-- ripple bands -->
  <g opacity="0.5">
    ${Array.from({ length: 14 })
      .map((_, i) => {
        const y = WATER + 12 + i * i * 2.4 + i * 6;
        const w = 120 + i * 42;
        const x = 450 - w / 2 + Math.sin(i * 1.7) * 60;
        return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w}" height="1.2" fill="#9ec6dd" opacity="${(0.28 - i * 0.016).toFixed(3)}"/>`;
      })
      .join('')}
  </g>

  <!-- falling snow -->
  <g fill="#dff2ff">
    ${Array.from({ length: 90 })
      .map((_, i) => {
        const x = ((i * 137.5) % 900).toFixed(1);
        const y = ((i * 233.7) % 900).toFixed(1);
        const r = (0.7 + ((i * 7) % 5) * 0.34).toFixed(2);
        return `<circle cx="${x}" cy="${y}" r="${r}" opacity="${(0.14 + ((i * 13) % 7) * 0.055).toFixed(2)}"/>`;
      })
      .join('')}
  </g>

  <rect width="900" height="${VB.h}" fill="url(#f-vig)"/>
</svg>`;
}

export function buildArtwork(container) {
  const order = [
    ['outline', layerOutline()],
    ['material', layerMaterial()],
    ['light', layerLight()],
    ['finish', layerFinish()],
  ];
  order.forEach(([name, svg]) => {
    const el = container.querySelector(`[data-art-layer="${name}"]`);
    if (el) el.innerHTML = svg;
  });
}

export function mountAnnotations(el) {
  const notes = [
    { text: 'Snow shed · 240 mm', x: 62, y: 25 },
    { text: 'Glazed bay · south', x: 30, y: 57 },
    { text: 'Lantern · warm core', x: 70, y: 32 },
    { text: 'Granite apron', x: 24, y: 70 },
    { text: 'Waterline ±0.00', x: 66, y: 72 },
  ];
  el.innerHTML = notes
    .map((n) => `<span style="left:${n.x}%;top:${n.y}%">${n.text}</span>`)
    .join('');
}
