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
    if value is None or value.strip() in {"", "—", "-"}:
        return None
    return float(value.strip().replace(".", "").replace(",", "."))

def parse_date(value):
    m = re.search(r"(\d{1,2})\s+([A-Za-zà]+)\s+(\d{4})", value.strip(), re.I)
    if not m:
        return None
    return f"{m.group(3)}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"

req = Request(URL, headers={"User-Agent": "TOP-HOUSE energy updater/1.0"})
html = urlopen(req, timeout=30).read().decode("utf-8", "replace")
text = re.sub(r"<[^>]+>", " ", html)
text = re.sub(r"\s+", " ", text)

# The page publishes a recent-history table with: Date | PUN €/kWh | PSV €/Smc.
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

# Fallback: parse the table rows from HTML when pipes are not present in source.
if len(rows) < 2:
    row_re = re.compile(r"<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>", re.I | re.S)
    rows = []
    for m in row_re.finditer(html):
        cells = [re.sub(r"<[^>]+>", " ", x) for x in m.groups()]
        cells = [re.sub(r"\s+", " ", x).strip() for x in cells]
        d = parse_date(cells[0])
        if d:
            rows.append({"date": d, "pun": to_float(re.sub(r"[^0-9,. -]", "", cells[1])), "psv": to_float(re.sub(r"[^0-9,. -]", "", cells[2]))})

# Keep one row per day, newest first.
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

def change(rows):
    if len(rows) < 2 or rows[1]["pun"] is None:
        return None
    return round((rows[0]["pun"] / rows[1]["pun"] - 1) * 100, 2)

def change_psv(rows):
    if len(rows) < 2 or rows[1]["psv"] is None:
        return None
    return round((rows[0]["psv"] / rows[1]["psv"] - 1) * 100, 2)

out = {
    "updatedAt": date.today().isoformat(),
    "source": "GME tramite Swapy",
    "pun": {"value": pun["pun"], "unit": "€/kWh", "date": pun["date"], "change": change(pun_rows)},
    "psv": {"value": psv["psv"], "unit": "€/Smc", "date": psv["date"], "change": change_psv(psv_rows)},
    "history": history,
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(json.dumps(out, ensure_ascii=False, indent=2))
