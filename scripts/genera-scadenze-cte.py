"""Legge le CTE (PDF nelle cartelle cte*) e ricava la data di fine validità dell'offerta.
Scrive data/scadenze-cte.json: { "aggiornato": "AAAA-MM-GG", "file": { "<percorso>": {"scade": "AAAA-MM-GG", "testo": "..."} } }
Il Drive mostra l'etichetta "Scade il …" / "Scaduta" accanto a ogni CTE.
Scrive anche data/gestori-offerte.json (offerte attive per gestore, segmento e fornitura) per "Trova il gestore".
Serve pdftotext (poppler-utils); se manca prova con pypdf.
Uso: python3 scripts/genera-scadenze-cte.py
"""
import datetime as dt
import json
import os
import re
import subprocess
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "scadenze-cte.json")

MESI = {m: i for i, m in enumerate(["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto",
                                    "settembre", "ottobre", "novembre", "dicembre"], 1)}
D = r"(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})"
DM = r"(\d{1,2})\s+(" + "|".join(MESI) + r")\s+(\d{4})"
DATA = rf"(?:{D}|{DM})"

# Frasi che indicano la validità dell'offerta (non le date tecniche come "fino al 31/12/2026 si considera il PRA").
CHIAVE = r"(?:valid[aoi]t?[aà]?'?|validit[aà]'?|adesion[ei]|sottoscritt[ea]|sottoscrizion[ei]|richieste\s+effettuate|condizioni)"
REGOLE = [
    rf"{CHIAVE}[^\n]{{0,60}}?\bdal\s+{DATA}[,\s]*\s*(?:al|fino\s+al|-)\s+{DATA}",
    rf"{CHIAVE}[^\n]{{0,25}}?:?\s*{DATA}\s*(?:-|al)\s*{DATA}",
    rf"{CHIAVE}[^\n]{{0,60}}?\b(?:entro\s+(?:il|le\s+[\d.:]+\s+del)|fino\s+al(?:la\s+data\s+del)?|al)\s*:?\s*{DATA}",
]


def to_date(groups):
    g = [x for x in groups if x is not None]
    try:
        if g[1].isdigit():
            d, m, y = int(g[0]), int(g[1]), int(g[2])
        else:
            d, m, y = int(g[0]), MESI[g[1].lower()], int(g[2])
        if y < 100:
            y += 2000
        return dt.date(y, m, d)
    except (ValueError, KeyError, IndexError):
        return None


def testo(path):
    try:
        return subprocess.run(["pdftotext", "-l", "3", path, "-"], capture_output=True, text=True, timeout=30).stdout
    except (FileNotFoundError, subprocess.TimeoutExpired):
        try:
            from pypdf import PdfReader
            return "\n".join((p.extract_text() or "") for p in PdfReader(path).pages[:3])
        except Exception:
            return ""


def scadenza(txt):
    txt = unicodedata.normalize("NFC", txt).replace("\u2019", "'")
    txt = re.sub(r"[ \t]+", " ", txt)
    txt = re.sub(r"(validit[aà]'?(?:[ \t]*(?:offerta|dell'offerta))?[ \t]*:?)[ \t]*\n\s*", r"\1 ", txt, flags=re.I)
    best = None
    # "Periodo di validità della CTE: OTTOBRE 2026" -> ultimo giorno del mese
    m = re.search(r"validit[aà]'?[^\n]{0,30}?:\s*(" + "|".join(MESI) + r")\s+(\d{4})", txt, re.I)
    if m:
        mese, anno = MESI[m.group(1).lower()], int(m.group(2))
        fine = (dt.date(anno + mese // 12, mese % 12 + 1, 1) - dt.timedelta(days=1))
        best = (m.start(), fine, " ".join(m.group(0).split())[:140])
    for regola in REGOLE:
        for m in re.finditer(regola, txt, re.I):
            riga = txt[max(0, m.start() - 40):m.end()]
            if re.search(r"corrispettiv|ETS|PRA\b|misuratore|decorrere|marzo di ciascun|eventuali proroghe", riga, re.I):
                continue
            gruppi = m.groups()
            fine = to_date(gruppi[-6:]) if gruppi[-6] or gruppi[-3] else None
            if not fine or not (2024 <= fine.year <= dt.date.today().year + 2):
                continue
            # vince la frase che compare per prima nel documento
            if best is None or m.start() < best[0]:
                best = (m.start(), fine, " ".join(m.group(0).split())[:140])
    return best


PARTNER = {  # da dove arrivano le CTE (portali dei partner)
    "greenworld": {"agn-energia", "alperia", "audax", "chiurlo", "cogeme", "duferco", "engie", "gde", "hera", "iren",
                   "simecom", "sorgenia", "stream", "unoenergy", "vivienergia", "enel-tablet", "enel-corporate"},
    "promup": {"axpo", "enel-digital", "enel-corporate", "magis", "edison", "engie", "audax", "sorgenia", "hera", "estra",
               "fastweb-energia", "upenergy"},
    "bwc": {"plenitude"},
}
NOMI_PARTNER = {"greenworld": "GreenWorld", "promup": "PromUp", "bwc": "BWC"}


def segmento_e_fornitura(rel_dir, nome, txt):
    """Ricava segmento (business/residenziale/condominio) e fornitura (luce/gas) di una CTE."""
    n = nome.upper()
    head = unicodedata.normalize("NFC", txt[:3000]).lower()
    seg = {"business" if "business" in rel_dir else "residenziale"}
    if re.search(r"CONDOMIN|CONDO\b|CONDO[ _-]", n) or re.search(r"\bcondomin(?:i|io)\b", head[:800]):
        seg.add("condominio")
    luce = bool(re.search(r"LUCE|\bEE\b|_EE_|ENERGIA[ _]ELETTRICA|POWER|\bELE\b|ELETTRIC", n))
    gas = bool(re.search(r"GAS|\bSMC\b", n))
    if re.search(r"DUAL|LUCE[ _-]?(?:E|&|\+)[ _-]?GAS", n):
        luce = gas = True
    if not (luce or gas):
        kwh, smc = len(re.findall(r"kwh", head)), len(re.findall(r"smc", head))
        luce, gas = kwh >= smc and kwh > 0, smc >= kwh and smc > 0
    return seg, ({"luce"} if luce else set()) | ({"gas"} if gas else set())


def main():
    risultati, offerte = {}, {}
    oggi = dt.date.today()
    for base in ("documenti",):
        for d, _, files in os.walk(os.path.join(ROOT, base)):
            rel_dir = os.path.relpath(d, ROOT).replace(os.sep, "/")
            if "/cte" not in rel_dir:
                continue
            parti = rel_dir.split("/")
            slug = parti[2] if parti[1] == "gestori" else parti[1]
            for f in files:
                if not f.lower().endswith(".pdf"):
                    continue
                rel = f"{rel_dir}/{f}"
                txt = testo(os.path.join(d, f))
                trovato = scadenza(txt)
                if trovato:
                    risultati[rel] = {"scade": trovato[1].isoformat(), "testo": trovato[2]}
                if re.search(r"vulnerabilit|confrontabilit|scheda sintetica|allegato tecnico|attenzione per un corretto", f, re.I):
                    continue  # non sono offerte vere e proprie
                if trovato and trovato[1] < oggi:
                    continue  # CTE scaduta: non conta come offerta attiva
                seg, forn = segmento_e_fornitura(rel_dir, f, txt)
                g = offerte.setdefault(slug, {"offerte": {}, "prossima_scadenza": None})
                for sgm in seg:
                    for c in forn or {"luce", "gas"}:
                        k = f"{sgm}-{c}"
                        g["offerte"][k] = g["offerte"].get(k, 0) + 1
                if trovato and (g["prossima_scadenza"] is None or trovato[1].isoformat() < g["prossima_scadenza"]):
                    g["prossima_scadenza"] = trovato[1].isoformat()
    for slug, g in offerte.items():
        g["partner"] = [NOMI_PARTNER[p] for p, s in PARTNER.items() if slug in s]
        g["offerte"] = dict(sorted(g["offerte"].items()))
    scrivi(os.path.join(ROOT, "data", "gestori-offerte.json"), dict(sorted(offerte.items())), "gestori")
    scrivi(OUT, dict(sorted(risultati.items())), "file")
    print(f"{len(risultati)} CTE con scadenza, {len(offerte)} gestori con offerte attive")


def scrivi(path, dati, chiave):
    """Riscrive il file solo se il contenuto è cambiato (così non nascono commit inutili)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        if json.load(open(path, encoding="utf-8")).get(chiave) == dati:
            return
    except (OSError, ValueError):
        pass
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"aggiornato": dt.date.today().isoformat(), chiave: dati}, fh, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
