import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { TOPHOUSE_ROLES, DEFAULT_ROLE } from './utenti.js';

// Configurazione Firebase già presente nel portale TOP HOUSE.
// Se cambi progetto Firebase, sostituisci questi valori con quelli della console Firebase.
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
const PUBLIC_PAGES = ['login.html', 'accesso-negato.html'];
const ADMIN_PAGES = ['admin-caricamento.html'];

function pageName() {
  const name = window.location.pathname.split('/').pop();
  return name || 'index.html';
}

function relativeUrl(fileName) {
  return window.location.pathname.includes('/gestori/') ? `../${fileName}` : fileName;
}

function roleForUser(user) {
  if (!user) return null;
  if (TOPHOUSE_ROLES.admin.includes(user.uid)) return 'admin';
  if (TOPHOUSE_ROLES.venditore.includes(user.uid)) return 'venditore';
  return DEFAULT_ROLE;
}

function isAdminPage() {
  return ADMIN_PAGES.includes(pageName());
}

function applyRoleUi(role) {
  document.documentElement.dataset.userRole = role || 'guest';
  const isAdmin = role === 'admin';
  document.querySelectorAll('.delete-btn').forEach(element => { element.hidden = !isAdmin; });
  document.querySelectorAll('#fileInput, .sidebar-input').forEach(element => {
    const box = element.closest('.sidebar-box') || element.closest('[data-admin-only]');
    if (box) box.hidden = !isAdmin;
    else element.hidden = !isAdmin;
  });
  document.querySelectorAll('[data-admin-only]').forEach(element => { element.hidden = !isAdmin; });
}

function addLogoutButton(user, role) {
  if (pageName() === 'login.html' || document.getElementById('topHouseLogout')) return;
  const button = document.createElement('button');
  button.id = 'topHouseLogout';
  button.className = 'top-house-logout';
  button.type = 'button';
  button.innerHTML = `<span>${user.email || role}</span> <strong>Esci</strong>`;
  button.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = relativeUrl('login.html');
  });
  document.body.appendChild(button);
}

function protectDangerousActions(role) {
  if (role === 'admin') return;
  window.uploadFile = () => { window.location.href = relativeUrl('accesso-negato.html'); };
  window.deleteFile = () => { window.location.href = relativeUrl('accesso-negato.html'); };
}

window.TOPHOUSE_AUTH = { auth, roleForUser, relativeUrl };

if (pageName() === 'login.html') {
  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('loginError');
  onAuthStateChanged(auth, user => { if (user) window.location.href = 'index.html'; });
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
} else if (!PUBLIC_PAGES.includes(pageName())) {
  onAuthStateChanged(auth, user => {
    if (!user) {
      window.location.href = relativeUrl('login.html');
      return;
    }
    const role = roleForUser(user);
    if (isAdminPage() && role !== 'admin') {
      window.location.href = relativeUrl('accesso-negato.html');
      return;
    }
    applyRoleUi(role);
    addLogoutButton(user, role);
    protectDangerousActions(role);
  });
}
