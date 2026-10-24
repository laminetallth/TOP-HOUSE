(function () {
  const DATA_URL = 'data/indici-energia.json';
  const REFRESH_MS = 15 * 60 * 1000;

  const formatValue = (value, digits = 3) => {
    if (value === null || value === undefined) return '—';
    return Number(value).toFixed(digits).replace('.', ',');
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const formatChange = (value) => {
    if (value === null || value === undefined) return '—';
    return `${value >= 0 ? '+' : '−'}${Math.abs(Number(value)).toFixed(2).replace('.', ',')}%`;
  };

  const hasValue = value => value !== null && value !== undefined;

  // Lo storico è ordinato dal più recente: la variazione si calcola rispetto al giorno precedente (più vecchio).
  const renderRows = (tbody, history, key, unit) => {
    const rows = history.filter(row => hasValue(row[key]));
    tbody.innerHTML = rows.slice(0, 5).map((row, index) => {
      const value = row[key];
      const previous = rows[index + 1];
      const change = previous && previous[key] ? ((value / previous[key]) - 1) * 100 : null;
      return `<tr>
        <td>${formatDate(row.date)}</td>
        <td>${formatValue(value, 5)} ${unit}</td>
        <td>${formatChange(change)}</td>
      </tr>`;
    }).join('');
  };

  async function loadEnergyIndexes() {
    const section = document.querySelector('.energy-section');
    if (!section) return;

    try {
      // Cache busting + no-store: ogni controllo legge il JSON più recente pubblicato da GitHub Pages.
      const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Dati indici non disponibili');
      const data = await response.json();

      const punCard = section.querySelector('.energy-card:not(.psv)');
      const psvCard = section.querySelector('.energy-card.psv');
      const headingUpdate = section.querySelector('.energy-heading > p:last-child');

      if (punCard && data.pun) {
        const value = punCard.querySelector('.energy-value strong');
        const date = punCard.querySelector('.energy-badge');
        const tbody = punCard.querySelector('tbody');
        if (value) value.textContent = formatValue(data.pun.value, 5);
        if (date) date.textContent = `LUCE · ${formatDate(data.pun.date)}`;
        if (tbody) renderRows(tbody, Array.isArray(data.history) ? data.history : [], 'pun', '€/kWh');
      }

      if (psvCard && data.psv) {
        const value = psvCard.querySelector('.energy-value strong');
        const date = psvCard.querySelector('.energy-badge');
        const tbody = psvCard.querySelector('tbody');
        if (value) value.textContent = formatValue(data.psv.value, 5);
        if (date) date.textContent = `GAS · ${formatDate(data.psv.date)}`;
        if (tbody) renderRows(tbody, Array.isArray(data.history) ? data.history : [], 'psv', '€/Smc');
      }

      if (data.source) section.querySelectorAll('.energy-source').forEach(el => { el.textContent = `Fonte: ${data.source}`; });

      if (headingUpdate) {
        headingUpdate.textContent = `Ultimo aggiornamento: ${formatDate(data.updatedAt)}`;
      }
    } catch (error) {
      console.warn('TOP HOUSE: impossibile aggiornare PUN/PSV', error);
    }
  }

  // Primo caricamento immediato.
  loadEnergyIndexes();

  // Se la pagina resta aperta, ricontrolla automaticamente ogni 15 minuti.
  window.setInterval(loadEnergyIndexes, REFRESH_MS);
})();
