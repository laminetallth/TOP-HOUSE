// Ruoli autorizzati TOP HOUSE.
// Non inserire password in questo file: le password sono gestite solo da Firebase Authentication.
// Per aggiungere un venditore: "email@esempio.it": "venditore",
// Admin solo Lamine Tall e Gabriele Straniero; tutti gli altri sono venditori (possono vedere e scaricare, non modificare).
window.USER_ROLES = {
  "laminetall.th@gmail.com": "admin",
  "laminetall.th+admin@gmail.com": "admin",
  "gabrielestraniero.th+admin@gmail.com": "admin",
  "info@solarity-energysolutions.com": "venditore",
  "isabelladattoli1@gmail.com": "venditore",
  "antonioattardi.th@gmail.com": "venditore",
  "francesco_cecchini@hotmail.com": "venditore",
  "sarahcavedoarmy@gmail.com": "venditore",
  "hajarsadiq2004@gmail.com": "venditore",
  "anna_amati@libero.it": "venditore",
  "massironi.massimiliano@gmail.com": "venditore",
  "ascolta.misci@gmail.com": "venditore",
  "giovanni.cucinella@gmail.com": "venditore"
};

// Accessi limitati: un venditore con un profilo qui sotto vede SOLO i gestori del profilo
// (home, Luce e gas e Telefonia mostrano solo quelli; le altre sezioni del Drive sono bloccate).
// Per limitare un utente: "email@esempio.it": "promup" (deve essere anche in USER_ROLES come venditore).
window.ACCESS_PROFILES = {
  // Gestori che Top House lavora tramite PromUp
  promup: {
    luceGas: ["a2a", "audax", "axpo", "edison", "enel-corporate", "enel-digital", "engie", "estra", "fastweb-energia", "hera", "magis", "sorgenia", "upenergy"],
    telefonia: ["edison-fibra", "enel-fibra", "fastweb", "sky", "tim", "vodafone", "wind"],
    // Altri servizi Top House (pagina e sottopagine, es. fotovoltaico-documenti-contratto)
    sezioni: ["fotovoltaico", "noleggio-auto", "assicurazioni", "allarmi", "caldaia", "climatizzatore", "depuratore", "infissi", "pompe-di-calore", "wall-box", "indici"]
  }
};
// Profilo "promup-completo": vede tutto il Drive tranne i gestori luce/gas e telefonia che NON sono su PromUp.
window.ACCESS_PROFILES["promup-completo"] = Object.assign({}, window.ACCESS_PROFILES.promup, { tuttoIlResto: true });
window.USER_ACCESS = {
  "ascolta.misci@gmail.com": "promup", // Michele Orlando
  "giovanni.cucinella@gmail.com": "promup-completo" // Giovanni Cucinella
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

  // Sulla pagina Formazione: accesso rapido alla Bolletta 2.0.
  function bollettaLink() {
    if (document.querySelector('.th-bolletta-link')) return;
    const link = document.createElement('a');
    link.href = ROOT + 'bolletta-2.0.html';
    link.className = 'th-bolletta-link th-btn th-btn--dark';
    link.innerHTML = '<i class="fa-solid fa-file-invoice-dollar" aria-hidden="true"></i><span>Bolletta 2.0</span>';
    Object.assign(link.style, { position: 'fixed', right: '18px', bottom: '18px', zIndex: '40' });
    document.body.appendChild(link);
  }

  // Assistente AI della Academy.
  if (page === 'formazione.html') {
    loadScript('formazione-ai.js', { module: true });
    if (!isPublic) document.addEventListener('DOMContentLoaded', bollettaLink);
  }
})();
