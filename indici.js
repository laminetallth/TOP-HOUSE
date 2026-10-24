// TOP HOUSE — pagina storico PUN e PSV: grafico interattivo, statistiche e tabella giornaliera.
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const CONF = {
    pun: { label: 'PUN · prezzo luce all\'ingrosso', unit: '€/kWh' },
    psv: { label: 'PSV · prezzo gas all\'ingrosso', unit: '€/Smc' }
  };
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const fmt = (v, d = 5) => Number(v).toFixed(d).replace('.', ',');
  const pct = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2).replace('.', ',')}%`;
  const parse = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const short = iso => { const d = parse(iso); return `${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)}`; };
  const long = iso => { const d = parse(iso); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`; };

  let data = null;
  let key = (location.hash.replace('#', '') in CONF) ? location.hash.replace('#', '') : 'pun';
  let days = 30;
  let firstDraw = true;

  function series() {
    const all = (data.history || []).filter(r => r[key] !== null && r[key] !== undefined).sort((a, b) => a.date.localeCompare(b.date));
    if (!days) return all;
    const last = parse(all[all.length - 1].date);
    const from = new Date(last); from.setDate(from.getDate() - days + 1);
    return all.filter(r => parse(r.date) >= from);
  }

  function setButtons() {
    document.querySelectorAll('[data-ix]').forEach(b => { const on = b.dataset.ix === key; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); });
    document.querySelectorAll('[data-days]').forEach(b => b.classList.toggle('is-on', Number(b.dataset.days) === days));
  }

  function render() {
    setButtons();
    const c = CONF[key];
    const all = (data.history || []).filter(r => r[key] !== null && r[key] !== undefined).sort((a, b) => b.date.localeCompare(a.date));
    const rows = series();
    if (!rows.length) return;
    const lastRow = all[0], prevRow = all[1];
    const ch = prevRow ? (lastRow[key] / prevRow[key] - 1) * 100 : null;

    $('.th-ix-label').textContent = c.label;
    $('.th-ix-value').innerHTML = `${fmt(lastRow[key])}<small>${c.unit}</small>`;
    const chEl = $('.th-ix-change');
    chEl.className = 'th-ix-change ' + (ch === null ? '' : ch >= 0 ? 'up' : 'down');
    chEl.textContent = ch === null ? '' : `${ch >= 0 ? '▲' : '▼'} ${pct(ch)} rispetto al giorno prima`;
    $('.th-ix-date').textContent = `Ultimo dato: ${long(lastRow.date)}`;

    // statistiche del periodo
    const vals = rows.map(r => r[key]);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const min = rows.reduce((a, b) => (b[key] < a[key] ? b : a));
    const max = rows.reduce((a, b) => (b[key] > a[key] ? b : a));
    const span = rows.length > 1 ? (rows[rows.length - 1][key] / rows[0][key] - 1) * 100 : 0;
    $('.th-ix-stats').innerHTML = [
      ['Media del periodo', `${fmt(avg)}`, `${rows.length} giorni`],
      ['Minimo', `${fmt(min[key])}`, short(min.date)],
      ['Massimo', `${fmt(max[key])}`, short(max.date)],
      ['Variazione nel periodo', pct(span), `dal ${short(rows[0].date)}`]
    ].map(([l, v, s], i) => `<div class="th-ix-stat${i === 3 ? (span >= 0 ? ' up' : ' down') : ''}"><span>${l}</span><b>${v}</b><small>${s}</small></div>`).join('');

    drawChart(rows, c);

    // tabella giorno per giorno (più recente in alto)
    const tbody = $('.th-ix-table tbody');
    const inPeriod = new Set(rows.map(r => r.date));
    tbody.innerHTML = all.filter(r => inPeriod.has(r.date)).map((r, i, arr) => {
      const p = all[all.indexOf(r) + 1];
      const v = p ? (r[key] / p[key] - 1) * 100 : null;
      return `<tr><td>${long(r.date)}</td><td><b>${fmt(r[key])}</b> <small>${c.unit}</small></td><td class="${v === null ? '' : v >= 0 ? 'up' : 'down'}">${v === null ? '—' : `${v >= 0 ? '▲' : '▼'} ${pct(v)}`}</td></tr>`;
    }).join('');

    // media mensile (tutto lo storico)
    const months = {};
    all.forEach(r => { const k = r.date.slice(0, 7); (months[k] = months[k] || []).push(r[key]); });
    const keys = Object.keys(months).sort().reverse();
    $('.th-ix-months').innerHTML = keys.map((m, i) => {
      const a = months[m].reduce((x, y) => x + y, 0) / months[m].length;
      const prev = months[keys[i + 1]];
      const pa = prev ? prev.reduce((x, y) => x + y, 0) / prev.length : null;
      const [y, mm] = m.split('-').map(Number);
      const v = pa ? (a / pa - 1) * 100 : null;
      return `<li><div class="th-row" style="cursor:default"><span class="th-row-label">${MESI[mm - 1][0].toUpperCase() + MESI[mm - 1].slice(1)} ${y}</span><span class="th-row-meta"><b style="color:var(--ink)">${fmt(a)}</b> ${c.unit}${v === null ? '' : ` · <span class="${v >= 0 ? 'up' : 'down'}">${pct(v)}</span>`}<br><small>${months[m].length} giorni</small></span></div></li>`;
    }).join('');
  }

  function drawChart(rows, c) {
    const box = $('.th-ix-chart');
    const svg = $('svg', box);
    const tip = $('.th-ix-tip', box);
    const W = Math.max(300, Math.round(box.getBoundingClientRect().width));
    const H = W < 560 ? 220 : 300;
    const pad = { l: 58, r: 16, t: 16, b: 30 };
    const vals = rows.map(r => r[c === CONF.pun ? 'pun' : 'psv']);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const m = (hi - lo) * 0.12 || hi * 0.05; lo -= m; hi += m;
    const x = i => pad.l + (rows.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (rows.length - 1)) * (W - pad.l - pad.r));
    const y = v => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
    const pts = vals.map((v, i) => [x(i), y(v)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H - pad.b} L${pts[0][0].toFixed(1)} ${H - pad.b} Z`;
    // griglia e etichette asse Y (4 livelli)
    let grid = '';
    for (let i = 0; i <= 3; i += 1) {
      const v = lo + ((hi - lo) * i) / 3;
      grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="g"/><text x="${pad.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v, 3)}</text>`;
    }
    // etichette asse X (al massimo 6)
    const step = Math.max(1, Math.ceil(rows.length / 6));
    let xl = '';
    rows.forEach((r, i) => { if (i % step === 0 || i === rows.length - 1) xl += `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${short(r.date)}</text>`; });
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', H);
    svg.innerHTML = `<defs><linearGradient id="ixL" x1="0" x2="1"><stop offset="0" stop-color="#c8102e"/><stop offset=".5" stop-color="#e8302a"/><stop offset="1" stop-color="#f7941d"/></linearGradient>
      <linearGradient id="ixA" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e8302a" stop-opacity=".28"/><stop offset="1" stop-color="#f7941d" stop-opacity="0"/></linearGradient></defs>
      ${grid}${xl}<path class="a" d="${area}" fill="url(#ixA)"/><path class="l${firstDraw ? ' draw' : ''}" d="${line}" stroke="url(#ixL)"/>
      ${rows.length <= 45 ? pts.map(p => `<circle class="pt" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6"/>`).join('') : ''}
      <circle class="last-ring" cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="5"/>
      <circle class="last" cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="5"/>
      <line class="cross" y1="${pad.t}" y2="${H - pad.b}" x1="-10" x2="-10"/><circle class="dot" r="6" cx="-20" cy="-20"/>
      <rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}"/>`;
    const path = $('path.l', svg);
    path.style.setProperty('--len', Math.ceil(path.getTotalLength()) + 2);
    firstDraw = false;

    // lettura interattiva: dito o mouse sul grafico
    const cross = $('.cross', svg), dot = $('.dot', svg), hit = $('.hit', svg);
    const show = ev => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (W / r.width);
      let i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (rows.length - 1));
      i = Math.max(0, Math.min(rows.length - 1, i));
      const [cx, cy] = pts[i];
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx);
      dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
      const prev = i ? vals[i - 1] : null;
      const v = prev ? (vals[i] / prev - 1) * 100 : null;
      tip.innerHTML = `<b>${fmt(vals[i])} ${c.unit}</b><span>${long(rows[i].date)}</span>${v === null ? '' : `<span class="${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '▲' : '▼'} ${pct(v)}</span>`}`;
      tip.hidden = false;
      const left = (cx / W) * r.width;
      tip.style.left = `${Math.min(Math.max(left, 80), r.width - 80)}px`;
      tip.style.top = `${(cy / H) * r.height}px`;
    };
    const hide = () => { tip.hidden = true; cross.setAttribute('x1', -10); cross.setAttribute('x2', -10); dot.setAttribute('cx', -20); };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('touchmove', e => { show(e); }, { passive: true });
    hit.addEventListener('pointerleave', hide);
  }

  document.querySelectorAll('[data-ix]').forEach(b => b.addEventListener('click', () => { key = b.dataset.ix; history.replaceState(null, '', `#${key}`); firstDraw = true; render(); }));
  document.querySelectorAll('[data-days]').forEach(b => b.addEventListener('click', () => { days = Number(b.dataset.days); firstDraw = true; render(); }));
  window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (h in CONF && h !== key) { key = h; firstDraw = true; render(); } });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => data && render(), 200); });

  const card = $('.th-ix-card');
  card.classList.add('is-loading');
  fetch(`data/indici-energia.json?t=${Date.now()}`, { cache: 'no-store' })
    .then(r => r.json())
    .then(d => { data = d; card.classList.remove('is-loading'); render(); })
    .catch(() => { $('.th-ix-chart').innerHTML = '<p class="th-empty"><b>Dati non disponibili</b>Riprova tra qualche minuto.</p>'; card.classList.remove('is-loading'); });
})();
