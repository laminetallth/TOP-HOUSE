/**
 * Mini livello di vista senza dipendenze: `h()` crea elementi DOM tipizzati.
 * Le viste sono funzioni pure (stato → elemento) e vengono ridisegnate quando i dati cambiano.
 */
type Child = Node | string | number | false | null | undefined | Child[];

export type Props = {
  class?: string | false | null;
  style?: string;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>;
  attrs?: Record<string, string | number | boolean | undefined | null>;
  dataset?: Record<string, string>;
  [key: string]: unknown;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k === 'on') for (const [ev, fn] of Object.entries(v as object)) el.addEventListener(ev, fn as EventListener);
      else if (k === 'attrs') {
        for (const [a, av] of Object.entries(v as Record<string, unknown>)) {
          if (av === undefined || av === null || av === false) continue;
          el.setAttribute(a, av === true ? '' : String(av));
        }
      } else if (k === 'dataset') Object.assign(el.dataset, v);
      else (el as unknown as Record<string, unknown>)[k] = v;
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function frag(...children: Child[]): DocumentFragment {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

export function svgEl(markup: string): SVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as SVGElement;
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function fmtNumber(n: number, digits = 0): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(r: number): string {
  return `${Math.round(r * 100)}%`;
}
