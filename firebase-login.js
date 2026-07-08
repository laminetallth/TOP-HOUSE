import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAestZqgTWKIFjurPdHARcz1Ir4IFcuBug",
  authDomain: "top-house-4bb50.firebaseapp.com",
  projectId: "top-house-4bb50",
  storageBucket: "top-house-4bb50.firebasestorage.app",
  messagingSenderId: "247177312096",
  appId: "1:247177312096:web:57a1940fe87133873d9005",
  measurementId: "G-LDNC97B4GN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const loginPath = "login-venditori.html";
const ADMIN_EMAILS = ["admin@tophouse.it", "admin@top-house.it"];

function setMessage(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("error", isError);
}

function roleFromUser(user) {
  if (!user) return "guest";
  const email = (user.email || "").toLowerCase();
  const localRole = localStorage.getItem("tophouseRole");
  if (localRole === "admin" && (ADMIN_EMAILS.includes(email) || email.startsWith("admin@"))) return "admin";
  if (ADMIN_EMAILS.includes(email) || email.startsWith("admin@")) return "admin";
  return "venditore";
}

function saveRole(user) {
  const role = roleFromUser(user);
  localStorage.setItem("tophouseRole", role);
  document.body?.classList.toggle("is-admin", role === "admin");
  document.body?.classList.toggle("is-venditore", role === "venditore");
  return role;
}

function applyRoleVisibility(role = localStorage.getItem("tophouseRole")) {
  const isAdmin = role === "admin";
  document.querySelectorAll(".admin-only").forEach(element => { element.hidden = !isAdmin; });
  document.body?.classList.toggle("is-admin", isAdmin);
  document.body?.classList.toggle("is-venditore", role === "venditore");
}

window.TOPHOUSE_AUTH = {
  auth,
  requireLogin({ redirectTo = loginPath, adminOnly = false } = {}) {
    onAuthStateChanged(auth, user => {
      if (!user) {
        const next = encodeURIComponent(window.location.pathname.split("/").pop() || "admin-caricamento.html");
        window.location.href = `${redirectTo}?next=${next}`;
        return;
      }
      const role = saveRole(user);
      applyRoleVisibility(role);
      if (adminOnly && role !== "admin") {
        window.location.href = `${redirectTo}?denied=1&next=index.html`;
      }
    });
  },
  requireAdmin(options = {}) {
    this.requireLogin({ ...options, adminOnly: true });
  },
  applyRoleVisibility,
  isAdminSync() { return localStorage.getItem("tophouseRole") === "admin"; },
  initLoginForm() {
    const form = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const message = document.getElementById("loginMessage");
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "admin-caricamento.html";

    onAuthStateChanged(auth, user => {
      if (user) { saveRole(user); window.location.href = next; }
    });

    if (!form) return;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      if (button) button.disabled = true;
      setMessage(message, "Accesso in corso...");

      try {
        await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
        window.location.href = next;
      } catch (error) {
        console.error(error);
        setMessage(message, "Email o password non corretti. Riprova.", true);
      } finally {
        if (button) button.disabled = false;
      }
    });
  },
  bindLogout(buttonId = "logoutButton") {
    const button = document.getElementById(buttonId);
    if (!button) return;
    onAuthStateChanged(auth, user => {
      button.hidden = !user;
    });
    button.addEventListener("click", async () => {
      await signOut(auth);
      localStorage.removeItem("tophouseRole");
      window.location.href = loginPath;
    });
  }
};
