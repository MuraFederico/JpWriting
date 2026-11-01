export type Detection = 'auto' | 'buttons';
export type Theme = 'system' | 'light' | 'dark';
export type ScriptChoice = 'hiragana' | 'katakana' | 'both';
export type Settings = { detection: Detection; tolerance: number; rows: string[]; shuffle: boolean; theme: Theme; script: ScriptChoice };
export type Attempt = { t: number; correctness: number; precision: number };
export type Profile = { settings: Settings; history: Record<string, Attempt[]> };

export const MAX_ATTEMPTS = 20;
export const TOLERANCE_MIN = 0.05;
export const TOLERANCE_MAX = 0.2;
// Gojūon row heads; no rows selected = all kana.
export const ROWS = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ'];
export const DEFAULT_PROFILE: Profile = { settings: { detection: 'buttons', tolerance: 0.1, rows: [], shuffle: true, theme: 'system', script: 'hiragana' }, history: {} };

export function addAttempt(p: Profile, kana: string, a: Attempt): Profile {
  return { ...p, history: { ...p.history, [kana]: [...(p.history[kana] ?? []), a].slice(-MAX_ATTEMPTS) } };
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;

export function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const unit = (v: unknown) => typeof v === 'number' && v >= 0 && v <= 1;

// Validates untrusted JSON (imports, storage); throws on anything malformed.
export function sanitize(raw: unknown): Profile {
  const r = raw as Profile;
  const s = r?.settings;
  if (!s || (s.detection !== 'auto' && s.detection !== 'buttons')) throw new Error('Invalid settings');
  if (!(typeof s.tolerance === 'number' && s.tolerance >= TOLERANCE_MIN && s.tolerance <= TOLERANCE_MAX))
    throw new Error('Invalid tolerance');
  // rows / shuffle / theme / script are absent in profiles saved before they existed
  const rows = s.rows ?? [];
  if (!Array.isArray(rows) || !rows.every((x) => ROWS.includes(x))) throw new Error('Invalid rows');
  const shuffle = s.shuffle ?? true;
  if (typeof shuffle !== 'boolean') throw new Error('Invalid shuffle');
  const theme = s.theme ?? 'system';
  if (!['system', 'light', 'dark'].includes(theme)) throw new Error('Invalid theme');
  const script = s.script ?? 'hiragana';
  if (!['hiragana', 'katakana', 'both'].includes(script)) throw new Error('Invalid script');
  if (typeof r.history !== 'object' || r.history === null) throw new Error('Invalid history');
  const history: Record<string, Attempt[]> = {};
  for (const [kana, list] of Object.entries(r.history)) {
    if ([...kana].length !== 1 || !Array.isArray(list)) throw new Error(`Invalid history for ${kana}`);
    for (const a of list)
      if (typeof a?.t !== 'number' || !unit(a.correctness) || !unit(a.precision)) throw new Error(`Invalid attempt for ${kana}`);
    history[kana] = list.slice(-MAX_ATTEMPTS).map(({ t, correctness, precision }) => ({ t, correctness, precision }));
  }
  return { settings: { detection: s.detection, tolerance: s.tolerance, rows: ROWS.filter((x) => rows.includes(x)), shuffle, theme, script }, history };
}
