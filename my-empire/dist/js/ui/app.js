import { ActionError } from '../data/actions.js';
import { cx, h } from './dom.js';
import { icon } from './icons.js';
import { button } from './components.js';
import { haptic, installRipples, reduced } from './fx.js';
export const NAV = [
    { id: 'oggi', label: 'Oggi', icon: 'today', path: '/oggi', primary: true },
    { id: 'calendario', label: 'Calendario', icon: 'calendar', path: '/calendario', primary: true },
    { id: 'attivita', label: 'Attività', icon: 'grid', path: '/attivita', primary: true },
    { id: 'report', label: 'Report', icon: 'report', path: '/report', primary: true },
    { id: 'obiettivi', label: 'Obiettivi', icon: 'target', path: '/obiettivi', primary: false },
    { id: 'nutrizione', label: 'Nutrizione', icon: 'leaf', path: '/nutrizione', primary: false },
    { id: 'soldi', label: 'Soldi', icon: 'wallet', path: '/soldi', primary: false },
    { id: 'consigli', label: 'Consigli', icon: 'bulb', path: '/consigli', primary: false },
    { id: 'impostazioni', label: 'Impostazioni', icon: 'settings', path: '/impostazioni', primary: false },
];
export function route(path, area, view) {
    const keys = [];
    const src = path.replace(/:([a-zA-Z]+)/g, (_, k) => {
        keys.push(k);
        return '([^/]+)';
    });
    return { pattern: new RegExp(`^${src}$`), keys, area, view };
}
export class App {
    store;
    routes;
    root;
    today;
    entering = true;
    main;
    layer;
    toastEl;
    toastTimer = 0;
    navEls = [];
    indicator;
    renderQueued = false;
    currentPath = '';
    dayListeners = new Set();
    constructor(store, routes, root) {
        this.store = store;
        this.routes = routes;
        this.root = root;
        this.today = store.today();
    }
    onDayChange(fn) {
        this.dayListeners.add(fn);
    }
    start() {
        this.buildShell();
        installRipples();
        this.store.subscribe(() => this.queueRender());
        window.addEventListener('hashchange', () => this.navigate());
        const tick = () => {
            if (this.store.today() !== this.today) {
                this.today = this.store.today();
                for (const f of this.dayListeners)
                    f();
                this.queueRender();
            }
        };
        setInterval(tick, 30_000);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible')
                tick();
        });
        if (!location.hash)
            history.replaceState(null, '', '#/oggi');
        this.render(true);
    }
    go(path) {
        if (location.hash === `#${path}`)
            this.render(false);
        else
            location.hash = path;
    }
    navigate() {
        const doc = document;
        if (doc.startViewTransition && !reduced())
            doc.startViewTransition(() => this.render(true));
        else
            this.render(true);
    }
    // ─── Struttura ─────────────────────────────────────────────────────────────
    buildShell() {
        const sideItem = (a) => {
            const el = h('a', { href: `#${a.path}`, class: 'nav-side', dataset: { area: a.id } }, icon(a.icon, 19), h('span', null, a.label));
            this.navEls.push(el);
            return el;
        };
        const side = h('nav', { class: 'sidebar', attrs: { 'aria-label': 'Sezioni' } }, h('a', { href: '#/oggi', class: 'brand' }, h('span', { class: 'brand-mark' }, icon('crown', 18)), h('span', { class: 'brand-name' }, 'My Empire')), h('div', { class: 'side-group' }, ...NAV.filter((a) => a.primary).map(sideItem)), h('div', { class: 'side-group' }, ...NAV.filter((a) => !a.primary).map(sideItem)), h('div', { class: 'side-foot' }, icon('lock', 13), h('span', null, 'Dati salvati su questo dispositivo')));
        const bottomItem = (a) => {
            const el = h('a', { href: `#${a.path}`, class: 'nav-bottom', dataset: { area: a.id } }, icon(a.icon, 22), h('span', null, a.label));
            this.navEls.push(el);
            return el;
        };
        const more = h('button', { type: 'button', class: 'nav-bottom', dataset: { area: 'altro' }, on: { click: () => this.openMore() } }, icon('more', 22), h('span', null, 'Altro'));
        this.navEls.push(more);
        this.indicator = h('span', { class: 'nav-indicator', attrs: { 'aria-hidden': 'true' } });
        const bottom = h('nav', { class: 'bottombar', attrs: { 'aria-label': 'Sezioni principali' } }, this.indicator, ...NAV.filter((a) => a.primary).map(bottomItem), more);
        this.main = h('main', { class: 'main', id: 'main', attrs: { tabindex: -1 } });
        this.layer = h('div', { class: 'layer' });
        this.toastEl = h('div', { class: 'toast', attrs: { role: 'status', 'aria-live': 'polite' } });
        const aurora = h('div', { class: 'aurora', attrs: { 'aria-hidden': 'true' } }, h('i', { class: 'a1' }), h('i', { class: 'a2' }), h('i', { class: 'a3' }), h('i', { class: 'grain' }));
        this.root.replaceChildren(aurora, h('div', { class: 'shell' }, side, h('div', { class: 'content' }, this.main)), bottom, this.layer, this.toastEl);
    }
    openMore() {
        haptic();
        this.sheet('Altro', (close) => h('div', { class: 'more-grid' }, ...NAV.filter((a) => !a.primary).map((a, i) => h('a', { href: `#${a.path}`, class: 'more-item tap', style: `--i:${i}`, on: { click: () => close() } }, h('span', { class: 'more-icon' }, icon(a.icon, 22)), h('span', null, a.label)))));
    }
    // ─── Rendering ─────────────────────────────────────────────────────────────
    queueRender() {
        if (this.renderQueued)
            return;
        this.renderQueued = true;
        requestAnimationFrame(() => {
            this.renderQueued = false;
            this.render(false);
        });
    }
    render(navigated) {
        const path = location.hash.replace(/^#/, '') || '/oggi';
        let match = null;
        for (const r of this.routes) {
            const m = r.pattern.exec(path);
            if (m) {
                match = { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
                break;
            }
        }
        if (!match) {
            location.hash = '/oggi';
            return;
        }
        const pathChanged = path !== this.currentPath;
        this.entering = navigated && pathChanged;
        const active = document.activeElement;
        const focusId = !pathChanged && active?.id && this.main.contains(active) ? active.id : null;
        const scroll = window.scrollY;
        let result;
        try {
            result = match.r.view(this, match.params);
        }
        catch (e) {
            console.error(e);
            result = { title: 'Errore', node: h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, 'Questa schermata non si è caricata.'), h('p', { class: 'muted' }, String(e.message ?? e))) };
        }
        const wrap = h('div', { class: cx('view', this.entering && 'enter') }, result.node);
        this.main.replaceChildren(wrap);
        document.title = `${result.title} · My Empire`;
        const nav = NAV.find((a) => a.id === match.r.area);
        for (const el of this.navEls) {
            const id = el.dataset.area;
            const on = id === match.r.area || (id === 'altro' && !nav?.primary);
            el.classList.toggle('active', on);
            if (el.tagName === 'A') {
                if (id === match.r.area)
                    el.setAttribute('aria-current', 'page');
                else
                    el.removeAttribute('aria-current');
            }
        }
        this.moveIndicator();
        if (this.entering) {
            window.scrollTo(0, 0);
            this.main.focus({ preventScroll: true });
        }
        else
            window.scrollTo(0, scroll);
        this.currentPath = path;
        if (focusId)
            document.getElementById(focusId)?.focus({ preventScroll: true });
        this.entering = false;
    }
    moveIndicator() {
        const on = this.navEls.find((e) => e.classList.contains('nav-bottom') && e.classList.contains('active'));
        if (!on || !this.indicator)
            return;
        requestAnimationFrame(() => {
            const bar = this.indicator.parentElement.getBoundingClientRect();
            const r = on.getBoundingClientRect();
            this.indicator.style.transform = `translateX(${r.left - bar.left + r.width / 2 - 20}px)`;
            this.indicator.classList.add('on');
        });
    }
    // ─── Messaggi ──────────────────────────────────────────────────────────────
    toast(msg, opts = {}) {
        clearTimeout(this.toastTimer);
        const undo = opts.undo && this.store.canUndo()
            ? h('button', { type: 'button', class: 'toast-undo', on: { click: async () => {
                        this.toastEl.classList.remove('show');
                        const label = await this.store.undo().catch(() => null);
                        this.toast(label ? `Annullato: ${label.toLowerCase()}` : 'Niente da annullare');
                    } } }, icon('undo', 16), 'Annulla')
            : null;
        this.toastEl.replaceChildren(h('span', { class: cx('toast-msg', opts.error && 'err') }, msg), undo ?? '');
        this.toastEl.classList.remove('show');
        void this.toastEl.offsetWidth;
        this.toastEl.classList.add('show');
        if (opts.error)
            haptic([30, 40, 30]);
        this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), opts.error ? 6000 : undo ? 5000 : 2600);
    }
    async run(fn, okMsg, undoable = false) {
        try {
            await fn();
            if (okMsg)
                this.toast(okMsg, { undo: undoable });
            return true;
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'Operazione non riuscita.';
            this.toast(e instanceof ActionError ? msg : `Non salvato: ${msg}`, { error: true });
            if (!(e instanceof ActionError))
                console.error(e);
            return false;
        }
    }
    sheet(title, build, opts = {}) {
        const prevFocus = document.activeElement;
        const body = h('div', { class: 'sheet-body' });
        let unsub = null;
        let closed = false;
        const onKey = (e) => {
            if (e.key === 'Escape')
                close();
        };
        const close = () => {
            if (closed)
                return;
            closed = true;
            unsub?.();
            opts.onClose?.();
            wrap.classList.remove('open');
            document.removeEventListener('keydown', onKey);
            setTimeout(() => {
                wrap.remove();
                if (!this.layer.querySelector('.sheet-wrap'))
                    document.body.classList.remove('locked');
            }, 260);
            if (prevFocus && document.body.contains(prevFocus))
                prevFocus.focus({ preventScroll: true });
        };
        const fill = () => {
            if (closed)
                return;
            const active = document.activeElement;
            const fid = active && body.contains(active) ? active.id : '';
            body.replaceChildren(build(close));
            if (fid)
                document.getElementById(fid)?.focus({ preventScroll: true });
        };
        const titleId = `st-${Math.random().toString(36).slice(2, 7)}`;
        const panel = h('div', { class: cx('sheet', opts.wide && 'sheet-wide'), attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: -1 } }, h('div', { class: 'sheet-grip', attrs: { 'aria-hidden': 'true' } }), h('div', { class: 'sheet-head' }, h('h2', { id: titleId, class: 'sheet-title' }, title), button('', close, { variant: 'quiet', icon: 'x', title: 'Chiudi', small: true })), body);
        const wrap = h('div', { class: 'sheet-wrap' }, h('div', { class: 'scrim', on: { click: close } }), panel);
        fill();
        if (opts.live)
            unsub = this.store.subscribe(() => requestAnimationFrame(fill));
        this.layer.appendChild(wrap);
        document.body.classList.add('locked');
        document.addEventListener('keydown', onKey);
        requestAnimationFrame(() => {
            wrap.classList.add('open');
            const first = panel.querySelector('[autofocus]');
            (first ?? panel).focus({ preventScroll: true });
        });
        return close;
    }
    confirm(title, text, confirmLabel, danger = false) {
        return new Promise((resolve) => {
            let answer = false;
            this.sheet(title, (close) => h('div', { class: 'stack' }, h('p', { class: 'muted' }, text), h('div', { class: 'row-end' }, button('Indietro', close), button(confirmLabel, () => { answer = true; close(); }, { variant: danger ? 'danger' : 'primary' }))), { onClose: () => resolve(answer) });
        });
    }
}
//# sourceMappingURL=app.js.map