// TOP HOUSE — assistente AI disponibile in tutto il Drive (pulsante in basso a destra).
import { createAssistant, renderMarkdown, friendlyError } from './assistente-core.js';

const CASETTA = `<span class="th-loading th-loading--small"><img src="${new URL('./casetta.svg', import.meta.url).href}" alt=""><span>Sto pensando…</span></span>`;

const SUGGERIMENTI = [
  { label: 'Analizza una bolletta', q: '', attach: true },
  { label: 'Perché la bolletta è alta?', q: 'Un cliente dice che la bolletta è troppo alta. Come capisco il motivo voce per voce e cosa gli dico?' },
  { label: 'Fisso o variabile?', q: 'Spiegami differenza tra prezzo fisso e variabile indicizzato al PUN, con un esempio di calcolo e come spiegarlo al cliente.' },
  { label: 'Oneri di sistema', q: 'Cosa sono gli oneri di sistema in bolletta e come li spiego al cliente?' },
  { label: 'Voltura o subentro?', q: 'Differenza tra voltura, subentro e nuova attivazione, con i documenti che servono.' },
  { label: 'Simula un cliente', q: 'Fai finta di essere un cliente diffidente che non vuole cambiare fornitore luce. Io sono il venditore: inizia tu.' }
];

const assistant = createAssistant();
let busy = false;
let pending = [];

const fab = document.createElement('button');
fab.type = 'button';
fab.className = 'th-ai-fab';
fab.setAttribute('aria-label', 'Apri l\'assistente bollette');
fab.innerHTML = '<span class="th-ai-fab-ico"><i class="fa-solid fa-bolt" aria-hidden="true"></i></span><span class="th-ai-fab-txt">Assistente</span>';
document.body.appendChild(fab);

const panel = document.createElement('section');
panel.className = 'th-ai';
panel.setAttribute('role', 'dialog');
panel.setAttribute('aria-label', 'Assistente bollette TOP HOUSE');
panel.hidden = true;
panel.innerHTML = `
  <header class="th-ai-head">
    <span class="th-ai-avatar"><i class="fa-solid fa-bolt" aria-hidden="true"></i></span>
    <div><b>Assistente TOP HOUSE</b><small>Esperto di bollette luce e gas</small></div>
    <button type="button" class="th-icon-btn" data-ai="reset" title="Nuova conversazione"><i class="fa-solid fa-rotate-left"></i></button>
    <button type="button" class="th-icon-btn" data-ai="close" title="Chiudi"><i class="fa-solid fa-xmark"></i></button>
  </header>
  <div class="th-ai-log" aria-live="polite"></div>
  <div class="th-ai-sugg"></div>
  <div class="th-ai-files" hidden></div>
  <form class="th-ai-form">
    <button type="button" class="th-icon-btn" data-ai="attach" title="Allega foto o PDF della bolletta"><i class="fa-solid fa-paperclip"></i></button>
    <textarea rows="1" placeholder="Chiedi qualcosa sulle bollette…" aria-label="Scrivi la tua domanda"></textarea>
    <button type="submit" class="th-ai-send" aria-label="Invia"><i class="fa-solid fa-arrow-up"></i></button>
    <input type="file" accept="image/*,application/pdf" multiple hidden>
  </form>
  <p class="th-ai-note">Prima di allegare una bolletta copri nome, indirizzo e codice fiscale del cliente. Le risposte vanno verificate.</p>`;
document.body.appendChild(panel);

const log = panel.querySelector('.th-ai-log');
const sugg = panel.querySelector('.th-ai-sugg');
const form = panel.querySelector('form');
const box = panel.querySelector('textarea');
const fileInput = panel.querySelector('input[type=file]');
const filesBar = panel.querySelector('.th-ai-files');

function welcome() {
  log.innerHTML = '';
  bubble('bot', '**Ciao!** Sono l\'assistente di TOP HOUSE.\nPosso spiegarti qualsiasi voce di una bolletta luce o gas, **leggere una bolletta** che mi alleghi (foto o PDF) e prepararti a rispondere al cliente.');
  sugg.innerHTML = SUGGERIMENTI.map((s, i) => `<button type="button" data-s="${i}">${s.label}</button>`).join('');
  sugg.hidden = false;
}

function bubble(who, text) {
  const div = document.createElement('div');
  div.className = `th-ai-msg ${who}`;
  div.innerHTML = who === 'user' ? `<p>${text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])).replace(/\n/g, '<br>')}</p>` : renderMarkdown(text);
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

function renderFiles() {
  filesBar.hidden = !pending.length;
  filesBar.innerHTML = pending.map((f, i) => `<span><i class="fa-solid ${f.type === 'application/pdf' ? 'fa-file-pdf' : 'fa-image'}"></i> ${f.name.replace(/[<>&"]/g, '')} <button type="button" data-rm="${i}" aria-label="Togli ${f.name.replace(/[<>&"]/g, '')}">×</button></span>`).join('');
}

async function ask(question) {
  const text = (question || '').trim();
  if (busy || (!text && !pending.length)) return;
  busy = true;
  sugg.hidden = true;
  const files = pending; pending = []; renderFiles();
  bubble('user', (files.length ? `📎 ${files.map(f => f.name).join(', ')}\n` : '') + (text || 'Analizza questa bolletta.'));
  box.value = ''; autosize();
  const answer = bubble('bot', '');
  answer.classList.add('is-typing');
  answer.innerHTML = CASETTA;
  try {
    await assistant.send(text || 'Analizza questa bolletta: estrai i dati principali, calcola il costo medio e dimmi su cosa puntare con il cliente.', files, partial => {
      answer.classList.remove('is-typing');
      answer.innerHTML = renderMarkdown(partial);
      log.scrollTop = log.scrollHeight;
    });
  } catch (error) {
    console.error('TOP HOUSE AI:', error);
    answer.classList.remove('is-typing');
    answer.classList.add('is-error');
    answer.innerHTML = renderMarkdown(friendlyError(error).text);
  } finally {
    busy = false;
    box.focus();
  }
}

function autosize() { box.style.height = 'auto'; box.style.height = `${Math.min(140, box.scrollHeight)}px`; }

function open() {
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('is-open'));
  fab.classList.add('is-hidden');
  if (!log.children.length) welcome();
  setTimeout(() => box.focus(), 250);
}
function close() {
  panel.classList.remove('is-open');
  fab.classList.remove('is-hidden');
  setTimeout(() => { panel.hidden = true; }, 250);
}

fab.addEventListener('click', open);
panel.querySelector('[data-ai="close"]').addEventListener('click', close);
panel.querySelector('[data-ai="reset"]').addEventListener('click', () => { assistant.reset(); pending = []; renderFiles(); welcome(); });
panel.querySelector('[data-ai="attach"]').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { pending = [...pending, ...fileInput.files].slice(0, 4); fileInput.value = ''; renderFiles(); box.focus(); });
filesBar.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { pending.splice(Number(b.dataset.rm), 1); renderFiles(); } });
sugg.addEventListener('click', e => {
  const b = e.target.closest('[data-s]'); if (!b) return;
  const s = SUGGERIMENTI[Number(b.dataset.s)];
  if (s.attach) fileInput.click(); else ask(s.q);
});
form.addEventListener('submit', e => { e.preventDefault(); ask(box.value); });
box.addEventListener('input', autosize);
box.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(box.value); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });

// incolla un'immagine (screenshot della bolletta) direttamente nel campo
box.addEventListener('paste', e => {
  const imgs = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
  if (imgs.length) { pending = [...pending, ...imgs].slice(0, 4); renderFiles(); }
});

window.TOPHOUSE_AI = { open, ask };
