/**
 * Motore delle animazioni.
 * Le animazioni partono da un'azione (tocco, completamento, ingresso in pagina) e vivono su un
 * livello separato, così i ridisegni della pagina non le interrompono.
 * Con "riduci movimento" attivo nel sistema restano solo i cambi di stato, senza movimento.
 */

export const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let layer: HTMLElement | null = null;
function fxLayer(): HTMLElement {
  if (!layer || !document.body.contains(layer)) {
    layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  return layer;
}

/** Leggera vibrazione (Android). */
export function haptic(ms: number | number[] = 12): void {
  try { navigator.vibrate?.(ms); } catch { /* non supportata */ }
}

const PALETTE = ['#3ef0c4', '#8b7bff', '#f0c987', '#7fd4ff', '#ffffff'];

/** Esplosione di particelle dal punto (x, y) dello schermo. */
export function burst(x: number, y: number, opts: { count?: number; colors?: string[]; spread?: number } = {}): void {
  if (reduced()) return;
  const L = fxLayer();
  const n = opts.count ?? 18;
  const colors = opts.colors ?? PALETTE;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'particle';
    const size = 4 + Math.random() * 6;
    p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${colors[i % colors.length]};border-radius:${Math.random() > 0.5 ? '50%' : '2px'}`;
    L.appendChild(p);
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
    const d = (opts.spread ?? 70) * (0.5 + Math.random() * 0.8);
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    p.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 40}px)) scale(0.3)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.15,.7,.3,1)' },
    ).onfinish = () => p.remove();
  }
}

/** Onda luminosa che si espande da un elemento. */
export function pulse(el: Element, color = 'rgba(62,240,196,.55)'): void {
  if (reduced()) return;
  const r = el.getBoundingClientRect();
  const ring = document.createElement('i');
  ring.className = 'pulse-ring';
  ring.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:${Math.max(r.width, r.height)}px;height:${Math.max(r.width, r.height)}px;border-color:${color}`;
  fxLayer().appendChild(ring);
  ring.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0.9 }, { transform: 'translate(-50%,-50%) scale(2.4)', opacity: 0 }], { duration: 650, easing: 'ease-out' }).onfinish = () => ring.remove();
}

/** Particelle dal centro di un elemento. */
export function burstFrom(el: Element, opts?: Parameters<typeof burst>[2]): void {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, opts);
}

/** Pioggia di coriandoli a tutto schermo (celebrazioni). */
export function confetti(duration = 2200): void {
  if (reduced()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  fxLayer().appendChild(c);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = (c.width = innerWidth * dpr);
  const Hh = (c.height = innerHeight * dpr);
  const ctx = c.getContext('2d');
  if (!ctx) return c.remove();
  const pieces = Array.from({ length: 140 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: Hh * 0.35 + (Math.random() - 0.5) * 60 * dpr,
    vx: (Math.random() - 0.5) * 16 * dpr,
    vy: (-Math.random() * 16 - 6) * dpr,
    w: (5 + Math.random() * 7) * dpr,
    h: (3 + Math.random() * 5) * dpr,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  }));
  const t0 = performance.now();
  const frame = (t: number): void => {
    const k = (t - t0) / duration;
    ctx.clearRect(0, 0, W, Hh);
    for (const p of pieces) {
      p.vy += 0.45 * dpr;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (k < 1) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}

/** Grande messaggio di celebrazione al centro dello schermo. */
export function celebrate(title: string, sub?: string): void {
  haptic([20, 40, 30]);
  confetti();
  const el = document.createElement('div');
  el.className = 'celebrate';
  el.setAttribute('role', 'status');
  el.innerHTML = '<div class="celebrate-card"><div class="celebrate-glow"></div><strong></strong><span></span></div>';
  (el.querySelector('strong') as HTMLElement).textContent = title;
  (el.querySelector('span') as HTMLElement).textContent = sub ?? '';
  document.body.appendChild(el);
  const remove = (): void => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 400);
  };
  el.addEventListener('click', remove);
  setTimeout(remove, reduced() ? 1600 : 2600);
}

/** Conta da 0 (o dal valore attuale) fino al numero indicato. */
export function countUp(el: HTMLElement, to: number, opts: { duration?: number; decimals?: number; suffix?: string } = {}): void {
  const dec = opts.decimals ?? 0;
  const fmt = (v: number): string => `${v.toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${opts.suffix ?? ''}`;
  if (reduced()) {
    el.textContent = fmt(to);
    return;
  }
  const d = opts.duration ?? 900;
  const t0 = performance.now();
  const step = (t: number): void => {
    const k = Math.min(1, (t - t0) / d);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * e);
    if (k < 1) requestAnimationFrame(step);
  };
  el.textContent = fmt(0);
  requestAnimationFrame(step);
}

/** Effetto "inchiostro" al tocco sui pulsanti (delegato su tutto il documento). */
export function installRipples(): void {
  document.addEventListener('pointerdown', (e) => {
    if (reduced()) return;
    const t = (e.target as Element).closest('.btn, .tap');
    if (!t || (t as HTMLButtonElement).disabled) return;
    const r = t.getBoundingClientRect();
    const s = document.createElement('i');
    s.className = 'ripple';
    const size = Math.max(r.width, r.height) * 2;
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    t.appendChild(s);
    s.animate([{ transform: 'scale(0)', opacity: 0.35 }, { transform: 'scale(1)', opacity: 0 }], { duration: 550, easing: 'ease-out' }).onfinish = () => s.remove();
  }, { passive: true });
}

/** Chiavi "appena completate": il ridisegno successivo mostra l'animazione di spunta una sola volta. */
const fresh = new Set<string>();
export function markFresh(key: string): void {
  fresh.add(key);
  setTimeout(() => fresh.delete(key), 1500);
}
export function isFresh(key: string): boolean {
  return fresh.has(key);
}
