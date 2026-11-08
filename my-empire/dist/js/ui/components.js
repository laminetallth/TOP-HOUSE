import { cx, h, svgEl } from './dom.js';
import { icon } from './icons.js';
export function button(label, onClick, opts = {}) {
    return h('button', {
        type: opts.type ?? 'button',
        class: cx('btn', `btn-${opts.variant ?? 'ghost'}`, opts.small && 'btn-sm', opts.cls),
        title: opts.title,
        disabled: opts.disabled,
        attrs: { 'aria-label': opts.title },
        on: { click: (e) => { if (opts.type !== 'submit')
                e.preventDefault(); onClick(e); } },
    }, opts.icon ? icon(opts.icon, opts.small ? 16 : 18) : null, typeof label === 'string' ? (label ? h('span', null, label) : null) : label);
}
export function iconButton(name, title, onClick, cls = '') {
    return h('button', { type: 'button', class: cx('icon-btn', cls), title, attrs: { 'aria-label': title }, on: { click: (e) => { e.stopPropagation(); onClick(e); } } }, icon(name, 18));
}
export function progressBar(ratio, opts = {}) {
    const r = Math.max(0, Math.min(1, ratio));
    return h('div', { class: cx('bar', opts.thin && 'bar-thin'), attrs: { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(r * 100), 'aria-label': opts.label } }, h('div', { class: 'bar-fill', style: `width:${(r * 100).toFixed(1)}%` }));
}
export function empty(title, text, action) {
    return h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, title), h('p', { class: 'muted' }, text), action ?? null);
}
export function section(title, ...children) {
    return h('section', { class: 'section' }, h('h2', { class: 'section-title' }, title), ...children);
}
export function sectionWithAction(title, action, ...children) {
    return h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, title), action), ...children);
}
let fieldSeq = 0;
export function field(label, control, hint, error) {
    const id = control.id || `f${++fieldSeq}`;
    control.id = id;
    if (error)
        control.setAttribute('aria-invalid', 'true');
    return h('div', { class: cx('field', error && 'field-error') }, h('label', { attrs: { for: id } }, label), control, error ? h('p', { class: 'field-msg' }, error) : hint ? h('p', { class: 'field-hint' }, hint) : null);
}
export function input(props) {
    return h('input', { class: 'input', type: 'text', autocomplete: 'off', ...props });
}
export function textarea(props) {
    return h('textarea', { class: 'input textarea', rows: 3, ...props });
}
/** Controllo a segmenti (scelta singola). */
export function segmented(options, current, onChange, label) {
    return h('div', { class: 'seg', attrs: { role: 'radiogroup', 'aria-label': label } }, ...options.map((o) => h('button', {
        type: 'button',
        class: cx('seg-opt', o.value === current && 'on'),
        attrs: { role: 'radio', 'aria-checked': o.value === current },
        on: { click: (e) => { e.preventDefault(); onChange(o.value); } },
    }, o.label)));
}
/** Voto 1–10: i numeri si accendono fino al voto, con colore dal rosso all'aurora. */
export function ratingPicker(current, onPick, label) {
    return h('div', { class: 'rating', attrs: { role: 'radiogroup', 'aria-label': label } }, ...Array.from({ length: 10 }, (_, i) => i + 1).map((v) => h('button', {
        type: 'button',
        class: cx('rate', current !== undefined && v <= current && 'lit', v === current && 'on'),
        style: `--hue:${Math.round(350 + (v - 1) * (170 - 350 + 360) / 9) % 360}`,
        attrs: { role: 'radio', 'aria-checked': v === current, 'aria-label': `${v} su 10` },
        on: { click: (e) => { e.preventDefault(); onPick(v); } },
    }, String(v))));
}
/** Indicatore di difficoltà: 5 tacche. */
export function difficultyPips(d) {
    return h('span', { class: 'pips', title: `Difficoltà ${d} su 5`, attrs: { 'aria-label': `Difficoltà ${d} su 5` } }, ...[1, 2, 3, 4, 5].map((i) => h('i', { class: i <= d ? 'on' : '' })));
}
export function chip(text, tone = 'default', iconName) {
    return h('span', { class: cx('chip', `chip-${tone}`) }, iconName ? icon(iconName, 13) : null, text);
}
export function stat(value, label, sub) {
    return h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, value), h('div', { class: 'stat-label' }, label), sub ? h('div', { class: 'stat-sub' }, sub) : null);
}
/** Anello di avanzamento animato (0..1). */
export function ring(ratio, opts = {}) {
    const size = opts.size ?? 120;
    const sw = opts.stroke ?? 10;
    const r = (size - sw) / 2;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(1, ratio));
    const id = `rg${Math.random().toString(36).slice(2, 8)}`;
    const el = h('div', { class: cx('ring', opts.animate && 'grow', `ring-${opts.tone ?? 'aurora'}`), style: `--c:${c.toFixed(1)};--off:${(c * (1 - v)).toFixed(1)};width:${size}px;height:${size}px`, attrs: { role: 'img', 'aria-label': opts.label ?? `${Math.round(v * 100)}%` } }, svgEl(`<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="s1"/><stop offset="1" class="s2"/></linearGradient></defs><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="${sw}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke="url(#${id})" stroke-width="${sw}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`), h('div', { class: 'ring-center' }, ...(opts.children ?? [])));
    return el;
}
/** Grande spunta rotonda con disegno animato del segno. */
export function checkCircle(done, fresh, label, onClick, state = done ? 'done' : 'todo') {
    return h('button', {
        type: 'button',
        class: cx('cc', `cc-${state}`, fresh && 'fresh'),
        attrs: { 'aria-label': label, 'aria-pressed': done },
        on: { click: (e) => { e.stopPropagation(); onClick(e); } },
    }, svgEl('<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" class="cc-bg"/><path d="M9.5 16.5l4.2 4.2 8.8-9.4" class="cc-tick"/><path d="M11 11l10 10M21 11L11 21" class="cc-x"/></svg>'));
}
//# sourceMappingURL=components.js.map