// TOP HOUSE — gestione cartelle documenti (lettura, caricamento, eliminazione).
//
// SICUREZZA: questo file NON contiene token. Per caricare o eliminare file l'admin
// incolla il proprio token GitHub personale, che resta salvato solo sul suo
// dispositivo (localStorage). I venditori leggono l'elenco dei file da
// data/documenti-index.json, generato automaticamente da GitHub Actions.
(function () {
  const OWNER = 'laminetallth';
  const REPO = 'TOP-HOUSE';
  const BRANCH = 'main';
  const TOKEN_KEY = 'topHouseGithubToken';
  const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/`;

  // Radice del sito, ricavata dalla posizione di questo script (funziona anche nelle sottocartelle).
  const ROOT = (() => {
    try { return new URL('./', document.currentScript.src).href; }
    catch (error) { return new URL('./', window.location.href).href; }
  })();

  function encodePath(path) {
    return String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function currentRole() {
    try { return window.TOPHOUSE_AUTH?.getCurrentRole?.() || sessionStorage.getItem('topHouseUserRole') || ''; }
    catch (error) { return ''; }
  }

  function isAdmin() { return currentRole() === 'admin'; }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (error) { return ''; }
  }

  function forgetToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (error) { /* niente */ }
    refreshTokenBadges();
  }

  async function ensureToken() {
    const saved = getToken();
    if (saved) return saved;
    if (!isAdmin()) { alert('Accesso riservato agli admin.'); return ''; }
    const typed = (prompt(
      'Per caricare o eliminare file serve il tuo token GitHub personale.\n\n' +
      'Crealo su github.com/settings/tokens (fine-grained, solo repository TOP-HOUSE, permesso "Contents: Read and write") e incollalo qui.\n\n' +
      'Resta salvato solo su questo dispositivo.'
    ) || '').trim();
    if (!typed) return '';
    try {
      const response = await fetch(API, { headers: { Authorization: `Bearer ${typed}`, Accept: 'application/vnd.github+json' } });
      if (!response.ok) { alert('Token non valido o senza accesso al Drive. Controllalo e riprova.'); return ''; }
    } catch (error) {
      alert('Impossibile verificare il token: controlla la connessione.');
      return '';
    }
    try { localStorage.setItem(TOKEN_KEY, typed); } catch (error) { /* modalità privata: vale solo per questa pagina */ }
    refreshTokenBadges();
    return typed;
  }

  function authHeaders(token = getToken(), json = false) {
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  // Gestisce token scaduti/revocati: lo dimentica così al prossimo tentativo viene richiesto.
  async function githubFetch(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 401) {
      forgetToken();
      throw new Error('Token GitHub scaduto o revocato: riprova e incolla un token nuovo.');
    }
    return response;
  }

  function contentsUrl(path) { return `${API}/contents/${encodePath(path)}`; }
  function rawUrl(path) { return RAW + encodePath(path); }

  let indexPromise = null;
  function loadIndex(force = false) {
    if (!indexPromise || force) {
      indexPromise = fetch(`${ROOT}data/documenti-index.json?t=${Date.now()}`, { cache: 'no-store' })
        .then(response => (response.ok ? response.json() : null))
        .catch(() => null);
    }
    return indexPromise;
  }

  // Restituisce i file di una cartella: [{ name, path, sha?, size? }]
  async function listFolder(folder) {
    const token = getToken();
    if (token && isAdmin()) {
      try {
        const response = await githubFetch(`${contentsUrl(folder)}?ref=${BRANCH}&t=${Date.now()}`, { headers: authHeaders(token), cache: 'no-store' });
        if (response.status === 404) return [];
        if (response.ok) {
          const data = await response.json();
          return (Array.isArray(data) ? data : []).filter(item => item.type === 'file').map(item => ({ name: item.name, path: item.path, sha: item.sha, size: item.size }));
        }
      } catch (error) { console.warn('TOP HOUSE: lettura con token non riuscita, uso l\'indice.', error); }
    }
    const index = await loadIndex();
    if (index && index.folders) {
      return (index.folders[folder] || []).map(item => ({ name: item.name, path: `${folder}/${item.name}`, size: item.size }));
    }
    // Ultima possibilità: API pubblica senza token (limite di 60 richieste/ora).
    const response = await fetch(contentsUrl(folder), { headers: authHeaders('') });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`Impossibile leggere la cartella (${response.status}).`);
    const data = await response.json();
    return (Array.isArray(data) ? data : []).filter(item => item.type === 'file').map(item => ({ name: item.name, path: item.path, sha: item.sha, size: item.size }));
  }

  async function getSha(path, token) {
    const response = await githubFetch(`${contentsUrl(path)}?ref=${BRANCH}`, { headers: authHeaders(token) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Verifica file non riuscita (${response.status}).`);
    const data = await response.json();
    return data.sha || null;
  }

  async function deletePath(path, sha, token) {
    const realSha = sha || await getSha(path, token);
    if (!realSha) throw new Error('file non trovato');
    const name = path.split('/').pop();
    const response = await githubFetch(contentsUrl(path), {
      method: 'DELETE',
      headers: authHeaders(token, true),
      body: JSON.stringify({ message: `Eliminato file: ${name}`, sha: realSha, branch: BRANCH })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `HTTP ${response.status}`);
    }
  }

  // Badge "token collegato" nella colonna di caricamento (solo admin).
  function refreshTokenBadges() {
    document.querySelectorAll('.th-token-status').forEach(box => {
      const connected = Boolean(getToken());
      box.innerHTML = connected
        ? '<i class="fa-solid fa-circle-check"></i> Token GitHub collegato su questo dispositivo · <button type="button" class="th-token-forget">Scollega</button>'
        : '<i class="fa-solid fa-key"></i> Al primo caricamento ti verrà chiesto il token GitHub.';
      box.querySelector('.th-token-forget')?.addEventListener('click', () => {
        if (confirm('Scollegare il token GitHub da questo dispositivo?')) forgetToken();
      });
    });
  }

  function addTokenBadge(container) {
    if (!container || container.querySelector('.th-token-status')) return;
    const box = document.createElement('div');
    box.className = 'th-token-status';
    box.style.cssText = 'margin-top:12px;font-size:13px;line-height:1.5;color:#6f6a7c';
    container.appendChild(box);
    refreshTokenBadges();
  }

  window.TOPHOUSE_GH = { OWNER, REPO, BRANCH, ROOT, getToken, ensureToken, forgetToken, authHeaders, githubFetch, contentsUrl, rawUrl, listFolder, getSha, deletePath, loadIndex, encodePath, escapeHtml, isAdmin, addTokenBadge };

  // ---------------------------------------------------------------------------
  // Pagina cartella: <div class="pdf-container" id="pdfContainer" data-folder="documenti/...">
  // ---------------------------------------------------------------------------
  const container = document.getElementById('pdfContainer');
  const FOLDER = container?.dataset.folder || '';
  if (!container || !FOLDER) return;

  window.OWNER = OWNER;
  window.REPO = REPO;
  window.FOLDER_PATH = FOLDER;

  function setEmpty(text, isError = false) {
    container.innerHTML = `<div class="empty"${isError ? ' style="color:#c1121f"' : ''}>${escapeHtml(text)}</div>`;
  }

  function injectStyles() {
    if (document.getElementById('th-folder-style')) return;
    const style = document.createElement('style');
    style.id = 'th-folder-style';
    style.textContent = `
      .th-doc-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 14px;padding:12px 16px;background:#fafafa;border-radius:16px;font-weight:700}
      .th-doc-toolbar label{display:flex;align-items:center;gap:8px;cursor:pointer;margin-right:auto}
      .th-doc-toolbar input,.th-file-check{width:18px;height:18px;accent-color:#ff0055;cursor:pointer;flex:0 0 auto}
      .th-delete-selected{border:0;border-radius:12px;padding:10px 15px;font-weight:800;color:#fff;background:#cc0000;cursor:pointer}
      .th-delete-selected:disabled{opacity:.45;cursor:not-allowed}
      .th-file-check{margin-right:12px}
      .th-token-status button{border:0;background:none;color:#ff0055;font-weight:800;cursor:pointer;padding:0}`;
    document.head.appendChild(style);
  }

  function buildToolbar() {
    const bar = document.createElement('div');
    bar.className = 'th-doc-toolbar admin-only';
    bar.setAttribute('data-admin-only', '');
    bar.innerHTML = '<label><input type="checkbox" class="th-select-all"> Seleziona tutti</label><button type="button" class="th-delete-selected" disabled><i class="fa-solid fa-trash-can"></i> Elimina selezionati (0)</button>';
    const selectAll = bar.querySelector('.th-select-all');
    const button = bar.querySelector('.th-delete-selected');
    const boxes = () => [...container.querySelectorAll('.th-file-check')];
    const update = () => {
      const all = boxes();
      const selected = all.filter(box => box.checked);
      button.disabled = !selected.length;
      button.innerHTML = `<i class="fa-solid fa-trash-can"></i> Elimina selezionati (${selected.length})`;
      selectAll.checked = all.length > 0 && selected.length === all.length;
      selectAll.indeterminate = selected.length > 0 && selected.length < all.length;
    };
    selectAll.addEventListener('change', () => { boxes().forEach(box => { box.checked = selectAll.checked; }); update(); });
    container.addEventListener('change', event => { if (event.target.classList.contains('th-file-check')) update(); });
    button.addEventListener('click', async () => {
      const selected = boxes().filter(box => box.checked).map(box => ({ path: box.dataset.path, sha: box.dataset.sha, name: box.dataset.name }));
      if (!selected.length) return;
      const preview = selected.slice(0, 5).map(item => `• ${item.name}`).join('\n');
      const more = selected.length > 5 ? `\n… e altri ${selected.length - 5}` : '';
      if (!confirm(`Vuoi eliminare definitivamente ${selected.length} file?\n\n${preview}${more}`)) return;
      const token = await ensureToken();
      if (!token) return;
      button.disabled = true;
      const errors = [];
      for (let i = 0; i < selected.length; i += 1) {
        button.textContent = `Eliminazione ${i + 1}/${selected.length}…`;
        try { await deletePath(selected[i].path, selected[i].sha, token); }
        catch (error) { errors.push(`${selected[i].name}: ${error.message}`); }
      }
      alert(errors.length ? `Eliminati ${selected.length - errors.length} file.\nErrori:\n${errors.join('\n')}` : `${selected.length} file eliminati.`);
      loadFiles();
    });
    return bar;
  }

  let renderedAsAdmin = false;
  async function loadFiles() {
    injectStyles();
    try {
      const files = (await listFolder(FOLDER)).filter(file => window.TOPHOUSE_PDF?.isDisplayableFile(file.name));
      files.sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true, sensitivity: 'base' }));
      container.innerHTML = '';
      if (!files.length) { setEmpty('Nessun file caricato'); return; }
      const admin = isAdmin();
      renderedAsAdmin = admin;
      if (admin) container.appendChild(buildToolbar());
      files.forEach(file => {
        const item = window.TOPHOUSE_PDF.createPdfListItem(file, { downloadUrl: rawUrl(file.path), folderPath: FOLDER, onDelete: 'deleteFile' });
        if (admin) {
          const check = document.createElement('input');
          check.type = 'checkbox';
          check.className = 'th-file-check';
          check.dataset.path = file.path;
          check.dataset.name = file.name;
          if (file.sha) check.dataset.sha = file.sha;
          check.setAttribute('aria-label', `Seleziona ${file.name}`);
          check.addEventListener('click', event => event.stopPropagation());
          const link = item.querySelector('.file-link');
          if (link) link.insertBefore(check, link.firstChild); else item.insertBefore(check, item.firstChild);
        }
        container.appendChild(item);
      });
    } catch (error) {
      console.error('TOP HOUSE:', error);
      setEmpty('Errore nel recupero dei file. Riprova tra poco.', true);
    }
  }

  async function deleteFile(fileName, fileSha) {
    if (!isAdmin()) return;
    if (!confirm(`Sei sicuro di voler eliminare definitivamente il file "${fileName}"?`)) return;
    const token = await ensureToken();
    if (!token) return;
    try {
      await deletePath(`${FOLDER}/${fileName}`, fileSha, token);
      alert('File eliminato con successo!');
      loadFiles();
    } catch (error) {
      alert(`Errore durante l'eliminazione: ${error.message}`);
    }
  }

  async function uploadFile() {
    await window.TOPHOUSE_UPLOAD.uploadFiles({ folderPath: FOLDER, overwrite: true, onComplete: () => setTimeout(loadFiles, 800) });
  }

  window.loadFiles = loadFiles;
  window.deleteFile = deleteFile;
  window.uploadFile = uploadFile;

  document.querySelectorAll('.sidebar-box').forEach((box, i) => { if (i === 0) addTokenBadge(box); });
  // Se il ruolo admin viene confermato dopo il primo caricamento (nuova scheda), ridisegna con i controlli admin.
  window.addEventListener('tophouse:role', event => { if (event.detail?.role === 'admin' && !renderedAsAdmin) loadFiles(); });
  loadFiles();
})();
