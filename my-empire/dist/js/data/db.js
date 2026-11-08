/**
 * Livello di accesso ai dati.
 * L'interfaccia `Database` è l'unico punto che conosce DOVE vivono i dati.
 * Oggi: IndexedDB sul dispositivo (idb.ts). Domani: backend con autenticazione
 * (es. Supabase/PostgreSQL) implementando la stessa interfaccia.
 */
export const TABLES = ['settings', 'events', 'habits', 'habitLogs', 'ratings', 'calEvents', 'goals', 'goalEntries', 'basketGames', 'basketWeeks', 'gymPlans', 'gymSessions', 'weekNotes'];
/** Implementazione in memoria: usata nei test e come ripiego se IndexedDB non è disponibile. */
export class MemoryDatabase {
    label = 'Memoria temporanea (i dati si perdono alla chiusura)';
    localOnly = true;
    data = new Map(TABLES.map((t) => [t, new Map()]));
    async getAll(table) {
        return [...this.data.get(table).values()].map((r) => structuredClone(r));
    }
    async transact(ops) {
        for (const op of ops) {
            const t = this.data.get(op.table);
            if (op.kind === 'put')
                t.set(op.value.id, structuredClone(op.value));
            else
                t.delete(op.id);
        }
    }
}
//# sourceMappingURL=db.js.map