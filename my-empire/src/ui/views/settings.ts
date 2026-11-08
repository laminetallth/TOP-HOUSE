import type { Ctx, ViewResult } from '../app.js';
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { button, field, input, section } from '../components.js';
import { haptic } from '../fx.js';
import * as A from '../../data/actions.js';
import { buildIcs } from '../../domain/ics.js';
import { shortLabel } from '../../domain/dates.js';
import { notifySupported, plannedToday } from '../reminders.js';
import type { App } from '../app.js';

function download(name: string, text: string, type: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

export function settingsView(ctx: Ctx): ViewResult {
  const st = ctx.store;
  const s = st.settings();
  const name = input({ id: 'set-name', value: s.name, attrs: { maxlength: 40 } });
  const perm = notifySupported() ? Notification.permission : 'unsupported';
  const planned = plannedToday(ctx as App).filter((r) => {
    const n = st.now();
    return r.at >= n.getHours() * 60 + n.getMinutes();
  });
  const restInput = input({ id: 'rest-date', type: 'date', value: ctx.today });
  const fileIn = h('input', { type: 'file', id: 'import-file', attrs: { accept: 'application/json,.json' }, class: 'visually-hidden', on: { change: async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!(await ctx.confirm('Ripristinare il backup?', 'Tutti i dati attuali verranno sostituiti da quelli del file. Conviene esportare prima un backup di quelli attuali.', 'Ripristina', true))) return;
      await ctx.run(async () => { const n = await st.importAll(data); ctx.toast(`Backup ripristinato: ${n} elementi`); });
    } catch (err) {
      ctx.toast(`File non valido: ${(err as Error).message}`, { error: true });
    }
  } } });

  return {
    title: 'Impostazioni',
    node: h('div', { class: 'page' },
      h('h1', { class: 'page-title' }, 'Impostazioni'),
      section('Profilo',
        h('form', { class: 'row-form', on: { submit: (e) => { e.preventDefault(); void ctx.run(() => A.updateSettings(st, { name: name.value }), 'Nome aggiornato', true); } } }, field('Come ti chiamo', name), button('Salva', () => undefined, { type: 'submit', small: true })),
      ),
      section('Promemoria',
        h('div', { class: 'info-card' },
          icon('bell', 18),
          h('div', null,
            h('strong', null, 'Notifiche con l\'app aperta'),
            h('p', { class: 'muted small' }, 'Con l\'app aperta (anche in secondo piano) ricevi un avviso all\'orario di ogni promemoria. Su Android funzionano dopo la pubblicazione online e l\'installazione sulla schermata Home.'),
            perm === 'unsupported'
              ? h('p', { class: 'warn small' }, 'Questo browser non supporta le notifiche.')
              : perm === 'granted' && s.notify
                ? h('div', { class: 'row' }, h('span', { class: 'ok-text' }, icon('check', 16), ' Attive'), button('Disattiva', () => void ctx.run(() => A.updateSettings(st, { notify: false }), 'Notifiche disattivate'), { small: true, variant: 'quiet' }))
                : button(perm === 'denied' ? 'Bloccate dal browser' : 'Attiva notifiche', async () => {
                    if (perm === 'denied') return ctx.toast('Le notifiche sono bloccate: abilitale dalle impostazioni del sito nel browser.', { error: true });
                    const p = await Notification.requestPermission().catch(() => 'denied' as NotificationPermission);
                    if (p === 'granted') { haptic(15); await ctx.run(() => A.updateSettings(st, { notify: true }), 'Notifiche attive'); }
                    else ctx.toast('Permesso non concesso dal browser.', { error: true });
                  }, { small: true, variant: 'primary', disabled: perm === 'denied' }),
          ),
        ),
        h('div', { class: 'info-card' },
          icon('calendar', 18),
          h('div', null,
            h('strong', null, 'Notifiche garantite: calendario del telefono'),
            h('p', { class: 'muted small' }, 'Scarica un file con tutti i promemoria con orario e gli eventi, e aprilo con Google Calendar: le notifiche arriveranno anche ad app chiusa. Se cambi orari, scarica di nuovo il file.'),
            button('Scarica per il calendario (.ics)', () => {
              const r = buildIcs(st.all('habits'), st.all('calEvents'), ctx.today, st.nowIso());
              if (download('my-empire-promemoria.ics', r.text, 'text/calendar')) ctx.toast(`${r.count} promemoria esportati${r.skipped.length ? ` (senza giorno fisso: ${r.skipped.join(', ')})` : ''}`);
              else ctx.toast('Il download non è disponibile in questa anteprima: funziona nell\'app pubblicata.', { error: true });
            }, { small: true, icon: 'download' }),
          ),
        ),
        planned.length ? h('div', { class: 'stack-sm' }, h('h3', { class: 'sub-title' }, 'Ancora oggi'), h('ul', { class: 'log-list' }, ...planned.map((r) => h('li', null, h('span', { class: 'log-date' }, `${String(Math.floor(r.at / 60)).padStart(2, '0')}:${String(r.at % 60).padStart(2, '0')}`), h('span', { class: 'log-val' }, r.title))))) : null,
      ),
      section('Giorni di riposo',
        h('p', { class: 'muted small' }, 'Vacanza, malattia, imprevisto: in questi giorni nessuna attività risulta mancata e le serie non si interrompono.'),
        h('form', { class: 'row-form', on: { submit: (e) => { e.preventDefault(); if (restInput.value && !s.restDates.includes(restInput.value)) void ctx.run(() => A.updateSettings(st, { restDates: [...s.restDates, restInput.value].sort() }), 'Giorno di riposo aggiunto', true); } } }, field('Giorno', restInput), button('Aggiungi', () => undefined, { type: 'submit', small: true })),
        s.restDates.length ? h('div', { class: 'chips' }, ...s.restDates.map((d) => h('span', { class: 'chip' }, shortLabel(d), h('button', { type: 'button', class: 'chip-x', attrs: { 'aria-label': `Rimuovi ${shortLabel(d)}` }, on: { click: () => void ctx.run(() => A.updateSettings(st, { restDates: s.restDates.filter((x) => x !== d) }), 'Giorno rimosso', true) } }, icon('x', 12))))) : null,
      ),
      section('Dati e backup',
        h('div', { class: 'info-card' }, icon('lock', 18), h('div', null, h('strong', null, 'Salvati su questo dispositivo'), h('p', { class: 'muted small' }, 'I dati restano nel browser di questo telefono: niente account, niente sincronizzazione. Esporta un backup ogni tanto; cancellare i dati del sito li elimina.'))),
        h('div', { class: 'actions-wrap' },
          button('Esporta backup', () => {
            if (download(`my-empire-backup-${ctx.today}.json`, JSON.stringify(st.exportAll(), null, 2), 'application/json')) ctx.toast('Backup esportato');
            else ctx.toast('Il download non è disponibile in questa anteprima.', { error: true });
          }, { small: true, icon: 'download' }),
          h('label', { class: 'btn btn-ghost btn-sm', attrs: { for: 'import-file' } }, icon('undo', 16), h('span', null, 'Ripristina da file')),
          fileIn,
          button('Proteggi i dati dal browser', async () => {
            const ok = await navigator.storage?.persist?.().catch(() => false);
            ctx.toast(ok ? 'Archiviazione persistente attiva' : 'Il browser non l\'ha concessa', { error: !ok });
          }, { small: true, variant: 'quiet' }),
        ),
      ),
      h('p', { class: 'muted small center' }, 'My Empire 2.0'),
    ),
  };
}
