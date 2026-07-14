(function () {
  const STORAGE_KEY = 'topHousePdfFavorites';
  const PAGES_BASE_URL = 'https://laminetallth.github.io/TOP-HOUSE/';
  const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'zip', 'mp4', 'mov', 'webm', 'm4v'];
  const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png'];
  const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v'];
  const HTML5_VIDEO_EXTENSIONS = ['mp4', 'webm'];

  function getExtension(fileName) {
    return String(fileName || '').split('.').pop().toLowerCase();
  }

  function isAllowedFile(fileName) {
    return ALLOWED_EXTENSIONS.includes(getExtension(fileName));
  }

  function isVideoLinkFile(fileName) {
    return getExtension(fileName) === 'json' && String(fileName || '').toLowerCase().startsWith('video-');
  }

  function isDisplayableFile(file) {
    const name = typeof file === 'string' ? file : file?.name;
    return isAllowedFile(name) || isVideoLinkFile(name);
  }

  function isPdf(fileName) { return getExtension(fileName) === 'pdf'; }
  function isImage(fileName) { return IMAGE_EXTENSIONS.includes(getExtension(fileName)); }
  function isVideo(fileName) { return VIDEO_EXTENSIONS.includes(getExtension(fileName)); }
  function canPreviewVideo(fileName) { return HTML5_VIDEO_EXTENSIONS.includes(getExtension(fileName)); }

  function getFileIcon(fileName) {
    const ext = getExtension(fileName);
    if (ext === 'pdf') return 'fa-file-pdf file-icon-pdf';
    if (['doc', 'docx'].includes(ext)) return 'fa-file-word file-icon-word';
    if (['xls', 'xlsx'].includes(ext)) return 'fa-file-excel file-icon-excel';
    if (['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint file-icon-powerpoint';
    if (IMAGE_EXTENSIONS.includes(ext)) return 'fa-file-image file-icon-image';
    if (VIDEO_EXTENSIONS.includes(ext)) return 'fa-file-video file-icon-video';
    if (ext === 'zip') return 'fa-file-zipper file-icon-zip';
    return 'fa-file file-icon-generic';
  }

  function encodePath(path) {
    return (path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  }

  function buildPreviewUrl(folderPath, fileName) {
    const encodedPath = encodePath([folderPath, fileName].filter(Boolean).join('/'));
    return encodedPath ? `${PAGES_BASE_URL}${encodedPath}` : '#';
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value) || fallback; } catch (error) { return fallback; }
  }

  function getFavorites() { return safeParse(localStorage.getItem(STORAGE_KEY), []); }
  function saveFavorites(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }

  function normalizePdf(input) {
    const folderPath = input.folderPath || '';
    const parts = folderPath.split('/').filter(Boolean);
    const name = input.name || input.fileName || input.title || 'Documento senza nome';
    const isVideoLink = input.type === 'video-link' || isVideoLinkFile(input.fileName || input.name);
    return {
      name,
      title: input.title || name,
      type: isVideoLink ? 'video-link' : (input.type || 'file'),
      url: input.url || input.downloadUrl || input.rawUrl || '#',
      downloadUrl: input.downloadUrl || input.url || input.rawUrl || '#',
      previewUrl: input.previewUrl || buildPreviewUrl(folderPath, input.fileName || name),
      manager: input.manager || parts[1] || 'TOP HOUSE',
      section: input.section || parts.slice(2).join(' / ') || folderPath || 'Documenti',
      folderPath,
      savedAt: input.savedAt || input.createdAt || new Date().toISOString()
    };
  }

  function favoriteId(pdf) { return `${pdf.downloadUrl}|${pdf.name}`; }
  function isFavorite(pdf) { const normalized = normalizePdf(pdf); return getFavorites().some(item => favoriteId(item) === favoriteId(normalized)); }
  function toggleFavorite(pdf) {
    const normalized = normalizePdf(pdf);
    const id = favoriteId(normalized);
    const favorites = getFavorites();
    const index = favorites.findIndex(item => favoriteId(item) === id);
    if (index >= 0) { favorites.splice(index, 1); saveFavorites(favorites); return false; }
    favorites.unshift(normalized); saveFavorites(favorites); return true;
  }
  function removeFavorite(pdf) { const normalized = normalizePdf(pdf); saveFavorites(getFavorites().filter(item => favoriteId(item) !== favoriteId(normalized))); }

  function openPreview(pdf) {
    const normalized = normalizePdf(pdf);
    const canPreview = isPdf(normalized.name) || isImage(normalized.name) || canPreviewVideo(normalized.name);
    if (!canPreview) { window.open(normalized.downloadUrl, '_blank', 'noopener'); return; }
    let modal = document.getElementById('pdfPreviewModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pdfPreviewModal';
      modal.className = 'pdf-modal';
      modal.innerHTML = `
        <div class="pdf-modal-panel" role="dialog" aria-modal="true" aria-labelledby="pdfPreviewTitle">
          <div class="pdf-modal-header">
            <h2 id="pdfPreviewTitle"></h2>
            <button type="button" class="pdf-modal-close" aria-label="Chiudi anteprima"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="pdf-modal-content"></div>
          <div class="pdf-modal-actions">
            <a class="pdf-modal-download" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Apri / Scarica</a>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', event => { if (event.target === modal) closePreview(); });
      modal.querySelector('.pdf-modal-close').addEventListener('click', closePreview);
      document.addEventListener('keydown', event => { if (event.key === 'Escape') closePreview(); });
    }
    modal.querySelector('#pdfPreviewTitle').textContent = normalized.name;
    const content = modal.querySelector('.pdf-modal-content');
    if (isImage(normalized.name)) {
      content.innerHTML = '<img class="pdf-modal-frame" alt="Anteprima immagine">';
      content.querySelector('img').src = normalized.previewUrl;
    } else if (canPreviewVideo(normalized.name)) {
      content.innerHTML = '<video class="pdf-modal-frame" controls preload="metadata"></video>';
      content.querySelector('video').src = normalized.previewUrl;
    } else {
      content.innerHTML = `<object class="pdf-modal-frame" type="application/pdf"><div class="pdf-modal-fallback"><p>Anteprima non disponibile su questo dispositivo. Apri il documento in una nuova scheda.</p><a class="pdf-modal-open-link" target="_blank" rel="noopener">Apri documento</a></div></object>`;
      const frame = content.querySelector('.pdf-modal-frame');
      frame.data = normalized.previewUrl;
      content.querySelector('.pdf-modal-open-link').href = normalized.downloadUrl;
    }
    modal.querySelector('.pdf-modal-download').href = normalized.downloadUrl;
    modal.classList.add('is-open');
    document.body.classList.add('pdf-modal-open');
  }

  function closePreview() {
    const modal = document.getElementById('pdfPreviewModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    const frame = modal.querySelector('.pdf-modal-frame');
    if (frame) { if ('data' in frame) frame.data = 'about:blank'; if ('src' in frame) frame.src = ''; }
    document.body.classList.remove('pdf-modal-open');
  }

  function createPdfListItem(file, options) {
    const isVideoLink = isVideoLinkFile(file.name);
    const pdf = normalizePdf({ name: file.name, fileName: file.name, type: isVideoLink ? 'video-link' : 'file', downloadUrl: options.downloadUrl || options.rawUrl, previewUrl: options.previewUrl || buildPreviewUrl(options.folderPath, file.name), folderPath: options.folderPath, manager: options.manager, section: options.section });
    const canPreview = isPdf(pdf.name) || isImage(pdf.name) || canPreviewVideo(pdf.name);
    const wrapper = document.createElement('div');
    wrapper.className = 'file-item-wrapper';
    wrapper.innerHTML = `
      <a href="${pdf.downloadUrl}" target="_blank" class="file-link" rel="noopener">
        <div class="file-icon"><i class="fa-solid ${isVideoLink ? 'fa-circle-play file-icon-video' : getFileIcon(pdf.name)}"></i></div>
        <div class="file-name"></div>
      </a>
      <div class="action-btns">
        <button type="button" class="preview-btn pdf-action-btn" title="${isVideoLink ? 'Apri video' : (canPreview ? 'Anteprima documento' : 'Apri / Scarica')}"><i class="fa-solid ${isVideoLink ? 'fa-arrow-up-right-from-square' : (canPreview ? 'fa-eye' : 'fa-arrow-up-right-from-square')}"></i></button>
        <a href="${pdf.downloadUrl}" target="_blank" class="download-btn pdf-action-btn" title="${isVideoLink ? 'Apri video' : 'Visualizza/Scarica'}" rel="noopener"><i class="fa-solid ${isVideoLink ? 'fa-circle-play' : 'fa-download'}"></i></a>
        <button type="button" class="favorite-btn pdf-action-btn" title="Aggiungi ai preferiti"><i class="fa-regular fa-star"></i></button>
        <button class="delete-btn" title="Elimina file"><i class="fa-solid fa-trash-can"></i></button>
      </div>`;
    const openTarget = () => { if (pdf.type === 'video-link') window.open(pdf.url, '_blank', 'noopener'); else openPreview(pdf); };
    const applyVideoLinkData = data => {
      pdf.name = data.title || pdf.name; pdf.title = pdf.name; pdf.url = data.url || pdf.url; pdf.downloadUrl = pdf.url; pdf.savedAt = data.createdAt || pdf.savedAt;
      wrapper.querySelector('.file-name').textContent = pdf.name;
      wrapper.querySelector('.file-link').href = pdf.url;
      wrapper.querySelector('.download-btn').href = pdf.url;
    };
    wrapper.querySelector('.file-name').textContent = isVideoLink ? 'Caricamento link video...' : pdf.name;
    wrapper.querySelector('.preview-btn').addEventListener('click', openTarget);
    if (isVideoLink && pdf.downloadUrl && pdf.downloadUrl !== '#') {
      fetch(pdf.downloadUrl).then(response => response.ok ? response.json() : null).then(data => { if (data && data.type === 'video-link') applyVideoLinkData(data); else wrapper.querySelector('.file-name').textContent = pdf.name; }).catch(() => { wrapper.querySelector('.file-name').textContent = pdf.name; });
    }
    const favoriteButton = wrapper.querySelector('.favorite-btn');
    const refreshFavorite = () => { const active = isFavorite(pdf); favoriteButton.classList.toggle('is-favorite', active); favoriteButton.title = active ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'; favoriteButton.innerHTML = active ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>'; };
    favoriteButton.addEventListener('click', () => { toggleFavorite(pdf); refreshFavorite(); });
    refreshFavorite();
    wrapper.querySelector('.delete-btn').addEventListener('click', () => window[options.onDelete || 'deleteFile'](file.name, file.sha));
    return wrapper;
  }

  window.TOPHOUSE_PDF = { getFavorites, toggleFavorite, removeFavorite, isFavorite, openPreview, closePreview, createPdfListItem, normalizePdf, encodePath, buildPreviewUrl, getExtension, isAllowedFile, isVideoLinkFile, isDisplayableFile, getFileIcon, isPdf, isImage, isVideo, canPreviewVideo, ALLOWED_EXTENSIONS };
})();
