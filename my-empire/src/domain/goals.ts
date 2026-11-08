import { addDays, diffDays, isDateKey, isoWeekday, monthEnd, type DateKey } from './dates.js';
import type { Goal, GoalEntry, GoalHorizon, GoalStatus, ID, ISO } from './types.js';

export const HORIZON_LABEL: Record<GoalHorizon, string> = {
  long: 'Lungo periodo',
  annual: 'Annuale',
  quarterly: 'Trimestrale',
  monthly: 'Mensile',
  weekly: 'Settimanale',
};

export const HORIZON_ORDER: GoalHorizon[] = ['long', 'annual', 'quarterly', 'monthly', 'weekly'];

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  active: 'Attivo',
  achieved: 'Raggiunto',
  paused: 'In pausa',
  abandoned: 'Abbandonato',
};

// ─── Creazione e validazione ─────────────────────────────────────────────────

export interface GoalInput {
  title: string;
  description?: string;
  horizon?: GoalHorizon;
  category?: string;
  startDate?: DateKey;
  dueDate?: DateKey;
  baseline?: number;
  target?: number;
  unit?: string;
  notes?: string;
  parentId?: ID;
}

export type GoalErrors = Partial<Record<keyof GoalInput, string>>;

export function validateGoal(i: GoalInput): GoalErrors {
  const e: GoalErrors = {};
  const t = (i.title ?? '').trim();
  if (!t) e.title = 'Il titolo è obbligatorio.';
  else if (t.length > 200) e.title = 'Massimo 200 caratteri.';
  if (i.startDate !== undefined && !isDateKey(i.startDate)) e.startDate = 'Data di inizio non valida.';
  if (i.dueDate !== undefined && !isDateKey(i.dueDate)) e.dueDate = 'Scadenza non valida.';
  if (i.startDate && i.dueDate && isDateKey(i.startDate) && isDateKey(i.dueDate) && i.dueDate < i.startDate) e.dueDate = 'La scadenza precede la data di inizio.';
  if (i.target !== undefined && !Number.isFinite(i.target)) e.target = 'Risultato desiderato non valido.';
  if (i.baseline !== undefined && !Number.isFinite(i.baseline)) e.baseline = 'Valore di partenza non valido.';
  if (i.baseline !== undefined && i.target === undefined) e.baseline = 'Indica anche il risultato desiderato.';
  if (i.baseline !== undefined && i.target !== undefined && i.baseline === i.target) e.target = 'Il risultato desiderato coincide con il valore di partenza.';
  return e;
}

function clean(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t ? t : undefined;
}

export function createGoal(i: GoalInput, id: ID, now: ISO, today: DateKey, order: number): Goal {
  const err = validateGoal(i);
  if (Object.keys(err).length) throw new Error(Object.values(err)[0]);
  return {
    id,
    title: i.title.trim(),
    description: clean(i.description),
    horizon: i.horizon ?? 'annual',
    category: clean(i.category),
    startDate: i.startDate ?? today,
    dueDate: i.dueDate,
    baseline: i.baseline,
    target: i.target,
    unit: clean(i.unit),
    status: 'active',
    notes: clean(i.notes),
    reviews: [],
    parentId: i.parentId,
    createdAt: now,
    updatedAt: now,
    order,
  };
}

export function editGoal(g: Goal, i: GoalInput, now: ISO): Goal {
  const err = validateGoal({ ...i, startDate: i.startDate ?? g.startDate });
  if (Object.keys(err).length) throw new Error(Object.values(err)[0]);
  return {
    ...g,
    title: i.title.trim(),
    description: clean(i.description),
    horizon: i.horizon ?? g.horizon,
    category: clean(i.category),
    startDate: i.startDate ?? g.startDate,
    dueDate: i.dueDate,
    baseline: i.baseline,
    target: i.target,
    unit: clean(i.unit),
    notes: clean(i.notes),
    updatedAt: now,
  };
}

// ─── Valori e avanzamento ────────────────────────────────────────────────────

export function entriesFor(entries: GoalEntry[], goalId: ID): GoalEntry[] {
  return entries.filter((e) => e.goalId === goalId).sort((a, b) => a.date.localeCompare(b.date));
}

/** Ultimo valore misurato (per data), oppure null se non è mai stato registrato. */
export function currentValue(entries: GoalEntry[], goalId: ID): GoalEntry | null {
  let last: GoalEntry | null = null;
  for (const e of entries) if (e.goalId === goalId && (!last || e.date > last.date)) last = e;
  return last;
}

export function isIncreasing(g: Pick<Goal, 'baseline' | 'target'>): boolean {
  return (g.target ?? 0) >= (g.baseline ?? 0);
}

/**
 * Avanzamento 0..1 = (attuale − partenza) / (desiderato − partenza).
 * Funziona anche per obiettivi in discesa (es. peso 86,5 → 83).
 * null se manca il risultato desiderato o non c'è alcun valore registrato.
 */
export function goalProgress(g: Pick<Goal, 'baseline' | 'target'>, current: number | null): number | null {
  if (g.target === undefined || current === null) return null;
  const base = g.baseline ?? 0;
  if (g.target === base) return current === g.target ? 1 : 0;
  return Math.max(0, Math.min(1, (current - base) / (g.target - base)));
}

export function isReached(g: Pick<Goal, 'baseline' | 'target'>, current: number | null): boolean {
  if (g.target === undefined || current === null) return false;
  return isIncreasing(g) ? current >= g.target : current <= g.target;
}

export function isGoalOverdue(g: Goal, today: DateKey): boolean {
  return !g.deletedAt && g.status === 'active' && !!g.dueDate && g.dueDate < today;
}

const DAYS_PER_MONTH = 30.44;

export interface Pace {
  perDay: number;
  perWeek: number;
  perMonth: number;
}

function pace(perDay: number): Pace {
  return { perDay, perWeek: perDay * 7, perMonth: perDay * DAYS_PER_MONTH };
}

/** Ritmo necessario da oggi alla scadenza per arrivare al risultato desiderato. */
export function requiredPace(g: Goal, current: number | null, today: DateKey): (Pace & { remaining: number; daysLeft: number }) | null {
  if (g.target === undefined || !g.dueDate) return null;
  const daysLeft = diffDays(today, g.dueDate);
  if (daysLeft <= 0) return null;
  const from = current ?? g.baseline ?? 0;
  const remaining = g.target - from;
  return { ...pace(remaining / daysLeft), remaining, daysLeft };
}

/**
 * Ritmo osservato: differenza tra la prima e l'ultima misurazione divisa per i giorni trascorsi.
 * Serve almeno due misurazioni in giorni diversi.
 */
export function observedPace(entries: GoalEntry[]): (Pace & { from: DateKey; to: DateKey; count: number }) | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = diffDays(first.date, last.date);
  if (span < 1) return null;
  return { ...pace((last.value - first.value) / span), from: first.date, to: last.date, count: sorted.length };
}

/** Proiezione lineare dell'ultimo valore al ritmo osservato. È una stima, non un dato. */
export function projectAt(entries: GoalEntry[], date: DateKey): number | null {
  const p = observedPace(entries);
  if (!p) return null;
  const last = [...entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!;
  return last.value + p.perDay * diffDays(last.date, date);
}

// ─── Pianificazione inversa ──────────────────────────────────────────────────

export type Granularity = 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type Curve = 'linear' | 'accelerating';

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  weekly: 'Settimanali',
  monthly: 'Mensili',
  quarterly: 'Trimestrali',
  annual: 'Annuali',
};

export const GRANULARITY_HORIZON: Record<Granularity, GoalHorizon> = {
  weekly: 'weekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  annual: 'annual',
};

export interface PlanParams {
  start: DateKey;
  due: DateKey;
  base: number;
  target: number;
  granularity: Granularity;
  curve: Curve;
}

export interface PlanStep {
  date: DateKey;
  value: number;
}

export const MAX_STEPS = 60;

export function autoGranularity(start: DateKey, due: DateKey): Granularity {
  const d = diffDays(start, due);
  if (d <= 56) return 'weekly';
  if (d <= 548) return 'monthly';
  if (d <= 1826) return 'quarterly';
  return 'annual';
}

/** Distanza minima di una tappa dall'inizio e dalla scadenza, per non creare tappe di pochi giorni. */
const MIN_GAP: Record<Granularity, number> = { weekly: 2, monthly: 10, quarterly: 30, annual: 90 };

function nextPeriodEnd(k: DateKey, g: Granularity): DateKey {
  switch (g) {
    case 'weekly': {
      const sunday = addDays(k, 7 - isoWeekday(k));
      return sunday > k ? sunday : addDays(sunday, 7);
    }
    case 'monthly': {
      const end = monthEnd(k);
      return end > k ? end : monthEnd(addDays(end, 1));
    }
    case 'quarterly': {
      let cur = monthEnd(k);
      while (cur <= k || ![3, 6, 9, 12].includes(Number(cur.slice(5, 7)))) cur = monthEnd(addDays(cur, 1));
      return cur;
    }
    case 'annual': {
      const end = `${k.slice(0, 4)}-12-31`;
      return end > k ? end : `${Number(k.slice(0, 4)) + 1}-12-31`;
    }
  }
}

/** Date delle tappe: fine di ogni periodo tra inizio e scadenza, più la scadenza stessa. */
export function checkpointDates(start: DateKey, due: DateKey, g: Granularity): DateKey[] {
  if (!(due > start)) return [];
  const out: DateKey[] = [];
  for (let cp = nextPeriodEnd(start, g); cp < due; cp = nextPeriodEnd(cp, g)) {
    if (diffDays(start, cp) >= MIN_GAP[g] && diffDays(cp, due) >= MIN_GAP[g]) out.push(cp);
  }
  out.push(due);
  return out;
}

function decimalsFor(base: number, target: number): number {
  return Number.isInteger(base) && Number.isInteger(target) ? 0 : 1;
}

function roundTo(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/**
 * Tappe proposte. Ipotesi dichiarate:
 *  - lineare: stesso progresso in ogni periodo;
 *  - in accelerazione: progresso = (tempo trascorso)², parte piano e cresce.
 * Valori arrotondati come il risultato desiderato, sempre nella stessa direzione, l'ultima tappa = obiettivo.
 */
export function planCheckpoints(p: PlanParams): PlanStep[] {
  let g = p.granularity;
  let dates = checkpointDates(p.start, p.due, g);
  const coarser: Granularity[] = ['weekly', 'monthly', 'quarterly', 'annual'];
  while (dates.length > MAX_STEPS && g !== 'annual') {
    g = coarser[coarser.indexOf(g) + 1];
    dates = checkpointDates(p.start, p.due, g);
  }
  const total = diffDays(p.start, p.due);
  if (total <= 0) return [];
  const dec = decimalsFor(p.base, p.target);
  const up = p.target >= p.base;
  let prev = p.base;
  return dates.map((date, i) => {
    const f = diffDays(p.start, date) / total;
    const share = p.curve === 'accelerating' ? f * f : f;
    let v = i === dates.length - 1 ? p.target : roundTo(p.base + (p.target - p.base) * share, dec);
    v = up ? Math.max(v, prev) : Math.min(v, prev);
    prev = v;
    return { date, value: v };
  });
}

/** Controlla le tappe modificate a mano prima della conferma. */
export function validatePlan(steps: PlanStep[], p: Pick<PlanParams, 'start' | 'due' | 'base' | 'target'>): string | null {
  if (steps.length === 0) return 'Nessuna tappa da creare.';
  const up = p.target >= p.base;
  let prevDate = p.start;
  let prevVal = p.base;
  for (const s of steps) {
    if (!isDateKey(s.date)) return 'Una tappa ha una data non valida.';
    if (s.date <= prevDate) return 'Le date delle tappe devono essere in ordine e dopo la data di inizio.';
    if (s.date > p.due) return 'Una tappa supera la scadenza dell\'obiettivo.';
    if (!Number.isFinite(s.value)) return 'Una tappa ha un valore non valido.';
    if (up ? s.value < prevVal : s.value > prevVal) return up ? 'I valori delle tappe non possono diminuire.' : 'I valori delle tappe non possono aumentare.';
    prevDate = s.date;
    prevVal = s.value;
  }
  return null;
}

const fmt = (n: number): string => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });

export interface PlanNotes {
  hypotheses: string[];
  risks: string[];
}

/** Ipotesi e rischi del piano, basati solo su dati registrati. */
export function planNotes(g: Goal, entries: GoalEntry[], p: PlanParams, today: DateKey): PlanNotes {
  const unit = g.unit ? ` ${g.unit}` : '';
  const cur = entries.length ? [...entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1)! : null;
  const hypotheses: string[] = [];
  const risks: string[] = [];
  if (cur && cur.value === p.base) hypotheses.push(`Partenza: ${fmt(p.base)}${unit}, ultimo valore registrato.`);
  else if (g.baseline !== undefined && g.baseline === p.base) hypotheses.push(`Partenza: ${fmt(p.base)}${unit}, valore di partenza dell'obiettivo.`);
  else hypotheses.push(`Partenza: ${fmt(p.base)}${unit}, indicata da te per questa simulazione.`);
  hypotheses.push(p.curve === 'linear' ? 'Progresso costante: lo stesso avanzamento in ogni periodo.' : 'Progresso in accelerazione: si parte piano e si cresce verso la scadenza.');
  const months = diffDays(p.start, p.due) / DAYS_PER_MONTH;
  if (months > 0) hypotheses.push(`Ritmo medio richiesto: ${fmt((p.target - p.base) / months)}${unit} al mese.`);

  if (!cur && g.baseline === undefined) risks.push('Nessun valore registrato: la partenza è un\'ipotesi. Registra il valore attuale per un piano affidabile.');
  const obs = observedPace(entries);
  if (obs) {
    const projected = projectAt(entries, p.due)!;
    const short = isIncreasing(g) ? projected < p.target : projected > p.target;
    if (short) risks.push(`Al ritmo registrato finora (${fmt(obs.perMonth)}${unit} al mese) arriveresti a circa ${fmt(projected)}${unit} alla scadenza.`);
  } else if (cur) {
    risks.push('Con una sola misurazione non si può ancora stimare il ritmo reale.');
  }
  const daysLeft = diffDays(today, p.due);
  if (daysLeft < 14) risks.push('Meno di due settimane alla scadenza: valuta se ripianificare.');
  if (months > 36) risks.push('Orizzonte lungo: rivedi il piano almeno una volta all\'anno.');
  return { hypotheses, risks };
}
