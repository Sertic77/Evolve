import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Platform,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, GRADIENTS, fmt, registerThemeSheet } from './theme';
import {
  useStore,
  dateKey,
  uid,
  Exercise,
  WorkoutExercise,
  WorkoutSet,
} from './store';
import { DateSelector, PrimaryButton, s } from './components';

const MUSCLE_GROUPS = ['Todos', 'Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core', 'CrossFit', 'Cardio'];

/* ==========================================================
   TEMAS DINÁMICOS POR GRUPO MUSCULAR & TIPO DE MÉTRICA
========================================================== */
export type StatTheme = {
  primary: string;
  gradient: [string, string];
  bgGradient: [string, string];
  icon: any;
  badgeLabel: string;
};

export function getMuscleTheme(muscleGroup: string): StatTheme {
  const g = (muscleGroup || '').toLowerCase();
  if (g.includes('crossfit') || g.includes('wod')) {
    return {
      primary: '#F97316', // Flame Orange
      gradient: ['#FB923C', '#EA580C'],
      bgGradient: ['rgba(249, 115, 22, 0.22)', 'rgba(234, 88, 12, 0.05)'],
      icon: 'flame-outline',
      badgeLabel: 'CROSSFIT & WOD',
    };
  }
  if (g.includes('cardio') || g.includes('correr') || g.includes('bici')) {
    return {
      primary: '#06B6D4', // Electric Cyan
      gradient: ['#22D3EE', '#0891B2'],
      bgGradient: ['rgba(6, 182, 212, 0.22)', 'rgba(8, 145, 178, 0.05)'],
      icon: 'bicycle-outline',
      badgeLabel: 'CARDIO & RESISTENCIA',
    };
  }
  if (g.includes('pecho')) {
    return {
      primary: '#EC4899', // Sakura Pink
      gradient: ['#F472B6', '#DB2777'],
      bgGradient: ['rgba(244, 114, 182, 0.22)', 'rgba(219, 39, 119, 0.05)'],
      icon: 'heart-outline',
      badgeLabel: 'PECHO & EMPUJE',
    };
  }
  if (g.includes('espalda')) {
    return {
      primary: '#0284C7', // Oceanic Cyan
      gradient: ['#38BDF8', '#0369A1'],
      bgGradient: ['rgba(14, 165, 233, 0.22)', 'rgba(2, 132, 199, 0.05)'],
      icon: 'shield-outline',
      badgeLabel: 'ESPALDA & TRACCIÓN',
    };
  }
  if (g.includes('pierna')) {
    return {
      primary: '#059669', // Emerald Mint
      gradient: ['#34D399', '#047857'],
      bgGradient: ['rgba(16, 185, 129, 0.22)', 'rgba(5, 150, 105, 0.05)'],
      icon: 'flash-outline',
      badgeLabel: 'PIERNAS & POTENCIA',
    };
  }
  if (g.includes('hombro')) {
    return {
      primary: '#D97706', // Solar Amber
      gradient: ['#FBBF24', '#B45309'],
      bgGradient: ['rgba(245, 158, 11, 0.22)', 'rgba(217, 119, 6, 0.05)'],
      icon: 'diamond-outline',
      badgeLabel: 'HOMBROS 3D',
    };
  }
  if (g.includes('brazo')) {
    return {
      primary: '#7C3AED', // Royal Violet
      gradient: ['#A78BFA', '#6D28D9'],
      bgGradient: ['rgba(139, 92, 246, 0.22)', 'rgba(124, 58, 237, 0.05)'],
      icon: 'barbell-outline',
      badgeLabel: 'BRAZOS & FUERZA',
    };
  }
  if (g.includes('core')) {
    return {
      primary: '#E11D48', // Ruby Coral
      gradient: ['#FB7185', '#BE123C'],
      bgGradient: ['rgba(244, 63, 94, 0.22)', 'rgba(225, 29, 72, 0.05)'],
      icon: 'disc-outline',
      badgeLabel: 'CORE & CONTROL',
    };
  }
  return {
    primary: '#8B5CF6',
    gradient: ['#8B5CF6', '#EC4899'],
    bgGradient: ['rgba(139, 92, 246, 0.22)', 'rgba(236, 72, 153, 0.05)'],
    icon: 'trophy-outline',
    badgeLabel: 'ENTRENAMIENTO',
  };
}

/* Estimación de Kcal quemadas por serie de ejercicio (Base para Smartwatch) */
export function estimateSetKcal(exercise: Exercise | undefined, s: WorkoutSet): number {
  if (s.timeSeconds && s.timeSeconds > 0) {
    // Estimación cardio/tiempo: ~9-12 kcal por minuto
    const minutes = s.timeSeconds / 60;
    return Math.round(minutes * 10.5);
  }
  const reps = Math.max(1, s.reps || 0);
  const weight = Math.max(0, s.weight || 0);
  const group = (exercise?.muscleGroup || '').toLowerCase();

  let factor = 1.0;
  if (group.includes('pierna')) factor = 1.45;
  else if (group.includes('espalda')) factor = 1.35;
  else if (group.includes('pecho')) factor = 1.25;
  else if (group.includes('hombro')) factor = 1.15;
  else if (group.includes('core')) factor = 1.1;
  else if (group.includes('crossfit')) factor = 1.5;
  else if (group.includes('cardio')) factor = 1.4;

  const work = 7.0 + (weight * reps * 0.0055);
  return Math.round(work * factor);
}

/* ==========================================================
   PANTALLA PRINCIPAL DE ENTRENAMIENTO
========================================================== */
export default function TrainScreen() {
  const [tab, setTab] = useState(0); // 0: Registrar, 1: Estadísticas
  const [date, setDate] = useState(new Date());
  const key = dateKey(date);

  const { exercises, workoutLogs, setDayWorkout, upsertExercise } = useStore();
  const dayExercises = workoutLogs[key] ?? [];

  // Ejercicio seleccionado para ver estadísticas detalladas (null = rotación automática)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  // Rango de fechas para estadísticas (en días hacia atrás, null = todo el tiempo)
  const [timeRangeDays, setTimeRangeDays] = useState<number | null>(30); // 7, 30, 90, null
  const [rangeModalOpen, setRangeModalOpen] = useState(false);

  // Modal para seleccionar ejercicio al registrar
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState<string | null>(null);

  // Modal para crear/editar ejercicio en la biblioteca
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  // Animación suave de transición de contenido entre pestañas
  const contentFadeAnim = useRef(new Animated.Value(1)).current;
  const contentSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    contentFadeAnim.setValue(0);
    contentSlideAnim.setValue(6);
    Animated.parallel([
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentSlideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [tab]);

  // Manejo de agregar ejercicio al día
  const handleSelectExercise = (ex: Exercise) => {
    const isTime = ex.type === 'time' || ex.muscleGroup === 'CrossFit' || ex.muscleGroup === 'Cardio';
    const newEx: WorkoutExercise = {
      id: uid(),
      exerciseId: ex.id,
      sets: isTime
        ? [
            {
              id: uid(),
              timeSeconds: 900,
              reps: ex.muscleGroup === 'CrossFit' ? 50 : undefined,
              distanceMeters: ex.muscleGroup === 'Cardio' ? 2000 : undefined,
            },
          ]
        : [
            { id: uid(), weight: 20, reps: 10 },
            { id: uid(), weight: 20, reps: 10 },
            { id: uid(), weight: 20, reps: 10 },
          ],
    };
    setDayWorkout(key, [...dayExercises, newEx]);
    setPickerOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          tab === 1 && { paddingBottom: 320 },
        ]}
        stickyHeaderIndices={[2]}
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Anime Pastel Claro */}
        <View style={styles.topHeader}>
          <View>
            <View style={styles.cyberTagRow}>
              <Ionicons name="flash" size={11} color={C.pastelPurple} />
              <Text style={styles.cyberTagText}>✦ EVOLVE // ENTRENAMIENTO ✦</Text>
            </View>
            <Text style={styles.screenTitle}>Entreno</Text>
          </View>

          <View style={styles.dateChipMini}>
            <Ionicons name="barbell-outline" size={14} color={C.pastelPurple} />
            <Text style={styles.dateChipMiniText}>
              {tab === 0
                ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()
                : 'MÉTRICAS'}
            </Text>
          </View>
        </View>

        {/* GRÁFICA DINÁMICA SUPERIOR (Cambia de tamaño y modo) */}
        <WorkoutDynamicChart
          tab={tab}
          dayExercises={dayExercises}
          workoutLogs={workoutLogs}
          exercises={exercises}
          selectedExerciseId={selectedExerciseId}
          onClearSelectedExercise={() => setSelectedExerciseId(null)}
          timeRangeDays={timeRangeDays}
          onOpenRangePicker={() => setRangeModalOpen(true)}
        />

        {/* Selector Maestro de Modo (Sticky al hacer scroll down) */}
        <View style={styles.stickyTabsContainer}>
          <TrainNavigationSegmented value={tab} onChange={setTab} />
        </View>

        {/* Contenido Animado según pestaña */}
        <Animated.View
          style={{
            opacity: contentFadeAnim,
            transform: [{ translateY: contentSlideAnim }],
          }}
        >
          {tab === 0 ? (
            <WorkoutDayLog
              date={date}
              setDate={setDate}
              dayExercises={dayExercises}
              exercises={exercises}
              dayKey={key}
              onOpenExercisePicker={() => setPickerOpen(true)}
            />
          ) : (
            <WorkoutStatsLibrary
              exercises={exercises}
              workoutLogs={workoutLogs}
              selectedExerciseId={selectedExerciseId}
              onSelectExercise={(id) =>
                setSelectedExerciseId((prev) => (prev === id ? null : id))
              }
              onOpenCreateModal={(defaultName) =>
                setEditingExercise({ id: uid(), name: defaultName || '', muscleGroup: 'Pecho' })
              }
              onEditExercise={(ex) => setEditingExercise(ex)}
            />
          )}
        </Animated.View>
      </ScrollView>

      {/* MODAL DE BÚSQUEDA Y SELECCIÓN DE EJERCICIO */}
      <ExercisePickerModal
        visible={pickerOpen}
        exercises={exercises}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectExercise}
        onCreateNew={(initialName) => {
          setPickerOpen(false);
          setQuickCreateName(initialName);
        }}
      />

      {/* Modal para crear ejercicio nuevo con auto-asignación inmediata */}
      {quickCreateName !== null && (
        <ExerciseFormModal
          exercise={{ id: uid(), name: quickCreateName, muscleGroup: 'Pecho' }}
          onClose={() => setQuickCreateName(null)}
          onSave={(newEx) => {
            upsertExercise(newEx);
            handleSelectExercise(newEx); // Asigna inmediatamente al día
            setQuickCreateName(null);
          }}
        />
      )}

      {/* Modal para crear/editar ejercicio desde la biblioteca */}
      {editingExercise !== null && (
        <ExerciseFormModal
          exercise={editingExercise}
          onClose={() => setEditingExercise(null)}
          onSave={(saved) => {
            upsertExercise(saved);
            setSelectedExerciseId(saved.id);
            setEditingExercise(null);
          }}
        />
      )}

      {/* Modal de selección de Rango de Fechas para Estadísticas */}
      <RangeFilterModal
        visible={rangeModalOpen}
        currentDays={timeRangeDays}
        onClose={() => setRangeModalOpen(false)}
        onSelectRange={(days) => {
          setTimeRangeDays(days);
          setRangeModalOpen(false);
        }}
      />
    </View>
  );
}

/* ==========================================================
   GRÁFICA DINÁMICA SUPERIOR (Crece en estadísticas + Botón Calendario)
========================================================== */
function WorkoutDynamicChart({
  tab,
  dayExercises,
  workoutLogs,
  exercises,
  selectedExerciseId,
  onClearSelectedExercise,
  timeRangeDays,
  onOpenRangePicker,
}: {
  tab: number;
  dayExercises: WorkoutExercise[];
  workoutLogs: Record<string, WorkoutExercise[]>;
  exercises: Exercise[];
  selectedExerciseId: string | null;
  onClearSelectedExercise: () => void;
  timeRangeDays: number | null;
  onOpenRangePicker: () => void;
}) {
  const WORKOUT_RING_SIZE = 152;
  const WORKOUT_RING_STROKE = 12;
  const WORKOUT_RING_R = (WORKOUT_RING_SIZE - WORKOUT_RING_STROKE) / 2;
  const WORKOUT_RING_CIRC = 2 * Math.PI * WORKOUT_RING_R;

  // Altura animada: crece cuando pasa a estadísticas (222 matching Comidas, 288 en Estadísticas)
  const heightAnim = useRef(new Animated.Value(tab === 0 ? 234 : 288)).current;

  // Animación del fondo (orbes flotantes)
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;

  // Animación viva de movimiento, flotación, inclinación y respiración para la llama de Kcal
  const flameScale = useRef(new Animated.Value(1)).current;
  const flameTranslateY = useRef(new Animated.Value(0)).current;
  const flameRotate = useRef(new Animated.Value(0)).current;
  const flameAura = useRef(new Animated.Value(0.4)).current;

  // Rotación automática de estadísticas cuando no hay ejercicio seleccionado
  const [statIndex, setStatIndex] = useState(0);
  const statFadeAnim = useRef(new Animated.Value(1)).current;
  const statSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: tab === 0 ? 234 : 288,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [tab]);

  // Animación continua y viva de la llamita de fuego
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(flameScale, {
            toValue: 1.25,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(flameAura, {
            toValue: 0.85,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(flameScale, {
            toValue: 0.94,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(flameAura, {
            toValue: 0.35,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    const bobbingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameTranslateY, {
          toValue: -4,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flameTranslateY, {
          toValue: 2,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const tiltLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameRotate, {
          toValue: 1,
          duration: 480,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(flameRotate, {
          toValue: -1,
          duration: 480,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    bobbingLoop.start();
    tiltLoop.start();

    return () => {
      pulseLoop.stop();
      bobbingLoop.stop();
      tiltLoop.stop();
    };
  }, []);

  useEffect(() => {
    const bgLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, {
          toValue: 1,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim1, {
          toValue: 0,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const bgLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim2, {
          toValue: 1,
          duration: 6500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim2, {
          toValue: 0,
          duration: 6500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    bgLoop1.start();
    bgLoop2.start();

    return () => {
      bgLoop1.stop();
      bgLoop2.stop();
    };
  }, []);

  // Cálculo de totales del día actual (Registrar entrenamiento)
  const dayStats = useMemo(() => {
    let totalKcal = 0;
    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;

    dayExercises.forEach((we) => {
      const ex = exercises.find((e) => e.id === we.exerciseId);
      we.sets.forEach((s) => {
        totalSets += 1;
        totalReps += s.reps || 0;
        totalVolume += (s.weight || 0) * (s.reps || 0);
        totalKcal += estimateSetKcal(ex, s);
      });
    });

    return { totalKcal, totalVolume, totalSets, totalReps };
  }, [dayExercises, exercises]);

  // Recopilación de estadísticas rotativas históricas (cuando no hay ejercicio seleccionado)
  const autoRotateStats = useMemo(() => {
    const allRecords: {
      title: string;
      subtitle: string;
      value: string;
      unit: string;
      icon: any;
      badge: string;
      theme: StatTheme;
    }[] = [];

    // Calcular PR máx de ejercicios
    const maxWeights: Record<string, { weight: number; reps: number; date: string }> = {};
    let grandTotalVolume = 0;
    let grandTotalSets = 0;

    Object.entries(workoutLogs).forEach(([dateStr, weList]) => {
      weList.forEach((we) => {
        we.sets.forEach((s) => {
          grandTotalSets += 1;
          const w = s.weight || 0;
          const r = s.reps || 0;
          grandTotalVolume += w * r;
          if (w > 0 && (!maxWeights[we.exerciseId] || w > maxWeights[we.exerciseId].weight)) {
            maxWeights[we.exerciseId] = { weight: w, reps: r, date: dateStr };
          }
        });
      });
    });

    // Añadir mejores marcas de ejercicios del usuario con su tema dinámico
    Object.entries(maxWeights).forEach(([exId, data]) => {
      const ex = exercises.find((e) => e.id === exId);
      if (ex && data.weight > 0) {
        const theme = getMuscleTheme(ex.muscleGroup);
        allRecords.push({
          title: `RÉCORD // ${ex.name.toUpperCase()}`,
          subtitle: `${data.reps} reps el ${data.date}`,
          value: `${data.weight}`,
          unit: 'KG MÁX',
          icon: theme.icon,
          badge: theme.badgeLabel,
          theme,
        });
      }
    });

    // Añadir volumen total acumulado
    if (grandTotalVolume > 0) {
      allRecords.push({
        title: 'VOLUMEN HISTÓRICO TOTAL',
        subtitle: 'Energía levantada en todos los entrenamientos',
        value: grandTotalVolume > 1000 ? `${(grandTotalVolume / 1000).toFixed(1)}k` : `${grandTotalVolume}`,
        unit: 'KG TOTALES',
        icon: 'barbell-outline',
        badge: 'VOLUMEN & TONELAJE',
        theme: {
          primary: '#8B5CF6',
          gradient: ['#A78BFA', '#7C3AED'],
          bgGradient: ['rgba(139, 92, 246, 0.22)', 'rgba(124, 58, 237, 0.05)'],
          icon: 'barbell-outline',
          badgeLabel: 'VOLUMEN TOTAL',
        },
      });
    }

    // Añadir series acumuladas
    if (grandTotalSets > 0) {
      allRecords.push({
        title: 'SERIES TOTALES COMPLETADAS',
        subtitle: 'Constancia y disciplina acumulada',
        value: `${grandTotalSets}`,
        unit: 'SETS',
        icon: 'ribbon-outline',
        badge: 'DISCIPLINA ACUMULADA',
        theme: {
          primary: '#D97706',
          gradient: ['#FBBF24', '#B45309'],
          bgGradient: ['rgba(245, 158, 11, 0.22)', 'rgba(217, 119, 6, 0.05)'],
          icon: 'ribbon-outline',
          badgeLabel: 'SERIES TOTALES',
        },
      });
    }

    // Tarjetas de demostración enriquecidas para variedad visual inmediata
    const demoRecords = [
      {
        title: 'BENCHMARK // PRESS DE BANCA',
        subtitle: 'Meta de fuerza para hipertrofia de pecho',
        value: '80',
        unit: 'KG PR',
        icon: 'heart-outline',
        badge: 'PECHO & EMPUJE',
        theme: getMuscleTheme('Pecho'),
      },
      {
        title: 'BENCHMARK // SENTADILLA CON BARRA',
        subtitle: 'Potencia de tren inferior y estabilidad',
        value: '100',
        unit: 'KG PR',
        icon: 'flash-outline',
        badge: 'PIERNAS & POTENCIA',
        theme: getMuscleTheme('Piernas'),
      },
      {
        title: 'BENCHMARK // PESO MUERTO',
        subtitle: 'Tracción total de cadena posterior',
        value: '120',
        unit: 'KG PR',
        icon: 'shield-outline',
        badge: 'ESPALDA & TRACCIÓN',
        theme: getMuscleTheme('Espalda'),
      },
      {
        title: 'BENCHMARK // PRESS MILITAR',
        subtitle: 'Fuerza vertical y desarrollo de hombro 3D',
        value: '50',
        unit: 'KG PR',
        icon: 'diamond-outline',
        badge: 'HOMBROS 3D',
        theme: getMuscleTheme('Hombros'),
      },
      {
        title: 'BENCHMARK // CURL DE BÍCEPS',
        subtitle: 'Aislamiento de brazos y picos de fuerza',
        value: '35',
        unit: 'KG PR',
        icon: 'barbell-outline',
        badge: 'BRAZOS & BÍCEPS',
        theme: getMuscleTheme('Brazos'),
      },
      {
        title: 'OBJETIVO // GASTO CALÓRICO',
        subtitle: 'Calorías estimadas por sesión intensa',
        value: '380',
        unit: 'KCAL',
        icon: 'flame-outline',
        badge: 'CALORÍAS & SMARTWATCH',
        theme: {
          primary: '#F43F5E',
          gradient: ['#FB7185', '#E11D48'],
          bgGradient: ['rgba(244, 63, 94, 0.22)', 'rgba(225, 29, 72, 0.05)'],
          icon: 'flame-outline',
          badgeLabel: 'ENERGÍA QUEMADA',
        },
      },
    ];

    if (allRecords.length === 0) {
      return demoRecords;
    }

    return [...allRecords, ...demoRecords.slice(0, 3)];
  }, [workoutLogs, exercises]);

  // Ciclo de rotación de estadísticas automáticas cada 4s (ULTRA SMOOTH, SIN PARPADEO)
  useEffect(() => {
    if (tab !== 1 || selectedExerciseId !== null) return;

    const interval = setInterval(() => {
      // 1. Transición de salida: fade out y ligero ascenso suave
      Animated.parallel([
        Animated.timing(statFadeAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(statSlideAnim, {
          toValue: -8,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // 2. Cambiamos el índice cuando la opacidad es 0 EXACTA (cero parpadeo)
        setStatIndex((prev) => (prev + 1) % autoRotateStats.length);
        statSlideAnim.setValue(8);

        // 3. Transición de entrada: fade in y regreso suave a posición
        Animated.parallel([
          Animated.timing(statFadeAnim, {
            toValue: 1,
            duration: 350,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(statSlideAnim, {
            toValue: 0,
            duration: 350,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [tab, selectedExerciseId, autoRotateStats.length]);

  // Datos para la gráfica histórica de un ejercicio específico
  const historyData = useMemo(() => {
    if (!selectedExerciseId) return [];

    const now = new Date();
    const cutoffDate = timeRangeDays
      ? new Date(now.getTime() - timeRangeDays * 24 * 60 * 60 * 1000)
      : new Date(0);

    const points: { dateStr: string; dateObj: Date; maxWeight: number; totalVolume: number }[] = [];

    Object.entries(workoutLogs).forEach(([dateStr, weList]) => {
      const match = weList.find((we) => we.exerciseId === selectedExerciseId);
      if (match && match.sets.length > 0) {
        const parts = dateStr.split('-');
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

        if (dateObj >= cutoffDate) {
          const maxWeight = Math.max(...match.sets.map((s) => s.weight || 0));
          const totalVolume = match.sets.reduce((acc, s) => acc + (s.weight || 0) * (s.reps || 0), 0);
          points.push({ dateStr, dateObj, maxWeight, totalVolume });
        }
      }
    });

    return points.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [workoutLogs, selectedExerciseId, timeRangeDays]);

  const selectedExercise = exercises.find((e) => e.id === selectedExerciseId);

  // Cálculo del PR histórico para el ejercicio seleccionado (mayor peso a mayor reps)
  const exercisePR = useMemo(() => {
    if (!selectedExerciseId) return null;

    let bestWeight = 0;
    let bestReps = 0;
    let bestDate = '';

    Object.entries(workoutLogs).forEach(([dateStr, weList]) => {
      const match = weList.find((we) => we.exerciseId === selectedExerciseId);
      if (match) {
        match.sets.forEach((s) => {
          const w = s.weight || 0;
          const r = s.reps || 0;
          if (w > bestWeight || (w === bestWeight && r > bestReps)) {
            bestWeight = w;
            bestReps = r;
            bestDate = dateStr;
          }
        });
      }
    });

    if (bestWeight === 0 && bestReps === 0) return null;
    return { weight: bestWeight, reps: bestReps, date: bestDate };
  }, [workoutLogs, selectedExerciseId]);

  // Interpolación de orbes flotantes
  const transX1 = floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [-20, 25] });
  const transY1 = floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [-10, 15] });
  const transX2 = floatAnim2.interpolate({ inputRange: [0, 1], outputRange: [20, -25] });
  const transY2 = floatAnim2.interpolate({ inputRange: [0, 1], outputRange: [15, -15] });

  // Interpolación de oscilación angular de la llama de fuego
  const flameRotateDeg = flameRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-6deg', '0deg', '6deg'],
  });

  const rangeLabel = timeRangeDays === 7 ? '7 días' : timeRangeDays === 30 ? '30 días' : timeRangeDays === 90 ? '3 meses' : 'Todo';

  return (
    <Animated.View style={[s.glassCard, { height: heightAnim, marginBottom: 8 }]}>
      {/* CAPA DE FONDO ANIMADO ANIME */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[s.floatingOrb1, { transform: [{ translateX: transX1 }, { translateY: transY1 }] }]} />
        <Animated.View style={[s.floatingOrb2, { transform: [{ translateX: transX2 }, { translateY: transY2 }] }]} />
        <Animated.View style={s.floatingOrb3} />
      </View>

      <LinearGradient colors={GRADIENTS.cardGlass} style={[s.cardGradient, { flex: 1 }]}>
        {/* CABECERA DE LA GRÁFICA */}
        <View style={styles.chartHeaderRow}>
          <View style={s.hudBadge}>
            <Ionicons name="sparkles" size={11} color={C.pastelPurple} />
            <Text style={s.hudBadgeText}>
              {tab === 0
                ? '✦ SESIÓN DEL DÍA ✦'
                : selectedExercise
                ? `✦ HISTORIAL: ${selectedExercise.name.toUpperCase()} ✦`
                : '✦ ESTADÍSTICAS GLOBALES ✦'}
            </Text>
          </View>

          {/* BOTÓN DE CALENDARIO / RANGO EN ESTADÍSTICAS */}
          {tab === 1 && (
            <Pressable
              onPress={onOpenRangePicker}
              style={({ pressed }) => [styles.rangePickerBtn, pressed && s.btnPressed]}
            >
              <Ionicons name="calendar-outline" size={13} color={C.pastelPurple} />
              <Text style={styles.rangePickerBtnText}>{rangeLabel}</Text>
              <Ionicons name="chevron-down" size={11} color={C.sub} />
            </Pressable>
          )}
        </View>

        {/* MODO 1: GRÁFICA RESUMEN DE SESIÓN DIARIA (KCAL QUEMADAS EN ROJO + LLAMA VIVA EN MOVIMIENTO - TAMAÑO MATCH COMIDAS 152px) */}
        {tab === 0 && (
          <View style={styles.dayWorkoutSummaryRow}>
            {/* Medidor Circular de Calorías Quemadas en Rojo Anime (152px) */}
            <View style={styles.workoutVolRingContainer}>
              <Svg width={WORKOUT_RING_SIZE} height={WORKOUT_RING_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle
                  cx={WORKOUT_RING_SIZE / 2}
                  cy={WORKOUT_RING_SIZE / 2}
                  r={WORKOUT_RING_R}
                  stroke="rgba(203, 213, 225, 0.35)"
                  strokeWidth={WORKOUT_RING_STROKE}
                  fill="none"
                />
                <Circle
                  cx={WORKOUT_RING_SIZE / 2}
                  cy={WORKOUT_RING_SIZE / 2}
                  r={WORKOUT_RING_R}
                  stroke="#F43F5E"
                  strokeWidth={WORKOUT_RING_STROKE}
                  fill="none"
                  strokeDasharray={`${Math.min((dayStats.totalKcal / 500) * WORKOUT_RING_CIRC, WORKOUT_RING_CIRC)} ${WORKOUT_RING_CIRC}`}
                  strokeLinecap="round"
                />
              </Svg>
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <View style={styles.workoutRingCenterGlow}>
                  {/* Contenedor de la llamita viva en movimiento constante */}
                  <View style={{ width: 44, height: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
                    {/* Halo resplandeciente animado */}
                    <Animated.View
                      style={[
                        styles.flameHaloGlow,
                        {
                          transform: [{ scale: flameScale }],
                          opacity: flameAura,
                        },
                      ]}
                    />

                    {/* Llama con movimiento completo (flotación, balanceo e intensidad) */}
                    <Animated.View
                      style={{
                        transform: [
                          { translateY: flameTranslateY },
                          { rotate: flameRotateDeg },
                          { scale: flameScale },
                        ],
                      }}
                    >
                      <Ionicons name="flame" size={32} color="#F43F5E" />
                    </Animated.View>
                  </View>

                  <Text style={styles.workoutKcalNumber}>
                    {dayStats.totalKcal}
                  </Text>
                  <Text style={styles.workoutKcalUnit}>KCAL QUEMADAS</Text>
                </View>
              </View>
            </View>

            {/* Métricas laterales en tarjetas pastel (Divididas en 2 líneas de texto para óptima legibilidad y UX) */}
            <View style={{ flex: 1, marginLeft: 14, gap: 7, justifyContent: 'center' }}>
              <View style={styles.metricBlockCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="barbell-outline" size={13} color={C.pastelPurple} />
                  <Text style={styles.metricBlockLabel} numberOfLines={1}>Volumen levantado</Text>
                </View>
                <Text style={styles.metricBlockValue}>
                  {dayStats.totalVolume > 9999
                    ? `${(dayStats.totalVolume / 1000).toFixed(1)}k kg`
                    : `${Math.round(dayStats.totalVolume).toLocaleString()} kg`}
                </Text>
              </View>

              <View style={styles.metricBlockCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="layers-outline" size={13} color={C.pastelMint} />
                  <Text style={styles.metricBlockLabel} numberOfLines={1}>Series realizadas</Text>
                </View>
                <Text style={[styles.metricBlockValue, { color: C.pastelMint }]}>{dayStats.totalSets} sets</Text>
              </View>

              <View style={styles.metricBlockCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="repeat-outline" size={13} color={C.pastelPink} />
                  <Text style={styles.metricBlockLabel} numberOfLines={1}>Repeticiones totales</Text>
                </View>
                <Text style={[styles.metricBlockValue, { color: C.pastelPink }]}>{dayStats.totalReps} reps</Text>
              </View>
            </View>
          </View>
        )}

        {/* MODO 2: ESTADÍSTICAS AMPLIADAS */}
        {tab === 1 && (
          <View style={{ flex: 1, justifyContent: 'center', marginTop: 6 }}>
            {selectedExercise ? (
              /* GRÁFICA SVG HISTÓRICA DEL EJERCICIO SELECCIONADO CON TEMA DINÁMICO & PR */
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.selectedExerciseNameHeader} numberOfLines={1}>
                        {selectedExercise.name}
                      </Text>
                      {(() => {
                        const theme = getMuscleTheme(selectedExercise.muscleGroup);
                        return (
                          <View
                            style={[
                              styles.miniMusclePill,
                              { backgroundColor: theme.primary + '18', borderColor: theme.primary + '40' },
                            ]}
                          >
                            <Ionicons name={theme.icon} size={11} color={theme.primary} />
                            <Text style={[styles.miniMusclePillText, { color: theme.primary }]}>
                              {selectedExercise.muscleGroup}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                    <Text style={styles.selectedExerciseSub}>Progresión de carga máxima ({rangeLabel})</Text>
                  </View>
                  <Pressable onPress={onClearSelectedExercise} style={styles.closeSelectedBtn}>
                    <Ionicons name="close" size={14} color={C.sub} />
                  </Pressable>
                </View>

                {/* BADGE DESTACADO DEL PR HISTÓRICO (MAYOR PESO A MAYOR NÚMERO DE REPS) */}
                {(() => {
                  const theme = getMuscleTheme(selectedExercise.muscleGroup);
                  return (
                    <View
                      style={[
                        styles.prHighlightCard,
                        { backgroundColor: theme.primary + '14', borderColor: theme.primary + '40' },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons name="trophy" size={14} color={theme.primary} />
                        <Text style={[styles.prHighlightTitle, { color: theme.primary }]}>
                          RÉCORD HISTÓRICO (PR):
                        </Text>
                      </View>
                      {exercisePR ? (
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                          <Text style={styles.prHighlightWeight}>{exercisePR.weight} kg</Text>
                          <Text style={[styles.prHighlightReps, { color: theme.primary }]}>
                            × {exercisePR.reps} reps
                          </Text>
                          {exercisePR.date ? (
                            <Text style={styles.prHighlightDate}>({exercisePR.date.slice(5)})</Text>
                          ) : null}
                        </View>
                      ) : (
                        <Text style={styles.prHighlightEmpty}>Sin registros aún</Text>
                      )}
                    </View>
                  );
                })()}

                {historyData.length < 2 ? (
                  <View style={styles.emptyHistoryBox}>
                    <Ionicons name="stats-chart-outline" size={28} color={C.subMuted} />
                    <Text style={styles.emptyHistoryText}>
                      {historyData.length === 1
                        ? `1 registro guardado (${historyData[0].maxWeight} kg). Registra otro día para ver la curva.`
                        : 'Aún no hay registros en este rango para graficar.'}
                    </Text>
                  </View>
                ) : (
                  <WorkoutHistorySVGChart
                    data={historyData}
                    theme={getMuscleTheme(selectedExercise.muscleGroup)}
                    prWeight={exercisePR?.weight}
                  />
                )}
              </View>
            ) : (
              /* CARRUSEL DE ESTADÍSTICAS ROTATIVAS ANIMADAS AUTOMÁTICAS CON COLORES E ICONOS DINÁMICOS (ULTRA SMOOTH) */
              <Animated.View
                style={[
                  { alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%' },
                  {
                    opacity: statFadeAnim,
                    transform: [{ translateY: statSlideAnim }],
                  },
                ]}
              >
                {autoRotateStats[statIndex] && (() => {
                  const currentStat = autoRotateStats[statIndex];
                  const stTheme = currentStat.theme;
                  return (
                    <View style={{ alignItems: 'center', paddingHorizontal: 16, width: '100%' }}>
                      {/* Tag de grupo con icono y color dinámico */}
                      <View
                        style={[
                          styles.statDynamicBadge,
                          { backgroundColor: stTheme.primary + '18', borderColor: stTheme.primary + '40' },
                        ]}
                      >
                        <Ionicons name={currentStat.icon} size={12} color={stTheme.primary} />
                        <Text style={[styles.statDynamicBadgeText, { color: stTheme.primary }]}>
                          ✦ {currentStat.badge} ✦
                        </Text>
                      </View>

                      {/* Orbe resplandeciente con gradiente y color cambiante */}
                      <LinearGradient
                        colors={[stTheme.bgGradient[0], stTheme.bgGradient[1]]}
                        style={[styles.statOrbGlow, { borderColor: stTheme.primary + '35' }]}
                      >
                        <Ionicons name={currentStat.icon} size={28} color={stTheme.primary} />
                      </LinearGradient>

                      {/* Título de la métrica */}
                      <Text style={[styles.rotStatTitle, { color: stTheme.primary }]}>
                        {currentStat.title}
                      </Text>

                      {/* Gran valor con color temático */}
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginVertical: 2 }}>
                        <Text style={[styles.rotStatBigValue, { color: C.text }]}>{currentStat.value}</Text>
                        <Text style={[styles.rotStatUnit, { color: stTheme.primary }]}>{currentStat.unit}</Text>
                      </View>

                      <Text style={styles.rotStatSubtitle}>{currentStat.subtitle}</Text>

                      {/* Indicador de progreso de puntos */}
                      <View style={styles.carouselDotsRow}>
                        {autoRotateStats.map((_, dotIdx) => (
                          <View
                            key={dotIdx}
                            style={[
                              styles.carouselDot,
                              dotIdx === statIndex && [styles.carouselDotActive, { backgroundColor: stTheme.primary }],
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })()}
              </Animated.View>
            )}
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

/* ==========================================================
   GRÁFICA SVG HISTÓRICA DEL EJERCICIO SELECCIONADO (DINÁMICA)
========================================================== */
function WorkoutHistorySVGChart({
  data,
  theme,
  prWeight,
}: {
  data: { dateStr: string; maxWeight: number; totalVolume: number }[];
  theme: StatTheme;
  prWeight?: number;
}) {
  const width = Dimensions.get('window').width - 64;
  const height = 140;
  const paddingX = 20;
  const paddingY = 22;

  const weights = data.map((d) => d.maxWeight);
  const minW = Math.max(0, Math.min(...weights) - 5);
  const maxW = Math.max(...weights) + 5;
  const range = maxW - minW || 1;

  // Generación de coordenadas de puntos
  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((d.maxWeight - minW) / range) * (height - paddingY * 2);
    return { x, y, weight: d.maxWeight, date: d.dateStr.slice(5) };
  });

  // Generación del trazado SVG suave
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX1 = prev.x + (curr.x - prev.x) / 2;
    const cpX2 = prev.x + (curr.x - prev.x) / 2;
    pathD += ` C ${cpX1} ${prev.y}, ${cpX2} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const fillD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <View style={{ width, height, marginTop: 2 }}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.primary} stopOpacity="0.28" />
            <Stop offset="1" stopColor={theme.primary} stopOpacity="0.01" />
          </SvgGradient>
        </Defs>

        {/* Línea base horizontal */}
        <Line x1={paddingX} y1={height - 18} x2={width - paddingX} y2={height - 18} stroke="rgba(203, 213, 225, 0.4)" strokeWidth={1} />

        {/* Área sombreada bajo la curva */}
        <Path d={fillD} fill="url(#curveFill)" />

        {/* Curva de progresión dinámica */}
        <Path d={pathD} fill="none" stroke={theme.primary} strokeWidth={3} strokeLinecap="round" />

        {/* Puntos y etiquetas de peso (Con halo dorado en el PR) */}
        {points.map((p, idx) => {
          const isPR = prWeight !== undefined && p.weight === prWeight;
          return (
            <React.Fragment key={idx}>
              {isPR && (
                <Circle cx={p.x} cy={p.y} r={9} fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="3 2" />
              )}
              <Circle
                cx={p.x}
                cy={p.y}
                r={isPR ? 6 : 5}
                fill="#FFFFFF"
                stroke={isPR ? '#F59E0B' : theme.primary}
                strokeWidth={2.5}
              />
              <Circle cx={p.x} cy={p.y} r={2} fill={isPR ? '#F59E0B' : theme.primary} />
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Etiquetas debajo de los puntos con estrella en el PR */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, marginTop: -14 }}>
        {points.map((p, idx) => {
          const isPR = prWeight !== undefined && p.weight === prWeight;
          return (
            <View key={idx} style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isPR ? '#D97706' : theme.primary }}>
                  {p.weight}kg
                </Text>
                {isPR && <Text style={{ fontSize: 8.5, color: '#D97706', fontWeight: '900' }}>★</Text>}
              </View>
              <Text style={{ fontSize: 9, color: C.subMuted }}>{p.date}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ==========================================================
   OPCIÓN 1: REGISTRO DEL DÍA (Ejercicios, Series, Reps)
========================================================== */
function WorkoutDayLog({
  date,
  setDate,
  dayExercises,
  exercises,
  dayKey,
  onOpenExercisePicker,
}: {
  date: Date;
  setDate: (d: Date) => void;
  dayExercises: WorkoutExercise[];
  exercises: Exercise[];
  dayKey: string;
  onOpenExercisePicker: () => void;
}) {
  const { setDayWorkout } = useStore();
  const [exerciseModes, setExerciseModes] = useState<Record<string, 'reps' | 'time'>>({});

  const updateExercises = (newList: WorkoutExercise[]) => {
    setDayWorkout(dayKey, newList);
  };

  return (
    <View style={{ marginTop: 4 }}>
      {/* Selector de Fecha */}
      <DateSelector date={date} onChange={setDate} />

      {/* Empty State si no hay ejercicios */}
      {dayExercises.length === 0 && (
        <View style={styles.emptyWorkoutCard}>
          <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={styles.emptyWorkoutGradient}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="barbell-outline" size={32} color={C.pastelPurple} />
            </View>
            <Text style={styles.emptyWorkoutTitle}>Sin ejercicios en este día</Text>
            <Text style={styles.emptyWorkoutSubtitle}>
              Toca en "Agregar ejercicio" para registrar tus series, pesos y repeticiones.
            </Text>
          </LinearGradient>
        </View>
      )}

      {/* Tarjetas de Ejercicios del Día */}
      {dayExercises.map((we, index) => {
        const ex = exercises.find((e) => e.id === we.exerciseId);
        const exName = ex?.name || 'Ejercicio';
        const exGroup = ex?.muscleGroup || 'General';
        const defaultIsTime =
          ex?.type === 'time' ||
          exGroup === 'CrossFit' ||
          exGroup === 'Cardio' ||
          we.sets.some((s) => (s.timeSeconds ?? 0) > 0);
        const currentMode = exerciseModes[we.id] ?? (defaultIsTime ? 'time' : 'reps');
        const isTimeMode = currentMode === 'time';

        const updateSets = (newSets: WorkoutSet[]) => {
          updateExercises(dayExercises.map((x) => (x.id === we.id ? { ...x, sets: newSets } : x)));
        };

        const deleteExerciseFromDay = () => {
          updateExercises(dayExercises.filter((x) => x.id !== we.id));
        };

        const totalVol = we.sets.reduce((acc, s) => acc + (s.weight || 0) * (s.reps || 0), 0);
        const totalSecs = we.sets.reduce((acc, s) => acc + (s.timeSeconds || 0), 0);
        const totalMins = Math.round((totalSecs / 60) * 10) / 10;
        const totalKm =
          Math.round(
            (we.sets.reduce((acc, s) => acc + (s.distanceMeters || 0), 0) / 1000) * 10,
          ) / 10;
        const totalReps = we.sets.reduce((acc, s) => acc + (s.reps || 0), 0);

        return (
          <View key={we.id} style={styles.workoutExerciseCard}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={{ padding: 16 }}>
              {/* Barra lateral de acento */}
              <View
                style={[
                  styles.exerciseAccentBar,
                  isTimeMode && { backgroundColor: '#F97316' },
                ]}
              />

              {/* Cabecera del Ejercicio */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingLeft: 6 }}>
                  <Text style={styles.exerciseTitleText}>{exName}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    <View style={styles.muscleBadge}>
                      <Text style={styles.muscleBadgeText}>{exGroup}</Text>
                    </View>

                    {/* Toggle entre modo Peso y modo Tiempo */}
                    <Pressable
                      onPress={() => {
                        const nextMode = isTimeMode ? 'reps' : 'time';
                        setExerciseModes((prev) => ({ ...prev, [we.id]: nextMode }));
                        if (nextMode === 'time' && !we.sets.some((s) => (s.timeSeconds ?? 0) > 0)) {
                          updateSets(
                            we.sets.map((s) => ({
                              ...s,
                              timeSeconds: 900,
                            })),
                          );
                        }
                      }}
                      style={styles.modeTogglePill}
                    >
                      <Ionicons
                        name={isTimeMode ? 'timer-outline' : 'barbell-outline'}
                        size={12}
                        color="#94A3B8"
                      />
                      <Text style={styles.modeToggleText}>
                        {isTimeMode ? 'Tiempo / CrossFit' : 'Peso / Reps'}
                      </Text>
                      <Ionicons name="swap-horizontal" size={11} color="#94A3B8" />
                    </Pressable>

                    <Text style={styles.volumeMiniText}>
                      {isTimeMode
                        ? `Tiempo: ${totalMins} min${totalKm > 0 ? ` · ${totalKm} km` : totalReps > 0 ? ` · ${totalReps} reps` : ''}`
                        : `Volumen: ${Math.round(totalVol)} kg`}
                    </Text>
                  </View>
                </View>

                <Pressable onPress={deleteExerciseFromDay} hitSlop={10} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={18} color={C.danger} />
                </Pressable>
              </View>

              {/* Encabezados de la Tabla de Series */}
              <View style={styles.setTableHeadersRow}>
                <Text style={[styles.setTableHeaderText, { width: 44 }]}>SET</Text>
                <Text style={[styles.setTableHeaderText, { flex: 1, textAlign: 'center' }]}>
                  {isTimeMode ? 'TIEMPO (MIN)' : 'PESO (KG)'}
                </Text>
                <Text style={[styles.setTableHeaderText, { flex: 1, textAlign: 'center' }]}>
                  {isTimeMode ? 'DIST (KM) / REPS' : 'REPS'}
                </Text>
                <View style={{ width: 34 }} />
              </View>

              {/* Filas de Series */}
              {we.sets.map((set, setIdx) => {
                const isKm =
                  (set.distanceMeters ?? 0) > 0 ||
                  ((set.reps ?? 0) === 0 && !exGroup.toLowerCase().includes('crossfit'));

                return (
                  <View key={set.id} style={styles.setRowContainer}>
                    <View style={styles.setNumberBadge}>
                      <Text style={styles.setNumberText}>{setIdx + 1}</Text>
                    </View>

                    {isTimeMode ? (
                      <>
                        {/* Input de Tiempo */}
                        <View style={styles.setInputBox}>
                          <TextInput
                            value={
                              set.timeSeconds !== undefined && set.timeSeconds !== null
                                ? String(
                                    set.timeSeconds >= 60
                                      ? Math.round((set.timeSeconds / 60) * 10) / 10
                                      : set.timeSeconds,
                                  )
                                : ''
                            }
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={C.subMuted}
                            style={styles.setTextInput}
                            onChangeText={(t) => {
                              const val = parseFloat(t.replace(',', '.')) || 0;
                              updateSets(
                                we.sets.map((s) =>
                                  s.id === set.id ? { ...s, timeSeconds: Math.round(val * 60) } : s,
                                ),
                              );
                            }}
                          />
                          <Text style={styles.setUnitLabel}>min</Text>
                        </View>

                        {/* Input de Distancia o Repeticiones */}
                        <View style={styles.setInputBox}>
                          <TextInput
                            value={
                              isKm
                                ? set.distanceMeters
                                  ? String(Math.round((set.distanceMeters / 1000) * 100) / 100)
                                  : ''
                                : set.reps
                                ? String(set.reps)
                                : ''
                            }
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={C.subMuted}
                            style={styles.setTextInput}
                            onChangeText={(t) => {
                              const val = parseFloat(t.replace(',', '.')) || 0;
                              if (isKm) {
                                updateSets(
                                  we.sets.map((s) =>
                                    s.id === set.id ? { ...s, distanceMeters: Math.round(val * 1000) } : s,
                                  ),
                                );
                              } else {
                                updateSets(
                                  we.sets.map((s) => (s.id === set.id ? { ...s, reps: Math.round(val) } : s)),
                                );
                              }
                            }}
                          />
                          <Pressable
                            onPress={() => {
                              if (isKm) {
                                updateSets(
                                  we.sets.map((s) =>
                                    s.id === set.id ? { ...s, reps: s.reps || 20, distanceMeters: undefined } : s,
                                  ),
                                );
                              } else {
                                updateSets(
                                  we.sets.map((s) =>
                                    s.id === set.id ? { ...s, distanceMeters: 2000, reps: undefined } : s,
                                  ),
                                );
                              }
                            }}
                            hitSlop={6}
                            style={styles.toggleUnitBadge}
                          >
                            <Text style={styles.toggleUnitText}>{isKm ? 'km' : 'reps'}</Text>
                            <Ionicons name="swap-vertical" size={10} color="#94A3B8" />
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <>
                        {/* Input de Peso */}
                        <View style={styles.setInputBox}>
                          <TextInput
                            value={set.weight ? String(set.weight) : ''}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={C.subMuted}
                            style={styles.setTextInput}
                            onChangeText={(t) => {
                              const val = parseFloat(t.replace(',', '.')) || 0;
                              updateSets(we.sets.map((s) => (s.id === set.id ? { ...s, weight: val } : s)));
                            }}
                          />
                          <Text style={styles.setUnitLabel}>kg</Text>
                        </View>

                        {/* Input de Repeticiones */}
                        <View style={styles.setInputBox}>
                          <TextInput
                            value={set.reps ? String(set.reps) : ''}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor={C.subMuted}
                            style={styles.setTextInput}
                            onChangeText={(t) => {
                              const val = parseInt(t) || 0;
                              updateSets(we.sets.map((s) => (s.id === set.id ? { ...s, reps: val } : s)));
                            }}
                          />
                          <Text style={styles.setUnitLabel}>reps</Text>
                        </View>
                      </>
                    )}

                    {/* Botón eliminar serie */}
                    <Pressable
                      onPress={() => updateSets(we.sets.filter((s) => s.id !== set.id))}
                      hitSlop={8}
                      style={{ width: 34, alignItems: 'center' }}
                    >
                      <Ionicons name="close-circle-outline" size={19} color={C.danger} />
                    </Pressable>
                  </View>
                );
              })}

              {/* Botón para agregar una nueva serie */}
              <Pressable
                onPress={() => {
                  const lastSet = we.sets[we.sets.length - 1];
                  const newSet: WorkoutSet = isTimeMode
                    ? {
                        id: uid(),
                        timeSeconds: lastSet?.timeSeconds ?? 900,
                        distanceMeters: lastSet?.distanceMeters,
                        reps: lastSet?.reps,
                      }
                    : {
                        id: uid(),
                        weight: lastSet ? lastSet.weight : 20,
                        reps: lastSet ? lastSet.reps : 10,
                      };
                  updateSets([...we.sets, newSet]);
                }}
                style={({ pressed }) => [styles.addSetDashedBtn, pressed && s.btnPressed]}
              >
                <Ionicons name="add" size={16} color={C.pastelPurple} />
                <Text style={styles.addSetDashedText}>Agregar serie</Text>
              </Pressable>
            </LinearGradient>
          </View>
        );
      })}

      {/* Botón Principal para Agregar Ejercicio */}
      <View style={{ marginTop: 6 }}>
        <PrimaryButton icon="add-circle" label="Agregar ejercicio" onPress={onOpenExercisePicker} />
      </View>
    </View>
  );
}

/* ==========================================================
   OPCIÓN 2: ESTADÍSTICAS Y BIBLIOTECA DE EJERCICIOS
========================================================== */
function WorkoutStatsLibrary({
  exercises,
  workoutLogs,
  selectedExerciseId,
  onSelectExercise,
  onOpenCreateModal,
  onEditExercise,
}: {
  exercises: Exercise[];
  workoutLogs: Record<string, WorkoutExercise[]>;
  selectedExerciseId: string | null;
  onSelectExercise: (id: string) => void;
  onOpenCreateModal: (defaultName?: string) => void;
  onEditExercise: (ex: Exercise) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('Todos');

  // Cálculo de estadísticas por ejercicio (PR: mayor peso a mayor reps)
  const exerciseStatsMap = useMemo(() => {
    const stats: Record<string, { maxWeight: number; bestReps: number; totalSets: number; lastDate: string }> = {};

    Object.entries(workoutLogs).forEach(([dateStr, weList]) => {
      weList.forEach((we) => {
        if (!stats[we.exerciseId]) {
          stats[we.exerciseId] = { maxWeight: 0, bestReps: 0, totalSets: 0, lastDate: dateStr };
        }
        stats[we.exerciseId].totalSets += we.sets.length;
        we.sets.forEach((s) => {
          const w = s.weight || 0;
          const r = s.reps || 0;
          const current = stats[we.exerciseId];
          if (w > current.maxWeight || (w === current.maxWeight && r > current.bestReps)) {
            current.maxWeight = w;
            current.bestReps = r;
          }
        });
        stats[we.exerciseId].lastDate = dateStr;
      });
    });

    return stats;
  }, [workoutLogs]);

  // Filtrado de ejercicios en tiempo real
  const filtered = useMemo(() => {
    return exercises
      .filter((e) => {
        const matchesQuery = !query.trim() || e.name.toLowerCase().includes(query.toLowerCase().trim());
        const matchesGroup = selectedGroup === 'Todos' || e.muscleGroup === selectedGroup;
        return matchesQuery && matchesGroup;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, query, selectedGroup]);

  const exactMatch = exercises.some((e) => e.name.toLowerCase().trim() === query.toLowerCase().trim());

  return (
    <View style={{ marginTop: 6 }}>
      {/* Buscador y Botón Crear Ejercicio */}
      <View style={styles.searchAddRow}>
        <View style={styles.searchBoxGlass}>
          <Ionicons name="search" size={17} color={C.pastelPurple} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar ejercicio para estadísticas..."
            placeholderTextColor={C.subMuted}
            style={styles.searchTextInput}
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS !== 'ios' && (
            <Pressable onPress={() => setQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={16} color={C.sub} />
            </Pressable>
          )}
          <Pressable onPress={() => Keyboard.dismiss()} style={{ padding: 4 }}>
            <Ionicons name="chevron-down-circle-outline" size={18} color={C.pastelPurple} />
          </Pressable>
        </View>

        {/* Botón + pasa el texto del buscador si el usuario escribió algo */}
        <Pressable
          onPress={() => onOpenCreateModal(query.trim())}
          style={({ pressed }) => [styles.addSquareBtn, pressed && s.btnPressed]}
        >
          <LinearGradient colors={GRADIENTS.primary} style={styles.addSquareGradient}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>

      {/* Banner rápido si buscó un ejercicio que no está en la biblioteca */}
      {query.trim().length > 0 && !exactMatch && (
        <Pressable
          onPress={() => onOpenCreateModal(query.trim())}
          style={({ pressed }) => [styles.quickCreateBanner, pressed && s.btnPressed]}
        >
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.12)', 'rgba(236, 72, 153, 0.12)']}
            style={styles.quickCreateBannerGradient}
          >
            <Ionicons name="add-circle" size={20} color={C.pastelPurple} />
            <Text style={styles.quickCreateBannerText}>
              Crear nuevo ejercicio: <Text style={{ color: C.text, fontWeight: '800' }}>"{query.trim()}"</Text>
            </Text>
            <Ionicons name="chevron-forward" size={16} color={C.pastelPurple} />
          </LinearGradient>
        </Pressable>
      )}

      {/* Filtro horizontal por Grupo Muscular con badges temáticos */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {MUSCLE_GROUPS.map((g) => {
          const active = selectedGroup === g;
          const mTheme = g === 'Todos' ? null : getMuscleTheme(g);
          return (
            <Pressable
              key={g}
              onPress={() => setSelectedGroup(g)}
              style={[
                styles.filterGroupPill,
                active && (mTheme ? { backgroundColor: mTheme.primary, borderColor: mTheme.primary } : styles.filterGroupPillActive),
              ]}
            >
              <Text style={[styles.filterGroupText, active && styles.filterGroupTextActive]}>{g}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Empty State de búsqueda con botón grande para agregar directamente */}
      {filtered.length === 0 && (
        <View style={styles.emptySearchCard}>
          <Ionicons name="search-outline" size={32} color={C.subMuted} style={{ marginBottom: 6 }} />
          <Text style={styles.emptySearchTitle}>Sin resultados para "{query}"</Text>
          <Text style={styles.emptySearchSubtitle}>
            ¿Deseas agregar este ejercicio a tu biblioteca con este nombre?
          </Text>
          <Pressable
            onPress={() => onOpenCreateModal(query.trim())}
            style={({ pressed }) => [styles.emptySearchAddBtn, pressed && s.btnPressed]}
          >
            <LinearGradient colors={GRADIENTS.primary} style={styles.emptySearchAddGradient}>
              <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptySearchAddText}>Agregar "{query.trim()}"</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      {/* Contador y Consejo */}
      {filtered.length > 0 && (
        <View style={styles.countBadgeRow}>
          <Text style={styles.countBadgeText}>✦ TOCA UN EJERCICIO PARA GRAFICAR SU PROGRESO ✦</Text>
        </View>
      )}

      {/* Lista de Ejercicios */}
      {filtered.map((ex) => {
        const isSelected = selectedExerciseId === ex.id;
        const st = exerciseStatsMap[ex.id];
        const exTheme = getMuscleTheme(ex.muscleGroup);

        return (
          <Pressable
            key={ex.id}
            onPress={() => onSelectExercise(ex.id)}
            style={({ pressed }) => [
              styles.exerciseItemCard,
              isSelected && [styles.exerciseItemCardSelected, { borderColor: exTheme.primary }],
              pressed && s.btnPressed,
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.exerciseItemName, isSelected && { color: exTheme.primary }]}>{ex.name}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={16} color={exTheme.primary} />}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={[styles.muscleBadge, { backgroundColor: exTheme.primary + '15', borderColor: exTheme.primary + '35' }]}>
                    <Ionicons name={exTheme.icon} size={11} color={exTheme.primary} style={{ marginRight: 3 }} />
                    <Text style={[styles.muscleBadgeText, { color: exTheme.primary }]}>{ex.muscleGroup}</Text>
                  </View>
                  <Text style={styles.statsMiniText}>
                    {st && st.maxWeight > 0
                      ? `PR: ${st.maxWeight} kg × ${st.bestReps} reps  •  ${st.totalSets} series`
                      : 'Sin entrenamientos registrados'}
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => onEditExercise(ex)} hitSlop={10} style={{ padding: 6 }}>
                <Ionicons name="pencil-outline" size={16} color={C.subMuted} />
              </Pressable>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ==========================================================
   SELECTOR MAESTRO DE NAVEGACIÓN EN ENTRENAMIENTO
========================================================== */
function TrainNavigationSegmented({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  const options = [
    { label: 'Registrar entrenamiento', icon: 'barbell-outline' },
    { label: 'Estadísticas', icon: 'stats-chart-outline' },
  ];

  const [containerWidth, setContainerWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: value, friction: 8, tension: 65, useNativeDriver: true }).start();
  }, [value]);

  const pillWidth = containerWidth > 0 ? (containerWidth - 8) / 2 : 0;
  const translateX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [4, pillWidth + 4] });

  return (
    <View style={s.mainSegmentedContainer} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {containerWidth > 0 && (
        <Animated.View style={[s.slidingPill, { width: pillWidth, transform: [{ translateX }] }]}>
          <LinearGradient colors={['#8B5CF6', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.slidingPillGradient} />
        </Animated.View>
      )}

      {options.map((opt, i) => {
        const active = value === i;
        return (
          <Pressable key={opt.label} onPress={() => onChange(i)} style={s.mainSegmentedBtn}>
            <Ionicons name={opt.icon as any} size={16} color={active ? '#FFFFFF' : C.sub} style={{ marginRight: 6 }} />
            <Text style={[s.mainSegmentedText, active ? s.mainSegmentedTextActive : s.mainSegmentedTextInactive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ==========================================================
   MODAL DE BÚSQUEDA DE EJERCICIOS (SEGURO CONTRA TECLADO)
========================================================== */
function ExercisePickerModal({
  visible,
  exercises,
  onSelect,
  onClose,
  onCreateNew,
}: {
  visible: boolean;
  exercises: Exercise[];
  onSelect: (ex: Exercise) => void;
  onClose: () => void;
  onCreateNew: (name: string) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return exercises;
    return exercises.filter((e) => e.name.toLowerCase().includes(query.toLowerCase().trim()));
  }, [exercises, query]);

  const exactMatch = exercises.some((e) => e.name.toLowerCase().trim() === query.toLowerCase().trim());

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.pickerSheetContainer}>
          <View style={s.pickerSheetContent}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={{ flex: 1 }}>
              <View style={s.sheetHandleBar} />
              <View style={s.sheetHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={s.hudIconOrb}>
                    <Ionicons name="barbell" size={16} color={C.pastelPurple} />
                  </View>
                  <View>
                    <Text style={s.sheetTitle}>SELECCIONAR EJERCICIO</Text>
                    <Text style={s.sheetSubtitle}>Elige un ejercicio para tu entrenamiento</Text>
                  </View>
                </View>
                <Pressable onPress={onClose} style={({ pressed }) => [s.sheetCloseBtn, pressed && s.btnPressed]}>
                  <Ionicons name="close" size={20} color={C.sub} />
                </Pressable>
              </View>

              <View style={s.searchBarContainer}>
                <Ionicons name="search" size={18} color={C.pastelPurple} style={{ marginLeft: 12 }} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar o escribir nombre del ejercicio..."
                  placeholderTextColor={C.subMuted}
                  style={s.searchInput}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </View>

              {query.trim().length > 0 && !exactMatch && (
                <Pressable
                  onPress={() => {
                    onCreateNew(query.trim());
                    onClose();
                  }}
                  style={({ pressed }) => [s.quickCreateCard, pressed && s.btnPressed]}
                >
                  <LinearGradient colors={['rgba(167, 139, 250, 0.15)', 'rgba(244, 114, 182, 0.15)']} style={s.quickCreateGradient}>
                    <Ionicons name="add-circle" size={20} color={C.pastelPurple} />
                    <Text style={s.quickCreateText}>
                      Crear nuevo ejercicio: <Text style={{ color: C.text, fontWeight: '800' }}>"{query.trim()}"</Text>
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}

              <FlatList<Exercise>
                data={filtered}
                keyExtractor={(item: Exercise) => item.id}
                keyboardShouldPersistTaps="always"
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36 }}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                renderItem={({ item }: { item: Exercise }) => (
                  <Pressable
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    style={({ pressed }) => [s.ingredientItemCard, pressed && s.btnPressed]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={s.ingredientItemName}>{item.name}</Text>
                      <View style={styles.muscleBadge}>
                        <Text style={styles.muscleBadgeText}>{item.muscleGroup}</Text>
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ==========================================================
   MODAL PARA CREAR O EDITAR EJERCICIO (SEGURO & BOTÓN SAVE FIJO)
========================================================== */
function ExerciseFormModal({
  exercise,
  onSave,
  onClose,
}: {
  exercise: Exercise;
  onSave: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(exercise.name || '');
  const [muscleGroup, setMuscleGroup] = useState(exercise.muscleGroup || 'Pecho');
  const [exerciseType, setExerciseType] = useState<'reps' | 'time'>(
    exercise.type ||
      (exercise.muscleGroup === 'CrossFit' || exercise.muscleGroup === 'Cardio' ? 'time' : 'reps'),
  );

  useEffect(() => {
    setName(exercise.name || '');
    setMuscleGroup(exercise.muscleGroup || 'Pecho');
    setExerciseType(
      exercise.type ||
        (exercise.muscleGroup === 'CrossFit' || exercise.muscleGroup === 'Cardio' ? 'time' : 'reps'),
    );
  }, [exercise]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Nombre requerido', 'Por favor ingresa un nombre para el ejercicio.');
      return;
    }
    onSave({ id: exercise.id, name: name.trim(), muscleGroup, type: exerciseType });
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.formModalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.formModalSheetContainer}
        >
          <View style={styles.formModalSheetContent}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={{ paddingBottom: Platform.OS === 'ios' ? 24 : 16 }}>
              {/* Header con botón de cerrar */}
              <View style={styles.formModalHeaderPadding}>
                <View style={styles.sheetHandleBar} />
                <View style={styles.formHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formTitle}>
                      {exercise.name ? 'EDITAR EJERCICIO' : 'NUEVO EJERCICIO'}
                    </Text>
                    <Text style={styles.formSubtitle}>Configura el nombre, tipo y grupo muscular</Text>
                  </View>
                  <Pressable
                    onPress={onClose}
                    hitSlop={10}
                    style={({ pressed }) => [styles.sheetCloseMiniBtn, pressed && s.btnPressed]}
                  >
                    <Ionicons name="close" size={20} color={C.text} />
                  </Pressable>
                </View>
              </View>

              {/* Contenido del formulario visible completo sin scroll-Y innecesario */}
              <View style={{ paddingHorizontal: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.fieldLabel}>Nombre del ejercicio</Text>
                  <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
                    <Text style={{ fontSize: 11, color: C.pastelPurple, fontWeight: '700' }}>Ocultar teclado</Text>
                  </Pressable>
                </View>

                <View style={[styles.fieldInputBox, { marginBottom: 14 }]}>
                  <Ionicons name="barbell-outline" size={18} color={C.pastelPurple} style={{ marginLeft: 12 }} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Ej. Press Militar, Correr, Burpees..."
                    placeholderTextColor={C.subMuted}
                    style={[styles.fieldTextInput, { marginLeft: 8 }]}
                    autoFocus={!exercise.name}
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  {name.length > 0 && (
                    <Pressable onPress={() => setName('')} style={{ padding: 8 }}>
                      <Ionicons name="close-circle" size={16} color={C.subMuted} />
                    </Pressable>
                  )}
                </View>

                {/* Selector de Tipo de Ejercicio */}
                <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>Tipo de Medición</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <Pressable
                    onPress={() => setExerciseType('reps')}
                    style={[
                      styles.exerciseTypeBtn,
                      exerciseType === 'reps' && styles.exerciseTypeBtnActive,
                    ]}
                  >
                    <Ionicons
                      name="barbell-outline"
                      size={15}
                      color={exerciseType === 'reps' ? '#FFFFFF' : C.sub}
                    />
                    <Text
                      style={[
                        styles.exerciseTypeText,
                        exerciseType === 'reps' && styles.exerciseTypeTextActive,
                      ]}
                    >
                      Peso & Repeticiones
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setExerciseType('time')}
                    style={[
                      styles.exerciseTypeBtn,
                      exerciseType === 'time' && styles.exerciseTypeBtnActiveTime,
                    ]}
                  >
                    <Ionicons
                      name="timer-outline"
                      size={15}
                      color={exerciseType === 'time' ? '#FFFFFF' : C.sub}
                    />
                    <Text
                      style={[
                        styles.exerciseTypeText,
                        exerciseType === 'time' && styles.exerciseTypeTextActive,
                      ]}
                    >
                      Tiempo (CrossFit / Cardio)
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>Grupo muscular principal</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 16 }}
                >
                  {MUSCLE_GROUPS.filter((g) => g !== 'Todos').map((g) => {
                    const active = muscleGroup === g;
                    const mTheme = getMuscleTheme(g);
                    return (
                      <Pressable
                        key={g}
                        onPress={() => {
                          setMuscleGroup(g);
                          if (g === 'CrossFit' || g === 'Cardio') {
                            setExerciseType('time');
                          }
                        }}
                        style={[
                          styles.filterGroupPill,
                          active && {
                            backgroundColor: mTheme.primary,
                            borderColor: mTheme.primary,
                          },
                        ]}
                      >
                        <Text style={[styles.filterGroupText, active && styles.filterGroupTextActive]}>
                          {g}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Botón Guardar en el pie del modal */}
              <View style={styles.modalStickyFooter}>
                <Pressable
                  onPress={handleSave}
                  style={({ pressed }) => [styles.primarySaveBtn, pressed && s.btnPressed]}
                >
                  <LinearGradient
                    colors={GRADIENTS.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primarySaveGradient}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.primarySaveBtnText}>Guardar ejercicio</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ==========================================================
   MODAL DE RANGO DE FECHAS PARA ESTADÍSTICAS
========================================================== */
function RangeFilterModal({
  visible,
  currentDays,
  onClose,
  onSelectRange,
}: {
  visible: boolean;
  currentDays: number | null;
  onClose: () => void;
  onSelectRange: (days: number | null) => void;
}) {
  const options = [
    { label: 'Últimos 7 días', days: 7 },
    { label: 'Últimos 30 días (1 mes)', days: 30 },
    { label: 'Últimos 90 días (3 meses)', days: 90 },
    { label: 'Todo el historial completo', days: null },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.rangeModalCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>FILTRAR RANGO DE TIEMPO</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color={C.sub} />
            </Pressable>
          </View>

          {options.map((opt) => {
            const active = currentDays === opt.days;
            return (
              <Pressable
                key={opt.label}
                onPress={() => onSelectRange(opt.days)}
                style={[styles.rangeOptionRow, active && styles.rangeOptionRowActive]}
              >
                <Text style={[styles.rangeOptionText, active && styles.rangeOptionTextActive]}>{opt.label}</Text>
                {active && <Ionicons name="checkmark-circle" size={18} color={C.pastelPurple} />}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ==========================================================
   ESTILOS ESPECÍFICOS DE ENTRENAMIENTO
========================================================== */
const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 130,
  },
  stickyTabsContainer: {
    backgroundColor: C.bg,
    paddingTop: 2,
    paddingBottom: 8,
    zIndex: 25,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cyberTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  cyberTagText: {
    color: C.pastelPurple,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  screenTitle: {
    color: C.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  dateChipMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    marginTop: 6,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  dateChipMiniText: {
    color: C.textSub,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Gráfica
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rangePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.borderPastelPurple,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  rangePickerBtnText: {
    color: C.pastelPurple,
    fontSize: 11,
    fontWeight: '800',
  },

  // Medidor circular de volumen
  dayWorkoutSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  workoutVolRingContainer: {
    width: 152,
    height: 152,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutRingCenterGlow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.28)',
    shadowColor: '#F43F5E',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  workoutVolNumber: {
    color: C.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  workoutVolUnit: {
    color: C.pastelPurple,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  workoutKcalNumber: {
    color: C.text,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  workoutKcalUnit: {
    color: '#F43F5E',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  flameHaloGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(244, 63, 94, 0.25)',
  },
  metricBlockCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    justifyContent: 'center',
  },
  metricBlockLabel: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  metricBlockValue: {
    color: C.pastelPurple,
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 2,
  },

  // Estadísticas rotativas
  statOrbGlow: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  statDynamicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  statDynamicBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  carouselDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(203, 213, 225, 0.6)',
  },
  carouselDotActive: {
    width: 14,
    borderRadius: 3,
  },
  miniMusclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  miniMusclePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rotStatTitle: {
    color: C.pastelPurple,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  rotStatBigValue: {
    color: C.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  rotStatUnit: {
    color: C.pastelPink,
    fontSize: 13,
    fontWeight: '800',
  },
  rotStatSubtitle: {
    color: C.sub,
    fontSize: 12,
    textAlign: 'center',
  },
  rotHintText: {
    color: C.subMuted,
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 8,
  },

  // Ejercicio seleccionado en gráfica
  selectedExerciseNameHeader: {
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
  },
  selectedExerciseSub: {
    color: C.sub,
    fontSize: 11,
  },
  prHighlightCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 9,
    borderWidth: 1,
    marginBottom: 4,
  },
  prHighlightTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  prHighlightWeight: {
    fontSize: 12.5,
    fontWeight: '900',
    color: C.text,
  },
  prHighlightReps: {
    fontSize: 12,
    fontWeight: '800',
  },
  prHighlightDate: {
    fontSize: 9.5,
    color: C.subMuted,
    fontWeight: '600',
  },
  prHighlightEmpty: {
    fontSize: 10.5,
    color: C.subMuted,
    fontStyle: 'italic',
  },
  closeSelectedBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(203, 213, 225, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyHistoryText: {
    color: C.sub,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 240,
  },

  // Empty state Día
  emptyWorkoutCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderLight,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyWorkoutGradient: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    marginBottom: 12,
  },
  emptyWorkoutTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyWorkoutSubtitle: {
    color: C.sub,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  // Tarjeta de Ejercicio en Día
  workoutExerciseCard: {
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  exerciseAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: C.pastelPurple,
  },
  exerciseTitleText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
  },
  muscleBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  muscleBadgeText: {
    color: C.pastelPurple,
    fontSize: 11,
    fontWeight: '700',
  },
  volumeMiniText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '600',
  },
  modeTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modeToggleText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  toggleUnitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  toggleUnitText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  exerciseTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  exerciseTypeBtnActive: {
    backgroundColor: C.pastelPurple,
    borderColor: C.pastelPurple,
  },
  exerciseTypeBtnActiveTime: {
    backgroundColor: '#F97316',
    borderColor: '#EA580C',
  },
  exerciseTypeText: {
    color: C.sub,
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseTypeTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Tabla de Series
  setTableHeadersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 6,
  },
  setTableHeaderText: {
    color: C.subMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  setRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.6)',
  },
  setNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  setNumberText: {
    color: C.pastelPurple,
    fontSize: 12,
    fontWeight: '800',
  },
  setInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    paddingHorizontal: 8,
    marginHorizontal: 4,
  },
  setTextInput: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 6,
    minWidth: 36,
  },
  setUnitLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  addSetDashedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    backgroundColor: 'rgba(139, 92, 246, 0.04)',
    gap: 4,
  },
  addSetDashedText: {
    color: C.pastelPurple,
    fontSize: 12,
    fontWeight: '700',
  },

  // Biblioteca de Ejercicios
  searchAddRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  searchBoxGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    gap: 8,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchTextInput: {
    flex: 1,
    color: C.text,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  addSquareBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  addSquareGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterGroupPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  filterGroupPillActive: {
    backgroundColor: C.pastelPurple,
    borderColor: C.pastelPurple,
  },
  filterGroupText: {
    color: C.sub,
    fontSize: 12,
    fontWeight: '700',
  },
  filterGroupTextActive: {
    color: '#FFFFFF',
  },
  countBadgeRow: {
    marginVertical: 10,
  },
  countBadgeText: {
    color: C.subMuted,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  exerciseItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  exerciseItemCardSelected: {
    borderColor: C.pastelPurple,
    borderWidth: 2,
    backgroundColor: '#F8F7FF',
  },
  exerciseItemName: {
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
  },
  statsMiniText: {
    color: C.sub,
    fontSize: 11.5,
    fontWeight: '600',
  },

  quickCreateBanner: {
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
  },
  quickCreateBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  quickCreateBannerText: {
    flex: 1,
    fontSize: 13,
    color: C.sub,
    fontWeight: '600',
  },
  emptySearchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  emptySearchTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySearchSubtitle: {
    color: C.sub,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
    maxWidth: 260,
  },
  emptySearchAddBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  emptySearchAddGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptySearchAddText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Modales
  formModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  formModalSheetContainer: {
    width: '100%',
  },
  formModalSheetContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderPastelPurple,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  formModalHeaderPadding: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  modalStickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  primarySaveBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primarySaveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  primarySaveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sheetHandleBar: {
    width: 38,
    height: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  formTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  formSubtitle: {
    color: C.sub,
    fontSize: 12,
    marginTop: 2,
  },
  sheetCloseMiniBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    color: C.sub,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    paddingHorizontal: 4,
  },
  fieldTextInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 10,
  },
  rangeModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: C.borderPastelPurple,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 10,
  },
  rangeOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.6)',
  },
  rangeOptionRowActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  rangeOptionText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rangeOptionTextActive: {
    color: C.pastelPurple,
    fontWeight: '800',
  },
});

registerThemeSheet(styles);
