/** mulberry32 — small, fast, seedable uniform PRNG in [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string -> 32-bit unsigned seed. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Standard normal via Box-Muller (fresh per call; no shared spare for reproducibility). */
export function sampleNormal(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Lognormal annual net return: E[1+r] = 1+mu, Var(1+r) = sigma^2 (Jensen-corrected).
 * Guarantees the gross factor stays positive.
 */
export function sampleAnnualReturn(rng: () => number, mu: number, sigma: number): number {
  if (sigma <= 0) return mu;
  const oneP = 1 + mu;
  const sigma2 = Math.log(1 + (sigma * sigma) / (oneP * oneP));
  const muL = Math.log(oneP) - sigma2 / 2;
  const z = sampleNormal(rng);
  return Math.exp(muL + Math.sqrt(sigma2) * z) - 1;
}
