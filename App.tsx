import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KanaPractice } from './src/Practice';
import { KanjiArea } from './src/Kanji';
import { Progress } from './src/Progress';
import { SettingsScreen } from './src/Settings';
import { addAttempt, DEFAULT_PROFILE, sanitize, type Attempt, type Profile, type Settings } from './src/profile';
import { DARK, LIGHT, ThemeContext, type Colors } from './src/theme';

const KEY = 'profile';
const TABS = ['Kana', 'Kanji', 'Progress', 'Settings'] as const;

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Kana');
  const system = useColorScheme();
  const theme = profile?.settings.theme ?? 'system';
  const c = (theme === 'system' ? system : theme) === 'dark' ? DARK : LIGHT;
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      try {
        setProfile(sanitize(JSON.parse(raw ?? '')));
      } catch {
        setProfile(DEFAULT_PROFILE);
      }
    });
  }, []);

  // Root view colour behind the screens (avoids a light flash in dark mode).
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg);
  }, [c]);

  const update = (fn: (p: Profile) => Profile) =>
    setProfile((p) => {
      const next = fn(p!);
      AsyncStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });

  const onAttempt = (kana: string, a: Attempt) => update((p) => addAttempt(p, kana, a));
  const onSettings = (patch: Partial<Settings>) => update((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  return (
    <ThemeContext.Provider value={c}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.app}>
          <StatusBar style={c === DARK ? 'light' : 'dark'} />
          {profile && (
            <View style={styles.body}>
              {/* Both practice areas stay mounted so switching tabs doesn't lose the character in progress. */}
              <View style={[styles.body, tab !== 'Kana' && { display: 'none' }]}>
                <KanaPractice settings={profile.settings} onAttempt={onAttempt} onSettings={onSettings} />
              </View>
              <View style={[styles.body, tab !== 'Kanji' && { display: 'none' }]}>
                <KanjiArea
                  settings={profile.settings}
                  collections={profile.collections}
                  onAttempt={onAttempt}
                  onSettings={onSettings}
                  onCollections={(collections) => update((p) => ({ ...p, collections }))}
                />
              </View>
              {tab === 'Progress' && <Progress history={profile.history} />}
              {tab === 'Settings' && <SettingsScreen profile={profile} onChange={(p) => update(() => p)} />}
            </View>
          )}
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
                <Text style={[styles.tabText, tab === t && styles.active]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </ThemeContext.Provider>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    app: { flex: 1, backgroundColor: c.bg },
    body: { flex: 1 },
    tabs: { flexDirection: 'row', borderTopWidth: 1, borderColor: c.hairline },
    tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
    tabText: { fontSize: 15, color: c.muted },
    active: { color: c.accent, fontWeight: '700' },
  });
