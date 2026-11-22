import json
import re
import sys
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


MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
        "agosto", "settembre", "ottobre", "novembre", "dicembre"]


def fetch_text(url):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; TOP-HOUSE energy updater/2.1)"})
    html = urlopen(req, timeout=30).read().decode("utf-8", "replace")
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))


def from_a4energie():
    text = fetch_text(URL)
    # "PUN ... oggi, 15 settembre 2026, è 0,22368 €/kWh" / "PSV ... è 0,90572 €/Smc"
    pm = re.search(r"PUN.*?oggi,\s*(\d{1,2}\s+[A-Za-zà]+\s+\d{4}),\s*è\s*([0-9]+(?:[.,][0-9]+)?)\s*€/kWh", text, re.I)
    sm = re.search(r"PSV.*?oggi,\s*(\d{1,2}\s+[A-Za-zà]+\s+\d{4}),\s*è\s*([0-9]+(?:[.,][0-9]+)?)\s*€/Smc", text, re.I)
    if not pm or not sm:
        i = text.find("PUN")
        print("A4Energie: formato pagina non riconosciuto. Estratto: " + text[max(i, 0):max(i, 0) + 400], file=sys.stderr)
        return None
    return parse_date(pm.group(1)), to_float(pm.group(2)), parse_date(sm.group(1)), to_float(sm.group(2))


def from_abbassalebollette():
    # Fonte di riserva (valori GME): "PUN a 0,20866 €/kWh (-11,15%) e PSV a 0,8987 €/Smc (-1,51%) il 18 novembre 2026"
    # La pagina del giorno esce a giornata inoltrata: se non c'è ancora, prova i giorni precedenti.
    from datetime import timedelta
    for back in range(0, 4):
        d = date.today() - timedelta(days=back)
        url = ("https://www.abbassalebollette.it/mercati-prezzi/pun-e-psv-oggi-prezzi-luce-e-gas-aggiornati-al-"
               f"{d.day}-{MESI[d.month - 1]}-{d.year}/")
        try:
            text = fetch_text(url)
        except Exception as exc:
            print(f"abbassalebollette {d.isoformat()}: {exc}", file=sys.stderr)
            continue
        m = re.search(r"PUN a\s*([0-9]+[.,][0-9]+)\s*€/kWh.*?PSV a\s*([0-9]+[.,][0-9]+)\s*€/Smc\D+?(\d{1,2}\s+[A-Za-zà]+\s+\d{4})", text, re.I)
        if m:
            day = parse_date(m.group(3))
            return day, to_float(m.group(1)), day, to_float(m.group(2))
    return None


if len(sys.argv) == 4:
    # Uso manuale: aggiorna-indici-energia.py AAAA-MM-GG PUN PSV
    pun_date = psv_date = sys.argv[1]
    pun_value, psv_value = to_float(sys.argv[2]), to_float(sys.argv[3])
else:
    result = None
    for source in (from_a4energie, from_abbassalebollette):
        try:
            result = source()
        except Exception as exc:  # fonte irraggiungibile: prova la successiva
            print(f"Fonte {source.__name__} non disponibile: {exc}", file=sys.stderr)
            result = None
        if result:
            break
    if not result:
        raise RuntimeError("Impossibile leggere PUN/PSV dalle fonti")
    pun_date, pun_value, psv_date, psv_value = result

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

history = sorted(history_by_date.values(), key=lambda x: x["date"], reverse=True)[:730]  # due anni di storico per la pagina "PUN e PSV"

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
