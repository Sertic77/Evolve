import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { C, GRADIENTS } from './src/theme';
import FoodScreen from './src/FoodScreen';

// 5 Pestañas con HOME en el centro exacto (Índice 2)
const TABS = [
  { key: 'sleep', label: 'Sueño', icon: 'moon', isCenter: false },
  { key: 'food', label: 'Comida', icon: 'nutrition', isCenter: false },
  { key: 'home', label: 'Home', icon: 'home', isCenter: true },
  { key: 'train', label: 'Entreno', icon: 'barbell', isCenter: false },
  { key: 'measure', label: 'Medidas', icon: 'body', isCenter: false },
] as const;

/* --- Pantalla Coming Soon Estilo HUD Anime --- */
function ComingSoonHUD({ title, icon, subtitle }: { title: string; icon: any; subtitle: string }) {
  return (
    <View style={styles.soonContainer}>
      <LinearGradient
        colors={['rgba(28, 36, 64, 0.7)', 'rgba(12, 16, 28, 0.85)']}
        style={styles.soonCardGradient}
      >
        <View style={styles.soonCyberBadge}>
          <View style={styles.soonPulseDot} />
          <Text style={styles.soonCyberBadgeText}>SISTEMA EN CONSTRUCCIÓN</Text>
        </View>

        <View style={styles.soonIconWrapper}>
          <LinearGradient
            colors={['rgba(124, 92, 255, 0.25)', 'rgba(0, 242, 254, 0.15)']}
            style={styles.soonIconGradient}
          >
            <Ionicons name={icon} size={46} color={C.accentCyan} />
          </LinearGradient>
        </View>

        <Text style={styles.soonTitle}>{title}</Text>
        <Text style={styles.soonSubtitle}>{subtitle}</Text>

        <View style={styles.soonMeterBox}>
          <View style={styles.soonMeterHeader}>
            <Text style={styles.soonMeterLabel}>DESARROLLO DE MÓDULO</Text>
            <Text style={styles.soonMeterPct}>FASE 1 COMPLETADA</Text>
          </View>
          <View style={styles.soonMeterTrack}>
            <LinearGradient
              colors={GRADIENTS.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.soonMeterFill}
            />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState<string>('food');
  const current = TABS.find((t) => t.key === tab)!;

  const getSubtitle = (key: string) => {
    switch (key) {
      case 'home':
        return 'Panel central con métricas globales de entrenamiento, sueño, comidas y estado físico.';
      case 'sleep':
        return 'Monitor de fases de descanso, calidad de sueño, tiempo en REM y recuperación.';
      case 'train':
        return 'Registro y progresión de rutinas, series, repeticiones y cargas de entrenamiento.';
      case 'measure':
        return 'Control de peso corporal, porcentaje de grasa, medidas antropométricas y fotos.';
      default:
        return 'Módulo en desarrollo.';
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.rootSafeArea} edges={['top']}>
        <StatusBar style="light" />

        {/* Pantalla Activa */}
        <View style={styles.mainContent}>
          {tab === 'food' ? (
            <FoodScreen />
          ) : (
            <ComingSoonHUD
              title={current.label}
              icon={current.icon}
              subtitle={getSubtitle(current.key)}
            />
          )}
        </View>

        {/* TabBar Flotante Glassmorphism Anime */}
        <View style={styles.tabBarWrapper}>
          <LinearGradient
            colors={GRADIENTS.tabBar}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.tabBarGradient}
          >
            {TABS.map((t) => {
              const active = t.key === tab;

              // Botón Central HOME con tratamiento destacado
              if (t.isCenter) {
                return (
                  <View key={t.key} style={styles.centerTabWrapper}>
                    <Pressable
                      onPress={() => setTab(t.key)}
                      style={({ pressed }) => [
                        styles.centerBtnPressable,
                        pressed && { transform: [{ scale: 0.92 }] },
                      ]}
                    >
                      <LinearGradient
                        colors={active ? GRADIENTS.primary : ['#222C4A', '#161E34']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.centerBtnGradient}
                      >
                        <Ionicons
                          name={active ? 'home' : 'home-outline'}
                          size={24}
                          color={active ? '#FFF' : C.accentCyan}
                        />
                      </LinearGradient>
                    </Pressable>
                    <Text
                      style={[
                        styles.centerTabLabel,
                        { color: active ? C.accentCyan : C.sub },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </View>
                );
              }

              // Pestañas Laterales Estándar
              return (
                <Pressable
                  key={t.key}
                  style={styles.tabItem}
                  onPress={() => setTab(t.key)}
                >
                  <View
                    style={[
                      styles.tabIconPill,
                      active && styles.tabIconPillActive,
                    ]}
                  >
                    <Ionicons
                      name={(active ? t.icon : `${t.icon}-outline`) as any}
                      size={20}
                      color={active ? C.accentCyan : C.sub}
                    />
                  </View>
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: active ? '#FFF' : C.sub },
                      active && styles.tabLabelActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </LinearGradient>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootSafeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  mainContent: {
    flex: 1,
  },

  // TabBar
  tabBarWrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'visible',
    shadowColor: '#00F2FE',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 20,
  },
  tabBarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tabIconPillActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '800',
    color: C.accentCyan,
  },

  // Botón Home Central Destacado
  centerTabWrapper: {
    flex: 1,
    alignItems: 'center',
    marginTop: -20,
  },
  centerBtnPressable: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 3,
    backgroundColor: 'rgba(8, 11, 20, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.35)',
    shadowColor: '#00F2FE',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  centerBtnGradient: {
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },

  // Coming Soon HUD
  soonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  soonCardGradient: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 26,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: '#7C5CFF',
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  soonCyberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
    marginBottom: 24,
  },
  soonPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accentCyan,
  },
  soonCyberBadgeText: {
    color: C.accentCyan,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  soonIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.35)',
    marginBottom: 20,
  },
  soonIconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  soonSubtitle: {
    color: C.sub,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 24,
  },
  soonMeterBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  soonMeterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  soonMeterLabel: {
    color: C.subMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  soonMeterPct: {
    color: C.accentCyan,
    fontSize: 10,
    fontWeight: '800',
  },
  soonMeterTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  soonMeterFill: {
    width: '65%',
    height: 6,
    borderRadius: 3,
  },
});
