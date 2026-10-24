"""Genera data/documenti-index.json: l'elenco dei file di ogni cartella del Drive.

Le pagine del portale leggono questo indice invece di interrogare GitHub con un
token, così nessun token deve stare nel codice pubblico.
Usa `git ls-tree`, quindi funziona anche con un checkout senza i file (veloce).
"""
import json
import subprocess

ROOTS = ["documenti", "telefonia"]
OUT = "data/documenti-index.json"
IGNORE = {".gitkeep", ".DS_Store"}

listing = subprocess.run(
    ["git", "ls-tree", "-r", "-l", "-z", "HEAD", "--", *ROOTS],
    check=True, capture_output=True,
).stdout.decode("utf-8")

folders = {}
for entry in filter(None, listing.split("\0")):
    meta, path = entry.split("\t", 1)
    _mode, kind, _sha, size = meta.split()
    if kind != "blob":
        continue
    folder, _, name = path.rpartition("/")
    if not folder or name in IGNORE:
        continue
    folders.setdefault(folder, []).append({"name": name, "size": int(size) if size.isdigit() else None})

# I link video sono piccoli file JSON: titolo e indirizzo vanno nell'indice,
# così il portale li mostra subito senza scaricarli uno per uno.
for folder, files in folders.items():
    for item in files:
        if item["name"].lower().startswith("video-") and item["name"].lower().endswith(".json"):
            try:
                raw = subprocess.run(["git", "show", f"HEAD:{folder}/{item['name']}"], check=True, capture_output=True).stdout
                data = json.loads(raw.decode("utf-8"))
                item["title"] = str(data.get("title") or "")[:200]
                item["url"] = str(data.get("url") or "")[:500]
            except (subprocess.CalledProcessError, ValueError):
                pass

for files in folders.values():
    files.sort(key=lambda item: item["name"].lower())

# Nessuna data nel file: così cambia (e viene committato) solo quando cambiano i documenti.
out = {"folders": dict(sorted(folders.items()))}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
    f.write("\n")

print(f"{sum(len(v) for v in folders.values())} file in {len(folders)} cartelle")
