import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BASE = process.env.BASE_URL ?? 'http://localhost:8080/';
const OUT = process.env.SHOTS ?? 'e2e-shots';
mkdirSync(OUT, { recursive: true });
const browser = await pw.chromium.launch();
const errors = [];
const vp = process.env.DESK ? { width: 1366, height: 900 } : { width: 390, height: 844 };
const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: 'it-IT', timezoneId: 'Europe/Rome', isMobile: vp.width < 600, hasTouch: vp.width < 600 });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_FAILED/.test(m.text())) errors.push(`console: ${m.text()}`); });
const routes = (process.env.ROUTES ?? 'oggi,calendario,attivita,report,basket,palestra,dichiarazioni,nutrizione,soldi,obiettivi,consigli,impostazioni').split(',');
await page.goto(BASE);
await page.waitForSelector('.view');
for (const r of routes) {
  await page.goto(`${BASE}#/${r}`);
  await page.waitForTimeout(1800);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const title = await page.title();
  console.log(r, '|', title, '| overflow', ov);
  await page.screenshot({ path: `${OUT}/${process.env.DESK ? 'd' : 'm'}-${r.replace(/\//g, '_')}.png`, fullPage: true });
}
console.log('ERRORS', errors);
await browser.close();
