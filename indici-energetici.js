(function () {
  const DATA_URL = 'data/indici-energia.json?v=' + Date.now();

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

  fetch(DATA_URL, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Dati indici non disponibili');
      return response.json();
    })
    .then(data => {
      const section = document.querySelector('.energy-section');
      if (!section) return;

      const punCard = section.querySelector('.energy-card:not(.psv)');
      const psvCard = section.querySelector('.energy-card.psv');
      const headingUpdate = section.querySelector('.energy-heading > p:last-child');

      if (punCard) {
        const value = punCard.querySelector('.energy-value strong');
        const date = punCard.querySelector('.energy-badge');
        const tbody = punCard.querySelector('tbody');
        if (value) value.textContent = formatValue(data.pun.value, 3);
        if (date) date.textContent = `LUCE · ${formatDate(data.pun.date)}`;
        if (tbody) renderRows(tbody, data.history, 'pun', '€/kWh');
      }

      if (psvCard) {
        const value = psvCard.querySelector('.energy-value strong');
        const date = psvCard.querySelector('.energy-badge');
        const tbody = psvCard.querySelector('tbody');
        if (value) value.textContent = formatValue(data.psv.value, 3);
        if (date) date.textContent = `GAS · ${formatDate(data.psv.date)}`;
        if (tbody) renderRows(tbody, data.history, 'psv', '€/Smc');
      }

      if (headingUpdate) {
        headingUpdate.textContent = `Ultimo aggiornamento: ${formatDate(data.updatedAt)}`;
      }
    })
    .catch(error => console.warn('TOP HOUSE: impossibile aggiornare PUN/PSV', error));
})();
