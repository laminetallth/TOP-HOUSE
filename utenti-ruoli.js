// Ruoli autorizzati TOP HOUSE.
// Non inserire password in questo file: le password sono gestite solo da Firebase Authentication.
window.USER_ROLES = {
  "laminetall.th@gmail.com": "admin",
  "laminetall.th+admin@gmail.com": "admin",
  "gabrielestraniero.th+admin@gmail.com": "admin",
  "venditore1@email.com": "venditore",
  "venditore2@email.com": "venditore",
  "isabelladattoli1@gmail.com": "venditore",
  "antonioattardi.th@gmail.com": "venditore"
};

// Aggiornamento automatico degli indici PUN/PSV sulla homepage.
if (document.querySelector('.energy-section')) {
  const script = document.createElement('script');
  script.src = 'indici-energetici.js';
  script.defer = true;
  document.head.appendChild(script);
}
