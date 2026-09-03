// Ruoli autorizzati TOP HOUSE.
// Non inserire password in questo file: le password sono gestite solo da Firebase Authentication.
window.USER_ROLES = {
  "laminetall.th@gmail.com": "admin",
  "laminetall.th+admin@gmail.com": "admin",
  "gabrielestraniero.th+admin@gmail.com": "admin",
  "venditore1@email.com": "venditore",
  "venditore2@email.com": "venditore",
  "isabelladattoli1@gmail.com": "admin",
  "antonioattardi.th@gmail.com": "admin"
};

if (document.querySelector('.energy-section')) {
  const script = document.createElement('script');
  script.src = 'indici-energetici.js';
  script.defer = true;
  document.head.appendChild(script);
}

if (window.location.pathname.split('/').pop() === 'admin-caricamento.html') {
  const script = document.createElement('script');
  script.src = 'elimina-pdf.js?v=' + Date.now();
  script.defer = true;
  document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.querySelector('.pdf-container')) return;
  const basePath = window.location.pathname.includes('/gestori/') ? '../' : '';
  const script = document.createElement('script');
  script.src = basePath + 'gestione-documenti.js?v=' + Date.now();
  script.defer = true;
  document.head.appendChild(script);
});

// Accesso rapido alla Academy per tutti gli utenti autenticati.
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.endsWith('formazione.html')) return;
  if (document.querySelector('.th-formazione-link')) return;
  const link = document.createElement('a');
  link.href = (window.location.pathname.includes('/gestori/') ? '../' : '') + 'formazione.html';
  link.className = 'th-formazione-link';
  link.innerHTML = '<i class="fa-solid fa-graduation-cap"></i><span>FORMAZIONE</span>';
  Object.assign(link.style, {position:'fixed',right:'20px',bottom:'20px',zIndex:'9998',display:'flex',alignItems:'center',gap:'8px',padding:'12px 16px',borderRadius:'999px',background:'linear-gradient(135deg,#ff0055,#ff9900)',color:'#fff',textDecoration:'none',fontWeight:'900',fontSize:'12px',boxShadow:'0 10px 28px rgba(255,0,85,.25)'});
  document.body.appendChild(link);
});

// Pulsante Bolletta 2.0 direttamente nella Academy.
document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('formazione.html')) return;
  if (document.querySelector('.th-bolletta-link')) return;
  const link = document.createElement('a');
  link.href = 'bolletta-2.0.html';
  link.className = 'th-bolletta-link';
  link.innerHTML = '<i class="fa-solid fa-file-invoice-dollar"></i><span>BOLLETTA 2.0</span>';
  Object.assign(link.style, {position:'fixed',right:'20px',bottom:'20px',zIndex:'9998',display:'flex',alignItems:'center',gap:'8px',padding:'12px 16px',borderRadius:'999px',background:'linear-gradient(135deg,#191521,#4a3b55)',color:'#fff',textDecoration:'none',fontWeight:'900',fontSize:'12px',boxShadow:'0 10px 28px rgba(25,21,33,.22)'});
  document.body.appendChild(link);
});

// Assistente AI della Academy.
if (window.location.pathname.split('/').pop() === 'formazione.html') {
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'formazione-ai.js?v=' + Date.now();
  script.defer = true;
  document.head.appendChild(script);
}
