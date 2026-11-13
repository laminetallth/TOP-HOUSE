import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sleepMinutes } from '../src/domain/sleep.js';
import { saveSleep, deleteSleep } from '../src/data/sleepActions.js';
import { MemoryDatabase } from '../src/data/db.js';
import { Store } from '../src/data/store.js';

test('sonno prima e dopo mezzanotte, orari mancanti o non validi', () => {
  assert.equal(sleepMinutes('23:30', '07:15'), 465);
  assert.equal(sleepMinutes('01:00', '09:00'), 480);
  assert.equal(sleepMinutes('08:00', '15:30'), 450);
  assert.equal(sleepMinutes('23:59', '00:00'), 1);
  assert.throws(() => sleepMinutes('', '08:00'));
  assert.throws(() => sleepMinutes('24:00', '08:00'));
  assert.throws(() => sleepMinutes('08:00', '08:00'));
});

test('salvataggio, modifica senza doppioni, persistenza, backup e annullamento', async () => {
  const db = new MemoryDatabase();
  const st = new Store(db, () => new Date('2026-11-08T12:00:00'));
  await st.load();
  await saveSleep(st, '2026-11-08', '23:30', '07:00');
  await saveSleep(st, '2026-11-08', '00:30', '08:00');
  assert.equal(st.all('sleepLogs').length, 1);
  const reloaded = new Store(db);
  await reloaded.load();
  assert.equal(reloaded.get('sleepLogs', '2026-11-08')!.bedtime, '00:30');
  const backup = st.exportAll();
  await deleteSleep(st, '2026-11-08');
  assert.equal(st.all('sleepLogs').length, 0);
  await st.undo();
  assert.equal(st.all('sleepLogs').length, 1);
  await st.importAll(backup);
  assert.equal(st.all('sleepLogs').length, 1);
  delete backup.sleepLogs;
  await st.importAll(backup);
  assert.equal(st.all('sleepLogs').length, 0);
  await assert.rejects(saveSleep(st, '2026-11-09', '23:00', '07:00'));
  await assert.rejects(saveSleep(st, '2026-02-30', '23:00', '07:00'));
});
