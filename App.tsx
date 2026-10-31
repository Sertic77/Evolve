import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, Dimensions, LayoutChangeEvent } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { C, GRADIENTS, applyGlobalTheme, getPaletteColorWithAlpha } from './src/theme';
import FoodScreen from './src/FoodScreen';
import TrainScreen from './src/TrainScreen';
import MeasureScreen from './src/MeasureScreen';
import WellnessScreen from './src/WellnessScreen';
import HomeScreen from './src/HomeScreen';
import AuthScreen from './src/AuthScreen';
import { useStore, getActivePalette } from './src/store';
import { initSyncService, pullUserDataFromDatabase } from './src/syncService';

// 5 Pestañas con HOME en el centro exacto (Índice 2)
const SIDE_TABS_LEFT = [
  { key: 'sleep', label: 'Bienestar', icon: 'moon' },
  { key: 'food', label: 'Comida', icon: 'nutrition' },
] as const;

const SIDE_TABS_RIGHT = [
  { key: 'train', label: 'Entreno', icon: 'barbell' },
  { key: 'measure', label: 'Medidas', icon: 'body' },
] as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ESTIMATED_BAR_WIDTH = Math.max(300, SCREEN_WIDTH - 28);
const ESTIMATED_CENTER_W = 66;
const PILL_WIDTH = 48;
const HOME_Y_OFFSET = -20;

const TAB_INDEX_MAP: Record<string, number> = {
  sleep: 0,
  food: 1,
  home: 2,
  train: 3,
  measure: 4,
};

function getInitialTabCoords(tabKey: string, totalBarWidth = ESTIMATED_BAR_WIDTH) {
  const contentW = totalBarWidth - 16 - ESTIMATED_CENTER_W;
  const tabW = contentW / 4;
  let centerX = 0;
  if (tabKey === 'sleep') {
    centerX = 8 + tabW * 0.5;
  } else if (tabKey === 'food') {
    centerX = 8 + tabW * 1.5;
  } else if (tabKey === 'home') {
    centerX = 8 + tabW * 2 + ESTIMATED_CENTER_W * 0.5;
  } else if (tabKey === 'train') {
    centerX = 8 + tabW * 2 + ESTIMATED_CENTER_W + tabW * 0.5;
  } else if (tabKey === 'measure') {
    centerX = 8 + tabW * 2 + ESTIMATED_CENTER_W + tabW * 1.5;
  }
  const left = centerX - PILL_WIDTH / 2;
  const right = Math.max(0, totalBarWidth - (left + PILL_WIDTH));
  return { left, right };
}

/* --- Pantalla Coming Soon Anime Pastel Claro --- */
function ComingSoonHUD({ title, icon, subtitle }: { title: string; icon: any; subtitle: string }) {
  return (
    <View style={styles.soonContainer}>
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFF']}
        style={styles.soonCardGradient}
      >
        <View style={styles.soonCyberBadge}>
          <Ionicons name="sparkles" size={12} color={C.pastelPurple} />
          <Text style={styles.soonCyberBadgeText}>✦ EN DESARROLLO ✦</Text>
        </View>

        <View style={styles.soonIconWrapper}>
          <LinearGradient
            colors={['rgba(167, 139, 250, 0.15)', 'rgba(244, 114, 182, 0.15)']}
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

/* --- Componente de Transición Suave entre Pantallas / Tabs --- */
function TabScreenTransition({ tabKey, children }: { tabKey: string; children: React.ReactNode }) {
  const animOpacity = useRef(new Animated.Value(0)).current;
  const animTranslateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    animOpacity.setValue(0);
    animTranslateY.setValue(10);

    Animated.parallel([
      Animated.timing(animOpacity, {
        toValue: 1,
        duration: 250,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(animTranslateY, {
        toValue: 0,
        duration: 250,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [tabKey]);

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: animOpacity,
        transform: [{ translateY: animTranslateY }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function App() {
  const [tab, setTab] = useState<string>('home');
  const activePaletteId = useStore((s) => s.activePaletteId);
  const customPalettes = useStore((s) => s.customPalettes);
  const deletedPaletteIds = useStore((s) => s.deletedPaletteIds);
  const typography = useStore((s) => s.typography);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const palette = getActivePalette({ activePaletteId, customPalettes, deletedPaletteIds });
  // Sincronizar paleta y tipografia con toda la app
  applyGlobalTheme(palette, typography);

  // Inicializar servicio de persistencia y sincronización con la base de datos
  useEffect(() => {
    if (isAuthenticated) {
      initSyncService();
      pullUserDataFromDatabase();
    }
  }, [isAuthenticated]);

  // Animación de transición suave entre Auth (Login/Registro) y la App Principal
  const [mountedAuth, setMountedAuth] = useState(!isAuthenticated);
  const [mountedApp, setMountedApp] = useState(isAuthenticated);
  const authFadeAnim = useRef(new Animated.Value(isAuthenticated ? 1 : 0)).current;
  const authScaleAnim = useRef(new Animated.Value(isAuthenticated ? 1 : 0.96)).current;

  useEffect(() => {
    if (isAuthenticated) {
      // Entrada fluida a la App (Login o Registro exitoso)
      setMountedApp(true);
      authFadeAnim.setValue(0);
      authScaleAnim.setValue(0.96);

      Animated.parallel([
        Animated.timing(authFadeAnim, {
          toValue: 1,
          duration: 380,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(authScaleAnim, {
          toValue: 1,
          duration: 380,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMountedAuth(false);
      });
    } else {
      // Salida fluida a la Pantalla de Login (Cierre de Sesión)
      setMountedAuth(true);
      authFadeAnim.setValue(1);
      authScaleAnim.setValue(1);

      Animated.parallel([
        Animated.timing(authFadeAnim, {
          toValue: 0,
          duration: 320,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(authScaleAnim, {
          toValue: 0.96,
          duration: 320,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMountedApp(false);
      });
    }
  }, [isAuthenticated]);

  // Estados y animaciones para el indicador fluido del Bottom Navigator
  const [barWidth, setBarWidth] = useState(ESTIMATED_BAR_WIDTH);
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const prevTabRef = useRef<string>(tab);
  const initCoords = getInitialTabCoords(tab, ESTIMATED_BAR_WIDTH);
  const indicatorLeft = useRef(new Animated.Value(initCoords.left)).current;
  const indicatorRight = useRef(new Animated.Value(initCoords.right)).current;
  const indicatorY = useRef(new Animated.Value(tab === 'home' ? HOME_Y_OFFSET : 0)).current;
  const homeScaleAnim = useRef(new Animated.Value(tab === 'home' ? 1.06 : 1)).current;
  const runningTabAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const handleTabLayout = (key: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setTabLayouts((prev) => ({ ...prev, [key]: { x, width } }));
  };

  useEffect(() => {
    const prevTab = prevTabRef.current;
    const prevIndex = TAB_INDEX_MAP[prevTab] ?? 2;
    const newIndex = TAB_INDEX_MAP[tab] ?? 2;
    prevTabRef.current = tab;

    // Pop suave del botón flotante de Home cuando se activa/desactiva
    Animated.spring(homeScaleAnim, {
      toValue: tab === 'home' ? 1.06 : 1,
      friction: 6,
      tension: 110,
      useNativeDriver: true,
    }).start();

    // Obtener coordenadas de destino del indicador (tamaño constante 48px)
    let targetLeft = 0;
    let targetRight = 0;
    if (tabLayouts[tab] && barWidth > 0) {
      const layout = tabLayouts[tab];
      const centerX = layout.x + layout.width / 2;
      targetLeft = centerX - PILL_WIDTH / 2;
      targetRight = Math.max(0, barWidth - (targetLeft + PILL_WIDTH));
    } else {
      const coords = getInitialTabCoords(tab, barWidth);
      targetLeft = coords.left;
      targetRight = coords.right;
    }

    if (runningTabAnimRef.current) {
      runningTabAnimRef.current.stop();
    }

    // Animación vertical del indicador (sube al botón Home o genera un arco fluido al cruzar)
    let yAnim: Animated.CompositeAnimation;
    if (tab === 'home') {
      yAnim = Animated.spring(indicatorY, {
        toValue: HOME_Y_OFFSET,
        tension: 105,
        friction: 8,
        useNativeDriver: false,
      });
    } else if (prevTab === 'home') {
      yAnim = Animated.spring(indicatorY, {
        toValue: 0,
        tension: 105,
        friction: 8,
        useNativeDriver: false,
      });
    } else if ((prevIndex < 2 && newIndex > 2) || (prevIndex > 2 && newIndex < 2)) {
      // Cruzando el centro por Home (de izquierda a derecha o viceversa): arco parabólico suave
      yAnim = Animated.sequence([
        Animated.timing(indicatorY, {
          toValue: -16,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.spring(indicatorY, {
          toValue: 0,
          tension: 110,
          friction: 8,
          useNativeDriver: false,
        }),
      ]);
    } else {
      yAnim = Animated.spring(indicatorY, {
        toValue: 0,
        tension: 110,
        friction: 9,
        useNativeDriver: false,
      });
    }

    if (prevIndex === newIndex) {
      indicatorLeft.setValue(targetLeft);
      indicatorRight.setValue(targetRight);
      yAnim.start();
      return;
    }

    // Animación de flujo elástico / líquido entre pestañas (Squash & Stretch fluido)
    if (newIndex > prevIndex) {
      // Movimiento hacia la DERECHA: el borde derecho lidera, el izquierdo lo sigue con retraso
      const anim = Animated.parallel([
        yAnim,
        Animated.spring(indicatorRight, {
          toValue: targetRight,
          tension: 110,
          friction: 9,
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.delay(35),
          Animated.spring(indicatorLeft, {
            toValue: targetLeft,
            tension: 90,
            friction: 8,
            useNativeDriver: false,
          }),
        ]),
      ]);
      runningTabAnimRef.current = anim;
      anim.start(() => {
        runningTabAnimRef.current = null;
      });
    } else {
      // Movimiento hacia la IZQUIERDA: el borde izquierdo lidera, el derecho lo sigue con retraso
      const anim = Animated.parallel([
        yAnim,
        Animated.spring(indicatorLeft, {
          toValue: targetLeft,
          tension: 110,
          friction: 9,
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.delay(35),
          Animated.spring(indicatorRight, {
            toValue: targetRight,
            tension: 90,
            friction: 8,
            useNativeDriver: false,
          }),
        ]),
      ]);
      runningTabAnimRef.current = anim;
      anim.start(() => {
        runningTabAnimRef.current = null;
      });
    }
  }, [tab, tabLayouts, barWidth]);

  return (
    <SafeAreaProvider>
      <View style={[styles.rootContainer, { backgroundColor: palette.bg }]}>
        <StatusBar style={palette.isDark ? 'light' : 'dark'} />

        {/* Pantalla de Autenticación con Animación Suave de Entrada/Salida */}
        {mountedAuth && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: authFadeAnim.interpolate({
                  inputRange: [0, 0.65, 1],
                  outputRange: [1, 0.25, 0],
                }),
                transform: [
                  {
                    scale: authFadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.04],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents={isAuthenticated ? 'none' : 'auto'}
          >
            <SafeAreaView style={[styles.rootSafeArea, { backgroundColor: palette.bg }]} edges={['top']}>
              <AuthScreen />
            </SafeAreaView>
          </Animated.View>
        )}

        {/* Pantalla Principal de la App con Transición Suave */}
        {mountedApp && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: authFadeAnim,
                transform: [{ scale: authScaleAnim }],
              },
            ]}
            pointerEvents={isAuthenticated ? 'auto' : 'none'}
          >
            <SafeAreaView style={[styles.rootSafeArea, { backgroundColor: palette.bg }]} edges={['top']}>
              {/* Pantalla Activa con Transición Suave entre Módulos */}
              <View
                key={`${activePaletteId}-${typography?.titles}-${typography?.subtitles}-${typography?.body}-${typography?.data}`}
                style={[styles.mainContent, { backgroundColor: palette.bg }]}
              >
                <TabScreenTransition tabKey={tab}>
                  {tab === 'home' ? (
                    <HomeScreen onNavigate={(newTab) => setTab(newTab)} />
                  ) : tab === 'sleep' ? (
                    <WellnessScreen />
                  ) : tab === 'food' ? (
                    <FoodScreen />
                  ) : tab === 'train' ? (
                    <TrainScreen />
                  ) : (
                    <MeasureScreen />
                  )}
                </TabScreenTransition>
              </View>

              {/* TAB BAR FLOTANTE CON BOTÓN HOME CENTRAL QUE SOBRESALE */}
              <View style={styles.tabBarContainer}>
                {/* Barra Base Horizontal */}
                <LinearGradient
                  colors={palette.isDark ? ['#1E293B', '#0F172A'] : ['rgba(255, 255, 255, 0.98)', 'rgba(248, 250, 255, 0.96)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.tabBarGradient}
                  onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                >
                  {/* Cápsula indicadora animada que FLUYE entre pestañas */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.slidingTabIndicator,
                      {
                        left: indicatorLeft,
                        right: indicatorRight,
                        transform: [{ translateY: indicatorY }],
                        borderColor: getPaletteColorWithAlpha(palette.primary, 0.35),
                        shadowColor: palette.primary,
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={[
                        getPaletteColorWithAlpha(palette.primary, 0.22),
                        getPaletteColorWithAlpha(palette.secondary || palette.primary, 0.10),
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.slidingTabGradient}
                    />
                  </Animated.View>

                  {/* Pestañas Izquierda (Sueño, Comida) */}
                  {SIDE_TABS_LEFT.map((t) => {
                    const active = t.key === tab;
                    return (
                      <Pressable
                        key={t.key}
                        style={({ pressed }) => [styles.tabItem, pressed && { transform: [{ scale: 0.92 }] }]}
                        onPress={() => setTab(t.key)}
                        onLayout={(e) => handleTabLayout(t.key, e)}
                      >
                        <View style={styles.tabIconPill}>
                          <Ionicons
                            name={(active ? t.icon : `${t.icon}-outline`) as any}
                            size={20}
                            color={active ? palette.primary : palette.textSub}
                          />
                        </View>
                        <Text
                          style={[
                            styles.tabLabel,
                            { color: active ? palette.primary : palette.textSub },
                            active && { fontWeight: '800', color: palette.primary },
                          ]}
                        >
                          {t.label}
                        </Text>
                      </Pressable>
                    );
                  })}

                  {/* Espacio reservado central para el botón Home flotante */}
                  <View
                    style={styles.centerSpaceReserved}
                    onLayout={(e) => handleTabLayout('home', e)}
                  />

                  {/* Pestañas Derecha (Entreno, Medidas) */}
                  {SIDE_TABS_RIGHT.map((t) => {
                    const active = t.key === tab;
                    return (
                      <Pressable
                        key={t.key}
                        style={({ pressed }) => [styles.tabItem, pressed && { transform: [{ scale: 0.92 }] }]}
                        onPress={() => setTab(t.key)}
                        onLayout={(e) => handleTabLayout(t.key, e)}
                      >
                        <View style={styles.tabIconPill}>
                          <Ionicons
                            name={(active ? t.icon : `${t.icon}-outline`) as any}
                            size={20}
                            color={active ? palette.primary : palette.textSub}
                          />
                        </View>
                        <Text
                          style={[
                            styles.tabLabel,
                            { color: active ? palette.primary : palette.textSub },
                            active && { fontWeight: '800', color: palette.primary },
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
                  <Animated.View style={{ transform: [{ scale: homeScaleAnim }] }}>
                    <Pressable
                      onPress={() => setTab('home')}
                      style={({ pressed }) => [
                        styles.floatingHomeBtn,
                        {
                          borderColor: tab === 'home' ? getPaletteColorWithAlpha(palette.primary, 0.45) : (palette.isDark ? '#334155' : 'rgba(203, 213, 225, 0.7)'),
                          shadowColor: palette.primary,
                          backgroundColor: palette.isDark ? '#1E293B' : '#FFFFFF',
                        },
                        pressed && { transform: [{ scale: 0.93 }] },
                      ]}
                    >
                      <LinearGradient
                        colors={tab === 'home' ? [palette.primary, palette.secondary] : (palette.isDark ? ['#334155', '#1E293B'] : ['#E2E8F0', '#CBD5E1'])}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.floatingHomeGradient}
                      >
                        <Ionicons
                          name={tab === 'home' ? 'home' : 'home-outline'}
                          size={26}
                          color={tab === 'home' ? '#FFFFFF' : C.sub}
                        />
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>
                  <Text
                    style={[
                      styles.floatingHomeLabel,
                      { color: tab === 'home' ? palette.primary : palette.textSub },
                    ]}
                  >
                    Home
                  </Text>
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
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
    borderColor: 'rgba(203, 213, 225, 0.7)',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 15,
    position: 'relative',
    overflow: 'visible',
  },
  slidingTabIndicator: {
    position: 'absolute',
    top: 7,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 1,
  },
  slidingTabGradient: {
    flex: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    position: 'relative',
  },
  tabIconPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconPillActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '800',

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
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 20,
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

  // Coming Soon Anime Pastel Claro
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
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  soonCyberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    marginBottom: 24,
  },
  soonCyberBadgeText: {

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
    borderColor: 'rgba(139, 92, 246, 0.25)',
    marginBottom: 20,
  },
  soonIconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonTitle: {
    color: C.text,
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
    backgroundColor: '#F8FAFC',
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

    fontSize: 10,
    fontWeight: '800',
  },
  soonMeterTrack: {
    height: 6,
    backgroundColor: 'rgba(203, 213, 225, 0.5)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  soonMeterFill: {
    width: '65%',
    height: 6,
    borderRadius: 3,
  },
});
