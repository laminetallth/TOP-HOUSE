export function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
        for (const [k, v] of Object.entries(props)) {
            if (v === undefined || v === null || v === false)
                continue;
            if (k === 'class')
                el.className = String(v);
            else if (k === 'style')
                el.setAttribute('style', String(v));
            else if (k === 'on')
                for (const [ev, fn] of Object.entries(v))
                    el.addEventListener(ev, fn);
            else if (k === 'attrs') {
                for (const [a, av] of Object.entries(v)) {
                    if (av === undefined || av === null || av === false)
                        continue;
                    el.setAttribute(a, av === true ? '' : String(av));
                }
            }
            else if (k === 'dataset')
                Object.assign(el.dataset, v);
            else
                el[k] = v;
        }
    }
    append(el, children);
    return el;
}
function append(el, children) {
    for (const c of children) {
        if (c === null || c === undefined || c === false)
            continue;
        if (Array.isArray(c))
            append(el, c);
        else
            el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
}
export function frag(...children) {
    const f = document.createDocumentFragment();
    append(f, children);
    return f;
}
export function svgEl(markup) {
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstElementChild;
}
export function cx(...parts) {
    return parts.filter(Boolean).join(' ');
}
export function fmtNumber(n, digits = 0) {
    return n.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function pct(r) {
    return `${Math.round(r * 100)}%`;
}
//# sourceMappingURL=dom.js.map