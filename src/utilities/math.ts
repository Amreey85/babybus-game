export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Frame-rate independent exponential smoothing factor. */
export const damp = (a: number, b: number, lambda: number, dt: number): number => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const approach = (v: number, target: number, delta: number): number =>
  v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
