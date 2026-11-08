import type { Ctx, ViewResult } from '../app.js';
import { cx, h } from '../dom.js';
import { icon } from '../icons.js';
import { button } from '../components.js';
import { burstFrom, haptic } from '../fx.js';
import * as A from '../../data/actions.js';
import { ADVICE } from '../../domain/advice.js';
import { scheduleLabel } from '../../domain/habits.js';

export function adviceView(ctx: Ctx): ViewResult {
  const st = ctx.store;
  const done = new Set(st.settings().adviceDone);
  const names = new Set(st.all('habits').map((x) => x.name.toLowerCase()));
  const open = ADVICE.filter((a) => !done.has(a.id) && !names.has(a.name.toLowerCase()));
  const added = ADVICE.filter((a) => names.has(a.name.toLowerCase()));
  return {
    title: 'Consigli',
    node: h('div', { class: 'page' },
      h('h1', { class: 'page-title' }, 'Buone abitudini'),
      h('p', { class: 'lead' }, 'Scelte per chi gioca a basket, va in palestra e vuole costruire disciplina. Aggiungine una alla volta: si inizia con una, si tiene per tre settimane, poi la successiva.'),
      h('div', { class: 'advice-list' }, ...open.map((a, i) => h('article', { class: cx('advice', `area-${a.area}`), style: `--i:${i}` },
        h('div', { class: 'advice-top' }, h('span', { class: 'act-icon' }, icon(a.icon, 22)), h('div', null, h('strong', null, a.name), h('span', { class: 'muted small' }, scheduleLabel({ from: '', schedule: a.schedule }), a.reminder ? ` · promemoria ${a.reminder}` : ''))),
        h('p', null, a.why),
        h('p', { class: 'advice-how' }, icon('bulb', 14), ' ', a.how),
        h('div', { class: 'row-end' },
          button('Non ora', () => void ctx.run(() => A.updateSettings(st, { adviceDone: [...st.settings().adviceDone, a.id] }), 'Consiglio nascosto', true), { small: true, variant: 'quiet' }),
          button('Aggiungi', async (e) => {
            const el = e.currentTarget as Element;
            if (await ctx.run(() => A.addHabit(st, { name: a.name, kind: 'check', schedule: a.schedule, icon: a.icon, area: a.area, reminder: a.reminder }), `${a.name}: aggiunta alle attività`, true)) { burstFrom(el, { count: 22 }); haptic([10, 30, 10]); }
          }, { small: true, variant: 'primary', icon: 'plus' }),
        ),
      ))),
      !open.length ? h('p', { class: 'muted' }, 'Hai già visto tutti i consigli.') : null,
      added.length ? h('p', { class: 'muted small' }, `Già nelle tue attività: ${added.map((a) => a.name).join(', ')}.`) : null,
      done.size ? button('Mostra i consigli nascosti', () => void ctx.run(() => A.updateSettings(st, { adviceDone: [] })), { small: true, variant: 'quiet' }) : null,
    ),
  };
}
