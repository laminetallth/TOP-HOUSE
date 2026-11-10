// Giro completo: partner → Regia. Gira su GitHub agli orari del workflow.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PARTNER, partnerConfigurati } from "./partner.mjs";
import { caricaRegia, regiaConfigurata } from "./regia.mjs";
import { riepilogo, conta } from "./comune.mjs";

const QUI = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(QUI, "config.json"), "utf8"));
const manuale = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";
// prova = non scrive. Manuale: decide l'opzione "prova"; automatico: decide config.json (regiaAttiva)
const prova = manuale ? process.env.PROVA !== "false" : !config.regiaAttiva;

riepilogo(`## Partner → Regia ${prova ? "(PROVA: nessuna scrittura)" : ""}\n`);
if (!regiaConfigurata()) {
    riepilogo("Manca la chiave di Regia (secret **REGIA_API_TOKEN**): leggo solo i partner.\n");
}

let errori = 0;
let gia = { promup: {}, greenworld: {}, bwc: {}, union: {} };
let regia = null;
if (regiaConfigurata()) {
    try {
        regia = caricaRegia();
        gia = await regia.elencoImportati();
        riepilogo(`Regia collegata: già importati ${Object.values(gia).reduce((t, x) => t + Object.keys(x).length, 0)} contratti dei partner.\n`);
    } catch (e) {
        errori += 1;
        riepilogo(`**Regia: ERRORE** – ${e.message}\n`);
        regia = null;
    }
}

const daLavorare = [];
for (const k of partnerConfigurati()) {
    const p = PARTNER[k];
    try {
        const lista = await p.leggi(gia[k] || {});
        daLavorare.push(...lista);
        riepilogo(`- ${p.nome}: ${lista.length} da lavorare${lista.length ? ` (${conta(lista, (c) => (c.ko ? "KO" : "nuovi"))})` : ""}`);
    } catch (e) {
        errori += 1;
        riepilogo(`- ${p.nome}: **ERRORE** – ${e.message}`);
    }
}
riepilogo("");

// Lo stesso contratto può comparire più volte nel portale (es. reinserito dopo un KO):
// ne tengo uno solo per fonte + id, e se uno è valido vince sul KO.
{
    const unici = new Map();
    for (const c of daLavorare) {
        const k = `${c.fonte}|${c.id}`;
        const prima = unici.get(k);
        if (!prima || (prima.ko && !c.ko)) unici.set(k, c);
    }
    const tolti = daLavorare.length - unici.size;
    daLavorare.splice(0, daLavorare.length, ...unici.values());
    if (tolti) riepilogo(`Righe doppie nei portali ignorate: ${tolti}\n`);
}

if (regia && daLavorare.length) {
    try {
        const report = await regia.sincronizza(daLavorare, prova);
        riepilogo(`### ${prova ? "Cosa farebbe su Regia" : "Fatto su Regia"} (${report.length})\n`);
        riepilogo("| Azione | Opportunità | Fonte | Venditore |\n|---|---|---|---|");
        report.forEach((r) => riepilogo(`| ${r.azione}${r.errore ? `: ${r.errore}` : ""} | ${r.opportunita || ""} | ${r.fonte || ""} | ${r.venditore || ""} |`));
        errori += report.filter((r) => r.azione === "ERRORE").length;
    } catch (e) {
        errori += 1;
        riepilogo(`**Regia: ERRORE** – ${e.message}`);
    }
} else if (regia) {
    riepilogo("Niente da aggiornare su Regia.");
}
process.exit(errori ? 1 : 0);
