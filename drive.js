// TOP HOUSE — cuore del Drive: cartelle, caricamento semplificato, ricerca, indici energetici.
//
// SICUREZZA: nessun token nel codice. Per modificare i file l'admin incolla il proprio token
// GitHub personale, salvato solo sul suo dispositivo. I venditori leggono gli elenchi da
// data/documenti-index.json, rigenerato da GitHub Actions a ogni modifica.
(function () {
  'use strict';

  const OWNER = 'laminetallth';
  const REPO = 'TOP-HOUSE';
  const BRANCH = 'main';
  const TOKEN_KEY = 'topHouseGithubToken';
  const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/`;
  const MAX_BYTES = 95 * 1024 * 1024;
  const ALLOWED = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'zip', 'mp4', 'mov', 'webm', 'm4v'];

  const ROOT = (() => {
    try { return new URL('./', document.currentScript.src).href; }
    catch (error) { return new URL('./', window.location.href).href; }
  })();

  // ------------------------------------------------------------------ utilità
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const encodePath = path => String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const ext = name => (String(name || '').match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
  const isVideoLink = name => ext(name) === 'json' && /^video-/i.test(name);
  const isShown = name => ALLOWED.includes(ext(name)) || isVideoLink(name);
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function fileType(name) {
    const e = ext(name);
    if (isVideoLink(name)) return { cls: 't-vid', label: 'VIDEO' };
    if (e === 'pdf') return { cls: 't-pdf', label: 'PDF' };
    if (['doc', 'docx'].includes(e)) return { cls: 't-doc', label: 'DOC' };
    if (['xls', 'xlsx'].includes(e)) return { cls: 't-xls', label: 'XLS' };
    if (['ppt', 'pptx'].includes(e)) return { cls: 't-ppt', label: 'PPT' };
    if (['jpg', 'jpeg', 'png'].includes(e)) return { cls: 't-img', label: 'IMG' };
    if (['mp4', 'mov', 'webm', 'm4v'].includes(e)) return { cls: 't-vid', label: 'VIDEO' };
    if (e === 'zip') return { cls: 't-zip', label: 'ZIP' };
    return { cls: '', label: (e || 'FILE').toUpperCase().slice(0, 4) };
  }

  // "CTE_Alperia Power Index Braies_ITA_.pdf" → "CTE Alperia Power Index Braies ITA"
  function cleanName(name) {
    return String(name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').replace(/\s+-\s+|-{2,}/g, ' – ').replace(/\s{2,}/g, ' ').trim() || name;
  }

  function formatSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  }

  function toast(text, isError = false) {
    let box = $('.th-toasts');
    if (!box) { box = document.createElement('div'); box.className = 'th-toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'th-toast' + (isError ? ' is-err' : '');
    t.textContent = text;
    box.appendChild(t);
    setTimeout(() => t.remove(), isError ? 7000 : 4200);
  }

  function role() {
    try { return window.TOPHOUSE_AUTH?.getCurrentRole?.() || sessionStorage.getItem('topHouseUserRole') || ''; } catch (e) { return ''; }
  }
  const isAdmin = () => role() === 'admin';

  // ------------------------------------------------------------------ token e GitHub
  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function forgetToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* niente */ } document.dispatchEvent(new Event('tophouse:token')); }

  async function ensureToken() {
    const saved = getToken();
    if (saved) return saved;
    if (!isAdmin()) { toast('Solo gli admin possono modificare i file.', true); return ''; }
    const typed = await askToken();
    if (!typed) return '';
    try {
      const r = await fetch(API, { headers: { Authorization: `Bearer ${typed}`, Accept: 'application/vnd.github+json' } });
      if (!r.ok) { toast('Token non valido o senza accesso al Drive. Controllalo e riprova.', true); return ''; }
    } catch (e) { toast('Impossibile verificare il token: controlla la connessione.', true); return ''; }
    try { localStorage.setItem(TOKEN_KEY, typed); } catch (e) { /* modalità privata */ }
    document.dispatchEvent(new Event('tophouse:token'));
    return typed;
  }

  function askToken() {
    return new Promise(resolve => {
      const sheet = openSheet(`
        <div class="th-sheet-head"><div><h2>Collega il tuo token GitHub</h2>
        <p>Serve una volta sola per dispositivo: resta salvato qui e non viene mai pubblicato.</p></div></div>
        <div class="th-sheet-body">
          <label class="th-field"><span>Token</span><input type="password" id="thTokenInput" autocomplete="off" placeholder="github_pat_…"></label>
          <p style="margin:0 0 8px;color:var(--muted);font-size:14px">Crealo su <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Fine-grained token</a>: solo il repository <b>TOP-HOUSE</b>, permesso <b>Contents: Read and write</b>.</p>
        </div>
        <div class="th-sheet-foot"><button type="button" class="th-btn th-btn--ghost" data-close>Annulla</button><button type="button" class="th-btn" id="thTokenOk">Collega</button></div>`, () => resolve(''));
      const input = $('#thTokenInput', sheet.el);
      input.focus();
      const ok = () => { const v = input.value.trim(); if (!v) return input.focus(); sheet.close(true); resolve(v); };
      $('#thTokenOk', sheet.el).addEventListener('click', ok);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    });
  }

  async function gh(path, options = {}) {
    const token = options.token || getToken();
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body) headers['Content-Type'] = 'application/json';
    const r = await fetch(path.startsWith('http') ? path : API + path, { method: options.method || 'GET', headers, body: options.body ? JSON.stringify(options.body) : undefined, cache: 'no-store' });
    if (r.status === 401) { forgetToken(); throw new Error('Token GitHub scaduto o revocato: ricollegalo e riprova.'); }
    return r;
  }

  async function ghJson(path, options) {
    const r = await gh(path, options);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(data.message || `Errore GitHub ${r.status}`); err.status = r.status; throw err; }
    return data;
  }

  function readBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error(`Impossibile leggere ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  const utf8Base64 = text => btoa(unescape(encodeURIComponent(text)));

  // Un'unica modifica (un solo commit) per aggiunte, sostituzioni ed eliminazioni.
  async function commitChanges({ adds = [], deletes = [], message, onProgress = () => {} }) {
    const token = await ensureToken();
    if (!token) throw new Error('Operazione annullata: token non collegato.');
    const entries = [];
    for (let i = 0; i < adds.length; i += 1) {
      const add = adds[i];
      onProgress({ step: 'upload', index: i, total: adds.length, name: add.path.split('/').pop() });
      const content = add.file ? await readBase64(add.file) : add.base64;
      const blob = await ghJson('/git/blobs', { method: 'POST', token, body: { content, encoding: 'base64' } });
      entries.push({ path: add.path, mode: '100644', type: 'blob', sha: blob.sha });
      onProgress({ step: 'uploaded', index: i, total: adds.length, name: add.path.split('/').pop() });
    }
    const addPaths = new Set(adds.map(a => a.path));
    deletes.filter(p => !addPaths.has(p)).forEach(path => entries.push({ path, mode: '100644', type: 'blob', sha: null }));
    if (!entries.length) return null;
    onProgress({ step: 'commit' });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const ref = await ghJson(`/git/ref/heads/${BRANCH}`, { token });
      const parent = await ghJson(`/git/commits/${ref.object.sha}`, { token });
      const tree = await ghJson('/git/trees', { method: 'POST', token, body: { base_tree: parent.tree.sha, tree: entries } });
      const commit = await ghJson('/git/commits', { method: 'POST', token, body: { message, tree: tree.sha, parents: [ref.object.sha] } });
      try {
        await ghJson(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', token, body: { sha: commit.sha, force: false } });
        onProgress({ step: 'done' });
        indexPromise = null;
        return commit.sha;
      } catch (error) {
        if (error.status !== 422 || attempt === 3) throw error;
        await sleep(800 * (attempt + 1)); // qualcun altro ha appena pubblicato: riprova sopra la sua modifica
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ dati
  let indexPromise = null;
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(`${ROOT}data/documenti-index.json?t=${Date.now()}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : { folders: {} })).catch(() => ({ folders: {} }));
    }
    return indexPromise;
  }
  // Date di fine validità delle CTE (data/scadenze-cte.json, ricavate dai PDF).
  let scadPromise = null;
  function loadScadenze() {
    if (!scadPromise) scadPromise = fetch(`${ROOT}data/scadenze-cte.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : {})).then(d => d.file || {}).catch(() => ({}));
    return scadPromise;
  }
  function expiryBadge(info) {
    if (!info?.scade) return '';
    const [y, m, d] = info.scade.split('-').map(Number);
    const end = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((end - today) / 86400000);
    const date = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    let cls = 'ok', icon = 'fa-calendar-check', text = `Scade il ${date}`;
    if (days < 0) { cls = 'old'; icon = 'fa-calendar-xmark'; text = `Scaduta il ${date}`; }
    else if (days === 0) { cls = 'soon'; icon = 'fa-hourglass-end'; text = 'Scade oggi'; }
    else if (days <= 7) { cls = 'soon'; icon = 'fa-hourglass-half'; text = `Scade il ${date} · tra ${days} ${days === 1 ? 'giorno' : 'giorni'}`; }
    return `<span class="th-exp th-exp--${cls}" title="${esc(info.testo || '')}"><i class="fa-solid ${icon}" aria-hidden="true"></i>${text}</span>`;
  }
  // 0.185 -> "0,185"; 144 -> "144"
  const itNum = (v, min = 2) => Number(v).toLocaleString('it-IT', { minimumFractionDigits: Number.isInteger(v) ? 0 : min, maximumFractionDigits: 6 });
  function priceBadges(info) {
    if (!info) return '';
    const unit = info.fornitura === 'gas' ? '€/Smc' : '€/kWh';
    const out = [];
    if (info.tipo === 'fisso') {
      const p = info.prezzo_scontato ?? info.prezzo;
      const tip = info.testo_sconto || info.testo_prezzo || '';
      out.push(`<span class="th-tag th-tag--fix" title="${esc(tip)}"><i class="fa-solid fa-lock" aria-hidden="true"></i>Fisso${p != null ? ` ${itNum(p)} ${unit}` : ''}${info.prezzo_scontato != null ? ' incluso sconti' : ''}</span>`);
    } else if (info.tipo === 'variabile') {
      out.push(`<span class="th-tag th-tag--var" title="${esc(info.testo_prezzo || '')}"><i class="fa-solid fa-chart-line" aria-hidden="true"></i>Variabile${info.spread != null ? ` · spread ${itNum(info.spread)} ${unit}` : ''}</span>`);
    }
    if (info.ccv != null) out.push(`<span class="th-tag" title="${esc(info.testo_ccv || '')}">CCV ${itNum(info.ccv, 0)} €/anno</span>`);
    return out.join('');
  }

  let mapPromise = null;
  function loadMap() {
    if (!mapPromise) mapPromise = fetch(`${ROOT}data/mappa-cartelle.json?t=${Date.now()}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : { folders: {}, pages: [] })).catch(() => ({ folders: {}, pages: [] }));
    return mapPromise;
  }

  async function listFolder(folder) {
    if (getToken() && isAdmin()) {
      try {
        const r = await gh(`/contents/${encodePath(folder)}?ref=${BRANCH}&t=${Date.now()}`);
        if (r.status === 404) return [];
        if (r.ok) {
          const data = await r.json();
          return (Array.isArray(data) ? data : []).filter(f => f.type === 'file').map(f => ({ name: f.name, path: f.path, sha: f.sha, size: f.size }));
        }
      } catch (e) { console.warn('TOP HOUSE: lettura con token non riuscita, uso l\'indice.', e); }
    }
    const index = await loadIndex();
    return (index.folders?.[folder] || []).map(f => ({ ...f, path: `${folder}/${f.name}` }));
  }

  // ------------------------------------------------------------------ pannelli
  function openSheet(html, onDismiss) {
    const el = document.createElement('div');
    el.className = 'th-sheet';
    el.innerHTML = `<div class="th-sheet-panel" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => el.classList.add('is-open'));
    let closed = false;
    const close = (silent = false) => {
      if (closed) return;
      closed = true;
      el.classList.remove('is-open');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      setTimeout(() => el.remove(), 250);
      if (!silent && onDismiss) onDismiss();
    };
    const onKey = e => { if (e.key === 'Escape' && !el.dataset.busy) close(); };
    document.addEventListener('keydown', onKey);
    el.addEventListener('click', e => { if ((e.target === el || e.target.closest('[data-close]')) && !el.dataset.busy) close(); });
    return { el, close };
  }

  function confirmSheet({ title, text, confirm, danger = false }) {
    return new Promise(resolve => {
      const s = openSheet(`<div class="th-sheet-head"><div><h2>${esc(title)}</h2><p>${text}</p></div></div>
        <div class="th-sheet-foot"><button type="button" class="th-btn th-btn--ghost" data-close>Annulla</button><button type="button" class="th-btn${danger ? ' th-btn--danger' : ''}" data-ok>${esc(confirm)}</button></div>`, () => resolve(false));
      $('[data-ok]', s.el).addEventListener('click', () => { s.close(true); resolve(true); });
      $('[data-ok]', s.el).focus();
    });
  }

  // ------------------------------------------------------------------ abbinamento versioni
  // Riconosce la nuova versione di un documento anche se cambia data, mese o numero di versione.
  function nameTokens(name) {
    let s = norm(name).replace(/\.[a-z0-9]+$/, ' ');
    s = s.replace(/\b\d{1,2}[-_.\/]\d{1,2}([-_.\/]\d{2,4})?\b/g, ' ')
      .replace(/(19|20)\d{2}/g, ' ')
      .replace(/\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|sett?|ott|nov|dic)\b/g, ' ')
      .replace(/\b(v|ver|rev|versione|release)\s*\d+\b/g, ' ')
      .replace(/\b(nuov[oa]|new|aggiornat[oa]|agg|def|definitiv[oa]|final[e]?|copia|copy|ultim[oa])\b/g, ' ');
    return new Set(s.split(/[^a-z0-9]+/).filter(t => t.length > 1 && !/^\d+$/.test(t)));
  }
  function similarity(a, b) {
    if (a === b) return 1;
    if (ext(a) !== ext(b)) return 0;
    const A = nameTokens(a), B = nameTokens(b);
    if (!A.size || !B.size) return 0;
    let inter = 0; A.forEach(t => { if (B.has(t)) inter += 1; });
    return inter / (A.size + B.size - inter);
  }
  function suggestReplacements(newFiles, existing) {
    const pairs = [];
    newFiles.forEach((f, i) => existing.forEach(o => { const s = similarity(f.name, o.name); if (s >= 0.6) pairs.push({ i, old: o.name, s }); }));
    pairs.sort((x, y) => y.s - x.s);
    const usedNew = new Set(), usedOld = new Set(), result = {};
    pairs.forEach(p => { if (usedNew.has(p.i) || usedOld.has(p.old)) return; usedNew.add(p.i); usedOld.add(p.old); result[p.i] = p.old; });
    return result;
  }

  // ------------------------------------------------------------------ vista cartella
  function mountFolder(view) {
    if (!view || view.dataset.mounted === view.dataset.folder) return;
    view.dataset.mounted = view.dataset.folder;
    const folder = view.dataset.folder;
    const label = view.dataset.label || folder.split('/').pop();
    const crumbs = (view.dataset.crumbs || '').split(' › ').filter(Boolean);
    let files = [];
    let selecting = false;
    let highlight = new Set();
    let query = '';
    let firstPaint = true;
    let scadenze = {};

    view.innerHTML = `
      <div class="th-folder-head">
        <div class="th-filter" hidden><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" placeholder="Cerca in questa cartella" aria-label="Cerca in questa cartella"></div>
        <span class="th-count" aria-live="polite"></span>
      </div>
      <div class="th-admin-bar admin-only" data-admin-only>
        <button type="button" class="th-btn th-btn--small" data-act="add"><i class="fa-solid fa-cloud-arrow-up"></i> Aggiungi o aggiorna file</button>
        <button type="button" class="th-btn th-btn--ghost th-btn--small" data-act="video"><i class="fa-solid fa-circle-play"></i> Link video</button>
        <button type="button" class="th-btn th-btn--ghost th-btn--small" data-act="select"><i class="fa-regular fa-square-check"></i> Seleziona</button>
        <button type="button" class="th-btn th-btn--danger th-btn--small" data-act="bulk" hidden><i class="fa-solid fa-trash-can"></i> <span>Elimina</span></button>
        <span class="th-hint">Puoi anche trascinare i file qui sopra</span>
      </div>
      <ul class="th-files" aria-label="File di ${esc(label)}"><li class="th-loading"><img src="${ROOT}casetta.svg" alt=""><span>Carico i documenti…</span></li></ul>
      <input type="file" multiple hidden accept="${ALLOWED.map(e => '.' + e).join(',')}" data-picker>
      <input type="file" hidden data-replacer>`;

    const list = $('.th-files', view);
    const count = $('.th-count', view);
    const filterBox = $('.th-filter', view);
    const filterInput = $('input', filterBox);
    const picker = $('[data-picker]', view);
    const replacer = $('[data-replacer]', view);
    const bulkBtn = $('[data-act="bulk"]', view);

    filterInput.addEventListener('input', () => { query = norm(filterInput.value.trim()); render(); });

    function favObject(file) {
      const raw = RAW + encodePath(file.path);
      if (isVideoLink(file.name) && file.url) return { name: file.title || file.name, title: file.title, type: 'video-link', url: file.url, downloadUrl: file.url, folderPath: folder, manager: crumbs[1] || crumbs[0], section: crumbs.slice(2).join(' / ') || label };
      return { name: file.name, fileName: file.name, downloadUrl: raw, folderPath: folder, manager: crumbs[1] || crumbs[0], section: crumbs.slice(2).join(' / ') || label };
    }

    function render() {
      const admin = isAdmin();
      const shown = files.filter(f => !query || norm(f.title || f.name).includes(query) || norm(cleanName(f.name)).includes(query));
      filterBox.hidden = files.length < 7;
      count.textContent = files.length ? (files.length === 1 ? '1 file' : `${files.length} file`) : '';
      bulkBtn.hidden = !selecting;
      updateBulk();
      if (!files.length) {
        list.innerHTML = `<li class="th-empty"><i class="fa-regular fa-folder-open"></i><b>Cartella vuota</b>${admin ? 'Trascina qui i file o usa “Aggiungi o aggiorna file”.' : 'Gli admin non hanno ancora caricato documenti qui.'}</li>`;
        return;
      }
      if (!shown.length) { list.innerHTML = '<li class="th-empty"><b>Nessun file trovato</b>Prova con un\'altra parola.</li>'; return; }
      list.innerHTML = '';
      shown.forEach((file, i) => {
        const li = row(file, admin);
        if (firstPaint && i < 14) { li.classList.add('th-rise'); li.style.setProperty('--d', `${120 + i * 35}ms`); }
        list.appendChild(li);
      });
      firstPaint = false;
    }

    function row(file, admin) {
      const t = fileType(file.name);
      const video = isVideoLink(file.name);
      const display = video ? (file.title || 'Video') : cleanName(file.name);
      const meta = video ? 'Link video' : [t.label, formatSize(file.size)].filter(Boolean).join(' · ');
      const raw = RAW + encodePath(file.path);
      const li = document.createElement('li');
      li.className = 'th-file' + (highlight.has(file.name) ? ' is-new' : '');
      li.dataset.name = file.name;
      const fav = favObject(file);
      const isFav = window.TOPHOUSE_PDF?.isFavorite(fav);
      li.innerHTML = `
        ${selecting && admin ? `<input type="checkbox" class="th-file-check" aria-label="Seleziona ${esc(display)}">` : ''}
        <span class="th-file-type ${t.cls}" aria-hidden="true">${t.label}</span>
        <button type="button" class="th-file-main" title="${esc(file.name)}"><span class="th-file-name">${esc(display)}</span><span class="th-file-meta">${esc(meta)}</span><span class="th-tags">${priceBadges(scadenze[`${folder}/${file.name}`])}${expiryBadge(scadenze[`${folder}/${file.name}`])}</span></button>
        <span class="th-file-actions">
          <button type="button" class="th-icon-btn${isFav ? ' is-on' : ''}" data-a="fav" aria-pressed="${isFav ? 'true' : 'false'}" title="${isFav ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}"><i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i></button>
          <a class="th-icon-btn" href="${esc(video ? (file.url || raw) : raw)}" target="_blank" rel="noopener" title="${video ? 'Apri video' : 'Scarica'}"><i class="fa-solid ${video ? 'fa-up-right-from-square' : 'fa-download'}"></i></a>
          ${admin ? `<button type="button" class="th-icon-btn" data-a="replace" title="Sostituisci con una nuova versione"><i class="fa-solid fa-arrows-rotate"></i></button>
          <button type="button" class="th-icon-btn th-icon-btn--danger" data-a="delete" title="Elimina"><i class="fa-solid fa-trash-can"></i></button>` : ''}
        </span>`;
      $('.th-file-main', li).addEventListener('click', () => {
        if (video) { if (file.url) window.open(file.url, '_blank', 'noopener'); return; }
        window.TOPHOUSE_PDF?.openPreview({ name: file.name, fileName: file.name, downloadUrl: raw, folderPath: folder });
      });
      $('[data-a="fav"]', li).addEventListener('click', e => {
        const on = window.TOPHOUSE_PDF.toggleFavorite(fav);
        const b = e.currentTarget;
        b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
        b.title = on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti';
        b.innerHTML = `<i class="fa-${on ? 'solid' : 'regular'} fa-star"></i>`;
        toast(on ? 'Aggiunto ai preferiti' : 'Tolto dai preferiti');
      });
      $('[data-a="replace"]', li)?.addEventListener('click', () => { replacer.dataset.target = file.name; replacer.accept = '.' + ext(file.name); replacer.click(); });
      $('[data-a="delete"]', li)?.addEventListener('click', () => removeFiles([file]));
      $('.th-file-check', li)?.addEventListener('change', updateBulk);
      return li;
    }

    function selected() { return [...list.querySelectorAll('.th-file-check:checked')].map(c => files.find(f => f.name === c.closest('.th-file').dataset.name)).filter(Boolean); }
    function updateBulk() { const n = selected().length; $('span', bulkBtn).textContent = n ? `Elimina ${n}` : 'Elimina'; bulkBtn.disabled = !n; }

    async function load() {
      try {
        if (/\/cte/.test(folder)) scadenze = await loadScadenze();
        const raw = (await listFolder(folder)).filter(f => isShown(f.name));
        // titoli dei link video: dall'indice, altrimenti letti dal file
        await Promise.all(raw.filter(f => isVideoLink(f.name) && !f.url).map(async f => {
          try { const d = await fetch(RAW + encodePath(f.path)).then(r => r.json()); f.title = d.title; f.url = d.url; } catch (e) { /* resta il nome */ }
        }));
        // le CTE scadute vanno in fondo alla lista
        const today = new Date().toISOString().slice(0, 10);
        const expired = f => ((scadenze[`${folder}/${f.name}`] || {}).scade || '9999') < today ? 1 : 0;
        files = raw.sort((a, b) => expired(a) - expired(b) || (a.title || a.name).localeCompare(b.title || b.name, 'it', { numeric: true, sensitivity: 'base' }));
        render();
      } catch (error) {
        console.error(error);
        list.innerHTML = '<li class="th-empty"><i class="fa-solid fa-plug-circle-xmark"></i><b>Non riesco a leggere la cartella</b>Controlla la connessione e ricarica la pagina.</li>';
      }
    }

    async function afterChange(added = [], removed = []) {
      // aggiornamento immediato a schermo, poi rilettura da GitHub
      files = files.filter(f => !removed.includes(f.name) && !added.some(a => a.name === f.name));
      added.forEach(a => files.push({ name: a.name, path: `${folder}/${a.name}`, size: a.size, title: a.title, url: a.url }));
      files.sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name, 'it', { numeric: true, sensitivity: 'base' }));
      highlight = new Set(added.map(a => a.name));
      render();
      setTimeout(load, 2500);
      setTimeout(() => { highlight = new Set(); }, 3000);
    }

    async function removeFiles(targets) {
      if (!targets.length) return;
      const names = targets.slice(0, 4).map(f => `<br>• ${esc(f.title || cleanName(f.name))}`).join('') + (targets.length > 4 ? `<br>… e altri ${targets.length - 4}` : '');
      const ok = await confirmSheet({ title: targets.length === 1 ? 'Eliminare questo file?' : `Eliminare ${targets.length} file?`, text: `Sparirà dal Drive per tutti.${names}`, confirm: 'Elimina', danger: true });
      if (!ok) return;
      try {
        targets.forEach(f => list.querySelector(`.th-file[data-name="${CSS.escape(f.name)}"]`)?.classList.add('is-leaving'));
        await commitChanges({ deletes: targets.map(f => f.path), message: `Elimina ${targets.length === 1 ? targets[0].name : targets.length + ' file'} da ${label}` });
        selecting = false;
        toast(targets.length === 1 ? 'File eliminato' : `${targets.length} file eliminati`);
        afterChange([], targets.map(f => f.name));
      } catch (error) { toast(error.message, true); render(); }
    }

    function openUploader(picked, forcedReplace) {
      const accepted = [], refused = [];
      [...picked].forEach(f => {
        if (!ALLOWED.includes(ext(f.name))) refused.push(`${f.name}: tipo di file non consentito`);
        else if (f.size > MAX_BYTES) refused.push(`${f.name}: troppo grande (max 95 MB). Per i video usa “Link video”.`);
        else accepted.push(f);
      });
      refused.forEach(m => toast(m, true));
      if (!accepted.length) return;
      const guess = forcedReplace ? { 0: forcedReplace } : suggestReplacements(accepted, files.filter(f => !isVideoLink(f.name)));
      const options = files.filter(f => !isVideoLink(f.name));
      const s = openSheet(`
        <div class="th-sheet-head"><div><h2>${accepted.length === 1 ? 'Pubblica 1 file' : `Pubblica ${accepted.length} file`} in ${esc(label)}</h2>
        <p>Le versioni vecchie riconosciute vengono sostituite in automatico. Controlla e premi Pubblica.</p></div>
        <button type="button" class="th-icon-btn" data-close aria-label="Chiudi"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="th-sheet-body">
          ${accepted.map((f, i) => { const t = fileType(f.name); return `<div class="th-up" data-i="${i}">
            <span class="th-file-type ${t.cls}">${t.label}</span>
            <span class="th-up-name">${esc(f.name)} <small style="color:var(--muted);font-weight:400">${formatSize(f.size)}</small></span>
            <select aria-label="Cosa fare con ${esc(f.name)}" class="${guess[i] ? 'is-replace' : ''}">
              <option value="">Aggiungi come nuovo file</option>
              ${options.map(o => `<option value="${esc(o.name)}"${guess[i] === o.name ? ' selected' : ''}>Sostituisce: ${esc(cleanName(o.name))}</option>`).join('')}
            </select>
            <span class="th-up-state"></span></div>`; }).join('')}
          ${files.length && !forcedReplace ? `<label class="th-check"><input type="checkbox" data-sync><span><b>Sostituisci tutta la cartella</b><br><span style="color:var(--muted)">Toglie i file che non sono in questo caricamento: utile quando arriva il pacchetto nuovo di CTE.</span></span></label>` : ''}
        </div>
        <div class="th-sheet-foot"><div class="th-progress" hidden><b></b></div><button type="button" class="th-btn" data-ok><i class="fa-solid fa-cloud-arrow-up"></i> Pubblica</button></div>`);
      const okBtn = $('[data-ok]', s.el);
      const bar = $('.th-progress', s.el);
      s.el.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => sel.classList.toggle('is-replace', !!sel.value)));
      okBtn.addEventListener('click', async () => {
        const plan = accepted.map((f, i) => ({ file: f, replaces: $(`.th-up[data-i="${i}"] select`, s.el).value }));
        const sync = $('[data-sync]', s.el)?.checked;
        const newNames = new Set(plan.map(p => p.file.name));
        const replaced = new Set(plan.map(p => p.replaces).filter(Boolean));
        const deletes = files.filter(f => (replaced.has(f.name) && !newNames.has(f.name)) || (sync && !newNames.has(f.name))).map(f => f.path);
        if (sync && deletes.length) {
          const ok = await confirmSheet({ title: `Togliere ${deletes.length} file vecchi?`, text: 'Resteranno nella cartella solo i file di questo caricamento.', confirm: 'Sì, sostituisci tutto', danger: true });
          if (!ok) return;
        }
        s.el.dataset.busy = '1'; okBtn.disabled = true; bar.hidden = false;
        s.el.querySelectorAll('select,input').forEach(x => { x.disabled = true; });
        try {
          const n = plan.length;
          await commitChanges({
            adds: plan.map(p => ({ path: `${folder}/${p.file.name}`, file: p.file })),
            deletes,
            message: `${replaced.size ? 'Aggiorna' : 'Carica'} ${n === 1 ? plan[0].file.name : n + ' file'} in ${label}`,
            onProgress: p => {
              if (p.step === 'upload') { $(`.th-up[data-i="${p.index}"] .th-up-state`, s.el).textContent = 'Caricamento…'; }
              if (p.step === 'uploaded') { const st = $(`.th-up[data-i="${p.index}"] .th-up-state`, s.el); st.textContent = 'Pronto'; st.classList.add('is-ok'); $('b', bar).style.width = `${Math.round(((p.index + 1) / p.total) * 90)}%`; }
              if (p.step === 'commit') { okBtn.innerHTML = `<img src="${ROOT}casetta.svg" alt="" style="width:26px;filter:brightness(0) invert(1)"> Pubblicazione…`; }
              if (p.step === 'done') { $('b', bar).style.width = '100%'; }
            }
          });
          delete s.el.dataset.busy;
          s.close(true);
          const removedNames = files.filter(f => deletes.includes(f.path)).map(f => f.name);
          toast(`Pubblicato. ${replaced.size ? `${replaced.size} sostituit${replaced.size === 1 ? 'o' : 'i'}. ` : ''}I venditori lo vedranno entro un paio di minuti.`);
          afterChange(plan.map(p => ({ name: p.file.name, size: p.file.size })), removedNames);
        } catch (error) {
          delete s.el.dataset.busy;
          okBtn.disabled = false; okBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Riprova';
          s.el.querySelectorAll('select,input').forEach(x => { x.disabled = false; });
          toast(`Non pubblicato: ${error.message}`, true);
        }
      });
    }

    function openVideo() {
      const s = openSheet(`<div class="th-sheet-head"><div><h2>Aggiungi un link video</h2><p>Per video lunghi: caricali su Google Drive, YouTube o Vimeo e incolla qui il link.</p></div></div>
        <div class="th-sheet-body"><label class="th-field"><span>Titolo</span><input id="thVt" autocomplete="off"></label><label class="th-field"><span>Link</span><input id="thVu" type="url" placeholder="https://"></label></div>
        <div class="th-sheet-foot"><button type="button" class="th-btn th-btn--ghost" data-close>Annulla</button><button type="button" class="th-btn" data-ok>Salva link</button></div>`);
      $('#thVt', s.el).focus();
      $('[data-ok]', s.el).addEventListener('click', async () => {
        const title = $('#thVt', s.el).value.trim(), url = $('#thVu', s.el).value.trim();
        let okUrl = false;
        try { const u = new URL(url); okUrl = /^https?:$/.test(u.protocol) && (/(^|\.)(drive\.google\.com|youtube\.com|youtu\.be|vimeo\.com)$/.test(u.hostname.replace(/^www\./, '')) || /\.(mp4|webm|mov|m4v)$/i.test(u.pathname)); } catch (e) { okUrl = false; }
        if (!title) return toast('Scrivi un titolo per il video.', true);
        if (!okUrl) return toast('Usa un link di Google Drive, YouTube, Vimeo o un file video.', true);
        const slug = norm(title).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'video';
        const name = `video-${slug}-${Date.now()}.json`;
        try {
          s.el.dataset.busy = '1';
          await commitChanges({ adds: [{ path: `${folder}/${name}`, base64: utf8Base64(JSON.stringify({ type: 'video-link', title, url, createdAt: new Date().toISOString() }, null, 2)) }], message: `Aggiunto link video: ${title}` });
          delete s.el.dataset.busy; s.close(true);
          toast('Link video salvato');
          afterChange([{ name, title, url }]);
        } catch (error) { delete s.el.dataset.busy; toast(error.message, true); }
      });
    }

    picker.addEventListener('change', () => { if (picker.files.length) openUploader(picker.files); picker.value = ''; });
    replacer.addEventListener('change', () => { if (replacer.files.length) openUploader(replacer.files, replacer.dataset.target); replacer.value = ''; });
    $('[data-act="add"]', view).addEventListener('click', () => picker.click());
    $('[data-act="video"]', view).addEventListener('click', openVideo);
    $('[data-act="select"]', view).addEventListener('click', e => { selecting = !selecting; e.currentTarget.classList.toggle('is-on', selecting); render(); });
    bulkBtn.addEventListener('click', () => removeFiles(selected()));

    view._thDrop = picked => openUploader(picked);
    view._thRender = render;
    load();
  }

  // Trascina e rilascia ovunque nella pagina (solo admin, se c'è una cartella aperta).
  function setupDrop() {
    const overlay = document.createElement('div');
    overlay.className = 'th-drop';
    overlay.innerHTML = '<div>Rilascia per pubblicare<small>Le versioni vecchie verranno riconosciute e sostituite.</small></div>';
    document.body.appendChild(overlay);
    let depth = 0;
    const target = () => document.querySelector('[data-folder-view][data-mounted]');
    const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
    window.addEventListener('dragenter', e => { if (!isAdmin() || !target() || !hasFiles(e)) return; e.preventDefault(); depth += 1; overlay.classList.add('is-on'); });
    window.addEventListener('dragover', e => { if (isAdmin() && target() && hasFiles(e)) e.preventDefault(); });
    window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) overlay.classList.remove('is-on'); });
    window.addEventListener('drop', e => {
      if (!isAdmin() || !target() || !hasFiles(e)) return;
      e.preventDefault(); depth = 0; overlay.classList.remove('is-on');
      target()._thDrop?.(e.dataTransfer.files);
    });
  }

  // ------------------------------------------------------------------ conteggi sugli elenchi
  async function fillCounts() {
    const els = document.querySelectorAll('[data-count-folders]');
    if (!els.length) return;
    const index = await loadIndex();
    const countIn = folder => (index.folders?.[folder] || []).filter(f => isShown(f.name)).length;
    els.forEach(el => {
      const n = el.dataset.countFolders.split(' ').filter(Boolean).reduce((sum, f) => sum + countIn(f), 0);
      el.textContent = n === 0 ? 'nessun file' : n === 1 ? '1 file' : `${n} file`;
    });
  }

  // ------------------------------------------------------------------ filtro tessere (gestori)
  function setupTileFilter() {
    document.querySelectorAll('[data-filter-target]').forEach(input => {
      const target = document.getElementById(input.dataset.filterTarget);
      const empty = document.getElementById(input.dataset.filterEmpty);
      input.addEventListener('input', () => {
        const q = norm(input.value.trim());
        let shown = 0;
        target.querySelectorAll('[data-name]').forEach(t => { const ok = !q || norm(t.dataset.name).includes(q); t.hidden = !ok; if (ok) shown += 1; });
        if (empty) empty.hidden = shown > 0;
      });
    });
  }

  // ------------------------------------------------------------------ ricerca globale (home)
  async function setupSearch() {
    const input = document.getElementById('cerca');
    const out = document.getElementById('cercaRisultati');
    if (!input || !out) return;
    let entries = null;
    let active = -1;
    async function build() {
      if (entries) return entries;
      const [index, map] = await Promise.all([loadIndex(), loadMap()]);
      entries = [];
      Object.entries(index.folders || {}).forEach(([folder, list]) => {
        const where = map.folders?.[folder];
        if (!where) return;
        list.filter(f => isShown(f.name)).forEach(f => {
          const title = f.title || (isVideoLink(f.name) ? 'Video' : cleanName(f.name));
          entries.push({ kind: 'file', title, file: f, folder, where, hay: norm(`${title} ${f.name} ${where.path.join(' ')}`) });
        });
      });
      (map.pages || []).forEach(p => entries.push({ kind: 'page', title: p.path[p.path.length - 1], where: p, hay: norm(p.path.join(' ')) }));
      return entries;
    }
    function render(q) {
      const words = norm(q).split(/\s+/).filter(Boolean);
      if (!words.length) { out.hidden = true; out.innerHTML = ''; return; }
      const match = e => words.every(w => e.hay.includes(w));
      const pages = entries.filter(e => e.kind === 'page' && match(e)).sort((a, b) => a.where.path.length - b.where.path.length).slice(0, 4);
      const docs = entries.filter(e => e.kind === 'file' && match(e)).slice(0, 8);
      active = -1;
      if (!pages.length && !docs.length) { out.innerHTML = `<li class="th-results-none">Nessun risultato per “${esc(q)}”. Prova con il nome del gestore o del documento.</li>`; out.hidden = false; return; }
      out.innerHTML = (pages.length ? `<li class="th-results-kind">Sezioni</li>${pages.map(p => `<li><a href="${ROOT}${p.where.url}"><span class="th-file-type" style="background:var(--ink)"><i class="fa-solid fa-folder"></i></span><span><span class="th-file-name">${esc(p.where.path.join(' › '))}</span></span></a></li>`).join('')}` : '')
        + (docs.length ? `<li class="th-results-kind">Documenti</li>${docs.map((d, i) => { const t = fileType(d.file.name); return `<li><button type="button" data-doc="${i}"><span class="th-file-type ${t.cls}">${t.label}</span><span><span class="th-file-name">${esc(d.title)}</span><span class="th-file-meta">${esc(d.where.path.join(' › '))}</span></span></button></li>`; }).join('')}` : '');
      out.querySelectorAll('[data-doc]').forEach(b => b.addEventListener('click', () => openDoc(docs[Number(b.dataset.doc)])));
      out.hidden = false;
    }
    async function openDoc(d) {
      const path = `${d.folder}/${d.file.name}`;
      if (isVideoLink(d.file.name)) {
        let url = d.file.url;
        if (!url) { try { url = (await fetch(RAW + encodePath(path)).then(r => r.json())).url; } catch (e) { url = ''; } }
        if (url) window.open(url, '_blank', 'noopener'); else window.location.href = ROOT + d.where.url;
        return;
      }
      window.TOPHOUSE_PDF?.openPreview({ name: d.file.name, fileName: d.file.name, downloadUrl: RAW + encodePath(path), folderPath: d.folder });
    }
    // esempi che si scrivono da soli nel campo di ricerca (si fermano quando scrivi)
    const examples = ['enel cte business', 'modulistica hera', 'schede tecniche fotovoltaico', 'procedura voltura', 'sorgenia residenziale', 'offerte tim business'];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      let ex = 0, ch = 0, deleting = false;
      const type = () => {
        if (document.activeElement === input || input.value) { input.placeholder = 'Cerca un documento o un gestore'; setTimeout(type, 1200); return; }
        const word = examples[ex];
        ch += deleting ? -1 : 1;
        input.placeholder = `Cerca… ${word.slice(0, ch)}${deleting ? '' : '▍'}`;
        let wait = deleting ? 35 : 75;
        if (!deleting && ch >= word.length) { deleting = true; wait = 1600; }
        else if (deleting && ch <= 0) { deleting = false; ex = (ex + 1) % examples.length; wait = 350; }
        setTimeout(type, wait);
      };
      setTimeout(type, 1800);
    }
    input.addEventListener('focus', build, { once: true });
    input.addEventListener('input', async () => { await build(); render(input.value); });
    input.addEventListener('keydown', e => {
      const items = [...out.querySelectorAll('a,button')];
      if (!items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((it, i) => it.classList.toggle('is-active', i === active));
        items[active].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        (items[active] || items[0]).click();
      } else if (e.key === 'Escape') { out.hidden = true; }
    });
    document.addEventListener('click', e => { if (!e.target.closest('.th-search')) out.hidden = true; });
    if (window.location.hash === '#cerca') setTimeout(() => input.focus(), 100);
  }

  // ------------------------------------------------------------------ indici PUN / PSV (home)
  async function setupMeter() {
    const gauges = document.querySelectorAll('[data-gauge]');
    if (!gauges.length) return;
    let data;
    try { data = await fetch(`${ROOT}data/indici-energia.json?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()); }
    catch (e) { gauges.forEach(g => { $('.th-gauge-foot', g).textContent = 'Dati non disponibili al momento.'; }); return; }
    const fmt = (v, d = 5) => Number(v).toFixed(d).replace('.', ',');
    const date = iso => { const [y, m, d] = String(iso || '').split('-'); return d ? `${d}/${m}/${y}` : '—'; };
    gauges.forEach(g => {
      const key = g.dataset.gauge;
      const rows = (data.history || []).filter(r => r[key] !== null && r[key] !== undefined);
      const cur = data[key];
      if (!cur) return;
      // il valore "sale" fino al dato reale
      const valueEl = $('.th-gauge-value', g);
      valueEl.innerHTML = `<span>${fmt(0)}</span><small>${esc(cur.unit)}</small>`;
      const num = $('span', valueEl);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const t0 = performance.now(), dur = reduce ? 0 : 1100;
      const tick = now => {
        const k = dur ? Math.min(1, (now - t0) / dur) : 1;
        num.textContent = fmt(cur.value * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      const prev = rows[1]?.[key];
      const change = prev ? (cur.value / prev - 1) * 100 : null;
      const ch = $('.th-gauge-change', g);
      if (change !== null) {
        ch.textContent = `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2).replace('.', ',')}%`;
        ch.classList.add(change >= 0 ? 'up' : 'down');
        ch.title = 'Variazione rispetto al giorno precedente';
      }
      $('.th-gauge-foot', g).textContent = `Aggiornato al ${date(cur.date)} · fonte ${data.source || 'GME'}`;
      const series = rows.slice(0, 10).reverse().map(r => r[key]);
      const svg = $('.th-spark', g);
      if (series.length > 1 && svg) {
        const w = Math.max(160, Math.round(svg.getBoundingClientRect().width) || 300), h = 46;
        const min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
        const pts = series.map((v, i) => [(i / (series.length - 1)) * (w - 6) + 3, h - 4 - ((v - min) / span) * (h - 10)]);
        const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.innerHTML = `<defs><linearGradient id="thSparkGrad-${key}" x1="0" x2="1"><stop offset="0" stop-color="#c8102e"/><stop offset="1" stop-color="#f7941d"/></linearGradient>
          <linearGradient id="thSparkFill-${key}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e8302a" stop-opacity=".3"/><stop offset="1" stop-color="#e8302a" stop-opacity="0"/></linearGradient></defs>
          <path class="a" fill="url(#thSparkFill-${key})" d="${line} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z"/><path class="l" stroke="url(#thSparkGrad-${key})" d="${line}"/>
          <circle class="ring" cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="3.5"/>
          <circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="3.5" fill="var(--orange)"/>`;
        const path = $('path.l', svg);
        path.style.setProperty('--len', Math.ceil(path.getTotalLength()) + 2);
        svg.setAttribute('aria-label', `Andamento ultimi ${series.length} giorni`);
      }
    });
  }

  // ------------------------------------------------------------------ gestione file (admin)
  async function setupAdminPicker() {
    const select = document.getElementById('thFolderPick');
    const view = document.getElementById('thAdminFolder');
    if (!select || !view) return;
    const map = await loadMap();
    const groups = {};
    Object.entries(map.folders || {}).forEach(([folder, w]) => { (groups[w.path[0]] = groups[w.path[0]] || []).push({ folder, w }); });
    select.innerHTML = '<option value="">Scegli una cartella…</option>' + Object.entries(groups).map(([g, items]) => `<optgroup label="${esc(g)}">${items.map(({ folder, w }) => `<option value="${esc(folder)}">${esc(w.path.slice(1).join(' › ') || w.path[0])}</option>`).join('')}</optgroup>`).join('');
    const link = document.getElementById('thFolderLink');
    const open = () => {
      const folder = select.value;
      const w = map.folders[folder];
      if (!folder || !w) { view.hidden = true; return; }
      view.hidden = false;
      view.dataset.folder = folder;
      view.dataset.label = w.path[w.path.length - 1];
      view.dataset.crumbs = w.path.join(' › ');
      if (link) { link.href = ROOT + w.url; link.hidden = false; }
      try { sessionStorage.setItem('thAdminFolder', folder); } catch (e) { /* niente */ }
      mountFolder(view);
    };
    select.addEventListener('change', open);
    try { const last = sessionStorage.getItem('thAdminFolder'); if (last && map.folders[last]) { select.value = last; open(); } } catch (e) { /* niente */ }
  }

  // ------------------------------------------------------------------ avvio
  window.TOPHOUSE_GH = { getToken, ensureToken, forgetToken, commitChanges, listFolder, loadIndex, loadMap, cleanName, fileType, similarity, suggestReplacements, toast };

  function start() {
    document.querySelectorAll('[data-folder-view][data-folder]').forEach(mountFolder);
    setupDrop();
    fillCounts();
    setupTileFilter();
    setupSearch();
    setupMeter();
    setupAdminPicker();
    // ruolo confermato dopo il login: ridisegna le cartelle con i controlli giusti
    window.addEventListener('tophouse:role', () => document.querySelectorAll('[data-folder-view][data-mounted]').forEach(v => v._thRender?.()));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
