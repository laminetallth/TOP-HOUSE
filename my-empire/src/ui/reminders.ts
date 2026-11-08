/**
 * Promemoria con l'app aperta (anche in secondo piano, finché il browser la tiene attiva).
 * Per notifiche garantite ad app chiusa: Impostazioni → "Aggiungi al calendario del telefono" (.ics).
 */
import type { App } from './app.js';
import { dueToday } from './activity.js';
import { occurrencesOn } from '../domain/calendar.js';
import { parseTime } from '../domain/dates.js';
import { haptic } from './fx.js';

let timers: number[] = [];
const fired = new Set<string>();
let swReg: ServiceWorkerRegistration | null = null;

export function notifySupported(): boolean {
  return typeof Notification !== 'undefined';
}

export async function registerSw(): Promise<void> {
  try {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) swReg = await navigator.serviceWorker.register('sw.js');
  } catch { swReg = null; }
}

async function show(title: string, body: string): Promise<void> {
  try {
    if (swReg) await swReg.showNotification(title, { body, icon: 'icon.svg', tag: title });
    else new Notification(title, { body, icon: 'icon.svg' });
  } catch { /* il browser non permette notifiche da questa pagina */ }
}

export interface PlannedReminder {
  key: string;
  at: number; // minuti dalla mezzanotte
  title: string;
  body: string;
}

export function plannedToday(app: App): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const it of dueToday(app)) {
    if (it.done || it.skipped || !it.habit.reminder) continue;
    const t = parseTime(it.habit.reminder);
    if (t !== null) out.push({ key: `h:${it.habit.id}:${app.today}`, at: t, title: it.habit.name, body: it.habit.id === 'h-dichiarazioni' ? 'È il momento delle dichiarazioni: mano sul cuore.' : 'Promemoria di My Empire' });
  }
  for (const o of occurrencesOn(app.store.all('calEvents'), app.today)) {
    if (o.event.remind === undefined || o.done) continue;
    const base = o.event.start ? parseTime(o.event.start) ?? 540 : 540;
    out.push({ key: `e:${o.event.id}:${app.today}`, at: Math.max(0, base - (o.event.start ? o.event.remind : 0)), title: o.event.title, body: o.event.start ? `Alle ${o.event.start}${o.event.location ? ` · ${o.event.location}` : ''}` : 'Oggi' });
  }
  return out.sort((a, b) => a.at - b.at);
}

export function scheduleReminders(app: App): void {
  for (const t of timers) clearTimeout(t);
  timers = [];
  const now = app.store.now();
  const mins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const enabled = app.store.settings().notify && notifySupported() && Notification.permission === 'granted';
  for (const r of plannedToday(app)) {
    if (fired.has(r.key) || r.at < mins - 0.5) continue;
    const ms = Math.max(0, (r.at - mins) * 60_000);
    if (ms > 24 * 3_600_000) continue;
    timers.push(window.setTimeout(() => {
      fired.add(r.key);
      haptic([30, 60, 30]);
      app.toast(`⏰ ${r.title}`);
      if (enabled) void show(r.title, r.body);
    }, ms));
  }
}
