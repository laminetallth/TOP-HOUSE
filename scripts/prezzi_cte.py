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
    txt = unicodedata.normalize("NFC", txt).replace("’", "'").replace("\xa0", " ").replace("\u2044", "/")
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


def sconto_rid(txt):
    """Sconti legati al pagamento con RID/SDD/domiciliazione. -> lista di (tipo, valore, frase)
    tipo: "anno" (€/anno da togliere alla CCV), "pct" (% sul prezzo), "pct_ccv" (% sulla CCV), "unit" (€/kWh o €/Smc)."""
    out = []
    t = re.sub(r"\s+", " ", txt.replace("\u2044", "/"))
    for m in re.finditer(r"[^.]{0,220}(?:\bRID\b|addebito\s+(?:diretto|automatico)|\bSDD\b|domiciliazion\w*)[^.]{0,220}", t, re.I):
        f = m.group(0)
        if not re.search(r"scont|riduzion|bonus", f, re.I) or re.search(r"una\s+tantum|non\s+(?:sono\s+previsti|include)\s+(?:sconti|bonus)(?![^.]*sotto)", f, re.I):
            continue
        frase = " ".join(f.split())[:160]
        k = re.search(r"scont\w*|riduzion\w*|bonus", f, re.I)
        f = f[k.start():]  # gli importi devono venire dopo la parola "sconto"
        e = re.search(r"(?:€|euro)\s*" + NUM + r"\s*(?:/|al|all'|a)\s*(mese|anno)|" + NUM + r"\s*(?:€|euro)\s*(?:/|al|all'|a|per)\s*(mese|anno)", f, re.I)
        if e:
            v = num(e.group(1) or e.group(3)); per = (e.group(2) or e.group(4)).lower()
            if v and 0 < v < 200:
                out.append(("anno", round(v * 12 if per == "mese" else v, 2), frase))
                continue
        pc = re.search(NUM + r"\s*%\s*,?\s*(?:sul|del|della|sulla)\s+(corrispettiv\w*\s+(?:di\s+)?commercializzazione|ccv|quota\s+fissa|prezzo|corrispettivo|componente)", f, re.I)
        if pc:
            v = num(pc.group(1))
            if v and 0 < v <= 50:
                out.append(("pct_ccv" if re.search(r"commercializz|ccv|quota", pc.group(2), re.I) else "pct", v, frase))
                continue
        u = re.search(NUM + r"\s*(?:€|euro)\s*/\s*(kwh|s?mc)", f, re.I)
        if u and not re.search(r"scontat|determina", f, re.I):
            v = num(u.group(1))
            if v and v < 0.2:
                out.append(("unit", v, frase))
    return out


def sconti_percentuali(t, forn):
    """Sconti in % sul prezzo dell'energia (promo tipo "Special Days 30%", sconto RID/domiciliazione 5%, sconto dual…).
    Ogni sconto si conta una volta anche se la CTE lo ripete. -> lista di (percentuale, frase)."""
    altra = "gas" if forn == "luce" else "luce"
    t = re.sub(r"\s+", " ", t)
    visti, out = set(), []
    for m in re.finditer(r"[^.]{0,200}\bscont\w*[^.]{0,200}", t, re.I):
        f = m.group(0)
        for pc in re.finditer(NUM + r"\s*%\s*,?\s*(?:sul|del|della|sulla)\s+(?:prezzo|corrispettivo|componente)(?:\s+(?:di\s+)?(luce|gas|energia|materia))?(?:\s+pieno)?", f, re.I):
            v = num(pc.group(1))
            quale = (pc.group(2) or "").lower()
            if not v or not 0 < v <= 60 or quale == altra or (not quale and re.search(r"\b" + altra + r"\b", f, re.I) and not re.search(r"\b" + forn + r"\b", f, re.I)):
                continue
            # niente sconti solo su alcune ore ("Ore Happy"), percentuali di incidenza sulla spesa o sconti sulla CCV
            if re.search(r"commercializz|ccv|quota\s+fissa|non\s+sono\s+previsti|fascia\s+oraria|dalle\s+(?:ore\s+)?\d", f, re.I) \
                    or re.search(r"cliente\s+tipo|incidenza|stima", f[max(0, pc.start() - 60):pc.end()], re.I):
                continue
            rid = bool(re.search(r"\bRID\b|addebito|\bSDD\b|domicili", f, re.I))
            nome = re.search(r"sconto\s+([A-Z][\w ]{2,30}?)\s+(?:pari|del|di)", f)
            chiave = (round(v, 3), rid, (nome.group(1).lower() if nome else ""))
            if any(k[0] == chiave[0] and k[1] == chiave[1] for k in visti):
                continue
            visti.add(chiave)
            out.append((v, " ".join(f.split())[:160]))
    return out


def tipo_offerta(nome, t):
    var_nome, fix_nome = bool(VAR_NOME.search(nome)), bool(FIX_NOME.search(nome))
    var_txt = bool(re.search(r"(?:PUN|PSV)[^\n]{0,30}\+", t, re.I))  # "rispetto a un'offerta a prezzo variabile" è una frase standard: non conta
    fix_txt = bool(re.search(r"prezzo\s+fisso|fisso\s+e\s+invariabil|fissi\s+e\s+invariabil|prezzo\s+bloccato|offerta\s+a\s+prezzo\s+fisso|fisso\s+per\s+\d+\s+mesi", t, re.I))
    # offerte ibride: parte dei consumi a prezzo fisso e parte variabile (es. Hera Hybrid)
    if re.search(r"HYBRID|IBRID", nome, re.I) or re.search(r"\bibrid[ao]\b|offerta\s+hybrid", t, re.I) \
            or (re.search(r"prezzo\s+fisso\s*:", t, re.I) and re.search(r"prezzo\s+variabile\s*:", t, re.I)):
        return "ibrida"
    esplicito = re.search(r"(?:^|\n|\.\s)\s*offerta\s+a\s+prezzo\s+(fisso|variabile)\b", t, re.I)
    if esplicito:
        return "fisso" if esplicito.group(1).lower() == "fisso" else "variabile"
    if var_nome != fix_nome:
        return "variabile" if var_nome else "fisso"
    if var_txt != fix_txt:
        return "variabile" if var_txt else "fisso"
    return None


def forniture(nome, t):
    """Forniture della CTE: dal nome se è chiaro, altrimenti dal testo (le CTE luce+gas come Plenitude le hanno entrambe)."""
    n = nome.upper()
    luce = bool(re.search(r"LUCE|\bEE\b|_EE_|ENERGIA[ _]ELETTRICA|POWER|\bELE\b|ELETTRIC", n))
    gas = bool(re.search(r"GAS|\bSMC\b", n))
    if luce != gas:
        return ["luce"] if luce else ["gas"]
    out = []
    if re.search(r"\d\s*" + U_EN, t, re.I):
        out.append("luce")
    if re.search(r"\d\s*" + U_GAS, t, re.I):
        out.append("gas")
    return out


def primo(fun, testi, forn):
    for tt in testi:
        r = fun(tt, forn)
        if r:
            return r
    return None


def analizza(nome, txt, txt_layout=""):
    """-> dict: tipo (fisso/variabile/ibrida), prezzi per fornitura (luce/gas) con sconti RID inclusi, CCV annua.
    txt_layout (pdftotext -layout) tiene le tabelle su una riga: si prova prima quello."""
    t = pulisci(txt)
    testi = [pulisci(txt_layout)] if txt_layout else []
    testi.append(re.sub(r"\s*\n\s*", " ", t))
    out = {}
    tipo = tipo_offerta(nome, t)
    if tipo:
        out["tipo"] = tipo
    sconti = sconto_rid(t)
    prezzi = []
    for forn in forniture(nome, t):
        voce = {"f": forn}
        if tipo in ("fisso", "ibrida"):
            p = primo(prezzo_fisso, testi, forn)
            if p:
                voce["prezzo"], voce["testo"] = p
                pct = sconti_percentuali(t, forn)
                if pct:
                    # più sconti in % (promo + RID): si sommano, tutti calcolati sul prezzo di listino
                    tot = sum(v for v, _ in pct)
                    if tot < 70:
                        voce["scontato"] = round(p[0] * (1 - tot / 100), 5)
                        voce["testo_sconto"] = " + ".join(f"{v:g}%" for v, _ in pct) + " · " + pct[0][1]
                if "scontato" not in voce:
                    sc = primo(prezzo_scontato, testi, forn)
                    if sc and sc[0] < p[0]:
                        voce["scontato"], voce["testo_sconto"] = sc
                if "scontato" not in voce:
                    for k, v, frase in sconti:
                        if k == "unit":
                            voce["scontato"], voce["testo_sconto"] = round(p[0] - v, 5), frase
                            break
        if tipo in ("variabile", "ibrida"):
            s_ = primo(spread, testi, forn)
            if s_:
                voce["spread"], voce["testo_spread"] = s_
                for k, v, frase in sconti:
                    if k == "unit" and v < s_[0]:
                        voce["spread_scontato"], voce["testo_sconto"] = round(s_[0] - v, 5), frase
                        break
        prezzi.append(voce)
    if prezzi:
        out["prezzi"] = prezzi
    c = primo(lambda tt, _f: ccv(tt), testi, None)
    if c:
        out["ccv"], out["testo_ccv"] = c
        for k, v, frase in sconti:
            if k == "anno" and v < c[0]:
                out["ccv_scontata"], out["testo_sconto_rid"] = round(c[0] - v, 2), frase
                break
            if k == "pct_ccv":
                out["ccv_scontata"], out["testo_sconto_rid"] = round(c[0] * (1 - v / 100), 2), frase
                break
    return out
