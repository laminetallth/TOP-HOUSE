import type { Ctx, ViewResult } from '../app.js';
import { cx, h } from '../dom.js';
import { icon } from '../icons.js';
import { button, field, input, ring, segmented } from '../components.js';
import { countUp, haptic } from '../fx.js';
import * as A from '../../data/actions.js';
import { activeHabits, habitCalendar, habitCheck, habitHref, look, weekDots } from '../activity.js';
import { addDays, monthEnd, monthStart, shortLabel, weekStart, weekdayShort, type DateKey } from '../../domain/dates.js';
import { indexLogs, periodStats, ruleFor, scheduleLabel, streak, totalDone, weekProgress } from '../../domain/habits.js';
import { AREA_LABEL } from '../../domain/defaults.js';
import type { Habit, HabitArea, HabitRule, Schedule } from '../../domain/types.js';

const AREA_ORDER: HabitArea[] = ['sport', 'nutrizione', 'mente', 'corpo', 'famiglia', 'casa', 'altro'];

function streakOf(ctx: Ctx, hb: Habit): { current: number; best: number; unit: string } {
  return streak(hb, indexLogs(ctx.store.all('habitLogs'), hb.id), ctx.today, ctx.store.settings().restDates);
}

// ─── Panoramica ──────────────────────────────────────────────────────────────

export function activitiesView(ctx: Ctx): ViewResult {
  const habits = activeHabits(ctx);
  const archived = ctx.store.all('habits').filter((x) => x.archivedAt);
  const todos = habits.filter((x) => x.todo);
  let idx = 0;
  const card = (hb: Habit): HTMLElement => {
    const sk = streakOf(ctx, hb);
    const wp = weekProgress(hb, indexLogs(ctx.store.all('habitLogs'), hb.id), ctx.today, ctx.store.settings().restDates);
    return h('a', { href: habitHref(hb), class: cx('act-card tap', `area-${hb.area}`, wp.met && 'met'), style: `--i:${idx++}` },
      h('div', { class: 'act-top' },
        h('span', { class: 'act-icon' }, icon(hb.icon, 22)),
        sk.current > 1 ? h('span', { class: 'flame' }, icon('flame', 14), String(sk.current)) : null,
      ),
      h('strong', { class: 'act-name' }, hb.name),
      h('span', { class: 'act-sched' }, scheduleLabel(ruleFor(hb, ctx.today))),
      weekDots(ctx, hb),
      h('span', { class: 'act-week' }, wp.target ? `${wp.done}/${wp.target} questa settimana` : ''),
    );
  };
  const groups = AREA_ORDER.map((a) => [a, habits.filter((x) => x.area === a)] as const).filter(([, l]) => l.length);
  return {
    title: 'Attività',
    node: h('div', { class: 'page page-wide' },
      h('div', { class: 'page-head' },
        h('h1', { class: 'page-title' }, 'Attività'),
        h('div', { class: 'row' },
          h('a', { href: '#/consigli', class: 'btn btn-ghost btn-sm' }, icon('bulb', 16), h('span', null, 'Consigli')),
          button('Nuova', () => openNewHabit(ctx), { small: true, icon: 'plus', variant: 'primary' }),
        ),
      ),
      todos.length ? h('div', { class: 'todo-note' }, icon('bell', 16), h('div', null, ...todos.map((t) => h('p', null, h('a', { href: habitHref(t), class: 'link' }, t.name), `: ${t.todo}`)))) : null,
      ...groups.map(([a, list]) => h('section', { class: 'section' }, h('h2', { class: 'section-title' }, AREA_LABEL[a]), h('div', { class: 'act-grid' }, ...list.map(card)))),
      archived.length ? h('details', { class: 'closed-group' }, h('summary', null, `Archiviate (${archived.length})`), h('div', { class: 'stack-sm' }, ...archived.map((x) => h('a', { href: `#/attivita/${x.id}`, class: 'link' }, x.name)))) : null,
    ),
  };
}

// ─── Dettaglio ───────────────────────────────────────────────────────────────

/** Andamento delle ultime 12 settimane: quota completata per settimana. */
export function trendBars(ctx: Ctx, hb: Habit, animate: boolean): HTMLElement {
  const logs = indexLogs(ctx.store.all('habitLogs'), hb.id);
  const rest = ctx.store.settings().restDates;
  const cur = weekStart(ctx.today);
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(cur, -7 * (11 - i)));
  return h('div', { class: cx('trend', animate && 'grow') },
    ...weeks.map((ws, i) => {
      const wp = weekProgress(hb, logs, ws, rest);
      const active = !!ruleFor(hb, addDays(ws, 6));
      const r = wp.target ? Math.min(1, wp.done / wp.target) : 0;
      return h('div', { class: 'tr-col', style: `--i:${i}`, title: `Settimana dal ${shortLabel(ws)}: ${wp.done}/${wp.target}` },
        h('div', { class: 'tr-track' }, active ? h('i', { class: cx(r >= 1 && 'full'), style: `height:${Math.max(4, r * 100)}%` }) : null),
        h('span', null, i % 3 === 2 || i === 11 ? shortLabel(ws).split(' ')[0] : ''),
      );
    }),
  );
}

export function statTiles(ctx: Ctx, hb: Habit): HTMLElement {
  const logs = indexLogs(ctx.store.all('habitLogs'), hb.id);
  const rest = ctx.store.settings().restDates;
  const sk = streakOf(ctx, hb);
  const mo = periodStats(hb, logs, monthStart(ctx.today), monthEnd(ctx.today), ctx.today, rest);
  const tot = totalDone(hb, logs);
  const tile = (v: number, label: string, suffix = ''): HTMLElement => {
    const n = h('strong', null, `${v}${suffix}`);
    if (ctx.entering) requestAnimationFrame(() => countUp(n, v, { suffix }));
    return h('div', { class: 'tile' }, n, h('span', null, label));
  };
  return h('div', { class: 'tiles' },
    tile(sk.current, `serie attuale (${sk.unit})`),
    tile(sk.best, 'serie migliore'),
    tile(mo.rate === null ? 0 : Math.round(mo.rate * 100), 'questo mese', '%'),
    tile(tot, 'volte in totale'),
  );
}

export function activityView(ctx: Ctx, params: Record<string, string>): ViewResult {
  const st = ctx.store;
  const hb = st.get('habits', params.id);
  if (!hb) return { title: 'Attività', node: h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, 'Attività non trovata.'), h('a', { href: '#/attivita', class: 'link' }, 'Torna alle attività')) };
  const logs = indexLogs(st.all('habitLogs'), hb.id);
  const wp = weekProgress(hb, logs, ctx.today, st.settings().restDates);
  const lk = look(ctx, hb, ctx.today);
  return {
    title: hb.name,
    node: h('div', { class: 'page' },
      h('a', { href: '#/attivita', class: 'back' }, icon('left', 16), 'Attività'),
      activityHero(ctx, hb, wp.target ? wp.done / wp.target : 0, `${wp.done}/${wp.target}`, lk),
      hb.todo ? h('div', { class: 'todo-note' }, icon('bell', 16), h('p', null, hb.todo), button('Imposta', () => openRuleEditor(ctx, hb), { small: true })) : null,
      statTiles(ctx, hb),
      h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Calendario'), habitCalendar(ctx, hb)),
      h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Ultime 12 settimane'), trendBars(ctx, hb, ctx.entering)),
      settingsBlock(ctx, hb),
    ),
  };
}

export function activityHero(ctx: Ctx, hb: Habit, ratio: number, label: string, lk: string, extra?: Node): HTMLElement {
  return h('header', { class: cx('act-hero', `area-${hb.area}`) },
    h('div', { class: 'act-hero-text' },
      h('span', { class: 'act-hero-icon' }, icon(hb.icon, 26)),
      h('h1', { class: 'page-title' }, hb.name),
      h('p', { class: 'muted' }, scheduleLabel(ruleFor(hb, ctx.today)), hb.reminder ? ` · promemoria alle ${hb.reminder}` : ''),
      h('div', { class: 'row' },
        hb.kind === 'check' && ruleFor(hb, ctx.today) ? h('div', { class: 'hero-check' }, habitCheck(ctx, hb, ctx.today), h('span', null, lk === 'done' ? 'Fatto oggi' : 'Segna oggi')) : null,
        extra ?? null,
      ),
    ),
    ring(ratio, { size: 116, stroke: 10, animate: ctx.entering, label: `Settimana ${label}`, children: [h('strong', { class: 'ring-num' }, label), h('span', { class: 'ring-sub' }, 'settimana')] }),
  );
}

export function settingsBlock(ctx: Ctx, hb: Habit): HTMLElement {
  const st = ctx.store;
  return h('details', { class: 'settings-block' },
    h('summary', null, icon('settings', 16), ' Impostazioni dell\'attività'),
    h('div', { class: 'actions-wrap' },
      button('Frequenza', () => openRuleEditor(ctx, hb), { small: true, icon: 'repeat' }),
      button(hb.reminder ? `Promemoria ${hb.reminder}` : 'Promemoria', () => openReminder(ctx, hb), { small: true, icon: 'bell' }),
      button('Rinomina', () => openRename(ctx, hb), { small: true, icon: 'edit' }),
      button('Pausa', () => openPause(ctx, hb), { small: true, icon: 'pause' }),
      hb.archivedAt
        ? button('Ripristina', () => void ctx.run(() => A.archiveHabit(st, hb.id, false), 'Attività ripristinata', true), { small: true })
        : button('Archivia', async () => { if (await ctx.confirm('Archiviare?', 'Non comparirà più ogni giorno. Lo storico resta e puoi ripristinarla.', 'Archivia')) void ctx.run(() => A.archiveHabit(st, hb.id, true), 'Attività archiviata', true); }, { small: true, variant: 'quiet' }),
      !hb.system ? button('Elimina', async () => { if (await ctx.confirm('Eliminare l\'attività?', 'Si cancellano anche tutte le registrazioni. Puoi annullare subito dopo.', 'Elimina', true)) { if (await ctx.run(() => A.deleteHabit(st, hb.id), 'Attività eliminata', true)) ctx.go('/attivita'); } }, { small: true, variant: 'quiet', icon: 'trash' }) : null,
    ),
    hb.pauses.length ? h('ul', { class: 'log-list' }, ...hb.pauses.map((p, i) => h('li', null, h('span', null, `Pausa ${shortLabel(p.from)} – ${shortLabel(p.to)}`), p.reason ? h('span', { class: 'log-note' }, p.reason) : null, button('', () => void ctx.run(() => A.removeHabitPause(st, hb.id, i), 'Pausa rimossa', true), { small: true, variant: 'quiet', icon: 'trash', title: 'Rimuovi pausa' })))) : null,
  );
}

// ─── Fogli ───────────────────────────────────────────────────────────────────

function scheduleEditor(initial: Schedule, today: DateKey, onChange: (s: Schedule) => void): HTMLElement {
  let cur: Schedule = initial;
  const box = h('div', { class: 'stack-sm' });
  const draw = (): void => {
    const type = segmented<Schedule['type']>([
      { value: 'daily', label: 'Ogni giorno' }, { value: 'days', label: 'Giorni fissi' }, { value: 'interval', label: 'Ogni N giorni' }, { value: 'weekly', label: 'N volte a settimana' },
    ], cur.type, (t) => {
      cur = t === 'daily' ? { type: 'daily' } : t === 'days' ? { type: 'days', days: [1, 3, 5] } : t === 'interval' ? { type: 'interval', every: 2, anchor: today } : { type: 'weekly', timesPerWeek: 3 };
      onChange(cur);
      draw();
    }, 'Frequenza');
    let extra: Node = document.createTextNode('');
    if (cur.type === 'days') {
      const days = cur.days;
      extra = h('div', { class: 'seg' }, ...[1, 2, 3, 4, 5, 6, 7].map((d) => h('button', { type: 'button', class: cx('seg-opt', days.includes(d) && 'on'), attrs: { 'aria-pressed': days.includes(d) }, on: { click: () => { cur = { type: 'days', days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort() }; onChange(cur); draw(); } } }, weekdayShort(d))));
    } else if (cur.type === 'weekly') {
      extra = segmented<number>([1, 2, 3, 4, 5, 6].map((v) => ({ value: v, label: String(v) })), cur.timesPerWeek, (v) => { cur = { type: 'weekly', timesPerWeek: v }; onChange(cur); draw(); }, 'Volte a settimana');
    } else if (cur.type === 'interval') {
      const c = cur;
      const anchor = input({ id: 'rule-anchor', type: 'date', value: c.anchor });
      anchor.addEventListener('change', () => { cur = { ...c, anchor: anchor.value || today }; onChange(cur); });
      extra = h('div', { class: 'stack-sm' },
        segmented<number>([2, 3, 4, 7].map((v) => ({ value: v, label: v === 2 ? 'Alterni' : `Ogni ${v}` })), c.every, (v) => { cur = { ...c, every: v }; onChange(cur); draw(); }, 'Ogni quanti giorni'),
        field('Primo giorno', anchor, 'Da qui si contano i giorni (es. il prossimo giorno delle medicine)'),
      );
    }
    box.replaceChildren(type, extra);
  };
  draw();
  return box;
}

function openRuleEditor(ctx: Ctx, hb: Habit): void {
  const r = ruleFor(hb, ctx.today) ?? hb.rules[hb.rules.length - 1];
  const state: { schedule: Schedule } = { schedule: structuredClone(r.schedule) };
  ctx.sheet('Frequenza', (close) => {
    const daily = input({ id: 'rule-daily', value: r.dailyTarget ? String(r.dailyTarget) : '', attrs: { inputmode: 'numeric' } });
    return h('form', { class: 'form', on: { submit: async (e) => {
      e.preventDefault();
      const rule: Omit<HabitRule, 'from'> = { schedule: state.schedule };
      if (hb.kind !== 'check') rule.dailyTarget = Number(daily.value) || undefined;
      if (state.schedule.type === 'interval' && state.schedule.anchor > ctx.today) {
        // la regola vale da oggi: la data di partenza futura sposta solo il conteggio
      }
      const ok = await ctx.run(() => A.updateHabitRule(ctx.store, hb.id, rule), 'Frequenza aggiornata', true);
      if (ok) {
        if (hb.todo) await A.setHabitTodoDone(ctx.store, hb.id);
        close();
      }
    } } },
      h('p', { class: 'muted' }, 'Vale da oggi. I giorni passati restano valutati con la regola di allora.'),
      field('Quando', scheduleEditor(state.schedule, ctx.today, (s) => { state.schedule = s; })),
      hb.kind !== 'check' ? field('Obiettivo giornaliero', daily, hb.kind === 'minutes' ? 'Minuti' : hb.unit) : null,
      h('div', { class: 'row-end' }, button('Indietro', close), button('Salva', () => undefined, { variant: 'primary', type: 'submit' })),
    );
  });
}

function openReminder(ctx: Ctx, hb: Habit): void {
  ctx.sheet('Promemoria', (close) => {
    const t = input({ id: 'rem-time', type: 'time', value: hb.reminder ?? '09:00' });
    return h('form', { class: 'form', on: { submit: async (e) => { e.preventDefault(); if (await ctx.run(() => A.setHabitReminder(ctx.store, hb.id, t.value), `Promemoria alle ${t.value}`, true)) close(); } } },
      h('p', { class: 'muted' }, 'L\'orario ordina la giornata in Oggi e fa partire la notifica (se attiva in Impostazioni).'),
      field('Orario', t),
      h('div', { class: 'row-end' },
        hb.reminder ? button('Togli', () => void ctx.run(() => A.setHabitReminder(ctx.store, hb.id, undefined), 'Promemoria tolto', true).then(close), { variant: 'quiet' }) : null,
        button('Salva', () => undefined, { variant: 'primary', type: 'submit' }),
      ),
    );
  });
}

function openRename(ctx: Ctx, hb: Habit): void {
  ctx.sheet('Rinomina', (close) => {
    const n = input({ id: 'hb-name', value: hb.name, attrs: { maxlength: 60, autofocus: true } });
    return h('form', { class: 'form', on: { submit: async (e) => { e.preventDefault(); if (await ctx.run(() => A.renameHabit(ctx.store, hb.id, n.value), 'Nome aggiornato', true)) close(); } } },
      field('Nome', n), h('div', { class: 'row-end' }, button('Indietro', close), button('Salva', () => undefined, { variant: 'primary', type: 'submit' })));
  });
}

function openPause(ctx: Ctx, hb: Habit): void {
  ctx.sheet('Pausa', (close) => {
    const from = input({ id: 'p-from', type: 'date', value: ctx.today });
    const to = input({ id: 'p-to', type: 'date', value: addDays(ctx.today, 6) });
    const reason = input({ id: 'p-reason', placeholder: 'es. vacanza, infortunio', attrs: { maxlength: 100 } });
    return h('form', { class: 'form', on: { submit: async (e) => { e.preventDefault(); if (await ctx.run(() => A.addHabitPause(ctx.store, hb.id, from.value, to.value, reason.value), 'Pausa programmata', true)) close(); } } },
      h('p', { class: 'muted' }, 'Durante la pausa i giorni non contano come mancati e la serie non si interrompe.'),
      h('div', { class: 'grid2' }, field('Dal', from), field('Al', to)), field('Motivo', reason, 'Facoltativo'),
      h('div', { class: 'row-end' }, button('Indietro', close), button('Programma', () => undefined, { variant: 'primary', type: 'submit' })));
  });
}

const ICONS = ['check', 'drop', 'heart', 'shirt', 'home', 'book', 'walk', 'moon', 'sun', 'food', 'flask', 'spark', 'star', 'lotus', 'dumbbell', 'basketball', 'wallet', 'note'];

export function openNewHabit(ctx: Ctx, preset: Partial<A.NewHabitInput> = {}): void {
  const state: { kind: 'check' | 'minutes'; schedule: Schedule; icon: string; area: HabitArea } = {
    kind: (preset.kind as 'check' | 'minutes') ?? 'check', schedule: preset.schedule ?? { type: 'daily' }, icon: preset.icon ?? 'check', area: preset.area ?? 'altro',
  };
  ctx.sheet('Nuova abitudine', (close) => {
    const name = input({ id: 'nh-name', value: preset.name ?? '', attrs: { maxlength: 60, autofocus: true }, placeholder: 'es. Bere 2 litri d\'acqua' });
    const target = input({ id: 'nh-target', attrs: { inputmode: 'numeric' }, placeholder: 'es. 20' });
    const time = input({ id: 'nh-time', type: 'time', value: preset.reminder ?? '' });
    const kindBox = h('div');
    const areaBox = h('div');
    const iconBox = h('div');
    const drawKind = (): void => { kindBox.replaceChildren(segmented<'check' | 'minutes'>([{ value: 'check', label: 'Fatto / non fatto' }, { value: 'minutes', label: 'A minuti' }], state.kind, (v) => { state.kind = v; drawKind(); }, 'Tipo'), state.kind === 'minutes' ? field('Minuti al giorno', target) : ''); };
    const drawArea = (): void => { areaBox.replaceChildren(segmented<HabitArea>(Object.entries(AREA_LABEL).map(([k, v]) => ({ value: k as HabitArea, label: v })), state.area, (v) => { state.area = v; drawArea(); }, 'Area')); };
    const drawIcon = (): void => { iconBox.replaceChildren(h('div', { class: 'icon-pick' }, ...ICONS.map((ic) => h('button', { type: 'button', class: cx('ip', state.icon === ic && 'on'), attrs: { 'aria-label': ic, 'aria-pressed': state.icon === ic }, on: { click: () => { state.icon = ic; drawIcon(); } } }, icon(ic, 20))))); };
    drawKind(); drawArea(); drawIcon();
    return h('form', { class: 'form', on: { submit: async (e) => {
      e.preventDefault();
      let created: { id: string } | undefined;
      const ok = await ctx.run(async () => { created = await A.addHabit(ctx.store, { name: name.value, kind: state.kind, schedule: state.schedule, dailyTarget: state.kind === 'minutes' ? Number(target.value) || undefined : undefined, icon: state.icon, area: state.area, reminder: time.value || undefined }); }, 'Abitudine creata', true);
      if (ok) { haptic([10, 30, 10]); close(); if (created) ctx.go(`/attivita/${created.id}`); }
    } } },
      field('Nome', name), field('Tipo', kindBox), field('Quando', scheduleEditor(state.schedule, ctx.today, (s) => { state.schedule = s; })),
      field('Promemoria', time, 'Facoltativo'), field('Area', areaBox), field('Icona', iconBox),
      h('div', { class: 'row-end sticky-actions' }, button('Annulla', close), button('Crea', () => undefined, { variant: 'primary', type: 'submit' })),
    );
  }, { wide: true });
}
