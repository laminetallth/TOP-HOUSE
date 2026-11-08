import { MemoryDatabase } from './data/db.js';
import { IndexedDbDatabase } from './data/idb.js';
import { Store } from './data/store.js';
import { App, route } from './ui/app.js';
import { h } from './ui/dom.js';
import { registerSw, scheduleReminders } from './ui/reminders.js';
import { todayView } from './ui/views/today.js';
import { calendarView } from './ui/views/calendar.js';
import { activitiesView, activityView } from './ui/views/activities.js';
import { basketView, gymView } from './ui/views/sport.js';
import { declarationsView } from './ui/views/declarations.js';
import { moneyView, nutritionView } from './ui/views/ratings.js';
import { reportView } from './ui/views/report.js';
import { goalDetailView, goalsView } from './ui/views/goals.js';
import { adviceView } from './ui/views/advice.js';
import { settingsView } from './ui/views/settings.js';
const routes = [
    route('/oggi', 'oggi', todayView),
    route('/calendario', 'calendario', calendarView),
    route('/calendario/:date', 'calendario', calendarView),
    route('/attivita', 'attivita', activitiesView),
    route('/attivita/:id', 'attivita', activityView),
    route('/basket', 'attivita', basketView),
    route('/palestra', 'attivita', gymView),
    route('/dichiarazioni', 'attivita', declarationsView),
    route('/report', 'report', reportView),
    route('/report/:date', 'report', reportView),
    route('/obiettivi', 'obiettivi', goalsView),
    route('/obiettivi/:id', 'obiettivi', goalDetailView),
    route('/nutrizione', 'nutrizione', nutritionView),
    route('/soldi', 'soldi', moneyView),
    route('/consigli', 'consigli', adviceView),
    route('/impostazioni', 'impostazioni', settingsView),
];
async function openDatabase() {
    try {
        if (!('indexedDB' in globalThis))
            throw new Error('IndexedDB non disponibile');
        return { db: await IndexedDbDatabase.open() };
    }
    catch (e) {
        console.error(e);
        return { db: new MemoryDatabase(), warning: 'Questo browser non permette di salvare i dati (navigazione privata?). Le modifiche andranno perse alla chiusura.' };
    }
}
async function boot() {
    const root = document.getElementById('app');
    try {
        const { db, warning } = await openDatabase();
        const store = new Store(db);
        await store.load();
        const app = new App(store, routes, root);
        app.start();
        void registerSw();
        let t = 0;
        const plan = () => {
            clearTimeout(t);
            t = window.setTimeout(() => scheduleReminders(app), 400);
        };
        store.subscribe(plan);
        app.onDayChange(plan);
        plan();
        if (warning)
            app.toast(warning, { error: true });
    }
    catch (e) {
        console.error(e);
        root.replaceChildren(h('div', { class: 'boot-error' }, h('h1', null, 'My Empire non si è avviato'), h('p', null, String(e.message ?? e)), h('p', { class: 'muted' }, 'I dati salvati non sono stati modificati. Ricarica la pagina.')));
    }
}
void boot();
//# sourceMappingURL=main.js.map