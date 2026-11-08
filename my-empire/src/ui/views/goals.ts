import type { Ctx, ViewResult } from '../app.js';
import { cx, fmtNumber, h } from '../dom.js';
import { icon } from '../icons.js';
import { button, empty, field, input, ring, section, segmented, textarea } from '../components.js';
import { celebrate, countUp, haptic } from '../fx.js';
import * as G from '../../data/goalActions.js';
import { currentValue, entriesFor, GOAL_STATUS_LABEL, goalProgress, HORIZON_LABEL, HORIZON_ORDER, isGoalOverdue, isReached, observedPace, requiredPace, validateGoal, type GoalInput } from '../../domain/goals.js';
import { diffDays, relativeLabel, shortLabel } from '../../domain/dates.js';
import type { Goal, GoalHorizon } from '../../domain/types.js';
import { parseNum } from '../parse.js';

const num = (n: number): string => fmtNumber(n, Number.isInteger(n) ? 0 : 1);
const withUnit = (n: number, g: Pick<Goal, 'unit'>): string => `${num(n)}${g.unit ? ` ${g.unit}` : ''}`;

function dueText(g: Goal, today: string): string {
  if (!g.dueDate) return 'Senza scadenza';
  const d = diffDays(today, g.dueDate);
  if (d < 0) return `Scaduto il ${shortLabel(g.dueDate)}`;
  if (d === 0) return 'Scade oggi';
  return d > 60 ? `${Math.round(d / 30.44)} mesi · ${shortLabel(g.dueDate)} ${g.dueDate.slice(0, 4)}` : `${d} giorni · ${shortLabel(g.dueDate)}`;
}

const ui: { tab: 'active' | 'done' | 'archive' } = { tab: 'active' };

export function goalsView(ctx: Ctx): ViewResult {
  const all = ctx.store.all('goals').filter((g) => !g.parentId && !g.deletedAt);
  const list = all.filter((g) => (ui.tab === 'active' ? g.status === 'active' : ui.tab === 'done' ? g.status === 'achieved' : g.status === 'paused' || g.status === 'abandoned'))
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const entries = ctx.store.all('goalEntries');
  const card = (g: Goal, i: number): HTMLElement => {
    const cur = currentValue(entries, g.id);
    const p = goalProgress(g, cur?.value ?? null);
    return h('a', { href: `#/obiettivi/${g.id}`, class: cx('goal-card tap', isGoalOverdue(g, ctx.today) && 'late'), style: `--i:${i}` },
      g.target !== undefined
        ? ring(p ?? 0, { size: 72, stroke: 7, animate: ctx.entering, tone: 'gold', children: [h('strong', { class: 'ring-num sm' }, p === null ? '—' : `${Math.round(p * 100)}%`)] })
        : h('span', { class: 'goal-q' }, icon('target', 26)),
      h('div', { class: 'goal-body' },
        h('strong', null, g.title),
        h('span', { class: 'muted small' }, g.target !== undefined ? (cur ? `${withUnit(cur.value, g)} di ${withUnit(g.target, g)}` : `Obiettivo ${withUnit(g.target, g)} · valore da registrare`) : 'Obiettivo qualitativo'),
        h('span', { class: cx('small', isGoalOverdue(g, ctx.today) ? 'warn' : 'muted') }, `${HORIZON_LABEL[g.horizon]} · ${dueText(g, ctx.today)}`),
      ),
    );
  };
  return {
    title: 'Obiettivi',
    node: h('div', { class: 'page' },
      h('div', { class: 'page-head' }, h('h1', { class: 'page-title' }, 'Obiettivi'), button('Nuovo', () => openGoalForm(ctx, null), { small: true, icon: 'plus', variant: 'primary' })),
      segmented<typeof ui.tab>([{ value: 'active', label: 'Attivi' }, { value: 'done', label: 'Raggiunti' }, { value: 'archive', label: 'Archivio' }], ui.tab, (v) => { ui.tab = v; ctx.go('/obiettivi'); }, 'Stato'),
      list.length ? h('div', { class: 'goal-list' }, ...list.map(card)) : empty(ui.tab === 'active' ? 'Nessun obiettivo' : 'Niente qui', ui.tab === 'active' ? 'Scrivi dove vuoi arrivare, con un numero e una data: vedrai quanto manca e a che ritmo devi andare.' : 'Gli obiettivi compariranno qui quando cambi il loro stato.', ui.tab === 'active' ? button('Crea il primo obiettivo', () => openGoalForm(ctx, null), { variant: 'primary', icon: 'plus', small: true }) : undefined),
    ),
  };
}

export function goalDetailView(ctx: Ctx, params: Record<string, string>): ViewResult {
  const st = ctx.store;
  const g = st.get('goals', params.id);
  if (!g || g.deletedAt) return { title: 'Obiettivo', node: h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, 'Obiettivo non trovato.'), h('a', { href: '#/obiettivi', class: 'link' }, 'Torna agli obiettivi')) };
  const entries = entriesFor(st.all('goalEntries'), g.id);
  const cur = entries.at(-1) ?? null;
  const p = goalProgress(g, cur?.value ?? null);
  const req = requiredPace(g, cur?.value ?? null, ctx.today);
  const obs = observedPace(entries);
  const unit = g.unit ? ` ${g.unit}` : '';
  const big = h('strong', { class: 'ring-num' }, p === null ? '—' : `${Math.round(p * 100)}%`);
  if (p !== null && ctx.entering) requestAnimationFrame(() => countUp(big, Math.round(p * 100), { suffix: '%' }));
  return {
    title: g.title,
    node: h('div', { class: 'page' },
      h('a', { href: '#/obiettivi', class: 'back' }, icon('left', 16), 'Obiettivi'),
      h('header', { class: 'goal-hero' },
        h('div', { class: 'stack-sm' },
          h('span', { class: 'muted small' }, `${HORIZON_LABEL[g.horizon]} · ${GOAL_STATUS_LABEL[g.status]}`),
          h('h1', { class: 'page-title' }, g.title),
          g.description ? h('p', { class: 'muted pre' }, g.description) : null,
          g.target !== undefined ? h('p', { class: 'goal-fig' }, cur ? h('strong', null, num(cur.value)) : h('strong', null, '—'), ` / ${withUnit(g.target, g)}`) : null,
          h('p', { class: cx('small', isGoalOverdue(g, ctx.today) ? 'warn' : 'muted') }, dueText(g, ctx.today)),
        ),
        g.target !== undefined ? ring(p ?? 0, { size: 140, stroke: 12, animate: ctx.entering, tone: 'gold', children: [big, h('span', { class: 'ring-sub' }, 'raggiunto')] }) : null,
      ),
      h('div', { class: 'actions-wrap' },
        g.target !== undefined && g.status === 'active' ? button('Registra valore', () => openValue(ctx, g), { variant: 'primary', icon: 'plus', small: true }) : null,
        button('Modifica', () => openGoalForm(ctx, g), { small: true, icon: 'edit' }),
        g.status === 'active'
          ? button('Raggiunto', () => void ctx.run(() => G.setGoalStatus(st, g.id, 'achieved'), undefined).then((ok) => ok && celebrate('Obiettivo raggiunto', g.title)), { small: true, icon: 'trophy' })
          : button('Riattiva', () => void ctx.run(() => G.setGoalStatus(st, g.id, 'active'), 'Obiettivo riattivato', true), { small: true, icon: 'undo' }),
        g.status === 'active' ? button('Metti in pausa', () => void ctx.run(() => G.setGoalStatus(st, g.id, 'paused'), 'In pausa', true), { small: true, variant: 'quiet' }) : null,
        button('Elimina', async () => { if (await ctx.confirm('Eliminare l\'obiettivo?', 'Puoi annullare subito dopo.', 'Elimina', true)) { if (await ctx.run(() => G.deleteGoal(st, g.id), 'Obiettivo eliminato', true)) ctx.go('/obiettivi'); } }, { small: true, variant: 'quiet', icon: 'trash' }),
      ),
      g.target !== undefined && g.status === 'active'
        ? h('div', { class: 'tiles' },
            h('div', { class: 'tile' }, h('strong', null, req ? num(Math.round(req.perMonth * 10) / 10) : '—'), h('span', null, `al mese per arrivarci${unit}`)),
            h('div', { class: 'tile' }, h('strong', null, req ? num(Math.round(req.perWeek * 10) / 10) : '—'), h('span', null, `a settimana${unit}`)),
            h('div', { class: 'tile' }, h('strong', null, obs ? num(Math.round(obs.perMonth * 10) / 10) : '—'), h('span', null, obs ? 'al mese, il tuo ritmo' : 'ritmo: servono 2 valori')),
          )
        : null,
      g.target !== undefined
        ? section('Valori',
            entries.length ? h('ul', { class: 'log-list' }, ...[...entries].reverse().map((e) => h('li', null, h('span', { class: 'log-date' }, relativeLabel(e.date, ctx.today)), h('span', { class: 'log-val' }, withUnit(e.value, g)), e.note ? h('span', { class: 'log-note' }, e.note) : null, button('', () => void ctx.run(() => G.clearGoalValue(st, g.id, e.date), 'Valore rimosso', true), { small: true, variant: 'quiet', icon: 'trash', title: 'Rimuovi' }))))
            : h('p', { class: 'muted' }, 'Registra il valore di oggi: diventa il punto di partenza.'),
          )
        : null,
      section('Revisioni',
        reviewBox(ctx, g),
        ...[...g.reviews].reverse().map((r) => h('div', { class: 'review' }, h('span', { class: 'muted small' }, new Date(r.at).toLocaleDateString('it-IT')), h('p', { class: 'pre' }, r.text))),
      ),
    ),
  };
}

function reviewBox(ctx: Ctx, g: Goal): HTMLElement {
  const ta = textarea({ id: `rv-${g.id}`, rows: 2, placeholder: 'Come sta andando? Cosa cambi?' });
  return h('form', { class: 'stack-sm', on: { submit: async (e) => { e.preventDefault(); if (await ctx.run(() => G.addGoalReview(ctx.store, g.id, ta.value), 'Revisione salvata', true)) ta.value = ''; } } }, ta, h('div', { class: 'row-end' }, button('Salva', () => undefined, { small: true, type: 'submit' })));
}

function openValue(ctx: Ctx, g: Goal): void {
  ctx.sheet('Registra valore', (close) => {
    const v = input({ id: 'gv', attrs: { inputmode: 'decimal', autofocus: true }, placeholder: 'Valore di oggi' });
    const d = input({ id: 'gd', type: 'date', value: ctx.today, attrs: { max: ctx.today } });
    return h('form', { class: 'form', on: { submit: async (e) => {
      e.preventDefault();
      const n = parseNum(v.value);
      if (n === undefined || Number.isNaN(n)) return ctx.toast('Inserisci un numero.', { error: true });
      const before = goalProgress(g, currentValue(ctx.store.all('goalEntries'), g.id)?.value ?? null);
      if (await ctx.run(() => G.recordGoalValue(ctx.store, g.id, d.value, n), 'Valore registrato', true)) {
        close();
        haptic(12);
        if (isReached(g, n) && (before ?? 0) < 1) celebrate('Obiettivo raggiunto', g.title);
      }
    } } },
      h('p', { class: 'muted' }, 'Il valore misurato in quella data (non l\'incremento).'),
      h('div', { class: 'grid2' }, field(g.unit ? `Valore (${g.unit})` : 'Valore', v), field('Data', d)),
      h('div', { class: 'row-end' }, button('Indietro', close), button('Registra', () => undefined, { variant: 'primary', type: 'submit' })),
    );
  });
}

function openGoalForm(ctx: Ctx, existing: Goal | null): void {
  const state = { horizon: (existing?.horizon ?? 'annual') as GoalHorizon };
  ctx.sheet(existing ? 'Modifica obiettivo' : 'Nuovo obiettivo', (close) => {
    const title = input({ id: 'gf-t', value: existing?.title ?? '', placeholder: 'es. Pesare 83 kg, Risparmiare 3.000 €', attrs: { maxlength: 200, autofocus: !existing } });
    const target = input({ id: 'gf-target', value: existing?.target !== undefined ? num(existing.target) : '', attrs: { inputmode: 'decimal' } });
    const unit = input({ id: 'gf-unit', value: existing?.unit ?? '', placeholder: 'kg, €, libri…', attrs: { maxlength: 30 } });
    const base = input({ id: 'gf-base', value: existing?.baseline !== undefined ? num(existing.baseline) : '', attrs: { inputmode: 'decimal' }, placeholder: '0 se vuoto' });
    const due = input({ id: 'gf-due', type: 'date', value: existing?.dueDate ?? '' });
    const desc = textarea({ id: 'gf-d', value: existing?.description ?? '', rows: 2, placeholder: 'Perché è importante per te' });
    const err = h('p', { class: 'form-error', attrs: { role: 'alert' } });
    const hz = h('div');
    const draw = (): void => { hz.replaceChildren(segmented<GoalHorizon>(HORIZON_ORDER.map((x) => ({ value: x, label: HORIZON_LABEL[x] })), state.horizon, (x) => { state.horizon = x; draw(); }, 'Orizzonte')); };
    draw();
    return h('form', { class: 'form', on: { submit: async (e) => {
      e.preventDefault();
      const t = parseNum(target.value);
      const b = parseNum(base.value);
      if (Number.isNaN(t) || Number.isNaN(b)) { err.textContent = 'Usa solo numeri per obiettivo e partenza.'; return; }
      const data: GoalInput = { title: title.value, description: desc.value, horizon: state.horizon, target: t, unit: unit.value, baseline: t === undefined ? undefined : b, dueDate: due.value || undefined, startDate: existing?.startDate ?? ctx.today };
      const ve = validateGoal(data);
      if (Object.keys(ve).length) { err.textContent = Object.values(ve)[0] ?? ''; return; }
      let created: Goal | undefined;
      const ok = existing ? await ctx.run(() => G.updateGoal(ctx.store, existing.id, data), 'Obiettivo aggiornato', true) : await ctx.run(async () => { created = await G.addGoal(ctx.store, data); }, 'Obiettivo creato', true);
      if (ok) { close(); haptic([10, 30, 10]); if (created) ctx.go(`/obiettivi/${created.id}`); }
    } } },
      field('Obiettivo', title), field('Orizzonte', hz),
      h('div', { class: 'grid2' }, field('Risultato desiderato', target, 'Facoltativo'), field('Unità', unit)),
      h('div', { class: 'grid2' }, field('Partenza', base, 'Facoltativa'), field('Entro il', due)),
      field('Descrizione', desc), err,
      h('div', { class: 'row-end sticky-actions' }, button('Annulla', close), button(existing ? 'Salva' : 'Crea', () => undefined, { variant: 'primary', type: 'submit' })),
    );
  });
}
