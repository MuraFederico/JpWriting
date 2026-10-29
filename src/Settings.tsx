import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { pct, sanitize, TOLERANCE_MAX, TOLERANCE_MIN, type Detection, type Profile, type Theme } from './profile';
import { DARK, useColors, type Colors } from './theme';

const MODES: [Detection, string, string][] = [
  ['auto', 'Automatic', 'Stop before lifting = tome, flick = harai, flick with a hook = hane.'],
  ['buttons', 'Buttons', 'Pick tome / hane / harai before each stroke.'],
];
const THEMES: [Theme, string][] = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

export function SettingsScreen({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const s = profile.settings;
  const [tolerance, setTolerance] = useState(s.tolerance);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [confirm, setConfirm] = useState(false);
  const set = (patch: Partial<Profile['settings']>) => onChange({ ...profile, settings: { ...s, ...patch } });

  const exportProfile = async () => {
    const json = JSON.stringify(profile);
    setText(json);
    setConfirm(false);
    try {
      await Share.share({ message: json, title: 'JpWriting profile' });
      setStatus('Profile exported.');
    } catch {
      setStatus('Sharing unavailable here; copy the text above.');
    }
  };

  const importProfile = () => {
    let next: Profile;
    try {
      next = sanitize(JSON.parse(text));
    } catch (e) {
      setConfirm(false);
      return setStatus(`Invalid profile: ${(e as Error).message}`);
    }
    if (!confirm) {
      setConfirm(true);
      return setStatus('This replaces your current settings and history. Tap Import again to confirm.');
    }
    onChange(next);
    setTolerance(next.settings.tolerance);
    setConfirm(false);
    setStatus('Profile imported.');
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.h}>Theme</Text>
      <View style={styles.row}>
        {THEMES.map(([theme, label]) => (
          <Pressable
            key={theme}
            onPress={() => set({ theme })}
            style={[styles.button, styles.segment, s.theme === theme && styles.on]}
            accessibilityRole="radio"
            accessibilityState={{ checked: s.theme === theme }}
          >
            <Text style={styles.label}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.h}>Stroke type detection</Text>
      {MODES.map(([mode, label, desc]) => (
        <Pressable
          key={mode}
          onPress={() => set({ detection: mode })}
          style={[styles.option, s.detection === mode && styles.on]}
          accessibilityRole="radio"
          accessibilityState={{ checked: s.detection === mode }}
        >
          <Text style={styles.label}>
            {s.detection === mode ? '● ' : '○ '}
            {label}
          </Text>
          <Text style={styles.sub}>{desc}</Text>
        </Pressable>
      ))}

      <Text style={styles.h}>Precision allowance: {pct(tolerance)} of the box</Text>
      <Slider
        minimumValue={TOLERANCE_MIN}
        maximumValue={TOLERANCE_MAX}
        step={0.01}
        value={tolerance}
        onValueChange={setTolerance}
        onSlidingComplete={(v) => set({ tolerance: v })}
        minimumTrackTintColor={c.accent}
        maximumTrackTintColor={c.border}
        thumbTintColor={c.accent}
        accessibilityLabel="Precision allowance"
      />
      <View style={styles.ends}>
        <Text style={styles.sub}>Strict</Text>
        <Text style={styles.sub}>Lenient</Text>
      </View>

      <Text style={styles.h}>Profile</Text>
      <Text style={styles.sub}>Export shares your settings and history as text. To import, paste that text here.</Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          setConfirm(false);
        }}
        multiline
        placeholder="Profile JSON"
        placeholderTextColor={c.muted}
        keyboardAppearance={c === DARK ? 'dark' : 'light'}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.row}>
        <Pressable onPress={exportProfile} style={styles.button}>
          <Text style={styles.label}>Export</Text>
        </Pressable>
        <Pressable onPress={importProfile} disabled={!text} style={[styles.button, confirm && styles.danger, !text && { opacity: 0.4 }]}>
          <Text style={[styles.label, confirm && { color: c.onAccent }]}>{confirm ? 'Confirm import' : 'Import'}</Text>
        </Pressable>
      </View>
      {!!status && <Text style={styles.sub}>{status}</Text>}

      <Text style={[styles.sub, { marginTop: 24 }]}>Stroke data: KanjiVG by Ulrich Apel, CC BY-SA 3.0.</Text>
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: { padding: 16, gap: 10, maxWidth: 520, width: '100%', alignSelf: 'center' },
    title: { fontSize: 28, fontWeight: '700', color: c.text },
    h: { fontSize: 17, fontWeight: '600', color: c.text, marginTop: 12 },
    sub: { fontSize: 14, color: c.muted },
    label: { fontSize: 16, fontWeight: '600', color: c.text },
    option: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, gap: 2 },
    on: { borderColor: c.accent, backgroundColor: c.accentSoft },
    ends: { flexDirection: 'row', justifyContent: 'space-between' },
    input: {
      minHeight: 90,
      maxHeight: 160,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 10,
      fontSize: 12,
      fontFamily: 'monospace',
      textAlignVertical: 'top',
      color: c.text,
    },
    row: { flexDirection: 'row', gap: 8 },
    button: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: c.border },
    segment: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
    danger: { backgroundColor: c.red, borderColor: c.red },
  });
