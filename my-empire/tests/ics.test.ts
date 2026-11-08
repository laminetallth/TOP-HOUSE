import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs } from '../src/domain/ics.js';
import { defaultHabits, H } from '../src/domain/defaults.js';

test('ics: promemoria delle attività con ripetizione corretta, giorni liberi esclusi', () => {
  const habits = defaultHabits('2026-11-08', '2026-11-08T08:00:00.000Z').map((h) => (h.id === H.basket ? { ...h, reminder: '18:30' } : h));
  const r = buildIcs(habits, [], '2026-11-08', '2026-11-08T08:00:00.000Z');
  assert.match(r.text, /SUMMARY:Dichiarazioni[\s\S]*?/);
  assert.match(r.text, /DTSTART;TZID=Europe\/Rome:20261108T080000\r\nDTEND;TZID=Europe\/Rome:20261108T081500\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Dichiarazioni/);
  assert.match(r.text, /RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\nSUMMARY:Basket/);
  assert.match(r.text, /RRULE:FREQ=DAILY;INTERVAL=2\r\nSUMMARY:Ricordare le medicine alla mamma/);
  assert.ok(!r.text.includes('SUMMARY:Palestra'), 'palestra non ha promemoria né giorni fissi');
  assert.ok(r.text.startsWith('BEGIN:VCALENDAR') && r.text.trimEnd().endsWith('END:VCALENDAR'));
});

test('ics: evento con promemoria, ripetizione e date annullate', () => {
  const r = buildIcs([], [{ id: 'e1', title: 'Dentista, controllo', date: '2026-11-20', start: '10:00', repeat: { type: 'weekly', days: [5] }, until: '2026-12-31', remind: 30, skipDates: ['2026-11-27'], doneDates: [], color: 'sky', createdAt: '', updatedAt: '' }], '2026-11-08', '2026-11-08T08:00:00.000Z');
  assert.match(r.text, /RRULE:FREQ=WEEKLY;BYDAY=FR;UNTIL=20261231T235959/);
  assert.match(r.text, /EXDATE;TZID=Europe\/Rome:20261127T100000/);
  assert.match(r.text, /SUMMARY:Dentista\\, controllo/);
  assert.match(r.text, /TRIGGER:-PT30M/);
  assert.equal(r.count, 1);
});
