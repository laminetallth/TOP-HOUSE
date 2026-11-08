import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDatabase, type Database, type Op } from '../src/data/db.js';
import { Store } from '../src/data/store.js';
import * as A from '../src/data/actions.js';
import * as C from '../src/data/calActions.js';
import * as SA from '../src/data/sportActions.js';
import { H } from '../src/domain/defaults.js';
import { isScheduledDay } from '../src/domain/habits.js';

async function fresh(at = '2026-11-08T10:00:00'): Promise<{ store: Store; db: MemoryDatabase; set: (s: string) => void }> {
  let t = new Date(at);
  const db = new MemoryDatabase();
  const store = new Store(db, () => t);
  await store.load();
  return { store, db, set: (s) => { t = new Date(s); } };
}

test('primo avvio: 11 attività personali, nessun dato inventato, niente lavoro', async () => {
  const { store } = await fresh();
  assert.equal(store.all('habits').length, 11);
  assert.equal(store.all('habitLogs').length, 0);
  assert.equal(store.all('goals').length, 0);
  assert.ok(store.all('habits').every((h) => h.area !== undefined));
  const b = store.get('habits', H.basket)!;
  assert.deepEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-13'].map((d) => isScheduledDay(b, d)), [true, false, true, true]);
  assert.ok(!isScheduledDay(b, '2026-11-02'), 'i giorni prima del primo avvio non risultano mancati');
  const gym = store.get('habits', H.gym)!;
  assert.equal(gym.rules[0].from, '2026-11-02', 'la quota settimanale conta dal lunedì');
  assert.equal(store.get('habits', H.audiobook)!.rules[0].dailyTarget, 30);
});

test('i dati restano dopo il riavvio e il seed non si ripete', async () => {
  const { store, db } = await fresh();
  await A.markHabitDone(store, H.creatine, store.today());
  const again = new Store(db, () => new Date('2026-11-08T12:00:00'));
  await again.load();
  assert.equal(again.all('habits').length, 11);
  assert.equal(again.all('habitLogs').length, 1);
});

test('doppio tocco = una registrazione; annulla la toglie', async () => {
  const { store } = await fresh();
  await Promise.all([A.markHabitDone(store, H.skincare, store.today()), A.markHabitDone(store, H.skincare, store.today())]);
  assert.equal(store.all('habitLogs').length, 1);
  await store.undo(); // annulla il secondo tocco
  await store.undo(); // annulla il primo
  assert.equal(store.all('habitLogs').length, 0);
});

test('promemoria: orario valido, attività di sistema non eliminabili', async () => {
  const { store } = await fresh();
  await A.setHabitReminder(store, H.skincare, '22:00');
  assert.equal(store.get('habits', H.skincare)!.reminder, '22:00');
  await assert.rejects(A.setHabitReminder(store, H.skincare, '25:00'));
  await assert.rejects(A.deleteHabit(store, H.skincare));
  const h = await A.addHabit(store, { name: 'Acqua', kind: 'check', schedule: { type: 'daily' }, area: 'corpo' });
  await A.markHabitDone(store, h.id, store.today());
  await A.deleteHabit(store, h.id);
  assert.equal(store.all('habitLogs').filter((l) => l.habitId === h.id).length, 0);
});

test('calendario: evento ripetuto, spunta di un\'occorrenza, eliminazione di una sola data', async () => {
  const { store } = await fresh();
  const e = await C.addEvent(store, { title: 'Medicine mamma', date: '2026-11-08', repeat: { type: 'interval', every: 2 }, task: true, color: 'rose' });
  assert.equal(await C.toggleEventDone(store, e.id, '2026-11-10'), true);
  await assert.rejects(C.toggleEventDone(store, e.id, '2026-11-09'));
  await C.deleteEvent(store, e.id, '2026-11-12');
  const cur = store.get('calEvents', e.id)!;
  assert.deepEqual([cur.doneDates, cur.skipDates], [['2026-11-10'], ['2026-11-12']]);
  await C.deleteEvent(store, e.id);
  assert.ok(store.get('calEvents', e.id)!.deletedAt);
});

test('basket: partita in programma poi giocata con statistiche', async () => {
  const { store } = await fresh();
  const g = await SA.scheduleGame(store, { date: '2026-11-14', opponent: 'Saronno', time: '18:30' });
  assert.equal(store.get('basketGames', g.id)!.scheduled, true);
  await assert.rejects(SA.saveGame(store, { date: '2026-11-14', opponent: 'Saronno', minutes: 20, fg2m: 1, fg2a: 2, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 0, ast: 0, tov: 0 }, g.id), 'non si registrano statistiche nel futuro');
  await SA.saveGame(store, { date: '2026-11-07', opponent: 'Busto', minutes: 20, fg2m: 1, fg2a: 2, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 0, ast: 0, tov: 0 }, g.id);
  const after = store.get('basketGames', g.id)!;
  assert.equal(after.scheduled, undefined);
  assert.equal(store.all('basketGames').length, 1, 'stessa partita, nessun doppione');
});

test('palestra: scheda attiva e sessione dalla scheda con presenza', async () => {
  const { store } = await fresh();
  const p = await SA.savePlan(store, 'Scheda novembre', [{ id: '', name: 'A · Petto', exercises: [{ name: 'Panca piana', sets: 4, reps: '8-10' }] }]);
  await assert.rejects(SA.savePlan(store, 'X', [{ id: '', name: 'A', exercises: [{ name: 'Panca', sets: 0, reps: '8' }] }]));
  const p2 = await SA.savePlan(store, 'Scheda dicembre', [{ id: '', name: 'B', exercises: [] }], true);
  assert.equal(SA.activePlan(store)!.id, p2.id);
  assert.equal(store.get('gymPlans', p.id)!.active, false, 'la vecchia scheda resta in archivio');
  await SA.saveGymSession(store, '2026-11-08', { planDayId: p.days[0].id, exercises: [{ name: 'Panca piana', sets: [{ reps: 8, kg: 70 }] }] });
  assert.equal(store.get('habitLogs', `${H.gym}:2026-11-08`)!.value, 1);
});

test('scrittura fallita: nulla salvato a metà', async () => {
  class Failing extends MemoryDatabase {
    fail = false;
    override async transact(ops: Op[]): Promise<void> {
      if (this.fail) throw new Error('disco pieno');
      return super.transact(ops);
    }
  }
  const db = new Failing();
  const store = new Store(db as Database, () => new Date('2026-11-08T10:00:00'));
  await store.load();
  db.fail = true;
  await assert.rejects(A.markHabitDone(store, H.creatine, '2026-11-08'));
  assert.equal(store.all('habitLogs').length, 0);
});

test('backup: esporta e ripristina tutti i dati senza duplicati', async () => {
  const { store } = await fresh();
  await A.markHabitDone(store, H.creatine, store.today());
  await C.addEvent(store, { title: 'Dentista', date: '2026-11-20', repeat: { type: 'none' }, color: 'sky' });
  const dump = JSON.parse(JSON.stringify(store.exportAll()));
  const { store: other } = await fresh();
  await A.markHabitDone(other, H.skincare, other.today());
  const n = await other.importAll(dump);
  assert.ok(n > 10);
  assert.equal(other.all('habitLogs').length, 1);
  assert.equal(other.all('habitLogs')[0].habitId, H.creatine);
  assert.equal(other.all('calEvents').length, 1);
  await assert.rejects(other.importAll({ app: 'altro' }));
});
