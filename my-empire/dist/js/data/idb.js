import { TABLES } from './db.js';
/** Nuovo archivio della versione 2: indipendente da quello della prima versione. */
const DB_NAME = 'my-empire-v2';
/** Versione dello schema IndexedDB. Ogni nuova tabella → versione +1 e passo in `upgrade`. */
const DB_VERSION = 2; // Aggiunge sleepLogs preservando le tabelle esistenti.
function req(r) {
    return new Promise((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
}
export class IndexedDbDatabase {
    db;
    label = 'IndexedDB su questo dispositivo';
    localOnly = true;
    constructor(db) {
        this.db = db;
    }
    static async open() {
        const open = indexedDB.open(DB_NAME, DB_VERSION);
        open.onupgradeneeded = () => {
            const db = open.result;
            for (const t of TABLES)
                if (!db.objectStoreNames.contains(t))
                    db.createObjectStore(t, { keyPath: 'id' });
        };
        const db = await req(open);
        db.onversionchange = () => db.close();
        return new IndexedDbDatabase(db);
    }
    getAll(table) {
        return req(this.db.transaction(table, 'readonly').objectStore(table).getAll());
    }
    transact(ops) {
        if (ops.length === 0)
            return Promise.resolve();
        const tables = [...new Set(ops.map((o) => o.table))];
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(tables, 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error ?? new Error('Transazione annullata'));
            for (const op of ops) {
                const store = tx.objectStore(op.table);
                if (op.kind === 'put')
                    store.put(op.value);
                else
                    store.delete(op.id);
            }
        });
    }
}
//# sourceMappingURL=idb.js.map