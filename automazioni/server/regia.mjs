// Regia Control (HighLevel) dal server: usa la chiave API ufficiale (REGIA_API_TOKEN), niente login.
// Riusa le stesse regole di ../crm/scrivi-regia.js (quelle già in uso dal PC), cambiando solo il modo di autenticarsi.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { CARTELLA_CRM } from "./comune.mjs";

const API = "https://services.leadconnectorhq.com";
const LOCATION = "XzcvYtDjrqAP8tyvw3rp";

export function regiaConfigurata() { return !!process.env.REGIA_API_TOKEN; }

function fetchRegia(token) {
    return async (url, opzioni = {}) => {
        let u = String(url);
        // endpoint interni dell'app → equivalenti ufficiali dell'API
        u = u.replace(/^https:\/\/backend\.leadconnectorhq\.com\/opportunities\/pipelines/, `${API}/opportunities/pipelines`);
        u = u.replace(/^https:\/\/backend\.leadconnectorhq\.com\/locations\/([^/]+)\/customFields\/search.*$/, `${API}/locations/$1/customFields`);
        const headers = { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json", "Content-Type": "application/json" };
        for (let tentativo = 0; tentativo < 4; tentativo += 1) {
            const r = await fetch(u, { ...opzioni, headers });
            if (r.status !== 429) return r;
            await new Promise((ok) => setTimeout(ok, 2000 * (tentativo + 1))); // limite di richieste: riprovo
        }
        return fetch(u, { ...opzioni, headers });
    };
}

export function caricaRegia() {
    const token = process.env.REGIA_API_TOKEN;
    if (!token) throw new Error("Manca il secret REGIA_API_TOKEN");
    const codice = fs.readFileSync(path.join(CARTELLA_CRM, "scrivi-regia.js"), "utf8");
    const window = { __hdr: { "token-id": "api", version: "2021-07-28" } };
    const ctx = vm.createContext({ window, fetch: fetchRegia(token), setTimeout, clearTimeout, console, URLSearchParams, XMLHttpRequest: function () {} });
    vm.runInContext(`${codice}\n;this.__elenco = elencoImportati; this.__sincronizza = sincronizzaRegia;`, ctx);
    return {
        async elencoImportati() {
            const d = JSON.parse(await ctx.__elenco());
            if (d.errore) throw new Error(d.errore === "TOKEN_REGIA" ? "Chiave Regia non valida o senza permessi" : d.errore);
            return d;
        },
        async sincronizza(contratti, prova) {
            const d = JSON.parse(await ctx.__sincronizza(contratti, prova));
            if (d && d.errore) throw new Error(d.errore === "TOKEN_REGIA" ? "Chiave Regia non valida o senza permessi" : d.errore);
            return d;
        }
    };
}

export { LOCATION };
