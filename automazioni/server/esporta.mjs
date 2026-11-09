// Esporta i contratti di un partner in un file JSON (artifact privato, conservato 1 giorno).
import fs from "node:fs";
import path from "node:path";
import { PARTNER } from "./partner.mjs";
import { CARTELLA_ESITI } from "./comune.mjs";
const k = process.env.PARTNER || "promup";
const lista = await PARTNER[k].leggi({});
const al = process.env.AL || "9999-12-31";
const out = lista.filter((c) => !c.data || c.data <= al);
fs.mkdirSync(CARTELLA_ESITI, { recursive: true });
fs.writeFileSync(path.join(CARTELLA_ESITI, `${k}.json`), JSON.stringify(out));
console.log(`${k}: ${out.length} contratti esportati`);
