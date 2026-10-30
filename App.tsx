import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from './src/theme';
import FoodScreen from './src/FoodScreen';

const TABS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'sleep', label: 'Sueño', icon: 'moon' },
  { key: 'food', label: 'Comida', icon: 'nutrition' },
  { key: 'train', label: 'Entreno', icon: 'barbell' },
  { key: 'measure', label: 'Medidas', icon: 'body' },
] as const;

function ComingSoon({ title, icon }: { title: string; icon: any }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={styles.soonIcon}><Ionicons name={icon} size={44} color={C.accent} /></View>
      <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', marginTop: 18 }}>{title}</Text>
      <Text style={{ color: C.sub, marginTop: 6 }}>Próximamente</Text>
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState<string>('food');
  const current = TABS.find((t) => t.key === tab)!;
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
        <StatusBar style="light" />
        <View style={{ flex: 1 }}>
          {tab === 'food' ? <FoodScreen /> : <ComingSoon title={current.label} icon={current.icon} />}
        </View>
        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
                <View style={[styles.tabIcon, active && { backgroundColor: C.accent + '33' }]}>
                  <Ionicons name={(active ? t.icon : `${t.icon}-outline`) as any} size={22} color={active ? C.accent : C.sub} />
                </View>
                <Text style={{ color: active ? C.text : C.sub, fontSize: 10, fontWeight: '600', marginTop: 2 }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute', left: 14, right: 14, bottom: 24, flexDirection: 'row',
    backgroundColor: '#151925F2', borderRadius: 26, paddingVertical: 8, borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  tab: { flex: 1, alignItems: 'center' },
  tabIcon: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14 },
  soonIcon: { width: 96, height: 96, borderRadius: 30, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
});
