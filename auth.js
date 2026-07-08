import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { TOPHOUSE_ROLES, DEFAULT_ROLE } from './utenti.js';

// Configurazione Firebase già presente nel portale TOP HOUSE.
// Se il progetto cambia, sostituisci questi valori con la configurazione della console Firebase.
const firebaseConfig = {
  apiKey: 'AIzaSyAestZqgTWKIFjurPdHARcz1Ir4IFcuBug',
  authDomain: 'top-house-4bb50.firebaseapp.com',
  projectId: 'top-house-4bb50',
  storageBucket: 'top-house-4bb50.firebasestorage.app',
  messagingSenderId: '247177312096',
  appId: '1:247177312096:web:57a1940fe87133873d9005',
  measurementId: 'G-LDNC97B4GN'
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const PUBLIC_PAGES = new Set(['login.html', 'accesso-negato.html']);
const ADMIN_ONLY_PAGES = new Set(['admin-caricamento.html']);

function currentPage() {
  return window.location.pathname.split('/').pop() || 'index.html';
}

function rootRelative(fileName) {
  return window.location.pathname.includes('/gestori/') ? `../${fileName}` : fileName;
}

function getUserRole(user) {
  if (!user) return 'guest';
  if (TOPHOUSE_ROLES.admin.includes(user.uid)) return 'admin';
  if (TOPHOUSE_ROLES.venditore.includes(user.uid)) return 'venditore';
  return DEFAULT_ROLE;
}

function isAdminOnlyPage() {
  return ADMIN_ONLY_PAGES.has(currentPage());
}

function setPortalRole(role) {
  document.documentElement.dataset.userRole = role;
  const isAdmin = role === 'admin';

  document.querySelectorAll('.delete-btn, [data-admin-only]').forEach(element => {
    element.hidden = !isAdmin;
  });

  document.querySelectorAll('#fileInput, input[type="file"], .sidebar-input').forEach(input => {
    const adminBox = input.closest('.sidebar-box, .admin-upload, .upload-box, form, [data-admin-only]');
    if (adminBox) adminBox.hidden = !isAdmin;
    input.hidden = !isAdmin;
    input.disabled = !isAdmin;
  });
}

function addLogout(user, role) {
  if (document.getElementById('topHouseLogout') || currentPage() === 'login.html') return;
  const button = document.createElement('button');
  button.id = 'topHouseLogout';
  button.className = 'top-house-logout';
  button.type = 'button';
  button.innerHTML = `<span>${user.email || role}</span><strong>Esci</strong>`;
  button.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = rootRelative('login.html');
  });
  document.body.appendChild(button);
}

function guardAdminActions(role) {
  if (role === 'admin') return;

  const deny = () => {
    window.location.href = rootRelative('accesso-negato.html');
  };

  ['uploadFile', 'uploadFiles', 'deleteFile', 'deletePdf'].forEach(functionName => {
    if (typeof window[functionName] === 'function') window[functionName] = deny;
  });
}

window.TOPHOUSE_AUTH = { auth, getUserRole, rootRelative };

if (currentPage() === 'login.html') {
  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('loginError');

  onAuthStateChanged(auth, user => {
    if (user) window.location.href = 'index.html';
  });

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    errorBox.textContent = '';

    try {
      await signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
      window.location.href = 'index.html';
    } catch (error) {
      errorBox.textContent = 'Credenziali errate o utente non abilitato. Riprova.';
    }
  });
} else if (!PUBLIC_PAGES.has(currentPage())) {
  onAuthStateChanged(auth, user => {
    if (!user) {
      window.location.href = rootRelative('login.html');
      return;
    }

    const role = getUserRole(user);
    if (isAdminOnlyPage() && role !== 'admin') {
      window.location.href = rootRelative('accesso-negato.html');
      return;
    }

    setPortalRole(role);
    addLogout(user, role);
    guardAdminActions(role);
  });
}
