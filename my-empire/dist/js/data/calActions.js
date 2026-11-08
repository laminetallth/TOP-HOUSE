import { newId } from './store.js';
import { must } from './actions.js';
import { occursOn, validateEvent } from '../domain/calendar.js';
function ev(store, id) {
    const e = store.get('calEvents', id);
    must(e && !e.deletedAt, 'Evento non trovato.');
    return e;
}
function clean(i) {
    return { ...i, title: i.title.trim(), location: i.location?.trim() || undefined, note: i.note?.trim() || undefined, start: i.start || undefined, end: i.start ? i.end || undefined : undefined };
}
export async function addEvent(store, input) {
    const i = clean(input);
    const err = validateEvent(i);
    must(!err, err ?? '');
    const now = store.nowIso();
    const e = { ...i, id: newId('e-'), doneDates: [], skipDates: [], createdAt: now, updatedAt: now };
    await store.apply([{ table: 'calEvents', value: e }], [{ entity: 'event', entityId: e.id, type: 'created', data: { title: e.title, date: e.date } }], 'Evento creato');
    return e;
}
export async function updateEvent(store, id, input) {
    const prev = ev(store, id);
    const i = clean(input);
    const err = validateEvent(i);
    must(!err, err ?? '');
    await store.apply([{ table: 'calEvents', value: { ...prev, ...i, updatedAt: store.nowIso() } }], [{ entity: 'event', entityId: id, type: 'edited' }], 'Evento modificato');
}
/** Elimina tutto l'evento (con le ripetizioni) oppure solo un'occorrenza. */
export async function deleteEvent(store, id, onlyDate) {
    const e = ev(store, id);
    if (onlyDate && e.repeat.type !== 'none') {
        await store.apply([{ table: 'calEvents', value: { ...e, skipDates: [...e.skipDates, onlyDate], updatedAt: store.nowIso() } }], [{ entity: 'event', entityId: id, type: 'occurrence_deleted', data: { date: onlyDate } }], 'Occorrenza eliminata');
        return;
    }
    await store.apply([{ table: 'calEvents', value: { ...e, deletedAt: store.nowIso() } }], [{ entity: 'event', entityId: id, type: 'deleted' }], 'Evento eliminato');
}
/** Spunta (o toglie la spunta) a un promemoria in una data. */
export async function toggleEventDone(store, id, date) {
    const e = ev(store, id);
    must(occursOn(e, date), 'L\'evento non è previsto in questa data.');
    const done = e.doneDates.includes(date);
    const doneDates = done ? e.doneDates.filter((d) => d !== date) : [...e.doneDates, date];
    await store.apply([{ table: 'calEvents', value: { ...e, doneDates, updatedAt: store.nowIso() } }], [{ entity: 'event', entityId: id, type: done ? 'undone' : 'done', data: { date } }], done ? 'Spunta tolta' : 'Fatto');
    return !done;
}
//# sourceMappingURL=calActions.js.map