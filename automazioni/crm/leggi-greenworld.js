// Da eseguire nella scheda del CRM GreenWorld (crmgreenworld.com) già loggata: l'accesso vale solo in quella scheda.
// Restituisce i contratti inseriti dal giorno DAL (AAAA-MM-GG) in poi, più quelli già importati (GIA = {id: stato su Regia}), ma solo se c'è qualcosa da fare:
// contratto nuovo, oppure andato in KO mentre su Regia non è ancora persa.
// Uso: (async (DAL, IDS) => { ...questo codice... })('2026-10-26', ['123'])
async function leggiGreenworld(DAL, GIA = {}) {
  // l'accesso del CRM GreenWorld vale solo nella scheda del login (sessionStorage) e dura 8 ore:
  // lo copio in localStorage così anche le schede aperte dai controlli automatici lo possono usare finché è valido
  let tok = sessionStorage.getItem('gw_crm_token');
  if (tok) localStorage.setItem('th_gw_crm_token', tok); else tok = localStorage.getItem('th_gw_crm_token');
  const scade = (() => { try { return JSON.parse(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch (e) { return 0; } })();
  if (!tok || scade < Date.now() + 60000) return JSON.stringify({ errore: 'LOGIN_GREENWORLD' });
  const anno = new Date().getFullYear();
  const out = [];
  for (const y of [anno, anno - 1]) {
    const r = await fetch(`/api/contratti/tabella?page=0&size=2000&year=${y}`, { headers: { Authorization: 'Bearer ' + tok } });
    if (r.status === 401 || r.status === 403) return JSON.stringify({ errore: 'LOGIN_GREENWORLD' });
    const j = await r.json();
    for (const x of j.items || []) {
      const [d] = String(x.dataIns || '').split(' ');
      const [dd, mm, yy] = d.split('/');
      const data = `${yy}-${mm}-${dd}`;
      if (data < DAL && !(String(x.id) in GIA)) continue;
      const ko = /^\s*KO\s*$/i.test(x.statoLabel || '');
      if (String(x.id) in GIA && (!ko || GIA[String(x.id)] === 'lost')) continue; // già importato e niente da cambiare
      const tipo = `${x.tipoLabel || ''} ${x.offerta || ''}`;
      out.push({
        fonte: 'greenworld', id: String(x.id), codice: x.codice, gestore: x.gestoreNome, tipo: x.tipoLabel, offerta: x.offerta,
        pod: x.pod, pdr: x.pdr, data, stato: x.statoLabel, ko, esito: x.esito,
        luce: /\bEE\b|POWER|LUCE|ENERGIA/i.test(tipo) || !!x.pod, gas: /GAS/i.test(tipo) || !!x.pdr,
        rid: !!x.rid, business: /business|power|altri usi|pmi|condomin/i.test(tipo),
        venditore: null, // su GreenWorld l'agente è sempre l'agenzia (Gabriele Straniero)
        cliente: { nomeCompleto: x.clienteNome, cf: x.clienteCf, indirizzo: x.clienteIndirizzo, cap: x.clienteCap, citta: x.clienteCitta,
          prov: x.clienteProvincia, tel: x.clienteMobile || x.clienteTelefono, email: x.clienteEmail },
      });
    }
  }
  return JSON.stringify(out);
}
