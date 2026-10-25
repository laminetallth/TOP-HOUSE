"""Ricava da una CTE: tipo di prezzo (fisso/variabile), prezzo fisso o spread, CCV annua.
Usato da genera-scadenze-cte.py. Regole prudenti: se un valore non è chiaro non lo scrive.
"""
import re
import unicodedata

NUM = r"(\d{1,4}(?:[.,]\d{1,6})?)"
EUR = r"(?:€|euro|eur)"
U_EN = r"(?:€|euro|eur)\s*/\s*kwh"
U_GAS = r"(?:€|euro|eur)\s*/\s*s?m(?:c|3|³)"

VAR_NOME = re.compile(r"FLEX|VARIAB|DINAMIC|INDEX|INDICIZ|\bPUN|PSV|TREND|BORSA|SPREAD|_VAR|VAR_|\bVAR\b|MERCATO|INSIEME|ORARIA|FLUTTU", re.I)
FIX_NOME = re.compile(r"FIX|FISS|SERENO|BLOCCAT|STABILE|PREZZO\s*CERTO|TUTTO\s*INCLUSO|CERTA|SICURA|SMART\s*FIX", re.I)


def num(s):
    s = s.strip()
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def pulisci(txt):
    txt = unicodedata.normalize("NFC", txt).replace("’", "'").replace("\xa0", " ")
    txt = re.sub(r"[ \t]+", " ", txt)
    return txt


def fornitura(nome, txt):
    n = nome.upper()
    luce = bool(re.search(r"LUCE|\bEE\b|_EE_|ENERGIA[ _]ELETTRICA|POWER|\bELE\b|ELETTRIC", n))
    gas = bool(re.search(r"GAS|\bSMC\b", n))
    if luce == gas:  # nome ambiguo: conto le unità nel testo
        kwh, smc = len(re.findall(r"kwh", txt, re.I)), len(re.findall(r"\bsmc\b|sm3", txt, re.I))
        if kwh or smc:
            luce, gas = kwh >= smc, smc > kwh
    return "gas" if gas and not luce else "luce" if luce and not gas else None


def ccv(txt):
    """Quota fissa di commercializzazione, riportata a €/anno."""
    chiave = r"(?:commercializzazion\w*|\bccv\b|\bqcv\b|\bpcv\b|quota\s+fissa|costo\s+fisso|corrispettivo\s+(?:fisso|annuo)|servizio\s+commerciale|oneri\s+di\s+commercializzazione|corrispettivo\s+di\s+vendita)"
    pat = re.compile(chiave + r"[^\n€]{0,90}?" + NUM + r"\s*" + EUR + r"\s*(?:/|al|\s)\s*(?:(?:pod|pdr|punto[^/\n]{0,30}|cliente|fornitura)\s*/\s*)?(anno|mese|giorno|annui|mensil\w*)", re.I)
    for m in pat.finditer(txt):
        riga = txt[max(0, m.start() - 60):m.end() + 20].lower()
        if re.search(r"distribuz|trasport|oneri di sistema|misura|disalimentaz|morosit|sconto|bonus|cauzion|deposito", riga):
            continue
        v = num(m.group(1))
        per = m.group(2).lower()
        if v is None:
            continue
        anno = v * 12 if per.startswith("mes") else v * 365 if per.startswith("giorn") else v
        if 0 < anno <= 1500:
            return round(anno, 2), " ".join(m.group(0).split())[:120]
    return None


def spread(txt, forn):
    u = U_EN if forn == "luce" else U_GAS
    lo, hi = (0.0, 0.12) if forn == "luce" else (0.0, 0.45)
    pats = [
        r"(?:PUN|PSV)[^\n]{0,45}?\+\s*(?:[αa]|alfa|alpha|spread|fee|\(?\s*1\s*\+[^)]*\)\s*)?\s*[:=]?\s*\(?\s*" + NUM + r"\s*" + u,
        r"(?:spread|\bfee\b|parametro\s*(?:[αa]|alfa)|α\s*[:=]|alfa\s*[:=]|contributo al consumo|maggiorazione|non coperti dal (?:pun|psv)[^\n€]{0,25}|corrispettivo\s+(?:a copertura|di approvvigionamento))[^\n€]{0,45}?" + NUM + r"\s*" + u,
        r"(?:PUN|PSV)[^\n+]{0,30}?\+\s*" + NUM + r"(?!\s*%)(?!\s*\d)",  # tabelle: "PUN Index GME F1 + 0,01100"
        r"(?:^|\n)\s*(?:α|alfa)\s*\d?\s*[:=]?\s*" + NUM + r"\s*(?:\n|$)",  # tabelle: "α1 0.01056"
        NUM + r"\s*\+\s*(?:PUN|PSV)\b",  # "0,15 + PSV"
    ]
    for p in pats:
        for m in re.finditer(p, txt, re.I):
            riga = (txt[max(0, m.start() - 50):m.start()] + m.group(0)).lower()
            if re.search(r"valore massimo|opzione|verde|green|last call|premio|sbilanciament|dispacciament|perdite di rete pari|capacit|aggregazion|dal 13|a partire dal|decorso|scadenza|rinnovo|stato pari", riga):
                continue
            v = num(m.group(1))
            if v is not None and lo <= v <= hi:
                return v, " ".join(m.group(0).split())[:120]
    return None


def prezzo_fisso(txt, forn):
    u = U_EN if forn == "luce" else U_GAS
    lo, hi = (0.04, 0.45) if forn == "luce" else (0.15, 1.6)
    chiave = (r"(?:prezzo\s+(?:fisso|bloccato|energia|materia|luce|gas|monorario|unico|della\s+(?:componente|materia))"
              r"|componente\s+(?:energia|materia|gas|luce)|corrispettivo\s+(?:energia|materia|gas|luce|fisso|per\s+il\s+consumo)"
              r"|monorari\w*|\bF0\b|\bPFi?\b|\(PE\)|\bF1\s*[=:]?|costo\s+(?:energia|materia|per\s+consumi)|prezzo\s+per\s+(?:i\s+)?consum\w*|prezzo\s+applicato)")
    pat = re.compile(chiave + r"[^\n€]{0,70}?" + NUM + r"\s*" + u, re.I)
    trovati = []
    for m in pat.finditer(txt):
        riga = (txt[max(0, m.start() - 40):m.start()] + m.group(0)).lower()
        if re.search(r"valore massimo|\bpun\b|psv|pvar|opzione|verde|green|dal \d+|a partire dal|decorso|rinnovo|penale|sbilanciament|dispacciament|eccedent|perdite|adeguamento", riga):
            continue
        v = num(m.group(1))
        if v is not None and lo <= v <= hi:
            trovati.append((0 if re.search(r"monorari|\bF0\b|\bPFi?\b", m.group(0), re.I) else 1, m.start(), v, " ".join(m.group(0).split())[:120]))
    if trovati:
        trovati.sort()
        return trovati[0][2], trovati[0][3]
    return None


def prezzo_scontato(txt, forn):
    """Prezzo finale quando la CTE lo scrive già scontato ("Prezzo Gas scontato pari a 0,76 €/Smc",
    "che determina un Prezzo Luce di 0,19 €/kWh"). Con più sconti cumulabili prende il più basso."""
    u = U_EN if forn == "luce" else U_GAS
    lo, hi = (0.04, 0.45) if forn == "luce" else (0.15, 1.6)
    pat = re.compile(r"(?:scontat\w*|determina\s+un\s+prezzo|prezzo\s+(?:finale|netto)\s+(?:applicato\s+)?(?:pari\s+a)?)[^€]{0,70}?" + NUM + r"\s*" + u, re.I)
    vals = [(num(m.group(1)), " ".join(m.group(0).split())[:120]) for m in pat.finditer(txt)]
    vals = [v for v in vals if v[0] is not None and lo <= v[0] <= hi]
    return min(vals) if vals else None


def analizza(nome, txt, txt_layout=""):
    """-> dict con tipo, prezzo/spread, unita, ccv e le frasi da cui sono presi (per controllo).
    txt_layout (pdftotext -layout) tiene le tabelle su una riga: si prova prima quello."""
    t = pulisci(txt)
    testi = [pulisci(txt_layout)] if txt_layout else []
    testi.append(re.sub(r"\s*\n\s*", " ", t))
    forn = fornitura(nome, t)
    out = {}
    var_nome, fix_nome = bool(VAR_NOME.search(nome)), bool(FIX_NOME.search(nome))
    var_txt = bool(re.search(r"(?:PUN|PSV)[^\n]{0,30}\+", t, re.I))  # "rispetto a un'offerta a prezzo variabile" è una frase standard: non conta
    fix_txt = bool(re.search(r"prezzo\s+fisso|fisso\s+e\s+invariabil|fissi\s+e\s+invariabil|prezzo\s+bloccato|offerta\s+a\s+prezzo\s+fisso", t, re.I))
    esplicito = re.search(r"(?:^|\n|\.\s)\s*offerta\s+a\s+prezzo\s+(fisso|variabile)\s*[.:]", t, re.I)
    if esplicito:
        tipo = "fisso" if esplicito.group(1).lower() == "fisso" else "variabile"
    elif var_nome and not fix_nome:
        tipo = "variabile"
    elif fix_nome and not var_nome:
        tipo = "fisso"
    elif var_txt and not fix_txt:
        tipo = "variabile"
    elif fix_txt and not var_txt:
        tipo = "fisso"
    else:
        tipo = None
    if tipo:
        out["tipo"] = tipo
    if forn:
        out["fornitura"] = forn
        for tt in testi:
            r = spread(tt, forn) if tipo == "variabile" else prezzo_fisso(tt, forn) if tipo == "fisso" else None
            if r:
                out["spread" if tipo == "variabile" else "prezzo"], out["testo_prezzo"] = r
                break
        if out.get("tipo") == "fisso" and "prezzo" in out:
            for tt in testi:
                sc = prezzo_scontato(tt, forn)
                if sc and sc[0] < out["prezzo"]:
                    out["prezzo_scontato"], out["testo_sconto"] = sc
                    break
    for tt in testi:
        c = ccv(tt)
        if c:
            out["ccv"], out["testo_ccv"] = c
            break
    return out
