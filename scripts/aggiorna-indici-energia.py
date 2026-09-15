import json
import re
from datetime import date
from urllib.request import Request, urlopen

# Fonte stabile: pagina A4Energie che espone gli ultimi valori PUN/PSV.
# I valori sono dichiarati come provenienti da GME / ARERA.
URL = "https://www.a4energie.it/pun-luce-e-psv-gas-prezzi-allingrosso-aggiornati/"
OUT = "data/indici-energia.json"


def to_float(value):
    if value is None:
        return None
    cleaned = re.sub(r"[^0-9,.+-]", "", value.strip())
    if not cleaned:
        return None
    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    return float(cleaned)


def parse_date(value):
    months = {
        "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4,
        "maggio": 5, "giugno": 6, "luglio": 7, "agosto": 8,
        "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
    }
    m = re.search(r"(\d{1,2})\s+([A-Za-zà]+)\s+(\d{4})", value, re.I)
    if not m:
        return None
    month = months.get(m.group(2).lower())
    if not month:
        return None
    return f"{m.group(3)}-{month:02d}-{int(m.group(1)):02d}"


req = Request(URL, headers={"User-Agent": "TOP-HOUSE energy updater/2.0"})
html = urlopen(req, timeout=30).read().decode("utf-8", "replace")
text = re.sub(r"<[^>]+>", " ", html)
text = re.sub(r"\s+", " ", text)

# Esempi della pagina:
# "PUN ... oggi, 15 settembre 2026, è 0,22368 €/kWh"
# "PSV ... oggi, 15 settembre 2026, è 0,90572 €/Smc"
pun_match = re.search(
    r"PUN.*?oggi,\s*(\d{1,2}\s+[A-Za-zà]+\s+\d{4}),\s*è\s*([0-9]+(?:[.,][0-9]+)?)\s*€/kWh",
    text,
    re.I,
)
psv_match = re.search(
    r"PSV.*?oggi,\s*(\d{1,2}\s+[A-Za-zà]+\s+\d{4}),\s*è\s*([0-9]+(?:[.,][0-9]+)?)\s*€/Smc",
    text,
    re.I,
)

if not pun_match or not psv_match:
    raise RuntimeError("Impossibile leggere PUN/PSV dalla fonte A4Energie")

pun_date = parse_date(pun_match.group(1))
psv_date = parse_date(psv_match.group(1))
pun_value = to_float(pun_match.group(2))
psv_value = to_float(psv_match.group(2))

if not pun_date or not psv_date or pun_value is None or psv_value is None:
    raise RuntimeError("Dati PUN/PSV non validi")

# Mantiene lo storico già pubblicato e aggiunge il nuovo giorno.
try:
    with open(OUT, "r", encoding="utf-8") as f:
        previous = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    previous = {"history": []}

history_by_date = {
    row["date"]: row
    for row in previous.get("history", [])
    if isinstance(row, dict) and row.get("date")
}

current_row = {
    "date": pun_date,
    "pun": pun_value,
    "psv": psv_value if psv_date == pun_date else None,
}

# Se le fonti pubblicano PUN e PSV con date diverse, mantieni comunque entrambe.
history_by_date[pun_date] = current_row
if psv_date != pun_date:
    row = history_by_date.get(psv_date, {"date": psv_date, "pun": None, "psv": None})
    row["psv"] = psv_value
    history_by_date[psv_date] = row

history = sorted(history_by_date.values(), key=lambda x: x["date"], reverse=True)[:10]

pun_rows = [r for r in history if r.get("pun") is not None]
psv_rows = [r for r in history if r.get("psv") is not None]


def change(rows, key):
    if len(rows) < 2:
        return None
    return round((rows[0][key] / rows[1][key] - 1) * 100, 2)


out = {
    "updatedAt": max(pun_date, psv_date),
    "source": "GME / ARERA tramite A4Energie",
    "pun": {
        "value": pun_value,
        "unit": "€/kWh",
        "date": pun_date,
        "change": change(pun_rows, "pun"),
    },
    "psv": {
        "value": psv_value,
        "unit": "€/Smc",
        "date": psv_date,
        "change": change(psv_rows, "psv"),
    },
    "history": history,
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(json.dumps(out, ensure_ascii=False, indent=2))
