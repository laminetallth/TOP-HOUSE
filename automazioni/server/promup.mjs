// Legge i contratti da PromUp (promup.sharework.it) entrando con utente e password salvati nei Secrets.
import fs from "node:fs";
import path from "node:path";
import { apriBrowser, login, caricaLettore, fotoErrore, segreto, riepilogo, conta, CARTELLA_ESITI } from "./comune.mjs";

const BASE = "https://promup.sharework.it";
const DAL = process.env.DAL || new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10); // ultimi 40 giorni

export async function leggiPromupServer(gia = {}) {
    const { browser, context } = await apriBrowser();
    const page = await context.newPage();
    try {
        await login(page, { url: `${BASE}/`, utente: segreto("PROMUP_USER"), password: segreto("PROMUP_PASSWORD") });
        await page.goto(`${BASE}/web/agenzia.php`, { waitUntil: "domcontentloaded", timeout: 60000 });
        if (!/GESTIONE CONTRATTI/i.test(await page.content())) {
            await fotoErrore(page, "promup-login");
            throw new Error("LOGIN_PROMUP: accesso non riuscito (controlla PROMUP_USER e PROMUP_PASSWORD)");
        }
        await caricaLettore(page, "leggi-promup.js", "leggiPromup");
        const json = await page.evaluate(([dal, g]) => window.leggiPromup(dal, g), [DAL, gia]);
        const dati = JSON.parse(json);
        if (dati.errore) throw new Error(dati.errore);
        return dati;
    } finally {
        await browser.close();
    }
}

// Avvio diretto: prova di sola lettura
if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        const t0 = Date.now();
        const contratti = await leggiPromupServer({});
        riepilogo(`## PromUp – prova di lettura\n`);
        riepilogo(`Contratti inseriti dal ${DAL}: **${contratti.length}** (in ${Math.round((Date.now() - t0) / 1000)} s)\n`);
        riepilogo(`- Per gestore: ${conta(contratti, "gestore")}`);
        riepilogo(`- KO: ${contratti.filter((c) => c.ko).length}`);
        riepilogo(`- Per venditore: ${conta(contratti, (c) => c.venditore || "agenzia")}`);
        riepilogo(`- Con anagrafica completa (nome/ragione sociale + telefono o email): ${contratti.filter((c) => (c.cliente.cognome || c.cliente.ragsoc) && (c.cliente.tel || c.cliente.email)).length}`);
        fs.mkdirSync(CARTELLA_ESITI, { recursive: true });
        fs.writeFileSync(path.join(CARTELLA_ESITI, "promup-ok.txt"), `${contratti.length}\n`);
    } catch (e) {
        riepilogo(`## PromUp – errore\n\n${e.message}`);
        process.exit(1);
    }
}
