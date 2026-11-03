import { chromium } from 'playwright-core';
import path from 'node:path';

const width = Number(process.argv[2] || 1280);
const height = Number(process.argv[3] || 800);
const outDir = process.argv[4] || 'C:/Users/himan/AppData/Local/Temp/opencode';
const stages = (process.argv[5] || '0,1,2,3,4').split(',').map(Number);

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--disable-lcd-text',
    '--force-device-scale-factor=1',
  ],
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));

await page.goto(process.env.FORMA_URL || 'http://localhost:5174', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await page.waitForFunction(() => !!window.__forma, null, { timeout: 45000 });
await page.waitForFunction(() => !document.body.classList.contains('is-loading'), null, { timeout: 30000 });
await page.evaluate(() => window.__forma?.world?.setQuality('high'));
await page.waitForTimeout(1600);

const results = [];
for (const s of stages) {
  await page.evaluate((i) => window.__forma.stages.go(i, { instant: true }), s);
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__forma?.world?.setQuality('high'));
  await page.waitForTimeout(600);
  // Headless Chrome in this harness freezes the document timeline at 0, so
  // CSS transitions never advance. Snap them to their end state for the shot.
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => {
      try {
        if (a.effect?.getComputedTiming?.().iterations !== Infinity) a.finish();
      } catch {}
    });
  });
  await page.waitForTimeout(120);
  const m = await page.evaluate(() => ({
    stage: window.__forma.stages.index,
    heroClass: document.querySelector('.hero')?.className,
    readout: window.__forma.rig.readout(),
    views: getComputedStyle(document.querySelector('.views')).transform,
    copy: (() => {
      const el = document.querySelector('.stage-copy');
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })(),
  }));
  await page.screenshot({ path: path.join(outDir, `stage-${s + 1}.png`), timeout: 120000 });
  results.push(m);
}
console.log(JSON.stringify({ results, logs }, null, 2));
await browser.close();
