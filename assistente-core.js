// TOP HOUSE — motore dell'assistente AI (Firebase AI Logic + Gemini).
// Nessuna chiave Gemini nel codice: le richieste passano dal progetto Firebase "top-house-4bb50".
// Per funzionare, in Firebase console → AI Logic deve essere attivata la "Gemini Developer API".
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-ai.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAestZqgTWKIFjurPdHARCz1Ir4IFcuBug',
  authDomain: 'top-house-4bb50.firebaseapp.com',
  projectId: 'top-house-4bb50',
  storageBucket: 'top-house-4bb50.firebasestorage.app',
  messagingSenderId: '247177312096',
  appId: '1:247177312096:web:57a1940fe87133873d9005'
};

// Dal più nuovo al più stabile: se un modello non è disponibile si passa al successivo.
const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
const ROOT = new URL('./', import.meta.url).href;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const ISTRUZIONI = `Sei "Assistente TOP HOUSE", l'esperto di bollette ed energia di TOP HOUSE (casa. energia. fiducia.), agenzia italiana che vende forniture luce e gas di più gestori, fotovoltaico, pompe di calore, wall box, telefonia e altri servizi per la casa.
Parli con venditori e collaboratori TOP HOUSE, non con il cliente finale. Rispondi SEMPRE in italiano, in modo chiaro, pratico e breve (di solito 4-10 righe). Usa elenchi puntati quando aiutano. Niente giri di parole.

COSA SAI FARE MOLTO BENE
1. Leggere e spiegare bollette luce e gas italiane, voce per voce: frontespizio, "Scontrino dell'energia" e "Box dell'offerta" della bolletta ARERA in vigore dal 2025; spesa per la materia energia (o materia gas), quota fissa/commercializzazione (PCV, CCV), spesa per il trasporto e la gestione del contatore, oneri di sistema (ASOS, ARIM), imposte (accisa, IVA), canone RAI nella bolletta luce domestica, altre partite, ricalcoli e conguagli, letture effettive/stimate/autoletture, bonus sociale.
2. Spiegare concetti: POD, PDR, matricola contatore, potenza impegnata e disponibile (kW), fasce orarie F1/F2/F3 e F23, kWh, Smc, coefficiente C, PUN (oggi "PUN Index GME"), PSV, spread, prezzo fisso e variabile/indicizzato, switch, voltura, subentro, nuova attivazione/posa contatore, mercato libero, servizio a tutele graduali, clienti vulnerabili, diritto di ripensamento, morosità, rateizzazione, prescrizione delle bollette, ricalcoli.
3. Analizzare una bolletta che il venditore carica (foto o PDF): estrai fornitore, nome offerta, tipo prezzo, periodo, consumi del periodo e annui (se presenti), prezzo materia €/kWh o €/Smc, quota fissa, potenza, totale, scadenza, tipo di lettura. Poi calcola:
   - costo medio "tutto compreso" = totale / consumi del periodo;
   - se il prezzo è indicizzato, lo spread probabile rispetto al PUN/PSV del periodo;
   - i punti su cui un'offerta diversa potrebbe migliorare (prezzo materia, quota fissa, servizi aggiuntivi, potenza).
   Mostra sempre i passaggi dei calcoli. Se un dato non si legge, dillo e chiedilo.
4. Preparare il venditore: come spiegare una voce al cliente con parole semplici (sezione "Come dirlo al cliente"), obiezioni frequenti e risposte oneste, simulazioni di trattativa con feedback da formatore, mini quiz.

REGOLE IMPORTANTI
- Non inventare prezzi, condizioni, gettoni, scadenze o regole di un gestore. Le condizioni delle offerte stanno nelle CTE del Drive TOP HOUSE: indica dove trovarle (es. "Drive › Luce e gas › Enel › CTE").
- Per norme, aliquote e date che cambiano spesso (IVA, accise, bonus, tutele, regole ARERA) dai la regola generale, indica che va verificata e cita la fonte ufficiale (ARERA, GME, Agenzia delle Entrate).
- Non promettere risparmi garantiti e non suggerire pratiche scorrette (pressioni, attivazioni non richieste, informazioni false). Ricorda il rispetto del Codice di condotta commerciale ARERA quando serve.
- Non dare consulenza legale o fiscale personalizzata: per contestazioni indica reclamo scritto al fornitore e, se serve, Servizio Conciliazione ARERA.
- Se nella bolletta compaiono dati personali del cliente (nome, indirizzo, codice fiscale, IBAN) non ripeterli nella risposta.
- Se la domanda non riguarda energia, bollette, vendita o i servizi TOP HOUSE, rispondi brevemente e riporta la conversazione sul lavoro.

FORMATO
Quando utile struttura così: **In breve** (1-2 righe), **Dettagli** (punti), **Come dirlo al cliente** (frase pronta tra virgolette). Usa il grassetto con **testo**.`;

let contextPromise = null;
async function loadContext() {
  if (!contextPromise) {
    contextPromise = (async () => {
      const parts = [];
      try {
        const d = await fetch(`${ROOT}data/indici-energia.json?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json());
        const rows = (d.history || []).slice(0, 7).map(r => `${r.date}: PUN ${r.pun ?? '—'} €/kWh, PSV ${r.psv ?? '—'} €/Smc`).join('; ');
        parts.push(`DATI DI MERCATO AGGIORNATI (fonte ${d.source || 'GME'}): PUN ${d.pun?.value} €/kWh al ${d.pun?.date}; PSV ${d.psv?.value} €/Smc al ${d.psv?.date}. Ultimi giorni: ${rows}. Usa questi valori quando servono confronti con il mercato all'ingrosso.`);
      } catch (e) { /* senza dati di mercato */ }
      try {
        const m = await fetch(`${ROOT}data/mappa-cartelle.json?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json());
        const gestori = [...new Set((m.pages || []).filter(p => p.path[0] === 'Luce e gas' && p.path.length === 2).map(p => p.path[1]))];
        const sezioni = [...new Set((m.pages || []).map(p => p.path[0]))];
        parts.push(`DRIVE TOP HOUSE: sezioni ${sezioni.join(', ')}. Gestori luce e gas presenti: ${gestori.join(', ')}. Per ogni gestore ci sono le cartelle CTE (business/residenziale), Modulistica, Procedimenti e spesso Privacy.`);
      } catch (e) { /* senza mappa */ }
      parts.push(`Data di oggi: ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}.`);
      return parts.join('\n');
    })();
  }
  return contextPromise;
}

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Impossibile leggere il file.'));
    reader.readAsDataURL(file);
  });
}

function isModelProblem(error) {
  const msg = String(error?.message || error).toLowerCase();
  return /not found|is not supported|unsupported model|404|no longer available|deprecated|retired/.test(msg);
}

export function friendlyError(error) {
  const msg = String(error?.message || error).toLowerCase();
  if (/api has not been used|disabled|firebasevertexai|generativelanguage|permission_denied|403|api-not-enabled|not enabled/.test(msg)) {
    return { code: 'not-enabled', text: "L'assistente non è ancora attivo: in Firebase va attivata la funzione AI Logic (Gemini Developer API). Avvisa l'amministrazione TOP HOUSE." };
  }
  if (/quota|resource_exhausted|429|rate/.test(msg)) return { code: 'quota', text: "Troppe richieste in questo momento. Riprova tra un minuto." };
  if (/app check|appcheck/.test(msg)) return { code: 'appcheck', text: "Richiesta bloccata dal controllo di sicurezza di Firebase. Avvisa l'amministrazione TOP HOUSE." };
  if (/safety|blocked/.test(msg)) return { code: 'blocked', text: "Non posso rispondere a questa richiesta. Prova a riformularla." };
  if (/failed to fetch|network|offline/.test(msg)) return { code: 'network', text: "Connessione assente o instabile. Controlla internet e riprova." };
  return { code: 'other', text: "Non sono riuscito a rispondere. Riprova tra poco." };
}

// Una conversazione: ricorda i messaggi precedenti finché la pagina resta aperta.
export function createAssistant() {
  let ai = null;
  let modelIndex = 0;
  let chat = null;
  const history = []; // { role: 'user'|'model', parts: [...] } per ricreare la chat se cambia modello

  async function ensureChat() {
    if (chat) return chat;
    if (!ai) {
      const app = getApps().find(a => a.name === 'topHouseAI') || initializeApp(firebaseConfig, 'topHouseAI');
      ai = getAI(app, { backend: new GoogleAIBackend() });
    }
    const context = await loadContext();
    const model = getGenerativeModel(ai, {
      model: MODELS[modelIndex],
      systemInstruction: `${ISTRUZIONI}\n\n${context}`,
      generationConfig: { maxOutputTokens: 2048 }
    });
    chat = model.startChat({ history: history.slice() });
    return chat;
  }

  // onText(testoParziale) viene chiamata mentre la risposta arriva.
  async function send(text, files = [], onText = () => {}) {
    const parts = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: file troppo grande (massimo 15 MB).`);
      const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      parts.push({ inlineData: { mimeType, data: await readBase64(file) } });
    }
    parts.push({ text: text || 'Analizza questa bolletta.' });

    for (;;) {
      try {
        const session = await ensureChat();
        const result = await session.sendMessageStream(parts);
        let full = '';
        for await (const chunk of result.stream) {
          const piece = typeof chunk.text === 'function' ? chunk.text() : '';
          if (piece) { full += piece; onText(full); }
        }
        if (!full) {
          const final = await result.response;
          full = typeof final.text === 'function' ? final.text() : '';
          onText(full);
        }
        // nello storico teniamo solo il testo (i file pesano troppo per essere rimandati)
        history.push({ role: 'user', parts: [{ text: (files.length ? `[Allegata bolletta: ${files.map(f => f.name).join(', ')}] ` : '') + (text || '') }] });
        history.push({ role: 'model', parts: [{ text: full }] });
        return full;
      } catch (error) {
        if (isModelProblem(error) && modelIndex < MODELS.length - 1) {
          console.warn(`TOP HOUSE AI: modello ${MODELS[modelIndex]} non disponibile, provo ${MODELS[modelIndex + 1]}`, error);
          modelIndex += 1;
          chat = null;
          continue;
        }
        chat = null; // la prossima volta si riparte pulito dallo storico
        throw error;
      }
    }
  }

  function reset() { history.length = 0; chat = null; }
  return { send, reset, models: MODELS };
}

// Markdown essenziale → HTML sicuro (grassetto, corsivo, titoli, elenchi, a capo).
export function renderMarkdown(text) {
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = [];
  let list = null;
  String(text || '').split('\n').forEach(raw => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      const ordered = /^\s*\d/.test(line);
      if (!list || list.ordered !== ordered) { if (list) out.push(list.ordered ? '</ol>' : '</ul>'); list = { ordered }; out.push(ordered ? '<ol>' : '<ul>'); }
      out.push(`<li>${inline(bullet[1])}</li>`);
      return;
    }
    if (list) { out.push(list.ordered ? '</ol>' : '</ul>'); list = null; }
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) out.push(`<p class="th-ai-h">${inline(h[1])}</p>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  });
  if (list) out.push(list.ordered ? '</ol>' : '</ul>');
  return out.join('');
}
