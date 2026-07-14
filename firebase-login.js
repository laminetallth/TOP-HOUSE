import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAestZqgTWKIFjurPdHARCz1Ir4IFcuBug",
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

function setMessage(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("error", isError);
}

window.TOPHOUSE_AUTH = {
  auth,
  requireLogin({ redirectTo = loginPath } = {}) {
    onAuthStateChanged(auth, user => {
      if (!user) {
        const next = encodeURIComponent(window.location.pathname.split("/").pop() || "admin-caricamento.html");
        window.location.href = `${redirectTo}?next=${next}`;
      }
    });
  },
  initLoginForm() {
    const form = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const message = document.getElementById("loginMessage");
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "admin-caricamento.html";

    onAuthStateChanged(auth, user => {
      if (user) window.location.href = next;
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
      window.location.href = loginPath;
    });
  }
};
