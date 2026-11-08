/**
 * Azioni dell'app: l'unico posto in cui la logica incontra l'archivio.
 * Ogni modifica registra lo storico ed è annullabile.
 */
import { Store, newId } from './store.js';
import { logId, withRuleFrom } from '../domain/habits.js';
import { validateMinutes, validateRating } from '../domain/daily.js';
import { isDateKey, parseTime, type DateKey } from '../domain/dates.js';
import type { Habit, HabitArea, HabitLog, HabitRule, RatingKind, Settings, WeekNote } from '../domain/types.js';

export class ActionError extends Error {}

export function must(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new ActionError(msg);
}

// ─── Attività ────────────────────────────────────────────────────────────────

function habit(store: Store, id: string): Habit {
  const h = store.get('habits', id);
  must(h, 'Attività non trovata.');
  return h;
}

function checkDay(store: Store, date: DateKey): void {
  must(isDateKey(date), 'Data non valida.');
  must(date <= store.today(), 'Non si possono registrare giorni futuri.');
}

export interface LogExtras {
  note?: string;
  duration?: number;
  rating?: number;
}

/** Registra un'abitudine "fatto" (una sola registrazione al giorno: chiave habitId:data). */
export async function markHabitDone(store: Store, habitId: string, date: DateKey, extras: LogExtras = {}): Promise<void> {
  const h = habit(store, habitId);
  checkDay(store, date);
  must(h.kind === 'check', 'Usa la registrazione dei minuti.');
  if (extras.duration !== undefined) must(!validateMinutes(extras.duration), 'Durata non valida.');
  if (extras.rating !== undefined) must(!validateRating(extras.rating), 'Il voto va da 1 a 10.');
  const id = logId(habitId, date);
  const prev = store.get('habitLogs', id);
  const now = store.nowIso();
  const log: HabitLog = {
    id, habitId, date, value: 1, createdAt: prev?.createdAt ?? now, updatedAt: now,
    note: extras.note?.trim() || undefined, duration: extras.duration, rating: extras.rating,
  };
  await store.apply([{ table: 'habitLogs', value: log }], [{ entity: 'habitLog', entityId: id, type: prev ? 'updated' : 'logged', data: { habit: h.name, date } }], `${h.name} registrata`);
}

/** Imposta i minuti totali del giorno (sostituisce, non somma). */
export async function setHabitMinutes(store: Store, habitId: string, date: DateKey, minutes: number, note?: string): Promise<void> {
  const h = habit(store, habitId);
  checkDay(store, date);
  must(h.kind !== 'check', 'Questa abitudine si registra con "Fatto".');
  const err = h.kind === 'count' ? validateCount(minutes) : validateMinutes(minutes);
  must(!err, err ?? '');
  const id = logId(habitId, date);
  const prev = store.get('habitLogs', id);
  const now = store.nowIso();
  if (minutes === 0) {
    if (prev) await store.apply([{ table: 'habitLogs', remove: id }], [{ entity: 'habitLog', entityId: id, type: 'cleared', data: { habit: h.name, date } }], `${h.name}: registrazione rimossa`);
    return;
  }
  const log: HabitLog = { id, habitId, date, value: Math.round(minutes), createdAt: prev?.createdAt ?? now, updatedAt: now, note: note?.trim() || prev?.note };
  await store.apply([{ table: 'habitLogs', value: log }], [{ entity: 'habitLog', entityId: id, type: 'minutes', data: { habit: h.name, date, from: prev?.value ?? 0, to: log.value } }], `${h.name}: minuti aggiornati`);
}

function validateCount(n: number): string | null {
  if (!Number.isInteger(n) || n < 0) return 'Inserisci un numero intero, zero o più.';
  if (n > 100000) return 'Numero troppo alto.';
  return null;
}

/** Alias leggibile: imposta la quantità del giorno (minuti o conteggio). */
export const setHabitAmount = (store: Store, habitId: string, date: DateKey, value: number, note?: string): Promise<void> => setHabitMinutes(store, habitId, date, value, note);

export async function addHabitMinutes(store: Store, habitId: string, date: DateKey, minutes: number): Promise<void> {
  const prev = store.get('habitLogs', logId(habitId, date));
  const base = prev && !prev.skipped ? prev.value : 0;
  await setHabitMinutes(store, habitId, date, base + minutes);
}

/** "Salta": registra esplicitamente che oggi non si fa (≠ dimenticato). */
export async function skipHabit(store: Store, habitId: string, date: DateKey, note?: string): Promise<void> {
  const h = habit(store, habitId);
  checkDay(store, date);
  const id = logId(habitId, date);
  const prev = store.get('habitLogs', id);
  const now = store.nowIso();
  const log: HabitLog = { id, habitId, date, value: 0, skipped: true, createdAt: prev?.createdAt ?? now, updatedAt: now, note: note?.trim() || undefined };
  await store.apply([{ table: 'habitLogs', value: log }], [{ entity: 'habitLog', entityId: id, type: 'skipped', data: { habit: h.name, date } }], `${h.name} saltata`);
}

export async function clearHabitLog(store: Store, habitId: string, date: DateKey): Promise<void> {
  const h = habit(store, habitId);
  const id = logId(habitId, date);
  if (!store.get('habitLogs', id)) return;
  await store.apply([{ table: 'habitLogs', remove: id }], [{ entity: 'habitLog', entityId: id, type: 'cleared', data: { habit: h.name, date } }], `${h.name}: registrazione rimossa`);
}

/** Cambia frequenza/obiettivi da oggi in poi: lo storico resta valutato con le regole di allora. */
export async function updateHabitRule(store: Store, habitId: string, rule: Omit<HabitRule, 'from'>): Promise<void> {
  const h = habit(store, habitId);
  if (rule.schedule.type === 'weekly') must(rule.schedule.timesPerWeek >= 1 && rule.schedule.timesPerWeek <= 7, 'Da 1 a 7 volte a settimana.');
  if (rule.schedule.type === 'days') must(rule.schedule.days.length > 0, 'Scegli almeno un giorno.');
  if (rule.dailyTarget !== undefined) must(rule.dailyTarget > 0 && rule.dailyTarget <= 1440, 'Obiettivo giornaliero non valido.');
  const next = withRuleFrom(h, { ...rule, from: store.today() });
  await store.apply([{ table: 'habits', value: next }], [{ entity: 'habit', entityId: habitId, type: 'rule_changed', data: { from: store.today(), rule } }], 'Modifica abitudine');
}

export async function renameHabit(store: Store, habitId: string, name: string): Promise<void> {
  const n = name.trim();
  must(n.length > 0 && n.length <= 60, 'Nome non valido.');
  const h = habit(store, habitId);
  await store.apply([{ table: 'habits', value: { ...h, name: n } }], [{ entity: 'habit', entityId: habitId, type: 'renamed', data: { from: h.name, to: n } }], 'Modifica abitudine');
}

export interface NewHabitInput {
  name: string;
  kind: 'check' | 'minutes' | 'count';
  schedule: HabitRule['schedule'];
  dailyTarget?: number;
  icon?: string;
  area?: HabitArea;
  reminder?: string;
  unit?: string;
}

export async function addHabit(store: Store, input: NewHabitInput): Promise<Habit> {
  const name = input.name.trim();
  must(name.length > 0 && name.length <= 60, 'Nome non valido.');
  const order = store.all('habits').reduce((m, h) => Math.max(m, h.order), -1) + 1;
  const h: Habit = {
    id: newId('h-'), name, icon: input.icon ?? (input.kind === 'minutes' ? 'clock' : 'check'), kind: input.kind, area: input.area ?? 'altro', reminder: input.reminder, unit: input.unit,
    rules: [{ from: store.today(), schedule: input.schedule, dailyTarget: input.dailyTarget }],
    pauses: [], createdAt: store.nowIso(), order,
  };
  await store.apply([{ table: 'habits', value: h }], [{ entity: 'habit', entityId: h.id, type: 'created', data: { name } }], 'Nuova abitudine');
  return h;
}

export async function addHabitPause(store: Store, habitId: string, from: DateKey, to: DateKey, reason?: string): Promise<void> {
  must(isDateKey(from) && isDateKey(to) && from <= to, 'Intervallo non valido.');
  const h = habit(store, habitId);
  await store.apply([{ table: 'habits', value: { ...h, pauses: [...h.pauses, { from, to, reason: reason?.trim() || undefined }] } }], [{ entity: 'habit', entityId: habitId, type: 'paused', data: { from, to } }], 'Pausa programmata');
}

export async function removeHabitPause(store: Store, habitId: string, index: number): Promise<void> {
  const h = habit(store, habitId);
  await store.apply([{ table: 'habits', value: { ...h, pauses: h.pauses.filter((_, i) => i !== index) } }], [{ entity: 'habit', entityId: habitId, type: 'pause_removed' }], 'Pausa rimossa');
}

export async function archiveHabit(store: Store, habitId: string, archived: boolean): Promise<void> {
  const h = habit(store, habitId);
  const next: Habit = { ...h, archivedAt: archived ? store.nowIso() : undefined };
  await store.apply([{ table: 'habits', value: next }], [{ entity: 'habit', entityId: habitId, type: archived ? 'archived' : 'unarchived' }], archived ? 'Abitudine archiviata' : 'Abitudine ripristinata');
}

// ─── Registrazioni giornaliere ───────────────────────────────────────────────

export async function setRating(store: Store, kind: RatingKind, date: DateKey, value: number, note?: string): Promise<void> {
  checkDay(store, date);
  const err = validateRating(value);
  must(!err, err ?? '');
  const id = `${kind}:${date}`;
  await store.apply([{ table: 'ratings', value: { id, kind, date, value, note: note?.trim() || undefined, updatedAt: store.nowIso() } }], [{ entity: 'rating', entityId: id, type: 'set', data: { kind, date, value } }], 'Valutazione salvata');
}

export async function clearRating(store: Store, kind: RatingKind, date: DateKey): Promise<void> {
  const id = `${kind}:${date}`;
  if (!store.get('ratings', id)) return;
  await store.apply([{ table: 'ratings', remove: id }], [{ entity: 'rating', entityId: id, type: 'cleared' }], 'Valutazione rimossa');
}

// ─── Impostazioni ────────────────────────────────────────────────────────────

export async function updateSettings(store: Store, patch: Partial<Omit<Settings, 'id' | 'schemaVersion' | 'createdAt'>>): Promise<void> {
  const s = store.settings();
  if (patch.name !== undefined) must(patch.name.trim().length <= 40, 'Nome troppo lungo.');
  const next: Settings = { ...s, ...patch, name: (patch.name ?? s.name).trim() };
  await store.apply([{ table: 'settings', value: next }], [{ entity: 'settings', entityId: 'settings', type: 'updated', data: { keys: Object.keys(patch) } }], 'Impostazioni');
}

/** Orario del promemoria ("HH:MM" oppure vuoto per toglierlo). */
export async function setHabitReminder(store: Store, habitId: string, time: string | undefined): Promise<void> {
  const h = habit(store, habitId);
  if (time) must(parseTime(time) !== null, 'Orario non valido.');
  await store.apply([{ table: 'habits', value: { ...h, reminder: time || undefined } }], [{ entity: 'habit', entityId: habitId, type: 'reminder', data: { time: time ?? null } }], 'Promemoria aggiornato');
}

export async function setHabitTodoDone(store: Store, habitId: string): Promise<void> {
  const h = habit(store, habitId);
  if (!h.todo) return;
  const { todo: _t, ...rest } = h;
  await store.apply([{ table: 'habits', value: rest as Habit }], []);
}

/** Elimina un'attività creata da te e le sue registrazioni (annullabile subito dopo). */
export async function deleteHabit(store: Store, habitId: string): Promise<void> {
  const h = habit(store, habitId);
  must(!h.system, 'Le attività iniziali non si eliminano: puoi archiviarle.');
  const logs = store.all('habitLogs').filter((l) => l.habitId === habitId);
  await store.apply([{ table: 'habits', remove: habitId }, ...logs.map((l) => ({ table: 'habitLogs' as const, remove: l.id }))], [{ entity: 'habit', entityId: habitId, type: 'deleted', data: { name: h.name } }], 'Attività eliminata');
}

// ─── Report settimanale ──────────────────────────────────────────────────────

export async function saveWeekNote(store: Store, weekStart: DateKey, note: Pick<WeekNote, 'best' | 'obstacle' | 'next'>): Promise<void> {
  must(isDateKey(weekStart), 'Data non valida.');
  const id = `wn:${weekStart}`;
  const clean = (s?: string): string | undefined => s?.trim().slice(0, 500) || undefined;
  await store.apply([{ table: 'weekNotes', value: { id, weekStart, best: clean(note.best), obstacle: clean(note.obstacle), next: clean(note.next), updatedAt: store.nowIso() } }], [{ entity: 'weekNote', entityId: id, type: 'saved' }], 'Revisione salvata');
}
