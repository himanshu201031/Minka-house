import * as THREE from 'three';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/hero.css';
import './styles/sections.css';
import './styles/footer.css';
import './styles/polish.css';

import { World } from './three/world.js';
import { CameraRig } from './three/rig.js';
import { Inspect } from './three/inspect.js';
import { Cursor } from './ui/cursor.js';
import { Soundscape } from './ui/audio.js';
import { ScanHeadlines } from './ui/scan.js';
import { StageController } from './ui/stages.js';
import { SectionReveal } from './sections/reveal.js';
import { CONTACT, CONTACT_FIELDS, LABELS, STAGES } from './data/content.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none)').matches;

const $ = (id) => document.getElementById(id);

/* ── loader ───────────────────────────────────────────────── */
const loader = $('loader');
const loaderPct = $('loader-pct');
const loaderNote = $('loader-note');
let loadValue = 0;
let loadTarget = 0;

function setLoad(v, note) {
  loadTarget = Math.max(loadTarget, v);
  if (note && loaderNote) loaderNote.textContent = note;
}

function tickLoader() {
  loadValue += (loadTarget - loadValue) * 0.12;
  if (loaderPct) loaderPct.textContent = String(Math.min(99, Math.round(loadValue * 100))).padStart(2, '0');
  if (loadTarget >= 1 && loadValue > 0.995) {
    if (loaderPct) loaderPct.textContent = '100';
    return true;
  }
  return false;
}

/* ── cursor + scan ────────────────────────────────────────── */
function observeHeadlines() {
  const titles = [...document.querySelectorAll('.section-title, .footer-title')];
  if (!('IntersectionObserver' in window) || reducedMotion) {
    titles.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.22, rootMargin: '0px 0px -8% 0px' }
  );
  titles.forEach((el) => io.observe(el));
}

/* ── scroll-reveals for the section content ───────────────── */
function observeScrollReveals() {
  const items = [...document.querySelectorAll('[data-reveal]')];
  if (!items.length) return;
  if (!('IntersectionObserver' in window) || reducedMotion) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.25, rootMargin: '0px 0px -6% 0px' }
  );
  items.forEach((el) => io.observe(el));
}

const cursor = new Cursor();
const scan = new ScanHeadlines({ reducedMotion });
scan.registerAll();
observeHeadlines();
observeScrollReveals();

/* ── theme toggle ─────────────────────────────────────────── */
const themeMeta = document.querySelector('meta[name="theme-color"]');
const META_THEME = { light: '#f2f4f8', dark: '#060b14' };
const themeToggle = $('theme-toggle');

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  themeMeta?.setAttribute('content', META_THEME[mode]);
  themeToggle?.setAttribute(
    'aria-label',
    mode === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'
  );
  world?.setTheme(mode);
}

function wireTheme() {
  if (!themeToggle) return;
  themeToggle.addEventListener('click', () => {
    const mode = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(mode);
    try {
      localStorage.setItem('forma-theme', mode);
    } catch {
      /* private browsing — theme just won't persist */
    }
    sound.cue('select');
  });
}

wireTheme();

/* ── audio ────────────────────────────────────────────────── */
const sound = new Soundscape();
const soundToggle = $('sound-toggle');
const soundToggleText = $('sound-toggle-text');
const footerSound = $('footer-sound');

sound.onChange((on) => {
  if (soundToggle) {
    soundToggle.setAttribute('aria-pressed', String(on));
    soundToggle.setAttribute('aria-label', on ? 'Disable ambient sound' : 'Enable ambient sound');
  }
  if (soundToggleText) soundToggleText.textContent = on ? 'Sound on' : 'Sound off';
  if (footerSound) {
    footerSound.setAttribute('aria-pressed', String(on));
    const label = footerSound.querySelector('[data-sound-label]');
    if (label) label.textContent = on ? 'Sound on' : 'Enable sound';
  }
});

const toggleSound = async () => {
  await sound.toggle();
  if (sound.enabled) {
    sound.ctx?.resume?.();
  }
};

soundToggle?.addEventListener('click', toggleSound);
footerSound?.addEventListener('click', toggleSound);

/* ── labels strip ─────────────────────────────────────────── */
const track = $('label-track');
if (track) {
  const half = LABELS.map((l) => `<span>${l}</span>`).join('');
  track.innerHTML = half + half;
}

/* ── world ────────────────────────────────────────────────── */
const canvas = $('scene');
const holder = $('hero-canvas-holder');
const hero = $('hero');
const guidesOverlay = $('guides-overlay');

let world = null;
let rig = null;
let stages = null;
let inspect = null;
let reveal = null;

function detectTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const small = Math.min(window.innerWidth, window.innerHeight) < 620;
  if (isTouch || cores <= 3 || mem <= 2) return 'low';
  if (cores <= 6 || small) return 'medium';
  return 'high';
}

async function boot() {
  setLoad(0.04, 'Preparing winter light …');

  try {
    world = new World(canvas);
  } catch (err) {
    console.error('[forma] WebGL unavailable', err);
    loaderNote.textContent = 'This browser could not start WebGL — the stills remain below.';
    document.body.classList.remove('is-loading');
    loader?.classList.add('is-done');
    return;
  }

  world.setQuality(detectTier());
  // the DOM already knows its theme (inline boot script); match the world to it
  world.setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  setLoad(0.12, 'Loading the pavilion …');

  await world.load((p) => setLoad(0.12 + p * 0.66, 'Loading the pavilion …'));
  setLoad(0.84, 'Lighting the water …');

  rig = new CameraRig(world.camera, STAGES, { reducedMotion });
  rig.goto(0, { instant: true });
  rig.update(0.016);

  stages = new StageController({
    rig,
    sound,
    scan,
    onChange: () => {},
  });
  stages.setReduced(reducedMotion);

  inspect = new Inspect({
    world,
    rig,
    overlay: guidesOverlay,
    onHoverChange: (on) => {
      if (on) {
        cursor.lock('Inspect structure');
        cursor.set('inspect', 'Inspect structure');
        sound.cue('inspect');
      } else {
        cursor.reset();
      }
    },
  });

  const inspectBtn = $('inspect-action');
  inspectBtn?.addEventListener('click', () => {
    const on = inspectBtn.getAttribute('aria-pressed') !== 'true';
    inspectBtn.setAttribute('aria-pressed', String(on));
    inspect.setMode(on);
    sound.cue(on ? 'select' : 'inspect');
  });

  /* pointer: parallax + inspection */
  if (!isTouch) {
    window.addEventListener(
      'pointermove',
      (e) => {
        rig.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      },
      { passive: true },
    );

    canvas.addEventListener(
      'pointermove',
      (e) => inspect.onPointerMove(e.clientX, e.clientY),
      { passive: true },
    );
    canvas.addEventListener('pointerleave', () => inspect.onPointerLeave());
  } else {
    canvas.addEventListener('pointerleave', () => inspect.onPointerLeave());
  }

  window.addEventListener('resize', () => world.resize());

  setLoad(0.96, 'Composing the frame …');

  reveal = new SectionReveal({ reducedMotion, sound });
  reveal.init();

  wireFooter();
  wireMenu();
  observeHero();

  // inspection hook for development / QA
  window.__forma = {
    get world() { return world; },
    get rig() { return rig; },
    get stages() { return stages; },
    get inspect() { return inspect; },
    get reveal() { return reveal; },
    get sound() { return sound; },
    get theme() { return document.documentElement.dataset.theme; },
    setTheme: applyTheme,
    render: (t) => world?.render(t ?? 1),
  };

  // finish loading
  const started = performance.now();
  const waitForLoad = () => {
    const done = tickLoader();
    if (done || performance.now() - started > 4200) {
      finishLoading();
      return;
    }
    requestAnimationFrame(waitForLoad);
  };
  requestAnimationFrame(waitForLoad);
  // background tabs throttle rAF; never leave the veil up
  setTimeout(() => {
    if (document.body.classList.contains('is-loading')) finishLoading();
  }, 7000);
}

function finishLoading() {
  setLoad(1);
  loaderPct.textContent = '100';
  document.body.classList.remove('is-loading');
  loader?.classList.add('is-done');
  setTimeout(() => {
    loader?.setAttribute('hidden', '');
  }, 1000);
  startLoop();
}

/* ── loop ─────────────────────────────────────────────────── */
let last = performance.now();
let elapsed = 0;
let heroVisible = true;
let frameAcc = 0;
let frameCount = 0;
let adapted = false;

function startLoop() {
  last = performance.now();
  requestAnimationFrame(frame);
}

function frame(now) {
  const dtRaw = (now - last) / 1000;
  const dt = Math.min(0.05, Math.max(0.0001, dtRaw));
  last = now;
  elapsed += dt;

  if (rig) rig.update(dt);
  if (world && heroVisible) world.render(elapsed);
  if (inspect) inspect.update(dt, world.camera);
  if (stages) stages.updateReadout();
  if (reveal) reveal.update();

  // one adaptive quality step based on measured frame time
  if (!adapted && elapsed > 1.6) {
    frameAcc += dtRaw;
    frameCount += 1;
    if (frameCount > 45) {
      adapted = true;
      const avg = frameAcc / frameCount;
      if (avg > 0.026 && world) {
        world.setQuality(world.quality === 'high' ? 'medium' : 'low');
      }
    }
  }

  const scrolled = window.scrollY > 24;
  if (scrolled !== bodyScrolled) {
    bodyScrolled = scrolled;
    document.body.classList.toggle('is-scrolled', scrolled);
    document.body.classList.toggle('is-past-hero', window.scrollY > window.innerHeight * 0.6);
  }

  requestAnimationFrame(frame);
}

let bodyScrolled = false;

function observeHero() {
  if (!('IntersectionObserver' in window) || !hero) return;
  const io = new IntersectionObserver(
    (entries) => {
      heroVisible = entries[0].isIntersecting;
    },
    { rootMargin: '120px' },
  );
  io.observe(hero);
}

/* ── mobile menu ──────────────────────────────────────────── */
function wireMenu() {
  const toggle = $('menu-toggle');
  const nav = $('mobile-nav');
  if (!toggle || !nav) return;
  let closeTimer = null;

  const open = () => {
    clearTimeout(closeTimer);
    nav.hidden = false;
    // force a style flush so the fade-in transition actually runs
    void nav.offsetHeight;
    nav.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.style.overflow = 'hidden';
    setTimeout(() => nav.querySelector('a')?.focus(), 80);
  };

  const close = ({ restoreFocus = false } = {}) => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.style.overflow = '';
    closeTimer = setTimeout(() => {
      nav.hidden = true;
    }, 420);
    if (restoreFocus) toggle.focus();
  };

  toggle.addEventListener('click', () => {
    if (toggle.getAttribute('aria-expanded') === 'true') close({ restoreFocus: true });
    else open();
  });

  // capture so the body is scrollable again before the nav's own scroll handler runs
  nav.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => close(), { capture: true });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !nav.hidden) close({ restoreFocus: true });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 860 && !nav.hidden) close();
  });
}

/* ── footer + contact sheet ───────────────────────────────── */
function contactRows() {
  return CONTACT_FIELDS.map((f) => {
    const v = CONTACT[f.key];
    return { label: f.label, value: v, type: f.type };
  });
}

function valueMarkup(row, { interactive = false } = {}) {
  if (!row.value) return '<span class="v v--empty">To be supplied</span>';
  if (interactive && row.type === 'email')
    return `<a class="v" href="mailto:${row.value}">${row.value}</a>`;
  if (interactive && row.type === 'tel')
    return `<a class="v" href="tel:${row.value.replace(/\s/g, '')}">${row.value}</a>`;
  return `<span class="v">${row.value}</span>`;
}

function wireFooter() {
  const list = $('footer-contact-list');
  if (list) {
    const rows = contactRows();
    const filled = rows.filter((r) => r.value);
    list.innerHTML = filled.length
      ? rows.map((r) => `<li><span class="k">${r.label}</span>${valueMarkup(r, { interactive: true })}</li>`).join('')
      : `<li><span class="k">Email</span><span class="v v--empty">To be supplied</span></li>
         <li><span class="k">Telephone</span><span class="v v--empty">To be supplied</span></li>`;
  }

  const year = $('year');
  if (year) year.textContent = String(new Date().getFullYear());

  const top = $('back-to-top');
  top?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  });

  const sheet = $('contact-sheet');
  const body = $('contact-sheet-body');
  const openBtn = $('footer-contact');

  const openSheet = () => {
    if (!sheet) return;
    if (body) {
      const rows = contactRows();
      const filled = rows.filter((r) => r.value);
      body.innerHTML = filled.length
        ? `<p>Write to us with a model, a set of drawings, or a paragraph about the project.</p>
           <div class="contact-sheet__rows">${rows
             .map((r) => `<div class="contact-sheet__row"><span class="k">${r.label}</span>${valueMarkup(r, { interactive: true })}</div>`)
             .join('')}</div>`
        : `<p>The studio contact details have not been supplied for this build yet. Add them once in
             <code>src/data/content.js</code> and they appear here, in the footer, and in the enquiry sheet.</p>
           <div class="contact-sheet__rows">${rows
             .map((r) => `<div class="contact-sheet__row"><span class="k">${r.label}</span><span class="v v--empty">To be supplied</span></div>`)
             .join('')}</div>`;
    }
    sheet.hidden = false;
    // force a style flush so the fade-in transition actually runs
    void sheet.offsetHeight;
    sheet.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    sheet.querySelector('[data-close]')?.focus();
    sound.cue('select');
  };

  const closeSheet = () => {
    if (!sheet) return;
    sheet.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => {
      sheet.hidden = true;
    }, 420);
  };

  openBtn?.addEventListener('click', openSheet);
  sheet?.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeSheet));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet && !sheet.hidden) closeSheet();
  });
}

/* ── go ───────────────────────────────────────────────────── */
boot().catch((err) => {
  console.error('[forma] boot failed', err);
  document.body.classList.remove('is-loading');
  loader?.classList.add('is-done');
});
