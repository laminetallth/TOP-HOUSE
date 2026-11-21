/**
 * Livello di accesso ai dati.
 * L'interfaccia `Database` è l'unico punto che conosce DOVE vivono i dati.
 * Oggi: IndexedDB sul dispositivo (idb.ts). Domani: backend con autenticazione
 * (es. Supabase/PostgreSQL) implementando la stessa interfaccia.
 */
export const TABLES = ['settings', 'events', 'habits', 'habitLogs', 'ratings', 'calEvents', 'goals', 'goalEntries', 'basketGames', 'basketWeeks', 'gymPlans', 'gymSessions', 'weekNotes', 'sleepLogs'] as const;
export type TableName = (typeof TABLES)[number];

export interface Row {
  id: string;
}

export type Op =
  | { kind: 'put'; table: TableName; value: Row }
  | { kind: 'delete'; table: TableName; id: string };

export interface Database {
  /** Nome leggibile del tipo di archiviazione (mostrato in Sistema). */
  readonly label: string;
  /** I dati restano solo su questo dispositivo? */
  readonly localOnly: boolean;
  getAll(table: TableName): Promise<Row[]>;
  /** Applica tutte le operazioni in modo atomico: o tutte o nessuna. */
  transact(ops: Op[]): Promise<void>;
}

/** Implementazione in memoria: usata nei test e come ripiego se IndexedDB non è disponibile. */
export class MemoryDatabase implements Database {
  readonly label = 'Memoria temporanea (i dati si perdono alla chiusura)';
  readonly localOnly = true;
  private data = new Map<TableName, Map<string, Row>>(TABLES.map((t) => [t, new Map()]));

  async getAll(table: TableName): Promise<Row[]> {
    return [...this.data.get(table)!.values()].map((r) => structuredClone(r));
  }

  async transact(ops: Op[]): Promise<void> {
    for (const op of ops) {
      const t = this.data.get(op.table)!;
      if (op.kind === 'put') t.set(op.value.id, structuredClone(op.value));
      else t.delete(op.id);
    }
  }
}
