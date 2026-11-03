/**
 * Architectural inspection cursor.
 * Two-part follow (ring lags, dot leads), delegated hover states, contextual labels.
 */

const RULES = [
  { sel: '.plan-marker', state: 'marker', label: 'Design note' },
  { sel: '.process__item', state: 'read', label: 'Process' },
  { sel: '.service', state: 'action', label: 'Service' },
  { sel: '[data-scan]', state: 'read', label: 'Hover' },
  { sel: '#scene', state: null, label: '' },
  { sel: '.views__list button, .stage-rail button', state: 'action', label: 'Set view' },
  { sel: 'a, button', state: 'action', label: 'Open' },
];

export class Cursor {
  constructor() {
    this.el = document.getElementById('cursor');
    this.labelEl = document.getElementById('cursor-label');
    this.state = 'default';
    this.label = '';

    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.rx = this.x;
    this.ry = this.y;
    this.tx = this.x;
    this.ty = this.y;
    this.visible = false;
    this.locked = null; // set by the 3D hover system

    this.isTouch = window.matchMedia('(hover: none)').matches;
    if (this.isTouch) {
      document.body.classList.add('is-touch');
      return;
    }

    this._bind();
    this._loop();
  }

  _bind() {
    window.addEventListener('pointermove', (e) => {
      this.x = e.clientX;
      this.y = e.clientY;
      if (!this.visible) {
        this.visible = true;
        document.body.classList.add('has-cursor');
        this.rx = this.x;
        this.ry = this.y;
      }
      this._resolve(e.target);
    });

    document.addEventListener('pointerdown', () => document.body.classList.add('is-down'));
    document.addEventListener('pointerup', () => document.body.classList.remove('is-down'));
    document.documentElement.addEventListener('pointerleave', () => {
      this.visible = false;
      document.body.classList.remove('has-cursor');
    });
  }

  _resolve(target) {
    if (!target || !target.closest) return;

    for (const rule of RULES) {
      if (!target.closest(rule.sel)) continue;
      if (rule.state === null) return; // canvas: the 3D layer decides
      this.set(rule.state, rule.label);
      return;
    }
    if (this.locked) this.set('inspect', this.locked);
    else this.set('default', '');
  }

  set(state, label = '') {
    if (this.state === state && this.label === label) return;
    this.state = state;
    this.label = label;
    document.body.dataset.cursor = state;
    if (this.labelEl) this.labelEl.textContent = label;
  }

  reset() {
    this.locked = null;
    this.set('default', '');
  }

  lock(label) {
    this.locked = label;
  }

  _loop() {
    const step = () => {
      // ring lags, dot leads — the inspection reticle feels weighted
      this.rx += (this.x - this.rx) * 0.19;
      this.ry += (this.y - this.ry) * 0.19;
      this.tx += (this.x - this.tx) * 0.55;
      this.ty += (this.y - this.ty) * 0.55;

      this.el.style.transform = `translate3d(${this.rx.toFixed(2)}px, ${this.ry.toFixed(2)}px, 0)`;
      const dot = this.el.querySelector('.cursor__dot');
      if (dot) dot.style.transform = `translate(-50%, -50%) translate(${(this.tx - this.rx).toFixed(2)}px, ${(this.ty - this.ry).toFixed(2)}px)`;

      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
