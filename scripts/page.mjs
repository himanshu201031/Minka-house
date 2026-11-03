import { chromium } from 'playwright-core';
import path from 'node:path';
const width = Number(process.argv[2] || 1440);
const height = Number(process.argv[3] || 900);
const outDir = process.argv[4] || 'C:/Users/himan/AppData/Local/Temp/opencode';
const scrolls = (process.argv[5] || '900,1150,1450,1750,2000,2300,2800,3300,3800,4300,4800,5300,6000').split(',').map(Number);
const tag = process.argv[6] || `${width}`;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-lcd-text','--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(process.env.FORMA_URL || 'http://localhost:5174', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => !!window.__forma, null, { timeout: 45000 });
await page.waitForFunction(() => !document.body.classList.contains('is-loading'), null, { timeout: 30000 });
await page.evaluate(() => window.__forma.world.setQuality('high'));
await page.waitForTimeout(1200);
const out = [];
for (const y of scrolls) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(650);
  if (y > 1200) await page.evaluate(() => window.__forma.world.setQuality('low'));
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => { try { if (a.effect?.getComputedTiming?.().iterations !== Infinity) a.finish(); } catch {} });
  });
  await page.waitForTimeout(180);
  const m = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const layer = (n) => {
      const el = document.querySelector(`[data-art-layer="${n}"]`);
      return el ? Number(getComputedStyle(el).getPropertyValue('--r')) : null;
    };
    const pl = {};
    document.querySelectorAll('.plan-layer').forEach((el) => { pl[el.dataset.phase] = Number(getComputedStyle(el).getPropertyValue('--p')); });
    return {
      y: Math.round(scrollY),
      doc: [document.documentElement.scrollWidth, window.innerWidth],
      art: { outline: layer('outline'), material: layer('material'), light: layer('light'), finish: layer('finish'), scan: document.getElementById('art-scan')?.style.top, label: document.getElementById('art-scan-label')?.textContent },
      plan: pl,
      phase: document.getElementById('design-phase')?.textContent,
      progress: document.getElementById('design-progress-fill')?.style.width,
      note: document.getElementById('design-note')?.textContent,
      markers: document.getElementById('plan-markers')?.className,
      body: document.body.className,
      sections: [...document.querySelectorAll('.section-title, .footer-title')].map((e) => e.className.match(/is-in/)?'in':'out'),
    };
  });
  await page.screenshot({ path: path.join(outDir, `page-${tag}-${y}.png`), timeout: 180000, animations: 'disabled', caret: 'hide' });
  out.push(m);
}
console.log(JSON.stringify({ out, logs }, null, 2));
await browser.close();
