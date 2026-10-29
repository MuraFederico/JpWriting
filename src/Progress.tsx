import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { KANA } from './Practice';
import { median, pct, MAX_ATTEMPTS, type Attempt } from './profile';
import { useColors, type Colors } from './theme';

const SERIES = [
  { key: 'correctness', label: 'Correctness', color: 'accent' },
  { key: 'precision', label: 'Precision', color: 'series2' },
] as const;

export function Progress({ history }: { history: Record<string, Attempt[]> }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<string | null>(null);
  const tile = (Math.min(width, 520) - 32 - 4 * 8) / 5;

  if (selected) return <Detail kana={selected} list={history[selected] ?? []} width={Math.min(width, 520) - 32} onBack={() => setSelected(null)} />;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Progress</Text>
      <Text style={styles.sub}>Median correctness over the last {MAX_ATTEMPTS} attempts. Tap a kana for its trend.</Text>
      <View style={styles.grid}>
        {KANA.map(({ kana, romaji }) => {
          const list = history[kana] ?? [];
          const m = median(list.map((a) => a.correctness));
          return (
            <Pressable
              key={kana}
              onPress={() => setSelected(kana)}
              accessibilityLabel={`${romaji}: ${m === undefined ? 'no attempts' : `${pct(m)} median correctness, ${list.length} attempts`}`}
              style={[styles.tile, { width: tile, backgroundColor: m === undefined ? c.empty : `rgba(${c.accentRgb},${0.1 + 0.45 * m})` }]}
            >
              <Text style={styles.kana}>{kana}</Text>
              <Text style={styles.small}>{romaji}</Text>
              <Text style={styles.value}>{m === undefined ? '–' : pct(m)}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function Detail({ kana, list, width, onBack }: { kana: string; list: Attempt[]; width: number; onBack: () => void }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const romaji = KANA.find((k) => k.kana === kana)?.romaji;
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ All kana</Text>
      </Pressable>
      <Text style={styles.title}>
        {kana} <Text style={styles.sub}>{romaji}</Text>
      </Text>
      {list.length ? (
        <>
          <View style={styles.legend}>
            {SERIES.map((s) => (
              <View key={s.key} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: c[s.color] }]} />
                <Text style={styles.sub}>
                  {s.label} · median {pct(median(list.map((a) => a[s.key]))!)}
                </Text>
              </View>
            ))}
          </View>
          <Trend list={list} width={width} />
          <Text style={[styles.small, { alignSelf: 'center' }]}>attempts, oldest → newest</Text>
          <View style={styles.table}>
            <View style={styles.tr}>
              <Text style={[styles.td, styles.th]}>Date</Text>
              <Text style={[styles.td, styles.th]}>Correctness</Text>
              <Text style={[styles.td, styles.th]}>Precision</Text>
            </View>
            {[...list].reverse().map((a) => (
              <View key={a.t} style={styles.tr}>
                <Text style={styles.td}>{new Date(a.t).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</Text>
                <Text style={styles.td}>{pct(a.correctness)}</Text>
                <Text style={styles.td}>{pct(a.precision)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.sub}>No attempts yet.</Text>
      )}
    </ScrollView>
  );
}

function Trend({ list, width }: { list: Attempt[]; width: number }) {
  const c = useColors();
  const H = 200;
  const [l, r, t, b] = [40, 44, 10, 10];
  const w = width - l - r;
  const x = (i: number) => l + (list.length === 1 ? w / 2 : (i * w) / (list.length - 1));
  const y = (v: number) => t + (1 - v) * (H - t - b);
  const last = list[list.length - 1];
  // End labels: nudge apart when the two values are close.
  const [yc, yp] = [y(last.correctness), y(last.precision)];
  const gap = 14 - Math.abs(yc - yp);
  const labelY = gap > 0 ? (yc <= yp ? [yc - gap / 2, yp + gap / 2] : [yc + gap / 2, yp - gap / 2]) : [yc, yp];

  return (
    <Svg width={width} height={H}>
      {[0, 0.5, 1].map((v) => (
        <G key={v}>
          <Line x1={l} x2={l + w} y1={y(v)} y2={y(v)} stroke={c.hairline} strokeWidth={1} />
          <SvgText x={l - 6} y={y(v) + 4} fontSize={11} fill={c.muted} textAnchor="end">
            {pct(v)}
          </SvgText>
        </G>
      ))}
      {SERIES.map((s, si) => (
        <G key={s.key}>
          <Polyline points={list.map((a, i) => `${x(i)},${y(a[s.key])}`).join(' ')} stroke={c[s.color]} strokeWidth={2} fill="none" strokeLinejoin="round" />
          {list.map((a, i) => (
            <Circle key={i} cx={x(i)} cy={y(a[s.key])} r={4} fill={c[s.color]} stroke={c.bg} strokeWidth={2} />
          ))}
          <SvgText x={x(list.length - 1) + 8} y={labelY[si] + 4} fontSize={11} fill={c.text}>
            {pct(last[s.key])}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: { padding: 16, gap: 10, maxWidth: 520, width: '100%', alignSelf: 'center' },
    title: { fontSize: 28, fontWeight: '700', color: c.text },
    sub: { fontSize: 14, color: c.muted },
    small: { fontSize: 12, color: c.muted },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tile: { borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
    kana: { fontSize: 26, color: c.text },
    value: { fontSize: 13, fontWeight: '600', color: c.text },
    back: { paddingVertical: 6 },
    backText: { fontSize: 16, color: c.accent },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 16, height: 3, borderRadius: 2 },
    table: { marginTop: 8, borderTopWidth: 1, borderColor: c.hairline },
    tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: c.hairline, paddingVertical: 6 },
    td: { flex: 1, fontSize: 13, color: c.text },
    th: { fontWeight: '600', color: c.muted },
  });
