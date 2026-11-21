import type { Store } from './store.js';
import { isDateKey } from '../domain/dates.js';
import { sleepMinutes } from '../domain/sleep.js';

export async function saveSleep(store: Store, date: string, bedtime: string, wakeTime: string): Promise<void> {
  if (!isDateKey(date) || date > store.today()) throw new Error('Scegli una data del risveglio valida, non futura.');
  sleepMinutes(bedtime, wakeTime);
  await store.apply([{ table: 'sleepLogs', value: { id: date, date, bedtime, wakeTime, updatedAt: store.nowIso() } }],
    [{ entity: 'sleep', entityId: date, type: 'saved' }], 'Sonno salvato');
}

export async function deleteSleep(store: Store, date: string): Promise<void> {
  await store.apply([{ table: 'sleepLogs', remove: date }],
    [{ entity: 'sleep', entityId: date, type: 'deleted' }], 'Sonno eliminato');
}
