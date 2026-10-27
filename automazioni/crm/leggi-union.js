// Da eseguire in una scheda del portale Union Gas e Luce (Partner.Next, https://wall.uniongaseluce.it/xpcfe/) loggata,
// meglio sulla pagina "Contratti → Lavorati" (così il portale rinnova da solo l'accesso).
// Restituisce i contratti stipulati dal giorno DAL (AAAA-MM-GG) in poi, più quelli già importati (GIA = {id: stato su Regia})
// solo se c'è qualcosa da fare: contratto nuovo, oppure andato in KO mentre su Regia non è ancora persa.
async function leggiUnion(DAL, GIA = {}) {
  let auth = '';
  try { auth = JSON.parse(localStorage.SHARED_TOKEN || '""'); } catch (e) { auth = ''; }
  if (!/^EIP /.test(auth)) return JSON.stringify({ errore: 'LOGIN_UNION' });
  const ctx = (location.hash.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/) || [])[0] || crypto.randomUUID();
  const H = {
    'Content-Type': 'application/json', 'x-eip-trace-path': '["xpcfe-fe"]', 'x-eip-trace-context': JSON.stringify([ctx]),
    'x-eip-trace-id': JSON.stringify([crypto.randomUUID()]), mde: 'PROD', Authorization: auth, 'Accept-Language': 'en-US',
    Accept: 'application/json, text/plain, */*',
  };
  // il filtro del portale è sulla data di stipula: si parte da 400 giorni prima di DAL per ritrovare anche i contratti già importati
  const inizio = new Date(new Date(DAL + 'T00:00:00Z').getTime() - 400 * 864e5).toISOString();
  const fine = new Date(Date.now() + 864e5).toISOString();
  const r = await fetch('/apctr/api/v1/browse-data/browse-contract-rows', {
    method: 'POST', headers: H, body: JSON.stringify({ limit: 1000, stipulationRange: { start: inizio, end: fine }, gridType: 'NonEditabili' }),
  });
  if (r.status === 401 || r.status === 403) return JSON.stringify({ errore: 'LOGIN_UNION' });
  if (!r.ok) return JSON.stringify({ errore: 'UNION_' + r.status });
  const righe = await r.json();

  const giorno = s => new Date(s).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }); // AAAA-MM-GG ora italiana
  // "VIA montegrappa, 27 - 20027 - RESCALDINA (MI)"
  const indirizzo = s => {
    const m = String(s || '').match(/^(.*?)\s*-\s*(\d{5})\s*-\s*(.*?)\s*\((\w{2})\)\s*$/);
    if (!m) return { indirizzo: String(s || '').trim() };
    return { indirizzo: m[1].replace(/\s*,\s*/, ' ').trim(), cap: m[2], citta: m[3], prov: m[4].toUpperCase() };
  };
  // nome e cognome: il portale li dà insieme ("Grassi Cinzia", "de luca antonio"); il codice fiscale dice dove finisce il cognome
  const codCognome = s => {
    const l = s.toUpperCase().replace(/[^A-Z]/g, ''); const c = l.replace(/[AEIOU]/g, ''), v = l.replace(/[^AEIOU]/g, '');
    return (c + v + 'XXX').slice(0, 3);
  };
  const separa = (tutto, cf) => {
    const p = String(tutto || '').trim().split(/\s+/);
    if (/^[A-Z]{6}\d{2}/i.test(cf || '')) {
      for (let k = 1; k < p.length; k++) if (codCognome(p.slice(0, k).join('')) === cf.slice(0, 3).toUpperCase()) return { cognome: p.slice(0, k).join(' '), nome: p.slice(k).join(' ') };
      for (let k = p.length - 1; k > 0; k--) if (codCognome(p.slice(k).join('')) === cf.slice(0, 3).toUpperCase()) return { cognome: p.slice(k).join(' '), nome: p.slice(0, k).join(' ') };
    }
    return { cognome: p[0] || '', nome: p.slice(1).join(' ') };
  };

  const out = [];
  for (const x of righe) {
    const id = String(x.idContractRow);
    const data = giorno(x.stipulationDate);
    if (data < DAL && !(id in GIA)) continue;
    const stato = x.contractRowState || '';
    // macro stato 4/5 = KO (Contendibilità KO, Switch rifiutato…); 1 = in lavorazione, 2 = attivo
    const ko = [4, 5].includes(x.idContractRowMacroState) || /\bKO\b|rifiutat|annullat|respint|scartat|cessat/i.test(stato);
    if (id in GIA && (!ko || GIA[id] === 'lost')) continue;
    const cf = x.fiscalData || '';
    const azienda = /^\d{11}$/.test(cf);
    const fornitura = indirizzo(x.addressSupply || x.addressLegal);
    const dur = (String(x.product || '').match(/fix\s*(\d{2})/i) || [])[1];
    out.push({
      fonte: 'union', id, gestore: 'Union Gas e Luce', data, stato, ko,
      offerta: (x.product || '') + (dur ? ` (${dur} mesi)` : ''),
      tipo: x.contractType || '', proposta: x.proposalCode || '',
      pod: x.utility === 'E' ? (x.pdp || '').toUpperCase() : '', pdr: x.utility === 'G' ? (x.pdp || '') : '',
      luce: x.utility === 'E', gas: x.utility === 'G', rid: false, business: azienda,
      // i contratti sono caricati con l'utenza dell'agenzia ("STRANIERO GABRIELE_CASA FACILE…"): venditore da scegliere
      venditore: null,
      cliente: {
        ...(azienda ? { ragsoc: x.businessName, piva: cf } : { ...separa(x.businessName, cf), cf }),
        indirizzo: fornitura.indirizzo, cap: fornitura.cap || '', citta: fornitura.citta || '', prov: fornitura.prov || '',
        tel: x.mobilePhone || '', email: (x.email || '').toLowerCase(),
      },
    });
  }
  return JSON.stringify(out);
}
