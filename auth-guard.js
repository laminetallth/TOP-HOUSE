import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAestZqgTWKIFjurPdHARcz1Ir4IFcuBug",
  authDomain: "top-house-4bb50.firebaseapp.com",
  projectId: "top-house-4bb50",
  storageBucket: "top-house-4bb50.firebasestorage.app",
  messagingSenderId: "247177312096",
  appId: "1:247177312096:web:57a1940fe87133873d9005",
  measurementId: "G-LDNC97B4GN"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const roles = window.USER_ROLES || {};
const isNestedPage = window.location.pathname.includes('/gestori/');
const basePath = isNestedPage ? '../' : '';
const loginPage = `${basePath}login.html`;
const deniedPage = `${basePath}accesso-negato.html`;
const publicPages = ['login.html', 'login-venditori.html', 'accesso-negato.html'];
const currentPage = window.location.pathname.split('/').pop() || 'index.html';

function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
function roleFor(user) { return roles[normalizeEmail(user?.email)] || ''; }
function setMessage(element, text, isError = false) { if (element) { element.textContent = text; element.classList.toggle('error', isError); } }
function nextParam(defaultPage = 'index.html') { return new URLSearchParams(window.location.search).get('next') || defaultPage; }
function redirectToLogin() {
  const next = encodeURIComponent(window.location.pathname.split('/').pop() || 'index.html');
  window.location.href = `${loginPage}?next=${next}`;
}
function redirectDenied() { window.location.href = deniedPage; }
function isAdminOnlyPage() { return document.documentElement.dataset.adminOnly === 'true' || document.body?.dataset.adminOnly === 'true' || currentPage === 'admin-caricamento.html'; }
function markRole(userRole) {
  document.documentElement.dataset.userRole = userRole;
  document.body?.setAttribute('data-user-role', userRole);
  document.querySelectorAll('[data-admin-only], .admin-only').forEach(element => { element.hidden = userRole !== 'admin'; });
}
function ensureLogoutButton() {
  if (publicPages.includes(currentPage)) return;
  let button = document.getElementById('logoutButton');
  if (!button) {
    button = document.createElement('button');
    button.id = 'logoutButton';
    button.type = 'button';
    button.className = 'top-house-logout';
    button.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Esci';
    document.body.appendChild(button);
  }
  button.hidden = false;
  button.addEventListener('click', async () => { await signOut(auth); window.location.href = loginPage; });
}
function injectStyles() {
  if (document.getElementById('topHouseAuthStyles')) return;
  const style = document.createElement('style');
  style.id = 'topHouseAuthStyles';
  style.textContent = `[data-user-role="venditore"] .admin-only,[data-user-role="venditore"] [data-admin-only],[data-user-role="venditore"] .sidebar-box,[data-user-role="venditore"] .delete-btn{display:none!important}.top-house-logout{position:fixed;right:18px;bottom:18px;z-index:9999;border:0;border-radius:999px;padding:12px 18px;background:linear-gradient(135deg,#ff0055,#ff9900);color:#fff;font-weight:900;box-shadow:0 10px 28px rgba(0,0,0,.22);cursor:pointer}`;
  document.head.appendChild(style);
}
function requireLogin(options = {}) {
  injectStyles();
  onAuthStateChanged(auth, user => {
    if (!user) { redirectToLogin(); return; }
    const userRole = roleFor(user);
    if (!userRole) { redirectDenied(); return; }
    sessionStorage.setItem('topHouseUserRole', userRole);
    sessionStorage.setItem('topHouseUserEmail', normalizeEmail(user.email));
    if ((options.adminOnly || isAdminOnlyPage()) && userRole !== 'admin') { redirectDenied(); return; }
    markRole(userRole);
    ensureLogoutButton();
  });
}
function initLoginForm() {
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const message = document.getElementById('loginMessage');
  onAuthStateChanged(auth, user => {
    if (!user) return;
    const userRole = roleFor(user);
    if (!userRole) { window.location.href = 'accesso-negato.html'; return; }
    window.location.href = nextParam('index.html');
  });
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    setMessage(message, 'Accesso in corso...');
    try {
      const credential = await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
      const userRole = roleFor(credential.user);
      if (!userRole) { await signOut(auth); window.location.href = 'accesso-negato.html'; return; }
      window.location.href = nextParam('index.html');
    } catch (error) {
      console.error(error);
      setMessage(message, 'Email o password non corretti. Riprova.', true);
    } finally { if (button) button.disabled = false; }
  });
  document.getElementById('forgotPasswordLink')?.addEventListener('click', async event => {
    event.preventDefault();
    const email = emailInput?.value.trim() || prompt('Inserisci la tua email per reimpostare la password:');
    if (!email) return;
    try { await sendPasswordResetEmail(auth, email); }
    catch (error) { console.warn('Reset password:', error); }
    setMessage(message, 'Se l\'email è registrata, riceverai il link per reimpostare la password.');
  });
}
function bindLogout(buttonId = 'logoutButton') { document.getElementById(buttonId)?.addEventListener('click', async () => { await signOut(auth); window.location.href = loginPage; }); }

window.TOPHOUSE_AUTH = { auth, requireLogin, initLoginForm, bindLogout, signOut: () => signOut(auth), getCurrentRole: () => sessionStorage.getItem('topHouseUserRole') || '' };
if (!publicPages.includes(currentPage)) requireLogin();
