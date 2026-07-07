(function () {
  const STORAGE_KEY = 'topHousePdfFavorites';

  function safeParse(value, fallback) {
    try { return JSON.parse(value) || fallback; } catch (error) { return fallback; }
  }

  function getFavorites() {
    return safeParse(localStorage.getItem(STORAGE_KEY), []);
  }

  function saveFavorites(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function normalizePdf(input) {
    const folderPath = input.folderPath || '';
    const parts = folderPath.split('/').filter(Boolean);
    return {
      name: input.name || input.fileName || 'PDF senza nome',
      url: input.url || input.rawUrl || '#',
      manager: input.manager || parts[1] || 'TOP HOUSE',
      section: input.section || parts.slice(2).join(' / ') || folderPath || 'Documenti',
      folderPath,
      savedAt: input.savedAt || new Date().toISOString()
    };
  }

  function favoriteId(pdf) {
    return `${pdf.url}|${pdf.name}`;
  }

  function isFavorite(pdf) {
    const normalized = normalizePdf(pdf);
    return getFavorites().some(item => favoriteId(item) === favoriteId(normalized));
  }

  function toggleFavorite(pdf) {
    const normalized = normalizePdf(pdf);
    const id = favoriteId(normalized);
    const favorites = getFavorites();
    const index = favorites.findIndex(item => favoriteId(item) === id);
    if (index >= 0) {
      favorites.splice(index, 1);
      saveFavorites(favorites);
      return false;
    }
    favorites.unshift(normalized);
    saveFavorites(favorites);
    return true;
  }

  function removeFavorite(pdf) {
    const normalized = normalizePdf(pdf);
    saveFavorites(getFavorites().filter(item => favoriteId(item) !== favoriteId(normalized)));
  }

  function openPreview(pdf) {
    const normalized = normalizePdf(pdf);
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
          <iframe class="pdf-modal-frame" title="Anteprima PDF"></iframe>
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
    modal.querySelector('.pdf-modal-frame').src = normalized.url;
    modal.querySelector('.pdf-modal-download').href = normalized.url;
    modal.classList.add('is-open');
    document.body.classList.add('pdf-modal-open');
  }

  function closePreview() {
    const modal = document.getElementById('pdfPreviewModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.querySelector('.pdf-modal-frame').src = 'about:blank';
    document.body.classList.remove('pdf-modal-open');
  }

  function createPdfListItem(file, options) {
    const pdf = normalizePdf({ name: file.name, url: options.rawUrl, folderPath: options.folderPath });
    const wrapper = document.createElement('div');
    wrapper.className = 'file-item-wrapper';
    wrapper.innerHTML = `
      <a href="${pdf.url}" target="_blank" class="file-link" rel="noopener">
        <div class="file-icon"><i class="fa-solid fa-file-pdf"></i></div>
        <div class="file-name"></div>
      </a>
      <div class="action-btns">
        <button type="button" class="preview-btn pdf-action-btn" title="Anteprima PDF"><i class="fa-solid fa-eye"></i></button>
        <a href="${pdf.url}" target="_blank" class="download-btn pdf-action-btn" title="Visualizza/Scarica" rel="noopener"><i class="fa-solid fa-download"></i></a>
        <button type="button" class="favorite-btn pdf-action-btn" title="Aggiungi ai preferiti"><i class="fa-regular fa-star"></i></button>
        <button class="delete-btn" title="Elimina file"><i class="fa-solid fa-trash-can"></i></button>
      </div>`;
    wrapper.querySelector('.file-name').textContent = pdf.name;
    wrapper.querySelector('.preview-btn').addEventListener('click', () => openPreview(pdf));
    const favoriteButton = wrapper.querySelector('.favorite-btn');
    const refreshFavorite = () => {
      const active = isFavorite(pdf);
      favoriteButton.classList.toggle('is-favorite', active);
      favoriteButton.title = active ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti';
      favoriteButton.innerHTML = active ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
    };
    favoriteButton.addEventListener('click', () => { toggleFavorite(pdf); refreshFavorite(); });
    refreshFavorite();
    wrapper.querySelector('.delete-btn').addEventListener('click', () => window[options.onDelete || 'deleteFile'](file.name, file.sha));
    return wrapper;
  }

  window.TOPHOUSE_PDF = { getFavorites, toggleFavorite, removeFavorite, isFavorite, openPreview, closePreview, createPdfListItem, normalizePdf };
})();
