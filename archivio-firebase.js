import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getStorage, ref, listAll, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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
const storage = getStorage(app);
const archiveGrid = document.querySelector('[data-archive-list]');
const archiveStatus = document.querySelector('[data-archive-status]');

const escapeHtml = (value) => (value || '').toString().replace(/[&<>"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}[char]));

const renderDocument = ({ name, url }) => `
  <article class="tile document-card" data-search-item="${escapeHtml(name)}">
    <span class="tile-left">
      <span class="tile-icon document-pdf-icon"><i class="fa-solid fa-file-pdf"></i></span>
      <span class="tile-name">${escapeHtml(name)}</span>
    </span>
    <span class="document-actions">
      <a class="document-button" href="${escapeHtml(url)}" target="_blank" rel="noopener">Apri</a>
      <a class="document-button document-button-secondary" href="${escapeHtml(url)}" download>Scarica</a>
    </span>
  </article>`;

async function loadArchive() {
  if (!archiveGrid) return;

  try {
    const folderRef = ref(storage, 'documenti');
    const result = await listAll(folderRef);
    const files = await Promise.all(result.items.map(async (itemRef) => ({
      name: itemRef.name,
      url: await getDownloadURL(itemRef)
    })));

    archiveGrid.innerHTML = files.length
      ? files.map(renderDocument).join('')
      : '<div class="tile document-empty"><span class="tile-left"><span class="tile-icon"><i class="fa-solid fa-folder-open"></i></span><span class="tile-name">Nessun PDF trovato in Firebase Storage/documenti.</span></span></div>';

    if (archiveStatus) archiveStatus.textContent = `${files.length} PDF trovati nella cartella documenti/.`;
  } catch (error) {
    console.error(error);
    archiveGrid.innerHTML = '<div class="tile document-empty"><span class="tile-left"><span class="tile-icon"><i class="fa-solid fa-triangle-exclamation"></i></span><span class="tile-name">Impossibile leggere Firebase Storage. Controlla regole e configurazione.</span></span></div>';
    if (archiveStatus) archiveStatus.textContent = 'Errore durante il caricamento archivio.';
  }
}

loadArchive();
