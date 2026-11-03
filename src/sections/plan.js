/**
 * Section 02 — conceptual plan of the Forma Pavilion, level 02.
 *
 * Six layers, each an independently drawn SVG group. Every animated path uses
 * pathLength="1" so a single `--p` custom property drives the draw-on for the
 * whole layer regardless of the real path length.
 */

export const PLAN_VIEWBOX = { w: 900, h: 720 };

export const PLAN_PHASES = [
  { key: 'boundaries', start: 0.0, end: 0.16, label: 'Boundaries' },
  { key: 'structure', start: 0.14, end: 0.34, label: 'Structure' },
  { key: 'partitions', start: 0.32, end: 0.52, label: 'Partitions' },
  { key: 'openings', start: 0.5, end: 0.68, label: 'Openings' },
  { key: 'furniture', start: 0.66, end: 0.84, label: 'Furniture' },
  { key: 'annotation', start: 0.82, end: 1.0, label: 'Annotation' },
];

const draw = (d, extra = '') =>
  `<path data-draw d="${d}" pathLength="1" ${extra}/>`;

const OUTER = { x: 150, y: 120, w: 600, h: 480 };
const INNER = { x: 162, y: 132, w: 576, h: 456 };

const COLS_X = [200, 320, 440, 560, 680];
const COLS_Y = [170, 290, 410, 530];

const DOORS = [
  { x: 300, y: 240, r: 40, dir: 'down' },
  { x: 560, y: 460, r: 38, dir: 'left' },
  { x: 440, y: 350, r: 36, dir: 'up' },
  { x: 160, y: 460, r: 34, dir: 'right' },
];

function door({ x, y, r, dir }) {
  if (dir === 'down') return `${draw(`M ${x} ${y} V ${y + r}`)}${draw(`M ${x} ${y + r} A ${r} ${r} 0 0 1 ${x - r} ${y}`)}`;
  if (dir === 'up') return `${draw(`M ${x} ${y} V ${y - r}`)}${draw(`M ${x} ${y - r} A ${r} ${r} 0 0 0 ${x + r} ${y}`)}`;
  if (dir === 'left') return `${draw(`M ${x} ${y} H ${x - r}`)}${draw(`M ${x - r} ${y} A ${r} ${r} 0 0 0 ${x} ${y + r}`)}`;
  return `${draw(`M ${x} ${y} H ${x + r}`)}${draw(`M ${x + r} ${y} A ${r} ${r} 0 0 1 ${x} ${y - r}`)}`;
}

function stairTreads() {
  const x0 = 572;
  const x1 = 728;
  const y0 = 470;
  const n = 10;
  let out = '';
  for (let i = 1; i < n; i++) {
    const y = y0 + i * 10;
    out += draw(`M ${x0 + 6} ${y} H ${x1 - 6}`, 'opacity="0.5"');
  }
  return out;
}

export function buildPlan(container) {
  const svg = `
<svg viewBox="0 0 ${PLAN_VIEWBOX.w} ${PLAN_VIEWBOX.h}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <pattern id="plan-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#8fa9bd" stroke-width="0.7" opacity="0.5"/>
    </pattern>
    <filter id="plan-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- 01 boundaries -->
  <g class="plan-layer" data-phase="boundaries" stroke="#9ce8ff" stroke-width="1.6" fill="none" opacity="0.95">
    ${draw(`M ${OUTER.x} ${OUTER.y} H ${OUTER.x + OUTER.w} V ${OUTER.y + OUTER.h} H ${OUTER.x} Z`)}
    ${draw(`M ${INNER.x} ${INNER.y} H ${INNER.x + INNER.w} V ${INNER.y + INNER.h} H ${INNER.x} Z`, 'opacity="0.55"')}
    <path data-appear d="M ${OUTER.x - 42} ${OUTER.y - 30} H ${OUTER.x + OUTER.w + 42} V ${OUTER.y + OUTER.h + 30} H ${OUTER.x - 42} Z" stroke-dasharray="6 8" stroke="#2f5a70"/>
    <g stroke="#9ce8ff" stroke-width="1" opacity="0.5">
      ${[0, 1, 2, 3].map((i) => draw(`M ${OUTER.x} ${OUTER.y + (OUTER.h / 4) * i} h -14 M ${OUTER.x + OUTER.w} ${OUTER.y + (OUTER.h / 4) * i} h 14`)).join('')}
      ${[0, 1, 2, 3].map((i) => draw(`M ${OUTER.x + (OUTER.w / 3) * i} ${OUTER.y} v -12 M ${OUTER.x + (OUTER.w / 3) * i} ${OUTER.y + OUTER.h} v 12`)).join('')}
    </g>
  </g>

  <!-- 02 structure -->
  <g class="plan-layer" data-phase="structure" stroke="#cfe4f2" stroke-width="2.2" fill="none">
    ${draw(`M 390 ${INNER.y} V ${INNER.y + INNER.h}`)}
    ${draw(`M ${INNER.x} 350 H ${INNER.x + INNER.w}`)}
    ${draw(`M 390 132 V 350`, 'opacity="0.9"')}
    <g stroke="#9ce8ff" stroke-width="1.4" opacity="0.85">
      ${COLS_X.map((x) => COLS_Y.map((y) => draw(`M ${x - 5} ${y - 5} h 10 v 10 h -10 Z`, 'fill="#0b1626"')).join('')).join('')}
    </g>
    <g stroke="#9ce8ff" stroke-width="0.9" opacity="0.35">
      ${draw(`M 200 170 L 320 290`)}${draw(`M 680 170 L 560 290`)}${draw(`M 200 530 L 320 410`)}${draw(`M 680 530 L 560 410`)}
    </g>
  </g>

  <!-- 03 partitions -->
  <g class="plan-layer" data-phase="partitions" stroke="#8fd6ec" stroke-width="1.3" fill="none" opacity="0.85">
    ${draw(`M 162 240 H 390`)}
    ${draw(`M 300 132 V 240`)}
    ${draw(`M 162 460 H 300`)}
    ${draw(`M 300 460 V 588`)}
    ${draw(`M 390 460 H 560`)}
    ${draw(`M 560 350 V 588`)}
    ${draw(`M 560 460 H 738`)}
    ${draw(`M 470 350 A 70 70 0 0 1 540 420`, 'opacity="0.7"')}
  </g>

  <!-- 04 openings -->
  <g class="plan-layer" data-phase="openings" stroke="#bdeaf8" stroke-width="1.2" fill="none" opacity="0.9">
    ${DOORS.map(door).join('')}
    <g stroke="#9ce8ff" opacity="0.8">
      ${draw(`M 220 120 H 280`)}${draw(`M 220 132 H 280`)}
      ${draw(`M 330 588 H 400`)}${draw(`M 330 600 H 400`)}
      ${draw(`M 150 300 V 360`)}${draw(`M 162 300 V 360`)}
      ${draw(`M 750 300 V 360`)}${draw(`M 738 300 V 360`)}
    </g>
  </g>

  <!-- 05 furniture -->
  <g class="plan-layer" data-phase="furniture" stroke="#e0a878" stroke-width="1.1" fill="none" opacity="0.9">
    <g data-appear>
      <rect x="196" y="196" width="86" height="26" rx="3" stroke="#e0a878"/>
      <circle cx="238" cy="168" r="16" stroke="#cfe4f2"/>
      <circle cx="238" cy="168" r="3" fill="#9ce8ff" stroke="none"/>
      ${draw(`M 222 168 h 32 M 238 152 v 32`, 'stroke="#9ce8ff" opacity="0.5"')}
      <rect x="186" y="492" width="72" height="34" stroke="#e0a878"/>
      <rect x="186" y="492" width="72" height="34" fill="url(#plan-hatch)" stroke="none" opacity="0.5"/>
      <rect x="404" y="380" width="120" height="42" rx="2" stroke="#e0a878"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => draw(`M ${416 + i * 18} 380 v 42`, 'stroke="#e0a878" opacity="0.35"')).join('')}
      <rect x="600" y="380" width="46" height="46" stroke="#e0a878"/>
      ${draw(`M 600 380 L 646 426 M 646 380 L 600 426`, 'stroke="#e0a878" opacity="0.4"')}
      <rect x="474" y="516" width="70" height="22" rx="2" stroke="#e0a878"/>
      ${stairTreads()}
    </g>
  </g>

  <!-- 06 annotation -->
  <g class="plan-layer" data-phase="annotation" stroke="#9ce8ff" stroke-width="0.9" fill="none" opacity="0.85">
    <g data-appear>
      <path d="M 150 ${OUTER.y + OUTER.h + 44} H 750" stroke-dasharray="2 6" opacity="0.5"/>
      <path d="M 150 ${OUTER.y + OUTER.h + 38} V ${OUTER.y + OUTER.h + 50} M 750 ${OUTER.y + OUTER.h + 38} V ${OUTER.y + OUTER.h + 50}" stroke-dasharray="none"/>
      <path d="M ${OUTER.x - 44} 120 V 600" stroke-dasharray="2 6" opacity="0.5"/>
      <path d="M ${OUTER.x - 50} 120 H ${OUTER.x - 38} M ${OUTER.x - 50} 600 H ${OUTER.x - 38}" stroke-dasharray="none"/>
    </g>
    <g fill="#9ce8ff" stroke="none" font-family="IBM Plex Mono, monospace" font-size="11" letter-spacing="2">
      <text data-appear x="450" y="652" text-anchor="middle" opacity="0.75">24 000</text>
      <text data-appear x="96" y="366" text-anchor="middle" transform="rotate(-90 96 366)" opacity="0.75">18 000</text>
      <text data-appear x="182" y="212" font-size="9" opacity="0.45">WINTER GARDEN</text>
      <text data-appear x="182" y="482" font-size="9" opacity="0.45">HEARTH</text>
      <text data-appear x="642" y="512" font-size="9" opacity="0.45">STAIR</text>
      <text data-appear x="402" y="372" font-size="9" opacity="0.45">STUDIO</text>
    </g>
    <g data-appear stroke="#cfe4f2" stroke-width="1" opacity="0.9">
      <path d="M 792 128 V 182 M 780 140 L 792 128 L 804 140" />
      <text x="792" y="200" fill="#cfe4f2" stroke="none" font-family="IBM Plex Mono, monospace" font-size="9" letter-spacing="1.6" text-anchor="middle">N</text>
    </g>
  </g>
</svg>`;
  container.innerHTML = svg;
  return container.querySelector('svg');
}

/** Convert plan coordinates into percentages of the rendered SVG box. */
export function projectPoint(svgEl, x, y) {
  const cw = svgEl.clientWidth;
  const ch = svgEl.clientHeight;
  if (!cw || !ch) return { left: 50, top: 50 };
  const scale = Math.min(cw / PLAN_VIEWBOX.w, ch / PLAN_VIEWBOX.h);
  const ox = (cw - PLAN_VIEWBOX.w * scale) / 2;
  const oy = (ch - PLAN_VIEWBOX.h * scale) / 2;
  return {
    left: ((ox + x * scale) / cw) * 100,
    top: ((oy + y * scale) / ch) * 100,
  };
}
