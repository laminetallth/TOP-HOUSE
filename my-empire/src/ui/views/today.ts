import type { Ctx, ViewResult } from '../app.js';
import { cx, h } from '../dom.js';
import { icon } from '../icons.js';
import { button, ratingPicker, ring } from '../components.js';
import { burstFrom, countUp, haptic, isFresh, markFresh } from '../fx.js';
import * as A from '../../data/actions.js';
import * as C from '../../data/calActions.js';
import { addMinutes, amount, checkDayComplete, dueToday, habitCheck, habitHref, remainingToday, type DueItem } from '../activity.js';
import { fromKey, monthName, parseTime, weekdayName } from '../../domain/dates.js';
import { occurrencesOn, type Occurrence } from '../../domain/calendar.js';
import { ruleFor } from '../../domain/habits.js';
import { H } from '../../domain/defaults.js';
import type { RatingKind } from '../../domain/types.js';
import { openEventForm } from './calendar.js';
import { openQuickAdd } from './quickadd.js';

function greeting(d: Date): string {
  const hr = d.getHours();
  if (hr < 5) return 'Buonanotte';
  if (hr < 13) return 'Buongiorno';
  if (hr < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

type Item = { kind: 'habit'; time: string; due: DueItem } | { kind: 'event'; time: string; occ: Occurrence };

function nowMinutes(ctx: Ctx): number {
  const d = ctx.store.now();
  return d.getHours() * 60 + d.getMinutes();
}

function habitItem(ctx: Ctx, it: DueItem): HTMLElement {
  const hb = it.habit;
  const today = ctx.today;
  const target = ruleFor(hb, today)?.dailyTarget ?? 0;
  const fresh = isFresh(`${hb.id}:${today}`);
  const late = hb.reminder && !it.done && !it.skipped && (parseTime(hb.reminder) ?? 0) < nowMinutes(ctx);
  let sub = '';
  if (it.skipped) sub = 'Saltato oggi';
  else if (hb.kind !== 'check') sub = `${amount(hb, it.value)}${target ? ` di ${amount(hb, target)}` : ''}`;
  else if (it.weekly) sub = `${it.weekDone} di ${it.weekTarget} questa settimana`;
  else if (hb.reminder) sub = `alle ${hb.reminder}`;
  const minutes = hb.kind !== 'check' && !it.done
    ? h('div', { class: 'quick-adds' },
        ...(hb.kind === 'minutes' ? [10, 15, 30] : [1, 5]).map((n) => button(`+${n}`, (e) => void addMinutes(ctx, hb, today, n, e.currentTarget as Element), { small: true, cls: 'chip-btn' })),
      )
    : null;
  const progress = hb.kind !== 'check' && target
    ? h('div', { class: 'mini-bar' }, h('i', { style: `width:${Math.min(100, (it.value / target) * 100)}%` }))
    : null;
  return h('li', { class: cx('tl-item', it.done && 'done', it.skipped && 'skipped', fresh && 'fresh', late && 'late'), dataset: { area: hb.area } },
    h('span', { class: 'tl-time' }, hb.reminder ?? ''),
    h('div', { class: 'tl-card' },
      h('span', { class: 'tl-icon' }, icon(hb.icon, 20)),
      h('a', { href: habitHref(hb), class: 'tl-body' },
        h('span', { class: 'tl-name' }, hb.name),
        sub ? h('span', { class: 'tl-sub' }, sub, late ? h('span', { class: 'late-tag' }, ' · in ritardo') : null) : null,
        progress,
      ),
      minutes,
      hb.kind === 'check' || it.done ? habitCheck(ctx, hb, today) : null,
    ),
  );
}

function eventItem(ctx: Ctx, o: Occurrence): HTMLElement {
  const e = o.event;
  const fresh = isFresh(`ev:${e.id}:${o.date}`);
  return h('li', { class: cx('tl-item', 'is-event', o.done && 'done', fresh && 'fresh'), dataset: { color: e.color } },
    h('span', { class: 'tl-time' }, e.start ?? ''),
    h('div', { class: 'tl-card' },
      h('span', { class: 'tl-icon ev-dot' }, icon(e.task ? 'bell' : 'calendar', 18)),
      h('button', { type: 'button', class: 'tl-body', on: { click: () => openEventForm(ctx, e, o.date) } },
        h('span', { class: 'tl-name' }, e.title),
        h('span', { class: 'tl-sub' }, [e.start ? `${e.start}${e.end ? `–${e.end}` : ''}` : 'Tutto il giorno', e.location].filter(Boolean).join(' · ')),
      ),
      e.task
        ? h('button', {
            type: 'button', class: cx('cc', o.done ? 'cc-done' : 'cc-todo', fresh && 'fresh'), attrs: { 'aria-label': o.done ? `Togli spunta: ${e.title}` : `Fatto: ${e.title}`, 'aria-pressed': o.done },
            on: { click: async (ev) => {
              const el = ev.currentTarget as Element;
              const before = remainingToday(ctx);
              if (!o.done) { burstFrom(el); haptic(15); markFresh(`ev:${e.id}:${o.date}`); }
              if (await ctx.run(() => C.toggleEventDone(ctx.store, e.id, o.date), o.done ? 'Spunta tolta' : `${e.title} ✓`, true)) checkDayComplete(ctx, before);
            } },
          }, iconCheck())
        : null,
    ),
  );
}

function iconCheck(): SVGElement {
  const t = document.createElement('template');
  t.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" class="cc-bg"/><path d="M9.5 16.5l4.2 4.2 8.8-9.4" class="cc-tick"/></svg>';
  return t.content.firstElementChild as SVGElement;
}

function voteCard(ctx: Ctx, kind: RatingKind, title: string, ic: string, hint: string, href: string): HTMLElement {
  const rec = ctx.store.get('ratings', `${kind}:${ctx.today}`);
  return h('section', { class: cx('vote-card', rec && 'set'), style: rec ? `--hue:${Math.round(350 + (rec.value - 1) * 20) % 360}` : '' },
    h('div', { class: 'vote-head' },
      h('span', { class: 'vote-icon' }, icon(ic, 20)),
      h('div', { class: 'vote-title' }, h('strong', null, title), h('span', { class: 'muted small' }, rec ? `Voto di oggi: ${rec.value}/10` : hint)),
      rec ? h('span', { class: 'vote-big' }, String(rec.value)) : null,
      h('a', { href, class: 'icon-btn', attrs: { 'aria-label': `Statistiche ${title}` } }, icon('right', 18)),
    ),
    ratingPicker(rec?.value, (v) => {
      haptic(10);
      const btn = document.querySelector(`[data-k="${kind}"] .rate:nth-child(${v})`);
      if (btn) burstFrom(btn, { count: 10, spread: 40 });
      void ctx.run(() => A.setRating(ctx.store, kind, ctx.today, v, rec?.note), `${title}: ${v}/10`, true);
    }, title),
  );
}

export function todayView(ctx: Ctx): ViewResult {
  const st = ctx.store;
  const today = ctx.today;
  const d = fromKey(today);
  const due = dueToday(ctx);
  const occ = occurrencesOn(st.all('calEvents'), today);
  const rem = remainingToday(ctx);
  const ratio = rem.total ? rem.done / rem.total : 0;

  const items: Item[] = [
    ...due.map((x): Item => ({ kind: 'habit', time: x.habit.reminder ?? '', due: x })),
    ...occ.map((o): Item => ({ kind: 'event', time: o.event.start ?? '', occ: o })),
  ];
  const isDone = (i: Item): boolean => (i.kind === 'habit' ? i.due.done || i.due.skipped : i.occ.done || !i.occ.event.task && (parseTime(i.occ.event.end ?? i.occ.event.start ?? '') ?? 9999) < nowMinutes(ctx));
  const sorter = (a: Item, b: Item): number => (a.time || '99').localeCompare(b.time || '99');
  const open = items.filter((i) => !isDone(i)).sort(sorter);
  const closed = items.filter(isDone).sort(sorter);
  const render = (i: Item): HTMLElement => (i.kind === 'habit' ? habitItem(ctx, i.due) : eventItem(ctx, i.occ));

  const pctEl = h('strong', { class: 'hero-pct' }, `${Math.round(ratio * 100)}%`);
  if (ctx.entering) requestAnimationFrame(() => countUp(pctEl, Math.round(ratio * 100), { suffix: '%' }));
  const next = open.find((i) => i.time && (parseTime(i.time) ?? 0) >= nowMinutes(ctx));

  const declDone = st.get('habitLogs', `${H.declarations}:${today}`);
  const hero = h('header', { class: 'today-hero' },
    h('div', { class: 'hero-text' },
      h('p', { class: 'hero-greet' }, `${greeting(st.now())}, ${st.settings().name || 'campione'}`),
      h('h1', { class: 'hero-date' }, h('em', null, weekdayName(today)), ' ', h('span', { class: 'hero-num' }, String(d.getDate())), ' ', monthName(today)),
      h('p', { class: 'hero-sub' }, rem.total === 0 ? 'Niente in programma: aggiungi qualcosa con +' : rem.done === rem.total ? 'Hai completato tutto per oggi.' : `${rem.total - rem.done} ${rem.total - rem.done === 1 ? 'cosa' : 'cose'} da fare · ${rem.done} fatte`),
      next ? h('p', { class: 'hero-next' }, icon('bell', 15), ` Prossimo: ${next.kind === 'habit' ? next.due.habit.name : next.occ.event.title} alle ${next.time}`) : null,
    ),
    ring(ratio, { size: 132, stroke: 11, animate: ctx.entering, label: `Giornata al ${Math.round(ratio * 100)}%`, children: [pctEl, h('span', { class: 'hero-ring-sub' }, 'giornata')] }),
  );

  const decl = !declDone
    ? h('a', { href: '#/dichiarazioni', class: 'decl-banner tap' },
        h('span', { class: 'decl-crown' }, icon('crown', 22)),
        h('span', { class: 'decl-text' }, h('strong', null, 'Leggi le dichiarazioni'), h('span', null, 'I segreti della mente milionaria · 2 minuti')),
        icon('chevron', 20),
      )
    : null;

  const votes = h('div', { class: 'votes' },
    h('div', { dataset: { k: 'food' } }, voteCard(ctx, 'food', 'Come hai mangiato?', 'food', 'Un voto da 1 a 10', '#/nutrizione')),
    h('div', { dataset: { k: 'money' } }, voteCard(ctx, 'money', 'Come hai gestito i soldi?', 'wallet', 'Budget, acquisti impulsivi, scelte', '#/soldi')),
  );

  const fab = h('button', { type: 'button', class: 'fab', attrs: { 'aria-label': 'Aggiungi' }, on: { click: () => { haptic(8); openQuickAdd(ctx, today); } } }, icon('plus', 26));

  return {
    title: 'Oggi',
    node: h('div', { class: 'page today' },
      hero,
      decl,
      h('section', { class: 'section' },
        h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, 'La tua giornata'), h('a', { href: `#/calendario/${today}`, class: 'link' }, 'Calendario')),
        open.length
          ? h('ol', { class: 'timeline' }, ...open.map(render))
          : h('div', { class: 'all-done' }, icon('check', 22), h('span', null, items.length ? 'Tutto fatto. Goditi la serata.' : 'Giornata libera.')),
        closed.length ? h('details', { class: 'closed-group', open: closed.length <= 3 }, h('summary', null, `Fatto (${closed.length})`), h('ol', { class: 'timeline' }, ...closed.map(render))) : null,
      ),
      votes,
      fab,
    ),
  };
}

