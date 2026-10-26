// Da eseguire nella scheda di Regia Control (app.regia-control.it) già loggata.
// 1) installaHook() e poi scrivere qualcosa nel box "Cerca lead" della pipeline: così si cattura il token della sessione
//    (window.__H). 2) sincronizzaRegia(contratti) crea/aggiorna contatti e opportunità.
// Regole (indicazioni di Lamine, 26/10/2026):
// - ogni contratto caricato su PromUp, CRM GreenWorld o BWC diventa un'opportunità nella pipeline "01 - Rete Vendita", fase Vinto (vinta)
// - se il contratto va in KO l'opportunità passa in Perso (persa)
// - dati del cliente compilati per bene nel contatto
// - venditore trovato tra gli utenti di Regia: assegnato e fonte "passaparola"; altrimenti fonte = nome del venditore
// - l'opportunità si chiama "Cliente – Gestore (Partner ID)": la parte tra parentesi serve a non creare doppioni

const REGIA = {
  location: 'XzcvYtDjrqAP8tyvw3rp',
  api: 'https://services.leadconnectorhq.com',
  pipeline: '01 - Rete Vendita',
  faseVinto: 'Vinto',
  fasePerso: 'Perso',
  partner: { promup: 'PromUp', greenworld: 'GreenWorld', bwc: 'BWC' },
  azienda: { promup: 'Prom-up', greenworld: 'Greenworld', bwc: 'BWC' },
  fonteSenzaVenditore: { promup: 'PromUp (agenzia)', greenworld: 'GreenWorld (agenzia)', bwc: 'BWC (agenzia)' },
};

function installaHook() {
  window.__hdr = window.__hdr || {};
  if (window.__hookOk) return 'hook già attivo';
  const sh = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) { if (/^(token-id|channel|source|version)$/i.test(k)) window.__hdr[k] = v; return sh.apply(this, arguments); };
  window.__hookOk = true;
  return 'hook installato: ora scrivi qualcosa in "Cerca lead"';
}

function tokenPronto() {
  const h = window.__hdr || {};
  if (!h['token-id']) return false;
  window.__H = { 'token-id': h['token-id'], channel: h.channel || 'APP', source: h.source || 'WEB_USER', version: h.version || '2021-07-28', 'Content-Type': 'application/json' };
  return true;
}

// Elenco dei contratti già importati, letto dai nomi delle opportunità: {promup: {id: stato}, greenworld: {...}, bwc: {...}}
async function elencoImportati() {
  if (!tokenPronto()) return JSON.stringify({ errore: 'TOKEN_REGIA' });
  const out = { promup: {}, greenworld: {}, bwc: {} };
  const inverso = Object.fromEntries(Object.entries(REGIA.partner).map(([k, v]) => [v, k]));
  for (let pagina = 1; pagina <= 50; pagina++) {
    const r = await fetch(`${REGIA.api}/opportunities/search?location_id=${REGIA.location}&limit=100&page=${pagina}`, { headers: window.__H });
    if (r.status === 401) return JSON.stringify({ errore: 'TOKEN_REGIA' });
    const j = await r.json();
    for (const o of j.opportunities || []) {
      const m = (o.name || '').match(/\((PromUp|GreenWorld|BWC) (\w+)\)\s*$/);
      if (m) out[inverso[m[1]]][m[2]] = o.status;
    }
    if (!(j.opportunities || []).length || (j.meta && !j.meta.nextPage)) break;
  }
  return JSON.stringify(out);
}

async function sincronizzaRegia(contratti, prova = false) {
  if (!tokenPronto()) return JSON.stringify({ errore: 'TOKEN_REGIA' });
  const H = window.__H, L = REGIA.location, API = REGIA.api;
  const call = async (method, path, body) => {
    const r = await fetch(API + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch (e) { j = { raw: t.slice(0, 200) }; }
    if (r.status === 401) throw new Error('TOKEN_REGIA');
    if (r.status >= 400) throw new Error(`${method} ${path.split('?')[0]} -> ${r.status} ${(j.message || j.raw || '').toString().slice(0, 160)}`);
    return j;
  };
  const pipes = (await (await fetch(`https://backend.leadconnectorhq.com/opportunities/pipelines?locationId=${L}`, { headers: H })).json()).pipelines || [];
  const pipe = pipes.find(p => p.name === REGIA.pipeline);
  if (!pipe) return JSON.stringify({ errore: 'PIPELINE_NON_TROVATA' });
  const fase = n => (pipe.stages.find(s => s.name.toLowerCase() === n.toLowerCase()) || {}).id;
  const vinto = fase(REGIA.faseVinto), perso = fase(REGIA.fasePerso);
  const utenti = ((await call('GET', `/users/?locationId=${L}`)).users || []).map(u => ({ id: u.id, nome: `${u.firstName || ''} ${u.lastName || ''}`.trim() }));
  const campi = ((await (await fetch(`https://backend.leadconnectorhq.com/locations/${L}/customFields/search?parentId=&skip=0&limit=10000&documentType=field&model=all&query=&includeStandards=true`, { headers: H })).json()).customFields || []);
  const campo = key => campi.find(c => c.fieldKey === key) || {};
  const cf = campo('contact.codice_fiscale'), fornitore = campo('contact.fornitore'), dataFirma = campo('contact.data_firma'), nomeOfferta = campo('contact.nome_offerta');

  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
  const lev = (a, b) => { const m = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { let p = m[0]; m[0] = i; for (let j = 1; j <= b.length; j++) { const t = m[j]; m[j] = Math.min(m[j] + 1, m[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return m[b.length]; };
  const trovaUtente = nome => {
    const v = norm(nome); if (v.length < 2) return null;
    return utenti.find(u => { const n = norm(u.nome); return n.length >= 2 && n.every(t => v.some(x => x === t || (t.length > 4 && lev(x, t) <= 1))); }) || null;
  };
  const titolo = s => String(s || '').toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase()).trim();
  const tel = s => { const d = String(s || '').replace(/[^\d+]/g, ''); if (!d) return ''; return d.startsWith('+') ? d : d.startsWith('00') ? '+' + d.slice(2) : '+39' + d.replace(/^39(?=3\d{8,9}$)/, ''); };
  const dataIso = s => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : String(s || ''); return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(iso) ? iso : ''; };
  const opzioneFornitore = g => { const opts = fornitore.picklistOptions || []; const n = norm(g).join(' '); return opts.find(o => { const on = norm(o).join(' '); return on && (n.includes(on) || on.includes(n.split(' ')[0])); }) || ''; };

  const report = [];
  for (const c of contratti) {
    const partner = REGIA.partner[c.fonte] || c.fonte;
    const marca = `(${partner} ${c.id})`;
    const cl = c.cliente || {};
    let nome = cl.ragsoc ? titolo(cl.ragsoc) : [titolo(cl.nome), titolo(cl.cognome)].filter(Boolean).join(' ');
    if (!nome) nome = titolo(cl.nomeCompleto);
    const nomeOpp = `${nome} – ${titolo(c.gestore)} ${marca}`;
    try {
      const esistenti = (await call('GET', `/opportunities/search?location_id=${L}&q=${encodeURIComponent(`${partner} ${c.id}`)}&limit=20`)).opportunities || [];
      const opp = esistenti.find(o => (o.name || '').includes(marca));
      if (opp) {
        if (c.ko && opp.status !== 'lost') {
          if (!prova) await call('PUT', `/opportunities/${opp.id}`, { pipelineStageId: perso, status: 'lost' });
          report.push({ azione: 'spostata in Perso (KO)', opportunita: nomeOpp, stato: c.stato });
        }
        continue;
      }
      // contatto: cerco un doppione per email, poi per telefono
      let contatto = null;
      for (const q of [cl.email ? `email=${encodeURIComponent(cl.email)}` : '', tel(cl.tel) ? `number=${encodeURIComponent(tel(cl.tel))}` : ''].filter(Boolean)) {
        const d = await call('GET', `/contacts/search/duplicate?locationId=${L}&${q}`);
        if (d.contact) { contatto = d.contact; break; }
      }
      const utente = trovaUtente(c.venditore);
      const fonte = utente ? 'passaparola' : (c.venditore ? titolo(c.venditore) : REGIA.fonteSenzaVenditore[c.fonte] || partner);
      const tags = [c.luce ? 'bolletta luce' : '', c.gas ? 'bolletta gas' : '', c.rid ? 'rid' : '', c.business ? 'business' : ''].filter(Boolean);
      const customFields = [
        cf.id && cl.cf ? { id: cf.id, field_value: String(cl.cf).toUpperCase() } : null,
        fornitore.id && opzioneFornitore(c.gestore) ? { id: fornitore.id, field_value: opzioneFornitore(c.gestore) } : null,
        dataFirma.id && c.data ? { id: dataFirma.id, field_value: c.data } : null,
        nomeOfferta.id && c.offerta ? { id: nomeOfferta.id, field_value: c.offerta } : null,
      ].filter(Boolean);
      let first = titolo(cl.nome), last = titolo(cl.cognome);
      if (!first && !last && cl.nomeCompleto && !cl.ragsoc) { const p = titolo(cl.nomeCompleto).split(' '); last = p.shift() || ''; first = p.join(' '); }
      const dati = {
        firstName: first || undefined, lastName: last || undefined, name: nome || undefined,
        email: cl.email || undefined, phone: tel(cl.tel) || undefined,
        address1: titolo(cl.indirizzo) || undefined, city: titolo(cl.citta) || undefined, state: (cl.prov || '').toUpperCase() || undefined,
        postalCode: cl.cap || undefined, country: 'IT', companyName: `${REGIA.azienda[c.fonte] || partner} ${titolo(c.gestore)}`,
        dateOfBirth: dataIso(cl.nascita) || undefined, source: fonte, customFields,
      };
      if (prova) { report.push({ azione: contatto ? 'userei il contatto esistente' : 'creerei il contatto', opportunita: nomeOpp, fonte, venditore: utente ? utente.nome : null, ko: c.ko }); continue; }
      if (contatto) {
        // non sovrascrivo i dati già presenti: completo solo quelli mancanti
        const agg = {};
        for (const [k, v] of Object.entries(dati)) if (v && k !== 'source' && k !== 'customFields' && !contatto[k]) agg[k] = v;
        if (customFields.length) agg.customFields = customFields;
        if (Object.keys(agg).length) await call('PUT', `/contacts/${contatto.id}`, agg);
        if (tags.length) await call('POST', `/contacts/${contatto.id}/tags`, { tags });
      } else {
        contatto = (await call('POST', '/contacts/', { locationId: L, ...dati, tags })).contact;
      }
      const nuova = (await call('POST', '/opportunities/', {
        locationId: L, pipelineId: pipe.id, name: nomeOpp, contactId: contatto.id, monetaryValue: 0, source: fonte,
        pipelineStageId: c.ko ? perso : vinto, status: c.ko ? 'lost' : 'won', ...(utente ? { assignedTo: utente.id } : {}),
      })).opportunity;
      report.push({ azione: c.ko ? 'creata in Perso (già KO)' : 'creata in Vinto', opportunita: nomeOpp, fonte, venditore: utente ? utente.nome : null, id: nuova && nuova.id });
    } catch (e) {
      if (String(e.message).includes('TOKEN_REGIA')) return JSON.stringify({ errore: 'TOKEN_REGIA', fatto: report });
      report.push({ azione: 'ERRORE', opportunita: nomeOpp, errore: e.message });
    }
  }
  return JSON.stringify(report);
}
