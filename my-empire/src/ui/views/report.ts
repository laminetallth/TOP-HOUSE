import type { Ctx, ViewResult } from '../app.js';
import { cx, fmtNumber, h } from '../dom.js';
import { icon } from '../icons.js';
import { button, field, ring, section, textarea } from '../components.js';
import { celebrate, countUp, haptic } from '../fx.js';
import * as A from '../../data/actions.js';
import { addDays, isDateKey, isoWeekday, shortLabel, weekStart, weekdayShort } from '../../domain/dates.js';
import { weekReport, type WeekReport } from '../../domain/report.js';
import { H } from '../../domain/defaults.js';
import { habitHref } from '../activity.js';

const celebrated = new Set<string>();

function data(ctx: Ctx) {
  const st = ctx.store;
  return { habits: st.all('habits'), logs: st.all('habitLogs'), ratings: st.all('ratings'), games: st.all('basketGames'), sessions: st.all('gymSessions'), restDates: st.settings().restDates };
}

function verdict(r: WeekReport): string {
  if (r.score === null) return 'Settimana senza attività previste.';
  const p = r.score;
  if (p >= 0.9) return 'Settimana da imperatore.';
  if (p >= 0.75) return 'Ottima settimana: costanza solida.';
  if (p >= 0.5) return 'Buona base, c\'è margine.';
  return 'Settimana in salita: riparti da una cosa sola.';
}

export function reportView(ctx: Ctx, params: Record<string, string>): ViewResult {
  const st = ctx.store;
  const day = params.date && isDateKey(params.date) && params.date <= ctx.today ? params.date : ctx.today;
  const r = weekReport(data(ctx), day, ctx.today, H.audiobook);
  const prev = weekReport(data(ctx), addDays(r.from, -7), ctx.today, H.audiobook);
  const pct = r.score === null ? 0 : Math.round(r.score * 100);
  const delta = r.score !== null && prev.score !== null ? Math.round((r.score - prev.score) * 100) : null;
  const isCurrent = r.from === weekStart(ctx.today);
  const big = h('strong', { class: 'rep-pct' }, `${pct}%`);
  if (ctx.entering) requestAnimationFrame(() => countUp(big, pct, { suffix: '%', duration: 1300 }));
  if (ctx.entering && r.finished && (r.score ?? 0) >= 0.9 && !celebrated.has(r.from)) {
    celebrated.add(r.from);
    setTimeout(() => celebrate('Settimana da imperatore', `${pct}% di completamento`), 900);
  }
  const note = st.get('weekNotes', `wn:${r.from}`);
  const nav = (d: string): void => { haptic(5); ctx.go(`/report/${d}`); };

  const habitRows = r.habits.filter((x) => x.expected > 0 || x.done > 0).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)).map((x, i) =>
    h('a', { href: habitHref(x.habit), class: 'rep-row', style: `--i:${i}` },
      h('span', { class: 'rep-ic' }, icon(x.habit.icon, 16)),
      h('span', { class: 'rep-name' }, x.habit.name, x.minutes !== undefined ? h('small', null, ` · ${x.minutes} min`) : null),
      h('span', { class: 'rep-dots' }, ...x.days.map((s, j) => h('i', { class: `hc-${s === 'missing' ? (addDays(r.from, j) < ctx.today ? 'missed' : 'today') : s === 'done' ? 'done' : s === 'skipped' ? 'skipped' : s === 'partial' ? 'partial' : s === 'future' ? 'future' : 'free'}` }))),
      h('span', { class: cx('rep-val', x.rate !== null && x.rate >= 1 && 'full') }, x.expected ? `${x.done}/${x.expected}` : `+${x.done}`),
    ));

  const bar = (v: number | null): HTMLElement => h('div', { class: 'rep-mbar' }, h('i', { style: `height:${v ? v * 10 : 4}%;--hue:${v ? Math.round(350 + (v - 1) * 20) % 360 : 0}`, class: cx(!v && 'none') }));
  const basket = r.habits.find((x) => x.habit.id === H.basket);
  const gym = r.habits.find((x) => x.habit.id === H.gym);
  const crea = r.habits.find((x) => x.habit.id === H.creatine);
  const vitd = r.habits.find((x) => x.habit.id === H.vitaminD);
  const decl = r.habits.find((x) => x.habit.id === H.declarations);

  const card = (title: string, ic: string, value: string, sub: string, i: number, tone = ''): HTMLElement =>
    h('div', { class: cx('rep-card', tone), style: `--i:${i}` }, h('span', { class: 'rep-card-ic' }, icon(ic, 18)), h('strong', null, value), h('span', { class: 'rep-card-t' }, title), h('span', { class: 'muted small' }, sub));

  return {
    title: 'Report',
    node: h('div', { class: 'page report' },
      h('div', { class: 'rep-nav' },
        h('button', { type: 'button', class: 'icon-btn', attrs: { 'aria-label': 'Settimana precedente' }, on: { click: () => nav(addDays(r.from, -7)) } }, icon('left', 20)),
        h('div', { class: 'rep-week' }, h('strong', null, isCurrent ? 'Questa settimana' : `Settimana del ${shortLabel(r.from)}`), h('span', { class: 'muted small' }, `${shortLabel(r.from)} – ${shortLabel(r.to)} ${r.to.slice(0, 4)}`)),
        h('button', { type: 'button', class: 'icon-btn', disabled: isCurrent, attrs: { 'aria-label': 'Settimana successiva' }, on: { click: () => nav(addDays(r.from, 7)) } }, icon('right', 20)),
      ),
      h('header', { class: 'rep-hero' },
        ring(r.score ?? 0, { size: 170, stroke: 13, animate: ctx.entering, label: `Completamento ${pct}%`, children: [big, h('span', { class: 'ring-sub' }, isCurrent ? 'finora' : 'completamento')] }),
        h('div', { class: 'rep-hero-text' },
          h('h1', { class: 'rep-verdict' }, verdict(r)),
          delta !== null ? h('p', { class: delta >= 0 ? 'ok-text' : 'warn' }, icon(delta >= 0 ? 'up' : 'down', 16), ` ${delta >= 0 ? '+' : ''}${delta} punti rispetto alla settimana prima`) : null,
          h('p', { class: 'muted' }, `${r.perfectDays} ${r.perfectDays === 1 ? 'giorno perfetto' : 'giorni perfetti'} · ${r.habits.reduce((s, x) => s + Math.min(x.done, x.expected), 0)} attività completate`),
        ),
      ),
      h('div', { class: 'rep-cards' },
        card('Basket', 'basketball', basket ? (basket.expected ? `${basket.done}/${basket.expected}` : `+${basket.done}`) : '—', r.games.length ? `${r.games.length} ${r.games.length === 1 ? 'partita' : 'partite'} · ${r.points} punti` : 'allenamenti', 0, basket && basket.expected > 0 && basket.done >= basket.expected ? 'full' : ''),
        card('Palestra', 'dumbbell', gym ? `${gym.done}/${gym.expected}` : '—', r.gym.volume ? `${fmtNumber(r.gym.volume)} kg di volume${r.gym.records.length ? ` · ${r.gym.records.length} record` : ''}` : 'sessioni', 1, gym && gym.expected > 0 && gym.done >= gym.expected ? 'full' : ''),
        card('Audiolibro', 'headphones', `${r.audiobookMinutes}'`, `su ${7 * 30} minuti`, 2, r.audiobookMinutes >= 210 ? 'full' : ''),
        card('Dichiarazioni', 'crown', decl ? `${decl.done}/${decl.expected}` : '—', 'letture', 3, decl && decl.expected > 0 && decl.done >= decl.expected ? 'full' : ''),
        card('Integratori', 'flask', `${(crea?.done ?? 0) + (vitd?.done ?? 0)}/${(crea?.expected ?? 0) + (vitd?.expected ?? 0)}`, 'creatina + vitamina D', 4),
      ),
      section('Voti della settimana',
        h('div', { class: 'rep-votes' },
          h('div', { class: 'rep-vote' },
            h('div', { class: 'row-between' }, h('strong', null, 'Soldi'), h('span', { class: 'rep-avg' }, r.money.avg === null ? '—' : r.money.avg.toLocaleString('it-IT', { maximumFractionDigits: 1 }))),
            h('div', { class: 'rep-mbars' }, ...r.money.series.map((v, i) => h('div', { class: 'rep-mcol' }, bar(v), h('span', null, weekdayShort(isoWeekday(addDays(r.from, i))).slice(0, 1))))),
          ),
          h('div', { class: 'rep-vote' },
            h('div', { class: 'row-between' }, h('strong', null, 'Alimentazione'), h('span', { class: 'rep-avg' }, r.food.avg === null ? '—' : r.food.avg.toLocaleString('it-IT', { maximumFractionDigits: 1 }))),
            h('div', { class: 'rep-mbars' }, ...[0, 1, 2, 3, 4, 5, 6].map((i) => { const d = addDays(r.from, i); const v = st.get('ratings', `food:${d}`)?.value ?? null; return h('div', { class: 'rep-mcol' }, bar(v), h('span', null, weekdayShort(isoWeekday(d)).slice(0, 1))); })),
          ),
        ),
      ),
      section('Tutte le attività', h('div', { class: 'rep-list' }, ...habitRows)),
      r.tips.length ? section('Per la prossima settimana', h('ul', { class: 'tips' }, ...r.tips.map((t, i) => h('li', { style: `--i:${i}` }, icon('bulb', 16), h('span', null, t))))) : null,
      section('La tua revisione', reviewForm(ctx, r.from, note)),
    ),
  };
}

function reviewForm(ctx: Ctx, from: string, note: { best?: string; obstacle?: string; next?: string } | undefined): HTMLElement {
  const best = textarea({ id: 'wr-best', value: note?.best ?? '', rows: 2, placeholder: 'Il risultato di cui vai più fiero' });
  const obstacle = textarea({ id: 'wr-obs', value: note?.obstacle ?? '', rows: 2, placeholder: 'Cosa ti ha frenato' });
  const next = textarea({ id: 'wr-next', value: note?.next ?? '', rows: 2, placeholder: 'La priorità della prossima settimana' });
  return h('form', { class: 'form', on: { submit: async (e) => { e.preventDefault(); if (await ctx.run(() => A.saveWeekNote(ctx.store, from, { best: best.value, obstacle: obstacle.value, next: next.value }), 'Revisione salvata', true)) haptic([10, 30, 10]); } } },
    field('Migliore della settimana', best), field('Ostacolo principale', obstacle), field('Priorità per la prossima', next),
    h('div', { class: 'row-end' }, button('Salva revisione', () => undefined, { variant: 'primary', type: 'submit', small: true })),
  );
}
