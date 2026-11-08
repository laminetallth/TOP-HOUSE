import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekReport } from '../src/domain/report.js';
import { defaultHabits, H } from '../src/domain/defaults.js';
import type { DailyRating, HabitLog } from '../src/domain/types.js';

const NOW = '2026-11-02T08:00:00.000Z';
const habits = defaultHabits('2026-11-02', NOW); // settimana dal lunedì 2 novembre
const log = (habitId: string, date: string, value = 1): HabitLog => ({ id: `${habitId}:${date}`, habitId, date, value, createdAt: NOW, updatedAt: NOW });
const rate = (kind: DailyRating['kind'], date: string, value: number): DailyRating => ({ id: `${kind}:${date}`, kind, date, value, updatedAt: NOW });

test('report: basket 2 su 3, palestra 3 su 3, creatina, soldi, audiolibro', () => {
  const logs = [
    log(H.basket, '2026-11-02'), log(H.basket, '2026-11-06'),
    log(H.gym, '2026-11-03'), log(H.gym, '2026-11-05'), log(H.gym, '2026-11-07'),
    ...['02', '03', '04', '05', '06', '07', '08'].map((d) => log(H.creatine, `2026-11-${d}`)),
    log(H.audiobook, '2026-11-02', 30), log(H.audiobook, '2026-11-03', 45),
  ];
  const ratings = [rate('money', '2026-11-02', 4), rate('money', '2026-11-03', 8), rate('food', '2026-11-02', 7)];
  const r = weekReport({ habits, logs, ratings, games: [], sessions: [], restDates: [] }, '2026-11-04', '2026-11-09', H.audiobook);
  const by = (id: string) => r.habits.find((x) => x.habit.id === id)!;
  assert.equal(r.finished, true);
  assert.deepEqual([by(H.basket).done, by(H.basket).expected], [2, 3]);
  assert.deepEqual([by(H.gym).done, by(H.gym).expected, by(H.gym).rate], [3, 3, 1]);
  assert.equal(by(H.creatine).rate, 1);
  assert.equal(by(H.basket).days[2], 'missing', 'mercoledì saltato = non fatto');
  assert.equal(r.money.avg, 6);
  assert.equal(r.money.best!.value, 8);
  assert.equal(r.money.worst!.value, 4);
  assert.equal(r.audiobookMinutes, 75);
  assert.ok(r.score! > 0 && r.score! < 1);
  assert.ok(r.tips.some((t) => t.startsWith('Dichiarazioni')), 'le attività più deboli diventano consigli');
});

test('report: settimana in corso conta solo i giorni fino a oggi', () => {
  const r = weekReport({ habits, logs: [log(H.creatine, '2026-11-02')], ratings: [], games: [], sessions: [], restDates: [] }, '2026-11-02', '2026-11-03');
  const c = r.habits.find((x) => x.habit.id === H.creatine)!;
  assert.deepEqual([c.done, c.expected], [1, 2]);
  assert.equal(r.finished, false);
  assert.equal(c.days[4], 'future');
});
