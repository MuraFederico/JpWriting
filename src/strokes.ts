export type Pt = { x: number; y: number };
export type TPt = Pt & { t: number };
export type StrokeType = 'tome' | 'hane' | 'harai';

const N = 32;
const HOOK_COS = 0; // user stroke turning back more than 90° at its end = hane
const HOOK_MAX_TAIL = 0.15;
const HOOK_MIN_TAIL = 0.02;
const FLICK_RATIO = 0.5; // still moving at >50% of average speed when lifted = harai
const FLICK_WINDOW_MS = 80;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const length = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);

// Sharpest direction change within the last `maxTail` (box widths) of a stroke, measured over ±0.04
// so gradual curves and loops don't count. Returns the cosine of the turn (-1 = full reversal).
const STEP = 0.01;
const TURN_WINDOW = 4;
function endTurn(pts: Pt[], maxTail: number, minTail = 0): number {
  const n = Math.max(TURN_WINDOW * 2, Math.ceil(length(pts) / STEP) + 1);
  const r = resample(pts, n);
  const step = length(pts) / (n - 1) || STEP;
  let best = 1;
  const first = Math.max(TURN_WINDOW, n - 1 - Math.floor(maxTail / step));
  const last = n - 1 - Math.max(1, Math.ceil(minTail / step));
  for (let i = first; i <= last; i++) {
    const p = r[i - TURN_WINDOW];
    const q = r[Math.min(n - 1, i + TURN_WINDOW)];
    const a = { x: r[i].x - p.x, y: r[i].y - p.y };
    const b = { x: q.x - r[i].x, y: q.y - r[i].y };
    const norm = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    const cos = norm ? (a.x * b.x + a.y * b.y) / norm : 1;
    best = Math.min(best, cos);
  }
  return best;
}

// Evenly spaced points along the polyline (arc length), so strokes of any sampling compare 1:1.
export function resample(pts: Pt[], n = N): Pt[] {
  const step = length(pts) / (n - 1);
  if (!step) return Array.from({ length: n }, () => pts[0]);
  const out: Pt[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let seg = dist(a, b);
    while (acc + seg >= step && out.length < n) {
      const t = (step - acc) / seg;
      a = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      out.push(a);
      seg = dist(a, b);
      acc = 0;
    }
    acc += seg;
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
}

// Filled outline of a stroke that thins to a point over its last `taper` fraction (harai brush ending).
export function taperedOutline(pts: Pt[], width: number, taper = 0.35): Pt[] {
  const r = resample(pts, 40);
  const left: Pt[] = [];
  const right: Pt[] = [];
  r.forEach((p, i) => {
    const a = r[Math.max(0, i - 1)];
    const b = r[Math.min(r.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const half = (width / 2) * Math.min(1, (1 - i / (r.length - 1)) / taper);
    const nx = (-(b.y - a.y) / len) * half;
    const ny = ((b.x - a.x) / len) * half;
    left.push({ x: p.x + nx, y: p.y + ny });
    right.push({ x: p.x - nx, y: p.y - ny });
  });
  return [...left, ...right.reverse()];
}

// Point-to-point comparison of two strokes resampled to N points: mean and worst distance (box widths,
// 0.1 = 10% of the reticle) and mean difference in direction along the stroke (degrees).
function compare(a: Pt[], b: Pt[]) {
  const ra = resample(a);
  const rb = resample(b);
  const gaps = ra.map((p, i) => dist(p, rb[i]));
  let turn = 0;
  for (let i = 0; i < N - 1; i++) {
    const u = { x: ra[i + 1].x - ra[i].x, y: ra[i + 1].y - ra[i].y };
    const v = { x: rb[i + 1].x - rb[i].x, y: rb[i + 1].y - rb[i].y };
    const norm = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    turn += norm ? Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / norm))) : 0;
  }
  return { mean: gaps.reduce((s, g) => s + g, 0) / N, max: Math.max(...gaps), dir: (turn / (N - 1)) * (180 / Math.PI) };
}

export const strokeDistance = (a: Pt[], b: Pt[]) => compare(a, b).mean;

// The mean alone lets a different stroke through if it sweeps the same area (ぬ for ね at lenient settings),
// so the worst point and the direction along the stroke must fit too.
const MAX_GAP_FACTOR = 1.6;
const DIR_MAX_DEG = 30;
const DIR_MIN_LENGTH = 0.25; // on dots, direction is mostly finger wobble
function fits(drawn: Pt[], ref: Pt[], tolerance: number): 'ok' | 'off' | 'shape' {
  const c = compare(drawn, ref);
  if (c.mean > tolerance) return 'off';
  return c.max <= MAX_GAP_FACTOR * tolerance && (length(ref) < DIR_MIN_LENGTH || c.dir <= DIR_MAX_DEG) ? 'ok' : 'shape';
}

export function judge(drawn: Pt[], refs: Pt[][], next: number, tolerance: number): { dist: number; error?: string } {
  const d = strokeDistance(drawn, refs[next]);
  const fit = fits(drawn, refs[next], tolerance);
  if (fit === 'ok') return { dist: d };
  if (fits([...drawn].reverse(), refs[next], tolerance) === 'ok') return { dist: d, error: 'Wrong direction' };
  const other = refs.findIndex((r, i) => i > next && fits(drawn, r, tolerance) === 'ok');
  if (other >= 0) return { dist: d, error: `Wrong order: that was stroke ${other + 1}` };
  return { dist: d, error: fit === 'shape' ? 'Wrong shape' : 'Not precise enough' };
}

// A flick: the stroke turns back sharply in its last 0.15 and goes on for at least 0.02 (not just finger jitter).
export function hasHook(pts: Pt[]): boolean {
  return endTurn(pts, HOOK_MAX_TAIL, HOOK_MIN_TAIL) < HOOK_COS;
}

// ponytail: heuristic ending detection, tune HOOK_COS / FLICK_RATIO on real devices.
// Ends in a hook = hane (often a pause then a tiny flick, so speed alone misses it);
// otherwise lifted while moving = harai, stopped before lifting = tome.
export function detectType(pts: TPt[], releasedAt: number): StrokeType {
  if (hasHook(pts)) return 'hane';
  const avg = length(pts) / Math.max(1, pts[pts.length - 1].t - pts[0].t);
  const from = pts.findIndex((p) => p.t >= releasedAt - FLICK_WINDOW_MS);
  const tail = from < 0 ? [] : pts.slice(Math.max(0, from - 1)); // include the segment entering the window
  return avg > 0 && length(tail) / FLICK_WINDOW_MS > avg * FLICK_RATIO ? 'harai' : 'tome';
}
