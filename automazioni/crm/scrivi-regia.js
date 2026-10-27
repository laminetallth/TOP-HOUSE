// Da eseguire nella scheda di Regia Control (app.regia-control.it) già loggata.
// 1) installaHook() e poi scrivere qualcosa nel box "Cerca lead" della pipeline: così si cattura il token della sessione
//    (window.__H). 2) sincronizzaRegia(contratti) crea/aggiorna contatti e opportunità.
// Regole (indicazioni di Lamine, 26/10/2026):
// - ogni contratto caricato su PromUp, CRM GreenWorld o BWC diventa un'opportunità nella pipeline "01 - Rete Vendita", fase Vinto (vinta)
// - se il contratto va in KO l'opportunità passa in Perso (persa)
// - dati del cliente compilati per bene nel contatto
// - venditore trovato tra gli utenti di Regia: assegnato e fonte "passaparola"; altrimenti fonte = nome del venditore
// - venditore sconosciuto (contratto caricato dall'agenzia): Vinto in "01 - Rete Vendita" e in più un'opportunità aperta
//   in START di "02 - Gestione Clienti" (nome "Cliente – Gestore (da assegnare)"): l'assegnazione la fa Lamine
// - l'opportunità si chiama "Cliente – Gestore (Partner ID)": la parte tra parentesi serve a non creare doppioni

const REGIA = {
  location: 'XzcvYtDjrqAP8tyvw3rp',
  api: 'https://services.leadconnectorhq.com',
  pipeline: '01 - Rete Vendita',
  faseVinto: 'Vinto',
  fasePerso: 'Perso',
  partner: { promup: 'PromUp', greenworld: 'GreenWorld', bwc: 'BWC', union: 'Union' },
  azienda: { promup: 'Prom-up', greenworld: 'Greenworld', bwc: 'BWC', union: 'Union' },
  fonteSenzaVenditore: { promup: 'PromUp (agenzia)', greenworld: 'GreenWorld (agenzia)', bwc: 'BWC (agenzia)', union: 'Union (agenzia)' },
  // venditore sconosciuto: oltre a Vinto in "01 - Rete Vendita" si crea un'opportunità aperta in START di
  // "02 - Gestione Clienti", dove Lamine sceglie poi a chi assegnarla
  pipelineGestione: '02 - Gestione Clienti',
  faseStart: 'START',
  // in "02 - Gestione Clienti" il contratto va nella fase della sua durata (dalla CTE/offerta scelta dal venditore)
  fasiDurata: { 6: 'CTR 6 mesi S4 cap', 12: 'CTR 12 mesi', 24: 'CTR 24 mesi', 36: 'CTR 3 anni', 60: 'CTR 5 anni' },
};

// Durata in mesi letta dal nome dell'offerta: "FIX 24 MESI", "Fixa Time 12", "36 mesi", "3 anni", "Cal Year 1_2_3"…
// "CTR 6 mesi S4 cap" vale solo per le offerte S4 Energia (indicazione di Lamine): per gli altri gestori 6 mesi → START
// contratti di telefonia (fibra, mobile, TV): in "02 - Gestione Clienti" vanno sempre in START (indicazione di Lamine)
function eTelefonia(c) {
  if (c.luce || c.gas) return false;
  return /fibra|fastweb(?!\s*energia)|vodafone|\btim\b|windtre|wind\s*tre|infostrada|\bsky\b|iliad|telefon|mobile/i.test(`${c.gestore || ''} ${c.tipo || ''}`) || (!c.pod && !c.pdr);
}

// offerte di cui conosciamo la durata anche se il nome non la dice (indicazione di Lamine)
const DURATE_NOTE = [[/fix luce per te/i, 24]];

function faseDurata(c) {
  if (eTelefonia(c)) return null;
  const nota = DURATE_NOTE.find(([re]) => re.test(c.offerta || ''));
  if (nota) return REGIA.fasiDurata[nota[1]] || null;
  const mesi = durataMesi(`${c.offerta || ''} ${c.tipo || ''}`);
  if (mesi === 6 && !/\bS4\b/i.test(`${c.gestore || ''} ${c.offerta || ''}`)) return null;
  return REGIA.fasiDurata[mesi] || null;
}

function durataMesi(testo) {
  const t = String(testo || '').toUpperCase().replace(/_/g, ' ');
  let m = t.match(/(\d{1,2})\s*(?:MESI|MONTHS|M\b)/);
  if (m) return +m[1];
  m = t.match(/(\d)\s*ANN[IO]/);
  if (m) return +m[1] * 12;
  m = t.match(/CAL\s*YEAR\s*([\d ]+)/);
  if (m) return m[1].trim().split(/\s+/).length * 12;
  m = t.match(/\b(?:FIX|FIXA|FISSO|TIME|SICURO|SERENO|BLOCCATO)\D{0,12}(6|12|18|24|36|48|60)\b/);
  if (m) return +m[1];
  return null;
}

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
  const pp = (await (await fetch(`https://backend.leadconnectorhq.com/opportunities/pipelines?locationId=${REGIA.location}`, { headers: window.__H })).json()).pipelines || [];
  window.__pipe01 = (pp.find(p => p.name === REGIA.pipeline) || {}).id;
  const out = { promup: {}, greenworld: {}, bwc: {}, union: {} };
  const inverso = Object.fromEntries(Object.entries(REGIA.partner).map(([k, v]) => [v, k]));
  for (let pagina = 1; pagina <= 50; pagina++) {
    const r = await fetch(`${REGIA.api}/opportunities/search?location_id=${REGIA.location}&limit=100&page=${pagina}`, { headers: window.__H });
    if (r.status === 401) return JSON.stringify({ errore: 'TOKEN_REGIA' });
    const j = await r.json();
    for (const o of j.opportunities || []) {
      if (window.__pipe01 && o.pipelineId !== window.__pipe01) continue;
      for (const m of (o.name || '').matchAll(/\((PromUp|GreenWorld|BWC|Union) ([\w+]+)\)/g))
        for (const id of m[2].split('+')) out[inverso[m[1]]][id] = o.status;
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
  const pipeGest = pipes.find(p => p.name === REGIA.pipelineGestione);
  const start = pipeGest && (pipeGest.stages.find(s => s.name.toLowerCase() === REGIA.faseStart.toLowerCase()) || {}).id;
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
  // nomi dei gestori come li scriviamo noi (le viste di PromUp li hanno attaccati: "FastwebEnergia", "A2Agent"…)
  const NOMI_GESTORI = { fastwebenergia: 'Fastweb Energia', enelfibra: 'Enel Fibra', edisonfibra: 'Edison Fibra', upenergy: 'Up Energy',
    a2agent: 'A2A', a2avascomplessi: 'A2A Vas Complessi', agsm: 'AGSM', windtre: 'WindTre', tim: 'TIM', axpo: 'Axpo',
    vodafonebusiness: 'Vodafone Business', uniongaseluce: 'Union Gas e Luce', a2a: 'A2A', eni: 'Eni Plenitude', plenitude: 'Plenitude' };
  const nomeGestore = g => NOMI_GESTORI[String(g || '').toLowerCase().replace(/[^a-z0-9]/g, '')] || titolo(g);
  const tel = s => { const d = String(s || '').replace(/[^\d+]/g, ''); if (!d) return ''; return d.startsWith('+') ? d : d.startsWith('00') ? '+' + d.slice(2) : '+39' + d.replace(/^39(?=3\d{8,9}$)/, ''); };
  const dataIso = s => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : String(s || ''); return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(iso) ? iso : ''; };
  const opzioneFornitore = g => { const opts = fornitore.picklistOptions || []; const n = norm(g).join(' '); return opts.find(o => { const on = norm(o).join(' '); return on && (n.includes(on) || on.includes(n.split(' ')[0])); }) || ''; };

  // Regia non permette due opportunità dello stesso contatto nella stessa pipeline: un cliente con più contratti
  // (luce + gas, più POD…) ha UNA opportunità, e gli id dei contratti si accodano nel nome: "(GreenWorld 272434+272433)"
  const idsDi = (nomeO, partner) => [...String(nomeO || '').matchAll(/\((PromUp|GreenWorld|BWC|Union) ([\w+]+)\)/g)]
    .filter(m => m[1] === partner).flatMap(m => m[2].split('+'));
  const conMarca = (nomeO, partner, id) => {
    const re = new RegExp(`\\(${partner} ([\\w+]+)\\)`);
    if (re.test(nomeO)) return idsDi(nomeO, partner).includes(id) ? nomeO : nomeO.replace(re, (t, ids) => `(${partner} ${ids}+${id})`);
    return `${nomeO} (${partner} ${id})`;
  };
  const accoda = async (pipelineId, contattoId, partner, id, stato) => {
    const sue = (await call('GET', `/opportunities/search?location_id=${L}&contact_id=${contattoId}&pipeline_id=${pipelineId}&limit=50`)).opportunities || [];
    const o = sue.find(x => x.status !== 'lost') || sue[0];
    if (!o) return null;
    await call('PUT', `/opportunities/${o.id}`, { name: conMarca(o.name || '', partner, id), ...(o.status === 'lost' || o.status === 'abandoned' ? stato : {}) });
    return o;
  };
  const duplicata = e => /duplicat/i.test(String(e && e.message));

  const report = [];
  for (const c of contratti) {
    const partner = REGIA.partner[c.fonte] || c.fonte;
    const marca = `(${partner} ${c.id})`;
    const cl = c.cliente || {};
    let nome = cl.ragsoc ? titolo(cl.ragsoc) : [titolo(cl.nome), titolo(cl.cognome)].filter(Boolean).join(' ');
    if (!nome) nome = titolo(cl.nomeCompleto);
    const nomeOpp = `${nome} – ${nomeGestore(c.gestore)} ${marca}`;
    try {
      const esistenti = ((await call('GET', `/opportunities/search?location_id=${L}&q=${encodeURIComponent(c.id)}&limit=50`)).opportunities || [])
        .filter(o => idsDi(o.name, partner).includes(String(c.id)));
      const opp = esistenti.find(o => o.pipelineId === pipe.id);
      if (opp) {
        if (c.ko && opp.status !== 'lost') {
          if (idsDi(opp.name, partner).length > 1) {
            // opportunità con più contratti: ne è andato in KO solo uno, la lascio vinta e lo segnalo
            report.push({ azione: 'KO di un solo contratto su più: opportunità lasciata vinta, controlla', opportunita: opp.name, contratto: c.id, stato: c.stato });
          } else {
            if (!prova) {
              await call('PUT', `/opportunities/${opp.id}`, { pipelineStageId: perso, status: 'lost' });
              for (const g of esistenti.filter(o => o.id !== opp.id && o.status !== 'lost')) await call('PUT', `/opportunities/${g.id}`, { status: 'lost' });
            }
            report.push({ azione: 'spostata in Perso (KO)', opportunita: opp.name, stato: c.stato });
          }
        }
        continue;
      }
      // contatto: cerco un doppione per email, poi per telefono
      // il contatto trovato deve avere almeno una parola del nome in comune col cliente: a volte sul portale c'è
      // l'email o il telefono del venditore o di un parente (es. Alberto Sangregorio con i recapiti di Gabriele)
      let contatto = null, emailAltrui = false, telAltrui = false;
      const paroleCliente = norm([cl.nome, cl.cognome, cl.ragsoc, cl.nomeCompleto].join(' ')).filter(t => t.length > 2);
      for (const [k, q] of [['email', cl.email ? `email=${encodeURIComponent(cl.email)}` : ''], ['tel', tel(cl.tel) ? `number=${encodeURIComponent(tel(cl.tel))}` : '']]) {
        if (!q) continue;
        const d = await call('GET', `/contacts/search/duplicate?locationId=${L}&${q}`);
        if (!d.contact) continue;
        const parole = norm([d.contact.firstName, d.contact.lastName, d.contact.contactName, d.contact.companyName].join(' '));
        if (paroleCliente.some(t => parole.includes(t))) { contatto = d.contact; break; }
        if (k === 'email') emailAltrui = true; else telAltrui = true;
      }
      // senza email/telefono utilizzabili: cerco per nome esatto (stesso cliente con più contratti nello stesso giro)
      if (!contatto && nome && (emailAltrui || !cl.email) && (telAltrui || !tel(cl.tel))) {
        const r = (await call('GET', `/contacts/?locationId=${L}&query=${encodeURIComponent(nome)}&limit=20`)).contacts || [];
        const chiave = norm(nome).sort().join(' ');
        contatto = r.find(x => norm([x.firstName, x.lastName].join(' ')).sort().join(' ') === chiave || norm(x.companyName || '').sort().join(' ') === chiave) || null;
      }
      // se qualcuno l'ha già inserita a mano (stesso cliente, stessa pipeline, creata da pochi giorni) non la duplico
      if (contatto && !c.ko) {
        const sue = (await call('GET', `/opportunities/search?location_id=${L}&contact_id=${contatto.id}&pipeline_id=${pipe.id}&limit=50`)).opportunities || [];
        const limite = new Date(new Date(c.data).getTime() - 3 * 86400000).toISOString();
        const doppia = sue.find(o => (o.createdAt || '') >= limite && !/\((PromUp|GreenWorld|BWC|Union) [\w+]+\)/.test(o.name || ''));
        if (doppia) { report.push({ azione: 'già presente (inserita a mano), non duplicata', opportunita: doppia.name }); continue; }
      }
      const utente = trovaUtente(c.venditore);
      const fonte = utente ? 'passaparola' : (c.venditore ? titolo(c.venditore) : REGIA.fonteSenzaVenditore[c.fonte] || partner);
      const tags = [c.luce ? 'bolletta luce' : '', c.gas ? 'bolletta gas' : '', eTelefonia(c) ? 'telefonia' : '', c.rid ? 'rid' : '', c.business ? 'business' : ''].filter(Boolean);
      const customFields = [
        cf.id && cl.cf ? { id: cf.id, field_value: String(cl.cf).toUpperCase() } : null,
        fornitore.id && !eTelefonia(c) && opzioneFornitore(c.gestore) ? { id: fornitore.id, field_value: opzioneFornitore(c.gestore) } : null,
        dataFirma.id && c.data ? { id: dataFirma.id, field_value: c.data } : null,
        nomeOfferta.id && c.offerta ? { id: nomeOfferta.id, field_value: c.offerta } : null,
      ].filter(Boolean);
      let first = titolo(cl.nome), last = titolo(cl.cognome);
      if (!first && !last && cl.nomeCompleto && !cl.ragsoc) { const p = titolo(cl.nomeCompleto).split(' '); last = p.shift() || ''; first = p.join(' '); }
      const dati = {
        firstName: first || undefined, lastName: last || undefined, name: nome || undefined,
        email: (!emailAltrui && cl.email) || undefined, phone: (!telAltrui && tel(cl.tel)) || undefined,
        address1: titolo(cl.indirizzo) || undefined, city: titolo(cl.citta) || undefined, state: (cl.prov || '').toUpperCase() || undefined,
        postalCode: cl.cap || undefined, country: 'IT', companyName: c.fonte === 'union' ? 'Union Gas e Luce' : `${REGIA.azienda[c.fonte] || partner} ${nomeGestore(c.gestore)}`,
        dateOfBirth: dataIso(cl.nascita) || undefined, source: fonte, customFields,
      };
      if (prova) { report.push({ azione: (contatto ? 'userei il contatto esistente' : 'creerei il contatto') + (c.ko ? '' : ` + Gestione Clienti in "${REGIA.faseStart}${faseDurata(c) ? ` (durata letta: ${faseDurata(c)})` : ''}"`), opportunita: nomeOpp, fonte, venditore: utente ? utente.nome : null, ko: c.ko }); continue; }
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
      let nuova = null, accodata = false;
      try {
        nuova = (await call('POST', '/opportunities/', {
          locationId: L, pipelineId: pipe.id, name: nomeOpp, contactId: contatto.id, monetaryValue: 0, source: fonte,
          pipelineStageId: c.ko ? perso : vinto, status: c.ko ? 'lost' : 'won', ...(utente ? { assignedTo: utente.id } : {}),
        })).opportunity;
      } catch (e) {
        if (!duplicata(e)) throw e;
        nuova = await accoda(pipe.id, contatto.id, partner, String(c.id), c.ko ? {} : { pipelineStageId: vinto, status: 'won' });
        if (!nuova) throw e;
        accodata = true;
      }
      // "02 - Gestione Clienti": venditore sconosciuto → START (lo assegna Lamine); venditore noto → fase della durata del contratto
      let gestione = null, faseGest = null;
      if (!c.ko && pipeGest) {
        // indicazione di Lamine (27/10): in Gestione Clienti i contratti nuovi vanno SEMPRE in START, così li controlla,
        // assegna il venditore e li sposta lui nella fase della durata. La durata letta si scrive solo nel riepilogo.
        const durata = (!utente && !c.venditore) ? null : faseDurata(c);
        const idFase = start;
        faseGest = REGIA.faseStart + (durata ? ` (durata letta: ${durata})` : '');
        let gestAccodata = false;
        try {
          gestione = (await call('POST', '/opportunities/', {
            locationId: L, pipelineId: pipeGest.id, name: `${nome} – ${nomeGestore(c.gestore)} ${marca}${!utente && !c.venditore ? ' da assegnare' : ''}`,
            contactId: contatto.id, monetaryValue: 0, source: fonte, pipelineStageId: idFase, status: 'open',
            ...(utente ? { assignedTo: utente.id } : {}),
          })).opportunity;
        } catch (e) {
          if (!duplicata(e)) throw e;
          // il cliente è già in Gestione Clienti: accodo il contratto e lascio la fase com'è (se era persa la riapro in START)
          gestione = await accoda(pipeGest.id, contatto.id, partner, String(c.id), { pipelineStageId: start, status: 'open' });
          gestAccodata = true;
          faseGest = 'già presente, contratto aggiunto';
        }
        // un'automazione di Regia rinomina le nuove opportunità di "02 - Gestione Clienti" col solo nome del cliente:
        // si rimette il nome completo dopo qualche secondo
        if (gestione && gestione.id && !gestAccodata) {
          // l'automazione a volte arriva dopo 6-10 secondi: rinomino, ricontrollo e se serve rinomino ancora
          const giusto = `${nome} – ${nomeGestore(c.gestore)} ${marca}${!utente && !c.venditore ? ' da assegnare' : ''}`;
          for (const attesa of [6000, 12000, 20000]) {
            await new Promise(r => setTimeout(r, attesa));
            const ora = ((await call('GET', `/opportunities/${gestione.id}`)).opportunity || {}).name;
            if (ora === giusto && attesa > 6000) break;
            if (ora !== giusto) await call('PUT', `/opportunities/${gestione.id}`, { name: giusto });
          }
        }
      }
      report.push({ azione: (accodata ? 'aggiunta all\'opportunità già esistente del cliente' : c.ko ? 'creata in Perso (già KO)' : 'creata in Vinto') + (gestione ? ` + Gestione Clienti in "${faseGest}"` : ''), opportunita: nomeOpp, fonte, venditore: utente ? utente.nome : null, id: nuova && nuova.id });
    } catch (e) {
      if (String(e.message).includes('TOKEN_REGIA')) return JSON.stringify({ errore: 'TOKEN_REGIA', fatto: report });
      report.push({ azione: 'ERRORE', opportunita: nomeOpp, errore: e.message });
    }
  }
  return JSON.stringify(report);
}
