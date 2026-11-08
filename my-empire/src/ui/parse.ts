/** Numero scritto all'italiana ("62,5") → 62.5; vuoto → undefined; non valido → NaN. */
export function parseNum(s: string): number | undefined {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
