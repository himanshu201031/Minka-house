import { PLAN_MARKERS, PROCESS_PHASES } from '../data/content.js';
import { buildArtwork, mountAnnotations } from './artwork.js';
import { buildPlan, projectPoint, PLAN_PHASES } from './plan.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class SectionReveal {
  constructor({ reducedMotion = false, sound = null } = {}) {
    this.reduced = reducedMotion;
    this.sound = sound;

    this.artFrame = document.querySelector('.art-frame');
    this.artStack = document.getElementById('art-stack');
    this.layers = [...document.querySelectorAll('[data-art-layer]')].reduce((acc, el) => {
      acc[el.dataset.artLayer] = el;
      return acc;
    }, {});
    this.scan = document.getElementById('art-scan');
    this.scanLabel = document.getElementById('art-scan-label');
    this.annotations = document.getElementById('art-annotations');

    this.track = document.getElementById('design-track');
    this.planLayers = [...document.querySelectorAll('.plan-layer')];
    this.planSvgHost = document.getElementById('plan-svg');
    this.markerHost = document.getElementById('plan-markers');
    this.progressFill = document.getElementById('design-progress-fill');
    this.phaseLabel = document.getElementById('design-phase');
    this.processItems = [...document.querySelectorAll('.process__item')];
    this.designNote = document.getElementById('design-note');

    this.pointer = { x: 0, y: 0 };
    this.pointerEased = { x: 0, y: 0 };
    this.parallaxTarget = { x: 0, y: 0 };

    this.markers = [];
    this.lastPhase = '';
    this.lastProcess = -1;
    this.planDone = false;
  }

  init() {
    if (this.artStack) {
      buildArtwork(this.artStack);
      mountAnnotations(this.annotations);
    }
    if (this.planSvgHost) {
      this.planSvg = buildPlan(this.planSvgHost);
      // the layers only exist after the SVG is injected — re-query them here
      this.planLayers = [...document.querySelectorAll('.plan-layer')];
      this._buildMarkers();
    }
    this._bind();
    this.update();
  }

  _bind() {
    const onMove = (e) => {
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (!this.reduced) window.addEventListener('pointermove', onMove, { passive: true });

    window.addEventListener('resize', () => {
      this._projectMarkers();
    });
  }

  _buildMarkers() {
    if (!this.markerHost) return;
    this.markerHost.innerHTML = '';
    PLAN_MARKERS.forEach((m, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'plan-marker';
      btn.dataset.marker = m.id;
      btn.setAttribute('aria-label', `${m.label} — design note`);
      btn.innerHTML = `<i aria-hidden="true"></i><span class="plan-marker__note"><b>${String(i + 1).padStart(2, '0')} · ${m.label}</b>${m.note}</span>`;
      btn.dataset.x = m.x;
      btn.dataset.y = m.y;

      const open = () => btn.classList.add('is-open');
      const close = () => btn.classList.remove('is-open');
      btn.addEventListener('pointerenter', () => this.sound?.cue('select'));
      btn.addEventListener('focus', () => {
        open();
        this.sound?.cue('select');
      });
      btn.addEventListener('blur', close);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.classList.toggle('is-open');
      });
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
      });

      this.markerHost.appendChild(btn);
      this.markers.push(btn);
    });
    this._projectMarkers();
  }

  _projectMarkers() {
    if (!this.planSvg) return;
    this.markers.forEach((btn) => {
      const p = projectPoint(this.planSvg, Number(btn.dataset.x), Number(btn.dataset.y));
      btn.style.left = `${p.left.toFixed(3)}%`;
      btn.style.top = `${p.top.toFixed(3)}%`;
    });
  }

  /* ── frame update ─────────────────────────────────────── */
  update() {
    const vh = window.innerHeight;
    this._updateAtmosphere(vh);
    this._updateDesign(vh);
  }

  _updateAtmosphere(vh) {
    if (!this.artFrame) return;
    const rect = this.artFrame.getBoundingClientRect();
    const start = vh * 0.96;
    const end = vh * 0.1;
    const raw = (start - rect.top) / Math.max(1, start - end);
    const p = this.reduced ? (rect.top < vh * 0.55 ? 1 : 0) : clamp01(raw);

    // each layer trails the one above it so a single building develops
    const set = (name, v) => this.layers[name]?.style.setProperty('--r', clamp01(v).toFixed(4));
    set('outline', p * 1.12 + 0.14);
    set('material', p * 1.06 + 0.045);
    set('light', p * 1.02 + 0.008);
    set('finish', p);

    if (this.scan) this.scan.style.top = `${(p * 100).toFixed(2)}%`;

    if (this.scanLabel) {
      const label =
        p < 0.14 ? 'STRUCTURE' : p < 0.45 ? 'MATERIAL' : p < 0.78 ? 'LIGHT' : 'ATMOSPHERE';
      if (label !== this.scanLabel.textContent) this.scanLabel.textContent = label;
    }

    if (this.annotations) this.annotations.classList.toggle('is-on', p > 0.72);

    // pointer parallax on the artwork
    if (this.artStack && !this.reduced) {
      this.pointerEased.x += (this.pointer.x - this.pointerEased.x) * 0.06;
      this.pointerEased.y += (this.pointer.y - this.pointerEased.y) * 0.06;
      const inside = rect.top < vh && rect.bottom > 0;
      const x = inside ? this.pointerEased.x * -7 : 0;
      const y = inside ? this.pointerEased.y * -5 : 0;
      this.artStack.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    }
  }

  _updateDesign(vh) {
    if (!this.track) return;
    const rect = this.track.getBoundingClientRect();
    const pinned = getComputedStyle(this.track).height !== 'auto' && window.innerWidth > 1080;

    let p;
    if (pinned) {
      const span = Math.max(1, rect.height - vh);
      p = clamp01(-rect.top / span);
    } else {
      const frame = this.planSvgHost?.parentElement?.getBoundingClientRect();
      if (!frame) return;
      p = clamp01((vh * 0.92 - frame.top) / (vh * 0.78));
    }
    if (this.reduced) p = this.markersVisible() ? 1 : p;

    const phases = PLAN_PHASES;
    this.planLayers.forEach((el) => {
      const ph = phases.find((x) => x.key === el.dataset.phase);
      if (!ph) return;
      const local = clamp01((p - ph.start) / Math.max(0.0001, ph.end - ph.start));
      el.style.setProperty('--p', local.toFixed(4));
    });

    if (this.progressFill) this.progressFill.style.width = `${(p * 100).toFixed(1)}%`;

    if (this.phaseLabel) {
      const current = phases.find((ph) => p >= ph.start && p < ph.end) || phases[phases.length - 1];
      if (current.label !== this.lastPhase) {
        this.lastPhase = current.label;
        this.phaseLabel.textContent = current.label;
      }
    }

    // process copy follows the drawing layers
    const idx = p < 0.3 ? 0 : p < 0.52 ? 1 : p < 0.78 ? 2 : 3;
    if (idx !== this.lastProcess) {
      this.lastProcess = idx;
      this.processItems.forEach((el, i) => {
        el.classList.toggle('is-active', i === idx);
        el.classList.toggle('is-past', i < idx);
      });
    }

    const done = p > 0.84;
    if (done !== this.planDone) {
      this.planDone = done;
      this.markerHost?.classList.toggle('is-ready', done);
      if (this.designNote) {
        this.designNote.textContent = done
          ? 'Plan complete — select a marker for the design note.'
          : 'Hover the markers to read the notes.';
      }
    }
  }

  markersVisible() {
    return !!this.markerHost?.classList.contains('is-ready');
  }
}

export { PROCESS_PHASES };
