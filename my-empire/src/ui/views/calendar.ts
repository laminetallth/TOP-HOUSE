import type { Ctx, ViewResult } from '../app.js';
import { cx, h } from '../dom.js';
import { icon } from '../icons.js';
import { button, field, input, segmented, textarea } from '../components.js';
import { burstFrom, haptic, isFresh, markFresh } from '../fx.js';
import * as C from '../../data/calActions.js';
import { activeHabits, habitCheck, habitHref, look } from '../activity.js';
import { fromKey, isDateKey, isoWeekday, longLabel, monthName, relativeLabel, shortLabel, weekdayShort, type DateKey } from '../../domain/dates.js';
import { monthGrid, occurrencesIn, occurrencesOn, repeatLabel, shiftMonth, validateEvent, type EventInput } from '../../domain/calendar.js';
import { isScheduledDay, ruleFor } from '../../domain/habits.js';
import type { CalEvent, EventColor, Repeat } from '../../domain/types.js';

const COLORS: { value: EventColor; label: string }[] = [
  { value: 'aurora', label: 'Aurora' }, { value: 'gold', label: 'Oro' }, { value: 'sky', label: 'Cielo' }, { value: 'rose', label: 'Rosa' }, { value: 'lime', label: 'Lime' },
];

let lastMonth = '';

export function calendarView(ctx: Ctx, params: Record<string, string>): ViewResult {
  const st = ctx.store;
  const today = ctx.today;
  const sel = params.date && isDateKey(params.date) ? params.date : today;
  const grid = monthGrid(sel);
  const mKey = sel.slice(0, 7);
  const monthChanged = lastMonth !== mKey;
  lastMonth = mKey;
  const occ = occurrencesIn(st.all('calEvents'), grid[0], grid[grid.length - 1]);
  const habits = activeHabits(ctx);
  const games = st.all('basketGames').filter((g) => !g.deletedAt);
  const rest = st.settings().restDates;
  const go = (d: DateKey): void => { haptic(5); ctx.go(`/calendario/${d}`); };

  let sx = 0;
  const month = h('div', { class: cx('month', monthChanged && 'cascade'), on: {
    touchstart: (e) => { sx = e.touches[0].clientX; },
    touchend: (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 60) go(shiftMonth(sel, dx < 0 ? 1 : -1)); },
  } },
    ...[1, 2, 3, 4, 5, 6, 7].map((d) => h('span', { class: 'm-wd' }, weekdayShort(d))),
    ...grid.map((d, i) => {
      const ev = occ.get(d) ?? [];
      // Attività: quota fatta tra quelle previste quel giorno (solo fino a oggi).
      const due = habits.filter((x) => isScheduledDay(x, d, rest));
      const done = d <= today ? due.filter((x) => look(ctx, x, d) === 'done').length : 0;
      const missed = d < today ? due.filter((x) => look(ctx, x, d) === 'missed').length : 0;
      const game = games.find((g) => g.date === d);
      return h('button', {
        type: 'button',
        class: cx('m-cell', d.slice(0, 7) !== mKey && 'out', d === today && 'is-today', d === sel && 'sel', d < today && 'past'),
        style: `--i:${i}`,
        attrs: { 'aria-label': `${longLabel(d)}${ev.length ? `, ${ev.length} eventi` : ''}${game ? ', partita' : ''}` },
        on: { click: () => go(d) },
      },
        h('span', { class: 'm-n' }, String(fromKey(d).getDate())),
        h('span', { class: 'm-dots' }, ...ev.slice(0, 3).map((o) => h('i', { class: cx('ev', `c-${o.event.color}`, o.done && 'done') })), game ? h('i', { class: cx('ev game', game.scheduled && 'sched') }) : null),
        due.length && d <= today ? h('span', { class: 'm-bar' }, h('i', { class: 'ok', style: `width:${(done / due.length) * 100}%` }), h('i', { class: 'ko', style: `width:${(missed / due.length) * 100}%` })) : null,
      );
    }),
  );

  return {
    title: 'Calendario',
    node: h('div', { class: 'page page-wide' },
      h('div', { class: 'cal-top' },
        h('button', { type: 'button', class: 'icon-btn', attrs: { 'aria-label': 'Mese precedente' }, on: { click: () => go(shiftMonth(sel, -1)) } }, icon('left', 20)),
        h('h1', { class: 'cal-title' }, h('em', null, monthName(sel)), ` ${sel.slice(0, 4)}`),
        h('button', { type: 'button', class: 'icon-btn', attrs: { 'aria-label': 'Mese successivo' }, on: { click: () => go(shiftMonth(sel, 1)) } }, icon('right', 20)),
        sel !== today ? button('Oggi', () => go(today), { small: true, cls: 'cal-today' }) : null,
      ),
      h('div', { class: 'cal-layout' },
        h('div', { class: 'stack-sm' }, month,
          h('div', { class: 'legend' },
            h('span', null, h('i', { class: 'lg lg-bar' }), 'Attività fatte'),
            h('span', null, h('i', { class: 'lg lg-barko' }), 'Mancate'),
            h('span', null, h('i', { class: 'lg lg-ev' }), 'Eventi'),
            h('span', null, h('i', { class: 'lg lg-game' }), 'Partita'),
          ),
        ),
        dayAgenda(ctx, sel),
      ),
      h('button', { type: 'button', class: 'fab', attrs: { 'aria-label': 'Nuovo evento' }, on: { click: () => { haptic(8); openEventForm(ctx, null, sel); } } }, icon('plus', 26)),
    ),
  };
}

function dayAgenda(ctx: Ctx, d: DateKey): HTMLElement {
  const st = ctx.store;
  const today = ctx.today;
  const occ = occurrencesOn(st.all('calEvents'), d);
  const rest = st.settings().restDates;
  const habits = activeHabits(ctx).filter((x) => isScheduledDay(x, d, rest) || st.get('habitLogs', `${x.id}:${d}`) || (ruleFor(x, d)?.schedule.type === 'weekly' && d >= today));
  const games = st.all('basketGames').filter((g) => !g.deletedAt && g.date === d);

  return h('aside', { class: 'agenda' },
    h('div', { class: 'agenda-head' },
      h('h2', null, h('em', null, weekdayShortLong(d)), ` ${fromKey(d).getDate()} ${monthName(d)}`),
      h('span', { class: 'muted small' }, relativeLabel(d, today)),
    ),
    occ.length || games.length
      ? h('ul', { class: 'ag-list' },
          ...games.map((g) => h('li', { class: 'ag-item game' },
            h('span', { class: 'ag-time' }, g.time ?? ''),
            h('a', { href: '#/basket', class: 'ag-body' }, h('strong', null, `Partita vs ${g.opponent}`), h('span', { class: 'muted small' }, g.scheduled ? `In programma${g.place ? ` · ${g.place}` : ''}` : 'Giocata · vedi statistiche')),
            h('span', { class: 'ag-icon' }, icon('basketball', 18)),
          )),
          ...occ.map((o) => {
            const e = o.event;
            const fresh = isFresh(`ev:${e.id}:${d}`);
            return h('li', { class: cx('ag-item', `c-${e.color}`, o.done && 'done') },
              h('span', { class: 'ag-time' }, e.start ?? 'tutto il giorno'),
              h('button', { type: 'button', class: 'ag-body', on: { click: () => openEventForm(ctx, e, d) } },
                h('strong', null, e.title),
                h('span', { class: 'muted small' }, [e.end ? `fino alle ${e.end}` : '', e.location, e.repeat.type !== 'none' ? repeatLabel(e.repeat) : '', e.remind !== undefined ? `promemoria ${remindLabel(e.remind)}` : ''].filter(Boolean).join(' · ')),
              ),
              e.task && d <= today
                ? h('button', { type: 'button', class: cx('cc', o.done ? 'cc-done' : 'cc-todo', fresh && 'fresh'), attrs: { 'aria-label': o.done ? 'Togli spunta' : 'Fatto' }, on: { click: async (ev) => {
                    if (!o.done) { burstFrom(ev.currentTarget as Element); haptic(15); markFresh(`ev:${e.id}:${d}`); }
                    await ctx.run(() => C.toggleEventDone(st, e.id, d), o.done ? 'Spunta tolta' : `${e.title} ✓`, true);
                  } } }, tick())
                : null,
            );
          }),
        )
      : h('p', { class: 'muted' }, d >= today ? 'Nessun evento. Tocca + per aggiungerne uno.' : 'Nessun evento.'),
    habits.length
      ? h('div', { class: 'stack-sm' },
          h('h3', { class: 'sub-title' }, 'Attività'),
          h('ul', { class: 'ag-habits' }, ...habits.map((x) => {
            const lk = look(ctx, x, d);
            return h('li', { class: cx('agh', `hc-${lk}`) },
              h('span', { class: 'agh-icon' }, icon(x.icon, 16)),
              h('a', { href: habitHref(x), class: 'agh-name' }, x.name),
              d <= today && x.kind === 'check' ? habitCheck(ctx, x, d) : h('span', { class: 'muted small' }, d > today ? (ruleFor(x, d)?.schedule.type === 'weekly' ? 'libero' : 'previsto') : ''),
            );
          })),
        )
      : null,
    d !== today && d > today && occ.length === 0 && !games.length ? button('Aggiungi evento', () => openEventForm(ctx, null, d), { small: true, icon: 'plus' }) : null,
  );
}

function weekdayShortLong(d: DateKey): string {
  return ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'][isoWeekday(d) - 1];
}

function tick(): SVGElement {
  const t = document.createElement('template');
  t.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" class="cc-bg"/><path d="M9.5 16.5l4.2 4.2 8.8-9.4" class="cc-tick"/></svg>';
  return t.content.firstElementChild as SVGElement;
}

export function remindLabel(m: number): string {
  if (m === 0) return 'all\'ora';
  if (m < 60) return `${m} min prima`;
  if (m < 1440) return `${m / 60} h prima`;
  return m === 1440 ? '1 giorno prima' : `${Math.round(m / 1440)} giorni prima`;
}

// ─── Modulo evento ───────────────────────────────────────────────────────────

export function openEventForm(ctx: Ctx, existing: CalEvent | null, date: DateKey, preset: Partial<EventInput> = {}): void {
  const st = ctx.store;
  const state: { repeat: Repeat; color: EventColor; task: boolean; allDay: boolean; remind?: number } = {
    repeat: existing?.repeat ?? preset.repeat ?? { type: 'none' },
    color: existing?.color ?? preset.color ?? 'aurora',
    task: existing?.task ?? preset.task ?? false,
    allDay: existing ? !existing.start : !preset.start,
    remind: existing?.remind ?? preset.remind,
  };
  ctx.sheet(existing ? 'Modifica evento' : state.task ? 'Nuovo promemoria' : 'Nuovo evento', (close) => {
    const title = input({ id: 'ev-title', value: existing?.title ?? preset.title ?? '', placeholder: 'es. Dentista, Chiamare commercialista', attrs: { maxlength: 120, autofocus: !existing } });
    const day = input({ id: 'ev-date', type: 'date', value: existing?.date ?? date });
    const start = input({ id: 'ev-start', type: 'time', value: existing?.start ?? preset.start ?? '09:00' });
    const end = input({ id: 'ev-end', type: 'time', value: existing?.end ?? '' });
    const loc = input({ id: 'ev-loc', value: existing?.location ?? '', placeholder: 'Facoltativo', attrs: { maxlength: 120 } });
    const note = textarea({ id: 'ev-note', value: existing?.note ?? '', rows: 2 });
    const until = input({ id: 'ev-until', type: 'date', value: existing?.until ?? '' });
    const every = input({ id: 'ev-every', value: state.repeat.type === 'interval' ? String(state.repeat.every) : '2', attrs: { inputmode: 'numeric' } });
    const errBox = h('p', { class: 'form-error', attrs: { role: 'alert' } });
    const times = h('div');
    const rep = h('div', { class: 'stack-sm' });
    const misc = h('div', { class: 'stack-sm' });

    const drawTimes = (): void => {
      times.replaceChildren(
        segmented<'all' | 'time'>([{ value: 'all', label: 'Tutto il giorno' }, { value: 'time', label: 'Con orario' }], state.allDay ? 'all' : 'time', (v) => { state.allDay = v === 'all'; drawTimes(); }, 'Orario'),
        state.allDay ? '' : h('div', { class: 'grid2' }, field('Inizio', start), field('Fine', end, 'Facoltativa')),
      );
    };
    const drawRep = (): void => {
      const r = state.repeat;
      rep.replaceChildren(
        segmented<Repeat['type']>([
          { value: 'none', label: 'Una volta' }, { value: 'daily', label: 'Ogni giorno' }, { value: 'weekly', label: 'Settimanale' },
          { value: 'interval', label: 'Ogni N giorni' }, { value: 'monthly', label: 'Mensile' }, { value: 'yearly', label: 'Annuale' },
        ], r.type, (t) => {
          state.repeat = t === 'weekly' ? { type: 'weekly', days: [isoWeekday(day.value || date)] } : t === 'interval' ? { type: 'interval', every: 2 } : ({ type: t } as Repeat);
          drawRep();
        }, 'Ripetizione'),
        r.type === 'weekly'
          ? h('div', { class: 'seg' }, ...[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const on = r.days.includes(d);
              return h('button', { type: 'button', class: cx('seg-opt', on && 'on'), attrs: { 'aria-pressed': on }, on: { click: () => { state.repeat = { type: 'weekly', days: on ? r.days.filter((x) => x !== d) : [...r.days, d].sort() }; drawRep(); } } }, weekdayShort(d));
            }))
          : '',
        r.type === 'interval' ? field('Ogni quanti giorni', every, '2 = giorni alterni') : '',
        r.type !== 'none' ? field('Fino al', until, 'Facoltativo') : '',
      );
    };
    const drawMisc = (): void => {
      misc.replaceChildren(
        h('label', { class: 'switch-line' },
          h('input', { type: 'checkbox', id: 'ev-task', checked: state.task, on: { change: (e) => { state.task = (e.target as HTMLInputElement).checked; } } }),
          h('span', { class: 'switch' }), h('span', null, 'Da spuntare (promemoria con "fatto")'),
        ),
        field('Promemoria', segmented<number>([{ value: -1, label: 'No' }, { value: 0, label: 'All\'ora' }, { value: 10, label: '10 min' }, { value: 30, label: '30 min' }, { value: 60, label: '1 h' }, { value: 1440, label: '1 giorno' }], state.remind ?? -1, (v) => { state.remind = v < 0 ? undefined : v; drawMisc(); }, 'Promemoria')),
        field('Colore', h('div', { class: 'swatches' }, ...COLORS.map((c) => h('button', { type: 'button', class: cx('swatch', `c-${c.value}`, state.color === c.value && 'on'), attrs: { 'aria-label': c.label, 'aria-pressed': state.color === c.value }, on: { click: () => { state.color = c.value; drawMisc(); } } })))),
      );
    };
    drawTimes();
    drawRep();
    drawMisc();

    const read = (): EventInput => {
      const r = state.repeat.type === 'interval' ? { type: 'interval' as const, every: Number(every.value) || 0 } : state.repeat;
      return { title: title.value, date: day.value, start: state.allDay ? undefined : start.value || undefined, end: state.allDay ? undefined : end.value || undefined, location: loc.value, note: note.value, repeat: r, until: r.type !== 'none' ? until.value || undefined : undefined, remind: state.remind, task: state.task, color: state.color };
    };
    return h('form', { class: 'form', on: { submit: async (e) => {
      e.preventDefault();
      const data = read();
      const err = validateEvent(data);
      if (err) { errBox.textContent = err; return; }
      const ok = existing ? await ctx.run(() => C.updateEvent(st, existing.id, data), 'Evento aggiornato', true) : await ctx.run(() => C.addEvent(st, data), state.task ? 'Promemoria creato' : 'Evento creato', true);
      if (ok) { haptic(12); close(); }
    } } },
      field('Titolo', title),
      field('Data', day),
      times,
      field('Ripetizione', rep),
      misc,
      field('Luogo', loc),
      field('Note', note),
      errBox,
      h('div', { class: 'row-end sticky-actions' },
        existing ? button('Elimina', async () => {
          if (existing.repeat.type !== 'none') {
            close();
            ctx.sheet('Eliminare l\'evento?', (c2) => h('div', { class: 'stack' },
              h('p', { class: 'muted' }, `"${existing.title}" si ripete. Cosa vuoi eliminare?`),
              h('div', { class: 'row-end' },
                button(`Solo ${shortLabel(date)}`, () => void ctx.run(() => C.deleteEvent(st, existing.id, date), 'Occorrenza eliminata', true).then(() => c2())),
                button('Tutte', () => void ctx.run(() => C.deleteEvent(st, existing.id), 'Evento eliminato', true).then(() => c2()), { variant: 'danger' }),
              ),
            ));
          } else if (await ctx.confirm('Eliminare l\'evento?', 'Potrai annullare subito dopo.', 'Elimina', true)) {
            if (await ctx.run(() => C.deleteEvent(st, existing.id), 'Evento eliminato', true)) close();
          }
        }, { variant: 'quiet', icon: 'trash' }) : null,
        button('Annulla', close),
        button(existing ? 'Salva' : 'Crea', () => undefined, { variant: 'primary', type: 'submit' }),
      ),
    );
  });
}

