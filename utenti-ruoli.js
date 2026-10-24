// Ruoli autorizzati TOP HOUSE.
// Non inserire password in questo file: le password sono gestite solo da Firebase Authentication.
// Per aggiungere un venditore: "email@esempio.it": "venditore",
window.USER_ROLES = {
  "laminetall.th@gmail.com": "admin",
  "laminetall.th+admin@gmail.com": "admin",
  "gabrielestraniero.th+admin@gmail.com": "admin",
  "info@solarity-energysolutions.com": "admin",
  "isabelladattoli1@gmail.com": "admin",
  "antonioattardi.th@gmail.com": "admin",
  "francesco_cecchini@hotmail.com": "admin",
  "sarahcavedoarmy@gmail.com": "admin"
};

(function () {
  // Radice del sito ricavata dalla posizione di questo file (funziona anche in gestori/).
  const ROOT = (() => {
    try { return new URL('./', document.currentScript.src).href; }
    catch (error) { return ''; }
  })();
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const publicPages = ['login.html', 'login-venditori.html', 'accesso-negato.html'];
  const isPublic = publicPages.includes(page);

  // I controlli admin restano nascosti finché il ruolo admin non è confermato
  // (evita che compaiano per un attimo ai venditori durante il caricamento).
  try {
    const savedRole = sessionStorage.getItem('topHouseUserRole');
    if (savedRole) document.documentElement.dataset.userRole = savedRole;
  } catch (error) { /* niente */ }
  const guardStyle = document.createElement('style');
  guardStyle.textContent = 'html:not([data-user-role="admin"]) .admin-only,html:not([data-user-role="admin"]) [data-admin-only],html:not([data-user-role="admin"]) .sidebar-box{display:none!important}';
  document.head.appendChild(guardStyle);

  function loadScript(src, options = {}) {
    const script = document.createElement('script');
    script.src = ROOT + src + '?v=' + Date.now();
    if (options.module) script.type = 'module';
    script.defer = true;
    document.head.appendChild(script);
  }

  // Pulsante flottante in basso a SINISTRA: in basso a destra c'è già "Esci".
  function floatingLink(className, href, icon, label, background) {
    if (document.querySelector('.' + className)) return;
    const link = document.createElement('a');
    link.href = href;
    link.className = className;
    link.innerHTML = `<i class="fa-solid ${icon}"></i><span>${label}</span>`;
    Object.assign(link.style, { position: 'fixed', left: '18px', bottom: '18px', zIndex: '9998', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '999px', background, color: '#fff', textDecoration: 'none', fontWeight: '900', fontSize: '12px', boxShadow: '0 10px 28px rgba(0,0,0,.2)' });
    document.body.appendChild(link);
  }

  // Indici energetici (homepage).
  document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.energy-section')) loadScript('indici-energetici.js');
  });

  // Gestione eliminazione multipla nella pagina di caricamento admin.
  if (page === 'admin-caricamento.html') loadScript('elimina-pdf.js');

  // Assistente AI della Academy.
  if (page === 'formazione.html') loadScript('formazione-ai.js', { module: true });

  if (isPublic) return;

  document.addEventListener('DOMContentLoaded', () => {
    if (page === 'formazione.html') {
      floatingLink('th-bolletta-link', ROOT + 'bolletta-2.0.html', 'fa-file-invoice-dollar', 'BOLLETTA 2.0', 'linear-gradient(135deg,#191521,#4a3b55)');
    } else {
      floatingLink('th-formazione-link', ROOT + 'formazione.html', 'fa-graduation-cap', 'FORMAZIONE', 'linear-gradient(135deg,#ff0055,#ff9900)');
    }
  });
})();
