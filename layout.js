// TOP HOUSE — intestazione e piè di pagina comuni a tutte le pagine del portale.
(function () {
  const ROOT = (() => {
    try { return new URL('./', document.currentScript.src).href; }
    catch (error) { return new URL('./', window.location.href).href; }
  })();
  const here = window.location.pathname.split('/').pop() || 'index.html';

  const links = [
    { href: 'index.html#cerca', page: '', icon: 'fa-magnifying-glass', label: 'Cerca' },
    { href: 'archivio.html', page: 'archivio.html', icon: 'fa-star', label: 'Preferiti' },
    { href: 'formazione.html', page: 'formazione.html', icon: 'fa-graduation-cap', label: 'Formazione' },
    { href: 'admin-caricamento.html', page: 'admin-caricamento.html', icon: 'fa-folder-tree', label: 'Gestione file', admin: true }
  ];

  const header = document.createElement('header');
  header.className = 'th-header';
  header.innerHTML = `
    <div class="th-header-in">
      <a class="th-brand" href="${ROOT}index.html" aria-label="TOP HOUSE, torna alla home">
        <img class="th-logo th-logo--color" src="${ROOT}logo.svg" alt="TOP HOUSE" width="201" height="40">
        <img class="th-logo th-logo--white" src="${ROOT}logo-bianco.svg" alt="" width="201" height="40" aria-hidden="true">
      </a>
      <nav class="th-nav" aria-label="Menu principale">
        ${links.map(l => `<a href="${ROOT}${l.href}"${l.admin ? ' class="th-nav-admin admin-only" data-admin-only' : ''}${l.page === here ? ' aria-current="page"' : ''}><i class="fa-solid ${l.icon}" aria-hidden="true"></i><span>${l.label}</span></a>`).join('')}
        <button type="button" id="logoutButton"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span>Esci</span></button>
      </nav>
    </div>`;
  document.body.insertBefore(header, document.body.firstChild);

  // Sulla home "Cerca" porta direttamente al campo di ricerca.
  header.querySelector('a[href$="index.html#cerca"]').addEventListener('click', event => {
    const input = document.getElementById('cerca');
    if (!input) return;
    event.preventDefault();
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  const footer = document.createElement('footer');
  footer.className = 'th-footer';
  footer.innerHTML = `<div><span style="display:flex;align-items:center;gap:10px"><img src="${ROOT}logo-marchio.svg" alt="" width="28" height="22">© ${new Date().getFullYear()} <b>TOP HOUSE</b></span><span>casa. energia. fiducia.</span></div>`;
  document.body.appendChild(footer);

  // Assistente AI su tutte le pagine riservate (l'Academy ha già la sua chat).
  if (here !== 'formazione.html' && !document.querySelector('script[src*="assistente.js"]')) {
    const ai = document.createElement('script');
    ai.type = 'module';
    ai.src = `${ROOT}assistente.js?v=${(document.currentScript?.src.match(/v=([^&]+)/) || [, ''])[1]}`;
    document.body.appendChild(ai);
  }

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
