/** Deterministic hashing + PRNG so the same search always returns the same flights. */

export function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(list: readonly T[]): T;
  chance(p: number): boolean;
}

export function rng(seed: string): Rng {
  let a = hashString(seed);
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
  };
}
