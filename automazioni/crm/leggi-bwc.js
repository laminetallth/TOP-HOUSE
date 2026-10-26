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
  btn.click();
  await new Promise(r => setTimeout(r, 5000));
  const tab = [...document.querySelectorAll('table')].find(t => /INTESTATARIO/.test(t.innerText));
  let righe = [];
  if (window.jQuery && jQuery.fn.dataTable && tab && jQuery.fn.dataTable.isDataTable(tab)) {
    const dt = jQuery(tab).DataTable();
    const hd = dt.columns().header().toArray().map(h => h.innerText.trim());
    righe = dt.rows().data().toArray().map(r => Object.fromEntries(hd.map((h, i) => [h, String(Array.isArray(r) ? r[i] : (Object.values(r)[i] || '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()])));
  } else if (tab) {
    const hd = [...tab.querySelectorAll('thead th')].map(h => h.innerText.trim());
    righe = [...tab.querySelectorAll('tbody tr')].filter(r => r.cells.length > 3).map(r => Object.fromEntries(hd.map((h, i) => [h, (r.cells[i] || {}).innerText || ''])));
  }
  const out = [];
  for (const r of righe) {
    const data = ((r['DATA FIRMA'] || '').match(/(\d{2})\/(\d{2})\/(\d{4})/) || []).slice(1).reverse().join('-');
    const pod = (r['POD / PDR'] || '').trim();
    const id = pod || (r['INTESTATARIO'] + data);
    const ko = /RIFIUTAT|\bKO\b|annullat|scartat/i.test(`${r['STATO']} ${r['ESITO PARTNER']}`);
    if (!data || (data < DAL && !(id in GIA))) continue;
    if (id in GIA && (!ko || GIA[id] === 'lost')) continue;
    out.push({
      fonte: 'bwc', id, gestore: 'Plenitude', data, stato: `${r['STATO']} ${r['ESITO PARTNER']}`.trim(), ko,
      offerta: r['PRODOTTOSERVIZIO'] || r['PRODOTTO'] || '', luce: /^IT\d{3}E/i.test(pod), gas: /^\d{14}$/.test(pod),
      rid: /SDD|RID|addebito|domicil/i.test(r['TIPO PAGAMENTO'] || ''), business: /business|p\.?\s?iva/i.test(r['BRAND'] || ''),
      venditore: /NON PRESENTE|TOP HOUSE/i.test(r['AGENTE'] || '') ? null : (r['AGENTE'] || null),
      cliente: { nomeCompleto: r['INTESTATARIO'] },
    });
  }
  return JSON.stringify(out);
}
