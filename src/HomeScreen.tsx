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
  useWindowDimensions,
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
  DayMeasurements,
  WorkoutExercise,
  Exercise,
  BodyPartKey,
  FriendUser,
  SEED_FRIENDS,
} from './store';
import { pushUserDataToDatabase, pullUserDataFromDatabase } from './syncService';
import { FriendsModal } from './FriendsModal';

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
  goalsXp: number;
  completedGoalsCount: number;
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

export function calculateGoalCompletionXp(goal: UserGoal): {
  totalXp: number;
  baseXp: number;
  growthXp: number;
  timeXp: number;
  daysTaken: number;
  growthPercent: number;
} {
  // 1. Puntaje Base según dificultad intrínseca del tipo de objetivo
  let baseXp = 100;
  switch (goal.type) {
    case 'pr':
      baseXp = 150;
      break;
    case 'body_fat':
      baseXp = 140;
      break;
    case 'muscle':
      baseXp = 130;
      break;
    case 'weight':
      baseXp = 120;
      break;
    default:
      baseXp = 100;
      break;
  }

  // 2. Porcentaje de Crecimiento / Magnitud del logro (ej. PR 10 -> 12 kg vs 10 -> 90 kg)
  const start = Number(goal.startValue);
  const target = Number(goal.targetValue);
  let growthXp = 40;
  let growthPercent = 0;

  if (!isNaN(start) && !isNaN(target)) {
    if (goal.type === 'pr') {
      if (start > 0 && target > start) {
        growthPercent = Math.round(((target - start) / start) * 100);
        // Cada 1% de aumento de fuerza = 2.5 XP (hasta un máximo de 350 XP)
        growthXp = Math.min(350, Math.round(growthPercent * 2.5));
      } else {
        growthXp = 50;
      }
    } else if (goal.type === 'weight') {
      const deltaKg = Math.abs(target - start);
      growthPercent = start > 0 ? Math.round((deltaKg / start) * 100) : 0;
      // Cada kg de cambio de peso corporal = 18 XP
      growthXp = Math.min(300, Math.round(deltaKg * 18));
    } else if (goal.type === 'body_fat') {
      const deltaFat = Math.abs(target - start);
      growthPercent = start > 0 ? Math.round((deltaFat / start) * 100) : 0;
      // Cada 1% de grasa corporal reducida = 30 XP
      growthXp = Math.min(300, Math.round(deltaFat * 30));
    } else if (goal.type === 'muscle') {
      const deltaCm = Math.abs(target - start);
      growthPercent = start > 0 ? Math.round((deltaCm / start) * 100) : 0;
      // Cada 1 cm de perímetro muscular = 35 XP
      growthXp = Math.min(300, Math.round(deltaCm * 35));
    } else {
      growthXp = 50;
    }
  }

  // 3. Factor Tiempo: Cumplir la meta en un menor tiempo otorga más puntos (ej. 1 mes vs 3 meses)
  const createdTime = goal.createdAt ? new Date(goal.createdAt).getTime() : Date.now();
  const completedTime = goal.completedAt ? new Date(goal.completedAt).getTime() : Date.now();
  const daysTaken = Math.max(1, Math.round((completedTime - createdTime) / (1000 * 60 * 60 * 24)));

  let timeXp = 15;
  if (daysTaken <= 30) {
    timeXp = 150; // ¡Velocidad récord! Cumplido en 1 mes o menos
  } else if (daysTaken <= 60) {
    timeXp = 100; // Muy rápido: en 2 meses
  } else if (daysTaken <= 90) {
    timeXp = 60;  // Cumplido en 3 meses
  } else if (daysTaken <= 180) {
    timeXp = 30;  // Cumplido en 6 meses
  } else {
    timeXp = 15;
  }

  // Bonus extra si se cumplió con anticipación antes de la fecha límite fijada
  if (goal.targetDate) {
    const targetLimit = new Date(goal.targetDate + 'T00:00:00').getTime();
    const daysEarly = Math.max(0, Math.round((targetLimit - completedTime) / (1000 * 60 * 60 * 24)));
    if (daysEarly > 0) {
      timeXp += Math.min(80, daysEarly * 2);
    }
  }

  const totalXp = baseXp + growthXp + timeXp;
  return { totalXp, baseXp, growthXp, timeXp, daysTaken, growthPercent };
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
  ingredients?: any[],
  goals?: UserGoal[]
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

  // 7. Metas y Objetivos Cumplidos (Puntaje base + % de Crecimiento/Magnitud + Factor Tiempo)
  let goalsXp = 0;
  let completedGoalsCount = 0;
  if (Array.isArray(goals)) {
    goals.forEach((g) => {
      if (g.completed) {
        completedGoalsCount++;
        const gXp = calculateGoalCompletionXp(g);
        goalsXp += gXp.totalXp;
      }
    });
  }

  const totalXp = foodXp + workoutXp + sleepXp + supplementsXp + measurementsXp + healthXp + goalsXp;

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
    goalsXp,
    completedGoalsCount,
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
    exercises,
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
      ingredients,
      goals
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
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const avatarZoomAnim = useRef(new Animated.Value(0)).current;

  // Amigos & Notificaciones desde el store
  const friends = useStore((s) => s.friends) || SEED_FRIENDS;
  const friendNotifications = useStore((s) => s.friendNotifications) || [];
  const unreadFriendsCount = friendNotifications.filter((n) => !n.read && n.status === 'pending').length;

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
            onPress={() => setShowAvatarModal(true)}
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

            {/* Racha de entrenamientos como badge centrado al fondo del avatar */}
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

            {/* Rango (ancho expandido sin corte de texto) */}
            <View style={styles.heroRankRow}>
              <Ionicons name="sparkles" size={11} color={c1} />
              <Text
                style={[styles.heroRankText, { color: c1, fontFamily: subtitleFont }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
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
            FILA SUPERIOR: METAS (FORMA EN L SI HAY METAS ACTIVAS) & AMIGOS
        ========================================================== */}
        <View style={styles.goalsAndFriendsContainer}>
          {/* Fila superior: Cabecera Metas (izquierda) y Tarjeta Amigos (derecha) */}
          <View style={[styles.topDualRow, { marginBottom: activeGoals.length > 0 ? 0 : 14 }]}>
            {/* Cabecera / Bloque Superior de Metas en la izquierda */}
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => setShowGoalsModal(true)}
              style={[
                styles.topDualCard,
                {
                  backgroundColor: palette.primary,
                  borderColor: palette.primary,
                  borderBottomLeftRadius: activeGoals.length > 0 ? 0 : 18,
                  borderBottomRightRadius: activeGoals.length > 0 ? 0 : 18,
                  borderBottomWidth: 0,
                  borderBottomColor: 'transparent',
                  // Eliminar sombreado inferior en el empalme para que sea un solo bloque
                  shadowOpacity: activeGoals.length > 0 ? 0 : 0.05,
                  elevation: activeGoals.length > 0 ? 0 : 2,
                },
              ]}
            >
              <View style={styles.topDualHeader}>
                <View style={[styles.topDualIconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.22)' }]}>
                  <Ionicons name="trophy" size={14} color="#FFFFFF" />
                </View>
                <View style={[styles.topDualPill, { backgroundColor: 'rgba(255, 255, 255, 0.22)' }]}>
                  <Text style={[styles.topDualPillText, { color: '#FFFFFF', fontFamily: subtitleFont }]}>
                    {activeGoals.length} {activeGoals.length === 1 ? 'meta' : 'metas'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.topDualCardTitle, { color: '#FFFFFF', fontFamily: titleFont }]}>
                Metas
              </Text>

              {activeGoals.length > 0 ? (
                <View style={styles.topDualBodyWrap}>
                  <Text
                    style={[styles.topDualGoalName, { color: '#FFFFFF', fontFamily: subtitleFont }]}
                    numberOfLines={1}
                  >
                    {activeGoals[0].title}
                  </Text>

                  <View style={styles.topDualProgressBarWrap}>
                    <View style={[styles.topDualProgressBg, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}>
                      <View
                        style={[
                          styles.topDualProgressFill,
                          {
                            backgroundColor: '#FDE047',
                            width: `${calculateGoalProgress(activeGoals[0])}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.topDualPercentText, { color: '#FFFFFF', fontFamily: dataFont }]}>
                      {calculateGoalProgress(activeGoals[0])}%
                    </Text>
                  </View>

                  <Text style={[styles.topDualDateHint, { color: 'rgba(255, 255, 255, 0.9)', fontFamily: bodyFont }]}>
                    🗓️ {formatGoalDate(activeGoals[0].targetDate)}
                  </Text>
                </View>
              ) : (
                <View style={styles.topDualBodyWrap}>
                  <Text style={[styles.topDualEmptyDesc, { color: 'rgba(255, 255, 255, 0.9)', fontFamily: bodyFont }]}>
                    Define tu meta a fecha
                  </Text>
                  <View style={[styles.topDualEmptyAction, { backgroundColor: 'rgba(255, 255, 255, 0.22)' }]}>
                    <Text style={[styles.topDualEmptyActionText, { color: '#FFFFFF', fontFamily: subtitleFont }]}>
                      + Establecer
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Bloque Amigos (mitad derecha) */}
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => setShowFriendsModal(true)}
              style={[
                styles.topDualCard,
                {
                  backgroundColor: palette.cardBg,
                  borderColor: palette.border,
                },
              ]}
            >
              <View style={styles.topDualHeader}>
                <View style={[styles.topDualIconCircle, { backgroundColor: `${c2}18` }]}>
                  <Ionicons name="people" size={14} color={c2} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  {unreadFriendsCount > 0 && (
                    <View style={styles.friendNotifBadge}>
                      <Text style={styles.friendNotifBadgeText}>{unreadFriendsCount}</Text>
                    </View>
                  )}
                  <View style={[styles.topDualPill, { backgroundColor: `${c2}18` }]}>
                    <Text style={[styles.topDualPillText, { color: c2, fontFamily: subtitleFont }]}>
                      {friends.length} amigos
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.topDualCardTitle, { color: palette.text, fontFamily: titleFont }]}>
                Amigos
              </Text>

              <View style={styles.topDualBodyWrap}>
                <View style={styles.friendsStackedRow}>
                  {friends.slice(0, 3).map((f, i) => (
                    <View
                      key={f.id}
                      style={[
                        styles.friendMiniDot,
                        {
                          backgroundColor: f.color,
                          marginLeft: i === 0 ? 0 : -8,
                          borderColor: palette.cardBg,
                        },
                      ]}
                    >
                      <Text style={styles.friendMiniDotText}>{f.initials}</Text>
                    </View>
                  ))}
                  <Text style={[styles.friendsActiveText, { color: palette.textSub, fontFamily: bodyFont }]}>
                    {friends.filter((f) => f.todayWorkout && !f.todayWorkout.includes('Descanso')).length} activos hoy
                  </Text>
                </View>

                <Text
                  style={[styles.friendLeadText, { color: palette.text, fontFamily: subtitleFont }]}
                  numberOfLines={1}
                >
                  🔥 {friends[0]?.name?.split(' ')[0] || 'Atleta'} racha {friends[0]?.streak || 0}d
                </Text>

                <Text style={[styles.friendActionLink, { color: c2, fontFamily: subtitleFont }]}>
                  {unreadFriendsCount > 0 ? `Ver solicitudes (${unreadFriendsCount}) ➔` : 'Ver comunidad ➔'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* EXTENSIÓN EN FORMA DE "L" DE METAS HACIA ABAJO Y HACIA LA DERECHA */}
          {activeGoals.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.94}
              onPress={() => setShowGoalsModal(true)}
              style={[
                styles.metasLBaseCard,
                {
                  backgroundColor: palette.primary,
                  borderColor: palette.primary,
                  borderTopWidth: 0,
                  borderTopColor: 'transparent',
                  marginTop: -2, // Empalme exacto sin línea intermedia
                },
              ]}
            >
              <View style={styles.metasLBaseHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="flag" size={13} color="#FFFFFF" />
                  <Text style={[styles.metasLBaseTitle, { color: '#FFFFFF', fontFamily: titleFont }]}>
                    Progreso Detallado de Metas
                  </Text>
                </View>
                <View style={styles.metasLBaseCountBadge}>
                  <Text style={[styles.metasLBaseCountText, { fontFamily: subtitleFont }]}>
                    {activeGoals.length} en curso
                  </Text>
                </View>
              </View>

              <View style={styles.metasLListWrap}>
                {activeGoals.map((goal) => {
                  const progress = calculateGoalProgress(goal);
                  const remaining = getGoalDaysRemaining(goal.targetDate);
                  return (
                    <View key={goal.id} style={styles.metasLItemRow}>
                      <View style={styles.metasLItemTop}>
                        <View style={styles.metasLTag}>
                          <Text style={styles.metasLTagText}>
                            {getGoalCategoryIcon(goal.type)} {goal.categoryLabel || getGoalCategoryLabel(goal.type)}
                          </Text>
                        </View>
                        <Text style={[styles.metasLDatePill, { fontFamily: subtitleFont }]}>
                          🗓️ {formatGoalDate(goal.targetDate)} ({remaining.text})
                        </Text>
                      </View>

                      <Text style={[styles.metasLGoalTitle, { fontFamily: subtitleFont }]} numberOfLines={1}>
                        {goal.title}
                      </Text>

                      <View style={styles.metasLProgressRow}>
                        <Text style={[styles.metasLValuesText, { fontFamily: dataFont }]}>
                          {goal.currentValue !== undefined ? goal.currentValue : '--'} / {goal.targetValue !== undefined ? goal.targetValue : '--'} {goal.unit || ''}
                        </Text>
                        <View style={styles.metasLTrackBg}>
                          <View
                            style={[
                              styles.metasLTrackFill,
                              { width: `${progress}%` },
                            ]}
                          />
                        </View>
                        <Text style={[styles.metasLPctText, { fontFamily: dataFont }]}>
                          {progress}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.metasLFooter}>
                <Text style={[styles.metasLFooterText, { fontFamily: subtitleFont }]}>
                  Toca para gestionar, ajustar o crear nuevas metas ➔
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

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
        weightLogs={weightLogs}
        currentWeight={currentWeight}
        bodyFatLogs={bodyFatLogs}
        measurementLogs={measurementLogs}
        workoutLogs={workoutLogs}
        exercises={exercises}
      />

      {/* Modal de Sección Completa: Amigos, Comunidad y Notificaciones */}
      <FriendsModal
        visible={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
        c1={c1}
        c2={c2}
        palette={palette}
        titleFont={titleFont}
        subtitleFont={subtitleFont}
        bodyFont={bodyFont}
        dataFont={dataFont}
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

            {/* 7. Metas y Retos Cumplidos (Puntaje Dinámico: Base + % Crecimiento + Tiempo) */}
            <View style={[xpStyles.metricCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <View style={[xpStyles.metricIconWrap, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="trophy" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={xpStyles.metricHeaderRow}>
                  <Text style={[xpStyles.metricTitle, { color: palette.text }]}>
                    7. Metas y Retos Cumplidos
                  </Text>
                  <View style={[xpStyles.priorityBadge, { backgroundColor: '#F59E0B20' }]}>
                    <Text style={[xpStyles.priorityBadgeText, { color: '#F59E0B' }]}>Gran Recompensa</Text>
                  </View>
                </View>
                <Text style={[xpStyles.metricPoints, { color: '#F59E0B' }]}>
                  Puntaje Base + % Crecimiento + Factor Tiempo
                </Text>
                <Text style={[xpStyles.metricExpl, { color: palette.textSub }]}>
                  • <Text style={{ fontWeight: '800', color: palette.text }}>Puntaje Base: </Text>Récord/PR (150 XP), % Grasa (140 XP), Tamaño (130 XP), Peso (120 XP).{"\n"}
                  • <Text style={{ fontWeight: '800', color: palette.text }}>% de Crecimiento (+ hasta 350 XP): </Text>A mayor magnitud del logro, más puntos. Pasar de PR 10 a 12 kg (+20%) da menos puntos (+50 XP) que pasar de 10 a 90 kg (+800%, +350 XP).{"\n"}
                  • <Text style={{ fontWeight: '800', color: palette.text }}>Factor Tiempo & Velocidad (+ hasta 230 XP): </Text>Cumplir tu meta en menor tiempo otorga más puntos. Pasar de 90 a 70 kg en 1 mes da +150 XP de velocidad vs +60 XP en 3 meses, más bonus extra si terminas antes de la fecha límite.
                </Text>
                <Text style={[xpStyles.metricUserStat, { color: palette.textSub }]}>
                  Has acumulado: <Text style={{ color: palette.text, fontWeight: '700' }}>{xpBreakdown.goalsXp.toLocaleString()} XP</Text> ({xpBreakdown.completedGoalsCount} metas cumplidas)
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
    paddingHorizontal: 10,
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
    marginRight: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  heroAvatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroStreakBadgeOverlay: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
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
    marginLeft: 2,
    marginRight: 2,
  },
  heroName: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroNickDate: {
    fontSize: 10.5,
    marginTop: 1,
  },
  heroRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
    width: '100%',
    flexShrink: 0,
  },
  heroRankText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 0,
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
  
  // Fila superior doble: Metas (mitad) & Amigos (mitad)
  
  // Contenedor general en L de Metas y Amigos
  goalsAndFriendsContainer: {
    marginBottom: 14,
  },
  metasLBaseCard: {
    width: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    marginTop: -2,
    padding: 13,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  metasLBaseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.18)',
    paddingBottom: 6,
  },
  metasLBaseTitle: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  metasLBaseCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 7,
  },
  metasLBaseCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  metasLListWrap: {
    gap: 8,
  },
  metasLItemRow: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 12,
    padding: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  metasLItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metasLTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  metasLTagText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metasLDatePill: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    fontWeight: '700',
  },
  metasLGoalTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  metasLProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metasLValuesText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    minWidth: 70,
  },
  metasLTrackBg: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  metasLTrackFill: {
    height: '100%',
    backgroundColor: '#FDE047',
    borderRadius: 2.5,
  },
  metasLPctText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    minWidth: 32,
    textAlign: 'right',
  },
  metasLFooter: {
    marginTop: 8,
    alignItems: 'center',
  },
  metasLFooterText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10.5,
    fontWeight: '700',
  },

  topDualRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  topDualCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    minHeight: 142,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topDualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  topDualIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topDualPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
  },
  topDualPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  topDualCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  topDualBodyWrap: {
    marginTop: 2,
  },
  topDualGoalName: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  topDualProgressBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  topDualProgressBg: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  topDualProgressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  topDualPercentText: {
    fontSize: 11,
    fontWeight: '900',
  },
  topDualDateHint: {
    fontSize: 10,
    marginTop: 2,
  },
  topDualEmptyDesc: {
    fontSize: 11,
    marginBottom: 6,
  },
  topDualEmptyAction: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  topDualEmptyActionText: {
    fontSize: 10.5,
    fontWeight: '800',
  },

  // Estilos de Amigos en Home
  friendNotifBadge: {
    backgroundColor: '#EF4444',
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  friendNotifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  friendsStackedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  friendMiniDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendMiniDotText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  friendsActiveText: {
    fontSize: 10,
    marginLeft: 6,
    fontWeight: '600',
  },
  friendLeadText: {
    fontSize: 11.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  friendActionLink: {
    fontSize: 10.5,
    fontWeight: '800',
  },

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

export const PRESET_AVATARS = [
  {
    id: 'pixel_m_bench',
    title: 'Bench Press',
    category: 'hombres',
    accessory: 'Audífonos & Lluvia',
    emoji: '🏋️‍♂️',
    asset: require('../assets/avatars/pixel_bench_press.png'),
  },
  {
    id: 'pixel_m_deadlift',
    title: 'Ren (Deadlift)',
    category: 'hombres',
    accessory: 'Straps & Cinturón',
    emoji: '🔥',
    asset: require('../assets/avatars/pixel_boy_deadlift.jpg'),
  },
  {
    id: 'pixel_m_dumbbell',
    title: 'Kenji (Curl)',
    category: 'hombres',
    accessory: 'Audífonos & Mancuerna',
    emoji: '💪',
    asset: require('../assets/avatars/pixel_boy_dumbbell.jpg'),
  },
  {
    id: 'pixel_m_pullups',
    title: 'Hiro (Pull-ups)',
    category: 'hombres',
    accessory: 'Guantes & Barra',
    emoji: '🥋',
    asset: require('../assets/avatars/pixel_boy_pullups.jpg'),
  },
  {
    id: 'pixel_m_mostmuscular',
    title: 'Kaito (Pose)',
    category: 'hombres',
    accessory: 'Most Muscular',
    emoji: '⚡',
    asset: require('../assets/avatars/pixel_boy_mostmuscular.jpg'),
  },
  {
    id: 'pixel_w_squat',
    title: 'Aoi (Squats)',
    category: 'mujeres',
    accessory: 'Sentadilla Neón',
    emoji: '⚡',
    asset: require('../assets/avatars/pixel_girl_squat.jpg'),
  },
  {
    id: 'pixel_w_shaker',
    title: 'Yuki (Shaker)',
    category: 'mujeres',
    accessory: 'Proteína & Sonrisa',
    emoji: '🌸',
    asset: require('../assets/avatars/pixel_girl_shaker.jpg'),
  },
  {
    id: 'pixel_w_deadlift',
    title: 'Rin (Deadlift)',
    category: 'mujeres',
    accessory: 'Straps & Cuero',
    emoji: '💖',
    asset: require('../assets/avatars/pixel_girl_deadlift.jpg'),
  },
  {
    id: 'pixel_w_dumbbells',
    title: 'Mei (Laterales)',
    category: 'mujeres',
    accessory: 'Hombros & Vuelos',
    emoji: '✨',
    asset: require('../assets/avatars/pixel_girl_dumbbells.jpg'),
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
    case 'body_fat': return '📉';
    case 'pr': return '🏋️';
    case 'muscle': return '📏';
    default: return '🎯';
  }
}

export function getGoalCategoryLabel(type: GoalType): string {
  switch (type) {
    case 'weight': return 'Peso Corporal';
    case 'body_fat': return '% Grasa Corporal';
    case 'pr': return 'Récord / PR';
    case 'muscle': return 'Tamaño Muscular';
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
  zoomAnim?: Animated.Value;
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
  const { width: windowWidth } = useWindowDimensions();
  // Modal inner width: overlay padding 18*2 + card padding 18*2 = 72px
  const availableGridWidth = Math.max(260, Math.min(windowWidth - 72, 380));
  // Exactly 3 items per row with 2 gaps of 8px (16px total)
  const itemCardWidth = Math.floor((availableGridWidth - 16) / 3);
  // Thumbnail size: itemCardWidth - 8px card padding (4px on each side)
  const thumbSize = Math.max(60, itemCardWidth - 8);

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


  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={avatarStyles.overlay}>
        <View
          style={[
            avatarStyles.cardContainer,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.border,
            },
          ]}
        >
          {/* Header con título y botón cerrar */}
          <View style={avatarStyles.headerRow}>
            <Text style={[avatarStyles.headerTitle, { color: palette.text, fontFamily: titleFont }]}>
              Foto de Perfil
            </Text>
            <TouchableOpacity onPress={onClose} style={avatarStyles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color={palette.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* BANNER A TODO LO ANCHO DEL POPUP (NO CIRCULAR) */}
            <View style={avatarStyles.fullWidthBanner}>
              {userProfile?.avatarUri ? (
                <Image
                  source={{ uri: userProfile.avatarUri }}
                  style={avatarStyles.bannerImage}
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  colors={[c1, c2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={avatarStyles.bannerGradient}
                >
                  <Text style={avatarStyles.bannerInitials}>{initials}</Text>
                </LinearGradient>
              )}

              {/* Overlay oscuro en la parte inferior para datos legibles */}
              <LinearGradient
                colors={['transparent', 'rgba(15, 23, 42, 0.88)']}
                style={avatarStyles.bannerOverlay}
              >
                <Text style={[avatarStyles.bannerName, { fontFamily: titleFont }]}>
                  {userName}
                </Text>
                <Text style={[avatarStyles.bannerSub, { fontFamily: bodyFont }]}>
                  <Text style={{ color: '#FDE047', fontWeight: '800' }}>{userNick}</Text> · Nivel {userLevel} ({rankTitle})
                </Text>
              </LinearGradient>
            </View>

            {/* Opciones de Cámara y Galería */}
            <View style={avatarStyles.actionsRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePickCamera}
                style={[avatarStyles.actionBtn, { backgroundColor: palette.isDark ? '#1E293B' : '#F1F5F9', borderColor: palette.border }]}
              >
                <Ionicons name="camera-outline" size={18} color={c1} />
                <Text style={[avatarStyles.actionBtnText, { color: palette.text, fontFamily: subtitleFont }]}>
                  Tomar Foto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePickGallery}
                style={[avatarStyles.actionBtn, { backgroundColor: palette.isDark ? '#1E293B' : '#F1F5F9', borderColor: palette.border }]}
              >
                <Ionicons name="images-outline" size={18} color={c2} />
                <Text style={[avatarStyles.actionBtnText, { color: palette.text, fontFamily: subtitleFont }]}>
                  De Galería
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

            {/* Galería de Avatares Pixel-Art & Anime Gym (Grilla 3x3 - 9 Avatares) */}
            <View style={avatarStyles.presetSection}>
              <View style={avatarStyles.presetHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="sparkles" size={14} color={c1} />
                  <Text style={[avatarStyles.presetSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                    Avatares Pixel-Art & Anime (9 Predeterminados)
                  </Text>
                </View>
                <Text style={[avatarStyles.presetSectionSub, { color: palette.textSub, fontFamily: bodyFont }]}>
                  Toca para seleccionar tu personaje de entrenamiento favorito
                </Text>
              </View>

              {/* Cuadrícula 3x3 de Avatares (Con límites estrictos y proporciones exactas) */}
              <View style={[avatarStyles.presetGrid, { width: availableGridWidth, alignSelf: 'center' }]}>
                {PRESET_AVATARS.map((preset) => {
                  const presetUri = preset.asset ? Image.resolveAssetSource(preset.asset)?.uri : (preset as any).uri;
                  const isSelected = userProfile?.avatarUri === presetUri;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        const targetUri = preset.asset ? Image.resolveAssetSource(preset.asset)?.uri : (preset as any).uri;
                        if (targetUri) onUpdateAvatar(targetUri);
                      }}
                      style={[
                        avatarStyles.presetItemCard,
                        {
                          width: itemCardWidth,
                          maxWidth: itemCardWidth,
                          backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                          borderColor: isSelected ? c1 : palette.border,
                          borderWidth: isSelected ? 2.5 : 1,
                        },
                      ]}
                    >
                      <View style={[avatarStyles.thumbnailWrapper, { width: thumbSize, height: thumbSize }]}>
                        <Image
                          source={preset.asset || { uri: (preset as any).uri }}
                          style={{ width: thumbSize, height: thumbSize, borderRadius: 8 }}
                          resizeMode="cover"
                        />
                      </View>
                      <Text
                        style={[
                          avatarStyles.presetTitle,
                          { color: isSelected ? c1 : palette.text, fontFamily: subtitleFont },
                        ]}
                        numberOfLines={1}
                      >
                        {preset.title}
                      </Text>
                      <Text
                        style={[
                          avatarStyles.presetAccessoryText,
                          { color: palette.textSub, fontFamily: bodyFont },
                        ]}
                        numberOfLines={1}
                      >
                        {preset.emoji} {preset.accessory}
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
                Guardar Foto y Salir
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
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
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    padding: 4,
  },

  // Banner a todo el ancho (no circular)
  fullWidthBanner: {
    width: '100%',
    height: 125,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerInitials: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 30,
    paddingBottom: 12,
  },
  bannerName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  bannerSub: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 2,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 12,
  },
  removeBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  presetSection: {
    marginTop: 6,
    marginBottom: 12,
  },
  presetHeaderRow: {
    marginBottom: 8,
  },
  presetSectionTitle: {
    fontSize: 14.5,
    fontWeight: '900',
  },
  presetSectionSub: {
    fontSize: 11,
    marginTop: 1,
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  filterTabPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '800',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  presetItemCard: {
    borderRadius: 12,
    padding: 4,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  thumbnailWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginBottom: 4,
  },
  presetThumbnail: {
    borderRadius: 8,
  },
  presetTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  presetAccessoryText: {
    fontSize: 8,
    marginTop: 1,
    textAlign: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtn: {
    paddingVertical: 12,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
  },
});

/* ==========================================================
   MODAL: CONFIGURACIÓN & GESTIÓN DE METAS CON FECHAS LÍMITE
========================================================== */
// ==========================================================
// METAS PREESTABLECIDAS SUGERIDAS (ACCESO RÁPIDO)
// ==========================================================
const QUICK_PRESET_GOALS = [
  {
    icon: '🏋️',
    type: 'pr' as GoalType,
    variableKey: 'Press de Banca Plano',
    category: 'Récord / PR',
    title: 'Club de los 100 kg en Press Banca',
    targetVal: '100',
    unit: 'kg',
    timeline: '3 meses',
    targetDateOffsetDays: 90,
  },
  {
    icon: '📉',
    type: 'body_fat' as GoalType,
    category: '% Grasa',
    title: 'Definición a 12% de Grasa Corporal',
    targetVal: '12',
    unit: '%',
    timeline: '2 meses',
    targetDateOffsetDays: 60,
  },
  {
    icon: '📏',
    type: 'muscle' as GoalType,
    variableKey: 'right_arm',
    category: 'Tamaño Muscular',
    title: 'Bíceps a 40 cm de Contorno',
    targetVal: '40',
    unit: 'cm',
    timeline: '3 meses',
    targetDateOffsetDays: 90,
  },
  {
    icon: '⚖️',
    type: 'weight' as GoalType,
    category: 'Peso Corporal',
    title: 'Volumen Limpio: Alcanzar 80 kg',
    targetVal: '80',
    unit: 'kg',
    timeline: '3 meses',
    targetDateOffsetDays: 90,
  },
  {
    icon: '🏋️',
    type: 'pr' as GoalType,
    variableKey: 'Sentadilla con Barra',
    category: 'Récord / PR',
    title: 'Sentadilla Profunda a 140 kg',
    targetVal: '140',
    unit: 'kg',
    timeline: '3 meses',
    targetDateOffsetDays: 90,
  },
  {
    icon: '📏',
    type: 'muscle' as GoalType,
    variableKey: 'waist',
    category: 'Tamaño (Cintura)',
    title: 'Reducir Cintura a 78 cm',
    targetVal: '78',
    unit: 'cm',
    timeline: '2 meses',
    targetDateOffsetDays: 60,
  },
  {
    icon: '🏋️',
    type: 'pr' as GoalType,
    variableKey: 'Peso Muerto',
    category: 'Récord / PR',
    title: 'Peso Muerto a 160 kg',
    targetVal: '160',
    unit: 'kg',
    timeline: '4 meses',
    targetDateOffsetDays: 120,
  },
];

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
  weightLogs = {},
  currentWeight = null,
  bodyFatLogs = {},
  measurementLogs = {},
  workoutLogs = {},
  exercises = [],
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
  weightLogs?: Record<string, number>;
  currentWeight?: number | null;
  bodyFatLogs?: Record<string, number>;
  measurementLogs?: Record<string, DayMeasurements>;
  workoutLogs?: Record<string, WorkoutExercise[]>;
  exercises?: Exercise[];
}) {
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'new'>('active');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // Campos del formulario
  const [goalType, setGoalType] = useState<GoalType>('weight');
  const [selectedVariableKey, setSelectedVariableKey] = useState<string>('weight');
  const [goalTitle, setGoalTitle] = useState('');
  const [targetDate, setTargetDate] = useState('2026-02-14');
  const [startVal, setStartVal] = useState('');
  const [currentVal, setCurrentVal] = useState('');
  const [targetVal, setTargetVal] = useState('');
  const [unit, setUnit] = useState('kg');
  const [notes, setNotes] = useState('');
  const [autoFilledNotice, setAutoFilledNotice] = useState<string | null>(null);

  const activeGoals = goals.filter((g) => !g.completed);
  const completedGoals = goals.filter((g) => g.completed);

  // Lista de medidas musculares disponibles (Tamaño)
  const MUSCLE_PARTS: { key: BodyPartKey; label: string }[] = [
    { key: 'right_arm', label: 'Bíceps / Brazo' },
    { key: 'chest', label: 'Pecho / Torso' },
    { key: 'waist', label: 'Cintura' },
    { key: 'right_thigh', label: 'Cuádriceps / Muslo' },
    { key: 'back', label: 'Espalda' },
    { key: 'glutes', label: 'Glúteos' },
    { key: 'right_calf', label: 'Pantorrilla' },
    { key: 'right_forearm', label: 'Antebrazo' },
  ];

  // Lista de ejercicios para PR de fuerza (combina populares y ejercicios de la store)
  const defaultPopularExercises = [
    { id: 'bench_press', name: 'Press de Banca Plano' },
    { id: 'squat', name: 'Sentadilla con Barra' },
    { id: 'deadlift', name: 'Peso Muerto' },
    { id: 'military_press', name: 'Press Militar' },
    { id: 'barbell_row', name: 'Remo con Barra' },
    { id: 'pull_ups', name: 'Dominadas Lastradas' },
    { id: 'incline_bench', name: 'Press Inclinado con Mancuernas' },
    { id: 'biceps_curl', name: 'Curl de Bíceps con Barra' },
  ];

  const availableExercises = [
    ...defaultPopularExercises,
    ...(Array.isArray(exercises)
      ? exercises
          .filter((e) => !defaultPopularExercises.some((d) => d.name.toLowerCase() === e.name.toLowerCase()))
          .map((e) => ({ id: e.id, name: e.name }))
      : []),
  ];

  // ==========================================================
  // FUNCIÓN DE AUTOLLENADO BASADA EN DATOS REALES DE LA VARIABLE
  // ==========================================================
  const handleSelectVariable = (type: GoalType, variableKey?: string) => {
    setGoalType(type);

    if (type === 'weight') {
      setSelectedVariableKey('weight');
      const dates = Object.keys(weightLogs || {}).sort();
      const earliest = dates.length > 0 ? weightLogs[dates[0]] : currentWeight || 70;
      const latest = currentWeight || (dates.length > 0 ? weightLogs[dates[dates.length - 1]] : 70);
      const s = Number(earliest).toFixed(1).replace('.0', '');
      const c = Number(latest).toFixed(1).replace('.0', '');
      const targetSuggestion = Math.round(Number(c) + 5);

      setStartVal(s);
      setCurrentVal(c);
      setTargetVal(String(targetSuggestion));
      setUnit('kg');
      setGoalTitle(`Alcanzar ${targetSuggestion} kg de peso corporal`);
      setAutoFilledNotice(`✓ Historial cargado: Peso inicial: ${s} kg | Peso actual: ${c} kg`);
    } else if (type === 'body_fat') {
      setSelectedVariableKey('body_fat');
      const dates = Object.keys(bodyFatLogs || {}).sort();
      const earliest = dates.length > 0 ? bodyFatLogs[dates[0]] : 18;
      const latest = dates.length > 0 ? bodyFatLogs[dates[dates.length - 1]] : 15;
      const s = Number(earliest).toFixed(1).replace('.0', '');
      const c = Number(latest).toFixed(1).replace('.0', '');
      const targetSuggestion = Math.max(Math.round(Number(c) - 2), 10);

      setStartVal(s);
      setCurrentVal(c);
      setTargetVal(String(targetSuggestion));
      setUnit('%');
      setGoalTitle(`Reducir a ${targetSuggestion}% de grasa corporal`);
      setAutoFilledNotice(`✓ Historial cargado: Grasa inicial: ${s}% | Grasa actual: ${c}%`);
    } else if (type === 'pr') {
      // Si no viene variableKey, toma por defecto el primer ejercicio de la lista
      const exName = variableKey || availableExercises[0]?.name || 'Press de Banca Plano';
      setSelectedVariableKey(exName);

      // Escanear workoutLogs para este ejercicio
      let firstWeight: number | null = null;
      let maxWeight = 0;
      let hasData = false;

      const dates = Object.keys(workoutLogs || {}).sort();
      dates.forEach((date) => {
        const dayExercises = workoutLogs[date] || [];
        dayExercises.forEach((wEx: any) => {
          const match =
            wEx.exerciseId === exName ||
            (wEx.name && wEx.name.toLowerCase() === exName.toLowerCase()) ||
            exercises.find((e) => e.id === wEx.exerciseId)?.name.toLowerCase() === exName.toLowerCase();

          if (match && Array.isArray(wEx.sets)) {
            wEx.sets.forEach((set: any) => {
              const w = Number(set.weight);
              if (!isNaN(w) && w > 0) {
                hasData = true;
                if (firstWeight === null) firstWeight = w;
                if (w > maxWeight) maxWeight = w;
              }
            });
          }
        });
      });

      const s = hasData && firstWeight !== null ? String(firstWeight) : '60';
      const c = hasData && maxWeight > 0 ? String(maxWeight) : s;
      const targetSuggestion = hasData && maxWeight > 0 ? String(Math.round(maxWeight * 1.1)) : '80';

      setStartVal(s);
      setCurrentVal(c);
      setTargetVal(targetSuggestion);
      setUnit('kg');
      setGoalTitle(`Superar PR en ${exName} (${targetSuggestion} kg)`);
      setAutoFilledNotice(
        hasData
          ? `✓ Historial cargado: Primer registro: ${s} kg | PR Máximo actual: ${c} kg`
          : `Configura tu PR para ${exName} (ej. inicio ${s} kg, meta ${targetSuggestion} kg)`
      );
    } else if (type === 'muscle') {
      // Si no viene variableKey, toma por defecto el primer músculo (Bíceps)
      const partKey = (variableKey || MUSCLE_PARTS[0].key) as BodyPartKey;
      setSelectedVariableKey(partKey);
      const partObj = MUSCLE_PARTS.find((p) => p.key === partKey) || MUSCLE_PARTS[0];

      let firstMeasure: number | null = null;
      let latestMeasure: number | null = null;
      let hasData = false;

      const dates = Object.keys(measurementLogs || {}).sort();
      dates.forEach((date) => {
        const day = measurementLogs[date];
        if (day && typeof day[partKey] === 'number' && (day[partKey] as number) > 0) {
          hasData = true;
          const val = day[partKey] as number;
          if (firstMeasure === null) firstMeasure = val;
          latestMeasure = val;
        }
      });

      const s = hasData && firstMeasure !== null ? String(firstMeasure) : (partKey === 'waist' ? '82' : '36');
      const c = hasData && latestMeasure !== null ? String(latestMeasure) : s;
      const isWaist = partKey === 'waist';
      const targetSuggestion = isWaist
        ? String(Math.max(Number(c) - 4, 70))
        : String(Math.round((Number(c) + 2.5) * 10) / 10);

      setStartVal(s);
      setCurrentVal(c);
      setTargetVal(targetSuggestion);
      setUnit('cm');
      setGoalTitle(
        isWaist
          ? `Reducir cintura a ${targetSuggestion} cm`
          : `Aumentar ${partObj.label} a ${targetSuggestion} cm`
      );
      setAutoFilledNotice(
        hasData
          ? `✓ Historial cargado: Medida inicial: ${s} cm | Medida actual: ${c} cm`
          : `Configura tu objetivo para ${partObj.label} (ej. actual ${c} cm, meta ${targetSuggestion} cm)`
      );
    } else {
      setSelectedVariableKey('custom');
      setAutoFilledNotice(null);
    }
  };

  // Aplicar sugerencia preestablecida
  const applyQuickPreset = (preset: typeof QUICK_PRESET_GOALS[0]) => {
    handleSelectVariable(preset.type, preset.variableKey);
    setTargetVal(preset.targetVal);
    setUnit(preset.unit);
    setGoalTitle(preset.title);
    const futureDate = new Date(Date.now() + preset.targetDateOffsetDays * 86400000)
      .toISOString()
      .split('T')[0];
    setTargetDate(futureDate);
  };

  // Iniciar creación o edición
  const resetForm = () => {
    setEditingGoalId(null);
    setGoalType('weight');
    setSelectedVariableKey('weight');
    setGoalTitle('');
    setTargetDate('2026-02-14');
    setStartVal('');
    setCurrentVal('');
    setTargetVal('');
    setUnit('kg');
    setNotes('');
    setAutoFilledNotice(null);
    handleSelectVariable('weight');
  };

  const handleStartEdit = (g: UserGoal) => {
    setEditingGoalId(g.id);
    setGoalType(g.type);
    setSelectedVariableKey(g.bodyPart || g.exerciseName || g.type);
    setGoalTitle(g.title);
    setTargetDate(g.targetDate);
    setStartVal(g.startValue !== undefined ? String(g.startValue) : '');
    setCurrentVal(g.currentValue !== undefined ? String(g.currentValue) : '');
    setTargetVal(g.targetValue !== undefined ? String(g.targetValue) : '');
    setUnit(g.unit || 'kg');
    setNotes(g.notes || '');
    setAutoFilledNotice(null);
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
        exerciseName: goalType === 'pr' ? selectedVariableKey : undefined,
        bodyPart: goalType === 'muscle' ? (selectedVariableKey as BodyPartKey) : undefined,
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
        exerciseName: goalType === 'pr' ? selectedVariableKey : undefined,
        bodyPart: goalType === 'muscle' ? (selectedVariableKey as BodyPartKey) : undefined,
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
                Fija metas con fechas límite y gana XP por cada reto superado
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
              /* FORMULARIO CREAR / EDITAR META CON SELECTOR DE VARIABLE Y AUTOLLENADO */
              <View style={goalModalStyles.formWrap}>
                {/* ==========================================================
                    METAS SUGERIDAS / PREESTABLECIDAS (ARRIBA DEL FORMULARIO)
                ========================================================== */}
                <View style={goalModalStyles.presetSectionWrap}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="bulb-outline" size={15} color="#F59E0B" />
                    <Text style={[goalModalStyles.presetSectionTitle, { color: palette.text, fontFamily: subtitleFont }]}>
                      Metas Sugeridas / Preestablecidas
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                    {QUICK_PRESET_GOALS.map((preset, idx) => (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.85}
                        onPress={() => applyQuickPreset(preset)}
                        style={[
                          goalModalStyles.quickPresetCard,
                          {
                            backgroundColor: palette.bg,
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <View style={goalModalStyles.quickPresetTop}>
                          <Text style={{ fontSize: 14 }}>{preset.icon}</Text>
                          <Text style={[goalModalStyles.quickPresetCategory, { color: c1, fontFamily: subtitleFont }]}>
                            {preset.category}
                          </Text>
                        </View>
                        <Text style={[goalModalStyles.quickPresetTitle, { color: palette.text, fontFamily: subtitleFont }]} numberOfLines={1}>
                          {preset.title}
                        </Text>
                        <Text style={[goalModalStyles.quickPresetTarget, { color: palette.textSub, fontFamily: dataFont }]}>
                          Meta: {preset.targetVal} {preset.unit} · {preset.timeline}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <Text style={[goalModalStyles.formSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                  {editingGoalId ? 'Editar Meta' : 'Configurar Nueva Meta'}
                </Text>

                {/* 1. Tipo de Objetivo (Peso, % Grasa, Récord / PR, Tamaño, Otro) */}
                <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                  1. Tipo de Objetivo
                </Text>
                <View style={goalModalStyles.typeSelectorRow}>
                  {[
                    { key: 'weight', label: 'Peso', icon: 'scale-outline' },
                    { key: 'body_fat', label: '% Grasa', icon: 'trending-down-outline' },
                    { key: 'pr', label: 'Récord / PR', icon: 'barbell-outline' },
                    { key: 'muscle', label: 'Tamaño', icon: 'body-outline' },
                    { key: 'custom', label: 'Otro', icon: 'trophy-outline' },
                  ].map((t) => {
                    const active = goalType === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        activeOpacity={0.85}
                        onPress={() => {
                          // Al seleccionar, pasa la variable por defecto para que se autollene de inmediato
                          if (t.key === 'pr') {
                            handleSelectVariable('pr', availableExercises[0]?.name);
                          } else if (t.key === 'muscle') {
                            handleSelectVariable('muscle', MUSCLE_PARTS[0].key);
                          } else {
                            handleSelectVariable(t.key as GoalType);
                          }
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

                {/* 2. Selector de Variable Relacionada (PR de Fuerza) */}
                {goalType === 'pr' && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      2. Selecciona el Ejercicio a Controlar (PR de Fuerza):
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                      {availableExercises.map((ex) => {
                        const isSelected = selectedVariableKey === ex.name;
                        return (
                          <TouchableOpacity
                            key={ex.id + ex.name}
                            activeOpacity={0.85}
                            onPress={() => handleSelectVariable('pr', ex.name)}
                            style={[
                              goalModalStyles.varPill,
                              isSelected && { backgroundColor: c1, borderColor: c1 },
                              !isSelected && { backgroundColor: palette.bg, borderColor: palette.border },
                            ]}
                          >
                            <Ionicons
                              name="barbell"
                              size={13}
                              color={isSelected ? '#FFFFFF' : c1}
                            />
                            <Text
                              style={[
                                goalModalStyles.varPillText,
                                { color: isSelected ? '#FFFFFF' : palette.text, fontFamily: subtitleFont },
                              ]}
                            >
                              {ex.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* 2. Selector de Variable Relacionada (Tamaño Muscular) */}
                {goalType === 'muscle' && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      2. Selecciona la Medida / Músculo a Controlar:
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                      {MUSCLE_PARTS.map((part) => {
                        const isSelected = selectedVariableKey === part.key;
                        return (
                          <TouchableOpacity
                            key={part.key}
                            activeOpacity={0.85}
                            onPress={() => handleSelectVariable('muscle', part.key)}
                            style={[
                              goalModalStyles.varPill,
                              isSelected && { backgroundColor: c1, borderColor: c1 },
                              !isSelected && { backgroundColor: palette.bg, borderColor: palette.border },
                            ]}
                          >
                            <Ionicons
                              name="body"
                              size={13}
                              color={isSelected ? '#FFFFFF' : c1}
                            />
                            <Text
                              style={[
                                goalModalStyles.varPillText,
                                { color: isSelected ? '#FFFFFF' : palette.text, fontFamily: subtitleFont },
                              ]}
                            >
                              {part.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Banner de Aviso de Autollenado de Datos */}
                {autoFilledNotice && (
                  <View style={[goalModalStyles.autoNoticeCard, { backgroundColor: `${c1}15`, borderColor: `${c1}40` }]}>
                    <Ionicons name="sparkles" size={14} color={c1} />
                    <Text style={[goalModalStyles.autoNoticeText, { color: palette.text, fontFamily: subtitleFont }]}>
                      {autoFilledNotice}
                    </Text>
                  </View>
                )}

                {/* Título de la Meta */}
                <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont, marginTop: 10 }]}>
                  Título o Descripción de la Meta
                </Text>
                <TextInput
                  value={goalTitle}
                  onChangeText={setGoalTitle}
                  placeholder="Ej. Subir a 80 kg para el 14 de febrero..."
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

                {/* Valores Numéricos (Inicio, Actual, Objetivo) autollenados */}
                <View style={goalModalStyles.valuesGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Valor Inicio
                    </Text>
                    <TextInput
                      value={startVal}
                      onChangeText={setStartVal}
                      placeholder="Ej. 70"
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
                      Valor Actual
                    </Text>
                    <TextInput
                      value={currentVal}
                      onChangeText={setCurrentVal}
                      placeholder="Ej. 74"
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
                      Meta Objetivo
                    </Text>
                    <TextInput
                      value={targetVal}
                      onChangeText={setTargetVal}
                      placeholder="Ej. 80"
                      placeholderTextColor={palette.textSub}
                      keyboardType="numeric"
                      style={[
                        goalModalStyles.numInput,
                        {
                          color: c1,
                          backgroundColor: palette.bg,
                          borderColor: c1,
                          borderWidth: 1.5,
                          fontFamily: dataFont,
                        },
                      ]}
                    />
                  </View>

                  <View style={{ width: 62 }}>
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
                          fontFamily: dataFont,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Fecha Límite */}
                <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont, marginTop: 14 }]}>
                  Fecha Objetivo (AAAA-MM-DD)
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

                {/* Atajos de Fecha */}
                <View style={goalModalStyles.quickDateRow}>
                  {[
                    { label: '14 de Feb (San Valentín)', val: '2026-02-14' },
                    { label: '1 Mes', val: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] },
                    { label: '3 Meses', val: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0] },
                    { label: 'Fin de Año', val: '2026-12-31' },
                  ].map((d, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setTargetDate(d.val)}
                      style={[
                        goalModalStyles.quickDatePill,
                        targetDate === d.val && { backgroundColor: c1, borderColor: c1 },
                        targetDate !== d.val && { backgroundColor: palette.bg, borderColor: palette.border },
                      ]}
                    >
                      <Text
                        style={[
                          goalModalStyles.quickDateText,
                          { color: targetDate === d.val ? '#FFFFFF' : palette.textSub, fontFamily: subtitleFont },
                        ]}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Notas / Plan */}
                <Text style={[goalModalStyles.fieldLabel, { color: palette.textSub, fontFamily: subtitleFont, marginTop: 14 }]}>
                  Estrategia / Notas (Opcional)
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Ej. Superávit de 300 kcal, subir peso en banca progresivo cada 2 semanas..."
                  placeholderTextColor={palette.textSub}
                  multiline
                  numberOfLines={2}
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

                {/* Botón Guardar */}
                <View style={goalModalStyles.formActionsRow}>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={handleSaveGoal}
                    style={[goalModalStyles.saveBtn, { backgroundColor: c1 }]}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={[goalModalStyles.saveBtnText, { fontFamily: titleFont }]}>
                      {editingGoalId ? 'Actualizar Meta' : 'Establecer y Fijar Meta'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* LISTADO DE METAS ACTIVAS O CUMPLIDAS */
              <View style={goalModalStyles.listWrap}>
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
                            backgroundColor: palette.bg,
                            borderColor: goal.completed ? c1 : palette.border,
                          },
                        ]}
                      >
                        {/* Cabecera de la meta */}
                        <View style={goalModalStyles.goalCardHeader}>
                          <View style={goalModalStyles.categoryBadge}>
                            <Text style={goalModalStyles.categoryIcon}>{getGoalCategoryIcon(goal.type)}</Text>
                            <Text style={[goalModalStyles.categoryLabel, { color: palette.text, fontFamily: subtitleFont }]}>
                              {goal.categoryLabel || getGoalCategoryLabel(goal.type)}
                            </Text>
                          </View>

                          <View style={goalModalStyles.goalHeaderActions}>
                            <TouchableOpacity
                              onPress={() => onToggleCompleted(goal.id)}
                              style={[
                                goalModalStyles.completeCheckBtn,
                                goal.completed && { backgroundColor: c1, borderColor: c1 },
                                !goal.completed && { borderColor: palette.border },
                              ]}
                            >
                              <Ionicons
                                name={goal.completed ? 'checkmark' : 'ellipse-outline'}
                                size={14}
                                color={goal.completed ? '#FFFFFF' : palette.textSub}
                              />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleStartEdit(goal)}
                              style={goalModalStyles.actionIconBtn}
                              hitSlop={6}
                            >
                              <Ionicons name="create-outline" size={17} color={palette.textSub} />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleDelete(goal.id, goal.title)}
                              style={goalModalStyles.actionIconBtn}
                              hitSlop={6}
                            >
                              <Ionicons name="trash-outline" size={17} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Título de la meta */}
                        <Text style={[goalModalStyles.goalCardTitle, { color: palette.text, fontFamily: titleFont }]}>
                          {goal.title}
                        </Text>

                        {/* Fecha Límite y Días Restantes */}
                        <View style={goalModalStyles.dateRemainingRow}>
                          <Ionicons
                            name="calendar-outline"
                            size={14}
                            color={remaining.isPast && !goal.completed ? '#EF4444' : palette.textSub}
                          />
                          <Text
                            style={[
                              goalModalStyles.dateRemainingText,
                              {
                                color: remaining.isPast && !goal.completed ? '#EF4444' : palette.textSub,
                                fontFamily: subtitleFont,
                              },
                            ]}
                          >
                            Meta: {formatGoalDate(goal.targetDate)} · {remaining.text}
                          </Text>
                        </View>

                        {/* Barra de Progreso */}
                        <View style={goalModalStyles.progressSection}>
                          <View style={goalModalStyles.progressValuesRow}>
                            <Text style={[goalModalStyles.progressValueText, { color: palette.textSub, fontFamily: dataFont }]}>
                              Inicio: {goal.startValue !== undefined ? goal.startValue : '--'} {goal.unit || ''}
                            </Text>
                            <Text style={[goalModalStyles.progressValueText, { color: c1, fontWeight: '800', fontFamily: dataFont }]}>
                              Actual: {goal.currentValue !== undefined ? goal.currentValue : '--'} {goal.unit || ''}
                            </Text>
                            <Text style={[goalModalStyles.progressValueText, { color: palette.textSub, fontFamily: dataFont }]}>
                              Objetivo: {goal.targetValue !== undefined ? goal.targetValue : '--'} {goal.unit || ''}
                            </Text>
                          </View>

                          <View style={[goalModalStyles.progressTrack, { backgroundColor: palette.isDark ? '#334155' : 'rgba(203, 213, 225, 0.4)' }]}>
                            <View
                              style={[
                                goalModalStyles.progressFill,
                                {
                                  width: `${progress}%`,
                                  backgroundColor: goal.completed ? c1 : c2,
                                },
                              ]}
                            />
                          </View>

                          <View style={goalModalStyles.progressPercentRow}>
                            <Text style={[goalModalStyles.progressPercentText, { color: goal.completed ? c1 : palette.text, fontFamily: dataFont }]}>
                              {progress}% {goal.completed ? '¡Cumplida! 🏆' : 'completado'}
                            </Text>
                          </View>
                        </View>

                        {/* Notas si las hay */}
                        {!!goal.notes && (
                          <View style={[goalModalStyles.notesBox, { borderColor: palette.border }]}>
                            <Text style={[goalModalStyles.notesText, { color: palette.textSub, fontFamily: bodyFont }]}>
                              💡 {goal.notes}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <View style={goalModalStyles.emptyWrap}>
                    <Ionicons name="trophy-outline" size={44} color={palette.textSub} />
                    <Text style={[goalModalStyles.emptyTitle, { color: palette.text, fontFamily: titleFont }]}>
                      {activeTab === 'active' ? 'No tienes metas activas' : 'Aún no has completado metas'}
                    </Text>
                    <Text style={[goalModalStyles.emptyDesc, { color: palette.textSub, fontFamily: bodyFont }]}>
                      {activeTab === 'active'
                        ? 'Establece un objetivo de peso, récord personal de fuerza o medidas con fecha límite.'
                        : 'Cuando alcances tus objetivos, márcalos como cumplidos para verlos aquí.'}
                    </Text>
                    {activeTab === 'active' && (
                      <TouchableOpacity
                        onPress={() => {
                          resetForm();
                          setActiveTab('new');
                        }}
                        style={[goalModalStyles.createFirstBtn, { backgroundColor: c1 }]}
                      >
                        <Text style={[goalModalStyles.createFirstBtnText, { fontFamily: titleFont }]}>
                          + Establecer mi primera meta
                        </Text>
                      </TouchableOpacity>
                    )}
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
  presetSectionWrap: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(203, 213, 225, 0.25)',
  },
  presetSectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  quickPresetCard: {
    width: 175,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  quickPresetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  quickPresetCategory: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  quickPresetTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  quickPresetTarget: {
    fontSize: 10.5,
  },
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
  varPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 11,
    borderWidth: 1,
  },
  varPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  autoNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    marginBottom: 10,
    marginTop: 2,
  },
  autoNoticeText: {
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
    lineHeight: 16,
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
    marginTop: 18,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  listWrap: {
    gap: 12,
    paddingTop: 4,
  },
  goalCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.4)',
  },
  categoryIcon: {
    fontSize: 13,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  goalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  completeCheckBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBtn: {
    padding: 4,
  },
  goalCardTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  dateRemainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  dateRemainingText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressSection: {
    marginTop: 4,
  },
  progressValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressValueText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentRow: {
    alignItems: 'flex-end',
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: '900',
  },
  notesBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  notesText: {
    fontSize: 11,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyDesc: {
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

const friendModalStyles = StyleSheet.create({
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
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    fontSize: 11.5,
    fontWeight: '800',
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  friendCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarDot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDotText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  friendName: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  streakPillText: {
    fontSize: 10.5,
    fontWeight: '900',
  },
  friendSub: {
    fontSize: 11,
    marginTop: 1,
  },
  friendWorkoutText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  cheerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 8,
  },
  cheerBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  rankingDesc: {
    fontSize: 12,
    marginBottom: 6,
  },
  rankRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
  },
  medalBadge: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDotSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  avatarDotTextSmall: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  rankStreakBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  rankStreakVal: {
    fontSize: 15,
    fontWeight: '900',
  },
  rankStreakDays: {
    fontSize: 11,
  },
  addSectionWrap: {
    paddingTop: 8,
  },
  addSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  addSectionSub: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  addInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
  },
  addConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  addConfirmText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
