// Prova end-to-end in un vero browser (Chromium via Playwright).
// Uso: npm run build && npx http-server dist -p 8080 & npm run e2e
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const BASE = process.env.BASE_URL ?? 'http://localhost:8080/';
const OUT = process.env.SHOTS ?? 'e2e-shots';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`); };

const browser = await pw.chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'it-IT', timezoneId: 'Europe/Rome', isMobile: true, hasTouch: true, acceptDownloads: true });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_FAILED/.test(m.text())) errors.push(`console: ${m.text()}`); });
const wait = (ms = 500) => p.waitForTimeout(ms);
const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });

// ─── Oggi ────────────────────────────────────────────────────────────────────
await p.goto(BASE);
await p.waitForSelector('.today-hero');
check('Home = Oggi', (await p.title()).startsWith('Oggi'));
check('Promemoria dichiarazioni in home', await p.locator('.decl-banner').isVisible());
check('Nessun giorno "mancato" prima del primo avvio', (await p.evaluate(() => document.querySelectorAll('.cc-missed').length)) === 0);
check('Finanze fuori dalla home (solo voto)', (await p.locator('.today .rep-mbar, .today .rbars').count()) === 0);

await p.click('button[aria-label="Fatto: Creatina"]');
await wait(150);
await p.screenshot({ path: `${OUT}/anim-01-spunta.png` });
await wait(700);
check('Spunta Creatina', await p.locator('button[aria-label="Togli spunta: Creatina"]').count() > 0);
check('Percentuale giornata aggiornata', /[1-9]\d*%/.test(await p.locator('.hero-pct').textContent()));

await p.click('[data-k="food"] .rate:nth-child(8)');
await wait(600);
check('Voto alimentazione 8', (await p.locator('[data-k="food"] .vote-big').textContent()) === '8');
await p.click('[data-k="money"] .rate:nth-child(6)');
await wait(500);

// Audiolibro: minuti
await p.locator('.tl-item', { hasText: 'Audiolibro' }).locator('button', { hasText: '+30' }).click();
await wait(600);
check('Audiolibro 30 min = fatto', await p.locator('button[aria-label="Togli spunta: Audiolibro"]').count() > 0);

// ─── Promemoria dal + ────────────────────────────────────────────────────────
await p.click('.fab');
await p.waitForSelector('.qa-opt');
await p.click('.qa-opt:has-text("Promemoria")');
await p.waitForSelector('#ev-title');
await p.fill('#ev-title', 'Pagare bolletta luce');
await p.fill('#ev-start', '18:00');
await p.click('.sheet button[type=submit]');
await wait(700);
check('Promemoria creato e visibile in Oggi', await p.locator('.tl-name', { hasText: 'Pagare bolletta luce' }).count() === 1);

// ─── Dichiarazioni ───────────────────────────────────────────────────────────
await p.click('.decl-banner');
await p.waitForSelector('.decl-list');
check('17 dichiarazioni', (await p.locator('.decl-list li').count()) === 17);
await p.click('.decl-sticky .btn');
await wait(400);
await p.screenshot({ path: `${OUT}/anim-02-celebrazione.png` });
await wait(2600);
check('Dichiarazioni lette', await p.locator('.decl-done').isVisible());
check('Giorno acceso nel calendario', await p.locator(`.hcal .hc.hc-done.is-today`).count() === 1);

// ─── Basket: partita in programma ────────────────────────────────────────────
await p.goto(`${BASE}#/basket`);
await p.waitForSelector('.court');
await p.click('button:has-text("Programma")');
await p.waitForSelector('#sg-opp');
await p.fill('#sg-opp', 'Virtus');
const in3 = await p.evaluate((t) => { const d = new Date(t + 'T12:00:00'); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10); }, today);
await p.fill('#sg-date', in3);
await p.fill('#sg-time', '20:30');
await p.click('.sheet button[type=submit]');
await wait(700);
check('Partita in programma', await p.locator('.up-card', { hasText: 'Virtus' }).count() === 1);
check('Partita segnata nel calendario', await p.locator('.hcal .hc-game.sched').count() >= 1);
await p.click('button:has-text("Allenamento extra oggi"), button:has-text("Presente all")');
await wait(300);
await p.screenshot({ path: `${OUT}/anim-03-canestro.png` });
await wait(1500);
check('Allenamento basket registrato', await p.locator('.court.scored').count() === 1);

// ─── Palestra: scheda + sessione con carichi ─────────────────────────────────
await p.goto(`${BASE}#/palestra`);
await p.waitForSelector('.barbell');
await p.click('button:has-text("Scrivi la scheda")');
await p.waitForSelector('#pe-0-0');
await p.fill('#pd-0', 'Giorno A · Petto');
await p.fill('#pe-0-0', 'Panca piana');
await p.fill('#ps-0-0', '4');
await p.fill('#pr-0-0', '8-10');
await p.click('.sheet button:has-text("Salva scheda")');
await wait(600);
check('Scheda salvata', await p.locator('.plan-day', { hasText: 'Panca piana' }).count() === 1);
await p.click('button:has-text("Registra sessione di oggi")');
await p.waitForSelector('.plan-pick');
await p.click('.plan-pick button:has-text("Giorno A")');
await wait(300);
const kg = p.locator('#ex-0-0-k');
check('Esercizi caricati dalla scheda', (await p.locator('#ex-0-name').inputValue()) === 'Panca piana' && (await p.locator('.set-grid .set-n').count()) === 4);
await kg.fill('80');
await p.click('.sheet button:has-text("Salva sessione")');
await wait(1500);
check('Sessione registrata (disco sul bilanciere)', await p.locator('.barbell .plate').count() >= 1);
check('Sessione in elenco', await p.locator('.gym-card').count() === 1);

// ─── Calendario e report ─────────────────────────────────────────────────────
await p.goto(`${BASE}#/calendario`);
await p.waitForSelector('.month');
check('Barra attività del giorno nel calendario', await p.locator('.m-cell.is-today .m-bar .ok').count() === 1);
await p.goto(`${BASE}#/report`);
await p.waitForSelector('.rep-hero');
await wait(1500);
check('Report: palestra 1/3', (await p.locator('.rep-card', { hasText: 'Palestra' }).locator('strong').textContent()) === '1/3');
check('Report: audiolibro 30\'', (await p.locator('.rep-card', { hasText: 'Audiolibro' }).locator('strong').textContent()) === "30'");
check('Report: media soldi 6', (await p.locator('.rep-vote', { hasText: 'Soldi' }).locator('.rep-avg').textContent()) === '6');
await p.screenshot({ path: `${OUT}/m-report-dati.png`, fullPage: true });

// ─── Persistenza ─────────────────────────────────────────────────────────────
await p.reload();
await p.goto(`${BASE}#/oggi`);
await p.waitForSelector('.today-hero');
await wait(800);
check('Dati salvati dopo ricarica', await p.locator('button[aria-label="Togli spunta: Creatina"]').count() > 0);
await p.screenshot({ path: `${OUT}/m-oggi-dati.png`, fullPage: true });

// ─── Esportazioni ────────────────────────────────────────────────────────────
await p.goto(`${BASE}#/impostazioni`);
await p.waitForSelector('.info-card');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Scarica per il calendario")')]);
const ics = readFileSync(await dl.path(), 'utf8');
check('File .ics con promemoria', ics.includes('BEGIN:VCALENDAR') && ics.includes('Dichiarazioni') && ics.includes('Pagare bolletta luce') && ics.includes('VALARM'));
const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Esporta backup")')]);
const bk = JSON.parse(readFileSync(await dl2.path(), 'utf8'));
check('Backup JSON', bk.app === 'MY EMPIRE');

check('Nessun errore JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} controlli superati`);
process.exit(failed ? 1 : 0);
