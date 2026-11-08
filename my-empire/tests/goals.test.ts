import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoGranularity, checkpointDates, createGoal, currentValue, goalProgress, isGoalOverdue, isReached, observedPace,
  planCheckpoints, planNotes, projectAt, requiredPace, validateGoal, validatePlan,
} from '../src/domain/goals.js';
import type { GoalEntry } from '../src/domain/types.js';

const NOW = '2026-10-24T08:00:00.000Z';
const TODAY = '2026-10-24';
const e = (date: string, value: number, goalId = 'g'): GoalEntry => ({ id: `${goalId}:${date}`, goalId, date, value, updatedAt: NOW });

test('validazione: titolo, date in ordine, partenza diversa dall\'obiettivo', () => {
  assert.ok(validateGoal({ title: '' }).title);
  assert.ok(validateGoal({ title: 'x', startDate: '2026-10-24', dueDate: '2026-10-01' }).dueDate);
  assert.ok(validateGoal({ title: 'x', baseline: 5 }).baseline);
  assert.ok(validateGoal({ title: 'x', baseline: 5, target: 5 }).target);
  assert.deepEqual(validateGoal({ title: 'Peso', baseline: 86.5, target: 83, unit: 'kg' }), {});
  assert.deepEqual(validateGoal({ title: 'Qualitativo' }), {});
});

test('valore attuale = ultima misurazione per data, non la somma', () => {
  const list = [e('2026-10-01', 10), e('2026-10-20', 14), e('2026-10-10', 12), e('2026-10-25', 99, 'altro')];
  assert.equal(currentValue(list, 'g')!.value, 14);
  assert.equal(currentValue([], 'g'), null);
});

test('avanzamento: crescente, decrescente, senza dati', () => {
  assert.equal(goalProgress({ target: 50 }, 20), 0.4);
  assert.equal(goalProgress({ baseline: 10, target: 50 }, 30), 0.5);
  assert.equal(goalProgress({ baseline: 86.5, target: 83 }, 84.75), 0.5);
  assert.equal(goalProgress({ baseline: 86.5, target: 83 }, 88), 0, 'peggioramento: limitato a 0');
  assert.equal(goalProgress({ target: 50 }, 70), 1);
  assert.equal(goalProgress({ target: 50 }, null), null, 'non registrato ≠ 0%');
  assert.equal(goalProgress({}, 10), null);
  assert.equal(isReached({ baseline: 86.5, target: 83 }, 82.9), true);
  assert.equal(isReached({ target: 50 }, 49), false);
});

test('scaduto solo se attivo e scadenza passata', () => {
  const g = createGoal({ title: 'x', target: 1, dueDate: '2026-10-20', startDate: '2026-10-01' }, 'g', NOW, TODAY, 0);
  assert.equal(isGoalOverdue(g, TODAY), true);
  assert.equal(isGoalOverdue({ ...g, status: 'achieved' }, TODAY), false);
});

test('ritmo richiesto: da valore attuale (o partenza) alla scadenza', () => {
  const g = createGoal({ title: 'v', target: 50, dueDate: '2027-04-22' }, 'g', NOW, TODAY, 0);
  const r = requiredPace(g, 14, TODAY)!;
  assert.equal(r.daysLeft, 180);
  assert.equal(r.remaining, 36);
  assert.equal(r.perDay, 0.2);
  assert.equal(requiredPace({ ...g, dueDate: '2026-10-24' }, 14, TODAY), null);
});

test('ritmo osservato e proiezione: servono due misurazioni in giorni diversi', () => {
  assert.equal(observedPace([e('2026-10-01', 10)]), null);
  const list = [e('2026-10-01', 10), e('2026-10-11', 15)];
  const p = observedPace(list)!;
  assert.equal(p.perDay, 0.5);
  assert.equal(projectAt(list, '2026-10-21'), 20);
});

test('pianificazione inversa: 50 venditori entro il 22/4/2027, tappe mensili', () => {
  assert.equal(autoGranularity(TODAY, '2027-04-22'), 'monthly');
  const steps = planCheckpoints({ start: TODAY, due: '2027-04-22', base: 0, target: 50, granularity: 'monthly', curve: 'linear' });
  // il 31 ottobre è a 7 giorni dall'inizio: troppo vicino, non diventa una tappa
  assert.deepEqual(steps.map((s) => s.date), ['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-22']);
  assert.equal(steps[0].value, 10);
  assert.equal(steps.at(-1)!.value, 50);
  assert.ok(steps.every((s, i) => i === 0 || s.value >= steps[i - 1].value));
  assert.ok(steps.every((s) => Number.isInteger(s.value)), 'obiettivo intero → tappe intere');
  assert.equal(validatePlan(steps, { start: TODAY, due: '2027-04-22', base: 0, target: 50 }), null);
});

test('curva in accelerazione: parte più piano della lineare, stesso arrivo', () => {
  const p = { start: TODAY, due: '2027-04-22', base: 0, target: 400, granularity: 'monthly' as const };
  const lin = planCheckpoints({ ...p, curve: 'linear' });
  const acc = planCheckpoints({ ...p, curve: 'accelerating' });
  assert.ok(acc[0].value < lin[0].value);
  assert.equal(acc.at(-1)!.value, 400);
});

test('obiettivo in discesa con decimali (peso)', () => {
  const steps = planCheckpoints({ start: '2026-10-24', due: '2027-01-31', base: 86.5, target: 83, granularity: 'monthly', curve: 'linear' });
  assert.ok(steps.every((s, i) => i === 0 || s.value <= steps[i - 1].value));
  assert.equal(steps.at(-1)!.value, 83);
  assert.ok(steps.some((s) => !Number.isInteger(s.value)));
});

test('orizzonti lunghi: tappe annuali; troppe tappe settimanali → granularità più ampia', () => {
  assert.equal(autoGranularity(TODAY, '2036-04-30'), 'annual');
  const yearly = checkpointDates(TODAY, '2036-04-30', 'annual');
  assert.equal(yearly[0], '2027-12-31', 'il 31/12/2026 è a 68 giorni: troppo vicino per una tappa annuale');
  assert.equal(yearly.at(-1), '2036-04-30');
  const forced = planCheckpoints({ start: TODAY, due: '2036-04-30', base: 0, target: 20, granularity: 'weekly', curve: 'linear' });
  assert.ok(forced.length <= 60);
});

test('tappe trimestrali e settimanali sulle date di fine periodo', () => {
  assert.deepEqual(checkpointDates('2026-10-24', '2027-06-15', 'quarterly'), ['2026-12-31', '2027-03-31', '2027-06-15']);
  assert.deepEqual(checkpointDates('2026-10-24', '2026-11-10', 'weekly'), ['2026-11-01', '2026-11-08', '2026-11-10']); // la domenica 25/10 è a un giorno dall'inizio
});

test('validazione delle tappe modificate a mano', () => {
  const p = { start: TODAY, due: '2027-04-22', base: 0, target: 50 };
  assert.ok(validatePlan([], p));
  assert.ok(validatePlan([{ date: '2026-12-01', value: 20 }, { date: '2026-11-01', value: 30 }], p));
  assert.ok(validatePlan([{ date: '2026-12-01', value: 20 }, { date: '2027-01-01', value: 10 }], p));
  assert.ok(validatePlan([{ date: '2027-05-01', value: 50 }], p));
});

test('ipotesi e rischi: base non registrata, ritmo osservato insufficiente', () => {
  const g = createGoal({ title: 'v', target: 50, unit: 'venditori', dueDate: '2027-04-22' }, 'g', NOW, TODAY, 0);
  const p = { start: TODAY, due: '2027-04-22', base: 0, target: 50, granularity: 'monthly' as const, curve: 'linear' as const };
  const none = planNotes(g, [], p, TODAY);
  assert.ok(none.risks.some((r) => r.includes('Nessun valore registrato')));
  const slow = [e('2026-09-24', 10), e('2026-10-24', 12)];
  const n2 = planNotes(g, slow, { ...p, base: 12 }, TODAY);
  assert.ok(n2.hypotheses[0].includes('ultimo valore registrato'));
  assert.ok(n2.risks.some((r) => r.includes('Al ritmo registrato')));
});
