import type { Ctx, ViewResult } from '../app.js';
import { cx, fmtNumber, h, svgEl } from '../dom.js';
import { icon } from '../icons.js';
import { button, empty, field, input, ratingPicker, section, sectionWithAction, segmented, textarea } from '../components.js';
import { burstFrom, celebrate, confetti, haptic } from '../fx.js';
import * as A from '../../data/actions.js';
import * as SA from '../../data/sportActions.js';
import { checkWeekGoal, habitCalendar } from '../activity.js';
import { settingsBlock, statTiles, trendBars } from './activities.js';
import { addDays, diffDays, formatMinutes, fromKey, isoWeekday, longLabel, monthName, relativeLabel, shortLabel, weekStart, weekdayShort, type DateKey } from '../../domain/dates.js';
import { dayStatus, indexLogs, isScheduledDay, logId, ruleFor, weekProgress } from '../../domain/habits.js';
import { H } from '../../domain/defaults.js';
const BASKET_HABIT_ID = H.basket;
const HABIT_IDS = H;
import { basketWeekId, gamesIn, knownExercises, newRecords, pctOf, points, previousWeekStart, seasonOf, setCount, summarize, validateGame, volume, type GameInput } from '../../domain/sport.js';
import type { BasketGame, GymExercise, GymPlanDay, GymSession, PlanExercise } from '../../domain/types.js';
import { parseNum } from '../parse.js';

/**
 * Animazioni: un solo momento per azione.
 * - Basket: il pallone entra nel canestro quando segni la presenza.
 * - Palestra: un disco si aggiunge al bilanciere per ogni sessione; a 3 il bilanciere si alza.
 * Vengono "consumate" al primo ridisegno dopo l'azione, così non si ripetono a ogni modifica.
 */
const fx: { swish?: DateKey; plate?: number; rings?: string; ringsAt?: number } = {};

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}

function avg(v: number | null, digits = 1): string {
  return v === null ? '—' : fmtNumber(v, digits);
}

// ═══ BASKET ═════════════════════════════════════════════════════════════════

const COURT_SVG = `<svg viewBox="0 0 320 190" class="court-svg" aria-hidden="true">
  <rect x="6" y="6" width="308" height="178" rx="6" class="ln"/>
  <path d="M40 6 V64 A120 120 0 0 0 280 64 V6" class="ln"/>
  <rect x="118" y="6" width="84" height="86" class="ln paint"/>
  <path d="M118 92 A42 42 0 0 0 202 92" class="ln"/>
  <path d="M118 92 A42 42 0 0 1 202 92" class="ln dash"/>
  <path d="M130 184 A30 30 0 0 1 190 184" class="ln"/>
  <line x1="138" y1="16" x2="182" y2="16" class="board"/>
  <circle cx="160" cy="28" r="9" class="rim"/>
</svg>`;

function courtHero(ctx: Ctx): HTMLElement {
  const st = ctx.store;
  const today = ctx.today;
  const hb = st.get('habits', BASKET_HABIT_ID);
  if (!hb) return h('div');
  const logs = indexLogs(st.all('habitLogs'), hb.id);
  const rest = st.settings().restDates;
  const ws = weekStart(today);
  const rule = ruleFor(hb, today);
  const planned = rule?.schedule.type === 'days' ? rule.schedule.days : [];
  // Giorni previsti dalla regola attuale (anche prima dell'inizio, mostrati come non attivi) più eventuali extra.
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(ws, i)).filter((d) => planned.includes(isoWeekday(d)) || isScheduledDay(hb, d, rest) || logs.get(d));
  const todayLog = logs.get(today);
  const scheduledToday = isScheduledDay(hb, today, rest);
  const swish = fx.swish === today;
  if (swish) fx.swish = undefined;
  const scored = !!todayLog && !todayLog.skipped;
  const wp = weekProgress(hb, logs, today, rest);
  const extras = days.filter((d) => !isScheduledDay(hb, d, rest) && logs.get(d) && !logs.get(d)!.skipped).length;

  const court = h('div', { class: cx('court', swish && 'swish', scored && 'scored') },
    svgEl(COURT_SVG),
    h('span', { class: 'rim-anchor' }),
    h('div', { class: 'net' }, svgEl('<svg viewBox="0 0 24 18" aria-hidden="true"><path d="M2 1 L6 17 M8 1 L9 17 M16 1 L15 17 M22 1 L18 17 M3 6 L21 6 M4.5 11.5 L19.5 11.5 M6 17 L18 17"/></svg>')),
    h('div', { class: 'ball-x' }, h('div', { class: 'ball-y' }, h('span', { class: 'ball' }))),
  );

  const dayChips = days.map((d) => {
    const s = dayStatus(hb, d, logs.get(d), today, rest);
    const label = s === 'done' ? `Presente${logs.get(d)?.rating ? ` · ${logs.get(d)!.rating}/10` : ''}` : s === 'skipped' ? 'Assente' : s === 'future' ? 'In programma' : s === 'missing' ? 'Da registrare' : s === 'n/a' ? 'Non attivo' : 'Extra';
    return h('button', { type: 'button', class: cx('bday', `s-${s.replace('/', '')}`, d === today && 'now', swish && d === today && 'pop'), disabled: d > today, attrs: { 'aria-label': `${longLabel(d)}: ${label}` }, on: { click: () => openDay(ctx, d) } },
      h('span', { class: 'bday-wd' }, weekdayShort(isoWeekday(d))),
      h('span', { class: 'bday-mark' }, s === 'done' ? icon('check', 16) : s === 'skipped' ? icon('x', 14) : null),
      h('span', { class: 'bday-label' }, label),
    );
  });

  let action: HTMLElement;
  if (todayLog) {
    action = h('div', { class: 'row' },
      h('span', { class: todayLog.skipped ? 'muted' : 'ok-text' }, todayLog.skipped ? `Assente oggi${todayLog.note ? `: ${todayLog.note}` : ''}` : 'Presenza registrata'),
      !todayLog.skipped ? button('Voto e note', () => openTraining(ctx, today), { small: true, variant: 'quiet', icon: 'edit' }) : null,
      button('Annulla', () => void ctx.run(() => A.clearHabitLog(st, hb.id, today), 'Registrazione rimossa', true), { small: true, variant: 'quiet', icon: 'undo' }),
    );
  } else {
    action = h('div', { class: 'row' },
      button(scheduledToday ? 'Presente all\'allenamento' : 'Allenamento extra oggi', (e) => { fx.swish = today; haptic([10, 40, 20]); const el = e.currentTarget as Element; void ctx.run(() => A.markHabitDone(st, hb.id, today), 'Allenamento registrato', true).then((ok) => { if (ok) setTimeout(() => { burstFrom(document.querySelector('.court .rim-anchor') ?? el, { count: 26 }); checkWeekGoal(ctx, hb); }, 820); }); }, { variant: 'primary', icon: 'basketball' }),
      scheduledToday ? button('Assente', () => openAbsence(ctx, today), { variant: 'quiet' }) : null,
    );
  }

  return h('section', { class: 'sport-hero court-hero' },
    h('div', { class: 'sport-hero-text' },
      h('p', { class: 'eyebrow-line' }, scheduledToday ? 'Oggi si gioca' : 'Lunedì · mercoledì · venerdì'),
      h('h2', { class: 'sport-hero-title' }, `${wp.done} di ${wp.target || planned.length} allenamenti`),
      h('p', { class: 'muted small' }, extras ? `questa settimana · +${extras} ${extras === 1 ? 'extra' : 'extra'}` : 'questa settimana'),
      action,
    ),
    court,
    h('div', { class: 'bdays' }, ...dayChips),
  );
}

function shootRing(label: string, v: number | null, made: number, att: number, animate: boolean): HTMLElement {
  const C = 2 * Math.PI * 30;
  const off = v === null ? C : C * (1 - v);
  return h('div', { class: cx('sring', animate && 'grow', v === null && 'empty'), style: `--c:${C.toFixed(1)};--off:${off.toFixed(1)}` },
    svgEl(`<svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="30" class="sring-bg"/><circle cx="36" cy="36" r="30" class="sring-fg" transform="rotate(-90 36 36)"/></svg>`),
    h('div', { class: 'sring-text' }, h('strong', null, pct(v)), h('span', null, label)),
    h('span', { class: 'sring-sub' }, att ? `${made}/${att}` : 'nessun tiro'),
  );
}

const statsUi: { range: 'month' | 'season' | 'all' } = { range: 'season' };

function gameStats(ctx: Ctx): HTMLElement {
  const today = ctx.today;
  const all = ctx.store.all('basketGames').filter((g) => !g.deletedAt && !g.scheduled);
  const season = seasonOf(today);
  const range = statsUi.range;
  const games = range === 'month' ? gamesIn(all, `${today.slice(0, 7)}-01`, today) : range === 'season' ? gamesIn(all, season.from, season.to) : gamesIn(all, '0000-01-01', '9999-12-31');
  const s = summarize(games);
  const t = games.reduce((a, g) => ({ m2: a.m2 + g.fg2m, a2: a.a2 + g.fg2a, m3: a.m3 + g.fg3m, a3: a.a3 + g.fg3a, mf: a.mf + g.ftm, af: a.af + g.fta }), { m2: 0, a2: 0, m3: 0, a3: 0, mf: 0, af: 0 });
  const sig = `${range}:${games.length}:${t.m2}/${t.a2}:${t.m3}/${t.a3}:${t.mf}/${t.af}`;
  const animate = fx.rings !== sig || Date.now() - (fx.ringsAt ?? 0) > 60_000;
  fx.rings = sig;
  fx.ringsAt = Date.now();
  const label = range === 'month' ? monthName(today) : range === 'season' ? `stagione ${season.label}` : 'tutte le partite';

  return sectionWithAction('Partite', button('Nuova partita', () => openGame(ctx, null), { small: true, icon: 'plus', variant: 'primary' }),
    segmented<typeof range>([{ value: 'month', label: 'Mese' }, { value: 'season', label: `Stagione ${season.label}` }, { value: 'all', label: 'Tutte' }], range, (v) => { statsUi.range = v; ctx.go('/basket'); }, 'Periodo'),
    games.length === 0
      ? empty('Nessuna partita registrata', `Registra la prima partita: punti e percentuali si calcolano da soli. Periodo: ${label}.`)
      : h('div', { class: 'stack' },
          h('div', { class: 'rings' }, shootRing('da 2', s.fg2, t.m2, t.a2, animate), shootRing('da 3', s.fg3, t.m3, t.a3, animate), shootRing('liberi', s.ft, t.mf, t.af, animate)),
          h('div', { class: 'box-avg' },
            ...([['Punti', s.ppg], ['Rimbalzi', s.rpg], ['Assist', s.apg], ['Palle perse', s.tpg], ['Minuti', s.mpg]] as const).map(([k, v]) => h('div', null, h('strong', null, avg(v)), h('span', null, k))),
          ),
          h('p', { class: 'muted small' }, `Medie per partita · ${games.length} ${games.length === 1 ? 'partita' : 'partite'} · ${label}${s.rating !== null ? ` · voto medio ${avg(s.rating)}` : ''}. Le percentuali sono calcolate sul totale dei tiri.`),
          h('ul', { class: 'game-list' }, ...games.slice(0, 40).map((g) => gameRow(ctx, g))),
        ),
  );
}

function gameRow(ctx: Ctx, g: BasketGame): HTMLElement {
  const fg = pctOf(g.fg2m + g.fg3m, g.fg2a + g.fg3a);
  return h('li', null,
    h('button', { type: 'button', class: 'game-row', on: { click: () => openGame(ctx, g) } },
      h('span', { class: 'game-pts' }, h('strong', null, String(points(g))), h('small', null, 'pt')),
      h('span', { class: 'game-main' },
        h('span', { class: 'game-opp' }, `vs ${g.opponent}`),
        h('span', { class: 'muted small' }, `${relativeLabel(g.date, ctx.today)} · ${g.minutes}' · ${g.reb} rimb · ${g.ast} ass · dal campo ${pct(fg)}`),
      ),
      g.rating ? h('span', { class: 'game-rate' }, `${g.rating}`) : null,
    ),
  );
}

function focusCard(ctx: Ctx): HTMLElement {
  const st = ctx.store;
  const today = ctx.today;
  const cur = st.get('basketWeeks', basketWeekId(today));
  const prevStart = previousWeekStart(today);
  const prev = st.get('basketWeeks', `bw:${prevStart}`);
  const needsReview = !prev?.review;
  return h('section', { class: 'focus-card' },
    h('div', { class: 'row-between' }, h('h2', { class: 'section-title' }, 'Focus tecnico della settimana'), button(cur?.focus ? 'Cambia' : 'Imposta', () => openFocus(ctx), { small: true, variant: 'quiet', icon: 'edit' })),
    h('p', { class: cx('focus-text', !cur?.focus && 'unset') }, cur?.focus ?? 'Nessun focus per questa settimana.'),
    needsReview
      ? h('button', { type: 'button', class: 'review-nudge', on: { click: () => openFocus(ctx) } }, icon('star', 16), h('span', null, `Valuta la settimana dal ${shortLabel(prevStart)} prima di aggiornare il focus`), icon('right', 16))
      : h('p', { class: 'muted small' }, `Settimana precedente: ${prev!.review}/10${prev!.focus ? ` · focus "${prev!.focus}"` : ''}`),
  );
}

function trainingHistory(ctx: Ctx): HTMLElement {
  const st = ctx.store;
  const hb = st.get('habits', BASKET_HABIT_ID);
  const logs = st.all('habitLogs').filter((l) => l.habitId === BASKET_HABIT_ID).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  const rated = logs.filter((l) => !l.skipped && l.rating);
  const avgRating = rated.length ? rated.reduce((s, l) => s + (l.rating ?? 0), 0) / rated.length : null;
  return section('Allenamenti',
    logs.length
      ? h('ul', { class: 'log-list' }, ...logs.map((l) => h('li', null,
          h('span', { class: 'log-date' }, relativeLabel(l.date, ctx.today)),
          h('span', { class: 'log-val' }, l.skipped ? 'Assente' : `Presente${l.rating ? ` · ${l.rating}/10` : ''}`),
          l.note ? h('span', { class: 'log-note' }, l.note) : null,
          !l.skipped ? button('', () => openTraining(ctx, l.date), { small: true, variant: 'quiet', icon: 'edit', title: 'Voto e note' }) : null,
        )))
      : h('p', { class: 'muted' }, 'Nessun allenamento registrato.'),
    avgRating !== null ? h('p', { class: 'muted small' }, `Voto medio degli ultimi allenamenti: ${avg(avgRating)}`) : null,
    hb ? h('a', { href: `#/attivita/${hb.id}`, class: 'link small' }, 'Calendario, serie e giorni dell\'allenamento') : null,
  );
}

function upcomingGames(ctx: Ctx): HTMLElement {
  const st = ctx.store;
  const list = st.all('basketGames').filter((g) => !g.deletedAt && g.scheduled).sort((a, b) => a.date.localeCompare(b.date));
  const future = list.filter((g) => g.date >= ctx.today);
  const pending = list.filter((g) => g.date < ctx.today);
  return sectionWithAction('Partite in programma', button('Programma', () => openScheduleGame(ctx, null), { small: true, icon: 'plus' }),
    pending.length ? h('div', { class: 'stack-sm' }, ...pending.map((g) => h('button', { type: 'button', class: 'pending-game tap', on: { click: () => openGame(ctx, g) } },
      icon('basketball', 18), h('span', null, h('strong', null, `vs ${g.opponent}`), ` · ${relativeLabel(g.date, ctx.today)}`), h('span', { class: 'chip-mini' }, 'Inserisci statistiche')))) : null,
    future.length
      ? h('ul', { class: 'upcoming' }, ...future.map((g, i) => h('li', { style: `--i:${i}` },
          h('button', { type: 'button', class: 'up-card tap', on: { click: () => openScheduleGame(ctx, g) } },
            h('span', { class: 'up-date' }, h('strong', null, String(fromKey(g.date).getDate())), h('span', null, monthName(g.date).slice(0, 3))),
            h('span', { class: 'up-body' }, h('strong', null, `vs ${g.opponent}`), h('span', { class: 'muted small' }, [relativeLabel(g.date, ctx.today), g.time, g.place].filter(Boolean).join(' · '))),
            h('span', { class: 'up-count' }, g.date === ctx.today ? 'oggi' : `${diffDays(ctx.today, g.date)} gg`),
          ))))
      : h('p', { class: 'muted' }, 'Nessuna partita in programma. Aggiungila: comparirà nel calendario.'),
  );
}

export function basketView(ctx: Ctx): ViewResult {
  const st = ctx.store;
  const hb = st.get('habits', BASKET_HABIT_ID);
  const games = st.all('basketGames').filter((g) => !g.deletedAt);
  const mark = (d: DateKey): HTMLElement | null => {
    const g = games.find((x) => x.date === d);
    return g ? h('span', { class: cx('hc-game', g.scheduled && 'sched'), title: `Partita vs ${g.opponent}` }, icon('basketball', 11)) : null;
  };
  return {
    title: 'Basket',
    node: h('div', { class: 'page sport-page' },
      h('a', { href: '#/attivita', class: 'back' }, icon('left', 16), 'Attività'),
      h('h1', { class: 'page-title sport-title' }, 'Basket'),
      courtHero(ctx),
      hb ? statTiles(ctx, hb) : null,
      hb ? h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Calendario allenamenti e partite'), habitCalendar(ctx, hb, { mark, onDay: (d) => {
        const g = games.find((x) => x.date === d);
        if (g && (g.scheduled ? true : d <= ctx.today) && d > ctx.today) return openScheduleGame(ctx, g);
        if (d > ctx.today) return openScheduleGame(ctx, null, d);
        openDay(ctx, d);
      } })) : null,
      upcomingGames(ctx),
      focusCard(ctx),
      gameStats(ctx),
      hb ? h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Presenze ultime 12 settimane'), trendBars(ctx, hb, ctx.entering)) : null,
      trainingHistory(ctx),
      hb ? settingsBlock(ctx, hb) : null,
    ),
  };
}

function openScheduleGame(ctx: Ctx, existing: BasketGame | null, date?: DateKey): void {
  ctx.sheet(existing ? `vs ${existing.opponent}` : 'Programma partita', (close) => {
    const day = input({ id: 'sg-date', type: 'date', value: existing?.date ?? date ?? ctx.today });
    const opp = input({ id: 'sg-opp', value: existing?.opponent ?? '', placeholder: 'Squadra avversaria', attrs: { maxlength: 60, autofocus: !existing } });
    const time = input({ id: 'sg-time', type: 'time', value: existing?.time ?? '' });
    const place = input({ id: 'sg-place', value: existing?.place ?? '', placeholder: 'Palestra / città', attrs: { maxlength: 80 } });
    return h('form', { class: 'form', on: { submit: async (e) => {
      e.preventDefault();
      if (await ctx.run(() => SA.scheduleGame(ctx.store, { date: day.value, opponent: opp.value, time: time.value, place: place.value }, existing?.id), existing ? 'Partita aggiornata' : 'Partita in programma', true)) { haptic(12); close(); }
    } } },
      h('div', { class: 'grid2' }, field('Avversario', opp), field('Data', day)),
      h('div', { class: 'grid2' }, field('Ora', time, 'Facoltativa'), field('Dove', place, 'Facoltativo')),
      h('div', { class: 'row-end sticky-actions' },
        existing ? button('Elimina', async () => { if (await ctx.run(() => SA.deleteGame(ctx.store, existing.id), 'Partita eliminata', true)) close(); }, { variant: 'quiet', icon: 'trash' }) : null,
        existing && existing.date <= ctx.today ? button('Inserisci statistiche', () => { close(); openGame(ctx, existing); }) : null,
        button('Salva', () => undefined, { variant: 'primary', type: 'submit' }),
      ),
    );
  });
}

// ─── Fogli basket ────────────────────────────────────────────────────────────

/** Registrazione di un giorno della settimana (anche passato): presente, assente, voto. */
function openDay(ctx: Ctx, date: DateKey): void {
  const st = ctx.store;
  const log = st.get('habitLogs', logId(BASKET_HABIT_ID, date));
  if (log && !log.skipped) return openTraining(ctx, date);
  ctx.sheet(`Allenamento · ${longLabel(date)}`, (close) =>
    h('div', { class: 'stack' },
      log?.skipped ? h('p', { class: 'muted' }, `Registrato come assente${log.note ? `: ${log.note}` : ''}.`) : h('p', { class: 'muted' }, 'Com\'è andata?'),
      h('div', { class: 'row' },
        button('Presente', () => { close(); if (date === ctx.today) fx.swish = date; void ctx.run(() => A.markHabitDone(st, BASKET_HABIT_ID, date), 'Allenamento registrato', true).then((ok) => ok && openTraining(ctx, date)); }, { variant: 'primary', icon: 'basketball' }),
        !log ? button('Assente', () => { close(); openAbsence(ctx, date); }) : button('Togli assenza', () => { close(); void ctx.run(() => A.clearHabitLog(st, BASKET_HABIT_ID, date), 'Registrazione rimossa', true); }, { variant: 'quiet', icon: 'undo' }),
      ),
    ),
  );
}

function openTraining(ctx: Ctx, date: DateKey): void {
  const log = ctx.store.get('habitLogs', logId(BASKET_HABIT_ID, date));
  const state = { rating: log?.rating };
  ctx.sheet('Allenamento', (close) => {
    const pick = h('div');
    const draw = (): void => { pick.replaceChildren(ratingPicker(state.rating, (v) => { state.rating = state.rating === v ? undefined : v; draw(); }, 'Voto allenamento')); };
    draw();
    const note = textarea({ id: 'tr-note', value: log?.note ?? '', rows: 3, placeholder: 'Cosa hai lavorato, cosa è andato bene' });
    return h('form', { class: 'form', on: { submit: async (e) => { e.preventDefault(); if (await ctx.run(() => A.markHabitDone(ctx.store, BASKET_HABIT_ID, date, { rating: state.rating, note: note.value }), 'Allenamento aggiornato', true)) close(); } } },
      h('p', { class: 'muted' }, longLabel(date)),
      field('Voto', pick, 'Da 1 a 10, facoltativo'),
      field('Note', note),
      h('div', { class: 'row-end' }, button('Indietro', close), button('Salva', () => undefined, { variant: 'primary', type: 'submit' })),
    );
  });
}

function openAbsence(ctx: Ctx, date: DateKey): void {
  ctx.sheet('Assente all\'allenamento', (close) => {
    const reason = input({ id: 'ab-reason', placeholder: 'es. lavoro, infortunio, malattia', attrs: { maxlength: 120, autofocus: true } });
    return h('form', { class: 'form', on: { submit: async (e) => { e.preventDefault(); if (await ctx.run(() => A.skipHabit(ctx.store, BASKET_HABIT_ID, date, reason.value), 'Assenza registrata', true)) close(); } } },
      h('p', { class: 'muted' }, 'L\'assenza resta nello storico e non interrompe la serie come una dimenticanza: è un giorno gestito.'),
      field('Motivo', reason, 'Facoltativo'),
      h('div', { class: 'row-end' }, button('Indietro', close), button('Registra assenza', () => undefined, { variant: 'primary', type: 'submit' })),
    );
  });
}

function openFocus(ctx: Ctx): void {
  const st = ctx.store;
  const today = ctx.today;
  const prevStart = previousWeekStart(today);
  const prev = st.get('basketWeeks', `bw:${prevStart}`);
  const cur = st.get('basketWeeks', basketWeekId(today));
  const state = { review: prev?.review };
  ctx.sheet('Settimana di basket', (close) => {
    const pick = h('div');
    const draw = (): void => { pick.replaceChildren(ratingPicker(state.review, (v) => { state.review = v; draw(); }, 'Voto settimana precedente')); };
    draw();
    const rnote = input({ id: 'fw-rnote', value: prev?.reviewNote ?? '', placeholder: 'Cosa è migliorato, cosa no', attrs: { maxlength: 200 } });
    const focus = input({ id: 'fw-focus', value: cur?.focus ?? '', placeholder: 'es. tiro dalla media, difesa sul pick and roll', attrs: { maxlength: 200 } });
    return h('form', { class: 'form', on: { submit: async (e) => {
      e.preventDefault();
      const ok = await ctx.run(async () => {
        if (state.review !== undefined && (state.review !== prev?.review || rnote.value.trim() !== (prev?.reviewNote ?? ''))) await SA.reviewBasketWeek(st, prevStart, state.review, rnote.value);
        if (focus.value.trim() !== (cur?.focus ?? '')) await SA.setBasketFocus(st, today, focus.value);
      }, 'Settimana aggiornata');
      if (ok) close();
    } } },
      h('h3', { class: 'sub-title' }, `1 · Com'è andata la settimana dal ${shortLabel(prevStart)}?`),
      field('Voto', pick, prev?.focus ? `Focus era: "${prev.focus}"` : 'Da 1 a 10'),
      field('Nota', rnote, 'Facoltativa'),
      h('h3', { class: 'sub-title' }, '2 · Focus di questa settimana'),
      field('Focus tecnico', focus),
      h('div', { class: 'row-end' }, button('Indietro', close), button('Salva', () => undefined, { variant: 'primary', type: 'submit' })),
    );
  });
}

function numInput(id: string, value: number | undefined, label: string): HTMLInputElement {
  return input({ id, value: value !== undefined ? String(value) : '', attrs: { inputmode: 'numeric', 'aria-label': label }, placeholder: '0' });
}

function openGame(ctx: Ctx, existing: BasketGame | null): void {
  const st = ctx.store;
  const state = { rating: existing?.rating };
  ctx.sheet(existing ? `vs ${existing.opponent}` : 'Nuova partita', (close) => {
    const date = input({ id: 'gm-date', type: 'date', value: existing?.date ?? ctx.today, attrs: { max: ctx.today } });
    const opp = input({ id: 'gm-opp', value: existing?.opponent ?? '', placeholder: 'Squadra avversaria', attrs: { maxlength: 60, autofocus: !existing } });
    const opps = [...new Set(st.all('basketGames').filter((g) => !g.deletedAt).map((g) => g.opponent))];
    opp.setAttribute('list', 'gm-opps');
    const n: Record<string, HTMLInputElement> = {};
    const mk = (k: keyof GameInput, label: string): HTMLInputElement => (n[k] = numInput(`gm-${k}`, existing ? (existing[k] as number) : undefined, label));
    const shotRow = (label: string, m: keyof GameInput, a: keyof GameInput): HTMLElement =>
      h('div', { class: 'shot-row' }, h('span', { class: 'shot-label' }, label), mk(m, `${label} segnati`), h('span', { class: 'shot-sep' }, 'su'), mk(a, `${label} tentati`), h('span', { class: 'shot-pct', id: `gm-p-${String(m)}` }));
    const errBox = h('p', { class: 'form-error', attrs: { role: 'alert' } });
    const live = h('p', { class: 'live-pts' });
    const read = (): GameInput => {
      const v = (k: string): number => { const x = parseNum(n[k].value); return x === undefined ? 0 : x; };
      return {
        date: date.value, opponent: opp.value, minutes: v('minutes'), fg2m: v('fg2m'), fg2a: v('fg2a'), fg3m: v('fg3m'), fg3a: v('fg3a'), ftm: v('ftm'), fta: v('fta'),
        reb: v('reb'), ast: v('ast'), tov: v('tov'), rating: state.rating, note: note.value,
      };
    };
    const note = textarea({ id: 'gm-note', value: existing?.note ?? '', rows: 2 });
    const pick = h('div');
    const drawPick = (): void => { pick.replaceChildren(ratingPicker(state.rating, (v) => { state.rating = state.rating === v ? undefined : v; drawPick(); }, 'Voto partita')); };
    drawPick();
    const update = (): void => {
      const g = read();
      live.textContent = `${points(g)} punti`;
      for (const [m, a] of [['fg2m', 'fg2a'], ['fg3m', 'fg3a'], ['ftm', 'fta']] as const) {
        const el = document.getElementById(`gm-p-${m}`);
        if (el) {
          el.textContent = g[m] > g[a] ? 'controlla' : pct(pctOf(g[m], g[a]));
          el.classList.toggle('bad', g[m] > g[a]);
        }
      }
    };
    const form = h('form', { class: 'form', on: { input: update, submit: async (e) => {
      e.preventDefault();
      const g = read();
      const err = validateGame(g, ctx.today);
      if (err) { errBox.textContent = err; return; }
      if (await ctx.run(() => SA.saveGame(st, g, existing?.id), existing && !existing.scheduled ? 'Partita aggiornata' : `Partita registrata: ${points(g)} punti`, true)) {
        close();
        if (!existing || existing.scheduled) { haptic([15, 40, 15]); if (points(g) >= 20) celebrate(`${points(g)} punti`, `vs ${g.opponent}`); else confetti(1400); }
      }
    } } },
      h('div', { class: 'grid2' }, field('Avversario', opp), field('Data', date)),
      h('datalist', { id: 'gm-opps' }, ...opps.map((o) => h('option', { value: o }))),
      field('Minuti giocati', mk('minutes', 'Minuti')),
      h('div', { class: 'shots' }, h('div', { class: 'row-between' }, h('h3', { class: 'sub-title' }, 'Tiri'), live), shotRow('Da 2', 'fg2m', 'fg2a'), shotRow('Da 3', 'fg3m', 'fg3a'), shotRow('Liberi', 'ftm', 'fta')),
      h('div', { class: 'grid3' }, field('Rimbalzi', mk('reb', 'Rimbalzi')), field('Assist', mk('ast', 'Assist')), field('Palle perse', mk('tov', 'Palle perse'))),
      field('Voto personale', pick, 'Facoltativo'),
      field('Note', note),
      errBox,
      h('div', { class: 'row-end sticky-actions' },
        existing ? button('Elimina', async () => { if (await ctx.confirm('Eliminare la partita?', 'Le medie verranno ricalcolate. Puoi annullare subito dopo.', 'Elimina', true)) { if (await ctx.run(() => SA.deleteGame(st, existing.id), 'Partita eliminata', true)) close(); } }, { variant: 'quiet', icon: 'trash' }) : null,
        button('Annulla', close),
        button(existing ? 'Salva' : 'Registra partita', () => undefined, { variant: 'primary', type: 'submit' }),
      ),
    );
    requestAnimationFrame(update);
    return form;
  });
}

// ═══ PALESTRA ═══════════════════════════════════════════════════════════════

const PLATE_W = 11;
const STEP = 13;
const MAX_PLATES = 4;
const leftX = (i: number): number => 60 - (i + 1) * STEP + 2;
const rightX = (i: number): number => 260 + i * STEP;

function barbell(count: number, target: number, newIdx: number | undefined, lifted: boolean): HTMLElement {
  // Dischi grandi fino all'obiettivo, più piccoli per le sessioni extra; oltre 4 compare "+n".
  let plates = '';
  for (let i = 0; i < Math.min(count, MAX_PLATES); i++) {
    const big = i < target;
    const hgt = big ? 74 : 46;
    const cls = `plate${big ? '' : ' extra'}${i === newIdx ? ' new' : ''}`;
    plates += `<g class="${cls}"><rect x="${leftX(i)}" y="${60 - hgt / 2}" width="${PLATE_W}" height="${hgt}" rx="3" class="pl pl-l"/><rect x="${rightX(i)}" y="${60 - hgt / 2}" width="${PLATE_W}" height="${hgt}" rx="3" class="pl pl-r"/></g>`;
  }
  let ghosts = '';
  for (let i = count; i < Math.min(target, MAX_PLATES); i++) ghosts += `<rect x="${leftX(i)}" y="23" width="${PLATE_W}" height="74" rx="3" class="ghost"/><rect x="${rightX(i)}" y="23" width="${PLATE_W}" height="74" rx="3" class="ghost"/>`;
  const more = count > MAX_PLATES ? `<text x="160" y="40" text-anchor="middle" class="more">+${count - MAX_PLATES}</text>` : '';
  return h('div', { class: cx('barbell', lifted && 'lift') }, svgEl(`<svg viewBox="0 0 320 120" aria-hidden="true">
    <g class="bar-group">
      <rect x="4" y="57" width="312" height="6" rx="3" class="bar"/>
      <rect x="60" y="49" width="6" height="22" rx="2" class="collar"/>
      <rect x="254" y="49" width="6" height="22" rx="2" class="collar"/>
      <path d="M118 57 v6 M126 57 v6 M134 57 v6 M186 57 v6 M194 57 v6 M202 57 v6" class="knurl"/>
      ${ghosts}${plates}${more}
    </g>
    <line x1="10" y1="114" x2="310" y2="114" class="floor"/>
  </svg>`));
}

function gymHero(ctx: Ctx): HTMLElement {
  const st = ctx.store;
  const today = ctx.today;
  const hb = st.get('habits', HABIT_IDS.gym);
  if (!hb) return h('div');
  const logs = indexLogs(st.all('habitLogs'), hb.id);
  const wp = weekProgress(hb, logs, today, st.settings().restDates);
  const target = wp.target || 3;
  const ws = weekStart(today);
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(ws, i));
  const newIdx = fx.plate;
  fx.plate = undefined;
  const justMet = newIdx !== undefined && wp.done === target;
  const doneToday = logs.get(today) && !logs.get(today)!.skipped;
  return h('section', { class: cx('sport-hero gym-hero', wp.met && 'met') },
    h('div', { class: 'sport-hero-text' },
      h('p', { class: 'eyebrow-line' }, wp.met ? 'Obiettivo settimanale raggiunto' : `Obiettivo: almeno ${target} volte a settimana`),
      h('h2', { class: 'sport-hero-title' }, `${wp.done} di ${target} sessioni`),
      h('p', { class: 'muted small' }, wp.met ? (wp.done > target ? `${wp.done - target} in più dell'obiettivo` : 'Settimana chiusa: ogni sessione in più è un extra.') : `Ne ${target - wp.done === 1 ? 'manca' : 'mancano'} ${target - wp.done} entro domenica`),
      h('div', { class: 'row' },
        button(doneToday ? 'Dettagli di oggi' : 'Registra sessione di oggi', () => openGymSession(ctx, today), { variant: doneToday ? 'ghost' : 'primary', icon: doneToday ? 'edit' : 'dumbbell' }),
        !doneToday ? button('Solo presenza', (e) => { fx.plate = wp.done; haptic(15); burstFrom(e.currentTarget as Element); void ctx.run(() => A.markHabitDone(st, hb.id, today), 'Palestra registrata', true).then((ok) => ok && checkWeekGoal(ctx, hb)); }, { variant: 'quiet', title: 'Registra la presenza senza esercizi' }) : null,
      ),
    ),
    barbell(wp.done, target, newIdx, justMet),
    h('div', { class: 'gdays' }, ...days.map((d) => {
      const l = logs.get(d);
      const on = l && !l.skipped;
      return h('button', { type: 'button', class: cx('gday', on && 'on', d === today && 'now', d > today && 'future'), disabled: d > today, attrs: { 'aria-label': `${longLabel(d)}${on ? ', sessione registrata' : ''}` }, on: { click: () => openGymSession(ctx, d) } },
        h('span', null, weekdayShort(isoWeekday(d)).slice(0, 1)), h('i', null));
    })),
  );
}

function sessionCard(ctx: Ctx, s: GymSession, all: GymSession[]): HTMLElement {
  const recs = newRecords(s, all);
  const vol = volume(s);
  return h('details', { class: 'gym-card' },
    h('summary', null,
      h('span', { class: 'gym-date' }, relativeLabel(s.date, ctx.today)),
      h('span', { class: 'gym-title' }, s.workout ?? 'Sessione'),
      h('span', { class: 'muted small' }, [s.duration ? formatMinutes(s.duration) : '', s.exercises.length ? `${s.exercises.length} esercizi · ${setCount(s)} serie` : 'senza esercizi', vol ? `${fmtNumber(vol)} kg di volume` : ''].filter(Boolean).join(' · ')),
      recs.length ? h('span', { class: 'rec-badge' }, icon('trophy', 13), recs.length === 1 ? 'Record' : `${recs.length} record`) : null,
    ),
    h('div', { class: 'gym-body' },
      s.exercises.length ? h('ul', { class: 'ex-list' }, ...s.exercises.map((e) => h('li', null,
        h('strong', null, e.name, recs.includes(e.name) ? h('span', { class: 'rec-dot', title: 'Nuovo record' }, icon('trophy', 12)) : null),
        h('span', { class: 'ex-sets' }, e.sets.map((x) => `${x.reps}${x.kg !== undefined ? `×${fmtNumber(x.kg, x.kg % 1 ? 1 : 0)}kg` : ''}`).join('  ·  ')),
      ))) : h('p', { class: 'muted small' }, 'Solo presenza registrata.'),
      s.note ? h('p', { class: 'muted small pre' }, s.note) : null,
      h('div', { class: 'row-end' }, button('Modifica', () => openGymSession(ctx, s.date), { small: true, icon: 'edit' })),
    ),
  );
}

function lastSetsOf(all: GymSession[], name: string, before: DateKey): { reps: number; kg?: number }[] {
  const key = name.trim().toLowerCase();
  const s = [...all].filter((x) => x.date < before).sort((a, b) => b.date.localeCompare(a.date)).find((x) => x.exercises.some((e) => e.name.trim().toLowerCase() === key));
  return s?.exercises.find((e) => e.name.trim().toLowerCase() === key)?.sets ?? [];
}

/** Andamento del carico massimo di un esercizio nelle ultime sessioni. */
function loadChart(sessions: GymSession[], name: string, animate: boolean): HTMLElement {
  const key = name.toLowerCase();
  const pts = sessions.filter((s) => s.exercises.some((e) => e.name.trim().toLowerCase() === key))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(-12)
    .map((s) => ({ date: s.date, kg: Math.max(...s.exercises.filter((e) => e.name.trim().toLowerCase() === key).flatMap((e) => e.sets.map((x) => x.kg ?? 0))) }))
    .filter((p) => p.kg > 0);
  if (pts.length < 2) return h('p', { class: 'muted small' }, pts.length ? `${fmtNumber(pts[0].kg, pts[0].kg % 1 ? 1 : 0)} kg il ${shortLabel(pts[0].date)}. Il grafico compare dalla seconda sessione.` : 'Nessun carico registrato.');
  const max = Math.max(...pts.map((p) => p.kg));
  const min = Math.min(...pts.map((p) => p.kg));
  const span = max - min || 1;
  const W = 300;
  const Hh = 90;
  const xy = pts.map((p, i) => [8 + (i * (W - 16)) / (pts.length - 1), 10 + (Hh - 24) * (1 - (p.kg - min) / span)] as const);
  const path = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${path} L${xy.at(-1)![0]},${Hh} L${xy[0][0]},${Hh} Z`;
  const last = xy.at(-1)!;
  const diff = pts.at(-1)!.kg - pts[0].kg;
  return h('div', { class: cx('load-chart', animate && 'grow') },
    svgEl(`<svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="lg-${key.replace(/[^a-z]/g, '')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="la-s1"/><stop offset="1" class="la-s2"/></linearGradient></defs><path d="${area}" class="la-area" fill="url(#lg-${key.replace(/[^a-z]/g, '')})"/><path d="${path}" class="la-line" pathLength="1"/><circle cx="${last[0]}" cy="${last[1]}" r="4" class="la-dot"/></svg>`),
    h('div', { class: 'row-between' },
      h('span', { class: 'muted small' }, `${shortLabel(pts[0].date)} → ${shortLabel(pts.at(-1)!.date)}`),
      h('strong', { class: diff > 0 ? 'ok-text' : 'muted' }, `${fmtNumber(pts.at(-1)!.kg, pts.at(-1)!.kg % 1 ? 1 : 0)} kg${diff ? ` (${diff > 0 ? '+' : ''}${fmtNumber(diff, diff % 1 ? 1 : 0)})` : ''}`),
    ),
  );
}

const gymUi: { ex?: string } = {};

export function gymView(ctx: Ctx): ViewResult {
  const st = ctx.store;
  const hb = st.get('habits', HABIT_IDS.gym);
  const sessions = st.all('gymSessions').sort((a, b) => b.date.localeCompare(a.date));
  const logs = st.all('habitLogs').filter((l) => l.habitId === HABIT_IDS.gym && !l.skipped && !st.get('gymSessions', `gym:${l.date}`));
  const merged: GymSession[] = [...sessions, ...logs.map((l) => ({ id: `gym:${l.date}`, date: l.date, workout: l.note, duration: l.duration, rating: l.rating, exercises: [], updatedAt: l.updatedAt }))].sort((a, b) => b.date.localeCompare(a.date));
  const plan = SA.activePlan(st);
  const names = knownExercises(sessions);
  const planNames = plan ? plan.days.flatMap((d) => d.exercises.map((e) => e.name)) : [];
  const allNames = [...new Set([...planNames, ...names])];
  const sel = gymUi.ex && allNames.includes(gymUi.ex) ? gymUi.ex : allNames[0];
  return {
    title: 'Palestra',
    node: h('div', { class: 'page sport-page' },
      h('a', { href: '#/attivita', class: 'back' }, icon('left', 16), 'Attività'),
      h('h1', { class: 'page-title sport-title' }, 'Palestra'),
      gymHero(ctx),
      hb ? statTiles(ctx, hb) : null,
      hb ? h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Calendario'), habitCalendar(ctx, hb, { onDay: (d) => openGymSession(ctx, d) })) : null,
      planSection(ctx),
      section('Carichi',
        allNames.length
          ? h('div', { class: 'stack-sm' },
              h('div', { class: 'ex-tabs' }, ...allNames.slice(0, 16).map((n) => h('button', { type: 'button', class: cx('ex-tab', n === sel && 'on'), on: { click: () => { gymUi.ex = n; ctx.go('/palestra'); } } }, n))),
              sel ? loadChart(sessions, sel, true) : null,
            )
          : h('p', { class: 'muted' }, 'Registra una sessione con i carichi: qui vedrai come salgono, esercizio per esercizio.'),
      ),
      section('Sessioni',
        merged.length ? h('div', { class: 'stack-sm' }, ...merged.slice(0, 30).map((s) => sessionCard(ctx, s, sessions))) : empty('Nessuna sessione', 'Tocca "Registra sessione di oggi": dalla scheda si caricano gli esercizi con gli ultimi pesi.'),
      ),
      hb ? h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Ultime 12 settimane'), trendBars(ctx, hb, ctx.entering)) : null,
      hb ? settingsBlock(ctx, hb) : null,
    ),
  };
}

function planSection(ctx: Ctx): HTMLElement {
  const plan = SA.activePlan(ctx.store);
  return sectionWithAction('La mia scheda', button(plan ? 'Modifica' : 'Scrivi la scheda', () => openPlanEditor(ctx), { small: true, icon: 'edit', variant: plan ? 'ghost' : 'primary' }),
    plan
      ? h('div', { class: 'plan-days' }, ...plan.days.map((d, i) => h('div', { class: 'plan-day', style: `--i:${i}` },
          h('strong', null, d.name),
          h('ul', null, ...d.exercises.map((e) => h('li', null, h('span', null, e.name), h('span', { class: 'muted' }, `${e.sets}×${e.reps}${e.rest ? ` · ${e.rest}` : ''}`)))),
        )))
      : h('p', { class: 'muted' }, 'Scrivi qui la tua scheda: giorni, esercizi, serie e ripetizioni. Quando registri una sessione, gli esercizi si caricano da soli con gli ultimi pesi.'),
  );
}

function openPlanEditor(ctx: Ctx): void {
  const cur = SA.activePlan(ctx.store);
  const state: { days: GymPlanDay[] } = { days: cur ? structuredClone(cur.days) : [{ id: '', name: 'Giorno A', exercises: [{ name: '', sets: 3, reps: '10' }] }] };
  ctx.sheet(cur ? 'Modifica scheda' : 'La mia scheda', (close) => {
    const name = input({ id: 'pl-name', value: cur?.name ?? 'La mia scheda', attrs: { maxlength: 60 } });
    const box = h('div', { class: 'stack' });
    const draw = (focus?: string): void => {
      box.replaceChildren(...state.days.map((d, i) => h('div', { class: 'ex-block' },
        h('div', { class: 'ex-head' },
          input({ id: `pd-${i}`, value: d.name, placeholder: 'es. Giorno A · Petto e tricipiti', attrs: { maxlength: 60, 'aria-label': `Nome giorno ${i + 1}` }, on: { input: (e) => { d.name = (e.target as HTMLInputElement).value; } } }),
          button('', () => { state.days.splice(i, 1); draw(); }, { small: true, variant: 'quiet', icon: 'trash', title: 'Togli giorno' }),
        ),
        h('div', { class: 'plan-grid' },
          h('span', { class: 'set-hd' }, 'Esercizio'), h('span', { class: 'set-hd' }, 'Serie'), h('span', { class: 'set-hd' }, 'Rip.'), h('span'),
          ...d.exercises.flatMap((e: PlanExercise, j) => [
            input({ id: `pe-${i}-${j}`, value: e.name, placeholder: 'Esercizio', attrs: { maxlength: 60, 'aria-label': 'Esercizio' }, on: { input: (ev) => { e.name = (ev.target as HTMLInputElement).value; } } }),
            input({ id: `ps-${i}-${j}`, value: String(e.sets), attrs: { inputmode: 'numeric', 'aria-label': 'Serie' }, on: { input: (ev) => { e.sets = Number((ev.target as HTMLInputElement).value) || 0; } } }),
            input({ id: `pr-${i}-${j}`, value: e.reps, attrs: { maxlength: 12, 'aria-label': 'Ripetizioni' }, on: { input: (ev) => { e.reps = (ev.target as HTMLInputElement).value; } } }),
            button('', () => { d.exercises.splice(j, 1); draw(); }, { small: true, variant: 'quiet', icon: 'x', title: 'Togli esercizio' }),
          ]),
        ),
        button('Aggiungi esercizio', () => { d.exercises.push({ name: '', sets: 3, reps: '10' }); draw(`pe-${i}-${d.exercises.length - 1}`); }, { small: true, variant: 'quiet', icon: 'plus' }),
      )), button('Aggiungi giorno', () => { state.days.push({ id: '', name: `Giorno ${String.fromCharCode(65 + state.days.length)}`, exercises: [{ name: '', sets: 3, reps: '10' }] }); draw(`pd-${state.days.length - 1}`); }, { small: true, icon: 'plus' }));
      if (focus) requestAnimationFrame(() => document.getElementById(focus)?.focus());
    };
    draw();
    return h('form', { class: 'form', on: { submit: async (e) => {
      e.preventDefault();
      if (await ctx.run(() => SA.savePlan(ctx.store, name.value, state.days.map((d) => ({ ...d, exercises: d.exercises.filter((x) => x.name.trim()) }))), 'Scheda salvata', true)) { haptic([10, 30, 10]); close(); }
    } } },
      field('Nome della scheda', name),
      h('p', { class: 'field-hint' }, 'Ripetizioni libere: "10", "8-10", "max". I carichi si registrano nelle sessioni, non qui.'),
      box,
      h('div', { class: 'row-end sticky-actions' }, button('Annulla', close), button('Salva scheda', () => undefined, { variant: 'primary', type: 'submit' })),
    );
  }, { wide: true });
}

// ─── Foglio sessione palestra ────────────────────────────────────────────────

function openGymSession(ctx: Ctx, date: DateKey): void {
  const st = ctx.store;
  const existing = st.get('gymSessions', `gym:${date}`);
  const log = st.get('habitLogs', logId(HABIT_IDS.gym, date));
  const all = st.all('gymSessions');
  const known = knownExercises(all);
  const plan = SA.activePlan(st);
  const state: { exercises: GymExercise[]; rating?: number; planDayId?: string } = {
    exercises: existing ? structuredClone(existing.exercises) : [],
    rating: existing?.rating ?? log?.rating,
    planDayId: existing?.planDayId,
  };
  const wpBefore = (() => {
    const hb = st.get('habits', HABIT_IDS.gym)!;
    return weekProgress(hb, indexLogs(st.all('habitLogs'), hb.id), ctx.today, st.settings().restDates).done;
  })();
  ctx.sheet(date === ctx.today ? 'Sessione di oggi' : `Sessione · ${shortLabel(date)}`, (close) => {
    const workout = input({ id: 'gs-workout', value: existing?.workout ?? log?.note ?? '', placeholder: 'es. Petto e tricipiti', attrs: { maxlength: 60 } });
    const dur = input({ id: 'gs-dur', value: existing?.duration ? String(existing.duration) : log?.duration ? String(log.duration) : '', attrs: { inputmode: 'numeric' }, placeholder: 'minuti' });
    const note = textarea({ id: 'gs-note', value: existing?.note ?? '', rows: 2 });
    const pick = h('div');
    const drawPick = (): void => { pick.replaceChildren(ratingPicker(state.rating, (v) => { state.rating = state.rating === v ? undefined : v; drawPick(); }, 'Voto sessione')); };
    drawPick();
    const exBox = h('div', { class: 'ex-builder' });
    const drawEx = (focusId?: string): void => {
      exBox.replaceChildren(
        ...state.exercises.map((e, i) => h('div', { class: 'ex-block' },
          h('div', { class: 'ex-head' },
            input({ id: `ex-${i}-name`, value: e.name, placeholder: 'Esercizio', attrs: { list: 'gs-known', 'aria-label': `Esercizio ${i + 1}`, maxlength: 60 }, on: { input: (ev) => { e.name = (ev.target as HTMLInputElement).value; } } }),
            button('', () => { state.exercises.splice(i, 1); drawEx(); }, { small: true, variant: 'quiet', icon: 'trash', title: 'Togli esercizio' }),
          ),
          h('div', { class: 'set-grid' },
            h('span', { class: 'set-hd' }, 'Serie'), h('span', { class: 'set-hd' }, 'Rip.'), h('span', { class: 'set-hd' }, 'Kg'), h('span'),
            ...e.sets.flatMap((s, j) => [
              h('span', { class: 'set-n' }, String(j + 1)),
              input({ id: `ex-${i}-${j}-r`, value: String(s.reps), attrs: { inputmode: 'numeric', 'aria-label': `Ripetizioni serie ${j + 1}` }, on: { input: (ev) => { s.reps = Number((ev.target as HTMLInputElement).value) || 0; } } }),
              input({ id: `ex-${i}-${j}-k`, value: s.kg !== undefined ? String(s.kg).replace('.', ',') : '', placeholder: '—', attrs: { inputmode: 'decimal', 'aria-label': `Kg serie ${j + 1}` }, on: { input: (ev) => { const x = parseNum((ev.target as HTMLInputElement).value); s.kg = x === undefined || Number.isNaN(x) ? undefined : x; } } }),
              button('', () => { e.sets.splice(j, 1); drawEx(); }, { small: true, variant: 'quiet', icon: 'x', title: `Togli serie ${j + 1}` }),
            ]),
          ),
          button('Aggiungi serie', () => { const last = e.sets.at(-1); e.sets.push(last ? { ...last } : { reps: 10 }); drawEx(`ex-${i}-${e.sets.length - 1}-r`); }, { small: true, variant: 'quiet', icon: 'plus' }),
        )),
        h('div', { class: 'row' },
          button('Aggiungi esercizio', () => { state.exercises.push({ name: '', sets: [{ reps: 10 }] }); drawEx(`ex-${state.exercises.length - 1}-name`); }, { small: true, icon: 'plus' }),
          all.length && !state.exercises.length ? button('Ripeti l\'ultima sessione', () => {
            const w = workout.value.trim().toLowerCase();
            const src = [...all].filter((s) => s.date !== date && s.exercises.length).sort((a, b) => b.date.localeCompare(a.date)).find((s) => !w || (s.workout ?? '').toLowerCase() === w) ?? [...all].filter((s) => s.date !== date && s.exercises.length).sort((a, b) => b.date.localeCompare(a.date))[0];
            if (!src) return ctx.toast('Nessuna sessione precedente con esercizi.', { error: true });
            state.exercises = structuredClone(src.exercises);
            if (!workout.value && src.workout) workout.value = src.workout;
            drawEx();
            ctx.toast(`Copiata la sessione del ${shortLabel(src.date)}: aggiorna i carichi`);
          }, { small: true, variant: 'quiet', icon: 'undo' }) : null,
        ),
      );
      if (focusId) requestAnimationFrame(() => document.getElementById(focusId)?.focus());
    };
    drawEx();
    const fromPlan = (day: GymPlanDay): void => {
      state.planDayId = day.id;
      state.exercises = day.exercises.map((pe) => {
        const last = lastSetsOf(all, pe.name, date);
        const reps = Number(pe.reps.split(/[^0-9]/)[0]) || 10;
        return { name: pe.name, sets: Array.from({ length: pe.sets }, (_, k) => ({ reps: last[k]?.reps ?? reps, kg: last[k]?.kg ?? last.at(-1)?.kg })) };
      });
      if (!workout.value) workout.value = day.name;
      drawEx();
      ctx.toast('Esercizi della scheda caricati con gli ultimi carichi');
    };
    const planPick = plan && plan.days.length
      ? h('div', { class: 'plan-pick' }, h('span', { class: 'muted small' }, 'Dalla tua scheda:'), ...plan.days.map((pd) => button(pd.name, () => fromPlan(pd), { small: true, cls: state.planDayId === pd.id ? 'on' : '' })))
      : null;
    const errBox = h('p', { class: 'form-error', attrs: { role: 'alert' } });
    return h('form', { class: 'form', on: { submit: async (e) => {
      e.preventDefault();
      const d = parseNum(dur.value);
      if (d !== undefined && (Number.isNaN(d) || !Number.isInteger(d))) { errBox.textContent = 'Durata in minuti interi.'; return; }
      const exercises = state.exercises.filter((x) => x.name.trim() || x.sets.some((s) => s.kg !== undefined));
      if (!log) fx.plate = wpBefore;
      let saved: GymSession | undefined;
      const ok = await ctx.run(async () => { saved = await SA.saveGymSession(st, date, { workout: workout.value, planDayId: state.planDayId, duration: d, rating: state.rating, exercises, note: note.value }); });
      if (!ok) { fx.plate = undefined; return; }
      close();
      const recs = saved ? newRecords(saved, st.all('gymSessions')) : [];
      ctx.toast(recs.length ? `Nuovo record: ${recs.join(', ')}` : 'Sessione salvata', { undo: true });
      if (recs.length) celebrate('Nuovo record', recs.join(' · '));
      else if (!log) { const hb = st.get('habits', HABIT_IDS.gym); if (hb) checkWeekGoal(ctx, hb); }
    } } },
      h('p', { class: 'muted' }, longLabel(date)),
      h('div', { class: 'grid2' }, field('Allenamento', workout, 'Facoltativo'), field('Durata', dur, 'Minuti, facoltativa')),
      h('h3', { class: 'sub-title' }, 'Esercizi'),
      planPick,
      h('p', { class: 'field-hint' }, 'Facoltativi. Kg vuoto = corpo libero.'),
      exBox,
      h('datalist', { id: 'gs-known' }, ...known.map((k) => h('option', { value: k }))),
      field('Voto', pick, 'Facoltativo'),
      field('Note', note),
      errBox,
      h('div', { class: 'row-end sticky-actions' },
        existing || log ? button('Elimina', async () => { if (await ctx.confirm('Eliminare la sessione?', 'Si toglie anche la presenza di quel giorno. Puoi annullare subito dopo.', 'Elimina', true)) { if (await ctx.run(() => SA.deleteGymSession(st, date), 'Sessione eliminata', true)) close(); } }, { variant: 'quiet', icon: 'trash' }) : null,
        button('Annulla', close),
        button('Salva sessione', () => undefined, { variant: 'primary', type: 'submit' }),
      ),
    );
  }, { wide: true });
}

