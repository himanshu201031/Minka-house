import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-lcd-text', '--force-device-scale-factor=1'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => !!window.__forma, null, { timeout: 45000 });
await page.waitForFunction(() => !document.body.classList.contains('is-loading'), null, { timeout: 30000 });
await page.evaluate(() => { window.__forma.world.setQuality('high'); window.__forma.world.setTheme('light'); });
await page.waitForTimeout(1200);
const probe = await page.evaluate(() => {
  const hits = [];
  for (const [x, y] of [[1250, 200], [1250, 150], [1350, 180], [1250, 320]]) {
    const els = document.elementsFromPoint(x, y).slice(0, 5).map((el) => {
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 60),
        bg: cs.background.slice(0, 140),
        opacity: cs.opacity,
      };
    });
    hits.push({ x, y, els });
  }
  return hits;
});
console.log(JSON.stringify(probe, null, 1));
await browser.close();
