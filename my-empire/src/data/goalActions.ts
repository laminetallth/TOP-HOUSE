/** Azioni sugli obiettivi: stesso schema delle altre azioni (storico + annulla). */
import { Store, newId, type Change } from './store.js';
import { ActionError } from './actions.js';
import { createGoal, editGoal, GRANULARITY_HORIZON, validatePlan, type GoalInput, type Granularity, type PlanStep } from '../domain/goals.js';
import { isDateKey, type DateKey } from '../domain/dates.js';
import type { Goal, GoalEntry, GoalStatus } from '../domain/types.js';

function must(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new ActionError(msg);
}

function goal(store: Store, id: string): Goal {
  const g = store.get('goals', id);
  must(g && !g.deletedAt, 'Obiettivo non trovato.');
  return g;
}

function nextOrder(store: Store): number {
  return store.all('goals').reduce((m, g) => Math.max(m, g.order), -1) + 1;
}

export async function addGoal(store: Store, input: GoalInput): Promise<Goal> {
  const g = createGoal(input, newId('g-'), store.nowIso(), store.today(), nextOrder(store));
  await store.apply([{ table: 'goals', value: g }], [{ entity: 'goal', entityId: g.id, type: 'created', data: { title: g.title } }], 'Creazione obiettivo');
  return g;
}

export async function updateGoal(store: Store, id: string, input: GoalInput): Promise<void> {
  const prev = goal(store, id);
  const next = editGoal(prev, input, store.nowIso());
  const keys = (['title', 'description', 'horizon', 'category', 'startDate', 'dueDate', 'baseline', 'target', 'unit', 'notes'] as const).filter((k) => prev[k] !== next[k]);
  if (!keys.length) return;
  await store.apply([{ table: 'goals', value: next }], [{ entity: 'goal', entityId: id, type: 'edited', data: Object.fromEntries(keys.map((k) => [k, { from: prev[k] ?? null, to: next[k] ?? null }])) }], 'Modifica obiettivo');
}

/** Registra il valore misurato in una data (sostituisce quello dello stesso giorno). */
export async function recordGoalValue(store: Store, goalId: string, date: DateKey, value: number, note?: string): Promise<void> {
  const g = goal(store, goalId);
  must(isDateKey(date), 'Data non valida.');
  must(date <= store.today(), 'Non si possono registrare valori futuri.');
  must(Number.isFinite(value), 'Valore non valido.');
  must(g.target !== undefined, 'Questo obiettivo non ha un risultato numerico.');
  const id = `${goalId}:${date}`;
  const prev = store.get('goalEntries', id);
  const entry: GoalEntry = { id, goalId, date, value, note: note?.trim() || undefined, updatedAt: store.nowIso() };
  await store.apply([{ table: 'goalEntries', value: entry }], [{ entity: 'goalEntry', entityId: id, type: 'value', data: { goal: g.title, date, from: prev?.value ?? null, to: value } }], 'Valore registrato');
}

export async function clearGoalValue(store: Store, goalId: string, date: DateKey): Promise<void> {
  const id = `${goalId}:${date}`;
  if (!store.get('goalEntries', id)) return;
  await store.apply([{ table: 'goalEntries', remove: id }], [{ entity: 'goalEntry', entityId: id, type: 'cleared', data: { date } }], 'Valore rimosso');
}

export async function setGoalStatus(store: Store, id: string, status: GoalStatus): Promise<void> {
  const prev = goal(store, id);
  if (prev.status === status) return;
  const now = store.nowIso();
  const next: Goal = { ...prev, status, achievedAt: status === 'achieved' ? now : undefined, updatedAt: now };
  await store.apply([{ table: 'goals', value: next }], [{ entity: 'goal', entityId: id, type: 'status', data: { from: prev.status, to: status } }], 'Stato obiettivo');
}

export async function addGoalReview(store: Store, id: string, text: string): Promise<void> {
  const t = text.trim();
  must(t.length > 0 && t.length <= 2000, 'Scrivi la revisione (massimo 2000 caratteri).');
  const prev = goal(store, id);
  const now = store.nowIso();
  await store.apply([{ table: 'goals', value: { ...prev, reviews: [...prev.reviews, { at: now, text: t }], updatedAt: now } }], [{ entity: 'goal', entityId: id, type: 'review' }], 'Revisione salvata');
}

/** Elimina l'obiettivo e le sue tappe (nel cestino, ripristinabili insieme). */
export async function deleteGoal(store: Store, id: string): Promise<void> {
  const g = goal(store, id);
  const at = store.nowIso();
  const kids = store.all('goals').filter((x) => x.parentId === id && !x.deletedAt);
  const changes: Change[] = [g, ...kids].map((x) => ({ table: 'goals', value: { ...x, deletedAt: at } }));
  await store.apply(changes, [{ entity: 'goal', entityId: id, type: 'deleted', data: { tappe: kids.length } }], 'Eliminazione obiettivo');
}

export async function restoreGoal(store: Store, id: string): Promise<void> {
  const g = store.get('goals', id);
  must(g?.deletedAt, 'Obiettivo non trovato nel cestino.');
  const at = g.deletedAt;
  const same = store.all('goals').filter((x) => x.id === id || (x.parentId === id && x.deletedAt === at));
  const changes: Change[] = same.map((x) => {
    const { deletedAt: _d, ...rest } = x;
    return { table: 'goals', value: rest as Goal };
  });
  await store.apply(changes, [{ entity: 'goal', entityId: id, type: 'restored' }], 'Ripristino obiettivo');
}

export interface ApplyPlanOptions {
  granularity: Granularity;
  base: number;
  replaceExisting: boolean;
}

/** Conferma esplicita del piano: crea le tappe in un'unica operazione annullabile. */
export async function applyPlan(store: Store, goalId: string, steps: PlanStep[], opts: ApplyPlanOptions): Promise<number> {
  const g = goal(store, goalId);
  must(g.target !== undefined && g.dueDate, 'Servono risultato desiderato e scadenza.');
  const err = validatePlan(steps, { start: g.startDate < store.today() ? store.today() : g.startDate, due: g.dueDate, base: opts.base, target: g.target });
  must(!err, err ?? '');
  const now = store.nowIso();
  const today = store.today();
  const changes: Change[] = [];
  const existing = store.all('goals').filter((x) => x.parentId === goalId && !x.deletedAt && x.status === 'active');
  if (existing.length && !opts.replaceExisting) throw new ActionError(`Ci sono già ${existing.length} tappe attive: scegli se sostituirle.`);
  for (const x of existing) changes.push({ table: 'goals', value: { ...x, status: 'abandoned', updatedAt: now } });
  let order = nextOrder(store);
  let prevDate = today;
  steps.forEach((s, i) => {
    const child = createGoal({ title: `${g.title} · tappa ${i + 1}`, horizon: GRANULARITY_HORIZON[opts.granularity], category: g.category, startDate: prevDate, dueDate: s.date, target: s.value, unit: g.unit, parentId: goalId }, newId('g-'), now, today, order++);
    changes.push({ table: 'goals', value: child });
    prevDate = s.date;
  });
  await store.apply(changes, [{ entity: 'goal', entityId: goalId, type: 'planned', data: { tappe: steps.length } }], 'Pianificazione obiettivo');
  return steps.length;
}
