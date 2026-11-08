import { newId } from './store.js';
import { ActionError } from './actions.js';
import { basketWeekId, validateExercises, validateGame } from '../domain/sport.js';
import { validateRating } from '../domain/daily.js';
import { isDateKey, weekStart } from '../domain/dates.js';
import { H } from '../domain/defaults.js';
import { logId } from '../domain/habits.js';
function must(cond, msg) {
    if (!cond)
        throw new ActionError(msg);
}
const ZERO = { minutes: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 0, ast: 0, tov: 0 };
const clean = (s) => s?.trim() || undefined;
// ─── Partite ─────────────────────────────────────────────────────────────────
export async function saveGame(store, input, id) {
    const err = validateGame({ ...input, scheduled: undefined }, store.today());
    must(!err, err ?? '');
    const now = store.nowIso();
    const prev = id ? store.get('basketGames', id) : undefined;
    if (id)
        must(prev && !prev.deletedAt, 'Partita non trovata.');
    const g = { ...input, scheduled: undefined, opponent: input.opponent.trim(), note: clean(input.note), id: prev?.id ?? newId('bg-'), createdAt: prev?.createdAt ?? now, updatedAt: now };
    await store.apply([{ table: 'basketGames', value: g }], [{ entity: 'basketGame', entityId: g.id, type: prev ? 'edited' : 'created', data: { opponent: g.opponent, date: g.date } }], prev ? 'Partita modificata' : 'Partita registrata');
    return g;
}
/** Partita in programma: compare nel calendario del basket e in quello generale. */
export async function scheduleGame(store, input, id) {
    must(isDateKey(input.date), 'Data non valida.');
    must(input.opponent.trim().length > 0 && input.opponent.trim().length <= 60, 'Indica l\'avversario.');
    const now = store.nowIso();
    const prev = id ? store.get('basketGames', id) : undefined;
    const g = { ...ZERO, ...(prev ?? {}), id: prev?.id ?? newId('bg-'), date: input.date, opponent: input.opponent.trim(), time: input.time || undefined, place: clean(input.place), note: clean(input.note), scheduled: true, createdAt: prev?.createdAt ?? now, updatedAt: now };
    await store.apply([{ table: 'basketGames', value: g }], [{ entity: 'basketGame', entityId: g.id, type: 'scheduled', data: { opponent: g.opponent, date: g.date } }], 'Partita in programma');
    return g;
}
export async function deleteGame(store, id) {
    const g = store.get('basketGames', id);
    must(g && !g.deletedAt, 'Partita non trovata.');
    await store.apply([{ table: 'basketGames', value: { ...g, deletedAt: store.nowIso() } }], [{ entity: 'basketGame', entityId: id, type: 'deleted' }], 'Partita eliminata');
}
// ─── Settimana di basket ─────────────────────────────────────────────────────
function week(store, day) {
    const id = basketWeekId(day);
    return store.get('basketWeeks', id) ?? { id, weekStart: weekStart(day), updatedAt: '' };
}
export async function setBasketFocus(store, day, focus) {
    must(isDateKey(day), 'Data non valida.');
    const f = focus.trim();
    must(f.length <= 200, 'Focus troppo lungo (massimo 200 caratteri).');
    const w = week(store, day);
    await store.apply([{ table: 'basketWeeks', value: { ...w, focus: f || undefined, updatedAt: store.nowIso() } }], [{ entity: 'basketWeek', entityId: w.id, type: 'focus', data: { focus: f } }], 'Focus aggiornato');
}
/** Valutazione di una settimana conclusa (si fa il lunedì successivo). */
export async function reviewBasketWeek(store, weekDay, value, note) {
    must(isDateKey(weekDay), 'Data non valida.');
    must(weekStart(weekDay) < weekStart(store.today()), 'Si valuta solo una settimana conclusa.');
    const err = validateRating(value);
    must(!err, err ?? '');
    const w = week(store, weekDay);
    await store.apply([{ table: 'basketWeeks', value: { ...w, review: value, reviewNote: clean(note), updatedAt: store.nowIso() } }], [{ entity: 'basketWeek', entityId: w.id, type: 'review', data: { value } }], 'Settimana valutata');
}
/**
 * Salva il dettaglio della sessione e, nella stessa operazione, registra la presenza
 * nell'abitudine "Palestra" (una per giorno): l'obiettivo delle 3 volte resta calcolato in un solo posto.
 */
export async function saveGymSession(store, date, input) {
    must(isDateKey(date), 'Data non valida.');
    must(date <= store.today(), 'Non si possono registrare sessioni future.');
    const exercises = input.exercises.map((e) => ({ name: e.name.trim(), sets: e.sets.map((s) => ({ reps: s.reps, kg: s.kg })) })).filter((e) => e.name || e.sets.length);
    const err = validateExercises(exercises);
    must(!err, err ?? '');
    if (input.duration !== undefined)
        must(Number.isInteger(input.duration) && input.duration > 0 && input.duration <= 600, 'Durata da 1 a 600 minuti.');
    if (input.rating !== undefined)
        must(!validateRating(input.rating), 'Il voto va da 1 a 10.');
    const now = store.nowIso();
    const s = { id: `gym:${date}`, date, workout: clean(input.workout), planDayId: input.planDayId, duration: input.duration, rating: input.rating, exercises, note: clean(input.note), updatedAt: now };
    const lid = logId(H.gym, date);
    const prevLog = store.get('habitLogs', lid);
    const log = { id: lid, habitId: H.gym, date, value: 1, createdAt: prevLog?.createdAt ?? now, updatedAt: now, duration: s.duration, rating: s.rating, note: s.workout };
    const changes = [{ table: 'gymSessions', value: s }, { table: 'habitLogs', value: log }];
    await store.apply(changes, [{ entity: 'gymSession', entityId: s.id, type: 'saved', data: { date, esercizi: exercises.length } }], 'Sessione di palestra salvata');
    return s;
}
/** Elimina dettaglio e presenza di quel giorno insieme (annullabile). */
export async function deleteGymSession(store, date) {
    const id = `gym:${date}`;
    const changes = [];
    if (store.get('gymSessions', id))
        changes.push({ table: 'gymSessions', remove: id });
    const lid = logId(H.gym, date);
    if (store.get('habitLogs', lid))
        changes.push({ table: 'habitLogs', remove: lid });
    if (!changes.length)
        return;
    await store.apply(changes, [{ entity: 'gymSession', entityId: id, type: 'deleted', data: { date } }], 'Sessione eliminata');
}
// ─── Scheda ──────────────────────────────────────────────────────────────────
export function activePlan(store) {
    return store.all('gymPlans').find((p) => p.active);
}
function validatePlanDays(days) {
    if (!days.length)
        return 'Aggiungi almeno un giorno alla scheda.';
    for (const d of days) {
        if (!d.name.trim())
            return 'Ogni giorno della scheda ha bisogno di un nome.';
        for (const e of d.exercises) {
            if (!e.name.trim())
                return `${d.name}: un esercizio senza nome.`;
            if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 20)
                return `${e.name}: serie da 1 a 20.`;
            if (!e.reps.trim())
                return `${e.name}: indica le ripetizioni (es. 8-10).`;
        }
    }
    return null;
}
/** Salva la scheda attiva. Una scheda nuova archivia la precedente (che resta consultabile). */
export async function savePlan(store, name, days, asNew = false) {
    const cleanDays = days.map((d) => ({ id: d.id || newId('pd-'), name: d.name.trim(), exercises: d.exercises.map((e) => ({ name: e.name.trim(), sets: e.sets, reps: e.reps.trim(), rest: clean(e.rest), note: clean(e.note) })).filter((e) => e.name) }));
    const err = validatePlanDays(cleanDays);
    must(!err, err ?? '');
    const now = store.nowIso();
    const cur = activePlan(store);
    const changes = [];
    let plan;
    if (cur && !asNew)
        plan = { ...cur, name: name.trim() || cur.name, days: cleanDays, updatedAt: now };
    else {
        if (cur)
            changes.push({ table: 'gymPlans', value: { ...cur, active: false, updatedAt: now } });
        plan = { id: newId('gp-'), name: name.trim() || 'La mia scheda', days: cleanDays, active: true, createdAt: now, updatedAt: now };
    }
    changes.push({ table: 'gymPlans', value: plan });
    await store.apply(changes, [{ entity: 'gymPlan', entityId: plan.id, type: cur && !asNew ? 'edited' : 'created' }], 'Scheda salvata');
    return plan;
}
//# sourceMappingURL=sportActions.js.map