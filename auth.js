import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { TOPHOUSE_AUTHORIZED_USERS } from './utenti.js';

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
const db = getFirestore(app);
const PUBLIC_PAGES = new Set(['login.html', 'accesso-negato.html']);
const ADMIN_ONLY_PAGES = new Set(['admin-caricamento.html', 'admin-inviti.html']);
const AUTH_COLLECTION = 'utentiAutorizzati';

function currentPage() {
  return window.location.pathname.split('/').pop() || 'index.html';
}

function rootRelative(fileName) {
  return window.location.pathname.includes('/gestori/') ? `../${fileName}` : fileName;
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function localConfiguredRole(user) {
  const email = normalizeEmail(user?.email);
  if (!user) return null;
  if (TOPHOUSE_AUTHORIZED_USERS.adminUids.includes(user.uid)) return 'admin';
  if (TOPHOUSE_AUTHORIZED_USERS.adminEmails.map(normalizeEmail).includes(email)) return 'admin';
  if (TOPHOUSE_AUTHORIZED_USERS.venditoreEmails.map(normalizeEmail).includes(email)) return 'venditore';
  return null;
}

async function getUserRole(user) {
  if (!user) return null;

  const configuredRole = localConfiguredRole(user);
  if (configuredRole) return configuredRole;

  const email = normalizeEmail(user.email);
  if (!email) return null;

  const snapshot = await getDoc(doc(db, AUTH_COLLECTION, email));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  if (data?.enabled === false) return null;
  return data?.role === 'admin' ? 'admin' : 'venditore';
}

function randomTemporaryPassword() {
  const array = new Uint32Array(4);
  window.crypto.getRandomValues(array);
  return `Tmp-${Array.from(array).map(value => value.toString(36)).join('-')}!Aa1`;
}

async function createSellerInvite(email, adminUser) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Email non valida');

  const secondaryAppName = 'top-house-invite-app';
  const secondaryApp = getApps().find(item => item.name === secondaryAppName) || initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, randomTemporaryPassword());
  } catch (error) {
    if (error.code !== 'auth/email-already-in-use') throw error;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }

  await setDoc(doc(db, AUTH_COLLECTION, normalizedEmail), {
    email: normalizedEmail,
    role: 'venditore',
    enabled: true,
    invitedBy: adminUser?.email || adminUser?.uid || 'admin',
    updatedAt: serverTimestamp()
  }, { merge: true });

  await sendPasswordResetEmail(auth, normalizedEmail);
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


function setupInviteForm(user, role) {
  const form = document.getElementById('sellerInviteForm');
  if (!form || form.dataset.ready === 'true') return;
  form.dataset.ready = 'true';

  const status = document.getElementById('inviteStatus');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (role !== 'admin') {
      window.location.href = rootRelative('accesso-negato.html');
      return;
    }

    const email = normalizeEmail(form.email.value);
    status.textContent = 'Invio invito in corso...';

    try {
      await createSellerInvite(email, user);
      form.reset();
      status.textContent = 'Venditore autorizzato. Email per impostare/reimpostare la password inviata.';
    } catch (error) {
      console.error(error);
      status.textContent = 'Errore durante l’invito. Verifica Firebase Authentication e Firestore.';
    }
  });
}

window.TOPHOUSE_AUTH = { auth, getUserRole, rootRelative, createSellerInvite };

if (currentPage() === 'login.html') {
  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('loginError');
  const forgotButton = document.getElementById('forgotPassword');

  onAuthStateChanged(auth, user => {
    if (user) window.location.href = 'index.html';
  });

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    errorBox.textContent = '';

    try {
      const credential = await signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
      const role = await getUserRole(credential.user);
      if (!role) {
        await signOut(auth);
        errorBox.textContent = 'Utente non autorizzato al portale TOP HOUSE.';
        return;
      }
      window.location.href = 'index.html';
    } catch (error) {
      errorBox.textContent = 'Credenziali errate o utente non abilitato. Riprova.';
    }
  });

  forgotButton?.addEventListener('click', async () => {
    errorBox.textContent = '';
    const email = normalizeEmail(form?.email.value || window.prompt('Inserisci la tua email per reimpostare la password'));
    if (!email) return;

    try {
      await sendPasswordResetEmail(auth, email);
      errorBox.textContent = 'Email di reimpostazione inviata. Controlla la posta.';
    } catch (error) {
      errorBox.textContent = 'Non è stato possibile inviare la mail di reimpostazione.';
    }
  });
} else if (!PUBLIC_PAGES.has(currentPage())) {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = rootRelative('login.html');
      return;
    }

    const role = await getUserRole(user);
    if (!role) {
      await signOut(auth);
      window.location.href = rootRelative('accesso-negato.html');
      return;
    }

    if (isAdminOnlyPage() && role !== 'admin') {
      window.location.href = rootRelative('accesso-negato.html');
      return;
    }

    setPortalRole(role);
    addLogout(user, role);
    guardAdminActions(role);
    setupInviteForm(user, role);
  });
}
