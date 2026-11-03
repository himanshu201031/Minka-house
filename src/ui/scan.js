/**
 * Headline scan.
 * One hover on the whole heading runs one 1.2–1.6 s pass of light across the
 * letterforms — a luminous band, a stroke-only outline and a fine line field.
 * Moving between letters cannot restart it: the trigger lives on the heading,
 * and a run in progress or a short cooldown swallows re-entry.
 */

const smooth = (t) => t * t * (3 - 2 * t);

export class ScanHeadlines {
  constructor({ reducedMotion = false } = {}) {
    this.reduced = reducedMotion;
    this.items = new WeakMap();
    this.all = [];
  }

  register(el) {
    if (!el || this.items.has(el)) return this.items.get(el) || null;
    const host = el.querySelector('.scan');
    const inner = el.querySelector(
      '.stage-copy__title-inner, .section-title__inner, .footer-title__inner',
    );
    if (!host || !inner) return null;

    const item = {
      el,
      host,
      inner,
      clone: null,
      outline: null,
      busy: false,
      cooling: false,
      raf: 0,
      token: 0,
    };
    this.build(item);
    el.addEventListener('pointerenter', () => this.fire(item));
    this.items.set(el, item);
    this.all.push(item);
    return item;
  }

  registerAll(root = document) {
    root.querySelectorAll('[data-scan]').forEach((el) => this.register(el));
  }

  build(item) {
    item.host.innerHTML = '';
    const clone = item.inner.cloneNode(true);
    clone.className = 'scan__clone';
    const outline = item.inner.cloneNode(true);
    outline.className = 'scan__outline';
    item.host.append(clone, outline);
    item.clone = clone;
    item.outline = outline;
    item.token += 1;
  }

  /** Call after the copy inside the heading has been replaced. */
  refresh(el) {
    const item = this.items.get(el);
    if (!item) return this.register(el);
    item.busy = false;
    item.cooling = false;
    if (item.raf) cancelAnimationFrame(item.raf);
    item.host.classList.remove('is-active');
    this.build(item);
    return item;
  }

  fire(item) {
    if (this.reduced || item.busy || item.cooling) return;
    if (!item.el.isConnected) return;

    const w = item.el.getBoundingClientRect().width;
    if (!w) return;

    item.busy = true;
    item.host.classList.add('is-active');
    const token = item.token;
    const start = performance.now();
    const duration = 1240 + Math.random() * 240; // 1.24 – 1.48 s
    const bandW = w * 2.2;
    const outW = w * 2.6;

    const frame = (now) => {
      if (token !== item.token) {
        item.busy = false;
        return;
      }
      const t = Math.min(1, (now - start) / duration);
      const e = smooth(t);
      const x = -0.18 * w + e * 1.36 * w;

      const offBand = x - bandW * 0.5;
      const offOut = x - outW * 0.5;
      const lineShift = (t * 52).toFixed(1);

      const c = item.clone.style;
      c.backgroundPosition = `0 ${lineShift}px, ${offBand.toFixed(1)}px 0`;
      c.webkitMaskPosition = `${offBand.toFixed(1)}px 0`;
      c.maskPosition = `${offBand.toFixed(1)}px 0`;

      const o = item.outline.style;
      o.webkitMaskPosition = `${offOut.toFixed(1)}px 0`;
      o.maskPosition = `${offOut.toFixed(1)}px 0`;

      if (t < 1) {
        item.raf = requestAnimationFrame(frame);
      } else {
        item.host.classList.remove('is-active');
        item.busy = false;
        item.cooling = true;
        setTimeout(() => {
          item.cooling = false;
        }, 220);
      }
    };

    item.raf = requestAnimationFrame(frame);
  }
}
