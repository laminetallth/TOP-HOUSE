import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayStatus, indexLogs, isScheduledDay, periodStats, ruleFor, streak, weekProgress, withRuleFrom } from '../src/domain/habits.js';
import { defaultHabits, H } from '../src/domain/defaults.js';
import type { Habit, HabitLog } from '../src/domain/types.js';

const NOW = '2026-10-01T08:00:00.000Z';
// Le abitudini partono da lunedì 5 ottobre 2026.
const ALL = defaultHabits('2026-10-05', NOW);
// Audiolibro con la regola lun–ven usata in questi test (l'app parte con "ogni giorno, 30 min").
const AUDIO_WEEKDAYS: Habit = { ...ALL.find((h) => h.id === H.audiobook)!, rules: [{ from: '2026-10-05', schedule: { type: 'days', days: [1, 2, 3, 4, 5] }, dailyTarget: 30, weeklyMinutes: 150 }] };
const get = (id: string): Habit => (id === H.audiobook ? AUDIO_WEEKDAYS : ALL.find((h) => h.id === id)!);
const HABIT_IDS = H;

function log(habitId: string, date: string, value = 1, extra: Partial<HabitLog> = {}): HabitLog {
  return { id: `${habitId}:${date}`, habitId, date, value, createdAt: NOW, updatedAt: NOW, ...extra };
}

test('prima dell\'inizio l\'abitudine non conta (n/a), non "mancata"', () => {
  const h = get(HABIT_IDS.skincare);
  assert.equal(dayStatus(h, '2026-10-01', undefined, '2026-10-10'), 'n/a');
  assert.equal(dayStatus(h, '2026-10-06', undefined, '2026-10-10'), 'missing');
  assert.equal(dayStatus(h, '2026-10-12', undefined, '2026-10-10'), 'future');
});

test('non registrato ≠ saltato ≠ fatto', () => {
  const h = get(HABIT_IDS.skincare);
  const today = '2026-10-10';
  assert.equal(dayStatus(h, '2026-10-08', undefined, today), 'missing');
  assert.equal(dayStatus(h, '2026-10-08', log(h.id, '2026-10-08', 0, { skipped: true }), today), 'skipped');
  assert.equal(dayStatus(h, '2026-10-08', log(h.id, '2026-10-08'), today), 'done');
});

test('audiolibro: previsto lun–ven; 20 min = parziale, 30 min = raggiunto; weekend facoltativo', () => {
  const h = get(HABIT_IDS.audiobook);
  assert.equal(isScheduledDay(h, '2026-10-09'), true);  // venerdì
  assert.equal(isScheduledDay(h, '2026-10-10'), false); // sabato
  const today = '2026-10-11';
  assert.equal(dayStatus(h, '2026-10-06', log(h.id, '2026-10-06', 20), today), 'partial');
  assert.equal(dayStatus(h, '2026-10-06', log(h.id, '2026-10-06', 30), today), 'done');
  assert.equal(dayStatus(h, '2026-10-10', undefined, today), 'optional');
});

test('audiolibro: avanzamento settimanale in minuti (150), anche i minuti del weekend contano', () => {
  const h = get(HABIT_IDS.audiobook);
  const logs = indexLogs([
    log(h.id, '2026-10-05', 30), log(h.id, '2026-10-06', 45), log(h.id, '2026-10-07', 20), log(h.id, '2026-10-10', 60),
  ], h.id);
  const wp = weekProgress(h, logs, '2026-10-08');
  assert.equal(wp.mode, 'minutes');
  assert.equal(wp.done, 155);
  assert.equal(wp.target, 150);
  assert.equal(wp.met, true);
});

test('meditazione: 2 volte a settimana, giorni liberi; nessun giorno risulta "mancato"', () => {
  const h = get(HABIT_IDS.meditation);
  const logs = indexLogs([log(h.id, '2026-10-06'), log(h.id, '2026-10-09')], h.id);
  const wp = weekProgress(h, logs, '2026-10-07');
  assert.deepEqual([wp.mode, wp.done, wp.target, wp.met], ['times', 2, 2, true]);
  assert.equal(dayStatus(h, '2026-10-07', undefined, '2026-10-10'), 'optional');
});

test('palestra: 3 a settimana; la stessa giornata non conta due volte (una registrazione al giorno)', () => {
  const h = get(HABIT_IDS.gym);
  // Due log con lo stesso id per lo stesso giorno: l'indice ne tiene uno solo.
  const logs = indexLogs([log(h.id, '2026-10-05'), log(h.id, '2026-10-05'), log(h.id, '2026-10-07')], h.id);
  const wp = weekProgress(h, logs, '2026-10-05');
  assert.equal(wp.done, 2);
  assert.equal(wp.met, false);
});

test('serie giornaliera: oggi non ancora registrato non interrompe; un giorno mancato sì', () => {
  const h = get(HABIT_IDS.skincare);
  const logs = indexLogs(['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09', '2026-10-10'].map((d) => log(h.id, d)), h.id);
  const s = streak(h, logs, '2026-10-11');
  assert.equal(s.current, 3);
  assert.equal(s.best, 3);
});

test('serie lun–ven: il weekend non interrompe la serie', () => {
  const h = get(HABIT_IDS.audiobook);
  const days = ['2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13'];
  const logs = indexLogs(days.map((d) => log(h.id, d, 30)), h.id);
  assert.equal(streak(h, logs, '2026-10-13').current, 4);
});

test('serie settimanale: settimana in corso conta solo se già raggiunta', () => {
  const h = get(HABIT_IDS.meditation);
  const logs = indexLogs(['2026-10-05', '2026-10-07', '2026-10-13', '2026-10-15', '2026-10-20'].map((d) => log(h.id, d)), h.id);
  // Settimane 5–11 e 12–18 raggiunte; 19–25 in corso con 1/2.
  const s = streak(h, logs, '2026-10-21');
  assert.equal(s.unit, 'settimane');
  assert.equal(s.current, 2);
});

test('pause e giorni di riposo: non interrompono la serie e non contano come mancati', () => {
  const h: Habit = { ...get(HABIT_IDS.skincare), pauses: [{ from: '2026-10-07', to: '2026-10-08' }] };
  const logs = indexLogs(['2026-10-05', '2026-10-06', '2026-10-09'].map((d) => log(h.id, d)), h.id);
  assert.equal(dayStatus(h, '2026-10-07', undefined, '2026-10-10'), 'n/a');
  assert.equal(streak(h, logs, '2026-10-10').current, 3);
  const rest = streak(get(HABIT_IDS.skincare), logs, '2026-10-10', ['2026-10-07', '2026-10-08']);
  assert.equal(rest.current, 3);
});

test('statistiche di periodo: oggi non registrato escluso, solo giorni previsti', () => {
  const h = get(HABIT_IDS.audiobook);
  const logs = indexLogs([log(h.id, '2026-10-05', 30), log(h.id, '2026-10-06', 10), log(h.id, '2026-10-07', 0, { skipped: true })], h.id);
  const st = periodStats(h, logs, '2026-10-05', '2026-10-11', '2026-10-08');
  // previsti fino a oggi: 5,6,7 (oggi 8 non registrato escluso)
  assert.equal(st.counted, 3);
  assert.equal(st.done, 1);
  assert.equal(st.skipped, 1);
  assert.equal(st.missing, 1);
});

test('statistiche settimanali: settimana in corso non raggiunta esclusa', () => {
  const h = get(HABIT_IDS.gym);
  const logs = indexLogs(['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-13'].map((d) => log(h.id, d)), h.id);
  const st = periodStats(h, logs, '2026-10-01', '2026-10-31', '2026-10-14');
  assert.equal(st.unit, 'settimane');
  assert.equal(st.counted, 1);
  assert.equal(st.done, 1);
});

test('modifica futura delle regole: lo storico passato resta valutato con la regola vecchia', () => {
  const h0 = get(HABIT_IDS.audiobook);
  const h1 = withRuleFrom(h0, { from: '2026-10-12', schedule: { type: 'daily' }, dailyTarget: 20 });
  assert.equal(ruleFor(h1, '2026-10-09')!.dailyTarget, 30);
  assert.equal(ruleFor(h1, '2026-10-12')!.dailyTarget, 20);
  assert.equal(isScheduledDay(h1, '2026-10-10'), false); // sabato passato: regola vecchia
  assert.equal(isScheduledDay(h1, '2026-10-17'), true);  // sabato futuro: regola nuova
  assert.equal(dayStatus(h1, '2026-10-06', log(h1.id, '2026-10-06', 25), '2026-10-20'), 'partial');
  assert.equal(dayStatus(h1, '2026-10-13', log(h1.id, '2026-10-13', 25), '2026-10-20'), 'done');
});

test('giorni alterni: previsto ogni 2 giorni dalla data di partenza', async () => {
  const { isScheduledDay } = await import('../src/domain/habits.js');
  const h = { ...ALL.find((x) => x.id === H.momMeds)!, rules: [{ from: '2026-10-05', schedule: { type: 'interval' as const, every: 2, anchor: '2026-10-06' } }] };
  assert.deepEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-10'].map((d) => isScheduledDay(h, d)), [false, true, false, true, true]);
});
