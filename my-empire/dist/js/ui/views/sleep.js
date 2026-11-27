import { h } from '../dom.js';
import { button, field, input } from '../components.js';
import { addDays, fromKey, parseTime } from '../../domain/dates.js';
import { sleepDuration, sleepMinutes } from '../../domain/sleep.js';
import { saveSleep, deleteSleep } from '../../data/sleepActions.js';
export function sleepCard(ctx) {
    const st = ctx.store;
    const date = input({ type: 'date', value: ctx.today, max: ctx.today, required: true });
    const bed = input({ type: 'time', required: true });
    const wake = input({ type: 'time', required: true });
    const result = h('p', { class: 'sleep-duration', attrs: { 'aria-live': 'polite' } });
    const status = h('p', { class: 'muted small' });
    const update = () => {
        try {
            result.textContent = sleepDuration(sleepMinutes(bed.value, wake.value));
            const overnight = (parseTime(bed.value) ?? 0) > (parseTime(wake.value) ?? 0);
            status.textContent = overnight ? 'Sei andato a dormire il giorno precedente al risveglio.' : 'Sonno e risveglio nello stesso giorno.';
        }
        catch (e) {
            result.textContent = '—';
            status.textContent = bed.value && wake.value ? e.message : 'Inserisci gli orari per calcolare la durata.';
        }
    };
    const load = () => {
        const log = st.get('sleepLogs', date.value);
        bed.value = log?.bedtime ?? '';
        wake.value = log?.wakeTime ?? '';
        save.textContent = log ? 'Aggiorna sonno' : 'Salva sonno';
        update();
    };
    const save = button('Salva sonno', () => { }, { type: 'submit', variant: 'primary' });
    const form = h('form', { on: { submit: async (e) => {
                e.preventDefault();
                save.disabled = true;
                try {
                    await ctx.run(() => saveSleep(st, date.value, bed.value, wake.value), 'Sonno salvato', true);
                }
                finally {
                    save.disabled = false;
                }
            } } }, h('div', { class: 'sleep-fields' }, field('Data del risveglio', date), field('Sono andato a dormire alle', bed), field('Mi sono svegliato alle', wake)), result, status, save);
    date.addEventListener('change', load);
    bed.addEventListener('input', update);
    wake.addEventListener('input', update);
    load();
    const logs = st.all('sleepLogs').sort((a, b) => b.date.localeCompare(a.date));
    const recent = logs.filter(l => l.date >= addDays(ctx.today, -6) && l.date <= ctx.today);
    const avg = recent.length ? sleepDuration(recent.reduce((n, l) => n + sleepMinutes(l.bedtime, l.wakeTime), 0) / recent.length) : null;
    return h('section', { class: 'section sleep-card' }, h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, 'Il tuo sonno')), h('p', { class: 'muted small' }, 'Registra ogni giorno i tuoi orari. La durata è calcolata sugli orari indicati.'), form, avg ? h('p', { class: 'sleep-average' }, `Media ultimi 7 giorni: ${avg} · ${recent.length} registrazioni`) : null, h('details', { class: 'sleep-history' }, h('summary', null, `Storico del sonno (${logs.length})`), logs.length ? h('ul', { class: 'sleep-list' }, ...logs.map(log => h('li', null, h('div', null, h('strong', null, fromKey(log.date).toLocaleDateString('it-IT')), h('p', { class: 'muted small' }, `${log.bedtime} → ${log.wakeTime} · ${sleepDuration(sleepMinutes(log.bedtime, log.wakeTime))}`)), h('div', { class: 'sleep-actions' }, button('Modifica', () => { date.value = log.date; load(); date.focus(); form.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, { small: true }), button('Elimina', () => { if (confirm('Eliminare questa registrazione del sonno?'))
        void ctx.run(() => deleteSleep(st, log.date), 'Sonno eliminato', true); }, { small: true, variant: 'quiet' }))))) : h('p', { class: 'muted small' }, 'Nessuna registrazione. Inizia con il tuo ultimo risveglio.')));
}
//# sourceMappingURL=sleep.js.map