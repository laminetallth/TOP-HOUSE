import { cx, h } from '../dom.js';
import { icon } from '../icons.js';
import { button } from '../components.js';
import { celebrate, haptic } from '../fx.js';
import * as A from '../../data/actions.js';
import { H } from '../../domain/defaults.js';
import { indexLogs, logMeetsDay, streak, totalDone } from '../../domain/habits.js';
import { addDays, isoWeekday, weekStart, weekdayShort } from '../../domain/dates.js';
import { DECLARATIONS, DECLARATIONS_CLOSING, DECLARATIONS_CLOSING_INSTRUCTION, DECLARATIONS_INTRO, DECLARATIONS_TITLE } from '../../domain/declarations.js';
import { habitCalendar } from '../activity.js';
import { settingsBlock } from './activities.js';
export function declarationsView(ctx) {
    const st = ctx.store;
    const hb = st.get('habits', H.declarations);
    if (!hb)
        return { title: 'Dichiarazioni', node: h('p', null, 'Attività non trovata.') };
    const logs = indexLogs(st.all('habitLogs'), hb.id);
    const today = ctx.today;
    const done = logMeetsDay(hb, logs.get(today), today);
    const sk = streak(hb, logs, today, st.settings().restDates);
    const ws = weekStart(today);
    const week = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(ws, i));
    const action = done
        ? h('div', { class: 'decl-done' }, h('span', null, icon('check', 18), ' Letto oggi'), button('Annulla', () => void ctx.run(() => A.clearHabitLog(st, hb.id, today), 'Lettura annullata', true), { small: true, variant: 'quiet', icon: 'undo' }))
        : button('Fatto per oggi', async () => {
            haptic([15, 40, 25]);
            if (await ctx.run(() => A.markHabitDone(st, hb.id, today), undefined))
                celebrate('Ho una mente da milionario', sk.current + 1 > 1 ? `${sk.current + 1} giorni di fila` : 'Prima lettura della serie');
        }, { variant: 'primary', icon: 'crown', cls: 'btn-block' });
    return {
        title: 'Dichiarazioni',
        node: h('div', { class: 'page decl-page' }, h('a', { href: '#/attivita', class: 'back' }, icon('left', 16), 'Attività'), h('header', { class: 'decl-hero' }, h('span', { class: 'decl-emblem' }, icon('crown', 30)), h('h1', { class: 'decl-title' }, DECLARATIONS_TITLE), h('div', { class: 'decl-stats' }, h('div', null, h('strong', null, icon('flame', 16), String(sk.current)), h('span', null, 'giorni di fila')), h('div', null, h('strong', null, String(sk.best)), h('span', null, 'record')), h('div', null, h('strong', null, String(totalDone(hb, logs))), h('span', null, 'letture'))), h('div', { class: 'decl-week' }, ...week.map((d) => h('span', { class: cx(logMeetsDay(hb, logs.get(d), d) && 'on', d === today && 'now', d > today && 'future') }, weekdayShort(isoWeekday(d)).slice(0, 1))))), h('p', { class: 'decl-intro' }, icon('heart', 16), ' ', DECLARATIONS_INTRO), h('ol', { class: 'decl-list' }, ...DECLARATIONS.map((t, i) => h('li', { style: `--i:${i}` }, h('span', { class: 'decl-n' }, String(i + 1)), h('p', null, t)))), h('div', { class: 'decl-closing', style: `--i:${DECLARATIONS.length}` }, h('p', { class: 'muted' }, DECLARATIONS_CLOSING_INSTRUCTION), h('p', { class: 'decl-closing-line' }, `“${DECLARATIONS_CLOSING}”`)), h('div', { class: 'decl-sticky' }, action), h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Calendario delle letture'), habitCalendar(ctx, hb)), settingsBlock(ctx, hb)),
    };
}
//# sourceMappingURL=declarations.js.map