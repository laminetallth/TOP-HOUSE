import { Store, newId } from './store.js';
import { must } from './actions.js';
import { occursOn, validateEvent, type EventInput } from '../domain/calendar.js';
import type { DateKey } from '../domain/dates.js';
import type { CalEvent } from '../domain/types.js';

function ev(store: Store, id: string): CalEvent {
  const e = store.get('calEvents', id);
  must(e && !e.deletedAt, 'Evento non trovato.');
  return e;
}

function clean(i: EventInput): EventInput {
  return { ...i, title: i.title.trim(), location: i.location?.trim() || undefined, note: i.note?.trim() || undefined, start: i.start || undefined, end: i.start ? i.end || undefined : undefined };
}

export async function addEvent(store: Store, input: EventInput): Promise<CalEvent> {
  const i = clean(input);
  const err = validateEvent(i);
  must(!err, err ?? '');
  const now = store.nowIso();
  const e: CalEvent = { ...i, id: newId('e-'), doneDates: [], skipDates: [], createdAt: now, updatedAt: now };
  await store.apply([{ table: 'calEvents', value: e }], [{ entity: 'event', entityId: e.id, type: 'created', data: { title: e.title, date: e.date } }], 'Evento creato');
  return e;
}

export async function updateEvent(store: Store, id: string, input: EventInput): Promise<void> {
  const prev = ev(store, id);
  const i = clean(input);
  const err = validateEvent(i);
  must(!err, err ?? '');
  await store.apply([{ table: 'calEvents', value: { ...prev, ...i, updatedAt: store.nowIso() } }], [{ entity: 'event', entityId: id, type: 'edited' }], 'Evento modificato');
}

/** Elimina tutto l'evento (con le ripetizioni) oppure solo un'occorrenza. */
export async function deleteEvent(store: Store, id: string, onlyDate?: DateKey): Promise<void> {
  const e = ev(store, id);
  if (onlyDate && e.repeat.type !== 'none') {
    await store.apply([{ table: 'calEvents', value: { ...e, skipDates: [...e.skipDates, onlyDate], updatedAt: store.nowIso() } }], [{ entity: 'event', entityId: id, type: 'occurrence_deleted', data: { date: onlyDate } }], 'Occorrenza eliminata');
    return;
  }
  await store.apply([{ table: 'calEvents', value: { ...e, deletedAt: store.nowIso() } }], [{ entity: 'event', entityId: id, type: 'deleted' }], 'Evento eliminato');
}

/** Spunta (o toglie la spunta) a un promemoria in una data. */
export async function toggleEventDone(store: Store, id: string, date: DateKey): Promise<boolean> {
  const e = ev(store, id);
  must(occursOn(e, date), 'L\'evento non è previsto in questa data.');
  const done = e.doneDates.includes(date);
  const doneDates = done ? e.doneDates.filter((d) => d !== date) : [...e.doneDates, date];
  await store.apply([{ table: 'calEvents', value: { ...e, doneDates, updatedAt: store.nowIso() } }], [{ entity: 'event', entityId: id, type: done ? 'undone' : 'done', data: { date } }], done ? 'Spunta tolta' : 'Fatto');
  return !done;
}
