import { parseTime } from './dates.js';

/** Durata sugli orari segnati: se il risveglio precede il sonno, si passa mezzanotte. */
export function sleepMinutes(bedtime: string, wakeTime: string): number {
  const bed = parseTime(bedtime);
  const wake = parseTime(wakeTime);
  if (bed === null || wake === null) throw new Error('Inserisci entrambi gli orari validi.');
  if (bed === wake) throw new Error('Gli orari di sonno e risveglio devono essere diversi.');
  return (wake - bed + 1440) % 1440;
}

export function sleepDuration(minutes: number): string {
  const n = Math.round(minutes);
  return `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, '0')} min`;
}
