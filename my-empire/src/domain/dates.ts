/**
 * Date di calendario locali nel formato "YYYY-MM-DD" (DateKey).
 * Tutta l'app ragiona per giorni locali del dispositivo: niente UTC per i giorni,
 * così una registrazione fatta alle 23:30 resta nel giorno giusto.
 */
export type DateKey = string;

const pad = (n: number): string => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isDateKey(s: unknown): s is DateKey {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = fromKey(s);
  return toKey(d) === s;
}

/** Mezzogiorno locale: evita sorprese con i cambi dell'ora legale. */
export function fromKey(k: DateKey): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toKey(now);
}

export function addDays(k: DateKey, n: number): DateKey {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** Giorni tra a e b (b - a). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);
}

/** 1 = lunedì … 7 = domenica (ISO). */
export function isoWeekday(k: DateKey): number {
  const w = fromKey(k).getDay();
  return w === 0 ? 7 : w;
}

/** Lunedì della settimana che contiene k. */
export function weekStart(k: DateKey): DateKey {
  return addDays(k, 1 - isoWeekday(k));
}

export function monthStart(k: DateKey): DateKey {
  return `${k.slice(0, 7)}-01`;
}

export function monthEnd(k: DateKey): DateKey {
  const d = fromKey(monthStart(k));
  d.setMonth(d.getMonth() + 1, 0);
  return toKey(d);
}

/** Elenco inclusivo di giorni da a a b. */
export function range(a: DateKey, b: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = a; k <= b; k = addDays(k, 1)) out.push(k);
  return out;
}

export function minKey(a: DateKey, b: DateKey): DateKey {
  return a < b ? a : b;
}

const WEEKDAYS = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export function weekdayName(k: DateKey): string {
  return WEEKDAYS[isoWeekday(k) - 1];
}

export function weekdayShort(n: number): string {
  return WEEKDAYS_SHORT[n - 1];
}

export function monthName(k: DateKey): string {
  return MONTHS[Number(k.slice(5, 7)) - 1];
}

/** "sabato 24 ottobre" */
export function longLabel(k: DateKey): string {
  return `${weekdayName(k)} ${Number(k.slice(8, 10))} ${monthName(k)}`;
}

/** "24 ott" */
export function shortLabel(k: DateKey): string {
  return `${Number(k.slice(8, 10))} ${monthName(k).slice(0, 3)}`;
}

/** Etichetta relativa: oggi, domani, ieri, altrimenti data breve. */
export function relativeLabel(k: DateKey, today: DateKey): string {
  const d = diffDays(today, k);
  if (d === 0) return 'oggi';
  if (d === 1) return 'domani';
  if (d === -1) return 'ieri';
  return shortLabel(k) + (k.slice(0, 4) !== today.slice(0, 4) ? ` ${k.slice(0, 4)}` : '');
}

/** "HH:MM" → minuti dalla mezzanotte, oppure null se non valido. */
export function parseTime(t: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${pad(m)}`;
}
