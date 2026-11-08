import type { Ctx } from '../app.js';
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { openEventForm } from './calendar.js';
import { openNewHabit } from './activities.js';
import type { DateKey } from '../../domain/dates.js';

/** Pulsante + : le tre cose che si aggiungono più spesso. */
export function openQuickAdd(ctx: Ctx, date: DateKey): void {
  const hr = Math.min(23, ctx.store.now().getHours() + 1);
  const nextHour = `${String(hr).padStart(2, '0')}:00`;
  ctx.sheet('Aggiungi', (close) => {
    const opt = (ic: string, title: string, sub: string, fn: () => void, i: number): HTMLElement =>
      h('button', { type: 'button', class: 'qa-opt tap', style: `--i:${i}`, on: { click: () => { close(); fn(); } } },
        h('span', { class: 'qa-icon' }, icon(ic, 22)), h('span', { class: 'qa-text' }, h('strong', null, title), h('span', null, sub)), icon('chevron', 18));
    return h('div', { class: 'qa' },
      opt('bell', 'Promemoria', 'Una cosa da fare, da spuntare, anche ripetuta', () => openEventForm(ctx, null, date, { task: true, remind: 0, color: 'gold', start: nextHour }), 0),
      opt('calendar', 'Evento', 'Appuntamento con orario e luogo', () => openEventForm(ctx, null, date, { start: '09:00' }), 1),
      opt('repeat', 'Nuova abitudine', 'Da tenere monitorata ogni giorno o settimana', () => openNewHabit(ctx), 2),
    );
  });
}
