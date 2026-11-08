import { addDays, diffDays, isoWeekday, range, weekStart } from './dates.js';
export function indexLogs(logs, habitId) {
    const m = new Map();
    for (const l of logs)
        if (l.habitId === habitId)
            m.set(l.date, l);
    return m;
}
export function logId(habitId, date) {
    return `${habitId}:${date}`;
}
/** Regola in vigore in un giorno (l'ultima con from ≤ giorno), o null se l'abitudine non esisteva. */
export function ruleFor(h, day) {
    let found = null;
    for (const r of h.rules)
        if (r.from <= day && (!found || r.from >= found.from))
            found = r;
    return found;
}
export function startDate(h) {
    return h.rules.reduce((min, r) => (min === null || r.from < min ? r.from : min), null);
}
export function isPaused(h, day, restDates = []) {
    return restDates.includes(day) || h.pauses.some((p) => p.from <= day && day <= p.to);
}
/** Il giorno è uno di quelli in cui l'abitudine è prevista (solo per frequenze giornaliere o a giorni fissi). */
export function isScheduledDay(h, day, restDates = []) {
    const r = ruleFor(h, day);
    if (!r || isPaused(h, day, restDates))
        return false;
    if (r.schedule.type === 'daily')
        return true;
    if (r.schedule.type === 'days')
        return r.schedule.days.includes(isoWeekday(day));
    if (r.schedule.type === 'interval') {
        const d = diffDays(r.schedule.anchor, day);
        return d >= 0 && d % Math.max(1, r.schedule.every) === 0;
    }
    return false;
}
export function isWeekly(h, day) {
    return ruleFor(h, day)?.schedule.type === 'weekly';
}
/** La registrazione soddisfa l'obiettivo del giorno? */
export function logMeetsDay(h, log, day) {
    if (!log || log.skipped)
        return false;
    if (h.kind === 'check')
        return log.value >= 1;
    const target = ruleFor(h, day)?.dailyTarget;
    return target ? log.value >= target : log.value > 0;
}
export function dayStatus(h, day, log, today, restDates = []) {
    if (day > today)
        return 'future';
    const r = ruleFor(h, day);
    if (!r || h.archivedAt && day > h.archivedAt.slice(0, 10))
        return 'n/a';
    if (log?.skipped)
        return 'skipped';
    if (log && logMeetsDay(h, log, day))
        return 'done';
    if (log && log.value > 0)
        return 'partial';
    if (isPaused(h, day, restDates))
        return 'n/a';
    if (isScheduledDay(h, day, restDates))
        return 'missing';
    return 'optional';
}
/**
 * Avanzamento della settimana che contiene `day`.
 * - Frequenza settimanale (es. meditazione 2×): giorni registrati / volte richieste.
 * - Minuti con obiettivo settimanale (es. audiolibro 150'): minuti totali / obiettivo.
 * - Giornaliera o giorni fissi: giorni raggiunti / giorni previsti nella settimana.
 */
export function weekProgress(h, logs, day, restDates = []) {
    const ws = weekStart(day);
    const days = range(ws, addDays(ws, 6));
    // La regola in vigore è quella dell'ultimo giorno della settimana in cui l'abitudine esiste.
    const rule = [...days].reverse().map((d) => ruleFor(h, d)).find((r) => r) ?? null;
    if (!rule)
        return { mode: 'days', done: 0, target: 0, met: false };
    if (rule.schedule.type === 'weekly') {
        const done = days.filter((d) => logMeetsDay(h, logs.get(d), d)).length;
        const target = rule.schedule.timesPerWeek;
        return { mode: 'times', done, target, met: done >= target };
    }
    if (h.kind === 'minutes' && rule.weeklyMinutes) {
        const minutes = days.reduce((s, d) => s + (logs.get(d)?.skipped ? 0 : logs.get(d)?.value ?? 0), 0);
        return { mode: 'minutes', done: minutes, target: rule.weeklyMinutes, met: minutes >= rule.weeklyMinutes, minutes };
    }
    const scheduled = days.filter((d) => isScheduledDay(h, d, restDates));
    const done = scheduled.filter((d) => logMeetsDay(h, logs.get(d), d)).length;
    return { mode: 'days', done, target: scheduled.length, met: done >= scheduled.length && scheduled.length > 0 };
}
export function periodStats(h, logs, from, to, today, restDates = []) {
    const end = to < today ? to : today;
    if (end < from)
        return { counted: 0, done: 0, missing: 0, skipped: 0, rate: null, unit: 'giorni' };
    const weekly = isWeekly(h, end);
    if (weekly) {
        // Settimane intere nel periodo; la settimana in corso conta solo se l'obiettivo è già raggiunto.
        let counted = 0;
        let done = 0;
        for (let ws = weekStart(from); ws <= end; ws = addDays(ws, 7)) {
            if (!ruleFor(h, addDays(ws, 6)) && !ruleFor(h, ws))
                continue;
            const wp = weekProgress(h, logs, ws, restDates);
            const finished = addDays(ws, 6) < today;
            const fullyPaused = range(ws, addDays(ws, 6)).every((d) => isPaused(h, d, restDates));
            if (fullyPaused)
                continue;
            if (wp.met) {
                counted++;
                done++;
            }
            else if (finished)
                counted++;
        }
        return { counted, done, missing: counted - done, skipped: 0, rate: counted ? done / counted : null, unit: 'settimane' };
    }
    let counted = 0;
    let done = 0;
    let missing = 0;
    let skipped = 0;
    for (const d of range(from, end)) {
        const st = dayStatus(h, d, logs.get(d), today, restDates);
        const scheduled = isScheduledDay(h, d, restDates);
        if (!scheduled)
            continue;
        // Oggi non ancora registrato non pesa sulle statistiche.
        if (d === today && st === 'missing')
            continue;
        counted++;
        if (st === 'done')
            done++;
        else if (st === 'skipped')
            skipped++;
        else
            missing++;
    }
    return { counted, done, missing, skipped, rate: counted ? done / counted : null, unit: 'giorni' };
}
/**
 * Serie consecutiva.
 * - Giornaliere / giorni fissi: giorni previsti raggiunti di fila. I giorni non previsti,
 *   in pausa o di riposo non interrompono la serie. Oggi non ancora registrato non la interrompe.
 * - Settimanali: settimane consecutive con obiettivo raggiunto; quella in corso conta solo se già raggiunta.
 */
export function streak(h, logs, today, restDates = []) {
    const start = startDate(h);
    if (!start || start > today)
        return { current: 0, best: 0, unit: isWeekly(h, today) ? 'settimane' : 'giorni' };
    if (isWeekly(h, today)) {
        const weeks = [];
        for (let ws = weekStart(start); ws <= today; ws = addDays(ws, 7)) {
            const days = range(ws, addDays(ws, 6));
            if (days.every((d) => isPaused(h, d, restDates) || !ruleFor(h, d)))
                continue;
            const wp = weekProgress(h, logs, ws, restDates);
            const inProgress = addDays(ws, 6) >= today;
            if (inProgress && !wp.met)
                continue;
            weeks.push(wp.met);
        }
        return { ...runs(weeks), unit: 'settimane' };
    }
    const seq = [];
    for (const d of range(start, today)) {
        if (!isScheduledDay(h, d, restDates)) {
            // Un giorno non previsto ma registrato non allunga né interrompe la serie.
            continue;
        }
        const st = dayStatus(h, d, logs.get(d), today, restDates);
        if (d === today && st === 'missing')
            continue;
        seq.push(st === 'done');
    }
    return { ...runs(seq), unit: 'giorni' };
}
function runs(seq) {
    let best = 0;
    let cur = 0;
    for (const ok of seq) {
        cur = ok ? cur + 1 : 0;
        if (cur > best)
            best = cur;
    }
    return { current: cur, best };
}
/** Totale registrazioni valide (giorni con obiettivo raggiunto) dall'inizio. */
export function totalDone(h, logs) {
    let n = 0;
    for (const [d, l] of logs)
        if (logMeetsDay(h, l, d))
            n++;
    return n;
}
// ─── Modifica regole ─────────────────────────────────────────────────────────
/** Aggiunge una nuova regola valida da `from` senza toccare quelle passate. */
export function withRuleFrom(h, rule) {
    const rules = h.rules.filter((r) => r.from < rule.from);
    return { ...h, rules: [...rules, rule].sort((a, b) => a.from.localeCompare(b.from)) };
}
export function scheduleLabel(r) {
    if (!r)
        return '—';
    const s = r.schedule;
    let base;
    if (s.type === 'daily')
        base = 'Ogni giorno';
    else if (s.type === 'weekly')
        base = s.timesPerWeek === 1 ? '1 volta a settimana' : `${s.timesPerWeek} volte a settimana`;
    else if (s.type === 'interval')
        base = s.every === 2 ? 'A giorni alterni' : `Ogni ${s.every} giorni`;
    else if (s.days.length === 5 && [1, 2, 3, 4, 5].every((d) => s.days.includes(d)))
        base = 'Lunedì–venerdì';
    else
        base = s.days.map((d) => ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][d - 1]).join(', ');
    if (r.dailyTarget)
        base += ` · ${r.dailyTarget} min/giorno`;
    if (r.weeklyMinutes)
        base += ` · ${r.weeklyMinutes} min/settimana`;
    return base;
}
/** Giorni dall'ultima registrazione valida (utile per i promemoria futuri). */
export function daysSinceLast(h, logs, today) {
    let last = null;
    for (const [d, l] of logs)
        if (logMeetsDay(h, l, d) && d <= today && (!last || d > last))
            last = d;
    return last ? diffDays(last, today) : null;
}
//# sourceMappingURL=habits.js.map