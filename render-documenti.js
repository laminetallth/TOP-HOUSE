(function () {
  const normalize = (value) => (value || '').toString().trim().toLowerCase();

  const escapeHtml = (value) => (value || '').toString().replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));

  const getDocumentoSezione = (documento) => documento.sezione || documento.categoria;
  const getDocumentoTipo = (documento) => documento.tipo || documento.sottocategoria;
  const getDocumentoUrl = (documento) => documento.url || documento.link;

  const filenameFromUrl = (url) => {
    try {
      const parsedUrl = new URL(url, window.location.href);
      const firebasePath = parsedUrl.searchParams.get('name');
      const pathname = firebasePath || parsedUrl.pathname;
      return decodeURIComponent(pathname.split('/').pop() || 'Documento PDF').replace(/^documenti\//, '');
    } catch (error) {
      return 'Documento PDF';
    }
  };

  const emptyTile = () => `
    <div class="tile document-empty">
      <span class="tile-left">
        <span class="tile-icon"><i class="fa-solid fa-folder-open"></i></span>
        <span class="tile-name">Documenti in arrivo</span>
      </span>
      <span class="tile-arrow"><i class="fa-solid fa-clock"></i></span>
    </div>`;

  const documentTile = (documento) => {
    const documentoUrl = getDocumentoUrl(documento);
    const titolo = escapeHtml(documento.titolo || filenameFromUrl(documentoUrl));
    const url = escapeHtml(documentoUrl || '#');

    return `
      <article class="tile document-card" data-search-item="${titolo}">
        <span class="tile-left">
          <span class="tile-icon document-pdf-icon"><i class="fa-solid fa-file-pdf"></i></span>
          <span class="tile-name">${titolo}</span>
        </span>
        <span class="document-actions">
          <a class="document-button" href="${url}" target="_blank" rel="noopener">Apri</a>
          <a class="document-button document-button-secondary" href="${url}" download>Scarica</a>
        </span>
      </article>`;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('[data-documenti-list]');
    const context = document.querySelector('[data-gestore][data-sezione]');
    const elencoDocumenti = window.DOCUMENTI;

    if (!container || !context || !Array.isArray(elencoDocumenti)) return;

    const gestore = normalize(context.dataset.gestore);
    const sezione = normalize(context.dataset.sezione);
    const tipo = normalize(context.dataset.tipo);
    const documenti = elencoDocumenti.filter((documento) => {
      const sameGestore = normalize(documento.gestore) === gestore;
      const sameSezione = normalize(getDocumentoSezione(documento)) === sezione;
      const docTipo = normalize(getDocumentoTipo(documento));
      const sameTipo = tipo ? docTipo === tipo : !docTipo;
      return sameGestore && sameSezione && sameTipo && getDocumentoUrl(documento);
    });

    container.innerHTML = documenti.length ? documenti.map(documentTile).join('') : emptyTile();
  });
}());
