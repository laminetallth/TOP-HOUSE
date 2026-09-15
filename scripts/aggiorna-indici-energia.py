import json
import re
from datetime import date
from urllib.request import Request, urlopen

URL = "https://www.swapy.it/pun-psv.php"
OUT = "data/indici-energia.json"

MONTHS = {
    "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4,
    "maggio": 5, "giugno": 6, "luglio": 7, "agosto": 8,
    "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
}


def to_float(value):
    """Converte sia 0.216 sia 0,216 senza trasformare i decimali in 216."""
    if value is None:
        return None
    cleaned = value.strip()
    if cleaned in {"", "—", "-"}:
        return None

    # Rimuove eventuali simboli/unità lasciando cifre, punto, virgola e segno.
    cleaned = re.sub(r"[^0-9,.+-]", "", cleaned)
    if not cleaned:
        return None

    # Se sono presenti entrambi, l'ultimo separatore è quello decimale.
    if "." in cleaned and "," in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")

    return float(cleaned)


def parse_date(value):
    m = re.search(r"(\d{1,2})\s+([A-Za-zà]+)\s+(\d{4})", value.strip(), re.I)
    if not m:
        return None
    month = MONTHS.get(m.group(2).lower())
    if not month:
        return None
    return f"{m.group(3)}-{month:02d}-{int(m.group(1)):02d}"


req = Request(URL, headers={"User-Agent": "TOP-HOUSE energy updater/1.1"})
html = urlopen(req, timeout=30).read().decode("utf-8", "replace")
text = re.sub(r"<[^>]+>", " ", html)
text = re.sub(r"\s+", " ", text)

# La pagina pubblica una tabella recente: Data | PUN €/kWh | PSV €/Smc.
pattern = re.compile(
    r"(\d{1,2}\s+[A-Za-zà]+\s+\d{4})\s*\|?\s*"
    r"([0-9]+(?:[.,][0-9]+)?)\s*\|?\s*"
    r"([0-9]+(?:[.,][0-9]+)?|—|-)", re.I
)
rows = []
for m in pattern.finditer(text):
    d = parse_date(m.group(1))
    if d:
        rows.append({"date": d, "pun": to_float(m.group(2)), "psv": to_float(m.group(3))})

# Fallback: parse direttamente le righe HTML della tabella.
if len(rows) < 2:
    row_re = re.compile(
        r"<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>",
        re.I | re.S,
    )
    rows = []
    for m in row_re.finditer(html):
        cells = [re.sub(r"<[^>]+>", " ", x) for x in m.groups()]
        cells = [re.sub(r"\s+", " ", x).strip() for x in cells]
        d = parse_date(cells[0])
        if d:
            rows.append({
                "date": d,
                "pun": to_float(cells[1]),
                "psv": to_float(cells[2]),
            })

# Mantieni una sola riga per giorno, dalla più recente alla più vecchia.
unique = {}
for row in rows:
    unique[row["date"]] = row
history = sorted(unique.values(), key=lambda x: x["date"], reverse=True)[:10]

if not history:
    raise RuntimeError("Nessun dato PUN/PSV trovato nella pagina sorgente")

pun_rows = [r for r in history if r["pun"] is not None]
psv_rows = [r for r in history if r["psv"] is not None]
if not pun_rows or not psv_rows:
    raise RuntimeError("Dati PUN o PSV incompleti")

pun = pun_rows[0]
psv = psv_rows[0]


def change(rows, key):
    if len(rows) < 2 or rows[1][key] is None:
        return None
    return round((rows[0][key] / rows[1][key] - 1) * 100, 2)


out = {
    "updatedAt": date.today().isoformat(),
    "source": "GME tramite Swapy",
    "pun": {
        "value": pun["pun"],
        "unit": "€/kWh",
        "date": pun["date"],
        "change": change(pun_rows, "pun"),
    },
    "psv": {
        "value": psv["psv"],
        "unit": "€/Smc",
        "date": psv["date"],
        "change": change(psv_rows, "psv"),
    },
    "history": history,
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(json.dumps(out, ensure_ascii=False, indent=2))
