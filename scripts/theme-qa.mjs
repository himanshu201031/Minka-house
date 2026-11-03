import { chromium } from 'playwright-core';
import path from 'node:path';

const outDir = process.argv[2] || 'C:/Users/himan/AppData/Local/Temp/opencode';
const url = process.env.FORMA_URL || 'http://localhost:5174';
const shots = [];
const snap = (p) => shots.push(p) && path.join(outDir, `${p}.png`);

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-lcd-text', '--force-device-scale-factor=1'],
});

const logs = [];
const attach = (page) => {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
};
const settle = async (page, ms = 700) => {
  await page.waitForTimeout(ms);
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => { try { if (a.effect?.getComputedTiming?.().iterations !== Infinity) a.finish(); } catch {} });
  });
  await page.waitForTimeout(160);
};
const shot = async (page, name, full = false) => {
  await page.screenshot({ path: snap(name), timeout: 180000, animations: 'disabled', caret: 'hide', fullPage: full });
};

/* ── desktop pass ─────────────────────────────────────────── */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  attach(page);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__forma, null, { timeout: 45000 });
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'), null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__forma.world.setQuality('high');
    window.__forma.world.setTheme('light');
  });
  await page.evaluate(() => localStorage.setItem('forma-theme', 'light'));
  await settle(page, 1400);
  await shot(page, 'light-hero');

  // toggle once to dark, once back — the real event path
  const t0 = await page.evaluate(() => {
    const el = document.getElementById('theme-toggle');
    const before = document.documentElement.dataset.theme;
    el.click();
    return {
      before,
      after: document.documentElement.dataset.theme,
      persisted: localStorage.getItem('forma-theme'),
      meta: document.querySelector('meta[name="theme-color"]')?.content,
      aria: el.getAttribute('aria-label'),
      worldTheme: window.__forma.world.theme,
    };
  });
  await settle(page, 1000);
  await shot(page, 'dark-hero');

  // scroll targets: the four new sections plus footer + contact
  const targets = await page.evaluate(() =>
    ['services', 'process', 'press', 'faq', 'contact'].map((id) => {
      const el = document.getElementById(id);
      return { id, top: el ? Math.round(el.getBoundingClientRect().top + scrollY) : -1 };
    })
  );
  await page.evaluate(() => localStorage.setItem('forma-theme', 'dark'));

  const darkState = {};
  for (const { id, top } of targets) {
    if (top < 0) { darkState[id] = 'MISSING'; continue; }
    await page.evaluate((y) => window.scrollTo(0, y - 60), top);
    await settle(page);
    await shot(page, `dark-${id}`);
    darkState[id] = await page.evaluate(() => {
      const sec = document.querySelector(':scope > main > section:hover, .is-in') ? null : null;
      const revealed = [...document.querySelectorAll('[data-reveal]')].filter((e) => e.classList.contains('is-in')).length;
      const total = document.querySelectorAll('[data-reveal]').length;
      return { revealed, total, docHeight: document.documentElement.scrollHeight };
    });
  }

  // back to light via the toggle, sweep the same sections
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.getElementById('theme-toggle').click());
  const t1 = await page.evaluate(() => ({
    after: document.documentElement.dataset.theme,
    persisted: localStorage.getItem('forma-theme'),
    meta: document.querySelector('meta[name="theme-color"]')?.content,
    worldTheme: window.__forma.world.theme,
  }));
  await settle(page, 1000);

  for (const { id, top } of targets) {
    if (top < 0) continue;
    await page.evaluate((y) => window.scrollTo(0, y - 60), top);
    await settle(page);
    await shot(page, `light-${id}`);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await settle(page, 1100);
  await shot(page, 'light-footer');

  console.log(JSON.stringify({ toggleToDark: t0, toggleToLight: t1, darkState }, null, 2));
  await page.close();
}

/* ── mobile pass ──────────────────────────────────────────── */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  attach(page);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__forma, null, { timeout: 45000 });
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await shot(page, 'mobile-light-hero');

  await page.evaluate(() => document.getElementById('menu-toggle').click());
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => { try { if (a.effect?.getComputedTiming?.().iterations !== Infinity) a.finish(); } catch {} });
  });
  await page.waitForTimeout(150);
  const menu = await page.evaluate(() => {
    const nav = document.getElementById('mobile-nav');
    const links = [...nav.querySelectorAll('a')];
    const last = links[links.length - 1];
    return {
      linkCount: links.length,
      navOverflow: { navBottom: Math.round(nav.scrollHeight), vpH: innerHeight, footBelowVp: Math.round(last.getBoundingClientRect().bottom) > innerHeight },
      navClass: nav.className,
    };
  });
  await shot(page, 'mobile-light-menu');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('theme-toggle').click());
  await page.waitForTimeout(900);
  await shot(page, 'mobile-dark-hero');
  await page.evaluate(() => document.getElementById('menu-toggle').click());
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => { try { if (a.effect?.getComputedTiming?.().iterations !== Infinity) a.finish(); } catch {} });
  });
  await page.waitForTimeout(150);
  await shot(page, 'mobile-dark-menu');

  console.log(JSON.stringify({ menu }, null, 2));
  await page.close();
}

console.log(JSON.stringify({ shots, logs }, null, 2));
await browser.close();
