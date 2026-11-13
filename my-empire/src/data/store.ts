import { TABLES, type Database, type Op, type Row, type TableName } from './db.js';
import { defaultHabits, defaultSettings, SCHEMA_VERSION } from '../domain/defaults.js';
import { todayKey } from '../domain/dates.js';
import type { BasketGame, BasketWeek, CalEvent, DailyRating, EntityKind, Goal, GoalEntry, GymPlan, GymSession, Habit, HabitLog, HistoryEvent, Settings, SleepLog, WeekNote } from '../domain/types.js';

export interface TableTypes {
  settings: Settings;
  events: HistoryEvent;
  habits: Habit;
  habitLogs: HabitLog;
  ratings: DailyRating;
  calEvents: CalEvent;
  goals: Goal;
  goalEntries: GoalEntry;
  basketGames: BasketGame;
  basketWeeks: BasketWeek;
  gymPlans: GymPlan;
  gymSessions: GymSession;
  weekNotes: WeekNote;
  sleepLogs: SleepLog;
}

export type Change<T extends TableName = TableName> =
  | { table: T; value: TableTypes[T] }
  | { table: T; remove: string };

export interface EventInput {
  entity: EntityKind;
  entityId: string;
  type: string;
  data?: Record<string, unknown>;
}

interface UndoEntry {
  label: string;
  inverse: Change[];
  at: number;
}

export function newId(prefix = ''): string {
  const c = globalThis.crypto;
  const raw = c && 'randomUUID' in c ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix + raw;
}

/**
 * Store: cache in memoria di tutti i dati + scrittura atomica sul database.
 * Ogni modifica passa da `apply`, che:
 *  1. scrive su database in un'unica transazione (dati + eventi di storico);
 *  2. aggiorna la cache solo se la scrittura è riuscita;
 *  3. calcola automaticamente l'operazione inversa per "Annulla".
 */
export class Store {
  private cache = new Map<TableName, Map<string, Row>>(TABLES.map((t) => [t, new Map()]));
  private listeners = new Set<() => void>();
  private undoStack: UndoEntry[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(readonly db: Database, private clock: () => Date = () => new Date()) {}

  now(): Date {
    return this.clock();
  }

  nowIso(): string {
    return this.clock().toISOString();
  }

  today(): string {
    return todayKey(this.clock());
  }

  async load(): Promise<void> {
    for (const t of TABLES) {
      const rows = await this.db.getAll(t);
      const m = this.cache.get(t)!;
      m.clear();
      for (const r of rows) m.set(r.id, r);
    }
    if (!this.cache.get('settings')!.has('settings')) await this.seed();
    else await this.migrate();
  }

  /** Primo avvio: impostazioni e attività iniziali. Nessun dato inventato. */
  private async seed(): Promise<void> {
    const now = this.nowIso();
    const changes: Change[] = [
      { table: 'settings', value: defaultSettings(now) },
      ...defaultHabits(this.today(), now).map((h) => ({ table: 'habits' as const, value: h })),
    ];
    await this.write(changes, [{ entity: 'settings', entityId: 'settings', type: 'initialized' }]);
  }

  /** Aggiornamenti di schema dei dati salvati (nessuno alla versione 1). */
  private async migrate(): Promise<void> {
    if (this.settings().schemaVersion > SCHEMA_VERSION) throw new Error('I dati sono stati salvati da una versione più recente dell\'app.');
  }

  // ─── Lettura ───────────────────────────────────────────────────────────────

  all<T extends TableName>(table: T): TableTypes[T][] {
    return [...this.cache.get(table)!.values()] as TableTypes[T][];
  }

  get<T extends TableName>(table: T, id: string): TableTypes[T] | undefined {
    return this.cache.get(table)!.get(id) as TableTypes[T] | undefined;
  }

  settings(): Settings {
    return this.get('settings', 'settings')!;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  // ─── Scrittura ─────────────────────────────────────────────────────────────

  /**
   * Applica modifiche + eventi di storico. Se `undoLabel` è indicato, l'azione è annullabile.
   * Le scritture sono serializzate: due tocchi rapidi non si sovrappongono.
   */
  apply(changes: Change[], events: EventInput[] = [], undoLabel?: string): Promise<void> {
    const run = async (): Promise<void> => {
      const inverse = this.inverseOf(changes);
      await this.write(changes, events);
      if (undoLabel) {
        this.undoStack.push({ label: undoLabel, inverse, at: Date.now() });
        if (this.undoStack.length > 30) this.undoStack.shift();
      }
      this.emit();
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  private inverseOf(changes: Change[]): Change[] {
    const seen = new Set<string>();
    const inv: Change[] = [];
    for (const c of changes) {
      const id = 'value' in c ? c.value.id : c.remove;
      const key = `${c.table}/${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const prev = this.cache.get(c.table)!.get(id);
      inv.push(prev ? ({ table: c.table, value: structuredClone(prev) } as Change) : { table: c.table, remove: id });
    }
    return inv.reverse();
  }

  private async write(changes: Change[], events: EventInput[]): Promise<void> {
    const at = this.nowIso();
    const evRows: HistoryEvent[] = events.map((e) => ({ id: newId('ev-'), at, ...e }));
    const ops: Op[] = [
      ...changes.map((c): Op => ('value' in c ? { kind: 'put', table: c.table, value: c.value } : { kind: 'delete', table: c.table, id: c.remove })),
      ...evRows.map((e): Op => ({ kind: 'put', table: 'events', value: e })),
    ];
    await this.db.transact(ops);
    for (const c of changes) {
      const t = this.cache.get(c.table)!;
      if ('value' in c) t.set(c.value.id, structuredClone(c.value));
      else t.delete(c.remove);
    }
    const evTable = this.cache.get('events')!;
    for (const e of evRows) evTable.set(e.id, e);
  }

  canUndo(): string | null {
    return this.undoStack.at(-1)?.label ?? null;
  }

  /** Annulla l'ultima azione annullabile. Lo storico registra l'annullamento, non lo cancella. */
  async undo(): Promise<string | null> {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    const ids = entry.inverse.map((c) => ('value' in c ? c.value.id : c.remove));
    const entity = (entry.inverse[0]?.table ?? 'settings') as string;
    await this.apply(entry.inverse, [{ entity: tableEntity(entity as TableName), entityId: ids[0] ?? '', type: 'undo', data: { label: entry.label } }]);
    return entry.label;
  }

  /** Ripristino da un backup esportato: sostituisce tutti i dati in un'unica transazione. */
  async importAll(data: Record<string, unknown>): Promise<number> {
    if (data.app !== 'MY EMPIRE') throw new Error('Il file non è un backup di My Empire.');
    if (typeof data.schemaVersion !== 'number' || data.schemaVersion > SCHEMA_VERSION) throw new Error('Backup di una versione più recente: aggiorna l\'app prima di ripristinarlo.');
    const ops: Op[] = [];
    let n = 0;
    for (const t of TABLES) {
      const rows = data[t];
      if (rows !== undefined && !Array.isArray(rows)) throw new Error(`Backup non valido (${t}).`);
      for (const r of this.all(t)) ops.push({ kind: 'delete', table: t, id: (r as Row).id });
      for (const r of (rows ?? []) as Row[]) {
        if (!r || typeof r.id !== 'string') throw new Error(`Backup non valido: riga senza id in ${t}.`);
        ops.push({ kind: 'put', table: t, value: r });
        n++;
      }
    }
    if (!Array.isArray(data.settings) || !(data.settings as Row[]).some((r) => r.id === 'settings')) throw new Error('Backup non valido: mancano le impostazioni.');
    await this.db.transact(ops);
    this.undoStack = [];
    await this.load();
    this.emit();
    return n;
  }

  /** Esportazione completa e leggibile di tutti i dati. */
  exportAll(): Record<string, unknown> {
    const out: Record<string, unknown> = { app: 'MY EMPIRE', schemaVersion: SCHEMA_VERSION, exportedAt: this.nowIso() };
    for (const t of TABLES) out[t] = this.all(t);
    return out;
  }
}

function tableEntity(t: TableName): EntityKind {
  const map: Record<TableName, EntityKind> = {
    settings: 'settings', events: 'settings', habits: 'habit', habitLogs: 'habitLog', ratings: 'rating', calEvents: 'event',
    goals: 'goal', goalEntries: 'goalEntry', basketGames: 'basketGame', basketWeeks: 'basketWeek', gymPlans: 'gymPlan', gymSessions: 'gymSession', weekNotes: 'weekNote', sleepLogs: 'sleep',
  };
  return map[t];
}
