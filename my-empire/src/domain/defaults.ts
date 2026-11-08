import { weekStart, type DateKey } from './dates.js';
import type { Habit, HabitArea, ISO, Schedule, Settings } from './types.js';

export const SCHEMA_VERSION = 1;

/** Id stabili delle attività di sistema: pagine, report e promemoria puntano sempre agli stessi record. */
export const H = {
  declarations: 'h-dichiarazioni',
  skincare: 'h-pelle',
  audiobook: 'h-audiolibro',
  learn: 'h-imparare',
  meditation: 'h-meditazione',
  basket: 'h-basket',
  gym: 'h-palestra',
  creatine: 'h-creatina',
  vitaminD: 'h-vitamina-d',
  momMeds: 'h-medicine-mamma',
  laundry: 'h-bucato',
} as const;

export function defaultSettings(now: ISO): Settings {
  return { id: 'settings', name: 'Lamine', restDates: [], notify: false, adviceDone: [], schemaVersion: SCHEMA_VERSION, createdAt: now };
}

interface Seed {
  id: string;
  name: string;
  icon: string;
  area: HabitArea;
  schedule: Schedule;
  kind?: Habit['kind'];
  dailyTarget?: number;
  reminder?: string;
  extras?: Habit['extras'];
  notePrompt?: string;
  page?: Habit['page'];
  todo?: string;
}

/**
 * Attività iniziali, tutte modificabili.
 * Quelle a giorni fissi partono da oggi: i giorni prima dell'installazione restano "non registrati",
 * mai "non fatti". Quelle a quota settimanale partono dal lunedì, così si conta anche quanto già fatto in settimana.
 */
export function defaultHabits(today: DateKey, now: ISO): Habit[] {
  const seeds: Seed[] = [
    { id: H.declarations, name: 'Dichiarazioni', icon: 'crown', area: 'mente', schedule: { type: 'daily' }, reminder: '08:00', page: 'dichiarazioni' },
    { id: H.creatine, name: 'Creatina', icon: 'flask', area: 'nutrizione', schedule: { type: 'daily' }, reminder: '09:00' },
    { id: H.vitaminD, name: 'Vitamina D', icon: 'sun', area: 'nutrizione', schedule: { type: 'daily' }, reminder: '09:00' },
    { id: H.audiobook, name: 'Audiolibro', icon: 'headphones', area: 'mente', schedule: { type: 'daily' }, kind: 'minutes', dailyTarget: 30 },
    { id: H.basket, name: 'Basket', icon: 'basketball', area: 'sport', schedule: { type: 'days', days: [1, 3, 5] }, extras: ['rating'], notePrompt: 'Com\'è andato l\'allenamento?', page: 'basket' },
    { id: H.gym, name: 'Palestra', icon: 'dumbbell', area: 'sport', schedule: { type: 'weekly', timesPerWeek: 3 }, extras: ['duration', 'rating'], page: 'palestra' },
    { id: H.skincare, name: 'Cura della pelle', icon: 'drop', area: 'corpo', schedule: { type: 'daily' }, reminder: '22:30' },
    { id: H.learn, name: 'Imparare qualcosa di nuovo', icon: 'spark', area: 'mente', schedule: { type: 'daily' }, notePrompt: 'Che cosa hai imparato?' },
    { id: H.meditation, name: 'Meditazione', icon: 'lotus', area: 'mente', schedule: { type: 'weekly', timesPerWeek: 2 }, extras: ['duration'] },
    { id: H.momMeds, name: 'Ricordare le medicine alla mamma', icon: 'heart', area: 'famiglia', schedule: { type: 'interval', every: 2, anchor: today }, reminder: '20:00', todo: 'Conferma il giorno di partenza dei giorni alterni.' },
    { id: H.laundry, name: 'Bucato', icon: 'shirt', area: 'casa', schedule: { type: 'weekly', timesPerWeek: 1 }, todo: 'Scegli quante volte a settimana o in quali giorni.' },
  ];
  return seeds.map((s, i) => ({
    id: s.id, name: s.name, icon: s.icon, area: s.area, kind: s.kind ?? 'check',
    rules: [{ from: s.schedule.type === 'weekly' ? weekStart(today) : today, schedule: s.schedule, dailyTarget: s.dailyTarget }],
    pauses: [], extras: s.extras, notePrompt: s.notePrompt, reminder: s.reminder, page: s.page, todo: s.todo,
    createdAt: now, order: i, system: true,
  }));
}

export const AREA_LABEL: Record<HabitArea, string> = {
  sport: 'Sport', mente: 'Mente', corpo: 'Corpo', nutrizione: 'Nutrizione', casa: 'Casa', famiglia: 'Famiglia', altro: 'Altro',
};
