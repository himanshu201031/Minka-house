import { READOUTS, STAGES } from '../data/content.js';

const THRESHOLD = 38; // accumulated wheel delta for one deliberate gesture
const QUIET = 150; // ms of silence before a new gesture may begin
const TOUCH_STEP = 46; // px of swipe

export class StageController {
  constructor({ rig, sound, scan, onChange, root = document }) {
    this.rig = rig;
    this.sound = sound;
    this.scan = scan;
    this.onChange = onChange;
    this.root = root;

    this.index = 0;
    this.last = STAGES.length - 1;

    this.accum = 0;
    this.lastWheel = 0;
    this.consumed = false;
    this.lockUntil = 0;
    this.reduced = false;

    this.copyEl = document.getElementById('stage-copy');
    this.titleEl = document.getElementById('stage-title');
    this.numEl = document.getElementById('stage-num');
    this.nameEl = document.getElementById('stage-name');
    this.bodyEl = document.getElementById('stage-body');
    this.eyebrowEl = this.copyEl?.querySelector('.stage-copy__eyebrow');
    this.altEl = document.getElementById('stage-alt');
    this.distEl = document.getElementById('stage-dist');
    this.viewsIdxEl = document.getElementById('views-idx');
    this.viewsItems = [...document.querySelectorAll('#views-list li')];
    this.railItems = [...document.querySelectorAll('#stage-rail li')];
    this.announceEl = document.getElementById('stage-announce');
    this.heroEl = document.querySelector('.hero');

    this._bindControls();
    this._bindInput();
    this.renderCopy(0, false);
    this.syncPanels();
  }

  setReduced(reduced) {
    this.reduced = reduced;
  }

  /* ── input ─────────────────────────────────────────────── */
  _bindControls() {
    document.querySelectorAll('[data-stage]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.stage);
        if (Number.isNaN(i)) return;
        this.go(i, { source: 'panel' });
      });
    });
  }

  _bindInput() {
    window.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    window.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: true });
    window.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    window.addEventListener('keydown', (e) => this._onKey(e));

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        this._scrollTo(target, a.hasAttribute('data-nav'));
      });
    });
  }

  _scrollTo(target, isNav) {
    const behavior = this.reduced ? 'auto' : 'smooth';
    if (target.id === 'top') {
      window.scrollTo({ top: 0, behavior });
      return;
    }
    const y = target.getBoundingClientRect().top + window.scrollY - (isNav ? 8 : 0);
    window.scrollTo({ top: y, behavior });
  }

  _atTop() {
    return window.scrollY <= 2;
  }

  _locked(now) {
    return now < this.lockUntil || this.rig.isAnimating;
  }

  _onWheel(e) {
    const now = performance.now();
    if (now - this.lastWheel > QUIET) {
      this.accum = 0;
      this.consumed = false;
    }
    this.lastWheel = now;

    const dir = Math.sign(e.deltaY);
    if (!dir) return;

    // Only the resting hero owns the wheel. Once the page has moved, scrolling
    // belongs to the document.
    if (!this._atTop()) return;

    if (this._locked(now) || this.consumed) {
      e.preventDefault();
      return;
    }

    const canNext = dir > 0 && this.index < this.last;
    const canPrev = dir < 0 && this.index > 0;

    if (!canNext && !canPrev) return; // last stage downward / first upward: free scroll

    e.preventDefault();
    this.accum += e.deltaY;
    if (Math.abs(this.accum) >= THRESHOLD) {
      this.accum = 0;
      this.consumed = true;
      this.go(this.index + dir, { source: 'gesture' });
    }
  }

  _onTouchStart(e) {
    this.touchY = e.touches[0]?.clientY ?? 0;
    this.touchConsumed = false;
  }

  _onTouchMove(e) {
    if (!this._atTop()) return;
    const t = e.touches[0];
    if (!t) return;
    const dy = this.touchY - t.clientY;
    if (Math.abs(dy) < TOUCH_STEP) return;
    const dir = Math.sign(dy);

    const canNext = dir > 0 && this.index < this.last;
    const canPrev = dir < 0 && this.index > 0;

    if (!canNext && !canPrev) return;
    if (this.touchConsumed || this.rig.isAnimating) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    this.touchConsumed = true;
    this.touchY = t.clientY;
    this.lockUntil = performance.now() + this.rig.duration * 1000 + 80;
    this.go(this.index + dir, { source: 'gesture' });
  }

  _onKey(e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
    if (!this._atTop()) return;

    const k = e.key;
    let next = null;
    if (k === 'ArrowDown' || k === 'PageDown') next = Math.min(this.last, this.index + 1);
    else if (k === 'ArrowUp' || k === 'PageUp') next = Math.max(0, this.index - 1);
    else if (k === 'Home') next = 0;
    else if (k === 'End') next = this.last;
    else if (/^[1-5]$/.test(k)) next = Number(k) - 1;
    else return;

    if (next === null || next === this.index) return;
    e.preventDefault();
    this.lockUntil = performance.now() + this.rig.duration * 1000 + 80;
    this.go(next, { source: 'key' });
  }

  /* ── stage changes ─────────────────────────────────────── */
  go(index, { source = 'api', instant = false } = {}) {
    const target = Math.max(0, Math.min(this.last, index));
    const changed = this.rig.goto(target, { instant: instant || this.reduced });
    this.index = target;

    this.renderCopy(target, !instant);
    this.syncPanels();

    if (changed) {
      this.sound?.whoosh(this.rig.direction > 0 ? 1 : 0.85);
      this.lockUntil = performance.now() + this.rig.duration * 1000 + 60;
    }
    this.onChange?.(target, source);
  }

  renderCopy(i, animate) {
    const s = STAGES[i];
    if (!s || !this.copyEl) return;

    if (this.numEl) this.numEl.textContent = String(i + 1).padStart(2, '0');
    if (this.nameEl) this.nameEl.textContent = s.short;
    if (this.eyebrowEl) {
      this.eyebrowEl.innerHTML = `<span id="stage-num">${String(i + 1).padStart(2, '0')}</span> / 05 <span class="stage-copy__dash">—</span> <span id="stage-name">${s.name}</span>`;
      this.numEl = document.getElementById('stage-num');
      this.nameEl = document.getElementById('stage-name');
    }

    if (this.titleEl) {
      const inner = this.titleEl.querySelector('.stage-copy__title-inner');
      if (inner) {
        inner.innerHTML = s.title
          .map(
            (line, idx) =>
              `<span class="line"><span class="line__in" style="transition-delay:${idx * 55}ms">${line}</span></span>`,
          )
          .join('');
      }
      if (this.scan) this.scan.refresh(this.titleEl);
    }

    if (this.bodyEl) this.bodyEl.textContent = s.body;
    if (this.announceEl) {
      this.announceEl.textContent = `View ${i + 1} of 5 — ${s.name}. ${s.body}`;
    }

    const r = READOUTS[i];
    if (this.altEl && r) this.altEl.textContent = `EL ${r.alt.toFixed(1).padStart(4, '0')}°`;
    if (this.distEl && r) this.distEl.textContent = `DIST ${r.dist} m`;

    if (animate) {
      this.copyEl.classList.remove('is-swapping');
      // force the reveal: hide, then show with the staggered line animation
      void this.copyEl.offsetWidth;
      this.copyEl.classList.remove('is-in');
      void this.copyEl.offsetWidth;
      this.copyEl.classList.add('is-in');
    } else {
      this.copyEl.classList.add('is-in');
    }
  }

  syncPanels() {
    this.viewsItems.forEach((li, i) => li.classList.toggle('is-active', i === this.index));
    this.railItems.forEach((li, i) => li.classList.toggle('is-active', i === this.index));
    if (this.viewsIdxEl) this.viewsIdxEl.textContent = String(this.index + 1).padStart(2, '0');
    if (this.heroEl) {
      this.heroEl.dataset.stage = String(this.index);
      this.heroEl.classList.toggle('is-final', this.index === this.last);
    }

    const active = this.viewsItems[this.index]?.querySelector('.views__m');
    if (active) active.dataset.live = '1';
    this.viewsItems.forEach((li, i) => {
      const m = li.querySelector('.views__m');
      if (m && i !== this.index) delete m.dataset.live;
    });
  }

  updateReadout() {
    const r = this.rig.readout();
    const m = this.viewsItems[this.index]?.querySelector('.views__m');
    if (m && m.dataset.live) {
      m.textContent = `AZ ${String(Math.round(r.az)).padStart(3, '0')}° · EL ${String(Math.round(r.el)).padStart(2, '0')}`;
    }
  }
}
