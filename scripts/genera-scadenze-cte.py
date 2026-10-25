"""Legge le CTE (PDF nelle cartelle cte*) e ricava la data di fine validità dell'offerta.
Scrive data/scadenze-cte.json: { "aggiornato": "AAAA-MM-GG", "file": { "<percorso>": {"scade": "AAAA-MM-GG", "testo": "..."} } }
Il Drive mostra l'etichetta "Scade il …" / "Scaduta" accanto a ogni CTE.
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


def main():
    risultati = {}
    for base in ("documenti",):
        for d, _, files in os.walk(os.path.join(ROOT, base)):
            rel_dir = os.path.relpath(d, ROOT).replace(os.sep, "/")
            if "/cte" not in rel_dir:
                continue
            for f in files:
                if not f.lower().endswith(".pdf"):
                    continue
                rel = f"{rel_dir}/{f}"
                trovato = scadenza(testo(os.path.join(d, f)))
                if trovato:
                    risultati[rel] = {"scade": trovato[1].isoformat(), "testo": trovato[2]}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    try:
        if json.load(open(OUT, encoding="utf-8")).get("file") == dict(sorted(risultati.items())):
            print(f"{len(risultati)} CTE con scadenza (nessun cambiamento)")
            return
    except (OSError, ValueError):
        pass
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"aggiornato": dt.date.today().isoformat(), "file": dict(sorted(risultati.items()))}, fh, ensure_ascii=False, indent=1)
    print(f"{len(risultati)} CTE con scadenza")


if __name__ == "__main__":
    main()
