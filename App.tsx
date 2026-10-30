import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { C, GRADIENTS } from './src/theme';
import FoodScreen from './src/FoodScreen';

// 5 Pestañas con HOME en el centro exacto (Índice 2)
const SIDE_TABS_LEFT = [
  { key: 'sleep', label: 'Sueño', icon: 'moon' },
  { key: 'food', label: 'Comida', icon: 'nutrition' },
] as const;

const SIDE_TABS_RIGHT = [
  { key: 'train', label: 'Entreno', icon: 'barbell' },
  { key: 'measure', label: 'Medidas', icon: 'body' },
] as const;

/* --- Pantalla Coming Soon Anime Pastel --- */
function ComingSoonHUD({ title, icon, subtitle }: { title: string; icon: any; subtitle: string }) {
  return (
    <View style={styles.soonContainer}>
      <LinearGradient
        colors={['rgba(32, 42, 74, 0.75)', 'rgba(18, 24, 48, 0.88)']}
        style={styles.soonCardGradient}
      >
        <View style={styles.soonCyberBadge}>
          <Ionicons name="sparkles" size={12} color={C.pastelPink} />
          <Text style={styles.soonCyberBadgeText}>✦ EN DESARROLLO ✦</Text>
        </View>

        <View style={styles.soonIconWrapper}>
          <LinearGradient
            colors={['rgba(184, 161, 255, 0.25)', 'rgba(255, 183, 197, 0.2)']}
            style={styles.soonIconGradient}
          >
            <Ionicons name={icon} size={44} color={C.pastelPurple} />
          </LinearGradient>
        </View>

        <Text style={styles.soonTitle}>{title}</Text>
        <Text style={styles.soonSubtitle}>{subtitle}</Text>

        <View style={styles.soonMeterBox}>
          <View style={styles.soonMeterHeader}>
            <Text style={styles.soonMeterLabel}>MODULO EN PROCESO</Text>
            <Text style={styles.soonMeterPct}>FASE 1 ACTIVA</Text>
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

  const getSubtitle = (key: string) => {
    switch (key) {
      case 'home':
        return 'Panel central con métricas globales de entrenamiento, nutrición y descanso.';
      case 'sleep':
        return 'Monitor de fases de sueño, calidad de descanso y recuperación física.';
      case 'train':
        return 'Registro de rutinas, cargas progresivas y series de entrenamiento.';
      case 'measure':
        return 'Control de peso corporal, porcentaje de grasa y medidas antropométricas.';
      default:
        return 'Módulo en desarrollo.';
    }
  };

  const currentLabel =
    tab === 'home'
      ? 'Home'
      : [...SIDE_TABS_LEFT, ...SIDE_TABS_RIGHT].find((t) => t.key === tab)?.label || 'Evolve';
  const currentIcon =
    tab === 'home'
      ? 'home'
      : [...SIDE_TABS_LEFT, ...SIDE_TABS_RIGHT].find((t) => t.key === tab)?.icon || 'ellipse';

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
              title={currentLabel}
              icon={currentIcon}
              subtitle={getSubtitle(tab)}
            />
          )}
        </View>

        {/* TAB BAR FLOTANTE CON BOTÓN HOME CENTRAL QUE SOBRESALE */}
        <View style={styles.tabBarContainer}>
          {/* Barra Base Horizontal */}
          <LinearGradient
            colors={GRADIENTS.tabBar}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.tabBarGradient}
          >
            {/* Pestañas Izquierda (Sueño, Comida) */}
            {SIDE_TABS_LEFT.map((t) => {
              const active = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  style={styles.tabItem}
                  onPress={() => setTab(t.key)}
                >
                  <View style={[styles.tabIconPill, active && styles.tabIconPillActive]}>
                    <Ionicons
                      name={(active ? t.icon : `${t.icon}-outline`) as any}
                      size={20}
                      color={active ? C.pastelPurple : C.sub}
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

            {/* Espacio reservado central para el botón Home flotante */}
            <View style={styles.centerSpaceReserved} />

            {/* Pestañas Derecha (Entreno, Medidas) */}
            {SIDE_TABS_RIGHT.map((t) => {
              const active = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  style={styles.tabItem}
                  onPress={() => setTab(t.key)}
                >
                  <View style={[styles.tabIconPill, active && styles.tabIconPillActive]}>
                    <Ionicons
                      name={(active ? t.icon : `${t.icon}-outline`) as any}
                      size={20}
                      color={active ? C.pastelPurple : C.sub}
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

          {/* BOTÓN HOME CENTRAL FLOTANTE SOBRESALIENTE */}
          <View style={styles.floatingHomeAnchor} pointerEvents="box-none">
            <Pressable
              onPress={() => setTab('home')}
              style={({ pressed }) => [
                styles.floatingHomeBtn,
                pressed && { transform: [{ scale: 0.93 }] },
              ]}
            >
              <LinearGradient
                colors={tab === 'home' ? GRADIENTS.floatingHomeActive : GRADIENTS.floatingHomeInactive}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.floatingHomeGradient}
              >
                <Ionicons
                  name={tab === 'home' ? 'home' : 'home-outline'}
                  size={26}
                  color={tab === 'home' ? '#1E1738' : C.pastelPurple}
                />
              </LinearGradient>
            </Pressable>
            <Text
              style={[
                styles.floatingHomeLabel,
                { color: tab === 'home' ? C.pastelPink : C.sub },
              ]}
            >
              Home
            </Text>
          </View>
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

  // Contenedor principal del TabBar
  tabBarContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 18,
    alignItems: 'center',
  },
  tabBarGradient: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 26,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 15,
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
    backgroundColor: 'rgba(184, 161, 255, 0.15)',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '800',
    color: '#FFF',
  },
  centerSpaceReserved: {
    width: 66,
  },

  // BOTÓN HOME FLOTANTE QUE SOBRESALE
  floatingHomeAnchor: {
    position: 'absolute',
    top: -24, // <--- Sobresale 24px por encima de la barra
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHomeBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 3,
    backgroundColor: C.bg,
    borderWidth: 2,
    borderColor: 'rgba(184, 161, 255, 0.45)',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 25,
  },
  floatingHomeGradient: {
    flex: 1,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHomeLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.2,
  },

  // Coming Soon Anime Pastel
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
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  soonCyberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 183, 197, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 197, 0.3)',
    marginBottom: 24,
  },
  soonCyberBadgeText: {
    color: C.pastelPink,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  soonIconWrapper: {
    width: 92,
    height: 92,
    borderRadius: 46,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(184, 161, 255, 0.35)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    color: C.pastelPurple,
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
