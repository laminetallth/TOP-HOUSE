import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestLoads, newRecords, pctOf, points, seasonOf, summarize, validateExercises, validateGame, volume, type GameInput } from '../src/domain/sport.js';
import type { BasketGame, GymSession } from '../src/domain/types.js';

const base: GameInput = { date: '2026-11-06', opponent: 'Saronno', minutes: 24, fg2m: 4, fg2a: 9, fg3m: 2, fg3a: 6, ftm: 3, fta: 4, reb: 5, ast: 3, tov: 2, rating: 7 };
const game = (o: Partial<BasketGame> = {}): BasketGame => ({ ...base, id: 'g', createdAt: '', updatedAt: '', ...o });

test('punti calcolati dai tiri: 4×2 + 2×3 + 3 = 17', () => {
  assert.equal(points(base), 17);
});

test('validazione: segnati ≤ tentati, minuti non negativi, interi, niente futuro', () => {
  assert.equal(validateGame(base, '2026-11-08'), null);
  assert.ok(validateGame({ ...base, fg3m: 7 }, '2026-11-08'));
  assert.ok(validateGame({ ...base, ftm: 5 }, '2026-11-08'));
  assert.ok(validateGame({ ...base, minutes: -1 }, '2026-11-08'));
  assert.ok(validateGame({ ...base, reb: 1.5 }, '2026-11-08'));
  assert.ok(validateGame({ ...base, date: '2026-11-09' }, '2026-11-08'));
  assert.ok(validateGame({ ...base, opponent: ' ' }, '2026-11-08'));
  assert.ok(validateGame({ ...base, rating: 11 }, '2026-11-08'));
});

test('0 tentativi = percentuale non disponibile, non 0%', () => {
  assert.equal(pctOf(0, 0), null);
  assert.equal(pctOf(0, 4), 0);
});

test('medie per partita e percentuali sui totali (non media delle percentuali)', () => {
  const a = game({ fg2m: 1, fg2a: 1, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 2, rating: 6 });
  const b = game({ fg2m: 3, fg2a: 9, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 4, rating: undefined });
  const s = summarize([a, b]);
  assert.equal(s.games, 2);
  assert.equal(s.fg2, 0.4); // 4/10, non (100% + 33%)/2
  assert.equal(s.fg3, null);
  assert.equal(s.ppg, 4);
  assert.equal(s.rpg, 3);
  assert.equal(s.rating, 6, 'media solo delle partite con voto');
  assert.equal(summarize([]).ppg, null);
});

test('stagione dal 1° settembre', () => {
  assert.deepEqual(seasonOf('2026-11-08'), { from: '2026-09-01', to: '2027-08-31', label: '2026/27' });
  assert.equal(seasonOf('2027-03-01').label, '2026/27');
  assert.equal(seasonOf('2027-09-01').label, '2027/28');
});

const sess = (date: string, ex: GymSession['exercises']): GymSession => ({ id: `gym:${date}`, date, exercises: ex, updatedAt: '' });

test('palestra: validazione esercizi e volume', () => {
  assert.ok(validateExercises([{ name: '', sets: [{ reps: 5 }] }]));
  assert.ok(validateExercises([{ name: 'Panca', sets: [] }]));
  assert.ok(validateExercises([{ name: 'Panca', sets: [{ reps: 0 }] }]));
  assert.ok(validateExercises([{ name: 'Panca', sets: [{ reps: 5, kg: -2 }] }]));
  assert.equal(validateExercises([{ name: 'Trazioni', sets: [{ reps: 8 }] }]), null);
  assert.equal(volume(sess('2026-11-02', [{ name: 'Panca', sets: [{ reps: 8, kg: 60 }, { reps: 6, kg: 70 }] }, { name: 'Trazioni', sets: [{ reps: 8 }] }])), 900);
});

test('record: miglior carico precedente superato, nomi senza differenze di maiuscole', () => {
  const all = [
    sess('2026-11-02', [{ name: 'Panca piana', sets: [{ reps: 6, kg: 70 }] }]),
    sess('2026-11-04', [{ name: 'panca piana ', sets: [{ reps: 5, kg: 72.5 }] }, { name: 'Squat', sets: [{ reps: 5, kg: 80 }] }]),
  ];
  assert.deepEqual(newRecords(all[1], all), ['panca piana'], 'Squat è il primo: non è un record');
  assert.equal(bestLoads(all).get('panca piana')!.kg, 72.5);
});
