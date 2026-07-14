(function () {
  const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'zip', 'mp4', 'mov', 'webm', 'm4v'];
  const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v'];
  const VIDEO_MAX_BYTES = 95 * 1024 * 1024;
  const LARGE_FILE_WARNING_BYTES = 50 * 1024 * 1024;
  const ALLOWED_ACCEPT = ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',');

  function getExtension(fileName) {
    return String(fileName || '').split('.').pop().toLowerCase();
  }

  function isAllowedFile(file) {
    return ALLOWED_EXTENSIONS.includes(getExtension(file.name || file));
  }

  function isVideoFile(file) {
    return VIDEO_EXTENSIONS.includes(getExtension(file.name || file));
  }

  function getSafetyMessage(file) {
    if (!isAllowedFile(file)) return 'tipo file non consentito';
    if (isVideoFile(file) && file.size > VIDEO_MAX_BYTES) {
      return 'Video troppo grande per GitHub. Comprimi il video o caricalo su Drive e inserisci il link.';
    }
    return '';
  }

  function getLargeFileWarning(file) {
    if (file.size > LARGE_FILE_WARNING_BYTES) {
      return 'File grande: GitHub potrebbe avere problemi con file oltre 50 MB.';
    }
    return '';
  }

  function ensureStatusBox() {
    let box = document.getElementById('uploadStatus');
    if (!box) {
      const sidebar = document.querySelector('.sidebar-box');
      if (!sidebar) return null;
      box = document.createElement('div');
      box.id = 'uploadStatus';
      box.className = 'upload-status';
      box.style.cssText = 'margin-top:14px;font-size:14px;line-height:1.5;color:#333;';
      sidebar.appendChild(box);
    }
    return box;
  }

  function headers() {
    return { "Authorization": `token ${window.GITHUB_TOKEN || GITHUB_TOKEN}`, "Content-Type": "application/json" };
  }

  function readAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function getExistingSha(uploadUrl) {
    const response = await fetch(uploadUrl, { headers: headers() });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Verifica duplicato fallita (${response.status})`);
    const data = await response.json();
    return data.sha || null;
  }

  function renderSummary(results, target) {
    const counts = results.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
    target.innerHTML = `
      <strong>Riepilogo:</strong>
      <div>Caricati: ${counts.caricato || 0} · Aggiornati: ${counts.aggiornato || 0} · Duplicati: ${counts.duplicato || 0} · Avvisi: ${counts.avviso || 0} · Bloccati: ${counts.bloccato || 0} · Errori: ${counts.errore || 0}</div>
      <ul style="margin:8px 0 0 18px;padding:0;">${results.map(item => `<li><strong>${item.name}</strong>: ${item.status}${item.message ? ` (${item.message})` : ''}</li>`).join('')}</ul>`;
  }

  function splitFilesBySafety(fileList) {
    return Array.from(fileList || []).reduce((acc, file) => {
      const safetyMessage = getSafetyMessage(file);
      if (safetyMessage) acc.blocked.push({ file, message: safetyMessage });
      else acc.allowed.push(file);
      return acc;
    }, { allowed: [], blocked: [] });
  }

  async function uploadFiles(options) {
    const fileInput = document.getElementById(options.inputId || 'fileInput');
    if (fileInput) fileInput.setAttribute('accept', ALLOWED_ACCEPT);
    const statusBox = options.statusElement || ensureStatusBox();
    const { allowed: files, blocked } = splitFilesBySafety(fileInput?.files || []);
    const results = blocked.map(item => ({ name: item.file.name, status: 'bloccato', message: item.message }));
    files.forEach(file => {
      const warning = getLargeFileWarning(file);
      if (warning) results.push({ name: file.name, status: 'avviso', message: warning });
    });
    if (!files.length) {
      if (statusBox && results.length) renderSummary(results, statusBox);
      else alert(`Seleziona almeno un file consentito (${ALLOWED_ACCEPT}).`);
      return results;
    }

    const owner = options.owner || window.OWNER || OWNER;
    const repo = options.repo || window.REPO || REPO;
    const folderPath = options.folderPath || window.FOLDER_PATH || FOLDER_PATH;
    const overwrite = Boolean(options.overwrite);
    const progress = options.progressElement;

    if (statusBox) statusBox.innerHTML = `Caricamento di ${files.length} file in corso...`;
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (progress) progress.value = Math.round((index / files.length) * 100);
      const uploadUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${folderPath}/${encodeURIComponent(file.name)}`;
      try {
        const existingSha = await getExistingSha(uploadUrl);
        if (existingSha && !overwrite) {
          results.push({ name: file.name, status: 'duplicato', message: 'già esistente' });
          continue;
        }
        const content = await readAsBase64(file);
        const body = { message: `${existingSha ? 'Aggiornato' : 'Caricato'} file: ${file.name}`, content };
        if (existingSha) body.sha = existingSha;
        const response = await fetch(uploadUrl, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }
        results.push({ name: file.name, status: existingSha ? 'aggiornato' : 'caricato' });
      } catch (error) {
        results.push({ name: file.name, status: 'errore', message: error.message || 'errore sconosciuto' });
      }
      if (statusBox) statusBox.textContent = `Elaborati ${index + 1} di ${files.length} file...`;
    }
    if (progress) progress.value = 100;
    if (statusBox) renderSummary(results, statusBox);
    fileInput.value = '';
    if (typeof options.onComplete === 'function') options.onComplete(results);
    else if (typeof window.loadFiles === 'function') setTimeout(window.loadFiles, 1500);
    return results;
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[type="file"]').forEach(input => input.setAttribute('accept', ALLOWED_ACCEPT));
  });

  window.TOPHOUSE_UPLOAD = { uploadFiles, renderSummary, isAllowedFile, isVideoFile, splitFilesBySafety, ALLOWED_EXTENSIONS, ALLOWED_ACCEPT, VIDEO_MAX_BYTES, LARGE_FILE_WARNING_BYTES };
})();
