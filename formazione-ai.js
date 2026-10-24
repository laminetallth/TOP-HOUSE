// Collega la chat della TOP HOUSE Academy al motore AI comune (assistente-core.js).
// Se l'AI non è attiva in Firebase, resta la risposta locale già presente nella pagina.
import { createAssistant, renderMarkdown, friendlyError } from './assistente-core.js';

const assistant = createAssistant();
const messages = document.getElementById('messages');
const input = document.getElementById('question');
const localAnswer = typeof window.localAnswer === 'function' ? window.localAnswer : null;
let busy = false;

function bubble(who, html) {
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.innerHTML = html;
  messages.appendChild(d);
  messages.scrollTop = messages.scrollHeight;
  return d;
}

async function ask(q) {
  q = String(q || '').trim();
  if (!q || busy || !messages) return;
  busy = true;
  bubble('user', q.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  if (input) input.value = '';
  const answer = bubble('bot', '<span class="th-ai-dots"><i></i><i></i><i></i></span>');
  try {
    await assistant.send(q, [], partial => { answer.innerHTML = renderMarkdown(partial); messages.scrollTop = messages.scrollHeight; });
  } catch (error) {
    console.error('TOP HOUSE AI:', error);
    const fe = friendlyError(error);
    const fallback = localAnswer ? localAnswer(q) : '';
    answer.innerHTML = renderMarkdown((fallback ? fallback + '\n\n' : '') + `*${fe.text}*`);
  } finally { busy = false; }
}

// La pagina chiama ask(...) dai suoi pulsanti: sostituiamo la versione locale con quella AI.
window.ask = ask;
