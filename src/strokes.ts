export type Pt = { x: number; y: number };
export type TPt = Pt & { t: number };
export type StrokeType = 'tome' | 'hane' | 'harai';

export const KANJIVG_SIZE = 109;
const N = 32;
const HOOK_COS = 0; // direction turning more than 90° within ~6% of the stroke = hane
const FLICK_RATIO = 0.5; // still moving at >50% of average speed when lifted = harai
const FLICK_WINDOW_MS = 80;

// KanjiVG kana only use M and relative c; points come out normalised to 0..1.
export function parsePath(d: string): Pt[] {
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const pts: Pt[] = [];
  let cmd = '';
  let x = 0;
  let y = 0;
  let i = 0;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') {
      x = num();
      y = num();
      pts.push({ x, y });
    } else if (cmd === 'c') {
      const [ax, ay, bx, by, ex, ey] = [x + num(), y + num(), x + num(), y + num(), x + num(), y + num()];
      for (let k = 1; k <= 8; k++) {
        const t = k / 8;
        const u = 1 - t;
        pts.push({
          x: u * u * u * x + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * ex,
          y: u * u * u * y + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * ey,
        });
      }
      x = ex;
      y = ey;
    } else throw new Error(`unsupported path command ${cmd}`);
  }
  return pts.map((p) => ({ x: p.x / KANJIVG_SIZE, y: p.y / KANJIVG_SIZE }));
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const length = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);

// KanjiVG ends many tome strokes (dots, き/さ) with a brush curl that reads as a hane.
// Cut short strokes at the point farthest from the start when what follows is a short tail;
// long strokes ending in a loop (ぬ, ね, る) are left alone.
export function trimCurl(pts: Pt[]): Pt[] {
  if (length(pts) > 1) return pts;
  let far = 0;
  pts.forEach((p, i) => {
    if (dist(pts[0], p) > dist(pts[0], pts[far])) far = i;
  });
  const tail = length(pts.slice(far));
  return tail > 0 && tail < 0.3 * length(pts) ? pts.slice(0, far + 1) : pts;
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

// Mean point-to-point distance, in box widths (0.1 = 10% of the reticle).
export function strokeDistance(a: Pt[], b: Pt[]): number {
  const ra = resample(a);
  const rb = resample(b);
  return ra.reduce((s, p, i) => s + dist(p, rb[i]), 0) / N;
}

export function judge(drawn: Pt[], refs: Pt[][], next: number, tolerance: number): { dist: number; error?: string } {
  const d = strokeDistance(drawn, refs[next]);
  if (d <= tolerance) return { dist: d };
  if (strokeDistance([...drawn].reverse(), refs[next]) <= tolerance) return { dist: d, error: 'Wrong direction' };
  const other = refs.findIndex((r, i) => i > next && strokeDistance(drawn, r) <= tolerance);
  if (other >= 0) return { dist: d, error: `Wrong order: that was stroke ${other + 1}` };
  return { dist: d, error: 'Not precise enough' };
}

// A sharp corner in the last quarter of the stroke (gradual curves don't count).
export function hasHook(pts: Pt[]): boolean {
  const r = resample(pts);
  for (let i = N - 8; i < N - 2; i++) {
    const a = { x: r[i].x - r[i - 2].x, y: r[i].y - r[i - 2].y };
    const b = { x: r[i + 2].x - r[i].x, y: r[i + 2].y - r[i].y };
    const norm = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (norm > 0 && (a.x * b.x + a.y * b.y) / norm < HOOK_COS) return true;
  }
  return false;
}

// ponytail: heuristic ending detection, tune HOOK_COS / FLICK_RATIO on real devices.
// Stopped before lifting = tome; lifted while moving = hane if it ends in a hook, else harai.
export function detectType(pts: TPt[], releasedAt: number): StrokeType {
  const avg = length(pts) / Math.max(1, pts[pts.length - 1].t - pts[0].t);
  const tail = pts.filter((p) => p.t >= releasedAt - FLICK_WINDOW_MS);
  const flicked = avg > 0 && length(tail) / FLICK_WINDOW_MS > avg * FLICK_RATIO;
  if (!flicked) return 'tome';
  return hasHook(pts) ? 'hane' : 'harai';
}
