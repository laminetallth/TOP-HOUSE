import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageIn, sleepMinutes, validateRating, validateSleep, validateWeight } from '../src/domain/daily.js';
import { addDays, isDateKey, isoWeekday, monthEnd, weekStart } from '../src/domain/dates.js';

test('sonno che attraversa la mezzanotte', () => {
  assert.equal(sleepMinutes('23:30', '07:00'), 450);
  assert.equal(sleepMinutes('01:15', '08:45'), 450);
  assert.equal(sleepMinutes('22:00', '22:00'), 0);
  assert.equal(sleepMinutes('25:00', '07:00'), null);
  assert.ok(validateSleep('23:00', '23:00'));
  assert.ok(validateSleep('07:00', '06:00')); // 23 h
  assert.equal(validateSleep('23:00', '06:30'), null);
});

test('voti e peso', () => {
  assert.equal(validateRating(7), null);
  assert.ok(validateRating(0));
  assert.ok(validateRating(7.5));
  assert.equal(validateWeight(86.5), null);
  assert.ok(validateWeight(-3));
});

test('medie: i giorni senza dato non valgono zero', () => {
  const items = [{ date: '2026-10-19', v: 8 }, { date: '2026-10-21', v: 6 }];
  assert.deepEqual(averageIn(items, '2026-10-19', '2026-10-25', (i) => i.v), { avg: 7, count: 2 });
  assert.deepEqual(averageIn(items, '2026-11-01', '2026-11-07', (i) => i.v), { avg: null, count: 0 });
});

test('date: settimane da lunedì, fine mese, cambio ora legale', () => {
  assert.equal(isoWeekday('2026-10-24'), 6);
  assert.equal(weekStart('2026-10-25'), '2026-10-19');
  assert.equal(monthEnd('2028-02-10'), '2028-02-29');
  // In Italia l'ora legale finisce il 25 ottobre 2026: il giorno dopo resta il 26.
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(addDays('2027-03-28', 1), '2027-03-29');
  assert.equal(isDateKey('2026-02-29'), false);
});
