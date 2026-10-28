import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAestZqgTWKIFjurPdHARCz1Ir4IFcuBug",
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
// Radice del sito ricavata dalla posizione di questo file: funziona in qualsiasi sottocartella.
const siteRoot = new URL('./', import.meta.url);
const loginPage = new URL('login.html', siteRoot).href;
const deniedPage = new URL('accesso-negato.html', siteRoot).href;
const publicPages = ['login.html', 'login-venditori.html', 'accesso-negato.html'];
const currentPage = window.location.pathname.split('/').pop() || 'index.html';

function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
function roleFor(user) { return roles[normalizeEmail(user?.email)] || ''; }
// Profilo di accesso limitato (es. "promup"): null = nessun limite.
function profileFor(user) {
  const name = (window.USER_ACCESS || {})[normalizeEmail(user?.email)];
  return name ? ((window.ACCESS_PROFILES || {})[name] || { luceGas: [], telefonia: [] }) : null;
}
// Percorso relativo alla radice del sito, es. "gestori/hera-cte.html".
function relPath(url) {
  try {
    const u = new URL(url, window.location.href);
    if (u.origin !== siteRoot.origin || !u.pathname.startsWith(siteRoot.pathname)) return null;
    return decodeURIComponent(u.pathname.slice(siteRoot.pathname.length)) || 'index.html';
  } catch (error) { return null; }
}
const LIMITED_COMMON = ['index.html', 'luce-gas.html', 'telefonia.html', 'telefonia-guide-generali.html'];
function allowedFor(profile, rel) {
  if (rel === null) return true; // link esterni
  if (!/\.html$/i.test(rel) && !rel.endsWith('/')) return true; // file (pdf, immagini…)
  if (rel.endsWith('/')) rel += 'index.html';
  if (LIMITED_COMMON.includes(rel) || publicPages.includes(rel)) return true;
  const g = rel.match(/^gestori\/(.+)\.html$/i);
  if (g) return (profile.luceGas || []).some(s => g[1] === s || g[1].startsWith(s + '-'));
  const t = rel.match(/^telefonia-(.+)\.html$/i);
  if (t) return (profile.telefonia || []).some(s => t[1] === s || t[1].startsWith(s + '-'));
  return false;
}
// Nasconde i collegamenti (card, pulsanti) verso pagine non consentite.
function applyLimits(profile) {
  document.documentElement.dataset.accessLimited = 'true';
  const hide = root => (root.querySelectorAll ? root.querySelectorAll('a[href]') : []).forEach(a => {
    const rel = relPath(a.getAttribute('href'));
    if (!allowedFor(profile, rel)) { a.hidden = true; a.style.setProperty('display', 'none', 'important'); a.setAttribute('aria-hidden', 'true'); }
  });
  const run = () => hide(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches?.('a[href]')) hide(n.parentNode || n); else hide(n); } })))
    .observe(document.documentElement, { childList: true, subtree: true });
}
function setMessage(element, text, isError = false) { if (element) { element.textContent = text; element.classList.toggle('error', isError); } }
// Dopo il login si torna solo a pagine di questo sito (niente redirect verso siti esterni).
function nextParam(defaultPage = 'index.html') {
  const fallback = new URL(defaultPage, siteRoot).href;
  const raw = new URLSearchParams(window.location.search).get('next');
  if (!raw) return fallback;
  try {
    const target = new URL(raw, siteRoot);
    if (target.origin !== siteRoot.origin || !target.pathname.startsWith(siteRoot.pathname)) return fallback;
    if (publicPages.includes(target.pathname.split('/').pop())) return fallback;
    return target.href;
  } catch (error) { return fallback; }
}
function redirectToLogin() {
  // Percorso relativo alla radice (es. "gestori/enel.html"), così dopo il login si torna alla pagina giusta.
  const here = window.location.pathname + window.location.search;
  const next = here.startsWith(siteRoot.pathname) ? here.slice(siteRoot.pathname.length) : 'index.html';
  window.location.href = `${loginPage}?next=${encodeURIComponent(next || 'index.html')}`;
}
function redirectDenied() { window.location.href = deniedPage; }
function isAdminOnlyPage() { return document.documentElement.dataset.adminOnly === 'true' || document.body?.dataset.adminOnly === 'true' || currentPage === 'admin-caricamento.html'; }
function markRole(userRole) {
  const previous = document.documentElement.dataset.userRole || '';
  document.documentElement.dataset.userRole = userRole;
  document.body?.setAttribute('data-user-role', userRole);
  document.querySelectorAll('[data-admin-only], .admin-only').forEach(element => { element.hidden = userRole !== 'admin'; });
  if (previous !== userRole) window.dispatchEvent(new CustomEvent('tophouse:role', { detail: { role: userRole, previous } }));
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
  if (button.dataset.logoutBound) return;
  button.dataset.logoutBound = '1';
  button.addEventListener('click', logout);
}
async function logout() {
  try { sessionStorage.removeItem('topHouseUserRole'); sessionStorage.removeItem('topHouseUserEmail'); } catch (error) { /* niente */ }
  await signOut(auth);
  window.location.href = loginPage;
}
function injectStyles() {
  if (document.getElementById('topHouseAuthStyles')) return;
  const style = document.createElement('style');
  style.id = 'topHouseAuthStyles';
  style.textContent = `[data-user-role="venditore"] .admin-only,[data-user-role="venditore"] [data-admin-only],[data-user-role="venditore"] .sidebar-box,[data-user-role="venditore"] .delete-btn{display:none!important}.top-house-logout{position:fixed;right:18px;bottom:18px;z-index:9999;border:0;border-radius:999px;padding:12px 18px;background:linear-gradient(135deg,#c8102e,#f7941d);color:#fff;font-weight:900;box-shadow:0 10px 28px rgba(0,0,0,.22);cursor:pointer}`;
  document.head.appendChild(style);
}
function requireLogin(options = {}) {
  injectStyles();
  onAuthStateChanged(auth, user => {
    if (!user) {
      try { sessionStorage.removeItem('topHouseUserRole'); } catch (error) { /* niente */ }
      redirectToLogin();
      return;
    }
    const userRole = roleFor(user);
    if (!userRole) { redirectDenied(); return; }
    sessionStorage.setItem('topHouseUserRole', userRole);
    sessionStorage.setItem('topHouseUserEmail', normalizeEmail(user.email));
    if ((options.adminOnly || isAdminOnlyPage()) && userRole !== 'admin') { redirectDenied(); return; }
    const profile = userRole === 'admin' ? null : profileFor(user);
    if (profile) {
      if (!allowedFor(profile, relPath(window.location.href))) { redirectDenied(); return; }
      applyLimits(profile);
    }
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
    if (!userRole) { window.location.href = deniedPage; return; }
    sessionStorage.setItem('topHouseUserRole', userRole);
    sessionStorage.setItem('topHouseUserEmail', normalizeEmail(user.email));
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
      if (!userRole) { await signOut(auth); window.location.href = deniedPage; return; }
      sessionStorage.setItem('topHouseUserRole', userRole);
      sessionStorage.setItem('topHouseUserEmail', normalizeEmail(credential.user.email));
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
function bindLogout(buttonId = 'logoutButton') {
  const button = document.getElementById(buttonId);
  if (!button || button.dataset.logoutBound) return;
  button.dataset.logoutBound = '1';
  button.addEventListener('click', logout);
}

window.TOPHOUSE_AUTH = { auth, requireLogin, initLoginForm, bindLogout, logout, signOut: () => signOut(auth), getCurrentRole: () => sessionStorage.getItem('topHouseUserRole') || '' };
if (!publicPages.includes(currentPage)) requireLogin();
