import { addDays, range, weekStart, type DateKey } from './dates.js';
import { dayStatus, indexLogs, isScheduledDay, logMeetsDay, ruleFor, streak, type DayStatus } from './habits.js';
import { newRecords, points, volume } from './sport.js';
import type { BasketGame, DailyRating, GymSession, Habit, HabitLog } from './types.js';

export interface ReportData {
  habits: Habit[];
  logs: HabitLog[];
  ratings: DailyRating[];
  games: BasketGame[];
  sessions: GymSession[];
  restDates: DateKey[];
}

export interface HabitWeek {
  habit: Habit;
  /** Stato dei 7 giorni (lunedì → domenica). */
  days: DayStatus[];
  done: number;
  /** Volte attese nella settimana (giorni previsti fino a oggi, o N volte per le settimanali). */
  expected: number;
  rate: number | null;
  weekly: boolean;
  minutes?: number;
  streak: number;
}

export interface WeekReport {
  from: DateKey;
  to: DateKey;
  finished: boolean;
  habits: HabitWeek[];
  /** Completamento complessivo 0..1 (null se nulla era previsto). */
  score: number | null;
  food: { avg: number | null; count: number };
  money: { avg: number | null; count: number; best?: DailyRating; worst?: DailyRating; series: (number | null)[] };
  games: BasketGame[];
  points: number;
  gym: { sessions: number; volume: number; records: string[] };
  audiobookMinutes: number;
  perfectDays: number;
  tips: string[];
}

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function weekReport(d: ReportData, anyDay: DateKey, today: DateKey, audiobookId?: string): WeekReport {
  const from = weekStart(anyDay);
  const to = addDays(from, 6);
  const days = range(from, to);
  const finished = to < today;
  const live = d.habits.filter((h) => !h.archivedAt || h.archivedAt.slice(0, 10) >= from);

  const habits: HabitWeek[] = [];
  for (const h of live) {
    const logs = indexLogs(d.logs, h.id);
    const rule = ruleFor(h, to) ?? ruleFor(h, today);
    if (!rule) continue;
    const st = days.map((x) => dayStatus(h, x, logs.get(x), today, d.restDates));
    if (st.every((s) => s === 'n/a' || s === 'future') && !days.some((x) => logs.get(x))) continue;
    const weekly = rule.schedule.type === 'weekly';
    const done = days.filter((x) => x <= today && logMeetsDay(h, logs.get(x), x)).length;
    const expected = weekly
      ? (rule.schedule as { timesPerWeek: number }).timesPerWeek
      : days.filter((x) => x <= today && isScheduledDay(h, x, d.restDates)).length;
    const minutes = h.kind === 'minutes' ? days.reduce((s, x) => s + (logs.get(x)?.skipped ? 0 : logs.get(x)?.value ?? 0), 0) : undefined;
    habits.push({ habit: h, days: st, done, expected, rate: expected ? Math.min(1, done / expected) : null, weekly, minutes, streak: streak(h, logs, today, d.restDates).current });
  }

  const exp = habits.reduce((s, x) => s + x.expected, 0);
  const got = habits.reduce((s, x) => s + Math.min(x.done, x.expected), 0);

  const inWeek = (r: DailyRating): boolean => r.date >= from && r.date <= to;
  const food = d.ratings.filter((r) => r.kind === 'food' && inWeek(r));
  const money = d.ratings.filter((r) => r.kind === 'money' && inWeek(r)).sort((a, b) => a.date.localeCompare(b.date));
  const best = money.length ? money.reduce((a, b) => (b.value > a.value ? b : a)) : undefined;
  const worst = money.length ? money.reduce((a, b) => (b.value < a.value ? b : a)) : undefined;

  const games = d.games.filter((g) => !g.deletedAt && !g.scheduled && g.date >= from && g.date <= to);
  const sessions = d.sessions.filter((s) => s.date >= from && s.date <= to);
  const records = [...new Set(sessions.flatMap((s) => newRecords(s, d.sessions)))];

  // Giorni perfetti: tutte le attività a giorni previsti quel giorno, fatte.
  let perfectDays = 0;
  for (const x of days) {
    if (x > today) continue;
    const due = live.filter((h) => isScheduledDay(h, x, d.restDates));
    if (due.length && due.every((h) => logMeetsDay(h, d.logs.find((l) => l.habitId === h.id && l.date === x), x))) perfectDays++;
  }

  const audio = audiobookId ? habits.find((x) => x.habit.id === audiobookId)?.minutes ?? 0 : 0;

  const tips: string[] = [];
  const weak = habits.filter((x) => x.rate !== null && x.rate < 0.6 && (finished || x.expected >= 2)).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0)).slice(0, 3);
  for (const w of weak) {
    if (w.habit.reminder) tips.push(`${w.habit.name}: ${w.done} su ${w.expected}. Hai già il promemoria alle ${w.habit.reminder}: prova ad abbinarla a un gesto fisso (es. subito dopo colazione).`);
    else tips.push(`${w.habit.name}: ${w.done} su ${w.expected}. Dalle un orario fisso con un promemoria, così non dipende dalla memoria.`);
  }
  const mAvg = avg(money.map((r) => r.value));
  if (mAvg !== null && mAvg < 6) tips.push(`Soldi: voto medio ${mAvg.toFixed(1)}. Scegli una regola semplice per la prossima settimana, ad esempio aspettare 24 ore prima di ogni acquisto non necessario.`);
  const fAvg = avg(food.map((r) => r.value));
  if (fAvg !== null && fAvg < 6) tips.push(`Alimentazione: voto medio ${fAvg.toFixed(1)}. Prepara in anticipo un pasto o uno spuntino per i giorni più pieni.`);
  if (!money.length) tips.push('Soldi: nessun voto questa settimana. Bastano 5 secondi la sera.');

  return {
    from, to, finished, habits,
    score: exp ? got / exp : null,
    food: { avg: fAvg, count: food.length },
    money: { avg: mAvg, count: money.length, best, worst, series: days.map((x) => money.find((r) => r.date === x)?.value ?? null) },
    games, points: games.reduce((s, g) => s + points(g), 0),
    gym: { sessions: sessions.length, volume: sessions.reduce((s, x) => s + volume(x), 0), records },
    audiobookMinutes: audio,
    perfectDays,
    tips,
  };
}
