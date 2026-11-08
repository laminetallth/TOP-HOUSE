import { addDays, monthEnd, monthStart, parseTime, range, weekStart, type DateKey } from './dates.js';

/**
 * Durata del sonno in minuti. Se l'ora di risveglio è "prima" dell'ora in cui si va a dormire,
 * il sonno attraversa la mezzanotte (es. 23:30 → 07:00 = 7 h 30).
 * Orari uguali = 0 (dato sospetto, segnalato dalla validazione).
 */
export function sleepMinutes(bedtime: string, wake: string): number | null {
  const b = parseTime(bedtime);
  const w = parseTime(wake);
  if (b === null || w === null) return null;
  return w >= b ? w - b : 24 * 60 - b + w;
}

export function validateSleep(bedtime: string, wake: string): string | null {
  const m = sleepMinutes(bedtime, wake);
  if (m === null) return 'Usa il formato HH:MM.';
  if (m === 0) return 'Gli orari coincidono.';
  if (m > 16 * 60) return 'Più di 16 ore: controlla gli orari.';
  return null;
}

export function validateRating(v: number): string | null {
  return Number.isInteger(v) && v >= 1 && v <= 10 ? null : 'Il voto va da 1 a 10.';
}

export function validateWeight(kg: number): string | null {
  if (!Number.isFinite(kg)) return 'Peso non valido.';
  if (kg < 30 || kg > 300) return 'Peso fuori intervallo (30–300 kg).';
  return null;
}

export function validateMinutes(min: number): string | null {
  if (!Number.isFinite(min) || min < 0) return 'I minuti non possono essere negativi.';
  if (min > 24 * 60) return 'Più di 24 ore in un giorno.';
  return null;
}

/** Media dei valori registrati in un intervallo: i giorni senza dato non contano come zero. */
export function averageIn<T extends { date: DateKey }>(items: T[], from: DateKey, to: DateKey, pick: (t: T) => number): { avg: number | null; count: number } {
  const vals = items.filter((i) => i.date >= from && i.date <= to).map(pick);
  if (vals.length === 0) return { avg: null, count: 0 };
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length };
}

export function weekRange(day: DateKey): [DateKey, DateKey] {
  const ws = weekStart(day);
  return [ws, addDays(ws, 6)];
}

export function monthRange(day: DateKey): [DateKey, DateKey] {
  return [monthStart(day), monthEnd(day)];
}

/** Ultimi n giorni fino a `day` incluso. */
export function lastDays(day: DateKey, n: number): DateKey[] {
  return range(addDays(day, -(n - 1)), day);
}
