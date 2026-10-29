import { useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import data from './hiragana.json';
import { KANJIVG_SIZE as S, detectType, judge, parsePath, taperedOutline, type Pt, type StrokeType, type TPt } from './strokes';
import { pct, ROWS, type Attempt, type Settings } from './profile';
import { useColors, type Colors } from './theme';

export const KANA = data.map((k) => ({
  kana: k.kana,
  romaji: k.romaji,
  strokes: k.strokes.map((s) => ({ d: s.d, type: s.type as StrokeType, pts: parsePath(s.d) })),
}));
const TYPES: [StrokeType, string][] = [['tome', '止め'], ['hane', '跳ね'], ['harai', '払い']];
const SHOW = ['off', 'shape', 'order'] as const;
const PRECISION_ZERO = 0.25; // mean deviation (box widths) that scores 0% precision
const toPoints = (pts: Pt[]) => pts.map((p) => `${p.x * S},${p.y * S}`).join(' ');
// KANA is in gojūon order, so each kana belongs to the last row head before it.
let row = '';
const ROW_OF = KANA.map((k) => (row = ROWS.includes(k.kana) ? k.kana : row));
const ALL = KANA.map((_, i) => i);
const poolOf = (rows: string[]) => (rows.length ? ALL.filter((i) => rows.includes(ROW_OF[i])) : ALL);
const randomFrom = (pool: number[], not?: number) => {
  const options = pool.length > 1 ? pool.filter((i) => i !== not) : pool;
  return options[Math.floor(Math.random() * options.length)];
};
// Shuffle: random from the pool (never the same twice). Otherwise: gojūon order, wrapping around.
const nextIn = (pool: number[], shuffle: boolean, current?: number) =>
  shuffle ? randomFrom(pool, current) : current === undefined ? pool[0] : (pool.find((i) => i > current) ?? pool[0]);

function ShuffleIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="16 3 21 3 21 8" />
      <Line x1={4} y1={20} x2={21} y2={3} />
      <Polyline points="21 16 21 21 16 21" />
      <Line x1={15} y1={15} x2={21} y2={21} />
      <Line x1={4} y1={4} x2={9} y2={9} />
    </Svg>
  );
}

// Reference stroke in KanjiVG units; harai is drawn tapering to a point.
function RefStroke({ s, color, opacity, width }: { s: (typeof KANA)[number]['strokes'][number]; color: string; opacity: number; width: number }) {
  if (s.type !== 'harai')
    return <Path d={s.d} stroke={color} strokeOpacity={opacity} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  return <Polygon points={toPoints(taperedOutline(s.pts, width / S))} fill={color} fillOpacity={opacity} />;
}

export function Practice({
  settings,
  onAttempt,
  onSettings,
}: {
  settings: Settings;
  onAttempt: (kana: string, a: Attempt) => void;
  onSettings: (patch: Partial<Settings>) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { width } = useWindowDimensions();
  const size = Math.min(width - 32, 400);
  const [index, setIndex] = useState(() => nextIn(poolOf(settings.rows), settings.shuffle));
  const [rowsOpen, setRowsOpen] = useState(false);
  const [done, setDone] = useState<Pt[][]>([]);
  const [dists, setDists] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [selected, setSelected] = useState<StrokeType | null>(null);
  const [message, setMessage] = useState('');
  const [hint, setHint] = useState(false);
  const [show, setShow] = useState<(typeof SHOW)[number]>('off');
  const [, redraw] = useState(0);
  const live = useRef<TPt[]>([]);
  const origin = useRef({ x: 0, y: 0 });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const kana = KANA[index];
  const total = kana.strokes.length;
  const complete = done.length === total;

  const finish = useRef<(pts: TPt[]) => void>(() => {});
  finish.current = (pts) => {
    if (complete || !pts.length) return;
    const expected = kana.strokes[done.length].type;
    const type = settings.detection === 'auto' ? detectType(pts, Date.now()) : selected;
    setSelected(null);
    if (!type) return setMessage('Pick a stroke type first');
    const { dist, error } = judge(pts, kana.strokes.map((s) => s.pts), done.length, settings.tolerance);
    const err = error ?? (type !== expected ? `Should end with ${expected}, not ${type}` : undefined);
    if (err) {
      setMistakes((m) => m + 1);
      return setMessage(`✗ ${err}`);
    }
    const nextDone = [...done, pts];
    const nextDists = [...dists, dist];
    setDone(nextDone);
    setDists(nextDists);
    setHint(false);
    if (nextDone.length < total) return setMessage(`✓ ${type}`);
    const precision = nextDists.reduce((s, d) => s + Math.max(0, 1 - d / PRECISION_ZERO), 0) / total;
    const attempt = { t: Date.now(), correctness: total / (total + mistakes), precision };
    onAttempt(kana.kana, attempt);
    setMessage(`Done! Correctness ${pct(attempt.correctness)} · precision ${pct(precision)}`);
  };

  const point = (e: GestureResponderEvent): TPt => ({
    x: (e.nativeEvent.pageX - origin.current.x) / sizeRef.current,
    y: (e.nativeEvent.pageY - origin.current.y) / sizeRef.current,
    t: Date.now(),
  });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const n = e.nativeEvent;
        origin.current = { x: n.pageX - n.locationX, y: n.pageY - n.locationY };
        live.current = [point(e)];
        redraw((c) => c + 1);
      },
      onPanResponderMove: (e) => {
        live.current.push(point(e));
        redraw((c) => c + 1);
      },
      onPanResponderRelease: () => {
        const pts = live.current;
        live.current = [];
        finish.current(pts);
        redraw((c) => c + 1);
      },
      onPanResponderTerminate: () => {
        live.current = [];
        redraw((c) => c + 1);
      },
    }),
  ).current;

  const goTo = (i: number) => {
    setIndex(i);
    setDone([]);
    setDists([]);
    setMistakes(0);
    setSelected(null);
    setMessage('');
    setHint(false);
  };
  const next = () => goTo(nextIn(poolOf(settings.rows), settings.shuffle, index));
  const toggleRow = (r: string | null) => {
    const rows = r === null ? [] : ROWS.filter((x) => (x === r) !== settings.rows.includes(x));
    onSettings({ rows });
    const pool = poolOf(rows);
    if (!pool.includes(index)) goTo(nextIn(pool, settings.shuffle));
  };
  const toggleShuffle = () => {
    const shuffle = !settings.shuffle;
    onSettings({ shuffle });
    goTo(nextIn(poolOf(settings.rows), shuffle, shuffle ? index : undefined));
  };

  const ink = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const hinted = !complete && hint ? kana.strokes[done.length] : null;

  return (
    <View style={styles.screen}>
      <View style={styles.row}>
        <Pressable onPress={() => setRowsOpen(!rowsOpen)} style={styles.pill} accessibilityState={{ expanded: rowsOpen }}>
          <Text style={styles.sub}>
            {settings.rows.length ? `Rows: ${settings.rows.join(' ')}` : 'All kana'} {rowsOpen ? '▴' : '▾'}
          </Text>
        </Pressable>
        <Pressable
          onPress={toggleShuffle}
          style={[styles.pill, settings.shuffle && styles.selected]}
          accessibilityRole="switch"
          accessibilityLabel="Shuffle"
          accessibilityState={{ checked: settings.shuffle }}
        >
          <ShuffleIcon color={settings.shuffle ? c.onAccent : c.muted} />
        </Pressable>
      </View>
      {rowsOpen && (
        <View style={styles.chips}>
          <Pressable onPress={() => toggleRow(null)} style={[styles.chip, !settings.rows.length && styles.selected]}>
            <Text style={[styles.chipText, !settings.rows.length && styles.selectedText]}>All</Text>
          </Pressable>
          {ROWS.map((r) => {
            const on = settings.rows.includes(r);
            return (
              <Pressable key={r} onPress={() => toggleRow(r)} style={[styles.chip, on && styles.selected]} accessibilityState={{ selected: on }}>
                <Text style={[styles.chipText, on && styles.selectedText]}>
                  {r} {KANA.find((k) => k.kana === r)!.romaji}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <Text style={styles.romaji}>{kana.romaji}</Text>
      <Text style={styles.sub}>
        {complete ? kana.kana : `stroke ${done.length + 1} of ${total}`}
        {mistakes ? ` · ${mistakes} mistake${mistakes > 1 ? 's' : ''}` : ''}
      </Text>

      <View nativeID="canvas" style={[styles.box, { width: size, height: size }]} {...pan.panHandlers}>
        <View style={{ pointerEvents: 'none' }}>
          <Svg width={size} height={size} viewBox={`0 0 ${S} ${S}`}>
            <Line x1={S / 2} y1={0} x2={S / 2} y2={S} stroke={c.red} strokeOpacity={0.5} strokeWidth={0.6} strokeDasharray="3 3" />
            <Line x1={0} y1={S / 2} x2={S} y2={S / 2} stroke={c.red} strokeOpacity={0.5} strokeWidth={0.6} strokeDasharray="3 3" />
            {complete && kana.strokes.map((s, i) => <RefStroke key={i} s={s} color={c.accent} opacity={0.35} width={7} />)}
            {!complete && show !== 'off' && kana.strokes.map((s, i) => <RefStroke key={i} s={s} color={c.guide} opacity={0.3} width={5} />)}
            {!complete &&
              show === 'order' &&
              kana.strokes.map((s, i) => (
                <G key={i}>
                  <Circle cx={s.pts[0].x * S} cy={s.pts[0].y * S} r={4} fill={c.red} />
                  <SvgText x={s.pts[0].x * S} y={s.pts[0].y * S + 2.2} fontSize={6} fontWeight="bold" fill={c.onAccent} textAnchor="middle">
                    {i + 1}
                  </SvgText>
                </G>
              ))}
            {hinted && (
              <>
                <RefStroke s={hinted} color={c.guide} opacity={0.5} width={5} />
                <Circle cx={hinted.pts[0].x * S} cy={hinted.pts[0].y * S} r={2.5} fill={c.red} />
              </>
            )}
            {[...done, live.current].map((pts, i) => (
              <Polyline key={i} points={toPoints(pts)} stroke={c.text} strokeWidth={4} {...ink} />
            ))}
          </Svg>
        </View>
      </View>

      <Text style={styles.message}>{message}</Text>

      {settings.detection === 'buttons' && (
        <View style={styles.row}>
          {TYPES.map(([t, jp]) => (
            <Pressable key={t} onPress={() => setSelected(t)} style={[styles.button, selected === t && styles.selected]}>
              <Text style={[styles.buttonText, selected === t && styles.selectedText]}>{t}</Text>
              <Text style={[styles.jp, selected === t && styles.selectedText]}>{jp}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.row}>
        <Pressable disabled={complete} onPress={() => setHint(true)} style={[styles.button, complete && styles.disabled]}>
          <Text style={styles.buttonText}>Hint</Text>
        </Pressable>
        <Pressable onPress={() => setShow(SHOW[(SHOW.indexOf(show) + 1) % SHOW.length])} style={[styles.button, show !== 'off' && styles.selected]}>
          <Text style={[styles.buttonText, show !== 'off' && styles.selectedText]}>Show: {show}</Text>
        </Pressable>
        <Pressable onPress={next} style={[styles.button, complete && styles.selected]}>
          <Text style={[styles.buttonText, complete && styles.selectedText]}>{complete ? 'Next' : 'Skip'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: { flex: 1, alignItems: 'center', padding: 16, gap: 8 },
    romaji: { fontSize: 44, fontWeight: '700', color: c.text },
    sub: { fontSize: 15, color: c.muted },
    box: { borderWidth: 2, borderColor: c.red, backgroundColor: c.paper },
    message: { minHeight: 22, fontSize: 15, color: c.text, textAlign: 'center' },
    row: { flexDirection: 'row', gap: 8 },
    button: { minWidth: 92, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    buttonText: { fontSize: 16, fontWeight: '600', color: c.text, textTransform: 'capitalize' },
    jp: { fontSize: 13, color: c.muted },
    selected: { backgroundColor: c.accent, borderColor: c.accent },
    selectedText: { color: c.onAccent },
    disabled: { opacity: 0.4 },
    pill: { minHeight: 30, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: c.hairline },
    chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, maxWidth: 400 },
    chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: c.border },
    chipText: { fontSize: 14, color: c.text },
  });
