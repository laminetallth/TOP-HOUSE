// Da eseguire in una scheda di PromUp (promup.sharework.it) loggata.
// Restituisce i contratti inseriti dal giorno DAL (AAAA-MM-GG) in poi, più quelli già importati (GIA = {id: stato su Regia}), ma solo se c'è qualcosa da fare:
// contratto nuovo, oppure andato in KO mentre su Regia non è ancora persa,
// con l'anagrafica del cliente letta da res-anagrafica-contratto-<vista>-<id>.php.
async function leggiPromup(DAL, GIA = {}) {
  const home = await (await fetch('/web/agenzia.php')).text();
  if (!/GESTIONE CONTRATTI/i.test(home)) return JSON.stringify({ errore: 'LOGIN_PROMUP' });
  const dom = s => new DOMParser().parseFromString(s, 'text/html');
  const viste = [...dom(home).querySelectorAll('a')].map(a => [a.innerText.trim(), (a.getAttribute('href') || '').match(/^agenzia-view-(\d+)\.php$/)])
    .filter(([, m]) => m).map(([nome, m]) => ({ nome, id: m[1] }));
  const out = [];
  for (const v of viste) {
    const d = dom(await (await fetch(`/web/agenzia-view-${v.id}.php`)).text());
    const tb = [...d.querySelectorAll('table')].find(t => /\bStato\b/.test(t.innerText) && /Autore/.test(t.innerText));
    if (!tb) continue;
    const hd = [...tb.querySelectorAll('th')].map(x => x.innerText.trim());
    const col = n => hd.indexOf(n);
    for (const r of [...tb.querySelectorAll('tbody tr')].filter(r => r.cells.length > 8)) {
      const c = i => (i >= 0 && r.cells[i] ? r.cells[i].innerText.trim() : '');
      const id = c(col('ID'));
      const ins = c(col('Ins')).match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
      if (!/^\d+$/.test(id) || !ins) continue;
      const data = `${ins[3].length === 2 ? '20' + ins[3] : ins[3]}-${ins[2]}-${ins[1]}`;
      if (data < DAL && !(id in GIA)) continue;
      const stato = c(col('Stato'));
      const ko = /\bKO\b|annullat|scartat|rifiutat|respint|non accettat/i.test(stato);
      if (id in GIA && (!ko || GIA[id] === 'lost')) continue; // già importato e niente da cambiare
      const autore = c(col('Autore'));
      // anche "Gabriele Straniero (Agenzia)" è un venditore: i contratti caricati da lui sono suoi (indicazione di Lamine)
      const venditore = autore.replace(/\s*\(.*$/, '').trim() || null;
      const a = dom(await (await fetch(`/web/res-anagrafica-contratto-${v.id}-${id}.php`)).text());
      const val = n => { const e = a.querySelector(`[name="${n}"]`); if (!e) return ''; if (e.tagName === 'SELECT') return (e.options[e.selectedIndex] || {}).text || ''; return (e.value || '').trim(); };
      const tipoCol = c(col('Tipo'));
      const via = (val('address') || val('indirizzo')).replace(/\s+/g, ' ').trim(); // il nome del campo cambia da gestore a gestore
      // nome dell'offerta scelta (serve anche a capire la durata: 12/24 mesi, 3 anni…)
      const offerta = [...a.querySelectorAll('select')].filter(e => /pacchett|offert|listino|prodott/i.test(e.name || ''))
        .map(e => ((e.options[e.selectedIndex] || {}).text || '').trim()).filter(t => t && !/^(-+|seleziona.*|nessun.*)$/i.test(t)).join(' + ');
      out.push({
        fonte: 'promup', id, gestore: v.nome, vista: v.id, data, stato, ko, offerta,
        tipo: [c(col('Cntr')), tipoCol].filter(Boolean).join(' '), pod: val('pod').toUpperCase(), pdr: val('pdr'),
        luce: !!val('pod') || /energia|luce/i.test(c(col('Cntr'))), gas: !!val('pdr') || /gas/i.test(c(col('Cntr'))),
        // select "payment": 1 = Carta di credito, 2 = RID, 3 = Bollettino postale
        rid: (a.querySelector('[name="payment"]') || {}).value === '2' || /\bRID\b|SEPA|addebito/i.test(val('payment')),
        business: /BIZ|business|corporate/i.test(tipoCol) || !!val('piva'),
        venditore,
        cliente: { nome: val('nome').trim(), cognome: val('cognome').trim(), ragsoc: val('ragsoc'), piva: val('piva'), cf: val('codfisc'),
          nascita: val('dnascita'), indirizzo: via && new RegExp(`\\b${val('ncivico').replace(/[^\w]/g, '')}$`).test(via) ? via : [via, val('ncivico')].filter(Boolean).join(' '), cap: val('cap'),
          citta: val('citta'), prov: val('prov'), tel: val('ncell') || val('num_chiamato'), email: val('email') },
      });
    }
  }
  return JSON.stringify(out);
}
