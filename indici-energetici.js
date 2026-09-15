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
    return `${value >= 0 ? '+' : ''}${Number(value).toFixed(2).replace('.', ',')}%`;
  };

  const renderRows = (tbody, history, key, unit) => {
    tbody.innerHTML = history.slice(0, 5).map((row, index) => {
      const value = row[key];
      const previous = history.slice(0, index).find(item => item[key] !== null && item[key] !== undefined);
      const change = index === 0 || !previous || value === null || value === undefined
        ? null
        : ((value / previous[key]) - 1) * 100;
      return `<tr>
        <td>${formatDate(row.date)}</td>
        <td>${formatValue(value)} ${value === null || value === undefined ? '' : unit}</td>
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
        if (value) value.textContent = formatValue(data.pun.value, 3);
        if (date) date.textContent = `LUCE · ${formatDate(data.pun.date)}`;
        if (tbody) renderRows(tbody, Array.isArray(data.history) ? data.history : [], 'pun', '€/kWh');
      }

      if (psvCard && data.psv) {
        const value = psvCard.querySelector('.energy-value strong');
        const date = psvCard.querySelector('.energy-badge');
        const tbody = psvCard.querySelector('tbody');
        if (value) value.textContent = formatValue(data.psv.value, 3);
        if (date) date.textContent = `GAS · ${formatDate(data.psv.date)}`;
        if (tbody) renderRows(tbody, Array.isArray(data.history) ? data.history : [], 'psv', '€/Smc');
      }

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
