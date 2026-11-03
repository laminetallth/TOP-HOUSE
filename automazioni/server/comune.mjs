// Funzioni comuni per i controlli automatici che girano su GitHub (senza PC acceso).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const QUI = path.dirname(fileURLToPath(import.meta.url));
export const CARTELLA_CRM = path.join(QUI, "..", "crm");
export const CARTELLA_ESITI = path.join(QUI, "..", "..", "esiti-automazione");

export function segreto(nome) {
    const v = process.env[nome];
    if (!v) throw new Error(`Manca il secret ${nome} su GitHub`);
    return v;
}

export async function apriBrowser() {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        locale: "it-IT",
        timezoneId: "Europe/Rome",
        viewport: { width: 1366, height: 900 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    });
    return { browser, context };
}

// Accesso generico: compila il primo campo utente/email e il campo password visibili e invia.
export async function login(page, { url, utente, password, attesa }) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    const pwd = page.locator('input[type="password"]:visible').first();
    if (!(await pwd.count())) return "gia-loggato";
    const campoUtente = page.locator([
        'input[type="email"]:visible',
        'input[name*="user" i]:visible', 'input[name*="mail" i]:visible', 'input[name*="login" i]:visible',
        'input[id*="user" i]:visible', 'input[id*="mail" i]:visible',
        'input[type="text"]:visible'
    ].join(", ")).first();
    await campoUtente.fill(utente);
    await pwd.fill(password);
    const invia = page.locator('button[type="submit"]:visible, input[type="submit"]:visible, button:has-text("Accedi"):visible, button:has-text("Login"):visible, button:has-text("Entra"):visible').first();
    await Promise.all([
        page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {}),
        (await invia.count()) ? invia.click() : pwd.press("Enter")
    ]);
    if (attesa) await attesa();
    return "fatto";
}

export async function caricaLettore(page, file, funzione) {
    const codice = fs.readFileSync(path.join(CARTELLA_CRM, file), "utf8");
    await page.addScriptTag({ content: `${codice};window.${funzione}=${funzione};` });
}

export async function fotoErrore(page, nome) {
    fs.mkdirSync(CARTELLA_ESITI, { recursive: true });
    try { await page.screenshot({ path: path.join(CARTELLA_ESITI, `${nome}.png`), fullPage: true }); } catch (e) { /* ignore */ }
}

export function riepilogo(testo) {
    console.log(testo);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${testo}\n`);
}

export function conta(lista, campo) {
    const m = {};
    lista.forEach((x) => { const k = (typeof campo === "function" ? campo(x) : x[campo]) || "—"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(" · ");
}
