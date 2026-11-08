import { cx, h } from '../dom.js';
import { icon } from '../icons.js';
import { button, field, ratingPicker, ring, section, segmented, textarea } from '../components.js';
import { burstFrom, countUp, haptic } from '../fx.js';
import * as A from '../../data/actions.js';
import { addDays, fromKey, isoWeekday, monthEnd, monthName, monthStart, range, relativeLabel, shortLabel, weekStart, weekdayShort } from '../../domain/dates.js';
import { H } from '../../domain/defaults.js';
import { indexLogs, logMeetsDay, streak } from '../../domain/habits.js';
import { habitCheck, installDay, look } from '../activity.js';
const hueOf = (v) => Math.round(350 + (v - 1) * 20) % 360;
function avg(xs) {
    return xs.length ? xs.reduce((s, r) => s + r.value, 0) / xs.length : null;
}
/** Barre dei voti degli ultimi N giorni: altezza e colore dal voto; vuoto = non votato. */
function ratingBars(ctx, kind, days, animate) {
    const end = ctx.today;
    const list = range(addDays(end, -(days - 1)), end);
    return h('div', { class: cx('rbars', animate && 'grow') }, ...list.map((d, i) => {
        const r = ctx.store.get('ratings', `${kind}:${d}`);
        return h('button', { type: 'button', class: cx('rb', !r && 'none', d === end && 'now'), style: `--i:${i};--h:${r ? r.value * 10 : 6}%;--hue:${r ? hueOf(r.value) : 0}`, title: `${shortLabel(d)}: ${r ? `${r.value}/10` : 'non votato'}`, attrs: { 'aria-label': `${shortLabel(d)} ${r ? `${r.value} su 10` : 'non votato'}` }, on: { click: () => openRate(ctx, kind, d) } }, h('i', null), h('span', null, days <= 14 || i % 5 === 4 || d === end ? weekdayShort(isoWeekday(d)).slice(0, 1) : ''));
    }));
}
/** Mese a colori: ogni giorno ha il colore del voto. */
function ratingMonth(ctx, kind) {
    const first = monthStart(ctx.today);
    const days = range(first, monthEnd(first));
    const lead = isoWeekday(first) - 1;
    return h('div', { class: 'rmonth' }, ...[1, 2, 3, 4, 5, 6, 7].map((d) => h('span', { class: 'hcal-wd' }, weekdayShort(d).slice(0, 1))), ...Array.from({ length: lead }, () => h('span')), ...days.map((d, i) => {
        const r = ctx.store.get('ratings', `${kind}:${d}`);
        const missed = !r && d < ctx.today && d >= installDay(ctx);
        return h('button', { type: 'button', class: cx('rm', r && 'set', missed && 'missed', d === ctx.today && 'is-today'), disabled: d > ctx.today, style: `--i:${i};--hue:${r ? hueOf(r.value) : 0}`, on: { click: () => openRate(ctx, kind, d) } }, h('span', null, String(fromKey(d).getDate())), r ? h('strong', null, String(r.value)) : null);
    }));
}
function openRate(ctx, kind, d) {
    if (d > ctx.today)
        return;
    const rec = ctx.store.get('ratings', `${kind}:${d}`);
    const state = { v: rec?.value };
    ctx.sheet(`${kind === 'money' ? 'Soldi' : 'Alimentazione'} · ${relativeLabel(d, ctx.today)}`, (close) => {
        const pick = h('div');
        const draw = () => { pick.replaceChildren(ratingPicker(state.v, (v) => { state.v = v; haptic(6); draw(); }, 'Voto')); };
        draw();
        const note = textarea({ id: 'r-note', value: rec?.note ?? '', rows: 3, placeholder: kind === 'money' ? 'Cosa hai comprato? Era pianificato?' : 'Cosa hai mangiato di buono o di meno buono?' });
        return h('form', { class: 'form', on: { submit: async (e) => {
                    e.preventDefault();
                    if (!state.v)
                        return ctx.toast('Scegli un voto da 1 a 10.', { error: true });
                    if (await ctx.run(() => A.setRating(ctx.store, kind, d, state.v, note.value), 'Voto salvato', true))
                        close();
                } } }, field('Voto', pick), field('Nota', note, 'Facoltativa'), h('div', { class: 'row-end' }, rec ? button('Togli', () => void ctx.run(() => A.clearRating(ctx.store, kind, d), 'Voto rimosso', true).then(close), { variant: 'quiet', icon: 'undo' }) : null, button('Salva', () => undefined, { variant: 'primary', type: 'submit' })));
    });
}
function hero(ctx, kind, title, question, ic) {
    const rec = ctx.store.get('ratings', `${kind}:${ctx.today}`);
    const all = ctx.store.all('ratings').filter((r) => r.kind === kind);
    const ws = weekStart(ctx.today);
    const week = all.filter((r) => r.date >= ws && r.date <= ctx.today);
    const month = all.filter((r) => r.date >= monthStart(ctx.today) && r.date <= ctx.today);
    const prevWeek = all.filter((r) => r.date >= addDays(ws, -7) && r.date < ws);
    const wa = avg(week);
    const pa = avg(prevWeek);
    const big = h('strong', { class: 'rate-big' }, rec ? String(rec.value) : '–');
    if (rec && ctx.entering)
        requestAnimationFrame(() => countUp(big, rec.value));
    return h('header', { class: cx('rate-hero', rec && 'set'), style: rec ? `--hue:${hueOf(rec.value)}` : '' }, h('div', { class: 'rate-hero-top' }, h('span', { class: 'act-hero-icon' }, icon(ic, 26)), h('div', null, h('h1', { class: 'page-title' }, title), h('p', { class: 'muted' }, question)), big), h('div', { dataset: { k: kind } }, ratingPicker(rec?.value, (v) => {
        haptic(10);
        const b = document.querySelector(`.rate-hero [data-k="${kind}"] .rate:nth-child(${v})`);
        if (b)
            burstFrom(b, { count: 12, spread: 50 });
        void ctx.run(() => A.setRating(ctx.store, kind, ctx.today, v, rec?.note), `Oggi: ${v}/10`, true);
    }, question)), h('div', { class: 'row' }, button(rec?.note ? 'Modifica nota' : 'Aggiungi una nota', () => openRate(ctx, kind, ctx.today), { small: true, variant: 'quiet', icon: 'note' })), h('div', { class: 'tiles' }, h('div', { class: 'tile' }, h('strong', null, wa === null ? '—' : wa.toLocaleString('it-IT', { maximumFractionDigits: 1 })), h('span', null, 'media settimana')), h('div', { class: 'tile' }, h('strong', null, avg(month) === null ? '—' : avg(month).toLocaleString('it-IT', { maximumFractionDigits: 1 })), h('span', null, `media di ${monthName(ctx.today)}`)), h('div', { class: 'tile' }, h('strong', { class: wa !== null && pa !== null ? (wa >= pa ? 'ok-text' : 'warn') : '' }, wa !== null && pa !== null ? `${wa >= pa ? '+' : ''}${(wa - pa).toLocaleString('it-IT', { maximumFractionDigits: 1 })}` : '—'), h('span', null, 'vs settimana scorsa')), h('div', { class: 'tile' }, h('strong', null, String(month.length)), h('span', null, 'giorni votati nel mese'))));
}
const range30 = { n: 14 };
export function moneyView(ctx) {
    const all = ctx.store.all('ratings').filter((r) => r.kind === 'money' && r.date <= ctx.today);
    const last30 = all.filter((r) => r.date > addDays(ctx.today, -30));
    const best = last30.length ? last30.reduce((a, b) => (b.value >= a.value ? b : a)) : null;
    const worst = last30.length ? last30.reduce((a, b) => (b.value <= a.value ? b : a)) : null;
    return {
        title: 'Soldi',
        node: h('div', { class: 'page' }, hero(ctx, 'money', 'Soldi', 'Come hai gestito i soldi oggi?', 'wallet'), h('p', { class: 'muted small' }, 'Il voto riguarda le scelte, non quanto hai speso: rispetto del budget, acquisti impulsivi, coerenza con i tuoi obiettivi.'), section('Andamento', segmented([{ value: 14, label: '14 giorni' }, { value: 30, label: '30 giorni' }], range30.n, (v) => { range30.n = v; ctx.go('/soldi'); }, 'Periodo'), ratingBars(ctx, 'money', range30.n, true), best && worst && best.date !== worst.date ? h('p', { class: 'muted small' }, `Ultimi 30 giorni · migliore: ${best.value}/10 (${relativeLabel(best.date, ctx.today)}) · peggiore: ${worst.value}/10 (${relativeLabel(worst.date, ctx.today)})`) : null), section(`${monthName(ctx.today)} a colori`, ratingMonth(ctx, 'money'), h('p', { class: 'muted small' }, 'Tocca un giorno per votarlo o modificarlo. Bordo rosso: giorno non votato.')), section('Note recenti', ...(all.filter((r) => r.note).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((r) => h('div', { class: 'note-row', style: `--hue:${hueOf(r.value)}` }, h('strong', null, String(r.value)), h('div', null, h('span', { class: 'muted small' }, relativeLabel(r.date, ctx.today)), h('p', null, r.note))))), all.some((r) => r.note) ? null : h('p', { class: 'muted' }, 'Nessuna nota. Una riga ogni tanto aiuta a capire cosa fa salire o scendere il voto.'))),
    };
}
export function nutritionView(ctx) {
    const st = ctx.store;
    const supplements = [H.creatine, H.vitaminD].map((id) => st.get('habits', id)).filter((x) => !!x && !x.archivedAt);
    const ws = weekStart(ctx.today);
    const supCard = (hb) => {
        const logs = indexLogs(st.all('habitLogs'), hb.id);
        const sk = streak(hb, logs, ctx.today, st.settings().restDates);
        const wk = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(ws, i));
        const n = wk.filter((d) => d <= ctx.today && logMeetsDay(hb, logs.get(d), d)).length;
        const elapsed = wk.filter((d) => d <= ctx.today).length;
        return h('div', { class: cx('sup-card', look(ctx, hb, ctx.today) === 'done' && 'done') }, h('div', { class: 'sup-top' }, ring(elapsed ? n / elapsed : 0, { size: 64, stroke: 7, animate: ctx.entering, children: [h('span', { class: 'sup-ic' }, icon(hb.icon, 20))] }), h('div', { class: 'sup-text' }, h('strong', null, hb.name), h('span', { class: 'muted small' }, `${n}/${elapsed} questa settimana${sk.current > 1 ? ` · ${sk.current} di fila` : ''}`), hb.reminder ? h('span', { class: 'muted small' }, `promemoria alle ${hb.reminder}`) : null), habitCheck(ctx, hb, ctx.today)), h('div', { class: 'sup-week' }, ...wk.map((d) => h('i', { class: cx(`hc-${look(ctx, hb, d)}`, d === ctx.today && 'is-today'), title: weekdayShort(isoWeekday(d)) }))), h('a', { href: `#/attivita/${hb.id}`, class: 'link small' }, 'Calendario e statistiche'));
    };
    return {
        title: 'Nutrizione',
        node: h('div', { class: 'page' }, h('h1', { class: 'page-title' }, 'Nutrizione'), section('Integratori di oggi', h('div', { class: 'sup-grid' }, ...supplements.map(supCard))), hero(ctx, 'food', 'Alimentazione', 'Come hai mangiato oggi?', 'food'), section('Andamento', ratingBars(ctx, 'food', 14, true)), section(`${monthName(ctx.today)} a colori`, ratingMonth(ctx, 'food')), h('p', { class: 'muted small' }, 'Un voto personale, non una valutazione medica. Per indicazioni su integratori e dosi fai riferimento al tuo medico o a un nutrizionista.')),
    };
}
//# sourceMappingURL=ratings.js.map