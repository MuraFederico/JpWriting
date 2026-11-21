import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { KANA, Practice } from './Practice';
import { NAME_MAX, type Attempt, type Collection, type Settings } from './profile';
import { DARK, useColors, type Colors } from './theme';

const ALL = KANA.flatMap((k, i) => (k.script === 'kanji' ? [i] : []));
// Collections store characters, so kanji no longer in the data are simply skipped.
const poolOf = (kanji: string[]) => ALL.filter((i) => kanji.includes(KANA[i].kana));

type Screen = { kind: 'home' } | { kind: 'practice'; title: string; pool: number[] } | { kind: 'edit'; at: number | null };

export function KanjiArea({
  settings,
  collections,
  onAttempt,
  onSettings,
  onCollections,
}: {
  settings: Settings;
  collections: Collection[];
  onAttempt: (kana: string, a: Attempt) => void;
  onSettings: (patch: Partial<Settings>) => void;
  onCollections: (c: Collection[]) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [view, setView] = useState<Screen>({ kind: 'home' });
  const home = () => setView({ kind: 'home' });

  if (view.kind === 'practice')
    return (
      <Practice
        settings={settings}
        onAttempt={onAttempt}
        onSettings={onSettings}
        pool={view.pool}
        controls={
          <Pressable onPress={home} style={styles.pill} accessibilityLabel="Back to kanji">
            <Text style={styles.sub}>‹ {view.title}</Text>
          </Pressable>
        }
      />
    );

  if (view.kind === 'edit')
    return (
      <Editor
        initial={view.at === null ? undefined : collections[view.at]}
        onCancel={home}
        onSave={(col) => {
          onCollections(view.at === null ? [...collections, col] : collections.map((x, i) => (i === view.at ? col : x)));
          home();
        }}
        onDelete={
          view.at === null
            ? undefined
            : () => {
                onCollections(collections.filter((_, i) => i !== view.at));
                home();
              }
        }
      />
    );

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Kanji</Text>
      <Pressable onPress={() => setView({ kind: 'practice', title: 'All kanji', pool: ALL })} style={[styles.card, styles.on]}>
        <Text style={styles.label}>Review all kanji · {ALL.length}</Text>
        <Text style={styles.chars}>{ALL.map((i) => KANA[i].kana).join(' ')}</Text>
      </Pressable>

      <View style={styles.headRow}>
        <Text style={styles.h}>Collections</Text>
        <Pressable onPress={() => setView({ kind: 'edit', at: null })} style={styles.button}>
          <Text style={styles.label}>+ New</Text>
        </Pressable>
      </View>
      {!collections.length && <Text style={styles.sub}>No collections yet. Group kanji you want to review together.</Text>}
      {collections.map((col, at) => {
        const pool = poolOf(col.kanji);
        return (
          <View key={at} style={styles.card}>
            <Text style={styles.label}>
              {col.name} <Text style={styles.sub}>· {pool.length}</Text>
            </Text>
            <Text style={styles.chars}>{pool.map((i) => KANA[i].kana).join(' ')}</Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => setView({ kind: 'practice', title: col.name, pool })}
                disabled={!pool.length}
                style={[styles.button, styles.selected, !pool.length && { opacity: 0.4 }]}
              >
                <Text style={[styles.label, { color: c.onAccent }]}>Review</Text>
              </Pressable>
              <Pressable onPress={() => setView({ kind: 'edit', at })} style={styles.button}>
                <Text style={styles.label}>Edit</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function Editor({ initial, onSave, onCancel, onDelete }: { initial?: Collection; onSave: (c: Collection) => void; onCancel: () => void; onDelete?: () => void }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { width } = useWindowDimensions();
  const tile = (Math.min(width, 520) - 32 - 4 * 8) / 5;
  const [name, setName] = useState(initial?.name ?? '');
  const [picked, setPicked] = useState<string[]>(initial?.kanji ?? []);
  const [confirm, setConfirm] = useState(false);
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const ok = !!name.trim() && picked.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onCancel} style={styles.back}>
        <Text style={styles.backText}>‹ Kanji</Text>
      </Pressable>
      <Text style={styles.title}>{initial ? 'Edit collection' : 'New collection'}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={NAME_MAX}
        placeholder="Name"
        placeholderTextColor={c.muted}
        keyboardAppearance={c === DARK ? 'dark' : 'light'}
        style={styles.input}
        accessibilityLabel="Collection name"
      />
      <Text style={styles.sub}>{picked.length} selected · tap to add or remove</Text>
      <View style={styles.grid}>
        {ALL.map((i) => {
          const { kana, romaji } = KANA[i];
          const on = picked.includes(kana);
          return (
            <Pressable
              key={kana}
              onPress={() => toggle(kana)}
              style={[styles.tile, { width: tile }, on && styles.selected]}
              accessibilityRole="checkbox"
              accessibilityLabel={`${kana} ${romaji}`}
              accessibilityState={{ checked: on }}
            >
              <Text style={[styles.kanji, on && { color: c.onAccent }]}>{kana}</Text>
              <Text style={[styles.small, on && { color: c.onAccent }]}>{romaji}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        <Pressable onPress={() => onSave({ name: name.trim(), kanji: picked })} disabled={!ok} style={[styles.button, styles.selected, !ok && { opacity: 0.4 }]}>
          <Text style={[styles.label, { color: c.onAccent }]}>Save</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={styles.button}>
          <Text style={styles.label}>Cancel</Text>
        </Pressable>
        {onDelete && (
          <Pressable onPress={() => (confirm ? onDelete() : setConfirm(true))} style={[styles.button, confirm && styles.danger]}>
            <Text style={[styles.label, confirm && { color: c.onAccent }]}>{confirm ? 'Confirm delete' : 'Delete'}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: { padding: 16, gap: 10, maxWidth: 520, width: '100%', alignSelf: 'center' },
    title: { fontSize: 28, fontWeight: '700', color: c.text },
    h: { fontSize: 17, fontWeight: '600', color: c.text },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    sub: { fontSize: 14, fontWeight: '400', color: c.muted },
    small: { fontSize: 12, color: c.muted },
    label: { fontSize: 16, fontWeight: '600', color: c.text },
    chars: { fontSize: 22, color: c.text },
    card: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, gap: 6 },
    on: { borderColor: c.accent, backgroundColor: c.accentSoft },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    button: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: c.border },
    selected: { backgroundColor: c.accent, borderColor: c.accent },
    danger: { backgroundColor: c.red, borderColor: c.red },
    pill: { minHeight: 30, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: c.hairline },
    back: { paddingVertical: 6 },
    backText: { fontSize: 16, color: c.accent },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 10, fontSize: 16, color: c.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tile: { borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    kanji: { fontSize: 26, color: c.text },
  });
