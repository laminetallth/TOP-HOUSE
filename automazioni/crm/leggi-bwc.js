// Da eseguire nella scheda https://bwccrm.it/tracking.php (CRM BWC, Eni Plenitude) loggata.
// Fa la ricerca PDA senza filtri e legge la tabella "PDA INSERITE" (DataTables).
// Colonne: BRAND, DATA FIRMA, AGENTE, POD / PDR, INTESTATARIO, STATO, ESITO PARTNER, PRODOTTO/SERVIZIO, TIPO PAGAMENTO.
// KO = esito partner "RIFIUTATO" (o stato KO/annullato). Il dettaglio cliente (CF, telefono, email) si legge aprendo la PDA:
// se la tabella non basta, apri la riga e completa i dati a mano nel risultato prima di passarlo a Regia.
async function leggiBwc(DAL, GIA = {}) {
  if (!/tracking/.test(location.pathname)) return JSON.stringify({ errore: 'APRI_TRACKING_BWC' });
  if (/login|index\.php/.test(location.pathname) || !document.querySelector('button')) return JSON.stringify({ errore: 'LOGIN_BWC' });
  const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Ricerca pda');
  if (!btn) return JSON.stringify({ errore: 'LOGIN_BWC' });
  // senza date la ricerca può non restituire nulla: imposto "data firma dal" = DAL se il campo è vuoto
  const campo = document.querySelector('[name="dadatafirma"], #dadatafirma') || document.querySelector('[name="dadatainserimento"], #dadatainserimento');
  if (campo && !campo.value) {
    const [y, m, d] = DAL.split('-');
    campo.value = campo.type === 'date' ? DAL : `${d}/${m}/${y}`;
    campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('change', { bubbles: true }));
  }
  btn.click();
  const trovaTab = () => [...document.querySelectorAll('table')].find(t => /INTESTATARIO/.test(t.innerText));
  for (let i = 0; i < 40; i++) { // aspetta fino a 20 s che arrivino i risultati
    await new Promise(r => setTimeout(r, 500));
    const t = trovaTab();
    if (t && t.querySelectorAll('tbody tr').length && !t.querySelector('.dataTables_empty')) break;
  }
  const tab = trovaTab();
  let righe = [];
  if (window.jQuery && jQuery.fn.dataTable && tab && jQuery.fn.dataTable.isDataTable(tab)) {
    const dt = jQuery(tab).DataTable();
    const hd = dt.columns().header().toArray().map(h => h.innerText.trim());
    const pulisci = v => String(v ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    righe = dt.rows().data().toArray().map(r => {
      if (Array.isArray(r)) return Object.fromEntries(hd.map((h, i) => [h, pulisci(r[i])]));
      // le righe sono oggetti con chiavi proprie (non nell'ordine delle colonne)
      const k = n => pulisci(r[n]);
      return {
        'BRAND': k('Brand'), 'DATA FIRMA': k('Data firma'), 'AGENTE': k('Agente'), 'POD / PDR': k('POD / PDR'), 'INTESTATARIO': k('Intestatario'),
        'STATO': k('stato'), 'ESITO PARTNER': [k('Esito partner'), k('Esito partner definitivo')].filter(Boolean).join(' '),
        'PRODOTTOSERVIZIO': k('ProdottoServizio'), 'TIPO PAGAMENTO': k('Tipo pagamento'), 'SEGMENTO': k('SegmentoCliente') || k('segmento'),
        _cliente: { nome: k('Nome intestatario'), cognome: k('Cognome intestatario'), cf: k('cf'), piva: k('piva'), tel: k('cell') || k('tel'), email: k('mail'),
          indirizzo: k('via'), citta: k('localita'), prov: k('prov'), cap: k('cap') }
      };
    });
  } else if (tab) {
    const hd = [...tab.querySelectorAll('thead th')].map(h => h.innerText.trim());
    righe = [...tab.querySelectorAll('tbody tr')].filter(r => r.cells.length > 3).map(r => Object.fromEntries(hd.map((h, i) => [h, (r.cells[i] || {}).innerText || ''])));
  }
  const out = [];
  for (const r of righe) {
    const df = r['DATA FIRMA'] || '';
    const data = /^\d{4}-\d{2}-\d{2}/.test(df) ? df.slice(0, 10) : (df.match(/(\d{2})\/(\d{2})\/(\d{4})/) || []).slice(1).reverse().join('-');
    const pod = (r['POD / PDR'] || '').trim();
    const id = pod || (r['INTESTATARIO'] + data);
    const ko = /RIFIUTAT|\bKO\b|annullat|scartat/i.test(`${r['STATO']} ${r['ESITO PARTNER']}`);
    if (/^\s*(TST|TEST)\b/i.test(r['INTESTATARIO'] || '')) continue; // pratiche di prova sul CRM BWC
    if (!data || (data < DAL && !(id in GIA))) continue;
    if (id in GIA && (!ko || GIA[id] === 'lost')) continue;
    out.push({
      fonte: 'bwc', id, gestore: 'Plenitude', data, stato: `${r['STATO']} ${r['ESITO PARTNER']}`.trim(), ko,
      offerta: r['PRODOTTOSERVIZIO'] || r['PRODOTTO'] || '', luce: /^IT\d{3}E/i.test(pod), gas: /^\d{14}$/.test(pod),
      rid: /SDD|RID|addebito|domicil/i.test(r['TIPO PAGAMENTO'] || ''), business: /business|p\.?\s?iva|micro|pmi/i.test(`${r['BRAND'] || ''} ${r['SEGMENTO'] || ''}`) || !!(r._cliente && r._cliente.piva),
      venditore: /NON PRESENTE|TOP HOUSE/i.test(r['AGENTE'] || '') ? null : (r['AGENTE'] || null),
      cliente: r._cliente ? { nomeCompleto: r['INTESTATARIO'], ...r._cliente } : { nomeCompleto: r['INTESTATARIO'] },
    });
  }
  return JSON.stringify(out);
}
