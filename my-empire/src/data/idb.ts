import { TABLES, type Database, type Op, type Row, type TableName } from './db.js';

/** Nuovo archivio della versione 2: indipendente da quello della prima versione. */
const DB_NAME = 'my-empire-v2';
/** Versione dello schema IndexedDB. Ogni nuova tabella → versione +1 e passo in `upgrade`. */
const DB_VERSION = 1; // 2: obiettivi · 3: KPI · 4: basket e palestra

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export class IndexedDbDatabase implements Database {
  readonly label = 'IndexedDB su questo dispositivo';
  readonly localOnly = true;
  private constructor(private db: IDBDatabase) {}

  static async open(): Promise<IndexedDbDatabase> {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const t of TABLES) if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' });
    };
    const db = await req(open);
    db.onversionchange = () => db.close();
    return new IndexedDbDatabase(db);
  }

  getAll(table: TableName): Promise<Row[]> {
    return req(this.db.transaction(table, 'readonly').objectStore(table).getAll() as IDBRequest<Row[]>);
  }

  transact(ops: Op[]): Promise<void> {
    if (ops.length === 0) return Promise.resolve();
    const tables = [...new Set(ops.map((o) => o.table))];
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(tables, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Transazione annullata'));
      for (const op of ops) {
        const store = tx.objectStore(op.table);
        if (op.kind === 'put') store.put(op.value);
        else store.delete(op.id);
      }
    });
  }
}
