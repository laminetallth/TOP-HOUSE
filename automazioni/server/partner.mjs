// Lettori dei portali dei partner, versione server (GitHub): entrano da soli con i Secrets.
import { apriBrowser, login, caricaLettore, fotoErrore, segreto } from "./comune.mjs";

const DAL = process.env.DAL || "2026-10-26";

async function conPagina(nome, fn) {
    const { browser, context } = await apriBrowser();
    const page = await context.newPage();
    try { return await fn(page); }
    catch (e) { e.partner = nome; throw e; }
    finally { await browser.close(); }
}
function esito(json) {
    const d = JSON.parse(json);
    if (d && d.errore) throw new Error(d.errore);
    return d;
}

export const PARTNER = {
    promup: {
        nome: "PromUp",
        secrets: ["PROMUP_USER", "PROMUP_PASSWORD"],
        leggi: (gia = {}) => conPagina("PromUp", async (page) => {
            await login(page, { url: "https://promup.sharework.it/", utente: segreto("PROMUP_USER"), password: segreto("PROMUP_PASSWORD") });
            await page.goto("https://promup.sharework.it/web/agenzia.php", { waitUntil: "domcontentloaded", timeout: 60000 });
            if (!/GESTIONE CONTRATTI/i.test(await page.content())) { await fotoErrore(page, "promup-login"); throw new Error("LOGIN_PROMUP: accesso non riuscito"); }
            await caricaLettore(page, "leggi-promup.js", "leggiPromup");
            return esito(await page.evaluate(([d, g]) => window.leggiPromup(d, g), [DAL, gia]));
        })
    },
    greenworld: {
        nome: "GreenWorld",
        secrets: ["GREENWORLD_USER", "GREENWORLD_PASSWORD"],
        leggi: (gia = {}) => conPagina("GreenWorld", async (page) => {
            await login(page, { url: "https://crmgreenworld.com/", utente: segreto("GREENWORLD_USER"), password: segreto("GREENWORLD_PASSWORD") });
            // l'accesso del CRM GreenWorld è un token in sessionStorage
            const ok = await page.waitForFunction(() => !!sessionStorage.getItem("gw_crm_token"), null, { timeout: 30000 }).then(() => true).catch(() => false);
            if (!ok) { await fotoErrore(page, "greenworld-login"); throw new Error("LOGIN_GREENWORLD: accesso non riuscito"); }
            await caricaLettore(page, "leggi-greenworld.js", "leggiGreenworld");
            return esito(await page.evaluate(([d, g]) => window.leggiGreenworld(d, g), [DAL, gia]));
        })
    },
    bwc: {
        nome: "BWC",
        secrets: ["BWC_USER", "BWC_PASSWORD"],
        leggi: (gia = {}) => conPagina("BWC", async (page) => {
            await login(page, { url: "https://bwccrm.it/", utente: segreto("BWC_USER"), password: segreto("BWC_PASSWORD") });
            await page.goto("https://bwccrm.it/tracking.php", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
            const ok = await page.locator('button:has-text("Ricerca pda")').count();
            if (!ok) { await fotoErrore(page, "bwc-login"); throw new Error("LOGIN_BWC: accesso non riuscito"); }
            await caricaLettore(page, "leggi-bwc.js", "leggiBwc");
            return esito(await page.evaluate(([d, g]) => window.leggiBwc(d, g), [DAL, gia]));
        })
    }
};

export function partnerConfigurati() {
    return Object.entries(PARTNER).filter(([, p]) => p.secrets.every((s) => process.env[s])).map(([k]) => k);
}
