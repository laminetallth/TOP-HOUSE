import { addDays, parseTime, type DateKey } from './dates.js';
import { ruleFor } from './habits.js';
import type { CalEvent, Habit } from './types.js';

/**
 * Esporta promemoria ed eventi in formato iCalendar (.ics), importabile in Google Calendar / calendario Android.
 * Così le notifiche arrivano anche con l'app chiusa: le gestisce il calendario del telefono.
 * Attività "N volte a settimana" (giorni liberi) non hanno un giorno fisso: non vengono esportate.
 */
const DAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function dt(d: DateKey, t: string): string {
  return `${d.replace(/-/g, '')}T${t.replace(':', '')}00`;
}

function plusMinutes(t: string, m: number): string {
  const x = Math.min(23 * 60 + 59, (parseTime(t) ?? 0) + m);
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
}

export interface IcsResult {
  text: string;
  count: number;
  skipped: string[];
}

export function buildIcs(habits: Habit[], events: CalEvent[], today: DateKey, stamp: string): IcsResult {
  const out: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//My Empire//IT', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:My Empire'];
  const skipped: string[] = [];
  let count = 0;
  const stampZ = stamp.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const tz = 'TZID=Europe/Rome';
  for (const h of habits) {
    if (h.archivedAt || !h.reminder) continue;
    const r = ruleFor(h, today);
    if (!r) continue;
    let rrule = '';
    let start = today;
    if (r.schedule.type === 'daily') rrule = 'FREQ=DAILY';
    else if (r.schedule.type === 'days') rrule = `FREQ=WEEKLY;BYDAY=${r.schedule.days.map((d) => DAY[d - 1]).join(',')}`;
    else if (r.schedule.type === 'interval') {
      rrule = `FREQ=DAILY;INTERVAL=${r.schedule.every}`;
      start = r.schedule.anchor;
      while (start < today) start = addDays(start, r.schedule.every);
    } else { skipped.push(h.name); continue; }
    out.push('BEGIN:VEVENT', `UID:${h.id}@my-empire`, `DTSTAMP:${stampZ}`, `DTSTART;${tz}:${dt(start, h.reminder)}`, `DTEND;${tz}:${dt(start, plusMinutes(h.reminder, 15))}`, `RRULE:${rrule}`, `SUMMARY:${esc(h.name)}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(h.name)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    count++;
  }
  for (const e of events) {
    if (e.deletedAt) continue;
    if (e.repeat.type === 'none' && e.date < today) continue;
    const lines = ['BEGIN:VEVENT', `UID:${e.id}@my-empire`, `DTSTAMP:${stampZ}`];
    if (e.start) {
      lines.push(`DTSTART;${tz}:${dt(e.date, e.start)}`, `DTEND;${tz}:${dt(e.date, e.end ?? plusMinutes(e.start, 30))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, '')}`);
    }
    const until = e.until ? `;UNTIL=${e.until.replace(/-/g, '')}T235959` : '';
    const r = e.repeat;
    if (r.type === 'daily') lines.push(`RRULE:FREQ=DAILY${until}`);
    else if (r.type === 'weekly') lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${r.days.map((d) => DAY[d - 1]).join(',')}${until}`);
    else if (r.type === 'interval') lines.push(`RRULE:FREQ=DAILY;INTERVAL=${r.every}${until}`);
    else if (r.type === 'monthly') lines.push(`RRULE:FREQ=MONTHLY${until}`);
    else if (r.type === 'yearly') lines.push(`RRULE:FREQ=YEARLY${until}`);
    for (const x of e.skipDates) lines.push(e.start ? `EXDATE;${tz}:${dt(x, e.start)}` : `EXDATE;VALUE=DATE:${x.replace(/-/g, '')}`);
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.note) lines.push(`DESCRIPTION:${esc(e.note)}`);
    if (e.remind !== undefined) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, e.start ? `TRIGGER:-PT${e.remind}M` : 'TRIGGER;RELATED=START:PT9H', 'END:VALARM');
    lines.push('END:VEVENT');
    out.push(...lines);
    count++;
  }
  out.push('END:VCALENDAR');
  return { text: out.join('\r\n') + '\r\n', count, skipped };
}
