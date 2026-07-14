import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// La tua configurazione Firebase ufficiale
const firebaseConfig = {
  apiKey: "AIzaSyAestZqgTWKIFjurPdHARcz1Ir4IFcuBug",
  authDomain: "top-house-4bb50.firebaseapp.com",
  projectId: "top-house-4bb50",
  storageBucket: "top-house-4bb50.firebasestorage.app",
  messagingSenderId: "247177312096",
  appId: "1:247177312096:web:57a1940fe87133873d9005",
  measurementId: "G-LDNC97B4GN"
};

// Inizializziamo Firebase e lo Storage
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Questa è la funzione magica che fa funzionare il pulsante "Carica file" del tuo index.html
window.uploadFile = async function() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert("Per favore, seleziona prima un file dal tablet!");
        return;
    }

    // Creiamo il collegamento all'archivio Firebase
    const storageRef = ref(storage, 'documenti/' + file.name);

    try {
        alert("Caricamento in corso... Premi OK e attendi un istante.");
        
        // Carica i dati su Firebase
        await uploadBytes(storageRef, file);
        
        // Recupera il link del file appena caricato
        const downloadURL = await getDownloadURL(storageRef);
        
        alert("Evviva! Il file è stato caricato con successo su Firebase.");
        console.log("Link del file:", downloadURL);
        
        // Pulisce il campo di selezione
        fileInput.value = '';
    } catch (error) {
        console.error(error);
        alert("Errore durante il caricamento: controlla le regole del tuo Storage.");
    }
}
