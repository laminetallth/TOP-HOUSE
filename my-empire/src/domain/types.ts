import type { DateKey } from './dates.js';

export type ID = string;
/** Timestamp ISO 8601 (UTC). */
export type ISO = string;

// ─── Storico ─────────────────────────────────────────────────────────────────

export type EntityKind = 'settings' | 'habit' | 'habitLog' | 'rating' | 'event' | 'goal' | 'goalEntry' | 'basketGame' | 'basketWeek' | 'gymPlan' | 'gymSession' | 'weekNote';

export interface HistoryEvent {
  id: ID;
  at: ISO;
  entity: EntityKind;
  entityId: ID;
  type: string;
  data?: Record<string, unknown>;
}

// ─── Attività (abitudini) ────────────────────────────────────────────────────

/**
 * check   = fatto / non fatto
 * minutes = minuti nel giorno (es. audiolibro), con obiettivo giornaliero
 * count   = quantità nel giorno, con unità
 */
export type HabitKind = 'check' | 'minutes' | 'count';

export type Schedule =
  | { type: 'daily' }
  | { type: 'days'; days: number[] }                  // giorni ISO 1..7
  | { type: 'weekly'; timesPerWeek: number }          // N volte a settimana, giorni liberi
  | { type: 'interval'; every: number; anchor: DateKey }; // ogni N giorni a partire da anchor (es. giorni alterni)

export interface HabitRule {
  from: DateKey;
  schedule: Schedule;
  dailyTarget?: number;
  weeklyMinutes?: number;
}

export interface Pause {
  from: DateKey;
  to: DateKey;
  reason?: string;
}

export type HabitArea = 'sport' | 'mente' | 'corpo' | 'nutrizione' | 'casa' | 'famiglia' | 'altro';

export interface Habit {
  id: ID;
  name: string;
  icon: string;
  kind: HabitKind;
  area: HabitArea;
  rules: HabitRule[];
  pauses: Pause[];
  notePrompt?: string;
  extras?: ('duration' | 'rating')[];
  unit?: string;
  /** Orario del promemoria "HH:MM" (facoltativo). */
  reminder?: string;
  /** Pagina dedicata (basket, palestra, dichiarazioni). */
  page?: 'basket' | 'palestra' | 'dichiarazioni';
  /** Testo da completare in impostazioni (es. giorno di partenza da confermare). */
  todo?: string;
  createdAt: ISO;
  archivedAt?: ISO;
  order: number;
  system?: boolean;
}

export interface HabitLog {
  /** `${habitId}:${date}` */
  id: ID;
  habitId: ID;
  date: DateKey;
  value: number;
  skipped?: boolean;
  note?: string;
  duration?: number;
  rating?: number;
  createdAt: ISO;
  updatedAt: ISO;
}

// ─── Voti giornalieri ────────────────────────────────────────────────────────

export type RatingKind = 'food' | 'money' | 'day';

export interface DailyRating {
  /** `${kind}:${date}` */
  id: ID;
  kind: RatingKind;
  date: DateKey;
  value: number;
  note?: string;
  updatedAt: ISO;
}

// ─── Calendario ──────────────────────────────────────────────────────────────

export type Repeat =
  | { type: 'none' }
  | { type: 'daily' }
  | { type: 'weekly'; days: number[] }
  | { type: 'interval'; every: number }
  | { type: 'monthly' }
  | { type: 'yearly' };

export type EventColor = 'aurora' | 'gold' | 'rose' | 'sky' | 'lime';

export interface CalEvent {
  id: ID;
  title: string;
  date: DateKey;
  /** "HH:MM", assente = tutto il giorno. */
  start?: string;
  end?: string;
  location?: string;
  note?: string;
  repeat: Repeat;
  /** Fine della ripetizione (inclusa). */
  until?: DateKey;
  /** Minuti di anticipo del promemoria (assente = nessun promemoria). */
  remind?: number;
  /** Promemoria da spuntare (come una cosa da fare). */
  task?: boolean;
  /** Date delle occorrenze completate (solo se task). */
  doneDates: DateKey[];
  /** Occorrenze annullate di un evento ripetuto. */
  skipDates: DateKey[];
  color: EventColor;
  createdAt: ISO;
  updatedAt: ISO;
  deletedAt?: ISO;
}

// ─── Obiettivi ───────────────────────────────────────────────────────────────

export type GoalHorizon = 'long' | 'annual' | 'quarterly' | 'monthly' | 'weekly';
export type GoalStatus = 'active' | 'achieved' | 'paused' | 'abandoned';

export interface GoalReview {
  at: ISO;
  text: string;
}

export interface Goal {
  id: ID;
  title: string;
  description?: string;
  horizon: GoalHorizon;
  category?: string;
  startDate: DateKey;
  dueDate?: DateKey;
  baseline?: number;
  target?: number;
  unit?: string;
  status: GoalStatus;
  notes?: string;
  reviews: GoalReview[];
  parentId?: ID;
  createdAt: ISO;
  updatedAt: ISO;
  achievedAt?: ISO;
  deletedAt?: ISO;
  order: number;
  kpiId?: ID;
}

export interface GoalEntry {
  id: ID;
  goalId: ID;
  date: DateKey;
  value: number;
  note?: string;
  updatedAt: ISO;
}

// ─── Sport ───────────────────────────────────────────────────────────────────

export interface BasketGame {
  id: ID;
  date: DateKey;
  opponent: string;
  /** Partita in programma (non ancora giocata): niente statistiche. */
  scheduled?: boolean;
  time?: string;
  place?: string;
  minutes: number;
  fg2m: number; fg2a: number;
  fg3m: number; fg3a: number;
  ftm: number; fta: number;
  reb: number;
  ast: number;
  tov: number;
  rating?: number;
  note?: string;
  createdAt: ISO;
  updatedAt: ISO;
  deletedAt?: ISO;
}

export interface BasketWeek {
  id: ID;
  weekStart: DateKey;
  focus?: string;
  review?: number;
  reviewNote?: string;
  updatedAt: ISO;
}

export interface GymSet {
  reps: number;
  kg?: number;
}

export interface GymExercise {
  name: string;
  sets: GymSet[];
}

/** Esercizio della scheda: obiettivo di serie e ripetizioni scritto da te. */
export interface PlanExercise {
  name: string;
  sets: number;
  reps: string; // es. "8-10" o "12"
  rest?: string;
  note?: string;
}

export interface GymPlanDay {
  id: ID;
  name: string; // es. "Giorno A · Petto e tricipiti"
  exercises: PlanExercise[];
}

/** La tua scheda (una attiva alla volta; le precedenti restano in archivio). */
export interface GymPlan {
  id: ID;
  name: string;
  days: GymPlanDay[];
  active: boolean;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface GymSession {
  /** `gym:${date}` */
  id: ID;
  date: DateKey;
  workout?: string;
  planDayId?: ID;
  duration?: number;
  rating?: number;
  exercises: GymExercise[];
  note?: string;
  updatedAt: ISO;
}

// ─── Report ──────────────────────────────────────────────────────────────────

export interface WeekNote {
  /** `wn:${weekStart}` */
  id: ID;
  weekStart: DateKey;
  best?: string;
  obstacle?: string;
  next?: string;
  updatedAt: ISO;
}

// ─── Impostazioni ────────────────────────────────────────────────────────────

export interface Settings {
  id: 'settings';
  name: string;
  restDates: DateKey[];
  /** Notifiche del browser abilitate dall'utente. */
  notify: boolean;
  /** Consigli già aggiunti o nascosti. */
  adviceDone: string[];
  schemaVersion: number;
  createdAt: ISO;
}
