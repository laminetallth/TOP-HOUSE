// Prova di sola lettura di tutti i partner con i Secrets impostati.
import { PARTNER, partnerConfigurati } from "./partner.mjs";
import { riepilogo, conta } from "./comune.mjs";

const DAL = process.env.DAL || "2026-10-26";
const attivi = partnerConfigurati();
const mancanti = Object.keys(PARTNER).filter((k) => !attivi.includes(k));
riepilogo(`## Lettura partner (dal ${DAL})\n`);
if (mancanti.length) riepilogo(`Non configurati (manca il Secret): ${mancanti.map((k) => PARTNER[k].nome).join(", ")}\n`);
let errori = 0;
for (const k of attivi) {
    const p = PARTNER[k];
    const t0 = Date.now();
    try {
        const lista = await p.leggi({});
        riepilogo(`### ${p.nome}: ${lista.length} contratti (${Math.round((Date.now() - t0) / 1000)} s)`);
        if (lista.length) {
            riepilogo(`- Per gestore: ${conta(lista, "gestore")}`);
            riepilogo(`- KO: ${lista.filter((c) => c.ko).length}`);
            riepilogo(`- Per venditore: ${conta(lista, (c) => c.venditore || "agenzia")}`);
        }
        riepilogo("");
    } catch (e) {
        errori += 1;
        riepilogo(`### ${p.nome}: ERRORE – ${e.message}\n`);
    }
}
process.exit(errori ? 1 : 0);
