// The standard normal distribution: density, CDF (Φ) and quantile (Φ⁻¹), accurate to about
// 1e-14. The switching curves of the five adopter groups are normal, so every share the model
// reports passes through these three functions.

const SQRT2 = Math.SQRT2;
const SQRT_PI = Math.sqrt(Math.PI);
const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI);

export function normalPdf(z: number): number {
  return INV_SQRT_2PI * Math.exp(-0.5 * z * z);
}

/**
 * Complementary error function. A positive-term series for |x| < 3 (no cancellation) and a
 * continued fraction (modified Lentz) beyond, where the series would need too many terms.
 */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return 2 - erfc(-x);
  if (x < 3) {
    // erf(x) = 2/√π · e^(−x²) · Σ 2ⁿ x^(2n+1) / (1·3·…·(2n+1))
    let term = x;
    let sum = x;
    for (let n = 1; n < 200; n++) {
      term *= (2 * x * x) / (2 * n + 1);
      sum += term;
      if (term < sum * 1e-17) break;
    }
    return 1 - (2 / SQRT_PI) * Math.exp(-x * x) * sum;
  }
  // erfc(x) = e^(−x²)/√π · 1 / (x + (1/2)/(x + 1/(x + (3/2)/(x + 2/(x + …)))))
  const tiny = 1e-300;
  let f = x;
  let C = x;
  let D = 0;
  for (let k = 1; k < 500; k++) {
    const a = k / 2;
    D = x + a * D;
    D = D === 0 ? tiny : D;
    C = x + a / C;
    C = C === 0 ? tiny : C;
    D = 1 / D;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / SQRT_PI / f;
}

/** Φ(z): probability that a standard normal value is at most z. */
export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / SQRT2);
}

// Acklam's rational approximation (relative error about 1e-9), refined by one Halley step.
const A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
  -3.066479806614716e1, 2.506628277459239,
] as const;
const B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
  -1.328068155288572e1,
] as const;
const C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
  4.374664141464968, 2.938163982698783,
] as const;
const D = [
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
] as const;
const P_LOW = 0.02425;

/** Φ⁻¹(p) for p in (0, 1). Throws outside that interval, where the quantile is infinite. */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError(`quantile needs 0 < p < 1, got ${p}`);
  let x: number;
  if (p < P_LOW) {
    const q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
      ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  } else if (p <= 1 - P_LOW) {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q) /
      (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x =
      -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
      ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  // Halley refinement against the accurate CDF.
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}
