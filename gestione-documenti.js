// Selezione multipla e cancellazione rapida dei PDF direttamente nelle cartelle TOP HOUSE.
(() => {
  function isPdf(name) { return /\.pdf$/i.test(name || ''); }

  function getConfig() {
    return {
      owner: window.OWNER || 'laminetallth',
      repo: window.REPO || 'TOP-HOUSE',
      folder: window.FOLDER_PATH || window.CURRENT_FOLDER || ''
    };
  }

  function getToken() {
    try { return window.GITHUB_TOKEN || GITHUB_TOKEN; } catch (_) { return window.GITHUB_TOKEN; }
  }

  function headers() {
    const token = getToken();
    return {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `token ${token}` } : {})
    };
  }

  async function getFolderFiles() {
    const { owner, repo, folder } = getConfig();
    if (!folder) throw new Error('Percorso della cartella non disponibile.');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${folder.split('/').map(encodeURIComponent).join('/')}`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`Impossibile leggere la cartella (${res.status}).`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  function injectStyles() {
    if (document.getElementById('gestione-documenti-style')) return;
    const style = document.createElement('style');
    style.id = 'gestione-documenti-style';
    style.textContent = `
      .th-doc-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 18px;padding:12px 14px;background:#fff;border:1px solid #eee;border-radius:16px;box-shadow:0 4px 14px rgba(0,0,0,.05)}
      .th-doc-select-all{display:flex;align-items:center;gap:8px;font-weight:700;cursor:pointer;margin-right:auto}
      .th-doc-select-all input,.th-file-check{width:18px;height:18px;accent-color:#ff0055;cursor:pointer}
      .th-delete-selected{border:0;border-radius:12px;padding:10px 15px;font-weight:800;color:#fff;background:linear-gradient(135deg,#ff0055,#ff9900);cursor:pointer;transition:.15s}
      .th-delete-selected:disabled{opacity:.45;cursor:not-allowed}
      .th-delete-selected:not(:disabled):hover{transform:translateY(-1px)}
      .th-file-select{display:flex;align-items:center;justify-content:center;min-width:34px;margin-right:4px}
      .file-item-wrapper.th-selectable{display:flex;align-items:center;gap:4px}
      .file-item-wrapper.th-selectable > .file-link{flex:1}
      .th-delete-status{width:100%;font-size:13px;font-weight:600}
    `;
    document.head.appendChild(style);
  }

  function setup() {
    const container = document.querySelector('.pdf-container');
    if (!container) return;

    // Funzione pensata per gli admin: non mostrare controlli ai venditori.
    const email = (window.currentUserEmail || window.userEmail || window.USER_EMAIL || '').toLowerCase();
    const roles = window.USER_ROLES || {};
    const isAdmin = roles[email] === 'admin' || document.body.classList.contains('admin');
    if (!isAdmin && Object.keys(roles).length) return;

    injectStyles();

    const toolbar = document.createElement('div');
    toolbar.className = 'th-doc-toolbar';
    toolbar.innerHTML = `
      <label class="th-doc-select-all"><input type="checkbox" id="th-select-all"> Seleziona tutti i PDF</label>
      <button type="button" class="th-delete-selected" id="th-delete-selected" disabled>Elimina selezionati (0)</button>
      <div class="th-delete-status" id="th-delete-status"></div>
    `;
    container.prepend(toolbar);

    const selectAll = toolbar.querySelector('#th-select-all');
    const deleteBtn = toolbar.querySelector('#th-delete-selected');
    const status = toolbar.querySelector('#th-delete-status');

    function boxes() { return [...container.querySelectorAll('.th-file-check')]; }
    function update() {
      const all = boxes();
      const selected = all.filter(x => x.checked);
      deleteBtn.disabled = selected.length === 0;
      deleteBtn.textContent = `Elimina selezionati (${selected.length})`;
      selectAll.checked = all.length > 0 && selected.length === all.length;
      selectAll.indeterminate = selected.length > 0 && selected.length < all.length;
    }

    function addCheckboxes() {
      container.querySelectorAll('.file-item-wrapper').forEach(item => {
        if (item.querySelector('.th-file-check')) return;
        const link = item.querySelector('.file-link');
        const text = item.textContent || '';
        if (!link || !isPdf(link.getAttribute('href') || text)) return;
        item.classList.add('th-selectable');
        const name = link.textContent.trim() || link.getAttribute('title') || 'PDF';
        const wrap = document.createElement('label');
        wrap.className = 'th-file-select';
        wrap.title = 'Seleziona PDF';
        wrap.innerHTML = `<input class="th-file-check" type="checkbox" aria-label="Seleziona ${name.replace(/"/g, '&quot;')}">`;
        item.prepend(wrap);
        wrap.querySelector('input').addEventListener('change', update);
      });
      update();
    }

    selectAll.addEventListener('change', () => boxes().forEach(x => { x.checked = selectAll.checked; }));
    selectAll.addEventListener('change', update);

    deleteBtn.addEventListener('click', async () => {
      const selected = boxes().filter(x => x.checked).map(x => {
        const item = x.closest('.file-item-wrapper');
        const link = item?.querySelector('.file-link');
        return { item, name: (link?.textContent || '').trim() };
      }).filter(x => x.name);
      if (!selected.length) return;
      const preview = selected.slice(0, 5).map(x => `• ${x.name}`).join('\n');
      const more = selected.length > 5 ? `\n… e altri ${selected.length - 5}` : '';
      if (!confirm(`Vuoi eliminare definitivamente ${selected.length} PDF?\n\n${preview}${more}`)) return;

      deleteBtn.disabled = true;
      status.textContent = 'Recupero dei file…';
      try {
        const files = await getFolderFiles();
        const byName = new Map(files.filter(f => f.type === 'file').map(f => [f.name, f]));
        let done = 0;
        for (const file of selected) {
          const remote = byName.get(file.name);
          if (!remote?.sha) throw new Error(`SHA non trovato per ${file.name}.`);
          const { owner, repo, folder } = getConfig();
          const path = `${folder.replace(/\/$/, '')}/${remote.name}`;
          status.textContent = `Eliminazione ${++done}/${selected.length}: ${remote.name}`;
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
            method: 'DELETE', headers: headers(), body: JSON.stringify({ message: `Elimina PDF ${remote.name}`, sha: remote.sha })
          });
          if (!res.ok) throw new Error(`Errore eliminando ${remote.name} (${res.status}).`);
        }
        status.textContent = `${selected.length} PDF eliminati. Aggiornamento…`;
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        console.error(err);
        status.textContent = `Errore: ${err.message}`;
        update();
      }
    });

    addCheckboxes();
    // Le liste PDF possono essere renderizzate asincronamente: osserviamo il container.
    const observer = new MutationObserver(() => addCheckboxes());
    observer.observe(container, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
