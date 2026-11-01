import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Switch,
  Platform,
  Alert,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { fmt, getPaletteColorWithAlpha } from './theme';
import {
  useStore,
  dateKey,
  scaleMacros,
  isSupplementActiveOnDate,
  getActivePalette,
  getFontFamily,
  PRESET_PALETTES,
  ColorPalette,
  FontStyleOption,
  GenderOption,
  UserGoal,
  GoalType,
} from './store';
import { pushUserDataToDatabase, pullUserDataFromDatabase } from './syncService';

const COLOR_SWATCHES = [
  '#8B5CF6', // Lavanda
  '#EC4899', // Rosa Sakura
  '#F43F5E', // Coral Rubí
  '#F97316', // Naranja
  '#F59E0B', // Miel / Ámbar
  '#10B981', // Esmeralda / Verde
  '#14B8A6', // Menta
  '#06B6D4', // Cian
  '#3B82F6', // Azul Real
  '#6366F1', // Índigo Eléctrico
  '#A855F7', // Púrpura Neón
  '#64748B', // Pizarra
];

export const FONT_OPTIONS: Array<{
  key: FontStyleOption;
  label: string;
  preview: string;
  description: string;
}> = [
  { key: 'system', label: 'Moderno (System)', preview: 'EVOLVE 2,450 kcal', description: 'Limpio, legible y nativo' },
  { key: 'condensed', label: 'Deportivo Condensado', preview: 'FITNESS PERFORMANCE', description: 'Compacto y enérgico' },
  { key: 'athletic', label: 'Atleta Bold (Impact)', preview: 'SERIES & FUERZA 120 KG', description: 'Pesado, contundente y llamativo' },
  { key: 'rounded', label: 'Suave & Rounded', preview: 'Recuperación 8h 15m', description: 'Bordes suaves y redondeados' },
  { key: 'futuristic', label: 'Futurista Tech', preview: 'BIO-METRICS ACTIVE', description: 'Moderno y cibernético' },
  { key: 'elegant', label: 'Editorial Elegante', preview: 'Salud, Bienestar y Vida', description: 'Serif clásico y sofisticado' },
  { key: 'serif', label: 'Serif Literario', preview: 'Diario de Progreso Diario', description: 'Estilo editorial y tradicional' },
  { key: 'monospace', label: 'Código Monoespaciado', preview: '119/78 mmHg · 77.2 kg', description: 'Precisión técnica y datos puros' },
];

export interface XpBreakdown {
  foodXp: number;
  foodDays: number;
  workoutXp: number;
  workoutDays: number;
  sleepXp: number;
  sleepDays: number;
  supplementsXp: number;
  supplementDays: number;
  measurementsXp: number;
  measurementDays: number;
  healthXp: number;
  healthDays: number;
  totalXp: number;
  userLevel: number;
  rankTitle: string;
  currentLevelXp: number;
  neededForNextLevel: number;
  levelProgressPercent: number;
}

export function calculateWorkoutStreak(
  workoutLogs: Record<string, any[]> | undefined,
  todayStr?: string
): {
  currentStreak: number;
  lastWorkoutDate: string | null;
  daysSinceLastWorkout: number;
} {
  if (!workoutLogs) return { currentStreak: 0, lastWorkoutDate: null, daysSinceLastWorkout: 999 };

  // Fechas donde se haya realizado al menos 1 ejercicio
  const trainedDates = Object.entries(workoutLogs)
    .filter(([_, exercises]) => Array.isArray(exercises) && exercises.length > 0)
    .map(([date]) => date)
    .sort();

  if (trainedDates.length === 0) {
    return { currentStreak: 0, lastWorkoutDate: null, daysSinceLastWorkout: 999 };
  }

  const today = todayStr ? new Date(`${todayStr}T12:00:00`) : new Date();
  today.setHours(12, 0, 0, 0);

  const lastDateStr = trainedDates[trainedDates.length - 1];
  const lastWorkoutDate = new Date(`${lastDateStr}T12:00:00`);

  const diffMs = today.getTime() - lastWorkoutDate.getTime();
  const daysSinceLast = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  // Regla de racha: Si pasan más de 5 días sin entrenar, la racha se corta (0)
  if (daysSinceLast > 5) {
    return { currentStreak: 0, lastWorkoutDate: lastDateStr, daysSinceLastWorkout: daysSinceLast };
  }

  // Contar días de entreno acumulados en esta racha continua (sin pausas > 5 días entre sesiones)
  let streak = 1;
  for (let i = trainedDates.length - 1; i > 0; i--) {
    const cur = new Date(`${trainedDates[i]}T12:00:00`);
    const prev = new Date(`${trainedDates[i - 1]}T12:00:00`);
    const gapDays = Math.round((cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    if (gapDays <= 5) {
      streak++;
    } else {
      break;
    }
  }

  return { currentStreak: streak, lastWorkoutDate: lastDateStr, daysSinceLastWorkout: daysSinceLast };
}

export function calculateUserXpAndLevel(
  logs: Record<string, any[]> | undefined,
  workoutLogs: Record<string, any[]> | undefined,
  sleepLogs: Record<string, any> | undefined,
  supplementLogs: Record<string, Record<string, boolean[]>> | undefined,
  measurementLogs: Record<string, any> | undefined,
  weightLogs: Record<string, number> | undefined,
  bodyFatLogs: Record<string, number> | undefined,
  photoLogs: Record<string, any[]> | undefined,
  healthLogs: Record<string, any> | undefined,
  ingredients?: any[]
): XpBreakdown {
  const ingMap = new Map<string, any>();
  if (Array.isArray(ingredients)) {
    ingredients.forEach((ing) => ingMap.set(ing.id, ing));
  }

  // 1. Comida & Nutrición (Prioridad #1: Escala directamente por calorías consumidas)
  // Base 10 XP + ~1 XP por cada 100 kcal consumidas. ¡3,500 kcal otorga mucho más que 500 kcal!
  let foodXp = 0;
  let foodDays = 0;
  Object.values(logs || {}).forEach((meals) => {
    if (Array.isArray(meals) && meals.length > 0) {
      foodDays++;
      let dayKcal = 0;
      let dayProtein = 0;

      meals.forEach((block: any) => {
        if (block && Array.isArray(block.items)) {
          block.items.forEach((item: any) => {
            const ing = ingMap.get(item.ingredientId);
            if (ing) {
              const m = scaleMacros(ing, item.grams || 0);
              dayKcal += m.kcal;
              dayProtein += m.protein;
            } else if (item.grams) {
              dayKcal += (item.grams * 1.5);
            }
          });
        }
      });

      // 10 XP base + 1 XP por cada 100 kcal
      const calXp = Math.round(dayKcal / 100);
      let dayPoints = 10 + calXp;

      // Bonus si superó 90g de proteína o completó 3+ comidas
      if (dayProtein >= 90 || meals.length >= 3) {
        dayPoints += 5;
      }

      foodXp += dayPoints;
    }
  });

  // 2. Entrenamiento & Fuerza (Prioridad #2: Escala con series y tonelaje / peso levantado)
  // Base 15 XP + 2 XP por serie + Puntos por peso levantado (volumen total = reps * peso)
  let workoutXp = 0;
  let workoutDays = 0;
  Object.values(workoutLogs || {}).forEach((exercises) => {
    if (Array.isArray(exercises) && exercises.length > 0) {
      workoutDays++;
      let sessionSets = 0;
      let sessionTonnage = 0; // Kilos totales movidos
      let sessionTimeSeconds = 0;

      exercises.forEach((ex: any) => {
        if (ex && Array.isArray(ex.sets)) {
          ex.sets.forEach((set: any) => {
            sessionSets++;
            const w = Number(set.weight) || 0;
            const r = Number(set.reps) || 0;
            if (w > 0 && r > 0) {
              sessionTonnage += (w * r);
            }
            if (set.timeSeconds) {
              sessionTimeSeconds += Number(set.timeSeconds) || 0;
            }
          });
        }
      });

      // 15 XP base por registrar la sesión
      // +2 XP por cada serie completada
      // + Puntos de fuerza e intensidad según el tonelaje levantado (hasta 30 XP)
      const setsXp = sessionSets * 2;
      const tonnageXp = Math.min(30, Math.round(sessionTonnage / 350));
      const cardioXp = Math.min(15, Math.round(sessionTimeSeconds / 180));

      workoutXp += (15 + setsXp + tonnageXp + cardioXp);
    }
  });

  // 3. Sueño & Recuperación (Prioridad #3: Escala con horas y calidad de descanso)
  let sleepXp = 0;
  let sleepDays = 0;
  Object.values(sleepLogs || {}).forEach((entry) => {
    if (entry && (entry.totalSleepHours || entry.sleepScore || entry.deepSleepHours)) {
      sleepDays++;
      const hours = Number(entry.totalSleepHours) || 7.5;
      const score = Number(entry.sleepScore) || 80;

      // Base 8 XP + 2 XP por hora dormida
      let nightPoints = 8 + Math.round(hours * 2);

      // Calidad de recuperación
      if (score >= 85 || (entry.deepSleepHours && entry.deepSleepHours >= 1.5)) {
        nightPoints += 6;
      } else if (score >= 70) {
        nightPoints += 3;
      }

      sleepXp += nightPoints;
    }
  });

  // 4. Suplementación (Prioridad #4: Escala directamente por cantidad de suplementos / tomas)
  let supplementsXp = 0;
  let supplementDays = 0;
  Object.values(supplementLogs || {}).forEach((dayMap) => {
    let takenCount = 0;
    if (dayMap && typeof dayMap === 'object') {
      Object.values(dayMap).forEach((arr) => {
        if (Array.isArray(arr)) takenCount += arr.filter(Boolean).length;
      });
    }
    if (takenCount > 0) {
      supplementDays++;
      // +4 XP por cada toma de suplemento realizada (1 toma = 4 XP, 2 = 8 XP, 3 = 12 XP, 4 = 16 XP, etc.)
      supplementsXp += (takenCount * 4);
    }
  });

  // 5. Medidas Corporales, Peso & Fotos (Prioridad #5: Escala con cantidad de grupos musculares medidos)
  let measurementsXp = 0;
  const measurementDates = new Set<string>();
  Object.entries(measurementLogs || {}).forEach(([d, m]) => {
    if (m && typeof m === 'object') {
      const partsMeasured = Object.keys(m).length;
      if (partsMeasured > 0) {
        measurementDates.add(d);
        // Base 5 XP + 2 XP por cada parte medida del cuerpo
        measurementsXp += (5 + partsMeasured * 2);
      }
    }
  });
  Object.keys(weightLogs || {}).forEach((d) => {
    if (!measurementDates.has(d)) {
      measurementsXp += 5; // Registro de peso
    }
  });
  Object.keys(photoLogs || {}).forEach(() => {
    measurementsXp += 12; // Fotos de evolución física
  });
  const measurementDays = measurementDates.size + Object.keys(weightLogs || {}).length;

  // 6. Biomarcadores de Salud: +5 XP por cada indicador registrado
  let healthXp = 0;
  let healthDays = 0;
  Object.values(healthLogs || {}).forEach((entry) => {
    if (entry && typeof entry === 'object') {
      const indicatorsCount = Object.keys(entry).length;
      if (indicatorsCount > 0) {
        healthDays++;
        healthXp += (indicatorsCount * 5);
      }
    }
  });

  const totalXp = foodXp + workoutXp + sleepXp + supplementsXp + measurementsXp + healthXp;

  // Curva de Niveles Progresiva: Nivel L requiere 140 + (L - 1) * 45 XP
  let level = 1;
  let remainingXp = totalXp;
  let neededForCurrent = 140;

  while (remainingXp >= neededForCurrent) {
    remainingXp -= neededForCurrent;
    level++;
    neededForCurrent = 140 + (level - 1) * 45;
  }

  const currentLevelXp = remainingXp;
  const neededForNextLevel = neededForCurrent;
  const levelProgressPercent = Math.min(100, Math.max(0, Math.round((currentLevelXp / neededForNextLevel) * 100)));

  let rankTitle = 'Iniciado Fitness';
  if (level >= 100) rankTitle = 'Leyenda Evolve';
  else if (level >= 90) rankTitle = 'Deidad del Hierro';
  else if (level >= 80) rankTitle = 'Inmortal de Acero';
  else if (level >= 70) rankTitle = 'Semidiós del Fitness';
  else if (level >= 60) rankTitle = 'Coloso Indomable';
  else if (level >= 50) rankTitle = 'Maestro del Olimpo';
  else if (level >= 40) rankTitle = 'Titán del Hierro';
  else if (level >= 30) rankTitle = 'Atleta Élite';
  else if (level >= 20) rankTitle = 'Atleta Avanzado';
  else if (level >= 10) rankTitle = 'Guerrero del Gym';
  else if (level >= 5) rankTitle = 'Atleta Dedicado';

  return {
    foodXp,
    foodDays,
    workoutXp,
    workoutDays,
    sleepXp,
    sleepDays,
    supplementsXp,
    supplementDays,
    measurementsXp,
    measurementDays,
    healthXp,
    healthDays,
    totalXp,
    userLevel: level,
    rankTitle,
    currentLevelXp,
    neededForNextLevel,
    levelProgressPercent,
  };
}

export default function HomeScreen({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const {
    userProfile,
    setUserProfile,
    activePaletteId,
    customPalettes,
    deletedPaletteIds,
    typography,
    homeWidgets,
    logs,
    ingredients,
    workoutLogs,
    measurementLogs,
    sleepLogs,
    photoLogs,
    supplements,
    supplementLogs,
    healthLogs,
    weightLogs,
    bodyFatLogs,
    logout,
    syncStatus,
    lastSyncedAt,
    syncError,
  } = useStore();

  const [syncingManual, setSyncingManual] = useState(false);

  const handleManualSync = async () => {
    setSyncingManual(true);
    const res = await pushUserDataToDatabase();
    setSyncingManual(false);
    if (res.success) {
      Alert.alert('Base de Datos Sincronizada', 'Toda tu información ha sido guardada en la base de datos con éxito.');
    } else {
      Alert.alert('Error al guardar', res.error || 'No se pudo conectar con el servidor.');
    }
  };

  const handleManualPull = async () => {
    setSyncingManual(true);
    const res = await pullUserDataFromDatabase();
    setSyncingManual(false);
    if (res.success) {
      Alert.alert('Datos Restaurados', 'Se cargaron los datos guardados en la base de datos.');
    } else {
      Alert.alert('Error al restaurar', res.error || 'No se pudo conectar con el servidor.');
    }
  };

  const handleCloudIconPress = () => {
    let statusText = 'Toda tu información está guardada y sincronizada en la base de datos.';
    if (syncStatus === 'syncing') statusText = 'Guardando tus datos en la base de datos en este momento...';
    if (syncStatus === 'error') statusText = `Error de sincronización: ${syncError || 'Servidor no alcanzable'}. Tus datos siguen seguros localmente.`;

    const lastTime = lastSyncedAt ? `\nÚltimo guardado: ${lastSyncedAt}` : '';

    Alert.alert(
      'Base de Datos Evolve',
      `${statusText}${lastTime}`,
      [
        { text: 'Cerrar', style: 'cancel' },
        { text: 'Sincronizar Ahora', onPress: handleManualSync },
      ],
    );
  };

  // Control y animación del menú hamburguesa en la cabecera
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    const nextState = !menuOpen;
    setMenuOpen(nextState);
    Animated.spring(menuAnim, {
      toValue: nextState ? 1 : 0,
      friction: 7,
      tension: 65,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    if (!menuOpen) return;
    setMenuOpen(false);
    Animated.spring(menuAnim, {
      toValue: 0,
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();
  };

  const handleLogout = () => {
    closeMenu();
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar tu sesión en este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const palette = getActivePalette({ activePaletteId, customPalettes, deletedPaletteIds });

  const pColors = palette.colors && palette.colors.length >= 2 ? palette.colors : [palette.primary, palette.secondary];
  const c1 = pColors[0] || palette.primary;
  const c2 = pColors[1] || palette.secondary;
  const c3 = pColors[2] || pColors[0] || palette.primary;
  const c4 = pColors[3] || pColors[1] || palette.secondary;
  const c5 = pColors[4] || pColors[2] || pColors[0] || palette.primary;

  // Fecha de hoy
  const today = new Date();
  const todayKeyStr = dateKey(today);

  const rawDayStr = today.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const dayStrClean = rawDayStr.replace('.', '');

  // Tipografías activas
  const titleFont = getFontFamily(typography?.titles || 'system');
  const subtitleFont = getFontFamily(typography?.subtitles || 'system');
  const bodyFont = getFontFamily(typography?.body || 'system');
  const dataFont = getFontFamily(typography?.data || 'system');

  // Datos de usuario
  const userName = userProfile?.name || 'Sergio Tamayo';
  const userNick = userProfile?.nickname ? `@${userProfile.nickname.replace('@', '')}` : '@Sertic77';

  // Iniciales para el avatar
  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'ST';

  /* ==========================================================
     CÁLCULO DE DATOS REALES PARA WIDGETS
  ========================================================== */
  // 1. Nutrición de hoy
  const todayMeals = logs[todayKeyStr] || [];
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalSugar = 0;

  todayMeals.forEach((block) => {
    block.items.forEach((item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      const m = scaleMacros(ing, item.grams);
      totalKcal += m.kcal;
      totalProtein += m.protein;
      totalCarbs += m.carbs;
      totalFat += m.fat;
      totalSugar += (m.sugar || 0);
    });
  });

  const targetKcal = 2200;
  const kcalPct = Math.min(100, Math.round((totalKcal / targetKcal) * 100));

  // 2. Entreno de hoy
  const todayWorkouts = workoutLogs[todayKeyStr] || [];
  const exercisesCount = todayWorkouts.length;
  const setsCount = todayWorkouts.reduce((acc, curr) => acc + (curr.sets?.length || 0), 0);

  // 3. Suplementos de hoy
  const activeSupps = (supplements || []).filter((s) => isSupplementActiveOnDate(s, todayKeyStr));
  let totalDosesTarget = 0;
  let totalDosesTaken = 0;
  activeSupps.forEach((s) => {
    totalDosesTarget += s.dailyTarget;
    const takenArr = supplementLogs[todayKeyStr]?.[s.id] || [];
    totalDosesTaken += takenArr.filter(Boolean).length;
  });

  // 4. Salud de hoy o último registro
  const todayHealth = healthLogs[todayKeyStr] || {};
  const pressureVal = todayHealth['presion']?.value;
  const pressureSec = todayHealth['presion']?.secondaryValue;
  const glucoseVal = todayHealth['azucar']?.value;

  // 5. Peso corporal y composición
  const getLatestEntry = (map?: Record<string, number>) => {
    if (!map) return null;
    if (map[todayKeyStr] !== undefined) return map[todayKeyStr];
    const keys = Object.keys(map).sort();
    if (keys.length === 0) return null;
    return map[keys[keys.length - 1]];
  };
  const currentWeight = getLatestEntry(weightLogs);
  const currentBodyFat = getLatestEntry(bodyFatLogs);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(Platform.OS === 'android' ? 104 : 96);

  // 6. Racha de Entrenamientos y Sistema Progresivo de Niveles & Puntos XP
  const xpBreakdown = React.useMemo(() => {
    return calculateUserXpAndLevel(
      logs,
      workoutLogs,
      sleepLogs,
      supplementLogs,
      measurementLogs,
      weightLogs,
      bodyFatLogs,
      photoLogs,
      healthLogs,
      ingredients
    );
  }, [
    logs,
    workoutLogs,
    sleepLogs,
    supplementLogs,
    measurementLogs,
    weightLogs,
    bodyFatLogs,
    photoLogs,
    healthLogs,
    ingredients,
  ]);

  const workoutStreak = React.useMemo(() => {
    return calculateWorkoutStreak(workoutLogs, todayKeyStr);
  }, [workoutLogs, todayKeyStr]);

  const [showXpModal, setShowXpModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const avatarZoomAnim = useRef(new Animated.Value(0)).current;

  // Metas del usuario desde el store
  const goals = useStore((s) => s.goals) || [];
  const addGoal = useStore((s) => s.addGoal);
  const updateGoal = useStore((s) => s.updateGoal);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const toggleGoalCompleted = useStore((s) => s.toggleGoalCompleted);

  const activeGoals = goals.filter((g) => !g.completed);
  const completedGoals = goals.filter((g) => g.completed);
  const userLevel = xpBreakdown.userLevel;

  // Animación de crecimiento suave para todos los datos métricos de Home
  const growthAnim = useRef(new Animated.Value(0)).current;
  const [growthProgress, setGrowthProgress] = useState(0);

  useEffect(() => {
    growthAnim.setValue(0);
    setGrowthProgress(0);

    const listenerId = growthAnim.addListener(({ value }) => {
      setGrowthProgress(value);
    });

    Animated.timing(growthAnim, {
      toValue: 1,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    return () => {
      growthAnim.removeListener(listenerId);
    };
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {/* ==========================================================
          ESTRUCTURA DE PERFIL SUPERIOR STICKY (PERMANECE FIJO AL SCROLL):
          - Perfil al lado izquierdo (Avatar + Racha horizontal debajo)
          - Nombre, Nickname, Rango, Barra XP
          - Al lado derecho: Botón de Ajustes
      ========================================================== */}
      <View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - stickyHeaderHeight) > 1) {
            setStickyHeaderHeight(h);
          }
        }}
        style={[
          styles.userHeroSticky,
          {
            backgroundColor: 'transparent',
            borderBottomColor: palette.isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)',
          },
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'android' ? 20 : 35}
          tint={palette.isDark ? 'dark' : 'light'}
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: getPaletteColorWithAlpha(palette.bg, 0.2),
            },
            Platform.OS === 'web' && ({ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any),
          ]}
        />
        <View style={styles.userHeroRow}>
          {/* Perfil al lado izquierdo: Avatar interactivo con zoom y badge de racha sobrepuesto en la esquina superior izquierda */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => {
              setShowAvatarModal(true);
              avatarZoomAnim.setValue(0);
              Animated.spring(avatarZoomAnim, {
                toValue: 1,
                tension: 80,
                friction: 7,
                useNativeDriver: true,
              }).start();
            }}
            style={styles.heroAvatarWrapper}
            accessibilityLabel="Ver y cambiar foto de perfil"
          >
            {userProfile?.avatarUri ? (
              <Image
                source={{ uri: userProfile.avatarUri }}
                style={styles.heroAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={[c1, c2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroAvatar}
              >
                <Text style={styles.heroAvatarText}>{initials}</Text>
              </LinearGradient>
            )}

            {/* Racha de entrenamientos como badge sobrepuesto en la esquina superior izquierda */}
            <View
              style={[
                styles.heroStreakBadgeOverlay,
                {
                  borderColor: workoutStreak.currentStreak > 0 ? c2 : palette.isDark ? '#475569' : '#CBD5E1',
                  backgroundColor: workoutStreak.currentStreak > 0
                    ? (palette.isDark ? '#0F172A' : '#FFFFFF')
                    : (palette.isDark ? '#1E293B' : '#F8FAFC'),
                },
              ]}
            >
              <Ionicons
                name="flame"
                size={11}
                color={workoutStreak.currentStreak > 0 ? c2 : palette.textSub}
              />
              <Text
                style={[
                  styles.heroStreakBadgeOverlayText,
                  {
                    color: workoutStreak.currentStreak > 0 ? c2 : palette.textSub,
                    fontFamily: dataFont,
                  },
                ]}
              >
                {Math.round(workoutStreak.currentStreak * growthProgress)}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Bloque Central de Datos */}
          <View style={styles.heroCenterCol}>
            {/* Nombre */}
            <Text
              style={[styles.heroName, { color: palette.text, fontFamily: titleFont }]}
              numberOfLines={1}
            >
              {userName}
            </Text>

            {/* Nickname - Fecha */}
            <Text
              style={[styles.heroNickDate, { color: palette.textSub, fontFamily: bodyFont }]}
              numberOfLines={1}
            >
              <Text style={{ color: c1, fontWeight: '700' }}>{userNick}</Text> - {dayStrClean}
            </Text>

            {/* Rango */}
            <View style={styles.heroRankRow}>
              <Ionicons name="sparkles" size={12} color={c1} />
              <Text
                style={[styles.heroRankText, { color: c1, fontFamily: subtitleFont }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Nivel {xpBreakdown.userLevel} · {xpBreakdown.rankTitle}
              </Text>
            </View>

            {/* Barra XP con icono interactivo "i" */}
            <View style={styles.heroXpRow}>
              <View
                style={[
                  styles.heroXpTrack,
                  {
                    backgroundColor: palette.isDark ? '#334155' : 'rgba(203, 213, 225, 0.4)',
                  },
                ]}
              >
                <LinearGradient
                  colors={[c1, c2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.heroXpFill, { width: `${xpBreakdown.levelProgressPercent}%` }]}
                />
              </View>
              <TouchableOpacity
                onPress={() => setShowXpModal(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.heroXpInfoBtn}
                accessibilityLabel="Ver sistema de puntos XP"
              >
                <Ionicons
                  name="information-circle"
                  size={15}
                  color={palette.isDark ? '#94A3B8' : '#64748B'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Al lado derecho: Menú Hamburguesa que despliega horizontalmente Sincronizar, Settings y Sign out */}
          <View style={styles.heroRightCol}>
            {/* Opciones desplegadas horizontalmente a la izquierda del hamburguesa */}
            <Animated.View
              style={[
                styles.heroActionsRow,
                {
                  opacity: menuAnim.interpolate({
                    inputRange: [0, 0.25, 1],
                    outputRange: [0, 0.5, 1],
                  }),
                  transform: [
                    {
                      translateX: menuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                    {
                      scale: menuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.75, 1],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents={menuOpen ? 'auto' : 'none'}
            >
              {/* 1. Sincronizar */}
              <Pressable
                style={({ pressed }) => [
                  styles.heroActionBtn,
                  {
                    borderColor:
                      syncStatus === 'error'
                        ? '#EF4444'
                        : syncStatus === 'syncing'
                        ? palette.primary
                        : `${c1}60`,
                    backgroundColor: palette.bg,
                  },
                  pressed && { transform: [{ scale: 0.92 }] },
                ]}
                onPress={() => {
                  closeMenu();
                  handleCloudIconPress();
                }}
                hitSlop={6}
              >
                <Ionicons
                  name={
                    syncStatus === 'error'
                      ? 'cloud-offline-outline'
                      : syncStatus === 'syncing'
                      ? 'cloud-upload-outline'
                      : 'cloud-done-outline'
                  }
                  size={15}
                  color={syncStatus === 'error' ? '#EF4444' : c1}
                />
              </Pressable>

              {/* 2. Settings */}
              <Pressable
                style={({ pressed }) => [
                  styles.heroActionBtn,
                  {
                    borderColor: palette.border,
                    backgroundColor: palette.bg,
                  },
                  pressed && { transform: [{ scale: 0.92 }] },
                ]}
                onPress={() => {
                  closeMenu();
                  setSettingsModalOpen(true);
                }}
                hitSlop={6}
              >
                <Ionicons name="options-outline" size={16} color={c1} />
              </Pressable>

              {/* 3. Sign out */}
              <Pressable
                style={({ pressed }) => [
                  styles.heroActionBtn,
                  {
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    backgroundColor: palette.isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.08)',
                  },
                  pressed && { transform: [{ scale: 0.92 }] },
                ]}
                onPress={handleLogout}
                hitSlop={6}
              >
                <Ionicons name="log-out-outline" size={15} color="#EF4444" />
              </Pressable>
            </Animated.View>

            {/* Botón tipo hamburguesa en la posición del antiguo botón de logout */}
            <Pressable
              style={({ pressed }) => [
                styles.heroHamburgerBtn,
                {
                  borderColor: menuOpen ? palette.primary : palette.border,
                  backgroundColor: menuOpen
                    ? (palette.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)')
                    : palette.bg,
                },
                pressed && { transform: [{ scale: 0.92 }] },
              ]}
              onPress={toggleMenu}
              hitSlop={8}
            >
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: menuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '90deg'],
                      }),
                    },
                  ],
                }}
              >
                <Ionicons
                  name={menuOpen ? 'close-outline' : 'menu-outline'}
                  size={18}
                  color={menuOpen ? palette.primary : palette.text}
                />
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: stickyHeaderHeight + 8 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ==========================================================
            WIDGET 1: NUTRICIÓN Y MACROS (COLORES ESTRICTOS DE LA PALETA)
        ========================================================== */}
        {homeWidgets?.calories && (
          <View style={[styles.cardOuter, { borderColor: palette.border }]}>
            <LinearGradient
              colors={
                palette.isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.cardGradient}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconBoxMini, { backgroundColor: `${palette.primary}18` }]}>
                    <Ionicons name="nutrition-outline" size={18} color={palette.primary} />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Nutrición Diaria
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Meta: {targetKcal} kcal
                    </Text>
                  </View>
                </View>

                {onNavigate && (
                  <Pressable
                    onPress={() => onNavigate('food')}
                    style={styles.linkActionBtn}
                  >
                    <Text style={[styles.linkActionText, { color: palette.primary, fontFamily: subtitleFont }]}>
                      Comida
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={palette.primary} />
                  </Pressable>
                )}
              </View>

              <View style={styles.macroHeroRow}>
                <View>
                  <Text style={[styles.macroHeroVal, { color: palette.text, fontFamily: dataFont }]}>
                    {fmt(totalKcal * growthProgress)}{' '}
                    <Text style={[styles.macroHeroUnit, { color: palette.textSub, fontFamily: bodyFont }]}>
                      kcal
                    </Text>
                  </Text>
                  <Text style={[styles.macroHeroSub, { color: palette.textSub, fontFamily: bodyFont }]}>
                    {Math.round(kcalPct * growthProgress)}% completado hoy
                  </Text>
                </View>

                {/* Desglose de Macros usando colores de la paleta */}
                <View style={styles.macroPillRow}>
                  <View style={[styles.macroPill, { backgroundColor: `${c3}15` }]}>
                    <Text style={[styles.macroPillLabel, { color: c3 }]}>P</Text>
                    <Text style={[styles.macroPillVal, { color: palette.text, fontFamily: dataFont }]}>
                      {fmt(totalProtein * growthProgress)}g
                    </Text>
                  </View>
                  <View style={[styles.macroPill, { backgroundColor: `${c2}15` }]}>
                    <Text style={[styles.macroPillLabel, { color: c2 }]}>C</Text>
                    <Text style={[styles.macroPillVal, { color: palette.text, fontFamily: dataFont }]}>
                      {fmt(totalCarbs * growthProgress)}g
                    </Text>
                  </View>
                  <View style={[styles.macroPill, { backgroundColor: `${c4}15` }]}>
                    <Text style={[styles.macroPillLabel, { color: c4 }]}>G</Text>
                    <Text style={[styles.macroPillVal, { color: palette.text, fontFamily: dataFont }]}>
                      {fmt(totalFat * growthProgress)}g
                    </Text>
                  </View>
                  {homeWidgets?.sugar && (
                    <View style={[styles.macroPill, { backgroundColor: `${c5 || c1}15` }]}>
                      <Text style={[styles.macroPillLabel, { color: c5 || c1 }]}>Az</Text>
                      <Text style={[styles.macroPillVal, { color: palette.text, fontFamily: dataFont }]}>
                        {fmt(totalSugar * growthProgress)}g
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ==========================================================
            WIDGET NUEVO: METAS & OBJETIVOS CON FECHAS LÍMITE
        ========================================================== */}
        {homeWidgets?.goals !== false && (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => setShowGoalsModal(true)}
            style={[styles.cardOuter, { borderColor: palette.border }]}
          >
            <LinearGradient
              colors={
                palette.isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.cardGradient}
            >
              {/* Encabezado del bloque Metas */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <LinearGradient
                    colors={[c1, c2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconBoxMiniGradient}
                  >
                    <Ionicons name="trophy" size={16} color="#FFFFFF" />
                  </LinearGradient>
                  <View>
                    <Text style={[styles.cardTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Metas & Objetivos
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      {activeGoals.length} {activeGoals.length === 1 ? 'meta activa' : 'metas activas'} · {completedGoals.length} cumplidas
                    </Text>
                  </View>
                </View>

                <View style={styles.linkActionBtn}>
                  <Text style={[styles.linkActionText, { color: c1, fontFamily: subtitleFont }]}>
                    Configurar
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={c1} />
                </View>
              </View>

              {/* Previsualización de Metas Activas */}
              {activeGoals.length > 0 ? (
                <View style={{ marginTop: 12, gap: 10 }}>
                  {activeGoals.slice(0, 2).map((goal) => {
                    const progress = calculateGoalProgress(goal);
                    const remaining = getGoalDaysRemaining(goal.targetDate);
                    return (
                      <View
                        key={goal.id}
                        style={[
                          styles.homeGoalMiniCard,
                          {
                            backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <View style={styles.homeGoalTopRow}>
                          <View
                            style={[
                              styles.homeGoalTag,
                              { backgroundColor: `${c1}18`, borderColor: `${c1}35` },
                            ]}
                          >
                            <Text style={[styles.homeGoalTagText, { color: c1 }]}>
                              {getGoalCategoryIcon(goal.type)} {goal.categoryLabel || getGoalCategoryLabel(goal.type)}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.homeGoalDatePill,
                              {
                                backgroundColor: remaining.isPast
                                  ? 'rgba(239, 68, 68, 0.12)'
                                  : remaining.days <= 14
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(16, 185, 129, 0.12)',
                              },
                            ]}
                          >
                            <Ionicons
                              name="calendar-outline"
                              size={11}
                              color={remaining.isPast ? '#EF4444' : remaining.days <= 14 ? '#F59E0B' : '#10B981'}
                            />
                            <Text
                              style={[
                                styles.homeGoalDateText,
                                {
                                  color: remaining.isPast ? '#EF4444' : remaining.days <= 14 ? '#F59E0B' : '#10B981',
                                  fontFamily: subtitleFont,
                                },
                              ]}
                            >
                              {formatGoalDate(goal.targetDate)} ({remaining.text})
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[styles.homeGoalTitle, { color: palette.text, fontFamily: subtitleFont }]}
                          numberOfLines={1}
                        >
                          {goal.title}
                        </Text>

                        {/* Barra y valores de progreso */}
                        <View style={styles.homeGoalProgressRow}>
                          <View style={styles.homeGoalValuesCol}>
                            <Text style={[styles.homeGoalValCurrent, { color: palette.text, fontFamily: dataFont }]}>
                              {goal.currentValue !== undefined ? goal.currentValue : '--'} {goal.unit || ''}
                            </Text>
                            <Text style={[styles.homeGoalValTarget, { color: palette.textSub, fontFamily: bodyFont }]}>
                              de {goal.targetValue !== undefined ? goal.targetValue : '--'} {goal.unit || ''}
                            </Text>
                          </View>

                          <View style={styles.homeGoalTrackWrap}>
                            <View
                              style={[
                                styles.homeGoalTrack,
                                {
                                  backgroundColor: palette.isDark ? '#334155' : 'rgba(203, 213, 225, 0.5)',
                                },
                              ]}
                            >
                              <LinearGradient
                                colors={[c1, c2]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.homeGoalFill, { width: `${progress}%` }]}
                              />
                            </View>
                            <Text style={[styles.homeGoalPercentText, { color: c1, fontFamily: dataFont }]}>
                              {progress}%
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  <View style={styles.homeGoalsFooterHint}>
                    <Text style={[styles.homeGoalsFooterText, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Toca para gestionar o configurar nuevas metas con fechas límite ➔
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.homeGoalsEmpty}>
                  <Text style={[styles.homeGoalsEmptyText, { color: palette.textSub, fontFamily: bodyFont }]}>
                    Define tus metas con fechas límite (ej. subir 10 kg para el 14 de febrero, romper tu PR o mejorar medidas) y mide tu progreso real.
                  </Text>
                  <View style={[styles.homeGoalsEmptyBtn, { backgroundColor: `${c1}15`, borderColor: c1 }]}>
                    <Ionicons name="add-circle-outline" size={16} color={c1} />
                    <Text style={[styles.homeGoalsEmptyBtnText, { color: c1, fontFamily: subtitleFont }]}>
                      Establecer Primera Meta
                    </Text>
                  </View>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

                {/* ==========================================================
            WIDGET 2: ENTRENAMIENTO DEL DÍA
        ========================================================== */}
        {homeWidgets?.workout && (
          <View style={[styles.cardOuter, { borderColor: palette.border }]}>
            <LinearGradient
              colors={
                palette.isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.cardGradient}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconBoxMini, { backgroundColor: `${c2}18` }]}>
                    <Ionicons name="barbell-outline" size={18} color={c2} />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Entrenamiento
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Rutina de hoy
                    </Text>
                  </View>
                </View>

                {onNavigate && (
                  <Pressable
                    onPress={() => onNavigate('train')}
                    style={styles.linkActionBtn}
                  >
                    <Text style={[styles.linkActionText, { color: c2, fontFamily: subtitleFont }]}>
                      Entreno
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={c2} />
                  </Pressable>
                )}
              </View>

              <View style={styles.statsTwoCol}>
                <View style={[styles.statBox, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.statBoxVal, { color: palette.text, fontFamily: dataFont }]}>
                    {Math.round(exercisesCount * growthProgress)}
                  </Text>
                  <Text style={[styles.statBoxLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                    Ejercicios registrados
                  </Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.statBoxVal, { color: c2, fontFamily: dataFont }]}>
                    {Math.round(setsCount * growthProgress)}
                  </Text>
                  <Text style={[styles.statBoxLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                    Series totales
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ==========================================================
            WIDGET 3: SUPLEMENTACIÓN DIARIA
        ========================================================== */}
        {homeWidgets?.supplements && (
          <View style={[styles.cardOuter, { borderColor: palette.border }]}>
            <LinearGradient
              colors={
                palette.isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.cardGradient}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconBoxMini, { backgroundColor: `${c3}18` }]}>
                    <Ionicons name="medkit-outline" size={18} color={c3} />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Suplementos
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      {Math.round(totalDosesTaken * growthProgress)} de {totalDosesTarget} dosis completadas
                    </Text>
                  </View>
                </View>

                {onNavigate && (
                  <Pressable
                    onPress={() => onNavigate('sleep')}
                    style={styles.linkActionBtn}
                  >
                    <Text style={[styles.linkActionText, { color: c3, fontFamily: subtitleFont }]}>
                      Bienestar
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={c3} />
                  </Pressable>
                )}
              </View>

              <View style={styles.suppListMini}>
                {activeSupps.slice(0, 3).map((supp) => {
                  const doses = supplementLogs[todayKeyStr]?.[supp.id] || [];
                  const taken = doses.filter(Boolean).length;
                  const isDone = taken >= supp.dailyTarget && supp.dailyTarget > 0;
                  return (
                    <View key={supp.id} style={styles.suppMiniItem}>
                      <Ionicons
                        name={isDone ? 'checkmark-circle' : 'time-outline'}
                        size={16}
                        color={isDone ? c3 : palette.textSub}
                      />
                      <Text
                        style={[
                          styles.suppMiniName,
                          { color: palette.text, fontFamily: bodyFont },
                          isDone && { textDecorationLine: 'line-through', opacity: 0.7 },
                        ]}
                        numberOfLines={1}
                      >
                        {supp.name}
                      </Text>
                      <Text style={[styles.suppMiniCount, { color: palette.textSub, fontFamily: dataFont }]}>
                        {Math.round(taken * growthProgress)}/{supp.dailyTarget}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ==========================================================
            WIDGET 4: BIOMARCADORES DE SALUD
        ========================================================== */}
        {homeWidgets?.health && (
          <View style={[styles.cardOuter, { borderColor: palette.border }]}>
            <LinearGradient
              colors={
                palette.isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.cardGradient}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconBoxMini, { backgroundColor: `${c4}18` }]}>
                    <Ionicons name="pulse-outline" size={18} color={c4} />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Biomarcadores de Salud
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Monitoreo clínico diario
                    </Text>
                  </View>
                </View>

                {onNavigate && (
                  <Pressable
                    onPress={() => onNavigate('sleep')}
                    style={styles.linkActionBtn}
                  >
                    <Text style={[styles.linkActionText, { color: c4, fontFamily: subtitleFont }]}>
                      Salud
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={c4} />
                  </Pressable>
                )}
              </View>

              <View style={styles.healthRowMini}>
                <View style={[styles.healthBox, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.healthLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                    Presión Arterial
                  </Text>
                  <Text style={[styles.healthVal, { color: palette.text, fontFamily: dataFont }]}>
                    {pressureVal
                      ? `${Math.round(parseFloat(String(pressureVal)) * growthProgress)}/${Math.round(parseFloat(String(pressureSec || 80)) * growthProgress)}`
                      : `${Math.round(119 * growthProgress)}/${Math.round(78 * growthProgress)}`}{' '}
                    <Text style={{ fontSize: 11, color: palette.textSub }}>mmHg</Text>
                  </Text>
                  <View style={[styles.healthPillMini, { backgroundColor: `${c4}18` }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: c4 }}>Óptima</Text>
                  </View>
                </View>

                <View style={[styles.healthBox, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.healthLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                    Glucosa / Azúcar
                  </Text>
                  <Text style={[styles.healthVal, { color: palette.text, fontFamily: dataFont }]}>
                    {Math.round(parseFloat(String(glucoseVal || '94')) * growthProgress)}{' '}
                    <Text style={{ fontSize: 11, color: palette.textSub }}>mg/dL</Text>
                  </Text>
                  <View style={[styles.healthPillMini, { backgroundColor: `${c3}18` }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: c3 }}>Normal</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ==========================================================
            WIDGET 5: PESO Y MEDIDAS
        ========================================================== */}
        {homeWidgets?.body && (
          <View style={[styles.cardOuter, { borderColor: palette.border }]}>
            <LinearGradient
              colors={
                palette.isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.cardGradient}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconBoxMini, { backgroundColor: `${c5}18` }]}>
                    <Ionicons name="body-outline" size={18} color={c5} />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Composición Corporal
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Último registro
                    </Text>
                  </View>
                </View>

                {onNavigate && (
                  <Pressable
                    onPress={() => onNavigate('measure')}
                    style={styles.linkActionBtn}
                  >
                    <Text style={[styles.linkActionText, { color: c5, fontFamily: subtitleFont }]}>
                      Medidas
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={c5} />
                  </Pressable>
                )}
              </View>

              <View style={styles.bodyCompGrid}>
                {/* Bloque Peso */}
                <View
                  style={[
                    styles.bodyCompBox,
                    {
                      backgroundColor: palette.isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(241, 245, 249, 0.7)',
                      borderColor: palette.isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.9)',
                    },
                  ]}
                >
                  <View style={styles.bodyCompBoxHeader}>
                    <View style={[styles.bodyCompIconCircle, { backgroundColor: `${c5}20` }]}>
                      <Ionicons name="scale-outline" size={13} color={c5} />
                    </View>
                    <Text style={[styles.bodyCompBoxLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Peso
                    </Text>
                  </View>
                  <Text style={[styles.bodyCompVal, { color: palette.text, fontFamily: dataFont }]}>
                    {fmt(parseFloat(String(currentWeight || 74.5)) * growthProgress)}{' '}
                    <Text style={[styles.bodyCompUnit, { color: palette.textSub, fontFamily: bodyFont }]}>
                      kg
                    </Text>
                  </Text>
                </View>

                {/* Bloque % Grasa */}
                <View
                  style={[
                    styles.bodyCompBox,
                    {
                      backgroundColor: palette.isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(241, 245, 249, 0.7)',
                      borderColor: palette.isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.9)',
                    },
                  ]}
                >
                  <View style={styles.bodyCompBoxHeader}>
                    <View style={[styles.bodyCompIconCircle, { backgroundColor: `${c5}20` }]}>
                      <Ionicons name="water-outline" size={13} color={c5} />
                    </View>
                    <Text style={[styles.bodyCompBoxLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      % Grasa
                    </Text>
                  </View>
                  <Text style={[styles.bodyCompVal, { color: palette.text, fontFamily: dataFont }]}>
                    {fmt(parseFloat(String(currentBodyFat || 14.8)) * growthProgress)}{' '}
                    <Text style={[styles.bodyCompUnit, { color: palette.textSub, fontFamily: bodyFont }]}>
                      %
                    </Text>
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ACCESO RÁPIDO PARA CONFIGURAR PANEL */}
        <Pressable
          style={[styles.configurePromptBtn, { borderColor: palette.border }]}
          onPress={() => setSettingsModalOpen(true)}
        >
          <Ionicons name="settings-outline" size={15} color={palette.textSub} />
          <Text style={[styles.configurePromptText, { color: palette.textSub, fontFamily: subtitleFont }]}>
            Personalizar temas, tipografías y datos del Home
          </Text>
        </Pressable>

        {/* BOTÓN CERRAR SESIÓN DIRECTO EN EL HOME */}
        <Pressable
          style={[
            styles.logoutHomeBtn,
            {
              borderColor: 'rgba(239, 68, 68, 0.35)',
              backgroundColor: palette.isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.06)',
            },
          ]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={16} color="#EF4444" />
          <Text style={[styles.logoutHomeText, { color: '#EF4444', fontFamily: subtitleFont }]}>
            Cerrar Sesión
          </Text>
        </Pressable>
      </ScrollView>

      {/* ==========================================================
          MODAL POPUP DE SETTINGS CON MENÚ DESPLEGABLE (ACCORDION):
          - Paleta de color
          - Tipografía
          - Qué datos mostrar en el home
          - Perfil de Usuario
      ========================================================== */}
      <SettingsModal
        visible={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      {/* Modal Popup Informativo: Sistema de Puntos & Niveles XP */}
      <XpInfoModal
        visible={showXpModal}
        xpBreakdown={xpBreakdown}
        palette={palette}
        onClose={() => setShowXpModal(false)}
      />

      {/* Modal Zoom y Cambio de Foto de Perfil */}
      <AvatarZoomModal
        visible={showAvatarModal}
        zoomAnim={avatarZoomAnim}
        userProfile={userProfile}
        initials={initials}
        userName={userName}
        userNick={userNick}
        userLevel={xpBreakdown.userLevel}
        rankTitle={xpBreakdown.rankTitle}
        c1={c1}
        c2={c2}
        palette={palette}
        titleFont={titleFont}
        subtitleFont={subtitleFont}
        bodyFont={bodyFont}
        onClose={() => setShowAvatarModal(false)}
        onUpdateAvatar={(uri) => setUserProfile({ avatarUri: uri })}
      />

      {/* Modal de Configuración y Gestión de Metas con Fechas Límite */}
      <GoalsModal
        visible={showGoalsModal}
        goals={goals}
        c1={c1}
        c2={c2}
        palette={palette}
        titleFont={titleFont}
        subtitleFont={subtitleFont}
        dataFont={dataFont}
        bodyFont={bodyFont}
        onClose={() => setShowGoalsModal(false)}
        onAddGoal={addGoal}
        onUpdateGoal={updateGoal}
        onDeleteGoal={deleteGoal}
        onToggleCompleted={toggleGoalCompleted}
      />
    </View>
  );
}

/* ==========================================================
   MODAL POPUP INFORMATIVO: SISTEMA DE PUNTOS Y NIVELES XP
========================================================== */
function XpInfoModal({
  visible,
  xpBreakdown,
  palette,
  onClose,
}: {
  visible: boolean;
  xpBreakdown: XpBreakdown;
  palette: ColorPalette;
  onClose: () => void;
}) {
  if (!visible) return null;

  const c1 = palette.primary;
  const c2 = palette.secondary;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <Pressable style={modalStyles.backdropTouchDismiss} onPress={onClose} />

        <View style={[modalStyles.sheetContainer, { backgroundColor: palette.cardBg }]}>
          <View style={[modalStyles.handleBar, { backgroundColor: palette.border }]} />

          <View style={modalStyles.modalHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[modalStyles.modalTitle, { color: palette.text }]}>
                SISTEMA DE PUNTOS & NIVELES XP
              </Text>
              <Text style={[modalStyles.modalSubtitle, { color: palette.textSub }]}>
                Aprende cómo ganar experiencia y evolucionar en el gimnasio
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={modalStyles.closeBtn}>
              <Ionicons name="close-circle" size={26} color={palette.textSub} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 36 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Tarjeta de Estado Actual del Usuario */}
            <LinearGradient
              colors={[palette.isDark ? '#1E293B' : '#F1F5F9', palette.isDark ? '#0F172A' : '#E2E8F0']}
              style={[xpStyles.heroCard, { borderColor: palette.border }]}
            >
              <View style={xpStyles.heroCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[xpStyles.heroLevelBadge, { color: c1 }]}>
                    NIVEL {xpBreakdown.userLevel}
                  </Text>
                  <Text style={[xpStyles.heroRankTitle, { color: palette.text }]}>
                    {xpBreakdown.rankTitle}
                  </Text>
                </View>
                <View style={[xpStyles.totalXpBadge, { backgroundColor: `${c1}18`, borderColor: c1 }]}>
                  <Ionicons name="sparkles" size={13} color={c1} />
                  <Text style={[xpStyles.totalXpBadgeText, { color: c1 }]}>
                    {xpBreakdown.totalXp.toLocaleString()} XP
                  </Text>
                </View>
              </View>

              {/* Barra de progreso hacia el siguiente nivel */}
              <View style={xpStyles.levelProgressWrap}>
                <View style={xpStyles.levelProgressTrack}>
                  <LinearGradient
                    colors={[c1, c2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[xpStyles.levelProgressFill, { width: `${xpBreakdown.levelProgressPercent}%` }]}
                  />
                </View>
                <View style={xpStyles.levelProgressLabels}>
                  <Text style={[xpStyles.progressSubText, { color: palette.textSub }]}>
                    {xpBreakdown.currentLevelXp} / {xpBreakdown.neededForNextLevel} XP para Nivel {xpBreakdown.userLevel + 1}
                  </Text>
                  <Text style={[xpStyles.progressSubPercent, { color: c1 }]}>
                    {xpBreakdown.levelProgressPercent}%
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Regla de Racha de Entrenamientos */}
            <View style={[xpStyles.streakRuleCard, { backgroundColor: `${c2}14`, borderColor: c2 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="flame" size={17} color={c2} />
                <Text style={[xpStyles.streakRuleTitle, { color: c2 }]}>
                  Racha de Entrenamientos
                </Text>
              </View>
              <Text style={[xpStyles.streakRuleDesc, { color: palette.text }]}>
                Muestra los días de entrenamiento que llevas acumulados. Se mantiene activa mientras entrenes con constancia; si pasan <Text style={{ fontWeight: '800', color: c2 }}>más de 5 días sin entrenar</Text>, la racha se corta y vuelve a 0.
              </Text>
            </View>

            {/* Título de Sección: Prioridad de Puntos */}
            <View style={xpStyles.sectionHeaderRow}>
              <Ionicons name="podium" size={18} color={c1} />
              <Text style={[xpStyles.sectionTitle, { color: palette.text }]}>
                Puntos Proporcionales por Cantidad
              </Text>
            </View>
            <Text style={[xpStyles.sectionDesc, { color: palette.textSub }]}>
              A mayor cantidad e intensidad de lo que registres, más puntos de XP ganas. No es lo mismo un día ligero que un día de alta exigencia calórica y de levantamiento.
            </Text>

            {/* 1. Comida & Nutrición */}
            <View style={[xpStyles.metricCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <View style={[xpStyles.metricIconWrap, { backgroundColor: `${c1}20` }]}>
                <Ionicons name="restaurant" size={20} color={c1} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={xpStyles.metricHeaderRow}>
                  <Text style={[xpStyles.metricTitle, { color: palette.text }]}>
                    1. Comida & Nutrición
                  </Text>
                  <View style={[xpStyles.priorityBadge, { backgroundColor: `${c1}20` }]}>
                    <Text style={[xpStyles.priorityBadgeText, { color: c1 }]}>Prioridad #1</Text>
                  </View>
                </View>
                <Text style={[xpStyles.metricPoints, { color: c1 }]}>
                  10 XP base + ~1 XP por cada 100 kcal
                </Text>
                <Text style={[xpStyles.metricExpl, { color: palette.textSub }]}>
                  Escala según la cantidad: comer 3,500 kcal otorga ~45-50 XP, mientras que 500 kcal otorga 15 XP. Además, un día alto en proteína (+90g) o con 3+ comidas completas suma +5 XP adicionales.
                </Text>
                <Text style={[xpStyles.metricUserStat, { color: palette.textSub }]}>
                  Has acumulado: <Text style={{ color: palette.text, fontWeight: '700' }}>{xpBreakdown.foodXp.toLocaleString()} XP</Text> ({xpBreakdown.foodDays} días)
                </Text>
              </View>
            </View>

            {/* 2. Entrenamiento & Fuerza */}
            <View style={[xpStyles.metricCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <View style={[xpStyles.metricIconWrap, { backgroundColor: `${c2}20` }]}>
                <Ionicons name="barbell" size={20} color={c2} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={xpStyles.metricHeaderRow}>
                  <Text style={[xpStyles.metricTitle, { color: palette.text }]}>
                    2. Entrenamiento & Gym
                  </Text>
                  <View style={[xpStyles.priorityBadge, { backgroundColor: `${c2}20` }]}>
                    <Text style={[xpStyles.priorityBadgeText, { color: c2 }]}>Prioridad #2</Text>
                  </View>
                </View>
                <Text style={[xpStyles.metricPoints, { color: c2 }]}>
                  15 XP base + 2 XP/serie + Tonelaje de Carga
                </Text>
                <Text style={[xpStyles.metricExpl, { color: palette.textSub }]}>
                  Si entrenas más y más fuerte, ganas más XP. El sistema premia el volumen de series y el tonelaje total levantado (kilos × reps), sumando hasta +30 XP extra por mover cargas pesadas.
                </Text>
                <Text style={[xpStyles.metricUserStat, { color: palette.textSub }]}>
                  Has acumulado: <Text style={{ color: palette.text, fontWeight: '700' }}>{xpBreakdown.workoutXp.toLocaleString()} XP</Text> ({xpBreakdown.workoutDays} entrenos)
                </Text>
              </View>
            </View>

            {/* 3. Sueño & Recuperación */}
            <View style={[xpStyles.metricCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <View style={[xpStyles.metricIconWrap, { backgroundColor: '#38BDF820' }]}>
                <Ionicons name="moon" size={20} color="#38BDF8" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={xpStyles.metricHeaderRow}>
                  <Text style={[xpStyles.metricTitle, { color: palette.text }]}>
                    3. Sueño & Descanso
                  </Text>
                  <View style={[xpStyles.priorityBadge, { backgroundColor: '#38BDF820' }]}>
                    <Text style={[xpStyles.priorityBadgeText, { color: '#38BDF8' }]}>Prioridad #3</Text>
                  </View>
                </View>
                <Text style={[xpStyles.metricPoints, { color: '#38BDF8' }]}>
                  8 XP base + 2 XP/hora + Calidad (Score)
                </Text>
                <Text style={[xpStyles.metricExpl, { color: palette.textSub }]}>
                  Dormir 8 horas con descanso profundo suma 30 XP, garantizando que tu cuerpo asimile el estímulo del entrenamiento y la alimentación.
                </Text>
                <Text style={[xpStyles.metricUserStat, { color: palette.textSub }]}>
                  Has acumulado: <Text style={{ color: palette.text, fontWeight: '700' }}>{xpBreakdown.sleepXp.toLocaleString()} XP</Text> ({xpBreakdown.sleepDays} noches)
                </Text>
              </View>
            </View>

            {/* 4. Suplementación */}
            <View style={[xpStyles.metricCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <View style={[xpStyles.metricIconWrap, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="medical" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={xpStyles.metricHeaderRow}>
                  <Text style={[xpStyles.metricTitle, { color: palette.text }]}>
                    4. Suplementación Diaria
                  </Text>
                  <View style={[xpStyles.priorityBadge, { backgroundColor: '#F59E0B20' }]}>
                    <Text style={[xpStyles.priorityBadgeText, { color: '#F59E0B' }]}>Prioridad #4</Text>
                  </View>
                </View>
                <Text style={[xpStyles.metricPoints, { color: '#F59E0B' }]}>
                  +4 XP por cada toma de suplemento
                </Text>
                <Text style={[xpStyles.metricExpl, { color: palette.textSub }]}>
                  Aumenta directamente por cantidad de suplementos tomados: 1 suplemento = +4 XP, 2 = +8 XP, 3 = +12 XP, 4 = +16 XP, etc.
                </Text>
                <Text style={[xpStyles.metricUserStat, { color: palette.textSub }]}>
                  Has acumulado: <Text style={{ color: palette.text, fontWeight: '700' }}>{xpBreakdown.supplementsXp.toLocaleString()} XP</Text> ({xpBreakdown.supplementDays} días)
                </Text>
              </View>
            </View>

            {/* 5. Medidas, Peso & Fotos */}
            <View style={[xpStyles.metricCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <View style={[xpStyles.metricIconWrap, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="body" size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={xpStyles.metricHeaderRow}>
                  <Text style={[xpStyles.metricTitle, { color: palette.text }]}>
                    5. Medidas Corporales & Peso
                  </Text>
                  <View style={[xpStyles.priorityBadge, { backgroundColor: '#10B98120' }]}>
                    <Text style={[xpStyles.priorityBadgeText, { color: '#10B981' }]}>Prioridad #5</Text>
                  </View>
                </View>
                <Text style={[xpStyles.metricPoints, { color: '#10B981' }]}>
                  5 XP base + 2 XP por músculo medido + 5 XP pesaje
                </Text>
                <Text style={[xpStyles.metricExpl, { color: palette.textSub }]}>
                  Recompensa el registro detallado en el croquis (pecho, cintura, brazos, muslos...) y el seguimiento fotográfico de tu recomposición.
                </Text>
                <Text style={[xpStyles.metricUserStat, { color: palette.textSub }]}>
                  Has acumulado: <Text style={{ color: palette.text, fontWeight: '700' }}>{xpBreakdown.measurementsXp.toLocaleString()} XP</Text>
                </Text>
              </View>
            </View>

            {/* 6. Biomarcadores de Salud */}
            <View style={[xpStyles.metricCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <View style={[xpStyles.metricIconWrap, { backgroundColor: '#EC489920' }]}>
                <Ionicons name="pulse" size={20} color="#EC4899" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={xpStyles.metricHeaderRow}>
                  <Text style={[xpStyles.metricTitle, { color: palette.text }]}>
                    6. Biomarcadores Clínicos
                  </Text>
                  <View style={[xpStyles.priorityBadge, { backgroundColor: '#EC489920' }]}>
                    <Text style={[xpStyles.priorityBadgeText, { color: '#EC4899' }]}>Salud</Text>
                  </View>
                </View>
                <Text style={[xpStyles.metricPoints, { color: '#EC4899' }]}>
                  +5 XP por cada indicador registrado
                </Text>
                <Text style={[xpStyles.metricExpl, { color: palette.textSub }]}>
                  Control de presión arterial, glucosa, perfil lipídico y triglicéridos.
                </Text>
                <Text style={[xpStyles.metricUserStat, { color: palette.textSub }]}>
                  Has acumulado: <Text style={{ color: palette.text, fontWeight: '700' }}>{xpBreakdown.healthXp.toLocaleString()} XP</Text> ({xpBreakdown.healthDays} chequeos)
                </Text>
              </View>
            </View>

            {/* Escalafón de Rangos */}
            <View style={[xpStyles.ranksCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <Text style={[xpStyles.ranksCardTitle, { color: palette.text }]}>
                Escalafón de Rangos & Títulos
              </Text>
              {[
                { range: 'Niveles 1 - 4', title: 'Iniciado Fitness', icon: 'shield-outline', color: '#94A3B8' },
                { range: 'Niveles 5 - 9', title: 'Atleta Dedicado', icon: 'ribbon-outline', color: '#38BDF8' },
                { range: 'Niveles 10 - 19', title: 'Guerrero del Gym', icon: 'flame-outline', color: '#F59E0B' },
                { range: 'Niveles 20 - 29', title: 'Atleta Avanzado', icon: 'flash-outline', color: '#10B981' },
                { range: 'Niveles 30 - 39', title: 'Atleta Élite', icon: 'trophy-outline', color: c1 },
                { range: 'Niveles 40 - 49', title: 'Titán del Hierro', icon: 'diamond-outline', color: '#EC4899' },
                { range: 'Niveles 50 - 59', title: 'Maestro del Olimpo', icon: 'medal-outline', color: '#8B5CF6' },
                { range: 'Niveles 60 - 69', title: 'Coloso Indomable', icon: 'shield-checkmark-outline', color: '#06B6D4' },
                { range: 'Niveles 70 - 79', title: 'Semidiós del Fitness', icon: 'planet-outline', color: '#F43F5E' },
                { range: 'Niveles 80 - 89', title: 'Inmortal de Acero', icon: 'skull-outline', color: '#6366F1' },
                { range: 'Niveles 90 - 99', title: 'Deidad del Hierro', icon: 'sparkles', color: '#E11D48' },
                { range: 'Nivel 100+', title: 'Leyenda Evolve', icon: 'star', color: '#EAB308' },
              ].map((r, i) => {
                const isCurrent = xpBreakdown.rankTitle === r.title;
                return (
                  <View
                    key={i}
                    style={[
                      xpStyles.rankRow,
                      isCurrent && {
                        backgroundColor: `${c1}15`,
                        borderRadius: 10,
                        paddingHorizontal: 8,
                        marginHorizontal: -8,
                      },
                    ]}
                  >
                    <Ionicons name={r.icon as any} size={16} color={isCurrent ? c1 : r.color} />
                    <Text style={[xpStyles.rankTitleText, { color: isCurrent ? c1 : palette.text, fontWeight: isCurrent ? '800' : '600' }]}>
                      {r.title}
                    </Text>
                    <Text style={[xpStyles.rankRangeText, { color: isCurrent ? c1 : palette.textSub }]}>
                      {r.range}
                    </Text>
                    {isCurrent && (
                      <View style={[xpStyles.activePill, { backgroundColor: c1 }]}>
                        <Text style={xpStyles.activePillText}>Actual</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Botón de cierre */}
            <Pressable
              style={[xpStyles.gotItBtn, { backgroundColor: c1 }]}
              onPress={onClose}
            >
              <Text style={xpStyles.gotItBtnText}>¡Entendido, a seguir entrenando!</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const xpStyles = StyleSheet.create({
  streakRuleCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  streakRuleTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  streakRuleDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  heroCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  heroCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroLevelBadge: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroRankTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  totalXpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  totalXpBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  levelProgressWrap: {
    marginTop: 4,
  },
  levelProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  levelProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressSubText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  progressSubPercent: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  metricCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  priorityBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  metricPoints: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  metricExpl: {
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 3,
  },
  metricUserStat: {
    fontSize: 11,
    marginTop: 5,
    fontStyle: 'italic',
  },
  ranksCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
    marginBottom: 18,
  },
  ranksCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  rankTitleText: {
    flex: 1,
    fontSize: 12.5,
  },
  rankRangeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginLeft: 4,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  gotItBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  gotItBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

/* ==========================================================
   MODAL PARA SELECCIONAR COLOR PERSONALIZADO
========================================================== */
function ColorPickerModal({
  visible,
  initialColor,
  title = 'Selector de Color',
  onClose,
  onSelectColor,
  palette,
}: {
  visible: boolean;
  initialColor: string;
  title?: string;
  onClose: () => void;
  onSelectColor: (color: string) => void;
  palette: ColorPalette;
}) {
  const [selectedColor, setSelectedColor] = useState(initialColor || '#8B5CF6');
  const [hexInput, setHexInput] = useState(initialColor ? initialColor.replace('#', '') : '8B5CF6');

  useEffect(() => {
    if (initialColor) {
      setSelectedColor(initialColor);
      setHexInput(initialColor.replace('#', ''));
    }
  }, [initialColor]);

  if (!visible) return null;

  const handleHexChange = (text: string) => {
    const cleaned = text.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
    setHexInput(cleaned);
    if (cleaned.length === 6) {
      setSelectedColor(`#${cleaned}`);
    }
  };

  const handlePickPreset = (col: string) => {
    setSelectedColor(col);
    setHexInput(col.replace('#', ''));
  };

  const handleApply = () => {
    let finalCol = hexInput.trim();
    if (finalCol.length === 6) {
      finalCol = `#${finalCol}`;
    } else if (selectedColor) {
      finalCol = selectedColor.startsWith('#') ? selectedColor : `#${selectedColor}`;
    } else {
      finalCol = '#8B5CF6';
    }
    onSelectColor(finalCol);
    onClose();
  };

  const PALETTE_TONES = [
    ['#8B5CF6', '#EC4899', '#F43F5E', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6'],
    ['#C4B5FD', '#FBCFE8', '#FECDD3', '#FFEDD5', '#FEF08A', '#A7F3D0', '#BAE6FD', '#BFDBFE'],
    ['#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#D97706', '#059669', '#0891B2', '#2563EB'],
    ['#4C1D95', '#831843', '#881337', '#7C2D12', '#78350F', '#064E3B', '#164E63', '#1E3A8A'],
    ['#0F172A', '#1E293B', '#334155', '#475569', '#64748B', '#94A3B8', '#CBD5E1', '#FFFFFF'],
  ];

  return (
    <View style={pickerStyles.overlayBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[pickerStyles.container, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
        {/* Header */}
        <View style={pickerStyles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[pickerStyles.title, { color: palette.text }]}>{title.toUpperCase()}</Text>
            <Text style={[pickerStyles.subtitle, { color: palette.textSub }]}>
              Selecciona una muestra o introduce un código hexadecimal
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={palette.textSub} />
          </Pressable>
        </View>

        {/* Visual Preview */}
        <View style={[pickerStyles.previewCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
          <View style={[pickerStyles.previewCircle, { backgroundColor: selectedColor }]}>
            <Ionicons name="color-filter" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[pickerStyles.previewLabel, { color: palette.textSub }]}>COLOR SELECCIONADO</Text>
            <Text style={[pickerStyles.previewHex, { color: palette.text }]}>#{hexInput.toUpperCase()}</Text>
          </View>
          {/* Opacity preview chips */}
          <View style={pickerStyles.opacityChips}>
            <View style={[pickerStyles.opacityChip, { backgroundColor: selectedColor }]} />
            <View style={[pickerStyles.opacityChip, { backgroundColor: getPaletteColorWithAlpha(selectedColor, 0.6) }]} />
            <View style={[pickerStyles.opacityChip, { backgroundColor: getPaletteColorWithAlpha(selectedColor, 0.25) }]} />
          </View>
        </View>

        {/* Hex Input Row */}
        <View style={pickerStyles.hexRow}>
          <View style={[pickerStyles.hexPrefix, { backgroundColor: `${palette.primary}18` }]}>
            <Text style={[pickerStyles.hexPrefixText, { color: palette.primary }]}>#</Text>
          </View>
          <TextInput
            style={[
              pickerStyles.hexInput,
              { backgroundColor: palette.bg, color: palette.text, borderColor: palette.border },
            ]}
            value={hexInput}
            onChangeText={handleHexChange}
            placeholder="8B5CF6"
            placeholderTextColor={palette.textSub}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        {/* Swatches Grid */}
        <Text style={[pickerStyles.sectionLabel, { color: palette.textSub }]}>PALETA DE TONOS RÁPIDOS</Text>
        <ScrollView style={pickerStyles.tonesScroll} showsVerticalScrollIndicator={false}>
          {PALETTE_TONES.map((row, rIdx) => (
            <View key={rIdx} style={pickerStyles.tonesRow}>
              {row.map((col) => {
                const isActive = selectedColor.toLowerCase() === col.toLowerCase();
                return (
                  <Pressable
                    key={col}
                    style={[
                      pickerStyles.toneCircle,
                      { backgroundColor: col },
                      isActive && [pickerStyles.toneCircleActive, { borderColor: palette.text }],
                    ]}
                    onPress={() => handlePickPreset(col)}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Actions */}
        <View style={pickerStyles.actionRow}>
          <Pressable style={[pickerStyles.cancelBtn, { borderColor: palette.border }]} onPress={onClose}>
            <Text style={[pickerStyles.cancelBtnText, { color: palette.textSub }]}>Cancelar</Text>
          </Pressable>
          <Pressable style={[pickerStyles.applyBtn, { backgroundColor: palette.primary }]} onPress={handleApply}>
            <Text style={pickerStyles.applyBtnText}>Aplicar Color</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ==========================================================
   MODAL PARA RENOMBRAR PALETA
========================================================== */
function RenamePaletteModal({
  visible,
  initialName,
  onClose,
  onSave,
  palette,
}: {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (newName: string) => void;
  palette: ColorPalette;
}) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  if (!visible) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    onClose();
  };

  return (
    <View style={renameStyles.overlayBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[renameStyles.container, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
        <View style={renameStyles.header}>
          <Ionicons name="pencil" size={17} color={palette.primary} />
          <Text style={[renameStyles.title, { color: palette.text }]}>CAMBIAR NOMBRE DE PALETA</Text>
        </View>
        <Text style={[renameStyles.subtitle, { color: palette.textSub }]}>
          Escribe el nuevo nombre para identificar esta combinación de colores
        </Text>

        <TextInput
          style={[
            renameStyles.input,
            { backgroundColor: palette.bg, color: palette.text, borderColor: palette.border },
          ]}
          value={name}
          onChangeText={setName}
          placeholder="Nombre de la paleta..."
          placeholderTextColor={palette.textSub}
          autoFocus
          maxLength={35}
        />

        <View style={renameStyles.actionRow}>
          <Pressable style={[renameStyles.cancelBtn, { borderColor: palette.border }]} onPress={onClose}>
            <Text style={[renameStyles.cancelBtnText, { color: palette.textSub }]}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[
              renameStyles.saveBtn,
              { backgroundColor: palette.primary },
              !name.trim() && { opacity: 0.5 },
            ]}
            onPress={handleSave}
            disabled={!name.trim()}
          >
            <Text style={renameStyles.saveBtnText}>Guardar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ==========================================================
   COMPONENTE MODAL DE SETTINGS CON MENÚ DESPLEGABLE DIRECTO
========================================================== */
function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    userProfile,
    setUserProfile,
    activePaletteId,
    customPalettes,
    typography,
    homeWidgets,
    setActivePalette,
    addCustomPalette,
    updatePalette,
    deleteCustomPalette,
    deletePalette,
    deletedPaletteIds,
    setTypography,
    toggleHomeWidget,
    authUser,
    logout,
    syncStatus,
    lastSyncedAt,
    syncError,
  } = useStore();

  const [syncLoading, setSyncLoading] = useState(false);

  const handleSyncNow = async () => {
    setSyncLoading(true);
    const res = await pushUserDataToDatabase();
    setSyncLoading(false);
    if (res.success) {
      Alert.alert(
        'Base de Datos Sincronizada',
        'Todos tus entrenamientos, comidas, suplementos, fotos, medidas y ajustes se han respaldado en la base de datos.',
      );
    } else {
      Alert.alert('Error al sincronizar', res.error || 'No se pudo conectar con el servidor.');
    }
  };

  const handlePullNow = async () => {
    setSyncLoading(true);
    const res = await pullUserDataFromDatabase();
    setSyncLoading(false);
    if (res.success) {
      Alert.alert(
        'Datos Restaurados',
        `Se sincronizaron con éxito los registros almacenados en la base de datos (${res.count} categorías de datos).`,
      );
    } else {
      Alert.alert('Error al descargar', res.error || 'No se pudo conectar con el servidor.');
    }
  };

  const palette = getActivePalette({ activePaletteId, customPalettes, deletedPaletteIds });

  // Control de secciones desplegadas (por defecto 'palette' está abierta)
  const [expandedSection, setExpandedSection] = useState<'palette' | 'typography' | 'widgets' | 'profile' | 'account' | null>('palette');

  const toggleSection = (sec: 'palette' | 'typography' | 'widgets' | 'profile' | 'account') => {
    setExpandedSection(expandedSection === sec ? null : sec);
  };

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar tu sesión en este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: () => {
          onClose();
          logout();
        },
      },
    ]);
  };

  // Creador de paleta nueva (mínimo 2 colores, hasta 5 colores, 2 por defecto)
  const [isCreatingPalette, setIsCreatingPalette] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newColors, setNewColors] = useState<string[]>(['#8B5CF6', '#F472B6']); // 2 por defecto
  const [newIsDark, setNewIsDark] = useState(false);

  // Estados interactivos para selector de color y renombre
  const [editingPaletteColor, setEditingPaletteColor] = useState<{
    paletteId: string;
    colorIndex: number;
    currentColor: string;
  } | null>(null);

  const [editingPaletteName, setEditingPaletteName] = useState<{
    paletteId: string;
    currentName: string;
  } | null>(null);

  const [pickingCustomColorSlot, setPickingCustomColorSlot] = useState<number | null>(null);

  const handleAddColorSlot = () => {
    if (newColors.length >= 5) return;
    const fallbackList = ['#10B981', '#06B6D4', '#F59E0B', '#F43F5E', '#A855F7', '#3B82F6'];
    const nextColor = fallbackList.find((c) => !newColors.includes(c)) || '#10B981';
    setNewColors([...newColors, nextColor]);
  };

  const handleRemoveColorSlot = (index: number) => {
    if (newColors.length <= 2) return; // Mínimo 2 colores
    setNewColors(newColors.filter((_, i) => i !== index));
  };

  const handleUpdateColorSlot = (index: number, color: string) => {
    const updated = [...newColors];
    updated[index] = color;
    setNewColors(updated);
  };

  const handleColorSelectedForPalette = (newColor: string) => {
    if (!editingPaletteColor) return;
    const { paletteId, colorIndex } = editingPaletteColor;
    const target = allPalettes.find((item) => item.id === paletteId);
    if (!target) return;
    const currentColors =
      target.colors && target.colors.length >= 2
        ? [...target.colors]
        : [target.primary, target.secondary];
    const updatedColors = [...currentColors];
    updatedColors[colorIndex] = newColor;
    updatePalette(paletteId, {
      colors: updatedColors,
      primary: updatedColors[0],
      secondary: updatedColors[1],
    });
    setEditingPaletteColor(null);
  };

  const handleSavePaletteName = (newName: string) => {
    if (!editingPaletteName || !newName.trim()) return;
    updatePalette(editingPaletteName.paletteId, { name: newName.trim() });
    setEditingPaletteName(null);
  };

  // Perfil
  const [editName, setEditName] = useState(userProfile?.name || 'Sergio Tamayo');
  const [editNick, setEditNick] = useState(userProfile?.nickname || 'Sertic77');
  const [editHeight, setEditHeight] = useState(userProfile?.height ? String(userProfile.height) : '178');
  const [editGender, setEditGender] = useState<GenderOption>(userProfile?.gender || 'Masculino');

  const handleSaveCustomPalette = () => {
    if (!newPaletteName.trim() || newColors.length < 2) return;
    const finalColors = newColors.slice(0, 5);
    const prim = finalColors[0];
    const sec = finalColors[1];
    addCustomPalette({
      name: newPaletteName.trim(),
      colors: finalColors,
      primary: prim,
      secondary: sec,
      isDark: newIsDark,
      bg: newIsDark ? '#0F172A' : '#F8FAFC',
      cardBg: newIsDark ? '#1E293B' : '#FFFFFF',
      text: newIsDark ? '#F8FAFC' : '#0F172A',
      textSub: newIsDark ? '#94A3B8' : '#64748B',
      border: newIsDark ? '#334155' : '#CBD5E1',
      accent: prim,
    });
    setNewPaletteName('');
    setNewColors(['#8B5CF6', '#F472B6']);
    setIsCreatingPalette(false);
  };

  const handleSaveProfile = () => {
    setUserProfile({
      name: editName.trim(),
      nickname: editNick.trim().replace('@', ''),
      height: editHeight.trim() ? parseFloat(editHeight) || undefined : undefined,
      gender: editGender,
    });
  };

  const allPalettes: ColorPalette[] = [
    ...PRESET_PALETTES.map((p) => {
      const overridden = customPalettes?.find((cp) => cp.id === p.id);
      return overridden || p;
    }),
    ...(customPalettes || []).filter((cp) => !PRESET_PALETTES.some((p) => p.id === cp.id)),
  ].filter((p) => !(deletedPaletteIds || []).includes(p.id));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        {/* Área superior transparente para descartar al pulsar */}
        <Pressable style={modalStyles.backdropTouchDismiss} onPress={onClose} />

        <View style={[modalStyles.sheetContainer, { backgroundColor: palette.cardBg }]}>
          {/* Barra de agarre superior */}
          <View style={[modalStyles.handleBar, { backgroundColor: palette.border }]} />

          {/* Header del Modal */}
          <View style={modalStyles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[modalStyles.modalTitle, { color: palette.text }]}>
                AJUSTES Y PERSONALIZACIÓN
              </Text>
              <Text style={[modalStyles.modalSubtitle, { color: palette.textSub }]}>
                Toca cada sección para desplegar sus opciones
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={modalStyles.closeBtn}>
              <Ionicons name="close-circle" size={26} color={palette.textSub} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ==========================================================
                OPCIÓN 1: PALETA DE COLOR (DESPLEGABLE)
            ========================================================== */}
            <View style={[modalStyles.accordionCard, { borderColor: palette.border }]}>
              <Pressable
                style={[
                  modalStyles.accordionHeader,
                  expandedSection === 'palette' && {
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  },
                ]}
                onPress={() => toggleSection('palette')}
              >
                <View style={[modalStyles.accordionIconBox, { backgroundColor: `${palette.primary}18` }]}>
                  <Ionicons name="color-palette-outline" size={20} color={palette.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[modalStyles.accordionTitle, { color: palette.text }]}>
                    Paleta de Color
                  </Text>
                  <Text style={[modalStyles.accordionDesc, { color: palette.textSub }]}>
                    Default, Modo Nocturno, Atardecer, etc. ({allPalettes.length} temas)
                  </Text>
                </View>
                <Ionicons
                  name={expandedSection === 'palette' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.primary}
                />
              </Pressable>

              {expandedSection === 'palette' && (
                <View style={modalStyles.accordionContent}>
                  <Text style={[modalStyles.contentSubNotice, { color: palette.textSub }]}>
                    Elige una paleta con muestras de colores o crea tu propia combinación:
                  </Text>

                  {/* Grid / Lista de Paletas */}
                  <View style={modalStyles.paletteGrid}>
                    {allPalettes.map((p) => {
                      const isSelected = p.id === activePaletteId;
                      const sampleColors = p.colors && p.colors.length >= 2 ? p.colors : [p.primary, p.secondary];
                      return (
                        <Pressable
                          key={p.id}
                          style={[
                            modalStyles.paletteCard,
                            {
                              backgroundColor: p.cardBg,
                              borderColor: isSelected ? palette.primary : palette.border,
                              borderWidth: isSelected ? 2.5 : 1,
                            },
                          ]}
                          onPress={() => setActivePalette(p.id)}
                        >
                          <View style={modalStyles.paletteCardContentRow}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <View style={modalStyles.paletteCardTop}>
                                <Text
                                  style={[
                                    modalStyles.paletteCardName,
                                    { color: p.text },
                                    isSelected && { fontWeight: '900' },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {p.name}
                                </Text>
                              </View>

                              {/* Muestras de colores */}
                              <View style={modalStyles.swatchesRow}>
                                {sampleColors.map((col, idx) => (
                                  <Pressable
                                    key={idx}
                                    style={[
                                      modalStyles.swatchCircle,
                                      {
                                        backgroundColor: col,
                                        borderColor: '#FFFFFF',
                                        marginLeft: idx > 0 ? -6 : 0,
                                      },
                                    ]}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      setEditingPaletteColor({
                                        paletteId: p.id,
                                        colorIndex: idx,
                                        currentColor: col,
                                      });
                                    }}
                                    hitSlop={6}
                                  />
                                ))}

                                {/* Badge de cantidad de colores */}
                                <View
                                  style={[
                                    modalStyles.paletteColorsBadge,
                                    {
                                      backgroundColor: `${p.primary}18`,
                                      borderColor: `${p.primary}35`,
                                    },
                                  ]}
                                >
                                  <Text style={[modalStyles.paletteColorsBadgeText, { color: p.primary }]}>
                                    {sampleColors.length === 2 ? '2 colores' : `${sampleColors.length} colores`}
                                  </Text>
                                </View>

                                {p.isDark && (
                                  <View style={modalStyles.darkTagMini}>
                                    <Ionicons name="moon" size={11} color={palette.textSub} />
                                    <Text style={[modalStyles.darkTagText, { color: palette.textSub }]}>Dark</Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            {/* Acciones de Editar y Borrar alineadas verticalmente */}
                            <View style={modalStyles.paletteVerticalActions}>
                              <Pressable
                                style={({ pressed }) => [
                                  modalStyles.paletteActionIconBtn,
                                  { backgroundColor: palette.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
                                  pressed && { opacity: 0.7 },
                                ]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setEditingPaletteName({
                                    paletteId: p.id,
                                    currentName: p.name,
                                  });
                                }}
                                hitSlop={6}
                              >
                                <Ionicons name="pencil-outline" size={13} color={palette.textSub} />
                              </Pressable>

                              <Pressable
                                style={({ pressed }) => [
                                  modalStyles.paletteActionIconBtn,
                                  { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
                                  pressed && { opacity: 0.7 },
                                ]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  deletePalette(p.id);
                                }}
                                hitSlop={6}
                              >
                                <Ionicons name="trash-outline" size={13} color="#EF4444" />
                              </Pressable>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Formulario de Crear Nueva Paleta */}
                  {!isCreatingPalette ? (
                    <Pressable
                      style={[modalStyles.createPaletteToggleBtn, { borderColor: palette.primary }]}
                      onPress={() => setIsCreatingPalette(true)}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
                      <Text style={[modalStyles.createPaletteToggleText, { color: palette.primary }]}>
                        Crear Nueva Paleta Personalizada (hasta 5 colores)
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={[modalStyles.customPaletteForm, { backgroundColor: palette.cardBg, borderWidth: 0 }]}>
                      <View style={modalStyles.customFormHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[modalStyles.customFormTitle, { color: palette.text }]}>
                            CREAR COMBINACIÓN DE COLORES
                          </Text>
                          <Text style={[modalStyles.customFormSubtitle, { color: palette.textSub }]}>
                            {newColors.length} de 5 colores configurados (mínimo 2, por defecto 2)
                          </Text>
                        </View>
                        <Pressable onPress={() => setIsCreatingPalette(false)}>
                          <Ionicons name="close" size={20} color={palette.textSub} />
                        </Pressable>
                      </View>

                      {/* Explicación de las opacidades */}
                      <View style={[modalStyles.paletteOpacityNotice, { backgroundColor: `${palette.primary}12`, borderColor: `${palette.primary}30` }]}>
                        <Ionicons name="color-filter-outline" size={16} color={palette.primary} />
                        <Text style={[modalStyles.paletteOpacityNoticeText, { color: palette.text }]}>
                          {newColors.length === 2
                            ? 'Con 2 colores, el tema genera automáticamente variaciones de opacidad (15%, 35%, 65%, 85%) para mantener la estética pulida y armónica en toda la app.'
                            : `Con ${newColors.length} colores, cada color se asigna a botones, gráficos, métricas y acentos, complementándose con opacidades.`}
                        </Text>
                      </View>

                      <Text style={[modalStyles.formLabel, { color: palette.textSub, marginTop: 10 }]}>
                        Nombre de la paleta
                      </Text>
                      <TextInput
                        style={[
                          modalStyles.formInput,
                          {
                            backgroundColor: palette.bg,
                            color: palette.text,
                            borderColor: palette.border,
                          },
                        ]}
                        placeholder="Ej. Fuego Dragón, Neón Azul..."
                        placeholderTextColor={palette.textSub}
                        value={newPaletteName}
                        onChangeText={setNewPaletteName}
                      />

                      {/* Lista dinámica de colores (2 a 5 colores) */}
                      {newColors.map((color, index) => {
                        const colorRole =
                          index === 0
                            ? 'Color 1 · Primario (Acentos y Títulos)'
                            : index === 1
                            ? 'Color 2 · Secundario (Botones y Llamas)'
                            : index === 2
                            ? 'Color 3 · Terciario (Métricas y Gráficos)'
                            : index === 3
                            ? 'Color 4 · Cuaternario (Destacados y Tarjetas)'
                            : 'Color 5 · Quinto Color (Detalles y Badges)';

                        return (
                          <View key={index} style={[modalStyles.colorSlotCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                            <View style={modalStyles.colorSlotHeader}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                <View style={[modalStyles.colorSlotNumberBadge, { backgroundColor: color }]}>
                                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>{index + 1}</Text>
                                </View>
                                <Text style={[modalStyles.colorSlotRoleText, { color: palette.text }]}>
                                  {colorRole}
                                </Text>
                              </View>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {/* Muestra de opacidades en tiempo real */}
                                <View style={modalStyles.opacityMiniStrip}>
                                  <View style={[modalStyles.opacityMiniBlock, { backgroundColor: color }]} />
                                  <View style={[modalStyles.opacityMiniBlock, { backgroundColor: getPaletteColorWithAlpha(color, 0.5) }]} />
                                  <View style={[modalStyles.opacityMiniBlock, { backgroundColor: getPaletteColorWithAlpha(color, 0.2) }]} />
                                </View>

                                {/* Botón borrar para colores 3, 4, 5 */}
                                {index >= 2 && (
                                  <Pressable
                                    onPress={() => handleRemoveColorSlot(index)}
                                    hitSlop={8}
                                    style={modalStyles.removeColorBtn}
                                  >
                                    <Ionicons name="trash-outline" size={15} color={palette.secondary} />
                                  </Pressable>
                                )}
                              </View>
                            </View>

                            {/* Selector de muestras para este slot */}
                            <View style={modalStyles.swatchesPickRow}>
                              {COLOR_SWATCHES.map((swatchColor) => (
                                <Pressable
                                  key={swatchColor}
                                  style={[
                                    modalStyles.pickCircle,
                                    { backgroundColor: swatchColor },
                                    color === swatchColor && [modalStyles.pickCircleActive, { borderColor: palette.text }],
                                  ]}
                                  onPress={() => handleUpdateColorSlot(index, swatchColor)}
                                />
                              ))}

                              {/* Opción al final para abrir el selector de color personalizado */}
                              <Pressable
                                style={[
                                  modalStyles.pickCircle,
                                  modalStyles.customPickerBtn,
                                  {
                                    borderColor: palette.primary,
                                    backgroundColor: `${palette.primary}18`,
                                  },
                                  !COLOR_SWATCHES.includes(color) && [
                                    modalStyles.pickCircleActive,
                                    { borderColor: palette.text, backgroundColor: color },
                                  ],
                                ]}
                                onPress={() => setPickingCustomColorSlot(index)}
                                hitSlop={4}
                              >
                                <Ionicons
                                  name="color-palette-outline"
                                  size={16}
                                  color={!COLOR_SWATCHES.includes(color) ? '#FFFFFF' : palette.primary}
                                />
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}

                      {/* Botón para añadir hasta 5 colores */}
                      {newColors.length < 5 && (
                        <Pressable
                          style={({ pressed }) => [
                            modalStyles.addColorSlotBtn,
                            { borderColor: palette.primary, backgroundColor: `${palette.primary}10` },
                            pressed && { transform: [{ scale: 0.98 }] },
                          ]}
                          onPress={handleAddColorSlot}
                        >
                          <Ionicons name="add-circle" size={17} color={palette.primary} />
                          <Text style={[modalStyles.addColorSlotBtnText, { color: palette.primary }]}>
                            + Añadir Color {newColors.length + 1} (hasta 5 colores)
                          </Text>
                        </Pressable>
                      )}

                      <View style={modalStyles.themeSwitchRow}>
                        <Text style={[modalStyles.formLabel, { color: palette.textSub, marginBottom: 0 }]}>
                          Modo Nocturno / Fondo Oscuro
                        </Text>
                        <Switch
                          value={newIsDark}
                          onValueChange={setNewIsDark}
                          trackColor={{ false: palette.border, true: palette.primary }}
                          thumbColor="#FFFFFF"
                        />
                      </View>

                      <Pressable
                        style={[
                          modalStyles.savePaletteBtn,
                          { backgroundColor: palette.primary },
                          !newPaletteName.trim() && { opacity: 0.5 },
                        ]}
                        onPress={handleSaveCustomPalette}
                        disabled={!newPaletteName.trim()}
                      >
                        <Text style={modalStyles.savePaletteBtnText}>
                          Guardar y Activar Paleta ({newColors.length} colores)
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ==========================================================
                OPCIÓN 2: TIPOGRAFÍA (DESPLEGABLE)
            ========================================================== */}
            <View style={[modalStyles.accordionCard, { borderColor: palette.border }]}>
              <Pressable
                style={[
                  modalStyles.accordionHeader,
                  expandedSection === 'typography' && {
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  },
                ]}
                onPress={() => toggleSection('typography')}
              >
                <View style={[modalStyles.accordionIconBox, { backgroundColor: `${palette.secondary}18` }]}>
                  <Ionicons name="text-outline" size={20} color={palette.secondary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[modalStyles.accordionTitle, { color: palette.text }]}>
                    Tipografía
                  </Text>
                  <Text style={[modalStyles.accordionDesc, { color: palette.textSub }]}>
                    Títulos, subtítulos, textos y valores numéricos
                  </Text>
                </View>
                <Ionicons
                  name={expandedSection === 'typography' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.secondary}
                />
              </Pressable>

              {expandedSection === 'typography' && (
                <View style={modalStyles.accordionContent}>
                  <Text style={[modalStyles.contentSubNotice, { color: palette.textSub }]}>
                    Personaliza independientemente el estilo de fuente para cada nivel de texto:
                  </Text>

                  <TypographyCategoryRow
                    categoryTitle="TÍTULOS"
                    categoryDesc="Encabezados grandes y nombres de módulos"
                    currentValue={typography?.titles || 'system'}
                    onSelect={(fontKey) => setTypography({ titles: fontKey })}
                    palette={palette}
                  />

                  <TypographyCategoryRow
                    categoryTitle="SUBTÍTULOS"
                    categoryDesc="Metas, etiquetas y encabezados de sección"
                    currentValue={typography?.subtitles || 'system'}
                    onSelect={(fontKey) => setTypography({ subtitles: fontKey })}
                    palette={palette}
                  />

                  <TypographyCategoryRow
                    categoryTitle="TEXTOS"
                    categoryDesc="Párrafos, notas, descripciones y listas"
                    currentValue={typography?.body || 'system'}
                    onSelect={(fontKey) => setTypography({ body: fontKey })}
                    palette={palette}
                  />

                  <TypographyCategoryRow
                    categoryTitle="DATOS Y NÚMEROS"
                    categoryDesc="Kcal, gramos, series, repeticiones y presión arterial"
                    currentValue={typography?.data || 'system'}
                    onSelect={(fontKey) => setTypography({ data: fontKey })}
                    palette={palette}
                  />

                  {/* VISTA PREVIA EN VIVO */}
                  <View
                    style={[
                      modalStyles.typePreviewCard,
                      {
                        backgroundColor: palette.bg,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <View style={modalStyles.typePreviewHeader}>
                      <Ionicons name="sparkles" size={13} color={palette.primary} />
                      <Text style={[modalStyles.typePreviewTag, { color: palette.primary }]}>
                        VISTA PREVIA EN TIEMPO REAL
                      </Text>
                    </View>

                    <Text
                      style={[
                        modalStyles.typePreviewTitle,
                        {
                          color: palette.text,
                          fontFamily: getFontFamily(typography?.titles || 'system'),
                        },
                      ]}
                    >
                      Resumen de Progreso
                    </Text>

                    <Text
                      style={[
                        modalStyles.typePreviewSub,
                        {
                          color: palette.textSub,
                          fontFamily: getFontFamily(typography?.subtitles || 'system'),
                        },
                      ]}
                    >
                      Estadísticas globales de entrenamiento y salud
                    </Text>

                    <Text
                      style={[
                        modalStyles.typePreviewBody,
                        {
                          color: palette.textSub,
                          fontFamily: getFontFamily(typography?.body || 'system'),
                        },
                      ]}
                    >
                      Tu constancia diaria te permite subir de nivel y desbloquear nuevos rangos.
                    </Text>

                    <View style={modalStyles.typePreviewDataRow}>
                      <Text
                        style={[
                          modalStyles.typePreviewDataVal,
                          {
                            color: palette.primary,
                            fontFamily: getFontFamily(typography?.data || 'system'),
                          },
                        ]}
                      >
                        2,450 kcal · 145g P · 119/78 mmHg · 8 Días
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* ==========================================================
                OPCIÓN 3: HOME DISPLAY (DESPLEGABLE)
            ========================================================== */}
            <View style={[modalStyles.accordionCard, { borderColor: palette.border }]}>
              <Pressable
                style={[
                  modalStyles.accordionHeader,
                  expandedSection === 'widgets' && {
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  },
                ]}
                onPress={() => toggleSection('widgets')}
              >
                <View style={[modalStyles.accordionIconBox, { backgroundColor: `${palette.primary}18` }]}>
                  <Ionicons name="grid-outline" size={20} color={palette.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[modalStyles.accordionTitle, { color: palette.text }]}>
                    Home Display
                  </Text>
                  <Text style={[modalStyles.accordionDesc, { color: palette.textSub }]}>
                    Activa o desactiva las tarjetas de la pantalla principal
                  </Text>
                </View>
                <Ionicons
                  name={expandedSection === 'widgets' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.primary}
                />
              </Pressable>

              {expandedSection === 'widgets' && (
                <View style={modalStyles.accordionContent}>
                  <Text style={[modalStyles.contentSubNotice, { color: palette.textSub }]}>
                    Enciende o apaga los módulos visibles según tus prioridades:
                  </Text>

                  <WidgetToggleRow
                    icon="nutrition-outline"
                    iconColor={palette.primary}
                    title="Nutrición y Macronutrientes"
                    desc="Calorías consumidas hoy vs meta y desglose de Proteína, Carbos y Grasas."
                    enabled={!!homeWidgets?.calories}
                    onToggle={() => toggleHomeWidget('calories')}
                    palette={palette}
                  />

                  <WidgetToggleRow
                    icon="cube-outline"
                    iconColor={palette.accent || palette.primary}
                    title="Azúcar"
                    desc="Activa el registro y seguimiento de gramos de azúcar en comidas y métricas nutricionales."
                    enabled={!!homeWidgets?.sugar}
                    onToggle={() => toggleHomeWidget('sugar')}
                    palette={palette}
                  />

                  <WidgetToggleRow
                    icon="barbell-outline"
                    iconColor={palette.secondary}
                    title="Entrenamiento del Día"
                    desc="Número de ejercicios registrados y total de series completadas hoy."
                    enabled={!!homeWidgets?.workout}
                    onToggle={() => toggleHomeWidget('workout')}
                    palette={palette}
                  />

                  <WidgetToggleRow
                    icon="medkit-outline"
                    iconColor={palette.primary}
                    title="Suplementación Diaria"
                    desc="Lista de suplementos del día y tomas completadas."
                    enabled={!!homeWidgets?.supplements}
                    onToggle={() => toggleHomeWidget('supplements')}
                    palette={palette}
                  />

                  <WidgetToggleRow
                    icon="pulse-outline"
                    iconColor={palette.secondary}
                    title="Biomarcadores de Salud"
                    desc="Últimos registros de Presión Arterial, Glucosa y semáforo clínico."
                    enabled={!!homeWidgets?.health}
                    onToggle={() => toggleHomeWidget('health')}
                    palette={palette}
                  />

                  <WidgetToggleRow
                    icon="body-outline"
                    iconColor={palette.primary}
                    title="Peso y Medidas Corporales"
                    desc="Último peso registrado en báscula y control antropométrico."
                    enabled={!!homeWidgets?.body}
                    onToggle={() => toggleHomeWidget('body')}
                    palette={palette}
                  />
                </View>
              )}
            </View>

            {/* ==========================================================
                OPCIÓN 4: PERFIL DE USUARIO
            ========================================================== */}
            <View style={[modalStyles.accordionCard, { borderColor: palette.border }]}>
              <Pressable
                style={[
                  modalStyles.accordionHeader,
                  expandedSection === 'profile' && {
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  },
                ]}
                onPress={() => toggleSection('profile')}
              >
                <View style={[modalStyles.accordionIconBox, { backgroundColor: `${palette.secondary}18` }]}>
                  <Ionicons name="person-outline" size={20} color={palette.secondary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[modalStyles.accordionTitle, { color: palette.text }]}>
                    Perfil de Usuario
                  </Text>
                  <Text style={[modalStyles.accordionDesc, { color: palette.textSub }]}>
                    {editName} (@{editNick.replace('@', '')}) · {editGender} · {editHeight ? `${editHeight} cm` : 'Sin altura'}
                  </Text>
                </View>
                <Ionicons
                  name={expandedSection === 'profile' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.secondary}
                />
              </Pressable>

              {expandedSection === 'profile' && (
                <View style={modalStyles.accordionContent}>
                  <Text style={[modalStyles.formLabel, { color: palette.textSub }]}>
                    Nombre completo
                  </Text>
                  <TextInput
                    style={[
                      modalStyles.formInput,
                      {
                        backgroundColor: palette.bg,
                        color: palette.text,
                        borderColor: palette.border,
                      },
                    ]}
                    value={editName}
                    onChangeText={setEditName}
                    onBlur={handleSaveProfile}
                  />

                  <Text style={[modalStyles.formLabel, { color: palette.textSub, marginTop: 8 }]}>
                    Nickname / Usuario
                  </Text>
                  <TextInput
                    style={[
                      modalStyles.formInput,
                      {
                        backgroundColor: palette.bg,
                        color: palette.text,
                        borderColor: palette.border,
                      },
                    ]}
                    value={editNick}
                    onChangeText={setEditNick}
                    onBlur={handleSaveProfile}
                    autoCapitalize="none"
                  />

                  <Text style={[modalStyles.formLabel, { color: palette.textSub, marginTop: 8 }]}>
                    Altura (cm)
                  </Text>
                  <TextInput
                    style={[
                      modalStyles.formInput,
                      {
                        backgroundColor: palette.bg,
                        color: palette.text,
                        borderColor: palette.border,
                      },
                    ]}
                    value={editHeight}
                    onChangeText={setEditHeight}
                    onBlur={handleSaveProfile}
                    placeholder="Ej. 178"
                    placeholderTextColor={palette.textSub}
                    keyboardType="numeric"
                  />

                  <Text style={[modalStyles.formLabel, { color: palette.textSub, marginTop: 12 }]}>
                    Género
                  </Text>
                  <View style={modalStyles.genderRow}>
                    {(['Masculino', 'Femenino', 'Otro', 'Prefiero no decir'] as GenderOption[]).map((g) => {
                      const isSelected = editGender === g;
                      const iconName =
                        g === 'Masculino'
                          ? 'male-outline'
                          : g === 'Femenino'
                          ? 'female-outline'
                          : g === 'Otro'
                          ? 'transgender-outline'
                          : 'person-outline';
                      return (
                        <Pressable
                          key={g}
                          style={[
                            modalStyles.genderPill,
                            {
                              backgroundColor: isSelected ? palette.primary : palette.bg,
                              borderColor: isSelected ? palette.primary : palette.border,
                            },
                          ]}
                          onPress={() => {
                            setEditGender(g);
                            setUserProfile({
                              name: editName.trim(),
                              nickname: editNick.trim().replace('@', ''),
                              height: editHeight.trim() ? parseFloat(editHeight) || undefined : undefined,
                              gender: g,
                            });
                          }}
                        >
                          <Ionicons
                            name={iconName}
                            size={14}
                            color={isSelected ? '#FFFFFF' : palette.textSub}
                          />
                          <Text
                            style={[
                              modalStyles.genderPillText,
                              {
                                color: isSelected ? '#FFFFFF' : palette.text,
                                fontWeight: isSelected ? '800' : '600',
                              },
                            ]}
                          >
                            {g}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* ==========================================================
                OPCIÓN 5: CUENTA Y SESIÓN (BACKEND)
            ========================================================== */}
            <View style={[modalStyles.accordionCard, { borderColor: palette.border }]}>
              <Pressable
                style={[
                  modalStyles.accordionHeader,
                  expandedSection === 'account' && {
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  },
                ]}
                onPress={() => toggleSection('account')}
              >
                <View style={[modalStyles.accordionIconBox, { backgroundColor: `${palette.primary}18` }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={palette.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[modalStyles.accordionTitle, { color: palette.text }]}>
                    Cuenta y Sesión
                  </Text>
                  <Text style={[modalStyles.accordionDesc, { color: palette.textSub }]}>
                    {authUser?.email || 'Sesión activa en el servidor local'}
                  </Text>
                </View>
                <Ionicons
                  name={expandedSection === 'account' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.primary}
                />
              </Pressable>

              {expandedSection === 'account' && (
                <View style={modalStyles.accordionContent}>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[modalStyles.formLabel, { color: palette.textSub }]}>CORREO REGISTRADO</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text, marginTop: 2 }}>
                      {authUser?.email || 'Sin correo registrado'}
                    </Text>
                  </View>

                  <View style={{ marginBottom: 16 }}>
                    <Text style={[modalStyles.formLabel, { color: palette.textSub }]}>TIPO DE AUTENTICACIÓN</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text, marginTop: 2 }}>
                      {authUser?.provider ? `Cuenta ${authUser.provider.toUpperCase()}` : 'Correo y Contraseña'}
                    </Text>
                  </View>

                  {/* Estado y Sincronización de Base de Datos */}
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      backgroundColor: palette.isDark ? '#0F172A' : '#F1F5F9',
                      borderWidth: 1,
                      borderColor: palette.border,
                      marginBottom: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Ionicons
                        name={
                          syncStatus === 'error'
                            ? 'cloud-offline'
                            : syncStatus === 'syncing'
                            ? 'cloud-upload'
                            : 'cloud-done'
                        }
                        size={18}
                        color={syncStatus === 'error' ? '#EF4444' : palette.primary}
                      />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text }}>
                        BASE DE DATOS Y RESPALDO
                      </Text>
                    </View>

                    <Text style={{ fontSize: 12, color: palette.textSub, lineHeight: 17, marginBottom: 8 }}>
                      {syncStatus === 'syncing'
                        ? 'Sincronizando información en la base de datos...'
                        : syncStatus === 'error'
                        ? `Error de conexión: ${syncError || 'Servidor local no alcanzable'}`
                        : 'Toda tu información (comidas, rutinas, suplementos, fotos, medidas y personalización) está guardada y sincronizada en la base de datos.'}
                    </Text>

                    {lastSyncedAt && (
                      <Text style={{ fontSize: 11, fontWeight: '600', color: palette.primary, marginBottom: 10 }}>
                        Último respaldo: {lastSyncedAt}
                      </Text>
                    )}

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        style={({ pressed }) => [
                          {
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 9,
                            borderRadius: 10,
                            backgroundColor: palette.primary,
                          },
                          (pressed || syncLoading) && { opacity: 0.7 },
                        ]}
                        onPress={handleSyncNow}
                        disabled={syncLoading}
                      >
                        <Ionicons name="cloud-upload-outline" size={15} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' }}>
                          {syncLoading ? 'Guardando...' : 'Respaldar BD'}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [
                          {
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 9,
                            borderRadius: 10,
                            backgroundColor: palette.cardBg,
                            borderWidth: 1,
                            borderColor: palette.border,
                          },
                          (pressed || syncLoading) && { opacity: 0.7 },
                        ]}
                        onPress={handlePullNow}
                        disabled={syncLoading}
                      >
                        <Ionicons name="cloud-download-outline" size={15} color={palette.text} />
                        <Text style={{ color: palette.text, fontSize: 11.5, fontWeight: '800' }}>
                          Restaurar BD
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Botón de Cerrar Sesión */}
                  <Pressable
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        paddingVertical: 11,
                        borderRadius: 12,
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={handleLogout}
                  >
                    <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontSize: 13.5, fontWeight: '800' }}>
                      Cerrar Sesión en este dispositivo
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Botón inferior para cerrar */}
          <View style={[modalStyles.modalFooter, { borderTopColor: palette.border }]}>
            <Pressable
              style={[modalStyles.doneBtn, { backgroundColor: palette.primary }]}
              onPress={() => {
                handleSaveProfile();
                onClose();
              }}
            >
              <Text style={modalStyles.doneBtnText}>Guardar y Listo</Text>
            </Pressable>
          </View>
        </View>

        {/* Modal para Editar Nombre de Paleta */}
        <RenamePaletteModal
          visible={editingPaletteName !== null}
          initialName={editingPaletteName?.currentName || ''}
          onClose={() => setEditingPaletteName(null)}
          onSave={handleSavePaletteName}
          palette={palette}
        />

        {/* Modal para Cambiar Color de una Paleta Existente */}
        <ColorPickerModal
          visible={editingPaletteColor !== null}
          initialColor={editingPaletteColor?.currentColor || '#8B5CF6'}
          title={editingPaletteColor ? `Cambiar Color ${editingPaletteColor.colorIndex + 1}` : 'Elegir Color'}
          onClose={() => setEditingPaletteColor(null)}
          onSelectColor={handleColorSelectedForPalette}
          palette={palette}
        />

        {/* Modal para Seleccionar Color Personalizado en Nueva Paleta */}
        <ColorPickerModal
          visible={pickingCustomColorSlot !== null}
          initialColor={pickingCustomColorSlot !== null ? newColors[pickingCustomColorSlot] : '#8B5CF6'}
          title={pickingCustomColorSlot !== null ? `Color ${pickingCustomColorSlot + 1} Personalizado` : 'Color Personalizado'}
          onClose={() => setPickingCustomColorSlot(null)}
          onSelectColor={(selectedColor) => {
            if (pickingCustomColorSlot !== null) {
              handleUpdateColorSlot(pickingCustomColorSlot, selectedColor);
              setPickingCustomColorSlot(null);
            }
          }}
          palette={palette}
        />
      </View>
    </Modal>
  );
}

/* ==========================================================
   SUB-COMPONENTES AUXILIARES PARA EL MODAL
========================================================== */
function TypographyCategoryRow({
  categoryTitle,
  categoryDesc,
  currentValue,
  onSelect,
  palette,
}: {
  categoryTitle: string;
  categoryDesc: string;
  currentValue: FontStyleOption;
  onSelect: (font: FontStyleOption) => void;
  palette: ColorPalette;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOpt = FONT_OPTIONS.find((f) => f.key === currentValue) || FONT_OPTIONS[0];

  return (
    <View style={modalStyles.typeCategoryCard}>
      <View style={{ marginBottom: 8 }}>
        <Text style={[modalStyles.typeCategoryTitle, { color: palette.text }]}>
          {categoryTitle}
        </Text>
        <Text style={[modalStyles.typeCategoryDesc, { color: palette.textSub }]}>
          {categoryDesc}
        </Text>
      </View>

      {/* Botón trigger del dropdown con preview en vivo */}
      <Pressable
        style={({ pressed }) => [
          modalStyles.fontDropdownTrigger,
          {
            backgroundColor: palette.bg,
            borderColor: isOpen ? palette.primary : palette.border,
          },
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => setIsOpen(!isOpen)}
      >
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[modalStyles.fontDropdownCurrentName, { color: palette.text }]}>
              {selectedOpt.label}
            </Text>
            <View style={[modalStyles.fontActiveTag, { backgroundColor: `${palette.primary}18` }]}>
              <Text style={[modalStyles.fontActiveTagText, { color: palette.primary }]}>Activa</Text>
            </View>
          </View>
          <Text
            style={[
              modalStyles.fontDropdownSpecimen,
              {
                color: palette.primary,
                fontFamily: getFontFamily(selectedOpt.key),
              },
            ]}
            numberOfLines={1}
          >
            {selectedOpt.preview}
          </Text>
        </View>

        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={palette.primary}
        />
      </Pressable>

      {/* Menú desplegable con previsualización para cada fuente */}
      {isOpen && (
        <View style={[modalStyles.fontDropdownMenu, { backgroundColor: palette.bg, borderColor: palette.border }]}>
          {FONT_OPTIONS.map((opt) => {
            const isSelected = opt.key === currentValue;
            const optFont = getFontFamily(opt.key);
            return (
              <Pressable
                key={opt.key}
                style={({ pressed }) => [
                  modalStyles.fontDropdownItem,
                  {
                    borderBottomColor: palette.border,
                    backgroundColor: isSelected
                      ? `${palette.primary}12`
                      : pressed
                      ? (palette.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
                      : 'transparent',
                  },
                ]}
                onPress={() => {
                  onSelect(opt.key);
                  setIsOpen(false);
                }}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={[
                        modalStyles.fontItemLabel,
                        {
                          color: isSelected ? palette.primary : palette.text,
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color={palette.primary} />
                    )}
                  </View>

                  {/* Muestra real para apreciar cómo se ve la fuente */}
                  <Text
                    style={[
                      modalStyles.fontItemSpecimen,
                      {
                        color: isSelected ? palette.primary : palette.text,
                        fontFamily: optFont,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {opt.preview}
                  </Text>

                  <Text style={[modalStyles.fontItemDesc, { color: palette.textSub }]}>
                    {opt.description}
                  </Text>
                </View>

                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={isSelected ? palette.primary : palette.textSub}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function WidgetToggleRow({
  icon,
  iconColor,
  title,
  desc,
  enabled,
  onToggle,
  palette,
}: {
  icon: any;
  iconColor: string;
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: () => void;
  palette: ColorPalette;
}) {
  return (
    <View
      style={[
        modalStyles.widgetToggleRow,
        {
          backgroundColor: palette.bg,
          borderColor: enabled ? palette.primary : palette.border,
          borderWidth: enabled ? 1.5 : 1,
        },
      ]}
    >
      <View style={[modalStyles.widgetIconBox, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>

      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[modalStyles.widgetTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[modalStyles.widgetDesc, { color: palette.textSub }]}>{desc}</Text>
      </View>

      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ false: palette.border, true: palette.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

/* ==========================================================
   ESTILOS DE LA PANTALLA PRINCIPAL
========================================================== */
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },

  // Perfil superior sticky fijo
  userHeroSticky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 20,
    elevation: 4,
    overflow: 'hidden',
  },
  userHeroTransparent: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 16,
  },
  userHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAvatarWrapper: {
    position: 'relative',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  heroAvatarText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroStreakBadgeOverlay: {
    position: 'absolute',
    top: -4,
    left: -4,
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 10,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  heroStreakBadgeOverlayText: {
    fontSize: 10.5,
    fontWeight: '900',
    lineHeight: 12,
  },

  // Widgets Metas en Home
  iconBoxMiniGradient: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeGoalMiniCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  homeGoalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  homeGoalTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  homeGoalTagText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  homeGoalDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  homeGoalDateText: {
    fontSize: 10,
    fontWeight: '700',
  },
  homeGoalTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  homeGoalProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  homeGoalValuesCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  homeGoalValCurrent: {
    fontSize: 13,
    fontWeight: '900',
  },
  homeGoalValTarget: {
    fontSize: 11,
    fontWeight: '600',
  },
  homeGoalTrackWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  homeGoalTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  homeGoalFill: {
    height: '100%',
    borderRadius: 3,
  },
  homeGoalPercentText: {
    fontSize: 11,
    fontWeight: '900',
    minWidth: 32,
    textAlign: 'right',
  },
  homeGoalsFooterHint: {
    marginTop: 2,
    alignItems: 'center',
  },
  homeGoalsFooterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  homeGoalsEmpty: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 6,
  },
  homeGoalsEmptyText: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 12,
  },
  homeGoalsEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  homeGoalsEmptyBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  heroCenterCol: {
    flex: 1,
    marginLeft: 4,
    marginRight: 6,
  },
  heroName: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroNickDate: {
    fontSize: 11,
    marginTop: 1,
  },
  heroRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    flexShrink: 1,
  },
  heroRankText: {
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
  },
  heroXpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  heroXpTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  heroXpFill: {
    height: '100%',
    borderRadius: 3,
  },
  heroXpInfoBtn: {
    marginLeft: 6,
    padding: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Lado derecho del héroe: Menú Hamburguesa con despliegue horizontal
  heroRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroHamburgerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSettingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLogoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 16,
  },
  logoutHomeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  heroStreakBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 42,
  },
  heroStreakNum: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 15,
  },
  heroStreakLabel: {
    fontSize: 9,
    fontWeight: '800',
  },
  heroStreakStacked: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    minWidth: 36,
  },
  heroStreakTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  heroStreakNumStacked: {
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  heroStreakLabelStacked: {
    fontSize: 8.5,
    fontWeight: '800',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },

  // Tarjetas genéricas del Home
  cardOuter: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardGradient: {
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBoxMini: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  linkActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  linkActionText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Macro Row
  macroHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  macroHeroVal: {
    fontSize: 24,
    fontWeight: '900',
  },
  macroHeroUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  macroHeroSub: {
    fontSize: 11,
    marginTop: 2,
  },
  macroPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  macroPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  macroPillLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  macroPillVal: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Stats 2 Column
  statsTwoCol: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
  },
  statBoxVal: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2,
  },
  statBoxLabel: {
    fontSize: 11,
  },

  // Suplementos Mini
  suppListMini: {
    gap: 8,
    marginTop: 4,
  },
  suppMiniItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  suppMiniName: {
    flex: 1,
    fontSize: 13,
  },
  suppMiniCount: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Salud Mini
  healthRowMini: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  healthBox: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
  },
  healthLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  healthVal: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  healthPillMini: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },

  // Medidas y Composición Corporal
  bodyCompGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  bodyCompBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  bodyCompBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  bodyCompIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyCompBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bodyCompVal: {
    fontSize: 22,
    fontWeight: '900',
  },
  bodyCompUnit: {
    fontSize: 13,
    fontWeight: '600',
  },
  bodyWeightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  bodyWeightVal: {
    fontSize: 24,
    fontWeight: '900',
  },
  bodyWeightUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  bodyWeightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  bodyWeightBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },

  // Prompt inferior
  configurePromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  configurePromptText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

/* ==========================================================
   ESTILOS DEL MODAL DE SETTINGS CON MENÚ DESPLEGABLE
========================================================== */
const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  backdropTouchDismiss: {
    flex: 1,
  },
  sheetContainer: {
    maxHeight: '90%',
    minHeight: '65%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  handleBar: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },

  // Tarjetas del Acordeón Desplegable
  accordionCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  accordionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  accordionDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  accordionContent: {
    padding: 14,
  },
  contentSubNotice: {
    fontSize: 12,
    marginBottom: 12,
  },

  // Grid de Paletas
  paletteGrid: {
    gap: 10,
    marginBottom: 14,
  },
  paletteCard: {
    padding: 14,
    borderRadius: 14,
  },
  paletteCardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paletteVerticalActions: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginLeft: 6,
  },
  paletteActionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paletteCardName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  paletteColorsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 6,
  },
  paletteColorsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  swatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swatchCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  darkTagMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  darkTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  deleteCustomBtn: {
    marginLeft: 'auto',
    padding: 6,
  },

  // Formulario Crear Paleta
  createPaletteToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginBottom: 6,
  },
  createPaletteToggleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  customPaletteForm: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 0,
    marginTop: 4,
    marginBottom: 6,
  },
  customFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customFormTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  customFormSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  paletteOpacityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  paletteOpacityNoticeText: {
    fontSize: 11.5,
    flex: 1,
    lineHeight: 16,
  },
  colorSlotCard: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  colorSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorSlotNumberBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSlotRoleText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  opacityMiniStrip: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  opacityMiniBlock: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  removeColorBtn: {
    padding: 4,
  },
  addColorSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  addColorSlotBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  formInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 12,
  },
  swatchesPickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  pickCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  pickCircleActive: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  customPickerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  themeSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  savePaletteBtn: {
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  savePaletteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Tipografía
  typeCategoryCard: {
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderWidth: 0,
    marginBottom: 10,
  },
  typeCategoryTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  typeCategoryDesc: {
    fontSize: 10,
    marginBottom: 8,
  },
  fontDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  fontDropdownCurrentName: {
    fontSize: 13,
    fontWeight: '800',
  },
  fontActiveTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  fontActiveTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  fontDropdownSpecimen: {
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 3,
  },
  fontDropdownMenu: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fontDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
  },
  fontItemLabel: {
    fontSize: 13,
  },
  fontItemSpecimen: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 2,
  },
  fontItemDesc: {
    fontSize: 10,
  },
  typeOptionsGrid: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  typePillOption: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  typePillOptionLabel: {
    fontSize: 12,
  },

  // Vista previa tipografía
  typePreviewCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  typePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  typePreviewTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  typePreviewTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  typePreviewSub: {
    fontSize: 12,
    marginBottom: 4,
  },
  typePreviewBody: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  typePreviewDataRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(203, 213, 225, 0.4)',
  },
  typePreviewDataVal: {
    fontSize: 12,
    fontWeight: '800',
  },

  // Toggle de Widgets
  widgetToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  widgetIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  widgetTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  widgetDesc: {
    fontSize: 10,
    lineHeight: 14,
  },

  // Footer modal
  modalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  doneBtn: {
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  genderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  genderPillText: {
    fontSize: 12,
  },
});

/* ==========================================================
   ESTILOS PARA SELECTOR DE COLOR Y RENOMBRAR PALETA
========================================================== */
const pickerStyles = StyleSheet.create({
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
    elevation: 20,
  },
  container: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  previewCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewHex: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
  },
  opacityChips: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  opacityChip: {
    width: 12,
    height: 22,
    borderRadius: 4,
  },
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  hexPrefix: {
    height: 40,
    width: 40,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexPrefixText: {
    fontSize: 16,
    fontWeight: '900',
  },
  hexInput: {
    flex: 1,
    height: 40,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  tonesScroll: {
    maxHeight: 160,
    marginBottom: 14,
  },
  tonesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toneCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  toneCircleActive: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  applyBtn: {
    flex: 1.4,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
});

const renameStyles = StyleSheet.create({
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
    elevation: 20,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    marginBottom: 12,
    lineHeight: 15,
  },
  input: {
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1.2,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
});

/* ==========================================================
   HELPERS & PRESETS PARA FOTO DE PERFIL & METAS
========================================================== */
export const PRESET_AVATARS = [
  {
    id: 'titan_iron',
    title: 'Titán del Hierro',
    category: 'gym',
    uri: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&auto=format&fit=crop&q=80',
    emoji: '🏋️‍♂️',
  },
  {
    id: 'silverback_gorilla',
    title: 'Gorila Alfa',
    category: 'gym',
    uri: 'https://images.unsplash.com/photo-1534188753412-3e26d0d618d6?w=400&auto=format&fit=crop&q=80',
    emoji: '🦍',
  },
  {
    id: 'apex_lion',
    title: 'León Apex',
    category: 'gym',
    uri: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400&auto=format&fit=crop&q=80',
    emoji: '🦁',
  },
  {
    id: 'spartan_legend',
    title: 'Espartano 300',
    category: 'gym',
    uri: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=400&auto=format&fit=crop&q=80',
    emoji: '🛡️',
  },
  {
    id: 'saiyan_warrior',
    title: 'Saiyan Supremo',
    category: 'anime',
    uri: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80',
    emoji: '⚡',
  },
  {
    id: 'samurai_blade',
    title: 'Samurái Ronin',
    category: 'anime',
    uri: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=80',
    emoji: '⚔️',
  },
  {
    id: 'cyber_ninja',
    title: 'Ciber Gladiador',
    category: 'anime',
    uri: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
    emoji: '🤖',
  },
  {
    id: 'baki_ogre',
    title: 'Bestia Ogre',
    category: 'anime',
    uri: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&auto=format&fit=crop&q=80',
    emoji: '👹',
  },
  {
    id: 'valkyrie_fit',
    title: 'Valquiria Fitness',
    category: 'aesthetic',
    uri: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&auto=format&fit=crop&q=80',
    emoji: '✨',
  },
  {
    id: 'aesthetic_zyzz',
    title: 'Aesthetic Legacy',
    category: 'aesthetic',
    uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&auto=format&fit=crop&q=80',
    emoji: '🔱',
  },
  {
    id: 'phoenix_resurrect',
    title: 'Fénix Renacido',
    category: 'aesthetic',
    uri: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=400&auto=format&fit=crop&q=80',
    emoji: '🔥',
  },
  {
    id: 'lone_wolf',
    title: 'Lobo Solitario',
    category: 'gym',
    uri: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=400&auto=format&fit=crop&q=80',
    emoji: '🐺',
  },
];

export function formatGoalDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthIdx = parseInt(parts[1], 10) - 1;
  return `${parseInt(parts[2], 10)} ${months[monthIdx] || parts[1]} ${parts[0]}`;
}

export function getGoalDaysRemaining(targetDateStr: string): { days: number; text: string; isPast: boolean } {
  if (!targetDateStr) return { days: 0, text: '', isPast: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDateStr + 'T00:00:00');
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return { days: diffDays, text: `Faltan ${diffDays} días`, isPast: false };
  if (diffDays === 0) return { days: 0, text: '¡Hoy es el día!', isPast: false };
  return { days: diffDays, text: `Venció hace ${Math.abs(diffDays)}d`, isPast: true };
}

export function calculateGoalProgress(goal: UserGoal): number {
  const cur = Number(goal.currentValue);
  const start = Number(goal.startValue);
  const target = Number(goal.targetValue);
  if (isNaN(cur) || isNaN(target)) return goal.completed ? 100 : 0;
  if (goal.completed) return 100;
  if (!isNaN(start) && target !== start) {
    if (target > start) {
      const p = Math.round(((cur - start) / (target - start)) * 100);
      return Math.min(100, Math.max(0, p));
    } else {
      const p = Math.round(((start - cur) / (start - target)) * 100);
      return Math.min(100, Math.max(0, p));
    }
  }
  if (target > 0) {
    return Math.min(100, Math.max(0, Math.round((cur / target) * 100)));
  }
  return 0;
}

export function getGoalCategoryIcon(type: GoalType): string {
  switch (type) {
    case 'weight': return '⚖️';
    case 'pr': return '🏋️';
    case 'muscle': return '💪';
    case 'streak': return '🔥';
    default: return '🎯';
  }
}

export function getGoalCategoryLabel(type: GoalType): string {
  switch (type) {
    case 'weight': return 'Peso Corporal';
    case 'pr': return 'Mejorar PR';
    case 'muscle': return 'Medidas de Músculo';
    case 'streak': return 'Racha / Hábito';
    default: return 'Objetivo Personal';
  }
}

/* ==========================================================
   MODAL: ZOOM & CAMBIO DE FOTO DE PERFIL (CÁMARA, GALERÍA, PRESETS)
========================================================== */
function AvatarZoomModal({
  visible,
  zoomAnim,
  userProfile,
  initials,
  userName,
  userNick,
  userLevel,
  rankTitle,
  c1,
  c2,
  palette,
  titleFont,
  subtitleFont,
  bodyFont,
  onClose,
  onUpdateAvatar,
}: {
  visible: boolean;
  zoomAnim: Animated.Value;
  userProfile: any;
  initials: string;
  userName: string;
  userNick: string;
  userLevel: number;
  rankTitle: string;
  c1: string;
  c2: string;
  palette: ColorPalette;
  titleFont?: string;
  subtitleFont?: string;
  bodyFont?: string;
  onClose: () => void;
  onUpdateAvatar: (uri: string) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'gym' | 'anime' | 'aesthetic'>('all');

  const handlePickCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permiso de cámara requerido',
          'Por favor autoriza el acceso a la cámara en los ajustes de tu dispositivo para capturar tu foto.'
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        onUpdateAvatar(res.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'No se pudo abrir la cámara.');
    }
  };

  const handlePickGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permiso de galería requerido',
          'Por favor autoriza el acceso a la galería de fotos en los ajustes de tu dispositivo.'
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        onUpdateAvatar(res.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'No se pudo abrir la galería.');
    }
  };

  const filteredPresets = PRESET_AVATARS.filter((p) =>
    categoryFilter === 'all' ? true : p.category === categoryFilter
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={avatarStyles.overlay}>
        <Animated.View
          style={[
            avatarStyles.cardContainer,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.border,
              transform: [{ scale: zoomAnim }],
            },
          ]}
        >
          {/* Header con botón cerrar */}
          <View style={avatarStyles.headerRow}>
            <Text style={[avatarStyles.headerTitle, { color: palette.text, fontFamily: titleFont }]}>
              Foto de Perfil
            </Text>
            <TouchableOpacity onPress={onClose} style={avatarStyles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={20} color={palette.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Vista con Zoom Ampliado de la Foto */}
            <View style={avatarStyles.zoomWrap}>
              <View style={[avatarStyles.avatarZoomRing, { borderColor: c1 }]}>
                {userProfile?.avatarUri ? (
                  <Image
                    source={{ uri: userProfile.avatarUri }}
                    style={avatarStyles.avatarZoomImage}
                    resizeMode="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={[c1, c2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={avatarStyles.avatarZoomGradient}
                  >
                    <Text style={avatarStyles.avatarZoomInitials}>{initials}</Text>
                  </LinearGradient>
                )}
              </View>

              <Text style={[avatarStyles.zoomName, { color: palette.text, fontFamily: titleFont }]}>
                {userName}
              </Text>
              <Text style={[avatarStyles.zoomSub, { color: palette.textSub, fontFamily: bodyFont }]}>
                <Text style={{ color: c1, fontWeight: '700' }}>{userNick}</Text> · Nivel {userLevel} ({rankTitle})
              </Text>
            </View>

            {/* Opciones de Cámara y Galería */}
            <View style={avatarStyles.actionsRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePickCamera}
                style={[avatarStyles.actionBtn, { backgroundColor: palette.isDark ? '#1E293B' : '#F1F5F9', borderColor: palette.border }]}
              >
                <Ionicons name="camera-outline" size={20} color={c1} />
                <Text style={[avatarStyles.actionBtnText, { color: palette.text, fontFamily: subtitleFont }]}>
                  Tomar Foto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePickGallery}
                style={[avatarStyles.actionBtn, { backgroundColor: palette.isDark ? '#1E293B' : '#F1F5F9', borderColor: palette.border }]}
              >
                <Ionicons name="images-outline" size={20} color={c2} />
                <Text style={[avatarStyles.actionBtnText, { color: palette.text, fontFamily: subtitleFont }]}>
                  Elegir de Galería
                </Text>
              </TouchableOpacity>
            </View>

            {userProfile?.avatarUri ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onUpdateAvatar('')}
                style={avatarStyles.removeBtn}
              >
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                <Text style={[avatarStyles.removeBtnText, { color: '#EF4444', fontFamily: subtitleFont }]}>
                  Restaurar Iniciales Predeterminadas
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Galería de Avatares Ilustrados / Animados (Gym, Anime & Aesthetic) */}
            <View style={avatarStyles.presetSection}>
              <View style={avatarStyles.presetHeaderRow}>
                <Text style={[avatarStyles.presetSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                  Avatares Animados & Gym
                </Text>
                <Text style={[avatarStyles.presetSectionSub, { color: palette.textSub, fontFamily: bodyFont }]}>
                  Selecciona tu personaje
                </Text>
              </View>

              {/* Categorías de Filtro */}
              <View style={avatarStyles.filterTabsRow}>
                {[
                  { key: 'all', label: 'Todos' },
                  { key: 'gym', label: '🏋️ Gym' },
                  { key: 'anime', label: '⚡ Anime' },
                  { key: 'aesthetic', label: '✨ Aesthetic' },
                ].map((cat) => {
                  const active = categoryFilter === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => setCategoryFilter(cat.key as any)}
                      style={[
                        avatarStyles.filterTabPill,
                        active && { backgroundColor: c1, borderColor: c1 },
                        !active && { borderColor: palette.border, backgroundColor: palette.bg },
                      ]}
                    >
                      <Text
                        style={[
                          avatarStyles.filterTabText,
                          { color: active ? '#FFFFFF' : palette.textSub, fontFamily: subtitleFont },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Cuadrícula de Avatares */}
              <View style={avatarStyles.presetGrid}>
                {filteredPresets.map((preset) => {
                  const isSelected = userProfile?.avatarUri === preset.uri;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      activeOpacity={0.8}
                      onPress={() => onUpdateAvatar(preset.uri)}
                      style={[
                        avatarStyles.presetItemCard,
                        {
                          backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                          borderColor: isSelected ? c1 : palette.border,
                          borderWidth: isSelected ? 2.5 : 1,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: preset.uri }}
                        style={avatarStyles.presetThumbnail}
                        resizeMode="cover"
                      />
                      <Text
                        style={[
                          avatarStyles.presetTitle,
                          { color: isSelected ? c1 : palette.text, fontFamily: subtitleFont },
                        ]}
                        numberOfLines={1}
                      >
                        {preset.emoji} {preset.title}
                      </Text>
                      {isSelected && (
                        <View style={[avatarStyles.selectedBadge, { backgroundColor: c1 }]}>
                          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Botón Listo */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onClose}
              style={[avatarStyles.doneBtn, { backgroundColor: c1 }]}
            >
              <Text style={[avatarStyles.doneBtnText, { fontFamily: subtitleFont }]}>
                Guardar y Salir
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const avatarStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  cardContainer: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    padding: 4,
  },
  zoomWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarZoomRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3.5,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarZoomImage: {
    width: '100%',
    height: '100%',
    borderRadius: 65,
  },
  avatarZoomGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarZoomInitials: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  zoomName: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },
  zoomSub: {
    fontSize: 12,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 16,
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  presetSection: {
    marginTop: 8,
    marginBottom: 14,
  },
  presetHeaderRow: {
    marginBottom: 10,
  },
  presetSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  presetSectionSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '800',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  presetItemCard: {
    width: '31%',
    borderRadius: 14,
    padding: 6,
    alignItems: 'center',
    position: 'relative',
  },
  presetThumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    marginBottom: 6,
  },
  presetTitle: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});

/* ==========================================================
   MODAL: CONFIGURACIÓN & GESTIÓN DE METAS CON FECHAS LÍMITE
========================================================== */
function GoalsModal({
  visible,
  goals,
  c1,
  c2,
  palette,
  titleFont,
  subtitleFont,
  dataFont,
  bodyFont,
  onClose,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onToggleCompleted,
}: {
  visible: boolean;
  goals: UserGoal[];
  c1: string;
  c2: string;
  palette: ColorPalette;
  titleFont?: string;
  subtitleFont?: string;
  dataFont?: string;
  bodyFont?: string;
  onClose: () => void;
  onAddGoal: (g: Omit<UserGoal, 'id' | 'createdAt'>) => void;
  onUpdateGoal: (id: string, updates: Partial<UserGoal>) => void;
  onDeleteGoal: (id: string) => void;
  onToggleCompleted: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'new'>('active');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // Campos del formulario
  const [goalType, setGoalType] = useState<GoalType>('weight');
  const [goalTitle, setGoalTitle] = useState('');
  const [targetDate, setTargetDate] = useState('2026-02-14');
  const [startVal, setStartVal] = useState('');
  const [currentVal, setCurrentVal] = useState('');
  const [targetVal, setTargetVal] = useState('');
  const [unit, setUnit] = useState('kg');
  const [notes, setNotes] = useState('');

  const activeGoals = goals.filter((g) => !g.completed);
  const completedGoals = goals.filter((g) => g.completed);

  // Iniciar creación o edición
  const resetForm = () => {
    setEditingGoalId(null);
    setGoalType('weight');
    setGoalTitle('');
    setTargetDate('2026-02-14');
    setStartVal('');
    setCurrentVal('');
    setTargetVal('');
    setUnit('kg');
    setNotes('');
  };

  const handleStartEdit = (g: UserGoal) => {
    setEditingGoalId(g.id);
    setGoalType(g.type);
    setGoalTitle(g.title);
    setTargetDate(g.targetDate);
    setStartVal(g.startValue !== undefined ? String(g.startValue) : '');
    setCurrentVal(g.currentValue !== undefined ? String(g.currentValue) : '');
    setTargetVal(g.targetValue !== undefined ? String(g.targetValue) : '');
    setUnit(g.unit || 'kg');
    setNotes(g.notes || '');
    setActiveTab('new');
  };

  const handleSaveGoal = () => {
    if (!goalTitle.trim()) {
      Alert.alert('Falta información', 'Por favor ingresa un título o descripción para tu meta.');
      return;
    }
    if (!targetDate.trim()) {
      Alert.alert('Falta fecha límite', 'Por favor define una fecha objetivo (ej. 2026-02-14).');
      return;
    }

    const sNum = startVal ? parseFloat(startVal.replace(',', '.')) : undefined;
    const cNum = currentVal ? parseFloat(currentVal.replace(',', '.')) : sNum;
    const tNum = targetVal ? parseFloat(targetVal.replace(',', '.')) : undefined;

    if (editingGoalId) {
      onUpdateGoal(editingGoalId, {
        title: goalTitle.trim(),
        type: goalType,
        targetDate: targetDate.trim(),
        startValue: sNum,
        currentValue: cNum,
        targetValue: tNum,
        unit: unit.trim(),
        categoryLabel: getGoalCategoryLabel(goalType),
        notes: notes.trim(),
      });
      Alert.alert('¡Meta Actualizada!', 'Tu meta se ha guardado correctamente.');
    } else {
      onAddGoal({
        title: goalTitle.trim(),
        type: goalType,
        targetDate: targetDate.trim(),
        startValue: sNum,
        currentValue: cNum,
        targetValue: tNum,
        unit: unit.trim(),
        categoryLabel: getGoalCategoryLabel(goalType),
        notes: notes.trim(),
        completed: false,
      });
      Alert.alert('¡Meta Creada!', 'Tu nuevo objetivo ha sido fijado. ¡A darlo todo!');
    }

    resetForm();
    setActiveTab('active');
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert(
      'Eliminar Meta',
      `¿Estás seguro de que deseas eliminar la meta "${title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => onDeleteGoal(id) },
      ]
    );
  };

  // Sugerencias según tipo de meta
  const suggestions = {
    weight: [
      'Subir 10 kg para el 14 de Feb (Volumen)',
      'Bajar 5 kg para definición',
      'Alcanzar 80 kg con 12% grasa corporal',
      'Definir a 75 kg para el verano',
    ],
    pr: [
      'Press de Banca a 100 kg',
      'Sentadilla profunda a 140 kg',
      'Peso Muerto a 180 kg (PR)',
      'Press Militar estricto a 70 kg',
      'Dominadas con +30 kg de lastre',
    ],
    muscle: [
      'Aumentar Bíceps a 40 cm',
      'Pecho a 110 cm de contorno',
      'Cuádriceps a 65 cm',
      'Reducir cintura a 78 cm',
      'Pantorrilla a 40 cm',
    ],
    streak: [
      'Entrenar 30 días seguidos',
      'Completar 100 entrenos este año',
      'Racha de 50 sesiones sin fallar',
    ],
    custom: [
      'Dormir 8 horas diarias durante 2 meses',
      'Consumir 180g de proteína todos los días',
      'Hacer 10,000 pasos diarios',
    ],
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={goalModalStyles.overlay}>
        <View style={[goalModalStyles.sheet, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
          {/* Header */}
          <View style={goalModalStyles.headerRow}>
            <View>
              <Text style={[goalModalStyles.headerTitle, { color: palette.text, fontFamily: titleFont }]}>
                Metas & Objetivos
              </Text>
              <Text style={[goalModalStyles.headerSub, { color: palette.textSub, fontFamily: bodyFont }]}>
                Define fechas límite y haz seguimiento a tu evolución física
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={goalModalStyles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color={palette.textSub} />
            </TouchableOpacity>
          </View>

          {/* Pestañas de Navegación */}
          <View style={[goalModalStyles.tabBar, { borderColor: palette.border, backgroundColor: palette.bg }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('active')}
              style={[
                goalModalStyles.tabItem,
                activeTab === 'active' && { backgroundColor: palette.cardBg, borderColor: c1, borderWidth: 1 },
              ]}
            >
              <Text
                style={[
                  goalModalStyles.tabText,
                  { color: activeTab === 'active' ? c1 : palette.textSub, fontFamily: subtitleFont },
                ]}
              >
                Activas ({activeGoals.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('completed')}
              style={[
                goalModalStyles.tabItem,
                activeTab === 'completed' && { backgroundColor: palette.cardBg, borderColor: c1, borderWidth: 1 },
              ]}
            >
              <Text
                style={[
                  goalModalStyles.tabText,
                  { color: activeTab === 'completed' ? c1 : palette.textSub, fontFamily: subtitleFont },
                ]}
              >
                Cumplidas ({completedGoals.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                resetForm();
                setActiveTab('new');
              }}
              style={[
                goalModalStyles.tabItem,
                activeTab === 'new' && { backgroundColor: c1 },
              ]}
            >
              <Text
                style={[
                  goalModalStyles.tabText,
                  { color: activeTab === 'new' ? '#FFFFFF' : palette.textSub, fontFamily: subtitleFont },
                ]}
              >
                {editingGoalId ? 'Editar' : '+ Nueva'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Contenido según la pestaña */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            {activeTab === 'new' ? (
              /* FORMULARIO CREAR / EDITAR META */
              <View style={goalModalStyles.formWrap}>
                <Text style={[goalModalStyles.formSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                  {editingGoalId ? 'Editar Meta' : 'Configurar Nueva Meta'}
                </Text>

                {/* Tipo de Meta */}
                <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                  Tipo de Objetivo
                </Text>
                <View style={goalModalStyles.typeSelectorRow}>
                  {[
                    { key: 'weight', label: 'Peso', icon: 'scale-outline', u: 'kg' },
                    { key: 'pr', label: 'Mejorar PR', icon: 'barbell-outline', u: 'kg' },
                    { key: 'muscle', label: 'Músculo', icon: 'body-outline', u: 'cm' },
                    { key: 'streak', label: 'Racha', icon: 'flame-outline', u: 'días' },
                    { key: 'custom', label: 'Otro', icon: 'trophy-outline', u: '' },
                  ].map((t) => {
                    const active = goalType === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        onPress={() => {
                          setGoalType(t.key as any);
                          setUnit(t.u);
                        }}
                        style={[
                          goalModalStyles.typePill,
                          active && { backgroundColor: c1, borderColor: c1 },
                          !active && { backgroundColor: palette.bg, borderColor: palette.border },
                        ]}
                      >
                        <Ionicons
                          name={t.icon as any}
                          size={14}
                          color={active ? '#FFFFFF' : palette.textSub}
                        />
                        <Text
                          style={[
                            goalModalStyles.typePillText,
                            { color: active ? '#FFFFFF' : palette.text, fontFamily: subtitleFont },
                          ]}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Sugerencias Rápidas */}
                <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont, marginTop: 12 }]}>
                  Sugerencias Rápidas
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {suggestions[goalType].map((sug, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setGoalTitle(sug)}
                      style={[goalModalStyles.sugPill, { borderColor: palette.border, backgroundColor: palette.bg }]}
                    >
                      <Text style={[goalModalStyles.sugText, { color: palette.text, fontFamily: bodyFont }]}>
                        {sug}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Título de la Meta */}
                <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont, marginTop: 12 }]}>
                  Título de la Meta
                </Text>
                <TextInput
                  value={goalTitle}
                  onChangeText={setGoalTitle}
                  placeholder="Ej. Subir 10 kg para el 14 de febrero..."
                  placeholderTextColor={palette.textSub}
                  style={[
                    goalModalStyles.textInput,
                    {
                      color: palette.text,
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                      fontFamily: bodyFont,
                    },
                  ]}
                />

                {/* Valores Numéricos (Inicio, Actual, Objetivo) */}
                <View style={goalModalStyles.valuesGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Inicio
                    </Text>
                    <TextInput
                      value={startVal}
                      onChangeText={setStartVal}
                      placeholder="72"
                      placeholderTextColor={palette.textSub}
                      keyboardType="numeric"
                      style={[
                        goalModalStyles.numInput,
                        {
                          color: palette.text,
                          backgroundColor: palette.bg,
                          borderColor: palette.border,
                          fontFamily: dataFont,
                        },
                      ]}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Actual
                    </Text>
                    <TextInput
                      value={currentVal}
                      onChangeText={setCurrentVal}
                      placeholder="76.5"
                      placeholderTextColor={palette.textSub}
                      keyboardType="numeric"
                      style={[
                        goalModalStyles.numInput,
                        {
                          color: palette.text,
                          backgroundColor: palette.bg,
                          borderColor: palette.border,
                          fontFamily: dataFont,
                        },
                      ]}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Meta
                    </Text>
                    <TextInput
                      value={targetVal}
                      onChangeText={setTargetVal}
                      placeholder="82"
                      placeholderTextColor={palette.textSub}
                      keyboardType="numeric"
                      style={[
                        goalModalStyles.numInput,
                        {
                          color: palette.text,
                          backgroundColor: palette.bg,
                          borderColor: palette.border,
                          fontFamily: dataFont,
                        },
                      ]}
                    />
                  </View>

                  <View style={{ width: 68 }}>
                    <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Unidad
                    </Text>
                    <TextInput
                      value={unit}
                      onChangeText={setUnit}
                      placeholder="kg"
                      placeholderTextColor={palette.textSub}
                      style={[
                        goalModalStyles.numInput,
                        {
                          color: palette.text,
                          backgroundColor: palette.bg,
                          borderColor: palette.border,
                          fontFamily: bodyFont,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Fecha Objetivo / Límite */}
                <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont, marginTop: 12 }]}>
                  Fecha Objetivo / Límite (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={targetDate}
                  onChangeText={setTargetDate}
                  placeholder="2026-02-14"
                  placeholderTextColor={palette.textSub}
                  style={[
                    goalModalStyles.textInput,
                    {
                      color: palette.text,
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                      fontFamily: dataFont,
                    },
                  ]}
                />

                {/* Botones rápidos de fecha */}
                <View style={goalModalStyles.quickDateRow}>
                  {[
                    { label: '14 Feb', date: '2026-02-14' },
                    { label: '+1 mes', days: 30 },
                    { label: '+3 meses', days: 90 },
                    { label: '+6 meses', days: 180 },
                    { label: 'Fin de año', date: '2026-12-31' },
                  ].map((btn, i) => {
                    const handleSelectDate = () => {
                      if (btn.date) {
                        setTargetDate(btn.date);
                      } else if (btn.days) {
                        const d = new Date();
                        d.setDate(d.getDate() + btn.days);
                        setTargetDate(d.toISOString().split('T')[0]);
                      }
                    };
                    const isSelected = targetDate === btn.date;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={handleSelectDate}
                        style={[
                          goalModalStyles.quickDatePill,
                          isSelected && { backgroundColor: c1, borderColor: c1 },
                          !isSelected && { backgroundColor: palette.bg, borderColor: palette.border },
                        ]}
                      >
                        <Text
                          style={[
                            goalModalStyles.quickDateText,
                            { color: isSelected ? '#FFFFFF' : palette.textSub, fontFamily: subtitleFont },
                          ]}
                        >
                          {btn.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Notas / Estrategia */}
                <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont, marginTop: 12 }]}>
                  Notas o Estrategia (Opcional)
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Ej. Comer 3,200 kcal y entrenar 5 días con sobrecarga progresiva..."
                  placeholderTextColor={palette.textSub}
                  multiline
                  style={[
                    goalModalStyles.notesInput,
                    {
                      color: palette.text,
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                      fontFamily: bodyFont,
                    },
                  ]}
                />

                {/* Botones de Acción */}
                <View style={goalModalStyles.formActionsRow}>
                  <TouchableOpacity
                    onPress={() => {
                      resetForm();
                      setActiveTab('active');
                    }}
                    style={[goalModalStyles.formCancelBtn, { borderColor: palette.border }]}
                  >
                    <Text style={[goalModalStyles.formCancelText, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSaveGoal}
                    style={[goalModalStyles.formSaveBtn, { backgroundColor: c1 }]}
                  >
                    <Text style={[goalModalStyles.formSaveText, { fontFamily: subtitleFont }]}>
                      {editingGoalId ? 'Actualizar Meta' : 'Guardar Meta'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* LISTA DE METAS (ACTIVAS O CUMPLIDAS) */
              <View style={{ gap: 12, marginTop: 8 }}>
                {(activeTab === 'active' ? activeGoals : completedGoals).length > 0 ? (
                  (activeTab === 'active' ? activeGoals : completedGoals).map((goal) => {
                    const progress = calculateGoalProgress(goal);
                    const remaining = getGoalDaysRemaining(goal.targetDate);
                    return (
                      <View
                        key={goal.id}
                        style={[
                          goalModalStyles.goalCard,
                          {
                            backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                            borderColor: goal.completed ? '#10B981' : palette.border,
                          },
                        ]}
                      >
                        {/* Fila superior: Checkbox + Categoría + Fecha Límite */}
                        <View style={goalModalStyles.goalCardTop}>
                          <TouchableOpacity
                            onPress={() => onToggleCompleted(goal.id)}
                            style={[
                              goalModalStyles.checkboxCircle,
                              goal.completed && { backgroundColor: '#10B981', borderColor: '#10B981' },
                              !goal.completed && { borderColor: palette.border },
                            ]}
                          >
                            {goal.completed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                          </TouchableOpacity>

                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View
                              style={[
                                goalModalStyles.categoryBadge,
                                { backgroundColor: `${c1}18`, borderColor: `${c1}35` },
                              ]}
                            >
                              <Text style={[goalModalStyles.categoryBadgeText, { color: c1 }]}>
                                {getGoalCategoryIcon(goal.type)} {goal.categoryLabel || getGoalCategoryLabel(goal.type)}
                              </Text>
                            </View>

                            <View
                              style={[
                                goalModalStyles.deadlinePill,
                                {
                                  backgroundColor: remaining.isPast
                                    ? 'rgba(239, 68, 68, 0.12)'
                                    : remaining.days <= 14
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : 'rgba(16, 185, 129, 0.12)',
                                },
                              ]}
                            >
                              <Ionicons
                                name="time-outline"
                                size={11}
                                color={remaining.isPast ? '#EF4444' : remaining.days <= 14 ? '#F59E0B' : '#10B981'}
                              />
                              <Text
                                style={[
                                  goalModalStyles.deadlineText,
                                  {
                                    color: remaining.isPast ? '#EF4444' : remaining.days <= 14 ? '#F59E0B' : '#10B981',
                                    fontFamily: subtitleFont,
                                  },
                                ]}
                              >
                                {formatGoalDate(goal.targetDate)} ({remaining.text})
                              </Text>
                            </View>
                          </View>

                          {/* Acciones Editar y Eliminar */}
                          <View style={goalModalStyles.actionsMiniRow}>
                            <TouchableOpacity
                              onPress={() => handleStartEdit(goal)}
                              style={goalModalStyles.actionMiniBtn}
                              hitSlop={8}
                            >
                              <Ionicons name="pencil-outline" size={16} color={palette.textSub} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDelete(goal.id, goal.title)}
                              style={goalModalStyles.actionMiniBtn}
                              hitSlop={8}
                            >
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Título de la Meta */}
                        <Text
                          style={[
                            goalModalStyles.goalCardTitle,
                            {
                              color: palette.text,
                              fontFamily: titleFont,
                              textDecorationLine: goal.completed ? 'line-through' : 'none',
                              opacity: goal.completed ? 0.75 : 1,
                            },
                          ]}
                        >
                          {goal.title}
                        </Text>

                        {/* Notas si existen */}
                        {goal.notes ? (
                          <Text
                            style={[goalModalStyles.goalCardNotes, { color: palette.textSub, fontFamily: bodyFont }]}
                          >
                            {goal.notes}
                          </Text>
                        ) : null}

                        {/* Barra de Progreso y Valores */}
                        <View style={goalModalStyles.goalValuesWrap}>
                          <View style={goalModalStyles.goalNumbersRow}>
                            <Text style={[goalModalStyles.valMain, { color: palette.text, fontFamily: dataFont }]}>
                              {goal.currentValue !== undefined ? goal.currentValue : '--'}{' '}
                              <Text style={{ fontSize: 11, color: palette.textSub }}>{goal.unit || ''}</Text>
                            </Text>
                            <Text style={[goalModalStyles.valTarget, { color: palette.textSub, fontFamily: bodyFont }]}>
                              de {goal.targetValue !== undefined ? goal.targetValue : '--'} {goal.unit || ''}
                            </Text>
                          </View>

                          <View style={goalModalStyles.progressTrackContainer}>
                            <View
                              style={[
                                goalModalStyles.trackBg,
                                { backgroundColor: palette.isDark ? '#334155' : 'rgba(203, 213, 225, 0.5)' },
                              ]}
                            >
                              <LinearGradient
                                colors={[c1, c2]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[goalModalStyles.trackFill, { width: `${progress}%` }]}
                              />
                            </View>
                            <Text style={[goalModalStyles.trackPercent, { color: c1, fontFamily: dataFont }]}>
                              {progress}%
                            </Text>
                          </View>
                        </View>

                        {/* Ajuste rápido de progreso (+ / -) */}
                        {!goal.completed && goal.currentValue !== undefined ? (
                          <View style={goalModalStyles.quickAdjustRow}>
                            <Text style={[goalModalStyles.quickAdjustLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                              Actualizar avance rápido:
                            </Text>
                            <View style={goalModalStyles.quickAdjustBtns}>
                              <TouchableOpacity
                                onPress={() => {
                                  const step = goal.type === 'streak' ? 1 : 0.5;
                                  const nextVal = Math.max(0, Math.round(((goal.currentValue || 0) - step) * 10) / 10);
                                  onUpdateGoal(goal.id, { currentValue: nextVal });
                                }}
                                style={[goalModalStyles.stepBtn, { borderColor: palette.border }]}
                              >
                                <Ionicons name="remove" size={14} color={palette.text} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  const step = goal.type === 'streak' ? 1 : 0.5;
                                  const nextVal = Math.round(((goal.currentValue || 0) + step) * 10) / 10;
                                  onUpdateGoal(goal.id, { currentValue: nextVal });
                                }}
                                style={[goalModalStyles.stepBtn, { borderColor: palette.border }]}
                              >
                                <Ionicons name="add" size={14} color={palette.text} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                ) : (
                  <View style={goalModalStyles.emptyTabBox}>
                    <Ionicons
                      name={activeTab === 'active' ? 'flag-outline' : 'trophy-outline'}
                      size={44}
                      color={palette.textSub}
                      style={{ opacity: 0.5, marginBottom: 8 }}
                    />
                    <Text style={[goalModalStyles.emptyTabTitle, { color: palette.text, fontFamily: titleFont }]}>
                      {activeTab === 'active' ? 'Sin metas activas' : 'Sin metas cumplidas aún'}
                    </Text>
                    <Text style={[goalModalStyles.emptyTabSub, { color: palette.textSub, fontFamily: bodyFont }]}>
                      {activeTab === 'active'
                        ? 'Establece objetivos con fechas límite para medir tu verdadera evolución.'
                        : 'Al completar tus metas activas aparecerán aquí con su medalla de victoria.'}
                    </Text>
                    {activeTab === 'active' ? (
                      <TouchableOpacity
                        onPress={() => {
                          resetForm();
                          setActiveTab('new');
                        }}
                        style={[goalModalStyles.createFirstBtn, { backgroundColor: c1 }]}
                      >
                        <Text style={[goalModalStyles.createFirstBtnText, { fontFamily: subtitleFont }]}>
                          + Crear Primera Meta
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const goalModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '90%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  headerSub: {
    fontSize: 11.5,
    marginTop: 2,
    maxWidth: 270,
  },
  closeBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
  },
  formWrap: {
    paddingTop: 6,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 11,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  sugPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  sugText: {
    fontSize: 11,
    fontWeight: '600',
  },
  textInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
  },
  valuesGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  numInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  quickDateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickDatePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickDateText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  notesInput: {
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
    textAlignVertical: 'top',
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  formCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  formCancelText: {
    fontSize: 13,
    fontWeight: '800',
  },
  formSaveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  formSaveText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
  },
  goalCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  goalCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  deadlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  deadlineText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionsMiniRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionMiniBtn: {
    padding: 2,
  },
  goalCardTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  goalCardNotes: {
    fontSize: 11.5,
    marginBottom: 10,
    lineHeight: 16,
  },
  goalValuesWrap: {
    marginTop: 4,
  },
  goalNumbersRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 6,
  },
  valMain: {
    fontSize: 14,
    fontWeight: '900',
  },
  valTarget: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  progressTrackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trackBg: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
  },
  trackPercent: {
    fontSize: 11.5,
    fontWeight: '900',
    minWidth: 34,
    textAlign: 'right',
  },
  quickAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(203, 213, 225, 0.25)',
  },
  quickAdjustLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  quickAdjustBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTabBox: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyTabTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  emptyTabSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
    maxWidth: 260,
  },
  createFirstBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createFirstBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
  },
});
