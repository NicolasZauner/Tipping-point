// Seeded pseudo-random numbers for Monte Carlo runs. The model never calls Math.random: a run
// takes a generator built from a seed, so the same seed always gives the same bands.
// xoshiro128** (Blackman and Vigna), seeded through splitmix32 so that nearby seeds diverge.

export type Rng = {
  /** Next float, uniform on the open interval (0, 1): never exactly 0 or 1. */
  next: () => number;
};

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

export function createRng(seed: number): Rng {
  if (!Number.isInteger(seed)) throw new RangeError(`seed must be an integer, got ${seed}`);
  const sm = splitmix32(seed);
  let a = sm();
  let b = sm();
  let c = sm();
  let d = sm();
  if ((a | b | c | d) === 0) a = 1; // the all-zero state is a fixed point
  const nextU32 = () => {
    const result = Math.imul(rotl(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
    const t = (b << 9) >>> 0;
    c = (c ^ a) >>> 0;
    d = (d ^ b) >>> 0;
    b = (b ^ c) >>> 0;
    a = (a ^ d) >>> 0;
    c = (c ^ t) >>> 0;
    d = rotl(d, 11);
    return result;
  };
  // (k + 0.5) / 2^32 maps the 2^32 integers onto (0, 1) without hitting either end.
  return { next: () => (nextU32() + 0.5) / 4294967296 };
}
