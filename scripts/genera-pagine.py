"""Genera tutte le pagine di navigazione del Drive TOP HOUSE con lo stesso design.

Uso:  python3 scripts/genera-pagine.py
Per aggiungere un gestore o una cartella modifica le liste qui sotto e rilancia lo script:
le pagine, i percorsi e la mappa usata dalla ricerca (data/mappa-cartelle.json) si aggiornano da soli.
"""
import html
import json
import os
import re

VERSION = "20261024e"  # cambia per forzare i browser a scaricare CSS/JS nuovi

# ----------------------------------------------------------------------------- struttura
GESTORI = [  # slug, nome visualizzato
    ("a2a", "A2A"), ("acea", "Acea"), ("alperia", "Alperia"), ("audax", "Audax"), ("cogeme", "Cogeme"),
    ("duferco", "Duferco"), ("enel", "Enel"), ("engie", "Engie"), ("gde", "GDE"), ("hera", "Hera"),
    ("iren", "Iren"), ("magix", "Magix"), ("onova", "Onova"), ("plenitude", "Plenitude"), ("s4", "S4"),
    ("simecom", "Simecom"), ("sorgenia", "Sorgenia"), ("stream", "Stream"), ("union", "Union"),
    ("unoenergy", "UnoEnergy"), ("vivienergia", "ViviEnergia"),
]
SOTTO_GESTORI = {"unoenergy", "vivienergia"}              # cartelle in documenti/gestori/<slug>
CTE_CON_TRATTINO = {"onova", "s4", "simecom", "sorgenia", "stream", "union"}  # cte-business invece di cte/business
SENZA_PRIVACY = {"onova", "plenitude", "s4", "union"}
CTE_LUCE_GAS = {"union"}                                   # CTE divise anche in luce e gas

ICONE = {
    "cte": "fa-file-invoice", "modulistica": "fa-file-signature", "procedimenti": "fa-list-check",
    "privacy": "fa-user-shield", "business": "fa-building", "residenziale": "fa-house",
    "luce": "fa-bolt", "gas": "fa-fire-flame-simple",
}

FOTOVOLTAICO = [
    ("schede-tecniche", "Schede tecniche", "fa-clipboard-list"),
    ("riunioni", "Riunioni", "fa-people-group"),
    ("reonic-preventivi-tutorial", "Reonic: tutorial preventivi", "fa-calculator"),
    ("formazione-base", "Formazione base", "fa-graduation-cap"),
    ("presentazione-base", "Presentazione base", "fa-display"),
    ("documenti-sopralluogo", "Documenti sopralluogo", "fa-ruler-combined"),
    ("documenti-finanziamento", "Documenti finanziamento", "fa-euro-sign"),
    ("documenti-contratto", "Documenti contratto", "fa-file-signature"),
    ("altro", "Altro", "fa-ellipsis"),
]
OPERATORI = [("FASTWEB", "Fastweb"), ("SKY", "Sky"), ("WIND", "WindTre"), ("TIM", "TIM"), ("VODAFONE", "Vodafone")]
TELEFONIA_SEZIONI = [
    ("OFFERTE/BUSINESS", "Offerte business", "fa-building"),
    ("OFFERTE/RESIDENZIALE", "Offerte residenziali", "fa-house"),
    ("PROCEDURE", "Procedure", "fa-list-check"),
    ("MODULISTICA", "Modulistica", "fa-file-signature"),
]
CATEGORIE_SEMPLICI = [  # una sola cartella, direttamente dalla home
    ("climatizzatore", "Climatizzatore", "fa-snowflake"), ("caldaia", "Caldaia", "fa-fire-burner"),
    ("depuratore", "Depuratore", "fa-droplet"), ("infissi", "Infissi", "fa-window-maximize"),
    ("allarmi", "Allarmi", "fa-shield-halved"), ("moduli", "Moduli", "fa-file-lines"),
]

# ----------------------------------------------------------------------------- mattoni
_MARK_D = re.search(r' d="([^"]+)"', open("logo-marchio.svg", encoding="utf-8").read()).group(1)
MARK_ART = (f'<svg class="th-mark-art" viewBox="0 0 251 197" aria-hidden="true"><path pathLength="1000" fill-rule="evenodd" d="{_MARK_D}"/>'
            f'<path class="th-mark-flow" pathLength="1000" d="{_MARK_D}"/><path class="th-mark-flow f2" pathLength="1000" d="{_MARK_D}"/></svg>')
# scintille: posizioni fisse ma "casuali" (stesso risultato a ogni generazione)
SPARKS = '<div class="th-sparks">' + "".join(
    f'<i style="--x:{(i * 37) % 100}%;--s:{3 + (i * 7) % 6}px;--t:{6 + (i * 5) % 7}s;--dl:{-((i * 1.3) % 9):.1f}s;--dx:{((i * 23) % 60) - 30}px"></i>'
    for i in range(18)) + '</div>'
MAPPA = {"folders": {}, "pages": []}
SCRITTE = []


def e(text):
    return html.escape(str(text), quote=True)


def base_for(path):
    return "../" * path.count("/")


def head(title, path, extra=""):
    b = base_for(path)
    return f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f2451f">
<title>{e(title)} | TOP HOUSE</title>
<link rel="icon" href="{b}logo-marchio.svg" type="image/svg+xml"><link rel="icon" href="{b}logo.png" type="image/png"><link rel="apple-touch-icon" href="{b}apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Instrument+Sans:wght@400..700&display=swap">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link rel="stylesheet" href="{b}tema.css?v={VERSION}">
<script src="{b}utenti-ruoli.js?v={VERSION}"></script>
<script type="module" src="{b}auth-guard.js?v={VERSION}"></script>{extra}
</head>
"""


def scripts(path):
    b = base_for(path)
    return f"""<script src="{b}pdf-tools.js?v={VERSION}"></script>
<script src="{b}layout.js?v={VERSION}"></script>
<script src="{b}drive.js?v={VERSION}"></script>
</body>
</html>
"""


def crumbs(path, trail):
    """trail: lista di (etichetta, url relativo alla radice); l'ultimo è la pagina corrente."""
    b = base_for(path)
    parts = [f'<a href="{b}index.html">Home</a>']
    for label, url in trail[:-1]:
        parts.append(f'<a href="{b}{url}">{e(label)}</a>')
    parts.append(f'<span aria-current="page">{e(trail[-1][0])}</span>')
    return '<nav class="th-crumbs" aria-label="Percorso">' + "".join(parts) + "</nav>"


def title_block(path, trail, lede=""):
    out = crumbs(path, trail) + f'\n<h1 class="th-title">{e(trail[-1][0])}</h1>\n'
    if lede:
        out += f'<p class="th-lede">{lede}</p>\n'
    return out + '<div class="th-cable" aria-hidden="true"></div>\n'


def write(path, content):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    SCRITTE.append(path)


def folder_page(path, trail, folder):
    """Pagina cartella: elenco documenti + strumenti admin."""
    names = [t[0] for t in trail]
    MAPPA["folders"][folder] = {"url": path, "path": names}
    MAPPA["pages"].append({"url": path, "path": names})
    label = trail[-1][0]
    write(path, head(" · ".join(names[1:] or names), path) + f"""<body>
<main class="th-page" id="main">
{title_block(path, trail)}<section data-folder-view data-folder="{e(folder)}" data-label="{e(label)}" data-crumbs="{e(' › '.join(names))}"></section>
</main>
{scripts(path)}""")
    return [folder]


def row(href, label, icon, folders):
    return (f'<li><a class="th-row" href="{e(href)}"><span class="th-row-icon"><i class="fa-solid {icon}" aria-hidden="true"></i></span>'
            f'<span class="th-row-label">{e(label)}</span><span class="th-row-meta" data-count-folders="{e(" ".join(folders))}"></span>'
            f'<i class="fa-solid fa-chevron-right th-row-go" aria-hidden="true"></i></a></li>')


def hub_page(path, trail, rows, lede=""):
    """rows: lista di (url_relativo_alla_pagina, etichetta, icona, cartelle)."""
    names = [t[0] for t in trail]
    MAPPA["pages"].append({"url": path, "path": names})
    items = "\n".join(row(*r) for r in rows)
    write(path, head(" · ".join(names), path) + f"""<body>
<main class="th-page" id="main">
{title_block(path, trail, lede)}<ul class="th-list">
{items}
</ul>
</main>
{scripts(path)}""")


# ----------------------------------------------------------------------------- luce e gas
def gestore_folder(slug, section):
    base = f"documenti/gestori/{slug}" if slug in SOTTO_GESTORI else f"documenti/{slug}"
    if section.startswith("cte-") and slug not in CTE_CON_TRATTINO:
        section = "cte/" + section[4:]
    return f"{base}/{section}"


tutte_lucegas = []
tiles = []
for slug, name in GESTORI:
    g_url = f"gestori/{slug}.html"
    t_root = [("Luce e gas", "luce-gas.html"), (name, g_url)]
    # CTE
    cte_rows, cte_folders = [], []
    for seg in ("business", "residenziale"):
        seg_label = seg.capitalize()
        seg_url = f"gestori/{slug}-cte-{seg}.html"
        if slug in CTE_LUCE_GAS:
            sub_rows, sub_folders = [], []
            for com in ("luce", "gas"):
                f = gestore_folder(slug, f"cte-{seg}-{com}")
                folder_page(f"gestori/{slug}-cte-{seg}-{com}.html", t_root + [("CTE", f"gestori/{slug}-cte.html"), (seg_label, seg_url), (com.capitalize(), "")], f)
                sub_rows.append((f"{slug}-cte-{seg}-{com}.html", com.capitalize(), ICONE[com], [f]))
                sub_folders.append(f)
            hub_page(seg_url, t_root + [("CTE", f"gestori/{slug}-cte.html"), (seg_label, "")], sub_rows)
            cte_rows.append((f"{slug}-cte-{seg}.html", seg_label, ICONE[seg], sub_folders))
            cte_folders += sub_folders
        else:
            f = gestore_folder(slug, f"cte-{seg}")
            folder_page(seg_url, t_root + [("CTE", f"gestori/{slug}-cte.html"), (seg_label, "")], f)
            cte_rows.append((f"{slug}-cte-{seg}.html", seg_label, ICONE[seg], [f]))
            cte_folders.append(f)
    hub_page(f"gestori/{slug}-cte.html", t_root + [("CTE", "")], cte_rows)
    rows = [(f"{slug}-cte.html", "CTE", ICONE["cte"], cte_folders)]
    all_folders = list(cte_folders)
    for sec, label in (("modulistica", "Modulistica"), ("procedimenti", "Procedimenti"), ("privacy", "Privacy")):
        if sec == "privacy" and slug in SENZA_PRIVACY:
            continue
        f = gestore_folder(slug, sec)
        folder_page(f"gestori/{slug}-{sec}.html", t_root + [(label, "")], f)
        rows.append((f"{slug}-{sec}.html", label, ICONE[sec], [f]))
        all_folders.append(f)
    hub_page(g_url, [("Luce e gas", "luce-gas.html"), (name, "")], rows)
    tutte_lucegas += all_folders
    tiles.append((slug, name, all_folders))

MAPPA["pages"].append({"url": "luce-gas.html", "path": ["Luce e gas"]})
tile_html = "\n".join(
    f'<a class="th-tile" href="gestori/{s}.html" data-name="{e(n)}"><b>{e(n)}</b><small data-count-folders="{e(" ".join(fs))}"></small></a>'
    for s, n, fs in tiles)
write("luce-gas.html", head("Luce e gas", "luce-gas.html") + f"""<body>
<main class="th-page" id="main">
{title_block("luce-gas.html", [("Luce e gas", "")], f"{len(GESTORI)} gestori: CTE, modulistica, procedimenti e privacy sempre aggiornati.")}<div class="th-callout">
  <p><strong>Non sai quale gestore proporre?</strong>Rispondi a poche domande sulla pratica e ti mostriamo i gestori compatibili.</p>
  <a class="th-btn" href="trova-gestore.html"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Trova il gestore</a>
</div>
<div class="th-filter"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" placeholder="Cerca un gestore" aria-label="Cerca un gestore" data-filter-target="gestoriGrid" data-filter-empty="gestoriVuoto"></div>
<div class="th-tiles" id="gestoriGrid">
{tile_html}
</div>
<p class="th-empty" id="gestoriVuoto" hidden><b>Nessun gestore con questo nome</b>Controlla come l'hai scritto.</p>
</main>
{scripts("luce-gas.html")}""")

# ----------------------------------------------------------------------------- fotovoltaico, pompe di calore, wall box
def simple_hub(slug, name, sections, lede=""):
    rows, folders = [], []
    for sec, label, icon in sections:
        f = f"documenti/{slug}/{sec}"
        folder_page(f"{slug}-{sec}.html", [(name, f"{slug}.html"), (label, "")], f)
        rows.append((f"{slug}-{sec}.html", label, icon, [f]))
        folders.append(f)
    hub_page(f"{slug}.html", [(name, "")], rows, lede)
    return folders


fv_folders = simple_hub("fotovoltaico", "Fotovoltaico", FOTOVOLTAICO, "Schede, presentazioni, tutorial e documenti per ogni fase della pratica.")
pdc_folders = simple_hub("pompe-di-calore", "Pompe di calore", [("schede-tecniche", "Schede tecniche", "fa-clipboard-list")])
wb_folders = simple_hub("wall-box", "Wall box", [("schede-tecniche", "Schede tecniche", "fa-clipboard-list")])

# ----------------------------------------------------------------------------- telefonia
tel_groups, tel_folders = [], []
MAPPA["pages"].append({"url": "telefonia.html", "path": ["Telefonia"]})
for code, name in OPERATORI:
    rows = []
    for sec, label, icon in TELEFONIA_SEZIONI:
        f = f"telefonia/{code}/{sec}"
        url = f"telefonia-{code.lower()}-{sec.lower().replace('/', '-')}.html"
        folder_page(url, [("Telefonia", "telefonia.html"), (name, f"telefonia.html#{code.lower()}"), (label, "")], f)
        rows.append(row(url, label, icon, [f]))
        tel_folders.append(f)
    tel_groups.append(f'<h2 class="th-group-title" id="{code.lower()}">{e(name)}</h2>\n<ul class="th-list">\n' + "\n".join(rows) + "\n</ul>")
write("telefonia.html", head("Telefonia", "telefonia.html") + f"""<body>
<main class="th-page" id="main">
{title_block("telefonia.html", [("Telefonia", "")], "Offerte, procedure e modulistica per ogni operatore.")}{chr(10).join(tel_groups)}
</main>
{scripts("telefonia.html")}""")

# ----------------------------------------------------------------------------- categorie semplici
cat_folders = {}
for slug, name, icon in CATEGORIE_SEMPLICI:
    cat_folders[slug] = folder_page(f"{slug}.html", [(name, "")], f"documenti/{slug}")

# ----------------------------------------------------------------------------- home
def sec(href, label, icon, folders=None, small="", cls=""):
    count = f' data-count-folders="{e(" ".join(folders))}"' if folders else ""
    return (f'<a class="th-sec{cls}" href="{href}"><i class="fa-solid {icon}" aria-hidden="true"></i>'
            f'<b>{e(label)}</b><small{count}>{e(small)}</small></a>')


sections = [
    f'<a class="th-sec th-sec--big" href="luce-gas.html"><i class="fa-solid fa-bolt" aria-hidden="true"></i><b>Luce e gas</b><small>{len(GESTORI)} gestori</small></a>',
    sec("fotovoltaico.html", "Fotovoltaico", "fa-solar-panel", fv_folders, cls=" th-sec--big"),
    sec("telefonia.html", "Telefonia", "fa-phone", small=f"{len(OPERATORI)} operatori"),
    sec("pompe-di-calore.html", "Pompe di calore", "fa-fan", pdc_folders),
    sec("wall-box.html", "Wall box", "fa-charging-station", wb_folders),
] + [sec(f"{s}.html", n, i, cat_folders[s]) for s, n, i in CATEGORIE_SEMPLICI] + [
    sec("trova-gestore.html", "Trova il gestore", "fa-wand-magic-sparkles", small="Il gestore giusto per la pratica", cls=" th-sec--accent"),
    sec("formazione.html", "Formazione", "fa-graduation-cap", small="Academy, glossario e assistente", cls=" th-sec--accent"),
    sec("archivio.html", "Preferiti", "fa-star", small="I documenti che hai salvato"),
]

gauge = lambda key, name, icon, i: f"""<article class="th-gauge" data-gauge="{key}" style="--i:{i}">
  <span class="th-gauge-name"><i class="fa-solid {icon}" aria-hidden="true"></i>{name}</span>
  <span class="th-gauge-value">…</span><span class="th-gauge-change"></span>
  <svg class="th-spark" role="img" aria-label="Andamento"></svg>
  <span class="th-gauge-foot">Caricamento…</span>
</article>"""

write("index.html", head("Home", "index.html") + f"""<body class="th-home">
<section class="th-hero">
  <div class="th-hero-bg" aria-hidden="true"><div class="th-hero-grid"></div><div class="th-hero-glow"></div><div class="th-hero-glow th-hero-glow--2"></div>{SPARKS}{MARK_ART}</div>
  <div class="th-hero-in">
    <h1 class="th-rise">Cosa ti serve per il prossimo cliente?</h1>
    <div class="th-search th-rise" style="--d:120ms" role="search">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <label class="th-sr" for="cerca">Cerca nel Drive</label>
      <input id="cerca" type="search" autocomplete="off" placeholder="Cerca un documento o un gestore, es. enel cte business">
      <ul class="th-results" id="cercaRisultati" hidden></ul>
    </div>
    <div class="th-cable th-hero-cable" aria-hidden="true"></div>
  </div>
</section>
<main class="th-page" id="main">
<section class="th-meter" aria-label="Indici energetici">
{gauge("pun", "PUN · prezzo luce all'ingrosso", "fa-bolt", 0)}
{gauge("psv", "PSV · prezzo gas all'ingrosso", "fa-fire-flame-simple", 1)}
</section>
<h2 class="th-section-title">Sezioni</h2>
<nav class="th-sections" aria-label="Sezioni del Drive">
{chr(10).join(x.replace('class="th-sec', f'style="--i:{i}" class="th-sec', 1) for i, x in enumerate(sections))}
</nav>
</main>
{scripts("index.html")}""")

# ----------------------------------------------------------------------------- preferiti
write("archivio.html", head("Preferiti", "archivio.html") + f"""<body>
<main class="th-page" id="main">
{title_block("archivio.html", [("Preferiti", "")], "I documenti salvati con la stellina, su questo dispositivo.")}<div class="th-folder-head"><div class="th-filter"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input id="archiveSearch" type="search" placeholder="Cerca nei preferiti" aria-label="Cerca nei preferiti"></div><span class="th-count" id="archiveCount"></span></div>
<ul class="th-files" id="archiveList"></ul>
</main>
<script src="pdf-tools.js?v={VERSION}"></script>
<script src="layout.js?v={VERSION}"></script>
<script src="drive.js?v={VERSION}"></script>
<script>
(function () {{
  const list = document.getElementById('archiveList');
  const search = document.getElementById('archiveSearch');
  const count = document.getElementById('archiveCount');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}}[c]));
  const when = v => {{ try {{ return new Intl.DateTimeFormat('it-IT', {{ dateStyle: 'medium' }}).format(new Date(v)); }} catch (e) {{ return ''; }} }};
  function render() {{
    const all = TOPHOUSE_PDF.getFavorites();
    const q = search.value.trim().toLowerCase();
    const items = all.filter(p => [p.name, p.manager, p.section].join(' ').toLowerCase().includes(q));
    count.textContent = all.length ? (all.length === 1 ? '1 documento' : all.length + ' documenti') : '';
    if (!all.length) {{ list.innerHTML = '<li class="th-empty"><i class="fa-regular fa-star"></i><b>Ancora nessun preferito</b>Tocca la stellina accanto a un documento per ritrovarlo qui.</li>'; return; }}
    if (!items.length) {{ list.innerHTML = '<li class="th-empty"><b>Nessun preferito trovato</b>Prova con un\\'altra parola.</li>'; return; }}
    list.innerHTML = '';
    items.forEach(pdf => {{
      const t = TOPHOUSE_GH.fileType(pdf.type === 'video-link' ? 'video-x.json' : (pdf.name || ''));
      const name = pdf.type === 'video-link' ? pdf.name : TOPHOUSE_GH.cleanName(pdf.name);
      const li = document.createElement('li');
      li.className = 'th-file';
      li.innerHTML = `<span class="th-file-type ${{t.cls}}">${{t.label}}</span>
        <button type="button" class="th-file-main"><span class="th-file-name">${{esc(name)}}</span><span class="th-file-meta">${{esc([pdf.manager, pdf.section].filter(Boolean).join(' › '))}} · salvato il ${{esc(when(pdf.savedAt))}}</span></button>
        <span class="th-file-actions"><a class="th-icon-btn" href="${{esc(TOPHOUSE_PDF.normalizePdf(pdf).downloadUrl)}}" target="_blank" rel="noopener" title="Apri o scarica"><i class="fa-solid fa-download"></i></a>
        <button type="button" class="th-icon-btn is-on" title="Togli dai preferiti"><i class="fa-solid fa-star"></i></button></span>`;
      li.querySelector('.th-file-main').addEventListener('click', () => pdf.type === 'video-link' ? window.open(pdf.url, '_blank', 'noopener') : TOPHOUSE_PDF.openPreview(pdf));
      li.querySelector('.is-on').addEventListener('click', () => {{ li.classList.add('is-leaving'); setTimeout(() => {{ TOPHOUSE_PDF.removeFavorite(pdf); render(); }}, 300); }});
      list.appendChild(li);
    }});
  }}
  search.addEventListener('input', render);
  render();
}})();
</script>
</body>
</html>
""")

# ----------------------------------------------------------------------------- gestione file (admin)
write("admin-caricamento.html", head("Gestione file", "admin-caricamento.html").replace('<html lang="it">', '<html lang="it" data-admin-only="true">') + f"""<body>
<main class="th-page" id="main">
{title_block("admin-caricamento.html", [("Gestione file", "")], "Scegli una cartella, poi trascina i PDF nuovi: il Drive riconosce le versioni vecchie e le sostituisce in un solo passaggio.")}<label class="th-field" style="max-width:560px"><span>Cartella</span><select id="thFolderPick"><option>Caricamento…</option></select></label>
<p><a class="th-link" id="thFolderLink" style="text-align:left;display:inline" hidden>Apri la pagina della cartella</a></p>
<section data-folder-view id="thAdminFolder" hidden></section>
</main>
{scripts("admin-caricamento.html")}""")

# ----------------------------------------------------------------------------- login, accesso negato, 404
solo_head = lambda title: head(title, "x.html").replace(f'<script src="utenti-ruoli.js?v={VERSION}"></script>\n<script type="module" src="auth-guard.js?v={VERSION}"></script>', "")
auth_scripts = f'<script src="utenti-ruoli.js?v={VERSION}"></script>\n<script type="module" src="auth-guard.js?v={VERSION}"></script>'
brand = '<img class="th-logo" src="logo.svg" alt="TOP HOUSE - casa. energia. fiducia." width="221" height="44">'
glow = f'<div class="th-hero-bg" aria-hidden="true"><div class="th-hero-grid"></div><div class="th-hero-glow"></div><div class="th-hero-glow th-hero-glow--2"></div>{SPARKS}{MARK_ART}</div>'

write("login.html", solo_head("Accedi").replace("</head>", auth_scripts + "\n</head>") + f"""<body class="th-solo">
{glow}
<main class="th-solo-card">
  {brand}
  <h1>Accedi al Drive</h1>
  <div class="th-cable" aria-hidden="true"></div>
  <form id="loginForm">
    <label class="th-field"><span>Email</span><input id="email" type="email" autocomplete="email" required></label>
    <label class="th-field"><span>Password</span><input id="password" type="password" autocomplete="current-password" required></label>
    <button class="th-btn" type="submit"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> Accedi</button>
    <a class="th-link" id="forgotPasswordLink" href="#">Password dimenticata?</a>
    <div id="loginMessage" class="th-msg" aria-live="polite"></div>
  </form>
</main>
<script type="module">window.TOPHOUSE_AUTH.initLoginForm();</script>
</body>
</html>
""")

write("accesso-negato.html", solo_head("Accesso riservato").replace("</head>", auth_scripts + "\n</head>") + f"""<body class="th-solo">
{glow}
<main class="th-solo-card">
  {brand}
  <h1>Accesso riservato</h1>
  <div class="th-cable" aria-hidden="true"></div>
  <p>Questo account non è abilitato a questa sezione. Se pensi sia un errore, scrivi all'amministrazione TOP HOUSE.</p>
  <a class="th-btn" href="index.html"><i class="fa-solid fa-house" aria-hidden="true"></i> Torna alla home</a>
  <button class="th-btn th-btn--ghost" id="logoutButton" type="button" style="margin-top:10px;width:100%"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Esci e cambia account</button>
</main>
<script type="module">window.TOPHOUSE_AUTH.bindLogout();</script>
</body>
</html>
""")

notfound = solo_head("Pagina non trovata").replace('href="logo', 'href="/TOP-HOUSE/logo').replace('href="apple-touch', 'href="/TOP-HOUSE/apple-touch').replace('href="tema.css', 'href="/TOP-HOUSE/tema.css')
write("404.html", notfound + f"""<body class="th-solo">
{glow}
<main class="th-solo-card">
  <a href="/TOP-HOUSE/" id="nfBrand"><img class="th-logo" src="/TOP-HOUSE/logo.svg" alt="TOP HOUSE" width="221" height="44" id="nfLogo"></a>
  <h1>Pagina non trovata</h1>
  <div class="th-cable" aria-hidden="true"></div>
  <p>Questo indirizzo non esiste o la pagina è stata spostata. Dalla home trovi tutti i documenti con la ricerca.</p>
  <a class="th-btn" href="/TOP-HOUSE/" id="nfHome"><i class="fa-solid fa-house" aria-hidden="true"></i> Vai alla home</a>
</main>
<script>
// GitHub Pages mostra questa pagina per qualsiasi indirizzo: i percorsi partono dalla radice del sito.
(function () {{
  const m = window.location.pathname.match(/^\\/top-house\\//i);
  const root = m ? m[0] : '/';
  document.getElementById('nfHome').href = root;
  document.getElementById('nfBrand').href = root;
  document.getElementById('nfLogo').src = root + 'logo.svg';
}})();
</script>
</body>
</html>
""")

# ----------------------------------------------------------------------------- mappa per la ricerca
with open("data/mappa-cartelle.json", "w", encoding="utf-8") as f:
    json.dump(MAPPA, f, ensure_ascii=False, indent=1)
    f.write("\n")

print(f"{len(SCRITTE)} pagine generate, {len(MAPPA['folders'])} cartelle")
