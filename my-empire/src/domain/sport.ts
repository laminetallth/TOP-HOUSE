import { addDays, isDateKey, monthEnd, monthStart, weekStart, type DateKey } from './dates.js';
import type { BasketGame, GymExercise, GymSession } from './types.js';

// ─── Basket: partite ─────────────────────────────────────────────────────────

export type GameInput = Omit<BasketGame, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export const GAME_COUNTS = ['minutes', 'fg2m', 'fg2a', 'fg3m', 'fg3a', 'ftm', 'fta', 'reb', 'ast', 'tov'] as const;

export function points(g: Pick<BasketGame, 'fg2m' | 'fg3m' | 'ftm'>): number {
  return g.fg2m * 2 + g.fg3m * 3 + g.ftm;
}

/** Percentuale 0..1, oppure null senza tentativi (0/0 non è 0%). */
export function pctOf(made: number, att: number): number | null {
  return att > 0 ? made / att : null;
}

export function validateGame(g: GameInput, today: DateKey): string | null {
  if (!isDateKey(g.date)) return 'Data non valida.';
  if (g.date > today) return 'La data non può essere nel futuro.';
  if (!g.opponent.trim()) return 'Indica l\'avversario.';
  if (g.opponent.trim().length > 60) return 'Nome avversario troppo lungo.';
  for (const k of GAME_COUNTS) {
    const v = g[k];
    if (!Number.isInteger(v) || v < 0) return 'Inserisci numeri interi, zero o più.';
  }
  if (g.minutes > 60) return 'Più di 60 minuti in una partita: controlla.';
  if (g.fg2m > g.fg2a) return 'Tiri da 2: i segnati non possono superare i tentati.';
  if (g.fg3m > g.fg3a) return 'Tiri da 3: i segnati non possono superare i tentati.';
  if (g.ftm > g.fta) return 'Tiri liberi: i segnati non possono superare i tentati.';
  if (g.rating !== undefined && !(Number.isInteger(g.rating) && g.rating >= 1 && g.rating <= 10)) return 'Il voto va da 1 a 10.';
  return null;
}

export interface GameTotals {
  games: number;
  minutes: number;
  pts: number;
  fg2m: number; fg2a: number;
  fg3m: number; fg3a: number;
  ftm: number; fta: number;
  reb: number; ast: number; tov: number;
  ratingSum: number; ratingCount: number;
}

export function totals(games: BasketGame[]): GameTotals {
  const t: GameTotals = { games: 0, minutes: 0, pts: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 0, ast: 0, tov: 0, ratingSum: 0, ratingCount: 0 };
  for (const g of games) {
    t.games++;
    t.minutes += g.minutes; t.pts += points(g);
    t.fg2m += g.fg2m; t.fg2a += g.fg2a; t.fg3m += g.fg3m; t.fg3a += g.fg3a; t.ftm += g.ftm; t.fta += g.fta;
    t.reb += g.reb; t.ast += g.ast; t.tov += g.tov;
    if (g.rating !== undefined) { t.ratingSum += g.rating; t.ratingCount++; }
  }
  return t;
}

export interface Summary {
  games: number;
  /** Medie per partita (null senza partite). */
  ppg: number | null; rpg: number | null; apg: number | null; tpg: number | null; mpg: number | null;
  /** Percentuali sul totale dei tiri del periodo (non media delle percentuali). */
  fg2: number | null; fg3: number | null; ft: number | null;
  /** Dal campo: (2 + 3 segnati) ÷ (2 + 3 tentati). */
  fg: number | null;
  rating: number | null;
}

export function summarize(games: BasketGame[]): Summary {
  const t = totals(games);
  const per = (v: number): number | null => (t.games ? v / t.games : null);
  return {
    games: t.games,
    ppg: per(t.pts), rpg: per(t.reb), apg: per(t.ast), tpg: per(t.tov), mpg: per(t.minutes),
    fg2: pctOf(t.fg2m, t.fg2a), fg3: pctOf(t.fg3m, t.fg3a), ft: pctOf(t.ftm, t.fta),
    fg: pctOf(t.fg2m + t.fg3m, t.fg2a + t.fg3a),
    rating: t.ratingCount ? t.ratingSum / t.ratingCount : null,
  };
}

/** Stagione sportiva: dal 1° settembre al 31 agosto. Etichetta "2026/27". */
export function seasonOf(d: DateKey): { from: DateKey; to: DateKey; label: string } {
  const y = Number(d.slice(0, 4));
  const start = Number(d.slice(5, 7)) >= 9 ? y : y - 1;
  return { from: `${start}-09-01`, to: `${start + 1}-08-31`, label: `${start}/${String(start + 1).slice(2)}` };
}

export function gamesIn(games: BasketGame[], from: DateKey, to: DateKey): BasketGame[] {
  return games.filter((g) => !g.deletedAt && g.date >= from && g.date <= to).sort((a, b) => b.date.localeCompare(a.date));
}

export function monthGames(games: BasketGame[], day: DateKey): BasketGame[] {
  return gamesIn(games, monthStart(day), monthEnd(day));
}

// ─── Basket: settimana ───────────────────────────────────────────────────────

export function basketWeekId(day: DateKey): string {
  return `bw:${weekStart(day)}`;
}

export function previousWeekStart(day: DateKey): DateKey {
  return addDays(weekStart(day), -7);
}

// ─── Palestra ────────────────────────────────────────────────────────────────

export function validateExercises(ex: GymExercise[]): string | null {
  for (const e of ex) {
    if (!e.name.trim()) return 'Ogni esercizio deve avere un nome.';
    if (e.name.trim().length > 60) return 'Nome esercizio troppo lungo.';
    if (!e.sets.length) return `"${e.name}": aggiungi almeno una serie.`;
    for (const s of e.sets) {
      if (!Number.isInteger(s.reps) || s.reps < 1 || s.reps > 200) return `"${e.name}": ripetizioni da 1 a 200.`;
      if (s.kg !== undefined && (!Number.isFinite(s.kg) || s.kg < 0 || s.kg > 1000)) return `"${e.name}": peso non valido.`;
    }
  }
  return null;
}

/** Volume = Σ ripetizioni × kg (solo serie con peso). */
export function volume(s: Pick<GymSession, 'exercises'>): number {
  let v = 0;
  for (const e of s.exercises) for (const set of e.sets) if (set.kg) v += set.reps * set.kg;
  return Math.round(v * 10) / 10;
}

export function setCount(s: Pick<GymSession, 'exercises'>): number {
  return s.exercises.reduce((n, e) => n + e.sets.length, 0);
}

/** Miglior carico per esercizio (nome senza maiuscole/spazi extra) fino a una data esclusa. */
export function bestLoads(sessions: GymSession[], before?: DateKey): Map<string, { name: string; kg: number; date: DateKey }> {
  const m = new Map<string, { name: string; kg: number; date: DateKey }>();
  for (const s of sessions) {
    if (before && s.date >= before) continue;
    for (const e of s.exercises) {
      const key = e.name.trim().toLowerCase();
      for (const set of e.sets) {
        if (set.kg === undefined) continue;
        const cur = m.get(key);
        if (!cur || set.kg > cur.kg) m.set(key, { name: e.name.trim(), kg: set.kg, date: s.date });
      }
    }
  }
  return m;
}

/** Esercizi in cui la sessione supera il miglior carico precedente. */
export function newRecords(session: GymSession, all: GymSession[]): string[] {
  const prev = bestLoads(all, session.date);
  const out: string[] = [];
  for (const e of session.exercises) {
    const top = Math.max(...e.sets.map((s) => s.kg ?? -1));
    const p = prev.get(e.name.trim().toLowerCase());
    if (top > 0 && p && top > p.kg) out.push(e.name.trim());
  }
  return out;
}

/** Nomi di esercizi già usati, i più recenti prima (per suggerimenti). */
export function knownExercises(sessions: GymSession[]): string[] {
  const seen = new Map<string, string>();
  for (const s of [...sessions].sort((a, b) => b.date.localeCompare(a.date))) for (const e of s.exercises) {
    const k = e.name.trim().toLowerCase();
    if (!seen.has(k)) seen.set(k, e.name.trim());
  }
  return [...seen.values()];
}
