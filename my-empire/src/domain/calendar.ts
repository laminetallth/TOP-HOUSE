import { addDays, diffDays, isDateKey, isoWeekday, monthEnd, monthStart, parseTime, range, weekStart, type DateKey } from './dates.js';
import type { CalEvent, Repeat } from './types.js';

/** L'evento ricorre in questo giorno? (le occorrenze annullate non contano) */
export function occursOn(e: CalEvent, day: DateKey): boolean {
  if (e.deletedAt || day < e.date) return false;
  if (e.until && day > e.until) return false;
  if (e.skipDates.includes(day)) return false;
  const r = e.repeat;
  switch (r.type) {
    case 'none': return day === e.date;
    case 'daily': return true;
    case 'weekly': return r.days.includes(isoWeekday(day));
    case 'interval': return diffDays(e.date, day) % Math.max(1, r.every) === 0;
    case 'monthly': {
      const dom = Number(e.date.slice(8, 10));
      const last = Number(monthEnd(day).slice(8, 10));
      return Number(day.slice(8, 10)) === Math.min(dom, last);
    }
    case 'yearly': {
      if (e.date.slice(5) === '02-29') return day.slice(5) === (Number(monthEnd(`${day.slice(0, 4)}-02-01`).slice(8)) === 29 ? '02-29' : '02-28');
      return day.slice(5) === e.date.slice(5);
    }
  }
}

export interface Occurrence {
  event: CalEvent;
  date: DateKey;
  done: boolean;
}

export function occurrencesOn(events: CalEvent[], day: DateKey): Occurrence[] {
  return events
    .filter((e) => occursOn(e, day))
    .map((event) => ({ event, date: day, done: event.doneDates.includes(day) }))
    .sort((a, b) => (a.event.start ?? '00:00').localeCompare(b.event.start ?? '00:00') || a.event.title.localeCompare(b.event.title));
}

export function occurrencesIn(events: CalEvent[], from: DateKey, to: DateKey): Map<DateKey, Occurrence[]> {
  const m = new Map<DateKey, Occurrence[]>();
  for (const d of range(from, to)) {
    const o = occurrencesOn(events, d);
    if (o.length) m.set(d, o);
  }
  return m;
}

export function repeatLabel(r: Repeat): string {
  switch (r.type) {
    case 'none': return 'Non si ripete';
    case 'daily': return 'Ogni giorno';
    case 'weekly': return r.days.length === 7 ? 'Ogni giorno' : `Ogni settimana: ${r.days.map((d) => ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'][d - 1]).join(', ')}`;
    case 'interval': return r.every === 2 ? 'A giorni alterni' : `Ogni ${r.every} giorni`;
    case 'monthly': return 'Ogni mese';
    case 'yearly': return 'Ogni anno';
  }
}

export interface EventInput {
  title: string;
  date: DateKey;
  start?: string;
  end?: string;
  location?: string;
  note?: string;
  repeat: Repeat;
  until?: DateKey;
  remind?: number;
  task?: boolean;
  color: CalEvent['color'];
}

export function validateEvent(i: EventInput): string | null {
  if (!i.title.trim()) return 'Scrivi un titolo.';
  if (i.title.trim().length > 120) return 'Titolo troppo lungo.';
  if (!isDateKey(i.date)) return 'Data non valida.';
  if (i.start !== undefined && parseTime(i.start) === null) return 'Ora di inizio non valida.';
  if (i.end !== undefined) {
    if (i.start === undefined) return 'Indica anche l\'ora di inizio.';
    const s = parseTime(i.start);
    const e = parseTime(i.end);
    if (e === null) return 'Ora di fine non valida.';
    if (s !== null && e <= s) return 'La fine deve essere dopo l\'inizio.';
  }
  if (i.repeat.type === 'weekly' && !i.repeat.days.length) return 'Scegli almeno un giorno della settimana.';
  if (i.repeat.type === 'interval' && !(Number.isInteger(i.repeat.every) && i.repeat.every >= 2 && i.repeat.every <= 60)) return 'Ogni quanti giorni: da 2 a 60.';
  if (i.until !== undefined && (!isDateKey(i.until) || i.until < i.date)) return 'La fine della ripetizione precede la data.';
  if (i.remind !== undefined && !(Number.isInteger(i.remind) && i.remind >= 0 && i.remind <= 10080)) return 'Promemoria non valido.';
  return null;
}

/** Griglia del mese da lunedì, con giorni dei mesi vicini per riempire le settimane. */
export function monthGrid(anyDay: DateKey): DateKey[] {
  const first = weekStart(monthStart(anyDay));
  const lastDay = monthEnd(anyDay);
  const last = addDays(weekStart(lastDay), 6);
  return range(first, last);
}

export function shiftMonth(k: DateKey, n: number): DateKey {
  const y = Number(k.slice(0, 4));
  const m = Number(k.slice(5, 7)) - 1 + n;
  const ny = y + Math.floor(m / 12);
  const nm = ((m % 12) + 12) % 12;
  const first = `${ny}-${String(nm + 1).padStart(2, '0')}-01`;
  const day = Math.min(Number(k.slice(8, 10)), Number(monthEnd(first).slice(8, 10)));
  return `${first.slice(0, 8)}${String(day).padStart(2, '0')}`;
}
