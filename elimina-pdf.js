(function () {
  if (window.location.pathname.split('/').pop() !== 'admin-caricamento.html') return;

  const OWNER = 'laminetallth';
  const REPO = 'TOP-HOUSE';
  const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/`;

  function authHeaders() {
    return { Authorization: `token ${window.GITHUB_TOKEN || GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' };
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  async function listFolder(path) {
    const res = await fetch(API + path, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Impossibile leggere la cartella (${res.status})`);
    const data = await res.json();
    return Array.isArray(data) ? data.filter(item => item.type === 'file') : [];
  }

  async function deleteFile(item) {
    const res = await fetch(API + item.path, {
      method: 'DELETE',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Eliminato file: ${item.name}`, sha: item.sha })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `HTTP ${res.status}`);
    }
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #deleteManagerBox{margin-top:24px}
      .delete-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:16px 0}
      .delete-toolbar label{display:flex;align-items:center;gap:8px;margin:0;font-weight:800}
      .delete-toolbar input{width:18px;height:18px}
      .delete-btn{border:0;border-radius:14px;padding:12px 16px;background:#111;color:#fff;font-weight:900;cursor:pointer}
      .delete-btn:hover{background:#ff0055}
      .delete-btn:disabled{opacity:.45;cursor:not-allowed}
      .delete-list{display:grid;gap:8px;max-height:460px;overflow:auto}
      .delete-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:#fafafa;border:1px solid #eee}
      .delete-item input{width:18px;height:18px;flex:0 0 auto}
      .delete-item .name{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
      .delete-item i{color:#ff6a00}
      .delete-empty{color:#777;padding:18px;text-align:center;background:#fafafa;border-radius:14px}
      .delete-status{margin-top:12px;padding:12px 14px;border-radius:14px;background:#fff7f0;font-weight:700;line-height:1.45}
    `;
    document.head.appendChild(style);
  }

  function buildUI() {
    const panel = document.querySelector('.panel');
    if (!panel || document.getElementById('deleteManagerBox')) return;
    const box = document.createElement('section');
    box.id = 'deleteManagerBox';
    box.className = 'card';
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="width:48px;height:48px;border-radius:16px;background:linear-gradient(135deg,#ff0055,#ff9900);display:grid;place-items:center;color:#fff;font-size:21px"><i class="fa-solid fa-trash-can"></i></div>
        <div><h2>Gestione documenti</h2><p class="hint">Seleziona più file e cancellali in un'unica operazione.</p></div>
      </div>
      <div class="delete-toolbar">
        <label><input type="checkbox" id="deleteSelectAll"> Seleziona tutti</label>
        <button class="delete-btn" id="deleteSelectedBtn" type="button" disabled><i class="fa-solid fa-trash"></i> Elimina selezionati</button>
      </div>
      <div id="deleteList" class="delete-list"><div class="delete-empty">Caricamento file...</div></div>
      <div id="deleteStatus" class="delete-status" hidden></div>`;
    panel.insertBefore(box, panel.firstElementChild);

    document.getElementById('deleteSelectAll').addEventListener('change', e => {
      document.querySelectorAll('#deleteList input[data-file]').forEach(input => input.checked = e.target.checked);
      updateDeleteButton();
    });
    document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelected);
    document.getElementById('deleteList').addEventListener('change', e => {
      if (e.target.matches('input[data-file]')) updateDeleteButton();
    });
  }

  function updateDeleteButton() {
    const count = document.querySelectorAll('#deleteList input[data-file]:checked').length;
    const btn = document.getElementById('deleteSelectedBtn');
    if (btn) { btn.disabled = !count; btn.innerHTML = `<i class="fa-solid fa-trash"></i> Elimina ${count ? `${count} selezionati` : 'selezionati'}`; }
  }

  async function refreshDeleteList() {
    const manager = document.getElementById('managerSelect')?.value;
    const folder = document.getElementById('folderSelect')?.value;
    if (!manager || !folder) return;
    const list = document.getElementById('deleteList');
    const status = document.getElementById('deleteStatus');
    list.innerHTML = '<div class="delete-empty"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento...</div>';
    document.getElementById('deleteSelectAll').checked = false;
    updateDeleteButton();
    try {
      const files = await listFolder(`documenti/${manager}/${folder}`);
      const docs = files.filter(file => /\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|zip|mp4|mov|webm|m4v)$/i.test(file.name));
      list.innerHTML = docs.length ? docs.map((file, i) => `
        <label class="delete-item">
          <input type="checkbox" data-file='${esc(JSON.stringify({path:file.path,sha:file.sha,name:file.name}))}'>
          <i class="fa-solid fa-file-pdf"></i><span class="name" title="${esc(file.name)}">${esc(file.name)}</span>
        </label>`).join('') : '<div class="delete-empty">Nessun file presente in questa cartella.</div>';
      if (status) status.hidden = true;
    } catch (error) {
      list.innerHTML = `<div class="delete-empty">Errore: ${esc(error.message)}</div>`;
    }
  }

  async function deleteSelected() {
    const inputs = [...document.querySelectorAll('#deleteList input[data-file]:checked')];
    if (!inputs.length) return;
    const files = inputs.map(input => JSON.parse(input.dataset.file));
    const names = files.slice(0, 5).map(file => file.name).join('\n');
    const extra = files.length > 5 ? `\n... e altri ${files.length - 5}` : '';
    if (!confirm(`Vuoi eliminare definitivamente ${files.length} file?\n\n${names}${extra}`)) return;

    const btn = document.getElementById('deleteSelectedBtn');
    const status = document.getElementById('deleteStatus');
    btn.disabled = true;
    status.hidden = false;
    status.textContent = `Eliminazione di ${files.length} file in corso...`;
    let ok = 0;
    const errors = [];
    for (const file of files) {
      try { await deleteFile(file); ok++; }
      catch (error) { errors.push(`${file.name}: ${error.message}`); }
      status.textContent = `Eliminati ${ok} di ${files.length} file...`;
    }
    status.textContent = errors.length ? `Eliminati ${ok} file. Errori: ${errors.join(' | ')}` : `✅ ${ok} file eliminati correttamente.`;
    await refreshDeleteList();
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    buildUI();
    const manager = document.getElementById('managerSelect');
    const folder = document.getElementById('folderSelect');
    manager?.addEventListener('change', () => setTimeout(refreshDeleteList, 50));
    folder?.addEventListener('change', () => setTimeout(refreshDeleteList, 50));
    setTimeout(refreshDeleteList, 300);
  });
})();
