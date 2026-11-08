/**
 * Elementi condivisi delle attività: stato del giorno, spunta con animazione,
 * calendario mensile dell'attività (illuminato se fatto, in negativo se mancato) e foglio del giorno.
 */
import type { Ctx } from './app.js';
import { cx, h } from './dom.js';
import { icon } from './icons.js';
import { button, checkCircle, field, input, ratingPicker, textarea } from './components.js';
import { burstFrom, celebrate, haptic, isFresh, markFresh, pulse } from './fx.js';
import * as A from '../data/actions.js';
import { addDays, formatMinutes, toKey, fromKey, isoWeekday, longLabel, monthName, relativeLabel, weekStart, weekdayShort, type DateKey } from '../domain/dates.js';
import { dayStatus, indexLogs, isScheduledDay, logId, logMeetsDay, ruleFor, weekProgress, type DayStatus } from '../domain/habits.js';
import { monthGrid, occurrencesOn, shiftMonth } from '../domain/calendar.js';
import type { Habit } from '../domain/types.js';

/** Stato visivo: "missed" = previsto, passato e non fatto (si colora in negativo). */
export type Look = 'done' | 'partial' | 'missed' | 'skipped' | 'today' | 'planned' | 'free' | 'off' | 'future';

export function look(ctx: Ctx, h0: Habit, d: DateKey): Look {
  const st = ctx.store;
  const log = st.get('habitLogs', logId(h0.id, d));
  const s: DayStatus = dayStatus(h0, d, log, ctx.today, st.settings().restDates);
  if (s === 'done') return 'done';
  if (s === 'partial') return d < ctx.today ? 'partial' : 'partial';
  if (s === 'skipped') return 'skipped';
  if (s === 'missing') return d < ctx.today ? 'missed' : 'today';
  if (s === 'future') return isScheduledDay(h0, d, st.settings().restDates) ? 'planned' : 'future';
  if (s === 'optional') return 'free';
  return 'off';
}

export function activeHabits(ctx: Ctx): Habit[] {
  return ctx.store.all('habits').filter((x) => !x.archivedAt).sort((a, b) => a.order - b.order);
}

export function habitHref(hb: Habit): string {
  return hb.page === 'basket' ? '#/basket' : hb.page === 'palestra' ? '#/palestra' : hb.page === 'dichiarazioni' ? '#/dichiarazioni' : `#/attivita/${hb.id}`;
}

/** Attività da fare oggi: previste oggi o settimanali non ancora completate. */
export interface DueItem {
  habit: Habit;
  done: boolean;
  skipped: boolean;
  value: number;
  weekly: boolean;
  weekDone: number;
  weekTarget: number;
}

export function dueToday(ctx: Ctx): DueItem[] {
  const st = ctx.store;
  const today = ctx.today;
  const rest = st.settings().restDates;
  const out: DueItem[] = [];
  for (const hb of activeHabits(ctx)) {
    const rule = ruleFor(hb, today);
    if (!rule) continue;
    const logs = indexLogs(st.all('habitLogs'), hb.id);
    const log = logs.get(today);
    const weekly = rule.schedule.type === 'weekly';
    const wp = weekProgress(hb, logs, today, rest);
    const scheduled = isScheduledDay(hb, today, rest);
    const doneToday = logMeetsDay(hb, log, today);
    if (!scheduled && !(weekly && (!wp.met || doneToday)) && !log) continue;
    out.push({ habit: hb, done: doneToday, skipped: !!log?.skipped, value: log && !log.skipped ? log.value : 0, weekly, weekDone: wp.done, weekTarget: wp.target });
  }
  return out.sort((a, b) => (a.habit.reminder ?? '99').localeCompare(b.habit.reminder ?? '99') || a.habit.order - b.habit.order);
}

/** Quante cose restano oggi (attività "obbligatorie" oggi + promemoria del calendario). */
export function remainingToday(ctx: Ctx): { total: number; done: number } {
  const items = dueToday(ctx).filter((i) => !i.weekly || i.done);
  const tasks = occurrencesOn(ctx.store.all('calEvents'), ctx.today).filter((o) => o.event.task);
  return { total: items.length + tasks.length, done: items.filter((i) => i.done || i.skipped).length + tasks.filter((t) => t.done).length };
}

/** Dopo un completamento: se era l'ultima cosa della giornata, festa. */
export function checkDayComplete(ctx: Ctx, before: { total: number; done: number }): void {
  const after = remainingToday(ctx);
  if (after.total > 0 && after.done === after.total && before.done < before.total) {
    setTimeout(() => celebrate('Giornata completa', 'Hai chiuso tutto quello che avevi in programma oggi.'), 350);
  }
}

/** Spunta di un'attività "fatto/non fatto" con animazione. */
export async function toggleCheck(ctx: Ctx, hb: Habit, date: DateKey, el?: Element): Promise<void> {
  const st = ctx.store;
  const log = st.get('habitLogs', logId(hb.id, date));
  const before = remainingToday(ctx);
  if (log && !log.skipped) {
    haptic(8);
    await ctx.run(() => A.clearHabitLog(st, hb.id, date), `${hb.name}: spunta tolta`, true);
    return;
  }
  haptic(15);
  if (el) {
    burstFrom(el);
    pulse(el);
  }
  markFresh(`${hb.id}:${date}`);
  const ok = await ctx.run(() => A.markHabitDone(st, hb.id, date), `${hb.name} ✓`, true);
  if (ok && date === ctx.today) {
    checkWeekGoal(ctx, hb);
    checkDayComplete(ctx, before);
  }
}

/** Obiettivo settimanale appena raggiunto (es. palestra 3/3): celebrazione. */
export function checkWeekGoal(ctx: Ctx, hb: Habit): void {
  const rule = ruleFor(hb, ctx.today);
  if (rule?.schedule.type !== 'weekly') return;
  const wp = weekProgress(hb, indexLogs(ctx.store.all('habitLogs'), hb.id), ctx.today, ctx.store.settings().restDates);
  if (wp.done === wp.target) setTimeout(() => celebrate(`${hb.name}: obiettivo raggiunto`, `${wp.done} su ${wp.target} questa settimana.`), 300);
}

export async function addMinutes(ctx: Ctx, hb: Habit, date: DateKey, n: number, el?: Element): Promise<void> {
  const before = remainingToday(ctx);
  const target = ruleFor(hb, date)?.dailyTarget ?? 0;
  const prev = ctx.store.get('habitLogs', logId(hb.id, date));
  const was = prev && !prev.skipped ? prev.value : 0;
  haptic(10);
  const ok = await ctx.run(() => A.addHabitMinutes(ctx.store, hb.id, date, n), `${hb.name}: +${n}${hb.kind === 'minutes' ? ' min' : ''}`, true);
  if (ok && target && was < target && was + n >= target) {
    if (el) burstFrom(el);
    markFresh(`${hb.id}:${date}`);
    checkDayComplete(ctx, before);
  }
}

export function amount(hb: Habit, v: number): string {
  if (hb.kind === 'minutes') return formatMinutes(v);
  return `${v.toLocaleString('it-IT')}${hb.unit ? ` ${hb.unit}` : ''}`;
}

// ─── Calendario mensile di un'attività ───────────────────────────────────────

export interface MarkFn {
  (d: DateKey): HTMLElement | null;
}

const calMonth = new Map<string, DateKey>();

export function habitCalendar(ctx: Ctx, hb: Habit, opts: { mark?: MarkFn; onDay?: (d: DateKey) => void } = {}): HTMLElement {
  const month = calMonth.get(hb.id) ?? ctx.today;
  const grid = monthGrid(month);
  const mKey = month.slice(0, 7);
  const ws = weekStart(ctx.today);
  const move = (n: number): void => {
    calMonth.set(hb.id, shiftMonth(month, n));
    haptic(6);
    ctx.go(location.hash.slice(1));
  };
  let sx = 0;
  const box = h('div', { class: 'hcal', on: {
    touchstart: (e) => { sx = e.touches[0].clientX; },
    touchend: (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 60) move(dx < 0 ? 1 : -1); },
  } },
    h('div', { class: 'hcal-head' },
      h('button', { type: 'button', class: 'icon-btn', attrs: { 'aria-label': 'Mese precedente' }, on: { click: () => move(-1) } }, icon('left', 18)),
      h('strong', { class: 'hcal-title' }, `${monthName(month)} ${month.slice(0, 4)}`),
      h('button', { type: 'button', class: 'icon-btn', attrs: { 'aria-label': 'Mese successivo' }, on: { click: () => move(1) } }, icon('right', 18)),
    ),
    h('div', { class: 'hcal-grid', attrs: { role: 'grid' } },
      ...[1, 2, 3, 4, 5, 6, 7].map((d) => h('span', { class: 'hcal-wd' }, weekdayShort(d).slice(0, 1))),
      ...grid.map((d, i) => {
        const lk = look(ctx, hb, d);
        const out = d.slice(0, 7) !== mKey;
        const log = ctx.store.get('habitLogs', logId(hb.id, d));
        const fresh = isFresh(`${hb.id}:${d}`);
        const label = { done: 'fatto', partial: 'in parte', missed: 'non fatto', skipped: 'saltato', today: 'da fare oggi', planned: 'in programma', free: 'libero', off: 'non attivo', future: '' }[lk];
        return h('button', {
          type: 'button',
          class: cx('hc', `hc-${lk}`, out && 'out', d === ctx.today && 'is-today', d >= ws && d <= addDays(ws, 6) && 'this-week', fresh && 'fresh'),
          style: `--i:${i}`,
          disabled: d > ctx.today && !opts.mark?.(d),
          attrs: { 'aria-label': `${longLabel(d)}: ${label}` },
          on: { click: () => (opts.onDay ? opts.onDay(d) : openDay(ctx, hb, d)) },
        },
          h('span', { class: 'hc-n' }, String(fromKey(d).getDate())),
          hb.kind !== 'check' && log && !log.skipped && log.value ? h('span', { class: 'hc-v' }, String(log.value)) : null,
          log?.rating ? h('span', { class: 'hc-v' }, `★${log.rating}`) : null,
          opts.mark?.(d) ?? null,
        );
      }),
    ),
    h('div', { class: 'legend' },
      h('span', null, h('i', { class: 'lg lg-done' }), 'Fatto'),
      h('span', null, h('i', { class: 'lg lg-missed' }), 'Non fatto'),
      h('span', null, h('i', { class: 'lg lg-skipped' }), 'Saltato'),
      h('span', null, h('i', { class: 'lg lg-planned' }), 'In programma'),
    ),
  );
  return box;
}

/** Foglio di un giorno dell'attività: fatto, non fatto (con motivo), minuti, voto, note. */
export function openDay(ctx: Ctx, hb: Habit, d: DateKey): void {
  if (d > ctx.today) return;
  const st = ctx.store;
  ctx.sheet(`${hb.name} · ${relativeLabel(d, ctx.today)}`, (close) => {
    const log = st.get('habitLogs', logId(hb.id, d));
    const state = { rating: log?.rating };
    const note = textarea({ id: 'day-note', value: log?.note ?? '', rows: 2, placeholder: hb.notePrompt ?? 'Nota (facoltativa)' });
    const pick = h('div');
    const draw = (): void => { pick.replaceChildren(ratingPicker(state.rating, (v) => { state.rating = state.rating === v ? undefined : v; haptic(6); draw(); }, 'Voto')); };
    draw();
    const mins = input({ id: 'day-min', value: log && !log.skipped && hb.kind !== 'check' ? String(log.value) : '', attrs: { inputmode: 'numeric' }, placeholder: hb.kind === 'minutes' ? 'minuti' : 'quantità' });
    const target = ruleFor(hb, d)?.dailyTarget;
    const save = async (): Promise<void> => {
      if (hb.kind === 'check') {
        const ok = await ctx.run(() => A.markHabitDone(st, hb.id, d, { rating: state.rating, note: note.value }), `${hb.name} ✓`, true);
        if (ok) { markFresh(`${hb.id}:${d}`); close(); }
      } else {
        const n = Number(mins.value.replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) return ctx.toast('Inserisci un numero.', { error: true });
        if (await ctx.run(() => A.setHabitMinutes(st, hb.id, d, Math.round(n), note.value), n ? `${hb.name}: ${amount(hb, Math.round(n))}` : 'Registrazione rimossa', true)) { markFresh(`${hb.id}:${d}`); close(); }
      }
    };
    return h('form', { class: 'form', on: { submit: (e) => { e.preventDefault(); void save(); } } },
      h('p', { class: 'muted' }, longLabel(d), log?.skipped ? ` · saltato${log.note ? `: ${log.note}` : ''}` : ''),
      hb.kind !== 'check' ? field(hb.kind === 'minutes' ? 'Minuti' : `Quantità${hb.unit ? ` (${hb.unit})` : ''}`, mins, target ? `Obiettivo: ${amount(hb, target)}` : undefined) : null,
      hb.extras?.includes('rating') || hb.page ? field('Voto', pick, 'Facoltativo') : null,
      field('Nota', note),
      h('div', { class: 'row-end sticky-actions' },
        log ? button('Togli', () => void ctx.run(() => A.clearHabitLog(st, hb.id, d), 'Registrazione rimossa', true).then((ok) => ok && close()), { variant: 'quiet', icon: 'undo' }) : null,
        !log ? button('Non fatto', () => openSkip(ctx, hb, d, close), { variant: 'quiet', icon: 'x' }) : null,
        button(hb.kind === 'check' ? (log && !log.skipped ? 'Salva' : 'Fatto') : 'Salva', () => undefined, { variant: 'primary', type: 'submit', icon: 'check' }),
      ),
    );
  });
}

function openSkip(ctx: Ctx, hb: Habit, d: DateKey, closeParent: () => void): void {
  closeParent();
  ctx.sheet(`Non fatto · ${hb.name}`, (close) => {
    const reason = input({ id: 'skip-reason', placeholder: 'Motivo (facoltativo): lavoro, stanchezza, imprevisto…', attrs: { maxlength: 120, autofocus: true } });
    return h('form', { class: 'form', on: { submit: async (e) => { e.preventDefault(); haptic([10, 30, 10]); if (await ctx.run(() => A.skipHabit(ctx.store, hb.id, d, reason.value), 'Segnato come saltato', true)) close(); } } },
      h('p', { class: 'muted' }, 'Lo vedrai in grigio nel calendario: un giorno gestito, diverso da uno dimenticato (in rosso).'),
      field('Motivo', reason),
      h('div', { class: 'row-end' }, button('Indietro', close), button('Segna saltato', () => undefined, { variant: 'primary', type: 'submit' })),
    );
  });
}

/** Sette quadratini della settimana corrente (illuminati / in negativo). */
export function weekDots(ctx: Ctx, hb: Habit): HTMLElement {
  const ws = weekStart(ctx.today);
  return h('div', { class: 'wdots', attrs: { 'aria-hidden': 'true' } },
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = addDays(ws, i);
      return h('i', { class: cx(`hc-${look(ctx, hb, d)}`, d === ctx.today && 'is-today'), title: weekdayShort(isoWeekday(d)) });
    }),
  );
}

/** Casella di spunta di un'attività, con stato coerente al calendario. */
export function habitCheck(ctx: Ctx, hb: Habit, d: DateKey): HTMLElement {
  const lk = look(ctx, hb, d);
  const done = lk === 'done';
  const state = done ? 'done' : lk === 'missed' ? 'missed' : lk === 'skipped' ? 'skipped' : 'todo';
  return checkCircle(done, isFresh(`${hb.id}:${d}`), done ? `Togli spunta: ${hb.name}` : `Fatto: ${hb.name}`, (e) => void toggleCheck(ctx, hb, d, e.currentTarget as Element), state);
}

/** Primo giorno d'uso dell'app (creazione delle attività iniziali): prima di questo nulla è "mancato". */
export function installDay(ctx: Ctx): DateKey {
  let min = '';
  for (const h0 of ctx.store.all('habits')) if (!min || h0.createdAt < min) min = h0.createdAt;
  return min ? toKey(new Date(min)) : ctx.today;
}
