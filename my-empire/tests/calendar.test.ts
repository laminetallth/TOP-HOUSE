import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthGrid, occurrencesOn, occursOn, shiftMonth, validateEvent, type EventInput } from '../src/domain/calendar.js';
import type { CalEvent } from '../src/domain/types.js';

const ev = (o: Partial<CalEvent>): CalEvent => ({ id: 'e', title: 'X', date: '2026-11-09', repeat: { type: 'none' }, doneDates: [], skipDates: [], color: 'aurora', createdAt: '', updatedAt: '', ...o });

test('ripetizioni: nessuna, settimanale, giorni alterni, mensile su fine mese, annuale', () => {
  assert.equal(occursOn(ev({}), '2026-11-09'), true);
  assert.equal(occursOn(ev({}), '2026-11-10'), false);
  const w = ev({ repeat: { type: 'weekly', days: [1, 3, 5] } });
  assert.deepEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-13'].map((d) => occursOn(w, d)), [true, false, true, true]);
  const alt = ev({ repeat: { type: 'interval', every: 2 } });
  assert.deepEqual(['2026-11-09', '2026-11-10', '2026-11-11'].map((d) => occursOn(alt, d)), [true, false, true]);
  const m = ev({ date: '2026-01-31', repeat: { type: 'monthly' } });
  assert.equal(occursOn(m, '2026-02-28'), true, 'il 31 diventa l\'ultimo giorno di febbraio');
  assert.equal(occursOn(m, '2026-03-31'), true);
  const y = ev({ date: '2026-03-15', repeat: { type: 'yearly' } });
  assert.equal(occursOn(y, '2027-03-15'), true);
});

test('prima della data, dopo la fine, occorrenze annullate ed eventi eliminati non compaiono', () => {
  const d = ev({ repeat: { type: 'daily' }, until: '2026-11-12', skipDates: ['2026-11-10'] });
  assert.deepEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13'].map((x) => occursOn(d, x)), [false, true, false, true, false]);
  assert.equal(occursOn(ev({ deletedAt: 'x' }), '2026-11-09'), false);
});

test('occorrenze ordinate per orario, tutto il giorno prima', () => {
  const list = [ev({ id: 'b', title: 'B', start: '18:00' }), ev({ id: 'a', title: 'A' }), ev({ id: 'c', title: 'C', start: '09:00', doneDates: ['2026-11-09'] })];
  const o = occurrencesOn(list, '2026-11-09');
  assert.deepEqual(o.map((x) => x.event.id), ['a', 'c', 'b']);
  assert.equal(o[1].done, true);
});

test('validazione evento', () => {
  const base: EventInput = { title: 'Dentista', date: '2026-11-09', repeat: { type: 'none' }, color: 'sky' };
  assert.equal(validateEvent(base), null);
  assert.ok(validateEvent({ ...base, title: ' ' }));
  assert.ok(validateEvent({ ...base, start: '25:00' }));
  assert.ok(validateEvent({ ...base, start: '10:00', end: '09:00' }));
  assert.ok(validateEvent({ ...base, end: '09:00' }));
  assert.ok(validateEvent({ ...base, repeat: { type: 'weekly', days: [] } }));
  assert.ok(validateEvent({ ...base, until: '2026-11-01' }));
});

test('griglia del mese a settimane intere da lunedì', () => {
  const g = monthGrid('2026-11-08');
  assert.equal(g[0], '2026-10-26');
  assert.equal(g.length % 7, 0);
  assert.ok(g.includes('2026-11-30'));
  assert.equal(shiftMonth('2026-01-31', 1), '2026-02-28');
});
