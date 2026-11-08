const pad = (n) => String(n).padStart(2, '0');
export function toKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function isDateKey(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s))
        return false;
    const d = fromKey(s);
    return toKey(d) === s;
}
/** Mezzogiorno locale: evita sorprese con i cambi dell'ora legale. */
export function fromKey(k) {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
}
export function todayKey(now = new Date()) {
    return toKey(now);
}
export function addDays(k, n) {
    const d = fromKey(k);
    d.setDate(d.getDate() + n);
    return toKey(d);
}
/** Giorni tra a e b (b - a). */
export function diffDays(a, b) {
    return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);
}
/** 1 = lunedì … 7 = domenica (ISO). */
export function isoWeekday(k) {
    const w = fromKey(k).getDay();
    return w === 0 ? 7 : w;
}
/** Lunedì della settimana che contiene k. */
export function weekStart(k) {
    return addDays(k, 1 - isoWeekday(k));
}
export function monthStart(k) {
    return `${k.slice(0, 7)}-01`;
}
export function monthEnd(k) {
    const d = fromKey(monthStart(k));
    d.setMonth(d.getMonth() + 1, 0);
    return toKey(d);
}
/** Elenco inclusivo di giorni da a a b. */
export function range(a, b) {
    const out = [];
    for (let k = a; k <= b; k = addDays(k, 1))
        out.push(k);
    return out;
}
export function minKey(a, b) {
    return a < b ? a : b;
}
const WEEKDAYS = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export function weekdayName(k) {
    return WEEKDAYS[isoWeekday(k) - 1];
}
export function weekdayShort(n) {
    return WEEKDAYS_SHORT[n - 1];
}
export function monthName(k) {
    return MONTHS[Number(k.slice(5, 7)) - 1];
}
/** "sabato 24 ottobre" */
export function longLabel(k) {
    return `${weekdayName(k)} ${Number(k.slice(8, 10))} ${monthName(k)}`;
}
/** "24 ott" */
export function shortLabel(k) {
    return `${Number(k.slice(8, 10))} ${monthName(k).slice(0, 3)}`;
}
/** Etichetta relativa: oggi, domani, ieri, altrimenti data breve. */
export function relativeLabel(k, today) {
    const d = diffDays(today, k);
    if (d === 0)
        return 'oggi';
    if (d === 1)
        return 'domani';
    if (d === -1)
        return 'ieri';
    return shortLabel(k) + (k.slice(0, 4) !== today.slice(0, 4) ? ` ${k.slice(0, 4)}` : '');
}
/** "HH:MM" → minuti dalla mezzanotte, oppure null se non valido. */
export function parseTime(t) {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t.trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
export function formatMinutes(min) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h === 0)
        return `${m} min`;
    return m === 0 ? `${h} h` : `${h} h ${pad(m)}`;
}
//# sourceMappingURL=dates.js.map