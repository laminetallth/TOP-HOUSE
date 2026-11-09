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
// copia cifrata nel log (la chiave la conosce solo chi lancia l'esportazione)
if (process.env.CHIAVE) {
    const crypto = await import("node:crypto");
    const key = crypto.createHash("sha256").update(process.env.CHIAVE).digest();
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", key, iv);
    const dati = Buffer.concat([c.update(JSON.stringify(out)), c.final()]);
    const b64 = Buffer.concat([iv, c.getAuthTag(), dati]).toString("base64");
    for (let i = 0; i < b64.length; i += 3000) console.log(`DATI:${b64.slice(i, i + 3000)}`);
}
