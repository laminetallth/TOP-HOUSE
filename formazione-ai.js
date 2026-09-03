// Assistente AI TOP HOUSE tramite Firebase AI Logic.
// Non contiene una Gemini API key: Firebase AI Logic usa il proxy Firebase.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-ai.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAestZqgTWKIFjurPdHARCz1Ir4IFcuBug',
  authDomain: 'top-house-4bb50.firebaseapp.com',
  projectId: 'top-house-4bb50',
  storageBucket: 'top-house-4bb50.firebasestorage.app',
  messagingSenderId: '247177312096',
  appId: '1:247177312096:web:57a1940fe87133873d9005',
  measurementId: 'G-LDNC97B4GN'
};

const SYSTEM = `Sei l'assistente ufficiale della TOP HOUSE Academy per venditori di energia in Italia. Sei esperto di energia elettrica e gas naturale, bollette, mercato libero, POD, PDR, PUN, PSV, kWh, Smc, potenza, consumi, fasce, letture, conguagli, switch, volture, subentri e filiera energetica. Rispondi SEMPRE in italiano, in modo molto semplice, breve e pratico. Evita tecnicismi inutili. Quando utile struttura così: RISPOSTA, ESEMPIO, COME DIRLO AL CLIENTE. Non inventare prezzi, condizioni contrattuali o regole. Se una risposta dipende da normativa o da una specifica offerta, dillo chiaramente e invita a verificare il contratto e le fonti ufficiali. Non promettere risparmi al cliente e non dare consulenza legale o finanziaria. Se il venditore chiede una simulazione, interpreta il cliente e poi dai un feedback da formatore.`;

let model = null;
let history = [];

function setup() {
  const messages = document.getElementById('messages');
  const input = document.getElementById('question');
  const oldSend = document.getElementById('send');
  if (!messages || !input || !oldSend) return;

  // Rimuove gli handler della versione locale e li sostituisce con l'assistente AI.
  const send = oldSend.cloneNode(true);
  oldSend.replaceWith(send);
  const cleanInput = input.cloneNode(true);
  input.replaceWith(cleanInput);

  document.querySelectorAll('[data-q]').forEach(el => {
    const clone = el.cloneNode(true);
    el.replaceWith(clone);
    clone.addEventListener('click', () => ask(clone.dataset.q));
  });

  function add(text, who) {
    const d = document.createElement('div');
    d.className = 'msg ' + who;
    d.textContent = text;
    messages.appendChild(d);
    messages.scrollTop = messages.scrollHeight;
    return d;
  }

  function localFallback(q) {
    const nq = q.toLowerCase();
    if (nq.includes('pod') && nq.includes('pdr')) return 'POD = identifica il punto di fornitura della luce. PDR = identifica il punto di fornitura del gas.\n\nFacile: POD → luce ⚡ | PDR → gas 🔥.';
    if (nq.includes('pod')) return 'POD = codice che identifica il punto di prelievo dell’energia elettrica. Non cambia se cambi fornitore.\n\nCome dirlo al cliente: “È come la carta d’identità del tuo punto luce.”';
    if (nq.includes('pdr')) return 'PDR = codice che identifica il punto di riconsegna del gas. Non cambia se cambi fornitore.\n\nCome dirlo al cliente: “È il codice che identifica il tuo punto gas.”';
    if (nq.includes('voltura') && nq.includes('subentro')) return 'Voltura = cambia l’intestatario di una fornitura attiva.\nSubentro = riattiva una fornitura che era stata disattivata.\n\nFacile: attiva → voltura; disattiva → subentro.';
    if (nq.includes('pun')) return 'PUN = riferimento di mercato per il prezzo dell’energia elettrica all’ingrosso. Può essere usato nelle offerte indicizzate.';
    if (nq.includes('psv')) return 'PSV = riferimento di mercato usato per il prezzo del gas all’ingrosso. Può essere usato nelle offerte indicizzate.';
    return 'Posso spiegarti termini, bollette, offerte e situazioni di vendita luce e gas. Per una risposta aggiornata su normativa o condizioni contrattuali, va verificata la documentazione ufficiale.';
  }

  async function ask(q) {
    q = String(q || '').trim();
    if (!q) return;
    add(q, 'user');
    cleanInput.value = '';
    const thinking = add('Sto pensando…', 'bot');
    try {
      if (!model) {
        const app = initializeApp(firebaseConfig, 'topHouseAcademyAI');
        const ai = getAI(app, { backend: new GoogleAIBackend() });
        model = getGenerativeModel(ai, { model: 'gemini-3.7-flash' });
      }
      const recent = history.slice(-8).map(x => `${x.role}: ${x.text}`).join('\n');
      const prompt = `${SYSTEM}\n\nCONVERSAZIONE RECENTE:\n${recent || '(nessuna)'}\n\nDOMANDA DEL VENDITORE:\n${q}`;
      const result = await model.generateContent(prompt);
      const text = result?.response?.text?.() || '';
      if (!text) throw new Error('Risposta vuota');
      thinking.textContent = text;
      history.push({ role:'venditore', text:q }, { role:'assistente', text });
    } catch (error) {
      console.error('TOP HOUSE AI:', error);
      thinking.textContent = localFallback(q) + '\n\nNota: l’assistente AI non è ancora attivo/configurato nel progetto Firebase.';
    }
  }

  send.addEventListener('click', () => ask(cleanInput.value));
  cleanInput.addEventListener('keydown', e => { if (e.key === 'Enter') ask(cleanInput.value); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
else setup();
